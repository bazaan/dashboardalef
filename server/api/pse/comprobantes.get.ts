/**
 * GET /api/pse/comprobantes?company_id=estasconsuerte&limit=100
 *
 * Devuelve la lista de comprobantes emitidos para una empresa,
 * ordenados por fecha de emisión DESC. Lee de la tabla `comprobantes_pse`.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const companyId = String(query.company_id || '').toLowerCase().replace(/\s/g, '')
  const limit     = Math.min(Number(query.limit) || 100, 500)

  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta company_id' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('comprobantes_pse')
    .select(`
      id, created_at,
      tipo_de_comprobante, serie, numero,
      fecha_de_emision,
      cliente_tipo_de_documento, cliente_numero_de_documento, cliente_denominacion, cliente_email,
      moneda, total_gravada, total_igv, total,
      aceptada_por_sunat, sunat_description,
      enlace, enlace_del_pdf, enlace_del_xml, enlace_del_cdr,
      correo_enviado_a, ultimo_envio_correo
    `)
    .eq('company_id', companyId)
    .order('fecha_de_emision', { ascending: false })
    .order('numero', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[PSE][Lista] error:', error.message)
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, items: data || [] }
})
