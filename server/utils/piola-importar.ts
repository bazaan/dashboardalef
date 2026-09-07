/**
 * PIOLA — Importación de movimientos financieros desde Excel/CSV.
 *
 * El archivo de administración tiene su propia estructura y su propia
 * nomenclatura ("IMPORTE" acá, "MONTO" allá, ingresos y egresos en dos
 * columnas o en una sola con signo). Nada de eso está en el código: el mapeo
 * columna → campo vive en `piola_import_plantillas` y se edita desde la
 * pantalla. Este archivo solo sabe interpretar los CAMPOS del sistema.
 *
 * CAMPOS RECONOCIDOS
 *   fecha · concepto · tipo · categoria · monto · monto_ingreso · monto_egreso
 *   subtotal · proveedor · cliente · ruc · documento_serie · documento_numero
 *   payment_method · area · centro_costo · notas · responsable_email
 *
 * DOS PASADAS SIEMPRE
 *   1. `interpretarFilas()` — sin tocar la base. Es lo que alimenta la vista
 *      previa: la persona ve exactamente lo que se va a cargar y qué filas
 *      tienen problema.
 *   2. La confirmación inserta. Importar a ciegas una hoja de contabilidad es
 *      la clase de error que se descubre un mes después, cuadrando caja.
 */
import { createHash } from 'node:crypto'

export const CAMPOS_IMPORTABLES = [
  { campo: 'fecha', label: 'Fecha', requerido: true },
  { campo: 'concepto', label: 'Concepto / descripción', requerido: true },
  { campo: 'tipo', label: 'Tipo (ingreso/egreso)', requerido: false },
  { campo: 'monto', label: 'Importe (una sola columna)', requerido: false },
  { campo: 'monto_ingreso', label: 'Importe — columna de ingresos', requerido: false },
  { campo: 'monto_egreso', label: 'Importe — columna de egresos', requerido: false },
  { campo: 'subtotal', label: 'Subtotal (sin IGV)', requerido: false },
  { campo: 'categoria', label: 'Categoría (nombre o código)', requerido: false },
  { campo: 'proveedor', label: 'Proveedor', requerido: false },
  { campo: 'cliente', label: 'Cliente', requerido: false },
  { campo: 'ruc', label: 'RUC', requerido: false },
  { campo: 'documento_serie', label: 'Serie del documento', requerido: false },
  { campo: 'documento_numero', label: 'Número del documento', requerido: false },
  { campo: 'payment_method', label: 'Medio de pago', requerido: false },
  { campo: 'area', label: 'Área', requerido: false },
  { campo: 'centro_costo', label: 'Centro de costo', requerido: false },
  { campo: 'responsable_email', label: 'Responsable (correo)', requerido: false },
  { campo: 'notas', label: 'Observaciones', requerido: false },
  { campo: '', label: '— No importar —', requerido: false },
] as const

export interface OpcionesImport {
  /** Fila del encabezado, base 1. */
  fila_encabezado?: number
  /** 'auto' | 'dmy' | 'mdy' | 'ymd' */
  formato_fecha?: string
  /** ',' o '.' — separador decimal del archivo */
  decimal?: string
  /**
   * Cómo se distingue un egreso:
   *   'columna' → hay columnas separadas de ingreso y egreso
   *   'signo'   → una sola columna y el negativo es egreso
   *   'texto'   → lo dice la columna `tipo`
   */
  signo_egreso?: string
  /** Crear las categorías que no existan en vez de dejar la fila sin categoría */
  crear_categorias?: boolean
  /** Tipo por defecto cuando la fila no lo dice de ninguna forma */
  tipo_default?: string
}

