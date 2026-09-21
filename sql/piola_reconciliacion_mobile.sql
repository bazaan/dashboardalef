-- ═══════════════════════════════════════════════════════════════════════════
--  LEER ANTES DE CORRER  (estado verificado en la base el 21/09/2026)
--
--  · Las partes ADITIVAS de este archivo (CREATE TABLE IF NOT EXISTS y ADD COLUMN)
--    YA ESTÁN aplicadas en producción. Volver a correrlas no hace nada.
--
--  · Las partes DESTRUCTIVAS NO se ejecutaron y NO DEBEN ejecutarse mientras el
--    código de `main` siga usando las tablas viejas:
--        §3   DROP TABLE piola_compromisos      (tiene 4 filas reales del 14/09 y la
--                                                usan produccion.post.ts, PiolaProduccion.vue
--                                                y la vista piola_cumplimiento_tipo)
--        §6   DROP TABLE piola_adjuntos         (adjuntos.post.ts, PiolaAdjuntos.vue, PiolaClientes.vue)
--        §7   DROP COLUMN piola_payslips.tipo / rxh_numero / rxh_retencion / voucher_url / pagado_at
--                                               (boletas.post.ts, PiolaRRHH.vue: recibos por honorarios)
--        §10  DROP COLUMN piola_transactions.import_batch_id + DROP TABLE piola_import_batches
--                                               (contabilidad.post.ts: importación de movimientos)
--
--  · Las tablas NUEVAS (piola_cliente_compromisos, piola_documentos,
--    piola_recibos_honorarios, piola_import_lotes…) conviven vacías: ningún
--    componente ni endpoint las usa todavía. Migrar el código a ellas es un cambio
--    aparte; recién después tendría sentido borrar las viejas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
--  PIOLA — Reconciliación con feat/mobile-adaptation (07/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Contexto: `feat/mobile-adaptation` se separó de `main` el 31/07/2026 y
--  siguió recibiendo commits de Piola en paralelo, sin ver nada de lo que
--  llegó a `main` después (TradeCars, Fidelización de Healup, Gatwick Retell,
--  SGS, ni la migración de la reunión del 31/08 — `piola_reunion_31ago.sql`).
--
--  Esa rama NO se fusiona tal cual: borraría todo lo anterior. Este archivo
--  toma SOLO sus mejoras de Piola y las reconcilia sobre lo que ya existe.
--
--  Correr UNA vez, DESPUÉS de `piola.sql` y `piola_reunion_31ago.sql`.
--  Idempotente.
--
--  Verificado antes de escribir: `piola_adjuntos`, `piola_compromisos`,
--  `piola_import_batches` y `piola_payslips` (filas con tipo='honorarios')
--  estaban en 0 filas en producción — se reemplazan sin migrar datos.
--  `piola_tipos_contenido` solo tenía el catálogo sembrado (5 filas, sin
--  captura de usuario) — se le renombra la columna clave sin perder nada.
--
--  EXCLUIDO A PROPÓSITO: la consulta de RUC contra un proveedor externo
--  (SUNAT vía apis.net.pe/apiperu.dev/etc., `server/utils/piola-ruc.ts` en
--  esa rama). Edson Polo lo rechazó explícito en la reunión: "con respecto a
--  lo que es este el tema de conectar este sistema con SUNAT, yo creo que eso
--  no lo vamos a hacer, nosotros solo vamos a vaciar información aquí". Las
--  columnas de cache de RUC sí se agregan (útiles para guardar lo que el
--  usuario tipea a mano), pero nada las llena automáticamente.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. piola_tipos_contenido — se le renombra `clave` a `codigo` y se le suma
--    `area_codigo` + `unidad`. Es la misma tabla de la reunión del 31/08,
--    ajustada al esquema que usa el resto de esta reconciliación (el FK de
--    `piola_cliente_compromisos` y `piola_deliverable_asignaciones` apunta
--    a `codigo`, no a `id`).
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'piola_tipos_contenido' AND column_name = 'clave'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'piola_tipos_contenido' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE public.piola_tipos_contenido RENAME COLUMN clave TO codigo;
  END IF;
END $$;

ALTER TABLE public.piola_tipos_contenido
  ADD COLUMN IF NOT EXISTS area_codigo TEXT,
  ADD COLUMN IF NOT EXISTS unidad      TEXT NOT NULL DEFAULT 'pieza';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. piola_produccion_areas — catálogo de SUB-áreas de producción (Diseño,
--    Edición, Rodajes, Guiones, Community…), distinto de `piola_areas`
--    (Dirección/Comercial/Producción/Administración, que es de toda la
--    empresa y sigue usándose donde ya se usaba). Es lo que pidieron Raysa y
--    Sebastián: "producción y guiones… rodajes… lo que tú desees" y el
--    "equipo de diseñadores gráficos y de editores".
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_produccion_areas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#8e8e8e',
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0
);

