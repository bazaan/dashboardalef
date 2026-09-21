/**
 * POST /api/tradecars/tasador-chat
 *
 * Chat del módulo "Tasador" de Trade Cars. Hace dos cosas distintas:
 *
 *  1. RESPONDE SOBRE EL DASHBOARD — funnel, leads, asesores, campañas y costos,
 *     stock, compras, ventas, solicitudes de la web. Todo de sólo lectura.
 *
 *  2. LE ENSEÑA AL AGENTE TASADOR DE WHATSAPP — la configuración que el
 *     supervisor cambia acá es literalmente la que el agente de n8n lee en cada
 *     tasación (workflow "TRADECARS | WHATSAPP | Agente Tasador", tool
 *     `obtener_configuracion`). No hay copia paralela ni redeploy de por medio.
 *
 * SISTEMA DE DOS NIVELES (acordado con el cliente el 26/08/2026):
 *
 *   · Nivel 1 — parámetros de tasación, reglas por marca/modelo y modelos de
 *     alta rotación: Trade Cars los cambia solo. El chat PROPONE y la persona
 *     confirma en la UI; recién ahí se escribe (vía /api/tradecars/tasador-config).
 *     Este endpoint NUNCA escribe configuración por su cuenta.
 *
 *   · Nivel 2 — lógica de cálculo, flujo de conversación, formato de salida,
 *     parámetros nuevos: no se tocan desde la UI porque romperían el prompt.
 *     El chat los deriva como solicitud a Alef.
 *
 * El loop de function calling corre ENTERO en el servidor: el cliente manda
 * turnos user/assistant en texto plano y recibe { reply, propuestas }. Así los
 * nombres de tablas y el protocolo de tools nunca viajan al bundle del navegador.
 *
 * Body:  { messages: [{ role: 'user'|'assistant', content: string }, ...] }
 * Resp:  { reply: string, propuestas: Propuesta[] }
 *
 * Auth: sesión de Trade Cars (o superadmin de Alef).
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionTradeCarsEnBase, puedeEditarTasador, leerConfigTasador, logTasador } from '../../utils/tradecars'
import { TC_ETAPAS } from '../../../utils/tradecarsFunnel'

const OPENAI_CHAT_API = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.TRADECARS_TASADOR_MODEL || 'gpt-4o'
const MAX_RONDAS_TOOLS = 5
const LIMITE_FILAS = 15

/* ══════════════════ Tools ══════════════════ */

