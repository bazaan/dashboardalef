-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Configuración editable del Agente Tasador
--
-- Correr UNA VEZ en Supabase (SQL Editor). Es idempotente: se puede volver a
-- ejecutar sin romper nada ni pisar valores que Trade Cars ya haya ajustado
-- (los seeds usan ON CONFLICT DO NOTHING).
--
-- POR QUÉ EXISTE ESTE ARCHIVO
-- ---------------------------
-- El Agente Tasador que atiende WhatsApp vive en n8n
-- (workflow "TRADECARS | WHATSAPP | Agente Tasador", id iFeOCsDlZTxoWJmH) y su
-- prompt tiene una regla absoluta:
--
--     "NUNCA hardcodear parámetros — SIEMPRE leerlos vía Tool 1 en cada tasación"
--     "NO usar valores por defecto hardcodeados si la tool falla — retornar error"
--
-- Esa Tool 1 (obtener_configuracion, workflow FNo6fnEj51kJm38i) lee estas tres
-- tablas. Las tablas YA EXISTÍAN en la base pero estaban VACÍAS, con lo cual el
-- Tasador devolvía siempre { sin_datos: true, error: "configuracion_no_disponible" }
-- y no podía tasar nada. Este archivo las siembra y les agrega trazabilidad.
--
-- Los valores sembrados son los que el propio prompt de n8n documenta como
-- vigentes en su sección "Tool 1 — obtener_configuracion". Quedan editables
-- desde el dashboard (módulo Tasador → pestaña Parámetros) y están pendientes
-- de confirmación formal por Trade Cars vía el cuestionario de 32 preguntas.
--
-- Contenido:
--   1. Columnas de auditoría + validación en las 3 tablas de config
--   2. Seed de los 24 parámetros de tasación
--   3. Seed de reglas por marca/modelo
--   4. Seed de modelos de alta rotación
--   5. tradecars_tasador_cambios — historial de cambios y solicitudes a Alef
--   6. tradecars_tasador_importaciones — carga del histórico por Excel/PDF
--   7. RLS
-- ══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
-- 1. COLUMNAS DE AUDITORÍA Y VALIDACIÓN
--
--    Las tablas se crearon sin trazabilidad. Como acá se toca el dinero que la
--    empresa ofrece por un auto, hace falta saber quién cambió qué y cuándo.
--
--    minimo/maximo son barandas: el endpoint que aplica los cambios los usa
--    para rechazar valores absurdos (ej. un descuento por km de 500%), tanto si
--    el cambio viene de una persona como si lo propuso el chat del Tasador.
-- ──────────────────────────────────────────────────────────────────────────
-- Las 3 tablas YA TRAÍAN `actualizado_en` / `actualizado_por` de quien armó el
-- Tasador. Se usa esa convención y no se agrega una paralela en inglés: dos
-- juegos de columnas de auditoría sobre la misma tabla es la receta para que
-- dentro de seis meses nadie sepa cuál es la buena.
--
-- Si una corrida anterior de este archivo llegó a crear el juego en inglés, se
-- elimina acá. Son columnas recién creadas y sin datos propios, así que no hay
-- nada que perder; si en tu base tuvieran contenido, comentá este bloque.
ALTER TABLE public.tradecars_config_parametros_tasador
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.tradecars_config_reglas_marca_modelo
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.tradecars_config_modelos_alta_rotacion
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS updated_by;

-- Por si alguna de las tres no traía la convención en español.
ALTER TABLE public.tradecars_config_parametros_tasador
  ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS actualizado_por TEXT,
  ADD COLUMN IF NOT EXISTS minimo          NUMERIC,
  ADD COLUMN IF NOT EXISTS maximo          NUMERIC;

ALTER TABLE public.tradecars_config_reglas_marca_modelo
  ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS actualizado_por TEXT;

ALTER TABLE public.tradecars_config_modelos_alta_rotacion
  ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS actualizado_por TEXT;

