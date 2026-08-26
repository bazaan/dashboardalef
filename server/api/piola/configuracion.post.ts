/**
 * POST /api/piola/configuracion — roles, permisos y catálogos (§2, §6)
 *
 * Body:
 *   { accion: 'catalogo_crear',      tabla, fila }
 *   { accion: 'catalogo_actualizar', tabla, id, patch }
 *   { accion: 'catalogo_eliminar',   tabla, id }
 *   { accion: 'moneda_principal',    id }
 *   { accion: 'etapa_mover',         id, otra_id }
 *   { accion: 'rol_crear',           nombre }
 *   { accion: 'rol_eliminar',        id }
 *   { accion: 'permiso_set',         role_id, module, campo, valor }
 *
 * DOS NIVELES, y el de arriba es más estricto que lo que había:
 *
 * **Roles y permisos exigen Administrador**, no solo permiso de Configuración.
 * Es un endurecimiento deliberado respecto del comportamiento anterior, y la
 * razón es que son las dos tablas que deciden quién puede qué: alguien con
 * `configuracion.edit` pero sin ser Administrador podía marcarse a sí mismo
 * todos los módulos y quedar como Administrador de hecho. Un permiso que se
 * puede usar para ampliarse el permiso no es un permiso.
 *
 * **Los catálogos exigen permiso de Configuración.** Entre ellos está
 * `piola_impuestos`, del que `contabilidad.post.ts` lee las tasas para calcular
 * los totales: sin guard, cambiar el IGV desde el navegador reescribía la
 * aritmética de todos los movimientos siguientes.
 *
 * La lista blanca de tablas importa: `tabla` viene del cliente, y sin ella un
 * `catalogo_eliminar` con tabla 'dashboardlogin' sería un endpoint para borrar
 * usuarios de cualquier empresa del grupo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAdmin } from '../../utils/piola'
import { PIOLA_MODULES } from '../../../utils/permissions'

/** Catálogos editables desde Configuración. Nada fuera de esta lista se toca. */
const TABLAS_CATALOGO = [
  'piola_monedas', 'piola_impuestos', 'piola_tipos_comprobante', 'piola_series',
  'piola_condiciones_pago', 'piola_areas', 'piola_centros_costo', 'piola_proveedores',
  'piola_payment_methods', 'piola_lead_stages',
] as const

/** Columnas que nunca se aceptan del cliente, en ninguna tabla. */
const COLUMNAS_PROHIBIDAS = ['id', 'created_at', 'created_by', 'updated_by']

const CAMPOS_PERMISO = ['can_view', 'can_create', 'can_edit', 'can_delete']

function exigirTabla(tabla: any): string {
  const t = String(tabla || '')
  if (!(TABLAS_CATALOGO as readonly string[]).includes(t)) {
    throw createError({ statusCode: 400, statusMessage: `Tabla no editable: ${t}` })
  }
  return t
}

