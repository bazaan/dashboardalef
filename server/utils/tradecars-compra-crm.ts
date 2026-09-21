/**
 * Trade Cars — compra concretada en el CRM -> histórico de compras.
 * ------------------------------------------------------------------
 * Acordado en la reunión de alineación de septiembre/2026:
 *
 *   1. Activador: el asesor marca el estado de un chat como CONCRETADO.
 *   2. Extracción: se sacan los datos del vehículo (placa, marca, modelo, versión,
 *      año, kilometraje) del texto libre "informacion del auto" que el asesor
 *      escribe en Chatwoot, del chat, o del formulario web del cliente.
 *   3. Verificación: los datos entran a `tradecars_data_historico_compras` con
 *      verificado = false para que el administrador los revise y complete lo que
 *      falte (versión, SOAT, tarjeta de propiedad, precios, etc.).
 *   4. Inventario: el administrador aprieta "Ingresar a inventario" (ver
 *      server/api/tradecars/inventario-ingresar.post.ts). NO es automático a
 *      propósito: si pasara directo faltarían campos y habría que llenarlos dos
 *      veces (en el histórico y en el inventario).
 *
 * Prioridad de las fuentes cuando se contradicen (lo dijo el cliente: el formulario
 * a veces dice 2010-2011 y el auto termina siendo 2009):
 *      texto del asesor / chat  >  campos del lead  >  formulario web
 *
 * Es IDEMPOTENTE por crm_lead_id: el webhook de Chatwoot dispara en cada mensaje,
 * así que esto se puede llamar N veces sin duplicar la compra.
 */

import { tcCalcularCompra } from '~/utils/tradecarsFormulas'

export interface DatosAuto {
  placa?: string | null
  marca?: string | null
  modelo?: string | null
  version?: string | null
  anio?: string | null
  kilometraje?: number | null
}

export interface CompraCrmResultado {
  ok: boolean
  creado: boolean
  id?: string
  concat?: string
  /** Qué campos del vehículo se lograron llenar (el resto lo completa el administrador). */
  campos_llenos?: string[]
  /** De dónde salió cada dato. */
  fuentes?: Record<string, string>
  motivo?: string
  error?: string
}

/* ═══════════════════════ Helpers ═══════════════════════ */

function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

const soloDigitos = (s: any) => String(s ?? '').replace(/\D/g, '')
/** Últimos 9 dígitos: el celular peruano, sin importar +51, espacios o guiones. */
const ultimos9 = (s: any) => soloDigitos(s).slice(-9)

