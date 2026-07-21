/**
 * POST /api/tradecars/formulario
 *
 * Recibe los formularios de la web de Trade Cars Perú y los guarda en Supabase.
 * Complementa el correo que hoy les llega: ahora además queda registrado en el
 * dashboard (módulo "Solicitudes Web").
 *
 * Se define sin sufijo de método (formulario.ts) a propósito, para poder
 * responder también al preflight OPTIONS del navegador (CORS).
 *
 * ── AUTENTICACIÓN ────────────────────────────────────────────────────────────
 *   Header:  x-api-key: tradecars-web-2026
 *   (también se acepta ?api_key=... en la URL o "api_key" dentro del body)
 *
 * ── DOS TIPOS DE FORMULARIO ──────────────────────────────────────────────────
 *
 *  A) tipo = "compra"  → el cliente QUIERE COMPRAR un auto (form corto)
 *     {
 *       "tipo": "compra",
 *       "nombre_completo": "Juan Pérez",
 *       "correo": "juan@mail.com",
 *       "celular": "999888777",
 *       "mensaje": "Busco una SUV automática"
 *     }
 *
 *  B) tipo = "venta"   → el cliente QUIERE VENDER su auto (form con vehículo)
 *     {
 *       "tipo": "venta",
 *       "nombre_completo": "Ana Torres",
 *       "celular": "999111222",
 *       "correo": "ana@mail.com",
 *       "marca": "Toyota",
 *       "modelo": "Yaris",
 *       "placa": "ABC-123",
 *       "distrito": "Miraflores",
 *       "anio": 2019,
 *       "kilometraje": 45000,
 *       "tiene_deuda": "no",
 *       "mensaje": "Quiero venderlo esta semana"
 *     }
 *
 * Si no mandan "tipo", se DEDUCE: si vienen datos de vehículo → venta; si no → compra.
 * Campos opcionales de trazabilidad: pagina_origen, utm_source, utm_medium, utm_campaign.
 *
 * ── RESPUESTA ────────────────────────────────────────────────────────────────
 *   200 → { ok: true, tipo: "venta", id: "uuid", mensaje: "..." }
 *   400 → falta el nombre
 *   401 → api key inválida
 *   405 → método no permitido
 *
 * Log: agent_tool_logs (company_id='tradecars', tool_name='Formulario Web Compra'|'Formulario Web Venta')
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { getMethod } from 'h3'

const API_KEY = 'tradecars-web-2026'

/** Devuelve el primer valor no vacío entre varias claves posibles del body. */
function pick(body: any, ...claves: string[]): string {
  for (const k of claves) {
    const v = body?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** Extrae solo dígitos y devuelve entero (o null). */
function toInt(valor: string): number | null {
  const soloDigitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (!soloDigitos) return null
  const n = parseInt(soloDigitos, 10)
  return Number.isFinite(n) ? n : null
}

/** Normaliza el "¿Tiene deuda?" a 'si' / 'no' (o '' si no vino). */
function normDeuda(valor: any): string {
  if (valor === true) return 'si'
  if (valor === false) return 'no'
  const v = String(valor ?? '').trim().toLowerCase()
  if (!v) return ''
  if (['si', 'sí', 'yes', 'true', '1', 'con deuda'].includes(v)) return 'si'
  if (['no', 'not', 'false', '0', 'sin deuda'].includes(v)) return 'no'
  return v
}

export default defineEventHandler(async (event) => {
  // CORS: permite enviar el formulario también desde el navegador de su web.
  // (Recomendado: enviarlo desde su backend para no exponer la api_key.)
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Max-Age': '86400',
  })

  const metodo = getMethod(event)
  if (metodo === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
  if (metodo !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido. Usa POST.' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({}))
  const query = getQuery(event) as any

  // 1. Autenticación
  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || query?.api_key || body?.api_key
  if (key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Campos comunes (tolerante a cómo los nombre su programador)
  const nombre_completo = pick(body, 'nombre_completo', 'nombres_apellidos', 'nombre', 'nombres', 'name', 'fullname', 'full_name')
  const correo          = pick(body, 'correo', 'correo_electronico', 'email', 'mail', 'e_mail')
  const celular         = pick(body, 'celular', 'celular_contacto', 'telefono', 'phone', 'numero', 'movil', 'tel')
  const mensaje         = pick(body, 'mensaje', 'message', 'comentario', 'comentarios', 'consulta')

  // Datos de vehículo (solo en el form de venta)
  const marca       = pick(body, 'marca', 'brand')
  const modelo      = pick(body, 'modelo', 'model')
  const placa       = pick(body, 'placa', 'plate', 'placa_vehiculo')
  const distrito    = pick(body, 'distrito', 'district', 'ubicacion')
  const anioRaw     = pick(body, 'anio', 'año', 'ano', 'year', 'anio_vehiculo')
  const kmRaw       = pick(body, 'kilometraje', 'km', 'kilometros', 'mileage')
  const tiene_deuda = normDeuda(body?.tiene_deuda ?? body?.deuda ?? body?.tiene_deudas ?? body?.has_debt)

  // 3. Tipo de formulario: explícito o deducido
  let tipo = String(body?.tipo ?? body?.form ?? body?.formulario ?? '').trim().toLowerCase()
  if (tipo === 'vender' || tipo === 'sell' || tipo === 'venta') tipo = 'venta'
  else if (tipo === 'comprar' || tipo === 'buy' || tipo === 'compra') tipo = 'compra'
  else tipo = (marca || modelo || placa || anioRaw || kmRaw) ? 'venta' : 'compra'

  // 4. Validación mínima
  if (!nombre_completo) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el nombre (nombre_completo)' })
  }

  // 5. Trazabilidad de origen
  const meta = {
    origen:        pick(body, 'origen') || 'web',
    pagina_origen: pick(body, 'pagina_origen', 'page', 'url', 'origen_url', 'referrer'),
    utm_source:    pick(body, 'utm_source'),
    utm_medium:    pick(body, 'utm_medium'),
    utm_campaign:  pick(body, 'utm_campaign'),
    ip:            String(getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || '').split(',')[0].trim(),
    user_agent:    String(getHeader(event, 'user-agent') || ''),
    payload:       body,
  }

  const tabla    = tipo === 'venta' ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  const toolName = tipo === 'venta' ? 'Formulario Web Venta' : 'Formulario Web Compra'

  const fila: Record<string, any> = tipo === 'venta'
    ? {
        nombre_completo, celular, correo,
        marca: marca || null,
        modelo: modelo || null,
        placa: placa || null,
        distrito: distrito || null,
        anio: toInt(anioRaw),
        kilometraje: toInt(kmRaw),
        tiene_deuda: tiene_deuda || null,
        mensaje: mensaje || null,
        estado: 'nuevo',
        ...meta,
      }
    : {
        nombre_completo, correo, celular,
        mensaje: mensaje || null,
        estado: 'nuevo',
        ...meta,
      }

  // 6. Guardar
  let nuevoId: string | null = null
  try {
    const { data, error } = await (supabase.from(tabla) as any).insert(fila).select('id').single()
    if (error) throw error
    nuevoId = data?.id ?? null
  } catch (e: any) {
    console.error(`[tradecars/formulario] Error guardando (${tipo}):`, e?.message)
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'tradecars', tool_name: toolName, input_data: body,
        status: 'error', error_message: e?.message ?? 'error guardando',
      })
    } catch {}
    throw createError({ statusCode: 500, statusMessage: `Error guardando la solicitud: ${e?.message}` })
  }

  // 7. Log best-effort (visible en Dev · Agent Logs → Trade Cars)
  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'tradecars',
      tool_name:  toolName,
      input_data: { tipo, nombre_completo, celular, correo, marca, modelo, placa },
      output_data: { id: nuevoId, tabla },
      status: 'success',
    })
  } catch {}

  console.log(`[tradecars/formulario] ${tipo.toUpperCase()} | ${nombre_completo} | ${celular || '-'} | id=${nuevoId}`)

  return {
    ok: true,
    tipo,
    id: nuevoId,
    mensaje: tipo === 'venta'
      ? 'Solicitud de venta registrada correctamente'
      : 'Solicitud de compra registrada correctamente',
  }
})
