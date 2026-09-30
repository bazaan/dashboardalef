/**
 * Envío de la plantilla de WhatsApp de Trade Cars por Chatwoot (botón "WhatsApp" de las tarjetas
 * de "Solicitudes - formularios").
 *
 * Cuenta 17 / bandeja 88 ("Trade Cars Perú", WhatsApp Cloud). La plantilla la aprueba Meta y
 * Chatwoot la sincroniza en la bandeja (`message_templates`): se lee de ahí en vez de escribirla en
 * el código, así un cambio de texto en Meta se refleja solo.
 *
 * Detalles que no son obvios:
 *  - La conversación nueva se crea YA ASIGNADA al asesor de la tarjeta. El flujo de n8n
 *    "ASIGNACION ASESOR-TRADECARS" solo reparte conversaciones que nacen SIN asesor
 *    (`conversation_created` + `!meta.assignee`), así que no la pisa.
 *  - Se crea la conversación vacía y DESPUÉS se manda el mensaje con `template_params` por el
 *    endpoint normal de mensajes (el camino más probado de Chatwoot para plantillas).
 *  - Chatwoot acepta el mensaje al instante, pero Meta puede rechazarlo segundos después (número
 *    sin WhatsApp, tope de plantillas de marketing por usuario…). Por eso se vuelve a leer el
 *    estado del mensaje unos segundos después y se informa.
 */

export const CW_BASE = 'https://chats.alef.company'
export const CW_ACCOUNT = Number(process.env.TRADECARS_CHATWOOT_ACCOUNT_ID || 17)
export const CW_INBOX_WHATSAPP = Number(process.env.TRADECARS_WHATSAPP_INBOX_ID || 88)
export const PLANTILLA_INICIAR = process.env.TRADECARS_WHATSAPP_PLANTILLA || 'iniciar_conversacion_2'

export const tokenChatwoot = () => process.env.CHATWOOT_API_TOKEN || ''
export const urlConversacion = (id: number | string) => `${CW_BASE}/app/accounts/${CW_ACCOUNT}/conversations/${id}`

export class ErrorWhatsapp extends Error {
  constructor(mensaje: string, public status = 502) { super(mensaje) }
}

async function cw<T = any>(ruta: string, opciones: { method?: string; body?: any } = {}): Promise<T> {
  const token = tokenChatwoot()
  if (!token) throw new ErrorWhatsapp('Falta configurar CHATWOOT_API_TOKEN en Netlify.', 500)
  const r = await fetch(`${CW_BASE}/api/v1/accounts/${CW_ACCOUNT}${ruta}`, {
    method: opciones.method || 'GET',
    headers: { api_access_token: token, 'Content-Type': 'application/json' },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  })
  const texto = await r.text()
  let json: any = null
  try { json = texto ? JSON.parse(texto) : null } catch { /* no JSON */ }
  if (!r.ok) {
    const detalle = json?.message || json?.error || (Array.isArray(json?.errors) ? json.errors.join(', ') : '') || texto.slice(0, 200)
    const e = new ErrorWhatsapp(`Chatwoot respondió ${r.status}: ${detalle}`)
    ;(e as any).httpStatus = r.status
    throw e
  }
  return json as T
}

/* ══════════ Teléfono ══════════ */

/** Celular peruano → E.164. Acepta "999096180", "51999096180", "+51 999 096 180", "p:+51999096180". */
export function aE164(crudo: any): string | null {
  const s = String(crudo ?? '').trim()
  let d = s.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 9 && d.startsWith('9')) return `+51${d}`
  if (d.length === 11 && d.startsWith('519')) return `+${d}`
  // Número extranjero escrito con su código de país
  if (/^\s*(p:)?\+/.test(s) && d.length >= 8 && d.length <= 15) return `+${d}`
  return null
}

/* ══════════ Plantilla y agentes (con caché corta) ══════════ */

export interface PlantillaWhatsapp {
  nombre: string
  idioma: string
  categoria: string
  encabezado: string | null
  cuerpo: string
  botones: string[]
  variables: number
}

let cachePlantilla: { valor: PlantillaWhatsapp; hasta: number } | null = null
let cacheAgentes: { valor: any[]; hasta: number } | null = null
const DIEZ_MIN = 10 * 60 * 1000

