/**
 * Helpers compartidos por los módulos del dashboard Piola.
 *
 * Moneda única: soles (§1). Fechas en formato peruano. La jerarquía de
 * categorías de gasto se aplana aquí para poder pintarla en un <v-select>
 * sin perder la relación padre → hija.
 */

export const PEN = (n: any) =>
  `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const PEN_CORTO = (n: any) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return `S/ ${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `S/ ${(v / 1_000).toFixed(1)}k`
  return `S/ ${v.toFixed(0)}`
}

/** dd/mm/aaaa — el formato que pidió el cliente (19/08). */
export const fechaCorta = (v: any) => {
  if (!v) return '—'
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
  return isNaN(d.getTime()) ? String(v)
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** dd/mm/aaaa hh:mm — con año, para no perder el contexto en históricos largos. */
export const fechaHora = (v: any) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? String(v)
    : d.toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
}

/** 'HH:MM' en hora Lima a partir de un timestamp UTC. */
export const horaLima = (v: any) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—'
    : new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(d)
}

export const minutosAHoras = (min: any) => {
  const m = Math.max(0, Number(min || 0))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** 'YYYY-MM' del mes actual en Lima. */
export const periodoActual = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' })
    .format(new Date()).slice(0, 7)

/** Hoy 'YYYY-MM-DD' en Lima. */
export const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

/** Últimos N periodos 'YYYY-MM', del más reciente al más antiguo. */
export function ultimosPeriodos(n = 12): string[] {
  const out: string[] = []
  const [y, m] = periodoActual().split('-').map(Number)
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

/**
 * Resuelve un documento a una URL que el <iframe> del visor pueda abrir.
 *
 * Acepta las dos formas que conviven en la BD:
 *   • path dentro del bucket `piola-docs` → lo que guardan contratos y adendas
 *   • URL completa                        → lo que ya guardaban boletas y facturas (pdf_url)
 */
export function urlDocumento(client: any, path: string | null | undefined): string {
  if (!path) return ''
  const v = String(path)
  if (/^https?:\/\//i.test(v) || v.startsWith('data:') || v.startsWith('blob:')) return v
  try {
    return client?.storage?.from('piola-docs')?.getPublicUrl(v)?.data?.publicUrl || ''
  } catch {
    return ''
  }
}

/** Condiciones de pago de un contrato. Catálogo corto y estable. */
export const MODALIDADES_PAGO = [
  { value: 'mensual', title: 'Mensual' },
  { value: 'quincenal', title: 'Quincenal' },
  { value: 'por_entregable', title: 'Por entregable' },
  { value: 'contra_entrega', title: 'Contra entrega' },
  { value: 'adelanto_saldo', title: 'Adelanto + saldo' },
  { value: 'pago_unico', title: 'Pago único' },
]

export interface CategoriaPlana {
  id: number
  nombre: string
  parent_id: number | null
  nivel: number
  ruta: string          // 'Impuestos › IGV'
  tipo: string
  activo: boolean
}

/**
 * Aplana el árbol de `piola_expense_categories` conservando el orden padre →
 * hijas y calculando la ruta completa (para mostrarla en selects y reportes).
 */
export function aplanarCategorias(categorias: any[]): CategoriaPlana[] {
  const out: CategoriaPlana[] = []
  const hijas = (parentId: number | null) => categorias
    .filter(c => (c.parent_id ?? null) === parentId)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre)))

  const recorrer = (parentId: number | null, nivel: number, prefijo: string) => {
    for (const c of hijas(parentId)) {
      const ruta = prefijo ? `${prefijo} › ${c.nombre}` : c.nombre
      out.push({
        id: c.id, nombre: c.nombre, parent_id: c.parent_id ?? null,
        nivel, ruta, tipo: c.tipo, activo: c.activo !== false,
      })
      recorrer(c.id, nivel + 1, ruta)
    }
  }
  recorrer(null, 0, '')
  return out
}

/** Nombre de la categoría raíz de la que cuelga `id` (para agrupar egresos). */
export function categoriaRaiz(categorias: any[], id: any): string {
  const c = categorias.find((x: any) => x.id === id)
  if (!c) return 'Sin categoría'
  return c.parent_id ? categoriaRaiz(categorias, c.parent_id) : c.nombre
}

