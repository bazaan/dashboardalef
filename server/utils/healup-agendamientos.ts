/**
 * Lógica compartida del envío diario de pacientes agendados a n8n.
 *
 * Usada por:
 *   GET  /api/healup/cron-agendamientos-diarios   (disparado por Vercel Cron)
 *   POST /api/healup/agendamientos-diarios-trigger (disparo manual desde UI)
 */

import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

const LIMA_OFFSET_HOURS = -5  // Lima es UTC-5 todo el año (no DST)

export interface AgendamientosResult {
  fecha_lima: string
  status: 'success' | 'error' | 'empty'
  pacientes_count: number
  pacientes_wpp_count: number
  pacientes_fbig_count: number
  pacientes_tiktok_count: number
  http_status: number | null
  error_message: string | null
  duracion_ms: number
  log_id: number | null
  webhook_configurado: boolean
}

/** Devuelve YYYY-MM-DD del día Lima actual + ventana en UTC ISO */
export function getLimaTodayWindow() {
  const nowUtc = new Date()
  const limaMs = nowUtc.getTime() + LIMA_OFFSET_HOURS * 3600 * 1000
  const lima = new Date(limaMs)
  const yyyy = lima.getUTCFullYear()
  const mm = String(lima.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(lima.getUTCDate()).padStart(2, '0')
  const fechaLima = `${yyyy}-${mm}-${dd}`
  // Inicio del día Lima en UTC: 00:00 Lima = 05:00 UTC mismo día.
  const inicioISO = `${fechaLima}T05:00:00.000Z`
  const finISO = nowUtc.toISOString()
  return { fechaLima, inicioISO, finISO }
}

/**
 * Ejecuta el envío: consulta los pacientes agendados hoy (Lima) en las 3 tablas,
 * POSTea el payload a n8n y guarda un log en `healup_agendamiento_diario_logs`.
 */
export async function ejecutarEnvioAgendamientos(
  event: H3Event,
  opts: { origen: 'cron' | 'manual'; triggered_by_email?: string | null }
): Promise<AgendamientosResult> {
  const inicio = Date.now()
  const supabase = serverSupabaseServiceRole(event)

  const { fechaLima, inicioISO, finISO } = getLimaTodayWindow()

  const tablas = [
    { tabla: 'PacientesBDwppHEALUP', canal: 'whatsapp' },
    { tabla: 'PacientesBDfbigHEALUP', canal: 'facebook_instagram' },
    { tabla: 'PacientesBDtiktokHEALUP', canal: 'tiktok' }
  ]

  const pacientesPorCanal: Record<string, any[]> = {
    whatsapp: [],
    facebook_instagram: [],
    tiktok: []
  }
  const errorsByTabla: Record<string, string> = {}

  await Promise.all(
    tablas.map(async ({ tabla, canal }) => {
      try {
        const { data, error } = await supabase
          .from(tabla)
          .select('*')
          .gte('created_at', inicioISO)
          .lte('created_at', finISO)
          .order('created_at', { ascending: true })

        if (error) {
          errorsByTabla[tabla] = error.message
          return
        }
        pacientesPorCanal[canal] = (data || []).map((p: any) => ({
          ...p,
          _origen_tabla: tabla,
          _canal: canal
        }))
      } catch (e: any) {
        errorsByTabla[tabla] = e?.message || String(e)
      }
    })
  )

  const pacientesWpp = pacientesPorCanal.whatsapp
  const pacientesFbIg = pacientesPorCanal.facebook_instagram
  const pacientesTiktok = pacientesPorCanal.tiktok
  const todosPacientes = [...pacientesWpp, ...pacientesFbIg, ...pacientesTiktok]
  const totalCount = todosPacientes.length

  // ── Payload para n8n ─────────────────────────────────────────────
  const payload: any = {
    evento: 'healup.agendamiento_diario',
    empresa: 'Healup',
    fecha_lima: fechaLima,
    enviado_at_utc: new Date().toISOString(),
    enviado_at_lima: new Date(Date.now() + LIMA_OFFSET_HOURS * 3600 * 1000)
      .toISOString().replace('Z', '-05:00'),
    origen: opts.origen,
    ventana: { desde_utc: inicioISO, hasta_utc: finISO, tz: 'America/Lima' },
    resumen: {
      total_pacientes: totalCount,
      por_canal: {
        whatsapp: pacientesWpp.length,
        facebook_instagram: pacientesFbIg.length,
        tiktok: pacientesTiktok.length
      },
      errores_por_tabla: Object.keys(errorsByTabla).length ? errorsByTabla : null
    },
    pacientes: todosPacientes
  }

  const webhookUrl = process.env.N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO || null

  let status: 'success' | 'error' | 'empty' = totalCount === 0 ? 'empty' : 'success'
  let respuestaN8n: any = null
  let httpStatus: number | null = null
  let errorMessage: string | null = null

  if (!webhookUrl) {
    status = 'error'
    errorMessage =
      'N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO no está configurado en el .env del servidor'
  } else {
    try {
      const respN8n = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      httpStatus = respN8n.status
      const textBody = await respN8n.text()
      let parsed: any = textBody
      try { parsed = JSON.parse(textBody) } catch { /* keep as text */ }
      respuestaN8n = parsed
      if (!respN8n.ok) {
        status = 'error'
        errorMessage = `HTTP ${respN8n.status} ${respN8n.statusText}`
      }
    } catch (e: any) {
      status = 'error'
      errorMessage = e?.message || String(e)
      console.error('[healup-agendamientos] Error enviando a n8n:', errorMessage)
    }
  }

  const duracionMs = Date.now() - inicio

  // ── Guardar log ──────────────────────────────────────────────────
  let logId: number | null = null
  try {
    const { data: inserted, error: insErr } = await supabase
      .from('healup_agendamiento_diario_logs')
      .insert({
        fecha_lima: fechaLima,
        origen: opts.origen,
        triggered_by_email: opts.triggered_by_email || null,
        status,
        pacientes_count: totalCount,
        pacientes_wpp_count: pacientesWpp.length,
        pacientes_fbig_count: pacientesFbIg.length,
        pacientes_tiktok_count: pacientesTiktok.length,
        webhook_url: webhookUrl,
        payload_enviado: payload,
        respuesta_n8n: respuestaN8n,
        http_status: httpStatus,
        error_message: errorMessage,
        duracion_ms: duracionMs
      } as any)
      .select('id')
      .single()
    if (insErr) {
      console.error('[healup-agendamientos] Error guardando log:', insErr.message)
    } else {
      logId = inserted?.id || null
    }
  } catch (e: any) {
    console.error('[healup-agendamientos] Excepción guardando log:', e?.message)
  }

  console.log(
    `[healup-agendamientos] ${fechaLima} | origen=${opts.origen} | status=${status} ` +
    `| pacientes=${totalCount} (wpp:${pacientesWpp.length}, fbig:${pacientesFbIg.length}, tk:${pacientesTiktok.length}) ` +
    `| duración=${duracionMs}ms`
  )

  return {
    fecha_lima: fechaLima,
    status,
    pacientes_count: totalCount,
    pacientes_wpp_count: pacientesWpp.length,
    pacientes_fbig_count: pacientesFbIg.length,
    pacientes_tiktok_count: pacientesTiktok.length,
    http_status: httpStatus,
    error_message: errorMessage,
    duracion_ms: duracionMs,
    log_id: logId,
    webhook_configurado: Boolean(webhookUrl)
  }
}
