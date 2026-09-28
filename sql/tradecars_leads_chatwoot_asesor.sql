-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Asignación de asesor por conversación + continuidad por teléfono (29/09/2026)
--
-- Pedido del cliente: antes de repartir una conversación nueva al azar (round robin), si el
-- TELÉFONO ya tuvo una conversación anterior con un asesor asignado, la conversación nueva se
-- deriva al MISMO asesor (continuidad) en vez de a uno random.
--
-- Para que eso funcione hace falta que CADA conversación tenga su propia fila en
-- tradecars_leads_chatwoot — antes la deduplicación era por TELÉFONO ("un teléfono = una fila
-- para siempre"), lo que bloqueaba silenciosamente la fila de la segunda conversación de un
-- cliente que vuelve a escribir. Se cambia la clave de deduplicación a CONVERSATION_ID: lo
-- que se sigue evitando duplicar es la MISMA conversación reprocesada (reintentos de webhook),
-- no las conversaciones nuevas de un cliente que repite.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

-- Columnas que el cliente ya había agregado a mano en Supabase (probado en vivo el
-- 28/09/2026) — se agregan acá también para que el esquema del repo coincida con la base
-- real. IF NOT EXISTS: no rompe nada si ya existen.
ALTER TABLE public.tradecars_leads_chatwoot ADD COLUMN IF NOT EXISTS asesor_asignado TEXT;
ALTER TABLE public.tradecars_leads_chatwoot ADD COLUMN IF NOT EXISTS id_asesor_asignado INTEGER;

-- Cambio de clave de deduplicación: de TELEFONO (único) a CONVERSATION_ID (único).
DROP INDEX IF EXISTS idx_tc_leads_chatwoot_telefono;
CREATE INDEX IF NOT EXISTS idx_tc_leads_chatwoot_telefono ON public.tradecars_leads_chatwoot (telefono);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_leads_chatwoot_conversation_id ON public.tradecars_leads_chatwoot (conversation_id);

COMMENT ON COLUMN public.tradecars_leads_chatwoot.asesor_asignado IS
  'Nombre del asesor de Chatwoot al que se derivó esta conversación. Lo escribe el flujo de n8n "ASIGNACION ASESOR-TRADECARS", no el endpoint /api/tradecars/chatwoot-lead.';
COMMENT ON COLUMN public.tradecars_leads_chatwoot.id_asesor_asignado IS
  'Id del agente de Chatwoot (assignee_id) al que se derivó esta conversación.';
