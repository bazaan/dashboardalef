-- Tabla de pagos Monnet para Estás Con Suerte
-- Corre esto en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS ecs_pagos_monnet (
  id                          BIGSERIAL PRIMARY KEY,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  paid_at                     TIMESTAMPTZ,

  -- Identificador único de la transacción
  operation_number            TEXT UNIQUE NOT NULL,

  -- Datos del cliente
  cliente_nombre              TEXT,
  cliente_email               TEXT,
  cliente_telefono            TEXT,
  cliente_dni                 TEXT,

  -- Datos del plan / venta
  plan_nombre                 TEXT,
  monto                       NUMERIC(10, 2) NOT NULL,
  moneda                      TEXT DEFAULT 'PEN',

  -- Estado del pago
  estado                      TEXT DEFAULT 'pendiente',   -- pendiente | pagado | fallido | expirado
  monnet_state_id             INTEGER,
  monnet_state                TEXT,
  monnet_method               TEXT,                       -- Wallet, Card, Cash, etc.
  monnet_trx_operation        TEXT,                       -- ID que Monnet asigna al pago
  monnet_error_code           TEXT,
  monnet_error_message        TEXT,

  -- Link de pago devuelto por Monnet (lo que se envía al cliente)
  link_pago                   TEXT,

  -- Datos para enviar confirmación al cliente vía Chatwoot
  chatwoot_account_id         INTEGER,
  chatwoot_inbox_id           INTEGER,
  chatwoot_conversation_id    INTEGER,
  confirmacion_enviada        BOOLEAN DEFAULT FALSE,

  -- Trazabilidad completa (para debugging)
  payload_request             JSONB,                      -- body que enviamos a Monnet
  payload_response            JSONB,                      -- respuesta de Monnet al crear
  payload_webhook             JSONB                       -- payload del webhook de confirmación
);

-- RLS
ALTER TABLE ecs_pagos_monnet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_ecs_pagos"
  ON ecs_pagos_monnet FOR SELECT TO anon   USING (true);

CREATE POLICY "service_all_ecs_pagos"
  ON ecs_pagos_monnet FOR ALL    TO service_role USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ecs_pagos_operation   ON ecs_pagos_monnet (operation_number);
CREATE INDEX IF NOT EXISTS idx_ecs_pagos_estado_date ON ecs_pagos_monnet (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecs_pagos_telefono    ON ecs_pagos_monnet (cliente_telefono);
