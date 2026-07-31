/**
 * POST /api/piola/comisiones — calcular y gestionar comisiones del closer (§4)
 *
 * Solo Contabilidad / Administrador (datos sensibles).
 *
 * Body:
 *   { accion: 'calcular', periodo: 'YYYY-MM', colaborador_email?, pct? }
 *       Base de producción = leads CERRADOS GANADOS por ese colaborador en el
 *       periodo (monto_cotizado). Se puede sobrescribir con `base_manual`.
 *   { accion: 'actualizar', id, estado?, monto?, pct?, fecha_pago?, notas? }
 *   { accion: 'eliminar', id }
 *
 * ⚠️ La FÓRMULA EXACTA del acuerdo con Héctor sigue pendiente de Piola (§12).
 * Por eso el cálculo es base × pct, con el pct configurable por colaborador
 * (piola_colaboradores.comision_pct) y sobrescribible por request. Cuando
 * llegue el documento, se cambia solo `calcularComision()` en server/utils/piola.ts.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionPiola, exigirModulo, calcularComision, fechaPagoComision,
} from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirModulo(perfil, 'contabilidad', 'edit')

  const body = await readBody(event)
  const accion = String(body?.accion || 'calcular')

  if (accion === 'actualizar') {
    const patch: Record<string, any> = {}
    for (const c of ['estado', 'monto', 'pct', 'fecha_pago', 'notas', 'base_produccion']) {
      if (c in body) patch[c] = body[c]
    }
    if (('pct' in body || 'base_produccion' in body) && !('monto' in body)) {
      const { data: actual } = await supabase.from('piola_commissions').select('*').eq('id', body?.id).maybeSingle()
      const base = body.base_produccion ?? actual?.base_produccion ?? 0
      const pct = body.pct ?? actual?.pct ?? 0
      patch.monto = calcularComision(base, pct)
    }
    const { data, error } = await supabase.from('piola_commissions')
      .update(patch).eq('id', body?.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true, comision: data }
  }

  if (accion === 'eliminar') {
    const { error } = await supabase.from('piola_commissions').delete().eq('id', body?.id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true }
  }

  /* ══════════ Calcular ══════════ */
  const periodo = String(body?.periodo || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw createError({ statusCode: 400, statusMessage: "Periodo inválido: se espera 'YYYY-MM'" })
  }

  const desde = `${periodo}-01T00:00:00`
  const [y, m] = periodo.split('-').map(Number)
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString()

  // Etapas marcadas como "ganado" en el pipeline (editables desde Configuración)
  const { data: stagesGanado } = await supabase
    .from('piola_lead_stages').select('id').eq('es_ganado', true)
  const idsGanado = (stagesGanado || []).map((s: any) => s.id)

  let query = supabase.from('piola_leads')
    .select('id, nombre, owner_email, monto_cotizado, fecha_cierre, resultado, stage_id')
    .gte('fecha_cierre', desde).lt('fecha_cierre', hasta)
  if (body?.colaborador_email) query = query.ilike('owner_email', String(body.colaborador_email))

  const { data: leads } = await query
  const ganados = (leads || []).filter(
    (l: any) => l.resultado === 'ganado' || idsGanado.includes(l.stage_id))

  // Agrupa por closer
  const porCloser: Record<string, any> = {}
  for (const l of ganados) {
    const email = String(l.owner_email || '').toLowerCase()
    if (!email) continue
    porCloser[email] ||= { email: l.owner_email, base: 0, detalle: [] }
    porCloser[email].base += Number(l.monto_cotizado || 0)
    porCloser[email].detalle.push({
      lead_id: l.id, lead: l.nombre, monto: Number(l.monto_cotizado || 0), cierre: l.fecha_cierre,
    })
  }

  const generadas: any[] = []
  for (const key of Object.keys(porCloser)) {
    const g = porCloser[key]
    const { data: colab } = await supabase
      .from('piola_colaboradores').select('comision_pct, nombre').ilike('email', g.email).maybeSingle()

    const pct = Number(body?.pct ?? colab?.comision_pct ?? 0)
    const base = Number(body?.base_manual ?? g.base)
    const monto = calcularComision(base, pct)

    const { data, error } = await supabase.from('piola_commissions').upsert({
      colaborador_email: g.email,
      periodo,
      base_produccion: Math.round(base * 100) / 100,
      pct,
      monto,
      fecha_pago: fechaPagoComision(periodo),   // §4: el 15 del mes siguiente
      estado: 'pendiente',
      detalle: g.detalle,
      created_by: perfil.email,
    }, { onConflict: 'colaborador_email,periodo' }).select('*').single()

    if (!error) generadas.push(data)
  }

  return {
    ok: true,
    periodo,
    fecha_pago: fechaPagoComision(periodo),
    leads_ganados: ganados.length,
    comisiones: generadas,
    aviso: generadas.some(c => !Number(c.pct))
      ? 'Hay comisiones con 0 %: configura comision_pct en la ficha del colaborador. La fórmula definitiva del acuerdo con Héctor sigue pendiente de Piola.'
      : null,
  }
})
