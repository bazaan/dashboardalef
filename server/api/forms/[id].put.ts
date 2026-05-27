/**
 * PUT /api/forms/[id]
 *
 * Edita un formulario existente. Solo superadmin.
 * El slug NO se puede cambiar (para no romper links ya enviados).
 *
 * Body (todos opcionales):
 * {
 *   title?, description?, fields?, active?,
 *   thanks_text?, redirect_url?, company_id?
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getAuthSession, isSuperAdmin, normalizeCompanyId } from '~/server/utils/forms-auth'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const session  = await getAuthSession(event, supabase)

  if (!isSuperAdmin(session)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo superadmin puede editar formularios' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta id' })

  const body = await readBody(event)
  const update: Record<string, any> = {}

  if (body?.title !== undefined)        update.title        = String(body.title).slice(0, 200)
  if (body?.description !== undefined)  update.description  = body.description ? String(body.description).slice(0, 1000) : null
  if (body?.fields !== undefined && Array.isArray(body.fields)) {
    if (body.fields.length === 0) throw createError({ statusCode: 400, statusMessage: 'fields no puede ser vacío' })
    update.fields = body.fields
  }
  if (body?.active !== undefined)       update.active       = !!body.active
  if (body?.thanks_text !== undefined)  update.thanks_text  = body.thanks_text || null
  if (body?.redirect_url !== undefined) update.redirect_url = body.redirect_url || null

  if (body?.company_id !== undefined) {
    const companyId = normalizeCompanyId(body.company_id)
    if (!companyId) throw createError({ statusCode: 400, statusMessage: 'company_id inválido' })
    update.company_id = companyId
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay cambios para guardar' })
  }

  const { data, error } = await supabase.from('forms').update(update).eq('id', id).select('*').single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true, form: data }
})
