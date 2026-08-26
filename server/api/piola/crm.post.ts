/**
 * POST /api/piola/crm — leads, interacciones y conversión a cliente (§3)
 *
 * Body:
 *   { accion: 'guardar_lead', id?, nombre, stage_id, ... }
 *   { accion: 'mover_lead', id, stage_id }
 *   { accion: 'eliminar_lead', id }
 *   { accion: 'registrar_actividad', lead_id, canal, nota, proxima_accion? }
 *   { accion: 'convertir_cliente', lead_id }
 *
 * EL RESULTADO DEL LEAD LO DERIVA EL SERVIDOR de la etapa, leyendo
 * `es_ganado` / `es_perdido` de `piola_lead_stages`. El cliente mandaba
 * `resultado` y `fecha_cierre` ya calculados, así que se podía marcar un lead
 * como ganado sin moverlo a una etapa ganadora — y el embudo, que es lo que
 * mide si el CRM sirve, quedaba contando cierres que nunca pasaron.
 *
 * Las operaciones encadenadas también se movieron acá, porque desde el
 * navegador se cortaban a la mitad:
 *
 *   • Mover un lead escribe además su nota de historial. Si la segunda
 *     escritura fallaba, el lead cambiaba de etapa sin rastro de quién lo movió.
 *   • Registrar una interacción actualiza `ultima_interaccion`, que es lo que
 *     mira el cron de alertas para avisar de leads abandonados.
 *   • Convertir en cliente crea la ficha y marca el lead. A medias dejaba un
 *     cliente huérfano o un lead ganado sin cliente.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno } from '../../utils/piola'

const CAMPOS_TEXTO = ['email', 'empresa', 'fuente', 'owner_email', 'notas', 'proxima_accion']

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}

/** Resultado y fecha de cierre según la etapa, leída de la base. */
async function resultadoDeEtapa(supabase: any, stageId: number, fechaCierreActual?: any) {
  const { data: etapa } = await supabase.from('piola_lead_stages')
    .select('id, nombre, es_ganado, es_perdido').eq('id', stageId).maybeSingle()
  if (!etapa) throw createError({ statusCode: 400, statusMessage: 'La etapa no existe' })

  if (etapa.es_ganado) {
    return { etapa, resultado: 'ganado', fecha_cierre: fechaCierreActual || new Date().toISOString() }
  }
  if (etapa.es_perdido) {
    return { etapa, resultado: 'perdido', fecha_cierre: fechaCierreActual || new Date().toISOString() }
  }
  // Volver a una etapa intermedia reabre el lead: el cierre deja de existir
  return { etapa, resultado: null, fecha_cierre: null }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Alta o edición de un lead ══════════ */
  if (accion === 'guardar_lead') {
    const id = Number(body?.id) || null
    exigirModulo(perfil, 'crm', id ? 'edit' : 'create')

    const nombre = texto(body?.nombre)
    if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El lead necesita un nombre' })

    const stageId = Number(body?.stage_id)
    if (!stageId) throw createError({ statusCode: 400, statusMessage: 'El lead necesita una etapa' })

    const fila: Record<string, any> = {
      nombre,
      telefono: texto(body?.telefono),
      username: texto(String(body?.username ?? '').replace(/^@/, '')),
      stage_id: stageId,
      monto_cotizado: Number(body?.monto_cotizado || 0),
      servicios: Array.isArray(body?.servicios) ? body.servicios : [],
      updated_at: new Date().toISOString(),
    }
    for (const k of CAMPOS_TEXTO) if (k in body) fila[k] = texto(body[k])

    // El resultado sale de la etapa, no del body
    const { resultado, fecha_cierre } = await resultadoDeEtapa(supabase, stageId, body?.fecha_cierre)
    fila.resultado = resultado
    fila.fecha_cierre = fecha_cierre

    const res = id
      ? await supabase.from('piola_leads').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_leads').insert(fila).select('*').single()
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, lead: res.data }
  }

  /* ══════════ Mover un lead de etapa (drag & drop del kanban) ══════════ */
  if (accion === 'mover_lead') {
    exigirModulo(perfil, 'crm', 'edit')

    const id = Number(body?.id)
    const stageId = Number(body?.stage_id)
    if (!id || !stageId) throw createError({ statusCode: 400, statusMessage: 'Faltan el lead o la etapa' })

    const { data: lead } = await supabase.from('piola_leads')
      .select('id, stage_id').eq('id', id).maybeSingle()
    if (!lead) throw createError({ statusCode: 404, statusMessage: 'El lead no existe' })
    if (lead.stage_id === stageId) return { ok: true, sin_cambios: true }

    const { etapa, resultado, fecha_cierre } = await resultadoDeEtapa(supabase, stageId)

    const patch = {
      stage_id: stageId, resultado, fecha_cierre,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('piola_leads').update(patch).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    // El nombre de la etapa anterior se resuelve acá para que la nota del
    // historial no dependa de lo que el navegador tuviera cargado.
    const { data: anterior } = await supabase.from('piola_lead_stages')
      .select('nombre').eq('id', lead.stage_id).maybeSingle()

    await supabase.from('piola_lead_activities').insert({
      lead_id: id, user_email: perfil.email, canal: 'nota',
      nota: `Movido de "${anterior?.nombre || '—'}" a "${etapa.nombre}"`,
      stage_anterior: lead.stage_id, stage_nuevo: stageId,
    })

    return { ok: true, patch, etapa: etapa.nombre }
  }

  /* ══════════ Eliminar un lead ══════════ */
  if (accion === 'eliminar_lead') {
    exigirModulo(perfil, 'crm', 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el lead a eliminar' })

    const { error } = await supabase.from('piola_leads').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Registrar una interacción ══════════ */
  if (accion === 'registrar_actividad') {
    exigirModulo(perfil, 'crm', 'create')

    const leadId = Number(body?.lead_id)
    const nota = texto(body?.nota)
    if (!leadId || !nota) {
      throw createError({ statusCode: 400, statusMessage: 'La interacción necesita lead y nota' })
    }

    const ahora = new Date().toISOString()
    const { data, error } = await supabase.from('piola_lead_activities').insert({
      lead_id: leadId,
      // Quién la registró lo pone el servidor
      user_email: perfil.email,
      canal: texto(body?.canal) || 'nota',
      nota,
      proxima_accion: texto(body?.proxima_accion),
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    // `ultima_interaccion` es lo que mira el cron de alertas para detectar
    // leads abandonados: se actualiza junto con la nota, no después.
    const patch: Record<string, any> = { ultima_interaccion: ahora }
    const proxima = texto(body?.proxima_accion)
    if (proxima) patch.proxima_accion = proxima
    await supabase.from('piola_leads').update(patch).eq('id', leadId)

    return { ok: true, actividad: data, ultima_interaccion: ahora }
  }

  /* ══════════ Conversión a cliente ══════════ */
  if (accion === 'convertir_cliente') {
    // Crea una ficha en Producción/Facturación: vale con permiso de cualquiera
    // de los dos módulos, igual que el resto de escrituras de piola_clientes.
    exigirAlguno(perfil, ['crm', 'produccion'], 'create')

    const leadId = Number(body?.lead_id)
    if (!leadId) throw createError({ statusCode: 400, statusMessage: 'Falta el lead a convertir' })

    const { data: lead } = await supabase.from('piola_leads')
      .select('id, nombre, empresa, email, telefono, cliente_id, fecha_cierre')
      .eq('id', leadId).maybeSingle()
    if (!lead) throw createError({ statusCode: 404, statusMessage: 'El lead no existe' })
    // Dos clics seguidos creaban dos clientes para el mismo lead
    if (lead.cliente_id) {
      throw createError({ statusCode: 400, statusMessage: 'Ese lead ya fue convertido en cliente' })
    }

    const { data: cliente, error } = await supabase.from('piola_clientes').insert({
      nombre: lead.empresa || lead.nombre,
      contacto: lead.nombre,
      email: lead.email || null,
      telefono: lead.telefono || null,
      lead_id: lead.id,
      compromiso_mensual: 0,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    const { error: errLead } = await supabase.from('piola_leads').update({
      cliente_id: cliente.id,
      resultado: 'ganado',
      fecha_cierre: lead.fecha_cierre || new Date().toISOString(),
    }).eq('id', lead.id)
    if (errLead) {
      // El cliente quedaría huérfano: se deshace antes de devolver el error
      await supabase.from('piola_clientes').delete().eq('id', cliente.id)
      throw createError({ statusCode: 400, statusMessage: errLead.message })
    }

    return { ok: true, cliente }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
