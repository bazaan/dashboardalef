-- Tabla para loggear los envíos diarios a n8n con los pacientes agendados ese día.
-- Disparada por el cron de Vercel todos los días a las 19:00 Lima (00:00 UTC) y
-- también desde la UI manual ("Probar envío ahora") en el dashboard de Healup.
--
-- Corré este script en Supabase → SQL Editor (una sola vez).

CREATE TABLE IF NOT EXISTS healup_agendamiento_diario_logs (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT NOW(),  -- hora del envío
  fecha_lima            DATE,                       -- día Lima cubierto por el envío
  origen                TEXT DEFAULT 'cron',        -- cron | manual
  triggered_by_email    TEXT,                       -- email del usuario que disparó (si fue manual)
  status                TEXT DEFAULT 'pending',     -- pending | success | error | empty
  pacientes_count       INTEGER DEFAULT 0,          -- total de pacientes en el envío
  pacientes_wpp_count   INTEGER DEFAULT 0,
  pacientes_fbig_count  INTEGER DEFAULT 0,
  pacientes_tiktok_count INTEGER DEFAULT 0,
  webhook_url           TEXT,                       -- URL de n8n a la que se envió
  payload_enviado       JSONB,                      -- JSON completo enviado a n8n
  respuesta_n8n         JSONB,                      -- respuesta completa de n8n
  http_status           INTEGER,                    -- código HTTP de la respuesta
  error_message         TEXT,                       -- mensaje de error si falló
  duracion_ms           INTEGER                     -- duración total del envío
);

-- RLS
ALTER TABLE healup_agendamiento_diario_logs ENABLE ROW LEVEL SECURITY;

-- El dashboard lee los logs con anon key (el componente HealupAgendamientoDiarioPanel).
CREATE POLICY "anon_select_agendamiento_logs"
  ON healup_agendamiento_diario_logs FOR SELECT TO anon USING (true);

-- El service role (usado por los endpoints del servidor) puede hacer todo.
CREATE POLICY "service_all_agendamiento_logs"
  ON healup_agendamiento_diario_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índice para paginación rápida por fecha.
CREATE INDEX IF NOT EXISTS idx_healup_agendamiento_logs_created_at
  ON healup_agendamiento_diario_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_healup_agendamiento_logs_fecha_lima
  ON healup_agendamiento_diario_logs (fecha_lima DESC);
