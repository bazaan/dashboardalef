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
  },
  {
    name: 'consultar_citas_hoy',
    description: 'Consultar las citas de hoy en healup_calendar_events. Usar cuando el usuario pregunte "qué citas hay hoy", "quién viene hoy", "agenda de hoy", "cuántos pacientes tenemos".',
    input_schema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha en YYYY-MM-DD. Si no se especifica, usar hoy.' }
      }
    }
  },
  {
    name: 'crear_cita',
    description: 'Crear una nueva cita en healup_calendar_events. Usar cuando digan "agendá a María para mañana a las 3", "nueva cita", "agendar paciente".',
    input_schema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha en YYYY-MM-DD' },
        hora: { type: 'string', description: 'Hora en HH:MM (24h). Ej: "15:00"' },
        client_name: { type: 'string', description: 'Nombre del paciente' },
        client_surname: { type: 'string', description: 'Apellido del paciente' },
        client_phone: { type: 'string', description: 'Teléfono (opcional)' },
        client_dni: { type: 'string', description: 'DNI (opcional)' },
        client_email: { type: 'string', description: 'Email (opcional)' },
        subject: { type: 'string', description: 'Procedimiento o motivo de la cita' },
        cabina: { type: 'string', enum: ['cabina1', 'cabina2'], description: 'Cabina 1 (doctora/invasivos) o Cabina 2 (no invasivos). Default cabina1.' }
      },
      required: ['fecha', 'hora', 'client_name', 'subject']
    }
  },
  {
    name: 'actualizar_cita',
    description: 'Actualizar estado u otros campos de una cita existente. Usar para "cancelar cita", "marcar como atendido", "cambiar hora", "reagendar".',
    input_schema: {
      type: 'object',
      properties: {
        cita_id: { type: 'number', description: 'ID de la cita a actualizar' },
        estado: { type: 'string', enum: ['pendiente', 'confirmada', 'en_atencion', 'atendida', 'cancelada', 'no_show'], description: 'Nuevo estado' },
        hora: { type: 'string', description: 'Nueva hora HH:MM (si reagenda)' },
        fecha: { type: 'string', description: 'Nueva fecha YYYY-MM-DD (si reagenda)' },
        subject: { type: 'string', description: 'Nuevo procedimiento/motivo' },
        cobro_completado: { type: 'boolean', description: 'Marcar como cobrado' }
      },
      required: ['cita_id']
    }
  },
  {
    name: 'buscar_paciente',
    description: 'Buscar pacientes en PacientesBDwppHEALUP y PacientesBDfbigHEALUP. Usar cuando digan "buscá a María", "datos de la paciente García", "historial de...".',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre o apellido para buscar (parcial)' },
        dni: { type: 'string', description: 'DNI exacto para buscar' },
        telefono: { type: 'string', description: 'Número de teléfono para buscar' }
      }
    }
  },
  {
    name: 'registrar_paciente',
    description: 'Registrar un nuevo paciente en PacientesBDwppHEALUP. Usar cuando digan "agregá paciente nuevo", "registrá a María García".',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre completo del paciente' },
        dni: { type: 'string', description: 'DNI' },
        numero: { type: 'string', description: 'Teléfono con prefijo 51 (ej: 51987654321)' },
        correo: { type: 'string', description: 'Email (opcional)' },
        procedimiento: { type: 'string', description: 'Procedimiento de interés' },
        precio_tratamiento: { type: 'number', description: 'Precio del tratamiento en soles' },
        metodo_de_pago: { type: 'string', description: 'Método de pago: Efectivo, Yape, Plin, Transferencia, Tarjeta' },
        fecha_agendamiento: { type: 'string', description: 'Fecha y hora de la cita en formato ISO' }
      },
      required: ['nombre']
    }
  },
  {
    name: 'actualizar_paciente',
    description: 'Actualizar datos de un paciente existente. Usar para "cambiá el estado de María a Finalizado", "actualizá el precio", "marcá como atendido".',
    input_schema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'number', description: 'ID del paciente' },
        estado: { type: 'string', description: 'Nuevo estado: En espera, En proceso, Finalizado, Cancelado' },
        precio_tratamiento: { type: 'number', description: 'Nuevo precio' },
        metodo_de_pago: { type: 'string', description: 'Nuevo método de pago' },
        procedimiento: { type: 'string', description: 'Nuevo procedimiento' }
      },
      required: ['paciente_id']
    }
  },
  {
    name: 'listar_procedimientos',
    description: 'Listar el catálogo de procedimientos de Healup. Usar cuando pregunten "qué procedimientos tenemos", "cuánto cuesta el botox", "catálogo".',
    input_schema: {
      type: 'object',
      properties: {
        grupo: { type: 'string', description: 'Filtrar por grupo (ej: "MEDICINA ESTETICA", "FACIAL")' },
        nombre: { type: 'string', description: 'Buscar por nombre (parcial)' }
      }
    }
  },
  {
    name: 'consultar_stock',
    description: 'Consultar el inventario/stock actual de insumos. Usar cuando pregunten "cuánto botox queda", "qué insumos tenemos", "stock bajo", "inventario".',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Filtro por nombre del insumo (opcional, búsqueda parcial).' },
        solo_bajos: { type: 'boolean', description: 'true para mostrar solo items con stock bajo el umbral mínimo.' }
      }
    }
  },
  {
    name: 'movimiento_stock',
    description: 'Registrar entrada o salida de stock (insumos). Usar para "ingresaron 5 viales de botox", "se usaron 2 jeringas de hialurónico", "ajustar stock".',
    input_schema: {
      type: 'object',
      properties: {
        stock_item_id: { type: 'number', description: 'ID del item de stock' },
        tipo: { type: 'string', enum: ['entrada', 'salida', 'ajuste'], description: 'Tipo de movimiento' },
        cantidad: { type: 'number', description: 'Cantidad del movimiento' },
        motivo: { type: 'string', description: 'Motivo: compra, procedimiento, ajuste, vencimiento, etc.' },
        notas: { type: 'string', description: 'Notas adicionales (opcional)' }
      },
      required: ['stock_item_id', 'tipo', 'cantidad']
    }
  },
  {
    name: 'modificar_egreso',
    description: 'Modificar un egreso existente (cambiar nombre, precio, categoría, etc.) o eliminarlo (soft delete). Usar para "corregí el egreso de delivery", "borrá el último egreso".',
    input_schema: {
      type: 'object',
      properties: {
        egreso_id: { type: 'string', description: 'ID (UUID) del egreso a modificar' },
        nombre: { type: 'string', description: 'Nuevo nombre/descripción' },
        precio: { type: 'number', description: 'Nuevo precio' },
        cantidad: { type: 'number', description: 'Nueva cantidad' },
        categoria: { type: 'string', enum: ['INSUMOS', 'DELIVERY', 'MARKETING', 'MANTENIMIENTO', 'SUELDOS', 'OTROS'], description: 'Nueva categoría' },
        metodo_pago: { type: 'string', enum: ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'QR'], description: 'Nuevo método' },
        eliminar: { type: 'boolean', description: 'true para soft-delete (marcar como descartado)' }
      },
      required: ['egreso_id']
    }
  },
  {
    name: 'consultar_caja_chica',
    description: 'Consultar el saldo de caja chica (efectivo en mano) y cuenta bancaria del mes. Calcula ingresos en efectivo menos egresos en efectivo. Usar cuando pregunten "cuánto hay en caja chica", "saldo de caja", "efectivo disponible", "cuánta plata hay", "caja", "saldo bancario".',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'YYYY-MM, default mes actual.' }
      }
    }
  },
  {
    name: 'consultar_leads',
    description: 'Consultar leads (prospectos) de WhatsApp y redes sociales. Usar para "cuántos leads tenemos", "leads calientes", "prospectos del mes".',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['lead_frio', 'lead_tibio', 'lead_caliente'], description: 'Filtrar por estado del lead' },
        mes: { type: 'string', description: 'Mes en YYYY-MM para filtrar por fecha de creación' },
        limite: { type: 'number', description: 'Máximo de resultados (default 20)' }
      }
    }
  }
]

