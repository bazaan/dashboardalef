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

/** Normaliza la private key PEM (acepta "\n" escapados de las env vars). */
function normalizePem(pem: string): string {
  let k = pem.trim()
  // Si vino con comillas envolventes (copy/paste de .env), las quita.
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1)
  }
  return k.replace(/\\n/g, '\n')
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
    throw new Error(
      `No se pudo firmar el JWT de Vonage (¿VONAGE_PRIVATE_KEY mal formateada?): ${e?.message || e}`
    )
  }

  return { token: `${signingInput}.${base64url(signature)}`, application_id: appId }
}

/** ¿Están configuradas las credenciales de Voice? (para chequeos rápidos) */
export function hasVonageVoiceCreds(): boolean {
  return !!(process.env.VONAGE_APPLICATION_ID && process.env.VONAGE_PRIVATE_KEY)
}
