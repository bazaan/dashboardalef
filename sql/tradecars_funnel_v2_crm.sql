-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Funnel v2 + CRM (reunión de alineación de septiembre/2026)
--
-- Correr UNA vez en el SQL Editor de Supabase. Es idempotente: se puede volver
-- a correr sin duplicar nada ni perder datos (las columnas que se recrean son
-- CALCULADAS, se vuelven a llenar solas a partir de perfil_coincide + status).
--
-- Qué cambia:
--   1. El embudo se arma en cascada con DOS campos del CRM: Coincide (✓ / x) y
--      estado (6 valores). LEADS = todo lo que entra; un lead con Coincide = SI
--      pero SIN estado ahora cuenta como CUMPLE POLITICA (antes quedaba fuera de
--      TODAS las barras: etapa NULL / etapa_rank -1).
--   2. "Concretado" (como lo escribe Chatwoot) se acepta igual que "CONCRETADA".
--   3. El estado se BLOQUEA cuando Coincide = NO (se guarda vacío en la BD).
--   4. Nueva columna informacion_auto (custom attribute "informacion del auto"
--      que se creó en Chatwoot en la reunión).
--   5. Compra concretada -> histórico de compras -> botón "Ingresar a inventario"
--      (columnas de trazabilidad en tradecars_data_historico_compras y en
--      tradecars_vehiculos).
--   6. Inventario en dos vistas: administrativa (con margen) y pública (solo lo
--      comercial). Campos provisionales hasta que Trade Cars mande sus plantillas.
--
-- Reglas del embudo (cada barra es ACUMULATIVA: cuenta esa etapa o una superior):
--   LEADS            todo lo que entra
--   CUMPLE POLITICA  Coincide = SI (con cualquiera de los 6 estados, o todavía sin estado)
--   CONTACTADO       Coincide = SI y estado ≠ NO CONTACTADO
--   INTERESADOS      Coincide = SI y estado ∈ {EN SEGUIMIENTO, CITA, CITA ASISTIDA, CONCRETADA}
--   CITAS AGENDADAS  Coincide = SI y estado ∈ {CITA, CITA ASISTIDA, CONCRETADA}
--   CITAS ASISTIDAS  Coincide = SI y estado ∈ {CITA ASISTIDA, CONCRETADA}
--   COMPRAS          Coincide = SI y estado = CONCRETADA
-- La misma lógica vive en utils/tradecarsFunnel.ts: si se cambia una, cambiar la otra.
-- ══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
-- 1. FUNCIONES DE NORMALIZACIÓN (IMMUTABLE: las usan las columnas calculadas)
-- ──────────────────────────────────────────────────────────────────────────

