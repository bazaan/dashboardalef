# Tool `sms_alerta_emergencia` — Gatwick (guía n8n)

Envía un SMS de alerta al técnico de turno cuando el agente de emergencias
confirma una emergencia. El SMS sale vía **Telnyx**; el destino (técnico) se
gestiona en el dashboard (tabla `gatwick_alerta_destinos`), no se manda por el agente.

## Endpoint del dashboard

```
POST https://dashboard.alef.company/api/gatwick/sms-alerta
api_key: gatwick-sms-2026
```

Body (las 8 variables, todas string):

```json
{
  "api_key": "gatwick-sms-2026",
  "tipo_caso": "Persona atrapada",
  "edificio_nombre": "CGIL SRL",
  "edificio_tipo": "Ascensor de Pasajeros",
  "edificio_direccion": "Av. Javier Prado 1250",
  "edificio_distrito": "Miraflores",
  "personas_atrapadas": "3",
  "descripcion_adicional": "Detenido entre 4to y 5to piso",
  "telefono_contacto": "987654321"
}
```

## Qué hace internamente

1. Arma el mensaje dinámico con el template fijo:
   ```
   🚨 EMERGENCIA: {tipo_caso}
   📍 {edificio_nombre} | {edificio_tipo}
   📍 {edificio_direccion}, {edificio_distrito}
   👥 {personas_atrapadas}
   📝 {descripcion_adicional}
   📞 Contacto: {telefono_contacto}
   → Revisa WhatsApp URGENTE
   ```
2. Lee los técnicos de turno de `gatwick_alerta_destinos` (`activo=true AND recibe_sms=true`,
   ordenados por `orden`). Si la tabla está vacía, usa el fallback de env `GATWICK_SMS_DESTINO_FALLBACK`.
3. Envía el SMS a **cada** destino vía Telnyx (`POST https://api.telnyx.com/v2/messages`).
4. Registra todo en `agent_tool_logs` (el `telefono_contacto` se **enmascara**).

## Respuesta

```json
{
  "success": true,
  "message": "Se realizó el aviso al técnico de turno. El equipo técnico está en camino.",
  "telnyx_id": "...",
  "enviados": 1,
  "fallidos": 0,
  "timestamp": "2026-06-09T..."
}
```
Si todo falla: `{ "success": false, "message": "No se pudo enviar el SMS. Contacta al equipo técnico.", "error": "..." }`.

## Credenciales (env vars del dashboard — opcionales, ya tienen default)

| Env var | Default | Para qué |
|---|---|---|
| `TELNYX_API_KEY` | **REQUERIDA (sin default)** | Bearer token de Telnyx (secreta) |
| `TELNYX_MESSAGING_PROFILE_ID` | `40019e3c-...` | Messaging Profile |
| `TELNYX_SMS_FROM` | `Gatwick SMS` | Remitente (sender ID) |
| `GATWICK_SMS_DESTINO_FALLBACK` | — | Número(s) destino si la tabla está vacía (coma-separados) |

## Destino del SMS (técnico de turno)

Se administra en Supabase, tabla `gatwick_alerta_destinos`. Para cambiar el técnico
de turno, editá/insertá filas (sin redeploy):

```sql
-- Cambiar el número del técnico de turno
UPDATE gatwick_alerta_destinos SET telefono = '+51999888777' WHERE id = 1;

-- Agregar otro técnico que también reciba SMS
INSERT INTO gatwick_alerta_destinos (nombre, telefono, recibe_sms, recibe_llamada, activo, orden)
VALUES ('Técnico backup', '+51955111222', TRUE, FALSE, TRUE, 2);
```
Se envía a **todas** las filas `activo=true AND recibe_sms=true`.

## Paso 1 — Importar el sub-workflow

n8n → **Workflows → Import from File** → `gatwick-sms-alerta-subflow.json`
(2 nodos: trigger con las 8 variables + HTTP Request). **Guardá.**

## Paso 2 — Conectar el nodo tool en el flujo de emergencias

En el flujo `GATWICK | WHATSAPP | Agente Emergencias`, el nodo toolWorkflow
`sms_alerta_emergencia`:

1. **Workflow** → seleccioná el sub-workflow importado.
2. **Workflow Inputs** (mapeo, todos string) — sacá los valores del nodo anterior
   (los datos del edificio confirmado) o de `$fromAI`:

   | Campo | Valor sugerido |
   |---|---|
   | `tipo_caso` | `{{ $fromAI('tipo_caso', 'tipo de emergencia', 'string') }}` |
   | `edificio_nombre` | `{{ $json.edificio_nombre }}` |
   | `edificio_tipo` | `{{ $json.edificio_tipo }}` |
   | `edificio_direccion` | `{{ $json.edificio_direccion }}` |
   | `edificio_distrito` | `{{ $json.edificio_distrito }}` |
   | `personas_atrapadas` | `{{ $fromAI('personas_atrapadas', 'cantidad o estado de personas', 'string') }}` |
   | `descripcion_adicional` | `{{ $fromAI('descripcion_adicional', 'detalle de la emergencia', 'string') }}` |
   | `telefono_contacto` | `{{ $fromAI('telefono_contacto', 'celular del contacto en sitio', 'string') }}` |

## Logs

`dashboard Alef → Dev · Agent Logs → Empresa: Gatwick → Tool: "SMS Alerta Emergencia"`.

## Prueba manual (curl)

```bash
curl -X POST https://dashboard.alef.company/api/gatwick/sms-alerta \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"gatwick-sms-2026",
    "tipo_caso":"Persona atrapada",
    "edificio_nombre":"CGIL SRL",
    "edificio_tipo":"Ascensor de Pasajeros",
    "edificio_direccion":"Av. Javier Prado 1250",
    "edificio_distrito":"Miraflores",
    "personas_atrapadas":"3",
    "descripcion_adicional":"Detenido entre 4to y 5to piso",
    "telefono_contacto":"987654321"
  }'
```
