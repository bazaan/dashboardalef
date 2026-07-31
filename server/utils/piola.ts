/**
 * PIOLA × ALEF — Lógica de negocio compartida del servidor.
 *
 * Aquí vive todo lo que NO puede vivir en el navegador:
 *   • Verificación de sesión + resolución del rol por módulo (§8)
 *   • Reloj de servidor en zona America/Lima (§7.1: el tareo NO usa la hora del cliente)
 *   • Devengo de vacaciones 15 días/año = 1.25 días/mes, solo planilla (§7.2)
 *   • Cálculo de detracción de facturas (§5)
 *   • Fórmula de comisiones parametrizable (§4 — Piola enviará la fórmula exacta)
 *   • Segundo día hábil del mes siguiente (§7.4)
 */
import { getCookie, createError, type H3Event } from 'h3'
import type { PiolaModule } from '../../utils/permissions'

export const TZ_LIMA = 'America/Lima'
export const MONEDA = 'PEN'

/* ══════════════════ Reloj Lima (servidor) ══════════════════ */

/** 'YYYY-MM-DD' del día de HOY en Lima, calculado en el servidor. */
export function hoyLima(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_LIMA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** 'HH:MM' hora Lima. */
export function horaLima(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TZ_LIMA, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

/** 'YYYY-MM' del periodo actual en Lima. */
export function periodoLima(d: Date = new Date()): string {
  return hoyLima(d).slice(0, 7)
}

/** Suma días a una fecha 'YYYY-MM-DD' y devuelve 'YYYY-MM-DD'. */
export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

/** Días calendario entre dos fechas 'YYYY-MM-DD' (b − a). */
export function diasEntre(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
           - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  return Math.round(ms / 86400000)
}

/**
 * §7.4 — Fecha límite de pago del equipo: segundo día hábil del mes siguiente.
 * Solo excluye sábados y domingos (los feriados de SUNAT se pueden cargar luego).
 */
export function segundoDiaHabil(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m, 1))   // día 1 del mes SIGUIENTE
  let habiles = 0
  while (habiles < 2) {
    const dow = dt.getUTCDay()
    if (dow !== 0 && dow !== 6) habiles++
    if (habiles < 2) dt.setUTCDate(dt.getUTCDate() + 1)
  }
  return dt.toISOString().slice(0, 10)
}

/** §4 — Las comisiones del closer se pagan el 15 del mes siguiente al cierre. */
export function fechaPagoComision(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10)
}

/* ══════════════════ Sesión y permisos (§8) ══════════════════ */

export interface PerfilPiola {
  email: string
  /** Rol GLOBAL del dashboard Alef: superadmin | admin | agente */
  rolGlobal: string
  /** Ficha en piola_colaboradores (null si aún no la crearon) */
  colaborador: any | null
  /** Nombre del rol Piola (ej. 'Administrador', 'Comercial / CRM') */
  rolPiola: string | null
  /** true = acceso total, ignora el checklist de módulos */
  esAdmin: boolean
  /** { modulo: {can_view, can_create, can_edit, can_delete}, __admin: bool } */
  permisos: Record<string, any>
}

/**
 * Verifica la sesión contra `dashboardlogin` (nunca confía en la cookie) y
 * resuelve el rol Piola + el mapa de permisos por módulo.
 */
