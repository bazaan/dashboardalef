/**
 * POST /api/forms/public/[slug]/submit
 *
 * Endpoint PÚBLICO (sin auth) que guarda una respuesta a un formulario.
 * Lo llama la página /forms/[slug] cuando el usuario hace submit.
 *
 * Body:
 * {
 *   answers: { [field_id]: value }
 * }
 *
 * Response: { ok: true, response_id, thanks_text, redirect_url }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizeCompanyId, getResponsesTable } from '~/server/utils/forms-auth'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Falta slug' })

  const body = await readBody(event)
  if (!body?.answers || typeof body.answers !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'answers requeridas' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // 1. Cargar el form para verificar que está activo y obtener company_id
  const { data: form, error: formErr } = await supabase
    .from('forms')
    .select('id, company_id, active, fields, thanks_text, redirect_url')
    .eq('slug', slug)
    .maybeSingle()

  if (formErr || !form) {
    throw createError({ statusCode: 404, statusMessage: 'Formulario no encontrado' })
  }
  if (!form.active) {
    throw createError({ statusCode: 410, statusMessage: 'Este formulario ya no está disponible' })
  }

  // 2. Validar campos requeridos
  const fields = Array.isArray(form.fields) ? form.fields : []
  for (const f of fields) {
    if (f.required) {
      const v = body.answers[f.id]
      const empty =
        v === undefined || v === null || v === '' ||
        (Array.isArray(v) && v.length === 0)
      if (empty) {
        throw createError({
          statusCode: 400,
          statusMessage: `El campo "${f.label}" es obligatorio`,
        })
      }
    }
  }

  // 3. Identificar la tabla de respuestas según empresa
  const companyId = normalizeCompanyId(form.company_id)
  if (!companyId) {
    throw createError({ statusCode: 500, statusMessage: 'Form con company_id inválido' })
  }
  const tableName = getResponsesTable(companyId)

  // 4. Insertar respuesta
  const { data: inserted, error: insErr } = await supabase
    .from(tableName)
    .insert({
      form_id:    form.id,
      answers:    body.answers,
      ip_address: getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || null,
      user_agent: getHeader(event, 'user-agent') || null,
      referrer:   getHeader(event, 'referer') || null,
    })
    .select('id, submitted_at')
    .single()

  if (insErr) {
    console.error('[forms/submit]', insErr)
    throw createError({ statusCode: 500, statusMessage: 'Error guardando respuesta' })
  }

  return {
    ok:           true,
    response_id:  inserted?.id,
    submitted_at: inserted?.submitted_at,
    thanks_text:  form.thanks_text,
    redirect_url: form.redirect_url,
  }
})
