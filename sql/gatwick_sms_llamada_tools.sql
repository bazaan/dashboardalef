-- ============================================================================
-- GATWICK — Tools "SMS Alerta Emergencia" + "Generar Llamada"
-- ============================================================================
-- Un solo script, idempotente: se puede correr de frente en Supabase → SQL
-- Editor (incluso varias veces, no rompe nada).
--
-- Qué crea:
--   1. agent_tool_logs        → se asegura de que exista (ya la usan las demás
--      tools). Acá quedan los logs de SMS Alerta Emergencia y Generar Llamada,
--      visibles en el dashboard de Alef → Dev · Agent Logs → Gatwick.
--   2. gatwick_alerta_destinos → técnicos de turno a los que se les manda el SMS
--      y/o la llamada de emergencia (destino "rotativo", editable acá sin redeploy).
--
-- Tras correrlo, editá la fila sembrada con el número real del técnico de turno
-- (o agregá varias filas; se notifica a TODAS las activas del canal correspondiente).
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1) LOGS DE TOOLS (agent_tool_logs) — asegurar que exista
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tool_logs (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  company_id    TEXT         NOT NULL,
  tool_name     TEXT         NOT NULL,
  input_data    JSONB,
  output_data   JSONB,
  status        TEXT         DEFAULT 'running',
  error_message TEXT,
  duration_ms   INTEGER
);

ALTER TABLE agent_tool_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_agent_logs"  ON agent_tool_logs;
DROP POLICY IF EXISTS "service_all_agent_logs"  ON agent_tool_logs;

CREATE POLICY "anon_select_agent_logs"
  ON agent_tool_logs FOR SELECT TO anon          USING (true);
CREATE POLICY "service_all_agent_logs"
  ON agent_tool_logs FOR ALL    TO service_role   USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_logs_company_date
  ON agent_tool_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status
  ON agent_tool_logs (status);


-- ────────────────────────────────────────────────────────────────────────────
-- 2) DESTINOS DE ALERTA (técnicos de turno) — gatwick_alerta_destinos
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gatwick_alerta_destinos (
  id              BIGSERIAL PRIMARY KEY,
  nombre          TEXT        NOT NULL,                 -- nombre del técnico
  telefono        TEXT        NOT NULL,                 -- E.164 Perú, ej: +51955322269
  recibe_sms      BOOLEAN     NOT NULL DEFAULT TRUE,    -- recibe SMS de alerta
  recibe_llamada  BOOLEAN     NOT NULL DEFAULT TRUE,    -- recibe llamada de alerta
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,    -- desactivar sin borrar
  orden           INTEGER     NOT NULL DEFAULT 0,       -- orden de notificación
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gatwick_alerta_destinos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_gtw_destinos"    ON gatwick_alerta_destinos;
DROP POLICY IF EXISTS "service_all_gtw_destinos"    ON gatwick_alerta_destinos;

-- Lectura desde el dashboard (anon). Escritura solo service_role (los endpoints).
CREATE POLICY "anon_select_gtw_destinos"
  ON gatwick_alerta_destinos FOR SELECT TO anon         USING (true);
CREATE POLICY "service_all_gtw_destinos"
  ON gatwick_alerta_destinos FOR ALL    TO service_role  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_gtw_destinos_activo
  ON gatwick_alerta_destinos (activo, orden);

-- Semilla: técnico de turno por defecto (EDITAR con el número real).
-- Solo inserta si la tabla está vacía, para no duplicar al re-correr el script.
INSERT INTO gatwick_alerta_destinos (nombre, telefono, recibe_sms, recibe_llamada, activo, orden)
SELECT 'Técnico de turno', '+51955322269', TRUE, TRUE, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM gatwick_alerta_destinos);

-- ============================================================================
-- LISTO. Verificá:
--   SELECT * FROM gatwick_alerta_destinos;
-- ============================================================================