export async function verificarSesionPiola(event: H3Event, supabase: any): Promise<PerfilPiola> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rolGlobal = String(perfil.role ?? '').toLowerCase()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')
  const esSuper = rolGlobal === 'superadmin'
  // El equipo interno de Alef también opera el tablero de Piola
  if (!esSuper && !cid.includes('piola') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para Piola' })
  }

  const { data: colaborador } = await supabase
    .from('piola_colaboradores')
    .select('*, rol:piola_roles(id, nombre, es_admin)')
    .ilike('email', perfil.email)
    .maybeSingle()

  // Superadmin de Alef y admin sin ficha entran como Administrador de Piola.
  const esAdmin = esSuper
    || colaborador?.rol?.es_admin === true
    || (!colaborador && rolGlobal === 'admin')

  const permisos: Record<string, any> = { __admin: esAdmin }
  if (!esAdmin && colaborador?.role_id) {
    const { data: filas } = await supabase
      .from('piola_role_permissions')
      .select('module, can_view, can_create, can_edit, can_delete')
      .eq('role_id', colaborador.role_id)
    for (const f of filas || []) permisos[f.module] = f
  }
  // Todo colaborador ve su propio espacio y el home, tenga o no rol asignado.
  if (!permisos.mi_espacio) {
    permisos.mi_espacio = { module: 'mi_espacio', can_view: true, can_create: true, can_edit: true, can_delete: false }
  }
  if (!permisos.home) {
    permisos.home = { module: 'home', can_view: true, can_create: false, can_edit: false, can_delete: false }
  }

  return {
    email: perfil.email,
    rolGlobal,
    colaborador: colaborador || null,
    rolPiola: colaborador?.rol?.nombre || (esAdmin ? 'Administrador' : null),
    esAdmin,
    permisos,
  }
}

/** Lanza 403 si el perfil no puede realizar `accion` sobre `module`. */
export function exigirModulo(
  perfil: PerfilPiola,
  module: PiolaModule,
  accion: 'view' | 'create' | 'edit' | 'delete' = 'view'
): void {
  if (perfil.esAdmin) return
  const p = perfil.permisos[module]
  if (!p || p[`can_${accion}`] !== true) {
    throw createError({ statusCode: 403, statusMessage: `Sin permiso de ${accion} en el módulo ${module}` })
  }
}

/** §7.5 — Boletas de pago y reporte AFP: SOLO Administrador. */
export function exigirAdmin(perfil: PerfilPiola, que = 'esta operación'): void {
  if (!perfil.esAdmin) {
    throw createError({ statusCode: 403, statusMessage: `Solo un Administrador puede acceder a ${que}` })
  }
}

/* ══════════════════ Vacaciones (§7.2) ══════════════════ */

export const VACACIONES_DIAS_ANIO = 15
export const VACACIONES_DIAS_MES = VACACIONES_DIAS_ANIO / 12   // 1.25

export interface SaldoVacaciones {
  aplica: boolean            // false si es recibo por honorarios
  meses_trabajados: number
  dias_devengados: number
  dias_tomados: number
  dias_ajustes: number
  dias_disponibles: number
  antiguedad_dias: number
}

/**
 * Devengo proporcional: 15 días / 12 meses = 1.25 días por mes trabajado.
 * SOLO aplica a `tipo_contrato = 'planilla'` (§7.2).
 */
export function calcularVacaciones(
  colaborador: { tipo_contrato?: string; fecha_ingreso?: string | null },
  diasTomados = 0,
  diasAjustes = 0,
  hoy = hoyLima()
): SaldoVacaciones {
  const vacio: SaldoVacaciones = {
    aplica: false, meses_trabajados: 0, dias_devengados: 0,
    dias_tomados: diasTomados, dias_ajustes: diasAjustes,
    dias_disponibles: 0, antiguedad_dias: 0,
  }
  if (colaborador?.tipo_contrato !== 'planilla' || !colaborador?.fecha_ingreso) return vacio

  const ingreso = String(colaborador.fecha_ingreso).slice(0, 10)
  const antiguedad = Math.max(0, diasEntre(ingreso, hoy))

  // Meses completos trabajados (con la fracción del mes en curso).
  const [yi, mi, di] = ingreso.split('-').map(Number)
  const [yh, mh, dh] = hoy.split('-').map(Number)
  let meses = (yh - yi) * 12 + (mh - mi)
  if (dh < di) meses -= 1
  meses = Math.max(0, meses)

  const devengados = Math.round(meses * VACACIONES_DIAS_MES * 100) / 100
  const disponibles = Math.round((devengados - diasTomados + diasAjustes) * 100) / 100

  return {
    aplica: true,
    meses_trabajados: meses,
    dias_devengados: devengados,
    dias_tomados: diasTomados,
    dias_ajustes: diasAjustes,
    dias_disponibles: disponibles,
    antiguedad_dias: antiguedad,
  }
}

