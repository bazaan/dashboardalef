# PR — Dashboard Healup · Mayo 2026 v2

Branch: `feat/dashboard-mayo-2026-v2` → `main`

**Diferencia vs v1 (revertido):** este pase es conservador. Cada cambio es aditivo, idempotente, reversible. **Nada destruye lógica existente** ni borra data. Las migraciones SQL no se aplican automáticamente — quedan en `sql/` para que vos las corras manualmente cuando confirmes.

**Tickets EXCLUIDOS de este PR** (a pedido del usuario):
- ~~2.9 Separación por cabina~~ — fuera de scope
- ~~2.11 Eliminar promo S/50 obsoleta~~ — fuera de scope

---

## Tickets incluidos (orden de aplicación)

| # | Ticket | Riesgo | Toca BD | Estado |
|---|---|---|---|---|
| 2.4 | Egresos categorizados (categoría + método + INSUMOS + soft-delete) | 🟢 Bajo | SQL ADD COLUMN | ✅ |
| 2.6 | Catálogo procedimientos: categoría + activo + seed | 🟢 Bajo | SQL ADD COLUMN + INSERT NOT EXISTS | ✅ |
| 2.7 | Estados de cita + reagendamiento | 🟢 Bajo | SQL ADD COLUMN + backfill | ✅ |
| 2.12 | Campo firma_paciente JSONB (fase 2) | 🟢 Bajo | SQL ADD COLUMN | ✅ |
| audit_log | Tabla + composable | 🟢 Bajo | SQL CREATE TABLE | ✅ |
| 2.13 | Reporte mensual exportable PDF | 🟡 Medio | Solo lectura | ✅ |
| 2.3 | Reconciliación caja chica vs cuenta | 🟡 Medio | Solo lectura | ✅ |
| 2.5 | Filtros lista pacientes (chips de mes) | 🟢 Bajo | Sin BD | ✅ |
| Soft-delete huérfanos | UPDATE deleted_at en pacientes 1-enero/null | 🟡 Medio | SQL con SELECT de revisión primero | ✅ archivo |

**No incluidos en v2** (postponer a v3 con feature flag y QA dedicado):
- 2.1 Multi-procedimiento por cita
- 2.2 Multi-pago por cita
- 2.8 Tracking comprobantes a nivel pago
- 2.10 Walk-in registration

---

## Migraciones SQL (correr en Supabase, en orden)

⚠️ **Antes de correr** las migraciones: verificar backup automático activo en Supabase.

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `sql/healup_audit_log.sql` | CREATE TABLE healup_audit_log + 3 índices |
| 2 | `sql/healup_egresos_categorias.sql` | ADD COLUMN categoria/metodo_pago/INSUMOS/soft-delete + backfill por inferencia |
| 3 | `sql/healup_procedures_categoria.sql` | ADD COLUMN categoria/activo + seed PAC1-3, Retiro Hialurónico, etc. |
| 4 | `sql/healup_estados_cita.sql` | ADD COLUMN estado + reagendado_a_id + backfill desde cobro_completado |
| 5 | `sql/healup_historia_clinica_firma.sql` | ADD COLUMN firma_paciente JSONB |
| 6 | `sql/healup_soft_delete_huerfanos.sql` | ADD COLUMN deleted_at — **el UPDATE viene comentado**: revisar SELECT primero |

Todas son **idempotentes** (`IF NOT EXISTS`) — re-ejecutarlas no causa daño.
Cada archivo incluye un bloque `-- ROLLBACK:` con los `DROP COLUMN` exactos para deshacer.

---

## Cambios de UI

### Vista Egresos
- Dialog con select de **categoría** + select de **método de pago** + bloque **INSUMOS** condicional (producto / unidad / precio_unitario)
- Campo **referencia** (voucher / nota libre)
- Checkbox **descartado** (excluye de reportes sin borrar)
- Chips de filtro arriba de la tabla por categoría y por método
- Tabla con chip de color por categoría
- `saveEgreso` con try-then-retry: si la migración SQL aún no corrió, escribe sólo en los campos viejos
- `deleteEgreso` con soft-delete (fallback a hard-delete si la columna no existe)

### Sidebar Finanzas — 2 vistas nuevas
- **Cierre Mensual** (icon `mdi-finance`):
  - KPIs ingresos / egresos / utilidad neta
  - Pacientes por fuente (TikTok / WhatsApp / Instagram / Facebook)
  - Tabla egresos por categoría
  - Botón **Exportar PDF** (abre ventana imprimible — Cmd+P → guardar como PDF)
