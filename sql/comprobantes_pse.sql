-- ═════════════════════════════════════════════════════════════════════
-- TABLA: comprobantes_pse
-- Historial completo de comprobantes electrónicos emitidos vía PSE.PE
-- (Factura, Boleta, Nota de Crédito, Nota de Débito)
--
-- Uso:
--   1. Ejecutar este script en el SQL Editor de Supabase (una sola vez).
--   2. El endpoint POST /api/pse/factura lo llena automáticamente.
--
-- Cubre:
--   - Datos completos del emisor (empresa / ruc / modo demo o prod)
--   - Datos completos del cliente
--   - Montos desglosados (gravada, inafecta, exonerada, gratuita, igv, descuento)
--   - Respuesta completa de SUNAT (código, descripción, hash, CDR, QR)
--   - Enlaces (pdf, xml, cdr, consulta pública)
--   - Payload original enviado + respuesta cruda (JSONB para auditoría)
-- ═════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.comprobantes_pse (
  -- ═══ Meta ═══
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emitido_por                 TEXT,                 -- email del usuario dashboard que lo emitió

  -- ═══ Emisor (empresa) ═══
  company_id                  TEXT NOT NULL,        -- clave interna: 'estasconsuerte', 'healup', ...
  ruc_emisor                  TEXT,
  razon_social_emisor         TEXT,
  demo                        BOOLEAN NOT NULL DEFAULT FALSE,

  -- ═══ Identificación del comprobante ═══
  tipo_de_comprobante         SMALLINT NOT NULL,    -- 1 Factura, 2 Boleta, 3 N.Crédito, 4 N.Débito
  serie                       TEXT NOT NULL,
  numero                      INTEGER NOT NULL,
  sunat_transaction           SMALLINT,             -- 1, 2, 4, 29-35

  -- ═══ Fechas ═══
  fecha_de_emision            DATE,
  fecha_de_vencimiento        DATE,

  -- ═══ Cliente ═══
  cliente_tipo_de_documento   TEXT,                 -- '-', '1', '6', '4', '7', 'A', 'B', '0', 'G'
  cliente_numero_de_documento TEXT,
  cliente_denominacion        TEXT,
  cliente_direccion           TEXT,
  cliente_email               TEXT,
  cliente_email_1             TEXT,
  cliente_email_2             TEXT,

  -- ═══ Moneda y totales ═══
  moneda                      SMALLINT DEFAULT 1,   -- 1 PEN, 2 USD, 3 EUR, 4 GBP
  tipo_de_cambio              NUMERIC(10,4),
  porcentaje_de_igv           NUMERIC(5,2) DEFAULT 18.00,
  total_gravada               NUMERIC(14,2) DEFAULT 0,
  total_inafecta              NUMERIC(14,2) DEFAULT 0,
  total_exonerada             NUMERIC(14,2) DEFAULT 0,
  total_gratuita              NUMERIC(14,2) DEFAULT 0,
  total_igv                   NUMERIC(14,2) DEFAULT 0,
  total_descuento             NUMERIC(14,2) DEFAULT 0,
  descuento_global            NUMERIC(14,2),
  total_anticipo              NUMERIC(14,2),
  total_impuestos_bolsas      NUMERIC(14,2),
  total                       NUMERIC(14,2) NOT NULL,

  -- ═══ Documento que se modifica (solo notas) ═══
  documento_que_se_modifica_tipo    SMALLINT,       -- 1 Factura, 2 Boleta
  documento_que_se_modifica_serie   TEXT,
  documento_que_se_modifica_numero  TEXT,
  tipo_de_nota_de_credito           SMALLINT,
  tipo_de_nota_de_debito            SMALLINT,

  -- ═══ Detracción / Percepción / Retención ═══
  detraccion                  BOOLEAN DEFAULT FALSE,
  detraccion_tipo             TEXT,
  detraccion_porcentaje       NUMERIC(5,2),
  detraccion_total            NUMERIC(14,2),
  medio_de_pago_detraccion    TEXT,

  percepcion_tipo             TEXT,
  percepcion_base_imponible   NUMERIC(14,2),
  total_percepcion            NUMERIC(14,2),
  total_incluido_percepcion   NUMERIC(14,2),

  retencion_tipo              TEXT,
  retencion_base_imponible    NUMERIC(14,2),
  total_retencion             NUMERIC(14,2),

  -- ═══ Info adicional ═══
  observaciones               TEXT,
  orden_compra_servicio       TEXT,
  condiciones_de_pago         TEXT,
  medio_de_pago               TEXT,
  placa_vehiculo              TEXT,
  codigo_unico                TEXT,
  formato_de_pdf              TEXT DEFAULT 'A4',

  -- ═══ Flags especiales ═══
  generado_por_contingencia   BOOLEAN DEFAULT FALSE,
  bienes_region_selva         BOOLEAN DEFAULT FALSE,
  servicios_region_selva      BOOLEAN DEFAULT FALSE,

  -- ═══ Respuesta SUNAT ═══
  aceptada_por_sunat          BOOLEAN DEFAULT FALSE,
  sunat_description           TEXT,
  sunat_note                  TEXT,
  sunat_responsecode          TEXT,
  sunat_soap_error            TEXT,
  codigo_hash                 TEXT,
  cadena_para_codigo_qr       TEXT,
  key_name                    TEXT,

  -- ═══ Enlaces públicos ═══
  enlace                      TEXT,                 -- Consulta pública NubeFact
  enlace_del_pdf              TEXT,
  enlace_del_xml              TEXT,
  enlace_del_cdr              TEXT,

  -- ═══ Auditoría / fuente de verdad ═══
  items                       JSONB NOT NULL DEFAULT '[]'::jsonb,
  venta_al_credito            JSONB,
  guias                       JSONB,
  payload_enviado             JSONB,                -- copia del JSON enviado a PSE
  respuesta_completa          JSONB,                -- copia cruda de lo que devolvió PSE

  -- ═══ Envíos por correo ═══
  correo_enviado_a            TEXT[],               -- historial de emails adonde se mandó
  ultimo_envio_correo         TIMESTAMPTZ,

  -- ═══ Unicidad por empresa/serie/número ═══
  CONSTRAINT comprobantes_pse_unico UNIQUE (company_id, tipo_de_comprobante, serie, numero)
);

