/**
 * Google Service Account — JWT Bearer flow (crypto nativo, 0 dependencias).
 *
 * Para automatizaciones servidor-a-servidor que no necesitan actuar "como" un usuario real
 * (por ejemplo, leer una hoja de Google Sheets compartida con la cuenta de servicio) — a
 * diferencia del flujo OAuth2 de usuario (`server/utils/google-auth.ts`), acá NO hace falta
 * que nadie inicie sesión, no expira a los 7 días por estar el proyecto en modo "Testing" en
 * Google Cloud, y no hay pantalla de "esta app no está verificada".
 *
 * Cómo se configura (una sola vez, en Google Cloud Console):
 *   1. IAM & Admin → Service Accounts → Create Service Account (no hace falta darle ningún
 *      rol de proyecto — el acceso real lo da compartir el recurso, ver paso 3).
 *   2. Esa cuenta → pestaña Keys → Add Key → Create new key → JSON. Descarga el archivo:
 *      TODO su contenido va en la env var correspondiente (ej. TRADECARS_GOOGLE_SERVICE_ACCOUNT_JSON).
 *   3. Comparte el recurso (la hoja de Sheets, el calendario, etc.) con el EMAIL de la cuenta
 *      de servicio (el `client_email` que trae ese JSON) — como se compartiría con una persona.
 *
 * Mismo enfoque que `server/utils/vonage-auth.ts`: firmamos el JWT a mano con el módulo
 * `crypto` de Node (RS256), sin instalar la librería `googleapis`.
 */

import { createSign } from 'node:crypto'

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

const cache = new Map<string, { token: string; expires: number }>()

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function parseServiceAccountJson(raw: string): ServiceAccountKey {
  let json: any
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('El JSON de la cuenta de servicio no es válido (¿se pegó completo, incluidas las llaves { }?)')
  }
  if (!json.client_email || !json.private_key) {
    throw new Error('El JSON de la cuenta de servicio no tiene client_email o private_key.')
  }
  return json
}

function firmarJwt(cuenta: ServiceAccountKey, scope: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: cuenta.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(cuenta.private_key)
  return `${signingInput}.${base64url(signature)}`
}

/**
 * Devuelve un access token para la cuenta de servicio, cacheado hasta que expire (~1 hora).
 * `serviceAccountJsonRaw` es el contenido COMPLETO del archivo JSON de la cuenta (una env var).
 */
export async function getGoogleServiceAccountToken(serviceAccountJsonRaw: string, scope: string): Promise<string> {
  const cuenta = parseServiceAccountJson(serviceAccountJsonRaw)
  const clave = `${cuenta.client_email}:${scope}`

  const cacheado = cache.get(clave)
  if (cacheado && Date.now() < cacheado.expires - 60_000) return cacheado.token

  const assertion = firmarJwt(cuenta, scope)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Google rechazó el token de la cuenta de servicio (${res.status}): ${errBody}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cache.set(clave, { token: data.access_token, expires: Date.now() + data.expires_in * 1000 })
  return data.access_token
}

/** El email de la cuenta de servicio (para mostrarlo en la UI), sin gastar una llamada a Google. */
export function emailDeServiceAccount(serviceAccountJsonRaw: string): string | null {
  try {
    return parseServiceAccountJson(serviceAccountJsonRaw).client_email
  } catch {
    return null
  }
}
