/**
 * GET /api/healup/citas-manana-logs
 *
 * Devuelve los últimos logs del resumen de citas del día siguiente (paginado).
 *
 * Query params:
 *   limit   (default 50, max 200)
 *   offset  (default 0)
 *   status  (opcional: success | error | empty)
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

const COMPANY_VARIANTS_HEALUP = ['healup', 'heal up']

function normalizeCompany(s: any): string {
  return String(s || '').toLowerCase().trim()
}

function userCanAccessHealup(role: string, companyId: string): boolean {
  if (role === 'superadmin') return true
  return COMPANY_VARIANTS_HEALUP.includes(normalizeCompany(companyId))
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  // ── Auth ──
  let user = await serverSupabaseUser(event)
  let userEmail: string | undefined = user?.email

  if (!user) {
    const cookieRaw = getCookie(event, 'dashboard_session')
    if (cookieRaw) {
      try {
        const sess = typeof cookieRaw === 'string' ? JSON.parse(cookieRaw) : cookieRaw
        if (sess?.email) {
          userEmail = sess.email
          user = { email: sess.email } as any
        }
      } catch { /* ignore */ }
    }
  }

  if (!user || !userEmail) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { data: profile, error: profErr } = await supabase
    .from('dashboardlogin')
    .select('email, role, company_id')
    .eq('email', userEmail)
    .single()

  if (profErr || !profile) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (!userCanAccessHealup((profile as any).role, (profile as any).company_id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: requiere acceso Healup' })
  }

  // ── Query params ──
  const q = getQuery(event)
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const offset = Math.max(Number(q.offset) || 0, 0)
  const statusFilter = q.status ? String(q.status) : null

  let query = supabase
    .from('healup_citas_manana_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error, count } = await query

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { logs: data || [], total: count || 0, limit, offset }
})
