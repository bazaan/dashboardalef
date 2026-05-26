-- Tabla para loggear los envíos diarios del resumen de CITAS DEL DÍA SIGUIENTE a n8n.
-- Disparada por la Netlify Scheduled Function todos los días a las 19:00 Lima (00:00 UTC)
-- y también desde la UI manual ("Probar envío ahora") en el panel "Citas de Mañana".
--
-- Corré este script en Supabase → SQL Editor (una sola vez).

CREATE TABLE IF NOT EXISTS healup_citas_manana_logs (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT NOW(),  -- hora del envío
  fecha_objetivo        DATE,                       -- día Lima cubierto (mañana)
  origen                TEXT DEFAULT 'cron',        -- cron | manual
  triggered_by_email    TEXT,                       -- email del usuario que disparó (si fue manual)
  status                TEXT DEFAULT 'pending',     -- pending | success | error | empty
  citas_count           INTEGER DEFAULT 0,          -- total de citas (ya deduplicadas)
  citas_dashboard_count INTEGER DEFAULT 0,          -- citas crudas leídas del dashboard
  citas_gcal_count      INTEGER DEFAULT 0,          -- citas crudas leídas de Google Calendar
  duplicados_fusionados INTEGER DEFAULT 0,          -- cuántas citas se fusionaron en el dedup
  webhook_url           TEXT,                       -- URL de n8n a la que se envió
  payload_enviado       JSONB,                      -- JSON completo enviado a n8n
  respuesta_n8n         JSONB,                      -- respuesta completa de n8n
  http_status           INTEGER,                    -- código HTTP de la respuesta
  error_message         TEXT,                       -- mensaje de error si falló
  duracion_ms           INTEGER                     -- duración total del envío
);

-- RLS
ALTER TABLE healup_citas_manana_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_citas_manana_logs"
  ON healup_citas_manana_logs FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_citas_manana_logs"
  ON healup_citas_manana_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_healup_citas_manana_logs_created_at
  ON healup_citas_manana_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_healup_citas_manana_logs_fecha_objetivo
  ON healup_citas_manana_logs (fecha_objetivo DESC);
