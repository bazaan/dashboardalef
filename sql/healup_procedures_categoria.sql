-- =====================================================================
-- 2.6 Catálogo procedimientos — categoria + activo + seed
-- =====================================================================
-- Idempotente y reversible. Solo ADD COLUMN. NO toca data existente.
-- =====================================================================

ALTER TABLE healup_procedures
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS activo    BOOLEAN DEFAULT TRUE;

ALTER TABLE healup_procedures
  DROP CONSTRAINT IF EXISTS healup_procedures_categoria_check;
ALTER TABLE healup_procedures
  ADD CONSTRAINT healup_procedures_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('PAC','BOTOX','RELLENO','ENZIMAS','RETIRO','CONSULTA','OTROS'));

-- Backfill seguro (solo donde categoria IS NULL)
UPDATE healup_procedures SET categoria = 'BOTOX'
  WHERE categoria IS NULL AND (LOWER(name) LIKE '%botox%' OR LOWER(name) LIKE '%toxina%');
UPDATE healup_procedures SET categoria = 'RELLENO'
  WHERE categoria IS NULL AND (LOWER(name) LIKE '%hialur%' OR LOWER(name) LIKE '%relleno%' OR LOWER(name) LIKE '%lips%' OR LOWER(name) LIKE '%natural lip%');
UPDATE healup_procedures SET categoria = 'RETIRO'
  WHERE categoria IS NULL AND LOWER(name) LIKE '%retiro%';
UPDATE healup_procedures SET categoria = 'ENZIMAS'
  WHERE categoria IS NULL AND LOWER(name) LIKE '%enzima%';
UPDATE healup_procedures SET categoria = 'CONSULTA'
  WHERE categoria IS NULL AND (tipo = 'consulta' OR LOWER(name) LIKE '%consulta%');
UPDATE healup_procedures SET categoria = 'PAC'
  WHERE categoria IS NULL AND (LOWER(name) LIKE 'pac %' OR LOWER(name) LIKE 'pac1%' OR LOWER(name) LIKE 'pac2%' OR LOWER(name) LIKE 'pac3%');
UPDATE healup_procedures SET categoria = 'OTROS' WHERE categoria IS NULL;

CREATE INDEX IF NOT EXISTS idx_healup_procedures_categoria
  ON healup_procedures (categoria) WHERE activo IS NOT FALSE;
CREATE INDEX IF NOT EXISTS idx_healup_procedures_activo
  ON healup_procedures (activo);

-- Seed: procedimientos del prompt de mayo si no existen (no-op si ya están)
INSERT INTO healup_procedures (name, sku, grupo, price, tipo, cabina, categoria, activo)
SELECT * FROM (VALUES
  ('PAC1',                       'PAC-001', 'TRAT. MEDICO FACIAL', 350.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('PAC2',                       'PAC-002', 'TRAT. MEDICO FACIAL', 450.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('PAC3',                       'PAC-003', 'TRAT. MEDICO FACIAL', 550.00, 'procedimiento', 'cabina1', 'PAC',      true),
  ('Retiro de Hialurónico',      'ME-RH01', 'MEDICINA ESTETICA',   350.00, 'procedimiento', 'cabina1', 'RETIRO',   true),
  ('Calm Vape',                  'FB-CV01', 'FACIAL BASICO',       180.00, 'procedimiento', 'cabina2', 'OTROS',    true),
  ('Sustentación Pomular',       'ME-SP01', 'MEDICINA ESTETICA',  1200.00, 'procedimiento', 'cabina1', 'RELLENO',  true),
  ('Limpieza Facial',            'FB-LF01', 'FACIAL BASICO',       120.00, 'procedimiento', 'cabina2', 'OTROS',    true)
) AS new_proc(name, sku, grupo, price, tipo, cabina, categoria, activo)
WHERE NOT EXISTS (SELECT 1 FROM healup_procedures hp WHERE hp.sku = new_proc.sku);

-- ROLLBACK:
-- ALTER TABLE healup_procedures DROP COLUMN IF EXISTS categoria, DROP COLUMN IF EXISTS activo;
-- DELETE FROM healup_procedures WHERE sku IN ('PAC-001','PAC-002','PAC-003','ME-RH01','FB-CV01','ME-SP01','FB-LF01');
