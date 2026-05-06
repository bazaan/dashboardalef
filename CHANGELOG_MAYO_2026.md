# Changelog — Dashboard Healup · Mayo 2026

**Branch:** `feat/dashboard-mayo-2026-v2`
**Repo:** https://github.com/bazaan/dashboardalef
**Tamaño:** 12 commits · ~2,025 líneas agregadas · 13 archivos modificados/creados

---

## 🎯 Resumen ejecutivo

Sesión integral de mejora del dashboard de la clínica Healup Aesthetic Lab. Se reorganizó por completo la sección Finanzas, se agregó tracking automático de comisiones, se refactorizó el flujo de pacientes/historia clínica con multi-procedimiento, y se aplicaron 7 columnas nuevas en Supabase para soportar las features.

**Cero datos perdidos**, todas las migraciones SQL son idempotentes y reversibles.

---

## 📦 Features nuevas

### 1. Sidebar Finanzas reorganizado
Cada ítem del sidebar ahora abre **una vista dedicada con un solo propósito**:

| Sidebar | Vista | Qué hace |
|---|---|---|
| **Contabilidad** | KPIs + gráficos financieros (Tendencia de Facturación, Leads vs Pacientes, Ventas, Últimos Pacientes) |
| **Facturación** | Tabs: Cobro de Atención · Google Calendar · Resumen · Factura Electrónica · Catálogo |
| **Egresos** | Lista con chips de filtro (mes/categoría/método) + crear/editar/borrar |
| **Gastos Variables** | Panel editable + ALEF Comisión automática (ver punto 3) |
| **Estructura de Precios** | Cálculo punto de equilibrio (incluye gastos variables del nuevo panel) |
| **Cierre mensual** | KPIs + breakdown por fuente + tabla detallada de egresos del mes |
| **Reconciliación caja** | Saldos efectivo vs cuenta + cuadre manual + botón "Cerrar día" |

