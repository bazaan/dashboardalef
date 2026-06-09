# Tool `generar_llamada` — Gatwick (guía n8n)

Dispara una **llamada de voz** al técnico de turno (vía **Vonage**) cuando el
agente confirma una emergencia. El técnico escucha *"Emergencia Gatwick. Revisa
el WhatsApp"* 3 veces y la llamada se corta sola. No recibe parámetros: el
destino (técnico) sale de nuestro sistema.

## Endpoint del dashboard

```
POST https://dashboard.alef.company/api/gatwick/generar-llamada
api_key: gatwick-llamada-2026
```

Body: `{ "api_key": "gatwick-llamada-2026" }` (nada más).

## Qué hace internamente

1. Genera un JWT RS256 de Vonage (firmado con la private key de la *Application* de Voz).
2. Lee los técnicos de turno de `gatwick_alerta_destinos` (`activo=true AND recibe_llamada=true`).
   Fallback: env `GATWICK_LLAMADA_DESTINO_FALLBACK`.
3. Llama a **cada** destino vía `POST https://api.nexmo.com/v1/calls`.
4. El guión de voz lo sirve `GET /api/vonage/handle-call` (NCCO público: talk ×3 + hangup).
5. Registra todo en `agent_tool_logs`.

## Respuesta

```json
{
  "success": true,
  "message": "Se realizó la llamada al técnico de turno.",
  "uuid": "63f61863-...",
  "llamadas_ok": 1,
  "llamadas_fallidas": 0,
  "timestamp": "2026-06-09T..."
}
```

## ⚠️ Credenciales de Vonage Voice (REQUERIDAS)

La Voice API de Vonage **no** se autentica con `api_key`/`api_secret` — necesita
un JWT firmado con la clave privada de una **Application de tipo Voice**. Hay que
crearla una sola vez:

1. https://dashboard.vonage.com/ → **Applications → Create a new application**.
2. Activá **Voice**, generá la public/private key (descargá el `.key`).
3. **Linkeá el número origen** `12015471160` a esa Application.
4. Configurá estas env vars en el dashboard (Netlify → Environment variables):

| Env var | Valor |
|---|---|
| `VONAGE_APPLICATION_ID` | el Application ID (UUID) que muestra Vonage |
| `VONAGE_PRIVATE_KEY` | el contenido del `.key` (PEM). Los `\n` pueden ir escapados. |
| `VONAGE_FROM_NUMBER` | (opcional) default `12015471160` |
| `VONAGE_ANSWER_URL` | (opcional) default `<dominio>/api/vonage/handle-call` |
| `VONAGE_NCCO_TEXT` | (opcional) texto de la llamada |
| `GATWICK_LLAMADA_DESTINO_FALLBACK` | (opcional) número(s) destino si la tabla está vacía |

> Sin `VONAGE_APPLICATION_ID` + `VONAGE_PRIVATE_KEY` el endpoint responde
> `success:false` con el detalle, y queda logueado como error en Dev · Agent Logs.

## Destino de la llamada

Misma tabla que el SMS: `gatwick_alerta_destinos`, filas con `recibe_llamada=true`.
Se llama a **todas** las filas `activo=true AND recibe_llamada=true`.

## Paso 1 — Importar el sub-workflow

n8n → **Workflows → Import from File** → `gatwick-generar-llamada-subflow.json`
(2 nodos: trigger sin inputs + HTTP Request). **Guardá.**

## Paso 2 — Conectar el nodo tool

En el flujo `GATWICK | WHATSAPP | Agente Emergencias`, el nodo toolWorkflow
`generar_llamada`: seleccioná el sub-workflow importado. No tiene Workflow Inputs.

Descripción sugerida de la tool:
```
Llama por teléfono al técnico de turno para alertar de una emergencia confirmada.
Úsala junto con sms_alerta_emergencia. No recibe parámetros.
```

## Logs

`dashboard Alef → Dev · Agent Logs → Empresa: Gatwick → Tool: "Generar Llamada"`.

## Prueba manual (curl)

```bash
curl -X POST https://dashboard.alef.company/api/gatwick/generar-llamada \
  -H "Content-Type: application/json" \
  -d '{"api_key":"gatwick-llamada-2026"}'
```
> Antes de probar con el técnico real, sembrá tu propio número en
> `gatwick_alerta_destinos` (o en `GATWICK_LLAMADA_DESTINO_FALLBACK`).
