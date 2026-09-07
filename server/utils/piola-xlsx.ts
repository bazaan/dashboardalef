/**
 * PIOLA — Lector de Excel (.xlsx) y CSV, sin dependencias.
 *
 * POR QUÉ NO SE AGREGÓ UNA LIBRERÍA
 * El proyecto no tiene librería de hojas de cálculo y meter SheetJS por una
 * pantalla de importación son ~800 kB y una dependencia más que mantener. Un
 * .xlsx es un ZIP con XML adentro: Node ya trae el inflate (`node:zlib`) y el
 * XML que hay que leer son filas y celdas. Es el mismo criterio que
 * `google-auth.ts` y `vonage-auth.ts`, que firman JWT con `node:crypto` en vez
 * de traerse una librería.
 *
 * QUÉ CUBRE
 *   • .xlsx (Excel 2007+, Google Sheets exportado, Numbers exportado)
 *   • .csv / .txt con detección de separador (`,` `;` tab `|`) y comillas
 *   • Cadenas compartidas, cadenas en línea, resultados de fórmula
 *   • Fechas: convierte el número de serie de Excel a 'YYYY-MM-DD'
 *
 * QUÉ NO CUBRE — a propósito
 *   • .xls (formato binario de 1997, otro mundo entero)
 *   • ZIP64 (hojas de más de 4 GB) y ZIP cifrado
 *   • Fórmulas sin resultado cacheado: se lee lo que Excel guardó, no se evalúa
 */
import { inflateRawSync } from 'node:zlib'

export interface HojaLeida {
  nombre: string
  /** Filas como arreglo de celdas ya normalizadas a texto/número */
  filas: any[][]
}

export interface LibroLeido {
  hojas: HojaLeida[]
}

/* ══════════════════ ZIP ══════════════════ */

interface EntradaZip { nombre: string; datos: Buffer }

/**
 * Extrae las entradas de un ZIP leyendo el directorio central.
 *
 * Se lee el DIRECTORIO CENTRAL y no los encabezados locales porque cuando el
 * archivo se generó en streaming (Google Sheets, por ejemplo) el encabezado
 * local trae los tamaños en cero y los reales van en un descriptor DESPUÉS de
 * los datos. El directorio central siempre los tiene bien.
 */
function leerZip(buf: Buffer, soloEstos?: (nombre: string) => boolean): EntradaZip[] {
  const EOCD = 0x06054b50
  const CEN = 0x02014b50

  // El EOCD está al final, pero puede tener hasta 65 535 bytes de comentario detrás
  let eocd = -1
  const desde = Math.max(0, buf.length - 65_557)
  for (let i = buf.length - 22; i >= desde; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('El archivo no es un .xlsx válido (no se encontró el índice del ZIP)')

  const totalEntradas = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  if (offset === 0xffffffff) throw new Error('Archivo ZIP64 no soportado: exportar la hoja de nuevo en formato .xlsx normal')

  const salida: EntradaZip[] = []
  for (let n = 0; n < totalEntradas; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CEN) break

    const metodo = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nombreLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const comentLen = buf.readUInt16LE(offset + 32)
    const localOff = buf.readUInt32LE(offset + 42)
    const nombre = buf.toString('utf8', offset + 46, offset + 46 + nombreLen)
    offset += 46 + nombreLen + extraLen + comentLen

    if (soloEstos && !soloEstos(nombre)) continue
    if (localOff + 30 > buf.length) continue

    // Los tamaños del encabezado LOCAL pueden mentir; los nombres, no.
    const lNombreLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const inicio = localOff + 30 + lNombreLen + lExtraLen
    const crudo = buf.subarray(inicio, inicio + compSize)

    try {
      salida.push({ nombre, datos: metodo === 0 ? Buffer.from(crudo) : inflateRawSync(crudo) })
    } catch {
      // Una entrada ilegible (imagen rara, macro) no debe tumbar la lectura
    }
  }
  return salida
}

/* ══════════════════ XML mínimo ══════════════════ */

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

function desescapar(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cuerpo) => {
    if (cuerpo[0] === '#') {
      const cod = cuerpo[1] === 'x' || cuerpo[1] === 'X'
        ? parseInt(cuerpo.slice(2), 16)
        : parseInt(cuerpo.slice(1), 10)
      return Number.isFinite(cod) ? String.fromCodePoint(cod) : todo
    }
    return ENTIDADES[cuerpo] ?? todo
  })
}

