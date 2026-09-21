/**
 * POST /api/tradecars/inventario-ingresar
 *
 * Último paso del flujo "compra concretada -> inventario" acordado en la reunión de
 * septiembre/2026 con Trade Cars:
 *
 *   1. El asesor marca "Concretado" en Chatwoot.
 *   2. El funnel crea la fila en `tradecars_data_historico_compras` con verificado = false
 *      (server/utils/tradecars-compra-crm.ts).
 *   3. El administrador (Fabián) la revisa, completa lo que falte y...
 *   4. ...aprieta "Ingresar a inventario": este endpoint. NO es automático a propósito:
 *      "en el inventario solo se van a cargar los carros que Fabián ordene que se carguen",
 *      porque desde el CRM faltan campos y habría que llenarlos dos veces.
 *
 * Body: { accion: 'verificar' | 'ingresar', id: <uuid de la fila del histórico de compras> }
 *
 *  - verificar: marca la fila como revisada (verificado = true) sin tocar el inventario.
 *  - ingresar : verifica la fila Y crea (o vincula) el vehículo en `tradecars_vehiculos`.
 *
 * SOLO Administrador: es la puerta entre un dato del CRM y el stock con el que la empresa
 * vende. Es idempotente: ingresar dos veces la misma compra no duplica el vehículo.
 *
 * Al inventario pasan solo los datos comerciales (marca, modelo, año, placa, km, precios…),
 * no todas las 113 columnas del histórico.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { resolverPerfilTradeCars, exigirAdminTradeCars } from '../../utils/tradecars'
import { normalizarPlaca } from '../../utils/tradecars-compra-crm'

const texto = (v: any): string | null => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const primero = (...vs: any[]): string | null => {
  for (const v of vs) { const t = texto(v); if (t) return t }
  return null
}
const numero = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** "2015", "2014/2015", "MOD 2016" -> 2015 / 2014 / 2016. null si no hay un año razonable. */
function anioDe(...vs: any[]): number | null {
  for (const v of vs) {
    const m = String(v ?? '').match(/(?<!\d)(19[89]\d|20[0-4]\d)(?!\d)/)
    if (m) return Number(m[1])
  }
  return null
}

function transmisionDe(v: any): string | null {
  const s = sinAcentos(String(v ?? '')).toLowerCase()
  if (!s) return null
  if (s.includes('auto')) return 'automatica'
  if (s.includes('mec') || s.includes('manual')) return 'mecanica'
  return null
}

function combustibleDe(v: any): string | null {
  const s = sinAcentos(String(v ?? '')).toLowerCase().trim()
  if (!s) return null
  if (s.includes('gnv')) return 'gnv'
  if (s.includes('glp')) return 'glp'
  if (s.includes('hibrid')) return 'hibrido'
  if (s.includes('electric')) return 'electrico'
  if (s.includes('diesel') || s.includes('petrol')) return 'diesel'
  if (s.includes('gasolina') || s.includes('gasohol')) return 'gasolina'
  return null
}

