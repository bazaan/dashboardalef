/**
 * Netlify Scheduled Function — dispara el envío diario de pacientes agendados.
 *
 * Se ejecuta todos los días a las 00:00 UTC (= 19:00 hora Lima, UTC-5).
 * Lo único que hace es llamar al endpoint del dashboard, que se encarga de:
 *   1. Consultar los pacientes agendados hoy (Lima) en las 3 tablas
 *   2. POSTear el JSON al webhook n8n
 *   3. Guardar el log en healup_agendamiento_diario_logs
 *
 * Variables de entorno requeridas en Netlify (Site settings → Environment variables):
 *   HEALUP_AGENDAMIENTO_CRON_KEY  — la misma clave configurada en el dashboard
 *   URL                           — Netlify la inyecta automáticamente con la URL del site
 *
 * Si querés cambiar el horario, edita la cron expression abajo.
 * Convertidor útil: https://crontab.guru
 *
 *   "0 0 * * *"  → 00:00 UTC todos los días = 19:00 Lima (recomendado)
 *   "0 1 * * *"  → 20:00 Lima
 *   "30 23 * * *" → 18:30 Lima
 */

export default async () => {
  const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_URL') || ''
  const apiKey = Netlify.env.get('HEALUP_AGENDAMIENTO_CRON_KEY') || ''

  if (!siteUrl) {
    console.error('[cron-healup-agendamientos] No se pudo resolver la URL del site (Netlify URL/DEPLOY_URL)')
    return new Response('Missing site URL', { status: 500 })
  }
  if (!apiKey) {
    console.error('[cron-healup-agendamientos] HEALUP_AGENDAMIENTO_CRON_KEY no está seteada en Netlify')
    return new Response('Missing HEALUP_AGENDAMIENTO_CRON_KEY', { status: 500 })
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/healup/cron-agendamientos-diarios?api_key=${encodeURIComponent(apiKey)}`

  console.log(`[cron-healup-agendamientos] Disparando ${endpoint.replace(apiKey, '***')}`)

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { 'User-Agent': 'netlify-scheduled-function' }
    })
    const bodyText = await resp.text()
    let parsed: any = bodyText
    try { parsed = JSON.parse(bodyText) } catch { /* keep as text */ }

    console.log(
      `[cron-healup-agendamientos] HTTP ${resp.status} | ` +
      `status=${parsed?.status} pacientes=${parsed?.pacientes_count} duración=${parsed?.duracion_ms}ms`
    )

    if (!resp.ok) {
      console.error('[cron-healup-agendamientos] Endpoint devolvió error:', bodyText)
      return new Response(`Endpoint error: ${resp.status}`, { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, response: parsed }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.error('[cron-healup-agendamientos] Excepción llamando al endpoint:', e?.message || e)
    return new Response(`Exception: ${e?.message || e}`, { status: 500 })
  }
}

// Schedule: cron expression (UTC). "0 0 * * *" = 00:00 UTC = 19:00 Lima
export const config = {
  schedule: '0 0 * * *'
}
