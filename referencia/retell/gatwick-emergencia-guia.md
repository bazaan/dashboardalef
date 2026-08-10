# Gatwick — Conectar la llamada con el dashboard (Retell)

Qué hay que agregar **a mano en Retell** para que una emergencia reportada por teléfono
haga exactamente lo mismo que ya hace WhatsApp: aparecer en el monitor de emergencias
y avisar a los supervisores.

El flujo actual no se toca. Solo se agregan **2 tools** y **2 nodos**.

---

## 0. Antes que nada — correr el SQL

En Supabase → SQL Editor → pegar y ejecutar `sql/gatwick_retell_emergencia.sql`.

Crea la tabla `retell_llamadas_GATWICK` (que nunca se había creado por SQL, aunque los
endpoints ya la usaban) y agrega a `gatwick_emergencias` las columnas de trazabilidad.

Sin esto la emergencia igual se crea —el endpoint es tolerante— pero se pierde el origen
y el anti-duplicado por `call_id` deja de funcionar.

---

## 1. Tool `consultar_ascensor`

> **Por qué hace falta:** el global prompt dice *"consulta el catálogo interno (base de
> conocimiento)"*, pero en el agente `knowledge_base_ids` está **vacío**. Hoy el bot no
> tiene forma de resolver `AP-0017` → edificio: se lo inventa o se queda trabado.

En Retell → el agente → pestaña **Tools** → **Add Tool** → *Custom Function*:

| Campo | Valor |
|---|---|
| Name | `consultar_ascensor` |
| Description | `Convierte el código del sticker del equipo (AP-0017, MV-0022) en el edificio, dirección y distrito. Ejecutar apenas el cliente dicte el código, antes de confirmarle el edificio.` |
| Method | `POST` |
| URL | `https://dashboard.alef.company/api/retell/gatwick-ascensor` |
| Headers | `x-api-key: retell-gatwick-2026` y `Content-Type: application/json` |
| Timeout | `20000` |
| Speak During Execution | **off** |
| Speak After Execution | **on** |

**Parameters** (JSON):

```json
{
  "type": "object",
  "properties": {
    "codigo_ascensor": {
      "type": "string",
      "description": "El código tal como lo dictó el cliente, sin corregirlo. Ej: 'AP cero cero uno siete', 'ap 17', 'AP-0017'."
    }
  },
  "required": ["codigo_ascensor"]
}
```

**Store Fields as Variables** (Response Variables):

| Variable | Campo de la respuesta |
|---|---|
| `edificio_encontrado` | `encontrado` |
| `edificio_nombre` | `edificio` |
| `edificio_direccion` | `direccion` |
| `edificio_distrito` | `distrito` |
| `codigo_normalizado` | `codigo` |
| `confirmacion_edificio` | `confirmacion` |

> El campo `confirmacion` viene redactado para leerse tal cual:
> *"Es el edificio ABRAHAM VALDELOMAR I 549, en Abraham Valdelomar 549, Pueblo Libre. ¿Es correcto?"*
> Si el código no existe, `confirmacion` ya trae la frase para pedir que lo repita.

### Dónde engancharla

