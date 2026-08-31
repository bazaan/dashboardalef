/**
 * Trade Cars — lógica del funnel de compras
 * ------------------------------------------
 * Traduce a código las reglas que hoy viven en las fórmulas del Power BI
 * (funnel tradecars 2.pbix) y que el cliente validó en la reunión del 26/08/2026.
 *
 * Vive en `utils/` (auto-import de Nuxt) para que los tres módulos del funnel
 * —embudo, tabla de leads y análisis de conversión— calculen exactamente igual.
 * La misma lógica está replicada en columnas GENERATED de Postgres
 * (sql/tradecars_funnel.sql): si se cambia una, hay que cambiar la otra.
 */

/* ══════════════════ Valores cerrados ══════════════════ */

/** Los 6 valores del dropdown STATUS. Cerrado: cualquier otro valor es un error a mostrar. */
export const TC_STATUS = [
  'NO CONTACTADO',
  'NO INTERESADO',
  'EN SEGUIMIENTO',
  'CITA',
  'CITA ASISTIDA',
  'CONCRETADA',
] as const
export type TcStatus = typeof TC_STATUS[number]

/** Las 7 etapas del funnel, en orden. El índice es el rank que ordena el embudo. */
export const TC_ETAPAS = [
  'LEADS',
  'CUMPLE POLITICA',
  'CONTACTADO',
  'INTERESADOS',
  'CITAS AGENDADAS',
  'CITAS ASISTIDAS',
  'COMPRAS',
] as const
export type TcEtapa = typeof TC_ETAPAS[number]

export const TC_PERFIL = ['SI', 'NO'] as const

/** Canales de origen que llegan del CRM. */
export const TC_CANALES = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook'] as const

/**
 * STATUS -> etapa que alcanza el lead cuando PERFIL COINCIDE = SI.
 * Con PERFIL COINCIDE = NO el lead se queda en LEADS sin importar el status.
 */
const STATUS_A_ETAPA: Record<TcStatus, TcEtapa> = {
  'NO CONTACTADO':  'CUMPLE POLITICA',
  'NO INTERESADO':  'CONTACTADO',
  'EN SEGUIMIENTO': 'INTERESADOS',
  'CITA':           'CITAS AGENDADAS',
  'CITA ASISTIDA':  'CITAS ASISTIDAS',
  'CONCRETADA':     'COMPRAS',
}

/** Statuses desde los que un lead NO puede retroceder (regla anti-regresión). */
export const TC_STATUS_IRREVERSIBLES: TcStatus[] = ['CITA', 'CITA ASISTIDA', 'CONCRETADA']

/* ══════════════════ Normalización ══════════════════ */

