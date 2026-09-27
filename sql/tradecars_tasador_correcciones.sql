-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Memoria de correcciones del Tasador IA
--
-- Correr UNA VEZ en Supabase (SQL Editor). Idempotente.
--
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ---------------------------
-- Pedido del cliente (27/09/2026): que el Tasador "vaya aprendiendo" de lo que
-- le dicen los asesores en el chat, sin depender de que alguien confirme un
-- cambio de parámetro cada vez. Un asesor puede corregir un caso puntual
-- ("este Yaris vale más porque tiene full equipo") sin que eso tenga que
-- convertirse en una regla general para todos los Yaris.
--
-- Esta tabla es justamente eso: un caso puntual, no un cambio de configuración.
-- No pasa por el sistema de propuesta/confirmación de
-- tradecars_config_* / tradecars_tasador_cambios — cualquier sesión de Trade
-- Cars (no sólo admin) puede registrar una corrección, porque no toca los
-- números con los que se cotiza a todo el mundo. El Tasador la consulta antes
-- de tasar un auto parecido y la usa como ejemplo real en su respuesta.
--
-- Si el mismo tipo de corrección se repite varias veces para una marca/modelo,
-- el chat puede proponer formalizarla como regla (proponer_regla_marca_modelo,
-- que SÍ requiere confirmación de admin) — ver server/api/tradecars/tasador-chat.post.ts.
--
-- IMPORTANTE — alcance real: esta memoria alimenta el chat interno del
-- dashboard (el que usan los asesores/admin para consultar y afinar precios).
-- El Agente Tasador que atiende WhatsApp en n8n NO la lee todavía — sólo lee
-- las 3 tablas de tradecars_tasador_config.sql. Para que una corrección
-- puntual llegue al bot real hace falta o (a) que se formalice como regla
-- confirmada, o (b) que Alef agregue una tool nueva en n8n que consulte esta
-- tabla (ver solicitar_cambio_a_alef).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_tasador_correcciones (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  marca               TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  anio                INTEGER,
  km                  INTEGER,
  contexto            TEXT,           -- versión, GNV/GLP, estado del auto, lo que el asesor aclaró

  precio_tasado_bot   NUMERIC,        -- lo que el Tasador había dicho, si se sabe (NULL si no aplica)
  precio_correcto     NUMERIC NOT NULL,   -- lo que el asesor dice que debería ser (USD, misma moneda que el Tasador)
  motivo              TEXT NOT NULL,  -- por qué, en palabras del asesor — es lo que el bot cita después

  registrado_por      TEXT,           -- email de la sesión que lo registró
  origen              TEXT NOT NULL DEFAULT 'chat_tasador',
  created_at          TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- El Tasador busca por marca/modelo antes de tasar: este índice es el que usa
-- esa consulta (mismo criterio que idx_tc_historico_marca_modelo).
CREATE INDEX IF NOT EXISTS idx_tc_correcciones_marca_modelo
  ON public.tradecars_tasador_correcciones (upper(marca), upper(modelo));

CREATE INDEX IF NOT EXISTS idx_tc_correcciones_fecha
  ON public.tradecars_tasador_correcciones (created_at DESC);

COMMENT ON TABLE public.tradecars_tasador_correcciones IS
  'Casos puntuales donde un asesor corrigió al Tasador IA en el chat del dashboard. No es configuración global (no pasa por propuesta/confirmación): el Tasador la consulta como memoria de casos reales antes de tasar un auto parecido.';

-- RLS — mismo criterio que tradecars_data_historico_compras_ventas: son datos
-- de precio real de la empresa, así que sin policy para `anon`. Todo el acceso
-- pasa por los endpoints del servidor con service_role.
ALTER TABLE public.tradecars_tasador_correcciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_correcciones" ON public.tradecars_tasador_correcciones
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (opcional — descomentar para comprobar tras correr)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT marca, modelo, anio, precio_tasado_bot, precio_correcto, motivo, registrado_por, created_at
--   FROM public.tradecars_tasador_correcciones ORDER BY created_at DESC LIMIT 20;
