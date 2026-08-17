/**
 * POST /api/retell/gatwick-emergencia
 *
 * Tool de la LLAMADA (Retell). Se ejecuta cuando el bot YA CONFIRMÓ que hay una
 * emergencia real y tiene los datos. Hace exactamente lo mismo que el flujo de
 * WhatsApp, pero con la información que llegó por teléfono:
 *
 *   1. Resuelve el edificio a partir del código del sticker (fuente de verdad:
 *      gatwick_edificios). Si el código no existe, usa lo que dictó el cliente.
 *   2. Geocodifica la dirección para que el mapa del seguimiento ya tenga destino.
 *   3. Crea la emergencia en `gatwick_emergencias` → aparece SOLA en el monitor
 *      del dashboard (la vista escucha postgres_changes en esa tabla).
 *   4. Avisa a los supervisores por WhatsApp (Chatwoot), mismos destinos que ya
 *      usa el seguimiento GPS.
 *   5. Deja el log en agent_tool_logs → Dev · Agent Logs → Gatwick.
 *
 * NO inicia el seguimiento GPS: eso lo dispara el técnico con "Comenzar" en el
 * monitor, que es cuando realmente sale. Crear el tracking aquí mostraría a un
 * técnico parado en el taller como si estuviera en ruta.
 *
 * Auth: header x-api-key: retell-gatwick-2026 (o ?api_key= / body.api_key).
 *
 * Respuesta (siempre 200 — un error HTTP cortaría la llamada):
 * { ok, emergencia_id, edificio, direccion, distrito, confirmacion, aviso }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  resolverCodigoAscensor, normalizarCodigoAscensor, geocodificar,
  avisarSupervisores, mensajeEmergenciaLlamada, baseUrl,
} from '../../utils/gatwick-tracking'

const API_KEY = 'retell-gatwick-2026'

/** Ventana en la que dos llamadas a la tool desde la MISMA llamada se consideran la misma emergencia. */
const DEDUP_MIN = 60

