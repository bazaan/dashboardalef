-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Funnel de Compras (reemplazo del Power BI)
--
-- Correr UNA VEZ en Supabase (SQL Editor). Es idempotente: se puede volver a
-- ejecutar sin romper nada ni borrar datos.
--
-- Implementa la minuta del 26/08/2026. Reemplaza el flujo actual
-- Excel -> Power BI: el asesor llena los campos en el CRM y el dashboard
-- calcula el funnel en tiempo real desde esta tabla.
--
-- Contenido:
--   1. tradecars_asesores          — catálogo de asesores (filtro del funnel)
--   2. tradecars_funnel_motivos    — catálogo de MOTIVO DE NO CITA (editable)
--   3. tradecars_funnel_leads      — tabla central del funnel
--   4. Columnas GENERATED          — etapa y fecha_funnel calculadas por la BD
--   5. Trigger anti-regresión      — un lead no retrocede desde CITA/ASISTIDA/CONCRETADA
--   6. Vista de resumen            — barras del embudo ya agregadas
-- ══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
-- 1. ASESORES
--    Alimenta el filtro "Asesor" del funnel. Editable desde el dashboard sin
--    tocar código: si entra un asesor nuevo, se agrega aquí.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_asesores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,        -- "Miguel C." — como aparece en el CRM
  email       TEXT,                        -- para cruzar con dashboardlogin
  telefono    TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  orden       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at  TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_asesores_activo
  ON public.tradecars_asesores (activo, orden) WHERE activo = TRUE;

COMMENT ON TABLE public.tradecars_asesores IS
  'Asesores de Trade Cars. Alimenta el filtro del funnel y la asignación de leads.';


-- ──────────────────────────────────────────────────────────────────────────
-- 2. MOTIVOS DE NO CITA
--    La minuta lo dejó "a definir": se modela como catálogo editable para que
--    el cliente lo arme sin pedir desarrollo. El dashboard agrupa por aquí.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_funnel_motivos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  motivo      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  orden       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Semilla inicial. El cliente puede editarla/ampliarla desde el dashboard.
INSERT INTO public.tradecars_funnel_motivos (motivo, orden) VALUES
  ('Precio ofrecido bajo',              1),
  ('Aún no decide vender',              2),
  ('Vendió por otro medio',             3),
  ('No responde / dejó de contestar',   4),
  ('Vehículo no cumple política',       5),
  ('Distancia / no puede acercarse',    6),
  ('Solo consultaba precio referencial',7),
  ('Otro',                              99)
ON CONFLICT (motivo) DO NOTHING;

COMMENT ON TABLE public.tradecars_funnel_motivos IS
  'Catálogo de MOTIVO DE NO CITA. Editable desde el dashboard (Módulo 3).';


