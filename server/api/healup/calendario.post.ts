/**
 * POST /api/healup/calendario
 *
 * Endpoint unificado que reemplaza las tools "calendario" + "pacienteswpp" + "Sacar boleta"
 * del agente IA de n8n. Centraliza la lógica, mejora el manejo de errores
 * y loggea cada ejecución en la tabla `agent_tool_logs`.
 *
 * Body esperado (mismo schema que el subflow n8n "ACTIVO agendar heal up whatsapp"):
 * {
 *   api_key:          string,                    — auth
 *   nombre_completo:  string,                    — "julio zumaeta valenzuela"
 *   inicio_cita:      string,                    — ISO 8601: "2026-03-06T17:00:00"
 *   fin_cita:         string,                    — ISO 8601: "2026-03-06T17:30:00"
 *   numerotelefono:   string,                    — "51972619000" o "972619000"
 *   DNI:              string,                    — "12345678"
 *   ID:               number | string,           — ID en PacientesBDwppHEALUP
 *   red_social:       string,                    — "WhatsApp" | "TikTok" | etc.
 *   "tratamiento(s)": string,                    — "Armonización Facial" o "A, B"
 * }
 *
 * Response exitosa:
 * {
 *   ok: true,
 *   message: "Se ha agendado correctamente: ...",
 *   calendario: { id, date, time, client },
 *   paciente:   { updated, id },
 *   boleta:     { ok, serie, numero, enlace_pdf, mensaje_wpp },
 *   log_id:     number
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'
import { avisarNuevaCitaChatwoot } from '~/server/utils/healup-cita-aviso'

const GCAL_API    = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'

const API_KEY = 'healup-calendario-2026'

// ── Helpers de parseo ─────────────────────────────────────────────────────────

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

/** "2026-03-06T17:00:00" → nombre legible "martes 6 de marzo a las 5:00pm" */
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

/**
 * Divide nombre completo en nombre + apellido.
 * Regla: primera palabra = nombre(s), resto = apellidos.
 * Si solo hay una palabra, surname queda vacío.
 */
function splitName(full: string): { name: string; surname: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

/**
 * Parsea tratamiento(s): toma el primero si hay varios separados por coma.
 * Elimina tildes para procedure_id (compatibilidad con la BD).
 */
function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  // Limpia tildes via tabla de reemplazo (sin regex Unicode que rompe el build)
  const mapa: Record<string,string> = {a:'a',e:'e',i:'i',o:'o',u:'u',A:'A',E:'E',I:'I',O:'O',U:'U',n:'n',N:'N'}
  return first.replace(/./g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').trim()
}

/** Limpia el número de teléfono: quita prefijo "51" si tiene 11 dígitos */
function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length === 11 && str.startsWith('51')) return str.slice(2)
  return str
}

