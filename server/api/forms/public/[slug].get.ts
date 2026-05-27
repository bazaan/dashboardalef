/**
 * GET /api/forms/public/[slug]
 *
 * Endpoint PÚBLICO (sin auth) que devuelve la definición de un formulario
 * para que la página pública lo renderice.
 *
 * Solo devuelve forms activos. Si el form está pausado o no existe → 404.
 *
 * Response:
 * {
 *   id, slug, title, description, fields, thanks_text, redirect_url
 * }
 *
 * No expone: created_by, company_id (para no filtrar info interna)
 */

import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Falta slug' })

  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('forms')
    .select('id, slug, title, description, fields, thanks_text, redirect_url, active')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Formulario no encontrado' })
  }

  if (!data.active) {
    throw createError({ statusCode: 410, statusMessage: 'Este formulario ya no está disponible' })
  }

  // No retornamos company_id ni created_by por privacidad
  return {
    id:           data.id,
    slug:         data.slug,
    title:        data.title,
    description:  data.description,
    fields:       data.fields,
    thanks_text:  data.thanks_text,
    redirect_url: data.redirect_url,
  }
})
