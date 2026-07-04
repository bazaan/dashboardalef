/**
 * Lógica compartida de las tools "Cita Múltiple" de Healup (WhatsApp, IG/FB, TikTok).
 *
 * NUEVO formato (hasta 4 pacientes, cada uno INDEPENDIENTE con su propio horario,
 * cabina y tratamiento):
 * {
 *   pacienteN_nombre_completo, pacienteN_DNI, pacienteN_celular,
 *   pacienteN_tratamiento, pacienteN_tipo_cabina (number 1|2),
 *   pacienteN_inicio_cita (ISO), pacienteN_fin_cita (ISO),     // N = 1..4
 *   ID, red_social
 * }
 *
 * Comportamiento: por CADA paciente presente crea, de forma independiente:
 *   1. Un evento propio en Google Calendar (a su fecha/hora/cabina).
 *   2. Una fila propia en healup_calendar_events (con su cabina).
 *   3. Una fila propia en la tabla de pacientes (con su tipo_cabina).
 *   4. Su boleta de consulta (si el boleteo automático está activo).
 * Extras IG/FB: marca pasar_supervisor, append a Google Sheets (1 fila x paciente)
 * y aviso a la supervisora (LUCIA). Aviso interno resumen a Chatwoot (1361/8011).
 * Todo tolerante a fallos parciales; log en agent_tool_logs.
 *
 * IMPORTANTE (migración): las tablas PacientesBDwpp/fbig/tiktokHEALUP necesitan una
 * columna nueva `tipo_cabina`. El insert es tolerante: si la columna aún no existe,
 * guarda al paciente igual (sin tipo_cabina) y lo reporta en el log.
 */

import type { H3Event } from 'h3'
import { readBody, createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getGoogleAccessToken } from '~/server/utils/google-auth'
import { avisarNuevaCitaChatwoot } from '~/server/utils/healup-cita-aviso'

const GCAL_API    = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID_HEALUP || 'healupaestheticlab@gmail.com'
const SHEETS_API  = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEET_ID    = process.env.GOOGLE_SHEET_CITAS_HEALUP_ID || '1C4qVEgymTANCne2xGQtwOi_ow4tDx1XvxIZ-pHOtCPE'
const SHEET_RANGE = process.env.GOOGLE_SHEET_CITAS_HEALUP_RANGE || 'citas'
const CHATWOOT_URL   = 'https://chats.alef.company/api/v1/accounts/2/conversations/700/messages'
const CHATWOOT_TOKEN = process.env.CHATWOOT_HEALUP_FBIG_TOKEN || '8oLRk3yaKcLoR5zt4KPNtcUy'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** "2026-06-24T17:00:00" → "24-06-2026" */
function isoToDateStr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || '')
}

/** "2026-06-24T17:00:00" → "17:00" */
function isoToTimeStr(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec((iso || '').trim())
  return m ? m[1] : '00:00'
}

/** Zona Lima si el ISO viene naive. */
function addTZ(iso: string): string {
  const s = (iso || '').trim()
  return /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}-05:00`
}

/** +N minutos a un ISO naive → ISO naive (para fin_cita si falta). */
function addMinutesISO(iso: string, mins: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec((iso || '').trim())
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  d.setMinutes(d.getMinutes() + mins)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

/** "24-06-2026 5:00 p. m." legible (Lima). */
function friendly(iso: string): string {
  try {
    const s = (iso || '').trim()
    const withTZ = /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}-05:00`
    return new Date(withTZ).toLocaleString('es-PE', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Lima',
    })
  } catch { return iso }
}

