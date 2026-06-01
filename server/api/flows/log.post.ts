/**
 * POST /api/flows/log
 *
 * Logger genérico multi-empresa para los flujos de n8n. Sirve para DOS cosas
 * y ambas aparecen automáticamente en el dashboard de Alef → "Dev · Agent Logs"
 * (porque escribe en agent_tool_logs, que ese panel ya lee y filtra por empresa):
 *
 *   1) REGISTRO DE ERRORES  (kind: "error")
 *      Llamado desde un workflow "Error Handler" de n8n (nodo Error Trigger).
 *      Guarda el error con tool_name = "Registro de Errores".
 *
 *   2) REPORTE DE TOKENS    (kind: "execution")
 *      Llamado al final de cada flujo con el consumo de tokens de esa ejecución.
 *      Guarda con tool_name = "Reporte de Tokens".
 *
 * La empresa se resuelve de `company_id` si viene; si no, se deduce del
 * `flow_name` por palabras clave (ej: "HEALUP - agendar" → healup).
 *
 * Auth: body.api_key === FLOW_LOG_API_KEY (env, default abajo).
 *
 * Body esperado (todo opcional salvo api_key):
 * {
 *   "api_key":          "flow-log-2026",
 *   "company_id":       "healup",                  // opcional; si falta se deduce de flow_name
 *   "flow_name":        "HEALUP - Agendar cita",   // nombre del workflow n8n
 *   "kind":             "error" | "execution",     // opcional; se infiere
 *   "tool_name":        "Registro de Errores",     // opcional; default según kind
 *   "status":           "error" | "success" | "partial", // opcional; default según kind
 *   "error_message":    "string",                  // para errores
 *   "node_name":        "OpenAI Chat",             // nodo donde falló (opcional)
 *   "n8n_execution_id": "12345",                   // opcional, para trazabilidad
 *   "execution_url":    "https://.../execution/12345", // opcional
 *   "input":            { ... },                   // contexto/entrada (cualquier JSON)
 *   "output":           { ... },                   // salida (cualquier JSON)
 *   "tokens":           { "prompt": 1200, "completion": 340, "total": 1540, "model": "gpt-4o" },
 *   "duration_ms":      8230                        // opcional
 * }
 *
 * Respuesta:
 * { ok, id, company_id, tool_name, whatsapp_message }
 *   - whatsapp_message: texto ya formateado, listo para reenviar a Chatwoot/WhatsApp.
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = process.env.FLOW_LOG_API_KEY || 'flow-log-2026'

/** Slugs de empresa tal como los usa el dashboard (devCompanies en AlefCompany.vue). */
const COMPANY_KEYWORDS: Array<[RegExp, string]> = [
  [/heal\s*up|healup/i,                'healup'],
  [/suerte|estasconsuerte|\becs\b/i,   'estasconsuerte'],
  [/brada/i,                           'brada'],
  [/estetika/i,                        'estetikamedika'],
  [/davila|dávila/i,                   'davila'],
  [/solari/i,                          'solari'],
  [/\bskip\b/i,                        'skip'],
  [/alegrated|importamaster/i,         'alegrated'],
  [/origitec/i,                        'origitec'],
  [/gatwick/i,                         'gatwick'],
]

const KNOWN_SLUGS = new Set(COMPANY_KEYWORDS.map(([, s]) => s))

/** Normaliza un company_id o, si no, deduce la empresa del nombre del flujo. */
function resolveCompany(companyId?: string, flowName?: string): string {
  const raw = String(companyId ?? '').toLowerCase().trim()
  if (raw) {
    if (KNOWN_SLUGS.has(raw)) return raw
    for (const [re, slug] of COMPANY_KEYWORDS) if (re.test(raw)) return slug
  }
  const fn = String(flowName ?? '')
  for (const [re, slug] of COMPANY_KEYWORDS) if (re.test(fn)) return slug
  return raw || 'sin-empresa'
}