-- ──────────────────────────────────────────────────────────────────────────
-- 3. LEADS DEL FUNNEL
--
--    Separada de GeneralBDwppTRADECARS a propósito: aquella guarda el lead
--    crudo que llega del bot; ésta guarda el trabajo comercial del asesor
--    sobre ese lead. Se enlazan por `lead_origen_id` + `lead_origen_tabla`.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_funnel_leads (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Datos que el CRM genera solo (el asesor no los llena) ──
  contacto_nombre      TEXT,
  contacto_telefono    TEXT,
  canal_origen         TEXT,          -- WhatsApp | Instagram | TikTok | Facebook
  asesor               TEXT,          -- nombre tal cual, para no romper si se borra el catálogo
  fecha_derivacion     DATE,          -- cuándo se asignó el lead al asesor

  -- Trazabilidad hacia Chatwoot (para el click "ir a la conversación")
  chatwoot_account_id       INTEGER,
  chatwoot_conversation_id  BIGINT,
  chatwoot_contact_id       BIGINT,

  -- Enlace al lead crudo del bot, si vino de ahí
  lead_origen_tabla    TEXT,          -- GeneralBDwppTRADECARS | GeneralBDfbigTRADECARS
  lead_origen_id       BIGINT,

  -- ── Campos que llena el ASESOR en el CRM ──
  perfil_coincide      TEXT,          -- SI | NO
  status               TEXT,          -- dropdown cerrado de 6 valores
  fecha_cita           DATE,          -- al marcar CITA o CITA ASISTIDA
  fecha_compra         DATE,          -- al marcar CONCRETADA
  motivo_no_cita       TEXT,          -- FK lógica a tradecars_funnel_motivos.motivo
  fecha_probable_venta DATE,          -- cuándo estima el cliente que vende
  proxima_accion       TEXT,          -- qué va a hacer el asesor
  fecha_seguimiento    DATE,          -- cuándo lo va a hacer

  observaciones        TEXT,

  created_at           TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at           TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Por si la tabla ya existía de una corrida anterior con menos columnas
ALTER TABLE public.tradecars_funnel_leads
  ADD COLUMN IF NOT EXISTS contacto_nombre      TEXT,
  ADD COLUMN IF NOT EXISTS contacto_telefono    TEXT,
  ADD COLUMN IF NOT EXISTS canal_origen         TEXT,
  ADD COLUMN IF NOT EXISTS asesor               TEXT,
  ADD COLUMN IF NOT EXISTS fecha_derivacion     DATE,
  ADD COLUMN IF NOT EXISTS chatwoot_account_id      INTEGER,
  ADD COLUMN IF NOT EXISTS chatwoot_conversation_id BIGINT,
  ADD COLUMN IF NOT EXISTS chatwoot_contact_id      BIGINT,
  ADD COLUMN IF NOT EXISTS lead_origen_tabla    TEXT,
  ADD COLUMN IF NOT EXISTS lead_origen_id       BIGINT,
  ADD COLUMN IF NOT EXISTS perfil_coincide      TEXT,
  ADD COLUMN IF NOT EXISTS status               TEXT,
  ADD COLUMN IF NOT EXISTS fecha_cita           DATE,
  ADD COLUMN IF NOT EXISTS fecha_compra         DATE,
  ADD COLUMN IF NOT EXISTS motivo_no_cita       TEXT,
  ADD COLUMN IF NOT EXISTS fecha_probable_venta DATE,
  ADD COLUMN IF NOT EXISTS proxima_accion       TEXT,
  ADD COLUMN IF NOT EXISTS fecha_seguimiento    DATE,
  ADD COLUMN IF NOT EXISTS observaciones        TEXT,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc', now());


-- ──────────────────────────────────────────────────────────────────────────
-- 4. COLUMNAS CALCULADAS (GENERATED STORED)
--
--    La etapa y la fecha del funnel las calcula la BASE DE DATOS, no la app.
--    Así el dashboard, un export a Excel o cualquier consulta directa siempre
--    ven el mismo número: no hay dos fuentes de verdad que se puedan desviar.
--    La misma lógica está en utils/tradecarsFunnel.ts para el cálculo en vivo.
-- ──────────────────────────────────────────────────────────────────────────

-- Se agregan sólo si no existen (ADD COLUMN IF NOT EXISTS no admite GENERATED
-- en todas las versiones, por eso el DO block con guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tradecars_funnel_leads' AND column_name = 'fecha_funnel'
  ) THEN
    ALTER TABLE public.tradecars_funnel_leads
      ADD COLUMN fecha_funnel DATE
      GENERATED ALWAYS AS (COALESCE(fecha_compra, fecha_cita, fecha_derivacion)) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tradecars_funnel_leads' AND column_name = 'etapa'
  ) THEN
    ALTER TABLE public.tradecars_funnel_leads
      ADD COLUMN etapa TEXT
      GENERATED ALWAYS AS (
        CASE
          -- PERFIL COINCIDE = NO -> se queda en LEADS sin importar el status
          WHEN translate(upper(btrim(COALESCE(perfil_coincide, ''))), 'ÁÉÍÓÚÜ', 'AEIOUU')
               NOT IN ('SI', 'YES', 'TRUE', '1')
            THEN 'LEADS'
          -- PERFIL = SI: la etapa la define el STATUS
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'NO CONTACTADO'  THEN 'CUMPLE POLITICA'
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'NO INTERESADO'  THEN 'CONTACTADO'
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'EN SEGUIMIENTO' THEN 'INTERESADOS'
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CITA'           THEN 'CITAS AGENDADAS'
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CITA ASISTIDA'  THEN 'CITAS ASISTIDAS'
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CONCRETADA'     THEN 'COMPRAS'
          -- PERFIL = SI con status vacío o no reconocido: fuera del funnel
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

-- Rank numérico de la etapa: hace que el conteo acumulativo del embudo sea
-- un simple "WHERE etapa_rank >= N" en vez de una lista de statuses por barra.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tradecars_funnel_leads' AND column_name = 'etapa_rank'
  ) THEN
    ALTER TABLE public.tradecars_funnel_leads
      ADD COLUMN etapa_rank SMALLINT
      GENERATED ALWAYS AS (
        CASE
          WHEN translate(upper(btrim(COALESCE(perfil_coincide, ''))), 'ÁÉÍÓÚÜ', 'AEIOUU')
               NOT IN ('SI', 'YES', 'TRUE', '1')
            THEN 0
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'NO CONTACTADO'  THEN 1
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'NO INTERESADO'  THEN 2
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'EN SEGUIMIENTO' THEN 3
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CITA'           THEN 4
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CITA ASISTIDA'  THEN 5
          WHEN upper(regexp_replace(btrim(COALESCE(status, '')), '\s+', ' ', 'g')) = 'CONCRETADA'     THEN 6
          ELSE -1        -- fuera del funnel (sin status o status inválido)
        END
      ) STORED;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- 5. VALIDACIÓN + REGLA ANTI-REGRESIÓN
