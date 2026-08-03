/**
 * SGS — Motor de SUBLOTES
 * -----------------------
 * El sublote NO se teclea: se calcula acumulando el peso neto de los tickets
 * hasta ~1.000 t y cortando (Regla §4.5 / cambio §2.6 del handoff).
 *
 * Importa porque el TAT del laboratorio es POR SUBLOTE, no por camión (§2.8):
 * un job de laboratorio (Fe, Sizing) cuelga del sublote. Si el TAT viviera en
 * el ticket, un solo análisis dispararía 21 alertas idénticas.
 *
 * Un sublote agrupa tickets de la misma ORDEN y la misma SEDE.
 */
import { SUBLOTE_TM, TAT_DEFAULT, kgATm } from './sgs'

/** Siguiente código libre: SL-001, SL-002… */
async function siguienteCodigo(supabase: any): Promise<string> {
  const { data } = await (supabase.from('sgs_sublotes') as any)
    .select('codigo').order('id', { ascending: false }).limit(1)
  const ultimo = data?.[0]?.codigo || ''
  const m = String(ultimo).match(/SL-(\d+)/)
  const n = m ? parseInt(m[1], 10) + 1 : 1
  return `SL-${String(n).padStart(3, '0')}`
}

/**
 * Devuelve el sublote ABIERTO donde entra este ticket, o crea uno nuevo.
 * Un sublote se cierra cuando llega a la capacidad; el ticket que la supera
 * NO se parte: entra completo y el sublote queda cerrado (así funciona el
 * corte real de SGS, un camión no se divide).
 */
export async function asignarSublote(
  supabase: any,
  ticket: { n_orden?: string | null; sede?: string | null; cliente?: string | null; peso_neto?: number | null },
): Promise<{ id: number; codigo: string } | null> {
  // Sin OL no hay sublote: el ticket está en la bandeja de pendientes y aún no
  // entra al consolidado (§4.1.c).
  if (!ticket.n_orden) return null

  const tm = kgATm(ticket.peso_neto) ?? 0

  // Sublote abierto de la misma orden + sede
  let q = (supabase.from('sgs_sublotes') as any)
    .select('*').eq('cerrado', false).eq('n_orden', ticket.n_orden)
    .order('id', { ascending: true }).limit(1)
  if (ticket.sede) q = q.eq('sede', ticket.sede)
  const { data: abiertos } = await q
  let sub = abiertos?.[0] ?? null

  if (!sub) {
    const codigo = await siguienteCodigo(supabase)
    const { data, error } = await (supabase.from('sgs_sublotes') as any).insert({
      codigo, n_orden: ticket.n_orden, sede: ticket.sede ?? null,
      cliente: ticket.cliente ?? null, capacidad_tm: SUBLOTE_TM, tat_dias: TAT_DEFAULT,
    }).select('*').single()
    if (error) throw new Error(`No se pudo crear el sublote: ${error.message}`)
    sub = data
  }

  const nuevoPeso = Number(sub.peso_neto_tm || 0) + tm
  await (supabase.from('sgs_sublotes') as any).update({
    peso_neto_tm: Math.round(nuevoPeso * 1000) / 1000,
    tickets_count: Number(sub.tickets_count || 0) + 1,
    // Al alcanzar la capacidad se cierra: el siguiente camión abre otro sublote
    cerrado: nuevoPeso >= Number(sub.capacidad_tm || SUBLOTE_TM),
  }).eq('id', sub.id)

  return { id: sub.id, codigo: sub.codigo }
}

/** Recalcula el acumulado de un sublote desde sus tickets (tras editar o quitar uno). */
export async function recalcularSublote(supabase: any, subloteId: number): Promise<void> {
  const { data: tks } = await (supabase.from('sgs_tickets') as any)
    .select('peso_neto_tm').eq('sublote_id', subloteId)
  const filas = tks || []
  const total = filas.reduce((s: number, t: any) => s + Number(t.peso_neto_tm || 0), 0)

  const { data: sub } = await (supabase.from('sgs_sublotes') as any)
    .select('capacidad_tm').eq('id', subloteId).maybeSingle()

  await (supabase.from('sgs_sublotes') as any).update({
    peso_neto_tm: Math.round(total * 1000) / 1000,
    tickets_count: filas.length,
    cerrado: total >= Number(sub?.capacidad_tm || SUBLOTE_TM),
  }).eq('id', subloteId)
}

/** Texto de avance para la UI: "SL-003 · 531/1000 t (11 camiones)". */
export function resumenSublote(sub: any): string {
  if (!sub) return '—'
  const p = Number(sub.peso_neto_tm || 0).toFixed(0)
  const c = Number(sub.capacidad_tm || SUBLOTE_TM).toFixed(0)
  return `${sub.codigo} · ${p}/${c} t (${sub.tickets_count || 0} camiones)`
}
