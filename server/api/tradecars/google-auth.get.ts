/**
 * GET /api/tradecars/google-auth
 *
 * Inicia el login de Google para conectar la cuenta que tiene acceso a las hojas de formularios
 * (IG, FB y TikTok) de Trade Cars. La persona que lo hace tiene que entrar con la cuenta de Google
 * que ve esas hojas (aipartnerstudio@gmail.com).
 *
 * 28/09/2026: Trade Cars tiene su PROPIO proyecto de Google Cloud y su propio OAuth client
 * (`TRADECARS_GOOGLE_CLIENT_ID`/`_SECRET`) — independiente del que comparten Healup y Davila — así
 * que usa su propio callback dedicado (`/api/tradecars/gcal-callback`), no el compartido.
 *
 * Solo un Administrador de Trade Cars puede iniciarlo: quien conecta decide de qué cuenta de Google
 * salen los leads. (El callback lo vuelve a exigir.)
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { getGoogleAuthUrl } from '../../utils/google-auth'
import { credencialesGoogleTradeCars } from '../../utils/tradecars-formularios'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirAdminTradeCars(perfil, 'la conexión con Google')

  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocolo = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.TRADECARS_GOOGLE_REDIRECT_URI || `${protocolo}://${host}/api/tradecars/gcal-callback`

  return sendRedirect(event, getGoogleAuthUrl(REDIRECT_URI, undefined, credencialesGoogleTradeCars()))
})
