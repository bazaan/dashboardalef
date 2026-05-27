/**
 * GET /api/forms[?company_id=<empresa>]
 *
 * Lista formularios visibles para el usuario actual:
 *   • superadmin: todos los forms (puede filtrar con ?company_id=)
 *   • admin/agente: solo los de su empresa
 *
 * Response: { forms: [...], total }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getAuthSession, isSuperAdmin, normalizeCompanyId } from '~/server/utils/forms-auth'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const session  = await getAuthSession(event, supabase)

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  }

  const query = getQuery(event)
  let companyFilter: string | null = null

  if (isSuperAdmin(session)) {
    // Superadmin puede filtrar por empresa o ver todos
    if (query?.company_id) {
      companyFilter = normalizeCompanyId(String(query.company_id))
      if (!companyFilter) {
        throw createError({ statusCode: 400, statusMessage: 'company_id inválido' })
      }
    }
  } else {
    // Admin/agente: solo su empresa
    companyFilter = normalizeCompanyId(session.company_id)
    if (!companyFilter) {
      return { forms: [], total: 0 }
    }
  }

  let q = supabase.from('forms').select('*').order('created_at', { ascending: false })
  if (companyFilter) q = q.eq('company_id', companyFilter)

  const { data, error } = await q

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    forms: data || [],
    total: data?.length || 0,
  }
})
