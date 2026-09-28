# Trade Cars — capturar leads desde mensajes de Chatwoot (con IA)

Guía para armar en n8n el flujo que lee los mensajes de Chatwoot como el de la captura de
ejemplo ("¡Hola! Completé el formulario... Marca: Suzuki, Modelo: Ciaz..."), los ordena con
un nodo de IA y los guarda en el dashboard — sin duplicar si el mismo teléfono ya escribió
antes.

> **Para copiar y pegar directo:** `tradecars-chatwoot-lead-workflow.json` (en esta misma
> carpeta) es el flujo completo, listo para importar en n8n (**Import from File / Import from
> URL / pegar el JSON**). Usa los nodos de IA más nuevos de n8n (**AI Agent + OpenAI Chat
> Model + Structured Output Parser**, del paquete LangChain), confirmado contra lo que ya
> tienen instalado. Arma los 9 nodos con las conexiones ya hechas — solo falta abrir el nodo
> **"OpenAI Chat Model"** y ponerle TU credencial de OpenAI (las credenciales nunca se
> exportan en el JSON, por seguridad) y registrar el webhook en Chatwoot (§4 más abajo).

## 0. Qué hay que tener antes

| Necesitas | Estado |
|---|---|
| El SQL corrido: `sql/tradecars_leads_chatwoot.sql` | **Hecho** (28/09/2026) |
| Credencial de IA en n8n (OpenAI, o la que ya usen en otros flujos) | Ya deben tenerla — la usa el Tasador |
| Credencial/token de Chatwoot en n8n | Ya la tienen — la usan las 17 automatizaciones existentes |

## 1. El flujo, en 5 pasos

```
Webhook Chatwoot (message_created, entrante)
        │
        ▼
¿Es un mensaje que parece formulario?  (filtro simple, ver §2)
        │ sí
        ▼
AI Agent + OpenAI Chat Model + Structured Output Parser  (ver §3, el prompt)
        │
        ▼
Armar payload  (junta lo que sacó la IA con teléfono/nombre/conversation_id de Chatwoot)
        │
        ▼
HTTP Request → POST /api/tradecars/chatwoot-lead  (ver §5)
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

### §3. Los 3 nodos de IA

El flujo usa el trío estándar de n8n para extracción estructurada (el que ya viene instalado
si usan **AI Agent** en otros flujos, como el Tasador):

| Nodo | Qué hace |
|---|---|
| **OpenAI Chat Model** | El modelo (`gpt-4.1-mini` por defecto — cámbialo si prefieren otro). Acá va TU credencial de OpenAI |
| **Formato de salida** (Structured Output Parser) | Obliga a que la respuesta sea el JSON con exactamente estos 8 campos: `telefono, marca, modelo, anio, kilometraje, placa, distrito, correo`. Sin esto, un modelo de IA a veces agrega texto alrededor del JSON ("Claro, aquí está:") y rompe el parseo |
| **AI Agent** | El que recibe el mensaje (`{{ $json.mensaje }}`) y trae ya escrito el prompt de sistema |

**El prompt de sistema** (ya viene en el nodo AI Agent → pestaña Options → System Message):
```
Eres un extractor de datos para Trade Cars Perú. Lees un mensaje de WhatsApp donde alguien
completó un formulario para vender su auto y extraes los datos del vehículo y del contacto
que encuentres, literalmente, en el texto.

Reglas:
- Si un dato NO aparece explícitamente en el mensaje, déjalo vacío/null. Nunca inventes ni
  asumas un valor (ni un distrito, ni una marca, ni un año).
