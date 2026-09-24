/**
 * POST /api/tradecars/formularios — escribe lo que el equipo hace con las tarjetas de IG/FB/TikTok
 * y administra la conexión de las hojas.
 *
 *   { accion: 'guardar',    canal, lead_key, estado?, notas?, precio_ofrecido?, cliente_id?, resumen? }
 *        → estado/notas/precio de UNA tarjeta. Exige poder EDITAR el módulo Comercial.
 *   { accion: 'probar',     canal, url, pestana?, mapeo? }
 *        → lee la hoja SIN guardar nada y devuelve las columnas y las primeras filas. Solo Administrador.
 *   { accion: 'configurar', canal, url, pestana?, mapeo? }
 *        → guarda qué hoja es la de ese canal (y, si Google ya está conectado, la prueba). Solo Administrador.
 *   { accion: 'quitar',     canal }
 *        → desconecta la hoja de ese canal. Solo Administrador.
 *
 * La hoja se lee, nunca se escribe: por eso el estado de cada tarjeta vive en Supabase
 * (`tradecars_formularios_estado`), no en la hoja.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  resolverPerfilTradeCars, exigirModuloTradeCars, exigirAdminTradeCars,
} from '../../utils/tradecars'
import {
  ErrorHoja, googleConectado, guardarConfigHoja, leerHojaGoogle,
} from '../../utils/tradecars-formularios'
import {
  CAMPOS_FORMULARIO, ESTADOS_FORMULARIO, esCanalFormulario, extraerReferenciaHoja, hojaALeads,
} from '../../../utils/tradecarsFormularios'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txt = (v: any, max: number): string | null => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s ? s.slice(0, max) : null
}

/** Solo campos conocidos y texto corto: lo que llega del navegador nunca se guarda tal cual. */
function limpiarMapeo(entrada: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!entrada || typeof entrada !== 'object') return out
  for (const campo of CAMPOS_FORMULARIO) {
    if (!(campo in entrada)) continue
    out[campo] = String(entrada[campo] ?? '').trim().slice(0, 200)
  }
  return out
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  const body = await readBody(event)
  const accion = String(body?.accion || '')

  const canal = String(body?.canal || '')
  if (!esCanalFormulario(canal)) {
    throw createError({ statusCode: 400, statusMessage: 'Canal desconocido: usa ig, fb o tiktok' })
  }

  /* ══════════ Guardar el trabajo sobre una tarjeta ══════════ */
  if (accion === 'guardar') {
    exigirModuloTradeCars(perfil, 'comercial', 'edit')

    const leadKey = txt(body?.lead_key, 300)
    if (!leadKey) throw createError({ statusCode: 400, statusMessage: 'Falta el lead a guardar' })

    const fila: Record<string, any> = {
      canal,
      lead_key: leadKey,
      updated_at: new Date().toISOString(),
      // Quién lo atendió lo pone el servidor, no el navegador
      atendido_por: perfil.colaborador?.nombre || perfil.email,
      atendido_en: new Date().toISOString(),
    }
    if ('estado' in body) {
      const estado = String(body.estado || '').trim()
      if (!ESTADOS_FORMULARIO.includes(estado)) {
        throw createError({ statusCode: 400, statusMessage: `Estado no válido. Usa: ${ESTADOS_FORMULARIO.join(', ')}` })
      }
      fila.estado = estado
    }
    if ('notas' in body) fila.notas = txt(body.notas, 4000)
    if ('precio_ofrecido' in body) {
      const n = body.precio_ofrecido === null || body.precio_ofrecido === '' ? null : Number(body.precio_ofrecido)
      if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100_000_000)) {
        throw createError({ statusCode: 400, statusMessage: 'El precio ofrecido no es válido' })
      }
      fila.precio_ofrecido = n
    }
    if ('cliente_id' in body) {
      const c = txt(body.cliente_id, 60)
      if (c && !UUID.test(c)) throw createError({ statusCode: 400, statusMessage: 'El cliente no es válido' })
      fila.cliente_id = c
    }
    // Copia mínima para poder seguir mostrando la tarjeta si la fila desaparece de la hoja
    if (body?.resumen && typeof body.resumen === 'object') {
      fila.resumen = {
        nombre: txt(body.resumen.nombre, 200), celular: txt(body.resumen.celular, 40), correo: txt(body.resumen.correo, 200),
        fecha: txt(body.resumen.fecha, 40), marca: txt(body.resumen.marca, 80), modelo: txt(body.resumen.modelo, 80),
        placa: txt(body.resumen.placa, 20),
      }
    }

    const { data, error } = await supabase
      .from('tradecars_formularios_estado')
      .upsert(fila, { onConflict: 'canal,lead_key' })
      .select('lead_key, estado, notas, precio_ofrecido, cliente_id, atendido_por, atendido_en').single()
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Falta correr sql/tradecars_formularios_sheets.sql en Supabase para poder guardar el estado de las tarjetas.',
        })
      }
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    return { ok: true, tarjeta: data }
  }

  /* ══════════ Conexión de hojas: solo Administrador ══════════ */
  exigirAdminTradeCars(perfil, 'la conexión de las hojas de formularios')

  if (accion === 'quitar') {
    await guardarConfigHoja(supabase, canal, { sheet_id: null, pestana: null, gid: null, mapeo: {} }, perfil.email)
    return { ok: true }
  }

  if (accion === 'probar' || accion === 'configurar') {
    const ref = extraerReferenciaHoja(String(body?.url || ''))
    if (!ref) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No reconozco ese enlace. Copia la dirección completa de la hoja (docs.google.com/spreadsheets/d/…) o solo su ID.',
      })
    }
    const pestana = txt(body?.pestana, 120)
    const mapeo = limpiarMapeo(body?.mapeo)
    const conectado = await googleConectado()

    // Se prueba la lectura antes de guardar. Si Google todavía no está conectado se guarda igual:
    // el administrador puede dejar lista la hoja hoy y conectar la cuenta después.
    let prueba: Record<string, any> = { ok: false, causa: 'sin_google', mensaje: 'Google todavía no está conectado: la hoja quedó guardada y se leerá apenas lo conectes.' }
    if (conectado) {
      try {
        const hoja = await leerHojaGoogle({ sheetId: ref.sheetId, pestana, gid: ref.gid })
        const r = hojaALeads(hoja.valores, mapeo, canal)
        // Encabezados tal cual, para que la pantalla ofrezca corregir el mapeo
        const filaEnc = hoja.valores.findIndex(f => (f || []).filter((c: any) => String(c ?? '').trim() !== '').length >= 2)
        const encabezados = ((hoja.valores[Math.max(0, filaEnc)] as any[]) || []).map(c => String(c ?? '').trim()).filter(Boolean)
        prueba = {
          ok: true,
          hoja: { titulo: hoja.titulo_documento, pestana: hoja.pestana },
          encabezados,
          mapeo: r.mapeo,
          sin_mapear: r.sin_mapear,
          total_filas: r.total_filas,
          muestra: r.leads.slice(0, 3),
        }
      } catch (e: any) {
        if (!(e instanceof ErrorHoja)) throw e
        prueba = { ok: false, causa: e.causa, mensaje: e.message }
      }
    }

    if (accion === 'probar') return { ok: true, prueba }

    await guardarConfigHoja(supabase, canal, { sheet_id: ref.sheetId, pestana, gid: ref.gid, mapeo }, perfil.email)
    return { ok: true, guardado: true, prueba }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