export async function obtenerPlantilla(): Promise<PlantillaWhatsapp> {
  if (cachePlantilla && Date.now() < cachePlantilla.hasta) return cachePlantilla.valor
  const inbox = await cw<any>(`/inboxes/${CW_INBOX_WHATSAPP}`)
  const t = (inbox?.message_templates || []).find((x: any) => x.name === PLANTILLA_INICIAR)
  if (!t) throw new ErrorWhatsapp(`La plantilla "${PLANTILLA_INICIAR}" no está sincronizada en la bandeja de WhatsApp de Chatwoot.`)
  if (t.status !== 'APPROVED') throw new ErrorWhatsapp(`La plantilla "${PLANTILLA_INICIAR}" está en estado ${t.status} en Meta, no APPROVED.`)
  const comp = (tipo: string) => (t.components || []).find((c: any) => c.type === tipo)
  const cuerpo = comp('BODY')?.text || ''
  const encabezado = comp('HEADER')?.format === 'TEXT' ? comp('HEADER')?.text || null : null
  const variables = (`${encabezado || ''} ${cuerpo}`.match(/\{\{[^}]+\}\}/g) || []).length
  const valor: PlantillaWhatsapp = {
    nombre: t.name,
    idioma: t.language,
    categoria: t.category,
    encabezado,
    cuerpo,
    botones: (comp('BUTTONS')?.buttons || []).map((b: any) => b.text),
    variables,
  }
  cachePlantilla = { valor, hasta: Date.now() + DIEZ_MIN }
  return valor
}

async function agentes(): Promise<any[]> {
  if (cacheAgentes && Date.now() < cacheAgentes.hasta) return cacheAgentes.valor
  const lista = await cw<any[]>('/agents')
  cacheAgentes = { valor: Array.isArray(lista) ? lista : [], hasta: Date.now() + DIEZ_MIN }
  return cacheAgentes.valor
}

/** Agente de Chatwoot con el mismo correo que el asesor de la tarjeta (los 4 asesores coinciden). */
export async function agentePorEmail(email: string | null | undefined): Promise<{ id: number; nombre: string } | null> {
  if (!email) return null
  const e = String(email).trim().toLowerCase()
  const a = (await agentes()).find(x => String(x.email || '').trim().toLowerCase() === e)
  return a ? { id: Number(a.id), nombre: a.name || a.available_name || e } : null
}

async function nombreAgente(id: number | null | undefined): Promise<string | null> {
  if (!id) return null
  const a = (await agentes()).find(x => Number(x.id) === Number(id))
  return a ? (a.name || a.available_name || null) : null
}

/* ══════════ Contacto y conversación ══════════ */

async function buscarContacto(e164: string): Promise<any | null> {
  const r = await cw<any>(`/contacts/search?q=${encodeURIComponent(e164.replace('+', ''))}&include_contacts=true`)
  const lista: any[] = r?.payload || []
  return lista.find(c => String(c.phone_number || '').replace(/\s/g, '') === e164) || null
}

async function obtenerContacto(e164: string, nombre: string): Promise<{ contacto: any; nuevo: boolean }> {
  const existente = await buscarContacto(e164)
  if (existente) return { contacto: existente, nuevo: false }
  try {
    const r = await cw<any>('/contacts', {
      method: 'POST',
      body: { inbox_id: CW_INBOX_WHATSAPP, name: nombre || e164, phone_number: e164 },
    })
    const contacto = r?.payload?.contact || r?.payload || r
    if (!contacto?.id) throw new ErrorWhatsapp('Chatwoot no devolvió el contacto creado.')
    return { contacto, nuevo: true }
  } catch (e: any) {
    // Otro envío pudo crearlo entre la búsqueda y la creación ("phone number has already been taken")
    if (e?.httpStatus === 422) {
      const otra = await buscarContacto(e164)
      if (otra) return { contacto: otra, nuevo: false }
    }
    throw e
  }
}

/** Conversación abierta (o pendiente) del contacto en la bandeja de WhatsApp, la más reciente. */
async function conversacionAbierta(contactId: number): Promise<any | null> {
  const r = await cw<any>(`/contacts/${contactId}/conversations`)
  const lista: any[] = r?.payload || []
  return lista
    .filter(c => Number(c.inbox_id) === CW_INBOX_WHATSAPP && (c.status === 'open' || c.status === 'pending'))
    .sort((a, b) => Number(b.last_activity_at || b.created_at || 0) - Number(a.last_activity_at || a.created_at || 0))[0] || null
}

export interface PlanEnvio {
  e164: string
  contacto_id: number | null
  contacto_nuevo: boolean
  conversacion_id: number | null
  conversacion_nueva: boolean
  asignado_agente_id: number | null
  asignado_nombre: string | null
  asignacion: 'nueva_asignada' | 'se_asigna' | 'ya_asignada_a_otro' | 'ya_asignada' | 'sin_asesor'
}

/**
 * Envía la plantilla a `telefono`. Con `simular = true` hace solo las lecturas y dice qué haría
 * (no crea contacto, conversación ni mensaje): sirve para diagnosticar sin gastar un envío.
 */
