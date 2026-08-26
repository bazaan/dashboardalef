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

-- Semilla con los motivos REALES de la base de Trade Cars: salen de contar la
-- columna "¿POR QUÉ NO SE CONCRETO?" en las 8.515 filas de BASE COMPRAS (Miguel C.).
-- El porcentaje es sobre los 2.043 leads que sí tenían motivo registrado.
INSERT INTO public.tradecars_funnel_motivos (motivo, descripcion, orden) VALUES
  ('Precio',                               'El cliente no acepta la propuesta economica (78% de los casos)', 1),
  ('No recibimos el modelo',               'El vehiculo no entra en la politica de compra (15%)',            2),
  ('Ya lo vendio',                         'Vendio por otro medio antes de concretar (5%)',                  3),
  ('Su deuda es mayor al precio ofertado', 'El saldo del prestamo supera la oferta (1%)',                    4),
  ('No responde',                          'Dejo de contestar durante el seguimiento',                       5),
  ('Otro',                                 'Cualquier caso que no encaje en los anteriores',                99)
ON CONFLICT (motivo) DO NOTHING;

-- Los 8 motivos inventados de la primera version se desactivan (no se borran,
-- por si algun lead ya quedo apuntando a uno de ellos).
UPDATE public.tradecars_funnel_motivos SET activo = FALSE
 WHERE motivo IN ('Precio ofrecido bajo', 'Aún no decide vender', 'Vendió por otro medio',
                  'No responde / dejó de contestar', 'Vehículo no cumple política',
                  'Distancia / no puede acercarse', 'Solo consultaba precio referencial');

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

-- ──────────────────────────────────────────────────────────────────────────
-- 3b. CAMPOS DEL EXCEL REAL
--
--     La base del asesor (BASE COMPRAS - MIGUEL C.xlsx) tiene 33 columnas que
--     el funnel no usa, pero que son el trabajo diario del asesor. Si el CRM no
--     las guarda, el asesor seguiria abriendo el Excel y no se reemplazaria nada
--     -que es el objetivo de la minuta-. No entran en el calculo del embudo.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_funnel_leads
  -- Fecha del evento cuando el status pasa a CITA ASISTIDA. En el Excel no
  -- existe (CITA y CITA ASISTIDA comparten FECHA DE CITA); el cliente pidio
  -- separarlas, y la §4 de la especificacion manda usar la mas reciente.
  ADD COLUMN IF NOT EXISTS fecha_cita_asistida  DATE,

  -- Vehiculo
  ADD COLUMN IF NOT EXISTS placa                TEXT,
  ADD COLUMN IF NOT EXISTS marca                TEXT,
  ADD COLUMN IF NOT EXISTS modelo               TEXT,
  ADD COLUMN IF NOT EXISTS version              TEXT,
  ADD COLUMN IF NOT EXISTS anio                 TEXT,   -- en la base viene "2014/2015"
  ADD COLUMN IF NOT EXISTS kilometraje          INTEGER,

  -- Negociacion
  ADD COLUMN IF NOT EXISTS monto_propuesta_inicial NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS monto_mejorado          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expectativa_cliente     NUMERIC(12,2),

  -- Origen y ubicacion
  ADD COLUMN IF NOT EXISTS campana              TEXT,   -- VENDE TU AUTO, NEOAUTO, TIK TOK...
  ADD COLUMN IF NOT EXISTS distrito             TEXT,
  ADD COLUMN IF NOT EXISTS zona                 TEXT,   -- Z1..Z4 (hoja Zonificacion)
  ADD COLUMN IF NOT EXISTS correo               TEXT,

  -- Financiamiento del vehiculo
  ADD COLUMN IF NOT EXISTS tiene_deuda          TEXT,   -- SI | NO
  ADD COLUMN IF NOT EXISTS banco                TEXT,

  -- Seguimiento
  ADD COLUMN IF NOT EXISTS fecha_llegada        DATE,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_contacto DATE,
  ADD COLUMN IF NOT EXISTS num_contactos        INTEGER,
  ADD COLUMN IF NOT EXISTS feedback             TEXT;


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
-- fecha_funnel: la ÚNICA fecha con la que el dashboard filtra por mes/año.
--   compra  >  la MÁS RECIENTE entre cita y cita asistida  >  derivación
--
-- En el Excel actual CITA y CITA ASISTIDA comparten la columna FECHA DE CITA;
-- el CRM las separa, y la §4 de la especificación técnica pide que entre las
-- dos entre la del evento más reciente.
--
-- Si la columna existe con la fórmula vieja (sin fecha_cita_asistida) se
-- recrea: es derivada, así que no se pierde ningún dato.
DO $$
DECLARE
  expr TEXT;
