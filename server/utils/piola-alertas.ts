/**
 * PIOLA — Motor de alertas (§4)
 *
 * Recorre lo que vence pronto y arma un aviso por cada cosa. Los días de
 * anticipación NO están hardcodeados en 7: salen de `piola_alert_settings`,
 * que se edita desde Configuración (7 es solo el valor sembrado).
 *
 * Tipos:
 *   factura_por_vencer     facturas emitidas/enviadas con vencimiento cercano
 *   factura_por_emitir     entregables aprobados de un cliente sin factura del periodo
 *   contrato_por_renovar   colaboradores con fecha_fin_contrato cercana
 *   lead_sin_seguimiento   leads abiertos sin interacción en N días
 *   entregable_por_vencer  entregables con fecha de compromiso cerca y sin entregar
 *   comision_por_pagar          comisiones pendientes cuya fecha de pago (15) se acerca
 *   cuenta_cobrar_vencida       piola_transactions ingreso, sin pagar, vencimiento cerca o pasado
 *   cuenta_pagar_vencida        piola_transactions egreso, sin pagar, vencimiento cerca o pasado
 *   contrato_cliente_por_vencer piola_contratos con fecha_cierre cercana (marca/cliente, NO
 *                               laboral — ese es "contrato_por_renovar", tabla distinta)
 *
 * Cada alerta es única por (tipo, tabla, id, fecha_objetivo): correr el motor
 * dos veces el mismo día no duplica avisos ni re-envía WhatsApps.
 */
import { hoyLima, sumarDias, diasEntre, enviarWhatsappPiola } from './piola'

const money = (n: any) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

export interface AlertaGenerada {
  tipo: string
  related_table: string
  related_id: number
  titulo: string
  mensaje: string
  fecha_objetivo: string
  dias_antes: number
  canal: string
  destinatarios: string[]
}

