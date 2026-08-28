/**
 * POST /api/piola/contratos — contratos de cliente y sus adendas (§5)
 *
 * Body:
 *   { accion: 'guardar', id?, nombre_cliente, ... }
 *   { accion: 'eliminar', id }
 *   { accion: 'adenda_crear', contrato_id, descripcion, fecha?, importe?, archivo_pdf? }
 *   { accion: 'adenda_eliminar', id }
 *   { accion: 'generar_cobro', contrato_id, periodo? }   -- 'YYYY-MM', default: mes actual
 *
 * Vive dentro de Facturación, así que se rige por ese módulo.
 *
 * `company_id` lo fija el servidor en 'piola'. Venía del cliente, y aunque la
 * pantalla siempre mandaba el valor correcto, era un campo de aislamiento entre
 * empresas del grupo escrito por el navegador: un contrato guardado con el
 * `company_id` de otra empresa aparecería en el tablero de esa otra empresa.
 *
 * Eliminar un contrato arrastra sus adendas por FK. Eso ya lo avisa la pantalla
 * y es el comportamiento querido: una adenda sin contrato no significa nada.
 *
 * GENERAR_COBRO: el Excel "Control de Pagos con Marcas y Contratos" que mandó
 * Piola lleva, mes a mes, si la cuota de cada marca ya se pagó. Este endpoint
 * es lo que conecta un contrato con esa cuenta por cobrar: crea la fila en
 * piola_transactions por el pago_mensual del contrato. No se puede generar dos
 * veces el mismo mes — lo impide el índice único (contrato_id, periodo_cobro),
 * no una verificación de la aplicación que se podría saltear.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno } from '../../utils/piola'

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Contrato ══════════ */
  if (accion === 'guardar') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'facturacion', id ? 'edit' : 'create')

    const nombreCliente = texto(body?.nombre_cliente)
    if (!nombreCliente) {
      throw createError({ statusCode: 400, statusMessage: 'El contrato necesita el nombre del cliente' })
    }

    const diaPago = numero(body?.dia_pago)
    if (diaPago !== null && (diaPago < 1 || diaPago > 31)) {
      throw createError({ statusCode: 400, statusMessage: 'El día de pago va del 1 al 31' })
    }

    const fila = {
      // Aislamiento entre empresas: no se acepta del cliente
      company_id: 'piola',
      cliente_id: numero(body?.cliente_id),
      nombre_cliente: nombreCliente,
      ruc: texto(body?.ruc),
      fecha_inicio: texto(body?.fecha_inicio),
      fecha_cierre: texto(body?.fecha_cierre),
      importe_pagado: Number(body?.importe_pagado || 0),
      modalidad_pago: texto(body?.modalidad_pago),
      contrato_pdf: texto(body?.contrato_pdf),
      notas: texto(body?.notas),
      pago_mensual: numero(body?.pago_mensual),
      dia_pago: diaPago,
      cantidad_meses: numero(body?.cantidad_meses),
    }

    const res = id
      ? await supabase.from('piola_contratos').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_contratos').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, contrato: res.data }
  }

  if (accion === 'eliminar') {
    exigirModulo(perfil, 'facturacion', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el contrato a eliminar' })

    const { error } = await supabase.from('piola_contratos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Adendas ══════════ */
  if (accion === 'adenda_crear') {
    exigirModulo(perfil, 'facturacion', 'create')

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
    exigirModulo(perfil, 'facturacion', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la adenda a eliminar' })

    const { error } = await supabase.from('piola_adendas').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Generar el cobro del mes (Contratos -> Cuentas por Cobrar) ══════════ */
  if (accion === 'generar_cobro') {
    // Crea una fila en piola_transactions: le corresponde al mismo permiso
    // que Contabilidad, no sólo Facturación, porque escribe esa tabla.
    exigirAlguno(perfil, ['facturacion', 'contabilidad'], 'create')

    const contratoId = Number(body?.contrato_id)
    if (!contratoId) throw createError({ statusCode: 400, statusMessage: 'Falta el contrato' })

    const { data: contrato } = await supabase.from('piola_contratos')
      .select('id, cliente_id, nombre_cliente, pago_mensual, dia_pago')
      .eq('id', contratoId).maybeSingle()
    if (!contrato) throw createError({ statusCode: 404, statusMessage: 'El contrato no existe' })
    if (!contrato.pago_mensual) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Este contrato no tiene una cuota mensual configurada — es un proyecto puntual, no una marca con pago recurrente',
      })
    }

    const periodoTexto = /^\d{4}-\d{2}$/.test(String(body?.periodo || ''))
      ? String(body.periodo)
      : new Date().toISOString().slice(0, 7)
    const periodoCobro = `${periodoTexto}-01`

    const [anio, mes] = periodoTexto.split('-').map(Number)
    const ultimoDiaMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const dia = Math.min(Number(contrato.dia_pago) || ultimoDiaMes, ultimoDiaMes)
    const fechaVencimiento = `${periodoTexto}-${String(dia).padStart(2, '0')}`

    const { data, error } = await supabase.from('piola_transactions').insert({
      tipo: 'ingreso',
      fecha: fechaVencimiento,
      concepto: `Cuota mensual — ${contrato.nombre_cliente} (${periodoTexto})`,
      monto: contrato.pago_mensual,
      cliente_id: contrato.cliente_id,
      contrato_id: contrato.id,
      periodo_cobro: periodoCobro,
      fecha_vencimiento: fechaVencimiento,
      responsable_email: perfil.email,
      created_by: perfil.email,
    }).select('*').single()

    if (error) {
      // El índice único (contrato_id, periodo_cobro) es lo que de verdad
      // impide duplicar el cobro de un mismo mes.
      if (error.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: `Ya se generó el cobro de ${periodoTexto} para este contrato` })
      }
      throw createError({ statusCode: 400, statusMessage: error.message })
    }

    return { ok: true, cobro: data }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
