# Tool `buscar_edificio` / `buscando_edificio` — Gatwick (guía n8n)

La tool ya está implementada en el dashboard. Esta guía conecta el sub-workflow
`buscar_edificio` del flujo de emergencias al endpoint.

## Endpoint del dashboard

```
POST https://dashboard.alef.company/api/gatwick/buscar-edificio
api_key: gatwick-edificio-2026
```

Busca en la tabla `gatwick_edificios` por **elme / nombre / dirección / distrito**.
El cliente puede dar cualquiera de esos (o combinarlos, ej: "los alpes 121").

## Cómo funciona

- Recibe hasta 5 términos: `direccion1`..`direccion5` (mínimo 1, los vacíos se ignoran).
- Por cada término busca y devuelve uno de tres estados:
  - **confirmado** → 1 solo edificio coincide → devuelve sus datos + mensaje listo
  - **ambiguo** → varios coinciden → devuelve la lista para que el agente pregunte cuál
  - **no_encontrado** → ninguno coincide

Ejemplos reales:
| Cliente dice | Resultado |
|---|---|
| "los alpes" | **ambiguo** (3 edificios) → "¿Cuál es? 1. … 2. … 3. …" |
| "alpes 121" | **confirmado** → BRABEN 3, Calle Los Alpes 121, Surquillo (ELME 652) |
| "bresciani" | confirmado (por nombre) |
| "443" | confirmado (por ELME) |
| "barranco" | varios (por distrito) → ambiguo |

## Respuesta del endpoint

```jsonc
{
  "ok": true,
  "total_consultas": 1,
  "confirmados": 1, "ambiguos": 0, "no_encontrados": 0,
  "resultados": [
    {
      "consulta": "alpes 121",
      "status": "confirmado",
      "edificio": { "elme": "652", "nombre": "BRABEN 3", "direccion": "Calle Los Alpes 121", "distrito": "Surquillo", "es_instalacion_critica": false, "equipos": [...] },
      "mensaje": "✅ Edificio: BRABEN 3 — Calle Los Alpes 121, Surquillo (ELME 652)\nEquipos: ..."
    }
  ],
  "mensaje_global": "✅ Edificio: BRABEN 3 — ..."   // texto ya armado para el agente
}
```

El agente puede usar `mensaje_global` directo, o leer `resultados[].status` para
decidir si confirma o pregunta.

## Paso 1 — Importar el sub-workflow

n8n → **Workflows → Import from File** → `gatwick-buscar-edificio-subflow.json`
(2 nodos: trigger con schema direccion1..5 + HTTP Request al endpoint). **Guarda.**

## Paso 2 — Conectar el nodo `buscar_edificio` del flujo principal

En el flujo `GATWICK | WHATSAPP | Agente Emergencias`:

1. Abre el nodo **`buscar_edificio`** (toolWorkflow).
2. En **Workflow** → selecciona el sub-workflow importado.
3. El mapeo de inputs **ya está** así (con `$fromAI`), no hace falta cambiarlo:
   ```
   direccion1 = {{ $fromAI('direccion1', '', 'string') }}
   direccion2 = {{ $fromAI('direccion2', '', 'string') }}
   direccion3 = {{ $fromAI('direccion3', '', 'string') }}
   direccion4 = {{ $fromAI('direccion4', '', 'string') }}
   direccion5 = {{ $fromAI('direccion5', '', 'string') }}
   ```
4. Descripción sugerida de la tool:
   ```
   Busca edificios en la base de Gatwick. El cliente puede dar el ELME, el
   nombre, la dirección o el distrito (o combinarlos, ej "los alpes 121").
   Pasa de 1 a 5 términos en direccion1..direccion5. Si un término coincide
   con varios edificios, el resultado es "ambiguo" y debes preguntar cuál;
   si coincide con uno solo es "confirmado".
   ```

## Logs

Cada búsqueda queda en **dashboard Alef → Dev · Agent Logs → Empresa: Gatwick →
Tool: "buscando_edificio"**.

## Prueba manual (curl)

```bash
# Confirmado (1 resultado)
curl -X POST https://dashboard.alef.company/api/gatwick/buscar-edificio \
  -H "Content-Type: application/json" \
  -d '{"api_key":"gatwick-edificio-2026","direccion1":"alpes 121"}'

# Ambiguo (varios)
curl -X POST https://dashboard.alef.company/api/gatwick/buscar-edificio \
  -H "Content-Type: application/json" \
  -d '{"api_key":"gatwick-edificio-2026","direccion1":"los alpes"}'

# Varias direcciones a la vez
curl -X POST https://dashboard.alef.company/api/gatwick/buscar-edificio \
  -H "Content-Type: application/json" \
  -d '{"api_key":"gatwick-edificio-2026","direccion1":"bresciani","direccion2":"443","direccion3":"chorrillos"}'
```
