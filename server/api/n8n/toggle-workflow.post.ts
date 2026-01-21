// server/api/n8n/toggle-workflow.post.ts
import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event) // Esperamos { company: 'brada', active: true }

  // 1. Validar que la empresa existe en tu configuración
  // Usamos el string que llega del frontend para buscar en el objeto n8nWorkflows
  const workflowId = config.n8nWorkflows[body.company]

  if (!workflowId) {
    throw createError({
      statusCode: 400,
      statusMessage: `Error: No existe configuración para la empresa '${body.company}'`
    })
  }

  // 2. Ejecutar la llamada a N8N
  try {
    const response = await $fetch(`${config.n8nBaseUrl}/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.n8nApiKey,
        'Content-Type': 'application/json'
      },
      body: { active: body.active }
    })
    return response
  } catch (error: any) {
    // ... manejo de errores ...
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
})