INSERT INTO public.piola_produccion_areas (codigo, nombre, color, orden)
SELECT v.codigo, v.nombre, v.color, v.orden
FROM (VALUES
  ('produccion', 'Producción',  '#e2564a', 1),
  ('guiones',    'Guiones',     '#f2a63b', 2),
  ('rodajes',    'Rodajes',     '#4a7fe2', 3),
  ('diseno',     'Diseño',      '#7c5ce2', 4),
  ('edicion',    'Edición',     '#2e9e5b', 5),
  ('community',  'Community',   '#e25c9e', 6)
) AS v(codigo, nombre, color, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_produccion_areas a WHERE a.codigo = v.codigo);

-- El FK de piola_tipos_contenido.area_codigo se agrega ahora que la tabla existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'piola_tipos_contenido_area_codigo_fkey'
  ) THEN
    ALTER TABLE public.piola_tipos_contenido
      ADD CONSTRAINT piola_tipos_contenido_area_codigo_fkey
      FOREIGN KEY (area_codigo) REFERENCES public.piola_produccion_areas(codigo) ON DELETE SET NULL;
  END IF;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. piola_cliente_compromisos — reemplaza a `piola_compromisos` (0 filas).
--    Diferencia real: un compromiso ESTÁNDAR por cliente×tipo (se edita
--    cuando cambia, no se redefine cada mes), en vez de uno por periodo.
--    Es más simple para el caso real: "esta marca son 7 videos + 7 piezas
--    al mes" es un acuerdo que dura, no algo que se vuelve a escribir cada
--    30 días.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_cliente_compromisos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id        BIGINT NOT NULL REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  tipo_contenido    TEXT NOT NULL REFERENCES public.piola_tipos_contenido(codigo) ON DELETE CASCADE,
  cantidad_mensual  NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, tipo_contenido)
);

DROP TABLE IF EXISTS public.piola_compromisos;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. piola_deliverable_asignaciones — un entregable puede tener VARIOS
--    responsables con roles distintos (el diseñador que lo arma y el editor
--    que lo cierra no son la misma persona). `responsable_email` en
--    `piola_deliverables` se conserva para lo simple; esto es para cuando
--    hace falta más de una persona.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_deliverable_asignaciones (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deliverable_id    BIGINT NOT NULL REFERENCES public.piola_deliverables(id) ON DELETE CASCADE,
  colaborador_email TEXT NOT NULL,
  rol               TEXT NOT NULL DEFAULT 'responsable',
  area_codigo       TEXT REFERENCES public.piola_produccion_areas(codigo) ON DELETE SET NULL,
  asignado_por      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deliverable_id, colaborador_email, rol)
);

CREATE INDEX IF NOT EXISTS idx_piola_asig_colab
  ON public.piola_deliverable_asignaciones (lower(colaborador_email));


-- ───────────────────────────────────────────────────────────────────────────
-- 5. piola_deliverables — se agrega `area_codigo` (referencia al catálogo de
--    sub-áreas de producción). `tipo_contenido`, `dropbox_url`,
--    `publicado_url` ya existían desde la reunión del 31/08; se les suma el
--    FK a `codigo` y dos campos más. `area_id` (mi columna anterior, que
--    apuntaba a `piola_areas`) se deja tal cual: nadie la usó (0 filas con
--    ese campo lleno) y no molesta.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_deliverables
  ADD COLUMN IF NOT EXISTS area_codigo       TEXT REFERENCES public.piola_produccion_areas(codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_publicacion DATE,
  ADD COLUMN IF NOT EXISTS created_by        TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'piola_deliverables_tipo_contenido_fkey'
  ) THEN
    ALTER TABLE public.piola_deliverables
      ADD CONSTRAINT piola_deliverables_tipo_contenido_fkey
      FOREIGN KEY (tipo_contenido) REFERENCES public.piola_tipos_contenido(codigo) ON DELETE SET NULL;
  END IF;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 6. piola_documentos — reemplaza a `piola_adjuntos` (0 filas). Mismo
