/**
 * GET /api/healup/fidelizacion
 *
 * Resumen del programa de fidelización de Healup: métricas, socios y datos del
 * programa. Habla con la Alef Loyalty Platform (VPS 2) usando credenciales de
 * servidor — el navegador nunca las ve.
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 50, max 200)
 *   q      (opcional: filtra por nombre, correo o teléfono, ya en el servidor)
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const q = getQuery(event)
  const page = Math.max(Number(q.page) || 1, 1)
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const busqueda = String(q.q || '').trim().toLowerCase()

  const [stats, listado] = await Promise.all([
    loyaltyFetch<any>('/api/businesses/{business}/stats'),
    loyaltyFetch<any>('/api/businesses/{business}/customers', { query: { page, limit } }),
  ])

  let socios: any[] = Array.isArray(listado?.customers) ? listado.customers : []

  // El filtro se aplica sobre la página traída: la API no expone búsqueda propia.
  // Se avisa al cliente para que no muestre el resultado como si fuera global.
  if (busqueda) {
    socios = socios.filter((c: any) =>
      [c?.name, c?.email, c?.phone]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(busqueda)),
    )
  }

  return {
    ok: true,
    stats,
    socios,
    total: listado?.total ?? 0,
    page: listado?.page ?? page,
    pages: listado?.pages ?? 1,
    filtradoLocal: Boolean(busqueda),
    // Enlace del formulario de alta (el QR del mostrador apunta acá).
    urlAlta: `${loyaltyBaseUrl()}/join/healup`,
  }
})
