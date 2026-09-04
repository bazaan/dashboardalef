/**
 * POST /api/piola/boletas — pagos al equipo (§7.5 + reunión 31/08/2026)
 *
 * SOLO ADMINISTRADOR. Ningún otro rol puede ver ni generar estos documentos.
 *
 * DOBLE FUNCIÓN (Edson, 31/08: "ya hay que usarlo y también para asignar y
 * poner los vouchers de los pagos de los recibos por honorarios"):
 *
 *   • `tipo: 'planilla'`   → boleta de pago. AFP/ONP, EsSalud del empleador,
 *                            asignación familiar y días trabajados.
 *   • `tipo: 'honorarios'` → recibo por honorarios. NADA de lo anterior: solo
 *                            retención de renta de 4.ª categoría (8 %, o 0 si
 *                            el prestador tiene constancia de suspensión), el
 *                            n.º del recibo que él emitió en SUNAT y el
 *                            voucher del pago.
 *
 * Comparten tabla porque para RR. HH. son la misma pregunta —cuánto se le pagó
 * a alguien este mes—, pero los campos que no aplican quedan en 0 y ni el
 * documento ni la UI los muestran.
 *
 * Body:
 *   { accion: 'generar', tipo?: 'planilla'|'honorarios', periodo: 'YYYY-MM',
 *     colaborador_email?, ajustes?: {...}, enviar?: boolean }
 *       · sin colaborador_email → genera la de TODOS los del tipo pedido
 *       · `ajustes` permite sobrescribir por colaborador:
 *         planilla   → { "hector@piola.pe": { dias_trabajados: 28, otros_ingresos: 300, descuento_renta: 120 } }
 *         honorarios → { "hector@piola.pe": { monto_bruto: 2500, rxh_numero: 'E001-45',
 *                                             retencion_pct: 8, retencion_suspendida: false } }
 *   { accion: 'voucher', id, voucher_url?, rxh_numero?, pagado_at?, quitar? }
 *   { accion: 'enviar', id }                → manda el documento por correo
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

  /* ══════════ Voucher del pago (RxH ya emitido) ══════════ */
  /**
   * Lo que Piola guarda de un recibo por honorarios NO es el comprobante —ese
   * lo emite el prestador en SUNAT— sino la constancia de que se le pagó. Por
   * eso el voucher se registra DESPUÉS, cuando la transferencia ya salió, y no
   * al generar el documento.
   *
   * Se permite también sobre una boleta de planilla: la transferencia del
   * sueldo también tiene voucher y la columna es de la tabla, no del tipo.
   */
  if (accion === 'voucher') {
    const { data: doc } = await supabase
      .from('piola_payslips').select('*').eq('id', body?.id).maybeSingle()
    if (!doc) throw createError({ statusCode: 404, statusMessage: 'Documento no encontrado' })

    const patch: Record<string, any> = {}

    if (body?.quitar === true) {
      // Se desvincula, no se borra del bucket: si fue un error de dedo, el
      // archivo sigue ahí. La limpieza de huérfanos es un proceso aparte.
      patch.voucher_url = null
      patch.pagado_at = null
    } else if (body?.voucher_url !== undefined) {
      patch.voucher_url = normalizarAdjunto(body.voucher_url)
    }

    if (body?.rxh_numero !== undefined) {
      patch.rxh_numero = String(body.rxh_numero || '').trim().slice(0, 60) || null
    }
    if (body?.pagado_at !== undefined) {
      patch.pagado_at = aTimestamp(body.pagado_at)
    } else if (patch.voucher_url && !doc.pagado_at) {
      // Si adjuntan el voucher y no dicen cuándo se pagó, se asume que es hoy:
      // el voucher solo existe después de la transferencia.
      patch.pagado_at = new Date().toISOString()
    }

    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No se envió ningún dato del pago que actualizar' })
    }

    const { data, error } = await supabase.from('piola_payslips')
      .update(patch).eq('id', doc.id).select('*').single()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true, boleta: data }
  }

  /* ══════════ Enviar por correo ══════════ */
  if (accion === 'enviar') {
    const { data: boleta } = await supabase
      .from('piola_payslips').select('*').eq('id', body?.id).maybeSingle()
    if (!boleta) throw createError({ statusCode: 404, statusMessage: 'Boleta no encontrada' })

    const destino = body?.email || boleta.colaborador_email
    const { data: colab } = await supabase
      .from('piola_colaboradores').select('*').ilike('email', boleta.colaborador_email).maybeSingle()

    const esRxh = boleta.tipo === 'honorarios'
    const html = esRxh
      ? htmlRecibo({
          colaborador: colab || { nombre: boleta.colaborador_nombre },
          periodo: boleta.periodo,
          codigo: boleta.codigo,
          rxh_numero: boleta.rxh_numero,
          pagado_at: boleta.pagado_at,
          voucher_url: boleta.voucher_url,
          calc: boleta.detalle?.calc || reconstruirRecibo(boleta),
          generado_por: boleta.generado_por,
        })
      : htmlBoleta({
          colaborador: colab || { nombre: boleta.colaborador_nombre },
          periodo: boleta.periodo,
          codigo: boleta.codigo,
          calc: boleta.detalle?.calc || reconstruirCalc(boleta),
          generado_por: boleta.generado_por,
        })

    const envio = await enviarCorreoPiola({
      to: destino,
      subject: esRxh
        ? `Constancia de pago de honorarios — ${boleta.periodo}`
        : `Tu boleta de pago — ${boleta.periodo}`,
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

  const tipo = String(body?.tipo || 'planilla') === 'honorarios' ? 'honorarios' : 'planilla'

  // El tipo de documento sale del tipo de contrato: una boleta de planilla a un
  // proveedor de recibo por honorarios sería una infracción laboral, no un
  // detalle de formato.
  let query = supabase.from('piola_colaboradores').select('*')
    .eq('tipo_contrato', tipo).eq('activo', true)
  if (body?.colaborador_email) query = query.ilike('email', String(body.colaborador_email))

  const { data: colaboradores } = await query
  if (!colaboradores?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: tipo === 'honorarios'
        ? 'No hay colaboradores de recibo por honorarios que coincidan. Revisa que su ficha tenga tipo_contrato = honorarios.'
        : 'No hay colaboradores en planilla que coincidan. Las boletas solo aplican a tipo_contrato = planilla.',
    })
  }

  const ajustes = body?.ajustes || {}
  // Un monto suelto en el body solo puede aplicarse cuando el destinatario es
  // uno: repartir el mismo honorario entre todos sería inventar importes.
  const unico = colaboradores.length === 1
  const generadas: any[] = []
  const errores: any[] = []

  for (const c of colaboradores) {
    const extra = ajustes[c.email] || ajustes[String(c.email).toLowerCase()] || {}

    const armado = tipo === 'honorarios'
      ? armarRecibo(c, extra, unico ? body : {}, periodo, perfil.email)
      : armarBoleta(c, extra, periodo, perfil.email)

    if ('error' in armado) {
      errores.push({ colaborador: c.email, error: armado.error })
      continue
    }

    const url = await subirDocumento(supabase, armado.ruta, armado.html)

    const { data, error } = await supabase.from('piola_payslips')
      .upsert({ ...armado.fila, pdf_url: url }, { onConflict: 'colaborador_email,periodo' })
      .select('*').single()

    if (error) errores.push({ colaborador: c.email, error: error.message })
    else generadas.push(data)

    // Envío inmediato opcional
    if (!error && body?.enviar) {
      const envio = await enviarCorreoPiola({
        to: c.email,
        subject: tipo === 'honorarios'
          ? `Constancia de pago de honorarios — ${periodo}`
          : `Tu boleta de pago — ${periodo}`,
        html: armado.html,
      })
      if (envio.ok) {
        await supabase.from('piola_payslips')
          .update({ enviado_at: new Date().toISOString(), enviado_a: c.email }).eq('id', data.id)
      } else {
        errores.push({ colaborador: c.email, error: `Documento generado pero el correo falló: ${envio.error}` })
      }
    }
  }

  return {
    ok: true,
    tipo,
    periodo,
    // §7.4 (segundo día hábil) es la fecha límite de la PLANILLA. Un recibo por
    // honorarios se paga según lo pactado, así que no se afirma una fecha legal
    // que no existe.
    fecha_limite_pago: tipo === 'planilla' ? segundoDiaHabil(periodo) : null,
    generadas: generadas.length,
    boletas: generadas,
    errores,
  }
})

