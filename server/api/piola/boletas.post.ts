/**
 * POST /api/piola/boletas — generar (y opcionalmente enviar) boletas de pago (§7.5)
 *
 * SOLO ADMINISTRADOR. Ningún otro rol puede ver ni generar boletas.
 *
 * Body:
 *   { accion: 'generar', periodo: 'YYYY-MM', colaborador_email?, ajustes?: {...},
 *     enviar?: boolean }
 *       · sin colaborador_email → genera la de TODOS los que están en planilla
 *       · `ajustes` permite sobrescribir por colaborador:
 *         { "hector@piola.pe": { dias_trabajados: 28, otros_ingresos: 300, descuento_renta: 120 } }
 *   { accion: 'enviar', id }                → manda la boleta por correo
 *   { accion: 'eliminar', id }
 *
 * El admin llena un formulario corto con los datos variables del mes y el
 * sistema arma el documento: nada se redacta a mano.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAdmin, enviarCorreoPiola, segundoDiaHabil } from '../../utils/piola'
import { calcularBoleta, htmlBoleta, subirDocumento } from '../../utils/piola-planilla'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  exigirAdmin(perfil, 'las boletas de pago')

  const body = await readBody(event)
  const accion = String(body?.accion || 'generar')

  /* ══════════ Enviar por correo ══════════ */
  if (accion === 'enviar') {
    const { data: boleta } = await supabase
      .from('piola_payslips').select('*').eq('id', body?.id).maybeSingle()
    if (!boleta) throw createError({ statusCode: 404, statusMessage: 'Boleta no encontrada' })

    const destino = body?.email || boleta.colaborador_email
    const { data: colab } = await supabase
      .from('piola_colaboradores').select('*').ilike('email', boleta.colaborador_email).maybeSingle()

    const html = htmlBoleta({
      colaborador: colab || { nombre: boleta.colaborador_nombre },
      periodo: boleta.periodo,
      codigo: boleta.codigo,
      calc: boleta.detalle?.calc || reconstruirCalc(boleta),
      generado_por: boleta.generado_por,
    })

    const envio = await enviarCorreoPiola({
      to: destino,
      subject: `Tu boleta de pago — ${boleta.periodo}`,
      html,
    })
    if (!envio.ok) throw createError({ statusCode: 502, statusMessage: `No se pudo enviar el correo: ${envio.error}` })

    const { data: act } = await supabase.from('piola_payslips')
      .update({ enviado_at: new Date().toISOString(), enviado_a: destino })
      .eq('id', boleta.id).select('*').single()

    return { ok: true, enviado_a: destino, boleta: act }
  }

  /* ══════════ Eliminar ══════════ */
  if (accion === 'eliminar') {
    const { error } = await supabase.from('piola_payslips').delete().eq('id', body?.id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true, eliminada: body?.id }
  }

  /* ══════════ Generar ══════════ */
  const periodo = String(body?.periodo || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw createError({ statusCode: 400, statusMessage: "Periodo inválido: se espera 'YYYY-MM'" })
  }

  let query = supabase.from('piola_colaboradores').select('*')
    .eq('tipo_contrato', 'planilla').eq('activo', true)
  if (body?.colaborador_email) query = query.ilike('email', String(body.colaborador_email))

  const { data: colaboradores } = await query
  if (!colaboradores?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No hay colaboradores en planilla que coincidan. Las boletas solo aplican a tipo_contrato = planilla.',
    })
  }

  const ajustes = body?.ajustes || {}
  const generadas: any[] = []
  const errores: any[] = []

  for (const c of colaboradores) {
    const extra = ajustes[c.email] || ajustes[String(c.email).toLowerCase()] || {}

    const calc = calcularBoleta({
      dias_trabajados: extra.dias_trabajados ?? 30,
      sueldo_bruto: extra.sueldo_bruto ?? c.sueldo_bruto ?? 0,
      asignacion_familiar: extra.asignacion_familiar ?? c.asignacion_familiar ?? false,
      otros_ingresos: extra.otros_ingresos ?? 0,
      otros_descuentos: extra.otros_descuentos ?? 0,
      descuento_renta: extra.descuento_renta ?? 0,
      afp_nombre: extra.afp_nombre ?? c.afp_nombre,
      afp_tipo_comision: extra.afp_tipo_comision ?? c.afp_tipo_comision,
      tasas: extra.tasas,
    })

    const codigo = `BOL-${periodo.replace('-', '')}-${String(c.id).padStart(4, '0')}`
    const html = htmlBoleta({ colaborador: c, periodo, codigo, calc, generado_por: perfil.email })
    const url = await subirDocumento(supabase, `boletas/${periodo}/${codigo}.html`, html)

    const fila = {
      codigo,
      colaborador_email: c.email,
      colaborador_nombre: c.nombre,
      periodo,
      dias_trabajados: calc.dias_trabajados,
      sueldo_bruto: calc.sueldo_bruto,
      asignacion_familiar: calc.asignacion_familiar,
      otros_ingresos: calc.otros_ingresos,
      total_ingresos: calc.total_ingresos,
      descuento_afp: calc.descuento_afp,
      descuento_renta: calc.descuento_renta,
      otros_descuentos: calc.otros_descuentos,
      total_descuentos: calc.total_descuentos,
      neto: calc.neto,
      aporte_essalud: calc.aporte_essalud,
      detalle: { calc, ajustes: extra },
      pdf_url: url,
      generado_por: perfil.email,
    }

    const { data, error } = await supabase.from('piola_payslips')
      .upsert(fila, { onConflict: 'colaborador_email,periodo' }).select('*').single()

    if (error) errores.push({ colaborador: c.email, error: error.message })
    else generadas.push(data)

    // Envío inmediato opcional
    if (!error && body?.enviar) {
      const envio = await enviarCorreoPiola({
        to: c.email, subject: `Tu boleta de pago — ${periodo}`, html,
      })
      if (envio.ok) {
        await supabase.from('piola_payslips')
          .update({ enviado_at: new Date().toISOString(), enviado_a: c.email }).eq('id', data.id)
      } else {
        errores.push({ colaborador: c.email, error: `Boleta generada pero el correo falló: ${envio.error}` })
      }
    }
  }

  return {
    ok: true,
    periodo,
    fecha_limite_pago: segundoDiaHabil(periodo),   // §7.4 segundo día hábil del mes siguiente
    generadas: generadas.length,
    boletas: generadas,
    errores,
  }
})

/** Boletas antiguas guardadas antes de que `detalle.calc` existiera. */
function reconstruirCalc(b: any) {
  return {
    dias_trabajados: b.dias_trabajados,
    sueldo_bruto: b.sueldo_bruto,
    asignacion_familiar: b.asignacion_familiar,
    otros_ingresos: b.otros_ingresos,
    total_ingresos: b.total_ingresos,
    descuento_afp: b.descuento_afp,
    descuento_renta: b.descuento_renta,
    otros_descuentos: b.otros_descuentos,
    total_descuentos: b.total_descuentos,
    neto: b.neto,
    aporte_essalud: b.aporte_essalud,
    detalle: { sistema_pension: 'AFP', afp_nombre: null, afp_fondo: b.descuento_afp, afp_comision: 0, afp_prima: 0, base_afecta: b.sueldo_bruto, tasas_usadas: {} },
  }
}