/** ABC-123 / abc 123 / C6V457 -> ABC123 */
export function normalizarPlaca(v: any): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function numeroDe(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const limpio = (v: any): string | null => {
  const s = String(v ?? '').trim()
  return s && !/^(null|undefined|n\/a|-|—)$/i.test(s) ? s : null
}

/* ═══════════════════════ Extracción SIN IA ═══════════════════════
 * Se prueba siempre primero (es gratis y determinista). Si hay OPENAI_API_KEY la
 * IA la complementa/corrige; si no, esto solo ya cubre el caso típico del asesor
 * ("Toyota Yaris 2019, 45 mil km, placa ABC-123" o con etiquetas Marca:/Modelo:/…).
 */
export function extraerDatosAutoHeuristica(texto: string, marcasCatalogo: string[] = []): DatosAuto {
  const out: DatosAuto = {}
  const t = String(texto ?? '').replace(/\r/g, '').trim()
  if (!t) return out

  // ── 1. Etiquetas explícitas: "Marca: Kia", "Modelo - Sportage", … ──
  const etiqueta = (nombres: string[]): string | null => {
    for (const n of nombres) {
      const m = t.match(new RegExp('(?:^|[\\s,;|])' + n + '\\s*[:=\\-]\\s*([^,;\\n|]+)', 'i'))
      if (m && limpio(m[1])) return m[1].trim()
    }
    return null
  }
  out.marca = etiqueta(['marca'])
  out.modelo = etiqueta(['modelo'])
  out.version = etiqueta(['version', 'versión'])
  out.placa = etiqueta(['placa'])
  const anioEt = etiqueta(['a[nñ]o', 'anio'])
  if (anioEt) out.anio = (anioEt.match(/(19[6-9]\d|20[0-4]\d)/) || [])[1] || null
  const kmEt = etiqueta(['kilometraje', 'kms?', 'kilometros', 'kilómetros'])
  if (kmEt) out.kilometraje = kilometrajeDe(kmEt)

  // ── 2. Kilometraje suelto: "45,000 km", "45.000 kms", "45 mil km", "45000km".
  //     Aquí la UNIDAD es obligatoria: sin ella "2018" (el año) o "250" (la cilindrada
  //     de "GLC 250") se confundirían con kilometraje. Solo el valor ETIQUETADO
  //     ("Kilometraje: 85000") puede ir sin unidad — eso ya se leyó arriba. ──
  if (!out.kilometraje) {
    const mMil = t.match(/(?<!\d)(\d{1,3})\s*mil\s*(?:km|kms|kil[oó]metros)?\b/i)
    if (mMil) out.kilometraje = Number(mMil[1]) * 1000
    else {
      const mKm = t.match(/(?<!\d)(\d{1,3}(?:[.,\s]\d{3})+|\d{3,7})\s*(?:km|kms|kil[oó]metros)\b/i)
      if (mKm) out.kilometraje = numeroKm(mKm[1])
    }
  }

  // Sin el kilometraje en el texto, un número grande no se confunde con el año
  const sinKm = t
    .replace(/(?<!\d)(\d{1,3}(?:[.,\s]\d{3})+|\d{2,7})\s*(?:km|kms|kil[oó]metros)\b/gi, ' ')
    .replace(/(?<!\d)(\d{1,3})\s*mil\s*(?:km|kms)?\b/gi, ' ')

  // ── 3. Año: primer número de 4 dígitos que parezca año de fabricación ──
  if (!out.anio) {
    const mAnio = sinKm.match(/\b(19[6-9]\d|20[0-4]\d)\b/)
    if (mAnio) out.anio = mAnio[1]
  }

  // ── 4. Placa: 3 alfanuméricos (al menos una letra) + 3 dígitos. Las placas reales
  //     del stock (ACZ201, C6V457, BVB412…) siempre cierran con 3 dígitos, así que
  //     "TIGGO8" o "GLI13" no se confunden con una placa. ──
  //     Si el texto dice "placa", se busca SOLO pegada a esa palabra (lo más confiable).
  //     Sin la palabra se acepta el patrón suelto, pero "GLC 250" (letras + espacio +
  //     cilindrada) es un modelo, no una placa: solo cuenta si viene pegada/con guion
  //     (ABC-123, C6V457) o mezcla letras y números en el primer bloque (C6V 457).
  if (!out.placa) {
    const conPalabra = sinKm.match(/placa\s*[:=-]?\s*([A-Z0-9]{3})[\s-]?(\d{3})\b/i)
    if (conPalabra && /[A-Z]/i.test(conPalabra[1])) {
      out.placa = (conPalabra[1] + conPalabra[2]).toUpperCase()
    } else if (!/placa/i.test(sinKm)) {
      const re = /\b([A-Z0-9]{3})[\s-]?(\d{3})\b/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(sinKm))) {
        const pegada = !/\s/.test(m[0])
        const mezcla = /[A-Z]/i.test(m[1]) && /\d/.test(m[1])
        if (/[A-Z]/i.test(m[1]) && (pegada || mezcla)) { out.placa = (m[1] + m[2]).toUpperCase(); break }
      }
    }
  }

  // ── 5. Marca y modelo con el catálogo de marcas (tradecars_marcas) ──
  if (!out.marca && marcasCatalogo.length) {
    const norm = ' ' + sinAcentos(sinKm).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim() + ' '
    const ordenadas = [...marcasCatalogo].sort((a, b) => b.length - a.length)   // "GREAT WALL" antes que "GREAT"
    const hallada = ordenadas.find(m => norm.includes(' ' + m + ' '))
    if (hallada) {
      out.marca = hallada
      if (!out.modelo) {
        const resto = norm.split(' ' + hallada + ' ')[1] || ''
        const stop = new Set(['ANO', 'AÑO', 'KM', 'KMS', 'PLACA', 'VERSION', 'MODELO', 'DEL', 'DE', 'COLOR', 'MIL'])
        const toks = resto.trim().split(' ').filter(Boolean)
        const primero = toks.find(x => !stop.has(x) && !/^\d{4}$/.test(x) && !/^\d+$/.test(x))
        // el modelo tiene que estar ANTES de que aparezca algo que ya no es modelo
        if (primero && toks.indexOf(primero) <= 1) out.modelo = primero
      }
    }
  }

  // Mayúsculas en marca/modelo/placa, como están las 1.307 filas del histórico
  if (out.marca) out.marca = out.marca.toUpperCase().trim()
  if (out.modelo) out.modelo = out.modelo.toUpperCase().trim()
  if (out.placa) out.placa = normalizarPlaca(out.placa)
  return out
}

