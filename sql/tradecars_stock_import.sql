-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Importa el stock comercial real (14/09/2026)
--
-- Fuente: hoja "STOCK COMERCIAL" de "OP TDC 2024 - Jean Marcos Silvera
-- Pantoja.xlsx". 25 vehiculos reales (el resto de filas de esa hoja estaban
-- vacias o eran un encabezado repetido a la mitad del rango, se descartaron).
--
-- OJO — el historico de VENTAS de ese mismo Excel YA ESTA CARGADO: la tabla
-- tradecars_data_historico_compras_ventas ya tiene 1.305 filas que calzan
-- exacto con la hoja "VENTAS" (misma primera fila, misma ultima fila, mismo
-- rango de fechas 24/09/2022 al 11/07/2026) — se importo en una sesion
-- anterior via la pestaña "Datos" del Tasador. No se vuelve a tocar acá para
-- no duplicar ese comparador de precios que ya usa el Tasador IA.
--
-- Es idempotente: se puede correr las veces que haga falta (UPSERT por
-- `placa`, que ahora es UNIQUE).
-- ══════════════════════════════════════════════════════════════════════════

-- Columnas nuevas para no perder datos reales del Excel que el esquema base
-- de tradecars_vehiculos no tenia (tipo de carroceria, quien lo compro,
-- vencimiento de documentos, ubicacion fisica).
ALTER TABLE public.tradecars_vehiculos
  ADD COLUMN IF NOT EXISTS tipo_vehiculo  TEXT,   -- SUV | SEDAN | HB | PANEL...
  ADD COLUMN IF NOT EXISTS asesor_compra  TEXT,   -- quien lo trajo (nombre corto, como en el Excel)
  ADD COLUMN IF NOT EXISTS caducidad_soat DATE,
  ADD COLUMN IF NOT EXISTS caducidad_rtv  DATE,
  ADD COLUMN IF NOT EXISTS ubicacion      TEXT;

-- La placa es el identificador natural del vehiculo — la vuelve UNIQUE para
-- poder hacer UPSERT (re-correr este archivo actualiza, no duplica).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tradecars_vehiculos_placa_key'
  ) THEN
    ALTER TABLE public.tradecars_vehiculos ADD CONSTRAINT tradecars_vehiculos_placa_key UNIQUE (placa);
  END IF;
END $$;

