/**
 * Netlify Scheduled Function — dispara el resumen de CITAS DEL DÍA SIGUIENTE.
 *
 * Se ejecuta todos los días a las 00:00 UTC (= 19:00 hora Lima, UTC-5).
 * Lo único que hace es llamar al endpoint del dashboard, que se encarga de:
 *   1. Traer todas las citas cuya fecha de agendamiento es MAÑANA (dashboard + Google Calendar)
 *   2. Deduplicar por DNI / teléfono / nombre normalizado
 *   3. POSTear el JSON (con mensaje_whatsapp armado) al webhook n8n
 *   4. Guardar el log en healup_citas_manana_logs
 *
 * Variables de entorno requeridas en Netlify (Site settings → Environment variables):
 *   HEALUP_AGENDAMIENTO_CRON_KEY  — la misma clave usada por la otra tool diaria
 *   URL                           — Netlify la inyecta automáticamente con la URL del site
 *
 * Para cambiar el horario, edita la cron expression abajo. https://crontab.guru
 *   "0 0 * * *"   → 00:00 UTC todos los días = 19:00 Lima (recomendado)
 *   "0 1 * * *"   → 20:00 Lima
 */

export default async () => {
  const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_URL') || ''
  const apiKey = Netlify.env.get('HEALUP_AGENDAMIENTO_CRON_KEY') || ''

  if (!siteUrl) {
    console.error('[cron-healup-citas-manana] No se pudo resolver la URL del site (Netlify URL/DEPLOY_URL)')
    return new Response('Missing site URL', { status: 500 })
  }
  if (!apiKey) {
    console.error('[cron-healup-citas-manana] HEALUP_AGENDAMIENTO_CRON_KEY no está seteada en Netlify')
    return new Response('Missing HEALUP_AGENDAMIENTO_CRON_KEY', { status: 500 })
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/healup/cron-citas-manana?api_key=${encodeURIComponent(apiKey)}`

  console.log(`[cron-healup-citas-manana] Disparando ${endpoint.replace(apiKey, '***')}`)

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { 'User-Agent': 'netlify-scheduled-function' }
    })
    const bodyText = await resp.text()
    let parsed: any = bodyText
    try { parsed = JSON.parse(bodyText) } catch { /* keep as text */ }

    console.log(
      `[cron-healup-citas-manana] HTTP ${resp.status} | ` +
      `status=${parsed?.status} citas=${parsed?.citas_count} duración=${parsed?.duracion_ms}ms`
    )

    if (!resp.ok) {
      console.error('[cron-healup-citas-manana] Endpoint devolvió error:', bodyText)
      return new Response(`Endpoint error: ${resp.status}`, { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, response: parsed }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    console.error('[cron-healup-citas-manana] Excepción llamando al endpoint:', e?.message || e)
    return new Response(`Exception: ${e?.message || e}`, { status: 500 })
  }
}

// Schedule: cron expression (UTC). "0 0 * * *" = 00:00 UTC = 19:00 Lima
export const config = {
  schedule: '0 0 * * *'
}
