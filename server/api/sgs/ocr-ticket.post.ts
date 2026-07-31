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
 * Body: { imagen_base64 }   → dataURL (image/jpeg|png|webp)
 * Resp: { ok, campos: {...}, avisos: [...], confianza }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionSGS } from '../../utils/sgs'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'La lectura automática no está configurada (falta ANTHROPIC_API_KEY). Llena los campos a mano.',
    })
  }

  const inicio = Date.now()
  let campos: any = null
  try {
    const resp = await $fetch<any>(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: {
        model: MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      },
      timeout: 60000,
    })
    const texto = (resp?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
    const json = texto.match(/\{[\s\S]*\}/)
    if (!json) throw new Error('la IA no devolvió JSON')
    campos = JSON.parse(json[0])
  } catch (e: any) {
    console.error('[sgs/ocr-ticket] Error:', e?.message)
    try {
      await supabase.from('agent_tool_logs').insert({
        company_id: 'sgs', tool_name: 'OCR Ticket',
        input_data: { por: email }, status: 'error',
        error_message: e?.message ?? 'error leyendo el ticket',
        duration_ms: Date.now() - inicio,
      })
    } catch {}
    throw createError({ statusCode: 502, statusMessage: `No se pudo leer el ticket: ${e?.message}. Puedes llenarlo a mano.` })
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
      output_data: { ...salida, confianza: campos.confianza ?? null, avisos },
      status: faltantes.length ? 'warning' : 'success',
      duration_ms: Date.now() - inicio,
    })
  } catch {}

  console.log(`[sgs/ocr-ticket] ${salida.numero_ticket ?? '?'} | ${salida.placa ?? '?'} | ${Date.now() - inicio}ms | por ${email}`)
  return { ok: true, campos: salida, avisos, confianza: campos.confianza ?? 'media' }
})
