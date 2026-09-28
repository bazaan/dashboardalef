# Trade Cars — conectar las hojas de Google de IG, FB y TikTok

Guía para dejar funcionando **Solicitudes - formularios → Formularios IG / FB / TIKTOK / ZAPPIER (Sin plataforma)**.
Cada pestaña lee una hoja de Google en vivo y la muestra como tarjetas.

> Estado a 28/09/2026: el código está probado de punta a punta contra la hoja REAL que mandó Trade Cars
> (`1ZbYYFdgeejeoUhFp0NSvf0JBuzuaUBUWuO2BDQZW3sQ`) usando un Google simulado en desarrollo — el detector de
> columnas, el reparto por PLATAFORMA y el kilometraje ("107k", "85mil") se verificaron contra sus datos
> reales. Lo único que falta es que un Administrador haga el **login real de Google** desde el dashboard
> (paso 1 de abajo): eso no lo puedo hacer yo, entrar a una cuenta de Google real no es algo que pueda
> hacer por ustedes.

## El caso real: UNA hoja con todas las redes juntas

Trade Cars no tiene tres hojas separadas — tiene **una sola hoja de Zapier** con Instagram, Facebook y
TikTok mezclados, y una columna **PLATAFORMA** que hoy está vacía en todas las filas. El sistema ya sabe
leer esto:

- Se conecta **esa hoja UNA vez** (con la casilla "Usar esta misma hoja para las otras 3 pestañas" marcada,
  que es el valor por defecto).
- Cada lead se manda solo a su pestaña según el texto de su columna PLATAFORMA (`Instagram`/`IG` → **IG**,
  `Facebook`/`FB` → **FB**, `TikTok` → **TikTok**). Vacío, o cualquier otra cosa, → **ZAPPIER (Sin plataforma)**.
- Mientras Trade Cars no llene esa columna, **todos los leads aparecen en "ZAPPIER (Sin plataforma)"**. En
  cuanto la llenen (aunque sea de a poco, fila por fila), esos leads se mueven solos a IG/FB/TikTok la
  próxima vez que se abra o se actualice esa pestaña — no hace falta reconectar nada.
- Arriba de las tarjetas de cada pestaña aparece un aviso con el total de la hoja y cómo se reparte entre
  las 4 (p. ej. "9 leads en total: 1 en Instagram · 1 en Facebook · 1 en TikTok · 6 sin plataforma"), para
  ver que la hoja sí tiene datos aunque una pestaña puntual se vea vacía.

Si algún día Trade Cars sí separa una red en su propia hoja, se puede desmarcar esa casilla y conectar cada
pestaña a su propio enlace — el sistema sigue funcionando igual, columna PLATAFORMA o no.

---

## 0. Qué hay que tener antes

| Necesitas | Dónde | Estado |
|---|---|---|
| El SQL corrido | Supabase → SQL Editor → `sql/tradecars_formularios_sheets.sql` **y luego** `sql/tradecars_formularios_plataforma.sql` (agrega la pestaña "ZAPPIER (Sin plataforma)") | **Pendiente** (una vez cada uno, idempotentes) |
| `TRADECARS_GOOGLE_CLIENT_ID` y `TRADECARS_GOOGLE_CLIENT_SECRET` | Netlify → Environment variables | **Hecho** (28/09/2026, proyecto propio de Google Cloud `tradecars-510019`, cuenta aipartnerstudio@gmail.com) |
| Un usuario **Administrador** de Trade Cars | Solo un administrador conecta hojas | — |
| Una cuenta de Google que **vea las 3 hojas** | La cuenta aipartnerstudio@gmail.com, a la que Trade Cars compartió la hoja | Hecho |

