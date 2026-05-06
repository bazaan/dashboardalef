# Tests — Dashboard Healup mayo 2026 v2

Tests unitarios puros (no tocan Supabase ni DOM).

## Setup

```bash
npm install -D vitest
```

## Correr

```bash
# Todo:
npx vitest run tests/

# Watch mode:
npx vitest tests/

# Solo un archivo:
npx vitest run tests/healup-totales.test.ts
```

## Cobertura

`healup-totales.test.ts`:
- `parseCurrency` — parseo de strings monetarios
- `normalizePhone` — normalización de teléfonos peruanos
- `dedupKey` — dedup paciente entre WPP/FBIG (por DNI → tel → email → nombre)
- `sumarPagos` / `sumarProcs` — cálculo multi-fila
- `inferirCategoriaEgreso` — backfill de categoría desde tipo_egreso/nombre legacy
- Reconciliación caja chica vs cuenta bancaria
- Compatibilidad legacy (cita vieja → multi-fila)

## Tests integración pendientes (fase siguiente)

- Mock Supabase + crear paciente walk-in → cita → procedimientos → pagos
- Editar cita → cambio de estado → audit_log
- Egreso EFECTIVO → descuenta saldo caja chica
- Boleta emitida → pago.comprobante actualizado
