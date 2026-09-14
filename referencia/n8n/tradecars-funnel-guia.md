# Trade Cars — conectar el CRM con el funnel del dashboard

Cómo dejar de llenar el Excel del Power BI: el asesor completa los campos en la
conversación de Chatwoot y el funnel del dashboard se actualiza solo.

```
Asesor cambia el "estado" en el perfil de la conversación (Chatwoot)
   (una automatización de Chatwoot le pone además una etiqueta de color —
    eso es solo cosmético para las personas, n8n no la necesita)
        ↓  webhook conversation_updated
n8n  →  traduce "estado" al formato del dashboard  →  descarta si no se reconoce
        ↓
POST /api/tradecars/funnel-lead
        ↓
Funnel, Tabla de Leads y Análisis de Conversión, en vivo
```

Tiempo estimado: ~20 minutos.

> **Actualizado 14/09/2026.** La versión original de esta guía (26/08) pedía crear
> **dos** custom attributes (`perfil_coincide` + `status`). Trade Cars simplificó
> eso a un solo campo (`estado`) con los nombres de las 7 etapas del embudo, más
> una automatización de Chatwoot que aplica una etiqueta a juego. **El endpoint
> del dashboard no cambió** — sigue esperando `perfil_coincide` + `status` por
> separado, porque son los que alimentan las columnas `GENERATED` de
> `etapa`/`etapa_rank` y el trigger anti-regresión sobre miles de leads ya
> migrados. La traducción de uno a los otros vive ahora en el nodo **Armar
> payload** de n8n — ver la tabla del Paso 1b. El formato viejo (los dos campos
> separados) se sigue aceptando por compatibilidad, así que no rompe nada si
> alguna conversación todavía los tiene cargados de antes.

> ⚠️ **BUG CRÍTICO corregido el 14/09/2026 — si importaste el workflow ANTES de
> esta fecha, tenés que actualizar el nodo "Armar payload".** El Webhook de n8n
> **siempre** entrega `{ headers, params, query, body, webhookUrl, executionMode }`
> — el POST real de Chatwoot vive en `item.json.body`, nunca al nivel raíz. La
> versión del nodo "Armar payload" que traía el workflow (desde el 26/08, sin
> tocar esto) leía directo de `item.json` y por eso **nunca leyó nada real**:
> toda conversación mandaba el payload vacío y `_enviar:false`, sin ningún error
> visible — así se descubrió, probando en vivo con un cliente real marcado
> `lead` y viendo el nodo salir en blanco. Ya está corregido en el JSON de este
> repo (el nodo ahora desenvuelve `.body` primero). **Si tu workflow en n8n es
> de antes del 14/09, volvé a pegar el código del nodo "Armar payload"** (o
> reimportá el JSON completo) — ver el aviso al final del Paso 2.

---

## Paso 1 — El campo `estado` en Chatwoot

**Settings → Custom Attributes → pestaña `Conversation`.**

Debería existir ya (es el que se ve en el dropdown "estado" del panel de la
conversación). Si hace falta crearlo o revisar sus valores:

| Display Name | Key | Tipo | Valores de la lista |
|---|---|---|---|
| Estado | `estado` | **List** | `lead`, `cumple_politica`, `contactado`, `interesado`, `cita_agendada`, `cita_asistida`, `compra` |

> **Tiene que ser tipo List, no Text.** Con texto libre los asesores escriben
> "cita asistida", "Cita_Agendada", "asistió"… y como n8n compara contra estas
> claves exactas (en minúscula, sin espacios), cualquier variante que no calce
> se ignora en silencio — queda en el log de n8n como "estado no reconocido",
> pero el lead no avanza en el embudo hasta corregirlo.

**La etiqueta "clientes"** que aparece en Chatwoot (Settings → Labels) **no es
una de las 7 etapas de arriba**. Confirmado con el cliente (14/09/2026): por
ahora eso se revisa manualmente y queda fuera del embudo a propósito — si se
selecciona, el nodo de n8n no manda nada al dashboard.

**Los otros 6 campos siguen igual que antes** (fecha de cita, fecha de compra,
motivo de no cita, etc.) — no hace falta tocarlos si ya existen:

| Display Name | Key | Tipo | Valores de la lista |
|---|---|---|---|
| Fecha de cita | `fecha_cita` | Date | — |
| Fecha de compra | `fecha_compra` | Date | — |
| Motivo de no cita | `motivo_no_cita` | List | los de `tradecars_funnel_motivos` |
| Fecha probable de venta | `fecha_probable_venta` | Date | — |
| Próxima acción | `proxima_accion` | Text | — |
| Fecha de seguimiento | `fecha_seguimiento` | Date | — |

**Aplica el mismo criterio a `motivo_no_cita`:** si es texto libre, el módulo 3
agrupa "precio bajo", "Precio bajo" y "precio muy bajo" como tres motivos
distintos y el análisis pierde sentido.

### Paso 1b — Cómo traduce n8n el `estado`

El nodo **Armar payload** hace esta conversión antes de mandar nada al
dashboard (verificado línea por línea contra `utils/tradecarsFunnel.ts` — cada
fila cae en su barra exacta del embudo, en orden):

| `estado` en Chatwoot | Se manda al dashboard como | Etapa resultante |
|---|---|---|
| `lead` | `perfil_coincide=""`, `status=""` | LEADS |
| `cumple_politica` | `perfil_coincide="SI"`, `status="NO CONTACTADO"` | CUMPLE POLITICA |
| `contactado` | `perfil_coincide="SI"`, `status="NO INTERESADO"` | CONTACTADO |
| `interesado` | `perfil_coincide="SI"`, `status="EN SEGUIMIENTO"` | INTERESADOS |
| `cita_agendada` | `perfil_coincide="SI"`, `status="CITA"` | CITAS AGENDADAS |
| `cita_asistida` | `perfil_coincide="SI"`, `status="CITA ASISTIDA"` | CITAS ASISTIDAS |
| `compra` | `perfil_coincide="SI"`, `status="CONCRETADA"` | COMPRAS |

`lead` manda `perfil_coincide` **vacío, no `"NO"`**: en el dashboard, `"NO"`
significa "no cumple la política de compra" (rechazo definitivo — el lead
queda pegado en LEADS para siempre, aunque después se le cambie el status).
`lead` es solo "todavía sin calificar", y vacío logra caer en LEADS sin
marcarlo como rechazado.

No hace falta programar "sumar uno acá, restar uno de allá" al cambiar de
etapa: el embudo ya es acumulativo (cada barra cuenta lo que llegó a esa etapa
o más allá), así que mover el `estado` de un lead automáticamente lo mueve de
barra sin ninguna lógica extra.

### Paso 1c — Campaña (confirmado 14/09/2026)

**No hace falta crear ningún custom attribute para esto.** La campaña de cada
lead de Chatwoot es directamente su canal de origen — decisión del cliente:
no vale la pena que el asesor la llene a mano si ya se sabe por qué inbox
entró. El nodo la deriva del mismo `inbox_id` que usa para el canal:

| inbox_id | Canal (`canal_origen`, el filtro de todo el dashboard) | Campaña (`campana`, solo este reporte) |
|---|---|---|
| 88 | WhatsApp | WhatsApp |
| 81 | Instagram | Instagram |
| 82 | TikTok | TikTok |
| 83 | Facebook | **Messenger** |

El inbox 83 es el único caso donde canal y campaña **no** coinciden a
propósito: para el filtro de canal de todo el dashboard es "Facebook" (mismo
criterio que el resto del proyecto — Messenger es técnicamente una página de
Facebook), pero como campaña el cliente quiere verlo como "Messenger".

**"WEB" queda reservado para más adelante.** Hoy no hay ningún inbox de
Chatwoot para la web — esos leads entran por
`server/api/tradecars/formulario.ts` a una tabla completamente distinta
(`tradecars_solicitudes_venta`/`compra`) que todavía no escribe nada en
`tradecars_funnel_leads.campana`. Cuando se conecte esa pieza, usar el valor
exacto `"WEB"` para que aparezca junto a las otras 4 en el mismo reporte.

