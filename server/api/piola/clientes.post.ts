/**
 * POST /api/piola/clientes — registro maestro de clientes (reunión 31/08/2026)
 *
 * Body:
 *   { accion: 'guardar',        id?, nombre, tipo_documento?, ruc?, dni?, ... }
 *   { accion: 'buscar_por_ruc', ruc }
 *   { accion: 'eliminar',       id }
 *
 * POR QUÉ EXISTE ESTE MÓDULO — Edson Polo, 31/08/2026:
 *   "yo estaba pensando que haya un módulo donde yo registre a los clientes,
 *    registro y en este registro inserta el contrato, las condiciones, anexos,
 *    etcétera, DNI, etcétera, ficha RUC […] Y en ese otro módulo donde se emiten
 *    las facturas haya un desplegable […] Ya sale en automático. Ya no estoy
 *    llenando manualmente cada cosa. Solamente lo que tendría que poner es la
 *    serie y el número."
 *
 * Es decir: la ficha del cliente se llena UNA vez acá y la factura la lee. Eso
 * ya funciona del otro lado — `factura.post.ts` acepta `cliente_id` y mezcla la
 * fila de `piola_clientes` sobre el formulario —, así que lo que faltaba era
 * este registro completo y una búsqueda por RUC que lo dispare.
 *
 * EL AUTOCOMPLETADO ES CONTRA LA BASE INTERNA, NO CONTRA SUNAT.
 * Edson descartó la integración expresamente: "lo de conectar este sistema con
 * SUNAT, yo creo que eso no lo vamos a hacer, nosotros solo vamos a vaciar
 * información aquí". `buscar_por_ruc` consulta `piola_clientes` y nada más: no
 * hay ninguna llamada a SUNAT, RENIEC ni a ningún servicio externo.
 *
 * EL CONTRATO VIVE ACÁ, NO EN LA FACTURA. Raysa propuso adjuntar el contrato en
 * cada comprobante y Edson lo rechazó ("si en cada factura que hagamos no vamos
 * a adjuntar el contrato, imagínate, mucho trabajo operativo"). Por eso los
 * documentos del cliente (ficha RUC, DNI, contrato, anexos) cuelgan del cliente
 * —`ficha_ruc_pdf` acá y `piola_adjuntos` con `entidad='cliente'`— y este
 * endpoint no toca `piola_invoices`.
 *
 * PERMISOS: `exigirAlguno(['crm','produccion','facturacion'])`. `piola_clientes`
 * la escriben tres pantallas (CRM al convertir un lead, Producción al mantener
 * la ficha de la marca, y ahora Facturación al registrar al cliente que va a
 * facturar). Exigir un módulo concreto le quitaría el acceso a las otras dos, y
 * el servidor no puede saber desde cuál se llamó — eso lo diría el navegador,
 * que es justo lo que no se cree. Está documentado en `server/utils/piola.ts`.
 *
 * `lead_id` NO se acepta del body a propósito: lo escribe `crm.post.ts` al
 * convertir un lead y es la única trazabilidad de dónde salió el cliente.
 * Dejarlo editable permitiría reasignar un cliente a otro lead desde la ficha.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAlguno } from '../../utils/piola'
import { esRucValido } from '../../../composables/rules'
import type { PiolaModule } from '../../../utils/permissions'

/** Módulos que pueden mantener la ficha del cliente. Ver el bloque de arriba. */
const MODULOS_CLIENTE: PiolaModule[] = ['crm', 'produccion', 'facturacion']

/** Mismo CHECK que `piola_clientes.tipo_documento` en sql/piola_reunion_31ago.sql. */
const TIPOS_DOCUMENTO = ['RUC', 'DNI', 'CE', 'PAS']

/**
 * Campos descriptivos: se copian tal cual, ninguno cambia una validación.
 * Se escriben SOLO si vienen en el body, para que una edición parcial (cambiar
 * el teléfono desde una pantalla reducida) no borre lo que no mandó.
 */
