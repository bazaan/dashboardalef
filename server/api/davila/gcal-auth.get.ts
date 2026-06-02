/**
 * GET /api/davila/gcal-auth
 *
 * Redirige directo a Google para autorizar acceso al calendario de DAVILA.
 * Después de autorizar, Google redirige a /api/davila/gcal-callback que guarda
 * el refresh_token bajo `google_refresh_token_davila` (independiente de Healup).
 *
 * IMPORTANTE: el usuario debe loguearse con la cuenta de Google de Davila
 * (la que tiene el calendario de citas). Se usa el calendario "primary" de
 * esa cuenta.
 */

import { getGoogleAuthUrl } from '~/server/utils/google-auth'

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI_DAVILA
    || `${protocol}://${host}/api/davila/gcal-callback`

  // state='davila' para identificar la empresa en el callback
  const authUrl = getGoogleAuthUrl(REDIRECT_URI, 'davila')
  return sendRedirect(event, authUrl)
})
