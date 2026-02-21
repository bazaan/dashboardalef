
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import bcrypt from 'bcryptjs'
import { logServerActivity } from '../../utils/logger'

export default defineEventHandler(async (event) => {
    const client = await serverSupabaseClient(event)
    const body = await readBody(event)
    const { email, password, full_name, role, company_id } = body

    // 1. Validar sesión del usuario que hace la petición
    let user = await serverSupabaseUser(event)
    let userEmail = user?.email

    // Fallback: Si no hay sesión de Supabase, buscamos la cookie 'dashboard_session'
    if (!user) {
        const dashboardCookie = getCookie(event, 'dashboard_session')
        if (dashboardCookie) {
            try {
                // La cookie suele ser un objeto JSON stringified o un JWT custom.
                // Asumimos que es el objeto user que guardaste en index.vue
                const sessionData = typeof dashboardCookie === 'string' ? JSON.parse(dashboardCookie) : dashboardCookie
                if (sessionData && sessionData.email) {
                    console.log('Autenticado via dashboard_session cookie:', sessionData.email)
                    userEmail = sessionData.email
                    // Mock user object for compatibility
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

    // 2. Obtener datos del usuario actual (el que crea) para verificar permisos
    // Buscamos en dashboardlogin para saber su role y company_id
    const { data: currentUserProfile, error: profileError } = await client
        .from('dashboardlogin')
        .select('*')
        .eq('email', userEmail) // Usamos email definido arriba
        .single()

    if (profileError || !currentUserProfile) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: User profile not found'
        })
    }

    const requesterRole = currentUserProfile.role
    const requesterCompany = currentUserProfile.company_id

    // Security Check: No one can create superadmins via this endpoint anymore
    if (role === 'superadmin') {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: Cannot create superadmin users'
        })
    }

    // 3. Verificar Permisos
    if (requesterRole === 'superadmin') {
        // Superadmin puede crear para cualquiera
        // Si no se envía company_id, se asume 'Alef' o la del superadmin
    } else if (requesterRole === 'admin') {
        // Admin solo puede crear para su propia compañía
        if (company_id && company_id !== requesterCompany) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden: You can only create users for your own company'
            })
        }
        // Forzar company_id al del admin si no se envió o para asegurar
        if (!company_id) {
            // body.company_id = requesterCompany // No podemos mutar body directamente si es const, pero usaremos variable local
        }
    } else {
        // Agentes u otros roles no pueden crear usuarios
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden: You do not have permission to create users'
        })
    }

    // Definir company_id final
    const targetCompanyId = (requesterRole === 'admin') ? requesterCompany : (company_id || requesterCompany)


    // 4. Hash Password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // 5. Insertar en dashboardlogin
    const { data: newUser, error: insertError } = await client
        .from('dashboardlogin')
        .insert([
            {
                email,
                password: hashedPassword,
                full_name,
                role,
                company_id: targetCompanyId,
                created_at: new Date().toISOString()
            }
        ])
        .select()
        .single()

    if (insertError) {
        throw createError({
            statusCode: 500,
            statusMessage: insertError.message
        })
    }

    if (requesterRole !== 'superadmin') {
        await logServerActivity(event, userEmail, `Creó un nuevo perfil de usuario: ${email}`, targetCompanyId)
    }

    return { success: true, user: newUser }
})
