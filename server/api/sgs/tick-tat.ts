/**
 * /api/sgs/tick-tat — correr el reloj TAT
 *
 * CAMBIO v2 (§2.8): el TAT es POR SUBLOTE (= por job de laboratorio), NO por
 * ticket. En el Excel de SGS un job (Fe, Sizing) cuelga del sublote, no del
 * camión. Si se alertara por ticket, un solo análisis vencido dispararía 21
 * avisos idénticos.
 *
 * Recalcula cada sublote con análisis iniciado y resultado pendiente, propaga
 * el estado a sus tickets (para que la tabla muestre el semáforo) y genera UN
 * aviso de escalamiento por sublote:
 *   por_vencer        → N1 William Ochoa (preventivo)
 *   vencido 0-1 día   → N2 Jahaira Sánchez
 *   vencido ≥2 días   → N3 José Ramos
 *
 * Auth: POST con sesión, o GET ?api_key=<SGS_TAT_CRON_KEY> para un cron.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { calcularTat, verificarSesionSGS } from '../../utils/sgs'

const CADENA = [
  { nivel: 1, nombre: 'William Ochoa', rol: 'Coordinación / recepción' },
  { nivel: 2, nombre: 'Jahaira Sánchez', rol: 'Analista' },
  { nivel: 3, nombre: 'José Ramos', rol: 'Jefe de laboratorio' },
]

function destinatario(tat: any) {
  if (tat.estado === 'por_vencer') return CADENA[0]
  if (tat.estado === 'vencido') return (tat.dias_vencido ?? 0) >= 2 ? CADENA[2] : CADENA[1]
  return null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const q = getQuery(event) as any

  const cronKey = process.env.SGS_TAT_CRON_KEY || 'sgs-tat-2026'
  let origen = 'cron', quien = 'cron'
  if (q?.api_key !== cronKey) {
    const { email } = await verificarSesionSGS(event, supabase)
    origen = 'manual'; quien = email
  }

  // Sublotes con el reloj corriendo y sin resultado leído
  const { data: sublotes, error } = await (supabase.from('sgs_sublotes') as any)
    .select('*')
    .not('fecha_ingreso_analisis', 'is', null)
    .not('resultado_estado', 'in', '("leido")')
    .limit(1000)
  if (error) throw createError({ statusCode: 500, statusMessage: `Error consultando sublotes: ${error.message}` })

  const avisos: any[] = []
  let actualizados = 0, ticketsSincronizados = 0

  for (const sub of (sublotes ?? [])) {
    const tat = calcularTat(sub.fecha_ingreso_analisis, sub.tat_dias || 4)
    if (tat.estado === 'sin_fecha') continue

    if (tat.estado !== sub.tat_estado || tat.dias_restantes !== sub.tat_dias_restantes) {
      await (supabase.from('sgs_sublotes') as any)
        .update({ tat_estado: tat.estado, tat_dias_restantes: tat.dias_restantes })
        .eq('id', sub.id)
      // El semáforo de la tabla de tickets refleja el del sublote
      const { data: tks } = await (supabase.from('sgs_tickets') as any)
        .update({ tat_estado: tat.estado, tat_dias_restantes: tat.dias_restantes })
        .eq('sublote_id', sub.id).select('id')
      ticketsSincronizados += (tks || []).length
      actualizados++
    }

    if (!tat.alerta) continue
    const dest = destinatario(tat)
    if (!dest) continue

    const urg = tat.estado === 'por_vencer'
      ? `VENCE MAÑANA (${tat.fecha_vencimiento})`
      : `VENCIDO hace ${tat.dias_vencido} día(s) (venció ${tat.fecha_vencimiento})`

    const fila = {
      // Se referencia el sublote, que es la unidad real de análisis
      n_orden: sub.n_orden || '—',
      n_ticket: sub.codigo,
      nivel: dest.nivel, destinatario: dest.nombre, rol: dest.rol,
      canal: 'correo institucional',
      asunto: tat.estado === 'por_vencer'
        ? `[TAT] Aviso preventivo — sublote ${sub.codigo} vence ${tat.fecha_vencimiento}`
        : `[TAT] ESCALAMIENTO N${dest.nivel} — sublote ${sub.codigo} vencido`,
      cuerpo:
        `Para: ${dest.nombre} (${dest.rol})\n` +
        `Canal: correo institucional\n\n` +
        `El análisis del sublote ${sub.codigo}` +
        (sub.n_orden ? ` (orden ${sub.n_orden}` : ' (') +
        (sub.cliente ? ` · ${sub.cliente}` : '') +
        `${sub.sede ? ` · ${sub.sede}` : ''}) está ${urg}.\n` +
        `Sublote: ${Number(sub.peso_neto_tm || 0).toFixed(1)} t en ${sub.tickets_count || 0} camiones` +
        (sub.job_laboratorio ? ` · job ${sub.job_laboratorio}` : '') + `.\n` +
        `Ingreso a análisis: ${tat.fecha_ingreso} · TAT ${tat.tat_dias} días calendario.\n` +
        `Días restantes: ${tat.dias_restantes}.\n` +
        `Acción: priorizar la emisión del resultado para cumplir el TAT.`,
      tat_estado: tat.estado, dias_restantes: tat.dias_restantes, origen,
    }

    const ins = await (supabase.from('sgs_escalamientos') as any)
      .upsert(fila, { onConflict: 'n_orden,n_ticket,nivel,fecha_aviso', ignoreDuplicates: true })
      .select('id')
    avisos.push({ ...fila, sublote: sub.codigo, nuevo: Array.isArray(ins.data) && ins.data.length > 0 })
  }

  const nuevos = avisos.filter(a => a.nuevo).length

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Tick TAT',
      input_data: { origen, por: quien },
      output_data: {
        sublotes_revisados: (sublotes ?? []).length, actualizados,
        tickets_sincronizados: ticketsSincronizados,
        avisos: avisos.length, avisos_nuevos: nuevos,
      },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/tick-tat] ${origen} | sublotes=${(sublotes ?? []).length} actualizados=${actualizados} tickets=${ticketsSincronizados} avisos=${avisos.length} (${nuevos} nuevos)`)
  return {
    ok: true, origen,
    sublotes_revisados: (sublotes ?? []).length,
    actualizados, tickets_sincronizados: ticketsSincronizados, avisos,
  }
})
