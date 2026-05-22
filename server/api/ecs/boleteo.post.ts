/**
 * POST /api/ecs/boleteo
 * Activa o desactiva el boleteado automático de ECS desde el webhook-compra.
 * Body: { activo: boolean }
 * Requiere sesión autenticada (cookie dashboard_session).
 */
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const cookie = getCookie(event, 'dashboard_session')
  if (!cookie) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  const body = await readBody(event)
  const nuevoEstado: boolean = !!body?.activo

  const supabase = serverSupabaseServiceRole(event)
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: 'ecs_boleteo_activo', value: String(nuevoEstado), updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

  if (error) throw createError({ statusCode: 500, statusMessage: 'Error guardando configuración' })

  console.log(`[boleteo] Boleteado automático ECS → ${nuevoEstado ? 'ACTIVADO ✅' : 'DESACTIVADO ❌'}`)
  return { activo: nuevoEstado }
})
