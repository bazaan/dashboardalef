/**
 * POST /api/sgs/tickets — catalogar un ticket de balanza (v2, handoff 2026-07-31)
 *
 * CAMBIO CLAVE (§4.1.c): el N° de orden YA NO BLOQUEA el ingreso.
 * Sin OL el ticket se guarda igual, completo y con su foto, en estado
 * PENDIENTE_OL: no entra al consolidado, no arranca el TAT, y espera en la
 * bandeja hasta que alguien le asigne la orden. Antes se rechazaba y se perdía.
 *
 * Reglas aplicadas:
 *   §4.1   el OL es la llave; si viene, debe tener formato OLxxxxxx-xx
 *   §4.1.c sin OL → pendiente_ol (no se pierde)
 *   §4.2   human-in-the-loop obligatorio
 *   §4.4   anti-duplicados (por orden+ticket, o por ticket si está pendiente)
 *   §4.9   solo se guarda lo que viene impreso en el ticket
 *   §4.10  derivados nunca tecleados: sede, sublote, neto en TM
 *   §7c    Agente Supervisor (determinista, 0 tokens)
 *
 * Respuesta: { ok, accion, estado, supervision, sublote, tat, registro }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  validarLlave, calcularTat, supervisar, verificarSesionSGS,
  parseFecha, isoDia, derivarSede, detectarFormato, kgATm, TAT_DEFAULT,
} from '../../utils/sgs'
import { asignarSublote } from '../../utils/sgs-sublotes'

const num = (x: any) => {
  if (x === null || x === undefined || x === '') return null
  const n = parseFloat(String(x).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}
const txt = (x: any) => {
  const s = String(x ?? '').trim()
  return s === '' ? null : s
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  // ── §4.2 human-in-the-loop (esto SÍ sigue siendo obligatorio) ──
  if (body?.verificado_humano !== true) {
    throw createError({ statusCode: 400, statusMessage: 'Registro sin verificación humana — no se guarda (Regla §4.2)' })
  }

  // ── N° de ticket: lo único imprescindible para identificar el papel ──
  const nTicket = String(body?.n_ticket ?? '').trim().toUpperCase()
  if (!nTicket) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el N° de ticket de balanza' })
  }

  // ── §4.1 / §4.1.c: el OL es opcional, pero si viene debe ser válido ──
  const olCrudo = String(body?.n_orden ?? '').trim()
  let nOrden: string | null = null
  if (olCrudo) {
    const llave = validarLlave(olCrudo)
    if (!llave.ok) throw createError({ statusCode: 400, statusMessage: llave.motivo })
    nOrden = llave.orden
  }
  const estado = nOrden ? 'catalogado' : 'pendiente_ol'

  // ── Campos del ticket (§4.9: solo lo impreso) ──
  const registro: Record<string, any> = {
    n_orden: nOrden,
    n_ticket: nTicket,
    estado,
    // 1 · Identificación
    guia_remision: txt(body.guia_remision),
    // 2 · Transporte
    placa: txt(body.placa)?.toUpperCase() ?? null,
    carreta: txt(body.carreta)?.toUpperCase() ?? null,
    transportista: txt(body.transportista),
    ruc_transportista: txt(body.ruc_transportista),
    chofer: txt(body.chofer),
    brevete: txt(body.brevete),
    nro_ejes: txt(body.nro_ejes),
    // 3 · Partes
    emisor: txt(body.emisor),
    ruc_emisor: txt(body.ruc_emisor),
    cliente: txt(body.cliente),
    // 4 · Material y ruta
    cod_material: txt(body.cod_material),
    material: txt(body.material),          // lo IMPRESO, no la calidad
    calidad_material: txt(body.calidad_material),  // editable, viene de la orden
    origen: txt(body.origen),
    destino: txt(body.destino),
    almacen: txt(body.almacen),
    // 5 · Pesaje
    fecha: txt(body.fecha),
    hora_ingreso: txt(body.hora_ingreso),
    hora_salida: txt(body.hora_salida),
    peso_bruto: num(body.peso_bruto),
    tara: num(body.tara),
    peso_neto: num(body.peso_neto),
    balanza2_nombre: txt(body.balanza2?.nombre),
    balanza2_bruto: num(body.balanza2?.bruto),
    balanza2_tara: num(body.balanza2?.tara),
    balanza2_neto: num(body.balanza2?.neto),
    // 6 · Embarque (TISUR)
    nave: txt(body.nave),
    bl_ne: txt(body.bl_ne),
    item_bl: txt(body.item_bl),
    regimen: txt(body.regimen),
    bultos: txt(body.bultos),
    // 8 · Control
    observaciones_ticket: txt(body.observaciones_ticket),
    observaciones_ocr: Array.isArray(body._flags) ? body._flags.join('; ') || null : txt(body.observaciones_ocr),
    otros: body.otros && typeof body.otros === 'object' ? body.otros : null,
    verificado_humano: true,
    tat_dias: Number(body.tat_dias) > 0 ? Math.round(Number(body.tat_dias)) : TAT_DEFAULT,
    created_by: email,
  }

  // ── §4.10 DERIVADOS: nunca se teclean ──
  registro.peso_neto_tm = kgATm(registro.peso_neto)
  registro.formato_ticket = detectarFormato({ ...body, numero_ticket: nTicket })
  // La sede sale del destino impreso (PARACAS → Pisco). Solo si no hay destino
  // se respeta lo que mandó el formulario.
  registro.sede = derivarSede(registro.destino) ?? txt(body.sede)

  // Fechas de pesaje
  const fi = parseFecha(body.fecha_ingreso ?? body.fecha)
  const fs = parseFecha(body.fecha_salida)
  registro.fecha_ingreso = fi ? isoDia(fi) : null
  registro.fecha_salida = fs ? isoDia(fs) : null

  // ── §7c Agente Supervisor ──
  const veredicto = supervisar(registro, body._flags)
  registro.supervision = veredicto.veredicto
  registro.supervision_severidad = veredicto.veredicto === 'revisar' ? veredicto.severidad : null
  registro.supervision_obs = veredicto.observaciones.join('; ') || null

  // ── Foto del ticket → Storage ──
  if (typeof body.imagen_base64 === 'string' && body.imagen_base64.startsWith('data:image')) {
    try {
      const m = body.imagen_base64.match(/^data:image\/(\w+);base64,(.+)$/)
      if (m) {
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
        const buffer = Buffer.from(m[2], 'base64')
        if (buffer.length <= 8 * 1024 * 1024) {
          const path = `${nOrden || 'pendiente'}/${nTicket}-${Date.now()}.${ext}`
          const up = await supabase.storage.from('sgs-tickets')
            .upload(path, buffer, { contentType: `image/${m[1]}`, upsert: true })
          if (!up.error) {
            const { data: pub } = supabase.storage.from('sgs-tickets').getPublicUrl(path)
            registro.imagen_ticket = pub?.publicUrl || null
          }
        }
      }
    } catch (e: any) {
      console.error('[sgs/tickets] No se pudo subir la imagen:', e?.message)
    }
  }

  // ── §4.4 anti-duplicados ──
  let existente: any = null
  if (nOrden) {
    const { data } = await (supabase.from('sgs_tickets') as any)
      .select('id, imagen_ticket, resultado_estado, sublote_id')
      .eq('n_orden', nOrden).eq('n_ticket', nTicket).maybeSingle()
    existente = data
  } else {
    const { data } = await (supabase.from('sgs_tickets') as any)
      .select('id, imagen_ticket, resultado_estado, sublote_id')
      .is('n_orden', null).eq('n_ticket', nTicket).maybeSingle()
    existente = data
  }

  // ── §4.10 Sublote: solo si ya tiene OL (los pendientes no consolidan) ──
  let sublote: { id: number; codigo: string } | null = null
  if (nOrden && !existente?.sublote_id) {
    try {
      sublote = await asignarSublote(supabase, {
        n_orden: nOrden, sede: registro.sede, cliente: registro.cliente, peso_neto: registro.peso_neto,
      })
      if (sublote) registro.sublote_id = sublote.id
    } catch (e: any) {
      console.error('[sgs/tickets] sublote:', e?.message)
    }
  }

  // ── TAT: el reloj vive en el sublote; el ticket refleja su estado ──
  registro.tat_estado = 'sin_fecha'
  registro.tat_dias_restantes = null
  let tat: any = null
  if (nOrden && body.fecha_ingreso_analisis) {
    const fa = parseFecha(body.fecha_ingreso_analisis)
    if (fa) {
      registro.fecha_ingreso_analisis = isoDia(fa)
      tat = calcularTat(fa, registro.tat_dias)
      registro.tat_estado = tat.estado
      registro.tat_dias_restantes = tat.dias_restantes
    }
  }

  // ── Guardar ──
  let accion: 'insert' | 'update'
  if (existente) {
    if (!registro.imagen_ticket) registro.imagen_ticket = existente.imagen_ticket
    registro.resultado_estado = existente.resultado_estado
    if (existente.sublote_id) registro.sublote_id = existente.sublote_id
    const { error } = await (supabase.from('sgs_tickets') as any).update(registro).eq('id', existente.id)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error actualizando: ${error.message}` })
    accion = 'update'
  } else {
    const { error } = await (supabase.from('sgs_tickets') as any).insert(registro)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error guardando: ${error.message}` })
    accion = 'insert'
  }

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Ingreso Ticket',
      input_data: {
        n_orden: nOrden, n_ticket: nTicket, estado, accion,
        formato: registro.formato_ticket, sede: registro.sede, por: email,
      },
      output_data: {
        supervision: veredicto.veredicto, sublote: sublote?.codigo ?? null,
        neto_tm: registro.peso_neto_tm,
      },
      status: veredicto.veredicto === 'revisar' ? 'warning' : 'success',
    })
  } catch {}

  console.log(`[sgs/tickets] ${accion} ${nOrden || 'PENDIENTE_OL'}/${nTicket} | ${registro.formato_ticket ?? '?'} | ${registro.sede ?? '?'} | sublote=${sublote?.codigo ?? '—'} | por ${email}`)
  return { ok: true, accion, estado, supervision: veredicto, sublote, tat, registro }
})
