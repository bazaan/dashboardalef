-- =====================================================================
-- 2.4 Egresos categorizados — Healup
-- =====================================================================
-- Agrega categoría enum, método de pago, referencia, soft-delete.
-- Para INSUMOS: producto, unidad, cantidad y precio_unitario.
--
-- Compatibilidad: tipo_egreso (TEXT libre) se mantiene como campo legacy.
-- La categoria nueva se rellena automaticamente al guardar via UI.
--
-- Idempotente y reversible.
-- =====================================================================

ALTER TABLE egresos_healup
  ADD COLUMN IF NOT EXISTS categoria       TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago     TEXT,
  ADD COLUMN IF NOT EXISTS referencia      TEXT,
  ADD COLUMN IF NOT EXISTS producto        TEXT,
  ADD COLUMN IF NOT EXISTS unidad          TEXT,
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS descartado      BOOLEAN DEFAULT FALSE;

-- Constraint para mantener valores válidos sin romper data legacy
ALTER TABLE egresos_healup
  DROP CONSTRAINT IF EXISTS egresos_healup_categoria_check;
ALTER TABLE egresos_healup
  ADD CONSTRAINT egresos_healup_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('INSUMOS','DELIVERY','MARKETING','MANTENIMIENTO','SUELDOS','OTROS'));

ALTER TABLE egresos_healup
  DROP CONSTRAINT IF EXISTS egresos_healup_metodo_pago_check;
ALTER TABLE egresos_healup
  ADD CONSTRAINT egresos_healup_metodo_pago_check
  CHECK (metodo_pago IS NULL OR metodo_pago IN ('EFECTIVO','YAPE','PLIN','TRANSFERENCIA','TARJETA_CREDITO','QR'));

COMMENT ON COLUMN egresos_healup.categoria       IS 'Categoría normalizada (INSUMOS, DELIVERY, MARKETING, MANTENIMIENTO, SUELDOS, OTROS)';
COMMENT ON COLUMN egresos_healup.metodo_pago     IS 'Cómo se pagó este egreso (EFECTIVO descuenta caja chica)';
COMMENT ON COLUMN egresos_healup.referencia      IS 'Voucher / # de transferencia / nota libre';
COMMENT ON COLUMN egresos_healup.producto        IS 'Solo INSUMOS: nombre del producto (ej. Toxina Botox)';
COMMENT ON COLUMN egresos_healup.unidad          IS 'Solo INSUMOS: unidad de medida (UI / ML / frascos)';
COMMENT ON COLUMN egresos_healup.precio_unitario IS 'Solo INSUMOS: precio por unidad (precio total = precio_unitario * cantidad)';
COMMENT ON COLUMN egresos_healup.deleted_at      IS 'Soft-delete — la fila no se muestra en UI cuando esto NO es null';
COMMENT ON COLUMN egresos_healup.descartado      IS 'Marcado para excluir de reportes (mantenimientos cargados por error, etc.)';

CREATE INDEX IF NOT EXISTS idx_egresos_healup_categoria
  ON egresos_healup (categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_egresos_healup_metodo_pago
  ON egresos_healup (metodo_pago) WHERE deleted_at IS NULL;
