/**
 * GET /api/davila/gcal-auth
 *
 * Inicia el login de Google para conectar el calendario de DAVILA.
 *
 * Reutiliza el callback YA REGISTRADO en Google (el de Healup:
 * /api/healup/gcal-callback) para NO tener que tocar Google Cloud Console.
 * El parámetro state='davila' hace que el callback guarde el token en
 * google_refresh_token_davila (independiente de Healup) y vuelva al
 * dashboard de Miguel Davila.
 *
 * IMPORTANTE: el usuario debe loguearse con la cuenta de Google de Davila
 * (la que tiene el calendario de citas). Se usa el calendario "primary".
 */

import { getGoogleAuthUrl } from '~/server/utils/google-auth'

export default defineEventHandler((event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  // MISMO redirect_uri que Healup (el registrado en Google). state='davila'
  // enruta el token y la vuelta al dashboard de Davila.
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/healup/gcal-callback`

  const authUrl = getGoogleAuthUrl(REDIRECT_URI, 'davila')
  return sendRedirect(event, authUrl)
})
