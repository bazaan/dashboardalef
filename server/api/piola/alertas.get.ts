/**
 * GET /api/piola/alertas — motor de alertas (§4)
 *
 * Dos formas de llamarlo:
 *   • Cron (Netlify Scheduled Function):  ?api_key=$PIOLA_CRON_KEY&run=1
 *   • Sesión del dashboard:               ?run=1   (dispara), sin `run` solo lista
 *
 * Con `run=1` recorre lo que vence pronto, guarda las alertas nuevas y las
 * manda por WhatsApp. Sin `run` devuelve el historial para el panel.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, hoyLima } from '../../utils/piola'
import { generarAlertas, persistirYEnviar } from '../../utils/piola-alertas'

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

  /* ── Solo lectura: historial para el panel ── */
  if (!q.run) {
    const { data } = await supabase.from('piola_alerts').select('*')
      .order('created_at', { ascending: false }).limit(Number(q.limit) || 100)
    const { data: settings } = await supabase.from('piola_alert_settings').select('*').order('tipo')
    return { ok: true, alertas: data || [], settings: settings || [] }
  }

  /* ── Ejecutar el motor ── */
  const inicio = Date.now()
  const hoy = hoyLima()
  const alertas = await generarAlertas(supabase, hoy)
  const resultado = await persistirYEnviar(supabase, alertas)

  console.log(`[piola/alertas] ${hoy} · ${resultado.generadas} detectadas · ${resultado.nuevas} nuevas · `
    + `${resultado.enviadas} enviadas · disparado por ${quien}`)

  return {
    ok: true,
    fecha: hoy,
    origen: esCron ? 'cron' : 'manual',
    disparado_por: quien,
    duracion_ms: Date.now() - inicio,
    ...resultado,
  }
})
