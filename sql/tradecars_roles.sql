-- ══════════════════════════════════════════════════════════════════════════
-- TRADE CARS — Roles y permisos por módulo
--
-- Pedido del cliente el 14/09/2026: "quiero que crees una creación de roles
-- así igual como está en Piola, pero para Trade Cars... que dependiendo del
-- rol que tiene en colaboradores pues vea módulos". Es el MISMO diseño que
-- sql/piola.sql (tablas piola_roles/piola_role_permissions/piola_colaboradores):
-- un rol con acceso total + roles editables con un checklist ver/crear/editar/
-- eliminar por módulo, y una ficha de colaborador que enlaza por email con el
-- login real (que sigue viviendo en `dashboardlogin`, global a todo el
-- dashboard — acá NO se crean accesos ni contraseñas).
--
-- Es idempotente: se puede correr las veces que haga falta.
--
-- OJO — diferencia real con Piola, para no prometer más de lo que esto hace:
-- en Piola TODAS las escrituras pasan por endpoints de `server/api/piola/`
-- que llaman a `exigirModulo()`, así que el permiso se aplica dos veces (menú
-- + servidor). Trade Cars hoy escribe la mayoría de sus tablas operativas
-- DIRECTO desde el navegador contra Supabase (RLS abierta a `anon`, igual que
-- el resto del proyecto antes de Piola) — no pasa por un endpoint propio.
-- Este sistema de roles controla lo que pide el cliente explícitamente: QUÉ
-- MÓDULOS VE cada quien en el menú, resuelto por `GET /api/tradecars/perfil`.
-- La gestión de roles y colaboradores en sí (crear rol, asignar permisos,
-- dar de alta a alguien) SÍ pasa por un endpoint (`/api/tradecars/configuracion`)
-- y SÍ está restringida a Administrador — ver server/utils/tradecars.ts.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tradecars_roles (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  es_admin      BOOLEAN NOT NULL DEFAULT FALSE,   -- acceso total, ignora el checklist
  editable      BOOLEAN NOT NULL DEFAULT TRUE,    -- los roles base no se borran
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulos del menú de Trade Cars. 'home' lo ve todo el mundo (igual que en
-- Piola). Si se agrega un módulo nuevo al menú, agregar su id acá también.
CREATE TABLE IF NOT EXISTS public.tradecars_role_permissions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id     BIGINT NOT NULL REFERENCES public.tradecars_roles(id) ON DELETE CASCADE,
  module      TEXT NOT NULL CHECK (module IN (
                'home','funnel','comercial','operaciones','finanzas',
                'tasador','configuracion')),
  can_view    BOOLEAN NOT NULL DEFAULT FALSE,
  can_create  BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role_id, module)
);