--    concepto (adjuntos polimórficos), catálogo de entidades más amplio
--    ('colaborador', 'recibo_honorarios', 'lead' que `piola_adjuntos` no
--    tenía) y separa `mime`/`tamano_bytes` como columnas propias.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_documentos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad       TEXT NOT NULL CHECK (entidad IN (
                  'factura','contrato','adenda','movimiento','cliente',
                  'colaborador','recibo_honorarios','lead','entregable')),
  entidad_id    BIGINT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN (
                  'factura','constancia_detraccion','contrato','anexo','ficha_ruc',
                  'legal','comprobante','boleta','recibo','orden_compra','otro')),
  nombre        TEXT NOT NULL,
  path          TEXT NOT NULL,
  mime          TEXT,
  tamano_bytes  BIGINT,
  descripcion   TEXT,
  subido_por    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_docs_entidad
  ON public.piola_documentos (entidad, entidad_id, created_at DESC);

DROP TABLE IF EXISTS public.piola_adjuntos;


-- ───────────────────────────────────────────────────────────────────────────
-- 7. piola_recibos_honorarios — tabla propia para recibos por honorarios, en
--    vez de forzarlos dentro de `piola_payslips` (que queda solo para
--    planilla). Un RxH necesita su propia numeración (la emite el prestador
--    en SUNAT), su RUC y su propio ciclo de vida — mezclarlo en la tabla de
--    boletas de planilla obligaba a esconder columnas que no aplican.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_recibos_honorarios (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo             TEXT NOT NULL UNIQUE,
  colaborador_email  TEXT NOT NULL,
  colaborador_nombre TEXT,
  colaborador_ruc    TEXT,
  periodo            TEXT NOT NULL,
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  serie              TEXT,
  numero             TEXT,
  descripcion        TEXT,
  monto_bruto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  retencion_pct      NUMERIC(5,2) NOT NULL DEFAULT 8,
  retencion_monto    NUMERIC(12,2) NOT NULL DEFAULT 0,
  suspension_renta   BOOLEAN NOT NULL DEFAULT FALSE,
  otros_descuentos   NUMERIC(12,2) NOT NULL DEFAULT 0,
  neto               NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','pagado','anulado')),
  fecha_pago         DATE,
  transaction_id     BIGINT REFERENCES public.piola_transactions(id) ON DELETE SET NULL,
  pdf_url            TEXT,
  detalle            JSONB NOT NULL DEFAULT '{}'::jsonb,
  generado_por       TEXT,
  enviado_at         TIMESTAMPTZ,
  enviado_a          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (colaborador_email, periodo)
);

-- Las columnas que la reunión del 31/08 le había agregado a piola_payslips
-- para simular esto quedan retiradas (0 filas las usaban).
ALTER TABLE public.piola_payslips
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS rxh_numero,
  DROP COLUMN IF EXISTS rxh_retencion,
  DROP COLUMN IF EXISTS voucher_url,
  DROP COLUMN IF EXISTS pagado_at;

ALTER TABLE public.piola_payslips
  DROP CONSTRAINT IF EXISTS piola_payslips_tipo_chk;

ALTER TABLE public.piola_colaboradores
  ADD COLUMN IF NOT EXISTS ruc              TEXT,
  ADD COLUMN IF NOT EXISTS honorarios_monto NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS suspension_renta BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rh_serie         TEXT;


-- ───────────────────────────────────────────────────────────────────────────
-- 8. piola_facturas_programadas — genera automáticamente el borrador de la
--    factura de un contrato recurrente cada mes, en vez de que alguien se
--    acuerde de darle "Generar cobro del mes" en la pantalla de Contratos
--    (ese botón sigue existiendo y sigue funcionando igual; esto es la
--    versión que no depende de que nadie lo recuerde).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_facturas_programadas (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contrato_id      BIGINT NOT NULL REFERENCES public.piola_contratos(id) ON DELETE CASCADE,
  cliente_id       BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  periodo          TEXT NOT NULL,
  fecha_programada DATE NOT NULL,
  concepto         TEXT,
  monto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','generada','omitida','error')),
  invoice_id       BIGINT REFERENCES public.piola_invoices(id) ON DELETE SET NULL,
  generada_at      TIMESTAMPTZ,
  generada_por     TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contrato_id, periodo)
);


