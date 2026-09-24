# Trade Cars — conectar las hojas de Google de IG, FB y TikTok

Guía para dejar funcionando **Solicitudes - formularios → Formularios IG / FB / TIKTOK**.
Cada canal lee **una hoja de Google distinta** (la que llena Zapier), en vivo, y la muestra como tarjetas.

> Estado a 23/09/2026: el código y la pantalla están listos. Faltaba tener acceso a las tres hojas, así que
> **nada de esto se pudo probar contra hojas reales**: se probó con un Google simulado. Los pasos de abajo
> son lo que hay que hacer el día que se tenga acceso.

---

## 0. Qué hay que tener antes

| Necesitas | Dónde | Estado |
|---|---|---|
| El SQL corrido | Supabase → SQL Editor → `sql/tradecars_formularios_sheets.sql` | **Pendiente** (una vez, idempotente) |
| `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` | Netlify → Environment variables | Ya están (los usan Healup y Davila) |
| Un usuario **Administrador** de Trade Cars | Solo un administrador conecta hojas | — |
| Una cuenta de Google que **vea las 3 hojas** | Por ejemplo la del gerente de marketing (la que recibe lo de Zapier) | Pendiente |

No hay que tocar Google Cloud Console: se reutiliza el mismo callback que Healup y Davila
(`/api/healup/gcal-callback`), que distingue la empresa por el parámetro `state=tradecars`.

## 1. Conectar la cuenta de Google (una sola vez para los tres canales)

1. Entra al dashboard de Trade Cars como **Administrador**.
2. **Solicitudes - formularios** → pestaña **Formularios IG** → botón **Conectar hoja**.
3. Paso 1, **Conectar con Google**. Inicia sesión con la cuenta de Google que ve las tres hojas y acepta los permisos.
4. Vuelves al dashboard con el aviso *"Google conectado…"*. El token queda guardado en Supabase
   (`app_settings`, clave `google_refresh_token_tradecars`), aparte del de Healup y Davila.

> **Si Google muestra "esta app no está verificada"** o el token deja de servir a los 7 días: la app de OAuth
> está en modo *Testing* en Google Cloud. Hay que agregar esa cuenta como *usuario de prueba* o publicar la app.
> Es lo mismo que ya pasaría con Healup/Davila.

## 2. Conectar cada hoja

Repetir para **IG**, **FB** y **TIKTOK** (cada uno con su propia hoja):

1. Abre la hoja en Google. Si tiene varias pestañas, **abre la pestaña de los leads** antes de copiar: el enlace recuerda cuál es (`#gid=…`).
2. Copia la dirección completa de la barra del navegador.
3. En el dashboard: submódulo del canal → **Conectar hoja** → pega el enlace en el paso 2.
   Si prefieres, escribe el **nombre de la pestaña** en el campo de abajo.
4. **Probar lectura**. Aparece:
   - cuántas filas se leyeron,
   - qué columna se asignó a cada dato (nombre, celular, correo, marca, modelo, año, placa, km, distrito, deuda, mensaje, fecha, campaña),
   - las 3 primeras tarjetas tal como se verán.
5. Si alguna columna quedó mal asignada, elígela en el desplegable y **Volver a probar con estos cambios**.
6. **Guardar conexión**. Listo: las tarjetas aparecen.

### Alternativa sin pantalla: variables de entorno (Netlify)

Sirve para dejar la hoja fija sin pasar por el dashboard, o si el SQL todavía no se corrió. Lo que se guarda desde la
pantalla **manda** sobre esto.

| Variable | Valor |
|---|---|
| `TRADECARS_SHEET_IG_ID` | Enlace o ID de la hoja de IG |
| `TRADECARS_SHEET_FB_ID` | Enlace o ID de la hoja de FB |
| `TRADECARS_SHEET_TIKTOK_ID` | Enlace o ID de la hoja de TikTok |
| `TRADECARS_SHEET_IG_TAB` / `_FB_TAB` / `_TIKTOK_TAB` | (opcional) nombre de la pestaña; si no, la del enlace o la primera |

## 3. Cómo se actualiza

La hoja se lee **en vivo, sin copia ni caché**:

- al abrir el submódulo (cada vez que entras a IG, FB o TIKTOK),
- al tocar **Actualizar**,
- al volver a la pestaña del navegador,
- y cada minuto mientras se está mirando (se pausa si hay una tarjeta abierta, para no pisar lo que alguien escribe).

