/**
 * POST /api/piola/produccion — entregables, marcas y catálogo de servicios (§6)
 *
 * Body:
 *   { accion: 'guardar_entregable', id?, titulo, cliente_id, ... }
 *   { accion: 'aprobar_entregable', id }
 *   { accion: 'eliminar_entregable', id }
 *   { accion: 'guardar_cliente', id?, nombre, ... }
 *   { accion: 'servicio_crear', nombre, categoria?, precio_referencial?, orden? }
 *   { accion: 'servicio_actualizar', id, activo? }
 *   { accion: 'servicio_eliminar', id }
 *
 * LA APROBACIÓN DE DIRECCIÓN ES EL PUNTO. `aprobado_por` y `aprobado_at` los
 * pone el servidor con la sesión verificada y la hora del servidor: el campo
 * existe para poder decir quién dio el visto bueno y cuándo, y un valor que
 * escribe el propio navegador no responde ninguna de las dos preguntas.
 * Aprobar exige permiso de EDICIÓN, no de creación.
 *
 * `piola_clientes` lo escriben Producción (la ficha de la marca) y CRM (al
 * convertir un lead), así que su guard acepta cualquiera de los dos módulos.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno, hoyLima } from '../../utils/piola'

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

  /* ══════════ Entregables ══════════ */
  if (accion === 'guardar_entregable') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'produccion', id ? 'edit' : 'create')

    const titulo = texto(body?.titulo)
    const clienteId = numero(body?.cliente_id)
    if (!titulo || !clienteId) {
      throw createError({ statusCode: 400, statusMessage: 'El entregable necesita título y marca' })
    }

    const estado = texto(body?.estado) || 'en_produccion'
    const fila: Record<string, any> = {
      titulo,
      cliente_id: clienteId,
      service_id: numero(body?.service_id),
      cantidad: numero(body?.cantidad) ?? 1,
      periodo: texto(body?.periodo),
      descripcion: texto(body?.descripcion),
      fecha_compromiso: texto(body?.fecha_compromiso),
      // Un entregado sin fecha se fecha hoy: si no, el cumplimiento del mes
      // no lo cuenta y el reporte sale corto sin que nadie lo note.
      fecha_entrega: estado === 'entregado'
        ? (texto(body?.fecha_entrega) || hoyLima())
        : texto(body?.fecha_entrega),
      estado,
      responsable_email: texto(body?.responsable_email),
      observaciones: texto(body?.observaciones),
      drive_url: texto(body?.drive_url),
      updated_at: new Date().toISOString(),
    }

    const res = id
      ? await supabase.from('piola_deliverables').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_deliverables').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, entregable: res.data }
  }

  if (accion === 'aprobar_entregable') {
    exigirModulo(perfil, 'produccion', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el entregable a aprobar' })

    const { data, error } = await supabase.from('piola_deliverables').update({
      estado: 'aprobado',
      // Quién aprueba y cuándo: sesión verificada y hora del servidor
      aprobado_por: perfil.email,
      aprobado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, entregable: data }
  }

  if (accion === 'eliminar_entregable') {
    exigirModulo(perfil, 'produccion', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el entregable a eliminar' })

    const { error } = await supabase.from('piola_deliverables').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Marcas (clientes) ══════════ */
  if (accion === 'guardar_cliente') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, ['produccion', 'crm'], id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La marca necesita un nombre' })

    const fila = {
      nombre,
      razon_social: texto(body?.razon_social),
      ruc: texto(body?.ruc),
      contacto: texto(body?.contacto),
      telefono: texto(body?.telefono),
      email: texto(body?.email),
      direccion: texto(body?.direccion),
      compromiso_mensual: Number(body?.compromiso_mensual || 0),
    }

    const res = id
      ? await supabase.from('piola_clientes').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_clientes').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, cliente: res.data }
  }

  /* ══════════ Catálogo de servicios ══════════ */
  if (accion === 'servicio_crear') {
    exigirModulo(perfil, 'produccion', 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El servicio necesita un nombre' })

    const { data, error } = await supabase.from('piola_services').insert({
      nombre,
      categoria: texto(body?.categoria),
      precio_referencial: numero(body?.precio_referencial),
      orden: numero(body?.orden) ?? 0,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, servicio: data }
  }

  if (accion === 'servicio_actualizar') {
    exigirModulo(perfil, 'produccion', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el servicio a editar' })

    const patch: Record<string, any> = {}
    if ('activo' in body) patch.activo = !!body.activo
    if ('nombre' in body) {
      const nombre = texto(body.nombre)
      if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El servicio necesita un nombre' })
      patch.nombre = nombre
    }
    if ('categoria' in body) patch.categoria = texto(body.categoria)
    if ('precio_referencial' in body) patch.precio_referencial = numero(body.precio_referencial)
    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    const { error } = await supabase.from('piola_services').update(patch).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  if (accion === 'servicio_eliminar') {
    exigirModulo(perfil, 'produccion', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el servicio a eliminar' })

    const { error } = await supabase.from('piola_services').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
