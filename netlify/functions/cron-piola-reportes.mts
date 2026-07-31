/**
 * Netlify Scheduled Function — reportes automáticos de Piola (§9).
 *
 * Corre todos los días a las 14:00 UTC (= 09:00 hora Lima). El endpoint decide
 * cuáles TOCAN hoy según la frecuencia configurada en piola_scheduled_reports
 * (semanal / quincenal / mensual + día de ejecución), así que agregar o mover
 * un reporte NO requiere tocar este archivo ni redeployar.
 *
 * Reportes: producción por marca, ventas del mes y financiero de cierre.
 *
 * Variables de entorno en Netlify:
 *   PIOLA_CRON_KEY  — clave compartida con el endpoint Nuxt
 *   URL             — la inyecta Netlify con la URL del site
 */

export default async () => {
  const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_URL') || ''
  const apiKey = Netlify.env.get('PIOLA_CRON_KEY') || ''

  if (!siteUrl) {
    console.error('[cron-piola-reportes] No se pudo resolver la URL del site (Netlify URL/DEPLOY_URL)')
    return new Response('Missing site URL', { status: 500 })
  }
  if (!apiKey) {
    console.error('[cron-piola-reportes] PIOLA_CRON_KEY no está seteada en Netlify')
    return new Response('Missing PIOLA_CRON_KEY', { status: 500 })
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/piola/reportes?run=1&api_key=${encodeURIComponent(apiKey)}`
  console.log(`[cron-piola-reportes] Disparando ${endpoint.replace(apiKey, '***')}`)

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { 'User-Agent': 'netlify-scheduled-function' },
    })
    const bodyText = await resp.text()
    let parsed: any = bodyText
    try { parsed = JSON.parse(bodyText) } catch { /* keep as text */ }

    console.log(`[cron-piola-reportes] HTTP ${resp.status} | ejecutados=${parsed?.ejecutados}`)

    if (!resp.ok) {
      console.error('[cron-piola-reportes] Endpoint devolvió error:', bodyText)
      return new Response(`Endpoint error: ${resp.status}`, { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, response: parsed }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[cron-piola-reportes] Excepción llamando al endpoint:', e?.message || e)
    return new Response(`Exception: ${e?.message || e}`, { status: 500 })
  }
}

// 14:00 UTC = 09:00 Lima
export const config = {
  schedule: '0 14 * * *',
}
