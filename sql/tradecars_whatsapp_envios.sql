-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Envíos de la plantilla de WhatsApp desde las tarjetas (30/09/2026)
--
-- Correr UNA VEZ en Supabase (SQL Editor). Idempotente.
--
-- El botón "WhatsApp" de cada tarjeta de "Solicitudes - formularios" (Web, IG, FB,
-- TikTok, Sin plataforma) ya no abre wa.me: envía la plantilla aprobada de Meta
-- (iniciar_conversacion_2) por Chatwoot (cuenta 17, bandeja 88 "Trade Cars Perú")
-- y asigna la conversación al asesor de la tarjeta. Esta tabla guarda cada envío:
-- con ella la tarjeta muestra "Enviada el X por Y" + "Abrir en Chatwoot" y pide una
-- segunda confirmación antes de reenviar.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_whatsapp_envios (
  id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal                     TEXT NOT NULL,     -- 'web' | 'ig' | 'fb' | 'tiktok' | 'sin_plataforma'
  tarjeta_ref               TEXT NOT NULL,     -- web: 'venta:<uuid>' / 'compra:<uuid>'; hojas: lead_key
  telefono                  TEXT NOT NULL,     -- E.164 (+51…)
  nombre                    TEXT,
  plantilla                 TEXT NOT NULL,
  estado                    TEXT NOT NULL CHECK (estado IN ('enviado', 'fallido')),
  estado_whatsapp           TEXT,              -- lo que reporta Chatwoot: sent / delivered / read / failed
  error                     TEXT,

  chatwoot_account_id       INTEGER,
  chatwoot_inbox_id         INTEGER,
  chatwoot_contact_id       BIGINT,
  chatwoot_conversation_id  BIGINT,
  chatwoot_message_id       BIGINT,
  conversacion_nueva        BOOLEAN,
  asignado_agente_id        INTEGER,           -- agente de Chatwoot al que quedó asignada
  asignado_nombre           TEXT,

  asesor_email              TEXT,              -- asesor de la tarjeta al momento de enviar
  enviado_por               TEXT NOT NULL,
  enviado_en                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_whatsapp_envios_tarjeta
  ON public.tradecars_whatsapp_envios (canal, tarjeta_ref, enviado_en DESC);

COMMENT ON TABLE public.tradecars_whatsapp_envios IS
  'Cada envío de la plantilla de WhatsApp (Chatwoot) desde una tarjeta de Solicitudes - formularios. La escribe solo /api/tradecars/whatsapp-plantilla.';

-- Sin policy para `anon`: hay teléfonos de clientes. Solo el servidor (service_role).
ALTER TABLE public.tradecars_whatsapp_envios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_whatsapp_envios" ON public.tradecars_whatsapp_envios
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VERIFICACIÓN (opcional)
-- SELECT enviado_en, canal, nombre, telefono, estado, estado_whatsapp, asignado_nombre, enviado_por, error
--   FROM public.tradecars_whatsapp_envios ORDER BY enviado_en DESC LIMIT 20;
