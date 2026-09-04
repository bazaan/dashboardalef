/**
 * POST /api/piola/contabilidad — movimientos y categorías de gasto (§4)
 *
 * Body:
 *   { accion: 'guardar_movimiento', id?, tipo, fecha, concepto, subtotal, descuento,
 *     impuestos_sel: string[], ...campos }
 *   { accion: 'eliminar_movimiento', id }
 *   { accion: 'aprobar_egreso', id }
 *   { accion: 'crear_categoria', nombre, parent_id?, tipo, codigo? }
 *   { accion: 'editar_categoria', id, nombre?, activo?, codigo? }
 *   { accion: 'eliminar_categoria', id }
 *   { accion: 'importar_movimientos', filas: [...], origen? }   ← reunión 31/08/2026
 *   { accion: 'deshacer_importacion', batch_id }
 *   { accion: 'listar_importaciones', limit?, offset? }
 *
 * LOS IMPORTES LOS CALCULA EL SERVIDOR, no la pantalla. El cliente manda
 * `subtotal`, `descuento` y los CÓDIGOS de impuesto marcados; acá se leen las
 * tasas vigentes de `piola_impuestos` y se recalcula el total con la misma
 * función que usa el formulario (`calcularTotalesMovimiento`, importada del
 * composable para que no haya dos versiones de la fórmula).
 *
 * Importa porque `monto` es lo que suman los gráficos, los reportes y el saldo
 * de las cuentas por cobrar: si lo pusiera el navegador, se podría registrar un
 * ingreso de S/ 10 000 con un total escrito a mano de S/ 100, y todo el resto
 * del sistema lo daría por bueno. También evita que una tasa desactualizada en
 * una pestaña vieja se cuele como si fuera la vigente.
 *
 * Lo que NO se toca acá: `estado` y `monto_pagado` en una edición. Los maneja
 * el trigger `piola_recalcular_saldo()` a partir de `piola_pagos`; escribirlos
 * desde acá dejaría cuentas "pagadas" con saldo.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, hoyLima } from '../../utils/piola'
import { dispararAlertaInmediata } from '../../utils/piola-alertas'
import { calcularTotalesMovimiento } from '../../../composables/usePiola'

const TIPOS = ['ingreso', 'egreso']

/** Campos descriptivos: no cambian ningún importe. */
const CAMPOS_TEXTO = [
  'documento_serie', 'documento_numero', 'documento_adjunto',
  'payment_method', 'responsable_email', 'notas',
]
const CAMPOS_ID = [
  'category_id', 'cliente_id', 'proveedor_id', 'area_id', 'centro_costo_id',
  'tipo_comprobante_id', 'condicion_pago_id',
]

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const money = (n: any) => `S/ ${Number(n || 0).toLocaleString('es-PE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`

/**
 * Compara nombres escritos a mano: sin tildes, sin mayúsculas, sin espacios de sobra.
 *
 * NFD separa la letra de su tilde, así que quitar todo lo que no sea ASCII deja
 * la letra base ('Café' → 'cafe', 'Ñandú' → 'nandu'). Es lo que hace falta para
 * cruzar la categoría que escribió el asesor con la que está en la base.
 */
const sinTildes = (v: any) => String(v ?? '')
  .normalize('NFD').replace(/[^\x00-\x7F]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ')

/* ══════════ Tipo de gasto numerado (reunión 31/08/2026) ══════════ */

/**
 * El "número de gasto" de Edson (2 = combustible, 20 = merchandising, 62 = Oana).
 * Entero positivo o nada: un 0 o un 3.5 no son un número de su lista, y aceptarlos
 * dejaría filas que su Excel no puede cruzar.
 */
function codigoCategoria(body: any): number | null | undefined {
  if (!('codigo' in body)) return undefined          // no viene: no se toca
  const v = body.codigo
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El número del tipo de gasto debe ser un entero positivo (o quedar vacío)',
    })
  }
  return n
}

