/**
 * Trade Cars — asignación MASIVA de asesor a los leads pendientes (backfill), 29/09/2026.
 *
 * A diferencia de la asignación EN VIVO (`asignarNuevosLeads` en tradecars-formularios.ts, que
 * asigna de a poco en cada carga de página, con un tope para no colgar la petición), esto procesa
 * TODO el backlog de una sola vez, con consultas en LOTE (no una por lead) — pensado para usarse
 * una vez después de correr `sql/tradecars_formularios_asignacion.sql`, cuando hay miles de leads
 * ya en la hoja/las tablas sin asesor asignado todavía.
 *
 * Se dispara con POST /api/tradecars/formularios { accion: 'asignar_pendientes' } (Administrador).
 */

import { normalizarTelefonoAsesor } from './tradecars-asignacion'
import { leerHojaGoogle, leerEstados, type ConfigHoja } from './tradecars-formularios'
import { canalDePlataforma, hojaALeads, type CanalFormulario } from '../../utils/tradecarsFormularios'

const TAMANO_LOTE = 500

interface Asesor { nombre: string; email: string }

async function cargarAsesoresActivos(supabase: any): Promise<Asesor[]> {
  const { data } = await supabase.from('tradecars_asesores').select('nombre, email, orden').eq('activo', true).order('orden')
  return data || []
}

async function leerIndiceRR(supabase: any): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'tradecars_formularios_rr_index').maybeSingle()
  return parseInt(data?.value || '0', 10) || 0
}

