/**
 * GET /api/piola/comisiones — listado de comisiones (§4).
 *
 * Contabilidad/Admin ven todas; un colaborador solo ve las suyas.
 * (piola_commissions no tiene policy anon: siempre pasa por aquí.)
 *
 * Query: ?periodo=YYYY-MM &estado=
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const q = getQuery(event)

  const puedeVerTodas = perfil.esAdmin || perfil.permisos?.contabilidad?.can_view === true

  let query = supabase.from('piola_commissions').select('*')
    .order('periodo', { ascending: false })
  if (!puedeVerTodas) query = query.ilike('colaborador_email', perfil.email)
  if (q.periodo) query = query.eq('periodo', String(q.periodo))
  if (q.estado) query = query.eq('estado', String(q.estado))

  const { data, error } = await query
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const total = (data || []).reduce((s: number, c: any) => s + Number(c.monto || 0), 0)
  const pendiente = (data || [])
    .filter((c: any) => c.estado !== 'pagada' && c.estado !== 'anulada')
    .reduce((s: number, c: any) => s + Number(c.monto || 0), 0)

  return {
    ok: true,
    alcance: puedeVerTodas ? 'todas' : 'propias',
    comisiones: data || [],
    resumen: { total: Math.round(total * 100) / 100, pendiente: Math.round(pendiente * 100) / 100 },
  }
})