export async function enviarPlantilla(opts: {
  telefono: string
  nombre: string
  asesorEmail: string | null
  simular?: boolean
}): Promise<PlanEnvio & { mensaje_id: number | null; estado_whatsapp: string | null; error_whatsapp: string | null; plantilla: PlantillaWhatsapp }> {
  const e164 = aE164(opts.telefono)
  if (!e164) throw new ErrorWhatsapp(`El celular "${opts.telefono}" no es un número de WhatsApp válido.`, 400)

  const plantilla = await obtenerPlantilla()
  if (plantilla.variables > 0) {
    throw new ErrorWhatsapp(`La plantilla "${plantilla.nombre}" tiene variables y el dashboard todavía no sabe llenarlas.`, 500)
  }
  const agente = await agentePorEmail(opts.asesorEmail)

  // ── Contacto ──
  let contacto: any = null
  let contactoNuevo = false
  if (opts.simular) {
    contacto = await buscarContacto(e164)
    contactoNuevo = !contacto
  } else {
    ;({ contacto, nuevo: contactoNuevo } = await obtenerContacto(e164, opts.nombre))
  }

  // ── Conversación ──
  const abierta = contacto?.id ? await conversacionAbierta(Number(contacto.id)) : null
  const asignadoActual = abierta?.meta?.assignee?.id ? Number(abierta.meta.assignee.id) : null

  const plan: PlanEnvio = {
    e164,
    contacto_id: contacto?.id ? Number(contacto.id) : null,
    contacto_nuevo: contactoNuevo,
    conversacion_id: abierta?.id ? Number(abierta.id) : null,
    conversacion_nueva: !abierta,
    asignado_agente_id: null,
    asignado_nombre: null,
    asignacion: 'sin_asesor',
  }
  if (!abierta) {
    plan.asignado_agente_id = agente?.id ?? null
    plan.asignado_nombre = agente?.nombre ?? null
    plan.asignacion = agente ? 'nueva_asignada' : 'sin_asesor'
  } else if (asignadoActual) {
    // Ya la atiende alguien: no se le quita (puede ser el mismo asesor por continuidad).
    plan.asignado_agente_id = asignadoActual
    plan.asignado_nombre = abierta.meta?.assignee?.name || await nombreAgente(asignadoActual)
    plan.asignacion = agente && agente.id === asignadoActual ? 'ya_asignada' : 'ya_asignada_a_otro'
  } else if (agente) {
    plan.asignado_agente_id = agente.id
    plan.asignado_nombre = agente.nombre
    plan.asignacion = 'se_asigna'
  }

  if (opts.simular) {
    return { ...plan, mensaje_id: null, estado_whatsapp: null, error_whatsapp: null, plantilla }
  }

  if (!abierta) {
    const conv = await cw<any>('/conversations', {
      method: 'POST',
      body: {
        contact_id: plan.contacto_id,
        inbox_id: CW_INBOX_WHATSAPP,
        status: 'open',
        ...(agente ? { assignee_id: agente.id } : {}),
      },
    })
    plan.conversacion_id = Number(conv?.id)
    if (!plan.conversacion_id) throw new ErrorWhatsapp('Chatwoot no devolvió la conversación creada.')
  } else if (plan.asignacion === 'se_asigna') {
    await cw(`/conversations/${plan.conversacion_id}/assignments`, { method: 'POST', body: { assignee_id: agente!.id } })
  }

  const contenido = [plantilla.encabezado, plantilla.cuerpo].filter(Boolean).join('\n\n')
  const msg = await cw<any>(`/conversations/${plan.conversacion_id}/messages`, {
    method: 'POST',
    body: {
      content: contenido,
      message_type: 'outgoing',
      template_params: {
        name: plantilla.nombre,
        category: plantilla.categoria,
        language: plantilla.idioma,
        processed_params: {},
      },
    },
  })
  const mensajeId = msg?.id ? Number(msg.id) : null

  // Meta confirma o rechaza unos segundos después: se revisa dos veces antes de responder.
  let estado: string | null = msg?.status || null
  let errorWa: string | null = null
  for (let i = 0; i < 2 && mensajeId; i++) {
    await new Promise(r => setTimeout(r, 2500))
    try {
      const lista = await cw<any>(`/conversations/${plan.conversacion_id}/messages`)
      const m = (lista?.payload || []).find((x: any) => Number(x.id) === mensajeId)
      if (m) {
        estado = m.status || estado
        errorWa = m.content_attributes?.external_error || null
      }
      if (estado === 'failed' || estado === 'delivered' || estado === 'read') break
    } catch { /* solo diagnóstico */ }
  }

  return { ...plan, mensaje_id: mensajeId, estado_whatsapp: estado, error_whatsapp: errorWa, plantilla }
}