BEGIN
  SELECT generation_expression INTO expr
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name  = 'tradecars_funnel_leads'
     AND column_name = 'fecha_funnel';

  IF expr IS NOT NULL AND position('fecha_cita_asistida' in expr) = 0 THEN
    -- La vista de resumen lee fecha_funnel, así que Postgres no deja soltar la
    -- columna mientras exista. Se elimina aquí y la sección 7 la vuelve a crear.
    DROP VIEW IF EXISTS public.tradecars_funnel_resumen;
    ALTER TABLE public.tradecars_funnel_leads DROP COLUMN fecha_funnel;
    expr := NULL;
  END IF;

  IF expr IS NULL THEN
    ALTER TABLE public.tradecars_funnel_leads
      ADD COLUMN fecha_funnel DATE
      GENERATED ALWAYS AS (
        COALESCE(
          fecha_compra,
          -- En PostgreSQL GREATEST ignora los NULL (a diferencia de MySQL):
          -- si solo hay una de las dos fechas, devuelve esa; NULL solo si faltan ambas.
          GREATEST(fecha_cita_asistida, fecha_cita),
          fecha_derivacion
        )
      ) STORED;
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


-- ══════════════════════════════════════════════════════════════════════════
-- 10. ZONIFICACIÓN  (hoja "Zonificación" del Excel del asesor)
--
--     En el Excel, ZONAS sale de un VLOOKUP contra esa hoja y falla el 31% de
--     las veces: el asesor escribe "SURCO" (714 leads) y la hoja dice
--     "Santiago de Surco", así que queda "NO ENCONTRADO". Aquí el catálogo
--     guarda además los alias reales que se escriben, y la zona se autocompleta
--     con un trigger: el asesor ya no la escribe.
--
--     `clave` es el texto normalizado (mayúsculas, sin tildes, sin espacios de
--     más). Agregar un alias nuevo = insertar una fila, sin tocar código.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tradecars_zonificacion (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave      TEXT NOT NULL UNIQUE,          -- normalizado: con esto se busca
  distrito   TEXT NOT NULL,                 -- nombre canónico, el que se muestra
  zona       TEXT NOT NULL,                 -- Z1 | Z2 | Z3 | NO PERTENECE
  es_alias   BOOLEAN DEFAULT FALSE,         -- TRUE = forma alternativa de escribirlo
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_zonif_distrito ON public.tradecars_zonificacion (distrito);

INSERT INTO public.tradecars_zonificacion (clave, distrito, zona, es_alias) VALUES
  ('BARRANCO', 'Barranco', 'Z1', FALSE),
  ('BRENA', 'Breña', 'Z1', FALSE),
  ('CHORRILLOS', 'Chorrillos', 'Z1', FALSE),
  ('JESUS MARIA', 'Jesús maría', 'Z1', FALSE),
  ('LA MOLINA', 'La molina', 'Z1', FALSE),
  ('LA VICTORIA', 'La victoria', 'Z1', FALSE),
  ('LINCE', 'Lince', 'Z1', FALSE),
  ('MAGDALENA DEL MAR', 'Magdalena del mar', 'Z1', FALSE),
  ('MIRAFLORES', 'Miraflores', 'Z1', FALSE),
  ('PUEBLO LIBRE', 'Pueblo libre', 'Z1', FALSE),
  ('SAN BORJA', 'San borja', 'Z1', FALSE),
  ('SAN ISIDRO', 'San isidro', 'Z1', FALSE),
  ('SAN LUIS', 'San Luis', 'Z1', FALSE),
  ('SAN MIGUEL', 'San Miguel', 'Z1', FALSE),
  ('SANTIAGO DE SURCO', 'Santiago de Surco', 'Z1', FALSE),
  ('SURQUILLO', 'Surquillo', 'Z1', FALSE),
  ('CALLAO', 'Callao', 'Z1', FALSE),
  ('BELLAVISTA', 'Bellavista', 'Z1', FALSE),
  ('LA PERLA', 'La Perla', 'Z1', FALSE),
  ('LA PUNTA', 'La Punta', 'Z1', FALSE),
  ('ATE', 'Ate', 'Z2', FALSE),
  ('CERCADO DE LIMA', 'Cercado de Lima', 'Z2', FALSE),
  ('COMAS', 'Comas', 'Z2', FALSE),
  ('EL AGUSTINO', 'El agustino', 'Z2', FALSE),
  ('INDEPENDENCIA', 'Independencia', 'Z2', FALSE),
  ('LOS OLIVOS', 'Los olivos', 'Z2', FALSE),
  ('RIMAC', 'Rímac', 'Z2', FALSE),
  ('SAN MARTIN DE PORRES', 'San Martin de Porres', 'Z2', FALSE),
  ('SANTA ANITA', 'Santa Anita', 'Z2', FALSE),
  ('SANTA ROSA', 'Santa Rosa', 'Z2', FALSE),
  ('VILLA EL SALVADOR', 'Villa el Salvador', 'Z2', FALSE),
  ('VILLA MARIA DEL TRIUNFO', 'Villa Maria del Triunfo', 'Z2', FALSE),
  ('CARMEN DE LA LEGUA-REYNOSO', 'Carmen de La Legua-Reynoso', 'Z2', FALSE),
  ('ANCON', 'Ancón', 'Z3', FALSE),
  ('CARABAYLLO', 'Carabayllo', 'Z3', FALSE),
  ('CHACLACAYO', 'Chaclacayo', 'Z3', FALSE),
  ('CIENEGUILLA', 'Cieneguilla', 'Z3', FALSE),
  ('LURIGANCHO', 'Lurigancho', 'Z3', FALSE),
  ('LURIN', 'Lurín', 'Z3', FALSE),
  ('PACHACAMAC', 'Pachacámac', 'Z3', FALSE),
  ('PUCUSANA', 'Pucusana', 'Z3', FALSE),
  ('PUENTE PIEDRA', 'Puente piedra', 'Z3', FALSE),
  ('PUNTA HERMOSA', 'Punta hermosa', 'Z3', FALSE),
  ('PUNTA NEGRA', 'Punta negra', 'Z3', FALSE),
  ('SAN BARTOLO', 'San bartolo', 'Z3', FALSE),
  ('SAN JUAN DE LURIGANCHO', 'San Juan de Lurigancho', 'Z3', FALSE),
  ('SAN JUAN DE MIRAFLORES', 'San Juan de Miraflores', 'Z3', FALSE),
  ('SANTA MARIA DEL MAR', 'Santa María del Mar', 'Z3', FALSE),
  ('VENTANILLA', 'Ventanilla', 'Z3', FALSE),
  ('MI PERU', 'Mi Perú', 'Z3', FALSE),
  ('SURCO', 'Santiago de Surco', 'Z1', TRUE),
  ('SURCO VIEJO', 'Santiago de Surco', 'Z1', TRUE),
  ('SANTIAGO DE SURCO CHACARILLA', 'Santiago de Surco', 'Z1', TRUE),
  ('MONTERRICO', 'Santiago de Surco', 'Z1', TRUE),
  ('LIMA', 'Cercado de Lima', 'Z2', TRUE),
  ('CERCADO', 'Cercado de Lima', 'Z2', TRUE),
  ('LIMA CERCADO', 'Cercado de Lima', 'Z2', TRUE),
  ('CENTRO DE LIMA', 'Cercado de Lima', 'Z2', TRUE),
  ('LIMA CENTRO', 'Cercado de Lima', 'Z2', TRUE),
  ('CERCADO LIMA', 'Cercado de Lima', 'Z2', TRUE),
  ('MAGDALENA', 'Magdalena del mar', 'Z1', TRUE),
  ('SMP', 'San Martin de Porres', 'Z2', TRUE),
  ('SAN MARTIN DE PORRAS', 'San Martin de Porres', 'Z2', TRUE),
  ('S M P', 'San Martin de Porres', 'Z2', TRUE),
  ('SJL', 'San Juan de Lurigancho', 'Z3', TRUE),
  ('SAN JUAN LURIGANCHO', 'San Juan de Lurigancho', 'Z3', TRUE),
  ('ZARATE', 'San Juan de Lurigancho', 'Z3', TRUE),
  ('CANTO GRANDE', 'San Juan de Lurigancho', 'Z3', TRUE),
  ('MARISCAL CACERES', 'San Juan de Lurigancho', 'Z3', TRUE),
  ('SJM', 'San Juan de Miraflores', 'Z3', TRUE),
  ('SAN JUAN MIRAFLORES', 'San Juan de Miraflores', 'Z3', TRUE),
  ('PAMPLONA', 'San Juan de Miraflores', 'Z3', TRUE),
  ('PAMPLONA ALTA', 'San Juan de Miraflores', 'Z3', TRUE),
  ('VMT', 'Villa Maria del Triunfo', 'Z2', TRUE),
  ('VILLA MARIA', 'Villa Maria del Triunfo', 'Z2', TRUE),
  ('VES', 'Villa el Salvador', 'Z2', TRUE),
  ('VILLA SALVADOR', 'Villa el Salvador', 'Z2', TRUE),
  ('ATE VITARTE', 'Ate', 'Z2', TRUE),
  ('VITARTE', 'Ate', 'Z2', TRUE),
  ('SALAMANCA', 'Ate', 'Z2', TRUE),
  ('SANTA CLARA', 'Ate', 'Z2', TRUE),
  ('CERES', 'Ate', 'Z2', TRUE),
  ('MAYORAZGO', 'Ate', 'Z2', TRUE),
  ('CHOSICA', 'Lurigancho', 'Z3', TRUE),
  ('LURIGANCHO CHOSICA', 'Lurigancho', 'Z3', TRUE),
  ('LURIGANCHO-CHOSICA', 'Lurigancho', 'Z3', TRUE),
  ('HUACHIPA', 'Lurigancho', 'Z3', TRUE),
  ('CAJAMARQUILLA', 'Lurigancho', 'Z3', TRUE),
  ('NIEVERIA', 'Lurigancho', 'Z3', TRUE),
  ('OLIVOS', 'Los olivos', 'Z2', TRUE),
  ('PRO', 'Los olivos', 'Z2', TRUE),
  ('LOS OLIVOS PRO', 'Los olivos', 'Z2', TRUE),
  ('AGUSTINO', 'El agustino', 'Z2', TRUE),
  ('MOLINA', 'La molina', 'Z1', TRUE),
  ('SANISIDRO', 'San isidro', 'Z1', TRUE),
  ('SAN ISIDRO LIMA', 'San isidro', 'Z1', TRUE),
  ('CARMEN DE LA LEGUA', 'Carmen de La Legua-Reynoso', 'Z2', TRUE),
  ('CARMEN DE LA LEGUA REYNOSO', 'Carmen de La Legua-Reynoso', 'Z2', TRUE),
  ('EL RIMAC', 'Rimac', 'Z2', TRUE),
  ('BALCONCILLO', 'La victoria', 'Z1', TRUE),
  ('EL CALLAO', 'Callao', 'Z1', TRUE),
  ('PACHACUTEC', 'Ventanilla', 'Z3', TRUE),
  ('MANCHAY', 'Pachacamac', 'Z3', TRUE),
  ('HUANCAYO', 'Huancayo', 'NO PERTENECE', FALSE),
  ('EL TAMBO', 'El Tambo', 'NO PERTENECE', FALSE),
  ('TAMBO', 'Tambo', 'NO PERTENECE', FALSE),
  ('TRUJILLO', 'Trujillo', 'NO PERTENECE', FALSE),
  ('CHICLAYO', 'Chiclayo', 'NO PERTENECE', FALSE),
  ('ICA', 'Ica', 'NO PERTENECE', FALSE),
  ('AREQUIPA', 'Arequipa', 'NO PERTENECE', FALSE),
  ('PIURA', 'Piura', 'NO PERTENECE', FALSE),
  ('CUSCO', 'Cusco', 'NO PERTENECE', FALSE),
  ('HUANUCO', 'Huanuco', 'NO PERTENECE', FALSE),
  ('CAJAMARCA', 'Cajamarca', 'NO PERTENECE', FALSE),
  ('CHIMBOTE', 'Chimbote', 'NO PERTENECE', FALSE),
  ('NUEVO CHIMBOTE', 'Nuevo Chimbote', 'NO PERTENECE', FALSE),
  ('HUACHO', 'Huacho', 'NO PERTENECE', FALSE),
  ('CANETE', 'Canete', 'NO PERTENECE', FALSE),
  ('CHANCAY', 'Chancay', 'NO PERTENECE', FALSE),
  ('AYACUCHO', 'Ayacucho', 'NO PERTENECE', FALSE),
  ('BARRANCA', 'Barranca', 'NO PERTENECE', FALSE),
  ('PAUCARPATA', 'Paucarpata', 'NO PERTENECE', FALSE),
  ('CHINCHA', 'Chincha', 'NO PERTENECE', FALSE),
  ('TARAPOTO', 'Tarapoto', 'NO PERTENECE', FALSE),
  ('CHILCA', 'Chilca', 'NO PERTENECE', FALSE),
  ('PUNO', 'Puno', 'NO PERTENECE', FALSE),
  ('JULIACA', 'Juliaca', 'NO PERTENECE', FALSE),
  ('CAYMA', 'Cayma', 'NO PERTENECE', FALSE),
  ('YANAHUARA', 'Yanahuara', 'NO PERTENECE', FALSE),
  ('CERRO COLORADO', 'Cerro Colorado', 'NO PERTENECE', FALSE),
  ('PISCO', 'Pisco', 'NO PERTENECE', FALSE),
  ('CALLERIA', 'Calleria', 'NO PERTENECE', FALSE),
  ('PUCALLPA', 'Pucallpa', 'NO PERTENECE', FALSE),
  ('LAMBAYEQUE', 'Lambayeque', 'NO PERTENECE', FALSE),
  ('HUARAZ', 'Huaraz', 'NO PERTENECE', FALSE),
  ('SULLANA', 'Sullana', 'NO PERTENECE', FALSE),
  ('HUAURA', 'Huaura', 'NO PERTENECE', FALSE),
  ('HUARAL', 'Huaral', 'NO PERTENECE', FALSE),
  ('TARMA', 'Tarma', 'NO PERTENECE', FALSE),
  ('MARCONA', 'Marcona', 'NO PERTENECE', FALSE),
  ('HUALMAY', 'Hualmay', 'NO PERTENECE', FALSE),
  ('IQUITOS', 'Iquitos', 'NO PERTENECE', FALSE),
  ('SUPE', 'Supe', 'NO PERTENECE', FALSE),
  ('OXAPAMPA', 'Oxapampa', 'NO PERTENECE', FALSE),
  ('OYON', 'Oyon', 'NO PERTENECE', FALSE),
  ('TACNA', 'Tacna', 'NO PERTENECE', FALSE),
  ('MOQUEGUA', 'Moquegua', 'NO PERTENECE', FALSE),
  ('ILO', 'Ilo', 'NO PERTENECE', FALSE),
  ('MOLLENDO', 'Mollendo', 'NO PERTENECE', FALSE),
  ('CAMANA', 'Camana', 'NO PERTENECE', FALSE),
  ('TUMBES', 'Tumbes', 'NO PERTENECE', FALSE),
  ('ABANCAY', 'Abancay', 'NO PERTENECE', FALSE),
  ('HUANCAVELICA', 'Huancavelica', 'NO PERTENECE', FALSE),
  ('CERRO DE PASCO', 'Cerro De Pasco', 'NO PERTENECE', FALSE),
  ('MOYOBAMBA', 'Moyobamba', 'NO PERTENECE', FALSE),
  ('JAEN', 'Jaen', 'NO PERTENECE', FALSE),
  ('TALARA', 'Talara', 'NO PERTENECE', FALSE),
  ('PAITA', 'Paita', 'NO PERTENECE', FALSE),
  ('NAZCA', 'Nazca', 'NO PERTENECE', FALSE),
  ('NASCA', 'Nasca', 'NO PERTENECE', FALSE),
  ('CHEPEN', 'Chepen', 'NO PERTENECE', FALSE),
  ('VIRU', 'Viru', 'NO PERTENECE', FALSE),
  ('PACASMAYO', 'Pacasmayo', 'NO PERTENECE', FALSE),
  ('SICUANI', 'Sicuani', 'NO PERTENECE', FALSE),
  ('SATIPO', 'Satipo', 'NO PERTENECE', FALSE),
  ('LA MERCED', 'La Merced', 'NO PERTENECE', FALSE),
  ('CHANCHAMAYO', 'Chanchamayo', 'NO PERTENECE', FALSE),
  ('SANTA EULALIA', 'Santa Eulalia', 'NO PERTENECE', FALSE),
  ('SAN MARTIN', 'San Martin', 'NO PERTENECE', FALSE),
  ('SAN VICENTE DE CANETE', 'San Vicente De Canete', 'NO PERTENECE', FALSE),
  ('MALA', 'Mala', 'NO PERTENECE', FALSE),
  ('ASIA', 'Asia', 'NO PERTENECE', FALSE),
  ('PARAMONGA', 'Paramonga', 'NO PERTENECE', FALSE),
  ('PATIVILCA', 'Pativilca', 'NO PERTENECE', FALSE),
  ('OTROS', 'Otros', 'NO PERTENECE', FALSE),
  ('PROVINCIA', 'Provincia', 'NO PERTENECE', FALSE),
  ('EXTRANJERO', 'Extranjero', 'NO PERTENECE', FALSE),
  ('NO PRECISA', 'No Precisa', 'NO PERTENECE', FALSE)
ON CONFLICT (clave) DO NOTHING;

COMMENT ON TABLE public.tradecars_zonificacion IS
  'Distrito -> zona (Z1/Z2/Z3) + alias de cómo lo escribe el asesor. Editable desde el dashboard.';


-- ══════════════════════════════════════════════════════════════════════════
-- 11. MARCAS Y PRIORIDAD  (columna "MARCA // PRIORIDAD" del Excel)
--
--     1 = marca prioritaria, 2 = media, 3 = baja. Está llena en el 81% de los
--     leads y es función estricta de la marca: en las 8.515 filas no hay una
--     sola marca con dos prioridades distintas. Por eso vive en un catálogo y
--     se autocompleta, en vez de escribirla lead por lead.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tradecars_marcas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave      TEXT NOT NULL UNIQUE,
  marca      TEXT NOT NULL,
  prioridad  SMALLINT CHECK (prioridad IN (1, 2, 3)),
  es_alias   BOOLEAN DEFAULT FALSE,
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_marcas_prioridad ON public.tradecars_marcas (prioridad);

INSERT INTO public.tradecars_marcas (clave, marca, prioridad, es_alias) VALUES
  ('CHEVROLET', 'Chevrolet', 1, FALSE),
  ('HYUNDAI', 'Hyundai', 1, FALSE),
  ('KIA', 'Kia', 1, FALSE),
  ('MAXUS', 'Maxus', 1, FALSE),
  ('NISSAN', 'Nissan', 1, FALSE),
  ('SUZUKI', 'Suzuki', 1, FALSE),
  ('TOYOTA', 'Toyota', 1, FALSE),
  ('BMW', 'Bmw', 2, FALSE),
  ('CHANGAN', 'Changan', 2, FALSE),
  ('CHERY', 'Chery', 2, FALSE),
  ('DFSK', 'Dfsk', 2, FALSE),
  ('FORD', 'Ford', 2, FALSE),
  ('HONDA', 'Honda', 2, FALSE),
  ('JAC', 'Jac', 2, FALSE),
  ('MAZDA', 'Mazda', 2, FALSE),
  ('MG', 'Mg', 2, FALSE),
  ('MITSUBISHI', 'Mitsubishi', 2, FALSE),
  ('RENAULT', 'Renault', 2, FALSE),
  ('SUBARU', 'Subaru', 2, FALSE),
  ('VOLKSWAGEN', 'Volkswagen', 2, FALSE),
  ('AUDI', 'Audi', 3, FALSE),
  ('BAIC', 'Baic', 3, FALSE),
  ('BYD', 'Byd', 3, FALSE),
  ('CITROEN', 'Citroen', 3, FALSE),
  ('DODGE', 'Dodge', 3, FALSE),
  ('FAW', 'Faw', 3, FALSE),
  ('FIAT', 'Fiat', 3, FALSE),
  ('FOTON', 'Foton', 3, FALSE),
  ('GAC', 'Gac', 3, FALSE),
  ('GEELY', 'Geely', 3, FALSE),
  ('GREAT WALL', 'Great Wall', 3, FALSE),
  ('HAFEI', 'Hafei', 3, FALSE),
  ('HAVAL', 'Haval', 3, FALSE),
  ('JAGUAR', 'Jaguar', 3, FALSE),
  ('JEEP', 'Jeep', 3, FALSE),
  ('JETOUR', 'Jetour', 3, FALSE),
  ('JINBEI', 'Jinbei', 3, FALSE),
  ('JMC', 'Jmc', 3, FALSE),
  ('KEYTON', 'Keyton', 3, FALSE),
  ('KYC', 'Kyc', 3, FALSE),
  ('LAND ROVER', 'Land Rover', 3, FALSE),
  ('LEXUS', 'Lexus', 3, FALSE),
  ('MERCEDES BENZ', 'Mercedes Benz', 3, FALSE),
  ('MINI', 'Mini', 3, FALSE),
  ('MOTO', 'Moto', 3, FALSE),
  ('PEUGEOT', 'Peugeot', 3, FALSE),
  ('PORSCHE', 'Porsche', 3, FALSE),
  ('RAM', 'Ram', 3, FALSE),
  ('SEAT', 'Seat', 3, FALSE),
  ('SHINERAY', 'Shineray', 3, FALSE),
  ('SOUEAST', 'Soueast', 3, FALSE),
  ('SSANGYONG', 'Ssangyong', 3, FALSE),
  ('VOLVO', 'Volvo', 3, FALSE),
  ('MERDECES BENZ', 'Mercedes Benz', 3, TRUE),
  ('MERCEDES', 'Mercedes Benz', 3, TRUE),
  ('MERCEDES-BENZ', 'Mercedes Benz', 3, TRUE),
  ('MERCEDEZ BENZ', 'Mercedes Benz', 3, TRUE),
  ('BENZ', 'Mercedes Benz', 3, TRUE),
  ('VW', 'Volkswagen', 2, TRUE),
  ('VOLSKWAGEN', 'Volkswagen', 2, TRUE),
  ('VOLKSWAGUEN', 'Volkswagen', 2, TRUE),
  ('RENUALT', 'Renault', 2, TRUE),
  ('RENAUL', 'Renault', 2, TRUE),
  ('SUSUKI', 'Suzuki', 1, TRUE),
  ('SUZUKO', 'Suzuki', 1, TRUE),
  ('SUZUCKI', 'Suzuki', 1, TRUE),
  ('JEPP', 'Jeep', 3, TRUE),
  ('SSANYONG', 'Ssangyong', 3, TRUE),
  ('SANGYONG', 'Ssangyong', 3, TRUE),
  ('SSANG YONG', 'Ssangyong', 3, TRUE),
  ('CHEVROLETT', 'Chevrolet', 1, TRUE),
  ('CHEVY', 'Chevrolet', 1, TRUE),
  ('MITSUBISHI MOTORS', 'Mitsubishi', 2, TRUE),
  ('MISTUBISHI', 'Mitsubishi', 2, TRUE),
  ('HIUNDAI', 'Hyundai', 1, TRUE),
  ('HYNDAI', 'Hyundai', 1, TRUE),
  ('HUYNDAI', 'Hyundai', 1, TRUE),
  ('TOYOTA MOTORS', 'Toyota', 1, TRUE),
  ('GREATWALL', 'Great Wall', 3, TRUE),
  ('GWM', 'Great Wall', 3, TRUE),
  ('LANDROVER', 'Land Rover', 3, TRUE),
  ('RANGE ROVER', 'Land Rover', 3, TRUE),
  ('VOKLSWAGEN', 'Volkswagen', 2, TRUE),
  ('VOLKVAGEN', 'Volkswagen', 2, TRUE),
  ('WOLSKVAGEN', 'Volkswagen', 2, TRUE),
  ('RENOLT', 'Renault', 2, TRUE),
  ('OTRA MARCA', 'Otra marca', NULL, FALSE),
  ('OTRO (ESCRIBE A CONTINUACION LA MARCA DE TU AUTO)', 'Otra marca', NULL, TRUE),
  ('OTRO', 'Otra marca', NULL, TRUE),
  ('DONGFENG', 'Dongfeng', NULL, FALSE),
  ('DONG FENG', 'Dongfeng', NULL, TRUE),
  ('DFM', 'Dongfeng', NULL, TRUE),
  ('DONGFRNG', 'Dongfeng', NULL, TRUE),
  ('BRILLIANCE', 'Brilliance', NULL, FALSE),
  ('SWM', 'SWM', NULL, FALSE),
  ('MAHINDRA', 'Mahindra', NULL, FALSE),
  ('DAIHATSU', 'Daihatsu', NULL, FALSE),
  ('CUPRA', 'Cupra', NULL, FALSE),
  ('T-KING', 'T-King', NULL, FALSE),
  ('TKING', 'T-King', NULL, TRUE),
  ('T KING', 'T-King', NULL, TRUE),
  ('ZOTYE', 'Zotye', NULL, FALSE),
  ('KARRY', 'Karry', NULL, FALSE),
  ('PONTIAC', 'Pontiac', NULL, FALSE),
  ('DAEWOO', 'Daewoo', NULL, FALSE),
  ('FERRARI', 'Ferrari', NULL, FALSE),
  ('MASERATI', 'Maserati', NULL, FALSE),
  ('CHANGHE', 'Changhe', NULL, FALSE),
  ('CHANA', 'Chana', NULL, FALSE),
  ('HINO', 'Hino', NULL, FALSE),
  ('LADA', 'Lada', NULL, FALSE),
  ('HAIMA', 'Haima', NULL, FALSE),
  ('LIFAN', 'Lifan', NULL, FALSE),
  ('CADILLAC', 'Cadillac', NULL, FALSE),
  ('OLDSMOBILE', 'Oldsmobile', NULL, FALSE),
  ('BAW', 'BAW', NULL, FALSE),
  ('ZNA', 'ZNA', NULL, FALSE),
  ('FORLAND', 'Forland', NULL, FALSE),
  ('WEICHAI', 'Weichai', NULL, FALSE),
  ('AIMA', 'Aima', NULL, FALSE),
  ('VESPA', 'Vespa', NULL, FALSE),
  ('INTERNATIONAL', 'International', NULL, FALSE),
  ('INTENATIONAL', 'International', NULL, TRUE)
ON CONFLICT (clave) DO NOTHING;

COMMENT ON TABLE public.tradecars_marcas IS
  'Marca -> prioridad 1/2/3 + alias/typos. Sembrada contando la base real de Trade Cars.';


-- ══════════════════════════════════════════════════════════════════════════
-- 12. COSTO DE CAMPAÑA  (tablas "COSTOS COMPRAS" / "COSTOS VENTAS" del .pbix)
--
--     El Power BI calcula "Costo por lead" e "Inv. por compra" contra una tabla
--     de costos que NO viene en el Excel: hoy alguien la pega a mano cada mes.
--     Aquí queda normalizada (una fila por mes/campaña) y el dashboard divide
--     contra los leads que ya tiene. Mientras no se carguen los montos, el
--     módulo simplemente no muestra costos: no inventa nada.
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tradecars_campana_costos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes        DATE NOT NULL,                 -- siempre el día 1 del mes
  tipo       TEXT NOT NULL DEFAULT 'compras',  -- compras | ventas
  campana    TEXT NOT NULL,
  costo      NUMERIC(12,2) NOT NULL DEFAULT 0,
  moneda     TEXT NOT NULL DEFAULT 'USD',
  nota       TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (mes, tipo, campana)
);

