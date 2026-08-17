-- Gatwick — usar el alta de usuarios de Configuración (dashboardlogin) para
-- también mantener al día las tablas propias del módulo de emergencias.
-- ══════════════════════════════════════════════════════════════════════════
-- No toca nada de lo que ya existe: dashboardlogin, CreateUserDialog/EditUserDialog
-- y los endpoints /api/users/* siguen funcionando igual para las otras 10 empresas.
-- Solo agrega, para Gatwick, una sincronización adicional (no bloqueante):
--
--   rol 'agente' (técnico) → upsert en gatwick_tecnicos (roster que ya usa el
--     Monitor de Emergencias para asignar quién atiende)
--   rol 'admin'  (supervisor) → upsert en gatwick_alerta_destinos (SMS backup;
--     el WhatsApp de gatwick_supervisores se sigue armando a mano porque se
--     identifica por conversación de Chatwoot, no por teléfono)
--
-- Ver server/utils/gatwick-tracking.ts → sincronizarUsuarioGatwick() / eliminarSyncGatwick()
-- Llamado desde server/api/users/create.post.ts, update.put.ts y delete.delete.ts

-- gatwick_tecnicos ya tiene columna `email` (sql/gatwick_tables.sql) — solo falta
-- el índice único para poder hacer upsert por email sin duplicar filas.
CREATE UNIQUE INDEX IF NOT EXISTS gatwick_tecnicos_email_uidx
  ON public.gatwick_tecnicos (lower(email)) WHERE email IS NOT NULL;

-- gatwick_alerta_destinos (sql/gatwick_sms_llamada_tools.sql) no tenía forma de
-- vincularse a un usuario del dashboard — se agrega `email` para poder hacer
-- upsert igual que en gatwick_tecnicos.
ALTER TABLE public.gatwick_alerta_destinos
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS gatwick_alerta_destinos_email_uidx
  ON public.gatwick_alerta_destinos (lower(email)) WHERE email IS NOT NULL;
