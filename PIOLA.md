# Piola — todo lo hecho desde el commit `8037816`

**Rama:** `feat/mobile-adaptation`
**Punto de partida:** `8037816 feat(Dashboard): Agregar dashboard de Piola`
**Estado:** sin commitear, todo en el working tree.


---

## Lo primero: qué hay que ejecutar

```
sql/piola.sql
```

**Un solo archivo.** Pegarlo entero en el SQL Editor de Supabase y correr. Es idempotente
de principio a fin, así que se puede correr las veces que haga falta y sirve tanto para una
base vacía como para una donde ya se corrió parte.

---

## Índice

- [1. El SQL: qué crea y por qué](#1-el-sql-qué-crea-y-por-qué)
- [2. El código: qué se agregó](#2-el-código-qué-se-agregó)
- [3. Las escrituras con guard de servidor](#3-las-escrituras-con-guard-de-servidor)
- [4. Reglas que no son obvias](#4-reglas-que-no-son-obvias)
- [5. Qué queda pendiente](#5-qué-queda-pendiente)
- [6. Cómo verificar](#6-cómo-verificar)

---

## 1. El SQL: qué crea y por qué

`sql/piola.sql` son 1 839 líneas en cuatro partes. **43 tablas** en total.

### Parte 1 — Esquema base

Lo que ya venía en el commit anterior (`piola_tables.sql`), construido contra la
especificación de la reunión del 30/07 que el código cita como `§1`…`§14`.

| Bloque | Tablas |
|---|---|
| CRM comercial | `piola_lead_stages`, `piola_leads`, `piola_lead_activities` |
| Contabilidad | `piola_expense_categories` (jerárquica), `piola_transactions` |
| Facturación SUNAT | `piola_invoices` (con detracción) |
| Producción | `piola_services`, `piola_deliverables`, `piola_clientes` |
| RR. HH. | `piola_attendance*`, `piola_vacation_*` |
| Planilla | `piola_payslips`, `piola_afp_reports` — **restringidas** |
| Reportes | `piola_alerts`, `piola_alert_settings`, `piola_scheduled_reports`, `piola_report_runs` |
| Configuración | `piola_roles`, `piola_role_permissions`, `piola_colaboradores` |

Más los seeds de catálogos, las policies RLS y el bucket `piola-docs`.

### Parte 2 — Reunión del 19/08

1. **Contratos y adendas** → `piola_contratos`, `piola_adendas`. Viven como *pestaña* del
   módulo Facturación, no como módulo aparte, así que reutilizan el permiso `facturacion`.
   `contrato_pdf` guarda el **path** dentro del bucket, no la URL pública: así el bucket
   puede pasar a privado más adelante sin migrar datos.
2. **Subida de PDF** → policies de `INSERT`/`UPDATE`/`DELETE` en `piola-docs`. Antes solo
   había `SELECT`: escribía únicamente el servidor con la service key. La subida de
   contratos ocurre en el navegador.
3. **Leads** → `username` (en TikTok no hay teléfono, basta el usuario) + un `CHECK` que
   exige al menos teléfono o usuario.
4. **Egresos** → `piola_transactions.precio` y `.cantidad`.
5. Un permiso que faltaba: *Comercial / CRM* gana el módulo `facturacion`.

> **Sobre objetos muertos:** se revisaron las 43 tablas buscando referencias en el código.
> **No hay ninguna sin uso.** Por eso el archivo no tiene sección destructiva. Los únicos
> candidatos eran a nivel de columna (`piola_leads.meta_ad_id`, `piola_transactions.proveedor`
> y `.comprobante_url`) y ninguno se toca: dos tienen sustituto pero conviven con código que
> aún los lee, y `piola_meta_metrics` queda esperando la conexión con Meta Ads.

### Parte 3 — Financiero + expediente de RR. HH.

| | Qué agrega |
|---|---|
| **A. Configuración financiera** | `piola_monedas`, `piola_impuestos`, `piola_tipos_comprobante`, `piola_series`, `piola_condiciones_pago`, `piola_areas`, `piola_centros_costo`, `piola_proveedores` |
| **B. Ingresos y gastos** | `piola_transactions` gana subtotal, descuentos, impuestos, estado, vencimiento, adjunto, responsable |
| **C. Cuentas por cobrar/pagar** | `piola_pagos` (parciales) + vistas de saldo |
| **D. Caja** | `piola_caja_sesiones`, `piola_caja_movimientos` |
| **E. Presupuestos** | `piola_presupuestos` (mes/año/área/categoría) |
| **F. Auditoría** | `piola_auditoria` + trigger genérico |
| **G. Expediente** | `piola_colaboradores` se amplía; `piola_contratos_laborales`, `piola_colaborador_documentos` |

**Sobre `monto`:** sigue siendo la fuente de verdad y equivale al **total**. Las columnas
nuevas (subtotal, descuento, impuestos) son el desglose. Los movimientos ya cargados quedan
válidos con el desglose en `NULL`.

**Sobre el estado de una cuenta:** `pendiente → parcial → pagado` lo recalcula el trigger
`piola_recalcular_saldo()` a partir de `piola_pagos`. Nadie lo escribe a mano — así nunca
queda un documento "pagado" con saldo.

### Parte 4 — Correcciones sobre la parte 3

Va al final a propósito: hace `CREATE OR REPLACE` de funciones de la parte 3.

1. **La auditoría censura las remuneraciones.** `piola_auditoria` tiene policy de `SELECT`
   para `anon`, y el trigger guardaba la fila entera de `piola_colaboradores` en
   `datos_antes`/`datos_despues`. Esa fila incluye `sueldo_bruto`, `bonificaciones`,
   `comision_pct` y `afp_cuspp`: el histórico de sueldos de todo el equipo quedaba legible
   desde el navegador, puenteando el cuidado que sí tienen `piola_payslips`,
   `piola_afp_reports` y `piola_commissions`.

   La corrección **no saca `piola_colaboradores` de la auditoría** — un cambio de sueldo es
   exactamente lo que hay que poder auditar. Reemplaza el **valor** por `■■■` y conserva el
   nombre del campo en `campos`: se audita **que** se tocó el sueldo, no **cuánto**.
2. Se limpia una condición muerta del `UPDATE` de estados de la parte 3.

No hace falta recrear los triggers: apuntan a la función por nombre y toman la versión
nueva solos.

---

## 2. El código: qué se agregó

### Componentes nuevos (10)

```
components/Piola/
├── PiolaVisorPdf.vue             Visor embebido de documentos
├── PiolaSubirPdf.vue             Subida de PDF a Supabase Storage
├── PiolaContratos.vue            Contratos y adendas
├── PiolaCuentas.vue              Cuentas por cobrar y por pagar
├── PiolaCaja.vue                 Apertura, movimientos y cierre de caja
├── PiolaPresupuestos.vue         Presupuesto vs. ejecutado
├── PiolaConfigFinanciera.vue     Monedas, impuestos, series, condiciones, áreas, proveedores
├── PiolaReportesFinancieros.vue  Los 13 reportes, con 8 filtros y exportación a CSV
├── PiolaAuditoria.vue            Registro de cambios
└── PiolaExpediente.vue           Expediente del trabajador
```

Ninguno es un módulo nuevo del sidebar: entran como pestañas de los módulos que ya existían
(Cuentas, Caja y Presupuestos dentro de Contabilidad; Contratos dentro de Facturación;
Expediente dentro de RR. HH.; Config. financiera dentro de Configuración; Reportes
financieros y Auditoría dentro de Reportes).

### Endpoints nuevos (10)

Todos `POST /api/piola/<nombre>`, todos con verificación de permisos.

| Endpoint | Qué cubre |
|---|---|
| `caja` | Abrir, movimiento, eliminar movimiento, cerrar |
| `pagos` | Registrar o eliminar un cobro/pago contra una cuenta |
| `colaborador` | Ficha, contratos laborales y documentos del expediente |
| `contabilidad` | Movimientos y categorías de gasto |
| `configuracion` | Roles, permisos y catálogos (incluida la config. financiera) |
| `crm` | Leads, interacciones y conversión a cliente |
| `produccion` | Entregables, marcas y catálogo de servicios |
| `contratos` | Contratos de cliente y adendas |
| `presupuestos` | Presupuesto vs. ejecutado |
| `reportes` | Configuración de reportes programados y alertas |

### Otros cambios

- **`composables/usePiola.ts`** (+207 líneas): `apiPiola()` (el cliente de los endpoints),
  `traerTodo()` (paginación), `calcularTotalesMovimiento()`, catálogos y formateadores.
- **`server/utils/piola.ts`** (+22): `exigirAlguno()`, para las tablas que escriben dos
  pantallas distintas.
- **`PiolaHome`, `PiolaCRM`, `PiolaContabilidad`, `PiolaFacturacion`, `PiolaRRHH`,
  `PiolaReportes`, `PiolaConfiguracion`, `PiolaProduccion`, `PiolaMiEspacio`**: pestañas
  nuevas, filtros, embudo de conversión y el cableado a los endpoints.
- **`CLAUDE.md`**: tabla de endpoints y las reglas no obvias.

### Documentos: HTML, no PDF

El proyecto no tiene librería de PDF. Boletas, AFP, facturas y contratos se generan como
**HTML con branding**, se suben al bucket `piola-docs` y se imprimen a PDF desde el
navegador. Por correo viajan como HTML. Si el cliente pide `.pdf` descargable de verdad,
entra una librería nueva al proyecto — es una decisión, no un olvido.

---

## 3. Las escrituras con guard de servidor

Esta es la parte más importante de todo el trabajo, y la que más fácil se deshace sin
querer.

**El problema.** Las pantallas escribían directo a Supabase con
`client.from('piola_…').insert()`. Eso saltea `exigirModulo()` / `exigirAdmin()`, con lo
cual los permisos por módulo quedaban en decoración: cualquiera con las devtools abiertas
registraba un pago, cerraba una caja o se subía el sueldo. La cerradura estaba puesta y se
entraba por la ventana de al lado.

**El estado ahora.** Eran **39 escrituras directas** en 8 componentes y 15 tablas.
**Quedan 0.** Toda mutación pasa por `apiPiola('<endpoint>', { accion, ... })`, que devuelve
`{ data, error }` — la misma forma que Supabase, para no cambiarle la estructura al código
que llama. Las **lecturas** sí siguen yendo directo con `client.from(...).select()`.

### Lo que decide el servidor, no la pantalla

No es solo cuestión de permisos: hay valores que el navegador no puede firmar.

| Valor | Por qué |
|---|---|
| **El saldo del arqueo de caja** | Se recalcula sumando los movimientos. Si lo mandara el cliente, la diferencia del cierre —el dato que el arqueo existe para vigilar— sería maquillable. Igual con la sesión a la que se aplica un movimiento: si no hay caja abierta, se rechaza en vez de colgarlo de una cerrada. |
| **El total de un movimiento contable** | El cliente manda subtotal, descuento y los *códigos* de impuesto; el servidor lee las tasas vigentes de `piola_impuestos` y recalcula `monto`, que es lo que suman gráficos, reportes y cuentas por cobrar. Sin esto se podía registrar un ingreso de S/ 10 000 con un total escrito a mano de S/ 100. |
| **El saldo pendiente de una cuenta** | Se recalcula contra `piola_transactions` en cada pago, no contra lo que la pantalla creía al abrir el diálogo. |
| **El resultado de un lead** | Sale de `es_ganado` / `es_perdido` de la etapa. Antes venía calculado del cliente: se podía dar por ganado un lead que nunca llegó a esa columna, y el embudo contaba cierres que no ocurrieron. |
| **Quién hizo qué y cuándo** | `registrado_por`, `created_by`, `aprobado_por`, `aprobado_at`, `subido_por`, `user_email`. Un `aprobado_por` que escribe el propio navegador no responde la pregunta que el campo existe para responder. |
| **`company_id` de los contratos** | Es el campo que aísla las empresas del grupo. |

### Operaciones que iban a medias

Varias acciones eran dos o tres escrituras seguidas desde el navegador, y si la segunda
fallaba la base quedaba inconsistente. Ahora van juntas en el servidor:

- Mover un lead **y** escribir su nota de historial.
- Registrar una interacción **y** actualizar `ultima_interaccion` — que es lo que mira el
  cron de alertas para detectar leads abandonados.
- Convertir un lead en cliente: crea la ficha **y** marca el lead; si lo segundo falla,
  deshace lo primero. Además rechaza la segunda conversión del mismo lead, que antes creaba
  dos clientes con dos clics.
- Cambiar la moneda principal: apagar la anterior **y** encender la nueva.
- Intercambiar el orden de dos etapas del CRM, releyendo los dos `orden` de la base.

### Tres endurecimientos deliberados

No son solo guards: **cambian lo que se puede hacer**. Conviene saberlos antes de que
alguien reporte "esto antes se podía".

1. **Roles y permisos exigen Administrador**, no permiso de Configuración. Alguien con
   `configuracion.edit` podía marcarse a sí mismo todos los módulos y quedar como
   Administrador de hecho. Un permiso que sirve para ampliarse el permiso no es un permiso.
   Si Piola le da Configuración a alguien que no es Administrador, ya no podrá tocar roles.
2. **No se puede eliminar un movimiento contable que tenga pagos registrados.** La FK de
   `piola_pagos` es `ON DELETE CASCADE`: borrarlo se llevaba el historial de cobros en
   silencio, y el diálogo solo decía "¿Eliminar X?". El endpoint pide eliminar los pagos
   primero, o anular la cuenta.
3. **Los campos de remuneración exigen Administrador, pero solo cuando cambian.** RR. HH.
   manda el formulario entero al guardar; exigir admin porque el campo viaje bloquearía
   editar un teléfono. Se compara contra lo guardado. La lista de campos sensibles es la
   misma que censura el trigger de auditoría, para que las dos mitades del sistema tengan
   una sola definición de "dato sensible".

---

## 4. Reglas que no son obvias

- **Nunca usar `.limit(n)` con n > 1000 contra Supabase.** PostgREST corta en 1000 y no
  devuelve error: un `.limit(8000)` trae 1000 filas y el reporte sale incompleto en
  silencio. Usar `traerTodo()` de `composables/usePiola.ts`, que pagina con `.range()`.
  Toda consulta paginada necesita un `.order()` **determinista** — sin orden estable, dos
  páginas pueden repetir una fila o saltarse otra.
- **El tareo usa la hora del servidor**, nunca la del cliente: si el navegador mandara
  horas, cualquiera maquillaría su jornada. `tareo-correccion` recibe `HH:MM` hora Lima y
  convierte a UTC (Lima es UTC-5 todo el año).
- **Vacaciones: 15 días/año = 1.25 por mes, solo `tipo_contrato='planilla'`.** Los de recibo
  por honorarios no devengan. El saldo se calcula al vuelo desde `fecha_ingreso`; no se
  guarda.
- **`piola_payslips`, `piola_afp_reports` y `piola_commissions` no tienen policy para
  `anon`**, a diferencia del resto del proyecto. Solo se leen por endpoint con verificación
  de rol.
- **Detracción activada por defecto** al facturar: el ~98 % de las facturas de Piola la
  llevan. Marcar pagada crea el ingreso por el **neto** (total − detracción), no por el
  total.
- **Categorías de gasto jerárquicas** (`parent_id` auto-referencial, n niveles) con CRUD en
  la UI: requisito explícito del cliente para no depender de desarrollo por cada gasto nuevo.
- **Días de anticipación de alertas parametrizables** en `piola_alert_settings`; el 7 del
  seed es solo un default.
- **Syscon no se reemplaza**: la contabilidad formal/tributaria sigue ahí; aquí va el flujo
  de caja.

---

## 5. Qué queda pendiente

### Bloqueado por configuración, no por desarrollo

**1. Correr `sql/piola.sql`.** Sin esto no carga nada.

**2. Variables de entorno.** `.env` solo tiene `SUPABASE_URL`, `SUPABASE_KEY` y
`NUXT_SUPABASE_SECRET_KEY`. Falta todo lo de Piola:

| Variable | Qué rompe si falta |
|---|---|
| `PIOLA_CRON_KEY` | Los 2 crons de Netlify no pueden autenticarse contra los endpoints |
| `N8N_WEBHOOK_PIOLA_ALERTAS` | Las alertas se generan pero no se envían |
| `RESEND_API_KEY` | No sale ningún correo: facturas, boletas ni reportes |
| `RESEND_FROM_PIOLA` | Cae al default `Piola <no-reply@alef.company>` |
| `PIOLA_PSE_URL` / `PIOLA_PSE_TOKEN` | Las facturas quedan en **borrador**, no van a SUNAT (la UI ya lo avisa) |
| `PIOLA_RAZON_SOCIAL`, `PIOLA_RUC`, `PIOLA_DIRECCION`, `PIOLA_LOGO_URL`, `PIOLA_COLOR`, `PIOLA_COLOR_ACENTO`, `PIOLA_CUENTA_DETRACCION` | Los documentos generados salen sin branding ni datos del emisor |

**3. Fila de Chatwoot.** Falta insertar en `remarketing_config` la fila con
`company_id='piola'` y su `chatwoot_account_id`. Hasta entonces el botón "Conversaciones"
lleva al selector genérico de cuentas — no a un inbox equivocado.

### Bloqueado por datos del cliente

Nada de esto bloquea desarrollo: todo quedó **parametrizable**, no hardcodeado.

| Falta | Dónde se configura cuando llegue |
|---|---|
| Lista de gastos operativos con su jerarquía | Tabla `piola_expense_categories`, CRUD en la UI |
| Fórmula exacta de comisiones de Héctor | `calcularComision()` en `server/utils/piola.ts` |
| Modelos reales de boleta y formato AFP | `TASAS` en `server/utils/piola-planilla.ts` |
| Lista de usuarios (nombre + correo + rol) | `dashboardlogin` + `piola_colaboradores` |
| Catálogo completo de servicios | Tabla `piola_services`, CRUD en la UI |
| Antigüedad de cada colaborador | `piola_colaboradores.fecha_ingreso` |
| Reunión con José (Traffic Manager) | Conexión Meta Ads / WhatsApp / Instagram |

### Fuera de alcance, como se acordó

- Renombrar columnas de `piola_leads`
- Meter una librería de PDF
- TikTok Ads, multi-moneda, reemplazar Syscon, Dropbox, múltiples cuentas publicitarias
  (la tabla `piola_meta_metrics` está creada esperando la conexión con Meta)

---

## 6. Cómo verificar

### Ya verificado

- **Ninguna escritura directa en `components/Piola/`.** Contrastar con:
  ```bash
  grep -rn "client\.from('piola_[a-z_]*')\.\(insert\|update\|delete\|upsert\)" components/Piola/
  ```
  Debe devolver vacío. Si algún día devuelve algo, esa pantalla se saltó los permisos.
- **Sintaxis** de los 19 `<script setup>` de Piola (esbuild) y **tipos** de los 17 endpoints
  y utils (`tsc --noEmit` con shims de Nitro): 0 errores.
- **El SQL consolidado es idéntico** a la concatenación de los cuatro archivos originales:
  mismo conteo de `CREATE TABLE` (43), `CREATE INDEX` (32), `ALTER TABLE` (12), `INSERT`
  (20) y funciones, y `diff` sin diferencias ignorando comentarios.

### Falta verificar — necesita la app levantada

1. **Los guards**, con un usuario que **no** sea Administrador y tenga solo algunos módulos:
   registrar un pago sin `contabilidad.create` debe dar **403** desde las devtools, y tocar
   roles sin ser Administrador también.
2. **El cierre de caja con descuadre**: abrir, registrar movimientos y cerrar con un saldo
   contado distinto al del sistema. La diferencia debe quedar **guardada**, no corregida.
3. **El trigger de saldos**: cargar un pago parcial y verificar que el estado pase a
   `parcial` y luego a `pagado`.
4. **La subida de PDF**, que depende de las policies de Storage de la parte 2.
5. **El expediente**: el relleno automático de `nombres`/`apellidos` parte por el primer
   espacio, y falla con nombres compuestos ("María José Pérez" → nombres: "María",
   apellidos: "José Pérez"). Se corrige a mano desde la ficha.

### Cómo levantar

```bash
PATH="$HOME/Downloads/espacio-de-trabajo-claude/node-v20.19.1-darwin-x64/bin:$PATH" \
  node node_modules/.bin/nuxt dev
```

Node **v20.19.1** — la v20.11.1 es incompatible.
