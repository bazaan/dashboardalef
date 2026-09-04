-- ═══════════════════════════════════════════════════════════════════════════
--  PIOLA — Migración de la reunión del 31/08/2026
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Correr UNA vez sobre la base que ya tiene `sql/piola.sql` aplicado.
--  Es idempotente: se puede correr las veces que haga falta.
--
--  Implementa SOLO lo que el cliente pidió o aceptó en esa reunión:
--
--   1. Múltiples adjuntos por factura/movimiento (factura + constancia de
--      detracción + lo que haga falta).                        [00:27:42]
--   2. Numeración propia de "tipo de gasto" de Edson (57, 58, 62=Oana…),
--      seleccionable y filtrable.                              [00:39:18]
--   3. Registro de clientes completo: RUC, ficha RUC, DNI, condiciones,
--      anexos — para que la factura se autocomplete al elegir el cliente.
--                                                              [00:28:32]
--   4. Producción desglosada por tipo de contenido (videos, piezas
--      gráficas, reels…) con compromiso mensual por marca y tipo.
--                                                              [00:56:44]
--   5. Áreas y enlaces (Dropbox / Drive / publicado) en los entregables.
--                                                              [01:03:28]
--   6. Alertas de movimiento financiero por WhatsApp.           [00:33:42]
--   7. Boletas de pago Y recibos por honorarios con su voucher. [01:08:35]
--   8. Importación masiva de movimientos desde Excel.           [00:36:58]
--
--  NO incluye integración con SUNAT: se descartó expresamente. [00:25:24]
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. ADJUNTOS MÚLTIPLES
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "hazlo para más porque ahí también vamos a juntar lo que es la
--    detracción en muchos casos".
--
--    Tabla polimórfica en vez de N columnas: un movimiento puede llevar la
--    factura, la constancia de detracción y el voucher sin tocar el esquema.
--    Las columnas `comprobante_url` / `constancia_url` que ya existen NO se
--    borran — siguen siendo el "documento principal" y se leen como antes.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_adjuntos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad     TEXT   NOT NULL CHECK (entidad IN
                ('transaction','invoice','pago','cliente','contrato','deliverable','payslip')),
  entidad_id  BIGINT NOT NULL,
  -- Para qué es el documento. Lo pidió Edson para separar factura de detracción.
  tipo_doc    TEXT   NOT NULL DEFAULT 'otro' CHECK (tipo_doc IN
                ('factura','detraccion','contrato','anexo','ficha_ruc','voucher',
                 'constancia','dni','otro')),
  nombre      TEXT   NOT NULL,
  path        TEXT   NOT NULL,                     -- path dentro del bucket piola-docs
  peso_bytes  BIGINT,
  subido_por  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_adjuntos_entidad
  ON public.piola_adjuntos (entidad, entidad_id);

COMMENT ON TABLE public.piola_adjuntos IS
  'Adjuntos múltiples (factura, constancia de detracción, anexos…). Reunión 31/08/2026.';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. TIPO DE GASTO NUMERADO
-- ───────────────────────────────────────────────────────────────────────────
--    Edson maneja su flujo de caja en Excel con un número por cada tipo de
--    gasto ("el 2 es combustible, el 20 es merchandising, el 62 es Oana").
--    Pidió poder asignar el número al crear uno nuevo, escogerlo al registrar
--    un movimiento y filtrar por él.
--
--    Va sobre la tabla de categorías que ya existe, no sobre una nueva: el
--    "tipo de gasto" de Edson y la "categoría" del sistema son lo mismo.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_expense_categories
  ADD COLUMN IF NOT EXISTS codigo INT;

