/**
 * POST /api/ecs/cobrar-suscripcion
 *
 * ETAPA 3 del flujo Monnet/Yape: ejecuta el cobro real sobre una suscripción
 * ya autorizada por el cliente.
 *
 * Diseñado para POLLING desde n8n: el bot llama este endpoint cada N segundos
 * después de enviar el deepLink al cliente. Mientras la suscripción no esté
 * autorizada en Yape, Monnet devuelve [0044] subscription is inactive — lo
 * traducimos a `status: "esperando_autorizacion"` SIN marcar el pago como
 * fallido. Cuando el cliente finalmente autoriza, el siguiente poll dispara
 * el cobro real y devolvemos `status: "cobrando"` o `"pagado"`.
 *
 * Body:
 * {
 *   api_key:           string,    — misma key que usa generar-link-monnet
 *   operation_number:  string,    — el operation_number devuelto por generar-link-monnet
 * }
 *
 * Response (200):
 * {
 *   ok: true,
 *   operation_number: "ECS-...",
 *   status: "esperando_autorizacion" | "cobrando" | "pagado" | "fallido" | "expirado",
 *   subscription_status: "PENDING" | "AUTHORIZED" | ...,
 *   monnet_error_code?: "0044" | "0000" | ...,
 *   message: "<texto orientativo para el bot>"
 * }
 *
 * Patrón de uso desde n8n:
 *   - Después de generar-link-monnet, esperar 30s
 *   - Loop: llamar /api/ecs/cobrar-suscripcion → si status === "esperando_autorizacion" → wait 30s → repetir
 *   - Salir del loop cuando status sea "pagado", "fallido" o "expirado"
 *   - Máximo recomendado: 20 intentos (10 min total) — si pasa de ahí, marcar como expirado
 *
 * También se puede llamar desde otros endpoints internos pasando
 * `internal_key` en lugar de `api_key`.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const API_KEY            = 'ecs-monnet-2026-link'
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

  // Auth: aceptar api_key (público para el bot) o internal_key (servidor a servidor)
  if (body?.api_key !== API_KEY && body?.internal_key !== INTERNAL_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
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

  // 2. Estados terminales → devolver tal cual sin reintentar
  if (pago.estado === 'pagado') {
    return {
      ok: true,
      operation_number,
      status: 'pagado',
      subscription_status: pago.subscription_status,
      message: 'El pago ya fue cobrado',
    }
  }

  if (pago.estado === 'expirado') {
    return {
      ok: false,
      operation_number,
      status: 'expirado',
      subscription_status: pago.subscription_status,
      message: 'La suscripción expiró sin que el cliente autorice',
    }
  }

  if (pago.estado === 'fallido') {
    return {
      ok: false,
      operation_number,
      status: 'fallido',
      subscription_status: pago.subscription_status,
      monnet_error_code: pago.monnet_error_code,
      message: pago.monnet_error_message ?? 'El cobro fue rechazado',
    }
  }

  if (!pago.subscription_id) {
    throw createError({ statusCode: 400, statusMessage: 'El pago no tiene subscription_id' })
  }

  // 3. Si ya está en estado "cobrando" (cobro enviado, esperando confirmación final)
  //    igual reintentamos por si Monnet devolvió ya un estado final
  //    (el bot podría preferir saber si terminó)

  // 4. Generar NUEVO operation_number para este intento de cobro
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

  // 5. Llamar a Monnet
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
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  const errorCode = monnetResponse?.payinErrorCode

  // 6. CASO ESPECIAL: 0044 = suscripción inactiva (cliente todavía no autorizó en Yape)
  //    Esto es lo NORMAL durante el polling — no marcamos como fallido.
  if (errorCode === '0044') {
    console.log(`[cobrar-suscripcion] ${operation_number} | suscripción no autorizada todavía (polling)`)
    return {
      ok: true,
      operation_number,
      status: 'esperando_autorizacion',
      subscription_status: 'PENDING',
      monnet_error_code: errorCode,
      message: 'El cliente todavía no ha autorizado el pago en su app Yape. Reintentar en 30 segundos.',
    }
  }

  // 7. Otros errores → marcar como fallido
  if (errorCode && errorCode !== '0000') {
    await supabase.from('ecs_pagos_monnet').update({
      estado:               'fallido',
      monnet_error_code:    errorCode,
      monnet_error_message: monnetResponse?.payinErrorMessage,
      payload_response:     monnetResponse,
    }).eq('operation_number', operation_number)

    console.error(`[cobrar-suscripcion] ${operation_number} | Monnet rechazó: [${errorCode}] ${monnetResponse?.payinErrorMessage}`)

    return {
      ok: false,
      operation_number,
      status: 'fallido',
      monnet_error_code: errorCode,
      message: monnetResponse?.payinErrorMessage ?? 'Cobro rechazado por Monnet',
    }
  }

  // 8. Éxito: cobro iniciado en Monnet (esperando confirmación final por webhook)
  await supabase.from('ecs_pagos_monnet').update({
    estado:               'cobrando',
    subscription_status:  'AUTHORIZED',
    monnet_trx_operation: monnetResponse?.payinTrxOperation ?? null,
    monnet_error_code:    null,
    monnet_error_message: null,
    payload_response:     monnetResponse,
  }).eq('operation_number', operation_number)

  console.log(`[cobrar-suscripcion] ${operation_number} | ✅ cobro iniciado | trx=${monnetResponse?.payinTrxOperation}`)

  return {
    ok: true,
    operation_number,
    status: 'cobrando',
    subscription_status: 'AUTHORIZED',
    monnet_trx_operation: monnetResponse?.payinTrxOperation,
    message: 'Cobro iniciado en Monnet. El pago será confirmado por webhook de pago final en segundos.',
  }
})
