/**
 * GET /api/tradecars/chatwoot-asesor-previo?telefono=972619000
 *
 * Lo usa el flujo de n8n "ASIGNACION ASESOR-TRADECARS" (29/09/2026), ANTES de repartir una
 * conversación nueva por round robin: si ese teléfono ya tuvo una conversación anterior con
 * un asesor asignado, la conversación nueva se deriva al MISMO asesor (continuidad), en vez
 * de a uno al azar.
 *
 * Se llama en cuanto entra la conversación (`conversation_created`) — ANTES de que el otro
 * flujo ("Trade Cars — Lead desde mensaje de Chatwoot") haya podido leer el mensaje y guardar
 * el teléfono. Por eso este endpoint no depende de la fila de ESA conversación: n8n extrae el
 * teléfono directo del payload del webhook (de `meta.sender.phone_number` si es WhatsApp, o
 * con una expresión regular sobre el texto del primer mensaje si es Instagram/Facebook, que
 * no trae `phone_number`) y llama acá solo con ese teléfono.
 *
 * ── AUTENTICACIÓN ────────────────────────────────────────────────────────────
 *   Header: x-api-key: tradecars-chatwoot-lead-2026  (misma key que /chatwoot-lead)
 *
 * ── RESPUESTA (siempre 200 salvo 400/401) ───────────────────────────────────
 *   { ok: true, encontrado: false }
 *   { ok: true, encontrado: true, asesor_asignado: "Rodrigo Paredes", id_asesor_asignado: 55 }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'tradecars-chatwoot-lead-2026'

/** Deja solo dígitos y quita el prefijo 51 (Perú) si el número quedó de 11 dígitos. */
function normalizarTelefono(valor: string): string {
  let digitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (digitos.length === 11 && digitos.startsWith('51')) digitos = digitos.slice(2)
  return digitos
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery(event) as any

  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || query?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  const telefono = normalizarTelefono(String(query?.telefono || ''))
  if (!telefono) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el teléfono (?telefono=)' })
  }

  const { data, error, status } = await supabase
    .from('tradecars_leads_chatwoot')
    .select('asesor_asignado, id_asesor_asignado')
    .eq('telefono', telefono)
    .not('id_asesor_asignado', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const tablaFaltante = status === 404 || (!!error && (error.code === '42P01' || error.code === 'PGRST205'
    || /does not exist|schema cache/i.test(String(error.message || ''))))
  if (tablaFaltante) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Falta correr sql/tradecars_leads_chatwoot_asesor.sql en Supabase para poder consultar el asesor previo.',
    })
  }
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  if (!data) return { ok: true, encontrado: false }
  return {
    ok: true,
    encontrado: true,
    asesor_asignado: data.asesor_asignado,
    id_asesor_asignado: data.id_asesor_asignado,
  }
})
