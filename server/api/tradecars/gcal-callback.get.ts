/**
 * GET /api/tradecars/gcal-callback?code=...
 *
 * Callback OAuth2 de Google DEDICADO a Trade Cars (28/09/2026). A diferencia de Healup y Davila
 * (que comparten `/api/healup/gcal-callback` con un solo OAuth client de Google Cloud), Trade Cars
 * tiene su PROPIO proyecto de Google Cloud y su propio OAuth client (cuenta aipartnerstudio@gmail.com,
 * credenciales `TRADECARS_GOOGLE_CLIENT_ID`/`_SECRET`) — a pedido explícito del cliente, para que la
 * hoja de Zapier de Trade Cars no dependa de la cuenta de Google de Healup.
 *
 * Esta es la URL que hay que registrar como "Authorized redirect URI" en ESE OAuth client.
 *
 * Público (Google no manda sesión): igual que el callback compartido, exige que quien vuelve tenga
 * sesión de Administrador de Trade Cars antes de guardar el token — si no, cualquiera con el
 * `client_id` (que viaja en la URL) podría reemplazar la cuenta de Google conectada.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { exchangeCodeForTokens, saveRefreshTokenToDB } from '~/server/utils/google-auth'
import { resolverPerfilTradeCars } from '~/server/utils/tradecars'
import { EMPRESA_GOOGLE, credencialesGoogleTradeCars } from '~/server/utils/tradecars-formularios'

const RETURN_PATH = '/pruebas/TradeCars'

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.TRADECARS_GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/tradecars/gcal-callback`

  const { code, error } = getQuery(event) as { code?: string; error?: string }

  if (error) {
    return sendRedirect(event, `${RETURN_PATH}?gcal_error=` + encodeURIComponent(error))
  }
  if (!code) {
    return sendRedirect(event, `${RETURN_PATH}?gcal_error=no_code`)
  }

  try {
    const perfil = await resolverPerfilTradeCars(event, serverSupabaseServiceRole(event))
    if (!perfil.esAdmin) return sendRedirect(event, `${RETURN_PATH}?gcal_error=sin_permiso`)
  } catch {
    return sendRedirect(event, `${RETURN_PATH}?gcal_error=sin_permiso`)
  }

  try {
    const credenciales = credencialesGoogleTradeCars()
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI, credenciales)

    if (tokens.refresh_token) {
      const saved = await saveRefreshTokenToDB(tokens.refresh_token, EMPRESA_GOOGLE)
      console.log('[GCal Callback:tradecars] Refresh token guardado en DB:', saved)
    } else {
      return sendRedirect(event, `${RETURN_PATH}?gcal_error=` + encodeURIComponent('no_refresh_token'))
    }

    return sendRedirect(event, `${RETURN_PATH}?gcal_success=1`)
  } catch (err: any) {
    console.error('[GCal Callback:tradecars] Error:', err.message)
    return sendRedirect(event, `${RETURN_PATH}?gcal_error=` + encodeURIComponent(err.message))
  }
})
