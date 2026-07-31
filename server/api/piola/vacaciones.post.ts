/**
 * POST /api/piola/vacaciones — solicitar / aprobar / rechazar vacaciones (§7.2)
 *
 * Body:
 *   { accion: 'solicitar', fecha_inicio, fecha_fin, motivo? }
 *   { accion: 'aprobar' | 'rechazar', id, comentario? }           [RR.HH. o Admin]
 *   { accion: 'cancelar', id }                                    (el propio dueño, si sigue pendiente)
 *   { accion: 'ajustar', colaborador_email, dias, motivo }        [RR.HH. o Admin]
 *
 * Al APROBAR, los días se marcan además en el tareo con estado 'vacaciones',
 * para que el reporte mensual no los cuente como faltas.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionPiola, exigirModulo, calcularVacaciones, diasHabiles, hoyLima, sumarDias,
} from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Solicitar ══════════ */
  if (accion === 'solicitar') {
    const inicio = String(body?.fecha_inicio || '').slice(0, 10)
    const fin = String(body?.fecha_fin || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fin) || fin < inicio) {
      throw createError({ statusCode: 400, statusMessage: 'Rango de fechas inválido' })
    }
    if (perfil.colaborador?.tipo_contrato !== 'planilla') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Las vacaciones aplican solo a colaboradores en planilla (los de recibo por honorarios no devengan días)',
      })
    }

    const dias = diasHabiles(inicio, fin)
    if (dias <= 0) throw createError({ statusCode: 400, statusMessage: 'El rango no tiene días hábiles' })

    // Valida contra el saldo disponible
    const [{ data: aprobadas }, { data: ajustes }] = await Promise.all([
      supabase.from('piola_vacation_requests').select('dias')
        .ilike('colaborador_email', perfil.email).eq('estado', 'aprobada'),
      supabase.from('piola_vacation_adjustments').select('dias').ilike('colaborador_email', perfil.email),
    ])
    const tomados = (aprobadas || []).reduce((s: number, v: any) => s + Number(v.dias || 0), 0)
    const aj = (ajustes || []).reduce((s: number, v: any) => s + Number(v.dias || 0), 0)
    const saldo = calcularVacaciones(perfil.colaborador, tomados, aj)

    if (dias > saldo.dias_disponibles) {
      throw createError({
        statusCode: 400,
        statusMessage: `Estás pidiendo ${dias} día(s) y solo tienes ${saldo.dias_disponibles} disponible(s)`,
      })
    }

    const { data, error } = await supabase.from('piola_vacation_requests').insert({
      colaborador_email: perfil.email,
      fecha_inicio: inicio, fecha_fin: fin, dias,
      motivo: body?.motivo || null,
      estado: 'pendiente',
    }).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: `Error creando la solicitud: ${error.message}` })

    return { ok: true, solicitud: data, saldo }
  }

  /* ══════════ Cancelar (el dueño, mientras siga pendiente) ══════════ */
  if (accion === 'cancelar') {
    const { data: sol } = await supabase
      .from('piola_vacation_requests').select('*').eq('id', body?.id).maybeSingle()
    if (!sol) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })

    const esDuenio = String(sol.colaborador_email).toLowerCase() === perfil.email.toLowerCase()
    if (!esDuenio && !perfil.esAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Solo puedes cancelar tus propias solicitudes' })
    }
    if (sol.estado !== 'pendiente') {
      throw createError({ statusCode: 409, statusMessage: `La solicitud ya está ${sol.estado}` })
    }

    const { data, error } = await supabase.from('piola_vacation_requests')
      .update({ estado: 'cancelada' }).eq('id', sol.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true, solicitud: data }
  }

  /* ══════════ Aprobar / rechazar ══════════ */
  if (accion === 'aprobar' || accion === 'rechazar') {
    exigirModulo(perfil, 'rrhh', 'edit')

    const { data: sol } = await supabase
      .from('piola_vacation_requests').select('*').eq('id', body?.id).maybeSingle()
    if (!sol) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })
    if (sol.estado !== 'pendiente') {
      throw createError({ statusCode: 409, statusMessage: `La solicitud ya está ${sol.estado}` })
    }

    const estado = accion === 'aprobar' ? 'aprobada' : 'rechazada'
    const { data, error } = await supabase.from('piola_vacation_requests').update({
      estado,
      aprobado_por: perfil.email,
      aprobado_at: new Date().toISOString(),
      comentario_admin: body?.comentario || null,
    }).eq('id', sol.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Al aprobar, los días quedan marcados en el tareo como 'vacaciones'
    let marcados = 0
    if (estado === 'aprobada') {
      let d = String(sol.fecha_inicio).slice(0, 10)
      const fin = String(sol.fecha_fin).slice(0, 10)
      while (d <= fin) {
        const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
        if (dow !== 0 && dow !== 6) {
          await supabase.from('piola_attendance').upsert({
            colaborador_email: sol.colaborador_email,
            fecha: d,
            estado: 'vacaciones',
            worked_minutes: 0,
            notas: `Vacaciones aprobadas (solicitud #${sol.id})`,
          }, { onConflict: 'colaborador_email,fecha' })
          marcados++
        }
        d = sumarDias(d, 1)
      }
    }

    return { ok: true, solicitud: data, dias_marcados_en_tareo: marcados }
  }

  /* ══════════ Ajuste manual de saldo ══════════ */
  if (accion === 'ajustar') {
    exigirModulo(perfil, 'rrhh', 'edit')
    const email = String(body?.colaborador_email || '').trim()
    const dias = Number(body?.dias)
    if (!email || !Number.isFinite(dias) || dias === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Faltan colaborador_email o dias (distinto de 0)' })
    }
    const { data, error } = await supabase.from('piola_vacation_adjustments').insert({
      colaborador_email: email, dias, motivo: body?.motivo || null, creado_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true, ajuste: data, hoy: hoyLima() }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción inválida: '${accion}'` })
})
