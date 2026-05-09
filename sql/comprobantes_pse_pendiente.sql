-- =============================================================
-- MIGRACION: Sistema de boletas pendientes
-- Agrega estado a comprobantes_pse para permitir revision
-- antes de emitir a PSE.PE/SUNAT
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- =============================================================

-- 1. Agregar columna estado (pendiente, emitido, error)
ALTER TABLE comprobantes_pse
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'emitido'
  CHECK (estado IN ('pendiente', 'emitido', 'error'));

-- 2. Agregar columna para mensaje de error de emision
ALTER TABLE comprobantes_pse
  ADD COLUMN IF NOT EXISTS error_emision TEXT;

-- 3. Las boletas existentes ya estan emitidas, el default 'emitido' las cubre

-- 4. Indice para buscar pendientes rapido
CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_estado
  ON comprobantes_pse(company_id, estado)
  WHERE estado = 'pendiente';
