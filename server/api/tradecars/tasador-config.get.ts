/**
 * GET /api/tradecars/tasador-config
 *
 * Devuelve la configuración vigente del Agente Tasador — la misma que el
 * agente de WhatsApp lee en n8n en cada tasación — más el historial de cambios
 * y las solicitudes que quedaron pendientes de que Alef las implemente.
 *
 * Query:
 *   ?historial=30   cuántos movimientos del historial traer (default 30, máx 200)
 *
 * Resp: { parametros, parametros_detalle, reglas, alta_rotacion,
 *         historial, pendientes_alef, puede_editar, salud }
 *
 * `salud` avisa si el Tasador está en condiciones de tasar: si las tablas de
 * configuración o de datos están vacías, el agente de WhatsApp devuelve
 * sin_datos y no cotiza nada — conviene verlo en la UI antes de que el cliente
 * lo descubra en una conversación real.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionTradeCarsEnBase, puedeEditarTasador, leerConfigTasador } from '../../utils/tradecars'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const sesion = await verificarSesionTradeCarsEnBase(event, supabase)

  const q = getQuery(event)
  const limite = Math.min(Math.max(Number(q.historial) || 30, 1), 200)

  const config = await leerConfigTasador(supabase)

  const [historial, pendientes, historico, preciosNuevos] = await Promise.all([
    supabase.from('tradecars_tasador_cambios')
      .select('id,tipo,accion,objetivo,valor_anterior,valor_nuevo,resumen,motivo,estado,origen,solicitado_por,notas_alef,resuelto_at,created_at')
      .order('created_at', { ascending: false })
      .limit(limite),
    supabase.from('tradecars_tasador_cambios')
      .select('id,objetivo,resumen,motivo,solicitado_por,created_at')
      .eq('estado', 'pendiente_alef')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tradecars_data_historico_compras_ventas')
      .select('id', { count: 'exact', head: true }),
    supabase.from('tradecars_data_precios_vehiculos_nuevos')
      .select('id', { count: 'exact', head: true }),
  ])

  const nParametros = config.parametros_detalle.length
  const nHistorico = historico.count || 0
  const nPreciosNuevos = preciosNuevos.count || 0

  // El prompt del Tasador aborta con "configuracion_no_disponible" si la tool
  // de configuración vuelve vacía, y sin comparables ni precio de 0km no tiene
  // con qué calcular: en ese estado no puede cotizar aunque el flujo corra.
  const bloqueos: string[] = []
  if (!nParametros) bloqueos.push('No hay parámetros de tasación cargados — el Tasador aborta con "configuracion_no_disponible".')
  if (!nHistorico && !nPreciosNuevos) {
    bloqueos.push('No hay comparables históricos ni precios de vehículos nuevos — toda tasación devuelve "sin datos".')
  } else {
    if (!nHistorico) bloqueos.push('No hay comparables históricos cargados: las tasaciones sólo pueden apoyarse en el precio del 0km, con confianza baja.')
    if (!nPreciosNuevos) bloqueos.push('No hay precios de vehículos nuevos cargados: no se puede aplicar el techo del 0km.')
  }

  return {
    ...config,
    historial: historial.data || [],
    pendientes_alef: pendientes.data || [],
    puede_editar: puedeEditarTasador(sesion),
    salud: {
      operativo: bloqueos.length === 0,
      bloqueos,
      conteos: {
        parametros: nParametros,
        reglas: config.reglas.length,
        alta_rotacion: config.alta_rotacion.length,
        comparables_historicos: nHistorico,
        precios_vehiculos_nuevos: nPreciosNuevos,
      },
    },
  }
})
