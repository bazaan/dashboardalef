/**
 * POST /api/pse/eliminar
 *
 * Elimina un comprobante del sistema NubeFact/PSE.PE que aún no fue enviado
 * a SUNAT. NubeFact retiene los documentos hasta 24 h antes de despacharlos;
 * dentro de ese período se puede eliminar sin dejar rastro en SUNAT.
 *
 * ⚠️  Una vez que SUNAT acepta el comprobante (aceptada_por_sunat = true)
 *      ya NO se puede eliminar — usar /api/pse/anular en su lugar.
 *
 * Body:
 * {
 *   company_id:          string  — 'healup' | 'estasconsuerte'
 *   tipo_de_comprobante: number  — 1 (factura) | 2 (boleta)
 *   serie:               string
 *   numero:              number
 * }
 */

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

interface EmpresaConfig {
  ruc: string
  razon_social: string
  url: string
  token: string
}

const EMPRESAS: Record<string, EmpresaConfig> = {
  estasconsuerte: {
    ruc: '20611950650',
    razon_social: 'ESTAS CON SUERTE S.A.C.',
    url:   'https://api.pse.pe/api/v1/42d38c65df7d465e98b2689e9d70883e7b7f00971afc4cd3b0338368950d1faf',
    token: 'eyJhbGciOiJIUzI1NiJ9.ImRkYTg3MDYwNjljZTRiYjViMGU0YWJkOTJlMzlmYWYyYmUxZjJmMTE4MTY2NGU2NTg0MmQ0NTk3MTJjZmIyYTYi.sF5Tv1kK2XWS63c1pXNTvor5zqyyroPTnxRRCUxeqq4',
  },
  healup: {
    ruc: '20615088111',
    razon_social: 'HEAL UP LAB S.A.C.',
    url:   'https://api.pse.pe/api/v1/b3a349e648c543088a5e807bd36c4337b261a1b468974863ba49762bd2dd3600',
    token: 'eyJhbGciOiJIUzI1NiJ9.ImRkMThkNTFiOGExZjQ4NmI5MmRjMmU5MTU2MjRiMGRhZDI2MDkyYTM2YTQ0NDUzMGI4N2JhM2UwNTczNzAzZjki.ZZaYzBkK7ezOHq1hnupbqbrEAonHKpoIGkj9qi5w1pA',
  },
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { company_id, tipo_de_comprobante, serie, numero } = body ?? {}

  if (!company_id || !serie || !numero) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos requeridos: company_id, serie, numero' })
  }

  const tipo = Number(tipo_de_comprobante)
  if (![1, 2].includes(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'tipo_de_comprobante debe ser 1 (factura) o 2 (boleta)' })
  }

  const key = (company_id as string).toLowerCase().replace(/\s/g, '')
  const empresa = EMPRESAS[key]
  if (!empresa) {
    throw createError({ statusCode: 400, statusMessage: `Empresa '${company_id}' no registrada en PSE.PE` })
  }

  // Verificar en Supabase que el comprobante existe y no fue aceptado por SUNAT
  let supabase: any
  try { supabase = serverSupabaseServiceRole(event) }
  catch { supabase = await serverSupabaseClient(event) }

  const { data: comp, error: compErr } = await supabase
    .from('comprobantes_pse')
    .select('id, aceptada_por_sunat, anulado')
    .eq('company_id', key)
    .eq('tipo_de_comprobante', tipo)
    .eq('serie', serie)
    .eq('numero', Number(numero))
    .maybeSingle()

  if (compErr && !compErr.message?.includes('does not exist')) {
    throw createError({ statusCode: 500, statusMessage: `Error consultando Supabase: ${compErr.message}` })
  }
  if (!compErr && !comp) {
    throw createError({ statusCode: 404, statusMessage: `Comprobante ${serie}-${numero} no encontrado` })
  }
  if (comp?.aceptada_por_sunat) {
    throw createError({
      statusCode: 409,
      statusMessage: `${serie}-${numero} ya fue aceptado por SUNAT. Usa "Anular" en su lugar (dentro de los 7 días).`
    })
  }
  if (comp?.anulado) {
    throw createError({ statusCode: 409, statusMessage: `El comprobante ${serie}-${numero} ya fue anulado` })
  }

  const eliminarPayload = {
    operacion: 'eliminar_comprobante',
    tipo_de_comprobante: tipo,
    serie,
    numero: Number(numero),
  }

  console.log(`[PSE][Eliminar] ${key} — ${serie}-${numero}`)

  let response: any
  try {
    response = await $fetch<any>(empresa.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': empresa.token,
      },
      body: eliminarPayload,
    })
    console.log(`[PSE][Eliminar] Respuesta PSE:`, JSON.stringify(response))
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    let msg = 'Error al eliminar en PSE.PE'
    if (typeof detail === 'string') msg = detail
    else if (detail?.errors) msg = `${detail.errors}${detail.codigo ? ` (código ${detail.codigo})` : ''}`
    else if (detail?.error)  msg = detail.error
    console.error(`[PSE][Eliminar] Error:`, detail)
    throw createError({ statusCode: err?.status || 502, statusMessage: msg })
  }

  // Eliminar de Supabase
  if (comp?.id) {
    try {
      const { error: delErr } = await supabase
        .from('comprobantes_pse')
        .delete()
        .eq('id', comp.id)

      if (delErr) {
        console.error(`[PSE][Eliminar] Error borrando de Supabase:`, delErr.message)
      } else {
        console.log(`[PSE][Eliminar] Eliminado de Supabase (id: ${comp.id})`)
      }
    } catch (e: any) {
      console.error(`[PSE][Eliminar] Excepción Supabase:`, e?.message)
    }
  }

  return {
    ok: true,
    serie,
    numero,
    eliminado: true,
    respuesta: response,
  }
})
