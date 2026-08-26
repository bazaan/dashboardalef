/**
 * POST /api/piola/contratos — contratos de cliente y sus adendas (§5)
 *
 * Body:
 *   { accion: 'guardar', id?, nombre_cliente, ... }
 *   { accion: 'eliminar', id }
 *   { accion: 'adenda_crear', contrato_id, descripcion, fecha?, importe?, archivo_pdf? }
 *   { accion: 'adenda_eliminar', id }
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
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo } from '../../utils/piola'

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

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
