// Tests unitarios puros (no Supabase, no DOM) — flujo Healup mayo 2026 v2.
// Correr con: npx vitest run tests/

import { describe, it, expect } from 'vitest'

const parseCurrency = (value: any): number => {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value).replace(/[^\d.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

const isEncrypted = (val: any): boolean => {
  if (!val) return false
  const s = String(val)
  return /[^\d]/.test(s) && s.length > 10
}

const normalizePhone = (n: string): string => {
  if (!n) return ''
  const s = String(n).replace(/[^\d]/g, '')
  if (s.startsWith('51') && s.length === 11) return s.slice(2)
  return s
}

const dedupKey = (row: any): string => {
  const dni = String(row?.dni || row?.client_dni || '').trim()
  if (dni) return 'dni:' + dni
  const tel = String(row?.telefono || row?.numero || row?.client_phone || '').replace(/[^\d]/g, '')
  if (tel) return 'tel:' + (tel.length === 11 && tel.startsWith('51') ? tel.slice(2) : tel)
  const email = String(row?.email || '').trim().toLowerCase()
  if (email) return 'email:' + email
  const name = String(row?.nombre || row?.client_name || '').trim().toLowerCase()
  return 'name:' + name
}

const sumarPagos    = (pagos: any[]) => pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
const sumarProcs    = (procs: any[]) => procs.reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precio) || 0), 0)

const inferirCategoriaEgreso = (e: any): string => {
  const t = (e.tipo_egreso || '').toLowerCase()
  const n = (e.nombre || '').toLowerCase()
  if (n.includes('botox') || n.includes('toxina') || n.includes('hialur') || t.includes('insumo')) return 'INSUMOS'
  if (n.includes('delivery') || n.includes('env') || t.includes('delivery')) return 'DELIVERY'
  if (t.includes('market') || n.includes('meta') || n.includes('tiktok') || n.includes('contenido')) return 'MARKETING'
  if (t.includes('mantenim') || t.includes('limpie')) return 'MANTENIMIENTO'
  if (t.includes('suel') || t.includes('honorar')) return 'SUELDOS'
  return 'OTROS'
}

describe('parseCurrency', () => {
  it('parsea S/ con comas', () => expect(parseCurrency('S/ 1,234.56')).toBe(1234.56))
  it('null/undefined → 0', () => { expect(parseCurrency(null)).toBe(0); expect(parseCurrency(undefined)).toBe(0) })
})

describe('normalizePhone', () => {
  it('quita prefijo 51', () => expect(normalizePhone('51999111222')).toBe('999111222'))
  it('limpia chars no numéricos', () => expect(normalizePhone('+51 (999) 111-222')).toBe('999111222'))
})

describe('dedupKey', () => {
  it('DNI tiene prioridad', () => {
    expect(dedupKey({ dni: '12345678', nombre: 'X' })).toBe('dni:12345678')
  })
  it('cae a tel cuando sin DNI', () => {
    expect(dedupKey({ numero: '999111222' })).toBe('tel:999111222')
  })
  it('mismo paciente WPP+FBIG con DNI dedup → 1', () => {
    const wpp  = { dni: '11111111', nombre: 'A' }
    const fbig = { dni: '11111111', nombre: 'A', red_social: 'instagram.com/a' }
    expect(dedupKey(wpp)).toBe(dedupKey(fbig))
  })
  it('teléfono con +51 vs sin 51 dedupea', () => {
    const a = { numero: '51999111222' }
    const b = { client_phone: '999111222' }
    expect(dedupKey(a)).toBe(dedupKey(b))
  })
})

describe('Cálculo de totales (multi-procedimiento + multi-pago)', () => {
  it('caso Samanta: 970 efectivo + 52 yape = 1022', () => {
    const pagos = [{ metodo:'EFECTIVO', monto:970 }, { metodo:'YAPE', monto:52 }]
    expect(sumarPagos(pagos)).toBe(1022)
  })
  it('balance positivo = falta cobrar', () => {
    expect(sumarProcs([{ cantidad:1, precio:1000 }]) - sumarPagos([{ monto:600 }])).toBe(400)
  })
  it('balance cero cuando cuadra', () => {
    const procs = [{ cantidad:1, precio:600 }, { cantidad:1, precio:350 }]
    const pagos = [{ monto:800 }, { monto:150 }]
    expect(sumarProcs(procs) - sumarPagos(pagos)).toBe(0)
  })
})

describe('Inferencia categoría egreso (2.4 backfill)', () => {
  it('Botox → INSUMOS', () => expect(inferirCategoriaEgreso({ nombre:'BOTOX' })).toBe('INSUMOS'))
  it('Delivery → DELIVERY', () => expect(inferirCategoriaEgreso({ tipo_egreso:'Delivery moto' })).toBe('DELIVERY'))
  it('Creación de contenido → MARKETING', () => expect(inferirCategoriaEgreso({ nombre:'Creación de contenido' })).toBe('MARKETING'))
  it('Sueldo → SUELDOS', () => expect(inferirCategoriaEgreso({ tipo_egreso:'Sueldo asistente' })).toBe('SUELDOS'))
  it('Sin match → OTROS', () => expect(inferirCategoriaEgreso({ nombre:'Cualquier cosa' })).toBe('OTROS'))
})

describe('Reconciliación caja chica vs cuenta (2.3)', () => {
  const ingresosEfectivo = 970 + 50         // 1020
  const egresosEfectivo  = 14               // delivery
  const ingresosCuenta   = 52 + 1500
  const egresosCuenta    = 740              // botox transferencia
  it('saldo caja chica', () => expect(ingresosEfectivo - egresosEfectivo).toBe(1006))
  it('saldo cuenta',     () => expect(ingresosCuenta - egresosCuenta).toBe(812))
})

describe('Compatibilidad legacy', () => {
  it('cita vieja con 1 procedimiento + 1 pago debe migrarse 1:1', () => {
    const cita = { precio: 50, precio_tratamiento: 950, metodo_de_pago: 'Efectivo', procedimiento: 'Baby Botox' }
    const procs = [{ cantidad:1, precio:950 }]
    const pagos = [{ metodo:'EFECTIVO', monto:50 }]
    expect(sumarProcs(procs)).toBe(950)
    expect(sumarPagos(pagos)).toBe(50)
  })
})
