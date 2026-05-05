-- =====================================================================
-- 2.4 Egresos categorizados — Healup (mayo 2026 v2)
-- =====================================================================
-- ADD COLUMN solamente. Los campos viejos (tipo_egreso, precio, cantidad)
-- siguen funcionando intactos. La UI nueva escribe en paralelo a los
-- nuevos campos sin tocar los legacy.
--
-- Idempotente: se puede correr múltiples veces sin efecto.
-- Reversible: ver bloque "ROLLBACK" al final.
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

-- Constraints (drop+add para idempotencia segura)
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

-- Backfill seguro: infiere categoría desde tipo_egreso/nombre legacy.
-- Solo actualiza filas donde categoria es NULL (no sobrescribe).
UPDATE egresos_healup SET categoria = 'INSUMOS'
  WHERE categoria IS NULL AND (
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%insumo%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%botox%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%toxina%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%hialur%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%aguja%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%jeringa%'
  );

UPDATE egresos_healup SET categoria = 'DELIVERY'
  WHERE categoria IS NULL AND (
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%delivery%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%delivery%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%env%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%motoriz%'
  );

UPDATE egresos_healup SET categoria = 'MARKETING'
  WHERE categoria IS NULL AND (
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%market%' OR
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%public%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%meta%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%tiktok%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%contenido%' OR
    LOWER(COALESCE(nombre,'')) LIKE '%foto%'
  );

UPDATE egresos_healup SET categoria = 'MANTENIMIENTO'
  WHERE categoria IS NULL AND (
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%mantenim%' OR
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%limpie%'
  );

UPDATE egresos_healup SET categoria = 'SUELDOS'
  WHERE categoria IS NULL AND (
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%suel%' OR
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%honorar%' OR
    LOWER(COALESCE(tipo_egreso,'')) LIKE '%pago%a%'
  );

UPDATE egresos_healup SET categoria = 'OTROS'
  WHERE categoria IS NULL;

-- Índices ligeros (solo para reportes filtrados)
CREATE INDEX IF NOT EXISTS idx_egresos_healup_categoria
  ON egresos_healup (categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_egresos_healup_metodo_pago
  ON egresos_healup (metodo_pago) WHERE deleted_at IS NULL;

-- Reportar
DO $$
DECLARE
  total INTEGER;
  con_cat INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM egresos_healup;
  SELECT COUNT(*) INTO con_cat FROM egresos_healup WHERE categoria IS NOT NULL;
  RAISE NOTICE 'Egresos: % filas total, % con categoría asignada', total, con_cat;
END $$;

-- =====================================================================
-- ROLLBACK (correr solo si querés deshacer la migración):
--
-- ALTER TABLE egresos_healup
--   DROP COLUMN IF EXISTS categoria,
--   DROP COLUMN IF EXISTS metodo_pago,
--   DROP COLUMN IF EXISTS referencia,
--   DROP COLUMN IF EXISTS producto,
--   DROP COLUMN IF EXISTS unidad,
--   DROP COLUMN IF EXISTS precio_unitario,
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS descartado;
-- =====================================================================
