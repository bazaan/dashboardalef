/**
 * GET /api/piola/afp — histórico de descargos AFP. Solo Administrador (§7.5).
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAdmin } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirAdmin(perfil, 'el reporte AFP')

  const { data, error } = await supabase
    .from('piola_afp_reports').select('*').order('periodo', { ascending: false }).limit(60)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true, reportes: data || [] }
})
