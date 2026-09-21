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
| `HealupFidelizacionConfig.vue` | — | Pestaña "Configuracion del programa" dentro de Fidelizacion. El cliente edita: puntos por visita y por sol, **escalera de niveles** (nombre + umbral, hasta 8; el primero siempre arranca en 0), descripcion de la tarjeta, 3 colores y **subida del logo** que va dentro del pase. Incluye **previsualizacion** del pase, aviso de contraste bajo y simulacion de cuanto suma una atencion. Los niveles ya NO estan escritos a mano en el codigo de la plataforma |
| `HealupFidelizacion.vue` | `empresaNombre` | Tarjetas de fidelizacion (Apple/Google Wallet). Metricas, **busqueda por DNI/nombre/correo/telefono sobre todo el padron** (resuelta en la plataforma con indices de trigramas, no en memoria), ficha del socio con saldo + movimientos + quien los cargo, edicion de DNI, alta con emision de tarjeta y suma de puntos con tope y atribucion. Habla con la **Alef Loyalty Platform** (VPS 2) via `server/api/healup/fidelizacion*`. Menu: MARKETING → Fidelizacion |
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
| PUT | `/api/users/password` | Cambia la contraseña de otro usuario. superadmin, o en Piola solo los correos de `piola_modulo_acceso` (grupo `contrasenas`: Raysa y Edson). Body: `{ id, password, tu_password }`; exige la contraseña propia. Actualiza `dashboardlogin` **y** Supabase Auth |
| GET | `/api/users/password` | `{ puede: boolean }` para mostrar u ocultar el bloque "Cambiar contraseña" |
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
| Tasador IA | `components/TradeCars/TasadorChat.vue` | Chat de texto conectado a ChatGPT para ayudar a tasar autos. Responde primero con las tablas propias de Trade Cars (compras/ventas históricas, negociaciones del funnel, stock, solicitudes de venta web); sólo si no hay dato interno recurre a conocimiento general del mercado, aclarándolo |

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
- **`PERFIL = SI` con STATUS vacío** → cuenta como **CUMPLE POLITICA** (rank 1) y ahí se queda hasta
  que el asesor le ponga un estado (desde el 18/09/2026; antes quedaba fuera de TODAS las barras con
  `rank = -1`, que ya no existe). Se muestra como aviso ámbar en el módulo 1.
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
node traduce el canal por `inbox_id`, normaliza fechas epoch/ISO y **descarta los eventos
sin clasificar**: Chatwoot dispara `conversation_updated` en cada mensaje.

**Chatwoot usa DOS custom attributes desde el 18/09/2026 — `coincide` y `estado` — y el flujo
n8n los traduce al `perfil_coincide` + `status` que entiende el endpoint.** (El esquema de un solo
dropdown `estado` con 7 etapas, del 14/09, quedó reemplazado: ver "Reunión de alineación del
18/09/2026" más abajo. Se mantiene la lectura de ese formato viejo como compatibilidad para
conversaciones que todavía lo traen.)

**La campaña ES el canal de origen — no hay (ni hace falta) un custom attribute `campana`
en Chatwoot.** Decisión del cliente (14/09): el nodo deriva `campana` del mismo `inbox_id`
que usa para `canal`, con una única excepción a propósito — el inbox 83 es `canal="Facebook"`
(mismo criterio que el resto del proyecto para el filtro de canal) pero `campana="Messenger"`
(así lo quiere ver el cliente en este reporte puntual). `"WEB"` queda reservado como quinto
valor para cuando se conecte el formulario de la web (`server/api/tradecars/formulario.ts`)
a este mismo campo — hoy ese endpoint escribe en `tradecars_solicitudes_venta`/`compra`, una
tabla aparte, y no toca `tradecars_funnel_leads.campana` en absoluto.

> ⚠️ **BUG REAL encontrado y corregido el 14/09/2026 en el nodo "Armar payload":
> nunca leyó el payload real de Chatwoot.** El Webhook de n8n siempre entrega
> `{ headers, params, query, body, webhookUrl, executionMode }` — el POST real
> vive en `item.json.body`, nunca al nivel raíz de `item.json`. El Code node
> (desde el 26/08, sin tocar esto hasta ahora) leía directo de `item.json` y
> por eso **cada ejecución mandaba el payload completamente vacío**
> (`conversation_id: null`, todos los strings `""`, `_enviar:false`), sin
> ningún error visible en n8n — se veía "verde" igual. Se descubrió el 14/09
> cuando el cliente probó en vivo poniendo `estado="lead"` a un contacto real y
> el nodo salió en blanco pese a que el nodo **Webhook Chatwoot** sí mostraba
> el payload correcto. Fix: `const c = raw.body ?? raw;` como primera línea
> del loop, antes del ya existente `conv = c.conversation || c`. De paso se
> agregó un fallback para `account_id` (`conv.messages?.[0]?.account_id`),
> porque el payload real de Chatwoot no lo trae al nivel de la conversación,
> sólo dentro de `messages[0]`. Verificado contra el payload real pineado por
> el cliente (conversación 1858, inbox 83, `estado="interesado"`): con el fix
> resuelve `canal="Facebook"`, `campana="Messenger"`, `perfil_coincide="SI"`,
> `status="EN SEGUIMIENTO"`, `account_id=17`, `_enviar=true`. **Cualquier
> workflow ya importado en n8n antes de esta fecha sigue con el bug** hasta
> que alguien reemplace el código del nodo "Armar payload" a mano o reimporte
> el JSON — ver el aviso al inicio de `tradecars-funnel-guia.md`. Mis propios
> tests anteriores (`run_code_node.mjs` etc.) no lo detectaron porque mockeaban
> `item.json` ya "desenvuelto" (plano, sin el sobre `{headers,body,...}` de
> n8n) en vez de simular un Webhook real — lección para cualquier test futuro
> de un Code node detrás de un Webhook trigger.

**Pendiente del cliente:** definir la lista real de MOTIVO DE NO CITA (hay 8 sembrados de ejemplo).
Los 4 asesores ya están cargados en `tradecars_asesores` y sus nombres coinciden con
los de Chatwoot (cuenta 17), que es lo que hace que el filtro cruce.

---

### Reunión de alineación del 18/09/2026 — lo acordado (migración `sql/tradecars_funnel_v2_crm.sql`)

Participaron Jean Marcos Silvera (Trade Cars), Roberto y Marcelo (Alef). **Correr una vez
`sql/tradecars_funnel_v2_crm.sql`** (idempotente, va DESPUÉS de `sql/tradecars_funnel.sql`).

**1. El embudo se arma en cascada con DOS campos del CRM.** En Chatwoot (cuenta 17):
`coincide` (✓ / x) y `estado` (No contactado · No interesado · En seguimiento · Cita · Cita asistida ·
Concretado). Reglas (`utils/tradecarsFunnel.ts` + función SQL `tc_rank()` — cambiar una es cambiar la otra):

| Barra | Condición |
|---|---|
| LEADS | todo lo que entra |
| CUMPLE POLITICA | Coincide ✓ (con cualquier estado **o sin estado**) |
| CONTACTADO | ✓ + estado ≠ No contactado (incluye **No interesado**) |
| INTERESADOS | ✓ + En seguimiento, Cita, Cita asistida o Concretado (**No interesado NO cuenta**) |
| CITAS AGENDADAS | ✓ + Cita, Cita asistida o Concretado |
| CITAS ASISTIDAS | ✓ + Cita asistida o Concretado |
| COMPRAS | ✓ + Concretado |

- **Coincide es tri-estado:** ✓ (`SI`), x (`NO`) o **vacío = sin calificar** (ya NO se confunde con NO:
  antes todo lo que no era SI se guardaba como NO e inflaba la métrica).
