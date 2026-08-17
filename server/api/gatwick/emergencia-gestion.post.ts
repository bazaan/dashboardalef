/**
 * POST /api/gatwick/emergencia-gestion
 *
 * Gestión de emergencias del monitor — SOLO ADMIN o SUPERADMIN.
 * El rol se re-verifica en el servidor contra dashboardlogin: ocultar los
 * botones en el front no alcanza, porque cualquiera podría escribir directo
 * a la tabla con la key anon.
 *
 * Acciones:
 *   crear      → nueva emergencia
 *   editar     → actualiza los campos de una emergencia
 *   eliminar   → borra la emergencia (y sus seguimientos por CASCADE)
 *   resolver   → la marca como resuelta
 *   reabrir    → vuelve a pendiente
 *   cancelar_seguimiento → corta el seguimiento GPS activo y avisa a supervisores
 *
 * Body: { accion, id?, datos?, motivo? }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarAdminGatwick, verificarSesionGatwick, avisarSupervisores, mensajeParaEstado, baseUrl } from '../../utils/gatwick-tracking'

// Campos que se aceptan del cliente (lista blanca: nada de tocar ids ni sellos)
const CAMPOS = [
  'titulo', 'descripcion', 'direccion', 'empresa_cliente', 'ruc_cliente',
  'telefono_contacto', 'prioridad', 'estado', 'tecnico_id', 'tipo_equipo',
  'numero_equipo', 'piso', 'notas', 'codigo_ascensor',
]

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const accion = String(body?.accion || '').trim()
  const id = body?.id != null ? Number(body.id) : null

  // Registrar una emergencia lo puede hacer cualquiera del equipo (a un técnico
  // le pueden reportar una por teléfono). GESTIONARLA — editar, eliminar,
  // resolver, reabrir, cancelar el seguimiento — es solo de admin/superadmin.
  const admin = accion === 'crear'
    ? { ...(await verificarSesionGatwick(event, supabase)), role: 'agente' }
    : await verificarAdminGatwick(event, supabase)

  const limpiar = (datos: any) => {
    const out: Record<string, any> = {}
    for (const c of CAMPOS) {
      if (datos?.[c] !== undefined) out[c] = datos[c] === '' ? null : datos[c]
    }
    return out
  }

  const log = async (detalle: any) => {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'gatwick', tool_name: 'Gestion Emergencia',
        input_data: { accion, id, por: admin.email, rol: admin.role, ...detalle },
        status: 'success',
      })
    } catch {}
  }

  /* ── CREAR ── */
  if (accion === 'crear') {
    const payload = limpiar(body?.datos)
    if (!payload.titulo) throw createError({ statusCode: 400, statusMessage: 'El título es obligatorio' })
    const { data, error } = await (supabase.from('gatwick_emergencias') as any)
      .insert(payload).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error creando: ${error.message}` })
    await log({ titulo: payload.titulo })
    return { ok: true, emergencia: data }
  }

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la emergencia' })

  /* ── EDITAR ── */
  if (accion === 'editar') {
    const payload = limpiar(body?.datos)
    payload.updated_at = new Date().toISOString()
    const { data, error } = await (supabase.from('gatwick_emergencias') as any)
      .update(payload).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error editando: ${error.message}` })
    await log({})
    return { ok: true, emergencia: data }
  }

  /* ── ELIMINAR ── */
  if (accion === 'eliminar') {
    // Si tiene un seguimiento GPS activo, no se borra a ciegas
    const { data: activo } = await (supabase.from('gatwick_seguimientos') as any)
      .select('id').eq('emergencia_id', id).in('estado', ['iniciado', 'en_camino', 'atendiendo']).maybeSingle()
    if (activo && !body?.forzar) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Esta emergencia tiene un seguimiento GPS activo. Cancélalo primero o confirma que quieres eliminar igual.',
      })
    }
    const { error } = await supabase.from('gatwick_emergencias').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error eliminando: ${error.message}` })
    await log({ tenia_seguimiento_activo: !!activo })
    return { ok: true, eliminada: true }
  }

  /* ── RESOLVER / REABRIR ── */
  if (accion === 'resolver' || accion === 'reabrir') {
    const patch = accion === 'resolver'
      ? { estado: 'resuelta', resuelto_en: new Date().toISOString() }
      : { estado: 'pendiente', resuelto_en: null }
    const { data, error } = await (supabase.from('gatwick_emergencias') as any)
      .update(patch).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error: ${error.message}` })
    await log({})
    return { ok: true, emergencia: data }
  }

  /* ── CANCELAR SEGUIMIENTO GPS ── */
  if (accion === 'cancelar_seguimiento') {
    const { data: seg } = await (supabase.from('gatwick_seguimientos') as any)
      .select('*').eq('emergencia_id', id)
      .in('estado', ['iniciado', 'en_camino', 'atendiendo']).maybeSingle()
    if (!seg) throw createError({ statusCode: 404, statusMessage: 'Esta emergencia no tiene un seguimiento activo' })

    const motivo = String(body?.motivo || '').trim() || `Cancelado por ${admin.email}`
    const { data: segAct, error } = await (supabase.from('gatwick_seguimientos') as any)
      .update({ estado: 'cancelada', finalizada_en: new Date().toISOString(), notas_cierre: motivo })
      .eq('id', seg.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error cancelando: ${error.message}` })

    if (seg.tecnico_id) {
      await (supabase.from('gatwick_tecnicos') as any).update({ estado: 'disponible' }).eq('id', seg.tecnico_id)
    }

    const { data: emerg } = await (supabase.from('gatwick_emergencias') as any)
      .select('*').eq('id', id).maybeSingle()
    const aviso = await avisarSupervisores(supabase, mensajeParaEstado('cancelada', {
      emergencia: emerg || seg.snapshot || {},
      seguimiento: segAct,
      linkSupervisor: `${baseUrl(event)}/gatwick/seguimiento/${seg.token}`,
      notas: motivo,
    }), 'seguimiento')

    await log({ seguimiento_id: seg.id, motivo, aviso })
    return { ok: true, seguimiento: segAct, aviso }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción no reconocida: '${accion}'` })
})
