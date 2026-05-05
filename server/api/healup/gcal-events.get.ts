/**
 * GET /api/healup/gcal-events?date=YYYY-MM-DD
 *
 * Lee eventos directamente de Google Calendar API (sin n8n) y los cruza
 * con healup_calendar_events en Supabase.
 *
 * Variables de entorno requeridas:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — JSON del service account de Google
 *   GOOGLE_CALENDAR_ID_HEALUP   — ID del calendario (default: healupaestheticlab@gmail.com)
 *
 * Prerequisito: compartir el calendario de Google con el email del service account
 * (permisos de lectura: "Ver todos los detalles del evento").
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export default defineEventHandler(async (event) => {
  const { date } = getQuery(event) as { date?: string }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Parámetro date requerido en formato YYYY-MM-DD' })
  }

  // 1. Fetch GCal events directamente via Google Calendar API
  let gcalEvents: any[] = []
  try {
    const accessToken = await getGoogleAccessToken()
    const calendarId = encodeURIComponent(
      process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'
    )

    // Rango del día completo en hora local Peru (UTC-5)
    const timeMin = `${date}T00:00:00-05:00`
    const timeMax = `${date}T23:59:59-05:00`

    const url = `${CALENDAR_API}/calendars/${calendarId}/events?` + new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100'
    })

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[GCal] API error:', res.status, errText)
      throw new Error(`Google Calendar API ${res.status}: ${errText.substring(0, 200)}`)
    }

    const data = await res.json() as { items?: any[] }
    gcalEvents = (data.items || []).filter((e: any) => e.status !== 'cancelled')

  } catch (err: any) {
    console.error('[GCal] Error:', err.message)
    throw createError({
      statusCode: 502,
      statusMessage: `Error al consultar Google Calendar: ${err.message}`
    })
  }

  // 2. Fetch Supabase events para la misma fecha (ambos formatos)
  const client = serverSupabaseServiceRole(event)
  const ddmmyyyy = formatDateDDMMYYYY(date)

  const { data: supaEvents } = await client
    .from('healup_calendar_events')
    .select('id, date, time, client_name, client_surname, client_phone, client_dni, client_email, subject, cabina, procedure_id')
    .or(`date.eq.${date},date.eq.${ddmmyyyy}`)

  const dbEvents = (supaEvents || []).map(e => ({
    ...e,
    _time: (e.time || '').substring(0, 5) // HH:MM
  }))

  // 2b. Catálogo de procedimientos para auto-detectar SKU desde el subject de GCal
  const { data: procs } = await client
    .from('healup_procedures')
    .select('id, name, sku, grupo, cabina')
  const catalogo = procs || []

  // 3. Parsear y cruzar eventos GCal con Supabase
  const matched = new Set<number>() // IDs de eventos de Supabase ya matcheados
  const merged = gcalEvents.map(gcal => {
    const startDt = gcal.start?.dateTime || gcal.start?.date || ''
    const time = extractTime(startDt)
    const parsedDesc = parseGCalDescription(gcal.description || '')
    const parsedSummary = parseGCalSummary(gcal.summary || '')
    const fullName = (gcal.summary || '').trim()

    // Prioridad: description (agente n8n) > summary (manual GCal)
    const clientName = parsedDesc.nombre || parsedSummary.nombre || ''
    const clientSurname = parsedDesc.apellido || parsedSummary.apellido || ''
    const clientPhone = parsedDesc.phone || parsedSummary.phone || ''
    const clientDni = parsedDesc.dni || parsedSummary.dni || ''
    const procedure = parsedSummary.procedure || ''

    // Buscar match en Supabase por tiempo + nombre o teléfono
    const cleanName = `${clientName} ${clientSurname}`.trim().toLowerCase()
    const match = dbEvents.find(s =>
      !matched.has(s.id) &&
      s._time === time && (
        (clientPhone && s.client_phone && normalizePhone(s.client_phone) === normalizePhone(clientPhone)) ||
        (`${s.client_name} ${s.client_surname}`.trim().toLowerCase() === cleanName)
      )
    )

    if (match) matched.add(match.id)

    // Resolver SKU: 1) si ya hay match en dashboard con procedure_id, usar ese; 2) sino auto-detectar desde texto
    const matchedProcId = match?.procedure_id ? Number(match.procedure_id) : null
    const procFromDashboard = matchedProcId
      ? catalogo.find((p: any) => Number(p.id) === matchedProcId)
      : null
    const subjectForMatch = `${fullName}\n${procedure || ''}\n${gcal.description || ''}`
    const procFromText = procFromDashboard || detectProcedureFromText(subjectForMatch, catalogo)

    return {
      gcal_id: gcal.id || null,
      gcal_summary: fullName,
      gcal_description: gcal.description || '',
      gcal_start: startDt,
      gcal_end: gcal.end?.dateTime || gcal.end?.date || '',
      time,
      client_name: clientName,
      client_surname: clientSurname,
      client_phone: clientPhone,
      client_dni: clientDni,
      procedure,
      procedure_id: procFromText?.id || null,
      procedure_sku: procFromText?.sku || null,
      procedure_name: procFromText?.name || null,
      procedure_grupo: procFromText?.grupo || null,
      sku_auto_detected: !!procFromText && !procFromDashboard,
      en_dashboard: !!match,
      dashboard_event_id: match?.id || null,
      cobro_completado: (match as any)?.cobro_completado || false,
      cabina: match?.cabina || procFromText?.cabina || 'cabina1'
    }
  })

  // 4. Eventos en dashboard pero NO en GCal (agendados via WhatsApp API directo)
  const soloEnDashboard = dbEvents
    .filter(s => !matched.has(s.id))
    .map(s => {
      const procId = s.procedure_id ? Number(s.procedure_id) : null
      const proc = procId ? catalogo.find((p: any) => Number(p.id) === procId) : null
      return {
        gcal_id: null,
        gcal_summary: `${s.client_name} ${s.client_surname}`.trim(),
        gcal_description: '',
        gcal_start: '',
        gcal_end: '',
        time: s._time,
        client_name: s.client_name,
        client_surname: s.client_surname,
        client_phone: s.client_phone || '',
        client_dni: s.client_dni || '',
        procedure: proc?.name || '',
        procedure_id: procId,
        procedure_sku: proc?.sku || null,
        procedure_name: proc?.name || null,
        procedure_grupo: proc?.grupo || null,
        sku_auto_detected: false,
        en_dashboard: true,
        dashboard_event_id: s.id,
        cobro_completado: (s as any).cobro_completado || false,
        cabina: s.cabina || 'cabina1',
        solo_dashboard: true
      }
    })

  const allEvents = [...merged, ...soloEnDashboard].sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  return {
    date,
    gcal_total: gcalEvents.length,
    dashboard_total: dbEvents.length,
    faltantes: merged.filter(e => !e.en_dashboard).length,
    events: allEvents
  }
})

/* ─── Helpers ─────────────────────────────────────── */

