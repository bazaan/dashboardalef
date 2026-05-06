-- =====================================================================
-- 2.7 Estados de cita + reagendamiento — Healup
-- =====================================================================
-- Estados: RESERVADA, EN_CURSO, FINALIZADA, NO_SHOW, REAGENDADA, CANCELADA.
-- Idempotente y reversible.
-- =====================================================================

ALTER TABLE healup_calendar_events
  ADD COLUMN IF NOT EXISTS estado                  TEXT,
  ADD COLUMN IF NOT EXISTS estado_actualizado_en   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_actualizado_por  TEXT,
  ADD COLUMN IF NOT EXISTS reagendado_a_id         BIGINT REFERENCES healup_calendar_events(id) ON DELETE SET NULL;

ALTER TABLE healup_calendar_events
  DROP CONSTRAINT IF EXISTS healup_calendar_events_estado_check;
ALTER TABLE healup_calendar_events
  ADD CONSTRAINT healup_calendar_events_estado_check
  CHECK (estado IS NULL OR estado IN ('RESERVADA','EN_CURSO','FINALIZADA','NO_SHOW','REAGENDADA','CANCELADA'));

-- Inicialización: cobro_completado=true → FINALIZADA
-- (Si la columna monto_reserva existe en el futuro, agregar:
--  UPDATE healup_calendar_events SET estado='RESERVADA' WHERE estado IS NULL AND COALESCE(monto_reserva,0)>0)
UPDATE healup_calendar_events SET estado = 'FINALIZADA'
  WHERE estado IS NULL AND cobro_completado = true;

CREATE INDEX IF NOT EXISTS idx_healup_calendar_events_estado
  ON healup_calendar_events (estado) WHERE estado IS NOT NULL;

-- ROLLBACK:
-- ALTER TABLE healup_calendar_events
--   DROP COLUMN IF EXISTS estado, DROP COLUMN IF EXISTS estado_actualizado_en,
--   DROP COLUMN IF EXISTS estado_actualizado_por, DROP COLUMN IF EXISTS reagendado_a_id;