/** Días hábiles (L-V) entre dos fechas inclusive — para solicitudes de vacaciones. */
export function diasHabiles(inicio: string, fin: string): number {
  let n = 0
  const [y, m, d] = inicio.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const limite = Date.UTC(+fin.slice(0, 4), +fin.slice(5, 7) - 1, +fin.slice(8, 10))
  while (dt.getTime() <= limite) {
    const dow = dt.getUTCDay()
    if (dow !== 0 && dow !== 6) n++
    dt.setUTCDate(dt.getUTCDate() + 1)
  }
  return n
}

/* ══════════════════ Facturación / detracción (§5) ══════════════════ */

export const IGV_PCT = 18
export const DETRACCION_PCT_DEFAULT = 12   // servicios empresariales / publicidad

export interface TotalesFactura {
  subtotal: number
  igv: number
  total: number
  detraccion_monto: number
  neto_a_pagar: number
}

/**
 * Calcula los totales de una factura a partir de sus ítems.
 * `items[]` = { descripcion, cantidad, valor_unitario }  (valor SIN IGV)
 */
export function calcularTotales(
  items: Array<{ cantidad?: number; valor_unitario?: number }>,
  opts: { conDetraccion?: boolean; detraccionPct?: number; igvPct?: number } = {}
): TotalesFactura {
  const igvPct = opts.igvPct ?? IGV_PCT
  const r2 = (n: number) => Math.round(n * 100) / 100

  const subtotal = r2((items || []).reduce(
    (s, it) => s + Number(it.cantidad || 0) * Number(it.valor_unitario || 0), 0))
  const igv = r2(subtotal * igvPct / 100)
  const total = r2(subtotal + igv)

  const pct = opts.conDetraccion === false ? 0 : (opts.detraccionPct ?? DETRACCION_PCT_DEFAULT)
  const detraccion = r2(total * pct / 100)

  return {
    subtotal, igv, total,
    detraccion_monto: detraccion,
    neto_a_pagar: r2(total - detraccion),
  }
}

/* ══════════════════ Comisiones (§4) ══════════════════ */

/**
 * Comisión = base_produccion × pct.
 *
 * Es deliberadamente simple y PARAMETRIZABLE: Piola aún no entregó la fórmula
 * exacta del acuerdo con Héctor (§12, pendiente bloqueante). El `pct` se
 * configura por colaborador (piola_colaboradores.comision_pct) y, cuando llegue
 * la fórmula, el único cambio será esta función.
 */
export function calcularComision(baseProduccion: number, pct: number): number {
  return Math.round(Number(baseProduccion || 0) * Number(pct || 0) / 100 * 100) / 100
}

/* ══════════════════ Notificaciones ══════════════════ */

/**
 * Envía un mensaje al webhook n8n de Piola (canal WhatsApp — §4, §9).
 * Nunca lanza: una alerta que falla no debe tumbar el proceso que la disparó.
 */
export async function enviarWhatsappPiola(payload: any): Promise<{ ok: boolean; status?: number; respuesta?: any; error?: string }> {
  const url = process.env.N8N_WEBHOOK_PIOLA_ALERTAS
  if (!url) return { ok: false, error: 'N8N_WEBHOOK_PIOLA_ALERTAS no configurado' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    let respuesta: any = null
    try { respuesta = await res.json() } catch { respuesta = await res.text().catch(() => null) }
    return { ok: res.ok, status: res.status, respuesta }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'error de red' }
  }
}

/** Envío de correo vía Resend (boletas, facturas y reportes — §5, §7.5, §9). */
export async function enviarCorreoPiola(opts: {
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: string }>
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY no configurada' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_PIOLA || 'Piola <no-reply@alef.company>',
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments,
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json?.message || `HTTP ${res.status}` }
    return { ok: true, id: json?.id }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'error de red' }
  }
}
