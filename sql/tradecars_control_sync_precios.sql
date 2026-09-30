-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Log del bot semanal de precios 0km (n8n + búsqueda web con IA)
--
-- Correr UNA VEZ en Supabase (SQL Editor). Idempotente.
--
-- El flujo de n8n "TRADECARS | Precios 0km | Búsqueda web semanal (IA)"
-- (referencia/n8n/tradecars-precios-0km-workflow.json) busca cada domingo el
-- precio de lista 0km en Perú de cada marca+modelo del histórico de
-- compras/ventas y actualiza tradecars_data_precios_vehiculos_nuevos. Cada
-- ejecución deja UNA fila acá: qué buscó, qué encontró, qué escribió y qué
-- dejó para revisar. `detalle_json` guarda cada precio observado (con su URL),
-- así que esta tabla es también el historial semana a semana de lo que
-- publicaban los concesionarios.
--
-- Especificación de origen: Especificacion_Flujo_Precios_Nuevos_v1.txt (Alef,
-- 30/09/2026), Parte 4 / Nodo 9. Las columnas se adaptaron al método elegido
-- (búsqueda por marca+modelo en vez de scraping por distribuidor), por eso hay
-- `total_modelos` en lugar de `total_distribuidores`.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_control_sync_precios (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_ejecucion       TIMESTAMPTZ NOT NULL DEFAULT now(),
  origen                TEXT,                       -- 'cron' (domingo) | 'manual' (botón de n8n)
  simulado              BOOLEAN NOT NULL DEFAULT false,  -- true = no escribió en la tabla de precios
  modelo_ia             TEXT,

  total_modelos         INTEGER,   -- marca+modelo buscados
  exitosos              INTEGER,   -- con al menos un precio válido
  fallidos              INTEGER,   -- la búsqueda falló (error de OpenAI, respuesta ilegible)
  sin_resultado         INTEGER,   -- no hay precio 0km en Perú (descontinuado, no importado) o todo se descartó

  actualizados          INTEGER,   -- precio cambiado (dentro del umbral)
  confirmados           INTEGER,   -- mismo precio: solo se renovó fecha_ultimo_precio / url_fuente
  insertados            INTEGER,   -- versiones nuevas agregadas a la tabla
  nuevos_no_insertados  INTEGER,   -- versiones nuevas que no entraron (fuente='web' no permitida)
  saltos_revision       INTEGER,   -- cambio mayor al umbral: NO se aplicó, revisar a mano
  descartados           INTEGER,   -- no pasaron la validación (URL no verificada, precio/año fuera de rango)
  errores_escritura     INTEGER,

  tipo_cambio_pen_usd   NUMERIC,
  tipo_cambio_origen    TEXT,
  costo_estimado_usd    NUMERIC,
  duracion_seg          INTEGER,
  detalle_json          JSONB
);

CREATE INDEX IF NOT EXISTS idx_tc_control_sync_precios_fecha
  ON public.tradecars_control_sync_precios (fecha_ejecucion DESC);

COMMENT ON TABLE public.tradecars_control_sync_precios IS
  'Una fila por ejecución del bot semanal de precios 0km (n8n). detalle_json = cada precio observado por marca+modelo, con URL, acción tomada y motivo.';

-- Sin policy para `anon`: el acceso es desde n8n con la service_role.
ALTER TABLE public.tradecars_control_sync_precios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_control_sync_precios" ON public.tradecars_control_sync_precios
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- OPCIONAL — permitir fuente = 'web' en la tabla de precios 0km
-- ──────────────────────────────────────────────────────────────────────────
-- Hoy el CHECK de `fuente` solo acepta 'manual' / 'wigo' / 'autoland'
-- (verificado en vivo el 30/09/2026: 'web' se rechaza). Como `fuente` es
-- NOT NULL sin valor por defecto, el bot:
--   · al ACTUALIZAR una fila existente no manda `fuente` (la fila conserva la suya);
--   · NO puede INSERTAR modelos/versiones nuevas: los deja en el log como
--     "nuevo_no_insertado".
-- Para que también inserte, descomentar y correr estas dos líneas, y después
-- poner fuente_web_permitida: true en el nodo Config del flujo:
--
-- ALTER TABLE public.tradecars_data_precios_vehiculos_nuevos DROP CONSTRAINT IF EXISTS tradecars_data_precios_vehiculos_nuevos_fuente_check;
-- ALTER TABLE public.tradecars_data_precios_vehiculos_nuevos ADD CONSTRAINT tradecars_data_precios_vehiculos_nuevos_fuente_check CHECK (fuente IN ('manual', 'wigo', 'autoland', 'web'));

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (opcional)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT fecha_ejecucion, origen, simulado, total_modelos, exitosos, actualizados,
--        saltos_revision, nuevos_no_insertados, descartados, fallidos, costo_estimado_usd
--   FROM public.tradecars_control_sync_precios ORDER BY fecha_ejecucion DESC LIMIT 10;
