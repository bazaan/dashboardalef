/**
 * Lógica compartida de la pestaña "Precios vehículos nuevos" (Trade Cars).
 *
 * Lee `tradecars_data_precios_vehiculos_nuevos` (la que usan el Tasador de
 * WhatsApp y el Asistente como techo 0km), las corridas del bot semanal de n8n
 * (`tradecars_control_sync_precios`) y las decisiones ya tomadas
 * (`tradecars_precios_0km_revisiones`), y calcula qué hallazgos del bot siguen
 * esperando que un administrador los aplique o descarte.
 *
 * Las normalizaciones son LAS MISMAS que usa el bot (referencia/n8n/
 * tradecars-precios-0km-workflow.json, nodo "Validar y decidir"): si cambian
 * allá, cambiar acá.
 */

export const TABLA_PRECIOS = 'tradecars_data_precios_vehiculos_nuevos'
export const TABLA_CORRIDAS = 'tradecars_control_sync_precios'
export const TABLA_REVISIONES = 'tradecars_precios_0km_revisiones'
export const SQL_CORRIDAS = 'sql/tradecars_control_sync_precios.sql'
export const SQL_REVISIONES = 'sql/tradecars_precios_0km_revisiones.sql'

/** Cuántas corridas hacia atrás se miran para encontrar el último hallazgo de cada modelo. */
const CORRIDAS_A_REVISAR = 8

export const normTexto = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim()
export const claveTexto = (s: any) => normTexto(s).replace(/[^A-Z0-9]/g, '')

// Versión sin tokens técnicos: "1.4L LX MT" ≈ "LX", pero "EX SPORT" ≠ "EX".
const TECNICO = /^(\d+[LTV]?|MT|AT|CVT|DCT|IVT|TM|TA|MEC|AUT|AUTO|MANUAL|AUTOMATICO|4X2|4X4|AWD|2WD|4WD|FWD|GSL|GASOLINA|DIESEL|HEV|HIBRIDO|TURBO|L)$/
export const canonicaVersion = (s: any) => normTexto(s).split(/[^A-Z0-9]+/).filter(t => t && !TECNICO.test(t)).sort().join(' ')

export const claveModelo = (marca: any, modelo: any) => `${claveTexto(marca)}|${claveTexto(modelo)}`
export const claveHallazgo = (marca: any, modelo: any, version: any, anio: any) =>
  `${claveModelo(marca, modelo)}|${claveTexto(version)}|${Number(anio) || ''}`

/** Tabla inexistente (migración sin correr). Un SELECT trae 42P01/PGRST205; un INSERT puede traer un error vacío con status 404. */
export const tablaFaltante = (error: any, status?: number) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || status === 404
    || /does not exist|schema cache|could not find the table/i.test(String(error.message || '')))

export function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