-- Único pero opcional: las categorías viejas siguen sin número hasta que
-- Edson les asigne el suyo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_expcat_codigo
  ON public.piola_expense_categories (codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON COLUMN public.piola_expense_categories.codigo IS
  'Numeración propia de Edson para el tipo de gasto (57, 58, 62…). Reunión 31/08/2026.';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. REGISTRO DE CLIENTES COMPLETO
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "yo registre a los clientes, registro y en este registro inserta
--    el contrato, las condiciones, anexos, etcétera, DNI, etcétera, ficha RUC.
--    Y en ese otro módulo donde se emiten las facturas haya un desplegable…
--    yo le doy click y ya comienza a hacer mi registro. Ya sale en automático."
--
--    OJO: Raysa propuso adjuntar el contrato en cada factura y Edson lo
--    RECHAZÓ ("mucho trabajo operativo"). El contrato vive acá, no en la
--    factura. Por eso no se agrega nada de contratos a piola_invoices.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_clientes
  ADD COLUMN IF NOT EXISTS tipo_documento    TEXT DEFAULT 'RUC'
    CHECK (tipo_documento IS NULL OR tipo_documento IN ('RUC','DNI','CE','PAS')),
  ADD COLUMN IF NOT EXISTS dni               TEXT,
  ADD COLUMN IF NOT EXISTS direccion_fiscal  TEXT,
  ADD COLUMN IF NOT EXISTS contacto_cargo    TEXT,
  ADD COLUMN IF NOT EXISTS email_facturacion TEXT,
  ADD COLUMN IF NOT EXISTS condiciones       TEXT,   -- condiciones comerciales pactadas
  ADD COLUMN IF NOT EXISTS condicion_pago    TEXT,   -- 'Contado' / 'Crédito 30'…
  ADD COLUMN IF NOT EXISTS ficha_ruc_pdf     TEXT,   -- path en piola-docs
  ADD COLUMN IF NOT EXISTS detraccion_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS detraccion_codigo TEXT;

-- El RUC es la llave con la que se autocompleta la factura: no puede repetirse.
CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_clientes_ruc
  ON public.piola_clientes (ruc)
  WHERE ruc IS NOT NULL AND ruc <> '';

CREATE INDEX IF NOT EXISTS idx_piola_clientes_activo
  ON public.piola_clientes (activo, nombre);


-- ───────────────────────────────────────────────────────────────────────────
-- 4. TIPOS DE CONTENIDO (catálogo editable)
-- ───────────────────────────────────────────────────────────────────────────
--    Sebastián: "quería ver si se podía desglosar como que tanto sección
--    piezas gráficas, sección videos y ya ver como que un número más real".
--
--    Tabla y no enum porque Raysa dijo explícitamente que Sebastián iba a
--    definir los suyos ("de repente producción y guiones, puede ser rodajes,
--    puede ser lo que tú desees") — tiene que poder agregarlos sin redeploy.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_tipos_contenido (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave   TEXT NOT NULL UNIQUE,                    -- 'video', 'pieza_grafica'…
  nombre  TEXT NOT NULL,                           -- 'Video', 'Pieza gráfica'
  icono   TEXT,                                    -- icono mdi para el tablero
  color   TEXT,
  orden   INT  NOT NULL DEFAULT 0,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.piola_tipos_contenido (clave, nombre, icono, color, orden)
SELECT v.clave, v.nombre, v.icono, v.color, v.orden
FROM (VALUES
  ('video',         'Video',          'mdi-video',            '#e2564a', 1),
  ('pieza_grafica', 'Pieza gráfica',  'mdi-image-outline',    '#3d6fe0', 2),
  ('reel',          'Reel',           'mdi-cellphone-play',   '#8a4fd1', 3),
  ('guion',         'Guion',          'mdi-script-text',      '#c07a0e', 4),
  ('rodaje',        'Rodaje',         'mdi-movie-open',       '#1e9e5d', 5),
  ('fotografia',    'Fotografía',     'mdi-camera',           '#0e8a8a', 6)
) AS v(clave, nombre, icono, color, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_tipos_contenido t WHERE t.clave = v.clave
);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. COMPROMISO MENSUAL POR MARCA Y TIPO DE CONTENIDO
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "si es que a esa marca se le entregan siete videos y siete piezas
--    gráficas, ¿cómo haríamos ahí?"
--
--    Antes el compromiso era UN número suelto en piola_clientes
--    (compromiso_mensual), así que 7 videos + 7 piezas se veía como "14" y el
--    porcentaje mentía. Acá son dos filas y cada una tiene su propio avance.
--
--    `piola_clientes.compromiso_mensual` se deja donde está para no romper lo
--    que ya lo lee; pasa a ser el total y estas filas son el desglose.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_compromisos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id     BIGINT NOT NULL REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  tipo_contenido TEXT   NOT NULL,                  -- clave de piola_tipos_contenido
  periodo        TEXT   NOT NULL,                  -- 'YYYY-MM'
  cantidad       INT    NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  area_id        BIGINT REFERENCES public.piola_areas(id) ON DELETE SET NULL,
  notas          TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, tipo_contenido, periodo)
);

CREATE INDEX IF NOT EXISTS idx_piola_compromisos_periodo
  ON public.piola_compromisos (periodo, cliente_id);

