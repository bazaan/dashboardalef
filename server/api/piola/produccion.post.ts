/**
 * POST /api/piola/produccion — entregables, marcas y catálogo de servicios (§6)
 *
 * Body:
 *   { accion: 'guardar_entregable', id?, titulo, cliente_id, tipo_contenido?, area_id?, ... }
 *   { accion: 'aprobar_entregable', id }
 *   { accion: 'eliminar_entregable', id }
 *   { accion: 'guardar_cliente', id?, nombre, ... }
 *   { accion: 'servicio_crear', nombre, categoria?, precio_referencial?, orden? }
 *   { accion: 'servicio_actualizar', id, activo? }
 *   { accion: 'servicio_eliminar', id }
 *   ── reunión 31/08/2026 ──
 *   { accion: 'guardar_compromiso', cliente_id, tipo_contenido, periodo, cantidad, area_id?, notas? }
 *   { accion: 'eliminar_compromiso', id | (cliente_id + tipo_contenido + periodo) }
 *   { accion: 'guardar_tipo_contenido', id?, clave?, nombre, icono?, color?, orden?, activo? }
 *   { accion: 'eliminar_tipo_contenido', id }
 *   { accion: 'clonar_periodo', cliente_id?, periodo_origen, periodo_destino, incluir_entregables? }
 *
 * LA APROBACIÓN DE DIRECCIÓN ES EL PUNTO. `aprobado_por` y `aprobado_at` los
 * pone el servidor con la sesión verificada y la hora del servidor: el campo
 * existe para poder decir quién dio el visto bueno y cuándo, y un valor que
 * escribe el propio navegador no responde ninguna de las dos preguntas.
 * Aprobar exige permiso de EDICIÓN, no de creación.
 *
 * `piola_clientes` lo escriben Producción (la ficha de la marca) y CRM (al
 * convertir un lead), así que su guard acepta cualquiera de los dos módulos.
 * El registro COMPLETO del cliente (documentos, condiciones, detracción) vive
 * en `/api/piola/clientes`; acá queda el alta rápida de la marca.
 *
 * ══════════ Lo que agregó la reunión del 31/08/2026 ══════════
 *
 * EL COMPROMISO MENSUAL DEJÓ DE SER UN NÚMERO SUELTO. Edson: "si es que a esa
 * marca se le entregan siete videos y siete piezas gráficas, ¿cómo haríamos
 * ahí?". Con `piola_clientes.compromiso_mensual` eso era "14" y el porcentaje
 * mentía: siete videos y cero piezas daba 50 % igual que cero videos y siete
 * piezas. Ahora son dos filas en `piola_compromisos`, cada una con su avance
 * (la vista `piola_cumplimiento_tipo` es la que los cruza).
 *
 * `tipo_contenido` ES TEXTO, NO UNA FK. Así lo define el esquema:
 * `piola_deliverables.tipo_contenido` y `piola_compromisos.tipo_contenido`
 * guardan la CLAVE de `piola_tipos_contenido`, sin integridad referencial. Por
 * eso este endpoint valida a mano que la clave exista y esté activa (la base no
 * lo va a hacer), y por eso la clave de un tipo en uso no se puede renombrar:
 * el rename dejaría huérfanos todos los entregables que la citan.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno, hoyLima } from '../../utils/piola'
import { traerTodo } from '../../../composables/usePiola'

/** 'YYYY-MM'. Un periodo mal formado no rompe nada visible: simplemente el mes
 *  queda vacío en el tablero y nadie entiende por qué. Se valida al escribir. */
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** Mismo CHECK que `piola_deliverables.estado` en sql/piola.sql. */
const ESTADOS_ENTREGABLE = ['en_produccion', 'en_revision', 'aprobado', 'entregado', 'rechazado']

/** Entregables que NO se dan por cumplidos: son los que arrastra `clonar_periodo`. */
const ESTADOS_PENDIENTES = ['en_produccion', 'en_revision', 'rechazado']

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** El RUC se guarda como dígitos pelados, igual que en /api/piola/clientes:
 *  es la llave del autocompletado de la factura y su índice único es literal. */
const soloDigitos = (v: any) => {
  const s = String(v ?? '').replace(/\D/g, '')
  return s || null
}

