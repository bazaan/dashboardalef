/**
 * POST /api/tradecars/tasador-datos
 *
 * Carga los datos con los que el Agente Tasador de WhatsApp cotiza, desde un
 * archivo Excel, CSV o PDF que sube el propio cliente.
 *
 * POR QUÉ EXISTE
 * --------------
 * El Tasador lee dos tablas en cada tasación: los comparables históricos
 * (compras y ventas ya cerradas de Trade Cars) y los precios de vehículos 0km.
 * Hasta ahora sólo se podían llenar corriendo un script a mano, así que en la
 * práctica estaban vacías y el agente no podía cotizar nada. Ahora se cargan
 * desde el dashboard y quedan disponibles para la siguiente tasación.
 *
 * CÓMO MAPEA LAS COLUMNAS
 * -----------------------
 * El Excel del cliente no usa nuestros nombres de campo. El mapeo lo propone un
 * modelo mirando SÓLO los encabezados y tres filas de muestra; los valores de
 * las ~9.000 filas nunca pasan por el modelo. Esa división es deliberada: el
 * modelo decide "esta columna es el precio de venta", y el código traslada los
 * datos de forma determinista. Así no puede inventar un precio.
 * El usuario ve el mapeo propuesto y puede corregirlo antes de importar.
 *
 * Acciones (body.accion):
 *   analizar  { destino, archivo_base64, archivo_nombre }
 *             → { headers, muestra, mapeo_sugerido, total_filas }
 *   importar  { destino, archivo_base64, archivo_nombre, mapeo }
 *             → { batch_id, filas_importadas, filas_descartadas, descartes }
 *   deshacer  { batch_id }      → borra sólo las filas de esa carga
 *   listar                      → últimas importaciones
 *
 * destino: 'historico' | 'precios_nuevos'
 *
 * Auth: sesión de Trade Cars con rol admin o superadmin.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import ExcelJS from 'exceljs'
import { extractText, getDocumentProxy } from 'unpdf'
import { verificarSesionTradeCarsEnBase, puedeEditarTasador, logTasador } from '../../utils/tradecars'

const OPENAI_CHAT_API = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.TRADECARS_TASADOR_MODEL || 'gpt-4o'

/** ~9 MB de archivo real. Por encima conviene partirlo: Netlify corta el body. */
const MAX_BASE64 = 12_000_000
const LOTE_INSERT = 500

/* ══════════════════ Definición de los dos destinos ══════════════════ */

type Campo = {
  nombre: string
  tipo: 'texto' | 'numero' | 'entero' | 'fecha' | 'booleano' | 'moneda' | 'estado_produccion'
  desc: string
  requerido?: boolean
}

/**
 * `fijos` son columnas que NO salen del archivo: valen lo mismo para toda fila que se cargue desde acá.
 *
 * En los precios 0km la base restringe `fuente` a manual/wigo/autoland (los dos últimos son los scrapers) y
 * usa `tier` para distinguir el origen: 1 = scraper, 2 = carga manual. Una lista subida a mano por
 * el cliente es una carga manual, igual que las filas que ya había — dejarla entrar como tier 1 (el
 * valor por defecto de la columna) la mezclaría con lo que actualiza el scraper.
 */
