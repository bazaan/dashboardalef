/**
 * POST /api/ecs/webhook-suscripcion
 *
 * Endpoint público que el ingeniero de ECS llama desde su sistema
 * (api.estasconsuerte.com.pe) cuando ocurren eventos en una suscripción.
 *
 * Razón: nosotros creamos las suscripciones a través de la API de ECS, pero
 * los webhooks de Monnet llegan al servidor del ingeniero — no a nosotros.
 * Para mantener nuestra BD sincronizada (SuscriptoresBDwppECS, ecs_pagos_monnet)
 * el ingeniero nos avisa por este endpoint cuando cambia el estado.
 *
 * Body:
 * {
 *   api_key:                  string,                 — auth (compartida con generar-link-monnet)
 *   evento:                   string,                 — uno de: autorizada | cobrada | cancelada | fallida | expirada
 *   operation_number?:        string,                 — preferido para identificar (ECS-...)
 *   monnet_subscription_id?:  number,                 — alternativa
 *   ecs_subscription_id?:     number,                 — alternativa
 *   monto?:                   number,                 — solo en 'cobrada'
 *   periodicidad_dias?:       number,                 — para calcular próxima cobranza (default 30)
 *   error_message?:           string,                 — solo en 'fallida'
 *   payload_original?:        any,                    — webhook crudo de Monnet, para trazabilidad
 * }
 *
 * Response: { ok, operation_number, estado_actualizado, suscriptor_id }
 *
 * Eventos y su efecto:
 *   autorizada → SuscriptoresBDwppECS.estado='activa', fecha_suscripcion=NOW
 *   cobrada    → suscriptor.estado='activa', fecha_proxima_cobranza=NOW+periodicidad,
 *                ecs_pagos_monnet.estado='pagado', paid_at=NOW
 *   cancelada  → suscriptor.estado='cancelada', fecha_cancelacion=NOW
 *   fallida    → suscriptor.estado='fallida'; ecs_pagos_monnet.estado='fallido'
 *   expirada   → suscriptor.estado='expirada'; ecs_pagos_monnet.estado='expirado'
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'ecs-monnet-2026-link'

const EVENTOS_VALIDOS = ['autorizada', 'cobrada', 'cancelada', 'fallida', 'expirada'] as const
type Evento = typeof EVENTOS_VALIDOS[number]

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  const {
    evento,
    operation_number,
    monnet_subscription_id,
    ecs_subscription_id,
    monto,
    periodicidad_dias,
    error_message,
    payload_original,
  } = body ?? {}

  if (!evento || !EVENTOS_VALIDOS.includes(evento)) {
    throw createError({
      statusCode: 400,
      statusMessage: `evento inválido. Valores permitidos: ${EVENTOS_VALIDOS.join(', ')}`,
    })
  }

  if (!operation_number && !monnet_subscription_id && !ecs_subscription_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificación faltante: pasá operation_number, monnet_subscription_id o ecs_subscription_id',
    })
  }

  // Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'estasconsuerte',
      tool_name:  'Webhook Suscripción ECS',
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

  // 1. Buscar el suscriptor — por operation_number es lo más preciso
  let suscQuery = supabase.from('SuscriptoresBDwppECS').select('*')

  if (operation_number) {
    suscQuery = suscQuery.eq('operation_number', operation_number)
  } else if (monnet_subscription_id) {
    suscQuery = suscQuery.eq('monnet_subscription_id', monnet_subscription_id)
  } else if (ecs_subscription_id) {
    suscQuery = suscQuery.eq('ecs_subscription_id', ecs_subscription_id)
  }

  const { data: suscriptor, error: suscErr } = await suscQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (suscErr || !suscriptor) {
    const msg = `Suscriptor no encontrado para los identificadores recibidos`
    await updateLog('error', null, msg)
    // 200 OK igual para que el ingeniero no reintente — pero log con error
    return { ok: false, evento, ignored: true, reason: 'suscriptor not found in our BD' }
  }

  const now = new Date().toISOString()
  const opNumber = suscriptor.operation_number

  // 2. Aplicar cambios según evento
  const suscUpdate: Record<string, any> = {}
  const pagoUpdate: Record<string, any> = {}

  switch (evento as Evento) {
    case 'autorizada':
      suscUpdate.estado            = 'activa'
      suscUpdate.fecha_suscripcion = suscriptor.fecha_suscripcion ?? now
      pagoUpdate.subscription_status = 'AUTHORIZED'
      pagoUpdate.estado              = 'cobrando'
      break

    case 'cobrada': {
      suscUpdate.estado = 'activa'
      if (!suscriptor.fecha_suscripcion) suscUpdate.fecha_suscripcion = now

      const dias = Number(periodicidad_dias) || 30
      const proxima = new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
      suscUpdate.fecha_proxima_cobranza = proxima.toISOString()

      pagoUpdate.estado  = 'pagado'
      pagoUpdate.paid_at = now
      pagoUpdate.monnet_state = 'AUTORIZADO'
      pagoUpdate.monnet_state_id = 5
      break
    }

    case 'cancelada':
      suscUpdate.estado             = 'cancelada'
      suscUpdate.fecha_cancelacion  = now
      pagoUpdate.estado             = suscriptor.estado === 'activa' ? 'cancelado' : 'cancelado'
      break

    case 'fallida':
      suscUpdate.estado             = 'fallida'
      pagoUpdate.estado             = 'fallido'
      pagoUpdate.monnet_error_message = error_message ?? null
      break

    case 'expirada':
      suscUpdate.estado             = 'expirada'
      pagoUpdate.estado             = 'expirado'
      break
  }

  // Guardar payload original como notas para trazabilidad
  if (payload_original) {
    pagoUpdate.payload_webhook_sub = payload_original
  }

  // 3. Aplicar updates
  try {
    if (Object.keys(suscUpdate).length > 0) {
      await supabase.from('SuscriptoresBDwppECS')
        .update(suscUpdate)
        .eq('id', suscriptor.id)
    }

    if (Object.keys(pagoUpdate).length > 0 && opNumber) {
      await supabase.from('ecs_pagos_monnet')
        .update(pagoUpdate)
        .eq('operation_number', opNumber)
    }
  } catch (e: any) {
    const msg = `Error actualizando BD: ${e?.message}`
    await updateLog('error', null, msg)
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  const output = {
    ok: true,
    evento,
    suscriptor_id:      suscriptor.id,
    operation_number:   opNumber,
    estado_anterior:    suscriptor.estado,
    estado_actualizado: suscUpdate.estado ?? suscriptor.estado,
  }

  await updateLog('success', output)

  console.log(
    `[webhook-suscripcion] ${opNumber} | ${evento} | ${suscriptor.estado} → ${output.estado_actualizado}`,
  )

  return output
})