- El kilometraje y el año van como número, sin texto ni unidades (ej. 110000, no "110,000 km").
- La placa va tal cual la escribió la persona, sin agregar guiones si no los tiene.
- No proceses nada que no sea un dato del formulario (ignora saludos, firmas, emojis).
```

El **nombre del contacto** NO se le pide a la IA — se lee directo del contacto de Chatwoot
(`conversation.meta.sender.name`, ya extraído por el nodo "Leer mensaje").

**El teléfono es distinto: se pide en los DOS lados, con Chatwoot mandando.** El nodo "Armar
payload" usa `sender.phone_number` de Chatwoot cuando existe (WhatsApp), y si viene vacío usa
el que la IA sacó del texto del mensaje. Esto importa porque **los contactos que escriben por
Instagram o Facebook casi nunca tienen `phone_number` en Chatwoot** — solo tienen su usuario de
IG/FB — así que para esos leads el único lugar donde aparece el teléfono real es el propio
texto del formulario ("Phone number: 972619000"). Probado en vivo el 28/09/2026 con un lead
real de Instagram: sin este respaldo, el endpoint rechazaba el lead con 400 "Falta el
teléfono".

> **Si editas el "JSON Example" del nodo "Formato de salida" a mano**, el nombre de cada
> campo tiene que salir EXACTO como lo escribas ahí (ej. si pones `"Telefono"` con mayúscula,
> el dato real sale con esa mayúscula). El nodo "Armar payload" ya busca cada campo sin
> importar mayúsculas/minúsculas, así que no hace falta que coincida letra por letra con el
> ejemplo de esta guía — pero si un campo nuevo no aparece nunca, lo primero a revisar es que
> el nombre esté bien escrito en los dos lados (el ejemplo del parser y el `campo(...)` de
> "Armar payload").

Si prefieren usar otro modelo/proveedor (Claude, Gemini, etc.), solo hay que cambiar el nodo
"OpenAI Chat Model" por el equivalente de ese proveedor y volver a conectarlo al AI Agent — el
resto del flujo no cambia.

### §4. El webhook en Chatwoot

**Settings → Integrations → Webhooks → Add new webhook**

- **URL:** la Production URL del nodo "Webhook Chatwoot" (ábrelo y cópiala — solo aparece
  completa cuando el workflow está **activado**)
- **Events:** marcar **`Message created`**

A diferencia del flujo del Funnel (que escucha `Conversation updated`), acá hace falta
`Message created` porque lo que dispara todo es el TEXTO del mensaje que llega, no un cambio
de atributo. El nodo "Leer mensaje" ya descarta los mensajes salientes (los que manda el
asesor) — solo sigue con los `message_type: incoming`.

> ⚠️ **Probado en vivo el 28/09/2026: si solo marcas "Conversation Created" (sin "Message
> Created"), el flujo SÍ ejecuta pero nunca encuentra nada que procesar** — ese evento se
> dispara al abrir la conversación, antes de que exista el mensaje con el texto del
> formulario, así que no trae `content` ni `message_type`. Cae siempre por la rama "No es
> formulario", sin ningún error visible en n8n — se ve "verde" igual. Confirma que **"Message
> Created" esté marcado** (puedes dejar "Conversation Created" también marcado si quieres; el
> flujo la ignora sola, sin problema).

### §5. Guardar — llamada HTTP

Dos nodos, ya conectados en el JSON:

1. **"Armar payload"** (Code) — junta lo que ya se sabía por Chatwoot (`telefono`,
   `nombre_chatwoot`, `conversation_id`, `account_id`, `inbox_id`, `mensaje_original`, todo
   leído en el nodo "Leer mensaje") con lo que sacó la IA (`marca`, `modelo`, `anio`,
   `kilometraje`, `placa`, `distrito`, `correo`), en un solo objeto con exactamente los
   nombres de campo que espera el endpoint. Es defensivo con la forma exacta de la
   respuesta de la IA (a veces viene ya parseada, a veces como texto) — no debería hacer
   falta tocarlo.
2. **"Guardar lead"** (HTTP Request) — POST directo con `JSON.stringify($json)` de lo que
   armó el nodo anterior:

```
URL:     https://dashboard.alef.company/api/tradecars/chatwoot-lead
Headers: x-api-key: tradecars-chatwoot-lead-2026
```

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
