-- Tabla para reuniones internas y comerciales de Alef Company
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS alef_meetings (
  id          bigserial PRIMARY KEY,
  date        date         NOT NULL,
  time        time         NOT NULL,
  subject     text         NOT NULL,
  description text,
  tipo        text         NOT NULL DEFAULT 'equipo',  -- equipo | comercial | cliente | otro
  participantes text,
  direccion   text,
  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now()
);

-- Index para consultas por fecha
CREATE INDEX IF NOT EXISTS idx_alef_meetings_date ON alef_meetings (date);

-- RLS
ALTER TABLE alef_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura autenticados" ON alef_meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escritura autenticados" ON alef_meetings
  FOR ALL TO authenticated USING (true);

-- Migración: agregar campo direccion (ejecutar si la tabla ya existe)
ALTER TABLE alef_meetings ADD COLUMN IF NOT EXISTS direccion text;
