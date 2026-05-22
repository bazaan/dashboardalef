/**
 * POST /api/pse/boleta-consulta
 *
 * Endpoint GENÉRICO para n8n: genera automáticamente la boleta de consulta
 * cuando el agente de WhatsApp confirma una cita.
 *
 * Diseñado para funcionar con CUALQUIER clínica registrada en PSE.PE.
 * n8n solo cambia el company_id en el body.
 *
 * Body:
 * {
 *   api_key:         string,   — clave de autenticación (env: BOLETA_CONSULTA_API_KEY)
 *   company_id:      string,   — identificador de la clínica (healup, estetikamedika, davila, etc.)
 *   event_id?:       number,   — ID del evento en la tabla de calendar_events (para trazabilidad)
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
 *   company_id:  "healup",
 *   serie:       "B001",
 *   numero:      123,
 *   total:       50.00,
 *   enlace_pdf:  "https://...",
 *   enlace:      "https://...",
 *   mensaje_wpp: "📄 Boleta de Consulta — Heal Up Lab\n..."
 * }
 *
 * Variables de entorno:
 *   BOLETA_CONSULTA_API_KEY — clave para autenticar llamadas de n8n
 */

import { serverSupabaseServiceRole } from '#supabase/server'

/* ─── Configuración por clínica ─────────────────── */

interface ClinicConfig {
  /** Nombre comercial para mostrar en la boleta y mensaje WhatsApp */
  display_name: string
  /** RUC de la empresa */
  ruc: string
  /** Razón social registrada en SUNAT */
  razon_social: string
  /** URL del endpoint PSE.PE de esta empresa */
  pse_url: string
  /** JWT token de PSE.PE para esta empresa */
  pse_token: string
  /** Nombre de la tabla de calendar_events en Supabase */
  calendar_table: string
  /** Precio de consulta en soles (con IGV) — por defecto 50 */
  consulta_precio?: number
  /** Serie de boleta — por defecto B001 */
  serie?: string
}

const CLINICAS: Record<string, ClinicConfig> = {
  healup: {
    display_name: 'Heal Up Lab',
    ruc: '20615088111',
    razon_social: 'HEAL UP LAB S.A.C.',
    pse_url: 'https://api.pse.pe/api/v1/b3a349e648c543088a5e807bd36c4337b261a1b468974863ba49762bd2dd3600',
    pse_token: 'eyJhbGciOiJIUzI1NiJ9.ImRkMThkNTFiOGExZjQ4NmI5MmRjMmU5MTU2MjRiMGRhZDI2MDkyYTM2YTQ0NDUzMGI4N2JhM2UwNTczNzAzZjki.ZZaYzBkK7ezOHq1hnupbqbrEAonHKpoIGkj9qi5w1pA',
    calendar_table: 'healup_calendar_events',
  },
  // Agregar más clínicas aquí cuando se registren en PSE.PE:
  // estetikamedika: {
  //   display_name: 'Estetika Medika',
  //   ruc: '...',
  //   razon_social: '...',
  //   pse_url: '...',
  //   pse_token: '...',
  //   calendar_table: 'EstetikaMedika_calendar_events',
  // },
  // davila: {
  //   display_name: 'Dr. Miguel Dávila',
  //   ruc: '...',
  //   razon_social: '...',
  //   pse_url: '...',
  //   pse_token: '...',
  //   calendar_table: 'DAVILA_calendar_events',
  // },
}

/* ─── Constantes ────────────────────────────────── */
const DEFAULT_PRECIO_CONSULTA = 50.00
const DEFAULT_SERIE = 'B001'

function calcularMontos(precioConIgv: number) {
  const valorUnit = +(precioConIgv / 1.18).toFixed(2)
  const igv = +(precioConIgv - valorUnit).toFixed(2)
  const precioUnitario = +(valorUnit * 1.18).toFixed(6)
  return { valorUnit, igv, total: precioConIgv, precioUnitario }
}

