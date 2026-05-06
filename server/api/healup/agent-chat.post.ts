/**
 * Healup Agent — proxy a Claude API con tool use.
 *
 * Body: {
 *   messages: Anthropic.MessageParam[]
 * }
 * Response: la respuesta cruda de Anthropic (con stop_reason, content, etc.)
 *
 * El cliente (useHealupAgent) ejecuta los tools (insert a Supabase) y vuelve
 * a llamar a este endpoint con el tool_result hasta que stop_reason sea
 * "end_turn".
 *
 * Auth: requiere sesión en cookie dashboard_session (admin/superadmin/agente).
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

const TOOLS = [
  {
    name: 'register_egreso',
    description: 'Registrar un nuevo egreso/gasto en la tabla egresos_healup. Usar cuando el usuario diga cosas como "registrá", "anotá", "agregá un gasto/egreso de X soles por Y", "compré X por Y soles", etc.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Descripción breve del egreso (ej: "Botox 200UI", "Delivery moto", "Sueldo Jenny")' },
        categoria: {
          type: 'string',
          enum: ['INSUMOS', 'DELIVERY', 'MARKETING', 'MANTENIMIENTO', 'SUELDOS', 'OTROS'],
          description: 'Categoría del egreso. Si no es claro, usar OTROS.'
        },
        precio: { type: 'number', description: 'Precio total o unitario en soles peruanos (S/)' },
        cantidad: { type: 'number', description: 'Cantidad. Default 1.' },
        metodo_pago: {
          type: 'string',
          enum: ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'QR'],
          description: 'Método de pago. Si dice "yape" usar YAPE, "plin" PLIN, "efectivo" EFECTIVO, "transferencia" TRANSFERENCIA, "tarjeta" TARJETA_CREDITO.'
        },
        referencia: { type: 'string', description: 'Voucher / # operación / nota libre. Opcional.' },
        fecha: { type: 'string', description: 'Fecha del egreso en formato YYYY-MM-DD. Si no se menciona, omitir (usa hoy).' },
        producto: { type: 'string', description: 'Solo INSUMOS: producto exacto (ej. "Toxina Botox 200UI")' },
        unidad: { type: 'string', description: 'Solo INSUMOS: unidad de medida (UI, ML, frascos, unidad)' }
      },
      required: ['nombre', 'categoria', 'precio', 'metodo_pago']
    }
  },
  {
    name: 'list_egresos_mes',
    description: 'Consultar los egresos de un mes específico. Usar cuando el usuario pregunte "cuánto gasté en mayo", "qué egresos tengo este mes", "muéstrame los gastos de abril", etc.',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'Mes en formato YYYY-MM. Si no se especifica, usar el mes actual.' }
      }
    }
  },
  {
    name: 'resumen_mes',
    description: 'Resumen financiero del mes: total ingresos, total egresos, utilidad, # pacientes nuevos. Usar cuando el usuario pregunte "cómo vamos este mes", "balance", "cuánto facturamos".',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'YYYY-MM, default mes actual.' }
      }
    }
  }
]

const SYSTEM_PROMPT = `Eres el asistente conversacional del dashboard Healup (clínica de medicina estética en Lima, Perú).

Hablás español rioplatense neutro, cálido y profesional. Trabajás con la administradora de la clínica (Carlos, Valeria o el equipo).

Tu trabajo: ayudar a registrar egresos, consultar números del mes, y dar resúmenes financieros — todo vía conversación natural.

REGLAS:
1. Cuando el usuario describa un gasto/egreso, usá la tool register_egreso. NO confirmes antes — registralo y reportá lo que hiciste.
2. Si falta información obligatoria (nombre, categoría, precio, método de pago), preguntá una sola vez y registrá.
3. Para categorías:
   - Botox/toxina/hialurónico/agujas/insumos médicos → INSUMOS
   - Delivery/envío/moto → DELIVERY
   - Publicidad/Meta/TikTok/contenido → MARKETING
   - Limpieza/mantenimiento → MANTENIMIENTO
   - Sueldos/honorarios → SUELDOS
   - Resto → OTROS
4. Si el usuario dice "yape", "plin", "efectivo", "transferencia", "tarjeta", mapealo al enum.
5. Después de cada acción exitosa, respondé con UN PÁRRAFO breve confirmando qué hiciste y mostrando los datos clave (S/ total, categoría, fecha si aplica).
6. Si el usuario pide consulta (cuánto gasté, balance, etc.), usá la tool correspondiente.
7. Sé directo, no uses emojis salvo que el usuario los use.

Hoy es ${new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

export default defineEventHandler(async (event) => {
  // Auth básico via cookie de sesión (sin RLS en endpoint server-side)
  const cookies = parseCookies(event)
  const sessionRaw = cookies.dashboard_session
  if (!sessionRaw) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }
  let session: any = null
  try { session = JSON.parse(decodeURIComponent(sessionRaw)) } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }
  if (!session?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión sin email' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'ANTHROPIC_API_KEY no configurada en el servidor. Agregar al .env.'
    })
  }

  const body = await readBody(event)
  if (!body?.messages || !Array.isArray(body.messages)) {
    throw createError({ statusCode: 400, statusMessage: 'messages requerido (array)' })
  }

  try {
    const resp = await $fetch<any>(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: {
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: body.messages
      }
    })
    return resp
  } catch (err: any) {
    console.error('[agent-chat] Error Anthropic API:', err?.data || err?.message || err)
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.data?.error?.message || err?.message || 'Error llamando a Claude'
    })
  }
})
