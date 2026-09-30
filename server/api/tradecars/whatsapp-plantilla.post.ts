/**
 * POST /api/tradecars/whatsapp-plantilla — botón "WhatsApp" de una tarjeta de Solicitudes - formularios.
 *
 * Body: { canal: 'web'|'ig'|'fb'|'tiktok'|'sin_plataforma', ref, reenviar?, simular? }
 *   ref: web → 'venta:<uuid>' | 'compra:<uuid>'; hojas → lead_key de la tarjeta
 *
 * Envía la plantilla aprobada (iniciar_conversacion_2) por Chatwoot y asigna la conversación al
 * asesor de la tarjeta. Ver server/utils/tradecars-whatsapp.ts.
 *
 * - El teléfono, el nombre y el asesor salen de la FUENTE (la solicitud web o la hoja de Google),
 *   nunca del navegador: por acá no se puede mandar la plantilla a un número cualquiera.
 * - Un asesor solo puede enviar desde SUS tarjetas (mismo control que "Guardar").
 * - Si la tarjeta ya tiene un envío, responde 409 con `ya_enviado` salvo que venga `reenviar: true`
 *   (la pantalla pide una segunda confirmación): Meta cobra cada plantilla de marketing.
 * - `simular: true` no envía nada: dice a qué número, contacto, conversación y asesor iría.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars, logTasador } from '../../utils/tradecars'
import { resolverRestriccionAsesor } from '../../utils/tradecars-asignacion'
import { leerConfigHoja, leerHojaGoogle, ErrorHoja } from '../../utils/tradecars-formularios'
import { logServerActivity } from '../../utils/logger'
import {
  enviarPlantilla, ErrorWhatsapp, CW_ACCOUNT, CW_INBOX_WHATSAPP, PLANTILLA_INICIAR, urlConversacion, aE164,
} from '../../utils/tradecars-whatsapp'
import { esCanalFormulario, hojaALeads } from '../../../utils/tradecarsFormularios'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TABLA = 'tradecars_whatsapp_envios'
const SQL = 'sql/tradecars_whatsapp_envios.sql'
const faltaTabla = (error: any, status?: number) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || status === 404 || /does not exist|schema cache/i.test(String(error.message || '')))
const enmascarar = (tel: string) => tel.length > 7 ? `${tel.slice(0, 6)}***${tel.slice(-3)}` : '***'

interface Tarjeta { nombre: string; telefono: string; asesorEmail: string | null }

async function tarjetaWeb(supabase: any, ref: string): Promise<Tarjeta> {
  const [tipo, id] = ref.split(':')
  if ((tipo !== 'venta' && tipo !== 'compra') || !UUID.test(id || '')) {
    throw createError({ statusCode: 400, statusMessage: 'Tarjeta web no válida' })
  }
  const tabla = tipo === 'venta' ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  const { data, error } = await supabase.from(tabla).select('id,nombre_completo,celular,asesor_email').eq('id', id).maybeSingle()
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Solicitud no encontrada' })
  return { nombre: data.nombre_completo || '', telefono: data.celular || '', asesorEmail: data.asesor_email || null }
}

async function tarjetaHoja(supabase: any, canal: any, leadKey: string): Promise<Tarjeta> {
  const { data: estado } = await supabase.from('tradecars_formularios_estado')
    .select('asesor_email,resumen').eq('canal', canal).eq('lead_key', leadKey).maybeSingle()
  let nombre = estado?.resumen?.nombre || ''
  let telefono = estado?.resumen?.celular || ''
  // La hoja manda: la copia en `resumen` solo sirve si la fila ya no está en la hoja.
  const { config } = await leerConfigHoja(supabase, canal)
  if (config.sheet_id) {
    try {
      const hoja = await leerHojaGoogle({ sheetId: config.sheet_id, pestana: config.pestana, gid: config.gid })
      const lead = hojaALeads(hoja.valores, config.mapeo, canal).leads.find(l => l.lead_key === leadKey)
      if (lead) { nombre = lead.nombre || nombre; telefono = lead.celular || telefono }
    } catch (e: any) {
      if (!(e instanceof ErrorHoja) || !telefono) {
        throw createError({ statusCode: 502, statusMessage: `No se pudo leer la hoja para confirmar el teléfono: ${e?.message || 'error'}` })
      }
    }
  }
  if (!telefono && !estado) throw createError({ statusCode: 404, statusMessage: 'Tarjeta no encontrada' })
  return { nombre, telefono, asesorEmail: estado?.asesor_email || null }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'comercial', 'edit')

  const body = await readBody(event)
  const canal = String(body?.canal || '')
  const ref = String(body?.ref || '').slice(0, 300)
  const simular = body?.simular === true
  if (canal !== 'web' && !esCanalFormulario(canal)) throw createError({ statusCode: 400, statusMessage: `Canal desconocido: ${canal}` })
  if (!ref) throw createError({ statusCode: 400, statusMessage: 'Falta la tarjeta (ref)' })

  const tarjeta = canal === 'web' ? await tarjetaWeb(supabase, ref) : await tarjetaHoja(supabase, canal, ref)

  // Un asesor solo envía desde sus propias tarjetas (default-deny si no está registrado como asesor).
  const restriccion = await resolverRestriccionAsesor(perfil, supabase)
  if (restriccion.restringir) {
    if (!restriccion.asesorEmail) throw createError({ statusCode: 403, statusMessage: 'Tu cuenta todavía no está registrada como asesor de Trade Cars.' })
    if (!tarjeta.asesorEmail || tarjeta.asesorEmail.toLowerCase() !== restriccion.asesorEmail.toLowerCase()) {
      throw createError({ statusCode: 403, statusMessage: 'Esta tarjeta está asignada a otro asesor.' })
    }
  }
  if (!tarjeta.telefono) throw createError({ statusCode: 400, statusMessage: 'La tarjeta no tiene celular.' })

  // ¿Ya se envió? (y de paso: sin la tabla no se envía nada, para no perder el registro)
  const { data: previos, error: ePrev, status: sPrev } = await supabase.from(TABLA)
    .select('enviado_en,enviado_por,estado').eq('canal', canal).eq('tarjeta_ref', ref).eq('estado', 'enviado')
    .order('enviado_en', { ascending: false }).limit(1)
  if (ePrev && !simular) {
    if (faltaTabla(ePrev, sPrev)) throw createError({ statusCode: 409, statusMessage: `Falta correr ${SQL} en Supabase` })
    throw createError({ statusCode: 400, statusMessage: ePrev.message })
  }
  if (previos?.length && body?.reenviar !== true && !simular) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Esta tarjeta ya recibió la plantilla. Confirma si quieres reenviarla.',
      data: { ya_enviado: previos[0] },
    })
  }

  const logInput = { canal, ref, telefono: enmascarar(aE164(tarjeta.telefono) || tarjeta.telefono), asesor: tarjeta.asesorEmail, reenviar: !!body?.reenviar, simular, por: perfil.email }

  let r: Awaited<ReturnType<typeof enviarPlantilla>>
  try {
    r = await enviarPlantilla({ telefono: tarjeta.telefono, nombre: tarjeta.nombre, asesorEmail: tarjeta.asesorEmail, simular })
  } catch (e: any) {
    const mensaje = e instanceof ErrorWhatsapp ? e.message : `Error inesperado: ${e?.message || e}`
    if (!simular && !(e instanceof ErrorWhatsapp && e.status === 400)) {
      await supabase.from(TABLA).insert({
        canal, tarjeta_ref: ref, telefono: aE164(tarjeta.telefono) || tarjeta.telefono, nombre: tarjeta.nombre,
        plantilla: PLANTILLA_INICIAR, estado: 'fallido', error: mensaje.slice(0, 500),
        chatwoot_account_id: CW_ACCOUNT, chatwoot_inbox_id: CW_INBOX_WHATSAPP,
        asesor_email: tarjeta.asesorEmail, enviado_por: perfil.email,
      })
    }
    await logTasador(supabase, 'WhatsApp Plantilla', logInput, null, 'error', mensaje)
    throw createError({ statusCode: e instanceof ErrorWhatsapp ? e.status : 500, statusMessage: mensaje })
  }

  if (simular) {
    return { ok: true, simulado: true, nombre: tarjeta.nombre, telefono: r.e164, ...r, plantilla: r.plantilla.nombre }
  }

  const fallo = r.estado_whatsapp === 'failed'
  const fila = {
    canal,
    tarjeta_ref: ref,
    telefono: r.e164,
    nombre: tarjeta.nombre,
    plantilla: r.plantilla.nombre,
    estado: fallo ? 'fallido' : 'enviado',
    estado_whatsapp: r.estado_whatsapp,
    error: fallo ? (r.error_whatsapp || 'WhatsApp rechazó el mensaje') : null,
    chatwoot_account_id: CW_ACCOUNT,
    chatwoot_inbox_id: CW_INBOX_WHATSAPP,
    chatwoot_contact_id: r.contacto_id,
    chatwoot_conversation_id: r.conversacion_id,
    chatwoot_message_id: r.mensaje_id,
    conversacion_nueva: r.conversacion_nueva,
    asignado_agente_id: r.asignado_agente_id,
    asignado_nombre: r.asignado_nombre,
    asesor_email: tarjeta.asesorEmail,
    enviado_por: perfil.email,
  }
  const { data: guardado } = await supabase.from(TABLA).insert(fila)
    .select('id,canal,tarjeta_ref,telefono,estado,estado_whatsapp,error,chatwoot_conversation_id,asignado_nombre,asesor_email,enviado_por,enviado_en')
    .single()

  await logTasador(supabase, 'WhatsApp Plantilla', logInput,
    { conversacion: r.conversacion_id, nueva: r.conversacion_nueva, asignacion: r.asignacion, asignado: r.asignado_nombre, estado_whatsapp: r.estado_whatsapp },
    fallo ? 'error' : 'success', fallo ? fila.error! : undefined)
  await logServerActivity(event, perfil.email,
    `WhatsApp: plantilla ${r.plantilla.nombre} a ${tarjeta.nombre || enmascarar(r.e164)} (${canal})${fallo ? ' — FALLÓ' : ''}`, 'tradecars')

  return {
    ok: !fallo,
    envio: { ...(guardado || fila), url_conversacion: r.conversacion_id ? urlConversacion(r.conversacion_id) : null },
    asignacion: r.asignacion,
    error: fallo ? fila.error : null,
  }
})
