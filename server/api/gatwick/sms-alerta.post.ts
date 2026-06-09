/**
 * POST /api/gatwick/sms-alerta
 *
 * Tool del agente de emergencias de Gatwick: "sms_alerta_emergencia".
 * Recibe las variables de la emergencia, arma un mensaje dinámico y lo envía
 * por SMS vía Telnyx al/los técnico(s) de turno.
 *
 * El destino (técnico) es ROTATIVO y se gestiona en nuestro sistema: se leen
 * los números activos de la tabla `gatwick_alerta_destinos` (recibe_sms=true).
 * Si la tabla está vacía, cae al fallback de env GATWICK_SMS_DESTINO_FALLBACK
 * (uno o varios números separados por coma).
 *
 * Body (todas string; el agente las extrae del nodo anterior):
 * {
 *   api_key: string,
 *   tipo_caso, edificio_nombre, edificio_tipo, edificio_direccion,
 *   edificio_distrito, personas_atrapadas, descripcion_adicional, telefono_contacto
 * }
 *
 * Log: agent_tool_logs (company_id='gatwick', tool_name='SMS Alerta Emergencia').
 *      El telefono_contacto se enmascara antes de loguear (seguridad).
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'gatwick-sms-2026'

const TELNYX_URL = 'https://api.telnyx.com/v2/messages'
// La API key es secreta → SOLO desde env var (no se hardcodea en el repo).
// Definirla en Netlify → Environment variables → TELNYX_API_KEY.
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || ''
const TELNYX_FROM = process.env.TELNYX_SMS_FROM || 'Gatwick SMS'
const TELNYX_PROFILE_ID = process.env.TELNYX_MESSAGING_PROFILE_ID
  || '40019e3c-6053-4325-b86a-c7ca1d277e82'

/** Normaliza a E.164 Perú (+51...). Acepta ya-formateados, 51XXXXXXXXX, 9XXXXXXXX. */
function toE164(raw: any): string {
  let s = String(raw ?? '').replace(/[^\d+]/g, '')
  if (!s) return ''
  if (s.startsWith('+')) return s
  s = s.replace(/^00/, '')
  if (/^51\d{9}$/.test(s)) return '+' + s          // 51 + 9 dígitos
  if (/^9\d{8}$/.test(s)) return '+51' + s         // celular peruano (9 dígitos)
  return '+' + s                                   // último recurso: ya trae código país
}

/** Oculta el centro de un teléfono para loguear sin exponer el número completo. */
function maskPhone(raw: any): string {
  const s = String(raw ?? '')
  if (s.length <= 4) return s ? '••••' : ''
  return s.slice(0, 3) + '••••' + s.slice(-2)
}

