-- ══════════════════════════════════════════════════════════════════
-- HEALUP — Migración: Agregar columnas sku y grupo a healup_procedures
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Agregar columnas
ALTER TABLE healup_procedures ADD COLUMN IF NOT EXISTS sku   TEXT;
ALTER TABLE healup_procedures ADD COLUMN IF NOT EXISTS grupo TEXT;

-- ──────────────────────────────────────────────────────────────────
-- 2. FACIAL BASICO
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-001' WHERE id=24; -- Facial Glass Skin Babe (SIMPLE)
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-002' WHERE id=25; -- Facial Glass Skin Babe (SIMPLE) PROMO
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-003' WHERE id=26; -- Facial Calmbabe (Medio)
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-004' WHERE id=27; -- Facial Calmbabe (Medio) PROMO
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-005' WHERE id=28; -- Facial Pure Babe Skin (TOP)
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-006' WHERE id=29; -- Facial Pure Babe Skin (TOP) PROMO
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-007' WHERE id=30; -- Facial Heal Up babe ritual
UPDATE healup_procedures SET grupo='FACIAL BASICO',        sku='FB-008' WHERE id=31; -- Facial Heal Up babe ritual PROMO

-- ──────────────────────────────────────────────────────────────────
-- 3. FACIAL PREMIUM
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='FACIAL PREMIUM',       sku='FP-001' WHERE id=70; -- Prime Skin Clean
UPDATE healup_procedures SET grupo='FACIAL PREMIUM',       sku='FP-002' WHERE id=71; -- Eternal Glow Boost
UPDATE healup_procedures SET grupo='FACIAL PREMIUM',       sku='FP-003' WHERE id=72; -- Prestige Glow Ritual
UPDATE healup_procedures SET grupo='FACIAL PREMIUM',       sku='FP-004' WHERE id=73; -- Heal Up Signature Glow
UPDATE healup_procedures SET grupo='FACIAL PREMIUM',       sku='FP-005' WHERE id=93; -- Cocktail Vitamina C

-- ──────────────────────────────────────────────────────────────────
-- 4. TRAT. MEDICO FACIAL
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-001' WHERE id=32; -- Exoxomas + Esperma de salmón
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-002' WHERE id=62; -- NCTF
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-003' WHERE id=63; -- PRP 1 sesión
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-004' WHERE id=64; -- PRP 2 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-005' WHERE id=65; -- PRP 3 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-006' WHERE id=66; -- PRP 4 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-007' WHERE id=67; -- Exoxomas 3 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-008' WHERE id=68; -- NCTF 2 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-009' WHERE id=69; -- NCTF 3 sesiones
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-010' WHERE id=90; -- Ácido Hialurónico para Ojeras
UPDATE healup_procedures SET grupo='TRAT. MEDICO FACIAL',  sku='TMF-011' WHERE id=92; -- Retiro de ácido (Hialuronidasa)

-- ──────────────────────────────────────────────────────────────────
-- 5. MEDICINA ESTETICA
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-001' WHERE id=4;  -- Baby botox
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-002' WHERE id=10; -- Bratz 30%
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-003' WHERE id=11; -- Natural 30%
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-004' WHERE id=15; -- Rinomodelacion 20%
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-005' WHERE id=17; -- Perfilamiento 20%
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-006' WHERE id=18; -- Hidralips
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-007' WHERE id=19; -- Pack 1
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-008' WHERE id=20; -- Pack 2
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-009' WHERE id=21; -- Pack 3
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-010' WHERE id=22; -- Pack 4
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-011' WHERE id=23; -- Pack Heal Up
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-012' WHERE id=33; -- #Duo1
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-013' WHERE id=34; -- #DUO2
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-014' WHERE id=35; -- #DUO3
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-015' WHERE id=36; -- #DUO4
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-016' WHERE id=37; -- #DUO5
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-017' WHERE id=38; -- #DUO6
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-018' WHERE id=39; -- #DUO7
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-019' WHERE id=40; -- 2X1 Party botox baby
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-020' WHERE id=46; -- Masseter Botox
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-021' WHERE id=53; -- Proyección de mentón
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-022' WHERE id=56; -- Micropigmentacion labios
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-023' WHERE id=57; -- Surcos nasogenianos
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-024' WHERE id=58; -- Sustentación pómular
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-025' WHERE id=59; -- Botox full face
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-026' WHERE id=60; -- Barbie Botox
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-027' WHERE id=61; -- Marcación Mandibular
UPDATE healup_procedures SET grupo='MEDICINA ESTETICA',    sku='ME-028' WHERE id=89; -- 2x1 Party botox full face

