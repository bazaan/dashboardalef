/**
 * GET /api/healup/fidelizacion-campanas
 *
 * Historial de campañas + previsualización del alcance de un segmento.
 *
 * Query params (opcionales, para la previsualización):
 *   minPoints, daysInactive, level
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const q = getQuery(event)
  const minPoints = Math.max(Number(q.minPoints) || 0, 0)
  const daysInactive = Math.max(Number(q.daysInactive) || 0, 0)
  const level = String(q.level || '')

  const [campanas, alcance] = await Promise.all([
    loyaltyFetch<any>('/api/businesses/{business}/campaigns'),
    loyaltyFetch<any>('/api/businesses/{business}/campaigns/preview-destinatarios', {
      query: { min_points: minPoints, days_inactive: daysInactive, level: level || undefined },
    }),
  ])

  const lista = Array.isArray(campanas) ? campanas : campanas?.campaigns || []

  return {
    ok: true,
    campanas: lista,
    // `conTarjeta` es a cuánta gente puede llegarle de verdad: el resto está en
    // el padrón pero no tiene la tarjeta instalada en un teléfono.
    alcance,
  }
})
