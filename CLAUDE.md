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
│   ├── RemarketingPanel.vue            # Sistema de remarketing multi-tenant (11 empresas)
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
│   ├── boleta-auto.post.ts         # Auto-genera boleta consulta S/50 (llamado por n8n al agendar)
│   ├── cron-agendamientos-diarios.get.ts        # Vercel Cron 19:00 Lima — POSTea pacientes agendados hoy a n8n
│   ├── agendamientos-diarios-trigger.post.ts    # Disparo manual desde UI ("Probar envío ahora")
│   └── agendamientos-diarios-logs.get.ts        # Lista paginada de logs para la UI
│   └── n8n/toggle-workflow.post.ts
│
├── server/utils/
│   ├── logger.ts                       # logServerActivity() — log server-side a Supabase
│   ├── google-auth.ts                  # JWT auth con Google Service Account (crypto nativo, 0 deps)
│   └── healup-agendamientos.ts         # Lógica compartida del envío diario a n8n (cron + manual)
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
| `HealupCobroAtencion.vue` | — | Wizard 2 pasos para cobro de atención médica Healup: paso 1 = seleccionar cita/paciente, paso 2 = procedimientos + multi-pago (N metodos por transaccion) + descuento reserva aplicado. Guarda pagos en `healup_cita_pagos` |
| `HealupAgent.vue` | — | Agente conversacional AI completo — chat + grabacion de voz Whisper + sintesis. 14 tools: egresos, citas, pacientes, stock, procedimientos, leads. Selector de microfono, modo manos libres, atajo teclado configurable |
| `HealupCatalogoProcedimientos.vue` | — | CRUD completo del catálogo `healup_procedures`. Agrupado por `grupo`, muestra precio sin/con IGV. Protege el ítem de consulta de ser eliminado |
| `HealupGCalSync.vue` | — | Sincronización Google Calendar ↔ dashboard. Muestra eventos GCal del día, estado de sync, botón importar individual/masivo. Usa endpoint `/api/healup/gcal-events` |
| `RemarketingPanel.vue` | `companyId`, `leadTablas: { wpp, fbig }` | Sistema de remarketing multi-tenant. 4 tabs: Pipeline (funnel), Leads (filtrable + envio individual/bulk), Campanas (CRUD + ejecucion), Templates (CRUD). Anti-spam por temperatura. Envio via Chatwoot WhatsApp. Integrado en los 11 dashboards |
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
| POST | `/api/healup/agent-chat` | Autenticados Healup. Proxy a Claude API (claude-sonnet-4-6) con 14 tools. Body: `{ messages }` |
| POST | `/api/healup/transcribe` | Autenticados Healup. Transcripcion de audio via Whisper (OpenAI). FormData con campo `audio` |
| GET  | `/api/healup/cron-agendamientos-diarios` | Llamado por la Netlify Scheduled Function (`netlify/functions/cron-healup-agendamientos.mts`, `0 0 * * *` = 19:00 Lima). Auth: `?api_key=<HEALUP_AGENDAMIENTO_CRON_KEY>`. Consulta los pacientes agendados HOY (Lima) en `PacientesBDwppHEALUP`, `PacientesBDfbigHEALUP` y `PacientesBDtiktokHEALUP`, POSTea el JSON a `N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO`, registra log en `healup_agendamiento_diario_logs` |
| POST | `/api/healup/agendamientos-diarios-trigger` | Autenticados Healup. Disparo manual del envío diario (botón "Probar envío ahora" del panel) |
| GET  | `/api/healup/agendamientos-diarios-logs` | Autenticados Healup. Lista paginada de los logs. Query: `?limit=&offset=&status=success|error|empty` |
| POST | `/api/remarketing/send` | Autenticados. Envio individual de mensaje WhatsApp via Chatwoot. Body: `{ company_id, lead_id, lead_tabla, lead_telefono, lead_nombre, template_id?, mensaje, canal? }` |

---

## Base de Datos (Supabase)

### Tablas globales

| Tabla | Propósito |
|---|---|
| `dashboardlogin` | Usuarios: `id`, `email`, `password` (bcrypt), `role`, `company_id`, `full_name`, `created_at` |
| `activity_logs` | Auditoría: `user_email`, `activity`, `company_id`, `created_at` |
| `comprobantes_pse` | Facturas emitidas vía PSE.PE (payload + response) |
| `remarketing_config` | Config por empresa: Chatwoot account/inbox IDs, cadencias anti-spam |
| `remarketing_templates` | Templates de mensaje por categoria_proc (A/B/C/D) x temperatura (frio/tibio/caliente/recall) |
| `remarketing_contactos` | Historial de mensajes enviados (tracking anti-spam) |
| `remarketing_campaigns` | Campanas masivas: segmento, template, estado, metricas |

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

#### Bugs conocidos y estado al 2026-04-21

