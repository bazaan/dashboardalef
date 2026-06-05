-- ══════════════════════════════════════════════════════════════════════════
-- DAVILA — Sistema de Pre-Reserva (tool validar_pre_reserva)
--
-- Tabla que respalda la tool de 4 operaciones (CREATE / UPDATE_PAGO /
-- CONFIRMAR / CANCELAR) del agente "Maria" de Miguel Davila.
--
-- Ciclo de estados:
--   pre_reservado → (paga en ≤40 min) → pagado → (envía datos) → confirmado
--   pre_reservado → (no paga en 40 min, CRON) → expirado
--   pre_reservado → (rechaza antes de pagar) → cancelado
--
-- Correr en Supabase → SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pre_reservas (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificador único del cliente (su número de WhatsApp). Es la clave de
  -- búsqueda en UPDATE_PAGO / CONFIRMAR / CANCELAR.
  celular             TEXT NOT NULL,

  -- ID legible de la pre-reserva (pre_xxxxxxxx)
  pre_reserva_id      TEXT UNIQUE NOT NULL,

  -- ID del evento en Google Calendar (para poder borrarlo al cancelar/expirar)
  calendar_event_id   TEXT,

  -- Datos de la cita
  fecha               DATE NOT NULL,
  hora                TEXT NOT NULL,          -- "16:00" (HH:MM 24h)

  -- Estado del ciclo de vida
  estado              TEXT NOT NULL DEFAULT 'pre_reservado'
                      CHECK (estado IN ('pre_reservado','pagado','confirmado','expirado','cancelado')),

  -- Timestamps del ciclo
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at          TIMESTAMPTZ NOT NULL,   -- created_at + 40 min
  pagado_en           TIMESTAMPTZ,
  confirmado_en       TIMESTAMPTZ,
  cancelado_en        TIMESTAMPTZ
);
-- NOTA (Junio 2026): la tool se simplificó a 4 parámetros. Ya no se guardan
-- datos personales ni duracion_min/metadata. Si tu tabla ya existe con esas
-- columnas, corré sql/davila_pre_reservas_simplificar.sql para eliminarlas.

-- RLS — solo el servidor (service_role) opera sobre esta tabla
ALTER TABLE public.pre_reservas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_pre_reservas" ON public.pre_reservas
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- (opcional) lectura anon para debugging desde el dashboard
DO $$ BEGIN
  CREATE POLICY "anon_select_pre_reservas" ON public.pre_reservas
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pre_reservas_celular_estado
  ON public.pre_reservas (celular, estado);
CREATE INDEX IF NOT EXISTS idx_pre_reservas_estado_expires
  ON public.pre_reservas (estado, expires_at)
  WHERE estado = 'pre_reservado';
CREATE INDEX IF NOT EXISTS idx_pre_reservas_pre_id
  ON public.pre_reservas (pre_reserva_id);
CREATE INDEX IF NOT EXISTS idx_pre_reservas_created
  ON public.pre_reservas (created_at DESC);

COMMENT ON TABLE  public.pre_reservas              IS 'Pre-reservas de citas de Miguel Davila (tool validar_pre_reserva del agente Maria)';
COMMENT ON COLUMN public.pre_reservas.celular      IS 'Número WhatsApp del cliente — identificador único de búsqueda';
COMMENT ON COLUMN public.pre_reservas.expires_at   IS 'created_at + 40 min. Si el cliente no paga antes, el CRON lo marca expirado';
COMMENT ON COLUMN public.pre_reservas.estado       IS 'pre_reservado | pagado | confirmado | expirado | cancelado';


-- ══════════════════════════════════════════════════════════════════════════
-- Verificación
-- ══════════════════════════════════════════════════════════════════════════
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pre_reservas'
ORDER BY ordinal_position;


-- ══════════════════════════════════════════════════════════════════════════
-- ROLLBACK:
-- DROP TABLE IF EXISTS public.pre_reservas CASCADE;
-- ══════════════════════════════════════════════════════════════════════════
