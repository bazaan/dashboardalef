/**
 * POST /api/healup/agendamientos-diarios-trigger
 *
 * Disparo MANUAL del envío diario a n8n desde el dashboard
 * ("Probar envío ahora" en el panel "Envío Diario WhatsApp" de Healup).
 *
 * Requiere sesión Healup (admin, agente o superadmin con acceso a Healup).
 * Internamente llama a la misma lógica que usa el cron de Vercel.
 */

import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { ejecutarEnvioAgendamientos } from '~/server/utils/healup-agendamientos'

// Esta herramienta vive ahora en el dashboard de Alef (es interna/de testeo),
// así que la pueden disparar usuarios de Alef y de Healup, además de superadmin.
const COMPANY_VARIANTS_HEALUP = ['healup', 'heal up', 'alef', 'alef company']

function normalizeCompany(s: any): string {
  return String(s || '').toLowerCase().trim()
}

function userCanAccessHealup(role: string, companyId: string): boolean {
  if (role === 'superadmin') return true
  return COMPANY_VARIANTS_HEALUP.includes(normalizeCompany(companyId))
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  // ── 1. Resolver sesión (Supabase Auth + fallback cookie legacy) ──
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

  // ── 2. Verificar perfil real del solicitante ─────────────────────
  const { data: profile, error: profErr } = await supabase
    .from('dashboardlogin')
    .select('email, role, company_id')
    .eq('email', userEmail)
    .single()

  if (profErr || !profile) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: perfil no encontrado' })
  }

  if (!userCanAccessHealup((profile as any).role, (profile as any).company_id)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: solo usuarios Healup pueden disparar el envío'
    })
  }

  // ── 3. Ejecutar el envío ─────────────────────────────────────────
  const result = await ejecutarEnvioAgendamientos(event, {
    origen: 'manual',
    triggered_by_email: userEmail
  })

  return {
    ok: result.status !== 'error',
    ...result
  }
})
