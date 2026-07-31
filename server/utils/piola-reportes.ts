/**
 * PIOLA — Reportes automáticos (§9)
 *
 * Tres reportes, con plantilla configurable (destinatarios, frecuencia, canal
 * viven en `piola_scheduled_reports`):
 *
 *   1. produccion_por_marca  ¿se cumplió el 100 % de piezas comprometidas por cliente?
 *   2. ventas_mensual        leads que entraron, convertidos y cuántos quedaron
 *                            fríos / tibios / calientes
 *   3. financiero            ingresos, egresos, flujo de caja y proyección
 *
 * Cada uno devuelve { datos, mensaje_whatsapp, html } para que el envío por
 * correo y por WhatsApp use exactamente la misma información.
 */
import { hoyLima } from './piola'

const money = (n: any) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${Math.round(n * 10) / 10} %`
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function envolver(titulo: string, periodo: string, cuerpo: string): string {
  const color = process.env.PIOLA_COLOR || '#111111'
  const acento = process.env.PIOLA_COLOR_ACENTO || '#e2564a'
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;
    background:#f5f5f5;margin:0;padding:32px}
  .doc{max-width:760px;margin:0 auto;background:#fff;border-radius:10px;padding:34px 38px;
    box-shadow:0 2px 14px rgba(0,0,0,.08)}
  h1{font-size:19px;margin:0 0 4px;color:${color}}
  .per{font-size:13px;opacity:.6;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid ${acento}}
  h2{font-size:14px;margin:24px 0 10px;text-transform:uppercase;letter-spacing:.5px;opacity:.7}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;background:#fafafa;padding:8px 10px;font-size:11px;text-transform:uppercase;
    letter-spacing:.4px;opacity:.7;border-bottom:1px solid #e5e5e5}
  td{padding:8px 10px;border-bottom:1px solid #f2f2f2}
  td.n,th.n{text-align:right}
  .kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
  .kpi{flex:1 1 150px;background:#fafafa;border-radius:8px;padding:14px 16px}
  .kpi span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.4px;opacity:.6}
  .kpi strong{display:block;font-size:21px;margin-top:4px}
  .pie{margin-top:26px;font-size:10.5px;opacity:.5;text-align:center}
</style></head><body><div class="doc">
<h1>${esc(titulo)}</h1><div class="per">Periodo ${esc(periodo)} · generado el ${hoyLima()}</div>
${cuerpo}
<div class="pie">Reporte automático del dashboard de Piola.</div>
</div></body></html>`
}

export interface Reporte {
  tipo: string
  periodo: string
  datos: any
  mensaje_whatsapp: string
  html: string
  vacio: boolean
}

/* ══════════════════ 1. Producción por marca ══════════════════ */

export async function reporteProduccion(supabase: any, periodo: string): Promise<Reporte> {
  const [{ data: clientes }, { data: entregables }] = await Promise.all([
    supabase.from('piola_clientes').select('id, nombre, compromiso_mensual').eq('activo', true).order('nombre'),
    supabase.from('piola_deliverables').select('*').eq('periodo', periodo),
  ])

  const filas = (clientes || []).map((c: any) => {
    const suyos = (entregables || []).filter((e: any) => e.cliente_id === c.id)
    const entregados = suyos
      .filter((e: any) => ['entregado', 'aprobado'].includes(e.estado))
      .reduce((s: number, e: any) => s + Number(e.cantidad || 1), 0)
    const comprometidos = Number(c.compromiso_mensual || 0)
    const cumplimiento = comprometidos ? (entregados / comprometidos) * 100 : (entregados ? 100 : 0)
    return {
      cliente: c.nombre,
      comprometidos,
      entregados,
      en_produccion: suyos.filter((e: any) => e.estado === 'en_produccion').length,
      en_revision: suyos.filter((e: any) => e.estado === 'en_revision').length,
      cumplimiento: Math.round(cumplimiento * 10) / 10,
    }
  })

  const cumplen = filas.filter((f: any) => f.cumplimiento >= 100).length
  const conCompromiso = filas.filter((f: any) => f.comprometidos > 0)

  const cuerpo = `
    <div class="kpis">
      <div class="kpi"><span>Marcas</span><strong>${filas.length}</strong></div>
      <div class="kpi"><span>Al 100 %</span><strong>${cumplen}</strong></div>
      <div class="kpi"><span>Entregables</span><strong>${(entregables || []).length}</strong></div>
    </div>
    <h2>Cumplimiento por marca</h2>
    <table><thead><tr>
      <th>Cliente</th><th class="n">Comprometidos</th><th class="n">Entregados</th>
      <th class="n">En producción</th><th class="n">En revisión</th><th class="n">Cumplimiento</th>
    </tr></thead><tbody>
      ${filas.map((f: any) => `<tr><td>${esc(f.cliente)}</td><td class="n">${f.comprometidos || '—'}</td>
        <td class="n">${f.entregados}</td><td class="n">${f.en_produccion}</td>
        <td class="n">${f.en_revision}</td><td class="n">${f.comprometidos ? pct(f.cumplimiento) : '—'}</td></tr>`).join('')
        || '<tr><td colspan="6" style="text-align:center;opacity:.6;padding:20px">Sin clientes activos</td></tr>'}
    </tbody></table>`

  const mensaje = `📊 *Producción por marca — ${periodo}*\n`
    + `${cumplen}/${conCompromiso.length} marcas al 100 % de lo comprometido.\n\n`
    + conCompromiso.map((f: any) => `• ${f.cliente}: ${f.entregados}/${f.comprometidos} (${pct(f.cumplimiento)})`).join('\n')

  return {
    tipo: 'produccion_por_marca', periodo,
    datos: { filas, total_marcas: filas.length, marcas_al_100: cumplen },
    mensaje_whatsapp: mensaje,
    html: envolver('Reporte de producción por marca', periodo, cuerpo),
    vacio: !filas.length,
  }
}

