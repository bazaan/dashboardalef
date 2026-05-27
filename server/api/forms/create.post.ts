/**
 * POST /api/forms/create
 *
 * Crea un formulario nuevo. Solo superadmin.
 *
 * Body:
 * {
 *   title:        string,
 *   description?: string,
 *   company_id:   string,    — empresa a la que pertenece (healup/gatwick/...)
 *   fields:       Field[],   — array de preguntas
 *   active?:      boolean,
 *   thanks_text?: string,
 *   redirect_url?: string,
 * }
 *
 * Field:
 * {
 *   id:       string,
 *   type:     'short'|'long'|'checkbox'|'radio'|'date'|'email'|'phone',
 *   label:    string,
 *   required: boolean,
 *   options?: string[],     — solo para checkbox/radio
 *   placeholder?: string,
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import { randomBytes } from 'node:crypto'
import { getAuthSession, isSuperAdmin, normalizeCompanyId } from '~/server/utils/forms-auth'

function generateSlug(): string {
  // 12 caracteres base64url
  return randomBytes(9).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const session  = await getAuthSession(event, supabase)

  if (!isSuperAdmin(session)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo superadmin puede crear formularios' })
  }

  const body = await readBody(event)

  // Validación
  if (!body?.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Falta title' })
  }
  if (!Array.isArray(body?.fields) || body.fields.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'fields debe ser un array no vacío' })
  }

  const companyId = normalizeCompanyId(body?.company_id)
  if (!companyId) {
    throw createError({ statusCode: 400, statusMessage: 'company_id inválido' })
  }

  // Generar slug único (reintento si colisiona)
  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug()
    const { data: existing } = await supabase.from('forms').select('id').eq('slug', candidate).maybeSingle()
    if (!existing) { slug = candidate; break }
  }
  if (!slug) throw createError({ statusCode: 500, statusMessage: 'No se pudo generar slug único' })

  // Insertar
  const { data, error } = await supabase.from('forms').insert({
    slug,
    title:        String(body.title).slice(0, 200),
    description:  body.description ? String(body.description).slice(0, 1000) : null,
    company_id:   companyId,
    fields:       body.fields,
    active:       body.active !== false,
    thanks_text:  body.thanks_text || '¡Gracias por completar el formulario!',
    redirect_url: body.redirect_url || null,
    created_by:   session!.email,
  }).select('*').single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Error guardando: ${error.message}` })
  }

  return {
    ok:        true,
    form:      data,
    public_url: `/forms/${slug}`,
  }
})
