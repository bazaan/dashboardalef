-- Tabla para guardar configuraciones de la app (ej: refresh tokens de Google)
-- Ejecutar una sola vez en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar el refresh token actual como seed
INSERT INTO app_settings (key, value) VALUES
  ('google_refresh_token_healup', '')
ON CONFLICT (key) DO NOTHING;
