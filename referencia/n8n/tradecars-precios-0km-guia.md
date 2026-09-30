# Trade Cars — Bot semanal de precios 0km (n8n + búsqueda web con IA)

Flujo de n8n **`TRADECARS | Precios 0km | Búsqueda web semanal (IA)`**
(id `6Vj3C1EelbyDZPqO`, https://acn8n.alefcompany.online/workflow/6Vj3C1EelbyDZPqO).
JSON importable: `referencia/n8n/tradecars-precios-0km-workflow.json`.

Implementa `Especificacion_Flujo_Precios_Nuevos_v1.txt` (Alef, 30/09/2026) con estas
decisiones de Roberto:

- **Solo precios 0km** (el techo que usa el Tasador), no precios de usados.
- **Solo las marca+modelo que aparecen en el histórico de compras/ventas**
  (`tradecars_data_historico_compras_ventas`), no toda la oferta del mercado.
- **Semanal**, no diario: cada **domingo 3:00 AM hora Lima**.
- **Búsqueda web con IA** (OpenAI Responses API + herramienta `web_search`, `gpt-4.1-mini`)
  en vez de un scraper por distribuidor: cubre las 40+ marcas del histórico (DFSK, Chery,
  Geely, BMW… no estaban en la lista del documento) y no se rompe cuando un sitio cambia
  su diseño.
- Escribe en la tabla que **ya existe**, `tradecars_data_precios_vehiculos_nuevos`. No se
  creó una tabla nueva de precios; solo la tabla de log.

## Quién lo usa

| Consumidor | Cómo le llega |
|---|---|
| Tasador de WhatsApp (n8n) | Su tool `consultar_precio_nuevo` lee `tradecars_data_precios_vehiculos_nuevos` en cada tasación de un auto con < 10.000 km. Sin cambios en su flujo. |
| Asistente Trade Cars (dashboard) | Su tool `consultar_precio_vehiculo_nuevo` lee la misma tabla (`activa = true`). Sin cambios de código. |

## Qué hace, nodo por nodo

1. **Cada domingo 3:00 AM (Lima)** / **Ejecutar a mano (prueba)** — disparadores.
2. **Config** — todos los ajustes (ver tabla abajo). Es el único nodo que se toca a mano.
3. **Tipo de cambio** — `open.er-api.com` (gratis, sin clave). Solo se usa si una página
   publica en soles; si falla, usa `tipo_cambio_respaldo` y lo deja anotado en el log.
4. **Leer histórico** / **Leer precios 0km actuales** — Supabase (`SUPABASE.COM 1`, la misma
   credencial que usa el Tasador de WhatsApp).
5. **Armar búsquedas** — una búsqueda por marca+modelo único del histórico (hoy 264).
   Normaliza como la tool de WhatsApp (mayúsculas, sin tildes) y fusiona `NEW TUCSON` con
   `TUCSON`. Le pasa a la IA los nombres de versión que ya hay en la tabla para que los reuse.
6. **Buscar precio 0km con IA** — `POST /v1/responses`, credencial `OpenAi account`,
   respuesta en JSON estricto (`resultado`, `versiones[]`, `nota`), hasta 3 búsquedas web
   por modelo, lotes de 4 cada 1,5 s.
7. **Validar y decidir** — valida cada precio y decide la acción (ver "Reglas").
8. **Aplicar en Supabase** — un PATCH por fila a actualizar (o POST si se permite insertar).
   El flujo es **lineal a propósito** (sin ramas que se junten): así el log se escribe siempre,
   haya o no cambios.
9. **Resumen** + **Guardar log** — una fila en `tradecars_control_sync_precios`.

Si algo revienta, avisa el **❗ Error Handler — Global** (el mismo de todos los flujos) →
aparece en Dev · Agent Logs → *Registro de Errores* del dashboard.

## Reglas de validación (por qué un precio se escribe o no)

La tool del Tasador de WhatsApp lee **todas** las filas de una marca+modelo, **sin filtrar
por `activa` ni `requiere_revision`** (su comentario dice que filtra, pero el nodo Supabase
no lo hace — verificado leyendo el flujo `xVDAuPum7rlSgYPN` el 30/09/2026). O sea: todo lo
que el bot escriba llega a una cotización real. Por eso:

| Caso | Acción |
|---|---|
| La URL no está entre las páginas que la IA consultó (anti-invención) | `descartado` |
| La página es un blog / noticia / reseña (`/blog/`, `/noticias/`…) | `descartado` |
| Precio fuera de US$6.000–400.000, o año modelo fuera de ±1 del actual | `descartado` |
| Existe la fila y el precio cambia **≤ 15 %** | `actualizado` (guarda `precio_anterior_usd`) |
| Existe la fila y el precio es el mismo | `confirmado` (renueva `fecha_ultimo_precio` y `url_fuente`) |
| Existe la fila y el precio cambia **> 15 %** | `salto_revision`: **NO se aplica**, queda en el log |
| Versión/modelo que no está en la tabla | `nuevo_no_insertado` (o `insertado`, ver abajo) |
| La IA no encuentra precio | `sin_precio` (no significa que no se venda) |
| Evidencia explícita de que ya no se vende en Perú | `no_se_vende_nuevo`: no marca nada como descontinuado, solo avisa en el log |

**Emparejar versiones:** "1.4L LX MT" encontrado = "LX" en la tabla (se ignoran cilindrada,
transmisión, tracción y combustible). Pero "EX SPORT" **no** es "EX": una palabra de acabado
de más es otra versión. Así se evita pisar la fila del sedán con el precio del hatchback
(pasó en la prueba real con el Kia Rio).

**Precios guardados siempre en USD** (`moneda = 'USD'`); si la página publica en soles, se
convierte con el tipo de cambio del día.

## ⚠️ `fuente = 'web'` e inserciones

El CHECK de `fuente` solo acepta `manual` / `wigo` / `autoland` (verificado en vivo:
`'web'` se rechaza). `fuente` es obligatoria y sin valor por defecto, así que con
`fuente_web_permitida: false` (lo que está hoy):

- **Actualizar** una fila existente funciona: no se manda `fuente` (la fila conserva la suya).
- **Insertar** no es posible: los modelos/versiones nuevos quedan en el log como
  `nuevo_no_insertado`.

**Esto limita mucho lo que el bot aporta**: hoy la tabla tiene 89 filas (cargadas a mano el
31/08) y el histórico tiene 264 marca+modelo. En la prueba real con 6 modelos, **14 de 16
precios válidos** eran versiones que no estaban en la tabla.

Para que también inserte:
1. Correr el bloque **OPCIONAL** de `sql/tradecars_control_sync_precios.sql` (2 líneas, agrega
   `'web'` al CHECK; no toca columnas ni datos).
2. En el nodo **Config**: `fuente_web_permitida: true`.

Las filas nuevas entran con `fuente='web'`, `tier=1`, `activa=true`, `requiere_revision=true`
(informativo: el Tasador de WhatsApp no lo mira), `creado_por='bot_precios_0km_n8n'`.

## Puesta en marcha

1. **Correr `sql/tradecars_control_sync_precios.sql`** en Supabase (crea la tabla de log).
   Sin esto, el último nodo falla y el Error Handler avisa.
2. (Opcional) Decidir lo de `fuente = 'web'` (sección anterior).
3. En n8n, abrir el flujo y **Execute workflow** → corre con los **5 modelos** del histórico
   con más operaciones y **escribe de verdad**. Revisar la fila nueva del log (consulta abajo).
   Para ver qué haría sin escribir nada: `simular: true` en Config.
4. Si todo se ve bien, **activar** el flujo (toggle *Active*). Corre cada domingo 3:00 AM.

## Ajustes (nodo Config)

| Clave | Valor | Para qué |
|---|---|---|
| `limite_modelos` | 5 a mano / 0 (todos) en el cron | Prueba barata |
| `simular` | `false` | `true` = no escribe en la tabla de precios, solo el log |
| `modelo_ia` | `gpt-4.1-mini` | Mismo modelo que el Asistente del dashboard |
| `max_busquedas_por_modelo` | 3 | Tope de costo; en las pruebas usó 1 por modelo |
| `umbral_cambio_pct` | 15 | Cambio máximo que se aplica solo |
| `precio_min_usd` / `precio_max_usd` | 6000 / 400000 | Descarta precios absurdos |
| `tipo_cambio_respaldo` | 3.42 | Solo si la API de tipo de cambio falla |
| `fuente_web_permitida` | `false` | Ver sección `fuente = 'web'` |
| `actualizar_filas_manuales` | `true` | `false` = nunca tocar las filas `fuente='manual'` |

## Costo medido

Pruebas reales del 30/09/2026: **US$0,0137 por modelo** (1 búsqueda web a US$0,01 + ~8.200
tokens de contenido de búsqueda a tarifa de `gpt-4.1-mini`). Con 264 modelos: **~US$3,6 por
corrida, ~US$15/mes**. Cada fila del log trae `costo_estimado_usd`.

## Ver resultados

**En el dashboard:** Trade Cars → **Operaciones → Precios vehículos nuevos**. Ahí están la tabla de
precios, las corridas del bot (clic en una para ver qué encontró en cada modelo) y los **pendientes de
revisión** (cambios > 15 % y versiones nuevas) con botones **Aplicar / Descartar** (solo
administración). Requiere correr una vez `sql/tradecars_precios_0km_revisiones.sql`.

**En Supabase:**

```sql
-- Últimas corridas
SELECT fecha_ejecucion, origen, simulado, total_modelos, exitosos, actualizados, confirmados,
       insertados, nuevos_no_insertados, saltos_revision, descartados, fallidos, costo_estimado_usd
  FROM tradecars_control_sync_precios ORDER BY fecha_ejecucion DESC LIMIT 10;

-- Saltos > 15 % pendientes de revisar (de la última corrida)
SELECT m->>'marca' AS marca, m->>'modelo' AS modelo, v->>'version' AS version,
       v->>'precio_actual_usd' AS en_tabla, v->>'precio_usd' AS encontrado, v->>'delta_pct' AS delta_pct, v->>'url_fuente' AS url
  FROM tradecars_control_sync_precios c,
       jsonb_array_elements(c.detalle_json) m, jsonb_array_elements(m->'versiones') v
 WHERE c.id = (SELECT max(id) FROM tradecars_control_sync_precios) AND v->>'accion' = 'salto_revision';
```

`detalle_json` guarda **cada precio observado** con su URL, semana a semana: es el historial
de lo que publicaban los concesionarios.

## Pruebas hechas (30/09/2026)

- Lógica de los 4 Code nodes probada fuera de n8n con casos simulados (actualiza, salto >15 %,
  versión nueva, URL inventada, precio absurdo, error 429, soles, simulación, `URL` inexistente).
- 3 corridas reales en n8n **en modo simulación** (sin escribir precios) con webhook temporal,
  ya eliminado: 1.ª encontró 2 bugs (sandbox sin `URL`; la IA confundía "no encontré precio" con
  "no se vende") → corregidos; 2.ª: 6/6 modelos con precio (hyundai.pe, dfsk.com.pe,
  chevrolet.com.pe, autocosmos.com.pe) → se agregó el filtro de blogs; 3.ª: PATCH real a
  `id=0` (no existe) para probar el camino de escritura con la credencial → HTTP 200, 0 filas.
- **No probado todavía:** una escritura real sobre una fila existente (se hace en el paso 3 de
  "Puesta en marcha") y el log, porque la tabla de log aún no existe.

## Hallazgos del flujo de WhatsApp (de Alef, no se tocó)

- `consultar_precio_nuevo` no filtra `activa` / `requiere_revision` (ver arriba).
- Entre varias versiones del mismo año elige la **primera que devuelve la base** (sin criterio):
  con Rio EX y LX 2026 el techo puede salir de cualquiera de las dos.
- Filtra en la base con `marca = X AND modelo = Y` exacto (mayúsculas, sin tildes): si el
  cliente dice "CX5" y la tabla dice "CX-5", no encuentra techo.
