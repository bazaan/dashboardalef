/**
 * GET /api/healup/fidelizacion-socio?customerId=<uuid>
 *
 * Detalle de un socio: sus datos, el `serial_number` de su tarjeta y sus últimos
 * movimientos.
 *
 * Existe porque el listado de socios de la plataforma NO devuelve el serial (vive
 * en `wallet_passes`) y sin él no se pueden sumar puntos. Se pide al abrir la
 * ficha, no en el listado.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const customerId = String(getQuery(event).customerId || '').trim()
  if (!UUID_RE.test(customerId)) {
    throw createError({ statusCode: 400, statusMessage: 'customerId inválido' })
  }

  const res = await loyaltyFetch<any>(`/api/businesses/{business}/customers/${customerId}`)

  return {
    ok: true,
    socio: res?.customer || null,
    serial: res?.customer?.serial_number || null,
    movimientos: Array.isArray(res?.transactions) ? res.transactions : [],
  }
})