**28/09/2026 — Trade Cars tiene su PROPIO proyecto de Google Cloud, independiente de Healup/Davila.**
Al principio se intentó reusar el callback compartido (`/api/healup/gcal-callback`, `state=tradecars`),
pero ese proyecto de Google Cloud es el de Healup (`635801789504`) y la cuenta aipartnerstudio@gmail.com
no tenía acceso a habilitar la API de Sheets ahí. Se creó un proyecto nuevo (`tradecars-510019`) con su
propio OAuth client, así que Trade Cars usa su propio callback dedicado: `/api/tradecars/gcal-callback`
(esa es la "Authorized redirect URI" registrada en ese OAuth client, no la de Healup). El código lee las
credenciales de `TRADECARS_GOOGLE_CLIENT_ID`/`TRADECARS_GOOGLE_CLIENT_SECRET` en vez de las
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` compartidas — ver `server/utils/tradecars-formularios.ts`
(`credencialesGoogleTradeCars()`) y `server/api/tradecars/gcal-callback.get.ts`.

## 1. Conectar la cuenta de Google (una sola vez para los tres canales)

1. Entra al dashboard de Trade Cars como **Administrador**.
2. **Solicitudes - formularios** → pestaña **Formularios IG** → botón **Conectar hoja**.
3. Paso 1, **Conectar con Google**. Inicia sesión con la cuenta de Google que ve las tres hojas y acepta los permisos.
4. Vuelves al dashboard con el aviso *"Google conectado…"*. El token queda guardado en Supabase
   (`app_settings`, clave `google_refresh_token_tradecars`), aparte del de Healup y Davila.

> **Si Google muestra "esta app no está verificada"** o el token deja de servir a los 7 días: la app de OAuth
> está en modo *Testing* en Google Cloud. Hay que agregar esa cuenta como *usuario de prueba* o publicar la app.
> Es lo mismo que ya pasaría con Healup/Davila.

## 2. Conectar la hoja

1. Abre la hoja en Google. Si tiene varias pestañas, **abre la pestaña de los leads** antes de copiar: el enlace recuerda cuál es (`#gid=…`).
2. Copia la dirección completa de la barra del navegador.
3. En el dashboard, entra a **cualquiera** de las 4 pestañas (por ejemplo "ZAPPIER (Sin plataforma)", que es
   donde van a estar todos al principio) → **Conectar hoja** → pega el enlace.
   Si prefieres, escribe el **nombre de la pestaña de Google** en el campo de abajo.
4. Deja marcada **"Usar esta misma hoja para las otras 3 pestañas"** (viene así por defecto) — es el caso
   real de Trade Cars, una sola hoja para las 4. Solo desmárcala si de verdad son hojas distintas por red.
5. **Probar lectura**. Aparece:
   - cuántas filas se leyeron,
   - qué columna se asignó a cada dato (nombre, celular, correo, marca, modelo, año, placa, km, distrito, deuda, mensaje, fecha, campaña, **plataforma**),
   - las 3 primeras tarjetas tal como se verán.
6. Si alguna columna quedó mal asignada, elígela en el desplegable y **Volver a probar con estos cambios**.
7. **Guardar conexión**. Listo: se conecta en las 4 pestañas de una vez (o solo en la actual, si desmarcaste
   la casilla) y las tarjetas aparecen repartidas solas según la columna PLATAFORMA de cada una.

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
- El teléfono de Meta (`p:+51987654321`) se limpia a `+51987654321`; el de esta hoja de Trade Cars ya viene
  sin el `p:`, se guarda tal cual (`51920451027`).
- El kilometraje entiende **"107k" y "85 mil" / "120mil"** (×1000) además de "85,000" o "108 000" —
  son la forma más común en que Trade Cars lo escribe, no una estimación ambigua. Lo que sí sigue sin
  inventarse es texto genuinamente impreciso ("bastante uso", "poco kilometraje").
- Las fechas de Sheets se leen sin ambigüedad; si vienen como texto, `dd/mm/aaaa` (día primero) o ISO.
- **PLATAFORMA** decide a qué pestaña va cada lead (ver la sección de arriba). Vacío o un valor que no sea
  claramente Instagram/Facebook/TikTok → va a "ZAPPIER (Sin plataforma)".
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
