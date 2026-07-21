-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS PERÚ — Esquema completo del dashboard
--
-- Empresa de COMPRA y VENTA de automóviles.
-- company_id en dashboardlogin: 'tradecars'  (también acepta 'trade cars')
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente
-- (CREATE TABLE IF NOT EXISTS / políticas con guard) — no borra datos.
--
-- Bloques:
--   1. Leads por canal        → "GeneralBDwppTRADECARS", "GeneralBDfbigTRADECARS"
--   2. Clientes (CRM)         → tradecars_clientes           (comprador / vendedor)
--   3. Solicitudes web        → tradecars_solicitudes_compra / _venta
--   4. Inventario             → tradecars_vehiculos
--   5. Operaciones            → tradecars_ventas / tradecars_compras
--   6. Agenda                 → tradecars_calendar_events
--   7. Finanzas               → tradecars_egresos
-- ══════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════
-- 1. LEADS POR CANAL
--    Mismo patrón que el resto de empresas (GeneralBDwpp<EMPRESA>).
--    Los consume el RemarketingPanel del dashboard.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public."GeneralBDwppTRADECARS" (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                   TEXT,
  numero                   TEXT,                 -- teléfono WhatsApp
  correo                   TEXT,
  lead_status              TEXT,                 -- frio | tibio | caliente
  reason_ia_qualification  TEXT,                 -- por qué la IA lo calificó así
  interes                  TEXT,                 -- comprar | vender
  servicio_interes         TEXT,
  marca_interes            TEXT,
  modelo_interes           TEXT,
  presupuesto              NUMERIC(12,2),
  fecha_agendamiento       TEXT,
  agendamiento             TEXT,                 -- 'IA' cuando lo agenda el agente
  estado                   TEXT DEFAULT 'Activo',
  created_at               TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public."GeneralBDfbigTRADECARS" (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                   TEXT,
  instagram_handle         TEXT,                 -- @usuario o PSID de Messenger
  numero                   TEXT,
  correo                   TEXT,
  lead_status              TEXT,
  reason_ia_qualification  TEXT,
  interes                  TEXT,                 -- comprar | vender
  servicio_interes         TEXT,
  marca_interes            TEXT,
  modelo_interes           TEXT,
  presupuesto              NUMERIC(12,2),
  fecha_agendamiento       TEXT,
  agendamiento             TEXT,
  estado                   TEXT DEFAULT 'Activo',
  created_at               TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_lead_wpp_created  ON public."GeneralBDwppTRADECARS"  (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_lead_fbig_created ON public."GeneralBDfbigTRADECARS" (created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 2. CLIENTES (CRM)
--    UNA tabla con `tipo` para separar limpiamente compradores de vendedores.
--    El dashboard los muestra en dos pestañas distintas.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_clientes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo              TEXT NOT NULL DEFAULT 'comprador',  -- comprador | vendedor | ambos
  nombre_completo   TEXT NOT NULL,
  dni               TEXT,
  telefono          TEXT,
  correo            TEXT,
  distrito          TEXT,
  canal             TEXT DEFAULT 'web',   -- web | whatsapp | facebook | instagram | tiktok | referido | presencial
  estado            TEXT DEFAULT 'nuevo', -- nuevo | contactado | en_negociacion | cerrado | descartado

  -- Si es COMPRADOR (quiere comprar un auto)
  presupuesto       NUMERIC(12,2),
  marca_interes     TEXT,
  modelo_interes    TEXT,
  anio_interes      INTEGER,

  -- Si es VENDEDOR (quiere vender su auto)
  vehiculo_marca    TEXT,
  vehiculo_modelo   TEXT,
  vehiculo_anio     INTEGER,
  vehiculo_placa    TEXT,
  vehiculo_km       INTEGER,
  tiene_deuda       BOOLEAN DEFAULT FALSE,

  -- Trazabilidad al formulario web que lo originó
  solicitud_compra_id UUID,
  solicitud_venta_id  UUID,

  asesor            TEXT,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at        TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_clientes_tipo    ON public.tradecars_clientes (tipo);
CREATE INDEX IF NOT EXISTS idx_tc_clientes_estado  ON public.tradecars_clientes (estado);
CREATE INDEX IF NOT EXISTS idx_tc_clientes_created ON public.tradecars_clientes (created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 3. SOLICITUDES DE LA WEB (los 2 formularios de tradecars.pe)
--    Las llena el endpoint POST /api/tradecars/formulario
-- ══════════════════════════════════════════════════════════════════════════

-- 3.a) Formulario "QUIERO COMPRAR" (form corto: Déjanos tus datos)
CREATE TABLE IF NOT EXISTS public.tradecars_solicitudes_compra (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo  TEXT NOT NULL,
  correo           TEXT,
  celular          TEXT,
  mensaje          TEXT,

  -- Gestión interna
  estado           TEXT DEFAULT 'nuevo',   -- nuevo | contactado | atendido | descartado
  atendido_por     TEXT,
  atendido_en      TIMESTAMPTZ,
  notas            TEXT,
  cliente_id       UUID,                   -- si se convirtió en cliente

  -- Trazabilidad de origen
  origen           TEXT DEFAULT 'web',
  pagina_origen    TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  ip               TEXT,
  user_agent       TEXT,
  payload          JSONB,                  -- body crudo recibido
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3.b) Formulario "QUIERO VENDER MI AUTO" (form largo: datos + vehículo)
CREATE TABLE IF NOT EXISTS public.tradecars_solicitudes_venta (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo  TEXT NOT NULL,
  celular          TEXT,
  correo           TEXT,

  -- Datos del vehículo que quieren vender
  marca            TEXT,
  modelo           TEXT,
  placa            TEXT,
  distrito         TEXT,
  anio             INTEGER,
  kilometraje      INTEGER,
  tiene_deuda      TEXT,                   -- 'si' | 'no' (tal cual llega del form)
  mensaje          TEXT,

  -- Gestión interna / tasación
  estado           TEXT DEFAULT 'nuevo',   -- nuevo | contactado | tasado | comprado | descartado
  precio_ofrecido  NUMERIC(12,2),
  atendido_por     TEXT,
  atendido_en      TIMESTAMPTZ,
  notas            TEXT,
  cliente_id       UUID,

  -- Trazabilidad de origen
  origen           TEXT DEFAULT 'web',
  pagina_origen    TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  ip               TEXT,
  user_agent       TEXT,
  payload          JSONB,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_sol_compra_estado  ON public.tradecars_solicitudes_compra (estado);
CREATE INDEX IF NOT EXISTS idx_tc_sol_compra_created ON public.tradecars_solicitudes_compra (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_sol_venta_estado   ON public.tradecars_solicitudes_venta  (estado);
CREATE INDEX IF NOT EXISTS idx_tc_sol_venta_created  ON public.tradecars_solicitudes_venta  (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_sol_venta_placa    ON public.tradecars_solicitudes_venta  (placa);


-- ══════════════════════════════════════════════════════════════════════════
-- 4. INVENTARIO DE VEHÍCULOS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_vehiculos (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo             TEXT,                    -- código interno, ej. TC-0001
  marca              TEXT,
  modelo             TEXT,
  version            TEXT,
  anio               INTEGER,
  placa              TEXT,
  color              TEXT,
  kilometraje        INTEGER,
  transmision        TEXT,                    -- mecanica | automatica
  combustible        TEXT,                    -- gasolina | diesel | glp | gnv | hibrido | electrico
  precio_compra      NUMERIC(12,2),
  precio_venta       NUMERIC(12,2),
  estado             TEXT DEFAULT 'disponible', -- disponible | reservado | vendido | en_preparacion
  tiene_deuda        BOOLEAN DEFAULT FALSE,
  propietario_nombre TEXT,
  fecha_ingreso      DATE DEFAULT CURRENT_DATE,
  fotos              JSONB,                   -- ["url1", "url2"]
  notas              TEXT,
  created_at         TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at         TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_veh_estado ON public.tradecars_vehiculos (estado);
CREATE INDEX IF NOT EXISTS idx_tc_veh_placa  ON public.tradecars_vehiculos (placa);
CREATE INDEX IF NOT EXISTS idx_tc_veh_marca  ON public.tradecars_vehiculos (marca);


-- ══════════════════════════════════════════════════════════════════════════
-- 5. OPERACIONES: VENTAS (Trade Cars vende) y COMPRAS (Trade Cars compra)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_ventas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehiculo_id      UUID REFERENCES public.tradecars_vehiculos(id) ON DELETE SET NULL,
  cliente_id       UUID REFERENCES public.tradecars_clientes(id)  ON DELETE SET NULL,
  cliente_nombre   TEXT,
  cliente_dni      TEXT,
  cliente_telefono TEXT,
  -- Snapshot del vehículo al momento de la venta
  marca            TEXT,
  modelo           TEXT,
  anio             INTEGER,
  placa            TEXT,
  precio_venta     NUMERIC(12,2),
  precio_compra    NUMERIC(12,2),           -- para calcular margen
  metodo_pago      TEXT,                    -- efectivo | transferencia | financiamiento | credito
  estado           TEXT DEFAULT 'completada', -- separacion | completada | anulada
  asesor           TEXT,
  fecha_venta      DATE DEFAULT CURRENT_DATE,
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.tradecars_compras (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitud_venta_id  UUID REFERENCES public.tradecars_solicitudes_venta(id) ON DELETE SET NULL,
  vehiculo_id         UUID REFERENCES public.tradecars_vehiculos(id)        ON DELETE SET NULL,
  cliente_id          UUID REFERENCES public.tradecars_clientes(id)         ON DELETE SET NULL,
  proveedor_nombre    TEXT,                 -- el dueño que nos vendió el auto
  proveedor_dni       TEXT,
  proveedor_telefono  TEXT,
  marca               TEXT,
  modelo              TEXT,
  anio                INTEGER,
  placa               TEXT,
  kilometraje         INTEGER,
  precio_tasacion     NUMERIC(12,2),
  precio_compra       NUMERIC(12,2),
  tiene_deuda         BOOLEAN DEFAULT FALSE,
  estado              TEXT DEFAULT 'completada', -- tasacion | negociacion | completada | descartada
  asesor              TEXT,
  fecha_compra        DATE DEFAULT CURRENT_DATE,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_ventas_fecha  ON public.tradecars_ventas  (fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_tc_compras_fecha ON public.tradecars_compras (fecha_compra DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 6. AGENDA / CITAS (tasación, test drive, entrega, firma)
--    `date` va como TEXT 'YYYY-MM-DD' igual que en el resto de dashboards.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_calendar_events (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT,
  tipo           TEXT DEFAULT 'tasacion',  -- tasacion | test_drive | entrega | firma | otro
  date           TEXT,                     -- 'YYYY-MM-DD'
  time           TEXT,                     -- 'HH:MM'
  client_name    TEXT,
  client_surname TEXT,
  client_phone   TEXT,
  client_email   TEXT,
  vehiculo_id    UUID REFERENCES public.tradecars_vehiculos(id) ON DELETE SET NULL,
  marca          TEXT,
  modelo         TEXT,
  placa          TEXT,
  asesor         TEXT,
  estado         TEXT DEFAULT 'pendiente', -- pendiente | confirmada | completada | cancelada
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at     TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_cal_date ON public.tradecars_calendar_events (date);


-- ══════════════════════════════════════════════════════════════════════════
-- 7. EGRESOS / GASTOS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_egresos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_egreso  TEXT,
  nombre       TEXT,
  precio       NUMERIC(12,2) DEFAULT 0,
  cantidad     INTEGER DEFAULT 1,
  categoria    TEXT,                       -- taller | publicidad | planilla | alquiler | tramites | otros
  metodo_pago  TEXT,
  referencia   TEXT,
  vehiculo_id  UUID REFERENCES public.tradecars_vehiculos(id) ON DELETE SET NULL,
  fecha        DATE DEFAULT CURRENT_DATE,
  descartado   BOOLEAN DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_egresos_fecha ON public.tradecars_egresos (fecha DESC);


-- ══════════════════════════════════════════════════════════════════════════
-- 8. RLS
--
--    IMPORTANTE: el dashboard escribe desde el NAVEGADOR con la key `anon`,
--    así que anon necesita permiso FOR ALL (no solo SELECT). Si se deja
--    "FOR SELECT TO anon", los DELETE/UPDATE del dashboard fallan EN SILENCIO
--    (PostgREST devuelve 200 con 0 filas afectadas, sin error) y parece que
--    el botón "no hace nada".
--
--    Se usa el mismo patrón que el resto del proyecto (ver gatwick_tables.sql):
--      CREATE POLICY ... TO anon USING (true) WITH CHECK (true)   -- = FOR ALL
--
--    Nota de seguridad: esto deja las tablas abiertas a cualquiera que tenga
--    la key anon (que es pública). Es la convención vigente en las 11 empresas
--    del proyecto; endurecerlo requeriría migrar todos los dashboards a
--    sesiones de Supabase Auth.
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'GeneralBDwppTRADECARS',
    'GeneralBDfbigTRADECARS',
    'tradecars_clientes',
    'tradecars_solicitudes_compra',
    'tradecars_solicitudes_venta',
    'tradecars_vehiculos',
    'tradecars_ventas',
    'tradecars_compras',
    'tradecars_calendar_events',
    'tradecars_egresos'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- service_role: acceso total (lo usa el endpoint del formulario web)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Limpia la política antigua de solo lectura si existía
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON public.%I', t, t);

    -- anon: acceso total (lo necesita el dashboard desde el navegador)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "anon_all_%s" ON public.%I TO anon USING (true) WITH CHECK (true)',
        t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════
-- 9. COMENTARIOS
-- ══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public.tradecars_clientes             IS 'CRM Trade Cars. tipo = comprador | vendedor | ambos.';
COMMENT ON TABLE public.tradecars_solicitudes_compra   IS 'Formulario web "quiero comprar un auto" (form corto). Lo llena POST /api/tradecars/formulario con tipo=compra.';
COMMENT ON TABLE public.tradecars_solicitudes_venta    IS 'Formulario web "quiero vender mi auto" (form con datos del vehículo). Lo llena POST /api/tradecars/formulario con tipo=venta.';
COMMENT ON TABLE public.tradecars_vehiculos            IS 'Inventario de autos de Trade Cars.';
COMMENT ON TABLE public.tradecars_ventas               IS 'Ventas realizadas (Trade Cars vende un auto).';
COMMENT ON TABLE public.tradecars_compras              IS 'Compras/tasaciones (Trade Cars compra un auto a un particular).';
COMMENT ON TABLE public.tradecars_calendar_events      IS 'Agenda: tasaciones, test drives, entregas y firmas.';
COMMENT ON TABLE public.tradecars_egresos              IS 'Egresos/gastos de Trade Cars.';
