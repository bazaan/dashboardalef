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
| `piola` / `Piola` | Piola (agencia de marketing) | `/pruebas/Piola` |

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
| POST | `/api/gatwick/buscar-edificio` | Agente Gatwick (api_key `gatwick-edificio-2026`). Busca en `gatwick_edificios`. Log `tool_name='buscando_edificio'` |
| POST | `/api/gatwick/sms-alerta` | Agente Gatwick (api_key `gatwick-sms-2026`). SMS de alerta al técnico vía Telnyx. Log `tool_name='SMS Alerta Emergencia'` |
| POST | `/api/gatwick/generar-llamada` | Agente Gatwick (api_key `gatwick-llamada-2026`). Llamada de voz al técnico vía Vonage. Log `tool_name='Generar Llamada'` |
| GET/POST | `/api/vonage/handle-call` | Público (Vonage lo consulta). Devuelve el NCCO de la llamada de emergencia (talk ×3 + hangup) |

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

### Registro de Errores + Reporte de Tokens (cualquier flujo n8n → Dashboard + WhatsApp)

Logger genérico multi-empresa para que **cualquier** workflow de n8n reporte errores y consumo de tokens.

- **Endpoint:** `POST /api/flows/log` — api_key `flow-log-2026` (env `FLOW_LOG_API_KEY`). Escribe en `agent_tool_logs`.
- **Aparece solo en la UI:** el panel **Dev · Agent Logs** ya lee `agent_tool_logs`; basta con que las filas tengan el `company_id` y `tool_name` correctos. Se agregaron las tools `Registro de Errores` y `Reporte de Tokens` a `COMPANY_TOOLS` (todas las empresas) en `pages/pruebas/AlefCompany.vue`.
- **Empresa automática:** si no se manda `company_id`, se deduce del `flow_name` por keywords (`resolveCompany()` en el endpoint: `heal up`→healup, `suerte`/`ecs`→estasconsuerte, etc.).
- **Dos modos** (`kind`):
  - `error` → `tool_name='Registro de Errores'`, `status='error'`. Lo llama un workflow **Error Handler** de n8n (nodo *Error Trigger*) asignado como *Error Workflow* en cada flujo.
  - `execution` → `tool_name='Reporte de Tokens'`, `status='success'`, guarda `tokens` (JSONB) + `tokens_total`. Lo llama un nodo HTTP al final de cada flujo con IA.
- **WhatsApp:** la respuesta del endpoint trae `whatsapp_message` ya formateado para encadenar a un nodo Chatwoot (`POST https://chats.alef.company/api/v1/accounts/<acct>/conversations/<conv>/messages`).
- **Migración SQL:** correr una vez `sql/flow_logs_tokens.sql` (extiende `agent_tool_logs` con `flow_name`, `node_name`, `n8n_execution_id`, `tokens`, `tokens_total`).
- **Guía paso a paso n8n:** `referencia/n8n/registro-errores-y-tokens.md`.

### Envío Diario WhatsApp — Pacientes Agendados (Healup → n8n → Gerente)

Herramienta interna (vive en **dashboard Alef → Dev · Agent Logs → Empresa: Healup → Tool: "Envío Diario WhatsApp"**). Se movió fuera del dashboard de Healup porque ese lo ven los doctores y el testeo va en el dashboard interno de Alef. Permisos de los endpoints ampliados a `alef`/`alef company` (además de healup y superadmin). Flujo end-to-end:

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

### Citas de Mañana — Resumen Diario WhatsApp (Healup → n8n → WhatsApp)

Herramienta interna (vive en **dashboard Alef → Dev · Agent Logs → Empresa: Healup → Tool: "Citas de Mañana"**, igual que "Envío Diario WhatsApp"; se movió fuera del dashboard de Healup que ven los doctores). Es "parecida" a la
anterior pero distinta en el QUÉ envía: en vez de los pacientes *creados* hoy, envía un resumen de
**todas las citas cuya fecha de agendamiento es MAÑANA** (día Lima + 1). Flujo end-to-end:

1. **Netlify Scheduled Function** `netlify/functions/cron-healup-citas-manana.mts` corre `0 0 * * *` UTC (= 19:00 Lima).
2. Hace `GET` a `/api/healup/cron-citas-manana?api_key=$HEALUP_AGENDAMIENTO_CRON_KEY` (reusa la misma clave del cron).
3. El endpoint (lógica en `server/utils/healup-citas-manana.ts`) trae las citas de mañana de **dos fuentes**:
   - **Dashboard:** tabla `healup_calendar_events` (matchea fecha en ambos formatos `YYYY-MM-DD` y `DD-MM-YYYY`).
   - **Google Calendar:** API directa con el mismo service account que usa `/gcal-events`.
