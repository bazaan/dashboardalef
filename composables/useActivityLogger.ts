export const useActivityLogger = () => {
    const supabase = useSupabaseClient()

    const logActivity = async (activity: string) => {
        try {
            // Get current user session info
            const sessionCookie = useCookie(SESSION_COOKIE, sessionCookieOptions())
            const session = sessionCookie.value as any

            if (!session || !session.email) {
                console.warn('Cannot log activity: No active session found')
                return
            }

            if (session.role === 'superadmin') {
                return // No registrar actividades de superadmins
            }

            const { error } = await (supabase as any)
                .from('activity_logs')
                .insert({
                    user_email: session.email,
                    activity: activity,
                    company_id: session.company_id || null
                })

            if (error) {
                console.error('Supabase activity log error:', error)
            }
        } catch (e) {
            console.error('Error in useActivityLogger:', e)
        }
    }

    return {
        logActivity
    }
}
