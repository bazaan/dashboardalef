/**
 * Trade Cars — lógica del funnel de compras
 * ------------------------------------------
 * Traduce a código las reglas que hoy viven en las fórmulas del Power BI
 * (funnel tradecars 2.pbix) y que el cliente validó en la reunión del 26/08/2026.
 *
 * REVISADO tras la reunión de alineación de septiembre/2026 con Trade Cars
 * (Jean Marcos Silvera). El embudo se arma en CASCADA a partir de DOS campos del
 * CRM: `Coincide` (✓ / x  ->  perfil_coincide SI / NO) y `estado` (6 valores):
 *
 *   LEADS            todo lo que entra (con o sin perfil, con o sin estado)
 *   CUMPLE POLITICA  Coincide = SI  (con cualquiera de los 6 estados, o todavía sin estado)
 *   CONTACTADO       Coincide = SI  y  estado ∈ {NO INTERESADO, EN SEGUIMIENTO, CITA, CITA ASISTIDA, CONCRETADA}
 *   INTERESADOS      Coincide = SI  y  estado ∈ {EN SEGUIMIENTO, CITA, CITA ASISTIDA, CONCRETADA}
 *   CITAS AGENDADAS  Coincide = SI  y  estado ∈ {CITA, CITA ASISTIDA, CONCRETADA}
 *   CITAS ASISTIDAS  Coincide = SI  y  estado ∈ {CITA ASISTIDA, CONCRETADA}
 *   COMPRAS          Coincide = SI  y  estado = CONCRETADA
 *
 * Reglas que salieron de esa reunión y que este archivo hace cumplir:
 *  - Un lead con Coincide = NO se queda SOLO en LEADS, tenga el estado que tenga
 *    (en el CRM el estado se bloquea al marcar NO; aquí se ignora por si llega).
 *  - Coincide = SI ya es CUMPLE POLITICA aunque el asesor todavía no haya elegido
 *    estado: "cumple política es netamente si coincide". Es la misma condición que
 *    dispara la etiqueta `cumple_politica` en Chatwoot (flujo n8n del funnel), así
 *    la etiqueta y la barra del embudo nunca se contradicen. "No contactado" es
 *    solo el estado de entrada: no mueve al lead de esa barra.
 *  - "NO INTERESADO" cuenta como CONTACTADO pero NO como INTERESADOS.
 *  - El CRM manda "Concretado" (masculino); el dashboard guarda "CONCRETADA".
 *    Se aceptan las dos.
 *
 * Vive en `utils/` (auto-import de Nuxt) para que los módulos del funnel
 * —embudo, tabla de leads y análisis de conversión— calculen exactamente igual.
 * La misma lógica está replicada en columnas GENERATED de Postgres
 * (sql/tradecars_funnel_v2_crm.sql): si se cambia una, hay que cambiar la otra.
 * El endpoint server/api/tradecars/funnel-lead.ts importa este mismo archivo
 * para normalizar lo que manda el CRM.
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
 * Con PERFIL COINCIDE = NO (o sin calificar) el lead se queda en LEADS sin
 * importar el status.
 */
const STATUS_A_ETAPA: Record<TcStatus, TcEtapa> = {
  'NO CONTACTADO':  'CUMPLE POLITICA',
  'NO INTERESADO':  'CONTACTADO',
  'EN SEGUIMIENTO': 'INTERESADOS',
  'CITA':           'CITAS AGENDADAS',
  'CITA ASISTIDA':  'CITAS ASISTIDAS',
  'CONCRETADA':     'COMPRAS',
}

/**
 * El dropdown `estado` del CRM dice "Concretado" (masculino) y el dashboard
 * guarda "CONCRETADA" desde el 26/08. Se aceptan los dos para que ninguna de
 * las dos fuentes pueda dejar un lead fuera del embudo por un tema de género.
 */
const STATUS_ALIAS: Record<string, TcStatus> = {
  'CONCRETADO': 'CONCRETADA',
}

/** Statuses desde los que un lead NO puede retroceder (regla anti-regresión). */
export const TC_STATUS_IRREVERSIBLES: TcStatus[] = ['CITA', 'CITA ASISTIDA', 'CONCRETADA']

/* ══════════════════ Normalización ══════════════════ */

/**
 * Normaliza texto libre del CRM: mayúsculas, sin acentos, sin espacios de más.
 * OJO: `\s+` también se come los TABULADORES — dos valores del dropdown `estado`
 * de Chatwoot vienen con un tab escondido delante ("\tNo interesado",
 * "\tEn seguimiento"). Sin esta normalización no coincidirían con la lista.
 */
