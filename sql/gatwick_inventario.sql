-- ============================================================================
-- GATWICK ELEVADORES — MVP SISTEMA DE INVENTARIO
-- Script consolidado: correr UNA sola vez en Supabase → SQL Editor.
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE). Seguro de re-ejecutar.
--
-- NOTA: la tabla `gatwick_intervenciones` YA EXISTE en el dashboard de Gatwick
-- y es la que cumple el rol de "informe técnico". El módulo de Costos por
-- intervención cruza `informe_materiales.numero_informe` contra el id de esa
-- tabla. Aquí NO se recrea.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 · Componentes (insumos / repuestos del inventario)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,

  -- Clasificación
  categoria TEXT NOT NULL,           -- Cable, Polea, Contacto, Sensor, Fluido, etc.
  unidad TEXT NOT NULL,              -- Metro, Pieza, Kg, Litro

  -- Precios
  precio_unitario DECIMAL(10,2) NOT NULL,
  moneda TEXT DEFAULT 'PEN',

  -- Stock
  stock_actual INT DEFAULT 0,
  stock_minimo INT NOT NULL,
  stock_maximo INT NOT NULL,

  -- Proveedor
  proveedor TEXT,
  fecha_ultima_compra DATE,

  -- Ubicación
  ubicacion_almacen TEXT,            -- Estante A-5, Bodega 1, etc.

  -- Control
  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,

  -- Auditoría
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT stock_coherente CHECK (stock_minimo < stock_maximo)
);

CREATE INDEX IF NOT EXISTS idx_componentes_codigo    ON componentes(codigo);
CREATE INDEX IF NOT EXISTS idx_componentes_categoria ON componentes(categoria);
CREATE INDEX IF NOT EXISTS idx_componentes_activo    ON componentes(activo);
CREATE INDEX IF NOT EXISTS idx_componentes_stock_bajo ON componentes(stock_actual)
  WHERE stock_actual <= stock_minimo;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 · Recetas (fabricación / reparación / mantenimiento)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,

  tipo TEXT NOT NULL,                          -- fabricacion, reparacion, mantenimiento

  tiempo_fabricacion_minutos INT,              -- Tiempo estimado en minutos
  margen_sugerido DECIMAL(5,2) DEFAULT 40.00,  -- % de margen de ganancia

  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recetas_codigo ON recetas(codigo);
CREATE INDEX IF NOT EXISTS idx_recetas_tipo   ON recetas(tipo);
CREATE INDEX IF NOT EXISTS idx_recetas_activo ON recetas(activo);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 · Detalle de receta (componentes que la conforman)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recetas_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  receta_id     UUID NOT NULL REFERENCES recetas(id)     ON DELETE CASCADE,
  componente_id UUID NOT NULL REFERENCES componentes(id) ON DELETE RESTRICT,

  cantidad DECIMAL(10,2) NOT NULL,

  -- Precio capturado al momento (snapshot histórico)
  precio_unitario_en_receta DECIMAL(10,2),

  -- Campo calculado
  costo_subtotal DECIMAL(12,2) GENERATED ALWAYS AS
    (cantidad * precio_unitario_en_receta) STORED,

  orden INT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT cantidad_positiva CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_recetas_detalle_receta     ON recetas_detalle(receta_id);
CREATE INDEX IF NOT EXISTS idx_recetas_detalle_componente ON recetas_detalle(componente_id);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4 · Movimientos de inventario (entrada / salida / ajuste / devolución)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  componente_id UUID NOT NULL REFERENCES componentes(id),

  tipo_movimiento TEXT NOT NULL,     -- entrada, salida, ajuste, devolucion
  cantidad INT NOT NULL,

  -- Stock capturado en el momento
  stock_anterior INT,
  stock_nuevo INT,

  motivo TEXT,
  costo_unitario DECIMAL(10,2),
  costo_total DECIMAL(12,2),

  -- Referencias
  numero_informe TEXT,               -- id del informe técnico / intervención asociada
  numero_receta TEXT,                -- código de receta usada
  numero_compra TEXT,                -- N° de OC o factura
  proveedor TEXT,

  usuario_registra TEXT NOT NULL,

  fecha_movimiento TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT cantidad_movimiento CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_mov_componente ON movimientos_inventario(componente_id);