// ── Handler principal ─────────────────────────────────────────────────────────

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
        tool_name:   'Calendario',
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
    numerotelefono, DNI, ID, red_social,
  } = body
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

  const results: Record<string, any> = {}

  // ── 4. Crear evento en Google Calendar ────────────────────────────────────
  // Replica exactamente lo que hacía la tool "agendar" del agente n8n
  try {
    const accessToken = await getGoogleAccessToken()
    const calId       = encodeURIComponent(CALENDAR_ID)

    // Peru es UTC-5 — si el ISO no trae zona horaria la añadimos
    const addTZ = (iso: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}-05:00`

    const gcalBody = {
      summary:     nombre_completo,
      description: `Nombre Completo: ${nombre_completo}\nNúmero: ${phone}\nDNI: ${dniStr}`,
      start: { dateTime: addTZ(inicio_cita), timeZone: 'America/Lima' },
      end:   { dateTime: addTZ(fin_cita || inicio_cita), timeZone: 'America/Lima' },
    }

    const res = await fetch(`${GCAL_API}/calendars/${calId}/events`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(gcalBody),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`GCal API ${res.status}: ${errText}`)
    }

    const gcalEvent = await res.json() as any
    results.google_calendar = {
      ok:      true,
      eventId: gcalEvent.id,
      htmlLink: gcalEvent.htmlLink,
      summary:  gcalEvent.summary,
    }
  } catch (e: any) {
    console.error('[calendario] Error en Google Calendar:', e?.message)
    results.google_calendar = { ok: false, error: e?.message ?? 'Error creando evento en GCal' }
  }

  // ── 6. Insertar en healup_calendar_events ─────────────────────────────────
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
        client_phone: phone,
      })
      .select('id')
      .single()

    if (calError) throw calError
    results.calendario = {
      ok:     true,
      id:     calData?.id,
      date,
      time,
      client: `${client_name} ${client_surname}`.trim(),
    }
  } catch (e: any) {
    console.error('[calendario] Error en healup_calendar_events:', e?.message)
    results.calendario = { ok: false, error: e?.message ?? 'Error insertando cita' }
  }

  // ── 7. Upsert en PacientesBDwppHEALUP ────────────────────────────────────
  try {
    const pacPayload: Record<string, any> = {
      nombre:             nombre_completo,
      dni:                dniStr,
      numero:             phone,
      red_social:         red_social ?? 'WhatsApp',
      procedimiento:      tratamientos,
      fecha_agendamiento: inicio_cita,
    }
    // Si viene ID lo usamos para upsert; si no, hacemos insert puro
    if (ID) pacPayload.id = Number(ID)

    const op = ID
      ? (supabase.from('PacientesBDwppHEALUP') as any)
          .upsert(pacPayload, { onConflict: 'id' })
      : (supabase.from('PacientesBDwppHEALUP') as any)
          .insert(pacPayload)

    const { error: pacError } = await op
    if (pacError) throw pacError

    results.paciente = { ok: true, id: ID ?? 'nuevo' }
  } catch (e: any) {
    console.error('[calendario] Error en PacientesBDwppHEALUP:', e?.message)
    results.paciente = { ok: false, error: e?.message ?? 'Error actualizando paciente' }
  }

  // ── 8. Generar boleta de consulta (solo si el boleteo está activado) ───────
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
          client_phone:   phone,
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
    console.error('[calendario] Error generando boleta:', e?.message)
    results.boleta = { ok: false, error: e?.message ?? 'Error generando boleta' }
  }

  // ── 8b. Aviso interno de nueva cita → Chatwoot (best-effort, no marca error) ─
  const avisoChatwoot = await avisarNuevaCitaChatwoot({
    nombre:        nombre_completo,
    dni:           dniStr,
    telefono:      phone,
    tratamiento:   tratamientos,
    inicioCitaIso: inicio_cita,
    canal:         red_social || 'WhatsApp',
  })

  // ── 9. Construir respuesta final ───────────────────────────────────────────
  const fechaHuman = isoToHumanEs(inicio_cita)
  const pdfLink    = results.boleta?.enlace_pdf ?? 'no disponible'
  const hayError   = Object.values(results).some((r: any) => r?.ok === false)

  const output = {
    ok:              !hayError,
    message:         `Se ha agendado correctamente:\nFecha y hora: ${fechaHuman}\nenlace_pdf: ${pdfLink}`,
    google_calendar: results.google_calendar,
    calendario:      results.calendario,
    paciente:        results.paciente,
    boleta:          results.boleta,
    aviso_chatwoot:  avisoChatwoot,
    log_id:          logId,
  }

  await updateLog(hayError ? 'partial' : 'success', output)

  console.log(
    `[calendario] Healup | ${client_name} ${client_surname} | ${date} ${time}`,
    `| gcal:${results.google_calendar?.ok ? '✅' : '❌'}`,
    `| cal:${results.calendario?.ok ? '✅' : '❌'}`,
    `| pac:${results.paciente?.ok ? '✅' : '❌'}`,
    `| boleta:${results.boleta?.ok ? '✅' : '❌'}`,
    `| aviso:${avisoChatwoot?.ok ? '✅' : '❌'}`,
  )

  return output
})
