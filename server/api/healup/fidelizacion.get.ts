/**
 * GET /api/healup/fidelizacion
 *
 * Resumen del programa de fidelización de Healup: métricas y padrón de socios.
 * Habla con la Alef Loyalty Platform (VPS 2) usando credenciales de servidor —
 * el navegador nunca las ve.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 200)
 *   q      (opcional: busca por DNI, nombre, correo o teléfono sobre TODO el padrón)
 *
 * La búsqueda la resuelve la plataforma con índices de trigramas; acá no se
 * filtra nada en memoria.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const q = getQuery(event)
  const page = Math.max(Number(q.page) || 1, 1)
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const busqueda = String(q.q || '').trim()

  const [stats, listado] = await Promise.all([
    loyaltyFetch<any>('/api/businesses/{business}/stats'),
    loyaltyFetch<any>('/api/businesses/{business}/customers', {
      query: { page, limit, q: busqueda || undefined },
    }),
  ])

  return {
    ok: true,
    stats,
    socios: Array.isArray(listado?.customers) ? listado.customers : [],
    total: listado?.total ?? 0,
    page: listado?.page ?? page,
    pages: listado?.pages ?? 1,
    query: listado?.query ?? busqueda,
    // Enlace del formulario de alta (el QR del mostrador apunta acá).
    urlAlta: `${loyaltyBaseUrl()}/join/healup`,
  }
})
