/**
 * Gatwick — utilidades del seguimiento GPS de emergencias
 * -------------------------------------------------------
 * · Aviso a los supervisores por WhatsApp (Chatwoot)
 * · Geocodificación de la dirección del edificio (Nominatim/OSM, gratis)
 * · Distancia haversine (para el geofence de "llegó al destino")
 * · Armado de los mensajes de cada estado
 */

const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL || 'https://chats.alef.company'
const CHATWOOT_TOKEN = process.env.CHATWOOT_GATWICK_TOKEN || 'AQrZAwnjzrtjpXBwwrmexUbL'

/** Radio (m) dentro del cual se considera que el técnico YA llegó al edificio. */
export const GEOFENCE_M = 200

/* ══════════════════ Geometría ══════════════════ */

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

/**
 * Geocodifica una dirección de Lima con Nominatim (OpenStreetMap).
 * Gratis y sin API key. Devuelve null si no encuentra nada.
 */
export async function geocodificar(direccion: string, distrito?: string): Promise<{ lat: number; lng: number } | null> {
  const dir = String(direccion || '').trim()
  if (!dir) return null

  // Se prueba de lo más preciso a lo más laxo: si la numeración exacta no está
  // mapeada en OSM, al menos ubicamos la calle (sirve para la ruta y el ETA).
  const sinNumero = dir.replace(/\s*(n[°º]?\s*)?\d+[a-z]?\s*$/i, '').trim()
  const intentos = [
    [dir, distrito, 'Lima', 'Perú'],
    sinNumero && sinNumero !== dir ? [sinNumero, distrito, 'Lima', 'Perú'] : null,
    distrito ? [distrito, 'Lima', 'Perú'] : null,
  ].filter(Boolean) as (string | undefined)[][]

  for (const partes of intentos) {
    const q = partes.filter(Boolean).join(', ')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(q)}`
      const res: any = await $fetch(url, {
        headers: { 'User-Agent': 'AlefDashboard/1.0 (gatwick-tracking)' },
        timeout: 8000,
      })
      const hit = Array.isArray(res) ? res[0] : null
      if (hit?.lat && hit?.lon) {
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
      }
    } catch (e: any) {
      console.error(`[gatwick-tracking] geocodificar "${q}" falló:`, e?.message)
    }
  }
  console.warn(`[gatwick-tracking] sin coordenadas para: ${dir} (${distrito ?? '—'})`)
  return null
}

/* ══════════════════ Chatwoot ══════════════════ */

/**
 * Envía un mensaje a TODAS las conversaciones de supervisores activas.
 * Best-effort: si una falla, las demás igual se envían.
 */
export async function avisarSupervisores(supabase: any, mensaje: string): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0, fallidos = 0
  let destinos: any[] = []

  try {
    const { data } = await supabase
      .from('gatwick_supervisores')
      .select('nombre, chatwoot_account_id, chatwoot_conversation_id')
      .eq('activo', true)
      .order('orden')
    destinos = data || []
  } catch (e: any) {
    console.error('[gatwick-tracking] no se pudo leer supervisores:', e?.message)
  }

  // Fallback por si la tabla está vacía: los 2 chats acordados con Gatwick
  if (!destinos.length) {
    destinos = [
      { nombre: 'Supervisor 1', chatwoot_account_id: 15, chatwoot_conversation_id: 14 },
      { nombre: 'Supervisor 2', chatwoot_account_id: 15, chatwoot_conversation_id: 59 },
    ]
  }

  for (const d of destinos) {
    const url = `${CHATWOOT_BASE}/api/v1/accounts/${d.chatwoot_account_id}/conversations/${d.chatwoot_conversation_id}/messages`
    try {
      await $fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_TOKEN },
        body: { content: mensaje, message_type: 'outgoing' },
        timeout: 12000,
      })
      enviados++
    } catch (e: any) {
      fallidos++
      console.error(`[gatwick-tracking] Chatwoot ${d.chatwoot_account_id}/${d.chatwoot_conversation_id} falló:`, e?.message)
    }
  }
  return { enviados, fallidos }
}

/* ══════════════════ Mensajes ══════════════════ */

function hhmm(d?: Date) {
  return (d || new Date()).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
}

/** Bloque con los datos del edificio/ascensor (se repite en varios mensajes). */
function bloqueEmergencia(e: any): string {
  const lineas: string[] = []
  if (e.edificio_nombre || e.empresa_cliente) lineas.push(`🏢 *Edificio:* ${e.edificio_nombre || e.empresa_cliente}`)
  if (e.codigo_ascensor) lineas.push(`🛗 *Ascensor:* ${e.codigo_ascensor}${e.tipo_equipo ? ` — ${e.tipo_equipo}` : ''}`)
  else if (e.tipo_equipo) lineas.push(`🛗 *Equipo:* ${e.tipo_equipo}${e.numero_equipo ? ` ${e.numero_equipo}` : ''}`)
  if (e.direccion) lineas.push(`📍 *Dirección:* ${e.direccion}${e.distrito ? `, ${e.distrito}` : ''}`)
  if (e.elme) lineas.push(`🔖 *ELME:* ${e.elme}`)
  if (e.piso) lineas.push(`🏗️ *Piso:* ${e.piso}`)
  if (e.telefono_contacto) lineas.push(`☎️ *Contacto:* ${e.telefono_contacto}`)
  if (e.descripcion) lineas.push(`📝 *Detalle:* ${e.descripcion}`)
  return lineas.join('\n')
}

export interface MensajeCtx {
  emergencia: any
  seguimiento: any
  linkSupervisor: string
  distanciaM?: number | null
  etaSegundos?: number | null
  notas?: string | null
}

/** Arma el texto de WhatsApp según el estado al que se pasó. */
export function mensajeParaEstado(estado: string, ctx: MensajeCtx): string {
  const { emergencia: e, seguimiento: s, linkSupervisor } = ctx
  const tecnico = s.tecnico_nombre || 'Técnico'
  const prioridad = String(e.prioridad || 'media').toUpperCase()
  const datos = bloqueEmergencia(e)

  if (estado === 'iniciado') {
    return [
      `🚨 *EMERGENCIA ASIGNADA — Prioridad ${prioridad}*`,
      `Emergencia #${e.id}${e.titulo ? ` · ${e.titulo}` : ''}`,
      '',
      datos,
      '',
      `👷 *Técnico asignado:* ${tecnico}`,
      s.tecnico_telefono ? `📱 ${s.tecnico_telefono}` : '',
      `🕐 *Inicio:* ${hhmm()}`,
      '',
      `🗺️ *Seguimiento en vivo del técnico:*`,
      linkSupervisor,
      '',
      `_Podrás ver su ubicación, la ruta y el tiempo estimado de llegada en tiempo real._`,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'en_camino') {
    const eta = ctx.etaSegundos ? `\n⏱️ *Llegada estimada:* ${Math.max(1, Math.round(ctx.etaSegundos / 60))} min` : ''
    const dist = ctx.distanciaM ? `\n📏 *Distancia:* ${(ctx.distanciaM / 1000).toFixed(1)} km` : ''
    return [
      `🚗 *TÉCNICO EN CAMINO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} salió hacia el edificio.`,
      `🕐 ${hhmm()}${dist}${eta}`,
      '',
      `🗺️ Seguimiento en vivo:`,
      linkSupervisor,
    ].join('\n')
  }

  if (estado === 'atendiendo') {
    return [
      `🔧 *TÉCNICO EN SITIO — ATENDIENDO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} llegó al edificio y está atendiendo la emergencia.`,
      e.codigo_ascensor ? `🛗 Ascensor: ${e.codigo_ascensor}` : '',
      `🕐 ${hhmm()}`,
      '',
      `🗺️ Seguimiento:`,
      linkSupervisor,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'finalizada') {
    const ini = s.iniciado_en ? new Date(s.iniciado_en) : null
    const durMin = ini ? Math.max(1, Math.round((Date.now() - ini.getTime()) / 60000)) : null
    return [
      `✅ *EMERGENCIA ATENDIDA*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} finalizó la atención.`,
      e.codigo_ascensor ? `🛗 Ascensor: ${e.codigo_ascensor}` : '',
      durMin ? `⏱️ *Duración total:* ${durMin} min` : '',
      `🕐 *Cierre:* ${hhmm()}`,
      ctx.notas ? `\n📝 *Notas del técnico:* ${ctx.notas}` : '',
      '',
      `_El seguimiento GPS se cerró._`,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'cancelada') {
    return [
      `⛔ *SEGUIMIENTO CANCELADO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      `👷 ${tecnico} · 🕐 ${hhmm()}`,
      ctx.notas ? `📝 ${ctx.notas}` : '',
    ].filter(Boolean).join('\n')
  }

  return `Actualización de la emergencia #${e.id}: ${estado}`
}

/* ══════════════════ Autenticación ══════════════════ */

/**
 * Verifica que quien inicia un seguimiento tenga sesión válida en el dashboard.
 * Sin esto, cualquiera con la URL del endpoint podría crear seguimientos falsos
 * y disparar WhatsApp a los supervisores de Gatwick.
 * El servidor NO confía en la cookie: re-verifica el perfil en dashboardlogin.
 */
export async function verificarSesionGatwick(event: any, supabase: any): Promise<{ email: string }> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rol = String(perfil.role ?? '').toLowerCase()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')
  if (rol !== 'superadmin' && !cid.includes('gatwick') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para Gatwick' })
  }
  return { email: perfil.email }
}

/**
 * Igual que verificarSesionGatwick, pero además exige rol ADMIN o SUPERADMIN.
 * Se usa para gestionar emergencias (editar, eliminar, resolver, cancelar):
 * un agente/técnico puede atender y cerrar SU seguimiento, pero no administrar
 * las emergencias del monitor.
 */
export async function verificarAdminGatwick(event: any, supabase: any): Promise<{ email: string; role: string }> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rol = String(perfil.role ?? '').toLowerCase().trim()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')

  if (rol !== 'superadmin' && rol !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo un administrador puede gestionar las emergencias.',
    })
  }
  // Un admin solo administra las emergencias de SU empresa
  if (rol !== 'superadmin' && !cid.includes('gatwick') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para Gatwick' })
  }
  return { email: perfil.email, role: rol }
}

/** URL base pública del dashboard (para armar los links de los mensajes). */
export function baseUrl(event: any): string {
  const env = process.env.PUBLIC_BASE_URL || process.env.URL
  if (env) return String(env).replace(/\/$/, '')
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || 'dashboard.alef.company'
  const proto = getHeader(event, 'x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}
