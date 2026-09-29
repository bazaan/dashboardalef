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

import { getGoogleAccessToken, hasRefreshToken, type GoogleClientCredentials } from './google-auth'
import { getGoogleServiceAccountToken, emailDeServiceAccount } from './google-service-account'
import { resolverAsesorParaTelefono } from './tradecars-asignacion'
import {
  CANALES_FORMULARIO, canalDePlataforma, extraerReferenciaHoja, hojaALeads,
  type CanalFormulario, type LeadFormulario,
} from '../../utils/tradecarsFormularios'

/**
 * Los 4 canales. `sin_plataforma` va PRIMERO a propósito: si el SQL del 28/09 todavía no se
 * corrió, `guardarConfigHoja()` falla ahí antes de tocar ig/fb/tiktok — un "aplicar a todos" a
 * medio camino no deja 3 canales guardados y uno roto.
 */
export const TODOS_LOS_CANALES: CanalFormulario[] = ['sin_plataforma', 'ig', 'fb', 'tiktok']

export const EMPRESA_GOOGLE = 'tradecars'
const API_SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE_SHEETS_LECTURA = 'https://www.googleapis.com/auth/spreadsheets.readonly'

/**
 * Trade Cars tiene su PROPIO proyecto de Google Cloud (28/09/2026, cuenta aipartnerstudio@gmail.com)
 * — independiente del que comparten Healup y Davila. `TRADECARS_GOOGLE_CLIENT_ID`/`_SECRET` son
 * REQUERIDAS para este canal: sin ellas no hay fallback al client compartido (mezclaría cuentas).
 */
export function credencialesGoogleTradeCars(): GoogleClientCredentials {
  const clientId = process.env.TRADECARS_GOOGLE_CLIENT_ID
  const clientSecret = process.env.TRADECARS_GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new ErrorHoja('sin_google', 'Falta configurar TRADECARS_GOOGLE_CLIENT_ID y TRADECARS_GOOGLE_CLIENT_SECRET en Netlify.')
  }
  return { clientId, clientSecret }
}

/**
 * 29/09/2026: además del OAuth de usuario de arriba, Trade Cars puede leer la hoja con una
 * CUENTA DE SERVICIO (leads-alef-tradecars@tradecars-510019.iam.gserviceaccount.com, compartida
 * como Editor en la hoja de Zapier). Es el método PREFERIDO cuando está configurada — sin login
 * de nadie, sin expirar a los 7 días por el modo "Testing" del proyecto. `tokenGoogle()` la usa
 * primero y solo cae al OAuth de usuario si esta env var no está puesta.
 */
export function tieneServiceAccountGoogle(): boolean {
  return !!process.env.TRADECARS_GOOGLE_SERVICE_ACCOUNT_JSON
}

export function emailServiceAccountGoogle(): string | null {
  const raw = process.env.TRADECARS_GOOGLE_SERVICE_ACCOUNT_JSON
  return raw ? emailDeServiceAccount(raw) : null
}

export type CausaErrorHoja = 'sin_google' | 'token' | 'sin_alcance' | 'sin_acceso' | 'no_encontrada' | 'otro'

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

/** El canal 'sin_plataforma' existe en el código pero todavía no en el CHECK de la base (falta el SQL del 28/09). */
export const restriccionCanalFaltante = (error: any) =>
  !!error && error.code === '23514' && /canal/i.test(String(error.message || ''))

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
    if (restriccionCanalFaltante(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Falta correr sql/tradecars_formularios_plataforma.sql en Supabase para poder usar la pestaña "ZAPPIER (Sin plataforma)".',
      })
    }
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
}

/* ══════════════════════════ Lectura de la hoja (Google Sheets) ══════════════════════════ */

const cacheTitulos = new Map<string, { titulo: string; documento: string | null; vence: number }>()