4. **Deduplica:** dos citas se fusionan si ocurren en la **misma franja horaria** Y son la misma persona
   (mismo DNI **o** mismo teléfono **o** mismo nombre normalizado, ej: "José Perez" ≈ "jose pérez").
   Al fusionar conserva el **nombre más largo** y rellena DNI/teléfono/procedimiento faltantes.
   (Citas de la misma persona a horas distintas NO se fusionan: son citas reales distintas.)
5. Formatea cada cita con **fecha+hora amigable** (`formatFriendly` → `27/05/26 2:00pm`) y arma un
   `mensaje_whatsapp` listo para enviar dentro del payload.
6. POSTea el JSON a `N8N_WEBHOOK_HEALUP_CITAS_MANANA`. n8n recibe → Code node → HTTP Request → WhatsApp.
7. Guarda log en `healup_citas_manana_logs` (payload completo, respuesta n8n, http_status, duración).

**Panel UI:** `components/HealupCitasMananaPanel.vue` (stats, filtros, tabla de logs con preview del
mensaje WhatsApp + JSON enviado + respuesta, botón "Probar envío ahora" vía `POST /api/healup/citas-manana-trigger`).

**Endpoints:**
- `GET /api/healup/cron-citas-manana` — disparado por la Scheduled Function (auth `?api_key=` o `CRON_SECRET`).
- `POST /api/healup/citas-manana-trigger` — disparo manual (requiere sesión Healup).
- `GET /api/healup/citas-manana-logs` — lista paginada de logs (`?limit=&offset=&status=`).

**Env vars:**
- `N8N_WEBHOOK_HEALUP_CITAS_MANANA` — URL del webhook n8n destinatario (NUEVA).
- `HEALUP_AGENDAMIENTO_CRON_KEY` — reusa la clave existente.
- `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_CALENDAR_ID_HEALUP` — ya configuradas para gcal-events.

**Migración SQL:** correr una vez `sql/healup_citas_manana_logs.sql` en Supabase.

**Payload enviado a n8n** (forma):
```jsonc
{
  "evento": "healup.citas_dia_siguiente",
  "empresa": "Healup",
  "fecha_objetivo": "2026-05-27",
  "fecha_objetivo_friendly": "27/05/26",
  "resumen": { "total_citas": 3, "desde_dashboard": 2, "desde_google_calendar": 2, "duplicados_fusionados": 1 },
  "mensaje_whatsapp": "📅 *Citas de mañana (27/05/26)* ...",   // ya armado, listo para enviar
  "citas": [
    { "fecha": "2026-05-27", "hora": "14:00", "fecha_hora_friendly": "27/05/26 2:00pm",
      "nombre_completo": "José Pérez García", "dni": "70973677", "telefono": "936818130",
      "procedimiento": "Botox", "cabina": "cabina1", "fuentes": ["dashboard","google_calendar"] }
  ]
}
```

**Diagnóstico manual:**
```bash
curl -s "https://<tu-site>.netlify.app/api/healup/cron-citas-manana?api_key=$HEALUP_AGENDAMIENTO_CRON_KEY"
```

### Gatwick — Agente de Emergencias (tools del agente IA)

El agente de emergencias de Gatwick (n8n) tiene tools que pegan a endpoints del
dashboard. Todas loguean en `agent_tool_logs` → visibles en **dashboard Alef →
Dev · Agent Logs → Empresa: Gatwick**.

| Tool | Endpoint | api_key | Qué hace |
|---|---|---|---|
| `buscando_edificio` | `POST /api/gatwick/buscar-edificio` | `gatwick-edificio-2026` | Busca en `gatwick_edificios` (hasta 5 términos). `tool_name='buscando_edificio'` |
| `sms_alerta_emergencia` | `POST /api/gatwick/sms-alerta` | `gatwick-sms-2026` | Envía SMS de alerta al técnico de turno vía **Telnyx**. `tool_name='SMS Alerta Emergencia'` |
| `generar_llamada` | `POST /api/gatwick/generar-llamada` | `gatwick-llamada-2026` | Llama por voz al técnico de turno vía **Vonage**. `tool_name='Generar Llamada'` |

- **SMS (Telnyx):** arma el mensaje con el template fijo (🚨 EMERGENCIA…), lo manda
  a **todos** los técnicos `activo=true AND recibe_sms=true` de `gatwick_alerta_destinos`.
  El `telefono_contacto` se enmascara antes de loguear. `TELNYX_API_KEY` es **requerida**
  (secreta, solo por env var; no se hardcodea). `TELNYX_MESSAGING_PROFILE_ID` y
  `TELNYX_SMS_FROM` son opcionales (tienen default).
