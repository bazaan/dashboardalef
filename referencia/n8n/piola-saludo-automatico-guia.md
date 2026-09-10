# Piola — saludo automático al primer mensaje de WhatsApp

Reunión 07/09/2026 (00:17:58). Héctor Córdova: *"¿Es posible de dar una
respuesta automática al primer mensaje?... que sea automático, nada más"* —
para capturar el nombre del cliente antes de seguir la conversación.

Esto **no vive en el dashboard**: Piola recibe WhatsApp por Chatwoot (cuenta
`18`, inbox `1` — ver `remarketing_config`), y el saludo hay que armarlo ahí o
en n8n. Lo que sí vive en el dashboard es el **texto del mensaje**, para que
Héctor pueda cambiarlo sin pedir un redeploy: **Piola → Configuración →
Mensajes automáticos**, guardado en la tabla `piola_mensajes`
(`clave='bienvenida_whatsapp'`).

```
Contacto nuevo escribe por WhatsApp
        ↓  conversation_created (inbox 1, cuenta 18)
Automatización (Chatwoot o n8n) → ¿es su primer mensaje?
        ↓ sí
GET piola_mensajes?clave=eq.bienvenida_whatsapp  (Supabase REST, key anon)
        ↓
Enviar ese texto como respuesta automática
```

## Leer el mensaje guardado

Sin pasar por el dashboard — es una tabla con lectura pública para `anon`:

```bash
curl -s "https://qzmgizrvdukyxvpgclvd.supabase.co/rest/v1/piola_mensajes?clave=eq.bienvenida_whatsapp&select=contenido" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Devuelve `[{"contenido": "Hola, ¿cómo estás? Soy Héctor Córdoba..."}]`. Ese es
el texto sembrado con el ejemplo que dio Héctor en la reunión — se puede
editar desde el dashboard en cualquier momento sin tocar el workflow.

## Opción A — Automatización nativa de Chatwoot (más simple)

**Chatwoot → Settings → Automation → Add rule**, cuenta 18:

- **Event:** Conversation Created
- **Conditions:** Inbox = (el inbox de Piola)
- **Actions:** Send a message → pegar el texto (o, si tu plan de Chatwoot no
  soporta variables dinámicas en la acción, dejar el texto fijo y actualizarlo
  a mano acá cuando cambie — la ventaja de guardarlo en la BD se pierde en
  este camino).

Limitación: dispara en cada conversación NUEVA, no solo en el contacto que
escribe por primera vez en la vida. Si el contacto ya había hablado antes y
Chatwoot abre una conversación nueva (pasaron las 24 h de WhatsApp), se
repite el saludo. Para Piola esto puede ser aceptable — es la misma señal que
"hay que volver a preguntar quién eres" — pero no es exactamente lo que pidió
Héctor si lo que quiere es *solo* la primera vez de cada contacto.

## Opción B — n8n (más precisa, jala el texto de la BD)

1. **Webhook** de Chatwoot → evento `conversation_created` (Settings →
   Integrations → Webhooks, cuenta 18, apuntando al webhook de n8n).
2. **HTTP Request** → `GET .../conversations?inbox_id=1&contact_id=<id>` con
   el token de la API de Chatwoot, para contar cuántas conversaciones tiene
   ese `contact_id` — si es la primera, sigue; si no, corta el flujo (nodo IF).
3. **HTTP Request** → el `curl` de arriba, para traer el texto vigente.
4. **HTTP Request** → `POST /api/v1/accounts/18/conversations/<id>/messages`
   con `{ content: <texto>, message_type: "outgoing" }`, mismo patrón que ya
   usa `server/api/remarketing/send.post.ts` para enviar por Chatwoot.

## Pendiente

Héctor dijo que iba a mandar *"el formato y contenido deseado"* — hasta que
llegue, el texto sembrado es el ejemplo que dio en la reunión, no la
redacción final. Avisar al equipo de n8n que el mensaje se lee de la BD (no
se hardcodea) para que un cambio de texto no requiera tocar el workflow.
