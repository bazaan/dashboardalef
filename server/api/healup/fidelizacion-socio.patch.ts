/**
 * PATCH /api/healup/fidelizacion-socio
 *
 * Edita los datos de un socio: sobre todo cargarle el DNI, que es como el equipo
 * de la clínica lo va a buscar después.
 *
 * Body: { customerId, documentId?, name?, email?, phone? }
 *
 * NO toca puntos ni nivel: eso solo se mueve por la ruta de puntos, que deja
 * transacción y traza de quién fue. Un atajo para editar el saldo sería una
 * puerta trasera sin auditoría.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DNI 8 dígitos, carné de extranjería y pasaporte: se acepta alfanumérico corto.
// No se valida el dígito verificador: hay pacientes extranjeros.
const DOC_RE = /^[A-Za-z0-9-]{6,20}$/

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const body = await readBody<{
    customerId?: string
    documentId?: string
    name?: string
    email?: string
    phone?: string
  }>(event)

  const customerId = String(body?.customerId || '').trim()
  if (!UUID_RE.test(customerId)) {
    throw createError({ statusCode: 400, statusMessage: 'customerId inválido' })
  }

  const payload: Record<string, string> = {}

  if (body?.documentId !== undefined) {
    const doc = String(body.documentId).trim()
    // Cadena vacía es válida: significa "borrar el documento".
    if (doc && !DOC_RE.test(doc)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'El documento debe tener entre 6 y 20 caracteres, sin espacios ni símbolos',
      })
    }
    payload.document_id = doc
  }

  if (body?.name !== undefined) payload.name = String(body.name).trim()
  if (body?.phone !== undefined) payload.phone = String(body.phone).trim()

  if (body?.email !== undefined) {
    const email = String(body.email).trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, statusMessage: 'El correo no tiene un formato válido' })
    }
    payload.email = email
  }

  if (Object.keys(payload).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No se envió ningún campo para actualizar' })
  }

  const res = await loyaltyFetch<any>(
    `/api/businesses/{business}/customers/${customerId}`,
    { method: 'PATCH', body: payload },
  )

  return { ok: true, socio: res?.customer || null }
})
