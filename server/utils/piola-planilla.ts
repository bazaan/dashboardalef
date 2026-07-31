/**
 * PIOLA — Motor de planilla: boletas de pago y descargo AFP (§7.5)
 *
 * ⚠️ PARÁMETROS PROVISIONALES
 * Piola aún debe enviar los MODELOS REALES de su boleta y de su formato AFP
 * (§12, pendiente bloqueante). Mientras tanto:
 *   • Las tasas viven en `TASAS` y se pueden sobrescribir por request.
 *   • Las plantillas HTML replican la estructura estándar peruana.
 * Cuando llegue el modelo real, se ajusta SOLO este archivo: los endpoints,
 * la tabla y la UI no cambian.
 *
 * Los documentos se generan en HTML con el branding de Piola y se suben al
 * bucket `piola-docs`. Desde la UI se abren e imprimen a PDF (Ctrl/Cmd+P), y
 * por correo viajan como HTML. El proyecto no tiene librería de PDF y no se
 * agregó una dependencia solo para esto.
 */

/* ══════════════════ Tasas y topes (Perú) ══════════════════ */

export const TASAS = {
  /** Remuneración Mínima Vital */
  rmv: 1130,
  /** Asignación familiar = 10 % de la RMV */
  asignacion_familiar_pct: 10,
  /** Aporte obligatorio al fondo AFP */
  afp_fondo_pct: 10,
  /** Prima de seguro AFP (aprox., varía por trimestre) */
  afp_prima_pct: 1.74,
  /** Comisión sobre el flujo, por AFP (aprox.; se actualiza por trimestre) */
  afp_comision_flujo: {
    integra: 1.55,
    prima: 1.60,
    profuturo: 1.69,
    habitat: 1.47,
  } as Record<string, number>,
  /** ONP: tasa única, sin comisión ni prima */
  onp_pct: 13,
  /** EsSalud — aporte del EMPLEADOR, no se descuenta al colaborador */
  essalud_pct: 9,
}

export interface EntradaBoleta {
  dias_trabajados?: number
  sueldo_bruto?: number
  asignacion_familiar?: boolean
  otros_ingresos?: number
  otros_descuentos?: number
  /** Renta de 5.ª categoría: la calcula el contador, aquí se ingresa */
  descuento_renta?: number
  afp_nombre?: string | null
  afp_tipo_comision?: string | null
  /** Sobrescribe cualquier tasa para este cálculo puntual */
  tasas?: Partial<typeof TASAS>
}