- **Coincide = x bloquea el estado:** el lead se queda en LEADS y `status` se guarda vacío (n8n, endpoint y
  trigger de la BD lo hacen cumplir; en Chatwoot el dropdown lo bloquea el equipo de Trade Cars).
- **"Concretado" (Chatwoot) = `CONCRETADA` (dashboard):** se aceptan las dos. Dos valores del dropdown
  `estado` traen un **TAB escondido** delante (`"<TAB>No interesado"`, `"<TAB>En seguimiento"`): se limpia con trim.
- **`rank -1` ya no existe.** `tc_rank()` nunca devuelve -1; los 4 leads históricos con SI sin status ahora
  suman en CUMPLE POLITICA.
- **Interpretación a confirmar con el cliente:** "SI sin estado = CUMPLE POLITICA" sale de que la etiqueta
  `cumple_politica` de Chatwoot se pone con solo marcar ✓. Si prefieren que cuente como LEAD hasta que haya
  estado, se cambia en `tcEtapa()` y en `tc_rank()` (`ELSE 1` → `ELSE 0`).

**2. Etiquetas en Chatwoot (las pone el flujo n8n `hIchxzZehkdrjvLk`, no el dashboard).** `cumple_politica`
(verde) si Coincide = ✓ y `no_coincide` (rojo) si = x; se cambian solas si el asesor cambia de opinión y se
quitan si Coincide queda vacío. Las etiquetas de estado (`no_contactado`, `cita`…) las siguen poniendo las 17
automatizaciones de Chatwoot y **no se tocan**. Detalles que no son obvios:
- `POST /conversations/{id}/labels` **REEMPLAZA** la lista completa: el flujo lee la lista actual justo antes
  (no confía en la del webhook), cambia solo esas dos y **solo escribe si algo cambió** → así el webhook que
  dispara su propio POST llega, ve que ya está bien y termina (sin bucle).
- Las automatizaciones "QUITAR" de Chatwoot (`estado != X → remove_label`) reescriben la lista de etiquetas:
  si corren a la vez que el flujo pueden pisar una etiqueta, y el siguiente evento la repone (todo es
  "level-triggered"). Se vio en una prueba con una etiqueta de estado sin su atributo.
- El flujo ahora tiene 12 nodos: la rama del funnel (Ya clasificado? → Enviar al funnel) y la de etiquetas
  (¿Sincronizar? → Leer etiquetas actuales → Calcular etiquetas → ¿Cambian? → Actualizar etiquetas). El token de
  Chatwoot va inline en los nodos HTTP, como en los demás flujos del proyecto.
- **Solo se envían los datos que existen** (antes un atributo vacío viajaba como `null` y cada evento de
  Chatwoot pisaba las fechas de cita/compra y lo editado en el dashboard). El endpoint también descarta los
  `null` (salvo `status` y `perfil_coincide`, que pueden quedar vacíos a propósito).
- `fecha_derivacion` sale en **hora de Lima** (antes se cortaba el ISO en UTC: una conversación creada
  después de las 19:00 caía en el día siguiente y, a fin de mes, en el mes siguiente del embudo).
- **Al avanzar de etapa el endpoint estampa la fecha de hoy (Lima)** en `fecha_cita` / `fecha_cita_asistida` /
  `fecha_compra` si el lead no la tiene: Chatwoot no manda esas fechas y sin esto todo caía en el mes de su
  derivación.

**3. Métrica "Perfiles que no coinciden"** (`FunnelCompras.vue`): contador aparte (no es un embudo) con el total,
el % sobre los leads y su distribución **por día / semana / mes** (`tcResumenPerfiles`, `tcSerieNoCoinciden`).
Respeta los filtros de arriba. La "vista separada de chats No Coincide" se hace en Chatwoot filtrando por la
etiqueta `no_coincide`.

**4. Compra concretada → histórico de compras → inventario** (`server/utils/tradecars-compra-crm.ts`,
`inventario-ingresar.post.ts`):
1. El asesor marca Concretado → `funnel-lead` crea una fila en `tradecars_data_historico_compras` con
   `verificado = false`, `origen = 'crm'` y los datos del auto (placa, marca, modelo, versión, año, km) sacados
   del atributo **`informacion_del_auto`** de Chatwoot, del formulario web (por teléfono) y — solo si sigue
   faltando placa/marca/modelo y hay `OPENAI_API_KEY` + `CHATWOOT_API_TOKEN` — del chat leído con IA. Prioridad
   cuando se contradicen: texto del asesor/chat > campos del lead > formulario.
2. Es **idempotente** por `crm_lead_id` (índice único): el webhook dispara en cada mensaje.
3. En **Compras** aparece con el chip "Por verificar" y un aviso. Fabián (Administrador) revisa, completa y
   usa **"Ingresar a inventario"**: pasa los datos comerciales a `tradecars_vehiculos` (o vincula uno que ya
   existía con esa placa sin pisar lo escrito a mano). **NO es automático a propósito** (faltarían campos y
   habría que llenarlos dos veces). Solo Administrador, verificado en el servidor.
4. Sin la migración, ese endpoint y el histórico devuelven un 409 que dice qué archivo SQL correr.

**5. Inventario en dos vistas** (`pages/pruebas/TradeCars.vue`, vistas SQL `tradecars_inventario_admin` /
`tradecars_inventario_publico`): **Administrativa** (todo, con margen, % de margen y días en inventario) y
**Pública** (marca, modelo, versión, año, km, transmisión, combustible, color, precio; sin precio de compra,
margen, placa, propietario, deuda ni notas; solo disponibles/reservados). **Los campos son provisionales:**
Jean/Fabián todavía tienen que mandar las plantillas exactas de cada una.

**6. Fórmulas del Excel aplicadas a Compras y Ventas** (`utils/tradecarsFormulas.ts`, usado por el servidor y
por las fichas). Cada fórmula se validó fila por fila contra las 1.307 compras y 1.305 ventas de la base
(≥98,9 %). Al guardar, el servidor recalcula; en una **edición solo reescribe lo que la edición cambia**
(`tcSoloCambios`), para no pisar los pocos totales escritos a mano. Los campos calculados salen de solo lectura
con el icono fx. Los días para vencer SOAT/RTV y los días en inventario dependen de HOY(): se calculan al
mostrar y **no se guardan**. **Lo que NO se recalcula a propósito** (el Excel no sigue una sola fórmula y
aplicarla cambiaría números ya reportados): en Ventas `comision_de_venta`, `igv_venta`, `valor_venta`,
`revenue`, `margen_sin_igv*` y `costo_total_usd`; en Compras `costo_total_gastos_extras_real`. El `concat`
(placa-N, llave compra↔venta) solo se arma en filas nuevas. Ojo con un detalle del Excel que se replicó:
compara texto sin distinguir mayúsculas pero **sí acentos** ("CONSIGNACIÓN" ≠ "CONSIGNACION" en `notariales_2`).

**7. Renombre:** el módulo de ventas ahora dice "Ventas — Histórico" (decía "Compras y Ventas").

**Diferido / no definitivo** (no implementado, a propósito):
- Iniciar conversaciones de WhatsApp desde el dashboard: el equipo todavía lo está analizando.
- Formularios web: cruzar contra chats existentes, reparto equitativo entre los 4 asesores y mostrar
  "Asignado / Sin asignar" — Roberto lo hace en otro flujo n8n. Hoy `tradecars_solicitudes_venta` no tiene
  columna de asesor.
- Filtro administrativo de vehículos por placa (SUNARP/ATU/SAT): proyecto futuro, en investigación.