**Bug corregido — número de comprobante duplicado (código 23):**
`FacturacionPSE.vue` tenía `formInicial()` con `numero: 1` hardcodeado. Al abrir el dialog fresco siempre mandaba B001-1 (ya existente → 400 código 23). Fix: `abrirNuevo()` y `onTipoCambia()` ahora llaman `siguienteNumero(tipo, serie)` que calcula `max(comprobantes filtrados por tipo+serie) + 1`.

**Problema pendiente — `aceptada_por_sunat: false` en HealUp:**
Las 16 boletas emitidas por HealUp tienen `aceptada_por_sunat: false` y CDR vacío — SUNAT nunca confirmó recepción. Además, intentar emitir boleta nueva da **error interno PSE.PE código 40** (`undefined method 'codigo' for nil`, excepción Ruby en backend NubeFact). Confirmado llamando directamente a `api.pse.pe` — no es un bug de nuestro código.

**Causa probable:** El certificado digital de HealUp en PSE.PE está vencido o la empresa no completó la inscripción como emisor electrónico ante SUNAT.

**Acción requerida:** Entrar al panel PSE.PE → cuenta HealUp → verificar vigencia del certificado digital SUNAT y estado de inscripción como emisor electrónico. O contactar soporte PSE.PE con el código de error 40.

> Para diagnosticar PSE.PE directamente sin levantar el servidor Nuxt:
> ```bash
> curl -s -X POST "https://api.pse.pe/api/v1/b3a349e648c543088a5e807bd36c4337b261a1b468974863ba49762bd2dd3600" \
>   -H "Content-Type: application/json; charset=utf-8" \
>   -H "Authorization: <JWT_HEALUP>" \
>   -d '{"operacion": "consultar_comprobante", "tipo_de_comprobante": 2, "serie": "B001", "numero": 16}'
> ```

### n8n (Automatización)
- Toggle de workflows desde el dashboard
- Empresas configuradas: Alegrated (ImportaMaster), Brada, Healup
- Endpoint: `POST /api/n8n/toggle-workflow` con `{ clientKey, active: boolean }`
- Requiere env vars: `N8N_API_KEY`, `N8N_BASE_URL`, `N8N_ID_ALEGRATED`, `N8N_ID_BRADA`, `N8N_ID_HEALUP`

### Envío Diario WhatsApp — Pacientes Agendados (Healup → n8n → Gerente)

Herramienta nueva (sidebar Healup → **HERRAMIENTAS → Envío Diario WhatsApp**). Flujo end-to-end:

1. **Netlify Scheduled Function** `netlify/functions/cron-healup-agendamientos.mts` se ejecuta todos los días a las `0 0 * * *` UTC (= 19:00 hora Lima, Lima es UTC-5 todo el año).
2. La Scheduled Function hace un `GET` al endpoint del dashboard `/api/healup/cron-agendamientos-diarios?api_key=$HEALUP_AGENDAMIENTO_CRON_KEY`.
3. El endpoint consulta los pacientes con `created_at >= 00:00 Lima del día actual` en las 3 tablas: `PacientesBDwppHEALUP`, `PacientesBDfbigHEALUP`, `PacientesBDtiktokHEALUP`.
4. Construye un JSON estructurado (`evento: healup.agendamiento_diario`, `resumen`, `pacientes[]` con todas las columnas + `_canal` + `_origen_tabla`) y lo POSTea al webhook `N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO`.
5. n8n recibe el JSON y dispara su HTTP request existente para enviar el WhatsApp a la gerente.
6. El endpoint guarda un log completo en `healup_agendamiento_diario_logs` (timestamp, payload enviado completo, respuesta n8n, http_status, error_message, duración).

**Panel UI** (`components/HealupAgendamientoDiarioPanel.vue`): muestra estadísticas (total/éxitos/errores/vacíos), filtros, tabla de logs con expand para ver el JSON enviado + respuesta n8n + error, botón **"Probar envío ahora"** (disparo manual vía `POST /api/healup/agendamientos-diarios-trigger` — requiere sesión Healup).

**Netlify Scheduled Function** (`netlify/functions/cron-healup-agendamientos.mts`): el schedule está declarado dentro del archivo con `export const config = { schedule: '0 0 * * *' }`. Netlify la detecta automáticamente (carpeta `functions = "netlify/functions"` en `netlify.toml`).

**Env vars requeridas (Netlify → Site settings → Environment variables):**
- `N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO` — URL del webhook n8n destinatario
- `HEALUP_AGENDAMIENTO_CRON_KEY` — clave (cualquier string largo aleatorio) que comparten la Scheduled Function y el endpoint Nuxt
- (Netlify inyecta `URL` automáticamente con la URL del site)

**Migración SQL:** correr una vez `sql/healup_agendamiento_diario_logs.sql` en Supabase.