/* ══════════════════ Armado de cada tipo de documento ══════════════════ */

type Armado = { fila: Record<string, any>; html: string; ruta: string } | { error: string }

/** Boleta de planilla: el flujo que ya existía, sin cambios de cálculo. */
function armarBoleta(c: any, extra: any, periodo: string, generadoPor: string): Armado {
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
  const html = htmlBoleta({ colaborador: c, periodo, codigo, calc, generado_por: generadoPor })

  return {
    html,
    ruta: `boletas/${periodo}/${codigo}.html`,
    fila: {
      codigo,
      tipo: 'planilla',
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
      generado_por: generadoPor,
    },
  }
}

/**
 * Recibo por honorarios.
 *
 * El prefijo del código es `RXH-` y no `BOL-` porque `piola_payslips.codigo` es
 * UNIQUE para toda la tabla: los dos correlativos usan el id del colaborador y
 * sin prefijo distinto chocarían entre sí en el mismo periodo.
 */
function armarRecibo(c: any, extra: any, sueltos: any, periodo: string, generadoPor: string): Armado {
  // `sueldo_bruto` de la ficha es el pactado mensual; sirve de default, pero el
  // honorario suele variar mes a mes y por eso el formulario lo pide siempre.
  const bruto = Number(extra.monto_bruto ?? sueltos?.monto_bruto ?? c.sueldo_bruto ?? 0)
  if (!(bruto > 0)) {
    return { error: 'Falta el monto del recibo por honorarios (no está en la ficha ni se envió en el formulario).' }
  }

  const calc = calcularRecibo({
    monto_bruto: bruto,
    otros_ingresos: extra.otros_ingresos ?? sueltos?.otros_ingresos ?? 0,
    otros_descuentos: extra.otros_descuentos ?? sueltos?.otros_descuentos ?? 0,
    retencion_pct: extra.retencion_pct ?? sueltos?.retencion_pct,
    retencion_suspendida: extra.retencion_suspendida ?? sueltos?.retencion_suspendida,
  })

  const rxhNumero = String(extra.rxh_numero ?? sueltos?.rxh_numero ?? '').trim().slice(0, 60) || null
  const voucher = normalizarAdjunto(extra.voucher_url ?? sueltos?.voucher_url)
  const pagadoAt = aTimestamp(extra.pagado_at ?? sueltos?.pagado_at)

  const codigo = `RXH-${periodo.replace('-', '')}-${String(c.id).padStart(4, '0')}`
  const html = htmlRecibo({
    colaborador: c, periodo, codigo, calc,
    rxh_numero: rxhNumero, pagado_at: pagadoAt, voucher_url: voucher,
    generado_por: generadoPor,
  })

  return {
    html,
    ruta: `honorarios/${periodo}/${codigo}.html`,
    fila: {
      codigo,
      tipo: 'honorarios',
      colaborador_email: c.email,
      colaborador_nombre: c.nombre,
      periodo,
      // Los conceptos de planilla NO aplican a un RxH: van en 0 y ni el
      // documento ni la tabla los muestran para este tipo.
      dias_trabajados: 0,
      sueldo_bruto: calc.monto_bruto,
      asignacion_familiar: 0,
      otros_ingresos: calc.otros_ingresos,
      total_ingresos: calc.total_ingresos,
      descuento_afp: 0,
      // `descuento_renta` es la de 5.ª categoría (planilla). La de 4.ª tiene su
      // propia columna: duplicarla acá haría que quien sume las dos cobre doble.
      descuento_renta: 0,
      otros_descuentos: calc.otros_descuentos,
      total_descuentos: calc.total_descuentos,
      neto: calc.neto,
      aporte_essalud: 0,
      rxh_numero: rxhNumero,
      rxh_retencion: calc.retencion,
      voucher_url: voucher,
      pagado_at: pagadoAt,
      detalle: { calc, ajustes: extra },
      generado_por: generadoPor,
    },
  }
}

