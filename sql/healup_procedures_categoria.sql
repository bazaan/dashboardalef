-- =====================================================================
-- 2.6 Catálogo de procedimientos — categoría + activo
-- =====================================================================
-- Agrega `categoria` (enum-like) y `activo` (bool) al catálogo existente.
-- El campo `grupo` se mantiene como granularidad fina (FACIAL BASICO,
-- MEDICINA ESTETICA, etc.) y `categoria` agrupa a nivel macro:
--   PAC, BOTOX, RELLENO, ENZIMAS, RETIRO, CONSULTA, OTROS
--
-- Idempotente y reversible.
-- =====================================================================

ALTER TABLE healup_procedures
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS activo    BOOLEAN DEFAULT TRUE;

ALTER TABLE healup_procedures
  DROP CONSTRAINT IF EXISTS healup_procedures_categoria_check;
ALTER TABLE healup_procedures
  ADD CONSTRAINT healup_procedures_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('PAC','BOTOX','RELLENO','ENZIMAS','RETIRO','CONSULTA','OTROS'));

-- Inferencia inicial desde `grupo` y `name` cuando categoria está null
UPDATE healup_procedures SET categoria = 'BOTOX'
  WHERE categoria IS NULL AND (LOWER(name) ILIKE '%botox%' OR LOWER(name) ILIKE '%toxina%');

UPDATE healup_procedures SET categoria = 'RELLENO'
  WHERE categoria IS NULL AND (LOWER(name) ILIKE '%hialur%' OR LOWER(name) ILIKE '%relleno%' OR LOWER(name) ILIKE '%natural lips%' OR LOWER(name) ILIKE '%lip%');

UPDATE healup_procedures SET categoria = 'RETIRO'
  WHERE categoria IS NULL AND LOWER(name) ILIKE '%retiro%';

UPDATE healup_procedures SET categoria = 'ENZIMAS'
  WHERE categoria IS NULL AND LOWER(name) ILIKE '%enzima%';

UPDATE healup_procedures SET categoria = 'CONSULTA'
  WHERE categoria IS NULL AND (tipo = 'consulta' OR LOWER(name) ILIKE '%consulta%');

UPDATE healup_procedures SET categoria = 'PAC'
  WHERE categoria IS NULL AND (LOWER(name) ILIKE '%pac %' OR LOWER(name) LIKE 'pac1%' OR LOWER(name) LIKE 'pac2%' OR LOWER(name) LIKE 'pac3%');

UPDATE healup_procedures SET categoria = 'OTROS'
  WHERE categoria IS NULL;

CREATE INDEX IF NOT EXISTS idx_healup_procedures_categoria
  ON healup_procedures (categoria) WHERE activo IS NOT FALSE;
CREATE INDEX IF NOT EXISTS idx_healup_procedures_activo
  ON healup_procedures (activo);

COMMENT ON COLUMN healup_procedures.categoria IS 'Macro categoría: PAC | BOTOX | RELLENO | ENZIMAS | RETIRO | CONSULTA | OTROS';
COMMENT ON COLUMN healup_procedures.activo    IS 'false = procedimiento descontinuado, no aparece en autocomplete';

-- =====================================================================
-- Seed: agregar procedimientos del prompt si no existen
-- =====================================================================
INSERT INTO healup_procedures (name, sku, grupo, price, tipo, cabina, categoria, activo)
SELECT * FROM (VALUES
  ('PAC1',                       'PAC-001', 'TRAT. MEDICO FACIAL', 350.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('PAC2',                       'PAC-002', 'TRAT. MEDICO FACIAL', 450.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('PAC3',                       'PAC-003', 'TRAT. MEDICO FACIAL', 550.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('Retiro de Hialurónico',      'ME-RH01', 'MEDICINA ESTETICA',   350.00, 'procedimiento', 'cabina1', 'RETIRO',   true),
  ('Calm Vape',                  'FB-CV01', 'FACIAL BASICO',       180.00, 'procedimiento', 'cabina2', 'OTROS',    true),
  ('Sustentación Pomular',       'ME-SP01', 'MEDICINA ESTETICA',   1200.00,'procedimiento', 'cabina1', 'RELLENO',  true),
  ('Limpieza Facial',            'FB-LF01', 'FACIAL BASICO',       120.00, 'procedimiento', 'cabina2', 'OTROS',    true),
  ('Consulta Médica',            'CON-001', 'MEDICINA ESTETICA',   42.37,  'consulta',      'cabina1', 'CONSULTA', true)
) AS new_proc(name, sku, grupo, price, tipo, cabina, categoria, activo)
WHERE NOT EXISTS (
  SELECT 1 FROM healup_procedures hp WHERE hp.sku = new_proc.sku
);