Nodo **Function** nuevo, entre el nodo que pide el código (`node-1784579114062`, *"Necesito
identificar el equipo exacto…"*) y el que confirma (`node-1784579292296`, *"Repite el código
en voz alta…"*).

```
"¿Puede dictarme el código?"  →  [consultar_ascensor]  →  "Es el edificio X… ¿es correcto?"
                                        │
                                    else (no encontrado)
                                        └→  node-1784579440983 ("¿Puede indicarme de nuevo el código?")
```

En el nodo de confirmación cambiá la instrucción a:

```
Lee al cliente: {{confirmacion_edificio}}
Si el cliente confirma, continúa. Si dice que no es ese edificio, pide el código otra vez.
```

---

## 2. Tool `registrar_emergencia`

Esta es la que **crea la emergencia y dispara los WhatsApp**.

| Campo | Valor |
|---|---|
| Name | `registrar_emergencia` |
| Description | `Registra la emergencia confirmada en el sistema y notifica a los supervisores. Ejecutar UNA sola vez, después de confirmar el edificio y de tener el número de WhatsApp para el seguimiento.` |
| Method | `POST` |
| URL | `https://dashboard.alef.company/api/retell/gatwick-emergencia` |
| Headers | `x-api-key: retell-gatwick-2026` y `Content-Type: application/json` |
| Timeout | `30000` |
| Speak During Execution | **on** — texto: `Un momento, estoy registrando la emergencia.` (geocodificar puede tardar unos segundos) |
| Speak After Execution | **on** |

**Parameters** (JSON):

```json
{
  "type": "object",
  "properties": {
    "codigo_ascensor":      { "type": "string",  "description": "Código confirmado del equipo. Vacío si nunca se pudo obtener." },
    "tipo_atrapado":        { "type": "string",  "description": "persona, vehiculo o mascota." },
    "cantidad_atrapados":   { "type": "number",  "description": "Cuántos hay atrapados. 0 si no se sabe." },
    "descripcion":          { "type": "string",  "description": "Resumen en una o dos frases de lo que reportó el cliente." },
    "piso":                 { "type": "string",  "description": "Piso o nivel donde quedó el equipo, si se sabe." },
    "contacto_nombre":      { "type": "string",  "description": "Nombre de quien reporta." },
    "telefono_seguimiento": { "type": "string",  "description": "Celular con WhatsApp para el seguimiento del técnico, solo dígitos." },
    "critico":              { "type": "boolean", "description": "true si se mencionó fuego, humo, agua, sangre, alguien desmayado o con dificultad para respirar." },
    "edificio_nombre":      { "type": "string",  "description": "Solo si NO hubo código válido: nombre del edificio que dictó el cliente." },
    "direccion":            { "type": "string",  "description": "Solo si NO hubo código válido: dirección que dictó el cliente." },
    "distrito":             { "type": "string",  "description": "Solo si NO hubo código válido: distrito." },
    "zona_equipo":          { "type": "string",  "description": "Solo si NO hubo código válido: torre A/B, sótano, de servicio, panorámico." }
  },
  "required": ["tipo_atrapado"]
}
```

**Store Fields as Variables:**

| Variable | Campo |
|---|---|
| `emergencia_id` | `emergencia_id` |
| `emergencia_ok` | `ok` |
| `confirmacion_registro` | `confirmacion` |

### Dónde engancharla

Nodo **Function** nuevo, justo **antes** del nodo `Guardar Llamada Gatwick`
(`node-1783550409041`), en la rama de emergencia — es decir después de
`node-1784579724491` (el de la foto/video opcional):

```
… → "puede enviar una foto (opcional)" → [registrar_emergencia] → [Guardar Llamada Gatwick] → End Call
```

En el nodo siguiente (o en el End Call) hacé que lea `{{confirmacion_registro}}`, que ya
viene redactado:

> *"Listo. Ya reporté la emergencia en ABRAHAM VALDELOMAR I 549. El equipo fue notificado
> y el técnico rescatista sale en breve."*

Y después la frase de seguridad que ya está en el prompt (no forzar puertas, mantenerse
alejado, etc.).

---

## 3. Un párrafo en el Global Prompt

Agregar al final de **REGLAS DE ORO** (no reemplaza nada, solo suma):

```
10. **Registrar antes de cerrar.** En toda emergencia confirmada, ejecuta
    `registrar_emergencia` UNA sola vez, después de confirmar el edificio y de
    tener el número de WhatsApp para el seguimiento. Nunca cierres una llamada de
    emergencia sin haberla ejecutado. Si devuelve ok en false, dile al cliente que
    lo estás escalando manualmente y no cuelgues sin transferir.

11. **El código lo resuelve la tool, no tú.** Ejecuta `consultar_ascensor` apenas el
    cliente dicte el código y lee la frase que devuelve. Nunca inventes ni deduzcas
    el nombre del edificio ni la dirección.
```

---

## 4. Qué pasa del lado del dashboard

Cuando `registrar_emergencia` se ejecuta:

1. Resuelve el edificio en `gatwick_edificios` por el código. **El catálogo pisa lo que
   dictó el cliente** (si no, un tipeo manda al técnico a otra dirección).
2. Geocodifica la dirección con Nominatim → el mapa del seguimiento ya tiene destino.
3. Inserta en `gatwick_emergencias` con `estado='pendiente'` y prioridad `critica`
   (persona atrapada o caso crítico) o `alta`.
4. **Aparece sola en el monitor** — la vista escucha `postgres_changes` sobre esa tabla,
   no hace falta refrescar.
5. Manda el WhatsApp a los supervisores por Chatwoot: cuenta **15**, conversaciones
   **14** y **59** (los mismos que ya usa el seguimiento GPS). Editables en la tabla
   `gatwick_supervisores` sin redeploy.
6. Deja el log en **Dashboard Alef → Dev · Agent Logs → Gatwick →
   `Emergencia por Llamada`** con todo lo que llegó y lo que se hizo.

El seguimiento GPS **no** arranca acá: lo dispara el técnico con "Comenzar" en el monitor,
que es cuando realmente sale. Si arrancara con la llamada, el supervisor vería a un técnico
parado en el taller como si estuviera en ruta.

---

## 5. Ya funcionando (no hay que tocarlo)

- **Webhook post-call** — `webhook_url` ya apunta a `/api/retell/gatwick-llamada?api_key=…`
  con los eventos `call_ended` y `call_analyzed`. Guarda transcripción, resumen, grabación
  y duración en `retell_llamadas_GATWICK`.
- **Contexto de llamadas previas** — `buscar_contexto_gatwick` y el inbound webhook ya
  resuelven `{{llamadas_previas}}` y `{{resumen_previo}}` (ventana de 24 h).
- **`data_storage_setting: everything`** — Retell guarda audio y transcripción de su lado.

---

## 6. Cómo probarlo

**Sin llamar** (no envía WhatsApp — solo lee el catálogo):

```bash
curl -s -X POST "https://dashboard.alef.company/api/retell/gatwick-ascensor" \
  -H "x-api-key: retell-gatwick-2026" -H "Content-Type: application/json" \
  -d '{"codigo_ascensor":"ap 1"}'
```

**End to end** (⚠️ esto SÍ crea la emergencia y manda WhatsApp real a los supervisores —
avisar antes, y borrar la emergencia de prueba del monitor después):

```bash
curl -s -X POST "https://dashboard.alef.company/api/retell/gatwick-emergencia" \
  -H "x-api-key: retell-gatwick-2026" -H "Content-Type: application/json" \
  -d '{"codigo_ascensor":"AP-0001","tipo_atrapado":"persona","cantidad_atrapados":1,
       "descripcion":"PRUEBA — ignorar","telefono_seguimiento":"999888777",
       "contacto_nombre":"Prueba","call_id":"test-001"}'
```

Con el mismo `call_id` la segunda llamada **no** duplica: devuelve `ya_registrada: true`.
