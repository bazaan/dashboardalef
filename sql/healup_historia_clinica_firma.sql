-- =====================================================================
-- 2.12 Historia clínica con firma del paciente — campo opcional (Fase 2)
-- =====================================================================
-- Solo agrega la columna; la UI de firma con tablet llega en fase 2.
-- Almacena: URL de la imagen de firma + fecha + dispositivo de captura.
--
-- Idempotente y reversible (DROP COLUMN para revertir).
-- =====================================================================

ALTER TABLE healup_medical_history
  ADD COLUMN IF NOT EXISTS firma_paciente JSONB;

COMMENT ON COLUMN healup_medical_history.firma_paciente
  IS '{ url: string, fecha: ISO timestamp, dispositivo: string } — captura desde tablet en consultorio (fase 2)';
