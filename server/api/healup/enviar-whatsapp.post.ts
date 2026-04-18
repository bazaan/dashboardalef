/**
 * POST /api/healup/enviar-whatsapp
 *
 * Envía notificación de boleta al paciente por WhatsApp via n8n webhook.
 *
 * Body:
 * {
 *   phone:         string,   — número con o sin prefijo 51 (9 u 11 dígitos)
 *   patient_name:  string,
 *   boleta_serie:  string,   — ej: "B001"
 *   boleta_numero: number,
 *   total:         number,
 *   tipo:          string,   — 'consulta' | 'procedimiento'
 *   pdf_url?:      string,
 *   enlace?:       string,   — URL de consulta pública SUNAT
 * }
 *
 * Variable de entorno requerida:
 *   N8N_WEBHOOK_HEALUP_BOLETA — URL del webhook n8n que procesa el envío
 *
 * Si no está configurada responde 501 con instrucciones claras.
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.phone || !body?.boleta_numero) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos obligatorios: phone, boleta_numero' })
  }

  const webhookUrl = process.env.N8N_WEBHOOK_HEALUP_BOLETA

  if (!webhookUrl) {
    throw createError({
      statusCode: 501,
      statusMessage:
        'Envío por WhatsApp no configurado. Define N8N_WEBHOOK_HEALUP_BOLETA en el .env del servidor.'
    })
  }

  // Normalizar teléfono: agregar 51 si solo tiene 9 dígitos
  let phone = String(body.phone).replace(/\D/g, '')
  if (phone.length === 9) phone = '51' + phone

  const tipoLabel = body.tipo === 'consulta' ? 'Boleta de Consulta' : 'Boleta de Procedimiento'
  const totalFmt  = Number(body.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })
  const bNum      = String(body.boleta_numero).padStart(8, '0')

  const mensaje = [
    `*${tipoLabel} — Heal Up Lab*`,
    `📄 ${body.boleta_serie}-${bNum}`,
    `👤 ${body.patient_name || 'Paciente'}`,
    `💰 Total: S/ ${totalFmt}`,
    body.pdf_url ? `\n📎 *Ver PDF:* ${body.pdf_url}` : '',
    body.enlace  ? `🔍 *Consulta SUNAT:* ${body.enlace}` : '',
    '\n_Emitido electrónicamente. Este comprobante es válido ante SUNAT._'
  ].filter(Boolean).join('\n')

  try {
    await $fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        phone,
        mensaje,
        tipo:          'boleta_notificacion',
        patient_name:  body.patient_name,
        boleta_serie:  body.boleta_serie,
        boleta_numero: body.boleta_numero,
        total:         body.total,
        pdf_url:       body.pdf_url  || null,
        enlace:        body.enlace   || null
      }
    })

    console.log('[WhatsApp] enviado a', phone, `boleta ${body.boleta_serie}-${bNum}`)
    return { ok: true, phone, boleta: `${body.boleta_serie}-${bNum}` }

  } catch (err: any) {
    const detail = err?.data ?? err?.message ?? err
    console.error('[WhatsApp] Error n8n:', detail)
    throw createError({
      statusCode: err?.status || 500,
      statusMessage: `Error al enviar WhatsApp: ${
        typeof detail === 'string' ? detail : (detail?.message || 'Error desconocido')
      }`
    })
  }
})
