/**
 * Piola — cumplimiento por marca en formato "Excel de KPIs" + reportes imprimibles (PDF)
 * ---------------------------------------------------------------------------------------
 * Reunión del 14/09/2026 (Sebastián, Raysa, Edson, Héctor, Roberto). El equipo llevaba un
 * Excel manual de KPIs: una fila por marca, una columna por tipo de contenido (videos, piezas
 * gráficas…), un total, y el porcentaje de avance del mes ("el 100 % es todo el mes; ahorita
 * que es quincena deberíamos estar en un 40 o 50 %"). Se pidió replicarlo tal cual en el módulo
 * de Producción para que lo llenen en tiempo real y dejen de mantener el Excel a mano.
 *
 * Todo lo que es cuenta vive acá (funciones puras, sin Vue) para poder probarlo aparte y para
 * que la tabla de pantalla y el PDF muestren exactamente los mismos números. El "entregado"
 * NO se recalcula: viene de la vista `piola_cumplimiento_tipo` (aprobado + entregado), la misma
 * definición que usan los reportes.
 *
 * Formato: llegó una captura del Excel real ("KPI Y SEGUIMIENTO AGENCIA PIOLA SEPTIEMBRE"): columnas
 * CLIENTE | una por tipo (VIDEO, GRÁFICA…: lo COMPROMETIDO del mes) | PIEZAS MENSUALES (suma de lo
 * comprometido) | AVANCE (lo entregado) | % DE AVANCE (avance / piezas, con dos decimales), y una fila
 * TOTALES. La tabla de pantalla y el PDF lo replican tal cual (ejemplo de su hoja: 112 piezas, 63
 * de avance, 56.25 %).
 */

/* ══════════════════ Fechas / ritmo del mes ══════════════════ */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** '2026-09' -> 'Septiembre 2026' */
export function piolaNombrePeriodo(periodo: string): string {
  const [y, m] = String(periodo || '').split('-').map(Number)
  return MESES[(m || 1) - 1] ? `${MESES[m - 1]} ${y}` : String(periodo || '')
}

/** '2026-09' -> 'Septiembre' */
export function piolaNombreMes(periodo: string): string {
  const m = Number(String(periodo || '').split('-')[1])
  return MESES[m - 1] || ''
}

/** '2026-09' -> 'KPI Y SEGUIMIENTO AGENCIA PIOLA SEPTIEMBRE 2026' (el título de la hoja del Excel). */
export function piolaTituloKpi(periodo: string): string {
  const mes = piolaNombreMes(periodo)
  return ['KPI Y SEGUIMIENTO AGENCIA PIOLA', mes, mes ? String(periodo).slice(0, 4) : '']
    .filter(Boolean).join(' ').toUpperCase()
}

/**
 * Cuánto del mes "debería" llevar hecho hoy, en %. Mes en curso: día de hoy / días del mes
 * (el 15 de un mes de 30 días = 50 %). Mes ya cerrado = 100. Mes futuro = 0.
 * `hoy` = 'YYYY-MM-DD' en hora de Lima.
 */
export function piolaAvanceEsperado(periodo: string, hoy: string): number {
  const p = String(periodo || '').match(/^(\d{4})-(\d{2})$/)
  const h = String(hoy || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!p || !h) return 0
  const clavePeriodo = p[1] + p[2]
  const claveHoy = h[1] + h[2]
  if (claveHoy > clavePeriodo) return 100
  if (claveHoy < clavePeriodo) return 0
  const diasMes = new Date(Date.UTC(Number(p[1]), Number(p[2]), 0)).getUTCDate()
  return Math.round((Number(h[3]) / diasMes) * 1000) / 10
}

export type PiolaRitmo = 'sin_compromiso' | 'completo' | 'al_dia' | 'en_riesgo' | 'atrasado'

/**
 * Compara el avance real contra el esperado del mes:
 *   >= 100          completo
 *   >= esperado     al día
 *   >= esperado-15  en riesgo (está cerca)
 *   menos           atrasado
 */
export function piolaRitmo(pct: number, esperado: number, comprometido: number): PiolaRitmo {
  if (!Number(comprometido)) return 'sin_compromiso'
  if (pct >= 100) return 'completo'
  if (pct >= esperado) return 'al_dia'
  if (pct >= esperado - 15) return 'en_riesgo'
  return 'atrasado'
}

