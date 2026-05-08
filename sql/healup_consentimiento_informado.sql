-- =====================================================================
-- 2.13 Historia clínica — consentimiento informado completo
-- =====================================================================
-- Extiende healup_medical_history para soportar el flujo completo:
--   · Datos del paciente al firmar (edad, txp, tx_realizar)
--   · Texto del consentimiento (snapshot al momento de firmar)
--   · Firmas paciente + doctor (canvas → dataURL base64)
--   · Trazabilidad: dispositivo, IP, user-agent
--
-- Idempotente y reversible. Compatible con la fase 1 ya aplicada
-- (firma_paciente JSONB existente).
-- =====================================================================

ALTER TABLE healup_medical_history
  ADD COLUMN IF NOT EXISTS firma_doctor          JSONB,
  ADD COLUMN IF NOT EXISTS consentimiento_aceptado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consentimiento_tipo    TEXT,    -- 'acido_hialuronico', 'botox', etc.
  ADD COLUMN IF NOT EXISTS consentimiento_payload JSONB,   -- snapshot completo del formulario
  ADD COLUMN IF NOT EXISTS consentimiento_fecha   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edad                   INTEGER,
  ADD COLUMN IF NOT EXISTS txp                    BOOLEAN, -- tratamiento previo Sí/No
  ADD COLUMN IF NOT EXISTS tx_realizar            TEXT,    -- "Tratamiento por realizar Tx: ___"
  ADD COLUMN IF NOT EXISTS doctor_nombre          TEXT,
  ADD COLUMN IF NOT EXISTS dispositivo            TEXT,    -- 'tablet', 'mobile', 'desktop'
  ADD COLUMN IF NOT EXISTS user_agent             TEXT,
  ADD COLUMN IF NOT EXISTS paciente_origen        TEXT,    -- 'wpp' | 'fbig' | 'manual'
  ADD COLUMN IF NOT EXISTS como_nos_conocio       TEXT;    -- canal de adquisición ('Instagram', 'Recomendación', etc.)

COMMENT ON COLUMN healup_medical_history.firma_doctor
  IS '{ url: dataURL base64, fecha: ISO timestamp, nombre: string }';
COMMENT ON COLUMN healup_medical_history.firma_paciente
  IS '{ url: dataURL base64, fecha: ISO timestamp, dispositivo: string }';
COMMENT ON COLUMN healup_medical_history.consentimiento_payload
  IS 'Snapshot del formulario: { titulo, texto_completo, riesgos, compromiso, datos_personales }';

-- Índice opcional para consultas por consentimiento aceptado + fecha
CREATE INDEX IF NOT EXISTS idx_healup_mh_consentimiento_fecha
  ON healup_medical_history (consentimiento_fecha DESC)
  WHERE consentimiento_aceptado = TRUE;

-- =====================================================================
-- ROLLBACK (revertir todo)
-- =====================================================================
-- ALTER TABLE healup_medical_history
--   DROP COLUMN IF EXISTS firma_doctor,
--   DROP COLUMN IF EXISTS consentimiento_aceptado,
--   DROP COLUMN IF EXISTS consentimiento_tipo,
--   DROP COLUMN IF EXISTS consentimiento_payload,
--   DROP COLUMN IF EXISTS consentimiento_fecha,
--   DROP COLUMN IF EXISTS edad,
--   DROP COLUMN IF EXISTS txp,
--   DROP COLUMN IF EXISTS tx_realizar,
--   DROP COLUMN IF EXISTS doctor_nombre,
--   DROP COLUMN IF EXISTS dispositivo,
--   DROP COLUMN IF EXISTS user_agent,
--   DROP COLUMN IF EXISTS paciente_origen,
--   DROP COLUMN IF EXISTS como_nos_conocio;
-- DROP INDEX IF EXISTS idx_healup_mh_consentimiento_fecha;
