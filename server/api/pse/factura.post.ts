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

const PSE_URL   = 'https://api.pse.pe/api/reseller/v1/0c15ce82e168a8763e4644c2'
const PSE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.IjEzM2ZmNmNiNTQ4YzhkNzgyODk5NzVmNzhiZjRmNmFmOGY4ZWExMGEwZTM4MzViNyI.Dqwk2iJcQB1K0yuHFXwhJ2Ao3AP7IVaQ0PpIER2RBWc'

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

  // Construir payload final con datos de la empresa emisora
  const facturaPayload = {
    operacion: 'generar_comprobante',
    ...payload,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    porcentaje_de_igv: 18.00
  }

  try {
    const response = await $fetch<any>(PSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Token token=${PSE_TOKEN}`
      },
      body: facturaPayload
    })

    return response
  } catch (err: any) {
    console.error('[PSE Factura Error]', err)
    throw createError({
      statusCode: err?.status || 500,
      statusMessage: err?.data?.errors || err?.message || 'Error al conectar con PSE.PE'
    })
  }
})