const SYSTEM_PROMPT = `Tu nombre es ValerIA — sos la asistente inteligente del dashboard Healup, clínica de medicina estética en Lima, Perú.

Hablás español rioplatense neutro, cálido y profesional. Trabajás con la administradora de la clínica (Carlos, Valeria o el equipo). Si te preguntan tu nombre, decí "Soy ValerIA, tu asistente del dashboard".

Tenés acceso COMPLETO a toda la base de datos del dashboard: citas, pacientes, egresos, stock/insumos, procedimientos, leads. Podés consultar, crear, modificar y eliminar registros.

CAPACIDADES:
- EGRESOS: registrar, listar por mes, modificar, eliminar (soft delete)
- CITAS: consultar agenda del día, crear nuevas citas, actualizar estado (pendiente/confirmada/en_atencion/atendida/cancelada/no_show), reagendar
- PACIENTES: buscar por nombre/DNI/teléfono, registrar nuevos, actualizar estado y datos
- PROCEDIMIENTOS: consultar catálogo completo con precios (price = valor_unitario sin IGV, total = price * 1.18)
- STOCK: consultar inventario, ver stock bajo, registrar entradas/salidas/ajustes de insumos
- LEADS: consultar prospectos por estado (frío/tibio/caliente) y mes
- RESUMEN: ingresos, egresos, utilidad y pacientes del mes
- CAJA CHICA: saldo de efectivo en mano (ingresos efectivo − egresos efectivo) y saldo de cuenta bancaria (ingresos no-efectivo − egresos no-efectivo)

REGLAS:
1. Cuando el usuario pida una acción (registrar, modificar, crear), ejecutala directamente con la tool. NO confirmes antes.
2. Si falta info obligatoria, preguntá una sola vez y luego ejecutá.
3. Para egresos — categorías: INSUMOS (botox/hialurónico/agujas), DELIVERY, MARKETING, MANTENIMIENTO, SUELDOS, OTROS.
4. Mapeá métodos de pago: "yape"→YAPE, "plin"→PLIN, "efectivo"→EFECTIVO, "transferencia"→TRANSFERENCIA, "tarjeta"→TARJETA_CREDITO.
5. Después de cada acción, confirmá en 1-2 oraciones con datos clave.
6. Cabina 1 = doctora/invasivos (reserva S/50), Cabina 2 = no invasivos (reserva S/20).
7. Tus respuestas se leen en voz alta — sé conciso y natural. Máximo 3-4 oraciones. Evitá listas largas.
8. Para buscar pacientes, intentá primero por nombre en PacientesBDwppHEALUP, luego PacientesBDfbigHEALUP.
9. Los precios de procedimientos en el catálogo son sin IGV. Para decir el precio al usuario multiplicá por 1.18.
10. Si el usuario pregunta algo que no podés resolver con las tools, respondé honestamente.

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
        max_tokens: 2048,
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
