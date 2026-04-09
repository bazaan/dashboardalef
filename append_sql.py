import sys

sql_to_append = """
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
"""

with open('skip_supabase.sql', 'a', encoding='utf-8') as f:
    f.write(sql_to_append)

print("SQL appended successfully.")
