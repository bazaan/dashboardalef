/**
 * POST /api/ecs/monnet-webhook
 *
 * Webhook que Monnet llama cuando el cliente completa (o falla) el pago.
 * Monnet envía un HTTP POST con los datos del pago + firma SHA512 de verificación.
 *
 * Lo configuras en el panel de Monnet apuntando a:
 *   https://dashboard.alef.company/api/ecs/monnet-webhook
 *
 * Flujo:
 *   1. Recibe el body de Monnet
 *   2. Verifica la firma SHA512 (autenticidad)
 *   3. Actualiza ecs_pagos_monnet con el resultado
 *   4. Si el pago fue exitoso → envía mensaje "✅ Pago recibido" al cliente
 *      vía Chatwoot (usando el conversation_id que guardamos al crear el link)
 *   5. Responde HTTP 200 a Monnet (lo que espera la API)
 *
 * Payload de Monnet (14 campos):
 * {
 *   payinStateID, payinState, payinMerchantOperationNumber,
 *   payinAmount, payinCurrency, payinMerchantID, payinMethod,
 *   payinVerification, payinStatusErrorCode, payinStatusErrorMessage,
 *   errorDetails, codeErrorTrx, messageErrorTrx, additionalInformation
 * }
 *
 * Estados de Monnet:
 *   1 = Pendiente
 *   2 = Autorizado por la entidad
 *   3 = Rechazado por entidad
 *   4 = Expirado
 *   5 = Autorizado (PAGADO ✅)
 *   6 = Devuelto
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const MONNET_MERCHANT_ID = process.env.MONNET_MERCHANT_ID || '1142'
const MONNET_KEY         = process.env.MONNET_KEY        || ''
const CHATWOOT_BASE      = 'https://chats.alef.company/api/v1'
const CHATWOOT_TOKEN     = process.env.CHATWOOT_API_TOKEN || ''

function calcularFirmaMonnet(opNumber: string, amount: string, currency: string): string {
  const data = `${MONNET_MERCHANT_ID}${opNumber}${amount}${currency}${MONNET_KEY}`
  return createHash('sha512').update(data).digest('hex')
}

/**
 * Envía un mensaje al chat de Chatwoot del cliente.
 */
async function enviarMensajeChatwoot(
  accountId: number,
  conversationId: number,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  if (!CHATWOOT_TOKEN) return { ok: false, error: 'CHATWOOT_API_TOKEN no configurado' }
  try {
    await $fetch(`${CHATWOOT_BASE}/accounts/${accountId}/conversations/${conversationId}/messages`, {
      method:  'POST',
      headers: { 'api_access_token': CHATWOOT_TOKEN, 'Content-Type': 'application/json' },
      body:    { content, message_type: 'outgoing', content_type: 'text' },
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error en Chatwoot' }
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  console.log('[monnet-webhook] Payload recibido:', JSON.stringify(body))

  // 1. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'estasconsuerte',
      tool_name:  'Webhook Monnet',
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

  const {
    payinStateID, payinState, payinMerchantOperationNumber,
    payinAmount, payinCurrency, payinMethod, payinVerification,
    payinStatusErrorCode, payinStatusErrorMessage,
  } = body ?? {}

  if (!payinMerchantOperationNumber) {
    await updateLog('error', null, 'Falta payinMerchantOperationNumber')
    throw createError({ statusCode: 400, statusMessage: 'Falta payinMerchantOperationNumber' })
  }

  // 2. Verificar firma SHA512 (autenticidad del webhook)
  const amountStr  = Number(payinAmount).toFixed(2)
  const firmaCalculada = calcularFirmaMonnet(payinMerchantOperationNumber, amountStr, payinCurrency || 'PEN')
  const firmaOK = firmaCalculada.toLowerCase() === String(payinVerification ?? '').toLowerCase()

  if (!firmaOK) {
    console.error('[monnet-webhook] ❌ Firma inválida — posible intento malicioso')
    await updateLog('error', { firmaCalculada, firmaRecibida: payinVerification }, 'Firma SHA512 inválida')
    throw createError({ statusCode: 401, statusMessage: 'Firma inválida' })
  }

  // 3. Buscar el pago en nuestra BD
  const { data: pago, error: fetchError } = await supabase
    .from('ecs_pagos_monnet')
    .select('*')
    .eq('operation_number', payinMerchantOperationNumber)
    .maybeSingle()

  if (fetchError || !pago) {
    await updateLog('error', null, `Pago no encontrado: ${payinMerchantOperationNumber}`)
    throw createError({ statusCode: 404, statusMessage: 'Pago no encontrado' })
  }

  // 4. Determinar nuevo estado según código Monnet
  // payinStateID === 5 = Autorizado (pagado exitosamente)
  const stateId = Number(payinStateID)
  let nuevoEstado: 'pagado' | 'fallido' | 'expirado' | 'pendiente' = 'pendiente'
  if (stateId === 5 || stateId === 2) nuevoEstado = 'pagado'
  else if (stateId === 3 || stateId === 6) nuevoEstado = 'fallido'
  else if (stateId === 4) nuevoEstado = 'expirado'

  // 5. Actualizar el pago en BD
  const updateData: Record<string, any> = {
    estado:               nuevoEstado,
    monnet_state_id:      stateId,
    monnet_state:         payinState,
    monnet_method:        payinMethod,
    monnet_error_code:    payinStatusErrorCode,
    monnet_error_message: payinStatusErrorMessage,
    payload_webhook:      body,
  }
  if (nuevoEstado === 'pagado') updateData.paid_at = new Date().toISOString()

  await supabase.from('ecs_pagos_monnet')
    .update(updateData)
    .eq('operation_number', payinMerchantOperationNumber)

  // 6. Si fue pagado → enviar confirmación al cliente vía Chatwoot
  let chatwootResult: any = { ok: false, skipped: true }
  if (nuevoEstado === 'pagado' && !pago.confirmacion_enviada && pago.chatwoot_account_id && pago.chatwoot_conversation_id) {
    const mensaje =
      `✅ *¡Pago confirmado!*\n\n` +
      `Gracias ${pago.cliente_nombre ?? ''}, recibimos tu pago de *S/ ${Number(pago.monto).toFixed(2)}* ` +
      `por *${pago.plan_nombre}*.\n\n` +
      `Tu suscripción ya está activa 🍀\n` +
      `Pronto te llegará tu boleta electrónica al correo *${pago.cliente_email}*.`

    chatwootResult = await enviarMensajeChatwoot(
      pago.chatwoot_account_id,
      pago.chatwoot_conversation_id,
      mensaje
    )

    if (chatwootResult.ok) {
      await supabase.from('ecs_pagos_monnet')
        .update({ confirmacion_enviada: true })
        .eq('operation_number', payinMerchantOperationNumber)
    }
  }

  const output = {
    ok: true,
    operation_number: payinMerchantOperationNumber,
    estado_anterior:  pago.estado,
    estado_nuevo:     nuevoEstado,
    monto:            Number(pago.monto),
    chatwoot:         chatwootResult,
  }

  await updateLog('success', output)

  console.log(
    `[monnet-webhook] ${payinMerchantOperationNumber} | ${pago.estado} → ${nuevoEstado}`,
    `| S/${pago.monto} | chatwoot:${chatwootResult.ok ? '✅' : chatwootResult.skipped ? 'SKIP' : '❌'}`
  )

  // 7. Responder 200 a Monnet (lo que espera la API)
  return output
})
