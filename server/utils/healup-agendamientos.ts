/**
 * Lógica compartida del envío diario de pacientes agendados a n8n.
 *
 * Fusiona DOS fuentes para que el reporte muestre "todo el registro de las citas
 * de hoy" y no solo lo que el staff cargó a mano:
 *   1. `healup_calendar_events` — el calendario REAL del dashboard, filtrado por
 *      FECHA DE LA CITA = hoy (Lima). Trae DNI/teléfono reales para las citas
 *      agendadas por el agente IA (subject "CITA IA") y la fecha/hora exacta
 *      tal como está puesta en el calendario.
 *   2. `PacientesBDwppHEALUP` / `PacientesBDfbigHEALUP` / `PacientesBDtiktokHEALUP`
 *      — registros creados HOY (por `created_at`), como ya hacía este archivo.
 *      Suele ser el mismo universo que (1) para las citas de IA, pero también
 *      incluye altas manuales del staff que a veces nunca llegan al calendario.
 *
 * Se deduplica por identidad de persona (DNI, o teléfono, o nombre normalizado
 * — sin exigir que coincida la hora, a diferencia de "Citas de Mañana": aquí el
 * objetivo es no contar dos veces a la misma persona, no distinguir citas
 * futuras). Cuando hay match, la fecha/hora del CALENDARIO manda (es la fuente
 * de verdad que pidió el cliente) y se completan los campos que falten desde la
 * otra fuente.
 *
 * Usada por:
 *   GET  /api/healup/cron-agendamientos-diarios   (disparado por Vercel Cron)
 *   POST /api/healup/agendamientos-diarios-trigger (disparo manual desde UI)
 */

import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

const LIMA_OFFSET_HOURS = -5  // Lima es UTC-5 todo el año (no DST)

export interface AgendamientosResult {
  fecha_lima: string
  status: 'success' | 'error' | 'empty'
  pacientes_count: number
  pacientes_wpp_count: number
  pacientes_fbig_count: number
  pacientes_tiktok_count: number
  http_status: number | null
  error_message: string | null
  duracion_ms: number
  log_id: number | null
  webhook_configurado: boolean
}

interface CitaHoy {
  nombre: string
  dni: string
  numero: string
  instagram_handle: string
  procedimiento: string
  fecha_agendamiento: string  // ISO con offset -05:00
  agendamiento: string | null // 'IA' | 'Agente' | null
  _canal: string | null       // whatsapp | facebook_instagram | tiktok | calendario | null
  _origen_tabla: string | null
  _fuentes: string[]
  _dni_key: string
  _tel_key: string
  _name_key: string
}

