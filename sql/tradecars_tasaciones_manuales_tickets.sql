-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Tasaciones manuales (+120.000 km) y tickets de cambio estructural
--
-- Correr UNA VEZ en Supabase (SQL Editor). Idempotente.
--
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ---------------------------
-- Especificación técnica de Alef AI Solutions (29/09/2026, "Especificacion_
-- Tecnica_TradeCars_29-09-2026.txt") para la Función 3 del Asistente Trade
-- Cars (antes "Tasador IA"): server/api/tradecars/tasador-chat.post.ts.
--
-- 1) tradecars_tasaciones_pendientes_manual — el Agente Tasador de WhatsApp
--    (n8n, capa de Alef) intercepta autos con más de 120.000 km y, en vez de
--    cotizarlos automáticamente, los va a registrar acá. El Asistente Trade
--    Cars (tools ver_tasaciones_pendientes / marcar_tasacion_atendida) deja
--    que un admin los vea y los marque como atendidos con el precio que se
--    acordó a mano. OJO: esta tabla sólo la puede LLENAR el flujo de n8n del
--    Tasador de WhatsApp una vez que Alef lo actualice para escribir acá —
--    hasta entonces existe pero se queda vacía, y eso está bien.
--
-- 2) tradecars_tickets_cambios_estructurales — cuando alguien le pide al
--    Asistente algo que se sale de lo que puede hacer por sí solo (cambiar la
--    lógica de cálculo del Tasador, sus prompts, o crear un comportamiento
--    nuevo), la tool crear_ticket deja constancia acá en vez de intentar
--    ejecutarlo. Lo atiende el equipo técnico de Alef.
--
-- ⚠️ SUPERPOSICIÓN A PROPÓSITO AVISADA, NO RESUELTA ACÁ: ya existe
-- solicitar_cambio_a_alef (tasador-chat.post.ts), que hace básicamente lo
-- mismo — deja un pedido fuera de alcance para Alef — pero escribiendo en
-- tradecars_tasador_cambios (estado='pendiente_alef', visible en la pestaña
-- Historial del Asistente). La especificación del 29/09/2026 no menciona esa
-- tool existente y pide un mecanismo nuevo y separado. Se implementa tal cual
-- lo pide el documento (no se toca solicitar_cambio_a_alef, sigue igual), así
-- que van a convivir DOS lugares donde puede terminar un pedido fuera de
-- alcance. Confirmar con Alef si conviene consolidarlos.
-- ══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1) Tasaciones pendientes de revisión manual (+120.000 km)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_tasaciones_pendientes_manual (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  marca                 TEXT NOT NULL,
  modelo                TEXT NOT NULL,
  anio                  INTEGER,
  kilometraje           INTEGER,
  placa                 TEXT,

  nombre_cliente        TEXT,
  telefono              TEXT,

  motivo                TEXT NOT NULL DEFAULT 'km_sobre_umbral',

  atendido              BOOLEAN NOT NULL DEFAULT FALSE,
  precio_acordado_usd   NUMERIC,
  notas                 TEXT,

  fecha_ingreso         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  fecha_atencion        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tc_tasaciones_pendientes_atendido
  ON public.tradecars_tasaciones_pendientes_manual (atendido);

CREATE INDEX IF NOT EXISTS idx_tc_tasaciones_pendientes_fecha
  ON public.tradecars_tasaciones_pendientes_manual (fecha_ingreso DESC);

COMMENT ON TABLE public.tradecars_tasaciones_pendientes_manual IS
  'Autos con más de 120.000 km que el Agente Tasador de WhatsApp no cotiza automáticamente y registra acá para revisión manual. El Asistente Trade Cars (ver_tasaciones_pendientes / marcar_tasacion_atendida) permite a un admin verlos y marcarlos con el precio acordado a mano.';

-- RLS — mismo criterio que el resto de tablas del Tasador: hay nombre y
-- teléfono de clientes reales, así que sin policy para `anon`. Todo el
-- acceso pasa por los endpoints del servidor con service_role.
ALTER TABLE public.tradecars_tasaciones_pendientes_manual ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_tasaciones_pendientes" ON public.tradecars_tasaciones_pendientes_manual
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────────
-- 2) Tickets de cambio estructural (pedidos fuera del alcance del Asistente)
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_tickets_cambios_estructurales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Número correlativo legible (TC-0001, TC-0002...) — depende de que `id`
  -- sea un entero secuencial simple: no cambiar esta tabla a UUID.
  numero_ticket  TEXT GENERATED ALWAYS AS ('TC-' || LPAD(id::TEXT, 4, '0')) STORED,

  descripcion    TEXT NOT NULL,
  motivo         TEXT,
  urgencia       TEXT NOT NULL DEFAULT 'normal',
  estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'descartado')),

  solicitado_por TEXT,           -- email de la sesión que lo creó
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- El CHECK de `urgencia` va aparte (no inline) para poder corregirlo sin recrear la tabla: el
-- prompt v1.0 de Alef (29/09/2026) pide "normal / alta / crítica", distinto de lo que se sembró
-- en la primera versión de este archivo ("baja/normal/alta"). Re-correr este archivo actualiza
-- el constraint también en una base donde ya se había corrido la versión vieja.
ALTER TABLE public.tradecars_tickets_cambios_estructurales DROP CONSTRAINT IF EXISTS tradecars_tickets_cambios_estructurales_urgencia_check;
ALTER TABLE public.tradecars_tickets_cambios_estructurales
  ADD CONSTRAINT tradecars_tickets_cambios_estructurales_urgencia_check
  CHECK (urgencia IN ('normal', 'alta', 'critica'));

CREATE INDEX IF NOT EXISTS idx_tc_tickets_estado
  ON public.tradecars_tickets_cambios_estructurales (estado);

CREATE INDEX IF NOT EXISTS idx_tc_tickets_fecha
  ON public.tradecars_tickets_cambios_estructurales (fecha_creacion DESC);

COMMENT ON TABLE public.tradecars_tickets_cambios_estructurales IS
  'Pedidos que superan lo que el Asistente Trade Cars puede ejecutar por sí solo (lógica de cálculo, prompts, comportamientos nuevos). La tool crear_ticket registra acá en vez de intentar aplicarlo. Los atiende el equipo técnico de Alef AI Solutions.';

ALTER TABLE public.tradecars_tickets_cambios_estructurales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_tickets" ON public.tradecars_tickets_cambios_estructurales
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN (opcional — descomentar para comprobar tras correr)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT * FROM public.tradecars_tasaciones_pendientes_manual ORDER BY fecha_ingreso DESC LIMIT 20;
-- SELECT numero_ticket, descripcion, urgencia, estado, solicitado_por, fecha_creacion
--   FROM public.tradecars_tickets_cambios_estructurales ORDER BY fecha_creacion DESC LIMIT 20;
