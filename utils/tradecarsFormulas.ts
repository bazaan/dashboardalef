/**
 * Trade Cars — fórmulas del Excel de operaciones aplicadas a las tablas del dashboard
 * ----------------------------------------------------------------------------------
 * Pedido en la reunión de septiembre/2026: las tablas de COMPRAS y VENTAS se cargaron
 * desde el Excel (hojas "COMPRAS" y "VENTAS") con los valores ya calculados, pero las
 * columnas que en el Excel eran fórmulas quedaron como números sueltos: si alguien
 * editaba un precio, el resto no se enteraba. "Todo esto es ya matemática": acá viven
 * esas cuentas, para que se recalculen solas al editar.
 *
 * CADA fórmula de este archivo se validó contra los valores guardados en la base
 * (que salieron del Excel): se recalculó fila por fila sobre las 1.307 compras y las
 * 1.305 ventas y se comparó. Solo se aplican las que reproducen el Excel (≥99 %):
 *
 *   COMPRAS  valor_de_compra 100 % · total_gastos_extras_reales 99,5 % · costo_total_sin_igv
 *            99,5 % · costo_total_total_provision 99,5 % · rango_de_inv 99,8 % · status 99,8 %
 *            · igv_compra 100 % · costo_total 99,3 % · notariales_2 100 % · costo_total_notariales
 *            99,3 % · y las columnas espejo del bloque secundario (100 %). El `concat` (placa-N) solo
 *            se arma en filas nuevas: es la llave compra↔venta y nunca se reescribe.
 *   VENTAS   valor_compra 99,8 % · igv_compra 100 % · costo_total_notariales 99,9 % ·
 *            margen_bruto 99,9 % · margen_bruto_pct 99,2 % · dias_inventario 99,6 %.
 *
 * LO QUE NO SE RECALCULA (a propósito): en el Excel esas columnas NO siguen una sola
 * fórmula, y aplicarla cambiaría números que la empresa ya reportó:
 *   - VENTAS: comision_de_venta, igv_venta, valor_venta, revenue y los margen_sin_igv.
 *     La comisión de un cliente NATURAL cambia de una fila a otra (a veces (venta-costo)/1,18,
 *     a veces un monto fijo como 500/1,18): solo 389 de 994 filas siguen la fórmula general.
 *   - VENTAS: costo_total_usd (90 %: en algunas filas incluye notariales, en otras no).
 *   - COMPRAS: costo_total_gastos_extras_real (95 %: la fórmula suma o no la comisión de
 *     referido según la fila).
 * Esas siguen siendo datos que se escriben; el resto se calcula.
 *
 * Igual que en Excel: la comparación de textos no distingue mayúsculas pero SÍ acentos.
 * Por eso "CONSIGNACIÓN" (con tilde) no cuenta como "CONSIGNACION" en notariales_2: 14
 * filas del histórico dependen de ese detalle y así es como quedaron sus números.
 *
 * Vive en `utils/` (auto-import de Nuxt) para que el servidor (que guarda los valores) y
 * las pantallas (que los muestran en vivo mientras se edita) usen exactamente la misma cuenta.
 */

/* ══════════════════ Utilidades ══════════════════ */

const tiene = (v: any): boolean => v !== null && v !== undefined && String(v).trim() !== ''

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

const mayus = (v: any): string => String(v ?? '').trim().toUpperCase()

/** Como el "=" de Excel: no distingue mayúsculas, SÍ distingue acentos. */
const igualExcel = (v: any, literal: string): boolean => mayus(v) === literal.toUpperCase()

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** JURÍDICA / NATURAL / TÍTULO PERSONAL con o sin tilde (en la base solo existe la forma con tilde). */
const esTipo = (v: any, tipo: string): boolean => sinAcentos(mayus(v)) === sinAcentos(tipo)

const redondear = (n: number): number => Math.round(n * 1e6) / 1e6

/** Fecha YYYY-MM-DD → milisegundos UTC (mediodía). null si no es una fecha. */
function aMs(v: any): number | null {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
}

/** Diferencia en días enteros entre dos fechas YYYY-MM-DD (a - b). null si alguna no es fecha. */
export function tcDiferenciaDias(a: any, b: any): number | null {
  const x = aMs(a)
  const y = aMs(b)
  return x === null || y === null ? null : Math.round((x - y) / 86400000)
}

