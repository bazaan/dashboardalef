/**
 * Lógica compartida del resumen diario de CITAS DEL DÍA SIGUIENTE para Healup.
 *
 * A diferencia de `healup-agendamientos.ts` (que envía los pacientes *creados* hoy),
 * esta herramienta:
 *   1. Toma TODAS las citas cuya FECHA DE AGENDAMIENTO es MAÑANA (día Lima + 1).
 *   2. Lee dos fuentes y las une:
 *        - Dashboard: tabla `healup_calendar_events`
 *        - Google Calendar: API directa (mismo service account que usa /gcal-events)
 *   3. Deduplica: dos citas son la MISMA persona si comparten DNI o teléfono, o si su
 *      nombre normalizado coincide. Cuando se fusionan, se conserva el nombre MÁS LARGO
 *      y se rellenan los campos faltantes (DNI, teléfono, procedimiento) desde la otra fuente.
 *   4. Formatea fecha + hora en formato amigable (ej: "27/05/26 2:00pm").
 *   5. POSTea el JSON (incluye un `mensaje_whatsapp` ya armado) al webhook n8n
 *      `N8N_WEBHOOK_HEALUP_CITAS_MANANA`.
 *   6. Guarda un log completo en `healup_citas_manana_logs`.
 *
 * Usada por:
 *   GET  /api/healup/cron-citas-manana       (Netlify Scheduled Function — 19:00 Lima)
 *   POST /api/healup/citas-manana-trigger    (disparo manual desde la UI)
 */

import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'

const LIMA_OFFSET_HOURS = -5  // Lima es UTC-5 todo el año (no DST)
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export interface CitasMananaResult {
  fecha_objetivo: string          // YYYY-MM-DD del día siguiente (Lima)
  fecha_objetivo_friendly: string // DD/MM/YY
  status: 'success' | 'error' | 'empty'
  citas_count: number
  citas_dashboard_count: number
  citas_gcal_count: number
  duplicados_fusionados: number
  http_status: number | null
  error_message: string | null
  duracion_ms: number
  log_id: number | null
  webhook_configurado: boolean
}

interface CitaNormalizada {
  fecha: string           // YYYY-MM-DD
  hora: string            // HH:MM (24h)
  nombre_completo: string
  dni: string
  telefono: string
  procedimiento: string
  cabina: string
  fuentes: string[]       // ['dashboard'] | ['google_calendar'] | ambos
  _name_key: string       // nombre normalizado (para dedup)
}

/** Devuelve la fecha Lima de MAÑANA (YYYY-MM-DD) + ventana del día en ISO con offset. */
export function getLimaTomorrowWindow() {
  const nowUtc = new Date()
  const limaMs = nowUtc.getTime() + LIMA_OFFSET_HOURS * 3600 * 1000
  const limaTomorrow = new Date(limaMs + 24 * 3600 * 1000)
  const yyyy = limaTomorrow.getUTCFullYear()
  const mm = String(limaTomorrow.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(limaTomorrow.getUTCDate()).padStart(2, '0')
  const fechaObjetivo = `${yyyy}-${mm}-${dd}`
  // Rango del día completo en hora local Perú (UTC-5), para la query de Google Calendar.
  const timeMin = `${fechaObjetivo}T00:00:00-05:00`
  const timeMax = `${fechaObjetivo}T23:59:59-05:00`
  return { fechaObjetivo, timeMin, timeMax }
}

/* ─── Helpers de normalización ───────────────────────────────────── */

/** Quita acentos, baja a minúsculas, colapsa espacios. */
function normalizeName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Deja solo dígitos y quita el prefijo 51 de números de 11 dígitos. */
function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('51')) return digits.substring(2)
  return digits
}

function onlyDigits(s: string): string {
  return String(s || '').replace(/\D/g, '')
}

/** "DD-MM-YYYY" → "YYYY-MM-DD". Si ya viene ISO, lo deja igual. */
function toISODate(raw: string): string {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s
}