export async function generarAlertas(supabase: any, hoy = hoyLima()): Promise<AlertaGenerada[]> {
  const { data: configs } = await supabase
    .from('piola_alert_settings').select('*').eq('activo', true)

  const cfg = (tipo: string) => (configs || []).find((c: any) => c.tipo === tipo)
  const alertas: AlertaGenerada[] = []

  const base = (c: any, extra: Partial<AlertaGenerada>): AlertaGenerada => ({
    tipo: c.tipo,
    dias_antes: c.dias_antes,
    canal: c.canal,
    destinatarios: c.destinatarios || [],
    related_table: '', related_id: 0, titulo: '', mensaje: '', fecha_objetivo: hoy,
    ...extra,
  })

  /* ── Facturas próximas a vencer ── */
  const cFac = cfg('factura_por_vencer')
  if (cFac) {
    const limite = sumarDias(hoy, cFac.dias_antes)
    const { data: facturas } = await supabase.from('piola_invoices')
      .select('id, serie, numero, cliente_nombre, total, neto_a_pagar, con_detraccion, fecha_vencimiento, estado')
      .in('estado', ['emitida', 'enviada'])
      .not('fecha_vencimiento', 'is', null)
      .gte('fecha_vencimiento', hoy).lte('fecha_vencimiento', limite)

    for (const f of facturas || []) {
      const dias = diasEntre(hoy, String(f.fecha_vencimiento).slice(0, 10))
      alertas.push(base(cFac, {
        related_table: 'piola_invoices', related_id: f.id,
        fecha_objetivo: String(f.fecha_vencimiento).slice(0, 10),
        titulo: `Factura ${f.serie}-${f.numero} vence en ${dias} día(s)`,
        mensaje: `📄 *Factura por vencer*\n${f.serie}-${f.numero} — ${f.cliente_nombre || 'cliente'}\n`
          + `Monto: ${money(f.con_detraccion ? f.neto_a_pagar : f.total)}\n`
          + `Vence: ${String(f.fecha_vencimiento).slice(0, 10)} (en ${dias} día(s))`,
      }))
    }
  }

  /* ── Facturas por emitir: entregables aprobados sin factura del periodo ── */
  const cEmi = cfg('factura_por_emitir')
  if (cEmi) {
    const periodo = hoy.slice(0, 7)
    const { data: entregables } = await supabase.from('piola_deliverables')
      .select('cliente_id, periodo, estado, cliente:piola_clientes(id, nombre)')
      .eq('periodo', periodo).in('estado', ['aprobado', 'entregado'])

    const clientesConEntrega = new Set((entregables || []).map((e: any) => e.cliente_id).filter(Boolean))
    if (clientesConEntrega.size) {
      const { data: facturas } = await supabase.from('piola_invoices')
        .select('cliente_id').gte('fecha_emision', `${periodo}-01`).neq('estado', 'anulada')
      const facturados = new Set((facturas || []).map((f: any) => f.cliente_id))

      for (const clienteId of clientesConEntrega) {
        if (facturados.has(clienteId)) continue
        const nombre = (entregables || []).find((e: any) => e.cliente_id === clienteId)?.cliente?.nombre || `cliente #${clienteId}`
        alertas.push(base(cEmi, {
          related_table: 'piola_clientes', related_id: Number(clienteId),
          fecha_objetivo: hoy,
          titulo: `Falta facturar a ${nombre} (${periodo})`,
          mensaje: `🧾 *Factura por emitir*\n${nombre} ya tiene entregables aprobados de ${periodo} y todavía no se le factura.`,
        }))
      }
    }
  }

  /* ── Contratos por renovar ── */
  const cCon = cfg('contrato_por_renovar')
  if (cCon) {
    const limite = sumarDias(hoy, cCon.dias_antes)
    const { data: colaboradores } = await supabase.from('piola_colaboradores')
      .select('id, nombre, email, cargo, fecha_fin_contrato, tipo_contrato')
      .eq('activo', true)
      .not('fecha_fin_contrato', 'is', null)
      .gte('fecha_fin_contrato', hoy).lte('fecha_fin_contrato', limite)

    for (const c of colaboradores || []) {
      const dias = diasEntre(hoy, String(c.fecha_fin_contrato).slice(0, 10))
      alertas.push(base(cCon, {
        related_table: 'piola_colaboradores', related_id: c.id,
        fecha_objetivo: String(c.fecha_fin_contrato).slice(0, 10),
        titulo: `Contrato de ${c.nombre} vence en ${dias} día(s)`,
        mensaje: `👤 *Contrato por renovar*\n${c.nombre}${c.cargo ? ' — ' + c.cargo : ''}\n`
          + `Vence: ${String(c.fecha_fin_contrato).slice(0, 10)} (en ${dias} día(s))`,
      }))
    }
  }

  /* ── Leads sin seguimiento ── */
  const cLead = cfg('lead_sin_seguimiento')
  if (cLead) {
    const corte = sumarDias(hoy, -cLead.dias_antes)
    const { data: stagesCerrados } = await supabase
      .from('piola_lead_stages').select('id').or('es_ganado.eq.true,es_perdido.eq.true')
    const cerrados = (stagesCerrados || []).map((s: any) => s.id)

    const { data: leads } = await supabase.from('piola_leads')
      .select('id, nombre, telefono, owner_email, ultima_interaccion, fecha_ingreso, stage_id, resultado')
      .is('resultado', null)

    for (const l of leads || []) {
      if (cerrados.includes(l.stage_id)) continue
      const ultima = String(l.ultima_interaccion || l.fecha_ingreso || '').slice(0, 10)
      if (!ultima || ultima > corte) continue
      alertas.push(base(cLead, {
        related_table: 'piola_leads', related_id: l.id,
        fecha_objetivo: hoy,
        titulo: `${l.nombre} sin seguimiento desde ${ultima}`,
        mensaje: `🔥 *Lead sin seguimiento*\n${l.nombre}${l.telefono ? ' — ' + l.telefono : ''}\n`
          + `Última interacción: ${ultima}\nResponsable: ${l.owner_email || 'sin asignar'}`,
      }))
    }
  }

  /* ── Entregables por vencer ── */
  const cEnt = cfg('entregable_por_vencer')
  if (cEnt) {
    const limite = sumarDias(hoy, cEnt.dias_antes)
    const { data: entregables } = await supabase.from('piola_deliverables')
      .select('id, titulo, fecha_compromiso, estado, responsable_email, cliente:piola_clientes(nombre)')
      .in('estado', ['en_produccion', 'en_revision'])
      .not('fecha_compromiso', 'is', null)
      .gte('fecha_compromiso', hoy).lte('fecha_compromiso', limite)

    for (const e of entregables || []) {
      const dias = diasEntre(hoy, String(e.fecha_compromiso).slice(0, 10))
      alertas.push(base(cEnt, {
        related_table: 'piola_deliverables', related_id: e.id,
        fecha_objetivo: String(e.fecha_compromiso).slice(0, 10),
        titulo: `"${e.titulo}" vence en ${dias} día(s)`,
        mensaje: `🎬 *Entregable por vencer*\n${e.titulo} — ${(e as any).cliente?.nombre || 'sin cliente'}\n`
          + `Compromiso: ${String(e.fecha_compromiso).slice(0, 10)} (en ${dias} día(s))\n`
          + `Estado: ${e.estado} · Responsable: ${e.responsable_email || 'sin asignar'}`,
      }))
    }
  }

  /* ── Comisiones por pagar ── */
  const cCom = cfg('comision_por_pagar')
  if (cCom) {
    const limite = sumarDias(hoy, cCom.dias_antes)
    const { data: comisiones } = await supabase.from('piola_commissions')
      .select('id, colaborador_email, periodo, monto, fecha_pago, estado')
      .in('estado', ['pendiente', 'aprobada'])
      .not('fecha_pago', 'is', null)
      .gte('fecha_pago', hoy).lte('fecha_pago', limite)

    for (const c of comisiones || []) {
      alertas.push(base(cCom, {
        related_table: 'piola_commissions', related_id: c.id,
        fecha_objetivo: String(c.fecha_pago).slice(0, 10),
        titulo: `Comisión de ${c.colaborador_email} (${c.periodo})`,
        mensaje: `💰 *Comisión por pagar*\n${c.colaborador_email} — periodo ${c.periodo}\n`
          + `Monto: ${money(c.monto)}\nFecha de pago: ${String(c.fecha_pago).slice(0, 10)}`,
      }))
    }
  }

  /* ── Cuentas por cobrar / pagar vencidas o cerca de vencer ──
   * `.lte(limite)` sin piso: a diferencia de las demás alertas (que sólo
   * miran hacia adelante), acá interesa tanto lo próximo a vencer como lo YA
   * vencido — el pedido explícito de Piola fue "generar alertas de
   * vencimiento" para cuentas por cobrar, y una cuenta vencida sigue
   * necesitando el aviso hasta que se pague o se anule. */
  for (const [tipoAlerta, tipoTx, etiqueta] of [
    ['cuenta_cobrar_vencida', 'ingreso', 'Cuenta por cobrar'],
    ['cuenta_pagar_vencida', 'egreso', 'Cuenta por pagar'],
  ] as const) {
    const c = cfg(tipoAlerta)
    if (!c) continue
    const limite = sumarDias(hoy, c.dias_antes)

    const { data: cuentas } = await supabase.from('piola_transactions')
      .select('id, concepto, monto, monto_pagado, fecha_vencimiento, estado')
      .eq('tipo', tipoTx)
      .in('estado', ['pendiente', 'parcial', 'vencido'])
      .not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', limite)

    for (const t of cuentas || []) {
      const venc = String(t.fecha_vencimiento).slice(0, 10)
      const dias = diasEntre(hoy, venc)
      const saldo = Number(t.monto || 0) - Number(t.monto_pagado || 0)
      alertas.push(base(c, {
        related_table: 'piola_transactions', related_id: t.id,
        fecha_objetivo: venc,
        titulo: `${etiqueta}: ${t.concepto} — ${dias < 0 ? `vencida hace ${-dias} día(s)` : `vence en ${dias} día(s)`}`,
        mensaje: `${tipoTx === 'ingreso' ? '💵' : '📤'} *${etiqueta}*\n${t.concepto}\n`
          + `Saldo: ${money(saldo)}\nVencimiento: ${venc}`
          + (dias < 0 ? ` (vencida hace ${-dias} día(s))` : ` (en ${dias} día(s))`),
      }))
    }
  }

  /* ── Contratos de marca/cliente por renovar ──
   * Distinto de "contrato_por_renovar" (colaboradores). Un contrato sin
   * pago_mensual es un proyecto puntual: no tiene sentido avisar de su
   * "renovación" porque no es recurrente. */
  const cConCliente = cfg('contrato_cliente_por_vencer')
  if (cConCliente) {
    const limite = sumarDias(hoy, cConCliente.dias_antes)
    const { data: contratos } = await supabase.from('piola_contratos')
      .select('id, nombre_cliente, fecha_cierre, pago_mensual')
      .not('fecha_cierre', 'is', null)
      .not('pago_mensual', 'is', null)
      .gte('fecha_cierre', hoy).lte('fecha_cierre', limite)

    for (const c2 of contratos || []) {
      const venc = String(c2.fecha_cierre).slice(0, 10)
      const dias = diasEntre(hoy, venc)
      alertas.push(base(cConCliente, {
        related_table: 'piola_contratos', related_id: c2.id,
        fecha_objetivo: venc,
        titulo: `Contrato de ${c2.nombre_cliente} por renovar (${dias} día(s))`,
        mensaje: `📄 *Contrato por renovar*\n${c2.nombre_cliente}\n`
          + `Cuota: ${money(c2.pago_mensual)}/mes\nVence: ${venc} (en ${dias} día(s))`,
      }))
    }
  }

  return alertas
}