CREATE INDEX IF NOT EXISTS idx_tc_costos_mes ON public.tradecars_campana_costos (mes DESC);

COMMENT ON TABLE public.tradecars_campana_costos IS
  'Inversión publicitaria por mes y campaña. Alimenta costo por lead / inversión por compra.';


-- ══════════════════════════════════════════════════════════════════════════
-- 13. AUTOCOMPLETADO: zona, distrito normalizado, marca y prioridad
--
--     Vive en la BD y no sólo en la UI para que también se aplique a lo que
--     entra por el endpoint del CRM, por n8n o por la migración del histórico.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tradecars_funnel_leads
  ADD COLUMN IF NOT EXISTS marca_prioridad      SMALLINT,
  ADD COLUMN IF NOT EXISTS distrito_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS marca_normalizada    TEXT,
  -- Clave de la fila de origen en el Excel. Hace que re-correr la migración
  -- del histórico actualice en vez de duplicar.
  ADD COLUMN IF NOT EXISTS import_key           TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_tc_funnel_import_key'
  ) THEN
    ALTER TABLE public.tradecars_funnel_leads
      ADD CONSTRAINT uq_tc_funnel_import_key UNIQUE (import_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tc_funnel_prioridad ON public.tradecars_funnel_leads (marca_prioridad);
CREATE INDEX IF NOT EXISTS idx_tc_funnel_campana   ON public.tradecars_funnel_leads (campana);

-- Mismo criterio de normalización que tcNormalizar() en utils/tradecarsFunnel.ts.
-- IMMUTABLE para poder usarla en índices y columnas generadas si hiciera falta.
CREATE OR REPLACE FUNCTION public.tc_normalizar(v TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    translate(upper(COALESCE(v, '')), 'ÁÉÍÓÚÜÀÈÌÒÙÂÊÎÔÛÄËÏÖÑÇ', 'AEIOUUAEIOUAEIOUAEIONC'),
    '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.tradecars_funnel_autocompletar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  k        TEXT;
  primera  TEXT;
  z        RECORD;
  m        RECORD;
BEGIN
  -- ── Distrito -> distrito canónico + zona ──
  k := public.tc_normalizar(NEW.distrito);
  IF k <> '' THEN
    SELECT distrito, zona INTO z
      FROM public.tradecars_zonificacion WHERE clave = k;

    IF NOT FOUND THEN
      -- "SURCO CHACARILLA", "ATE VITARTE SANTA CLARA": se prueba con el
      -- prefijo más largo que sí exista en el catálogo.
      SELECT distrito, zona INTO z
        FROM public.tradecars_zonificacion
       WHERE k LIKE clave || ' %'
       ORDER BY length(clave) DESC
       LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      -- "SANMIGUEL", "PUEBLOLIBRE", "S.M.P", "SAN_JUAN_DE_LURIGANCHO":
      -- se ignoran espacios y puntuación a ambos lados. Cubre el patrón
      -- completo en vez de ir agregando el typo de cada día como alias.
      SELECT distrito, zona INTO z
        FROM public.tradecars_zonificacion
       WHERE regexp_replace(clave, '[^A-Z0-9]', '', 'g')
           = regexp_replace(k,     '[^A-Z0-9]', '', 'g')
       ORDER BY es_alias, length(clave) DESC
       LIMIT 1;
    END IF;

    IF FOUND THEN
      NEW.distrito_normalizado := z.distrito;
      -- La zona escrita a mano gana sólo si el catálogo no conoce el distrito.
      NEW.zona := z.zona;
    ELSE
      NEW.distrito_normalizado := NULL;
    END IF;
  ELSE
    NEW.distrito_normalizado := NULL;
  END IF;

  -- ── Marca -> marca canónica + prioridad ──
  k := public.tc_normalizar(NEW.marca);
  IF k <> '' THEN
    SELECT marca, prioridad INTO m
      FROM public.tradecars_marcas WHERE clave = k AND activo;

    IF NOT FOUND THEN
      -- "KIA RIO", "TOYOTA YARIS": el asesor escribe marca + modelo.
      primera := split_part(k, ' ', 1);
      SELECT marca, prioridad INTO m
        FROM public.tradecars_marcas
       WHERE clave = primera AND activo;
    END IF;

    IF NOT FOUND THEN
      SELECT marca, prioridad INTO m
        FROM public.tradecars_marcas
       WHERE activo
         AND regexp_replace(clave, '[^A-Z0-9]', '', 'g')
           = regexp_replace(k,     '[^A-Z0-9]', '', 'g')
       ORDER BY es_alias
       LIMIT 1;
    END IF;

    IF FOUND THEN
      NEW.marca_normalizada := m.marca;
      IF NEW.marca_prioridad IS NULL THEN
        NEW.marca_prioridad := m.prioridad;
      END IF;
    ELSE
      NEW.marca_normalizada := NULL;
    END IF;
  ELSE
    NEW.marca_normalizada := NULL;
  END IF;

  RETURN NEW;
END $$;

-- Corre DESPUÉS del guard: los nombres de trigger se disparan en orden
-- alfabético y 'trg_tradecars_funnel_autocompletar' < 'trg_tradecars_funnel_guard'
-- no importa aquí porque tocan columnas distintas.
DROP TRIGGER IF EXISTS trg_tradecars_funnel_autocompletar ON public.tradecars_funnel_leads;
CREATE TRIGGER trg_tradecars_funnel_autocompletar
  BEFORE INSERT OR UPDATE ON public.tradecars_funnel_leads
  FOR EACH ROW EXECUTE FUNCTION public.tradecars_funnel_autocompletar();

-- Rellena lo que ya estuviera cargado antes de existir el trigger.
UPDATE public.tradecars_funnel_leads SET updated_at = updated_at
 WHERE distrito IS NOT NULL OR marca IS NOT NULL;


-- ══════════════════════════════════════════════════════════════════════════
-- 14. RLS DE LAS TABLAS NUEVAS
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.tradecars_zonificacion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_marcas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_campana_costos   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tradecars_zonificacion') THEN
    CREATE POLICY tc_zonif_all ON public.tradecars_zonificacion
      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tradecars_marcas') THEN
    CREATE POLICY tc_marcas_all ON public.tradecars_marcas
      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tradecars_campana_costos') THEN
    CREATE POLICY tc_costos_all ON public.tradecars_campana_costos
      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 15. VISTA DE PROCEDENCIA  (páginas "PROCEDENCIA DEL LEAD" del .pbix)
--     Leads y compras por campaña y modelo, con la fecha del funnel.
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.tradecars_procedencia AS
SELECT
  to_char(fecha_funnel, 'YYYY-MM')          AS mes,
  COALESCE(NULLIF(btrim(campana), ''), 'Sin campaña') AS campana,
  COALESCE(NULLIF(btrim(marca_normalizada), ''),
           NULLIF(btrim(marca), ''), 'Sin marca')     AS marca,
  COALESCE(NULLIF(btrim(modelo), ''), 'Sin modelo')   AS modelo,
  COUNT(*)                                            AS leads,
  COUNT(*) FILTER (WHERE etapa_rank >= 4)             AS citas,
  COUNT(*) FILTER (WHERE etapa_rank = 6)              AS compras
FROM public.tradecars_funnel_leads
WHERE etapa_rank >= 0
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.tradecars_procedencia IS
  'Leads / citas / compras por campaña y modelo. Equivale a PROCEDENCIA DEL LEAD del Power BI.';
