/**
 * POST /api/tickets/clasificar
 * Usa Claude para clasificar un ticket y asignarlo al miembro correcto del equipo Alef.
 * Usa fetch nativo — sin dependencia de @anthropic-ai/sdk
 */

const EQUIPO = `
- Julio: Prompts y agentes IA nivel estándar. Problemas con respuestas del agente, ajustes de tono, flujos básicos de conversación, preguntas sobre cómo funciona el agente.
- Piero: Prompts y agentes IA nivel avanzado y complejo. Rediseño de system prompts, optimización de tools, arquitectura de agentes, casos complejos de lógica conversacional.
- Roberto: Ingeniería de dashboard, infraestructura del agente. Bugs en la interfaz, nuevas funcionalidades del dashboard, integraciones de API, despliegue de agentes, n8n, webhooks.
- Juan Pablo: Mismo que Roberto pero casos avanzados, escalados o críticos. Infraestructura crítica, errores de producción, problemas complejos de arquitectura, casos que Roberto escala.
`

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { titulo, descripcion, empresa } = body

  if (!titulo || !descripcion) {
    throw createError({ statusCode: 400, statusMessage: 'titulo y descripcion son requeridos' })
  }

  const prompt = `Eres el sistema de clasificación de tickets de soporte de Alef Company.

EQUIPO DISPONIBLE:
${EQUIPO}

TICKET RECIBIDO:
Empresa: ${empresa || 'No especificada'}
Título: ${titulo}
Descripción: ${descripcion}

INSTRUCCIONES:
Analiza el ticket y determina:
1. asignado_a: quién del equipo debe atenderlo (exactamente uno de: "Julio", "Piero", "Roberto", "Juan Pablo")
2. categoria: una de estas categorías (prompt_estandar | prompt_avanzado | dashboard | infraestructura | escalado)
3. urgencia: baja | media | alta | critica
4. razon: explicación breve (1-2 oraciones) de por qué lo asignaste así

Responde ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "asignado_a": "...",
  "categoria": "...",
  "urgencia": "...",
  "razon": "..."
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json() as any
    const text = data.content[0].text.trim()
    const result = JSON.parse(text)

    // Validar campos
    const asignados = ['Julio', 'Piero', 'Roberto', 'Juan Pablo']
    const categorias = ['prompt_estandar', 'prompt_avanzado', 'dashboard', 'infraestructura', 'escalado']
    const urgencias = ['baja', 'media', 'alta', 'critica']

    if (!asignados.includes(result.asignado_a)) result.asignado_a = 'Roberto'
    if (!categorias.includes(result.categoria)) result.categoria = 'dashboard'
    if (!urgencias.includes(result.urgencia)) result.urgencia = 'media'

    return result
  } catch (e) {
    // Fallback si Claude falla
    return {
      asignado_a: 'Juan Pablo',
      categoria: 'escalado',
      urgencia: 'media',
      razon: 'No se pudo clasificar automáticamente. Asignado a Juan Pablo para revisión.'
    }
  }
})
