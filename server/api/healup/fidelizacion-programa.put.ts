/**
 * PUT /api/healup/fidelizacion-programa
 *
 * Guarda la configuración del programa: puntos, niveles, colores, logo y la
 * descripción que aparece en la tarjeta.
 *
 * El endpoint de la plataforma reemplaza `config` y `card_design` enteros, así
 * que acá se leen los valores actuales y se fusionan con lo que llega. Sin eso,
 * guardar solo los colores borraría los niveles.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

const MAX_NIVELES = 8
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const body = await readBody<{
    puntos?: { porVisita?: number; porSol?: number }
    niveles?: Array<{ name?: string; threshold?: number }>
    tarjeta?: {
      descripcion?: string
      colorFondo?: string
      colorTexto?: string
      colorEtiqueta?: string
      logo?: string
    }
  }>(event)

  // ── Estado actual, para fusionar y no perder lo que no viene en el body ──
  const programas = await loyaltyFetch<any>('/api/businesses/{business}/programs')
  const lista = Array.isArray(programas) ? programas : programas?.programs || []
  const programa = lista[0]
  if (!programa) {
    throw createError({ statusCode: 404, statusMessage: 'No hay un programa de fidelización activo' })
  }

  const config = { ...(programa.config || {}) }
  const design = { ...(programa.card_design || {}) }

  // ── Puntos ──
  if (body?.puntos) {
    if (body.puntos.porVisita !== undefined) {
      const v = Number(body.puntos.porVisita)
      if (!Number.isInteger(v) || v < 0 || v > 5000) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Los puntos por visita deben ser un entero entre 0 y 5000',
        })
      }
      config.points_per_visit = v
    }
    if (body.puntos.porSol !== undefined) {
      const v = Number(body.puntos.porSol)
      if (!Number.isFinite(v) || v < 0 || v > 1000) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Los puntos por sol deben estar entre 0 y 1000',
        })
      }
      config.points_per_currency = v
    }
  }

  // ── Niveles ──
  if (body?.niveles !== undefined) {
    if (!Array.isArray(body.niveles) || body.niveles.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Hace falta al menos un nivel' })
    }
    if (body.niveles.length > MAX_NIVELES) {
      throw createError({ statusCode: 400, statusMessage: `Máximo ${MAX_NIVELES} niveles` })
    }

    const limpios = body.niveles.map((n) => {
      const name = String(n?.name || '').trim()
      const threshold = Number(n?.threshold ?? 0)
      if (!name) {
        throw createError({ statusCode: 400, statusMessage: 'Todos los niveles necesitan un nombre' })
      }
      if (!Number.isInteger(threshold) || threshold < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `El umbral de "${name}" debe ser un entero de 0 o más`,
        })
      }
      return { name: name.slice(0, 40), threshold }
    }).sort((a, b) => a.threshold - b.threshold)

    // Dos niveles con el mismo umbral hacen que uno sea inalcanzable.
    const umbrales = new Set(limpios.map((n) => n.threshold))
    if (umbrales.size !== limpios.length) {
      throw createError({ statusCode: 400, statusMessage: 'Hay dos niveles con el mismo puntaje' })
    }

    // Sin nivel de entrada, un socio recién inscrito se queda sin nivel.
    if (limpios[0].threshold !== 0) limpios[0].threshold = 0

    config.levels = limpios
  }

  // ── Tarjeta ──
  if (body?.tarjeta) {
    const t = body.tarjeta
    if (t.descripcion !== undefined) design.descripcion = String(t.descripcion).trim().slice(0, 200)

    for (const [campo, clave] of [
      ['colorFondo', 'bg_color'],
      ['colorTexto', 'text_color'],
      ['colorEtiqueta', 'label_color'],
    ] as const) {
      const valor = (t as any)[campo]
      if (valor === undefined) continue
      if (!COLOR_RE.test(String(valor))) {
        throw createError({ statusCode: 400, statusMessage: `El color ${campo} debe ser un hexadecimal tipo #1a1a2e` })
      }
      design[clave] = String(valor)
    }

    if (t.logo !== undefined) {
      const logo = String(t.logo).trim()
      // Solo el nombre del archivo: nada de rutas ni URLs. La plataforma lo
      // resuelve dentro de su carpeta de logos.
      if (logo && !/^[A-Za-z0-9._-]+\.png$/.test(logo)) {
        throw createError({ statusCode: 400, statusMessage: 'Nombre de logo inválido' })
      }
      design.logo_url = logo
    }
  }

  const actualizado = await loyaltyFetch<any>(
    `/api/businesses/{business}/programs/${programa.id}`,
    {
      method: 'PUT',
      body: {
        name: programa.name,
        type: programa.type,
        config,
        card_design: design,
      },
    },
  )

  return { ok: true, programa: actualizado }
})