- **Llamada (Vonage):** reproduce *"Emergencia Gatwick. Revisa el WhatsApp"* 3 veces (NCCO
  servido por el endpoint público `GET/POST /api/vonage/handle-call`). Llama a los técnicos
  `recibe_llamada=true`. La Voice API **exige JWT RS256** firmado con la private key de una
  *Vonage Application* (Voice) → env `VONAGE_APPLICATION_ID` + `VONAGE_PRIVATE_KEY`
  (el `api_key`/`api_secret` de Vonage NO sirven para Voice). JWT generado en
  `server/utils/vonage-auth.ts` (crypto nativo, 0 deps, igual que `google-auth.ts`).
- **Destinos (técnicos de turno):** tabla `gatwick_alerta_destinos` (`nombre`, `telefono` E.164,
  `recibe_sms`, `recibe_llamada`, `activo`, `orden`). Editable sin redeploy. Fallback de env:
  `GATWICK_SMS_DESTINO_FALLBACK` / `GATWICK_LLAMADA_DESTINO_FALLBACK` (coma-separados).
- **Migración SQL:** correr una vez `sql/gatwick_sms_llamada_tools.sql` (asegura `agent_tool_logs`
  + crea/siembra `gatwick_alerta_destinos`).
- **Guías n8n:** `referencia/n8n/gatwick-sms-alerta-guia.md` y `gatwick-generar-llamada-guia.md`
  (+ sus `*-subflow.json`).

### Gatwick — Línea telefónica de emergencias (Retell AI)

Agente de voz **GATWICK ELEVADORES IA** (Retell, conversation flow). Atiende solo
**emergencias** (persona/vehículo/mascota atrapada); lo demás lo transfiere a la mesa de
servicio. Al confirmar la emergencia hace **lo mismo que el flujo de WhatsApp**: crea la
emergencia en el monitor y avisa a los supervisores.

| Tool en Retell | Endpoint | api_key | Qué hace |
|---|---|---|---|
| `buscar_contexto_gatwick` | `GET /api/retell/gatwick-llamada` | `retell-gatwick-2026` | ¿Este número ya llamó en las últimas 24 h? |
| `consultar_ascensor` | `POST /api/retell/gatwick-ascensor` | `retell-gatwick-2026` | Código del sticker → edificio/dirección/distrito. `tool_name='Consultar Ascensor'` |
| `registrar_emergencia` | `POST /api/retell/gatwick-emergencia` | `retell-gatwick-2026` | Crea la emergencia + avisa supervisores. `tool_name='Emergencia por Llamada'` |
| `guardar_llamada_gatwick` | `POST /api/retell/gatwick-llamada` | `retell-gatwick-2026` | Guarda transcripción (también vía webhook post-call) |
| *(inbound webhook)* | `POST /api/retell/gatwick-inbound` | `retell-gatwick-2026` | Inyecta `{{ya_llamo}}`, `{{resumen_previo}}`… antes del saludo |

- **`consultar_ascensor` sustituye a la Knowledge Base.** El global prompt dice "consulta el
  catálogo interno", pero `knowledge_base_ids` está vacío: sin esta tool el bot no puede
  resolver el código. Normaliza lo que entrega el STT (`ap 1`, `AP0017`, `A P cero cero uno siete`
  → `AP-0017`) y exige **coincidencia exacta** — `AP-0017` y `AP-0117` son equipos distintos.
- **`registrar_emergencia` NO inicia el seguimiento GPS.** Crea la emergencia en estado
  `pendiente`; el tracking arranca cuando el técnico toca "Comenzar" en el monitor, que es
  cuando realmente sale. El monitor la ve aparecer sola (escucha `postgres_changes`).
- **Deduplica por `call_id`** (ventana de 60 min): si el bot llama dos veces a la tool en la
  misma llamada no se crean dos emergencias.
- **Nunca devuelven error HTTP** (salvo 401): un 500 haría que Retell corte la llamada. Ante
  fallo responden `ok:false` + una frase para que el bot la lea, y queda en los logs.
- `gatwick_edificios` es la **fuente de verdad**: sus datos pisan lo que dictó el cliente. Si el
  código no está en el catálogo, se usa lo dictado y el aviso lo marca con ⚠️.
- **Migración SQL:** correr una vez `sql/gatwick_retell_emergencia.sql` (crea
  `retell_llamadas_GATWICK`, que nunca se había creado por SQL, + columnas de trazabilidad
  `origen`, `call_id`, `telefono_origen`, `contacto_nombre`, `tipo_atrapado`,
  `cantidad_atrapados`, `critico` en `gatwick_emergencias`).
- **Guía de configuración manual en Retell:** `referencia/retell/gatwick-emergencia-guia.md`.

---

### Trade Cars — Funnel de Compras (reemplazo del Power BI)

