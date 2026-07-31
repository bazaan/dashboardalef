/**
 * GET /api/piola/tareo — lectura del tareo (§7.1)
 *
 * Query:
 *   ?vista=mi       (default) historial propio del colaborador
 *   ?vista=tablero  quién está en jornada AHORA / en break / sin marcar   [RR.HH. o Admin]
 *   ?vista=mes      reporte mensual de todos los colaboradores            [RR.HH. o Admin]
 *   ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD   rango (default: mes en curso)
 *   ?email=...      ver el tareo de otro colaborador                      [RR.HH. o Admin]
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, hoyLima, periodoLima } from '../../utils/piola'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  const q = getQuery(event)

  const vista = String(q.vista || 'mi')
  const hoy = hoyLima()
  const desde = String(q.desde || `${periodoLima()}-01`)
  const hasta = String(q.hasta || hoy)

  // Cualquier vista que no sea la propia exige permiso sobre el módulo RR. HH.
  const esVistaAjena = vista !== 'mi' || (q.email && String(q.email).toLowerCase() !== perfil.email.toLowerCase())
  if (esVistaAjena) exigirModulo(perfil, 'rrhh', 'view')

  /* ── Tablero en vivo ── */
  if (vista === 'tablero') {
    const { data: colaboradores } = await supabase
      .from('piola_colaboradores')
      .select('email, nombre, cargo, tipo_contrato, activo')
      .eq('activo', true).order('nombre')

    const { data: marcas } = await supabase
      .from('piola_attendance').select('*').eq('fecha', hoy)

    const ids = (marcas || []).map((m: any) => m.id)
    const { data: breaks } = ids.length
      ? await supabase.from('piola_attendance_breaks').select('*').in('attendance_id', ids)
      : { data: [] as any[] }

    const filas = (colaboradores || []).map((c: any) => {
      const m = (marcas || []).find((x: any) => String(x.colaborador_email).toLowerCase() === String(c.email).toLowerCase())
      const enBreak = !!(breaks || []).some((b: any) => b.attendance_id === m?.id && !b.break_end)
      let estado: string = 'sin_marcar'
      if (m?.check_out) estado = 'jornada_cerrada'
      else if (enBreak) estado = 'en_break'
      else if (m?.check_in) estado = 'en_jornada'
      return {
        email: c.email, nombre: c.nombre, cargo: c.cargo, tipo_contrato: c.tipo_contrato,
        estado,
        check_in: m?.check_in || null,
        check_out: m?.check_out || null,
        worked_minutes: m?.worked_minutes || 0,
        break_minutes: m?.break_minutes || 0,
      }
    })

    return {
      ok: true, vista, fecha: hoy, filas,
      resumen: {
        total: filas.length,
        en_jornada: filas.filter(f => f.estado === 'en_jornada').length,
        en_break: filas.filter(f => f.estado === 'en_break').length,
        cerrada: filas.filter(f => f.estado === 'jornada_cerrada').length,
        sin_marcar: filas.filter(f => f.estado === 'sin_marcar').length,
      },
    }
  }

  /* ── Reporte mensual de todo el equipo (exportable desde la UI) ── */
  if (vista === 'mes') {
    const { data } = await supabase
      .from('piola_attendance').select('*')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false })

    const porColaborador: Record<string, any> = {}
    for (const m of data || []) {
      const k = String(m.colaborador_email).toLowerCase()
      porColaborador[k] ||= { email: m.colaborador_email, dias: 0, minutos: 0, faltas: 0, incompletos: 0 }
      porColaborador[k].minutos += Number(m.worked_minutes || 0)
      if (Number(m.worked_minutes) > 0) porColaborador[k].dias++
      if (m.estado === 'falta') porColaborador[k].faltas++
      if (m.estado === 'incompleto') porColaborador[k].incompletos++
    }

    return {
      ok: true, vista, desde, hasta,
      registros: data || [],
      resumen: Object.values(porColaborador).map((r: any) => ({
        ...r, horas: Math.round(r.minutos / 6) / 10,
      })),
    }
  }

  /* ── Historial propio (o de un colaborador puntual) ── */
  const email = q.email ? String(q.email) : perfil.email
  const { data: registros } = await supabase
    .from('piola_attendance').select('*')
    .ilike('colaborador_email', email)
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false })

  const ids = (registros || []).map((r: any) => r.id)
  const { data: breaks } = ids.length
    ? await supabase.from('piola_attendance_breaks').select('*').in('attendance_id', ids).order('break_start')
    : { data: [] as any[] }

  const minutos = (registros || []).reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0)

  return {
    ok: true,
    vista: 'mi',
    email,
    desde, hasta,
    registros: (registros || []).map((r: any) => ({
      ...r, breaks: (breaks || []).filter((b: any) => b.attendance_id === r.id),
    })),
    resumen: {
      dias: (registros || []).filter((r: any) => Number(r.worked_minutes) > 0).length,
      minutos,
      horas: Math.round(minutos / 6) / 10,
    },
  }
})
