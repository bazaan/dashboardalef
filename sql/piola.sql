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
-- ══════════════════════════════════════════════════════════════════════════
--
--   PARTE 5 de 5 — REQUERIMIENTOS DE LA REUNIÓN DE SETIEMBRE
--
--   A. Finanzas
--      A1. Varios documentos por factura      → piola_documentos (polimórfica)
--      A2. Serie y número manuales            → piola_invoices.numeracion_manual
--      A3. Importación desde Excel            → piola_import_plantillas / _lotes
--      A4. Leyenda numerada de categorías     → piola_expense_categories.codigo
--      A5. Finanzas solo para 2 personas      → piola_modulo_acceso
--
--   B. Clientes y contratos — MÓDULO NUEVO
--      B1. Módulo 'clientes'                  → CHECK de piola_role_permissions
--      B2. Ficha de cliente con datos SUNAT   → piola_clientes se amplía
--      B3. Contratos ↔ facturas               → piola_invoices.contrato_id
--      B4. Facturación recurrente             → piola_facturas_programadas
--
--   C. Producción
--      C1. Cumplimiento por tipo de contenido → piola_tipos_contenido,
--                                               piola_cliente_compromisos
--      C2. Responsables por entregable        → piola_deliverable_asignaciones
--      C3. Áreas (producción/guiones/rodajes) → piola_produccion_areas
--      C4. Enlaces externos                   → deliverables + piola_enlaces_carpetas
--
--   D. RR. HH.
--      D1. Recibos por honorarios             → piola_recibos_honorarios (SENSIBLE)
--
--   E. Alertas
--      E1. Avisos de movimientos y registros  → piola_alert_settings se amplía
--
--   Idempotente como el resto del archivo: se puede correr las veces que haga
--   falta, sobre una base vacía o sobre una donde ya corrió.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- A1. DOCUMENTOS ADJUNTOS — varios por entidad
--
-- Antes cada cosa tenía UNA columna de archivo (invoices.pdf_url,
-- contratos.contrato_pdf, transactions.documento_adjunto). Una factura real
-- llega con la factura, la constancia de detracción y el contrato que la
-- respalda: tres archivos, una sola columna.
--
-- Tabla polimórfica en vez de tres tablas hermanas: el adjunto no tiene lógica
-- propia, solo cuelga de algo. `entidad` + `entidad_id` es la referencia; NO
-- hay FK porque apunta a seis tablas distintas — la limpieza va por el trigger
-- de más abajo, que borra los documentos cuando muere el dueño.
--
-- `path` guarda la ruta DENTRO del bucket piola-docs, no la URL pública: si el
-- bucket pasa a privado, no hay que migrar ni una fila (mismo criterio que
-- contratos en la parte 2).
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_documentos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad       TEXT NOT NULL CHECK (entidad IN (
                  'factura','contrato','adenda','movimiento','cliente',
                  'colaborador','recibo_honorarios','lead','entregable')),
  entidad_id    BIGINT NOT NULL,
  -- Qué es el documento. La UI agrupa por acá.
  tipo          TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN (
                  'factura','constancia_detraccion','contrato','anexo','ficha_ruc',
                  'legal','comprobante','boleta','recibo','orden_compra','otro')),
  nombre        TEXT NOT NULL,                    -- nombre visible (el original del archivo)
  path          TEXT NOT NULL,                    -- ruta en el bucket piola-docs
  mime          TEXT,
  tamano_bytes  BIGINT,
  descripcion   TEXT,
  subido_por    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_docs_entidad
  ON public.piola_documentos (entidad, entidad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_piola_docs_tipo ON public.piola_documentos (tipo);

COMMENT ON TABLE public.piola_documentos IS
  'Adjuntos (N por entidad). entidad+entidad_id es una referencia polimórfica sin FK: '
  'la limpieza al borrar el dueño la hace trg_piola_docs_limpiar_*.';

/*
 * Limpieza de huérfanos: cuando se borra la factura, el contrato o el
 * movimiento, sus adjuntos dejan de tener sentido. Sin esto quedarían filas
 * apuntando a un id reutilizable — y una factura nueva heredaría los papeles
 * de una borrada.
 *
 * Borra la FILA, no el archivo del bucket: eso es un proceso aparte y
 * deliberado (mismo criterio que PiolaSubirPdf al quitar un adjunto).
 */
CREATE OR REPLACE FUNCTION public.piola_documentos_limpiar()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.piola_documentos
   WHERE entidad = TG_ARGV[0] AND entidad_id = OLD.id;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

DO $$
DECLARE
  par TEXT[];
  pares TEXT[][] := ARRAY[
    ARRAY['piola_invoices','factura'],
    ARRAY['piola_contratos','contrato'],
    ARRAY['piola_adendas','adenda'],
    ARRAY['piola_transactions','movimiento'],
    ARRAY['piola_clientes','cliente'],
    ARRAY['piola_colaboradores','colaborador'],
    ARRAY['piola_deliverables','entregable']
  ];
BEGIN
  FOREACH par SLICE 1 IN ARRAY pares LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_piola_docs_limpiar ON public.%I', par[1]);
    EXECUTE format(
      'CREATE TRIGGER trg_piola_docs_limpiar AFTER DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.piola_documentos_limpiar(%L)',
      par[1], par[2]);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- A2. FACTURAS — serie y número manuales, y vínculo con el contrato
--
-- Piola ya tiene una numeración corriendo fuera del sistema. Forzar el
-- correlativo calculado obligaría a empezar de cero o a inventar series
-- paralelas, así que el número se puede escribir a mano; el UNIQUE
-- (tipo_comprobante, serie, numero) que ya existía es lo que impide repetirlo.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_invoices
  ADD COLUMN IF NOT EXISTS numeracion_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contrato_id       BIGINT,
  ADD COLUMN IF NOT EXISTS origen            TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS periodo_facturado TEXT,          -- 'YYYY-MM' de la recurrente
  ADD COLUMN IF NOT EXISTS cliente_email     TEXT,
  ADD COLUMN IF NOT EXISTS cliente_direccion TEXT;

DO $$ BEGIN
  ALTER TABLE public.piola_invoices
    ADD CONSTRAINT piola_inv_contrato_fk
    FOREIGN KEY (contrato_id) REFERENCES public.piola_contratos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.piola_invoices
    ADD CONSTRAINT piola_inv_origen_chk
    CHECK (origen IN ('manual','recurrente','importado','pse')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_piola_inv_contrato ON public.piola_invoices (contrato_id);

COMMENT ON COLUMN public.piola_invoices.numeracion_manual IS
  'TRUE = la serie y el número los escribió una persona para calzar con la numeración '
  'que Piola ya tiene fuera del sistema. FALSE = correlativo sugerido por el sistema.';


-- ══════════════════════════════════════════════════════════════════════════
-- A3. IMPORTACIÓN DE MOVIMIENTOS DESDE EXCEL
--
-- El archivo de Edson Polo tiene su propia estructura y su propia
-- nomenclatura, y va a cambiar. Por eso el mapeo columna → campo es DATO, no
-- código: se guarda como plantilla y se reusa. Cuando la hoja cambie de forma,
-- se edita la plantilla desde la UI y no hay que tocar nada más.
--
-- `mapeo` = { "columna del Excel": "campo del sistema", ... }
-- `opciones` = { fila_encabezado, formato_fecha, decimal, signo_egreso, ... }
-- ══════════════════════════════════════════════════════════════════════════

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
  detalle           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- errores fila a fila
  importado_por     TEXT,
  revertido_por     TEXT,
  revertido_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_import_lotes_fecha
  ON public.piola_import_lotes (created_at DESC);

/*
 * Trazabilidad y anti-duplicado.
 *
 * `import_hash` es la huella de la fila del Excel (fecha+concepto+monto+doc).
 * El índice único parcial es lo que hace que re-subir el mismo archivo no
 * duplique la contabilidad: la segunda pasada choca y se cuenta como
 * duplicada, en vez de sumar todo dos veces sin que nadie lo note.
 */
ALTER TABLE public.piola_transactions
  ADD COLUMN IF NOT EXISTS import_lote_id BIGINT REFERENCES public.piola_import_lotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_hash    TEXT,
  ADD COLUMN IF NOT EXISTS import_fila    INT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_tx_import_hash
  ON public.piola_transactions (import_hash) WHERE import_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_piola_tx_import_lote
  ON public.piola_transactions (import_lote_id);

-- Plantilla base con la nomenclatura habitual de una hoja de caja peruana.
-- Es un PUNTO DE PARTIDA editable, no la verdad: al cargar el archivo real de
-- Edson se corrige el mapeo desde la pantalla y queda guardado.
INSERT INTO public.piola_import_plantillas (nombre, descripcion, mapeo, opciones)
SELECT
  'Formato Edson Polo',
  'Mapeo inicial para la hoja de movimientos de administración. Ajustable desde la UI.',
  jsonb_build_object(
    'FECHA', 'fecha',
    'CONCEPTO', 'concepto',
    'DETALLE', 'concepto',
    'TIPO', 'tipo',
    'CATEGORIA', 'categoria',
    'CATEGORÍA', 'categoria',
    'INGRESO', 'monto_ingreso',
    'EGRESO', 'monto_egreso',
    'IMPORTE', 'monto',
    'MONTO', 'monto',
    'PROVEEDOR', 'proveedor',
    'CLIENTE', 'cliente',
    'RUC', 'ruc',
    'DOCUMENTO', 'documento_numero',
    'SERIE', 'documento_serie',
    'N° DOC', 'documento_numero',
    'MEDIO DE PAGO', 'payment_method',
    'OBSERVACIONES', 'notas'
  ),
  jsonb_build_object(
    'fila_encabezado', 1,
    'formato_fecha', 'auto',
    'decimal', '.',
    'signo_egreso', 'columna',
    'crear_categorias', TRUE
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_import_plantillas p WHERE p.nombre = 'Formato Edson Polo'
);


-- ══════════════════════════════════════════════════════════════════════════
-- A4. LEYENDA NUMERADA DE CATEGORÍAS
--
-- El requerimiento es poder decir "gasto 4.2" y que todos entiendan lo mismo.
-- El código es TEXTO, no un entero: la jerarquía se numera '4', '4.2', '4.2.1'
-- y eso no es un número. Único cuando existe, opcional cuando no —
-- las categorías viejas siguen siendo válidas sin código.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_expense_categories
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_piola_cat_codigo
  ON public.piola_expense_categories (lower(codigo)) WHERE codigo IS NOT NULL;

COMMENT ON COLUMN public.piola_expense_categories.codigo IS
  'Leyenda numerada, ej. "4" / "4.2". Texto y no entero porque la numeración es jerárquica.';

-- Numeración de las categorías raíz sembradas en la parte 1 (solo si no la tienen)
UPDATE public.piola_expense_categories c SET codigo = v.codigo
FROM (VALUES
  ('Impuestos','1'), ('Movilidad','2'), ('Planilla','3'), ('Servicios','4'),
  ('Producción','5'), ('Marketing','6'), ('Administrativos','7'),
  ('Ventas','8'), ('Otros ingresos','9')
) AS v(nombre, codigo)
WHERE c.nombre = v.nombre AND c.parent_id IS NULL AND c.codigo IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.piola_expense_categories x
                   WHERE lower(x.codigo) = lower(v.codigo));

-- Subcategorías de la parte 1
UPDATE public.piola_expense_categories c SET codigo = v.codigo
FROM (VALUES
  ('Impuesto a la renta','Impuestos','1.1'),
  ('IGV','Impuestos','1.2'),
  ('Pasajes','Movilidad','2.1'),
  ('Combustible','Movilidad','2.2')
) AS v(nombre, padre, codigo)
JOIN public.piola_expense_categories p ON p.nombre = v.padre AND p.parent_id IS NULL
WHERE c.nombre = v.nombre AND c.parent_id = p.id AND c.codigo IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.piola_expense_categories x
                   WHERE lower(x.codigo) = lower(v.codigo));

