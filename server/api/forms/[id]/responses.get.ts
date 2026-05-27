/**
 * GET /api/forms/[id]/responses
 *
 * Devuelve todas las respuestas de un formulario.
 *   • superadmin: puede ver cualquier form
 *   • admin/agente: solo si el form pertenece a SU empresa
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import {
  getAuthSession, isSuperAdmin, canSeeCompanyForms,
  normalizeCompanyId, getResponsesTable,
} from '~/server/utils/forms-auth'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const session  = await getAuthSession(event, supabase)

  if (!session) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta id' })

  // 1. Cargar el form para verificar permisos
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, slug, title, description, company_id, fields, created_at, active')
    .eq('id', id)
    .maybeSingle()

  if (formErr || !form) {
    throw createError({ statusCode: 404, statusMessage: 'Formulario no encontrado' })
  }

  const companyId = normalizeCompanyId(form.company_id)
  if (!companyId) {
    throw createError({ statusCode: 500, statusMessage: 'Form tiene company_id inválido' })
  }

  if (!canSeeCompanyForms(session, companyId)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes acceso a las respuestas de esta empresa' })
  }

  // 2. Leer respuestas de la tabla correspondiente
  const tableName = getResponsesTable(companyId)
  const { data: responses, error: respErr } = await supabase
    .from(tableName)
    .select('*')
    .eq('form_id', form.id)
    .order('submitted_at', { ascending: false })

  if (respErr) {
    throw createError({ statusCode: 500, statusMessage: respErr.message })
  }

  return {
    form,
    responses: responses || [],
    total:     responses?.length || 0,
  }
})
