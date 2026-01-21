// server/api/n8n/toggle-workflow.post.ts
import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)

    // --- DIAGNÓSTICO DE INICIO ---
    console.log("=== INICIO DE DIAGNÓSTICO ===")

    // 1. Verificar qué está llegando del Frontend
    console.log("Empresa solicitada:", body.company)
    console.log("Estado solicitado (active):", body.active)

    // 2. Verificar si las variables de entorno existen (SIN MOSTRAR LA CLAVE REAL)
    console.log("URL Base N8N configurada:", config.n8nBaseUrl)
    console.log("¿Existe API Key?:", config.n8nApiKey ? "SÍ (Longitud: " + config.n8nApiKey.length + ")" : "NO - ESTÁ VACÍA")

    // 3. Verificar si encuentra el ID del workflow
    const targetId = config.n8nWorkflows[body.company as keyof typeof config.n8nWorkflows]
    console.log(`ID encontrado para '${body.company}':`, targetId ? targetId : "NO ENCONTRADO/UNDEFINED")

    if (!targetId) {
        console.error("ERROR: No se encontró ID para la empresa solicitada.")
        throw createError({ statusCode: 400, statusMessage: "ID de empresa no configurado" })
    }

    // 4. Construir la URL final para ver si es válida
    // NOTA: Asegúrate de que n8nBaseUrl no tenga slash al final o lo duplicarás
    const cleanBaseUrl = config.n8nBaseUrl.replace(/\/$/, "")
    const finalUrl = `${cleanBaseUrl}/workflows/${targetId}/activate`

    console.log("Intentando conectar a URL:", finalUrl)

    try {
        const response = await $fetch(finalUrl, {
            method: 'POST',
            headers: {
                'X-N8N-API-KEY': config.n8nApiKey,
                'Content-Type': 'application/json'
            },
            body: { active: body.active }
        })

        console.log("Respuesta de N8N: ÉXITO")
        return response

    } catch (error: any) {
        console.error("=== ERROR FATAL AL CONECTAR CON N8N ===")
        // Esto nos dirá si es 401 (Auth), 404 (Url mal), 403 (CORS/Firewall)
        console.error("Status Code:", error.response?.status)
        console.error("Mensaje:", error.message)
        console.error("Data:", error.response?._data)

        throw createError({
            statusCode: error.response?.status || 500,
            statusMessage: `Fallo N8N: ${error.message}`
        })
    }
})