-- Las que pidió el cliente por nombre (combustible ya existe arriba)
INSERT INTO public.piola_expense_categories (nombre, parent_id, tipo, orden, codigo)
SELECT v.nombre, p.id, 'egreso', v.orden, v.codigo
FROM (VALUES
  ('Publicidad',     'Marketing', 1, '6.1'),
  ('Merchandising',  'Marketing', 2, '6.2'),
  ('Redes sociales', 'Marketing', 3, '6.3')
) AS v(nombre, padre, orden, codigo)
JOIN public.piola_expense_categories p ON p.nombre = v.padre AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_expense_categories c WHERE c.nombre = v.nombre AND c.parent_id = p.id
) AND NOT EXISTS (
  SELECT 1 FROM public.piola_expense_categories x WHERE lower(x.codigo) = lower(v.codigo)
);


-- ══════════════════════════════════════════════════════════════════════════
-- A5. FINANZAS RESTRINGIDA A PERSONAS CONCRETAS
--
-- Los permisos por rol siguen valiendo, pero encima va una lista blanca por
-- correo: aunque un rol tenga marcado 'contabilidad', si la persona no está en
-- la lista no entra. Es lo que pidió Piola — "solo Edson y Raysa" — y un rol
-- compartido no lo garantiza: basta que alguien herede ese rol.
--
-- FALLA CERRADO: si la lista queda vacía y la restricción está activa, solo
-- pasa el Administrador. Es la dirección segura del error — se queda gente
-- afuera, no se cuela nadie adentro — y el Administrador siempre puede
-- recargar la lista desde Configuración.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.piola_modulo_acceso (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Grupo lógico, no el módulo suelto: 'finanzas' cubre contabilidad + facturación
  grupo        TEXT NOT NULL UNIQUE,
  modulos      TEXT[] NOT NULL DEFAULT '{}',
  emails       TEXT[] NOT NULL DEFAULT '{}',
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.piola_modulo_acceso IS
  'Lista blanca por correo ENCIMA de los permisos por rol. Si activo y el correo no está, '
  'se niega el acceso aunque el rol lo permita. El Administrador nunca se bloquea.';

INSERT INTO public.piola_modulo_acceso (grupo, modulos, emails, descripcion, activo)
SELECT 'finanzas',
       ARRAY['contabilidad','facturacion'],
       ARRAY['administracion@piola.com','raysa@agenciapiola.com'],
       'Solo Edson Polo y Raysa Cucho (más el Administrador) entran a Finanzas.',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.piola_modulo_acceso m WHERE m.grupo = 'finanzas');


