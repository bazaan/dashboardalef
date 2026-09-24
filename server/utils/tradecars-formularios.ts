/**
 * Formularios IG / FB / TikTok de Trade Cars — acceso a Google Sheets, configuración
 * por canal y estado de cada tarjeta.
 *
 * La lógica de columnas y limpieza de datos vive en `utils/tradecarsFormularios.ts`
 * (pura, sin red). Acá está lo que necesita servidor: hablar con Google y con Supabase.
 *
 * DÓNDE VIVE CADA COSA
 *   · Los datos del lead      → la hoja de Google. Se leen EN VIVO cada vez; no se copian.
 *   · Estado, notas, precio   → `tradecars_formularios_estado`, atado al lead por `lead_key`
 *                               (la hoja es de solo lectura: nada se escribe de vuelta en ella).
 *   · Qué hoja es de cada canal → `tradecars_formularios_config` (editable desde la pantalla),
 *                               con las variables TRADECARS_SHEET_*_ID como respaldo.
 *   · Acceso a Google         → el token OAuth de Trade Cars (`google_refresh_token_tradecars`),
 *                               el mismo mecanismo que ya usan Healup y Davila.
 */

import { getGoogleAccessToken, hasRefreshToken } from './google-auth'
import {
  CANALES_FORMULARIO, extraerReferenciaHoja, hojaALeads,
  type CanalFormulario, type LeadFormulario,
} from '../../utils/tradecarsFormularios'

export const EMPRESA_GOOGLE = 'tradecars'
const API_SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

export type CausaErrorHoja = 'sin_google' | 'token' | 'sin_acceso' | 'no_encontrada' | 'otro'

/** Un fallo esperable al leer la hoja: se le cuenta a la pantalla en vez de romperla con un 500. */
export class ErrorHoja extends Error {
  causa: CausaErrorHoja
  constructor(causa: CausaErrorHoja, mensaje: string) {
    super(mensaje)
    this.causa = causa
  }
}

export interface ConfigHoja {
  canal: CanalFormulario
  sheet_id: string | null
  pestana: string | null
  gid: number | null
  mapeo: Record<string, string>
  /** De dónde salió: la pantalla (base) o la variable de entorno de respaldo. */
  origen: 'db' | 'env' | null
  conectado_por?: string | null
  updated_at?: string | null
}

/* ══════════════════════════ Configuración por canal ══════════════════════════ */

const tablaFaltante = (error: any) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(String(error.message || '')))

export async function leerConfigHoja(supabase: any, canal: CanalFormulario): Promise<{ config: ConfigHoja; tablaDisponible: boolean }> {
  const vacia: ConfigHoja = { canal, sheet_id: null, pestana: null, gid: null, mapeo: {}, origen: null }

  const { data, error } = await supabase
    .from('tradecars_formularios_config').select('*').eq('canal', canal).maybeSingle()
  const tablaDisponible = !tablaFaltante(error)

  if (data?.sheet_id) {
    return {
      tablaDisponible,
      config: {
        canal, sheet_id: data.sheet_id, pestana: data.pestana || null,
        gid: data.gid === null || data.gid === undefined ? null : Number(data.gid),
        mapeo: data.mapeo && typeof data.mapeo === 'object' ? data.mapeo : {},
        origen: 'db', conectado_por: data.conectado_por, updated_at: data.updated_at,
      },
    }
  }

  // Respaldo: variables de entorno (sirve si la migración todavía no se corrió, o para fijarlo desde Netlify)
  const def = CANALES_FORMULARIO[canal]
  const ref = extraerReferenciaHoja(process.env[def.envId] || '')
  if (ref) {
    return {
      tablaDisponible,
      config: { ...vacia, sheet_id: ref.sheetId, gid: ref.gid, pestana: process.env[def.envPestana]?.trim() || null, mapeo: data?.mapeo || {}, origen: 'env' },
    }
  }
  return { tablaDisponible, config: { ...vacia, mapeo: data?.mapeo && typeof data.mapeo === 'object' ? data.mapeo : {} } }
}

export async function guardarConfigHoja(
  supabase: any, canal: CanalFormulario,
  datos: { sheet_id: string | null; pestana: string | null; gid: number | null; mapeo: Record<string, string> },
  email: string,
) {
  const { error } = await supabase.from('tradecars_formularios_config').upsert({
    canal, sheet_id: datos.sheet_id, pestana: datos.pestana, gid: datos.gid, mapeo: datos.mapeo,
    conectado_por: email, updated_at: new Date().toISOString(),
  }, { onConflict: 'canal' })
  if (error) {
    if (tablaFaltante(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Falta correr sql/tradecars_formularios_sheets.sql en Supabase para poder guardar la conexión.',
      })
    }
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
}

/* ══════════════════════════ Lectura de la hoja (Google Sheets) ══════════════════════════ */

const cacheTitulos = new Map<string, { titulo: string; documento: string | null; vence: number }>()

