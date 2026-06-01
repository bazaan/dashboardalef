# Registro de Errores + Reporte de Tokens para flujos n8n

Guía para que **cualquier** workflow de n8n reporte:

1. **Errores** (en cualquier nodo, al inicio, al final, donde sea) →
   se guardan en el dashboard de Alef (**Dev · Agent Logs**) **y** se envían a tu WhatsApp por Chatwoot.
2. **Tokens gastados por ejecución** → un pequeño reporte que también queda en el dashboard.

Todo entra por un único endpoint del dashboard:

```
POST https://<tu-dominio>/api/flows/log
Header: Content-Type: application/json
Body (JSON): { "api_key": "flow-log-2026", ... }
```

> La `api_key` por defecto es `flow-log-2026`. Cámbiala con la env var `FLOW_LOG_API_KEY`
> en el hosting (Netlify/Vercel) y úsala igual en n8n.

El endpoint escribe en la tabla `agent_tool_logs`, que el panel **Dev · Agent Logs** ya lee y
filtra por empresa y tool. La empresa se deduce automáticamente del nombre del flujo
(ej. un workflow llamado `HEALUP - Agendar` cae en *healup*), o puedes mandar `company_id` explícito.

---

## Migración SQL (correr una vez en Supabase → SQL Editor)

```
sql/flow_logs_tokens.sql
```

Agrega columnas a `agent_tool_logs`: `flow_name`, `node_name`, `n8n_execution_id`, `tokens` (JSONB), `tokens_total`.

---

## PARTE 1 — Errores en TODOS los flujos (1 workflow, se conecta una vez)

n8n tiene un mecanismo nativo: un **Error Workflow**. Creas **un solo** workflow manejador de
errores y lo asignas a cada flujo en sus *Settings*. No necesitas tocar el interior de cada flujo.

### 1.1 Crear el workflow "❗ Error Handler — Global"

Nodos, en orden:

```
[Error Trigger]  →  [HTTP Request: Dashboard]  →  [HTTP Request: Chatwoot WhatsApp]
```

**Nodo 1 — Error Trigger**
- Tipo: *Error Trigger*. Sin configuración. Recibe automáticamente:
  `$json.workflow.name`, `$json.execution.id`, `$json.execution.url`,
  `$json.execution.error.message`, `$json.execution.error.node.name`.

**Nodo 2 — HTTP Request → Dashboard** (guarda el error en Dev · Agent Logs)
- Method: `POST`
- URL: `https://<tu-dominio>/api/flows/log`
- Body Content Type: `JSON`
- Body (modo *Expression*, pega esto tal cual):

```javascript
{
  "api_key": "flow-log-2026",
  "kind": "error",
  "flow_name": $json.workflow.name,
  "error_message": $json.execution.error?.message || "Error desconocido",
  "node_name": $json.execution.error?.node?.name || null,
  "n8n_execution_id": $json.execution.id,
  "execution_url": $json.execution.url,
  "input": { "stack": $json.execution.error?.stack || null }
}
```

> No mandes `company_id` y el dashboard lo deduce del `flow_name`. Si tus flujos no llevan el
> nombre de la empresa, agrega `"company_id": "healup"` (o el que sea) a este JSON.

La respuesta de este nodo trae `whatsapp_message` ya formateado, listo para el siguiente nodo.

**Nodo 3 — HTTP Request → Chatwoot** (te avisa por WhatsApp)
Reusa tu HTTP Request de Chatwoot que ya tienes conectado. La forma del request es:
- Method: `POST`
- URL: `https://chats.alef.company/api/v1/accounts/<ACCOUNT_ID>/conversations/<CONVERSATION_ID>/messages`
- Header: `api_access_token: <TU_TOKEN_CHATWOOT>`
- Body (JSON):

```javascript
{
  "content": $json.whatsapp_message,
  "message_type": "outgoing",
  "content_type": "text"
}
```

> `$json.whatsapp_message` viene del Nodo 2. Si prefieres armar tu propio texto, usa los campos
> del Error Trigger directamente. Ajusta `<ACCOUNT_ID>` y `<CONVERSATION_ID>` a tu conversación.

### 1.2 Asignar el Error Handler a cada flujo

En **cada** workflow donde quieras el monitoreo:
`⋯ (menú) → Settings → Error Workflow → selecciona "❗ Error Handler — Global" → Save`.

Listo. A partir de ahí, **cualquier** error en ese flujo (en cualquier nodo) dispara el handler,
que guarda en el dashboard y te avisa por WhatsApp. Repite la asignación en todos los flujos que quieras.

---

## PARTE 2 — Reporte de tokens por ejecución (1 nodo al final de cada flujo)

Esto sí va **dentro** de cada flujo que use IA, porque el consumo de tokens es propio de esa ejecución.

Agrega al final (después de tu nodo de IA / Agent) un **HTTP Request**:
- Method: `POST`
- URL: `https://<tu-dominio>/api/flows/log`
- Body (JSON):

```javascript
{
  "api_key": "flow-log-2026",
  "kind": "execution",
  "flow_name": $workflow.name,
  "tokens": {
    "prompt":     $json.tokenUsage?.promptTokens     ?? $json.usage?.prompt_tokens     ?? 0,
    "completion": $json.tokenUsage?.completionTokens ?? $json.usage?.completion_tokens ?? 0,
    "total":      $json.tokenUsage?.totalTokens      ?? $json.usage?.total_tokens      ?? 0,
    "model":      $json.model ?? null
  }
}
```

> **¿De dónde salen los tokens?** Depende del nodo:
> - **OpenAI node:** los expone en `usage.prompt_tokens / completion_tokens / total_tokens`.
> - **AI Agent / LangChain node:** suelen venir en `tokenUsage.promptTokens / completionTokens / totalTokens`.
>
> La expresión de arriba prueba ambos formatos. Apunta el HTTP Request al nodo de IA correcto
> (o pon un *Set* node antes que normalice los tokens) si tu versión usa otros nombres.
> Si un flujo hace varias llamadas a la IA, suma los totales con un *Code* node antes de enviar.

Opcional: si también quieres el reporte de tokens por WhatsApp, encadena otro nodo Chatwoot
igual que en la Parte 1 usando `$json.whatsapp_message` (la respuesta ya lo trae formateado).

---

## Dónde ver los resultados

Dashboard de Alef → **Dev · Agent Logs** → elige la **Empresa** → tool:
- **Registro de Errores** → todos los errores de los flujos de esa empresa.
- **Reporte de Tokens** → consumo por ejecución (columna *Tokens*).

Cada fila abre un detalle con flujo, nodo, id de ejecución, tokens (prompt/completion/total + modelo),
input y output. El punto rojo junto a la empresa avisa si hubo errores en las últimas 24 h.

---

## Resumen de qué crear

| Qué | Dónde | Cuántas veces |
|---|---|---|
| Migración `sql/flow_logs_tokens.sql` | Supabase SQL Editor | 1 vez |
| Workflow "❗ Error Handler — Global" (Error Trigger → Dashboard → Chatwoot) | n8n | 1 vez |
| Asignar ese workflow como *Error Workflow* en Settings | cada flujo n8n | por flujo |
| Nodo HTTP "Reporte de Tokens" al final | cada flujo con IA | por flujo |
| Env var `FLOW_LOG_API_KEY` | hosting | 1 vez (opcional, recomendado) |