const DESTINOS: Record<string, { tabla: string; etiqueta: string; campos: Campo[]; fijos?: Record<string, any> }> = {
  historico: {
    tabla: 'tradecars_data_historico_compras_ventas',
    etiqueta: 'Comparables históricos',
    campos: [
      { nombre: 'marca', tipo: 'texto', desc: 'Marca del vehículo', requerido: true },
      { nombre: 'modelo', tipo: 'texto', desc: 'Modelo', requerido: true },
      { nombre: 'precio_venta_usd', tipo: 'numero', desc: 'Precio al que Trade Cars VENDIÓ el vehículo, en dólares', requerido: true },
      { nombre: 'placa', tipo: 'texto', desc: 'Placa' },
      { nombre: 'version', tipo: 'texto', desc: 'Versión o trim (XEI, GLS, Full…)' },
      { nombre: 'anio_fab', tipo: 'texto', desc: 'Año de fabricación. Se guarda como texto: puede venir "2019" o "2019/2020"' },
      { nombre: 'km', tipo: 'numero', desc: 'Kilometraje' },
      { nombre: 'tipo_vehiculo', tipo: 'texto', desc: 'sedan, hatchback, suv, camioneta, pickup, van…' },
      { nombre: 'transmision', tipo: 'texto', desc: 'MT, AT, CVT o DCT' },
      { nombre: 'fecha_compra', tipo: 'fecha', desc: 'Cuándo lo compró Trade Cars' },
      { nombre: 'fecha_venta', tipo: 'fecha', desc: 'Cuándo lo vendió' },
      { nombre: 'valor_compra_usd', tipo: 'numero', desc: 'Precio al que Trade Cars COMPRÓ el vehículo, en dólares' },
      { nombre: 'margen_bruto_pct', tipo: 'numero', desc: 'Margen bruto en porcentaje' },
      { nombre: 'dias_inventario', tipo: 'numero', desc: 'Días que estuvo en stock entre la compra y la venta' },
    ],
  },
  precios_nuevos: {
    tabla: 'tradecars_data_precios_vehiculos_nuevos',
    etiqueta: 'Precios de vehículos 0km',
    fijos: { fuente: 'manual', tier: 2 },
    campos: [
      { nombre: 'marca', tipo: 'texto', desc: 'Marca', requerido: true },
      { nombre: 'modelo', tipo: 'texto', desc: 'Modelo', requerido: true },
      { nombre: 'precio_nuevo_usd', tipo: 'numero', desc: 'Precio del vehículo 0km en dólares', requerido: true },
      // La base lo exige (NOT NULL, sin valor por defecto): sin año no se puede guardar la fila.
      { nombre: 'anio_modelo', tipo: 'entero', desc: 'Año del modelo', requerido: true },
      { nombre: 'version', tipo: 'texto', desc: 'Versión o trim' },
      { nombre: 'moneda', tipo: 'moneda', desc: 'USD o PEN. Si el archivo no la trae se asume USD' },
      { nombre: 'url_fuente', tipo: 'texto', desc: 'Enlace de donde salió el precio' },
      { nombre: 'estado_produccion', tipo: 'estado_produccion', desc: 'activo o descontinuado. Si el archivo no lo trae se asume activo' },
      { nombre: 'fecha_ultimo_precio', tipo: 'fecha', desc: 'Fecha del precio. Si el archivo no la trae se usa la de hoy' },
    ],
  },
}

/* ══════════════════ Lectura de archivos ══════════════════ */

type Tabla = { headers: string[]; filas: any[][] }

function detectarTipo(nombre: string): 'excel' | 'csv' | 'pdf' {
  const n = (nombre || '').toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.csv') || n.endsWith('.txt')) return 'csv'
  return 'excel'
}

/** Parte una línea CSV respetando comillas y separadores , o ; */
function partirLineaCsv(linea: string, sep: string): string[] {
  const out: string[] = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++ }
      else entreComillas = !entreComillas
    } else if (c === sep && !entreComillas) {
      out.push(actual); actual = ''
    } else actual += c
  }
  out.push(actual)
  return out.map((s) => s.trim())
}

function leerCsv(texto: string): Tabla {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (!lineas.length) return { headers: [], filas: [] }
  // Excel en español exporta con punto y coma; se elige el separador que más columnas produce.
  const sep = (lineas[0].split(';').length > lineas[0].split(',').length) ? ';' : ','
  const headers = partirLineaCsv(lineas[0], sep)
  const filas = lineas.slice(1).map((l) => partirLineaCsv(l, sep))
  return { headers, filas }
}

async function leerExcel(buffer: Buffer): Promise<Tabla> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)

  const hoja = wb.worksheets.find((h: any) => h.rowCount > 1) || wb.worksheets[0]
  if (!hoja) return { headers: [], filas: [] }

  const matriz: any[][] = []
  hoja.eachRow({ includeEmpty: false }, (row: any) => {
    const valores = row.values as any[]
    // exceljs deja values[0] vacío porque numera las columnas desde 1.
    matriz.push(valores.slice(1).map(normalizarCelda))
  })
  if (!matriz.length) return { headers: [], filas: [] }

  const headers = (matriz[0] || []).map((h) => String(h ?? '').trim())
  return { headers, filas: matriz.slice(1) }
}

/** exceljs devuelve objetos para fórmulas, links y texto enriquecido. */
function normalizarCelda(v: any): any {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) return v.result          // fórmula ya calculada
    if ('text' in v) return v.text              // hipervínculo o rich text
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('')
    return null
  }
  return v
}

