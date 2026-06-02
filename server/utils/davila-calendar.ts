/**
 * Helpers de Google Calendar para la tool validar_pre_reserva de Miguel Davila.
 *
 * Reutiliza la misma autorización OAuth2 de Google que usa Healup
 * (getGoogleAccessToken lee el refresh token de app_settings). Solo cambia
 * el Calendar ID, que se configura con GOOGLE_CALENDAR_ID_DAVILA.
 */

import { getGoogleAccessToken } from '~/server/utils/google-auth'

const GCAL_API = 'https://www.googleapis.com/calendar/v3'

export const DAVILA_CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID_DAVILA || 'migueldavila.citas@gmail.com'

export const DAVILA_TZ = 'America/Lima'

/** "2026-06-03" + "16:00" → "2026-06-03T16:00:00-05:00" (Lima, UTC-5) */
export function buildLimaISO(fecha: string, hora: string): string {
  const h = (hora || '').trim()
  const hhmm = /^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h
  return `${fecha}T${hhmm}:00-05:00`
}

/** Suma minutos a un ISO con offset -05:00, devolviendo otro ISO Lima. */
export function addMinutesISO(fecha: string, hora: string, minutes: number): string {
  const start = new Date(buildLimaISO(fecha, hora))
  const end = new Date(start.getTime() + minutes * 60_000)
  // Reconstruir como ISO Lima (UTC-5)
  const limaMs = end.getTime() - 5 * 60 * 60_000
  const d = new Date(limaMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00-05:00`
}

/**
 * Verifica si un slot está LIBRE en Google Calendar.
 * Devuelve { libre: boolean, conflictos: number }.
 * Si Google falla, lanza error (el caller decide qué hacer).
 */
export async function slotEstaLibre(
  fecha: string, hora: string, duracionMin: number,
): Promise<{ libre: boolean; conflictos: number }> {
  const accessToken = await getGoogleAccessToken()
  const timeMin = buildLimaISO(fecha, hora)
  const timeMax = addMinutesISO(fecha, hora, duracionMin)

  const res = await fetch(`${GCAL_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: DAVILA_TZ,
      items: [{ id: DAVILA_CALENDAR_ID }],
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`GCal freeBusy ${res.status}: ${t}`)
  }

  const data = await res.json() as any
  const busy = data?.calendars?.[DAVILA_CALENDAR_ID]?.busy ?? []
  return { libre: busy.length === 0, conflictos: busy.length }
}

/**
 * Crea un evento en Google Calendar. Devuelve el eventId.
 */
export async function crearEvento(args: {
  fecha: string; hora: string; duracionMin: number;
  summary: string; description?: string;
}): Promise<string> {
  const accessToken = await getGoogleAccessToken()
  const calId = encodeURIComponent(DAVILA_CALENDAR_ID)

  const body = {
    summary:     args.summary,
    description: args.description ?? '',
    start: { dateTime: buildLimaISO(args.fecha, args.hora), timeZone: DAVILA_TZ },
    end:   { dateTime: addMinutesISO(args.fecha, args.hora, args.duracionMin), timeZone: DAVILA_TZ },
  }

  const res = await fetch(`${GCAL_API}/calendars/${calId}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`GCal create ${res.status}: ${t}`)
  }
  const ev = await res.json() as any
  return ev.id
}

/**
 * Elimina un evento de Google Calendar. No lanza si el evento ya no existe (404/410).
 */
export async function eliminarEvento(eventId: string): Promise<boolean> {
  if (!eventId) return false
  try {
    const accessToken = await getGoogleAccessToken()
    const calId = encodeURIComponent(DAVILA_CALENDAR_ID)
    const res = await fetch(`${GCAL_API}/calendars/${calId}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 204 = borrado OK; 404/410 = ya no existe (lo tratamos como éxito)
    return res.ok || res.status === 404 || res.status === 410
  } catch (e: any) {
    console.error('[davila-calendar] Error eliminando evento:', e?.message)
    return false
  }
}