export interface FilaInterpretada {
  fila: number                       // número de fila del archivo (base 1)
  ok: boolean
  errores: string[]
  avisos: string[]
  datos: {
    fecha: string
    concepto: string
    tipo: 'ingreso' | 'egreso'
    monto: number
    subtotal: number | null
    categoria_texto: string | null
    proveedor: string | null
    cliente: string | null
    ruc: string | null
    documento_serie: string | null
    documento_numero: string | null
    payment_method: string | null
    area: string | null
    centro_costo: string | null
    responsable_email: string | null
    notas: string | null
  }
  hash: string
  crudo: Record<string, any>
}

/* ══════════════════ Normalizadores ══════════════════ */

/** Compara cabeceras ignorando tildes, mayúsculas, espacios y puntuación. */
export function normalizarCabecera(v: any): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const texto = (v: any): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s && s.toLowerCase() !== 'null' ? s : null
}

/**
 * Número desde una celda de Excel o una cadena tipeada a mano.
 *
 * Soporta 'S/ 1,250.50', '1.250,50', '(320.00)' —el paréntesis contable es
 * negativo— y el número puro que ya viene bien del .xlsx.
 */
export function aNumero(v: any, decimal = '.'): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null

  let s = String(v).trim()
  if (!s) return null

  const negativoContable = /^\(.*\)$/.test(s)
  if (negativoContable) s = s.slice(1, -1)

  s = s.replace(/[^\d.,\-+]/g, '')          // fuera 'S/', espacios, letras
  if (!s) return null

  if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativoContable ? -Math.abs(n) : n
}

/**
 * Fecha desde una celda. Devuelve 'YYYY-MM-DD' o null.
 *
 * El .xlsx ya llega convertido por el lector; acá se cubre lo tipeado a mano y
 * los CSV. En 'auto', un primer componente mayor a 12 desambigua solo
 * (13/04 solo puede ser día/mes); si no, manda el formato peruano dd/mm.
 */