Implementa la minuta del **26/08/2026**. Trade Cars llevaba el funnel en Power BI
alimentado a mano desde un Excel por asesor; ahora el asesor llena los campos en el
CRM y el dashboard calcula el embudo en vivo.

**Tres módulos** (sección "Funnel de Ventas" del sidebar):

| Módulo | Componente | Qué hace |
|---|---|---|
| Funnel de Compras | `components/TradeCars/FunnelCompras.vue` | Embudo de 7 barras acumulativas + % de conversión |
| Tabla de Leads | `components/TradeCars/TablaLeadsFunnel.vue` | Detalle con etapa/fecha calculadas, export y link al CRM |
| Análisis de Conversión | `components/TradeCars/AnalisisConversion.vue` | Motivos de no cita, ventas probables y seguimientos vencidos |
| Procedencia y Costos | `components/TradeCars/ProcedenciaCostos.vue` | Leads/compras por campaña, marca-modelo y zona + costo por lead e inversión por compra |

**La lógica vive en UN solo lugar:** `utils/tradecarsFunnel.ts` (auto-import). Los cuatro
módulos la comparten, así que el embudo y la tabla nunca pueden contradecirse.
La **misma lógica está replicada en columnas `GENERATED` de Postgres** — si se cambia
una hay que cambiar la otra (está avisado en ambos archivos).

**Reglas que no son obvias:**

- **El embudo es ACUMULATIVO**, no un conteo por etapa: cada barra cuenta los leads que
  alcanzaron esa etapa **o una superior**. Un lead `CONCRETADA` suma en las 7 barras.
  Implementado con `etapa_rank` (0–6): la barra N cuenta `rank >= N`.
- **El % de cada barra es contra la barra ANTERIOR**, no contra el total de leads.
- **`FECHA DEL FUNNEL`** = `fecha_compra` > **la más reciente entre `fecha_cita_asistida` y
  `fecha_cita`** > `fecha_derivacion`. Un lead que entró en mayo y compró en agosto
  **aparece en agosto**. En el Excel actual CITA y CITA ASISTIDA comparten una sola columna
  de fecha; el CRM las separa (lo pidió el cliente) y la §4 de su especificación técnica
  manda usar la del evento más reciente. Validado contra las 8.515 filas de su base real:
  la cascada coincide con su columna `FECHA` calculada en el 100% de los casos.
- **`PERFIL COINCIDE = NO`** → el lead se queda en `LEADS` sin importar el status.
- **`PERFIL = SI` con STATUS vacío** → queda **fuera de TODAS las barras** (`rank = -1`),
  no sólo de las superiores. Se muestra como aviso ámbar en el módulo 1.
- **STATUS fuera de la lista cerrada** → NO se ignora: se guarda, se marca en rojo en la
  tabla y sale una alerta en el embudo. El endpoint devuelve `ok:false` + `status_invalido`
  pero **200**, para que el CRM no reintente en bucle.
- **Anti-regresión:** un lead que ya llegó a `CITA`/`CITA ASISTIDA`/`CONCRETADA` no puede
  bajar de etapa. Se aplica con un **trigger en la BD**, no sólo en la UI, para que también
  proteja los updates que entren por el endpoint o por n8n.
- Los 6 valores de STATUS son **cerrados**: `NO CONTACTADO`, `NO INTERESADO`,
  `EN SEGUIMIENTO`, `CITA`, `CITA ASISTIDA`, `CONCRETADA`.
- **La ZONA no se escribe: se deduce del distrito** contra `tradecars_zonificacion`
  (trigger `tradecars_funnel_autocompletar`, no sólo la UI, para que valga también
  vía endpoint y migración). En su Excel ese VLOOKUP fallaba el **31%** de las veces
  —el asesor escribe "SURCO" y la hoja dice "Santiago de Surco"—; el catálogo guarda
  también los alias reales y resuelve el **96,7%**. Hay tres intentos: exacto, prefijo
  (`SURCO CHACARILLA`) y sin espacios ni puntuación (`SANMIGUEL`, `S.M.P`).
- **La PRIORIDAD de marca (1/2/3) tampoco se escribe**: sale de `tradecars_marcas`.
  En las 8.515 filas de su base no hay una sola marca con dos prioridades distintas,
  así que es función estricta de la marca. Resuelve el 99,2% de los nombres y el
  95,1% con prioridad (su Excel: 79%). Las marcas que Trade Cars nunca clasificó
  entran con `prioridad = NULL`, no con un número inventado.
