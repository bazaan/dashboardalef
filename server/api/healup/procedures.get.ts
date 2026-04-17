// GET /api/healup/procedures
// Retorna todos los procedimientos con su cabina asignada.
// Usado por el agente de WhatsApp para mostrar opciones y auto-asignar cabina.

import { serverSupabaseServiceRole } from '#supabase/server'

const GRUPOS_CABINA_2 = [
  'FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D',
  'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION', 'CARBOXITERAPIA'
]

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('healup_procedures')
    .select('id, name, sku, grupo, price, discount, color, cabina')
    .order('grupo', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const procedures = (data || []).map((p: any) => {
    const resolvedCabina = p.cabina ||
      (GRUPOS_CABINA_2.includes((p.grupo || '').toUpperCase()) ? 'cabina2' : 'cabina1')

    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      grupo: p.grupo || '',
      price: p.price ?? 0,
      final_price: p.price && p.discount
        ? Math.round(p.price * (1 - p.discount / 100) * 100) / 100
        : (p.price ?? 0),
      discount: p.discount ?? 0,
      cabina: resolvedCabina,
      cabina_label: resolvedCabina === 'cabina1'
        ? 'Cabina 1 — Doctora Valeria (Armonización facial)'
        : 'Cabina 2 — Cosmiatra (Faciales, Corporales, HIFU)',
    }
  })

  return { procedures }
})
