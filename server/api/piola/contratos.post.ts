/**
 * POST /api/piola/contratos — contratos de cliente, adendas y facturación recurrente
 *
 * Body:
 *   { accion: 'guardar', id?, nombre_cliente, fecha_inicio, fecha_cierre, ... }
 *   { accion: 'eliminar', id }
 *   { accion: 'adenda_crear', contrato_id, descripcion, fecha?, importe?, archivo_pdf? }
 *   { accion: 'adenda_eliminar', id }
 *   { accion: 'programar_recurrentes', contrato_id }        → arma el calendario de facturas
 *   { accion: 'generar_programada', id }                    → crea el BORRADOR de esa factura
 *   { accion: 'generar_pendientes', hasta? }                → todas las vencidas de una vez
 *   { accion: 'omitir_programada', id, motivo? }
 *
 * DE FACTURACIÓN A CLIENTES (setiembre)
 * El módulo pasó a ser 'clientes': el contrato es la relación con el cliente,
 * no el cobro. Con Finanzas restringida a dos personas, dejarlo bajo
 * 'facturacion' habría dejado a comercial y producción sin sus propios
 * contratos.
 *
 * LA AUTOMATIZACIÓN LLEGA HASTA EL BORRADOR
 * La programación crea las facturas del periodo de vigencia como BORRADOR y
 * avisa; nunca las emite sola. Una factura emitida sin que nadie la mire es un
 * documento tributario con la firma de la empresa, y anularla ante SUNAT
 * cuesta bastante más que revisarla antes.
 *
 * `company_id` lo fija el servidor en 'piola': es el campo que aísla las
 * empresas del grupo y no se acepta del navegador.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, calcularTotales, hoyLima, sumarDias } from '../../utils/piola'
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

/** Cuántos meses avanza cada emisión según la frecuencia pactada. */
const PASO_MESES: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12, unico: 0,
}

/**
 * Periodos 'YYYY-MM' y fechas de emisión que cubre la vigencia del contrato.
 *
 * El día se topea en 28 (igual que el CHECK de la tabla): el 30 no existe en
 * febrero, y una fecha inválida sería una factura que nunca vence.
 */
