/**
 * GET /api/piola/reportes — ejecución de los reportes programados (§9)
 *
 * Llamado por la Netlify Scheduled Function todos los días:
 *   ?api_key=$PIOLA_CRON_KEY
 * y decide qué reportes TOCAN hoy según su frecuencia y día de ejecución.
 *
 * También sirve para el panel:
 *   (sin api_key, con sesión) → devuelve configuración + historial de corridas
 *   ?tipo=financiero&periodo=YYYY-MM&preview=1 → arma el reporte SIN enviarlo
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, hoyLima, enviarCorreoPiola, enviarWhatsappPiola } from '../../utils/piola'
import { generarReporte } from '../../utils/piola-reportes'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const q = getQuery(event)

  const claveCron = process.env.PIOLA_CRON_KEY
  const esCron = !!claveCron && String(q.api_key || '') === claveCron

  let quien = 'cron'
  if (!esCron) {
    const perfil = await verificarSesionPiola(event, supabase)
    quien = perfil.email
  }

  const hoy = hoyLima()
  const periodoDefault = hoy.slice(0, 7)

  /* ── Vista previa de un reporte puntual (no envía nada) ── */
  if (q.preview && q.tipo) {
    const reporte = await generarReporte(supabase, String(q.tipo), String(q.periodo || periodoDefault))
    return { ok: true, preview: true, reporte }
  }

  /* ── Panel: configuración + historial ── */
  if (!esCron && !q.run) {
    const [{ data: programados }, { data: corridas }] = await Promise.all([
      supabase.from('piola_scheduled_reports').select('*').order('tipo'),
      supabase.from('piola_report_runs').select('*').order('created_at', { ascending: false }).limit(Number(q.limit) || 50),
    ])
    return { ok: true, programados: programados || [], corridas: corridas || [] }
  }

  /* ── Ejecución ── */
  const { data: programados } = await supabase
    .from('piola_scheduled_reports').select('*').eq('activo', true)

  const diaMes = Number(hoy.slice(8, 10))
  const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay()   // 0 = domingo

  const forzado = q.tipo ? String(q.tipo) : null
  const resultados: any[] = []

  for (const r of programados || []) {
    // ¿Toca hoy?
    let toca = false
    if (forzado) toca = r.tipo === forzado
    else if (r.frecuencia === 'mensual') toca = diaMes === Number(r.dia_ejecucion || 1)
    else if (r.frecuencia === 'quincenal') toca = diaMes === 1 || diaMes === Number(r.dia_ejecucion || 15)
    else if (r.frecuencia === 'semanal') toca = diaSemana === Number(r.dia_ejecucion ?? 1)
    if (!toca) continue

    const inicio = Date.now()
    // Los reportes mensuales que corren el día 1 hablan del mes que acaba de cerrar
    let periodo = String(q.periodo || periodoDefault)
    if (!q.periodo && r.frecuencia === 'mensual' && diaMes <= 3) {
      const [yy, mm] = periodoDefault.split('-').map(Number)
      periodo = new Date(Date.UTC(yy, mm - 2, 1)).toISOString().slice(0, 7)
    }

    let status: 'success' | 'error' | 'empty' = 'success'
    let errorMessage: string | null = null
    let respuesta: any = null

    try {
      const reporte = await generarReporte(supabase, r.tipo, periodo)
      if (reporte.vacio) status = 'empty'

      const destinatarios = r.destinatarios || []
      if (!destinatarios.length) {
        status = 'error'
        errorMessage = 'El reporte no tiene destinatarios configurados'
      } else {
        const envios: any = {}
        if (r.canal === 'correo' || r.canal === 'ambos') {
          envios.correo = await enviarCorreoPiola({
            to: destinatarios.filter((d: string) => d.includes('@')),
            subject: `${r.nombre} — ${periodo}`,
            html: reporte.html,
          })
          if (!envios.correo.ok) { status = 'error'; errorMessage = envios.correo.error }
        }
        if (r.canal === 'whatsapp' || r.canal === 'ambos') {
          envios.whatsapp = await enviarWhatsappPiola({
            evento: 'piola.reporte',
            empresa: 'Piola',
            tipo: r.tipo,
            periodo,
            destinatarios: destinatarios.filter((d: string) => !d.includes('@')),
            mensaje_whatsapp: reporte.mensaje_whatsapp,
            datos: reporte.datos,
          })
          if (!envios.whatsapp.ok) { status = 'error'; errorMessage = envios.whatsapp.error || errorMessage }
        }
        respuesta = envios
      }

      await supabase.from('piola_report_runs').insert({
        report_id: r.id, tipo: r.tipo, periodo,
        origen: esCron ? 'cron' : 'manual',
        triggered_by: quien,
        status,
        payload: { datos: reporte.datos, mensaje_whatsapp: reporte.mensaje_whatsapp },
        respuesta,
        error_message: errorMessage,
        duracion_ms: Date.now() - inicio,
      })

      await supabase.from('piola_scheduled_reports')
        .update({ last_run_at: new Date().toISOString() }).eq('id', r.id)

      resultados.push({ tipo: r.tipo, periodo, status, error: errorMessage })
    } catch (e: any) {
      await supabase.from('piola_report_runs').insert({
        report_id: r.id, tipo: r.tipo, periodo,
        origen: esCron ? 'cron' : 'manual', triggered_by: quien,
        status: 'error', error_message: e?.message || String(e),
        duracion_ms: Date.now() - inicio,
      })
      resultados.push({ tipo: r.tipo, periodo, status: 'error', error: e?.message })
    }
  }

  console.log(`[piola/reportes] ${hoy} · ${resultados.length} reporte(s) ejecutado(s) por ${quien}`)
  return { ok: true, fecha: hoy, origen: esCron ? 'cron' : 'manual', ejecutados: resultados.length, resultados }
})
