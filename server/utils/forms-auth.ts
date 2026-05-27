/**
 * Helpers compartidos para los endpoints de /api/forms/*
 *
 *  - getAuthSession(): valida la cookie dashboard_session contra la BD
 *    y devuelve { email, role, company_id } o null.
 *  - getResponsesTable(): mapea company_id → nombre de tabla.
 *  - isSuperAdmin / canSeeCompanyForms: helpers de permisos.
 */

import type { H3Event } from 'h3'

export const VALID_COMPANY_IDS = [
  'healup','brada','alef','alegrated','clinicaarroyo','origitec',
  'solari','skip','estasconsuerte','estetikamedika','davila','gatwick',
] as const

export type CompanyId = typeof VALID_COMPANY_IDS[number]

export interface FormsSession {
  email: string
  role: string
  company_id: string
}

/**
 * Lee la cookie `dashboard_session` y verifica contra la tabla dashboardlogin
 * para asegurar que el usuario sigue existiendo y devolver su rol real.
 * El cliente puede haber tampered con la cookie, por eso re-verificamos.
 */
export async function getAuthSession(event: H3Event, supabase: any): Promise<FormsSession | null> {
  const cookie = getCookie(event, 'dashboard_session')
  if (!cookie) return null

  let parsed: any
  try { parsed = JSON.parse(decodeURIComponent(cookie)) }
  catch { return null }

  if (!parsed?.email) return null

  try {
    const { data } = await supabase
      .from('dashboardlogin')
      .select('email, role, company_id')
      .ilike('email', parsed.email)
      .maybeSingle()

    if (!data) return null
    return {
      email:      String(data.email),
      role:       String(data.role || '').toLowerCase(),
      company_id: String(data.company_id || '').toLowerCase().trim(),
    }
  } catch {
    return null
  }
}

export function isSuperAdmin(session: FormsSession | null): boolean {
  return !!session && session.role === 'superadmin'
}

/**
 * Normaliza un company_id a uno de los slugs válidos.
 * Soporta variantes como 'Heal up', 'HEALUP', 'estás con suerte', etc.
 */
export function normalizeCompanyId(raw: string | null | undefined): CompanyId | null {
  if (!raw) return null
  const lower = String(raw).toLowerCase().trim()
  // Match exacto primero
  if ((VALID_COMPANY_IDS as readonly string[]).includes(lower)) {
    return lower as CompanyId
  }
  // Match por substring (cubre 'heal up', 'estás con suerte', etc.)
  for (const id of VALID_COMPANY_IDS) {
    if (lower.includes(id) || id.includes(lower.replace(/\s+/g, ''))) return id
  }
  // Casos especiales
  if (lower.includes('heal'))    return 'healup'
  if (lower.includes('suerte'))  return 'estasconsuerte'
  if (lower.includes('estetik')) return 'estetikamedika'
  if (lower.includes('arroyo'))  return 'clinicaarroyo'
  if (lower.includes('miguel') || lower.includes('davila')) return 'davila'
  return null
}

/**
 * Devuelve el nombre exacto de la tabla de respuestas para una empresa.
 */
export function getResponsesTable(companyId: CompanyId): string {
  return `form_responses_${companyId}`
}

/**
 * ¿Puede este usuario ver/exportar respuestas de la empresa target?
 *   - superadmin: siempre sí
 *   - admin/agente: solo si su company_id coincide con la empresa target
 */
export function canSeeCompanyForms(session: FormsSession | null, targetCompanyId: CompanyId): boolean {
  if (!session) return false
  if (isSuperAdmin(session)) return true
  const ownCompany = normalizeCompanyId(session.company_id)
  return ownCompany === targetCompanyId
}