async function tokenGoogle(): Promise<string> {
  const saJson = process.env.TRADECARS_GOOGLE_SERVICE_ACCOUNT_JSON
  if (saJson) {
    try {
      return await getGoogleServiceAccountToken(saJson, SCOPE_SHEETS_LECTURA)
    } catch (e: any) {
      throw new ErrorHoja('sin_google', `No se pudo autenticar con la cuenta de servicio de Google: ${e?.message || e}`)
    }
  }

  try {
    return await getGoogleAccessToken(EMPRESA_GOOGLE, credencialesGoogleTradeCars())
  } catch (e: any) {
    if (e instanceof ErrorHoja) throw e
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
    // Google devuelve 403 tanto si el archivo no está compartido con la cuenta como si la cuenta SÍ
    // tiene acceso al archivo pero el TOKEN no tiene el permiso de Sheets (por ejemplo, si el consentimiento
    // de Google no llegó a otorgar ese scope). Son arreglos distintos — compartir el archivo no sirve para
    // lo segundo — así que se muestra el motivo real de Google, no una sola frase genérica para las dos cosas.
    if (/insufficient.*(scope|permission)|scope.*insufficient/i.test(detalle)) {
      throw new ErrorHoja('sin_alcance',
        'La conexión con Google no tiene el permiso de Google Sheets (aunque la cuenta sí tenga acceso al archivo). '
        + 'Hay que reconectar Google desde "Conectar hoja" → "Cambiar cuenta", autorizando de nuevo con esa cuenta.')
    }
    throw new ErrorHoja('sin_acceso',
      `La cuenta de Google conectada no tiene permiso sobre esa hoja. Compártela con esa cuenta (basta como lector).`
      + (detalle ? ` [Google dijo: ${detalle}]` : ''))
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

export const googleConectado = async () => tieneServiceAccountGoogle() || (await hasRefreshToken(EMPRESA_GOOGLE))

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
  asesor_nombre: string | null
  asesor_email: string | null
}

/** Trae el estado guardado de todo un canal. Si la tabla no existe todavía, avisa en `disponible`. */
export async function leerEstados(supabase: any, canal: CanalFormulario): Promise<{ estados: Map<string, EstadoTarjeta>; disponible: boolean }> {
  const estados = new Map<string, EstadoTarjeta>()
  const PAGINA = 1000
  for (let desde = 0; desde < 50_000; desde += PAGINA) {
    // `.order('id')`: paginar sin un orden estable puede repetir o saltarse filas
    const { data, error } = await supabase
      .from('tradecars_formularios_estado')
      .select('lead_key, estado, notas, precio_ofrecido, cliente_id, atendido_por, atendido_en, resumen, asesor_nombre, asesor_email')
      .eq('canal', canal).order('id').range(desde, desde + PAGINA - 1)
    if (error) return { estados, disponible: !tablaFaltante(error) }
    for (const f of data || []) estados.set(f.lead_key, f)
    if (!data || data.length < PAGINA) break
  }
  return { estados, disponible: true }
}

/**
 * Asigna asesor a los leads del canal que TODAVÍA no tienen fila en tradecars_formularios_estado
 * (tarjetas genuinamente nuevas) — por continuidad de teléfono o round robin (ver
 * server/utils/tradecars-asignacion.ts). Crea la fila con `estado:'nuevo'` YA con el asesor puesto,
 * para que la asignación quede fija desde la primera vez que se ve la tarjeta (no se vuelve a
 * sortear en la siguiente lectura). Usa `ignoreDuplicates` para que dos lecturas al mismo tiempo
 * nunca creen dos filas para el mismo lead_key.
 */
// Tope de cuántos leads nuevos asigna UNA carga de página (nunca en vivo más que esto — cada
// asignación es un viaje de ida y vuelta a la base). En operación normal entran unos pocos leads
// nuevos por vez, así que esto rara vez se topa; si algún día se acumula un backlog grande (ej.
// la primera vez que corre esta función, o si alguien pega cientos de filas nuevas en la hoja de
// una sola vez), el resto queda pendiente para la SIGUIENTE carga en vez de colgar la petición.
// Un backlog grande de una sola vez se resuelve con POST /api/tradecars/formularios
// { accion:'asignar_pendientes' } (server/utils/tradecars-asignacion-backfill.ts), que sí procesa
// en lote de verdad.
const LIMITE_ASIGNACION_EN_VIVO = 25

async function asignarNuevosLeads(
  supabase: any, canal: CanalFormulario, leads: LeadFormulario[], estados: Map<string, EstadoTarjeta>,
): Promise<void> {
  const nuevos = leads.filter(l => !estados.has(l.lead_key)).slice(0, LIMITE_ASIGNACION_EN_VIVO)
  if (!nuevos.length) return

  const filas: any[] = []
  for (const l of nuevos) {
    const asesor = await resolverAsesorParaTelefono(supabase, l.celular)
    const fila: EstadoTarjeta & { canal: string; resumen: Record<string, any> } = {
      lead_key: l.lead_key, estado: 'nuevo', notas: null, precio_ofrecido: null, cliente_id: null,
      atendido_por: null, atendido_en: null,
      resumen: { fecha: l.fecha, nombre: l.nombre, celular: l.celular, correo: l.correo, marca: l.marca, modelo: l.modelo, placa: l.placa },
      asesor_nombre: asesor?.asesor_nombre ?? null, asesor_email: asesor?.asesor_email ?? null,
    }
    filas.push({ canal, ...fila })
    // Se refleja en el mapa en memoria ya mismo, para que fusionarEstados() de esta misma
    // lectura muestre el asesor sin esperar a la siguiente consulta.
    estados.set(l.lead_key, fila)
  }

  try {
    await supabase.from('tradecars_formularios_estado')
      .upsert(filas, { onConflict: 'canal,lead_key', ignoreDuplicates: true })
  } catch {
    // Si falla el guardado, la tarjeta igual muestra el asesor resuelto recién (en memoria) —
    // en la próxima lectura se vuelve a intentar guardar.
  }
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
  asesor_nombre: string | null
  asesor_email: string | null
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
      asesor_nombre: e?.asesor_nombre ?? null,
      asesor_email: e?.asesor_email ?? null,
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
      asesor_nombre: e.asesor_nombre ?? null, asesor_email: e.asesor_email ?? null,
    })
  }
  return tarjetas
}

