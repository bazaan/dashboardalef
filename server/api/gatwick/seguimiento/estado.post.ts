/**
 * POST /api/gatwick/seguimiento/estado
 *
 * Avanza el seguimiento por su máquina de estados y avisa a los supervisores:
 *
 *   iniciado ──▶ en_camino ──▶ atendiendo ──▶ finalizada
 *      └──────────────────────────────────▶ cancelada
 *
 * Reglas (se validan EN EL SERVIDOR, no solo en el front):
 *   · Solo se puede avanzar al estado siguiente, nunca saltar ni retroceder.
 *   · "atendiendo" exige que el GPS ubique al técnico DENTRO del geofence del
 *     edificio (200 m). Si el destino no pudo geocodificarse, se permite igual
 *     (no vamos a bloquear una emergencia real por un problema de mapa).
 *   · "finalizada" cierra el seguimiento: el GPS deja de aceptarse (privacidad).
 *
 * Auth: token del seguimiento.
 * Body: { token, estado, lat?, lng?, notas?, eta_segundos? }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { avisarSupervisores, mensajeParaEstado, distanciaM, GEOFENCE_M, baseUrl } from '../../../utils/gatwick-tracking'

const SIGUIENTE: Record<string, string[]> = {
  iniciado:   ['en_camino', 'cancelada'],
  en_camino:  ['atendiendo', 'cancelada'],
  atendiendo: ['finalizada'],
  finalizada: [],
  cancelada:  [],
}

const SELLO: Record<string, string> = {
  en_camino: 'en_camino_en',
  atendiendo: 'atendiendo_en',
  finalizada: 'finalizada_en',
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const token = String(body?.token || '').trim()
  const nuevo = String(body?.estado || '').trim()
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Falta token' })

  const { data: seg } = await (supabase.from('gatwick_seguimientos') as any)
    .select('*').eq('token', token).maybeSingle()
  if (!seg) throw createError({ statusCode: 404, statusMessage: 'Seguimiento no encontrado' })

  const permitidos = SIGUIENTE[seg.estado] ?? []
  if (!permitidos.includes(nuevo)) {
    throw createError({
      statusCode: 400,
      statusMessage: `No se puede pasar de "${seg.estado}" a "${nuevo}". Permitido: ${permitidos.join(', ') || 'ninguno (ya cerrado)'}`,
    })
  }

  // ── Geofence para "atendiendo": debe estar en el edificio ──
  let dist: number | null = seg.distancia_destino_m ?? null
  const lat = Number(body?.lat), lng = Number(body?.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && seg.destino_lat != null && seg.destino_lng != null) {
    dist = distanciaM(lat, lng, Number(seg.destino_lat), Number(seg.destino_lng))
  }
  if (nuevo === 'atendiendo' && seg.destino_lat != null) {
    if (dist == null) {
      throw createError({ statusCode: 400, statusMessage: 'Aún no recibimos tu ubicación. Activa el GPS y espera unos segundos.' })
    }
    if (dist > GEOFENCE_M) {
      throw createError({
        statusCode: 400,
        statusMessage: `Todavía estás a ${(dist / 1000).toFixed(1)} km del edificio. Podrás marcar "Atendiendo" al llegar (menos de ${GEOFENCE_M} m).`,
      })
    }
  }

  // ── Persistir ──
  const patch: Record<string, any> = { estado: nuevo }
  if (SELLO[nuevo]) patch[SELLO[nuevo]] = new Date().toISOString()
  if (dist != null) patch.distancia_destino_m = dist
  if (Number.isFinite(lat) && Number.isFinite(lng)) { patch.ultima_lat = lat; patch.ultima_lng = lng; patch.ultimo_ping = new Date().toISOString() }
  if (body?.notas) patch.notas_cierre = String(body.notas).slice(0, 2000)
  const eta = Number(body?.eta_segundos)
  if (Number.isFinite(eta)) patch.eta_segundos = Math.round(eta)

  const { data: segAct, error } = await (supabase.from('gatwick_seguimientos') as any)
    .update(patch).eq('id', seg.id).select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error actualizando: ${error.message}` })

  // ── Emergencia y técnico ──
  const { data: emerg } = await (supabase.from('gatwick_emergencias') as any)
    .select('*').eq('id', seg.emergencia_id).maybeSingle()

  if (nuevo === 'finalizada') {
    await (supabase.from('gatwick_emergencias') as any)
      .update({ estado: 'resuelta', resuelto_en: new Date().toISOString() }).eq('id', seg.emergencia_id)
    if (seg.tecnico_id) {
      await (supabase.from('gatwick_tecnicos') as any).update({ estado: 'disponible' }).eq('id', seg.tecnico_id)
    }
  } else if (nuevo === 'cancelada' && seg.tecnico_id) {
    await (supabase.from('gatwick_tecnicos') as any).update({ estado: 'disponible' }).eq('id', seg.tecnico_id)
  }

  // ── Avisar a los supervisores ──
  const linkSupervisor = `${baseUrl(event)}/gatwick/seguimiento/${token}`
  const mensaje = mensajeParaEstado(nuevo, {
    emergencia: emerg || seg.snapshot || {},
    seguimiento: segAct,
    linkSupervisor,
    distanciaM: dist,
    etaSegundos: segAct.eta_segundos,
    notas: patch.notas_cierre,
  })
  const aviso = await avisarSupervisores(supabase, mensaje, 'seguimiento')

  try {
    const e: any = emerg || seg.snapshot || {}
    await supabase.from('agent_tool_logs').insert({
      company_id: 'gatwick', tool_name: 'Seguimiento Emergencia',
      input_data: {
        evento: `${seg.estado} → ${nuevo}`,
        seguimiento_id: seg.id, emergencia_id: seg.emergencia_id,
        tecnico: seg.tecnico_nombre,
        edificio: e.edificio_nombre || e.empresa_cliente,
        codigo_ascensor: e.codigo_ascensor,
        direccion: e.direccion,
        distancia_destino_m: dist,
        notas: patch.notas_cierre ?? null,
      },
      output_data: {
        estado: nuevo,
        supervisores_avisados: aviso.enviados,
        supervisores_fallidos: aviso.fallidos,
        eta_segundos: segAct.eta_segundos ?? null,
      },
      status: aviso.fallidos ? 'warning' : 'success',
    })
  } catch {}

  console.log(`[gatwick/seguimiento] #${seg.id} ${seg.estado} -> ${nuevo} | dist=${dist ?? '—'}m | avisos=${aviso.enviados}`)
  return { ok: true, seguimiento: segAct, aviso }
})
