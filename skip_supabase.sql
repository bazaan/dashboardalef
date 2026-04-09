-- Supabase SQL Schema for SKIP Dashboard

-- ============================================================================
-- 1. Ventas: Salto Tandem
-- Reemplaza a ventas_motorizado
-- ============================================================================
CREATE TABLE public.skip_salto_tandem (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombre_completo TEXT,
    dni_pasaporte_ce TEXT,
    peso_kg NUMERIC,
    estatura_cm NUMERIC,
    nacionalidad TEXT,
    tipo_servicio TEXT,
    edad INTEGER,
    numero TEXT,
    correo TEXT,
    camarografo_externo BOOLEAN DEFAULT false,
    talla_camisa TEXT,
    talla_pantalon TEXT
);

-- ============================================================================
-- 2. Ventas: Curso Paracaidismo
-- Reemplaza a ventas_currier
-- ============================================================================
CREATE TABLE public.skip_curso_paracaidismo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombre_completo TEXT,
    dni_pasaporte_ce TEXT,
    peso_kg NUMERIC,
    estatura_cm NUMERIC,
    nacionalidad TEXT,
    tipo_servicio TEXT,
    edad INTEGER,
    numero TEXT,
    correo TEXT,
    camarografo_externo BOOLEAN DEFAULT false,
    talla_camisa TEXT,
    talla_pantalon TEXT
);

-- ============================================================================
-- 3. Ventas: Curso Acelerado
-- Reemplaza a recojo_en_tienda
-- ============================================================================
CREATE TABLE public.skip_curso_acelerado (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombre_completo TEXT,
    dni_pasaporte_ce TEXT,
    peso_kg NUMERIC,
    estatura_cm NUMERIC,
    nacionalidad TEXT,
    tipo_servicio TEXT,
    edad INTEGER,
    numero TEXT,
    correo TEXT,
    camarografo_externo BOOLEAN DEFAULT false,
    talla_camisa TEXT,
    talla_pantalon TEXT
);

-- ============================================================================
-- 4. Servicios (Catálogo)
-- Reemplaza a la lógica de "Stock"
-- ============================================================================
CREATE TABLE public.skip_servicios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    servicio TEXT NOT NULL,
    precio NUMERIC NOT NULL,
    descripcion TEXT, -- Opcional para hacerlo mas estético en la UI
    color TEXT DEFAULT '#3b82f6', -- Para customizar el color de la UI de servicios
    icono TEXT DEFAULT 'mdi-parachute' -- Para customizar el icono de este servicio
);

-- Habilitar RLS (Row Level Security) para estas tablas si es necesario.
-- Por simplicidad puedes dejarlas abiertas para inserciones en la configuración inicial.
ALTER TABLE public.skip_salto_tandem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_curso_paracaidismo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_curso_acelerado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_servicios ENABLE ROW LEVEL SECURITY;

-- Creación de políticas que permiten a public ver e insertar
CREATE POLICY "Permitir todo a anon salto_tandem" ON public.skip_salto_tandem FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon curso_paracaidismo" ON public.skip_curso_paracaidismo FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon curso_acelerado" ON public.skip_curso_acelerado FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon servicios" ON public.skip_servicios FOR ALL USING (true);

-- ============================================================================
-- 5. (Opcional) Data de prueba para Servicios
-- ============================================================================
INSERT INTO public.skip_servicios (servicio, precio, descripcion, color, icono) VALUES 
('Salto VIP', 1200, 'Salto tándem con fotos y video dedicado', '#6366f1', 'mdi-parachute'),
('Salto Básico', 800, 'El salto tradicional, siente la adrenalina', '#3b82f6', 'mdi-parachute-outline'),
('Curso Introductorio', 1500, 'Tus primeros pasos como paracaidista', '#10b981', 'mdi-book-education'),
('Alquiler de Equipo', 150, 'Todo el equipo que precisas', '#f59e0b', 'mdi-bag-personal');

-- ============================================================================
-- 6. Reservas
-- Reemplaza a reserva_recojo_tienda
-- ============================================================================
CREATE TABLE public.skip_reservas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombre TEXT,
    fecha DATE,
    hora TEXT,
    estado TEXT
);

-- ============================================================================
-- 7. Procedimientos
-- Reemplaza a brada_procedures
-- ============================================================================
CREATE TABLE public.skip_procedimientos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nombre TEXT,
    precio NUMERIC,
    descripcion TEXT
);

-- ============================================================================
-- 8. Eventos de Calendario
-- Reemplaza a ORIGITEC_calendar_events
-- ============================================================================
CREATE TABLE public.skip_calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT,
    "start" TIMESTAMP WITH TIME ZONE,
    "end" TIMESTAMP WITH TIME ZONE,
    color TEXT,
    details TEXT
);

-- ============================================================================
-- 9. Egresos
-- Reemplaza a egresos_origitec / egresos_skip
-- ============================================================================
CREATE TABLE public.skip_egresos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    descripcion TEXT,
    monto NUMERIC,
    fecha DATE,
    categoria TEXT
);

-- ============================================================================
-- 10. Historial de Clientes
-- Reemplaza a brada_client_history
-- ============================================================================
CREATE TABLE public.skip_client_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_id UUID,
    notas TEXT,
    fecha_interaccion DATE
);

-- Habilitar RLS
ALTER TABLE public.skip_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_procedimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_client_history ENABLE ROW LEVEL SECURITY;

-- Creación de políticas
CREATE POLICY "Permitir todo a anon skip_reservas" ON public.skip_reservas FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon skip_procedimientos" ON public.skip_procedimientos FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon skip_calendar_events" ON public.skip_calendar_events FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon skip_egresos" ON public.skip_egresos FOR ALL USING (true);
CREATE POLICY "Permitir todo a anon skip_client_history" ON public.skip_client_history FOR ALL USING (true);