/**
 * Canales de entrada del lead.
 *
 * Los `value` son los del enum de `piola_leads.fuente`, que NO se toca: se
 * exponen tal cual y solo cambia la etiqueta. Por eso Instagram es
 * 'instagram_dm' y TikTok es 'tiktok_ads' — ambos ya existían en el CHECK de
 * la tabla pero estaban ocultos en la UI.
 */
export const FUENTES_LEAD = [
  { value: 'meta_ads', title: 'Meta Ads' },
  { value: 'referido', title: 'Referido' },
  { value: 'instagram_dm', title: 'Instagram' },
  { value: 'tiktok_ads', title: 'TikTok' },
  { value: 'organico', title: 'Orgánico' },
  { value: 'whatsapp', title: 'WhatsApp' },
  { value: 'facebook', title: 'Facebook' },
  { value: 'otro', title: 'Otro' },
]

export const CANALES_ACTIVIDAD = [
  { value: 'whatsapp', title: 'WhatsApp' },
  { value: 'llamada', title: 'Llamada' },
  { value: 'correo', title: 'Correo' },
  { value: 'reunion_presencial', title: 'Reunión presencial' },
  { value: 'reunion_virtual', title: 'Reunión virtual' },
  { value: 'instagram', title: 'Instagram' },
  { value: 'nota', title: 'Nota interna' },
]

/* ══════════════════ Módulo financiero ══════════════════ */

/** Ciclo de cobro/pago de un movimiento (piola_transactions.estado). */
export const ESTADOS_MOVIMIENTO = [
  { value: 'pendiente', title: 'Pendiente', color: 'grey' },
  { value: 'parcial', title: 'Parcial', color: 'warning' },
  { value: 'pagado', title: 'Pagado', color: 'success' },
  { value: 'vencido', title: 'Vencido', color: 'error' },
  { value: 'anulado', title: 'Anulado', color: 'grey' },
]

export const etiquetaEstado = (v: any) =>
  ESTADOS_MOVIMIENTO.find(e => e.value === v)?.title || v || '—'
export const colorEstadoMovimiento = (v: any) =>
  ESTADOS_MOVIMIENTO.find(e => e.value === v)?.color || 'grey'

export const TIPOS_MOV_CAJA = [
  { value: 'ingreso', title: 'Ingreso', icon: 'mdi-arrow-down-bold', color: 'success' },
  { value: 'egreso', title: 'Egreso', icon: 'mdi-arrow-up-bold', color: 'error' },
  { value: 'transferencia', title: 'Transferencia', icon: 'mdi-bank-transfer', color: 'info' },
  { value: 'retiro', title: 'Retiro', icon: 'mdi-cash-minus', color: 'warning' },
]

export interface TotalesMovimiento {
  subtotal: number
  descuento: number
  impuestos: number
  total: number
  detalle: Array<{ codigo: string; nombre: string; tasa: number; monto: number; comportamiento: string }>
}

/**
 * Totales de un ingreso o gasto.
 *
 *   base  = subtotal − descuento
 *   los impuestos 'agrega' (IGV) suman al total
 *   los 'retiene' (renta, detracción) NO cambian el total: son retenciones
 *   sobre lo que se termina cobrando, y se informan aparte
 *
 * Se calcula igual en el formulario y en los reportes para que no haya dos
 * verdades sobre el mismo movimiento.
 */
export function calcularTotalesMovimiento(
  subtotal: number,
  descuento: number,
  impuestosAplicados: Array<{ codigo: string; nombre: string; tasa: number; comportamiento: string }>,
): TotalesMovimiento {
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
  const sub = r2(subtotal)
  const desc = r2(descuento)
  const base = r2(Math.max(sub - desc, 0))

  const detalle = (impuestosAplicados || []).map(i => ({
    codigo: i.codigo,
    nombre: i.nombre,
    tasa: Number(i.tasa) || 0,
    comportamiento: i.comportamiento,
    monto: r2(base * (Number(i.tasa) || 0) / 100),
  }))

  const agregados = detalle
    .filter(d => d.comportamiento === 'agrega')
    .reduce((s, d) => s + d.monto, 0)

  return {
    subtotal: sub,
    descuento: desc,
    impuestos: r2(agregados),
    total: r2(base + agregados),
    detalle,
  }
}

