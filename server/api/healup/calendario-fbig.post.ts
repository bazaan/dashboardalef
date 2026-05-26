/**
 * POST /api/healup/calendario-fbig
 *
 * Versión Instagram/Facebook de la tool "Calendario" de Healup.
 * Funciona EXACTAMENTE igual que /api/healup/calendario (WhatsApp) pero adaptada
 * a los canales y tablas del subflow n8n "ACTIVO agendar heal up fb ig":
 *
 *   Igual que WhatsApp:
 *     - Crea el evento en Google Calendar
 *     - Inserta la cita en healup_calendar_events (calendario del dashboard)
 *     - Genera boleta de consulta (solo si el boleteo automático está activado)
 *     - Loggea cada ejecución en agent_tool_logs (tool_name = "Calendario FB/IG")
 *
 *   Específico de IG/FB (reemplaza los nodos del subflow):
 *     - Upsert del paciente en PacientesBDfbigHEALUP  (en vez de PacientesBDwppHEALUP)
 *     - Marca pasar_supervisor = "si" en pasar_supervisor_healup
 *     - Append de la fila en la hoja Google Sheets "citas_healup"
 *     - Notifica a la supervisora (LUCIA) vía Chatwoot (cuenta 2, conversación 700)
 *
 * Body esperado (mismo schema del subflow + nombre_ig):
 * {
 *   api_key:          string,                    — auth
 *   nombre_completo:  string,
 *   inicio_cita:      string,                    — ISO 8601: "2026-03-06T17:00:00"
 *   fin_cita:         string,                    — ISO 8601
 *   numerotelefono:   string,                    — PSID de Messenger/IG (no es un teléfono real)
 *   DNI:              string,
 *   ID:               number | string,           — ID en PacientesBDfbigHEALUP
 *   red_social:       string,                    — "Channel::Instagram" | "Instagram" | "Facebook"
 *   "tratamiento(s)": string,
 *   nombre_ig:        string,                    — usuario IG/FB (se usa en el aviso a la supervisora)
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'

const GCAL_API     = 'https://www.googleapis.com/calendar/v3'
const SHEETS_API   = 'https://sheets.googleapis.com/v4/spreadsheets'
const CALENDAR_ID  = process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'

const API_KEY = 'healup-calendario-fbig-2026'

// Hoja "citas_healup" del subflow (pestaña gid=0, nombre "citas")
const SHEET_ID    = process.env.GOOGLE_SHEET_CITAS_HEALUP_ID || '1C4qVEgymTANCne2xGQtwOi_ow4tDx1XvxIZ-pHOtCPE'
const SHEET_RANGE = process.env.GOOGLE_SHEET_CITAS_HEALUP_RANGE || 'citas'

// Chatwoot — aviso a la supervisora (LUCIA). Token y conversación del subflow.
const CHATWOOT_URL   = 'https://chats.alef.company/api/v1/accounts/2/conversations/700/messages'
const CHATWOOT_TOKEN = process.env.CHATWOOT_HEALUP_FBIG_TOKEN || '8oLRk3yaKcLoR5zt4KPNtcUy'

// ── Helpers de parseo (idénticos a calendario.post.ts) ─────────────────────────

/** "2026-03-06T17:00:00" → "06-03-2026" (formato DD-MM-YYYY que usa el agente IA) */
function isoToDateStr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() ?? '')
  if (!m) return iso ?? ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** "2026-03-06T17:00:00" → "17:00" */
function isoToTimeStr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso?.trim() ?? '')
  return m ? m[1] : '00:00'
}

/** "2026-03-06T17:00:00" → "martes 6 de marzo a las 5:00pm" */
function isoToHumanEs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Lima'
    })
  } catch { return iso }
}

