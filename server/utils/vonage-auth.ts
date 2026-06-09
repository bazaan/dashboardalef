/**
 * Vonage Voice API — generación de JWT (crypto nativo, 0 dependencias).
 *
 * La Voice API de Vonage (POST https://api.nexmo.com/v1/calls) NO se autentica
 * con api_key/api_secret. Requiere un JWT RS256 firmado con la clave privada de
 * una "Vonage Application" (Voice). Por eso necesitamos:
 *
 *   VONAGE_APPLICATION_ID  → el UUID de la Application de Voz en Vonage
 *   VONAGE_PRIVATE_KEY     → la private key (PEM) que Vonage da al crear la App
 *                            (los "\n" pueden venir escapados; se normalizan)
 *
 * Cómo obtenerlas (una sola vez):
 *   1. https://dashboard.vonage.com/ → Applications → Create a new application
 *   2. Activá la capability "Voice", generá la public/private key (descarga el .key)
 *   3. Linkeá el número origen (12015471160) a esa Application
 *   4. Copiá el Application ID → VONAGE_APPLICATION_ID
 *      Copiá el contenido del .key → VONAGE_PRIVATE_KEY
 *
 * El api_key/api_secret de la cuenta Vonage sirven para SMS y balance de cuenta,
 * NO para la Voice API. Por eso no se usan acá.
 *
 * Mismo enfoque que server/utils/google-auth.ts: firmamos a mano con el módulo
 * `crypto` de Node, sin instalar el SDK de Vonage.
 */

import { createSign, randomUUID } from 'node:crypto'

/** base64url (sin padding, +→-, /→_) */
function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * Normaliza la private key PEM. Tolera los problemas típicos de pegar un PEM en
 * un panel de env vars (Netlify, etc.):
 *  - comillas envolventes
 *  - "\n" / "\r\n" escapados en vez de saltos reales
 *  - saltos de línea perdidos (todo el PEM en una sola línea o con espacios)
 *
 * Si detecta la estructura `-----BEGIN ...----- <base64> -----END ...-----`,
 * reconstruye el PEM con el base64 reenvuelto a 64 chars, garantizando un
 * formato que OpenSSL/Node sí puede decodificar.
 */
function normalizePem(pem: string): string {
  let k = pem.trim()
  // Quitar comillas envolventes (copy/paste de .env)
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  // Saltos escapados → reales; quitar \r
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '')

  // Reconstruir si encontramos el patrón PEM (cubre el caso "una sola línea").
  const m = k.match(/-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/)
  if (m) {
    const label = m[1].trim()
    const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '')        // solo caracteres base64
    const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body
    return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`
  }
  return k
}

export interface VonageJwtResult {
  token: string
  application_id: string
}

/**
 * Genera un JWT RS256 válido ~5 min para la Voice API de Vonage.
 * Lanza error claro si faltan las env vars (para loguearlo en agent_tool_logs).
 */
export function generateVonageJwt(): VonageJwtResult {
  const appId = process.env.VONAGE_APPLICATION_ID
  const rawKey = process.env.VONAGE_PRIVATE_KEY

  if (!appId || !rawKey) {
    throw new Error(
      'Faltan credenciales de Vonage Voice: definí VONAGE_APPLICATION_ID y ' +
      'VONAGE_PRIVATE_KEY en las env vars. Se obtienen creando una "Application" ' +
      'de tipo Voice en https://dashboard.vonage.com/ y linkeando el número origen. ' +
      'El api_key/api_secret NO sirven para la Voice API.'
    )
  }

  const privateKey = normalizePem(rawKey)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    application_id: appId,
    iat: now,
    jti: randomUUID(),
    exp: now + 300, // 5 minutos
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  let signature: Buffer
  try {
    signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey)
  } catch (e: any) {
    // Diagnóstico SEGURO (solo metadatos, nunca el contenido de la key):
    // permite saber si el valor desplegado es realmente un PEM o el viejo secret.
    const diag = `[diag rawLen=${rawKey.length} begin=${rawKey.includes('BEGIN')} lineasNorm=${privateKey.split('\n').length}]`
    throw new Error(
      `No se pudo firmar el JWT de Vonage (¿VONAGE_PRIVATE_KEY mal formateada?): ${e?.message || e} ${diag}`
    )
  }

  return { token: `${signingInput}.${base64url(signature)}`, application_id: appId }
}

/** ¿Están configuradas las credenciales de Voice? (para chequeos rápidos) */
export function hasVonageVoiceCreds(): boolean {
  return !!(process.env.VONAGE_APPLICATION_ID && process.env.VONAGE_PRIVATE_KEY)
}
