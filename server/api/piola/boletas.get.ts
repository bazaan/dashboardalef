/**
 * GET /api/piola/boletas — histórico de pagos al equipo, buscable por nombre y
 * código (§7.5 + reunión 31/08/2026)
 *
 * Devuelve los DOS tipos que conviven en la tabla: boletas de planilla y
 * recibos por honorarios. `?tipo=` filtra uno solo.
 *
 * Solo Administrador ve TODAS. Un colaborador solo puede ver las suyas
 * (?vista=mias), nunca las de otros: por eso estas filas no salen por Supabase
 * directo — la tabla piola_payslips no tiene policy para anon.
 *
 * Query: ?vista=todas|mias &tipo=planilla|honorarios &q=texto &periodo=YYYY-MM &limit= &offset=
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const q = getQuery(event)

  const vista = String(q.vista || (perfil.esAdmin ? 'todas' : 'mias'))
  if (vista === 'todas' && !perfil.esAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Solo un Administrador puede ver las boletas del equipo' })
  }

  const limit = Math.min(200, Number(q.limit) || 50)
  const offset = Number(q.offset) || 0

  let query = supabase.from('piola_payslips')
    .select('*', { count: 'exact' })
    .order('periodo', { ascending: false })
    .range(offset, offset + limit - 1)

  if (vista === 'mias') query = query.ilike('colaborador_email', perfil.email)
  if (q.periodo) query = query.eq('periodo', String(q.periodo))
  if (q.tipo === 'planilla' || q.tipo === 'honorarios') query = query.eq('tipo', String(q.tipo))
  if (q.q) {
    const texto = String(q.q).trim()
    query = query.or(`colaborador_nombre.ilike.%${texto}%,codigo.ilike.%${texto}%`)
  }

  const { data, count, error } = await query
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Un colaborador no necesita ver el aporte del empleador ni el desglose
  // interno, pero sí el tipo de documento y —si es un recibo por honorarios— el
  // n.º de recibo y el voucher de SU pago: es lo que vino a buscar.
  const filas = perfil.esAdmin ? (data || []) : (data || []).map((b: any) => ({
    id: b.id, codigo: b.codigo, periodo: b.periodo, colaborador_nombre: b.colaborador_nombre,
    tipo: b.tipo || 'planilla',
    total_ingresos: b.total_ingresos, total_descuentos: b.total_descuentos, neto: b.neto,
    rxh_numero: b.rxh_numero, rxh_retencion: b.rxh_retencion,
    voucher_url: b.voucher_url, pagado_at: b.pagado_at,
    pdf_url: b.pdf_url, enviado_at: b.enviado_at, created_at: b.created_at,
  }))

  return { ok: true, vista, tipo: q.tipo || 'todos', total: count ?? filas.length, boletas: filas }
})