INSERT INTO public.tradecars_vehiculos (
  placa, codigo, marca, modelo, version, anio, kilometraje, color,
  tipo_vehiculo, combustible, transmision, precio_compra, precio_venta,
  asesor_compra, fecha_ingreso, caducidad_soat, caducidad_rtv, ubicacion
) VALUES
  ('ACZ201', 'ACZ201-2', 'BMW', '520 I', '520 I 2.0 AT', 2015, 92500, 'NEGRO ZAFIRO METALIZADO', 'SEDAN', 'gasolina', 'automatica', 10650.0, 12990.0, 'LUIS', '2026-07-07', '2026-08-05', '2027-03-12', 'TIENDA'),
  ('BVB412', 'BVB412-1', 'CHERY', 'TIGGO 8', 'TIGGO 8 1.5T AT FULL', 2021, 58000, 'NEGRO AZABACHE', 'SUV', 'gasolina', 'automatica', 11800.0, 13990.0, 'OFICINA', '2026-06-15', '2026-12-03', '2026-08-18', 'TIENDA'),
  ('CCN315', 'CCN315-1', 'DONGFENG', 'SX6', 'SX6 LZ6472XQ16AM 1.6 MT', 2023, 49000, 'ROJO', 'SUV', 'gnv', 'mecanica', 8600.0, 40000.0, 'GINO', '2026-07-11', '2026-12-16', '2027-02-12', 'TIENDA'),
  ('C5S055', 'C5S055-1', 'FORD', 'EXPLORER', 'EXPLORER XLT 3.5 4X4 AT', 2012, 83000, 'GRIS OSCURO METALICO', 'SUV', 'gasolina', 'automatica', 13000.0, 15990.0, 'JOSE', '2026-07-07', '2027-04-14', '2026-08-02', 'TIENDA'),
  ('D3O345', 'D3O345-1', 'KIA', 'SPORTAGE', 'SPORTAGE 2.0 AT EX', 2013, 112000, 'PLATA MINERAL', 'SUV', 'gnv', 'automatica', 8792.5, 41990.0, 'JOSE', '2026-07-08', '2027-06-28', '2026-11-16', 'TIENDA'),
  ('AWV307', 'AWV307-1', 'MERCEDES BENZ', 'GLC 250 4MATIC', 'GLC 250 4MATIC 2.0 AT', 2017, 86500, 'AZUL', 'SUV', 'gasolina', 'automatica', 20000.0, 22990.0, 'RODRIGO', '2026-05-16', '2026-08-05', '2026-12-10', 'TIENDA'),
  ('C6G120', 'C6G120-1', 'SSANGYONG', 'ACTYON AUT 2.3G 4X2', 'ACTYON AUT 2.3G 4X2', 2012, 98000, 'PLATA FINE', 'SUV', 'gnv', 'automatica', 5000.0, 22990.0, 'GINO', '2026-07-01', '2027-06-19', '2026-07-28', 'TIENDA'),
  ('APB603', 'APB603-1', 'SUBARU', 'IMPREZA', 'IMPREZA 2.0I AWD CVT', 2017, 67500, 'GRIS OSCURO METALICO', 'SEDAN', 'gasolina', 'cvt', 8750.0, 11990.0, 'BRADO', '2026-07-11', '2027-01-21', '2027-05-05', 'TIENDA'),
  ('Z8V906', 'Z8V906-1', 'CHEVROLET', 'N400', 'N400 MAX 1.5 MT CARGO BASE', 2025, 26000, 'BLANCO CANDY', 'PANEL', 'glp', 'mecanica', 10935.77, 41990.0, 'RODRIGO', '2026-06-24', '2027-04-25', '2029-09-15', 'TIENDA'),
  ('BSR581', 'BSR581-1', 'VOLVO', 'XC40', 'XC40 T4 2.0 AT', 2020, 62000, 'NEGRO', 'SUV', 'gasolina', 'automatica', 18400.0, 21490.0, 'RODRIGO', '2026-03-05', '2026-12-05', '2027-04-20', 'TIENDA'),
  ('CDW193', 'CDW193-1', 'CHANGAN', 'CS15', 'NEW CS15 CONFORT 1.5L MT 4X2', 2023, 100000, 'NEGRO', 'SUV', 'glp', 'mecanica', 6463.77, 29490.0, 'RODRIGO', '2026-07-07', '2027-02-25', '2027-05-15', 'TIENDA'),
  ('CPZ256', 'CPZ256-1', 'CHEVROLET', 'TRACKER', 'TRACKER TURBO 1.2T LTZ AT', 2025, 11800, 'GRIS TIBURON', 'SUV', 'gasolina', 'automatica', 15000.0, 16990.0, 'RODRIGO', '2026-07-10', '2027-02-04', '2029-09-15', 'TIENDA'),
  ('CLB498', 'CLB498-1', 'FORD', 'TERRITORY', 'TERRITORY TREND 1.8 AT', 2024, 48000, 'MARRON', 'SUV', 'gasolina', 'automatica', 15098.21, 20990.0, 'GINO', '2026-07-06', '2027-03-19', '2028-11-15', 'TIENDA'),
  ('BMJ244', 'BMJ244-1', 'JAC', 'S2', 'S2 1.5 AT LUXURY', 2020, 73000, 'NEGRO', 'SUV', 'glp', 'automatica', 6329.11, 27990.0, 'JOSE', '2026-07-11', '2026-10-11', '2026-08-04', 'TIENDA'),
  ('C6V457', 'C6V457-1', 'KIA', 'PICANTO', 'PICANTO 1.0  MT', 2012, 118400, 'MARRON CAFÉ', 'HB', 'glp', 'mecanica', 5100.0, 24490.0, 'OFICINA', '2026-07-04', '2027-07-01', '2026-10-06', 'TIENDA'),
  ('F3R651', 'F3R651-1', 'KIA', 'SORENTO', 'SORENTO 2.4 AT', 2014, 95000, 'NEGRO', 'SUV', 'gasolina', 'automatica', 13192.61, 15790.0, 'GINO', '2026-07-06', '2026-12-25', '2026-11-07', 'TIENDA'),
  ('CTH424', 'CTH424-1', 'MITSUBISHI', 'XPANDER CROSS', 'XPANDER CROSS 1.5 GLS AT', 2026, 23600, 'PLATA METALICO', 'SUV', 'glp', 'automatica', 18293.51, 22490.0, 'RODRIGO', '2026-06-30', '2027-06-30', '2030-06-15', 'TIENDA'),
  ('CNC197', 'CNC197-1', 'CHEVROLET', 'TRACKER', 'TRACKER TURBO 1.2T PRIME AT', 2024, 19400, 'GRIS RUSH', 'SUV', 'gasolina', 'automatica', 15202.54, 16990.0, 'RODRIGO', '2026-05-25', '2026-08-29', '2028-10-15', 'TIENDA'),
  ('CEQ121', 'CEQ121-1', 'CITROEN', 'NEW C3', 'C3 AMLAT FEEL PACK 1.6 AT 2WD', 2023, 53000, 'BLANCO BANQUISE', 'HB', 'gasolina', 'automatica', 10500.0, 12490.0, 'JOSE', '2026-06-23', '2027-05-03', '2027-03-15', 'TIENDA'),
  ('BEG600', 'BEG600-1', 'FORD', 'ESCAPE', 'ESCAPE S 2.5 AT', 2018, 89000, 'GRIS', 'SUV', 'gasolina', 'automatica', 11500.0, 13490.0, 'GINO', '2026-06-20', '2026-10-08', '2026-08-16', 'TIENDA'),
  ('CSL336', 'CSL336-1', 'JAC', 'JS2', 'JS2 1.5 CVT LUXURY', 2025, 23000, 'PLATA', 'SUV', 'gasolina', 'cvt', 10303.8, 11990.0, 'GINO', '2026-06-11', '2027-05-06', '2029-09-15', 'TIENDA'),
  ('ANL295', 'ANL295-1', 'KIA', 'SORENTO', 'SORENTO 3.3 AT EX 4WD FULL DE LUXE', 2016, 95000, 'PLATA', 'SUV', 'glp', 'automatica', 15500.0, 17990.0, 'GINO', '2026-07-08', '2027-07-04', '2027-01-05', 'TIENDA'),
  ('CUE650', 'CUE650-1', 'KIA', 'CARENS', 'CARENS 1.5 CVT - LX ONE', 2026, 33000, 'NEGRO', 'SUV', 'gnv', 'cvt', 16300.0, 21490.0, 'BRADO', '2026-06-12', '2026-08-30', '2030-01-30', 'TIENDA'),
  ('ASH139', 'ASH139-1', 'TOYOTA', 'YARIS', 'YARIS GLI 1.3 CVT', 2017, 87000, 'ROJO MICA METALICO', 'SEDAN', 'gasolina', 'cvt', 7475.22, NULL, 'RODRIGO', '2026-05-20', '2026-10-11', '2026-08-15', 'TIENDA'),
  ('BWD128', 'BWD128-1', 'RENAULT', 'LOGAN', 'LOGAN LIFE 1.6 MT AC', 2022, 45000, 'GRIS CASSIOPEE', 'SEDAN', 'gasolina', 'mecanica', 3800.0, 25000.0, 'JOSE', '2026-05-26', '2026-09-06', '2026-11-15', 'TIENDA')
