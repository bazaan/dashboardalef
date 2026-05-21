/**
 * POST /api/ecs/generar-link-monnet
 *
 * Tool del agente IA de ECS: genera un link de autorización Yape para el cliente.
 *
 * Flujo Monnet/Yape (3 etapas):
 *   ESTA ENDPOINT — Etapa 1: Crear suscripción Yape_on_file → devuelve deepLink al bot
 *   Cliente abre deepLink → autoriza en su app Yape (etapa 2, off-platform)
 *   Webhook → activa la suscripción → dispara cobro automático (etapa 3)
 *
 * Pasos del endpoint:
 *   1. Genera operation_number único
 *   2. Calcula firma SHA512 de autorización (merchantId + type + customerId + processorCode + KEY)
 *   3. POST a https://subscriptions.payin.monnet.io/api/v1/subscription
 *      → recibe subscriptionId + deepLink
 *   4. Guarda transacción en ecs_pagos_monnet (estado: 'pendiente_autorizacion')
 *   5. Devuelve { link } al bot para que lo envíe al cliente por WhatsApp
 *   6. Log a agent_tool_logs (tool_name='Generar Link Monnet')
 *
 * Body esperado:
 * {
 *   api_key:                  string,    — auth
 *   cliente_nombre:           string,
 *   cliente_email:            string,
 *   cliente_telefono:         string,    — 9 dígitos sin código de país (es el customerId Yape)
 *   cliente_dni?:             string,
 *   plan_nombre:              string,
 *   monto:                    number,    — en soles, 2 decimales
 *   chatwoot_account_id?:     number,
 *   chatwoot_inbox_id?:       number,
 *   chatwoot_conversation_id?: number,
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   link: "https://www.yape.com.pe/app/checkout/ocp/subscription?...",  — Link Yape para el cliente
 *   subscription_id: 13211,
 *   operation_number: "ECS-...",
 *   log_id: number
 * }
 *
 * NOTA: Por ahora solo está habilitado Yape (Yape_on_file) en el merchant 1142 de ECS.
 * Para activar tarjeta (TCTD) o transferencia (BankTransfer) hay que pedirle a Monnet
 * que las habilite en la cuenta.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const API_KEY                  = 'ecs-monnet-2026-link'
const MONNET_MERCHANT_ID       = process.env.MONNET_MERCHANT_ID || '1142'
const MONNET_KEY               = process.env.MONNET_KEY        || ''
const MONNET_SUBSCRIPTIONS_URL = process.env.MONNET_SUBSCRIPTIONS_URL
                                || 'https://subscriptions.payin.monnet.io/api/v1/subscription'

const PROCESSOR_CODE = 'Yape_on_file'
const SUBSCRIPTION_TYPE = 'ON_DEMAND'   // ON_DEMAND = cobramos cuando queramos; RECURRENT = cargo automático con periodicidad

// ── Helpers ──────────────────────────────────────────────────────────────────

function genOperationNumber(): string {
  // Formato: ECS-{timestamp}-{random} — máx 50 chars como exige Monnet
  const ts = Date.now()
  const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, '0')
  return `ECS-${ts}-${rnd}`
}

function normalizePhone(raw: string | number): string {
  // Yape exige 9 dígitos (sin prefijo 51)
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length === 11 && str.startsWith('51')) return str.slice(2)
  if (str.length > 9) return str.slice(-9)
  return str
}

/**
 * SHA512 hash de: merchantId + type + customerId + processorCode + KEY
 * Auth header (Bearer) que exige el endpoint de creación de suscripciones.
 */
function calcularAuthSuscripcion(customerId: string): string {
  const data = `${MONNET_MERCHANT_ID}${SUBSCRIPTION_TYPE}${customerId}${PROCESSOR_CODE}${MONNET_KEY}`
  return createHash('sha512').update(data).digest('hex')
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

  if (!MONNET_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'MONNET_KEY no configurado en el servidor' })
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
    plan_nombre, monto,
    chatwoot_account_id, chatwoot_inbox_id, chatwoot_conversation_id,
  } = body

  if (!cliente_email || !cliente_telefono || !plan_nombre || !monto) {
    const msg = 'Faltan campos requeridos: cliente_email, cliente_telefono, plan_nombre, monto'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  // 4. Preparar datos para Monnet
  const operation_number = genOperationNumber()
  const amount           = Number(monto).toFixed(2)
  const currency         = 'PEN'
  const phone            = normalizePhone(cliente_telefono)   // = customerId para Yape
  const authHeader       = calcularAuthSuscripcion(phone)

  const subscriptionPayload = {
    merchantId: Number(MONNET_MERCHANT_ID),
    subscriptionDetails: {
      type:          SUBSCRIPTION_TYPE,
      device:        'MOBILE',         // MOBILE devuelve deepLink que el cliente abre desde su celular
      customerId:    phone,
      processorCode: PROCESSOR_CODE,
    },
    metadata: [
      { key: 'MerchantReference', value: operation_number.slice(0, 100) },
      { key: 'Plan',              value: String(plan_nombre).slice(0, 100) },
    ],
  }

  // 5. Llamar a Monnet — Create Subscription
  let monnetResponse: any
  try {
    monnetResponse = await $fetch<any>(MONNET_SUBSCRIPTIONS_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authHeader}`,
      },
      body:    subscriptionPayload,
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    const errMsg = `Monnet API error: ${JSON.stringify(detail)}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // Validar respuesta — el endpoint devuelve errorCode si algo salió mal
  if (monnetResponse?.errorCode) {
    const errMsg = `Monnet rechazó la suscripción: [${monnetResponse.errorCode}] ${monnetResponse.errorMessage}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  const subscriptionId = monnetResponse?.subscriptionId
  const deepLink       = monnetResponse?.deepLink

  if (!subscriptionId || !deepLink) {
    const errMsg = 'Monnet no devolvió subscriptionId o deepLink'
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 6. Guardar en ecs_pagos_monnet
  try {
    await supabase.from('ecs_pagos_monnet').insert({
      operation_number,
      cliente_nombre,
      cliente_email,
      cliente_telefono:         phone,
      cliente_dni,
      plan_nombre,
      monto:                    Number(amount),
      moneda:                   currency,
      estado:                   'pendiente_autorizacion',   // cliente todavía no ha autorizado en Yape
      subscription_id:          subscriptionId,
      subscription_status:      monnetResponse?.status ?? 'PENDING',
      processor_code:           PROCESSOR_CODE,
      deep_link:                deepLink,
      link_pago:                deepLink,                   // legacy: mismo valor para compatibilidad
      chatwoot_account_id:      chatwoot_account_id ?? null,
      chatwoot_inbox_id:        chatwoot_inbox_id ?? null,
      chatwoot_conversation_id: chatwoot_conversation_id ?? null,
      payload_request:          subscriptionPayload,
      payload_response:         monnetResponse,
    })
  } catch (e: any) {
    console.error('[generar-link-monnet] Error guardando pago:', e?.message)
    // No throw: la suscripción ya está creada en Monnet
  }

  // 7. Respuesta exitosa
  const output = {
    ok: true,
    link: deepLink,
    subscription_id: subscriptionId,
    operation_number,
    monto: Number(amount),
    plan_nombre,
    metodo_pago: 'Yape',
    message: `Link de pago generado:\n${deepLink}\n\nAbre el link en tu celular para autorizar el pago con Yape.`,
    log_id: logId,
  }

  await updateLog('success', output)

  console.log(
    `[generar-link-monnet] ECS | ${operation_number} | sub=${subscriptionId} | S/${amount} | ${plan_nombre} → ${cliente_nombre} ✅`
  )

  return output
})