/**
 * Al EDITAR una fila que ya existe, solo se escriben las columnas calculadas cuyo resultado
 * cambió por la edición (o que estaban vacías). Así, corregir un color en una de las pocas filas
 * donde alguien escribió un total a mano no pisa ese total: solo se recalcula lo que la edición
 * realmente afecta.
 *   nuevo   = calculado con la fila ya editada
 *   viejo   = calculado con la fila tal como estaba guardada
 *   previo  = la fila guardada
 */
export function tcSoloCambios(
  nuevo: Record<string, any>, viejo: Record<string, any>, previo: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, val] of Object.entries(nuevo)) {
    const antes = viejo[k]
    const distinto = typeof val === 'number' && typeof antes === 'number'
      ? Math.abs(val - antes) > 1e-6
      : val !== antes
    if (distinto || !tiene(previo[k])) out[k] = val
  }
  return out
}

/* ══════════════════ COMPRAS ══════════════════ */

/** Los 13 gastos "reales" que suma el Excel en TOTAL GASTOS EXTRAS REALES (columnas AN…AZ). */
export const TC_COMPRA_GASTOS_REALES = [
  'impuesto_vehicular_prov', 'soat_2', 'rtv_2', 'multa_sat_2', 'multa_callao_2', 'multa_sutran_2',
  'levantamiento_de_prenda_2', 'otros_gastos_documentales_2', 'arreglos_esteticos_2',
  'arreglos_mecanicos_2', 'lavado_de_salon_2', 'tratamiento_de_pintura_2', 'otros_gastos',
] as const

/** Espejos del bloque secundario ("resumen / valorizado de stock"): destino ← origen. */
const COMPRA_ESPEJOS: [string, string][] = [
  ['placa_ii', 'placa'], ['placa_iii', 'placa'],
  ['marca_2', 'marca'], ['modelo_2', 'modelo'], ['version_2', 'version'], ['color_2', 'color'],
  ['tipo_de_vehiculo_2', 'tipo_de_vehiculo'], ['combustible', 'tipo_de_combustible'],
  ['transmision_2', 'transmision'], ['km', 'kilometraje'], ['ano_fab', 'ano'],
  ['tipo_compra_retoma_2', 'tipo_compra_retoma'], ['tipo_de_compra_2', 'tipo_de_compra'],
  ['a_nombre_de_2', 'a_nombre_de'],
  ['fecha_compra', 'fecha_de_compra'], ['fecha_de_compra_2', 'fecha_de_compra'],
  ['adquisicion', 'precio_de_compra_valor_acta'], ['comision_compra', 'comision_referido'],
]

/** Estados que alguien escribe a mano y la fórmula del Excel nunca pisa. */
const STATUS_MANUALES = ['PÉRDIDA', 'PERDIDA', 'NO APLICA', '-']

export interface ContextoCompra {
  /** true si existe una venta registrada con el mismo `concat` (placa-N) que esta compra. */
  tieneVenta?: boolean
  /** Siguiente número de compra para la placa (para una compra nueva). */
  siguienteNCompra?: number
}

/** Columnas de COMPRAS que se calculan (para marcarlas como "calculado" en la ficha). */
export const TC_COMPRA_CALCULADOS: string[] = [
  'valor_de_compra', 'total_gastos_extras_reales', 'costo_total_sin_igv', 'costo_total_total_provision',
  'rango_de_inv', 'status',
  'igv_compra', 'costo_total', 'notariales_2', 'costo_total_notariales',
  ...COMPRA_ESPEJOS.map(([dst]) => dst),
  'valor_de_compra_2', 'gastos_extras', 'status_ii', 'status_ii_2',
  'costo_total_gastos_extras_real_2', 'costo_total_real_total_provision',
]

/**
 * Devuelve SOLO las columnas calculadas de una compra a partir de los datos de la fila
 * (la fila ya mezclada con lo que se acaba de editar). No modifica `f`.
 */
