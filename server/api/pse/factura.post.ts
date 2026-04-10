/**
 * POST /api/pse/factura
 * Proxy server-side para PSE.PE / NubeFact
 *
 * Referencia: "NUBEFACT DOC API JSON V1" (manual oficial).
 *
 * ARQUITECTURA PSE.PE:
 *   - Endpoint reseller  https://api.pse.pe/api/reseller/v1/<reseller_id>
 *     → solo administra empresas (nueva_empresa, lista_de_empresas, ver_empresa, …)
 *   - Endpoint por empresa  https://api.pse.pe/api/v1/<hex_empresa>
 *     → genera_comprobante / consultar_comprobante / generar_anulacion / …
 *
 * Header de autenticación:
 *     Authorization: <JWT>        ← JWT puro, sin "Bearer" ni "Token token="
 *     Content-Type:  application/json
 *
 * Series en modo DEMO: FPP1 / BPP1 / TPP1 / …  (al pasar a producción ⇒ F001 / B001).
 *
 * Efectos secundarios:
 *   - Después de una emisión aceptada por SUNAT, INSERTA el comprobante
 *     en la tabla `comprobantes_pse` de Supabase con payload y respuesta
 *     completa para auditoría.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

interface EmpresaConfig {
  ruc: string
  razon_social: string
  url: string
  token: string
  demo: boolean
}

const EMPRESAS: Record<string, EmpresaConfig> = {
  estasconsuerte: {
    ruc: '20611950650',
    razon_social: 'ESTAS CON SUERTE S.A.C.',
    url:   'https://api.pse.pe/api/v1/42d38c65df7d465e98b2689e9d70883e7b7f00971afc4cd3b0338368950d1faf',
    token: 'eyJhbGciOiJIUzI1NiJ9.ImRkYTg3MDYwNjljZTRiYjViMGU0YWJkOTJlMzlmYWYyYmUxZjJmMTE4MTY2NGU2NTg0MmQ0NTk3MTJjZmIyYTYi.sF5Tv1kK2XWS63c1pXNTvor5zqyyroPTnxRRCUxeqq4',
    demo: true
  }
  // HEALUP todavía no está registrada en PSE.PE.
}

/**
 * Convierte `YYYY-MM-DD` → `DD-MM-YYYY` (formato que exige NubeFact).
 * Si ya viene en DD-MM-YYYY lo deja. Si viene vacío devuelve hoy.
 */
function toFechaNubefact(v?: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (!v) {
    const d = new Date()
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
  }
  // ISO YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`
  // Ya DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return v
  return v
}

/**
 * Sanitiza el payload que viene del frontend y lo adapta a la doc oficial.
 * Corrige nombres legacy, formato de fecha, tipo de documento del cliente, etc.
 */
