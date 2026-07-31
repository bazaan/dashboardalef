/**
 * POST /api/sgs/ocr-ticket
 *
 * Lee la FOTO de un ticket de balanza y devuelve los campos ya extraídos para
 * pre-llenar el formulario de ingreso.
 *
 * ⚠️ NO guarda nada. La Regla de Oro §4.2 (human-in-the-loop) exige que una
 * persona confirme o corrija antes de catalogar: acá la IA solo PROPONE.
 * El guardado sigue pasando por /api/sgs/tickets con verificado_humano.
 *
 * Formatos soportados (los 3 validados con SGS): Ferrobamba (térmico),
 * MSCON (concentrados, doble columna mina/puerto) y TISUR (puerto).
 *
 * Motor: OpenAI GPT-4o (visión), con la misma OPENAI_API_KEY que ya usa el
 * transcriptor de Healup. Se puede fijar otro modelo con SGS_OCR_MODEL.
 *
 * Body: { imagen_base64 }   → dataURL (image/jpeg|png|webp)
 * Resp: { ok, campos: {...}, avisos: [...], confianza }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionSGS } from '../../utils/sgs'

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'

// Modelos de visión a intentar, en orden. Si el primero no está habilitado en
// la cuenta, se prueba el siguiente. Se puede forzar uno con SGS_OCR_MODEL.
const MODELOS = [
  process.env.SGS_OCR_MODEL,
  'gpt-4o',        // mejor lectura de tickets térmicos
  'gpt-4o-mini',   // respaldo más barato
].filter(Boolean) as string[]

/** Tope de la imagen en base64 (la API acepta ~20 MB; se corta antes por sano). */
const MAX_BASE64 = 8 * 1024 * 1024