/* ══════════════════ Cálculo del recibo por honorarios ══════════════════ */

/**
 * Retención de renta de 4.ª categoría. 8 % es la tasa que fija la SUNAT, no
 * Piola: por eso es un parámetro del cálculo y no un número enterrado en la
 * fórmula. Baja a 0 cuando el prestador tiene constancia de suspensión de
 * retenciones vigente, que es el caso de la mayoría de freelancers del año.
 */
const RETENCION_4TA_PCT = 8

const r2 = (n: number) => Math.round(n * 100) / 100

export interface ReciboCalculado {
  monto_bruto: number
  otros_ingresos: number
  total_ingresos: number
  retencion_pct: number
  retencion: number
  otros_descuentos: number
  total_descuentos: number
  neto: number
  detalle: {
    tipo: 'honorarios'
    retencion_suspendida: boolean
    base_retencion: number
  }
}

function calcularRecibo(e: {
  monto_bruto?: number
  otros_ingresos?: number
  otros_descuentos?: number
  retencion_pct?: number | null
  retencion_suspendida?: boolean
}): ReciboCalculado {
  const bruto = r2(Number(e.monto_bruto || 0))
  const otrosIng = r2(Number(e.otros_ingresos || 0))
  const totalIngresos = r2(bruto + otrosIng)

  const suspendida = e.retencion_suspendida === true
  const pctPedido = Number(e.retencion_pct)
  const pct = suspendida ? 0
    : (Number.isFinite(pctPedido) && pctPedido >= 0 ? pctPedido : RETENCION_4TA_PCT)

  // La retención se calcula sobre el importe total del recibo, no sobre una
  // "base afecta" recortada: en 4.ª categoría no hay conceptos no afectos.
  const retencion = r2(totalIngresos * pct / 100)
  const otrosDesc = r2(Number(e.otros_descuentos || 0))
  const totalDescuentos = r2(retencion + otrosDesc)

  return {
    monto_bruto: bruto,
    otros_ingresos: otrosIng,
    total_ingresos: totalIngresos,
    retencion_pct: pct,
    retencion,
    otros_descuentos: otrosDesc,
    total_descuentos: totalDescuentos,
    neto: r2(totalIngresos - totalDescuentos),
    detalle: { tipo: 'honorarios', retencion_suspendida: suspendida, base_retencion: totalIngresos },
  }
}

