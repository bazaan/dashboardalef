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

export const fechaCorta = (v: any) => {
  if (!v) return '—'
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
  return isNaN(d.getTime()) ? String(v)
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export const fechaHora = (v: any) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? String(v)
    : d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

export const FUENTES_LEAD = [
  { value: 'meta_ads', title: 'Meta Ads' },
  { value: 'referido', title: 'Referido' },
  { value: 'instagram_dm', title: 'Instagram DM' },
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

export const ESTADOS_ENTREGABLE = [
  { value: 'en_produccion', title: 'En producción', color: 'info' },
  { value: 'en_revision', title: 'En revisión', color: 'warning' },
  { value: 'aprobado', title: 'Aprobado por Dirección', color: 'success' },
  { value: 'entregado', title: 'Entregado', color: 'primary' },
  { value: 'rechazado', title: 'Rechazado', color: 'error' },
]
