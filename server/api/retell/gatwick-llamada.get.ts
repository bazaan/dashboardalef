/**
 * GET /api/retell/gatwick-llamada
 *
 * Busca en "retell_llamadas_GATWICK" si ya existe registro para una llamada o para
 * el numero de un cliente. Pensado para que el agente de Retell, al iniciar la
 * llamada, verifique si el numero ya contacto antes y recupere su historial.
 *
 * Auth: header x-api-key: retell-gatwick-2026  (o ?api_key=... en la URL).
 *
 * Query params (uno de los dos):
 *   - sesion_id (o numero / from_number): busca por el numero del cliente (recomendado).
 *   - id (o call_id): busca esa llamada exacta.
 *
 * Respuesta:
 * {
 *   existe: boolean,            // true si hay al menos un registro
 *   cantidad: number,          // cuantos registros hay
 *   ultimo_resumen: string,    // resumen de la ultima llamada (si hay)
 *   ultima_transcripcion: string,
 *   ultima_fecha: string,
 *   llamadas: [ ...hasta 5 recientes... ]
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'retell-gatwick-2026'
const TABLE   = 'retell_llamadas_GATWICK'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const q = getQuery(event) as any

  // 1. Auth (header o query)
  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || q?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key invalida' })
  }

  // 2. Parametros de busqueda
  const id        = String(q.id ?? q.call_id ?? '').trim()
  const sesion_id = String(q.sesion_id ?? q.numero ?? q.from_number ?? '').trim()
  if (!id && !sesion_id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el parametro sesion_id (numero) o id (call_id)' })
  }

  // 3. Consulta (las 5 mas recientes)
  let query = (supabase.from(TABLE) as any)
    .select('id, sesion_id, transcripcion, resumen, estado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(5)
  query = id ? query.eq('id', id) : query.eq('sesion_id', sesion_id)

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Error consultando: ${error.message}` })
  }

  const llamadas = data ?? []
  const ultima = llamadas[0] ?? null
  return {
    existe:               llamadas.length > 0,
    cantidad:             llamadas.length,
    ultimo_resumen:       ultima?.resumen ?? '',
    ultima_transcripcion: ultima?.transcripcion ?? '',
    ultima_fecha:         ultima?.creado_en ?? '',
    llamadas,
  }
})
