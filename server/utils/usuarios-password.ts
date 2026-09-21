/**
 * Quién puede cambiarle la contraseña a otro usuario del sistema.
 * ---------------------------------------------------------------
 * Reunión de Piola del 14/09/2026: hasta ahora la contraseña solo se ponía al CREAR el usuario y
 * después no había cómo cambiarla (Roberto la tenía desactivada "por cuestiones de seguridad").
 * Piola tiene ~15 usuarios, gente que entra y sale, y varios comparten contraseña por grupo
 * (administradores por un lado, Sebastián por otro, el equipo operativo por otro): necesitan que
 * Raysa y Edson puedan cambiarlas sin pasar por Alef cada vez.
 *
 * Regla, deliberadamente estrecha (no basta con ser "admin"):
 *   - superadmin de Alef: siempre.
 *   - admin de Piola: SOLO si su correo está en `piola_modulo_acceso` con grupo = 'contrasenas'
 *     (Raysa y Edson). Héctor también es administrador, pero no cambia contraseñas: se acordó así.
 *   - cualquier otro: no.
 * La lista vive en la base (editable sin redeploy) y `grupo = 'contrasenas'` NO está en
 * GRUPOS_ACCESO_RECONOCIDOS de server/utils/piola.ts, así que no restringe ningún módulo.
 */
import type { H3Event } from 'h3'
import bcrypt from 'bcryptjs'

const normalizarEmpresa = (v: any) => String(v ?? '').toLowerCase().replace(/\s+/g, '')

export interface SolicitantePassword {
  id: any
  email: string
  role: string
  company_id: string
  esSuperadmin: boolean
}

/** Sesión del que hace la petición: cookie del dashboard, y el rol REAL se relee de `dashboardlogin`. */
export async function resolverSolicitante(event: H3Event, client: any): Promise<SolicitantePassword> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await client
    .from('dashboardlogin').select('id, email, role, company_id').eq('email', email).maybeSingle()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const role = String(perfil.role ?? '').toLowerCase()
  return {
    id: perfil.id, email: String(perfil.email), role,
    company_id: String(perfil.company_id ?? ''), esSuperadmin: role === 'superadmin',
  }
}

/** ¿Este solicitante puede cambiar contraseñas de otros? */
export async function puedeCambiarContrasenas(client: any, s: SolicitantePassword): Promise<boolean> {
  if (s.esSuperadmin) return true
  if (s.role !== 'admin') return false
  if (!normalizarEmpresa(s.company_id).includes('piola')) return false

  const { data, error } = await client
    .from('piola_modulo_acceso').select('emails').eq('grupo', 'contrasenas').eq('activo', true)
  // Sin la fila (o sin la tabla) nadie más que Alef: fallar CERRADO, es una credencial.
  if (error || !Array.isArray(data)) return false
  const correo = s.email.toLowerCase()
  return data.some((f: any) => (f.emails || []).some((e: any) => String(e).toLowerCase() === correo))
}

/**
 * Confirma que quien pide el cambio conoce SU PROPIA contraseña.
 *
 * Es necesario porque la cookie `dashboard_session` es un JSON sin firmar que solo lleva el correo:
 * quien conozca el correo de un administrador podría fabricarla y hacerse pasar por él. Para leer
 * datos eso ya era un límite conocido; para CAMBIAR la contraseña de otra persona no puede bastar
 * (sería tomar su cuenta). Pedir la contraseña actual en el momento cierra ese hueco y también
 * cubre una sesión que alguien dejó abierta.
 *
 * Se prueba primero contra el hash de `dashboardlogin` y, si no coincide, contra Supabase Auth: un
 * usuario que cambió su contraseña por "olvidé mi contraseña" solo la tiene actualizada en Auth.
 */
export async function verificarPasswordActual(client: any, s: SolicitantePassword, password: string): Promise<boolean> {
  if (!password) return false
  try {
    const { data } = await client.from('dashboardlogin').select('password').eq('id', s.id).maybeSingle()
    if (data?.password && (await bcrypt.compare(password, data.password))) return true
  } catch { /* hash ilegible: se prueba Auth */ }

  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_KEY
    if (!url || !key) return false
    // Llamada directa al endpoint de Auth: no crea sesión ni depende de un cliente de supabase-js
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: s.email, password }),
      signal: AbortSignal.timeout(8000),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Freno a los intentos fallidos de confirmar la contraseña (por correo, en memoria: es un freno, no una garantía). */
const FALLOS = new Map<string, number[]>()
const MAX_FALLOS = 5
const VENTANA_MS = 10 * 60 * 1000

export function demasiadosIntentos(email: string): boolean {
  const ahora = Date.now()
  const recientes = (FALLOS.get(email.toLowerCase()) || []).filter(t => ahora - t < VENTANA_MS)
  FALLOS.set(email.toLowerCase(), recientes)
  return recientes.length >= MAX_FALLOS
}
export function registrarFallo(email: string): void {
  const k = email.toLowerCase()
  FALLOS.set(k, [...(FALLOS.get(k) || []), Date.now()])
}

/**
 * Cambia la contraseña también en Supabase Auth, si ese usuario ya está migrado.
 *
 * El login prueba primero Supabase Auth y solo después `dashboardlogin` (bcrypt). Un usuario que ya
 * entró alguna vez fue migrado a Auth con la contraseña de ese momento: si solo se cambiara el hash
 * de `dashboardlogin`, la contraseña VIEJA seguiría funcionando por la primera capa. Por eso se
 * actualizan las dos. Devuelve true si se encontró y actualizó el usuario en Auth; false si todavía
 * no existe ahí (en ese caso la próxima entrada lo migrará ya con la contraseña nueva).
 */
export async function sincronizarPasswordAuth(client: any, targetId: any, targetEmail: string, password: string): Promise<boolean> {
  try {
    // En los usuarios migrados el id de Auth suele coincidir con el de dashboardlogin
    const directo = await client.auth.admin.updateUserById(String(targetId), { password })
    if (!directo.error) return true
  } catch { /* se busca por correo */ }

  try {
    const correo = targetEmail.toLowerCase()
    for (let pagina = 1; pagina <= 10; pagina++) {
      const { data, error } = await client.auth.admin.listUsers({ page: pagina, perPage: 200 })
      if (error) return false
      const usuarios = data?.users || []
      const u = usuarios.find((x: any) => String(x.email || '').toLowerCase() === correo)
      if (u) {
        const r = await client.auth.admin.updateUserById(u.id, { password })
        return !r.error
      }
      if (usuarios.length < 200) return false
    }
  } catch { /* sin Auth: no es un error */ }
  return false
}
