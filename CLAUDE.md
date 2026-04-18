# CLAUDE.md — Dashboard Alef Allin

Leer esto al inicio de cualquier sesión que trabaje en este proyecto.

---

## Qué Es

Dashboard multi-tenant en **Nuxt 3 + Vue + Vuetify 3 + Supabase** para gestionar las 11 empresas del grupo Alef Company. Cada empresa tiene su propio dashboard con datos aislados por `company_id`.

**Repo:** `https://github.com/bazaan/dashboardalef`
**Ubicación local:** `espacio-de-trabajo-claude/dashboard alef allin/`

---

## Empresas (Tenants)

Los `company_id` en la BD tienen variaciones de capitalización y espacios. `getDashboardPathByCompanyId()` en `utils/permissions.ts` hace fuzzy matching para cubrir las variantes. Los valores reales que llegan de la BD son:

| company_id en BD | Empresa | Dashboard |
|---|---|---|
| `brada` / `Brada` / `brada perfumes` | Brada Perfumes | `/pruebas/BradaPerfumes` |
| `healup` / `Heal up` / `heal up` | Healup | `/pruebas/Healup` |
| `alef` / `Alef` / `alef company` | Alef Company | `/pruebas/AlefCompany` |
| `alegrated` / `Alegrated` | Alegrated | `/pruebas/Alegrated` |
| `clinica arroyo` / `clinicaarroyo` | Clínica Arroyo | `/pruebas/ClinicaArroyo` |
| `origitec` / `Origitec` | Origitec | `/pruebas/Origitec` |
| `solari` / `Solari` | Solari | `/pruebas/Solari` |
| `skip` / `SKIP` | SKIP | `/pruebas/SKIP` |
| `estasconsuerte` / `estás con suerte` / `ecs` | Estás Con Suerte | `/pruebas/EstasConSuerte` |
| `estetikamedika` / `estetika medika` | Estetika Medika | `/pruebas/EstetikaMedika` |
| `davila` / `miguel davila` | Miguel Davila | `/pruebas/MiguelDavila` |

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Framework | Nuxt 3 |
| UI | Vuetify 3 (Material Design) + CSS custom (`assets/styles/dashboard.css`) |
| Auth | Supabase Auth nativo + fallback RPC + fallback bcrypt legacy |
| Base de datos | PostgreSQL vía Supabase |
| Charts | ApexCharts 5 (vue3-apexcharts) |
| Backend | Nuxt Nitro (API routes en `server/api/`) |
| Facturación | PSE.PE / NubeFact (facturas electrónicas Perú) |
| Automatización | n8n (toggle workflows por empresa) |
| PWA | @vite-pwa/nuxt |

---

## Comandos

```bash
# IMPORTANTE: Usar Node v20.19.1 (v20.11.1 es incompatible)
PATH="$HOME/Downloads/espacio-de-trabajo-claude/node-v20.19.1-darwin-x64/bin:$PATH" node node_modules/.bin/nuxt dev

# O con el alias configurado en ~/.zshrc:
dashboard   # → http://localhost:3000
```

```bash
npm install        # Instalar dependencias
npm run build      # Build producción
npm run preview    # Preview build local
```

**Si npm install falla** (bug de optional deps): instalar con `--ignore-scripts`, luego `npm install @oxc-parser/binding-darwin-x64 @oxc-transform/binding-darwin-x64 @oxc-minify/binding-darwin-x64`, luego `npm rebuild`.

---

## Estructura de Archivos

