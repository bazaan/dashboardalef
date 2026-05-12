/**
 * POST /api/ecs/cobro-manual
 *
 * Genera una boleta electrónica ECS desde el dashboard (cobro manual).
 * Requiere sesión activa vía cookie dashboard_session.
 * No requiere webhook_secret — es para uso interno del equipo.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const ECS_PSE_URL   = 'https://api.pse.pe/api/v1/42d38c65df7d465e98b2689e9d70883e7b7f00971afc4cd3b0338368950d1faf'
const ECS_PSE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.ImRkYTg3MDYwNjljZTRiYjViMGU0YWJkOTJlMzlmYWYyYmUxZjJmMTE4MTY2NGU2NTg0MmQ0NTk3MTJjZmIyYTYi.sF5Tv1kK2XWS63c1pXNTvor5zqyyroPTnxRRCUxeqq4'
const ECS_RUC       = '20611950650'
const ECS_RAZON     = 'ESTAS CON SUERTE S.A.C.'
const SERIE_BOLETA  = 'B001'

async function proximoNumero(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('comprobantes_pse')
    .select('numero')
    .eq('company_id', 'estasconsuerte')
    .eq('tipo_de_comprobante', 2)
    .eq('serie', SERIE_BOLETA)
    .order('numero', { ascending: false })
    .limit(1)
    .single()
  return (data?.numero ?? 0) + 1
}

function hoy(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}

export default defineEventHandler(async (event) => {
  // ── Auth: verificar sesión via cookie ─────────────────────────────────────
  const cookie = getCookie(event, 'dashboard_session')
  if (!cookie) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  let sessionUser: any
  try { sessionUser = JSON.parse(cookie) } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }

  const body = await readBody(event)

  // ── Validación mínima ─────────────────────────────────────────────────────
  const plan = body?.plan
  if (!plan?.nombre || !plan?.precio_final) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan plan.nombre o plan.precio_final' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // ── Calcular montos ───────────────────────────────────────────────────────
  const total:         number = Number(plan.precio_final)
  const total_gravada: number = parseFloat((total / 1.18).toFixed(2))
  const total_igv:     number = parseFloat((total - total_gravada).toFixed(2))

  // ── Datos del cliente ─────────────────────────────────────────────────────
  const TIPO_DOC_MAP: Record<number | string, number | string> = {
    1: 1, 2: 1, 4: 4, 6: 6, 7: 7,
  }
  const cli = body?.cliente
  const tipoRaw       = cli?.tipo_documento
  const cliente_tipo  = tipoRaw != null ? (TIPO_DOC_MAP[tipoRaw] ?? 1) : '-'
  const cliente_num   = cli?.numero_documento ?? '00000000'
  const cliente_nom   = cli?.nombre           ?? 'CONSUMIDOR FINAL'
  const cliente_email = cli?.email            ?? ''

  // ── Número de boleta ──────────────────────────────────────────────────────
  const numero = await proximoNumero(supabase)

  // ── Armar payload PSE.PE ──────────────────────────────────────────────────
  const payload = {
    operacion:                          'generar_comprobante',
    tipo_de_comprobante:                2,
    serie:                              SERIE_BOLETA,
    numero,
    sunat_transaction:                  1,
    fecha_de_emision:                   hoy(),
    moneda:                             1,
    porcentaje_de_igv:                  18.00,
    cliente_tipo_de_documento:          cliente_tipo,
    cliente_numero_de_documento:        cliente_num,
    cliente_denominacion:               cliente_nom,
    cliente_email:                      cliente_email,
    cliente_email_1:                    '',
    cliente_email_2:                    '',
    total_gravada,
    total_inafecta:                     0,
    total_exonerada:                    0,
    total_gratuita:                     0,
    total_igv,
    total_descuento:                    0,
    total,
    medio_de_pago:                      body?.medio_de_pago || '',
    observaciones:                      `Cobro manual - ${plan.nombre}`,
    formato_de_pdf:                     'A4',
    enviar_automaticamente_a_la_sunat:  true,
    enviar_automaticamente_al_cliente:  !!cliente_email,
    items: [{
      unidad_de_medida:         'NIU',
      codigo:                   String(plan.id ?? 'ECS-PLAN'),
      descripcion:              plan.nombre,
      cantidad:                 1,
      valor_unitario:           total_gravada,
      precio_unitario:          total,
      descuento:                0,
      subtotal:                 total_gravada,
      tipo_de_igv:              1,
      igv:                      total_igv,
      total:                    total,
      anticipo_regularizacion:  false,
    }]
  }

  // ── Llamar a PSE.PE ───────────────────────────────────────────────────────
  let response: any
  try {
    response = await $fetch<any>(ECS_PSE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': ECS_PSE_TOKEN },
      body:    payload
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    throw createError({
      statusCode: err?.status || 502,
      statusMessage: detail?.errors || detail?.error || 'Error al emitir boleta en PSE.PE'
    })
  }

  console.log('[cobro-manual] Boleta', SERIE_BOLETA + '-' + numero, 'por', sessionUser.email, '| S/', total)

  // ── Guardar en Supabase ───────────────────────────────────────────────────
  const toIso = (v: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : v
  }

  try {
    await supabase.from('comprobantes_pse').upsert({
      emitido_por:                 'manual-dashboard',
      company_id:                  'estasconsuerte',
      ruc_emisor:                  ECS_RUC,
      razon_social_emisor:         ECS_RAZON,
      demo:                        false,
      tipo_de_comprobante:         2,
      serie:                       SERIE_BOLETA,
      numero,
      fecha_de_emision:            toIso(payload.fecha_de_emision),
      cliente_tipo_de_documento:   String(cliente_tipo),
      cliente_numero_de_documento: cliente_num,
      cliente_denominacion:        cliente_nom,
      cliente_email:               cliente_email || null,
      moneda:                      1,
      porcentaje_de_igv:           18,
      total_gravada,
      total_igv,
      total_inafecta:              0,
      total_exonerada:             0,
      total_gratuita:              0,
      total_descuento:             0,
      total,
      medio_de_pago:               body?.medio_de_pago || null,
      observaciones:               payload.observaciones,
      formato_de_pdf:              'A4',
      aceptada_por_sunat:          !!response?.aceptada_por_sunat,
      sunat_description:           response?.sunat_description || null,
      codigo_hash:                 response?.codigo_hash || null,
      enlace_del_pdf:              response?.enlace_del_pdf || null,
      enlace_del_xml:              response?.enlace_del_xml || null,
      enlace_del_cdr:              response?.enlace_del_cdr || null,
      items:                       payload.items,
      payload_enviado:             payload,
      respuesta_completa:          response,
    }, { onConflict: 'company_id,tipo_de_comprobante,serie,numero' })
  } catch (dbErr: any) {
    console.error('[cobro-manual] Supabase error:', dbErr?.message)
  }

  return {
    ok:                 true,
    serie:              SERIE_BOLETA,
    numero,
    aceptada_por_sunat: !!response?.aceptada_por_sunat,
    enlace_pdf:         response?.enlace_del_pdf || null,
    codigo_hash:        response?.codigo_hash || null,
  }
})
