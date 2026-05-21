/**
 * POST /api/ecs/generar-link-monnet
 *
 * Tool del agente IA de ECS: genera link de suscripción Yape para el cliente.
 *
 * IMPORTANTE: Este endpoint ya NO habla con Monnet directamente — ahora hace
 * proxy al sistema interno de ECS (api.estasconsuerte.com.pe). Razón: ECS
 * tiene su propia BD de suscripciones y su web "Mi Cuenta" depende de que
 * la suscripción esté ahí. Si creamos directo en Monnet, queda huérfana.
 *
 * El sistema ECS se encarga de:
 *   1. Crear la suscripción en Monnet con sus credenciales
 *   2. Guardarla en su BD asociada al usuario (por phoneNumber)
 *   3. Recibir el webhook AUTHORIZED de Monnet
 *   4. Disparar el cobro automáticamente
 *   5. Mostrar la suscripción en "Mi Cuenta" del cliente
 *
 * Pasos del endpoint:
 *   1. Login admin en ECS con credenciales del .env → obtiene JWT
 *   2. POST /subscriptions/create al sistema ECS con planKey + phoneNumber
 *   3. Guarda el registro en ecs_pagos_monnet para trazabilidad local
 *   4. Devuelve el deepLink al bot para que lo envíe al cliente por WhatsApp
 *
 * Body esperado:
 * {
 *   api_key:                  string,    — auth
 *   cliente_nombre:           string,
 *   cliente_email:            string,
 *   cliente_telefono:         string,    — 9 dígitos, será el phoneNumber Yape
 *   cliente_dni?:             string,
 *   plan_nombre:              string,    — texto humano del plan ("La Fija", "Medio Pituco")
 *   plan_key?:                string,    — opcional, si lo conocemos directo (ej: "MEDIO_PITUCO")
 *   monto:                    number,    — referencial, ECS define el monto real
 *   chatwoot_account_id?:     number,
 *   chatwoot_inbox_id?:       number,
 *   chatwoot_conversation_id?: number,
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   link: "https://www.yape.com.pe/app/checkout/ocp/subscription?...",
 *   ecs_subscription_id: 120,        — ID interno en ECS
 *   monnet_subscription_id: 13233,   — ID en Monnet
 *   plan_name: "Medio Pituco",
 *   operation_number: "ECS-...",
 *   log_id: number
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY            = 'ecs-monnet-2026-link'
const ECS_API_BASE       = process.env.ECS_API_BASE_URL || 'https://api.estasconsuerte.com.pe'
const ECS_ADMIN_EMAIL    = process.env.ECS_ADMIN_EMAIL  || ''
const ECS_ADMIN_PASSWORD = process.env.ECS_ADMIN_PASSWORD || ''

// Mapeo plan_nombre (humano) → planKey (slug ECS). Se puede sobreescribir
// pasando plan_key directamente en el body.
const PLAN_KEY_MAP: Record<string, string> = {
  'la fija':           'LA_FIJA',
  'medio pituco':      'MEDIO_PITUCO',
  'pituco':            'PITUCO',
  'la suertuda':       'LA_SUERTUDA',
  // agregar acá conforme se conozcan más planes
}

// Cache simple del token admin (TTL 6 días, el JWT dura 7)
let cachedToken: { value: string; expiresAt: number } | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function genOperationNumber(): string {
  const ts = Date.now()
  const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, '0')
  return `ECS-${ts}-${rnd}`
}

function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length === 11 && str.startsWith('51')) return str.slice(2)
  if (str.length > 9) return str.slice(-9)
  return str
}

function resolverPlanKey(planNombre: string, planKeyExplicit?: string): string {
  if (planKeyExplicit && planKeyExplicit.trim()) return planKeyExplicit.trim()
  const lower = String(planNombre || '').trim().toLowerCase()
  if (PLAN_KEY_MAP[lower]) return PLAN_KEY_MAP[lower]
  // Fallback: convertir a UPPER_SNAKE_CASE
  return lower.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '').toUpperCase()
}

/**
 * Login en el sistema ECS y obtiene un JWT admin. Cachea el resultado por
 * 6 días (el JWT dura 7) para no loguear en cada request.
 */