const PROMPT = `Eres un extractor de datos de TICKETS DE BALANZA de recepción de mineral en Perú.
Recibes la foto de un ticket (formatos: Ferrobamba térmico, MSCON de concentrados, TISUR de puerto).

Extrae EXCLUSIVAMENTE lo que ves impreso. NO inventes ni completes nada: si un dato no aparece, devuelve null.

REGLAS DE INTERPRETACIÓN DE PESOS (lo más importante):
- El ticket suele traer dos pesajes (ingreso y salida) y un PESO NETO.
- peso_bruto = el pesaje MAYOR (camión cargado).
- tara = el pesaje MENOR (camión vacío).
- peso_neto = el que dice "PESO NETO"; debe cumplir bruto - tara = neto.
- Los pesos van en KILOS, solo dígitos, sin comas ni puntos de miles.

OTROS CAMPOS:
- numero_ticket: el N° del ticket de pesaje (ej. "N011711" -> "011711"; quita el prefijo "N" si es solo marcador).
- placa: formato peruano AAA-999. Si hay PLACA y CARRETA, usa PLACA.
- fecha: la fecha del pesaje en formato DD/MM/YYYY (si el año viene de 2 dígitos como 26, conviértelo a 2026).
- calidad_material: el MATERIAL o calidad del mineral (ej. "PRODUCTO", "MINERAL DE HIERRO").
- cliente: el nombre del CLIENTE (persona o empresa).
- sede: el DESTINO si es un puerto/planta conocido (Matarani, Pisco, Paracas...). null si no aplica.
- guia_remision, chofer, origen, destino: si aparecen.
- segunda_balanza: SOLO si el ticket trae dos balanzas diferenciadas (ej. MINA y PUERTO/MISCON),
  con su propio bruto/tara/neto. Si no, null.

Devuelve EXCLUSIVAMENTE un JSON con esta forma exacta:
{
  "numero_ticket": string|null,
  "placa": string|null,
  "peso_bruto": number|null,
  "tara": number|null,
  "peso_neto": number|null,
  "fecha": string|null,
  "calidad_material": string|null,
  "cliente": string|null,
  "sede": string|null,
  "guia_remision": string|null,
  "chofer": string|null,
  "origen": string|null,
  "destino": string|null,
  "segunda_balanza": {"nombre": string, "bruto": number|null, "tara": number|null, "neto": number|null}|null,
  "avisos": [string],
  "confianza": "alta"|"media"|"baja"
}
En "avisos" describe SOLO problemas reales de lectura (texto borroso, dato ilegible, incoherencia entre pesos).`

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const { email } = await verificarSesionSGS(event, supabase)
  const body = await readBody(event)

  const dataUrl = String(body?.imagen_base64 || '')
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/)
  if (!m) {
    throw createError({ statusCode: 400, statusMessage: 'Falta la foto del ticket (imagen_base64 en formato dataURL)' })
  }
  const mediaType = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
  const base64 = m[3]

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La lectura automática no está configurada (falta OPENAI_API_KEY). Llena los campos a mano.',
    })
  }

  if (base64.length > MAX_BASE64) {
    throw createError({
      statusCode: 413,
      statusMessage: 'La foto es demasiado pesada. Tómala de nuevo con menos zoom o menor resolución.',
    })
  }

  const inicio = Date.now()
  let campos: any = null
  let modeloUsado = ''
  const fallos: string[] = []

  /** El motivo real viene en el cuerpo de la respuesta, no en el status. */
  const detalle = (e: any): string => {
    const d = e?.data ?? e?.response?._data
    return d?.error?.message || d?.message || e?.message || 'error desconocido'
  }

  for (const modelo of MODELOS) {
    try {
      const resp = await $fetch<any>(OPENAI_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: {
          model: modelo,
          max_tokens: 1500,
          // Garantiza JSON válido de salida (el prompt ya lo pide explícitamente)
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                // 'high' es necesario: en 'low' la letra chica del ticket se pierde
                image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' },
              },
            ],
          }],
        },
        timeout: 60000,
      })
      const texto = resp?.choices?.[0]?.message?.content || ''
      const json = texto.match(/\{[\s\S]*\}/)
      if (!json) throw new Error('la IA no devolvió JSON')
      campos = JSON.parse(json[0])
      modeloUsado = modelo
      break
    } catch (e: any) {
      const motivo = detalle(e)
      fallos.push(`${modelo}: ${motivo}`)
      console.error(`[sgs/ocr-ticket] ${modelo} falló -> ${motivo}`)
      // Solo se prueba el siguiente modelo si el fallo es por el modelo en sí.
      // Otros errores (sin saldo, imagen inválida) no se reintentan en vano.
      const esModeloInvalido = /model/i.test(motivo)
        && /(not_found|not found|invalid|does not exist|unsupported|do not have access)/i.test(motivo)
      if (!esModeloInvalido) break
    }
  }

  if (!campos) {
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'sgs', tool_name: 'OCR Ticket',
        input_data: { por: email, modelos_intentados: MODELOS },
        status: 'error', error_message: fallos.join(' | ').slice(0, 900),
        duration_ms: Date.now() - inicio,
      })
    } catch {}
    throw createError({
      statusCode: 502,
      statusMessage: `No se pudo leer el ticket — ${fallos[0] || 'error desconocido'}. Puedes llenarlo a mano.`,
    })
  }

  // ── Normalización y coherencia ──
  const avisos: string[] = Array.isArray(campos.avisos) ? campos.avisos.filter((x: any) => typeof x === 'string') : []
  const num = (v: any) => {
    if (v === null || v === undefined || v === '') return null
    const n = parseFloat(String(v).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  let bruto = num(campos.peso_bruto)
  let tara = num(campos.tara)
  const neto = num(campos.peso_neto)

  // Si vinieron invertidos, se corrigen: el bruto siempre es el mayor.
  if (bruto !== null && tara !== null && tara > bruto) {
    [bruto, tara] = [tara, bruto]
    avisos.push('Se intercambiaron bruto y tara: el camión cargado pesa más que vacío.')
  }
  // Coherencia bruto − tara = neto
  if (bruto !== null && tara !== null && neto !== null) {
    const dif = Math.abs((bruto - tara) - neto)
    if (dif > Math.max(50, neto * 0.02)) {
      avisos.push(`Revisa los pesos: bruto − tara = ${bruto - tara}, pero el ticket dice neto ${neto}.`)
    }
  }

  const salida = {
    numero_ticket: campos.numero_ticket ?? null,
    placa: campos.placa ? String(campos.placa).toUpperCase().trim() : null,
    peso_bruto: bruto, tara, peso_neto: neto,
    fecha: campos.fecha ?? null,
    calidad_material: campos.calidad_material ?? null,
    cliente: campos.cliente ?? null,
    sede: campos.sede ?? null,
    guia_remision: campos.guia_remision ?? null,
    chofer: campos.chofer ?? null,
    origen: campos.origen ?? null,
    destino: campos.destino ?? null,
    segunda_balanza: campos.segunda_balanza ?? null,
  }

  const faltantes = ['numero_ticket', 'placa', 'peso_bruto', 'tara', 'peso_neto', 'fecha', 'calidad_material']
    .filter(k => (salida as any)[k] === null || (salida as any)[k] === '')
  if (faltantes.length) avisos.push(`No se pudo leer: ${faltantes.join(', ')}. Complétalos a mano.`)

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'sgs', tool_name: 'OCR Ticket',
      input_data: { por: email },
      output_data: { ...salida, confianza: campos.confianza ?? null, avisos, modelo: modeloUsado },
      status: faltantes.length ? 'warning' : 'success',
      duration_ms: Date.now() - inicio,
    })
  } catch {}

  console.log(`[sgs/ocr-ticket] ${salida.numero_ticket ?? '?'} | ${salida.placa ?? '?'} | ${modeloUsado} | ${Date.now() - inicio}ms | por ${email}`)
  return { ok: true, campos: salida, avisos, confianza: campos.confianza ?? 'media', modelo: modeloUsado }
})
