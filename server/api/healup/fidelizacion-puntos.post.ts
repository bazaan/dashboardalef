/**
 * POST /api/healup/fidelizacion-puntos
 *
 * Suma puntos a la tarjeta de un paciente (una atención, una compra). Si no se
 * mandan puntos, la plataforma usa los que tenga configurados el programa.
 *
 * Body: { serial, points?, amount?, description? }
 *
 * Manda una `idempotency_key` derivada del serial + minuto + monto para que un
 * doble clic (o un doble escaneo) no sume dos veces.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

export default defineEventHandler(async (event) => {
  const perfil = await requireHealupUser(event)

  const body = await readBody<{
    serial?: string
    points?: number
    amount?: number
    description?: string
  }>(event)

  const serial = String(body?.serial || '').trim()
  if (!serial) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el serial de la tarjeta' })
  }

  let points: number | null = null
  if (body?.points !== undefined && body?.points !== null && String(body.points) !== '') {
    points = Number(body.points)
    if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Los puntos deben ser un número entero mayor que cero',
      })
    }
  }

  let amount: number | null = null
  if (body?.amount !== undefined && body?.amount !== null && String(body.amount) !== '') {
    amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      throw createError({ statusCode: 400, statusMessage: 'El monto no es válido' })
    }
  }

  // Ventana de un minuto: dos envíos idénticos seguidos se consideran el mismo.
  const ventana = Math.floor(Date.now() / 60_000)
  const idempotencyKey = `dash:${serial}:${ventana}:${points ?? 'auto'}:${amount ?? 0}`

  const res = await loyaltyFetch<any>(`/api/customers/${encodeURIComponent(serial)}/earn`, {
    method: 'POST',
    body: {
      points,
      amount,
      description: String(body?.description || '').trim() || `Registrado desde el dashboard (${perfil.email})`,
      idempotency_key: idempotencyKey,
    },
  })

  return { ok: true, resultado: res }
})