/** Fecha YYYY-MM-DD desde ISO o DD/MM/YYYY. null si no se puede leer. */
function fechaDe(v: any): string | null {
  const s = texto(v)
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

/** Datos comerciales del vehículo, sacados de la fila del histórico de compras. */
function vehiculoDesdeCompra(c: any) {
  const disponible = /^si/i.test(sinAcentos(String(c.disponible_para_venta ?? '')).trim())
  return {
    codigo: texto(c.concat),
    marca: primero(c.marca, c.marca_2),
    modelo: primero(c.modelo, c.modelo_2),
    version: primero(c.version, c.version_2),
    anio: anioDe(c.ano, c.ano_fab),
    placa: normalizarPlaca(primero(c.placa, c.placa_ii, c.placa_iii)) || null,
    color: primero(c.color, c.color_2),
    kilometraje: numero(c.kilometraje) ?? numero(c.km),
    transmision: transmisionDe(primero(c.transmision, c.transmision_2)),
    combustible: combustibleDe(primero(c.tipo_de_combustible, c.combustible)),
    precio_compra: numero(c.valor_de_compra) ?? numero(c.precio_de_compra_valor_acta) ?? numero(c.valor_de_compra_2),
    precio_venta: numero(c.precio),
    // Recién comprado y con arreglos pendientes = en preparación, salvo que la fila ya diga lo contrario.
    estado: disponible ? 'disponible' : 'en_preparacion',
    propietario_nombre: primero(c.a_nombre_de, c.a_nombre_de_2),
    fecha_ingreso: fechaDe(c.fecha_de_compra) || fechaDe(c.fecha_compra) || hoyLima(),
    tipo_vehiculo: primero(c.tipo_de_vehiculo, c.tipo_de_vehiculo_2),
    asesor_compra: texto(c.asesor_comercial_comprador),
    caducidad_soat: fechaDe(c.vencimiento_soat),
    caducidad_rtv: fechaDe(c.vencimiento_de_rtv),
  }
}

const FALTA_MIGRACION =
  'Falta correr en Supabase el archivo sql/tradecars_funnel_v2_crm.sql (agrega las columnas que usa el ingreso a inventario).'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event) as any
  const perfil = await resolverPerfilTradeCars(event, supabase)
  exigirAdminTradeCars(perfil, 'el ingreso de compras al inventario')

  const body = await readBody(event).catch(() => ({} as any))
  const accion = String(body?.accion || '')
  const id = texto(body?.id)
  if (!['verificar', 'ingresar'].includes(accion)) {
    throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
  }
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la compra' })

  const { data: compra, error: errCompra } = await supabase
    .from('tradecars_data_historico_compras').select('*').eq('id', id).maybeSingle()
  if (errCompra) throw createError({ statusCode: 400, statusMessage: errCompra.message })
  if (!compra) throw createError({ statusCode: 404, statusMessage: 'La compra ya no existe' })

  const ahora = new Date().toISOString()
  const auditar = async (activity: string) => {
    try {
      await supabase.from('activity_logs').insert({ user_email: perfil.email, activity, company_id: 'tradecars' })
    } catch { /* el log nunca debe tumbar la operación */ }
  }
  const etiquetaCompra = `${compra.marca || ''} ${compra.modelo || ''} ${compra.placa || ''}`.replace(/\s+/g, ' ').trim()

  // Marca la fila como revisada (solo la primera vez: no pisa quién la verificó ni cuándo)
  const marcarVerificada = async (extra: Record<string, any> = {}) => {
    const cambios: Record<string, any> = { ...extra, actualizado_en: ahora, actualizado_por: perfil.email }
    if (compra.verificado !== true) {
      cambios.verificado = true
      cambios.verificado_por = perfil.email
      cambios.verificado_en = ahora
    }
    const { error } = await supabase.from('tradecars_data_historico_compras').update(cambios).eq('id', id)
    if (error) {
      const faltaMigracion = /verificado|inventario_vehiculo_id|ingresado_inventario/i.test(error.message || '')
      throw createError({ statusCode: faltaMigracion ? 409 : 400, statusMessage: faltaMigracion ? FALTA_MIGRACION : error.message })
    }
  }

  if (accion === 'verificar') {
    await marcarVerificada()
    await auditar(`Verificó la compra ${etiquetaCompra}`)
    return { ok: true, verificada: true }
  }

  /* ── ingresar ─────────────────────────────────────────────── */

  // Idempotente: si ya se ingresó y el vehículo sigue existiendo, no se crea otro.
  if (compra.inventario_vehiculo_id) {
    const { data: yaEsta } = await supabase
      .from('tradecars_vehiculos').select('id').eq('id', compra.inventario_vehiculo_id).maybeSingle()
    if (yaEsta) return { ok: true, ya_ingresado: true, vehiculo_id: yaEsta.id }
  }

  const v = vehiculoDesdeCompra(compra)
  const faltan = [
    !v.placa && 'placa',
    !v.marca && 'marca',
    !v.modelo && 'modelo',
  ].filter(Boolean) as string[]
  if (faltan.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Antes de ingresar a inventario completa en la compra: ${faltan.join(', ')}.`,
    })
  }

  const notas = compra.informacion_auto
    ? `Ingresado desde una compra concretada en el CRM. Lo que anotó el asesor: ${String(compra.informacion_auto).slice(0, 500)}`
    : null

  // ¿Ya hay un vehículo con esa placa? (cargado a mano antes de que existiera este flujo)
  const { data: existentes, error: errBuscar } = await supabase
    .from('tradecars_vehiculos').select('*').ilike('placa', v.placa)
  if (errBuscar) throw createError({ statusCode: 400, statusMessage: errBuscar.message })
  const existente = (existentes || []).find((x: any) => normalizarPlaca(x.placa) === v.placa) || null

  let vehiculoId: string
  let accionInv: 'creado' | 'vinculado'

  if (existente) {
    if (existente.historico_compra_id && existente.historico_compra_id !== id) {
      throw createError({
        statusCode: 409,
        statusMessage: `Ya hay un vehículo en inventario con la placa ${v.placa} que viene de otra compra.`,
      })
    }
    // Se vincula al que ya estaba y solo se completan los campos que tenía vacíos: lo que
    // alguien escribió a mano en el inventario nunca se pisa.
    const completar: Record<string, any> = { historico_compra_id: id, origen: existente.origen || 'compra_crm', updated_at: ahora }
    for (const [k, val] of Object.entries(v)) {
      if (val !== null && val !== undefined && (existente[k] === null || existente[k] === undefined || existente[k] === '')) {
        completar[k] = val
      }
    }
    const { error } = await supabase.from('tradecars_vehiculos').update(completar).eq('id', existente.id)
    if (error) {
      const falta = /historico_compra_id|origen/i.test(error.message || '')
      throw createError({ statusCode: falta ? 409 : 400, statusMessage: falta ? FALTA_MIGRACION : error.message })
    }
    vehiculoId = existente.id
    accionInv = 'vinculado'
  } else {
    const { data: nuevo, error } = await supabase
      .from('tradecars_vehiculos')
      .insert({ ...v, notas, historico_compra_id: id, origen: 'compra_crm' })
      .select('id').single()
    if (error) {
      const falta = /historico_compra_id|origen/i.test(error.message || '')
      throw createError({ statusCode: falta ? 409 : 400, statusMessage: falta ? FALTA_MIGRACION : error.message })
    }
    vehiculoId = nuevo.id
    accionInv = 'creado'
  }

  await marcarVerificada({
    inventario_vehiculo_id: vehiculoId,
    ingresado_inventario_en: ahora,
    ingresado_inventario_por: perfil.email,
  })
  await auditar(`Ingresó a inventario ${etiquetaCompra} (${accionInv})`)

  return { ok: true, vehiculo_id: vehiculoId, accion: accionInv }
})