**Netlify:** para que la lectura del chat funcione hace falta `CHATWOOT_API_TOKEN` en las variables de entorno
(el módulo de remarketing usa un valor por defecto en el código si no está). Sin él, esa parte se salta y se
sigue con las demás fuentes.

### Tasador IA (chat de tasación) — `server/api/tradecars/tasador-chat.post.ts`

Módulo de nav propio ("Tasador"), no un widget flotante como `HealupAgent`. Reutiliza
`OPENAI_API_KEY` (la misma que Whisper y el OCR de SGS). Diseño clave: **todo el loop de
function calling corre en el servidor**, a diferencia de `HealupAgent` (que ejecuta los
tools en el cliente y hace ping-pong con el navegador). El componente Vue sólo manda
`{ messages: [{role, content}] }` en texto plano y recibe `{ reply, propuestas }` — nunca ve
`tool_calls` ni nombres de tabla, así que el bundle del navegador no expone el esquema
interno.

Hace **dos cosas distintas**: responde sobre el negocio (embudo, asesores, campañas, stock,
ventas) y **le enseña al Agente Tasador que atiende WhatsApp** — ver la sección siguiente.

**Prioridad de respuesta (pedido explícito del cliente):** primero las tablas propias de
Trade Cars, recién si no hay dato interno cae al conocimiento general del modelo — y el
system prompt le exige decirlo explícito cuando lo hace ("Trade Cars no tiene registros
propios de este modelo..."). No hay búsqueda real en internet (no hay una API de búsqueda
configurada en el proyecto): el "segundo con internet" que pidió el cliente se resuelve con
el conocimiento general de ChatGPT, no con navegación en vivo.

**Tools de lectura:**

| Tool | Qué consulta |
|---|---|
| `buscar_comparables_historicos` | `tradecars_data_historico_compras_ventas` — **los comparables reales que usa el Tasador de WhatsApp**. Es la fuente principal de cualquier tasación |
| `consultar_precio_vehiculo_nuevo` | `tradecars_data_precios_vehiculos_nuevos` — precio del 0km, que funciona como techo |
| `resumen_precio_referencia` | Cruza `tradecars_compras` (completadas) + `tradecars_funnel_leads` (negociaciones concretadas, `monto_mejorado`) y devuelve casos/mínimo/promedio/máximo |
| `resumen_funnel` | Las 7 barras del embudo con filtros de fecha/asesor/canal. Cuenta con `head:true` en la base, no trae filas |
| `metricas_por_asesor` | Compara asesores entre sí: leads, citas, compras, conversión y leads sin estado |
| `costos_campanas` | `tradecars_campana_costos` cruzado con el embudo: inversión, costo por lead e inversión por compra |
| `leads_sin_estado` | Leads con `etapa_rank < 0` — los que el asesor nunca marcó y quedan fuera del embudo |
| `buscar_vehiculos_stock` | `tradecars_vehiculos` — inventario actual |
| `buscar_ventas_historicas` | `tradecars_ventas` — detalle de ventas + margen calculado |
| `buscar_negociaciones_funnel` | `tradecars_funnel_leads` — propuesta inicial vs monto mejorado vs expectativa |
| `buscar_solicitudes_venta` | `tradecars_solicitudes_venta` — lo que pidió el dueño en el formulario web |

Historial de la conversación guardado en `localStorage` del navegador (`usePersistente`), no
en Supabase: es apoyo de trabajo del asesor. Lo que **sí** se audita en base es cada cambio de
configuración y cada ejecución del chat (`agent_tool_logs`, `tool_name='Tasador · Chat'`).

**Variable de entorno opcional:** `TRADECARS_TASADOR_MODEL` (default `gpt-4o`, mismo patrón
que `SGS_OCR_MODEL`).

---

### Enseñarle al Agente Tasador de WhatsApp — sistema de dos niveles

Implementa lo acordado en la reunión del **26/08/2026**: que Trade Cars pueda "educar" al
tasador sin poder romperlo.

**La clave arquitectónica:** el Agente Tasador vive en n8n (workflow
`TRADECARS | WHATSAPP | Agente Tasador`, id `iFeOCsDlZTxoWJmH`) pero **no tiene ni un número
hardcodeado**. Su prompt tiene una regla absoluta: *"NUNCA hardcodear parámetros — SIEMPRE
leerlos vía Tool 1 en cada tasación"*, y si esa tool falla devuelve
`{ sin_datos: true, error: "configuracion_no_disponible" }` en vez de inventar defaults. Esa
Tool 1 (`obtener_configuracion`, workflow `FNo6fnEj51kJm38i`) lee **tres tablas de Supabase**,
que son exactamente las que el dashboard edita. No hay copia paralela ni redeploy: lo que un
supervisor cambia entra en la siguiente tasación.

| Tabla | Qué guarda |
|---|---|
| `tradecars_config_parametros_tasador` | Los **24 parámetros** de tasación (`clave`/`valor`), con `unidad`, `categoria`, `descripcion` y las barandas `minimo`/`maximo` |
| `tradecars_config_reglas_marca_modelo` | Ajustes por marca/modelo: `tipo_ajuste` ∈ resta_usd / suma_usd / resta_pct / suma_pct / flag, con condiciones de año y GNV/GLP |
| `tradecars_config_modelos_alta_rotacion` | Modelos donde el Tasador no descuenta preventivamente y cotiza en el extremo alto |
| `tradecars_tasador_cambios` | Historial de todo cambio + las solicitudes derivadas a Alef |

**Nivel 1 — lo cambia Trade Cars solo:** valores de los 24 parámetros, reglas por marca/modelo
y alta rotación. El chat **propone** (tools `proponer_*`) y devuelve las propuestas en
`{ propuestas }`; la UI las muestra como tarjetas y **sólo al confirmar** se llama a
`POST /api/tradecars/tasador-config`, que valida contra `minimo`/`maximo` y deja auditoría.
**El chat nunca escribe configuración por su cuenta** — ese es el punto de todo el diseño.

**Nivel 2 — lo implementa Alef:** cambiar la lógica o el orden del cálculo, agregar una
pregunta al flujo de conversación, cambiar el formato de salida, o crear un parámetro que hoy
no existe. El chat lo deriva con `solicitar_cambio_a_alef` y queda en
`tradecars_tasador_cambios` con `estado='pendiente_alef'`, visible en la pestaña Historial.
Sólo un superadmin de Alef puede cerrarlo (`resolver_solicitud`).

**Reglas que NO son obvias:**

- **No se pueden crear claves de parámetro nuevas desde la UI.** El prompt lee un set fijo:
  una clave inventada no cambiaría nada en la tasación real, así que el endpoint la rechaza y
  sugiere una solicitud a Alef. Mismo criterio con los flags: el único que el prompt sabe
  interpretar es `usar_tasa_km_generica`.
- **Sólo `admin` y `superadmin` editan** (`puedeEditarTasador()` en `server/utils/tradecars.ts`).
  Un asesor puede conversar y consultar, pero no tocar los números con los que la empresa
  decide cuánto paga por un auto.
- **El endpoint GET expone un bloque `salud`** que avisa si el Tasador no está en condiciones
  de cotizar (sin parámetros, sin comparables o sin precios de 0km). Sin eso, el estado
  "configurado pero incapaz de tasar" sólo se descubre en una conversación con un cliente real.
- **`leerConfigTasador()` degrada a un set mínimo de columnas** si la migración todavía no se
  corrió: las tablas ya existían en la base sin las columnas de auditoría, y pedirlas devuelve
  400. Así el módulo abre igual y la UI puede avisar que falta correr el SQL.

