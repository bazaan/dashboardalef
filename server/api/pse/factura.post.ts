/**
 * POST /api/pse/factura
 * Proxy server-side para PSE.PE / NubeFact
 * Mantiene el TOKEN seguro en el servidor y permite
 * enviar facturas electrónicas a SUNAT por empresa.
 */

// RUC y configuración por empresa
const EMPRESAS: Record<string, { ruc: string; razon_social: string }> = {
  healup: {
    ruc: '20615088111',
    razon_social: 'HEALUP'
  },
  estasconsuerte: {
    ruc: '20611950650',
    razon_social: 'ESTAS CON SUERTE S.A.C.'
  }
}

// El token de la URL y el del header deben ser el mismo (patrón PSE.PE/NubeFact)
const PSE_TOKEN = '0c15ce82e168a8763e4644c2'
const PSE_URL   = `https://api.pse.pe/api/reseller/v1/${PSE_TOKEN}`

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { company_id, payload } = body

  if (!company_id || !payload) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan company_id o payload' })
  }

  const empresa = EMPRESAS[company_id.toLowerCase().replace(/\s/g, '')]
  if (!empresa) {
    throw createError({ statusCode: 400, statusMessage: `Empresa '${company_id}' no configurada para facturación PSE` })
  }

  // ruc_emisor identifica qué empresa emite el comprobante en el endpoint reseller
  const facturaPayload = {
    operacion: 'generar_comprobante',
    ruc_emisor: empresa.ruc,
    ...payload,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    porcentaje_de_igv: 18.00
  }

  console.log('[PSE] Enviando a:', PSE_URL)
  console.log('[PSE] ruc_emisor:', empresa.ruc)
  console.log('[PSE] tipo_comprobante:', facturaPayload.tipo_de_comprobante)

  try {
    const response = await $fetch<any>(PSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Token token=${PSE_TOKEN}`
      },
      body: facturaPayload
    })

    console.log('[PSE] Respuesta OK:', JSON.stringify(response).slice(0, 300))
    return response

  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    console.error('[PSE Factura Error] Status:', err?.status)
    console.error('[PSE Factura Error] Body:', JSON.stringify(detail))
    throw createError({
      statusCode: err?.status || 500,
      statusMessage: typeof detail === 'string'
        ? detail
        : JSON.stringify(detail?.errors || detail?.message || detail)
    })
  }
})
