-- ══════════════════════════════════════════════════════════════════════════
-- GATWICK — Emergencias reportadas por LLAMADA (Retell AI)
--
-- Correr UNA VEZ en Supabase (SQL Editor). Es idempotente: se puede volver a
-- ejecutar sin romper nada ni borrar datos.
--
-- Cubre:
--   1. retell_llamadas_GATWICK — la tabla que los endpoints de Retell ya usan
--      pero que nunca se creó por SQL.
--   2. Columnas de trazabilidad en gatwick_emergencias para saber que una
--      emergencia entró por teléfono y de qué llamada vino.
-- ══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
-- 1. Historial de llamadas de Retell
--    La escribe  POST /api/retell/gatwick-llamada  (custom function + webhook
--    post-call) y la lee  GET /api/retell/gatwick-llamada  y el inbound webhook
--    para darle contexto al bot cuando el mismo número vuelve a llamar.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."retell_llamadas_GATWICK" (
  id             TEXT PRIMARY KEY,            -- call_id de Retell
  sesion_id      TEXT,                        -- from_number (teléfono del cliente)
  transcripcion  TEXT,
  resumen        TEXT,                        -- call_analysis.call_summary
  duracion_seg   INTEGER,
  grabacion_url  TEXT,
  estado         TEXT,                        -- disconnection_reason / call_status
  payload        JSONB,                       -- el evento completo de Retell
  creado_en      TIMESTAMPTZ DEFAULT NOW()
);

-- Por si la tabla ya existía con menos columnas
ALTER TABLE public."retell_llamadas_GATWICK"
  ADD COLUMN IF NOT EXISTS sesion_id     TEXT,
  ADD COLUMN IF NOT EXISTS transcripcion TEXT,
  ADD COLUMN IF NOT EXISTS resumen       TEXT,
  ADD COLUMN IF NOT EXISTS duracion_seg  INTEGER,
  ADD COLUMN IF NOT EXISTS grabacion_url TEXT,
  ADD COLUMN IF NOT EXISTS estado        TEXT,
  ADD COLUMN IF NOT EXISTS payload       JSONB,
  ADD COLUMN IF NOT EXISTS creado_en     TIMESTAMPTZ DEFAULT NOW();

-- El GET filtra por sesion_id + creado_en (contexto de las últimas 24 h)
CREATE INDEX IF NOT EXISTS idx_retell_gatwick_sesion
  ON public."retell_llamadas_GATWICK" (sesion_id, creado_en DESC);

ALTER TABLE public."retell_llamadas_GATWICK" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_all_retell_llamadas_gatwick" ON public."retell_llamadas_GATWICK"
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  -- Igual que el resto del proyecto: anon con acceso total (el dashboard lee con anon).
  CREATE POLICY "anon_all_retell_llamadas_gatwick" ON public."retell_llamadas_GATWICK"
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public."retell_llamadas_GATWICK" IS
  'Llamadas del agente de voz Gatwick (Retell). Alimenta el contexto de "ya llamó antes".';


-- ──────────────────────────────────────────────────────────────────────────
-- 2. Trazabilidad del origen en las emergencias
--    Permite distinguir en el monitor una emergencia creada a mano de una que
--    entró por la línea telefónica, y volver a la llamada que la originó.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gatwick_emergencias
  ADD COLUMN IF NOT EXISTS origen             TEXT DEFAULT 'manual',  -- manual | llamada | whatsapp
  ADD COLUMN IF NOT EXISTS call_id            TEXT,                   -- FK lógica a retell_llamadas_GATWICK.id
  ADD COLUMN IF NOT EXISTS telefono_origen    TEXT,                   -- número desde el que llamaron
  ADD COLUMN IF NOT EXISTS contacto_nombre    TEXT,                   -- quién reporta
  ADD COLUMN IF NOT EXISTS tipo_atrapado      TEXT,                   -- persona | vehículo | mascota
  ADD COLUMN IF NOT EXISTS cantidad_atrapados INTEGER,
  ADD COLUMN IF NOT EXISTS critico            BOOLEAN DEFAULT FALSE;  -- fuego, humo, herido…

-- El endpoint deduplica por call_id dentro de una ventana de tiempo:
-- si el bot llama dos veces a la tool en la misma llamada, no se crean dos emergencias.
CREATE INDEX IF NOT EXISTS idx_gatwick_emerg_call_id
  ON public.gatwick_emergencias (call_id) WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gatwick_emerg_origen
  ON public.gatwick_emergencias (origen, created_at DESC);

COMMENT ON COLUMN public.gatwick_emergencias.origen IS
  'Cómo entró la emergencia: manual (monitor), llamada (Retell) o whatsapp.';


-- ──────────────────────────────────────────────────────────────────────────
-- 3. Verificación rápida (opcional)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'gatwick_emergencias'
--    AND column_name IN ('origen','call_id','telefono_origen','contacto_nombre',
--                        'tipo_atrapado','cantidad_atrapados','critico')
--  ORDER BY column_name;
--
-- SELECT COUNT(*) FROM public."retell_llamadas_GATWICK";
