-- Migración: agrega soporte para flujo de suscripciones Yape on-file en ecs_pagos_monnet
-- Correr en Supabase → SQL Editor
--
-- Contexto:
-- El merchant 1142 de ECS en Monnet solo tiene habilitado Yape via "Yape_on_file".
-- El flujo es de 3 etapas:
--   1. Crear suscripción → Monnet devuelve subscriptionId + deepLink
--   2. Cliente autoriza la suscripción en su app Yape (off-platform)
--   3. Webhook activa la suscripción → backend dispara el cobro automáticamente
--
-- Estados de `estado` (TEXT):
--   pendiente_autorizacion → suscripción creada, esperando autorización del cliente en Yape
--   cobrando               → suscripción autorizada, cobro enviado a Monnet, esperando confirmación
--   pagado                 → cobro confirmado por webhook
--   fallido                → suscripción rechazada o cobro rechazado
--   expirado               → suscripción/cobro expiró

ALTER TABLE ecs_pagos_monnet
  ADD COLUMN IF NOT EXISTS subscription_id      BIGINT,
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT,      -- PENDING | AUTHORIZED | DENIED | CANCELLED | EXPIRED | FAILED
  ADD COLUMN IF NOT EXISTS processor_code       TEXT,      -- Yape_on_file | (futuro: TCTD, etc.)
  ADD COLUMN IF NOT EXISTS deep_link            TEXT,      -- URL Yape que el cliente abre para autorizar
  ADD COLUMN IF NOT EXISTS payload_webhook_sub  JSONB;     -- payload del webhook de subscription update

-- Índices nuevos
CREATE INDEX IF NOT EXISTS idx_ecs_pagos_subscription ON ecs_pagos_monnet (subscription_id);
CREATE INDEX IF NOT EXISTS idx_ecs_pagos_sub_status   ON ecs_pagos_monnet (subscription_status);
