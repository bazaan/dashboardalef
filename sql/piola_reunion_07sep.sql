-- ═══════════════════════════════════════════════════════════════════════════
--  PIOLA — Migración de la reunión del 07/09/2026
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Correr UNA vez sobre la base que ya tiene `sql/piola.sql` y
--  `sql/piola_reunion_31ago.sql` aplicados. Es idempotente.
--
--  Implementa SOLO lo que Piola pidió o aceptó en esa reunión:
--
--   1. Comisión: 8 % lead cerrado / 4 % lead recomendado.        [00:30:15]
--      Héctor: "habría que diferenciar no más porque no hay forma de
--      diferenciar ese por WhatsApp" → clasificación manual por lead.
--   2. Cliente: estado de detracción pagada + fechas de inicio/fin de
--      contrato.                                                [00:21:45]
--   3. Cliente: enlace fijo de Dropbox/Drive para que el cliente suba
--      contenido directamente.                                  [00:41:12]
--   4. Adjuntos de cliente/contrato: tope de 5 documentos (código, no SQL).
--                                                                [00:31:15]
--   5. Etapas de producción reales (Sebastián): Guiones → Producción →
--      Grabación → Edición → Presentación → Diseño Gráfico.     [00:37:32]
--   6. CRM restringido a Héctor, Edson y Raysa — nadie más lo ve en vivo.
--                                                                [00:15:54]
--   7. Mensaje de bienvenida automático de WhatsApp, editable sin
--      redeploy (Héctor todavía no mandó el texto final).       [00:17:58]
--
--  NO incluye: SUNAT, dashboard propio de Sebastián (lo define él la semana
--  que viene), roles/permisos granulares (reunión interna pendiente), ni la
--  reconciliación con feat/mobile-adaptation (coordinar con la otra sesión
--  antes de tocar esas tablas).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. COMISIONES — 8 % cerrado / 4 % recomendado
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "8 % por leitad cerrado y gestionado, etcétera, y 4 % si es
--    recomendado". Sin esto en `piola_leads`, comisiones.post.ts no puede
--    saber qué tasa aplicar a cada lead ganado — el bot de WhatsApp no puede
--    distinguirlo solo, así que se clasifica a mano al marcar el lead ganado.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_leads
  ADD COLUMN IF NOT EXISTS tipo_comision TEXT
    CHECK (tipo_comision IN ('cerrado', 'recomendado'));

COMMENT ON COLUMN public.piola_leads.tipo_comision IS
  'Reunión 07/09/2026 (00:30:15). Cerrado=8%, recomendado=4%. Se clasifica a mano al marcar el lead ganado: el bot de WhatsApp no distingue el origen.';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. CLIENTE — detracción pagada, fechas de contrato, carpeta compartida
-- ───────────────────────────────────────────────────────────────────────────
--    Edson: "una condición que diga que si la detracción... está pagada o
--    no, nada más" + "la detracción sí debemos llevar un control de eso mes
--    a mes" → se guarda cuándo se marcó, no un histórico aparte (no se pidió).
--    Héctor: "podías también añadir lo que es inicio de contrato... fin de
--    contrato" — en la FICHA del cliente (piola_contratos ya tiene sus
--    propias fechas por contrato; esto es aparte, a nivel marca).
--    Roberto/Edson (00:41:12): el link de Dropbox va fijo en la ficha del
--    cliente ("simplemente poner el link de la carpeta directa").
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_clientes
  ADD COLUMN IF NOT EXISTS detraccion_pagada        BOOLEAN,
  ADD COLUMN IF NOT EXISTS detraccion_actualizada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_inicio_contrato    DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin_contrato       DATE,
  ADD COLUMN IF NOT EXISTS dropbox_url              TEXT;

COMMENT ON COLUMN public.piola_clientes.detraccion_pagada IS
  'Reunión 07/09/2026 (00:21:45). Null = sin marcar todavía. Se revisa mes a mes; ver detraccion_actualizada_at para saber cuándo se marcó por última vez.';
COMMENT ON COLUMN public.piola_clientes.dropbox_url IS
  'Reunión 07/09/2026 (00:41:12). Enlace fijo a la carpeta compartida donde el cliente sube su contenido. Solo el link — sin integración con la API de Dropbox (quedó como investigación de Roberto, no como compromiso).';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. ETAPAS DE PRODUCCIÓN (Sebastián Ávalos, 00:37:32)
