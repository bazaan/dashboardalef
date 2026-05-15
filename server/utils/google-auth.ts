/**
 * Google OAuth2 auth para Google Calendar API.
 *
 * Refresh token se guarda en Supabase (tabla `app_settings`) para
 * que se pueda renovar desde el dashboard sin tocar env vars.
 *
 * Prioridad del refresh token:
 *   1. Supabase (app_settings key = 'google_refresh_token_healup')
 *   2. Env var GOOGLE_REFRESH_TOKEN
 *
 * Client ID y Client Secret: env vars o runtimeConfig de nuxt.config.ts
 */

import { createClient } from '@supabase/supabase-js'

let cachedToken: { token: string; expires: number } | null = null
let cachedRefreshToken: string | null = null

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Asegura que la tabla app_settings exista.
 */
let tableChecked = false
async function ensureTable(sb: any): Promise<void> {
  if (tableChecked) return
  try {
    await sb.from('app_settings').select('key').limit(1)
    tableChecked = true
  } catch {
    // Tabla no existe — crearla via raw SQL (requiere service_role)
    try {
      await sb.rpc('exec_sql_raw', {
        sql: `CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT now()
        )`
      })
      tableChecked = true
    } catch {
      // Si no podemos crearla, seguimos sin DB
      console.warn('[GoogleAuth] No se pudo crear app_settings, usando solo env vars')
    }
  }
}

/**
 * Lee el refresh token guardado en Supabase (app_settings).
 */
async function getRefreshTokenFromDB(): Promise<string | null> {
  if (cachedRefreshToken) return cachedRefreshToken
  try {
    const sb = getSupabaseAdmin()
    if (!sb) return null
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'google_refresh_token_healup')
      .maybeSingle()
    if (error) return null // Tabla puede no existir aún
    if (data?.value && data.value !== 'pending') {
      cachedRefreshToken = data.value
      return data.value
    }
  } catch (e) {
    // Silenciar — tabla puede no existir
  }
  return null
}

/**
 * Guarda el refresh token en Supabase (app_settings).
 */
export async function saveRefreshTokenToDB(token: string): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin()
    if (!sb) return false
    const { error } = await sb
      .from('app_settings')
      .upsert(
        { key: 'google_refresh_token_healup', value: token, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    if (error) {
      console.error('[GoogleAuth] Error guardando refresh token:', error.message)
      return false
    }
    cachedRefreshToken = token
    cachedToken = null // Forzar re-auth con el nuevo token
    console.log('[GoogleAuth] Refresh token guardado en DB')
    return true
  } catch (e: any) {
    console.error('[GoogleAuth] Excepción guardando refresh token:', e?.message)
    return false
  }
}

/**
 * Obtiene un access token de Google usando el refresh token.
 * Cachea el token hasta que expire (~1 hora).
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires - 60_000) {
    return cachedToken.token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos en env vars')
  }

  // Prioridad: DB > env var
  const refreshToken = await getRefreshTokenFromDB() || process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error(
      'Refresh token no encontrado. Renovar desde el dashboard: GCal Sync → "Renovar acceso Google"'
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
    // Si el token expiró, limpiar el cache para forzar re-lectura
    if (errBody.includes('invalid_grant')) {
      cachedRefreshToken = null
      cachedToken = null
      throw new Error(
        'Refresh token expirado. Renovar desde el dashboard: GCal Sync → "Renovar acceso Google"'
      )
    }
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

  // calendar.events permite leer Y crear/editar eventos (necesario para agendar citas)
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events')
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
