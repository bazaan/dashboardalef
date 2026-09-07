/**
 * GET /api/piola/honorarios — histórico de recibos por honorarios (§7.5)
 *
 * Mismo criterio que las boletas: `piola_recibos_honorarios` no tiene policy
 * para anon, así que estas filas solo salen por acá. El Administrador ve las de
 * todos; un colaborador, únicamente las suyas (?vista=mias).
 *
 * Query: ?vista=todas|mias &q=texto &periodo=YYYY-MM &estado= &limit= &offset=
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const q = getQuery(event)

  const vista = String(q.vista || (perfil.esAdmin ? 'todas' : 'mias'))
  if (vista === 'todas' && !perfil.esAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo un Administrador puede ver los recibos del equipo',
    })
  }

  const limit = Math.min(200, Number(q.limit) || 50)
  const offset = Number(q.offset) || 0

  let query = supabase.from('piola_recibos_honorarios')
    .select('*', { count: 'exact' })
    .order('periodo', { ascending: false })
    .order('colaborador_nombre')
    .range(offset, offset + limit - 1)

  if (vista === 'mias') query = query.ilike('colaborador_email', perfil.email)
  if (q.periodo) query = query.eq('periodo', String(q.periodo))
  if (q.estado && q.estado !== 'todos') query = query.eq('estado', String(q.estado))
  if (q.q) {
    const t = String(q.q).trim()
    query = query.or(`colaborador_nombre.ilike.%${t}%,codigo.ilike.%${t}%,numero.ilike.%${t}%`)
  }

  const { data, count, error } = await query
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true, vista, total: count ?? (data || []).length, recibos: data || [] }
})