const CAMPOS_TEXTO = [
  'razon_social', 'contacto', 'contacto_cargo', 'telefono', 'email',
  'email_facturacion', 'direccion', 'direccion_fiscal',
  'condiciones', 'condicion_pago', 'ficha_ruc_pdf', 'detraccion_codigo', 'notas',
]

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}
const numero = (v: any) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * El RUC se guarda SIEMPRE como 11 dígitos pelados.
 * Es la llave con la que la factura autocompleta al cliente: si una ficha
 * quedara con "20 601 234 567" y otra con "20601234567", el índice único no las
 * ve como iguales y el desplegable de facturación muestra el cliente duplicado.
 */
const soloDigitos = (v: any) => {
  const s = String(v ?? '').replace(/\D/g, '')
  return s || null
}

/** Quién tiene ya ese RUC (para el mensaje de duplicado). */
async function duenioDelRuc(supabase: any, ruc: string, exceptoId: number | null) {
  let q = supabase.from('piola_clientes').select('id, nombre, razon_social').eq('ruc', ruc)
  if (exceptoId) q = q.neq('id', exceptoId)
  const { data } = await q.limit(1)
  return (data || [])[0] || null
}

/**
 * "duplicate key value violates unique constraint idx_piola_clientes_ruc" no le
 * dice nada a quien está llenando la ficha. Se traduce nombrando al cliente que
 * ya lo tiene, que es lo que de verdad necesita saber (probablemente lo tiene
 * que editar, no crear otro).
 */