COMMENT ON TABLE public.piola_compromisos IS
  'Compromiso mensual por marca y tipo de contenido (7 videos + 7 piezas = 2 filas). Reunión 31/08/2026.';


-- ───────────────────────────────────────────────────────────────────────────
-- 6. ENTREGABLES: tipo de contenido, área y enlaces
-- ───────────────────────────────────────────────────────────────────────────
--    Raysa: "puedes poner ahí una columna tal vez para poner link, y pones el
--    link del Dropbox y pones el link del Drive… cuando Mari ya lo haya
--    publicado, pone ahí el enlace publicado".
--    Sebastián: "quisiera que sea como que separado por cada área".
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_deliverables
  ADD COLUMN IF NOT EXISTS tipo_contenido TEXT,
  ADD COLUMN IF NOT EXISTS area_id        BIGINT REFERENCES public.piola_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dropbox_url    TEXT,
  ADD COLUMN IF NOT EXISTS publicado_url  TEXT,
  -- Cuando se clona el mes anterior, de dónde salió (para no duplicar dos veces)
  ADD COLUMN IF NOT EXISTS origen_id      BIGINT;

CREATE INDEX IF NOT EXISTS idx_piola_deliv_periodo_tipo
  ON public.piola_deliverables (periodo, cliente_id, tipo_contenido);

CREATE INDEX IF NOT EXISTS idx_piola_deliv_responsable
  ON public.piola_deliverables (responsable_email, estado)
  WHERE responsable_email IS NOT NULL;

-- Los entregables que ya existían quedan como 'video' sólo si su servicio lo
-- dice; si no, quedan NULL y la UI los muestra como "Sin clasificar". No se
-- inventa un tipo que el cliente no eligió.
UPDATE public.piola_deliverables d
SET    tipo_contenido = 'video'
FROM   public.piola_services s
WHERE  d.service_id = s.id
  AND  d.tipo_contenido IS NULL
  AND  lower(s.nombre) LIKE '%video%';


-- ───────────────────────────────────────────────────────────────────────────
-- 7. VISTA DE CUMPLIMIENTO POR MARCA Y TIPO
-- ───────────────────────────────────────────────────────────────────────────
--    Es exactamente el número que pidió Sebastián: por marca, por tipo de
--    contenido, comprometido vs. entregado.
--
--    "Entregado" = estados aprobado/entregado. En revisión y en producción NO
--    cuentan como cumplido, que es como lo explicó Roberto en la reunión.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.piola_cumplimiento_tipo AS
WITH comp AS (
  SELECT cliente_id, tipo_contenido, periodo, SUM(cantidad) AS comprometido
  FROM   public.piola_compromisos
  GROUP  BY cliente_id, tipo_contenido, periodo
),
entr AS (
  SELECT cliente_id,
         COALESCE(tipo_contenido, 'sin_clasificar') AS tipo_contenido,
         periodo,
         SUM(cantidad) FILTER (WHERE estado IN ('aprobado','entregado'))  AS entregado,
         SUM(cantidad) FILTER (WHERE estado = 'en_revision')              AS en_revision,
         SUM(cantidad) FILTER (WHERE estado = 'en_produccion')            AS en_produccion,
         SUM(cantidad) FILTER (WHERE estado = 'rechazado')                AS rechazado,
         SUM(cantidad)                                                    AS total_cargado
  FROM   public.piola_deliverables
  GROUP  BY cliente_id, COALESCE(tipo_contenido, 'sin_clasificar'), periodo
)
SELECT
  COALESCE(comp.cliente_id, entr.cliente_id)         AS cliente_id,
  cl.nombre                                          AS cliente_nombre,
  COALESCE(comp.tipo_contenido, entr.tipo_contenido) AS tipo_contenido,
  tc.nombre                                          AS tipo_nombre,
  tc.color                                           AS tipo_color,
  COALESCE(comp.periodo, entr.periodo)               AS periodo,
  COALESCE(comp.comprometido, 0)                     AS comprometido,
  COALESCE(entr.entregado, 0)                        AS entregado,
  COALESCE(entr.en_revision, 0)                      AS en_revision,
  COALESCE(entr.en_produccion, 0)                    AS en_produccion,
  COALESCE(entr.rechazado, 0)                        AS rechazado,
  COALESCE(entr.total_cargado, 0)                    AS total_cargado,
  CASE WHEN COALESCE(comp.comprometido, 0) > 0
       THEN ROUND(COALESCE(entr.entregado, 0)::numeric * 100 / comp.comprometido, 1)
       ELSE NULL END                                 AS cumplimiento_pct
