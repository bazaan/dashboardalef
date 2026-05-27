/**
 * DELETE /api/forms/[id]
 *
 * Elimina un formulario. Solo superadmin.
 * Las respuestas asociadas también se eliminan (FK ON DELETE CASCADE).
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getAuthSession, isSuperAdmin } from '~/server/utils/forms-auth'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const session  = await getAuthSession(event, supabase)

  if (!isSuperAdmin(session)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo superadmin puede eliminar formularios' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta id' })

  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