**Diagnóstico manual** (sin esperar al cron):
```bash
curl -s "https://<tu-site>.netlify.app/api/healup/cron-agendamientos-diarios?api_key=$HEALUP_AGENDAMIENTO_CRON_KEY"
```
También se puede disparar desde el dashboard con el botón "Probar envío ahora".

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
# Agente AI Healup
ANTHROPIC_API_KEY=              # Claude API para agent-chat
OPENAI_API_KEY=                 # Whisper transcripcion de voz
# Remarketing (Chatwoot WhatsApp)
CHATWOOT_API_TOKEN=             # Token API Chatwoot para envio de mensajes remarketing
# Envío Diario de pacientes agendados (Herramientas Healup → n8n → WhatsApp gerente)
N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO=   # URL del webhook n8n que recibe el JSON diario
HEALUP_AGENDAMIENTO_CRON_KEY=             # Clave compartida entre la Netlify Scheduled Function y el endpoint Nuxt
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
| `egresos_healup` | Egresos/gastos. Campos: `tipo_egreso`, `nombre`, `precio`, `cantidad`, `categoria`, `metodo_pago`, `referencia`, `deleted_at`, `descartado` |
| `healup_cita_pagos` | Multi-pago por atencion (1:N). Campos: `event_id`, `comprobante_id`, `metodo_pago` (Yape/Plin/Efectivo/Transferencia/Tarjeta), `monto` |
| `healup_stock_items` | Inventario de insumos. Campos: `nombre`, `categoria`, `unidad`, `cantidad_actual`, `umbral_minimo`, `costo_unitario` |
| `healup_stock_movements` | Movimientos de stock (entrada/salida/ajuste). FK a `healup_stock_items` |
| `healup_procedure_supplies` | Insumos por procedimiento (para descuento automatico de stock) |
| `healup_agendamiento_diario_logs` | Logs de los envíos diarios a n8n con los pacientes agendados ese día. Campos: `fecha_lima`, `origen` (cron/manual), `triggered_by_email`, `status` (success/error/empty), `pacientes_count`, `pacientes_wpp_count`, `pacientes_fbig_count`, `pacientes_tiktok_count`, `webhook_url`, `payload_enviado` (JSONB), `respuesta_n8n` (JSONB), `http_status`, `error_message`, `duracion_ms`. Migración: `sql/healup_agendamiento_diario_logs.sql` |

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

Wizard de 2 pasos:

1. **Paso 1 — Seleccionar paciente**: Carga citas del día desde `healup_calendar_events`. Pre-llena nombre, apellido, DNI, email, teléfono y procedimiento desde la cita seleccionada (o entrada manual).

2. **Paso 2 — Precotización + Multi-pago**: Selector del catálogo de procedimientos (filtrable por nombre/SKU, agrupado por `grupo`) + panel de resumen con descuento de reserva auto-aplicado + **multi-pago** (N metodos de pago por transaccion, ej: S/500 Yape + S/200 Transferencia + S/50 Efectivo). La boleta solo se puede emitir cuando la suma de pagos cuadra con el total. Los pagos se guardan en `healup_cita_pagos`. Descuento = monto_reserva de la cita (S/50 cabina 1, S/20 cabina 2). Botones para enviar boleta por email y WhatsApp.

**Constantes clave:**
```javascript
SERIE_BOLETA       = 'B001'
```

**Multi-pago:** Opciones: Yape, Plin, Efectivo, Transferencia, Tarjeta. Boton "Autocompletar" rellena el ultimo pago con el restante. Validacion: suma de pagos === total. Se guardan en tabla `healup_cita_pagos` (event_id, comprobante_id, metodo_pago, monto).

**Numeración de boletas:** Consulta `MAX(numero)` en `comprobantes_pse` para la serie + 1.

### Agente AI Healup (`HealupAgent.vue` + `useHealupAgent.ts`)

Panel flotante con chat conversacional + voz (Whisper). Acceso completo a toda la BD del dashboard via 14 tools:

| Tool | Accion |
|---|---|
| `register_egreso` | Crear egreso |
| `list_egresos_mes` | Listar egresos del mes |
| `modificar_egreso` | Editar o soft-delete egreso |
| `resumen_mes` | Resumen financiero (ingresos, egresos, utilidad, pacientes) |
| `consultar_citas_hoy` | Agenda del dia (o cualquier fecha) |
| `crear_cita` | Agendar nueva cita |
| `actualizar_cita` | Cambiar estado, reagendar, marcar cobrado |
| `buscar_paciente` | Buscar por nombre/DNI/telefono |
| `registrar_paciente` | Crear paciente nuevo |
| `actualizar_paciente` | Modificar estado, precio, metodo pago |
| `listar_procedimientos` | Catalogo con precios sin/con IGV |
| `consultar_stock` | Inventario, stock bajo |
| `movimiento_stock` | Entrada/salida/ajuste de insumos |
| `consultar_leads` | Leads por estado y mes |

**Voz:** Grabacion via MediaRecorder → transcripcion Whisper (OpenAI) → respuesta Claude → sintesis de voz (Web Speech API con seleccion de voz espanola).
**Config:** Selector de microfono, modo manos libres (auto-restart mic tras respuesta), atajo de teclado configurable (default Cmd+J).
**Requiere:** `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` en env vars.

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
