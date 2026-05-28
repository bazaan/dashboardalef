/**
 * Exporta una respuesta de formulario de Gatwick (slug "gtw-IT-001")
 * como PDF replicando el formato físico del "INFORME TÉCNICO".
 *
 * Usa jsPDF cargado dinámicamente desde CDN para evitar bloat del bundle
 * principal — solo se descarga cuando el usuario hace click en "PDF".
 */

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

/** Helper: marca un check según si val coincide con expected (case/space insensitive) */
function check(val: any, expected: string): string {
  if (!val) return '(  )'
  const v = String(val).toLowerCase().trim()
  const e = expected.toLowerCase().trim()
  return v === e || v.startsWith(e) ? '( X )' : '(  )'
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

export async function exportGatwickPdf(response: GatwickResponse, form: FormDefinition): Promise<void> {
  const jsPDF = await loadJsPDF()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const a = response.answers || {}
  const margin = 36                     // 0.5"
  const pageW = doc.internal.pageSize.getWidth()    // ~595
  const pageH = doc.internal.pageSize.getHeight()   // ~842
  const contentW = pageW - margin * 2

  // ─────────── Helpers de dibujo ───────────
  function setFont(opts: { size?: number; style?: 'normal'|'bold' } = {}) {
    doc.setFont('helvetica', opts.style || 'normal')
    doc.setFontSize(opts.size ?? 9)
  }
  function text(t: string, x: number, y: number, opts: any = {}) {
    doc.text(t ?? '', x, y, opts)
  }
  function line(x1: number, y1: number, x2: number, y2: number) {
    doc.setLineWidth(0.5)
    doc.line(x1, y1, x2, y2)
  }
  function rect(x: number, y: number, w: number, h: number, style: 'S'|'F'|'FD' = 'S') {
    doc.rect(x, y, w, h, style)
  }
  function fill(r: number, g: number, b: number) { doc.setFillColor(r, g, b) }
  function stroke(r: number, g: number, b: number) { doc.setDrawColor(r, g, b) }
  function color(r: number, g: number, b: number) { doc.setTextColor(r, g, b) }

  /** Imprime una etiqueta + valor con línea de puntos al estilo del form físico */
  function labelLine(label: string, value: string, x: number, y: number, w: number, opts: { labelW?: number } = {}) {
    const labelW = opts.labelW ?? 80
    setFont({ size: 8, style: 'bold' })
    text(label + ':', x, y)
    setFont({ size: 9 })
    text(String(value ?? ''), x + labelW, y, { maxWidth: w - labelW })
    // línea inferior tenue
    stroke(180, 180, 180)
    line(x + labelW, y + 2, x + w - 4, y + 2)
    stroke(0, 0, 0)
  }

  /** Wraps de texto largo a varias líneas */
  function wrappedText(t: string, x: number, y: number, maxW: number, lineH: number): number {
    const lines = doc.splitTextToSize(String(t ?? ''), maxW)
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], x, y + i * lineH)
    }
    return y + lines.length * lineH
  }

  // ─────────── HEADER ───────────
  let y = margin

  // Logo (placeholder con texto) y título centrado
  fill(255, 255, 255)
  rect(margin, y, contentW, 50)

  // Logo cuadrado
  fill(0, 0, 0)
  rect(margin + 4, y + 4, 42, 42, 'F')
  color(255, 255, 255)
  setFont({ size: 9, style: 'bold' })
  text('GATWICK', margin + 8, y + 22)
  setFont({ size: 6 })
  text('ASCENSORES', margin + 8, y + 32)
  color(0, 0, 0)

  // Título centrado
  setFont({ size: 16, style: 'bold' })
  color(190, 0, 0)
  text('INFORME TÉCNICO', pageW / 2 - 60, y + 30)
  color(0, 0, 0)

  // Número de informe (usa el ID de la respuesta, padded a 6 dígitos)
  setFont({ size: 12, style: 'bold' })
  color(190, 0, 0)
  const numStr = `N° ${String(response.id).padStart(6, '0')}`
  text(numStr, pageW - margin - 80, y + 30)
  color(0, 0, 0)

  y += 52
  rect(margin, y - 50, contentW, 50)

  // ─────────── DATOS DEL CLIENTE ───────────
  y += 4
  const fechaTxt = a.fecha
    ? new Date(a.fecha).toLocaleDateString('es-PE')
    : new Date(response.submitted_at).toLocaleDateString('es-PE')

  labelLine('Cliente', a.cliente, margin + 4, y, contentW * 0.65)
  labelLine('Fecha', fechaTxt, margin + contentW * 0.65 + 4, y, contentW * 0.35 - 4, { labelW: 40 })
  y += 16

  labelLine('Dirección', a.direccion, margin + 4, y, contentW * 0.5)
  labelLine('Distrito', a.distrito, margin + contentW * 0.5 + 4, y, contentW * 0.3, { labelW: 50 })
  // Garantía
  setFont({ size: 8, style: 'bold' })
  text('Garantía', margin + contentW * 0.8 + 4, y)
  setFont({ size: 9 })
  text(`SI ${check(a.garantia, 'sí')}`, margin + contentW * 0.8 + 50, y)
  text(`NO ${check(a.garantia, 'no')}`, margin + contentW * 0.8 + 95, y)
  y += 16

  labelLine('Referencia', a.referencia, margin + 4, y, contentW * 0.65)
  labelLine('Teléfono', a.telefono, margin + contentW * 0.65 + 4, y, contentW * 0.35 - 4, { labelW: 50 })
  y += 14

  // ─────────── DATOS TÉCNICOS (header rosa) ───────────
  fill(255, 200, 215)
  rect(margin, y, contentW, 14, 'F')
  rect(margin, y, contentW, 14)
  setFont({ size: 9, style: 'bold' })
  text('DATOS TÉCNICOS', pageW / 2 - 40, y + 10)
  y += 18

  // Tipología y tipo (checks)
  setFont({ size: 8, style: 'bold' })
  text('Tipología de elevador:', margin + 4, y)
  setFont({ size: 9 })
  text(`Hidra. ${check(a.tipologia_elevador, 'hidráulico')}`, margin + 130, y)
  text(`Electro. ${check(a.tipologia_elevador, 'electromecánico')}`, margin + 200, y)
  y += 12

  setFont({ size: 8, style: 'bold' })
  text('Tipo de elevador:', margin + 4, y)
  setFont({ size: 9 })
  text(`Ascen. ${check(a.tipo_elevador, 'ascensor')}`, margin + 130, y)
  text(`Monta. ${check(a.tipo_elevador, 'montacargas')}`, margin + 195, y)
  y += 11
  text(`Montavehíc. ${check(a.tipo_elevador, 'montavehículo')}`, margin + 130, y)
  text(`Plataf. ${check(a.tipo_elevador, 'plataforma')}`, margin + 215, y)
  y += 12

  // Dos columnas de campos técnicos
  const colW = contentW / 2 - 6
  const yColStart = y
  const leftCol = [
    ['Máquina de tracción',   a.maquina_traccion],
    ['Potencia HP',           a.potencia_hp],
    ['Operador de Puerta',    a.operador_puerta],
    ['Puertas de Cabecera',   a.puertas_cabecera],
    ['Cable Viajero',         a.cable_viajero],
    ['Botonera',              a.botonera],
    ['Indicadores',           a.indicadores],
    ['Contrapeso',            a.contrapeso],
    ['Cielo raso',            a.cielo_raso],
    ['Cabina',                a.cabina],
  ]
  const rightCol = [
    ['Rieles',                a.rieles],
    ['Cables de tracción',    a.cables_traccion],
    ['Poleas',                a.poleas],
    ['Tensores',              a.tensores],
    ['Guiadores',             a.guiadores],
    ['Sistema para ruidos',   a.sistema_ruidos],
    ['Limitador de velocidad',a.limitador_velocidad],
    ['Sensor de Puerta',      a.sensor_puerta],
    ['Inductores',            a.inductores],
    ['Sistema de Iluminación',a.sistema_iluminacion],
  ]

  for (let i = 0; i < leftCol.length; i++) {
    labelLine(leftCol[i][0], leftCol[i][1], margin + 4, yColStart + i * 12, colW, { labelW: 110 })
  }
  for (let i = 0; i < rightCol.length; i++) {
    labelLine(rightCol[i][0], rightCol[i][1], margin + contentW / 2 + 4, yColStart + i * 12, colW, { labelW: 120 })
  }
  y = yColStart + 10 * 12 + 6

  // ─────────── INFORME TÉCNICO ───────────
  fill(255, 200, 215)
  rect(margin, y, 120, 14, 'F')
  rect(margin, y, 120, 14)
  setFont({ size: 9, style: 'bold' })
  text('INFORME TÉCNICO', margin + 6, y + 10)
  rect(margin + 120, y, contentW - 120, 14)
  y += 14

  // Caja de texto del informe
  const informeHeight = 130
  rect(margin, y, contentW, informeHeight)
  setFont({ size: 9 })
  const informeY = wrappedText(a.informe_tecnico || '', margin + 6, y + 12, contentW - 12, 11)

  // Líneas guía interiores (sutiles)
  stroke(220, 220, 220)
  for (let yy = y + 11; yy < y + informeHeight; yy += 11) {
    line(margin + 4, yy, margin + contentW - 4, yy)
  }
  stroke(0, 0, 0)
  y += informeHeight + 4

  // ─────────── OBSERVACIONES ───────────
  fill(255, 200, 215)
  rect(margin, y, 120, 14, 'F')
  rect(margin, y, 120, 14)
  setFont({ size: 9, style: 'bold' })
  text('OBSERVACIONES', margin + 6, y + 10)
  rect(margin + 120, y, contentW - 120, 14)
  y += 14

  const obsHeight = 50
  rect(margin, y, contentW, obsHeight)
  setFont({ size: 9 })
  wrappedText(a.observaciones || '', margin + 6, y + 12, contentW - 12, 11)
  stroke(220, 220, 220)
  for (let yy = y + 11; yy < y + obsHeight; yy += 11) {
    line(margin + 4, yy, margin + contentW - 4, yy)
  }
  stroke(0, 0, 0)
  y += obsHeight + 14

  // ─────────── HORA ENTRADA / SALIDA ───────────
  setFont({ size: 9, style: 'bold' })
  text('HORA DE ENTRADA', margin + 40, y)
  text('HORA DE SALIDA', margin + contentW / 2 + 40, y)
  setFont({ size: 11 })
  text(String(a.hora_entrada ?? '—'), margin + 50, y + 14)
  text(String(a.hora_salida ?? '—'),  margin + contentW / 2 + 50, y + 14)
  y += 30

  // ─────────── FIRMAS / TÉCNICO ───────────
  // Línea para firma técnico
  line(margin + 30, y, margin + contentW / 2 - 30, y)
  line(margin + contentW / 2 + 30, y, margin + contentW - 30, y)
  y += 10
  setFont({ size: 9, style: 'bold' })
  const tecnicoNombre = `${a.tecnico_nombre ?? ''} ${a.tecnico_apellido ?? ''}`.trim()
  text(tecnicoNombre || 'TÉCNICO GATWICK PERU', margin + 60, y)
  text('FIRMA DEL CLIENTE', margin + contentW / 2 + 60, y)
  setFont({ size: 7 })
  text('NOMBRE:', margin + contentW / 2 + 30, y + 12)
  text('DNI:',     margin + contentW / 2 + 30, y + 22)
  y += 30

  // ─────────── FOOTER ───────────
  setFont({ size: 7 })
  color(80, 80, 80)
  const footer = [
    'Gatwick Elevadores S.A.C.   Av. Santa Rosa N° 180   Urb. Industrial La Aurora   Lima - Lima - Ate',
    'www.gatwick.com.pe   e-mail: servicio_tecnico@gatwick.com.pe',
    'Teléfono Directo: 01480 0271   Atención las 24 horas al RPC: 955322269',
  ]
  let footerY = pageH - margin - 24
  for (const ln of footer) {
    text(ln, pageW / 2, footerY, { align: 'center' })
    footerY += 9
  }
  color(0, 0, 0)

  // ─────────── Guardar ───────────
  const fileName = `informe-tecnico-gatwick-${String(response.id).padStart(6, '0')}.pdf`
  doc.save(fileName)
}
