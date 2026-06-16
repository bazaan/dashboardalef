import { useActivityLogger } from '../composables/useActivityLogger'

export default defineNuxtPlugin(() => {
    // We only want to run this on the client side
    if (import.meta.server) return

    const { logActivity } = useActivityLogger()

    // Save original fetch
    const originalFetch = window.fetch

    // Override global fetch to intercept requests
    window.fetch = async (...args) => {
        const [resource, config] = args

        // Execute the original request
        const response = await originalFetch(...args)

        // IMPORTANTE: el registro de actividad es best-effort y NO debe bloquear
        // NUNCA la respuesta de la petición real. Antes se hacía `await logActivity(...)`
        // aquí mismo: si la escritura a `activity_logs` se ponía lenta o se colgaba
        // (p. ej. bajo carga del servidor), congelaba TODO guardado/edición/borrado
        // del dashboard — el dato real ya se había guardado (200/204), pero la UI
        // quedaba esperando este log y no se actualizaba. Ahora se dispara en
        // segundo plano (fire-and-forget) y la respuesta se devuelve de inmediato.
        try {
            // Check if this is a request to Supabase REST API (rest/v1/)
            const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : ''

            if (url.includes('.supabase.co/rest/v1/') && response.ok) {
                // Determine the table name from the URL
                const urlObj = new URL(url)
                const pathParts = urlObj.pathname.split('/')
                const tableName = pathParts[pathParts.length - 1]

                // Determine the HTTP method
                const method = (config?.method || (resource instanceof Request ? resource.method : 'GET')).toUpperCase()

                // Map methods to human readable actions
                let action = ''
                if (method === 'POST') action = 'Agregó un registro en'
                else if (method === 'PATCH' || method === 'PUT') action = 'Modificó un registro en'
                else if (method === 'DELETE') action = 'Eliminó un registro de'

                // We only care about mutations, not reads (GET).
                // Fire-and-forget: sin await, nunca bloquea la respuesta.
                if (action && tableName !== 'activity_logs' && tableName !== 'dashboardlogin') {
                    void logActivity(`${action} ${tableName}`).catch(() => {})
                }
            }
        } catch (e) {
            console.error('Failed to parse and log activity from fetch:', e)
        }

        return response
    }
})