/**
 * 'Pieza Gráfica' → 'pieza_grafica'. La clave es interna; el nombre es lo que se ve.
 * El NFD + quitar diacríticos va ANTES de filtrar: sin eso 'Gráfica' quedaría
 * como 'gr_fica', porque la 'á' no sobrevive al filtro de [a-z0-9].
 */
const aClave = (v: any) => String(v ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

function exigirPeriodo(v: any, campo = 'periodo'): string {
  const p = String(v ?? '').trim()
  if (!PERIODO_RE.test(p)) {
    throw createError({ statusCode: 400, statusMessage: `El ${campo} debe tener el formato YYYY-MM (llegó: ${p || '—'})` })
  }
  return p
}

/**
 * La clave del tipo de contenido tiene que existir y estar activa.
 * Como no hay FK (ver la cabecera), sin esta comprobación un typo en el body
 * crea una categoría fantasma: el entregable se guarda, no coincide con ningún
 * compromiso y desaparece del cumplimiento sin dar error.
 */
async function exigirTipoContenido(supabase: any, clave: string) {
  const { data, error } = await supabase.from('piola_tipos_contenido')
    .select('id, clave, nombre, activo').eq('clave', clave).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) {
    throw createError({
      statusCode: 400,
      statusMessage: `Tipo de contenido desconocido: "${clave}". Créalo primero en el catálogo.`,
    })
  }
  if (data.activo === false) {
    throw createError({ statusCode: 400, statusMessage: `El tipo de contenido "${data.nombre}" está desactivado` })
  }
  return data
}

