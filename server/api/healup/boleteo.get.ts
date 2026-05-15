/**
 * GET /api/healup/boleteo
 * Devuelve si el boleteo automático (desde el agente IA) está activo o no.
 * Estado guardado en app_settings con key 'healup_boleteo_activo'.
 * Default: false (apagado) si la clave no existe.
 */
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = serverSupabaseServiceRole(event)
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'healup_boleteo_activo')
      .maybeSingle()

    return { activo: data?.value === 'true' }
  } catch {
    return { activo: false }
  }
})