function extractTime(isoOrDate: string): string {
  if (!isoOrDate) return ''
  try {
    const d = new Date(isoOrDate)
    if (isNaN(d.getTime())) return ''
    // Extraer HH:MM de la hora local (el ISO ya trae timezone)
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return ''
  }
}

/**
 * Parsea el summary de un evento GCal.
 * Formatos comunes:
 *   "Paola Arias - 09541663 - 951484113\n3era sesión quemadores"
 *   "Ámbar Milena Navarro \nDni 70973677\nCel 936818130\nNatural Lips"
 *   "Carolina Mendez Gonzales\nHidralips"
 *   "maria gabriela rivera\nBotox o labios"
 */
function parseGCalSummary(summary: string): { nombre: string; apellido: string; phone: string; dni: string; procedure: string } {
  const result = { nombre: '', apellido: '', phone: '', dni: '', procedure: '' }
  if (!summary) return result

  const lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return result

  // Extraer DNI y teléfono de cualquier línea
  for (const line of lines) {
    // "Dni 70973677" o "DNI: 12345678"
    const dniMatch = line.match(/\bDni\s*:?\s*(\d{7,8})/i)
    if (dniMatch && !result.dni) result.dni = dniMatch[1]

    // "Cel 936818130" o "Celular: 987654321"
    const celMatch = line.match(/\bCel(?:ular)?\s*:?\s*(\d{9,11})/i)
    if (celMatch && !result.phone) result.phone = celMatch[1]
  }

  // Primera línea: nombre (posiblemente con "- DNI - TEL" inline)
  let firstLine = lines[0]

  // Formato "Nombre Apellido - 09541663 - 951484113"
  const dashParts = firstLine.split(/\s+-\s+/)
  if (dashParts.length >= 2) {
    firstLine = dashParts[0].trim()
    for (let i = 1; i < dashParts.length; i++) {
      const val = dashParts[i].replace(/\D/g, '')
      if (val.length === 7 || val.length === 8) {
        if (!result.dni) result.dni = val
      } else if (val.length >= 9) {
        if (!result.phone) result.phone = val
      }
    }
  }

  // Limpiar "Dni..." y "Cel..." si quedaron pegados en la primera línea
  firstLine = firstLine.replace(/\bDni\s*:?\s*\d+/i, '').replace(/\bCel(?:ular)?\s*:?\s*\d+/i, '').trim()

  // Separar nombre y apellido
  const nameParts = firstLine.split(/\s+/).filter(Boolean)
  result.nombre = nameParts[0] || ''
  result.apellido = nameParts.slice(1).join(' ') || ''

  // Las líneas restantes que no son DNI/Cel son el procedimiento
  const procLines = lines.slice(1).filter(l =>
    !/\bDni\b/i.test(l) && !/\bCel(?:ular)?\b/i.test(l) && !/^\d+$/.test(l)
  )
  result.procedure = procLines.join(' ').trim()

  return result
}

function parseGCalDescription(desc: string): { nombre: string; apellido: string; phone: string; dni: string } {
  const result = { nombre: '', apellido: '', phone: '', dni: '' }
  if (!desc) return result

  // Formato del agente n8n:
  // "Nombre Completo: Juan Perez\nNúmero: 987654321\nDNI: 12345678"
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

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('51')) return digits.substring(2)
  return digits
}

function formatDateDDMMYYYY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}-${m}-${y}`
}

/**
 * Detecta el procedimiento contra el catálogo:
 *   1) busca un SKU explícito en el texto (ej: "FB-001"),
 *   2) sino busca el nombre completo del procedimiento (longest first).
 */
function detectProcedureFromText(text: string, procs: any[]): any | null {
  if (!text || !procs?.length) return null

  const upper = text.toUpperCase()
  for (const p of procs) {
    if (p.sku && upper.includes(String(p.sku).toUpperCase())) return p
  }

  const norm = (s: string) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim()

  const t = norm(text)
  const sorted = [...procs].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
  for (const p of sorted) {
    const n = norm(p.name || '')
    if (n && n.length >= 4 && t.includes(n)) return p
  }
  return null
}
