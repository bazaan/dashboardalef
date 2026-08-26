/**
 * POST /api/tradecars/tasador-chat
 *
 * Chat del módulo "Tasador" de Trade Cars — proxy a ChatGPT (OpenAI) con
 * function calling de sólo lectura sobre las tablas propias de la empresa.
 *
 * PRIORIDAD: el modelo consulta las tablas del dashboard (vehículos en stock,
 * compras y ventas históricas, negociaciones del funnel, solicitudes de venta
 * de la web) ANTES de responder con precios. Sólo cuando ninguna tabla tiene
 * el dato, cae a su conocimiento general del mercado de autos usados — y el
 * propio prompt le exige decirlo explícitamente cuando lo hace. No hay
 * búsqueda en internet real (no hay una API de búsqueda configurada en este
 * proyecto): "de segundo con internet" se resuelve con el conocimiento
 * general del modelo, no con navegación en vivo.
 *
 * A diferencia de HealupAgent (que ejecuta los tools en el cliente y hace
 * ping-pong con el navegador), acá el loop de tools corre ENTERO en el
 * servidor: el cliente manda los mensajes de usuario/asistente y recibe un
 * texto final ya armado. Así el frontend no necesita saber nada del protocolo
 * de function calling, y los nombres/columnas de las tablas no viajan al
 * bundle del navegador.
 *
 * Body:  { messages: [{ role: 'user'|'assistant', content: string }, ...] }
 * Resp:  { reply: string }
 *
 * Auth: cookie dashboard_session, superadmin o company_id de Trade Cars.
 * Sólo lectura: ninguna tool escribe en la base de datos.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const OPENAI_CHAT_API = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.TRADECARS_TASADOR_MODEL || 'gpt-4o'
const MAX_RONDAS_TOOLS = 4   // tope de idas y vueltas modelo↔tools por mensaje

/* ══════════════════ Tools (sólo lectura) ══════════════════ */

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'resumen_precio_referencia',
      description:
        'La tool principal para tasar: cruza las compras que Trade Cars ya hizo con las ' +
        'negociaciones del funnel de compras (monto final acordado) para un modelo. Devuelve ' +
        'cuántos casos hay y el precio mínimo/promedio/máximo pagado. Usar SIEMPRE que pregunten ' +
        '"cuánto pagar/ofrecer por...", "precio de mercado de...", "cuánto vale un...".',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string', description: 'Marca del vehículo, ej: "Toyota", "Kia"' },
          modelo: { type: 'string', description: 'Modelo, ej: "Yaris", "Rio". Opcional: si se omite trae todos los modelos de la marca.' },
          anio_desde: { type: 'integer', description: 'Año mínimo a considerar. Opcional.' },
          anio_hasta: { type: 'integer', description: 'Año máximo a considerar. Opcional.' },
        },
        required: ['marca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_vehiculos_stock',
      description: 'Vehículos que Trade Cars tiene hoy en su inventario (comprados, listos para vender o en preparación).',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          estado: { type: 'string', enum: ['disponible', 'reservado', 'vendido', 'en_preparacion'], description: 'Opcional, por defecto trae todos los estados.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_compras_historicas',
      description: 'Vehículos que Trade Cars ya compró (a un proveedor/dueño particular). Incluye precio de tasación y precio final de compra.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          anio_desde: { type: 'integer' },
          anio_hasta: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ventas_historicas',
      description: 'Vehículos que Trade Cars ya vendió a un cliente. Incluye precio de venta, precio de compra y margen.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          anio_desde: { type: 'integer' },
          anio_hasta: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_negociaciones_funnel',
      description:
        'Leads del funnel de compras que llegaron a negociar un precio: propuesta inicial del asesor, ' +
        'monto mejorado y expectativa del cliente. Útil para ver cómo se movió el precio en negociaciones, ' +
        'no sólo el resultado final.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          solo_concretados: { type: 'boolean', description: 'true = sólo negociaciones que terminaron en compra (fecha_compra no nula). Default false.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_solicitudes_venta',
      description: 'Formularios de la web "Quiero vender mi auto": lo que el dueño pidió por su vehículo, antes de cualquier negociación.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          estado: { type: 'string', enum: ['nuevo', 'contactado', 'tasado', 'comprado', 'descartado'] },
        },
      },
    },
  },
]

const LIMITE_FILAS = 15

function comodin(v?: string) {
  return v ? `%${v.trim()}%` : null
}

function stats(valores: number[]) {
  const limpio = valores.filter((v) => typeof v === 'number' && !isNaN(v))
  if (!limpio.length) return null
  const suma = limpio.reduce((a, b) => a + b, 0)
  return {
    casos: limpio.length,
    minimo: Math.round(Math.min(...limpio)),
    promedio: Math.round(suma / limpio.length),
    maximo: Math.round(Math.max(...limpio)),
  }
}

/* ══════════════════ Ejecución de cada tool contra Supabase ══════════════════ */