function mensajeRucDuplicado(ruc: string, otro: any): string {
  const quien = otro?.razon_social || otro?.nombre
  return quien
    ? `El RUC ${ruc} ya está registrado como ${quien}`
    : `El RUC ${ruc} ya está registrado en otro cliente`
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Alta o edición de la ficha del cliente ══════════ */
  if (accion === 'guardar') {
    const id = Number(body?.id) || null
    exigirAlguno(perfil, MODULOS_CLIENTE, id ? 'edit' : 'create')

    // En una edición se necesita la fila actual para dos cosas: devolver 404 en
    // vez de escribir en el vacío, y validar el documento contra los valores
    // EFECTIVOS (el body puede traer sólo el RUC y el tipo venir de la base).
    let actual: any = null
    if (id) {
      const { data } = await supabase.from('piola_clientes').select('*').eq('id', id).maybeSingle()
      if (!data) throw createError({ statusCode: 404, statusMessage: 'El cliente no existe' })
      actual = data
    }

    const patch: Record<string, any> = {}

    if (!id || 'nombre' in body) {
      const nombre = texto(body?.nombre)
      if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El cliente necesita un nombre' })
      patch.nombre = nombre
    }

    for (const k of CAMPOS_TEXTO) if (k in body) patch[k] = texto(body[k])

    if ('tipo_documento' in body) {
      const td = texto(body.tipo_documento)
      if (td && !TIPOS_DOCUMENTO.includes(td)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Tipo de documento inválido: ${td}. Válidos: ${TIPOS_DOCUMENTO.join(', ')}`,
        })
      }
      // null es válido y significa "todavía no tiene documento": una marca puede
      // registrarse en Producción antes de que Edson tenga su ficha RUC.
      patch.tipo_documento = td
    }
    if ('ruc' in body) patch.ruc = soloDigitos(body.ruc)
    if ('dni' in body) patch.dni = texto(body.dni)

    if ('detraccion_pct' in body) {
      const pct = numero(body.detraccion_pct)
      if (pct !== null && (pct < 0 || pct > 100)) {
        throw createError({ statusCode: 400, statusMessage: 'El % de detracción va entre 0 y 100' })
      }
      patch.detraccion_pct = pct
    }
    if ('compromiso_mensual' in body) {
      patch.compromiso_mensual = Math.max(0, Math.trunc(numero(body.compromiso_mensual) ?? 0))
    }
    if ('activo' in body) patch.activo = !!body.activo

    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    // ── Coherencia del documento, sobre los valores efectivos ──
    const tipoDoc = 'tipo_documento' in patch ? patch.tipo_documento : (actual?.tipo_documento ?? 'RUC')
    const ruc = 'ruc' in patch ? patch.ruc : soloDigitos(actual?.ruc)
    const dni = 'dni' in patch ? patch.dni : texto(actual?.dni)

    if (tipoDoc === 'RUC') {
      // Sin RUC de 11 dígitos la factura no se puede emitir (factura.post.ts lo
      // vuelve a exigir al emitir): mejor frenar acá, cuando se está llenando la
      // ficha, que en la pantalla de facturación con el cliente esperando.
      if (!ruc) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Un cliente marcado como RUC necesita el número de RUC (11 dígitos). '
            + 'Si todavía no lo tienes, deja el tipo de documento en blanco.',
        })
      }
      if (!esRucValido(ruc)) {
        throw createError({
          statusCode: 400,
          statusMessage: `El RUC debe tener 11 dígitos (llegaron ${ruc.length}: ${ruc})`,
        })
      }
    }
    if (tipoDoc === 'DNI' && dni && !/^\d{8}$/.test(dni)) {
      throw createError({ statusCode: 400, statusMessage: `El DNI debe tener 8 dígitos (llegó: ${dni})` })
    }

    // Pre-chequeo del duplicado para dar el nombre del que ya lo tiene. El catch
    // de abajo cubre la carrera entre dos pestañas guardando a la vez: el índice
    // único de la base es el que de verdad manda.
    if (ruc) {
      const otro = await duenioDelRuc(supabase, ruc, id)
      if (otro) throw createError({ statusCode: 409, statusMessage: mensajeRucDuplicado(ruc, otro) })
    }

    const res = id
      ? await supabase.from('piola_clientes').update(patch).eq('id', id).select('*').maybeSingle()
      : await supabase.from('piola_clientes').insert(patch).select('*').single()

    if (res.error) {
      if (res.error.code === '23505' && ruc) {
        const otro = await duenioDelRuc(supabase, ruc, id)
        throw createError({ statusCode: 409, statusMessage: mensajeRucDuplicado(ruc, otro) })
      }
      throw createError({ statusCode: 400, statusMessage: res.error.message })
    }

    return { ok: true, cliente: res.data, creado: !id }
  }

  /* ══════════ Búsqueda por RUC — dispara el autocompletado de la factura ══════════ */
  if (accion === 'buscar_por_ruc') {
    exigirAlguno(perfil, MODULOS_CLIENTE, 'view')

    const ruc = soloDigitos(body?.ruc)
    if (!ruc) throw createError({ statusCode: 400, statusMessage: 'Falta el RUC a buscar' })

    const { data, error } = await supabase.from('piola_clientes')
      .select('*').eq('ruc', ruc).limit(1)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    let cliente = (data || [])[0] || null

    // Rescate de las fichas viejas: `produccion.guardar_cliente` guardaba el RUC
    // tal cual lo tipeaban, así que en la base puede haber "20601234567 " o
    // "20-601234567" y el `.eq` no los ve. Sólo se paga este barrido cuando la
    // búsqueda exacta falla, y la cartera de Piola son decenas de clientes.
    if (!cliente) {
      const { data: candidatos } = await supabase.from('piola_clientes')
        .select('*').not('ruc', 'is', null).order('id').range(0, 999)
      cliente = (candidatos || []).find((c: any) => soloDigitos(c.ruc) === ruc) || null
    }

    return { ok: true, encontrado: !!cliente, cliente }
  }

  /* ══════════ Baja del cliente — SIEMPRE lógica ══════════ */
  if (accion === 'eliminar') {
    exigirAlguno(perfil, MODULOS_CLIENTE, 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el cliente a eliminar' })

    // NO se borra en duro. `piola_invoices.cliente_id` y
    // `piola_transactions.cliente_id` son ON DELETE SET NULL: borrar al cliente
    // dejaría las facturas y los cobros de años anteriores sin a quién
    // atribuirlos, y ese histórico es contabilidad, no una lista de contactos.
    // (Y `piola_deliverables` sí es CASCADE: se llevaría la producción entera.)
    const { data, error } = await supabase.from('piola_clientes')
      .update({ activo: false }).eq('id', id).select('id, nombre, activo').maybeSingle()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    if (!data) throw createError({ statusCode: 404, statusMessage: 'El cliente no existe' })

    // Se informa lo que quedó colgando para que la pantalla pueda explicar por
    // qué el cliente sigue apareciendo en los reportes históricos.
    const [{ count: facturas }, { count: movimientos }] = await Promise.all([
      supabase.from('piola_invoices').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
      supabase.from('piola_transactions').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
    ])

    return {
      ok: true,
      desactivado: true,
      cliente: data,
      conserva: { facturas: facturas || 0, movimientos: movimientos || 0 },
    }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
