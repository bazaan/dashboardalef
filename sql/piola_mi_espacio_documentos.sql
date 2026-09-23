-- ══════════════════════════════════════════════════════════════════════════
-- PIOLA — Mi Espacio: "Mis recibos por honorarios" y "Mis contratos"
--
-- Correr UNA vez en el SQL Editor de Supabase, ANTES de subir el código a main.
-- Es idempotente: se puede volver a correr sin duplicar ni pisar nada.
--
-- Los PDF no necesitan tabla nueva. Se guardan en `piola_colaborador_documentos`
-- (la misma del expediente de RR. HH.), con estos dos tipos nuevos en `tipo`:
--     'recibo_honorarios'   →  Mis recibos por honorarios
--     'contrato'            →  Mis contratos            (ya existía como tipo)
-- y el archivo va al bucket `piola-docs` (el mismo de los contratos y adendas).
-- Lo único que la tabla no tenía es el MES al que corresponde cada recibo, y
-- sin eso RR. HH. no puede saber a quién le falta el recibo de este mes.
--
-- No se agrega un monto a propósito: esta tabla se lee con la key pública (igual
-- que el resto del expediente) y un importe es un dato de remuneración.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Mes que cubre el recibo ('2026-09'). Solo aplica a los recibos por honorarios.
ALTER TABLE public.piola_colaborador_documentos
  ADD COLUMN IF NOT EXISTS periodo TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'piola_colab_docs_periodo_chk'
  ) THEN
    ALTER TABLE public.piola_colaborador_documentos
      ADD CONSTRAINT piola_colab_docs_periodo_chk
      CHECK (periodo IS NULL OR periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;

COMMENT ON COLUMN public.piola_colaborador_documentos.periodo IS
  'Mes que cubre un recibo por honorarios (AAAA-MM). NULL en los demás tipos.';
COMMENT ON COLUMN public.piola_colaborador_documentos.tipo IS
  'dni | cv | contrato | adenda | recibo_honorarios | certificado | otro';

-- 2. Índices: "qué recibos / contratos tiene esta persona" y "quién entregó el recibo de este mes"
CREATE INDEX IF NOT EXISTS idx_piola_colab_docs_tipo
  ON public.piola_colaborador_documentos (colaborador_id, tipo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_piola_colab_docs_periodo
  ON public.piola_colaborador_documentos (periodo)
  WHERE tipo = 'recibo_honorarios';

-- Verificación rápida (opcional): debe devolver la columna `periodo` de tipo text
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'piola_colaborador_documentos' AND column_name = 'periodo';
