-- =====================================================================
-- Healup — Método y monto de reserva + procedimiento solicitado inicial
-- =====================================================================
-- Captura cómo el paciente pagó la reserva al agendar (YAPE / Plin /
-- Efectivo / Transferencia / Sin reserva), el monto cuando aplica, y
-- qué procedimiento pidió inicialmente. La idea es separar la intención
-- inicial del paciente del procedimiento finalmente registrado vía SKU.
--
-- Aplicar en Supabase SQL editor.
-- =====================================================================

ALTER TABLE healup_calendar_events
  ADD COLUMN IF NOT EXISTS metodo_reserva           TEXT,
  ADD COLUMN IF NOT EXISTS monto_reserva            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS procedimiento_solicitado TEXT;

COMMENT ON COLUMN healup_calendar_events.metodo_reserva
  IS 'Método de pago de la reserva: YAPE | Plin | Efectivo | Transferencia | Sin reserva';
COMMENT ON COLUMN healup_calendar_events.monto_reserva
  IS 'Monto pagado como reserva (solo cuando hubo pago anticipado)';
COMMENT ON COLUMN healup_calendar_events.procedimiento_solicitado
  IS 'Qué procedimiento pidió el paciente inicialmente al agendar (texto libre — distinto al SKU final)';

-- Índice ligero por método para reportes de cobranza por canal
CREATE INDEX IF NOT EXISTS idx_healup_calendar_events_metodo_reserva
  ON healup_calendar_events (metodo_reserva)
  WHERE metodo_reserva IS NOT NULL;