--
--    "Si un lead ya llegó a CITA, CITA ASISTIDA o CONCRETADA, no puede
--     retroceder a NO INTERESADO aunque el desenlace final haya sido negativo."
--
--    Se aplica en la BD y no sólo en la UI: así protege también los updates
--    que entren por el endpoint del CRM o por n8n.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tradecars_funnel_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rank_anterior SMALLINT;
  rank_nuevo    SMALLINT;
BEGIN
  NEW.updated_at := timezone('utc', now());

  -- Normaliza para que el dropdown siempre quede guardado en mayúsculas
  IF NEW.status IS NOT NULL THEN
    NEW.status := upper(regexp_replace(btrim(NEW.status), '\s+', ' ', 'g'));
  END IF;
  IF NEW.perfil_coincide IS NOT NULL THEN
    NEW.perfil_coincide := translate(upper(btrim(NEW.perfil_coincide)), 'ÁÉÍÓÚÜ', 'AEIOUU');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    rank_anterior := OLD.etapa_rank;
    rank_nuevo := CASE
      WHEN translate(upper(btrim(COALESCE(NEW.perfil_coincide, ''))), 'ÁÉÍÓÚÜ', 'AEIOUU')
           NOT IN ('SI', 'YES', 'TRUE', '1') THEN 0
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'NO CONTACTADO'  THEN 1
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'NO INTERESADO'  THEN 2
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'EN SEGUIMIENTO' THEN 3
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'CITA'           THEN 4
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'CITA ASISTIDA'  THEN 5
      WHEN upper(regexp_replace(btrim(COALESCE(NEW.status, '')), '\s+', ' ', 'g')) = 'CONCRETADA'     THEN 6
      ELSE -1
    END;

    -- Ya había alcanzado CITA (4) o más y ahora quieren bajarlo: se ignora el
    -- retroceso y se conserva el punto más avanzado real que alcanzó.
    IF rank_anterior >= 4 AND rank_nuevo >= 0 AND rank_nuevo < rank_anterior THEN
      NEW.status := OLD.status;
      NEW.perfil_coincide := OLD.perfil_coincide;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tradecars_funnel_guard ON public.tradecars_funnel_leads;
CREATE TRIGGER trg_tradecars_funnel_guard
  BEFORE INSERT OR UPDATE ON public.tradecars_funnel_leads
  FOR EACH ROW EXECUTE FUNCTION public.tradecars_funnel_guard();