export function tcCalcularCompra(f: Record<string, any>, ctx: ContextoCompra = {}): Record<string, any> {
  const out: Record<string, any> = {}
  const v = (k: string) => (k in out ? out[k] : f[k])

  // N° de compra y concat = placa-N. El concat es la llave que une una compra con su venta: solo se
  // arma cuando NO existe. Nunca se reescribe uno existente (en 4 compras y 9 ventas del histórico
  // el concat no coincide con placa-N y romperlo desconectaría la compra de su venta).
  if (!tiene(f.n_compra) && ctx.siguienteNCompra !== undefined) out.n_compra = ctx.siguienteNCompra
  if (!tiene(f.concat) && tiene(f.placa) && tiene(v('n_compra'))) {
    out.concat = `${String(f.placa).trim()}-${Math.round(num(v('n_compra')))}`
  }

  // VALOR DE COMPRA: una persona jurídica factura con IGV incluido en el precio del acta
  if (tiene(f.precio_de_compra_valor_acta)) {
    const acta = num(f.precio_de_compra_valor_acta)
    out.valor_de_compra = redondear(esTipo(f.tipo_de_compra, 'JURÍDICA') ? acta / 1.18 : acta)
  }

  // TOTAL GASTOS EXTRAS REALES: la suma de los 13 gastos. Si no se detalló ninguno, se respeta el
  // total que alguien escribió a mano (en el histórico viejo solo se anotaba el total).
  if (TC_COMPRA_GASTOS_REALES.some(k => tiene(f[k]))) {
    out.total_gastos_extras_reales = redondear(TC_COMPRA_GASTOS_REALES.reduce((a, k) => a + num(f[k]), 0))
  }

  // COSTO TOTAL SIN IGV = valor de compra + comisión de referido + notariales + gastos reales
  if (tiene(v('valor_de_compra')) || tiene(v('total_gastos_extras_reales'))) {
    out.costo_total_sin_igv = redondear(
      num(v('valor_de_compra')) + num(f.comision_referido) + num(f.notariales) + num(v('total_gastos_extras_reales')))
  }

  // COSTO TOTAL + TOTAL PROVISIÓN = acta + notariales + gastos provisionados + comisión de referido
  if (tiene(f.precio_de_compra_valor_acta) || tiene(f.total_gastos_extras_prov)) {
    out.costo_total_total_provision = redondear(
      num(f.precio_de_compra_valor_acta) + num(f.notariales) + num(f.total_gastos_extras_prov) + num(f.comision_referido))
  }

  // RANGO DE INV. según el costo total + provisión ("NO APLICA" escrito a mano se respeta)
  if (tiene(v('costo_total_total_provision')) && !igualExcel(f.rango_de_inv, 'NO APLICA')) {
    const c = num(v('costo_total_total_provision'))
    out.rango_de_inv = c > 15000 ? '>15000' : c > 10000 ? 'ENTRE 15K Y 10K' : '<10K'
  }

  // STATUS: VENDIDO si ya hay una venta de esta compra, si no EN STOCK (PÉRDIDA / NO APLICA / - son manuales)
  if (ctx.tieneVenta !== undefined && !STATUS_MANUALES.some(s => igualExcel(f.status, s))) {
    out.status = ctx.tieneVenta ? 'VENDIDO' : 'EN STOCK'
  }

  // ── Bloque secundario ("resumen / valorizado de stock"): copias y cuentas derivadas ──
  for (const [dst, src] of COMPRA_ESPEJOS) {
    if (tiene(v(src))) out[dst] = v(src)
  }
  if (tiene(v('valor_de_compra'))) out.valor_de_compra_2 = v('valor_de_compra')
  if (tiene(v('total_gastos_extras_reales'))) out.gastos_extras = v('total_gastos_extras_reales')
  if (tiene(v('status'))) { out.status_ii = v('status'); out.status_ii_2 = v('status') }
  if (tiene(f.costo_total_gastos_extras_real)) out.costo_total_gastos_extras_real_2 = f.costo_total_gastos_extras_real
  if (tiene(v('costo_total_total_provision'))) out.costo_total_real_total_provision = v('costo_total_total_provision')

  // IGV COMPRA (solo personas jurídicas)
  if (tiene(v('tipo_de_compra_2')) || tiene(v('valor_de_compra_2'))) {
    out.igv_compra = redondear(esTipo(v('tipo_de_compra_2'), 'JURÍDICA') ? num(v('valor_de_compra_2')) * 0.18 : 0)
  }
  // COSTO TOTAL = adquisición + comisión de compra + comisión de venta + gastos extras
  if (tiene(v('adquisicion')) || tiene(v('gastos_extras'))) {
    out.costo_total = redondear(num(v('adquisicion')) + num(v('comision_compra')) + num(f.comision_venta) + num(v('gastos_extras')))
  }
  // NOTARIALES: S/ 100 por trámite, salvo consignación (compara con "CONSIGNACION" sin tilde, como el Excel)
  if (tiene(v('tipo_de_compra_2'))) out.notariales_2 = igualExcel(v('tipo_de_compra_2'), 'CONSIGNACION') ? 0 : 100
  if (tiene(v('costo_total')) && tiene(v('notariales_2'))) {
    out.costo_total_notariales = redondear(num(v('costo_total')) + num(v('notariales_2')))
  }

  return out
}

