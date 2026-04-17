-- ══════════════════════════════════════════════════════════════════
-- HEALUP — Vinculación Reserva ↔ Factura + Descuento de Stock por Receta
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. TABLAS DE PACIENTES — agregar booking_sku y procedure_id
-- ──────────────────────────────────────────────────────────────────

-- booking_sku: referencia única generada en el momento de la reserva
-- procedure_id: FK al procedimiento reservado (para precio y receta)
ALTER TABLE "PacientesBDwppHEALUP"  ADD COLUMN IF NOT EXISTS booking_sku   TEXT;
ALTER TABLE "PacientesBDwppHEALUP"  ADD COLUMN IF NOT EXISTS procedure_id  BIGINT;

ALTER TABLE "PacientesBDfbigHEALUP" ADD COLUMN IF NOT EXISTS booking_sku   TEXT;
ALTER TABLE "PacientesBDfbigHEALUP" ADD COLUMN IF NOT EXISTS procedure_id  BIGINT;

-- Índice para búsqueda rápida por SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_wpp_booking_sku  ON "PacientesBDwppHEALUP"  (booking_sku) WHERE booking_sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fbig_booking_sku ON "PacientesBDfbigHEALUP" (booking_sku) WHERE booking_sku IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. EVENTOS DE CALENDARIO — trazabilidad del descuento de insumos
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE healup_calendar_events ADD COLUMN IF NOT EXISTS stock_descontado     BOOLEAN    DEFAULT FALSE;
ALTER TABLE healup_calendar_events ADD COLUMN IF NOT EXISTS stock_descontado_en  TIMESTAMPTZ;
ALTER TABLE healup_calendar_events ADD COLUMN IF NOT EXISTS stock_descontado_por TEXT;

-- ──────────────────────────────────────────────────────────────────
-- 3. SECUENCIA Y FUNCIÓN para generar Booking SKU único
-- ──────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS healup_booking_seq START 1;

CREATE OR REPLACE FUNCTION healup_next_booking_sku()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Formato: B-YYYYMMDD-0001  (B = Booking, fecha Lima, secuencial de 4 dígitos)
  RETURN 'B-'
    || TO_CHAR(NOW() AT TIME ZONE 'America/Lima', 'YYYYMMDD')
    || '-'
    || LPAD(nextval('healup_booking_seq')::TEXT, 4, '0');
END;
$$;

-- ──────────────────────────────────────────────────────────────────
-- 4. VISTA: resumen de reservas pendientes de cobro
--    Útil para el panel de facturación — muestra SKU + deuda pendiente
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW healup_reservas_pendientes AS
SELECT
  'wpp'                                        AS fuente,
  p.id,
  p.booking_sku,
  p.nombre,
  p.dni,
  p.numero,
  p.procedimiento,
  p.procedure_id,
  p.precio                                     AS anticipo_pagado,
  p.precio_tratamiento                         AS saldo_pendiente,
  (COALESCE(p.precio, 0) + COALESCE(p.precio_tratamiento, 0)) AS precio_total_servicio,
  p.fecha_agendamiento,
  p.metodo_de_pago,
  p.estado,
  proc.sku                                     AS proc_sku,
  proc.grupo                                   AS proc_grupo,
  proc.price                                   AS proc_precio_lista
FROM "PacientesBDwppHEALUP" p
LEFT JOIN healup_procedures proc ON proc.id = p.procedure_id
WHERE p.booking_sku IS NOT NULL

UNION ALL

SELECT
  'fbig'                                       AS fuente,
  p.id,
  p.booking_sku,
  p.nombre,
  p.dni,
  p.instagram_handle                           AS numero,
  p.procedimiento,
  p.procedure_id,
  p.precio                                     AS anticipo_pagado,
  p.precio_tratamiento                         AS saldo_pendiente,
  (COALESCE(p.precio, 0) + COALESCE(p.precio_tratamiento, 0)) AS precio_total_servicio,
  p.fecha_agendamiento,
  p.metodo_de_pago,
  p.estado,
  proc.sku                                     AS proc_sku,
  proc.grupo                                   AS proc_grupo,
  proc.price                                   AS proc_precio_lista
FROM "PacientesBDfbigHEALUP" p
LEFT JOIN healup_procedures proc ON proc.id = p.procedure_id
WHERE p.booking_sku IS NOT NULL

ORDER BY fecha_agendamiento DESC NULLS LAST;

-- ──────────────────────────────────────────────────────────────────
-- Verificación
-- ──────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'PacientesBDwppHEALUP'
  AND column_name IN ('booking_sku', 'procedure_id')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'healup_calendar_events'
  AND column_name IN ('stock_descontado', 'stock_descontado_en', 'stock_descontado_por')
ORDER BY column_name;

-- ──────────────────────────────────────────────────────────────────
-- 5. CABINAS — columna en calendar_events y working_hours
-- ──────────────────────────────────────────────────────────────────

-- cabina1 = Doctora Valeria (armonización facial: botox, rellenos, médico)
-- cabina2 = Cosmiatra (faciales, corporales, HIFU)
ALTER TABLE healup_calendar_events
  ADD COLUMN IF NOT EXISTS cabina TEXT DEFAULT 'cabina1'
    CHECK (cabina IN ('cabina1', 'cabina2'));

-- Horario independiente por cabina
ALTER TABLE healup_working_hours
  ADD COLUMN IF NOT EXISTS cabina TEXT DEFAULT 'cabina1';

-- Crear fila de horario para cabina2 si no existe
INSERT INTO healup_working_hours (id, slot_duration_minutes, schedule_json, cabina)
VALUES (2, 30,
  '[{"day":1,"active":true,"start":"10:00","end":"20:00"},
    {"day":2,"active":true,"start":"10:00","end":"20:00"},
    {"day":3,"active":true,"start":"10:00","end":"20:00"},
    {"day":4,"active":true,"start":"10:00","end":"20:00"},
    {"day":5,"active":true,"start":"10:00","end":"20:00"},
    {"day":6,"active":true,"start":"10:00","end":"14:00"},
    {"day":0,"active":false,"start":"09:00","end":"18:00"}]'::jsonb,
  'cabina2')
ON CONFLICT (id) DO NOTHING;

UPDATE healup_working_hours SET cabina = 'cabina1' WHERE id = 1 AND cabina IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 6. PROCEDIMIENTOS — columna cabina para asignación explícita
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE healup_procedures
  ADD COLUMN IF NOT EXISTS cabina TEXT DEFAULT 'cabina1'
    CHECK (cabina IN ('cabina1', 'cabina2'));

-- Auto-poblar cabina según el grupo (ejecutar una sola vez)
UPDATE healup_procedures
SET cabina = 'cabina2'
WHERE UPPER(grupo) IN (
  'FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D',
  'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION', 'CARBOXITERAPIA'
)
AND cabina IS NULL OR cabina = 'cabina1';

UPDATE healup_procedures
SET cabina = 'cabina1'
WHERE cabina IS NULL;

-- Verificación
SELECT id, name, grupo, cabina
FROM healup_procedures
ORDER BY cabina, grupo, name
LIMIT 20;
