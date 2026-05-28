-- ══════════════════════════════════════════════════════════════════════════
-- UPDATE — Formulario Gatwick: cambiar hora_entrada y hora_salida a tipo "time"
--
-- Antes: estos campos eran de tipo "short" (texto libre, placeholder "Ej: 09:30")
-- Ahora: tipo "time" (selector con 3 dropdowns: hora 1-12, minutos cada 5, AM/PM)
--
-- Conserva todas las respuestas que ya estén guardadas — solo cambia la
-- definición del campo, no las respuestas.
--
-- Corre este archivo después de `forms_seed_gatwick_informe_tecnico.sql`.
-- ══════════════════════════════════════════════════════════════════════════

UPDATE public.forms
SET fields = (
  SELECT jsonb_agg(
    CASE
      -- Cambiar hora_entrada y hora_salida a tipo 'time'
      WHEN elem->>'id' IN ('hora_entrada','hora_salida') THEN
        jsonb_build_object(
          'id',       elem->>'id',
          'type',     'time',
          'label',    elem->>'label',
          'required', (elem->>'required')::boolean
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(fields) elem
)
WHERE slug = 'gtw-IT-001';


-- Verificación
SELECT id, slug, title,
       (SELECT jsonb_agg(jsonb_build_object('id', e->>'id', 'type', e->>'type', 'label', e->>'label'))
        FROM jsonb_array_elements(fields) e
        WHERE e->>'id' IN ('hora_entrada','hora_salida')
       ) AS campos_hora
FROM public.forms
WHERE slug = 'gtw-IT-001';