- **`fetchFunnel()` pagina de a 1.000 y desempata el ORDER BY con `id`.** Supabase corta
  en 1.000 y el histórico son 8.737 filas: sin el bucle el embudo mostraría un octavo de
  los leads sin dar error. Y como la migración escribió por lotes, las 8.737 filas comparten
  **20 valores de `created_at`**: ordenar sólo por ahí no es un orden total y el paginado
  repetía 334 filas mientras otras no salían nunca (el embudo daba 230 compras donde la
  base tiene 229). **Cualquier paginado por `.range()` necesita una clave de orden única.**

**Endpoint del CRM:**

| Método | Ruta | api_key |
|---|---|---|
| POST | `/api/tradecars/funnel-lead` | `tradecars-funnel-2026` |

Hace UPSERT por `chatwoot_conversation_id` (si el CRM reenvía el mismo webhook no duplica).
Acepta los nombres de campo del Power BI actual (`PERFIL COINCIDE`, `FECHA DE CITA`…)
además de snake_case. Log en `agent_tool_logs` → Dev · Agent Logs → Trade Cars → `Funnel Lead`.

**Tablas nuevas** (migración: correr una vez `sql/tradecars_funnel.sql`):

| Tabla | Propósito |
|---|---|
| `tradecars_funnel_leads` | Tabla central. Incluye `etapa`, `etapa_rank` y `fecha_funnel` como columnas `GENERATED STORED` |
| `tradecars_asesores` | Catálogo de asesores (filtro del funnel), editable sin redeploy |
| `tradecars_funnel_motivos` | Catálogo de MOTIVO DE NO CITA — tabla y no enum porque la minuta lo dejó "a definir". Sembrado con los 5 motivos **reales** contados sobre su base (Precio 78%, No recibimos el modelo 15%, Ya lo vendió 5%, Deuda mayor 1%, No responde) |
| `tradecars_funnel_resumen` | Vista con las barras ya agregadas por mes/asesor/canal (útil para validar contra el Power BI durante la transición) |
| `tradecars_zonificacion` | Distrito → zona (Z1/Z2/Z3/NO PERTENECE) + alias de cómo lo escribe el asesor. 178 filas sembradas desde la hoja «Zonificación» y de contar la columna DISTRITO real |
| `tradecars_marcas` | Marca → prioridad 1/2/3 + typos. 123 filas sembradas contando su base |
| `tradecars_campana_costos` | Inversión publicitaria por mes y campaña. Alimenta costo por lead e inversión por compra (módulo 4). Equivale a las tablas COSTOS del .pbix, que hoy alguien pega a mano |
| `tradecars_procedencia` | Vista: leads/citas/compras por campaña, marca y modelo |

**Además del funnel, la tabla guarda los campos del Excel del asesor** (vehículo: placa,
marca, modelo, versión, año, km; negociación: propuesta inicial, monto mejorado,
expectativa; y campaña, distrito, zona, deuda/banco, último contacto, feedback). No entran
en el cálculo del embudo, pero si el CRM no los guardara el asesor seguiría abriendo el
Excel y no se reemplazaría nada — que es el objetivo de la minuta.

**Ojo con un supuesto de su especificación:** dice que el Power BI puede deducir el perfil
mirando sólo si STATUS está vacío, porque "100% de los perfil NO tienen STATUS vacío". En
su base real **no se cumple**: hay 23 filas con perfil NO y status lleno, y 4 con perfil SI
sin status. Por eso la etapa se calcula con **ambas** columnas explícitamente, como su
propia especificación recomienda.

**Separada de `GeneralBDwppTRADECARS` a propósito:** aquella guarda el lead crudo que
llega del bot; `tradecars_funnel_leads` guarda el trabajo comercial del asesor sobre ese
lead. Se enlazan por `lead_origen_tabla` + `lead_origen_id`.

**Migración del histórico: YA CORRIDA** (26/08/2026). `scripts/migrar_tradecars_historico.py`
subió las **8.737 filas** del Excel del asesor (8.512 de `BASE LEADS`, 28 meses entre 2024-01 y
2026-07, más 225 de `HISTORICO`). El embudo resultante —**8.732 / 7.036 / 4.903 / 333 / 325 /
269 / 229**— se validó recalculándolo aparte desde el Excel: coincide exacto.
El script descarta valores corruptos de su base (un kilometraje de 9.500.095.000 que no entra
en un `integer` y una fecha `0202-17-04`); sin eso Postgres tumbaba el lote entero de 400 filas. Corre primero en dry-run y sólo escribe con `--escribir`; es idempotente
gracias a `import_key`. Descarta las filas sin contacto o sin ninguna fecha y lo informa.
No calcula etapa ni zona: eso lo hacen las columnas GENERATED y el trigger.

```bash
python scripts/migrar_tradecars_historico.py            # dry-run
python scripts/migrar_tradecars_historico.py --escribir # sube
```