/* ══════════════════ 2. Ventas del mes ══════════════════ */

export async function reporteVentas(supabase: any, periodo: string): Promise<Reporte> {
  const [y, m] = periodo.split('-').map(Number)
  const desde = `${periodo}-01T00:00:00`
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString()

  const [{ data: leads }, { data: stages }] = await Promise.all([
    supabase.from('piola_leads').select('*').gte('fecha_ingreso', desde).lt('fecha_ingreso', hasta),
    supabase.from('piola_lead_stages').select('*').order('orden'),
  ])

  const nombreStage = (id: any) => (stages || []).find((s: any) => s.id === id)?.nombre || 'Sin etapa'
  const porEtapa: Record<string, number> = {}
  for (const l of leads || []) {
    const n = nombreStage(l.stage_id)
    porEtapa[n] = (porEtapa[n] || 0) + 1
  }

  const ganados = (leads || []).filter((l: any) => l.resultado === 'ganado')
  const perdidos = (leads || []).filter((l: any) => l.resultado === 'perdido')
  const montoGanado = ganados.reduce((s: number, l: any) => s + Number(l.monto_cotizado || 0), 0)
  const total = (leads || []).length
  const conversion = total ? (ganados.length / total) * 100 : 0

  const porFuente: Record<string, number> = {}
  for (const l of leads || []) porFuente[l.fuente] = (porFuente[l.fuente] || 0) + 1

  const cuerpo = `
    <div class="kpis">
      <div class="kpi"><span>Leads nuevos</span><strong>${total}</strong></div>
      <div class="kpi"><span>Cerrados ganados</span><strong>${ganados.length}</strong></div>
      <div class="kpi"><span>Conversión</span><strong>${pct(conversion)}</strong></div>
      <div class="kpi"><span>Monto ganado</span><strong>${money(montoGanado)}</strong></div>
    </div>
    <h2>Por etapa del pipeline</h2>
    <table><thead><tr><th>Etapa</th><th class="n">Leads</th></tr></thead><tbody>
      ${Object.entries(porEtapa).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v}</td></tr>`).join('')
        || '<tr><td colspan="2" style="text-align:center;opacity:.6;padding:20px">Sin leads este mes</td></tr>'}
    </tbody></table>
    <h2>Por fuente</h2>
    <table><thead><tr><th>Fuente</th><th class="n">Leads</th></tr></thead><tbody>
      ${Object.entries(porFuente).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v}</td></tr>`).join('') || ''}
    </tbody></table>`

  const mensaje = `📈 *Ventas — ${periodo}*\n`
    + `Leads nuevos: ${total}\nGanados: ${ganados.length} (${pct(conversion)})\n`
    + `Perdidos: ${perdidos.length}\nMonto cerrado: ${money(montoGanado)}\n\n`
    + Object.entries(porEtapa).map(([k, v]) => `• ${k}: ${v}`).join('\n')

  return {
    tipo: 'ventas_mensual', periodo,
    datos: { total, ganados: ganados.length, perdidos: perdidos.length, conversion, monto_ganado: montoGanado, por_etapa: porEtapa, por_fuente: porFuente },
    mensaje_whatsapp: mensaje,
    html: envolver('Reporte de ventas', periodo, cuerpo),
    vacio: total === 0,
  }
}

/* ══════════════════ 3. Financiero ══════════════════ */

