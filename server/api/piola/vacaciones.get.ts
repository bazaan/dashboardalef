/**
 * GET /api/piola/vacaciones — saldos y solicitudes (§7.2)
 *
 * Query:
 *   ?vista=mi      (default) saldo + solicitudes propias
 *   ?vista=equipo  saldos de todo el equipo + solicitudes pendientes   [RR.HH. o Admin]
 *
 * El devengo (1.25 días/mes) se calcula SIEMPRE en el servidor a partir de
 * fecha_ingreso; nunca se guarda un saldo "congelado" que se pueda desfasar.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, calcularVacaciones, hoyLima } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const vista = String(getQuery(event).vista || 'mi')
  const hoy = hoyLima()

  if (vista === 'equipo') {
    exigirModulo(perfil, 'rrhh', 'view')

    const [{ data: colaboradores }, { data: solicitudes }, { data: ajustes }] = await Promise.all([
      supabase.from('piola_colaboradores')
        .select('email, nombre, cargo, tipo_contrato, fecha_ingreso, fecha_fin_contrato, activo')
        .eq('activo', true).order('nombre'),
      supabase.from('piola_vacation_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('piola_vacation_adjustments').select('colaborador_email, dias'),
    ])

    const saldos = (colaboradores || []).map((c: any) => {
      const key = String(c.email).toLowerCase()
      const tomados = (solicitudes || [])
        .filter((s: any) => String(s.colaborador_email).toLowerCase() === key && s.estado === 'aprobada')
        .reduce((sum: number, s: any) => sum + Number(s.dias || 0), 0)
      const aj = (ajustes || [])
        .filter((a: any) => String(a.colaborador_email).toLowerCase() === key)
        .reduce((sum: number, a: any) => sum + Number(a.dias || 0), 0)
      return { ...c, saldo: calcularVacaciones(c, tomados, aj, hoy) }
    })

    return {
      ok: true, vista, hoy, saldos,
      solicitudes: solicitudes || [],
      pendientes: (solicitudes || []).filter((s: any) => s.estado === 'pendiente').length,
    }
  }

  /* ── Vista propia ── */
  const [{ data: solicitudes }, { data: ajustes }] = await Promise.all([
    supabase.from('piola_vacation_requests').select('*')
      .ilike('colaborador_email', perfil.email).order('created_at', { ascending: false }),
    supabase.from('piola_vacation_adjustments').select('dias').ilike('colaborador_email', perfil.email),
  ])

  const tomados = (solicitudes || [])
    .filter((s: any) => s.estado === 'aprobada')
    .reduce((sum: number, s: any) => sum + Number(s.dias || 0), 0)
  const aj = (ajustes || []).reduce((sum: number, a: any) => sum + Number(a.dias || 0), 0)

  return {
    ok: true,
    vista: 'mi',
    hoy,
    saldo: calcularVacaciones(perfil.colaborador || {}, tomados, aj, hoy),
    solicitudes: solicitudes || [],
  }
})
