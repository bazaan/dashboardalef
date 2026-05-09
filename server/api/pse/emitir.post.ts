/**
 * POST /api/pse/emitir
 *
 * Emite un comprobante pendiente a PSE.PE/SUNAT.
 * Toma el payload_enviado guardado en comprobantes_pse,
 * lo envía a PSE.PE y actualiza el registro con la respuesta.
 *
 * Body:
 *   { comprobante_id: number }           — emitir uno
 *   { comprobante_ids: number[] }        — emitir varios (batch)
 *   { company_id: string, todos: true }  — emitir todos los pendientes de la empresa
 */

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import { EMPRESAS } from './factura.post'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let supabase: any
  try { supabase = serverSupabaseServiceRole(event) }
  catch {
    try { supabase = await serverSupabaseClient(event) }
    catch { throw createError({ statusCode: 500, statusMessage: 'No se pudo conectar a Supabase' }) }
  }

  // Determinar qué comprobantes emitir
  let ids: number[] = []

  if (body.comprobante_id) {
    ids = [Number(body.comprobante_id)]
  } else if (Array.isArray(body.comprobante_ids) && body.comprobante_ids.length > 0) {
    ids = body.comprobante_ids.map(Number)
  } else if (body.todos && body.company_id) {
    const key = body.company_id.toLowerCase().replace(/\s/g, '')
    const { data } = await supabase
      .from('comprobantes_pse')
      .select('id')
      .eq('company_id', key)
      .eq('estado', 'pendiente')
      .order('numero', { ascending: true })

    ids = (data || []).map((r: any) => r.id)
  }

  if (ids.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No se especificaron comprobantes para emitir' })
  }

  // Fetch comprobantes pendientes
  const { data: pendientes, error: fetchErr } = await supabase
    .from('comprobantes_pse')
    .select('id, company_id, payload_enviado, estado, serie, numero')
    .in('id', ids)

  if (fetchErr) {
    throw createError({ statusCode: 500, statusMessage: `Error consultando comprobantes: ${fetchErr.message}` })
  }

  if (!pendientes || pendientes.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No se encontraron comprobantes con esos IDs' })
  }

  const resultados: any[] = []

  for (const comp of pendientes) {
    if (comp.estado !== 'pendiente') {
      resultados.push({ id: comp.id, serie: comp.serie, numero: comp.numero, ok: false, error: `Estado actual: ${comp.estado} (solo se pueden emitir pendientes)` })
      continue
    }

    const key = comp.company_id
    const empresa = EMPRESAS[key]
    if (!empresa) {
      resultados.push({ id: comp.id, serie: comp.serie, numero: comp.numero, ok: false, error: `Empresa '${key}' no registrada en PSE.PE` })
      continue
    }

    const facturaPayload = comp.payload_enviado
    if (!facturaPayload) {
      resultados.push({ id: comp.id, serie: comp.serie, numero: comp.numero, ok: false, error: 'No tiene payload_enviado guardado' })
      continue
    }

    // Asegurar que tenga operacion
    facturaPayload.operacion = 'generar_comprobante'
    facturaPayload.enviar_automaticamente_a_la_sunat = true
    facturaPayload.enviar_automaticamente_al_cliente = false

    console.log(`[PSE][Emitir] ${comp.serie}-${comp.numero} para ${key}`)

    try {
      const response: any = await $fetch(empresa.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': empresa.token
        },
        body: facturaPayload
      })

      console.log(`[PSE][Emitir] OK: ${comp.serie}-${comp.numero} SUNAT:${response?.aceptada_por_sunat}`)

      // Actualizar registro con respuesta de PSE.PE
      await supabase
        .from('comprobantes_pse')
        .update({
          estado: 'emitido',
          aceptada_por_sunat: !!response?.aceptada_por_sunat,
          sunat_description: response?.sunat_description || null,
          sunat_note: response?.sunat_note || null,
          sunat_responsecode: response?.sunat_responsecode ? String(response.sunat_responsecode) : null,
          sunat_soap_error: response?.sunat_soap_error || null,
          codigo_hash: response?.codigo_hash || null,
          cadena_para_codigo_qr: response?.cadena_para_codigo_qr || null,
          key_name: response?.key_name || null,
          enlace: response?.enlace || null,
          enlace_del_pdf: response?.enlace_del_pdf || null,
          enlace_del_xml: response?.enlace_del_xml || null,
          enlace_del_cdr: response?.enlace_del_cdr || null,
          respuesta_completa: response,
          error_emision: null,
        })
        .eq('id', comp.id)

      resultados.push({
        id: comp.id,
        serie: comp.serie,
        numero: comp.numero,
        ok: true,
        aceptada_por_sunat: !!response?.aceptada_por_sunat,
        enlace_del_pdf: response?.enlace_del_pdf || null,
      })
    } catch (err: any) {
      const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
      const errorMsg = typeof detail === 'string'
        ? detail
        : (detail?.errors || detail?.message || 'Error PSE.PE')

      console.error(`[PSE][Emitir] ERROR ${comp.serie}-${comp.numero}:`, errorMsg)

      // Marcar como error
      await supabase
        .from('comprobantes_pse')
        .update({
          estado: 'error',
          error_emision: String(errorMsg).slice(0, 500),
        })
        .eq('id', comp.id)

      resultados.push({
        id: comp.id,
        serie: comp.serie,
        numero: comp.numero,
        ok: false,
        error: errorMsg,
      })
    }
  }

  const exitosos = resultados.filter(r => r.ok).length
  const fallidos = resultados.filter(r => !r.ok).length

  return {
    total: resultados.length,
    exitosos,
    fallidos,
    resultados,
  }
})
