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
 *  3. GUARDA CORRECCIONES PUNTUALES DE LOS ASESORES (27/09/2026) — cuando un
 *     asesor le dice al chat que se equivocó en un caso concreto, queda guardado
 *     en `tradecars_tasador_correcciones` (tools registrar_correccion_tasacion /
 *     buscar_correcciones_similares) y se consulta antes de la siguiente
 *     tasación parecida. NO pasa por el sistema de propuesta/confirmación:
 *     no es un cambio de configuración general, así que cualquier asesor puede
 *     dejarlo. Ojo: esto alimenta este chat, NO al Agente de WhatsApp — ver el
 *     aviso de alcance en sql/tradecars_tasador_correcciones.sql.
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
const MODEL = process.env.TRADECARS_TASADOR_MODEL || 'gpt-4.1-mini'
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
      name: 'proponer_parametro',
      description:
        'Propone cambiar el valor de uno de los 24 parámetros de tasación. NO lo aplica: deja una ' +
        'propuesta que la persona confirma con un botón. Usar cuando pidan ajustar descuentos, ' +
        'umbrales, márgenes, etc. Consultar antes ver_configuracion_tasador para conocer la clave ' +
        'exacta y el valor actual.',
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
        'Propone crear o eliminar una regla especial por marca/modelo: un ajuste en dólares o ' +
        'porcentaje que se aplica sobre el precio cuando el auto coincide. NO la aplica: deja una ' +
        'propuesta para confirmar. Para "modificar" una regla existente: llamar primero con ' +
        'accion="eliminar" sobre la regla vieja (pedir su id con ver_configuracion_tasador) y después ' +
        'con accion="crear" la nueva — no hay edición en el sitio.',
      parameters: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['crear', 'eliminar'], description: 'Qué hacer con la regla.' },
          id: { type: 'string', description: 'Requerido solo con accion="eliminar": id de la regla (lo devuelve ver_configuracion_tasador).' },
          marca: { type: 'string', description: 'Requerido solo con accion="crear". Marca, o "*" para todas.' },
          modelo: { type: 'string', description: 'Solo con accion="crear". Modelo, o "*" para todos. Default "*".' },
          tipo_ajuste: { type: 'string', enum: ['resta_usd', 'suma_usd', 'resta_pct', 'suma_pct'], description: 'Solo con accion="crear". Cómo mueve el precio.' },
          valor_ajuste: { type: 'number', description: 'Solo con accion="crear". Monto en USD o porcentaje, siempre positivo (el tipo define si suma o resta).' },
          descripcion: { type: 'string', description: 'Solo con accion="crear". Qué hace la regla y por qué, en español claro.' },
          gnv_glp: { type: 'string', enum: ['si', 'no'], description: 'Opcional, solo con accion="crear": aplicar sólo si el auto tiene (o no tiene) GNV/GLP.' },
          anio_min: { type: 'integer', description: 'Opcional, solo con accion="crear": año mínimo de fabricación para que aplique.' },
          anio_max: { type: 'integer', description: 'Opcional, solo con accion="crear": año máximo.' },
          motivo: { type: 'string', description: 'Motivo del supervisor. Queda en el historial.' },
        },
        required: ['accion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_modelo_alta_rotacion',
      description:
        'Propone agregar o retirar un modelo de la lista de alta rotación. En esos modelos el Tasador ' +
        'deja de descontar preventivamente y cotiza en el extremo alto del rango, para asegurar la ' +
        'compra. NO lo aplica: deja una propuesta para confirmar.',
      parameters: {
        type: 'object',
        properties: {
          accion: { type: 'string', enum: ['agregar', 'retirar'], description: 'Qué hacer con el modelo.' },
          id: { type: 'string', description: 'Requerido solo con accion="retirar": id (lo devuelve ver_configuracion_tasador).' },
          marca: { type: 'string', description: 'Requerido solo con accion="agregar".' },
          modelo: { type: 'string', description: 'Requerido solo con accion="agregar".' },
          motivo_rotacion: { type: 'string', description: 'Opcional, solo con accion="agregar": por qué rota rápido.' },
          motivo: { type: 'string' },
        },
        required: ['accion'],
      },
    },
  },

  /* ───── Tasaciones manuales (+120.000 km) y tickets a Alef (29/09/2026) ─────
   * Especificación técnica de Alef AI Solutions del 29/09/2026. Estas 3 tools
   * escriben DIRECTO (a diferencia de las proponer_*, no piden confirmación
   * con botón): son movimientos administrativos de bajo riesgo, no tocan la
   * configuración con la que se cotiza a clientes reales. Solo admin. */
  {
    type: 'function',
    function: {
      name: 'ver_tasaciones_pendientes',
      description:
        'Lista los autos con más de 120.000 km que el Agente Tasador de WhatsApp no pudo cotizar ' +
        'automáticamente y quedaron pendientes de una tasación manual. Solo para administración.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'marcar_tasacion_atendida',
      description:
        'Marca una tasación pendiente manual como atendida, con el precio que se acordó con el ' +
        'cliente. Escribe directo (no pide confirmación con botón). Consultar antes ' +
        'ver_tasaciones_pendientes para saber el id. Solo para administración.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'id de la tasación pendiente (lo devuelve ver_tasaciones_pendientes).' },
          precio_acordado_usd: { type: 'number', description: 'Precio acordado con el cliente, en USD.' },
          notas: { type: 'string', description: 'Notas sobre cómo se llegó a ese precio. Opcional.' },
        },
        required: ['id', 'precio_acordado_usd'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_ticket',
      description:
        'Registra un pedido que supera lo que el Asistente puede hacer por sí solo (cambiar la lógica ' +
        'de cálculo, los prompts o el flujo de conversación del Tasador, crear un comportamiento nuevo). ' +
        'Escribe directo (no pide confirmación con botón) y devuelve un número de ticket (ej: TC-0001) ' +
        'para que lo atienda el equipo técnico de Alef. Solo para administración.',
      parameters: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Qué se pide, con precisión.' },
          motivo: { type: 'string', description: 'Para qué lo necesitan. Opcional.' },
          urgencia: { type: 'string', enum: ['normal', 'alta', 'critica'], description: 'Opcional, default normal.' },
        },
        required: ['descripcion'],
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

  /* ───── Memoria de correcciones (27/09/2026) ───── */
  {
    type: 'function',
    function: {
      name: 'registrar_correccion_tasacion',
      description:
        'Guarda un caso puntual cuando un asesor corrige al Tasador: le dice que el precio de un auto ' +
        'concreto debería ser otro, o que se equivocó por algo específico del auto. NO cambia ningún ' +
        'parámetro general — es un caso de referencia que el Tasador va a consultar la próxima vez que ' +
        'tase un auto parecido. Por eso no requiere confirmación con botón (a diferencia de las tools ' +
        'proponer_*): cualquier asesor puede dejar una corrección, no sólo administración. Usar en cuanto ' +
        'el asesor exprese una corrección, sin esperar a que lo pida explícitamente.',
      parameters: {
        type: 'object',
        properties: {
          marca: { type: 'string' },
          modelo: { type: 'string' },
          anio: { type: 'integer', description: 'Año de fabricación del auto. Opcional.' },
          km: { type: 'integer', description: 'Kilometraje del auto. Opcional.' },
          contexto: { type: 'string', description: 'Detalles del auto que explican la corrección: versión, full equipo, GNV/GLP, estado, etc. Opcional.' },
          precio_tasado_bot: { type: 'number', description: 'Lo que el Tasador había dicho para este auto, si se sabe. Opcional.' },
          precio_correcto: { type: 'number', description: 'Lo que el asesor dice que debería haber sido, en USD.' },
          motivo: { type: 'string', description: 'Por qué, en las palabras del asesor. Es lo que el Tasador va a citar después.' },
        },
        required: ['marca', 'modelo', 'precio_correcto', 'motivo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_correcciones_similares',
      description:
        'Revisa si hay correcciones que un asesor ya dejó antes para una marca/modelo — casos reales ' +
        'donde se corrigió al Tasador. Consultar SIEMPRE junto con buscar_comparables_historicos antes ' +
        'de dar una tasación, y si aparece algo, usarlo como ejemplo concreto citando el motivo.',
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
  ctx: { propuestas: any[]; puedeEditar: boolean; email: string },
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

  /* Prompt v1.0 de Alef (29/09/2026) fusiona en una sola tool lo que antes eran 2
   * (crear/eliminar regla, agregar/retirar alta rotación) y renombra
   * proponer_cambio_parametro -> proponer_parametro. El endpoint de confirmación
   * (tasador-config.post.ts) NO cambió: sigue esperando los mismos `accion`
   * ('actualizar_parametro', 'crear_regla', 'desactivar_regla',
   * 'agregar_alta_rotacion', 'quitar_alta_rotacion') — el nombre de la tool que ve
   * el modelo está desacoplado del `accion` que se manda al confirmar, así que acá
   * sólo hay que producir el mismo `{tipo, accion, datos}` de siempre según el
   * parámetro `accion` ('crear'/'eliminar', 'agregar'/'retirar') que mande el modelo.
   * `solicitar_cambio_a_alef` se retiró: el prompt nuevo no la menciona y redirige
   * todo pedido fuera de alcance a crear_ticket (ver más abajo). El caso
   * 'solicitar_a_alef' de tasador-config.post.ts se deja intacto por si hay que
   * reactivarla — sólo se sacó la tool de cara al modelo. */
  const PROPUESTAS: Record<string, (a: any) => any> = {
    proponer_parametro: (a) => ({
      tipo: 'parametro',
      accion: 'actualizar_parametro',
      titulo: `Cambiar ${a.clave}`,
      datos: { clave: a.clave, valor: a.valor_nuevo, motivo: a.motivo || null },
    }),
    proponer_regla_marca_modelo: (a) => {
      if (a.accion === 'eliminar') {
        return {
          tipo: 'regla',
          accion: 'desactivar_regla',
          titulo: 'Desactivar una regla',
          datos: { id: a.id, motivo: a.motivo || null },
        }
      }
      return {
        tipo: 'regla',
        accion: 'crear_regla',
        titulo: `Nueva regla para ${a.marca}${a.modelo && a.modelo !== '*' ? ' ' + a.modelo : ''}`,
        datos: {
          marca: a.marca, modelo: a.modelo || '*', tipo_ajuste: a.tipo_ajuste,
          valor_ajuste: a.valor_ajuste, descripcion: a.descripcion,
          gnv_glp: a.gnv_glp || null, anio_min: a.anio_min ?? null, anio_max: a.anio_max ?? null,
          motivo: a.motivo || null,
        },
      }
    },
    proponer_modelo_alta_rotacion: (a) => {
      if (a.accion === 'retirar') {
        return {
          tipo: 'alta_rotacion',
          accion: 'quitar_alta_rotacion',
          titulo: 'Sacar un modelo de alta rotación',
          datos: { id: a.id, motivo: a.motivo || null },
        }
      }
      return {
        tipo: 'alta_rotacion',
        accion: 'agregar_alta_rotacion',
        titulo: `Marcar ${a.marca} ${a.modelo} como alta rotación`,
        datos: { marca: a.marca, modelo: a.modelo, motivo_rotacion: a.motivo_rotacion || null, motivo: a.motivo || null },
      }
    },
  }

  if (PROPUESTAS[nombre]) {
    if (!ctx.puedeEditar) {
      return {
        rechazado: true,
        motivo: 'Esta sesión no tiene permisos para cambiar la configuración del Tasador. Sólo administración puede hacerlo. Explicarle esto al usuario y no insistir.',
      }
    }
    // Validación mínima de los pares accion/campos requeridos, ahora que "crear" y
    // "eliminar" (o "agregar"/"retirar") comparten una sola tool.
    if (nombre === 'proponer_regla_marca_modelo') {
      if (args.accion === 'eliminar' && !args.id) return { error: 'Falta el id de la regla a eliminar.' }
      if (args.accion !== 'eliminar' && (!args.marca || !args.tipo_ajuste || !args.valor_ajuste || !args.descripcion)) {
        return { error: 'Para crear una regla faltan datos: marca, tipo_ajuste, valor_ajuste y descripcion son obligatorios.' }
      }
    }
    if (nombre === 'proponer_modelo_alta_rotacion') {
      if (args.accion === 'retirar' && !args.id) return { error: 'Falta el id del modelo a retirar.' }
      if (args.accion !== 'retirar' && (!args.marca || !args.modelo)) {
        return { error: 'Para agregar un modelo a alta rotación faltan datos: marca y modelo son obligatorios.' }
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

  /* ───── Tasaciones manuales (+120.000 km) y tickets a Alef ─────
   * Escriben directo (sin propuesta/confirmación) — igual criterio de riesgo
   * que registrar_correccion_tasacion, pero acá sí restringido a admin porque
   * son movimientos administrativos internos, no algo que cualquier asesor
   * necesite tocar en el día a día. */
  if (nombre === 'ver_tasaciones_pendientes' || nombre === 'marcar_tasacion_atendida' || nombre === 'crear_ticket') {
    if (!ctx.puedeEditar) {
      return {
        rechazado: true,
        motivo: 'Esta sesión no tiene permisos de administración. Solo un administrador puede usar esta función. Explicarle esto al usuario y no insistir.',
      }
    }

    if (nombre === 'ver_tasaciones_pendientes') {
      const { data, error } = await supabase.from('tradecars_tasaciones_pendientes_manual')
        .select('id,marca,modelo,anio,kilometraje,placa,nombre_cliente,telefono,motivo,fecha_ingreso')
        .eq('atendido', false)
        .order('fecha_ingreso', { ascending: false })
        .limit(LIMITE_FILAS)
      if (error) {
        return { error: `No se pudo leer (¿falta correr sql/tradecars_tasaciones_manuales_tickets.sql?): ${error.message}` }
      }
      return {
        total: data?.length || 0,
        pendientes: data,
        nota: data?.length
          ? 'Autos con más de 120.000 km que el Agente Tasador de WhatsApp no cotizó automáticamente y quedaron para revisión manual.'
          : 'No hay tasaciones pendientes de revisión manual en este momento.',
      }
    }

    if (nombre === 'marcar_tasacion_atendida') {
      if (args.id == null || args.precio_acordado_usd == null) {
        return { error: 'Faltan datos: id y precio_acordado_usd son obligatorios.' }
      }
      const { data, error } = await supabase.from('tradecars_tasaciones_pendientes_manual')
        .update({
          atendido: true,
          precio_acordado_usd: args.precio_acordado_usd,
          notas: args.notas ?? null,
          fecha_atencion: new Date().toISOString(),
        })
        .eq('id', args.id)
        .select('id, marca, modelo')
        .maybeSingle()
      // Un UPDATE contra una tabla que no existe devuelve un `error` vacío en supabase-js (sin
      // `.message` ni `.code`) — mismo gotcha ya documentado para tradecars_leads_chatwoot. No
      // interpolar error.message a ciegas, o el mensaje sale literalmente "...: undefined".
      if (error) return { error: `No se pudo guardar (¿falta correr sql/tradecars_tasaciones_manuales_tickets.sql?): ${error.message || 'sin detalle'}` }
      if (!data) return { error: `No se encontró la tasación pendiente #${args.id}.` }
      return {
        actualizado: true,
        id: data.id,
        nota: `Tasación de ${data.marca} ${data.modelo} marcada como atendida con precio acordado de $${args.precio_acordado_usd}.`,
      }
    }

    // crear_ticket
    if (!args.descripcion) return { error: 'Falta la descripción del pedido.' }
    const { data, error } = await supabase.from('tradecars_tickets_cambios_estructurales')
      .insert({
        descripcion: args.descripcion,
        motivo: args.motivo ?? null,
        urgencia: args.urgencia || 'normal',
        solicitado_por: ctx.email,
      })
      .select('id, numero_ticket')
      .single()
    if (error) {
      // Mismo gotcha que en marcar_tasacion_atendida: un INSERT contra tabla faltante devuelve
      // error sin .message en supabase-js.
      return { error: `No se pudo crear el ticket (¿falta correr sql/tradecars_tasaciones_manuales_tickets.sql?): ${error.message || 'sin detalle'}` }
    }
    return {
      ticket_creado: true,
      numero_ticket: data.numero_ticket,
      nota: `Quedó registrado como ${data.numero_ticket}. Lo atiende el equipo técnico de Alef AI Solutions.`,
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

    /* ───── Memoria de correcciones ───── */
    case 'registrar_correccion_tasacion': {
      if (!args.marca || !args.modelo || args.precio_correcto == null || !args.motivo) {
        return { error: 'Faltan datos: marca, modelo, precio_correcto y motivo son obligatorios.' }
      }
      const { data, error } = await supabase.from('tradecars_tasador_correcciones').insert({
        marca: args.marca,
        modelo: args.modelo,
        anio: args.anio ?? null,
        km: args.km ?? null,
        contexto: args.contexto ?? null,
        precio_tasado_bot: args.precio_tasado_bot ?? null,
        precio_correcto: args.precio_correcto,
        motivo: args.motivo,
        registrado_por: ctx.email,
      }).select().single()
      if (error) {
        return { error: `No se pudo guardar (¿falta correr sql/tradecars_tasador_correcciones.sql?): ${error.message}` }
      }
      return {
        correccion_registrada: true,
        id: data.id,
        nota: 'Este caso quedó guardado. La próxima vez que se tase un auto parecido (misma marca/modelo), ' +
          'se va a consultar automáticamente. No cambió ningún parámetro general — si este tipo de corrección ' +
          'se repite varias veces para el mismo modelo, se puede proponer una regla formal con proponer_regla_marca_modelo.',
      }
    }

    case 'buscar_correcciones_similares': {
      let q = supabase.from('tradecars_tasador_correcciones')
        .select('marca,modelo,anio,km,contexto,precio_tasado_bot,precio_correcto,motivo,registrado_por,created_at')
        .order('created_at', { ascending: false })
        .limit(LIMITE_FILAS)
      if (args.marca) q = q.ilike('marca', comodin(args.marca)!)
      if (args.modelo) q = q.ilike('modelo', comodin(args.modelo)!)
      const { data, error } = await q
      if (error) return { error: error.message }

      const filas = (data || []).filter((r: any) => {
        if (args.anio_desde && r.anio && r.anio < args.anio_desde) return false
        if (args.anio_hasta && r.anio && r.anio > args.anio_hasta) return false
        return true
      })

      return {
        total: filas.length,
        correcciones: filas,
        nota: filas.length
          ? 'Casos reales donde un asesor corrigió al Tasador. Úsalos como ejemplo concreto en la respuesta, citando el motivo.'
          : 'No hay correcciones registradas todavía para este modelo.',
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

/**
 * Prompt v1.0 de Alef AI Solutions (29/09/2026, "TradeCars_Prompt_Asistente_Trade_Cars_v1.txt").
 * Texto tal cual lo entregó Alef — no se reescribe acá, sólo se interpolan los 3 placeholders que
 * traía el documento: [FECHA_ACTUAL], [NOMBRE_USUARIO], [ROL_USUARIO] ('administrador' | 'asesor',
 * el único corte de rol que usa el prompt — no hay un tercer valor para sesión de solo lectura
 * porque el propio prompt ya bloquea Funciones 2 y 3 con el rol "asesor").
 */
function systemPrompt(puedeEditar: boolean, nombreUsuario: string) {
  const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const rol = puedeEditar ? 'administrador' : 'asesor'

  return `Eres el Asistente Trade Cars, el asistente conversacional interno de Trade Cars Perú,
empresa de compraventa de autos usados en Lima. Vives dentro del dashboard que usan
los asesores y administradores. Tienes cuatro funciones.

Hoy es ${fecha}.
El usuario conectado es: ${nombreUsuario} | Rol: ${rol}

================================================================================
FUNCIÓN 1 — CONSULTAS SOBRE EL NEGOCIO
================================================================================

Respondes preguntas sobre el estado operativo de Trade Cars: el funnel de compras,
los leads y su etapa, el rendimiento de cada asesor, la inversión en campañas y su
costo por lead, el stock disponible, las ventas completadas, las negociaciones activas
y las solicitudes de la web.

REGLA ABSOLUTA: antes de responder cualquier pregunta con números, llama a la tool
correspondiente. Si la tool devuelve vacío o error, dilo sin inventar cifras.

Herramientas de esta función y cuándo usarlas:

  resumen_funnel
    Usar cuando pregunten por: cuántos leads hay, en qué etapa están, cómo va
    el embudo de compras, qué tan activo está el flujo de leads.

  metricas_por_asesor
    Usar cuando pregunten por: rendimiento de asesores, comparativa entre ellos,
    cuántos leads atendió cada uno, promedios de cierre.

  leads_sin_estado
    Usar cuando pregunten por: leads sin asignar, leads sin seguimiento,
    casos que no tienen etapa definida en el CRM.

  costos_campanas
    Usar cuando pregunten por: inversión en publicidad, cuánto se gastó en tal
    campaña, costo por lead por canal (Meta, TikTok, web, etc.).

  buscar_negociaciones_funnel
    Usar cuando pregunten por: negociaciones activas, propuesta inicial vs.
    monto final ofrecido, leads en etapa de negociación.

  resumen_precio_referencia
    Usar cuando pregunten por: a cuánto se compraron autos recientemente,
    precios pagados en compras cerradas, referencia de precios de mercado propio.

  buscar_vehiculos_stock
    Usar cuando pregunten por: qué autos tiene Trade Cars disponibles hoy,
    inventario actual, si tienen tal marca o modelo en stock.

  buscar_ventas_historicas
    Usar cuando pregunten por: qué se ha vendido, márgenes de venta,
    historial de ventas completadas.

  buscar_solicitudes_venta
    Usar cuando pregunten por: qué pidieron los clientes por sus autos en el
    formulario web, expectativas de precio de los vendedores.

================================================================================
FUNCIÓN 2 — CONFIGURAR EL TASADOR DE WHATSAPP
================================================================================

El Agente Tasador es el bot que cotiza autos a clientes por WhatsApp. Su lógica
de cálculo depende de parámetros y reglas almacenados en tres tablas de Supabase.
Lo que se cambia aquí afecta directamente la siguiente tasación real con un cliente.
Por eso se requiere confirmación explícita antes de aplicar cualquier cambio.

ACCESO: solo disponible para administradores.
Si el rol del usuario es "asesor", bloquear esta función completamente y explicar
que los cambios de configuración los hace un administrador.

---

2.1 VER LA CONFIGURACIÓN ACTUAL
---------------------------------
Llama a ver_configuracion_tasador antes de proponer cualquier cambio.
Así sabes el valor actual de cada parámetro y puedes explicar el delta
real que implica el cambio propuesto.

También puedes llamar a buscar_comparables_historicos y consultar_precio_vehiculo_nuevo
si el usuario quiere entender qué datos maneja el Tasador antes de tasar un auto.

  ver_configuracion_tasador
    Devuelve: los 24 parámetros numéricos, las reglas por marca/modelo y los
    modelos de alta rotación, más conteos de salud de las tablas de datos.

  buscar_comparables_historicos
    Input: marca, modelo y rango de años
    Devuelve: compras y ventas reales de Trade Cars para ese auto, con km,
    precio pagado y precio de venta. Fuente principal para entender el mercado propio.

  consultar_precio_vehiculo_nuevo
    Input: marca, modelo
    Devuelve: precio de referencia del 0km. El Tasador nunca cotiza por encima de este valor.

---

2.2 PROPONER UN CAMBIO DE CONFIGURACIÓN
-----------------------------------------
Flujo obligatorio para cualquier cambio. No hay excepciones.

  PASO 1 — Consultar el valor actual con ver_configuracion_tasador.
  PASO 2 — Llamar a la tool proponer_* correspondiente (proponer_parametro,
            proponer_regla_marca_modelo, o proponer_modelo_alta_rotacion).
  PASO 3 — Explicarle al usuario en una sola frase qué implica ese cambio en
            la práctica. Ejemplos:
            · "Subir el descuento por km va a hacer que ofrezcas menos por autos
               con mucho kilometraje."
            · "Agregar el Kia Stonic a alta rotación va a hacer que el Tasador
               cotice ese modelo en la parte alta del rango para asegurar la compra."
  PASO 4 — Pedirle confirmación explícita al usuario (botón o mensaje de confirmación).
  PASO 5 — Nunca decir que el cambio ya quedó aplicado antes de que el usuario confirme.
            Las propuestas se aplican solo cuando el usuario toca confirmar.
            Después de confirmar, el dashboard le notifica.

Tools de propuesta disponibles:

  proponer_parametro
    Para cambiar cualquiera de los 24 parámetros numéricos de la Tabla 1.
    Ejemplos: descuento_por_10k_km, ajuste_transmision_automatica,
    margen_minimo_pct, umbral_km_alto, amplitud_rango_base_pct.

  proponer_regla_marca_modelo
    Para crear, modificar o eliminar una regla especial para una marca o modelo.
    Ejemplos: "agregar descuento fijo de -8% a todos los Subaru",
    "excluir al Kia Soluto del descuento por antigüedad".

  proponer_modelo_alta_rotacion
    Para agregar o retirar un modelo de la lista de alta rotación.
    Alta rotación = el Tasador cotiza en el techo del rango para asegurar la compra.

---

2.3 QUÉ NO PUEDE HACER ESTA FUNCIÓN (scope externo)
------------------------------------------------------
Los siguientes cambios van más allá de lo que el Asistente puede ejecutar.
Ante cualquiera de estos pedidos → llamar a crear_ticket (ver Función 3.3).

  · Cambiar la lógica de cálculo del Tasador (el orden de los pasos, las fórmulas)
  · Modificar los prompts del Agente Principal o del Agente Tasador de WhatsApp
  · Agregar una pregunta nueva al flujo de conversación con el cliente
  · Cambiar el formato de respuesta del Tasador
  · Crear un parámetro que hoy no existe en la configuración
  · Modificar la estructura de las tablas en Supabase
  · Cambiar flujos en n8n

En estos casos explica con naturalidad que ese cambio lo tiene que implementar
el equipo técnico de Alef AI Solutions, y registra el pedido con crear_ticket.
Nunca prometas que algo se configuró si no se puede configurar desde aquí.

================================================================================
FUNCIÓN 3 — GESTIONAR TASACIONES MANUALES (+120,000 KM)
================================================================================

El Agente Tasador de WhatsApp intercepta autos con más de 120,000 km y los registra
como pendientes en lugar de cotizarlos automáticamente. Esta función te permite
gestionar esa lista y registrar el precio acordado manualmente.

ACCESO: solo disponible para administradores.

---

3.1 VER TASACIONES PENDIENTES
-------------------------------
  ver_tasaciones_pendientes
    Llama a esta tool cuando el usuario pregunte por autos que no pudieron
    tasarse, casos pendientes de revisión manual o leads con alto kilometraje.
    Devuelve: lista de autos con marca, modelo, km, teléfono del cliente y fecha.

---

3.2 MARCAR UNA TASACIÓN COMO ATENDIDA
---------------------------------------
  marcar_tasacion_atendida
    Input: id del registro, precio acordado en dólares, notas opcionales.
    Usar cuando el asesor haya hablado con el cliente y hayan llegado a un precio.
    Registra el precio, las notas y la fecha de atención.
    Siempre pedir confirmación antes de ejecutar — el cambio no se puede revertir.

---

3.3 CREAR TICKET PARA CAMBIOS FUERA DE SCOPE
---------------------------------------------
  crear_ticket
    Input: descripción del cambio, motivo, urgencia (normal / alta / crítica).
    Usar cuando el usuario pida algo que el Asistente no puede ejecutar
    (ver lista en Función 2.3).
    Devuelve: número de ticket generado (formato TC-XXXX) para seguimiento.

================================================================================
FUNCIÓN 4 — APRENDER DE CORRECCIONES PUNTUALES
================================================================================

Cuando un asesor o admin te dice que el Tasador se equivocó en un caso concreto
("ese auto valía más porque tenía full equipo", "el precio estaba mal, debió ser X"),
eso NO es un cambio de parámetro general: es un caso puntual.

ACCESO: disponible para administradores y asesores.

---

4.1 REGISTRAR UNA CORRECCIÓN
------------------------------
Llama a registrar_correccion_tasacion en cuanto detectes que el usuario está
describiendo un error puntual. No esperes a que te lo pidan explícitamente y
no pidas confirmación con botón — las correcciones puntuales las puede dejar
cualquier asesor, no afectan la configuración con la que se cotiza a los clientes.

  registrar_correccion_tasacion
    Input: marca, modelo, año, motivo de la corrección, valor real en USD,
           nombre de quien la registra.
    Después de guardarla, confirma en una frase que quedó registrada y que
    la vas a tener en cuenta la próxima vez que aparezca un auto parecido.

---

4.2 CONSULTAR CORRECCIONES ANTES DE DAR PRECIOS
-------------------------------------------------
REGLA OBLIGATORIA: antes de dar cualquier tasación o precio de referencia,
llama a buscar_correcciones_similares (junto con buscar_comparables_historicos)
para esa marca y modelo. Si hay correcciones guardadas, menciónalas explícitamente
citando el motivo — así el Asistente "aprende" de lo que los asesores le enseñan.

  buscar_correcciones_similares
    Input: marca, modelo.
    Devuelve: lista de correcciones previas registradas para ese auto.

---

4.3 CUÁNDO SUGERIR FORMALIZAR UNA REGLA
-----------------------------------------
Si el mismo tipo de corrección se repite varias veces para un modelo o marca,
menciona el patrón y sugiere formalizarlo como regla con proponer_regla_marca_modelo
(Función 2). Esa sí requiere confirmación del admin, porque ahí ya cambiaría
lo que el Tasador cotiza a todos los clientes en WhatsApp.
Una corrección puntual guardada en esta función NO modifica el comportamiento del bot.

================================================================================
PERMISOS POR ROL — TABLA DE REFERENCIA
================================================================================

  Función 1 (negocio):         admin = SÍ  |  asesor = SÍ
  Función 2 (config Tasador):  admin = SÍ  |  asesor = NO
  Función 3 (manuales):        admin = SÍ  |  asesor = NO
  Función 4 (correcciones):    admin = SÍ  |  asesor = SÍ

Si el rol es "asesor" e intenta acceder a Función 2 o 3:
  Responder: "Esa acción requiere permisos de administrador. Si necesitas
  hacer este cambio, pídele a un admin que lo ejecute desde aquí."

Si la sesión es de solo lectura o el rol no está definido:
  Bloquear Funciones 2 y 3 completamente.
  Puedes mostrar y explicar todo, pero no ejecutar ningún cambio.

================================================================================
CÓMO USAR LAS HERRAMIENTAS — REGLAS GENERALES
================================================================================

1. SIEMPRE consultar antes de responder con números.
   Nunca afirmar una cifra sin llamar primero a la tool correspondiente.
   Si la tool falla o devuelve vacío → decirlo explícitamente.

2. NUNCA decir que un cambio ya quedó aplicado antes de la confirmación del usuario.
   Las propuestas existen en memoria hasta que el usuario confirma.
   El único momento en que un cambio es real es después de la confirmación.

3. Registrar correcciones inmediatamente al detectarlas.
   No preguntar "¿quieres que lo registre?". Registrarlo y luego avisar que quedó guardado.

4. Antes de cualquier precio o tasación → buscar_correcciones_similares.
   Si hay correcciones previas, citarlas con el motivo específico que se registró.

5. Ante pedidos fuera de scope → crear_ticket.
   No prometer que algo se puede configurar si no está en los parámetros disponibles.

================================================================================
ESTILO DE RESPUESTA
================================================================================

· Español neutro de Perú. Trato de "tú", sin voseo ni modismos de otros países.
· Respuestas breves y concretas, como quien le contesta a un supervisor en el trabajo.
· Siempre incluir la fuente de los números: "según X registros entre fecha A y fecha B".
· Los precios de tasación van siempre en dólares (USD), que es la moneda del Tasador.
· Los datos del funnel, campañas y leads van en el formato y moneda que devuelva la tool.
· Sin relleno, sin disculpas, sin repetir la pregunta del usuario antes de responder.
· Si una tool devuelve error o vacío: decirlo en una línea y ofrecer alternativa si la hay.`
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

  // El prompt v1.0 de Alef saluda con el nombre real de la sesión ("El usuario conectado es: ...");
  // verificarSesionTradeCarsEnBase() no trae full_name, así que se pide acá con una consulta chica.
  const { data: perfilNombre } = await supabase
    .from('dashboardlogin').select('full_name').eq('email', sesion.email).maybeSingle()
  const nombreUsuario = perfilNombre?.full_name || sesion.email

  const ctx = { propuestas: [] as any[], puedeEditar, email: sesion.email }
  const toolsUsadas: string[] = []

  const historial: any[] = [
    { role: 'system', content: systemPrompt(puedeEditar, nombreUsuario) },
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
