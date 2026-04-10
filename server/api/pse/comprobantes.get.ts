/**
 * GET /api/pse/comprobantes?company_id=estasconsuerte&limit=100
 *
 * Devuelve la lista de comprobantes emitidos para una empresa,
 * ordenados por created_at DESC (el campo más confiable).
 * Lee de la tabla `comprobantes_pse`.
 *
 * Estrategia de cliente:
 *   1) Primero intenta `serverSupabaseServiceRole` (bypass RLS).
 *   2) Si la env var SUPABASE_SERVICE_KEY no está configurada
 *      o falla, cae a `serverSupabaseClient` (anon + RLS).
 */

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = String(query.company_id || '').toLowerCase().replace(/\s/g, '')
  const limit     = Math.min(Number(query.limit) || 100, 500)

  console.log('[PSE][Lista] → company_id:', companyId, 'limit:', limit)

  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta company_id' })
  }

  // ── Elegir el cliente correcto ──
  let supabase: any
  try {
    supabase = serverSupabaseServiceRole(event)
  } catch (e: any) {
    console.warn('[PSE][Lista] service_role no disponible, fallback a anon:', e?.message)
    supabase = await serverSupabaseClient(event)
  }

  // Query simple en una sola línea (evita issues de parseo con multilínea)
  const { data, error } = await supabase
    .from('comprobantes_pse')
    .select('id, created_at, tipo_de_comprobante, serie, numero, fecha_de_emision, cliente_tipo_de_documento, cliente_numero_de_documento, cliente_denominacion, cliente_email, moneda, total_gravada, total_igv, total, aceptada_por_sunat, sunat_description, enlace, enlace_del_pdf, enlace_del_xml, enlace_del_cdr, correo_enviado_a, ultimo_envio_correo')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[PSE][Lista] Supabase error:', error.message, error.details || '')
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  console.log('[PSE][Lista] ← devolviendo', (data || []).length, 'comprobantes')
  return { ok: true, items: data || [] }
})
