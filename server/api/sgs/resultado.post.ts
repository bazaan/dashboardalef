/**
 * POST /api/sgs/resultado — EVENTO 3: cambia el semáforo de resultados (E)
 * (port de DirectorOperaciones.actualizar_resultado)
 *
 * Body: { n_orden, n_ticket, estado }  ·  estado ∈ 'no_esta' | 'listo' | 'leido'
 * En el demo/producción inicial es manual (C-Class NO conectado — Regla §1.E).
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionSGS } from '../../utils/sgs'

const ESTADOS = ['no_esta', 'listo', 'leido']
const SEMAFORO: Record<string, [string, string]> = {
  no_esta: ['🔴', 'Resultado no está'],
  listo:   ['🟠', 'Listo para leer'],
  leido:   ['🟢', 'Leído / cerrado'],
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  const nOrden = String(body?.n_orden ?? '').trim().toUpperCase()
  const nTicket = String(body?.n_ticket ?? '').trim().toUpperCase()
  const estado = String(body?.estado ?? '').trim()

  if (!ESTADOS.includes(estado)) {
    throw createError({ statusCode: 400, statusMessage: `Estado inválido: '${estado}' (usa no_esta | listo | leido)` })
  }

  const { data: reg } = await (supabase.from('sgs_tickets') as any)
    .select('id, resultado_estado').eq('n_orden', nOrden).eq('n_ticket', nTicket).maybeSingle()
  if (!reg) {
    throw createError({ statusCode: 404, statusMessage: `Orden/ticket no encontrado: ${nOrden} / ${nTicket}` })
  }

  const { error } = await (supabase.from('sgs_tickets') as any)
    .update({ resultado_estado: estado }).eq('id', reg.id)
  if (error) throw createError({ statusCode: 500, statusMessage: `Error actualizando: ${error.message}` })

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Resultado',
      input_data: { n_orden: nOrden, n_ticket: nTicket, de: reg.resultado_estado, a: estado, por: email },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/resultado] ${nOrden}/${nTicket}: ${reg.resultado_estado} -> ${estado} | por ${email}`)
  return { ok: true, semaforo: SEMAFORO[estado] }
})
