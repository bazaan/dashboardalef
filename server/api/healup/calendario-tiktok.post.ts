/**
 * POST /api/healup/calendario-tiktok
 *
 * Versión TikTok de la tool "Calendario" de Healup. Funciona EXACTAMENTE igual
 * que /api/healup/calendario (WhatsApp) pero apunta a las tablas/canal de TikTok.
 * Reemplaza los nodos del subflow n8n "ACTIVO agendar heal up tiktok":
 *
 *   - Crea el evento en Google Calendar
 *   - Inserta la cita en healup_calendar_events (calendario del dashboard)
 *   - Upsert del paciente en PacientesBDtiktokHEALUP (en vez de PacientesBDwppHEALUP)
 *   - Genera boleta de consulta (solo si el boleteo automático está activado)
 *   - Aviso interno de nueva cita → Chatwoot (conversaciones 1361 y 8011)
 *   - Loggea cada ejecución en agent_tool_logs (tool_name = "Calendario TikTok")
 *
 * Body esperado (mismo schema del subflow):
 * {
 *   api_key:          string,   — auth ("healup-calendario-tiktok-2026")
 *   nombre_completo:  string,
 *   inicio_cita:      string,   — ISO 8601: "2026-06-24T17:00:00"
 *   fin_cita:         string,   — ISO 8601
 *   numerotelefono:   string,
 *   DNI:              string,
 *   ID:               number | string,   — ID en PacientesBDtiktokHEALUP
 *   red_social:       string,   — default "Tiktok"
 *   "tratamiento(s)": string,
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'
import { avisarNuevaCitaChatwoot } from '~/server/utils/healup-cita-aviso'

const GCAL_API    = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'

const API_KEY = 'healup-calendario-tiktok-2026'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "2026-06-24T17:00:00" → "24-06-2026" (DD-MM-YYYY) */
function isoToDateStr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso ?? '')
}

/** "2026-06-24T17:00:00" → "17:00" */
function isoToTimeStr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso?.trim() ?? '')
  return m ? m[1] : '00:00'
}