function sanitizarPayload(p: any, tipoComprobante: number) {
  const out: any = { ...p }

  // ── Fechas ─────────────────────────────────────────────
  out.fecha_de_emision    = toFechaNubefact(out.fecha_de_emision)
  out.fecha_de_vencimiento = out.fecha_de_vencimiento
    ? toFechaNubefact(out.fecha_de_vencimiento)
    : ''

  // ── Cliente: consumidor final en boleta/nota ───────────
  // Doc: '-' = VARIOS (ventas menores a S/700). '0' = NO DOMICILIADO (export).
  // Si vienen vacíos o con 0 y es boleta/nota de boleta, fuerza '-' + DNI ficticio.
  if (tipoComprobante !== 1) {
    const td  = out.cliente_tipo_de_documento
    const num = (out.cliente_numero_de_documento || '').trim()
    const nom = (out.cliente_denominacion        || '').trim()
    if (!num || td === 0 || td === '0' || td === '' || td === null || td === undefined) {
      out.cliente_tipo_de_documento   = '-'
      out.cliente_numero_de_documento = num || '00000000'
      out.cliente_denominacion        = nom || 'CONSUMIDOR FINAL'
    }
  }
  // Para factura el cliente_direccion es obligatorio → si viene vacío, poner "-"
  if (tipoComprobante === 1 && !out.cliente_direccion) {
    out.cliente_direccion = '-'
  }

  // ── Nombres legacy de campos ───────────────────────────
  if (out.total_impuestos_bolsa_plastica !== undefined) {
    out.total_impuestos_bolsas = out.total_impuestos_bolsa_plastica
    delete out.total_impuestos_bolsa_plastica
  }

  // ── Items: renombrar campos legacy de anticipo ─────────
  if (Array.isArray(out.items)) {
    out.items = out.items.map((it: any) => {
      const nit: any = { ...it }
      if (nit.anticipo_comprobante_serie !== undefined) {
        nit.anticipo_documento_serie = nit.anticipo_comprobante_serie
        delete nit.anticipo_comprobante_serie
      }
      if (nit.anticipo_comprobante_numero !== undefined) {
        nit.anticipo_documento_numero = nit.anticipo_comprobante_numero
        delete nit.anticipo_comprobante_numero
      }
      return nit
    })
  }

  return out
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { company_id, payload } = body

  if (!company_id || !payload) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan company_id o payload' })
  }

  const key = company_id.toLowerCase().replace(/\s/g, '')
  const empresa = EMPRESAS[key]
  if (!empresa) {
    throw createError({
      statusCode: 400,
      statusMessage:
        `Empresa '${company_id}' no está registrada en PSE.PE todavía. ` +
        `Actualmente solo ESTAS CON SUERTE está dada de alta en el reseller.`
    })
  }

  const sanitizado = sanitizarPayload(payload, payload.tipo_de_comprobante)

  const facturaPayload = {
    operacion: 'generar_comprobante',
    ...sanitizado,
    // Overrides finales — estas llaves NO deben ser sobreescribibles
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    porcentaje_de_igv: 18.00
  }

  console.log('[PSE]', empresa.razon_social, '(RUC', empresa.ruc + ')', empresa.demo ? '[DEMO]' : '[PROD]')
  console.log('[PSE] →', facturaPayload.tipo_de_comprobante === 1 ? 'FACTURA' : 'BOLETA',
              facturaPayload.serie + '-' + facturaPayload.numero,
              'fecha:', facturaPayload.fecha_de_emision,
              'total:', facturaPayload.total)

  try {
    const response = await $fetch<any>(empresa.url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json; charset=utf-8',
        'Authorization': empresa.token  // JWT puro, sin prefijo
      },
      body: facturaPayload
    })

    console.log('[PSE] OK:', (response as any)?.serie, (response as any)?.numero,
                'aceptada_por_sunat:', (response as any)?.aceptada_por_sunat)

    // ──────────────────────────────────────────────────────────────────
    // PERSISTENCIA EN SUPABASE (tabla comprobantes_pse)
    // No hacemos throw si falla la inserción: el comprobante ya existe
    // en NubeFact/SUNAT y el usuario debe poder verlo.
    // ──────────────────────────────────────────────────────────────────
    try {
      const supabase = serverSupabaseServiceRole(event)
      const userEmail = getCookie(event, 'dashboard_session')
        ? (() => {
            try {
              const s = JSON.parse(getCookie(event, 'dashboard_session') || '{}')
              return s?.email || null
            } catch { return null }
          })()
        : null

      const toDateIso = (v: any): string | null => {
        if (!v) return null
        // Viene en DD-MM-YYYY desde la sanitización
        const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(v))
        if (m) return `${m[3]}-${m[2]}-${m[1]}`
        return String(v)
      }

      const nz = (v: any) => (v === '' || v === undefined || v === null ? null : v)

      const row = {
        // Meta
        emitido_por:                 userEmail,
        // Emisor
        company_id:                  key,
        ruc_emisor:                  empresa.ruc,
        razon_social_emisor:         empresa.razon_social,
        demo:                        empresa.demo,

        // Identificación
        tipo_de_comprobante:         facturaPayload.tipo_de_comprobante,
        serie:                       facturaPayload.serie,
        numero:                      Number(facturaPayload.numero),
        sunat_transaction:           nz(facturaPayload.sunat_transaction),

        // Fechas (DB usa DATE en ISO YYYY-MM-DD)
        fecha_de_emision:            toDateIso(facturaPayload.fecha_de_emision),
        fecha_de_vencimiento:        toDateIso(facturaPayload.fecha_de_vencimiento),

        // Cliente
        cliente_tipo_de_documento:   String(facturaPayload.cliente_tipo_de_documento ?? ''),
        cliente_numero_de_documento: facturaPayload.cliente_numero_de_documento,
        cliente_denominacion:        facturaPayload.cliente_denominacion,
        cliente_direccion:           nz(facturaPayload.cliente_direccion),
        cliente_email:               nz(facturaPayload.cliente_email),
        cliente_email_1:             nz(facturaPayload.cliente_email_1),
        cliente_email_2:             nz(facturaPayload.cliente_email_2),

        // Moneda y totales
        moneda:                      facturaPayload.moneda || 1,
        tipo_de_cambio:              nz(facturaPayload.tipo_de_cambio),
        porcentaje_de_igv:           facturaPayload.porcentaje_de_igv || 18,
        total_gravada:               Number(facturaPayload.total_gravada)   || 0,
        total_inafecta:              Number(facturaPayload.total_inafecta)  || 0,
        total_exonerada:             Number(facturaPayload.total_exonerada) || 0,
        total_gratuita:              Number(facturaPayload.total_gratuita)  || 0,
        total_igv:                   Number(facturaPayload.total_igv)       || 0,
        total_descuento:             Number(facturaPayload.total_descuento) || 0,
        descuento_global:            nz(facturaPayload.descuento_global),
        total_anticipo:              nz(facturaPayload.total_anticipo),
        total_impuestos_bolsas:      nz(facturaPayload.total_impuestos_bolsas),
        total:                       Number(facturaPayload.total),

        // Documento que modifica
        documento_que_se_modifica_tipo:   nz(facturaPayload.documento_que_se_modifica_tipo),
        documento_que_se_modifica_serie:  nz(facturaPayload.documento_que_se_modifica_serie),
        documento_que_se_modifica_numero: nz(facturaPayload.documento_que_se_modifica_numero),
        tipo_de_nota_de_credito:          nz(facturaPayload.tipo_de_nota_de_credito),
        tipo_de_nota_de_debito:           nz(facturaPayload.tipo_de_nota_de_debito),

        // Detracción
        detraccion:                  !!facturaPayload.detraccion,
        detraccion_tipo:             nz(facturaPayload.detraccion_tipo),
        detraccion_porcentaje:       nz(facturaPayload.detraccion_porcentaje),
        detraccion_total:            nz(facturaPayload.detraccion_total),
        medio_de_pago_detraccion:    nz(facturaPayload.medio_de_pago_detraccion),

        // Percepción / Retención
        percepcion_tipo:             nz(facturaPayload.percepcion_tipo),
        percepcion_base_imponible:   nz(facturaPayload.percepcion_base_imponible),
        total_percepcion:            nz(facturaPayload.total_percepcion),
        total_incluido_percepcion:   nz(facturaPayload.total_incluido_percepcion),
        retencion_tipo:              nz(facturaPayload.retencion_tipo),
        retencion_base_imponible:    nz(facturaPayload.retencion_base_imponible),
        total_retencion:             nz(facturaPayload.total_retencion),

        // Info adicional
        observaciones:               nz(facturaPayload.observaciones),
        orden_compra_servicio:       nz(facturaPayload.orden_compra_servicio),
        condiciones_de_pago:         nz(facturaPayload.condiciones_de_pago),
        medio_de_pago:               nz(facturaPayload.medio_de_pago),
        placa_vehiculo:              nz(facturaPayload.placa_vehiculo),
        codigo_unico:                nz(facturaPayload.codigo_unico),
        formato_de_pdf:              facturaPayload.formato_de_pdf || 'A4',

        // Flags
        generado_por_contingencia:   !!facturaPayload.generado_por_contingencia,
        bienes_region_selva:         !!facturaPayload.bienes_region_selva,
        servicios_region_selva:      !!facturaPayload.servicios_region_selva,

        // Respuesta SUNAT
        aceptada_por_sunat:          !!(response as any)?.aceptada_por_sunat,
        sunat_description:           (response as any)?.sunat_description || null,
        sunat_note:                  (response as any)?.sunat_note        || null,
        sunat_responsecode:          (response as any)?.sunat_responsecode ? String((response as any).sunat_responsecode) : null,
        sunat_soap_error:            (response as any)?.sunat_soap_error  || null,
        codigo_hash:                 (response as any)?.codigo_hash       || null,
        cadena_para_codigo_qr:       (response as any)?.cadena_para_codigo_qr || null,
        key_name:                    (response as any)?.key_name          || null,

        // Enlaces
        enlace:                      (response as any)?.enlace            || null,
        enlace_del_pdf:              (response as any)?.enlace_del_pdf    || null,
        enlace_del_xml:              (response as any)?.enlace_del_xml    || null,
        enlace_del_cdr:              (response as any)?.enlace_del_cdr    || null,

        // Auditoría
        items:                       facturaPayload.items || [],
        venta_al_credito:            facturaPayload.venta_al_credito || null,
        guias:                       facturaPayload.guias || null,
        payload_enviado:             facturaPayload,
        respuesta_completa:          response
      }

      const { data: inserted, error: dbErr } = await supabase
        .from('comprobantes_pse')
        .upsert(row, { onConflict: 'company_id,tipo_de_comprobante,serie,numero' })
        .select('id')
        .single()

      if (dbErr) {
        console.error('[PSE][Supabase] error guardando comprobante:', dbErr.message)
      } else {
        console.log('[PSE][Supabase] comprobante guardado:', row.serie + '-' + row.numero, '→', inserted?.id)
        ;(response as any).comprobante_id = inserted?.id
      }
    } catch (dbErr: any) {
      console.error('[PSE][Supabase] excepción guardando comprobante:', dbErr?.message || dbErr)
    }

    return response

  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    console.error('[PSE Error] Status:', err?.status)
    console.error('[PSE Error] Body:', JSON.stringify(detail))

    // Formatear mensaje de error según el formato de NubeFact
    // { "errors": "...", "codigo": N }  o  { "error": "..." }
    let statusMessage = 'Error al emitir comprobante'
    if (typeof detail === 'string') {
      statusMessage = detail
    } else if (detail?.errors) {
      statusMessage = `${detail.errors}${detail.codigo ? ` (código ${detail.codigo})` : ''}`
    } else if (detail?.error) {
      statusMessage = detail.error
    } else if (detail?.message) {
      statusMessage = detail.message
    }

    throw createError({
      statusCode: err?.status || 500,
      statusMessage
    })
  }
})
