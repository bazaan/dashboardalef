/**
 * PUT /api/users/password — cambia la contraseña de un usuario del sistema.
 * Body: { id: <dashboardlogin.id del usuario>, password: string, tu_password: string }
 *
 * Quién puede: ver server/utils/usuarios-password.ts (superadmin de Alef, y en Piola solo
 * Raysa y Edson). Además:
 *   - hay que confirmar con la contraseña propia (`tu_password`): la cookie de sesión no está
 *     firmada y sin esto bastaría conocer un correo de administrador para tomar cualquier cuenta;
 *   - un admin nunca toca a un superadmin ni a un usuario de otra empresa;
 *   - la contraseña no se devuelve ni se registra en ningún log (solo "cambió la contraseña de X").
 */
import bcrypt from 'bcryptjs'
import { serverSupabaseServiceRole } from '#supabase/server'
import { logServerActivity } from '../../utils/logger'
import {
  resolverSolicitante, puedeCambiarContrasenas, sincronizarPasswordAuth,
  verificarPasswordActual, demasiadosIntentos, registrarFallo,
} from '../../utils/usuarios-password'

const normalizarEmpresa = (v: any) => String(v ?? '').toLowerCase().replace(/\s+/g, '')

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event) as any
  const body = await readBody(event).catch(() => ({} as any))
  const id = body?.id
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el usuario' })
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 8 caracteres' })
  }
  if (password.length > 72) {
    // bcrypt ignora en silencio todo lo que pase de 72 bytes: mejor avisar que dejar una contraseña más corta de lo que se cree
    throw createError({ statusCode: 400, statusMessage: 'La contraseña no puede pasar de 72 caracteres' })
  }
  if (password !== password.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña no puede empezar ni terminar con espacios' })
  }

  const solicitante = await resolverSolicitante(event, client)
  if (!(await puedeCambiarContrasenas(client, solicitante))) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para cambiar contraseñas' })
  }

  // Confirmación con la contraseña propia (ver el encabezado). Va antes de tocar nada.
  if (demasiadosIntentos(solicitante.email)) {
    throw createError({ statusCode: 429, statusMessage: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' })
  }
  const tuPassword = typeof body?.tu_password === 'string' ? body.tu_password : ''
  if (!(await verificarPasswordActual(client, solicitante, tuPassword))) {
    registrarFallo(solicitante.email)
    throw createError({ statusCode: 403, statusMessage: 'Tu contraseña no es correcta' })
  }

  const { data: objetivo, error: errObjetivo } = await client
    .from('dashboardlogin').select('id, email, role, company_id').eq('id', id).maybeSingle()
  if (errObjetivo || !objetivo) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' })

  if (!solicitante.esSuperadmin) {
    if (String(objetivo.role || '').toLowerCase() === 'superadmin') {
      throw createError({ statusCode: 403, statusMessage: 'No puedes cambiar la contraseña de un superadministrador' })
    }
    if (normalizarEmpresa(objetivo.company_id) !== normalizarEmpresa(solicitante.company_id)) {
      throw createError({ statusCode: 403, statusMessage: 'Solo puedes cambiar contraseñas de usuarios de tu empresa' })
    }
  }

  const hash = await bcrypt.hash(password, await bcrypt.genSalt(10))
  const { error } = await client.from('dashboardlogin').update({ password: hash }).eq('id', objetivo.id)
  if (error) throw createError({ statusCode: 500, statusMessage: 'No se pudo guardar la contraseña' })

  const authActualizado = await sincronizarPasswordAuth(client, objetivo.id, String(objetivo.email), password)

  if (!solicitante.esSuperadmin) {
    await logServerActivity(event, solicitante.email, `Cambió la contraseña del usuario: ${objetivo.email}`, solicitante.company_id)
  }

  return { ok: true, auth_actualizado: authActualizado }
})
