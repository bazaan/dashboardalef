/**
 * POST /api/tradecars/historico-compras — CRUD del histórico de compras
 * (`tradecars_data_historico_compras`), mismo patrón que
 * server/api/tradecars/historico.post.ts (el de "Ventas").
 *
 * Body: { accion: 'crear' | 'actualizar' | 'eliminar', ... }
 *
 * Exige módulo 'operaciones'. Esta tabla no tiene policy `anon` — este
 * endpoint es la ÚNICA puerta para escribirla desde la UI.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'

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

/** Campos que la ficha deja tocar (las 113 columnas de la hoja "COMPRAS" del
 *  Excel, generadas mecánicamente desde su encabezado — ver el mapeo completo
 *  en sql/tradecars_compras_import.sql). Se excluyen las de auditoría/
 *  sincronización (id, created_at, sincronizado_en, actualizado_en,
 *  actualizado_por, import_batch_id, sheet_row_id) — esas las pone el propio
 *  endpoint, nunca el formulario. */
const CAMPOS_TEXTO = [
  'placa', 'concat', 'marca', 'modelo', 'version', 'color',
  'ano', 'tipo_de_combustible', 'transmision', 'tipo_de_vehiculo', 'canal_de_compra', 'asesor_comercial_comprador',
  'detalle_canal_de_compra', 'nombre_referido_compra', 'tipo_compra_retoma', 'tipo_de_compra', 'soat', 'rtv',
  'detalle_de_otros_gastos_documentales', 'detalle_arreglos', 'soat_2', 'notaria', 'compra_prenda_status', 'banco_prenda',
  'status_notarial', 'declaracion_jurada', 'pagado', 'cuenta_de', 'detalle_de_operacion', 'registro_stock',
  'vencimiento_soat', 'dias', 'rtv_3', 'vencimiento_de_rtv', 'certificado_de_gas', 'otros_documentos',
  'status', 'rango_de_inv', 'vin', 'motor', 'fecha_venta', 'tramitador_de_prenda',
  'placa_ii', 'status_ii', 'kardex', 'a_nombre_de', 'semana', 'placa_iii',
  'marca_2', 'modelo_2', 'version_2', 'ano_fab', 'color_2', 'tipo_de_vehiculo_2',
  'combustible', 'transmision_2', 'tipo_compra_retoma_2', 'tipo_de_compra_2', 'a_nombre_de_2', 'disponible_para_venta',
  'status_ii_2',
]
const CAMPOS_FECHA = ['fecha_de_compra', 'fecha_compra', 'fecha_de_compra_2']
const CAMPOS_NUMERO = [
  'cuenta', 'kilometraje', 'precio_de_compra_valor_acta', 'valor_de_compra', 'comision_referido', 'notariales',
  'impuesto_vehicular', 'multa_sat', 'multa_callao', 'multa_sutran', 'levantamiento_de_prenda', 'otros_gastos_documentales',
  'arreglos_esteticos', 'arreglos_mecanicos', 'lavado_de_salon', 'tratamiento_de_pintura', 'total_gastos_extras_prov', 'costo_total_total_provision',
  'impuesto_vehicular_prov', 'rtv_2', 'multa_sat_2', 'multa_callao_2', 'multa_sutran_2', 'levantamiento_de_prenda_2',
  'otros_gastos_documentales_2', 'arreglos_esteticos_2', 'arreglos_mecanicos_2', 'lavado_de_salon_2', 'tratamiento_de_pintura_2', 'otros_gastos',
  'total_gastos_extras_reales', 'costo_total_gastos_extras_real', 'costo_total_sin_igv', 'costo_total_real_total_provision', 'costo_total_gastos_extras_real_2', 'n_compra',
  'precio', 'precio_de_cierre', 'km', 'valor_de_compra_2', 'igv_compra', 'adquisicion',
  'comision_compra', 'comision_venta', 'gastos_extras', 'costo_total', 'notariales_2', 'costo_total_notariales',
  'dias_de_inv',
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

    const fila = armarFila(body)
    if (!fila.placa && !fila.marca) {
      throw createError({ statusCode: 400, statusMessage: 'Al menos la placa o la marca son obligatorias' })
    }
    fila.actualizado_en = new Date().toISOString()
    fila.actualizado_por = perfil.email

    const { data, error } = await supabase
      .from('tradecars_data_historico_compras')
      .insert(fila).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, fila: data }
  }

  if (accion === 'actualizar') {
    exigirModuloTradeCars(perfil, 'operaciones', 'edit')

    const id = texto(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la fila a editar' })

    const fila = armarFila(body)
    fila.actualizado_en = new Date().toISOString()
    fila.actualizado_por = perfil.email

    const { data, error } = await supabase
      .from('tradecars_data_historico_compras')
      .update(fila).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, fila: data }
  }

  if (accion === 'eliminar') {
    exigirModuloTradeCars(perfil, 'operaciones', 'delete')

    const id = texto(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la fila a eliminar' })

    const { error } = await supabase
      .from('tradecars_data_historico_compras')
      .delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