const TOOLS = [
  /* ───── Configuración del Agente Tasador de WhatsApp ───── */
  {
    type: 'function',
    function: {
      name: 'ver_configuracion_tasador',
      description:
        'Muestra la configuración vigente con la que el Agente Tasador de WhatsApp cotiza los autos: ' +
        'los parámetros de tasación (descuentos por km, ajuste por año, márgenes, etc.), las reglas ' +
        'especiales por marca/modelo y los modelos marcados como de alta rotación. Incluye un ' +
        'diagnóstico de si el Tasador está en condiciones de tasar. Usar SIEMPRE antes de proponer ' +
        'cualquier cambio, para saber el valor actual.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_cambio_parametro',
      description:
        'Propone cambiar el valor de un parámetro de tasación. NO lo aplica: deja una propuesta que la ' +
        'persona confirma con un botón. Usar cuando pidan ajustar descuentos, umbrales, márgenes, etc. ' +
        'Consultar antes ver_configuracion_tasador para conocer la clave exacta y el valor actual.',
      parameters: {
        type: 'object',
        properties: {
          clave: { type: 'string', description: 'Clave exacta del parámetro, tal como aparece en ver_configuracion_tasador. Ej: "descuento_km_pct".' },
          valor_nuevo: { type: 'number', description: 'Nuevo valor numérico.' },
          motivo: { type: 'string', description: 'Por qué se cambia, en las palabras del supervisor. Queda en el historial.' },
        },
        required: ['clave', 'valor_nuevo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_regla_marca_modelo',
      description:
        'Propone una regla especial para una marca/modelo: un ajuste en dólares o porcentaje que se ' +
        'aplica sobre el precio cuando el auto coincide. Usar "*" en marca o modelo para "cualquiera". ' +
        'NO la aplica: deja una propuesta para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string', description: 'Marca, o "*" para todas.' },
          modelo: { type: 'string', description: 'Modelo, o "*" para todos. Default "*".' },
          tipo_ajuste: { type: 'string', enum: ['resta_usd', 'suma_usd', 'resta_pct', 'suma_pct'], description: 'Cómo mueve el precio.' },
          valor_ajuste: { type: 'number', description: 'Monto en USD o porcentaje, siempre positivo (el tipo define si suma o resta).' },
          descripcion: { type: 'string', description: 'Qué hace la regla y por qué, en español claro.' },
          gnv_glp: { type: 'string', enum: ['si', 'no'], description: 'Opcional: aplicar sólo si el auto tiene (o no tiene) GNV/GLP.' },
          anio_min: { type: 'integer', description: 'Opcional: año mínimo de fabricación para que aplique.' },
          anio_max: { type: 'integer', description: 'Opcional: año máximo.' },
          motivo: { type: 'string', description: 'Motivo del supervisor. Queda en el historial.' },
        },
        required: ['marca', 'tipo_ajuste', 'valor_ajuste', 'descripcion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_desactivar_regla',
      description: 'Propone desactivar una regla por marca/modelo que ya existe. Pedir el id con ver_configuracion_tasador.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id de la regla.' },
          motivo: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_alta_rotacion',
      description:
        'Propone marcar un modelo como de alta rotación. En esos modelos el Tasador deja de descontar ' +
        'preventivamente y cotiza en el extremo alto del rango, para asegurar la compra.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          motivo_rotacion: { type: 'string', description: 'Por qué rota rápido.' },
          motivo: { type: 'string' },
        },
        required: ['marca', 'modelo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_quitar_alta_rotacion',
      description: 'Propone sacar un modelo de la lista de alta rotación. Pedir el id con ver_configuracion_tasador.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, motivo: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'solicitar_cambio_a_alef',
      description:
        'Para cambios que NO se pueden hacer desde el dashboard porque tocan la lógica de cálculo, el ' +
        'flujo de conversación del agente, el formato de salida, o requieren un parámetro que hoy no ' +
        'existe. Deja una solicitud registrada para que el equipo técnico de Alef la implemente en n8n. ' +
        'Usar esto en vez de inventar que se puede configurar algo que no se puede.',
      parameters: {
        type: 'object',
        properties: {
          resumen: { type: 'string', description: 'Qué se quiere que haga el agente, descrito con precisión.' },
          motivo: { type: 'string', description: 'Para qué lo necesitan.' },
        },
        required: ['resumen'],
      },
    },
  },

  /* ───── Datos que usa el Tasador para cotizar ───── */
  {
    type: 'function',
    function: {
      name: 'buscar_comparables_historicos',
      description:
        'Los comparables reales que el Agente Tasador de WhatsApp usa para cotizar: compras y ventas ' +
        'históricas de Trade Cars con km, año, transmisión, precio de compra, precio de venta, margen y ' +
        'días en inventario. Es la fuente principal de cualquier tasación.',
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
      name: 'consultar_precio_vehiculo_nuevo',
      description:
        'Precio del vehículo 0km, que el Tasador usa como techo (un usado nunca se cotiza por encima). ' +
        'Sólo aplica a autos con muy poco kilometraje.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          anio_modelo: { type: 'integer' },
        },
        required: ['marca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_precio_referencia',
      description:
        'Cruza las compras que Trade Cars ya cerró con las negociaciones concretadas del funnel para un ' +
        'modelo: cuántos casos hay y el precio mínimo/promedio/máximo pagado. Complementa a ' +
        'buscar_comparables_historicos con lo que se negoció por el CRM.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          anio_desde: { type: 'integer' },
          anio_hasta: { type: 'integer' },
        },
        required: ['marca'],
      },
    },
  },

  /* ───── Dashboard: funnel, asesores, campañas ───── */
  {
    type: 'function',
    function: {
      name: 'resumen_funnel',
      description:
        'El embudo de compras del dashboard: cuántos leads llegaron a cada etapa (LEADS, CUMPLE ' +
        'POLITICA, CONTACTADO, INTERESADOS, CITAS AGENDADAS, CITAS ASISTIDAS, COMPRAS) y la conversión ' +
        'entre etapas. Es acumulativo: un lead que compró suma en las 7 etapas. Usar para preguntas del ' +
        'tipo "cuántas compras hubo", "cómo viene la conversión", "cuántos leads este mes".',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha inicial YYYY-MM-DD. Opcional.' },
          hasta: { type: 'string', description: 'Fecha final YYYY-MM-DD. Opcional.' },
          asesor: { type: 'string', description: 'Nombre del asesor. Opcional.' },
          canal: { type: 'string', enum: ['WhatsApp', 'Instagram', 'TikTok', 'Facebook'], description: 'Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'metricas_por_asesor',
      description:
        'Compara el rendimiento de los asesores entre sí: leads, citas agendadas, compras concretadas y ' +
        'tasa de conversión de cada uno, más cuántos leads dejó sin estado. Usar para "cómo va el ' +
        'equipo", "quién está vendiendo más", "quién no está actualizando sus leads".',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'YYYY-MM-DD. Opcional.' },
          hasta: { type: 'string', description: 'YYYY-MM-DD. Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'costos_campanas',
      description:
        'Inversión publicitaria por campaña y su rendimiento: cuánto se invirtió, cuántos leads trajo, ' +
        'costo por lead y cuánto costó cada compra concretada.',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'YYYY-MM-DD. Opcional.' },
          hasta: { type: 'string', description: 'YYYY-MM-DD. Opcional.' },
          campana: { type: 'string', description: 'Nombre de la campaña. Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leads_sin_estado',
      description:
        'Leads que el asesor nunca marcó (sin status o con perfil sin definir) y que por eso no entran ' +
        'en el embudo. Es el control de calidad de la data del CRM.',
      parameters: {
        type: 'object',
        properties: { asesor: { type: 'string', description: 'Opcional.' } },
      },
    },
  },

  /* ───── Operaciones ───── */
  {
    type: 'function',
    function: {
      name: 'buscar_vehiculos_stock',
      description: 'Vehículos que Trade Cars tiene hoy en inventario.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          estado: { type: 'string', enum: ['disponible', 'reservado', 'vendido', 'en_preparacion'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_ventas_historicas',
      description: 'Vehículos que Trade Cars ya vendió, con precio de venta, de compra y margen.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' }, modelo: { type: 'string' },
          anio_desde: { type: 'integer' }, anio_hasta: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_negociaciones_funnel',
      description:
        'Leads del funnel que llegaron a negociar precio: propuesta inicial del asesor, monto mejorado y ' +
        'expectativa del cliente. Sirve para ver cómo se movió el precio, no sólo el resultado.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' }, modelo: { type: 'string' },
          solo_concretados: { type: 'boolean', description: 'true = sólo las que terminaron en compra.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_solicitudes_venta',
      description: 'Formularios de la web "Quiero vender mi auto": lo que el dueño pide por su vehículo antes de negociar.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' }, modelo: { type: 'string' },
          estado: { type: 'string', enum: ['nuevo', 'contactado', 'tasado', 'comprado', 'descartado'] },
        },
      },
    },
  },
]

