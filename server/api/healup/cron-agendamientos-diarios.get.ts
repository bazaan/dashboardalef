/**
 * GET /api/healup/cron-agendamientos-diarios
 *
 * Endpoint disparado por Vercel Cron todos los días a las 00:00 UTC (= 19:00 Lima).
 * Vercel envía la petición como GET con el header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Construye el JSON con todos los pacientes agendados HOY (Lima) en las 3 tablas:
 *   - PacientesBDwppHEALUP
 *   - PacientesBDfbigHEALUP
 *   - PacientesBDtiktokHEALUP
 *
 * Lo POSTea al webhook n8n configurado en N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO.
 * n8n recibe el JSON y dispara su HTTP request para enviar WhatsApp a la gerente.
 *
 * Cada ejecución guarda un log completo en `healup_agendamiento_diario_logs`
 * (visible desde la UI del dashboard).
 *
 * Variables de entorno:
 *   N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO — URL del webhook n8n
 *   HEALUP_AGENDAMIENTO_CRON_KEY           — clave fallback (?api_key=)
 *   CRON_SECRET                            — secret de Vercel Cron (Bearer)
 */

import { ejecutarEnvioAgendamientos } from '~/server/utils/healup-agendamientos'

export default defineEventHandler(async (event) => {
  // ── Autenticación: acepta Vercel Cron (CRON_SECRET) o ?api_key= ──
  const auth = getHeader(event, 'authorization') || ''
  const query = getQuery(event)

  const cronSecret = process.env.CRON_SECRET
  const cronKey = process.env.HEALUP_AGENDAMIENTO_CRON_KEY

  const tokenFromAuth = auth.replace(/^Bearer\s+/i, '').trim()
  const tokenFromQuery = String(query?.api_key || '').trim()

  const okVercel = cronSecret && tokenFromAuth && tokenFromAuth === cronSecret
  const okApiKey = cronKey && (tokenFromAuth === cronKey || tokenFromQuery === cronKey)

  if (!okVercel && !okApiKey) {
    throw createError({
      statusCode: 401,
      statusMessage:
        'Unauthorized: missing Authorization Bearer (CRON_SECRET) or ?api_key (HEALUP_AGENDAMIENTO_CRON_KEY)'
    })
  }

  const result = await ejecutarEnvioAgendamientos(event, { origen: 'cron' })

  return {
    ok: result.status !== 'error',
    ...result
  }
})
