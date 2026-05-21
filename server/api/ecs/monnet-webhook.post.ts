/**
 * POST /api/ecs/monnet-webhook
 *
 * Webhook que Monnet llama en dos momentos del flujo:
 *
 *   A. SUSCRIPCIÓN: cuando el cliente autoriza/rechaza la suscripción Yape
 *      Payload contiene: subscriptionId, status (AUTHORIZED|DENIED|CANCELLED|...)
 *      → si AUTHORIZED, disparamos el cobro automáticamente
 *
 *   B. COBRO: cuando Monnet termina de procesar un cobro (estado final del pago)
 *      Payload contiene: payinStateID, payinMerchantOperationNumber, ...
 *      → actualizamos estado del pago + enviamos confirmación Chatwoot
 *
 * Lo configuras en el panel de Monnet apuntando a:
 *   https://dashboard.alef.company/api/ecs/monnet-webhook
 *
 * Estados de Monnet (cobro):
 *   1 = Pendiente, 2 = Autorizado entidad, 3 = Rechazado entidad,
 *   4 = Expirado, 5 = Autorizado (PAGADO ✅), 6 = Devuelto
 *
 * Estados de Monnet (suscripción):
 *   PENDING, AUTHORIZED, FAILED, CANCELLED, DENIED, EXPIRED
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

const MONNET_MERCHANT_ID = process.env.MONNET_MERCHANT_ID || '1142'
const MONNET_KEY         = process.env.MONNET_KEY        || ''
const INTERNAL_KEY       = process.env.ECS_INTERNAL_KEY   || 'ecs-monnet-internal-2026'
const CHATWOOT_BASE      = 'https://chats.alef.company/api/v1'
const CHATWOOT_TOKEN     = process.env.CHATWOOT_API_TOKEN || ''

function calcularFirmaMonnet(opNumber: string, amount: string, currency: string): string {
  const data = `${MONNET_MERCHANT_ID}${opNumber}${amount}${currency}${MONNET_KEY}`
  return createHash('sha512').update(data).digest('hex')
}

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

  // ─────────────────────────────────────────────────────────────────────────
  // CASO A: Webhook de SUSCRIPCIÓN (cliente autorizó/rechazó en Yape)
  // ─────────────────────────────────────────────────────────────────────────
  // Monnet manda: { subscriptionId, status, ... }
  if (body?.subscriptionId && body?.status && !body?.payinMerchantOperationNumber) {
    const subscriptionId = Number(body.subscriptionId)
    const subStatus      = String(body.status).toUpperCase()

    const { data: pago } = await supabase
      .from('ecs_pagos_monnet')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .maybeSingle()

    if (!pago) {
      await updateLog('error', null, `Suscripción ${subscriptionId} no encontrada en BD`)
      // Igual respondemos 200 a Monnet para que no reintente
      return { ok: true, ignored: true, reason: 'subscription not found' }
    }

    await supabase.from('ecs_pagos_monnet').update({
      subscription_status:    subStatus,
      payload_webhook_sub:    body,
    }).eq('subscription_id', subscriptionId)

    // Si la suscripción quedó AUTORIZADA → disparar el cobro automáticamente
    if (subStatus === 'AUTHORIZED' && pago.estado === 'pendiente_autorizacion') {
      console.log(`[monnet-webhook] Suscripción ${subscriptionId} autorizada → disparando cobro`)

      try {
        const cobroResult: any = await $fetch('/api/ecs/cobrar-suscripcion', {
          method: 'POST',
          baseURL: process.env.NUXT_PUBLIC_BASE_URL || 'https://dashboard.alef.company',
          headers: { 'Content-Type': 'application/json' },
          body: {
            internal_key:     INTERNAL_KEY,
            operation_number: pago.operation_number,
          },
        })
        await updateLog('success', { tipo: 'subscription_authorized', cobro: cobroResult })
        return { ok: true, tipo: 'subscription_authorized', cobro: cobroResult }
      } catch (e: any) {
        const errMsg = e?.data?.statusMessage ?? e?.message ?? 'Error disparando cobro'
        console.error('[monnet-webhook] Error disparando cobro:', errMsg)
        await updateLog('error', null, errMsg)
        return { ok: false, tipo: 'subscription_authorized', error: errMsg }
      }
    }

    // Otros estados (DENIED, CANCELLED, EXPIRED, FAILED) → actualizar y notificar
    if (['DENIED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(subStatus)) {
      await supabase.from('ecs_pagos_monnet').update({
        estado: subStatus === 'EXPIRED' ? 'expirado' : 'fallido',
      }).eq('subscription_id', subscriptionId)

      if (pago.chatwoot_account_id && pago.chatwoot_conversation_id) {
        await enviarMensajeChatwoot(
          pago.chatwoot_account_id,
          pago.chatwoot_conversation_id,
          `⚠️ No pudimos procesar tu pago de *S/ ${Number(pago.monto).toFixed(2)}* por *${pago.plan_nombre}*.\n\nSi quieres intentar de nuevo, escribe *PAGAR* y te genero un nuevo link.`,
        )
      }
    }

    await updateLog('success', { tipo: 'subscription_update', subStatus })
    return { ok: true, tipo: 'subscription_update', subStatus }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO B: Webhook de COBRO (resultado final del payment)
  // ─────────────────────────────────────────────────────────────────────────
  const {
    payinStateID, payinState, payinMerchantOperationNumber,
    payinAmount, payinCurrency, payinMethod, payinVerification,
    payinStatusErrorCode, payinStatusErrorMessage,
  } = body ?? {}

  if (!payinMerchantOperationNumber) {
    await updateLog('error', null, 'Webhook sin subscriptionId ni payinMerchantOperationNumber')
    throw createError({ statusCode: 400, statusMessage: 'Payload de webhook no reconocido' })
  }

  // Verificar firma SHA512
  const amountStr  = Number(payinAmount).toFixed(2)
  const firmaCalculada = calcularFirmaMonnet(payinMerchantOperationNumber, amountStr, payinCurrency || 'PEN')
  const firmaOK = firmaCalculada.toLowerCase() === String(payinVerification ?? '').toLowerCase()

  if (!firmaOK) {
    console.error('[monnet-webhook] ❌ Firma inválida — posible intento malicioso')
    await updateLog('error', { firmaCalculada, firmaRecibida: payinVerification }, 'Firma SHA512 inválida')
    throw createError({ statusCode: 401, statusMessage: 'Firma inválida' })
  }

  // El operation_number del cobro tiene formato "ECS-...-COBRO-XXXXXX"
  // Hay que extraer el operation_number original (sin el sufijo) para encontrar el pago
  const baseOpNumber = String(payinMerchantOperationNumber).split('-COBRO-')[0]

  const { data: pago, error: fetchError } = await supabase
    .from('ecs_pagos_monnet')
    .select('*')
    .eq('operation_number', baseOpNumber)
    .maybeSingle()

  if (fetchError || !pago) {
    await updateLog('error', null, `Pago no encontrado: ${baseOpNumber}`)
    throw createError({ statusCode: 404, statusMessage: 'Pago no encontrado' })
  }

  // Determinar nuevo estado según código Monnet
  const stateId = Number(payinStateID)
  let nuevoEstado: 'pagado' | 'fallido' | 'expirado' | 'pendiente' = 'pendiente'
  if (stateId === 5 || stateId === 2) nuevoEstado = 'pagado'
  else if (stateId === 3 || stateId === 6) nuevoEstado = 'fallido'
  else if (stateId === 4) nuevoEstado = 'expirado'

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
    .eq('operation_number', baseOpNumber)

  // Notificar al cliente vía Chatwoot
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
      mensaje,
    )

    if (chatwootResult.ok) {
      await supabase.from('ecs_pagos_monnet')
        .update({ confirmacion_enviada: true })
        .eq('operation_number', baseOpNumber)
    }
  }

  const output = {
    ok: true,
    tipo: 'payment_update',
    operation_number: baseOpNumber,
    estado_anterior:  pago.estado,
    estado_nuevo:     nuevoEstado,
    monto:            Number(pago.monto),
    chatwoot:         chatwootResult,
  }

  await updateLog('success', output)

  console.log(
    `[monnet-webhook] ${baseOpNumber} | ${pago.estado} → ${nuevoEstado}`,
    `| S/${pago.monto} | chatwoot:${chatwootResult.ok ? '✅' : chatwootResult.skipped ? 'SKIP' : '❌'}`,
  )

  return output
})
