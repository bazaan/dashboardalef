-- Tabla para loggear todas las llamadas al endpoint público de ECS
-- POST /api/pse/webhook-compra
-- Corre esto en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS ecs_webhook_logs (
  id                 BIGSERIAL PRIMARY KEY,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  ip_address         TEXT,
  payload            JSONB,
  status             TEXT DEFAULT 'pending',   -- pending | success | error
  error_message      TEXT,
  comprobante_serie  TEXT,
  comprobante_numero BIGINT,
  enlace_pdf         TEXT
);

-- RLS: visible solo desde el service role (el dashboard lo lee con anon key + política)
ALTER TABLE ecs_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_ecs_logs"
  ON ecs_webhook_logs FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_ecs_logs"
  ON ecs_webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índice para paginación rápida por fecha
CREATE INDEX IF NOT EXISTS idx_ecs_webhook_logs_created_at ON ecs_webhook_logs (created_at DESC);
