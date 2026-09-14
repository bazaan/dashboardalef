/**
 * POST /api/tradecars/configuracion — roles, permisos y colaboradores (14/09/2026)
 *
 * Mismo patrón que server/api/piola/configuracion.post.ts para la parte de
 * roles/permisos, y que server/api/piola/colaborador.post.ts para la ficha del
 * colaborador — simplificado porque acá no hay datos de planilla que proteger.
 *
 * Body: { accion, ... }
 *   rol_crear            { nombre, descripcion? }
 *   rol_eliminar         { id }
 *   permiso_set          { role_id, module, campo, valor }
 *   colaborador_guardar  { id?, email, nombre, cargo?, telefono?, role_id?, activo? }
 *   colaborador_eliminar { id }
 *
 * TODO acá exige Administrador: a diferencia de Piola (que reparte permisos
 * de "configuracion" por rol), en Trade Cars decidir quién ve qué módulo es
 * en sí mismo el tipo de operación que sólo debería tocar un Administrador —
 * son 9 personas, no hace falta un permiso intermedio para esto.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { TRADECARS_MODULES } from '../../../utils/permissions'

const CAMPOS_PERMISO = ['can_view', 'can_create', 'can_edit', 'can_delete']

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Roles ══════════ */
  if (accion === 'rol_crear') {
    exigirAdminTradeCars(perfil, 'los roles')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El rol necesita un nombre' })

    const { data, error } = await supabase.from('tradecars_roles')
      .insert({ nombre, descripcion: texto(body?.descripcion), editable: true }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, rol: data }
  }

  if (accion === 'rol_eliminar') {
    exigirAdminTradeCars(perfil, 'los roles')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el rol a eliminar' })

    const { data: rol } = await supabase.from('tradecars_roles')
      .select('id, nombre, editable').eq('id', id).maybeSingle()
    if (!rol) throw createError({ statusCode: 404, statusMessage: 'El rol no existe' })
    if (rol.editable === false) {
      throw createError({ statusCode: 400, statusMessage: `El rol "${rol.nombre}" es del sistema y no se elimina` })
    }

    const { count } = await supabase.from('tradecars_colaboradores')
      .select('id', { count: 'exact', head: true }).eq('role_id', id)
    if (count) {
      throw createError({
        statusCode: 400,
        statusMessage: `No se puede eliminar: ${count} colaborador(es) tienen este rol. Cámbialos primero.`,
      })
    }

    const { error } = await supabase.from('tradecars_roles').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'permiso_set') {
    exigirAdminTradeCars(perfil, 'los permisos de los roles')

    const roleId = Number(body?.role_id)
    const modulo = String(body?.module || '')
    const campo = String(body?.campo || '')
    const valor = !!body?.valor

    if (!roleId) throw createError({ statusCode: 400, statusMessage: 'Falta el rol' })
    if (!(TRADECARS_MODULES as readonly string[]).includes(modulo)) {
      throw createError({ statusCode: 400, statusMessage: `Módulo desconocido: ${modulo}` })
    }
    if (!CAMPOS_PERMISO.includes(campo)) {
      throw createError({ statusCode: 400, statusMessage: `Permiso desconocido: ${campo}` })
    }

    // Marcar crear/editar/eliminar sin "ver" no tiene sentido: se activa solo.
    const patch: Record<string, any> = { [campo]: valor }
    if (valor && campo !== 'can_view') patch.can_view = true
    if (!valor && campo === 'can_view') {
      patch.can_create = false; patch.can_edit = false; patch.can_delete = false
    }

    const { data: existente } = await supabase.from('tradecars_role_permissions')
      .select('id').eq('role_id', roleId).eq('module', modulo).maybeSingle()

    if (existente) {
      const { data, error } = await supabase.from('tradecars_role_permissions')
        .update(patch).eq('id', existente.id).select('*').single()
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      return { ok: true, permiso: data }
    }

    const { data, error } = await supabase.from('tradecars_role_permissions').insert({
      role_id: roleId, module: modulo,
      can_view: false, can_create: false, can_edit: false, can_delete: false,
      ...patch,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, permiso: data }
  }

  /* ══════════ Colaboradores ══════════ */
  if (accion === 'colaborador_guardar') {
    exigirAdminTradeCars(perfil, 'los colaboradores')

    const id = body?.id ? Number(body.id) : null
    const email = texto(body?.email)?.toLowerCase()
    const nombre = texto(body?.nombre)
    if (!email || !nombre) {
      throw createError({ statusCode: 400, statusMessage: 'Nombre y correo son obligatorios' })
    }

    const fila = {
      email, nombre,
      cargo: texto(body?.cargo),
      telefono: texto(body?.telefono),
      role_id: body?.role_id ? Number(body.role_id) : null,
      activo: body?.activo !== false,
      updated_at: new Date().toISOString(),
    }

    const query = id
      ? supabase.from('tradecars_colaboradores').update(fila).eq('id', id)
      : supabase.from('tradecars_colaboradores').insert(fila)
    const { data, error } = await query.select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, colaborador: data }
  }

  if (accion === 'colaborador_eliminar') {
    exigirAdminTradeCars(perfil, 'los colaboradores')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el colaborador a eliminar' })

    const { error } = await supabase.from('tradecars_colaboradores').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
