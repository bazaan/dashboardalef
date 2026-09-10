/**
 * POST /api/piola/comisiones — calcular y gestionar comisiones del closer (§4)
 *
 * Solo Contabilidad / Administrador (datos sensibles).
 *
 * Body:
 *   { accion: 'calcular', periodo: 'YYYY-MM', colaborador_email? }
 *       Base de producción = leads GANADOS por ese colaborador en el periodo
 *       (monto_cotizado), separada por `piola_leads.tipo_comision`.
 *   { accion: 'actualizar', id, estado?, monto?, pct?, fecha_pago?, notas? }
 *   { accion: 'eliminar', id }
 *
 * FÓRMULA (reunión 07/09/2026, 00:30:15 — Edson/Héctor): 8 % si el lead está
 * marcado 'cerrado' (lead normal), 4 % si está marcado 'recomendado'. Fija,
 * NO configurable por colaborador — a diferencia del `comision_pct` de
 * `piola_colaboradores`, que queda sin uso para este cálculo pero no se borra
 * por si algún día vuelve a hacer falta un pct manual vía `body.pct`.
 *
 * Héctor: "no hay forma de diferenciar ese por WhatsApp" — el bot no puede
 * clasificar el origen solo, así que `tipo_comision` se marca a mano al dar
 * el lead por ganado (ver PiolaCRM.vue). Un lead ganado SIN clasificar queda
 * fuera del cálculo y se reporta en `sin_clasificar` para que no se pague de
 * más ni de menos por un olvido.
 *
 * Como el UNIQUE de `piola_commissions` es (colaborador_email, periodo), un
 * colaborador con leads de los dos tipos en el mismo mes sigue teniendo UNA
 * sola fila: `monto` es la suma de ambos tramos y `pct` guarda la tasa
 * efectiva (monto/base) sólo para pintarla en la tabla — el desglose real
 * por tipo vive en `detalle`.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionPiola, exigirModulo, calcularComision, fechaPagoComision,
} from '../../utils/piola'

const PCT_CERRADO = 8
const PCT_RECOMENDADO = 4

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
    .select('id, nombre, owner_email, monto_cotizado, fecha_cierre, resultado, stage_id, tipo_comision')
    .gte('fecha_cierre', desde).lt('fecha_cierre', hasta)
  if (body?.colaborador_email) query = query.ilike('owner_email', String(body.colaborador_email))

  const { data: leads } = await query
  const ganados = (leads || []).filter(
    (l: any) => l.resultado === 'ganado' || idsGanado.includes(l.stage_id))

  // Agrupa por closer, separando la base por tipo — cada tipo tiene su propia tasa.
  const porCloser: Record<string, any> = {}
  const sinClasificar: any[] = []
  for (const l of ganados) {
    const email = String(l.owner_email || '').toLowerCase()
    if (!email) continue
    const tipo = l.tipo_comision === 'cerrado' || l.tipo_comision === 'recomendado' ? l.tipo_comision : null
    if (!tipo) {
      sinClasificar.push({ lead_id: l.id, lead: l.nombre, owner_email: l.owner_email })
      continue
    }
    porCloser[email] ||= { email: l.owner_email, base_cerrado: 0, base_recomendado: 0, detalle: [] }
    const monto = Number(l.monto_cotizado || 0)
    porCloser[email][tipo === 'cerrado' ? 'base_cerrado' : 'base_recomendado'] += monto
    porCloser[email].detalle.push({
      lead_id: l.id, lead: l.nombre, monto, cierre: l.fecha_cierre, tipo_comision: tipo,
      pct: tipo === 'cerrado' ? PCT_CERRADO : PCT_RECOMENDADO,
    })
  }

  const generadas: any[] = []
  for (const key of Object.keys(porCloser)) {
    const g = porCloser[key]
    const montoCerrado = calcularComision(g.base_cerrado, PCT_CERRADO)
    const montoRecomendado = calcularComision(g.base_recomendado, PCT_RECOMENDADO)
    const base = g.base_cerrado + g.base_recomendado
    const monto = montoCerrado + montoRecomendado
    // Tasa efectiva solo para la columna "%" de la tabla: con los dos tipos
    // mezclados no hay una tasa única real, esto es el promedio ponderado.
    const pctEfectivo = base > 0 ? Math.round((monto / base) * 10000) / 100 : 0

    const { data, error } = await supabase.from('piola_commissions').upsert({
      colaborador_email: g.email,
      periodo,
      base_produccion: Math.round(base * 100) / 100,
      pct: pctEfectivo,
      monto,
      fecha_pago: fechaPagoComision(periodo),   // §4: el 15 del mes siguiente
      estado: 'pendiente',
      detalle: {
        leads: g.detalle,
        resumen: {
          cerrado: { base: Math.round(g.base_cerrado * 100) / 100, pct: PCT_CERRADO, monto: montoCerrado },
          recomendado: { base: Math.round(g.base_recomendado * 100) / 100, pct: PCT_RECOMENDADO, monto: montoRecomendado },
        },
      },
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
    sin_clasificar: sinClasificar,
    aviso: sinClasificar.length
      ? `${sinClasificar.length} lead(s) ganado(s) sin clasificar (cerrado/recomendado): no entraron en el cálculo. Márcalos en el CRM.`
      : null,
  }
})