/** Normaliza texto libre del CRM: mayúsculas, sin acentos, sin espacios de más. */
export function tcNormalizar(v: any): string {
  return String(v ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Devuelve el STATUS válido, o null si está vacío o el CRM mandó algo no reconocido. */
export function tcStatusValido(v: any): TcStatus | null {
  const s = tcNormalizar(v)
  if (!s) return null
  return (TC_STATUS as readonly string[]).includes(s) ? (s as TcStatus) : null
}

/** true cuando el CRM mandó un status con contenido pero fuera de la lista cerrada. */
export function tcStatusEsInvalido(v: any): boolean {
  const s = tcNormalizar(v)
  return !!s && !(TC_STATUS as readonly string[]).includes(s)
}

/** PERFIL COINCIDE = SI. Acepta SI/YES/TRUE/1 por tolerancia con el CRM. */
export function tcPerfilCoincide(v: any): boolean {
  const s = tcNormalizar(v)
  return s === 'SI' || s === 'YES' || s === 'TRUE' || s === '1'
}

/* ══════════════════ Etapa ══════════════════ */

export interface TcLeadCrudo {
  perfil_coincide?: any
  status?: any
  fecha_compra?: any
  fecha_cita?: any
  fecha_cita_asistida?: any
  fecha_derivacion?: any
  [k: string]: any
}

/**
 * Etapa más avanzada que alcanzó el lead.
 *
 * Devuelve null en dos casos que NO entran al funnel:
 *  - PERFIL COINCIDE = SI pero STATUS vacío (aún sin clasificar por el asesor)
 *  - STATUS con un valor fuera de la lista cerrada (dato sucio del CRM)
 * Se distinguen entre sí con tcStatusEsInvalido().
 */
export function tcEtapa(lead: TcLeadCrudo): TcEtapa | null {
  // Perfil NO: el lead existe pero no cumple política. Se queda en LEADS.
  if (!tcPerfilCoincide(lead?.perfil_coincide)) return 'LEADS'

  const status = tcStatusValido(lead?.status)
  if (!status) return null   // vacío o inválido: fuera del funnel hasta corregirlo

  return STATUS_A_ETAPA[status]
}

/** Posición de la etapa en el embudo (0 = LEADS … 6 = COMPRAS). -1 si no aplica. */
export function tcRank(lead: TcLeadCrudo): number {
  const e = tcEtapa(lead)
  return e ? TC_ETAPAS.indexOf(e) : -1
}

/* ══════════════════ Fecha del funnel ══════════════════ */

/** Convierte a YYYY-MM-DD lo que venga (Date, ISO, DD/MM/YYYY). null si no es fecha. */
export function tcFecha(v: any): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null

  // Ya viene ISO (con o sin hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3]

  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    return dmy[3] + '-' + m + '-' + d
  }

  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return d.getFullYear() + '-' + mm + '-' + dd
}

/**
 * La ÚNICA fecha con la que se filtra el dashboard por mes/año.
 * Prioridad: fecha de compra > fecha de la cita > fecha de derivación al asesor.
 * Un lead comprado en agosto aparece en agosto aunque haya entrado en mayo.
 *
 * En el Excel actual CITA y CITA ASISTIDA comparten la columna FECHA DE CITA.
 * El CRM sí las separa (el cliente pidió registrar cuándo se realizó la cita),
 * así que entre las dos gana la MÁS RECIENTE, como recomienda la §4 de la
 * especificación técnica.
 */
export function tcFechaFunnel(lead: TcLeadCrudo): string | null {
  const cita = tcFecha(lead?.fecha_cita)
  const asistida = tcFecha(lead?.fecha_cita_asistida)
  const evento = (cita && asistida) ? (asistida > cita ? asistida : cita) : (asistida || cita)

  return tcFecha(lead?.fecha_compra) || evento || tcFecha(lead?.fecha_derivacion)
}

/** YYYY-MM de la fecha del funnel, para agrupar/filtrar por mes. */
export function tcMesFunnel(lead: TcLeadCrudo): string | null {
  const f = tcFechaFunnel(lead)
  return f ? f.slice(0, 7) : null
}

/* ══════════════════ Embudo ══════════════════ */

export interface TcBarra {
  etapa: TcEtapa
  cantidad: number
  /** % respecto de la barra ANTERIOR (no del total). null en LEADS. */
  conversion: number | null
  /** % respecto del total de LEADS, como dato secundario. */
  sobreTotal: number | null
}

/**
 * Construye las 7 barras del embudo.
 *
 * Es ACUMULATIVO: cada barra cuenta los leads que alcanzaron esa etapa **o una
 * superior**. Un lead CONCRETADA suma en las 7 barras porque pasó por todas.
 */
export function tcConstruirFunnel(leads: TcLeadCrudo[]): TcBarra[] {
  const ranks = leads.map(tcRank).filter(r => r >= 0)   // -1 = fuera del funnel
  const total = ranks.length
  let previa = 0

  return TC_ETAPAS.map((etapa, i) => {
    const cantidad = ranks.filter(r => r >= i).length
    const conversion = i === 0 ? null : (previa > 0 ? (cantidad / previa) * 100 : 0)
    const sobreTotal = total > 0 ? (cantidad / total) * 100 : null
    previa = cantidad
    return { etapa, cantidad, conversion, sobreTotal }
  })
}

