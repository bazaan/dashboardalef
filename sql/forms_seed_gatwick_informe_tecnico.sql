-- ══════════════════════════════════════════════════════════════════════════
-- SEED — Formulario "Informe Técnico" para GATWICK
--
-- Replica el formato físico que Gatwick rellenaba manualmente.
-- Adaptaciones:
--   • Se agrega al inicio Nombre y Apellido del técnico que llena el form
--   • Hora de entrada / Hora de salida como campos editables
--   • Se omiten las firmas (no aplican en form digital)
--
-- Corre este archivo después de haber corrido `sql/forms_schema.sql`.
--
-- URL pública resultante: https://dashboard.alef.company/forms/gtw-IT-001
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO public.forms (
  slug,
  title,
  description,
  company_id,
  created_by,
  active,
  thanks_text,
  fields
) VALUES (
  'gtw-IT-001',
  'Informe Técnico — Gatwick Ascensores',
  'Reporte de visita técnica para mantenimiento o reparación de ascensores. Completa todos los campos según el servicio realizado.',
  'gatwick',
  'aipartnerstudio@gmail.com',
  true,
  '¡Gracias! Hemos recibido tu informe técnico. El equipo lo revisará en breve.',
  $json$[
    {
      "id":"tecnico_nombre","type":"short",
      "label":"Nombre del técnico","required":true,
      "placeholder":"Tu nombre"
    },
    {
      "id":"tecnico_apellido","type":"short",
      "label":"Apellido del técnico","required":true,
      "placeholder":"Tus apellidos"
    },
    {
      "id":"hora_entrada","type":"time",
      "label":"Hora de entrada","required":true
    },
    {
      "id":"hora_salida","type":"time",
      "label":"Hora de salida","required":true
    },
    {
      "id":"cliente","type":"short",
      "label":"Cliente","required":true,
      "placeholder":"Nombre o razón social del cliente"
    },
    {
      "id":"fecha","type":"date",
      "label":"Fecha del servicio","required":true
    },
    {
      "id":"telefono","type":"phone",
      "label":"Teléfono","required":false,
      "placeholder":"Ej: 987654321"
    },
    {
      "id":"direccion","type":"short",
      "label":"Dirección","required":true,
      "placeholder":"Av./Calle, número, piso, etc."
    },
    {
      "id":"distrito","type":"short",
      "label":"Distrito","required":true
    },
    {
      "id":"referencia","type":"short",
      "label":"Referencia","required":false,
      "placeholder":"Punto de referencia para llegar"
    },
    {
      "id":"garantia","type":"radio",
      "label":"Garantía","required":true,
      "options":["Sí","No"]
    },
    {
      "id":"tipologia_elevador","type":"radio",
      "label":"Tipología de elevador","required":false,
      "options":["Hidráulico","Electromecánico"]
    },
    {
      "id":"tipo_elevador","type":"radio",
      "label":"Tipo de elevador","required":false,
      "options":["Ascensor","Montacargas","Montavehículo","Plataforma"]
    },
    {
      "id":"maquina_traccion","type":"short",
      "label":"Máquina de tracción","required":false
    },
    {
      "id":"potencia_hp","type":"short",
      "label":"Potencia (HP)","required":false
    },
    {
      "id":"operador_puerta","type":"short",
      "label":"Operador de puerta","required":false
    },
    {
      "id":"puertas_cabecera","type":"short",
      "label":"Puertas de cabecera","required":false
    },
    {
      "id":"cable_viajero","type":"short",
      "label":"Cable viajero","required":false
    },
    {
      "id":"botonera","type":"short",
      "label":"Botonera","required":false
    },
    {
      "id":"indicadores","type":"short",
      "label":"Indicadores","required":false
    },
    {
      "id":"contrapeso","type":"short",
      "label":"Contrapeso","required":false
    },
    {
      "id":"cielo_raso","type":"short",
      "label":"Cielo raso","required":false
    },
    {
      "id":"cabina","type":"short",
      "label":"Cabina","required":false
    },
    {
      "id":"rieles","type":"short",
      "label":"Rieles","required":false
    },
    {
      "id":"cables_traccion","type":"short",
      "label":"Cables de tracción","required":false
    },
    {
      "id":"poleas","type":"short",
      "label":"Poleas","required":false
    },
    {
      "id":"tensores","type":"short",
      "label":"Tensores","required":false
    },
    {
      "id":"guiadores","type":"short",
      "label":"Guiadores","required":false
    },
    {
      "id":"sistema_ruidos","type":"short",
      "label":"Sistema para ruidos","required":false
    },
    {
      "id":"limitador_velocidad","type":"short",
      "label":"Limitador de velocidad","required":false
    },
    {
      "id":"sensor_puerta","type":"short",
      "label":"Sensor de puerta","required":false
    },
    {
      "id":"inductores","type":"short",
      "label":"Inductores","required":false
    },
    {
      "id":"sistema_iluminacion","type":"short",
      "label":"Sistema de iluminación","required":false
    },
    {
      "id":"informe_tecnico","type":"long",
      "label":"Informe técnico","required":true,
      "placeholder":"Detalla el trabajo realizado, diagnóstico, repuestos cambiados, etc."
    },
    {
      "id":"observaciones","type":"long",
      "label":"Observaciones","required":false,
      "placeholder":"Comentarios adicionales o recomendaciones"
    }
  ]$json$::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  fields      = EXCLUDED.fields,
  thanks_text = EXCLUDED.thanks_text,
  active      = EXCLUDED.active,
  updated_at  = timezone('utc', now());


-- ─────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────
SELECT id, slug, title, company_id, active,
       jsonb_array_length(fields) AS num_campos,
       created_at
FROM public.forms
WHERE slug = 'gtw-IT-001';

-- Tu URL pública será:
--   https://dashboard.alef.company/forms/gtw-IT-001
