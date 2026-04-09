-- ============================================================
--  SQL - TABLAS PARA "ESTÁS CON SUERTE" (ECS)
--  Dashboard: /pruebas/EstasConSuerte
--  Todas las tablas llevan el prefijo "ECS_"
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ECS_contribuyentes
--    Módulo: (interno / datos fiscales de la empresa)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_contribuyentes (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT          NOT NULL,
    ruc         VARCHAR(11),
    email       TEXT,
    telefono    VARCHAR(20),
    estado      TEXT          DEFAULT 'activo',
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. ECS_GeneralBDwpp
--    Módulo: Leads → pestaña WhatsApp
--    Leads captados desde WhatsApp
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_GeneralBDwpp (
    id                      BIGSERIAL PRIMARY KEY,
    nombre                  TEXT,
    numero                  VARCHAR(20),
    lead_status             TEXT,          -- 'lead_caliente', 'lead_tibio', etc.
    reason_ia_qualification TEXT,
    producto_interes        TEXT,
    created_at              TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. ECS_GeneralBDfbig
--    Módulo: Leads → pestaña Instagram/Facebook
--    Leads captados desde Instagram / Facebook
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_GeneralBDfbig (
    id                      BIGSERIAL PRIMARY KEY,
    nombre                  TEXT,
    instagram_handle        TEXT,
    lead_status             TEXT,          -- 'lead_caliente', 'lead_tibio', etc.
    reason_ia_qualification TEXT,
    producto_interes        TEXT,
    created_at              TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. ECS_pago_completo_motorizado
--    Módulo: Ventas → tipo "Ventas Motorizado"
--    Registra ventas entregadas por motorizado
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_pago_completo_motorizado (
    id               BIGSERIAL PRIMARY KEY,
    nombre_completo  TEXT,
    dni              VARCHAR(20),
    numero_celular   VARCHAR(20),
    correo           TEXT,
    direccion_exacta TEXT,
    producto         TEXT,
    cantidad         INT           DEFAULT 1,
    precio           NUMERIC(10,2),
    metodo_pago      TEXT,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. ECS_pago_completo_courier
--    Módulo: Ventas → tipo "Ventas Courier"
--    Registra ventas enviadas por courier
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_pago_completo_courier (
    id               BIGSERIAL PRIMARY KEY,
    nombre_completo  TEXT,
    dni              VARCHAR(20),
    numero_celular   VARCHAR(20),
    correo           TEXT,
    courier          TEXT,
    nombre_agencia   TEXT,
    producto         TEXT,
    cantidad         INT           DEFAULT 1,
    precio           NUMERIC(10,2),
    metodo_pago      TEXT,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. ECS_pago_completo_recojo_tienda
--    Módulo: Ventas → tipo "Ventas Recojo en tienda"
--    Registra ventas retiradas en tienda (como venta confirmada)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_pago_completo_recojo_tienda (
    id               BIGSERIAL PRIMARY KEY,
    nombre_completo  TEXT,
    dni              VARCHAR(20),
    numero_celular   VARCHAR(20),
    correo           TEXT,
    local_deseado    TEXT,
    fecha_reserva    DATE,
    hora_reserva     TIME,
    producto         TEXT,
    cantidad         INT           DEFAULT 1,
    precio           NUMERIC(10,2),
    metodo_pago      TEXT,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. ECS_reserva_recojo_tienda
--    Módulo: Reservas + Contabilidad (ingresos por reservas)
--    Pre-reservas de clientes para recoger en tienda
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_reserva_recojo_tienda (
    id                    BIGSERIAL PRIMARY KEY,
    nombre_completo       TEXT,
    dni                   VARCHAR(20),
    numero_celular        VARCHAR(20),
    correo                TEXT,
    local_deseado         TEXT,
    fecha_reserva         DATE,
    hora_reserva          TIME,
    producto_reservado    TEXT,
    cantidad              INT           DEFAULT 1,
    precio                NUMERIC(10,2),
    metodo_pago_reserva   TEXT,
    descripcion           TEXT,
    created_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. ECS_stock
--    Módulo: Documents → Stock (sincronizado desde Bsale)
--    Inventario principal del sistema (equivalente a bsale_origitec_stock)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_stock (
    id                  BIGSERIAL PRIMARY KEY,
    nombre_producto     TEXT,
    cantidad_disponible INT           DEFAULT 0,
    sucursal_id         VARCHAR(10),
    precio              NUMERIC(10,2),
    created_at          TIMESTAMPTZ   DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 9. ECS_Stock_celulares
--    Módulo: Documents → Stock → sub-pestaña Celulares
--    Inventario manual de celulares
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_Stock_celulares (
    id      BIGSERIAL PRIMARY KEY,
    nombre  TEXT          NOT NULL,
    stock   INT           DEFAULT 0,
    precio  NUMERIC(10,2)
);

-- ─────────────────────────────────────────────────────────────
-- 10. ECS_Stock_laptops_tablets
--     Módulo: Documents → Stock → sub-pestaña Laptops/Tablets
--     Inventario manual de laptops y tablets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_Stock_laptops_tablets (
    id      BIGSERIAL PRIMARY KEY,
    nombre  TEXT          NOT NULL,
    stock   INT           DEFAULT 0,
    precio  NUMERIC(10,2)
);

-- ─────────────────────────────────────────────────────────────
-- 11. ECS_Stock_accesorios
--     Módulo: Documents → Stock → sub-pestaña Accesorios
--     Inventario manual de accesorios
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_Stock_accesorios (
    id      BIGSERIAL PRIMARY KEY,
    nombre  TEXT          NOT NULL,
    stock   INT           DEFAULT 0,
    precio  NUMERIC(10,2)
);

-- ─────────────────────────────────────────────────────────────
-- 12. ECS_calendar_events
--     Módulo: Calendario
--     Eventos del calendario del dashboard
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_calendar_events (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE          NOT NULL,
    time            TIME          NOT NULL,
    subject         TEXT          NOT NULL,
    description     TEXT,
    procedure_id    TEXT,
    client_name     TEXT,
    client_surname  TEXT,
    client_dni      VARCHAR(20),
    event_reason    TEXT,
    color           VARCHAR(20)   DEFAULT '#3b82f6',
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 13. ECS_procedures
--     Módulo: (interno) Tipos de entrega / procedimientos
--     Catálogo de procedimientos/servicios (ej: Motorizado, Courier, Tienda)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_procedures (
    id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name      TEXT          NOT NULL,
    color     VARCHAR(20)   DEFAULT '#3b82f6',
    price     NUMERIC(10,2) DEFAULT 0,
    discount  NUMERIC(5,2)  DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- 14. ECS_client_history
--     Módulo: (interno) Historial de clientes
--     Historial de interacciones / compras por cliente
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_client_history (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT          NOT NULL,
    surname          TEXT,
    dni              VARCHAR(20),
    phone            VARCHAR(20),
    email            TEXT,
    date_added       TEXT,
    attachment_name  TEXT,
    attachment_data  TEXT          -- Base64 de adjunto (opcional)
);

-- ─────────────────────────────────────────────────────────────
-- 15. ECS_egresos
--     Módulo: Financias → Egresos
--     Registro de gastos/egresos de la empresa
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ECS_egresos (
    id           BIGSERIAL PRIMARY KEY,
    tipo_egreso  TEXT          NOT NULL,
    nombre       TEXT          NOT NULL,
    precio       NUMERIC(10,2) DEFAULT 0,
    cantidad     INT           DEFAULT 1,
    company_id   TEXT          DEFAULT 'estasconsuerte',
    created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
--  RESUMEN DE TABLAS POR MÓDULO
-- ============================================================
--
--  MÓDULO LEADS:
--    - ECS_GeneralBDwpp            (leads por WhatsApp)
--    - ECS_GeneralBDfbig           (leads por Instagram/Facebook)
--
--  MÓDULO VENTAS:
--    - ECS_pago_completo_motorizado   (ventas motorizado)
--    - ECS_pago_completo_courier      (ventas courier)
--    - ECS_pago_completo_recojo_tienda(ventas recojo tienda)
--
--  MÓDULO RESERVAS:
--    - ECS_reserva_recojo_tienda   (pre-reservas tienda)
--
--  MÓDULO STOCK (Documents):
--    - ECS_stock                   (inventario principal / Bsale)
--    - ECS_Stock_celulares         (inventario manual celulares)
--    - ECS_Stock_laptops_tablets   (inventario manual laptops/tablets)
--    - ECS_Stock_accesorios        (inventario manual accesorios)
--
--  MÓDULO CALENDARIO:
--    - ECS_calendar_events         (eventos del calendario)
--
--  MÓDULO FINANCIAS → EGRESOS:
--    - ECS_egresos                 (gastos registrados)
--
--  MÓDULO INTERNO (Procedimientos / Historial):
--    - ECS_procedures              (tipos de entrega/procedimientos)
--    - ECS_client_history          (historial de clientes)
--
--  DATOS FISCALES:
--    - ECS_contribuyentes          (datos RUC / contribuyentes)
--
-- ============================================================