**Migración:** correr una vez `sql/tradecars_tasador_config.sql` (idempotente). Los 24
parámetros, las 2 reglas y los 2 modelos de alta rotación **ya estaban cargados** por quien
armó el Tasador, así que los `INSERT` no hacen nada: los valores y descripciones de ellos
mandan. Lo que la migración sí aporta sobre esas filas es `minimo`/`maximo` —las barandas que
usa el endpoint para rechazar un valor absurdo—, las policies de `anon`, y las tablas de
historial e importaciones. **Los valores siguen pendientes de confirmación formal de Trade
Cars** vía el cuestionario de 32 preguntas, que sigue sin responderse.

> La migración usa la convención de auditoría que ya traían las tablas (`actualizado_en` /
> `actualizado_por`) y elimina el juego paralelo en inglés que una versión anterior de este
> mismo archivo había agregado. No volver a introducir `updated_at`/`updated_by` acá.

> ⚠️ **CUIDADO AL DIAGNOSTICAR: `SUPABASE_KEY` NO es la service_role.** En `.env` conviven
> `SUPABASE_KEY` (clave **publicable**, sujeta a RLS) y `SUPABASE_SERVICE_KEY` (JWT con
> `role=service_role`, que es la que usa `serverSupabaseServiceRole()` y sí ignora RLS).
>
> Las tablas del Tasador tienen RLS sin policy para `anon`, así que **leerlas con
> `SUPABASE_KEY` devuelve 0 filas sin ningún error**. El 11/09/2026 eso llevó a concluir que
> estaban vacías y que el agente no podía cotizar; con la service_role key aparecieron
> **1.305 comparables y 89 precios de 0km**. Antes de afirmar que una tabla de Trade Cars está
> vacía, verificar con `SUPABASE_SERVICE_KEY`.

---

### Carga del histórico por Excel / CSV / PDF — `server/api/tradecars/tasador-datos.post.ts`

Las dos tablas de datos del Tasador se llenan desde la pestaña **Datos** del módulo, sin scripts.

| Acción | Qué hace |
|---|---|
| `analizar` | Lee el archivo, propone el mapeo de columnas y devuelve una vista previa **ya convertida** |
| `importar` | Valida, convierte e inserta en lotes de 500, marcando cada fila con `import_batch_id` |
| `deshacer` | Borra sólo las filas de esa carga (`DELETE WHERE import_batch_id = …`) |
| `listar` | Últimas 30 importaciones |

**El modelo sólo ve los encabezados y 3 filas de muestra**, nunca las ~9.000 filas de datos: su
único trabajo es decidir "esta columna es el precio de venta". El traslado de los valores es
determinista, así que el modelo no puede inventar un precio. La excepción es el PDF, donde no
hay grilla que extraer de forma determinista: ahí sí se le pasa el texto y se le pide la tabla,
con instrucción explícita de poner `null` antes que inventar.

**Reglas que NO son obvias:**

- **El punto es ambiguo en esta base.** Conviven `120.000` (ciento veinte mil, formato peruano)
  y `11500.50` (formato inglés). La regla que los separa en `aNumero()` es la cantidad de
  dígitos detrás del separador: **exactamente tres es miles, cualquier otra cantidad es
  decimal**. Sin esa regla, un kilometraje de 120.000 entraba como 120 y un precio de 9.900
  como 9.9 — los dos casos se detectaron probando con un Excel de muestra, no en revisión.
- **La vista previa muestra los valores convertidos, no los crudos.** Es el único punto donde
  alguien puede notar a tiempo que una columna se mapeó mal o que una fecha quedó invertida.
- **Si un lote falla, se borra todo lo ya insertado de esa carga.** Una importación a medias es
  peor que ninguna: el Tasador cotizaría con datos parciales sin que nadie lo sepa.
- **Las fechas ambiguas se leen como dd/mm/yyyy**, que es el formato peruano.
- `.xls` antiguo (BIFF) no se lee: hay que guardarlo como `.xlsx`. Un PDF escaneado tampoco,
  porque no tiene capa de texto.
- **`exceljs` y `unpdf` se importan de forma estática, no dinámica.** Con `await import()` el
  loader ESM de Nitro en dev sobre Windows falla con *"Only URLs with a scheme in: file, data,
  and node are supported… Received protocol 'c:'"*. Ya pasó una vez; no volver a cambiarlo a
  import dinámico.

---

### Comparativo por asesor — `components/TradeCars/FunnelCompras.vue`

Pedido del cliente el 14/09/2026 para que el embudo se parezca al reporte que ya usaban en
Power BI: además del embudo agregado, una sección **"Comparativo por asesor"** con un
selector de asesor (chips) y, para el asesor activo, su propio embudo de 7 barras +
un desglose por campaña ("Campañas"). Reutiliza `tcConstruirFunnel()` sobre subconjuntos
de `leadsFiltrados` — nunca puede contradecir al embudo de arriba, y respeta los mismos
filtros de fecha/canal (el asesor lo elige aparte, con chips, no con el `<select>` de
arriba).

**El selector de asesor mezcla el catálogo con lo que hay realmente en los datos**
(`asesoresParaComparar` = `tradecars_asesores` ∪ `asesor` distintos de los leads), igual que
ya hacía `opcionesAsesor`. Esto expuso algo real: el histórico de 8.737 leads usa nombres
abreviados (`JOSE F.` con 7.227 leads, `LUIS A.` con 1.284, `LUIS C.` con 225) que **no
calzan** con los 4 nombres del catálogo (`tradecars_asesores`: Rodrigo Paredes, Jose Flores,
Brado Alvarado, Gino Hurtado) — no hay ningún "Luis" en el catálogo. Sin reconciliar, el
comparativo muestra 7 chips en vez de 4. Verificado contra la base real, no es un bug de este
código: es un dato de origen sin normalizar, pendiente de que el cliente decida cómo
mapearlo (¿"JOSE F." es el mismo "Jose Flores"? ¿A quién de los 4 se le asignan "LUIS A."
y "LUIS C."?).

**Las columnas de campaña son dinámicas, no fijas.** Se listan primero las 4 campañas
reales confirmadas el 14/09 (WhatsApp, Instagram, TikTok, Messenger, más "WEB" si algún día
tiene datos) que tenga ese asesor, y después cualquier otro valor de `campana` que aparezca
en sus leads — el histórico trae nombres de campaña del Excel viejo (`VENDE TU AUTO`,
`TIK TOK`, `LIMA REGULAR`, `NEOAUTO`…) que **no se fuerzan** a encajar en las 4 nuevas,
para no perder ese historial ni inventar una equivalencia que nadie confirmó.

---

### Roles y permisos por módulo — `sql/tradecars_roles.sql` (14/09/2026)

Mismo diseño que el de Piola (`piola_roles`/`piola_role_permissions`/`piola_colaboradores`),
para que **qué módulos ve cada quien en el menú** dependa de su rol en
`tradecars_colaboradores`, no del rol global de `dashboardlogin`. Tablas nuevas:
`tradecars_roles`, `tradecars_role_permissions` (7 módulos: `home`, `funnel`, `comercial`,
`operaciones`, `finanzas`, `tasador`, `configuracion`), `tradecars_colaboradores` (enlaza por
`email` con `dashboardlogin`, igual que Piola — **no** crea accesos ni contraseñas).

Sembrados 3 roles según los cargos reales que dio el cliente el 14/09: **Administrador**
(acceso total), **Jefe de Compras**, **Asesor de Compras**, con un checklist de permisos de
arranque razonable (editable desde la UI, no confirmado campo por campo con el cliente). Los
9 colaboradores reales quedaron enlazados a su rol por email.

