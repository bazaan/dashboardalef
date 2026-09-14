/**
 * GET /api/tradecars/historico
 *
 * Lista completa de `tradecars_data_historico_compras_ventas` — el histórico
 * real de compras/ventas (hoja "VENTAS" del Excel de operaciones, importado
 * el 04/08/2026). Es la MISMA tabla que usa el Tasador IA para sus
 * comparables (`buscar_comparables_historicos`) — este endpoint no crea una
 * copia, sólo la expone para poder verla y mantenerla desde el módulo
 * "Compras" del dashboard (antes mostraba `tradecars_compras`, casi vacía;
 * ver la nota en pages/pruebas/TradeCars.vue).
 *
 * Por qué es un endpoint y no `client.from(...).select()` directo como el
 * resto de TradeCars: esta tabla tiene RLS SIN policy para `anon` (a
 * propósito, es la que alimenta al Tasador) — leerla con la key pública
 * devuelve 0 filas sin ningún error, el mismo aviso que ya está en
 * CLAUDE.md sobre SUPABASE_KEY vs SUPABASE_SERVICE_KEY. Sólo el servidor,
 * con `serverSupabaseServiceRole()`, la puede leer.
 *
 * Trae TODAS las filas (pagina de a 1.000 puertas adentro, como
 * `fetchFunnelLeads()` en TradeCars.vue) — son ~1.300, no hace falta paginar
 * también en la respuesta: el navegador pagina la tabla con v-data-table.
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
      .from('tradecars_data_historico_compras_ventas')
      .select('*')
      .order('fecha_venta', { ascending: false })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    filas.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }

  return { ok: true, filas, total: filas.length }
})