/** Días de atraso respecto de hoy. 0 si no venció o no tiene vencimiento. */
export function diasAtraso(fechaVencimiento: any, estado?: string): number {
  if (!fechaVencimiento || ['pagado', 'anulado'].includes(String(estado))) return 0
  const venc = String(fechaVencimiento).slice(0, 10)
  const dias = (Date.parse(`${hoyISO()}T12:00:00`) - Date.parse(`${venc}T12:00:00`)) / 86400000
  return dias > 0 ? Math.round(dias) : 0
}

/** Suma `dias` a una fecha 'YYYY-MM-DD'. Para derivar el vencimiento. */
export function sumarDiasISO(iso: string, dias: number): string {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + (Number(dias) || 0))
  return dt.toISOString().slice(0, 10)
}

/* ══════════════════ Clientes, contratos y documentos ══════════════════ */

/** Estados del contrato de cliente. */
export const ESTADOS_CONTRATO = [
  { value: 'borrador', title: 'Borrador', color: 'grey' },
  { value: 'vigente', title: 'Vigente', color: 'success' },
  { value: 'vencido', title: 'Vencido', color: 'error' },
  { value: 'renovado', title: 'Renovado', color: 'info' },
  { value: 'anulado', title: 'Anulado', color: 'grey' },
]

/** Cada cuánto se factura un contrato recurrente. */
export const FRECUENCIAS_CONTRATO = [
  { value: 'mensual', title: 'Mensual' },
  { value: 'bimestral', title: 'Bimestral' },
  { value: 'trimestral', title: 'Trimestral' },
  { value: 'semestral', title: 'Semestral' },
  { value: 'anual', title: 'Anual' },
  { value: 'unico', title: 'Pago único' },
]

/**
 * Tipos de documento adjunto (piola_documentos.tipo).
 * Los `value` son los del CHECK de la tabla: cambiar uno acá sin cambiarlo allá
 * hace fallar el insert con un error de constraint.
 */
export const TIPOS_DOCUMENTO = [
  { value: 'factura', title: 'Factura', icon: 'mdi-receipt-text' },
  { value: 'constancia_detraccion', title: 'Constancia de detracción', icon: 'mdi-bank-check' },
  { value: 'contrato', title: 'Contrato', icon: 'mdi-file-sign' },
  { value: 'anexo', title: 'Anexo', icon: 'mdi-paperclip-plus' },
  { value: 'ficha_ruc', title: 'Ficha RUC', icon: 'mdi-card-account-details' },
  { value: 'legal', title: 'Documento legal', icon: 'mdi-scale-balance' },
  { value: 'comprobante', title: 'Comprobante de pago', icon: 'mdi-cash-check' },
  { value: 'boleta', title: 'Boleta', icon: 'mdi-receipt' },
  { value: 'recibo', title: 'Recibo', icon: 'mdi-note-text' },
  { value: 'orden_compra', title: 'Orden de compra', icon: 'mdi-clipboard-list' },
  { value: 'otro', title: 'Otro', icon: 'mdi-file-outline' },
]

export const etiquetaTipoDocumento = (v: any) =>
  TIPOS_DOCUMENTO.find(t => t.value === v)?.title || 'Otro'

/** Roles de producción para asignar responsables a un entregable. */
export const ROLES_PRODUCCION = [
  { value: 'responsable', title: 'Responsable' },
  { value: 'disenador', title: 'Diseñador' },
  { value: 'editor', title: 'Editor' },
  { value: 'guionista', title: 'Guionista' },
  { value: 'camarografo', title: 'Camarógrafo' },
  { value: 'fotografo', title: 'Fotógrafo' },
  { value: 'community', title: 'Community manager' },
  { value: 'revisor', title: 'Revisión / Dirección' },
]

export const etiquetaRolProduccion = (v: any) =>
  ROLES_PRODUCCION.find(r => r.value === v)?.title || v || 'Responsable'

/** Estado de una factura recurrente programada. */
export const ESTADOS_PROGRAMADA = [
  { value: 'pendiente', title: 'Pendiente', color: 'warning' },
  { value: 'generada', title: 'Generada', color: 'success' },
  { value: 'omitida', title: 'Omitida', color: 'grey' },
  { value: 'error', title: 'Error', color: 'error' },
]

/**
 * Lee un archivo del navegador como base64 (sin el prefijo data:).
 *
 * Se usa para mandar el Excel al endpoint de importación. `readAsDataURL` y no
 * `readAsText` porque un .xlsx es binario: leerlo como texto lo corrompe antes
 * de que salga de la máquina.
 */