-- ──────────────────────────────────────────────────────────────────────────
-- 6. ÍNDICES
--    El funnel filtra siempre por fecha_funnel + asesor + canal.
-- ──────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tc_funnel_fecha   ON public.tradecars_funnel_leads (fecha_funnel DESC);
CREATE INDEX IF NOT EXISTS idx_tc_funnel_rank    ON public.tradecars_funnel_leads (etapa_rank);
CREATE INDEX IF NOT EXISTS idx_tc_funnel_asesor  ON public.tradecars_funnel_leads (asesor);
CREATE INDEX IF NOT EXISTS idx_tc_funnel_canal   ON public.tradecars_funnel_leads (canal_origen);
CREATE INDEX IF NOT EXISTS idx_tc_funnel_segui   ON public.tradecars_funnel_leads (fecha_seguimiento)
  WHERE fecha_seguimiento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tc_funnel_probable ON public.tradecars_funnel_leads (fecha_probable_venta)
  WHERE fecha_probable_venta IS NOT NULL;

-- Un lead por conversación de Chatwoot: evita duplicados cuando el CRM
-- reenvía el mismo webhook dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_funnel_conversation
  ON public.tradecars_funnel_leads (chatwoot_conversation_id)
  WHERE chatwoot_conversation_id IS NOT NULL;


-- ──────────────────────────────────────────────────────────────────────────
-- 7. VISTA DE RESUMEN DEL EMBUDO
--    Devuelve las 7 barras ya agregadas por mes/asesor/canal. Útil para
--    reportes y para validar contra el Power BI durante la transición.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tradecars_funnel_resumen AS
WITH etapas(etapa, rank) AS (
  VALUES ('LEADS', 0), ('CUMPLE POLITICA', 1), ('CONTACTADO', 2), ('INTERESADOS', 3),
         ('CITAS AGENDADAS', 4), ('CITAS ASISTIDAS', 5), ('COMPRAS', 6)
)
SELECT
  to_char(l.fecha_funnel, 'YYYY-MM') AS mes,
  l.asesor,
  l.canal_origen,
  e.etapa,
  e.rank                              AS etapa_rank,
  COUNT(*)                            AS cantidad
FROM public.tradecars_funnel_leads l
CROSS JOIN etapas e
WHERE l.etapa_rank >= e.rank          -- acumulativo: alcanzó esa etapa o una superior
  AND l.etapa_rank >= 0               -- excluye sin status / status inválido
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1 DESC, 5;

COMMENT ON VIEW public.tradecars_funnel_resumen IS
  'Barras del embudo ya agregadas. El conteo es acumulativo (etapa o superior).';


-- ──────────────────────────────────────────────────────────────────────────
-- 8. RLS
--    Mismo criterio que el resto del proyecto: el dashboard lee con anon y
--    los endpoints del servidor usan service_role.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_asesores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_funnel_motivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_funnel_leads    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_asesores" ON public.tradecars_asesores
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_asesores" ON public.tradecars_asesores
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_motivos" ON public.tradecars_funnel_motivos
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_motivos" ON public.tradecars_funnel_motivos
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_funnel_leads" ON public.tradecars_funnel_leads
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_funnel_leads" ON public.tradecars_funnel_leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- 9. VERIFICACIÓN (opcional — descomentar para comprobar tras correr)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_generated
--   FROM information_schema.columns
--  WHERE table_name = 'tradecars_funnel_leads'
--  ORDER BY ordinal_position;
--
-- -- Prueba de la tabla de etapas de la minuta:
-- INSERT INTO public.tradecars_funnel_leads (contacto_nombre, perfil_coincide, status, fecha_derivacion)
-- VALUES ('Prueba NO',  'NO', 'CONCRETADA',     CURRENT_DATE),
--        ('Prueba SI1', 'SI', 'NO CONTACTADO',  CURRENT_DATE),
--        ('Prueba SI2', 'SI', 'CONCRETADA',     CURRENT_DATE),
--        ('Prueba SI3', 'SI', NULL,             CURRENT_DATE);
-- SELECT contacto_nombre, perfil_coincide, status, etapa, etapa_rank, fecha_funnel
--   FROM public.tradecars_funnel_leads WHERE contacto_nombre LIKE 'Prueba%';
-- -- Esperado: NO->LEADS(0) | SI1->CUMPLE POLITICA(1) | SI2->COMPRAS(6) | SI3->NULL(-1)
-- DELETE FROM public.tradecars_funnel_leads WHERE contacto_nombre LIKE 'Prueba%';
