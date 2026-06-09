/**
 * POST /api/gatwick/generar-llamada
 *
 * Tool del agente de emergencias de Gatwick: "generar_llamada".
 * Dispara una llamada de voz vía Vonage Voice API al/los técnico(s) de turno.
 * El técnico escucha "Emergencia Gatwick. Revisa el WhatsApp" (3 veces) y cuelga.
 *
 * El destino (técnico) es ROTATIVO y se gestiona en nuestro sistema: se leen los
 * números activos de `gatwick_alerta_destinos` (recibe_llamada=true). Si está
 * vacía, cae al fallback de env GATWICK_LLAMADA_DESTINO_FALLBACK.
 *
 * Auth a Vonage: JWT RS256 (ver server/utils/vonage-auth.ts). Requiere las env
 * vars VONAGE_APPLICATION_ID y VONAGE_PRIVATE_KEY (NO el api_key/api_secret, que
 * no sirven para la Voice API).
 *
 * El guión de voz lo sirve /api/vonage/handle-call (NCCO público).
 *
 * Body: { api_key: string }   (sin más parámetros — el destino sale del sistema)
 *
 * Log: agent_tool_logs (company_id='gatwick', tool_name='Generar Llamada').
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { generateVonageJwt } from '~/server/utils/vonage-auth'

const API_KEY = 'gatwick-llamada-2026'

const VONAGE_CALLS_URL = 'https://api.nexmo.com/v1/calls'
const VONAGE_FROM = process.env.VONAGE_FROM_NUMBER || '12015471160'

/** Vonage quiere E.164 SIN el "+" (solo dígitos): +51955322269 → 51955322269 */
function toVonageNumber(raw: any): string {
  let s = String(raw ?? '').replace(/[^\d+]/g, '')
  if (!s) return ''
  if (s.startsWith('+')) s = s.slice(1)
  s = s.replace(/^00/, '')
  if (/^9\d{8}$/.test(s)) s = '51' + s     // celular peruano sin código país → +51
  return s
}

function maskPhone(raw: any): string {
  const s = String(raw ?? '')
  if (s.length <= 4) return s ? '••••' : ''
  return s.slice(0, 3) + '••••' + s.slice(-2)
}

/** Resuelve la URL pública del answer_url (NCCO). */
function resolveAnswerUrl(event: any): string {
  if (process.env.VONAGE_ANSWER_URL) return process.env.VONAGE_ANSWER_URL
  try {
    const url = getRequestURL(event)
    return `${url.origin}/api/vonage/handle-call`
  } catch {
    return 'https://dashboard.alef.company/api/vonage/handle-call'
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
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
      company_id: 'gatwick',
      tool_name:  'Generar Llamada',
      input_data: { trigger: 'emergencia' },
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const finish = async (status: string, output: any, errorMsg?: string) => {
    if (logId) {
      try {
        await supabase.from('agent_tool_logs').update({
          status, output_data: output, error_message: errorMsg ?? null,
          duration_ms: Date.now() - startTime,
        }).eq('id', logId)
      } catch {}
    }
    return output
  }

  const nowIso = new Date().toISOString()

  // 3. Generar JWT de Vonage
  let jwt: string
  try {
    jwt = generateVonageJwt().token
  } catch (e: any) {
    const msg = e?.message || String(e)
    return await finish('error', {
      success: false,
      message: 'No se pudo realizar la llamada (credenciales Vonage no configuradas).',
      error: msg,
      timestamp: nowIso,
    }, msg)
  }

  // 4. Resolver destinatarios
  let destinos: string[] = []
  try {
    const { data } = await supabase
      .from('gatwick_alerta_destinos')
      .select('telefono, nombre')
      .eq('activo', true)
      .eq('recibe_llamada', true)
      .order('orden', { ascending: true })
    destinos = (data ?? []).map((d: any) => toVonageNumber(d.telefono)).filter(Boolean)
  } catch {}
  const llamadaFallback = process.env.GATWICK_LLAMADA_DESTINO_FALLBACK
  if (destinos.length === 0 && llamadaFallback) {
    destinos = llamadaFallback.split(',').map(toVonageNumber).filter(Boolean)
  }
  destinos = [...new Set(destinos)]

  if (destinos.length === 0) {
    const msg = 'No hay técnicos de turno configurados para llamada (gatwick_alerta_destinos vacía y sin GATWICK_LLAMADA_DESTINO_FALLBACK).'
    return await finish('error', {
      success: false,
      message: 'No se pudo realizar la llamada. Contacta al equipo técnico.',
      error: 'sin_destinatarios',
      timestamp: nowIso,
    }, msg)
  }

  const answerUrl = resolveAnswerUrl(event)

  // 5. Disparar la llamada por cada destino
  const llamadas: any[] = []
  for (const number of destinos) {
    try {
      const res: any = await $fetch(VONAGE_CALLS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: {
          to: [{ type: 'phone', number }],
          from: { type: 'phone', number: VONAGE_FROM },
          answer_url: [answerUrl],
        },
        timeout: 10000,
      })
      llamadas.push({ to: maskPhone(number), ok: true, uuid: res?.uuid ?? null, status: res?.status ?? 'started' })
    } catch (e: any) {
      const detalle = e?.data?.detail || e?.data?.title || e?.message || String(e)
      llamadas.push({ to: maskPhone(number), ok: false, error: detalle })
    }
  }

  const exitosas = llamadas.filter(l => l.ok)
  const fallidas = llamadas.filter(l => !l.ok)

  if (exitosas.length > 0) {
    const status = fallidas.length === 0 ? 'success' : 'partial'
    const output = {
      success: true,
      message: 'Se realizó la llamada al técnico de turno.',
      uuid: exitosas[0].uuid,
      llamadas_ok: exitosas.length,
      llamadas_fallidas: fallidas.length,
      detalle: llamadas,
      timestamp: nowIso,
    }
    await finish(status, output, fallidas.length ? `${fallidas.length} llamada(s) fallaron` : undefined)
    console.log(`[generar-llamada] Gatwick | ✅${exitosas.length} ❌${fallidas.length}`)
    return output
  }

  const errorMsg = fallidas.map(f => f.error).join(' | ')
  const output = {
    success: false,
    message: 'No se pudo realizar la llamada. Contacta al equipo técnico.',
    error: errorMsg,
    detalle: llamadas,
    timestamp: nowIso,
  }
  await finish('error', output, errorMsg)
  console.error(`[generar-llamada] Gatwick | TODAS fallaron: ${errorMsg}`)
  return output
})