export function tcNormalizar(v: any): string {
  return String(v ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFE0F/g, '')                    // selector de variacion de emoji
    .replace(/\s+/g, ' ')
    .trim()
}

/** Resuelve alias ("CONCRETADO") a su valor canónico. Devuelve '' si está vacío. */
function statusCanonico(v: any): string {
  const s = tcNormalizar(v)
  return STATUS_ALIAS[s] || s
}

/** Devuelve el STATUS válido, o null si está vacío o el CRM mandó algo no reconocido. */
export function tcStatusValido(v: any): TcStatus | null {
  const s = statusCanonico(v)
  if (!s) return null
  return (TC_STATUS as readonly string[]).includes(s) ? (s as TcStatus) : null
}

/** true cuando el CRM mandó un status con contenido pero fuera de la lista cerrada. */
export function tcStatusEsInvalido(v: any): boolean {
  const s = statusCanonico(v)
  return !!s && !(TC_STATUS as readonly string[]).includes(s)
}

/**
 * PERFIL COINCIDE en tres estados. El CRM de Trade Cars lo marca con un dropdown
 * "Coincide": ✓ (coincide) / x (no coincide) / vacío (todavía sin calificar).
 * Cuando llega vacío NO es lo mismo que "NO": el lead simplemente no fue evaluado,
 * y la métrica de "no coinciden" no debe inflarse con ellos.
 */
export type TcPerfil = 'SI' | 'NO' | ''

const PERFIL_SI = ['SI', 'YES', 'TRUE', '1', '✓', '✔', '✅', '☑']
const PERFIL_NO = ['NO', 'X', 'FALSE', '0', '✗', '✘', '✖', '❌']

export function tcPerfilValor(v: any): TcPerfil {
  const s = tcNormalizar(v)
  if (!s) return ''
  if (PERFIL_SI.includes(s)) return 'SI'
  if (PERFIL_NO.includes(s)) return 'NO'
  return ''
}

/** PERFIL COINCIDE = SI (✓). */
export function tcPerfilCoincide(v: any): boolean {
  return tcPerfilValor(v) === 'SI'
}

/** PERFIL COINCIDE = NO (x), marcado explícitamente por el asesor. */
export function tcPerfilNoCoincide(v: any): boolean {
  return tcPerfilValor(v) === 'NO'
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
 * Etapa más avanzada que alcanzó el lead. Siempre devuelve una etapa: todo lead
 * cuenta al menos como LEADS ("todo lo que entra").
 *
 *  - Coincide = NO o sin calificar          -> LEADS
 *  - Coincide = SI + estado válido          -> la etapa de ese estado
 *  - Coincide = SI sin estado, o con un
 *    estado fuera de la lista cerrada       -> CUMPLE POLITICA (cumple el perfil; le
 *                                              falta un estado válido para avanzar,
 *                                              y eso se avisa aparte con tcSinEstado()
 *                                              / tcStatusEsInvalido())
 */
export function tcEtapa(lead: TcLeadCrudo): TcEtapa {
  if (!tcPerfilCoincide(lead?.perfil_coincide)) return 'LEADS'

  const status = tcStatusValido(lead?.status)
  return status ? STATUS_A_ETAPA[status] : 'CUMPLE POLITICA'
}

/** Posición de la etapa en el embudo (0 = LEADS … 6 = COMPRAS). */
export function tcRank(lead: TcLeadCrudo): number {
  return TC_ETAPAS.indexOf(tcEtapa(lead))
}

/**
 * Coincide = SI pero el asesor todavía no le puso estado. Cuenta como CUMPLE POLITICA
 * pero no avanza más: es la lista de "a quién le falta poner estado" que se le pasa
 * al asesor.
 */
export function tcSinEstado(lead: TcLeadCrudo): boolean {
  return tcPerfilCoincide(lead?.perfil_coincide) && !String(lead?.status ?? '').trim()
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
  // Todo lead tiene rank >= 0 (LEADS = todo lo que entra): ya no hay leads "fuera del embudo".
  const ranks = leads.map(tcRank)
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
  perfil?: string     // 'SI' | 'NO' | 'SIN' (sin calificar) | 'todos'
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
      // 'NO' es el "x" explícito del asesor; un lead todavía sin calificar es 'SIN'.
      const valor = tcPerfilValor(l.perfil_coincide)
      if (f.perfil === 'SI' && valor !== 'SI') return false
      if (f.perfil === 'NO' && valor !== 'NO') return false
      if (f.perfil === 'SIN' && valor !== '') return false
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

/* ══════════════════ Perfiles que NO coinciden ══════════════════
 *
 * Métrica adicional que pidió Jean Marcos en la reunión de alineación
 * (y que Roberto aceptó): "un apartado que mida la cantidad de perfiles que no
 * coinciden y que se pueda dar la distribución por semana, por día o por mes".
 * NO es un embudo — es un contador con su distribución en el tiempo.
 */

export interface TcResumenPerfiles {
  total: number
  /** Coincide = SI (✓). */
  coinciden: number
  /** Coincide = NO (x) marcado explícitamente por el asesor. */
  noCoinciden: number
  /** Todavía sin calificar (el asesor no marcó ni ✓ ni x). */
  sinCalificar: number
  /** noCoinciden / total, en %. null si no hay leads. */
  pctNoCoinciden: number | null
}

export function tcResumenPerfiles(leads: TcLeadCrudo[]): TcResumenPerfiles {
  let coinciden = 0
  let noCoinciden = 0
  let sinCalificar = 0
  for (const l of leads) {
    const v = tcPerfilValor(l?.perfil_coincide)
    if (v === 'SI') coinciden++
    else if (v === 'NO') noCoinciden++
    else sinCalificar++
  }
  const total = leads.length
  return {
    total, coinciden, noCoinciden, sinCalificar,
    pctNoCoinciden: total > 0 ? (noCoinciden / total) * 100 : null,
  }
}

export type TcGranularidad = 'dia' | 'semana' | 'mes'

export interface TcPuntoSerie {
  /** Clave ordenable: YYYY-MM-DD (día y semana = lunes de esa semana) o YYYY-MM (mes). */
  clave: string
  etiqueta: string
  cantidad: number
}

/** Suma `dias` a una fecha YYYY-MM-DD sin depender de la zona horaria del navegador. */
function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + dias))
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0')
}

