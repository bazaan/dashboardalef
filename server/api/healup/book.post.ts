// POST /api/healup/book
// Crea una reserva en el calendario de Healup.
// El agente de WhatsApp llama este endpoint después de confirmar con el paciente.
//
// Body esperado:
// {
//   procedure_id: number,       — ID del procedimiento (de /api/healup/procedures)
//   date: "YYYY-MM-DD",
//   time: "HH:MM",
//   client_name: string,
//   client_surname: string,
//   client_dni: string,
//   client_phone: string,
//   client_email?: string,
//   event_reason?: string,      — default "Tratamiento"
//   booked_by?: string          — identificador del agente, ej: "wpp-agent"
// }

import { serverSupabaseServiceRole } from '#supabase/server'
import { readBody } from 'h3'

const GRUPOS_CABINA_2 = [
  'FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D',
  'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION', 'CARBOXITERAPIA'
]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const client = serverSupabaseServiceRole(event)

  // Validación mínima
  const required = ['procedure_id', 'date', 'time', 'client_name', 'client_surname', 'client_dni', 'client_phone']
  for (const field of required) {
    if (!body[field]) {
      throw createError({ statusCode: 400, statusMessage: `Campo requerido faltante: ${field}` })
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date debe ser YYYY-MM-DD' })
  }
  if (!/^\d{2}:\d{2}$/.test(body.time)) {
    throw createError({ statusCode: 400, statusMessage: 'time debe ser HH:MM' })
  }

  // Buscar procedimiento para determinar cabina y nombre
  const { data: proc, error: procError } = await client
    .from('healup_procedures')
    .select('id, name, sku, grupo, price, discount, cabina')
    .eq('id', body.procedure_id)
    .single()

  if (procError || !proc) {
    throw createError({ statusCode: 404, statusMessage: `Procedimiento ID ${body.procedure_id} no encontrado` })
  }

  const cabina: string = proc.cabina ||
    (GRUPOS_CABINA_2.includes((proc.grupo || '').toUpperCase()) ? 'cabina2' : 'cabina1')

  // Verificar que el slot esté disponible
  const { data: existing } = await client
    .from('healup_calendar_events')
    .select('id')
    .eq('date', body.date)
    .eq('time', body.time + ':00')
    .eq('cabina', cabina)

  if (existing && existing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `El horario ${body.time} del ${body.date} ya está ocupado en ${cabina === 'cabina1' ? 'Cabina 1 (Doctora Valeria)' : 'Cabina 2 (Cosmiatra)'}`,
    })
  }

  // Insertar el evento
  const { data: newEvent, error: insertError } = await client
    .from('healup_calendar_events')
    .insert({
      date: body.date,
      time: body.time + ':00',
      subject: proc.name,
      description: body.event_reason || 'Agendado vía WhatsApp',
      procedure_id: proc.id,
      client_name: body.client_name,
      client_surname: body.client_surname,
      client_dni: body.client_dni,
      client_phone: body.client_phone,
      client_email: body.client_email || null,
      event_reason: body.event_reason || 'Tratamiento',
      cabina,
    })
    .select()
    .single()

  if (insertError) {
    throw createError({ statusCode: 500, statusMessage: insertError.message })
  }

  return {
    success: true,
    event_id: newEvent.id,
    procedure: proc.name,
    date: body.date,
    time: body.time,
    cabina,
    cabina_label: cabina === 'cabina1'
      ? 'Cabina 1 — Doctora Valeria (Armonización facial)'
      : 'Cabina 2 — Cosmiatra (Faciales, Corporales, HIFU)',
    client: `${body.client_name} ${body.client_surname}`,
    message: `✅ Reserva confirmada: ${proc.name} el ${body.date} a las ${body.time} en ${cabina === 'cabina1' ? 'Cabina 1 — Doctora Valeria' : 'Cabina 2 — Cosmiatra'}.`,
  }
})