/**
 * Guarda las alertas nuevas (ignora las ya registradas) y las envía por WhatsApp.
 * Devuelve el detalle para el log del cron y el panel de la UI.
 */
export async function persistirYEnviar(supabase: any, alertas: AlertaGenerada[]) {
  const nuevas: any[] = []
  const yaExistian: any[] = []

  for (const a of alertas) {
    const { data: previa } = await supabase.from('piola_alerts').select('id, estado')
      .eq('tipo', a.tipo).eq('related_table', a.related_table)
      .eq('related_id', a.related_id).eq('fecha_objetivo', a.fecha_objetivo).maybeSingle()

    if (previa) { yaExistian.push(previa.id); continue }

    const { data, error } = await supabase.from('piola_alerts')
      .insert({ ...a, estado: 'pendiente' }).select('*').single()
    if (!error && data) nuevas.push(data)
  }

  let enviadas = 0
  let errores = 0

  if (nuevas.length) {
    const envio = await enviarWhatsappPiola({
      evento: 'piola.alertas',
      empresa: 'Piola',
      fecha: hoyLima(),
      total: nuevas.length,
      mensaje_whatsapp: nuevas.map(a => a.mensaje).join('\n\n──────────\n\n'),
      alertas: nuevas,
    })

    const patch = envio.ok
      ? { estado: 'enviada', enviado_at: new Date().toISOString(), respuesta: envio.respuesta ?? null }
      : { estado: 'error', error_message: envio.error || `HTTP ${envio.status}` }

    await supabase.from('piola_alerts').update(patch).in('id', nuevas.map(a => a.id))
    if (envio.ok) enviadas = nuevas.length
    else errores = nuevas.length
  }

  return {
    generadas: alertas.length,
    nuevas: nuevas.length,
    repetidas: yaExistian.length,
    enviadas,
    errores,
    alertas: nuevas,
  }
}

