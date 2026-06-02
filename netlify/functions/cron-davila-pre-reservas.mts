/**
 * Netlify Scheduled Function — limpieza de pre-reservas expiradas de Miguel Davila.
 *
 * Se ejecuta cada 15 minutos. Llama al endpoint del dashboard, que:
 *   1. Busca pre-reservas en estado 'pre_reservado' con expires_at vencido
 *   2. Elimina su evento de Google Calendar (libera el horario)
 *   3. Las marca como 'expirado'
 *
 * Variables de entorno requeridas en Netlify:
 *   DAVILA_PRE_RESERVA_CRON_KEY  — clave (o reusa HEALUP_AGENDAMIENTO_CRON_KEY)
 *   URL                          — Netlify la inyecta automáticamente
 */

export default async () => {
  const siteUrl = Netlify.env.get('URL') || Netlify.env.get('DEPLOY_URL') || ''
  const apiKey =
    Netlify.env.get('DAVILA_PRE_RESERVA_CRON_KEY') ||
    Netlify.env.get('HEALUP_AGENDAMIENTO_CRON_KEY') ||
    ''

  if (!siteUrl) {
    console.error('[cron-davila-pre-reservas] No se pudo resolver la URL del site')
    return new Response('Missing site URL', { status: 500 })
  }
  if (!apiKey) {
    console.error('[cron-davila-pre-reservas] Falta DAVILA_PRE_RESERVA_CRON_KEY / HEALUP_AGENDAMIENTO_CRON_KEY')
    return new Response('Missing cron key', { status: 500 })
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/davila/pre-reserva-cron?api_key=${encodeURIComponent(apiKey)}`
  console.log(`[cron-davila-pre-reservas] Disparando ${endpoint.replace(apiKey, '***')}`)

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: { 'User-Agent': 'netlify-scheduled-function' },
    })
    const bodyText = await resp.text()
    let parsed: any = bodyText
    try { parsed = JSON.parse(bodyText) } catch { /* keep text */ }

    console.log(`[cron-davila-pre-reservas] HTTP ${resp.status} | procesadas=${parsed?.procesadas}`)

    if (!resp.ok) {
      console.error('[cron-davila-pre-reservas] Endpoint error:', bodyText)
      return new Response(`Endpoint error: ${resp.status}`, { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true, response: parsed }, null, 2), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[cron-davila-pre-reservas] Excepción:', e?.message || e)
    return new Response(`Exception: ${e?.message || e}`, { status: 500 })
  }
}

// Cada 15 minutos
export const config = {
  schedule: '*/15 * * * *'
}
