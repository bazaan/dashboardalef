-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Solicitudes · formularios: pestaña "ZAPPIER (Sin plataforma)" (28/09/2026)
--
-- Correr UNA vez en el SQL Editor de Supabase. Es idempotente. Va DESPUÉS de
-- sql/tradecars_formularios_sheets.sql.
--
-- Por qué existe: Trade Cars no tiene una hoja de Google por red social — tiene UNA sola hoja
-- de Zapier con Instagram, Facebook y TikTok juntos, y una columna PLATAFORMA que hoy está
-- vacía en todas las filas. Mientras esa columna no se llene, todo cae en un 4.º canal nuevo,
-- "sin_plataforma", que el código ya reparte solo según la columna PLATAFORMA de cada lead
-- (ver `canalDePlataforma()` en utils/tradecarsFormularios.ts). Esto solo agrega ese 4.º valor
-- a los CHECK de las dos tablas que ya creó sql/tradecars_formularios_sheets.sql y siembra su
-- fila en la config — no crea tablas nuevas.
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  restriccion_vieja TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tradecars_formularios_config'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%sin_plataforma%'
  ) THEN
    SELECT conname INTO restriccion_vieja FROM pg_constraint
    WHERE conrelid = 'public.tradecars_formularios_config'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%canal%';
    IF restriccion_vieja IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.tradecars_formularios_config DROP CONSTRAINT %I', restriccion_vieja);
    END IF;
    ALTER TABLE public.tradecars_formularios_config
      ADD CONSTRAINT tradecars_formularios_config_canal_check
      CHECK (canal IN ('ig', 'fb', 'tiktok', 'sin_plataforma'));
  END IF;
END $$;

DO $$
DECLARE
  restriccion_vieja TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tradecars_formularios_estado'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%sin_plataforma%'
  ) THEN
    SELECT conname INTO restriccion_vieja FROM pg_constraint
    WHERE conrelid = 'public.tradecars_formularios_estado'::regclass
      AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%canal%';
    IF restriccion_vieja IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.tradecars_formularios_estado DROP CONSTRAINT %I', restriccion_vieja);
    END IF;
    ALTER TABLE public.tradecars_formularios_estado
      ADD CONSTRAINT tradecars_formularios_estado_canal_check
      CHECK (canal IN ('ig', 'fb', 'tiktok', 'sin_plataforma'));
  END IF;
END $$;

INSERT INTO public.tradecars_formularios_config (canal)
VALUES ('sin_plataforma')
ON CONFLICT (canal) DO NOTHING;

-- Verificación rápida (opcional): deben salir 4 canales
-- SELECT canal, sheet_id FROM public.tradecars_formularios_config ORDER BY canal;
