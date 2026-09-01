/**
 * Guard de acceso a los endpoints de Healup.
 *
 * Replica la comprobación que ya hacen las rutas de `server/api/healup/**`
 * (sesión Supabase o cookie `dashboard_session` + perfil en `dashboardlogin`),
 * en un solo lugar para no repetirla en cada ruta nueva.
 */

import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

// Healup se ve desde su propio dashboard y desde el de Alef (herramienta interna).
const COMPANY_VARIANTS_HEALUP = ['healup', 'heal up', 'alef', 'alef company']

function normalizeCompany(s: any): string {
  return String(s || '').toLowerCase().trim()
}

export function userCanAccessHealup(role: string, companyId: string): boolean {
  if (role === 'superadmin') return true
  return COMPANY_VARIANTS_HEALUP.includes(normalizeCompany(companyId))
}

export interface PerfilHealup {
  email: string
  role: string
  company_id: string
}

/** Lanza 401/403 si el usuario no puede operar Healup. Devuelve su perfil si sí. */
export async function requireHealupUser(event: H3Event): Promise<PerfilHealup> {
  const supabase = serverSupabaseServiceRole(event)

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

  return profile as PerfilHealup
}
