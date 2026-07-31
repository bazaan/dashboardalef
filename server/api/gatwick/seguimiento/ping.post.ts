/**
 * POST /api/gatwick/seguimiento/ping
 *
 * El teléfono del técnico manda su posición GPS cada pocos segundos.
 * Guarda el punto, actualiza la última posición del seguimiento y calcula
 * la distancia al destino (con eso el front decide si habilita "Atendiendo").
 *
 * Auth: el TOKEN del seguimiento (no hay sesión; el técnico entra por link).
 * Solo acepta pings de seguimientos ACTIVOS: al finalizar, el GPS deja de valer.
 *
 * Body: { token, lat, lng, precision?, velocidad?, rumbo?, eta_segundos? }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { distanciaM, GEOFENCE_M } from '../../../utils/gatwick-tracking'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event)

  const token = String(body?.token || '').trim()
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Falta token' })
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw createError({ statusCode: 400, statusMessage: 'Coordenadas inválidas' })
  }

  const { data: seg } = await (supabase.from('gatwick_seguimientos') as any)
    .select('id, estado, destino_lat, destino_lng').eq('token', token).maybeSingle()
  if (!seg) throw createError({ statusCode: 404, statusMessage: 'Seguimiento no encontrado' })
  if (!['iniciado', 'en_camino', 'atendiendo'].includes(seg.estado)) {
    // Ya cerrado: no se aceptan más posiciones (privacidad del técnico)
    return { ok: false, cerrado: true, estado: seg.estado }
  }

  // Distancia al destino → habilita el botón "Atendiendo" en el front
  let dist: number | null = null
  if (seg.destino_lat != null && seg.destino_lng != null) {
    dist = distanciaM(lat, lng, Number(seg.destino_lat), Number(seg.destino_lng))
  }

  const precision = Number(body?.precision)
  const velocidad = Number(body?.velocidad)
  const rumbo = Number(body?.rumbo)
  const eta = Number(body?.eta_segundos)

  // Punto del recorrido
  await (supabase.from('gatwick_tracking_puntos') as any).insert({
    seguimiento_id: seg.id, lat, lng,
    precision_m: Number.isFinite(precision) ? precision : null,
    velocidad: Number.isFinite(velocidad) ? velocidad : null,
    rumbo: Number.isFinite(rumbo) ? rumbo : null,
    estado: seg.estado,
  })

  // Última posición (esto es lo que dispara el Realtime del mapa del supervisor)
  await (supabase.from('gatwick_seguimientos') as any).update({
    ultima_lat: lat, ultima_lng: lng,
    ultima_precision: Number.isFinite(precision) ? precision : null,
    ultima_velocidad: Number.isFinite(velocidad) ? velocidad : null,
    ultimo_ping: new Date().toISOString(),
    distancia_destino_m: dist,
    eta_segundos: Number.isFinite(eta) ? Math.round(eta) : null,
  }).eq('id', seg.id)

  return {
    ok: true,
    estado: seg.estado,
    distancia_destino_m: dist,
    en_destino: dist != null && dist <= GEOFENCE_M,
    geofence_m: GEOFENCE_M,
  }
})
