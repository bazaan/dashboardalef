# Trade Cars — Asignar conversaciones nuevas a un asesor (con continuidad)

Guía del flujo **"ASIGNACION ASESOR-TRADECARS"** en n8n: cuando entra una conversación nueva
sin asignar, se reparte entre 4 asesores por turno (round robin) — EXCEPTO si el teléfono ya
tuvo una conversación anterior con un asesor asignado, en cuyo caso se deriva directo a ESE
mismo asesor (continuidad), sin pasar por el turno.

> **Para copiar y pegar directo:** `(cambiar ids)ASIGNACION ASESOR-TRADECARS (1).json` (en
> Descargas) ya trae los 4 nodos nuevos conectados. Solo falta:
> 1. Confirmar que `sql/tradecars_leads_chatwoot_asesor.sql` ya corrió en Supabase (si no,
>    "Buscar asesor previo" y el endpoint de guardado van a fallar).
> 2. Abrir el nodo **"Round Robin Asesores"** y poner los NOMBRES reales de los 4 asesores
>    (hoy dice "Asesor 1".."Asesor 4" con los ids 55-58 — el id 55 ya se confirmó que es
>    **Rodrigo Paredes**; según `tradecars_asesores` los otros 3 deberían ser Jose Flores,
>    Brado Alvarado y Gino Hurtado, pero confirma el id de cada uno en Chatwoot antes de
>    ponerlos, no asumas el orden).

## El problema que resuelve

Antes, la conversación nueva se repartía siempre al azar (round robin), sin importar si ese
mismo cliente ya había escrito antes y ya tenía un asesor trabajando su caso — el cliente
podía terminar hablando con una persona distinta cada vez que escribía.

## Cómo decide ahora

```
Webhook (conversation_created, sin asignar)
        │
        ▼
Extraer teléfono   (del propio payload del webhook — ver "El truco del teléfono" abajo)
        │
        ▼
Buscar asesor previo   → GET /api/tradecars/chatwoot-asesor-previo?telefono=...
        │
        ▼
¿Tiene asesor previo?
    │ sí                              │ no
    ▼                                 ▼
Usar asesor previo            Round Robin Asesores (turno normal)
    │                                 │
    └────────────┬────────────────────┘
                 ▼
          Asignar Asesor   (Chatwoot: POST .../assignments)
                 │
                 ▼
               Wait (12s — le da tiempo al OTRO flujo a crear la fila de esta conversación)
                 │
                 ▼
          Update a row   (guarda asesor_asignado / id_asesor_asignado en tradecars_leads_chatwoot)
```

## El truco del teléfono: no se espera al otro flujo

Este workflow dispara con `conversation_created` — ANTES de que exista la fila en
`tradecars_leads_chatwoot` para esta conversación (esa la crea el flujo **"Trade Cars — Lead
desde mensaje de Chatwoot (IA)"**, que recién lee el mensaje con IA en el evento
`message_created`, unos segundos después). Si este flujo esperara esa fila para saber el
teléfono, la decisión de a quién asignar llegaría tarde.

Por eso **"Extraer teléfono" lo saca directo del propio payload del webhook**, sin esperar
nada:
- Si es WhatsApp, Chatwoot ya trae `meta.sender.phone_number` confirmado.
- Si es Instagram/Facebook (como en el ejemplo real probado), ese campo viene `null` —
  Chatwoot no conoce el teléfono real de esos contactos. Se busca con una expresión regular
  en el texto del primer mensaje, que **el propio `conversation_created` ya incluye**
  (`messages[0].content`) — el mismo patrón "Phone number: 972619000" que usa el otro flujo.

Probado con el payload real fijado (`pinData`) del nodo Webhook: saca `telefono: "972619000"`
correctamente por la vía regex.

## Por qué la clave de deduplicación cambió a `conversation_id`

`tradecars_leads_chatwoot` deduplicaba antes por TELÉFONO ("un teléfono = una fila para
siempre") — eso bloqueaba en silencio la fila de la SEGUNDA conversación de un cliente que
vuelve a escribir, y el paso final "Update a row" (que busca `WHERE conversation_id = X`)
nunca encontraba nada que actualizar. Se corrió `sql/tradecars_leads_chatwoot_asesor.sql`
para cambiar la clave única a `conversation_id`: ahora CADA conversación tiene su propia fila,
y lo que se sigue evitando duplicar es la MISMA conversación reprocesada (reintentos de
webhook), no las conversaciones nuevas de un cliente que repite.

## El webhook en Chatwoot

**Settings → Integrations → Webhooks → el webhook que apunta a `.../webhook/asignaciontradecars`**

- **Events:** `Conversation Created` (es el que ya filtra el nodo "Es Conversación Nueva y Sin
  Asignar" por `event === 'conversation_created'`).

## Probar

1. Confirma que `id_asesor_asignado`/`asesor_asignado` de una conversación anterior de prueba
   tengan un valor real (ya lo tienes: Marcelo Zumaeta / 972619000 → Rodrigo Paredes / 55).
2. Simula una conversación NUEVA del mismo contacto (o cualquier mensaje que incluya
   "Phone number: 972619000" en el texto). Debería:
   - Pasar por "Usar asesor previo" (no por "Round Robin Asesores").
   - Asignarse en Chatwoot a Rodrigo Paredes otra vez.
   - La fila NUEVA (con el `conversation_id` de esta conversación) debe quedar con
     `asesor_asignado = "Rodrigo Paredes"`.
3. Prueba con un teléfono que nunca haya escrito: debe pasar por "Round Robin Asesores" y
   repartirse al siguiente turno.

Diagnóstico rápido sin esperar un mensaje real:

```bash
curl -s "https://dashboard.alef.company/api/tradecars/chatwoot-asesor-previo?telefono=972619000" \
  -H "x-api-key: tradecars-chatwoot-lead-2026"
```