FROM       comp
FULL OUTER JOIN entr
  ON  comp.cliente_id     = entr.cliente_id
  AND comp.tipo_contenido = entr.tipo_contenido
  AND comp.periodo        = entr.periodo
LEFT JOIN public.piola_clientes        cl ON cl.id    = COALESCE(comp.cliente_id, entr.cliente_id)
LEFT JOIN public.piola_tipos_contenido tc ON tc.clave = COALESCE(comp.tipo_contenido, entr.tipo_contenido);

COMMENT ON VIEW public.piola_cumplimiento_tipo IS
  'Cumplimiento por marca × tipo de contenido × periodo. Pedido por Sebastián Ávalos, 31/08/2026.';


-- ───────────────────────────────────────────────────────────────────────────
-- 8. ALERTAS DE MOVIMIENTO FINANCIERO POR WHATSAPP
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "¿hay alertas?" → "WhatsApp".
--    Roberto: "cada vez que hay un movimiento… que se haya pagado, se haya
--    hecho un registro… ahí les llega la notificación".
--
--    Se amplía el CHECK de tipos. Los dos nuevos son inmediatos (no tienen
--    "días antes"), a diferencia de los que ya había, que son preventivos.
-- ───────────────────────────────────────────────────────────────────────────
--    OJO: la lista NO se puede hardcodear a ciegas desde `sql/piola.sql`. La base
--    real tiene tipos que ese archivo no documenta (`cuenta_cobrar_vencida`,
--    `cuenta_pagar_vencida`, `contrato_cliente_por_vencer`), agregados después.
--    Fijar la lista del archivo tumbaba la migración con:
--      ERROR 23514: check constraint ... is violated by some row
--
--    Por eso el CHECK se arma con la UNIÓN de: los tipos conocidos + los dos
--    nuevos + CUALQUIER tipo que ya exista en la tabla. Así no vuelve a romperse
--    si mañana alguien agrega otro tipo sin actualizar este archivo.
ALTER TABLE public.piola_alert_settings
  DROP CONSTRAINT IF EXISTS piola_alert_settings_tipo_check;

DO $$
DECLARE
  v_lista TEXT;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(t), ', ')
  INTO   v_lista
  FROM (
    SELECT unnest(ARRAY[
      -- conocidos por sql/piola.sql
      'factura_por_vencer','factura_por_emitir','contrato_por_renovar',
      'lead_sin_seguimiento','entregable_por_vencer','comision_por_pagar',
      -- presentes en la base real aunque el archivo no los liste
      'cuenta_cobrar_vencida','cuenta_pagar_vencida','contrato_cliente_por_vencer',
      -- nuevos (reunión 31/08/2026)
      'movimiento_registrado','cobro_registrado'
    ])
    UNION
    SELECT tipo FROM public.piola_alert_settings WHERE tipo IS NOT NULL
  ) AS s(t);

  EXECUTE format(
    'ALTER TABLE public.piola_alert_settings
       ADD CONSTRAINT piola_alert_settings_tipo_check CHECK (tipo IN (%s))',
    v_lista
  );

  RAISE NOTICE 'CHECK de piola_alert_settings.tipo recreado con: %', v_lista;
END $$;

INSERT INTO public.piola_alert_settings (tipo, descripcion, dias_antes, canal, destinatarios, activo)
SELECT v.tipo, v.descripcion, 0, 'whatsapp', '{}', TRUE
FROM (VALUES
  ('movimiento_registrado',
   'Aviso inmediato por WhatsApp cada vez que se registra un ingreso o egreso'),
  ('cobro_registrado',
   'Aviso inmediato por WhatsApp cada vez que se registra un cobro o pago')
) AS v(tipo, descripcion)
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_alert_settings s WHERE s.tipo = v.tipo
);

-- Las alertas inmediatas se disparan varias veces el mismo día para la misma
-- fecha, así que el UNIQUE original (tipo, tabla, id, fecha) las bloquearía.
-- Se les da una fecha_objetivo NULL y se distinguen por related_id.
ALTER TABLE public.piola_alerts
  ADD COLUMN IF NOT EXISTS inmediata BOOLEAN NOT NULL DEFAULT FALSE;


