/**
 * POST /api/solari/calendario
 *
 * Endpoint unificado de agendamiento para Solari — reemplaza las tools Supabase
 * "calendario" + "pacienteswpp" del sub-workflow de n8n
 * ("SOLARI | WHATSAPP | Tool agendar parte 1") por UNA sola llamada HTTP.
 * Centraliza la lógica, mejora el manejo de errores y loggea cada ejecución en
 * `agent_tool_logs` (visible en Dashboard Alef → Dev · Agent Logs → Solari).
 *
 * En una sola llamada hace:
 *   1. (opcional) Crea el evento en Google Calendar — SOLO si GOOGLE_CALENDAR_ID_SOLARI
 *      está configurado y el service account tiene acceso a ese calendario.
 *   2. Inserta la cita en `solari_calendar_events` (calendario del dashboard Solari).
 *   3. Inserta al paciente en `PacientesBDwppSOLARI` (lista de pacientes del dashboard).
 *   4. Loggea la ejecución en `agent_tool_logs` (company_id='solari', tool_name='Calendario').
 *
 * Body esperado (lo llena el agente IA de n8n vía $fromAI):
 * {
 *   api_key:         string,   — auth ("solari-calendario-2026")
 *   nombre_completo: string,   — "Yamile Patiño"  (alias aceptado: nombre_y_apellido)
 *   inicio_cita:     string,   — ISO 8601: "2026-05-05T14:00:00"
 *   fin_cita:        string,   — ISO 8601: "2026-05-05T14:30:00" (opcional; +30min si falta)
 *   numero:          string,   — "51972619000" o "972619000"  (alias aceptado: telefono / numerotelefono)
 *   DNI:             string,   — "12345678" (opcional)
 *   tratamiento:     string,   — "Rinoplastia Estructural"
 *   formato:         string,   — "Presencial - Sede Surco" | "Virtual" (opcional)
 *   red_social:      string,   — "WhatsApp" (opcional, default)
 * }
 *
 * Response exitosa:
 * {
 *   ok: true,
 *   message: "Se ha agendado correctamente:\nFecha y hora: ...",
 *   google_calendar: { ok, ... },
 *   calendario:      { ok, id, date, time, client },
 *   paciente:        { ok, id },
 *   log_id:          number
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'

const GCAL_API     = 'https://www.googleapis.com/calendar/v3'
// Vacío por defecto → NO se crea evento en Google Calendar (lo sigue haciendo la
// tool "agendar_cita"/parte 2). Si configuras el ID del calendario de Solari y le
// das acceso al service account (GOOGLE_SERVICE_ACCOUNT_JSON), este endpoint también
// crea el evento en GCal y puedes eliminar la tool parte 2.
const CALENDAR_ID  = process.env.GOOGLE_CALENDAR_ID_SOLARI || ''

const API_KEY = 'solari-calendario-2026'

// ── Helpers de parseo ─────────────────────────────────────────────────────────

/** "2026-05-05T14:00:00" → "05-05-2026" (DD-MM-YYYY) */
function isoToDateStr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso ?? '')
}

/** "2026-05-05T14:00:00" → "14:00" */
function isoToTimeStr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso?.trim() ?? '')
  return m ? m[1] : '00:00'
}

/** "2026-05-05T14:00:00" → "lunes 5 de mayo a las 2:00 p. m." (es-PE, Lima) */
function isoToHumanEs(iso: string): string {
  try {
    return toLimaDate(iso).toLocaleString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Lima',
    })
  } catch { return iso }
}

/**
 * Trata una hora SIN zona horaria (naive, ej. "2026-05-05T14:00:00") como hora
 * de Lima (UTC-5). Sin esto el servidor (UTC) interpretaría "14:00" como UTC.
 */
function toLimaDate(iso: string): Date {
  const s = (iso || '').trim()
  return new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}-05:00`)
}

/** Añade la zona de Lima si el ISO no la trae (para Google Calendar / timestamptz). */
function addTZ(iso: string): string {
  const s = (iso || '').trim()
  return /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}-05:00`
}

