# Trade Cars — capturar leads desde mensajes de Chatwoot (con IA)

Guía para armar en n8n el flujo que lee los mensajes de Chatwoot como el de la captura de
ejemplo ("¡Hola! Completé el formulario... Marca: Suzuki, Modelo: Ciaz..."), los ordena con
un nodo de IA y los guarda en el dashboard — sin duplicar si el mismo teléfono ya escribió
antes.

> **Para copiar y pegar directo:** `tradecars-chatwoot-lead-workflow.json` (en esta misma
> carpeta) es el flujo completo, listo para importar en n8n (**Import from File / Import from
> URL / pegar el JSON**). Arma los 6 nodos de abajo con las conexiones ya hechas — solo falta
> que abras el nodo **"Extraer datos con IA"** y le pongas TU credencial de OpenAI (las
> credenciales nunca se exportan en el JSON, por seguridad), y que confirmes que el nodo
> **"Webhook Chatwoot"** apunte al mismo evento de Chatwoot (`message_created`) que ya usan
> los demás flujos de Trade Cars. Si tu n8n usa los nodos más nuevos de IA (LangChain / "AI
> Agent") en vez del nodo clásico "OpenAI", reemplaza ese nodo — el resto del flujo no cambia.

## 0. Qué hay que tener antes

| Necesitas | Estado |
|---|---|
| El SQL corrido: `sql/tradecars_leads_chatwoot.sql` | Pendiente |
| Credencial de IA en n8n (OpenAI, o la que ya usen en otros flujos) | Ya deben tenerla — la usa el Tasador |
| Credencial/token de Chatwoot en n8n | Ya la tienen — la usan las 17 automatizaciones existentes |

## 1. El flujo, en 4 pasos

```
Webhook Chatwoot (message_created, entrante)
        │
        ▼
¿Es un mensaje que parece formulario?  (filtro simple, ver §2)
        │ sí
        ▼
Nodo de IA — extrae los campos del texto  (ver §3, el prompt)
        │
        ▼
HTTP Request → POST /api/tradecars/chatwoot-lead  (ver §4)
```

### §2. Filtro: ¿vale la pena mandarlo al IA?

No todos los mensajes que llegan a una conversación son formularios — la mayoría son
respuestas normales del cliente o del asesor. Antes de gastar una llamada a la IA en cada
mensaje, filtra por algo que SIEMPRE traiga el mensaje de formulario, por ejemplo:

- Que sea un mensaje **entrante** (`message_type == 'incoming'`), y
- Que el texto contenga una frase fija que ponga el bot que arma el mensaje (ej. "Completé
  el formulario" o "obtener más información sobre el negocio") — ajusta esto al texto real
  que use su bot de Meta/Zapier.

Si el mensaje no calza con el filtro, el flujo simplemente no continúa (nodo IF).

### §3. Nodo de IA — el prompt

Usa un nodo de IA (OpenAI Chat, o el que ya tengan configurado) en modo **structured
output / JSON** para que la respuesta sea siempre parseable. Prompt sugerido:

**System:**
```
Eres un extractor de datos. Lees un mensaje de WhatsApp donde alguien completó un
formulario para vender su auto y devuelves SOLO un JSON con los campos que encuentres.
Si un campo no aparece en el mensaje, ponlo en null — nunca inventes un valor.
No agregues texto fuera del JSON.

Formato exacto de salida:
{
  "marca": string|null,
  "modelo": string|null,
  "anio": number|null,
  "kilometraje": number|null,
  "placa": string|null,
  "distrito": string|null,
  "correo": string|null
}
```

**User:** el texto del mensaje (`{{ $json.content }}` o el campo que traiga el body del
webhook de Chatwoot).

El **teléfono** y el **nombre del contacto** NO se le piden a la IA — se leen directo del
contacto de Chatwoot (`conversation.meta.sender.phone_number` y `.name` en el payload del
webhook), son datos que Chatwoot ya trae confirmados y no hace falta que la IA los adivine
del texto.

### §4. Guardar — llamada HTTP

**Nodo HTTP Request**, método POST:

```
URL:     https://dashboard.alef.company/api/tradecars/chatwoot-lead
Headers: x-api-key: tradecars-chatwoot-lead-2026
         Content-Type: application/json
Body (JSON):
{
  "telefono": "{{ $('Webhook Chatwoot').item.json.body.conversation.meta.sender.phone_number }}",
  "nombre_chatwoot": "{{ $('Webhook Chatwoot').item.json.body.conversation.meta.sender.name }}",
  "correo": "{{ $json.correo }}",
  "marca": "{{ $json.marca }}",
  "modelo": "{{ $json.modelo }}",
  "anio": {{ $json.anio }},
  "kilometraje": {{ $json.kilometraje }},
  "placa": "{{ $json.placa }}",
  "distrito": "{{ $json.distrito }}",
  "mensaje_original": "{{ $('Webhook Chatwoot').item.json.body.content }}",
  "conversation_id": {{ $('Webhook Chatwoot').item.json.body.conversation.id }},
  "account_id": {{ $('Webhook Chatwoot').item.json.body.account.id }},
  "inbox_id": {{ $('Webhook Chatwoot').item.json.body.inbox.id }}
}
```

Ajusta las rutas `$json...` al nombre real de tus nodos — esto es la forma, no una copia
exacta (cada instalación de n8n nombra los nodos distinto).

**Respuesta del endpoint** (siempre 200, salvo 400/401/409 — nunca hace falta reintentar):

```jsonc
{ "ok": true, "duplicado": false, "id": "uuid-nuevo" }   // se guardó
{ "ok": true, "duplicado": true,  "id": "uuid-existente" } // ya había un lead con ese teléfono — no se tocó nada
```

Si ves `409` con el mensaje "Falta correr sql/...": significa que la migración de Supabase
todavía no se corrió — avisa para que se corra una vez.

## 2. Qué NO hace este flujo (a propósito, por ahora)

- **No asigna el lead a ningún asesor.** Eso es un paso aparte, pendiente — primero esta
  captura, confirmado con el cliente.
- **No cruza contra los chats existentes ni contra `tradecars_funnel_leads`.** Es una tabla
  nueva y separada (`tradecars_leads_chatwoot`), a propósito — ver el aviso en
  `CLAUDE.md` sobre por qué se decidió así.
- **No reintenta ni reprocesa mensajes viejos.** El flujo solo actúa sobre mensajes nuevos
  que entren mientras esté activo.

## 3. Probar sin esperar un mensaje real

```bash
curl -s -X POST "https://dashboard.alef.company/api/tradecars/chatwoot-lead" \
  -H "x-api-key: tradecars-chatwoot-lead-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "962942416",
    "nombre_chatwoot": "Marco Cusicuna",
    "correo": "marcocusicuna.23@gmail.com",
    "marca": "Suzuki", "modelo": "Ciaz", "anio": 2017, "kilometraje": 110000,
    "placa": "AZC654", "distrito": "Surco",
    "mensaje_original": "¡Hola! Completé el formulario..."
  }'
```

Repite el mismo `curl` una segunda vez: la respuesta debe cambiar a `"duplicado": true` con
el mismo `id` — esa es la prueba de que la deduplicación por teléfono funciona.
