/**
 * POST /api/pse/reconciliar
 *
 * Re-sincroniza el estado REAL de SUNAT de los comprobantes que quedaron
 * guardados con `aceptada_por_sunat = false`.
 *
 * Por qué existe:
 *   La aceptación de SUNAT es ASÍNCRONA. Al emitir, NubeFact/PSE.PE devuelve
 *   `aceptada_por_sunat = false/null` y, en el flujo histórico, ese valor nunca
 *   se volvía a consultar → el dashboard mostraba "no aceptada" para siempre
 *   aunque SUNAT sí la había aceptado. Este endpoint cierra ese hueco: re-consulta
 *   `consultar_comprobante` en PSE.PE y actualiza la BD con el estado verdadero.
 *
 * Uso:
 *   - Manual / botón en el dashboard.
 *   - Cron (Netlify Scheduled Function) llamando con `?api_key=` o body.api_key.
 *
 * Body (todo opcional):
 *   {
 *     "api_key":    "pse-reconciliar-2026",   // requerido si no hay sesión dashboard
 *     "company_id": "estasconsuerte",          // default: estasconsuerte
 *     "limite":     200                         // máx. comprobantes a revisar (default 200)
 *   }
 *
 * Respuesta:
 *   { ok, company_id, revisados, corregidos, errores, detalle: [...] }
 *
 * NOTA: por ahora solo está habilitada ESTAS CON SUERTE. Para sumar Healup u otra
 *       empresa, agrega su { url, token } al mapa EMPRESAS de abajo.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

interface EmpresaPSE { url: string; token: string }

const EMPRESAS: Record<string, EmpresaPSE> = {
  estasconsuerte: {
    url:   'https://api.pse.pe/api/v1/42d38c65df7d465e98b2689e9d70883e7b7f00971afc4cd3b0338368950d1faf',
    token: 'eyJhbGciOiJIUzI1NiJ9.ImRkYTg3MDYwNjljZTRiYjViMGU0YWJkOTJlMzlmYWYyYmUxZjJmMTE4MTY2NGU2NTg0MmQ0NTk3MTJjZmIyYTYi.sF5Tv1kK2XWS63c1pXNTvor5zqyyroPTnxRRCUxeqq4',
  },
  // healup: { url: '...', token: '...' }   // ← agregar cuando se quiera reconciliar Healup
}

const API_KEY = process.env.PSE_RECONCILIAR_KEY || 'pse-reconciliar-2026'

export default defineEventHandler(async (event) => {
  const body = (await readBody<any>(event).catch(() => ({}))) || {}

  // ── Auth: api_key (cron/externo) o sesión dashboard ──────────────────────
  const tieneSesion = !!getCookie(event, 'dashboard_session')
  if (body.api_key !== API_KEY && !tieneSesion) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const companyId = String(body.company_id || 'estasconsuerte').toLowerCase().replace(/\s/g, '')
  const empresa = EMPRESAS[companyId]
  if (!empresa) {
    throw createError({
      statusCode: 400,
      statusMessage: `Empresa '${companyId}' no está habilitada para reconciliar. Solo: ${Object.keys(EMPRESAS).join(', ')}`,
    })
  }

  const limite = Math.min(Number(body.limite) || 200, 500)
  const supabase = serverSupabaseServiceRole(event)

  // ── Comprobantes que figuran como NO aceptados (excluye demo) ────────────
  const { data: pendientes, error: selErr } = await supabase
    .from('comprobantes_pse')
    .select('id,tipo_de_comprobante,serie,numero')
    .eq('company_id', companyId)
    .eq('aceptada_por_sunat', false)
    .eq('demo', false)
    .order('numero', { ascending: true })
    .limit(limite)

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: `Error leyendo comprobantes: ${selErr.message}` })
  }

  let revisados = 0
  let corregidos = 0
  let errores = 0
  const detalle: any[] = []

  for (const c of pendientes || []) {
    revisados++
    try {
      const q = await $fetch<any>(empresa.url, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json; charset=utf-8',
          'Authorization': empresa.token,
        },
        body: {
          operacion:           'consultar_comprobante',
          tipo_de_comprobante: c.tipo_de_comprobante,
          serie:               c.serie,
          numero:              c.numero,
        },
      })

      if (q?.aceptada_por_sunat) {
        const { error: updErr } = await supabase
          .from('comprobantes_pse')
          .update({
            aceptada_por_sunat: true,
            enlace_del_cdr:     q.enlace_del_cdr || null,
            sunat_description:  q.sunat_description || null,
            sunat_note:         q.sunat_note || null,
            sunat_responsecode: q.sunat_responsecode ? String(q.sunat_responsecode) : null,
          })
          .eq('id', c.id)

        if (updErr) { errores++; detalle.push({ comprobante: `${c.serie}-${c.numero}`, error: updErr.message }) }
        else { corregidos++; detalle.push({ comprobante: `${c.serie}-${c.numero}`, corregido: true }) }
      }
      // si sigue false en PSE.PE, lo dejamos como está (realmente pendiente/rechazado)
    } catch (e: any) {
      errores++
      detalle.push({ comprobante: `${c.serie}-${c.numero}`, error: e?.data?.errors || e?.message || 'consulta falló' })
    }
  }

  return { ok: true, company_id: companyId, revisados, corregidos, errores, detalle }
})