Arriba de las tarjetas se ve la hoja conectada y la hora de la última lectura.

## 4. Qué se guarda y dónde

| Dato | Dónde vive |
|---|---|
| Nombre, teléfono, correo, vehículo, campaña, fecha… | **La hoja de Google.** Nunca se copia ni se escribe de vuelta en ella (acceso de solo lectura). |
| Estado (nuevo / contactado / tasado / comprado / descartado), notas, precio ofrecido, cliente creado | `tradecars_formularios_estado`, atado al lead por una **clave estable** (ver abajo). |
| Qué hoja es de cada canal y las correcciones de columnas | `tradecars_formularios_config` |

**Clave estable del lead:** es el ID del formulario si la hoja lo trae (`id`, `lead_id`…); si no, un hash de
fecha + teléfono + correo + nombre. **No es el número de fila**, así que ordenar la hoja, insertar o borrar filas no
desconecta el trabajo ya hecho sobre una tarjeta. Si alguien **borra una fila** de la hoja que ya tenía trabajo (estado,
notas, cliente), la tarjeta se sigue mostrando marcada como *"Esta fila ya no está en la hoja"*.

## 5. Qué esperar de las columnas

Las columnas se **detectan por el nombre del encabezado**, en español o inglés, sin importar mayúsculas, tildes ni
guiones (`Número de Teléfono`, `phone_number` y `celular` son el mismo dato). Reconoce lo habitual de Meta Lead Ads y de
TikTok Lead Ads vía Zapier (`created_time`, `full_name`, `phone_number`, `email`, `Marca temporal`, `Name`, `Brand`…).

- **Nada se descarta:** las columnas que no se reconocen (preguntas propias del formulario) salen en cada tarjeta como
  *"Otros datos del formulario"*.
- El teléfono de Meta (`p:+51987654321`) se limpia a `+51987654321`.
- Un kilometraje escrito como texto ("85 mil") **no se inventa**: queda en "Otros datos".
- Las fechas de Sheets se leen sin ambigüedad; si vienen como texto, `dd/mm/aaaa` (día primero) o ISO.
- **La primera fila con al menos 2 celdas llenas es el encabezado.** Zapier agrega los leads nuevos al final.
- Si un día cambian el **nombre** de una columna en la hoja, conviene volver a **Conectar hoja → Probar lectura**
  y revisar que siga bien asignada.

Se muestran los **1.500 leads más recientes** de cada hoja (hasta 5.000 si se pide `?limite=`); si hay más, la pantalla lo avisa.

## 6. Si algo falla

La pantalla explica cada caso y dice qué hacer:

| Mensaje | Qué pasó | Qué hacer |
|---|---|---|
| *Falta conectar Google* | No hay token guardado | **Conectar con Google** (paso 1) |
| *La conexión con Google venció* | El token expiró (`invalid_grant`) | **Reconectar Google** |
| *La cuenta conectada no ve esta hoja* | Google devolvió 403 | Compartir la hoja con la cuenta conectada (basta como lector) |
| *No se encuentra la hoja o la pestaña* | Enlace incorrecto, hoja borrada o pestaña renombrada | Revisar el enlace / nombre de pestaña en **Conectar hoja** |
| *Falta correr sql/tradecars_formularios_sheets.sql* | Las tablas no existen | Correr el SQL |
| *Google limitó las lecturas* | Cuota de la API (300 lecturas/min por proyecto) | Esperar un minuto |

## 7. Seguridad

- Solo un **Administrador** de Trade Cars conecta Google y las hojas (verificado en el servidor, no solo en el menú).
- Ver las tarjetas exige permiso de **ver** el módulo Comercial; guardar estado/notas exige **editar**.
- El callback de Google es compartido y público; para Trade Cars se exige además que quien vuelve tenga sesión de
  Administrador, para que nadie pueda reemplazar la cuenta conectada con la suya.
- Las dos tablas nuevas **no tienen policy para `anon`** (guardan nombres y teléfonos): todo pasa por
  `/api/tradecars/formularios`.
- **Permisos de Google:** se piden los mismos que Healup y Davila (calendario + hojas + correo). El código de Trade Cars
  solo **lee** hojas; no escribe en ellas ni toca el calendario.