function num(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<any>(event).catch(() => ({})) || {}

  if (body.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'api_key inválida' })
  }

  // ── Resolver tipo, empresa, tool y status ─────────────────────────────────
  const kind: 'error' | 'execution' =
    body.kind === 'execution' ? 'execution'
    : body.kind === 'error' ? 'error'
    : (body.error_message || body.error) ? 'error' : 'execution'

  const company_id = resolveCompany(body.company_id, body.flow_name)

  const tool_name =
    body.tool_name ||
    (kind === 'error' ? 'Registro de Errores' : 'Reporte de Tokens')

  const status =
    body.status ||
    (kind === 'error' ? 'error' : 'success')

  const error_message =
    kind === 'error'
      ? String(body.error_message || body.error || 'Error sin mensaje')
      : (body.error_message || null)

  // ── Tokens ────────────────────────────────────────────────────────────────
  let tokens: Record<string, any> | null = null
  let tokens_total: number | null = null
  if (body.tokens && typeof body.tokens === 'object') {
    const prompt = num(body.tokens.prompt ?? body.tokens.prompt_tokens ?? body.tokens.input)
    const completion = num(body.tokens.completion ?? body.tokens.completion_tokens ?? body.tokens.output)
    const total = num(body.tokens.total ?? body.tokens.total_tokens) ??
      ((prompt ?? 0) + (completion ?? 0) || null)
    tokens = {
      prompt, completion, total,
      model: body.tokens.model ?? body.model ?? null,
    }
    tokens_total = total
  } else if (num(body.tokens_total) !== null) {
    tokens_total = num(body.tokens_total)
    tokens = { total: tokens_total, model: body.model ?? null }
  }

  // input/output: aceptamos input/output o input_data/output_data
  const input_data = body.input_data ?? body.input ?? {
    flow_name: body.flow_name ?? null,
    node_name: body.node_name ?? null,
    n8n_execution_id: body.n8n_execution_id ?? null,
    execution_url: body.execution_url ?? null,
  }
  const output_data = body.output_data ?? body.output ?? null

  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('agent_tool_logs')
    .insert({
      company_id,
      tool_name,
      status,
      error_message,
      input_data,
      output_data,
      duration_ms: num(body.duration_ms),
      flow_name: body.flow_name ?? null,
      node_name: body.node_name ?? null,
      n8n_execution_id: body.n8n_execution_id != null ? String(body.n8n_execution_id) : null,
      tokens,
      tokens_total,
    })
    .select('id')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `No se pudo guardar el log: ${error.message}` })
  }

  // ── Mensaje listo para WhatsApp/Chatwoot ──────────────────────────────────
  const empresaLabel = company_id.toUpperCase()
  let whatsapp_message: string
  if (kind === 'error') {
    whatsapp_message =
      `🔴 *Error en flujo n8n* (${empresaLabel})\n` +
      `*Flujo:* ${body.flow_name ?? '—'}\n` +
      (body.node_name ? `*Nodo:* ${body.node_name}\n` : '') +
      `*Error:* ${error_message}\n` +
      (body.n8n_execution_id ? `*Ejecución:* ${body.n8n_execution_id}\n` : '') +
      `🕒 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
  } else {
    whatsapp_message =
      `🟢 *Ejecución completada* (${empresaLabel})\n` +
      `*Flujo:* ${body.flow_name ?? '—'}\n` +
      (tokens_total != null ? `*Tokens:* ${tokens_total}` +
        (tokens?.prompt != null || tokens?.completion != null
          ? ` (prompt ${tokens?.prompt ?? '—'} / completion ${tokens?.completion ?? '—'})` : '') +
        (tokens?.model ? `\n*Modelo:* ${tokens.model}` : '') + `\n`
        : '') +
      (body.duration_ms ? `*Duración:* ${(Number(body.duration_ms) / 1000).toFixed(1)}s\n` : '') +
      `🕒 ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`
  }

  return { ok: true, id: data?.id ?? null, company_id, tool_name, whatsapp_message }
})