**La etiqueta `clientes`** de Chatwoot: confirmado con el cliente que por
ahora eso se revisa manualmente y no representa ninguna etapa del embudo. El
nodo la deja sin mapear a propósito — si se selecciona, no se manda nada al
dashboard.

---

## Paso 2 — Importar el workflow en n8n

1. n8n → **Workflows → Import from File**
2. Elegir `tradecars-funnel-workflow.json` (está junto a esta guía)
3. Abrir el nodo **Webhook Chatwoot** y copiar la **Production URL**
4. **Activar** el workflow (sin activarlo la Production URL no responde)

> **¿Ya tenías el workflow importado antes del 14/09/2026?** No hace falta
> reimportar todo (reimportar puede generar una Production URL nueva y hay que
> volver a pegarla en Chatwoot). Es más simple: abrir el nodo **Armar payload**
> en el editor de n8n, borrar todo el código y pegar el contenido actualizado
> de `parameters.jsCode` de ese mismo nodo en el `tradecars-funnel-workflow.json`
> de este repo (o pedirle el código ya extraído a quien te pasó esta guía).
> Guardar y volver a **Activar** el workflow. Después, repetir la prueba del
> Paso 4 con el mismo cliente que salió vacío — ahora sí debería llenarse.

El workflow trae 4 nodos:

| Nodo | Qué hace |
|---|---|
| **Webhook Chatwoot** | Recibe el evento |
| **Armar payload** | Traduce `estado` (y el canal, y las fechas) al formato del endpoint |
| **Ya clasificado?** | Descarta si el `estado` no se pudo traducir |
| **Enviar al funnel** | POST al dashboard |
| **Sin clasificar - no hacer nada** | A dónde va lo descartado |

El nodo **Armar payload** resuelve cuatro cosas que no son obvias:

- **Canal por inbox, no por tipo.** Se mapea primero por `inbox_id` —
  confirmar estos 4 números en **Chatwoot → Settings → Inboxes** antes de
  activar (son los que dio el cliente, no verificados por API):

  | inbox_id | Canal |
  |---|---|
  | 88 | WhatsApp |
  | 81 | Instagram |
  | 82 | TikTok |
  | 83 | Facebook *(Messenger entra por acá — Chatwoot lo agrupa como página de Facebook)* |

  Si el inbox no está en esta lista (o todavía no se confirmaron los números),
  cae a un respaldo por tipo de canal (`Channel::Whatsapp` → `WhatsApp`, etc.)
  — igual que en la versión anterior de este workflow. Si Trade Cars agrega un
  segundo inbox del mismo canal (otro número de WhatsApp, por ejemplo), sumar
  su id a la tabla.
- **`estado` → `perfil_coincide` + `status`:** la traducción de la tabla del Paso 1b.
- **Fechas:** Chatwoot mezcla epoch en segundos con ISO según el campo.
- **Payload anidado:** según la versión, la conversación viene en la raíz o dentro
  de `conversation`. Se contemplan las dos.

El filtro del tercer nodo importa: **Chatwoot dispara `conversation_updated` en
cada mensaje.** Sin él, cada "hola" del cliente escribiría en la tabla y se
llenaría de filas sin clasificar. Antes filtraba por "¿llenó perfil o status?";
ahora filtra por "¿el `estado` se pudo traducir?" — mismo propósito.

---

## Paso 3 — El webhook en Chatwoot

**Settings → Integrations → Webhooks → Add new webhook**

- **URL:** la Production URL del paso 2
- **Events:** marcar solo **`Conversation updated`**

No hace falta `Message created` — dispararía muchísimo más y el filtro lo
descartaría igual.

---

## Paso 4 — Probar

En Chatwoot, abrir una conversación de prueba y poner `estado = cita_agendada`
con una fecha de cita. Después:

- **n8n → Executions:** debe aparecer una ejecución en verde
- **Dashboard → Trade Cars → Tabla de Leads:** el lead aparece con etapa
  `CITAS AGENDADAS`
- **Alef → Dev · Agent Logs → Trade Cars → `Funnel Lead`:** queda el registro