/** Inserta en lotes: un INSERT con cientos de filas se va del límite de la URL/payload. */
async function insertarPorLotes(supabase: any, tabla: string, filas: any[], lote = 200) {
  const creadas: any[] = []
  for (let i = 0; i < filas.length; i += lote) {
    const { data, error } = await supabase.from(tabla).insert(filas.slice(i, i + lote)).select('id')
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    creadas.push(...(data || []))
  }
  return creadas
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

    // Sebastián pidió el desglose por tipo y el reparto por área; Raysa, los
    // enlaces ("pones el link del Dropbox… cuando Mari ya lo haya publicado,
    // pone ahí el enlace publicado").
    const tipoContenido = texto(body?.tipo_contenido)
    if (tipoContenido) await exigirTipoContenido(supabase, tipoContenido)

    const periodo = texto(body?.periodo)
    if (periodo) exigirPeriodo(periodo)

    const estado = texto(body?.estado) || 'en_produccion'
    if (!ESTADOS_ENTREGABLE.includes(estado)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Estado de entregable desconocido: ${estado}. Válidos: ${ESTADOS_ENTREGABLE.join(', ')}`,
      })
    }

    const fila: Record<string, any> = {
      titulo,
      cliente_id: clienteId,
      service_id: numero(body?.service_id),
      cantidad: numero(body?.cantidad) ?? 1,
      periodo,
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
      // Reunión 31/08/2026
      tipo_contenido: tipoContenido,
      area_id: numero(body?.area_id),
      dropbox_url: texto(body?.dropbox_url),
      publicado_url: texto(body?.publicado_url),
      updated_at: new Date().toISOString(),
    }
    // `origen_id` NO se acepta del body: lo escribe sólo `clonar_periodo` y es
    // lo que impide que un segundo clon del mismo mes duplique la fila.

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

    // Alta RÁPIDA de la marca: no exige RUC, porque Producción registra la marca
    // mucho antes de que Finanzas tenga su ficha. La ficha formal (documentos,
    // condiciones, detracción) y sus validaciones están en /api/piola/clientes.
    // El RUC sí se normaliza acá: es el mismo índice único, y guardarlo con
    // espacios crearía un cliente que el autocompletado de la factura no
    // encuentra y que además bloquea al bueno.
    const ruc = soloDigitos(body?.ruc)

    const fila = {
      nombre,
      razon_social: texto(body?.razon_social),
      ruc,
      contacto: texto(body?.contacto),
      telefono: texto(body?.telefono),
      email: texto(body?.email),
      direccion: texto(body?.direccion),
      compromiso_mensual: Number(body?.compromiso_mensual || 0),
    }

    const res = id
      ? await supabase.from('piola_clientes').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_clientes').insert(fila).select('*').single()
    if (res.error) {
      if (res.error.code === '23505' && ruc) {
        // El índice único parcial de `ruc` da un mensaje de Postgres ilegible
        let q = supabase.from('piola_clientes').select('id, nombre, razon_social').eq('ruc', ruc)
        if (id) q = q.neq('id', id)
        const { data: otro } = await q.limit(1)
        const quien = otro?.[0]?.razon_social || otro?.[0]?.nombre
        throw createError({
          statusCode: 409,
          statusMessage: quien
            ? `El RUC ${ruc} ya está registrado como ${quien}`
            : `El RUC ${ruc} ya está registrado en otro cliente`,
        })
      }
      throw createError({ statusCode: 400, statusMessage: res.error.message })
    }

    return { ok: true, cliente: res.data }
  }

  /* ══════════ Compromiso mensual por marca y tipo (reunión 31/08/2026) ══════════ */
  if (accion === 'guardar_compromiso') {
    const clienteId = numero(body?.cliente_id)
    if (!clienteId) throw createError({ statusCode: 400, statusMessage: 'El compromiso necesita una marca' })

    const clave = texto(body?.tipo_contenido)
    if (!clave) throw createError({ statusCode: 400, statusMessage: 'El compromiso necesita un tipo de contenido' })

    const periodo = exigirPeriodo(body?.periodo)

    const cantidad = numero(body?.cantidad)
    if (cantidad === null || cantidad < 0) {
      throw createError({ statusCode: 400, statusMessage: 'La cantidad comprometida no puede ser negativa' })
    }

    // Upsert MANUAL en vez de `.upsert()`: un upsert reescribe la fila entera y
    // se llevaría `created_by`/`created_at` (quién fijó el compromiso original,
    // que es justo lo que se quiere conservar cuando alguien lo corrige). Además
    // así se sabe si es alta o edición y el permiso exigido es el correcto: no
    // se puede saber cuál pedir sin haber mirado antes si la celda ya existe.
    const { data: existente, error: errBuscar } = await supabase.from('piola_compromisos')
      .select('id').eq('cliente_id', clienteId).eq('tipo_contenido', clave).eq('periodo', periodo)
      .maybeSingle()
    if (errBuscar) throw createError({ statusCode: 500, statusMessage: errBuscar.message })

    exigirModulo(perfil, 'produccion', existente ? 'edit' : 'create')

    // Después del guard: sin FK, la clave se valida a mano (ver la cabecera)
    await exigirTipoContenido(supabase, clave)

    const campos: Record<string, any> = {
      cantidad: Math.trunc(cantidad),
      area_id: numero(body?.area_id),
      notas: texto(body?.notas),
    }

    let res
    if (existente) {
      res = await supabase.from('piola_compromisos')
        .update(campos).eq('id', existente.id).select('*').single()
    } else {
      res = await supabase.from('piola_compromisos').insert({
        cliente_id: clienteId,
        tipo_contenido: clave,
        periodo,
        ...campos,
        // Quién lo fijó lo pone el servidor, nunca el body
        created_by: perfil.email,
      }).select('*').single()
    }
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, compromiso: res.data, creado: !existente }
  }

  if (accion === 'eliminar_compromiso') {
    exigirModulo(perfil, 'produccion', 'delete')

    // Se acepta el id o la clave natural: la pantalla del tablero conoce la
    // celda (marca × tipo × mes) pero no siempre el id de la fila.
    const id = Number(body?.id) || null
    let q = supabase.from('piola_compromisos').delete()
    if (id) {
      q = q.eq('id', id)
    } else {
      const clienteId = numero(body?.cliente_id)
      const clave = texto(body?.tipo_contenido)
      if (!clienteId || !clave) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Falta el compromiso a eliminar (id, o marca + tipo de contenido + periodo)',
        })
      }
      const periodo = exigirPeriodo(body?.periodo)
      q = q.eq('cliente_id', clienteId).eq('tipo_contenido', clave).eq('periodo', periodo)
    }

    const { data, error } = await q.select('id')
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, eliminados: (data || []).length }
  }

  /* ══════════ Catálogo de tipos de contenido (reunión 31/08/2026) ══════════ */
  // Es tabla y no enum porque Raysa dijo que Sebastián iba a definir los suyos
  // ("puede ser rodajes, puede ser lo que tú desees"): tiene que poder agregarlos
  // sin redeploy. Lo mantiene Producción, que es quien los usa, o Configuración,
  // donde viven el resto de los catálogos.
  if (accion === 'guardar_tipo_contenido') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, ['produccion', 'configuracion'], id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!id && !nombre) {
      throw createError({ statusCode: 400, statusMessage: 'El tipo de contenido necesita un nombre' })
    }

    let actual: any = null
    if (id) {
      const { data } = await supabase.from('piola_tipos_contenido').select('*').eq('id', id).maybeSingle()
      if (!data) throw createError({ statusCode: 404, statusMessage: 'El tipo de contenido no existe' })
      actual = data
    }

    // La clave se deriva del nombre si no la mandan; en una edición se conserva.
    const claveNueva = texto(body?.clave)
      ? aClave(body.clave)
      : (id ? actual.clave : aClave(nombre))
    if (!claveNueva) {
      throw createError({ statusCode: 400, statusMessage: 'No se pudo derivar una clave del nombre' })
    }

    if (id && claveNueva !== actual.clave) {
      // `tipo_contenido` es TEXTO en entregables y compromisos, sin FK: renombrar
      // la clave los deja huérfanos en silencio (dejan de cruzar con su
      // compromiso y salen del cumplimiento). Sólo se permite si nadie la usa.
      const [{ count: entregables }, { count: compromisos }] = await Promise.all([
        supabase.from('piola_deliverables').select('id', { count: 'exact', head: true })
          .eq('tipo_contenido', actual.clave),
        supabase.from('piola_compromisos').select('id', { count: 'exact', head: true })
          .eq('tipo_contenido', actual.clave),
      ])
      const enUso = (entregables || 0) + (compromisos || 0)
      if (enUso) {
        throw createError({
          statusCode: 400,
          statusMessage: `No se puede cambiar la clave "${actual.clave}": ${enUso} registro(s) la usan `
            + 'y quedarían fuera del cumplimiento. Cambia el nombre visible, que es el que se muestra.',
        })
      }
    }

    const fila: Record<string, any> = { clave: claveNueva }
    if (nombre) fila.nombre = nombre
    else if (!id) fila.nombre = claveNueva
    if ('icono' in body) fila.icono = texto(body.icono)
    if ('color' in body) fila.color = texto(body.color)
    if ('orden' in body) fila.orden = Math.trunc(numero(body.orden) ?? 0)
    if ('activo' in body) fila.activo = !!body.activo

    const res = id
      ? await supabase.from('piola_tipos_contenido').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_tipos_contenido').insert(fila).select('*').single()
    if (res.error) {
      if (res.error.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: `Ya existe un tipo de contenido con la clave "${claveNueva}"` })
      }
      throw createError({ statusCode: 400, statusMessage: res.error.message })
    }

    return { ok: true, tipo: res.data, creado: !id }
  }

  if (accion === 'eliminar_tipo_contenido') {
    exigirAlguno(perfil, ['produccion', 'configuracion'], 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el tipo de contenido a eliminar' })

    const { data: tipo } = await supabase.from('piola_tipos_contenido')
      .select('id, clave, nombre').eq('id', id).maybeSingle()
    if (!tipo) throw createError({ statusCode: 404, statusMessage: 'El tipo de contenido no existe' })

    const [{ count: entregables }, { count: compromisos }] = await Promise.all([
      supabase.from('piola_deliverables').select('id', { count: 'exact', head: true })
        .eq('tipo_contenido', tipo.clave),
      supabase.from('piola_compromisos').select('id', { count: 'exact', head: true })
        .eq('tipo_contenido', tipo.clave),
    ])
    const enUso = (entregables || 0) + (compromisos || 0)

    // Si alguien lo usó, se DESACTIVA en vez de borrarse: como la referencia es
    // por texto, borrar la fila del catálogo no borra las referencias — las deja
    // apuntando a un nombre que ya no existe, y el histórico del mes pasado
    // pierde su etiqueta y su color. Desactivado desaparece de los selectores
    // pero el histórico se sigue leyendo.
    if (enUso) {
      const { data, error } = await supabase.from('piola_tipos_contenido')
        .update({ activo: false }).eq('id', id).select('*').single()
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
      return {
        ok: true, desactivado: true, eliminado: false, tipo: data,
        en_uso: { entregables: entregables || 0, compromisos: compromisos || 0 },
      }
    }

    const { error } = await supabase.from('piola_tipos_contenido').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, desactivado: false, eliminado: true, tipo }
  }

  /* ══════════ Repetir el mes (reunión 31/08/2026) ══════════ */
  // Roberto lo ofreció y el cliente aceptó: "cuando ya se termine el cumplimiento
  // del 100% del mes, que haya un botón para poder volver a empezar sin tener que
  // rellenar todo" → Edson: "ya está bien".
  //
  // ES IDEMPOTENTE A PROPÓSITO. Un botón así se toca dos veces (la primera no
  // pareció hacer nada, la pestaña estaba vieja, dos personas a la vez): si
  // duplicara, el compromiso del mes saldría al doble y el cumplimiento a la
  // mitad. Los compromisos se saltan por su clave única (marca × tipo × mes) y
  // los entregables por `origen_id`, que dice de qué fila salió cada copia.
  if (accion === 'clonar_periodo') {
    exigirModulo(perfil, 'produccion', 'create')

    const periodoOrigen = exigirPeriodo(body?.periodo_origen, 'periodo de origen')
    const periodoDestino = exigirPeriodo(body?.periodo_destino, 'periodo de destino')
    if (periodoOrigen === periodoDestino) {
      throw createError({ statusCode: 400, statusMessage: 'El periodo de destino tiene que ser distinto del de origen' })
    }
    const clienteId = numero(body?.cliente_id)

    /* ── Compromisos ── */
    const { data: origen, error: errOrigen } = await traerTodo<any>(() => {
      let q = supabase.from('piola_compromisos')
        .select('cliente_id, tipo_contenido, cantidad, area_id, notas')
        .eq('periodo', periodoOrigen).order('id')
      if (clienteId) q = q.eq('cliente_id', clienteId)
      return q
    })
    if (errOrigen) throw createError({ statusCode: 500, statusMessage: errOrigen.message })

    const { data: yaEnDestino, error: errDestino } = await traerTodo<any>(() => {
      let q = supabase.from('piola_compromisos')
        .select('cliente_id, tipo_contenido')
        .eq('periodo', periodoDestino).order('id')
      if (clienteId) q = q.eq('cliente_id', clienteId)
      return q
    })
    if (errDestino) throw createError({ statusCode: 500, statusMessage: errDestino.message })

    const yaHay = new Set((yaEnDestino || []).map((c: any) => `${c.cliente_id}|${c.tipo_contenido}`))

    // Un tipo desactivado ya no se ofrece para entregables nuevos: tampoco tiene
    // sentido volver a comprometerlo el mes que viene. Se cuenta aparte para que
    // la pantalla lo pueda decir en vez de que desaparezca en silencio.
    const { data: tipos } = await supabase.from('piola_tipos_contenido').select('clave, activo')
    const tiposInactivos = new Set((tipos || []).filter((t: any) => t.activo === false).map((t: any) => t.clave))

    // Lo mismo con las marcas dadas de baja: clonar su plan las resucita en el
    // tablero del mes nuevo. Sólo hace falta mirarlo cuando se clona todo.
    let clientesInactivos = new Set<number>()
    if (!clienteId) {
      const { data: bajas } = await supabase.from('piola_clientes').select('id').eq('activo', false)
      clientesInactivos = new Set((bajas || []).map((c: any) => Number(c.id)))
    }

    const nuevos: any[] = []
    let omitidosCompromisos = 0
    let omitidosTipoInactivo = 0
    let omitidosClienteInactivo = 0
    for (const c of origen || []) {
      if (yaHay.has(`${c.cliente_id}|${c.tipo_contenido}`)) { omitidosCompromisos++; continue }
      if (tiposInactivos.has(c.tipo_contenido)) { omitidosTipoInactivo++; continue }
      if (clientesInactivos.has(Number(c.cliente_id))) { omitidosClienteInactivo++; continue }
      nuevos.push({
        cliente_id: c.cliente_id,
        tipo_contenido: c.tipo_contenido,
        periodo: periodoDestino,
        cantidad: c.cantidad,
        area_id: c.area_id,
        notas: c.notas,
        created_by: perfil.email,
      })
    }
    const creadosCompromisos = nuevos.length
      ? await insertarPorLotes(supabase, 'piola_compromisos', nuevos)
      : []

    /* ── Entregables pendientes (opcional) ── */
    const incluirEntregables = !!body?.incluir_entregables
    const estados = Array.isArray(body?.estados_entregables) && body.estados_entregables.length
      ? body.estados_entregables.map((e: any) => String(e))
      : ESTADOS_PENDIENTES
    // Un estado que no existe no da error en el `.in()`: simplemente no trae
    // nada, y el usuario ve "0 entregables clonados" creyendo que no había.
    const invalidos = estados.filter((e: string) => !ESTADOS_ENTREGABLE.includes(e))
    if (incluirEntregables && invalidos.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `Estado de entregable desconocido: ${invalidos.join(', ')}. `
          + `Válidos: ${ESTADOS_ENTREGABLE.join(', ')}`,
      })
    }

    let creadosEntregables: any[] = []
    let origenEntregables = 0
    let omitidosEntregables = 0

    if (incluirEntregables) {
      const { data: deliv, error: errDeliv } = await traerTodo<any>(() => {
        let q = supabase.from('piola_deliverables')
          .select('id, cliente_id, service_id, titulo, descripcion, cantidad, tipo_contenido, area_id, responsable_email')
          .eq('periodo', periodoOrigen).in('estado', estados).order('id')
        if (clienteId) q = q.eq('cliente_id', clienteId)
        return q
      })
      if (errDeliv) throw createError({ statusCode: 500, statusMessage: errDeliv.message })
      origenEntregables = (deliv || []).length

      // Qué filas del destino ya vinieron de un clon. Se pregunta por `origen_id`
      // en el destino en vez de por la lista de ids de origen: así no hay un
      // `.in()` con cientos de valores y da igual cuántos entregables haya.
      const { data: clonados, error: errClonados } = await traerTodo<any>(() => {
        let q = supabase.from('piola_deliverables')
          .select('origen_id').eq('periodo', periodoDestino).not('origen_id', 'is', null).order('id')
        if (clienteId) q = q.eq('cliente_id', clienteId)
        return q
      })
      if (errClonados) throw createError({ statusCode: 500, statusMessage: errClonados.message })
      const yaClonado = new Set((clonados || []).map((d: any) => Number(d.origen_id)))

      const filas: any[] = []
      for (const d of deliv || []) {
        if (yaClonado.has(Number(d.id))) { omitidosEntregables++; continue }
        filas.push({
          cliente_id: d.cliente_id,
          service_id: d.service_id,
          titulo: d.titulo,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          tipo_contenido: d.tipo_contenido,
          area_id: d.area_id,
          responsable_email: d.responsable_email,
          periodo: periodoDestino,
          // El mes nuevo arranca de cero: el estado, la fecha de entrega, la
          // aprobación y los enlaces son del entregable viejo, no de la copia.
          estado: 'en_produccion',
          fecha_compromiso: null,
          origen_id: d.id,
        })
      }
      creadosEntregables = filas.length
        ? await insertarPorLotes(supabase, 'piola_deliverables', filas)
        : []
    }

    return {
      ok: true,
      periodo_origen: periodoOrigen,
      periodo_destino: periodoDestino,
      cliente_id: clienteId,
      compromisos: {
        origen: (origen || []).length,
        clonados: creadosCompromisos.length,
        omitidos: omitidosCompromisos,
        omitidos_tipo_inactivo: omitidosTipoInactivo,
        omitidos_cliente_inactivo: omitidosClienteInactivo,
      },
      entregables: incluirEntregables
        ? {
            origen: origenEntregables,
            clonados: creadosEntregables.length,
            omitidos: omitidosEntregables,
            estados,
          }
        : null,
    }
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
