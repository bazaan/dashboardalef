# CLAUDE.md — Dashboard Alef Allin

Leer esto al inicio de cualquier sesión que trabaje en este proyecto.

---

## Qué Es

Dashboard multi-tenant en **Nuxt 3 + Vue + Vuetify 3 + Supabase** para gestionar las 9 empresas del grupo Alef Company. Cada empresa tiene su propio dashboard con datos aislados por `company_id`.

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
npm install        # Instalar dependencias
npm run dev        # Dev server → http://localhost:3000
npm run build      # Build producción
npm run preview    # Preview build local
npm run lint       # ESLint
npm run reset      # Limpiar node_modules + reinstalar
```

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
│       └── EstasConSuerte.vue
│
├── components/
│   ├── FacturacionPSE.vue         # Interfaz de facturas/boletas electrónicas
│   ├── N8nPanicButton.vue         # Activar/desactivar workflows n8n
│   └── Settings/
│       ├── SettingsView.vue       # Gestión de usuarios + logs de actividad
│       ├── CreateUserDialog.vue
│       └── EditUserDialog.vue
│
├── server/api/
│   ├── auth/verify-legacy.post.ts # Verifica passwords bcrypt
│   ├── users/
│   │   ├── index.get.ts           # Listar usuarios (filtrado por company)
│   │   ├── create.post.ts         # Crear usuario (hash bcrypt, verifica permisos)
│   │   ├── update.put.ts          # Editar usuario
│   │   └── delete.delete.ts       # Eliminar usuario
│   ├── pse/                       # Facturación electrónica PSE.PE
│   └── n8n/toggle-workflow.post.ts
│
├── server/utils/
│   └── logger.ts                  # logServerActivity() — log server-side a Supabase
│
├── middleware/
│   └── auth-dashboard.ts          # Protección de rutas: lee cookie, verifica rol
│
├── composables/
│   ├── useActivityLogger.ts       # logActivity() — log client-side a Supabase
│   └── rules.ts                   # Reglas de validación de formularios
│
├── utils/
│   └── permissions.ts             # isSuperAdmin(), canAccess*(), getDashboardPathByCompanyId()
│
├── plugins/
│   ├── vuetify.ts                 # Temas claro/oscuro
│   ├── apexcharts.client.ts
│   └── supabase-logger.client.ts  # Intercepta window.fetch y loggea mutations automáticamente
│
├── assets/styles/
│   └── dashboard.css              # ~2,200 líneas de estilos custom
│
└── sql/                           # Schemas SQL por empresa
    ├── ECS_tables.sql
    └── brada_stock_schema.sql
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

## Base de Datos (Supabase)

### Tablas principales

| Tabla | Propósito |
|---|---|
| `dashboardlogin` | Usuarios: `id`, `email`, `password` (bcrypt), `role`, `company_id`, `full_name`, `created_at` |
| `activity_logs` | Auditoría: `user_email`, `activity`, `company_id`, `created_at` |
| `comprobantes_pse` | Facturas emitidas vía PSE.PE (payload + response) |
| `Brada_stock` | Inventario Brada (botellas, decants, sets) |
| `ECS_*` | Tablas de Estás Con Suerte (leads, ventas por canal) |

---

## Integraciones

### PSE.PE / NubeFact (Facturación electrónica)
- Empresas habilitadas: **Estás Con Suerte**, **Healup**
- Endpoints: `server/api/pse/`
- JWT tokens por empresa hardcodeados en el servidor (no en `.env`)
- Guarda respuestas en tabla `comprobantes_pse`
- También maneja webhooks de pago y envío de correo

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
```

---

## Patrones Importantes

- **Nueva empresa:** Agregar `.vue` en `pages/pruebas/` + entradas en `utils/permissions.ts` (canAccess* y getDashboardPathByCompanyId) + tablas en Supabase
- **Estilos:** Todo custom va en `assets/styles/dashboard.css`, no inline
- **Seguridad:** Lógica sensible (API keys, bcrypt, JWT tokens) siempre en `server/api/`, nunca expuesta al cliente
- **Logs:** Acciones manuales importantes → `useActivityLogger` (cliente) o `logServerActivity` (servidor)
- **Permisos:** Siempre verificar rol en el servidor, el middleware solo protege navegación
- **company_id:** Los valores en BD tienen capitalización inconsistente — `permissions.ts` hace lowercase + fuzzy match para normalizar