function limpiar(v: any): string {
  const s = String(v ?? '').trim()
  return (!s || /^(null|undefined|n\/a|no s[ée]|ninguno)$/i.test(s)) ? '' : s
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({} as any))
  const q = getQuery(event) as any

  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || q?.api_key || body?.api_key
  if (key !== API_KEY) throw createError({ statusCode: 401, statusMessage: 'API key invalida' })

  const args = body?.args ?? body ?? {}
  const call = body?.call ?? {}

  // ── Datos que llena el agente durante la llamada ──
  const codigoBruto   = limpiar(args.codigo_ascensor ?? args.codigo)
  const tipoAtrapado  = (limpiar(args.tipo_atrapado) || 'persona').toLowerCase()
  const cantidad      = Number(args.cantidad_atrapados ?? args.personas_atrapadas ?? 0) || null
  const descripcion   = limpiar(args.descripcion ?? args.detalle)
  const piso          = limpiar(args.piso)
  const contacto      = limpiar(args.contacto_nombre ?? args.nombre_contacto)
  const telSeguimiento = limpiar(args.telefono_seguimiento ?? args.telefono_whatsapp)
  const critico       = args.critico === true || args.critico === 'true' || /fuego|humo|sangre|desmay|respir|agua/i.test(descripcion)
  const callId        = limpiar(call.call_id ?? args.call_id)
  const fromNumber    = limpiar(call.from_number ?? args.sesion_id ?? args.from_number)
  // Fallback: lo que dictó el cliente cuando no hay código válido
  const fbEdificio    = limpiar(args.edificio_nombre ?? args.edificio)
  const fbDireccion   = limpiar(args.direccion)
  const fbDistrito    = limpiar(args.distrito)
  const fbZona        = limpiar(args.zona_equipo ?? args.zona)

  const log = async (status: string, output: any, error?: string) => {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'gatwick', tool_name: 'Emergencia por Llamada',
        input_data: {
          call_id: callId || null, telefono_origen: fromNumber || null,
          codigo_dictado: codigoBruto || null, tipo_atrapado: tipoAtrapado,
          cantidad_atrapados: cantidad, piso: piso || null, critico,
          contacto: contacto || null, telefono_seguimiento: telSeguimiento || null,
          descripcion: descripcion || null,
          fallback: (fbEdificio || fbDireccion || fbDistrito || fbZona)
            ? { edificio: fbEdificio, direccion: fbDireccion, distrito: fbDistrito, zona: fbZona } : null,
        },
        output_data: output, status, error_message: error ?? null,
      })
    } catch { /* el log nunca debe tumbar la llamada */ }
  }

  try {
    // ── 1. Anti-duplicado: la misma llamada no debe crear dos emergencias ──
    if (callId) {
      const desde = new Date(Date.now() - DEDUP_MIN * 60 * 1000).toISOString()
      const { data: previa } = await (supabase.from('gatwick_emergencias') as any)
        .select('id, edificio_nombre, direccion, distrito, codigo_ascensor')
        .eq('call_id', callId).gte('created_at', desde)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (previa) {
        const r = {
          ok: true, ya_registrada: true, emergencia_id: previa.id,
          edificio: previa.edificio_nombre ?? '', direccion: previa.direccion ?? '',
          distrito: previa.distrito ?? '',
          confirmacion: 'La emergencia ya está registrada y el equipo fue notificado.',
        }
        await log('success', r)
        return r
      }
    }

    // ── 2. Edificio: el catálogo manda sobre lo que se dictó por teléfono ──
    const codigoNorm = codigoBruto ? normalizarCodigoAscensor(codigoBruto) : null
    const hit = codigoNorm ? await resolverCodigoAscensor(supabase, codigoNorm) : null
    const ed = hit?.edificio ?? null

    const edificioNombre = ed?.nombre || fbEdificio || ''
    const direccion      = ed?.direccion || fbDireccion || ''
    const distrito       = ed?.distrito || fbDistrito || ''
    const codigoNoEncontrado = !!codigoNorm && !hit

    // ── 3. Destino en el mapa (best-effort: sin coordenadas igual se despacha) ──
    let destinoLat: number | null = null, destinoLng: number | null = null
    if (direccion) {
      const geo = await geocodificar(direccion, distrito || undefined)
      if (geo) { destinoLat = geo.lat; destinoLng = geo.lng }
    }

    // ── 4. Crear la emergencia ──
    const queAtrapado = tipoAtrapado.startsWith('veh') ? 'vehículo'
      : tipoAtrapado.startsWith('masc') ? 'mascota' : 'persona'
    const titulo = `${cantidad && cantidad > 1 ? `${cantidad} ${queAtrapado}s` : queAtrapado} atrapad${queAtrapado === 'persona' || queAtrapado === 'mascota' ? 'a' : 'o'}`
      + (hit ? ` — ${hit.codigo}` : '')

    const detalle = [
      descripcion,
      fbZona && !hit ? `Zona indicada por el cliente: ${fbZona}.` : '',
      codigoNoEncontrado ? `El cliente dictó el código ${codigoNorm}, que no está en el catálogo de edificios.` : '',
      contacto ? `Reporta: ${contacto}.` : '',
      `Reportada por llamada${fromNumber ? ` desde ${fromNumber}` : ''}.`,
    ].filter(Boolean).join(' ')

    const fila: Record<string, any> = {
      titulo,
      descripcion: detalle,
      direccion: direccion || null,
      distrito: distrito || null,
      empresa_cliente: edificioNombre || null,
      edificio_nombre: edificioNombre || null,
      edificio_id: ed?.id ?? null,
      elme: ed?.elme ?? null,
      codigo_ascensor: hit?.codigo ?? codigoNorm ?? null,
      tipo_equipo: hit?.tipo_equipo ?? null,
      piso: piso || null,
      telefono_contacto: telSeguimiento || fromNumber || null,
      prioridad: (critico || queAtrapado === 'persona') ? 'critica' : 'alta',
      estado: 'pendiente',
      destino_lat: destinoLat, destino_lng: destinoLng,
      // Trazabilidad del origen (columnas nuevas — ver sql/gatwick_retell_emergencia.sql)
      origen: 'llamada',
      call_id: callId || null,
      telefono_origen: fromNumber || null,
      contacto_nombre: contacto || null,
      tipo_atrapado: queAtrapado,
      cantidad_atrapados: cantidad,
      critico,
    }

    let emerg: any = null
    const ins = await (supabase.from('gatwick_emergencias') as any).insert(fila).select('*').single()
    if (ins.error) {
      // Tolerante: si las columnas de trazabilidad aún no existen en Supabase,
      // se guarda igual la emergencia con los campos base (no perder el aviso).
      const { origen, call_id, telefono_origen, contacto_nombre, tipo_atrapado, cantidad_atrapados, critico: _c, ...base } = fila
      const retry = await (supabase.from('gatwick_emergencias') as any).insert(base).select('*').single()
      if (retry.error) throw retry.error
      emerg = retry.data
      console.warn('[retell/gatwick-emergencia] columnas de trazabilidad ausentes, guardado sin ellas:', ins.error.message)
    } else {
      emerg = ins.data
    }

    // ── 5. Avisar a los supervisores (mismos destinos que el seguimiento) ──
    const atrapadosTxt = cantidad ? `${cantidad} ${queAtrapado}${cantidad > 1 ? 's' : ''}` : queAtrapado
    const mensaje = mensajeEmergenciaLlamada(emerg, {
      telefonoSeguimiento: telSeguimiento || null,
      contactoNombre: contacto || null,
      atrapados: atrapadosTxt,
      critico,
      codigoNoEncontrado,
      linkMonitor: `${baseUrl(event)}/pruebas/Gatwick`,
    })
    const aviso = await avisarSupervisores(supabase, mensaje, 'emergencia')

    const confirmacion = hit
      ? `Listo. Ya reporté la emergencia en ${edificioNombre}. El equipo fue notificado y el técnico rescatista sale en breve.`
      : `Listo. Ya reporté la emergencia. El equipo fue notificado y el técnico rescatista sale en breve.`

    const salida = {
      ok: true, emergencia_id: emerg.id,
      edificio: edificioNombre, direccion, distrito,
      codigo: emerg.codigo_ascensor ?? '',
      codigo_no_encontrado: codigoNoEncontrado,
      destino_ubicado: destinoLat != null,
      supervisores_avisados: aviso.enviados, supervisores_fallidos: aviso.fallidos,
      confirmacion,
    }
    await log(aviso.fallidos ? 'warning' : 'success', salida)
    console.log(`[retell/gatwick-emergencia] #${emerg.id} ${emerg.codigo_ascensor ?? '-'} ${edificioNombre} | avisos ${aviso.enviados}/${aviso.enviados + aviso.fallidos}`)
    return salida

  } catch (e: any) {
    // Nunca se devuelve error HTTP: si Retell recibe un 500 corta la llamada y
    // el cliente se queda sin atención. Se avisa por texto y queda en los logs.
    const r = {
      ok: false, error: e?.message ?? 'error',
      confirmacion: 'Registré su reporte y lo estoy escalando manualmente con la central. No cuelgue, por favor.',
    }
    await log('error', r, e?.message)
    console.error('[retell/gatwick-emergencia] ERROR:', e?.message)
    return r
  }
})
