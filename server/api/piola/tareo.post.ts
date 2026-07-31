/**
 * POST /api/piola/tareo — marcación de asistencia (§7.1)
 *
 * Body: { accion: 'check_in' | 'break_start' | 'break_end' | 'check_out' }
 *
 * REGLA DURA: el timestamp SIEMPRE lo pone el servidor (`new Date()`), y el día
 * se resuelve en zona America/Lima. El cliente no manda horas — si las mandara,
 * se ignoran: de otro modo cualquiera podría maquillar su jornada desde el
 * reloj de su laptop.
 *
 * Recalcula en cada marcación: minutos de break y minutos efectivos trabajados.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, hoyLima, TZ_LIMA } from '../../utils/piola'

type Accion = 'check_in' | 'break_start' | 'break_end' | 'check_out'
const ACCIONES: Accion[] = ['check_in', 'break_start', 'break_end', 'check_out']

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const body = await readBody(event)

  const accion = String(body?.accion || '') as Accion
  if (!ACCIONES.includes(accion)) {
    throw createError({ statusCode: 400, statusMessage: `Acción inválida: '${body?.accion}'` })
  }

  const ahora = new Date()                 // ← hora del SERVIDOR, no del cliente
  const fecha = hoyLima(ahora)             // ← día calendario en Lima
  const email = perfil.email

  // Fila del día (una por colaborador y fecha)
  let { data: att } = await supabase
    .from('piola_attendance')
    .select('*')
    .ilike('colaborador_email', email)
    .eq('fecha', fecha)
    .maybeSingle()

  /* ── check_in ── */
  if (accion === 'check_in') {
    if (att?.check_in) {
      throw createError({ statusCode: 409, statusMessage: 'Ya marcaste el inicio de jornada hoy' })
    }
    const fila = {
      colaborador_email: email,
      fecha,
      check_in: ahora.toISOString(),
      estado: 'incompleto',
      worked_minutes: 0,
      break_minutes: 0,
    }
    const { data, error } = await supabase
      .from('piola_attendance').upsert(fila, { onConflict: 'colaborador_email,fecha' }).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error marcando entrada: ${error.message}` })
    return respuesta(data, [], accion, ahora)
  }

  if (!att) {
    throw createError({ statusCode: 400, statusMessage: 'Primero debes marcar el inicio de jornada' })
  }

  /* ── breaks ── */
  const { data: breaks } = await supabase
    .from('piola_attendance_breaks').select('*').eq('attendance_id', att.id).order('break_start')

  const abierto = (breaks || []).find((b: any) => !b.break_end)

  if (accion === 'break_start') {
    if (att.check_out) throw createError({ statusCode: 409, statusMessage: 'La jornada ya está cerrada' })
    if (abierto) throw createError({ statusCode: 409, statusMessage: 'Ya tienes un break abierto' })
    const { error } = await supabase.from('piola_attendance_breaks')
      .insert({ attendance_id: att.id, break_start: ahora.toISOString() })
    if (error) throw createError({ statusCode: 500, statusMessage: `Error iniciando break: ${error.message}` })
  }

  if (accion === 'break_end') {
    if (!abierto) throw createError({ statusCode: 409, statusMessage: 'No tienes ningún break abierto' })
    const minutos = Math.max(0, Math.round((ahora.getTime() - new Date(abierto.break_start).getTime()) / 60000))
    const { error } = await supabase.from('piola_attendance_breaks')
      .update({ break_end: ahora.toISOString(), minutos }).eq('id', abierto.id)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error cerrando break: ${error.message}` })
  }

  if (accion === 'check_out') {
    if (att.check_out) throw createError({ statusCode: 409, statusMessage: 'Ya marcaste la salida hoy' })
    // Un break abierto se cierra solo al marcar la salida
    if (abierto) {
      const minutos = Math.max(0, Math.round((ahora.getTime() - new Date(abierto.break_start).getTime()) / 60000))
      await supabase.from('piola_attendance_breaks')
        .update({ break_end: ahora.toISOString(), minutos }).eq('id', abierto.id)
    }
  }

  /* ── Recalcular totales ── */
  const { data: breaksFinal } = await supabase
    .from('piola_attendance_breaks').select('*').eq('attendance_id', att.id).order('break_start')

  const breakMin = (breaksFinal || []).reduce((s: number, b: any) => {
    if (b.minutos != null) return s + Number(b.minutos)
    if (b.break_end) return s + Math.round((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000)
    return s
  }, 0)

  const salida = accion === 'check_out' ? ahora : (att.check_out ? new Date(att.check_out) : null)
  const brutoMin = salida
    ? Math.max(0, Math.round((salida.getTime() - new Date(att.check_in).getTime()) / 60000))
    : 0

  const patch: Record<string, any> = {
    break_minutes: breakMin,
    worked_minutes: Math.max(0, brutoMin - breakMin),
  }
  if (accion === 'check_out') {
    patch.check_out = ahora.toISOString()
    patch.estado = 'completo'
  }

  const { data: actualizado, error: upErr } = await supabase
    .from('piola_attendance').update(patch).eq('id', att.id).select('*').single()
  if (upErr) throw createError({ statusCode: 500, statusMessage: `Error actualizando el tareo: ${upErr.message}` })

  return respuesta(actualizado, breaksFinal || [], accion, ahora)
})

function respuesta(att: any, breaks: any[], accion: string, ahora: Date) {
  const horaLimaStr = new Intl.DateTimeFormat('es-PE', {
    timeZone: TZ_LIMA, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(ahora)
  return {
    ok: true,
    accion,
    hora_servidor: ahora.toISOString(),
    hora_lima: horaLimaStr,
    registro: att,
    breaks,
    break_abierto: breaks.some((b: any) => !b.break_end),
  }
}