/* ══════════════════ Filtros ══════════════════ */

export interface TcFiltros {
  mes?: string        // 'YYYY-MM' | 'todos'
  anio?: string       // 'YYYY'    | 'todos'
  /** Rango de fechas (YYYY-MM-DD). Si vienen, pisan a `mes` — pedido explícito
   *  del cliente en la reunión del 26/08 para poder cortar por semana o por
   *  cualquier tramo, no solo por mes calendario. */
  fechaDesde?: string
  fechaHasta?: string
  asesor?: string     // 'todos'
  canal?: string      // 'todos'
  perfil?: string     // 'SI' | 'NO' | 'todos'
  etapa?: string      // TcEtapa | 'todos'
  buscar?: string
}

/** Aplica los filtros del dashboard sobre la fecha del funnel calculada. */
export function tcFiltrar(leads: TcLeadCrudo[], f: TcFiltros): TcLeadCrudo[] {
  const buscar = tcNormalizar(f.buscar)
  const usaRango = !!(f.fechaDesde || f.fechaHasta)

  return leads.filter((l) => {
    const fecha = tcFechaFunnel(l)

    if (usaRango) {
      if (!fecha) return false
      if (f.fechaDesde && fecha < f.fechaDesde) return false
      if (f.fechaHasta && fecha > f.fechaHasta) return false
    } else if (f.mes && f.mes !== 'todos') {
      if (!fecha || fecha.slice(0, 7) !== f.mes) return false
    }
    if (f.anio && f.anio !== 'todos') {
      if (!fecha || fecha.slice(0, 4) !== f.anio) return false
    }
    if (f.asesor && f.asesor !== 'todos' && (l.asesor || '') !== f.asesor) return false
    if (f.canal && f.canal !== 'todos' && (l.canal_origen || '') !== f.canal) return false

    if (f.perfil && f.perfil !== 'todos') {
      const coincide = tcPerfilCoincide(l.perfil_coincide)
      if (f.perfil === 'SI' && !coincide) return false
      if (f.perfil === 'NO' && coincide) return false
    }
    if (f.etapa && f.etapa !== 'todos' && tcEtapa(l) !== f.etapa) return false

    if (buscar) {
      const heno = tcNormalizar(
        [l.contacto_nombre, l.contacto_telefono, l.asesor, l.canal_origen, l.motivo_no_cita].join(' '),
      )
      if (!heno.includes(buscar)) return false
    }
    return true
  })
}

/* ══════════════════ Alertas de seguimiento ══════════════════ */

/** YYYY-MM-DD de hoy en hora de Lima (el equipo opera en Perú). */
export function tcHoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

/**
 * Seguimiento vencido: la fecha comprometida ya pasó y el lead sigue sin avanzar.
 * Avanzar = haber llegado al menos a CITA (rank >= 4).
 */
export function tcSeguimientoVencido(lead: TcLeadCrudo): boolean {
  const f = tcFecha(lead?.fecha_seguimiento)
  if (!f) return false
  if (tcRank(lead) >= TC_ETAPAS.indexOf('CITAS AGENDADAS')) return false
  return f < tcHoyLima()
}

/** Fecha probable de venta dentro del mes actual o del siguiente (para priorizar). */
export function tcVentaProxima(lead: TcLeadCrudo): boolean {
  const f = tcFecha(lead?.fecha_probable_venta)
  if (!f) return false

  const hoy = new Date(tcHoyLima() + 'T12:00:00')
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0')
  const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
  const mesSiguiente = sig.getFullYear() + '-' + String(sig.getMonth() + 1).padStart(2, '0')

  const m = f.slice(0, 7)
  return m === mesActual || m === mesSiguiente
}