export const PIOLA_RITMO_TEXTO: Record<PiolaRitmo, string> = {
  sin_compromiso: 'Sin compromiso',
  completo: 'Completo',
  al_dia: 'Al día',
  en_riesgo: 'En riesgo',
  atrasado: 'Atrasado',
}

export const PIOLA_RITMO_COLOR: Record<PiolaRitmo, string> = {
  sin_compromiso: '#8a8a8a',
  completo: '#1f8a4c',
  al_dia: '#2e9e5b',
  en_riesgo: '#e0902b',
  atrasado: '#d64545',
}

export const piolaPct = (entregado: any, comprometido: any): number =>
  Number(comprometido) ? Math.round(Number(entregado || 0) / Number(comprometido) * 1000) / 10 : 0

/** "% DE AVANCE" como lo muestra el Excel: dos decimales ("78.57%"), y "-%" si no hay compromiso. */
export function piolaPctTexto(entregado: any, comprometido: any): string {
  const c = Number(comprometido)
  if (!c) return '-%'
  return (Math.round(Number(entregado || 0) / c * 10000) / 100).toFixed(2) + '%'
}

/* ══════════════════ Tabla KPI ══════════════════ */

export interface KpiColumna { codigo: string; nombre: string; color: string }
export interface KpiCelda { comprometido: number; entregado: number }
export interface KpiFila {
  cliente_id: any
  cliente: string
  celdas: Record<string, KpiCelda>
  comprometido: number
  entregado: number
  en_revision: number
  en_produccion: number
  pct: number
  ritmo: PiolaRitmo
}
export interface KpiTabla {
  columnas: KpiColumna[]
  filas: KpiFila[]
  totales: KpiFila
  esperado: number
}

/**
 * Arma la tabla estilo Excel: una fila por marca, una columna por tipo de contenido.
 *   filasVista  = filas de `piola_cumplimiento_tipo` del periodo
 *   marcas      = marcas activas (aparecen aunque no tengan nada cargado: sin fila no hay dónde
 *                 hacer clic para definirles el compromiso)
 *   tipos       = catálogo de tipos de contenido (define nombre, color y orden de las columnas)
 * Solo salen las columnas de los tipos que alguna marca tiene comprometidos o cargados.
 */
export function piolaConstruirKpi(
  filasVista: any[], marcas: { id: any; nombre: string }[], tipos: any[], esperado: number,
): KpiTabla {
  const usados = new Set<string>()
  for (const f of filasVista) {
    if (Number(f.comprometido || 0) || Number(f.total_cargado || 0)) usados.add(String(f.tipo_contenido))
  }
  const orden = (codigo: string) => {
    const t = tipos.find(x => x.codigo === codigo)
    return t ? Number(t.orden || 0) : 9999            // lo no catalogado, al final
  }
  const columnas: KpiColumna[] = [...usados]
    .sort((a, b) => orden(a) - orden(b) || a.localeCompare(b))
    .map(codigo => {
      const t = tipos.find(x => x.codigo === codigo)
      return {
        codigo,
        nombre: t?.nombre || (codigo === 'sin_clasificar' ? 'Sin clasificar' : codigo),
        color: t?.color || '#8a8a8a',
      }
    })

  const vacia = (id: any, nombre: string): KpiFila => ({
    cliente_id: id, cliente: nombre, celdas: {}, comprometido: 0, entregado: 0,
    en_revision: 0, en_produccion: 0, pct: 0, ritmo: 'sin_compromiso',
  })

  const mapa = new Map<any, KpiFila>()
  for (const m of marcas) mapa.set(m.id, vacia(m.id, m.nombre))
  for (const f of filasVista) {
    if (!mapa.has(f.cliente_id)) mapa.set(f.cliente_id, vacia(f.cliente_id, f.cliente_nombre || String(f.cliente_id)))
    const fila = mapa.get(f.cliente_id)!
    const c = Number(f.comprometido || 0)
    const e = Number(f.entregado || 0)
    fila.celdas[String(f.tipo_contenido)] = { comprometido: c, entregado: e }
    fila.comprometido += c
    fila.entregado += e
    fila.en_revision += Number(f.en_revision || 0)
    fila.en_produccion += Number(f.en_produccion || 0)
  }

  const filas = [...mapa.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))
  const totales = vacia('__total__', 'TOTAL')
  for (const fila of filas) {
    fila.pct = piolaPct(fila.entregado, fila.comprometido)
    fila.ritmo = piolaRitmo(fila.pct, esperado, fila.comprometido)
    totales.comprometido += fila.comprometido
    totales.entregado += fila.entregado
    totales.en_revision += fila.en_revision
    totales.en_produccion += fila.en_produccion
    for (const [codigo, celda] of Object.entries(fila.celdas)) {
      const t = (totales.celdas[codigo] = totales.celdas[codigo] || { comprometido: 0, entregado: 0 })
      t.comprometido += celda.comprometido
      t.entregado += celda.entregado
    }
  }
  totales.pct = piolaPct(totales.entregado, totales.comprometido)
  totales.ritmo = piolaRitmo(totales.pct, esperado, totales.comprometido)
  return { columnas, filas, totales, esperado }
}