```
dashboard alef allin/
├── pages/
│   ├── index.vue                  # Login (3 capas de auth)
│   ├── admin-hub.vue              # Selector de empresa (solo superadmin)
│   ├── signup/index.vue
│   ├── reset-password/index.vue
│   └── pruebas/                   # Un .vue por empresa
│       ├── BradaPerfumes.vue
│       ├── Healup.vue
│       ├── AlefCompany.vue
│       ├── Alegrated.vue
│       ├── ClinicaArroyo.vue
│       ├── Origitec.vue
│       ├── Solari.vue
│       ├── SKIP.vue
│       ├── EstasConSuerte.vue
│       ├── EstetikaMedika.vue
│       └── MiguelDavila.vue
│
├── components/
│   ├── FacturacionPSE.vue              # Interfaz de facturas/boletas electrónicas (general)
│   ├── HealupCobroAtencion.vue         # Wizard 3 pasos: cobro de consulta + procedimientos Healup
│   ├── HealupCatalogoProcedimientos.vue # CRUD del catálogo de procedimientos Healup
│   ├── HealupGCalSync.vue              # Sincronización Google Calendar ↔ dashboard Healup
│   ├── N8nPanicButton.vue              # Activar/desactivar workflows n8n
│   └── Settings/
│       ├── SettingsView.vue            # Gestión de usuarios + logs de actividad
│       ├── CreateUserDialog.vue
│       └── EditUserDialog.vue
│
├── server/api/
│   ├── auth/verify-legacy.post.ts      # Verifica passwords bcrypt
│   ├── users/
│   │   ├── index.get.ts                # Listar usuarios (filtrado por company)
│   │   ├── create.post.ts              # Crear usuario (hash bcrypt, verifica permisos)
│   │   ├── update.put.ts               # Editar usuario
│   │   └── delete.delete.ts            # Eliminar usuario
│   ├── pse/                            # Facturación electrónica PSE.PE
│   ├── healup/
│   │   ├── enviar-whatsapp.post.ts     # Envío de boleta por WhatsApp vía n8n webhook
│   ├── gcal-events.get.ts          # Lee GCal via Google API + compara con Supabase
│   ├── importar-gcal.post.ts       # Importa evento GCal a healup_calendar_events
│   └── boleta-auto.post.ts         # Auto-genera boleta consulta S/50 (llamado por n8n al agendar)
│   └── n8n/toggle-workflow.post.ts
│
├── server/utils/
│   ├── logger.ts                       # logServerActivity() — log server-side a Supabase
│   └── google-auth.ts                  # JWT auth con Google Service Account (crypto nativo, 0 deps)
│
├── middleware/
│   └── auth-dashboard.ts               # Protección de rutas: lee cookie, verifica rol
│
├── composables/
│   ├── useActivityLogger.ts            # logActivity() — log client-side a Supabase
│   └── rules.ts                        # Reglas de validación de formularios
│
├── utils/
│   └── permissions.ts                  # isSuperAdmin(), canAccess*(), getDashboardPathByCompanyId()
│
├── plugins/
│   ├── vuetify.ts                      # Temas claro/oscuro
│   ├── apexcharts.client.ts
│   └── supabase-logger.client.ts       # Intercepta window.fetch y loggea mutations automáticamente
│
├── assets/styles/
│   └── dashboard.css                   # ~2,200 líneas de estilos custom
│
└── sql/                                # Schemas SQL por empresa
    ├── ECS_tables.sql
    ├── brada_stock_schema.sql
    └── healup_cobro_atencion.sql       # Migración: tipo en procedures + trazabilidad en calendar_events
```

---

## Auth — Flujo Completo

### Login (`pages/index.vue`) — 3 capas en cascada

```
1. client.auth.signInWithPassword()   ← Supabase Auth nativo
        ↓ éxito → también llama RPC login_dashboard() para obtener profile completo
        ↓ falla
2. client.rpc('login_dashboard', { p_email, p_password })   ← función en Supabase
        ↓ falla
3. POST /api/auth/verify-legacy   ← bcrypt.compare contra dashboardlogin
        ↓ éxito → intenta auto-migrar a Supabase Auth (signUp)
        ↓ falla → "Credenciales incorrectas"
```

