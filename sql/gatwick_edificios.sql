-- ══════════════════════════════════════════════════════════════════════════
-- GATWICK — Tabla de edificios (catálogo para la tool "buscando_edificio")
--
-- Esta tabla YA EXISTE en Supabase con datos cargados. Este archivo solo
-- documenta su estructura (idempotente — no borra datos) por si hace falta
-- recrearla o auditarla.
--
-- La tool POST /api/gatwick/buscar-edificio busca aquí por elme / nombre /
-- direccion / distrito.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gatwick_edificios (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  elme                    TEXT,                 -- código ELME (puede repetirse entre edificios)
  nombre                  TEXT,                 -- "EDIFICIO BRESCIANI"
  direccion               TEXT,                 -- "Pasaje Bresciani 145"
  distrito                TEXT,                 -- "Barranco"
  es_instalacion_critica  BOOLEAN DEFAULT FALSE,
  equipos                 JSONB,                -- [{ tipo, paradas, variante }]
  activo                  BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at              TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Índices para acelerar las búsquedas por texto (la tool igual filtra en memoria,
-- pero estos ayudan si en el futuro se hace ILIKE en SQL).
CREATE INDEX IF NOT EXISTS idx_gatwick_edificios_elme     ON public.gatwick_edificios (elme);
CREATE INDEX IF NOT EXISTS idx_gatwick_edificios_distrito ON public.gatwick_edificios (distrito);
CREATE INDEX IF NOT EXISTS idx_gatwick_edificios_activo   ON public.gatwick_edificios (activo) WHERE activo = true;

-- RLS (si no estaba habilitado). La tool usa service_role.
ALTER TABLE public.gatwick_edificios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_all_gatwick_edificios" ON public.gatwick_edificios
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "anon_select_gatwick_edificios" ON public.gatwick_edificios
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.gatwick_edificios IS 'Catálogo de edificios de Gatwick. Búsqueda por elme/nombre/direccion/distrito (tool buscando_edificio).';