/* ══════════════════ Matriz del tablero (estado × tipo) ══════════════════ */

export interface EntregableReporte {
  titulo: string
  marca: string
  tipo: string          // código del tipo
  area: string
  responsable: string
  estado: string        // código del estado
  fecha: string
  cantidad: number
}

/** "Vamos en producción 5 guiones y 7 piezas gráficas, en revisión…": piezas por estado y tipo. */
export function piolaMatrizEstadoTipo(items: EntregableReporte[]) {
  const matriz: Record<string, Record<string, number>> = {}
  for (const e of items) {
    const est = (matriz[e.estado] = matriz[e.estado] || {})
    const tipo = e.tipo || 'sin_clasificar'
    est[tipo] = (est[tipo] || 0) + Number(e.cantidad || 1)
  }
  return matriz
}

/* ══════════════════ Reporte imprimible ══════════════════ */

export const piolaEscaparHtml = (v: any): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export interface OpcionesReporte {
  titulo: string
  subtitulo: string
  generado: string
  kpi?: KpiTabla
  esperado?: number
  /** 'YYYY-MM': arma el título "KPI Y SEGUIMIENTO AGENCIA PIOLA {MES} {AÑO}" de la tabla de KPIs */
  periodo?: string
  matriz?: { estados: { value: string; title: string }[]; tipos: { codigo: string; nombre: string }[]; datos: Record<string, Record<string, number>> }
  entregables?: EntregableReporte[]
  nombreTipo: (codigo: string) => string
  nombreEstado: (codigo: string) => string
}

/**
 * HTML autocontenido para imprimir o guardar como PDF desde el navegador (el proyecto no tiene
 * librería de PDF: mismo criterio que boletas y facturas de Piola). Todo texto que escribe una
 * persona (títulos, marcas, responsables) pasa por piolaEscaparHtml.
 */
