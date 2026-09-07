/**
 * POST /api/piola/clientes — módulo Clientes y contratos (setiembre)
 *
 * Body:
 *   { accion: 'guardar', id?, nombre, ruc?, ...ficha }        alta/edición del cliente
 *   { accion: 'consultar_ruc_y_guardar', id?, ruc, ... }      autocompleta y guarda
 *   { accion: 'eliminar', id }
 *   { accion: 'guardar_compromisos', cliente_id, compromisos: [{tipo_contenido, cantidad_mensual}] }
 *   { accion: 'guardar_enlace', id?, cliente_id, proveedor, nombre, url }
 *   { accion: 'eliminar_enlace', id }
 *
 * POR QUÉ ES UN MÓDULO APARTE Y NO UNA PESTAÑA DE FACTURACIÓN
 * Ahora que Finanzas queda restringida a dos personas, dejar el expediente de
 * clientes adentro le quitaría al equipo comercial y de producción el acceso a
 * los datos con los que trabajan todos los días. Son cosas distintas: el
 * contrato es la relación con el cliente, la factura es el cobro.
 *
 * ELIMINAR UN CLIENTE está deliberadamente restringido: sus entregables caen en
 * cascada (FK de piola_deliverables) y sus contratos quedan sin dueño. Si tiene
 * historial, se desactiva en vez de borrarse.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno } from '../../utils/piola'
import { consultarRuc } from '../../utils/piola-ruc'
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

  /* ══════════ Alta y edición del cliente ══════════ */
  if (accion === 'guardar' || accion === 'consultar_ruc_y_guardar') {
    const id = Number(body?.id) || null
    // La ficha también la mantienen Producción (la marca) y CRM (al convertir
    // un lead): exigir solo 'clientes' le quitaría el acceso a esas dos.
    exigirAlguno(perfil, ['clientes', 'crm', 'produccion'], id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El cliente necesita un nombre' })

    const fila: Record<string, any> = {
      nombre,
      razon_social: texto(body?.razon_social),
      nombre_comercial: texto(body?.nombre_comercial),
      tipo_documento: texto(body?.tipo_documento) || 'RUC',
      ruc: texto(body?.ruc),
      numero_documento: texto(body?.numero_documento) || texto(body?.ruc),
      contacto: texto(body?.contacto),
      email: texto(body?.email),
      telefono: texto(body?.telefono),
      direccion: texto(body?.direccion),
      direccion_fiscal: texto(body?.direccion_fiscal),
      distrito: texto(body?.distrito),
      provincia: texto(body?.provincia),
      departamento: texto(body?.departamento),
      condicion_pago_id: numero(body?.condicion_pago_id),
      compromiso_mensual: Number(body?.compromiso_mensual || 0),
      notas: texto(body?.notas),
      updated_at: new Date().toISOString(),
    }
    if ('activo' in body) fila.activo = !!body.activo

    /* ── Consulta al padrón: el dato oficial gana sobre lo tipeado ── */
    let avisoRuc: string | null = null
    if (accion === 'consultar_ruc_y_guardar' && fila.ruc) {
      const res = await consultarRuc(fila.ruc)
      if (res.encontrado && res.datos) {
        fila.razon_social = res.datos.razon_social || fila.razon_social
        fila.nombre_comercial = res.datos.nombre_comercial || fila.nombre_comercial
        fila.estado_sunat = res.datos.estado
        fila.condicion_sunat = res.datos.condicion
        fila.direccion_fiscal = res.datos.direccion || fila.direccion_fiscal
        fila.distrito = res.datos.distrito || fila.distrito
        fila.provincia = res.datos.provincia || fila.provincia
        fila.departamento = res.datos.departamento || fila.departamento
        fila.ruc_consultado_at = new Date().toISOString()
        fila.ruc_datos = res.datos.crudo
        // Sin nombre propio, la razón social sirve de nombre
        if (!texto(body?.nombre) || body?.nombre === body?.ruc) fila.nombre = res.datos.razon_social || fila.nombre
      } else {
        avisoRuc = res.error || res.aviso || null
      }
    }

    if (!id) fila.created_by = perfil.email

    const res = id
      ? await supabase.from('piola_clientes').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_clientes').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    if (!id) {
      await notificarEvento(supabase, {
        evento: 'cliente_creado',
        related_table: 'piola_clientes',
        related_id: res.data.id,
        titulo: `Nuevo cliente: ${res.data.nombre}`,
        mensaje: `🤝 *Cliente registrado*\n${res.data.nombre}`
          + (res.data.ruc ? `\nRUC: ${res.data.ruc}` : '')
          + (res.data.contacto ? `\nContacto: ${res.data.contacto}` : ''),
        actor: perfil.email,
      })
    }

    return { ok: true, cliente: res.data, aviso_ruc: avisoRuc }
  }

  /* ══════════ Eliminar ══════════ */
  if (accion === 'eliminar') {
    exigirModulo(perfil, 'clientes', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el cliente a eliminar' })

    /*
     * Un cliente con historial NO se borra: sus entregables se van en cascada
     * y sus facturas quedan huérfanas. Se desactiva, que es lo que la gente
     * quiere decir el 95 % de las veces cuando dice "bórralo".
     */
    const [{ count: entregables }, { count: facturas }, { count: contratos }] = await Promise.all([
      supabase.from('piola_deliverables').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
      supabase.from('piola_invoices').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
      supabase.from('piola_contratos').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
    ])

    if (entregables || facturas || contratos) {
      const { error } = await supabase.from('piola_clientes')
        .update({ activo: false, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      return {
        ok: true,
        desactivado: true,
        aviso: `El cliente tiene ${entregables || 0} entregable(s), ${facturas || 0} factura(s) y `
             + `${contratos || 0} contrato(s): se desactivó en vez de borrarse para no perder ese historial.`,
      }
    }

    const { error } = await supabase.from('piola_clientes').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true, desactivado: false }
  }

  /* ══════════ Compromiso mensual por tipo de contenido ══════════ */
  if (accion === 'guardar_compromisos') {
    exigirAlguno(perfil, ['clientes', 'produccion'], 'edit')

    const clienteId = Number(body?.cliente_id)
    if (!clienteId) throw createError({ statusCode: 400, statusMessage: 'Falta el cliente' })

    const lista = Array.isArray(body?.compromisos) ? body.compromisos : []
    const filas = lista
      .filter((c: any) => texto(c?.tipo_contenido) && Number(c?.cantidad_mensual) > 0)
      .map((c: any) => ({
        cliente_id: clienteId,
        tipo_contenido: String(c.tipo_contenido),
        cantidad_mensual: Number(c.cantidad_mensual),
        notas: texto(c?.notas),
      }))

    /*
     * Se reemplaza el set completo: la pantalla manda el estado final de la
     * tabla, y un compromiso que la persona quitó tiene que desaparecer. Va
     * borrado + insert (no upsert) justamente para que las quitadas se vayan.
     */
    const { error: errDel } = await supabase.from('piola_cliente_compromisos')
      .delete().eq('cliente_id', clienteId)
    if (errDel) throw createError({ statusCode: 400, statusMessage: errDel.message })

    if (filas.length) {
      const { error } = await supabase.from('piola_cliente_compromisos').insert(filas)
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    }

    // El total sigue viviendo en el cliente para las pantallas que aún lo miran
    const total = filas.reduce((s: number, f: any) => s + Number(f.cantidad_mensual || 0), 0)
    await supabase.from('piola_clientes')
      .update({ compromiso_mensual: Math.round(total), updated_at: new Date().toISOString() })
      .eq('id', clienteId)

    return { ok: true, compromisos: filas.length, total }
  }

  /* ══════════ Enlaces a carpetas (Drive / Dropbox) ══════════ */
  if (accion === 'guardar_enlace') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, ['clientes', 'produccion'], id ? 'edit' : 'create')

    const url = texto(body?.url)
    const nombre = texto(body?.nombre)
    if (!url || !nombre) throw createError({ statusCode: 400, statusMessage: 'El enlace necesita nombre y URL' })
    if (!/^https?:\/\//i.test(url)) {
      throw createError({ statusCode: 400, statusMessage: 'La URL debe empezar con http:// o https://' })
    }

    const proveedor = String(body?.proveedor || 'drive')
    if (!['drive', 'dropbox', 'otro'].includes(proveedor)) {
      throw createError({ statusCode: 400, statusMessage: `Proveedor inválido: ${proveedor}` })
    }

    const fila = {
      cliente_id: numero(body?.cliente_id),
      proveedor,
      nombre,
      url,
      folder_id: texto(body?.folder_id),
      orden: numero(body?.orden) ?? 0,
      ...(id ? {} : { created_by: perfil.email }),
    }

    const res = id
      ? await supabase.from('piola_enlaces_carpetas').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_enlaces_carpetas').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, enlace: res.data }
  }

  if (accion === 'eliminar_enlace') {
    exigirAlguno(perfil, ['clientes', 'produccion'], 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el enlace a eliminar' })

    const { error } = await supabase.from('piola_enlaces_carpetas').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
