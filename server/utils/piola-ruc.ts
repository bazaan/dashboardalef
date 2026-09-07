/**
 * PIOLA — Consulta de RUC para autocompletar la ficha del cliente.
 *
 * SUNAT no publica una API abierta: lo que existe son pasarelas que consultan
 * por uno (apis.net.pe, apiperu.dev, decolecta, factiliza). Todas hablan HTTP
 * con un token y devuelven casi el mismo JSON con nombres de campo distintos.
 *
 * Por eso el proveedor es CONFIGURACIÓN, no código:
 *   PIOLA_RUC_API_URL    plantilla de la URL, con {ruc} donde va el número
 *   PIOLA_RUC_API_TOKEN  el token (viaja como Bearer, o como ?token= si la URL
 *                        ya trae {token})
 *
 * Sin esas variables la consulta no rompe nada: devuelve `configurado: false` y
 * la pantalla sigue dejando escribir los datos a mano. Es lo mismo que ya hace
 * la facturación cuando no hay credenciales del PSE.
 */

export interface DatosRuc {
  ruc: string
  razon_social: string | null
  nombre_comercial: string | null
  estado: string | null            // ACTIVO / BAJA DE OFICIO / SUSPENSIÓN TEMPORAL
  condicion: string | null         // HABIDO / NO HABIDO
  direccion: string | null
  distrito: string | null
  provincia: string | null
  departamento: string | null
  crudo: any
}

/** Un RUC peruano son 11 dígitos y empieza en 10, 15, 16, 17 o 20. */
export function rucValido(ruc: string): boolean {
  const s = String(ruc || '').trim()
  return /^\d{11}$/.test(s) && ['10', '15', '16', '17', '20'].includes(s.slice(0, 2))
}

const primero = (obj: any, claves: string[]): string | null => {
  for (const k of claves) {
    const v = obj?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

/**
 * Normaliza la respuesta del proveedor a una forma sola.
 *
 * Cada pasarela nombra los campos a su manera (`razonSocial`, `razon_social`,
 * `nombre`); acá se prueban todas las variantes conocidas en vez de casarse
 * con una, que es lo que obligaría a tocar código al cambiar de proveedor.
 */
export function normalizarRespuestaRuc(ruc: string, json: any): DatosRuc {
  const d = json?.data && typeof json.data === 'object' ? json.data : json
  const dir = primero(d, ['direccion', 'direccion_completa', 'domicilio_fiscal', 'address'])
  const via = primero(d, ['direccion_simple', 'via_nombre'])

  return {
    ruc,
    razon_social: primero(d, ['razonSocial', 'razon_social', 'nombre_o_razon_social', 'nombre', 'name']),
    nombre_comercial: primero(d, ['nombreComercial', 'nombre_comercial', 'tradeName']),
    estado: primero(d, ['estado', 'estado_del_contribuyente', 'status']),
    condicion: primero(d, ['condicion', 'condicion_de_domicilio', 'condition']),
    direccion: dir || via,
    distrito: primero(d, ['distrito', 'district']),
    provincia: primero(d, ['provincia', 'province']),
    departamento: primero(d, ['departamento', 'department']),
    crudo: d ?? null,
  }
}

export interface ResultadoRuc {
  configurado: boolean
  encontrado: boolean
  datos: DatosRuc | null
  aviso?: string
  error?: string
}

/**
 * Consulta un RUC contra el proveedor configurado.
 *
 * NUNCA lanza: una consulta caída no puede impedir dar de alta un cliente. El
 * peor caso es que la persona escriba la razón social a mano, que es lo que
 * hace hoy.
 */
export async function consultarRuc(ruc: string): Promise<ResultadoRuc> {
  const numero = String(ruc || '').replace(/\D/g, '')
  if (!rucValido(numero)) {
    return { configurado: true, encontrado: false, datos: null, error: 'El RUC debe tener 11 dígitos y empezar en 10, 15, 16, 17 o 20' }
  }

  const plantilla = process.env.PIOLA_RUC_API_URL
  const token = process.env.PIOLA_RUC_API_TOKEN || ''
  if (!plantilla) {
    return {
      configurado: false, encontrado: false, datos: null,
      aviso: 'La consulta automática de RUC no está configurada (PIOLA_RUC_API_URL / PIOLA_RUC_API_TOKEN). '
           + 'Los datos se pueden escribir a mano.',
    }
  }

  const url = plantilla.replace('{ruc}', numero).replace('{token}', encodeURIComponent(token))
  const headers: Record<string, string> = { Accept: 'application/json' }
  // Si el token ya viaja en la URL no se manda además en el header: hay
  // pasarelas que rechazan el request cuando llegan las dos formas.
  if (token && !plantilla.includes('{token}')) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(url, {
      headers,
      // Un proveedor lento no puede dejar colgado el alta de un cliente
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) {
      return { configurado: true, encontrado: false, datos: null, aviso: `El RUC ${numero} no figura en el padrón` }
    }
    if (!res.ok) {
      return { configurado: true, encontrado: false, datos: null, error: `El servicio de RUC respondió ${res.status}` }
    }

    const json: any = await res.json()
    const datos = normalizarRespuestaRuc(numero, json)
    if (!datos.razon_social) {
      return { configurado: true, encontrado: false, datos: null, aviso: `El RUC ${numero} no devolvió razón social` }
    }
    return { configurado: true, encontrado: true, datos }
  } catch (e: any) {
    const esTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return {
      configurado: true, encontrado: false, datos: null,
      error: esTimeout ? 'El servicio de RUC no respondió a tiempo' : (e?.message || 'error de red'),
    }
  }
}
