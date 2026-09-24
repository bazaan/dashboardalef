/**
 * GET /api/tradecars/formularios?canal=ig|fb|tiktok[&limite=1500]
 *
 * Lee EN VIVO la hoja de Google del canal y devuelve las tarjetas con su estado. El dashboard lo
 * llama cada vez que se abre el submódulo (y al tocar "Actualizar"), así que lo que se ve es lo
 * que hay en la hoja en ese momento: no hay copia ni caché.
 *
 * Nunca devuelve un error HTTP por un problema de conexión con la hoja (no configurada, Google sin
 * conectar, sin acceso, pestaña inexistente…): responde 200 con `error: { causa, mensaje }` para que
 * la pantalla lo explique y diga cómo arreglarlo. Solo la sesión o el permiso fallan con 401/403.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import {
  ErrorHoja, googleConectado, leerConfigHoja, leerTarjetas,
} from '../../utils/tradecars-formularios'
import { CANALES_FORMULARIO, esCanalFormulario } from '../../../utils/tradecarsFormularios'

const LIMITE_POR_DEFECTO = 1500
const LIMITE_MAXIMO = 5000

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'comercial', 'view')

  const q = getQuery(event)
  const canal = String(q.canal || '')
  if (!esCanalFormulario(canal)) {
    throw createError({ statusCode: 400, statusMessage: 'Canal desconocido: usa ig, fb o tiktok' })
  }
  const limite = Math.min(LIMITE_MAXIMO, Math.max(50, Number(q.limite) || LIMITE_POR_DEFECTO))

  // Lo que se ve es lo que hay AHORA en la hoja: que ningún proxy ni el navegador lo guarde
  setHeader(event, 'Cache-Control', 'no-store')

  const { config, tablaDisponible } = await leerConfigHoja(supabase, canal)
  const conectado = await googleConectado()

  const base = {
    ok: true,
    canal,
    etiqueta: CANALES_FORMULARIO[canal].etiqueta,
    configurado: !!config.sheet_id,
    google_conectado: conectado,
    tabla_configuracion_disponible: tablaDisponible,
    es_admin: perfil.esAdmin,
    puede_editar: perfil.esAdmin || perfil.permisos?.comercial?.can_edit === true,
    origen_config: config.origen,
    // Qué hoja está conectada: solo para el administrador (el ID no abre nada sin acceso, pero no hace falta mostrarlo a todos)
    conexion: perfil.esAdmin && config.sheet_id
      ? {
        sheet_id: config.sheet_id, pestana: config.pestana, gid: config.gid,
        url: `https://docs.google.com/spreadsheets/d/${config.sheet_id}${config.gid !== null ? `/edit#gid=${config.gid}` : ''}`,
        // Correcciones de columnas guardadas antes: la ventana las conserva al guardar de nuevo
        mapeo_guardado: config.mapeo,
      }
      : null,
    actualizado_en: new Date().toISOString(),
    tarjetas: [] as any[],
    total: 0,
    truncado: false,
    hoja: null as null | { titulo: string | null; pestana: string },
    mapeo: {} as Record<string, string>,
    sin_mapear: [] as string[],
    filas_omitidas: 0,
    tabla_estado_disponible: true,
    error: null as null | { causa: string; mensaje: string },
  }

  if (!config.sheet_id) return base
  if (!conectado) {
    return { ...base, error: { causa: 'sin_google', mensaje: 'Falta conectar la cuenta de Google que tiene acceso a las hojas de Trade Cars.' } }
  }

  try {
    const r = await leerTarjetas(supabase, canal, config, limite)
    return { ...base, ...r, actualizado_en: new Date().toISOString() }
  } catch (e: any) {
    if (e instanceof ErrorHoja) return { ...base, error: { causa: e.causa, mensaje: e.message } }
    throw e
  }
})
