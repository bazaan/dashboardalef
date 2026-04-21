
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
    const client = serverSupabaseServiceRole(event)
    const query = getQuery(event)
    const requestCompanyId = query.company_id as string

    // 1. Validar sesión
    let user = await serverSupabaseUser(event)
    let userEmail = user?.email

    // Fallback: Check cookie
    if (!user) {
        const dashboardCookie = getCookie(event, 'dashboard_session')
        if (dashboardCookie) {
            try {
                const sessionData = typeof dashboardCookie === 'string' ? JSON.parse(dashboardCookie) : dashboardCookie
                if (sessionData && sessionData.email) {
                    userEmail = sessionData.email
                    user = { email: sessionData.email } as any
                }
            } catch (e) { }
        }
    }

    if (!user || !userEmail) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // 2. Get current user profile
    const { data: currentUserProfile, error: profileError } = await client
        .from('dashboardlogin')
        .select('*')
        .eq('email', userEmail)
        .single()

    if (profileError || !currentUserProfile) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    // 3. Authorization Check
    const userRole = currentUserProfile.role
    const userCompany = currentUserProfile.company_id

    // If superadmin, can view any company (or forced by query)
    // If admin/agent, can only view their own company
    let targetCompany = userCompany
    if (userRole === 'superadmin' && requestCompanyId) {
        targetCompany = requestCompanyId
    } else if (userRole !== 'superadmin') {
        // Force their company
        targetCompany = userCompany
    }

    // 4. Fetch Users
    let supabaseQuery = client
        .from('dashboardlogin')
        .select('id, full_name, email, role, company_id') // Select specific fields
        .eq('company_id', targetCompany)
        .order('created_at', { ascending: false })

    const { data: users, error: fetchError } = await supabaseQuery

    if (fetchError) {
        throw createError({ statusCode: 500, statusMessage: fetchError.message })
    }

    return { users }
})
