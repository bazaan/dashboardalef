-- ══════════════════════════════════════════════════════════════════════════
-- PIOLA — reunión del 21/09/2026 (Raysa Cucho, Sebastián Ávalos, Héctor Córdova,
-- Roberto Cáceres) + checklist escrito "Piola_Pendientes_22set2026"
--
-- Correr UNA vez en el SQL Editor de Supabase. Es idempotente: se puede volver a
-- correr sin duplicar nada y sin pisar lo que se haya editado después.
--
-- Lo único que esta reunión necesita de la base es esto:
--   · Las 4 áreas de producción reales: Guiones, Creadores operativos,
--     Filmmakers y Diseño gráfico (reemplazan, EN EL MENÚ, a las 6 del 07/09).
--
-- Lo demás de la reunión NO toca la base:
--   · "Eliminar Área y renombrar Etapa a Área" ya estaba hecho desde el 14/09
--     (se confirmó en vivo durante la llamada, probando el dashboard).
--   · El botón de certificados en Mi Espacio usa la tabla que ya existe
--     (`piola_colaborador_documentos`, tipo='certificado', del sql/piola.sql original).
--   · Excel de códigos financieros y texto del saludo de WhatsApp: pendientes
--     de que Héctor los mande — no son cambios de esquema.
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ÁREAS DE PRODUCCIÓN — pasan de 6 a 4
--
-- El 07/09 Sebastián había confirmado 6 áreas (guiones, producción, grabación,
-- edición, presentación, diseño gráfico). El 21/09 Raysa y Sebastián, en la
-- llamada y por escrito en el checklist, las simplificaron a 4: "uno es de
-- guiones, otro es de creadores operativos y otro es de filmmakers... y
-- diseño gráfico". "Creadores operativos" y "Filmmakers" son términos nuevos,
-- no sinónimos evidentes de "Producción" o "Grabación" — por eso esto AGREGA
-- dos filas nuevas y no renombra ni borra ninguna de las 9 que ya existían.
-- Ese entregable real que ya está etiquetado "Producción" (id 4, "Guiones La
-- vaca Loca") sigue mostrando ese nombre tal cual — nadie le cambia el área
-- por decisión de esta migración.
--
-- El filtro que decide qué se OFRECE en el desplegable (las 4 confirmadas,
-- no las 9 filas) es código, no la base: components/Piola/PiolaProduccion.vue,
-- constante CODIGOS_AREA_PRODUCCION_CONFIRMADOS.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.piola_produccion_areas (codigo, nombre, color, orden, activo)
SELECT 'creadores_operativos', 'Creadores operativos', '#4a90e2', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.piola_produccion_areas WHERE codigo = 'creadores_operativos');

INSERT INTO public.piola_produccion_areas (codigo, nombre, color, orden, activo)
SELECT 'filmmakers', 'Filmmakers', '#d6249f', 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.piola_produccion_areas WHERE codigo = 'filmmakers');

-- Reordena las 4 confirmadas para que aparezcan en ese orden en el desplegable
-- (Guiones, Creadores operativos, Filmmakers, Diseño gráfico). No toca activo
-- ni color de las que ya existían.
UPDATE public.piola_produccion_areas SET orden = 1 WHERE codigo = 'guiones';
UPDATE public.piola_produccion_areas SET orden = 4 WHERE codigo = 'diseno_grafico';

-- Verificación rápida (opcional): deben salir exactamente estas 4, en este orden
-- SELECT codigo, nombre, orden FROM public.piola_produccion_areas
--   WHERE codigo IN ('guiones','creadores_operativos','filmmakers','diseno_grafico')
--   ORDER BY orden;