/** Convierte "85,000" / "120.000" / "45000" a número. null si no parece un kilometraje. */
function numeroKm(s: string): number | null {
  const n = Number(String(s).replace(/[.,\s]/g, ''))
  return Number.isFinite(n) && n >= 100 ? n : null
}

/** Kilometraje de un valor ya etiquetado ("85,000 km", "85000"): la unidad es opcional. */
function kilometrajeDe(s: string): number | null {
  const m = String(s).match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{2,7})/)
  return m ? numeroKm(m[1]) : null
}

/* ═══════════════════════ Extracción CON IA (opcional) ═══════════════════════ */

async function extraerConIA(texto: string): Promise<DatosAuto | null> {
  const key = process.env.OPENAI_API_KEY
  const t = String(texto ?? '').trim()
  if (!key || !t) return null

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: process.env.TRADECARS_EXTRACT_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extraes los datos de UN vehículo usado a partir de un texto en español de un asesor comercial ' +
              'o de una conversación de WhatsApp de una empresa peruana que compra autos. ' +
              'Responde SOLO un JSON con estas claves: placa, marca, modelo, version, anio, kilometraje. ' +
              '- placa: formato peruano (ej. ABC123 o C6V457), sin guiones. ' +
              '- marca y modelo: en MAYÚSCULAS (ej. TOYOTA, YARIS). ' +
              '- version: el resto del nombre comercial (ej. "GLI 1.3 AT"), si existe. ' +
              '- anio: año de fabricación de 4 dígitos como texto. ' +
              '- kilometraje: número entero en km (45 mil km = 45000). ' +
              'Si un dato NO aparece en el texto, usa null. NUNCA inventes ni adivines datos. ' +
              'Si el texto habla de varios vehículos, usa el que el cliente VENDIÓ / la empresa COMPRÓ.',
          },
          { role: 'user', content: t.slice(0, 6000) },
        ],
      }),
    })
    if (!res.ok) return null
    const json: any = await res.json()
    const crudo = JSON.parse(json?.choices?.[0]?.message?.content || '{}')
    return {
      placa: crudo.placa ? normalizarPlaca(crudo.placa) : null,
      marca: limpio(crudo.marca)?.toUpperCase() ?? null,
      modelo: limpio(crudo.modelo)?.toUpperCase() ?? null,
      version: limpio(crudo.version),
      anio: /(19[6-9]\d|20[0-4]\d)/.test(String(crudo.anio ?? '')) ? String(crudo.anio).match(/(19[6-9]\d|20[0-4]\d)/)![1] : null,
      kilometraje: numeroDe(crudo.kilometraje),
    }
  } catch {
    return null   // la IA es un extra: si falla, se sigue con lo que ya se tiene
  }
}

/* ═══════════════════════ Chat de Chatwoot ═══════════════════════ */

// Cuenta de Trade Cars en Chatwoot
const CHATWOOT_URL = 'https://chats.alef.company/api/v1/accounts'

/**
 * Últimos mensajes de la conversación en texto plano (para que la IA saque los datos del auto cuando el
 * asesor no llenó "informacion del auto" y el cliente no usó el formulario: "que investigue el chat y
 * agarre los datos que pueda"). Usa el mismo token de Chatwoot que el resto del dashboard
 * (CHATWOOT_API_TOKEN). Sin token o sin respuesta devuelve '' y se sigue con lo que haya.
 */
