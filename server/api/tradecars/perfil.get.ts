/**
 * GET /api/tradecars/perfil
 *
 * Devuelve lo que el dashboard necesita para pintar el menú según el rol de
 * ESTE usuario: su ficha en `tradecars_colaboradores`, su rol de Trade Cars y
 * el mapa de permisos por módulo — mismo patrón que GET /api/piola/perfil.
 *
 * El menú se arma con esto (tradecarsCan(), en utils/permissions.ts), pero es
 * cosmético: ver la nota de sql/tradecars_roles.sql sobre qué SÍ vuelve a
 * verificar el servidor y qué no.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars } from '../../utils/tradecars'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)

  return {
    ok: true,
    email: perfil.email,
    rol_global: perfil.rolGlobal,
    rol_tradecars: perfil.rolTradeCars,
    es_admin: perfil.esAdmin,
    permisos: perfil.permisos,
    colaborador: perfil.colaborador,
  }
})
