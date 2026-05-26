/**
 * GET /api/healup/cron-citas-manana
 *
 * Endpoint disparado por la Netlify Scheduled Function todos los días a las
 * 00:00 UTC (= 19:00 Lima). Construye el resumen de TODAS las citas cuya fecha de
 * agendamiento es MAÑANA (día Lima + 1), uniendo el calendario del dashboard
 * (`healup_calendar_events`) con Google Calendar, deduplicando, y POSTea el JSON
 * (con un `mensaje_whatsapp` ya armado) al webhook N8N_WEBHOOK_HEALUP_CITAS_MANANA.
 *
 * Cada ejecución guarda un log en `healup_citas_manana_logs`.
 *
 * Variables de entorno:
 *   N8N_WEBHOOK_HEALUP_CITAS_MANANA — URL del webhook n8n
 *   HEALUP_AGENDAMIENTO_CRON_KEY    — clave fallback (?api_key=), compartida con la otra tool
 *   CRON_SECRET                     — secret de Vercel Cron (Bearer), opcional
 */

import { ejecutarEnvioCitasManana } from '~/server/utils/healup-citas-manana'

export default defineEventHandler(async (event) => {
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

  const result = await ejecutarEnvioCitasManana(event, { origen: 'cron' })

  return { ok: result.status !== 'error', ...result }
})
