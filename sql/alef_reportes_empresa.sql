-- ══════════════════════════════════════════════════════
-- ALEF — Reportes Diarios por Empresa
-- Un reporte por empresa por día, visible desde AlefCompany
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alef_reportes_empresa (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
  empresa_id      TEXT        NOT NULL,
  empresa_nombre  TEXT        NOT NULL,
  autor           TEXT        NOT NULL,  -- nombre de quien envía el reporte
  resumen         TEXT        NOT NULL,  -- qué pasó hoy en la empresa
  logros          TEXT        DEFAULT '',
  pendientes      TEXT        DEFAULT '',
  blockers        TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, empresa_id)              -- un reporte por empresa por día
);

CREATE INDEX IF NOT EXISTS idx_reportes_empresa_fecha   ON alef_reportes_empresa(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_empresa_empresa ON alef_reportes_empresa(empresa_id);
