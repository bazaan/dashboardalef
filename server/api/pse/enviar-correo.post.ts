/**
 * POST /api/pse/enviar-correo
 *
 * Envía el comprobante electrónico por correo al cliente.
 *
 * Body:
 * {
 *   comprobante_id?: string   // si viene, actualiza histórico en Supabase
 *   company_id:      string   // 'estasconsuerte' | 'healup' | ...
 *   to:              string | string[]    // destinatarios
 *   tipo_de_comprobante: number
 *   serie:           string
 *   numero:          number
 *   cliente_denominacion: string
 *   total:           number
 *   moneda:          number   // 1 PEN, 2 USD, ...
 *   enlace:          string   // consulta pública
 *   enlace_del_pdf:  string
 *   enlace_del_xml:  string
 *   enlace_del_cdr:  string
 *   mensaje_extra?:  string
 * }
 *
 * Proveedor: Resend (API REST, sin dependencias).
 * Variables de entorno requeridas:
 *   - RESEND_API_KEY         (obligatoria para enviar)
 *   - RESEND_FROM            (ej: "Alef Company <no-reply@tudominio.com>")
 *
 * Si RESEND_API_KEY no está configurada, el endpoint responde 501 con un
 * mensaje explícito en lugar de fingir éxito.
 */

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

interface EnviarCorreoBody {
  comprobante_id?: string
  company_id: string
  to: string | string[]
  tipo_de_comprobante: number
  serie: string
  numero: number
  cliente_denominacion?: string
  total?: number
  moneda?: number
  enlace?: string
  enlace_del_pdf?: string
  enlace_del_xml?: string
  enlace_del_cdr?: string
  mensaje_extra?: string
}

const LABEL_TIPO: Record<number, string> = {
  1: 'Factura Electrónica',
  2: 'Boleta de Venta Electrónica',
  3: 'Nota de Crédito Electrónica',
  4: 'Nota de Débito Electrónica'
}

const LABEL_MONEDA: Record<number, string> = {
  1: 'S/', 2: '$', 3: '€', 4: '£'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<EnviarCorreoBody>(event)

  if (!body?.to || !body?.serie || !body?.numero) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos obligatorios: to, serie, numero' })
  }

  const destinos = Array.isArray(body.to)
    ? body.to.map(x => String(x).trim()).filter(Boolean)
    : String(body.to).split(/[,;]/).map(x => x.trim()).filter(Boolean)

  if (destinos.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay destinatarios válidos' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM || 'Alef Company <onboarding@resend.dev>'

  if (!apiKey) {
    throw createError({
      statusCode: 501,
      statusMessage:
        'Envío de correo no configurado. Define RESEND_API_KEY y RESEND_FROM en el .env ' +
        'del servidor para habilitar el envío automático.'
    })
  }

  const tipoLabel = LABEL_TIPO[body.tipo_de_comprobante] || 'Comprobante Electrónico'
  const monSim    = LABEL_MONEDA[body.moneda || 1] || 'S/'
  const totalFmt  = Number(body.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const asunto    = `${tipoLabel} ${body.serie}-${String(body.numero).padStart(8, '0')}`

  // HTML limpio y compatible con la mayoría de clientes de correo
  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:28px 32px;color:#fff;">
            <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">${tipoLabel}</div>
            <div style="font-size:24px;font-weight:700;margin-top:4px;">${body.serie}-${String(body.numero).padStart(8, '0')}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;color:#1f2937;">
            <p style="margin:0 0 12px;">Estimado(a) <strong>${body.cliente_denominacion || 'cliente'}</strong>,</p>
            <p style="margin:0 0 16px;">Adjuntamos los enlaces de su comprobante electrónico. El mismo ya ha sido declarado ante la SUNAT.</p>

            <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:16px 0;">
              <tr>
                <td style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Total a pagar</td>
                <td align="right" style="font-size:22px;font-weight:700;color:#4f46e5;">${monSim} ${totalFmt}</td>
              </tr>
            </table>

            <div style="margin:20px 0 8px;text-align:center;">
              ${body.enlace_del_pdf ? `<a href="${body.enlace_del_pdf}" style="display:inline-block;margin:4px;padding:10px 18px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">📄 Ver PDF</a>` : ''}
              ${body.enlace_del_xml ? `<a href="${body.enlace_del_xml}" style="display:inline-block;margin:4px;padding:10px 18px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">📑 Ver XML</a>` : ''}
              ${body.enlace_del_cdr ? `<a href="${body.enlace_del_cdr}" style="display:inline-block;margin:4px;padding:10px 18px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">✔ CDR SUNAT</a>` : ''}
              ${body.enlace         ? `<a href="${body.enlace}"         style="display:inline-block;margin:4px;padding:10px 18px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">🔍 Consulta Pública</a>` : ''}
            </div>

            ${body.mensaje_extra ? `<p style="margin:18px 0 0;padding:14px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;color:#78350f;font-size:14px;">${body.mensaje_extra}</p>` : ''}

            <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Gracias por su compra.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
            Este es un mensaje automático generado por Alef Company · no responder.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const texto = `${tipoLabel} ${body.serie}-${String(body.numero).padStart(8, '0')}
Cliente: ${body.cliente_denominacion || ''}
Total: ${monSim} ${totalFmt}

PDF:              ${body.enlace_del_pdf || '—'}
XML:              ${body.enlace_del_xml || '—'}
CDR SUNAT:        ${body.enlace_del_cdr || '—'}
Consulta pública: ${body.enlace         || '—'}

${body.mensaje_extra || ''}

Gracias por su compra.`

  try {
    const resp = await $fetch<any>('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json'
      },
      body: {
        from,
        to:      destinos,
        subject: asunto,
        html,
        text:    texto
      }
    })

    console.log('[PSE][Email] enviado a', destinos.join(','), '→ id:', resp?.id)

    // ── Actualizar histórico en Supabase si tenemos el id ──
    if (body.comprobante_id) {
      try {
        let supabase: any
        try {
          supabase = serverSupabaseServiceRole(event)
        } catch {
          supabase = await serverSupabaseClient(event)
        }
        const { data: existing } = await supabase
          .from('comprobantes_pse')
          .select('correo_enviado_a')
          .eq('id', body.comprobante_id)
          .single()

        const historial = Array.isArray(existing?.correo_enviado_a) ? existing!.correo_enviado_a : []
        const nuevo     = Array.from(new Set([...historial, ...destinos]))

        await supabase
          .from('comprobantes_pse')
          .update({
            correo_enviado_a:    nuevo,
            ultimo_envio_correo: new Date().toISOString()
          })
          .eq('id', body.comprobante_id)
      } catch (e: any) {
        console.error('[PSE][Email] no pudo actualizar histórico:', e?.message)
      }
    }

    return {
      ok: true,
      id: resp?.id,
      destinatarios: destinos
    }
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    console.error('[PSE][Email] Error Resend:', detail)
    const mensaje = detail?.message || detail?.error || (typeof detail === 'string' ? detail : 'Error enviando correo')
    throw createError({
      statusCode: err?.status || 500,
      statusMessage: `Resend: ${mensaje}`
    })
  }
})
