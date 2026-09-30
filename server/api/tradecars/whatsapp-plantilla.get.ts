/**
 * GET /api/tradecars/whatsapp-plantilla?canal=web|ig|fb|tiktok|sin_plataforma
 *
 * Lo que necesitan las tarjetas para el botón "WhatsApp":
 *  - `plantilla`: encabezado, cuerpo y botones tal como están aprobados en Meta (leídos de Chatwoot),
 *    para mostrarlos en la confirmación antes de enviar.
 *  - `envios`: el último envío de cada tarjeta de ese canal ({ [tarjeta_ref]: envío }).
 * Un asesor solo recibe los envíos de sus tarjetas.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import { resolverRestriccionAsesor } from '../../utils/tradecars-asignacion'
import { obtenerPlantilla, tokenChatwoot, urlConversacion } from '../../utils/tradecars-whatsapp'

const CANALES = ['web', 'ig', 'fb', 'tiktok', 'sin_plataforma']
const faltaTabla = (error: any, status?: number) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || status === 404 || /does not exist|schema cache/i.test(String(error.message || '')))

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'comercial', 'view')
  setHeader(event, 'Cache-Control', 'no-store')

  const canal = String(getQuery(event).canal || '')
  if (!CANALES.includes(canal)) throw createError({ statusCode: 400, statusMessage: `Canal desconocido: ${canal}` })

  let plantilla = null
  let plantilla_error: string | null = null
  if (tokenChatwoot()) {
    try { plantilla = await obtenerPlantilla() } catch (e: any) { plantilla_error = e?.message || 'No se pudo leer la plantilla' }
  } else {
    plantilla_error = 'Falta configurar CHATWOOT_API_TOKEN en Netlify.'
  }

  const restriccion = await resolverRestriccionAsesor(perfil, supabase)
  let q = supabase.from('tradecars_whatsapp_envios')
    .select('id,canal,tarjeta_ref,telefono,estado,estado_whatsapp,error,chatwoot_conversation_id,asignado_nombre,asesor_email,enviado_por,enviado_en')
    .eq('canal', canal).order('enviado_en', { ascending: false }).limit(5000)
  if (restriccion.restringir) q = q.ilike('asesor_email', restriccion.asesorEmail || '__nadie__')
  const { data, error, status } = await q
  if (error && !faltaTabla(error, status)) throw createError({ statusCode: 400, statusMessage: error.message })

  const envios: Record<string, any> = {}
  for (const e of data || []) {
    if (envios[e.tarjeta_ref]) continue
    envios[e.tarjeta_ref] = { ...e, url_conversacion: e.chatwoot_conversation_id ? urlConversacion(e.chatwoot_conversation_id) : null }
  }

  return {
    ok: true,
    plantilla,
    plantilla_error,
    envios,
    falta_sql: error ? 'sql/tradecars_whatsapp_envios.sql' : null,
  }
})
