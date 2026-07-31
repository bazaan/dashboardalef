/**
 * POST /api/piola/tareo-correccion — corrección manual de una marcación (§7.1)
 *
 * Solo RR. HH. / Administrador. Deja SIEMPRE registro de auditoría:
 * qué cambió, quién lo cambió y cuándo (piola_attendance_audit).
 *
 * Body: {
 *   colaborador_email, fecha: 'YYYY-MM-DD',
 *   check_in?: 'HH:MM' | null, check_out?: 'HH:MM' | null,
 *   break_minutes?: number, estado?: string, notas?: string, motivo?: string
 * }
 *
 * Las horas llegan como 'HH:MM' hora Lima y se convierten a UTC aquí.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, TZ_LIMA } from '../../utils/piola'

/** 'YYYY-MM-DD' + 'HH:MM' en Lima → Date UTC correcto (Lima es UTC-5 todo el año). */
function limaAUtc(fecha: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const [y, mo, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d, h + 5, m)).toISOString()
}

const ESTADOS = ['completo', 'incompleto', 'falta', 'feriado', 'vacaciones', 'licencia']

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirModulo(perfil, 'rrhh', 'edit')

  const body = await readBody(event)
  const email = String(body?.colaborador_email || '').trim()
  const fecha = String(body?.fecha || '').slice(0, 10)
  if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan colaborador_email o fecha (YYYY-MM-DD)' })
  }
  if (body?.estado && !ESTADOS.includes(body.estado)) {
    throw createError({ statusCode: 400, statusMessage: `Estado inválido: '${body.estado}'` })
  }

  const { data: previo } = await supabase
    .from('piola_attendance').select('*')
    .ilike('colaborador_email', email).eq('fecha', fecha).maybeSingle()

  const patch: Record<string, any> = {
    colaborador_email: email,
    fecha,
    editado_por: perfil.email,
    editado_at: new Date().toISOString(),
  }

  if ('check_in' in body) patch.check_in = body.check_in ? limaAUtc(fecha, String(body.check_in)) : null
  if ('check_out' in body) patch.check_out = body.check_out ? limaAUtc(fecha, String(body.check_out)) : null
  if ('break_minutes' in body) patch.break_minutes = Math.max(0, Number(body.break_minutes) || 0)
  if ('estado' in body) patch.estado = body.estado
  if ('notas' in body) patch.notas = body.notas || null

  // Recalcula los minutos efectivos con los valores finales
  const inFinal = 'check_in' in patch ? patch.check_in : previo?.check_in
  const outFinal = 'check_out' in patch ? patch.check_out : previo?.check_out
  const brkFinal = 'break_minutes' in patch ? patch.break_minutes : (previo?.break_minutes || 0)
  if (inFinal && outFinal) {
    const bruto = Math.round((new Date(outFinal).getTime() - new Date(inFinal).getTime()) / 60000)
    patch.worked_minutes = Math.max(0, bruto - Number(brkFinal || 0))
    if (!('estado' in patch)) patch.estado = 'completo'
  } else if (!inFinal && !outFinal && patch.estado && patch.estado !== 'completo') {
    patch.worked_minutes = 0
  }

  const { data: guardado, error } = await supabase
    .from('piola_attendance')
    .upsert(patch, { onConflict: 'colaborador_email,fecha' })
    .select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error corrigiendo la marcación: ${error.message}` })

  /* ── Auditoría: qué cambió exactamente ── */
  const cambios: Record<string, any> = {}
  for (const campo of ['check_in', 'check_out', 'break_minutes', 'worked_minutes', 'estado', 'notas']) {
    const antes = previo ? previo[campo] ?? null : null
    const despues = guardado[campo] ?? null
    if (String(antes) !== String(despues)) cambios[campo] = { antes, despues }
  }

  if (Object.keys(cambios).length) {
    await supabase.from('piola_attendance_audit').insert({
      attendance_id: guardado.id,
      colaborador_email: email,
      fecha,
      cambios,
      motivo: body?.motivo || null,
      editado_por: perfil.email,
    })
  }

  return { ok: true, registro: guardado, cambios, zona: TZ_LIMA }
})
