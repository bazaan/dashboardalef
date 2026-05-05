// Tests de la dedup que une las 3 fuentes de pacientes (WPP/FBIG/calendar).
// Reproduce el bug del 56 vs 15 con datos sintéticos para confirmar la fix.

import { describe, it, expect } from 'vitest'

// ─── Replicas exactas de las funciones del componente ────────────────
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

const dedupKeyForAgendado = (row: any): string => {
  const dni = String(row?.dni || row?.client_dni || row?.clientDNI || '').trim()
  if (dni) return 'dni:' + dni
  const tel = String(row?.telefono || row?.numero || row?.client_phone || row?.clientPhone || '')
    .replace(/[^\d]/g, '')
  if (tel) return 'tel:' + (tel.length === 11 && tel.startsWith('51') ? tel.slice(2) : tel)
  const email = String(row?.email || row?.client_email || row?.clientEmail || '').trim().toLowerCase()
  if (email) return 'email:' + email
  const name = `${row?.nombre || row?.clientName || row?.client_name || ''} ${row?.client_surname || row?.clientSurname || ''}`
    .trim().toLowerCase().replace(/\s+/g, ' ')
  return 'name:' + name
}

const eventoEsPacienteReal = (e: any): boolean => {
  const nombre = String(e.clientName || e.client_name || '').trim()
  const dni    = String(e.clientDNI  || e.client_dni  || '').trim()
  const tel    = String(e.clientPhone|| e.client_phone|| '').trim()
  return !!(nombre || dni || tel)
}

// Builders simplificados (sólo los campos que usa la dedup)
const buildPacienteRow = (p: any): any => {
  const isEnc = isEncrypted(p.numero)
  const telCrudo = isEnc ? '' : (p.numero ? String(p.numero) : '')
  const tel = telCrudo ? normalizePhone(telCrudo) : ''
  return {
    dni: p.dni || '',
    nombre: p.nombre || '—',
    telefono: tel || '—',
    email: p.email || ''
  }
}
const buildRowFromCalendarEvent = (e: any): any => {
  const tel = e.clientPhone ? normalizePhone(String(e.clientPhone).replace(/[^\d]/g, '')) : ''
  return {
    dni: e.clientDNI || '',
    nombre: `${e.clientName || ''} ${e.clientSurname || ''}`.trim() || '—',
    telefono: tel || '—',
    email: e.clientEmail || ''
  }
}

// Función pura idéntica a la del componente
function buildPacientesAgendadosBase(monthYYYYMM: string, sources: { wpp: any[]; fbig: any[]; events: any[] }): any[] {
  if (!monthYYYYMM) return []
  const wppBuilt = sources.wpp
    .filter((p: any) => p.fecha_agendamiento?.startsWith(monthYYYYMM))
    .map(buildPacienteRow)
  const fbigBuilt = sources.fbig
    .filter((p: any) => p.fecha_agendamiento?.startsWith(monthYYYYMM))
    .map(buildPacienteRow)

  const claves = new Set<string>()
  const wpp: any[] = []
  for (const r of wppBuilt) {
    const k = dedupKeyForAgendado(r)
    if (!claves.has(k)) { claves.add(k); wpp.push(r) }
  }
  const fbig: any[] = []
  for (const r of fbigBuilt) {
    const k = dedupKeyForAgendado(r)
    if (!claves.has(k)) { claves.add(k); fbig.push(r) }
  }
  const calendario: any[] = []
  for (const e of sources.events) {
    if (!String(e.date || '').startsWith(monthYYYYMM)) continue
    if (!eventoEsPacienteReal(e)) continue
    const r = buildRowFromCalendarEvent(e)
    const k = dedupKeyForAgendado(r)
    if (claves.has(k)) continue
    claves.add(k)
    calendario.push(r)
  }
  return [...wpp, ...fbig, ...calendario]
}

// ─── Tests ────────────────────────────────────────────────

