/**
 * POST /api/retell/gatwick-inbound
 *
 * "Inbound webhook" de Retell: Retell lo llama en el INSTANTE en que entra una llamada,
 * ANTES de que el agente empiece a hablar. Aqui buscamos el historial del numero que
 * llama en "retell_llamadas_GATWICK" y devolvemos VARIABLES DINAMICAS que Retell inyecta
 * en el prompt del agente. Asi el bot ya "sabe" desde el saludo si el cliente llamo antes
 * y de que se trato.
 *
 * Formato de respuesta que espera Retell:
 *   { "call_inbound": { "dynamic_variables": { "clave": "valor", ... } } }
 * (los valores deben ser strings)
 *
 * Auth: se recomienda incluir ?api_key=retell-gatwick-2026 en la URL configurada en Retell.
 * Si la key no coincide, NO rompemos la llamada: devolvemos variables vacias (sin contexto).
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'retell-gatwick-2026'
const TABLE   = 'retell_llamadas_GATWICK'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({}))
  const q = getQuery(event) as any

  // Variables por defecto (cliente nuevo / sin contexto)
  const dv: Record<string, string> = {
    ya_llamo: 'no', llamadas_previas: '0', resumen_previo: '', ultima_fecha: '',
  }

  // Auth suave: si la key no coincide, devolvemos sin contexto (no rompemos la llamada)
  const key = q?.api_key || getHeader(event, 'x-api-key')
  if (key !== API_KEY) {
    return { call_inbound: { dynamic_variables: dv } }
  }

  // Retell manda el numero en body.call_inbound.from_number
  const inbound = body?.call_inbound ?? body ?? {}
  const from = String(inbound.from_number || body?.from_number || '').trim()

  if (from) {
    try {
      const { data } = await (supabase.from(TABLE) as any)
        .select('resumen, transcripcion, creado_en')
        .eq('sesion_id', from)
        .order('creado_en', { ascending: false })
        .limit(3)
      const arr = data ?? []
      if (arr.length) {
        dv.ya_llamo         = 'si'
        dv.llamadas_previas = String(arr.length)
        dv.resumen_previo   = String(arr[0]?.resumen || arr[0]?.transcripcion || '').slice(0, 1500)
        dv.ultima_fecha     = String(arr[0]?.creado_en || '')
      }
    } catch (e: any) {
      console.error('[retell/gatwick-inbound] Error consultando historial:', e?.message)
    }
  }

  console.log(`[retell/gatwick-inbound] ${from || '(sin numero)'} -> ya_llamo=${dv.ya_llamo} (${dv.llamadas_previas})`)
  return { call_inbound: { dynamic_variables: dv } }
})
