-- ══════════════════════════════════════════════════════════════════════════
-- SGS × ALEF — Esquema de producción del sistema de recepción de mineral
--
-- Reemplaza el store Excel del demo (SGS_demo_store.xlsx, hoja "Recepcion")
-- por tablas Supabase, manteniendo EXACTAMENTE el contrato de integración:
--
--   • sgs_tickets        → capa "Recepción": una fila por ticket catalogado
--   • sgs_escalamientos  → historial de avisos TAT (William → Jahaira → José)
--
-- Reglas de oro implementadas a nivel de BD:
--   §4.1  n_orden formato OLxxxxxx-xx (CHECK) — la única llave
--   §4.2  verificado_humano obligatorio (CHECK) — no hay auto-guardado ciego
--   §4.4  anti-duplicados por (n_orden, n_ticket) (UNIQUE)
--
-- SEGURIDAD (distinta al resto del proyecto, a propósito):
--   Las ESCRITURAS van SOLO por los endpoints del servidor (service_role),
--   donde corren las validaciones, el supervisor y el motor TAT.
--   El navegador (key anon) SOLO puede LEER. Así nadie puede saltarse las
--   reglas de oro escribiendo directo a la tabla.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. TICKETS (capa Recepción — el contrato del dashboard)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sgs_tickets (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- §4.1 LA ÚNICA LLAVE: nada existe sin N° de orden OLxxxxxx-xx
  n_orden                 TEXT NOT NULL
                          CHECK (n_orden ~ '^OL[0-9]{6}-[0-9]{2}$'),
  n_ticket                TEXT NOT NULL,            -- N° de ticket de balanza

  fecha                   TEXT,                     -- fecha impresa en el ticket (tal cual)
  sede                    TEXT,                     -- Matarani | Pisco
  cliente                 TEXT,                     -- anonimizado en demos (CLIENTE A/B/C)
  calidad_material        TEXT,
  placa                   TEXT,
  peso_bruto              NUMERIC(12,2),            -- kg
  tara                    NUMERIC(12,2),
  peso_neto               NUMERIC(12,2),
  sublote                 TEXT,                     -- sublote de ~1.000 t

  -- Motor TAT (D)
  fecha_ingreso_analisis  DATE,                     -- inicio del reloj TAT
  tat_dias                INT NOT NULL DEFAULT 4,   -- TAT contractual (parametrizable por cliente)
  tat_estado              TEXT NOT NULL DEFAULT 'sin_fecha'
                          CHECK (tat_estado IN ('en_plazo','por_vencer','vencido','sin_fecha')),
  tat_dias_restantes      INT,                      -- negativo = vencido

  -- Semáforo de resultados (E — simulado, sin C-Class)
  resultado_estado        TEXT NOT NULL DEFAULT 'no_esta'
                          CHECK (resultado_estado IN ('no_esta','listo','leido')),

  imagen_ticket           TEXT,                     -- URL pública de la foto (Storage)

  -- §4.2 human-in-the-loop: la BD RECHAZA registros sin verificación humana
  verificado_humano       BOOLEAN NOT NULL CHECK (verificado_humano = TRUE),

  -- Segunda balanza (ej. MINA vs puerto), si el ticket la trae
  balanza2_nombre         TEXT,
  balanza2_bruto          NUMERIC(12,2),
  balanza2_tara           NUMERIC(12,2),
  balanza2_neto           NUMERIC(12,2),

  -- Agente Supervisor (§7c): veredicto de la pasada de calidad
  supervision             TEXT CHECK (supervision IN ('ok','revisar') OR supervision IS NULL),
  supervision_severidad   TEXT CHECK (supervision_severidad IN ('baja','media','alta') OR supervision_severidad IS NULL),
  supervision_obs         TEXT,

  created_by              TEXT,                     -- email de quien catalogó
  created_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- §4.4 anti-duplicados: mismo (orden + ticket) => upsert, nunca fila nueva
  CONSTRAINT sgs_tickets_orden_ticket_unique UNIQUE (n_orden, n_ticket)
);

CREATE INDEX IF NOT EXISTS idx_sgs_tickets_created   ON public.sgs_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgs_tickets_tat       ON public.sgs_tickets (tat_estado);
CREATE INDEX IF NOT EXISTS idx_sgs_tickets_resultado ON public.sgs_tickets (resultado_estado);
CREATE INDEX IF NOT EXISTS idx_sgs_tickets_orden     ON public.sgs_tickets (n_orden);
CREATE INDEX IF NOT EXISTS idx_sgs_tickets_sede      ON public.sgs_tickets (sede);


