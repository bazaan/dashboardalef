/**
 * POST /api/ecs/generar-link-monnet
 *
 * Tool del agente IA de ECS: genera un link de pago Monnet para el cliente.
 *
 * Replica el subflow n8n "generar_link_monnet" en un solo endpoint:
 *   1. Genera operation_number único
 *   2. Calcula firma SHA512 (payinMerchantID + opNumber + amount + currency + KEY)
 *   3. Llama API Monnet → recibe link de pago
 *   4. Guarda transacción en ecs_pagos_monnet (estado: 'pendiente')
 *   5. Devuelve { link } al bot para que lo envíe al cliente por WhatsApp
 *   6. Log a agent_tool_logs (tool_name='Generar Link Monnet')
 *
 * Body esperado:
 * {
 *   api_key:                  string,    — auth
 *   cliente_nombre:           string,
 *   cliente_email:            string,    — REQUERIDO por Monnet
 *   cliente_telefono:         string,    — 9 dígitos sin código de país
 *   cliente_dni?:             string,
 *   plan_nombre:              string,
 *   monto:                    number,    — en soles, 2 decimales
 *   metodo_pago?:             string,    — opcional. Default: 'Wallet' (Yape).
 *                                          Valores válidos en Perú según Monnet:
 *                                            'Wallet'        → Yape
 *                                            'TCTD'          → Tarjeta crédito/débito
 *                                            'TC'            → Solo tarjeta crédito
 *                                            'TD'            → Solo tarjeta débito
 *                                            'BankTransfer'  → Transferencia / banca por internet
 *                                            'Cash'          → Pago en efectivo (agentes)
 *                                            'QR'            → QR
 *   chatwoot_account_id?:     number,    — para enviar confirmación post-pago
 *   chatwoot_inbox_id?:       number,
 *   chatwoot_conversation_id?: number,
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   link: "https://...",         — Link que se envía al cliente
 *   operation_number: "ECS-...",
 *   log_id: number
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const API_KEY            = 'ecs-monnet-2026-link'
const MONNET_MERCHANT_ID = process.env.MONNET_MERCHANT_ID || '1142'
const MONNET_KEY         = process.env.MONNET_KEY        || ''
const MONNET_BASE_URL    = process.env.MONNET_BASE_URL   || 'https://payin.api.monnetpayments.com/api-payin/v3/online-payments'

const SUCCESS_URL = 'https://dashboard.alef.company/api/ecs/monnet-redirect?status=ok'
const ERROR_URL   = 'https://dashboard.alef.company/api/ecs/monnet-redirect?status=error'

// ── Helpers ──────────────────────────────────────────────────────────────────

function genOperationNumber(): string {
  // Formato: ECS-{timestamp}-{random} — máx 50 chars como exige Monnet
  const ts = Date.now()
  const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, '0')
  return `ECS-${ts}-${rnd}`
}

function normalizePhone(raw: string | number): string {
  // Monnet exige 9 dígitos (sin prefijo 51)
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length === 11 && str.startsWith('51')) return str.slice(2)
  if (str.length > 9) return str.slice(-9)
  return str
}

/**
 * SHA512 hash de: payinMerchantID + payinMerchantOperationNumber + payinAmount + payinCurrency + KEY
 * Es lo que exige Monnet para autenticar la creación de transacciones.
 */
function calcularFirmaMonnet(opNumber: string, amount: string, currency: string): string {
  const data = `${MONNET_MERCHANT_ID}${opNumber}${amount}${currency}${MONNET_KEY}`
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
    plan_nombre, monto, metodo_pago,
    chatwoot_account_id, chatwoot_inbox_id, chatwoot_conversation_id,
  } = body

  if (!cliente_email || !cliente_telefono || !plan_nombre || !monto) {
    const msg = 'Faltan campos requeridos: cliente_email, cliente_telefono, plan_nombre, monto'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const METODOS_VALIDOS = ['Wallet', 'TCTD', 'TC', 'TD', 'BankTransfer', 'Cash', 'QR']
  const payinMethod = metodo_pago && METODOS_VALIDOS.includes(metodo_pago) ? metodo_pago : 'Wallet'

  // 4. Preparar datos para Monnet
  const operation_number = genOperationNumber()
  const amount           = Number(monto).toFixed(2)        // 2 decimales exigidos
  const currency         = 'PEN'
  const phone            = normalizePhone(cliente_telefono)
  const firma            = calcularFirmaMonnet(operation_number, amount, currency)

  // IMPORTANTE: Monnet exige que payinAmount viaje como STRING con 2 decimales ("9.90"),
  // no como número. La firma se calcula sobre el mismo string — si se envía como número
  // JSON elimina el cero final ("9.9") y Monnet devuelve [0010] Error in payinVerification.
  const monnetPayload = {
    payinMerchantID:                 String(MONNET_MERCHANT_ID),
    payinMerchantOperationNumber:    operation_number,
    payinAmount:                     amount,               // string "9.90"
    payinCurrency:                   currency,
    payinMethod:                     payinMethod,          // Wallet (Yape) por default; configurable desde body
    payinVerification:               firma,
    payinCustomerEmail:              cliente_email.slice(0, 50),
    payinCustomerPhone:              phone,
    payinExpirationTime:             '30',                 // 30 min para pagar
    payinLanguage:                   'ES',
    payinTransactionOKURL:           SUCCESS_URL,
    payinTransactionErrorURL:        ERROR_URL,
    payinDescription:                `Compra - ${plan_nombre}`.slice(0, 100),
  }

  // 5. Llamar a Monnet
  let monnetResponse: any
  try {
    monnetResponse = await $fetch<any>(MONNET_BASE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    monnetPayload,
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    const errMsg = `Monnet API error: ${JSON.stringify(detail)}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // Validar respuesta de Monnet
  if (monnetResponse?.payinErrorCode && monnetResponse.payinErrorCode !== '0000') {
    const errMsg = `Monnet rechazó la transacción: [${monnetResponse.payinErrorCode}] ${monnetResponse.payinErrorMessage}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  const linkPago = monnetResponse?.url
  if (!linkPago) {
    const errMsg = 'Monnet no devolvió un link de pago'
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
      estado:                   'pendiente',
      monnet_trx_operation:     monnetResponse?.payinTrxOperation ?? null,
      link_pago:                linkPago,
      chatwoot_account_id:      chatwoot_account_id ?? null,
      chatwoot_inbox_id:        chatwoot_inbox_id ?? null,
      chatwoot_conversation_id: chatwoot_conversation_id ?? null,
      payload_request:          monnetPayload,
      payload_response:         monnetResponse,
    })
  } catch (e: any) {
    console.error('[generar-link-monnet] Error guardando pago:', e?.message)
    // No throw: el link ya está generado en Monnet
  }

  // 7. Respuesta exitosa
  const output = {
    ok: true,
    link: linkPago,
    operation_number,
    monto: Number(amount),
    plan_nombre,
    metodo_pago: payinMethod,
    message: `Link de pago generado:\n${linkPago}\n\nVálido por 30 minutos.`,
    log_id: logId,
  }

  await updateLog('success', output)

  console.log(
    `[generar-link-monnet] ECS | ${operation_number} | S/${amount} | ${plan_nombre} → ${cliente_nombre} ✅`
  )

  return output
})