CREATE INDEX IF NOT EXISTS idx_mov_tipo       ON movimientos_inventario(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_mov_fecha      ON movimientos_inventario(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_mov_informe    ON movimientos_inventario(numero_informe);
CREATE INDEX IF NOT EXISTS idx_mov_receta     ON movimientos_inventario(numero_receta);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5 · Materias primas (control de producción — opcional)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,

  categoria TEXT NOT NULL,           -- Acero, Aluminio, Plástico, Cobre, etc.

  cantidad_disponible DECIMAL(10,2),
  unidad TEXT NOT NULL,              -- Kg, Metro, Litro, m²

  costo_por_unidad DECIMAL(10,2),
  moneda TEXT DEFAULT 'PEN',

  proveedor TEXT,
  fecha_ultima_compra DATE,

  stock_minimo DECIMAL(10,2),
  activo BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materias_categoria ON materias_primas(categoria);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6 · Materiales usados en un informe técnico / intervención
--           (numero_informe = id de gatwick_intervenciones)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS informe_materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  numero_informe TEXT NOT NULL,      -- referencia a gatwick_intervenciones.id
  componente_id UUID NOT NULL REFERENCES componentes(id),

  cantidad_usada DECIMAL(10,2) NOT NULL,

  precio_unitario DECIMAL(10,2),
  costo_total DECIMAL(12,2) GENERATED ALWAYS AS
    (cantidad_usada * precio_unitario) STORED,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT cantidad_positiva CHECK (cantidad_usada > 0)
);

CREATE INDEX IF NOT EXISTS idx_informe_mat_numero     ON informe_materiales(numero_informe);
CREATE INDEX IF NOT EXISTS idx_informe_mat_componente ON informe_materiales(componente_id);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 7 · VIEW · Recetas valorizadas
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW recetas_valorizadas AS
SELECT
  r.id,
  r.codigo,
  r.nombre,
  r.tipo,
  r.margen_sugerido,
  COALESCE(SUM(rd.costo_subtotal), 0)                                   AS costo_total_materiales,
  COALESCE(SUM(rd.costo_subtotal), 0) * (1 + r.margen_sugerido/100)     AS precio_venta_sugerido,
  COUNT(rd.id)                                                         AS cantidad_componentes,
  r.activo,
  r.created_at
FROM recetas r
LEFT JOIN recetas_detalle rd ON r.id = rd.receta_id
WHERE r.activo = TRUE
GROUP BY r.id, r.codigo, r.nombre, r.tipo, r.margen_sugerido, r.activo, r.created_at
ORDER BY r.nombre;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 8 · VIEW · Componentes en alerta
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW componentes_en_alerta AS
SELECT
  id, codigo, nombre, categoria,
  stock_actual, stock_minimo, stock_maximo,
  precio_unitario, ubicacion_almacen, proveedor,
  CASE
    WHEN stock_actual <= stock_minimo        THEN 'CRÍTICO'
    WHEN stock_actual <= (stock_minimo * 1.5) THEN 'BAJO'
    ELSE 'NORMAL'
  END AS nivel_alerta,
  (stock_minimo - stock_actual) AS cantidad_faltante
FROM componentes
WHERE activo = TRUE AND stock_actual <= (stock_minimo * 1.5)
ORDER BY stock_actual ASC;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 9 · VIEW · Movimientos recientes (últimos 30 días)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW movimientos_recientes_30_dias AS
SELECT
  m.id,
  m.fecha_movimiento,
  c.codigo  AS componente_codigo,
  c.nombre  AS componente_nombre,
  m.tipo_movimiento,
  m.cantidad,
  m.stock_anterior,
  m.stock_nuevo,
  m.motivo,
  m.costo_total,
  m.numero_informe,
  m.usuario_registra
FROM movimientos_inventario m
JOIN componentes c ON m.componente_id = c.id
WHERE m.fecha_movimiento >= NOW() - INTERVAL '30 days'
ORDER BY m.fecha_movimiento DESC;

-- ============================================================================
-- FIN — el dashboard usa la SUPABASE_KEY service_role, por lo que no se
-- requieren políticas RLS para que el frontend acceda a estas tablas.
-- ============================================================================