-- Clave única: es lo que permite que el seed sea idempotente y que el endpoint
-- actualice por clave sin ambigüedad.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_param_clave
  ON public.tradecars_config_parametros_tasador (clave);

-- Un mismo (marca, modelo) no debería estar dos veces en alta rotación.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tc_rotacion_marca_modelo
  ON public.tradecars_config_modelos_alta_rotacion (upper(marca), upper(modelo));


-- ──────────────────────────────────────────────────────────────────────────
-- 2. PARÁMETROS DE TASACIÓN (24)
--
--    La Tool 1 los entrega al Tasador como { clave: valor }. El campo `unidad`
--    no lo consume n8n — es para que el supervisor entienda en el dashboard qué
--    está editando sin tener que leer el prompt.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.tradecars_config_parametros_tasador
  (clave, valor, unidad, categoria, descripcion, minimo, maximo, activa)
VALUES
  -- Kilometraje ------------------------------------------------------------
  ('descuento_km_pct', 1.6, '% por cada 10,000 km', 'Kilometraje',
   'Descuento (o premium, si el auto tiene menos km que el comparable) por cada 10,000 km de diferencia. Es la tasa estándar.',
   0.1, 10, TRUE),

  ('umbral_km_alto', 120000, 'km', 'Kilometraje',
   'A partir de este kilometraje el auto se castiga más fuerte: el excedente por encima de este número usa la tasa alta.',
   40000, 300000, TRUE),

  ('tasa_km_alto_pct', 11, '% por cada 10,000 km', 'Kilometraje',
   'Tasa que se aplica SOLO al kilometraje que excede el umbral alto. Muy superior a la estándar porque el auto ya entró en zona de riesgo.',
   1, 30, TRUE),

  -- Año --------------------------------------------------------------------
  ('ajuste_anio_sedan_usd', 500, 'USD por año', 'Año',
   'Cuánto vale un año de antigüedad en sedan, hatchback, station wagon y coupé. Se suma si el auto es más nuevo que el comparable y se resta si es más viejo.',
   100, 3000, TRUE),

  ('ajuste_anio_suv_usd', 1000, 'USD por año', 'Año',
   'Lo mismo que el anterior pero para SUV, camioneta, pickup y van. También es el valor por defecto cuando no se logra identificar el tipo de vehículo.',
   100, 5000, TRUE),

  -- Transmisión ------------------------------------------------------------
  ('ajuste_transmision_usd', 1000, 'USD', 'Transmisión',
   'Diferencia de precio entre mecánico y automático. AT, CVT y DCT se consideran equivalentes entre sí, así que entre ellos el ajuste es cero.',
   0, 5000, TRUE),

  -- Techo por vehículo nuevo ----------------------------------------------
  ('techo_nuevo_descuento_usd', 1000, 'USD', 'Techo 0km',
   'Cuánto se descuenta del precio del 0km para fijar el techo: un usado nunca puede cotizarse por encima de ese techo.',
   0, 10000, TRUE),

  ('km_maximo_para_techo_nuevo', 10000, 'km', 'Techo 0km',
   'Solo se consulta el precio del 0km si el auto tiene menos de estos km. Por encima, el auto ya no compite contra uno nuevo.',
   1000, 60000, TRUE),

  -- Margen -----------------------------------------------------------------
  ('umbral_ticket_alto_usd', 15000, 'USD', 'Margen',
   'Frontera entre ticket bajo y ticket alto, medida sobre el precio de venta estimado. El salto es brusco: 14,999 usa margen bajo y 15,001 usa margen alto.',
   3000, 60000, TRUE),

  ('margen_ticket_bajo_min', 1000, 'USD', 'Margen',
   'Margen mínimo en autos de ticket bajo. Se usa cuando hay alta rotación, baja rotación o rotación de capital — casos donde conviene ceder margen.',
   200, 10000, TRUE),

  ('margen_ticket_bajo_medio', 1250, 'USD', 'Margen',
   'Margen estándar en autos de ticket bajo. Es el que se usa cuando no hay ninguna condición especial de rotación.',
   200, 10000, TRUE),

  ('margen_ticket_bajo_max', 1500, 'USD', 'Margen',
   'Techo del margen en autos de ticket bajo. Referencia del rango, no se aplica automáticamente.',
   200, 10000, TRUE),

  ('margen_ticket_alto_min', 2000, 'USD', 'Margen',
   'Margen mínimo en autos de ticket alto. Se usa cuando hay alta rotación, baja rotación o rotación de capital.',
   500, 20000, TRUE),

  ('margen_ticket_alto_medio', 2500, 'USD', 'Margen',
   'Margen estándar en autos de ticket alto. Es el que se usa cuando no hay ninguna condición especial de rotación.',
   500, 20000, TRUE),

  ('margen_ticket_alto_max', 3000, 'USD', 'Margen',
   'Techo del margen en autos de ticket alto. Referencia del rango, no se aplica automáticamente.',
   500, 20000, TRUE),

  -- Rotación ---------------------------------------------------------------
  ('penalidad_baja_rotacion_pct', 15, '%', 'Rotación',
   'Castigo que se aplica al rango de venta completo cuando el modelo rota lento. Se aplica una sola vez sobre la venta; la compra sale después restando el margen.',
   0, 50, TRUE),

  ('dias_inventario_alerta', 14, 'días', 'Rotación',
   'Si algún comparable estuvo más de estos días en inventario, el modelo se marca como de baja rotación automáticamente.',
   3, 180, TRUE),

  -- Comparables ------------------------------------------------------------
  ('max_comparables', 8, 'cantidad', 'Comparables',
   'Tope de autos históricos que el Tasador usa como referencia. Si hay más, se quedan los más parecidos (versión, año, transmisión, kilometraje).',
   1, 30, TRUE),

  ('diferencia_anio_casi_identicos', 1, 'años', 'Comparables',
   'Cuántos años de diferencia se toleran para considerar que dos autos son casi idénticos.',
   0, 5, TRUE),

  ('diferencia_km_casi_identicos_km', 25000, 'km', 'Comparables',
   'Cuántos km de diferencia se toleran para considerar que dos autos son casi idénticos.',
   2000, 100000, TRUE),

  ('dispersion_ancla_pct', 15, '%', 'Comparables',
   'Si los comparables difieren entre sí más que este porcentaje, el Tasador deja de promediar y se ancla al precio más alto, asumiendo buen estado hasta que la inspección diga lo contrario.',
   1, 60, TRUE),

  -- Rango ------------------------------------------------------------------
  ('amplitud_pocos_comparables_pct', 5, '%', 'Rango',
   'Cuando hay uno o dos comparables no se puede armar un rango real, así que se abre artificialmente este porcentaje hacia arriba y hacia abajo del precio central.',
   1, 30, TRUE),

  -- Confianza --------------------------------------------------------------
  ('divergencia_metodos_pct', 15, '%', 'Confianza',
   'Umbral porcentual para avisar que el precio por histórico y el precio por techo del 0km no coinciden. Se toma el menor entre este porcentaje y el monto fijo.',
   1, 60, TRUE),

  ('divergencia_metodos_usd', 1500, 'USD', 'Confianza',
   'Umbral en dólares para el mismo aviso de divergencia. Se toma el menor entre este monto y el porcentaje.',
   100, 20000, TRUE)
