-- ══════════════════════════════════════════════════════════════════════════
-- PIOLA × ALEF COMPANY — Esquema completo del Dashboard / CRM
--
-- ESTE ES EL ÚNICO ARCHIVO SQL QUE HAY QUE EJECUTAR.
-- Pegar entero en el SQL Editor de Supabase y correr. Se puede correr las
-- veces que haga falta: es IDEMPOTENTE de principio a fin (CREATE ... IF NOT
-- EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, y todos los INSERT de
-- catálogos van con WHERE NOT EXISTS). Sirve tanto para una base vacía como
-- para una donde ya se corrió parte.
--
-- Reemplaza a los cuatro archivos anteriores, concatenados EN ORDEN porque
-- cada uno se apoya en el anterior:
--
--   1. Esquema base .................. era piola_tables.sql
--   2. Reunión del 19/08 ............. era piola_migracion_02.sql
--   3. Financiero + expediente ....... era piola_migracion_03.sql
--   4. Correcciones de auditoría ..... era piola_migracion_04.sql
--
-- El orden importa: la parte 4 hace CREATE OR REPLACE de funciones que crea
-- la 3, así que la versión que queda viva es la de la 4.
--
-- Qué hace cada parte y por qué está explicado en PIOLA.md, en la raíz.
--
-- CONVENCIONES
--   • Moneda única PEN. Zona horaria de negocio: America/Lima (UTC-5 todo el
--     año). Los TIMESTAMPTZ se guardan en UTC y se formatean a Lima en la app.
--   • Todo catálogo (etapas, categorías, servicios, métodos de pago, impuestos)
--     es una TABLA editable desde la UI, no un enum hardcodeado.
--
-- SEGURIDAD
--   • Tablas operativas → `anon` puede CRUD, igual que el resto del dashboard.
--     Los permisos por módulo los aplican los endpoints de `server/api/piola/`,
--     que son el único camino por el que las pantallas escriben.
--   • Tablas SENSIBLES (piola_payslips, piola_afp_reports, piola_commissions)
--     → SIN policy para `anon`. Solo se leen por endpoint con verificación.
--   • piola_auditoria censura los importes de remuneración (ver parte 4).
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
--
--   PARTE 1 de 4 — ESQUEMA BASE
--
--   Fuente: "Especificación — Dashboard / CRM Piola" (reunión 30/07).
--   
--   CRM comercial, contabilidad y flujo de caja, facturación con detracción,
--   producción y contenidos, RR. HH. (tareo y vacaciones), planilla
--   (boletas + AFP, restringido), reportes y alertas, roles y permisos.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.piola_roles (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  es_admin      BOOLEAN NOT NULL DEFAULT FALSE,   -- acceso total, ignora el checklist
  editable      BOOLEAN NOT NULL DEFAULT TRUE,    -- los roles base no se borran
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulos del menú lateral (§2). 'mi_espacio' = vista propia del colaborador.
CREATE TABLE IF NOT EXISTS public.piola_role_permissions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id     BIGINT NOT NULL REFERENCES public.piola_roles(id) ON DELETE CASCADE,
  module      TEXT NOT NULL CHECK (module IN (
                'home','crm','contabilidad','facturacion','produccion',
                'rrhh','reportes','configuracion','mi_espacio')),
  can_view    BOOLEAN NOT NULL DEFAULT FALSE,
  can_create  BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role_id, module)
);