export async function reporteFinanciero(supabase: any, periodo: string): Promise<Reporte> {
  const [y, m] = periodo.split('-').map(Number)
  const inicioMes = `${periodo}-01`
  const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  // Mes anterior, para el comparativo
  const antDate = new Date(Date.UTC(y, m - 2, 1))
  const periodoAnt = antDate.toISOString().slice(0, 7)
  const finAnt = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)

  const [{ data: tx }, { data: txAnt }, { data: categorias }] = await Promise.all([
    supabase.from('piola_transactions').select('*').gte('fecha', inicioMes).lte('fecha', finMes),
    supabase.from('piola_transactions').select('tipo, monto, proyectado')
      .gte('fecha', `${periodoAnt}-01`).lte('fecha', finAnt),
    supabase.from('piola_expense_categories').select('id, nombre, parent_id'),
  ])

  const reales = (tx || []).filter((t: any) => !t.proyectado)
  const proyectadas = (tx || []).filter((t: any) => t.proyectado)

  const suma = (lista: any[], tipo: string) =>
    lista.filter((t: any) => t.tipo === tipo).reduce((s: number, t: any) => s + Number(t.monto || 0), 0)

  const ingresos = suma(reales, 'ingreso')
  const egresos = suma(reales, 'egreso')
  const flujo = ingresos - egresos
  const ingresosAnt = suma((txAnt || []).filter((t: any) => !t.proyectado), 'ingreso')
  const egresosAnt = suma((txAnt || []).filter((t: any) => !t.proyectado), 'egreso')

  // Desglose por categoría PADRE (la jerarquía se colapsa al nivel raíz)
  const raiz = (id: any): string => {
    const c = (categorias || []).find((x: any) => x.id === id)
    if (!c) return 'Sin categoría'
    return c.parent_id ? raiz(c.parent_id) : c.nombre
  }
  const porCategoria: Record<string, number> = {}
  for (const t of reales.filter((t: any) => t.tipo === 'egreso')) {
    const k = raiz(t.category_id)
    porCategoria[k] = (porCategoria[k] || 0) + Number(t.monto || 0)
  }

  const proyIngresos = suma(proyectadas, 'ingreso')
  const proyEgresos = suma(proyectadas, 'egreso')

  const delta = (act: number, ant: number) => ant ? `${act >= ant ? '▲' : '▼'} ${pct(Math.abs((act - ant) / ant * 100))}` : '—'

  const cuerpo = `
    <div class="kpis">
      <div class="kpi"><span>Ingresos</span><strong>${money(ingresos)}</strong></div>
      <div class="kpi"><span>Egresos</span><strong>${money(egresos)}</strong></div>
      <div class="kpi"><span>Flujo de caja</span><strong>${money(flujo)}</strong></div>
    </div>
    <h2>Comparativo con ${periodoAnt}</h2>
    <table><thead><tr><th>Concepto</th><th class="n">${periodoAnt}</th><th class="n">${periodo}</th><th class="n">Var.</th></tr></thead><tbody>
      <tr><td>Ingresos</td><td class="n">${money(ingresosAnt)}</td><td class="n">${money(ingresos)}</td><td class="n">${delta(ingresos, ingresosAnt)}</td></tr>
      <tr><td>Egresos</td><td class="n">${money(egresosAnt)}</td><td class="n">${money(egresos)}</td><td class="n">${delta(egresos, egresosAnt)}</td></tr>
      <tr><td><strong>Flujo</strong></td><td class="n">${money(ingresosAnt - egresosAnt)}</td><td class="n">${money(flujo)}</td><td class="n">—</td></tr>
    </tbody></table>
    <h2>Egresos por categoría</h2>
    <table><thead><tr><th>Categoría</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>
      ${Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
        `<tr><td>${esc(k)}</td><td class="n">${money(v)}</td><td class="n">${egresos ? pct(v / egresos * 100) : '—'}</td></tr>`).join('')
        || '<tr><td colspan="3" style="text-align:center;opacity:.6;padding:20px">Sin egresos registrados</td></tr>'}
    </tbody></table>
    ${(proyIngresos || proyEgresos) ? `<h2>Proyección del mes</h2>
    <table><tbody>
      <tr><td>Ingresos proyectados</td><td class="n">${money(proyIngresos)}</td></tr>
      <tr><td>Egresos proyectados</td><td class="n">${money(proyEgresos)}</td></tr>
      <tr><td><strong>Flujo proyectado</strong></td><td class="n"><strong>${money(flujo + proyIngresos - proyEgresos)}</strong></td></tr>
    </tbody></table>` : ''}`

  const mensaje = `💵 *Financiero — ${periodo}*\n`
    + `Ingresos: ${money(ingresos)}\nEgresos: ${money(egresos)}\nFlujo de caja: ${money(flujo)}\n`
    + (proyIngresos || proyEgresos ? `Flujo proyectado: ${money(flujo + proyIngresos - proyEgresos)}\n` : '')
    + `\nTop egresos:\n`
    + Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([k, v]) => `• ${k}: ${money(v)}`).join('\n')

  return {
    tipo: 'financiero', periodo,
    datos: {
      ingresos, egresos, flujo,
      mes_anterior: { periodo: periodoAnt, ingresos: ingresosAnt, egresos: egresosAnt },
      por_categoria: porCategoria,
      proyeccion: { ingresos: proyIngresos, egresos: proyEgresos, flujo: flujo + proyIngresos - proyEgresos },
    },
    mensaje_whatsapp: mensaje,
    html: envolver('Reporte financiero', periodo, cuerpo),
    vacio: reales.length === 0,
  }
}

export async function generarReporte(supabase: any, tipo: string, periodo: string): Promise<Reporte> {
  if (tipo === 'produccion_por_marca') return reporteProduccion(supabase, periodo)
  if (tipo === 'ventas_mensual') return reporteVentas(supabase, periodo)
  if (tipo === 'financiero') return reporteFinanciero(supabase, periodo)
  throw new Error(`Tipo de reporte desconocido: '${tipo}'`)
}