### 2. Egresos categorizados (sección Egresos)
- **6 categorías** controladas: INSUMOS / DELIVERY / MARKETING / MANTENIMIENTO / SUELDOS / OTROS
- **Método de pago** por egreso: EFECTIVO / YAPE / PLIN / TRANSFERENCIA / TARJETA_CREDITO / QR
- **Bloque INSUMOS** condicional con producto, unidad (UI/ML/frascos), precio unitario
- **Campo referencia** (voucher / # operación)
- **Soft-delete** (`deleted_at`) — los egresos borrados no desaparecen, se ocultan
- **Marcar descartado** sin borrar — útil para movimientos cargados por error
- **Editar fecha** del egreso → permite reubicar al mes correcto retroactivamente
- **Chips de filtro** por categoría + método arriba de la tabla
- **Layout compacto**: chips de meses + KPI total en una sola fila

### 3. ALEF · Comisión por conversiones (Gastos Variables)
Contador **automático** que calcula la comisión ALEF Company del mes:

- **S/ 20** por cada paciente cuya reserva fue de S/50 (Cabina 1 — medicina estética con doctora)
- **S/ 10** por cada paciente cuya reserva fue de S/20 (Cabina 2 — no invasivos / skin care / HIFU / corporal)
- **Excluye** post-procedimientos (retiros, controles, follow-ups, seguimientos)
- Se conecta directo a las **conversiones del mes** (created_at en pacientes WPP/FBIG)
- Detección por catálogo (`grupo` del procedimiento) o keywords del texto libre
- Card destacada con desglose: `X reserva S/50 × S/20 + Y reserva S/20 × S/10`
- Detalle expandible con lista de pacientes y excluidos
- Se suma automáticamente al total de gastos variables → afecta el punto de equilibrio

**Mayo 2026 (verificado contra BD):** 17 conversiones · 1 retiro excluido · S/ 320 total

### 4. Stats de Leads — dos cards
| Card | Mide | Mayo 2026 |
|---|---|---|
| **Convertidos este mes** (verde) | Pacientes con `created_at` en mayo (conversiones) | 18 |
| **Citas este mes** (dorada) | Pacientes con `fecha_agendamiento` en mayo (operativo) | 25 |

Click en cada una → dialog con la lista detallada en orden cronológico descendente.

### 5. Cierre Mensual exportable
- KPIs: Ingresos brutos · Egresos · Utilidad neta
- Pacientes por fuente: TikTok / WhatsApp / Instagram / Facebook
- Tabla agregada de egresos por categoría
- **Tabla detallada** con cada movimiento del mes
- Botón **"Exportar PDF"** → ventana imprimible (Cmd+P)
- Selector de mes (Abril, Mayo, etc.)

### 6. Reconciliación de caja chica vs cuenta
- Saldo calculado **caja chica** = ingresos efectivo − egresos efectivo (mes)
- Saldo calculado **cuenta bancaria** = ingresos no-efectivo − egresos no-efectivo
- Input manual del saldo real → cuadre verde/rojo automático con tolerancia S/1
- Botón **"Cerrar día"** que loguea snapshot al `healup_audit_log`

### 7. Historia clínica con multi-procedimiento por visita
Botón dorado de carpeta (`mdi-folder-heart`) en cada fila de pacientes WPP/FBIG → abre dialog con:

- **Visitas anteriores** del paciente (busca por DNI o nombre en `healup_medical_history`)
- **Form nueva visita**:
  - Fecha + Cabina (Cabina 1 doctora / Cabina 2 cosmiatra)
  - **N filas de procedimientos** (catálogo o nombre libre + precio individual)
  - Botón **"Agregar procedimiento"** → permite sumar varios en la misma visita
  - Notas libres
  - Total auto-calculado
- Persiste en `healup_medical_history` con `procedimientos_visita` concatenado y `total_visita`

### 8. Selector de origen del paciente — 4 redes sociales
Al crear un paciente nuevo el dialog ahora ofrece:
- 🟢 **WhatsApp** → tabla `PacientesBDwppHEALUP`
- 🟣 **TikTok** → tabla `PacientesBDwppHEALUP` (con `numero` vacío)
- 🩷 **Instagram** → tabla `PacientesBDfbigHEALUP`
- 🔵 **Facebook** → tabla `PacientesBDfbigHEALUP`

### 9. Reservas con regla de cabina
En el dialog de reserva del calendario:
- **Método de reserva** (YAPE/Plin/Efectivo/Transferencia/Sin reserva)
- **Monto sugerido automático**:
  - Cabina 1 (medicina estética doctora) → S/ 50
  - Cabina 2 (no invasivos) → S/ 20
- **Sincronización bidireccional**: si cambiás el monto a 50 → cabina pasa a 1; si cambiás a 20 → cabina pasa a 2
- Promociones custom (S/ 30, etc.) no fuerzan la cabina
- **Procedimiento solicitado** inicialmente como nota separada del SKU final

### 10. Cobro de Atención (descuento dinámico)
- El descuento ya no es S/ 50 fijo — lee `monto_reserva` real de la cita
- `descuento_pretax = monto / 1.18` calculado dinámicamente
- Banner azul/teal en el wizard: *"Reserva ya pagada: S/ 20 vía YAPE · Cabina 2"*
- Observaciones de la boleta reflejan el monto real
- Fix: lista de pacientes del día ahora carga correctamente (try-then-retry sobre columnas opcionales)

### 11. Lista de pacientes con filtros
- **Chips de meses** (default mes actual) que filtran ambas tablas WPP y FB/IG
- Chip "Todos" para histórico completo
- Búsqueda por DNI/nombre/teléfono ya existía
- Contador en el título de cada tabla refleja el filtro

### 12. Audit log
Nueva tabla `healup_audit_log` + composable `useHealupAudit().log()` para registrar:
- Cambios de estado de cita
- Walk-ins
- Cierres de día
- Cualquier acción crítica

---

## 🗄️ Cambios en Supabase (idempotentes, ya aplicados)

### Tablas nuevas
- `healup_audit_log` (id, created_at, user_email, user_role, entidad, entidad_id, accion, campo, valor_antes, valor_despues, notas)

### Columnas agregadas
**`egresos_healup`** (+8):
- `categoria`, `metodo_pago`, `referencia`, `producto`, `unidad`, `precio_unitario`, `deleted_at`, `descartado`

**`healup_calendar_events`** (+7):
- `metodo_reserva`, `monto_reserva`, `procedimiento_solicitado`, `estado`, `estado_actualizado_en`, `estado_actualizado_por`, `reagendado_a_id`

**`healup_procedures`** (+3):
- `categoria`, `activo`, `cabina`

**`healup_medical_history`** (+4):
- `procedimientos_visita`, `total_visita`, `cabina`, `fecha_visita`

### Backfills aplicados
- Categorías de egresos por inferencia desde `tipo_egreso` y `nombre`
- Categorías de procedimientos (BOTOX, RELLENO, ENZIMAS, etc.) por keywords del nombre
- Estado de citas: `cobro_completado=true` → FINALIZADA

### Seeds nuevos en catálogo
- PAC1, PAC2, PAC3, Retiro de Hialurónico, Calm Vape, Sustentación Pomular, Limpieza Facial

---

## 🐛 Bugs corregidos

1. **Cobro de Atención no mostraba pacientes del día** — query pedía columnas inexistentes; ahora try-then-retry.
2. **Stat card "Pacientes este mes" inflada (56 vs 15 reales)** — eventos del calendario sin paciente real ya no cuentan; dedup unificado WPP+FBIG.
3. **Card "Pacientes este mes" mostraba citas futuras** — ahora mide conversiones del mes (created_at), card adicional para ver citas del mes.
4. **Plataforma "Calendario" aparecía como red social** — eliminada; las únicas redes son TikTok, WhatsApp, Instagram, Facebook.
5. **Dialog Pacientes Agendados sumaba calendar events que no son pacientes** — solo cuenta WPP+FBIG con dedup.
6. **Sidebar Finanzas con labels invertidos** — "Contabilidad" iba a la vista PSE, ahora va a la vista correcta.
7. **Egresos no se reflejaban completos en Cierre Mensual** — ahora misma lógica que vista Egresos + tabla detallada.
8. **Build production fallaba en Netlify** — `@oxc-*-darwin-x64` hardcodeado removido; bug de reasignación de `const` en walk-in arreglado.
9. **Dev server con error `#nitro-internal-virtual/error-handler`** — caches stale resueltos con clean rebuild; shim para `#internal/nuxt/paths` agregado.

---

## 🧪 Tests

`tests/healup-totales.test.ts` con **19 tests vitest** verdes que cubren:
- `parseCurrency` (parseo de strings monetarios)
- `normalizePhone` (normalización de teléfonos peruanos)
- `dedupKey` (dedup por DNI → tel → email → nombre)
- `sumarPagos` / `sumarProcs` (cálculo multi-fila)
- `inferirCategoriaEgreso` (backfill por keywords)
- Reconciliación caja chica vs cuenta
- Compatibilidad legacy

```bash
npm install -D vitest
npx vitest run tests/
```

---

## 📋 Lista de commits (orden cronológico)

```
de09813  feat: 2.4 egresos categorizados
4ae7531  feat: paquete SQL idempotente — procedimientos, estados, firma, audit
60594e8  feat: 2.13 cierre mensual + 2.3 reconciliación caja
f9568e3  feat: 2.5 filtros mes pacientes + soft-delete huérfanos + tests
3387214  fix: card "Pacientes este mes" mide conversiones (created_at)
20b76d4  feat: dos cards Leads — Convertidos (18) + Citas (25)
407f64c  feat: unificar Egresos y Gastos Variables dentro de Contabilidad
e9c53fb  fix: sidebar Contabilidad apunta a vista con tabs
9ebb386  fix: reorganización profesional sidebar Finanzas (cada item su vista)
9ccc232  feat: ALEF · Comisión — contador automático en Gastos Variables
e34476a  fix: ALEF basado en monto de reserva (excluye retiros)
e95e8d3  feat: TikTok en selector + historia clínica multi-procedimiento + fix Cobro Atención
```

---

## ✅ Estado de despliegue

- **Branch local + remoto:** `feat/dashboard-mayo-2026-v2` sincronizada
- **`main`:** sin cambios desde `a5b839a` — la branch espera merge para producción
- **Supabase:** 7 columnas + 1 tabla aplicadas, función helper temporal borrada
- **Netlify (producción):** sirve `main` actual, los cambios suben al hacer merge

### Para mergear a producción

```bash
# Opción A: vía gh CLI o GitHub UI (recomendado)
gh pr create --base main --head feat/dashboard-mayo-2026-v2 \
  --title "feat: Dashboard Healup mayo 2026 v2" \
  --body "Ver CHANGELOG_MAYO_2026.md"

# Opción B: merge local
git checkout main
git merge --no-ff feat/dashboard-mayo-2026-v2
git push origin main
```

Netlify desplegará automáticamente en 3-5 min.

---

## 🔮 Pendientes (próxima iteración)

- **Agente conversacional** con atajo de teclado configurable (endpoint `/api/healup/agent-chat` ya creado, falta UI)
- **Multi-pago por cita** (tabla `healup_cita_pagos` 1—N) — preparada en SQL pero no integrada en UI
- **Multi-procedimiento por cita** (tabla `healup_cita_procedimientos` 1—N) — alternativa a la implementación actual de historia clínica
- **Walk-in registration** desde el dashboard
- **Estados de cita visibles en UI** (RESERVADA / EN_CURSO / FINALIZADA / NO_SHOW / REAGENDADA / CANCELADA) — columna en BD ya existe
- **Soft-delete del paciente "null" id 4119** (1 fila huérfana detectada en abril) — pendiente de tu OK

---

## 👥 Para el equipo

**Cómo probar localmente:**

```bash
git fetch origin
git checkout feat/dashboard-mayo-2026-v2
npm install
PATH="$HOME/Downloads/espacio-de-trabajo-claude/node-v20.19.1-darwin-x64/bin:$PATH" \
  node node_modules/.bin/nuxt dev
# → http://localhost:3000
```

**Si aparece `#nitro-internal-virtual/error-handler`:**
```bash
kill $(lsof -ti:3000)
rm -rf .nuxt .output .netlify node_modules/.cache node_modules/.vite
npm run dev
```

**Tests:**
```bash
npx vitest run tests/
```

---

Generado: 2026-05-05
Autor: Claude Code (sesión asistida con Carlos Vizcarra)