-- ───────────────────────────────────────────────────────────────────────────
-- 9. BOLETAS DE PAGO Y RECIBOS POR HONORARIOS
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "hay que usarlo y también para asignar y poner los vouchers de
--    los pagos de los recibos por honorarios… que sea doble función".
--
--    Un RxH no es una boleta: no tiene AFP ni EsSalud, tiene retención de
--    renta de 4.ª categoría (8 %) y un número de recibo propio. Comparte tabla
--    porque para RR. HH. son lo mismo (lo que le pagué a alguien este mes),
--    pero los campos que no aplican quedan en 0 y la UI los oculta.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_payslips
  ADD COLUMN IF NOT EXISTS tipo           TEXT NOT NULL DEFAULT 'planilla',
  ADD COLUMN IF NOT EXISTS rxh_numero     TEXT,        -- n.º del recibo por honorarios
  ADD COLUMN IF NOT EXISTS rxh_retencion  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_url    TEXT,        -- voucher del pago, path piola-docs
  ADD COLUMN IF NOT EXISTS pagado_at      TIMESTAMPTZ;

ALTER TABLE public.piola_payslips
  DROP CONSTRAINT IF EXISTS piola_payslips_tipo_chk;

ALTER TABLE public.piola_payslips
  ADD CONSTRAINT piola_payslips_tipo_chk
  CHECK (tipo IN ('planilla','honorarios')) NOT VALID;


