/**
 * GET /api/tradecars/precios-0km — pestaña "Precios vehículos nuevos".
 *
 *   (sin query)      → tabla de precios 0km + últimas corridas del bot + pendientes de revisión
 *   ?corrida=<id>    → el detalle completo de una corrida (cada modelo, versión, URL y acción)
 *
 * Todo por el servidor (service_role): el log y las revisiones no tienen policy `anon`.
 * Ver: exige el módulo 'operaciones' (la pestaña vive ahí, junto a Compras y Ventas).
 * `puede_editar` le dice a la pantalla si mostrar Aplicar/Descartar — el POST lo vuelve a verificar.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import {
  TABLA_CORRIDAS, SQL_CORRIDAS, SQL_REVISIONES, tablaFaltante,
  leerPrecios, leerCorridas, leerDecisiones, calcularPendientes,
} from '../../utils/tradecars-precios0km'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'operaciones', 'view')
  setHeader(event, 'Cache-Control', 'no-store')

  const idCorrida = Number(getQuery(event).corrida)
  if (idCorrida) {
    const { data, error, status } = await supabase.from(TABLA_CORRIDAS).select('*').eq('id', idCorrida).maybeSingle()
    if (error) {
      if (tablaFaltante(error, status)) throw createError({ statusCode: 409, statusMessage: `Falta correr ${SQL_CORRIDAS} en Supabase` })
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    if (!data) throw createError({ statusCode: 404, statusMessage: 'Esa corrida no existe' })
    return { ok: true, corrida: data }
  }

  const [precios, { corridas, disponible: hayCorridas }, { decisiones, disponible: hayRevisiones }] = await Promise.all([
    leerPrecios(supabase),
    leerCorridas(supabase),
    leerDecisiones(supabase),
  ])
  const pendientes = hayCorridas ? await calcularPendientes(supabase, precios, decisiones) : []

  const faltan_sql: string[] = []
  if (!hayCorridas) faltan_sql.push(SQL_CORRIDAS)
  if (!hayRevisiones) faltan_sql.push(SQL_REVISIONES)

  return {
    ok: true,
    // Mismo criterio que la carga manual de precios 0km del Tasador (puedeEditarTasador):
    // estos precios son el techo con el que el Tasador de WhatsApp cotiza a clientes reales.
    puede_editar: ['admin', 'superadmin'].includes(perfil.rolGlobal),
    precios,
    corridas,
    pendientes,
    faltan_sql,
  }
})
