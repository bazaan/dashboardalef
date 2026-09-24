-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Solicitudes · formularios: IG, FB y TikTok desde Google Sheets
--
-- Correr UNA vez en el SQL Editor de Supabase. Es idempotente: se puede volver a
-- correr sin duplicar ni pisar nada.
--
-- Los leads de Instagram, Facebook y TikTok no llegan por la web de Trade Cars:
-- Zapier los vuelca en un Google Sheet por canal. El dashboard LEE esa hoja en vivo
-- cada vez que se abre el submódulo, así que los datos del lead NO se copian acá.
-- Lo que sí necesita guardarse en la base es:
--
--   1. tradecars_formularios_config  — qué hoja es la de cada canal (se edita desde el
--                                      dashboard: "Conectar hoja"). Sin esta tabla la
--                                      conexión solo puede hacerse con variables de entorno.
--   2. tradecars_formularios_estado  — lo que el equipo hace con cada tarjeta: estado,
--                                      notas, precio ofrecido, cliente creado. La hoja es de
--                                      solo lectura, así que esto no puede vivir en ella.
--
-- Las dos tablas quedan SOLO para el servidor (service_role): guardan nombres y teléfonos de
-- personas, así que no se abren a la key pública como otras tablas de Trade Cars. Todo pasa
-- por /api/tradecars/formularios, que sí verifica el rol.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Qué hoja de Google es la de cada canal
CREATE TABLE IF NOT EXISTS public.tradecars_formularios_config (
  canal          TEXT PRIMARY KEY CHECK (canal IN ('ig', 'fb', 'tiktok')),
  sheet_id       TEXT,                                   -- el ID de la hoja (sale del enlace)
  pestana        TEXT,                                   -- nombre de la pestaña; vacío = la del enlace o la primera
  gid            BIGINT,                                 -- pestaña tomada del enlace (#gid=…)
  mapeo          JSONB NOT NULL DEFAULT '{}'::jsonb,     -- correcciones a mano: campo → encabezado de la hoja
  conectado_por  TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tradecars_formularios_config IS
  'Hoja de Google de cada canal de formularios (ig | fb | tiktok). Se edita desde el dashboard.';
COMMENT ON COLUMN public.tradecars_formularios_config.mapeo IS
  'Correcciones a la detección automática de columnas. Ej: {"celular": "Tel 2", "nombre": "Nombres|Apellidos"}';

INSERT INTO public.tradecars_formularios_config (canal)
VALUES ('ig'), ('fb'), ('tiktok')
ON CONFLICT (canal) DO NOTHING;


-- 2. Estado de cada tarjeta
CREATE TABLE IF NOT EXISTS public.tradecars_formularios_estado (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal            TEXT NOT NULL CHECK (canal IN ('ig', 'fb', 'tiktok')),
  -- Identidad estable del lead. NO es el n.º de fila de la hoja (se mueve si alguien ordena o borra
  -- filas): es el ID del formulario si la hoja lo trae, o un hash de fecha+teléfono+correo+nombre.
  lead_key         TEXT NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'nuevo',        -- nuevo | contactado | tasado | comprado | descartado
  notas            TEXT,
  precio_ofrecido  NUMERIC(12,2),
  cliente_id       UUID,                                 -- tradecars_clientes.id, si se creó el cliente desde la tarjeta
  atendido_por     TEXT,
  atendido_en      TIMESTAMPTZ,
  -- Copia mínima del lead (nombre, celular, correo, fecha, vehículo) para seguir mostrando la tarjeta
  -- si alguien borra la fila de la hoja después de haber trabajado ese lead.
  resumen          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canal, lead_key)
);

CREATE INDEX IF NOT EXISTS idx_tc_form_estado_canal
  ON public.tradecars_formularios_estado (canal, estado);

COMMENT ON TABLE public.tradecars_formularios_estado IS
  'Trabajo del equipo sobre cada lead de los formularios IG/FB/TikTok. Los datos del lead viven en la hoja de Google.';


-- 3. Solo el servidor las toca (service_role). Sin policy para anon a propósito.
ALTER TABLE public.tradecars_formularios_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_formularios_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_tradecars_formularios_config" ON public.tradecars_formularios_config;
CREATE POLICY "service_all_tradecars_formularios_config" ON public.tradecars_formularios_config
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "service_all_tradecars_formularios_estado" ON public.tradecars_formularios_estado;
CREATE POLICY "service_all_tradecars_formularios_estado" ON public.tradecars_formularios_estado
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Verificación rápida (opcional): deben salir las 3 filas de canales, y la otra tabla vacía
-- SELECT * FROM public.tradecars_formularios_config ORDER BY canal;
-- SELECT COUNT(*) FROM public.tradecars_formularios_estado;
