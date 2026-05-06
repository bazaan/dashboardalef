-- ============================================================
--  GATWICK ASCENSORES — Schema completo
--  Todas las tablas + RLS ALL ANON
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Clientes por WhatsApp (equivalente a PacientesBDwppHEALUP)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ClientesBDwppGATWICK" (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT,
    numero          TEXT,
    lead_status     TEXT,
    reason_ia_qualification TEXT,
    servicio_interes TEXT,
    fecha_agendamiento TEXT,
    empresa         TEXT,
    ruc             TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "ClientesBDwppGATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_ClientesBDwppGATWICK"
    ON "ClientesBDwppGATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 2. Clientes por Facebook/Instagram (equivalente a PacientesBDfbigHEALUP)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ClientesBDfbigGATWICK" (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT,
    instagram_handle TEXT,
    lead_status     TEXT,
    reason_ia_qualification TEXT,
    servicio_interes TEXT,
    fecha_agendamiento TEXT,
    empresa         TEXT,
    ruc             TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "ClientesBDfbigGATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_ClientesBDfbigGATWICK"
    ON "ClientesBDfbigGATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 3. Leads por WhatsApp (equivalente a GeneralBDwppHEALUP)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GeneralBDwppGATWICK" (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT,
    numero          TEXT,
    lead_status     TEXT,
    reason_ia_qualification TEXT,
    servicio_interes TEXT,
    empresa         TEXT,
    ruc             TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "GeneralBDwppGATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_GeneralBDwppGATWICK"
    ON "GeneralBDwppGATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 4. Leads por Facebook/Instagram (equivalente a GeneralBDfbigHEALUP)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GeneralBDfbigGATWICK" (
    id              BIGSERIAL PRIMARY KEY,
    nombre          TEXT,
    instagram_handle TEXT,
    lead_status     TEXT,
    reason_ia_qualification TEXT,
    servicio_interes TEXT,
    empresa         TEXT,
    ruc             TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "GeneralBDfbigGATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_GeneralBDfbigGATWICK"
    ON "GeneralBDfbigGATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 5. Eventos del calendario (citas de servicio)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_calendar_events (
    id              BIGSERIAL PRIMARY KEY,
    fecha           TEXT NOT NULL,
    hora            TEXT,
    client_name     TEXT,
    client_surname  TEXT,
    client_phone    TEXT,
    client_email    TEXT,
    client_dni      TEXT,
    empresa         TEXT,
    ruc             TEXT,
    direccion       TEXT,
    tipo_equipo     TEXT,
    descripcion     TEXT,
    tecnico_id      BIGINT,
    estado          TEXT DEFAULT 'pendiente',
    notas           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_calendar_events"
    ON gatwick_calendar_events TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 6. Catálogo de servicios (equivalente a healup_procedures)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_servicios (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    sku         TEXT,
    grupo       TEXT,
    price       NUMERIC(10,2) DEFAULT 0,
    tipo        TEXT DEFAULT 'servicio',
    descripcion TEXT,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_servicios"
    ON gatwick_servicios TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 7. Egresos / Gastos
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "egresos_GATWICK" (
    id          BIGSERIAL PRIMARY KEY,
    fecha       DATE NOT NULL,
    categoria   TEXT,
    nombre      TEXT,
    metodo_pago TEXT,
    total       NUMERIC(10,2) DEFAULT 0,
    notas       TEXT,
    deleted     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "egresos_GATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_egresos_GATWICK"
    ON "egresos_GATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 8. Meta ADS — Resumen mensual
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GATWICK_meta_resumen_mensual" (
    id              BIGSERIAL PRIMARY KEY,
    mes             TEXT NOT NULL,
    inversion       NUMERIC(12,2) DEFAULT 0,
    alcance         BIGINT DEFAULT 0,
    impresiones     BIGINT DEFAULT 0,
    clics           BIGINT DEFAULT 0,
    leads           INTEGER DEFAULT 0,
    cpl             NUMERIC(10,2) DEFAULT 0,
    ctr             NUMERIC(6,4) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mes)
);
ALTER TABLE "GATWICK_meta_resumen_mensual" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_GATWICK_meta_resumen_mensual"
    ON "GATWICK_meta_resumen_mensual" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 9. Meta ADS — Campañas
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GATWICK_meta_campanas" (
    id              BIGSERIAL PRIMARY KEY,
    mes             TEXT NOT NULL,
    nombre_campana  TEXT NOT NULL,
    inversion       NUMERIC(12,2) DEFAULT 0,
    alcance         BIGINT DEFAULT 0,
    impresiones     BIGINT DEFAULT 0,
    clics           BIGINT DEFAULT 0,
    leads           INTEGER DEFAULT 0,
    cpl             NUMERIC(10,2) DEFAULT 0,
    ctr             NUMERIC(6,4) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mes, nombre_campana)
);
ALTER TABLE "GATWICK_meta_campanas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_GATWICK_meta_campanas"
    ON "GATWICK_meta_campanas" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 10. Técnicos (flota de técnicos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_tecnicos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    apellido    TEXT,
    telefono    TEXT,
    email       TEXT,
    zona        TEXT,
    estado      TEXT DEFAULT 'disponible',   -- disponible | en_servicio | fuera_servicio
    latitud     NUMERIC(10,7),
    longitud    NUMERIC(10,7),
    especialidad TEXT,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_tecnicos"
    ON gatwick_tecnicos TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 11. Emergencias en tiempo real
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_emergencias (
    id              BIGSERIAL PRIMARY KEY,
    titulo          TEXT NOT NULL,
    descripcion     TEXT,
    direccion       TEXT,
    empresa_cliente TEXT,
    ruc_cliente     TEXT,
    telefono_contacto TEXT,
    prioridad       TEXT DEFAULT 'media',    -- critica | alta | media | baja
    estado          TEXT DEFAULT 'pendiente', -- pendiente | asignada | en_curso | resuelta
    tecnico_id      BIGINT REFERENCES gatwick_tecnicos(id),
    tipo_equipo     TEXT,
    numero_equipo   TEXT,
    piso            TEXT,
    notas           TEXT,
    resuelto_en     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_emergencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_emergencias"
    ON gatwick_emergencias TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 12. Historial de intervenciones
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_intervenciones (
    id              BIGSERIAL PRIMARY KEY,
    emergencia_id   BIGINT REFERENCES gatwick_emergencias(id),
    tecnico_id      BIGINT REFERENCES gatwick_tecnicos(id),
    empresa_cliente TEXT,
    ruc_cliente     TEXT,
    direccion       TEXT,
    tipo_equipo     TEXT,
    numero_equipo   TEXT,
    tipo_intervencion TEXT,  -- mantenimiento | reparacion | emergencia | instalacion | inspeccion
    descripcion     TEXT,
    diagnostico     TEXT,
    solucion        TEXT,
    repuestos_usados TEXT,
    costo_mano_obra NUMERIC(10,2) DEFAULT 0,
    costo_repuestos NUMERIC(10,2) DEFAULT 0,
    costo_total     NUMERIC(10,2) DEFAULT 0,
    duracion_minutos INTEGER,
    estado          TEXT DEFAULT 'en_proceso',  -- en_proceso | completada | cancelada
    fecha_inicio    TIMESTAMPTZ,
    fecha_fin       TIMESTAMPTZ,
    firma_cliente   TEXT,
    foto_antes_url  TEXT,
    foto_despues_url TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_intervenciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_intervenciones"
    ON gatwick_intervenciones TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 13. Cobranzas y comprobantes
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_cobranzas (
    id                  BIGSERIAL PRIMARY KEY,
    intervencion_id     BIGINT REFERENCES gatwick_intervenciones(id),
    empresa_cliente     TEXT,
    ruc_cliente         TEXT,
    monto               NUMERIC(10,2) NOT NULL DEFAULT 0,
    metodo_pago         TEXT,   -- efectivo | transferencia | cheque | tarjeta
    estado_pago         TEXT DEFAULT 'pendiente',  -- pendiente | pagado | vencido | anulado
    fecha_vencimiento   DATE,
    fecha_pago          DATE,
    numero_comprobante  TEXT,
    serie_comprobante   TEXT,
    tipo_comprobante    TEXT,   -- boleta | factura
    comprobante_pse_id  BIGINT,
    notas               TEXT,
    enviado_whatsapp    BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_cobranzas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_cobranzas"
    ON gatwick_cobranzas TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 14. Reportes (transcripciones IA de técnicos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_reportes (
    id              BIGSERIAL PRIMARY KEY,
    tecnico_id      BIGINT REFERENCES gatwick_tecnicos(id),
    intervencion_id BIGINT REFERENCES gatwick_intervenciones(id),
    titulo          TEXT,
    transcripcion   TEXT,
    resumen_ia      TEXT,
    tipo            TEXT DEFAULT 'campo',   -- campo | inspeccion | mantenimiento
    audio_url       TEXT,
    procesado       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_reportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_reportes"
    ON gatwick_reportes TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 15. Horarios de trabajo de técnicos
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gatwick_horarios (
    id          BIGSERIAL PRIMARY KEY,
    tecnico_id  BIGINT REFERENCES gatwick_tecnicos(id),
    dia_semana  INTEGER,    -- 0=domingo … 6=sábado
    hora_inicio TEXT,
    hora_fin    TEXT,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gatwick_horarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_gatwick_horarios"
    ON gatwick_horarios TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 16. Métricas mensuales KPI
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "metricas_GATWICK" (
    id                      BIGSERIAL PRIMARY KEY,
    mes                     TEXT NOT NULL UNIQUE,
    emergencias_totales      INTEGER DEFAULT 0,
    emergencias_resueltas    INTEGER DEFAULT 0,
    tiempo_respuesta_prom    NUMERIC(6,2) DEFAULT 0,
    intervenciones_totales   INTEGER DEFAULT 0,
    clientes_nuevos          INTEGER DEFAULT 0,
    ingresos_totales         NUMERIC(12,2) DEFAULT 0,
    egresos_totales          NUMERIC(12,2) DEFAULT 0,
    tecnicos_activos         INTEGER DEFAULT 0,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE "metricas_GATWICK" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_metricas_GATWICK"
    ON "metricas_GATWICK" TO anon
    USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- Datos de prueba — técnicos iniciales
-- ----------------------------------------------------------------
INSERT INTO gatwick_tecnicos (nombre, apellido, telefono, zona, estado, especialidad)
VALUES
    ('Carlos',  'Mendoza', '987654321', 'Lima Norte',    'disponible',   'Ascensores hidráulicos'),
    ('Luis',    'Torres',  '976543210', 'Lima Centro',   'disponible',   'Ascensores eléctricos'),
    ('Miguel',  'Ríos',    '965432109', 'Lima Sur',      'disponible',   'Escaleras mecánicas'),
    ('Roberto', 'Vargas',  '954321098', 'Lima Este',     'fuera_servicio','Mantenimiento preventivo')
ON CONFLICT DO NOTHING;
