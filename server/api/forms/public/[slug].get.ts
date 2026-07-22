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
    .select('id, slug, title, description, fields, thanks_text, redirect_url, active, company_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Formulario no encontrado' })
  }

  if (!data.active) {
    throw createError({ statusCode: 410, statusMessage: 'Este formulario ya no está disponible' })
  }

  // Si el form tiene alguna pregunta de tipo 'firmante', adjuntamos la lista
  // de personas que pueden firmar. Se resuelve acá (service_role) y no desde
  // el navegador para no exponer company_id ni, sobre todo, las firmas: solo
  // viajan id, nombre y cargo.
  const fields = Array.isArray(data.fields) ? data.fields : []
  let signatories: Array<{ id: number; nombre: string; cargo: string | null }> = []

  if (fields.some((f: any) => f?.type === 'firmante')) {
    const { data: rows } = await supabase
      .from('form_signatories')
      .select('id, nombre, cargo')
      .eq('company_id', data.company_id)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true })

    signatories = rows || []
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
    signatories,
  }
})
