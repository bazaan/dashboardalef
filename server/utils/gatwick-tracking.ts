/**
 * Gatwick — utilidades del seguimiento GPS de emergencias
 * -------------------------------------------------------
 * · Aviso a los supervisores por WhatsApp (Chatwoot)
 * · Geocodificación de la dirección del edificio (Nominatim/OSM, gratis)
 * · Distancia haversine (para el geofence de "llegó al destino")
 * · Armado de los mensajes de cada estado
 */

const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL || 'https://chats.alef.company'
const CHATWOOT_TOKEN = process.env.CHATWOOT_GATWICK_TOKEN || 'AQrZAwnjzrtjpXBwwrmexUbL'

/** Radio (m) dentro del cual se considera que el técnico YA llegó al edificio. */
export const GEOFENCE_M = 200

/* ══════════════════ Geometría ══════════════════ */

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

/**
 * Geocodifica una dirección de Lima con Nominatim (OpenStreetMap).
 * Gratis y sin API key. Devuelve null si no encuentra nada.
 */
export async function geocodificar(direccion: string, distrito?: string): Promise<{ lat: number; lng: number } | null> {
  const dir = String(direccion || '').trim()
  if (!dir) return null

  // Se prueba de lo más preciso a lo más laxo: si la numeración exacta no está
  // mapeada en OSM, al menos ubicamos la calle (sirve para la ruta y el ETA).
  const sinNumero = dir.replace(/\s*(n[°º]?\s*)?\d+[a-z]?\s*$/i, '').trim()
  const intentos = [
    [dir, distrito, 'Lima', 'Perú'],
    sinNumero && sinNumero !== dir ? [sinNumero, distrito, 'Lima', 'Perú'] : null,
    distrito ? [distrito, 'Lima', 'Perú'] : null,
  ].filter(Boolean) as (string | undefined)[][]

  for (const partes of intentos) {
    const q = partes.filter(Boolean).join(', ')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${encodeURIComponent(q)}`
      const res: any = await $fetch(url, {
        headers: { 'User-Agent': 'AlefDashboard/1.0 (gatwick-tracking)' },
        timeout: 8000,
      })
      const hit = Array.isArray(res) ? res[0] : null
      if (hit?.lat && hit?.lon) {
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
      }
    } catch (e: any) {
      console.error(`[gatwick-tracking] geocodificar "${q}" falló:`, e?.message)
    }
  }
  console.warn(`[gatwick-tracking] sin coordenadas para: ${dir} (${distrito ?? '—'})`)
  return null
}

/* ══════════════════ Código de ascensor → edificio ══════════════════ */

/* ── Números dictados en palabras ─────────────────────────────────────────
 * El cliente lee el sticker por teléfono, así que el código llega de mil
 * formas: "AP17", "ap cero cero diez", "A de Ana P de Perro uno siete".
 * Retell a veces convierte las palabras a dígitos y a veces no, según cómo
 * se pronuncien. Acá se cubren ambos casos.
 */
const PALABRA_NUM: Record<string, number> = {
  cero: 0, o: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900, mil: 1000,
}

/** minúsculas, sin acentos, sin puntuación */
function plano(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/**
 * Devuelve TODOS los códigos que razonablemente pudo haber dictado el cliente.
 * Se generan varios porque "cero cero diez" admite dos lecturas —dígito por
 * dígito ("0010") o número hablado ("10" → 0010)— y a veces no coinciden.
 * Quien decide cuál es el bueno es el catálogo: se prueban todos y solo vale
 * el que existe. Si existiera más de uno, se trata como ambiguo y se vuelve a
 * preguntar, nunca se adivina.
 */
export function candidatosCodigoAscensor(bruto: string): string[] {
  let txt = plano(bruto)
  if (!txt) return []

  // Letras pronunciadas: "a pe" = AP, "eme uve" = MV, "pe de" = PD, "eme pe" = MP
  for (const [dicho, sigla] of [
    ['eme\\s*uve', 'mv'], ['eme\\s*ve', 'mv'], ['eme\\s*pe', 'mp'],
    ['a\\s*pe', 'ap'], ['pe\\s*de', 'pd'],
  ] as [string, string][]) {
    txt = txt.replace(new RegExp(`\\b${dicho}\\b`, 'g'), sigla)
  }

  // "a de ana", "p de perro" → "a", "p"  (alfabeto fonético del prompt)
  const sinFonetico = txt.replace(/\b([a-z])\s+de\s+[a-z]+/g, '$1')

  // Letras: las 2 primeras que aparezcan sueltas o pegadas, antes de los números
  const tokens = sinFonetico.split(' ')
  let letras = ''
  const numToks: string[] = []
  for (const t of tokens) {
    if (letras.length < 2) {
      const soloLetras = t.replace(/[^a-z]/g, '')
      // "ap0017" viene todo junto: separar letras de dígitos
      const m = t.match(/^([a-z]{1,2})(\d+)$/)
      if (m) { letras += m[1]; numToks.push(m[2]); continue }
      if (soloLetras && !(soloLetras in PALABRA_NUM)) {
        letras += soloLetras.slice(0, 2 - letras.length)
        const resto = t.replace(/[^0-9]/g, '')
        if (resto) numToks.push(resto)
        continue
      }
    }
    if (/^\d+$/.test(t)) { numToks.push(t); continue }
    if (t in PALABRA_NUM) { numToks.push(t); continue }
    if (t === 'y' && numToks.length) { numToks.push('y'); continue }
  }
  if (letras.length !== 2 || !numToks.length) return []
  const prefijo = letras.toUpperCase()

  // Lectura A — concatenar: "cero cero diez" → "0"+"0"+"10" = "0010"
  const concat = numToks
    .filter(t => t !== 'y')
    .map(t => (/^\d+$/.test(t) ? t : String(PALABRA_NUM[t])))
    .join('')

  // Lectura B — número hablado: "mil setecientos" → 1700, "treinta y dos" → 32.
  // Solo tiene sentido si alguna palabra vale 10 o más: si el cliente dictó
  // "uno siete" quiso decir 17, jamás 8, y ofrecer AP-0008 como alternativa
  // solo generaría falsas ambigüedades.
  const valores = numToks.filter(t => t !== 'y')
    .map(t => (/^\d+$/.test(t) ? Number(t) : PALABRA_NUM[t]))
  let suma = ''
  if (valores.some(v => v >= 10) && valores.length > 1) {
    let total = 0, parcial = 0
    for (const v of valores) {
      if (v === 1000) { total += (parcial || 1) * 1000; parcial = 0 }
      else parcial += v
    }
    suma = String(total + parcial)
  }

  const out: string[] = []
  for (const n of [concat, suma]) {
    if (!n || !/^\d{1,4}$/.test(n)) continue
    const cod = `${prefijo}-${n.padStart(4, '0')}`
    if (!out.includes(cod)) out.push(cod)
  }
  return out
}

/**
 * Normaliza lo que dictó el cliente por teléfono a `XX-0000`.
 * Devuelve la lectura más probable, o null si no hay dos letras + dígitos.
 */
export function normalizarCodigoAscensor(bruto: string): string | null {
  return candidatosCodigoAscensor(bruto)[0] ?? null
}

export interface EdificioResuelto {
  codigo: string
  edificio: any
  equipo: any
  tipo_equipo: string | null
}

/**
 * Busca el equipo dentro de `gatwick_edificios.equipos` (JSONB).
 * Solo coincidencia EXACTA: AP-0017 y AP-0117 son equipos distintos y mandar al
 * técnico al edificio equivocado en una emergencia es peor que no encontrarlo.
 *
 * Prueba todas las lecturas posibles de lo que dictó el cliente y devuelve la
 * única que exista en el catálogo. Si existen varias, no adivina: marca
 * `ambiguo` con las opciones para que el bot pida el código otra vez.
 */
export async function resolverCodigoAscensor(
  supabase: any, bruto: string,
): Promise<EdificioResuelto | null> {
  const r = await resolverCodigoAscensorDetalle(supabase, bruto)
  return r.hit
}

export interface ResolucionCodigo {
  hit: EdificioResuelto | null
  candidatos: string[]
  ambiguo: boolean
  coincidencias: string[]
}

export async function resolverCodigoAscensorDetalle(
  supabase: any, bruto: string,
): Promise<ResolucionCodigo> {
  const candidatos = candidatosCodigoAscensor(bruto)
  const vacio: ResolucionCodigo = { hit: null, candidatos, ambiguo: false, coincidencias: [] }
  if (!candidatos.length) return vacio

  const { data: edificios } = await supabase
    .from('gatwick_edificios')
    .select('id, elme, nombre, direccion, distrito, equipos, es_instalacion_critica')
    .eq('activo', true)
    .limit(2000)

  const hallados: EdificioResuelto[] = []
  for (const codigo of candidatos) {
    for (const ed of edificios || []) {
      if (!Array.isArray(ed.equipos)) continue
      const eq = ed.equipos.find((a: any) => String(a?.codigo || '').toUpperCase().trim() === codigo)
      if (eq) { hallados.push({ codigo, edificio: ed, equipo: eq, tipo_equipo: eq?.tipo ?? null }); break }
    }
  }

  const coincidencias = hallados.map(h => h.codigo)
  if (!hallados.length) return vacio
  if (hallados.length > 1) return { hit: null, candidatos, ambiguo: true, coincidencias }
  return { hit: hallados[0], candidatos, ambiguo: false, coincidencias }
}

/* ══════════════════ Chatwoot ══════════════════ */

/**
 * Envía un mensaje a las conversaciones de supervisores activas.
 *
 * `tipo` filtra la audiencia:
 *   - 'emergencia'  (default) → todos los `activo=true` (aviso de que HAY una emergencia nueva)
 *   - 'seguimiento'           → solo los que además tienen `recibe_seguimiento=true`
 *     (en_camino, atendiendo, finalizada, cancelada — el progreso del técnico)
 *
 * Así una conversación puede configurarse para recibir solo el aviso inicial,
 * o el aviso inicial + todo el progreso.
 *
 * Best-effort: si una falla, las demás igual se envían.
 */
export async function avisarSupervisores(
  supabase: any, mensaje: string, tipo: 'emergencia' | 'seguimiento' = 'emergencia',
): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0, fallidos = 0
  let destinos: any[] = []

  try {
    let query = supabase
      .from('gatwick_supervisores')
      .select('nombre, chatwoot_account_id, chatwoot_conversation_id, recibe_seguimiento')
      .eq('activo', true)
      .order('orden')
    if (tipo === 'seguimiento') query = query.eq('recibe_seguimiento', true)
    const { data } = await query
    destinos = data || []
  } catch (e: any) {
    console.error('[gatwick-tracking] no se pudo leer supervisores:', e?.message)
  }

  // Fallback por si la tabla está vacía: los 2 chats acordados con Gatwick
  // (reciben de todo, ya que sin fila en la tabla no hay forma de distinguir)
  if (!destinos.length) {
    destinos = [
      { nombre: 'Supervisor 1', chatwoot_account_id: 15, chatwoot_conversation_id: 14 },
      { nombre: 'Supervisor 2', chatwoot_account_id: 15, chatwoot_conversation_id: 59 },
    ]
  }

  for (const d of destinos) {
    const url = `${CHATWOOT_BASE}/api/v1/accounts/${d.chatwoot_account_id}/conversations/${d.chatwoot_conversation_id}/messages`
    try {
      await $fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', api_access_token: CHATWOOT_TOKEN },
        body: { content: mensaje, message_type: 'outgoing' },
        timeout: 12000,
      })
      enviados++
    } catch (e: any) {
      fallidos++
      console.error(`[gatwick-tracking] Chatwoot ${d.chatwoot_account_id}/${d.chatwoot_conversation_id} falló:`, e?.message)
    }
  }
  return { enviados, fallidos }
}

/* ══════════════════ Mensajes ══════════════════ */

function hhmm(d?: Date) {
  return (d || new Date()).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
}

/** Bloque con los datos del edificio/ascensor (se repite en varios mensajes). */
export function bloqueEmergencia(e: any): string {
  const lineas: string[] = []
  if (e.edificio_nombre || e.empresa_cliente) lineas.push(`🏢 *Edificio:* ${e.edificio_nombre || e.empresa_cliente}`)
  if (e.codigo_ascensor) lineas.push(`🛗 *Ascensor:* ${e.codigo_ascensor}${e.tipo_equipo ? ` — ${e.tipo_equipo}` : ''}`)
  else if (e.tipo_equipo) lineas.push(`🛗 *Equipo:* ${e.tipo_equipo}${e.numero_equipo ? ` ${e.numero_equipo}` : ''}`)
  if (e.direccion) lineas.push(`📍 *Dirección:* ${e.direccion}${e.distrito ? `, ${e.distrito}` : ''}`)
  if (e.elme) lineas.push(`🔖 *ELME:* ${e.elme}`)
  if (e.piso) lineas.push(`🏗️ *Piso:* ${e.piso}`)
  if (e.telefono_contacto) lineas.push(`☎️ *Contacto:* ${e.telefono_contacto}`)
  if (e.descripcion) lineas.push(`📝 *Detalle:* ${e.descripcion}`)
  return lineas.join('\n')
}

/**
 * Aviso de EMERGENCIA NUEVA reportada por la línea telefónica (Retell).
 * Mismo canal y formato que los avisos del seguimiento, pero se dispara antes:
 * cuando el bot confirma la emergencia en la llamada, no cuando el técnico sale.
 */
export function mensajeEmergenciaLlamada(e: any, extra: {
  telefonoSeguimiento?: string | null
  contactoNombre?: string | null
  atrapados?: string | null
  critico?: boolean
  codigoNoEncontrado?: boolean
  linkMonitor?: string
}): string {
  const prioridad = String(e.prioridad || 'critica').toUpperCase()
  return [
    `🚨 *EMERGENCIA REPORTADA POR LLAMADA — Prioridad ${prioridad}*`,
    `Emergencia #${e.id}${e.titulo ? ` · ${e.titulo}` : ''}`,
    extra.critico ? `\n🔴 *CASO CRÍTICO* — se reportó fuego, humo, agua, herido o dificultad para respirar.` : '',
    '',
    bloqueEmergencia(e),
    extra.atrapados ? `🧍 *Atrapados:* ${extra.atrapados}` : '',
    extra.contactoNombre ? `🙍 *Reporta:* ${extra.contactoNombre}` : '',
    extra.telefonoSeguimiento ? `📱 *WhatsApp para seguimiento:* ${extra.telefonoSeguimiento}` : '',
    extra.codigoNoEncontrado
      ? `\n⚠️ *El código dictado no está en el catálogo* — los datos del edificio son los que dio el cliente por teléfono, verificar antes de despachar.`
      : '',
    '',
    `🕐 *Reportada:* ${hhmm()}`,
    extra.linkMonitor ? `\n🖥️ Asignar técnico en el monitor:\n${extra.linkMonitor}` : '',
    '',
    `_Ya está en el monitor de emergencias. Al tocar "Comenzar" arranca el seguimiento GPS._`,
  ].filter(Boolean).join('\n')
}

