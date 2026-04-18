/**
 * POST /api/healup/boleta-auto
 *
 * Endpoint para n8n: genera automáticamente la boleta de consulta (S/50)
 * cuando el agente de WhatsApp confirma una cita y el paciente paga.
 *
 * n8n llama este endpoint después de crear el evento en healup_calendar_events.
 * Retorna los datos de la boleta (PDF, serie, número) para que n8n
 * envíe la boleta al paciente por WhatsApp.
 *
 * Body:
 * {
 *   api_key:         string,   — clave de autenticación (env: HEALUP_BOLETA_AUTO_KEY)
 *   event_id?:       number,   — ID del evento en healup_calendar_events (para trazabilidad)
 *   client_name:     string,
 *   client_surname?: string,
 *   client_dni?:     string,
 *   client_phone?:   string,
 *   client_email?:   string,
 * }
 *
 * Response exitosa:
 * {
 *   success:     true,
 *   serie:       "B001",
 *   numero:      123,
 *   total:       50.00,
 *   enlace_pdf:  "https://...",
 *   enlace:      "https://...",   — consulta SUNAT
 *   mensaje_wpp: "📄 Boleta de Consulta — Heal Up Lab\n..."  — texto listo para WhatsApp
 * }
 *
 * Variables de entorno:
 *   HEALUP_BOLETA_AUTO_KEY — clave para autenticar llamadas de n8n
 */

import { serverSupabaseServiceRole } from '#supabase/server'

/* ─── Config de Healup en PSE.PE ─────────────────── */
const HEALUP_PSE = {
  ruc: '20615088111',
  razon_social: 'HEAL UP LAB S.A.C.',
  url: 'https://api.pse.pe/api/v1/b3a349e648c543088a5e807bd36c4337b261a1b468974863ba49762bd2dd3600',
  token: 'eyJhbGciOiJIUzI1NiJ9.ImRkMThkNTFiOGExZjQ4NmI5MmRjMmU5MTU2MjRiMGRhZDI2MDkyYTM2YTQ0NDUzMGI4N2JhM2UwNTczNzAzZjki.ZZaYzBkK7ezOHq1hnupbqbrEAonHKpoIGkj9qi5w1pA'
}