/**
 * El índice único `idx_piola_expcat_codigo` protege la unicidad, pero su error
 * de Postgres ("duplicate key value violates unique constraint…") no le dice a
 * nadie QUIÉN tiene ya ese número. Se consulta antes para poder nombrarla.
 */
async function exigirCodigoLibre(supabase: any, codigo: number | null, idActual: number | null) {
  if (codigo === null || codigo === undefined) return
  const { data } = await supabase.from('piola_expense_categories')
    .select('id, nombre').eq('codigo', codigo).maybeSingle()
  if (data && Number(data.id) !== Number(idActual)) {
    throw createError({
      statusCode: 400,
      statusMessage: `El código ${codigo} ya lo usa la categoría "${data.nombre}"`,
    })
  }
}

/** Red de seguridad por si dos pestañas piden el mismo número a la vez. */
function traducirErrorCategoria(mensaje: string, codigo: number | null | undefined): string {
  if (codigo && /idx_piola_expcat_codigo|duplicate key/i.test(mensaje)) {
    return `El código ${codigo} ya lo usa otra categoría`
  }
  return mensaje
}

/* ══════════ Importación masiva desde Excel (reunión 31/08/2026) ══════════ */

/** Método de pago de las filas importadas: "el método no lo pongo, pero todo es transferencia". */
const METODO_PAGO_IMPORT = 'Transferencia bancaria'
/** Tope por lote. Edson habla de 30-40 filas por semana; esto es holgura, no un límite real. */
const MAX_FILAS_IMPORT = 1000

/** 'Tipo de Gasto' → 'tipo_de_gasto': la fila se lee igual venga como venga el encabezado. */
const normalizarClave = (k: any) => sinTildes(k)
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function indexarFila(fila: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(fila || {})) out[normalizarClave(k)] = v
  return out
}

/** Primer alias con valor. Devuelve null si ninguno vino o todos vinieron vacíos. */
function leer(idx: Record<string, any>, ...alias: string[]): any {
  for (const a of alias) {
    const v = idx[a]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return null
}

/** La columna `tipo` de Edson dice ingreso/egreso, pero nadie escribe siempre igual. */
const TIPO_SINONIMOS: Record<string, string> = {
  ingreso: 'ingreso', ingresos: 'ingreso', entrada: 'ingreso', entradas: 'ingreso',
  venta: 'ingreso', ventas: 'ingreso', cobro: 'ingreso', i: 'ingreso',
  egreso: 'egreso', egresos: 'egreso', salida: 'egreso', salidas: 'egreso',
  gasto: 'egreso', gastos: 'egreso', compra: 'egreso', compras: 'egreso',
  pago: 'egreso', e: 'egreso',
}

/** ¿Existe realmente ese día? El 31/02 no. */
function fechaExiste(y: number, m: number, d: number): boolean {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Fecha de una fila importada, SIN hora (la columna de Edson no la tiene).
 *
 * Se aceptan tres formas porque las tres salen de un Excel según cómo se haya
 * copiado: ISO ('2026-09-01'), el formato peruano ('01/09/2026') y el número de
 * serie de Excel (45901) que aparece cuando el cliente lee el .xlsx en vez del
 * portapapeles. **Día primero**, que es como se escribe una fecha en Perú:
 * interpretar 03/09 como marzo movería el movimiento seis meses sin avisar.
 *
 * Cualquier otra cosa devuelve null → la fila se rechaza con su motivo. No se
 * inventa una fecha ni se cae al día de hoy: un flujo de caja con la fecha
 * equivocada es peor que una fila menos.
 */
function parseFechaImport(v: any): string | null {
  if (v === null || v === undefined) return null

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Serial de Excel: días desde el 30/12/1899. El rango descarta que un
    // importe suelto se cuele como fecha.
    if (v < 20000 || v > 80000) return null
    const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000
    return new Date(ms).toISOString().slice(0, 10)
  }

  const s = String(v).trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    return fechaExiste(y, m, d)
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : null
  }

  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (dmy) {
    const d = Number(dmy[1])
    const m = Number(dmy[2])
    let y = Number(dmy[3])
    if (y < 100) y += 2000
    return fechaExiste(y, m, d)
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : null
  }
  return null
}

