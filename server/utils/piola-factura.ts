/**
 * PIOLA — Plantilla del comprobante con branding propio (§5)
 *
 * Genera el HTML de la factura/boleta: logo y colores de Piola, datos fiscales,
 * ítems, totales y el bloque de DETRACCIÓN (que va en el ~98 % de sus facturas).
 * Se sube al bucket `piola-docs` y se abre/imprime a PDF desde el navegador.
 *
 * Branding configurable por env (sin tocar código):
 *   PIOLA_RAZON_SOCIAL · PIOLA_RUC · PIOLA_DIRECCION · PIOLA_LOGO_URL
 *   PIOLA_COLOR · PIOLA_COLOR_ACENTO · PIOLA_CUENTA_DETRACCION
 */

const MARCA = {
  nombre: process.env.PIOLA_RAZON_SOCIAL || 'PIOLA',
  ruc: process.env.PIOLA_RUC || '',
  direccion: process.env.PIOLA_DIRECCION || '',
  logo: process.env.PIOLA_LOGO_URL || '',
  color: process.env.PIOLA_COLOR || '#111111',
  acento: process.env.PIOLA_COLOR_ACENTO || '#e2564a',
  cuentaDetraccion: process.env.PIOLA_CUENTA_DETRACCION || '',
}

const money = (n: any) =>
  `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const NOMBRE_TIPO: Record<number, string> = { 1: 'FACTURA ELECTRÓNICA', 2: 'BOLETA DE VENTA ELECTRÓNICA' }

export function htmlFactura(inv: any): string {
  const cliente = inv.cliente || {}
  const items = Array.isArray(inv.items) ? inv.items : []

  const filas = items.map((it: any, i: number) => {
    const cant = Number(it.cantidad || 1)
    const vu = Number(it.valor_unitario || 0)
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(it.descripcion)}</td>
      <td class="n">${cant}</td>
      <td class="n">${money(vu)}</td>
      <td class="n">${money(cant * vu)}</td>
    </tr>`
  }).join('')

  const bloqueDetraccion = inv.con_detraccion ? `
    <div class="detr">
      <div class="detr-tit">Operación sujeta a detracción del ${esc(inv.detraccion_pct)} %</div>
      <div class="detr-grid">
        <div><span>Monto de la detracción</span><strong>${money(inv.detraccion_monto)}</strong></div>
        <div><span>Neto a pagar al proveedor</span><strong>${money(inv.neto_a_pagar)}</strong></div>
        ${inv.detraccion_codigo ? `<div><span>Código de bien/servicio</span><strong>${esc(inv.detraccion_codigo)}</strong></div>` : ''}
        ${MARCA.cuentaDetraccion ? `<div><span>Cuenta de detracciones (BN)</span><strong>${esc(MARCA.cuentaDetraccion)}</strong></div>` : ''}
      </div>
      <p class="detr-nota">El adquirente debe depositar el monto de la detracción en la cuenta del Banco de la Nación antes de pagar el saldo.</p>
    </div>` : ''

  const estadoChip = inv.estado === 'borrador'
    ? '<div class="chip-borrador">BORRADOR — no enviado a SUNAT</div>' : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(inv.serie)}-${esc(inv.numero)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;
    margin:0;padding:32px;background:#f5f5f5}
  .doc{max-width:840px;margin:0 auto;background:#fff;padding:38px 42px;border-radius:10px;
    box-shadow:0 2px 14px rgba(0,0,0,.08)}
  .head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:26px}
  .marca{font-size:28px;font-weight:800;letter-spacing:-.6px;color:${MARCA.color}}
  .marca img{max-height:54px;display:block;margin-bottom:6px}
  .marca small{display:block;font-size:11.5px;font-weight:500;opacity:.65;margin-top:4px;line-height:1.5}
  .caja{border:2px solid ${MARCA.acento};border-radius:8px;padding:12px 20px;text-align:center;min-width:250px}
  .caja .t{font-size:11.5px;font-weight:700;letter-spacing:.6px;color:${MARCA.acento}}
  .caja .ruc{font-size:12px;opacity:.7;margin:4px 0}
  .caja .num{font-size:19px;font-weight:800;letter-spacing:1px}
  .chip-borrador{background:#fff3cd;color:#8a6d00;border:1px solid #f0d68a;border-radius:6px;
    padding:8px 12px;font-size:12px;font-weight:600;text-align:center;margin-bottom:18px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 26px;margin-bottom:24px}
  .campo{font-size:12.5px;display:flex;justify-content:space-between;gap:12px;
    border-bottom:1px dotted #ddd;padding:5px 0}
  .campo span{opacity:.6;white-space:nowrap} .campo strong{font-weight:600;text-align:right}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px}
  th{text-align:left;background:#fafafa;padding:9px 10px;font-size:11px;text-transform:uppercase;
    letter-spacing:.5px;opacity:.7;border-bottom:1px solid #e5e5e5}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
  td.n,th.n{text-align:right}
  .totales{margin-left:auto;width:290px;font-size:13px}
  .totales div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0}
  .totales .final{background:${MARCA.color};color:#fff;border-radius:8px;padding:12px 16px;
    font-size:16px;font-weight:700;border:none;margin-top:8px}
  .detr{margin-top:24px;border:1px solid ${MARCA.acento}40;background:${MARCA.acento}0d;
    border-radius:8px;padding:16px 18px}
  .detr-tit{font-weight:700;font-size:13px;color:${MARCA.acento};margin-bottom:10px}
  .detr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;font-size:12.5px}
  .detr-grid div{display:flex;justify-content:space-between;border-bottom:1px dotted #ccc;padding:4px 0}
  .detr-grid span{opacity:.65}
  .detr-nota{font-size:11px;opacity:.6;margin:12px 0 0;line-height:1.5}
  .pie{margin-top:28px;font-size:10.5px;opacity:.55;text-align:center;line-height:1.6}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;padding:0;max-width:none}}