ON CONFLICT (clave) DO NOTHING;


-- ── 2b. BARANDAS SOBRE LOS PARÁMETROS QUE YA EXISTÍAN ─────────────────────
--
-- Los 24 parámetros ya estaban cargados por quien armó el Tasador, así que el
-- INSERT de arriba no hizo nada (y está bien: sus valores y descripciones
-- mandan). Pero `minimo` y `maximo` son columnas nuevas y quedaron en NULL, y
-- sin ellas la validación del endpoint no rechaza nada: se podría dejar el
-- descuento por kilometraje en 5000 % y el agente de WhatsApp empezaría a
-- cotizar cualquier cosa en la siguiente conversación.
--
-- Esto rellena SÓLO las barandas, y sólo donde están vacías. No toca `valor`,
-- `descripcion`, `categoria` ni `unidad`.
UPDATE public.tradecars_config_parametros_tasador AS p
SET minimo = v.minimo, maximo = v.maximo
FROM (VALUES
  ('descuento_km_pct',                0.1,      10),
  ('umbral_km_alto',                  40000,    300000),
  ('tasa_km_alto_pct',                1,        30),
  ('ajuste_anio_sedan_usd',           100,      3000),
  ('ajuste_anio_suv_usd',             100,      5000),
  ('ajuste_transmision_usd',          0,        5000),
  ('techo_nuevo_descuento_usd',       0,        10000),
  ('km_maximo_para_techo_nuevo',      1000,     60000),
  ('umbral_ticket_alto_usd',          3000,     60000),
  ('margen_ticket_bajo_min',          200,      10000),
  ('margen_ticket_bajo_medio',        200,      10000),
  ('margen_ticket_bajo_max',          200,      10000),
  ('margen_ticket_alto_min',          500,      20000),
  ('margen_ticket_alto_medio',        500,      20000),
  ('margen_ticket_alto_max',          500,      20000),
  ('penalidad_baja_rotacion_pct',     0,        50),
  ('dias_inventario_alerta',          3,        180),
  ('max_comparables',                 1,        30),
  ('diferencia_anio_casi_identicos',  0,        5),
  ('diferencia_km_casi_identicos_km', 2000,     100000),
  ('dispersion_ancla_pct',            1,        60),
  ('amplitud_pocos_comparables_pct',  1,        30),
  ('divergencia_metodos_pct',         1,        60),
  ('divergencia_metodos_usd',         100,      20000)
) AS v(clave, minimo, maximo)
WHERE p.clave = v.clave
  AND (p.minimo IS NULL OR p.maximo IS NULL);


