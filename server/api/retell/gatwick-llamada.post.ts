/**
 * POST /api/retell/gatwick-llamada
 *
 * Recibe el contexto de una llamada de Retell AI y lo guarda en la tabla
 * "retell_llamadas_GATWICK" (upsert por id). Sirve para dos escenarios de Retell:
 *   (a) Custom Function  — el agente la llama (idealmente como ultima accion).
 *   (b) Webhook post-call — Retell envia el evento call_ended / call_analyzed con
 *       la transcripcion COMPLETA al finalizar la llamada (recomendado).
 *
 * En ambos casos Retell incluye el objeto de la llamada en `body.call`, del cual se
 * extraen call_id, from_number, transcript, etc.
 *
 * Auth: header  x-api-key: retell-gatwick-2026  (o api_key en el body).
 *
 * Respuesta: { success: true, id, sesion_id } — el campo `success` lo puede leer
 * Retell en "Store Fields as Variables" (guardado <- success).
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'retell-gatwick-2026'
const TABLE   = 'retell_llamadas_GATWICK'

/** Convierte la transcripcion de Retell a texto (string directo o array de turnos). */
function transcriptToText(call: any): string {
  if (typeof call?.transcript === 'string' && call.transcript.trim()) return call.transcript.trim()
  const arr = call?.transcript_object
  if (Array.isArray(arr) && arr.length) {
    return arr
      .map((t: any) => `${t?.role === 'agent' ? 'Agente' : 'Cliente'}: ${t?.content ?? ''}`)
      .join('\n')
      .trim()
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event)

  // 1. Autenticacion (header o body)
  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || body?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key invalida' })
  }

  // 2. Retell manda el objeto de la llamada en body.call (custom function y webhook).
  const call = body?.call ?? body ?? {}
  const args = body?.args ?? {}

  const id            = String(call.call_id || body?.call_id || args.call_id || `retell_${Date.now()}`)
  const sesion_id     = String(call.from_number || body?.from_number || args.sesion_id || args.from_number || '')
  const transcripcion = transcriptToText(call) || String(args.transcripcion || body?.transcript || '')
  const resumen       = call?.call_analysis?.call_summary || null
  const grabacion_url = call?.recording_url || null
  const estado        = call?.disconnection_reason || call?.call_status || null
  let   duracion_seg: number | null = null
  if (call?.start_timestamp && call?.end_timestamp) {
    duracion_seg = Math.max(0, Math.round((Number(call.end_timestamp) - Number(call.start_timestamp)) / 1000))
  }

  const row: Record<string, any> = {
    id, sesion_id, transcripcion, resumen, duracion_seg, grabacion_url, estado, payload: body,
  }

  // 3. Guardar (upsert por id). Tolerante: si alguna columna opcional no existe,
  //    reintenta guardando solo los campos base (id, sesion_id, transcripcion).
  try {
    const { error } = await (supabase.from(TABLE) as any).upsert(row, { onConflict: 'id' })
    if (error) {
      const retry = await (supabase.from(TABLE) as any).upsert({ id, sesion_id, transcripcion }, { onConflict: 'id' })
      if (retry.error) throw retry.error
    }
  } catch (e: any) {
    console.error('[retell/gatwick-llamada] Error guardando:', e?.message)
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'gatwick', tool_name: 'Retell Llamada', input_data: body,
        status: 'error', error_message: e?.message ?? 'error guardando',
      })
    } catch {}
    throw createError({ statusCode: 500, statusMessage: `Error guardando la llamada: ${e?.message}` })
  }

  // 4. Log best-effort de exito (visible en Dev Agent Logs -> Gatwick)
  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'gatwick', tool_name: 'Retell Llamada',
      input_data:  { id, sesion_id, chars_transcripcion: transcripcion.length, estado },
      output_data: { id, sesion_id }, status: 'success',
    })
  } catch {}

  console.log(`[retell/gatwick-llamada] guardada ${id} | ${sesion_id} | ${transcripcion.length} chars | ${estado ?? '-'}`)
  return { success: true, id, sesion_id, guardado: true, message: 'Llamada guardada correctamente' }
})
