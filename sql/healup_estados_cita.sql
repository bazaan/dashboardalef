-- =====================================================================
-- 2.7 Estados de cita + reagendamiento — Healup
-- =====================================================================
-- Estados controlados:
--   RESERVADA (paciente pagó la reserva, aún no llega)
--   EN_CURSO  (llegó y se está atendiendo)
--   FINALIZADA (atención completa, cobrada)
--   NO_SHOW   (no llegó en su hora)
--   REAGENDADA (NO_SHOW que ya tiene nueva cita asignada)
--   CANCELADA (cancelada, no se reagenda)
--
-- Campo reagendado_a_id: si esta cita es NO_SHOW reagendada, apunta al
-- id de la nueva cita.
--
-- Compatibilidad: se mantiene cobro_completado como flag legacy.
-- Idempotente y reversible.
-- =====================================================================

ALTER TABLE healup_calendar_events
  ADD COLUMN IF NOT EXISTS estado            TEXT,
  ADD COLUMN IF NOT EXISTS estado_actualizado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_actualizado_por TEXT,
  ADD COLUMN IF NOT EXISTS reagendado_a_id   BIGINT REFERENCES healup_calendar_events(id) ON DELETE SET NULL;

ALTER TABLE healup_calendar_events
  DROP CONSTRAINT IF EXISTS healup_calendar_events_estado_check;
ALTER TABLE healup_calendar_events
  ADD CONSTRAINT healup_calendar_events_estado_check
  CHECK (estado IS NULL OR estado IN ('RESERVADA','EN_CURSO','FINALIZADA','NO_SHOW','REAGENDADA','CANCELADA'));

-- Inicialización: citas existentes con cobro_completado=true → FINALIZADA
UPDATE healup_calendar_events
SET estado = 'FINALIZADA'
WHERE estado IS NULL AND cobro_completado = true;

-- Citas con monto_reserva > 0 y sin cobro_completado → RESERVADA
UPDATE healup_calendar_events
SET estado = 'RESERVADA'
WHERE estado IS NULL AND COALESCE(monto_reserva, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_healup_calendar_events_estado
  ON healup_calendar_events (estado) WHERE estado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_healup_calendar_events_no_show
  ON healup_calendar_events (estado) WHERE estado = 'NO_SHOW';

COMMENT ON COLUMN healup_calendar_events.estado IS 'RESERVADA | EN_CURSO | FINALIZADA | NO_SHOW | REAGENDADA | CANCELADA';
COMMENT ON COLUMN healup_calendar_events.reagendado_a_id IS 'Si la cita es NO_SHOW reagendada, apunta a la nueva cita';
