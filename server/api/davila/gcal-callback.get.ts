/**
 * GET /api/davila/gcal-callback?code=...
 *
 * Callback OAuth2 de Google para DAVILA. Recibe el authorization code,
 * lo intercambia por tokens y guarda el refresh_token en Supabase bajo
 * `google_refresh_token_davila` (separado de Healup). Luego redirige al
 * dashboard de Miguel Davila.
 */

import { exchangeCodeForTokens, saveRefreshTokenToDB } from '~/server/utils/google-auth'

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI_DAVILA
    || `${protocol}://${host}/api/davila/gcal-callback`

  const { code, error } = getQuery(event) as { code?: string; error?: string }

  if (error) {
    return sendRedirect(event, '/pruebas/MiguelDavila?gcal_error=' + encodeURIComponent(error))
  }
  if (!code) {
    return sendRedirect(event, '/pruebas/MiguelDavila?gcal_error=no_code')
  }

  try {
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI)
    if (tokens.refresh_token) {
      const saved = await saveRefreshTokenToDB(tokens.refresh_token, 'davila')
      console.log('[GCal Callback Davila] Refresh token guardado:', saved)
    } else {
      // Google no devolvió refresh_token (suele pasar si ya estaba autorizado
      // sin prompt=consent). Nuestro getGoogleAuthUrl ya fuerza prompt=consent,
      // así que esto no debería ocurrir.
      return sendRedirect(event, '/pruebas/MiguelDavila?gcal_error=' + encodeURIComponent('no_refresh_token'))
    }
    return sendRedirect(event, '/pruebas/MiguelDavila?gcal_success=1')
  } catch (err: any) {
    console.error('[GCal Callback Davila] Error:', err.message)
    return sendRedirect(event, '/pruebas/MiguelDavila?gcal_error=' + encodeURIComponent(err.message))
  }
})
