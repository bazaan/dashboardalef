/**
 * GET /api/healup/fidelizacion-programa
 *
 * Configuración del programa: cómo se ganan los puntos, la escalera de niveles,
 * los colores, el logo y la descripción de la tarjeta.
 *
 * Devuelve los valores ya normalizados y con sus defaults puestos, para que el
 * formulario del panel no tenga que adivinar qué falta.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

/** Escalera que usa la plataforma cuando el negocio no definió la suya. */
const NIVELES_POR_DEFECTO = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Plata', threshold: 500 },
  { name: 'Oro', threshold: 1000 },
]

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const programas = await loyaltyFetch<any>('/api/businesses/{business}/programs')
  const lista = Array.isArray(programas) ? programas : programas?.programs || []
  const programa = lista[0]

  if (!programa) {
    throw createError({ statusCode: 404, statusMessage: 'No hay un programa de fidelización activo' })
  }

  const config = programa.config || {}
  const design = programa.card_design || {}

  const niveles = Array.isArray(config.levels) && config.levels.length
    ? config.levels
    : NIVELES_POR_DEFECTO

  return {
    ok: true,
    programa: {
      id: programa.id,
      nombre: programa.name,
      tipo: programa.type,
    },
    puntos: {
      // Puntos que se otorgan por una visita cuando no se especifica cantidad.
      porVisita: Number(config.points_per_visit ?? 50),
      // Cuántos puntos vale cada sol gastado. 0 = no se usa el monto.
      porSol: Number(config.points_per_currency ?? 0),
    },
    // Ordenados para que el formulario los muestre de menor a mayor.
    niveles: [...niveles].sort((a: any, b: any) => (a.threshold || 0) - (b.threshold || 0)),
    tarjeta: {
      descripcion: String(design.descripcion || ''),
      colorFondo: String(design.bg_color || '#1a1a2e'),
      colorTexto: String(design.text_color || '#ffffff'),
      colorEtiqueta: String(design.label_color || '#aaaaaa'),
      logo: String(design.logo_url || ''),
      // URL absoluta para poder previsualizarlo en el panel.
      logoUrl: design.logo_url ? `${loyaltyBaseUrl()}/static/logos/${design.logo_url}` : '',
    },
  }
})
