/**
 * Formularios de Instagram / Facebook / TikTok de Trade Cars — lógica PURA.
 *
 * Estos leads no llegan por la web de Trade Cars: Zapier los vuelca en un Google
 * Sheet por canal (uno para IG, uno para FB, uno para TikTok). El dashboard los lee
 * de ahí y los pinta como tarjetas, igual que las solicitudes web.
 *
 * NO sabemos de antemano qué columnas tiene cada hoja (la arma Zapier según el
 * formulario de Meta o de TikTok y las preguntas que tenga cada campaña). Por eso
 * las columnas se DETECTAN por el nombre del encabezado (español o inglés, con o
 * sin tildes, mayúsculas o guiones bajos) y cualquier columna que no se reconozca
 * NO se pierde: sale en el detalle de la tarjeta como "Otros datos". Si la
 * detección se equivoca, el administrador la corrige desde la pantalla (`mapeo`).
 *
 * Este archivo no toca red, ni base, ni Nitro: se puede probar suelto con node.
 */

export type CanalFormulario = 'ig' | 'fb' | 'tiktok'

export const CANALES_FORMULARIO: Record<CanalFormulario, { etiqueta: string; envId: string; envPestana: string }> = {
  ig: { etiqueta: 'Formularios IG', envId: 'TRADECARS_SHEET_IG_ID', envPestana: 'TRADECARS_SHEET_IG_TAB' },
  fb: { etiqueta: 'Formularios FB', envId: 'TRADECARS_SHEET_FB_ID', envPestana: 'TRADECARS_SHEET_FB_TAB' },
  tiktok: { etiqueta: 'Formularios TIKTOK', envId: 'TRADECARS_SHEET_TIKTOK_ID', envPestana: 'TRADECARS_SHEET_TIKTOK_TAB' },
}

export const esCanalFormulario = (v: any): v is CanalFormulario => v === 'ig' || v === 'fb' || v === 'tiktok'

/** Estados de una tarjeta. Son los mismos de "Quieren VENDER su auto" en Solicitudes web. */
export const ESTADOS_FORMULARIO = ['nuevo', 'contactado', 'tasado', 'comprado', 'descartado']

export const CAMPOS_FORMULARIO = [
  'lead_id', 'fecha', 'correo', 'celular', 'placa', 'nombre', 'campana',
  'marca', 'modelo', 'anio', 'kilometraje', 'distrito', 'tiene_deuda', 'mensaje',
] as const
export type CampoFormulario = typeof CAMPOS_FORMULARIO[number]

export const ETIQUETA_CAMPO: Record<CampoFormulario, string> = {
  lead_id: 'ID del lead', fecha: 'Fecha', correo: 'Correo', celular: 'Celular', placa: 'Placa',
  nombre: 'Nombre', campana: 'Campaña / formulario', marca: 'Marca', modelo: 'Modelo', anio: 'Año',
  kilometraje: 'Kilometraje', distrito: 'Distrito', tiene_deuda: '¿Tiene deuda?', mensaje: 'Mensaje',
}