/**
 * Un PDF no tiene filas ni columnas: se extrae el texto y un modelo lo convierte
 * en tabla. Es el único caso donde el modelo ve los valores, porque no hay forma
 * determinista de sacar una grilla de un PDF de lista de precios.
 */
async function leerPdf(buffer: Buffer, destino: string, apiKey: string): Promise<Tabla> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })

  const plano = String(text || '').trim()
  if (!plano) {
    throw createError({
      statusCode: 422,
      statusMessage: 'No se pudo leer texto del PDF. Si es un PDF escaneado (una foto), conviene pasar los datos a Excel.',
    })
  }

  const def = DESTINOS[destino]
  const columnas = def.campos.map((c) => c.nombre)

  const resp: any = await $fetch(OPENAI_CHAT_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `Extraes datos tabulares de documentos. Devuelves JSON con esta forma exacta: ` +
            `{"filas": [[...], [...]]}, donde cada fila es un array con estos valores en este orden: ` +
            `${columnas.join(', ')}. Usa null para lo que el documento no diga. ` +
            `NUNCA inventes precios, años ni kilometrajes: si no está en el texto, va null. ` +
            `Devuelve sólo filas de vehículos reales; ignora encabezados, notas al pie y totales.`,
        },
        { role: 'user', content: plano.slice(0, 120_000) },
      ],
    },
  })

  let filas: any[][] = []
  try {
    const parsed = JSON.parse(resp?.choices?.[0]?.message?.content || '{}')
    filas = Array.isArray(parsed.filas) ? parsed.filas : []
  } catch { filas = [] }

  // Se devuelve ya con nuestros nombres: el mapeo posterior es la identidad.
  return { headers: columnas, filas }
}

/* ══════════════════ Conversión de valores ══════════════════ */

function aTexto(v: any): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' || s.toLowerCase() === 'null' ? null : s
}

/**
 * Acepta "S/ 12,500.50", "12.500,50", "$9800", "120.000" y números de Excel.
 *
 * El punto es ambiguo en esta base: conviven el formato peruano (120.000 =
 * ciento veinte mil) y el inglés (11500.50 = once mil quinientos con centavos).
 * La regla que los separa es cuántos dígitos quedan detrás del separador:
 * exactamente tres es miles, cualquier otra cantidad es decimal. Nadie escribe
 * un precio ni un kilometraje con tres decimales, así que el caso raro es el
 * que se sacrifica. Igual el usuario ve los valores ya convertidos en la vista
 * previa antes de importar.
 */
function aNumero(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null

  let s = String(v).trim().replace(/[^\d.,-]/g, '')
  if (s === '' || s === '-') return null

  const comas = (s.match(/,/g) || []).length
  const puntos = (s.match(/\./g) || []).length

  const separarPorElMasDerecho = () => {
    // Con ambos separadores presentes no hay ambigüedad: el de más a la derecha
    // es el decimal y el otro es de miles.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  }

  const resolverUnico = (sep: ',' | '.') => {
    const pos = s.lastIndexOf(sep)
    const decimales = s.length - pos - 1
    const entero = s.slice(0, pos).replace('-', '')
    // Tres dígitos detrás y algo distinto de cero delante => separador de miles.
    const esMiles = decimales === 3 && entero !== '' && entero !== '0'
    s = esMiles
      ? s.split(sep).join('')
      : (sep === ',' ? s.replace(',', '.') : s)
  }

  if (comas && puntos) separarPorElMasDerecho()
  else if (comas > 1) s = s.replace(/,/g, '')      // 1,234,567
  else if (puntos > 1) s = s.replace(/\./g, '')    // 1.234.567
  else if (comas === 1) resolverUnico(',')
  else if (puntos === 1) resolverUnico('.')

  const n = Number(s)
  return isFinite(n) ? n : null
}

function aEntero(v: any): number | null {
  const n = aNumero(v)
  return n === null ? null : Math.round(n)
}

function aBooleano(v: any): boolean | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  if (['si', 'sí', 'true', '1', 'x', 'vigente'].includes(s)) return true
  if (['no', 'false', '0'].includes(s)) return false
  return null
}

