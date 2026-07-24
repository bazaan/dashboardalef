/**
 * SGS × Alef — Lógica de negocio compartida (port 1:1 del backend_demo Python)
 * ----------------------------------------------------------------------------
 * Portado de: motor_tat.py · semaforo.py · escalamiento_tat.py ·
 * agente_supervisor.py (modo determinista) · push_excel.py (validaciones).
 *
 * Reglas de oro §7.1: TODO determinista, 0 tokens. El LLM no participa aquí.
 */
import { getCookie, createError, type H3Event } from 'h3'

/* ══════════════════ Validación de llave (§4.1) ══════════════════ */

export const RE_ORDEN = /^OL\d{6}-\d{2}$/

export function validarLlave(nOrden: any): { ok: boolean; orden: string; motivo?: string } {
  const orden = String(nOrden ?? '').trim().toUpperCase()
  if (!RE_ORDEN.test(orden)) {
    return { ok: false, orden, motivo: `N° de orden inválido o ausente: '${nOrden}' (debe ser OLxxxxxx-xx)` }
  }
  return { ok: true, orden }
}

/* ══════════════════ Motor TAT (motor_tat.py) ══════════════════ */

/** Acepta 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD/MM/YY', 'DD-MM-YYYY', 'DD-MM-YY'. */
export function parseFecha(f: any): Date | null {
  if (f instanceof Date && !isNaN(f.getTime())) return f
  if (!f) return null
  const s = String(f).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    return new Date(Date.UTC(y, +m[2] - 1, +m[1]))
  }
  return null
}

export function isoDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface TatInfo {
  estado: 'en_plazo' | 'por_vencer' | 'vencido' | 'sin_fecha'
  alerta: boolean
  fecha_ingreso?: string
  fecha_vencimiento?: string
  tat_dias?: number
  dias_transcurridos?: number
  dias_restantes?: number
  dias_vencido?: number
  error?: string
}

/** Días CALENDARIO desde el ingreso a análisis; alerta 1 día antes (§1.D). */
export function calcularTat(fechaIngreso: any, tatDias = 4, hoy?: any): TatInfo {
  const h = parseFecha(hoy) || new Date()
  const hoyUtc = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate()))
  const ini = parseFecha(fechaIngreso)
  if (!ini) return { estado: 'sin_fecha', alerta: false, error: 'fecha de ingreso a análisis inválida o vacía' }

  const MS = 86400000
  const venc = new Date(ini.getTime() + tatDias * MS)
  const diasTranscurridos = Math.round((hoyUtc.getTime() - ini.getTime()) / MS)
  const diasRestantes = Math.round((venc.getTime() - hoyUtc.getTime()) / MS)

  let estado: TatInfo['estado']
  if (diasRestantes < 0) estado = 'vencido'
  else if (diasRestantes <= 1) estado = 'por_vencer'
  else estado = 'en_plazo'

  return {
    estado,
    alerta: estado === 'por_vencer' || estado === 'vencido',
    fecha_ingreso: isoDia(ini),
    fecha_vencimiento: isoDia(venc),
    tat_dias: tatDias,
    dias_transcurridos: diasTranscurridos,
    dias_restantes: diasRestantes,
    dias_vencido: Math.max(0, -diasRestantes),
  }
}

/* ══════════════════ Escalamiento TAT (escalamiento_tat.py) ══════════════════ */

export const CADENA = [
  { nivel: 1, nombre: 'William Ochoa',   rol: 'Coordinación / recepción' },
  { nivel: 2, nombre: 'Jahaira Sánchez', rol: 'Analista' },
  { nivel: 3, nombre: 'José Ramos',      rol: 'Jefe de laboratorio' },
] as const

export function destinatario(tat: TatInfo) {
  if (tat.estado === 'por_vencer') return CADENA[0]
  if (tat.estado === 'vencido') return (tat.dias_vencido ?? 0) >= 2 ? CADENA[2] : CADENA[1]
  return null
}

