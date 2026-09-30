/**
 * POST /api/tradecars/precios-0km — aplicar o descartar un hallazgo del bot semanal de precios 0km.
 *
 * Body: { accion: 'aplicar' | 'descartar', clave, corrida_id }
 *
 * El navegador solo dice CUÁL hallazgo: el precio, la URL y la fila se vuelven a leer del log del
 * bot y se verifica que siga pendiente. Así nadie puede escribir un precio arbitrario por acá.
 *
 * Solo admin/superadmin (verificado contra dashboardlogin, no contra la cookie): es el mismo
 * criterio que la carga manual de precios 0km, porque esta tabla es el techo con el que el
 * Tasador de WhatsApp cotiza a clientes reales.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionTradeCarsEnBase, puedeEditarTasador } from '../../utils/tradecars'
import { logServerActivity } from '../../utils/logger'
import {
  TABLA_PRECIOS, TABLA_REVISIONES, SQL_REVISIONES, tablaFaltante, hoyLima,
  leerPrecios, leerDecisiones, calcularPendientes,
} from '../../utils/tradecars-precios0km'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const sesion = await verificarSesionTradeCarsEnBase(event, supabase)
  if (!puedeEditarTasador(sesion)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo administración puede aplicar o descartar precios 0km: son el techo con el que cotiza el Tasador.',
    })
  }

  const body = await readBody(event)
  const accion = String(body?.accion || '')
  const clave = String(body?.clave || '')
  const corridaId = Number(body?.corrida_id)
  if (accion !== 'aplicar' && accion !== 'descartar') {
    throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
  }
  if (!clave || !corridaId) throw createError({ statusCode: 400, statusMessage: 'Faltan clave o corrida_id' })

  const precios = await leerPrecios(supabase)
  const { decisiones, disponible: hayRevisiones } = await leerDecisiones(supabase)
  const p = (await calcularPendientes(supabase, precios, decisiones))
    .find(x => x.clave === clave && x.corrida_id === corridaId)
  if (!p) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ese hallazgo ya no está pendiente (ya se resolvió o una corrida más nueva lo reemplazó). Actualiza la pantalla.',
    })
  }

  const nombre = `${p.marca} ${p.modelo}${p.version ? ' ' + p.version : ''} ${p.anio_modelo}`

  /** Deja la decisión. Devuelve false si falta la tabla (la escritura en precios ya se hizo igual). */
  async function registrar(decision: 'aplicado' | 'descartado', filaId: number | null) {
    const { error, status } = await supabase.from(TABLA_REVISIONES).insert({
      clave: p!.clave,
      tipo: p!.tipo,
      decision,
      marca: p!.marca,
      modelo: p!.modelo,
      version: p!.version,
      anio_modelo: p!.anio_modelo,
      precio_encontrado_usd: p!.precio_usd,
      precio_anterior_usd: p!.precio_actual_usd,
      url_fuente: p!.url_fuente,
      fila_id: filaId,
      corrida_id: p!.corrida_id,
      decidido_por: sesion.email,
    })
    if (error) {
      if (tablaFaltante(error, status)) return false
      throw createError({ statusCode: 400, statusMessage: `No se pudo registrar la decisión: ${error.message || 'sin detalle'}` })
    }
    return true
  }

  if (accion === 'descartar') {
    if (!hayRevisiones) throw createError({ statusCode: 409, statusMessage: `Para descartar falta correr ${SQL_REVISIONES} en Supabase` })
    await registrar('descartado', p.fila_id)
    await logServerActivity(event, sesion.email, `Precios 0km: descartó ${nombre} a US$${p.precio_usd}`, 'tradecars')
    return { ok: true, decision: 'descartado' }
  }

  const ahora = new Date().toISOString()

  if (p.tipo === 'salto') {
    const { data, error } = await supabase.from(TABLA_PRECIOS).update({
      precio_anterior_usd: p.precio_actual_usd,
      precio_nuevo_usd: p.precio_usd,
      moneda: 'USD',
      url_fuente: p.url_fuente,
      fecha_ultimo_precio: hoyLima(),
      actualizado_en: ahora,
      estado_produccion: 'activo',
      requiere_revision: false,
    }).eq('id', p.fila_id!).select('id').maybeSingle()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    if (!data) throw createError({ statusCode: 409, statusMessage: 'La fila ya no existe en la tabla de precios' })
    const registrado = await registrar('aplicado', p.fila_id)
    await logServerActivity(event, sesion.email,
      `Precios 0km: aplicó ${nombre} US$${p.precio_actual_usd} → US$${p.precio_usd}`, 'tradecars')
    return { ok: true, decision: 'aplicado', fila_id: p.fila_id, registrado }
  }

  // Versión nueva
  const fila = {
    marca: p.marca,
    modelo: p.modelo,
    version: p.version,
    anio_modelo: p.anio_modelo,
    precio_nuevo_usd: p.precio_usd,
    moneda: 'USD',
    url_fuente: p.url_fuente,
    estado_produccion: 'activo',
    fecha_ultimo_precio: hoyLima(),
    requiere_revision: false,
    activa: true,
    creado_por: sesion.email,
    notas: `Precio encontrado por el bot semanal de precios 0km (n8n) y aprobado en el dashboard por ${sesion.email}.`,
  }
  let fuente = 'web'
  let { data, error } = await supabase.from(TABLA_PRECIOS).insert({ ...fila, fuente: 'web', tier: 1 }).select('id').single()
  if (error?.code === '23514' && /fuente/i.test(String(error.message))) {
    // El CHECK de `fuente` todavía no acepta 'web' (bloque opcional de sql/tradecars_control_sync_precios.sql).
    // Una fila aprobada a mano por un administrador es, a todos los efectos, una carga manual (tier 2).
    fuente = 'manual'
    ;({ data, error } = await supabase.from(TABLA_PRECIOS).insert({ ...fila, fuente: 'manual', tier: 2 }).select('id').single())
  }
  if (error || !data) throw createError({ statusCode: 400, statusMessage: error?.message || 'No se pudo insertar la fila' })
  const registrado = await registrar('aplicado', data.id)
  await logServerActivity(event, sesion.email, `Precios 0km: agregó ${nombre} a US$${p.precio_usd} (fuente ${fuente})`, 'tradecars')
  return { ok: true, decision: 'aplicado', fila_id: data.id, fuente, registrado }
})