export interface MensajeCtx {
  emergencia: any
  seguimiento: any
  linkSupervisor: string
  distanciaM?: number | null
  etaSegundos?: number | null
  notas?: string | null
}

/** Arma el texto de WhatsApp según el estado al que se pasó. */
export function mensajeParaEstado(estado: string, ctx: MensajeCtx): string {
  const { emergencia: e, seguimiento: s, linkSupervisor } = ctx
  const tecnico = s.tecnico_nombre || 'Técnico'
  const prioridad = String(e.prioridad || 'media').toUpperCase()
  const datos = bloqueEmergencia(e)

  if (estado === 'iniciado') {
    return [
      `🚨 *EMERGENCIA ASIGNADA — Prioridad ${prioridad}*`,
      `Emergencia #${e.id}${e.titulo ? ` · ${e.titulo}` : ''}`,
      '',
      datos,
      '',
      `👷 *Técnico asignado:* ${tecnico}`,
      s.tecnico_telefono ? `📱 ${s.tecnico_telefono}` : '',
      `🕐 *Inicio:* ${hhmm()}`,
      '',
      `🗺️ *Seguimiento en vivo del técnico:*`,
      linkSupervisor,
      '',
      `_Podrás ver su ubicación, la ruta y el tiempo estimado de llegada en tiempo real._`,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'en_camino') {
    const eta = ctx.etaSegundos ? `\n⏱️ *Llegada estimada:* ${Math.max(1, Math.round(ctx.etaSegundos / 60))} min` : ''
    const dist = ctx.distanciaM ? `\n📏 *Distancia:* ${(ctx.distanciaM / 1000).toFixed(1)} km` : ''
    return [
      `🚗 *TÉCNICO EN CAMINO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} salió hacia el edificio.`,
      `🕐 ${hhmm()}${dist}${eta}`,
      '',
      `🗺️ Seguimiento en vivo:`,
      linkSupervisor,
    ].join('\n')
  }

  if (estado === 'atendiendo') {
    return [
      `🔧 *TÉCNICO EN SITIO — ATENDIENDO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} llegó al edificio y está atendiendo la emergencia.`,
      e.codigo_ascensor ? `🛗 Ascensor: ${e.codigo_ascensor}` : '',
      `🕐 ${hhmm()}`,
      '',
      `🗺️ Seguimiento:`,
      linkSupervisor,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'finalizada') {
    const ini = s.iniciado_en ? new Date(s.iniciado_en) : null
    const durMin = ini ? Math.max(1, Math.round((Date.now() - ini.getTime()) / 60000)) : null
    return [
      `✅ *EMERGENCIA ATENDIDA*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      '',
      `👷 ${tecnico} finalizó la atención.`,
      e.codigo_ascensor ? `🛗 Ascensor: ${e.codigo_ascensor}` : '',
      durMin ? `⏱️ *Duración total:* ${durMin} min` : '',
      `🕐 *Cierre:* ${hhmm()}`,
      ctx.notas ? `\n📝 *Notas del técnico:* ${ctx.notas}` : '',
      '',
      `_El seguimiento GPS se cerró._`,
    ].filter(Boolean).join('\n')
  }

  if (estado === 'cancelada') {
    return [
      `⛔ *SEGUIMIENTO CANCELADO*`,
      `Emergencia #${e.id} · ${e.edificio_nombre || e.empresa_cliente || 'Cliente'}`,
      `👷 ${tecnico} · 🕐 ${hhmm()}`,
      ctx.notas ? `📝 ${ctx.notas}` : '',
    ].filter(Boolean).join('\n')
  }

  return `Actualización de la emergencia #${e.id}: ${estado}`
}

/* ══════════════════ Autenticación ══════════════════ */

/**
 * Verifica que quien inicia un seguimiento tenga sesión válida en el dashboard.
 * Sin esto, cualquiera con la URL del endpoint podría crear seguimientos falsos
 * y disparar WhatsApp a los supervisores de Gatwick.
 * El servidor NO confía en la cookie: re-verifica el perfil en dashboardlogin.
 */
export async function verificarSesionGatwick(event: any, supabase: any): Promise<{ email: string }> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rol = String(perfil.role ?? '').toLowerCase()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')
  if (rol !== 'superadmin' && !cid.includes('gatwick') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para Gatwick' })
  }
  return { email: perfil.email }
}

/**
 * Igual que verificarSesionGatwick, pero además exige rol ADMIN o SUPERADMIN.
 * Se usa para gestionar emergencias (editar, eliminar, resolver, cancelar):
 * un agente/técnico puede atender y cerrar SU seguimiento, pero no administrar
 * las emergencias del monitor.
 */
export async function verificarAdminGatwick(event: any, supabase: any): Promise<{ email: string; role: string }> {
  let email: string | null = null
  const cookie = getCookie(event, 'dashboard_session')
  if (cookie) {
    try {
      const s = typeof cookie === 'string' ? JSON.parse(cookie) : cookie
      if (s?.email) email = String(s.email)
    } catch { /* cookie ilegible */ }
  }
  if (!email) throw createError({ statusCode: 401, statusMessage: 'No hay sesión' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rol = String(perfil.role ?? '').toLowerCase().trim()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')

  if (rol !== 'superadmin' && rol !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Solo un administrador puede gestionar las emergencias.',
    })
  }
  // Un admin solo administra las emergencias de SU empresa
  if (rol !== 'superadmin' && !cid.includes('gatwick') && !cid.includes('alef')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para Gatwick' })
  }
  return { email: perfil.email, role: rol }
}

/** ¿Este company_id es Gatwick? Mismo criterio que canAccessGatwick en utils/permissions.ts */
export function esGatwick(companyId?: string | null): boolean {
  const cid = String(companyId ?? '').toLowerCase().trim()
  return cid === 'gatwick' || cid === 'gatwick ascensores' || cid.includes('gatwick')
}

/**
 * Sincroniza (adicional, NUNCA bloqueante) las cuentas de Gatwick creadas/editadas
 * en `dashboardlogin` con las tablas propias del módulo de emergencias, para que
 * el alta desde Configuración también sirva para eso sin tocar el flujo normal:
 *   - role 'agente' → gatwick_tecnicos (roster de técnicos que ya usa el Monitor
 *     para asignar quién atiende cada emergencia).
 *   - role 'admin'  → gatwick_alerta_destinos (recibe SMS de emergencia nueva;
 *     es un backup del WhatsApp de gatwick_supervisores, que sigue
 *     administrándose a mano porque se identifica por conversación de Chatwoot,
 *     no por teléfono).
 * Un fallo acá nunca debe tumbar el alta/edición/baja del usuario real.
 */
export async function sincronizarUsuarioGatwick(supabase: any, opts: {
  role: string
  email: string
  nombre: string
  telefono?: string | null
  emailAnterior?: string | null
}): Promise<void> {
  const { role, email, nombre, telefono, emailAnterior } = opts
  try {
    const emailBusqueda = String(emailAnterior || email || '').toLowerCase().trim()
    const emailNuevo = String(email || '').toLowerCase().trim()
    if (!emailBusqueda || !emailNuevo) return

    if (role === 'agente') {
      const [pnombre, ...resto] = String(nombre || '').trim().split(/\s+/)
      const { data: existente } = await supabase
        .from('gatwick_tecnicos').select('id').ilike('email', emailBusqueda).maybeSingle()
      const fila: Record<string, any> = {
        nombre: pnombre || nombre || 'Técnico',
        apellido: resto.join(' ') || null,
        email: emailNuevo, activo: true, updated_at: new Date().toISOString(),
      }
      if (telefono) fila.telefono = telefono
      if (existente) {
        await supabase.from('gatwick_tecnicos').update(fila).eq('id', existente.id)
      } else {
        await supabase.from('gatwick_tecnicos').insert({ ...fila, estado: 'disponible' })
      }
    } else if (role === 'admin') {
      const { data: existente } = await supabase
        .from('gatwick_alerta_destinos').select('id').ilike('email', emailBusqueda).maybeSingle()
      if (existente) {
        const fila: Record<string, any> = {
          nombre: nombre || 'Supervisor', email: emailNuevo,
          activo: true, updated_at: new Date().toISOString(),
        }
        if (telefono) fila.telefono = telefono
        await supabase.from('gatwick_alerta_destinos').update(fila).eq('id', existente.id)
      } else if (telefono) {
        // Sin teléfono no se puede crear (columna NOT NULL) — queda sin sincronizar
        // hasta que se edite el usuario y se agregue uno.
        await supabase.from('gatwick_alerta_destinos').insert({
          nombre: nombre || 'Supervisor', email: emailNuevo, telefono,
          activo: true, recibe_sms: true, recibe_llamada: false,
        })
      }
    }
  } catch (e: any) {
    console.error('[gatwick-tracking] sincronizarUsuarioGatwick:', e?.message)
  }
}

/** Baja lógica (activo=false) en las tablas de Gatwick sincronizadas al eliminar un usuario. */
export async function eliminarSyncGatwick(supabase: any, email: string): Promise<void> {
  try {
    const e = String(email || '').toLowerCase().trim()
    if (!e) return
    await supabase.from('gatwick_tecnicos').update({ activo: false }).ilike('email', e)
    await supabase.from('gatwick_alerta_destinos').update({ activo: false }).ilike('email', e)
  } catch (err: any) {
    console.error('[gatwick-tracking] eliminarSyncGatwick:', err?.message)
  }
}

/** URL base pública del dashboard (para armar los links de los mensajes). */
export function baseUrl(event: any): string {
  const env = process.env.PUBLIC_BASE_URL || process.env.URL
  if (env) return String(env).replace(/\/$/, '')
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || 'dashboard.alef.company'
  const proto = getHeader(event, 'x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}