/** Lunes de la semana a la que pertenece la fecha (semana Lun–Dom, como en Perú). */
function lunesDe(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()   // 0 = domingo
  return sumarDias(fecha, -((dow + 6) % 7))
}

/** Clave del "cubo" (día / semana / mes) al que pertenece una fecha. */
export function tcClaveSerie(fecha: string, g: TcGranularidad): string {
  if (g === 'mes') return fecha.slice(0, 7)
  if (g === 'semana') return lunesDe(fecha)
  return fecha
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function etiquetaSerie(clave: string, g: TcGranularidad): string {
  if (g === 'mes') {
    const [y, m] = clave.split('-')
    return MESES_CORTOS[Number(m) - 1] + ' ' + y.slice(2)
  }
  const [, m, d] = clave.split('-')
  const base = d + ' ' + MESES_CORTOS[Number(m) - 1]
  return g === 'semana' ? 'Sem ' + base : base
}

/**
 * Distribución en el tiempo de los leads con Coincide = NO. Se agrupan por la
 * MISMA fecha del funnel que usa todo el dashboard (para que los filtros de
 * período no se contradigan) y se rellenan con 0 los días/semanas/meses sin
 * datos entre el primero y el último, así el gráfico no "salta" huecos.
 */
export function tcSerieNoCoinciden(leads: TcLeadCrudo[], g: TcGranularidad): TcPuntoSerie[] {
  const conteo = new Map<string, number>()
  for (const l of leads) {
    if (!tcPerfilNoCoincide(l?.perfil_coincide)) continue
    const f = tcFechaFunnel(l)
    if (!f) continue
    const k = tcClaveSerie(f, g)
    conteo.set(k, (conteo.get(k) || 0) + 1)
  }
  if (!conteo.size) return []

  const claves = [...conteo.keys()].sort()
  const primera = claves[0]
  const ultima = claves[claves.length - 1]

  const serie: TcPuntoSerie[] = []
  let actual = primera
  // tope de seguridad: 800 cubos (más de 2 años en modo día) para no colgar el navegador
  for (let i = 0; i < 800 && actual <= ultima; i++) {
    serie.push({ clave: actual, etiqueta: etiquetaSerie(actual, g), cantidad: conteo.get(actual) || 0 })
    if (g === 'mes') {
      const [y, m] = actual.split('-').map(Number)
      actual = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0')
    } else {
      actual = sumarDias(actual, g === 'semana' ? 7 : 1)
    }
  }
  return serie
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
