/**
 * GET /api/gatwick/seguimiento/[token]
 *
 * Datos del seguimiento para las dos páginas públicas (técnico y supervisor).
 * Devuelve el estado, el destino, la última posición, el recorrido y los datos
 * de la emergencia. NO expone teléfonos de contacto del cliente ni el token de
 * otros seguimientos.
 *
 * ?recorrido=0  → omite los puntos (para el polling ligero del técnico)
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { GEOFENCE_M } from '../../../utils/gatwick-tracking'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const token = String(getRouterParam(event, 'token') || '').trim()
  const q = getQuery(event) as any
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Falta token' })

  const { data: seg } = await (supabase.from('gatwick_seguimientos') as any)
    .select('*').eq('token', token).maybeSingle()
  if (!seg) throw createError({ statusCode: 404, statusMessage: 'Seguimiento no encontrado o expirado' })

  const { data: emerg } = await (supabase.from('gatwick_emergencias') as any)
    .select('id, titulo, descripcion, direccion, empresa_cliente, telefono_contacto, prioridad, estado, tipo_equipo, numero_equipo, piso, codigo_ascensor, edificio_nombre, distrito, elme, destino_lat, destino_lng, created_at')
    .eq('id', seg.emergencia_id).maybeSingle()

  let recorrido: any[] = []
  if (q?.recorrido !== '0') {
    const { data: puntos } = await (supabase.from('gatwick_tracking_puntos') as any)
      .select('lat, lng, registrado_en, velocidad, estado')
      .eq('seguimiento_id', seg.id).order('registrado_en', { ascending: true }).limit(2000)
    recorrido = puntos || []
  }

  const activo = ['iniciado', 'en_camino', 'atendiendo'].includes(seg.estado)

  return {
    ok: true,
    activo,
    geofence_m: GEOFENCE_M,
    seguimiento: {
      id: seg.id, estado: seg.estado,
      tecnico_nombre: seg.tecnico_nombre, tecnico_telefono: seg.tecnico_telefono,
      destino_direccion: seg.destino_direccion,
      destino_lat: seg.destino_lat, destino_lng: seg.destino_lng,
      ultima_lat: seg.ultima_lat, ultima_lng: seg.ultima_lng,
      ultima_velocidad: seg.ultima_velocidad, ultimo_ping: seg.ultimo_ping,
      distancia_destino_m: seg.distancia_destino_m, eta_segundos: seg.eta_segundos,
      iniciado_en: seg.iniciado_en, en_camino_en: seg.en_camino_en,
      atendiendo_en: seg.atendiendo_en, finalizada_en: seg.finalizada_en,
      notas_cierre: seg.notas_cierre,
    },
    emergencia: emerg || seg.snapshot || null,
    recorrido,
  }
})