ON CONFLICT (placa) DO UPDATE SET
  codigo         = EXCLUDED.codigo,
  marca          = EXCLUDED.marca,
  modelo         = EXCLUDED.modelo,
  version        = EXCLUDED.version,
  anio           = EXCLUDED.anio,
  kilometraje    = EXCLUDED.kilometraje,
  color          = EXCLUDED.color,
  tipo_vehiculo  = EXCLUDED.tipo_vehiculo,
  combustible    = EXCLUDED.combustible,
  transmision    = EXCLUDED.transmision,
  precio_compra  = EXCLUDED.precio_compra,
  precio_venta   = EXCLUDED.precio_venta,
  asesor_compra  = EXCLUDED.asesor_compra,
  fecha_ingreso  = EXCLUDED.fecha_ingreso,
  caducidad_soat = EXCLUDED.caducidad_soat,
  caducidad_rtv  = EXCLUDED.caducidad_rtv,
  ubicacion      = EXCLUDED.ubicacion,
  estado         = 'disponible',
  updated_at     = timezone('utc', now());

-- Todos entran como 'disponible' — es el default de la columna, ver
-- sql/tradecars_tables.sql. La columna "DISPONIBLE" de la hoja de Excel
-- decia "NO" en las 25 filas reales, algo que no calza con estar en el
-- stock comercial vigente; no se sabe con certeza que significa ese "NO"
-- (¿no publicado en algún canal?) así que no se usó para decidir el estado.
