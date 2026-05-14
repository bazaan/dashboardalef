-- ══════════════════════════════════════════════════════
-- ALEF — Sistema de Tickets de Soporte
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alef_tickets (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      TEXT        NOT NULL,
  empresa_nombre  TEXT        NOT NULL,
  titulo          TEXT        NOT NULL,
  descripcion     TEXT        NOT NULL,
  categoria       TEXT        NOT NULL, -- prompt_estandar | prompt_avanzado | dashboard | infraestructura | escalado
  urgencia        TEXT        NOT NULL DEFAULT 'media', -- baja | media | alta | critica
  estado          TEXT        NOT NULL DEFAULT 'abierto', -- abierto | en_progreso | resuelto | cerrado
  asignado_a      TEXT        NOT NULL, -- Julio | Piero | Roberto | Juan Pablo
  creado_por      TEXT        NOT NULL,
  ia_razon        TEXT,       -- explicación del por qué la IA lo asignó así
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resuelto_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alef_ticket_comentarios (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id       UUID        NOT NULL REFERENCES alef_tickets(id) ON DELETE CASCADE,
  autor           TEXT        NOT NULL,
  contenido       TEXT        NOT NULL,
  es_nota_interna BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_empresa   ON alef_tickets(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado    ON alef_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_asignado  ON alef_tickets(asignado_a);
CREATE INDEX IF NOT EXISTS idx_tickets_created   ON alef_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comentarios_ticket ON alef_ticket_comentarios(ticket_id);
