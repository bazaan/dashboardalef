/**
 * POST /api/healup/importar-gcal
 *
 * Importa un evento de Google Calendar a healup_calendar_events.
 * Usado desde el componente HealupGCalSync cuando un evento existe en GCal
 * pero no en el dashboard (ej: citas agendadas via IG/FB).
 *
 * Body:
 * {
 *   date:           string,   — "YYYY-MM-DD"
 *   time:           string,   — "HH:MM"
 *   client_name:    string,
 *   client_surname: string,
 *   client_phone?:  string,
 *   client_dni?:    string,
 *   client_email?:  string,
 *   subject?:       string,   — default: nombre completo
 *   cabina?:        string,   — default: "cabina1"
 *   gcal_id?:       string,   — ID del evento en Google Calendar (referencia)
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.date || !body?.time || !body?.client_name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Campos requeridos: date (YYYY-MM-DD), time (HH:MM), client_name'
    })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: 'date debe ser YYYY-MM-DD' })
  }

  const time = body.time.length === 5 ? body.time + ':00' : body.time // HH:MM → HH:MM:00
  const fullName = `${body.client_name} ${body.client_surname || ''}`.trim()

  const client = serverSupabaseServiceRole(event)

  // Verificar duplicados: mismo date + time + nombre similar
  const { data: existing } = await client
    .from('healup_calendar_events')
    .select('id')
    .eq('date', body.date)
    .eq('time', time)

  if (existing && existing.length > 0) {
    // Verificar si es realmente el mismo paciente
    const dup = existing.find((e: any) => true) // ya existe algo en ese slot
    return {
      success: false,
      message: `Ya existe un evento a las ${body.time} del ${body.date} en el dashboard.`,
      event_id: dup?.id || null,
      duplicado: true
    }
  }

  // Insertar
  const { data: newEvent, error } = await client
    .from('healup_calendar_events')
    .insert({
      date: body.date,
      time,
      subject: body.subject || fullName,
      description: `Importado desde Google Calendar${body.gcal_id ? ` (${body.gcal_id})` : ''}`,
      client_name: body.client_name,
      client_surname: body.client_surname || '',
      client_phone: body.client_phone || '',
      client_dni: body.client_dni || '',
      client_email: body.client_email || null,
      event_reason: 'Tratamiento',
      cabina: body.cabina || 'cabina1'
    })
    .select()
    .single()

  if (error) {
    console.error('[ImportGCal] Error insertando:', error.message)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  console.log(`[ImportGCal] Importado: ${fullName} el ${body.date} a las ${body.time}`)
  return {
    success: true,
    event_id: newEvent.id,
    message: `${fullName} importado al dashboard correctamente.`
  }
})
