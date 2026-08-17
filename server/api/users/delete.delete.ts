import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { logServerActivity } from '../../utils/logger'
import { esGatwick, eliminarSyncGatwick } from '../../utils/gatwick-tracking'

export default defineEventHandler(async (event) => {
    const client = serverSupabaseServiceRole(event)
    const body = await readBody(event)
    const { id } = body

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request: Missing user id to delete'
        })
    }

    // 1. Validar sesión del usuario que hace la petición
    let user = await serverSupabaseUser(event)
    let userEmail = user?.email

    // Fallback: Si no hay sesión de Supabase, buscamos la cookie 'dashboard_session'
    if (!user) {
        const dashboardCookie = getCookie(event, 'dashboard_session')
        if (dashboardCookie) {
            try {
                const sessionData = typeof dashboardCookie === 'string' ? JSON.parse(dashboardCookie) : dashboardCookie
                if (sessionData && sessionData.email) {
                    userEmail = sessionData.email
                    user = { email: sessionData.email } as any
                }
            } catch (e) {
                console.error('Error parseando dashboard_session:', e)
            }
        }
    }

    if (!user || !userEmail) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No session found'
        })
    }

    // 2. Obtener datos del usuario actual para verificar permisos
    const { data: currentUserProfile, error: profileError } = await client
        .from('dashboardlogin')
        .select('*')
        .eq('email', userEmail)
        .single()

    if (profileError || !currentUserProfile) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: User profile not found'
        })
    }

    const requesterRole = currentUserProfile.role
    const requesterCompany = currentUserProfile.company_id

    // Datos actuales del usuario a eliminar (permisos de admin + sincronización de Gatwick)
    const { data: targetUser, error: targetError } = await client
        .from('dashboardlogin')
        .select('email, company_id')
        .eq('id', id)
        .single()

    if (targetError || !targetUser) {
        throw createError({ statusCode: 404, statusMessage: 'Usuario a eliminar no encontrado' })
    }

    // 3. Verificar Permisos
    if (requesterRole === 'admin') {
        // Verificación extra de seguridad: asegurar que el id a eliminar pertenece a la empresa del admin
        if (targetUser.company_id !== requesterCompany) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: You can only delete users for your own company'
            })
        }
    } else if (requesterRole !== 'superadmin') {
        // Agentes no pueden eliminar usuarios
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: You do not have permission to delete users'
        })
    }

    // Check if the user is trying to delete themselves
    if (currentUserProfile.id === id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request: You cannot delete your own profile'
        })
    }

    // 4. Eliminar en dashboardlogin
    const { error: deleteError } = await client
        .from('dashboardlogin')
        .delete()
        .eq('id', id)

    if (deleteError) {
        throw createError({
            statusCode: 500,
            statusMessage: deleteError.message
        })
    }

    if (requesterRole !== 'superadmin') {
        await logServerActivity(event, userEmail, `Eliminó a un usuario con ID: ${id}`, requesterCompany)
    }

    // Sincronización adicional exclusiva de Gatwick — no afecta a ninguna otra empresa
    if (esGatwick(targetUser.company_id)) {
        await eliminarSyncGatwick(client, targetUser.email)
    }

    return { success: true }
})