-- ──────────────────────────────────────────────────────────────────────────
-- 3. REGLAS POR MARCA / MODELO
--
--    marca o modelo en '*' significa "cualquiera". Se aplican en orden de
--    prioridad ascendente y, si aplican varias, se suman secuencialmente.
--
--    tipo_ajuste: resta_usd | suma_usd | resta_pct | suma_pct | flag
--    Las de tipo 'flag' no mueven el precio: activan un comportamiento del
--    prompt (hoy solo existe usar_tasa_km_generica).
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.tradecars_config_reglas_marca_modelo
  (marca, modelo, gnv_glp, anio_min, anio_max, tipo_ajuste, valor_ajuste, flag, descripcion, prioridad, activa)
-- Los NULL van casteados: en un VALUES de varias filas, una columna que es NULL
-- en todas queda sin tipo inferible y Postgres la asume TEXT, que después no
-- entra en una columna numérica.
SELECT * FROM (VALUES
  ('Subaru', '*',      'si',        2013::INTEGER, NULL::INTEGER, 'resta_usd', 500::NUMERIC, NULL::TEXT,
   'Subaru con GNV/GLP posterior a 2012: penalidad mínima de $500. Es la única marca con ajuste automático por GNV/GLP; en el resto solo se advierte para evaluar en la inspección.', 50, TRUE),

  ('Kia',    'Soluto', NULL::TEXT,  NULL::INTEGER, NULL::INTEGER, 'flag',      NULL::NUMERIC, 'usar_tasa_km_generica',
   'Kia Soluto: usar siempre la tasa genérica de kilometraje en vez de una regresión propia, porque la muestra de comparables es demasiado chica para confiar en ella.', 50, TRUE)
) AS v(marca, modelo, gnv_glp, anio_min, anio_max, tipo_ajuste, valor_ajuste, flag, descripcion, prioridad, activa)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tradecars_config_reglas_marca_modelo r
  WHERE upper(r.marca) = upper(v.marca)
    AND upper(r.modelo) = upper(v.modelo)
    AND r.tipo_ajuste = v.tipo_ajuste
);


