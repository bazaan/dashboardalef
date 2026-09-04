/**
 * POST /api/healup/fidelizacion-campanas
 *
 * Crea una campaña y, según `accion`, la envía en el momento o la programa.
 *
 * Body: { titulo, mensaje, segmento?: { minPoints, daysInactive, level },
 *         accion: 'enviar' | 'programar' | 'borrador', programadaPara? }
 *
 * `programadaPara` llega en hora local de Lima desde el navegador y se convierte
 * a UTC acá. Es donde más se equivoca uno con las campañas programadas.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

const MAX_MENSAJE = 160

export default defineEventHandler(async (event) => {
  const perfil = await requireHealupUser(event)

  const body = await readBody<{
    titulo?: string
    mensaje?: string
    segmento?: { minPoints?: number; daysInactive?: number; level?: string }
    accion?: 'enviar' | 'programar' | 'borrador'
    programadaPara?: string
  }>(event)

  const titulo = String(body?.titulo || '').trim()
  const mensaje = String(body?.mensaje || '').trim()
  const accion = body?.accion || 'borrador'

  if (!titulo) throw createError({ statusCode: 400, statusMessage: 'Falta el título de la campaña' })
  if (!mensaje) throw createError({ statusCode: 400, statusMessage: 'Falta el mensaje' })
  if (mensaje.length > MAX_MENSAJE) {
    throw createError({
      statusCode: 400,
      statusMessage: `El mensaje no puede pasar de ${MAX_MENSAJE} caracteres (tiene ${mensaje.length})`,
    })
  }

  const seg = body?.segmento || {}
  const segment: Record<string, any> = {}
  if (seg.minPoints) segment.min_points = Math.max(Number(seg.minPoints) || 0, 0)
  if (seg.daysInactive) segment.days_inactive = Math.max(Number(seg.daysInactive) || 0, 0)
  if (seg.level && seg.level !== 'Todos') segment.level = String(seg.level)

  // 1 · Crear
  const campana = await loyaltyFetch<any>('/api/businesses/{business}/campaigns', {
    method: 'POST',
    body: { title: titulo, message: mensaje, segment },
  })

  const id = campana?.id
  if (!id) throw createError({ statusCode: 502, statusMessage: 'La plataforma no devolvió la campaña creada' })

  // 2 · Enviar o programar
  if (accion === 'enviar') {
    const res = await loyaltyFetch<any>(`/api/businesses/{business}/campaigns/${id}/send`, { method: 'POST' })
    return { ok: true, id, accion, resultado: res, operador: perfil.email }
  }

  if (accion === 'programar') {
    const cuando = String(body?.programadaPara || '').trim()
    if (!cuando) {
      throw createError({ statusCode: 400, statusMessage: 'Falta la fecha y hora de envío' })
    }

    // El navegador manda "2026-09-02T09:00" sin zona. Se interpreta como hora de
    // Lima (UTC-5) — que es donde está la clínica — y se convierte a UTC.
    const iso = /Z|[+-]\d{2}:\d{2}$/.test(cuando) ? cuando : `${cuando}:00-05:00`
    const fecha = new Date(iso)
    if (isNaN(fecha.getTime())) {
      throw createError({ statusCode: 400, statusMessage: 'La fecha no es válida' })
    }

    const res = await loyaltyFetch<any>(`/api/businesses/{business}/campaigns/${id}/schedule`, {
      method: 'POST',
      body: { scheduled_at: fecha.toISOString() },
    })
    return { ok: true, id, accion, resultado: res, operador: perfil.email }
  }

  return { ok: true, id, accion: 'borrador' }
})
