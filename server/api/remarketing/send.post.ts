/**
 * Remarketing — Enviar mensaje individual via Chatwoot WhatsApp.
 *
 * Body: {
 *   company_id: string,
 *   lead_id: number,
 *   lead_tabla: string,        // ej: "GeneralBDwppHEALUP"
 *   lead_telefono: string,     // con prefijo 51
 *   lead_nombre: string,
 *   template_id?: number,      // ID de remarketing_templates (opcional)
 *   mensaje: string,           // Mensaje ya interpolado
 *   canal?: 'whatsapp' | 'email'
 * }
 *
 * Flujo: busca/crea contacto en Chatwoot → crea conversacion → envia mensaje template.
 * Registra en remarketing_contactos para tracking anti-spam.
 */

const CHATWOOT_BASE = 'https://chats.alef.company'
const CHATWOOT_TOKEN = process.env.CHATWOOT_API_TOKEN || 'xBsW4FE3FCZdZbgXgdjrHfUA'

export default defineEventHandler(async (event) => {
  // Auth
  const cookies = parseCookies(event)
  const sessionRaw = cookies.dashboard_session
  if (!sessionRaw) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  const body = await readBody(event)
  const { company_id, lead_id, lead_tabla, lead_telefono, lead_nombre, template_id, mensaje, canal } = body || {}

  if (!company_id || !lead_telefono || !mensaje) {
    throw createError({ statusCode: 400, statusMessage: 'company_id, lead_telefono y mensaje son requeridos' })
  }

  // Obtener config de Chatwoot para esta empresa
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY!
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  }

  // Buscar config
  const configResp = await $fetch<any[]>(`${supabaseUrl}/rest/v1/remarketing_config?company_id=eq.${company_id}&limit=1`, { headers })
  if (!configResp?.length) {
    throw createError({ statusCode: 404, statusMessage: `No hay config de remarketing para ${company_id}` })
  }
  const config = configResp[0]
  const accountId = config.chatwoot_account_id
  const inboxId = config.chatwoot_inbox_id || 1

  // Check anti-spam: ultimo mensaje enviado a este lead
  const antiSpamResp = await $fetch<any[]>(
    `${supabaseUrl}/rest/v1/remarketing_contactos?company_id=eq.${company_id}&lead_id=eq.${lead_id}&lead_tabla=eq.${lead_tabla}&order=enviado_at.desc&limit=1`,
    { headers }
  )
  if (antiSpamResp?.length) {
    const ultimo = antiSpamResp[0]
    const horasDesde = (Date.now() - new Date(ultimo.enviado_at).getTime()) / (1000 * 60 * 60)
    // Determinar cadencia segun temperatura del lead (simplificado — usamos la cadencia de caliente como minimo)
    const minHoras = config.cadencia_caliente_horas || 48
    if (horasDesde < minHoras) {
      throw createError({
        statusCode: 429,
        statusMessage: `Anti-spam: ultimo mensaje hace ${Math.round(horasDesde)}h. Minimo ${minHoras}h entre mensajes.`
      })
    }
  }

  const chatwootApi = `${CHATWOOT_BASE}/api/v1/accounts/${accountId}`
  const chatwootHeaders = {
    'api_access_token': CHATWOOT_TOKEN,
    'Content-Type': 'application/json'
  }

  try {
    // Normalizar telefono: quitar 51 prefix si tiene, Chatwoot quiere +51...
    const phone = lead_telefono.startsWith('+') ? lead_telefono : `+${lead_telefono}`

    // 1. Buscar contacto existente por telefono
    let contactId: number | null = null
    try {
      const searchResp = await $fetch<any>(`${chatwootApi}/contacts/search?q=${encodeURIComponent(phone)}&include_contacts=true`, {
        headers: chatwootHeaders
      })
      const contacts = searchResp?.payload || []
      if (contacts.length > 0) {
        contactId = contacts[0].id
      }
    } catch {}

    // 2. Si no existe, crear contacto
    if (!contactId) {
      const createResp = await $fetch<any>(`${chatwootApi}/contacts`, {
        method: 'POST',
        headers: chatwootHeaders,
        body: {
          name: lead_nombre || 'Lead',
          phone_number: phone,
          inbox_id: inboxId
        }
      })
      contactId = createResp?.payload?.contact?.id || createResp?.id
    }

    if (!contactId) {
      throw new Error('No se pudo crear/encontrar contacto en Chatwoot')
    }

    // 3. Crear conversacion (o encontrar existente abierta)
    let conversationId: number | null = null
    try {
      const convsResp = await $fetch<any>(`${chatwootApi}/contacts/${contactId}/conversations`, {
        headers: chatwootHeaders
      })
      const convs = convsResp?.payload || []
      const open = convs.find((c: any) => c.inbox_id === inboxId && c.status === 'open')
      if (open) conversationId = open.id
    } catch {}

    if (!conversationId) {
      const newConv = await $fetch<any>(`${chatwootApi}/conversations`, {
        method: 'POST',
        headers: chatwootHeaders,
        body: {
          contact_id: contactId,
          inbox_id: inboxId,
          status: 'open',
          message: { content: mensaje }
        }
      })
      conversationId = newConv?.id
    } else {
      // Enviar mensaje en conversacion existente
      await $fetch<any>(`${chatwootApi}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: chatwootHeaders,
        body: {
          content: mensaje,
          message_type: 'outgoing',
          content_type: 'text'
        }
      })
    }

    // 4. Registrar en remarketing_contactos
    await $fetch(`${supabaseUrl}/rest/v1/remarketing_contactos`, {
      method: 'POST',
      headers,
      body: {
        company_id,
        lead_id: lead_id || 0,
        lead_tabla: lead_tabla || '',
        lead_telefono: lead_telefono,
        lead_nombre: lead_nombre || '',
        template_id: template_id || null,
        canal: canal || 'whatsapp',
        mensaje,
        enviado_at: new Date().toISOString(),
        estado: 'enviado'
      }
    })

    return {
      ok: true,
      contact_id: contactId,
      conversation_id: conversationId,
      mensaje_enviado: true
    }

  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[remarketing/send] Error:', err?.data || err?.message || err)
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || 'Error enviando mensaje de remarketing'
    })
  }
})
