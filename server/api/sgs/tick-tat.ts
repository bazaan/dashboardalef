/**
 * /api/sgs/tick-tat — EVENTO 2: correr el reloj TAT
 * (port de DirectorOperaciones.tick_tat)
 *
 * Recalcula el TAT de todos los tickets ACTIVOS (con fecha de ingreso a
 * análisis y resultado aún no listo/leído), persiste el estado nuevo y genera
 * los avisos de escalamiento según la cadena:
 *   por_vencer        → N1 William Ochoa (preventivo)
 *   vencido 0-1 día   → N2 Jahaira Sánchez
 *   vencido >= 2 días → N3 José Ramos
 *
 * Anti-spam: máximo un aviso por (orden + ticket + nivel + día) — índice
 * único en sgs_escalamientos; correr el reloj varias veces al día no duplica.
 *
 * Auth (cualquiera de las dos):
 *   - POST con sesión del dashboard (botón "Correr reloj TAT")
 *   - GET  ?api_key=<SGS_TAT_CRON_KEY>  (para un cron externo; default sgs-tat-2026)
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { calcularTat, armarAviso, verificarSesionSGS } from '../../utils/sgs'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const q = getQuery(event) as any

  // ── Auth: api_key (cron) o sesión (manual) ──
  const cronKey = process.env.SGS_TAT_CRON_KEY || 'sgs-tat-2026'
  let origen = 'cron'
  let quien = 'cron'
  if (q?.api_key === cronKey) {
    origen = 'cron'
  } else {
    const { email } = await verificarSesionSGS(event, supabase)
    origen = 'manual'
    quien = email
  }

  // ── Tickets activos ──
  const { data: activos, error } = await (supabase.from('sgs_tickets') as any)
    .select('*')
    .not('fecha_ingreso_analisis', 'is', null)
    .not('resultado_estado', 'in', '("listo","leido")')
    .limit(2000)
  if (error) throw createError({ statusCode: 500, statusMessage: `Error consultando tickets: ${error.message}` })

  const avisos: any[] = []
  let actualizados = 0

  for (const reg of (activos ?? [])) {
    const tat = calcularTat(reg.fecha_ingreso_analisis, reg.tat_dias || 4)
    if (tat.estado === 'sin_fecha') continue

    // Persiste el estado nuevo si cambió
    if (tat.estado !== reg.tat_estado || tat.dias_restantes !== reg.tat_dias_restantes) {
      await (supabase.from('sgs_tickets') as any)
        .update({ tat_estado: tat.estado, tat_dias_restantes: tat.dias_restantes })
        .eq('id', reg.id)
      actualizados++
    }

    // Aviso de escalamiento si corresponde
    if (tat.alerta) {
      const aviso = armarAviso(reg, tat)
      if (!aviso) continue
      const fila = {
        n_orden: reg.n_orden, n_ticket: reg.n_ticket,
        nivel: aviso.nivel, destinatario: aviso.destinatario, rol: aviso.rol,
        canal: aviso.canal, asunto: aviso.asunto, cuerpo: aviso.cuerpo,
        tat_estado: tat.estado, dias_restantes: tat.dias_restantes, origen,
      }
      // el índice único (orden+ticket+nivel+día) hace el dedupe: ignora conflicto
      const ins = await (supabase.from('sgs_escalamientos') as any)
        .upsert(fila, { onConflict: 'n_orden,n_ticket,nivel,fecha_aviso', ignoreDuplicates: true })
        .select('id')
      const esNuevo = Array.isArray(ins.data) && ins.data.length > 0
      avisos.push({ ...fila, nuevo: esNuevo })
    }
  }

  const nuevos = avisos.filter(a => a.nuevo).length

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Tick TAT',
      input_data: { origen, por: quien },
      output_data: { revisados: (activos ?? []).length, actualizados, avisos: avisos.length, avisos_nuevos: nuevos },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/tick-tat] ${origen} | revisados=${(activos ?? []).length} actualizados=${actualizados} avisos=${avisos.length} (${nuevos} nuevos)`)
  return { ok: true, origen, revisados: (activos ?? []).length, actualizados, avisos }
})
