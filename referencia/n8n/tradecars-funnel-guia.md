# Trade Cars — conectar el CRM con el funnel del dashboard

Cómo dejar de llenar el Excel del Power BI: el asesor completa los campos en la
conversación de Chatwoot y el funnel del dashboard se actualiza solo.

```
Asesor llena los campos en el perfil de la conversación (Chatwoot)
        ↓  webhook conversation_updated
n8n  →  arma el payload  →  descarta si aún no está clasificado
        ↓
POST /api/tradecars/funnel-lead
        ↓
Funnel, Tabla de Leads y Análisis de Conversión, en vivo
```

Tiempo estimado: ~20 minutos.

---

## Paso 1 — Los 8 campos en Chatwoot

**Settings → Custom Attributes → pestaña `Conversation` → Add Attribute.**

Crear los 8 con **exactamente** estas claves (`Key`), que es lo que lee n8n:

| Display Name | Key | Tipo | Valores de la lista |
|---|---|---|---|
| Perfil coincide | `perfil_coincide` | **List** | `SI`, `NO` |
| Status | `status` | **List** | `NO CONTACTADO`, `NO INTERESADO`, `EN SEGUIMIENTO`, `CITA`, `CITA ASISTIDA`, `CONCRETADA` |
| Fecha de cita | `fecha_cita` | Date | — |
| Fecha de compra | `fecha_compra` | Date | — |
| Motivo de no cita | `motivo_no_cita` | List | los de `tradecars_funnel_motivos` |
| Fecha probable de venta | `fecha_probable_venta` | Date | — |
| Próxima acción | `proxima_accion` | Text | — |
| Fecha de seguimiento | `fecha_seguimiento` | Date | — |

> **`perfil_coincide` y `status` tienen que ser tipo List, no Text.**
> Con texto libre los asesores escriben "cita asistida", "CITA-ASISTIDA", "asistió"…
> y cada variante rompe el conteo del embudo. El dashboard las detecta y las marca
> en rojo, pero es mucho mejor que no ocurra.

**Aplica el mismo criterio a `motivo_no_cita`:** si es texto libre, el módulo 3
agrupa "precio bajo", "Precio bajo" y "precio muy bajo" como tres motivos
distintos y el análisis pierde sentido.

---

## Paso 2 — Importar el workflow en n8n

1. n8n → **Workflows → Import from File**
2. Elegir `tradecars-funnel-workflow.json` (está junto a esta guía)
3. Abrir el nodo **Webhook Chatwoot** y copiar la **Production URL**
4. **Activar** el workflow (sin activarlo la Production URL no responde)

El workflow trae 4 nodos:

| Nodo | Qué hace |
|---|---|
| **Webhook Chatwoot** | Recibe el evento |
| **Armar payload** | Traduce el formato de Chatwoot al del endpoint |
| **Ya clasificado?** | Descarta si el asesor aún no llenó perfil ni status |
| **Enviar al funnel** | POST al dashboard |

El nodo **Armar payload** resuelve tres cosas que no son obvias:

- **Canal:** Chatwoot manda `Channel::Whatsapp`; el dashboard espera `WhatsApp`.
- **Fechas:** Chatwoot mezcla epoch en segundos con ISO según el campo.
- **Payload anidado:** según la versión, la conversación viene en la raíz o dentro
  de `conversation`. Se contemplan las dos.

El filtro del tercer nodo importa: **Chatwoot dispara `conversation_updated` en
cada mensaje.** Sin él, cada "hola" del cliente escribiría en la tabla y se
llenaría de filas sin clasificar.

---

## Paso 3 — El webhook en Chatwoot

**Settings → Integrations → Webhooks → Add new webhook**

- **URL:** la Production URL del paso 2
- **Events:** marcar solo **`Conversation updated`**

No hace falta `Message created` — dispararía muchísimo más y el filtro lo
descartaría igual.

---

## Paso 4 — Probar

En Chatwoot, abrir una conversación de prueba y poner `perfil_coincide = SI` y
`status = CITA` con una fecha de cita. Después:

- **n8n → Executions:** debe aparecer una ejecución en verde
- **Dashboard → Trade Cars → Tabla de Leads:** el lead aparece con etapa
  `CITAS AGENDADAS`
- **Alef → Dev · Agent Logs → Trade Cars → `Funnel Lead`:** queda el registro

Para probar sin Chatwoot:

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
| No hay ejecuciones en n8n | El webhook de Chatwoot apunta mal, o el workflow está inactivo |
| Ejecuta pero sale por "Sin clasificar" | El asesor no llenó `perfil_coincide` ni `status`, o las Keys no coinciden |
| 401 en el nodo HTTP | Falta o está mal el header `x-api-key` |
| Llega pero no sale en el funnel | Perfil = SI sin status: sale como aviso ámbar en el módulo 1 |
| Aparece en rojo | El status no es uno de los 6; corregirlo en Chatwoot |
