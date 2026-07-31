-- ══════════════════════════════════════════════════════════════════════════
-- GATWICK — Seguimiento GPS de técnicos en emergencias
--
-- Flujo que habilita:
--   1. El técnico abre una emergencia en el dashboard y toca "Comenzar".
--   2. Se crea un SEGUIMIENTO con un token único y se le da un link privado.
--   3. En ese link el técnico transmite su GPS y avanza por 3 estados:
--        iniciado → en_camino → atendiendo → finalizada
--      "Atendiendo" solo se habilita cuando el GPS lo ubica en el destino.
--   4. Cada cambio de estado notifica por WhatsApp (Chatwoot) a los supervisores,
--      con un link de solo-lectura donde ven el mapa en vivo, la ruta y el ETA.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. Columnas nuevas en gatwick_emergencias
--    El agente de emergencias entrega el CÓDIGO DEL ASCENSOR (AP-0001, MV-0002…);
--    con él se resuelve el edificio y se copian dirección/distrito/ELME.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gatwick_emergencias
  ADD COLUMN IF NOT EXISTS codigo_ascensor TEXT,
  ADD COLUMN IF NOT EXISTS edificio_id     UUID,
  ADD COLUMN IF NOT EXISTS edificio_nombre TEXT,
  ADD COLUMN IF NOT EXISTS distrito        TEXT,
  ADD COLUMN IF NOT EXISTS elme            TEXT,
  ADD COLUMN IF NOT EXISTS destino_lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destino_lng     DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_gatwick_emerg_codigo ON public.gatwick_emergencias (codigo_ascensor);


-- ══════════════════════════════════════════════════════════════════════════
-- 2. SEGUIMIENTOS — un "viaje" del técnico a una emergencia
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gatwick_seguimientos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  emergencia_id     BIGINT NOT NULL REFERENCES public.gatwick_emergencias(id) ON DELETE CASCADE,
  tecnico_id        BIGINT REFERENCES public.gatwick_tecnicos(id),
  tecnico_nombre    TEXT,
  tecnico_telefono  TEXT,

  -- Token del link privado (el técnico y los supervisores entran con él).
  -- Se genera en el servidor; es la única credencial de las páginas públicas.
  token             TEXT NOT NULL UNIQUE,

  estado            TEXT NOT NULL DEFAULT 'iniciado'
                    CHECK (estado IN ('iniciado','en_camino','atendiendo','finalizada','cancelada')),

  -- Destino (copiado del edificio al iniciar, para que el link no dependa de joins)
  destino_direccion TEXT,
  destino_lat       DOUBLE PRECISION,
  destino_lng       DOUBLE PRECISION,

  -- Última posición conocida del técnico (se actualiza en cada ping)
  ultima_lat        DOUBLE PRECISION,
  ultima_lng        DOUBLE PRECISION,
  ultima_precision  DOUBLE PRECISION,
  ultima_velocidad  DOUBLE PRECISION,
  ultimo_ping       TIMESTAMPTZ,

  distancia_destino_m  DOUBLE PRECISION,   -- metros al destino en el último ping
  eta_segundos         INTEGER,            -- ETA calculado por el ruteador

  -- Sellos de tiempo de cada transición
  iniciado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  en_camino_en      TIMESTAMPTZ,
  atendiendo_en     TIMESTAMPTZ,
  finalizada_en     TIMESTAMPTZ,

  -- Snapshot de la emergencia (para el mensaje y el historial, aunque cambie)
  snapshot          JSONB,
  notas_cierre      TEXT,
  creado_por        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gatwick_seg_emerg   ON public.gatwick_seguimientos (emergencia_id);
CREATE INDEX IF NOT EXISTS idx_gatwick_seg_estado  ON public.gatwick_seguimientos (estado);
CREATE INDEX IF NOT EXISTS idx_gatwick_seg_created ON public.gatwick_seguimientos (created_at DESC);

