# Tool `calendario_agendar` — Miguel Davila (guía n8n)

Paso FINAL del ciclo de cita (Fase 3). Toma una pre-reserva **pagada** y la
convierte en cita confirmada permanente: enriquece Google Calendar + el
calendario del dashboard, e inserta el paciente en `PacientesBDwppDAVILA`.

## Las 3 fases conectadas

```
Fase 1  CREATE        → validar_pre_reserva (op CREATE): elige horario.
                        Crea evento GCal "PRE-RESERVA" + fila en el calendario
                        del dashboard + fila en pre_reservas (expira 40 min).
Fase 2  UPDATE_PAGO   → validar_pre_reserva (op UPDATE_PAGO): cliente paga.
Fase 3  calendario_agendar → ESTA tool: cliente manda datos personales.
                        Enriquece GCal + dashboard, inserta paciente, confirma.
```

## Endpoint del dashboard

```
POST https://dashboard.alef.company/api/davila/calendario-agendar
api_key: davila-pre-reserva-2026
```

Recibe `celular, nombre_completo, dni, tratamiento`. La fecha/hora las SACA
de la pre-reserva pagada (no se mandan).

## Qué hace internamente

1. Busca `pre_reservas WHERE celular AND estado='pagado' ORDER BY created_at DESC LIMIT 1`
2. Enriquece el evento de Google Calendar (título "Nombre - Tratamiento", horario, datos)
3. Enriquece el evento del dashboard (`DAVILA_calendar_events`) → estado confirmado
4. Inserta el paciente en `PacientesBDwppDAVILA` (nombre, dni, numero, procedimiento, fecha_agendamiento, company_id='davila')
5. Marca la pre-reserva como `confirmado`

## Respuesta

```json
{
  "success": true,
  "estado": "confirmado",
  "mensaje": "Cita confirmada y agendada exitosamente",
  "fecha": "2026-06-03",
  "hora": "16:00",
  "paciente": "Juan Perez Garcia"
}
```
Si no hay pre-reserva pagada: `{ success:false, error:"pre_reserva_no_encontrada" }`.

## Paso 1 — Importar el sub-workflow

n8n → **Workflows → Import from File** → `davila-calendario-agendar-subflow.json`
(2 nodos: trigger con 4 inputs + HTTP Request). **Guarda.**

## Paso 2 — Conectar el nodo `calendario_agendar` (o crearlo) en el flujo principal

En el flujo `MIGUEL DAVILA | WHATSAPP`, el nodo toolWorkflow `calendario_agendar`:

1. **Workflow** → seleccioná el sub-workflow importado.
2. **Workflow Inputs** (mapeo `$fromAI`, todos string):

   | Campo            | Valor |
   |------------------|-------|
   | `celular`        | `{{ $('Webhook').item.json.body.conversation.contact_inbox.source_id }}` |
   | `nombre_completo`| `{{ $fromAI('nombre_completo', 'nombre completo del paciente', 'string') }}` |
   | `dni`            | `{{ $fromAI('dni', 'DNI del paciente', 'string') }}` |
   | `tratamiento`    | `{{ $fromAI('tratamiento', 'tratamiento a realizar', 'string') }}` |

   > `celular` sale del Webhook (igual que las otras tools), NO del agente.

3. Descripción sugerida de la tool:
   ```
   PASO FINAL del agendamiento. Úsala SOLO después de que el cliente pagó
   (UPDATE_PAGO exitoso) y envió sus datos personales. Recibe nombre_completo,
   dni y tratamiento; toma fecha/hora de la pre-reserva pagada y confirma la
   cita (Google Calendar + calendario + paciente).
   ```

## Logs

`dashboard Alef → Dev · Agent Logs → Empresa: M. Davila → Tool: "Calendario Agendar"`.

## Prueba manual (curl) — requiere una pre-reserva en estado 'pagado'

```bash
# 1) CREATE (martes/jueves 3-7:30 PM)
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"CREATE","celular":"+51988111222","fecha":"2026-06-11","hora":"15:00"}'

# 2) UPDATE_PAGO
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"UPDATE_PAGO","celular":"+51988111222"}'

# 3) calendario_agendar (confirma + agenda)
curl -X POST https://dashboard.alef.company/api/davila/calendario-agendar \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","celular":"+51988111222","nombre_completo":"Juan Perez Garcia","dni":"74852369","tratamiento":"Rinoplastia"}'
```
