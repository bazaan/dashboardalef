/**
 * Exporta una respuesta de formulario de Gatwick (slug "gtw-IT-001")
 * como PDF replicando el formato físico del "INFORME TÉCNICO".
 *
 * Usa jsPDF cargado dinámicamente desde CDN para evitar bloat del bundle
 * principal — solo se descarga cuando el usuario hace click en "PDF".
 *
 * El logo es el mismo que usa el dashboard de Gatwick
 * (`assets/img/gatwickLOGO.png`): Vite lo resuelve a una URL, lo cargamos
 * como dataURL y lo incrustamos en el PDF con addImage.
 */

// @ts-ignore — Vite resuelve el import de la imagen a una URL (string)
import gatwickLogoUrl from '@/assets/img/gatwickLOGO.png'

declare global {
  interface Window { jspdf?: { jsPDF: any } }
}

const JSPDF_CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'

async function loadJsPDF(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('jsPDF requiere browser')
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = JSPDF_CDN
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`No se pudo cargar jsPDF desde ${JSPDF_CDN}`))
    document.head.appendChild(s)
  })
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF no expuso jsPDF en window')
  return window.jspdf.jsPDF
}

/** Carga el logo de Gatwick como dataURL + dimensiones naturales. Null si falla. */
async function loadLogo(): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(gatwickLogoUrl as unknown as string)
    if (!res.ok) return null
    const blob = await res.blob()
    const rawUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = () => reject(new Error('FileReader logo'))
      fr.readAsDataURL(blob)
    })
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('Image logo'))
      im.src = rawUrl
    })
    const natW = img.naturalWidth || 1920
    const natH = img.naturalHeight || 1178

    // Reduce a ~480px de ancho para que el PDF no pese de más (el logo se
    // muestra a ~75pt). Si no hay canvas disponible, usa la imagen original.
    const MAX_W = 480
    try {
      const scale = Math.min(1, MAX_W / natW)
      const w = Math.round(natW * scale)
      const h = Math.round(natH * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h)
        return { dataUrl: canvas.toDataURL('image/png'), w, h }
      }
    } catch { /* sin canvas → usa original */ }
    return { dataUrl: rawUrl, w: natW, h: natH }
  } catch {
    return null
  }
}

