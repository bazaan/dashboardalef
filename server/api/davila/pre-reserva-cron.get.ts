/**
 * GET /api/davila/pre-reserva-cron?api_key=<DAVILA_PRE_RESERVA_CRON_KEY>
 *
 * CRON de limpieza de pre-reservas expiradas. Lo llama la Netlify Scheduled
 * Function cada 15 minutos. Para cada pre-reserva en estado 'pre_reservado'
 * cuyo expires_at ya pasó:
 *   1. Elimina el evento de Google Calendar (libera el horario)
 *   2. Marca estado = 'expirado'
 *
 * Cada corrida se loggea en agent_tool_logs (tool_name='Limpieza Pre-Reservas').
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { eliminarEvento } from '~/server/utils/davila-calendar'

const CRON_KEY = process.env.DAVILA_PRE_RESERVA_CRON_KEY
  || process.env.HEALUP_AGENDAMIENTO_CRON_KEY   // fallback: reusar la clave de cron existente
  || 'davila-cron-2026'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const query = getQuery(event)
  const apiKey = String(query?.api_key ?? '')

  // Auth: api_key por query o header CRON_SECRET (Netlify/Vercel)
  const cronSecret = getHeader(event, 'x-cron-secret') || ''
  if (apiKey !== CRON_KEY && cronSecret !== CRON_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Buscar pre-reservas expiradas que siguen en 'pre_reservado'
  const ahora = new Date().toISOString()
  const { data: expiradas, error } = await supabase
    .from('pre_reservas')
    .select('id, pre_reserva_id, celular, calendar_event_id')
    .eq('estado', 'pre_reservado')
    .lte('expires_at', ahora)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Error consultando: ${error.message}` })
  }

  let procesadas = 0
  let eventosBorrados = 0
  const detalle: any[] = []

  for (const r of expiradas ?? []) {
    let calOk = false
    if (r.calendar_event_id) {
      calOk = await eliminarEvento(r.calendar_event_id)
      if (calOk) eventosBorrados++
    }
    await supabase.from('pre_reservas').update({ estado: 'expirado' }).eq('id', r.id)
    procesadas++
    detalle.push({ pre_reserva_id: r.pre_reserva_id, celular: r.celular, calendar_borrado: calOk })
  }

  // Log
  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'davila',
      tool_name:  'Limpieza Pre-Reservas',
      input_data: { trigger: 'cron', timestamp: ahora },
      output_data: { procesadas, eventos_borrados: eventosBorrados, detalle },
      status:     procesadas > 0 ? 'success' : 'empty',
      duration_ms: Date.now() - startTime,
    })
  } catch {}

  console.log(`[pre-reserva-cron] ${procesadas} expiradas | ${eventosBorrados} eventos GCal borrados`)

  return {
    ok: true,
    procesadas,
    eventos_borrados: eventosBorrados,
    detalle,
    duracion_ms: Date.now() - startTime,
  }
})
