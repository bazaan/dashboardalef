/**
 * POST /api/sgs/sublote-analisis
 *
 * §2.3 — "REGISTRAR INGRESO A ANÁLISIS" POR SUBLOTE.
 * Sin esto el motor TAT nunca arranca: hoy todos los tickets quedan en
 * "sin fecha" y por lo tanto NUNCA alertan.
 *
 * Sella de una vez TODOS los tickets del sublote (no camión por camión), que
 * es como funciona en la realidad: el laboratorio recibe la muestra del
 * sublote, no de cada camión.
 *
 * Body: {
 *   sublote_id,
 *   fecha_ingreso_analisis?,   // por defecto hoy
 *   tat_dias?,                 // por defecto el del sublote (4)
 *   job_laboratorio?,          // 'Fe', 'Sizing'…
 *   cerrar?                    // cerrar el sublote aunque no llegue a 1.000 t
 * }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionSGS, calcularTat, parseFecha, isoDia, TAT_DEFAULT } from '../../utils/sgs'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  const subloteId = Number(body?.sublote_id)
  if (!Number.isFinite(subloteId)) {
    throw createError({ statusCode: 400, statusMessage: 'Falta sublote_id' })
  }

  const { data: sub } = await (supabase.from('sgs_sublotes') as any)
    .select('*').eq('id', subloteId).maybeSingle()
  if (!sub) throw createError({ statusCode: 404, statusMessage: 'Sublote no encontrado' })

  // Fecha de ingreso a análisis: la que manden, o hoy
  const f = body?.fecha_ingreso_analisis ? parseFecha(body.fecha_ingreso_analisis) : new Date()
  if (!f) {
    throw createError({ statusCode: 400, statusMessage: `Fecha inválida: ${body.fecha_ingreso_analisis}` })
  }
  const fecha = isoDia(f)
  const tatDias = Number(body?.tat_dias) > 0 ? Math.round(Number(body.tat_dias)) : (sub.tat_dias || TAT_DEFAULT)

  // El reloj corre desde acá
  const tat = calcularTat(fecha, tatDias)

  const patchSub: Record<string, any> = {
    fecha_ingreso_analisis: fecha,
    tat_dias: tatDias,
    tat_estado: tat.estado,
    tat_dias_restantes: tat.dias_restantes,
    analisis_registrado_por: email,
  }
  if (body?.job_laboratorio) patchSub.job_laboratorio = String(body.job_laboratorio).trim()
  if (body?.cerrar === true) patchSub.cerrado = true

  const { data: subAct, error } = await (supabase.from('sgs_sublotes') as any)
    .update(patchSub).eq('id', subloteId).select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error actualizando el sublote: ${error.message}` })

  // ── Sella TODOS los tickets del sublote de una vez ──
  const { data: tickets, error: eTk } = await (supabase.from('sgs_tickets') as any)
    .update({
      fecha_ingreso_analisis: fecha,
      tat_dias: tatDias,
      tat_estado: tat.estado,
      tat_dias_restantes: tat.dias_restantes,
    })
    .eq('sublote_id', subloteId)
    .select('id')
  if (eTk) throw createError({ statusCode: 500, statusMessage: `Error sellando los tickets: ${eTk.message}` })

  const sellados = (tickets || []).length

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Ingreso a Analisis',
      input_data: {
        sublote: sub.codigo, fecha, tat_dias: tatDias,
        job: patchSub.job_laboratorio ?? null, por: email,
      },
      output_data: {
        tickets_sellados: sellados, tat_estado: tat.estado,
        vence: tat.fecha_vencimiento, dias_restantes: tat.dias_restantes,
      },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/sublote-analisis] ${sub.codigo} | ${fecha} | TAT ${tatDias}d -> ${tat.estado} | ${sellados} tickets sellados | por ${email}`)
  return { ok: true, sublote: subAct, tickets_sellados: sellados, tat }
})