-- ───────────────────────────────────────────────────────────────────────────
--    "Empieza primero desde el área de guiones... De ahí va a pasar al área
--    de producción... vamos a ir al área de grabación... pasaríamos a lo que
--    es la etapa de edición... presentación de piezas gráficas... ahora
--    también creo que faltaría acá un área de diseño gráfico".
--
--    Es DISTINTA de `piola_areas` (Dirección/Comercial/Producción/
--    Administración): esa es el área/departamento del colaborador en la
--    empresa; esta es la etapa del PIPELINE de un entregable. Meter estas 6
--    filas en `piola_areas` mezclaría "departamento" con "etapa de trabajo"
--    en colaboradores, centros de costo y presupuestos, que la reutilizan.
--    `piola_deliverables.area_id` (→ piola_areas) queda igual que hoy.
--
--    `piola_produccion_areas` YA EXISTE — la creó la otra sesión que
--    reconcilia `feat/mobile-adaptation`, sembrada con un guess PRE-reunión
--    ('produccion','guiones','rodajes','diseno','edicion','community') que
--    la reunión del 07/09 corrigió explícitamente (Sebastián no mencionó
--    "rodajes" ni "community" como etapas, y sí pidió "grabación",
--    "presentación" y "diseño gráfico" que no estaban). No se renombran ni
--    desactivan esas 3 filas viejas — es la tabla de la otra sesión y nada
--    todavía usa `area_produccion_id` (columna nueva, sin filas que la
--    referencien) — sólo se AGREGAN las que faltan. El dropdown en
--    `PiolaProduccion.vue` filtra por los 6 códigos exactos que confirmó
--    Sebastián, así que las filas viejas no aparecen aunque sigan en la
--    tabla. Esto queda para que la reconciliación de la otra sesión lo
--    limpie cuando le toque, no es un cierre definitivo del catálogo.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_produccion_areas (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo  TEXT NOT NULL UNIQUE,
  nombre  TEXT NOT NULL,
  orden   INT NOT NULL DEFAULT 0,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE public.piola_produccion_areas IS
  'Etapas del pipeline de producción confirmadas por Sebastián Ávalos, reunión 07/09/2026 (00:37:32). Orden = orden real del flujo, de guiones a diseño gráfico.';

-- Sólo agrega las 3 que de verdad faltan ('guiones'/'produccion'/'edicion' ya
-- existen de la siembra vieja y se reusan tal cual — mismo concepto, mismo
-- código). El orden se acomoda alrededor de los existentes (produccion=1,
-- guiones=2, edicion=5) para que el filtro de 6 códigos salga ordenado.
INSERT INTO public.piola_produccion_areas (codigo, nombre, orden)
SELECT v.codigo, v.nombre, v.orden
FROM (VALUES
  ('grabacion',     'Grabación',       3),
  ('presentacion',  'Presentación',    6),
  ('diseno_grafico','Diseño Gráfico',  7)
) AS v(codigo, nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.piola_produccion_areas a WHERE a.codigo = v.codigo);

ALTER TABLE public.piola_deliverables
  ADD COLUMN IF NOT EXISTS area_produccion_id BIGINT
    REFERENCES public.piola_produccion_areas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.piola_deliverables.area_produccion_id IS
  'Etapa del pipeline (guiones→…→diseño gráfico). Distinto de area_id, que es el área/departamento genérico de la empresa.';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. ACCESO POR PERSONA A UN MÓDULO (CRM restringido, 00:15:54)
-- ───────────────────────────────────────────────────────────────────────────
--    Raysa: "las únicas personas que deberían tener acceso sería Héctor
--    Córdoba, Edson Polo y yo. Solo nosotros tres podríamos ver en tiempo
--    real esto, ¿no? El resto no."
--
--    `piola_modulo_acceso` YA EXISTE — lo creó la otra sesión que está
--    reconciliando `feat/mobile-adaptation` contra esta misma base (con una
--    fila `grupo='finanzas'` para el candado de Contabilidad/Facturación del
--    31/08). Su forma real es `(grupo TEXT, modulos TEXT[], emails TEXT[],
--    descripcion, activo, updated_by, updated_at)`, NO `(modulo, email)` como
--    se había asumido acá antes de correr esto la primera vez — asumirlo sin
--    verificar en vivo fue el mismo error que ya pasó con `piola_tipos_
--    contenido.clave` (ver CLAUDE.md). Sólo se AGREGA una fila para 'crm';
--    no se toca la fila 'finanzas' de la otra sesión.
--
--    Grupo sin fila = sin restricción adicional. Con fila, sólo los `emails`
--    de esa fila entran a los `modulos` que lista (Administrador de Piola /
--    superadmin de Alef igual pasan, como en el resto del proyecto — ver
--    `esAdmin` en server/utils/piola.ts). El código sólo aplica esto para
--    grupos que reconoce explícitamente (hoy: 'crm'), para no activar sin
--    querer el candado de 'finanzas' de la otra sesión con datos que no son
--    nuestros — ver `GRUPOS_ACCESO_RECONOCIDOS` en server/utils/piola.ts.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.piola_modulo_acceso (grupo, modulos, emails, descripcion)
SELECT 'crm', ARRAY['crm'],
  ARRAY['contacto@agenciapiola.com', 'administracion@agenciapiola.com', 'raysa@agenciapiola.com'],
  'Reunión 07/09/2026 (00:15:54): CRM en vivo solo para Héctor Córdova, Edson Polo y Raysa Cucho.'
WHERE NOT EXISTS (SELECT 1 FROM public.piola_modulo_acceso WHERE grupo = 'crm');


-- ───────────────────────────────────────────────────────────────────────────
-- 5. MENSAJE DE BIENVENIDA AUTOMÁTICO DE WHATSAPP (00:17:58)
-- ───────────────────────────────────────────────────────────────────────────
--    Héctor: "¿Es posible de dar una respuesta automática al primer
--    mensaje?... que sea automático, nada más" — para capturar el nombre
--    del cliente antes de seguir la conversación.
--    Pendiente de la reunión: "Enviar el formato y contenido deseado para
--    el mensaje automático" — Héctor todavía no mandó el texto final, así
--    que se siembra con SU PROPIO ejemplo dado en la reunión y queda
--    editable desde el dashboard (Configuración) sin necesitar redeploy.
--    El disparo real vive en n8n/Chatwoot (fuera de este repo): esta tabla
--    sólo guarda el texto para que n8n lo pida en vez de tenerlo hardcodeado.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.piola_mensajes (
  clave           TEXT PRIMARY KEY,
  contenido       TEXT NOT NULL,
  actualizado_por TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.piola_mensajes IS
  'Textos editables desde el dashboard que consume n8n/Chatwoot por API en vez de tenerlos hardcodeados en el workflow.';

INSERT INTO public.piola_mensajes (clave, contenido)
SELECT 'bienvenida_whatsapp',
  'Hola, ¿cómo estás? Soy Héctor Córdoba, coordinador comercial de Piola. ¿Con quién tengo el gusto?'
WHERE NOT EXISTS (SELECT 1 FROM public.piola_mensajes WHERE clave = 'bienvenida_whatsapp');


-- ───────────────────────────────────────────────────────────────────────────
-- 6. RLS — mismo patrón que el resto de Piola
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.piola_produccion_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_modulo_acceso    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piola_mensajes         ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_produccion_areas' AND policyname='anon_read_piola_produccion_areas') THEN
    CREATE POLICY "anon_read_piola_produccion_areas" ON public.piola_produccion_areas
      FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_produccion_areas' AND policyname='service_all_piola_produccion_areas') THEN
    CREATE POLICY "service_all_piola_produccion_areas" ON public.piola_produccion_areas
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  -- Sin policy de lectura para anon: quién entra a qué módulo no debe ser
  -- legible desde el navegador con la key pública, igual que piola_payslips.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_modulo_acceso' AND policyname='service_all_piola_modulo_acceso') THEN
    CREATE POLICY "service_all_piola_modulo_acceso" ON public.piola_modulo_acceso
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_mensajes' AND policyname='anon_read_piola_mensajes') THEN
    CREATE POLICY "anon_read_piola_mensajes" ON public.piola_mensajes
      FOR SELECT TO anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='piola_mensajes' AND policyname='service_all_piola_mensajes') THEN
    CREATE POLICY "service_all_piola_mensajes" ON public.piola_mensajes
      FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;
