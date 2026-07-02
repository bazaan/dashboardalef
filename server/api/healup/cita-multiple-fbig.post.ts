/**
 * POST /api/healup/cita-multiple-fbig
 *
 * Versión Instagram/Facebook de la tool "Cita Multiple": agenda una cita para
 * 2 pacientes. Combina la lógica de cita doble (/api/healup/cita-multiple) con
 * los extras de IG/FB (/api/healup/calendario-fbig). Reemplaza el subflow n8n
 * "HEALUP | IG Y FB | tool cita multiple":
 *   1. Crea 1 evento Google Calendar con ambos pacientes en la descripción
 *   2. Inserta 1 fila en healup_calendar_events (paciente 1 principal)
 *   3. Upsert paciente 1 en PacientesBDfbigHEALUP (con ID) + insert paciente 2
 *   4. Marca pasar_supervisor = "si" en pasar_supervisor_healup (por el contacto p1)
 *   5. Append de 2 filas en la hoja Google Sheets "citas_healup"
 *   6. Notifica a la supervisora (LUCIA) vía Chatwoot (cuenta 2, conversación 700)
 *   7. Genera 2 boletas (una por paciente) — solo si healup_boleteo_activo=true
 *   8. Aviso interno de nueva cita doble → Chatwoot (1361 y 8011)
 *   9. Log a agent_tool_logs (tool_name='Cita Multiple FB/IG')
 *
 * Body esperado:
 * {
 *   api_key:                       string,   — auth ("healup-cita-multiple-fbig-2026")
 *   paciente_uno_nombre_completo:  string,
 *   paciente_uno_DNI:              string,
 *   paciente_dos_nombre_completo:  string,
 *   paciente_dos_DNI:              string,
 *   paciente_dos_numero:           string,   — tel paciente 2
 *   numerotelefono:                string,   — PSID de Messenger/IG del contacto (paciente 1)
 *   inicio_cita:                   string,   — ISO 8601
 *   fin_cita:                      string,   — ISO 8601
 *   ID:                            number,   — ID paciente 1 en PacientesBDfbigHEALUP
 *   red_social:                    string,   — "Channel::Instagram" | "Instagram" | "Facebook"
 *   "tratamiento(s)":              string,
 *   nombre_ig:                     string,   — usuario IG/FB (aviso a la supervisora). Opcional
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'
import { avisarNuevaCitaChatwoot } from '~/server/utils/healup-cita-aviso'

const API_KEY     = 'healup-cita-multiple-fbig-2026'
const GCAL_API    = 'https://www.googleapis.com/calendar/v3'
const SHEETS_API  = 'https://sheets.googleapis.com/v4/spreadsheets'
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'

const SHEET_ID    = process.env.GOOGLE_SHEET_CITAS_HEALUP_ID || '1C4qVEgymTANCne2xGQtwOi_ow4tDx1XvxIZ-pHOtCPE'
const SHEET_RANGE = process.env.GOOGLE_SHEET_CITAS_HEALUP_RANGE || 'citas'

const CHATWOOT_URL   = 'https://chats.alef.company/api/v1/accounts/2/conversations/700/messages'
const CHATWOOT_TOKEN = process.env.CHATWOOT_HEALUP_FBIG_TOKEN || '8oLRk3yaKcLoR5zt4KPNtcUy'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoToDateStr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso ?? '')
}

function isoToTimeStr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso?.trim() ?? '')
  return m ? m[1] : '00:00'
}

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

function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  const mapa: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N',
  }
  return first.replace(/[áéíóúÁÉÍÓÚñÑ]/g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
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

// ── Handler ──────────────────────────────────────────────────────────────────

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
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'healup', tool_name: 'Cita Multiple FB/IG', input_data: body, status: 'running',
    }).select('id').single()
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

  // 3. Validación
  const {
    paciente_uno_nombre_completo, paciente_uno_DNI,
    paciente_dos_nombre_completo, paciente_dos_DNI, paciente_dos_numero,
    inicio_cita, fin_cita, numerotelefono, ID, nombre_ig,
  } = body
  const tratamientos: string = body['tratamiento(s)'] ?? body.tratamientos ?? ''
  const redSocial = parseRedSocial(body.red_social)

  if (!paciente_uno_nombre_completo || !paciente_dos_nombre_completo || !inicio_cita) {
    const msg = 'Campos requeridos faltantes: paciente_uno_nombre_completo, paciente_dos_nombre_completo, inicio_cita'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  // 4. Parse datos (en IG/FB los "numero" pueden ser PSID: se guardan tal cual)
  const p1 = splitName(paciente_uno_nombre_completo)
  const p2 = splitName(paciente_dos_nombre_completo)
  const date         = isoToDateStr(inicio_cita)
  const time         = isoToTimeStr(inicio_cita)
  const procedure_id = parseProcedure(tratamientos)
  const numero1      = String(numerotelefono ?? '').trim()
  const numero2      = String(paciente_dos_numero ?? '').trim()
  const dni1         = String(paciente_uno_DNI ?? '')
  const dni2         = String(paciente_dos_DNI ?? '')
  const igHandle     = String(nombre_ig ?? '').trim() || paciente_uno_nombre_completo

  const results: Record<string, any> = {}

  // 5. Google Calendar — 1 evento con ambos pacientes en descripción
  try {
    const accessToken = await getGoogleAccessToken()
    const calId = encodeURIComponent(CALENDAR_ID)
    const addTZ = (iso: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}-05:00`
    const description =
      `Paciente 1:\nNombre: ${paciente_uno_nombre_completo}\nDNI: ${dni1}\nContacto: ${numero1}\n\n` +
      `Paciente 2:\nNombre: ${paciente_dos_nombre_completo}\nDNI: ${dni2}\nTeléfono: ${numero2}\n\n` +
      `Red social: ${redSocial}\nTratamiento(s): ${tratamientos}`
    const gcalBody = {
      summary: `Cita de 2 pacientes — ${p1.name} & ${p2.name}`,
      description,
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
    console.error('[cita-multiple-fbig] Error GCal:', e?.message)
    results.google_calendar = { ok: false, error: e?.message }
  }

  // 6. healup_calendar_events — 1 fila (paciente 1 principal, paciente 2 en notas)
  try {
    const { data: calData, error: calError } = await (supabase.from('healup_calendar_events') as any)
      .insert({
        date, time, subject: 'CITA IA — 2 pacientes', procedure_id,
        client_name: p1.name, client_surname: p1.surname, client_dni: dni1, client_phone: numero1,
        notes: `Paciente 2: ${paciente_dos_nombre_completo} (DNI ${dni2}, tel ${numero2})`,
      })
      .select('id').single()
    if (calError) throw calError
    results.calendario = { ok: true, id: calData?.id, date, time, pacientes: [paciente_uno_nombre_completo, paciente_dos_nombre_completo] }
  } catch (e: any) {
    console.error('[cita-multiple-fbig] Error calendario:', e?.message)
    results.calendario = { ok: false, error: e?.message }
  }

  // 7. PacientesBDfbigHEALUP — Paciente 1 (upsert con ID) + Paciente 2 (insert)
  results.pacientes = { paciente_uno: {}, paciente_dos: {} }

  try {
    const pac1: Record<string, any> = {
      nombre: paciente_uno_nombre_completo, dni: dni1, numero: numero1,
      red_social: redSocial, procedimiento: tratamientos, fecha_agendamiento: inicio_cita,
    }
    if (ID) pac1.id = Number(ID)
    const op1 = ID
      ? (supabase.from('PacientesBDfbigHEALUP') as any).upsert(pac1, { onConflict: 'id' })
      : (supabase.from('PacientesBDfbigHEALUP') as any).insert(pac1)
    const { error: e1 } = await op1
    if (e1) throw e1
    results.pacientes.paciente_uno = { ok: true, id: ID ?? 'nuevo' }
  } catch (e: any) {
    results.pacientes.paciente_uno = { ok: false, error: e?.message }
  }

  try {
    const pac2 = {
      nombre: paciente_dos_nombre_completo, dni: dni2, numero: numero2,
      red_social: redSocial, procedimiento: tratamientos, fecha_agendamiento: inicio_cita,
    }
    const { data: p2Data, error: e2 } = await (supabase.from('PacientesBDfbigHEALUP') as any)
      .insert(pac2).select('id').single()
    if (e2) throw e2
    results.pacientes.paciente_dos = { ok: true, id: p2Data?.id }
  } catch (e: any) {
    results.pacientes.paciente_dos = { ok: false, error: e?.message }
  }

  // 8. Marcar pasar_supervisor = "si" (por el contacto del paciente 1)
  try {
    const { error: supError, count } = await (supabase.from('pasar_supervisor_healup') as any)
      .update({ pasar_supervisor: 'si', 'numero de veces': '1' }, { count: 'exact' })
      .eq('numero', numero1)
    if (supError) throw supError
    results.pasar_supervisor = { ok: true, filas_actualizadas: count ?? null }
  } catch (e: any) {
    console.error('[cita-multiple-fbig] Error pasar_supervisor:', e?.message)
    results.pasar_supervisor = { ok: false, error: e?.message }
  }

  // 9. Append de 2 filas en la hoja Google Sheets "citas_healup"
  try {
    const accessToken = await getGoogleAccessToken()
    const range = encodeURIComponent(SHEET_RANGE)
    const url = `${SHEETS_API}/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    // Columnas: numero, nombre_completo, dni, red_social, Tratamiento(s), fecha_cita
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [
          [numero1, paciente_uno_nombre_completo, dni1, redSocial, tratamientos, inicio_cita],
          [numero2, paciente_dos_nombre_completo, dni2, redSocial, tratamientos, inicio_cita],
        ],
      }),
    })
    if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`)
    results.google_sheets = { ok: true }
  } catch (e: any) {
    console.error('[cita-multiple-fbig] Error Sheets:', e?.message)
    results.google_sheets = { ok: false, error: e?.message }
  }

  // 10. Avisar a la supervisora (LUCIA) vía Chatwoot
  try {
    const res = await fetch(CHATWOOT_URL, {
      method: 'POST',
      headers: { 'api_access_token': CHATWOOT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${igHandle} ha agendado una cita DOBLE en ${redSocial} (${paciente_uno_nombre_completo} y ${paciente_dos_nombre_completo}).`,
        message_type: 'outgoing', content_type: 'text',
      }),
    })
    if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${await res.text()}`)
    results.aviso_supervisor = { ok: true }
  } catch (e: any) {
    console.error('[cita-multiple-fbig] Error Chatwoot (LUCIA):', e?.message)
    results.aviso_supervisor = { ok: false, error: e?.message }
  }

  // 11. Boletas — 1 por paciente (solo si healup_boleteo_activo=true)
  try {
    const { data: boleteoSetting } = await supabase
      .from('app_settings').select('value').eq('key', 'healup_boleteo_activo').maybeSingle()
    const boleteoActivo = boleteoSetting?.value === 'true'
    if (!boleteoActivo) {
      results.boletas = { ok: false, skipped: true, motivo: 'Boleteo automático desactivado en Healup → Facturación' }
    } else {
      const boletas = await Promise.all([
        $fetch<any>('/api/pse/boleta-consulta', {
          method: 'POST',
          body: {
            api_key: 'boleta-consulta-alef-2026', company_id: 'healup', event_id: results.calendario?.id ?? null,
            client_name: p1.name, client_surname: p1.surname, client_dni: dni1, client_phone: numero1,
          },
        }).catch(e => ({ error: e?.message })),
        $fetch<any>('/api/pse/boleta-consulta', {
          method: 'POST',
          body: {
            api_key: 'boleta-consulta-alef-2026', company_id: 'healup', event_id: results.calendario?.id ?? null,
            client_name: p2.name, client_surname: p2.surname, client_dni: dni2, client_phone: numero2,
          },
        }).catch(e => ({ error: e?.message })),
      ])
      results.boletas = {
        ok: !!(boletas[0]?.success || boletas[0]?.ok) && !!(boletas[1]?.success || boletas[1]?.ok),
        paciente_uno: { serie: boletas[0]?.serie, numero: boletas[0]?.numero, enlace_pdf: boletas[0]?.enlace_pdf ?? boletas[0]?.enlace, error: boletas[0]?.error },
        paciente_dos: { serie: boletas[1]?.serie, numero: boletas[1]?.numero, enlace_pdf: boletas[1]?.enlace_pdf ?? boletas[1]?.enlace, error: boletas[1]?.error },
      }
    }
  } catch (e: any) {
    results.boletas = { ok: false, error: e?.message }
  }

  // 11b. Aviso interno de nueva cita doble → Chatwoot (best-effort)
  const avisoChatwoot = await avisarNuevaCitaChatwoot({
    titulo: 'Nueva cita DOBLE agendada — HealUp',
    nombre: paciente_uno_nombre_completo, dni: dni1, telefono: numero1,
    tratamiento: tratamientos, inicioCitaIso: inicio_cita, canal: redSocial,
    lineasExtra: [
      '',
      `👥 *Paciente 2:* ${paciente_dos_nombre_completo}`,
      ...(dni2 ? [`🪪 *DNI 2:* ${dni2}`] : []),
      ...(numero2 ? [`📞 *Teléfono 2:* ${numero2}`] : []),
      ...(igHandle && igHandle !== paciente_uno_nombre_completo ? [`📸 *Usuario:* ${igHandle}`] : []),
    ],
  })

  // 12. Respuesta final (Sheets/supervisor/boleta son best-effort: no marcan error global)
  const fechaHuman = isoToHumanEs(inicio_cita)
  const pdf1 = results.boletas?.paciente_uno?.enlace_pdf
  const pdf2 = results.boletas?.paciente_dos?.enlace_pdf
  const hayError = [
    results.google_calendar?.ok, results.calendario?.ok,
    results.pacientes?.paciente_uno?.ok, results.pacientes?.paciente_dos?.ok,
  ].some(v => v === false)

  const output = {
    ok: !hayError,
    message: `Cita doble agendada:\nFecha: ${fechaHuman}\nPaciente 1: ${paciente_uno_nombre_completo}${pdf1 ? '\nBoleta 1: ' + pdf1 : ''}\nPaciente 2: ${paciente_dos_nombre_completo}${pdf2 ? '\nBoleta 2: ' + pdf2 : ''}`,
    google_calendar: results.google_calendar,
    calendario: results.calendario,
    pacientes: results.pacientes,
    pasar_supervisor: results.pasar_supervisor,
    google_sheets: results.google_sheets,
    aviso_supervisor: results.aviso_supervisor,
    boletas: results.boletas,
    aviso_chatwoot: avisoChatwoot,
    log_id: logId,
  }

  await updateLog(hayError ? 'partial' : 'success', output)

  console.log(
    `[cita-multiple-fbig] Healup ${redSocial} | ${p1.name}+${p2.name} | ${date} ${time}`,
    `| gcal:${results.google_calendar?.ok ? '✅' : '❌'}`,
    `| cal:${results.calendario?.ok ? '✅' : '❌'}`,
    `| p1:${results.pacientes?.paciente_uno?.ok ? '✅' : '❌'}`,
    `| p2:${results.pacientes?.paciente_dos?.ok ? '✅' : '❌'}`,
    `| sup:${results.pasar_supervisor?.ok ? '✅' : '❌'}`,
    `| sheet:${results.google_sheets?.ok ? '✅' : '❌'}`,
    `| boletas:${results.boletas?.skipped ? 'OFF' : results.boletas?.ok ? '✅' : '❌'}`,
  )

  return output
})
