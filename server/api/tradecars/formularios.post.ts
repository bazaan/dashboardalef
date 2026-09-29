/**
 * POST /api/tradecars/formularios — escribe lo que el equipo hace con las tarjetas de IG/FB/TikTok
 * y administra la conexión de las hojas.
 *
 *   { accion: 'guardar',    canal, lead_key, estado?, notas?, precio_ofrecido?, cliente_id?, resumen? }
 *        → estado/notas/precio de UNA tarjeta. Exige poder EDITAR el módulo Comercial.
 *   { accion: 'probar',     canal, url, pestana?, mapeo? }
 *        → lee la hoja SIN guardar nada y devuelve las columnas y las primeras filas. Solo Administrador.
 *   { accion: 'configurar', canal, url, pestana?, mapeo?, aplicar_a_todos? }
 *        → guarda qué hoja es la de ese canal (y, si Google ya está conectado, la prueba). Solo Administrador.
 *        `aplicar_a_todos: true` guarda la MISMA hoja en los 4 canales (ig/fb/tiktok/sin_plataforma):
 *        es el caso real de Trade Cars, que trae todas las redes juntas en una sola hoja de Zapier
 *        con una columna PLATAFORMA — conectarla una vez alcanza, y `canalDePlataforma()` reparte
 *        cada lead a su pestaña sola.
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
  ErrorHoja, googleConectado, guardarConfigHoja, leerConfigHoja, leerHojaGoogle, restriccionCanalFaltante, TODOS_LOS_CANALES,
} from '../../utils/tradecars-formularios'
import { obtenerAsesorDeSesion } from '../../utils/tradecars-asignacion'
import { asignarPendientesCanal, asignarPendientesSolicitudesWeb } from '../../utils/tradecars-asignacion-backfill'
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

  /* ══════════ Asignación masiva del backlog (Administrador) ══════════
   * { accion:'asignar_pendientes', canal?, maximo? }
   *   - sin `canal`: procesa los 4 canales + Formularios web (sirve para backlogs chicos)
   *   - con `canal` ('ig'|'fb'|'tiktok'|'sin_plataforma'|'web'): procesa SOLO ese uno
   *   - `maximo`: tope de leads a procesar EN ESTA llamada (para backlogs grandes, ej.
   *     "sin_plataforma" con miles — probado en vivo: sin tope, una sola llamada corta a los
   *     ~30s con 502 de Netlify). La respuesta trae `total_pendientes` con lo que queda: quien
   *     llama repite hasta que dé 0.
   */
  if (accion === 'asignar_pendientes') {
    exigirAdminTradeCars(perfil, 'la asignación masiva de asesores')
    const canalPedido = String(body?.canal || '')
    const maximo = body?.maximo ? Number(body.maximo) : undefined

    if (canalPedido === 'web') {
      const web = await asignarPendientesSolicitudesWeb(supabase)
      return { ok: true, formularios_web: web }
    }
    if (esCanalFormulario(canalPedido)) {
      const { config } = await leerConfigHoja(supabase, canalPedido)
      const resultado = await asignarPendientesCanal(supabase, canalPedido, config, maximo)
      return { ok: true, canal: canalPedido, ...resultado }
    }

    const resultadoPorCanal: Record<string, any> = {}
    for (const c of TODOS_LOS_CANALES) {
      const { config } = await leerConfigHoja(supabase, c)
      try {
        resultadoPorCanal[c] = await asignarPendientesCanal(supabase, c, config, maximo)
      } catch (e: any) {
        resultadoPorCanal[c] = { ok: false, asignados: 0, total_pendientes: 0, motivo: e?.message || 'error' }
      }
    }
    const web = await asignarPendientesSolicitudesWeb(supabase)
    return { ok: true, canales: resultadoPorCanal, formularios_web: web }
  }

  const canal = String(body?.canal || '')
  if (!esCanalFormulario(canal)) {
    throw createError({ statusCode: 400, statusMessage: 'Canal desconocido: usa ig, fb, tiktok o sin_plataforma' })
  }

  /* ══════════ Guardar el trabajo sobre una tarjeta ══════════ */
  if (accion === 'guardar') {
    exigirModuloTradeCars(perfil, 'comercial', 'edit')

    const leadKey = txt(body?.lead_key, 300)
    if (!leadKey) throw createError({ statusCode: 400, statusMessage: 'Falta el lead a guardar' })

    // Un asesor (no admin) solo puede tocar SUS propias tarjetas — se re-verifica en el servidor,
    // no alcanza con que la pantalla solo le muestre las suyas.
    if (!perfil.esAdmin) {
      const miAsesor = await obtenerAsesorDeSesion(supabase, perfil.email)
      if (miAsesor) {
        const { data: actual } = await supabase
          .from('tradecars_formularios_estado')
          .select('asesor_email').eq('canal', canal).eq('lead_key', leadKey).maybeSingle()
        if (actual?.asesor_email && actual.asesor_email.toLowerCase() !== miAsesor.asesor_email.toLowerCase()) {
          throw createError({ statusCode: 403, statusMessage: 'Esta tarjeta está asignada a otro asesor.' })
        }
      }
    }

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
      if (restriccionCanalFaltante(error)) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Falta correr sql/tradecars_formularios_plataforma.sql en Supabase para poder usar la pestaña "ZAPPIER (Sin plataforma)".',
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

    // El caso real: es la MISMA hoja de Zapier para las 4 pestañas, así que se guarda una vez y
    // listo — no hace falta repetir "Conectar hoja" 4 veces con el mismo enlace.
    const canales = body?.aplicar_a_todos === true ? TODOS_LOS_CANALES : [canal]
    for (const c of canales) {
      await guardarConfigHoja(supabase, c, { sheet_id: ref.sheetId, pestana, gid: ref.gid, mapeo }, perfil.email)
    }
    return { ok: true, guardado: true, prueba, canales_conectados: canales }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