export async function leerPrecios(supabase: any): Promise<any[]> {
  const filas: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(TABLA_PRECIOS).select('*')
      .order('marca').order('modelo').order('anio_modelo', { ascending: false }).order('id')
      .range(desde, desde + 999)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

const COLUMNAS_CORRIDA = 'id,fecha_ejecucion,origen,simulado,modelo_ia,total_modelos,exitosos,fallidos,sin_resultado,'
  + 'actualizados,confirmados,insertados,nuevos_no_insertados,saltos_revision,descartados,errores_escritura,'
  + 'tipo_cambio_pen_usd,tipo_cambio_origen,costo_estimado_usd,duracion_seg'

export async function leerCorridas(supabase: any, limite = 20): Promise<{ corridas: any[]; disponible: boolean }> {
  const { data, error, status } = await supabase.from(TABLA_CORRIDAS).select(COLUMNAS_CORRIDA)
    .order('fecha_ejecucion', { ascending: false }).limit(limite)
  if (error) {
    if (tablaFaltante(error, status)) return { corridas: [], disponible: false }
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  return { corridas: data || [], disponible: true }
}

export async function leerDecisiones(supabase: any): Promise<{ decisiones: any[]; disponible: boolean }> {
  const { data, error, status } = await supabase.from(TABLA_REVISIONES)
    .select('clave,decision,precio_encontrado_usd,decidido_en')
    .order('decidido_en', { ascending: false }).limit(5000)
  if (error) {
    if (tablaFaltante(error, status)) return { decisiones: [], disponible: false }
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  return { decisiones: data || [], disponible: true }
}

export interface Pendiente {
  tipo: 'salto' | 'nuevo'
  clave: string
  marca: string
  modelo: string
  version: string | null
  anio_modelo: number
  precio_usd: number
  precio_publicado: number | null
  moneda: string | null
  es_promocion: boolean
  url_fuente: string | null
  fila_id: number | null
  version_en_tabla: string | null
  precio_actual_usd: number | null
  delta_pct: number | null
  corrida_id: number
  fecha_corrida: string
  corrida_simulada: boolean
}

const mismoPrecio = (a: any, b: any) => Math.round(Number(a)) === Math.round(Number(b))

/**
 * Hallazgos que siguen pendientes. De cada marca+modelo se toma su hallazgo MÁS RECIENTE con
 * resultado (la búsqueda web varía entre corridas: un modelo que no apareció esta semana conserva
 * el de la anterior), y se descarta lo que ya se resolvió: aplicado/descartado a ese mismo precio,
 * fila que ya tiene ese precio, o versión que ya existe en la tabla.
 */
export async function calcularPendientes(supabase: any, precios: any[], decisiones: any[]): Promise<Pendiente[]> {
  const { data: corridas, error, status } = await supabase.from(TABLA_CORRIDAS)
    .select('id,fecha_ejecucion,simulado,detalle_json')
    .order('fecha_ejecucion', { ascending: false }).limit(CORRIDAS_A_REVISAR)
  if (error) {
    if (tablaFaltante(error, status)) return []
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  const ultimo = new Map<string, { corrida: any; modelo: any }>()
  for (const c of corridas || []) {
    for (const m of (Array.isArray(c.detalle_json) ? c.detalle_json : [])) {
      if (m?.estado !== 'ok') continue
      const k = claveModelo(m.marca, m.modelo)
      if (!ultimo.has(k)) ultimo.set(k, { corrida: c, modelo: m })
    }
  }

  const porId = new Map(precios.map(p => [Number(p.id), p]))
  const pendientes: Pendiente[] = []

  for (const [k, { corrida, modelo }] of ultimo) {
    const filasModelo = precios.filter(p => claveModelo(p.marca, p.modelo) === k)
    for (const v of (modelo.versiones || [])) {
      const tipo = v.accion === 'salto_revision' ? 'salto' : v.accion === 'nuevo_no_insertado' ? 'nuevo' : null
      if (!tipo || v.precio_usd == null || v.anio_modelo == null) continue
      const anio = Number(v.anio_modelo)
      const clave = claveHallazgo(modelo.marca, modelo.modelo, v.version, anio)
      if (decisiones.some(d => d.clave === clave && mismoPrecio(d.precio_encontrado_usd, v.precio_usd))) continue

      let fila: any = null
      if (tipo === 'salto') {
        fila = porId.get(Number(v.fila_id))
        if (!fila || mismoPrecio(fila.precio_nuevo_usd, v.precio_usd)) continue
      } else {
        const existe = filasModelo.some(p => Number(p.anio_modelo) === anio && (
          claveTexto(p.version) === claveTexto(v.version)
          || (!!canonicaVersion(p.version) && canonicaVersion(p.version) === canonicaVersion(v.version))))
        if (existe) continue
      }

      const actual = fila ? Number(fila.precio_nuevo_usd) : null
      pendientes.push({
        tipo,
        clave,
        marca: normTexto(modelo.marca),
        modelo: normTexto(modelo.modelo),
        version: v.version ? normTexto(v.version) : null,
        anio_modelo: anio,
        precio_usd: Math.round(Number(v.precio_usd)),
        precio_publicado: v.precio_publicado ?? null,
        moneda: v.moneda ?? null,
        es_promocion: !!v.es_promocion,
        url_fuente: v.url_fuente ?? null,
        fila_id: fila ? Number(fila.id) : null,
        version_en_tabla: fila ? (fila.version ?? null) : null,
        precio_actual_usd: actual,
        delta_pct: actual ? Math.round((Number(v.precio_usd) - actual) / actual * 1000) / 10 : null,
        corrida_id: Number(corrida.id),
        fecha_corrida: corrida.fecha_ejecucion,
        corrida_simulada: !!corrida.simulado,
      })
    }
  }

  return pendientes.sort((a, b) =>
    a.tipo !== b.tipo ? (a.tipo === 'salto' ? -1 : 1)
      : a.tipo === 'salto' ? Math.abs(b.delta_pct || 0) - Math.abs(a.delta_pct || 0)
        : `${a.marca} ${a.modelo} ${a.version}`.localeCompare(`${b.marca} ${b.modelo} ${b.version}`))
}
