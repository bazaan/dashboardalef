/**
 * POST /api/piola/honorarios — recibos por honorarios (§7.5, setiembre)
 *
 * SOLO ADMINISTRADOR, igual que las boletas: es remuneración.
 *
 * Body:
 *   { accion: 'generar', periodo:'YYYY-MM', colaborador_email?, ajustes?, enviar? }
 *   { accion: 'guardar', id, serie?, numero?, descripcion?, monto_bruto?, ... }
 *   { accion: 'marcar_pagado', id, fecha_pago?, registrar_egreso? }
 *   { accion: 'enviar', id, email? }
 *   { accion: 'eliminar', id }
 *
 * QUÉ ES Y QUÉ NO ES ESTE DOCUMENTO
 * El recibo por honorarios ELECTRÓNICO lo emite el colaborador desde SUNAT con
 * su propia numeración. Acá se calcula el pago, se registra ese número cuando
 * llega y se imprime el documento interno. Generar el comprobante tributario
 * a nombre de otra persona no es algo que este sistema pueda ni deba hacer.
 *
 * La retención de 4.ª categoría (8 %) se salta con constancia de suspensión o
 * cuando el monto está bajo el tope mensual de SUNAT: las dos cosas se
 * informan en el documento, para que un recibo sin retención no quede mudo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAdmin, enviarCorreoPiola, segundoDiaHabil, hoyLima } from '../../utils/piola'
import { calcularHonorarios, htmlReciboHonorarios, subirDocumento } from '../../utils/piola-planilla'
import { notificarEvento } from '../../utils/piola-alertas'

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Rearma el documento HTML de un recibo ya guardado. */
async function documentoDe(supabase: any, recibo: any, generadoPor?: string) {
  const { data: colab } = await supabase.from('piola_colaboradores')
    .select('*').ilike('email', recibo.colaborador_email).maybeSingle()

  const calc = recibo.detalle?.calc || calcularHonorarios({
    monto_bruto: recibo.monto_bruto,
    suspension_renta: recibo.suspension_renta,
    retencion_pct: recibo.retencion_pct,
    otros_descuentos: recibo.otros_descuentos,
  })

  return htmlReciboHonorarios({
    colaborador: colab || { nombre: recibo.colaborador_nombre, ruc: recibo.colaborador_ruc },
    periodo: recibo.periodo,
    codigo: recibo.codigo,
    fecha_emision: recibo.fecha_emision,
    serie: recibo.serie,
    numero: recibo.numero,
    descripcion: recibo.descripcion,
    calc,
    generado_por: generadoPor || recibo.generado_por,
  })
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirAdmin(perfil, 'los recibos por honorarios')

  const body = await readBody(event)
  const accion = String(body?.accion || 'generar')

  /* ══════════ Editar: número del RH, monto, descripción ══════════ */
  if (accion === 'guardar') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el recibo a editar' })

    const { data: recibo } = await supabase.from('piola_recibos_honorarios')
      .select('*').eq('id', id).maybeSingle()
    if (!recibo) throw createError({ statusCode: 404, statusMessage: 'Recibo no encontrado' })
    if (recibo.estado === 'anulado') {
      throw createError({ statusCode: 400, statusMessage: 'Un recibo anulado no se edita' })
    }

    const patch: Record<string, any> = {}
    for (const k of ['serie', 'numero', 'descripcion', 'colaborador_ruc']) {
      if (k in body) patch[k] = texto(body[k])
    }
    if ('fecha_emision' in body) patch.fecha_emision = texto(body.fecha_emision) || recibo.fecha_emision

    // Si cambia la plata, se recalcula todo: nadie escribe el neto a mano
    const cambiaMonto = ['monto_bruto', 'retencion_pct', 'otros_descuentos', 'suspension_renta']
      .some(k => k in body)
    if (cambiaMonto) {
      const calc = calcularHonorarios({
        monto_bruto: numero(body?.monto_bruto) ?? recibo.monto_bruto,
        retencion_pct: 'retencion_pct' in body ? numero(body.retencion_pct) ?? undefined : recibo.retencion_pct,
        otros_descuentos: numero(body?.otros_descuentos) ?? recibo.otros_descuentos,
        suspension_renta: 'suspension_renta' in body ? !!body.suspension_renta : recibo.suspension_renta,
      })
      Object.assign(patch, {
        monto_bruto: calc.monto_bruto,
        retencion_pct: calc.retencion_pct,
        retencion_monto: calc.retencion_monto,
        otros_descuentos: calc.otros_descuentos,
        suspension_renta: calc.suspension_renta,
        neto: calc.neto,
        detalle: { ...(recibo.detalle || {}), calc },
      })
    }
    if (!Object.keys(patch).length) throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })

    const { data, error } = await supabase.from('piola_recibos_honorarios')
      .update(patch).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    // El documento se rehace: si no, el PDF diría una cifra y la tabla otra
    const url = await subirDocumento(supabase, `honorarios/${data.periodo}/${data.codigo}.html`,
      await documentoDe(supabase, data, perfil.email))
    if (url) await supabase.from('piola_recibos_honorarios').update({ pdf_url: url }).eq('id', id)

    return { ok: true, recibo: { ...data, pdf_url: url || data.pdf_url } }
  }

  /* ══════════ Marcar pagado → egreso en el flujo de caja ══════════ */
  if (accion === 'marcar_pagado') {
    const id = Number(body?.id)
    const { data: recibo } = await supabase.from('piola_recibos_honorarios')
      .select('*').eq('id', id).maybeSingle()
    if (!recibo) throw createError({ statusCode: 404, statusMessage: 'Recibo no encontrado' })

    const fechaPago = texto(body?.fecha_pago) || hoyLima()
    let transaccion = null

    /*
     * El egreso se registra por el NETO efectivamente pagado, no por el bruto:
     * la retención no sale de la caja de Piola en ese momento, se declara y se
     * paga aparte. Cargar el bruto inflaría el egreso del mes.
     */
    if (body?.registrar_egreso !== false && !recibo.transaction_id) {
      const { data: cat } = await supabase.from('piola_expense_categories')
        .select('id').eq('nombre', 'Planilla').is('parent_id', null).maybeSingle()

      const { data: tx } = await supabase.from('piola_transactions').insert({
        tipo: 'egreso',
        fecha: fechaPago,
        concepto: `Honorarios ${recibo.periodo} · ${recibo.colaborador_nombre || recibo.colaborador_email}`,
        monto: Number(recibo.neto || 0),
        category_id: cat?.id || null,
        payment_method: 'Transferencia bancaria',
        estado: 'pagado',
        monto_pagado: Number(recibo.neto || 0),
        notas: recibo.retencion_monto
          ? `Retención de 4.ª categoría de S/ ${recibo.retencion_monto} declarada aparte`
          : (recibo.detalle?.calc?.motivo_sin_retencion || null),
        created_by: perfil.email,
      }).select('*').single()
      transaccion = tx
    }

    const { data, error } = await supabase.from('piola_recibos_honorarios').update({
      estado: 'pagado',
      fecha_pago: fechaPago,
      transaction_id: transaccion?.id || recibo.transaction_id || null,
    }).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, recibo: data, transaccion }
  }

  /* ══════════ Enviar por correo ══════════ */
  if (accion === 'enviar') {
    const { data: recibo } = await supabase.from('piola_recibos_honorarios')
      .select('*').eq('id', body?.id).maybeSingle()
    if (!recibo) throw createError({ statusCode: 404, statusMessage: 'Recibo no encontrado' })

    const destino = texto(body?.email) || recibo.colaborador_email
    const envio = await enviarCorreoPiola({
      to: destino,
      subject: `Tu recibo por honorarios — ${recibo.periodo}`,
      html: await documentoDe(supabase, recibo),
    })
    if (!envio.ok) throw createError({ statusCode: 502, statusMessage: `No se pudo enviar: ${envio.error}` })

    const { data } = await supabase.from('piola_recibos_honorarios')
      .update({ enviado_at: new Date().toISOString(), enviado_a: destino })
      .eq('id', recibo.id).select('*').single()

    return { ok: true, enviado_a: destino, recibo: data }
  }

  /* ══════════ Eliminar ══════════ */
  if (accion === 'eliminar') {
    const id = Number(body?.id)
    const { data: recibo } = await supabase.from('piola_recibos_honorarios')
      .select('estado, transaction_id').eq('id', id).maybeSingle()
    if (!recibo) return { ok: true }

    // Un recibo ya pagado dejó rastro en la caja: se anula, no se borra
    if (recibo.estado === 'pagado' || recibo.transaction_id) {
      const { error } = await supabase.from('piola_recibos_honorarios')
        .update({ estado: 'anulado' }).eq('id', id)
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      return { ok: true, anulado: true, aviso: 'El recibo ya estaba pagado: se anuló en vez de borrarse.' }
    }

    const { error } = await supabase.from('piola_recibos_honorarios').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true, anulado: false }
  }

  /* ══════════ Generar ══════════ */
  const periodo = String(body?.periodo || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw createError({ statusCode: 400, statusMessage: "Periodo inválido: se espera 'YYYY-MM'" })
  }

  let query = supabase.from('piola_colaboradores').select('*')
    .eq('tipo_contrato', 'honorarios').eq('activo', true)
  if (body?.colaborador_email) query = query.ilike('email', String(body.colaborador_email))

  const { data: colaboradores } = await query
  if (!colaboradores?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No hay colaboradores por honorarios que coincidan. Los recibos solo aplican a tipo_contrato = honorarios.',
    })
  }

  const ajustes = body?.ajustes || {}
  const generados: any[] = []
  const errores: any[] = []

  for (const c of colaboradores) {
    const extra = ajustes[c.email] || ajustes[String(c.email).toLowerCase()] || {}
    const bruto = extra.monto_bruto ?? c.honorarios_monto ?? 0

    if (!Number(bruto)) {
      errores.push({
        colaborador: c.email,
        error: 'Sin monto pactado: cargarlo en la ficha (honorarios_monto) o indicarlo en el formulario',
      })
      continue
    }

    const calc = calcularHonorarios({
      monto_bruto: bruto,
      suspension_renta: extra.suspension_renta ?? c.suspension_renta ?? false,
      retencion_pct: extra.retencion_pct,
      otros_descuentos: extra.otros_descuentos ?? 0,
    })

    const codigo = `RH-${periodo.replace('-', '')}-${String(c.id).padStart(4, '0')}`
    const fila = {
      codigo,
      colaborador_email: c.email,
      colaborador_nombre: c.nombre,
      colaborador_ruc: c.ruc || null,
      periodo,
      fecha_emision: texto(body?.fecha_emision) || hoyLima(),
      serie: texto(extra.serie) || c.rh_serie || null,
      numero: texto(extra.numero),
      descripcion: texto(extra.descripcion) || `Servicios profesionales — ${periodo}`,
      monto_bruto: calc.monto_bruto,
      retencion_pct: calc.retencion_pct,
      retencion_monto: calc.retencion_monto,
      suspension_renta: calc.suspension_renta,
      otros_descuentos: calc.otros_descuentos,
      neto: calc.neto,
      detalle: { calc, ajustes: extra },
      generado_por: perfil.email,
    }

    const { data, error } = await supabase.from('piola_recibos_honorarios')
      .upsert(fila, { onConflict: 'colaborador_email,periodo' }).select('*').single()

    if (error) { errores.push({ colaborador: c.email, error: error.message }); continue }

    const html = htmlReciboHonorarios({
      colaborador: c, periodo, codigo, fecha_emision: data.fecha_emision,
      serie: data.serie, numero: data.numero, descripcion: data.descripcion,
      calc, generado_por: perfil.email,
    })
    const url = await subirDocumento(supabase, `honorarios/${periodo}/${codigo}.html`, html)
    if (url) {
      await supabase.from('piola_recibos_honorarios').update({ pdf_url: url }).eq('id', data.id)
      data.pdf_url = url
    }
    generados.push(data)

    if (body?.enviar) {
      const envio = await enviarCorreoPiola({
        to: c.email, subject: `Tu recibo por honorarios — ${periodo}`, html,
      })
      if (envio.ok) {
        await supabase.from('piola_recibos_honorarios')
          .update({ enviado_at: new Date().toISOString(), enviado_a: c.email }).eq('id', data.id)
      } else {
        errores.push({ colaborador: c.email, error: `Recibo generado pero el correo falló: ${envio.error}` })
      }
    }
  }

  if (generados.length) {
    await notificarEvento(supabase, {
      evento: 'recibo_honorarios_generado',
      related_table: 'piola_recibos_honorarios',
      related_id: generados[0].id,
      monto: generados.reduce((s, r) => s + Number(r.neto || 0), 0),
      titulo: `${generados.length} recibo(s) por honorarios de ${periodo}`,
      mensaje: `🧾 *Recibos por honorarios generados*\nPeriodo ${periodo} · ${generados.length} colaborador(es)\n`
        + `Neto total: S/ ${generados.reduce((s, r) => s + Number(r.neto || 0), 0).toFixed(2)}`,
      actor: perfil.email,
    })
  }

  return {
    ok: true,
    periodo,
    fecha_limite_pago: segundoDiaHabil(periodo),   // §7.4, igual que las boletas
    generados: generados.length,
    recibos: generados,
    errores,
  }
})