**El Excel no tiene columna de canal** (el CRM sí): en la migración se deduce sólo cuando la
campaña lo dice sin ambigüedad (TIK TOK, TRAFICO WTP, WEB…) — el 26% de las filas. En el
resto queda vacío antes que inventarlo.

**Guía para conectar el CRM:** `referencia/n8n/tradecars-funnel-guia.md` + el workflow
importable `tradecars-funnel-workflow.json` (webhook Chatwoot → n8n → endpoint). El Code
node traduce `Channel::Whatsapp` → `WhatsApp`, normaliza fechas epoch/ISO y **descarta los
eventos sin clasificar**: Chatwoot dispara `conversation_updated` en cada mensaje.

**Pendiente del cliente:** definir la lista real de MOTIVO DE NO CITA (hay 8 sembrados de ejemplo).
Los 4 asesores ya están cargados en `tradecars_asesores` y sus nombres coinciden con
los de Chatwoot (cuenta 17), que es lo que hace que el filtro cruce.

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
# Citas de Mañana (Herramientas Healup → n8n → WhatsApp). Reusa HEALUP_AGENDAMIENTO_CRON_KEY
N8N_WEBHOOK_HEALUP_CITAS_MANANA=          # URL del webhook n8n que recibe el resumen de citas del día siguiente
# Tool "Calendario FB/IG" (agendar citas de Instagram/Facebook). Todas opcionales — tienen default.
GOOGLE_SHEET_CITAS_HEALUP_ID=             # ID de la hoja "citas_healup" (default: 1C4qVEgymTANCne2xGQtwOi_ow4tDx1XvxIZ-pHOtCPE)
GOOGLE_SHEET_CITAS_HEALUP_RANGE=          # Pestaña de la hoja (default: "citas")
CHATWOOT_HEALUP_FBIG_TOKEN=               # api_access_token Chatwoot para avisar a la supervisora (default: el del subflow)
# Aviso interno "nueva cita agendada" Healup → Chatwoot (cuenta 2, conversación 1361). Opcionales.
CHATWOOT_HEALUP_CITAS_URL=                # default: https://chats.alef.company/api/v1/accounts/2/conversations/1361/messages
CHATWOOT_HEALUP_CITAS_TOKEN=              # default: reusa CHATWOOT_HEALUP_FBIG_TOKEN
# Aviso interno "nueva cita agendada" Davila (tool calendario_agendar) → Chatwoot (cuenta 3, conversación 5). Opcionales.
CHATWOOT_DAVILA_CITAS_URL=                # default: https://chats.alef.company/api/v1/accounts/3/conversations/5/messages
CHATWOOT_DAVILA_CITAS_TOKEN=              # default: reusa CHATWOOT_API_TOKEN (token multi-cuenta del remarketing)
# Gatwick — Tool "SMS Alerta Emergencia" (Telnyx).
TELNYX_API_KEY=                           # REQUERIDA — Bearer token de Telnyx (secreta, sin default)
TELNYX_MESSAGING_PROFILE_ID=              # opcional. default: 40019e3c-6053-4325-b86a-c7ca1d277e82
TELNYX_SMS_FROM=                          # remitente/sender ID (default: "Gatwick SMS")
GATWICK_SMS_DESTINO_FALLBACK=             # número(s) destino si gatwick_alerta_destinos está vacía (coma-separados, E.164)
# Gatwick — Tool "Generar Llamada" (Vonage Voice). APPLICATION_ID + PRIVATE_KEY son REQUERIDAS.
VONAGE_APPLICATION_ID=                     # UUID de la Vonage Application (Voice) — crear en dashboard.vonage.com
VONAGE_PRIVATE_KEY=                        # private key PEM de esa Application (los \n pueden ir escapados)
VONAGE_FROM_NUMBER=                        # (opcional) número origen Vonage (default: 12015471160)
VONAGE_ANSWER_URL=                         # (opcional) URL del NCCO (default: <dominio>/api/vonage/handle-call)
VONAGE_NCCO_TEXT=                          # (opcional) texto de la llamada (default: "Emergencia Gatwick. Revisa el WhatsApp")
GATWICK_LLAMADA_DESTINO_FALLBACK=          # número(s) destino si gatwick_alerta_destinos está vacía (coma-separados)
```

> **Tool "Calendario FB/IG"** (`POST /api/healup/calendario-fbig`, api_key `healup-calendario-fbig-2026`):
> versión Instagram/Facebook de la tool "Calendario" de WhatsApp. Reemplaza el subflow n8n
> "ACTIVO agendar heal up fb ig". Hace lo mismo que la de WhatsApp (GCal + `healup_calendar_events` +
> boleta gated + log en `agent_tool_logs` con `tool_name='Calendario FB/IG'`) y además, en vez de las
> tablas/canales de WhatsApp: upsert en `PacientesBDfbigHEALUP`, marca `pasar_supervisor='si'` en
> `pasar_supervisor_healup`, append a Google Sheets `citas_healup`, y avisa a la supervisora (LUCIA)
> vía Chatwoot (cuenta 2, conversación 700). El `numerotelefono` que llega es un PSID de Messenger/IG,
> no un teléfono real (se guarda tal cual). **Requiere re-autorizar Google** (GCal Sync → "Renovar
> acceso Google") porque se agregó el scope `spreadsheets` para el append a la hoja.

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
| `healup_citas_manana_logs` | Logs del resumen diario de **citas del día siguiente** (dashboard + Google Calendar, deduplicado) enviado a n8n. Campos: `fecha_objetivo`, `origen`, `triggered_by_email`, `status`, `citas_count`, `citas_dashboard_count`, `citas_gcal_count`, `duplicados_fusionados`, `webhook_url`, `payload_enviado` (JSONB), `respuesta_n8n` (JSONB), `http_status`, `error_message`, `duracion_ms`. Migración: `sql/healup_citas_manana_logs.sql` |

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

---

## Piola — Dashboard / CRM (`pages/pruebas/Piola.vue`)

Agencia de marketing peruana (video, piezas gráficas, branding, fotografía, eventos).
A diferencia del resto de dashboards, **no es un tablero de leads sino un ERP ligero**:
CRM + contabilidad + facturación + producción + RR. HH.

- **company_id en BD:** `piola`
- **Permiso:** `canAccessPiola` en `utils/permissions.ts`
- **Migración SQL:** correr una vez `sql/piola_tables.sql`
- **Moneda única:** PEN. **Zona horaria:** America/Lima. **UI:** español.

### Roles y permisos — distinto al resto del proyecto

Los demás dashboards usan los roles globales (`superadmin`/`admin`/`agente`). Piola agrega
**roles propios por módulo**, editables desde la UI:

- `piola_roles` + `piola_role_permissions` (módulo × ver/crear/editar/eliminar)
- `piola_colaboradores` — ficha del colaborador (rol, contrato, antigüedad, AFP, % comisión).
  El **login sigue en `dashboardlogin`**; se enlazan por email.
- Módulos: `home`, `mi_espacio`, `crm`, `contabilidad`, `facturacion`, `produccion`, `rrhh`,
  `reportes`, `configuracion`. `home` y `mi_espacio` los ve todo el mundo.
- Superadmin de Alef y admins sin ficha entran como Administrador de Piola.
- `piolaCan(permisos, modulo, accion)` en `utils/permissions.ts` arma el menú (solo cosmético);
  `exigirModulo()` / `exigirAdmin()` en `server/utils/piola.ts` son los que realmente protegen.

### Componentes

| Componente | Módulo |
|---|---|
| `Piola/PiolaHome.vue` | KPIs + widgets personales (vacaciones, antigüedad, contrato) |
| `Piola/PiolaMiEspacio.vue` | Marcación de jornada/breaks, historial, vacaciones y boletas propias |
| `Piola/PiolaCRM.vue` | Kanban + tabla de leads, historial de interacciones, conversión a cliente |
| `Piola/PiolaContabilidad.vue` | Ingresos/egresos, flujo de caja, **CRUD de categorías jerárquicas**, comisiones |
| `Piola/PiolaFacturacion.vue` | Emisión con detracción, histórico, cobro → flujo de caja |
| `Piola/PiolaProduccion.vue` | Entregables por marca, aprobación de Dirección, cumplimiento mensual |
| `Piola/PiolaRRHH.vue` | Tareo en vivo, reporte mensual, vacaciones, boletas y AFP |
| `Piola/PiolaReportes.vue` | Reportes programados + configuración de alertas |
| `Piola/PiolaConfiguracion.vue` | Colaboradores, roles/permisos, etapas del CRM, métodos de pago |

Helpers compartidos: `composables/usePiola.ts` (formatos PEN, fechas Lima, aplanado de categorías).

### Endpoints

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/piola/perfil` | Permisos por módulo + widgets del colaborador |
| POST | `/api/piola/tareo` | Marcación. `{ accion: check_in\|break_start\|break_end\|check_out }`. **Timestamp del servidor** |
| GET | `/api/piola/tareo` | `?vista=mi\|tablero\|mes` |
| POST | `/api/piola/tareo-correccion` | Corrección manual (RR.HH./Admin) → auditada en `piola_attendance_audit` |
| GET/POST | `/api/piola/vacaciones` | Saldos + solicitar/aprobar/rechazar/ajustar |
| GET/POST | `/api/piola/boletas` | **Solo Administrador** (o `?vista=mias` para las propias) |
| GET/POST | `/api/piola/afp` | **Solo Administrador** |
| GET/POST | `/api/piola/comisiones` | Contabilidad/Admin; un colaborador solo ve las suyas |
| POST | `/api/piola/factura` | Emitir / marcar pagada / anular / enviar |
| GET | `/api/piola/alertas` | `?run=1` corre el motor; `?api_key=` para el cron |
| GET | `/api/piola/reportes` | `?run=1` ejecuta; `?preview=1&tipo=` vista previa |