- **Reconciliación caja** (icon `mdi-bank-check`):
  - Saldo calculado caja chica = ingresos efectivo − egresos efectivo
  - Saldo calculado cuenta bancaria = ingresos no-efectivo − egresos no-efectivo
  - Input manual de saldo real → cuadre verde si difiere < S/1, rojo si no
  - Botón **Cerrar día** que loguea snapshot al `healup_audit_log`

### Vista Pacientes
- Chips de mes (default mes actual) que filtran ambas tablas (WPP y FB/IG)
- Contador en el título de cada tabla refleja el filtro
- Búsqueda DNI/nombre existente sigue funcionando

---

## Cambios de código (server-side y client-side)

| Archivo | Cambio |
|---|---|
| `pages/pruebas/Healup.vue` | UI de egresos / cierre mensual / reconciliación / filtros pacientes + computeds |
| `composables/useHealupAudit.ts` | NUEVO — escribe a `healup_audit_log` desde la UI, suprime errores si la tabla no existe |
| `tests/healup-totales.test.ts` | NUEVO — 19 tests vitest puros |
| `tests/README.md` | NUEVO |
| `sql/healup_*.sql` | NUEVOS — 6 migraciones idempotentes y reversibles |

---

## Verificación contra Supabase real (datos cruzados antes del PR)

| Métrica | Valor real en BD | Confirmado por |
|---|---|---|
| Pacientes WPP histórico | 192 | curl directo a Supabase |
| Pacientes FB/IG histórico | 27 | curl directo a Supabase |
| Pacientes mayo 2026 | **24 + 1 = 25** | gte/lt sobre `fecha_agendamiento` |
| Pacientes abril 2026 | 80 + 8 = 88 | idem |
| Leads totales | 2809 + 446 = 3255 | idem |
| Calendar events | 243 | NO se cuentan como pacientes |
| Build production | ✅ Limpio (~22 MB) | nuxt build |
| Tests vitest | ✅ 19/19 verdes | npx vitest run |

---

## Checklist QA

### Pre-merge

- [ ] Backup BD Supabase confirmado
- [ ] Aplicar `sql/healup_audit_log.sql` y verificar tabla creada
- [ ] Aplicar `sql/healup_egresos_categorias.sql` y verificar columnas + backfill
- [ ] Aplicar `sql/healup_procedures_categoria.sql` y verificar seed (PAC1-3, etc.)
- [ ] Aplicar `sql/healup_estados_cita.sql` y verificar estado backfill
- [ ] Aplicar `sql/healup_historia_clinica_firma.sql`
- [ ] **Antes** de aplicar el UPDATE en `healup_soft_delete_huerfanos.sql`, correr el SELECT y revisar lista
- [ ] Pull en otros ordenadores con `git pull --rebase origin main`

### Egresos (2.4)
- [ ] Sidebar → Egresos: chips de meses funcionan
- [ ] Crear egreso categoría INSUMOS con producto + unidad + precio_unitario → guarda OK
- [ ] Crear egreso DELIVERY método EFECTIVO → aparece en chip filtro
- [ ] Editar egreso, cambiar fecha al mes anterior → se reubica al chip correcto
- [ ] Marcar Descartado → desaparece de la lista
- [ ] Eliminar → soft-delete (fila desaparece, queda en BD con `deleted_at`)

### Cierre Mensual (2.13)
- [ ] Sidebar → Cierre mensual
- [ ] Selector de mes cambia los KPIs
- [ ] Click "Exportar PDF" → ventana imprimible

### Reconciliación (2.3)
- [ ] Sidebar → Reconciliación caja
- [ ] Saldo calculado tiene sentido (ingresos − egresos del mes)
- [ ] Input saldo real → cuadre verde/rojo
- [ ] "Cerrar día" → ventana con detalle + entry en `healup_audit_log`

### Pacientes (2.5)
- [ ] Sidebar → Pacientes: chips de meses funcionan en ambas tablas
- [ ] "Todos" muestra histórico completo

---

## Rollback (si algo falla)

```bash
# Código:
git revert <merge-commit-sha>

# SQL: cada archivo en sql/healup_*.sql tiene un bloque -- ROLLBACK: con los DROP exactos.
```

---

Generado el 2026-05-05 — branch `feat/dashboard-mayo-2026-v2`.
