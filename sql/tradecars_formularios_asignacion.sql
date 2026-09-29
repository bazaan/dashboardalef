-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Asignación automática de asesor a las tarjetas de Solicitudes -
-- formularios (Web + IG + FB + TikTok + Sin plataforma) (29/09/2026)
--
-- Pedido del cliente: TODA tarjeta nueva que entre (cualquier canal) se asigna sola a un
-- asesor, ANTES de que nadie la toque:
--   1. Se busca el teléfono en tradecars_leads_chatwoot. Si ya tuvo un asesor asignado antes
--      (misma lógica de "continuidad" que ya usa el flujo de n8n de Chatwoot), se usa ESE.
--   2. Si no hay coincidencia, se reparte por ROUND ROBIN entre los 4 asesores activos de
--      tradecars_asesores (Rodrigo Paredes, Jose Flores, Brado Alvarado, Gino Hurtado — la
--      misma tabla que ya usa el Funnel; Luis Cossa NO está en esta tabla a propósito, es
--      Jefe de Compras, no asesor).
--
-- Un asesor (rol agente) solo puede VER las tarjetas asignadas a ÉL — en las 5 pestañas.
-- Admin/superadmin ven todo. Eso se aplica en el servidor (server/api/tradecars/formularios.get.ts
-- y el endpoint nuevo de Solicitudes web), no solo en la pantalla.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Columnas de asignación en las 3 tablas que guardan tarjetas
ALTER TABLE public.tradecars_formularios_estado ADD COLUMN IF NOT EXISTS asesor_nombre TEXT;
ALTER TABLE public.tradecars_formularios_estado ADD COLUMN IF NOT EXISTS asesor_email TEXT;

ALTER TABLE public.tradecars_solicitudes_venta ADD COLUMN IF NOT EXISTS asesor_nombre TEXT;
ALTER TABLE public.tradecars_solicitudes_venta ADD COLUMN IF NOT EXISTS asesor_email TEXT;

ALTER TABLE public.tradecars_solicitudes_compra ADD COLUMN IF NOT EXISTS asesor_nombre TEXT;
ALTER TABLE public.tradecars_solicitudes_compra ADD COLUMN IF NOT EXISTS asesor_email TEXT;

CREATE INDEX IF NOT EXISTS idx_tc_form_estado_asesor ON public.tradecars_formularios_estado (asesor_email);
CREATE INDEX IF NOT EXISTS idx_tc_sol_venta_asesor ON public.tradecars_solicitudes_venta (asesor_email);
CREATE INDEX IF NOT EXISTS idx_tc_sol_compra_asesor ON public.tradecars_solicitudes_compra (asesor_email);

-- 2. Contador del round robin (una sola fila, se incrementa atómicamente)
INSERT INTO public.app_settings (key, value)
VALUES ('tradecars_formularios_rr_index', '0')
ON CONFLICT (key) DO NOTHING;

-- 3. Función que da el SIGUIENTE asesor del round robin, de forma atómica (el UPDATE de una
-- sola fila serializa las llamadas concurrentes — dos pedidos al mismo tiempo nunca reciben
-- el mismo asesor). Si tradecars_asesores no tiene filas activas, no devuelve nada.
CREATE OR REPLACE FUNCTION public.tc_siguiente_asesor_formulario()
RETURNS TABLE(asesor_nombre TEXT, asesor_email TEXT) AS $$
DECLARE
  total INT;
  nuevo_valor INT;
BEGIN
  SELECT COUNT(*) INTO total FROM public.tradecars_asesores WHERE activo = TRUE;
  IF total IS NULL OR total = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.app_settings (key, value) VALUES ('tradecars_formularios_rr_index', '0')
  ON CONFLICT (key) DO NOTHING;

  UPDATE public.app_settings
    SET value = ((COALESCE(value, '0')::INT) + 1)::TEXT, updated_at = NOW()
    WHERE key = 'tradecars_formularios_rr_index'
    RETURNING (value::INT) INTO nuevo_valor;

  RETURN QUERY
    SELECT a.nombre, a.email FROM public.tradecars_asesores a
    WHERE a.activo = TRUE
    ORDER BY a.orden
    LIMIT 1 OFFSET ((nuevo_valor - 1) % total);
END;
$$ LANGUAGE plpgsql;

-- 4. "Formularios web" deja de ser de acceso directo (anon) — ahora pasa por
-- /api/tradecars/solicitudes, que sí verifica el rol y filtra por asesor. Antes cualquiera con
-- la key pública podía leer/escribir estas tablas directo; el endpoint público de la web
-- (POST /api/tradecars/formulario) ya usa service_role, así que sigue funcionando sin cambios.
DROP POLICY IF EXISTS "anon_all_tradecars_solicitudes_venta" ON public.tradecars_solicitudes_venta;
DROP POLICY IF EXISTS "anon_all_tradecars_solicitudes_compra" ON public.tradecars_solicitudes_compra;

COMMENT ON COLUMN public.tradecars_formularios_estado.asesor_nombre IS
  'Asesor asignado a esta tarjeta (round robin o continuidad por teléfono vía tradecars_leads_chatwoot). Se asigna UNA vez, al ver la tarjeta por primera vez.';
COMMENT ON COLUMN public.tradecars_solicitudes_venta.asesor_nombre IS
  'Asesor asignado a esta solicitud (round robin o continuidad por teléfono). Se asigna al crear la solicitud.';
COMMENT ON COLUMN public.tradecars_solicitudes_compra.asesor_nombre IS
  'Asesor asignado a esta solicitud (round robin o continuidad por teléfono). Se asigna al crear la solicitud.';