-- Ficha del colaborador. El LOGIN sigue viviendo en `dashboardlogin` (global);
-- esta tabla sólo agrega el rol de Trade Cars y el cargo, igual que
-- piola_colaboradores agrega el rol de Piola. Sin datos de planilla: eso no
-- lo pidió el cliente acá, a diferencia de Piola.
CREATE TABLE IF NOT EXISTS public.tradecars_colaboradores (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,        -- = dashboardlogin.email
  nombre      TEXT NOT NULL,
  cargo       TEXT,
  telefono    TEXT,
  role_id     BIGINT REFERENCES public.tradecars_roles(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_colab_email ON public.tradecars_colaboradores (lower(email));
CREATE INDEX IF NOT EXISTS idx_tc_colab_role  ON public.tradecars_colaboradores (role_id);


-- ══════════════════════════════════════════════════════════════════════════
-- SEEDS — 3 roles según los cargos reales que dio el cliente + los 9
-- colaboradores. Los permisos de partida son un punto de arranque razonable,
-- no lo que el cliente confirmó campo por campo (eso no se preguntó): se
-- editan libremente desde Configuración → Roles y permisos, igual que en
-- Piola. Todos los INSERT son WHERE NOT EXISTS: correr esto de nuevo no
-- pisa un rol o un colaborador que el cliente ya haya modificado desde la UI.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tradecars_roles (nombre, descripcion, es_admin, editable)
SELECT v.nombre, v.descripcion, v.es_admin, v.editable
FROM (VALUES
  ('Administrador',     'Acceso total a todos los módulos de Trade Cars', TRUE,  FALSE),
  ('Jefe de Compras',   'Supervisa el funnel, operaciones y egresos',      FALSE, TRUE),
  ('Asesor de Compras', 'Trabaja el funnel de leads y sus operaciones',    FALSE, TRUE)
) AS v(nombre, descripcion, es_admin, editable)
WHERE NOT EXISTS (SELECT 1 FROM public.tradecars_roles r WHERE r.nombre = v.nombre);

INSERT INTO public.tradecars_role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
SELECT r.id, p.module, p.v, p.c, p.e, p.d
FROM public.tradecars_roles r
JOIN (VALUES
  -- Jefe de Compras: todo lo operativo, sin gestionar roles/colaboradores
  ('Jefe de Compras','home',        TRUE, FALSE, FALSE, FALSE),
  ('Jefe de Compras','funnel',      TRUE, TRUE,  TRUE,  FALSE),
  ('Jefe de Compras','comercial',   TRUE, TRUE,  TRUE,  FALSE),
  ('Jefe de Compras','operaciones', TRUE, TRUE,  TRUE,  TRUE),
  ('Jefe de Compras','finanzas',    TRUE, TRUE,  TRUE,  FALSE),
  ('Jefe de Compras','tasador',     TRUE, TRUE,  TRUE,  FALSE),

  -- Asesor de Compras: su funnel y sus operaciones, sin egresos ni configuración
  ('Asesor de Compras','home',        TRUE, FALSE, FALSE, FALSE),
  ('Asesor de Compras','funnel',      TRUE, TRUE,  TRUE,  FALSE),
  ('Asesor de Compras','comercial',   TRUE, TRUE,  TRUE,  FALSE),
  ('Asesor de Compras','operaciones', TRUE, TRUE,  TRUE,  FALSE),
  ('Asesor de Compras','tasador',     TRUE, FALSE, FALSE, FALSE)
) AS p(rol, module, v, c, e, d) ON p.rol = r.nombre
WHERE NOT EXISTS (
  SELECT 1 FROM public.tradecars_role_permissions rp WHERE rp.role_id = r.id AND rp.module = p.module
);

-- Los 9 perfiles reales que dio el cliente el 14/09/2026, enlazados por email
-- al rol que corresponde a su cargo. Si alguno ya inició sesión con ese email
-- (dashboardlogin) el enlace es automático; si todavía no tiene acceso creado,
-- la ficha queda lista para cuando se le dé de alta en Settings → Usuarios.
INSERT INTO public.tradecars_colaboradores (email, nombre, cargo, role_id)
SELECT v.email, v.nombre, v.cargo, r.id
FROM (VALUES
  ('rodrigo.paredes@tradecars.pe',   'Rodrigo Paredes',        'Asesor de Compras', 'Asesor de Compras'),
  ('jose.flores@tradecars.pe',       'Jose Flores',             'Asesor de Compras', 'Asesor de Compras'),
  ('brado.alvarado@tradecars.pe',    'Brado Alvarado',          'Asesor de Compras', 'Asesor de Compras'),
  ('gino.hurtado@tradecars.pe',      'Gino Hurtado',            'Asesor de compras', 'Asesor de Compras'),
  ('luis.cossa@tradecars.pe',        'Luis Cossa',              'Jefe de Compras',   'Jefe de Compras'),
  ('jean.silvera@tradecars.pe',      'Jean Marcos Silvera',     'Administrador',     'Administrador'),
  ('fabian.villafana@tradecars.pe',  'Fabian Villafana',        'Administrador',     'Administrador'),
  ('ever.perez@tradecars.pe',        'Ever Perez',              'Administrador',     'Administrador'),
  ('miguel.prieto@tradecars.pe',     'Miguel Prieto',           'Administrador',     'Administrador')
) AS v(email, nombre, cargo, rol)
JOIN public.tradecars_roles r ON r.nombre = v.rol
WHERE NOT EXISTS (SELECT 1 FROM public.tradecars_colaboradores c WHERE lower(c.email) = lower(v.email));


-- ══════════════════════════════════════════════════════════════════════════
-- RLS — mismo criterio que el resto de tablas operativas de Trade Cars
-- (sql/tradecars_funnel.sql): `anon` puede CRUD, `service_role` siempre puede.
-- Nada de esto es sensible (ni sueldos ni contraseñas), así que no hace falta
-- restringir la lectura como en las tablas sensibles de Piola.
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY['tradecars_roles', 'tradecars_role_permissions', 'tradecars_colaboradores'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "service_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "service_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t);

    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;