-- ──────────────────────────────────────────────────────────────────────────
-- 4. MODELOS DE ALTA ROTACIÓN
--
--    En estos modelos el Tasador no descuenta preventivamente: mueve el precio
--    al extremo superior del rango para asegurar la compra, porque sabe que el
--    auto se vende rápido.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.tradecars_config_modelos_alta_rotacion (marca, modelo, motivo, activa)
VALUES
  ('Kia', 'Rio',    'Rotación rápida confirmada en el histórico de Trade Cars', TRUE),
  ('Kia', 'Soluto', 'Rotación rápida confirmada en el histórico de Trade Cars', TRUE)
ON CONFLICT DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────────
-- 5. HISTORIAL DE CAMBIOS Y SOLICITUDES A ALEF
--
--    Implementa el sistema de dos niveles acordado en la reunión del 26/08:
--
--      · Lo que Trade Cars puede cambiar solo (parámetros de tasación, reglas
--        por marca/modelo, alta rotación) se aplica desde el dashboard y queda
--        registrado acá con estado 'aplicado'.
--
--      · Lo que toca la lógica o el flujo de conversación del agente NO se
--        puede tocar desde la UI — se registra como 'pendiente_alef' y lo
--        implementa Alef a mano en n8n. Así el cliente nunca rompe el prompt.
--
--    Es también el log de auditoría: toda escritura sobre la config pasa por
--    acá, venga del chat del Tasador o del panel de parámetros.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tradecars_tasador_cambios (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  tipo            TEXT NOT NULL,          -- parametro | regla | alta_rotacion | solicitud_alef
  accion          TEXT NOT NULL,          -- actualizar | crear | desactivar | solicitud
  objetivo        TEXT,                   -- clave del parámetro, o "Marca/Modelo"

  valor_anterior  JSONB,                  -- NULL cuando se crea algo nuevo
  valor_nuevo     JSONB,                  -- NULL cuando se desactiva

  resumen         TEXT NOT NULL,          -- explicación en español, legible por el cliente
  motivo          TEXT,                   -- por qué lo pidió (lo que escribió el supervisor)

  estado          TEXT NOT NULL DEFAULT 'aplicado',
                                          -- aplicado | pendiente_alef | resuelto_alef | rechazado
  origen          TEXT NOT NULL DEFAULT 'chat_tasador',   -- chat_tasador | panel

  solicitado_por  TEXT,                   -- email de la sesión del dashboard
  notas_alef      TEXT,                   -- respuesta de Alef cuando se resuelve
  resuelto_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_tasador_cambios_fecha
  ON public.tradecars_tasador_cambios (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tc_tasador_cambios_pendientes
  ON public.tradecars_tasador_cambios (estado, created_at DESC)
  WHERE estado = 'pendiente_alef';

COMMENT ON TABLE public.tradecars_tasador_cambios IS
  'Historial de cambios a la configuración del Agente Tasador y solicitudes de cambio derivadas a Alef. Implementa el sistema de dos niveles de la reunión del 26/08/2026.';


-- ──────────────────────────────────────────────────────────────────────────
-- 6. CARGA DEL HISTÓRICO POR ARCHIVO (Excel / CSV / PDF)
--
--    Las dos tablas de datos del Tasador —los comparables históricos y los
--    precios de 0km— son las que hacen que pueda cotizar, y hasta ahora sólo se
--    podían llenar corriendo un script. Ahora se suben desde el dashboard.
--
--    `import_batch_id` marca cada fila con la importación que la trajo. Es lo
--    que permite deshacer una carga completa sin tocar las filas que ya
--    estaban: sin esa columna, un archivo mal mapeado obliga a limpiar la tabla
--    entera y volver a cargar todo.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_data_historico_compras_ventas
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now());

ALTER TABLE public.tradecars_data_precios_vehiculos_nuevos
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_tc_historico_batch
  ON public.tradecars_data_historico_compras_ventas (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_tc_precios_batch
  ON public.tradecars_data_precios_vehiculos_nuevos (import_batch_id);

-- El Tasador filtra los comparables por marca y modelo en memoria tras traer la
-- tabla completa, pero estos índices sirven al dashboard, que sí filtra en SQL.
CREATE INDEX IF NOT EXISTS idx_tc_historico_marca_modelo
  ON public.tradecars_data_historico_compras_ventas (upper(marca), upper(modelo));
CREATE INDEX IF NOT EXISTS idx_tc_precios_marca_modelo
  ON public.tradecars_data_precios_vehiculos_nuevos (upper(marca), upper(modelo));

CREATE TABLE IF NOT EXISTS public.tradecars_tasador_importaciones (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  destino           TEXT NOT NULL,          -- historico | precios_nuevos
  archivo_nombre    TEXT,
  archivo_tipo      TEXT,                   -- excel | csv | pdf

  filas_leidas      INTEGER DEFAULT 0,
  filas_importadas  INTEGER DEFAULT 0,
  filas_descartadas INTEGER DEFAULT 0,

  -- Con qué columna del archivo se llenó cada campo. Queda guardado porque es
  -- lo primero que hay que mirar cuando una carga sale rara.
  mapeo             JSONB,
  -- Muestra de filas rechazadas con el motivo, para poder corregir el archivo.
  descartes         JSONB,

  estado            TEXT NOT NULL DEFAULT 'aplicada',   -- aplicada | deshecha
  importado_por     TEXT,
  deshecha_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tc_importaciones_fecha
  ON public.tradecars_tasador_importaciones (created_at DESC);

COMMENT ON TABLE public.tradecars_tasador_importaciones IS
  'Cargas de datos del Tasador desde Excel/CSV/PDF. Cada fila importada queda marcada con import_batch_id para poder deshacer la carga completa.';


-- ──────────────────────────────────────────────────────────────────────────
-- 7. RLS — mismo criterio que el resto del proyecto: el dashboard lee con
--    anon y los endpoints del servidor escriben con service_role.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tradecars_config_parametros_tasador   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_config_reglas_marca_modelo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_config_modelos_alta_rotacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_tasador_cambios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradecars_tasador_importaciones       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_param_tasador" ON public.tradecars_config_parametros_tasador
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_param_tasador" ON public.tradecars_config_parametros_tasador
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_reglas_tasador" ON public.tradecars_config_reglas_marca_modelo
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_reglas_tasador" ON public.tradecars_config_reglas_marca_modelo
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_all_tc_rotacion_tasador" ON public.tradecars_config_modelos_alta_rotacion
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_rotacion_tasador" ON public.tradecars_config_modelos_alta_rotacion
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_tc_tasador_cambios" ON public.tradecars_tasador_cambios
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_tasador_cambios" ON public.tradecars_tasador_cambios
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_tc_importaciones" ON public.tradecars_tasador_importaciones
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_all_tc_importaciones" ON public.tradecars_tasador_importaciones
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- 8. VERIFICACIÓN (opcional — descomentar para comprobar tras correr)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT categoria, count(*) FROM public.tradecars_config_parametros_tasador
--   WHERE activa GROUP BY categoria ORDER BY categoria;
-- SELECT marca, modelo, tipo_ajuste, valor_ajuste, flag
--   FROM public.tradecars_config_reglas_marca_modelo WHERE activa;
-- SELECT * FROM public.tradecars_config_modelos_alta_rotacion WHERE activa;
-- SELECT count(*) AS comparables FROM public.tradecars_data_historico_compras_ventas;
-- SELECT count(*) AS precios_0km FROM public.tradecars_data_precios_vehiculos_nuevos;
