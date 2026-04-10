/**
 * POST /api/pse/factura
 * Proxy server-side para PSE.PE / NubeFact
 */

// Configuración por empresa:
// - token: obtenido de PSE.PE → Empresa → Integración → TOKEN
// - url:   obtenido de PSE.PE → Empresa → Integración → RUTA
const EMPRESAS: Record<string, { url: string; token: string }> = {
  healup: {
    // ← REEMPLAZAR con los datos reales de Healup en PSE.PE
    url:   'https://api.pse.pe/api/v1/0c15ce82e168a8763e4644c2',
    token: '0c15ce82e168a8763e4644c2'
  },
  estasconsuerte: {
    // ← REEMPLAZAR con los datos reales de EstasConSuerte en PSE.PE
    url:   'https://api.pse.pe/api/v1/0c15ce82e168a8763e4644c2',
    token: '0c15ce82e168a8763e4644c2'
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
    operacion: 'generar_comprobante',
    ...payload,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    porcentaje_de_igv: 18.00
  }

  console.log('[PSE] URL:', empresa.url)
  console.log('[PSE] Token (inicio):', empresa.token.slice(0, 20) + '...')
  console.log('[PSE] tipo_comprobante:', facturaPayload.tipo_de_comprobante)

  try {
    const response = await $fetch<any>(empresa.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Token token=${empresa.token}`
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