function splitName(full: string): { name: string; surname: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

function parseProcedure(raw: string): string {
  if (!raw) return ''
  const first = raw.split(',')[0].trim()
  const mapa: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N' }
  return first.replace(/[áéíóúÁÉÍÓÚñÑ]/g, (c) => mapa[c] ?? c).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  return str.length === 11 && str.startsWith('51') ? str.slice(2) : str
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

/** número de cabina (1|2) → 'cabina1' | 'cabina2' (formato de healup_calendar_events). */
function cabinaStr(tipo: any): string {
  return String(tipo ?? '').trim() === '2' || Number(tipo) === 2 ? 'cabina2' : 'cabina1'
}

interface Paciente {
  idx: number
  nombre: string
  dni: string
  celular: string
  tratamiento: string
  tipoCabina: number
  cabina: string
  inicio: string
  fin: string
  date: string
  time: string
}

export interface CitaMultipleOpts {
  apiKey: string
  toolName: string          // 'Cita Multiple' | 'Cita Multiple FB/IG' | 'Cita Multiple TikTok'
  pacientesTable: string    // 'PacientesBDwppHEALUP' | 'PacientesBDfbigHEALUP' | 'PacientesBDtiktokHEALUP'
  canal: 'whatsapp' | 'fbig' | 'tiktok'
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function procesarCitaMultiple(event: H3Event, opts: CitaMultipleOpts) {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== opts.apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs')
      .insert({ company_id: 'healup', tool_name: opts.toolName, input_data: body, status: 'running' })
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

  // 3. red_social del canal
  const redSocial = opts.canal === 'fbig'
    ? parseRedSocial(body?.red_social)
    : (String(body?.red_social ?? '').trim() || (opts.canal === 'tiktok' ? 'Tiktok' : 'WhatsApp'))
  const ID = body?.ID

  // 4. Extraer los pacientes presentes (1..4)
  const pacientes: Paciente[] = []
  for (let i = 1; i <= 4; i++) {
    const nombre = String(body?.[`paciente${i}_nombre_completo`] ?? '').trim()
    const inicio = String(body?.[`paciente${i}_inicio_cita`] ?? '').trim()
    if (!nombre && !inicio) continue                       // paciente ausente
    const fin = String(body?.[`paciente${i}_fin_cita`] ?? '').trim() || addMinutesISO(inicio, 30)
    const tipoCabina = Number(body?.[`paciente${i}_tipo_cabina`] ?? 1) === 2 ? 2 : 1
    const celularRaw = String(body?.[`paciente${i}_celular`] ?? '').trim()
    pacientes.push({
      idx: i,
      nombre,
      dni: String(body?.[`paciente${i}_DNI`] ?? '').trim(),
      celular: opts.canal === 'fbig' ? celularRaw : normalizePhone(celularRaw),
      tratamiento: String(body?.[`paciente${i}_tratamiento`] ?? '').trim(),
      tipoCabina,
      cabina: cabinaStr(tipoCabina),
      inicio,
      fin,
      date: isoToDateStr(inicio),
      time: isoToTimeStr(inicio),
    })
  }

  if (pacientes.length === 0) {
    const msg = 'No se recibió ningún paciente (paciente1_nombre_completo / paciente1_inicio_cita vacíos)'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  // 5. Token de Google (una sola vez)
  let accessToken: string | null = null
  try { accessToken = await getGoogleAccessToken() } catch (e: any) {
    console.error(`[${opts.toolName}] No se pudo obtener token Google:`, e?.message)
  }
  const calId = encodeURIComponent(CALENDAR_ID)

  // 6. Procesar cada paciente de forma independiente
  const resultados: any[] = []
  const boleteoActivo = await (async () => {
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'healup_boleteo_activo').maybeSingle()
      return data?.value === 'true'
    } catch { return false }
  })()

  for (const p of pacientes) {
    const r: any = { paciente: p.idx, nombre: p.nombre, fecha: p.date, hora: p.time, cabina: p.cabina }
    const { name, surname } = splitName(p.nombre)
    const procedure_id = parseProcedure(p.tratamiento)

    // 6a. Google Calendar (evento propio)
    if (accessToken) {
      try {
        const gcalBody = {
          summary: `${p.nombre}${p.tratamiento ? ` — ${p.tratamiento}` : ''}`,
          description: `Nombre Completo: ${p.nombre}\nDNI: ${p.dni}\nNúmero: ${p.celular}\n` +
            `Tratamiento: ${p.tratamiento}\nCabina: ${p.tipoCabina}\nRed social: ${redSocial}`,
          start: { dateTime: addTZ(p.inicio), timeZone: 'America/Lima' },
          end:   { dateTime: addTZ(p.fin), timeZone: 'America/Lima' },
        }
        const res = await fetch(`${GCAL_API}/calendars/${calId}/events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(gcalBody),
        })
        if (!res.ok) throw new Error(`GCal ${res.status}: ${await res.text()}`)
        const ev = await res.json() as any
        r.google_calendar = { ok: true, eventId: ev.id }
      } catch (e: any) { r.google_calendar = { ok: false, error: e?.message } }
    } else {
      r.google_calendar = { ok: false, error: 'Sin token de Google' }
    }

    // 6b. healup_calendar_events (fila propia con su cabina)
    try {
      const { data, error } = await (supabase.from('healup_calendar_events') as any).insert({
        date: p.date, time: p.time, subject: 'CITA IA', procedure_id,
        client_name: name, client_surname: surname, client_dni: p.dni, client_phone: p.celular,
        cabina: p.cabina,
      }).select('id').single()
      if (error) throw error
      r.calendario = { ok: true, id: data?.id }
    } catch (e: any) { r.calendario = { ok: false, error: e?.message } }

    // 6c. Tabla de pacientes (fila propia con tipo_cabina; tolerante si la columna no existe)
    try {
      const core: Record<string, any> = {
        nombre: p.nombre, dni: p.dni, numero: p.celular, red_social: redSocial,
        procedimiento: p.tratamiento, fecha_agendamiento: addTZ(p.inicio),
      }
      const full = { ...core, agendamiento: 'IA', tipo_cabina: p.tipoCabina }
      // El primer paciente puede venir con ID (lead ya captado) → upsert; el resto insert.
      const doOp = (payload: Record<string, any>) =>
        (p.idx === 1 && ID)
          ? (supabase.from(opts.pacientesTable) as any).upsert({ ...payload, id: Number(ID) }, { onConflict: 'id' })
          : (supabase.from(opts.pacientesTable) as any).insert(payload)
      let { error } = await doOp(full)
      let tipoGuardado = true
      if (error) {                                  // reintento con campos seguros (por si falta tipo_cabina/agendamiento)
        const retry = await doOp(core)
        error = retry.error; tipoGuardado = false
      }
      if (error) throw error
      r.paciente_bd = { ok: true, tipo_cabina_guardado: tipoGuardado }
    } catch (e: any) { r.paciente_bd = { ok: false, error: e?.message } }

    // 6d. Boleta (si el boleteo está activo)
    if (boleteoActivo) {
      try {
        const b = await $fetch<any>('/api/pse/boleta-consulta', {
          method: 'POST',
          body: {
            api_key: 'boleta-consulta-alef-2026', company_id: 'healup',
            event_id: r.calendario?.id ?? null,
            client_name: name, client_surname: surname, client_dni: p.dni, client_phone: p.celular,
          },
        })
        r.boleta = { ok: b?.success ?? b?.ok ?? false, serie: b?.serie, numero: b?.numero, enlace_pdf: b?.enlace_pdf ?? b?.enlace }
      } catch (e: any) { r.boleta = { ok: false, error: e?.message } }
    } else {
      r.boleta = { ok: false, skipped: true }
    }

    resultados.push(r)
  }

  // 7. Extras IG/FB
  const extras: any = {}
  if (opts.canal === 'fbig') {
    const p1 = pacientes[0]
    // 7a. pasar_supervisor por el contacto (paciente 1)
    try {
      const { error, count } = await (supabase.from('pasar_supervisor_healup') as any)
        .update({ pasar_supervisor: 'si', 'numero de veces': '1' }, { count: 'exact' })
        .eq('numero', p1.celular)
      if (error) throw error
      extras.pasar_supervisor = { ok: true, filas: count ?? null }
    } catch (e: any) { extras.pasar_supervisor = { ok: false, error: e?.message } }

    // 7b. Google Sheets: 1 fila por paciente
    if (accessToken) {
      try {
        const range = encodeURIComponent(SHEET_RANGE)
        const url = `${SHEETS_API}/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
        const values = pacientes.map(p => [p.celular, p.nombre, p.dni, redSocial, p.tratamiento, p.inicio])
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        })
        if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`)
        extras.google_sheets = { ok: true, filas: values.length }
      } catch (e: any) { extras.google_sheets = { ok: false, error: e?.message } }
    }

    // 7c. Aviso a supervisora (LUCIA)
    try {
      const lista = pacientes.map((p, i) => `${i + 1}. ${p.nombre} — ${friendly(p.inicio)} — Cabina ${p.tipoCabina}`).join('\n')
      const res = await fetch(CHATWOOT_URL, {
        method: 'POST',
        headers: { 'api_access_token': CHATWOOT_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `Se agendaron ${pacientes.length} citas en ${redSocial}:\n${lista}`,
          message_type: 'outgoing', content_type: 'text',
        }),
      })
      if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${await res.text()}`)
      extras.aviso_supervisor = { ok: true }
    } catch (e: any) { extras.aviso_supervisor = { ok: false, error: e?.message } }
  }

  // 8. Aviso interno resumen → Chatwoot (1361 / 8011)
  const p1 = pacientes[0]
  const lineasExtra = ['', `👥 *Pacientes agendados (${pacientes.length}):*`,
    ...pacientes.map((p, i) => `${i + 1}. ${p.nombre} — ${friendly(p.inicio)} — Cabina ${p.tipoCabina}${p.tratamiento ? ` — ${p.tratamiento}` : ''}`)]
  const avisoChatwoot = await avisarNuevaCitaChatwoot({
    titulo: `Nueva cita MÚLTIPLE — HealUp (${pacientes.length} pacientes)`,
    nombre: p1.nombre, dni: p1.dni, telefono: p1.celular, tratamiento: p1.tratamiento,
    inicioCitaIso: p1.inicio, canal: redSocial, lineasExtra,
  })

  // 9. Respuesta + log
  const okCriticos = resultados.every(r => r.calendario?.ok !== false && r.paciente_bd?.ok !== false)
  const fechas = resultados.map(r => `${r.nombre}: ${friendly(pacientes.find(p => p.idx === r.paciente)!.inicio)} (cab.${r.cabina.slice(-1)})`)
  const output = {
    ok: okCriticos,
    message: `Se agendaron ${pacientes.length} citas:\n` + fechas.join('\n'),
    total_pacientes: pacientes.length,
    pacientes: resultados,
    extras: opts.canal === 'fbig' ? extras : undefined,
    aviso_chatwoot: avisoChatwoot,
    log_id: logId,
  }
  await updateLog(okCriticos ? 'success' : 'partial', output)

  console.log(`[${opts.toolName}] ${pacientes.length} pacientes | `,
    resultados.map(r => `${r.nombre}(${r.date} ${r.time} ${r.cabina}) cal:${r.calendario?.ok ? '✅' : '❌'} pac:${r.paciente_bd?.ok ? '✅' : '❌'}`).join(' | '))

  return output
}
