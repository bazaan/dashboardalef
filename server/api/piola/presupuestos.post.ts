/**
 * POST /api/piola/presupuestos — presupuesto vs. ejecutado (§4)
 *
 * Body:
 *   { accion: 'guardar', id?, alcance, periodo, tipo, monto, area_id?, category_id?, nombre?, notas? }
 *   { accion: 'eliminar', id }
 *
 * Vive dentro de Contabilidad, así que se rige por ese módulo.
 *
 * `created_by` sale del perfil verificado. En una edición ya no se toca: quien
 * creó el presupuesto lo creó, y sobrescribirlo con quien lo editó al día
 * siguiente borraba el único dato de autoría que la tabla guarda.
 *
 * El choque contra `idx_piola_presupuesto_unico` (un presupuesto por periodo +
 * tipo + área + categoría) se propaga tal cual porque la pantalla lo traduce.
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

  if (accion === 'guardar') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'contabilidad', id ? 'edit' : 'create')

    const monto = Number(body?.monto || 0)
    if (!monto) throw createError({ statusCode: 400, statusMessage: 'El presupuesto necesita un monto' })

    const periodo = texto(body?.periodo)
    if (!periodo) throw createError({ statusCode: 400, statusMessage: 'El presupuesto necesita un periodo' })

    const fila: Record<string, any> = {
      nombre: texto(body?.nombre),
      alcance: texto(body?.alcance),
      periodo,
      tipo: texto(body?.tipo),
      area_id: numero(body?.area_id),
      category_id: numero(body?.category_id),
      monto,
      notas: texto(body?.notas),
      updated_at: new Date().toISOString(),
    }
    // Solo en el alta: en una edición, quien lo creó lo creó
    if (!id) fila.created_by = perfil.email

    const res = id
      ? await supabase.from('piola_presupuestos').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_presupuestos').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, presupuesto: res.data }
  }

  if (accion === 'eliminar') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el presupuesto a eliminar' })

    const { error } = await supabase.from('piola_presupuestos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