export interface BoletaCalculada {
  dias_trabajados: number
  sueldo_bruto: number
  asignacion_familiar: number
  otros_ingresos: number
  total_ingresos: number
  descuento_afp: number
  descuento_renta: number
  otros_descuentos: number
  total_descuentos: number
  neto: number
  aporte_essalud: number
  detalle: {
    sistema_pension: string
    afp_nombre: string | null
    afp_fondo: number
    afp_comision: number
    afp_prima: number
    tasas_usadas: Record<string, any>
    base_afecta: number
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Calcula una boleta de pago.
 *
 * Prorratea el bruto y la asignación familiar por días trabajados (base 30),
 * que es como se hace en planilla peruana cuando el mes es incompleto.
 */
export function calcularBoleta(e: EntradaBoleta): BoletaCalculada {
  const t = { ...TASAS, ...(e.tasas || {}) }
  const dias = Math.min(30, Math.max(0, Number(e.dias_trabajados ?? 30)))
  const factor = dias / 30

  const bruto = r2(Number(e.sueldo_bruto || 0) * factor)
  const asigFam = e.asignacion_familiar ? r2(t.rmv * t.asignacion_familiar_pct / 100 * factor) : 0
  const otrosIng = r2(Number(e.otros_ingresos || 0))

  const totalIngresos = r2(bruto + asigFam + otrosIng)
  // Los "otros ingresos" pueden ser no remunerativos; la base afecta a pensión
  // es el bruto + asignación familiar (criterio conservador, ajustable).
  const baseAfecta = r2(bruto + asigFam)

  const afp = String(e.afp_nombre || '').toLowerCase().trim()
  const esOnp = afp === 'onp'
  const sinSistema = !afp

  let fondo = 0, comision = 0, prima = 0
  if (esOnp) {
    fondo = r2(baseAfecta * t.onp_pct / 100)
  } else if (!sinSistema) {
    fondo = r2(baseAfecta * t.afp_fondo_pct / 100)
    prima = r2(baseAfecta * t.afp_prima_pct / 100)
    // La comisión mixta descuenta menos sobre el flujo; sin el dato real de
    // Piola usamos la comisión de flujo de la AFP correspondiente.
    const pctComision = t.afp_comision_flujo[afp] ?? 1.60
    comision = e.afp_tipo_comision === 'mixta'
      ? r2(baseAfecta * pctComision / 100 / 2)
      : r2(baseAfecta * pctComision / 100)
  }

  const descAfp = r2(fondo + comision + prima)
  const descRenta = r2(Number(e.descuento_renta || 0))
  const otrosDesc = r2(Number(e.otros_descuentos || 0))
  const totalDescuentos = r2(descAfp + descRenta + otrosDesc)

  return {
    dias_trabajados: dias,
    sueldo_bruto: bruto,
    asignacion_familiar: asigFam,
    otros_ingresos: otrosIng,
    total_ingresos: totalIngresos,
    descuento_afp: descAfp,
    descuento_renta: descRenta,
    otros_descuentos: otrosDesc,
    total_descuentos: totalDescuentos,
    neto: r2(totalIngresos - totalDescuentos),
    aporte_essalud: r2(baseAfecta * t.essalud_pct / 100),
    detalle: {
      sistema_pension: esOnp ? 'ONP' : (sinSistema ? 'Sin sistema de pensión' : 'AFP'),
      afp_nombre: e.afp_nombre || null,
      afp_fondo: fondo,
      afp_comision: comision,
      afp_prima: prima,
      base_afecta: baseAfecta,
      tasas_usadas: {
        rmv: t.rmv,
        afp_fondo_pct: t.afp_fondo_pct,
        afp_prima_pct: t.afp_prima_pct,
        onp_pct: t.onp_pct,
        essalud_pct: t.essalud_pct,
      },
    },
  }
}

/* ══════════════════ Plantillas HTML con branding Piola ══════════════════ */

const MARCA = {
  nombre: process.env.PIOLA_RAZON_SOCIAL || 'PIOLA',
  ruc: process.env.PIOLA_RUC || '',
  direccion: process.env.PIOLA_DIRECCION || '',
  color: process.env.PIOLA_COLOR || '#111111',
  acento: process.env.PIOLA_COLOR_ACENTO || '#e2564a',
}

const money = (n: number) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const BASE_CSS = `
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
  .pie{margin-top:26px;font-size:10.5px;opacity:.55;text-align:center;line-height:1.6}
  .firmas{display:flex;gap:60px;margin-top:52px}
  .firma{flex:1;border-top:1px solid #999;padding-top:6px;font-size:11px;text-align:center;opacity:.75}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;padding:0;max-width:none}}
`

function cabecera(titulo: string, periodo: string) {
  return `
  <div class="head">
    <div class="marca">${esc(MARCA.nombre)}
      <small>${MARCA.ruc ? 'RUC ' + esc(MARCA.ruc) : ''}${MARCA.direccion ? ' · ' + esc(MARCA.direccion) : ''}</small>
    </div>
    <div class="tit"><h1>${esc(titulo)}</h1><div class="per">Periodo ${esc(periodo)}</div></div>
  </div>`
}

/** Boleta de pago del colaborador (§7.5). */
export function htmlBoleta(datos: {
  colaborador: any
  periodo: string
  codigo: string
  calc: BoletaCalculada
  generado_por?: string
}): string {
  const c = datos.colaborador || {}
  const k = datos.calc
  const fila = (concepto: string, monto: number) =>
    `<tr><td>${esc(concepto)}</td><td class="n">${money(monto)}</td></tr>`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Boleta ${esc(datos.codigo)}</title><style>${BASE_CSS}</style></head><body>
<div class="doc">
  ${cabecera('Boleta de pago', datos.periodo)}
  <div class="grid">
    <div class="campo"><span>Colaborador</span><strong>${esc(c.nombre)}</strong></div>
    <div class="campo"><span>Código</span><strong>${esc(datos.codigo)}</strong></div>
    <div class="campo"><span>DNI</span><strong>${esc(c.dni || '—')}</strong></div>
    <div class="campo"><span>Cargo</span><strong>${esc(c.cargo || '—')}</strong></div>
    <div class="campo"><span>Fecha de ingreso</span><strong>${esc(String(c.fecha_ingreso || '—').slice(0, 10))}</strong></div>
    <div class="campo"><span>Tipo de contrato</span><strong>${esc(c.tipo_contrato === 'planilla' ? 'Planilla' : 'Recibo por honorarios')}</strong></div>
    <div class="campo"><span>Sistema de pensión</span><strong>${esc(k.detalle.sistema_pension)}${k.detalle.afp_nombre ? ' — ' + esc(k.detalle.afp_nombre) : ''}</strong></div>
    <div class="campo"><span>Días trabajados</span><strong>${k.dias_trabajados}</strong></div>
  </div>

  <table>
    <thead><tr><th>Ingresos</th><th class="n">Monto</th></tr></thead>
    <tbody>
      ${fila('Remuneración básica', k.sueldo_bruto)}
      ${k.asignacion_familiar ? fila('Asignación familiar', k.asignacion_familiar) : ''}
      ${k.otros_ingresos ? fila('Otros ingresos', k.otros_ingresos) : ''}
      <tr><td><strong>Total ingresos</strong></td><td class="n"><strong>${money(k.total_ingresos)}</strong></td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th>Descuentos</th><th class="n">Monto</th></tr></thead>
    <tbody>
      ${k.detalle.afp_fondo ? fila(`Aporte al fondo (${k.detalle.sistema_pension})`, k.detalle.afp_fondo) : ''}
      ${k.detalle.afp_comision ? fila('Comisión AFP', k.detalle.afp_comision) : ''}
      ${k.detalle.afp_prima ? fila('Prima de seguro', k.detalle.afp_prima) : ''}
      ${k.descuento_renta ? fila('Renta de 5.ª categoría', k.descuento_renta) : ''}
      ${k.otros_descuentos ? fila('Otros descuentos', k.otros_descuentos) : ''}
      <tr><td><strong>Total descuentos</strong></td><td class="n"><strong>${money(k.total_descuentos)}</strong></td></tr>
    </tbody>
  </table>

  <div class="tot"><span>Neto a pagar</span><span>${money(k.neto)}</span></div>

  <table style="margin-top:20px">
    <thead><tr><th>Aportes del empleador</th><th class="n">Monto</th></tr></thead>
    <tbody>${fila('EsSalud (9 %)', k.aporte_essalud)}</tbody>
  </table>

  <div class="firmas">
    <div class="firma">${esc(MARCA.nombre)} — Empleador</div>
    <div class="firma">${esc(c.nombre)} — Colaborador</div>
  </div>

  <div class="pie">
    Documento generado automáticamente por el dashboard de ${esc(MARCA.nombre)}${datos.generado_por ? ' · ' + esc(datos.generado_por) : ''}.<br>
    Moneda: soles (PEN). Las tasas de pensión pueden variar por trimestre.
  </div>
</div></body></html>`
}

/** Descargo / reporte AFP del periodo (§7.5). */
export function htmlAfp(datos: {
  periodo: string
  filas: Array<any>
  total_afecto: number
  total_aportes: number
  generado_por?: string
}): string {
  const filas = datos.filas.map((f: any) => `
    <tr>
      <td>${esc(f.colaborador_nombre)}</td>
      <td>${esc(f.dni || '—')}</td>
      <td>${esc(f.afp_nombre || '—')}</td>
      <td>${esc(f.cuspp || '—')}</td>
      <td class="n">${money(f.base_afecta)}</td>
      <td class="n">${money(f.aporte_fondo)}</td>
      <td class="n">${money(f.comision)}</td>
      <td class="n">${money(f.prima)}</td>
      <td class="n"><strong>${money(f.total)}</strong></td>
    </tr>`).join('')

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Descargo AFP ${esc(datos.periodo)}</title><style>${BASE_CSS}
  .doc{max-width:1080px} table{font-size:11.5px}
</style></head><body>
<div class="doc">
  ${cabecera('Descargo AFP', datos.periodo)}
  <table>
    <thead><tr>
      <th>Colaborador</th><th>DNI</th><th>AFP</th><th>CUSPP</th>
      <th class="n">Base afecta</th><th class="n">Fondo</th><th class="n">Comisión</th>
      <th class="n">Prima</th><th class="n">Total</th>
    </tr></thead>
    <tbody>${filas || '<tr><td colspan="9" style="text-align:center;opacity:.6;padding:24px">Sin colaboradores en planilla para este periodo</td></tr>'}</tbody>
  </table>
  <div class="tot"><span>Total a declarar (${datos.filas.length} colaborador(es))</span><span>${money(datos.total_aportes)}</span></div>
  <div class="pie">
    Base afecta acumulada: ${money(datos.total_afecto)}.<br>
    Generado por el dashboard de ${esc(MARCA.nombre)}${datos.generado_por ? ' · ' + esc(datos.generado_por) : ''}.
    Verificar contra el portal de cada AFP antes de declarar.
  </div>
</div></body></html>`
}

/** Sube un documento HTML al bucket `piola-docs` y devuelve su URL pública. */
export async function subirDocumento(
  supabase: any, ruta: string, html: string
): Promise<string | null> {
  try {
    const { error } = await supabase.storage.from('piola-docs')
      .upload(ruta, new Blob([html], { type: 'text/html; charset=utf-8' }), {
        contentType: 'text/html; charset=utf-8', upsert: true,
      })
    if (error) {
      console.error('[piola/docs] error subiendo', ruta, error.message)
      return null
    }
    const { data } = supabase.storage.from('piola-docs').getPublicUrl(ruta)
    return data?.publicUrl || null
  } catch (e: any) {
    console.error('[piola/docs] excepción subiendo', ruta, e?.message)
    return null
  }
}