/** Texto plano de un fragmento XML: concatena todos los <t>…</t> que tenga. */
function textoDe(xml: string): string {
  const partes = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g)
  if (!partes) return ''
  return partes.map(p => desescapar(p.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, ''))).join('')
}

/* ══════════════════ Fechas de Excel ══════════════════ */

/** Formatos numéricos incorporados que son fecha u hora. */
const NUMFMT_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/**
 * Excel guarda las fechas como días desde el 30/12/1899.
 *
 * El 30 y no el 31 por el bug histórico del año bisiesto 1900: Excel cree que
 * 1900 tuvo 29 de febrero. Correr el origen un día compensa exactamente eso
 * para toda fecha posterior a marzo de 1900, que son todas las que importan acá.
 */
function serialAFecha(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2_958_465) return null
  const ms = Math.round((serial - 25569) * 86_400_000)
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/* ══════════════════ XLSX ══════════════════ */

/** 'B12' → 1 (índice de columna, base 0). */
function columnaDe(ref: string): number {
  const letras = /^([A-Z]+)/.exec(ref)?.[1] || 'A'
  let n = 0
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function leerXlsx(buf: Buffer, opciones: { maxFilas?: number } = {}): LibroLeido {
  const maxFilas = opciones.maxFilas ?? 20_000

  const entradas = leerZip(buf, n =>
    n === 'xl/workbook.xml' || n === 'xl/sharedStrings.xml' || n === 'xl/styles.xml'
    || n === 'xl/_rels/workbook.xml.rels' || n.startsWith('xl/worksheets/'))

  const texto = (nombre: string) =>
    entradas.find(e => e.nombre === nombre)?.datos.toString('utf8') || ''

  /* ── Cadenas compartidas ── */
  const compartidas: string[] = []
  const ssXml = texto('xl/sharedStrings.xml')
  if (ssXml) {
    for (const si of ssXml.match(/<si>[\s\S]*?<\/si>/g) || []) compartidas.push(textoDe(si))
  }

  /* ── Estilos: qué columnas son fecha ── */
  const estiloEsFecha: boolean[] = []
  const stXml = texto('xl/styles.xml')
  if (stXml) {
    // Formatos personalizados que contienen d/m/y fuera de comillas
    const personalizados = new Map<number, string>()
    for (const nf of stXml.match(/<numFmt[^>]*\/>/g) || []) {
      const id = Number(/numFmtId="(\d+)"/.exec(nf)?.[1])
      const code = desescapar(/formatCode="([^"]*)"/.exec(nf)?.[1] || '')
      if (Number.isFinite(id)) personalizados.set(id, code)
    }
    const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stXml)?.[1] || ''
    for (const xf of cellXfs.match(/<xf[^>]*>/g) || []) {
      const id = Number(/numFmtId="(\d+)"/.exec(xf)?.[1] ?? -1)
      const code = personalizados.get(id) || ''
      estiloEsFecha.push(
        NUMFMT_FECHA.has(id) || /[dmyhs]/i.test(code.replace(/\[[^\]]*\]|"[^"]*"/g, '')))
    }
  }

  /* ── Nombre de cada hoja y a qué archivo apunta ── */
  const relaciones = new Map<string, string>()
  for (const rel of texto('xl/_rels/workbook.xml.rels').match(/<Relationship[^>]*\/>/g) || []) {
    const id = /Id="([^"]+)"/.exec(rel)?.[1]
    const target = /Target="([^"]+)"/.exec(rel)?.[1]
    if (id && target) relaciones.set(id, target.replace(/^\/?xl\//, '').replace(/^\.\//, ''))
  }

  const hojas: HojaLeida[] = []
  const wbXml = texto('xl/workbook.xml')
  const declaradas = wbXml.match(/<sheet[^>]*\/>/g) || []

  declaradas.forEach((sh, i) => {
    const nombre = desescapar(/name="([^"]*)"/.exec(sh)?.[1] || `Hoja${i + 1}`)
    const rid = /r:id="([^"]+)"/.exec(sh)?.[1] || ''
    const destino = relaciones.get(rid) || `worksheets/sheet${i + 1}.xml`
    const xml = texto(`xl/${destino}`)
    if (!xml) return

    const filas: any[][] = []
    for (const filaXml of xml.match(/<row[\s\S]*?(?:\/>|<\/row>)/g) || []) {
      if (filas.length >= maxFilas) break
      const fila: any[] = []

      for (const celda of filaXml.match(/<c[ >][\s\S]*?(?:\/>|<\/c>)/g) || []) {
        const ref = /r="([A-Z]+\d+)"/.exec(celda)?.[1] || ''
        const col = ref ? columnaDe(ref) : fila.length
        const tipo = /t="([^"]+)"/.exec(celda)?.[1] || 'n'
        const estilo = Number(/s="(\d+)"/.exec(celda)?.[1] ?? -1)

        let valor: any = null
        if (tipo === 'inlineStr') {
          valor = textoDe(celda)
        } else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(celda)?.[1]
          if (v !== undefined) {
            const crudo = desescapar(v)
            if (tipo === 's') valor = compartidas[Number(crudo)] ?? ''
            else if (tipo === 'str') valor = crudo
            else if (tipo === 'b') valor = crudo === '1'
            else {
              const num = Number(crudo)
              valor = Number.isFinite(num) ? num : crudo
              if (typeof valor === 'number' && estiloEsFecha[estilo]) {
                valor = serialAFecha(valor) ?? valor
              }
            }
          }
        }

        while (fila.length < col) fila.push(null)
        fila[col] = valor
      }
      filas.push(fila)
    }

    hojas.push({ nombre, filas })
  })

  if (!hojas.length) throw new Error('El archivo no tiene hojas legibles')
  return { hojas }
}

