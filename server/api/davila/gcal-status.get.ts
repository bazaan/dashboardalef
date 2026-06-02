/**
 * GET /api/davila/gcal-status
 *
 * Devuelve si Davila ya tiene su Google Calendar conectado.
 * Lo usa el botón del dashboard para mostrar "Conectado" / "No conectado".
 *
 * Response: { connected: boolean, email?: string }
 * Si está conectado, intenta traer el email de la cuenta para mostrarlo.
 */

import { hasRefreshToken, getGoogleAccessToken } from '~/server/utils/google-auth'

export default defineEventHandler(async () => {
  const connected = await hasRefreshToken('davila')
  if (!connected) return { connected: false }

  // Intentar obtener el email de la cuenta conectada (informativo)
  let email: string | undefined
  try {
    const token = await getGoogleAccessToken('davila')
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const info = await res.json() as any
      email = info?.email
    }
  } catch {
    // token puede estar expirado; igual reportamos connected=true
  }

  return { connected: true, email }
})
