-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Leads capturados desde mensajes de Chatwoot (28/09/2026)
--
-- ⚠️ Superado en parte el 29/09/2026 por sql/tradecars_leads_chatwoot_asesor.sql (correr
-- ESE archivo TAMBIÉN, después de este): el índice único de acá quedó sobre `telefono`,
-- pero se reemplazó por uno sobre `conversation_id` para poder asignar cada conversación
-- nueva de un cliente que repite a su mismo asesor. Ver ese archivo para el motivo completo.
--
-- Cuando alguien llena un formulario de Meta (IG/FB) y el mensaje llega como
-- texto libre a una conversación de Chatwoot (ej. "¡Hola! Completé el
-- formulario... Marca: Suzuki, Modelo: Ciaz, ..."), un flujo de n8n con un
-- nodo de IA lee ese mensaje, lo ordena en campos, y llama a
-- POST /api/tradecars/chatwoot-lead con el JSON ya estructurado.
--
-- El endpoint es el que decide si ya existe un lead con ese TELÉFONO — si ya
-- existe, no hace nada (no pisa lo que el equipo ya esté trabajando). El
-- índice único de acá es el segundo seguro, por si el webhook de n8n dispara
-- dos veces para el mismo mensaje.
--
-- Deliberadamente NO tiene todavía columna de asesor/asignación: eso es un
-- paso aparte, pendiente a pedido explícito del cliente (primero esta
-- captura, después "asignar tarjetas a los agentes").
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_leads_chatwoot (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identidad del contacto (el teléfono es la clave de deduplicación)
  telefono          TEXT NOT NULL,
  nombre_chatwoot   TEXT,
  correo            TEXT,

  -- Datos del vehículo, extraídos del mensaje por el nodo de IA de n8n
  marca             TEXT,
  modelo            TEXT,
  anio              INTEGER,
  kilometraje       INTEGER,
  placa             TEXT,
  distrito          TEXT,

  -- Trazabilidad de origen (Chatwoot + el mensaje crudo, para revisar si la IA se equivocó)
  mensaje_original  TEXT,
  conversation_id   BIGINT,
  account_id        BIGINT,
  inbox_id          BIGINT,
  payload           JSONB,                  -- body crudo que mandó n8n

  estado            TEXT DEFAULT 'nuevo',   -- por ahora solo informativo; sin flujo propio todavía
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Un teléfono = un lead. `ON CONFLICT DO NOTHING` en el endpoint se apoya en esto.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_leads_chatwoot_telefono ON public.tradecars_leads_chatwoot (telefono);
CREATE INDEX IF NOT EXISTS idx_tc_leads_chatwoot_created ON public.tradecars_leads_chatwoot (created_at DESC);

ALTER TABLE public.tradecars_leads_chatwoot ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que el resto de tablas operativas de Trade Cars (ver tradecars_tables.sql §8):
-- anon con FOR ALL porque el dashboard (cuando tenga su pantalla) escribe desde el navegador.
DO $$
BEGIN
  BEGIN
    CREATE POLICY "service_all_tradecars_leads_chatwoot" ON public.tradecars_leads_chatwoot
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY "anon_all_tradecars_leads_chatwoot" ON public.tradecars_leads_chatwoot
      TO anon USING (true) WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMENT ON TABLE public.tradecars_leads_chatwoot IS
  'Leads capturados desde mensajes de Chatwoot (formulario de Meta relayado como texto), parseados por un nodo de IA en n8n y guardados por POST /api/tradecars/chatwoot-lead. Deduplicado por telefono.';