-- Un solo seguimiento ACTIVO por emergencia (no dos técnicos en paralelo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gatwick_seg_activo_unico
  ON public.gatwick_seguimientos (emergencia_id)
  WHERE estado IN ('iniciado','en_camino','atendiendo');


-- ══════════════════════════════════════════════════════════════════════════
-- 3. PUNTOS GPS — el recorrido (para dibujar la ruta real y auditar)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gatwick_tracking_puntos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seguimiento_id BIGINT NOT NULL REFERENCES public.gatwick_seguimientos(id) ON DELETE CASCADE,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  precision_m    DOUBLE PRECISION,
  velocidad      DOUBLE PRECISION,
  rumbo          DOUBLE PRECISION,
  estado         TEXT,                       -- estado del seguimiento en ese momento
  registrado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gatwick_puntos_seg
  ON public.gatwick_tracking_puntos (seguimiento_id, registrado_en);


-- ══════════════════════════════════════════════════════════════════════════
-- 4. SUPERVISORES — a quiénes se avisa por WhatsApp (Chatwoot)
--    Editable sin redeploy: agrega/quita filas y listo.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gatwick_supervisores (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                    TEXT NOT NULL,
  chatwoot_account_id       INTEGER NOT NULL,
  chatwoot_conversation_id  INTEGER NOT NULL,
  activo                    BOOLEAN NOT NULL DEFAULT TRUE,
  orden                     INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gatwick_sup_conv_unica UNIQUE (chatwoot_account_id, chatwoot_conversation_id)
);

-- Los 2 chats indicados por Gatwick (cuenta 15, conversaciones 14 y 59)
INSERT INTO public.gatwick_supervisores (nombre, chatwoot_account_id, chatwoot_conversation_id, orden)
VALUES ('Supervisor 1', 15, 14, 1),
       ('Supervisor 2', 15, 59, 2)
ON CONFLICT (chatwoot_account_id, chatwoot_conversation_id) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
-- 5. Trigger updated_at
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.gatwick_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gatwick_seg_updated_at ON public.gatwick_seguimientos;
CREATE TRIGGER gatwick_seg_updated_at
  BEFORE UPDATE ON public.gatwick_seguimientos
  FOR EACH ROW EXECUTE FUNCTION public.gatwick_touch_updated_at();


-- ══════════════════════════════════════════════════════════════════════════
-- 6. REALTIME — el mapa del supervisor se mueve solo
-- ══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gatwick_seguimientos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gatwick_tracking_puntos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 7. RLS
--    Escrituras SOLO por los endpoints del servidor (service_role): así el
--    token del link no permite falsear posiciones ni saltarse los estados.
--    Lectura anon: la usa el dashboard interno (ya autenticado).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.gatwick_seguimientos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatwick_tracking_puntos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gatwick_supervisores     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['gatwick_seguimientos','gatwick_tracking_puntos','gatwick_supervisores'] LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE format('CREATE POLICY "anon_select_%s" ON public.%I FOR SELECT TO anon USING (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 8. VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════════════════
SELECT 'supervisores' AS tabla, COUNT(*) FROM public.gatwick_supervisores
UNION ALL SELECT 'seguimientos', COUNT(*) FROM public.gatwick_seguimientos
UNION ALL SELECT 'puntos', COUNT(*) FROM public.gatwick_tracking_puntos;

COMMENT ON TABLE public.gatwick_seguimientos IS
  'Gatwick — seguimiento GPS de un técnico atendiendo una emergencia. Estados: iniciado → en_camino → atendiendo → finalizada.';
COMMENT ON TABLE public.gatwick_tracking_puntos IS
  'Gatwick — recorrido GPS punto a punto de cada seguimiento.';
COMMENT ON TABLE public.gatwick_supervisores IS
  'Gatwick — conversaciones de Chatwoot que reciben los avisos de emergencia.';
