/**
 * Google OAuth2 auth para Google Calendar API — MULTI-EMPRESA.
 *
 * Cada empresa tiene su PROPIO refresh token, guardado en Supabase
 * (tabla `app_settings`) bajo la clave `google_refresh_token_<empresa>`.
 * Esto permite que Healup y Davila (y futuras empresas) se conecten a
 * calendarios de cuentas de Google DISTINTAS, sin mezclarse.
 *
 *   Healup → google_refresh_token_healup
 *   Davila → google_refresh_token_davila
 *
 * Compatibilidad: todas las funciones tienen `companyKey` con default
 * 'healup', así el código existente de Healup sigue funcionando sin cambios.
 *
 * Client ID / Client Secret son compartidos (un solo OAuth client de Google
 * Cloud). Cada empresa solo necesita su propia URI de callback registrada
 * en las "Authorized redirect URIs" del OAuth client.
 */

import { createClient } from '@supabase/supabase-js'

// Caches por empresa
const tokenCache = new Map<string, { token: string; expires: number }>()
const refreshTokenCache = new Map<string, string>()

function settingsKey(companyKey: string): string {
  return `google_refresh_token_${companyKey}`
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Lee el refresh token guardado en Supabase (app_settings) para la empresa.
 */
async function getRefreshTokenFromDB(companyKey: string): Promise<string | null> {
  const cached = refreshTokenCache.get(companyKey)
  if (cached) return cached
  try {
    const sb = getSupabaseAdmin()
    if (!sb) return null
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', settingsKey(companyKey))
      .maybeSingle()
    if (error) return null
    if (data?.value && data.value !== 'pending') {
      refreshTokenCache.set(companyKey, data.value)
      return data.value
    }
  } catch {
    // tabla puede no existir aún
  }
  return null
}

/**
 * Guarda el refresh token en Supabase (app_settings) para la empresa.
 */
export async function saveRefreshTokenToDB(token: string, companyKey = 'healup'): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin()
    if (!sb) return false
    const { error } = await sb
      .from('app_settings')
      .upsert(
        { key: settingsKey(companyKey), value: token, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    if (error) {
      console.error(`[GoogleAuth:${companyKey}] Error guardando refresh token:`, error.message)
      return false
    }
    refreshTokenCache.set(companyKey, token)
    tokenCache.delete(companyKey) // Forzar re-auth con el nuevo token
    console.log(`[GoogleAuth:${companyKey}] Refresh token guardado en DB`)
    return true
  } catch (e: any) {
    console.error(`[GoogleAuth:${companyKey}] Excepción guardando refresh token:`, e?.message)
    return false
  }
}

/**
 * ¿La empresa tiene un refresh token configurado? (para mostrar estado en UI)
 */
export async function hasRefreshToken(companyKey = 'healup'): Promise<boolean> {
  const t = await getRefreshTokenFromDB(companyKey)
  return !!t
}

/**
 * Obtiene un access token de Google usando el refresh token de la empresa.
 * Cachea el token (por empresa) hasta que expire (~1 hora).
 */
export async function getGoogleAccessToken(companyKey = 'healup'): Promise<string> {
  const cached = tokenCache.get(companyKey)
  if (cached && Date.now() < cached.expires - 60_000) {
    return cached.token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos en env vars')
  }

  // Prioridad: DB (por empresa) > env var legacy (solo healup)
  const refreshToken = await getRefreshTokenFromDB(companyKey)
    || (companyKey === 'healup' ? process.env.GOOGLE_REFRESH_TOKEN : undefined)

  if (!refreshToken) {
    throw new Error(
      `Refresh token no encontrado para "${companyKey}". Conectar desde el dashboard: Soporte → "Conexión a Google Calendar"`
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
    if (errBody.includes('invalid_grant')) {
      refreshTokenCache.delete(companyKey)
      tokenCache.delete(companyKey)
      throw new Error(
        `Refresh token expirado para "${companyKey}". Reconectar desde el dashboard: Soporte → "Conexión a Google Calendar"`
      )
    }
    throw new Error(`Google OAuth2 token error (${tokenRes.status}): ${errBody}`)
  }

  const data = await tokenRes.json() as { access_token: string; expires_in: number }
  tokenCache.set(companyKey, {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000
  })
  return data.access_token
}

/**
 * Genera la URL de autorización de Google OAuth2.
 * `state` permite saber qué empresa inició el flujo en el callback.
 */
export function getGoogleAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID no configurado')

  // calendar.events: leer/crear/editar eventos (agendar citas)
  // spreadsheets: append a hojas (tool "Calendario FB/IG" de Healup)
  // userinfo.email: saber con qué cuenta se conectó (para mostrar en el dashboard)
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email')
  const redirect = encodeURIComponent(redirectUri)
  const cid = encodeURIComponent(clientId)
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : ''

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent${stateParam}`
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