/* ─── Constantes de la consulta ──────────────────── */
const CONSULTA_VALOR_UNIT = 42.37  // 50 / 1.18
const CONSULTA_IGV = 7.63         // 50 - 42.37
const CONSULTA_TOTAL = 50.00
const SERIE = 'B001'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // ── Autenticación ──
  const apiKey = process.env.HEALUP_BOLETA_AUTO_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'HEALUP_BOLETA_AUTO_KEY no configurado en .env' })
  }
  if (body?.api_key !== apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // ── Validación ──
  if (!body?.client_name) {
    throw createError({ statusCode: 400, statusMessage: 'client_name es requerido' })
  }

  const clientName = (body.client_name || '').trim()
  const clientSurname = (body.client_surname || '').trim()
  const fullName = [clientName, clientSurname].filter(Boolean).join(' ') || 'CONSUMIDOR FINAL'
  const clientDni = (body.client_dni || '').trim()
  const clientPhone = (body.client_phone || '').trim()
  const clientEmail = (body.client_email || '').trim()
  const eventId = body.event_id ? Number(body.event_id) : null

  const supabase = serverSupabaseServiceRole(event)

  // ── Verificar que no se haya emitido ya (si hay event_id) ──
  if (eventId) {
    const { data: existing } = await supabase
      .from('healup_calendar_events')
      .select('boleta_consulta_numero')
      .eq('id', eventId)
      .maybeSingle()

    if (existing?.boleta_consulta_numero) {
      console.log(`[BoletaAuto] Ya emitida para event_id=${eventId}: B001-${existing.boleta_consulta_numero}`)
      // Buscar datos de la boleta existente
      const { data: comp } = await supabase
        .from('comprobantes_pse')
        .select('enlace_del_pdf, enlace')
        .eq('company_id', 'healup')
        .eq('serie', SERIE)
        .eq('numero', existing.boleta_consulta_numero)
        .maybeSingle()

      return {
        success: true,
        ya_emitida: true,
        serie: SERIE,
        numero: existing.boleta_consulta_numero,
        total: CONSULTA_TOTAL,
        enlace_pdf: comp?.enlace_del_pdf || null,
        enlace: comp?.enlace || null,
        mensaje_wpp: buildMensajeWpp(SERIE, existing.boleta_consulta_numero, fullName, CONSULTA_TOTAL, comp?.enlace_del_pdf)
      }
    }
  }

  // ── Obtener siguiente número de boleta ──
  const { data: lastBoleta } = await supabase
    .from('comprobantes_pse')
    .select('numero')
    .eq('company_id', 'healup')
    .eq('tipo_de_comprobante', 2)
    .eq('serie', SERIE)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const numero = (lastBoleta?.numero || 0) + 1

  // ── Fecha de emisión ──
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fechaEmision = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`
  const fechaISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  // ── Calcular campos del ítem ──
  const precioUnitario = +(CONSULTA_VALOR_UNIT * 1.18).toFixed(6) // 49.9966

  // ── Payload PSE.PE / NubeFact ──
  const facturaPayload = {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: 2,
    serie: SERIE,
    numero,
    fecha_de_emision: fechaEmision,
    moneda: 1,
    sunat_transaction: 1,
    porcentaje_de_igv: 18.00,
    formato_de_pdf: 'A4',
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    cliente_tipo_de_documento: clientDni ? 1 : '-',
    cliente_numero_de_documento: clientDni || '00000000',
    cliente_denominacion: fullName,
    cliente_email: clientEmail || '',
    total_gravada: CONSULTA_VALOR_UNIT,
    total_igv: CONSULTA_IGV,
    total: CONSULTA_TOTAL,
    items: [{
      unidad_de_medida: 'ZZ',
      codigo: 'CON-001',
      descripcion: 'Consulta Médica',
      cantidad: 1,
      valor_unitario: CONSULTA_VALOR_UNIT,
      precio_unitario: precioUnitario,
      tipo_de_igv: 1,
      subtotal: CONSULTA_VALOR_UNIT,
      igv: CONSULTA_IGV,
      total: CONSULTA_TOTAL
    }]
  }

  // ── Emitir boleta via PSE.PE ──
  let response: any
  try {
    response = await $fetch(HEALUP_PSE.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': HEALUP_PSE.token
      },
      body: facturaPayload
    })
    console.log(`[BoletaAuto] Emitida: ${SERIE}-${numero} para ${fullName} — SUNAT:`, response?.aceptada_por_sunat)
  } catch (err: any) {
    const detail = err?.data ?? err?.message ?? err
    console.error('[BoletaAuto] Error PSE:', detail)
    throw createError({
      statusCode: 502,
      statusMessage: `Error al emitir boleta: ${typeof detail === 'string' ? detail : (detail?.errors || detail?.message || 'Error PSE.PE')}`
    })
  }

  // ── Guardar en comprobantes_pse ──
  let comprobanteId: number | null = null
  try {
    const { data: inserted, error: dbErr } = await supabase
      .from('comprobantes_pse')
      .upsert({
        emitido_por: 'n8n-auto',
        company_id: 'healup',
        ruc_emisor: HEALUP_PSE.ruc,
        razon_social_emisor: HEALUP_PSE.razon_social,
        demo: false,
        tipo_de_comprobante: 2,
        serie: SERIE,
        numero,
        sunat_transaction: 1,
        fecha_de_emision: fechaISO,
        cliente_tipo_de_documento: clientDni ? '1' : '-',
        cliente_numero_de_documento: clientDni || '00000000',
        cliente_denominacion: fullName,
        cliente_email: clientEmail || null,
        moneda: 1,
        porcentaje_de_igv: 18,
        total_gravada: CONSULTA_VALOR_UNIT,
        total_igv: CONSULTA_IGV,
        total: CONSULTA_TOTAL,
        formato_de_pdf: 'A4',
        aceptada_por_sunat: !!response?.aceptada_por_sunat,
        sunat_description: response?.sunat_description || null,
        codigo_hash: response?.codigo_hash || null,
        enlace: response?.enlace || null,
        enlace_del_pdf: response?.enlace_del_pdf || null,
        enlace_del_xml: response?.enlace_del_xml || null,
        enlace_del_cdr: response?.enlace_del_cdr || null,
        items: facturaPayload.items,
        payload_enviado: facturaPayload,
        respuesta_completa: response
      }, { onConflict: 'company_id,tipo_de_comprobante,serie,numero' })
      .select('id')
      .single()

    if (dbErr) {
      console.error('[BoletaAuto] Error guardando:', dbErr.message)
    } else {
      comprobanteId = inserted?.id || null
      console.log(`[BoletaAuto] Guardada en comprobantes_pse: id=${comprobanteId}`)
    }
  } catch (e: any) {
    console.error('[BoletaAuto] Excepción guardando:', e?.message)
  }

  // ── Trazabilidad en el evento del calendario ──
  if (eventId) {
    try {
      await supabase.from('healup_calendar_events').update({
        boleta_consulta_serie: SERIE,
        boleta_consulta_numero: numero,
        boleta_consulta_id: comprobanteId
      }).eq('id', eventId)
      console.log(`[BoletaAuto] Trazabilidad actualizada en event_id=${eventId}`)
    } catch (e: any) {
      console.error('[BoletaAuto] Error actualizando trazabilidad:', e?.message)
    }
  }

  // ── Response para n8n ──
  const enlacePdf = response?.enlace_del_pdf || null
  const enlace = response?.enlace || null
  const bNum = String(numero).padStart(8, '0')

  return {
    success: true,
    ya_emitida: false,
    serie: SERIE,
    numero,
    numero_formateado: `${SERIE}-${bNum}`,
    total: CONSULTA_TOTAL,
    enlace_pdf: enlacePdf,
    enlace: enlace,
    aceptada_por_sunat: !!response?.aceptada_por_sunat,
    comprobante_id: comprobanteId,
    mensaje_wpp: buildMensajeWpp(SERIE, numero, fullName, CONSULTA_TOTAL, enlacePdf, enlace)
  }
})

/* ─── Helper: mensaje listo para WhatsApp ────────── */
function buildMensajeWpp(serie: string, numero: number, nombre: string, total: number, pdfUrl?: string | null, enlace?: string | null): string {
  const bNum = String(numero).padStart(8, '0')
  const totalFmt = total.toLocaleString('es-PE', { minimumFractionDigits: 2 })
  return [
    `*Boleta de Consulta — Heal Up Lab*`,
    `📄 ${serie}-${bNum}`,
    `👤 ${nombre}`,
    `💰 Total: S/ ${totalFmt}`,
    pdfUrl ? `\n📎 *Ver PDF:* ${pdfUrl}` : '',
    enlace ? `🔍 *Consulta SUNAT:* ${enlace}` : '',
    '\n_Emitido electrónicamente. Este comprobante es válido ante SUNAT._'
  ].filter(Boolean).join('\n')
}
