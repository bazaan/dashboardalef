/**
 * GET /api/tradecars/google-status
 *
 * ¿Trade Cars ya tiene una cuenta de Google conectada para leer sus hojas? Si sí, con qué correo.
 * Lo usa la ventana "Conectar hoja" para mostrar "Conectado como …" o el botón de conectar.
 *
 * Response: { connected: boolean, email?: string }
 * Solo Administrador: el correo de la cuenta conectada no es para todo el equipo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { getGoogleAccessToken, hasRefreshToken } from '../../utils/google-auth'
import { EMPRESA_GOOGLE } from '../../utils/tradecars-formularios'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirAdminTradeCars(perfil, 'la conexión con Google')

  setHeader(event, 'Cache-Control', 'no-store')
  if (!(await hasRefreshToken(EMPRESA_GOOGLE))) return { connected: false }

  // El correo es informativo: si el token venció igual se reporta como conectado, y la lectura
  // de la hoja dirá "la conexión venció" con el paso exacto para repararlo.
  let email: string | undefined
  let vencido = false
  try {
    const token = await getGoogleAccessToken(EMPRESA_GOOGLE)
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) email = (await r.json() as any)?.email
  } catch (e: any) {
    vencido = /expirado|invalid_grant/i.test(String(e?.message || ''))
  }
  return { connected: true, email, vencido }
})
