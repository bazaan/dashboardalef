-- =====================================================================
-- 2.12 Historia clínica — firma paciente (campo opcional, fase 2)
-- =====================================================================
-- Solo agrega la columna. La UI con tablet llega en fase 2.
-- Idempotente y reversible.
-- =====================================================================

ALTER TABLE healup_medical_history
  ADD COLUMN IF NOT EXISTS firma_paciente JSONB;

COMMENT ON COLUMN healup_medical_history.firma_paciente
  IS '{ url: string, fecha: ISO timestamp, dispositivo: string }';

-- ROLLBACK: ALTER TABLE healup_medical_history DROP COLUMN IF EXISTS firma_paciente;
