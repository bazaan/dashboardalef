# Tests — Dashboard Healup

Tests unitarios para el flujo de cálculos del dashboard. Implementación pura
(no toca Supabase ni el DOM) que valida la matemática del flujo de paciente:

`paciente → cita → procedimientos[] → pagos[] → comprobante`.

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

# Sólo el archivo de totales:
npx vitest run tests/healup-totales.test.ts
```

## Cobertura actual (10 tests)

- `parseCurrency` — parseo de strings monetarios (S/, comas, null)
- `sumarProcedimientos` (2.1) — múltiples filas cantidad × precio
- `sumarPagos` (2.2) — múltiples métodos por cita (caso Samanta 970+52, etc.)
- `balance` (2.2) — falta cobrar / sobrante / cuadra
- `sugerirMontoReservaPorCabina` — regla S/50 cabina 1 / S/20 cabina 2
- `descuentoPretax` — descuento dinámico monto / 1.18
- Reconciliación caja chica vs cuenta (2.3)
- Conversión legacy → multi-fila (compat 2.1/2.2)

## Tests integración pendientes (fase siguiente)

Cuando agreguemos `@vue/test-utils` o Playwright:
- Crear paciente walk-in → cita generada → procedimientos persistidos →
  pagos persistidos → reflejado en dashboard
- Editar cita → cambiar estado RESERVADA → FINALIZADA → audit_log registra
- Egreso EFECTIVO → descuenta saldo caja chica
- Boleta emitida → pago.comprobante actualizado