/* ══════════════════ CSV ══════════════════ */

/** Cuenta separadores fuera de comillas para adivinar cuál usa el archivo. */
function detectarSeparador(muestra: string): string {
  const candidatos = [',', ';', '\t', '|']
  let mejor = ','
  let max = -1
  for (const sep of candidatos) {
    let n = 0
    let comillas = false
    for (const ch of muestra) {
      if (ch === '"') comillas = !comillas
      else if (ch === sep && !comillas) n++
    }
    if (n > max) { max = n; mejor = sep }
  }
  return mejor
}

export function leerCsv(contenido: string, opciones: { separador?: string; maxFilas?: number } = {}): HojaLeida {
  const maxFilas = opciones.maxFilas ?? 20_000
  // BOM de Excel: si no se quita, la primera cabecera nunca calza con el mapeo
  const texto = contenido.replace(/^﻿/, '')
  const sep = opciones.separador || detectarSeparador(texto.slice(0, 5000))

  const filas: any[][] = []
  let fila: any[] = []
  let celda = ''
  let enComillas = false

  const cerrarCelda = () => { fila.push(celda === '' ? null : celda); celda = '' }
  const cerrarFila = () => { cerrarCelda(); filas.push(fila); fila = [] }

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (enComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++ }   // comilla escapada
        else enComillas = false
      } else celda += ch
      continue
    }
    if (ch === '"') { enComillas = true; continue }
    if (ch === sep) { cerrarCelda(); continue }
    if (ch === '\n') {
      cerrarFila()
      if (filas.length >= maxFilas) break
      continue
    }
    if (ch === '\r') continue
    celda += ch
  }
  if (celda !== '' || fila.length) cerrarFila()

  return { nombre: 'CSV', filas }
}

/**
 * Punto de entrada único: decide por la firma del archivo, no por la extensión.
 *
 * Un .xlsx renombrado a .csv (o al revés) es la mitad de los archivos que llegan
 * de un equipo administrativo. 'PK' son los dos primeros bytes de todo ZIP.
 */
export function leerLibro(
  buf: Buffer, nombreArchivo = '', opciones: { maxFilas?: number; separador?: string } = {}
): LibroLeido {
  const esZip = buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b
  if (esZip) return leerXlsx(buf, opciones)

  if (/\.xls$/i.test(nombreArchivo)) {
    throw new Error('El formato .xls (Excel 97-2003) no se puede leer: abrir en Excel y guardar como .xlsx')
  }
  return { hojas: [leerCsv(buf.toString('utf8'), opciones)] }
}