-- Ficha del colaborador. El LOGIN sigue viviendo en `dashboardlogin` (global);
-- esta tabla agrega los datos que Piola necesita (contrato, AFP, comisión).
CREATE TABLE IF NOT EXISTS public.piola_colaboradores (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,        -- = dashboardlogin.email
  nombre              TEXT NOT NULL,
  dni                 TEXT,
  telefono            TEXT,
  cargo               TEXT,
  role_id             BIGINT REFERENCES public.piola_roles(id) ON DELETE SET NULL,

  -- §7.2 el cálculo de vacaciones aplica SOLO a planilla
  tipo_contrato       TEXT NOT NULL DEFAULT 'honorarios'
                      CHECK (tipo_contrato IN ('planilla','honorarios')),
  fecha_ingreso       DATE,                        -- carga manual (antigüedad)
  fecha_fin_contrato  DATE,                        -- para el widget "quedan X días"

  -- Datos de planilla (sensibles: solo Administrador los ve vía endpoint)
  sueldo_bruto        NUMERIC(12,2),
  asignacion_familiar BOOLEAN NOT NULL DEFAULT FALSE,
  afp_nombre          TEXT,                        -- Integra, Prima, Profuturo, Habitat, ONP
  afp_cuspp           TEXT,
  afp_tipo_comision   TEXT CHECK (afp_tipo_comision IN ('flujo','mixta')),

  -- §4 comisiones: parametrizable por colaborador (la fórmula exacta la envía Piola)
  comision_pct        NUMERIC(6,3) DEFAULT 0,

  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_colab_email ON public.piola_colaboradores (lower(email));


-- ══════════════════════════════════════════════════════════════════════════
-- 1. CRM COMERCIAL (§3)
-- ══════════════════════════════════════════════════════════════════════════

-- Etapas/estados EDITABLES desde Configuración (crear, renombrar, color, orden)
CREATE TABLE IF NOT EXISTS public.piola_lead_stages (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#8e8e8e',
  orden       INT  NOT NULL DEFAULT 0,
  es_ganado   BOOLEAN NOT NULL DEFAULT FALSE,   -- al entrar aquí se puede convertir en Cliente
  es_perdido  BOOLEAN NOT NULL DEFAULT FALSE,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.piola_clientes (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre               TEXT NOT NULL,
  ruc                  TEXT,
  razon_social         TEXT,
  contacto             TEXT,
  email                TEXT,
  telefono             TEXT,
  direccion            TEXT,
  lead_id              BIGINT,                     -- de dónde salió (FK abajo)
  compromiso_mensual   INT DEFAULT 0,              -- piezas/contenidos comprometidos al mes
  notas                TEXT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.piola_leads (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              TEXT NOT NULL,
  telefono            TEXT,                        -- WhatsApp: el lead entra por ahí (§3)
  email               TEXT,
  empresa             TEXT,
  -- tiktok_ads queda en el enum pero NO se integra (§3, §14)
  fuente              TEXT NOT NULL DEFAULT 'meta_ads'
                      CHECK (fuente IN ('meta_ads','referido','instagram_dm','organico',
                                        'whatsapp','facebook','tiktok_ads','otro')),
  stage_id            BIGINT REFERENCES public.piola_lead_stages(id) ON DELETE SET NULL,
  owner_email         TEXT,                        -- responsable (closer)
  monto_cotizado      NUMERIC(12,2) DEFAULT 0,
  moneda              TEXT NOT NULL DEFAULT 'PEN',
  servicios           TEXT[] DEFAULT '{}',         -- servicios de interés
  notas               TEXT,
  fecha_ingreso       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_interaccion  TIMESTAMPTZ,
  proxima_accion      TIMESTAMPTZ,                 -- seguimiento diario/interdiario
  fecha_cierre        TIMESTAMPTZ,
  resultado           TEXT CHECK (resultado IN ('ganado','perdido')),
  motivo_perdida      TEXT,
  cliente_id          BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  meta_ad_id          TEXT,                        -- trazabilidad con Meta Ads
  meta_campaign       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.piola_clientes
    ADD CONSTRAINT piola_clientes_lead_fk
    FOREIGN KEY (lead_id) REFERENCES public.piola_leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_piola_leads_stage  ON public.piola_leads (stage_id);
CREATE INDEX IF NOT EXISTS idx_piola_leads_owner  ON public.piola_leads (owner_email);
CREATE INDEX IF NOT EXISTS idx_piola_leads_fecha  ON public.piola_leads (fecha_ingreso DESC);

-- Historial de interacciones: fecha, canal, nota y próxima acción (§3)
CREATE TABLE IF NOT EXISTS public.piola_lead_activities (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id         BIGINT NOT NULL REFERENCES public.piola_leads(id) ON DELETE CASCADE,
  user_email      TEXT,
  canal           TEXT NOT NULL DEFAULT 'whatsapp'
                  CHECK (canal IN ('whatsapp','llamada','correo','reunion_presencial',
                                   'reunion_virtual','instagram','nota')),
  nota            TEXT,
  proxima_accion  TIMESTAMPTZ,
  stage_anterior  BIGINT,
  stage_nuevo     BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_lead_act ON public.piola_lead_activities (lead_id, created_at DESC);

-- Métricas de la cuenta publicitaria de Meta (una sola cuenta activa — §3, §14)
CREATE TABLE IF NOT EXISTS public.piola_meta_metrics (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha         DATE NOT NULL,
  cuenta_id     TEXT,
  campania      TEXT,
  inversion     NUMERIC(12,2) NOT NULL DEFAULT 0,
  impresiones   BIGINT DEFAULT 0,
  clics         BIGINT DEFAULT 0,
  leads         INT NOT NULL DEFAULT 0,
  costo_por_lead NUMERIC(12,2),
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fecha, cuenta_id, campania)
);


-- ══════════════════════════════════════════════════════════════════════════
-- 2. CONTABILIDAD Y FLUJO DE CAJA (§4)
--    NO reemplaza a Syscon: aquí vive el flujo de caja real + proyecciones.
-- ══════════════════════════════════════════════════════════════════════════

-- Categorías JERÁRQUICAS (carpeta → subcarpeta, n niveles) con CRUD en la UI:
-- el administrador agrega el gasto operativo N.º 31 sin tocar código (§4).
CREATE TABLE IF NOT EXISTS public.piola_expense_categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL,
  parent_id   BIGINT REFERENCES public.piola_expense_categories(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'egreso' CHECK (tipo IN ('ingreso','egreso','ambos')),
  color       TEXT,
  orden       INT NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_cat_parent ON public.piola_expense_categories (parent_id);

-- Catálogo abierto, pero hoy solo transferencia bancaria está activa (§4)
CREATE TABLE IF NOT EXISTS public.piola_payment_methods (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE,
  activo  BOOLEAN NOT NULL DEFAULT TRUE,
  orden   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.piola_transactions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto        TEXT NOT NULL,
  monto           NUMERIC(12,2) NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'PEN',
  category_id     BIGINT REFERENCES public.piola_expense_categories(id) ON DELETE SET NULL,
  cliente_id      BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  proveedor       TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'Transferencia bancaria',
  invoice_id      BIGINT,                          -- FK a piola_invoices (abajo)
  comprobante_url TEXT,                            -- Google Drive
  proyectado      BOOLEAN NOT NULL DEFAULT FALSE,  -- true = proyección, no caja real
  notas           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_tx_fecha ON public.piola_transactions (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_piola_tx_cat   ON public.piola_transactions (category_id);


-- ══════════════════════════════════════════════════════════════════════════
-- 3. FACTURACIÓN SUNAT (§5) — el ~98 % va CON detracción
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_invoices (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id          BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  cliente_nombre      TEXT,                        -- copia congelada al emitir
  cliente_ruc         TEXT,
  tipo_comprobante    INT NOT NULL DEFAULT 1,      -- 1 = factura, 2 = boleta (PSE/NubeFact)
  serie               TEXT NOT NULL DEFAULT 'F001',
  numero              BIGINT NOT NULL,
  fecha_emision       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   DATE,
  moneda              TEXT NOT NULL DEFAULT 'PEN',
  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Detracción (obligatoria en la práctica para Piola)
  con_detraccion      BOOLEAN NOT NULL DEFAULT TRUE,
  detraccion_codigo   TEXT,                        -- código de bien/servicio SUNAT
  detraccion_pct      NUMERIC(5,2) DEFAULT 12,
  detraccion_monto    NUMERIC(12,2) DEFAULT 0,
  neto_a_pagar        NUMERIC(12,2),               -- total − detracción

  items               JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado              TEXT NOT NULL DEFAULT 'emitida'
                      CHECK (estado IN ('borrador','emitida','enviada','pagada','vencida','anulada','error')),
  sunat_response      JSONB,
  aceptada_por_sunat  BOOLEAN,
  pdf_url             TEXT,                        -- PDF con branding Piola
  xml_url             TEXT,
  enviada_at          TIMESTAMPTZ,
  pagada_at           TIMESTAMPTZ,
  notas               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tipo_comprobante, serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_piola_inv_cliente ON public.piola_invoices (cliente_id);
CREATE INDEX IF NOT EXISTS idx_piola_inv_estado  ON public.piola_invoices (estado);
CREATE INDEX IF NOT EXISTS idx_piola_inv_venc    ON public.piola_invoices (fecha_vencimiento);

DO $$ BEGIN
  ALTER TABLE public.piola_transactions
    ADD CONSTRAINT piola_tx_invoice_fk
    FOREIGN KEY (invoice_id) REFERENCES public.piola_invoices(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 4. PRODUCCIÓN Y CONTENIDOS (§6)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_services (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              TEXT NOT NULL,
  categoria           TEXT,
  descripcion         TEXT,
  precio_referencial  NUMERIC(12,2),
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  orden               INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entregables por marca/cliente. Flujo de aprobación del Director Estratégico.
CREATE TABLE IF NOT EXISTS public.piola_deliverables (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id          BIGINT REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  service_id          BIGINT REFERENCES public.piola_services(id) ON DELETE SET NULL,
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  cantidad            INT NOT NULL DEFAULT 1,
  periodo             TEXT,                        -- 'YYYY-MM' → cumplimiento mensual
  fecha_compromiso    DATE,
  fecha_entrega       DATE,
  estado              TEXT NOT NULL DEFAULT 'en_produccion'
                      CHECK (estado IN ('en_produccion','en_revision','aprobado','entregado','rechazado')),
  responsable_email   TEXT,
  aprobado_por        TEXT,                        -- Director Estratégico
  aprobado_at         TIMESTAMPTZ,
  observaciones       TEXT,
  drive_url           TEXT,                        -- adjuntos en Google Drive
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_deliv_cliente ON public.piola_deliverables (cliente_id, periodo);
CREATE INDEX IF NOT EXISTS idx_piola_deliv_estado  ON public.piola_deliverables (estado);


-- ══════════════════════════════════════════════════════════════════════════
-- 5. RR. HH. — TAREO Y VACACIONES (§7.1, §7.2)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_attendance (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_email   TEXT NOT NULL,
  fecha               DATE NOT NULL,               -- día Lima
  check_in            TIMESTAMPTZ,                 -- SIEMPRE timestamp del servidor
  check_out           TIMESTAMPTZ,
  worked_minutes      INT NOT NULL DEFAULT 0,      -- efectivos (descontando breaks)
  break_minutes       INT NOT NULL DEFAULT 0,
  estado              TEXT NOT NULL DEFAULT 'incompleto'
                      CHECK (estado IN ('completo','incompleto','falta','feriado','vacaciones','licencia')),
  notas               TEXT,
  editado_por         TEXT,                        -- corrección manual del admin
  editado_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (colaborador_email, fecha)
);

CREATE INDEX IF NOT EXISTS idx_piola_att_fecha ON public.piola_attendance (fecha DESC);

CREATE TABLE IF NOT EXISTS public.piola_attendance_breaks (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id  BIGINT NOT NULL REFERENCES public.piola_attendance(id) ON DELETE CASCADE,
  break_start    TIMESTAMPTZ NOT NULL,
  break_end      TIMESTAMPTZ,
  minutos        INT
);

-- Auditoría: quién editó una marcación y cuándo (§7.1)
CREATE TABLE IF NOT EXISTS public.piola_attendance_audit (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id   BIGINT REFERENCES public.piola_attendance(id) ON DELETE CASCADE,
  colaborador_email TEXT,
  fecha           DATE,
  cambios         JSONB NOT NULL,                  -- { campo: {antes, despues} }
  motivo          TEXT,
  editado_por     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15 días/año → 1.25 días por mes trabajado. SOLO para tipo_contrato='planilla'.
CREATE TABLE IF NOT EXISTS public.piola_vacation_requests (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_email  TEXT NOT NULL,
  fecha_inicio       DATE NOT NULL,
  fecha_fin          DATE NOT NULL,
  dias               NUMERIC(5,2) NOT NULL,
  motivo             TEXT,
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aprobada','rechazada','cancelada')),
  aprobado_por       TEXT,
  aprobado_at        TIMESTAMPTZ,
  comentario_admin   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_vac_colab ON public.piola_vacation_requests (colaborador_email, estado);

-- Ajustes manuales del saldo (días arrastrados, compensaciones, correcciones)
CREATE TABLE IF NOT EXISTS public.piola_vacation_adjustments (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_email  TEXT NOT NULL,
  dias               NUMERIC(5,2) NOT NULL,        -- positivo suma, negativo resta
  motivo             TEXT,
  creado_por         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════
-- 6. PLANILLA — BOLETAS, AFP Y COMISIONES (§4 comisiones, §7.4, §7.5)
--    TABLAS SENSIBLES: sin acceso anon. Solo endpoints con rol Administrador.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_payslips (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo              TEXT NOT NULL UNIQUE,        -- búsqueda por código (§7.5)
  colaborador_email   TEXT NOT NULL,
  colaborador_nombre  TEXT NOT NULL,               -- búsqueda por nombre (§7.5)
  periodo             TEXT NOT NULL,               -- 'YYYY-MM'
  dias_trabajados     INT NOT NULL DEFAULT 30,
  sueldo_bruto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  asignacion_familiar NUMERIC(12,2) NOT NULL DEFAULT 0,
  otros_ingresos      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ingresos      NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_afp       NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_renta     NUMERIC(12,2) NOT NULL DEFAULT 0,
  otros_descuentos    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_descuentos    NUMERIC(12,2) NOT NULL DEFAULT 0,
  neto                NUMERIC(12,2) NOT NULL DEFAULT 0,
  aporte_essalud      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- aporte del empleador
  detalle             JSONB NOT NULL DEFAULT '{}'::jsonb, -- desglose para la plantilla
  pdf_url             TEXT,
  enviado_at          TIMESTAMPTZ,
  enviado_a           TEXT,
  generado_por        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (colaborador_email, periodo)
);

CREATE TABLE IF NOT EXISTS public.piola_afp_reports (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periodo        TEXT NOT NULL UNIQUE,             -- 'YYYY-MM'
  total_afecto   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_aportes  NUMERIC(12,2) NOT NULL DEFAULT 0,
  detalle        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- una fila por colaborador
  pdf_url        TEXT,
  generado_por   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El closer cobra % sobre la producción que cierra; se paga el 15 del mes siguiente.
CREATE TABLE IF NOT EXISTS public.piola_commissions (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_email  TEXT NOT NULL,
  periodo            TEXT NOT NULL,                -- 'YYYY-MM' del cierre
  base_produccion    NUMERIC(12,2) NOT NULL DEFAULT 0,
  pct                NUMERIC(6,3) NOT NULL DEFAULT 0,
  monto              NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_pago         DATE,                         -- día 15 del mes siguiente
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aprobada','pagada','anulada')),
  detalle            JSONB DEFAULT '[]'::jsonb,    -- leads/facturas que la componen
  notas              TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (colaborador_email, periodo)
);


-- ══════════════════════════════════════════════════════════════════════════
-- 7. ALERTAS Y REPORTES PROGRAMADOS (§4 alertas, §9)
-- ══════════════════════════════════════════════════════════════════════════

-- Días de anticipación PARAMETRIZABLE (hoy 7, pero no hardcodeado)
CREATE TABLE IF NOT EXISTS public.piola_alert_settings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo          TEXT NOT NULL UNIQUE
                CHECK (tipo IN ('factura_por_vencer','factura_por_emitir','contrato_por_renovar',
                                'lead_sin_seguimiento','entregable_por_vencer','comision_por_pagar')),
  descripcion   TEXT,
  dias_antes    INT NOT NULL DEFAULT 7,
  canal         TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','correo','ambos')),
  destinatarios TEXT[] NOT NULL DEFAULT '{}',      -- teléfonos y/o correos
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.piola_alerts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo           TEXT NOT NULL,
  related_table  TEXT,
  related_id     BIGINT,
  titulo         TEXT NOT NULL,
  mensaje        TEXT NOT NULL,
  fecha_objetivo DATE,                             -- fecha del evento avisado
  dias_antes     INT,
  canal          TEXT,
  destinatarios  TEXT[],
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','enviada','error','descartada')),
  enviado_at     TIMESTAMPTZ,
  respuesta      JSONB,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, related_table, related_id, fecha_objetivo)
);

CREATE TABLE IF NOT EXISTS public.piola_scheduled_reports (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo           TEXT NOT NULL CHECK (tipo IN ('produccion_por_marca','ventas_mensual','financiero')),
  nombre         TEXT NOT NULL,
  frecuencia     TEXT NOT NULL DEFAULT 'mensual'
                 CHECK (frecuencia IN ('semanal','quincenal','mensual')),
  dia_ejecucion  INT,                              -- día del mes (mensual) o de la semana
  canal          TEXT NOT NULL DEFAULT 'correo' CHECK (canal IN ('whatsapp','correo','ambos')),
  destinatarios  TEXT[] NOT NULL DEFAULT '{}',
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at    TIMESTAMPTZ,
  next_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.piola_report_runs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id      BIGINT REFERENCES public.piola_scheduled_reports(id) ON DELETE SET NULL,
  tipo           TEXT NOT NULL,
  periodo        TEXT,
  origen         TEXT NOT NULL DEFAULT 'cron' CHECK (origen IN ('cron','manual')),
  triggered_by   TEXT,
  status         TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','empty')),
  payload        JSONB,
  respuesta      JSONB,
  http_status    INT,
  error_message  TEXT,
  duracion_ms    INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════
-- 8. SEEDS — catálogos base (todos editables después desde la UI)
-- ══════════════════════════════════════════════════════════════════════════

-- Roles (§8): general/administrador + un rol por módulo + colaborador
INSERT INTO public.piola_roles (nombre, descripcion, es_admin, editable)
SELECT v.nombre, v.descripcion, v.es_admin, v.editable
FROM (VALUES
  ('Administrador',            'Acceso total a todos los módulos',            TRUE,  FALSE),
  ('Contabilidad',             'Contabilidad, flujo de caja y facturación',   FALSE, TRUE),
  ('RR. HH.',                  'Tareo, vacaciones, boletas y AFP',            FALSE, TRUE),
  ('Comercial / CRM',          'CRM de leads y pipeline comercial',           FALSE, TRUE),
  ('Operaciones / Producción', 'Producción y contenidos por marca',           FALSE, TRUE),
  ('Colaborador',              'Solo su tareo, sus vacaciones y sus boletas', FALSE, FALSE)
) AS v(nombre, descripcion, es_admin, editable)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_roles r WHERE r.nombre = v.nombre);

-- Permisos por rol. 'mi_espacio' y 'home' los ve todo el mundo.
INSERT INTO public.piola_role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, p.module, p.v, p.c, p.e, p.d
FROM public.piola_roles r
JOIN (VALUES
  ('Administrador','home',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','mi_espacio',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','crm',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','contabilidad',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','facturacion',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','produccion',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','rrhh',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','reportes',TRUE,TRUE,TRUE,TRUE),
  ('Administrador','configuracion',TRUE,TRUE,TRUE,TRUE),

  ('Contabilidad','home',TRUE,FALSE,FALSE,FALSE),
  ('Contabilidad','mi_espacio',TRUE,TRUE,TRUE,FALSE),
  ('Contabilidad','contabilidad',TRUE,TRUE,TRUE,TRUE),
  ('Contabilidad','facturacion',TRUE,TRUE,TRUE,TRUE),
  ('Contabilidad','reportes',TRUE,FALSE,FALSE,FALSE),

  ('RR. HH.','home',TRUE,FALSE,FALSE,FALSE),
  ('RR. HH.','mi_espacio',TRUE,TRUE,TRUE,FALSE),
  ('RR. HH.','rrhh',TRUE,TRUE,TRUE,TRUE),
  ('RR. HH.','reportes',TRUE,FALSE,FALSE,FALSE),

  ('Comercial / CRM','home',TRUE,FALSE,FALSE,FALSE),
  ('Comercial / CRM','mi_espacio',TRUE,TRUE,TRUE,FALSE),
  ('Comercial / CRM','crm',TRUE,TRUE,TRUE,TRUE),

  ('Operaciones / Producción','home',TRUE,FALSE,FALSE,FALSE),
  ('Operaciones / Producción','mi_espacio',TRUE,TRUE,TRUE,FALSE),
  ('Operaciones / Producción','produccion',TRUE,TRUE,TRUE,TRUE),

  ('Colaborador','home',TRUE,FALSE,FALSE,FALSE),
  ('Colaborador','mi_espacio',TRUE,TRUE,TRUE,FALSE)
) AS p(rol, module, v, c, e, d) ON p.rol = r.nombre
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_role_permissions rp WHERE rp.role_id = r.id AND rp.module = p.module
);

-- Pipeline de ventas (§3) — editable desde Configuración
INSERT INTO public.piola_lead_stages (nombre, color, orden, es_ganado, es_perdido)
SELECT v.nombre, v.color, v.orden, v.g, v.p
FROM (VALUES
  ('Frío',              '#5b8def', 1, FALSE, FALSE),
  ('Tibio',             '#f2a63b', 2, FALSE, FALSE),
  ('Caliente',          '#e2564a', 3, FALSE, FALSE),
  ('Propuesta enviada', '#8b5cf6', 4, FALSE, FALSE),
  ('Cerrado ganado',    '#2e9e5b', 5, TRUE,  FALSE),
  ('Cerrado perdido',   '#8e8e8e', 6, FALSE, TRUE)
) AS v(nombre, color, orden, g, p)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_lead_stages s WHERE s.nombre = v.nombre);

-- Método de pago: catálogo abierto, un solo valor activo (§4)
INSERT INTO public.piola_payment_methods (nombre, activo, orden)
SELECT v.nombre, v.activo, v.orden
FROM (VALUES
  ('Transferencia bancaria', TRUE,  1),
  ('Efectivo',               FALSE, 2),
  ('Yape / Plin',            FALSE, 3),
  ('Tarjeta',                FALSE, 4)
) AS v(nombre, activo, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_payment_methods m WHERE m.nombre = v.nombre);

-- Categorías de gasto: SOLO el andamiaje inicial.
-- Piola entregará la lista detallada; se carga desde la UI sin tocar código (§4, §12).
INSERT INTO public.piola_expense_categories (nombre, parent_id, tipo, orden)
SELECT v.nombre, NULL, v.tipo, v.orden
FROM (VALUES
  ('Impuestos',        'egreso',  1),
  ('Movilidad',        'egreso',  2),
  ('Planilla',         'egreso',  3),
  ('Servicios',        'egreso',  4),
  ('Producción',       'egreso',  5),
  ('Marketing',        'egreso',  6),
  ('Administrativos',  'egreso',  7),
  ('Ventas',           'ingreso', 8),
  ('Otros ingresos',   'ingreso', 9)
) AS v(nombre, tipo, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_expense_categories c WHERE c.nombre = v.nombre AND c.parent_id IS NULL
);

-- Subcategorías de ejemplo bajo Impuestos y Movilidad (el resto lo carga Piola)
INSERT INTO public.piola_expense_categories (nombre, parent_id, tipo, orden)
SELECT v.nombre, p.id, 'egreso', v.orden
FROM (VALUES
  ('Impuesto a la renta', 'Impuestos', 1),
  ('IGV',                 'Impuestos', 2),
  ('Pasajes',             'Movilidad', 1),
  ('Combustible',         'Movilidad', 2)
) AS v(nombre, padre, orden)
JOIN public.piola_expense_categories p ON p.nombre = v.padre AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_expense_categories c WHERE c.nombre = v.nombre AND c.parent_id = p.id
);

-- Servicios (§6) — Piola enviará la lista completa y específica
INSERT INTO public.piola_services (nombre, categoria, orden)
SELECT v.nombre, v.categoria, v.orden
FROM (VALUES
  ('Video',                  'Audiovisual', 1),
  ('Piezas gráficas',        'Diseño',      2),
  ('Manual de marca',        'Branding',    3),
  ('Logo',                   'Branding',    4),
  ('Brochure',               'Diseño',      5),
  ('Sesión de fotos',        'Audiovisual', 6),
  ('Cobertura de evento',    'Audiovisual', 7)
) AS v(nombre, categoria, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_services s WHERE s.nombre = v.nombre);

-- Alertas: 7 días de anticipación por WhatsApp (§4), configurable desde la UI
INSERT INTO public.piola_alert_settings (tipo, descripcion, dias_antes, canal)
SELECT v.tipo, v.descripcion, v.dias, v.canal
FROM (VALUES
  ('factura_por_vencer',    'Facturas próximas a vencer',                 7, 'whatsapp'),
  ('factura_por_emitir',    'Facturas próximas a emitirse',               7, 'whatsapp'),
  ('contrato_por_renovar',  'Contratos de colaboradores por renovarse',   7, 'whatsapp'),
  ('lead_sin_seguimiento',  'Leads sin interacción reciente',             3, 'whatsapp'),
  ('entregable_por_vencer', 'Entregables con fecha de compromiso cerca',  3, 'whatsapp'),
  ('comision_por_pagar',    'Comisiones a pagar el 15 del mes siguiente', 7, 'whatsapp')
) AS v(tipo, descripcion, dias, canal)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_alert_settings a WHERE a.tipo = v.tipo);

-- Reportes programados (§9)
INSERT INTO public.piola_scheduled_reports (tipo, nombre, frecuencia, dia_ejecucion, canal)
SELECT v.tipo, v.nombre, v.frecuencia, v.dia, v.canal
FROM (VALUES
  ('produccion_por_marca', 'Producción por marca',   'quincenal', 15, 'correo'),
  ('ventas_mensual',       'Ventas del mes',         'mensual',    1, 'correo'),
  ('financiero',           'Financiero de cierre',   'mensual',    1, 'correo')
) AS v(tipo, nombre, frecuencia, dia, canal)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_scheduled_reports r WHERE r.tipo = v.tipo);


-- ══════════════════════════════════════════════════════════════════════════
-- 9. RLS
--    Operativas  → anon CRUD (igual que el resto del dashboard base)
--    Sensibles   → SOLO service_role (boletas, AFP, comisiones)
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  operativas TEXT[] := ARRAY[
    'piola_roles','piola_role_permissions','piola_colaboradores',
    'piola_lead_stages','piola_leads','piola_lead_activities','piola_clientes','piola_meta_metrics',
    'piola_expense_categories','piola_payment_methods','piola_transactions',
    'piola_invoices','piola_services','piola_deliverables',
    'piola_attendance','piola_attendance_breaks','piola_attendance_audit',
    'piola_vacation_requests','piola_vacation_adjustments',
    'piola_alert_settings','piola_alerts','piola_scheduled_reports','piola_report_runs'
  ];
  sensibles TEXT[] := ARRAY['piola_payslips','piola_afp_reports','piola_commissions'];
BEGIN
  FOREACH t IN ARRAY operativas || sensibles LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;

  FOREACH t IN ARRAY operativas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;

  -- Las sensibles NO reciben policy para anon: el navegador no las toca nunca.
  FOREACH t IN ARRAY sensibles LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON public.%I', t, t);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 10. Bucket de documentos (boletas, PDFs de factura, adjuntos)
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
SELECT 'piola-docs', 'piola-docs', TRUE
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'piola-docs');

DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_piola_docs" ON storage.objects;
  CREATE POLICY "public_read_piola_docs" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'piola-docs');
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
--
--   PARTE 2 de 4 — REUNIÓN DEL 19/08
--
--   Se apoya en la parte 1.
--   
--   1. Contratos y adendas         → piola_contratos, piola_adendas
--   2. Subida de PDF               → policies de escritura en el bucket piola-docs
--   3. Leads: username + canales   → piola_leads.username + CHECK de contacto
--   4. Egresos con precio/cantidad → piola_transactions.precio, .cantidad
--   5. Permiso faltante            → "Comercial / CRM" gana el módulo facturacion
--   
--   La revisión de objetos muertos que se hizo junto con esta parte no
--   encontró ninguna tabla sin uso: las 43 están referenciadas. Por eso no
--   hay sección destructiva.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.piola_contratos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id      TEXT NOT NULL DEFAULT 'piola',
  cliente_id      BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  nombre_cliente  TEXT NOT NULL,
  ruc             TEXT,
  fecha_inicio    DATE,
  fecha_cierre    DATE,
  importe_pagado  NUMERIC(12,2) NOT NULL DEFAULT 0,
  modalidad_pago  TEXT,
  contrato_pdf    TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_contratos_cliente ON public.piola_contratos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_piola_contratos_company ON public.piola_contratos (company_id);
CREATE INDEX IF NOT EXISTS idx_piola_contratos_cierre  ON public.piola_contratos (fecha_cierre);

-- Varias adendas por contrato (1:N). Si se borra el contrato, se van con él.
CREATE TABLE IF NOT EXISTS public.piola_adendas (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contrato_id  BIGINT NOT NULL REFERENCES public.piola_contratos(id) ON DELETE CASCADE,
  fecha        DATE,
  descripcion  TEXT,
  importe      NUMERIC(12,2) NOT NULL DEFAULT 0,
  archivo_pdf  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_adendas_contrato ON public.piola_adendas (contrato_id, fecha DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 6. LEADS — username y regla de contacto
--
-- El enum de `fuente` NO se toca: 'instagram_dm' y 'tiktok_ads' ya existen y
-- solo faltaba exponerlos en la UI (composables/usePiola.ts).
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_leads ADD COLUMN IF NOT EXISTS username TEXT;

COMMENT ON COLUMN public.piola_leads.username IS
  'Usuario de la red social (Instagram/TikTok/Facebook). En TikTok no hay teléfono: '
  'el lead se identifica solo por aquí.';

CREATE INDEX IF NOT EXISTS idx_piola_leads_username ON public.piola_leads (lower(username));

-- Al menos uno entre teléfono y username.
--
-- Se agrega como NOT VALID a propósito: la tabla ya está en producción y puede
-- tener leads viejos sin teléfono (cargados antes de que existiera `username`).
-- NOT VALID no revisa las filas existentes, pero SÍ aplica a todo INSERT y a
-- todo UPDATE de aquí en adelante, que es lo que pide el requerimiento.
-- Para exigirlo también sobre el histórico, primero limpiar esas filas y luego:
--     ALTER TABLE public.piola_leads VALIDATE CONSTRAINT piola_leads_contacto_chk;
DO $$ BEGIN
  ALTER TABLE public.piola_leads
    ADD CONSTRAINT piola_leads_contacto_chk
    CHECK (
      NULLIF(BTRIM(COALESCE(telefono, '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(username, '')), '') IS NOT NULL
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 7. EGRESOS CON PRECIO Y CANTIDAD  →  se define en la PARTE 3 de este archivo
--
-- La lista del 19/08 pedía solo `precio` y `cantidad` en piola_transactions.
-- La especificación financiera posterior pide sobre esa MISMA tabla bastante
-- más: subtotal, impuestos, total, estado, fecha de vencimiento, comprobante
-- adjunto, responsable y observaciones.
--
-- Hacerlo en dos pasos dejaría la tabla a medio migrar, así que el modelo
-- completo —precio y cantidad incluidos— va junto en la migración 03.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 8. PERMISO FALTANTE — 'Comercial / CRM' debe ver Facturación
--
-- El seed original le dio solo el módulo `crm`; el requerimiento pide
-- Leads + Facturación. Se respeta el UNIQUE (role_id, module) del esquema.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO public.piola_role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, 'facturacion', TRUE, TRUE, TRUE, FALSE
FROM public.piola_roles r
WHERE r.nombre = 'Comercial / CRM'
ON CONFLICT (role_id, module) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
-- 9. RLS — mismo patrón que el resto de las tablas de Piola
--    (parte 1 de este archivo): anon CRUD + service_role total.
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  nuevas TEXT[] := ARRAY['piola_contratos','piola_adendas'];
BEGIN
  FOREACH t IN ARRAY nuevas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "service_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t);

    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2. STORAGE — permitir SUBIR al bucket piola-docs desde el navegador
--
-- El bucket ya se crea en la parte 1 de este archivo, pero solo con policy
-- de SELECT: hasta ahora únicamente el servidor escribía en él (boletas y
-- facturas HTML generadas con la service key, que ignora RLS).
--
-- La subida de contratos y adendas ocurre en el navegador, así que hace falta
-- INSERT/UPDATE/DELETE. Se replica el criterio del resto del dashboard: el
-- navegador puede escribir, y quién puede hacerlo se controla en la UI.
-- ══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_insert_piola_docs" ON storage.objects;
  CREATE POLICY "anon_insert_piola_docs" ON storage.objects
    FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'piola-docs');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_update_piola_docs" ON storage.objects;
  CREATE POLICY "anon_update_piola_docs" ON storage.objects
    FOR UPDATE TO anon, authenticated USING (bucket_id = 'piola-docs') WITH CHECK (bucket_id = 'piola-docs');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_delete_piola_docs" ON storage.objects;
  CREATE POLICY "anon_delete_piola_docs" ON storage.objects
    FOR DELETE TO anon, authenticated USING (bucket_id = 'piola-docs');
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════════════════



-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
--
--   PARTE 3 de 4 — FINANCIERO + EXPEDIENTE DE RR. HH.
--
--   Se apoya en las partes 1 y 2.
--   
--   A. Configuración financiera → monedas, impuestos, tipos de comprobante,
--                                 series, condiciones de pago, áreas,
--                                 centros de costo, proveedores
--   B. Ingresos y gastos        → piola_transactions gana subtotal, descuentos,
--                                 impuestos, estado, vencimiento, adjunto
--   C. Cuentas por cobrar/pagar → piola_pagos (parciales) + vistas de saldo
--   D. Caja                     → piola_caja_sesiones, piola_caja_movimientos
--   E. Presupuestos             → piola_presupuestos (mes/año/área/categoría)
--   F. Auditoría                → piola_auditoria + trigger genérico
--   G. Expediente del trabajador→ piola_colaboradores se amplía
--   
--   SOBRE `monto`: sigue siendo la fuente de verdad y equivale al TOTAL. Las
--   columnas nuevas (subtotal, descuento, impuestos) son el desglose; los
--   movimientos ya cargados quedan válidos con el desglose en NULL.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.piola_monedas (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo        TEXT NOT NULL UNIQUE,              -- PEN, USD, EUR
  nombre        TEXT NOT NULL,
  simbolo       TEXT NOT NULL DEFAULT 'S/',
  es_principal  BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_cambio   NUMERIC(12,4) NOT NULL DEFAULT 1,  -- respecto de la principal
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  orden         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_moneda_principal
  ON public.piola_monedas (es_principal) WHERE es_principal;

-- Impuestos: IGV, renta y detracción. Las tasas NO van en código.
CREATE TABLE IF NOT EXISTS public.piola_impuestos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,               -- igv, renta, detraccion
  nombre       TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'igv' CHECK (tipo IN ('igv','renta','detraccion','otro')),
  tasa         NUMERIC(6,3) NOT NULL DEFAULT 0,    -- porcentaje
  -- 'agrega' suma al subtotal (IGV); 'retiene' se descuenta del total (renta, detracción)
  comportamiento TEXT NOT NULL DEFAULT 'agrega'
                 CHECK (comportamiento IN ('agrega','retiene')),
  aplica_a     TEXT NOT NULL DEFAULT 'ambos' CHECK (aplica_a IN ('ingreso','egreso','ambos')),
  codigo_sunat TEXT,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  orden        INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.piola_tipos_comprobante (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo         TEXT NOT NULL UNIQUE,             -- factura, boleta, nc, nd, rh, recibo
  nombre         TEXT NOT NULL,
  codigo_sunat   INT,                              -- 1 factura, 2 boleta, 3 NC, 4 ND
  aplica_a       TEXT NOT NULL DEFAULT 'ingreso' CHECK (aplica_a IN ('ingreso','egreso','ambos')),
  afecta_stock   BOOLEAN NOT NULL DEFAULT FALSE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  orden          INT NOT NULL DEFAULT 0
);

-- Series y numeraciones. El correlativo vive acá, no se deduce con MAX().
CREATE TABLE IF NOT EXISTS public.piola_series (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_comprobante_id BIGINT NOT NULL REFERENCES public.piola_tipos_comprobante(id) ON DELETE CASCADE,
  serie               TEXT NOT NULL,
  correlativo_actual  BIGINT NOT NULL DEFAULT 0,
  es_default          BOOLEAN NOT NULL DEFAULT FALSE,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tipo_comprobante_id, serie)
);

-- Condiciones de pago: contado, 15/30/60 días…
CREATE TABLE IF NOT EXISTS public.piola_condiciones_pago (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  dias        INT NOT NULL DEFAULT 0,              -- 0 = contado
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0
);

-- Áreas y centros de costo: los pide el presupuesto y los filtros de reportes.
CREATE TABLE IF NOT EXISTS public.piola_areas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.piola_centros_costo (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      TEXT UNIQUE,
  nombre      TEXT NOT NULL,
  area_id     BIGINT REFERENCES public.piola_areas(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0
);

-- Proveedores: hasta ahora el gasto solo guardaba un texto libre.
CREATE TABLE IF NOT EXISTS public.piola_proveedores (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              TEXT NOT NULL,
  ruc                 TEXT,
  razon_social        TEXT,
  contacto            TEXT,
  email               TEXT,
  telefono            TEXT,
  direccion           TEXT,
  condicion_pago_id   BIGINT REFERENCES public.piola_condiciones_pago(id) ON DELETE SET NULL,
  notas               TEXT,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_proveedores_nombre ON public.piola_proveedores (lower(nombre));


-- ══════════════════════════════════════════════════════════════════════════
-- B. INGRESOS Y GASTOS — piola_transactions con el modelo completo
--
-- `monto` = TOTAL (no se toca: es lo que suman todos los gráficos y reportes
-- que ya existen). Lo demás es el desglose y el ciclo de cobro/pago.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_transactions
  -- Desglose económico
  ADD COLUMN IF NOT EXISTS subtotal            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS descuento           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impuestos           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impuestos_detalle   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS precio              NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cantidad            NUMERIC(12,2),
  -- Ciclo de cobro / pago
  ADD COLUMN IF NOT EXISTS estado              TEXT NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS fecha_vencimiento   DATE,
  ADD COLUMN IF NOT EXISTS condicion_pago_id   BIGINT REFERENCES public.piola_condiciones_pago(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS monto_pagado        NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Relaciones
  ADD COLUMN IF NOT EXISTS proveedor_id        BIGINT REFERENCES public.piola_proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_id             BIGINT REFERENCES public.piola_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_costo_id     BIGINT REFERENCES public.piola_centros_costo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moneda_id           BIGINT REFERENCES public.piola_monedas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_comprobante_id BIGINT REFERENCES public.piola_tipos_comprobante(id) ON DELETE SET NULL,
  -- Documento
  ADD COLUMN IF NOT EXISTS documento_serie     TEXT,
  ADD COLUMN IF NOT EXISTS documento_numero    TEXT,
  ADD COLUMN IF NOT EXISTS documento_adjunto   TEXT,          -- path en piola-docs
  -- Responsables y anulación
  ADD COLUMN IF NOT EXISTS responsable_email   TEXT,
  ADD COLUMN IF NOT EXISTS updated_by          TEXT,
  ADD COLUMN IF NOT EXISTS anulado_por         TEXT,
  ADD COLUMN IF NOT EXISTS anulado_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_anulacion    TEXT;

COMMENT ON COLUMN public.piola_transactions.monto IS
  'TOTAL del movimiento. Fuente de verdad histórica: los reportes y gráficos '
  'suman esta columna. subtotal/descuento/impuestos son el desglose opcional.';
COMMENT ON COLUMN public.piola_transactions.monto_pagado IS
  'Suma de piola_pagos. Lo mantiene al día el trigger trg_piola_pagos_saldo.';

-- Estado del ciclo: pendiente → parcial → pagado, o vencido / anulado.
DO $$ BEGIN
  ALTER TABLE public.piola_transactions
    ADD CONSTRAINT piola_tx_estado_chk
    CHECK (estado IN ('pendiente','parcial','pagado','vencido','anulado')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Marca como pagado TODO movimiento pendiente que no tenga pagos registrados.
--
-- Al correr la migración eso equivale a "los movimientos anteriores a la 03",
-- porque antes no existía el ciclo de cobro: eran caja ya ocurrida y sin esto
-- aparecerían todos como deuda. No hay filtro por fecha porque no haría nada:
-- en ese momento no existe ninguna fila posterior.
UPDATE public.piola_transactions
   SET estado = 'pagado', monto_pagado = monto
 WHERE estado = 'pendiente'
   AND monto_pagado = 0
   AND proyectado = FALSE;

CREATE INDEX IF NOT EXISTS idx_piola_tx_estado    ON public.piola_transactions (estado);
CREATE INDEX IF NOT EXISTS idx_piola_tx_venc      ON public.piola_transactions (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_piola_tx_proveedor ON public.piola_transactions (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_piola_tx_area      ON public.piola_transactions (area_id);


-- ══════════════════════════════════════════════════════════════════════════
-- C. CUENTAS POR COBRAR Y POR PAGAR — pagos parciales
--
-- Una sola tabla para ambas: el tipo del movimiento (ingreso/egreso) ya dice
-- si es una cobranza o un pago. Así el historial, los adjuntos y los
-- descuentos autorizados se implementan una sola vez.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_pagos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id    BIGINT NOT NULL REFERENCES public.piola_transactions(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  monto             NUMERIC(12,2) NOT NULL,
  -- Descuento autorizado: reduce el saldo sin que entre plata
  descuento         NUMERIC(12,2) NOT NULL DEFAULT 0,
  motivo_descuento  TEXT,
  autorizado_por    TEXT,
  payment_method    TEXT,
  moneda_id         BIGINT REFERENCES public.piola_monedas(id) ON DELETE SET NULL,
  referencia        TEXT,                          -- n.º de operación
  constancia_url    TEXT,                          -- path en piola-docs
  observaciones     TEXT,
  registrado_por    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_pagos_tx ON public.piola_pagos (transaction_id, fecha DESC);

/*
 * Mantiene monto_pagado y estado al día con cada pago.
 *
 * El estado se recalcula siempre desde los pagos, nunca se escribe a mano:
 * así no puede quedar una factura "pagada" con saldo, ni al revés. Un
 * movimiento anulado no se toca — la anulación manda sobre el saldo.
 */
CREATE OR REPLACE FUNCTION public.piola_recalcular_saldo(p_tx_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total   NUMERIC(12,2);
  v_pagado  NUMERIC(12,2);
  v_venc    DATE;
  v_estado  TEXT;
BEGIN
  SELECT monto, fecha_vencimiento, estado INTO v_total, v_venc, v_estado
    FROM public.piola_transactions WHERE id = p_tx_id;
  IF NOT FOUND OR v_estado = 'anulado' THEN RETURN; END IF;

  SELECT COALESCE(SUM(monto + descuento), 0) INTO v_pagado
    FROM public.piola_pagos WHERE transaction_id = p_tx_id;

  UPDATE public.piola_transactions
     SET monto_pagado = v_pagado,
         estado = CASE
           WHEN v_pagado >= COALESCE(v_total, 0) - 0.005 THEN 'pagado'
           WHEN v_pagado > 0                             THEN 'parcial'
           WHEN v_venc IS NOT NULL AND v_venc < CURRENT_DATE THEN 'vencido'
           ELSE 'pendiente'
         END
   WHERE id = p_tx_id;
END $$;

CREATE OR REPLACE FUNCTION public.piola_pagos_saldo_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.piola_recalcular_saldo(OLD.transaction_id);
    RETURN OLD;
  END IF;
  PERFORM public.piola_recalcular_saldo(NEW.transaction_id);
  IF TG_OP = 'UPDATE' AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    PERFORM public.piola_recalcular_saldo(OLD.transaction_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_piola_pagos_saldo ON public.piola_pagos;
CREATE TRIGGER trg_piola_pagos_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.piola_pagos
  FOR EACH ROW EXECUTE FUNCTION public.piola_pagos_saldo_trigger();

/*
 * Vista de cuentas por cobrar y por pagar.
 *
 * `dias_atraso` se calcula al vuelo y no se guarda: guardarlo obligaría a un
 * cron diario para mantenerlo, y el dato se puede derivar siempre.
 */
CREATE OR REPLACE VIEW public.piola_cuentas AS
SELECT
  t.id,
  t.tipo,                                             -- ingreso = por cobrar, egreso = por pagar
  t.fecha AS fecha_emision,
  t.fecha_vencimiento,
  t.concepto,
  t.cliente_id,
  cl.nombre AS cliente_nombre,
  t.proveedor_id,
  pr.nombre AS proveedor_nombre,
  t.documento_serie,
  t.documento_numero,
  NULLIF(CONCAT_WS('-', t.documento_serie, t.documento_numero), '') AS documento,
  t.monto AS importe_total,
  t.monto_pagado AS importe_pagado,
  ROUND(GREATEST(COALESCE(t.monto, 0) - COALESCE(t.monto_pagado, 0), 0), 2) AS saldo_pendiente,
  CASE
    WHEN t.estado IN ('pagado','anulado') THEN 0
    WHEN t.fecha_vencimiento IS NULL      THEN 0
    ELSE GREATEST((CURRENT_DATE - t.fecha_vencimiento), 0)
  END AS dias_atraso,
  t.estado,
  t.responsable_email AS vendedor,
  t.area_id,
  t.centro_costo_id,
  t.proyectado
FROM public.piola_transactions t
LEFT JOIN public.piola_clientes    cl ON cl.id = t.cliente_id
LEFT JOIN public.piola_proveedores pr ON pr.id = t.proveedor_id
WHERE t.estado <> 'anulado';


-- ══════════════════════════════════════════════════════════════════════════
-- D. CAJA — apertura, movimientos y cierre
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_caja_sesiones (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre            TEXT,                            -- 'Caja principal', 'Caja chica'…
  fecha_apertura    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saldo_inicial     NUMERIC(12,2) NOT NULL DEFAULT 0,
  abierta_por       TEXT NOT NULL,
  fecha_cierre      TIMESTAMPTZ,
  saldo_final       NUMERIC(12,2),                   -- lo que el sistema calcula
  saldo_contado     NUMERIC(12,2),                   -- lo que la persona contó
  diferencia        NUMERIC(12,2),                   -- contado − calculado
  cerrada_por       TEXT,
  estado            TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  observaciones     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una caja abierta a la vez: si hubiera dos, ningún saldo sería confiable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_caja_una_abierta
  ON public.piola_caja_sesiones ((estado)) WHERE estado = 'abierta';

CREATE TABLE IF NOT EXISTS public.piola_caja_movimientos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_id       BIGINT NOT NULL REFERENCES public.piola_caja_sesiones(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso','transferencia','retiro')),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concepto        TEXT NOT NULL,
  monto           NUMERIC(12,2) NOT NULL,
  payment_method  TEXT,
  destino         TEXT,                              -- a dónde va la transferencia/retiro
  transaction_id  BIGINT REFERENCES public.piola_transactions(id) ON DELETE SET NULL,
  pago_id         BIGINT REFERENCES public.piola_pagos(id) ON DELETE SET NULL,
  comprobante_url TEXT,
  registrado_por  TEXT,
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_caja_mov ON public.piola_caja_movimientos (sesion_id, fecha DESC);

/*
 * Saldo de una sesión de caja.
 * Ingresos suman; egresos, transferencias y retiros restan.
 */
CREATE OR REPLACE FUNCTION public.piola_caja_saldo(p_sesion_id BIGINT)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT ROUND(
    COALESCE((SELECT saldo_inicial FROM public.piola_caja_sesiones WHERE id = p_sesion_id), 0)
    + COALESCE((
        SELECT SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE -monto END)
        FROM public.piola_caja_movimientos WHERE sesion_id = p_sesion_id
      ), 0)
  , 2);
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- E. PRESUPUESTOS — mensual / anual, por área y por categoría
--
-- Un presupuesto es una fila por (periodo × ámbito). `periodo` es 'YYYY-MM'
-- para el mensual y 'YYYY' para el anual; el CHECK acepta ambos formatos.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_presupuestos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        TEXT,
  alcance       TEXT NOT NULL DEFAULT 'mensual' CHECK (alcance IN ('mensual','anual')),
  periodo       TEXT NOT NULL CHECK (periodo ~ '^\d{4}(-\d{2})?$'),
  tipo          TEXT NOT NULL DEFAULT 'egreso' CHECK (tipo IN ('ingreso','egreso')),
  area_id       BIGINT REFERENCES public.piola_areas(id) ON DELETE CASCADE,
  category_id   BIGINT REFERENCES public.piola_expense_categories(id) ON DELETE CASCADE,
  monto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un presupuesto por combinación. COALESCE(-1) porque NULL nunca iguala a NULL
-- en un índice único, y un presupuesto "global" (sin área ni categoría) debe
-- poder existir una sola vez por periodo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_presupuesto_unico
  ON public.piola_presupuestos (periodo, tipo, COALESCE(area_id, -1), COALESCE(category_id, -1));

CREATE INDEX IF NOT EXISTS idx_piola_presupuesto_periodo ON public.piola_presupuestos (periodo);


-- ══════════════════════════════════════════════════════════════════════════
-- F. AUDITORÍA — quién creó, quién modificó, qué modificó, cuándo
--
-- Trigger genérico: guarda old/new y la lista de campos que cambiaron. Se
-- engancha a las tablas que importan; agregar otra es una línea.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_auditoria (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla          TEXT NOT NULL,
  registro_id    BIGINT,
  operacion      TEXT NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
  campos         TEXT[] NOT NULL DEFAULT '{}',       -- qué cambió
  datos_antes    JSONB,
  datos_despues  JSONB,
  estado_anterior TEXT,
  estado_nuevo    TEXT,
  usuario        TEXT,                               -- de created_by/updated_by de la fila
  motivo         TEXT,                               -- motivo_anulacion si lo hay
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_audit_tabla ON public.piola_auditoria (tabla, registro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_piola_audit_fecha ON public.piola_auditoria (created_at DESC);

CREATE OR REPLACE FUNCTION public.piola_auditoria_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_antes    JSONB;
  v_despues  JSONB;
  v_campos   TEXT[] := '{}';
  v_id       BIGINT;
  v_usuario  TEXT;
  v_motivo   TEXT;
  v_est_ant  TEXT;
  v_est_new  TEXT;
  k          TEXT;
  -- Columnas cuyo VALOR no debe quedar copiado en la auditoría (ver abajo)
  sensibles  TEXT[] := ARRAY[
    'sueldo_bruto','remuneracion','bonificaciones','comision_pct','afp_cuspp'
  ];
  campo      TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_antes := to_jsonb(OLD);
    v_despues := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_antes := NULL;
    v_despues := to_jsonb(NEW);
  ELSE
    v_antes := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    -- Solo los campos que realmente cambiaron
    FOR k IN SELECT jsonb_object_keys(v_despues) LOOP
      IF v_antes -> k IS DISTINCT FROM v_despues -> k THEN
        v_campos := array_append(v_campos, k);
      END IF;
    END LOOP;
    -- Un UPDATE que no cambia nada no merece una fila de auditoría
    IF array_length(v_campos, 1) IS NULL THEN RETURN NEW; END IF;
  END IF;

  v_id := COALESCE((v_despues ->> 'id')::BIGINT, (v_antes ->> 'id')::BIGINT);
  v_est_ant := v_antes ->> 'estado';
  v_est_new := v_despues ->> 'estado';
  v_motivo  := v_despues ->> 'motivo_anulacion';
  v_usuario := COALESCE(
    v_despues ->> 'anulado_por', v_despues ->> 'updated_by', v_despues ->> 'created_by',
    v_antes  ->> 'updated_by',   v_antes  ->> 'created_by'
  );

  /*
   * Censura de remuneraciones.
   *
   * `piola_auditoria` es legible por anon (el navegador), y sin esto el
   * trigger dejaría ahí una copia del sueldo de cada colaborador cada vez que
   * alguien edita su ficha — puenteando el cuidado que sí tienen
   * piola_payslips, piola_afp_reports y piola_commissions, que no reciben
   * policy para anon justamente para que los sueldos no salgan por el cliente.
   *
   * Qué SIGUE registrado: que se tocó el sueldo, quién y cuándo — el nombre
   * del campo se conserva en `campos`. Lo que se va es el monto. El valor real
   * vive en piola_colaboradores; no hace falta una segunda copia en una tabla
   * que el navegador puede leer entera.
   */
  IF TG_TABLE_NAME = 'piola_colaboradores' THEN
    FOREACH campo IN ARRAY sensibles LOOP
      IF v_antes   ? campo THEN v_antes   := jsonb_set(v_antes,   ARRAY[campo], '"■■■"'); END IF;
      IF v_despues ? campo THEN v_despues := jsonb_set(v_despues, ARRAY[campo], '"■■■"'); END IF;
    END LOOP;
  END IF;

  INSERT INTO public.piola_auditoria (
    tabla, registro_id, operacion, campos, datos_antes, datos_despues,
    estado_anterior, estado_nuevo, usuario, motivo
  ) VALUES (
    TG_TABLE_NAME, v_id, TG_OP, v_campos, v_antes, v_despues,
    v_est_ant, v_est_new, v_usuario, v_motivo
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Tablas auditadas. Agregar otra = agregarla a este array.
DO $$
DECLARE
  t TEXT;
  auditadas TEXT[] := ARRAY[
    'piola_transactions','piola_pagos','piola_invoices','piola_contratos','piola_adendas',
    'piola_caja_sesiones','piola_caja_movimientos','piola_presupuestos','piola_colaboradores'
  ];
BEGIN
  FOREACH t IN ARRAY auditadas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_piola_audit ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_piola_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.piola_auditoria_trigger()', t);
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- G. EXPEDIENTE DEL TRABAJADOR
--
-- `piola_colaboradores` ya tenía la parte de planilla (sueldo, AFP, contrato).
-- Acá se completa con datos personales, laborales y contractuales.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_colaboradores
  -- Datos personales
  ADD COLUMN IF NOT EXISTS nombres              TEXT,
  ADD COLUMN IF NOT EXISTS apellidos            TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento     DATE,
  ADD COLUMN IF NOT EXISTS nacionalidad         TEXT DEFAULT 'Peruana',
  ADD COLUMN IF NOT EXISTS direccion            TEXT,
  ADD COLUMN IF NOT EXISTS emergencia_nombre    TEXT,
  ADD COLUMN IF NOT EXISTS emergencia_telefono  TEXT,
  ADD COLUMN IF NOT EXISTS emergencia_parentesco TEXT,
  -- Datos laborales
  ADD COLUMN IF NOT EXISTS codigo_trabajador    TEXT,
  ADD COLUMN IF NOT EXISTS area_id              BIGINT REFERENCES public.piola_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sede                 TEXT,
  ADD COLUMN IF NOT EXISTS jefe_email           TEXT,
  ADD COLUMN IF NOT EXISTS modalidad_trabajo    TEXT
      CHECK (modalidad_trabajo IN ('presencial','remoto','hibrido')),
  ADD COLUMN IF NOT EXISTS jornada              TEXT
      CHECK (jornada IN ('completa','parcial','por_horas')),
  ADD COLUMN IF NOT EXISTS horario              TEXT,
  ADD COLUMN IF NOT EXISTS estado_laboral       TEXT NOT NULL DEFAULT 'activo'
      CHECK (estado_laboral IN ('activo','suspendido','cesado')),
  ADD COLUMN IF NOT EXISTS fecha_cese           DATE,
  ADD COLUMN IF NOT EXISTS motivo_cese          TEXT,
  -- Información contractual
  ADD COLUMN IF NOT EXISTS bonificaciones       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beneficios           TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_colab_codigo
  ON public.piola_colaboradores (codigo_trabajador) WHERE codigo_trabajador IS NOT NULL;

-- Renovaciones de contrato: un colaborador acumula varias.
CREATE TABLE IF NOT EXISTS public.piola_contratos_laborales (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_id    BIGINT NOT NULL REFERENCES public.piola_colaboradores(id) ON DELETE CASCADE,
  tipo_contrato     TEXT NOT NULL DEFAULT 'planilla'
                    CHECK (tipo_contrato IN ('planilla','honorarios','practicas','temporal')),
  fecha_inicio      DATE NOT NULL,
  fecha_termino     DATE,
  remuneracion      NUMERIC(12,2),
  bonificaciones    NUMERIC(12,2) NOT NULL DEFAULT 0,
  beneficios        TEXT,
  es_renovacion     BOOLEAN NOT NULL DEFAULT FALSE,
  contrato_pdf      TEXT,                            -- path en piola-docs
  observaciones     TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_contratos_lab
  ON public.piola_contratos_laborales (colaborador_id, fecha_inicio DESC);

-- Documentos del expediente (DNI, CV, certificados, adendas laborales…)
CREATE TABLE IF NOT EXISTS public.piola_colaborador_documentos (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  colaborador_id  BIGINT NOT NULL REFERENCES public.piola_colaboradores(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'otro',
  nombre          TEXT NOT NULL,
  archivo_url     TEXT,                              -- path en piola-docs
  fecha           DATE,
  subido_por      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_colab_docs
  ON public.piola_colaborador_documentos (colaborador_id, created_at DESC);

/*
 * `nombres` y `apellidos` son nuevos, pero `nombre` (completo) ya existía y
 * está en uso en media docena de sitios. Se rellenan los nuevos a partir del
 * viejo una sola vez, partiendo por el primer espacio, y `nombre` se queda
 * como está: sigue siendo el que muestran las pantallas actuales.
 */
UPDATE public.piola_colaboradores
   SET nombres   = COALESCE(nombres, SPLIT_PART(nombre, ' ', 1)),
       apellidos = COALESCE(
         apellidos,
         NULLIF(BTRIM(SUBSTRING(nombre FROM POSITION(' ' IN nombre) + 1)), '')
       )
 WHERE nombres IS NULL OR apellidos IS NULL;


-- ══════════════════════════════════════════════════════════════════════════
-- H. SEEDS DE CATÁLOGO — solo lo que el sistema necesita para arrancar
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO public.piola_monedas (codigo, nombre, simbolo, es_principal, tipo_cambio, orden)
SELECT v.codigo, v.nombre, v.simbolo, v.principal, v.tc, v.orden
FROM (VALUES
  ('PEN', 'Sol peruano',   'S/',  TRUE,  1.0000, 1),
  ('USD', 'Dólar',         'US$', FALSE, 3.7500, 2),
  ('EUR', 'Euro',          '€',   FALSE, 4.0500, 3)
) AS v(codigo, nombre, simbolo, principal, tc, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_monedas m WHERE m.codigo = v.codigo);

INSERT INTO public.piola_impuestos (codigo, nombre, tipo, tasa, comportamiento, aplica_a, codigo_sunat, orden)
SELECT v.codigo, v.nombre, v.tipo, v.tasa, v.comp, v.aplica, v.sunat, v.orden
FROM (VALUES
  ('igv',        'IGV',                   'igv',        18.0, 'agrega',  'ambos',   '1000', 1),
  ('renta',      'Retención de renta 4ta','renta',       8.0, 'retiene', 'egreso',  '3000', 2),
  ('detraccion', 'Detracción',            'detraccion', 12.0, 'retiene', 'ingreso', '022',  3)
) AS v(codigo, nombre, tipo, tasa, comp, aplica, sunat, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_impuestos i WHERE i.codigo = v.codigo);

INSERT INTO public.piola_tipos_comprobante (codigo, nombre, codigo_sunat, aplica_a, orden)
SELECT v.codigo, v.nombre, v.sunat, v.aplica, v.orden
FROM (VALUES
  ('factura', 'Factura',              1, 'ambos',   1),
  ('boleta',  'Boleta de venta',      2, 'ingreso', 2),
  ('nc',      'Nota de crédito',      3, 'ambos',   3),
  ('nd',      'Nota de débito',       4, 'ambos',   4),
  ('rh',      'Recibo por honorarios', NULL, 'egreso', 5),
  ('otro',    'Otro documento',        NULL, 'ambos',  6)
) AS v(codigo, nombre, sunat, aplica, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_tipos_comprobante t WHERE t.codigo = v.codigo);

-- Series por defecto para factura y boleta
INSERT INTO public.piola_series (tipo_comprobante_id, serie, correlativo_actual, es_default)
SELECT t.id, v.serie, 0, TRUE
FROM (VALUES ('factura', 'F001'), ('boleta', 'B001')) AS v(codigo, serie)
JOIN public.piola_tipos_comprobante t ON t.codigo = v.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_series s WHERE s.tipo_comprobante_id = t.id AND s.serie = v.serie
);

INSERT INTO public.piola_condiciones_pago (nombre, dias, descripcion, orden)
SELECT v.nombre, v.dias, v.desc, v.orden
FROM (VALUES
  ('Contado',   0, 'Pago inmediato',            1),
  ('15 días',  15, 'Crédito a 15 días',         2),
  ('30 días',  30, 'Crédito a 30 días',         3),
  ('45 días',  45, 'Crédito a 45 días',         4),
  ('60 días',  60, 'Crédito a 60 días',         5)
) AS v(nombre, dias, "desc", orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_condiciones_pago c WHERE c.nombre = v.nombre);

INSERT INTO public.piola_areas (nombre, descripcion, orden)
SELECT v.nombre, v.desc, v.orden
FROM (VALUES
  ('Dirección',    'Dirección general y estrategia', 1),
  ('Comercial',    'Ventas y captación',             2),
  ('Producción',   'Audiovisual y diseño',           3),
  ('Administración','Contabilidad y RR. HH.',        4)
) AS v(nombre, "desc", orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_areas a WHERE a.nombre = v.nombre);

INSERT INTO public.piola_centros_costo (codigo, nombre, area_id, orden)
SELECT v.codigo, v.nombre, a.id, v.orden
FROM (VALUES
  ('CC-DIR', 'Dirección',     'Dirección',     1),
  ('CC-COM', 'Comercial',     'Comercial',     2),
  ('CC-PRO', 'Producción',    'Producción',    3),
  ('CC-ADM', 'Administración','Administración',4)
) AS v(codigo, nombre, area, orden)
JOIN public.piola_areas a ON a.nombre = v.area
WHERE NOT EXISTS (SELECT 1 FROM public.piola_centros_costo c WHERE c.codigo = v.codigo);


-- ══════════════════════════════════════════════════════════════════════════
-- I. RLS — mismo patrón que el resto de Piola
--    Operativas → anon CRUD.  Auditoría → solo lectura para anon.
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  operativas TEXT[] := ARRAY[
    'piola_monedas','piola_impuestos','piola_tipos_comprobante','piola_series',
    'piola_condiciones_pago','piola_areas','piola_centros_costo','piola_proveedores',
    'piola_pagos','piola_caja_sesiones','piola_caja_movimientos','piola_presupuestos',
    'piola_contratos_laborales','piola_colaborador_documentos'
  ];
BEGIN
  FOREACH t IN ARRAY operativas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;

-- La auditoría se lee pero no se escribe ni se edita desde el navegador:
-- un log que el auditado puede borrar no sirve de nada.
ALTER TABLE public.piola_auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "service_all_piola_auditoria" ON public.piola_auditoria;
  CREATE POLICY "service_all_piola_auditoria" ON public.piola_auditoria
    FOR ALL TO service_role USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "anon_all_piola_auditoria" ON public.piola_auditoria;
  DROP POLICY IF EXISTS "anon_select_piola_auditoria" ON public.piola_auditoria;
  CREATE POLICY "anon_select_piola_auditoria" ON public.piola_auditoria
    FOR SELECT TO anon USING (true);
END $$;

-- La vista hereda la RLS de las tablas que consulta, pero necesita el GRANT.
GRANT SELECT ON public.piola_cuentas TO anon, authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
--
--   PARTE 4 de 4 — CORRECCIONES SOBRE LA PARTE 3
--
--   Va al final a propósito: hace CREATE OR REPLACE de funciones de la parte 3.
--   
--   1. La auditoría dejaba copia de los sueldos en una tabla que el navegador
--      puede leer entera. Se censura el VALOR, se conserva el REGISTRO.
--   2. Se limpia una condición muerta del UPDATE de estados de la parte 3.
--   
--   No hace falta recrear los triggers: apuntan a la función por nombre y
--   toman la versión nueva solos.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.piola_auditoria_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_antes    JSONB;
  v_despues  JSONB;
  v_campos   TEXT[] := '{}';
  v_id       BIGINT;
  v_usuario  TEXT;
  v_motivo   TEXT;
  v_est_ant  TEXT;
  v_est_new  TEXT;
  k          TEXT;
  -- Columnas cuyo VALOR no debe quedar copiado en la auditoría (ver abajo)
  sensibles  TEXT[] := ARRAY[
    'sueldo_bruto','remuneracion','bonificaciones','comision_pct','afp_cuspp'
  ];
  campo      TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_antes := to_jsonb(OLD);
    v_despues := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_antes := NULL;
    v_despues := to_jsonb(NEW);
  ELSE
    v_antes := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    -- Solo los campos que realmente cambiaron
    FOR k IN SELECT jsonb_object_keys(v_despues) LOOP
      IF v_antes -> k IS DISTINCT FROM v_despues -> k THEN
        v_campos := array_append(v_campos, k);
      END IF;
    END LOOP;
    -- Un UPDATE que no cambia nada no merece una fila de auditoría
    IF array_length(v_campos, 1) IS NULL THEN RETURN NEW; END IF;
  END IF;

  v_id := COALESCE((v_despues ->> 'id')::BIGINT, (v_antes ->> 'id')::BIGINT);
  v_est_ant := v_antes ->> 'estado';
  v_est_new := v_despues ->> 'estado';
  v_motivo  := v_despues ->> 'motivo_anulacion';
  v_usuario := COALESCE(
    v_despues ->> 'anulado_por', v_despues ->> 'updated_by', v_despues ->> 'created_by',
    v_antes  ->> 'updated_by',   v_antes  ->> 'created_by'
  );

  /*
   * Censura de remuneraciones.
   *
   * `piola_auditoria` es legible por anon (el navegador), y sin esto el
   * trigger dejaría ahí una copia del sueldo de cada colaborador cada vez que
   * alguien edita su ficha — puenteando el cuidado que sí tienen
   * piola_payslips, piola_afp_reports y piola_commissions, que no reciben
   * policy para anon justamente para que los sueldos no salgan por el cliente.
   *
   * Qué SIGUE registrado: que se tocó el sueldo, quién y cuándo — el nombre
   * del campo se conserva en `campos`. Lo que se va es el monto. El valor real
   * vive en piola_colaboradores; no hace falta una segunda copia en una tabla
   * que el navegador puede leer entera.
   */
  IF TG_TABLE_NAME = 'piola_colaboradores' THEN
    FOREACH campo IN ARRAY sensibles LOOP
      IF v_antes   ? campo THEN v_antes   := jsonb_set(v_antes,   ARRAY[campo], '"■■■"'); END IF;
      IF v_despues ? campo THEN v_despues := jsonb_set(v_despues, ARRAY[campo], '"■■■"'); END IF;
    END LOOP;
  END IF;

  INSERT INTO public.piola_auditoria (
    tabla, registro_id, operacion, campos, datos_antes, datos_despues,
    estado_anterior, estado_nuevo, usuario, motivo
  ) VALUES (
    TG_TABLE_NAME, v_id, TG_OP, v_campos, v_antes, v_despues,
    v_est_ant, v_est_new, v_usuario, v_motivo
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Nota sobre el UPDATE de estados de la migración 03
--
-- La 03 tenía `AND created_at < NOW()` en el UPDATE que marca como pagados los
-- movimientos sin ciclo de cobro. Esa condición era siempre verdadera y no
-- acotaba nada; el comentario sugería una salvaguarda que no existía.
--
-- Ya está corregido en la 03 (solo el comentario y la condición muerta), y no
-- hace falta rehacer nada acá: el UPDATE es idempotente y su efecto fue el
-- mismo con o sin esa línea.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 3. Verificación
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n
    FROM public.piola_auditoria
   WHERE tabla = 'piola_colaboradores'
     AND (datos_despues ? 'sueldo_bruto')
     AND datos_despues ->> 'sueldo_bruto' <> '■■■';

  IF n > 0 THEN
    RAISE NOTICE '⚠️  Hay % filas de auditoría ANTERIORES a esta migración con sueldos en claro.', n;
    RAISE NOTICE '    El trigger ya no los guardará, pero las viejas siguen ahí.';
    RAISE NOTICE '    Para limpiarlas, correr la sentencia comentada más abajo.';
  ELSE
    RAISE NOTICE '✓ No hay sueldos en claro en la auditoría.';
  END IF;
END $$;

-- Limpieza del histórico ya escrito. Va COMENTADA a propósito: modifica filas
-- de auditoría existentes, y eso conviene decidirlo mirando el resultado del
-- aviso de arriba. No borra filas ni cambia `campos`: solo tapa los valores.
--
-- UPDATE public.piola_auditoria
--    SET datos_antes = CASE WHEN datos_antes IS NULL THEN NULL ELSE (
--          SELECT jsonb_object_agg(k, CASE WHEN k IN
--            ('sueldo_bruto','remuneracion','bonificaciones','comision_pct','afp_cuspp')
--            THEN '"■■■"'::jsonb ELSE v END)
--          FROM jsonb_each(datos_antes) AS e(k, v)) END,
--        datos_despues = CASE WHEN datos_despues IS NULL THEN NULL ELSE (
--          SELECT jsonb_object_agg(k, CASE WHEN k IN
--            ('sueldo_bruto','remuneracion','bonificaciones','comision_pct','afp_cuspp')
--            THEN '"■■■"'::jsonb ELSE v END)
--          FROM jsonb_each(datos_despues) AS e(k, v)) END
--  WHERE tabla = 'piola_colaboradores';



-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 5 — 28/08: pago recurrente en contratos + alertas de vencimiento
--           de cuentas por cobrar/pagar + aprobación en cuentas por pagar
--
--   Motivada por dos documentos que mandó Piola:
--   - "Configuración financiera y de RRHH.pdf": pide explícitamente alertas
--     de vencimiento para cuentas por cobrar y un responsable de aprobación
--     en cuentas por pagar. Todo lo demás del PDF ya estaba construido.
--   - "Control de Pagos con Marcas y Contratos.xlsx": revela que sus contratos
--     en realidad son una CUOTA MENSUAL recurrente por marca (no el importe
--     único que hoy guarda piola_contratos), con un semáforo de renovación
--     (VIGENTE / PRÓXIMA RENOVACIÓN / RENOVAR AHORA / VENCIDO) y 5 hojas
--     mensuales de control de si ese mes se pagó o no — eso es exactamente
--     lo que faltaba conectar entre Contratos y Cuentas por Cobrar.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Contratos: cuota mensual recurrente -------------------------------------
-- `importe_pagado` sigue siendo el acumulado histórico (no se toca). Un
-- contrato sin pago_mensual es un proyecto puntual, no una marca con cuota fija.
ALTER TABLE public.piola_contratos
  ADD COLUMN IF NOT EXISTS pago_mensual   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS dia_pago       SMALLINT,
  ADD COLUMN IF NOT EXISTS cantidad_meses SMALLINT;

DO $$ BEGIN
  ALTER TABLE public.piola_contratos
    ADD CONSTRAINT piola_contratos_dia_pago_chk
    CHECK (dia_pago IS NULL OR dia_pago BETWEEN 1 AND 31) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.piola_contratos.pago_mensual IS
  'Cuota mensual recurrente. Distinto de importe_pagado (acumulado histórico). NULL = proyecto puntual, sin cuota fija.';

-- 2. Trazabilidad contrato -> cobro generado en Cuentas por Cobrar -----------
-- Permite el botón "Generar cobro del mes" en Contratos y evita generarlo dos
-- veces para el mismo periodo (el índice único de abajo es lo que lo impide,
-- no la aplicación).
ALTER TABLE public.piola_transactions
  ADD COLUMN IF NOT EXISTS contrato_id    BIGINT REFERENCES public.piola_contratos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS periodo_cobro  DATE,    -- primer día del mes que cubre el cobro
  -- §3 de la especificación financiera: "Cuentas por pagar ... responsable de
  -- aprobación". Mismo patrón que anulado_por/anulado_at, ya usado en esta tabla.
  ADD COLUMN IF NOT EXISTS aprobado_por   TEXT,
  ADD COLUMN IF NOT EXISTS aprobado_at    TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_piola_tx_contrato_periodo
  ON public.piola_transactions (contrato_id, periodo_cobro)
  WHERE contrato_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_piola_tx_contrato ON public.piola_transactions (contrato_id);

-- 3. Nuevos tipos de alerta ---------------------------------------------------
-- "contrato_por_renovar" ya existía pero alerta de CONTRATOS LABORALES
-- (piola_colaboradores.fecha_fin_contrato) — es un tipo distinto de contrato,
-- por eso el nuevo se llama contrato_cliente_por_vencer y no reutiliza el
-- nombre.
DO $$ BEGIN
  ALTER TABLE public.piola_alert_settings DROP CONSTRAINT piola_alert_settings_tipo_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.piola_alert_settings ADD CONSTRAINT piola_alert_settings_tipo_check
  CHECK (tipo IN ('factura_por_vencer','factura_por_emitir','contrato_por_renovar',
                  'lead_sin_seguimiento','entregable_por_vencer','comision_por_pagar',
                  'cuenta_cobrar_vencida','cuenta_pagar_vencida','contrato_cliente_por_vencer'));

INSERT INTO public.piola_alert_settings (tipo, descripcion, dias_antes) VALUES
  ('cuenta_cobrar_vencida',        'Cuenta por cobrar cerca de su vencimiento o ya vencida', 5),
  ('cuenta_pagar_vencida',         'Cuenta por pagar cerca de su vencimiento o ya vencida',  5),
  ('contrato_cliente_por_vencer',  'Contrato de marca/cliente por renovar',                  30)
ON CONFLICT (tipo) DO NOTHING;

-- 4. La vista piola_cuentas tiene lista explícita de columnas ---------------
-- PiolaCuentas.vue (el módulo real de Cuentas por Cobrar/Pagar) NO lee
-- piola_transactions directo: lee esta vista. Sin recrearla, aprobado_por y
-- contrato_id quedarían en la tabla pero invisibles para la pantalla — el
-- mismo error que ya se documentó para fecha_funnel en tradecars_funnel.sql.
CREATE OR REPLACE VIEW public.piola_cuentas AS
SELECT
  t.id,
  t.tipo,                                             -- ingreso = por cobrar, egreso = por pagar
  t.fecha AS fecha_emision,
  t.fecha_vencimiento,
  t.concepto,
  t.cliente_id,
  cl.nombre AS cliente_nombre,
  t.proveedor_id,
  pr.nombre AS proveedor_nombre,
  t.documento_serie,
  t.documento_numero,
  NULLIF(CONCAT_WS('-', t.documento_serie, t.documento_numero), '') AS documento,
  t.monto AS importe_total,
  t.monto_pagado AS importe_pagado,
  ROUND(GREATEST(COALESCE(t.monto, 0) - COALESCE(t.monto_pagado, 0), 0), 2) AS saldo_pendiente,
  CASE
    WHEN t.estado IN ('pagado','anulado') THEN 0
    WHEN t.fecha_vencimiento IS NULL      THEN 0
    ELSE GREATEST((CURRENT_DATE - t.fecha_vencimiento), 0)
  END AS dias_atraso,
  t.estado,
  t.responsable_email AS vendedor,
  t.area_id,
  t.centro_costo_id,
  t.proyectado,
  -- Parte 5: responsable de aprobación (sólo aplica a egresos / cuentas por
  -- pagar, pero se expone para ambos tipos por si algún día se pide para CxC).
  t.aprobado_por,
  t.aprobado_at,
  -- Parte 5: de qué contrato salió este cobro, si vino de "Generar cobro del mes".
  t.contrato_id
FROM public.piola_transactions t
LEFT JOIN public.piola_clientes    cl ON cl.id = t.cliente_id
LEFT JOIN public.piola_proveedores pr ON pr.id = t.proveedor_id
WHERE t.estado <> 'anulado';

GRANT SELECT ON public.piola_cuentas TO anon, authenticated, service_role;

-- 5. Verificación --------------------------------------------------------------
DO $$
DECLARE n_tipos INT;
BEGIN
  SELECT COUNT(*) INTO n_tipos FROM public.piola_alert_settings
   WHERE tipo IN ('cuenta_cobrar_vencida','cuenta_pagar_vencida','contrato_cliente_por_vencer');
  IF n_tipos = 3 THEN
    RAISE NOTICE '✓ Parte 5 aplicada: pago_mensual/dia_pago en contratos, contrato_id/aprobado_por en transactions + vista piola_cuentas, 3 alertas nuevas.';
  ELSE
    RAISE NOTICE '⚠️  Parte 5: se esperaban 3 tipos de alerta nuevos y se encontraron %.', n_tipos;
  END IF;
END $$;