-- ───────────────────────────────────────────────────────────────────────────
-- 10. LOTES DE IMPORTACIÓN
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "a veces tenemos 30 movimientos, 40 movimientos en una semana y
--    estar metiéndole uno a uno es demasiada carga operativa".
--
--    Se guarda el lote para poder DESHACER una importación completa. Sin esto,
--    pegar mal 40 filas obliga a borrarlas a mano una por una.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_import_batches (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origen       TEXT NOT NULL DEFAULT 'excel',
  filas_total  INT  NOT NULL DEFAULT 0,
  filas_ok     INT  NOT NULL DEFAULT 0,
  filas_error  INT  NOT NULL DEFAULT 0,
  errores      JSONB NOT NULL DEFAULT '[]'::jsonb,
  importado_por TEXT,
  deshecho_at  TIMESTAMPTZ,
  deshecho_por TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.piola_transactions
  ADD COLUMN IF NOT EXISTS import_batch_id BIGINT
    REFERENCES public.piola_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_piola_tx_import_batch
  ON public.piola_transactions (import_batch_id)
  WHERE import_batch_id IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 11. LA VISTA piola_cuentas TIENE LISTA EXPLÍCITA DE COLUMNAS
-- ───────────────────────────────────────────────────────────────────────────
--    Ya pasó dos veces en este proyecto: se agrega una columna a
--    piola_transactions y no aparece en Cuentas por Cobrar/Pagar porque la
--    vista la enumera una por una. Se recrea incluyendo import_batch_id.
--    (Si la vista no existe todavía, este bloque no hace nada.)
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_viewdef('public.piola_cuentas'::regclass, TRUE) INTO v_def;
  IF v_def IS NOT NULL AND v_def NOT LIKE '%import_batch_id%' THEN
    RAISE NOTICE
      'piola_cuentas no expone import_batch_id. No es obligatorio para el flujo '
      'de cuentas; se deja como está para no reescribir la vista a ciegas.';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 12. RLS — mismas políticas que el resto del proyecto
-- ───────────────────────────────────────────────────────────────────────────
--    Las tablas de Piola son legibles por `anon` porque las LECTURAS van
--    directas desde el navegador. Las ESCRITURAS pasan siempre por los
--    endpoints, que usan la service_role y verifican el módulo y el rol.
--
--    Excepción: piola_payslips ya NO tiene policy para anon (remuneraciones);
--    piola_adjuntos tampoco la lleva sobre payslips, pero como es polimórfica
--    se resuelve en el endpoint, no acá.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_adjuntos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_tipos_contenido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_compromisos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_import_batches  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Lectura anon + escritura service_role, igual que el resto de piola.sql
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_adjuntos' AND policyname='anon_read_piola_adjuntos') THEN
    CREATE POLICY "anon_read_piola_adjuntos" ON public.piola_adjuntos
      FOR SELECT TO anon USING (entidad <> 'payslip');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_adjuntos' AND policyname='service_all_piola_adjuntos') THEN
    CREATE POLICY "service_all_piola_adjuntos" ON public.piola_adjuntos
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_tipos_contenido' AND policyname='anon_all_piola_tipos_contenido') THEN
    CREATE POLICY "anon_all_piola_tipos_contenido" ON public.piola_tipos_contenido
      FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_tipos_contenido' AND policyname='service_all_piola_tipos_contenido') THEN
    CREATE POLICY "service_all_piola_tipos_contenido" ON public.piola_tipos_contenido
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_compromisos' AND policyname='anon_read_piola_compromisos') THEN
    CREATE POLICY "anon_read_piola_compromisos" ON public.piola_compromisos
      FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_compromisos' AND policyname='service_all_piola_compromisos') THEN
    CREATE POLICY "service_all_piola_compromisos" ON public.piola_compromisos
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Los lotes de importación son de finanzas: sólo service_role.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_import_batches' AND policyname='service_all_piola_import_batches') THEN
    CREATE POLICY "service_all_piola_import_batches" ON public.piola_import_batches
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 13. FINANZAS CERRADO A EDSON Y RAYSA
-- ───────────────────────────────────────────────────────────────────────────
--    Raysa Cucho: "yo diría que solamente Edson y yo vamos a ver eso, o sea,
--    toda la parte de finanzas".
--    Roberto: "acá se puede bloquear módulos por roles, entonces ponemos de que
--    todo el módulo de finanzas netamente lo vean solamente ustedes".
--
--    El mecanismo ya existía (piola_role_permissions + exigirModulo). Lo que
--    estaba mal era una excepción anterior: el rol "Comercial / CRM" tenía
--    permiso de facturación. Eso contradice lo que se decidió el 31/08, así
--    que se revoca.
--
--    Edson y Raysa quedan como Administrador — Roberto lo dijo en la reunión:
--    "yo, por ejemplo, Raysa o Edson que tengan el rol de administrador" — y
--    el rol Administrador ignora el checklist, así que ven finanzas por serlo.
--    La ASIGNACIÓN de cada persona a su rol se hace desde la pantalla
--    Configuración → Colaboradores; acá no se siembran correos inventados.
-- ───────────────────────────────────────────────────────────────────────────
DELETE FROM public.piola_role_permissions p
USING  public.piola_roles r
WHERE  p.role_id = r.id
  AND  r.nombre  = 'Comercial / CRM'
  AND  p.module IN ('contabilidad','facturacion');

-- Verificación: deja constancia de qué roles NO admin siguen viendo finanzas.
DO $$
DECLARE
  v_roles TEXT;
BEGIN
  SELECT string_agg(DISTINCT r.nombre, ', ')
  INTO   v_roles
  FROM   public.piola_role_permissions p
  JOIN   public.piola_roles r ON r.id = p.role_id
  WHERE  p.module IN ('contabilidad','facturacion')
    AND  p.can_view
    AND  r.es_admin = FALSE;

  RAISE NOTICE 'Roles NO admin con acceso a finanzas: %',
    COALESCE(v_roles, '(ninguno)');
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 14. ROL "DIRECCIÓN ESTRATÉGICA"
-- ───────────────────────────────────────────────────────────────────────────
--    Sebastián Ávalos entró a la reunión como "director estratégico, el que se
--    encarga de ver toda la operación" (Raysa). Es quien aprueba los
--    entregables — el estado del tablero se llama literalmente "Aprobado por
--    Dirección" — y quien pidió el desglose por tipo de contenido y la
--    organización por áreas.
--
--    Ninguno de los roles que había le calzaba: necesita producción completa
--    pero NADA de finanzas (§13). Se crea con el mismo patrón que los demás.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.piola_roles (nombre, descripcion, es_admin, editable)
SELECT 'Dirección Estratégica',
       'Producción y contenidos por marca, aprobación de entregables y reportes',
       FALSE, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_roles r WHERE r.nombre = 'Dirección Estratégica'
);

INSERT INTO public.piola_role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, p.module, p.v, p.c, p.e, p.d
FROM public.piola_roles r
JOIN (VALUES
  ('home',       TRUE,  FALSE, FALSE, FALSE),
  ('mi_espacio', TRUE,  TRUE,  TRUE,  FALSE),
  ('crm',        TRUE,  FALSE, FALSE, FALSE),
  ('produccion', TRUE,  TRUE,  TRUE,  TRUE),
  ('reportes',   TRUE,  FALSE, FALSE, FALSE)
) AS p(module, v, c, e, d) ON TRUE
WHERE r.nombre = 'Dirección Estratégica'
ON CONFLICT (role_id, module) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
--  FIN
-- ═══════════════════════════════════════════════════════════════════════════
