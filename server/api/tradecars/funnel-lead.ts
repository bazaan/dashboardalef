/**
 * POST /api/tradecars/funnel-lead
 *
 * Sincroniza un lead del CRM (Chatwoot / n8n) hacia el funnel del dashboard.
 * Es el reemplazo del Excel que hoy cada asesor llena a mano para el Power BI:
 * el asesor completa los campos en el perfil de la conversación y el CRM
 * dispara este endpoint, que hace UPSERT sobre tradecars_funnel_leads.
 *
 * Se define sin sufijo de método (funnel-lead.ts) para poder responder también
 * al preflight OPTIONS del navegador (CORS), igual que formulario.ts.
 *
 * ── AUTENTICACIÓN ────────────────────────────────────────────────────────────
 *   Header:  x-api-key: tradecars-funnel-2026
 *   (también se acepta ?api_key=... en la URL o "api_key" dentro del body)
 *
 * ── BODY ─────────────────────────────────────────────────────────────────────
 * {
 *   "conversation_id": 12345,            // clave de deduplicación (recomendado)
 *   "account_id": 17,
 *   "contact_id": 987,
 *   "nombre": "Ana Torres",
 *   "telefono": "51999888777",
 *   "canal": "WhatsApp",                 // WhatsApp | Instagram | TikTok | Facebook
 *   "asesor": "Miguel C.",
 *   "fecha_derivacion": "2026-08-01",
 *
 *   "perfil_coincide": "SI",             // SI | NO  (tambien acepta el ✓ / x del CRM)
 *   "status": "CITA",                    // uno de los 6 valores cerrados (acepta "Concretado")
 *   "informacion_auto": "Toyota Yaris 2019, 45 mil km",   // atributo "informacion del auto"
 *   "transcripcion": "…"                 // opcional: chat, solo para extraer datos del auto al concretar
 *   "fecha_cita": "2026-08-14",
 *   "fecha_compra": null,
 *   "motivo_no_cita": "Precio ofrecido bajo",
 *   "fecha_probable_venta": "2026-09-30",
 *   "proxima_accion": "Llamar para confirmar",
 *   "fecha_seguimiento": "2026-08-12"
 * }
 *
 * Acepta los nombres de campo del CRM tal cual salen del Power BI actual
 * (PERFIL COINCIDE, FECHA DE CITA, ...) además de los snake_case de arriba.
 *
 * ── RESPUESTA ────────────────────────────────────────────────────────────────
 *   200 → { ok: true, id, etapa, fecha_funnel, creado: true|false }
 *   200 → { ok: false, error: "status_invalido", ... }  ← status fuera de la lista
 *   401 → api key inválida
 *   405 → método no permitido
 *
 * El status inválido NO se rechaza con 4xx: se guarda igual y se marca, para que
 * el dashboard lo muestre como error visible (lo pide la minuta) en vez de que
 * el lead desaparezca silenciosamente.
 *
 * REGLAS DE LA REUNIÓN DE ALINEACIÓN (septiembre/2026):
 *  - El CRM manda DOS campos: "coincide" (✓ / x) y "estado" (6 valores). n8n los
 *    traduce a perfil_coincide (SI/NO) + status; aquí se vuelve a normalizar con
 *    utils/tradecarsFunnel.ts (la misma lógica del dashboard) por si llega crudo.
 *  - Con Coincide = NO el estado se BLOQUEA: se guarda vacío.
 *  - Al avanzar a CITA / CITA ASISTIDA / CONCRETADA sin fecha propia, se registra
 *    la fecha de hoy (Lima) como fecha del evento, para que el lead caiga en el
 *    mes correcto del embudo (Chatwoot no manda esas fechas).
 *  - Al llegar a CONCRETADA se crea (una sola vez) la fila en el histórico de
 *    compras para que la verifique el administrador — ver
 *    server/utils/tradecars-compra-crm.ts.
 *
 * Log: agent_tool_logs (company_id='tradecars', tool_name='Funnel Lead')
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getMethod } from 'h3'
import {
  TC_STATUS, tcPerfilValor, tcStatusValido, tcStatusEsInvalido, tcRank, tcNormalizar,
} from '~/utils/tradecarsFunnel'
import { crearCompraDesdeLead } from '~/server/utils/tradecars-compra-crm'

const API_KEY = 'tradecars-funnel-2026'

const STATUS_VALIDOS: string[] = [...TC_STATUS]

/** Devuelve el primer valor no vacío entre varias claves posibles del body. */
function pick(body: any, ...claves: string[]): string {
  for (const k of claves) {
    const v = body?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** YYYY-MM-DD de hoy en hora de Lima (el equipo opera en Perú). */
function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

/** Convierte a 'YYYY-MM-DD' o null. Acepta ISO, DD/MM/YYYY y Date. */
function fecha(v: any): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s || /^(null|undefined|n\/a|-)$/i.test(s)) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3]

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) return dmy[3] + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0')

  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default defineEventHandler(async (event) => {
  // CORS — el CRM puede llamar desde el navegador
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')

  const metodo = getMethod(event)
  if (metodo === 'OPTIONS') return ''
  if (metodo !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido. Usa POST.' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({} as any))
  const q = getQuery(event) as any

  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || q?.api_key || body?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key invalida' })
  }

  // ── Datos automáticos del CRM ──
  const conversationId = Number(pick(body, 'conversation_id', 'conversationId', 'chatwoot_conversation_id')) || null
  const accountId      = Number(pick(body, 'account_id', 'accountId', 'chatwoot_account_id')) || null
  const contactId      = Number(pick(body, 'contact_id', 'contactId', 'chatwoot_contact_id')) || null

  const nombre   = pick(body, 'nombre', 'contacto_nombre', 'name', 'NOMBRE')
  const telefono = pick(body, 'telefono', 'contacto_telefono', 'phone', 'phone_number', 'TELEFONO')
  const canal    = pick(body, 'canal', 'canal_origen', 'channel', 'CANAL DE ORIGEN')
  const asesor   = pick(body, 'asesor', 'asesor_asignado', 'agent', 'ASESOR')

  // ── Campos que llena el asesor ──
  const perfilRaw = pick(body, 'perfil_coincide', 'perfilCoincide', 'PERFIL COINCIDE', 'coincide')
  const statusRaw = pick(body, 'status', 'STATUS', 'estado')

  // Coincide en TRES estados con la misma normalización del dashboard
  // (utils/tradecarsFunnel.ts): acepta ✓ / x del CRM. Un texto que no se reconoce
  // es "sin calificar" (null) — NO se asume "NO": antes cualquier cosa distinta de
  // SI se guardaba como NO y eso inflaba la métrica de perfiles que no coinciden.
  const perfilValor = tcPerfilValor(perfilRaw)
  const perfil = perfilValor || null

  // Estado canónico ("Concretado" del CRM -> "CONCRETADA"). Con Coincide = NO el
  // estado se BLOQUEA: se guarda vacío aunque llegue uno (regla de la reunión).
  const statusBloqueado = perfilValor === 'NO' && !!statusRaw
  const statusInvalido = !statusBloqueado && tcStatusEsInvalido(statusRaw)
  const status: string | null = perfilValor === 'NO'
    ? null
    : (tcStatusValido(statusRaw) || (statusInvalido ? tcNormalizar(statusRaw) : null))

  const fila: Record<string, any> = {
    contacto_nombre:      nombre || null,
    contacto_telefono:    telefono || null,
    canal_origen:         canal || null,
    asesor:               asesor || null,
    fecha_derivacion:     fecha(pick(body, 'fecha_derivacion', 'fechaDerivacion', 'FECHA DE DERIVACION')),

    chatwoot_account_id:      accountId,
    chatwoot_conversation_id: conversationId,
    chatwoot_contact_id:      contactId,

    lead_origen_tabla: pick(body, 'lead_origen_tabla') || null,
    lead_origen_id:    Number(pick(body, 'lead_origen_id')) || null,

    perfil_coincide:      perfil,
    status:               status,
    fecha_cita:           fecha(pick(body, 'fecha_cita', 'fechaCita', 'FECHA DE CITA')),
    fecha_cita_asistida:  fecha(pick(body, 'fecha_cita_asistida', 'fechaCitaAsistida', 'FECHA DE CITA ASISTIDA')),
    fecha_compra:         fecha(pick(body, 'fecha_compra', 'fechaCompra', 'FECHA DE COMPRA')),
    motivo_no_cita:       pick(body, 'motivo_no_cita', 'motivoNoCita', 'MOTIVO DE NO CITA') || null,
    fecha_probable_venta: fecha(pick(body, 'fecha_probable_venta', 'fechaProbableVenta', 'FECHA PROBABLE DE VENTA')),
    proxima_accion:       pick(body, 'proxima_accion', 'proximaAccion', 'PROXIMA ACCION') || null,
    fecha_seguimiento:    fecha(pick(body, 'fecha_seguimiento', 'fechaSeguimiento', 'FECHA DE SEGUIMIENTO')),
    observaciones:        pick(body, 'observaciones', 'notas') || null,
    informacion_auto:     pick(body, 'informacion_auto', 'informacion_del_auto', 'info_auto') || null,

    // ── Campos del Excel del asesor (no entran al cálculo del funnel) ──
    placa:        pick(body, 'placa', 'PLACA') || null,
    marca:        pick(body, 'marca', 'MARCA') || null,
    modelo:       pick(body, 'modelo', 'MODELO') || null,
    version:      pick(body, 'version', 'VERSION', 'VERSIÓN') || null,
    anio:         pick(body, 'anio', 'año', 'AÑO') || null,
    kilometraje:  Number(pick(body, 'kilometraje', 'km', 'KM')) || null,

    monto_propuesta_inicial: Number(pick(body, 'monto_propuesta_inicial', 'MONTO PROPUESTA INICIAL')) || null,
    monto_mejorado:          Number(pick(body, 'monto_mejorado', 'MONTO MEJORADO')) || null,
    expectativa_cliente:     Number(pick(body, 'expectativa_cliente', 'EXPECTATIVA CLIENTE')) || null,

    campana:   pick(body, 'campana', 'campaña', 'CAMPAÑA') || null,
    distrito:  pick(body, 'distrito', 'DISTRITO') || null,
    // La zona se acepta por compatibilidad con el Excel, pero si el distrito
    // está en tradecars_zonificacion el trigger de la BD la pisa: el catálogo
    // es la fuente de verdad. Lo mismo con la prioridad de la marca.
    zona:      pick(body, 'zona', 'ZONAS', 'ZONA') || null,
    marca_prioridad: Number(pick(body, 'marca_prioridad', 'MARCA // PRIORIDAD', 'prioridad')) || null,
    correo:    pick(body, 'correo', 'email', 'CORREO') || null,

    tiene_deuda: pick(body, 'tiene_deuda', 'deuda', '¿DEUDA?') || null,
    banco:       pick(body, 'banco', 'BANCO') || null,

    fecha_llegada:         fecha(pick(body, 'fecha_llegada', 'FECHA DE LLEGADA')),
    fecha_ultimo_contacto: fecha(pick(body, 'fecha_ultimo_contacto', 'FECHA ÚLTIMO CONTACTO')),
    num_contactos:         Number(pick(body, 'num_contactos', '# DE CONTACTOS')) || null,
    feedback:              pick(body, 'feedback', 'FEEDBACK') || null,
  }

  // Un envío del CRM nunca borra lo que ya está guardado: los campos vacíos se descartan.
  // Antes se descartaban solo si la clave no venía en el body, y n8n manda todas las claves
  // (con null cuando el atributo está vacío), así que cada evento de Chatwoot pisaba con null
  // las fechas de cita/compra y lo que el asesor había editado en el dashboard.
  // Únicas excepciones: `status` y `perfil_coincide`, que SÍ pueden quedar vacíos a propósito
  // (Coincide = NO bloquea el estado; un CRM puede mandar Coincide vacío = sin calificar).
  for (const k of Object.keys(fila)) {
    if (fila[k] !== null) continue
    const limpiable =
      (k === 'perfil_coincide' && k in body) ||
      (k === 'status' && (k in body || perfilValor === 'NO'))
    if (!limpiable) delete fila[k]
  }
  // Como consecuencia, informacion_auto solo viaja cuando trae contenido: un envío sin ese
  // dato no borra el que ya estaba, y no exige que la migración v2 (que crea la columna)
  // ya se haya corrido mientras el asesor no haya llenado nada.

  const log = async (status_log: string, output: any, error?: string) => {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'tradecars', tool_name: 'Funnel Lead',
        input_data: {
          conversation_id: conversationId, nombre, asesor, canal,
          perfil_coincide: perfil, status,
        },
        output_data: output, status: status_log, error_message: error ?? null,
      })
    } catch { /* el log nunca debe tumbar la sincronización */ }
  }

  // Fechas del evento: Chatwoot NO manda fecha de cita ni de compra (no existen esos
  // atributos), así que al AVANZAR de etapa se registra la de hoy (Lima) cuando el
  // lead todavía no la tiene. Sin esto todos los leads caerían en el mes de su
  // derivación y no en el mes en que realmente pasó la cita o la compra.
  const estamparFechas = (previo: any | null) => {
    const rankNuevo = tcRank({ perfil_coincide: perfil, status })
    const rankPrevio = previo ? Number(previo.etapa_rank ?? 0) : -1   // -1 = lead nuevo
    if (rankNuevo <= rankPrevio) return   // no avanza (si retrocede, lo frena el trigger de la BD)
    const hoy = hoyLima()
    if (rankNuevo >= 4 && !fila.fecha_cita && !previo?.fecha_cita) fila.fecha_cita = hoy
    if (rankNuevo >= 5 && !fila.fecha_cita_asistida && !previo?.fecha_cita_asistida) fila.fecha_cita_asistida = hoy
    if (rankNuevo >= 6 && !fila.fecha_compra && !previo?.fecha_compra) fila.fecha_compra = hoy
  }

  // Escribe el lead. Si la migración v2 todavía no se corrió, la columna informacion_auto
  // no existe: se reintenta una vez sin ella para no perder la sincronización del funnel.
  const escribir = async (armar: (f: Record<string, any>) => any) => {
    let res = await armar(fila)
    if (res.error && 'informacion_auto' in fila && /informacion_auto/i.test(res.error.message || '')) {
      const { informacion_auto: _omitida, ...sinInfo } = fila
      res = await armar(sinInfo)
    }
    if (res.error) throw res.error
    return res.data
  }

  try {
    let guardado: any = null
    let creado = false

    if (conversationId) {
      // Upsert por conversación: el CRM puede reenviar el mismo lead N veces
      const { data: existente } = await (supabase.from('tradecars_funnel_leads') as any)
        .select('id, etapa_rank, fecha_cita, fecha_cita_asistida, fecha_compra')
        .eq('chatwoot_conversation_id', conversationId).maybeSingle()

      estamparFechas(existente)

      if (existente) {
        guardado = await escribir((f) =>
          (supabase.from('tradecars_funnel_leads') as any)
            .update(f).eq('id', existente.id).select('*').single())
      } else {
        guardado = await escribir((f) =>
          (supabase.from('tradecars_funnel_leads') as any)
            .insert({ ...f, chatwoot_conversation_id: conversationId }).select('*').single())
        creado = true
      }
    } else {
      estamparFechas(null)
      guardado = await escribir((f) =>
        (supabase.from('tradecars_funnel_leads') as any).insert(f).select('*').single())
      creado = true
    }

    const salida: Record<string, any> = {
      ok: !statusInvalido,
      id: guardado.id,
      etapa: guardado.etapa,
      fecha_funnel: guardado.fecha_funnel,
      creado,
    }

    if (statusInvalido) {
      // Se guardó (cuenta solo como LEAD), pero el dashboard lo va a marcar en rojo hasta que se corrija
      salida.error = 'status_invalido'
      salida.status_recibido = status
      salida.status_validos = STATUS_VALIDOS
      salida.mensaje = 'El lead se guardó pero el STATUS no es uno de los 6 valores permitidos. '
        + 'No avanza en el embudo (queda en LEADS / CUMPLE POLITICA) y aparecerá marcado como error en el dashboard hasta que se corrija.'
      await log('warning', salida)
      console.warn('[tradecars/funnel-lead] STATUS invalido:', status, '| conv', conversationId)
      return salida
    }

    if (statusBloqueado) {
      salida.aviso = 'Coincide = NO: el estado se bloquea (se guardó vacío). El lead se queda en LEADS.'
    } else if (perfil === 'SI' && !guardado.status) {
      salida.aviso = 'Coincide = SI sin estado: cuenta como CUMPLE POLITICA hasta que el asesor le ponga un estado.'
    }

    // Compra concretada -> histórico de compras (una sola vez por lead: la función es
    // idempotente por crm_lead_id, así que llamarla en cada evento es seguro). Se decide
    // con lo que quedó REALMENTE en la BD, no con lo que llegó (el trigger anti-regresión
    // puede haber conservado un estado más avanzado).
    if (guardado.etapa_rank === 6) {
      try {
        const compra = await crearCompraDesdeLead(supabase, guardado, {
          transcripcion: pick(body, 'transcripcion', 'chat_transcripcion'),
        })
        if (compra) salida.compra = compra
      } catch (e: any) {
        // Nunca debe tumbar la sincronización del funnel
        salida.compra = { ok: false, error: e?.message ?? String(e) }
        console.error('[tradecars/funnel-lead] compra automática falló:', e?.message)
      }
    }

    await log('success', salida)
    console.log(`[tradecars/funnel-lead] ${creado ? 'creado' : 'actualizado'} ${guardado.id} | ${guardado.etapa ?? 'sin etapa'} | ${asesor || '-'}`)
    return salida

  } catch (e: any) {
    const r = { ok: false, error: e?.message ?? 'error guardando el lead' }
    await log('error', r, e?.message)
    console.error('[tradecars/funnel-lead] ERROR:', e?.message)
    throw createError({ statusCode: 500, statusMessage: `Error guardando el lead: ${e?.message}` })
  }
})
