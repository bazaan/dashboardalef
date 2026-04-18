-- ══════════════════════════════════════════════════════════════════
-- HEALUP — Flujo de Cobro de Atención (Boleta Consulta + Procedimiento)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. Agregar tipo a healup_procedures
--    'consulta' | 'procedimiento' | 'producto'
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE healup_procedures
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'procedimiento'
  CHECK (tipo IN ('consulta', 'procedimiento', 'producto'));

-- Clasificar existentes como procedimiento
UPDATE healup_procedures SET tipo = 'procedimiento' WHERE tipo IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. Insertar el item fijo de Consulta Médica
--    price = 42.37 = 50/1.18  (valor_unitario sin IGV)
--    Total con IGV 18% = S/ 50.00
-- ──────────────────────────────────────────────────────────────────
INSERT INTO healup_procedures (name, price, sku, grupo, tipo)
VALUES ('Consulta Médica', 42.37, 'CON-001', 'CONSULTA', 'consulta')
ON CONFLICT DO NOTHING;

-- Si el SKU ya existe (por re-runs), actualizarlo:
UPDATE healup_procedures
SET name = 'Consulta Médica', price = 42.37, tipo = 'consulta', grupo = 'CONSULTA'
WHERE sku = 'CON-001';

-- ──────────────────────────────────────────────────────────────────
-- 3. Trazabilidad del flujo de cobro en calendar_events
--    Registra qué boletas se emitieron por cada cita
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE healup_calendar_events
  ADD COLUMN IF NOT EXISTS boleta_consulta_serie  TEXT,
  ADD COLUMN IF NOT EXISTS boleta_consulta_numero BIGINT,
  ADD COLUMN IF NOT EXISTS boleta_consulta_id     BIGINT,
  ADD COLUMN IF NOT EXISTS boleta_proc_serie      TEXT,
  ADD COLUMN IF NOT EXISTS boleta_proc_numero     BIGINT,
  ADD COLUMN IF NOT EXISTS boleta_proc_id         BIGINT,
  ADD COLUMN IF NOT EXISTS cobro_completado       BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────────
-- Verificación
-- ──────────────────────────────────────────────────────────────────
SELECT id, name, sku, grupo, tipo, price,
       ROUND(price * 1.18, 2) AS precio_con_igv
FROM healup_procedures
ORDER BY tipo, grupo, name
LIMIT 10;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'healup_calendar_events'
  AND column_name IN (
    'boleta_consulta_serie','boleta_consulta_numero','boleta_consulta_id',
    'boleta_proc_serie','boleta_proc_numero','boleta_proc_id','cobro_completado'
  )
ORDER BY column_name;
