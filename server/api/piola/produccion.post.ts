/**
 * POST /api/piola/produccion — entregables, marcas y catálogo de servicios (§6)
 *
 * Body:
 *   { accion: 'guardar_entregable', id?, titulo, cliente_id, tipo_contenido?, area_codigo?,
 *     drive_url?, dropbox_url?, publicado_url?, asignaciones?: [{colaborador_email, rol}] }
 *   { accion: 'aprobar_entregable', id }
 *   { accion: 'eliminar_entregable', id }
 *   { accion: 'guardar_cliente', id?, nombre, ... }
 *   { accion: 'servicio_crear', nombre, categoria?, precio_referencial?, orden? }
 *   { accion: 'servicio_actualizar', id, activo? }
 *   { accion: 'servicio_eliminar', id }
 *
 * DESGLOSE POR TIPO DE CONTENIDO (setiembre): el entregable declara QUÉ es
 * (video, pieza gráfica, guion…) y de qué área sale. Sin eso, "8 de 10 piezas"
 * escondía lo que importa: pueden ser 8 gráficas y 0 videos, con el compromiso
 * cumplido en el papel e incumplido en los hechos.
 *
 * RESPONSABLES: `responsable_email` se conserva (es el dueño del entregable),
 * y las asignaciones por rol —diseñador, editor, guionista— van en
 * `piola_deliverable_asignaciones`, porque quien arma y quien cierra rara vez
 * son la misma persona.
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
import { notificarEvento } from '../../utils/piola-alertas'

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
      // Tres enlaces distintos y no uno solo: la carpeta de trabajo, el
      // respaldo y lo ya publicado responden preguntas distintas.
      drive_url: texto(body?.drive_url),
      dropbox_url: texto(body?.dropbox_url),
      publicado_url: texto(body?.publicado_url),
      fecha_publicacion: texto(body?.fecha_publicacion),
      tipo_contenido: texto(body?.tipo_contenido),
      area_codigo: texto(body?.area_codigo),
      updated_at: new Date().toISOString(),
    }
    if (!id) fila.created_by = perfil.email

    const res = id
      ? await supabase.from('piola_deliverables').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_deliverables').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    /*
     * Asignaciones: la pantalla manda el equipo COMPLETO del entregable, así
     * que se reemplaza el set (borrar + insertar). Un upsert dejaría pegada a
     * la persona que se acaba de sacar del entregable.
     */
    if (Array.isArray(body?.asignaciones)) {
      await supabase.from('piola_deliverable_asignaciones')
        .delete().eq('deliverable_id', res.data.id)

      const equipo = body.asignaciones
        .filter((a: any) => texto(a?.colaborador_email))
        .map((a: any) => ({
          deliverable_id: res.data.id,
          colaborador_email: String(a.colaborador_email).trim().toLowerCase(),
          rol: texto(a?.rol) || 'responsable',
          area_codigo: texto(a?.area_codigo),
          asignado_por: perfil.email,
        }))
      // Dos filas iguales (misma persona, mismo rol) chocarían con el UNIQUE
      const vistos = new Set<string>()
      const unicas = equipo.filter((a: any) => {
        const k = `${a.colaborador_email}|${a.rol}`
        if (vistos.has(k)) return false
        vistos.add(k)
        return true
      })
      if (unicas.length) {
        const { error } = await supabase.from('piola_deliverable_asignaciones').insert(unicas)
        if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      }
    }

    if (!id) {
      await notificarEvento(supabase, {
        evento: 'entregable_creado',
        related_table: 'piola_deliverables',
        related_id: res.data.id,
        titulo: `Nuevo entregable: ${res.data.titulo}`,
        mensaje: `🎬 *Entregable creado*\n${res.data.titulo}\n`
          + `Periodo: ${res.data.periodo || '—'} · Compromiso: ${res.data.fecha_compromiso || 'sin fecha'}\n`
          + `Responsable: ${res.data.responsable_email || 'sin asignar'}`,
        actor: perfil.email,
      })
    }

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

    await notificarEvento(supabase, {
      evento: 'entregable_aprobado',
      related_table: 'piola_deliverables',
      related_id: data.id,
      titulo: `Aprobado: ${data.titulo}`,
      mensaje: `✅ *Entregable aprobado por Dirección*\n${data.titulo}\nPeriodo: ${data.periodo || '—'}`,
      actor: perfil.email,
    })

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

  /* ══════════ Catálogo de tipos de contenido y áreas ══════════ */
  if (accion === 'tipo_contenido_guardar') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, ['produccion', 'configuracion'], id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El tipo de contenido necesita un nombre' })

    // El código es la clave que referencian entregables y compromisos: se
    // deriva del nombre al crear y NO se cambia después, para no dejar
    // huérfanas las filas que ya lo apuntan.
    const fila: Record<string, any> = {
      nombre,
      area_codigo: texto(body?.area_codigo),
      unidad: texto(body?.unidad) || 'pieza',
      icono: texto(body?.icono),
      orden: numero(body?.orden) ?? 0,
    }
    if ('activo' in body) fila.activo = !!body.activo

    if (!id) {
      fila.codigo = texto(body?.codigo)
        || nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
             .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
      if (!fila.codigo) throw createError({ statusCode: 400, statusMessage: 'No se pudo derivar un código del nombre' })
    }

    const res = id
      ? await supabase.from('piola_tipos_contenido').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_tipos_contenido').insert(fila).select('*').single()
    if (res.error) {
      if (/duplicate key/i.test(res.error.message)) {
        throw createError({ statusCode: 409, statusMessage: `Ya existe un tipo de contenido con el código "${fila.codigo}"` })
      }
      throw createError({ statusCode: 400, statusMessage: res.error.message })
    }

    return { ok: true, tipo: res.data }
  }

  if (accion === 'tipo_contenido_eliminar') {
    exigirAlguno(perfil, ['produccion', 'configuracion'], 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el tipo de contenido' })

    /*
     * No se borra si hay entregables usándolo: la FK es ON DELETE SET NULL, así
     * que borrarlo dejaría el histórico sin tipo y el cumplimiento por tipo del
     * mes pasado cambiaría solo. Se desactiva, que además lo saca del selector.
     */
    const { data: tipo } = await supabase.from('piola_tipos_contenido')
      .select('codigo').eq('id', id).maybeSingle()
    if (tipo) {
      const { count } = await supabase.from('piola_deliverables')
        .select('id', { count: 'exact', head: true }).eq('tipo_contenido', tipo.codigo)
      if (count) {
        await supabase.from('piola_tipos_contenido').update({ activo: false }).eq('id', id)
        return {
          ok: true, desactivado: true,
          aviso: `${count} entregable(s) usan ese tipo: se desactivó en vez de borrarse.`,
        }
      }
    }

    const { error } = await supabase.from('piola_tipos_contenido').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true, desactivado: false }
  }

  if (accion === 'area_guardar') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, ['produccion', 'configuracion'], id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El área necesita un nombre' })

    const fila: Record<string, any> = {
      nombre,
      color: texto(body?.color) || '#8e8e8e',
      descripcion: texto(body?.descripcion),
      orden: numero(body?.orden) ?? 0,
    }
    if ('activo' in body) fila.activo = !!body.activo
    if (!id) {
      fila.codigo = texto(body?.codigo)
        || nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
             .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
    }

    const res = id
      ? await supabase.from('piola_produccion_areas').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_produccion_areas').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, area: res.data }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