async function ejecutarTool(supabase: any, nombre: string, args: any) {
  switch (nombre) {
    case 'resumen_precio_referencia': {
      const marca = comodin(args.marca)
      const modelo = comodin(args.modelo)

      let qCompras = supabase.from('tradecars_compras')
        .select('marca,modelo,anio,kilometraje,precio_tasacion,precio_compra,fecha_compra,estado')
        .eq('estado', 'completada')
        .order('fecha_compra', { ascending: false })
        .limit(50)
      if (marca) qCompras = qCompras.ilike('marca', marca)
      if (modelo) qCompras = qCompras.ilike('modelo', modelo)
      if (args.anio_desde) qCompras = qCompras.gte('anio', args.anio_desde)
      if (args.anio_hasta) qCompras = qCompras.lte('anio', args.anio_hasta)
      const { data: compras } = await qCompras

      let qFunnel = supabase.from('tradecars_funnel_leads')
        .select('marca,marca_normalizada,modelo,anio,monto_mejorado,monto_propuesta_inicial,fecha_compra')
        .not('fecha_compra', 'is', null)
        .not('monto_mejorado', 'is', null)
        .order('fecha_compra', { ascending: false })
        .limit(50)
      if (marca) qFunnel = qFunnel.or(`marca_normalizada.ilike.${marca},marca.ilike.${marca}`)
      if (modelo) qFunnel = qFunnel.ilike('modelo', modelo)
      const { data: funnel } = await qFunnel
      const funnelFiltrado = (funnel || []).filter((f: any) => {
        if (!args.anio_desde && !args.anio_hasta) return true
        const a = Number(f.anio)
        if (!a) return true // sin año registrado: no se descarta, se avisa aparte
        if (args.anio_desde && a < args.anio_desde) return false
        if (args.anio_hasta && a > args.anio_hasta) return false
        return true
      })

      return {
        compras_realizadas: stats((compras || []).map((c: any) => Number(c.precio_compra))),
        negociaciones_funnel_concretadas: stats(funnelFiltrado.map((f: any) => Number(f.monto_mejorado))),
        detalle_compras: (compras || []).slice(0, 8).map((c: any) => ({
          marca: c.marca, modelo: c.modelo, anio: c.anio, km: c.kilometraje,
          precio_tasacion: c.precio_tasacion, precio_compra: c.precio_compra, fecha: c.fecha_compra,
        })),
        detalle_negociaciones: funnelFiltrado.slice(0, 8).map((f: any) => ({
          marca: f.marca_normalizada || f.marca, modelo: f.modelo, anio: f.anio,
          propuesta_inicial: f.monto_propuesta_inicial, monto_final: f.monto_mejorado, fecha: f.fecha_compra,
        })),
        nota: 'Si ambos vienen vacíos, Trade Cars no tiene registros propios de este modelo — decirlo y, recién ahí, dar una referencia general de mercado aclarando que no es un dato interno.',
      }
    }

    case 'buscar_vehiculos_stock': {
      let q = supabase.from('tradecars_vehiculos')
        .select('codigo,marca,modelo,version,anio,kilometraje,transmision,combustible,precio_compra,precio_venta,estado,fecha_ingreso')
        .order('fecha_ingreso', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.estado) q = q.eq('estado', args.estado)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { total: data?.length || 0, vehiculos: data }
    }

    case 'buscar_compras_historicas': {
      let q = supabase.from('tradecars_compras')
        .select('marca,modelo,anio,placa,kilometraje,precio_tasacion,precio_compra,estado,asesor,fecha_compra')
        .order('fecha_compra', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.anio_desde) q = q.gte('anio', args.anio_desde)
      if (args.anio_hasta) q = q.lte('anio', args.anio_hasta)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { total: data?.length || 0, compras: data }
    }

    case 'buscar_ventas_historicas': {
      let q = supabase.from('tradecars_ventas')
        .select('marca,modelo,anio,placa,precio_venta,precio_compra,metodo_pago,estado,asesor,fecha_venta')
        .order('fecha_venta', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.anio_desde) q = q.gte('anio', args.anio_desde)
      if (args.anio_hasta) q = q.lte('anio', args.anio_hasta)
      const { data, error } = await q
      if (error) return { error: error.message }
      const conMargen = (data || []).map((v: any) => ({
        ...v,
        margen: v.precio_venta != null && v.precio_compra != null ? Number(v.precio_venta) - Number(v.precio_compra) : null,
      }))
      return { total: conMargen.length, ventas: conMargen }
    }

    case 'buscar_negociaciones_funnel': {
      let q = supabase.from('tradecars_funnel_leads')
        .select('marca,marca_normalizada,modelo,anio,status,monto_propuesta_inicial,monto_mejorado,expectativa_cliente,fecha_funnel,fecha_compra')
        .order('fecha_funnel', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.or(`marca_normalizada.ilike.${comodin(args.marca)},marca.ilike.${comodin(args.marca)}`)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.solo_concretados) q = q.not('fecha_compra', 'is', null)
      const { data, error } = await q
      if (error) return { error: error.message }
      return {
        total: data?.length || 0,
        negociaciones: (data || []).map((f: any) => ({
          marca: f.marca_normalizada || f.marca, modelo: f.modelo, anio: f.anio, status: f.status,
          propuesta_inicial: f.monto_propuesta_inicial, monto_mejorado: f.monto_mejorado,
          expectativa_cliente: f.expectativa_cliente, fecha: f.fecha_funnel,
        })),
      }
    }

    case 'buscar_solicitudes_venta': {
      let q = supabase.from('tradecars_solicitudes_venta')
        .select('marca,modelo,anio,kilometraje,distrito,tiene_deuda,precio_ofrecido,estado,created_at')
        .order('created_at', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.estado) q = q.eq('estado', args.estado)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { total: data?.length || 0, solicitudes: data }
    }

    default:
      return { error: 'tool desconocida: ' + nombre }
  }
}