/** Primera palabra = nombre, resto = apellidos. */
function splitName(full: string): { name: string; surname: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

/** Toma el primer tratamiento si hay varios; limpia tildes/símbolos para procedure_id. */
function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  const mapa: Record<string,string> = {a:'a',e:'e',i:'i',o:'o',u:'u',A:'A',E:'E',I:'I',O:'O',U:'U',n:'n',N:'N'}
  return first.replace(/./g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').trim()
}

/** "Channel::Instagram" → "Instagram"; "Facebook" → "Facebook". Default "Instagram". */
function parseRedSocial(raw: string): string {
  const val = String(raw ?? '').trim()
  if (!val) return 'Instagram'
  const afterPrefix = val.includes('::') ? val.split('::').pop()!.trim() : val
  const low = afterPrefix.toLowerCase()
  if (low.includes('face')) return 'Facebook'
  if (low.includes('insta')) return 'Instagram'
  return afterPrefix || 'Instagram'
}

// ── Handler principal ──────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // ── 1. Autenticación ───────────────────────────────────────────────────────
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // ── 2. Log inicial ─────────────────────────────────────────────────────────
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase
      .from('agent_tool_logs')
      .insert({
        company_id:  'healup',
        tool_name:   'Calendario FB/IG',
        input_data:  body,
        status:      'running',
      })
      .select('id')
      .single()
    logId = logRow?.id ?? null
  } catch { /* tabla puede no existir aún */ }

  const updateLog = async (status: string, output: any, errorMsg?: string) => {
    if (!logId) return
    try {
      await supabase.from('agent_tool_logs').update({
        status,
        output_data:   output,
        error_message: errorMsg ?? null,
        duration_ms:   Date.now() - startTime,
      }).eq('id', logId)
    } catch {}
  }

  // ── 3. Validación y parseo de inputs ──────────────────────────────────────
  const {
    nombre_completo, inicio_cita, fin_cita,
    numerotelefono, DNI, ID, nombre_ig,
  } = body
  const tratamientos: string = body['tratamiento(s)'] ?? body.tratamientos ?? ''
  const redSocial = parseRedSocial(body.red_social)

  if (!nombre_completo || !inicio_cita) {
    const msg = 'Campos requeridos faltantes: nombre_completo, inicio_cita'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const { name: client_name, surname: client_surname } = splitName(nombre_completo)
  const date         = isoToDateStr(inicio_cita)
  const time         = isoToTimeStr(inicio_cita)
  const procedure_id = parseProcedure(tratamientos)
  // En IG/FB "numerotelefono" es un PSID de Messenger, no un teléfono: se guarda tal cual.
  const numero       = String(numerotelefono ?? '').trim()
  const dniStr       = String(DNI ?? '')
  const igHandle     = String(nombre_ig ?? '').trim() || nombre_completo

  const results: Record<string, any> = {}

  // ── 4. Crear evento en Google Calendar ────────────────────────────────────
  try {
    const accessToken = await getGoogleAccessToken()
    const calId       = encodeURIComponent(CALENDAR_ID)
    const addTZ = (iso: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}-05:00`

    const gcalBody = {
      summary:     nombre_completo,
      description: `Nombre Completo: ${nombre_completo}\nNúmero: ${numero}\nDNI: ${dniStr}\nRed social: ${redSocial}`,
      start: { dateTime: addTZ(inicio_cita), timeZone: 'America/Lima' },
      end:   { dateTime: addTZ(fin_cita || inicio_cita), timeZone: 'America/Lima' },
    }

    const res = await fetch(`${GCAL_API}/calendars/${calId}/events`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(gcalBody),
    })

    if (!res.ok) throw new Error(`GCal API ${res.status}: ${await res.text()}`)

    const gcalEvent = await res.json() as any
    results.google_calendar = {
      ok: true, eventId: gcalEvent.id, htmlLink: gcalEvent.htmlLink, summary: gcalEvent.summary,
    }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en Google Calendar:', e?.message)
    results.google_calendar = { ok: false, error: e?.message ?? 'Error creando evento en GCal' }
  }

  // ── 5. Insertar en healup_calendar_events (calendario del dashboard) ────────
  try {
    const { data: calData, error: calError } = await (supabase
      .from('healup_calendar_events') as any)
      .insert({
        date,
        time,
        subject:        'CITA IA',
        procedure_id,
        client_name,
        client_surname,
        client_dni:   dniStr,
        client_phone: numero,
      })
      .select('id')
      .single()

    if (calError) throw calError
    results.calendario = {
      ok: true, id: calData?.id, date, time,
      client: `${client_name} ${client_surname}`.trim(),
    }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en healup_calendar_events:', e?.message)
    results.calendario = { ok: false, error: e?.message ?? 'Error insertando cita' }
  }

  // ── 6. Upsert en PacientesBDfbigHEALUP ─────────────────────────────────────
  try {
    const pacPayload: Record<string, any> = {
      nombre:             nombre_completo,
      dni:                dniStr,
      numero,
      red_social:         redSocial,
      procedimiento:      tratamientos,
      fecha_agendamiento: inicio_cita,
    }
    if (ID) pacPayload.id = Number(ID)

    const op = ID
      ? (supabase.from('PacientesBDfbigHEALUP') as any).upsert(pacPayload, { onConflict: 'id' })
      : (supabase.from('PacientesBDfbigHEALUP') as any).insert(pacPayload)

    const { error: pacError } = await op
    if (pacError) throw pacError
    results.paciente = { ok: true, id: ID ?? 'nuevo' }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en PacientesBDfbigHEALUP:', e?.message)
    results.paciente = { ok: false, error: e?.message ?? 'Error actualizando paciente' }
  }

  // ── 7. Marcar pasar_supervisor = "si" en pasar_supervisor_healup ───────────
  try {
    const { error: supError, count } = await (supabase
      .from('pasar_supervisor_healup') as any)
      .update({ pasar_supervisor: 'si', 'numero de veces': '1' }, { count: 'exact' })
      .eq('numero', numero)

    if (supError) throw supError
    results.pasar_supervisor = { ok: true, filas_actualizadas: count ?? null }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en pasar_supervisor_healup:', e?.message)
    results.pasar_supervisor = { ok: false, error: e?.message ?? 'Error marcando pasar_supervisor' }
  }

  // ── 8. Append en la hoja Google Sheets "citas_healup" ──────────────────────
  try {
    const accessToken = await getGoogleAccessToken()
    const range = encodeURIComponent(SHEET_RANGE)
    const url = `${SHEETS_API}/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    // Orden de columnas del subflow: numero, nombre_completo, dni, red_social, Tratamiento(s), fecha_cita
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [[numero, nombre_completo, dniStr, redSocial, tratamientos, inicio_cita]] }),
    })
    if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`)
    results.google_sheets = { ok: true }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en Google Sheets:', e?.message)
    results.google_sheets = { ok: false, error: e?.message ?? 'Error append en Sheets' }
  }

  // ── 9. Avisar a la supervisora (LUCIA) vía Chatwoot ────────────────────────
  try {
    const res = await fetch(CHATWOOT_URL, {
      method:  'POST',
      headers: { 'api_access_token': CHATWOOT_TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content:      `La paciente de nombre: ${igHandle}  ha agendado una cita en ${redSocial}.`,
        message_type: 'outgoing',
        content_type: 'text',
      }),
    })
    if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${await res.text()}`)
    results.aviso_supervisor = { ok: true }
  } catch (e: any) {
    console.error('[calendario-fbig] Error en Chatwoot (LUCIA):', e?.message)
    results.aviso_supervisor = { ok: false, error: e?.message ?? 'Error avisando a supervisora' }
  }

  // ── 10. Generar boleta de consulta (solo si el boleteo está activado) ──────
  try {
    const { data: boleteoSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'healup_boleteo_activo')
      .maybeSingle()

    const boleteoActivo = boleteoSetting?.value === 'true'

    if (!boleteoActivo) {
      results.boleta = { ok: false, skipped: true, motivo: 'Boleteo automático desactivado — actívalo desde Healup → Facturación' }
    } else {
      const boletaResp = await $fetch<any>('/api/pse/boleta-consulta', {
        method: 'POST',
        body: {
          api_key:        'boleta-consulta-alef-2026',
          company_id:     'healup',
          event_id:       results.calendario?.id ?? null,
          client_name,
          client_surname,
          client_dni:     dniStr,
          client_phone:   numero,
        },
      })
      results.boleta = {
        ok:          boletaResp?.success ?? boletaResp?.ok ?? false,
        serie:       boletaResp?.serie,
        numero:      boletaResp?.numero,
        enlace_pdf:  boletaResp?.enlace_pdf ?? boletaResp?.enlace ?? null,
        mensaje_wpp: boletaResp?.mensaje_wpp ?? null,
      }
    }
  } catch (e: any) {
    console.error('[calendario-fbig] Error generando boleta:', e?.message)
    results.boleta = { ok: false, error: e?.message ?? 'Error generando boleta' }
  }

  // ── 11. Construir respuesta final ──────────────────────────────────────────
  const fechaHuman = isoToHumanEs(inicio_cita)
  const pdfLink    = results.boleta?.enlace_pdf ?? 'no disponible'
  // El append a Sheets y el aviso a la supervisora son best-effort: no marcan error global.
  const criticos   = ['google_calendar', 'calendario', 'paciente']
  const hayError   = criticos.some((k) => results[k]?.ok === false)

  const output = {
    ok:               !hayError,
    message:          `Se ha agendado correctamente:\nFecha y hora: ${fechaHuman}\nenlace_pdf: ${pdfLink}`,
    google_calendar:  results.google_calendar,
    calendario:       results.calendario,
    paciente:         results.paciente,
    pasar_supervisor: results.pasar_supervisor,
    google_sheets:    results.google_sheets,
    aviso_supervisor: results.aviso_supervisor,
    boleta:           results.boleta,
    log_id:           logId,
  }

  await updateLog(hayError ? 'partial' : 'success', output)

  console.log(
    `[calendario-fbig] Healup ${redSocial} | ${client_name} ${client_surname} | ${date} ${time}`,
    `| gcal:${results.google_calendar?.ok ? '✅' : '❌'}`,
    `| cal:${results.calendario?.ok ? '✅' : '❌'}`,
    `| pac:${results.paciente?.ok ? '✅' : '❌'}`,
    `| sup:${results.pasar_supervisor?.ok ? '✅' : '❌'}`,
    `| sheet:${results.google_sheets?.ok ? '✅' : '❌'}`,
    `| aviso:${results.aviso_supervisor?.ok ? '✅' : '❌'}`,
    `| boleta:${results.boleta?.ok ? '✅' : '❌'}`,
  )

  return output
})