/* ══════════════════ Documento del recibo por honorarios ══════════════════ */

/*
 * La plantilla vive acá y no en `server/utils/piola-planilla.ts` —donde está la
 * de planilla— porque ese archivo no exporta su CSS base. Cuando Piola envíe
 * los MODELOS REALES (§12, sigue pendiente: en la reunión del 31/08 quedó como
 * tarea suya "mandarnos el diseño con el que quieran que se vea la boleta"),
 * las dos plantillas se unifican ahí. Hasta entonces esto replica el mismo
 * branding, sin rediseñar nada.
 */
const MARCA = {
  nombre: process.env.PIOLA_RAZON_SOCIAL || 'PIOLA',
  ruc: process.env.PIOLA_RUC || '',
  direccion: process.env.PIOLA_DIRECCION || '',
  color: process.env.PIOLA_COLOR || '#111111',
  acento: process.env.PIOLA_COLOR_ACENTO || '#e2564a',
}

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fechaLarga = (v: any) => {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? String(v)
    : new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(d)
}

/** Constancia interna del pago de un recibo por honorarios (reunión 31/08/2026). */
function htmlRecibo(datos: {
  colaborador: any
  periodo: string
  codigo: string
  calc: ReciboCalculado
  rxh_numero?: string | null
  pagado_at?: string | null
  voucher_url?: string | null
  generado_por?: string
}): string {
  const c = datos.colaborador || {}
  const k = datos.calc
  const fila = (concepto: string, monto: number) =>
    `<tr><td>${esc(concepto)}</td><td class="n">${money(monto)}</td></tr>`

  const css = `
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    color:#1a1a1a;margin:0;padding:32px;background:#f5f5f5}
  .doc{max-width:820px;margin:0 auto;background:#fff;padding:38px 42px;border-radius:10px;
    box-shadow:0 2px 14px rgba(0,0,0,.08)}
  .head{display:flex;justify-content:space-between;align-items:flex-start;
    border-bottom:3px solid ${MARCA.acento};padding-bottom:16px;margin-bottom:22px}
  .marca{font-size:26px;font-weight:800;letter-spacing:-.5px;color:${MARCA.color}}
  .marca small{display:block;font-size:11px;font-weight:500;opacity:.65;letter-spacing:.3px;margin-top:3px}
  .tit{text-align:right} .tit h1{margin:0;font-size:16px;text-transform:uppercase;letter-spacing:1px}
  .tit .per{font-size:13px;opacity:.7;margin-top:4px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;margin-bottom:22px}
  .campo{font-size:12.5px;display:flex;justify-content:space-between;border-bottom:1px dotted #ddd;padding:5px 0}
  .campo span{opacity:.6} .campo strong{font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:18px}
  th{text-align:left;background:#fafafa;padding:9px 10px;font-size:11px;text-transform:uppercase;
    letter-spacing:.5px;opacity:.7;border-bottom:1px solid #e5e5e5}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
  td.n,th.n{text-align:right}
  .tot{background:${MARCA.color};color:#fff;border-radius:8px;padding:14px 18px;display:flex;
    justify-content:space-between;align-items:center;font-size:16px;font-weight:700;margin-top:6px}
  .nota{margin-top:18px;font-size:11.5px;line-height:1.6;background:#fafafa;border-left:3px solid ${MARCA.acento};
    padding:11px 14px;border-radius:0 6px 6px 0}
  .pie{margin-top:26px;font-size:10.5px;opacity:.55;text-align:center;line-height:1.6}
  .firmas{display:flex;gap:60px;margin-top:52px}
  .firma{flex:1;border-top:1px solid #999;padding-top:6px;font-size:11px;text-align:center;opacity:.75}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;padding:0;max-width:none}}
  `

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Honorarios ${esc(datos.codigo)}</title><style>${css}</style></head><body>
<div class="doc">
  <div class="head">
    <div class="marca">${esc(MARCA.nombre)}
      <small>${MARCA.ruc ? 'RUC ' + esc(MARCA.ruc) : ''}${MARCA.direccion ? ' · ' + esc(MARCA.direccion) : ''}</small>
    </div>
    <div class="tit">
      <h1>Constancia de pago — Honorarios</h1>
      <div class="per">Periodo ${esc(datos.periodo)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="campo"><span>Prestador del servicio</span><strong>${esc(c.nombre)}</strong></div>
    <div class="campo"><span>Código interno</span><strong>${esc(datos.codigo)}</strong></div>
    <div class="campo"><span>DNI</span><strong>${esc(c.dni || '—')}</strong></div>
    <div class="campo"><span>Servicio</span><strong>${esc(c.cargo || '—')}</strong></div>
    <div class="campo"><span>N.º de recibo (SUNAT)</span><strong>${esc(datos.rxh_numero || 'Pendiente')}</strong></div>
    <div class="campo"><span>Fecha de pago</span><strong>${esc(fechaLarga(datos.pagado_at))}</strong></div>
    <div class="campo"><span>Modalidad</span><strong>Recibo por honorarios</strong></div>
    <div class="campo"><span>Voucher del pago</span><strong>${datos.voucher_url ? 'Adjunto' : 'Pendiente'}</strong></div>
  </div>

  <table>
    <thead><tr><th>Concepto</th><th class="n">Monto</th></tr></thead>
    <tbody>
      ${fila('Honorarios del periodo', k.monto_bruto)}
      ${k.otros_ingresos ? fila('Otros conceptos', k.otros_ingresos) : ''}
      <tr><td><strong>Importe total del recibo</strong></td><td class="n"><strong>${money(k.total_ingresos)}</strong></td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th>Retenciones y descuentos</th><th class="n">Monto</th></tr></thead>
    <tbody>
      ${fila(
        k.detalle.retencion_suspendida
          ? 'Retención de renta de 4.ª categoría (suspensión vigente)'
          : `Retención de renta de 4.ª categoría (${k.retencion_pct} %)`,
        k.retencion,
      )}
      ${k.otros_descuentos ? fila('Otros descuentos', k.otros_descuentos) : ''}
      <tr><td><strong>Total retenido</strong></td><td class="n"><strong>${money(k.total_descuentos)}</strong></td></tr>
    </tbody>
  </table>

  <div class="tot"><span>Neto pagado</span><span>${money(k.neto)}</span></div>

  <div class="nota">
    Este documento es la <strong>constancia interna de pago</strong> de ${esc(MARCA.nombre)}.
    El comprobante válido ante la SUNAT es el <strong>recibo por honorarios electrónico</strong>
    que emite el prestador del servicio${datos.rxh_numero ? ' (n.º ' + esc(datos.rxh_numero) + ')' : ''}.
    ${k.detalle.retencion_suspendida
      ? 'No se aplicó retención de 4.ª categoría por constancia de suspensión vigente.'
      : ''}
  </div>

  <div class="firmas">
    <div class="firma">${esc(MARCA.nombre)} — Contratante</div>
    <div class="firma">${esc(c.nombre)} — Prestador del servicio</div>
  </div>

  <div class="pie">
    Documento generado automáticamente por el dashboard de ${esc(MARCA.nombre)}${datos.generado_por ? ' · ' + esc(datos.generado_por) : ''}.<br>
    Moneda: soles (PEN). Un recibo por honorarios no genera aportes a AFP/ONP ni a EsSalud.
  </div>
</div></body></html>`
}

/* ══════════════════ Utilidades ══════════════════ */

/**
 * Deja el adjunto en una forma que el visor pueda abrir: un path dentro del
 * bucket `piola-docs` o una URL http(s). Cualquier otro esquema (`javascript:`,
 * `data:`) se descarta — el valor termina dentro de un href del dashboard.
 */
function normalizarAdjunto(v: any): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500)
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null   // otro esquema: no se acepta
  return s.replace(/^\/+/, '').slice(0, 500)
}

/**
 * Acepta 'YYYY-MM-DD' del <input type="date"> o un ISO completo.
 * El día suelto se ancla al mediodía de Lima: con medianoche UTC, un pago del
 * día 1 se guardaría como del día anterior.
 */
function aTimestamp(v: any): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00-05:00` : s
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

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

/** Idem para un RxH cuyo `detalle.calc` se haya perdido. */
function reconstruirRecibo(b: any): ReciboCalculado {
  const total = Number(b.total_ingresos || 0)
  const retencion = Number(b.rxh_retencion || 0)
  return {
    monto_bruto: Number(b.sueldo_bruto || 0),
    otros_ingresos: Number(b.otros_ingresos || 0),
    total_ingresos: total,
    retencion_pct: total > 0 ? Math.round(retencion / total * 10000) / 100 : 0,
    retencion,
    otros_descuentos: Number(b.otros_descuentos || 0),
    total_descuentos: Number(b.total_descuentos || 0),
    neto: Number(b.neto || 0),
    detalle: { tipo: 'honorarios', retencion_suspendida: retencion === 0, base_retencion: total },
  }
}
