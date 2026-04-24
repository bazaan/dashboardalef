/**
 * POST /api/pse/anular
 *
 * Genera la baja (anulación) de un comprobante en PSE.PE / NubeFact.
 *
 * ⚠️  SUNAT solo permite anular boletas (tipo 2) dentro de los primeros 7 días
 *      calendario desde la fecha de emisión. Las facturas (tipo 1) deben
 *      cancelarse mediante una Nota de Crédito — este endpoint las rechaza.
 *
 * Body:
 * {
 *   company_id:          string   — 'healup' | 'estasconsuerte'
 *   tipo_de_comprobante: number   — 2 (boleta). Facturas no admitidas aquí.
 *   serie:               string   — 'B001'
 *   numero:              number
 *   motivo:              string   — texto libre del motivo de anulación
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

function toFechaNubefact(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return iso
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { company_id, tipo_de_comprobante, serie, numero, motivo } = body ?? {}

  if (!company_id || !serie || !numero || !motivo) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos requeridos: company_id, serie, numero, motivo' })
  }

  if (Number(tipo_de_comprobante) !== 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Solo se pueden anular boletas (tipo 2). Las facturas deben cancelarse con una Nota de Crédito.'
    })
  }

  const key = (company_id as string).toLowerCase().replace(/\s/g, '')
  const empresa = EMPRESAS[key]
  if (!empresa) {
    throw createError({ statusCode: 400, statusMessage: `Empresa '${company_id}' no registrada en PSE.PE` })
  }

  // Obtener fecha de emisión desde Supabase (PSE.PE la requiere)
  let supabase: any
  try { supabase = serverSupabaseServiceRole(event) }
  catch { supabase = await serverSupabaseClient(event) }

  const { data: comp, error: compErr } = await supabase
    .from('comprobantes_pse')
    .select('fecha_de_emision, anulado, respuesta_anulacion')
    .eq('company_id', key)
    .eq('tipo_de_comprobante', 2)
    .eq('serie', serie)
    .eq('numero', Number(numero))
    .maybeSingle()

  if (compErr && compErr.message?.includes('does not exist')) {
    // Columnas de anulación aún no migradas — continuar sin verificación de duplicado
    console.warn('[PSE][Anular] Columna anulado no existe — correr sql/comprobantes_pse_anulacion.sql en Supabase')
  } else if (compErr) {
    throw createError({ statusCode: 500, statusMessage: `Error consultando Supabase: ${compErr.message}` })
  }
  if (!compErr && !comp) {
    throw createError({ statusCode: 404, statusMessage: `Comprobante ${serie}-${numero} no encontrado en el historial` })
  }
  if (comp?.anulado) {
    throw createError({ statusCode: 409, statusMessage: `El comprobante ${serie}-${numero} ya fue anulado` })
  }

  // Verificar que no han pasado más de 7 días
  if (comp?.fecha_de_emision) {
    const emision = new Date(comp.fecha_de_emision)
    const diasDesdeEmision = Math.floor((Date.now() - emision.getTime()) / 86400000)
    if (diasDesdeEmision > 7) {
      throw createError({
        statusCode: 422,
        statusMessage: `No se puede anular: han pasado ${diasDesdeEmision} días desde la emisión. SUNAT solo permite baja dentro de los primeros 7 días.`
      })
    }
  }

  const anulacionPayload = {
    operacion: 'generar_anulacion',
    tipo_de_comprobante: 2,
    serie,
    numero: Number(numero),
    fecha_de_emision: comp?.fecha_de_emision ? toFechaNubefact(comp.fecha_de_emision) : toFechaNubefact(new Date().toISOString().split('T')[0]),
    motivo: String(motivo).trim(),
  }

  console.log(`[PSE][Anular] ${key} — ${serie}-${numero} — motivo: "${motivo}"`)

  let response: any
  try {
    response = await $fetch<any>(empresa.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': empresa.token,
      },
      body: anulacionPayload,
    })
    console.log(`[PSE][Anular] Respuesta PSE:`, JSON.stringify(response))
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    let msg = 'Error al anular en PSE.PE'
    if (typeof detail === 'string') msg = detail
    else if (detail?.errors) msg = `${detail.errors}${detail.codigo ? ` (código ${detail.codigo})` : ''}`
    else if (detail?.error)  msg = detail.error
    console.error(`[PSE][Anular] Error:`, detail)
    throw createError({ statusCode: err?.status || 502, statusMessage: msg })
  }

  // Marcar como anulado en Supabase (requiere migración sql/comprobantes_pse_anulacion.sql)
  try {
    const { error: updateErr } = await supabase
      .from('comprobantes_pse')
      .update({
        anulado: true,
        motivo_anulacion: motivo,
        respuesta_anulacion: response,
      })
      .eq('company_id', key)
      .eq('tipo_de_comprobante', 2)
      .eq('serie', serie)
      .eq('numero', Number(numero))

    if (updateErr) {
      if (updateErr.message?.includes('does not exist')) {
        console.warn('[PSE][Anular] Columnas de anulación no existen — correr sql/comprobantes_pse_anulacion.sql')
      } else {
        console.error(`[PSE][Anular] Error actualizando Supabase:`, updateErr.message)
      }
    } else {
      console.log(`[PSE][Anular] Marcado como anulado en Supabase`)
    }
  } catch (e: any) {
    console.error(`[PSE][Anular] Excepción Supabase:`, e?.message)
  }

  return {
    ok: true,
    serie,
    numero,
    motivo,
    aceptada_baja_sunat: !!(response as any)?.aceptada_por_sunat,
    respuesta: response,
  }
})