### Reglas que NO son obvias

- **El tareo usa la hora del servidor**, nunca la del cliente (§7.1 de la spec): si el navegador
  mandara horas, cualquiera maquillaría su jornada. `tareo-correccion` recibe `HH:MM` hora Lima
  y convierte a UTC (Lima es UTC-5 todo el año).
- **Vacaciones: 15 días/año = 1.25 por mes, solo `tipo_contrato='planilla'`.** Los de recibo por
  honorarios no devengan. El saldo se calcula siempre al vuelo desde `fecha_ingreso`; no se guarda.
- **`piola_payslips`, `piola_afp_reports` y `piola_commissions` NO tienen policy para `anon`**
  (a diferencia del resto del proyecto). Solo se leen por endpoint con verificación de rol.
- **Detracción activada por defecto** al facturar: el ~98 % de las facturas de Piola la llevan.
  Marcar pagada crea el ingreso por el **neto** (total − detracción), no por el total.
- **Categorías de gasto jerárquicas** (`parent_id` auto-referencial, n niveles) con CRUD en la UI:
  requisito explícito del cliente para no depender de desarrollo por cada gasto nuevo.
- **Días de anticipación de alertas parametrizables** en `piola_alert_settings` (7 es solo el seed).
- **Syscon no se reemplaza**: la contabilidad formal/tributaria sigue ahí; aquí va el flujo de caja.
- **Documentos en HTML, no PDF**: el proyecto no tiene librería de PDF. Boletas, AFP y facturas se
  generan como HTML con branding, se suben al bucket `piola-docs` y se imprimen a PDF desde el
  navegador. Por correo viajan como HTML.

