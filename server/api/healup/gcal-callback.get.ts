/**
 * GET /api/healup/gcal-callback?code=...
 *
 * Callback de OAuth2 de Google. Recibe el authorization code,
 * lo intercambia por tokens y muestra el refresh_token.
 *
 * El refresh_token debe copiarse al .env como GOOGLE_REFRESH_TOKEN.
 * Este endpoint solo se usa UNA VEZ durante el setup.
 */

import { exchangeCodeForTokens } from '~/server/utils/google-auth'

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/healup/gcal-callback'

export default defineEventHandler(async (event) => {
  const { code, error } = getQuery(event) as { code?: string; error?: string }

  if (error) {
    throw createError({ statusCode: 400, statusMessage: `Google auth error: ${error}` })
  }

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'No se recibió authorization code de Google' })
  }

  try {
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI)

    return {
      success: true,
      message: 'Google Calendar autorizado correctamente',
      instrucciones: 'Copia el refresh_token abajo y agrégalo al .env como GOOGLE_REFRESH_TOKEN, luego reinicia el server.',
      refresh_token: tokens.refresh_token,
      env_line: `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
    }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error al obtener tokens: ${err.message}`
    })
  }
})
