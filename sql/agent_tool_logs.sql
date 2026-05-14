-- Tabla de logs de ejecución de tools del agente IA
-- Corre esto en Supabase → SQL Editor (una sola vez)

CREATE TABLE IF NOT EXISTS agent_tool_logs (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  company_id    TEXT         NOT NULL,               -- "healup", "brada", etc.
  tool_name     TEXT         NOT NULL,               -- "Calendario", "PacientesWpp", etc.
  input_data    JSONB,                               -- body completo recibido (sin api_key)
  output_data   JSONB,                               -- respuesta devuelta
  status        TEXT         DEFAULT 'running',      -- running | success | partial | error
  error_message TEXT,
  duration_ms   INTEGER                              -- tiempo de ejecución en ms
);

-- RLS: superadmin lee desde el dashboard (anon key), escritura solo service_role
ALTER TABLE agent_tool_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_agent_logs"
  ON agent_tool_logs FOR SELECT TO anon   USING (true);

CREATE POLICY "service_all_agent_logs"
  ON agent_tool_logs FOR ALL    TO service_role USING (true) WITH CHECK (true);

-- Índices para paginación y filtros rápidos
CREATE INDEX IF NOT EXISTS idx_agent_logs_company_date
  ON agent_tool_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_logs_status
  ON agent_tool_logs (status);