</style></head><body>
<div class="doc">
  ${estadoChip}
  <div class="head">
    <div class="marca">
      ${MARCA.logo ? `<img src="${esc(MARCA.logo)}" alt="${esc(MARCA.nombre)}">` : esc(MARCA.nombre)}
      <small>${MARCA.ruc ? 'RUC ' + esc(MARCA.ruc) + '<br>' : ''}${esc(MARCA.direccion)}</small>
    </div>
    <div class="caja">
      <div class="t">${esc(NOMBRE_TIPO[Number(inv.tipo_comprobante)] || 'COMPROBANTE')}</div>
      ${MARCA.ruc ? `<div class="ruc">RUC ${esc(MARCA.ruc)}</div>` : ''}
      <div class="num">${esc(inv.serie)} - ${esc(inv.numero)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="campo"><span>Cliente</span><strong>${esc(inv.cliente_nombre || cliente.nombre)}</strong></div>
    <div class="campo"><span>Fecha de emisión</span><strong>${esc(String(inv.fecha_emision || '').slice(0, 10))}</strong></div>
    <div class="campo"><span>RUC / DNI</span><strong>${esc(inv.cliente_ruc || cliente.ruc || cliente.dni || '—')}</strong></div>
    <div class="campo"><span>Fecha de vencimiento</span><strong>${esc(String(inv.fecha_vencimiento || '—').slice(0, 10))}</strong></div>
    <div class="campo"><span>Dirección</span><strong>${esc(cliente.direccion || '—')}</strong></div>
    <div class="campo"><span>Moneda</span><strong>Soles (PEN)</strong></div>
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Descripción</th><th class="n">Cant.</th>
      <th class="n">V. unitario</th><th class="n">Importe</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="totales">
    <div><span>Op. gravada</span><span>${money(inv.subtotal)}</span></div>
    <div><span>IGV (18 %)</span><span>${money(inv.igv)}</span></div>
    <div class="final"><span>Total</span><span>${money(inv.total)}</span></div>
  </div>

  ${bloqueDetraccion}

  ${inv.notas ? `<p style="font-size:12px;opacity:.7;margin-top:20px"><strong>Observaciones:</strong> ${esc(inv.notas)}</p>` : ''}

  <div class="pie">
    Representación impresa del comprobante electrónico de ${esc(MARCA.nombre)}.<br>
    ${inv.estado === 'borrador'
      ? 'Documento en borrador: aún no ha sido declarado a SUNAT.'
      : 'Consulte su validez en el portal de SUNAT.'}
  </div>
</div></body></html>`
}
