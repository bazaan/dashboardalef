// GET /api/healup/availability?date=YYYY-MM-DD&cabina=cabina1
// Retorna los horarios disponibles para una fecha y cabina dada.
// Usado por el agente de WhatsApp para sugerir citas.

import { serverSupabaseServiceRole } from '#supabase/server'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const { date, cabina = 'cabina1' } = getQuery(event) as { date?: string; cabina?: string }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: 'Parámetro date requerido en formato YYYY-MM-DD' })
  }

  const client = serverSupabaseServiceRole(event)

  // Cargar horario de la cabina (id=1 → cabina1, id=2 → cabina2)
  const whId = cabina === 'cabina2' ? 2 : 1
  const { data: whData, error: whError } = await client
    .from('healup_working_hours')
    .select('slot_duration_minutes, schedule_json')
    .eq('id', whId)
    .single()

  if (whError || !whData) {
    throw createError({ statusCode: 500, statusMessage: 'No se encontró configuración de horario para ' + cabina })
  }

  const schedule: any[] = typeof whData.schedule_json === 'string'
    ? JSON.parse(whData.schedule_json)
    : whData.schedule_json
  const slotMins: number = whData.slot_duration_minutes || 30

  const dayOfWeek = new Date(date + 'T12:00:00').getDay()
  const dayConfig = schedule.find(d => d.day === dayOfWeek)

  if (!dayConfig || !dayConfig.active) {
    return {
      date,
      cabina,
      cabina_label: cabina === 'cabina1' ? 'Cabina 1 — Doctora Valeria' : 'Cabina 2 — Cosmiatra',
      working_day: false,
      available_slots: [],
      message: 'No hay atención ese día para ' + (cabina === 'cabina1' ? 'Cabina 1' : 'Cabina 2'),
    }
  }

  // Generar todos los slots del día
  const [sh, sm] = dayConfig.start.split(':').map(Number)
  const [eh, em] = dayConfig.end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em

  const allSlots: string[] = []
  for (let m = startMins; m < endMins; m += slotMins) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0')
    const mm = (m % 60).toString().padStart(2, '0')
    allSlots.push(`${hh}:${mm}`)
  }

  // Obtener citas ya reservadas para esa fecha y cabina
  const { data: booked, error: bookedError } = await client
    .from('healup_calendar_events')
    .select('time')
    .eq('date', date)
    .eq('cabina', cabina)

  if (bookedError) {
    throw createError({ statusCode: 500, statusMessage: bookedError.message })
  }

  const bookedTimes = new Set(
    (booked || []).map((e: any) => (e.time || '').substring(0, 5))
  )

  const availableSlots = allSlots.filter(t => !bookedTimes.has(t))

  return {
    date,
    cabina,
    cabina_label: cabina === 'cabina1' ? 'Cabina 1 — Doctora Valeria' : 'Cabina 2 — Cosmiatra',
    working_day: true,
    slot_duration_minutes: slotMins,
    total_slots: allSlots.length,
    booked_slots: allSlots.length - availableSlots.length,
    available_slots: availableSlots,
  }
})
