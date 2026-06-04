/**
 * POST /api/gatwick/buscar-edificio
 *
 * Tool del agente de emergencias de Gatwick: buscando_edificio.
 * Recibe hasta 5 términos de búsqueda (direccion1..direccion5, mínimo 1) y
 * para cada uno busca en la tabla `gatwick_edificios`. El cliente puede dar
 * el ELME, el nombre, la dirección o el distrito (o una combinación, ej:
 * "los alpes 121").
 *
 * Por cada término devuelve uno de tres estados:
 *   - confirmado    : 1 solo edificio coincide → devuelve sus datos
 *   - ambiguo       : varios coinciden → devuelve la lista para que el agente
 *                     pregunte cuál (ej: "los alpes" → 3 edificios)
 *   - no_encontrado : ninguno coincide
 *
 * Estrategia de match: se normaliza (minúsculas, sin tildes) y se tokeniza el
 * término; un edificio coincide si TODAS las palabras de contenido aparecen en
 * su "haystack" (elme + nombre + dirección + distrito). Así "alpes" trae varios
 * y "alpes 121" reduce a uno.
 *
 * Body:
 * {
 *   api_key:    string,
 *   direccion1: string,   // requerido (al menos uno)
 *   direccion2?: string,
 *   direccion3?: string,
 *   direccion4?: string,
 *   direccion5?: string,
 * }
 *
 * Log: agent_tool_logs (company_id='gatwick', tool_name='buscando_edificio')
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY = 'gatwick-edificio-2026'

// Palabras de relleno que NO deben usarse como filtro obligatorio
// (si una búsqueda queda sin tokens de contenido, se usan igual como fallback)
const STOPWORDS = new Set([
  'los', 'las', 'la', 'el', 'de', 'del', 'y',
  'av', 'av.', 'avenida', 'calle', 'jiron', 'jr', 'jr.', 'pasaje', 'psje', 'psje.',
  'urb', 'urb.', 'urbanizacion', 'urbanización', 'mz', 'mz.', 'nro', 'nro.', 'n', 'n.',
  'edificio', 'edif', 'edif.', 'condominio', 'cond',
])

const MAX_OPCIONES = 8   // tope de opciones a devolver en caso ambiguo

/** minúsculas + sin tildes + espacios colapsados */
function normalize(s: any): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // quita diacríticos (combining marks U+0300–U+036F)
    .replace(/\s+/g, ' ')
    .trim()
}

/** tokens de contenido (quita stopwords; si quedan 0, devuelve todos) */
function tokenize(term: string): string[] {
  const all = normalize(term).split(' ').filter(Boolean)
  const content = all.filter(t => !STOPWORDS.has(t))
  return content.length > 0 ? content : all
}

interface Edificio {
  id: string
  elme: string
  nombre: string
  direccion: string
  distrito: string
  es_instalacion_critica: boolean
  equipos: any
  activo: boolean
}

function haystackDe(e: Edificio): string {
  return normalize(`${e.elme ?? ''} ${e.nombre ?? ''} ${e.direccion ?? ''} ${e.distrito ?? ''}`)
}

function edificioResumen(e: Edificio) {
  return {
    elme: e.elme,
    nombre: e.nombre,
    direccion: e.direccion,
    distrito: e.distrito,
    es_instalacion_critica: e.es_instalacion_critica,
    equipos: e.equipos,
  }
}

function fmtEquipos(equipos: any): string {
  if (!Array.isArray(equipos) || equipos.length === 0) return ''
  return equipos.map((q: any) => {
    const v = q?.variante ? ` (${q.variante})` : ''
    const p = q?.paradas != null ? ` ${q.paradas} paradas` : ''
    return `${q?.tipo ?? 'Equipo'}${p}${v}`
  }).join('; ')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'gatwick',
      tool_name:  'buscando_edificio',
      input_data: body,
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

  // 3. Recolectar los términos (1 a 5)
  const terminos = [body?.direccion1, body?.direccion2, body?.direccion3, body?.direccion4, body?.direccion5]
    .map(t => String(t ?? '').trim())
    .filter(t => t.length > 0)

  if (terminos.length === 0) {
    const msg = 'Falta al menos una dirección (direccion1)'
    return await finish('error', { ok: false, error: 'sin_terminos', mensaje: msg }, msg)
  }

  // 4. Traer todos los edificios activos (son ~160, una sola query alcanza)
  let edificios: Edificio[] = []
  try {
    const { data, error } = await supabase
      .from('gatwick_edificios')
      .select('id, elme, nombre, direccion, distrito, es_instalacion_critica, equipos, activo')
      .eq('activo', true)
      .limit(2000)
    if (error) throw error
    edificios = (data ?? []) as Edificio[]
  } catch (e: any) {
    const msg = `Error consultando gatwick_edificios: ${e?.message}`
    return await finish('error', { ok: false, error: 'error_supabase', mensaje: msg }, msg)
  }

  // Pre-computar haystacks
  const conHaystack = edificios.map(e => ({ e, hay: haystackDe(e) }))

  // 5. Buscar cada término
  const resultados = terminos.map((termino) => {
    const tokens = tokenize(termino)
    const matches = conHaystack
      .filter(({ hay }) => tokens.every(tok => hay.includes(tok)))
      .map(({ e }) => e)

    if (matches.length === 0) {
      return {
        consulta: termino,
        status: 'no_encontrado',
        mensaje: `No encontré ningún edificio que coincida con "${termino}".`,
      }
    }

    if (matches.length === 1) {
      const e = matches[0]
      const equiposTxt = fmtEquipos(e.equipos)
      const critica = e.es_instalacion_critica ? ' ⚠️ INSTALACIÓN CRÍTICA' : ''
      return {
        consulta: termino,
        status: 'confirmado',
        edificio: edificioResumen(e),
        mensaje:
          `✅ Edificio: ${e.nombre} — ${e.direccion}, ${e.distrito} (ELME ${e.elme})` +
          (equiposTxt ? `\nEquipos: ${equiposTxt}` : '') + critica,
      }
    }

    // Ambiguo: varios coinciden
    const opciones = matches.slice(0, MAX_OPCIONES).map(edificioResumen)
    const lista = opciones
      .map((o, i) => `${i + 1}. ${o.nombre} — ${o.direccion}, ${o.distrito} (ELME ${o.elme})`)
      .join('\n')
    const extra = matches.length > MAX_OPCIONES ? `\n…y ${matches.length - MAX_OPCIONES} más. Pide más detalle.` : ''
    return {
      consulta: termino,
      status: 'ambiguo',
      total: matches.length,
      opciones,
      mensaje: `Hay ${matches.length} edificios que coinciden con "${termino}". ¿Cuál es?\n${lista}${extra}`,
    }
  })

  // 6. Mensaje global orientativo para el agente
  const confirmados = resultados.filter(r => r.status === 'confirmado').length
  const ambiguos    = resultados.filter(r => r.status === 'ambiguo').length
  const noEnc       = resultados.filter(r => r.status === 'no_encontrado').length

  const output = {
    ok: true,
    total_consultas: terminos.length,
    confirmados, ambiguos, no_encontrados: noEnc,
    resultados,
    mensaje_global: resultados.map(r => r.mensaje).join('\n\n'),
  }

  await finish('success', output)

  console.log(`[buscar-edificio] Gatwick | ${terminos.length} consulta(s) | ✅${confirmados} ❓${ambiguos} ❌${noEnc}`)

  return output
})
