/**
 * GET /api/piola/perfil
 *
 * Devuelve todo lo que el dashboard necesita para pintarse para ESTE usuario:
 *   • Su ficha de colaborador y su rol Piola
 *   • El mapa de permisos por módulo (para armar el menú lateral — §8)
 *   • Los widgets del colaborador (§7.3): saldo de vacaciones, antigüedad,
 *     días para la renovación del contrato y días trabajados en el mes.
 *
 * El menú se pinta con esto, pero cada endpoint sensible vuelve a verificar
 * permisos por su cuenta: el cliente nunca es la fuente de la verdad.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionPiola, calcularVacaciones, hoyLima, periodoLima, diasEntre,
} from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const hoy = hoyLima()
  const periodo = periodoLima()

  /* ── Vacaciones (§7.2): solo tienen sentido si está en planilla ── */
  const { data: vacAprobadas } = await supabase
    .from('piola_vacation_requests')
    .select('dias')
    .ilike('colaborador_email', perfil.email)
    .eq('estado', 'aprobada')

  const { data: ajustes } = await supabase
    .from('piola_vacation_adjustments')
    .select('dias')
    .ilike('colaborador_email', perfil.email)

  const diasTomados = (vacAprobadas || []).reduce((s: number, v: any) => s + Number(v.dias || 0), 0)
  const diasAjustes = (ajustes || []).reduce((s: number, v: any) => s + Number(v.dias || 0), 0)
  const vacaciones = calcularVacaciones(perfil.colaborador || {}, diasTomados, diasAjustes, hoy)

  /* ── Tareo del mes en curso (§7.3) ── */
  const { data: marcaciones } = await supabase
    .from('piola_attendance')
    .select('fecha, worked_minutes, estado, check_in, check_out')
    .ilike('colaborador_email', perfil.email)
    .gte('fecha', `${periodo}-01`)
    .lte('fecha', hoy)
    .order('fecha', { ascending: false })

  const diasTrabajados = (marcaciones || []).filter((m: any) => Number(m.worked_minutes) > 0).length
  const minutosMes = (marcaciones || []).reduce((s: number, m: any) => s + Number(m.worked_minutes || 0), 0)

  /* ── Marcación de HOY: para saber qué botón mostrar ── */
  const hoyRow = (marcaciones || []).find((m: any) => m.fecha === hoy) || null
  let breakAbierto = false
  if (hoyRow) {
    const { data: att } = await supabase
      .from('piola_attendance').select('id').ilike('colaborador_email', perfil.email).eq('fecha', hoy).maybeSingle()
    if (att?.id) {
      const { data: brk } = await supabase
        .from('piola_attendance_breaks').select('id').eq('attendance_id', att.id).is('break_end', null).limit(1)
      breakAbierto = !!(brk && brk.length)
    }
  }

  /* ── Contrato: cuántos días quedan para la renovación (§7.3) ── */
  const finContrato = perfil.colaborador?.fecha_fin_contrato
    ? String(perfil.colaborador.fecha_fin_contrato).slice(0, 10) : null
  const diasParaRenovacion = finContrato ? diasEntre(hoy, finContrato) : null

  return {
    ok: true,
    hoy,
    periodo,
    email: perfil.email,
    rol_global: perfil.rolGlobal,
    rol_piola: perfil.rolPiola,
    es_admin: perfil.esAdmin,
    permisos: perfil.permisos,
    colaborador: perfil.colaborador
      ? {
          ...perfil.colaborador,
          // Los montos de planilla no viajan al navegador salvo para el admin
          sueldo_bruto: perfil.esAdmin ? perfil.colaborador.sueldo_bruto : undefined,
          comision_pct: perfil.esAdmin ? perfil.colaborador.comision_pct : undefined,
        }
      : null,
    widgets: {
      vacaciones,
      antiguedad_dias: vacaciones.antiguedad_dias,
      fecha_fin_contrato: finContrato,
      dias_para_renovacion: diasParaRenovacion,
      dias_trabajados_mes: diasTrabajados,
      horas_trabajadas_mes: Math.round(minutosMes / 6) / 10,
    },
    tareo_hoy: hoyRow
      ? { ...hoyRow, break_abierto: breakAbierto }
      : null,
  }
})
