/**
 * POST /api/tradecars/chatwoot-lead
 *
 * Recibe leads YA ESTRUCTURADOS por el nodo de IA del flujo de n8n que lee los mensajes de
 * Chatwoot (28/09/2026) — cuando alguien llena un formulario de Meta y el mensaje llega como
 * texto libre a una conversación (ej. "¡Hola! Completé el formulario... Marca: Suzuki..."),
 * n8n lo parsea con IA y manda acá el JSON ya ordenado. Este endpoint NO interpreta texto:
 * solo valida, deduplica por teléfono y guarda.
 *
 * ── AUTENTICACIÓN ────────────────────────────────────────────────────────────
 *   Header: x-api-key: tradecars-chatwoot-lead-2026
 *   (también se acepta ?api_key=... en la URL o "api_key" dentro del body)
 *
 * ── BODY ─────────────────────────────────────────────────────────────────────
 *   {
 *     "telefono": "962942416",              // REQUERIDO — es la clave de deduplicación
 *     "nombre_chatwoot": "Marco Cusicuna",   // nombre del contacto en Chatwoot
 *     "correo": "marcocusicuna.23@gmail.com",
 *     "marca": "Suzuki", "modelo": "Ciaz", "anio": 2017, "kilometraje": 110000,
 *     "placa": "AZC654", "distrito": "Surco",
 *     "mensaje_original": "¡Hola! Completé el formulario...",  // texto crudo, para auditar
 *     "conversation_id": 1858, "account_id": 17, "inbox_id": 83
 *   }
 *
 * ── DEDUPLICACIÓN ────────────────────────────────────────────────────────────
 *   Si YA existe un lead con ese teléfono (normalizado), NO se toca nada — se devuelve
 *   `duplicado: true` con el `id` del que ya había. No se actualiza ni se pisa nada que
 *   el equipo ya haya trabajado sobre ese lead.
 *
 * ── RESPUESTA (siempre 200 salvo 400/401, para que n8n no reintente en bucle) ──
 *   { ok: true, duplicado: false, id: "uuid" }   → insertado
 *   { ok: true, duplicado: true,  id: "uuid" }   → ya existía, no se hizo nada
 *
 * Log: agent_tool_logs (company_id='tradecars', tool_name='Lead desde Chatwoot')
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'tradecars-chatwoot-lead-2026'

function pick(body: any, ...claves: string[]): string {
  for (const k of claves) {
    const v = body?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function toInt(valor: string): number | null {
  const soloDigitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (!soloDigitos) return null
  const n = parseInt(soloDigitos, 10)
  return Number.isFinite(n) ? n : null
}

/** Deja solo dígitos y quita el prefijo 51 (Perú) si el número quedó de 11 dígitos. */
function normalizarTelefono(valor: string): string {
  let digitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (digitos.length === 11 && digitos.startsWith('51')) digitos = digitos.slice(2)
  return digitos
}

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido. Usa POST.' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({}))
  const query = getQuery(event) as any

  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || query?.api_key || body?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  const telefonoCrudo = pick(body, 'telefono', 'celular', 'phone', 'numero', 'telefono_contacto')
  const telefono = normalizarTelefono(telefonoCrudo)
  if (!telefono) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el teléfono (telefono)' })
  }

  const nombre_chatwoot = pick(body, 'nombre_chatwoot', 'nombre_contacto', 'contact_name', 'nombre')
  const correo = pick(body, 'correo', 'email')
  const marca = pick(body, 'marca')
  const modelo = pick(body, 'modelo')
  const placa = pick(body, 'placa')
  const distrito = pick(body, 'distrito')
  const anio = toInt(pick(body, 'anio', 'año', 'ano', 'year'))
  const kilometraje = toInt(pick(body, 'kilometraje', 'km', 'kilometros'))
  const mensaje_original = pick(body, 'mensaje_original', 'mensaje', 'texto', 'message')
  const conversation_id = toInt(pick(body, 'conversation_id'))
  const account_id = toInt(pick(body, 'account_id'))
  const inbox_id = toInt(pick(body, 'inbox_id'))

  // ¿Falta la migración? Un INSERT contra una tabla que no existe devuelve un error VACÍO
  // ({}) en supabase-js (a diferencia del SELECT, que sí trae code/message) — el único rastro
  // confiable ahí es el status HTTP 404. Por eso se revisa acá, con el error completo del SELECT.
  const tablaFaltante = (error: any, status: number) =>
    status === 404 || (!!error && (error.code === '42P01' || error.code === 'PGRST205'
      || /does not exist|schema cache/i.test(String(error.message || ''))))

  // Deduplicación por teléfono: si ya existe, no se toca nada.
  const { data: existente, error: errorBusqueda, status: statusBusqueda } = await supabase
    .from('tradecars_leads_chatwoot')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle()

  if (tablaFaltante(errorBusqueda, statusBusqueda)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Falta correr sql/tradecars_leads_chatwoot.sql en Supabase para poder guardar estos leads.',
    })
  }
  if (errorBusqueda) {
    throw createError({ statusCode: 400, statusMessage: errorBusqueda.message })
  }
  if (existente) {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'tradecars', tool_name: 'Lead desde Chatwoot',
        input_data: { telefono, nombre_chatwoot, marca, modelo },
        output_data: { id: existente.id, duplicado: true },
        status: 'success',
      })
    } catch {}
    return { ok: true, duplicado: true, id: existente.id }
  }

  const fila = {
    telefono, nombre_chatwoot: nombre_chatwoot || null, correo: correo || null,
    marca: marca || null, modelo: modelo || null, anio, kilometraje,
    placa: placa || null, distrito: distrito || null,
    mensaje_original: mensaje_original || null,
    conversation_id, account_id, inbox_id,
    payload: body,
  }

  const { data, error, status: statusInsert } = await (supabase.from('tradecars_leads_chatwoot') as any)
    .insert(fila)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      // Carrera con otro request para el mismo teléfono: el índice único ganó. No es un error real.
      const { data: yaExiste } = await supabase
        .from('tradecars_leads_chatwoot').select('id').eq('telefono', telefono).maybeSingle()
      return { ok: true, duplicado: true, id: yaExiste?.id ?? null }
    }
    if (tablaFaltante(error, statusInsert)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Falta correr sql/tradecars_leads_chatwoot.sql en Supabase para poder guardar estos leads.',
      })
    }
    console.error('[tradecars/chatwoot-lead] Error guardando:', JSON.stringify(error), 'status:', statusInsert)
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'tradecars', tool_name: 'Lead desde Chatwoot',
        input_data: body, status: 'error', error_message: error.message || `HTTP ${statusInsert}`,
      })
    } catch {}
    throw createError({ statusCode: 500, statusMessage: `Error guardando el lead: ${error.message || `HTTP ${statusInsert}`}` })
  }

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'tradecars', tool_name: 'Lead desde Chatwoot',
      input_data: { telefono, nombre_chatwoot, marca, modelo, placa },
      output_data: { id: data?.id ?? null, duplicado: false },
      status: 'success',
    })
  } catch {}

  return { ok: true, duplicado: false, id: data?.id ?? null }
})