-- ══════════════════════════════════════════════════════════════════════════
-- B1. MÓDULO NUEVO 'clientes'
--
-- Clientes y contratos dejan de ser una pestaña de Facturación y pasan a ser
-- un módulo propio: son cosas distintas y las toca gente distinta —
-- justamente ahora que Finanzas queda restringida a dos personas, dejar los
-- contratos adentro dejaría al equipo comercial sin acceso a su propio
-- expediente de clientes.
--
-- El CHECK de piola_role_permissions.module se recrea para admitirlo.
-- ══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.piola_role_permissions
    DROP CONSTRAINT IF EXISTS piola_role_permissions_module_check;
  ALTER TABLE public.piola_role_permissions
    ADD CONSTRAINT piola_role_permissions_module_check
    CHECK (module IN (
      'home','crm','clientes','contabilidad','facturacion','produccion',
      'rrhh','reportes','configuracion','mi_espacio'));
END $$;

-- Quién ve el módulo nuevo. Comercial y Producción trabajan con las marcas
-- todos los días; Contabilidad lo lee para saber contra qué contrato factura.
INSERT INTO public.piola_role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, 'clientes', p.v, p.c, p.e, p.d
FROM public.piola_roles r
JOIN (VALUES
  ('Administrador',            TRUE, TRUE,  TRUE,  TRUE),
  ('Comercial / CRM',          TRUE, TRUE,  TRUE,  FALSE),
  ('Contabilidad',             TRUE, FALSE, FALSE, FALSE),
  ('Operaciones / Producción', TRUE, FALSE, TRUE,  FALSE)
) AS p(rol, v, c, e, d) ON p.rol = r.nombre
ON CONFLICT (role_id, module) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════
-- B2. FICHA DE CLIENTE — datos que devuelve la consulta por RUC
--
-- Se guardan para no depender del servicio externo cada vez que se abre la
-- ficha: la consulta por RUC autocompleta, pero el dato queda nuestro.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_clientes
  ADD COLUMN IF NOT EXISTS tipo_documento     TEXT NOT NULL DEFAULT 'RUC',
  ADD COLUMN IF NOT EXISTS numero_documento   TEXT,
  ADD COLUMN IF NOT EXISTS nombre_comercial   TEXT,
  ADD COLUMN IF NOT EXISTS estado_sunat       TEXT,       -- ACTIVO / BAJA DE OFICIO…
  ADD COLUMN IF NOT EXISTS condicion_sunat    TEXT,       -- HABIDO / NO HABIDO
  ADD COLUMN IF NOT EXISTS direccion_fiscal   TEXT,
  ADD COLUMN IF NOT EXISTS distrito           TEXT,
  ADD COLUMN IF NOT EXISTS provincia          TEXT,
  ADD COLUMN IF NOT EXISTS departamento       TEXT,
  ADD COLUMN IF NOT EXISTS ruc_consultado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ruc_datos          JSONB,
  ADD COLUMN IF NOT EXISTS condicion_pago_id  BIGINT REFERENCES public.piola_condiciones_pago(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by         TEXT,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_piola_clientes_ruc ON public.piola_clientes (ruc);


-- ══════════════════════════════════════════════════════════════════════════
-- B3/B4. CONTRATOS: vigencia, recurrencia y facturas programadas
--
-- El contrato ya guardaba fecha_inicio y fecha_cierre. Lo que faltaba era el
-- QUÉ se factura cada mes de esa vigencia. Con eso, el sistema puede
-- adelantarse: programa las facturas de todo el periodo del contrato y avisa.
--
-- Genera BORRADORES, nunca emite sola. Una factura emitida sin que nadie la
-- mire es un documento tributario con la firma de la empresa: la automatización
-- llega hasta dejarla lista.
-- ══════════════════════════════════════════════════════════════════════════

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

DO $$ BEGIN
  ALTER TABLE public.piola_contratos
    ADD CONSTRAINT piola_contratos_estado_chk
    CHECK (estado IN ('borrador','vigente','vencido','renovado','anulado')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.piola_contratos
    ADD CONSTRAINT piola_contratos_frecuencia_chk
    CHECK (frecuencia IN ('mensual','bimestral','trimestral','semestral','anual','unico')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.piola_contratos
    ADD CONSTRAINT piola_contratos_dia_chk
    CHECK (dia_facturacion BETWEEN 1 AND 28) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.piola_contratos.dia_facturacion IS
  'Día del mes en que toca facturar. Tope 28 a propósito: el 30 no existe en febrero '
  'y el 31 no existe en la mitad de los meses.';

CREATE TABLE IF NOT EXISTS public.piola_facturas_programadas (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contrato_id      BIGINT NOT NULL REFERENCES public.piola_contratos(id) ON DELETE CASCADE,
  cliente_id       BIGINT REFERENCES public.piola_clientes(id) ON DELETE SET NULL,
  periodo          TEXT NOT NULL,                       -- 'YYYY-MM'
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

CREATE INDEX IF NOT EXISTS idx_piola_fprog_pendientes
  ON public.piola_facturas_programadas (estado, fecha_programada);


-- ══════════════════════════════════════════════════════════════════════════
-- C. PRODUCCIÓN — tipos de contenido, áreas, responsables y enlaces
--
-- El cumplimiento por marca decía "8 de 10 piezas" y esa cifra escondía lo que
-- importa: pueden ser 8 piezas gráficas y 0 videos con el compromiso cumplido
-- en el papel e incumplido en los hechos. El compromiso pasa a ser POR TIPO.
-- ══════════════════════════════════════════════════════════════════════════

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

CREATE TABLE IF NOT EXISTS public.piola_tipos_contenido (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  area_codigo TEXT REFERENCES public.piola_produccion_areas(codigo) ON DELETE SET NULL,
  unidad      TEXT NOT NULL DEFAULT 'pieza',
  icono       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0
);

INSERT INTO public.piola_tipos_contenido (codigo, nombre, area_codigo, unidad, icono, orden)
SELECT v.codigo, v.nombre, v.area, v.unidad, v.icono, v.orden
FROM (VALUES
  ('video',        'Video',            'produccion', 'video',   'mdi-video',            1),
  ('reel',         'Reel',             'produccion', 'video',   'mdi-cellphone-play',   2),
  ('pieza_grafica','Pieza gráfica',    'diseno',     'pieza',   'mdi-image-multiple',   3),
  ('carrusel',     'Carrusel',         'diseno',     'pieza',   'mdi-view-carousel',    4),
  ('guion',        'Guion',            'guiones',    'guion',   'mdi-script-text',      5),
  ('rodaje',       'Rodaje',           'rodajes',    'jornada', 'mdi-movie-open',       6),
  ('fotografia',   'Fotografía',       'produccion', 'sesión',  'mdi-camera',           7),
  ('branding',     'Branding',         'diseno',     'entrega', 'mdi-palette',          8),
  ('copy',         'Copy / redacción', 'community',  'pieza',   'mdi-text-box',         9)
) AS v(codigo, nombre, area, unidad, icono, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_tipos_contenido t WHERE t.codigo = v.codigo);

-- Compromiso mensual POR TIPO de contenido. `piola_clientes.compromiso_mensual`
-- se conserva como total histórico: las marcas que aún no tienen desglose
-- siguen midiéndose con él.
CREATE TABLE IF NOT EXISTS public.piola_cliente_compromisos (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id        BIGINT NOT NULL REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  tipo_contenido    TEXT NOT NULL REFERENCES public.piola_tipos_contenido(codigo) ON DELETE CASCADE,
  cantidad_mensual  NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, tipo_contenido)
);

-- Un entregable puede tener varios responsables con roles distintos: el
-- diseñador que lo arma y el editor que lo cierra no son la misma persona, y
-- `responsable_email` (que se conserva) solo alcanza para uno.
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

ALTER TABLE public.piola_deliverables
  ADD COLUMN IF NOT EXISTS tipo_contenido    TEXT REFERENCES public.piola_tipos_contenido(codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_codigo       TEXT REFERENCES public.piola_produccion_areas(codigo) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dropbox_url       TEXT,
  ADD COLUMN IF NOT EXISTS publicado_url     TEXT,
  ADD COLUMN IF NOT EXISTS fecha_publicacion DATE,
  ADD COLUMN IF NOT EXISTS created_by        TEXT;

CREATE INDEX IF NOT EXISTS idx_piola_deliv_tipo ON public.piola_deliverables (tipo_contenido, periodo);
CREATE INDEX IF NOT EXISTS idx_piola_deliv_area ON public.piola_deliverables (area_codigo);

/*
 * Carpetas fijas por marca. La integración con la API de Dropbox queda
 * pendiente de que Piola confirme la app y las credenciales; mientras tanto el
 * enlace directo a la carpeta resuelve el 90 % del caso — que es llegar al
 * material sin preguntarle a nadie. Cuando lleguen las credenciales, esta
 * misma tabla guarda el folder_id y no hay que rehacer la UI.
 */
CREATE TABLE IF NOT EXISTS public.piola_enlaces_carpetas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id  BIGINT REFERENCES public.piola_clientes(id) ON DELETE CASCADE,
  proveedor   TEXT NOT NULL DEFAULT 'drive' CHECK (proveedor IN ('drive','dropbox','otro')),
  nombre      TEXT NOT NULL,
  url         TEXT NOT NULL,
  folder_id   TEXT,                                -- para la futura API
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INT NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piola_enlaces_cliente ON public.piola_enlaces_carpetas (cliente_id);


-- ══════════════════════════════════════════════════════════════════════════
-- D1. RECIBOS POR HONORARIOS (§7.5)
--
-- El colaborador de recibo por honorarios NO tiene boleta: tiene un RH con
-- retención de renta de 4.ª categoría (8 %), que se suspende con la
-- constancia de suspensión de SUNAT. El número del recibo lo emite el
-- colaborador en SUNAT, así que acá se REGISTRA, no se inventa.
--
-- Tabla SENSIBLE: sin policy para anon, igual que boletas y AFP. La lee y la
-- escribe solo el endpoint con verificación de rol.
-- ══════════════════════════════════════════════════════════════════════════

-- El colaborador de honorarios necesita su propio RUC (emite el RH a su nombre)
-- y su constancia de suspensión, si la tiene. `honorarios_monto` es el pactado
-- mensual: el equivalente al sueldo_bruto de los de planilla.
ALTER TABLE public.piola_colaboradores
  ADD COLUMN IF NOT EXISTS ruc                TEXT,
  ADD COLUMN IF NOT EXISTS honorarios_monto   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS suspension_renta   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rh_serie           TEXT;

CREATE TABLE IF NOT EXISTS public.piola_recibos_honorarios (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo             TEXT NOT NULL UNIQUE,
  colaborador_email  TEXT NOT NULL,
  colaborador_nombre TEXT,
  colaborador_ruc    TEXT,
  periodo            TEXT NOT NULL,                -- 'YYYY-MM'
  fecha_emision      DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Numeración del RH que el colaborador emite en SUNAT (E001-123). Manual.
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

CREATE INDEX IF NOT EXISTS idx_piola_rh_periodo ON public.piola_recibos_honorarios (periodo DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- E1. ALERTAS DE MOVIMIENTOS Y REGISTROS
--
-- Las alertas de la parte 1 miran el FUTURO (lo que vence). Estas miran el
-- PRESENTE: avisan cuando algo se registra. Comparten tabla porque comparten
-- destino, historial y pantalla; lo que cambia es que no tienen días de
-- anticipación y sí un monto mínimo, para que el canal no se llene de avisos
-- de S/ 20.
--
-- ⚠️ VENTANA DE 24 h DE WHATSAPP: fuera de una conversación abierta, Meta solo
-- entrega PLANTILLAS aprobadas. Estos avisos son no solicitados por definición,
-- así que el flujo de n8n tiene que mandarlos como plantilla; si manda texto
-- libre, se pierden en silencio.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.piola_alert_settings
  ADD COLUMN IF NOT EXISTS eventos      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monto_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion_larga TEXT;

DO $$ BEGIN
  ALTER TABLE public.piola_alert_settings DROP CONSTRAINT IF EXISTS piola_alert_settings_tipo_check;
  ALTER TABLE public.piola_alert_settings
    ADD CONSTRAINT piola_alert_settings_tipo_check
    CHECK (tipo IN ('factura_por_vencer','factura_por_emitir','contrato_por_renovar',
                    'lead_sin_seguimiento','entregable_por_vencer','comision_por_pagar',
                    'movimiento_financiero','registro_sistema','factura_programada',
                    'contrato_cliente_por_vencer'));
END $$;

INSERT INTO public.piola_alert_settings (tipo, descripcion, dias_antes, canal, eventos, monto_minimo)
SELECT v.tipo, v.descripcion, v.dias, 'whatsapp', v.eventos, v.monto
FROM (VALUES
  ('movimiento_financiero',
   'Aviso al registrar ingresos, egresos, pagos y facturas',
   0,
   ARRAY['movimiento_creado','movimiento_eliminado','pago_registrado','factura_emitida','factura_pagada','caja_cerrada','importacion'],
   0::numeric),
  ('registro_sistema',
   'Aviso al registrar clientes, contratos, entregables y colaboradores',
   0,
   ARRAY['cliente_creado','contrato_creado','entregable_creado','colaborador_creado'],
   0::numeric),
  ('factura_programada',
   'Facturas recurrentes de contrato listas para emitirse',
   3,
   ARRAY[]::text[],
   0::numeric),
  ('contrato_cliente_por_vencer',
   'Contratos de cliente próximos a vencer',
   15,
   ARRAY[]::text[],
   0::numeric)
) AS v(tipo, descripcion, dias, eventos, monto)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_alert_settings a WHERE a.tipo = v.tipo);

-- `piola_alerts.tipo` no tenía CHECK, así que los tipos nuevos entran solos.
-- El evento concreto viaja en `related_table`/`related_id`, que ya existían.


-- ══════════════════════════════════════════════════════════════════════════
-- RLS de las tablas nuevas — mismo patrón del resto del archivo:
--   operativas → anon CRUD (las escrituras van por endpoint igual)
--   sensibles  → SOLO service_role
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  operativas TEXT[] := ARRAY[
    'piola_documentos','piola_import_plantillas','piola_import_lotes',
    'piola_modulo_acceso','piola_facturas_programadas',
    'piola_produccion_areas','piola_tipos_contenido','piola_cliente_compromisos',
    'piola_deliverable_asignaciones','piola_enlaces_carpetas'
  ];
  sensibles TEXT[] := ARRAY['piola_recibos_honorarios'];
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

  FOREACH t IN ARRAY sensibles LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON public.%I', t, t);
  END LOOP;
END $$;

/*
 * `piola_modulo_acceso` es legible por anon como el resto de las operativas:
 * la pantalla necesita saber si el módulo está restringido para no ofrecer un
 * botón que va a dar 403. No es un secreto — es una lista de correos de
 * trabajo — y la decisión real la toma el servidor en cada endpoint.
 * Escribirla, en cambio, exige Administrador (configuracion.post.ts).
 */


-- ══════════════════════════════════════════════════════════════════════════
-- Auditoría de las tablas nuevas que mueven plata o accesos
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  auditar TEXT[] := ARRAY[
    'piola_modulo_acceso','piola_facturas_programadas','piola_import_lotes',
    'piola_cliente_compromisos','piola_enlaces_carpetas'
  ];
BEGIN
  FOREACH t IN ARRAY auditar LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_piola_audit ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_piola_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.piola_auditoria_trigger()', t);
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- Verificación de la parte 5
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  faltan TEXT := '';
  t TEXT;
  nuevas TEXT[] := ARRAY[
    'piola_documentos','piola_import_plantillas','piola_import_lotes','piola_modulo_acceso',
    'piola_facturas_programadas','piola_produccion_areas','piola_tipos_contenido',
    'piola_cliente_compromisos','piola_deliverable_asignaciones','piola_enlaces_carpetas',
    'piola_recibos_honorarios'
  ];
  n_emails INT;
BEGIN
  FOREACH t IN ARRAY nuevas LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = t) THEN
      faltan := faltan || ' ' || t;
    END IF;
  END LOOP;

  IF faltan <> '' THEN
    RAISE WARNING '⚠️  Faltan tablas de la parte 5:%', faltan;
  ELSE
    RAISE NOTICE '✓ Parte 5: las 11 tablas nuevas existen.';
  END IF;

  SELECT COALESCE(array_length(emails, 1), 0) INTO n_emails
    FROM public.piola_modulo_acceso WHERE grupo = 'finanzas';
  IF COALESCE(n_emails, 0) = 0 THEN
    RAISE NOTICE '⚠️  Finanzas está restringida y SIN correos: solo entra el Administrador.';
  ELSE
    RAISE NOTICE '✓ Finanzas restringida a % correo(s) + Administrador.', n_emails;
  END IF;
END $$;