-- Coincide = SI. El CRM manda ✓; el dashboard guarda 'SI'.
CREATE OR REPLACE FUNCTION public.tc_perfil_si(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT translate(upper(btrim(replace(COALESCE(v, ''), chr(65039), ''))), 'ÁÉÍÓÚÜ', 'AEIOUU')
         IN ('SI', 'YES', 'TRUE', '1', '✓', '✔', '✅', '☑')
$$;

-- Coincide = NO (x explícita del asesor). Vacío NO cuenta como NO: es "sin calificar".
CREATE OR REPLACE FUNCTION public.tc_perfil_no(v TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT translate(upper(btrim(replace(COALESCE(v, ''), chr(65039), ''))), 'ÁÉÍÓÚÜ', 'AEIOUU')
         IN ('NO', 'X', 'FALSE', '0', '✗', '✘', '✖', '❌')
$$;

-- Estado en su forma canónica: mayúsculas, sin tabuladores ni espacios de más
-- (dos valores del dropdown de Chatwoot vienen con un TAB delante: "\tNo interesado"),
-- y "CONCRETADO" (Chatwoot) -> "CONCRETADA" (dashboard).
-- Ojo: primero se colapsa el espacio en blanco y DESPUÉS se hace btrim, porque
-- btrim solo quita espacios normales, no tabuladores.
CREATE OR REPLACE FUNCTION public.tc_status_canonico(v TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN s = 'CONCRETADO' THEN 'CONCRETADA' ELSE s END
  FROM (SELECT upper(btrim(regexp_replace(COALESCE(v, ''), '\s+', ' ', 'g'))) AS s) t
$$;

-- Posición en el embudo: 0 = LEADS … 6 = COMPRAS. Nunca devuelve -1: todo lo que
-- entra es un lead.
--   · Coincide = NO o sin calificar          -> 0 (LEADS)
--   · Coincide = SI + estado válido          -> la etapa de ese estado
--   · Coincide = SI sin estado / estado sucio -> 1 (CUMPLE POLITICA): cumple el
--     perfil, solo le falta un estado válido para avanzar. Es la misma condición
--     que pone la etiqueta `cumple_politica` en Chatwoot.
CREATE OR REPLACE FUNCTION public.tc_rank(perfil TEXT, status TEXT)
RETURNS SMALLINT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (
    CASE
      WHEN NOT public.tc_perfil_si(perfil) THEN 0
      ELSE
        CASE public.tc_status_canonico(status)
          WHEN 'NO CONTACTADO'  THEN 1
          WHEN 'NO INTERESADO'  THEN 2
          WHEN 'EN SEGUIMIENTO' THEN 3
          WHEN 'CITA'           THEN 4
          WHEN 'CITA ASISTIDA'  THEN 5
          WHEN 'CONCRETADA'     THEN 6
          ELSE 1
        END
    END
  )::smallint
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 2. COLUMNAS NUEVAS DEL LEAD
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_funnel_leads
  ADD COLUMN IF NOT EXISTS informacion_auto TEXT;   -- texto libre: marca, modelo, año, km… (Chatwoot: "informacion del auto")

COMMENT ON COLUMN public.tradecars_funnel_leads.informacion_auto IS
  'Resumen del vehículo que el asesor escribe en Chatwoot (atributo informacion_del_auto). Alimenta el histórico de compras al marcar CONCRETADA.';


-- ──────────────────────────────────────────────────────────────────────────
-- 3. RECREAR LAS COLUMNAS CALCULADAS (etapa / etapa_rank)
--    Son GENERATED STORED: no se pueden modificar, se sueltan y se vuelven a
--    crear. No se pierde ningún dato porque se derivan de perfil_coincide + status.
--    Antes hay que soltar lo que depende de ellas (vistas e índice).
-- ──────────────────────────────────────────────────────────────────────────
DROP VIEW  IF EXISTS public.tradecars_funnel_resumen;
DROP VIEW  IF EXISTS public.tradecars_procedencia;
DROP INDEX IF EXISTS public.idx_tc_funnel_rank;

ALTER TABLE public.tradecars_funnel_leads DROP COLUMN IF EXISTS etapa;
ALTER TABLE public.tradecars_funnel_leads DROP COLUMN IF EXISTS etapa_rank;

ALTER TABLE public.tradecars_funnel_leads
  ADD COLUMN etapa_rank SMALLINT
  GENERATED ALWAYS AS (public.tc_rank(perfil_coincide, status)) STORED;

ALTER TABLE public.tradecars_funnel_leads
  ADD COLUMN etapa TEXT
  GENERATED ALWAYS AS (
    CASE public.tc_rank(perfil_coincide, status)
      WHEN 0 THEN 'LEADS'
      WHEN 1 THEN 'CUMPLE POLITICA'
      WHEN 2 THEN 'CONTACTADO'
      WHEN 3 THEN 'INTERESADOS'
      WHEN 4 THEN 'CITAS AGENDADAS'
      WHEN 5 THEN 'CITAS ASISTIDAS'
      WHEN 6 THEN 'COMPRAS'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tc_funnel_rank ON public.tradecars_funnel_leads (etapa_rank);


-- ──────────────────────────────────────────────────────────────────────────
-- 4. TRIGGER: normalización + anti-regresión + estado bloqueado con Coincide = NO
--    (Reemplaza a tradecars_funnel_guard() de sql/tradecars_funnel.sql.)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tradecars_funnel_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rank_anterior SMALLINT;
  rank_nuevo    SMALLINT;
BEGIN
  NEW.updated_at := timezone('utc', now());

  -- Estado siempre en mayúsculas y canónico ("Concretado" -> "CONCRETADA"); vacío = NULL
  IF NEW.status IS NOT NULL THEN
    NEW.status := NULLIF(public.tc_status_canonico(NEW.status), '');
  END IF;

  -- Coincide: SI / NO / NULL (sin calificar). Cualquier otro texto = sin calificar.
  IF NEW.perfil_coincide IS NOT NULL THEN
    NEW.perfil_coincide := CASE
      WHEN public.tc_perfil_si(NEW.perfil_coincide) THEN 'SI'
      WHEN public.tc_perfil_no(NEW.perfil_coincide) THEN 'NO'
      ELSE NULL
    END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    rank_anterior := OLD.etapa_rank;
    rank_nuevo    := public.tc_rank(NEW.perfil_coincide, NEW.status);

    -- Regla anti-regresión (validada por el cliente el 26/08): un lead que ya llegó
    -- a CITA (4) o más no puede retroceder, aunque el desenlace haya sido negativo.
    IF rank_anterior >= 4 AND rank_nuevo < rank_anterior THEN
      NEW.status          := OLD.status;
      NEW.perfil_coincide := OLD.perfil_coincide;
    END IF;
  END IF;

  -- Con Coincide = NO el estado se bloquea: el lead se queda en LEADS y no puede
  -- arrastrar un estado (en el CRM el dropdown se bloquea; aquí se cubre el caso
  -- de que igual llegue por n8n o por el dashboard).
  IF NEW.perfil_coincide = 'NO' THEN
    NEW.status := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tradecars_funnel_guard ON public.tradecars_funnel_leads;
CREATE TRIGGER trg_tradecars_funnel_guard
  BEFORE INSERT OR UPDATE ON public.tradecars_funnel_leads
  FOR EACH ROW EXECUTE FUNCTION public.tradecars_funnel_guard();


-- ──────────────────────────────────────────────────────────────────────────
-- 5. VISTAS (se recrean tal cual, ya sin excluir leads "sin status")
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tradecars_funnel_resumen AS
WITH etapas(etapa, rank) AS (
  VALUES ('LEADS', 0), ('CUMPLE POLITICA', 1), ('CONTACTADO', 2), ('INTERESADOS', 3),
         ('CITAS AGENDADAS', 4), ('CITAS ASISTIDAS', 5), ('COMPRAS', 6)
)
SELECT
  to_char(l.fecha_funnel, 'YYYY-MM') AS mes,
  l.asesor,
  l.canal_origen,
  e.etapa,
  e.rank                              AS etapa_rank,
  COUNT(*)                            AS cantidad
FROM public.tradecars_funnel_leads l
CROSS JOIN etapas e
WHERE l.etapa_rank >= e.rank          -- acumulativo: alcanzó esa etapa o una superior
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1 DESC, 5;

COMMENT ON VIEW public.tradecars_funnel_resumen IS
  'Barras del embudo ya agregadas. El conteo es acumulativo (etapa o superior); LEADS = todo lo que entra.';

CREATE OR REPLACE VIEW public.tradecars_procedencia AS
SELECT
  to_char(fecha_funnel, 'YYYY-MM')          AS mes,
  COALESCE(NULLIF(btrim(campana), ''), 'Sin campaña') AS campana,
  COALESCE(NULLIF(btrim(marca_normalizada), ''),
           NULLIF(btrim(marca), ''), 'Sin marca')     AS marca,
  COALESCE(NULLIF(btrim(modelo), ''), 'Sin modelo')   AS modelo,
  COUNT(*)                                            AS leads,
  COUNT(*) FILTER (WHERE etapa_rank >= 4)             AS citas,
  COUNT(*) FILTER (WHERE etapa_rank = 6)              AS compras
FROM public.tradecars_funnel_leads
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.tradecars_procedencia IS
  'Leads / citas / compras por campaña y modelo. Equivale a PROCEDENCIA DEL LEAD del Power BI.';


-- ──────────────────────────────────────────────────────────────────────────
-- 6. VERIFICACIÓN RÁPIDA (opcional): las 7 barras del embudo con toda la data
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT etapa, COUNT(*) FROM public.tradecars_funnel_leads GROUP BY etapa ORDER BY MIN(etapa_rank);
-- SELECT e.etapa, COUNT(*) FILTER (WHERE l.etapa_rank >= e.rank) AS cantidad
--   FROM public.tradecars_funnel_leads l
--   CROSS JOIN (VALUES ('LEADS',0),('CUMPLE POLITICA',1),('CONTACTADO',2),('INTERESADOS',3),
--                      ('CITAS AGENDADAS',4),('CITAS ASISTIDAS',5),('COMPRAS',6)) e(etapa, rank)
--  GROUP BY e.etapa, e.rank ORDER BY e.rank;


-- ──────────────────────────────────────────────────────────────────────────
-- 7. COMPRA CONCRETADA -> HISTÓRICO DE COMPRAS -> BOTÓN "INGRESAR A INVENTARIO"
--
--    Flujo acordado en la reunión (el asesor NO carga nada a mano):
--      1. El asesor marca el estado "Concretado" en Chatwoot.
--      2. El dashboard (endpoint funnel-lead) extrae marca/modelo/año/km/placa de lo que
--         escribió el asesor en "informacion del auto", del chat y del formulario web, y
--         crea una fila en tradecars_data_historico_compras con verificado = FALSE.
--      3. Fabián (administrador) la revisa, completa lo que falte y la marca verificada.
--      4. Con el botón "Ingresar a inventario" la fila pasa a tradecars_vehiculos. Solo
--         entran al inventario los carros que él ordene: nunca es automático.
--
--    Las 1.307 filas que ya existen en el histórico quedan como verificado = TRUE (son las
--    del Excel, ya revisadas): solo las que crea el CRM entran como pendientes.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_data_historico_compras
  ADD COLUMN IF NOT EXISTS origen                   TEXT,        -- 'crm' = creada por el funnel; NULL = viene del Excel / carga manual
  ADD COLUMN IF NOT EXISTS crm_lead_id              UUID REFERENCES public.tradecars_funnel_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_conversation_id      BIGINT,      -- conversación de Chatwoot del lead
  ADD COLUMN IF NOT EXISTS informacion_auto         TEXT,        -- lo que el asesor escribió en Chatwoot ("informacion del auto")
  ADD COLUMN IF NOT EXISTS verificado               BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verificado_por           TEXT,
  ADD COLUMN IF NOT EXISTS verificado_en            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventario_vehiculo_id   UUID,        -- vehículo creado en tradecars_vehiculos al ingresar a inventario
  ADD COLUMN IF NOT EXISTS ingresado_inventario_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingresado_inventario_por TEXT;

-- Un lead genera UNA sola compra (el webhook de Chatwoot dispara en cada mensaje: sin este
-- índice un reenvío duplicaría la fila).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_hist_compras_crm_lead
  ON public.tradecars_data_historico_compras (crm_lead_id) WHERE crm_lead_id IS NOT NULL;

-- Para la pestaña "pendientes de verificar" y el contador del menú.
CREATE INDEX IF NOT EXISTS idx_tc_hist_compras_pendientes
  ON public.tradecars_data_historico_compras (verificado) WHERE verificado = FALSE;

COMMENT ON COLUMN public.tradecars_data_historico_compras.verificado IS
  'FALSE = la creó el CRM al marcar CONCRETADA y falta que administración la revise. TRUE = revisada (o del Excel).';

-- Vehículo de inventario -> compra de origen (trazabilidad). Un vehículo por compra.
ALTER TABLE public.tradecars_vehiculos
  ADD COLUMN IF NOT EXISTS historico_compra_id UUID REFERENCES public.tradecars_data_historico_compras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen              TEXT;            -- 'compra_crm' = ingresado con el botón; NULL = cargado a mano

CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_veh_historico_compra
  ON public.tradecars_vehiculos (historico_compra_id) WHERE historico_compra_id IS NOT NULL;

-- Y el sentido contrario (se agrega después porque tradecars_vehiculos ya existe en este punto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tc_hist_compras_vehiculo'
  ) THEN
    ALTER TABLE public.tradecars_data_historico_compras
      ADD CONSTRAINT fk_tc_hist_compras_vehiculo
      FOREIGN KEY (inventario_vehiculo_id) REFERENCES public.tradecars_vehiculos(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- 8. INVENTARIO: DOS VISTAS (administrativa y pública)
--
--    Acordado: "inventario de vehículos administrativo" con TODOS los campos (incluido el
--    margen) y "inventario de vehículos público" con solo lo comercial. Jean Marcos / Fabián
--    todavía tienen que mandar las plantillas con los campos exactos de cada uno: mientras
--    tanto se parte de una lista razonable y se ajusta tocando SOLO estas dos vistas
--    (y las columnas equivalentes en la pantalla "Inventario de Vehículos").
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tradecars_inventario_admin AS
SELECT
  v.*,
  (COALESCE(v.precio_venta, 0) - COALESCE(v.precio_compra, 0))                    AS margen,
  CASE WHEN COALESCE(v.precio_compra, 0) > 0
       THEN round((COALESCE(v.precio_venta, 0) - v.precio_compra) / v.precio_compra * 100, 1)
  END                                                                            AS margen_pct,
  (CURRENT_DATE - v.fecha_ingreso)                                               AS dias_en_inventario
FROM public.tradecars_vehiculos v;

COMMENT ON VIEW public.tradecars_inventario_admin IS
  'Inventario para uso interno: todos los campos del vehículo + margen, % de margen y días en inventario.';

CREATE OR REPLACE VIEW public.tradecars_inventario_publico AS
SELECT
  v.id, v.codigo, v.marca, v.modelo, v.version, v.anio, v.color, v.kilometraje,
  v.transmision, v.combustible, v.tipo_vehiculo, v.precio_venta, v.estado, v.fotos
FROM public.tradecars_vehiculos v
WHERE v.estado IN ('disponible', 'reservado');

COMMENT ON VIEW public.tradecars_inventario_publico IS
  'Inventario para compartir con clientes: sin precio de compra, margen, propietario, deuda, notas ni placa.';