function calendarioDeFacturas(
  inicio: string, cierre: string, frecuencia: string, dia: number
): Array<{ periodo: string; fecha: string }> {
  const paso = PASO_MESES[frecuencia] ?? 1
  const diaSeguro = Math.min(28, Math.max(1, Number(dia) || 1))
  const salida: Array<{ periodo: string; fecha: string }> = []

  const [yi, mi] = inicio.slice(0, 7).split('-').map(Number)
  const finPeriodo = cierre.slice(0, 7)

  if (paso === 0) {   // pago único: una sola, al inicio
    return [{ periodo: inicio.slice(0, 7), fecha: `${inicio.slice(0, 7)}-${String(diaSeguro).padStart(2, '0')}` }]
  }

  // Tope duro de 120 emisiones: 10 años mensuales. Un contrato con la fecha de
  // cierre mal tipeada (2226 en vez de 2026) no puede generar 2 400 filas.
  for (let n = 0; n < 120; n++) {
    const d = new Date(Date.UTC(yi, mi - 1 + n * paso, 1))
    const periodo = d.toISOString().slice(0, 7)
    if (periodo > finPeriodo) break
    salida.push({ periodo, fecha: `${periodo}-${String(diaSeguro).padStart(2, '0')}` })
  }
  return salida
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Contrato ══════════ */
  if (accion === 'guardar') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'clientes', id ? 'edit' : 'create')

    const nombreCliente = texto(body?.nombre_cliente)
    if (!nombreCliente) {
      throw createError({ statusCode: 400, statusMessage: 'El contrato necesita el nombre del cliente' })
    }

    const inicio = texto(body?.fecha_inicio)
    const cierre = texto(body?.fecha_cierre)
    if (inicio && cierre && cierre < inicio) {
      throw createError({ statusCode: 400, statusMessage: 'La fecha de cierre no puede ser anterior al inicio' })
    }

    const recurrente = !!body?.facturacion_recurrente
    if (recurrente && (!inicio || !cierre)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Para programar facturas recurrentes hacen falta la fecha de inicio y la de cierre',
      })
    }

    const fila: Record<string, any> = {
      // Aislamiento entre empresas: no se acepta del cliente
      company_id: 'piola',
      cliente_id: numero(body?.cliente_id),
      nombre_cliente: nombreCliente,
      codigo: texto(body?.codigo),
      descripcion: texto(body?.descripcion),
      ruc: texto(body?.ruc),
      fecha_inicio: inicio,
      fecha_cierre: cierre,
      estado: texto(body?.estado) || 'vigente',
      importe_pagado: Number(body?.importe_pagado || 0),
      monto_total: numero(body?.monto_total),
      monto_periodico: numero(body?.monto_periodico),
      moneda: texto(body?.moneda) || 'PEN',
      modalidad_pago: texto(body?.modalidad_pago),
      facturacion_recurrente: recurrente,
      frecuencia: texto(body?.frecuencia) || 'mensual',
      dia_facturacion: Math.min(28, Math.max(1, Number(body?.dia_facturacion) || 1)),
      con_detraccion: body?.con_detraccion !== false,
      detraccion_pct: numero(body?.detraccion_pct) ?? 12,
      detraccion_codigo: texto(body?.detraccion_codigo),
      serie_factura: texto(body?.serie_factura),
      renovacion_automatica: !!body?.renovacion_automatica,
      responsable_email: texto(body?.responsable_email),
      contrato_pdf: texto(body?.contrato_pdf),
      notas: texto(body?.notas),
      updated_at: new Date().toISOString(),
    }
    if (!id) fila.created_by = perfil.email

    const res = id
      ? await supabase.from('piola_contratos').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_contratos').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    // Programar el calendario en el mismo paso: si no, el contrato queda
    // marcado como recurrente y sin una sola factura programada, que es la
    // forma más discreta de no facturar durante meses.
    let programadas = 0
    if (recurrente) programadas = await programar(supabase, res.data)

    if (!id) {
      await notificarEvento(supabase, {
        evento: 'contrato_creado',
        related_table: 'piola_contratos',
        related_id: res.data.id,
        titulo: `Nuevo contrato: ${res.data.nombre_cliente}`,
        mensaje: `📑 *Contrato registrado*\n${res.data.nombre_cliente}\n`
          + `Vigencia: ${res.data.fecha_inicio || '—'} → ${res.data.fecha_cierre || '—'}`
          + (recurrente ? `\nFacturación ${res.data.frecuencia}: ${programadas} factura(s) programada(s)` : ''),
        actor: perfil.email,
      })
    }

    return { ok: true, contrato: res.data, programadas }
  }

  if (accion === 'eliminar') {
    exigirModulo(perfil, 'clientes', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el contrato a eliminar' })

    // Un contrato con facturas ya emitidas es el respaldo de esas facturas
    const { count } = await supabase.from('piola_invoices')
      .select('id', { count: 'exact', head: true }).eq('contrato_id', id).neq('estado', 'anulada')
    if (count) {
      throw createError({
        statusCode: 400,
        statusMessage: `Ese contrato respalda ${count} factura(s) emitida(s): anúlalo en vez de borrarlo`,
      })
    }

    const { error } = await supabase.from('piola_contratos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Adendas ══════════ */
  if (accion === 'adenda_crear') {
    exigirModulo(perfil, 'clientes', 'create')

    const contratoId = Number(body?.contrato_id)
    const descripcion = texto(body?.descripcion)
    if (!contratoId || !descripcion) {
      throw createError({ statusCode: 400, statusMessage: 'La adenda necesita contrato y descripción' })
    }

    const { data, error } = await supabase.from('piola_adendas').insert({
      contrato_id: contratoId,
      fecha: texto(body?.fecha),
      descripcion,
      importe: Number(body?.importe || 0),
      archivo_pdf: texto(body?.archivo_pdf),
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, adenda: data }
  }

  if (accion === 'adenda_eliminar') {
    exigirModulo(perfil, 'clientes', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la adenda a eliminar' })

    const { error } = await supabase.from('piola_adendas').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Facturación recurrente ══════════ */
  if (accion === 'programar_recurrentes') {
    exigirModulo(perfil, 'clientes', 'edit')

    const { data: contrato } = await supabase.from('piola_contratos')
      .select('*').eq('id', Number(body?.contrato_id)).maybeSingle()
    if (!contrato) throw createError({ statusCode: 404, statusMessage: 'Contrato no encontrado' })
    if (!contrato.fecha_inicio || !contrato.fecha_cierre) {
      throw createError({ statusCode: 400, statusMessage: 'El contrato necesita fecha de inicio y de cierre' })
    }

    const programadas = await programar(supabase, contrato)
    return { ok: true, programadas }
  }

  if (accion === 'omitir_programada') {
    exigirModulo(perfil, 'clientes', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la factura programada' })

    const { error } = await supabase.from('piola_facturas_programadas').update({
      estado: 'omitida',
      error_message: texto(body?.motivo),
      generada_por: perfil.email,
      generada_at: new Date().toISOString(),
    }).eq('id', id).eq('estado', 'pendiente')
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'generar_programada' || accion === 'generar_pendientes') {
    // Genera BORRADORES de factura: por eso pide permiso de facturación, no de
    // clientes. Quien administra contratos programa; quien factura, emite.
    exigirModulo(perfil, 'facturacion', 'create')

    let query = supabase.from('piola_facturas_programadas')
      .select('*, contrato:piola_contratos(*)').eq('estado', 'pendiente')

    if (accion === 'generar_programada') {
      const id = Number(body?.id)
      if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la factura programada' })
      query = query.eq('id', id)
    } else {
      // Por defecto, lo que ya tocaba: no se adelanta trabajo de meses futuros
      query = query.lte('fecha_programada', texto(body?.hasta) || hoyLima()).order('fecha_programada')
    }

    const { data: pendientes, error: errQ } = await query
    if (errQ) throw createError({ statusCode: 500, statusMessage: errQ.message })
    if (!pendientes?.length) return { ok: true, generadas: 0, facturas: [], aviso: 'No hay facturas programadas pendientes' }

    const generadas: any[] = []
    const errores: any[] = []

    for (const prog of pendientes) {
      const c = (prog as any).contrato || {}
      try {
        const serie = String(c.serie_factura || 'F001').toUpperCase()
        const { data: ultima } = await supabase.from('piola_invoices')
          .select('numero').eq('tipo_comprobante', 1).eq('serie', serie)
          .order('numero', { ascending: false }).limit(1).maybeSingle()
        const numeroFactura = Number(ultima?.numero || 0) + 1

        const items = [{
          descripcion: prog.concepto || `Servicios ${prog.periodo} — ${c.nombre_cliente}`,
          cantidad: 1,
          // El monto del contrato es el TOTAL con IGV; el ítem va sin IGV
          valor_unitario: Math.round(Number(prog.monto || 0) / 1.18 * 100) / 100,
        }]
        const totales = calcularTotales(items, {
          conDetraccion: c.con_detraccion !== false,
          detraccionPct: Number(c.detraccion_pct ?? 12),
        })

        const { data: factura, error } = await supabase.from('piola_invoices').insert({
          cliente_id: prog.cliente_id,
          cliente_nombre: c.nombre_cliente,
          cliente_ruc: c.ruc || null,
          contrato_id: c.id,
          periodo_facturado: prog.periodo,
          tipo_comprobante: 1,
          serie,
          numero: numeroFactura,
          fecha_emision: hoyLima(),
          // Sin condición pactada, 30 días es el estándar del rubro
          fecha_vencimiento: sumarDias(hoyLima(), 30),
          moneda: c.moneda || 'PEN',
          subtotal: totales.subtotal,
          igv: totales.igv,
          total: totales.total,
          con_detraccion: c.con_detraccion !== false,
          detraccion_pct: c.con_detraccion !== false ? Number(c.detraccion_pct ?? 12) : 0,
          detraccion_codigo: c.detraccion_codigo || null,
          detraccion_monto: totales.detraccion_monto,
          neto_a_pagar: totales.neto_a_pagar,
          items,
          // BORRADOR a propósito: la automatización deja lista la factura, la
          // emisión a SUNAT la dispara una persona desde Facturación.
          estado: 'borrador',
          origen: 'recurrente',
          notas: `Generada automáticamente del contrato ${c.codigo || c.id} (${prog.periodo})`,
          created_by: perfil.email,
        }).select('*').single()
        if (error) throw new Error(error.message)

        await supabase.from('piola_facturas_programadas').update({
          estado: 'generada',
          invoice_id: factura.id,
          generada_at: new Date().toISOString(),
          generada_por: perfil.email,
        }).eq('id', prog.id)

        generadas.push(factura)
      } catch (e: any) {
        await supabase.from('piola_facturas_programadas')
          .update({ estado: 'error', error_message: e?.message || 'error' }).eq('id', prog.id)
        errores.push({ programada: prog.id, error: e?.message })
      }
    }

    if (generadas.length) {
      await notificarEvento(supabase, {
        evento: 'factura_emitida',
        related_table: 'piola_invoices',
        related_id: generadas[0].id,
        monto: generadas.reduce((s, f) => s + Number(f.total || 0), 0),
        titulo: `${generadas.length} factura(s) recurrente(s) en borrador`,
        mensaje: `🔁 *Facturas recurrentes generadas*\n`
          + generadas.map(f => `${f.serie}-${f.numero} · ${f.cliente_nombre} · S/ ${f.total}`).join('\n')
          + `\n\nQuedan en BORRADOR: falta revisarlas y emitirlas.`,
        actor: perfil.email,
      })
    }

    return { ok: true, generadas: generadas.length, facturas: generadas, errores }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})

/**
 * Arma (o completa) el calendario de facturas de un contrato.
 *
 * Es idempotente: las que ya existen se dejan como están —incluidas las
 * generadas y las omitidas— y solo se agregan los periodos que faltan. Así se
 * puede reprogramar tras extender la vigencia sin duplicar ni pisar historial.
 */
async function programar(supabase: any, contrato: any): Promise<number> {
  if (!contrato?.fecha_inicio || !contrato?.fecha_cierre) return 0

  const calendario = calendarioDeFacturas(
    String(contrato.fecha_inicio).slice(0, 10),
    String(contrato.fecha_cierre).slice(0, 10),
    String(contrato.frecuencia || 'mensual'),
    Number(contrato.dia_facturacion || 1),
  )
  if (!calendario.length) return 0

  const { data: existentes } = await supabase.from('piola_facturas_programadas')
    .select('periodo').eq('contrato_id', contrato.id)
  const ya = new Set((existentes || []).map((e: any) => e.periodo))

  const nuevas = calendario
    .filter(c => !ya.has(c.periodo))
    .map(c => ({
      contrato_id: contrato.id,
      cliente_id: contrato.cliente_id,
      periodo: c.periodo,
      fecha_programada: c.fecha,
      concepto: contrato.descripcion || `Servicios ${c.periodo} — ${contrato.nombre_cliente}`,
      monto: Number(contrato.monto_periodico || 0),
      estado: 'pendiente',
    }))
  if (!nuevas.length) return 0

  const { error } = await supabase.from('piola_facturas_programadas').insert(nuevas)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return nuevas.length
}
