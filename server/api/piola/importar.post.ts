/**
 * POST /api/piola/importar — carga de movimientos financieros desde Excel/CSV
 *
 * Body:
 *   { accion: 'analizar', archivo_base64, archivo_nombre, hoja?, plantilla_id?, mapeo?, opciones? }
 *        → lee el archivo, devuelve cabeceras + vista previa. NO escribe nada.
 *   { accion: 'confirmar', archivo_base64, archivo_nombre, hoja, mapeo, opciones, plantilla_id? }
 *        → inserta los movimientos válidos
 *   { accion: 'guardar_plantilla', id?, nombre, mapeo, opciones }
 *   { accion: 'eliminar_plantilla', id }
 *   { accion: 'revertir_lote', id }
 *
 * DOS PASADAS, SIEMPRE
 * 'analizar' no toca la base. La pantalla muestra fila por fila lo que se va a
 * cargar, qué se interpretó mal y qué ya existía. Una hoja de contabilidad
 * importada a ciegas es un error que se descubre un mes después cuadrando caja,
 * y para entonces ya nadie sabe qué filas eran.
 *
 * EL ARCHIVO VIAJA EN base64 y no como multipart: son hojas de unos cientos de
 * KB y evita meter un parser de multipart en Nitro por una sola pantalla. El
 * tope de 8 MB está abajo.
 *
 * ANTI-DUPLICADO: cada fila lleva un hash de (fecha, tipo, monto, concepto,
 * documento). El índice único de `piola_transactions.import_hash` es lo que
 * hace que re-subir el mismo archivo no duplique la caja.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, hoyLima } from '../../utils/piola'
import { leerLibro } from '../../utils/piola-xlsx'
import {
  interpretarFilas, sugerirMapeo, normalizarCabecera, CAMPOS_IMPORTABLES,
  type FilaInterpretada,
} from '../../utils/piola-importar'
import { notificarEvento } from '../../utils/piola-alertas'

const MAX_MB = 8
const MAX_FILAS = 5000

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}

/** Decodifica el archivo y lo lee. Los errores salen como 400, no como 500. */
function leerArchivo(body: any) {
  const b64 = String(body?.archivo_base64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!b64) throw createError({ statusCode: 400, statusMessage: 'No llegó ningún archivo' })

  const buf = Buffer.from(b64, 'base64')
  if (!buf.length) throw createError({ statusCode: 400, statusMessage: 'El archivo llegó vacío' })
  if (buf.length > MAX_MB * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: `El archivo pesa más de ${MAX_MB} MB` })
  }

  try {
    return leerLibro(buf, String(body?.archivo_nombre || ''), { maxFilas: MAX_FILAS })
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'No se pudo leer el archivo' })
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || 'analizar')

  /* ══════════ Plantillas de mapeo ══════════ */
  if (accion === 'guardar_plantilla') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La plantilla necesita un nombre' })

    const fila = {
      nombre,
      tipo: 'movimientos',
      descripcion: texto(body?.descripcion),
      mapeo: body?.mapeo && typeof body.mapeo === 'object' ? body.mapeo : {},
      opciones: body?.opciones && typeof body.opciones === 'object' ? body.opciones : {},
      updated_at: new Date().toISOString(),
    }

    const id = Number(body?.id) || null
    const res = id
      ? await supabase.from('piola_import_plantillas').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_import_plantillas')
          .upsert({ ...fila, created_by: perfil.email }, { onConflict: 'nombre' }).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, plantilla: res.data }
  }

  if (accion === 'eliminar_plantilla') {
    exigirModulo(perfil, 'contabilidad', 'delete')
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la plantilla a eliminar' })

    const { error } = await supabase.from('piola_import_plantillas').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    return { ok: true }
  }

  /* ══════════ Revertir una importación completa ══════════ */
  if (accion === 'revertir_lote') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el lote a revertir' })

    /*
     * Solo se revierte lo que nadie tocó después. Un movimiento importado que
     * ya recibió un pago dejó de ser "una fila del Excel": borrarlo se llevaría
     * el cobro en cascada. Esos se quedan y se informan.
     */
    const { data: movimientos } = await supabase.from('piola_transactions')
      .select('id').eq('import_lote_id', id)
    const ids = (movimientos || []).map((m: any) => m.id)
    if (!ids.length) throw createError({ statusCode: 400, statusMessage: 'El lote no tiene movimientos que revertir' })

    const { data: conPagos } = await supabase.from('piola_pagos')
      .select('transaction_id').in('transaction_id', ids)
    const bloqueados = new Set((conPagos || []).map((p: any) => p.transaction_id))
    const borrables = ids.filter((i: number) => !bloqueados.has(i))

    if (borrables.length) {
      const { error } = await supabase.from('piola_transactions').delete().in('id', borrables)
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    }

    await supabase.from('piola_import_lotes').update({
      estado: 'revertido',
      revertido_por: perfil.email,
      revertido_at: new Date().toISOString(),
    }).eq('id', id)

    return {
      ok: true,
      eliminados: borrables.length,
      conservados: bloqueados.size,
      aviso: bloqueados.size
        ? `${bloqueados.size} movimiento(s) tienen pagos registrados y no se eliminaron.`
        : null,
    }
  }

  /* ══════════ Analizar y confirmar ══════════ */
  exigirModulo(perfil, 'contabilidad', accion === 'confirmar' ? 'create' : 'view')

  const libro = leerArchivo(body)
  const hojaNombre = texto(body?.hoja)
  const hoja = (hojaNombre && libro.hojas.find(h => h.nombre === hojaNombre)) || libro.hojas[0]

  // Mapeo: el del body, el de la plantilla elegida, o el sugerido por cabeceras
  let mapeo: Record<string, string> = body?.mapeo && typeof body.mapeo === 'object' ? body.mapeo : {}
  let opciones: Record<string, any> = body?.opciones && typeof body.opciones === 'object' ? body.opciones : {}

  if (!Object.keys(mapeo).length && body?.plantilla_id) {
    const { data: plantilla } = await supabase.from('piola_import_plantillas')
      .select('*').eq('id', Number(body.plantilla_id)).maybeSingle()
    if (plantilla) {
      mapeo = plantilla.mapeo || {}
      opciones = { ...(plantilla.opciones || {}), ...opciones }
    }
  }

  const filaEncabezado = Math.max(1, Number(opciones.fila_encabezado || 1))
  const cabeceras = (hoja.filas[filaEncabezado - 1] || []).map((c: any) => String(c ?? '').trim())
  let sugerido = false
  if (!Object.keys(mapeo).length) { mapeo = sugerirMapeo(cabeceras); sugerido = true }

  const { resultado } = interpretarFilas(hoja.filas, mapeo, opciones)

  /* ── Cruce contra lo ya cargado: qué filas son repetidas ── */
  const hashes = resultado.filter(r => r.ok).map(r => r.hash)
  const yaCargados = new Set<string>()
  for (let i = 0; i < hashes.length; i += 400) {          // el .in() tiene tope práctico
    const { data } = await supabase.from('piola_transactions')
      .select('import_hash').in('import_hash', hashes.slice(i, i + 400))
    for (const t of data || []) yaCargados.add(t.import_hash)
  }
  // …y contra sí mismo: la misma fila dos veces en la misma hoja
  const vistos = new Set<string>()
  for (const r of resultado) {
    if (!r.ok) continue
    if (yaCargados.has(r.hash) || vistos.has(r.hash)) (r as any).duplicado = true
    vistos.add(r.hash)
  }

  const validas = resultado.filter(r => r.ok && !(r as any).duplicado)
  const duplicadas = resultado.filter(r => (r as any).duplicado)
  const conError = resultado.filter(r => !r.ok)

  const resumen = {
    archivo: texto(body?.archivo_nombre),
    hoja: hoja.nombre,
    hojas_disponibles: libro.hojas.map(h => h.nombre),
    cabeceras,
    mapeo,
    mapeo_sugerido: sugerido,
    campos_disponibles: CAMPOS_IMPORTABLES,
    total: resultado.length,
    validas: validas.length,
    duplicadas: duplicadas.length,
    con_error: conError.length,
    ingresos: validas.filter(r => r.datos.tipo === 'ingreso').reduce((s, r) => s + r.datos.monto, 0),
    egresos: validas.filter(r => r.datos.tipo === 'egreso').reduce((s, r) => s + r.datos.monto, 0),
  }

  if (accion !== 'confirmar') {
    return {
      ok: true,
      ...resumen,
      // Se devuelven TODAS: la vista previa es el punto de esta pantalla, y son
      // como máximo 5 000 filas de texto plano.
      filas: resultado,
    }
  }

  /* ══════════ Confirmar: acá sí se escribe ══════════ */
  if (!validas.length) {
    throw createError({
      statusCode: 400,
      statusMessage: duplicadas.length
        ? 'Todas las filas ya estaban cargadas: no hay nada nuevo que importar'
        : 'Ninguna fila del archivo es importable. Revisá el mapeo de columnas.',
    })
  }

  /* ── Catálogos: se resuelven UNA vez para todo el lote ── */
  const { data: categorias } = await supabase.from('piola_expense_categories').select('id, nombre, codigo, tipo')
  const porNombre = new Map<string, any>()
  const porCodigo = new Map<string, any>()
  for (const c of categorias || []) {
    porNombre.set(normalizarCabecera(c.nombre), c)
    if (c.codigo) porCodigo.set(String(c.codigo).toLowerCase(), c)
  }

  const { data: clientes } = await supabase.from('piola_clientes').select('id, nombre, ruc')
  const clientePorNombre = new Map((clientes || []).map((c: any) => [normalizarCabecera(c.nombre), c.id]))
  const clientePorRuc = new Map((clientes || []).filter((c: any) => c.ruc).map((c: any) => [String(c.ruc), c.id]))

  const { data: proveedores } = await supabase.from('piola_proveedores').select('id, nombre, ruc')
  const provPorNombre = new Map((proveedores || []).map((p: any) => [normalizarCabecera(p.nombre), p.id]))

  const crearCategorias = opciones.crear_categorias !== false

  /** Resuelve (o crea) la categoría que nombra la fila. */
  async function resolverCategoria(nombre: string | null, tipo: string): Promise<number | null> {
    if (!nombre) return null
    const porCod = porCodigo.get(nombre.toLowerCase())
    if (porCod) return porCod.id
    const existente = porNombre.get(normalizarCabecera(nombre))
    if (existente) return existente.id
    if (!crearCategorias) return null

    const { data } = await supabase.from('piola_expense_categories')
      .insert({ nombre, tipo, orden: 99 }).select('*').single()
    if (data) { porNombre.set(normalizarCabecera(data.nombre), data); return data.id }
    return null
  }

  /* ── El lote se abre ANTES de insertar: si algo revienta a mitad, las filas
       ya cargadas quedan igual atadas a un lote reversible ── */
  const { data: lote, error: errLote } = await supabase.from('piola_import_lotes').insert({
    plantilla_id: Number(body?.plantilla_id) || null,
    archivo_nombre: texto(body?.archivo_nombre),
    hoja: hoja.nombre,
    filas_total: resultado.length,
    importado_por: perfil.email,
    detalle: {
      mapeo,
      opciones,
      errores: conError.map(r => ({ fila: r.fila, errores: r.errores })),
      duplicadas: duplicadas.map(r => r.fila),
    },
  }).select('*').single()
  if (errLote) throw createError({ statusCode: 500, statusMessage: errLote.message })

  const insertadas: any[] = []
  const fallidas: any[] = []

  for (const r of validas as FilaInterpretada[]) {
    const d = r.datos
    try {
      const categoryId = await resolverCategoria(d.categoria_texto, d.tipo)
      const clienteId = d.tipo === 'ingreso'
        ? (d.ruc && clientePorRuc.get(d.ruc)) || (d.cliente && clientePorNombre.get(normalizarCabecera(d.cliente))) || null
        : null
      const proveedorId = d.tipo === 'egreso' && d.proveedor
        ? provPorNombre.get(normalizarCabecera(d.proveedor)) || null : null

      const { data, error } = await supabase.from('piola_transactions').insert({
        tipo: d.tipo,
        fecha: d.fecha,
        concepto: d.concepto,
        monto: d.monto,
        subtotal: d.subtotal,
        category_id: categoryId,
        cliente_id: clienteId,
        proveedor_id: proveedorId,
        // El texto libre se conserva aunque no haya calzado con un proveedor
        proveedor: d.proveedor,
        payment_method: d.payment_method || 'Transferencia bancaria',
        documento_serie: d.documento_serie,
        documento_numero: d.documento_numero,
        responsable_email: d.responsable_email,
        notas: [d.notas, `Importado de ${texto(body?.archivo_nombre) || 'archivo'} (fila ${r.fila})`]
          .filter(Boolean).join(' · '),
        // Un movimiento importado es caja que YA ocurrió
        estado: 'pagado',
        monto_pagado: d.monto,
        import_lote_id: lote.id,
        import_hash: r.hash,
        import_fila: r.fila,
        created_by: perfil.email,
      }).select('id, tipo, monto').single()

      if (error) throw new Error(error.message)
      insertadas.push(data)
    } catch (e: any) {
      // El índice único de import_hash puede saltar por una carrera entre dos
      // personas importando el mismo archivo: eso es duplicado, no error.
      const esDuplicado = /duplicate key|import_hash/i.test(e?.message || '')
      fallidas.push({ fila: r.fila, error: e?.message, duplicado: esDuplicado })
    }
  }

  const montoTotal = insertadas.reduce((s, t) => s + Number(t.monto || 0), 0)
  const duplicadosEnCarrera = fallidas.filter(f => f.duplicado).length

  await supabase.from('piola_import_lotes').update({
    filas_importadas: insertadas.length,
    filas_duplicadas: duplicadas.length + duplicadosEnCarrera,
    filas_error: conError.length + (fallidas.length - duplicadosEnCarrera),
    monto_total: montoTotal,
    estado: fallidas.length - duplicadosEnCarrera > 0 ? 'parcial' : 'importado',
    detalle: {
      mapeo,
      opciones,
      errores: [...conError.map(r => ({ fila: r.fila, errores: r.errores })),
                ...fallidas.filter(f => !f.duplicado)],
      duplicadas: duplicadas.map(r => r.fila),
    },
  }).eq('id', lote.id)

  await notificarEvento(supabase, {
    evento: 'importacion',
    related_table: 'piola_import_lotes',
    related_id: lote.id,
    monto: montoTotal,
    titulo: `Importación de ${insertadas.length} movimiento(s)`,
    mensaje: `📥 *Movimientos importados*\n`
      + `Archivo: ${texto(body?.archivo_nombre) || 'sin nombre'}\n`
      + `Importados: ${insertadas.length} · Duplicados: ${duplicadas.length + duplicadosEnCarrera} · `
      + `Con error: ${conError.length}\n`
      + `Ingresos: S/ ${resumen.ingresos.toFixed(2)} · Egresos: S/ ${resumen.egresos.toFixed(2)}`,
    actor: perfil.email,
  })

  return {
    ok: true,
    lote_id: lote.id,
    fecha: hoyLima(),
    importadas: insertadas.length,
    duplicadas: duplicadas.length + duplicadosEnCarrera,
    con_error: conError.length + (fallidas.length - duplicadosEnCarrera),
    monto_total: montoTotal,
    errores: fallidas.filter(f => !f.duplicado),
  }
})