export function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const r = String(reader.result || '')
      resolve(r.slice(r.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Sube un archivo al bucket `piola-docs` y devuelve su path.
 *
 * Guarda el PATH y no la URL pública, igual que PiolaSubirPdf: si el bucket
 * pasa a privado, no hay que migrar ni una fila. Acepta cualquier tipo de
 * archivo (una constancia de detracción suele llegar escaneada como imagen).
 */
export async function subirArchivoPiola(
  client: any, file: File, carpeta: string
): Promise<{ path: string | null; error: string | null }> {
  const extension = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'bin').toLowerCase()
  const base = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-')
    .slice(0, 60) || 'documento'
  const ruta = `${carpeta}/${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await client.storage.from('piola-docs')
    .upload(ruta, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) return { path: null, error: error.message }
  return { path: ruta, error: null }
}

export const ESTADOS_ENTREGABLE = [
  { value: 'en_produccion', title: 'En producción', color: 'info' },
  { value: 'en_revision', title: 'En revisión', color: 'warning' },
  { value: 'aprobado', title: 'Aprobado por Dirección', color: 'success' },
  { value: 'entregado', title: 'Entregado', color: 'primary' },
  { value: 'rechazado', title: 'Rechazado', color: 'error' },
]

/**
 * Trae TODAS las filas de una consulta, sin el tope de 1000 de PostgREST.
 *
 * Supabase corta en 1000 filas por petición y no avisa: un .limit(8000)
 * devuelve 1000 y el reporte sale incompleto sin error. Este helper pagina
 * con .range() hasta que una página vuelve corta.
 *
 * Se le pasa una función que construye la consulta, no la consulta ya armada,
 * porque cada página necesita su propio .range() sobre un builder nuevo.
 *
 *   const tx = await traerTodo(() =>
 *     client.from('piola_transactions').select('*').order('fecha', { ascending: false }))
 *
 * ⚠️ Toda consulta paginada necesita un .order() DETERMINISTA. Sin orden
 * estable, dos páginas pueden traer la misma fila o saltarse otra.
 */
export async function traerTodo<T = any>(
  construirQuery: () => any,
  opciones: { pagina?: number; maximo?: number } = {},
): Promise<{ data: T[]; error: any }> {
  const pagina = opciones.pagina ?? 1000
  const maximo = opciones.maximo ?? 50000
  const filas: T[] = []
  let desde = 0

  while (desde < maximo) {
    const { data, error } = await construirQuery().range(desde, desde + pagina - 1)
    if (error) return { data: filas, error }
    const lote = (data as T[]) || []
    filas.push(...lote)
    // Una página corta significa que ya no hay más: ahorra una petición extra
    if (lote.length < pagina) break
    desde += pagina
  }
  return { data: filas, error: null }
}

/**
 * Llama a un endpoint de escritura de Piola (`/api/piola/<ruta>`).
 *
 * POR QUÉ EXISTE: escribir desde el navegador con `client.from(...).insert()`
 * saltea `exigirModulo()` / `exigirAdmin()` de server/utils/piola.ts, con lo
 * cual los permisos por módulo quedan en decoración: cualquiera con las
 * devtools abiertas registra un pago o cierra una caja. Todo lo que muta plata,
 * remuneraciones o catálogos pasa por acá.
 *
 * Devuelve la MISMA forma que Supabase — { data, error } — para que el código
 * que llama no cambie de estructura:
 *
 *   const { error } = await apiPiola('caja', { accion: 'abrir', ... })
 *   if (error) return emit('notify', { text: error.message, color: 'error' })
 *
 * El mensaje del servidor se propaga tal cual (incluido el de Postgres cuando
 * la operación choca contra un índice único o una FK), porque varias pantallas
 * lo interpretan: /duplicate key/, /violates foreign key/, etc.
 */
export async function apiPiola<T = any>(
  ruta: string,
  body: Record<string, any>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const data = await $fetch<T>(`/api/piola/${ruta}`, { method: 'POST', body })
    return { data, error: null }
  } catch (e: any) {
    const message = e?.data?.statusMessage || e?.data?.message
      || e?.statusMessage || e?.message || 'No se pudo completar la operación'
    return { data: null, error: { message: String(message) } }
  }
}