async function guardarIndiceRR(supabase: any, indice: number): Promise<void> {
  await supabase.from('app_settings').upsert(
    { key: 'tradecars_formularios_rr_index', value: String(indice), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

/** Busca, EN LOTES, el asesor previo (por continuidad de teléfono) para una lista de teléfonos. */
async function buscarAsesorPrevioPorTelefono(supabase: any, telefonos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  for (let i = 0; i < telefonos.length; i += TAMANO_LOTE) {
    const lote = telefonos.slice(i, i + TAMANO_LOTE)
    const { data } = await supabase
      .from('tradecars_leads_chatwoot')
      .select('telefono, asesor_asignado, created_at')
      .in('telefono', lote)
      .not('asesor_asignado', 'is', null)
      .order('created_at', { ascending: false })
    // Filas ya vienen de más reciente a más antiguo: la primera vez que se ve cada teléfono es la más nueva.
    for (const fila of data || []) {
      if (!mapa.has(fila.telefono)) mapa.set(fila.telefono, fila.asesor_asignado)
    }
  }
  return mapa
}

export interface ResultadoAsignacionCanal {
  ok: boolean
  asignados: number
  total_pendientes: number
  motivo?: string
}

/**
 * Asigna asesor a los leads de UN canal que todavía no tienen fila en tradecars_formularios_estado.
 *
 * `maxPorLlamada` (opcional): si el canal tiene un backlog grande (ej. "sin_plataforma" con miles de
 * leads), procesar TODO en una sola llamada puede superar el tiempo máximo de una función de Netlify
 * (~30s) — probado en vivo: una llamada sin tope cortó a los 30.8s con 502. Con este límite, cada
 * llamada procesa como mucho esa cantidad y devuelve `total_pendientes` con lo que TODAVÍA falta —
 * quien llama repite la llamada hasta que dé 0, controlando el tamaño del lote desde afuera.
 */
export async function asignarPendientesCanal(
  supabase: any, canal: CanalFormulario, config: ConfigHoja, maxPorLlamada?: number,
): Promise<ResultadoAsignacionCanal> {
  if (!config.sheet_id) return { ok: false, asignados: 0, total_pendientes: 0, motivo: 'sin_hoja' }

  const hoja = await leerHojaGoogle({ sheetId: config.sheet_id, pestana: config.pestana, gid: config.gid })
  const r = hojaALeads(hoja.valores, config.mapeo, canal)
  const delCanal = r.leads.filter(l => (canalDePlataforma(l.plataforma) || 'sin_plataforma') === canal)

  const { estados, disponible } = await leerEstados(supabase, canal)
  if (!disponible) return { ok: false, asignados: 0, total_pendientes: 0, motivo: 'tabla_no_disponible' }

  const pendientesTodos = delCanal.filter(l => !estados.has(l.lead_key))
  if (!pendientesTodos.length) return { ok: true, asignados: 0, total_pendientes: 0 }
  const pendientes = maxPorLlamada ? pendientesTodos.slice(0, maxPorLlamada) : pendientesTodos
  const quedanPendientes = pendientesTodos.length - pendientes.length

  const asesoresActivos = await cargarAsesoresActivos(supabase)
  const asesorPorNombre = new Map(asesoresActivos.map(a => [a.nombre.toLowerCase(), a]))

  const telefonos = [...new Set(pendientes.map(l => normalizarTelefonoAsesor(l.celular)).filter(Boolean))]
  const asesorPorTelefono = await buscarAsesorPrevioPorTelefono(supabase, telefonos)

  let indiceRR = asesoresActivos.length > 0 ? await leerIndiceRR(supabase) : 0

  const filas: any[] = []
  for (const l of pendientes) {
    const telefono = normalizarTelefonoAsesor(l.celular)
    let asesor: Asesor | null = null

    const nombrePrevio = telefono ? asesorPorTelefono.get(telefono) : undefined
    if (nombrePrevio) asesor = asesorPorNombre.get(nombrePrevio.toLowerCase()) || null

    if (!asesor && asesoresActivos.length > 0) {
      indiceRR++
      asesor = asesoresActivos[(indiceRR - 1) % asesoresActivos.length]
    }

    filas.push({
      canal, lead_key: l.lead_key, estado: 'nuevo', notas: null, precio_ofrecido: null, cliente_id: null,
      atendido_por: null, atendido_en: null,
      resumen: { fecha: l.fecha, nombre: l.nombre, celular: l.celular, correo: l.correo, marca: l.marca, modelo: l.modelo, placa: l.placa },
      asesor_nombre: asesor?.nombre ?? null, asesor_email: asesor?.email ?? null,
    })
  }

  if (asesoresActivos.length > 0 && indiceRR > 0) await guardarIndiceRR(supabase, indiceRR)

  let asignados = 0
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE)
    const { error } = await supabase.from('tradecars_formularios_estado')
      .upsert(lote, { onConflict: 'canal,lead_key', ignoreDuplicates: true })
    if (!error) asignados += lote.length
  }

  // `total_pendientes` es lo que TODAVÍA queda después de esta llamada (no lo que había antes) —
  // así quien llama sabe si tiene que repetir la llamada (>0) o ya terminó (0).
  return { ok: true, asignados, total_pendientes: quedanPendientes }
}

/** Asigna asesor a las solicitudes de "Formularios web" (venta/compra) que todavía no lo tienen. */
export async function asignarPendientesSolicitudesWeb(supabase: any): Promise<{ ok: boolean; asignados: number }> {
  const asesoresActivos = await cargarAsesoresActivos(supabase)
  const asesorPorNombre = new Map(asesoresActivos.map(a => [a.nombre.toLowerCase(), a]))
  let indiceRR = asesoresActivos.length > 0 ? await leerIndiceRR(supabase) : 0

  let totalAsignados = 0
  for (const tabla of ['tradecars_solicitudes_venta', 'tradecars_solicitudes_compra']) {
    const { data: filas } = await supabase.from(tabla).select('id, celular').is('asesor_email', null)
    if (!filas?.length) continue

    const telefonos = [...new Set(filas.map((f: any) => normalizarTelefonoAsesor(f.celular)).filter(Boolean))] as string[]
    const asesorPorTelefono = await buscarAsesorPrevioPorTelefono(supabase, telefonos)

    for (const fila of filas) {
      const telefono = normalizarTelefonoAsesor(fila.celular)
      let asesor: Asesor | null = null
      const nombrePrevio = telefono ? asesorPorTelefono.get(telefono) : undefined
      if (nombrePrevio) asesor = asesorPorNombre.get(nombrePrevio.toLowerCase()) || null
      if (!asesor && asesoresActivos.length > 0) {
        indiceRR++
        asesor = asesoresActivos[(indiceRR - 1) % asesoresActivos.length]
      }
      if (asesor) {
        await supabase.from(tabla).update({ asesor_nombre: asesor.nombre, asesor_email: asesor.email }).eq('id', fila.id)
        totalAsignados++
      }
    }
  }

  if (asesoresActivos.length > 0 && indiceRR > 0) await guardarIndiceRR(supabase, indiceRR)
  return { ok: true, asignados: totalAsignados }
}
