/**
 * POST /api/piola/factura — emisión de facturas electrónicas con detracción (§5)
 *
 * El ~98 % de las facturas de Piola llevan detracción, así que aquí es el
 * camino por defecto (`con_detraccion` es true salvo que se diga lo contrario).
 *
 * Body:
 *   { accion: 'emitir', cliente_id?, cliente:{...}, items:[{descripcion,cantidad,valor_unitario,unidad?}],
 *     serie?, numero?, numeracion_manual?, contrato_id?, periodo_facturado?, programada_id?,
 *     fecha_emision?, fecha_vencimiento?,
 *     con_detraccion?, detraccion_pct?, detraccion_codigo?, observaciones? }
 *   { accion: 'emitir_borrador', id }  → manda al PSE una factura ya guardada
 *   { accion: 'marcar_pagada', id }    → además crea el ingreso en flujo de caja
 *   { accion: 'anular', id, motivo }
 *   { accion: 'enviar', id, email }
 *   { accion: 'siguiente_numero', tipo_comprobante?, serie? }  → correlativo sugerido
 *
 * NUMERACIÓN MANUAL (setiembre): Piola ya tiene una numeración corriendo fuera
 * del sistema, así que la serie y el número se pueden escribir a mano. El
 * sistema SUGIERE el siguiente correlativo, no lo impone; lo que sí sigue
 * impidiendo repetir un número es el UNIQUE (tipo_comprobante, serie, numero)
 * de la tabla, que ahora se traduce a un 409 legible en vez de un error de
 * Postgres crudo.
 *
 * CONEXIÓN SUNAT: se emite por el PSE de Alef (PSE.PE / NubeFact), igual que
 * el resto del grupo. Piola todavía no está dada de alta en el reseller: hasta
 * que existan PIOLA_PSE_URL y PIOLA_PSE_TOKEN, el comprobante se guarda como
 * BORRADOR con su numeración y su PDF, sin enviarse a SUNAT. Así el módulo es
 * usable desde el día uno y el día que llegan las credenciales no cambia nada
 * más que el .env.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionPiola, exigirModulo, calcularTotales, DETRACCION_PCT_DEFAULT, hoyLima,
} from '../../utils/piola'
import { htmlFactura } from '../../utils/piola-factura'
import { subirDocumento } from '../../utils/piola-planilla'
import { notificarEvento } from '../../utils/piola-alertas'
import { esRucValido } from '../../../composables/rules'

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' (formato que exige NubeFact). */
function fechaNubefact(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirModulo(perfil, 'facturacion', 'view')

  const body = await readBody(event)
  const accion = String(body?.accion || 'emitir')

  /* ══════════ Correlativo sugerido para la serie elegida ══════════ */
  if (accion === 'siguiente_numero') {
    const tipo = Number(body?.tipo_comprobante || 1)
    const serie = String(body?.serie || (tipo === 1 ? 'F001' : 'B001')).toUpperCase()
    const { data: ultima } = await supabase.from('piola_invoices')
      .select('numero').eq('tipo_comprobante', tipo).eq('serie', serie)
      .order('numero', { ascending: false }).limit(1).maybeSingle()
    return { ok: true, serie, numero: Number(ultima?.numero || 0) + 1, ultimo: Number(ultima?.numero || 0) }
  }

  /* ══════════ Marcar pagada → alimenta el flujo de caja (§5) ══════════ */
  if (accion === 'marcar_pagada') {
    exigirModulo(perfil, 'facturacion', 'edit')
    const { data: inv } = await supabase.from('piola_invoices').select('*').eq('id', body?.id).maybeSingle()
    if (!inv) throw createError({ statusCode: 404, statusMessage: 'Factura no encontrada' })

    const { data: actualizada, error } = await supabase.from('piola_invoices')
      .update({ estado: 'pagada', pagada_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', inv.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Ingreso en caja: el neto realmente cobrado (total − detracción)
    const { data: yaExiste } = await supabase
      .from('piola_transactions').select('id').eq('invoice_id', inv.id).maybeSingle()

    let transaccion = null
    if (!yaExiste) {
      const { data: cat } = await supabase.from('piola_expense_categories')
        .select('id').eq('nombre', 'Ventas').is('parent_id', null).maybeSingle()

      const { data: tx } = await supabase.from('piola_transactions').insert({
        tipo: 'ingreso',
        fecha: body?.fecha_pago || hoyLima(),
        concepto: `Cobro ${inv.serie}-${inv.numero} · ${inv.cliente_nombre || ''}`.trim(),
        monto: inv.con_detraccion ? Number(inv.neto_a_pagar || inv.total) : Number(inv.total),
        category_id: cat?.id || null,
        cliente_id: inv.cliente_id,
        payment_method: 'Transferencia bancaria',
        invoice_id: inv.id,
        notas: inv.con_detraccion
          ? `Detracción de ${inv.detraccion_pct}% (S/ ${inv.detraccion_monto}) depositada en el Banco de la Nación`
          : null,
        created_by: perfil.email,
      }).select('*').single()
      transaccion = tx
    }

    await notificarEvento(supabase, {
      evento: 'factura_pagada',
      related_table: 'piola_invoices',
      related_id: inv.id,
      monto: Number(inv.con_detraccion ? inv.neto_a_pagar || inv.total : inv.total),
      titulo: `Factura ${inv.serie}-${inv.numero} cobrada`,
      mensaje: `💵 *Factura cobrada*\n${inv.serie}-${inv.numero} — ${inv.cliente_nombre || 'cliente'}\n`
        + `Cobrado: S/ ${Number(inv.con_detraccion ? inv.neto_a_pagar || inv.total : inv.total).toFixed(2)}`
        + (inv.con_detraccion ? `\nDetracción de S/ ${inv.detraccion_monto} al Banco de la Nación` : ''),
      actor: perfil.email,
    })

    return { ok: true, factura: actualizada, transaccion }
  }

  /* ══════════ Anular ══════════ */
  if (accion === 'anular') {
    exigirModulo(perfil, 'facturacion', 'edit')
    const { data, error } = await supabase.from('piola_invoices').update({
      estado: 'anulada',
      notas: body?.motivo || null,
      updated_at: new Date().toISOString(),
    }).eq('id', body?.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true, factura: data }
  }

  /* ══════════ Enviar por correo ══════════ */
  if (accion === 'enviar') {
    const { data: inv } = await supabase.from('piola_invoices').select('*').eq('id', body?.id).maybeSingle()
    if (!inv) throw createError({ statusCode: 404, statusMessage: 'Factura no encontrada' })

    const destino = body?.email || inv.cliente_email
    if (!destino) throw createError({ statusCode: 400, statusMessage: 'No hay correo de destino' })

    const { enviarCorreoPiola } = await import('../../utils/piola')
    const envio = await enviarCorreoPiola({
      to: destino,
      subject: `Comprobante ${inv.serie}-${inv.numero}`,
      html: htmlFactura(inv),
    })
    if (!envio.ok) throw createError({ statusCode: 502, statusMessage: `No se pudo enviar: ${envio.error}` })

    const { data } = await supabase.from('piola_invoices').update({
      estado: inv.estado === 'emitida' ? 'enviada' : inv.estado,
      enviada_at: new Date().toISOString(),
    }).eq('id', inv.id).select('*').single()

    return { ok: true, enviado_a: destino, factura: data }
  }

  /* ══════════ Emitir ══════════ */
  exigirModulo(perfil, 'facturacion', 'create')

  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) throw createError({ statusCode: 400, statusMessage: 'La factura no tiene ítems' })

  // Cliente: por id o incrustado en el body
  let cliente: any = body?.cliente || {}
  if (body?.cliente_id) {
    const { data } = await supabase.from('piola_clientes').select('*').eq('id', body.cliente_id).maybeSingle()
    if (data) cliente = { ...data, ...cliente }
  }
  if (!cliente?.nombre && !cliente?.razon_social) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el cliente de la factura' })
  }

  const tipo = Number(body?.tipo_comprobante || 1)          // 1 factura, 2 boleta

  /*
   * RUC: 11 dígitos. Se valida también acá y no solo en la UI, porque el
   * endpoint es alcanzable sin pasar por el formulario. Una factura (tipo 1)
   * sin RUC la rechaza SUNAT, así que ahí además es obligatorio.
   */
  const rucCliente = String(cliente.ruc ?? '').trim()
  if (rucCliente && !esRucValido(rucCliente)) {
    throw createError({ statusCode: 400, statusMessage: 'El RUC debe tener 11 dígitos' })
  }
  if (tipo === 1 && !rucCliente) {
    throw createError({ statusCode: 400, statusMessage: 'Una factura necesita el RUC del cliente' })
  }
  cliente.ruc = rucCliente || null
  const serie = String(body?.serie || (tipo === 1 ? 'F001' : 'B001')).toUpperCase()
  const conDetraccion = body?.con_detraccion !== false      // por defecto SÍ (§5)
  const detraccionPct = Number(body?.detraccion_pct ?? DETRACCION_PCT_DEFAULT)

  const totales = calcularTotales(items, { conDetraccion, detraccionPct })

  /*
   * Numeración. El número puede venir escrito a mano (Piola arrastra una
   * numeración anterior al sistema) o calcularse como MAX + 1.
   *
   * Cuando viene a mano se comprueba ANTES de emitir que no exista: si no, el
   * choque salta como un error de índice único de Postgres después de haber
   * mandado el comprobante al PSE — quedaría emitido en SUNAT y sin guardar acá.
   */
  const numeracionManual = !!body?.numeracion_manual && Number(body?.numero) > 0
  let numero = Number(body?.numero || 0)

  if (numeracionManual) {
    const { data: choque } = await supabase.from('piola_invoices')
      .select('id, estado').eq('tipo_comprobante', tipo).eq('serie', serie).eq('numero', numero).maybeSingle()
    if (choque) {
      throw createError({
        statusCode: 409,
        statusMessage: `El comprobante ${serie}-${numero} ya existe (estado: ${choque.estado}). Usá otro número.`,
      })
    }
  } else if (!numero) {
    const { data: ultima } = await supabase.from('piola_invoices')
      .select('numero').eq('tipo_comprobante', tipo).eq('serie', serie)
      .order('numero', { ascending: false }).limit(1).maybeSingle()
    numero = Number(ultima?.numero || 0) + 1
  }

  const fechaEmision = String(body?.fecha_emision || hoyLima()).slice(0, 10)
  const fila: Record<string, any> = {
    cliente_id: body?.cliente_id || null,
    cliente_nombre: cliente.razon_social || cliente.nombre,
    cliente_ruc: cliente.ruc || null,
    tipo_comprobante: tipo,
    serie,
    numero,
    fecha_emision: fechaEmision,
    fecha_vencimiento: body?.fecha_vencimiento || null,
    moneda: 'PEN',
    subtotal: totales.subtotal,
    igv: totales.igv,
    total: totales.total,
    con_detraccion: conDetraccion,
    detraccion_codigo: conDetraccion ? (body?.detraccion_codigo || null) : null,
    detraccion_pct: conDetraccion ? detraccionPct : 0,
    detraccion_monto: totales.detraccion_monto,
    neto_a_pagar: totales.neto_a_pagar,
    items,
    numeracion_manual: numeracionManual,
    contrato_id: Number(body?.contrato_id) || null,
    periodo_facturado: body?.periodo_facturado || null,
    origen: body?.programada_id ? 'recurrente' : 'manual',
    cliente_email: cliente.email || null,
    cliente_direccion: cliente.direccion || null,
    notas: body?.observaciones || null,
    created_by: perfil.email,
  }

  /* ── Envío a SUNAT vía el PSE, si Piola ya tiene credenciales ── */
  const pseUrl = process.env.PIOLA_PSE_URL
  const pseToken = process.env.PIOLA_PSE_TOKEN
  let respuestaSunat: any = null

  if (pseUrl && pseToken) {
    const payload = {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: tipo,
      serie,
      numero,
      sunat_transaction: 1,
      cliente_tipo_de_documento: cliente.ruc ? 6 : 1,
      cliente_numero_de_documento: cliente.ruc || cliente.dni || '',
      cliente_denominacion: cliente.razon_social || cliente.nombre,
      cliente_direccion: cliente.direccion || '',
      cliente_email: cliente.email || '',
      fecha_de_emision: fechaNubefact(fechaEmision),
      fecha_de_vencimiento: fila.fecha_vencimiento ? fechaNubefact(String(fila.fecha_vencimiento)) : '',
      moneda: 1,
      porcentaje_de_igv: 18.0,
      total_gravada: totales.subtotal,
      total_igv: totales.igv,
      total: totales.total,
      detraccion: conDetraccion,
      detraccion_tipo: body?.detraccion_codigo || '',
      detraccion_porcentaje: conDetraccion ? detraccionPct : '',
      detraccion_total: conDetraccion ? totales.detraccion_monto : '',
      observaciones: body?.observaciones || '',
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: false,
      formato_de_pdf: 'A4',
      items: items.map((it: any) => ({
        unidad_de_medida: it.unidad || 'ZZ',
        codigo: it.codigo || '',
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad || 1),
        valor_unitario: Number(it.valor_unitario || 0),
        precio_unitario: Math.round(Number(it.valor_unitario || 0) * 1.18 * 100) / 100,
        subtotal: Math.round(Number(it.cantidad || 1) * Number(it.valor_unitario || 0) * 100) / 100,
        tipo_de_igv: 1,
        igv: Math.round(Number(it.cantidad || 1) * Number(it.valor_unitario || 0) * 0.18 * 100) / 100,
        total: Math.round(Number(it.cantidad || 1) * Number(it.valor_unitario || 0) * 1.18 * 100) / 100,
        anticipo_regularizacion: false,
      })),
    }

    try {
      respuestaSunat = await $fetch<any>(pseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: pseToken },
        body: payload,
      })
      fila.estado = 'emitida'
      fila.sunat_response = respuestaSunat
      fila.aceptada_por_sunat = !!respuestaSunat?.aceptada_por_sunat
      fila.xml_url = respuestaSunat?.enlace_del_xml || null
    } catch (err: any) {
      const detalle = err?.data ?? err?.response?._data ?? err?.message ?? String(err)
      fila.estado = 'error'
      fila.sunat_response = { error: detalle }
      console.error('[piola/factura] error PSE:', JSON.stringify(detalle))
    }
  } else {
    fila.estado = 'borrador'
    fila.sunat_response = {
      aviso: 'PIOLA_PSE_URL / PIOLA_PSE_TOKEN no configurados: el comprobante se guardó como borrador y NO se envió a SUNAT.',
    }
  }

  const { data: guardada, error } = await supabase.from('piola_invoices')
    .upsert(fila, { onConflict: 'tipo_comprobante,serie,numero' }).select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error guardando la factura: ${error.message}` })

  // PDF con branding Piola (HTML imprimible). Si el PSE devolvió el suyo, se prefiere ese.
  const html = htmlFactura({ ...guardada, cliente })
  const url = respuestaSunat?.enlace_del_pdf
    || await subirDocumento(supabase, `facturas/${serie}-${numero}.html`, html)
  if (url) {
    await supabase.from('piola_invoices').update({ pdf_url: url }).eq('id', guardada.id)
    guardada.pdf_url = url
  }

  /* ── Si venía de una factura programada, se cierra el círculo ── */
  if (body?.programada_id) {
    await supabase.from('piola_facturas_programadas').update({
      estado: 'generada',
      invoice_id: guardada.id,
      generada_at: new Date().toISOString(),
      generada_por: perfil.email,
    }).eq('id', Number(body.programada_id))
  }

  /* ── Documentos que acompañan al comprobante (constancia de detracción,
       contrato, orden de compra). Llegan ya subidos al bucket. ── */
  const adjuntos = Array.isArray(body?.documentos) ? body.documentos : []
  if (adjuntos.length) {
    await supabase.from('piola_documentos').insert(adjuntos
      .filter((d: any) => d?.path)
      .map((d: any) => ({
        entidad: 'factura',
        entidad_id: guardada.id,
        tipo: d.tipo || 'otro',
        nombre: d.nombre || String(d.path).split('/').pop(),
        path: d.path,
        mime: d.mime || null,
        tamano_bytes: Number(d.tamano_bytes) || null,
        subido_por: perfil.email,
      })))
  }

  await notificarEvento(supabase, {
    evento: 'factura_emitida',
    related_table: 'piola_invoices',
    related_id: guardada.id,
    monto: totales.total,
    titulo: `${fila.estado === 'borrador' ? 'Borrador' : 'Factura'} ${serie}-${numero}`,
    mensaje: `🧾 *${fila.estado === 'borrador' ? 'Comprobante en borrador' : 'Comprobante emitido'}*\n`
      + `${serie}-${numero} — ${fila.cliente_nombre}\n`
      + `Total: S/ ${totales.total.toFixed(2)}`
      + (conDetraccion ? `\nNeto a cobrar: S/ ${totales.neto_a_pagar.toFixed(2)} (detracción ${detraccionPct} %)` : ''),
    actor: perfil.email,
  })

  return {
    ok: true,
    factura: guardada,
    totales,
    emitida_a_sunat: fila.estado === 'emitida',
    aviso: fila.estado === 'borrador'
      ? 'Guardada como BORRADOR: Piola aún no tiene credenciales de emisión (PIOLA_PSE_URL / PIOLA_PSE_TOKEN). El correlativo y el PDF ya están listos.'
      : null,
  }
})
