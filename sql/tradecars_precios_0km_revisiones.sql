-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Revisiones de la pestaña "Precios vehículos nuevos" (30/09/2026)
--
-- Correr UNA VEZ en Supabase (SQL Editor). Idempotente. Va DESPUÉS de
-- sql/tradecars_control_sync_precios.sql.
--
-- El bot semanal de precios 0km (n8n) deja en su log dos tipos de hallazgos
-- que NO aplica solo:
--   · "salto_revision": el precio encontrado difiere más de 15 % del que está
--     en tradecars_data_precios_vehiculos_nuevos.
--   · "nuevo_no_insertado": una versión que no está en la tabla.
-- La pestaña "Precios vehículos nuevos" del dashboard los lista para que un
-- administrador los APLIQUE o los DESCARTE. Esta tabla guarda cada decisión:
-- sin ella, un hallazgo descartado volvería a aparecer en cada carga.
--
-- Un descarte vale para ESE precio: si una corrida posterior encuentra otro
-- precio para la misma versión, vuelve a aparecer como pendiente.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_precios_0km_revisiones (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave                  TEXT NOT NULL,     -- MARCA|MODELO|VERSION|AÑO normalizado (sin tildes ni símbolos)
  tipo                   TEXT NOT NULL CHECK (tipo IN ('salto', 'nuevo')),
  decision               TEXT NOT NULL CHECK (decision IN ('aplicado', 'descartado')),

  marca                  TEXT,
  modelo                 TEXT,
  version                TEXT,
  anio_modelo            INTEGER,
  precio_encontrado_usd  NUMERIC,
  precio_anterior_usd    NUMERIC,          -- el que había en la tabla al decidir (solo 'salto')
  url_fuente             TEXT,

  fila_id                BIGINT,           -- fila de tradecars_data_precios_vehiculos_nuevos tocada/creada
  corrida_id             BIGINT,           -- tradecars_control_sync_precios.id donde se encontró
  decidido_por           TEXT,
  decidido_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_precios0km_revisiones_clave
  ON public.tradecars_precios_0km_revisiones (clave);

COMMENT ON TABLE public.tradecars_precios_0km_revisiones IS
  'Decisiones (aplicar / descartar) sobre los hallazgos del bot semanal de precios 0km que no se aplican solos. La escribe solo el endpoint /api/tradecars/precios-0km.';

-- Sin policy para `anon`: solo el servidor del dashboard (service_role).
ALTER TABLE public.tradecars_precios_0km_revisiones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_precios0km_revisiones" ON public.tradecars_precios_0km_revisiones
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VERIFICACIÓN (opcional)
-- SELECT decidido_en, decision, tipo, marca, modelo, version, anio_modelo,
--        precio_anterior_usd, precio_encontrado_usd, decidido_por
--   FROM public.tradecars_precios_0km_revisiones ORDER BY decidido_en DESC LIMIT 20;