/** Formatea una fecha como DD/MM/YYYY sin desfase de zona horaria. */
function formatFecha(raw: any): string {
  if (!raw) return ''
  const s = String(raw)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)   // YYYY-MM-DD[...] (fecha o ISO)
  if (m) return `${+m[3]}/${+m[2]}/${m[1]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-PE')
}

/** Marca un check según si val coincide con expected (case/space insensitive) */
function check(val: any, expected: string): string {
  if (!val) return '(   )'
  const v = String(val).toLowerCase().trim()
  const e = expected.toLowerCase().trim()
  return v === e || v.startsWith(e) ? '( X )' : '(   )'
}

export interface GatwickResponse {
  id: number
  submitted_at: string
  answers: Record<string, any>
}

export interface FormDefinition {
  id: number
  title?: string
  fields?: any[]
  created_at?: string
}

/**
 * Busca una respuesta primero por los ids esperados y, si el form fue armado
 * con otros nombres, escanea todas las respuestas por la forma del valor.
 * Así el PDF sigue encontrando las firmas aunque quien edite el formulario
 * bautice las preguntas distinto.
 */
function findAnswer(
  answers: Record<string, any>,
  preferredIds: string[],
  matches: (v: any) => boolean,
): any {
  for (const id of preferredIds) {
    if (id in answers && matches(answers[id])) return answers[id]
  }
  for (const v of Object.values(answers)) {
    if (matches(v)) return v
  }
  return null
}

export async function exportGatwickPdf(response: GatwickResponse, form: FormDefinition): Promise<void> {
  const jsPDF = await loadJsPDF()
  const logo = await loadLogo()
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })

  const a = response.answers || {}
  const pageW = doc.internal.pageSize.getWidth()    // ~595
  const pageH = doc.internal.pageSize.getHeight()   // ~842

  const frameInset = 16                 // marco rojo exterior
  const margin = 30                     // margen del contenido
  const contentW = pageW - margin * 2

  // Paleta de marca
  const RED: [number, number, number] = [197, 40, 38]
  const BAR: [number, number, number] = [249, 224, 224]   // relleno suave de barras de sección
  const GREY: [number, number, number] = [150, 150, 150]  // líneas para escribir respuestas

  // ─────────── Helpers de dibujo ───────────
  function setFont(opts: { size?: number; style?: 'normal' | 'bold' } = {}) {
    doc.setFont('helvetica', opts.style || 'normal')
    doc.setFontSize(opts.size ?? 9)
  }
  function text(t: string, x: number, y: number, opts: any = {}) { doc.text(t ?? '', x, y, opts) }
  function line(x1: number, y1: number, x2: number, y2: number, w = 0.5) {
    doc.setLineWidth(w); doc.line(x1, y1, x2, y2)
  }
  function rect(x: number, y: number, w: number, h: number, style: 'S' | 'F' | 'FD' = 'S') {
    doc.rect(x, y, w, h, style)
  }
  function fill(c: [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]) }
  function stroke(c: [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]) }
  function color(c: [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]) }
  const BLACK: [number, number, number] = [0, 0, 0]

  /** Recorta el texto con "…" para que nunca exceda maxW. */
  function fit(value: any, maxW: number, size = 8.5, style: 'normal' | 'bold' = 'normal'): string {
    setFont({ size, style })
    let s = String(value ?? '').replace(/\s+/g, ' ').trim()
    if (!s) return ''
    if (doc.getTextWidth(s) <= maxW) return s
    while (s.length > 1 && doc.getTextWidth(s + '…') > maxW) s = s.slice(0, -1)
    return s + '…'
  }

  /** Etiqueta en negrita + línea para la respuesta + valor asentado SOBRE la línea. */
  function fieldRow(label: string, value: any, x: number, y: number, w: number, labelW: number) {
    setFont({ size: 8, style: 'bold' }); color(BLACK)
    text(label + ':', x, y)
    const lx1 = x + labelW
    const lx2 = x + w
    stroke(GREY); line(lx1, y + 1.5, lx2, y + 1.5); stroke(BLACK)
    setFont({ size: 8.5 })
    text(fit(value, lx2 - lx1 - 4, 8.5), lx1 + 2, y - 0.5)
  }

  /** Barra de sección (relleno suave + borde + título en rojo). */
  function sectionBar(title: string, x: number, y: number, w: number, h = 15, center = false) {
    fill(BAR); stroke(RED); rect(x, y, w, h, 'FD'); stroke(BLACK)
    setFont({ size: 9.5, style: 'bold' }); color(RED)
    if (center) text(title, x + w / 2, y + h - 4.5, { align: 'center' })
    else text(title, x + 6, y + h - 4.5)
    color(BLACK)
  }

  /** Caja con renglones; el texto se asienta sobre cada renglón. */
  function ruledArea(value: any, x: number, y: number, w: number, h: number, lineGap = 13) {
    stroke(BLACK); rect(x, y, w, h)
    const n = Math.floor((h - 4) / lineGap)
    stroke([210, 210, 210])
    for (let i = 1; i <= n; i++) {
      const ly = y + i * lineGap
      if (ly < y + h - 2) line(x + 5, ly, x + w - 5, ly)
    }
    stroke(BLACK)
    setFont({ size: 9 }); color(BLACK)
    const lines = doc.splitTextToSize(String(value ?? ''), w - 14)
    for (let i = 0; i < lines.length && i < n; i++) {
      text(lines[i], x + 7, y + (i + 1) * lineGap - 3)
    }
  }

  // ─────────── MARCO EXTERIOR ROJO ───────────
  stroke(RED); rect(frameInset, frameInset, pageW - frameInset * 2, pageH - frameInset * 2); stroke(BLACK)
  doc.setLineWidth(0.5)

  // ─────────── HEADER ───────────
  let y = margin

  // Logo (real). Si falla la carga, fallback a recuadro de texto.
  const logoH = 46
  if (logo) {
    const logoW = logoH * (logo.w / logo.h)
    try { doc.addImage(logo.dataUrl, 'PNG', margin, y, logoW, logoH) } catch { /* noop */ }
  } else {
    fill(RED); rect(margin, y, 46, 46, 'F')
    color([255, 255, 255]); setFont({ size: 9, style: 'bold' })
    text('GATWICK', margin + 4, y + 24)
    setFont({ size: 6 }); text('ASCENSORES', margin + 4, y + 34)
    color(BLACK)
  }

  // Título centrado
  setFont({ size: 17, style: 'bold' }); color(RED)
  text('INFORME TÉCNICO', pageW / 2, y + 26, { align: 'center' })

  // Número de informe (ID padded a 6 dígitos)
  setFont({ size: 12, style: 'bold' })
  text(`N° ${String(response.id).padStart(6, '0')}`, pageW - margin, y + 22, { align: 'right' })
  color(BLACK)

  y += 52
  stroke(RED); line(margin, y, margin + contentW, y, 1); stroke(BLACK)

  // ─────────── DATOS DEL CLIENTE ───────────
  y += 16
  const rowH = 15
  const leftW = contentW * 0.60
  const rightX = margin + contentW * 0.62
  const rightW = contentW - contentW * 0.62
  const fechaTxt = formatFecha(a.fecha || response.submitted_at)

  fieldRow('Cliente', a.cliente, margin, y, leftW, 56)
  fieldRow('Fecha', fechaTxt, rightX, y, rightW, 42)
  y += rowH

  fieldRow('Dirección', a.direccion, margin, y, leftW, 56)
  fieldRow('Distrito', a.distrito, rightX, y, rightW, 42)
  y += rowH

  fieldRow('Referencia', a.referencia, margin, y, leftW, 56)
  // Garantía con checks
  setFont({ size: 8, style: 'bold' }); text('Garantía:', rightX, y)
  setFont({ size: 8.5 })
  text(`SI ${check(a.garantia, 'sí')}`, rightX + 44, y)
  text(`NO ${check(a.garantia, 'no')}`, rightX + 92, y)
  y += rowH

  fieldRow('Teléfono', a.telefono, rightX, y, rightW, 42)
  y += rowH - 4

  // ─────────── DATOS TÉCNICOS ───────────
  sectionBar('DATOS TÉCNICOS', margin, y, contentW, 15, true)
  y += 15

  const bandTop = y + 4

  // -- Bloque izquierdo: tipología / tipo (checks) --
  setFont({ size: 8, style: 'bold' }); text('Tipología de elevador:', margin, bandTop + 9)
  setFont({ size: 8.5 })
  text(`Hidra. ${check(a.tipologia_elevador, 'hidráulico')}`, margin + 100, bandTop + 9)
  text(`Electro. ${check(a.tipologia_elevador, 'electromecánico')}`, margin + 160, bandTop + 9)

  setFont({ size: 8, style: 'bold' }); text('Tipo de elevador:', margin, bandTop + 22)
  setFont({ size: 8.5 })
  text(`Ascen. ${check(a.tipo_elevador, 'ascensor')}`, margin + 100, bandTop + 22)
  text(`Monta. ${check(a.tipo_elevador, 'montacargas')}`, margin + 158, bandTop + 22)
  text(`Montavehíc. ${check(a.tipo_elevador, 'montavehículo')}`, margin + 100, bandTop + 34)
  text(`Plataf. ${check(a.tipo_elevador, 'plataforma')}`, margin + 178, bandTop + 34)

  // -- Dos columnas alineadas --
  const colGap = 14
  const colW = (contentW - colGap) / 2
  const leftColX = margin
  const rightColX = margin + colW + colGap

  const leftCol: [string, any][] = [
    ['Máquina de tracción', a.maquina_traccion],
    ['Potencia HP', a.potencia_hp],
    ['Operador de Puerta', a.operador_puerta],
    ['Puertas de Cabecera', a.puertas_cabecera],
    ['Cable Viajero', a.cable_viajero],
    ['Botonera', a.botonera],
    ['Indicadores', a.indicadores],
    ['Contrapeso', a.contrapeso],
    ['Cielo raso', a.cielo_raso],
    ['Cabina', a.cabina],
  ]
  const rightCol: [string, any][] = [
    ['Rieles', a.rieles],
    ['Cables de tracción', a.cables_traccion],
    ['Poleas', a.poleas],
    ['Tensores', a.tensores],
    ['Guiadores', a.guiadores],
    ['Sistema para ruidos', a.sistema_ruidos],
    ['Limitador de velocidad', a.limitador_velocidad],
    ['Sensor de Puerta', a.sensor_puerta],
    ['Inductores', a.inductores],
    ['Sistema de Iluminación', a.sistema_iluminacion],
  ]

  // Izquierda arranca debajo del bloque tipología/tipo
  const leftRowsTop = bandTop + 46
  const leftRowH = 13
  for (let i = 0; i < leftCol.length; i++) {
    fieldRow(leftCol[i][0], leftCol[i][1], leftColX, leftRowsTop + i * leftRowH, colW, 104)
  }
  const bandBottom = leftRowsTop + leftCol.length * leftRowH

  // Derecha se reparte en toda la altura de la banda (como el formato físico)
  const rightRowH = (bandBottom - (bandTop + 9)) / rightCol.length
  for (let i = 0; i < rightCol.length; i++) {
    fieldRow(rightCol[i][0], rightCol[i][1], rightColX, bandTop + 9 + i * rightRowH, colW, 112)
  }

  y = bandBottom + 8

  // ─────────── INFORME TÉCNICO ───────────
  sectionBar('INFORME TÉCNICO', margin, y, contentW, 15)
  y += 15
  const informeTop = y

  // Altura del informe = lo que sobra hasta dejar espacio a las secciones de abajo
  const LOWER = 6 + 15 + 70 + 12 + 34 + 8 + 46   // gaps + obs + horas + firmas
  const targetFirmasBottom = pageH - frameInset - 46
  const informeH = Math.max(120, targetFirmasBottom - informeTop - LOWER)
  ruledArea(a.informe_tecnico || '', margin, y, contentW, informeH)
  y += informeH + 6

  // ─────────── OBSERVACIONES ───────────
  sectionBar('OBSERVACIONES', margin, y, contentW, 15)
  y += 15
  const obsH = 70
  ruledArea(a.observaciones || '', margin, y, contentW, obsH)
  y += obsH + 12

  // ─────────── HORA ENTRADA / SALIDA ───────────
  const halfX = margin + contentW / 2
  setFont({ size: 9, style: 'bold' }); color(BLACK)
  text('HORA DE ENTRADA', margin + contentW / 4, y + 9, { align: 'center' })
  text('HORA DE SALIDA', halfX + contentW / 4, y + 9, { align: 'center' })
  setFont({ size: 11 })
  text(String(a.hora_entrada ?? '—'), margin + contentW / 4, y + 24, { align: 'center' })
  text(String(a.hora_salida ?? '—'), halfX + contentW / 4, y + 24, { align: 'center' })
  y += 34 + 8

  // ─────────── FIRMAS ───────────
  const sigLineY = y + 16
  const lpad = 36
  const leftSigX1 = margin + lpad
  const leftSigX2 = halfX - lpad
  const rightSigX1 = halfX + lpad
  const rightSigX2 = margin + contentW - lpad
  const leftMid = (leftSigX1 + leftSigX2) / 2
  const rightMid = (rightSigX1 + rightSigX2) / 2

  /**
   * Dibuja una firma (dataURL PNG) apoyada sobre su línea, centrada y
   * escalada para no invadir la línea de al lado.
   */
  async function drawSignature(dataUrl: string | null | undefined, midX: number, lineY: number, maxW: number) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return
    const maxH = 32

    // La proporción se lee de la imagen: el pad da un lienzo apaisado, pero
    // una firma subida como foto puede tener cualquier forma y se deformaría
    // si asumiéramos una relación fija.
    const ratio = await new Promise<number>((resolve) => {
      const im = new Image()
      im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 3)
      im.onerror = () => resolve(3)
      im.src = dataUrl
    })

    let w = maxW
    let h = w / ratio
    if (h > maxH) { h = maxH; w = h * ratio }

    try {
      doc.addImage(dataUrl, 'PNG', midX - w / 2, lineY - h - 1, w, h, undefined, 'FAST')
    } catch {
      // Una firma corrupta no debe impedir que se emita el informe
    }
  }

  // Firma del técnico: viene de la pregunta tipo 'firmante', que guarda una
  // copia de la firma registrada en form_signatories.
  const firmante = findAnswer(a, ['firmante', 'tecnico', 'firma_tecnico'], (v) => v && typeof v === 'object' && 'firma' in v)
  const tecnicoNombre =
    (firmante?.nombre as string) ||
    `${a.tecnico_nombre ?? ''} ${a.tecnico_apellido ?? ''}`.trim()

  await drawSignature(firmante?.firma, leftMid, sigLineY, leftSigX2 - leftSigX1 - 8)

  setFont({ size: 9 })
  if (tecnicoNombre) text(tecnicoNombre, leftMid, sigLineY + 21, { align: 'center' })

  // Firma del cliente: pregunta tipo 'firma' (pad con el dedo)
  const firmaCliente = findAnswer(a, ['firma_cliente', 'firma'], (v) => typeof v === 'string' && v.startsWith('data:image'))
  await drawSignature(firmaCliente, rightMid, sigLineY, rightSigX2 - rightSigX1 - 8)

  stroke(BLACK)
  line(leftSigX1, sigLineY, leftSigX2, sigLineY)
  line(rightSigX1, sigLineY, rightSigX2, sigLineY)

  setFont({ size: 9, style: 'bold' })
  text('TÉCNICO GATWICK PERÚ', leftMid, sigLineY + 11, { align: 'center' })
  text('FIRMA DEL CLIENTE', rightMid, sigLineY + 11, { align: 'center' })
  setFont({ size: 7.5, style: 'normal' })
  text('NOMBRE:', rightSigX1, sigLineY + 23)
  text('DNI:', rightSigX1, sigLineY + 33)

  // ─────────── FOOTER ───────────
  setFont({ size: 7 }); color([90, 90, 90])
  const footer = [
    'Gatwick Elevadores S.A.C.   Av. Santa Rosa N° 180   Urb. Industrial La Aurora   Lima - Lima - Ate',
    'www.gatwick.com.pe   e-mail: servicio_tecnico@gatwick.com.pe',
    'Teléfono Directo: 01480 0271   Atención las 24 horas al RPC: 955322269',
  ]
  let footerY = pageH - frameInset - 30
  for (const ln of footer) {
    text(ln, pageW / 2, footerY, { align: 'center' })
    footerY += 9
  }
  color(BLACK)

  // ─────────── Guardar ───────────
  const fileName = `informe-tecnico-gatwick-${String(response.id).padStart(6, '0')}.pdf`
  doc.save(fileName)
}
