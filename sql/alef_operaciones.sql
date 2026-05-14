-- ══════════════════════════════════════════════════════
-- ALEF COMPANY — Operaciones internas del equipo
-- ══════════════════════════════════════════════════════

-- Brief diario / semanal del equipo
CREATE TABLE IF NOT EXISTS alef_briefs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha       DATE        NOT NULL DEFAULT CURRENT_DATE,
  titulo      TEXT        NOT NULL,
  contenido   TEXT        NOT NULL,
  prioridades JSONB       NOT NULL DEFAULT '[]',
  autor       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reporte diario por miembro del equipo
CREATE TABLE IF NOT EXISTS alef_reportes_diarios (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha        DATE        NOT NULL DEFAULT CURRENT_DATE,
  autor        TEXT        NOT NULL,  -- nombre del miembro
  cargo        TEXT        NOT NULL,
  logros       TEXT        NOT NULL,  -- qué hice hoy
  pendientes   TEXT        DEFAULT '',
  blockers     TEXT        DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, autor)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_briefs_fecha          ON alef_briefs(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha        ON alef_reportes_diarios(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha_autor  ON alef_reportes_diarios(fecha, autor);
