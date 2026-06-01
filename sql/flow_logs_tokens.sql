-- ══════════════════════════════════════════════════════════════════════════
-- Extiende agent_tool_logs para soportar:
--   1) Registro de errores de cualquier flujo n8n (tool_name = 'Registro de Errores')
--   2) Reporte de tokens por ejecución        (tool_name = 'Reporte de Tokens')
--
-- Ambos se insertan vía POST /api/flows/log y aparecen automáticamente en el
-- dashboard de Alef → "Dev · Agent Logs", filtrados por empresa y tool.
--
-- Corre esto en Supabase → SQL Editor (una sola vez). Es idempotente.
-- Requiere que ya exista agent_tool_logs (sql/agent_tool_logs.sql).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE agent_tool_logs
  ADD COLUMN IF NOT EXISTS flow_name         TEXT,      -- nombre del workflow n8n que generó el log
  ADD COLUMN IF NOT EXISTS node_name         TEXT,      -- nodo donde ocurrió el error (si aplica)
  ADD COLUMN IF NOT EXISTS n8n_execution_id  TEXT,      -- id de ejecución n8n (trazabilidad)
  ADD COLUMN IF NOT EXISTS tokens            JSONB,     -- { prompt, completion, total, model }
  ADD COLUMN IF NOT EXISTS tokens_total      INTEGER;   -- total de tokens (para sumar/ordenar rápido)

-- Índice para sumar/ordenar reportes de tokens por empresa y fecha
CREATE INDEX IF NOT EXISTS idx_agent_logs_tokens
  ON agent_tool_logs (company_id, created_at DESC)
  WHERE tokens_total IS NOT NULL;

-- Índice para listar errores rápido (status='error') por empresa
CREATE INDEX IF NOT EXISTS idx_agent_logs_errors
  ON agent_tool_logs (company_id, created_at DESC)
  WHERE status = 'error';

-- Las policies RLS existentes (anon SELECT, service_role ALL) ya cubren estas filas.
