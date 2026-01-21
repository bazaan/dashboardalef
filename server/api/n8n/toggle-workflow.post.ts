// server/api/n8n/toggle-workflow.post.ts
import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)

    // 1. Recibimos qué cliente es y qué acción quiere
    const { clientKey, active } = body
    const action = active ? 'activate' : 'deactivate'

    // 2. Buscamos el ID en nuestro diccionario de config
    // config.n8nWorkflows es el objeto que definimos en el paso 2
    // Usamos "as any" para evitar que TypeScript se queje si el diccionario es dinámico
    const workflowsDict = config.n8nWorkflows as any
    const targetId = workflowsDict[clientKey]

    // 3. Validación de seguridad
    if (!targetId) {
        throw createError({
            statusCode: 400,
            statusMessage: `Error: No existe configuración para el cliente '${clientKey}'`
        })
    }

    try {
        // 4. Ejecutamos la llamada a n8n con el ID específico encontrado
        const response: any = await $fetch(`${config.n8nBaseUrl}/workflows/${targetId}/${action}`, {
            method: 'POST',
            body: {}, // Enviar body vacío asegura Content-Type: application/json
            headers: {
                'X-N8N-API-KEY': config.n8nApiKey
            }
        })

        // console.log('n8n response:', response) // Debug log

        return {
            success: true,
            client: clientKey,
            active: response.active // Estado real devuelto por n8n
        }

    } catch (error: any) {
        console.error(`Error n8n cliente ${clientKey}:`, error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Error de conexión con n8n'
        })
    }
})