/** Cuenta cuántos leads de una hoja ya leída caen en cada uno de los 4 canales. */
function distribuirPorPlataforma(leads: LeadFormulario[]): Record<CanalFormulario, number> {
  const dist: Record<CanalFormulario, number> = { ig: 0, fb: 0, tiktok: 0, sin_plataforma: 0 }
  for (const l of leads) dist[canalDePlataforma(l.plataforma) || 'sin_plataforma']++
  return dist
}

/**
 * Lee la hoja de un canal y la devuelve ya convertida en tarjetas (con su estado). Lo usa el GET.
 *
 * 28/09/2026: Trade Cars no tiene una hoja por red — tiene UNA hoja de Zapier con todas las redes
 * juntas y una columna PLATAFORMA. Por eso IG, FB, TikTok y "Sin plataforma" pueden compartir el
 * MISMO `config.sheet_id` (ver `aplicar_a_todos` en el endpoint POST): acá es donde se separa una
 * lectura completa de la hoja en lo que le toca a CADA canal, según `canalDePlataforma()`.
 */
export async function leerTarjetas(
  supabase: any, canal: CanalFormulario, config: ConfigHoja, limite: number,
  /**
   * Filtrado ANTES del recorte por `limite`, para no perder tarjetas propias que hubieran
   * quedado más allá del límite en la lista sin filtrar. Tres estados, no dos:
   *  - `undefined` → sin filtro (admin: ve todas).
   *  - string → solo las de ESE asesor.
   *  - `null` → la sesión no es admin y tampoco está registrada como asesor: no debe ver
   *    NINGUNA tarjeta (default-deny), a diferencia de antes del 29/09/2026 donde esto
   *    tampoco filtraba nada y terminaba mostrando todo.
   */
  filtroAsesorEmail?: string | null,
) {
  const hoja = await leerHojaGoogle({ sheetId: config.sheet_id as string, pestana: config.pestana, gid: config.gid })
  const r = hojaALeads(hoja.valores, config.mapeo, canal)

  const distribucion = distribuirPorPlataforma(r.leads)
  const delCanal = r.leads.filter(l => (canalDePlataforma(l.plataforma) || 'sin_plataforma') === canal)

  const { estados, disponible } = await leerEstados(supabase, canal)
  if (disponible) await asignarNuevosLeads(supabase, canal, delCanal, estados)
  let todas = fusionarEstados(delCanal, estados)
  if (filtroAsesorEmail !== undefined) {
    const email = (filtroAsesorEmail || '').toLowerCase()
    todas = todas.filter(t => !!email && t.asesor_email && t.asesor_email.toLowerCase() === email)
  }
  return {
    hoja: { titulo: hoja.titulo_documento, pestana: hoja.pestana },
    tarjetas: todas.slice(0, limite),
    total: todas.length,
    truncado: todas.length > limite,
    mapeo: r.mapeo,
    sin_mapear: r.sin_mapear,
    filas_omitidas: r.filas_omitidas,
    tabla_estado_disponible: disponible,
    // Cuántos leads hay en TOTAL en esta hoja y cómo se reparten entre los 4 canales — para que la
    // pantalla pueda avisar "hay 40 leads en la hoja, todos sin plataforma todavía" aunque este
    // canal en particular muestre 0.
    total_en_hoja: r.leads.length,
    distribucion_plataforma: distribucion,
  }
}