-- ══════════════════════════════════════════════════════════════════════════
-- 2. ESCALAMIENTOS TAT (historial de avisos de la cadena)
--    Nivel 1 William Ochoa (preventivo) → Nivel 2 Jahaira Sánchez (vencido
--    0-1 día) → Nivel 3 José Ramos (vencido >= 2 días)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sgs_escalamientos (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  n_orden          TEXT NOT NULL,
  n_ticket         TEXT NOT NULL,
  nivel            INT  NOT NULL CHECK (nivel IN (1,2,3)),
  destinatario     TEXT NOT NULL,                   -- William Ochoa / Jahaira Sánchez / José Ramos
  rol              TEXT,
  canal            TEXT NOT NULL DEFAULT 'correo institucional',
  asunto           TEXT,
  cuerpo           TEXT,
  tat_estado       TEXT,                            -- por_vencer | vencido
  dias_restantes   INT,
  fecha_aviso      DATE NOT NULL DEFAULT (timezone('utc', now()))::date,
  origen           TEXT NOT NULL DEFAULT 'cron',    -- cron | manual
  atendido         BOOLEAN NOT NULL DEFAULT FALSE,  -- para marcar gestionado desde el dashboard
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Máximo un aviso por (orden + ticket + nivel + día): el reloj puede correr
-- varias veces al día sin duplicar avisos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sgs_escala_unico
  ON public.sgs_escalamientos (n_orden, n_ticket, nivel, fecha_aviso);

CREATE INDEX IF NOT EXISTS idx_sgs_escala_created ON public.sgs_escalamientos (created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 3. TRIGGER updated_at
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sgs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sgs_tickets_updated_at ON public.sgs_tickets;
CREATE TRIGGER sgs_tickets_updated_at
  BEFORE UPDATE ON public.sgs_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sgs_touch_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
-- 4. RLS — escritura SOLO servidor; navegador SOLO lectura
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.sgs_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgs_escalamientos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_sgs_tickets" ON public.sgs_tickets
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_select_sgs_tickets" ON public.sgs_tickets
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_sgs_escalamientos" ON public.sgs_escalamientos
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_select_sgs_escalamientos" ON public.sgs_escalamientos
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 5. STORAGE — bucket para las fotos de los tickets
--    Sube el servidor (service_role); lectura pública para el drill-down.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('sgs-tickets', 'sgs-tickets', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "public_read_sgs_tickets" ON storage.objects
    FOR SELECT USING (bucket_id = 'sgs-tickets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 6. SEMILLA DEMO (opcional — mismos 4 casos anonimizados del demo_run)
--    Solo inserta si la tabla está vacía. Bórrala cuando entren datos reales:
--    DELETE FROM sgs_tickets WHERE created_by = 'seed@alef.demo';
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO public.sgs_tickets
  (n_orden, n_ticket, fecha, sede, cliente, calidad_material, placa,
   peso_bruto, tara, peso_neto, sublote, fecha_ingreso_analisis, tat_dias,
   tat_estado, tat_dias_restantes, resultado_estado, verificado_humano,
   supervision, supervision_severidad, supervision_obs, created_by)
SELECT * FROM (VALUES
  ('OL218122-01','TK26-2976','11/07/2026','Matarani','CLIENTE A','CALIDAD X','CLR-726',
   76770::numeric, 18050::numeric, 58720::numeric,'SL-001',
   (timezone('utc', now()))::date - 2, 4,
   'en_plazo', 2, 'no_esta', TRUE, 'ok', NULL, NULL, 'seed@alef.demo'),
  ('OL218122-01','TK26-2977','11/07/2026','Matarani','CLIENTE A','CALIDAD X','BXK-431',
   81200::numeric, 19400::numeric, 61800::numeric,'SL-001',
   (timezone('utc', now()))::date - 3, 4,
   'por_vencer', 1, 'listo', TRUE, 'ok', NULL, NULL, 'seed@alef.demo'),
  ('OL218123-02','TK26-3001','12/07/2026','Pisco','CLIENTE B','CALIDAD Y','FGH-118',
   69500::numeric, 17800::numeric, 51700::numeric,'SL-002',
   (timezone('utc', now()))::date - 6, 4,
   'vencido', -2, 'no_esta', TRUE, 'ok', NULL, NULL, 'seed@alef.demo'),
  ('OL218124-03','TK26-3050','12/07/2026','Matarani','CLIENTE C','CALIDAD Z','JKL-905',
   74100::numeric, 18900::numeric, 55200::numeric,'SL-003',
   NULL, 4,
   'sin_fecha', NULL, 'leido', TRUE, 'revisar', 'media',
   'material/calidad con lectura dudosa en el ticket', 'seed@alef.demo')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.sgs_tickets);


-- ══════════════════════════════════════════════════════════════════════════
-- 7. VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════════════════
SELECT n_orden, n_ticket, sede, cliente, tat_estado, resultado_estado, supervision
FROM public.sgs_tickets ORDER BY created_at DESC;

COMMENT ON TABLE public.sgs_tickets IS
  'SGS — capa Recepción: un ticket de balanza catalogado por fila. Llave única (n_orden, n_ticket). Escrituras solo vía endpoints del servidor.';
COMMENT ON TABLE public.sgs_escalamientos IS
  'SGS — historial de avisos TAT de la cadena William Ochoa (N1) → Jahaira Sánchez (N2) → José Ramos (N3).';