/** Arma el mensaje de alerta a partir del template fijo. */
function buildMensaje(b: any): string {
  return [
    `🚨 EMERGENCIA: ${b?.tipo_caso || '—'}`,
    `📍 ${b?.edificio_nombre || '—'} | ${b?.edificio_tipo || '—'}`,
    `📍 ${b?.edificio_direccion || '—'}, ${b?.edificio_distrito || '—'}`,
    `👥 ${b?.personas_atrapadas || 'No'}`,
    `📝 ${b?.descripcion_adicional || '—'}`,
    `📞 Contacto: ${b?.telefono_contacto || '—'}`,
    `→ Revisa WhatsApp URGENTE`,
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial (enmascara telefono_contacto y nunca guarda api_key)
  const inputSeguro = { ...body }
  delete inputSeguro.api_key
  if (inputSeguro.telefono_contacto) inputSeguro.telefono_contacto = maskPhone(inputSeguro.telefono_contacto)

  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'gatwick',
      tool_name:  'SMS Alerta Emergencia',
      input_data: inputSeguro,
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const finish = async (status: string, output: any, errorMsg?: string) => {
    if (logId) {
      try {
        await supabase.from('agent_tool_logs').update({
          status, output_data: output, error_message: errorMsg ?? null,
          duration_ms: Date.now() - startTime,
        }).eq('id', logId)
      } catch {}
    }
    return output
  }

  const nowIso = new Date().toISOString()

  // 3. Armar el mensaje
  const mensaje = buildMensaje(body)

  // 4. Resolver destinatarios (técnicos de turno)
  let destinos: string[] = []
  try {
    const { data } = await supabase
      .from('gatwick_alerta_destinos')
      .select('telefono, nombre')
      .eq('activo', true)
      .eq('recibe_sms', true)
      .order('orden', { ascending: true })
    destinos = (data ?? []).map((d: any) => toE164(d.telefono)).filter(Boolean)
  } catch {
    // la tabla puede no existir aún → usamos el fallback de env
  }
  const smsFallback = process.env.GATWICK_SMS_DESTINO_FALLBACK
  if (destinos.length === 0 && smsFallback) {
    destinos = smsFallback.split(',').map(toE164).filter(Boolean)
  }
  // dedup
  destinos = [...new Set(destinos)]

  if (destinos.length === 0) {
    const msg = 'No hay técnicos de turno configurados (tabla gatwick_alerta_destinos vacía y sin GATWICK_SMS_DESTINO_FALLBACK).'
    return await finish('error', {
      success: false,
      message: 'No se pudo enviar el SMS. Contacta al equipo técnico.',
      error: 'sin_destinatarios',
      timestamp: nowIso,
    }, msg)
  }

  // 4b. Verificar credencial de Telnyx
  if (!TELNYX_API_KEY) {
    const msg = 'TELNYX_API_KEY no configurada en las env vars del dashboard.'
    return await finish('error', {
      success: false,
      message: 'No se pudo enviar el SMS. Contacta al equipo técnico.',
      error: 'telnyx_api_key_faltante',
      timestamp: nowIso,
    }, msg)
  }

  // 5. Enviar a Telnyx (uno por destino)
  const envios: any[] = []
  for (const to of destinos) {
    try {
      const res: any = await $fetch(TELNYX_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: {
          from: TELNYX_FROM,
          to,
          text: mensaje,
          messaging_profile_id: TELNYX_PROFILE_ID,
        },
        timeout: 10000,
      })
      const telnyxId = res?.data?.id ?? null
      const estado = res?.data?.to?.[0]?.status ?? 'queued'
      envios.push({ to: maskPhone(to), ok: true, telnyx_id: telnyxId, status: estado })
    } catch (e: any) {
      // $fetch adjunta el body del error de Telnyx en e.data
      const detalle = e?.data?.errors?.[0]?.detail
        || e?.data?.errors?.[0]?.title
        || e?.data?.detail
        || e?.message
        || String(e)
      envios.push({ to: maskPhone(to), ok: false, error: detalle })
    }
  }

  const exitosos = envios.filter(e => e.ok)
  const fallidos = envios.filter(e => !e.ok)

  // 6. Output (formato esperado por la tool)
  if (exitosos.length > 0) {
    const status = fallidos.length === 0 ? 'success' : 'partial'
    const output = {
      success: true,
      message: 'Se realizó el aviso al técnico de turno. El equipo técnico está en camino.',
      telnyx_id: exitosos[0].telnyx_id,
      enviados: exitosos.length,
      fallidos: fallidos.length,
      detalle: envios,
      timestamp: nowIso,
    }
    await finish(status, output, fallidos.length ? `${fallidos.length} envío(s) fallaron` : undefined)
    console.log(`[sms-alerta] Gatwick | ✅${exitosos.length} ❌${fallidos.length}`)
    return output
  }

  // Todos fallaron
  const errorMsg = fallidos.map(f => f.error).join(' | ')
  const output = {
    success: false,
    message: 'No se pudo enviar el SMS. Contacta al equipo técnico.',
    error: errorMsg,
    detalle: envios,
    timestamp: nowIso,
  }
  await finish('error', output, errorMsg)
  console.error(`[sms-alerta] Gatwick | TODOS fallaron: ${errorMsg}`)
  return output
})
