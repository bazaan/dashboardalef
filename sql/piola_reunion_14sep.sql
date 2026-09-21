-- ══════════════════════════════════════════════════════════════════════════
-- PIOLA — reunión del 14/09/2026
--
-- Correr UNA vez en el SQL Editor de Supabase. Es idempotente: se puede volver a
-- correr sin duplicar nada y sin pisar lo que se haya editado después.
--
-- Lo único que la reunión necesita de la base es esto:
--   · Quién puede cambiar las contraseñas de otros usuarios del sistema.
--
-- Lo demás de la reunión (renombrar "Etapa de producción" a "Área", botón Duplicar,
-- tabla de KPIs estilo Excel, reportes en PDF, título de Reportes) NO toca la base:
-- usa las tablas y la vista `piola_cumplimiento_tipo` que ya existen.
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. CONTRASEÑAS: SOLO EDSON Y RAYSA
--
-- Hasta ahora la contraseña solo se ponía al crear el usuario (el cambio estaba
-- desactivado "por cuestiones de seguridad"). En la reunión se acordó activarlo solo
-- para Raysa Cucho y Edson Polo (Héctor Córdova también es administrador, pero no
-- cambia contraseñas). Además de estar en esta lista, quien lo haga tiene que
-- confirmar con su propia contraseña; el servidor lo exige (server/api/users/password.put.ts).
--
-- La lista vive en la tabla que ya existe para los accesos por persona
-- (`piola_modulo_acceso`) con un grupo propio, 'contrasenas', que NO restringe ningún módulo.
-- Para agregar o quitar a alguien basta editar el arreglo `emails`, sin tocar código.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.piola_modulo_acceso (grupo, modulos, emails, activo, descripcion)
SELECT
  'contrasenas',
  ARRAY[]::text[],
  ARRAY['administracion@agenciapiola.com', 'raysa@agenciapiola.com'],
  true,
  'Administradores de Piola que pueden cambiar la contraseña de otros usuarios del sistema: Edson Polo y Raysa Cucho. No restringe ningún módulo.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.piola_modulo_acceso WHERE grupo = 'contrasenas'
);

-- Verificación rápida (opcional): debe devolver una fila con los dos correos
-- SELECT grupo, emails, activo FROM public.piola_modulo_acceso WHERE grupo = 'contrasenas';