export function armarAviso(reg: Record<string, any>, tat: TatInfo) {
  const dest = destinatario(tat)
  if (!dest) return null
  const orden = reg.n_orden ?? '—'
  const calidad = reg.calidad_material ?? '—'
  const cliente = reg.cliente ?? '—'
  const venc = tat.fecha_vencimiento ?? '—'

  let urg: string, asunto: string
  if (tat.estado === 'por_vencer') {
    urg = `VENCE MAÑANA (${venc})`
    asunto = `[TAT] Aviso preventivo — orden ${orden} vence ${venc}`
  } else {
    const dv = tat.dias_vencido ?? 0
    urg = `VENCIDO hace ${dv} día(s) (venció ${venc})`
    asunto = `[TAT] ESCALAMIENTO N${dest.nivel} — orden ${orden} vencido`
  }

  const cuerpo =
    `Para: ${dest.nombre} (${dest.rol})\n` +
    `Canal: correo institucional\n\n` +
    `El análisis de la orden ${orden} (${cliente} · calidad ${calidad}) está ${urg}.\n` +
    `Ingreso a análisis: ${tat.fecha_ingreso} · TAT ${tat.tat_dias} días calendario.\n` +
    `Días restantes: ${tat.dias_restantes}.\n` +
    `Acción: priorizar la emisión del resultado para cumplir el TAT.`

  return {
    destinatario: dest.nombre, rol: dest.rol, nivel: dest.nivel,
    canal: 'correo institucional', asunto, cuerpo,
  }
}

/* ══════════════════ Agente Supervisor determinista (agente_supervisor.py) ══════════════════ */

function num(x: any): number | null {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(String(x).replace(/,/g, '').replace(/kg/i, '').trim())
  return Number.isFinite(n) ? n : null
}

export interface Veredicto {
  veredicto: 'ok' | 'revisar'
  severidad: 'baja' | 'media' | 'alta'
  observaciones: string[]
  _motor: string
}

/** Pasada de calidad sobre el registro catalogado (§7c). 0 tokens. */
export function supervisar(reg: Record<string, any>, flags?: string[]): Veredicto {
  const INFO = ['normalizada', 'limpiado', 'corregid', 'reconstru']
  const obs = (flags || []).filter(f => !INFO.some(w => f.toLowerCase().includes(w)))
  let sev: Veredicto['severidad'] | null = obs.length ? 'baja' : null

  const b = num(reg.peso_bruto), t = num(reg.tara), n = num(reg.peso_neto)
  if (n !== null && n <= 0) { obs.push('peso neto <= 0'); sev = 'alta' }
  if (b !== null && n !== null && n > b) { obs.push('peso neto mayor que bruto'); sev = 'alta' }
  if (b !== null && t !== null && n !== null) {
    const esperado = b - t
    if (Math.abs(esperado - n) > Math.max(50, esperado * 0.02)) {
      obs.push(`peso neto (${n}) no coincide con bruto − tara (${esperado})`); sev = sev === 'alta' ? sev : 'media'
    }
  }
  if (b !== null && (b < 5000 || b > 120000)) {
    obs.push(`peso bruto fuera de rango esperado: ${b}`); sev = sev || 'media'
  }
  if (!reg.calidad_material) { obs.push('material/calidad vacío'); sev = sev || 'media' }
  if (reg.placa && !/^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}$/i.test(String(reg.placa).trim())) {
    obs.push(`formato de placa inusual: ${reg.placa}`); sev = sev || 'baja'
  }

  return {
    veredicto: sev ? 'revisar' : 'ok',
    severidad: sev || 'baja',
    observaciones: obs,
    _motor: 'determinista',
  }
}

/* ══════════════════ Autenticación de los endpoints SGS ══════════════════ */

/**
 * El servidor NUNCA confía en la cookie: re-verifica el perfil real contra
 * dashboardlogin (patrón del proyecto). Acceso: superadmin, o company_id
 * que contenga 'sgs' o 'alef'.
 */
export async function verificarSesionSGS(event: H3Event, supabase: any): Promise<{ email: string }> {
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

  const rol = String(perfil.role ?? '').toLowerCase()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')
  if (rol !== 'superadmin' && !cid.includes('sgs') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para SGS' })
  }
  return { email: perfil.email }
}
