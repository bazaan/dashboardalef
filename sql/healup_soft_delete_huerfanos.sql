-- =====================================================================
-- Soft-delete de pacientes huérfanos / de prueba con fecha 1 de enero
-- =====================================================================
-- Marca deleted_at en registros que claramente son data de prueba o
-- imports rotos (Yasmina, José, etc.) cuya fecha_agendamiento es
-- 2026-01-01 y/o cuyo nombre es null o vacío.
--
-- NO elimina físicamente — solo marca para que la UI los oculte.
-- Reversible: UPDATE ... SET deleted_at = NULL WHERE ...
-- =====================================================================

-- Asegurar que la columna exista en ambas tablas de pacientes
ALTER TABLE "PacientesBDwppHEALUP"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE "PacientesBDfbigHEALUP"
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Soft-delete de pacientes WPP con fecha_agendamiento 1 de enero o nombres null/test
UPDATE "PacientesBDwppHEALUP"
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND (
    fecha_agendamiento LIKE '2026-01-01%'
    OR nombre IS NULL
    OR TRIM(nombre) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
  );

UPDATE "PacientesBDfbigHEALUP"
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND (
    fecha_agendamiento LIKE '2026-01-01%'
    OR nombre IS NULL
    OR TRIM(nombre) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
  );

-- Reportar cuántos quedaron marcados
DO $$
DECLARE
  n_wpp INTEGER;
  n_fbig INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_wpp  FROM "PacientesBDwppHEALUP"  WHERE deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO n_fbig FROM "PacientesBDfbigHEALUP" WHERE deleted_at IS NOT NULL;
  RAISE NOTICE 'Soft-delete aplicado: % en WPP, % en FB/IG. Total: %', n_wpp, n_fbig, n_wpp + n_fbig;
END $$;

CREATE INDEX IF NOT EXISTS idx_pacientes_wpp_active
  ON "PacientesBDwppHEALUP" (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pacientes_fbig_active
  ON "PacientesBDfbigHEALUP" (id) WHERE deleted_at IS NULL;
