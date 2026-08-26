/**
 * POST /api/piola/contabilidad — movimientos y categorías de gasto (§4)
 *
 * Body:
 *   { accion: 'guardar_movimiento', id?, tipo, fecha, concepto, subtotal, descuento,
 *     impuestos_sel: string[], ...campos }
 *   { accion: 'eliminar_movimiento', id }
 *   { accion: 'crear_categoria', nombre, parent_id?, tipo }
 *   { accion: 'editar_categoria', id, nombre?, activo? }
 *   { accion: 'eliminar_categoria', id }
 *
 * LOS IMPORTES LOS CALCULA EL SERVIDOR, no la pantalla. El cliente manda
 * `subtotal`, `descuento` y los CÓDIGOS de impuesto marcados; acá se leen las
 * tasas vigentes de `piola_impuestos` y se recalcula el total con la misma
 * función que usa el formulario (`calcularTotalesMovimiento`, importada del
 * composable para que no haya dos versiones de la fórmula).
 *
 * Importa porque `monto` es lo que suman los gráficos, los reportes y el saldo
 * de las cuentas por cobrar: si lo pusiera el navegador, se podría registrar un
 * ingreso de S/ 10 000 con un total escrito a mano de S/ 100, y todo el resto
 * del sistema lo daría por bueno. También evita que una tasa desactualizada en
 * una pestaña vieja se cuele como si fuera la vigente.
 *
 * Lo que NO se toca acá: `estado` y `monto_pagado` en una edición. Los maneja
 * el trigger `piola_recalcular_saldo()` a partir de `piola_pagos`; escribirlos
 * desde acá dejaría cuentas "pagadas" con saldo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, hoyLima } from '../../utils/piola'
import { calcularTotalesMovimiento } from '../../../composables/usePiola'

const TIPOS = ['ingreso', 'egreso']

/** Campos descriptivos: no cambian ningún importe. */
const CAMPOS_TEXTO = [
  'documento_serie', 'documento_numero', 'documento_adjunto',
  'payment_method', 'responsable_email', 'notas',
]
const CAMPOS_ID = [
  'category_id', 'cliente_id', 'proveedor_id', 'area_id', 'centro_costo_id',
  'tipo_comprobante_id', 'condicion_pago_id',
]

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

  /* ══════════ Alta o edición de un movimiento ══════════ */
  if (accion === 'guardar_movimiento') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'contabilidad', id ? 'edit' : 'create')

    const tipo = String(body?.tipo || '')
    if (!TIPOS.includes(tipo)) {
      throw createError({ statusCode: 400, statusMessage: `Tipo de movimiento inválido: ${tipo}` })
    }
    const concepto = texto(body?.concepto)
    if (!concepto) {
      throw createError({ statusCode: 400, statusMessage: 'El movimiento necesita un concepto' })
    }

    // Las tasas vigentes salen de la base, no del body
    const codigos = Array.isArray(body?.impuestos_sel)
      ? body.impuestos_sel.map((c: any) => String(c)) : []
    let aplicados: any[] = []
    if (codigos.length) {
      const { data: impuestos, error: errImp } = await supabase
        .from('piola_impuestos').select('codigo, nombre, tasa, comportamiento, aplica_a')
        .eq('activo', true).in('codigo', codigos)
      if (errImp) throw createError({ statusCode: 500, statusMessage: errImp.message })
      aplicados = (impuestos || [])
        // Un impuesto de ingreso no se aplica a un egreso aunque venga marcado
        .filter((i: any) => ['ambos', tipo].includes(i.aplica_a))
        .map((i: any) => ({
          codigo: i.codigo, nombre: i.nombre,
          tasa: Number(i.tasa), comportamiento: i.comportamiento,
        }))
    }

    const t = calcularTotalesMovimiento(
      Number(body?.subtotal || 0), Number(body?.descuento || 0), aplicados)
    if (!t.total) {
      throw createError({ statusCode: 400, statusMessage: 'El movimiento necesita un importe' })
    }

    const fila: Record<string, any> = {
      tipo,
      fecha: texto(body?.fecha) || hoyLima(),
      concepto,
      // `monto` es el TOTAL: es lo que suman los gráficos y los reportes
      monto: t.total,
      subtotal: t.subtotal,
      descuento: t.descuento,
      impuestos: t.impuestos,
      impuestos_detalle: t.detalle,
      precio: numero(body?.precio),
      cantidad: numero(body?.cantidad),
      fecha_vencimiento: texto(body?.fecha_vencimiento),
      proyectado: !!body?.proyectado,
      updated_at: new Date().toISOString(),
    }
    for (const k of CAMPOS_TEXTO) if (k in body) fila[k] = texto(body[k])
    for (const k of CAMPOS_ID) if (k in body) fila[k] = numero(body[k])
    // Un cliente solo tiene sentido en un ingreso, y un proveedor en un egreso
    if (tipo === 'ingreso') fila.proveedor_id = null
    else fila.cliente_id = null

    if (id) {
      fila.updated_by = perfil.email
    } else {
      fila.created_by = perfil.email
      // Un movimiento sin condición de pago es caja que ya ocurrió
      fila.estado = fila.condicion_pago_id || fila.fecha_vencimiento ? 'pendiente' : 'pagado'
      if (fila.estado === 'pagado') fila.monto_pagado = t.total
    }

    const res = id
      ? await supabase.from('piola_transactions').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_transactions').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, movimiento: res.data, totales: t }
  }

  /* ══════════ Eliminar un movimiento ══════════ */
  if (accion === 'eliminar_movimiento') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el movimiento a eliminar' })

    // Borrar la cuenta borraría en cascada los pagos ya aplicados contra ella:
    // eso es rehacer un cobro, no corregir un tipeo.
    const { count } = await supabase.from('piola_pagos')
      .select('id', { count: 'exact', head: true }).eq('transaction_id', id)
    if (count) {
      throw createError({
        statusCode: 400,
        statusMessage: `Ese movimiento tiene ${count} pago(s) registrados: elimínalos primero o anúlalo`,
      })
    }

    const { error } = await supabase.from('piola_transactions').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Categorías de gasto (jerárquicas) ══════════ */
  if (accion === 'crear_categoria') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La categoría necesita un nombre' })

    const { data, error } = await supabase.from('piola_expense_categories').insert({
      nombre,
      parent_id: numero(body?.parent_id),
      tipo: texto(body?.tipo) || 'egreso',
      orden: numero(body?.orden) ?? 0,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, categoria: data }
  }

  if (accion === 'editar_categoria') {
    exigirModulo(perfil, 'contabilidad', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la categoría a editar' })

    const patch: Record<string, any> = {}
    if ('nombre' in body) {
      const nombre = texto(body.nombre)
      if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La categoría necesita un nombre' })
      patch.nombre = nombre
    }
    if ('activo' in body) patch.activo = !!body.activo
    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    const { error } = await supabase.from('piola_expense_categories').update(patch).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'eliminar_categoria') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la categoría a eliminar' })

    // Las subcategorías caen en cascada (FK) y los movimientos quedan sin
    // categoría: la pantalla ya lo avisa, acá solo se ejecuta.
    const { error } = await supabase.from('piola_expense_categories').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
