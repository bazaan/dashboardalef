/**
 * POST /api/gatwick/descontar-stock
 *
 * Proxy server-side que dispara el webhook de n8n "Gatwick · 2 · Descuento de
 * stock al cerrar informe". Se llama desde el dashboard de Gatwick cuando una
 * intervención se marca como "completada" con materiales utilizados.
 *
 * Hacerlo server-side evita problemas de CORS y mantiene la URL del webhook en
 * variable de entorno. El descuento de stock real (informe_materiales +
 * movimientos_inventario + update de componentes) lo ejecuta el flujo n8n.
 *
 * Body: { numero_informe: string, materiales: [{ componente_id, cantidad }], usuario?: string }
 *
 * IMPORTANTE: el flujo n8n debe estar ACTIVADO para que la Production URL
 * responda (en modo test solo escucha una ejecución a la vez).
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.numero_informe || !Array.isArray(body?.materiales) || body.materiales.length === 0) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Falta numero_informe o materiales' }
  }

  const webhookUrl =
    process.env.N8N_WEBHOOK_GATWICK_INFORME ||
    'https://acwebhook.alefcompany.online/webhook/gatwick-informe-materiales'

  try {
    const res = await $fetch(webhookUrl, {
      method: 'POST',
      body: {
        numero_informe: String(body.numero_informe),
        materiales: body.materiales.map((m: any) => ({
          componente_id: m.componente_id,
          cantidad: Number(m.cantidad || 0),
        })),
        usuario: body.usuario || 'dashboard',
      },
    })
    return { success: true, n8n: res }
  } catch (e: any) {
    setResponseStatus(event, 502)
    return {
      success: false,
      error: 'No se pudo contactar el webhook de n8n. ¿Está activado el flujo 2?',
      detail: e?.message || String(e),
    }
  }
})
