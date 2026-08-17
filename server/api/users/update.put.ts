import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { logServerActivity } from '../../utils/logger'
import { esGatwick, sincronizarUsuarioGatwick } from '../../utils/gatwick-tracking'

export default defineEventHandler(async (event) => {
    const client = serverSupabaseServiceRole(event)
    const body = await readBody(event)
    const { id, email, full_name, company_id, telefono } = body

    if (!id || !email || !full_name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request: Missing required fields (id, email, full_name)'
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

    // Datos actuales del usuario a editar (se necesitan para verificar permisos de
    // admin y también para la sincronización de Gatwick más abajo)
    const { data: targetUser, error: targetError } = await client
        .from('dashboardlogin')
        .select('email, role, company_id')
        .eq('id', id)
        .single()

    if (targetError || !targetUser) {
        throw createError({ statusCode: 404, statusMessage: 'Usuario a editar no encontrado' })
    }

    // 3. Verificar Permisos
    if (requesterRole === 'admin') {
        // Admin solo puede editar usuarios de su propia compañía
        // Necesitamos asegurar que el usuario que intenta editar pertenece a la misma compañía
        if (company_id && company_id !== requesterCompany) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: You can only edit users for your own company'
            })
        }

        // Verificación extra de seguridad: asegurar que el id a actualizar pertenece a la empresa del admin
        if (targetUser.company_id !== requesterCompany) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: You can only edit users for your own company'
            })
        }

    } else if (requesterRole !== 'superadmin') {
        // Agentes no pueden editar usuarios
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: You do not have permission to edit users'
        })
    }

    // 4. Actualizar en dashboardlogin
    const { data: updatedUser, error: updateError } = await client
        .from('dashboardlogin')
        .update({
            email,
            full_name
        })
        .eq('id', id)
        .select()
        .single()

    if (updateError) {
        throw createError({
            statusCode: 500,
            statusMessage: updateError.message
        })
    }

    if (requesterRole !== 'superadmin') {
        await logServerActivity(event, userEmail, `Actualizó la información del usuario: ${email}`, company_id || requesterCompany)
    }

    // Sincronización adicional exclusiva de Gatwick — no afecta a ninguna otra empresa
    if (esGatwick(targetUser.company_id)) {
        await sincronizarUsuarioGatwick(client, {
            role: targetUser.role, email, nombre: full_name, telefono,
            emailAnterior: targetUser.email,
        })
    }

    return { success: true, user: updatedUser }
})
