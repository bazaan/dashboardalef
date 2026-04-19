/**
 * GET /api/healup/gcal-callback?code=...
 *
 * Callback de OAuth2 de Google. Recibe el authorization code,
 * lo intercambia por tokens y guarda el refresh_token en Supabase
 * automáticamente. Luego redirige al dashboard de Healup.
 */

import { exchangeCodeForTokens, saveRefreshTokenToDB } from '~/server/utils/google-auth'

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/healup/gcal-callback`

  const { code, error } = getQuery(event) as { code?: string; error?: string }

  if (error) {
    return sendRedirect(event, '/pruebas/Healup?gcal_error=' + encodeURIComponent(error))
  }

  if (!code) {
    return sendRedirect(event, '/pruebas/Healup?gcal_error=no_code')
  }

  try {
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI)

    // Guardar refresh token en Supabase automáticamente
    if (tokens.refresh_token) {
      const saved = await saveRefreshTokenToDB(tokens.refresh_token)
      console.log('[GCal Callback] Refresh token guardado en DB:', saved)
    }

    // Redirigir al dashboard con mensaje de éxito
    return sendRedirect(event, '/pruebas/Healup?gcal_success=1')
  } catch (err: any) {
    console.error('[GCal Callback] Error:', err.message)
    return sendRedirect(event, '/pruebas/Healup?gcal_error=' + encodeURIComponent(err.message))
  }
})
