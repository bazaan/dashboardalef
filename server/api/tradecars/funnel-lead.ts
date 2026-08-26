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
 *   "perfil_coincide": "SI",             // SI | NO
 *   "status": "CITA",                    // uno de los 6 valores cerrados
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
 * Log: agent_tool_logs (company_id='tradecars', tool_name='Funnel Lead')
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getMethod } from 'h3'

const API_KEY = 'tradecars-funnel-2026'

const STATUS_VALIDOS = [
  'NO CONTACTADO', 'NO INTERESADO', 'EN SEGUIMIENTO',
  'CITA', 'CITA ASISTIDA', 'CONCRETADA',
]

/** Devuelve el primer valor no vacío entre varias claves posibles del body. */
function pick(body: any, ...claves: string[]): string {
  for (const k of claves) {
    const v = body?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Normaliza a mayúsculas sin acentos. */
function norm(v: any): string {
  return String(v ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
  const perfilRaw = pick(body, 'perfil_coincide', 'perfilCoincide', 'PERFIL COINCIDE')
  const statusRaw = pick(body, 'status', 'STATUS', 'estado')

  const perfil = perfilRaw ? (norm(perfilRaw) === 'SI' || norm(perfilRaw) === 'YES' || norm(perfilRaw) === 'TRUE' ? 'SI' : 'NO') : null
  const status = statusRaw ? norm(statusRaw) : null
  const statusInvalido = !!status && !STATUS_VALIDOS.includes(status)

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

  // No pisar con null los campos que el CRM no mandó en este envío parcial
  for (const k of Object.keys(fila)) {
    if (fila[k] === null && !(k in body) && !statusInvalido) delete fila[k]
  }

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

  try {
    let guardado: any = null
    let creado = false

    if (conversationId) {
      // Upsert por conversación: el CRM puede reenviar el mismo lead N veces
      const { data: existente } = await (supabase.from('tradecars_funnel_leads') as any)
        .select('id').eq('chatwoot_conversation_id', conversationId).maybeSingle()

      if (existente) {
        const { data, error } = await (supabase.from('tradecars_funnel_leads') as any)
          .update(fila).eq('id', existente.id)
          .select('id, etapa, etapa_rank, fecha_funnel').single()
        if (error) throw error
        guardado = data
      } else {
        const { data, error } = await (supabase.from('tradecars_funnel_leads') as any)
          .insert({ ...fila, chatwoot_conversation_id: conversationId })
          .select('id, etapa, etapa_rank, fecha_funnel').single()
        if (error) throw error
        guardado = data
        creado = true
      }
    } else {
      const { data, error } = await (supabase.from('tradecars_funnel_leads') as any)
        .insert(fila).select('id, etapa, etapa_rank, fecha_funnel').single()
      if (error) throw error
      guardado = data
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
      // Se guardó, pero el dashboard lo va a marcar en rojo hasta que se corrija
      salida.error = 'status_invalido'
      salida.status_recibido = status
      salida.status_validos = STATUS_VALIDOS
      salida.mensaje = 'El lead se guardó pero el STATUS no es uno de los 6 valores permitidos. '
        + 'Aparecerá marcado como error en el dashboard hasta que se corrija.'
      await log('warning', salida)
      console.warn('[tradecars/funnel-lead] STATUS invalido:', status, '| conv', conversationId)
      return salida
    }

    if (!guardado.etapa && guardado.etapa_rank === -1) {
      salida.aviso = 'PERFIL COINCIDE = SI sin STATUS: el lead no entra al funnel hasta que el asesor lo clasifique.'
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
