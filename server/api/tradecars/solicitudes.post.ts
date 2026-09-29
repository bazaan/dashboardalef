/**
 * POST /api/tradecars/solicitudes — escribe sobre las solicitudes de "Formularios web"
 * (Venta / Compra). Reemplaza las llamadas directas del navegador a Supabase (29/09/2026):
 * un asesor (no admin) solo puede tocar SUS propias solicitudes — se verifica acá, no alcanza
 * con que la pantalla solo le muestre las suyas.
 *
 *   { accion: 'guardar', tipo: 'venta'|'compra', id, estado?, notas?, precio_ofrecido? }
 *   { accion: 'eliminar', tipo: 'venta'|'compra', id }
 *   { accion: 'crear_cliente', tipo: 'venta'|'compra', id }
 *        → crea la fila en tradecars_clientes y enlaza la solicitud (cliente_id, estado='contactado')
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import { obtenerAsesorDeSesion } from '../../utils/tradecars-asignacion'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS = ['nuevo', 'contactado', 'tasado', 'comprado', 'descartado']

const faltaMigracion = (error: any) => !!error && /does not exist|schema cache/i.test(String(error.message || ''))
function lanzarSiFaltaMigracion(error: any) {
  if (faltaMigracion(error)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Falta correr sql/tradecars_formularios_asignacion.sql en Supabase para poder editar las solicitudes.',
    })
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'comercial', 'edit')

  const body = await readBody(event)
  const accion = String(body?.accion || '')
  const tipo = String(body?.tipo || '')
  if (tipo !== 'venta' && tipo !== 'compra') {
    throw createError({ statusCode: 400, statusMessage: 'tipo debe ser "venta" o "compra"' })
  }
  const tabla = tipo === 'venta' ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  const id = String(body?.id || '')
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Falta la solicitud (id)' })

  // Un asesor (no admin) solo puede tocar sus propias solicitudes.
  const miAsesor = perfil.esAdmin ? null : await obtenerAsesorDeSesion(supabase, perfil.email)
  if (miAsesor) {
    const { data: actual, error: eActual } = await supabase.from(tabla).select('asesor_email').eq('id', id).maybeSingle()
    lanzarSiFaltaMigracion(eActual)
    if (!actual) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })
    if (actual.asesor_email && actual.asesor_email.toLowerCase() !== miAsesor.asesor_email.toLowerCase()) {
      throw createError({ statusCode: 403, statusMessage: 'Esta solicitud está asignada a otro asesor.' })
    }
  }

  if (accion === 'guardar') {
    const payload: Record<string, any> = {
      atendido_por: perfil.colaborador?.nombre || perfil.email,
      atendido_en: new Date().toISOString(),
    }
    if ('estado' in body) {
      const estado = String(body.estado || '').trim()
      if (!ESTADOS.includes(estado)) throw createError({ statusCode: 400, statusMessage: `Estado no válido. Usa: ${ESTADOS.join(', ')}` })
      payload.estado = estado
    }
    if ('notas' in body) payload.notas = body.notas ? String(body.notas).trim().slice(0, 4000) : null
    if (tipo === 'venta' && 'precio_ofrecido' in body) {
      const n = body.precio_ofrecido === null || body.precio_ofrecido === '' ? null : Number(body.precio_ofrecido)
      if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100_000_000)) {
        throw createError({ statusCode: 400, statusMessage: 'El precio ofrecido no es válido' })
      }
      payload.precio_ofrecido = n
    }

    const { data, error } = await supabase.from(tabla).update(payload).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true, solicitud: data }
  }

  if (accion === 'eliminar') {
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true }
  }

  if (accion === 'crear_cliente') {
    const { data: s, error: eSol } = await supabase.from(tabla).select('*').eq('id', id).single()
    if (eSol || !s) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })

    const esVenta = tipo === 'venta'
    const payloadCliente: Record<string, any> = {
      tipo: esVenta ? 'vendedor' : 'comprador',
      nombre_completo: s.nombre_completo,
      telefono: s.celular || null,
      correo: s.correo || null,
      distrito: s.distrito || null,
      canal: 'web',
      estado: 'contactado',
      notas: s.mensaje || null,
    }
    if (esVenta) {
      payloadCliente.vehiculo_marca = s.marca || null
      payloadCliente.vehiculo_modelo = s.modelo || null
      payloadCliente.vehiculo_anio = s.anio || null
      payloadCliente.vehiculo_placa = s.placa || null
      payloadCliente.vehiculo_km = s.kilometraje || null
      payloadCliente.tiene_deuda = s.tiene_deuda === 'si'
      payloadCliente.solicitud_venta_id = s.id
    } else {
      payloadCliente.solicitud_compra_id = s.id
    }

    const { data: cliente, error: eCliente } = await (supabase.from('tradecars_clientes') as any)
      .insert(payloadCliente).select('id').single()
    if (eCliente) throw createError({ statusCode: 400, statusMessage: eCliente.message })

    const { error: eUpdate } = await supabase.from(tabla)
      .update({ cliente_id: cliente?.id, estado: 'contactado' }).eq('id', id)
    if (eUpdate) throw createError({ statusCode: 400, statusMessage: eUpdate.message })

    return { ok: true, cliente_id: cliente?.id }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