**Al éxito de cualquier capa:**
- Si faltan `company_id` o `role`, los busca en `dashboardlogin` por email (safety check)
- Guarda cookie `dashboard_session = { id, email, full_name, role, company_id }`
- Registra actividad "Inició sesión" vía `useActivityLogger`
- Redirige: `superadmin` → `/admin-hub`, `admin`/`agente` → dashboard de su empresa

### Sesión en servidor (`server/api/`)

Cada endpoint verifica la sesión en este orden:
1. `serverSupabaseUser(event)` — JWT de Supabase
2. Cookie `dashboard_session` — fallback para usuarios legacy no migrados

**El servidor nunca confía ciegamente en la cookie** — siempre re-verifica el perfil real contra `dashboardlogin` antes de ejecutar cualquier operación.

### Seguridad de la cookie

`dashboard_session` es JSON plano, no firmado. Un usuario podría manipularla en el browser, pero los endpoints del servidor re-consultan `dashboardlogin` para obtener el rol real. La cookie solo sirve para navegación en el cliente.

---

## Roles y Permisos

| Rol | Acceso |
|---|---|
| `superadmin` | Todos los dashboards, todos los usuarios, sin restricción de empresa |
| `admin` | Solo su `company_id` — puede crear/editar/eliminar usuarios de su empresa |
| `agente` / `agent` | Solo ver su dashboard — sin gestión de usuarios |

### Aplicación de permisos

**Middleware** (`middleware/auth-dashboard.ts`):
- Sin cookie → redirige a `/`
- `superadmin` → puede acceder a todo
- Otros → solo pueden navegar dentro de `getDashboardPathByCompanyId(company_id)`

**Server-side** (cada endpoint en `server/api/users/`):
- Obtiene perfil real del solicitante desde `dashboardlogin`
- `superadmin`: puede operar sobre cualquier empresa
- `admin`: solo puede operar sobre usuarios de su `company_id`
- `agente`: no puede crear/editar/eliminar usuarios (403)
- Nadie puede crear `superadmin` vía endpoint
- No se puede eliminar el propio perfil

### `utils/permissions.ts` — funciones clave

```typescript
isSuperAdmin(sessionOrRole)              // bool
canAccessCompanyDashboard(session, id)   // bool — genérico
canAccessHealup/Brada/Alef/...(session) // bool — por empresa
getDashboardPathByCompanyId(companyId)   // string — ruta del dashboard
```

---

## Activity Logging

Doble sistema para auditar acciones:

| Capa | Archivo | Cuándo se ejecuta |
|---|---|---|
| Client-side | `composables/useActivityLogger.ts` | Llamado manualmente (ej: login, acciones UI) |
| Client-side automático | `plugins/supabase-logger.client.ts` | Intercepta `window.fetch` — loggea todo POST/PATCH/DELETE a Supabase REST automáticamente |
| Server-side | `server/utils/logger.ts` | Llamado manualmente en los endpoints de users |

**Reglas:**
- Superadmin **no** se loggea (intencional)
- Las tablas `activity_logs` y `dashboardlogin` están excluidas del auto-log
- Destino: tabla `activity_logs` en Supabase con `{ user_email, activity, company_id, created_at }`

---

## Componentes Compartidos

| Componente | Props | Uso |
|---|---|---|
| `N8nPanicButton.vue` | `clientKey` ('healup'\|'brada'\|'alegrated'), `label` | Activa/desactiva workflow n8n. Solo estas 3 empresas tienen workflows configurados |
| `FacturacionPSE.vue` | — | Emite y gestiona facturas/boletas electrónicas (formulario libre). Solo Healup y ECS |
| `HealupCobroAtencion.vue` | — | Wizard 3 pasos para cobro de atención médica Healup: paso 1 = seleccionar cita, paso 2 = emitir boleta consulta S/50, paso 3 = procedimientos con descuento S/50 aplicado |
| `HealupCatalogoProcedimientos.vue` | — | CRUD completo del catálogo `healup_procedures`. Agrupado por `grupo`, muestra precio sin/con IGV. Protege el ítem de consulta de ser eliminado |
| `HealupGCalSync.vue` | — | Sincronización Google Calendar ↔ dashboard. Muestra eventos GCal del día, estado de sync, botón importar individual/masivo. Usa endpoint `/api/healup/gcal-events` |
| `Settings/SettingsView.vue` | `companyId`, `currentUser` | CRUD de usuarios + logs de auditoría. Todos los dashboards |