-- ───────────────────────────────────────────────────────────────────────────
-- 9. piola_enlaces_carpetas — enlaces de Dropbox/Drive por CLIENTE (varios
--    por cliente, con nombre). Distinto del `dropbox_url` que ya tiene cada
--    ENTREGABLE: eso es "el link de este video puntual"; esto es "la carpeta
--    general de la marca en Drive", que Raysa pidió poder ver de un vistazo.
--    Enlace fijo, tal como quedó acordado — sin API de Dropbox.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_enlaces_carpetas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id  BIGINT REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  proveedor   TEXT NOT NULL DEFAULT 'drive' CHECK (proveedor IN ('drive','dropbox','otro')),
  nombre      TEXT NOT NULL,
  url         TEXT NOT NULL,
  folder_id   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 10. Importación desde Excel — piola_import_plantillas + piola_import_lotes
--     reemplazan a piola_import_batches (0 filas). Diferencia real: guarda
--     el MAPEO de columnas como plantilla reutilizable (Edson no tiene que
--     recordar el orden cada vez que pega) y detecta filas duplicadas, no
--     solo inválidas.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_import_plantillas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  tipo        TEXT NOT NULL DEFAULT 'movimientos' CHECK (tipo IN ('movimientos')),
  descripcion TEXT,
  mapeo       JSONB NOT NULL DEFAULT '{}'::jsonb,
  opciones    JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.piola_import_lotes (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plantilla_id      BIGINT REFERENCES public.piola_import_plantillas(id) ON DELETE SET NULL,
  archivo_nombre    TEXT,
  hoja              TEXT,
  filas_total       INT NOT NULL DEFAULT 0,
  filas_importadas  INT NOT NULL DEFAULT 0,
  filas_duplicadas  INT NOT NULL DEFAULT 0,
  filas_error       INT NOT NULL DEFAULT 0,
  monto_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado            TEXT NOT NULL DEFAULT 'importado'
                    CHECK (estado IN ('importado','parcial','error','revertido')),
  detalle           JSONB NOT NULL DEFAULT '{}'::jsonb,
  importado_por     TEXT,
  revertido_por     TEXT,
  revertido_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- piola_transactions.import_batch_id (reunión 31/08) se reemplaza por
-- import_lote_id, apuntando a la tabla nueva.
ALTER TABLE public.piola_transactions
  DROP COLUMN IF EXISTS import_batch_id,
  ADD COLUMN IF NOT EXISTS import_lote_id BIGINT REFERENCES public.piola_import_lotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_hash    TEXT,
  ADD COLUMN IF NOT EXISTS import_fila    INT;

DROP TABLE IF EXISTS public.piola_import_batches;


-- ───────────────────────────────────────────────────────────────────────────
-- 11. Facturación — numeración manual explícita + vínculo con contrato
--     recurrente. La numeración YA era manual desde la reunión del 31/08
--     (Edson: "nosotros ya tenemos un número y serie avanzado"); esta
--     columna solo dice explícitamente que esa factura se numeró a mano,
--     para distinguirla de las que en el futuro pueda generar sola
--     `piola_facturas_programadas`.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_invoices
  ADD COLUMN IF NOT EXISTS numeracion_manual BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS contrato_id       BIGINT REFERENCES public.piola_contratos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen            TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS periodo_facturado TEXT,
  ADD COLUMN IF NOT EXISTS cliente_email     TEXT,
  ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;


-- ───────────────────────────────────────────────────────────────────────────
-- 12. Contratos — modelo de cuota recurrente más completo (código propio,
--     estado, moneda, frecuencia, detracción por defecto, serie de
--     facturación, renovación automática). Complementa `pago_mensual` /
--     `dia_pago` que ya existían (esos NO se tocan — "generar_cobro" sigue
--     funcionando igual).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_contratos
  ADD COLUMN IF NOT EXISTS codigo                 TEXT,
  ADD COLUMN IF NOT EXISTS descripcion            TEXT,
  ADD COLUMN IF NOT EXISTS estado                 TEXT NOT NULL DEFAULT 'vigente',
  ADD COLUMN IF NOT EXISTS monto_total            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS monto_periodico        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS moneda                 TEXT NOT NULL DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS facturacion_recurrente BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS frecuencia             TEXT NOT NULL DEFAULT 'mensual',
  ADD COLUMN IF NOT EXISTS dia_facturacion        INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS con_detraccion         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS detraccion_pct         NUMERIC(5,2) DEFAULT 12,
  ADD COLUMN IF NOT EXISTS detraccion_codigo      TEXT,
  ADD COLUMN IF NOT EXISTS serie_factura          TEXT,
  ADD COLUMN IF NOT EXISTS renovacion_automatica  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS responsable_email      TEXT,
  ADD COLUMN IF NOT EXISTS created_by             TEXT,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ───────────────────────────────────────────────────────────────────────────
-- 13. Cache de datos de RUC en piola_clientes — SOLO columnas para guardar lo
--     que se tipea a mano (o lo que se cargue manualmente más adelante). NO
--     se agrega ninguna consulta automática a SUNAT ni a ninguna pasarela
--     externa: eso quedó rechazado en la reunión del 31/08 y sigue así.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_clientes
  ADD COLUMN IF NOT EXISTS numero_documento  TEXT,
  ADD COLUMN IF NOT EXISTS nombre_comercial  TEXT,
  ADD COLUMN IF NOT EXISTS estado_sunat      TEXT,
  ADD COLUMN IF NOT EXISTS condicion_sunat   TEXT,
  ADD COLUMN IF NOT EXISTS distrito          TEXT,
  ADD COLUMN IF NOT EXISTS provincia         TEXT,
  ADD COLUMN IF NOT EXISTS departamento      TEXT,
  ADD COLUMN IF NOT EXISTS ruc_consultado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ruc_datos         JSONB,
  ADD COLUMN IF NOT EXISTS condicion_pago_id BIGINT REFERENCES public.piola_condiciones_pago(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by        TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.piola_clientes
  ALTER COLUMN tipo_documento SET DEFAULT 'RUC';


-- ───────────────────────────────────────────────────────────────────────────
-- 14. Alertas — eventos disparadores configurables por umbral de monto.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_alert_settings
  ADD COLUMN IF NOT EXISTS eventos           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monto_minimo      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion_larga TEXT;


-- ═══════════════════════════════════════════════════════════════════════════
-- 15. piola_modulo_acceso — lista blanca por correo, ENCIMA de los permisos
--     por rol. Resuelve EXACTAMENTE el mismo pedido de la reunión del 31/08
--     ("finanzas solo para Edson y Raysa") con una defensa más sólida que
--     revocar el permiso de un rol: un rol se hereda, y basta que alguien
--     más quede marcado con "Contabilidad" para que la restricción se
--     rompa sin que nadie lo note. Con la lista blanca, aunque un rol tenga
--     el módulo marcado, si el correo no está en la lista, no entra.
--
--     FALLA CERRADO a propósito: si la restricción está activa (`activo`)
--     y la lista de `emails` queda vacía, el módulo se cierra para todos
--     menos el Administrador — nunca al revés.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.piola_modulo_acceso (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo        TEXT NOT NULL UNIQUE,
  modulos      TEXT[] NOT NULL DEFAULT '{}',
  emails       TEXT[] NOT NULL DEFAULT '{}',
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla: el mismo acuerdo del 31/08 ("finanzas solo para Edson y Raysa"),
-- ahora con la defensa de lista blanca además de la revocación de rol que ya
-- se había aplicado. Correos confirmados en `dashboardlogin` (company_id='piola').
INSERT INTO public.piola_modulo_acceso (grupo, modulos, emails, descripcion)
SELECT 'finanzas', ARRAY['contabilidad','facturacion'],
       ARRAY['administracion@agenciapiola.com', 'raysa@agenciapiola.com'],
       'Edson Polo y Raysa Cucho — único grupo con acceso a Contabilidad y Facturación (reunión 31/08/2026)'
WHERE NOT EXISTS (SELECT 1 FROM public.piola_modulo_acceso WHERE grupo = 'finanzas');


-- ───────────────────────────────────────────────────────────────────────────
-- 16. RLS — mismo patrón que el resto de Piola: lectura anon donde no hay
--     datos sensibles, escritura solo por service_role (los endpoints).
--     Excepción: piola_recibos_honorarios sigue la regla de remuneraciones
--     (sin policy para anon, igual que piola_payslips).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_produccion_areas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_cliente_compromisos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_deliverable_asignaciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_documentos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_recibos_honorarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_facturas_programadas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_enlaces_carpetas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_import_plantillas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_import_lotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_modulo_acceso             ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_produccion_areas' AND policyname='anon_read_piola_produccion_areas') THEN
    CREATE POLICY "anon_read_piola_produccion_areas" ON public.piola_produccion_areas FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_produccion_areas' AND policyname='service_all_piola_produccion_areas') THEN
    CREATE POLICY "service_all_piola_produccion_areas" ON public.piola_produccion_areas FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_cliente_compromisos' AND policyname='anon_read_piola_cliente_compromisos') THEN
    CREATE POLICY "anon_read_piola_cliente_compromisos" ON public.piola_cliente_compromisos FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_cliente_compromisos' AND policyname='service_all_piola_cliente_compromisos') THEN
    CREATE POLICY "service_all_piola_cliente_compromisos" ON public.piola_cliente_compromisos FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_deliverable_asignaciones' AND policyname='anon_read_piola_deliverable_asignaciones') THEN
    CREATE POLICY "anon_read_piola_deliverable_asignaciones" ON public.piola_deliverable_asignaciones FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_deliverable_asignaciones' AND policyname='service_all_piola_deliverable_asignaciones') THEN
    CREATE POLICY "service_all_piola_deliverable_asignaciones" ON public.piola_deliverable_asignaciones FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_documentos' AND policyname='anon_read_piola_documentos') THEN
    CREATE POLICY "anon_read_piola_documentos" ON public.piola_documentos FOR SELECT TO anon USING (entidad <> 'recibo_honorarios');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_documentos' AND policyname='service_all_piola_documentos') THEN
    CREATE POLICY "service_all_piola_documentos" ON public.piola_documentos FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- piola_recibos_honorarios: SIN policy anon (remuneraciones), solo service_role.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_recibos_honorarios' AND policyname='service_all_piola_recibos_honorarios') THEN
    CREATE POLICY "service_all_piola_recibos_honorarios" ON public.piola_recibos_honorarios FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_facturas_programadas' AND policyname='anon_read_piola_facturas_programadas') THEN
    CREATE POLICY "anon_read_piola_facturas_programadas" ON public.piola_facturas_programadas FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_facturas_programadas' AND policyname='service_all_piola_facturas_programadas') THEN
    CREATE POLICY "service_all_piola_facturas_programadas" ON public.piola_facturas_programadas FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_enlaces_carpetas' AND policyname='anon_read_piola_enlaces_carpetas') THEN
    CREATE POLICY "anon_read_piola_enlaces_carpetas" ON public.piola_enlaces_carpetas FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_enlaces_carpetas' AND policyname='service_all_piola_enlaces_carpetas') THEN
    CREATE POLICY "service_all_piola_enlaces_carpetas" ON public.piola_enlaces_carpetas FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_import_plantillas' AND policyname='anon_read_piola_import_plantillas') THEN
    CREATE POLICY "anon_read_piola_import_plantillas" ON public.piola_import_plantillas FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_import_plantillas' AND policyname='service_all_piola_import_plantillas') THEN
    CREATE POLICY "service_all_piola_import_plantillas" ON public.piola_import_plantillas FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Lotes de importación: son de finanzas, solo service_role.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_import_lotes' AND policyname='service_all_piola_import_lotes') THEN
    CREATE POLICY "service_all_piola_import_lotes" ON public.piola_import_lotes FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- La lista blanca de accesos: solo service_role la lee/escribe (la
  -- resuelve el servidor en cada request, nunca el navegador directo).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='piola_modulo_acceso' AND policyname='service_all_piola_modulo_acceso') THEN
    CREATE POLICY "service_all_piola_modulo_acceso" ON public.piola_modulo_acceso FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  FIN
-- ═══════════════════════════════════════════════════════════════════════════