/* ══════════════════ Alertas inmediatas (reunión 31/08/2026) ══════════════════ */

/**
 * Avisa por WhatsApp en el momento en que algo pasa, sin esperar al cron.
 *
 * Todo lo de arriba es PREVENTIVO ("esto vence en N días") y lo genera el cron
 * una vez al día. Edson pidió lo contrario: enterarse en el acto de cada
 * movimiento y de cada cobro ("cada vez que hay un movimiento… ahí les llega la
 * notificación"), así que estas las dispara el endpoint que hizo el registro.
 *
 * `fecha_objetivo` va en NULL a propósito. El UNIQUE de `piola_alerts` es
 * (tipo, related_table, related_id, fecha_objetivo) y en Postgres dos NULL no
 * chocan entre sí; con una fecha real, registrar dos pagos el mismo día contra
 * la misma cuenta haría que el segundo aviso no se guardara nunca.
 *
 * NUNCA lanza ni propaga un error: el aviso es un extra sobre el registro que
 * lo disparó. Si el webhook está caído o `N8N_WEBHOOK_PIOLA_ALERTAS` no existe,
 * el movimiento ya quedó guardado — y eso es lo que no se puede perder.
 */
export async function dispararAlertaInmediata(
  supabase: any,
  opts: {
    tipo: 'movimiento_registrado' | 'cobro_registrado' | (string & {})
    titulo: string
    mensaje: string
    related_table?: string | null
    related_id?: number | null
  },
): Promise<{ ok: boolean; motivo?: string; alerta_id?: number }> {
  try {
    const { data: cfg } = await supabase
      .from('piola_alert_settings').select('*').eq('tipo', opts.tipo).maybeSingle()

    if (!cfg) return { ok: false, motivo: `La alerta '${opts.tipo}' no está configurada` }
    if (!cfg.activo) return { ok: false, motivo: 'La alerta está desactivada' }

    // Sin destinatarios no hay a quién avisar: guardar la fila sólo llenaría el
    // historial de avisos que nunca salieron de la base.
    const destinatarios: string[] = Array.isArray(cfg.destinatarios)
      ? cfg.destinatarios.map((d: any) => String(d).trim()).filter(Boolean)
      : []
    if (!destinatarios.length) return { ok: false, motivo: 'La alerta no tiene destinatarios' }

    const { data: alerta, error } = await supabase.from('piola_alerts').insert({
      tipo: opts.tipo,
      related_table: opts.related_table ?? null,
      related_id: opts.related_id ?? null,
      titulo: opts.titulo,
      mensaje: opts.mensaje,
      fecha_objetivo: null,
      dias_antes: 0,
      canal: cfg.canal,
      destinatarios,
      estado: 'pendiente',
      inmediata: true,
    }).select('id').single()

    if (error || !alerta) {
      console.error('[piola/alertas] no se pudo guardar la alerta inmediata:', error?.message)
      return { ok: false, motivo: error?.message || 'no se pudo guardar la alerta' }
    }

    // El canal se manda al webhook pero el envío es siempre por WhatsApp, igual
    // que en `persistirYEnviar`: n8n es quien decide qué hacer con 'correo'.
    const envio = await enviarWhatsappPiola({
      evento: 'piola.alerta_inmediata',
      empresa: 'Piola',
      fecha: hoyLima(),
      tipo: opts.tipo,
      titulo: opts.titulo,
      canal: cfg.canal,
      destinatarios,
      mensaje_whatsapp: opts.mensaje,
      alerta: { id: alerta.id, ...opts },
    })

    await supabase.from('piola_alerts').update(
      envio.ok
        ? { estado: 'enviada', enviado_at: new Date().toISOString(), respuesta: envio.respuesta ?? null }
        : { estado: 'error', error_message: envio.error || `HTTP ${envio.status}` },
    ).eq('id', alerta.id)

    return envio.ok
      ? { ok: true, alerta_id: alerta.id }
      : { ok: false, alerta_id: alerta.id, motivo: envio.error || `HTTP ${envio.status}` }
  } catch (e: any) {
    console.error('[piola/alertas] excepción en la alerta inmediata:', e?.message)
    return { ok: false, motivo: e?.message || 'error inesperado' }
  }
}