/** Devuelve YYYY-MM-DD del día Lima actual + ventana en UTC ISO */
export function getLimaTodayWindow() {
  const nowUtc = new Date()
  const limaMs = nowUtc.getTime() + LIMA_OFFSET_HOURS * 3600 * 1000
  const lima = new Date(limaMs)
  const yyyy = lima.getUTCFullYear()
  const mm = String(lima.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(lima.getUTCDate()).padStart(2, '0')
  const fechaLima = `${yyyy}-${mm}-${dd}`
  // Inicio del día Lima en UTC: 00:00 Lima = 05:00 UTC mismo día.
  const inicioISO = `${fechaLima}T05:00:00.000Z`
  const finISO = nowUtc.toISOString()
  return { fechaLima, inicioISO, finISO }
}

/* ─── Helpers de normalización (mismo criterio que healup-citas-manana.ts) ─── */

function normalizeName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function onlyDigits(s: string): string {
  return String(s || '').replace(/\D/g, '')
}

function normalizePhone(phone: string): string {
  const digits = onlyDigits(phone)
  if (digits.length === 11 && digits.startsWith('51')) return digits.substring(2)
  return digits
}

/** Descarta placeholders vacíos ("0", "null", "-", string vacío). */
function limpiarPlaceholder(v: unknown): string {
  const s = String(v ?? '').trim()
  return (s === '0' || s.toLowerCase() === 'null' || s === '-') ? '' : s
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

/* ─── Fuente 1: healup_calendar_events (registradas HOY en el calendario) ─
 * Filtra por `created_at` (cuándo se cargó la fila al calendario), NO por
 * `date` (para cuándo es la cita). Antes filtraba por fecha de la cita, lo
 * que hacía que una cita cargada hace días (ej. vía la tool de TikTok) pero
 * agendada PARA hoy apareciera en el reporte de hoy en vez de en el del día
 * que realmente se cargó — exactamente lo que el cliente reportó con el caso
 * de Maylin Cesar Casavilca (cargada el 14, cita para el 16, salió en el
 * reporte del 16 en vez del 14). El campo `fecha_agendamiento` sigue
 * mostrando la fecha real de la cita — sólo cambió el criterio de filtro. */

async function fetchCalendarioHoy(event: H3Event, inicioISO: string, finISO: string): Promise<CitaHoy[]> {
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('healup_calendar_events')
    .select('id, date, time, client_name, client_surname, client_phone, client_dni, subject, description, procedure_id, created_at')
    .gte('created_at', inicioISO)
    .lte('created_at', finISO)

  if (error) throw new Error(`Supabase healup_calendar_events: ${error.message}`)

  const { data: procs } = await supabase.from('healup_procedures').select('id, name')
  const catalogo = procs || []

  return (data || [])
    .filter((e: any) => {
      // Descarta ruido no-paciente (ej. eventos auto-importados de Google Calendar
      // como reservas de hotel) que no tienen nombre de cliente en absoluto.
      const tieneNombre = Boolean((e.client_name || '').trim() || (e.client_surname || '').trim())
      const esAutoImportGCal = /Auto-importado desde Google Calendar/i.test(e.description || '')
      return tieneNombre && !esAutoImportGCal
    })
    .map((e: any) => {
      const proc = e.procedure_id
        ? catalogo.find((p: any) => Number(p.id) === Number(e.procedure_id))
        : null
      const nombre = `${e.client_name || ''} ${e.client_surname || ''}`.replace(/\bnull\b/gi, '').trim()
      const fechaISO = toISODate(e.date || '')
      const hora = (e.time || '00:00:00').substring(0, 8)
      const dni = limpiarPlaceholder(e.client_dni)
      const numero = limpiarPlaceholder(e.client_phone)
      return {
        nombre,
        dni,
        numero,
        instagram_handle: '',
        procedimiento: proc?.name || e.subject || '',
        fecha_agendamiento: `${fechaISO}T${hora}-05:00`,
        agendamiento: e.subject === 'CITA IA' ? 'IA' : null,
        _canal: 'calendario',
        _origen_tabla: 'healup_calendar_events',
        _fuentes: ['calendario'],
        _dni_key: onlyDigits(dni),
        _tel_key: normalizePhone(numero),
        _name_key: normalizeName(nombre)
      } as CitaHoy
    })
}

/* ─── Fuente 2: PacientesBD*HEALUP (registros creados HOY) ────────── */

async function fetchPacientesCreadosHoy(event: H3Event, inicioISO: string, finISO: string) {
  const supabase = serverSupabaseServiceRole(event)
  const tablas = [
    { tabla: 'PacientesBDwppHEALUP', canal: 'whatsapp' },
    { tabla: 'PacientesBDfbigHEALUP', canal: 'facebook_instagram' },
    { tabla: 'PacientesBDtiktokHEALUP', canal: 'tiktok' }
  ]

  const pacientesPorCanal: Record<string, CitaHoy[]> = {
    whatsapp: [],
    facebook_instagram: [],
    tiktok: []
  }
  const errorsByTabla: Record<string, string> = {}

  await Promise.all(
    tablas.map(async ({ tabla, canal }) => {
      try {
        const { data, error } = await supabase
          .from(tabla)
          .select('*')
          .gte('created_at', inicioISO)
          .lte('created_at', finISO)
          .order('created_at', { ascending: true })

        if (error) {
          errorsByTabla[tabla] = error.message
          return
        }
        pacientesPorCanal[canal] = (data || []).map((p: any) => {
          const nombre = (p.nombre && p.nombre !== 'null') ? String(p.nombre).trim() : ''
          const dni = limpiarPlaceholder(p.dni)
          const numero = limpiarPlaceholder(p.numero)
          const instagram = limpiarPlaceholder(p.instagram_handle)
          return {
            nombre,
            dni,
            numero,
            instagram_handle: instagram,
            procedimiento: p.procedimiento || '',
            fecha_agendamiento: p.fecha_agendamiento || '',
            agendamiento: p.agendamiento || null,
            _canal: canal,
            _origen_tabla: tabla,
            _fuentes: ['pacientes'],
            _dni_key: onlyDigits(dni),
            _tel_key: normalizePhone(numero),
            _name_key: normalizeName(nombre)
          } as CitaHoy
        })
      } catch (e: any) {
        errorsByTabla[tabla] = e?.message || String(e)
      }
    })
  )

  return { pacientesPorCanal, errorsByTabla }
}

/* ─── Dedup / merge (identidad de persona, sin exigir misma hora) ───
 * Solo se fusiona CRUZANDO fuentes (una cita de calendario con un registro de
 * Pacientes que sea la misma persona). Dos registros que sean AMBOS de
 * Pacientes (ej. la misma persona cargada dos veces a horas distintas) NUNCA
 * se fusionan entre sí — podrían ser dos citas reales distintas, y perder una
 * por asumir que es un duplicado sería peor que mostrarla de más.
 */

function esMismaPersona(a: CitaHoy, b: CitaHoy): boolean {
  if (a._dni_key && b._dni_key && a._dni_key === b._dni_key) return true
  if (a._tel_key && b._tel_key && a._tel_key === b._tel_key) return true
  if (a._name_key && b._name_key && a._name_key === b._name_key) return true
  return false
}

function mergeInto(base: CitaHoy, extra: CitaHoy): CitaHoy {
  const nombre = extra.nombre.length > base.nombre.length ? extra.nombre : base.nombre
  return {
    nombre,
    dni: base.dni || extra.dni,
    numero: base.numero || extra.numero,
    instagram_handle: base.instagram_handle || extra.instagram_handle,
    procedimiento: base.procedimiento || extra.procedimiento,
    // La fecha del CALENDARIO manda: `base` siempre viene del calendario en
    // este flujo, así que su fecha nunca se pisa con la de Pacientes.
    fecha_agendamiento: base.fecha_agendamiento || extra.fecha_agendamiento,
    agendamiento: base.agendamiento || extra.agendamiento,
    _canal: base._canal || extra._canal,
    _origen_tabla: base._origen_tabla || extra._origen_tabla,
    _fuentes: Array.from(new Set([...base._fuentes, ...extra._fuentes])),
    _dni_key: base._dni_key || extra._dni_key,
    _tel_key: base._tel_key || extra._tel_key,
    _name_key: normalizeName(nombre)
  }
}

function dedup(calendarioCitas: CitaHoy[], pacientes: CitaHoy[]): { merged: CitaHoy[]; duplicados: number } {
  const merged: CitaHoy[] = calendarioCitas.map(c => ({ ...c }))
  let duplicados = 0
  for (const p of pacientes) {
    const idx = merged.findIndex(m => m._fuentes.includes('calendario') && esMismaPersona(m, p))
    if (idx >= 0) {
      merged[idx] = mergeInto(merged[idx], p)
      duplicados++
    } else {
      merged.push({ ...p })
    }
  }
  return { merged, duplicados }
}

/**
 * Ejecuta el envío: consulta el calendario (citas reales de hoy) + los pacientes
 * creados hoy en las 3 tablas, fusiona por identidad de persona, POSTea el
 * payload a n8n y guarda un log en `healup_agendamiento_diario_logs`.
 */
export async function ejecutarEnvioAgendamientos(
  event: H3Event,
  opts: { origen: 'cron' | 'manual'; triggered_by_email?: string | null }
): Promise<AgendamientosResult> {
  const inicio = Date.now()
  const supabase = serverSupabaseServiceRole(event)

  const { fechaLima, inicioISO, finISO } = getLimaTodayWindow()

  let calendarioCitas: CitaHoy[] = []
  let calendarioError: string | null = null
  let pacientesPorCanal: Record<string, CitaHoy[]> = { whatsapp: [], facebook_instagram: [], tiktok: [] }
  let errorsByTabla: Record<string, string> = {}

  const [calRes, pacRes] = await Promise.allSettled([
    fetchCalendarioHoy(event, inicioISO, finISO),
    fetchPacientesCreadosHoy(event, inicioISO, finISO)
  ])
  if (calRes.status === 'fulfilled') calendarioCitas = calRes.value
  else calendarioError = calRes.reason?.message || String(calRes.reason)
  if (pacRes.status === 'fulfilled') {
    pacientesPorCanal = pacRes.value.pacientesPorCanal
    errorsByTabla = pacRes.value.errorsByTabla
  } else {
    errorsByTabla._pacientes = pacRes.reason?.message || String(pacRes.reason)
  }

  const pacientesWpp = pacientesPorCanal.whatsapp
  const pacientesFbIg = pacientesPorCanal.facebook_instagram
  const pacientesTiktok = pacientesPorCanal.tiktok
  const todosPacientes = [...pacientesWpp, ...pacientesFbIg, ...pacientesTiktok]

  const { merged, duplicados } = dedup(calendarioCitas, todosPacientes)
  const totalCount = merged.length

  const pacientesPayload = merged.map(c => ({
    nombre: c.nombre,
    dni: c.dni,
    numero: c.numero,
    instagram_handle: c.instagram_handle,
    procedimiento: c.procedimiento,
    fecha_agendamiento: c.fecha_agendamiento,
    agendamiento: c.agendamiento,
    _canal: c._canal,
    _origen_tabla: c._origen_tabla,
    _fuentes: c._fuentes
  }))

  // ── Payload para n8n ─────────────────────────────────────────────
  const payload: any = {
    evento: 'healup.agendamiento_diario',
    empresa: 'Healup',
    fecha_lima: fechaLima,
    enviado_at_utc: new Date().toISOString(),
    enviado_at_lima: new Date(Date.now() + LIMA_OFFSET_HOURS * 3600 * 1000)
      .toISOString().replace('Z', '-05:00'),
    origen: opts.origen,
    ventana: { desde_utc: inicioISO, hasta_utc: finISO, tz: 'America/Lima' },
    resumen: {
      total_pacientes: totalCount,
      por_canal: {
        whatsapp: pacientesWpp.length,
        facebook_instagram: pacientesFbIg.length,
        tiktok: pacientesTiktok.length
      },
      desde_calendario: calendarioCitas.length,
      duplicados_fusionados: duplicados,
      errores_por_tabla: Object.keys(errorsByTabla).length ? errorsByTabla : null,
      error_calendario: calendarioError
    },
    pacientes: pacientesPayload
  }

  const webhookUrl = process.env.N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO || null

  let status: 'success' | 'error' | 'empty' = totalCount === 0 ? 'empty' : 'success'
  let respuestaN8n: any = null
  let httpStatus: number | null = null
  let errorMessage: string | null = null

  if (!webhookUrl) {
    status = 'error'
    errorMessage =
      'N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO no está configurado en el .env del servidor'
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
      console.error('[healup-agendamientos] Error enviando a n8n:', errorMessage)
    }
  }

  const duracionMs = Date.now() - inicio

  // ── Guardar log ──────────────────────────────────────────────────
  let logId: number | null = null
  try {
    const { data: inserted, error: insErr } = await supabase
      .from('healup_agendamiento_diario_logs')
      .insert({
        fecha_lima: fechaLima,
        origen: opts.origen,
        triggered_by_email: opts.triggered_by_email || null,
        status,
        pacientes_count: totalCount,
        pacientes_wpp_count: pacientesWpp.length,
        pacientes_fbig_count: pacientesFbIg.length,
        pacientes_tiktok_count: pacientesTiktok.length,
        webhook_url: webhookUrl,
        payload_enviado: payload,
        respuesta_n8n: respuestaN8n,
        http_status: httpStatus,
        error_message: errorMessage,
        duracion_ms: duracionMs
      } as any)
      .select('id')
      .single()
    if (insErr) {
      console.error('[healup-agendamientos] Error guardando log:', insErr.message)
    } else {
      logId = inserted?.id || null
    }
  } catch (e: any) {
    console.error('[healup-agendamientos] Excepción guardando log:', e?.message)
  }

  console.log(
    `[healup-agendamientos] ${fechaLima} | origen=${opts.origen} | status=${status} ` +
    `| total=${totalCount} (calendario:${calendarioCitas.length}, pacientes:${todosPacientes.length}, fusionados:${duplicados}) ` +
    `| duración=${duracionMs}ms`
  )

  return {
    fecha_lima: fechaLima,
    status,
    pacientes_count: totalCount,
    pacientes_wpp_count: pacientesWpp.length,
    pacientes_fbig_count: pacientesFbIg.length,
    pacientes_tiktok_count: pacientesTiktok.length,
    http_status: httpStatus,
    error_message: errorMessage,
    duracion_ms: duracionMs,
    log_id: logId,
    webhook_configurado: Boolean(webhookUrl)
  }
}
