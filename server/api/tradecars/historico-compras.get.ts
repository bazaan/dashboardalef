/**
 * GET /api/tradecars/historico-compras
 *
 * Lista completa de `tradecars_data_historico_compras`, el histórico real de
 * COMPRAS (hoja "COMPRAS" del Excel de operaciones, importado el 16/09/2026 vía
 * sql/tradecars_compras_import.sql). Mismo criterio que
 * server/api/tradecars/historico.{get,post}.ts (que ya hace esto para la hoja
 * "VENTAS" de ese Excel) — no es una copia, es la tabla real de compras.
 *
 * Igual que esa tabla, ésta NO tiene policy `anon` (a propósito, para no
 * exponer precios de compra al navegador sin pasar por el servidor) — sólo el
 * servidor, con `serverSupabaseServiceRole()`, la puede leer.
 *
 * Trae TODAS las filas (pagina de a 1.000 puertas adentro) — son ~1.300.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'operaciones', 'view')

  const PAGINA = 1000
  const filas: any[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('tradecars_data_historico_compras')
      .select('*')
      .order('fecha_de_compra', { ascending: false })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    filas.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }

  return { ok: true, filas, total: filas.length }
})
