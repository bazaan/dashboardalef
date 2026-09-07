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
 *   comision_por_pagar     comisiones pendientes cuya fecha de pago (15) se acerca
 *   factura_programada     recurrentes de contrato que toca emitir
 *   contrato_cliente_por_vencer  contratos de cliente cerca de su fecha de cierre
 *
 * Los dos tipos EVENTUALES (movimiento_financiero, registro_sistema) no se
 * generan acá: no miran el futuro sino el presente, y los dispara el endpoint
 * que hace el registro. Ver notificarEvento() al final de este archivo.
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

  /* ── Facturas recurrentes programadas que toca emitir ── */
  const cProg = cfg('factura_programada')
  if (cProg) {
    const limite = sumarDias(hoy, cProg.dias_antes)
    const { data: programadas } = await supabase.from('piola_facturas_programadas')
      .select('id, periodo, fecha_programada, concepto, monto, contrato:piola_contratos(nombre_cliente)')
      .eq('estado', 'pendiente')
      .lte('fecha_programada', limite)

    for (const p of programadas || []) {
      const fecha = String(p.fecha_programada).slice(0, 10)
      const dias = diasEntre(hoy, fecha)
      alertas.push(base(cProg, {
        related_table: 'piola_facturas_programadas', related_id: p.id,
        fecha_objetivo: fecha,
        titulo: `Facturar a ${(p as any).contrato?.nombre_cliente || 'cliente'} (${p.periodo})`,
        mensaje: `🔁 *Factura recurrente por emitir*\n`
          + `${(p as any).contrato?.nombre_cliente || 'Cliente'} — periodo ${p.periodo}\n`
          + `${p.concepto || 'Servicios del contrato'}\n`
          + `Monto: ${money(p.monto)}\n`
          + (dias < 0 ? `Debía emitirse el ${fecha} (hace ${Math.abs(dias)} día(s))`
                      : `Programada para el ${fecha} (en ${dias} día(s))`),
      }))
    }
  }

  /* ── Contratos de CLIENTE por vencer (los de colaborador van arriba) ── */
  const cConCli = cfg('contrato_cliente_por_vencer')
  if (cConCli) {
    const limite = sumarDias(hoy, cConCli.dias_antes)
    const { data: contratos } = await supabase.from('piola_contratos')
      .select('id, nombre_cliente, fecha_cierre, monto_periodico, renovacion_automatica, estado')
      .eq('estado', 'vigente')
      .not('fecha_cierre', 'is', null)
      .gte('fecha_cierre', hoy).lte('fecha_cierre', limite)

    for (const c of contratos || []) {
      const fecha = String(c.fecha_cierre).slice(0, 10)
      const dias = diasEntre(hoy, fecha)
      alertas.push(base(cConCli, {
        related_table: 'piola_contratos', related_id: c.id,
        fecha_objetivo: fecha,
        titulo: `Contrato de ${c.nombre_cliente} vence en ${dias} día(s)`,
        mensaje: `📑 *Contrato de cliente por vencer*\n${c.nombre_cliente}\n`
          + `Vence: ${fecha} (en ${dias} día(s))\n`
          + (c.renovacion_automatica
              ? 'Tiene renovación automática marcada: confirmar condiciones.'
              : 'Sin renovación automática: si sigue, hay que firmar adenda o contrato nuevo.'),
      }))
    }
  }

  return alertas
}

/* ══════════════════ Avisos por evento (setiembre) ══════════════════ */

/** Eventos que puede avisar el sistema, agrupados por el tipo que los configura. */
export const EVENTOS_MOVIMIENTO = [
  'movimiento_creado', 'movimiento_editado', 'movimiento_eliminado',
  'pago_registrado', 'factura_emitida', 'factura_pagada', 'factura_anulada',
  'caja_abierta', 'caja_cerrada', 'importacion',
] as const

export const EVENTOS_REGISTRO = [
  'cliente_creado', 'contrato_creado', 'contrato_vencido',
  'entregable_creado', 'entregable_aprobado', 'colaborador_creado',
  'recibo_honorarios_generado',
] as const

export interface EventoPiola {
  /** Uno de EVENTOS_MOVIMIENTO o EVENTOS_REGISTRO */
  evento: string
  titulo: string
  mensaje: string
  related_table?: string
  related_id?: number
  /** Para el filtro `monto_minimo`: sin monto, el aviso siempre pasa. */
  monto?: number
  actor?: string
}

/**
 * Avisa por WhatsApp que algo se registró — un movimiento, un pago, un cliente.
 *
 * A diferencia del cron, esto corre DENTRO del request que hizo el registro, así
 * que:
 *   • NUNCA lanza. Un webhook caído no puede tumbar el alta que ya se guardó:
 *     el movimiento existe, el aviso es lo secundario.
 *   • No deduplica por (tipo, tabla, id, fecha) como el cron: dos movimientos
 *     distintos del mismo día son dos avisos distintos. Por eso el registro va
 *     con related_id propio y fecha_objetivo = hoy solo como referencia.
 *
 * ⚠️ Meta solo entrega mensajes de PLANTILLA fuera de la ventana de 24 h. Estos
 * avisos son, por definición, no solicitados: el flujo de n8n que los recibe
 * tiene que mandarlos como plantilla aprobada o se pierden en silencio.
 */
export async function notificarEvento(supabase: any, ev: EventoPiola): Promise<void> {
  try {
    const esMovimiento = (EVENTOS_MOVIMIENTO as readonly string[]).includes(ev.evento)
    const tipo = esMovimiento ? 'movimiento_financiero' : 'registro_sistema'

    const { data: cfg } = await supabase.from('piola_alert_settings')
      .select('*').eq('tipo', tipo).eq('activo', true).maybeSingle()
    if (!cfg) return

    const eventos: string[] = cfg.eventos || []
    if (eventos.length && !eventos.includes(ev.evento)) return
    // El filtro por monto solo aplica a lo que tiene monto
    if (ev.monto !== undefined && Number(cfg.monto_minimo || 0) > Math.abs(Number(ev.monto || 0))) return

    const fila = {
      tipo,
      related_table: ev.related_table || null,
      related_id: ev.related_id ?? null,
      titulo: ev.titulo,
      mensaje: ev.mensaje + (ev.actor ? `\nRegistrado por: ${ev.actor}` : ''),
      fecha_objetivo: hoyLima(),
      dias_antes: 0,
      canal: cfg.canal,
      destinatarios: cfg.destinatarios || [],
      estado: 'pendiente',
    }

    const { data: alerta } = await supabase.from('piola_alerts').insert(fila).select('*').single()

    const envio = await enviarWhatsappPiola({
      evento: `piola.${ev.evento}`,
      empresa: 'Piola',
      fecha: hoyLima(),
      total: 1,
      mensaje_whatsapp: fila.mensaje,
      alertas: alerta ? [alerta] : [fila],
    })

    if (alerta) {
      await supabase.from('piola_alerts').update(
        envio.ok
          ? { estado: 'enviada', enviado_at: new Date().toISOString(), respuesta: envio.respuesta ?? null }
          : { estado: 'error', error_message: envio.error || `HTTP ${envio.status}` }
      ).eq('id', alerta.id)
    }
  } catch (e: any) {
    // El aviso es accesorio: si falla, se pierde el aviso, no la operación.
    console.error('[piola/notificarEvento]', ev.evento, e?.message || e)
  }
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
