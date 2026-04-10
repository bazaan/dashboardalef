/**
 * POST /api/pse/factura
 * Proxy server-side para PSE.PE / NubeFact
 */

// Configuración por empresa:
// - token: obtenido de PSE.PE → Empresa → Integración → TOKEN
// - url:   obtenido de PSE.PE → Empresa → Integración → RUTA
// URL reseller de PSE.PE + hex token como Authorization
// El hex 0c15ce82... autentica correctamente (confirmado: da 404 no 401 en v1)
// La URL reseller es la correcta para emitir con ruc_emisor
const PSE_RESELLER_URL   = 'https://api.pse.pe/api/reseller/v1/0c15ce82e168a8763e4644c2'
const PSE_RESELLER_TOKEN = '0c15ce82e168a8763e4644c2'

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

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { company_id, payload } = body

  if (!company_id || !payload) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan company_id o payload' })
  }

  const empresa = EMPRESAS[company_id.toLowerCase().replace(/\s/g, '')]
  if (!empresa) {
    throw createError({ statusCode: 400, statusMessage: `Empresa '${company_id}' no configurada` })
  }

  const facturaPayload = {
    operacion:    'generar_comprobante',
    ruc_emisor:   empresa.ruc,
    ...payload,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    porcentaje_de_igv: 18.00
  }

  console.log('[PSE] URL:', PSE_RESELLER_URL)
  console.log('[PSE] ruc_emisor:', empresa.ruc)
  console.log('[PSE] tipo_comprobante:', facturaPayload.tipo_de_comprobante)

  try {
    const response = await $fetch<any>(PSE_RESELLER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Token token=${PSE_RESELLER_TOKEN}`
      },
      body: facturaPayload
    })

    console.log('[PSE] Respuesta OK:', JSON.stringify(response).slice(0, 300))
    return response

  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    console.error('[PSE Error] Status:', err?.status)
    console.error('[PSE Error] Body:', JSON.stringify(detail))
    throw createError({
      statusCode: err?.status || 500,
      statusMessage: typeof detail === 'string'
        ? detail
        : JSON.stringify(detail?.errors || detail?.message || detail)
    })
  }
})