async function getEcsAdminToken(): Promise<string> {
  if (!ECS_ADMIN_EMAIL || !ECS_ADMIN_PASSWORD) {
    throw new Error('ECS_ADMIN_EMAIL y ECS_ADMIN_PASSWORD no configurados en .env')
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value
  }

  const loginRes: any = await $fetch(`${ECS_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: ECS_ADMIN_EMAIL, password: ECS_ADMIN_PASSWORD },
  })

  const token = loginRes?.token || loginRes?.access_token || loginRes?.accessToken
  if (!token) {
    throw new Error(`Login ECS no devolvió token. Response: ${JSON.stringify(loginRes)}`)
  }

  cachedToken = { value: token, expiresAt: now + 6 * 24 * 60 * 60 * 1000 } // 6 días
  return token
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'estasconsuerte',
      tool_name:  'Generar Link Monnet',
      input_data: body,
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const updateLog = async (status: string, output: any, errorMsg?: string) => {
    if (!logId) return
    try {
      await supabase.from('agent_tool_logs').update({
        status, output_data: output, error_message: errorMsg ?? null,
        duration_ms: Date.now() - startTime,
      }).eq('id', logId)
    } catch {}
  }

  // 3. Validación
  const {
    cliente_nombre, cliente_email, cliente_telefono, cliente_dni,
    plan_nombre, plan_key, monto,
    chatwoot_account_id, chatwoot_inbox_id, chatwoot_conversation_id,
  } = body

  if (!cliente_telefono || !plan_nombre) {
    const msg = 'Faltan campos requeridos: cliente_telefono, plan_nombre'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const operation_number = genOperationNumber()
  const phone            = normalizePhone(cliente_telefono)
  const planKey          = resolverPlanKey(plan_nombre, plan_key)

  // 4. Login admin en ECS
  let token: string
  try {
    token = await getEcsAdminToken()
  } catch (err: any) {
    const errMsg = `Error logueando en ECS: ${err?.message ?? err}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 5. Crear suscripción en ECS
  const ecsPayload = {
    planKey,
    device:      'MOBILE',
    phoneNumber: phone,
  }

  let ecsResponse: any
  try {
    ecsResponse = await $fetch<any>(`${ECS_API_BASE}/subscriptions/create`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: ecsPayload,
    })
  } catch (err: any) {
    // Si el token expiró (401), invalidar cache y reintentar UNA vez
    if (err?.statusCode === 401 || err?.response?.status === 401) {
      cachedToken = null
      try {
        token = await getEcsAdminToken()
        ecsResponse = await $fetch<any>(`${ECS_API_BASE}/subscriptions/create`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: ecsPayload,
        })
      } catch (retryErr: any) {
        const detail = retryErr?.data ?? retryErr?.response?._data ?? retryErr?.message ?? retryErr
        const errMsg = `ECS API error (tras reintento): ${JSON.stringify(detail)}`
        await updateLog('error', null, errMsg)
        throw createError({ statusCode: 502, statusMessage: errMsg })
      }
    } else {
      const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
      const errMsg = `ECS API error: ${JSON.stringify(detail)}`
      await updateLog('error', null, errMsg)
      throw createError({ statusCode: 502, statusMessage: errMsg })
    }
  }

  // 6. Validar respuesta de ECS
  if (ecsResponse?.errorCode) {
    const errMsg = `ECS rechazó la suscripción: [${ecsResponse.errorCode}] ${ecsResponse.errorMessage}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  const ecsSubscriptionId    = ecsResponse?.id
  const monnetSubscriptionId = ecsResponse?.subscriptionId
  const deepLink             = ecsResponse?.deepLink
  const planName             = ecsResponse?.planName

  if (!deepLink) {
    const errMsg = `ECS no devolvió deepLink. Response: ${JSON.stringify(ecsResponse)}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 7. Guardar en ecs_pagos_monnet para trazabilidad local
  try {
    await supabase.from('ecs_pagos_monnet').insert({
      operation_number,
      cliente_nombre,
      cliente_email,
      cliente_telefono:         phone,
      cliente_dni,
      plan_nombre:              planName || plan_nombre,
      monto:                    Number(monto) || 0,
      moneda:                   'PEN',
      estado:                   'pendiente_autorizacion',
      subscription_id:          monnetSubscriptionId,
      subscription_status:      ecsResponse?.status ?? 'PENDING',
      processor_code:           'Yape_on_file',
      deep_link:                deepLink,
      link_pago:                deepLink,
      chatwoot_account_id:      chatwoot_account_id ?? null,
      chatwoot_inbox_id:        chatwoot_inbox_id ?? null,
      chatwoot_conversation_id: chatwoot_conversation_id ?? null,
      payload_request:          { planKey, device: 'MOBILE', phoneNumber: phone, ecs_id: ecsSubscriptionId },
      payload_response:         ecsResponse,
    })
  } catch (e: any) {
    console.error('[generar-link-monnet] Error guardando en BD:', e?.message)
    // No bloquear: la suscripción ya está creada en ECS
  }

  // 8. Respuesta exitosa
  const output = {
    ok: true,
    link: deepLink,
    ecs_subscription_id:    ecsSubscriptionId,
    monnet_subscription_id: monnetSubscriptionId,
    plan_name:              planName,
    plan_key:               planKey,
    operation_number,
    monto: Number(monto) || 0,
    metodo_pago: 'Yape',
    message: `Link de pago generado:\n${deepLink}\n\nAbre el link en tu celular para autorizar el pago con Yape. Una vez autorizado, el cobro se procesa automáticamente.`,
    log_id: logId,
  }

  await updateLog('success', output)

  console.log(
    `[generar-link-monnet] ECS | ${operation_number} | plan=${planKey} | ecs_id=${ecsSubscriptionId} | sub=${monnetSubscriptionId} | ${cliente_nombre} ✅`,
  )

  return output
})