export default defineEventHandler(async (event) => {
  let body: any
  try {
    body = await readBody(event)
  } catch (e: any) {
    return { success: false, error: 'No se pudo leer el body', detail: e?.message }
  }

  // ── Autenticación ──
  const apiKey = process.env.BOLETA_CONSULTA_API_KEY || 'boleta-consulta-alef-2026'
  if (body?.api_key !== apiKey) {
    return { success: false, error: 'API key inválida', recibida: body?.api_key ? '(presente pero incorrecta)' : '(no enviada)' }
  }

  // ── Validación de company_id ──
  if (!body?.company_id) {
    return { success: false, error: 'company_id es requerido' }
  }

  const companyKey = body.company_id.toLowerCase().replace(/\s/g, '')
  const clinica = CLINICAS[companyKey]
  if (!clinica) {
    const disponibles = Object.keys(CLINICAS).join(', ')
    return { success: false, error: `Clínica '${body.company_id}' no registrada en PSE.PE. Disponibles: ${disponibles}` }
  }

  // ── Validación de datos del cliente ──
  if (!body?.client_name) {
    return { success: false, error: 'client_name es requerido' }
  }

  const clientName = (body.client_name || '').trim()
  const clientSurname = (body.client_surname || '').trim()
  const fullName = [clientName, clientSurname].filter(Boolean).join(' ') || 'CONSUMIDOR FINAL'
  const clientDni = (body.client_dni || '').trim()
  const clientPhone = (body.client_phone || '').trim()
  const clientEmail = (body.client_email || '').trim()
  const eventId = body.event_id ? Number(body.event_id) : null

  const serie = clinica.serie || DEFAULT_SERIE
  const precioConsulta = clinica.consulta_precio || DEFAULT_PRECIO_CONSULTA
  const montos = calcularMontos(precioConsulta)

  let supabase: any
  try {
    supabase = serverSupabaseServiceRole(event)
  } catch (e: any) {
    return { success: false, error: 'Error inicializando Supabase', detail: e?.message }
  }

  // ── Verificar que no se haya emitido ya (si hay event_id) ──
  try {
  if (eventId) {
    const { data: existing, error: existErr } = await supabase
      .from(clinica.calendar_table)
      .select('boleta_consulta_numero')
      .eq('id', eventId)
      .maybeSingle()

    if (existErr) {
      console.error(`[BoletaConsulta][${companyKey}] Error verificando existente:`, existErr.message)
    }

    if (existing?.boleta_consulta_numero) {
      console.log(`[BoletaConsulta][${companyKey}] Ya emitida para event_id=${eventId}: ${serie}-${existing.boleta_consulta_numero}`)

      const { data: comp } = await supabase
        .from('comprobantes_pse')
        .select('enlace_del_pdf, enlace')
        .eq('company_id', companyKey)
        .eq('serie', serie)
        .eq('numero', existing.boleta_consulta_numero)
        .maybeSingle()

      return {
        success: true,
        ya_emitida: true,
        company_id: companyKey,
        serie,
        numero: existing.boleta_consulta_numero,
        total: montos.total,
        enlace_pdf: comp?.enlace_del_pdf || null,
        enlace: comp?.enlace || null,
        mensaje_wpp: buildMensajeWpp(clinica.display_name, serie, existing.boleta_consulta_numero, fullName, montos.total, comp?.enlace_del_pdf, comp?.enlace)
      }
    }
  }

  // ── Obtener siguiente número de boleta ──
  const { data: lastBoleta, error: lastErr } = await supabase
    .from('comprobantes_pse')
    .select('numero')
    .eq('company_id', companyKey)
    .eq('tipo_de_comprobante', 2)
    .eq('serie', serie)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastErr) {
    console.error(`[BoletaConsulta][${companyKey}] Error obteniendo último número:`, lastErr.message)
  }
  const numero = (lastBoleta?.numero || 0) + 1

  // ── Fecha de emisión en hora Perú (UTC-5) ──
  // Vercel corre en UTC; usar new Date() directo entre 19:00–23:59 Lima daría
  // el día siguiente y SUNAT rechaza con "fecha debe ser la de HOY".
  const fechaEmision = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date()).replace(/\//g, '-')
  const fechaISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date())

  // ── Payload PSE.PE ──
  const facturaPayload = {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: 2,
    serie,
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
    total_gravada: montos.valorUnit,
    total_igv: montos.igv,
    total: montos.total,
    items: [{
      unidad_de_medida: 'ZZ',
      codigo: 'CON-001',
      descripcion: 'Consulta Médica',
      cantidad: 1,
      valor_unitario: montos.valorUnit,
      precio_unitario: montos.precioUnitario,
      tipo_de_igv: 1,
      subtotal: montos.valorUnit,
      igv: montos.igv,
      total: montos.total
    }]
  }

  // ── Emitir boleta via PSE.PE ──
  let response: any
  try {
    response = await $fetch(clinica.pse_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': clinica.pse_token
      },
      body: facturaPayload
    })
    console.log(`[BoletaConsulta][${companyKey}] Emitida: ${serie}-${numero} para ${fullName} — SUNAT:`, response?.aceptada_por_sunat)
  } catch (err: any) {
    const detail = err?.data ?? err?.message ?? err
    console.error(`[BoletaConsulta][${companyKey}] Error PSE:`, detail)
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
        company_id: companyKey,
        ruc_emisor: clinica.ruc,
        razon_social_emisor: clinica.razon_social,
        demo: false,
        tipo_de_comprobante: 2,
        serie,
        numero,
        sunat_transaction: 1,
        fecha_de_emision: fechaISO,
        cliente_tipo_de_documento: clientDni ? '1' : '-',
        cliente_numero_de_documento: clientDni || '00000000',
        cliente_denominacion: fullName,
        cliente_email: clientEmail || null,
        moneda: 1,
        porcentaje_de_igv: 18,
        total_gravada: montos.valorUnit,
        total_igv: montos.igv,
        total: montos.total,
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
      console.error(`[BoletaConsulta][${companyKey}] Error guardando:`, dbErr.message)
    } else {
      comprobanteId = inserted?.id || null
      console.log(`[BoletaConsulta][${companyKey}] Guardada en comprobantes_pse: id=${comprobanteId}`)
    }
  } catch (e: any) {
    console.error(`[BoletaConsulta][${companyKey}] Excepción guardando:`, e?.message)
  }

  // ── Trazabilidad en el evento del calendario ──
  if (eventId) {
    try {
      await supabase.from(clinica.calendar_table).update({
        boleta_consulta_serie: serie,
        boleta_consulta_numero: numero,
        boleta_consulta_id: comprobanteId
      }).eq('id', eventId)
      console.log(`[BoletaConsulta][${companyKey}] Trazabilidad actualizada en event_id=${eventId}`)
    } catch (e: any) {
      console.error(`[BoletaConsulta][${companyKey}] Error actualizando trazabilidad:`, e?.message)
    }
  }

  // ── Response para n8n ──
  const enlacePdf = response?.enlace_del_pdf || null
  const enlace = response?.enlace || null
  const bNum = String(numero).padStart(8, '0')

  return {
    success: true,
    ya_emitida: false,
    company_id: companyKey,
    serie,
    numero,
    numero_formateado: `${serie}-${bNum}`,
    total: montos.total,
    enlace_pdf: enlacePdf,
    enlace,
    aceptada_por_sunat: !!response?.aceptada_por_sunat,
    comprobante_id: comprobanteId,
    mensaje_wpp: buildMensajeWpp(clinica.display_name, serie, numero, fullName, montos.total, enlacePdf, enlace)
  }

  } catch (e: any) {
    console.error(`[BoletaConsulta] Error no manejado:`, e?.message || e)
    return { success: false, error: 'Error interno del servidor', detail: e?.message || String(e) }
  }
})

/* ─── Helper: mensaje listo para WhatsApp ────────── */
function buildMensajeWpp(
  clinicName: string,
  serie: string,
  numero: number,
  nombre: string,
  total: number,
  pdfUrl?: string | null,
  enlace?: string | null
): string {
  const bNum = String(numero).padStart(8, '0')
  const totalFmt = total.toLocaleString('es-PE', { minimumFractionDigits: 2 })
  return [
    `*Boleta de Consulta — ${clinicName}*`,
    `📄 ${serie}-${bNum}`,
    `👤 ${nombre}`,
    `💰 Total: S/ ${totalFmt}`,
    pdfUrl ? `\n📎 *Ver PDF:* ${pdfUrl}` : '',
    enlace ? `🔍 *Consulta SUNAT:* ${enlace}` : '',
    '\n_Emitido electrónicamente. Este comprobante es válido ante SUNAT._'
  ].filter(Boolean).join('\n')
}
