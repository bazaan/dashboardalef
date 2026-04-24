-- Migración: agregar columnas de anulación a comprobantes_pse
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.comprobantes_pse
  ADD COLUMN IF NOT EXISTS anulado             BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_anulacion    TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_anulacion JSONB;

CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_anulado
  ON public.comprobantes_pse (anulado)
  WHERE anulado = true;
