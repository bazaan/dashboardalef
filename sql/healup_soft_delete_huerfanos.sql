-- =====================================================================
-- Soft-delete huérfanos / data de prueba con fecha "1 de enero" o nombre null
-- =====================================================================
-- Idempotente y reversible. NO elimina físicamente.
--
-- IMPORTANTE: ANTES DEL UPDATE, correr el SELECT de revisión para
-- ver qué filas serían marcadas. Si te parece OK, descomentar los UPDATE.
-- =====================================================================

-- 1. Agregar columna deleted_at si no existe (idempotente)
ALTER TABLE "PacientesBDwppHEALUP"  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE "PacientesBDfbigHEALUP" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Revisión PRIMERO (correr este SELECT y verificar antes del UPDATE)
SELECT 'WPP huérfanos:' AS tabla, COUNT(*) FROM "PacientesBDwppHEALUP"
  WHERE deleted_at IS NULL AND (
    fecha_agendamiento::text LIKE '2026-01-01%' OR
    nombre IS NULL OR
    TRIM(COALESCE(nombre,'')) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
  )
UNION ALL
SELECT 'FBIG huérfanos:', COUNT(*) FROM "PacientesBDfbigHEALUP"
  WHERE deleted_at IS NULL AND (
    fecha_agendamiento::text LIKE '2026-01-01%' OR
    nombre IS NULL OR
    TRIM(COALESCE(nombre,'')) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
  );

-- 3. UPDATES (DESCOMENTAR DESPUÉS DE REVISAR EL SELECT DE ARRIBA):
--
-- UPDATE "PacientesBDwppHEALUP"
-- SET deleted_at = NOW()
-- WHERE deleted_at IS NULL AND (
--   fecha_agendamiento::text LIKE '2026-01-01%' OR
--   nombre IS NULL OR
--   TRIM(COALESCE(nombre,'')) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
-- );
--
-- UPDATE "PacientesBDfbigHEALUP"
-- SET deleted_at = NOW()
-- WHERE deleted_at IS NULL AND (
--   fecha_agendamiento::text LIKE '2026-01-01%' OR
--   nombre IS NULL OR
--   TRIM(COALESCE(nombre,'')) IN ('', 'null', 'NULL', 'test', 'TEST', 'prueba', 'PRUEBA')
-- );

CREATE INDEX IF NOT EXISTS idx_pacientes_wpp_active
  ON "PacientesBDwppHEALUP" (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pacientes_fbig_active
  ON "PacientesBDfbigHEALUP" (id) WHERE deleted_at IS NULL;

-- ROLLBACK del soft-delete:
-- UPDATE "PacientesBDwppHEALUP"  SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
-- UPDATE "PacientesBDfbigHEALUP" SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
