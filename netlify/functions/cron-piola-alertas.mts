/**
 * Netlify Scheduled Function — motor de alertas de Piola (§4).
 *
 * Corre todos los días a las 13:00 UTC (= 08:00 hora Lima, UTC-5): a primera
 * hora del día laboral, que es cuando el aviso de WhatsApp sirve de algo.
 *
 * Solo llama al endpoint del dashboard; toda la lógica vive ahí:
 *   1. Detecta facturas por vencer/emitir, contratos por renovar, leads sin
 *      seguimiento, entregables por vencer y comisiones por pagar
 *   2. Guarda las alertas NUEVAS (no repite las ya avisadas)
 *   3. Las manda por WhatsApp vía el webhook n8n de Piola
 *
 * Variables de entorno en Netlify:
 *   PIOLA_CRON_KEY  — clave compartida con el endpoint Nuxt
 *   URL             — la inyecta Netlify con la URL del site
 */

export default async () => {
  const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_URL') || ''
  const apiKey = Netlify.env.get('PIOLA_CRON_KEY') || ''

  if (!siteUrl) {
    console.error('[cron-piola-alertas] No se pudo resolver la URL del site (Netlify URL/DEPLOY_URL)')
    return new Response('Missing site URL', { status: 500 })
  }
  if (!apiKey) {
    console.error('[cron-piola-alertas] PIOLA_CRON_KEY no está seteada en Netlify')
    return new Response('Missing PIOLA_CRON_KEY', { status: 500 })
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/piola/alertas?run=1&api_key=${encodeURIComponent(apiKey)}`
  console.log(`[cron-piola-alertas] Disparando ${endpoint.replace(apiKey, '***')}`)

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { 'User-Agent': 'netlify-scheduled-function' },
    })
    const bodyText = await resp.text()
    let parsed: any = bodyText
    try { parsed = JSON.parse(bodyText) } catch { /* keep as text */ }

    console.log(
      `[cron-piola-alertas] HTTP ${resp.status} | detectadas=${parsed?.generadas} `
      + `nuevas=${parsed?.nuevas} enviadas=${parsed?.enviadas} duración=${parsed?.duracion_ms}ms`
    )

    if (!resp.ok) {
      console.error('[cron-piola-alertas] Endpoint devolvió error:', bodyText)
      return new Response(`Endpoint error: ${resp.status}`, { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, response: parsed }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[cron-piola-alertas] Excepción llamando al endpoint:', e?.message || e)
    return new Response(`Exception: ${e?.message || e}`, { status: 500 })
  }
}

// 13:00 UTC = 08:00 Lima
export const config = {
  schedule: '0 13 * * *',
}
