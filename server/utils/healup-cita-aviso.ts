/**
 * Aviso interno "nueva cita agendada" de Healup → Chatwoot.
 *
 * Cada vez que el agente IA agenda una cita (tools Calendario, Calendario FB/IG
 * y Cita Multiple → endpoints /api/healup/calendario, /calendario-fbig y
 * /cita-multiple), se envía un mensaje formateado a las conversaciones internas
 * de Chatwoot (cuenta 2, conversaciones 1361 y 8011 por defecto) para que el
 * equipo vea las citas nuevas en tiempo real. El MISMO mensaje se manda a TODAS
 * las conversaciones configuradas, en paralelo (al mismo tiempo).
 *
 * Es best-effort: si Chatwoot falla, la cita igual se crea (el aviso NO marca
 * error global del endpoint). Si una conversación falla, las demás igual reciben.
 *
 * Env vars (opcionales, tienen default):
 *   CHATWOOT_HEALUP_CITAS_URL    — una o varias URLs separadas por coma
 *   CHATWOOT_HEALUP_CITAS_TOKEN  — api_access_token (fallback: el token FB/IG)
 */

const CHATWOOT_CITAS_URLS = (process.env.CHATWOOT_HEALUP_CITAS_URL
  || 'https://chats.alef.company/api/v1/accounts/2/conversations/1361/messages,https://chats.alef.company/api/v1/accounts/2/conversations/8011/messages')
  .split(',').map(s => s.trim()).filter(Boolean)

const CHATWOOT_CITAS_TOKEN = process.env.CHATWOOT_HEALUP_CITAS_TOKEN
  || process.env.CHATWOOT_HEALUP_FBIG_TOKEN
  || '8oLRk3yaKcLoR5zt4KPNtcUy'

export interface CitaAviso {
  nombre: string
  dni?: string
  telefono?: string
  tratamiento?: string
  inicioCitaIso: string        // ISO 8601: "2026-06-30T16:00:00"
  canal?: string               // WhatsApp | Instagram | Facebook | TikTok
  titulo?: string              // encabezado custom (ej: cita doble)
  lineasExtra?: string[]       // líneas adicionales al final (ej: 2do paciente)
}

/** "2026-06-30T16:00:00" → "Martes 30 de junio" (es-PE, Lima) */
function fechaHumanaEs(iso: string): string {
  try {
    const s = new Date(iso).toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return iso }
}

/** "2026-06-30T16:00:00" → "4:00 p. m." (es-PE, Lima) */
function horaHumanaEs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-PE', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Lima',
    })
  } catch { return iso }
}

/** Arma el mensaje bonito (markdown de Chatwoot: *negrita*) */
export function formatearAvisoCita(c: CitaAviso): string {
  const lineas: string[] = [
    `🗓️ *${c.titulo || 'Nueva cita agendada — HealUp'}*`,
    '',
    `👤 *Paciente:* ${c.nombre}`,
  ]
  if (c.dni)         lineas.push(`🪪 *DNI:* ${c.dni}`)
  if (c.telefono)    lineas.push(`📞 *Teléfono:* ${c.telefono}`)
  if (c.tratamiento) lineas.push(`💆 *Tratamiento:* ${c.tratamiento}`)
  lineas.push(`📅 *Fecha:* ${fechaHumanaEs(c.inicioCitaIso)}`)
  lineas.push(`⏰ *Hora:* ${horaHumanaEs(c.inicioCitaIso)}`)
  if (c.canal)       lineas.push(`📲 *Canal:* ${c.canal}`)
  if (c.lineasExtra?.length) lineas.push(...c.lineasExtra)
  return lineas.join('\n')
}

/** POST del mismo mensaje a una conversación de Chatwoot. */
async function postearAConversacion(url: string, content: string): Promise<void> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'api_access_token': CHATWOOT_CITAS_TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content, message_type: 'outgoing', content_type: 'text' }),
  })
  if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${await res.text()}`)
}

/**
 * Envía el MISMO aviso a TODAS las conversaciones configuradas (1361 y 8011 por
 * defecto), en paralelo. Nunca lanza: devuelve { ok, error? }. `ok` es true si
 * al menos una conversación recibió el mensaje.
 */
export async function avisarNuevaCitaChatwoot(c: CitaAviso): Promise<{ ok: boolean; error?: string }> {
  const content = formatearAvisoCita(c)
  const resultados = await Promise.allSettled(
    CHATWOOT_CITAS_URLS.map(url => postearAConversacion(url, content)),
  )
  const errores = resultados
    .map((r, i) => (r.status === 'rejected' ? `${CHATWOOT_CITAS_URLS[i]}: ${r.reason?.message ?? r.reason}` : null))
    .filter(Boolean) as string[]
  if (errores.length) console.error('[cita-aviso] Error(es) enviando a Chatwoot:', errores.join(' | '))
  const algunaOk = resultados.some(r => r.status === 'fulfilled')
  return algunaOk
    ? { ok: true, ...(errores.length ? { error: errores.join(' | ') } : {}) }
    : { ok: false, error: errores.join(' | ') || 'Error enviando aviso a Chatwoot' }
}
