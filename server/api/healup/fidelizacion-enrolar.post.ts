/**
 * POST /api/healup/fidelizacion-enrolar
 *
 * Da de alta a un paciente en el programa y genera su tarjeta (Apple + Google).
 * Es el mismo alta que hace el QR del mostrador, pero desde el dashboard, para
 * cuando la recepcionista lo inscribe a mano.
 *
 * Body: { name?, email?, phone? }  — al menos uno de correo o teléfono.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const body = await readBody<{ name?: string; email?: string; phone?: string }>(event)

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const phone = String(body?.phone || '').trim()

  if (!email && !phone) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hace falta al menos un correo o un teléfono para emitir la tarjeta',
    })
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'El correo no tiene un formato válido' })
  }

  const alta = await loyaltyFetch<any>('/api/businesses/healup/join', {
    method: 'POST',
    body: {
      name: name || null,
      email: email || null,
      phone: phone || null,
    },
  })

  const base = loyaltyBaseUrl()

  return {
    ok: true,
    customerId: alta?.customer_id,
    serial: alta?.serial_number,
    // La API devuelve la ruta relativa del .pkpass con su token de capacidad.
    applePassUrl: alta?.apple_pass_url ? `${base}${alta.apple_pass_url}` : null,
    googleWalletUrl: alta?.google_wallet_url || null,
    mensaje: alta?.message || 'Paciente inscrito',
  }
})