/** Quita las columnas que el servidor no acepta que ponga el cliente. */
function limpiar(fila: any): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(fila || {})) {
    if (COLUMNAS_PROHIBIDAS.includes(k)) continue
    out[k] = v === '' ? null : v
  }
  return out
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Catálogos ══════════ */
  if (accion === 'catalogo_crear') {
    exigirModulo(perfil, 'configuracion', 'create')
    const tabla = exigirTabla(body?.tabla)

    const fila = limpiar(body?.fila)
    if (!Object.keys(fila).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que crear' })
    }

    const { data, error } = await supabase.from(tabla).insert(fila).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, fila: data }
  }

  if (accion === 'catalogo_actualizar') {
    exigirModulo(perfil, 'configuracion', 'edit')
    const tabla = exigirTabla(body?.tabla)

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el registro a editar' })

    const patch = limpiar(body?.patch)
    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    const { error } = await supabase.from(tabla).update(patch).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'catalogo_eliminar') {
    exigirModulo(perfil, 'configuracion', 'delete')
    const tabla = exigirTabla(body?.tabla)

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el registro a eliminar' })

    // El mensaje de Postgres se propaga tal cual: la pantalla traduce la
    // violación de FK a "está en uso, desactívalo en vez de eliminarlo".
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Moneda principal (única) ══════════ */
  if (accion === 'moneda_principal') {
    exigirModulo(perfil, 'configuracion', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la moneda' })

    // Se apaga la anterior antes de encender la nueva: son dos escrituras que
    // deben ir juntas, y por eso no pueden vivir en el cliente (si la segunda
    // falla desde el navegador, el sistema se queda sin moneda principal).
    const { error: errApagar } = await supabase.from('piola_monedas')
      .update({ es_principal: false }).eq('es_principal', true)
    if (errApagar) throw createError({ statusCode: 400, statusMessage: errApagar.message })

    const { error } = await supabase.from('piola_monedas')
      .update({ es_principal: true, tipo_cambio: 1, activo: true }).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Reordenar etapas del CRM ══════════ */
  if (accion === 'etapa_mover') {
    exigirModulo(perfil, 'configuracion', 'edit')

    const id = Number(body?.id)
    const otraId = Number(body?.otra_id)
    if (!id || !otraId) throw createError({ statusCode: 400, statusMessage: 'Faltan las etapas a intercambiar' })

    // Los dos `orden` se leen de la base, no del cliente: si vinieran de una
    // pestaña vieja, el intercambio dejaría dos etapas con el mismo número.
    const { data: etapas, error: errLeer } = await supabase.from('piola_lead_stages')
      .select('id, orden').in('id', [id, otraId])
    if (errLeer) throw createError({ statusCode: 500, statusMessage: errLeer.message })
    const a = (etapas || []).find((e: any) => e.id === id)
    const b = (etapas || []).find((e: any) => e.id === otraId)
    if (!a || !b) throw createError({ statusCode: 404, statusMessage: 'Alguna de las etapas no existe' })

    const r1 = await supabase.from('piola_lead_stages').update({ orden: b.orden }).eq('id', a.id)
    if (r1.error) throw createError({ statusCode: 400, statusMessage: r1.error.message })
    const r2 = await supabase.from('piola_lead_stages').update({ orden: a.orden }).eq('id', b.id)
    if (r2.error) throw createError({ statusCode: 400, statusMessage: r2.error.message })

    return { ok: true }
  }

  /* ══════════ Roles y permisos — SOLO Administrador ══════════ */
  if (accion === 'rol_crear') {
    exigirAdmin(perfil, 'los roles')

    const nombre = String(body?.nombre || '').trim()
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El rol necesita un nombre' })

    const { data, error } = await supabase.from('piola_roles')
      .insert({ nombre, editable: true }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, rol: data }
  }

  if (accion === 'rol_eliminar') {
    exigirAdmin(perfil, 'los roles')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el rol a eliminar' })

    const { data: rol } = await supabase.from('piola_roles')
      .select('id, nombre, editable').eq('id', id).maybeSingle()
    if (!rol) throw createError({ statusCode: 404, statusMessage: 'El rol no existe' })
    if (rol.editable === false) {
      throw createError({ statusCode: 400, statusMessage: `El rol "${rol.nombre}" es del sistema y no se elimina` })
    }

    // El recuento se hace acá, no en la pantalla: si un colaborador se queda sin
    // rol pierde el acceso, y la lista del navegador puede estar vieja.
    const { count } = await supabase.from('piola_colaboradores')
      .select('id', { count: 'exact', head: true }).eq('role_id', id)
    if (count) {
      throw createError({
        statusCode: 400,
        statusMessage: `No se puede eliminar: ${count} colaborador(es) tienen este rol. Cámbialos primero.`,
      })
    }

    const { error } = await supabase.from('piola_roles').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'permiso_set') {
    exigirAdmin(perfil, 'los permisos de los roles')

    const roleId = Number(body?.role_id)
    const modulo = String(body?.module || '')
    const campo = String(body?.campo || '')
    const valor = !!body?.valor

    if (!roleId) throw createError({ statusCode: 400, statusMessage: 'Falta el rol' })
    if (!(PIOLA_MODULES as readonly string[]).includes(modulo)) {
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

    const { data: existente } = await supabase.from('piola_role_permissions')
      .select('id').eq('role_id', roleId).eq('module', modulo).maybeSingle()

    if (existente) {
      const { data, error } = await supabase.from('piola_role_permissions')
        .update(patch).eq('id', existente.id).select('*').single()
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      return { ok: true, permiso: data }
    }

    const { data, error } = await supabase.from('piola_role_permissions').insert({
      role_id: roleId, module: modulo,
      can_view: false, can_create: false, can_edit: false, can_delete: false,
      ...patch,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, permiso: data }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
