import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'

export async function logServerActivity(event: H3Event, user_email: string, activity: string, company_id: string | null = null) {
    try {
        const client = await serverSupabaseClient(event)

        const { error } = await (client as any)
            .from('activity_logs')
            .insert({
                user_email,
                activity,
                company_id
            })

        if (error) {
            console.error('Failed to log server activity:', error)
        }
    } catch (e) {
        console.error('Error logging server activity:', e)
    }
}