async function tokenGoogle(): Promise<string> {
  try {
    return await getGoogleAccessToken(EMPRESA_GOOGLE)
  } catch (e: any) {
    const m = String(e?.message || '')
    if (/no encontrado|GOOGLE_CLIENT/i.test(m)) {
      throw new ErrorHoja('sin_google', 'Falta conectar la cuenta de Google que tiene acceso a las hojas de Trade Cars.')
    }
    if (/expirado|invalid_grant/i.test(m)) {
      throw new ErrorHoja('token', 'La conexión con Google venció. Vuelve a conectarla desde "Conectar hoja".')
    }
    throw new ErrorHoja('otro', `No se pudo autenticar con Google: ${m}`)
  }
}

async function pedirGoogle(url: string, token: string): Promise<any> {
  let r: Response
  try {
    r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  } catch (e: any) {
    throw new ErrorHoja('otro', `No se pudo contactar a Google: ${e?.message || e}`)
  }
  if (r.ok) return r.json()

  let detalle = ''
  try { detalle = (await r.json())?.error?.message || '' } catch { /* cuerpo no JSON */ }
  if (r.status === 401) throw new ErrorHoja('token', 'La conexión con Google venció. Vuelve a conectarla desde "Conectar hoja".')
  if (r.status === 403) {
    throw new ErrorHoja('sin_acceso', 'La cuenta de Google conectada no tiene permiso sobre esa hoja. Compártela con esa cuenta (basta como lector).')
  }
  if (r.status === 404) {
    throw new ErrorHoja('no_encontrada', 'No encuentro esa hoja. Revisa el enlace, o que la cuenta de Google conectada tenga acceso.')
  }
  if (r.status === 400 && /parse range|Unable to parse/i.test(detalle)) {
    throw new ErrorHoja('no_encontrada', 'No existe esa pestaña en la hoja. Revisa el nombre de la pestaña.')
  }
  if (r.status === 429) throw new ErrorHoja('otro', 'Google limitó las lecturas por un momento. Reintenta en un minuto.')
  throw new ErrorHoja('otro', `Google respondió ${r.status}${detalle ? `: ${detalle}` : ''}`)
}

export interface HojaLeida {
  titulo_documento: string | null
  pestana: string
  valores: any[][]
}

/**
 * Lee TODA la pestaña, en vivo. Sin caché a propósito: lo que se ve es lo que hay en la hoja
 * en ese momento. Solo se recuerda (10 min) cuál es el nombre de la pestaña cuando se pidió por
 * `gid` o "la primera", porque eso cuesta una llamada extra a Google.
 */
