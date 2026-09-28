/**
 * GET /api/tradecars/google-status
 *
 * ¿Trade Cars ya tiene acceso a Google para leer sus hojas? Si sí, con qué cuenta.
 * Lo usa la ventana "Conectar hoja" para mostrar "Conectado como …" o el botón de conectar.
 *
 * Desde el 29/09/2026 hay DOS métodos posibles, y este endpoint reporta el que esté activo:
 *   1. Cuenta de servicio (TRADECARS_GOOGLE_SERVICE_ACCOUNT_JSON) — el preferido: sin login,
 *      no expira a los 7 días. Si está configurada, se reporta conectada con ese email y ni
 *      siquiera se revisa el OAuth de usuario.
 *   2. OAuth de usuario (el botón "Conectar con Google" / "Cambiar cuenta") — solo se revisa
 *      si NO hay cuenta de servicio configurada.
 *
 * Response: { connected: boolean, email?: string, metodo?: 'service_account' | 'oauth', vencido?: boolean }
 * Solo Administrador: el correo de la cuenta conectada no es para todo el equipo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { getGoogleAccessToken, hasRefreshToken } from '../../utils/google-auth'
import {
  EMPRESA_GOOGLE, credencialesGoogleTradeCars, tieneServiceAccountGoogle, emailServiceAccountGoogle,
} from '../../utils/tradecars-formularios'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirAdminTradeCars(perfil, 'la conexión con Google')

  setHeader(event, 'Cache-Control', 'no-store')

  if (tieneServiceAccountGoogle()) {
    return { connected: true, email: emailServiceAccountGoogle() ?? undefined, metodo: 'service_account' as const }
  }

  if (!(await hasRefreshToken(EMPRESA_GOOGLE))) return { connected: false }

  // El correo es informativo: si el token venció igual se reporta como conectado, y la lectura
  // de la hoja dirá "la conexión venció" con el paso exacto para repararlo.
  let email: string | undefined
  let vencido = false
  try {
    const token = await getGoogleAccessToken(EMPRESA_GOOGLE, credencialesGoogleTradeCars())
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) email = (await r.json() as any)?.email
  } catch (e: any) {
    vencido = /expirado|invalid_grant/i.test(String(e?.message || ''))
  }
  return { connected: true, email, vencido, metodo: 'oauth' as const }
})
