-- ══════════════════════════════════════════════════════════════════════════
-- DAVILA — Simplificación de pre_reservas (Junio 2026)
--
-- La tool validar_pre_reserva se simplificó a 4 parámetros y ya NO maneja
-- datos personales. La tabla pre_reservas no necesita columnas extra.
--
-- Columnas a eliminar (la tabla real tenía estas de más respecto a la spec
-- final):
--   - metadata     → guardaba nombre_completo/tratamiento (eliminados)
--   - duracion_min → la tool ya no recibe duración (usa 60 min fijo en el código)
--
-- Estructura final de pre_reservas:
--   id, celular, pre_reserva_id, calendar_event_id, fecha, hora, estado,
--   created_at, expires_at, pagado_en, confirmado_en, cancelado_en
--
-- Idempotente: DROP COLUMN IF EXISTS no falla si ya no están.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pre_reservas
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS duracion_min;

-- Por si en algún momento se agregaron columnas de datos personales
-- (no estaban en la versión que creamos, pero por si acaso):
ALTER TABLE public.pre_reservas
  DROP COLUMN IF EXISTS nombre_completo,
  DROP COLUMN IF EXISTS tratamiento,
  DROP COLUMN IF EXISTS comprobante_valido,
  DROP COLUMN IF EXISTS monto_validado,
  DROP COLUMN IF EXISTS dni,
  DROP COLUMN IF EXISTS edad,
  DROP COLUMN IF EXISTS modalidad;

-- Verificación: debe listar solo las columnas finales
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pre_reservas'
ORDER BY ordinal_position;