/** Suma `mins` minutos a un ISO naive y devuelve otro ISO naive (para fin_cita). */
function addMinutesISO(iso: string, mins: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec((iso || '').trim())
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  d.setMinutes(d.getMinutes() + mins)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/** Divide "Juan Perez Garcia" → { name: "Juan", surname: "Perez Garcia" }. */
function splitName(full: string): { name: string; surname: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

/** Toma el primer tratamiento, quita tildes y símbolos (para procedure_id). */
function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  const mapa: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N',
  }
  return first.replace(/[áéíóúÁÉÍÓÚñÑ]/g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Quita el prefijo "51" si el número tiene 11 dígitos. */
function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  return str.length === 11 && str.startsWith('51') ? str.slice(2) : str
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase
      .from('agent_tool_logs')
      .insert({ company_id: 'solari', tool_name: 'Calendario', input_data: body, status: 'running' })
      .select('id')
      .single()
    logId = logRow?.id ?? null
  } catch { /* la tabla puede no existir aún */ }

  const updateLog = async (status: string, output: any, errorMsg?: string) => {
    if (!logId) return
    try {
      await supabase.from('agent_tool_logs').update({
        status, output_data: output, error_message: errorMsg ?? null, duration_ms: Date.now() - startTime,
      }).eq('id', logId)
    } catch {}
  }

  // 3. Validación y parseo de inputs (aceptamos varios alias por robustez)
  const nombre_completo = String(body?.nombre_completo ?? body?.nombre_y_apellido ?? '').trim()
  const inicio_cita     = String(body?.inicio_cita ?? '').trim()
  const fin_cita        = String(body?.fin_cita ?? '').trim() || addMinutesISO(inicio_cita, 30)
  const tratamiento     = String(body?.tratamiento ?? body?.['tratamiento(s)'] ?? '').trim()
  const formato         = String(body?.formato ?? '').trim()
  const red_social      = String(body?.red_social ?? 'WhatsApp').trim() || 'WhatsApp'
  const dniStr          = String(body?.DNI ?? body?.dni ?? '').trim()
  const phone           = normalizePhone(body?.numero ?? body?.telefono ?? body?.numerotelefono ?? '')

  if (!nombre_completo || !inicio_cita) {
    const msg = 'Campos requeridos faltantes: nombre_completo, inicio_cita'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const { name: client_name, surname: client_surname } = splitName(nombre_completo)
  const date         = isoToDateStr(inicio_cita)
  const time         = isoToTimeStr(inicio_cita)
  const procedure_id = parseProcedure(tratamiento)

  const results: Record<string, any> = {}

  // 4. Google Calendar (opcional — solo si hay calendario configurado)
  if (CALENDAR_ID) {
    try {
      const accessToken = await getGoogleAccessToken()
      const calId = encodeURIComponent(CALENDAR_ID)
      const gcalBody = {
        summary: `${nombre_completo}${tratamiento ? ` - ${tratamiento}` : ''}`,
        description:
          `Paciente: ${nombre_completo}\nDNI: ${dniStr}\nNúmero: ${phone}\n` +
          `Tratamiento: ${tratamiento}${formato ? `\nFormato: ${formato}` : ''}`,
        start: { dateTime: addTZ(inicio_cita), timeZone: 'America/Lima' },
        end:   { dateTime: addTZ(fin_cita), timeZone: 'America/Lima' },
      }
      const res = await fetch(`${GCAL_API}/calendars/${calId}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(gcalBody),
      })
      if (!res.ok) throw new Error(`GCal API ${res.status}: ${await res.text()}`)
      const gcalEvent = await res.json() as any
      results.google_calendar = { ok: true, eventId: gcalEvent.id, htmlLink: gcalEvent.htmlLink }
    } catch (e: any) {
      console.error('[solari/calendario] Error en Google Calendar:', e?.message)
      results.google_calendar = { ok: false, error: e?.message ?? 'Error creando evento en GCal' }
    }
  } else {
    results.google_calendar = { ok: true, skipped: true, motivo: 'GOOGLE_CALENDAR_ID_SOLARI no configurado (lo maneja la tool parte 2)' }
  }

  // 5. Insertar en solari_calendar_events (calendario del dashboard)
  try {
    const { data: calData, error: calError } = await (supabase.from('solari_calendar_events') as any)
      .insert({
        date,
        time,
        subject:        'CITA IA',
        description:    formato ? `Formato: ${formato}` : '',
        procedure_id,
        client_name,
        client_surname,
        client_dni:     dniStr,
        client_phone:   phone,
        event_reason:   tratamiento,
      })
      .select('id')
      .single()
    if (calError) throw calError
    results.calendario = { ok: true, id: calData?.id, date, time, client: `${client_name} ${client_surname}`.trim() }
  } catch (e: any) {
    console.error('[solari/calendario] Error en solari_calendar_events:', e?.message)
    results.calendario = { ok: false, error: e?.message ?? 'Error insertando cita' }
  }

  // 6. Insertar en PacientesBDwppSOLARI (lista de pacientes del dashboard)
  try {
    const { error: pacError } = await (supabase.from('PacientesBDwppSOLARI') as any).insert({
      nombre:             nombre_completo,
      dni:                dniStr,
      numero:             phone,
      red_social,
      procedimiento:      tratamiento,
      fecha_agendamiento: addTZ(inicio_cita),
      estado:             'Activo',
      agendamiento:       'IA',
    })
    if (pacError) throw pacError
    results.paciente = { ok: true }
  } catch (e: any) {
    console.error('[solari/calendario] Error en PacientesBDwppSOLARI:', e?.message)
    results.paciente = { ok: false, error: e?.message ?? 'Error insertando paciente' }
  }

  // 7. Respuesta final
  const fechaHuman = isoToHumanEs(inicio_cita)
  const hayError = Object.values(results).some((r: any) => r?.ok === false)
  const output = {
    ok:              !hayError,
    message:         `Se ha agendado correctamente:\nFecha y hora: ${fechaHuman}`,
    google_calendar: results.google_calendar,
    calendario:      results.calendario,
    paciente:        results.paciente,
    log_id:          logId,
  }

  await updateLog(hayError ? 'partial' : 'success', output)

  console.log(
    `[solari/calendario] Solari | ${client_name} ${client_surname} | ${date} ${time}`,
    `| gcal:${results.google_calendar?.ok ? '✅' : '❌'}`,
    `| cal:${results.calendario?.ok ? '✅' : '❌'}`,
    `| pac:${results.paciente?.ok ? '✅' : '❌'}`,
  )

  return output
})
