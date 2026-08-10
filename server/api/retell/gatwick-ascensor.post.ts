/**
 * POST /api/retell/gatwick-ascensor
 *
 * Tool de la LLAMADA (Retell): el cliente dicta el código del sticker
 * (AP-0017, MV-0022…) y esto devuelve el edificio, dirección y distrito para
 * que el bot lo confirme EN VOZ antes de despachar al técnico.
 *
 * Reemplaza a la "base de conocimiento" que el prompt asume: knowledge_base_ids
 * está vacío, así que sin esta tool el bot no puede resolver el código.
 *
 * Auth: header x-api-key: retell-gatwick-2026 (o ?api_key= / body.api_key).
 *
 * Body: { codigo_ascensor: "AP 17" }   ← tal como lo transcribe el STT
 *
 * Respuesta (siempre 200 — un error HTTP cortaría la llamada):
 * {
 *   encontrado: true,
 *   codigo: "AP-0017",
 *   edificio: "EDIFICIO LOS ÁLAMOS",
 *   direccion: "Calle Los Álamos 234",
 *   distrito: "San Isidro",
 *   tipo_equipo: "Ascensor de pasajeros",
 *   confirmacion: "Es el edificio ..., en ..., ... ¿Es correcto?"   ← el bot lo lee tal cual
 * }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverCodigoAscensor, normalizarCodigoAscensor } from '../../utils/gatwick-tracking'

const API_KEY = 'retell-gatwick-2026'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const body = await readBody(event).catch(() => ({} as any))
  const q = getQuery(event) as any

  const key = getHeader(event, 'x-api-key') || getHeader(event, 'X-Api-Key') || q?.api_key || body?.api_key
  if (key !== API_KEY) throw createError({ statusCode: 401, statusMessage: 'API key invalida' })

  const args = body?.args ?? body ?? {}
  const bruto = String(args.codigo_ascensor ?? args.codigo ?? '').trim()

  const log = async (status: string, output: any, error?: string) => {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'gatwick', tool_name: 'Consultar Ascensor',
        input_data: { codigo_dictado: bruto, call_id: body?.call?.call_id ?? args.call_id ?? null },
        output_data: output, status, error_message: error ?? null,
      })
    } catch { /* el log nunca debe tumbar la llamada */ }
  }

  if (!bruto) {
    const r = {
      encontrado: false, motivo: 'sin_codigo',
      confirmacion: 'No alcancé a escuchar el código. ¿Puede dictármelo otra vez, letra por letra?',
    }
    await log('warning', r)
    return r
  }

  const normalizado = normalizarCodigoAscensor(bruto)
  if (!normalizado) {
    const r = {
      encontrado: false, motivo: 'formato_invalido', codigo_dictado: bruto,
      confirmacion: 'Ese código no tiene el formato esperado. Son dos letras y cuatro números, por ejemplo A de Ana, P de Perro, cero, cero, uno, siete. ¿Puede verificar el sticker?',
    }
    await log('warning', r)
    return r
  }

  let hit: any = null
  try {
    hit = await resolverCodigoAscensor(supabase, normalizado)
  } catch (e: any) {
    const r = {
      encontrado: false, motivo: 'error_consulta', codigo: normalizado,
      confirmacion: 'Tuve un problema al consultar el registro. Indíqueme por favor el nombre del edificio.',
    }
    await log('error', r, e?.message)
    return r
  }

  if (!hit) {
    const r = {
      encontrado: false, motivo: 'no_existe', codigo: normalizado,
      confirmacion: `No encuentro el código ${normalizado} en nuestros registros. ¿Puede verificar el sticker y dictarlo otra vez?`,
    }
    await log('warning', r)
    return r
  }

  const ed = hit.edificio
  // Varias direcciones del catálogo ya traen el distrito al final ("Abraham
  // Valdelomar 549, Pueblo Libre"). Repetirlo suena mal dicho en voz alta.
  const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const dirIncluyeDistrito = !!ed.distrito && norm(ed.direccion).includes(norm(ed.distrito))
  const partes = [ed.direccion, dirIncluyeDistrito ? '' : ed.distrito].filter(Boolean).join(', ')
  const r = {
    encontrado: true,
    codigo: hit.codigo,
    edificio: ed.nombre ?? '',
    direccion: ed.direccion ?? '',
    distrito: ed.distrito ?? '',
    elme: ed.elme ?? '',
    tipo_equipo: hit.tipo_equipo ?? '',
    instalacion_critica: !!ed.es_instalacion_critica,
    confirmacion: `Es el edificio ${ed.nombre ?? 'registrado'}${partes ? `, en ${partes}` : ''}. ¿Es correcto?`,
  }
  await log('success', r)
  console.log(`[retell/gatwick-ascensor] ${bruto} → ${hit.codigo} → ${ed.nombre}`)
  return r
})
