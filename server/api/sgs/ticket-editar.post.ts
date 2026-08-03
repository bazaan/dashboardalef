/**
 * POST /api/sgs/ticket-editar
 *
 * §4.8 — TODO REGISTRO ES EDITABLE DESPUÉS. Ningún campo faltante impide el
 * ingreso; se completa acá: OL, calidad, fechas de laboratorio, lo que sea.
 *
 * Caso especial — ASIGNAR EL OL a un ticket PENDIENTE_OL:
 *   al recibir un n_orden válido, el ticket entra por el flujo normal
 *   (anti-duplicados + sublote) y pasa a 'catalogado'.
 *
 * Cada cambio queda en sgs_ticket_ediciones: en un sistema de trazabilidad
 * hay que poder decir quién cambió qué y cuándo.
 *
 * Body: { id, cambios: { campo: valor, ... } }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { validarLlave, verificarSesionSGS, derivarSede, kgATm, parseFecha, isoDia, supervisar } from '../../utils/sgs'
import { asignarSublote, recalcularSublote } from '../../utils/sgs-sublotes'

// Lista blanca: lo que se puede editar desde la UI (nada de ids ni sellos)
const EDITABLES = [
  'n_orden', 'n_ticket', 'guia_remision',
  'placa', 'carreta', 'transportista', 'ruc_transportista', 'chofer', 'brevete', 'nro_ejes',
  'emisor', 'ruc_emisor', 'cliente',
  'cod_material', 'material', 'calidad_material', 'origen', 'destino', 'almacen', 'sede',
  'fecha', 'fecha_ingreso', 'hora_ingreso', 'fecha_salida', 'hora_salida',
  'peso_bruto', 'tara', 'peso_neto',
  'balanza2_nombre', 'balanza2_bruto', 'balanza2_tara', 'balanza2_neto',
  'nave', 'bl_ne', 'item_bl', 'regimen', 'bultos',
  'fecha_ingreso_analisis', 'tat_dias', 'resultado_estado',
  'observaciones_ticket',
]

const NUMERICOS = ['peso_bruto', 'tara', 'peso_neto', 'balanza2_bruto', 'balanza2_tara', 'balanza2_neto', 'tat_dias']
const FECHAS = ['fecha_ingreso', 'fecha_salida', 'fecha_ingreso_analisis']

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  const id = Number(body?.id)
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'Falta el id del ticket' })
  const cambios = body?.cambios
  if (!cambios || typeof cambios !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Falta el objeto "cambios"' })
  }

  const { data: actual } = await (supabase.from('sgs_tickets') as any).select('*').eq('id', id).maybeSingle()
  if (!actual) throw createError({ statusCode: 404, statusMessage: 'Ticket no encontrado' })

  // ── Normalizar y filtrar por la lista blanca ──
  const patch: Record<string, any> = {}
  for (const [campo, valorCrudo] of Object.entries(cambios)) {
    if (!EDITABLES.includes(campo)) continue
    let v: any = valorCrudo

    if (v === '' || v === undefined) v = null
    else if (NUMERICOS.includes(campo)) {
      const n = parseFloat(String(v).replace(/,/g, ''))
      v = Number.isFinite(n) ? n : null
    } else if (FECHAS.includes(campo) && v) {
      const f = parseFecha(v)
      if (!f) throw createError({ statusCode: 400, statusMessage: `Fecha inválida en "${campo}": ${v}` })
      v = isoDia(f)
    } else if (typeof v === 'string') {
      v = v.trim() || null
      if (['placa', 'carreta', 'n_ticket'].includes(campo) && v) v = v.toUpperCase()
    }
    patch[campo] = v
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'No hay cambios válidos que aplicar' })
  }

  // ── Caso especial: asignar el OL a un pendiente ──
  let subloteNuevo: any = null
  if ('n_orden' in patch) {
    if (patch.n_orden) {
      const llave = validarLlave(patch.n_orden)
      if (!llave.ok) throw createError({ statusCode: 400, statusMessage: llave.motivo })
      patch.n_orden = llave.orden

      // §4.4 no puede chocar con un ticket ya catalogado con esa orden
      const { data: choque } = await (supabase.from('sgs_tickets') as any)
        .select('id').eq('n_orden', llave.orden).eq('n_ticket', patch.n_ticket ?? actual.n_ticket)
        .neq('id', id).maybeSingle()
      if (choque) {
        throw createError({
          statusCode: 409,
          statusMessage: `Ya existe otro ticket ${patch.n_ticket ?? actual.n_ticket} en la orden ${llave.orden}`,
        })
      }
      patch.estado = 'catalogado'
    } else {
      // Le quitaron el OL: vuelve a la bandeja de pendientes
      patch.estado = 'pendiente_ol'
      patch.sublote_id = null
    }
  }

  // ── Derivados: se recalculan solos (§4.10) ──
  if ('destino' in patch) {
    const sede = derivarSede(patch.destino)
    if (sede) patch.sede = sede
  }
  if ('peso_neto' in patch) patch.peso_neto_tm = kgATm(patch.peso_neto)

  // Supervisor: se vuelve a opinar sobre el registro corregido
  const fusionado = { ...actual, ...patch }
  const veredicto = supervisar(fusionado)
  patch.supervision = veredicto.veredicto
  patch.supervision_severidad = veredicto.veredicto === 'revisar' ? veredicto.severidad : null
  patch.supervision_obs = veredicto.observaciones.join('; ') || null

  patch.editado_por = email
  patch.editado_en = new Date().toISOString()

  // ── Guardar ──
  const { data: guardado, error } = await (supabase.from('sgs_tickets') as any)
    .update(patch).eq('id', id).select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error guardando: ${error.message}` })

  // ── Sublote: si acaba de recibir OL, se le asigna uno ──
  if (patch.estado === 'catalogado' && !guardado.sublote_id) {
    try {
      subloteNuevo = await asignarSublote(supabase, {
        n_orden: guardado.n_orden, sede: guardado.sede,
        cliente: guardado.cliente, peso_neto: guardado.peso_neto,
      })
      if (subloteNuevo) {
        await (supabase.from('sgs_tickets') as any).update({ sublote_id: subloteNuevo.id }).eq('id', id)
      }
    } catch (e: any) {
      console.error('[sgs/ticket-editar] sublote:', e?.message)
    }
  } else if ('peso_neto' in patch && actual.sublote_id) {
    // Cambió el peso: el acumulado del sublote deja de cuadrar
    await recalcularSublote(supabase, actual.sublote_id).catch(() => {})
  }

  // ── Historial de ediciones (trazabilidad) ──
  const filas = Object.keys(patch)
    .filter(c => EDITABLES.includes(c) && String(actual[c] ?? '') !== String(patch[c] ?? ''))
    .map(c => ({
      ticket_id: id, campo: c,
      valor_antes: actual[c] === null || actual[c] === undefined ? null : String(actual[c]),
      valor_despues: patch[c] === null ? null : String(patch[c]),
      editado_por: email,
    }))
  if (filas.length) {
    try { await supabase.from('sgs_ticket_ediciones').insert(filas) } catch {}
  }

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Editar Ticket',
      input_data: { ticket_id: id, campos: filas.map(f => f.campo), por: email },
      output_data: { estado: guardado.estado, sublote: subloteNuevo?.codigo ?? null },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/ticket-editar] #${id} | ${filas.length} campo(s) | estado=${guardado.estado} | por ${email}`)
  return { ok: true, ticket: guardado, cambios: filas.length, sublote: subloteNuevo, supervision: veredicto }
})
