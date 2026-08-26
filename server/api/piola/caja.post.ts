/**
 * POST /api/piola/caja — apertura, movimientos y cierre de caja (§5)
 *
 * Body:
 *   { accion: 'abrir', nombre?, saldo_inicial?, observaciones? }
 *   { accion: 'movimiento', tipo, concepto, monto, payment_method?, destino?, observaciones? }
 *   { accion: 'eliminar_movimiento', id }
 *   { accion: 'cerrar', saldo_contado, observaciones? }
 *
 * DOS COSAS LAS DECIDE EL SERVIDOR, NO LA PANTALLA:
 *
 * 1. **A qué sesión se aplica un movimiento.** El cliente no manda `sesion_id`:
 *    se resuelve acá cuál es la caja abierta. Si no hay ninguna, el movimiento
 *    se rechaza en vez de colgarse de una sesión cerrada.
 *
 * 2. **El saldo del sistema al cerrar.** Se recalcula sumando los movimientos,
 *    no se acepta el número que venía del navegador. Si el saldo calculado lo
 *    pusiera el cliente, la diferencia del arqueo — que es justamente el dato
 *    que se quiere vigilar — sería un valor que cualquiera puede maquillar.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo } from '../../utils/piola'

const TIPOS = ['ingreso', 'egreso', 'transferencia', 'retiro']

/** Saldo según el sistema: inicial + entradas − salidas. */
function saldoDeSesion(sesion: any, movimientos: any[]): number {
  const saldo = (movimientos || []).reduce((s: number, m: any) => {
    const monto = Math.abs(Number(m.monto || 0))
    return m.tipo === 'ingreso' ? s + monto : s - monto
  }, Number(sesion?.saldo_inicial || 0))
  return Math.round(saldo * 100) / 100
}

/** La caja abierta, o 404. Solo puede haber una (idx_piola_caja_una_abierta). */
async function sesionAbierta(supabase: any) {
  const { data } = await supabase.from('piola_caja_sesiones')
    .select('*').eq('estado', 'abierta').order('id', { ascending: false }).limit(1).maybeSingle()
  if (!data) throw createError({ statusCode: 400, statusMessage: 'No hay ninguna caja abierta' })
  return data
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Abrir caja ══════════ */
  if (accion === 'abrir') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const { data, error } = await supabase.from('piola_caja_sesiones').insert({
      nombre: String(body?.nombre || '').trim() || 'Caja',
      saldo_inicial: Math.round(Number(body?.saldo_inicial || 0) * 100) / 100,
      abierta_por: perfil.email,
      observaciones: body?.observaciones || null,
    }).select('*').single()
    // El índice único parcial es el que impide dos cajas abiertas a la vez.
    // El mensaje de Postgres se propaga tal cual porque la pantalla lo interpreta.
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, sesion: data }
  }

  /* ══════════ Registrar un movimiento ══════════ */
  if (accion === 'movimiento') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const tipo = String(body?.tipo || '')
    if (!TIPOS.includes(tipo)) {
      throw createError({ statusCode: 400, statusMessage: `Tipo de movimiento inválido: ${tipo}` })
    }
    const concepto = String(body?.concepto || '').trim()
    const monto = Math.round(Math.abs(Number(body?.monto || 0)) * 100) / 100
    if (!concepto || !monto) {
      throw createError({ statusCode: 400, statusMessage: 'El movimiento necesita concepto y monto' })
    }

    const sesion = await sesionAbierta(supabase)

    const { data, error } = await supabase.from('piola_caja_movimientos').insert({
      sesion_id: sesion.id,
      tipo,
      concepto,
      monto,
      payment_method: body?.payment_method || null,
      destino: ['transferencia', 'retiro'].includes(tipo) ? (body?.destino || null) : null,
      observaciones: body?.observaciones || null,
      registrado_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true, movimiento: data }
  }

  /* ══════════ Eliminar un movimiento ══════════ */
  if (accion === 'eliminar_movimiento') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el movimiento a eliminar' })

    // Una caja cerrada ya fue arqueada: borrarle un movimiento invalida esa acta.
    const { data: mov } = await supabase.from('piola_caja_movimientos')
      .select('id, sesion_id, sesion:piola_caja_sesiones(estado)').eq('id', id).maybeSingle()
    if (!mov) throw createError({ statusCode: 404, statusMessage: 'El movimiento no existe' })
    const estado = Array.isArray(mov.sesion) ? mov.sesion[0]?.estado : (mov.sesion as any)?.estado
    if (estado === 'cerrada') {
      throw createError({
        statusCode: 400,
        statusMessage: 'La caja de ese movimiento ya está cerrada: su arqueo quedaría descuadrado',
      })
    }

    const { error } = await supabase.from('piola_caja_movimientos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Cerrar caja ══════════ */
  if (accion === 'cerrar') {
    exigirModulo(perfil, 'contabilidad', 'edit')

    const sesion = await sesionAbierta(supabase)

    const { data: movimientos, error: errMov } = await supabase
      .from('piola_caja_movimientos').select('tipo, monto').eq('sesion_id', sesion.id).order('id')
    if (errMov) throw createError({ statusCode: 500, statusMessage: errMov.message })

    const saldoFinal = saldoDeSesion(sesion, movimientos || [])
    const contado = Math.round(Number(body?.saldo_contado || 0) * 100) / 100
    const diferencia = Math.round((contado - saldoFinal) * 100) / 100

    const { data, error } = await supabase.from('piola_caja_sesiones').update({
      fecha_cierre: new Date().toISOString(),
      saldo_final: saldoFinal,
      saldo_contado: contado,
      diferencia,
      cerrada_por: perfil.email,
      estado: 'cerrada',
      observaciones: body?.observaciones || sesion.observaciones || null,
    }).eq('id', sesion.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // La pantalla anuncia la diferencia con ESTE número, no con el suyo.
    return { ok: true, sesion: data, saldo_final: saldoFinal, diferencia }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
