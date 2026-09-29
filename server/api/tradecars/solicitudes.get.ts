/**
 * GET /api/tradecars/solicitudes
 *
 * "Formularios web" (Solicitudes Venta / Compra) — 29/09/2026: dejó de leerse directo desde el
 * navegador (RLS anon abierta) y pasa a este endpoint, para que la restricción "un asesor solo
 * ve sus propias tarjetas" sea real (verificada en el servidor), no solo cosmética.
 *
 * Response: { ok, ventas: [...], compras: [...], es_admin, asesor_sesion }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirModuloTradeCars } from '../../utils/tradecars'
import { obtenerAsesorDeSesion } from '../../utils/tradecars-asignacion'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirModuloTradeCars(perfil, 'comercial', 'view')

  setHeader(event, 'Cache-Control', 'no-store')

  const miAsesor = perfil.esAdmin ? null : await obtenerAsesorDeSesion(supabase, perfil.email)

  let ventasQ = supabase.from('tradecars_solicitudes_venta').select('*').order('created_at', { ascending: false })
  let comprasQ = supabase.from('tradecars_solicitudes_compra').select('*').order('created_at', { ascending: false })
  if (miAsesor) {
    ventasQ = ventasQ.ilike('asesor_email', miAsesor.asesor_email)
    comprasQ = comprasQ.ilike('asesor_email', miAsesor.asesor_email)
  }

  const [{ data: ventas, error: e1 }, { data: compras, error: e2 }] = await Promise.all([ventasQ, comprasQ])
  const faltaMigracion = (error: any) => !!error && /does not exist|schema cache/i.test(String(error.message || ''))
  if (faltaMigracion(e1) || faltaMigracion(e2)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Falta correr sql/tradecars_formularios_asignacion.sql en Supabase para poder mostrar las solicitudes.',
    })
  }
  if (e1) throw createError({ statusCode: 400, statusMessage: e1.message })
  if (e2) throw createError({ statusCode: 400, statusMessage: e2.message })

  return {
    ok: true,
    ventas: ventas || [],
    compras: compras || [],
    es_admin: perfil.esAdmin,
    puede_editar: perfil.esAdmin || perfil.permisos?.comercial?.can_edit === true,
    asesor_sesion: miAsesor?.asesor_nombre ?? null,
  }
})