/** Trata la hora naive como Lima (-05:00) → "martes 24 de junio a las 5:00 p. m." */
function isoToHumanEs(iso: string): string {
  try {
    const s = (iso || '').trim()
    const withTZ = /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}-05:00`
    return new Date(withTZ).toLocaleString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Lima',
    })
  } catch { return iso }
}

function splitName(full: string): { name: string; surname: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

/** Toma el primer tratamiento; limpia tildes/símbolos para procedure_id. */
function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  const mapa: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N',
  }
  return first.replace(/[áéíóúÁÉÍÓÚñÑ]/g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  return str.length === 11 && str.startsWith('51') ? str.slice(2) : str
}

// ── Handler ─────────────────────────────────────────────────────────────────

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
    const { data: logRow } = await supabase.from('agent_tool_logs')
      .insert({ company_id: 'healup', tool_name: 'Calendario TikTok', input_data: body, status: 'running' })
      .select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const updateLog = async (status: string, output: any, errorMsg?: string) => {
    if (!logId) return
    try {
      await supabase.from('agent_tool_logs').update({
        status, output_data: output, error_message: errorMsg ?? null, duration_ms: Date.now() - startTime,
      }).eq('id', logId)
    } catch {}
  }

  // 3. Validación y parseo
  const { nombre_completo, inicio_cita, fin_cita, numerotelefono, DNI, ID, red_social } = body
  const tratamientos: string = body['tratamiento(s)'] ?? body.tratamientos ?? ''

  if (!nombre_completo || !inicio_cita) {
    const msg = 'Campos requeridos faltantes: nombre_completo, inicio_cita'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const { name: client_name, surname: client_surname } = splitName(nombre_completo)
  const date         = isoToDateStr(inicio_cita)
  const time         = isoToTimeStr(inicio_cita)
  const procedure_id = parseProcedure(tratamientos)
  const phone        = normalizePhone(numerotelefono)
  const dniStr       = String(DNI ?? '')
  const redSocial    = String(red_social ?? '').trim() || 'Tiktok'

  const results: Record<string, any> = {}

  // 4. Google Calendar
  try {
    const accessToken = await getGoogleAccessToken()
    const calId = encodeURIComponent(CALENDAR_ID)
    const addTZ = (iso: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}-05:00`
    const gcalBody = {
      summary:     nombre_completo,
      description: `Nombre Completo: ${nombre_completo}\nNúmero: ${phone}\nDNI: ${dniStr}\nRed social: ${redSocial}`,
      start: { dateTime: addTZ(inicio_cita), timeZone: 'America/Lima' },
      end:   { dateTime: addTZ(fin_cita || inicio_cita), timeZone: 'America/Lima' },
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
    console.error('[calendario-tiktok] Error GCal:', e?.message)
    results.google_calendar = { ok: false, error: e?.message ?? 'Error creando evento en GCal' }
  }

  // 5. healup_calendar_events (calendario del dashboard)
  try {
    const { data: calData, error: calError } = await (supabase.from('healup_calendar_events') as any)
      .insert({
        date, time, subject: 'CITA IA', procedure_id,
        client_name, client_surname, client_dni: dniStr, client_phone: phone,
      })
      .select('id').single()
    if (calError) throw calError
    results.calendario = { ok: true, id: calData?.id, date, time, client: `${client_name} ${client_surname}`.trim() }
  } catch (e: any) {
    console.error('[calendario-tiktok] Error healup_calendar_events:', e?.message)
    results.calendario = { ok: false, error: e?.message ?? 'Error insertando cita' }
  }

  // 6. Upsert en PacientesBDtiktokHEALUP
  try {
    const pacPayload: Record<string, any> = {
      nombre: nombre_completo, dni: dniStr, numero: phone,
      red_social: redSocial, procedimiento: tratamientos, fecha_agendamiento: inicio_cita,
    }
    if (ID) pacPayload.id = Number(ID)
    const op = ID
      ? (supabase.from('PacientesBDtiktokHEALUP') as any).upsert(pacPayload, { onConflict: 'id' })
      : (supabase.from('PacientesBDtiktokHEALUP') as any).insert(pacPayload)
    const { error: pacError } = await op
    if (pacError) throw pacError
    results.paciente = { ok: true, id: ID ?? 'nuevo' }
  } catch (e: any) {
    console.error('[calendario-tiktok] Error PacientesBDtiktokHEALUP:', e?.message)
    results.paciente = { ok: false, error: e?.message ?? 'Error actualizando paciente' }
  }

  // 7. Boleta de consulta (solo si el boleteo está activado)
  try {
    const { data: boleteoSetting } = await supabase
      .from('app_settings').select('value').eq('key', 'healup_boleteo_activo').maybeSingle()
    const boleteoActivo = boleteoSetting?.value === 'true'
    if (!boleteoActivo) {
      results.boleta = { ok: false, skipped: true, motivo: 'Boleteo automático desactivado — actívalo desde Healup → Facturación' }
    } else {
      const boletaResp = await $fetch<any>('/api/pse/boleta-consulta', {
        method: 'POST',
        body: {
          api_key: 'boleta-consulta-alef-2026', company_id: 'healup',
          event_id: results.calendario?.id ?? null,
          client_name, client_surname, client_dni: dniStr, client_phone: phone,
        },
      })
      results.boleta = {
        ok: boletaResp?.success ?? boletaResp?.ok ?? false,
        serie: boletaResp?.serie, numero: boletaResp?.numero,
        enlace_pdf: boletaResp?.enlace_pdf ?? boletaResp?.enlace ?? null,
        mensaje_wpp: boletaResp?.mensaje_wpp ?? null,
      }
    }
  } catch (e: any) {
    console.error('[calendario-tiktok] Error boleta:', e?.message)
    results.boleta = { ok: false, error: e?.message ?? 'Error generando boleta' }
  }

  // 7b. Aviso interno de nueva cita → Chatwoot (best-effort)
  const avisoChatwoot = await avisarNuevaCitaChatwoot({
    nombre: nombre_completo, dni: dniStr, telefono: phone,
    tratamiento: tratamientos, inicioCitaIso: inicio_cita, canal: 'TikTok',
  })

  // 8. Respuesta final
  const fechaHuman = isoToHumanEs(inicio_cita)
  const pdfLink = results.boleta?.enlace_pdf ?? 'no disponible'
  const hayError = ['google_calendar', 'calendario', 'paciente'].some((k) => results[k]?.ok === false)

  const output = {
    ok: !hayError,
    message: `Se ha agendado correctamente:\nFecha y hora: ${fechaHuman}\nenlace_pdf: ${pdfLink}`,
    google_calendar: results.google_calendar,
    calendario: results.calendario,
    paciente: results.paciente,
    boleta: results.boleta,
    aviso_chatwoot: avisoChatwoot,
    log_id: logId,
  }

  await updateLog(hayError ? 'partial' : 'success', output)

  console.log(
    `[calendario-tiktok] Healup TikTok | ${client_name} ${client_surname} | ${date} ${time}`,
    `| gcal:${results.google_calendar?.ok ? '✅' : '❌'}`,
    `| cal:${results.calendario?.ok ? '✅' : '❌'}`,
    `| pac:${results.paciente?.ok ? '✅' : '❌'}`,
    `| boleta:${results.boleta?.skipped ? 'OFF' : results.boleta?.ok ? '✅' : '❌'}`,
  )

  return output
})