**Diferencia real con Piola, para no prometer más de lo que esto hace:** en Piola TODA
escritura pasa por un endpoint de `server/api/piola/` que llama `exigirModulo()`, así que el
permiso se aplica dos veces (menú + servidor). Trade Cars sigue escribiendo la mayoría de sus
tablas operativas DIRECTO desde el navegador contra Supabase (RLS abierta a `anon`, como
estaba desde antes de este cambio) — no hay un endpoint de por medio que pueda volver a
verificar. Este sistema controla lo que se pidió explícitamente: **qué ve** cada quien en el
menú (`GET /api/tradecars/perfil` + `tradecarsCan()` en `utils/permissions.ts`). Lo que sí
pasa por un endpoint propio y sí exige Administrador en el servidor
(`exigirAdminTradeCars()`, `server/api/tradecars/configuracion.post.ts`) es la gestión de
roles y colaboradores en sí — crear un rol, marcar un permiso, dar de alta a alguien.

**Falla "abierto", nunca "cerrado".** `resolverPerfilTradeCars()` (`server/utils/tradecars.ts`)
trata cualquier error al consultar `tradecars_colaboradores` (por ejemplo, la migración
todavía no corrida) como "sistema de roles no configurado" y deja pasar como Administrador —
Trade Cars ya tenía gente trabajando con el menú completo antes de este cambio, y una
migración pendiente no puede dejarlos de golpe sin ver Funnel/Operaciones/Tasador. El
frontend (`pages/pruebas/TradeCars.vue`, `puedeVer()`) tiene el mismo criterio como segunda
red: sin `permisos` resuelto, se sigue viendo todo. Sólo se oculta un módulo cuando hay un
rol real que explícitamente no lo incluye.

---

### Módulo "Compras" = histórico real de operaciones (14/09/2026)

El tab **Operaciones → Compras** ya no muestra `tradecars_compras` (quedó casi sin uso, 0
filas) — ahora es un CRUD completo (ver/editar/añadir/eliminar) sobre
`tradecars_data_historico_compras_ventas`: la MISMA tabla que usa el Tasador IA como
comparables (`buscar_comparables_historicos`). No es una copia — es la tabla real, con las
~1.305 filas que ya traía (hoja "VENTAS" del Excel de operaciones de la empresa,
importada el 04/08/2026 en una sesión anterior). `tradecars_compras` sigue existiendo en la
base sin tocar — el Tasador todavía la consulta en `resumen_precio_referencia` — sólo dejó
de tener pantalla propia.

**Es el único módulo de TradeCars que pasa 100% por el servidor, ida y vuelta.**
`tradecars_data_historico_compras_ventas` es la única tabla de TradeCars **sin policy para
`anon`** (a propósito — evita exponer precios de compra al navegador sin pasar por el
servidor). Confirmado en vivo: leerla con `SUPABASE_KEY` devuelve **0 filas sin error**,
mismo aviso que ya existe para las tablas del Tasador. Por eso
`components/TradeCars/HistoricoComprasVentas.vue` no usa `client.from(...)` como el resto
de TradeCars — todo pasa por `GET/POST /api/tradecars/historico`, con
`serverSupabaseServiceRole()` + `exigirModuloTradeCars(perfil, 'operaciones', accion)`. Es
real enforcement de rol, no sólo cosmético como el resto del dashboard.

**La tabla tiene ~45 columnas y se muestran TODAS a propósito** (pedido explícito del
cliente) — sólo se excluyen las de auditoría/sincronización (`id`, `created_at`,
`sincronizado_en`, `actualizado_en/por`, `import_batch_id`, `sheet_row_id`,
`origen_ultimo_cambio`). La tabla scrollea horizontal dentro de su propio contenedor
(`.hcv-scroll`), nunca la página.

> ⚠️ **`origen_ultimo_cambio` tiene un CHECK constraint que no está en ningún `sql/*.sql`
> de este repo** (se creó directo en Supabase por quien armó el Tasador). Probado en vivo
> por fuerza bruta: acepta `NULL` (como las 1.305 filas existentes) y `'sheet'` (reservado
> para una futura sincronización con Google Sheets) — ningún otro valor probado pasó. Por
> eso `server/api/tradecars/historico.post.ts` **no** le escribe nada a esa columna en
> crear/actualizar: se deja como está en vez de adivinar un valor que rompa el insert. Si
> se necesita distinguir "esto lo editó alguien a mano desde el dashboard", hay que agregar
> el valor al constraint primero (`ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...
> CHECK (...)`), no inventarlo en el código.

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
# Fidelizacion — Alef Loyalty Platform (servicio aparte, VPS 2). SOLO servidor.
LOYALTY_BASE_URL=               # https://loyalty.alef.company
LOYALTY_EMAIL=                  # Usuario del dashboard de loyalty (define el negocio: su business_id sale del token)
LOYALTY_PASSWORD=               # Contrasena de ese usuario. Nunca exponer al navegador
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
- **Supabase — hay DOS keys y no son intercambiables:** `SUPABASE_KEY` es la clave
  **publicable** y está sujeta a RLS; `SUPABASE_SERVICE_KEY` es el JWT con `role=service_role`
  y es la que ignora RLS. `serverSupabaseServiceRole()` usa la segunda. Consultar una tabla con
  RLS usando `SUPABASE_KEY` devuelve **0 filas sin error**, que es indistinguible de una tabla
  vacía — ya causó un diagnóstico equivocado (ver el aviso en la sección del Tasador de Trade
  Cars). Para inspeccionar datos a mano, usar siempre `SUPABASE_SERVICE_KEY`.

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
- **Migración SQL:** correr una vez `sql/piola.sql` — **es el único archivo SQL de Piola**,
  idempotente, se puede correr las veces que haga falta
- **Documentación completa:** `PIOLA.md` en la raíz (qué crea el SQL, los endpoints,
  los guards de escritura y lo que queda pendiente)
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
| POST | `/api/piola/caja` | Abrir / movimiento / eliminar_movimiento / cerrar |
| POST | `/api/piola/pagos` | Registrar o eliminar un cobro/pago contra una cuenta |
| POST | `/api/piola/colaborador` | Ficha, contratos laborales y documentos del expediente |
| POST | `/api/piola/contabilidad` | Movimientos y categorías de gasto |
| POST | `/api/piola/configuracion` | Roles, permisos y catálogos (incl. la config financiera) |
| POST | `/api/piola/crm` | Leads, interacciones y conversión a cliente |
| POST | `/api/piola/produccion` | Entregables, marcas y catálogo de servicios |
| POST | `/api/piola/contratos` | Contratos de cliente y adendas |
| POST | `/api/piola/presupuestos` | Presupuesto vs. ejecutado |
| POST | `/api/piola/reportes` | Configuración de reportes programados y alertas |

### Reglas que NO son obvias

- **Ningún componente de Piola escribe a Supabase directamente.** Toda mutación pasa por
  `apiPiola('<endpoint>', { accion, ... })` (`composables/usePiola.ts`) contra un endpoint que
  llama a `exigirModulo()` / `exigirAdmin()` / `exigirAlguno()`. Escribir con
  `client.from('piola_…').insert()` desde un `.vue` saltea los permisos por módulo: la
  cerradura queda puesta y se entra por la ventana de al lado. Las **lecturas** sí siguen yendo
  directo con `client.from(...).select()`.
  El servidor además recalcula lo que el navegador no puede firmar: saldo del arqueo de caja,
  total de un movimiento (lee las tasas de `piola_impuestos`), saldo pendiente de una cuenta,
  resultado de un lead (de `es_ganado`/`es_perdido` de la etapa) y los campos de autoría
  (`registrado_por`, `created_by`, `aprobado_por`, `user_email`…).
- **Roles y permisos (`piola_roles`, `piola_role_permissions`) son solo de Administrador**, no
  de quien tenga `configuracion.edit`: si no, cualquiera con ese permiso se marca todos los
  módulos y queda como Administrador de hecho.