/** Devuelve YYYY-MM-DD. Ante dd/mm vs mm/dd asume dd/mm, que es lo de Perú. */
function aFecha(v: any): string | null {
  if (v === null || v === undefined || v === '') return null

  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)

  // Excel guarda fechas como días desde 1899-12-30 cuando no las tipa.
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }

  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    let [, d, mes, a] = m
    if (a.length === 2) a = `20${a}`
    const dia = Number(d), mm = Number(mes)
    if (dia > 31 || mm > 12) return null
    return `${a}-${String(mm).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** "USD", "US$", "$", "dólares" -> USD; "PEN", "S/", "soles" -> PEN. Otra cosa se ignora (queda la moneda por defecto). */
function aMoneda(v: any): string | null {
  const s = (aTexto(v) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z$/]/g, '')
  if (!s) return null
  if (['usd', 'us$', '$', 'dolar', 'dolares', 'dollar', 'dollars'].includes(s)) return 'USD'
  if (['pen', 's/', 'sol', 'soles', 'nuevosol', 'nuevossoles'].includes(s)) return 'PEN'
  return null
}

/**
 * La base sólo admite `activo` y `descontinuado` (un CHECK): mandar "vigente" tumbaría la carga entera.
 * Se aceptan los sinónimos que aparecen en las listas de precios; lo que no se reconoce se ignora.
 */
function aEstadoProduccion(v: any): string | null {
  const s = (aTexto(v) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!s) return null
  if (['activo', 'vigente', 'actual', 'disponible', 'en venta', 'si'].includes(s)) return 'activo'
  if (/^(des|dis)continuad/.test(s) || ['inactivo', 'agotado', 'fuera de venta', 'fuera de produccion', 'no'].includes(s)) return 'descontinuado'
  return null
}

function convertir(valor: any, tipo: Campo['tipo']) {
  switch (tipo) {
    case 'numero': return aNumero(valor)
    case 'entero': return aEntero(valor)
    case 'fecha': return aFecha(valor)
    case 'booleano': return aBooleano(valor)
    case 'moneda': return aMoneda(valor)
    case 'estado_produccion': return aEstadoProduccion(valor)
    default: return aTexto(valor)
  }
}

/* ══════════════════ Mapeo de columnas ══════════════════ */

function normalizarNombre(s: string) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

/** Coincidencias obvias, resueltas sin gastar una llamada al modelo. */
function mapeoDirecto(headers: string[], campos: Campo[]) {
  const mapa: Record<string, string | null> = {}
  const usados = new Set<string>()
  for (const campo of campos) {
    const objetivo = normalizarNombre(campo.nombre)
    const hit = headers.find((h) => !usados.has(h) && normalizarNombre(h) === objetivo)
    if (hit) { mapa[campo.nombre] = hit; usados.add(hit) }
  }
  return mapa
}

async function sugerirMapeo(tabla: Tabla, destino: string, apiKey: string) {
  const def = DESTINOS[destino]
  const directo = mapeoDirecto(tabla.headers, def.campos)
  const faltantes = def.campos.filter((c) => !directo[c.nombre])
  if (!faltantes.length) return directo

  const muestra = tabla.filas.slice(0, 3).map((f) =>
    Object.fromEntries(tabla.headers.map((h, i) => [h, f[i] instanceof Date ? f[i].toISOString().slice(0, 10) : f[i]])))

  try {
    const resp: any = await $fetch(OPENAI_CHAT_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: {
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Emparejas columnas de una planilla con campos de una base de datos. ' +
              'Respondes JSON {"campo": "nombre exacto de la columna del archivo" | null}. ' +
              'Si ninguna columna corresponde con claridad, pon null: es preferible dejarlo vacío ' +
              'a mapear mal. Nunca inventes nombres de columna que no estén en la lista.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              columnas_del_archivo: tabla.headers,
              muestra_de_filas: muestra,
              campos_a_completar: faltantes.map((c) => ({ campo: c.nombre, descripcion: c.desc })),
            }),
          },
        ],
      },
    })
    const sugerido = JSON.parse(resp?.choices?.[0]?.message?.content || '{}')
    for (const c of faltantes) {
      const col = sugerido[c.nombre]
      if (typeof col === 'string' && tabla.headers.includes(col)) directo[c.nombre] = col
    }
  } catch {
    // Si el modelo falla, queda el mapeo directo y el usuario completa a mano.
  }
  return directo
}

/* ══════════════════ Handler ══════════════════ */

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const sesion = await verificarSesionTradeCarsEnBase(event, supabase)
  const body = await readBody(event)
  const accion = String(body?.accion || '')

  if (accion === 'listar') {
    const { data } = await supabase.from('tradecars_tasador_importaciones')
      .select('*').order('created_at', { ascending: false }).limit(30)
    return { importaciones: data || [] }
  }

  if (!puedeEditarTasador(sesion)) {
    throw createError({ statusCode: 403, statusMessage: 'Sólo administración puede cargar datos del Tasador' })
  }

  if (accion === 'deshacer') {
    const batchId = String(body?.batch_id || '')
    if (!batchId) throw createError({ statusCode: 400, statusMessage: 'Falta batch_id' })

    const { data: imp } = await supabase.from('tradecars_tasador_importaciones')
      .select('*').eq('id', batchId).maybeSingle()
    if (!imp) throw createError({ statusCode: 404, statusMessage: 'Esa importación no existe' })
    if (imp.estado === 'deshecha') return { ok: true, mensaje: 'Esa importación ya estaba deshecha.' }

    const tabla = DESTINOS[imp.destino]?.tabla
    if (!tabla) throw createError({ statusCode: 400, statusMessage: 'Destino desconocido en la importación' })

    const { error } = await supabase.from(tabla).delete().eq('import_batch_id', batchId)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    await supabase.from('tradecars_tasador_importaciones')
      .update({ estado: 'deshecha', deshecha_at: new Date().toISOString() }).eq('id', batchId)

    await logTasador(supabase, 'Tasador · Datos', { accion, batchId }, { filas: imp.filas_importadas }, 'success')
    return { ok: true, mensaje: `Se quitaron las ${imp.filas_importadas} filas de esa carga.` }
  }

  /* ── analizar / importar: ambas parten de leer el archivo ── */

  const destino = String(body?.destino || '')
  const def = DESTINOS[destino]
  if (!def) throw createError({ statusCode: 400, statusMessage: 'destino tiene que ser "historico" o "precios_nuevos"' })

  const b64 = String(body?.archivo_base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!b64) throw createError({ statusCode: 400, statusMessage: 'Falta el archivo' })
  if (b64.length > MAX_BASE64) {
    throw createError({ statusCode: 413, statusMessage: 'El archivo es demasiado grande. Conviene partirlo en dos o exportar sólo las columnas necesarias.' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw createError({ statusCode: 500, statusMessage: 'OPENAI_API_KEY no configurada en el servidor.' })

  const nombre = String(body?.archivo_nombre || 'archivo')
  const tipo = detectarTipo(nombre)
  const buffer = Buffer.from(b64, 'base64')

  let tabla: Tabla
  try {
    if (tipo === 'pdf') tabla = await leerPdf(buffer, destino, apiKey)
    else if (tipo === 'csv') tabla = leerCsv(buffer.toString('utf-8'))
    else tabla = await leerExcel(buffer)
  } catch (err: any) {
    if (err?.statusCode) throw err
    throw createError({
      statusCode: 422,
      statusMessage: `No se pudo leer el archivo: ${err?.message || 'formato no reconocido'}. Los .xls antiguos hay que guardarlos como .xlsx.`,
    })
  }

  if (!tabla.headers.length || !tabla.filas.length) {
    throw createError({ statusCode: 422, statusMessage: 'El archivo no tiene filas de datos legibles.' })
  }

  if (accion === 'analizar') {
    const mapeo = await sugerirMapeo(tabla, destino, apiKey)

    // La vista previa muestra los valores YA convertidos, no los crudos: es la
    // única forma de que alguien note a tiempo que "120.000" km se leyó mal o
    // que una fecha quedó invertida.
    const previa = tabla.filas.slice(0, 5).map((fila) => {
      const r: any = {}
      for (const campo of def.campos) {
        const col = mapeo[campo.nombre]
        const i = col ? tabla.headers.indexOf(col) : -1
        r[campo.nombre] = i < 0 ? null : convertir(fila[i], campo.tipo)
      }
      return r
    })

    return {
      destino,
      etiqueta: def.etiqueta,
      archivo_tipo: tipo,
      headers: tabla.headers,
      total_filas: tabla.filas.length,
      muestra: tabla.filas.slice(0, 5).map((f) =>
        Object.fromEntries(tabla.headers.map((h, i) => [h, f[i] instanceof Date ? f[i].toISOString().slice(0, 10) : f[i]]))),
      previa,
      campos: def.campos.map((c) => ({ ...c })),
      mapeo_sugerido: mapeo,
    }
  }

  if (accion !== 'importar') {
    throw createError({ statusCode: 400, statusMessage: `Acción desconocida: "${accion}"` })
  }

  /* ── importar ── */

  const mapeo: Record<string, string | null> = body?.mapeo || {}
  const requeridos = def.campos.filter((c) => c.requerido)
  const sinMapear = requeridos.filter((c) => !mapeo[c.nombre])
  if (sinMapear.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Falta indicar qué columna corresponde a: ${sinMapear.map((c) => c.nombre).join(', ')}`,
    })
  }

  const indices: Record<string, number> = {}
  for (const [campo, columna] of Object.entries(mapeo)) {
    if (!columna) continue
    const i = tabla.headers.indexOf(columna)
    if (i >= 0) indices[campo] = i
  }

  const batchId = crypto.randomUUID()
  const filasOk: any[] = []
  const descartes: any[] = []

  // Columnas que no vienen del archivo (ver DESTINOS.fijos) + quién cargó la fila, si la tabla lo guarda.
  const fijos: Record<string, any> = { ...(def.fijos || {}) }
  if (destino === 'precios_nuevos') fijos.creado_por = sesion.email

  tabla.filas.forEach((fila, n) => {
    const registro: any = { import_batch_id: batchId, ...fijos }
    const valores: Record<string, any> = {}
    for (const campo of def.campos) {
      const i = indices[campo.nombre]
      const v = i === undefined ? null : convertir(fila[i], campo.tipo)
      valores[campo.nombre] = v
      // Un dato vacío NO se manda: así la base aplica su valor por defecto (moneda, estado, fecha…). Mandar un
      // NULL explícito lo pisaba y las columnas NOT NULL con default tumbaban la carga entera.
      if (v !== null && v !== '') registro[campo.nombre] = v
    }

    const faltan = requeridos.filter((c) => valores[c.nombre] === null || valores[c.nombre] === '')
    if (faltan.length) {
      // Se guardan sólo las primeras: el objetivo es que el usuario entienda el
      // patrón del error, no tener el listado completo de lo que falló.
      if (descartes.length < 20) {
        descartes.push({ fila: n + 2, motivo: `sin ${faltan.map((c) => c.nombre).join(', ')}` })
      }
      return
    }
    filasOk.push(registro)
  })

  if (!filasOk.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `Ninguna fila quedó completa. Revisa el mapeo: hacen falta ${requeridos.map((c) => c.nombre).join(', ')}.`,
    })
  }

  let insertadas = 0
  for (let i = 0; i < filasOk.length; i += LOTE_INSERT) {
    const lote = filasOk.slice(i, i + LOTE_INSERT)
    // defaultToNull:false = las columnas que no se mandan toman el DEFAULT de la base (no NULL).
    const { error } = await supabase.from(def.tabla).insert(lote, { defaultToNull: false })
    if (error) {
      // Se borra lo ya insertado para no dejar una carga a medias, que es peor
      // que no haber cargado nada: el Tasador cotizaría con datos parciales.
      await supabase.from(def.tabla).delete().eq('import_batch_id', batchId)
      await logTasador(supabase, 'Tasador · Datos', { accion, destino, nombre }, null, 'error', error.message)
      throw createError({
        statusCode: 500,
        statusMessage: `Falló la carga en la fila ~${i + 1}: ${error.message}. No se guardó nada.`,
      })
    }
    insertadas += lote.length
  }

  const { data: imp } = await supabase.from('tradecars_tasador_importaciones').insert({
    id: batchId,
    destino,
    archivo_nombre: nombre,
    archivo_tipo: tipo,
    filas_leidas: tabla.filas.length,
    filas_importadas: insertadas,
    filas_descartadas: tabla.filas.length - insertadas,
    mapeo,
    descartes,
    importado_por: sesion.email,
  }).select().single()

  await logTasador(supabase, 'Tasador · Datos',
    { accion, destino, archivo: nombre, tipo },
    { batch_id: batchId, importadas: insertadas, descartadas: tabla.filas.length - insertadas },
    descartes.length ? 'partial' : 'success')

  return {
    ok: true,
    batch_id: batchId,
    importacion: imp,
    filas_importadas: insertadas,
    filas_descartadas: tabla.filas.length - insertadas,
    descartes,
    mensaje: `Se cargaron ${insertadas} filas en ${def.etiqueta.toLowerCase()}. El Agente Tasador ya las usa en la próxima tasación.`,
  }
})
