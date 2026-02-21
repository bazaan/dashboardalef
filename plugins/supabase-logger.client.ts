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

                // We only care about mutations, not reads (GET)
                if (action && tableName !== 'activity_logs' && tableName !== 'dashboardlogin') {
                    // Log the activity
                    await logActivity(`${action} ${tableName}`)
                }
            }
        } catch (e) {
            console.error('Failed to parse and log activity from fetch:', e)
        }

        return response
    }
})