export function aFecha(v: any, formato = 'auto'): string | null {
  if (v === null || v === undefined || v === '') return null

  // Número de serie de Excel suelto (CSV exportado sin formato)
  if (typeof v === 'number' && v > 20_000 && v < 60_000) {
    const d = new Date(Math.round((v - 25569) * 86_400_000))
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }

  const s = String(v).trim()
  if (!s) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const partes = /^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{2,4})/.exec(s)
  if (partes) {
    let [, a, b, c] = partes
    let dia: number, mes: number, anio: number

    if (a.length === 4) { anio = +a; mes = +b; dia = +c }          // 2026/03/15
    else if (formato === 'mdy') { mes = +a; dia = +b; anio = +c }
    else if (formato === 'ymd') { anio = +a; mes = +b; dia = +c }
    else if (formato === 'auto' && +a > 12 && +b <= 12) { dia = +a; mes = +b; anio = +c }
    else if (formato === 'auto' && +b > 12 && +a <= 12) { mes = +a; dia = +b; anio = +c }
    else { dia = +a; mes = +b; anio = +c }                          // Perú: dd/mm

    if (anio < 100) anio += anio < 70 ? 2000 : 1900
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const PALABRAS_INGRESO = ['ingreso', 'venta', 'cobro', 'abono', 'entrada', 'deposito', 'depósito', 'haber']
const PALABRAS_EGRESO = ['egreso', 'gasto', 'compra', 'pago', 'salida', 'retiro', 'debe']

function tipoDesdeTexto(v: any): 'ingreso' | 'egreso' | null {
  const s = normalizarCabecera(v)
  if (!s) return null
  if (PALABRAS_INGRESO.some(p => s.includes(normalizarCabecera(p)))) return 'ingreso'
  if (PALABRAS_EGRESO.some(p => s.includes(normalizarCabecera(p)))) return 'egreso'
  return null
}

/**
 * Huella de la fila, para que re-subir el mismo archivo no duplique la caja.
 *
 * Entra lo que identifica al movimiento en el mundo real: fecha, concepto,
 * tipo, monto y el documento. NO entra el número de fila: mover una fila en el
 * Excel no la convierte en un movimiento nuevo.
 */
export function hashFila(d: FilaInterpretada['datos']): string {
  const clave = [
    d.fecha, d.tipo, d.monto.toFixed(2),
    normalizarCabecera(d.concepto),
    normalizarCabecera(d.documento_serie), normalizarCabecera(d.documento_numero),
  ].join('|')
  return createHash('sha1').update(clave).digest('hex')
}

/* ══════════════════ Interpretación ══════════════════ */

/**
 * Convierte las filas crudas del archivo en movimientos candidatos.
 *
 * `mapeo` es { cabecera del archivo → campo del sistema }. Se compara
 * normalizado, así que 'CATEGORÍA', 'categoria' y 'Categoria ' son la misma.
 */
export function interpretarFilas(
  filas: any[][],
  mapeo: Record<string, string>,
  opciones: OpcionesImport = {},
): { cabeceras: string[]; resultado: FilaInterpretada[] } {
  const filaEncabezado = Math.max(1, Number(opciones.fila_encabezado || 1))
  const decimal = opciones.decimal === ',' ? ',' : '.'
  const formatoFecha = opciones.formato_fecha || 'auto'
  const tipoDefault = opciones.tipo_default === 'ingreso' ? 'ingreso' : 'egreso'

  const cabeceras = (filas[filaEncabezado - 1] || []).map(c => String(c ?? '').trim())

  // cabecera normalizada → campo
  const porNormal = new Map<string, string>()
  for (const [cab, campo] of Object.entries(mapeo || {})) {
    if (campo) porNormal.set(normalizarCabecera(cab), campo)
  }
  // índice de columna → campo
  const columnaCampo = new Map<number, string>()
  cabeceras.forEach((cab, i) => {
    const campo = porNormal.get(normalizarCabecera(cab))
    if (campo) columnaCampo.set(i, campo)
  })

  const resultado: FilaInterpretada[] = []

  for (let i = filaEncabezado; i < filas.length; i++) {
    const cruda = filas[i] || []
    if (!cruda.some(c => c !== null && c !== undefined && String(c).trim() !== '')) continue

    const val: Record<string, any> = {}
    const crudo: Record<string, any> = {}
    cruda.forEach((celda, col) => {
      if (cabeceras[col]) crudo[cabeceras[col]] = celda
      const campo = columnaCampo.get(col)
      if (!campo) return
      // Dos columnas mapeadas al mismo campo (DETALLE y CONCEPTO): gana la
      // primera con contenido, en vez de que la vacía pise a la buena.
      if (val[campo] === undefined || val[campo] === null || val[campo] === '') val[campo] = celda
    })

    const errores: string[] = []
    const avisos: string[] = []

    const fecha = aFecha(val.fecha, formatoFecha)
    if (!fecha) errores.push(val.fecha ? `Fecha no reconocida: "${val.fecha}"` : 'Falta la fecha')

    const concepto = texto(val.concepto)
    if (!concepto) errores.push('Falta el concepto')

    /* ── Importe y tipo: tres formas de decir lo mismo ── */
    const nIngreso = aNumero(val.monto_ingreso, decimal)
    const nEgreso = aNumero(val.monto_egreso, decimal)
    const nUnico = aNumero(val.monto, decimal)

    let tipo = tipoDesdeTexto(val.tipo) || null
    let monto: number | null = null
    // ¿El tipo salió del archivo o lo pusimos nosotros? Se avisa cuando se
    // asume: una fila cargada como egreso siendo ingreso invierte el resultado
    // del mes, y nadie lo nota si el sistema no lo dice.
    let tipoAsumido = !tipo

    if (nIngreso !== null && nIngreso !== 0) {
      monto = Math.abs(nIngreso)
      if (!tipo) { tipo = 'ingreso'; tipoAsumido = false }   // la columna misma lo dice
    } else if (nEgreso !== null && nEgreso !== 0) {
      monto = Math.abs(nEgreso)
      if (!tipo) { tipo = 'egreso'; tipoAsumido = false }
    } else if (nUnico !== null) {
      monto = Math.abs(nUnico)
      if (!tipo && nUnico < 0) { tipo = 'egreso'; tipoAsumido = false }   // el signo lo dice
      else if (!tipo) tipo = opciones.signo_egreso === 'signo' ? 'ingreso' : tipoDefault
    }

    if (monto === null) errores.push('Falta el importe')
    else if (monto === 0) errores.push('El importe es 0')

    if (!tipo) tipo = tipoDefault
    if (tipoAsumido) avisos.push(`El archivo no dice el tipo: se asume ${tipo}`)

    const subtotal = aNumero(val.subtotal, decimal)
    if (subtotal !== null && monto !== null && subtotal > monto + 0.01) {
      avisos.push('El subtotal es mayor que el total')
    }

    const datos: FilaInterpretada['datos'] = {
      fecha: fecha || '',
      concepto: concepto || '',
      tipo: tipo as 'ingreso' | 'egreso',
      monto: monto ?? 0,
      subtotal,
      categoria_texto: texto(val.categoria),
      proveedor: texto(val.proveedor),
      cliente: texto(val.cliente),
      ruc: texto(val.ruc),
      documento_serie: texto(val.documento_serie),
      documento_numero: texto(val.documento_numero) ?? (val.documento_numero != null ? String(val.documento_numero) : null),
      payment_method: texto(val.payment_method),
      area: texto(val.area),
      centro_costo: texto(val.centro_costo),
      responsable_email: texto(val.responsable_email)?.toLowerCase() || null,
      notas: texto(val.notas),
    }

    resultado.push({
      fila: i + 1,
      ok: errores.length === 0,
      errores,
      avisos,
      datos,
      hash: errores.length ? '' : hashFila(datos),
      crudo,
    })
  }

  return { cabeceras, resultado }
}

/**
 * Sugiere un mapeo mirando las cabeceras del archivo.
 *
 * Se usa cuando no hay plantilla elegida: adivina lo evidente para que la
 * persona corrija dos casillas en vez de llenar quince.
 */
export function sugerirMapeo(cabeceras: string[]): Record<string, string> {
  const REGLAS: Array<[RegExp, string]> = [
    [/^fecha|^dia$|^f emision|fecha de/, 'fecha'],
    [/concepto|detalle|descripcion|glosa|motivo/, 'concepto'],
    [/^tipo|movimiento|naturaleza/, 'tipo'],
    [/ingreso|abono|haber|venta/, 'monto_ingreso'],
    [/egreso|salida|debe|gasto|compra/, 'monto_egreso'],
    [/importe|^monto|total|^valor/, 'monto'],
    [/subtotal|base imponible|valor venta/, 'subtotal'],
    [/categoria|rubro|partida|cuenta/, 'categoria'],
    [/proveedor|beneficiario/, 'proveedor'],
    [/cliente|marca/, 'cliente'],
    [/^ruc|documento identidad/, 'ruc'],
    [/serie/, 'documento_serie'],
    [/n? ?documento|nro doc|numero doc|comprobante|factura n/, 'documento_numero'],
    [/medio de pago|forma de pago|metodo|banco/, 'payment_method'],
    [/^area/, 'area'],
    [/centro de costo|centro costo|cc$/, 'centro_costo'],
    [/responsable|encargado/, 'responsable_email'],
    [/observacion|nota|comentario/, 'notas'],
  ]

  const mapeo: Record<string, string> = {}
  const usados = new Set<string>()

  for (const cab of cabeceras) {
    const n = normalizarCabecera(cab)
    if (!n) continue
    for (const [re, campo] of REGLAS) {
      if (!re.test(n)) continue
      // Un campo se asigna una sola vez: si el archivo tiene 'MONTO' y 'TOTAL',
      // manda la primera columna y la otra queda sin mapear a la vista.
      if (usados.has(campo)) break
      mapeo[cab] = campo
      usados.add(campo)
      break
    }
  }
  return mapeo
}