/**
 * Valores que CAMBIAN CON LA FECHA (en el Excel son fórmulas con HOY()) y por eso no se guardan:
 * se calculan al mostrar. `hoy` = YYYY-MM-DD en hora de Lima.
 *   dias                 días que faltan para vencer el SOAT
 *   vencimiento_de_rtv   días que faltan para vencer la RTV (la columna guarda los días, no la fecha)
 *   dias_de_inv          días en inventario
 * Un carro ya vendido devuelve "NO APLICA" como en el Excel.
 */
export function tcCompraVivos(f: Record<string, any>, hoy: string): Record<string, any> {
  const out: Record<string, any> = {}
  const vendido = igualExcel(f.status, 'VENDIDO')

  if (tiene(f.vencimiento_soat)) {
    const d = tcDiferenciaDias(f.vencimiento_soat, hoy)
    out.dias = vendido ? 'NO APLICA' : (d !== null ? String(d) : f.dias)
  }
  if (tiene(f.rtv_3)) {
    if (igualExcel(f.rtv_3, 'NO APLICA') || vendido) out.vencimiento_de_rtv = 'NO APLICA'
    else {
      const d = tcDiferenciaDias(f.rtv_3, hoy)
      if (d !== null) out.vencimiento_de_rtv = String(d)
    }
  }
  if (tiene(f.fecha_de_compra_2) && !vendido && !STATUS_MANUALES.some(s => igualExcel(f.status, s))) {
    const d = tcDiferenciaDias(hoy, f.fecha_de_compra_2)
    if (d !== null) out.dias_de_inv = d
  }
  return out
}

/* ══════════════════ VENTAS ══════════════════ */

/** Columnas de VENTAS que se calculan. */
export const TC_VENTA_CALCULADOS: string[] = [
  'valor_compra_usd', 'igv_compra_usd', 'costo_total_notariales_usd',
  'margen_bruto_usd', 'margen_bruto_pct', 'dias_inventario',
]

/** Devuelve SOLO las columnas calculadas de una venta (ver el encabezado: hay columnas que no se calculan). */
export function tcCalcularVenta(f: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  const v = (k: string) => (k in out ? out[k] : f[k])

  // concat = placa-N de la venta; solo se arma si no existe (es la llave que la une con su compra)
  if (!tiene(f.concat) && tiene(f.placa) && tiene(f.numero_venta)) {
    out.concat = `${String(f.placa).trim()}-${Math.round(num(f.numero_venta))}`
  }

  // VALOR COMPRA (sin IGV si compró una persona jurídica) e IGV de la compra
  if (tiene(f.adquisicion_usd)) {
    const adq = num(f.adquisicion_usd)
    out.valor_compra_usd = redondear(esTipo(f.tipo_compra, 'JURÍDICA') ? adq / 1.18 : adq)
    out.igv_compra_usd = redondear(esTipo(f.tipo_compra, 'JURÍDICA') ? num(out.valor_compra_usd) * 0.18 : 0)
  }

  // COSTO TOTAL + NOTARIALES (el costo total se escribe: no siempre incluye lo mismo)
  if (tiene(f.costo_total_usd)) out.costo_total_notariales_usd = redondear(num(f.notariales_usd) + num(f.costo_total_usd))

  // MARGEN BRUTO = precio de venta - costo total - notariales
  if (tiene(f.precio_venta_usd) && tiene(f.costo_total_usd)) {
    const margen = num(f.precio_venta_usd) - num(f.costo_total_usd) - num(f.notariales_usd)
    out.margen_bruto_usd = redondear(margen)
    if (num(f.precio_venta_usd) !== 0) out.margen_bruto_pct = redondear(margen / num(f.precio_venta_usd))
  }

  // DÍAS DE INVENTARIO = fecha de venta - fecha de compra
  const dias = tcDiferenciaDias(f.fecha_venta, f.fecha_compra)
  if (dias !== null) out.dias_inventario = dias

  return out
}
