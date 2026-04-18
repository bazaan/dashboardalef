/**
 * GET /api/healup/gcal-auth
 *
 * Setup OAuth2 (una sola vez): genera la URL de Google para autorizar
 * acceso al calendario de healupaestheticlab@gmail.com.
 *
 * Después de autorizar, Google redirige a /api/healup/gcal-callback
 * con el refresh_token que se copia al .env.
 */

import { getGoogleAuthUrl } from '~/server/utils/google-auth'

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/healup/gcal-callback'

export default defineEventHandler(() => {
  const authUrl = getGoogleAuthUrl(REDIRECT_URI)

  return {
    message: 'Abre esta URL en el navegador para autorizar Google Calendar',
    url: authUrl,
    redirect_uri: REDIRECT_URI,
    nota: 'Después de autorizar, copia el refresh_token al .env como GOOGLE_REFRESH_TOKEN'
  }
})
