/**
 * Cliente de servidor para la Alef Loyalty Platform (Apple Wallet / Google Wallet).
 *
 * La plataforma vive aparte (VPS 2, https://loyalty.alef.company) y protege sus
 * endpoints por negocio con un JWT propio. Las credenciales NUNCA deben llegar al
 * navegador: todo pasa por rutas `server/api/**` que usan este helper.
 *
 * El token se cachea en memoria del proceso hasta poco antes de expirar, para no
 * pegarle al /login en cada request del dashboard.
 */

interface LoyaltyToken {
  token: string
  businessId: string
  expiresAt: number
}

let cached: LoyaltyToken | null = null

/** Margen antes del vencimiento real para no usar un token que expira en el camino. */
const MARGEN_MS = 60_000

function config() {
  const rc = useRuntimeConfig()
  const baseUrl = String(rc.loyaltyBaseUrl || '').replace(/\/+$/, '')
  const email = String(rc.loyaltyEmail || '')
  const password = String(rc.loyaltyPassword || '')

  if (!baseUrl || !email || !password) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Fidelización no configurada: faltan LOYALTY_BASE_URL, LOYALTY_EMAIL o LOYALTY_PASSWORD en el .env',
    })
  }
  return { baseUrl, email, password }
}

/** Devuelve un token válido, reusando el cacheado si todavía sirve. */
async function getToken(forzarNuevo = false): Promise<LoyaltyToken> {
  if (!forzarNuevo && cached && cached.expiresAt > Date.now() + MARGEN_MS) {
    return cached
  }

  const { baseUrl, email, password } = config()

  let res: any
  try {
    res = await $fetch<any>(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: { email, password },
      timeout: 15_000,
    })
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 401) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Credenciales de la plataforma de fidelización rechazadas (401)',
      })
    }
    throw createError({
      statusCode: 502,
      statusMessage: `No se pudo contactar la plataforma de fidelización: ${e?.message || 'error desconocido'}`,
    })
  }

  if (!res?.access_token || !res?.business_id) {
    throw createError({ statusCode: 502, statusMessage: 'Respuesta de login inesperada' })
  }

  // El JWT trae su propio exp; si no se puede leer, se asume una hora.
  let expMs = Date.now() + 60 * 60 * 1000
  try {
    const payload = JSON.parse(
      Buffer.from(String(res.access_token).split('.')[1], 'base64').toString('utf8'),
    )
    if (payload?.exp) expMs = payload.exp * 1000
  } catch { /* se queda con la hora por defecto */ }

  cached = { token: res.access_token, businessId: String(res.business_id), expiresAt: expMs }
  return cached
}

/**
 * Llama a la API de loyalty ya autenticado.
 *
 * `path` puede incluir el comodín `{business}`, que se reemplaza por el business_id
 * del token — así ninguna ruta del dashboard puede apuntar a otro negocio por error.
 */
export async function loyaltyFetch<T = any>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: any; query?: Record<string, any> } = {},
): Promise<T> {
  const { baseUrl } = config()

  const ejecutar = async (auth: LoyaltyToken) => {
    const url = `${baseUrl}${path.replace('{business}', auth.businessId)}`
    return await $fetch<T>(url, {
      method: opts.method || 'GET',
      body: opts.body,
      query: opts.query,
      headers: { Authorization: `Bearer ${auth.token}` },
      timeout: 20_000,
    })
  }

  let auth = await getToken()
  try {
    return await ejecutar(auth)
  } catch (e: any) {
    // Token vencido o revocado: se reintenta una sola vez con credencial fresca.
    if (e?.response?.status === 401) {
      auth = await getToken(true)
      return await ejecutar(auth)
    }
    if (e?.statusCode) throw e
    throw createError({
      statusCode: e?.response?.status || 502,
      statusMessage: e?.data?.detail || e?.message || 'Error en la plataforma de fidelización',
    })
  }
}

/** business_id del negocio asociado a las credenciales configuradas. */
export async function loyaltyBusinessId(): Promise<string> {
  return (await getToken()).businessId
}

/** URL pública base (para armar enlaces de pase o del formulario de alta). */
export function loyaltyBaseUrl(): string {
  return config().baseUrl
}