---

## API Routes del Servidor

| Método | Ruta | Quién puede usarla |
|---|---|---|
| POST | `/api/auth/verify-legacy` | Login público (capa 3) |
| GET | `/api/users` | admin (su empresa), superadmin (todas) |
| POST | `/api/users/create` | admin, superadmin. No puede crear superadmin |
| PUT | `/api/users/update` | admin (su empresa), superadmin |
| DELETE | `/api/users/delete` | admin (su empresa), superadmin. No auto-eliminación |
| POST | `/api/n8n/toggle-workflow` | Cualquier autenticado. Body: `{ clientKey, active: boolean }` |
| POST | `/api/pse/factura` | Autenticados de Healup / ECS |
| GET | `/api/pse/comprobantes` | Autenticados de Healup / ECS |
| POST | `/api/pse/enviar-correo` | Autenticados de Healup / ECS |
| POST | `/api/pse/webhook-compra` | Webhook público de PSE.PE |
| POST | `/api/healup/enviar-whatsapp` | Autenticados Healup. Body: `{ telefono, mensaje, comprobante_id? }` |
| GET | `/api/healup/gcal-events` | Autenticados Healup. Query: `?date=YYYY-MM-DD`. Llama Google Calendar API directo → retorna eventos GCal + estado sync con Supabase |
| POST | `/api/healup/importar-gcal` | Autenticados Healup. Body: `{ date, time, client_name, client_surname, client_phone?, client_dni?, cabina? }` |
| POST | `/api/healup/boleta-auto` | n8n (api_key auth). Auto-genera boleta consulta S/50 al confirmar cita. Retorna PDF + mensaje WhatsApp listo |

---

## Base de Datos (Supabase)

### Tablas globales

| Tabla | Propósito |
|---|---|
| `dashboardlogin` | Usuarios: `id`, `email`, `password` (bcrypt), `role`, `company_id`, `full_name`, `created_at` |
| `activity_logs` | Auditoría: `user_email`, `activity`, `company_id`, `created_at` |
| `comprobantes_pse` | Facturas emitidas vía PSE.PE (payload + response) |

### Tablas por empresa

**Brada:** `brada_stock` (inventario), `brada_calendar_events` (entregas), `comprasBDwppBRADA` (leads de compra), `GeneralBDwppBRADA` (leads generales)

**ECS:** múltiples tablas `ECS_*` de leads y ventas por canal

---

## Integraciones

### PSE.PE / NubeFact (Facturación electrónica)
- Empresas habilitadas: **Estás Con Suerte**, **Healup**
- Endpoints: `server/api/pse/`
- JWT tokens por empresa hardcodeados en el servidor (no en `.env`)
- Guarda respuestas en tabla `comprobantes_pse`
- También maneja webhooks de pago y envío de correo (Resend) y WhatsApp (n8n)
- **Referencia completa de la API:** `referencia/facturacion/pse-nubefact-api.md` (estructura de payload, tipos IGV, descuentos, math)
- **Flujo de cobro médico:** `referencia/facturacion/flujo-cobro-atencion.md` (guía para replicar en otras clínicas)

### n8n (Automatización)
- Toggle de workflows desde el dashboard
- Empresas configuradas: Alegrated (ImportaMaster), Brada, Healup
- Endpoint: `POST /api/n8n/toggle-workflow` con `{ clientKey, active: boolean }`
- Requiere env vars: `N8N_API_KEY`, `N8N_BASE_URL`, `N8N_ID_ALEGRATED`, `N8N_ID_BRADA`, `N8N_ID_HEALUP`

