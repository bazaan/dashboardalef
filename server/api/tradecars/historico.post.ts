/**
 * POST /api/tradecars/historico — CRUD del histórico de compras/ventas
 * (`tradecars_data_historico_compras_ventas`), reemplazo del módulo
 * "Compras" (14/09/2026).
 *
 * Body: { accion: 'crear' | 'actualizar' | 'eliminar', ... }
 *
 * Exige módulo 'operaciones' — es el mismo módulo que ya cubría el
 * "Compras" original. A diferencia del resto de TradeCars (que escribe
 * directo desde el navegador porque sus tablas SÍ tienen policy `anon`),
 * ésta no la tiene — así que este endpoint es la ÚNICA puerta, no una
 * capa extra: sin él, nadie desde la UI puede tocar esta tabla.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import { tcCalcularVenta, tcSoloCambios } from '~/utils/tradecarsFormulas'

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const fecha = (v: any) => texto(v)

/** Campos que la ficha deja tocar. Se excluyen los de auditoría/sincronización
 *  (id, created_at, sincronizado_en, actualizado_en, actualizado_por,
 *  import_batch_id, sheet_row_id, origen_ultimo_cambio) — esos los pone el
 *  propio endpoint, nunca el formulario. */
const CAMPOS_TEXTO = [
  'vendedor', 'placa', 'concat', 'cuenta_1', 'marca', 'modelo', 'version',
  'anio_fab', 'color', 'tipo_vehiculo', 'combustible', 'transmision',
  'canal_compra', 'canal_venta', 'cliente', 'referido_venta',
  'tipo_compra_retoma', 'tipo_compra', 'notaria', 'cancelado',
  'en_cuenta_de_tdc', 'cuenta_2', 'detalle_operacion_abono', 'comprado_por',
  'status_notarial', 'numero_factura', 'numero_venta', 'semana', 'a_nombre_de',
]
const CAMPOS_FECHA = ['fecha_venta', 'fecha_compra']
const CAMPOS_NUMERO = [
  'km', 'valor_compra_usd', 'igv_compra_usd', 'adquisicion_usd',
  'comision_compra_usd', 'comision_venta_usd', 'gastos_extras_usd',
  'costo_total_usd', 'notariales_usd', 'costo_total_notariales_usd',
  'precio_venta_usd', 'precio_facturacion_usd', 'valor_venta_usd',
  'comision_de_venta_usd', 'igv_venta_usd', 'revenue_usd', 'margen_bruto_usd',
  'margen_bruto_pct', 'margen_sin_igv_pct', 'margen_sin_igv_limpio_usd',
  'margen_sin_igv_usd', 'dias_inventario', 'pendiente_de_cobro_usd',
]

function armarFila(body: any) {
  const fila: Record<string, any> = {}
  for (const c of CAMPOS_TEXTO) if (c in body) fila[c] = texto(body[c])
  for (const c of CAMPOS_FECHA) if (c in body) fila[c] = fecha(body[c])
  for (const c of CAMPOS_NUMERO) if (c in body) fila[c] = numero(body[c])
  return fila
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  const body = await readBody(event)
  const accion = String(body?.accion || '')

  if (accion === 'crear') {
    exigirModuloTradeCars(perfil, 'operaciones', 'create')

    let fila = armarFila(body)
    if (!fila.placa && !fila.marca) {
      throw createError({ statusCode: 400, statusMessage: 'Al menos la placa o la marca son obligatorias' })
    }
    // Fórmulas del Excel (margen bruto, días de inventario, etc.) — ver utils/tradecarsFormulas.ts
    fila = { ...fila, ...tcCalcularVenta(fila) }
    fila.actualizado_en = new Date().toISOString()
    fila.actualizado_por = perfil.email
    // `origen_ultimo_cambio` tiene un CHECK constraint en la base que no está
    // documentado en ningún sql/*.sql de este repo — sólo se confirmó que
    // acepta NULL (como las 1.305 filas existentes) y 'sheet' (reservado para
    // una futura sincronización en vivo con Google Sheets). No hay un valor
    // para "se editó a mano desde el dashboard", así que se deja sin tocar en
    // vez de adivinar uno que rompa el insert/update.

    const { data, error } = await supabase
      .from('tradecars_data_historico_compras_ventas')
      .insert(fila).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, fila: data }
  }

  if (accion === 'actualizar') {
    exigirModuloTradeCars(perfil, 'operaciones', 'edit')

    const id = texto(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la fila a editar' })

    // Las fórmulas se calculan sobre "lo ya guardado + lo que se cambió" (el formulario solo manda lo editado)
    const { data: previo } = await supabase
      .from('tradecars_data_historico_compras_ventas').select('*').eq('id', id).maybeSingle()
    if (!previo) throw createError({ statusCode: 404, statusMessage: 'La venta ya no existe' })

    let fila = armarFila(body)
    // Solo se reescribe lo que la edición realmente cambia (una fila con un valor escrito a mano no se pisa)
    fila = {
      ...fila,
      ...tcSoloCambios(tcCalcularVenta({ ...previo, ...fila }), tcCalcularVenta(previo), previo),
    }
    fila.actualizado_en = new Date().toISOString()
    fila.actualizado_por = perfil.email

    const { data, error } = await supabase
      .from('tradecars_data_historico_compras_ventas')
      .update(fila).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, fila: data }
  }

  if (accion === 'eliminar') {
    exigirModuloTradeCars(perfil, 'operaciones', 'delete')

    const id = texto(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la fila a eliminar' })

    const { error } = await supabase
      .from('tradecars_data_historico_compras_ventas')
      .delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