/** Extrae HH:MM (24h) de un ISO con timezone o de una hora suelta "14:00:00". */
function extractTime(isoOrTime: string): string {
  if (!isoOrTime) return ''
  // Hora suelta tipo "14:00" / "14:00:00" / "9:00:00"
  if (!isoOrTime.includes('T')) {
    const m = isoOrTime.match(/^(\d{1,2}):(\d{2})/)
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  }
  try {
    // El ISO de GCal trae offset; convertimos a hora Lima para mostrar la hora real de la cita.
    const d = new Date(isoOrTime)
    if (isNaN(d.getTime())) return ''
    const lima = new Date(d.getTime() + LIMA_OFFSET_HOURS * 3600 * 1000)
    const hh = String(lima.getUTCHours()).padStart(2, '0')
    const mm = String(lima.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return ''
  }
}

/** "YYYY-MM-DD" + "HH:MM" (24h) → "27/05/26 2:00pm". */
export function formatFriendly(fechaISO: string, horaHHMM: string): string {
  const [y, m, d] = (fechaISO || '').split('-')
  const yy = (y || '').slice(-2)
  const fecha = (d && m && yy) ? `${d}/${m}/${yy}` : fechaISO
  if (!horaHHMM) return fecha
  let [hStr, minStr] = horaHHMM.split(':')
  let h = parseInt(hStr, 10)
  const min = (minStr || '00').padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return `${fecha} ${h}:${min}${ampm}`
}

/* ─── Parsers de Google Calendar (replicados de gcal-events) ─────── */

function parseGCalSummary(summary: string) {
  const result = { nombre: '', apellido: '', phone: '', dni: '', procedure: '' }
  if (!summary) return result
  const lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return result

  for (const line of lines) {
    const dniMatch = line.match(/\bDni\s*:?\s*(\d{7,8})/i)
    if (dniMatch && !result.dni) result.dni = dniMatch[1]
    const celMatch = line.match(/\bCel(?:ular)?\s*:?\s*(\d{9,11})/i)
    if (celMatch && !result.phone) result.phone = celMatch[1]
  }

  let firstLine = lines[0]
  const dashParts = firstLine.split(/\s+-\s+/)
  if (dashParts.length >= 2) {
    firstLine = dashParts[0].trim()
    for (let i = 1; i < dashParts.length; i++) {
      const val = dashParts[i].replace(/\D/g, '')
      if (val.length === 7 || val.length === 8) { if (!result.dni) result.dni = val }
      else if (val.length >= 9) { if (!result.phone) result.phone = val }
    }
  }

  firstLine = firstLine.replace(/\bDni\s*:?\s*\d+/i, '').replace(/\bCel(?:ular)?\s*:?\s*\d+/i, '').trim()
  const nameParts = firstLine.split(/\s+/).filter(Boolean)
  result.nombre = nameParts[0] || ''
  result.apellido = nameParts.slice(1).join(' ') || ''

  const procLines = lines.slice(1).filter(l =>
    !/\bDni\b/i.test(l) && !/\bCel(?:ular)?\b/i.test(l) && !/^\d+$/.test(l)
  )
  result.procedure = procLines.join(' ').trim()
  return result
}

function parseGCalDescription(desc: string) {
  const result = { nombre: '', apellido: '', phone: '', dni: '' }
  if (!desc) return result
  const nombreMatch = desc.match(/Nombre\s*(?:Completo)?\s*[:\s]+([^\n]+)/i)
  if (nombreMatch) {
    const parts = nombreMatch[1].trim().split(/\s+/)
    result.nombre = parts[0] || ''
    result.apellido = parts.slice(1).join(' ') || ''
  }
  const phoneMatch = desc.match(/(?:Número|Telefono|Teléfono|Phone|Celular)\s*[:\s]+([^\n]+)/i)
  if (phoneMatch) result.phone = phoneMatch[1].trim().replace(/\D/g, '')
  const dniMatch = desc.match(/DNI\s*[:\s]+([^\n]+)/i)
  if (dniMatch) result.dni = dniMatch[1].trim().replace(/\D/g, '')
  return result
}

/* ─── Fetch de cada fuente ───────────────────────────────────────── */

async function fetchDashboardCitas(event: H3Event, fechaObjetivo: string): Promise<CitaNormalizada[]> {
  const supabase = serverSupabaseServiceRole(event)
  const ddmmyyyy = (() => { const [y, m, d] = fechaObjetivo.split('-'); return `${d}-${m}-${y}` })()

  // Las fechas del calendario pueden estar como YYYY-MM-DD (manual) o DD-MM-YYYY (agente IA).
  const { data, error } = await supabase
    .from('healup_calendar_events')
    .select('id, date, time, client_name, client_surname, client_phone, client_dni, subject, cabina, procedure_id')
    .or(`date.eq.${fechaObjetivo},date.eq.${ddmmyyyy}`)

  if (error) throw new Error(`Supabase healup_calendar_events: ${error.message}`)

  // Catálogo para resolver el nombre del procedimiento a partir de procedure_id.
  const { data: procs } = await supabase.from('healup_procedures').select('id, name')
  const catalogo = procs || []

  return (data || []).map((e: any) => {
    const proc = e.procedure_id
      ? catalogo.find((p: any) => Number(p.id) === Number(e.procedure_id))
      : null
    const nombre = `${e.client_name || ''} ${e.client_surname || ''}`.replace(/\bnull\b/gi, '').trim()
    return {
      fecha: fechaObjetivo,
      hora: extractTime(e.time || ''),
      nombre_completo: nombre,
      dni: onlyDigits(e.client_dni || ''),
      telefono: normalizePhone(e.client_phone || ''),
      procedimiento: proc?.name || e.subject || '',
      cabina: e.cabina || '',
      fuentes: ['dashboard'],
      _name_key: normalizeName(nombre)
    } as CitaNormalizada
  })
}

async function fetchGCalCitas(timeMin: string, timeMax: string, fechaObjetivo: string): Promise<CitaNormalizada[]> {
  const accessToken = await getGoogleAccessToken()
  const calendarId = encodeURIComponent(
    process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'
  )
  const url = `${CALENDAR_API}/calendars/${calendarId}/events?` + new URLSearchParams({
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250'
  })

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Calendar API ${res.status}: ${errText.substring(0, 200)}`)
  }

  const data = await res.json() as { items?: any[] }
  const items = (data.items || []).filter((e: any) => e.status !== 'cancelled')

  return items.map((gcal: any) => {
    const startDt = gcal.start?.dateTime || gcal.start?.date || ''
    const desc = parseGCalDescription(gcal.description || '')
    const summ = parseGCalSummary(gcal.summary || '')
    const nombre = `${desc.nombre || summ.nombre || ''} ${desc.apellido || summ.apellido || ''}`.trim()
    return {
      fecha: fechaObjetivo,
      hora: extractTime(startDt),
      nombre_completo: nombre || (gcal.summary || '').trim(),
      dni: onlyDigits(desc.dni || summ.dni || ''),
      telefono: normalizePhone(desc.phone || summ.phone || ''),
      procedimiento: summ.procedure || '',
      cabina: '',
      fuentes: ['google_calendar'],
      _name_key: normalizeName(nombre || gcal.summary || '')
    } as CitaNormalizada
  })
}

/* ─── Dedup / merge ──────────────────────────────────────────────── */

/**
 * Dos citas son la MISMA cita (duplicado a fusionar) cuando ocurren en la misma
 * franja (misma fecha + misma hora) Y se trata de la misma persona:
 *   - mismo DNI, o
 *   - mismo teléfono, o
 *   - mismo nombre normalizado.
 * (Citas de la misma persona a horas distintas NO se fusionan: son citas reales distintas.)
 */
function esMismaCita(a: CitaNormalizada, b: CitaNormalizada): boolean {
  if (a.hora !== b.hora) return false
  if (a.dni && b.dni && a.dni === b.dni) return true
  if (a.telefono && b.telefono && a.telefono === b.telefono) return true
  if (a._name_key && b._name_key && a._name_key === b._name_key) return true
  return false
}

function mergeInto(base: CitaNormalizada, extra: CitaNormalizada): CitaNormalizada {
  // Nombre: gana el más largo (más completo).
  const nombre_completo =
    extra.nombre_completo.length > base.nombre_completo.length
      ? extra.nombre_completo
      : base.nombre_completo
  return {
    fecha: base.fecha,
    hora: base.hora,
    nombre_completo,
    dni: base.dni || extra.dni,
    telefono: base.telefono || extra.telefono,
    procedimiento: base.procedimiento || extra.procedimiento,
    cabina: base.cabina || extra.cabina,
    fuentes: Array.from(new Set([...base.fuentes, ...extra.fuentes])),
    _name_key: normalizeName(nombre_completo)
  }
}

function dedupCitas(citas: CitaNormalizada[]): { merged: CitaNormalizada[]; duplicados: number } {
  const merged: CitaNormalizada[] = []
  let duplicados = 0
  for (const c of citas) {
    const idx = merged.findIndex(m => esMismaCita(m, c))
    if (idx >= 0) {
      merged[idx] = mergeInto(merged[idx], c)
      duplicados++
    } else {
      merged.push({ ...c })
    }
  }
  merged.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
  return { merged, duplicados }
}

/* ─── Mensaje WhatsApp armado ────────────────────────────────────── */

function construirMensaje(fechaFriendly: string, citas: CitaNormalizada[]): string {
  if (citas.length === 0) {
    return `📅 *Citas de mañana (${fechaFriendly})*\n\nNo hay citas agendadas para mañana. 🎉`
  }
  const header = `📅 *Citas de mañana (${fechaFriendly})*\nTotal: ${citas.length} cita(s)\n`
  const bloques = citas.map((c, i) => {
    const lineas = [
      `*${i + 1}. ${c.nombre_completo || 'Sin nombre'}*`,
      `🕐 ${formatFriendly(c.fecha, c.hora)}`
    ]
    if (c.procedimiento) lineas.push(`💉 ${c.procedimiento}`)
    const ident: string[] = []
    if (c.telefono) ident.push(`📞 ${c.telefono}`)
    if (c.dni) ident.push(`🪪 DNI ${c.dni}`)
    if (ident.length) lineas.push(ident.join('  ·  '))
    return lineas.join('\n')
  })
  return [header, ...bloques].join('\n\n')
}

/* ─── Ejecución principal ────────────────────────────────────────── */

export async function ejecutarEnvioCitasManana(
  event: H3Event,
  opts: { origen: 'cron' | 'manual'; triggered_by_email?: string | null }
): Promise<CitasMananaResult> {
  const inicio = Date.now()
  const supabase = serverSupabaseServiceRole(event)
  const { fechaObjetivo, timeMin, timeMax } = getLimaTomorrowWindow()
  const fechaFriendly = (() => { const [y, m, d] = fechaObjetivo.split('-'); return `${d}/${m}/${y.slice(-2)}` })()

  // ── 1. Traer ambas fuentes (en paralelo, tolerante a fallos por fuente) ──
  let dashboardCitas: CitaNormalizada[] = []
  let gcalCitas: CitaNormalizada[] = []
  const fuenteErrors: Record<string, string> = {}

  const [dashRes, gcalRes] = await Promise.allSettled([
    fetchDashboardCitas(event, fechaObjetivo),
    fetchGCalCitas(timeMin, timeMax, fechaObjetivo)
  ])
  if (dashRes.status === 'fulfilled') dashboardCitas = dashRes.value
  else fuenteErrors.dashboard = dashRes.reason?.message || String(dashRes.reason)
  if (gcalRes.status === 'fulfilled') gcalCitas = gcalRes.value
  else fuenteErrors.google_calendar = gcalRes.reason?.message || String(gcalRes.reason)

  // ── 2. Unir + deduplicar ──
  const { merged, duplicados } = dedupCitas([...dashboardCitas, ...gcalCitas])
  const totalCount = merged.length

  // ── 3. Armar citas con formato amigable ──
  const citasPayload = merged.map(c => ({
    fecha: c.fecha,
    hora: c.hora,
    fecha_hora_friendly: formatFriendly(c.fecha, c.hora),
    nombre_completo: c.nombre_completo,
    dni: c.dni || null,
    telefono: c.telefono || null,
    procedimiento: c.procedimiento || null,
    cabina: c.cabina || null,
    fuentes: c.fuentes
  }))

  const mensajeWhatsapp = construirMensaje(fechaFriendly, merged)

  // ── 4. Payload para n8n ──
  const payload: any = {
    evento: 'healup.citas_dia_siguiente',
    empresa: 'Healup',
    fecha_objetivo: fechaObjetivo,
    fecha_objetivo_friendly: fechaFriendly,
    enviado_at_utc: new Date().toISOString(),
    enviado_at_lima: new Date(Date.now() + LIMA_OFFSET_HOURS * 3600 * 1000)
      .toISOString().replace('Z', '-05:00'),
    origen: opts.origen,
    resumen: {
      total_citas: totalCount,
      desde_dashboard: dashboardCitas.length,
      desde_google_calendar: gcalCitas.length,
      duplicados_fusionados: duplicados,
      errores_por_fuente: Object.keys(fuenteErrors).length ? fuenteErrors : null
    },
    mensaje_whatsapp: mensajeWhatsapp,
    citas: citasPayload
  }

  const webhookUrl = process.env.N8N_WEBHOOK_HEALUP_CITAS_MANANA || null

  let status: 'success' | 'error' | 'empty' = totalCount === 0 ? 'empty' : 'success'
  let respuestaN8n: any = null
  let httpStatus: number | null = null
  let errorMessage: string | null = null

  if (!webhookUrl) {
    status = 'error'
    errorMessage = 'N8N_WEBHOOK_HEALUP_CITAS_MANANA no está configurado en el .env del servidor'
  } else {
    try {
      const respN8n = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      httpStatus = respN8n.status
      const textBody = await respN8n.text()
      let parsed: any = textBody
      try { parsed = JSON.parse(textBody) } catch { /* keep as text */ }
      respuestaN8n = parsed
      if (!respN8n.ok) {
        status = 'error'
        errorMessage = `HTTP ${respN8n.status} ${respN8n.statusText}`
      }
    } catch (e: any) {
      status = 'error'
      errorMessage = e?.message || String(e)
      console.error('[healup-citas-manana] Error enviando a n8n:', errorMessage)
    }
  }

  const duracionMs = Date.now() - inicio

  // ── 5. Guardar log ──
  let logId: number | null = null
  try {
    const { data: inserted, error: insErr } = await supabase
      .from('healup_citas_manana_logs')
      .insert({
        fecha_objetivo: fechaObjetivo,
        origen: opts.origen,
        triggered_by_email: opts.triggered_by_email || null,
        status,
        citas_count: totalCount,
        citas_dashboard_count: dashboardCitas.length,
        citas_gcal_count: gcalCitas.length,
        duplicados_fusionados: duplicados,
        webhook_url: webhookUrl,
        payload_enviado: payload,
        respuesta_n8n: respuestaN8n,
        http_status: httpStatus,
        error_message: errorMessage,
        duracion_ms: duracionMs
      } as any)
      .select('id')
      .single()
    if (insErr) console.error('[healup-citas-manana] Error guardando log:', insErr.message)
    else logId = inserted?.id || null
  } catch (e: any) {
    console.error('[healup-citas-manana] Excepción guardando log:', e?.message)
  }

  console.log(
    `[healup-citas-manana] objetivo=${fechaObjetivo} | origen=${opts.origen} | status=${status} ` +
    `| citas=${totalCount} (dash:${dashboardCitas.length}, gcal:${gcalCitas.length}, dup:${duplicados}) ` +
    `| duración=${duracionMs}ms`
  )

  return {
    fecha_objetivo: fechaObjetivo,
    fecha_objetivo_friendly: fechaFriendly,
    status,
    citas_count: totalCount,
    citas_dashboard_count: dashboardCitas.length,
    citas_gcal_count: gcalCitas.length,
    duplicados_fusionados: duplicados,
    http_status: httpStatus,
    error_message: errorMessage,
    duracion_ms: duracionMs,
    log_id: logId,
    webhook_configurado: Boolean(webhookUrl)
  }
}