export function piolaReporteHtml(o: OpcionesReporte): string {
  const esc = piolaEscaparHtml
  const partes: string[] = []

  if (o.kpi) {
    const k = o.kpi
    const titulo = o.periodo ? piolaTituloKpi(o.periodo) : 'KPI Y SEGUIMIENTO AGENCIA PIOLA'
    const cab = k.columnas.map(c => `<th class="tipo">${esc(c.nombre)}</th>`).join('')
    // Cada columna de tipo muestra lo COMPROMETIDO (como el Excel); 0 si esa marca no lo tiene pactado
    const celda = (c?: KpiCelda) => {
      const n = c?.comprometido || 0
      return `<td class="num${n ? '' : ' cero'}">${n}</td>`
    }
    const fila = (f: KpiFila) => `
      <tr>
        <td class="cliente">${esc(f.cliente)}</td>
        ${k.columnas.map(c => celda(f.celdas[c.codigo])).join('')}
        <td class="num"><b>${f.comprometido}</b></td>
        <td class="num"><b>${f.entregado}</b></td>
        <td class="num pct" style="color:${PIOLA_RITMO_COLOR[f.ritmo]}">${piolaPctTexto(f.entregado, f.comprometido)}</td>
      </tr>`
    const t = k.totales
    partes.push(`
      <h2>Cumplimiento por marca</h2>
      <p class="nota">Avance esperado hoy: <b>${o.esperado ?? k.esperado} %</b> del mes. Cuenta como entregado lo aprobado por Dirección y lo entregado.
        El % de avance va en verde si la marca está al día, naranja si está en riesgo y rojo si está atrasada frente a ese ritmo.</p>
      <table class="kpi">
        <thead>
          <tr><th class="banner" colspan="${k.columnas.length + 4}">${esc(titulo)}</th></tr>
          <tr><th class="cli">CLIENTE</th>${cab}<th class="cum">PIEZAS MENSUALES</th><th class="cum">AVANCE</th><th class="cum">% DE AVANCE</th></tr>
        </thead>
        <tbody>${k.filas.filter(f => f.comprometido || Object.keys(f.celdas).length).map(f => fila(f)).join('')}</tbody>
        <tfoot>
          <tr class="totales">
            <td colspan="${k.columnas.length + 1}">TOTALES</td>
            <td class="num">${t.comprometido}</td><td class="num">${t.entregado}</td><td class="num">${piolaPctTexto(t.entregado, t.comprometido)}</td>
          </tr>
        </tfoot>
      </table>`)
  }

  if (o.matriz) {
    const m = o.matriz
    const tiposUsados = m.tipos.filter(t => m.estados.some(e => (m.datos[e.value] || {})[t.codigo]))
    partes.push(`
      <h2>Piezas por estado</h2>
      <table>
        <thead><tr><th>Estado</th>${tiposUsados.map(t => `<th>${esc(t.nombre)}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>${m.estados.map(e => {
          const fila = m.datos[e.value] || {}
          const total = Object.values(fila).reduce((a, b) => a + b, 0)
          return `<tr><td class="marca">${esc(e.title)}</td>${tiposUsados.map(t => `<td class="num">${fila[t.codigo] || '—'}</td>`).join('')}<td class="num"><b>${total || '—'}</b></td></tr>`
        }).join('')}</tbody>
      </table>`)
  }

  if (o.entregables) {
    partes.push(`
      <h2>Entregables (${o.entregables.length})</h2>
      <table>
        <thead><tr><th>Título</th><th>Marca</th><th>Tipo</th><th>Área</th><th>Responsable</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>${o.entregables.map(e => `<tr>
          <td>${esc(e.titulo)}${e.cantidad > 1 ? ` <span class="nota">×${e.cantidad}</span>` : ''}</td>
          <td>${esc(e.marca)}</td><td>${esc(o.nombreTipo(e.tipo))}</td><td>${esc(e.area || '—')}</td>
          <td>${esc(e.responsable || 'Sin asignar')}</td><td>${esc(o.nombreEstado(e.estado))}</td><td>${esc(e.fecha || '—')}</td>
        </tr>`).join('')}</tbody>
      </table>`)
  }

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(o.titulo)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1b1b1b; margin: 28px; font-size: 12px; }
  header { border-bottom: 3px solid #e2564a; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 20px; margin: 0; }
  header p { margin: 4px 0 0; color: #555; }
  h2 { font-size: 14px; margin: 22px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #2f7d4f; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  td.marca { font-weight: 600; }
  td.num { text-align: right; white-space: nowrap; }
  /* Tabla de KPIs: mismos colores que el Excel (cliente en verde, encabezados amarillo y azul) */
  table.kpi th, table.kpi td { border: 1px solid #222; text-align: center; padding: 6px 8px; }
  table.kpi th { color: #111; font-size: 11px; text-transform: uppercase; }
  table.kpi th.banner { background: #111; color: #fff; font-size: 13px; letter-spacing: .4px; }
  table.kpi th.cli, table.kpi th.cum { background: #fff200; }
  table.kpi th.tipo { background: #3a75c4; color: #fff; }
  table.kpi td.cliente { background: #3cb54a; color: #111; font-weight: 700; text-align: left; }
  table.kpi td.cero { color: #aaa; }
  table.kpi td.pct { font-weight: 700; }
  table.kpi tr.totales td { background: #fff200; color: #111; font-weight: 700; font-size: 12.5px; }
  table.kpi tr.totales td:first-child { text-align: right; letter-spacing: .5px; }
  .nota { color: #666; font-size: 11px; }
  footer { margin-top: 24px; color: #888; font-size: 10.5px; }
  @media print { body { margin: 12mm; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head>
<body>
  <header><h1>${esc(o.titulo)}</h1><p>${esc(o.subtitulo)}</p></header>
  ${partes.join('\n')}
  <footer>Generado el ${esc(o.generado)} desde el dashboard de Piola.</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 250) })<\/script>
</body></html>`
}