### Crons (Netlify Scheduled Functions)

| Función | Horario | Qué hace |
|---|---|---|
| `netlify/functions/cron-piola-alertas.mts` | `0 13 * * *` (08:00 Lima) | Facturas/contratos por vencer, leads sin seguimiento… → WhatsApp |
| `netlify/functions/cron-piola-reportes.mts` | `0 14 * * *` (09:00 Lima) | Ejecuta los reportes que tocan según su frecuencia |

### Variables de entorno

```
PIOLA_CRON_KEY=                  # clave compartida entre las Scheduled Functions y los endpoints
N8N_WEBHOOK_PIOLA_ALERTAS=       # webhook n8n que reenvía las alertas por WhatsApp
RESEND_FROM_PIOLA=               # remitente de boletas/facturas/reportes (default: Piola <no-reply@alef.company>)
PIOLA_PSE_URL=                   # endpoint PSE.PE de Piola (mientras no exista, las facturas quedan en borrador)
PIOLA_PSE_TOKEN=                 # JWT de esa empresa en PSE.PE
PIOLA_RAZON_SOCIAL=              # branding de los documentos
PIOLA_RUC=
PIOLA_DIRECCION=
PIOLA_LOGO_URL=
PIOLA_COLOR=                     # default #111111
PIOLA_COLOR_ACENTO=              # default #e2564a
PIOLA_CUENTA_DETRACCION=         # cuenta del Banco de la Nación, se imprime en la factura
```

### Pendientes del cliente (bloquean cierre, no desarrollo)

**Cuenta de Chatwoot:** la sección "Chats" del sidebar lee `remarketing_config.chatwoot_account_id`
para `company_id='piola'`. Mientras esa fila no exista, el enlace lleva al selector de cuentas de
Chatwoot en vez de a un inbox equivocado. Al asignarle cuenta a Piola, insertar la fila y listo.

Lista de gastos operativos con su jerarquía · fórmula exacta de comisiones de Héctor ·
modelos reales de boleta y formato AFP · lista de usuarios (nombre + correo + rol) ·
catálogo completo de servicios · antigüedad de cada colaborador · reunión con José
(Traffic Manager) para conectar Meta Ads / WhatsApp / Instagram.

Todo lo que dependía de esos datos quedó **parametrizable**, no hardcodeado: tasas de planilla
en `TASAS` (`server/utils/piola-planilla.ts`), comisión en `calcularComision()`
(`server/utils/piola.ts`), y catálogos como tablas editables desde la UI.

**Fuera de alcance v1:** TikTok Ads, multi-moneda, reemplazar Syscon, Dropbox, múltiples cuentas
publicitarias. La tabla `piola_meta_metrics` está creada esperando la conexión con Meta.
