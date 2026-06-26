/**
 * POST /api/davila/pre-reserva
 *
 * Tool ÚNICA del agente "Maria" de Miguel Davila: validar_pre_reserva.
 * Maneja TODO el ciclo de pre-reserva con 4 operaciones diferenciadas por
 * el parámetro `operacion`. Cada ejecución se loggea en agent_tool_logs
 * (company_id='davila', tool_name='Validar Pre-Reserva') → visible en el
 * dashboard de Alef → Dev · Agent Logs → Empresa: M. Davila.
 *
 * Body (SOLO 4 parámetros — versión simplificada Junio 2026):
 * {
 *   api_key:   string,    — auth
 *   operacion: "CREATE" | "UPDATE_PAGO" | "CONFIRMAR" | "CANCELAR",
 *   celular:   string,    — identificador único del cliente (SIEMPRE presente)
 *
 *   // Solo en CREATE:
 *   fecha:     string,    — "YYYY-MM-DD"
 *   hora:      string,    — "HH:MM" (24h)
 * }
 *
 * NO recibe datos personales (nombre, tratamiento, DNI, edad, comprobante,
 * monto, modalidad). María los valida manualmente fuera de la tool.
 *
 * REAGENDAR = llamar CREATE de nuevo con la nueva fecha/hora: si el celular ya
 * tiene una pre-reserva ACTIVA sin pagar (estado='pre_reservado', no expirada),
 * CREATE la cancela automáticamente (borra GCal + calendario del dashboard,
 * estado='cancelado') antes de crear la nueva, y responde reagendada:true +
 * anterior:{fecha,hora}. Las pagadas/confirmadas no se tocan. UPDATE_PAGO /
 * CONFIRMAR / CANCELAR siempre procesan la MÁS RECIENTE (ORDER BY created_at
 * DESC LIMIT 1).
 *
 * Respuestas: ver cada operación. Siempre { success: boolean, ... }.
 *
 * El endpoint maneja Google Calendar (verifica disponibilidad, crea/elimina
 * eventos) + Supabase (tabla pre_reservas) + lógica de estados.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { slotEstaLibre, crearEvento, eliminarEvento, DAVILA_TZ } from '~/server/utils/davila-calendar'

const API_KEY = 'davila-pre-reserva-2026'

const OPERACIONES_VALIDAS = ['CREATE', 'UPDATE_PAGO', 'CONFIRMAR', 'CANCELAR'] as const
type Operacion = typeof OPERACIONES_VALIDAS[number]

// Ventana de vigencia de una pre-reserva sin pagar
const EXPIRACION_MIN = 40

// Duración fija de la cita: 30 min (Google Calendar + chequeo de slot de
// disponibilidad). Coincide con la cita final de calendario_agendar (también 30).
// Antes era 60 → la pre-reserva aparecía como 1 hora (ej. 4:00–5:00) en GCal.
const DURACION_MIN = 30

// Reglas de negocio para CREATE (según especificación)
// Días permitidos: martes (2) y jueves (4). Horario: 15:00 a 19:30.
const DIAS_PERMITIDOS = [2, 4]              // getDay(): 0=domingo, 2=martes, 4=jueves
const HORA_MIN = 15 * 60                    // 15:00 en minutos
const HORA_MAX = 19 * 60 + 30               // 19:30 en minutos
// Poné VALIDAR_RANGO_HORARIO en false si querés desactivar la validación de día/hora
// (la disponibilidad real igual la valida Google Calendar).
const VALIDAR_RANGO_HORARIO = true

function genPreReservaId(): string {
  const rnd = Math.random().toString(36).slice(2, 10)
  return `pre_${rnd}`
}

/** "YYYY-MM-DD" → Date a medianoche Lima */
function fechaToLimaDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-05:00`)
}

/** Hoy a medianoche Lima */
function hoyLima(): Date {
  const ahora = new Date()
  const limaStr = ahora.toLocaleDateString('en-CA', { timeZone: DAVILA_TZ }) // YYYY-MM-DD
  return new Date(`${limaStr}T00:00:00-05:00`)
}

/** "HH:MM" → minutos del día */
function horaToMin(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora || '').trim())
  if (!m) return -1
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // ── 1. Auth ────────────────────────────────────────────────────────────
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // ── 2. Log inicial ─────────────────────────────────────────────────────
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'davila',
      tool_name:  'Validar Pre-Reserva',
      input_data: body,
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const finish = async (status: string, output: any, errorMsg?: string) => {
    if (logId) {
      try {
        await supabase.from('agent_tool_logs').update({
          status, output_data: output, error_message: errorMsg ?? null,
          duration_ms: Date.now() - startTime,
        }).eq('id', logId)
      } catch {}
    }
    return output
  }

  // ── 3. Validación común ────────────────────────────────────────────────
  const operacion: string = body?.operacion
  const celular: string = body?.celular

  if (!operacion || !OPERACIONES_VALIDAS.includes(operacion as Operacion)) {
    const msg = `operacion inválida. Debe ser: ${OPERACIONES_VALIDAS.join(', ')}`
    return await finish('error', { success: false, error: 'operacion_invalida', mensaje: msg }, msg)
  }
  if (!celular || !String(celular).trim()) {
    const msg = 'celular es obligatorio'
    return await finish('error', { success: false, error: 'celular_faltante', mensaje: msg }, msg)
  }
  const celularNorm = String(celular).trim()

  // ════════════════════════════════════════════════════════════════════════
  // OPERACIÓN 1: CREATE
  // ════════════════════════════════════════════════════════════════════════
  if (operacion === 'CREATE') {
    const fecha = String(body?.fecha ?? '').trim()
    const hora = String(body?.hora ?? '').trim()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{1,2}:\d{2}$/.test(hora)) {
      const msg = 'CREATE requiere fecha (YYYY-MM-DD) y hora (HH:MM) válidas'
      return await finish('error', { success: false, error: 'parametros_invalidos', mensaje: msg }, msg)
    }

    // Validar fecha >= HOY (Lima)
    if (fechaToLimaDate(fecha) < hoyLima()) {
      const msg = 'La fecha de la cita ya pasó'
      return await finish('error', { success: false, error: 'fecha_pasada', mensaje: msg }, msg)
    }

    // Validar rango día/hora (martes/jueves, 15:00–19:30)
    if (VALIDAR_RANGO_HORARIO) {
      const diaSemana = fechaToLimaDate(fecha).getUTCDay() // 0=dom..6=sab (la fecha está a medianoche Lima)
      const minutos = horaToMin(hora)
      if (!DIAS_PERMITIDOS.includes(diaSemana)) {
        const msg = 'Solo se atiende martes y jueves'
        return await finish('error', { success: false, error: 'dia_no_permitido', mensaje: msg }, msg)
      }
      if (minutos < HORA_MIN || minutos > HORA_MAX) {
        const msg = 'El horario de atención es de 3:00 PM a 7:30 PM'
        return await finish('error', { success: false, error: 'hora_fuera_de_rango', mensaje: msg }, msg)
      }
    }

    // REAGENDAMIENTO ATÓMICO: si el mismo celular ya tiene pre-reservas ACTIVAS
    // sin pagar (estado='pre_reservado', no expiradas), se cancelan acá mismo
    // (se borra el evento de GCal + la fila del calendario del dashboard y se
    // marcan 'reagendado') antes de crear la nueva. Así "cambiar el horario" es
    // UNA sola llamada CREATE con la nueva fecha/hora, y nunca quedan eventos
    // fantasma. Las pagadas/confirmadas NO se tocan (pueden ser otra cita real).
    let reagendadaAnterior: { fecha: string; hora: string } | null = null
    try {
      const { data: previas } = await supabase
        .from('pre_reservas')
        .select('id, fecha, hora, calendar_event_id, dashboard_event_id')
        .eq('celular', celularNorm)
        .eq('estado', 'pre_reservado')
        .gt('expires_at', new Date().toISOString())
      for (const prev of previas ?? []) {
        if (prev.calendar_event_id) await eliminarEvento(prev.calendar_event_id)
        if (prev.dashboard_event_id) {
          try { await supabase.from('DAVILA_calendar_events').delete().eq('id', prev.dashboard_event_id) } catch {}
        }
        // 'cancelado' (no un estado nuevo): la tabla tiene CHECK de estados y
        // todos los queries del ciclo ya manejan 'cancelado'.
        const { error: updErr } = await supabase.from('pre_reservas').update({
          estado: 'cancelado', cancelado_en: new Date().toISOString(),
        }).eq('id', prev.id)
        if (updErr) console.error('[pre-reserva CREATE] No se pudo marcar cancelada la previa:', updErr.message)
        reagendadaAnterior = { fecha: prev.fecha, hora: prev.hora }
      }
    } catch (e: any) {
      console.error('[pre-reserva CREATE] Error cancelando pre-reservas previas:', e?.message)
      // No bloquear el CREATE: peor escenario, la previa la limpia el cron al expirar
    }

    // Verificar disponibilidad en Google Calendar
    try {
      const { libre } = await slotEstaLibre(fecha, hora, DURACION_MIN)
      if (!libre) {
        const msg = 'Ese horario ya está ocupado'
        return await finish('error', { success: false, error: 'horario_ocupado', mensaje: msg }, msg)
      }
    } catch (e: any) {
      const msg = `Error consultando Google Calendar: ${e?.message}`
      return await finish('error', { success: false, error: 'error_calendar', mensaje: msg }, msg)
    }

    // Crear evento en Google Calendar (sin datos personales — los maneja María)
    let calendarEventId: string
    try {
      calendarEventId = await crearEvento({
        fecha, hora, duracionMin: DURACION_MIN,
        summary: `PRE-RESERVA ${celularNorm}`,
        description: `Celular: ${celularNorm}\n(Pre-reserva — pendiente de pago, expira en 40 min)`,
      })
    } catch (e: any) {
      const msg = `Error creando evento en Google Calendar: ${e?.message}`
      return await finish('error', { success: false, error: 'error_calendar', mensaje: msg }, msg)
    }

    const preReservaId = genPreReservaId()

    // Insertar también en el calendario del dashboard (DAVILA_calendar_events)
    let dashboardEventId: number | null = null
    try {
      const { data: dashRow } = await supabase
        .from('DAVILA_calendar_events')
        .insert({
          date:              fecha,
          time:              hora,
          subject:           'PRE-RESERVA (pend. pago)',
          description:       `Pre-reserva pendiente de pago.\nCelular: ${celularNorm}`,
          client_phone:      celularNorm,
          pre_reserva_id:    preReservaId,
          calendar_event_id: calendarEventId,
          estado:            'pre_reservado',
        })
        .select('id')
        .single()
      dashboardEventId = dashRow?.id ?? null
    } catch (e: any) {
      console.error('[pre-reserva CREATE] Error insertando en DAVILA_calendar_events:', e?.message)
      // No bloquear: la pre-reserva en GCal+pre_reservas igual se crea
    }

    // Insertar en pre_reservas
    const now = new Date()
    const expiresAt = new Date(now.getTime() + EXPIRACION_MIN * 60_000)

    try {
      await supabase.from('pre_reservas').insert({
        celular:            celularNorm,
        pre_reserva_id:     preReservaId,
        calendar_event_id:  calendarEventId,
        dashboard_event_id: dashboardEventId,
        fecha,
        hora,
        estado:             'pre_reservado',
        created_at:         now.toISOString(),
        expires_at:         expiresAt.toISOString(),
      })
    } catch (e: any) {
      // Si falla el insert, intentamos limpiar el evento GCal y la fila del dashboard
      await eliminarEvento(calendarEventId)
      if (dashboardEventId) {
        try { await supabase.from('DAVILA_calendar_events').delete().eq('id', dashboardEventId) } catch {}
      }
      const msg = `Error guardando pre-reserva: ${e?.message}`
      return await finish('error', { success: false, error: 'error_supabase', mensaje: msg }, msg)
    }

    return await finish('success', {
      success: true,
      pre_reserva_id: preReservaId,
      calendar_event_id: calendarEventId,
      expires_at: expiresAt.toISOString(),
      reagendada: !!reagendadaAnterior,
      anterior: reagendadaAnterior,
      mensaje: reagendadaAnterior
        ? `Pre-reserva creada exitosamente. Se canceló la anterior (${reagendadaAnterior.fecha} ${reagendadaAnterior.hora}).`
        : 'Pre-reserva creada exitosamente',
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  // OPERACIÓN 2: UPDATE_PAGO
  // ════════════════════════════════════════════════════════════════════════
  if (operacion === 'UPDATE_PAGO') {
    const { data: reserva } = await supabase
      .from('pre_reservas')
      .select('*')
      .eq('celular', celularNorm)
      .eq('estado', 'pre_reservado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reserva) {
      const msg = 'No se encontró una pre-reserva activa para este cliente'
      return await finish('error', { success: false, error: 'pre_reserva_no_encontrada', mensaje: msg }, msg)
    }

    // Verificar vigencia
    if (new Date(reserva.expires_at) <= new Date()) {
      // Marcar expirada + limpiar GCal + dashboard
      if (reserva.calendar_event_id) await eliminarEvento(reserva.calendar_event_id)
      if (reserva.dashboard_event_id) {
        try { await supabase.from('DAVILA_calendar_events').delete().eq('id', reserva.dashboard_event_id) } catch {}
      }
      await supabase.from('pre_reservas').update({ estado: 'expirado' }).eq('id', reserva.id)
      const msg = 'La pre-reserva expiró'
      return await finish('success', { success: false, error: 'expirado', mensaje: msg })
    }

    await supabase.from('pre_reservas').update({
      estado: 'pagado', pagado_en: new Date().toISOString(),
    }).eq('id', reserva.id)

    return await finish('success', {
      success: true, estado: 'pagado', mensaje: 'Pago confirmado',
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  // OPERACIÓN 3: CONFIRMAR
  // ════════════════════════════════════════════════════════════════════════
  if (operacion === 'CONFIRMAR') {
    const { data: reserva } = await supabase
      .from('pre_reservas')
      .select('*')
      .eq('celular', celularNorm)
      .eq('estado', 'pagado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reserva) {
      const msg = 'No se encontró una pre-reserva pagada para este cliente'
      return await finish('error', { success: false, error: 'pre_reserva_no_encontrada', mensaje: msg }, msg)
    }

    await supabase.from('pre_reservas').update({
      estado: 'confirmado', confirmado_en: new Date().toISOString(),
    }).eq('id', reserva.id)

    return await finish('success', {
      success: true, estado: 'confirmado', mensaje: 'Cita confirmada exitosamente',
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  // OPERACIÓN 4: CANCELAR
  // ════════════════════════════════════════════════════════════════════════
  if (operacion === 'CANCELAR') {
    const { data: reserva } = await supabase
      .from('pre_reservas')
      .select('*')
      .eq('celular', celularNorm)
      .eq('estado', 'pre_reservado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!reserva) {
      const msg = 'No se encontró una pre-reserva activa para cancelar'
      return await finish('error', { success: false, error: 'pre_reserva_no_encontrada', mensaje: msg }, msg)
    }

    // Eliminar evento de Google Calendar + del calendario del dashboard
    if (reserva.calendar_event_id) await eliminarEvento(reserva.calendar_event_id)
    if (reserva.dashboard_event_id) {
      try { await supabase.from('DAVILA_calendar_events').delete().eq('id', reserva.dashboard_event_id) } catch {}
    }

    await supabase.from('pre_reservas').update({
      estado: 'cancelado', cancelado_en: new Date().toISOString(),
    }).eq('id', reserva.id)

    return await finish('success', {
      success: true, estado: 'cancelado', mensaje: 'Pre-reserva cancelada',
    })
  }

  // No debería llegar acá
  const msg = 'Operación no reconocida'
  return await finish('error', { success: false, error: 'operacion_invalida', mensaje: msg }, msg)
})
