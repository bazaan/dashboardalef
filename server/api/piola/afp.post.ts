/**
 * POST /api/piola/afp — genera el descargo/reporte AFP del periodo (§7.5)
 *
 * SOLO ADMINISTRADOR. Hoy Edson lo arma a mano todos los meses; esto lo
 * construye a partir de las boletas ya generadas del periodo (o, si aún no
 * existen, calculándolas al vuelo desde la ficha de cada colaborador).
 *
 * Body: { periodo: 'YYYY-MM', enviar?: boolean, email?: string }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAdmin, enviarCorreoPiola } from '../../utils/piola'
import { calcularBoleta, htmlAfp, subirDocumento } from '../../utils/piola-planilla'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirAdmin(perfil, 'el reporte AFP')

  const body = await readBody(event)
  const periodo = String(body?.periodo || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw createError({ statusCode: 400, statusMessage: "Periodo inválido: se espera 'YYYY-MM'" })
  }

  const [{ data: colaboradores }, { data: boletas }] = await Promise.all([
    supabase.from('piola_colaboradores').select('*')
      .eq('tipo_contrato', 'planilla').eq('activo', true).order('nombre'),
    supabase.from('piola_payslips').select('*').eq('periodo', periodo),
  ])

  const filas = (colaboradores || [])
    // ONP no se declara en el descargo AFP
    .filter((c: any) => String(c.afp_nombre || '').toLowerCase() !== 'onp' && c.afp_nombre)
    .map((c: any) => {
      const boleta = (boletas || []).find(
        (b: any) => String(b.colaborador_email).toLowerCase() === String(c.email).toLowerCase())

      const calc = boleta?.detalle?.calc || calcularBoleta({
        sueldo_bruto: c.sueldo_bruto ?? 0,
        asignacion_familiar: c.asignacion_familiar ?? false,
        afp_nombre: c.afp_nombre,
        afp_tipo_comision: c.afp_tipo_comision,
      })

      return {
        colaborador_email: c.email,
        colaborador_nombre: c.nombre,
        dni: c.dni,
        afp_nombre: c.afp_nombre,
        cuspp: c.afp_cuspp,
        base_afecta: calc.detalle?.base_afecta ?? 0,
        aporte_fondo: calc.detalle?.afp_fondo ?? 0,
        comision: calc.detalle?.afp_comision ?? 0,
        prima: calc.detalle?.afp_prima ?? 0,
        total: calc.descuento_afp ?? 0,
        origen: boleta ? 'boleta_generada' : 'calculado_de_la_ficha',
      }
    })

  const r2 = (n: number) => Math.round(n * 100) / 100
  const totalAfecto = r2(filas.reduce((s, f) => s + Number(f.base_afecta || 0), 0))
  const totalAportes = r2(filas.reduce((s, f) => s + Number(f.total || 0), 0))

  const html = htmlAfp({ periodo, filas, total_afecto: totalAfecto, total_aportes: totalAportes, generado_por: perfil.email })
  const url = await subirDocumento(supabase, `afp/${periodo}/descargo-afp-${periodo}.html`, html)

  const { data, error } = await supabase.from('piola_afp_reports').upsert({
    periodo,
    total_afecto: totalAfecto,
    total_aportes: totalAportes,
    detalle: filas,
    pdf_url: url,
    generado_por: perfil.email,
  }, { onConflict: 'periodo' }).select('*').single()
  if (error) throw createError({ statusCode: 500, statusMessage: `Error guardando el reporte AFP: ${error.message}` })

  let envio: any = null
  if (body?.enviar) {
    envio = await enviarCorreoPiola({
      to: body?.email || perfil.email,
      subject: `Descargo AFP — ${periodo}`,
      html,
    })
  }

  return {
    ok: true,
    reporte: data,
    colaboradores: filas.length,
    total_aportes: totalAportes,
    // Aviso honesto: las tasas son las de referencia hasta que Piola envíe su formato real
    aviso: 'Tasas de referencia (fondo 10 %, prima ~1.74 %, comisión por AFP). Verificar contra el portal de cada AFP antes de declarar.',
    envio,
  }
})