/** Mayúsculas, tildes, espacios y símbolos no cuentan: "Número de Teléfono" == "numero_de_telefono". */
export function norm(v: any): string {
  return String(v ?? '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface ReglaCampo {
  /** Coincide con el encabezado ENTERO (ya normalizado). Es lo más fiable. */
  exacto: string[]
  /** Coincide si el encabezado CONTIENE esto. Solo se usa si no hubo coincidencia exacta. */
  contiene: string[]
  /** Encabezados que contienen esto NUNCA se toman para este campo (evita "campaign_name" como nombre). */
  excluye?: string[]
}

const REGLAS: Record<CampoFormulario, ReglaCampo> = {
  lead_id: {
    exacto: ['id', 'leadid', 'leadgenid', 'idlead', 'idleadgen', 'idformulario', 'submissionid', 'responseid'],
    contiene: [],
  },
  fecha: {
    exacto: ['fecha', 'created', 'createdtime', 'createdat', 'createtime', 'timestamp', 'date', 'fecharegistro',
      'fechadeenvio', 'marcatemporal', 'submittime', 'submittedat', 'fechacreacion', 'datecreated', 'fechayhora'],
    contiene: ['createdtime', 'createtime', 'fecha', 'timestamp', 'marcatemporal'],
  },
  correo: {
    exacto: ['correo', 'email', 'correoelectronico', 'mail', 'emailaddress'],
    contiene: ['correo', 'email', 'mail'],
  },
  celular: {
    exacto: ['celular', 'telefono', 'phone', 'phonenumber', 'numero', 'whatsapp', 'movil', 'tel', 'numerodetelefono',
      'numerodecelular', 'telefonocelular', 'numerocelular', 'contacto'],
    contiene: ['telefono', 'celular', 'phone', 'whatsapp', 'movil'],
  },
  placa: {
    exacto: ['placa', 'plate', 'licenseplate', 'numerodeplaca', 'placadelvehiculo', 'placadelauto'],
    contiene: ['placa', 'plate'],
  },
  nombre: {
    exacto: ['nombre', 'nombres', 'nombrecompleto', 'nombreyapellido', 'nombreyapellidos', 'fullname', 'name',
      'nombredelcliente', 'nombreapellido', 'nombrecontacto'],
    contiene: ['nombre', 'fullname'],
    excluye: ['campan', 'campaign', 'formul', 'formname', 'anuncio', 'adset', 'adname', 'vehic', 'auto', 'marca', 'modelo', 'conjunto'],
  },
  campana: {
    exacto: ['campana', 'campaign', 'campaignname', 'nombredelacampana', 'adname', 'nombredelanuncio', 'formname',
      'formulario', 'nombredelformulario', 'adsetname', 'anuncio'],
    contiene: ['campana', 'campaign'],
  },
  marca: {
    exacto: ['marca', 'brand', 'make', 'marcadelvehiculo', 'marcadelauto', 'marcavehiculo'],
    contiene: ['marca', 'brand'],
    excluye: ['campan', 'campaign'],
  },
  modelo: {
    exacto: ['modelo', 'model', 'modelodelvehiculo', 'modelodelauto'],
    contiene: ['modelo'],
  },
  anio: {
    exacto: ['anio', 'ano', 'year', 'aniodelvehiculo', 'anodelvehiculo', 'anodelauto', 'aniodefabricacion', 'anodefabricacion'],
    contiene: ['aniodel', 'anodel', 'aniofab', 'anofab', 'year'],
  },
  kilometraje: {
    exacto: ['kilometraje', 'km', 'kms', 'mileage', 'kilometrajeaproximado', 'kilometrajeactual'],
    contiene: ['kilometr', 'mileage'],
  },
  distrito: {
    exacto: ['distrito', 'district', 'ciudad', 'city', 'ubicacion', 'zona', 'localidad', 'distritodondevive'],
    contiene: ['distrito', 'ubicacion'],
  },
  tiene_deuda: {
    exacto: ['deuda', 'tienedeuda', 'tienedeudas', 'prenda', 'gravamen'],
    contiene: ['deuda', 'prenda', 'gravamen'],
  },
  mensaje: {
    exacto: ['mensaje', 'message', 'comentarios', 'comentario', 'comments', 'observaciones', 'notas', 'detalle'],
    contiene: ['mensaje', 'comentario', 'observ'],
  },
}

/** Índices de columna por campo (puede haber varias: "Nombre" + "Apellido" se juntan). */
export type MapeoColumnas = Record<CampoFormulario, number[]>

const vacioMapeo = (): MapeoColumnas =>
  Object.fromEntries(CAMPOS_FORMULARIO.map(c => [c, [] as number[]])) as MapeoColumnas

/**
 * Decide qué columna de la hoja es cada campo.
 *
 * `override` es lo que el administrador corrigió a mano: campo → texto del encabezado
 * (varios encabezados separados por "|" se juntan con un espacio; "" o "-" = ninguno).
 * Lo corregido a mano manda siempre sobre la detección automática.
 */
export function detectarMapeo(encabezados: string[], override: Record<string, string> = {}): MapeoColumnas {
  const mapeo = vacioMapeo()
  const hn = encabezados.map(norm)
  const usadas = new Set<number>()

  // 1. Lo que el administrador fijó a mano
  for (const campo of CAMPOS_FORMULARIO) {
    if (!(campo in override)) continue
    const partes = String(override[campo] ?? '').split('|').map(s => s.trim()).filter(Boolean)
    for (const p of partes) {
      const i = hn.indexOf(norm(p))
      if (i >= 0 && !usadas.has(i)) { mapeo[campo].push(i); usadas.add(i) }
    }
  }
  const fijados = new Set(CAMPOS_FORMULARIO.filter(c => c in override))

  // 2. Detección automática, en orden de prioridad, sin repetir columna
  for (const campo of CAMPOS_FORMULARIO) {
    if (fijados.has(campo)) continue
    const r = REGLAS[campo]
    let mejor = -1
    let mejorPuntaje = 0
    hn.forEach((h, i) => {
      if (!h || usadas.has(i)) return
      let p = 0
      if (r.exacto.includes(h)) p = 3
      else if (r.contiene.some(c => h.includes(c)) && !(r.excluye || []).some(x => h.includes(x))) p = 2
      if (p > mejorPuntaje) { mejorPuntaje = p; mejor = i }   // a igual puntaje gana la columna de más a la izquierda
    })
    if (mejor >= 0) { mapeo[campo].push(mejor); usadas.add(mejor) }
  }

  // 3. Nombre partido en dos columnas ("Nombres" + "Apellidos", "first_name" + "last_name")
  if (!fijados.has('nombre')) {
    const primero = hn.findIndex((h, i) => !usadas.has(i) && ['firstname', 'nombres', 'primernombre'].includes(h))
    const ultimo = hn.findIndex((h, i) => !usadas.has(i) && ['lastname', 'apellidos', 'apellido', 'surname'].includes(h))
    if (mapeo.nombre.length === 0 && primero >= 0) {
      mapeo.nombre.push(primero); usadas.add(primero)
      if (ultimo >= 0) { mapeo.nombre.push(ultimo); usadas.add(ultimo) }
    } else if (mapeo.nombre.length === 1 && ultimo >= 0 && ['nombre', 'nombres', 'firstname', 'primernombre'].includes(hn[mapeo.nombre[0]])) {
      mapeo.nombre.push(ultimo); usadas.add(ultimo)
    }
  }
  return mapeo
}

/** Devuelve el mapeo como campo → texto del encabezado, para mostrarlo y guardarlo. */
export function mapeoATexto(mapeo: MapeoColumnas, encabezados: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of CAMPOS_FORMULARIO) {
    if (mapeo[c].length) out[c] = mapeo[c].map(i => String(encabezados[i] ?? '').trim()).join('|')
  }
  return out
}

