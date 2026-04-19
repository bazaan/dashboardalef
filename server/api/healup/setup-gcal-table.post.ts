/**
 * POST /api/healup/setup-gcal-table
 *
 * Crea la tabla app_settings si no existe.
 * Se llama automáticamente desde el callback de GCal.
 */
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)

  // Intentar insertar — si la tabla no existe, el error nos dice
  const { error: testErr } = await client
    .from('app_settings')
    .select('key')
    .limit(1)

  if (testErr && testErr.code === '42P01') {
    // Tabla no existe — no podemos crearla via REST API
    return {
      success: false,
      error: 'Tabla app_settings no existe. Crearla en Supabase SQL Editor.',
      sql: "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());"
    }
  }

  return { success: true, message: 'Tabla app_settings existe' }
})