-- ──────────────────────────────────────────────────────────────────
-- 6. LIPO PAPADA ENZIMÁTICO
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='LIPO PAPADA ENZIMÁTICO', sku='LPE-001' WHERE id=54; -- 2da gen 1 sesión
UPDATE healup_procedures SET grupo='LIPO PAPADA ENZIMÁTICO', sku='LPE-002' WHERE id=55; -- 1ra gen 6 sesiones
UPDATE healup_procedures SET grupo='LIPO PAPADA ENZIMÁTICO', sku='LPE-003' WHERE id=91; -- 1ra gen 1 sesión

-- ──────────────────────────────────────────────────────────────────
-- 7. HIFU 22D
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='HIFU 22D',             sku='H22-001' WHERE id=48; -- 1 Zona Facial
UPDATE healup_procedures SET grupo='HIFU 22D',             sku='H22-002' WHERE id=49; -- Rostro Completo
UPDATE healup_procedures SET grupo='HIFU 22D',             sku='H22-003' WHERE id=50; -- Corporal 1 Zona
UPDATE healup_procedures SET grupo='HIFU 22D',             sku='H22-004' WHERE id=51; -- Abdomen
UPDATE healup_procedures SET grupo='HIFU 22D',             sku='H22-005' WHERE id=52; -- Espalda

-- ──────────────────────────────────────────────────────────────────
-- 8. CARBOXITERAPIA
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='CARBOXITERAPIA',       sku='CRX-001' WHERE id=74; -- Ojeras 1 sesión
UPDATE healup_procedures SET grupo='CARBOXITERAPIA',       sku='CRX-002' WHERE id=75; -- Ojeras 3 sesiones
UPDATE healup_procedures SET grupo='CARBOXITERAPIA',       sku='CRX-003' WHERE id=76; -- Ojeras 4 sesiones
UPDATE healup_procedures SET grupo='CARBOXITERAPIA',       sku='CRX-004' WHERE id=77; -- Ojeras 6 sesiones

-- ──────────────────────────────────────────────────────────────────
-- 9. CORPORAL REDUCCION
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='CORPORAL REDUCCION',   sku='CRD-001' WHERE id=78; -- Lipo start 3 ses
UPDATE healup_procedures SET grupo='CORPORAL REDUCCION',   sku='CRD-002' WHERE id=79; -- Lipo sculpt 5 ses
UPDATE healup_procedures SET grupo='CORPORAL REDUCCION',   sku='CRD-003' WHERE id=80; -- Lipo intensive 8 ses
UPDATE healup_procedures SET grupo='CORPORAL REDUCCION',   sku='CRD-004' WHERE id=81; -- Heal Up lipo 360

-- ──────────────────────────────────────────────────────────────────
-- 10. CORPORAL GLUTEOS
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='CORPORAL GLUTEOS',     sku='CGL-001' WHERE id=82; -- Glow booty 3 ses
UPDATE healup_procedures SET grupo='CORPORAL GLUTEOS',     sku='CGL-002' WHERE id=83; -- Sculpt booty 4 ses
UPDATE healup_procedures SET grupo='CORPORAL GLUTEOS',     sku='CGL-003' WHERE id=84; -- Power booty 5 ses

-- ──────────────────────────────────────────────────────────────────
-- 11. CORPORAL REAFIRMACION
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='CORPORAL REAFIRMACION', sku='CRF-001' WHERE id=85; -- Reafirm Body 4 ses
UPDATE healup_procedures SET grupo='CORPORAL REAFIRMACION', sku='CRF-002' WHERE id=86; -- Reafirm Body 6 ses
UPDATE healup_procedures SET grupo='CORPORAL REAFIRMACION', sku='CRF-003' WHERE id=87; -- Reafirm Body 8 ses
UPDATE healup_procedures SET grupo='CORPORAL REAFIRMACION', sku='CRF-004' WHERE id=88; -- Reafirm Body 10 ses

-- ──────────────────────────────────────────────────────────────────
-- 12. RESERVAS
-- ──────────────────────────────────────────────────────────────────
UPDATE healup_procedures SET grupo='RESERVAS',             sku='RES-001' WHERE id=41; -- reserva facial y/o corporal
UPDATE healup_procedures SET grupo='RESERVAS',             sku='RES-002' WHERE id=42; -- reserva armonizacion

-- Verificar resultado
SELECT id, sku, grupo, name FROM healup_procedures ORDER BY grupo, sku;
