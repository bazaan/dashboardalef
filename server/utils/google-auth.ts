/**
 * Google OAuth2 auth para Google Calendar API.
 * Usa Client ID + Client Secret + Refresh Token (OAuth2 web flow).
 *
 * Env vars requeridas:
 *   GOOGLE_CLIENT_ID      — OAuth2 Client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth2 Client Secret
 *   GOOGLE_REFRESH_TOKEN  — Refresh token (obtenido una vez via /api/healup/gcal-auth)
 *
 * Setup una sola vez:
 *   1. Visitar /api/healup/gcal-auth → te da URL de Google
 *   2. Autorizar en Google → redirige a /api/healup/gcal-callback
 *   3. Copiar el refresh_token al .env
 */

let cachedToken: { token: string; expires: number } | null = null

/**
 * Obtiene un access token de Google usando el refresh token.
 * Cachea el token hasta que expire (~1 hora).
 */
export async function getGoogleAccessToken(): Promise<string> {
  // Retornar token cacheado si aún es válido (con 60s de margen)
  if (cachedToken && Date.now() < cachedToken.expires - 60_000) {
    return cachedToken.token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos en .env')
  }
  if (!refreshToken) {
    throw new Error(
      'GOOGLE_REFRESH_TOKEN no configurado. ' +
      'Visita /api/healup/gcal-auth para obtenerlo (setup una sola vez).'
    )
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    throw new Error(`Google OAuth2 token error (${tokenRes.status}): ${errBody}`)
  }

  const data = await tokenRes.json() as { access_token: string; expires_in: number }

  cachedToken = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000
  }

  return cachedToken.token
}

/**
 * Genera la URL de autorización de Google OAuth2.
 */
export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID no configurado')

  // Construir URL manualmente para evitar problemas de encoding
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly')
  const redirect = encodeURIComponent(redirectUri)
  const cid = encodeURIComponent(clientId)

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
}

/**
 * Intercambia un authorization code por tokens (access + refresh).
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET requeridos')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Google OAuth2 exchange error (${res.status}): ${errBody}`)
  }

  return await res.json() as any
}
