import { serverSupabaseClient } from '#supabase/server'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
    const client = await serverSupabaseClient(event)
    const body = await readBody(event)
    const { email, password } = body

    if (!email || !password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Email and password required'
        })
    }

    // Buscar usuario en dashboardlogin (tabla custom)
    const { data: user, error } = await client
        .from('dashboardlogin')
        .select('*')
        .eq('email', email)
        .single()

    if (error || !user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid credentials (User not found)'
        })
    }

    // Verificar contraseña con bcrypt
    // Nota: La contraseña en la BD dashboardlogin debe estar hasheada con bcrypt
    // Si la contraseña en la BD es texto plano, bcrypt.compare fallará (o devolverá false)
    // Asumimos que create.post.ts usó bcrypt.hash
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid credentials (Password mismatch)'
        })
    }

    // Si es válido, devolvemos el perfil del usuario para que el frontend pueda
    // proceder con el inicio de sesión manual o migración
    return {
        success: true,
        user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.nombre,
            role: user.role,
            company_id: user.company_id
        }
    }
})
