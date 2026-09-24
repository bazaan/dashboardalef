/**
 * GET /api/tradecars/google-auth
 *
 * Inicia el login de Google para conectar la cuenta que tiene acceso a las hojas de formularios
 * (IG, FB y TikTok) de Trade Cars. La persona que lo hace tiene que entrar con la cuenta de Google
 * que ve esas tres hojas.
 *
 * Reutiliza el callback YA REGISTRADO en Google Cloud (/api/healup/gcal-callback), igual que Davila:
 * `state=tradecars` hace que el callback guarde el token en `google_refresh_token_tradecars`
 * —independiente del de Healup y Davila— y vuelva al dashboard de Trade Cars. No hay que tocar
 * Google Cloud Console.
 *
 * Solo un Administrador de Trade Cars puede iniciarlo: quien conecta decide de qué cuenta de Google
 * salen los leads. (El callback lo vuelve a exigir.)
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { getGoogleAuthUrl } from '../../utils/google-auth'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirAdminTradeCars(perfil, 'la conexión con Google')

  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocolo = host.includes('localhost') ? 'http' : 'https'
  // MISMO redirect_uri que Healup y Davila (el registrado en Google)
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${protocolo}://${host}/api/healup/gcal-callback`

  return sendRedirect(event, getGoogleAuthUrl(REDIRECT_URI, 'tradecars'))
})