/* ══════════════════ Utilidades ══════════════════ */

function comodin(v?: string) {
  return v ? `%${String(v).trim()}%` : null
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

/** Aplica los filtros comunes del funnel sobre un query de PostgREST. */
function filtrarFunnel(q: any, args: any) {
  if (args.desde) q = q.gte('fecha_funnel', args.desde)
  if (args.hasta) q = q.lte('fecha_funnel', args.hasta)
  if (args.asesor) q = q.eq('asesor', args.asesor)
  if (args.canal) q = q.eq('canal_origen', args.canal)
  if (args.campana) q = q.ilike('campana', comodin(args.campana)!)
  return q
}

/**
 * Cuenta leads por etapa sin traerse las filas.
 *
 * El embudo es acumulativo, así que cada barra es "cuántos leads tienen
 * etapa_rank >= N". Se resuelve con counts en la base (head: true) en vez de
 * traer las ~8.700 filas: además de ser más barato, evita el tope de 1.000
 * filas por request de PostgREST, que daría un conteo silenciosamente incompleto.
 */
async function contarPorEtapa(supabase: any, args: any, ranks: number[]) {
  const conteos = await Promise.all(ranks.map(async (rank) => {
    let q = supabase.from('tradecars_funnel_leads')
      .select('id', { count: 'exact', head: true })
      .gte('etapa_rank', rank)
    q = filtrarFunnel(q, args)
    const { count } = await q
    return count || 0
  }))
  return conteos
}

/* ══════════════════ Ejecución de tools ══════════════════ */

async function ejecutarTool(
  supabase: any,
  nombre: string,
  args: any,
  ctx: { propuestas: any[]; puedeEditar: boolean },
) {
  /* ───── Configuración ───── */
  if (nombre === 'ver_configuracion_tasador') {
    const config = await leerConfigTasador(supabase)
    const [historico, nuevos] = await Promise.all([
      supabase.from('tradecars_data_historico_compras_ventas').select('id', { count: 'exact', head: true }),
      supabase.from('tradecars_data_precios_vehiculos_nuevos').select('id', { count: 'exact', head: true }),
    ])

    const nHist = historico.count || 0
    const nNuevos = nuevos.count || 0
    const avisos: string[] = []
    if (!config.parametros_detalle.length) {
      avisos.push('CRÍTICO: no hay parámetros cargados. El Agente Tasador de WhatsApp aborta con "configuracion_no_disponible" y no puede cotizar nada.')
    }
    if (!nHist) avisos.push('CRÍTICO: la tabla de comparables históricos está vacía — sin ella no hay con qué tasar.')
    if (!nNuevos) avisos.push('La tabla de precios de vehículos nuevos está vacía — no se puede aplicar el techo del 0km.')

    return {
      parametros: config.parametros_detalle.map((p: any) => ({
        clave: p.clave, valor: Number(p.valor), unidad: p.unidad,
        categoria: p.categoria, descripcion: p.descripcion,
        rango_permitido: { minimo: p.minimo, maximo: p.maximo },
      })),
      reglas_marca_modelo: config.reglas,
      modelos_alta_rotacion: config.alta_rotacion,
      datos_disponibles: { comparables_historicos: nHist, precios_vehiculos_nuevos: nNuevos },
      avisos,
    }
  }

  const PROPUESTAS: Record<string, (a: any) => any> = {
    proponer_cambio_parametro: (a) => ({
      tipo: 'parametro',
      accion: 'actualizar_parametro',
      titulo: `Cambiar ${a.clave}`,
      datos: { clave: a.clave, valor: a.valor_nuevo, motivo: a.motivo || null },
    }),
    proponer_regla_marca_modelo: (a) => ({
      tipo: 'regla',
      accion: 'crear_regla',
      titulo: `Nueva regla para ${a.marca}${a.modelo && a.modelo !== '*' ? ' ' + a.modelo : ''}`,
      datos: {
        marca: a.marca, modelo: a.modelo || '*', tipo_ajuste: a.tipo_ajuste,
        valor_ajuste: a.valor_ajuste, descripcion: a.descripcion,
        gnv_glp: a.gnv_glp || null, anio_min: a.anio_min ?? null, anio_max: a.anio_max ?? null,
        motivo: a.motivo || null,
      },
    }),
    proponer_desactivar_regla: (a) => ({
      tipo: 'regla',
      accion: 'desactivar_regla',
      titulo: 'Desactivar una regla',
      datos: { id: a.id, motivo: a.motivo || null },
    }),
    proponer_alta_rotacion: (a) => ({
      tipo: 'alta_rotacion',
      accion: 'agregar_alta_rotacion',
      titulo: `Marcar ${a.marca} ${a.modelo} como alta rotación`,
      datos: { marca: a.marca, modelo: a.modelo, motivo_rotacion: a.motivo_rotacion || null, motivo: a.motivo || null },
    }),
    proponer_quitar_alta_rotacion: (a) => ({
      tipo: 'alta_rotacion',
      accion: 'quitar_alta_rotacion',
      titulo: 'Sacar un modelo de alta rotación',
      datos: { id: a.id, motivo: a.motivo || null },
    }),
    solicitar_cambio_a_alef: (a) => ({
      tipo: 'solicitud_alef',
      accion: 'solicitar_a_alef',
      titulo: 'Enviar solicitud al equipo de Alef',
      datos: { resumen: a.resumen, motivo: a.motivo || null },
    }),
  }

  if (PROPUESTAS[nombre]) {
    if (!ctx.puedeEditar) {
      return {
        rechazado: true,
        motivo: 'Esta sesión no tiene permisos para cambiar la configuración del Tasador. Sólo administración puede hacerlo. Explicarle esto al usuario y no insistir.',
      }
    }
    const propuesta = PROPUESTAS[nombre](args)
    propuesta.id = `p${ctx.propuestas.length + 1}`
    ctx.propuestas.push(propuesta)
    return {
      propuesta_registrada: true,
      id: propuesta.id,
      nota: 'La propuesta le aparece al usuario como una tarjeta con un botón de confirmar. TODAVÍA NO se aplicó nada. Confírmale al usuario qué vas a cambiar y pídele que lo confirme con el botón. No digas que ya quedó hecho.',
    }
  }

  /* ───── Datos del Tasador ───── */
  switch (nombre) {
    case 'buscar_comparables_historicos': {
      let q = supabase.from('tradecars_data_historico_compras_ventas')
        .select('placa,marca,modelo,version,anio_fab,km,tipo_vehiculo,transmision,fecha_compra,fecha_venta,valor_compra_usd,precio_venta_usd,margen_bruto_pct,dias_inventario')
        .order('fecha_venta', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      const { data, error } = await q
      if (error) return { error: error.message }

      const filas = (data || []).filter((r: any) => {
        const anio = parseInt(String(r.anio_fab || '').match(/\d{4}/)?.[0] || '0', 10)
        if (args.anio_desde && anio && anio < args.anio_desde) return false
        if (args.anio_hasta && anio && anio > args.anio_hasta) return false
        return true
      })

      return {
        total: filas.length,
        comparables: filas,
        precio_venta_usd: stats(filas.map((r: any) => Number(r.precio_venta_usd))),
        valor_compra_usd: stats(filas.map((r: any) => Number(r.valor_compra_usd))),
        nota: filas.length
          ? 'Precios en USD.'
          : 'No hay comparables cargados para ese modelo. Si la tabla completa está vacía, el Agente Tasador de WhatsApp tampoco puede cotizar — avisarlo.',
      }
    }

    case 'consultar_precio_vehiculo_nuevo': {
      let q = supabase.from('tradecars_data_precios_vehiculos_nuevos')
        .select('marca,modelo,version,anio_modelo,precio_nuevo_usd,moneda,fuente,estado_produccion,fecha_ultimo_precio')
        .eq('activa', true)
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { total: data?.length || 0, precios: data }
    }

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
        if (!a) return true
        if (args.anio_desde && a < args.anio_desde) return false
        if (args.anio_hasta && a > args.anio_hasta) return false
        return true
      })

      return {
        compras_realizadas: stats((compras || []).map((c: any) => Number(c.precio_compra))),
        negociaciones_funnel_concretadas: stats(funnelFiltrado.map((f: any) => Number(f.monto_mejorado))),
        detalle_compras: (compras || []).slice(0, 8),
        detalle_negociaciones: funnelFiltrado.slice(0, 8).map((f: any) => ({
          marca: f.marca_normalizada || f.marca, modelo: f.modelo, anio: f.anio,
          propuesta_inicial: f.monto_propuesta_inicial, monto_final: f.monto_mejorado, fecha: f.fecha_compra,
        })),
        nota: 'Si ambos vienen vacíos, Trade Cars no tiene registros propios de este modelo — decirlo explícitamente antes de dar cualquier referencia general.',
      }
    }

    /* ───── Dashboard ───── */
    case 'resumen_funnel': {
      const ranks = TC_ETAPAS.map((_, i) => i)
      const conteos = await contarPorEtapa(supabase, args, ranks)

      let previa = 0
      const barras = TC_ETAPAS.map((etapa, i) => {
        const cantidad = conteos[i]
        const conversion = i === 0 ? null : (previa > 0 ? Math.round((cantidad / previa) * 1000) / 10 : 0)
        previa = cantidad
        return { etapa, cantidad, conversion_vs_etapa_anterior_pct: conversion }
      })

      let qSin = supabase.from('tradecars_funnel_leads')
        .select('id', { count: 'exact', head: true })
        .lt('etapa_rank', 0)
      qSin = filtrarFunnel(qSin, args)
      const { count: sinEstado } = await qSin

      return {
        filtros_aplicados: { desde: args.desde || null, hasta: args.hasta || null, asesor: args.asesor || null, canal: args.canal || null },
        embudo: barras,
        leads_sin_estado: sinEstado || 0,
        nota: 'El embudo es acumulativo: cada etapa cuenta los leads que la alcanzaron o pasaron de largo. La conversión es contra la etapa anterior. Los leads sin estado quedan fuera del embudo.',
      }
    }

    case 'metricas_por_asesor': {
      const { data: asesores } = await supabase
        .from('tradecars_asesores').select('nombre').eq('activo', true).order('orden')

      const filas = await Promise.all((asesores || []).map(async (a: any) => {
        const base = { desde: args.desde, hasta: args.hasta, asesor: a.nombre }
        // Sólo las etapas que interesan para comparar rendimiento:
        // LEADS (0), CITAS AGENDADAS (4) y COMPRAS (6).
        const [leads, citas, compras] = await contarPorEtapa(supabase, base, [0, 4, 6])

        let qSin = supabase.from('tradecars_funnel_leads')
          .select('id', { count: 'exact', head: true }).lt('etapa_rank', 0)
        qSin = filtrarFunnel(qSin, base)
        const { count: sinEstado } = await qSin

        return {
          asesor: a.nombre,
          leads,
          citas_agendadas: citas,
          compras,
          conversion_lead_a_compra_pct: leads ? Math.round((compras / leads) * 1000) / 10 : 0,
          leads_sin_estado: sinEstado || 0,
        }
      }))

      return {
        filtros_aplicados: { desde: args.desde || null, hasta: args.hasta || null },
        asesores: filas.sort((a, b) => b.compras - a.compras),
        nota: 'leads_sin_estado son leads que ese asesor nunca marcó: no entran en el embudo y ensucian la medición.',
      }
    }

    case 'costos_campanas': {
      // `mes` es un DATE (día 1 del mes) y la inversión vive en `costo`. Se
      // excluye tipo='ventas': el embudo con el que se cruza es el de compras,
      // mismo criterio que el cuadro de costos del módulo Funnel.
      let qCostos = supabase.from('tradecars_campana_costos')
        .select('campana,mes,tipo,costo,moneda')
        .neq('tipo', 'ventas')
        .order('mes', { ascending: false }).limit(500)
      if (args.campana) qCostos = qCostos.ilike('campana', comodin(args.campana)!)
      if (args.desde) qCostos = qCostos.gte('mes', `${String(args.desde).slice(0, 7)}-01`)
      if (args.hasta) qCostos = qCostos.lte('mes', `${String(args.hasta).slice(0, 7)}-31`)
      const { data: costos, error } = await qCostos
      if (error) return { error: error.message }

      if (!costos?.length) {
        return {
          campanas: [],
          nota: 'No hay inversión publicitaria cargada para ese período en tradecars_campana_costos. Sin eso no se puede calcular costo por lead ni inversión por compra — la carga es manual, desde el módulo "Procedencia y Costos" del dashboard.',
        }
      }

      const porCampana: Record<string, { costo: number; moneda: string }> = {}
      for (const c of costos) {
        const k = c.campana
        if (!porCampana[k]) porCampana[k] = { costo: 0, moneda: c.moneda || 'USD' }
        porCampana[k].costo += Number(c.costo || 0)
      }

      const filas = await Promise.all(Object.entries(porCampana).map(async ([campana, agg]) => {
        const base = { desde: args.desde, hasta: args.hasta, campana }
        const [leads, compras] = await contarPorEtapa(supabase, base, [0, 6])
        return {
          campana,
          inversion: Math.round(agg.costo * 100) / 100,
          moneda: agg.moneda,
          leads,
          compras,
          costo_por_lead: leads ? Math.round((agg.costo / leads) * 100) / 100 : null,
          inversion_por_compra: compras ? Math.round((agg.costo / compras) * 100) / 100 : null,
        }
      }))

      return {
        filtros_aplicados: { desde: args.desde || null, hasta: args.hasta || null },
        campanas: filas.sort((a, b) => b.inversion - a.inversion),
        nota: 'La moneda es la que se cargó por campaña: puede haber USD y PEN conviviendo, así que no sumarlas entre sí sin aclararlo.',
      }
    }

    case 'leads_sin_estado': {
      let q = supabase.from('tradecars_funnel_leads')
        .select('contacto_nombre,contacto_telefono,asesor,canal_origen,marca,modelo,status,perfil_coincide,fecha_llegada')
        .lt('etapa_rank', 0)
        .order('fecha_llegada', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.asesor) q = q.eq('asesor', args.asesor)
      const { data, error } = await q
      if (error) return { error: error.message }

      let qCount = supabase.from('tradecars_funnel_leads').select('id', { count: 'exact', head: true }).lt('etapa_rank', 0)
      if (args.asesor) qCount = qCount.eq('asesor', args.asesor)
      const { count } = await qCount

      return {
        total: count || 0,
        muestra: data,
        nota: 'Son leads que el asesor no marcó (sin status o sin definir si el perfil coincide). Quedan fuera del embudo, así que el dashboard los subestima hasta que se completen.',
      }
    }

    case 'buscar_vehiculos_stock': {
      let q = supabase.from('tradecars_vehiculos')
        .select('codigo,marca,modelo,version,anio,kilometraje,transmision,combustible,precio_compra,precio_venta,estado,fecha_ingreso')
        .order('fecha_ingreso', { ascending: false }).limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.estado) q = q.eq('estado', args.estado)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { total: data?.length || 0, vehiculos: data }
    }

    case 'buscar_ventas_historicas': {
      let q = supabase.from('tradecars_ventas')
        .select('marca,modelo,anio,placa,precio_venta,precio_compra,metodo_pago,estado,asesor,fecha_venta')
        .order('fecha_venta', { ascending: false }).limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      if (args.anio_desde) q = q.gte('anio', args.anio_desde)
      if (args.anio_hasta) q = q.lte('anio', args.anio_hasta)
      const { data, error } = await q
      if (error) return { error: error.message }
      return {
        total: data?.length || 0,
        ventas: (data || []).map((v: any) => ({
          ...v,
          margen: v.precio_venta != null && v.precio_compra != null ? Number(v.precio_venta) - Number(v.precio_compra) : null,
        })),
      }
    }

    case 'buscar_negociaciones_funnel': {
      let q = supabase.from('tradecars_funnel_leads')
        .select('marca,marca_normalizada,modelo,anio,status,monto_propuesta_inicial,monto_mejorado,expectativa_cliente,fecha_funnel,fecha_compra')
        .order('fecha_funnel', { ascending: false }).limit(LIMITE_FILAS)
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
        .order('created_at', { ascending: false }).limit(LIMITE_FILAS)
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

/* ══════════════════ Prompt ══════════════════ */

function systemPrompt(puedeEditar: boolean) {
  return `Eres el Tasador IA de Trade Cars Perú, empresa de compra-venta de autos usados en Lima.
Trabajas dentro del dashboard de la empresa y tienes dos funciones.

FUNCIÓN 1 — Responder sobre el negocio.
Tienes acceso de lectura a todo el dashboard: el embudo de compras, los leads y su estado, el
rendimiento de cada asesor, la inversión por campaña y su costo por lead, el stock, las ventas,
las negociaciones del CRM y las solicitudes de la web. Cuando te pregunten por números, consulta
las tools antes de responder. Nunca inventes cifras: si una tool vuelve vacía, dilo.

FUNCIÓN 2 — Enseñarle al Agente Tasador que atiende WhatsApp.
Ese agente cotiza autos a clientes reales leyendo, en cada tasación, la configuración que se
administra desde aquí. Lo que se cambia en esta conversación entra en la siguiente tasación, sin
reinstalar nada. Por eso hay que ser cuidadoso: son los números con los que la empresa decide
cuánto paga por un auto.

  Lo que se puede cambiar desde aquí (propónlo con las tools proponer_*):
    · Los parámetros de tasación: descuentos por kilometraje, cuánto vale un año de antigüedad,
      ajuste por transmisión, márgenes por ticket, penalidad por baja rotación, umbrales, etc.
    · Reglas especiales por marca/modelo: un ajuste en dólares o porcentaje para un auto puntual.
    · Qué modelos son de alta rotación.

  Lo que NO se puede cambiar desde aquí (usa solicitar_cambio_a_alef):
    · Cambiar el orden o la lógica de los pasos del cálculo.
    · Agregar una pregunta nueva a la conversación con el cliente, o cambiar cómo le habla.
    · Cambiar el formato del resultado que devuelve.
    · Crear un parámetro que hoy no existe, o un comportamiento nuevo.
  En estos casos explica con naturalidad que ese cambio lo tiene que implementar el equipo técnico
  de Alef, y deja la solicitud registrada. Nunca prometas que algo se configuró si no se puede.

CÓMO PROPONER UN CAMBIO
1. Consulta ver_configuracion_tasador para saber el valor actual y la clave exacta.
2. Llama a la tool proponer_* correspondiente.
3. Explícale al usuario en una frase qué implica el cambio en la práctica (por ejemplo: "subir el
   descuento por km castiga más a los autos con mucho kilometraje, así que vas a ofrecer menos por
   ellos") y pídele que lo confirme con el botón.
4. NUNCA digas que el cambio ya quedó aplicado. Las propuestas se aplican sólo cuando la persona
   toca confirmar. Después de confirmar, el dashboard le avisa.
${puedeEditar ? '' : '\nIMPORTANTE: esta sesión es de sólo lectura — no tiene permisos para cambiar la configuración.\nPuedes explicar y mostrar todo, pero si piden un cambio, aclárales que lo tiene que hacer alguien de administración.\n'}
ESTILO
Habla siempre en español neutro de Perú (trato de "tú", sin voseo ni jergas ni modismos regionales de
otros países). Sé breve y concreto, como quien le contesta a un supervisor en
medio del día. Cifras con su unidad y su origen ("según 4 compras registradas entre enero y julio").
Los precios de tasación van en dólares, que es la moneda en la que trabaja el Tasador de WhatsApp;
los datos del funnel y las campañas van como estén en el dashboard. Sin relleno ni disculpas.

Hoy es ${new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
}

/* ══════════════════ Handler ══════════════════ */

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const sesion = await verificarSesionTradeCarsEnBase(event, supabase)
  const puedeEditar = puedeEditarTasador(sesion)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OPENAI_API_KEY no configurada en el servidor. Agregar al .env.' })
  }

  const body = await readBody(event)
  if (!body?.messages || !Array.isArray(body.messages) || !body.messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'messages requerido (array no vacío)' })
  }

  const ctx = { propuestas: [] as any[], puedeEditar }
  const toolsUsadas: string[] = []

  const historial: any[] = [
    { role: 'system', content: systemPrompt(puedeEditar) },
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

      const msg = resp?.choices?.[0]?.message
      if (!msg) throw createError({ statusCode: 502, statusMessage: 'Respuesta vacía de OpenAI' })

      const toolCalls = msg.tool_calls
      if (!toolCalls?.length) {
        await logTasador(supabase, 'Tasador · Chat',
          { usuario: sesion.email, pregunta: body.messages.at(-1)?.content?.slice(0, 500), tools: toolsUsadas },
          { propuestas: ctx.propuestas.length, respuesta: (msg.content || '').slice(0, 500) },
          'success')
        return { reply: msg.content || 'No obtuve respuesta.', propuestas: ctx.propuestas }
      }

      historial.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls })

      for (const tc of toolCalls) {
        let args: any = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch { /* args vacíos si viene mal formado */ }
        toolsUsadas.push(tc.function.name)
        const resultado = await ejecutarTool(supabase, tc.function.name, args, ctx)
        historial.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) })
      }
    }

    throw createError({ statusCode: 504, statusMessage: 'El Tasador tardó demasiado consultando datos. Prueba con una pregunta más específica.' })
  } catch (err: any) {
    console.error('[tasador-chat] Error:', err?.data || err?.message || err)
    await logTasador(supabase, 'Tasador · Chat',
      { usuario: sesion.email, tools: toolsUsadas }, null, 'error',
      err?.data?.error?.message || err?.statusMessage || err?.message || 'error desconocido')
    throw createError({
      statusCode: err?.statusCode || 500,
      statusMessage: err?.data?.error?.message || err?.statusMessage || err?.message || 'Error llamando al Tasador',
    })
  }
})
