/**
 * GET /api/users/password — ¿quien lo pregunta puede cambiar contraseñas de otros?
 * Solo sirve para que la pantalla muestre u oculte el bloque "Cambiar contraseña";
 * el permiso de verdad lo vuelve a exigir PUT /api/users/password.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverSolicitante, puedeCambiarContrasenas } from '../../utils/usuarios-password'

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event) as any
  try {
    const solicitante = await resolverSolicitante(event, client)
    return { puede: await puedeCambiarContrasenas(client, solicitante) }
  } catch {
    return { puede: false }
  }
})
