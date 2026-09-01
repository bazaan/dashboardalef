/**
 * POST /api/healup/fidelizacion-logo
 *
 * Sube el logo que va dentro de la tarjeta. Recibe el archivo del navegador y lo
 * reenvía a la plataforma, que lo valida, lo normaliza y lo guarda.
 *
 * Devuelve el nombre con el que quedó guardado; ese nombre hay que enviarlo
 * después en `tarjeta.logo` al guardar la configuración. Se hace en dos pasos a
 * propósito: así una subida a medias no cambia la tarjeta que ya funciona.
 *
 * Requiere sesión Healup (admin, agente, o superadmin).
 */

const MAX_BYTES = 2 * 1024 * 1024
const TIPOS = ['image/png', 'image/jpeg', 'image/webp']

export default defineEventHandler(async (event) => {
  await requireHealupUser(event)

  const partes = await readMultipartFormData(event)
  const archivo = partes?.find((p) => p.name === 'archivo' && p.filename)

  if (!archivo?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No llegó ningún archivo' })
  }
  if (archivo.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'El logo no puede pesar más de 2 MB' })
  }
  const tipo = String(archivo.type || '')
  if (!TIPOS.includes(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'El logo debe ser PNG, JPG o WEBP' })
  }

  const form = new FormData()
  form.append('archivo', new Blob([archivo.data], { type: tipo }), archivo.filename || 'logo.png')

  const res = await loyaltyFetch<any>('/api/businesses/{business}/logo', {
    method: 'POST',
    body: form,
  })

  return {
    ok: true,
    // Nombre a guardar en la configuración.
    logo: res?.logo_url || '',
    // URL absoluta para previsualizar de inmediato.
    logoUrl: res?.url_publica ? `${loyaltyBaseUrl()}${res.url_publica}` : '',
    ancho: res?.ancho,
    alto: res?.alto,
  }
})