/* ══════════════════════════ Limpieza de valores ══════════════════════════ */

const texto = (v: any): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).trim()
}

/** Meta guarda el teléfono como "p:+51987654321". Se deja "+51987654321"; sin dígitos → vacío. */
export function limpiarCelular(v: any): string {
  let s = texto(v).replace(/^p:\s*/i, '')
  const mas = s.trim().startsWith('+')
  s = s.replace(/[^\d]/g, '')
  if (s.length < 6) return ''
  return mas ? `+${s}` : s
}

export function limpiarAnio(v: any): number | null {
  const m = /\b(19[5-9]\d|20\d{2})\b/.exec(texto(v))
  return m ? Number(m[1]) : null
}

/** "85,000", "85.000", "85000 km" → 85000. Texto como "85 mil" NO se interpreta (devuelve null). */
export function limpiarKilometraje(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null
  const s = texto(v).toLowerCase().replace(/km[s]?\.?/g, '').trim()
  if (!s || !/^[\d.,\s]+$/.test(s)) return null
  const digitos = s.replace(/[^\d]/g, '')
  return digitos ? Number(digitos) : null
}

export function limpiarDeuda(v: any): string {
  const s = norm(v)
  if (!s) return ''
  if (['si', 'yes', 'true', 'verdadero', '1'].includes(s)) return 'si'
  if (['no', 'false', 'falso', '0', 'nolotiene', 'sindeuda', 'ninguna'].includes(s)) return 'no'
  return texto(v)
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Fecha del lead → ISO con offset de Lima (UTC-5), o null.
 *
 *  · número de Sheets (días desde 1899-12-30): la hoja lo guardó como fecha y no trae zona horaria;
 *    se asume la hora de Lima, que es donde trabaja el equipo.
 *  · texto ISO ("2026-09-22T14:33:12-0500", lo que escribe Meta vía Zapier): se respeta su zona.
 *  · "22/09/2026 14:33[:12]": día primero (formato peruano). Si el 2.º número es mayor que 12, es mes/día.
 */
export function limpiarFecha(v: any): string | null {
  if (v === null || v === undefined || v === '') return null

  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null        // no parece una fecha de Sheets (1954–2119)
    const ms = Date.UTC(1899, 11, 30) + Math.round(v * 86400000)
    const d = new Date(ms)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}-05:00`
  }

  const s = texto(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    // Sin zona explícita se toma como hora de Lima; con zona ("Z", "-0500", "+00:00") se respeta.
    const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(s)
    const t = conZona ? s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2') : `${s.replace(' ', 'T')}-05:00`
    const d = new Date(t)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s)
  if (m) {
    let a = Number(m[1]), b = Number(m[2])
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
    if (b > 12 && a <= 12) [a, b] = [b, a]          // venía mes/día
    if (a < 1 || a > 31 || b < 1 || b > 12) return null
    return `${y}-${pad(b)}-${pad(a)}T${pad(Number(m[4] || 0))}:${m[5] || '00'}:${m[6] || '00'}-05:00`
  }
  return null
}

/** Hash de 53 bits (cyrb53), en hexadecimal. Sirve de clave estable: no es criptográfico ni lo necesita. */
export function hashClave(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/* ══════════════════════════ Hoja → tarjetas ══════════════════════════ */

export interface LeadFormulario {
  /** Identidad estable del lead: NO es el n.º de fila, porque las filas se mueven si alguien ordena o borra. */
  lead_key: string
  fila: number
  fecha: string | null
  nombre: string
  celular: string
  correo: string
  marca: string
  modelo: string
  anio: number | null
  placa: string
  kilometraje: number | null
  distrito: string
  tiene_deuda: string
  mensaje: string
  campana: string
  lead_id: string
  /** Columnas que no se reconocieron (preguntas propias del formulario). Nada se descarta. */
  extras: { campo: string; valor: string }[]
}

export interface ResultadoHoja {
  leads: LeadFormulario[]
  mapeo: Record<string, string>
  /** Encabezados que no se asignaron a ningún campo. */
  sin_mapear: string[]
  total_filas: number
  filas_omitidas: number
}

/**
 * Convierte lo que devuelve Google Sheets (`values`: filas × columnas, la primera es el
 * encabezado) en tarjetas. Las filas vacías se omiten; el orden es el más reciente primero.
 */
export function hojaALeads(
  valores: any[][],
  override: Record<string, string> = {},
  canal: CanalFormulario | string = '',
): ResultadoHoja {
  // El encabezado es la primera fila con al menos 2 celdas llenas (por si arriba hay un título suelto)
  const filas = valores || []
  let filaEnc = filas.findIndex(f => (f || []).filter(c => texto(c) !== '').length >= 2)
  if (filaEnc < 0) filaEnc = 0
  const encabezados = ((filas[filaEnc] as any[]) || []).map(c => texto(c))
  const cuerpo = filas.slice(filaEnc + 1)
  const mapeo = detectarMapeo(encabezados, override)
  const mapeadas = new Set(Object.values(mapeo).flat())

  const celda = (fila: any[], campo: CampoFormulario): any => {
    const idx = mapeo[campo]
    if (!idx.length) return ''
    if (idx.length === 1) return fila[idx[0]] ?? ''
    return idx.map(i => texto(fila[i])).filter(Boolean).join(' ')
  }

  const leads: LeadFormulario[] = []
  const vistos = new Map<string, number>()
  let omitidas = 0

  cuerpo.forEach((fila, k) => {
    fila = fila || []
    const numFila = filaEnc + 2 + k                      // n.º de fila real en la hoja (1-based)
    if (!fila.some(c => texto(c) !== '')) return

    const nombre = texto(celda(fila, 'nombre'))
    const celular = limpiarCelular(celda(fila, 'celular'))
    const correo = texto(celda(fila, 'correo'))
    const leadId = texto(celda(fila, 'lead_id'))
    const fechaRaw = celda(fila, 'fecha')
    const fecha = limpiarFecha(fechaRaw)

    // Sin ningún dato de contacto ni ID, la fila no es un lead (una nota suelta, una suma…)
    if (!nombre && !celular && !correo && !leadId) { omitidas++; return }

    const extras: { campo: string; valor: string }[] = []
    encabezados.forEach((enc, i) => {
      if (mapeadas.has(i) || !enc) return
      const v = texto(fila[i])
      if (v) extras.push({ campo: enc, valor: v })
    })

    // Valores que no se pudieron interpretar no se pierden: pasan a "Otros datos"
    const kmRaw = celda(fila, 'kilometraje')
    const km = limpiarKilometraje(kmRaw)
    if (km === null && texto(kmRaw)) extras.push({ campo: 'Kilometraje', valor: texto(kmRaw) })
    const anioRaw = celda(fila, 'anio')
    const anio = limpiarAnio(anioRaw)
    if (anio === null && texto(anioRaw)) extras.push({ campo: 'Año', valor: texto(anioRaw) })
    if (fecha === null && texto(fechaRaw)) extras.push({ campo: 'Fecha (texto)', valor: texto(fechaRaw) })

    // Clave estable: el ID del formulario si existe; si no, los datos que identifican al lead
    const base = leadId
      ? `id:${leadId}`
      : `h:${hashClave([canal, fecha || texto(fechaRaw), celular.replace(/\D/g, ''), correo.toLowerCase(), norm(nombre)].join('|'))}`
    const n = (vistos.get(base) || 0) + 1
    vistos.set(base, n)

    leads.push({
      lead_key: n === 1 ? base : `${base}#${n}`,     // dos filas idénticas siguen siendo dos tarjetas
      fila: numFila,
      fecha,
      nombre,
      celular,
      correo,
      marca: texto(celda(fila, 'marca')),
      modelo: texto(celda(fila, 'modelo')),
      anio,
      placa: texto(celda(fila, 'placa')).toUpperCase(),
      kilometraje: km,
      distrito: texto(celda(fila, 'distrito')),
      tiene_deuda: limpiarDeuda(celda(fila, 'tiene_deuda')),
      mensaje: texto(celda(fila, 'mensaje')),
      campana: texto(celda(fila, 'campana')),
      lead_id: leadId,
      extras,
    })
  })

  // Más reciente primero. Sin fecha reconocible, manda el orden de la hoja (Zapier agrega al final).
  leads.sort((a, b) => {
    if (a.fecha && b.fecha) return b.fecha.localeCompare(a.fecha) || b.fila - a.fila
    if (a.fecha) return -1
    if (b.fecha) return 1
    return b.fila - a.fila
  })

  return {
    leads,
    mapeo: mapeoATexto(mapeo, encabezados),
    sin_mapear: encabezados.filter((h, i) => h && !mapeadas.has(i)),
    total_filas: cuerpo.length,
    filas_omitidas: omitidas,
  }
}

/** "https://docs.google.com/spreadsheets/d/<ID>/edit#gid=123" (o solo el ID) → { sheetId, gid }. */
export function extraerReferenciaHoja(entrada: string): { sheetId: string; gid: number | null } | null {
  const s = String(entrada ?? '').trim()
  if (!s) return null
  const url = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(s)
  if (url) {
    const gid = /[#?&]gid=(\d+)/.exec(s)
    return { sheetId: url[1], gid: gid ? Number(gid[1]) : null }
  }
  // Un ID suelto: solo letras, números, guion y guion bajo, y largo como los de Google
  return /^[a-zA-Z0-9_-]{25,}$/.test(s) ? { sheetId: s, gid: null } : null
}
