/**
 * POST /api/sgs/tickets — EVENTO 1: catalogar un ticket de balanza
 * (port de DirectorOperaciones.recibir_ticket + push_excel.push a Supabase)
 *
 * Flujo (Reglas de oro):
 *   1. Auth de sesión (dashboardlogin) — solo SGS / Alef / superadmin
 *   2. §4.1  valida la llave OLxxxxxx-xx — sin ella NADA entra
 *   3. §4.2  exige verificado_humano = true — cero auto-guardado ciego
 *   4. §4.3  campos obligatorios: n_ticket, placa, bruto, tara, neto, fecha, calidad
 *   5. §7c   Agente Supervisor (determinista, 0 tokens) → supervision / obs
 *   6. §1.D  calcula TAT inicial si ya ingresó a análisis
 *   7. Sube la foto del ticket a Storage (bucket sgs-tickets) si viene
 *   8. §4.4  upsert por (n_orden, n_ticket) — anti-duplicados
 *
 * Body: { n_orden, n_ticket, fecha, sede, cliente, calidad_material, placa,
 *         peso_bruto, tara, peso_neto, sublote, fecha_ingreso_analisis?,
 *         tat_dias?, verificado_humano, balanza2?{nombre,bruto,tara,neto},
 *         imagen_base64?, imagen_nombre? }
 *
 * Respuesta: { ok, accion:'insert'|'update', supervision:{...}, tat:{...}, registro }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { validarLlave, calcularTat, supervisar, verificarSesionSGS, parseFecha, isoDia } from '../../utils/sgs'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  // ── §4.1 la llave ──
  const llave = validarLlave(body?.n_orden)
  if (!llave.ok) {
    throw createError({ statusCode: 400, statusMessage: llave.motivo })
  }

  // ── §4.2 human-in-the-loop ──
  if (body?.verificado_humano !== true) {
    throw createError({ statusCode: 400, statusMessage: 'Registro sin verificación humana — no se guarda (Regla §4.2)' })
  }

  // ── §4.3 campos obligatorios ──
  const nTicket = String(body?.n_ticket ?? '').trim().toUpperCase()
  const faltan: string[] = []
  if (!nTicket) faltan.push('n_ticket')
  for (const c of ['placa', 'peso_bruto', 'tara', 'peso_neto', 'fecha', 'calidad_material']) {
    if (body?.[c] === undefined || body?.[c] === null || String(body[c]).trim() === '') faltan.push(c)
  }
  if (faltan.length) {
    throw createError({ statusCode: 400, statusMessage: `Campos obligatorios del ticket faltantes: ${faltan.join(', ')} (Regla §4.3)` })
  }

  const nums = (x: any) => {
    const n = parseFloat(String(x).replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : null
  }

  const registro: Record<string, any> = {
    n_orden: llave.orden,
    n_ticket: nTicket,
    fecha: String(body.fecha).trim(),
    sede: body.sede || null,
    cliente: body.cliente || null,                    // anonimizado en demos
    calidad_material: body.calidad_material || null,
    placa: String(body.placa).trim().toUpperCase(),
    peso_bruto: nums(body.peso_bruto),
    tara: nums(body.tara),
    peso_neto: nums(body.peso_neto),
    sublote: body.sublote || null,
    tat_dias: Number(body.tat_dias) > 0 ? Math.round(Number(body.tat_dias)) : 4,
    resultado_estado: 'no_esta',
    verificado_humano: true,
    balanza2_nombre: body.balanza2?.nombre || null,
    balanza2_bruto: nums(body.balanza2?.bruto),
    balanza2_tara: nums(body.balanza2?.tara),
    balanza2_neto: nums(body.balanza2?.neto),
    created_by: email,
  }

  // ── §1.D TAT inicial ──
  registro.fecha_ingreso_analisis = null
  registro.tat_estado = 'sin_fecha'
  registro.tat_dias_restantes = null
  let tat = null as any
  if (body.fecha_ingreso_analisis) {
    const fi = parseFecha(body.fecha_ingreso_analisis)
    if (!fi) {
      throw createError({ statusCode: 400, statusMessage: `Fecha de ingreso a análisis inválida: '${body.fecha_ingreso_analisis}'` })
    }
    registro.fecha_ingreso_analisis = isoDia(fi)
    tat = calcularTat(fi, registro.tat_dias)
    registro.tat_estado = tat.estado
    registro.tat_dias_restantes = tat.dias_restantes
  }

  // ── §7c Agente Supervisor (determinista) ──
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
        if (buffer.length > 8 * 1024 * 1024) {
          throw new Error('imagen > 8MB')
        }
        const path = `${llave.orden}/${nTicket}-${Date.now()}.${ext}`
        const up = await supabase.storage.from('sgs-tickets')
          .upload(path, buffer, { contentType: `image/${m[1]}`, upsert: true })
        if (!up.error) {
          const { data: pub } = supabase.storage.from('sgs-tickets').getPublicUrl(path)
          registro.imagen_ticket = pub?.publicUrl || null
        } else {
          console.error('[sgs/tickets] Storage error:', up.error.message)
        }
      }
    } catch (e: any) {
      console.error('[sgs/tickets] No se pudo subir la imagen:', e?.message)
    }
  }

  // ── §4.4 upsert anti-duplicados por (n_orden, n_ticket) ──
  const { data: existente } = await (supabase.from('sgs_tickets') as any)
    .select('id, imagen_ticket, resultado_estado')
    .eq('n_orden', llave.orden).eq('n_ticket', nTicket).maybeSingle()

  let accion: 'insert' | 'update'
  if (existente) {
    // conserva imagen previa si no llegó una nueva, y no retrocede el semáforo E
    if (!registro.imagen_ticket) registro.imagen_ticket = existente.imagen_ticket
    registro.resultado_estado = existente.resultado_estado
    const { error } = await (supabase.from('sgs_tickets') as any).update(registro).eq('id', existente.id)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error actualizando: ${error.message}` })
    accion = 'update'
  } else {
    const { error } = await (supabase.from('sgs_tickets') as any).insert(registro)
    if (error) throw createError({ statusCode: 500, statusMessage: `Error guardando: ${error.message}` })
    accion = 'insert'
  }

  // Log (visible en Dev · Agent Logs → SGS)
  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'Ingreso Ticket',
      input_data: { n_orden: llave.orden, n_ticket: nTicket, accion, por: email },
      output_data: { supervision: veredicto.veredicto, tat: registro.tat_estado },
      status: 'success',
    })
  } catch {}

  console.log(`[sgs/tickets] ${accion} ${llave.orden}/${nTicket} | supervision=${veredicto.veredicto} | tat=${registro.tat_estado} | por ${email}`)
  return { ok: true, accion, supervision: veredicto, tat, registro }
})
