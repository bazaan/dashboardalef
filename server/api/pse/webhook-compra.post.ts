/**
 * POST /api/pse/webhook-compra
 *
 * Endpoint público que recibe una compra desde la página web de EstasConSuerte
 * y genera automáticamente una Boleta Electrónica en SUNAT vía PSE.PE.
 *
 * La página web debe enviar en el body JSON:
 * {
 *   "webhook_secret": "<WEBHOOK_SECRET del .env>",
 *   "cliente": {                      // opcional → emite como Consumidor Final
 *     "tipo_documento": 1,            // 1=DNI  6=RUC  4=CE
 *     "numero_documento": "74512398",
 *     "nombre": "Juan Pérez",
 *     "email": "juan@gmail.com"       // opcional: recibe PDF
 *   },
 *   "plan": {
 *     "nombre": "Triple Fortuna",
 *     "precio_final": 34.90           // precio CON IGV incluido
 *   },
 *   "medio_de_pago": "YAPE"           // YAPE | PLIN | TARJETA | TRANSFERENCIA | EFECTIVO
 * }
 *
 * Respuesta exitosa:
 * {
 *   "ok": true,
 *   "serie": "B001",
 *   "numero": 5,
 *   "enlace_pdf": "https://...",
 *   "aceptada_por_sunat": true
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

// ── Config EstasConSuerte en PSE.PE ────────────────────────────────────────
const ECS_PSE_URL   = 'https://api.pse.pe/api/v1/42d38c65df7d465e98b2689e9d70883e7b7f00971afc4cd3b0338368950d1faf'
const ECS_PSE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.ImRkYTg3MDYwNjljZTRiYjViMGU0YWJkOTJlMzlmYWYyYmUxZjJmMTE4MTY2NGU2NTg0MmQ0NTk3MTJjZmIyYTYi.sF5Tv1kK2XWS63c1pXNTvor5zqyyroPTnxRRCUxeqq4'
const ECS_RUC       = '20611950650'
const ECS_RAZON     = 'ESTAS CON SUERTE S.A.C.'
const SERIE_BOLETA  = 'B001'

/** Retorna próximo número de boleta consultando el máximo en Supabase */
async function proximoNumero(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('comprobantes_pse')
    .select('numero')
    .eq('company_id', 'estasconsuerte')
    .eq('tipo_de_comprobante', 2)   // 2 = Boleta
    .eq('serie', SERIE_BOLETA)
    .order('numero', { ascending: false })
    .limit(1)
    .single()
  return (data?.numero ?? 0) + 1
}

/**
 * Devuelve "DD-MM-YYYY" en hora Perú (UTC-5, sin DST).
 *
 * IMPORTANTE: Vercel ejecuta en UTC. Si usáramos `new Date().getDate()`
 * entre 19:00 y 23:59 hora Lima nos daría el día siguiente, y PSE.PE
 * rechazaría con "La fecha del documento debe ser la fecha de HOY".
 * Por eso forzamos la zona horaria America/Lima.
 */