export async function leerHojaGoogle(ref: { sheetId: string; pestana?: string | null; gid?: number | null }): Promise<HojaLeida> {
  const token = await tokenGoogle()
  let pestana = (ref.pestana || '').trim()
  let tituloDoc: string | null = null
  let desdeCache = false

  if (!pestana) {
    const clave = `${ref.sheetId}:${ref.gid ?? 'primera'}`
    const enCache = cacheTitulos.get(clave)
    if (enCache && enCache.vence > Date.now()) {
      pestana = enCache.titulo
      tituloDoc = enCache.documento
      desdeCache = true
    } else {
      const meta = await pedirGoogle(
        `${API_SHEETS}/${encodeURIComponent(ref.sheetId)}?fields=properties.title,sheets.properties(sheetId,title)`, token)
      tituloDoc = meta?.properties?.title || null
      const hojas: any[] = (meta?.sheets || []).map((s: any) => s.properties)
      const elegida = ref.gid !== null && ref.gid !== undefined
        ? hojas.find(h => Number(h.sheetId) === Number(ref.gid))
        : hojas[0]
      if (!elegida) {
        throw new ErrorHoja('no_encontrada', ref.gid !== null && ref.gid !== undefined
          ? 'El enlace apunta a una pestaña que ya no existe en la hoja.'
          : 'La hoja no tiene ninguna pestaña.')
      }
      pestana = String(elegida.title)
      cacheTitulos.set(clave, { titulo: pestana, documento: tituloDoc, vence: Date.now() + 10 * 60_000 })
    }
  }

  // Las comillas simples dentro del nombre de la pestaña se duplican (notación A1)
  const rango = `'${pestana.replace(/'/g, "''")}'`
  let datos: any
  try {
    datos = await pedirGoogle(
      `${API_SHEETS}/${encodeURIComponent(ref.sheetId)}/values/${encodeURIComponent(rango)}`
      + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS', token)
  } catch (e: any) {
    // El nombre venía de la caché y alguien pudo haber renombrado la pestaña: se olvida y se pregunta de nuevo
    if (desdeCache && e instanceof ErrorHoja && e.causa === 'no_encontrada') {
      cacheTitulos.delete(`${ref.sheetId}:${ref.gid ?? 'primera'}`)
      return leerHojaGoogle(ref)
    }
    throw e
  }

  return { titulo_documento: tituloDoc, pestana, valores: Array.isArray(datos?.values) ? datos.values : [] }
}

export const googleConectado = () => hasRefreshToken(EMPRESA_GOOGLE)

/* ══════════════════════════ Estado de cada tarjeta ══════════════════════════ */

export interface EstadoTarjeta {
  lead_key: string
  estado: string | null
  notas: string | null
  precio_ofrecido: number | null
  cliente_id: string | null
  atendido_por: string | null
  atendido_en: string | null
  resumen: Record<string, any> | null
}

/** Trae el estado guardado de todo un canal. Si la tabla no existe todavía, avisa en `disponible`. */
export async function leerEstados(supabase: any, canal: CanalFormulario): Promise<{ estados: Map<string, EstadoTarjeta>; disponible: boolean }> {
  const estados = new Map<string, EstadoTarjeta>()
  const PAGINA = 1000
  for (let desde = 0; desde < 50_000; desde += PAGINA) {
    // `.order('id')`: paginar sin un orden estable puede repetir o saltarse filas
    const { data, error } = await supabase
      .from('tradecars_formularios_estado')
      .select('lead_key, estado, notas, precio_ofrecido, cliente_id, atendido_por, atendido_en, resumen')
      .eq('canal', canal).order('id').range(desde, desde + PAGINA - 1)
    if (error) return { estados, disponible: !tablaFaltante(error) }
    for (const f of data || []) estados.set(f.lead_key, f)
    if (!data || data.length < PAGINA) break
  }
  return { estados, disponible: true }
}

export interface TarjetaFormulario extends LeadFormulario {
  estado: string
  notas: string | null
  precio_ofrecido: number | null
  cliente_id: string | null
  atendido_por: string | null
  atendido_en: string | null
  /** La fila ya no está en la hoja (la borraron), pero la tarjeta tiene trabajo hecho y no se pierde. */
  fuera_de_hoja: boolean
}

/** Junta lo que dice la hoja con lo que el equipo ya hizo sobre cada tarjeta. */
export function fusionarEstados(leads: LeadFormulario[], estados: Map<string, EstadoTarjeta>): TarjetaFormulario[] {
  const enHoja = new Set(leads.map(l => l.lead_key))
  const tarjetas: TarjetaFormulario[] = leads.map((l) => {
    const e = estados.get(l.lead_key)
    return {
      ...l,
      estado: e?.estado || 'nuevo',
      notas: e?.notas ?? null,
      precio_ofrecido: e?.precio_ofrecido === null || e?.precio_ofrecido === undefined ? null : Number(e.precio_ofrecido),
      cliente_id: e?.cliente_id ?? null,
      atendido_por: e?.atendido_por ?? null,
      atendido_en: e?.atendido_en ?? null,
      fuera_de_hoja: false,
    }
  })

  // Tarjetas con trabajo hecho cuya fila desapareció de la hoja: se muestran marcadas.
  for (const [clave, e] of estados) {
    if (enHoja.has(clave)) continue
    const conTrabajo = (e.estado && e.estado !== 'nuevo') || !!e.notas || e.precio_ofrecido !== null || !!e.cliente_id
    if (!conTrabajo) continue
    const r = (e.resumen || {}) as Record<string, any>
    tarjetas.push({
      lead_key: clave, fila: 0, fecha: r.fecha || null,
      nombre: r.nombre || 'Lead que ya no está en la hoja', celular: r.celular || '', correo: r.correo || '',
      marca: r.marca || '', modelo: r.modelo || '', anio: null, placa: r.placa || '', kilometraje: null,
      distrito: '', tiene_deuda: '', mensaje: '', campana: '', lead_id: '', extras: [],
      estado: e.estado || 'nuevo', notas: e.notas ?? null,
      precio_ofrecido: e.precio_ofrecido === null || e.precio_ofrecido === undefined ? null : Number(e.precio_ofrecido),
      cliente_id: e.cliente_id ?? null, atendido_por: e.atendido_por ?? null, atendido_en: e.atendido_en ?? null,
      fuera_de_hoja: true,
    })
  }
  return tarjetas
}

/** Lee la hoja de un canal y la devuelve ya convertida en tarjetas (con su estado). Lo usa el GET. */
export async function leerTarjetas(
  supabase: any, canal: CanalFormulario, config: ConfigHoja, limite: number,
) {
  const hoja = await leerHojaGoogle({ sheetId: config.sheet_id as string, pestana: config.pestana, gid: config.gid })
  const r = hojaALeads(hoja.valores, config.mapeo, canal)
  const { estados, disponible } = await leerEstados(supabase, canal)
  const todas = fusionarEstados(r.leads, estados)
  return {
    hoja: { titulo: hoja.titulo_documento, pestana: hoja.pestana },
    tarjetas: todas.slice(0, limite),
    total: todas.length,
    truncado: todas.length > limite,
    mapeo: r.mapeo,
    sin_mapear: r.sin_mapear,
    filas_omitidas: r.filas_omitidas,
    tabla_estado_disponible: disponible,
  }
}