describe('Bug 56 vs 15: dedup entre 3 fuentes', () => {
  it('una persona en las 3 tablas con DNI consistente cuenta 1', () => {
    const sources = {
      wpp:    [{ dni: '12345678', nombre: 'Ana Perez', numero: '999111222', fecha_agendamiento: '2026-05-01' }],
      fbig:   [{ dni: '12345678', nombre: 'Ana Perez', numero: '999111222', fecha_agendamiento: '2026-05-02' }],
      events: [{ clientDNI: '12345678', clientName: 'Ana', clientSurname: 'Perez', clientPhone: '999111222', date: '2026-05-03' }]
    }
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(1)
  })

  it('mismo paciente con telefono +51 en WPP y sin 51 en calendar → 1', () => {
    const sources = {
      wpp:    [{ nombre: 'Lorena Manco', numero: '51999111222', fecha_agendamiento: '2026-05-01' }],
      fbig:   [],
      events: [{ clientName: 'Lorena Manco', clientPhone: '999111222', date: '2026-05-03' }]
    }
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(1)
  })

  it('paciente WPP con telefono encriptado base64 → cae a name dedup', () => {
    const sources = {
      wpp:    [{ nombre: 'Jessica Camacho', numero: 'u5Bkps+uBQhtO+xuEE9b81yi1A==', fecha_agendamiento: '2026-05-01' }],
      fbig:   [],
      events: [{ clientName: 'Jessica', clientSurname: 'Camacho', date: '2026-05-03' }]
    }
    // Ambos sin DNI ni tel real → matchean por nombre completo
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(1)
  })

  it('eventos sin nombre/dni/tel (bloqueos) NO suman al conteo', () => {
    const sources = {
      wpp:    [{ nombre: 'Real', dni: '11111111', fecha_agendamiento: '2026-05-01' }],
      fbig:   [],
      events: [
        { subject: 'BLOQUEO',   date: '2026-05-02' },                  // sin paciente
        { subject: 'Reunion',   date: '2026-05-03' },                  // sin paciente
        { clientName: 'Otro',   date: '2026-05-04' }                   // este SÍ cuenta
      ]
    }
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(2)
  })

  it('escenario reportado por usuario: 56 inflado → 15 reales', () => {
    // Simulación: 15 pacientes únicos repartidos entre WPP+FBIG+calendar
    // pero 41 entradas duplicadas entre fuentes deberían colapsar.
    const pacientes = Array.from({ length: 15 }, (_, i) => ({
      dni: `1000000${i.toString().padStart(2, '0')}`,
      nombre: `Paciente ${i + 1}`,
      numero: `99000000${i}`,
    }))
    const sources = {
      // WPP: 15 pacientes
      wpp: pacientes.map(p => ({ ...p, fecha_agendamiento: '2026-05-01' })),
      // FBIG: los mismos 15 duplicados (con red social)
      fbig: pacientes.map(p => ({ ...p, fecha_agendamiento: '2026-05-02', red_social: 'instagram.com/' + p.nombre.toLowerCase() })),
      // Calendar: los mismos 15 con cita explícita + 26 bloqueos sin paciente
      events: [
        ...pacientes.map(p => ({
          clientDNI: p.dni, clientName: p.nombre.split(' ')[0],
          clientSurname: p.nombre.split(' ')[1], clientPhone: p.numero,
          date: '2026-05-03'
        })),
        ...Array.from({ length: 26 }, (_, i) => ({ subject: `BLOQUEO ${i}`, date: '2026-05-04' }))
      ]
    }
    // Sin la fix: 15 (WPP) + 15 (FBIG) + 15 (calendar con datos) + 26 (bloqueos) = 71 → fallaba
    // Con eventoEsPacienteReal y dedup en cascada: solo 15 únicos
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(15)
  })

  it('dos pacientes distintos sin DNI ni tel pero con mismo nombre → cuenta 1 (limitación conocida)', () => {
    const sources = {
      wpp: [
        { nombre: 'Paola Bermudez', fecha_agendamiento: '2026-05-01' },
        { nombre: 'Paola Bermudez', fecha_agendamiento: '2026-05-02' },  // sin datos diferenciadores
      ],
      fbig: [],
      events: []
    }
    // Ambas filas tienen la misma key 'name:paola bermudez' → se deduplican
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(1)
  })

  it('pacientes de meses distintos no se cuentan', () => {
    const sources = {
      wpp: [
        { dni: '11', nombre: 'A', fecha_agendamiento: '2026-04-15' },
        { dni: '22', nombre: 'B', fecha_agendamiento: '2026-05-10' },
        { dni: '33', nombre: 'C', fecha_agendamiento: '2026-06-01' },
      ],
      fbig: [],
      events: []
    }
    expect(buildPacientesAgendadosBase('2026-04', sources).length).toBe(1)
    expect(buildPacientesAgendadosBase('2026-05', sources).length).toBe(1)
    expect(buildPacientesAgendadosBase('2026-06', sources).length).toBe(1)
  })

  it('mes vacío devuelve 0', () => {
    expect(buildPacientesAgendadosBase('2026-05', { wpp: [], fbig: [], events: [] }).length).toBe(0)
    expect(buildPacientesAgendadosBase('', { wpp: [], fbig: [], events: [] }).length).toBe(0)
  })
})

describe('eventoEsPacienteReal', () => {
  it('evento sólo con subject (bloqueo) → false', () => {
    expect(eventoEsPacienteReal({ subject: 'BLOQUEO' })).toBe(false)
    expect(eventoEsPacienteReal({ subject: 'Reunion equipo' })).toBe(false)
  })
  it('evento con clientName → true', () => {
    expect(eventoEsPacienteReal({ clientName: 'Ana' })).toBe(true)
  })
  it('evento con sólo client_phone (snake_case) → true', () => {
    expect(eventoEsPacienteReal({ client_phone: '999111222' })).toBe(true)
  })
  it('evento con strings vacíos → false', () => {
    expect(eventoEsPacienteReal({ clientName: '', clientDNI: '', clientPhone: '' })).toBe(false)
  })
})

describe('normalizePhone', () => {
  it('quita prefijo 51 cuando length es 11', () => {
    expect(normalizePhone('51999111222')).toBe('999111222')
  })
  it('mantiene cuando no tiene 51', () => {
    expect(normalizePhone('999111222')).toBe('999111222')
  })
  it('limpia caracteres no numéricos', () => {
    expect(normalizePhone('+51 (999) 111-222')).toBe('999111222')
  })
})
