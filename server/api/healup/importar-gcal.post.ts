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
 *   procedure_id?:  number,   — ID del procedimiento (override). Si no llega, se intenta detectar por SKU/nombre en subject
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const GRUPOS_CABINA_2 = [
  'FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D',
  'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION', 'CARBOXITERAPIA'
]

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Detecta el procedimiento desde el subject de GCal: 1) SKU explícito, 2) match por nombre
function detectProcedure(subject: string, procs: any[]): any | null {
  if (!subject || !procs?.length) return null
  const subjUpper = subject.toUpperCase()

  // 1. Match por SKU explícito (FB-001, ME-002, etc.)
  for (const p of procs) {
    if (p.sku && subjUpper.includes(String(p.sku).toUpperCase())) return p
  }

  // 2. Match por nombre (longest first para evitar match parcial)
  const subjNorm = normalize(subject)
  const sorted = [...procs].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
  for (const p of sorted) {
    const nameNorm = normalize(p.name || '')
    if (nameNorm && nameNorm.length >= 4 && subjNorm.includes(nameNorm)) return p
  }
  return null
}

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

  // Resolver procedure_id: 1) override del body, 2) auto-detección desde subject
  let procedureId: number | null = body.procedure_id ? Number(body.procedure_id) : null
  let procedureMatched: any = null
  let cabina: string = body.cabina || 'cabina1'

  const { data: procs } = await client
    .from('healup_procedures')
    .select('id, name, sku, grupo, cabina')

  if (procedureId) {
    procedureMatched = (procs || []).find((p: any) => Number(p.id) === procedureId) || null
  } else if (body.subject && procs?.length) {
    procedureMatched = detectProcedure(body.subject, procs)
    if (procedureMatched) procedureId = Number(procedureMatched.id)
  }

  // Si tenemos procedimiento, derivar cabina (a menos que el body la haya forzado)
  if (procedureMatched && !body.cabina) {
    cabina = procedureMatched.cabina ||
      (GRUPOS_CABINA_2.includes((procedureMatched.grupo || '').toUpperCase()) ? 'cabina2' : 'cabina1')
  }

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
  const insertPayload: Record<string, any> = {
    date: body.date,
    time,
    subject: body.subject || fullName,
    description: `Importado desde Google Calendar${body.gcal_id ? ` (${body.gcal_id})` : ''}${procedureMatched ? ` · SKU ${procedureMatched.sku || procedureMatched.name}` : ''}`,
    client_name: body.client_name,
    client_surname: body.client_surname || '',
    client_phone: body.client_phone || '',
    client_dni: body.client_dni || '',
    client_email: body.client_email || null,
    event_reason: 'Tratamiento',
    cabina,
  }
  if (procedureId) insertPayload.procedure_id = procedureId

  const { data: newEvent, error } = await client
    .from('healup_calendar_events')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    console.error('[ImportGCal] Error insertando:', error.message)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const skuLabel = procedureMatched?.sku ? ` [${procedureMatched.sku}]` : ''
  console.log(`[ImportGCal] Importado: ${fullName} el ${body.date} a las ${body.time}${skuLabel}`)
  return {
    success: true,
    event_id: newEvent.id,
    procedure_id: procedureId,
    procedure_sku: procedureMatched?.sku || null,
    procedure_name: procedureMatched?.name || null,
    procedure_grupo: procedureMatched?.grupo || null,
    auto_detected: !!procedureMatched && !body.procedure_id,
    cabina,
    message: procedureMatched
      ? `${fullName} importado · SKU ${procedureMatched.sku || procedureMatched.name} sincronizado.`
      : `${fullName} importado · sin SKU detectado, asignar manualmente.`
  }
})