function hoy(): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  }).format(new Date()).replace(/\//g, '-')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)

  // ── Log de entrada (siempre, antes de validar) ─────────────────────────
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('ecs_webhook_logs').insert({
      payload:     body,
      status:      'pending',
      ip_address:  getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || 'unknown'
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch { /* tabla puede no existir aún */ }

  const updateLog = async (status: string, extra: Record<string, any> = {}) => {
    if (!logId) return
    try { await supabase.from('ecs_webhook_logs').update({ status, ...extra }).eq('id', logId) } catch {}
  }

  // ── 1. Autenticación: Bearer header (preferido) o body fallback ──────────
  const secretEsperado = process.env.WEBHOOK_ECS_SECRET
  if (!secretEsperado) {
    await updateLog('error', { error_message: 'WEBHOOK_ECS_SECRET no configurado' })
    throw createError({ statusCode: 500, statusMessage: 'WEBHOOK_ECS_SECRET no configurado en el servidor' })
  }

  // Leer token desde Authorization: Bearer <token>  o desde body.webhook_secret
  const authHeader   = getHeader(event, 'authorization') ?? ''
  const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const secretRecibido = bearerToken ?? body?.webhook_secret ?? ''

  if (secretRecibido !== secretEsperado) {
    await updateLog('error', { error_message: 'Token de autorización inválido' })
    throw createError({ statusCode: 401, statusMessage: 'Token de autorización inválido' })
  }

  // ── 2. Sincronizar SuscriptoresBDwppECS (siempre, antes del boleteo) ────
  //    Si ECS nos está mandando este webhook, significa que el cobro se
  //    completó. Aprovechamos esto para marcar la suscripción como activa
  //    en nuestra BD, aunque el toggle de boleteado esté apagado.
  //
  //    Estrategia: buscar el suscriptor por email + estado='pendiente'
  //    (en orden de más reciente primero) y actualizarlo a 'activa'.
  try {
    const clienteEmailIn = body?.cliente?.email
    const clienteDniIn   = body?.cliente?.numero_documento

    let suscriptorQuery = supabase
      .from('SuscriptoresBDwppECS')
      .select('id, operation_number, estado')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)

    if (clienteEmailIn) {
      suscriptorQuery = suscriptorQuery.eq('email', clienteEmailIn)
    } else if (clienteDniIn) {
      suscriptorQuery = suscriptorQuery.eq('dni', String(clienteDniIn))
    }

    if (clienteEmailIn || clienteDniIn) {
      const { data: suscriptor } = await suscriptorQuery.maybeSingle()

      if (suscriptor) {
        const ahora   = new Date()
        const proxima = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000)

        await supabase.from('SuscriptoresBDwppECS').update({
          estado:                 'activa',
          subscription_status:    'AUTHORIZED',
          fecha_suscripcion:      ahora.toISOString(),
          fecha_proxima_cobranza: proxima.toISOString(),
        }).eq('id', suscriptor.id)

        if (suscriptor.operation_number) {
          await supabase.from('ecs_pagos_monnet').update({
            estado:              'pagado',
            subscription_status: 'AUTHORIZED',
            paid_at:             ahora.toISOString(),
          }).eq('operation_number', suscriptor.operation_number)
        }

        console.log(`[webhook-compra] ✅ Suscriptor ${clienteEmailIn ?? clienteDniIn} → activa (via webhook-compra)`)
      }
    }
  } catch (e: any) {
    console.error('[webhook-compra] Error sincronizando suscriptor:', e?.message)
    // No bloquear: el webhook sigue su curso
  }

  // ── 3. Verificar si el boleteado está ACTIVADO desde el dashboard ───────
  //    Se controla con un switch en pages/pruebas/EstasConSuerte.vue y se
  //    guarda en app_settings(key='ecs_boleteo_activo'). Default OFF.
  //    Si está apagado, respondemos 200 OK pero saltamos la emisión —
  //    así el sistema de ECS no marca error en sus logs.
  const { data: boletoFlag } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'ecs_boleteo_activo')
    .maybeSingle()
  const boleteoActivo = boletoFlag?.value === 'true'

  if (!boleteoActivo) {
    await updateLog('skipped', { error_message: 'Boleteado ECS desactivado desde el dashboard' })
    console.log('[webhook-compra] ECS boleteo DESACTIVADO — skip emisión (pero suscriptor ya quedó activa)')
    return {
      ok: true,
      skipped: true,
      message: 'Boleteado automático de ECS desactivado. Suscriptor sincronizado igual.',
    }
  }

  // ── 4. Validación mínima ───────────────────────────────────────────────
  const plan = body?.plan
  if (!plan?.nombre || !plan?.precio_final) {
    await updateLog('error', { error_message: 'Faltan plan.nombre o plan.precio_final' })
    throw createError({ statusCode: 400, statusMessage: 'Faltan plan.nombre o plan.precio_final' })
  }

  // ── 3. Calcular base gravada e IGV (precio_final ya incluye IGV 18%) ───
  const total:          number = Number(plan.precio_final)
  const total_gravada:  number = parseFloat((total / 1.18).toFixed(2))
  const total_igv:      number = parseFloat((total - total_gravada).toFixed(2))

  // ── 4. Datos del cliente ───────────────────────────────────────────────
  // Mapeo de tipo_documento: el sistema ECS puede enviar códigos propios.
  // PSE.PE solo acepta: 1=DNI, 4=CE, 6=RUC. Cualquier otro → DNI por defecto.
  const TIPO_DOC_MAP: Record<number | string, number | string> = {
    1: 1,   // DNI → DNI
    2: 1,   // DNI (código interno ECS) → DNI
    4: 4,   // CE → CE
    6: 6,   // RUC → RUC
    7: 7,   // Pasaporte
  }
  const cli = body?.cliente
  const tipoRaw        = cli?.tipo_documento
  const cliente_tipo   = tipoRaw != null ? (TIPO_DOC_MAP[tipoRaw] ?? 1) : '-'
  const cliente_num    = cli?.numero_documento ?? '00000000'
  const cliente_nom    = cli?.nombre           ?? 'CONSUMIDOR FINAL'
  const cliente_email  = cli?.email            ?? ''

  // ── 5. Número de boleta ────────────────────────────────────────────────
  const numero = await proximoNumero(supabase)

  // ── 6. Armar payload PSE.PE ────────────────────────────────────────────
  const payload = {
    operacion:                          'generar_comprobante',
    tipo_de_comprobante:                2,           // 2 = Boleta
    serie:                              SERIE_BOLETA,
    numero,
    sunat_transaction:                  1,
    fecha_de_emision:                   hoy(),
    moneda:                             1,           // 1 = PEN (soles)
    porcentaje_de_igv:                  18.00,

    // Cliente
    cliente_tipo_de_documento:          cliente_tipo,
    cliente_numero_de_documento:        cliente_num,
    cliente_denominacion:               cliente_nom,
    cliente_email:                      cliente_email,
    cliente_email_1:                    '',
    cliente_email_2:                    '',

    // Totales
    total_gravada,
    total_inafecta:                     0,
    total_exonerada:                    0,
    total_gratuita:                     0,
    total_igv,
    total_descuento:                    0,
    total,

    // Info adicional
    medio_de_pago:                      body?.medio_de_pago || '',
    observaciones:                      `Compra online - ${plan.nombre}`,
    formato_de_pdf:                     'A4',

    // Flags
    enviar_automaticamente_a_la_sunat:  true,
    enviar_automaticamente_al_cliente:  !!cliente_email,

    // Línea del comprobante
    items: [
      {
        unidad_de_medida:  'NIU',
        codigo:            String(plan.id ?? 'ECS-PLAN'),
        descripcion:       plan.nombre,
        cantidad:          1,
        valor_unitario:    total_gravada,
        precio_unitario:   total,
        descuento:         0,
        subtotal:          total_gravada,
        tipo_de_igv:       1,              // 1 = Gravado
        igv:               total_igv,
        total:             total,
        anticipo_regularizacion: false,
      }
    ]
  }

  // ── 7. Llamar a PSE.PE ─────────────────────────────────────────────────
  let response: any
  try {
    response = await $fetch<any>(ECS_PSE_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json; charset=utf-8',
        'Authorization': ECS_PSE_TOKEN,
      },
      body: payload
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    console.error('[webhook-compra] PSE error:', JSON.stringify(detail))
    throw createError({
      statusCode: err?.status || 502,
      statusMessage: detail?.errors || detail?.error || 'Error al emitir boleta en PSE.PE'
    })
  }

  console.log('[webhook-compra] Boleta emitida:', SERIE_BOLETA + '-' + numero,
              '| aceptada_por_sunat:', response?.aceptada_por_sunat,
              '| total: S/', total)

  // ── 8. Guardar en Supabase ─────────────────────────────────────────────
  try {
    const toIso = (v: string) => {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v)
      return m ? `${m[3]}-${m[2]}-${m[1]}` : v
    }

    await supabase.from('comprobantes_pse').upsert({
      emitido_por:                 'webhook-web',
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
    console.error('[webhook-compra] Supabase error:', dbErr?.message)
    // No hacemos throw: la boleta ya existe en SUNAT
  }

  // ── 9. Actualizar log con éxito ────────────────────────────────────────
  await updateLog('success', {
    comprobante_serie:  SERIE_BOLETA,
    comprobante_numero: numero,
    enlace_pdf:         response?.enlace_del_pdf || null,
  })

  // ── 10. Respuesta a la página web ──────────────────────────────────────
  return {
    ok:                  true,
    serie:               SERIE_BOLETA,
    numero,
    aceptada_por_sunat:  !!response?.aceptada_por_sunat,
    enlace_pdf:          response?.enlace_del_pdf || null,
    codigo_hash:         response?.codigo_hash || null,
  }
})
