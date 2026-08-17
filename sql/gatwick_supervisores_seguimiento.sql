-- Gatwick — separar audiencia de "aviso de emergencia" vs "aviso de progreso"
-- ══════════════════════════════════════════════════════════════════════════
-- Hasta ahora gatwick_supervisores solo tenía `activo`: todos los activos
-- recibían TODO (emergencia nueva + en_camino + atendiendo + finalizada).
--
-- `recibe_seguimiento` permite que una conversación reciba SOLO el aviso de
-- que hay una emergencia nueva (activo=true, recibe_seguimiento=false), o
-- además todo el progreso del técnico (recibe_seguimiento=true).
--
-- Ver server/utils/gatwick-tracking.ts → avisarSupervisores(supabase, mensaje, tipo)

ALTER TABLE public.gatwick_supervisores
  ADD COLUMN IF NOT EXISTS recibe_seguimiento BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.gatwick_supervisores.recibe_seguimiento IS
  'Si es TRUE, además del aviso de emergencia nueva recibe los avisos de progreso (en_camino, atendiendo, finalizada, cancelada). Si es FALSE, solo recibe el aviso inicial de emergencia.';

-- Config pedida por Gatwick para las pruebas actuales:
--   conversación 14 → SOLO el aviso de emergencia nueva
--   conversación 59 → emergencia + todo el progreso del técnico
UPDATE public.gatwick_supervisores SET recibe_seguimiento = FALSE
  WHERE chatwoot_account_id = 15 AND chatwoot_conversation_id = 14;
UPDATE public.gatwick_supervisores SET recibe_seguimiento = TRUE
  WHERE chatwoot_account_id = 15 AND chatwoot_conversation_id = 59;

SELECT nombre, chatwoot_account_id, chatwoot_conversation_id, activo, recibe_seguimiento
FROM public.gatwick_supervisores ORDER BY orden;
