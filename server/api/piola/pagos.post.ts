/**
 * POST /api/piola/pagos — cobros y pagos contra una cuenta (§5)
 *
 * Body:
 *   { accion: 'registrar', transaction_id, fecha?, monto?, descuento?, motivo_descuento?,
 *     autorizado_por?, payment_method?, referencia?, constancia_url?, observaciones? }
 *   { accion: 'eliminar', id }
 *
 * Acá se mueve plata, así que la validación NO puede vivir en el navegador:
 * el saldo pendiente se recalcula contra `piola_transactions` en cada request.
 * Si el cliente manda un monto mayor al que se debe, se rechaza — daba igual lo
 * que la pantalla creyera que faltaba cuando abrió el diálogo.
 *
 * El estado de la cuenta (pendiente → parcial → pagado) NO se toca desde acá:
 * lo recalcula el trigger `piola_recalcular_saldo()` al insertar o borrar el pago.
 *
 * Registrar dispara además el aviso inmediato por WhatsApp `cobro_registrado`
 * (reunión 31/08/2026). Eliminar NO avisa: es una corrección, y avisarla haría
 * que el equipo recibiera dos mensajes contradictorios por el mismo cobro.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, hoyLima } from '../../utils/piola'
import { dispararAlertaInmediata } from '../../utils/piola-alertas'

const money = (n: any) => `S/ ${Number(n || 0).toLocaleString('es-PE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Registrar un cobro o un pago ══════════ */
  if (accion === 'registrar') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const txId = Number(body?.transaction_id)
    if (!txId) throw createError({ statusCode: 400, statusMessage: 'Falta la cuenta a la que aplicar el pago' })

    const monto = Math.round(Number(body?.monto || 0) * 100) / 100
    const descuento = Math.round(Number(body?.descuento || 0) * 100) / 100
    if (!(monto > 0) && !(descuento > 0)) {
      throw createError({ statusCode: 400, statusMessage: 'El pago necesita un monto o un descuento' })
    }
    if (monto < 0 || descuento < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Ni el monto ni el descuento pueden ser negativos' })
    }

    const motivo = String(body?.motivo_descuento || '').trim()
    if (descuento > 0 && !motivo) {
      throw createError({ statusCode: 400, statusMessage: 'Un descuento necesita su motivo' })
    }

    // El saldo real, recalculado ahora: es la única cifra en la que se confía.
    const { data: cuenta } = await supabase
      .from('piola_transactions').select('id, tipo, monto, monto_pagado, estado, concepto')
      .eq('id', txId).maybeSingle()
    if (!cuenta) throw createError({ statusCode: 404, statusMessage: 'La cuenta no existe' })
    if (cuenta.estado === 'anulado') {
      throw createError({ statusCode: 400, statusMessage: 'La cuenta está anulada: no admite pagos' })
    }

    const saldo = Math.round(Math.max(Number(cuenta.monto || 0) - Number(cuenta.monto_pagado || 0), 0) * 100) / 100
    // Tolerancia de 1 céntimo, por el redondeo de los porcentajes
    if (monto + descuento > saldo + 0.01) {
      throw createError({
        statusCode: 400,
        statusMessage: `El pago (S/ ${(monto + descuento).toFixed(2)}) supera el saldo pendiente (S/ ${saldo.toFixed(2)})`,
      })
    }

    const { data, error } = await supabase.from('piola_pagos').insert({
      transaction_id: txId,
      fecha: String(body?.fecha || '').slice(0, 10) || hoyLima(),
      monto,
      descuento,
      motivo_descuento: descuento > 0 ? motivo : null,
      autorizado_por: descuento > 0 ? (body?.autorizado_por || null) : null,
      payment_method: body?.payment_method || null,
      referencia: body?.referencia || null,
      constancia_url: body?.constancia_url || null,
      observaciones: body?.observaciones || null,
      // Quién lo registró lo pone el servidor: no se acepta del cliente
      registrado_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    /* Aviso inmediato por WhatsApp (reunión 31/08/2026). Roberto: "cada vez que
     * hay un movimiento… que se haya pagado, se haya hecho un registro… ahí les
     * llega la notificación".
     *
     * Se espera el resultado porque en Netlify la función se congela al
     * responder y una promesa suelta no llegaría a enviarse. La alerta nunca
     * lanza: el pago ya está guardado y es lo único que no se puede perder. */
    const esCobro = cuenta.tipo === 'ingreso'
    const restante = Math.round(Math.max(saldo - monto - descuento, 0) * 100) / 100
    const aviso = await dispararAlertaInmediata(supabase, {
      tipo: 'cobro_registrado',
      related_table: 'piola_pagos',
      related_id: data?.id ?? null,
      titulo: `${esCobro ? 'Cobro' : 'Pago'} de ${money(monto)} — ${cuenta.concepto}`,
      mensaje: [
        `${esCobro ? '💰' : '📤'} *${esCobro ? 'Cobro' : 'Pago'} registrado*`,
        cuenta.concepto || '(sin concepto)',
        `Monto: ${money(monto)}`,
        descuento > 0 ? `Descuento: ${money(descuento)} (${motivo})` : '',
        `Saldo pendiente: ${money(restante)}${restante <= 0 ? ' — cuenta saldada' : ''}`,
        body?.payment_method ? `Método: ${body.payment_method}` : '',
        body?.referencia ? `Operación: ${body.referencia}` : '',
        `Registró: ${perfil.email}`,
      ].filter(Boolean).join('\n'),
    })

    return { ok: true, pago: data, alerta: aviso }
  }

  /* ══════════ Eliminar un pago ══════════ */
  if (accion === 'eliminar') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el pago a eliminar' })

    const { error } = await supabase.from('piola_pagos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