---

## Variables de Entorno (`.env`)

```
SUPABASE_URL=
SUPABASE_KEY=
N8N_API_KEY=
N8N_BASE_URL=
N8N_ID_ALEGRATED=
N8N_ID_BRADA=
N8N_ID_HEALUP=
# Facturación Healup (correo)
RESEND_API_KEY=
RESEND_FROM="Heal Up <boletas@healablab.com>"
# WhatsApp vía n8n (uno por empresa que lo use)
N8N_WEBHOOK_HEALUP_BOLETA=
# Google Calendar sync (directo, sin n8n)
GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'
GOOGLE_CALENDAR_ID_HEALUP=healupaestheticlab@gmail.com
# Boleta automática (n8n llama al confirmar cita)
HEALUP_BOLETA_AUTO_KEY=healup-auto-2026
```

---

## Patrones Importantes

- **Nueva empresa:** Agregar `.vue` en `pages/pruebas/` + entradas en `utils/permissions.ts` (canAccess* y getDashboardPathByCompanyId) + tablas en Supabase + actualizar `tables2.json`
- **Estilos:** Todo custom va en `assets/styles/dashboard.css` (~2200 líneas), no inline. Tema Vuetify configurado en `plugins/vuetify.ts` (oscuro por defecto, dorado #daa520)
- **Seguridad:** Lógica sensible (API keys, bcrypt, JWT tokens PSE.PE) siempre en `server/api/`, nunca expuesta al cliente
- **Logs:** Acciones manuales importantes → `useActivityLogger` (cliente) o `logServerActivity` (servidor). El plugin `supabase-logger.client.ts` loggea automáticamente todas las mutations
- **Permisos:** Siempre verificar rol en el servidor, el middleware solo protege navegación
- **company_id:** Los valores en BD tienen capitalización inconsistente — `permissions.ts` hace lowercase + fuzzy match para normalizar
- **PSE.PE tokens:** JWT hardcodeados en `server/api/pse/factura.post.ts` (no en `.env`) porque son por empresa
- **Supabase Service Role Key:** La key en `.env` es `service_role` (no `anon`), tiene acceso total a la BD sin RLS

---

## Healup — Lógica Específica (`pages/pruebas/Healup.vue`)

### Tablas Supabase

| Tabla | Propósito |
|---|---|
| `healup_calendar_events` | Citas del calendario. Fechas en dos formatos: `DD-MM-YYYY` (agente IA) y `YYYY-MM-DD` (manual) |
| `healup_procedures` | Catálogo de procedimientos. Campos: `id`, `name`, `sku`, `grupo`, `price` (valor_unitario sin IGV), `tipo` (`consulta`/`procedimiento`/`producto`), `cabina` |
| `GeneralBDwppHEALUP` | Leads de WhatsApp y TikTok. Campos: `nombre`, `numero`, `lead_status`, `reason_ia_qualification`, `servicio_interes` |
| `GeneralBDfbigHEALUP` | Leads de Facebook e Instagram. Usa `instagram_handle` en vez de `numero` |
| `PacientesBDwppHEALUP` | Pacientes captados por WhatsApp. Campo clave: `fecha_agendamiento` |
| `PacientesBDfbigHEALUP` | Pacientes captados por FB/IG. Campo clave: `fecha_agendamiento` |

**Columnas de trazabilidad de cobro en `healup_calendar_events`** (agregadas en `sql/healup_cobro_atencion.sql`):

| Columna | Tipo | Propósito |
|---|---|---|
| `boleta_consulta_serie` | TEXT | Serie de la boleta de consulta (ej: `B001`) |
| `boleta_consulta_numero` | BIGINT | Número correlativo de la boleta de consulta |
| `boleta_consulta_id` | BIGINT | ID en `comprobantes_pse` de la boleta de consulta |
| `boleta_proc_serie` | TEXT | Serie de la boleta de procedimiento |
| `boleta_proc_numero` | BIGINT | Número correlativo de la boleta de procedimiento |
| `boleta_proc_id` | BIGINT | ID en `comprobantes_pse` de la boleta de procedimiento |
| `cobro_completado` | BOOLEAN | `true` cuando el flujo de cobro completo ha sido emitido |

### Quirks de Datos

- **Fechas del calendario:** El agente IA guarda `DD-MM-YYYY`, entradas manuales usan `YYYY-MM-DD`. Siempre normalizar con `normalizeDate()` al hacer fetch.
- **Paginación:** `GeneralBDwppHEALUP` tiene 1500+ filas. Supabase limita a 1000 por query — usar loop con `.range(offset, offset+999)` hasta que devuelva menos de 1000.
- **Números encriptados:** Algunos `numero` en `GeneralBDwppHEALUP` están en base64 (ej: `u5Bkps+uBQhtO+xuEE9b81yi1A==`). Detectar con `isEncrypted()` — contiene caracteres no numéricos y longitud > 10.
- **Leads TikTok vs WhatsApp:** Los leads sin número real (encriptados o null) son de TikTok. Los que tienen número son de WhatsApp. La columna "Fuente" usa `isEncrypted()` para distinguirlos.
- **Conversión a pacientes:** Definición simplificada — `convertidos` del mes = todos los pacientes (`PacientesBDwppHEALUP` + `PacientesBDfbigHEALUP`) cuyo `fecha_agendamiento` empieza con `YYYY-MM` del mes en cuestión. No se hace cross-reference de teléfonos.
- **Nombres null:** La BD puede guardar el string literal `"null"`. El template muestra `—` si `nombre` es null, `"null"`, o string vacío.

### Métricas del Dashboard

- **Stat cards:** Siempre muestran el mes actual. Comparan con mes anterior (flecha ↑↓).
- **Histórico de leads:** Muestra todos los meses desde enero 2026 (inicio del agente IA). Columnas: total, fríos, tibios, calientes, convertidos (pacientes agendados ese mes).
- **Semáforo de leads:** Frío = `lead_status` contiene "fri", Tibio = "tibi", Caliente = "caliente".

### Tabs de Facturación (`pages/pruebas/Healup.vue`)

La sección de contabilidad tiene 3 tabs (la activa por defecto es `cobro_atencion`):

| Tab value | Componente | Propósito |
|---|---|---|
| `cobro_atencion` | `HealupCobroAtencion` | Wizard de cobro guiado — flujo principal para el equipo |
| `gcal_sync` | `HealupGCalSync` | Sincronizar Google Calendar ↔ dashboard. Importar citas de IG/FB que faltan |
| `factura_electronica` | `FacturacionPSE` (company-id="healup") | Emisión libre de facturas/boletas (avanzado) |
| `catalogo` | `HealupCatalogoProcedimientos` | CRUD del catálogo de procedimientos |

### Flujo de Cobro de Atención (`HealupCobroAtencion.vue`)

Wizard de 3 pasos que implementa las reglas de negocio de cobro:

1. **Paso 1 — Seleccionar paciente**: Carga citas del día desde `healup_calendar_events`. Pre-llena nombre, apellido, DNI, email, teléfono y procedimiento desde la cita seleccionada (o entrada manual).

2. **Paso 2 — Boleta de consulta**: Emite siempre una boleta B001 por S/50 (Consulta Médica, SKU `CON-001`, `valor_unitario=42.37`, `tipo_de_igv=1`). Actualiza `healup_calendar_events` con `boleta_consulta_*`.

3. **Paso 3 — Procedimientos**: Selector del catálogo (filtrable por nombre/SKU, agrupado por `grupo`) con descuento S/50 auto-aplicado. Descuento pre-IGV = `50/1.18 = 42.37`. Enviado como `descuento_global` a NubeFact. Después de emitir: botones para enviar por email y WhatsApp. Actualiza `healup_calendar_events` con `boleta_proc_*` y `cobro_completado = true`.

**Constantes clave en el componente:**
```javascript
CONSULTA_VALOR_UNIT = 42.37      // 50 / 1.18 — precio sin IGV de la consulta
DESCUENTO_PRETAX   = 42.37      // descuento_global enviado a NubeFact
SERIE_BOLETA       = 'B001'
```

**Numeración de boletas:** Consulta `MAX(numero)` en `comprobantes_pse` para la serie + 1. Posible race condition con múltiples operadores — futuro: migrar a secuencia SQL.

> Ver guía completa de replicación en `referencia/facturacion/flujo-cobro-atencion.md`

### Funciones Helper Clave

```javascript
normalizeDate(raw)   // Convierte DD-MM-YYYY → YYYY-MM-DD (no toca YYYY-MM-DD)
normalizePhone(num)  // Quita prefijo 51 de números de 11 dígitos (leads WPP guardan 51XXXXXXXXX)
isEncrypted(val)     // True si el valor tiene chars no numéricos y longitud > 10 (base64)
```

---

## Estetika Medika — Lógica Específica (`pages/pruebas/EstetikaMedika.vue`)

- **Conversaciones:** `https://chats.alef.company/app/accounts/14/dashboard`
- **Logo:** `assets/img/estetika-medika-logo.png`
- **company_id en BD:** `estetikamedika` / `estetika medika`
- **Permiso:** `canAccessEstetikaMedika` en `utils/permissions.ts`

### Tablas Supabase

| Tabla | Propósito |
|---|---|
| `GeneralBDwppEstetikaMedika` | Leads de WhatsApp |
| `GeneralBDfbigEstetikaMedika` | Leads de Facebook/Instagram |
| `PacientesBDwppEstetikaMedika` | Pacientes captados por WhatsApp |
| `PacientesBDfbigEstetikaMedika` | Pacientes captados por FB/IG |
| `EstetikaMedika_calendar_events` | Citas del calendario |
| `EstetikaMedika_medical_history` | Historial clínico |
| `EstetikaMedika_procedures` | Procedimientos disponibles |
| `EstetikaMedika_working_hours` | Horarios de trabajo |
| `egresos_EstetikaMedika` | Egresos/gastos |
| `metricas_EstetikaMedika` | Métricas adicionales (pendiente de integrar en UI) |
| `pacientesbdEstetikaMedika` | Tabla adicional de pacientes (pendiente de integrar en UI) |

---

## Miguel Davila — Lógica Específica (`pages/pruebas/MiguelDavila.vue`)

- **Conversaciones:** `https://chats.alef.company/app/accounts/3/dashboard`
- **Logo:** `assets/img/miguel-davila-logo.png`
- **company_id en BD:** `davila` / `miguel davila`
- **Permiso:** `canAccessDavila` en `utils/permissions.ts`

### Tablas Supabase

| Tabla | Propósito |
|---|---|
| `GeneralBDwppDAVILA` | Leads de WhatsApp |
| `GeneralBDfbigDAVILA` | Leads de Facebook/Instagram |
| `PacientesBDwppDAVILA` | Pacientes captados por WhatsApp |
| `PacientesBDfbigDAVILA` | Pacientes captados por FB/IG |
| `DAVILA_calendar_events` | Citas del calendario |
| `DAVILA_medical_history` | Historial clínico |
| `DAVILA_procedures` | Procedimientos disponibles |
| `DAVILA_working_hours` | Horarios de trabajo |
| `egresos_DAVILA` | Egresos/gastos |
| `metricas_DAVILA` | Métricas adicionales (pendiente de integrar en UI) |
| `pacientesbdDAVILA` | Tabla adicional de pacientes (pendiente de integrar en UI) |