- **Un movimiento contable con pagos registrados no se puede eliminar.** La FK de
  `piola_pagos` es `ON DELETE CASCADE`: borrarlo se llevaba el historial de cobros en silencio.

- **Nunca usar `.limit(n)` con n > 1000 contra Supabase.** PostgREST corta en 1000 y no devuelve
  error: un `.limit(8000)` trae 1000 filas y el reporte sale incompleto en silencio. Para traer un
  conjunto completo, usar `traerTodo()` de `composables/usePiola.ts`, que pagina con `.range()`.
  Toda consulta paginada necesita un `.order()` **determinista** — sin orden estable, dos páginas
  pueden repetir una fila o saltarse otra.
- **La auditoría censura las remuneraciones.** `piola_auditoria` es legible por `anon`, así que el
  trigger reemplaza por `■■■` el valor de `sueldo_bruto`, `remuneracion`, `bonificaciones`,
  `comision_pct` y `afp_cuspp` antes de guardar. El nombre del campo sí queda en `campos`: se
  audita **que** se tocó el sueldo, no **cuánto**.
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
- **`piola_contratos.pago_mensual` es la cuota recurrente, `importe_pagado` es el acumulado
  histórico** — son cosas distintas y conviven. Salió de un Excel real de Piola ("Control de Pagos
  con Marcas y Contratos"): sus contratos son en realidad una cuota mensual por marca con un día de
  pago fijo, no el importe único que el módulo guardaba hasta el 28/08.
- **"Generar cobro del mes" en Contratos crea la fila en Cuentas por Cobrar**, no al revés — el
  contrato es la fuente de verdad de la cuota; el cobro del mes es una instancia de esa cuota. El
  índice único `(contrato_id, periodo_cobro)` es lo que impide duplicar el cobro de un mismo mes,
  no una validación de la pantalla.
- **El semáforo de renovación de contratos tiene 4 tramos**, no 3: VIGENTE (+60 días) / PRÓXIMA
  RENOVACIÓN (31-60) / RENOVAR AHORA (0-30) / VENCIDO. Son los mismos tramos que ya usaba Piola en
  su Excel — no es un valor inventado.
- **`piola_cuentas` es una VISTA con lista explícita de columnas**, no la tabla `piola_transactions`
  directa. Agregar una columna a `piola_transactions` (como `aprobado_por` o `contrato_id`) no la
  hace visible en Cuentas por Cobrar/Pagar hasta que también se agrega a esta vista — mismo error
  que ya pasó una vez con `fecha_funnel` en `tradecars_funnel.sql`.
- **La aprobación de un egreso (`aprobado_por`/`aprobado_at`) es independiente del `estado`.** Un
  egreso puede estar aprobado y seguir "pendiente" de pago, o pagarse sin haber pasado por
  aprobación si el flujo de la empresa no lo exige — no es un estado más del ciclo pendiente →
  parcial → pagado, que sigue siendo dueño exclusivo del trigger.
- **`piola_produccion_areas` tiene filas de DOS orígenes.** `guiones`/`produccion`/`edicion` +
  las 3 que agregó el 07/09 (`grabacion`/`presentacion`/`diseno_grafico`, las confirmadas por
  Sebastián) conviven con `rodajes`/`diseno`/`community`, un guess PRE-reunión que sembró la otra
  sesión y que la reunión corrigió — esas 3 quedaron sin tocar (no es nuestra tabla) y el dropdown
  de `PiolaProduccion.vue` las oculta filtrando por código, no por `activo`. Si alguien "limpia" la
  tabla borrando/renombrando esas filas, ese filtro por código deja de tener sentido y se puede
  simplificar a `activo=true` sin más.
- **`piola_tipos_contenido` usa `codigo`, no `clave`, como columna real.** Ya hubo un bug en
  producción por esto (07/09/2026): código escrito contra `clave` porque otra sesión corrió una
  migración distinta directo contra la base compartida. Antes de tocar esta tabla, confirmar el
  nombre de columna en vivo — no asumirlo por el código de otra rama.
- **Restricción de módulo por PERSONA, no por rol:** `piola_modulo_acceso` es una lista blanca
  aparte del sistema de roles. **Ojo:** la tabla NO la creó este trabajo — ya existía, creada por
  la otra sesión que reconcilia `feat/mobile-adaptation` contra esta misma base, con una fila
  `grupo='finanzas'` (candado de Contabilidad/Facturación del 31/08). Su forma real es
  `(grupo TEXT, modulos TEXT[], emails TEXT[], activo, descripcion, updated_by, updated_at)` — nada
  de `(modulo, email)` por fila, que fue lo que se asumió la primera vez sin verificar en vivo y
  rompió la migración (mismo tipo de error que el de `piola_tipos_contenido.clave`, dos líneas
  arriba). El código sólo aplica esto para `grupo IN ('crm')` (`GRUPOS_ACCESO_RECONOCIDOS` en
  `exigirModulo()`/`verificarSesionPiola()`, `server/utils/piola.ts`) — deliberadamente NO lee la
  fila `finanzas` de la otra sesión, para no activar en código un candado ajeno sobre datos que no
  sembramos nosotros. **La fila `finanzas` además tiene `administracion@piola.com`**, que no calza
  con el dominio real de Edson (`administracion@agenciapiola.com`, confirmado en `dashboardlogin`)
  — probable typo de la otra sesión, sin tocar porque no es nuestra fila. Un `grupo` sin fila
  reconocida no restringe a nadie; con fila, sólo esos `emails` entran a esos `modulos`
  (`piolaCan()` en `utils/permissions.ts` aplica lo mismo para el menú). Administrador de Piola /
  superadmin de Alef siempre pasa, igual que con los roles.

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
PIOLA_LOGO_URL=                  # https://dashboard.alef.company/piola-logo.png (archivo ya en public/, falta setear la var)
PIOLA_COLOR=                     # default #111111
PIOLA_COLOR_ACENTO=              # default #e2564a
PIOLA_CUENTA_DETRACCION=         # cuenta del Banco de la Nación, se imprime en la factura
```

### Reunión del 31/08/2026 — lo acordado (migración `sql/piola_reunion_31ago.sql`)

Participaron Edson Polo y Raysa Cucho (finanzas/gerencia), Héctor Córdova, Julio Zumaeta y
Sebastián Ávalos (director estratégico). **Correr una vez `sql/piola_reunion_31ago.sql`**, que es
idempotente y va DESPUÉS de `sql/piola.sql`.

| Qué pidieron | Dónde quedó |
|---|---|
| Visor de supervisor del tareo | Pestaña **Equipo** en `PiolaMiEspacio.vue`. El endpoint ya servía `?vista=tablero\|mes` y `?email=`, gateado por `rrhh.view`; sólo faltaba exponerlo |
| Adjuntar varios documentos a un movimiento (factura **+ constancia de detracción**) | Tabla `piola_adjuntos` (polimórfica) + `server/api/piola/adjuntos.post.ts` + `components/Piola/PiolaAdjuntos.vue` |
| Numeración propia del tipo de gasto (2 = combustible, 62 = Oana) | `piola_expense_categories.codigo` con índice único parcial. Se elige y se filtra por número en todo el módulo |
| Importar 30-40 movimientos pegando desde Excel | `importar_movimientos` / `deshacer_importacion` / `listar_importaciones` + `piola_import_batches`. Diálogo con previsualización en `PiolaContabilidad.vue` |
| Módulo de registro de clientes (contrato, condiciones, anexos, ficha RUC) | `PiolaClientes.vue` + `clientes.post.ts`. Nav: **Comercial → Clientes** |
| Al elegir el cliente en la factura, que se autocomplete todo | Desplegable + `buscar_por_ruc` contra `piola_clientes` |
| Alertas por WhatsApp en cada movimiento y cada cobro | `server/utils/piola-alertas.ts` → `dispararAlertaInmediata()`. Tipos `movimiento_registrado` y `cobro_registrado` en `piola_alert_settings` |
| Finanzas **solo** para Edson y Raysa | Se revocó `contabilidad`/`facturacion` del rol *Comercial / CRM*, que los tenía y contradecía el acuerdo |
| Desglosar el cumplimiento por tipo de contenido (7 videos + 7 piezas ≠ "14") | `piola_tipos_contenido` + `piola_compromisos` + vista `piola_cumplimiento_tipo` |
| Áreas, responsable por entregable y enlaces Dropbox/Drive/publicado | Columnas nuevas en `piola_deliverables` + filtros y vista "Por responsable" |
| Botón para repetir el mes sin rellenar todo | `clonar_periodo`, idempotente vía `piola_deliverables.origen_id` |
| Boletas de pago **y** recibos por honorarios con su voucher | `piola_payslips.tipo` (`planilla`/`honorarios`) + `rxh_numero`, `rxh_retencion` (4.ª cat., 8 %), `voucher_url` |
| Rol para Sebastián (aprueba entregables, cero finanzas) | Rol **Dirección Estratégica** |

**Lo que el cliente RECHAZÓ — no reimplementarlo:**

- **SUNAT**: Edson dijo *"eso no lo vamos a hacer, nosotros solo vamos a vaciar información aquí"*.
  El autocompletado por RUC es contra `piola_clientes`, **no** contra ninguna API externa.
- **Contrato adjunto en cada factura**: Raysa lo propuso, Edson lo rechazó (*"mucho trabajo
  operativo"*). El contrato vive en el módulo de clientes.
- **Numeración automática de facturas**: ya tienen serie y número avanzados. Es ingreso manual.
- **API de Dropbox**: quedó como *investigación* de Roberto, no como compromiso. Lo acordado y lo
  implementado es el **enlace fijo** a la carpeta.

**Ya existía y no había que tocarlo:** el pago recurrente de contratos que pidió Héctor
(`pago_mensual` + `dia_pago` + `generar_cobro`, con índice único `(contrato_id, periodo_cobro)` que
impide cobrar dos veces el mismo mes) y el método de pago por defecto en transferencia.

**Pendiente del cliente:** el diseño de la boleta de pago (quedaron en mandarlo). Hasta que llegue,
se usa la plantilla HTML que ya existía, adaptada para honorarios.

### Reunión del 07/09/2026 — lo acordado (migración `sql/piola_reunion_07sep.sql`)

Participaron Héctor Córdova, Edson Polo, Raysa Cucho y Sebastián Ávalos. **Correr una vez
`sql/piola_reunion_07sep.sql`**, que es idempotente y va DESPUÉS de `sql/piola_reunion_31ago.sql`.

| Qué pidieron | Dónde quedó |
|---|---|
| Saludo automático al primer mensaje de WhatsApp, para capturar el nombre | `piola_mensajes` (clave `bienvenida_whatsapp`, editable en **Configuración → Mensajes automáticos**). El disparo real vive en n8n/Chatwoot, fuera del dashboard — ver `referencia/n8n/piola-saludo-automatico-guia.md` |
| Comisión: 8 % lead cerrado / 4 % lead recomendado, fija | `piola_leads.tipo_comision` (se clasifica a mano al marcar el lead ganado — el bot no distingue el origen) + `comisiones.post.ts` reescrito para calcular los dos tramos y sumarlos en una sola fila por colaborador/periodo |
| Cliente: estado de detracción pagada + fechas de contrato | `piola_clientes.detraccion_pagada` / `detraccion_actualizada_at` / `fecha_inicio_contrato` / `fecha_fin_contrato` |
| Cliente: enlace fijo de Dropbox/Drive | `piola_clientes.dropbox_url` — solo el link, sin integración con la API |
| Cliente y contrato: hasta 5 documentos, no obligatorios | Tope de 5 en `adjuntos.post.ts` (`MAX_ADJUNTOS_POR_ENTIDAD`) para `entidad IN ('cliente','contrato')`. Contratos usa ahora también `PiolaAdjuntos.vue` |
| Etapas reales de producción (Sebastián): Guiones→Producción→Grabación→Edición→Presentación→Diseño Gráfico | `piola_produccion_areas` (YA EXISTÍA, creada por la otra sesión con un guess pre-reunión — se agregaron sólo las 3 filas que faltaban, ver nota abajo) + `piola_deliverables.area_produccion_id`. Distinta de `piola_areas`, que sigue siendo el área/departamento genérico |
| CRM restringido a Héctor, Edson y Raysa — nadie más lo ve en vivo | `piola_modulo_acceso` (lista blanca por persona, no por rol) + `exigirModulo()` en `server/utils/piola.ts` |

**Dos bugs de producción encontrados y corregidos de paso** (no pedidos en la reunión, pero
confirmados como errores activos al revisar el código para esta tarea, y el cliente pidió
explícitamente "que todo esté perfecto para producción sin ningún error"):

- `piola_tipos_contenido` vive en la base con la columna `codigo`; el código de
  `produccion.post.ts` y `PiolaProduccion.vue` seguía escrito contra `clave` (probablemente por
  una migración ajena corrida directo contra la base compartida) — el catálogo de tipos de
  contenido daba error 500 en cada alta/edición. Corregido en ambos archivos.
- La ficha de cliente (`PiolaClientes.vue`) mandaba `accion: 'guardar'` al adjuntar un documento,
  pero `adjuntos.post.ts` solo reconoce `'agregar'` — el botón "Adjuntar" de "Contrato, anexos y
  DNI" fallaba con 400 siempre. Corregido.

**Confirmado como ya correcto, sin cambios:** los tipos de contenido (video, pieza gráfica, guion,
carrusel) que ya existían en el catálogo — Sebastián y Rafaella los revisaron en la reunión y
dijeron que están bien tal cual.

**Explícitamente diferido, no se implementa:**

- El dashboard propio de Sebastián por área de producción — Raysa le pidió que lo especifique él
  mismo esta semana; se dejó lista la capa de datos (áreas y tipos), no una pantalla nueva.
- Roles y permisos granulares — reunión interna aparte, la próxima semana.
- La reconciliación con `feat/mobile-adaptation` — hay otra sesión trabajando en eso sobre la
  misma base de datos; ver `sql/piola_reconciliacion_mobile.sql` (sin correr).

### Reunión del 14/09/2026 — lo acordado (migración `sql/piola_reunion_14sep.sql`)

Participaron Sebastián Ávalos, Raysa Cucho, Edson Polo, Héctor Córdova y Roberto. **Correr una vez
`sql/piola_reunion_14sep.sql`** (idempotente; solo siembra quién puede cambiar contraseñas). Lo demás no toca la base.

| Qué pidieron | Dónde quedó |
|---|---|
| Producción: "Etapa de producción" pasa a llamarse **Área** y se elimina el "Área" genérico (Dirección / Comercial / …), que se confundía con el Estado | `PiolaProduccion.vue`: un solo campo **Área** = `piola_produccion_areas` (guiones, producción, grabación, edición, presentación, diseño gráfico). El filtro, la tarjeta y el reporte usan solo esa. `piola_deliverables.area_id` y `piola_compromisos.area_id` **siguen en la base** (no se borran datos); solo dejaron de mostrarse. Los compromisos se siguen guardando con su `area_id` anterior intacto |
| Botón **Duplicar** en el tablero de producción (Sebastián: "clic derecho, duplicar, y solo le cambian el título") | Botón en la tarjeta (al pasar el mouse), **clic derecho** y botón en el diálogo. Acción `duplicar_entregable` en `produccion.post.ts`: copia marca, tipo, área, servicio, cantidad, periodo, responsable, fecha de compromiso y descripción; **no copia** enlaces, observaciones de Dirección, aprobación ni fecha de entrega, y arranca "En producción". La copia se guarda al instante y se abre para cambiarle el título |
| **Cumplimiento por marca** igual al **Excel de KPIs** (una fila por marca, una columna por tipo de contenido, total, avance %, "el 100 % es todo el mes; en la quincena deberíamos ir en 40–50 %") | Tabla verde estilo Excel en `PiolaProduccion.vue` + `utils/piolaCumplimiento.ts` (funciones puras con pruebas). Cada barra lleva una marca vertical con el **avance esperado a hoy** (día del mes / días del mes) y un ritmo: Completo / Al día / En riesgo (hasta 15 puntos por debajo) / Atrasado. Sale de la vista `piola_cumplimiento_tipo` (aprobado + entregado): no se llena a mano |
| Reporte del tablero de producción **en PDF** (5 guiones y 7 piezas gráficas en producción, lo que está en revisión…), general o por marca | Botón **Reporte PDF** en el Tablero (respeta los filtros: marca, área, tipo, responsable) y **Descargar PDF** en Cumplimiento (todas las marcas o una). Es HTML que se imprime a PDF desde el navegador (mismo criterio que boletas y facturas: el proyecto no tiene librería de PDF). Si el navegador bloquea las ventanas emergentes, imprime desde un iframe oculto |
| Título "Reportes y alertas" → **"Reportes comerciales y alertas CRM"** | Menú lateral y título de la página (`Piola.vue`, `PiolaReportes.vue`) |
| **Cambiar contraseñas** de los usuarios del sistema: solo Raysa y Edson (Héctor, aunque es administrador, no) | `PUT /api/users/password` + bloque "Cambiar contraseña" en `EditUserDialog.vue` (visible solo para quien tiene permiso). Ver las reglas abajo |
| Roles: "rol" = qué módulos ve, "cargo" = nombre del puesto | Sin cambios: se quedaron con los roles existentes (Dirección Estratégica para quien solo ve Mi espacio + Producción). `piola_colaboradores.cargo` ya existe |
| Registro de entrada/salida en **Mi espacio** (sin dar acceso a RR. HH.) | **Ya estaba así:** Mi espacio trae Iniciar jornada / Break / Terminar jornada, historial, vacaciones y boletas propias. El rol Colaborador solo ve Mi espacio |
| CRM en el celular: usar el navegador (Chrome), no la app | Aviso cerrable en el Dashboard de Piola (`PiolaHome.vue`). La app nativa de Chatwoot tiene errores conocidos y no deja enviar mensajes |

**Cambio de contraseña — reglas que NO son obvias** (`server/utils/usuarios-password.ts`):

- **Quién puede:** superadmin de Alef siempre; un admin de Piola **solo si su correo está en `piola_modulo_acceso` con `grupo = 'contrasenas'`** (Raysa y Edson). Sin esa fila, o si falla la consulta, nadie más que Alef puede: falla cerrado. El grupo `contrasenas` no está en `GRUPOS_ACCESO_RECONOCIDOS`, así que no restringe ningún módulo. Para dar o quitar el permiso basta editar el arreglo `emails`.
- **Hay que confirmar con la contraseña propia** (`tu_password`). La cookie `dashboard_session` es un JSON sin firmar que solo lleva el correo: quien conozca el de un administrador podría fabricarla, y para leer datos eso ya era un límite conocido pero para **cambiar la contraseña de otro** significaría tomar su cuenta. Se verifica contra el hash de `dashboardlogin` y, si no coincide, contra Supabase Auth (quien cambió su clave con "olvidé mi contraseña" solo la tiene actualizada ahí). Freno de 5 intentos fallidos por 10 minutos (en memoria: es un freno, no una garantía).
- **Se cambia en DOS lugares.** El login prueba primero **Supabase Auth** y solo después el hash bcrypt de `dashboardlogin`. Un usuario que ya entró alguna vez fue migrado a Auth con su clave de ese momento: cambiar solo el hash dejaría la **contraseña vieja funcionando**. Por eso se actualiza `dashboardlogin.password` y, si existe, el usuario de Auth (`auth.admin.updateUserById`, buscándolo por id o por correo). Si todavía no está en Auth, la próxima entrada lo migra ya con la clave nueva.
- Un admin nunca toca a un superadmin ni a un usuario de otra empresa; mínimo 8 y máximo 72 caracteres (bcrypt ignora en silencio lo que pase de 72); sin espacios en los bordes; la clave nunca se devuelve ni se registra (solo "Cambió la contraseña del usuario X"). Las sesiones ya abiertas del usuario no se cierran.
- Probado de punta a punta contra la base real con usuarios de prueba (22 comprobaciones: permisos, cada rechazo, el caso feliz, el freno de intentos y la limpieza).

**Pendiente del cliente (bloquea completar, no es desarrollo):**
- **Excel de KPIs** (la "tabla verde"): lo iba a mandar Sebastián por WhatsApp. La tabla de Cumplimiento se armó con la estructura descrita en la reunión; cuando llegue el Excel se ajustan columnas y orden en `utils/piolaCumplimiento.ts`.
- **Excel de códigos financieros** (Edson): la numeración de tipo de gasto ya existe (`piola_expense_categories.codigo`); falta importar el archivo cuando llegue.
- **Texto del saludo automático** de WhatsApp (Héctor): se carga en Configuración → Mensajes automáticos (`piola_mensajes`, clave `bienvenida_whatsapp`) y se activa en el saludo del inbox de Chatwoot / n8n (`referencia/n8n/piola-saludo-automatico-guia.md`).
- **Operativo, no de código:** Edson crea los ~15 usuarios (primero "Usuarios del sistema" con rol Agente y después la ficha en Colaboradores; Alejandro incluido) y Roberto les pone las contraseñas por grupo (Edson/Raysa/Héctor una; Sebastián otra; el equipo operativo otra) con el nuevo botón. Sebastián carga los 2 entregables de Guabazana (gráficas + videos) en el tablero.

### Pendientes del cliente (bloquean cierre, no desarrollo)

**Logo — resuelto el 28/08.** Llegó `LOGO_BL@2x.png` (el bocadillo "HAZLO"), recortado y en
`public/piola-logo.png`. El sidebar ya lo usa. Sólo falta **setear `PIOLA_LOGO_URL`** en Netlify a
`https://dashboard.alef.company/piola-logo.png` para que también salga en los documentos generados
(contratos, facturas, boletas) — sin eso, esos siguen sin logo aunque el dashboard ya lo tenga.

Lista de gastos operativos con su jerarquía · fórmula exacta de comisiones de Héctor ·
modelos reales de boleta y formato AFP · lista de usuarios (nombre + correo + rol) ·
catálogo completo de servicios · antigüedad de cada colaborador · reunión con José
(Traffic Manager) para conectar Meta Ads / WhatsApp / Instagram.

Todo lo que dependía de esos datos quedó **parametrizable**, no hardcodeado: tasas de planilla
en `TASAS` (`server/utils/piola-planilla.ts`), comisión en `calcularComision()`
(`server/utils/piola.ts`), y catálogos como tablas editables desde la UI.

**Fuera de alcance v1:** TikTok Ads, multi-moneda, reemplazar Syscon, Dropbox, múltiples cuentas
publicitarias. La tabla `piola_meta_metrics` está creada esperando la conexión con Meta.
