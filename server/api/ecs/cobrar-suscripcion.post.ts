/**
 * POST /api/ecs/cobrar-suscripcion
 *
 * ETAPA 3 del flujo Monnet/Yape: ejecuta el cobro real sobre una suscripción
 * ya autorizada por el cliente.
 *
 * Se llama desde:
 *   - El webhook `monnet-webhook` cuando detecta que una suscripción pasó a AUTHORIZED
 *   - Manualmente (debug / reintentos) con `internal_key`
 *
 * Pasos:
 *   1. Recibe operation_number (o subscription_id) del pago a cobrar
 *   2. Lee el registro de ecs_pagos_monnet
 *   3. Construye el payload de Monnet con subscription.chargeType=ON_DEMAND
 *   4. POST a /api-payin/v3/online-payments
 *   5. Actualiza el estado del pago según respuesta
 *
 * Body:
 * {
 *   internal_key:      string,    — auth interna (no exponer públicamente)
 *   operation_number:  string,    — el operation_number guardado al crear la suscripción
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const INTERNAL_KEY       = process.env.ECS_INTERNAL_KEY     || 'ecs-monnet-internal-2026'
const MONNET_MERCHANT_ID = process.env.MONNET_MERCHANT_ID   || '1142'
const MONNET_KEY         = process.env.MONNET_KEY           || ''
const MONNET_PAYIN_URL   = process.env.MONNET_BASE_URL
                          || 'https://payin.api.monnetpayments.com/api-payin/v3/online-payments'

const SUCCESS_URL = 'https://dashboard.alef.company/api/ecs/monnet-redirect?status=ok'
const ERROR_URL   = 'https://dashboard.alef.company/api/ecs/monnet-redirect?status=error'

function calcularFirmaMonnet(opNumber: string, amount: string, currency: string): string {
  const data = `${MONNET_MERCHANT_ID}${opNumber}${amount}${currency}${MONNET_KEY}`
  return createHash('sha512').update(data).digest('hex')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)

  if (body?.internal_key !== INTERNAL_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'Acceso no autorizado' })
  }

  const { operation_number } = body
  if (!operation_number) {
    throw createError({ statusCode: 400, statusMessage: 'Falta operation_number' })
  }

  // 1. Cargar el pago
  const { data: pago, error: fetchError } = await supabase
    .from('ecs_pagos_monnet')
    .select('*')
    .eq('operation_number', operation_number)
    .maybeSingle()

  if (fetchError || !pago) {
    throw createError({ statusCode: 404, statusMessage: 'Pago no encontrado' })
  }

  if (!pago.subscription_id) {
    throw createError({ statusCode: 400, statusMessage: 'El pago no tiene subscription_id — no se puede cobrar' })
  }

  if (pago.estado === 'pagado') {
    return { ok: true, message: 'Pago ya estaba cobrado', operation_number }
  }

  // 2. Generar NUEVO operation_number para el cobro (Monnet exige unicidad por transacción)
  const cobroOpNumber = `${operation_number}-COBRO-${Date.now().toString().slice(-6)}`
  const amount        = Number(pago.monto).toFixed(2)
  const currency      = pago.moneda || 'PEN'
  const firma         = calcularFirmaMonnet(cobroOpNumber, amount, currency)

  const monnetPayload = {
    payinMerchantID:                String(MONNET_MERCHANT_ID),
    payinMerchantOperationNumber:   cobroOpNumber,
    payinAmount:                    amount,
    payinCurrency:                  currency,
    payinMethod:                    'Wallet',
    processorCode:                  pago.processor_code || 'Yape_on_file',
    payinVerification:              firma,
    payinProductDescription:        'Web',
    payinLanguage:                  'ES',
    payinExpirationTime:            '30',
    payinDateTime:                  new Date().toISOString().slice(0, 10),
    payinCustomerName:              (pago.cliente_nombre || 'Cliente').split(' ')[0]?.slice(0, 50) || 'Cliente',
    payinCustomerLastName:          (pago.cliente_nombre || '').split(' ').slice(1).join(' ').slice(0, 50) || '-',
    payinCustomerEmail:             pago.cliente_email,
    payinCustomerPhone:             pago.cliente_telefono,
    payinCustomerTypeDocument:      'DNI',
    payinCustomerDocument:          pago.cliente_dni || '12345678',
    payinCustomerAddress:           'Lima',
    payinCustomerCity:              'Lima',
    payinCustomerRegion:            'Lima',
    payinCustomerCountry:           'Peru',
    payinCustomerZipCode:           '15001',
    payinCustomerID:                pago.id,
    payinTransactionOKURL:          SUCCESS_URL,
    payinTransactionErrorURL:       ERROR_URL,
    URLMonnet:                      MONNET_PAYIN_URL,
    typePost:                       'json',
    subscription: {
      chargeType:     'ON_DEMAND',
      subscriptionId: Number(pago.subscription_id),
    },
  }

  // 3. Llamar a Monnet
  let monnetResponse: any
  try {
    monnetResponse = await $fetch<any>(MONNET_PAYIN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    monnetPayload,
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    const errMsg = `Monnet API error: ${JSON.stringify(detail)}`
    console.error('[cobrar-suscripcion]', errMsg)
    await supabase.from('ecs_pagos_monnet').update({
      monnet_error_message: errMsg,
    }).eq('operation_number', operation_number)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 4. Procesar respuesta
  const errorCode = monnetResponse?.payinErrorCode
  const success   = !errorCode || errorCode === '0000'

  const updateData: Record<string, any> = {
    monnet_trx_operation: monnetResponse?.payinTrxOperation ?? null,
    monnet_error_code:    errorCode ?? null,
    monnet_error_message: monnetResponse?.payinErrorMessage ?? null,
    payload_response:     monnetResponse,
  }

  if (success) {
    updateData.estado  = 'cobrando'   // En espera de confirmación por webhook
    console.log(`[cobrar-suscripcion] ${operation_number} | cobro iniciado | trx=${monnetResponse?.payinTrxOperation}`)
  } else {
    updateData.estado = 'fallido'
    console.error(`[cobrar-suscripcion] ${operation_number} | Monnet rechazó: [${errorCode}] ${monnetResponse?.payinErrorMessage}`)
  }

  await supabase.from('ecs_pagos_monnet')
    .update(updateData)
    .eq('operation_number', operation_number)

  return {
    ok: success,
    operation_number,
    cobro_operation_number: cobroOpNumber,
    subscription_id: pago.subscription_id,
    monnet_response: monnetResponse,
  }
})