Conviene probar también un estado por cada barra del embudo (la tabla completa
está en el Paso 1b) para confirmar que las 7 caen donde corresponde, y probar
`clientes` (u otro valor que no esté en la lista) para confirmar que **no**
genera ejecución — o que si la genera, cae en la rama "Sin clasificar".

Para probar el endpoint del dashboard sin pasar por Chatwoot ni n8n (ya con la
traducción hecha a mano, como la haría el nodo):

```bash
curl -X POST "https://dashboard.alef.company/api/tradecars/funnel-lead" \
  -H "x-api-key: tradecars-funnel-2026" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":990001,"nombre":"Prueba","telefono":"999888777","canal":"WhatsApp","asesor":"Rodrigo Paredes","fecha_derivacion":"2026-08-01","perfil_coincide":"SI","status":"CITA","fecha_cita":"2026-08-26"}'
```

Debe responder `etapa: "CITAS AGENDADAS"` y `fecha_funnel: "2026-08-26"`.

---

## Cosas que ya están resueltas

**No duplica.** El endpoint hace upsert por `conversation_id`. Chatwoot puede
disparar el mismo evento veinte veces: siempre actualiza la misma fila.

**Nunca entra en bucle de reintentos.** Si el status no es uno de los 6 válidos,
responde **200** con `ok:false` y `status_invalido` — se guarda igual, se marca en
rojo en el dashboard, pero n8n no lo trata como error.

**Envíos parciales.** Si el asesor solo cambia el status, no se borran las fechas
que ya estaban.

**Nombres del Power BI.** El endpoint también acepta `PERFIL COINCIDE`,
`FECHA DE CITA`, `MOTIVO DE NO CITA`… tal como salen del Excel actual, por si en
algún momento conviene migrar el histórico.

---

## Que el asesor coincida con el catálogo

El filtro "Asesor" del funnel cruza el nombre del catálogo `tradecars_asesores`
contra `meta.assignee.name` de Chatwoot. Están verificados y coinciden:

| Catálogo | Chatwoot |
|---|---|
| Rodrigo Paredes | ✅ |
| Jose Flores | ✅ |
| Brado Alvarado | ✅ |
| Gino Hurtado | ✅ |

Si entra un asesor nuevo, agregarlo a `tradecars_asesores` con el nombre **tal
cual aparece en Chatwoot**. Si no coincide, el lead igual cuenta en el embudo
pero no se puede filtrar por ese asesor.

---

## Si algo no llega

| Síntoma | Dónde mirar |
|---|---|
| **El nodo "Armar payload" sale TODO vacío** (`conversation_id: null`, todo `""`, `_enviar:false`), aunque el nodo **Webhook Chatwoot** sí muestra datos reales | El workflow es de antes del 14/09/2026 y tiene el bug del `.body` sin desenvolver — ver el aviso arriba del Paso 1 y la nota de actualización al final del Paso 2 |
| No hay ejecuciones en n8n | El webhook de Chatwoot apunta mal, o el workflow está inactivo |
| Ejecuta pero sale por "Sin clasificar" | El `estado` está vacío, tiene un valor que no está en la tabla del Paso 1b, o la Key del custom attribute no es exactamente `estado` |
| El log del nodo dice "estado no reconocido" | Revisar el valor exacto que mandó Chatwoot — puede ser `clientes` (sin mapear a propósito) o un typo en el dropdown |
| El canal sale mal (Instagram donde debería ser Facebook, etc.) | Los `inbox_id` de la tabla del Paso 2 no coinciden con los reales — confirmarlos en Chatwoot → Settings → Inboxes |
| 401 en el nodo HTTP | Falta o está mal el header `x-api-key` |
| Llega pero no sale en el funnel | Perfil = SI sin status: sale como aviso ámbar en el módulo 1 |
| Aparece en rojo | El status no es uno de los 6; revisar la traducción del Paso 1b — no debería pasar si `estado` viene de la lista cerrada |
| La campaña sale siempre vacía | El `inbox_id` no está en la tabla `INBOX_A_CAMPANA` del nodo (ver Paso 1c) — pasa si el lead entró por un inbox nuevo que todavía no se agregó |
