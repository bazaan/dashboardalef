/**
 * POST /api/healup/gcal-auto-sync
 *
 * Auto-sincroniza eventos de Google Calendar a healup_calendar_events en Supabase.
 * Fetches GCal → compara con Supabase → importa los faltantes automáticamente.
 *
 * Body: { date: "YYYY-MM-DD" }
 *
 * Se llama automáticamente desde HealupCobroAtencion al cargar citas del día,
 * para que todo esté centralizado en Supabase sin intervención manual.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const date = body?.date

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: 'date requerido en formato YYYY-MM-DD', imported: 0 }
  }

  // 1. Fetch GCal events
  let gcalEvents: any[] = []
  try {
    const accessToken = await getGoogleAccessToken()
    const calendarId = encodeURIComponent(
      process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'
    )

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
      console.warn('[GCalAutoSync] GCal API error:', res.status, errText.substring(0, 200))
      // No lanzar error — simplemente no sincronizar
      return { success: false, error: 'GCal no disponible', imported: 0 }
    }

    const data = await res.json() as { items?: any[] }
    gcalEvents = (data.items || []).filter((e: any) => e.status !== 'cancelled')
  } catch (err: any) {
    console.warn('[GCalAutoSync] Error consultando GCal:', err.message)
    // Silenciar — GCal puede no estar configurado, las citas manuales siguen funcionando
    return { success: false, error: err.message, imported: 0 }
  }

  if (gcalEvents.length === 0) {
    return { success: true, imported: 0, gcal_total: 0 }
  }

  // 2. Fetch existing Supabase events para comparar
  const client = serverSupabaseServiceRole(event)
  const [y, m, d] = date.split('-')
  const ddmmyyyy = `${d}-${m}-${y}`

  const { data: supaEvents } = await client
    .from('healup_calendar_events')
    .select('id, date, time, client_name, client_surname, client_phone')
    .or(`date.eq.${date},date.eq.${ddmmyyyy}`)

  const dbEvents = (supaEvents || []).map(e => ({
    ...e,
    _time: (e.time || '').substring(0, 5),
    _name: `${e.client_name || ''} ${e.client_surname || ''}`.trim().toLowerCase(),
    _phone: normalizePhone(e.client_phone || '')
  }))

  // 3. Identificar y auto-importar faltantes
  let imported = 0
  const matched = new Set<number>()

  for (const gcal of gcalEvents) {
    const startDt = gcal.start?.dateTime || gcal.start?.date || ''
    const time = extractTime(startDt)
    if (!time) continue

    const parsedDesc = parseGCalDescription(gcal.description || '')
    const parsedSummary = parseGCalSummary(gcal.summary || '')

    const clientName = parsedDesc.nombre || parsedSummary.nombre || ''
    const clientSurname = parsedDesc.apellido || parsedSummary.apellido || ''
    const clientPhone = parsedDesc.phone || parsedSummary.phone || ''
    const clientDni = parsedDesc.dni || parsedSummary.dni || ''
    const procedure = parsedSummary.procedure || ''
    const cleanName = `${clientName} ${clientSurname}`.trim().toLowerCase()

    // Buscar match en Supabase
    const match = dbEvents.find(s =>
      !matched.has(s.id) &&
      s._time === time && (
        (clientPhone && s._phone && normalizePhone(clientPhone) === s._phone) ||
        (cleanName && s._name === cleanName)
      )
    )

    if (match) {
      matched.add(match.id)
      continue // Ya existe en Supabase
    }

    // No existe — importar
    if (!clientName) continue // Sin nombre no podemos importar

    const timeDb = time.length === 5 ? time + ':00' : time
    const fullName = `${clientName} ${clientSurname}`.trim()

    // Verificar que no haya un duplicado por date+time exacto
    const existsByTime = dbEvents.some(s => s._time === time && !matched.has(s.id))
    if (existsByTime) continue // Ya hay algo en ese slot

    const { error: insertErr } = await client
      .from('healup_calendar_events')
      .insert({
        date,
        time: timeDb,
        subject: fullName + (procedure ? ` - ${procedure}` : ''),
        description: `Auto-importado desde Google Calendar (${gcal.id || ''})`,
        client_name: clientName,
        client_surname: clientSurname,
        client_phone: clientPhone,
        client_dni: clientDni,
        client_email: '',
        event_reason: 'Tratamiento',
        cabina: 'cabina1',
        procedure_id: procedure || null
      })

    if (!insertErr) {
      imported++
      console.log(`[GCalAutoSync] Auto-importado: ${fullName} el ${date} a las ${time}`)
    } else {
      console.warn(`[GCalAutoSync] Error importando ${fullName}:`, insertErr.message)
    }
  }

  return {
    success: true,
    gcal_total: gcalEvents.length,
    imported,
    existing: dbEvents.length
  }
})

/* ─── Helpers (mismos que gcal-events.get.ts) ─── */

function extractTime(isoOrDate: string): string {
  if (!isoOrDate) return ''
  try {
    const d = new Date(isoOrDate)
    if (isNaN(d.getTime())) return ''
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return ''
  }
}

function parseGCalSummary(summary: string): { nombre: string; apellido: string; phone: string; dni: string; procedure: string } {
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
      if (val.length === 7 || val.length === 8) {
        if (!result.dni) result.dni = val
      } else if (val.length >= 9) {
        if (!result.phone) result.phone = val
      }
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

function parseGCalDescription(desc: string): { nombre: string; apellido: string; phone: string; dni: string } {
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

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('51')) return digits.substring(2)
  return digits
}
