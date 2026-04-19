/**
 * GET /api/healup/gcal-auth
 *
 * Redirige directo a Google para autorizar acceso al calendario.
 * Después de autorizar, Google redirige a /api/healup/gcal-callback
 * que guarda el refresh_token automáticamente en Supabase.
 */

import { getGoogleAuthUrl } from '~/server/utils/google-auth'

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/healup/gcal-callback`

  const authUrl = getGoogleAuthUrl(REDIRECT_URI)
  return sendRedirect(event, authUrl)
})