async function transcripcionChatwoot(accountId: any, conversationId: any): Promise<string> {
  const token = process.env.CHATWOOT_API_TOKEN
  if (!token || !accountId || !conversationId) return ''
  try {
    const res = await fetch(`${CHATWOOT_URL}/${accountId}/conversations/${conversationId}/messages`, {
      headers: { api_access_token: token },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const json: any = await res.json()
    const mensajes: any[] = Array.isArray(json?.payload) ? json.payload : []
    return mensajes
      .filter(m => m?.content && !m.private)              // sin notas privadas
      .slice(-60)
      .map(m => `${m.message_type === 0 ? 'Cliente' : 'Asesor'}: ${String(m.content).replace(/\s+/g, ' ').trim()}`)
      .join('\n')
  } catch {
    return ''
  }
}

/* ═══════════════════════ Formulario web ═══════════════════════ */

async function datosDelFormulario(supabase: any, telefono: string | null): Promise<DatosAuto | null> {
  const t9 = ultimos9(telefono)
  if (t9.length < 9) return null
  const { data } = await supabase
    .from('tradecars_solicitudes_venta')
    .select('celular, marca, modelo, placa, anio, kilometraje, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  const fila = (data || []).find((f: any) => ultimos9(f.celular) === t9)
  if (!fila) return null
  return {
    placa: fila.placa ? normalizarPlaca(fila.placa) : null,
    marca: limpio(fila.marca)?.toUpperCase() ?? null,
    modelo: limpio(fila.modelo)?.toUpperCase() ?? null,
    anio: fila.anio ? String(fila.anio) : null,
    kilometraje: numeroDe(fila.kilometraje),
  }
}

/* ═══════════════════════ Función principal ═══════════════════════ */

const CAMPOS: (keyof DatosAuto)[] = ['placa', 'marca', 'modelo', 'version', 'anio', 'kilometraje']

/**
 * Crea (una sola vez) la fila de compra en el histórico a partir de un lead CONCRETADA.
 * `lead` es la fila completa de tradecars_funnel_leads.
 */
export async function crearCompraDesdeLead(
  supabase: any,
  lead: any,
  opts: { transcripcion?: string } = {},
): Promise<CompraCrmResultado> {
  if (!lead?.id) return { ok: false, creado: false, error: 'lead sin id' }

  // ── Idempotencia: ¿ya se creó la compra de este lead? ──
  const { data: existente, error: errExist } = await supabase
    .from('tradecars_data_historico_compras')
    .select('id, concat')
    .eq('crm_lead_id', lead.id)
    .maybeSingle()
  if (errExist) {
    // La columna crm_lead_id la agrega sql/tradecars_funnel_v2_crm.sql: sin esa migración
    // no se puede garantizar que no se duplique, así que NO se inserta nada.
    return { ok: false, creado: false, error: `No se pudo verificar la compra existente (¿falta correr sql/tradecars_funnel_v2_crm.sql?): ${errExist.message}` }
  }
  if (existente) return { ok: true, creado: false, id: existente.id, concat: existente.concat, motivo: 'ya existía' }

  // ── Fuentes de datos del vehículo ──
  const { data: marcasFilas } = await supabase.from('tradecars_marcas').select('clave').eq('activo', true)
  const marcasCatalogo: string[] = (marcasFilas || []).map((m: any) => String(m.clave).toUpperCase())

  const textoAsesor = [lead.informacion_auto, opts.transcripcion].filter(Boolean).join('\n\n')
  const heuristica = extraerDatosAutoHeuristica(String(lead.informacion_auto ?? ''), marcasCatalogo)
  const ia = await extraerConIA(textoAsesor)
  const delLead: DatosAuto = {
    placa: lead.placa ? normalizarPlaca(lead.placa) : null,
    marca: limpio(lead.marca)?.toUpperCase() ?? null,
    modelo: limpio(lead.modelo)?.toUpperCase() ?? null,
    version: limpio(lead.version),
    anio: lead.anio ? String(lead.anio) : null,
    kilometraje: numeroDe(lead.kilometraje),
  }
  const delFormulario = await datosDelFormulario(supabase, lead.contacto_telefono)

  const fuentes: Record<string, string> = {}
  const auto: DatosAuto = {}
  for (const c of CAMPOS) {
    // texto del asesor (IA, luego heurística) > lead > formulario
    const candidatos: [string, any][] = [
      ['texto del asesor (IA)', ia?.[c]],
      ['texto del asesor', heuristica[c]],
      ['lead', delLead[c]],
      ['formulario web', delFormulario?.[c]],
    ]
    const elegido = candidatos.find(([, v]) => v !== null && v !== undefined && v !== '')
    if (elegido) {
      ;(auto as any)[c] = elegido[1]
      fuentes[c] = elegido[0]
    }
  }

  // Si el asesor no escribió nada útil y tampoco hay formulario, se lee el chat (solo con IA disponible:
  // extraer datos de una conversación con reglas fijas daría falsos positivos).
  const faltanClave = (['placa', 'marca', 'modelo'] as const).filter(c => !auto[c])
  if (faltanClave.length && process.env.OPENAI_API_KEY && !opts.transcripcion) {
    const chat = await transcripcionChatwoot(lead.chatwoot_account_id, lead.chatwoot_conversation_id)
    const delChat = chat ? await extraerConIA(chat) : null
    if (delChat) {
      for (const c of CAMPOS) {
        const v = delChat[c]
        if ((auto as any)[c] === undefined && v !== null && v !== undefined && v !== '') {
          ;(auto as any)[c] = v
          fuentes[c] = 'chat de Chatwoot (IA)'
        }
      }
    }
  }

  // ── concat = PLACA-N (mismo formato que las 1.307 filas del Excel) ──
  let concat: string
  let nCompra: number | null = null
  if (auto.placa) {
    const { count } = await supabase
      .from('tradecars_data_historico_compras')
      .select('id', { count: 'exact', head: true })
      .eq('placa', auto.placa)
    nCompra = (count ?? 0) + 1
    concat = `${auto.placa}-${nCompra}`
  } else {
    // Sin placa todavía: clave provisoria única. El administrador la corrige al verificar.
    concat = `CRM-${lead.chatwoot_conversation_id ?? String(lead.id).slice(0, 8)}`
  }

  const fila: Record<string, any> = {
    fecha_de_compra: lead.fecha_compra || hoyLima(),
    placa: auto.placa ?? null,
    concat,
    n_compra: nCompra,
    marca: auto.marca ?? null,
    modelo: auto.modelo ?? null,
    version: auto.version ?? null,
    ano: auto.anio ?? null,
    kilometraje: auto.kilometraje ?? null,
    canal_de_compra: lead.canal_origen ?? null,
    asesor_comercial_comprador: lead.asesor ?? null,
    detalle_canal_de_compra: lead.campana ? `CRM · ${lead.campana}` : 'CRM',
    // Trazabilidad (columnas de sql/tradecars_funnel_v2_crm.sql)
    origen: 'crm',
    crm_lead_id: lead.id,
    crm_conversation_id: lead.chatwoot_conversation_id ?? null,
    informacion_auto: lead.informacion_auto ?? null,
    verificado: false,
    actualizado_en: new Date().toISOString(),
    actualizado_por: 'CRM (Chatwoot)',
  }

  // Fórmulas del Excel sobre lo que ya se sabe (status EN STOCK, columnas espejo del bloque de stock…).
  // Los precios y gastos los completa el administrador y ahí se recalcula el resto.
  Object.assign(fila, tcCalcularCompra(fila, { tieneVenta: false }))

  const { data: creada, error } = await supabase
    .from('tradecars_data_historico_compras')
    .insert(fila)
    .select('id, concat')
    .single()
  if (error) return { ok: false, creado: false, error: error.message }

  // Los datos que se lograron extraer también quedan en el lead (sin pisar lo que el
  // asesor ya escribió a mano): alimentan Procedencia y Costos por marca/modelo.
  try {
    const parche: Record<string, any> = {}
    if (!lead.placa && auto.placa) parche.placa = auto.placa
    if (!lead.marca && auto.marca) parche.marca = auto.marca
    if (!lead.modelo && auto.modelo) parche.modelo = auto.modelo
    if (!lead.version && auto.version) parche.version = auto.version
    if (!lead.anio && auto.anio) parche.anio = auto.anio
    if (!lead.kilometraje && auto.kilometraje) parche.kilometraje = auto.kilometraje
    if (Object.keys(parche).length) {
      await supabase.from('tradecars_funnel_leads').update(parche).eq('id', lead.id)
    }
  } catch { /* opcional */ }

  return {
    ok: true,
    creado: true,
    id: creada.id,
    concat: creada.concat,
    campos_llenos: CAMPOS.filter(c => (auto as any)[c] !== undefined && (auto as any)[c] !== null),
    fuentes,
  }
}
