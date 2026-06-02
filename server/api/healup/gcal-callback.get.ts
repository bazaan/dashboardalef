/**
 * GET /api/healup/gcal-callback?code=...&state=<empresa>
 *
 * Callback OAuth2 de Google COMPARTIDO por varias empresas. Este es el único
 * redirect_uri registrado en el OAuth client de Google, así que lo reutilizan
 * todas las empresas que conectan su calendario (Healup, Davila, ...).
 *
 * El parámetro `state` indica qué empresa inició el flujo:
 *   - sin state / 'healup' → guarda google_refresh_token_healup, vuelve a Healup
 *   - 'davila'             → guarda google_refresh_token_davila, vuelve a Davila
 *
 * Así NO hace falta registrar una URL distinta por empresa en Google Cloud.
 */

import { exchangeCodeForTokens, saveRefreshTokenToDB } from '~/server/utils/google-auth'

// empresa (state) → ruta del dashboard al que volver
const DASHBOARD_PATH: Record<string, string> = {
  healup: '/pruebas/Healup',
  davila: '/pruebas/MiguelDavila',
}

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  // El redirect_uri debe ser SIEMPRE este mismo path (el registrado en Google).
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/healup/gcal-callback`

  const { code, error, state } = getQuery(event) as { code?: string; error?: string; state?: string }

  // Resolver empresa desde el state (default healup para no romper lo existente)
  const company = (state && DASHBOARD_PATH[state]) ? state : 'healup'
  const returnPath = DASHBOARD_PATH[company]

  if (error) {
    return sendRedirect(event, `${returnPath}?gcal_error=` + encodeURIComponent(error))
  }
  if (!code) {
    return sendRedirect(event, `${returnPath}?gcal_error=no_code`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code, REDIRECT_URI)

    if (tokens.refresh_token) {
      const saved = await saveRefreshTokenToDB(tokens.refresh_token, company)
      console.log(`[GCal Callback:${company}] Refresh token guardado en DB:`, saved)
    } else {
      return sendRedirect(event, `${returnPath}?gcal_error=` + encodeURIComponent('no_refresh_token'))
    }

    return sendRedirect(event, `${returnPath}?gcal_success=1`)
  } catch (err: any) {
    console.error(`[GCal Callback:${company}] Error:`, err.message)
    return sendRedirect(event, `${returnPath}?gcal_error=` + encodeURIComponent(err.message))
  }
})
