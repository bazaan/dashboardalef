/**
 * POST /api/davila/calendario-agendar
 *
 * Tool calendario_agendar de Miguel Davila — PASO FINAL del ciclo de cita
 * (Fase 3). Toma una pre-reserva ya PAGADA, le agrega los datos personales
 * del paciente y la convierte en una CITA CONFIRMADA permanente:
 *
 *   1. Busca la pre-reserva pagada del cliente (la más reciente)
 *   2. Enriquece el evento de Google Calendar (título, datos, horario definitivo)
 *   3. Enriquece el evento del calendario del dashboard (DAVILA_calendar_events)
 *   4. Inserta el paciente en PacientesBDwppDAVILA
 *   5. Marca la pre-reserva como 'confirmado'
 *
 * Body (4 parámetros):
 * {
 *   api_key:         string,
 *   celular:         string,   — identificador del cliente
 *   nombre_completo: string,   — "Juan Perez Garcia"
 *   dni:             string,   — "74852369"
 *   tratamiento:     string,   — "Rinoplastia"
 * }
 *
 * Log: agent_tool_logs (company_id='davila', tool_name='Calendario Agendar')
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { actualizarEvento } from '~/server/utils/davila-calendar'

const API_KEY = 'davila-pre-reserva-2026'
const DURACION_MIN = 30   // las citas finales duran 30 min (según la guía)

function splitName(full: string): { name: string; surname: string } {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: '', surname: '' }
  if (parts.length === 1) return { name: parts[0], surname: '' }
  return { name: parts[0], surname: parts.slice(1).join(' ') }
}

/** "2026-06-03" + "16:00" → ISO Lima "2026-06-03T16:00:00-05:00" */
function buildLimaISO(fecha: string, hora: string): string {
  const h = (hora || '').trim()
  const hhmm = /^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h
  return `${fecha}T${hhmm}:00-05:00`
}

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
      company_id: 'davila',
      tool_name:  'Calendario Agendar',
      input_data: body,
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const finish = async (status: string, output: any, errorMsg?: string) => {
    if (logId) {
      try {
        await supabase.from('agent_tool_logs').update({
          status, output_data: output, error_message: errorMsg ?? null,
          duration_ms: Date.now() - startTime,
        }).eq('id', logId)
      } catch {}
    }
    return output
  }

  // 3. Validación
  const celular = String(body?.celular ?? '').trim()
  const nombre_completo = String(body?.nombre_completo ?? '').trim()
  const dni = String(body?.dni ?? body?.DNI ?? '').trim()
  const tratamiento = String(body?.tratamiento ?? '').trim()

  if (!celular || !nombre_completo) {
    const msg = 'Faltan campos requeridos: celular, nombre_completo'
    return await finish('error', { success: false, error: 'parametros_invalidos', mensaje: msg }, msg)
  }

  // 4. Buscar la pre-reserva PAGADA más reciente del cliente
  const { data: reserva } = await supabase
    .from('pre_reservas')
    .select('*')
    .eq('celular', celular)
    .eq('estado', 'pagado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!reserva) {
    const msg = 'No se encontró una pre-reserva pagada para este cliente'
    return await finish('error', { success: false, error: 'pre_reserva_no_encontrada', mensaje: msg }, msg)
  }

  const { fecha, hora, calendar_event_id, dashboard_event_id } = reserva
  const { name, surname } = splitName(nombre_completo)
  const fechaHoraISO = buildLimaISO(fecha, hora)

  const resultados: Record<string, any> = {}

  // 5. Enriquecer el evento de Google Calendar (convertir pre-reserva → cita)
  try {
    if (calendar_event_id) {
      await actualizarEvento(calendar_event_id, {
        fecha, hora, duracionMin: DURACION_MIN,
        summary: `${nombre_completo}${tratamiento ? ` - ${tratamiento}` : ''}`,
        description:
          `Paciente: ${nombre_completo}\nDNI: ${dni}\nTratamiento: ${tratamiento}\n` +
          `Celular: ${celular}\nFecha: ${fecha} ${hora}\nEstado: CONFIRMADO`,
      })
      resultados.google_calendar = { ok: true, eventId: calendar_event_id }
    } else {
      resultados.google_calendar = { ok: false, motivo: 'sin calendar_event_id' }
    }
  } catch (e: any) {
    console.error('[calendario-agendar] GCal:', e?.message)
    resultados.google_calendar = { ok: false, error: e?.message }
  }

  // 6. Enriquecer el evento del calendario del dashboard
  try {
    if (dashboard_event_id) {
      await supabase.from('DAVILA_calendar_events').update({
        subject:        nombre_completo,
        description:    `Tratamiento: ${tratamiento}\nDNI: ${dni}\nTel: ${celular}\nEstado: CONFIRMADO`,
        client_name:    name,
        client_surname: surname,
        client_dni:     dni,
        client_phone:   celular,
        event_reason:   tratamiento,
        estado:         'confirmado',
      }).eq('id', dashboard_event_id)
      resultados.dashboard_calendar = { ok: true, id: dashboard_event_id }
    } else {
      // No había evento de dashboard (caso raro): crear uno nuevo confirmado
      const { data: nuevo } = await supabase.from('DAVILA_calendar_events').insert({
        date: fecha, time: hora, subject: nombre_completo,
        description: `Tratamiento: ${tratamiento}\nDNI: ${dni}\nTel: ${celular}\nEstado: CONFIRMADO`,
        client_name: name, client_surname: surname, client_dni: dni,
        client_phone: celular, event_reason: tratamiento,
        pre_reserva_id: reserva.pre_reserva_id, calendar_event_id, estado: 'confirmado',
      }).select('id').single()
      resultados.dashboard_calendar = { ok: true, id: nuevo?.id, creado: true }
    }
  } catch (e: any) {
    console.error('[calendario-agendar] dashboard:', e?.message)
    resultados.dashboard_calendar = { ok: false, error: e?.message }
  }

  // 7. Insertar el paciente en PacientesBDwppDAVILA
  try {
    await supabase.from('PacientesBDwppDAVILA').insert({
      nombre:             nombre_completo,
      dni,
      numero:             celular,
      red_social:         'WhatsApp',
      procedimiento:      tratamiento,
      fecha_agendamiento: fechaHoraISO,
      estado:             'confirmado',
      company_id:         'davila',
    })
    resultados.paciente = { ok: true }
  } catch (e: any) {
    console.error('[calendario-agendar] PacientesBDwppDAVILA:', e?.message)
    resultados.paciente = { ok: false, error: e?.message }
  }

  // 8. Marcar la pre-reserva como confirmada
  try {
    await supabase.from('pre_reservas').update({
      estado: 'confirmado', confirmado_en: new Date().toISOString(),
    }).eq('id', reserva.id)
  } catch (e: any) {
    console.error('[calendario-agendar] update pre_reservas:', e?.message)
  }

  const hayError = Object.values(resultados).some((r: any) => r?.ok === false)
  const output = {
    success: true,
    estado: 'confirmado',
    mensaje: 'Cita confirmada y agendada exitosamente',
    fecha, hora,
    paciente: nombre_completo,
    detalle: resultados,
  }

  await finish(hayError ? 'partial' : 'success', output)

  console.log(
    `[calendario-agendar] Davila | ${nombre_completo} | ${fecha} ${hora} | ` +
    `gcal:${resultados.google_calendar?.ok ? '✅' : '❌'} ` +
    `dash:${resultados.dashboard_calendar?.ok ? '✅' : '❌'} ` +
    `pac:${resultados.paciente?.ok ? '✅' : '❌'}`
  )

  return output
})