const SYSTEM_PROMPT = `Sos el Tasador IA de Trade Cars Perú, empresa de compra-venta de autos usados en Lima.
Ayudás a los asesores a decidir cuánto ofrecer por un auto que alguien quiere vender, y a resolver
preguntas sobre el inventario, compras y ventas de la empresa.

REGLA PRINCIPAL: las tablas del dashboard son la fuente PRIMARIA. Antes de dar cualquier precio de
referencia, consultá "resumen_precio_referencia" (cruza compras reales + negociaciones del funnel).
Si necesitás más detalle, usá las demás tools (stock, compras, ventas, funnel, solicitudes de venta).

SÓLO cuando las tools no devuelvan ningún caso para ese modelo — Trade Cars nunca lo compró ni lo
vendió — recién ahí podés usar tu conocimiento general del mercado peruano de autos usados. Cuando lo
hagas, decilo explícitamente ("Trade Cars no tiene registros propios de este modelo; como referencia
general del mercado..."). Nunca mezcles un dato inventado con uno real sin aclarar cuál es cuál.

Respondé en soles (S/), con cifras concretas y citando de dónde salen ("según 4 compras registradas
entre enero y julio 2026"). Sé breve y directo — esto lo lee un asesor en medio de una negociación,
no un informe. No inventes registros que las tools no devolvieron.

Hoy es ${new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

export default defineEventHandler(async (event) => {
  const cookies = parseCookies(event)
  const sessionRaw = cookies.dashboard_session
  if (!sessionRaw) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  let session: any = null
  try { session = JSON.parse(decodeURIComponent(sessionRaw)) } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }
  if (!session?.email) throw createError({ statusCode: 401, statusMessage: 'Sesión sin email' })

  const esSuperadmin = String(session.role || '').toLowerCase() === 'superadmin'
  const companyId = String(session.company_id || '').toLowerCase().replace(/\s+/g, '')
  if (!esSuperadmin && !companyId.includes('tradecars')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso al Tasador de Trade Cars' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OPENAI_API_KEY no configurada en el servidor. Agregar al .env.' })
  }

  const body = await readBody(event)
  if (!body?.messages || !Array.isArray(body.messages) || !body.messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'messages requerido (array no vacío)' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // El cliente sólo manda turnos user/assistant en texto plano; el manejo de
  // tool_calls es enteramente interno a este endpoint y no viaja al navegador.
  const historial: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...body.messages.map((m: any) => ({ role: m.role, content: String(m.content ?? '') })),
  ]

  try {
    for (let ronda = 0; ronda <= MAX_RONDAS_TOOLS; ronda++) {
      const forzarSinTools = ronda === MAX_RONDAS_TOOLS
      const resp: any = await $fetch(OPENAI_CHAT_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: {
          model: MODEL,
          messages: historial,
          ...(forzarSinTools ? {} : { tools: TOOLS, tool_choice: 'auto' }),
        },
      })

      const choice = resp?.choices?.[0]
      const msg = choice?.message
      if (!msg) throw createError({ statusCode: 502, statusMessage: 'Respuesta vacía de OpenAI' })

      const toolCalls = msg.tool_calls
      if (!toolCalls?.length) {
        return { reply: msg.content || 'No obtuve respuesta.' }
      }

      historial.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls })

      for (const tc of toolCalls) {
        let args: any = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch { /* args vacíos si viene mal formado */ }
        const resultado = await ejecutarTool(supabase, tc.function.name, args)
        historial.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) })
      }
    }

    throw createError({ statusCode: 504, statusMessage: 'El Tasador tardó demasiado consultando datos. Probá una pregunta más específica.' })
  } catch (err: any) {
    console.error('[tasador-chat] Error:', err?.data || err?.message || err)
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.data?.error?.message || err?.message || 'Error llamando al Tasador',
    })
  }
})
