/**
 * GET /api/ecs/boleteo
 * Devuelve si el boleteado automático de ECS está activo o no.
 * Lo usa el endpoint /api/pse/webhook-compra para decidir si emite la
 * boleta o la salta. Estado guardado en app_settings con key 'ecs_boleteo_activo'.
 * Default: false (apagado) si la clave no existe.
 */
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = serverSupabaseServiceRole(event)
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ecs_boleteo_activo')
      .maybeSingle()

    return { activo: data?.value === 'true' }
  } catch {
    return { activo: false }
  }
})
