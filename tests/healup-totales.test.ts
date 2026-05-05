// Tests unitarios para los cálculos de totales del dashboard Healup.
// Para correr (después de instalar vitest):
//   npm install -D vitest
//   npx vitest run tests/healup-totales.test.ts
//
// Estos tests son puros: no tocan Supabase, no tocan el DOM, solo
// validan la matemática del flujo paciente → cita → procedimientos → pagos.

import { describe, it, expect } from 'vitest'

// ─── Helpers replicados desde Healup.vue / HealupCobroAtencion.vue ───
const parseCurrency = (value: any): number => {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value).replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

const sumarPagos = (pagos: Array<{ metodo: string; monto: number }>): number =>
  pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)

const sumarProcedimientos = (procs: Array<{ cantidad: number; precio: number }>): number =>
  procs.reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precio) || 0), 0)

const balance = (procs: any[], pagos: any[]) =>
  +(sumarProcedimientos(procs) - sumarPagos(pagos)).toFixed(2)

const sugerirMontoReservaPorCabina = (cabina: string): number =>
  cabina === 'cabina2' ? 20 : 50

const descuentoPretax = (montoReserva: number) =>
  +(montoReserva / 1.18).toFixed(2)

// ─── Tests ───────────────────────────────────────────────

describe('parseCurrency', () => {
  it('parsea strings con S/ y comas', () => {
    expect(parseCurrency('S/ 1,234.56')).toBe(1234.56)
    expect(parseCurrency('970')).toBe(970)
    expect(parseCurrency(null)).toBe(0)
    expect(parseCurrency(undefined)).toBe(0)
    expect(parseCurrency('')).toBe(0)
  })
})

describe('Múltiples procedimientos por cita (2.1)', () => {
  it('suma cantidad × precio de cada fila', () => {
    const procs = [
      { cantidad: 1, precio: 600 },   // Baby Botox
      { cantidad: 1, precio: 350 },   // Enzimas
    ]
    expect(sumarProcedimientos(procs)).toBe(950)
  })

  it('respeta cantidades > 1', () => {
    const procs = [
      { cantidad: 3, precio: 120 },   // PAC1 x3
    ]
    expect(sumarProcedimientos(procs)).toBe(360)
  })

  it('ignora valores no numéricos', () => {
    const procs: any = [
      { cantidad: 'abc', precio: 100 },
      { cantidad: 1, precio: 200 },
    ]
    expect(sumarProcedimientos(procs)).toBe(200)
  })
})

describe('Múltiples métodos de pago por cita (2.2)', () => {
  it('caso Samanta Ramírez: 970 efectivo + 52 Yape = 1022', () => {
    const pagos = [
      { metodo: 'EFECTIVO', monto: 970 },
      { metodo: 'YAPE',     monto: 52 },
    ]
    expect(sumarPagos(pagos)).toBe(1022)
  })

  it('caso reserva 50 + saldo 2 Yape = 52', () => {
    const pagos = [
      { metodo: 'EFECTIVO', monto: 50 },
      { metodo: 'YAPE',     monto: 2 },
    ]
    expect(sumarPagos(pagos)).toBe(52)
  })

  it('balance positivo = falta cobrar', () => {
    const procs = [{ cantidad: 1, precio: 1000 }]
    const pagos = [{ metodo: 'EFECTIVO', monto: 600 }]
    expect(balance(procs, pagos)).toBe(400)
  })

  it('balance negativo = sobrante (cliente pagó de más)', () => {
    const procs = [{ cantidad: 1, precio: 100 }]
    const pagos = [{ metodo: 'EFECTIVO', monto: 150 }]
    expect(balance(procs, pagos)).toBe(-50)
  })

  it('balance cero cuando cuadra exacto', () => {
    const procs = [
      { cantidad: 1, precio: 600 },
      { cantidad: 1, precio: 350 },
    ]
    const pagos = [
      { metodo: 'EFECTIVO', monto: 800 },
      { metodo: 'YAPE',     monto: 150 },
    ]
    expect(balance(procs, pagos)).toBe(0)
  })
})

describe('Reserva según cabina (regla S/50 ↔ S/20)', () => {
  it('cabina 1 (doctora) → S/50', () => {
    expect(sugerirMontoReservaPorCabina('cabina1')).toBe(50)
  })
  it('cabina 2 (no invasivos) → S/20', () => {
    expect(sugerirMontoReservaPorCabina('cabina2')).toBe(20)
  })
  it('default → cabina 1 (50)', () => {
    expect(sugerirMontoReservaPorCabina('')).toBe(50)
    expect(sugerirMontoReservaPorCabina(null as any)).toBe(50)
  })
})

describe('Descuento dinámico en cobro (2.11 nueva lógica)', () => {
  it('S/50 → pretax 42.37', () => {
    expect(descuentoPretax(50)).toBe(42.37)
  })
  it('S/20 → pretax 16.95', () => {
    expect(descuentoPretax(20)).toBe(16.95)
  })
  it('monto custom S/30 (promo) → pretax 25.42', () => {
    expect(descuentoPretax(30)).toBe(25.42)
  })
})

describe('Reconciliación caja chica vs cuenta (2.3)', () => {
  it('saldo caja chica = ingresos efectivo - egresos efectivo', () => {
    const ingresosEfe = 970 + 50 // Samanta efectivo + reserva efectivo
    const egresosEfe  = 14       // Delivery
    expect(ingresosEfe - egresosEfe).toBe(1006)
  })

  it('saldo cuenta = ingresos no-efectivo - egresos no-efectivo', () => {
    const ingresosNoEfe = 52 + 1500           // Yape + transferencia
    const egresosNoEfe  = 740                 // Botox por transferencia
    expect(ingresosNoEfe - egresosNoEfe).toBe(812)
  })
})

describe('Conversion legacy → multi-fila (compat)', () => {
  it('una cita legacy con 1 procedimiento + 1 pago debe migrarse 1:1', () => {
    const citaLegacy = {
      precio: 50,
      precio_tratamiento: 950,
      metodo_de_pago: 'Efectivo',
      procedimiento: 'Baby Botox'
    }
    // Backfill esperado
    const procs = [
      { cantidad: 1, precio: 950, nombre_libre: 'Baby Botox' }
    ]
    const pagos = [
      { metodo: 'EFECTIVO', monto: 50 } // anticipo registrado
    ]
    expect(sumarProcedimientos(procs)).toBe(950)
    expect(sumarPagos(pagos)).toBe(50)
    expect(balance(procs, pagos)).toBe(900) // saldo a cobrar al servicio
  })
})
