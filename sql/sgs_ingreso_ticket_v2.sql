-- ══════════════════════════════════════════════════════════════════════════
-- SGS × ALEF — Ingreso de Ticket v2 (handoff 2026-07-31)
--
-- Aplica los cambios del paquete "Ingreso de Ticket — 2026-07-31 (Roberto)":
--
--   1. El N° de orden (OL) YA NO BLOQUEA el ingreso → estado PENDIENTE_OL
--      (Regla §4.1.c). Antes el registro se rechazaba y se perdía.
--   2. ~25 campos nuevos del OCR ampliado (§2.5): guías, carreta, horas,
--      almacén, transportista, chofer, brevete y los de embarque TISUR.
--   3. Capa de SUBLOTES: el TAT es por job de laboratorio = por sublote,
--      no por camión (§2.8). Sin esto salían 21 alertas por un solo análisis.
--   4. Campos derivados (nunca tecleados, §4.10): sublote, sede, neto en TM.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente: se puede correr
-- sobre la base que ya tiene sgs_tables.sql aplicado.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. SUBLOTES — la unidad real de análisis (~1.000 t)
--    El TAT cuelga de acá, no del ticket.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sgs_sublotes (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                  TEXT NOT NULL,              -- SL-001, SL-002…
  n_orden                 TEXT,                       -- orden a la que pertenece
  sede                    TEXT,                       -- derivada de los tickets
  cliente                 TEXT,

  -- Acumulado (se recalcula al agregar/quitar tickets)
  peso_neto_tm            NUMERIC(12,3) NOT NULL DEFAULT 0,
  tickets_count           INTEGER NOT NULL DEFAULT 0,
  capacidad_tm            NUMERIC(12,3) NOT NULL DEFAULT 1000,   -- corte a ~1.000 t
  cerrado                 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Laboratorio / TAT (§2.3: se sella por sublote, no camión por camión)
  fecha_ingreso_analisis  DATE,
  tat_dias                INTEGER NOT NULL DEFAULT 4,  -- promedio observado; SGS no dio el contractual
  tat_estado              TEXT NOT NULL DEFAULT 'sin_fecha'
                          CHECK (tat_estado IN ('en_plazo','por_vencer','vencido','sin_fecha')),
  tat_dias_restantes      INTEGER,
  job_laboratorio         TEXT,                        -- ej. 'Fe', 'Sizing'
  humedad_pct             NUMERIC(6,3),                -- va en el consolidado, no en recepción
  fe_pct                  NUMERIC(6,3),
  resultado_estado        TEXT NOT NULL DEFAULT 'no_esta'
                          CHECK (resultado_estado IN ('no_esta','listo','leido')),

  analisis_registrado_por TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT sgs_sublotes_codigo_unico UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_sgs_sublotes_abierto ON public.sgs_sublotes (cerrado) WHERE cerrado = FALSE;
CREATE INDEX IF NOT EXISTS idx_sgs_sublotes_tat     ON public.sgs_sublotes (tat_estado);


-- ══════════════════════════════════════════════════════════════════════════
-- 2. TICKETS — el OL deja de ser obligatorio + campos del OCR ampliado
-- ══════════════════════════════════════════════════════════════════════════

-- 2.a  §4.1.c: sin OL el ticket ENTRA IGUAL, en estado PENDIENTE_OL.
ALTER TABLE public.sgs_tickets ALTER COLUMN n_orden DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.sgs_tickets DROP CONSTRAINT IF EXISTS sgs_tickets_n_orden_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Formato OLxxxxxx-xx cuando está presente; NULL permitido (pendiente)
ALTER TABLE public.sgs_tickets
  ADD CONSTRAINT sgs_tickets_n_orden_check
  CHECK (n_orden IS NULL OR n_orden ~ '^OL[0-9]{6}-[0-9]{2}$');

-- 2.b  Estado del registro
ALTER TABLE public.sgs_tickets
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'catalogado'
    CHECK (estado IN ('catalogado','pendiente_ol','anulado'));

-- 2.c  Campos nuevos del OCR ampliado (§2.5 y las 8 secciones)
ALTER TABLE public.sgs_tickets
  -- Sección 1 · Identificación
  ADD COLUMN IF NOT EXISTS guia_remision        TEXT,
  ADD COLUMN IF NOT EXISTS sublote_id           BIGINT REFERENCES public.sgs_sublotes(id) ON DELETE SET NULL,
  -- Sección 2 · Transporte
  ADD COLUMN IF NOT EXISTS carreta              TEXT,       -- placa de carreta (solo TISUR)
  ADD COLUMN IF NOT EXISTS transportista        TEXT,
  ADD COLUMN IF NOT EXISTS ruc_transportista    TEXT,
  ADD COLUMN IF NOT EXISTS chofer               TEXT,
  ADD COLUMN IF NOT EXISTS brevete              TEXT,
  ADD COLUMN IF NOT EXISTS nro_ejes             TEXT,
  -- Sección 3 · Partes
  ADD COLUMN IF NOT EXISTS emisor               TEXT,       -- quien imprime el ticket
  ADD COLUMN IF NOT EXISTS ruc_emisor           TEXT,
  -- Sección 4 · Material y ruta
  ADD COLUMN IF NOT EXISTS cod_material         TEXT,
  ADD COLUMN IF NOT EXISTS material             TEXT,       -- lo IMPRESO (≠ calidad)
  ADD COLUMN IF NOT EXISTS origen               TEXT,
  ADD COLUMN IF NOT EXISTS destino              TEXT,
  ADD COLUMN IF NOT EXISTS almacen              TEXT,
  -- Sección 5 · Pesaje
  ADD COLUMN IF NOT EXISTS fecha_ingreso        DATE,
  ADD COLUMN IF NOT EXISTS hora_ingreso         TEXT,
  ADD COLUMN IF NOT EXISTS fecha_salida         DATE,
  ADD COLUMN IF NOT EXISTS hora_salida          TEXT,
  ADD COLUMN IF NOT EXISTS peso_neto_tm         NUMERIC(12,3),   -- derivado: kg/1000
  -- Sección 6 · Embarque (solo TISUR)
  ADD COLUMN IF NOT EXISTS nave                 TEXT,
  ADD COLUMN IF NOT EXISTS bl_ne                TEXT,
  ADD COLUMN IF NOT EXISTS item_bl              TEXT,
  ADD COLUMN IF NOT EXISTS regimen              TEXT,
  ADD COLUMN IF NOT EXISTS bultos               TEXT,
  -- Sección 8 · Control
  ADD COLUMN IF NOT EXISTS observaciones_ticket TEXT,       -- lo impreso en el papel
  ADD COLUMN IF NOT EXISTS observaciones_ocr    TEXT,       -- flags de la lectura
  ADD COLUMN IF NOT EXISTS formato_ticket       TEXT,       -- ferrobamba | mscon | tisur
  ADD COLUMN IF NOT EXISTS otros                JSONB,      -- resto de campos del OCR
  ADD COLUMN IF NOT EXISTS editado_por          TEXT,
  ADD COLUMN IF NOT EXISTS editado_en           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sgs_tickets_estado  ON public.sgs_tickets (estado);
CREATE INDEX IF NOT EXISTS idx_sgs_tickets_sublote ON public.sgs_tickets (sublote_id);

-- 2.d  El anti-duplicados debe tolerar n_orden NULL.
--      Un ticket PENDIENTE_OL se identifica solo por su n_ticket.
DO $$ BEGIN
  ALTER TABLE public.sgs_tickets DROP CONSTRAINT IF EXISTS sgs_tickets_orden_ticket_unique;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sgs_tickets_orden_ticket
  ON public.sgs_tickets (n_orden, n_ticket) WHERE n_orden IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sgs_tickets_pendiente_ticket
  ON public.sgs_tickets (n_ticket) WHERE n_orden IS NULL;


-- ══════════════════════════════════════════════════════════════════════════
-- 3. HISTORIAL DE EDICIONES (§4.8: todo registro es editable después)
--    Deja rastro de quién cambió qué: es un dato de trazabilidad de SGS.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sgs_ticket_ediciones (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id   BIGINT NOT NULL REFERENCES public.sgs_tickets(id) ON DELETE CASCADE,
  campo       TEXT NOT NULL,
  valor_antes TEXT,
  valor_despues TEXT,
  editado_por TEXT,
  editado_en  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_sgs_ediciones_ticket ON public.sgs_ticket_ediciones (ticket_id, editado_en DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 4. Trigger updated_at para sublotes
-- ══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS sgs_sublotes_updated_at ON public.sgs_sublotes;
CREATE TRIGGER sgs_sublotes_updated_at
  BEFORE UPDATE ON public.sgs_sublotes
  FOR EACH ROW EXECUTE FUNCTION public.sgs_touch_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
-- 5. RLS — mismo criterio: escribe solo el servidor, el navegador lee
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sgs_sublotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgs_ticket_ediciones ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sgs_sublotes','sgs_ticket_ediciones'] LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format('CREATE POLICY "anon_select_%s" ON public.%I FOR SELECT TO anon USING (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. Migración de datos existentes
-- ══════════════════════════════════════════════════════════════════════════

-- Los tickets que ya existían quedan como 'catalogado' (tienen OL por el
-- esquema anterior) y se les calcula el neto en TM.
UPDATE public.sgs_tickets
   SET peso_neto_tm = ROUND(peso_neto / 1000.0, 3)
 WHERE peso_neto IS NOT NULL AND peso_neto_tm IS NULL;

UPDATE public.sgs_tickets
   SET estado = CASE WHEN n_orden IS NULL THEN 'pendiente_ol' ELSE 'catalogado' END
 WHERE estado IS NULL;

-- `material` recibe lo que antes se guardaba como calidad_material, porque el
-- ticket imprime el MATERIAL genérico ("PRODUCTO"), no la calidad real (§5).
UPDATE public.sgs_tickets
   SET material = calidad_material
 WHERE material IS NULL AND calidad_material IS NOT NULL;


-- ══════════════════════════════════════════════════════════════════════════
-- 7. VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════════════════
SELECT 'tickets' AS tabla, COUNT(*) AS filas FROM public.sgs_tickets
UNION ALL SELECT 'sublotes',  COUNT(*) FROM public.sgs_sublotes
UNION ALL SELECT 'ediciones', COUNT(*) FROM public.sgs_ticket_ediciones;

SELECT estado, COUNT(*) FROM public.sgs_tickets GROUP BY estado;

COMMENT ON TABLE public.sgs_sublotes IS
  'SGS — sublotes de ~1.000 t. El TAT del laboratorio cuelga de acá (por job), no del ticket.';
COMMENT ON COLUMN public.sgs_tickets.estado IS
  'catalogado = con OL y verificado · pendiente_ol = ingresado sin N° de orden (Regla §4.1.c)';
COMMENT ON COLUMN public.sgs_tickets.material IS
  'Material IMPRESO en el ticket (ej. PRODUCTO). NO es la calidad: esa viene de la orden y es editable.';