/**
 * Importe de una fila.
 *
 * La misma celda sale como 'S/ 1,234.56' o como '1.234,56' según la
 * configuración regional de la máquina desde la que se copió. Se decide cuál es
 * el separador decimal por el ÚLTIMO símbolo que aparece: en '1.234,56' es la
 * coma, en '1,234.56' es el punto. Equivocarse ahí multiplica o divide el
 * importe por mil sin que nadie lo note.
 */
function parseImporte(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null

  let s = String(v ?? '').trim()
  if (!s) return null
  // Contabilidad escribe los negativos entre paréntesis
  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-')
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null

  const coma = s.lastIndexOf(',')
  const punto = s.lastIndexOf('.')
  if (coma >= 0 && punto >= 0) {
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (coma >= 0) {
    // Coma sola: decimal si deja 1 o 2 dígitos detrás ('1234,5'), miles si no ('1,234')
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const abs = Math.round(Math.abs(n) * 100) / 100
  return negativo ? -abs : abs
}

/* ══════════ Aviso por WhatsApp de cada movimiento (reunión 31/08/2026) ══════════ */

/**
 * Texto del aviso. Lleva el número del tipo de gasto además del nombre porque
 * es por ese número que Edson reconoce y filtra sus gastos ("para mí el dos es
 * combustible"): un aviso que dijera sólo "Combustible" le haría abrir el
 * dashboard para saber de cuál de sus rubros se trata.
 */
async function mensajeMovimiento(
  supabase: any, mov: any, quien: string, esEdicion: boolean,
): Promise<string> {
  let categoria = ''
  if (mov?.category_id) {
    const { data } = await supabase.from('piola_expense_categories')
      .select('nombre, codigo').eq('id', mov.category_id).maybeSingle()
    if (data) categoria = data.codigo ? `${data.codigo} · ${data.nombre}` : String(data.nombre)
  }

  const esIngreso = mov?.tipo === 'ingreso'
  return [
    `${esIngreso ? '💵' : '📤'} *${esIngreso ? 'Ingreso' : 'Egreso'} ${esEdicion ? 'actualizado' : 'registrado'}*`,
    mov?.concepto || '(sin concepto)',
    `Monto: ${money(mov?.monto)}`,
    `Fecha: ${String(mov?.fecha || '').slice(0, 10)}`,
    categoria ? `Tipo de gasto: ${categoria}` : '',
    mov?.payment_method ? `Método: ${mov.payment_method}` : '',
    mov?.estado && mov.estado !== 'pagado' ? `Estado: ${mov.estado}` : '',
    `Registró: ${quien}`,
  ].filter(Boolean).join('\n')
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Alta o edición de un movimiento ══════════ */
  if (accion === 'guardar_movimiento') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'contabilidad', id ? 'edit' : 'create')

    const tipo = String(body?.tipo || '')
    if (!TIPOS.includes(tipo)) {
      throw createError({ statusCode: 400, statusMessage: `Tipo de movimiento inválido: ${tipo}` })
    }
    const concepto = texto(body?.concepto)
    if (!concepto) {
      throw createError({ statusCode: 400, statusMessage: 'El movimiento necesita un concepto' })
    }

    // Las tasas vigentes salen de la base, no del body
    const codigos = Array.isArray(body?.impuestos_sel)
      ? body.impuestos_sel.map((c: any) => String(c)) : []
    let aplicados: any[] = []
    if (codigos.length) {
      const { data: impuestos, error: errImp } = await supabase
        .from('piola_impuestos').select('codigo, nombre, tasa, comportamiento, aplica_a')
        .eq('activo', true).in('codigo', codigos)
      if (errImp) throw createError({ statusCode: 500, statusMessage: errImp.message })
      aplicados = (impuestos || [])
        // Un impuesto de ingreso no se aplica a un egreso aunque venga marcado
        .filter((i: any) => ['ambos', tipo].includes(i.aplica_a))
        .map((i: any) => ({
          codigo: i.codigo, nombre: i.nombre,
          tasa: Number(i.tasa), comportamiento: i.comportamiento,
        }))
    }

    const t = calcularTotalesMovimiento(
      Number(body?.subtotal || 0), Number(body?.descuento || 0), aplicados)
    if (!t.total) {
      throw createError({ statusCode: 400, statusMessage: 'El movimiento necesita un importe' })
    }

    const fila: Record<string, any> = {
      tipo,
      fecha: texto(body?.fecha) || hoyLima(),
      concepto,
      // `monto` es el TOTAL: es lo que suman los gráficos y los reportes
      monto: t.total,
      subtotal: t.subtotal,
      descuento: t.descuento,
      impuestos: t.impuestos,
      impuestos_detalle: t.detalle,
      precio: numero(body?.precio),
      cantidad: numero(body?.cantidad),
      fecha_vencimiento: texto(body?.fecha_vencimiento),
      proyectado: !!body?.proyectado,
      updated_at: new Date().toISOString(),
    }
    for (const k of CAMPOS_TEXTO) if (k in body) fila[k] = texto(body[k])
    for (const k of CAMPOS_ID) if (k in body) fila[k] = numero(body[k])
    // Un cliente solo tiene sentido en un ingreso, y un proveedor en un egreso
    if (tipo === 'ingreso') fila.proveedor_id = null
    else fila.cliente_id = null

    if (id) {
      fila.updated_by = perfil.email
    } else {
      fila.created_by = perfil.email
      // Un movimiento sin condición de pago es caja que ya ocurrió
      fila.estado = fila.condicion_pago_id || fila.fecha_vencimiento ? 'pendiente' : 'pagado'
      if (fila.estado === 'pagado') fila.monto_pagado = t.total
    }

    const res = id
      ? await supabase.from('piola_transactions').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_transactions').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    // Aviso inmediato por WhatsApp (reunión 31/08/2026). Se espera a que termine
    // —aunque su resultado no cambie nada— porque en Netlify la función se
    // congela al responder: una promesa suelta acá no se llegaría a enviar.
    // `dispararAlertaInmediata` nunca lanza, así que esto no puede tumbar el
    // movimiento que ya quedó guardado.
    const aviso = await dispararAlertaInmediata(supabase, {
      tipo: 'movimiento_registrado',
      related_table: 'piola_transactions',
      related_id: res.data?.id ?? null,
      titulo: `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ${id ? 'actualizado' : 'registrado'}: ${concepto}`,
      mensaje: await mensajeMovimiento(supabase, res.data, perfil.email, !!id),
    })

    return { ok: true, movimiento: res.data, totales: t, alerta: aviso }
  }

  /* ══════════ Eliminar un movimiento ══════════ */
  if (accion === 'eliminar_movimiento') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el movimiento a eliminar' })

    // Borrar la cuenta borraría en cascada los pagos ya aplicados contra ella:
    // eso es rehacer un cobro, no corregir un tipeo.
    const { count } = await supabase.from('piola_pagos')
      .select('id', { count: 'exact', head: true }).eq('transaction_id', id)
    if (count) {
      throw createError({
        statusCode: 400,
        statusMessage: `Ese movimiento tiene ${count} pago(s) registrados: elimínalos primero o anúlalo`,
      })
    }

    const { error } = await supabase.from('piola_transactions').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Aprobar un egreso (cuenta por pagar) ══════════ */
  // §3 de la especificación financiera: "Cuentas por pagar ... responsable de
  // aprobación". Es metadata aparte del `estado` (pendiente/parcial/pagado),
  // que sigue siendo dueño exclusivo del trigger — un egreso puede estar
  // aprobado y seguir pendiente de pago, o pagarse sin haber pasado por acá
  // si el flujo de la empresa no lo exige.
  if (accion === 'aprobar_egreso') {
    exigirModulo(perfil, 'contabilidad', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el egreso a aprobar' })

    const { data: mov } = await supabase.from('piola_transactions')
      .select('id, tipo').eq('id', id).maybeSingle()
    if (!mov) throw createError({ statusCode: 404, statusMessage: 'El movimiento no existe' })
    if (mov.tipo !== 'egreso') {
      throw createError({ statusCode: 400, statusMessage: 'Sólo los egresos (cuentas por pagar) se aprueban' })
    }

    const { error } = await supabase.from('piola_transactions').update({
      aprobado_por: perfil.email,
      aprobado_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Categorías de gasto (jerárquicas) ══════════ */
  if (accion === 'crear_categoria') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La categoría necesita un nombre' })

    // El número del tipo de gasto es opcional: las categorías que ya existían
    // siguen sin número hasta que Edson les asigne el suyo.
    const codigo = codigoCategoria(body) ?? null
    await exigirCodigoLibre(supabase, codigo, null)

    const { data, error } = await supabase.from('piola_expense_categories').insert({
      nombre,
      parent_id: numero(body?.parent_id),
      tipo: texto(body?.tipo) || 'egreso',
      orden: numero(body?.orden) ?? 0,
      codigo,
    }).select('*').single()
    if (error) {
      throw createError({ statusCode: 400, statusMessage: traducirErrorCategoria(error.message, codigo) })
    }

    return { ok: true, categoria: data }
  }

  if (accion === 'editar_categoria') {
    exigirModulo(perfil, 'contabilidad', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la categoría a editar' })

    const patch: Record<string, any> = {}
    if ('nombre' in body) {
      const nombre = texto(body.nombre)
      if (!nombre) throw createError({ statusCode: 400, statusMessage: 'La categoría necesita un nombre' })
      patch.nombre = nombre
    }
    if ('activo' in body) patch.activo = !!body.activo
    if ('parent_id' in body) patch.parent_id = numero(body.parent_id)
    if ('tipo' in body) patch.tipo = texto(body.tipo) || 'egreso'

    // `undefined` = la petición no trae el campo; `null` = lo trae vacío y hay
    // que borrar el número. Distinguirlo evita que renombrar una categoría le
    // quite el número que ya tenía.
    const codigo = codigoCategoria(body)
    if (codigo !== undefined) {
      await exigirCodigoLibre(supabase, codigo, id)
      patch.codigo = codigo
    }

    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    const { error } = await supabase.from('piola_expense_categories').update(patch).eq('id', id)
    if (error) {
      throw createError({ statusCode: 400, statusMessage: traducirErrorCategoria(error.message, codigo ?? null) })
    }

    return { ok: true }
  }

  if (accion === 'eliminar_categoria') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la categoría a eliminar' })

    // Las subcategorías caen en cascada (FK) y los movimientos quedan sin
    // categoría: la pantalla ya lo avisa, acá solo se ejecuta.
    const { error } = await supabase.from('piola_expense_categories').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Importación masiva desde Excel (reunión 31/08/2026) ══════════
   *
   * Edson: "a veces tenemos 30 movimientos, 40 movimientos en una semana y
   * estar metiéndole uno a uno es demasiada carga operativa".
   *
   * El cliente manda las filas YA separadas en objetos ({ fecha, tipo,
   * concepto, codigo, categoria, importe }); acá se valida una por una. Una
   * fila mala **no tumba el lote**: se anota en `errores` con su número de fila
   * y las demás entran igual. Lo contrario obligaría a repegar las 40 por un
   * tipeo, que es exactamente la carga operativa que se quiere quitar.
   */
  if (accion === 'importar_movimientos') {
    exigirModulo(perfil, 'contabilidad', 'create')

    const filas = Array.isArray(body?.filas) ? body.filas : null
    if (!filas || !filas.length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay filas que importar' })
    }
    if (filas.length > MAX_FILAS_IMPORT) {
      throw createError({
        statusCode: 400,
        statusMessage: `El lote trae ${filas.length} filas y el máximo es ${MAX_FILAS_IMPORT}: pégalas por partes`,
      })
    }

    // El catálogo entero de una vez: cruzar cada fila con su propia consulta
    // serían 40 viajes a la base para resolver 4 categorías distintas.
    const { data: categorias, error: errCat } = await supabase
      .from('piola_expense_categories').select('id, nombre, codigo, activo')
    if (errCat) throw createError({ statusCode: 500, statusMessage: errCat.message })

    const porCodigo = new Map<number, any>()
    const porNombre = new Map<string, any[]>()
    for (const c of categorias || []) {
      if (c.codigo !== null && c.codigo !== undefined) porCodigo.set(Number(c.codigo), c)
      const clave = sinTildes(c.nombre)
      porNombre.set(clave, [...(porNombre.get(clave) || []), c])
    }

    const errores: Array<{ fila: number; motivo: string }> = []
    const validas: Record<string, any>[] = []
    const filaDeCadaValida: number[] = []

    for (let i = 0; i < filas.length; i++) {
      const idx = indexarFila(filas[i] || {})
      // El número de fila del Excel, para que el error se pueda ubicar en la
      // hoja original. Si el cliente no lo manda, se usa la posición del lote.
      const nFila = Number(leer(idx, 'fila', '_fila', 'n_fila')) || (i + 1)
      const falla = (motivo: string) => errores.push({ fila: nFila, motivo })

      const fecha = parseFechaImport(leer(idx, 'fecha', 'fecha_movimiento', 'dia'))
      if (!fecha) { falla('Fecha vacía o ilegible (usa 01/09/2026 o 2026-09-01)'); continue }

      const tipoCrudo = sinTildes(leer(idx, 'tipo', 'tipo_movimiento', 'movimiento'))
      const tipo = TIPO_SINONIMOS[tipoCrudo]
      if (!tipo) { falla(`Tipo "${tipoCrudo || '(vacío)'}" no es ingreso ni egreso`); continue }

      const concepto = texto(leer(idx, 'concepto', 'descripcion', 'detalle', 'glosa'))
      if (!concepto) { falla('Falta el concepto'); continue }

      let importe = parseImporte(leer(idx, 'importe', 'monto', 'total', 'valor'))
      if (importe === null) { falla('Importe vacío o ilegible'); continue }
      if (importe < 0) {
        // En su hoja los egresos a veces van en negativo. La columna `tipo` ya
        // lleva el signo, así que en un egreso el menos es redundante; en un
        // ingreso es una contradicción y no se adivina cuál de las dos manda.
        if (tipo !== 'egreso') { falla('Importe negativo en un ingreso'); continue }
        importe = Math.abs(importe)
      }
      if (!(importe > 0)) { falla('El importe tiene que ser mayor que cero'); continue }

      // Tipo de gasto: primero por número (que es como Edson los identifica) y
      // sólo si no vino, por nombre.
      let categoryId: number | null = null
      const codigoCrudo = leer(idx, 'codigo', 'tipo_gasto', 'tipo_de_gasto', 'codigo_gasto', 'n_gasto', 'numero')
      const nombreCat = leer(idx, 'categoria', 'categoria_nombre', 'rubro', 'cuenta')

      if (codigoCrudo !== null) {
        const n = Number(String(codigoCrudo).trim())
        if (!Number.isInteger(n)) { falla(`El tipo de gasto "${codigoCrudo}" no es un número`); continue }
        const cat = porCodigo.get(n)
        if (!cat) { falla(`No existe ninguna categoría con el número ${n}`); continue }
        categoryId = cat.id
      } else if (nombreCat !== null) {
        const halladas = porNombre.get(sinTildes(nombreCat)) || []
        if (!halladas.length) { falla(`No existe la categoría "${nombreCat}"`); continue }
        if (halladas.length > 1) {
          // Dos subcategorías pueden llamarse igual bajo padres distintos:
          // elegir una al azar mandaría el gasto al rubro equivocado.
          falla(`Hay ${halladas.length} categorías llamadas "${nombreCat}": usa el número`)
          continue
        }
        categoryId = halladas[0].id
      }
      // Sin número ni nombre la fila entra sin categoría: es lo mismo que hace
      // el formulario, donde la categoría también es opcional.

      const vencimiento = parseFechaImport(leer(idx, 'fecha_vencimiento', 'vencimiento'))

      validas.push({
        tipo,
        fecha,
        concepto,
        // El Excel de flujo de caja trae un importe sin desglose: el total ES
        // ese importe. No se inventan impuestos que la hoja no declara.
        monto: importe,
        subtotal: importe,
        descuento: 0,
        impuestos: 0,
        impuestos_detalle: [],
        category_id: categoryId,
        // "el método no lo pongo, pero todo es transferencia"
        payment_method: texto(leer(idx, 'payment_method', 'metodo_pago', 'metodo')) || METODO_PAGO_IMPORT,
        notas: texto(leer(idx, 'notas', 'observaciones', 'comentario')),
        fecha_vencimiento: vencimiento,
        // Sin vencimiento es caja que ya ocurrió, igual que en el formulario
        estado: vencimiento ? 'pendiente' : 'pagado',
        monto_pagado: vencimiento ? 0 : importe,
        proyectado: false,
        created_by: perfil.email,
      })
      filaDeCadaValida.push(nFila)
    }

    // El lote se crea antes de insertar porque las filas lo apuntan por FK, y
    // se registra aunque no haya ninguna fila válida: el historial de "esto se
    // intentó importar y falló entero" es justo lo que se necesita ver.
    const { data: batch, error: errBatch } = await supabase.from('piola_import_batches').insert({
      origen: texto(body?.origen) || 'excel',
      filas_total: filas.length,
      filas_ok: 0,
      filas_error: errores.length,
      errores,
      importado_por: perfil.email,
    }).select('id, created_at').single()
    if (errBatch || !batch) {
      throw createError({ statusCode: 500, statusMessage: errBatch?.message || 'No se pudo crear el lote' })
    }

    let insertados: any[] = []
    if (validas.length) {
      const conLote = validas.map(f => ({ ...f, import_batch_id: batch.id }))
      const res = await supabase.from('piola_transactions')
        .insert(conLote).select('id, tipo, fecha, concepto, monto, category_id')

      if (res.error) {
        // Postgres rechaza el INSERT entero por una sola fila mala (una FK, un
        // CHECK). Se reintenta una por una para que las buenas entren igual y
        // el motivo quede en la fila que lo causó, no en las 40.
        for (let k = 0; k < conLote.length; k++) {
          const uno = await supabase.from('piola_transactions')
            .insert(conLote[k]).select('id, tipo, fecha, concepto, monto, category_id').single()
          if (uno.error) errores.push({ fila: filaDeCadaValida[k], motivo: uno.error.message })
          else insertados.push(uno.data)
        }
      } else {
        insertados = res.data || []
      }
    }

    await supabase.from('piola_import_batches').update({
      filas_ok: insertados.length,
      filas_error: errores.length,
      errores,
    }).eq('id', batch.id)

    // UN aviso por lote, no uno por fila: cuarenta WhatsApps seguidos no son
    // una alerta, son ruido que garantiza que nadie los lea.
    const aviso = insertados.length
      ? await dispararAlertaInmediata(supabase, {
        tipo: 'movimiento_registrado',
        related_table: 'piola_import_batches',
        related_id: batch.id,
        titulo: `Importación de ${insertados.length} movimiento(s)`,
        mensaje: [
          '📥 *Importación de movimientos*',
          `${insertados.length} de ${filas.length} fila(s) registradas`,
          `Ingresos: ${money(insertados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto || 0), 0))}`,
          `Egresos: ${money(insertados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto || 0), 0))}`,
          errores.length ? `⚠️ ${errores.length} fila(s) con error` : '',
          `Importó: ${perfil.email}`,
        ].filter(Boolean).join('\n'),
      })
      : { ok: false, motivo: 'no se importó ninguna fila' }

    return {
      ok: true,
      batch_id: batch.id,
      filas_total: filas.length,
      filas_ok: insertados.length,
      filas_error: errores.length,
      errores,
      movimientos: insertados,
      alerta: aviso,
    }
  }

  /* ══════════ Deshacer una importación completa ══════════ */
  if (accion === 'deshacer_importacion') {
    exigirModulo(perfil, 'contabilidad', 'delete')

    const batchId = Number(body?.batch_id)
    if (!batchId) throw createError({ statusCode: 400, statusMessage: 'Falta el lote a deshacer' })

    const { data: batch } = await supabase.from('piola_import_batches')
      .select('*').eq('id', batchId).maybeSingle()
    if (!batch) throw createError({ statusCode: 404, statusMessage: 'Ese lote de importación no existe' })
    if (batch.deshecho_at) {
      throw createError({
        statusCode: 400,
        statusMessage: `Ese lote ya se deshizo el ${String(batch.deshecho_at).slice(0, 10)}`
          + (batch.deshecho_por ? ` (${batch.deshecho_por})` : ''),
      })
    }

    // Paginado: un lote puede traer más de las 1000 filas que devuelve
    // PostgREST de una sola vez, y el corte no da error — dejaría movimientos
    // sueltos apuntando a un lote marcado como deshecho.
    const ids: number[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase.from('piola_transactions')
        .select('id').eq('import_batch_id', batchId)
        .order('id', { ascending: true }).range(desde, desde + 999)
      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      ids.push(...(data || []).map((r: any) => Number(r.id)))
      if (!data || data.length < 1000) break
    }

    // La FK de `piola_pagos` es ON DELETE CASCADE: borrar estos movimientos se
    // llevaría los cobros aplicados contra ellos sin decir nada. Deshacer una
    // importación es corregir un pegado, no rehacer una cobranza.
    const conPagos = new Set<number>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('piola_pagos')
        .select('transaction_id').in('transaction_id', ids.slice(i, i + 200))
      for (const p of data || []) conPagos.add(Number(p.transaction_id))
    }
    if (conPagos.size) {
      throw createError({
        statusCode: 400,
        statusMessage: `No se puede deshacer: ${conPagos.size} movimiento(s) de este lote ya tienen pagos `
          + 'registrados y se borrarían con ellos. Elimina primero esos pagos, o borra esos movimientos a mano.',
      })
    }

    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('piola_transactions')
        .delete().in('id', ids.slice(i, i + 200))
      if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    }

    const { error: errMarca } = await supabase.from('piola_import_batches').update({
      deshecho_at: new Date().toISOString(),
      deshecho_por: perfil.email,
    }).eq('id', batchId)
    if (errMarca) throw createError({ statusCode: 500, statusMessage: errMarca.message })

    return { ok: true, batch_id: batchId, eliminados: ids.length }
  }

  /* ══════════ Historial de importaciones ══════════
   * `piola_import_batches` no tiene policy para `anon` (son datos de finanzas),
   * así que la pantalla no puede leerla directo como hace con el resto: los
   * lotes salen por acá o no salen. */
  if (accion === 'listar_importaciones') {
    exigirModulo(perfil, 'contabilidad', 'view')

    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200)
    const offset = Math.max(Number(body?.offset) || 0, 0)

    const { data, error, count } = await supabase.from('piola_import_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true, lotes: data || [], total: count ?? (data || []).length }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
