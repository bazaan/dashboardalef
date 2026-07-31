-- ══════════════════════════════════════════════════════════════════════════
-- PIOLA × ALEF COMPANY — Esquema completo del Dashboard / CRM
--
-- Fuente: "Especificación — Dashboard / CRM Piola" (reunión 30/07).
-- Se parte del dashboard base (multi-tenant Alef) y se agregan los módulos:
--   1. CRM Comercial (Leads)          → piola_lead_stages, piola_leads, piola_lead_activities
--   2. Contabilidad y Flujo de Caja   → piola_expense_categories (jerárquica), piola_transactions
--   3. Facturación (SUNAT)            → piola_invoices (con detracción)
--   4. Producción y Contenidos        → piola_services, piola_deliverables
--   5. RR. HH. (tareo/vacaciones)     → piola_attendance*, piola_vacation_*
--   6. Planilla (boletas + AFP)       → piola_payslips, piola_afp_reports   [RESTRINGIDO]
--   7. Reportes y automatizaciones    → piola_alerts, piola_scheduled_reports
--   8. Configuración (roles)          → piola_roles, piola_role_permissions, piola_colaboradores
--
-- CONVENCIONES
--   • Moneda única PEN. Se deja la columna `moneda` para el futuro (§14: sin multi-moneda en v1).
--   • Zona horaria de negocio: America/Lima. Los TIMESTAMPTZ se guardan en UTC
--     y se formatean a Lima en la app/endpoints.
--   • Todo catálogo (etapas de lead, categorías de gasto, servicios, métodos de
--     pago) es editable desde la UI: son tablas, NO enums hardcodeados (§4, §3).
--
-- SEGURIDAD
--   • Tablas operativas → anon (el navegador) puede CRUD, igual que el resto
--     del dashboard base.
--   • Tablas SENSIBLES (boletas de pago, AFP, comisiones, sueldos) → SOLO
--     service_role. Se leen/escriben exclusivamente por endpoints del servidor
--     que verifican rol Administrador (§7.5 "visibilidad restringida").
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente.
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 0. ROLES Y PERMISOS POR MÓDULO (§8)
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