-- ── Índices para consultas frecuentes ──
CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_company_fecha
  ON public.comprobantes_pse (company_id, fecha_de_emision DESC);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_cliente_doc
  ON public.comprobantes_pse (cliente_numero_de_documento);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_created
  ON public.comprobantes_pse (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_tipo
  ON public.comprobantes_pse (tipo_de_comprobante);

CREATE INDEX IF NOT EXISTS idx_comprobantes_pse_sunat_ok
  ON public.comprobantes_pse (aceptada_por_sunat);

-- ── Trigger para mantener updated_at ──
CREATE OR REPLACE FUNCTION public.set_updated_at_comprobantes_pse()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comprobantes_pse_updated_at ON public.comprobantes_pse;
CREATE TRIGGER trg_comprobantes_pse_updated_at
  BEFORE UPDATE ON public.comprobantes_pse
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_comprobantes_pse();

-- ═════════════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- El endpoint server escribe con la service_role_key, que omite RLS.
-- Para lecturas desde el cliente (dashboard), cada usuario debe ver
-- únicamente los comprobantes de su propia empresa.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.comprobantes_pse ENABLE ROW LEVEL SECURITY;

-- Lectura: todos los autenticados del dashboard pueden leer los comprobantes
-- de su company_id. Ajusta la condición a tu modelo de auth real.
DROP POLICY IF EXISTS "Lectura por company_id" ON public.comprobantes_pse;
CREATE POLICY "Lectura por company_id"
  ON public.comprobantes_pse
  FOR SELECT
  TO authenticated
  USING (TRUE);   -- <-- ajusta si tienes join con dashboardlogin.company_id

-- Inserción: solo desde el server (service_role). RLS bloquea a los demás.
DROP POLICY IF EXISTS "Insercion solo service_role" ON public.comprobantes_pse;
CREATE POLICY "Insercion solo service_role"
  ON public.comprobantes_pse
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Actualizacion solo service_role" ON public.comprobantes_pse;
CREATE POLICY "Actualizacion solo service_role"
  ON public.comprobantes_pse
  FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ═════════════════════════════════════════════════════════════════════
-- Ejemplo de consulta útil:
--
--   SELECT tipo_de_comprobante, serie, numero, cliente_denominacion,
--          total, fecha_de_emision, aceptada_por_sunat, enlace_del_pdf
--   FROM public.comprobantes_pse
--   WHERE company_id = 'estasconsuerte'
--   ORDER BY fecha_de_emision DESC, numero DESC
--   LIMIT 50;
-- ═════════════════════════════════════════════════════════════════════
