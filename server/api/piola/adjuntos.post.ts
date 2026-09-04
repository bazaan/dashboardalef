/**
 * POST /api/piola/adjuntos — adjuntos múltiples (reunión 31/08/2026)
 *
 * Body:
 *   { accion: 'listar', entidad, entidad_id }             → los de una fila
 *   { accion: 'listar', entidad, entidad_ids: number[] }  → los de varias, para una tabla
 *   { accion: 'agregar', entidad, entidad_id, nombre, path, tipo_doc?, peso_bytes? }
 *   { accion: 'eliminar', id }
 *
 * POR QUÉ EXISTE: hasta ahora un movimiento tenía UN documento
 * (`piola_transactions.comprobante_url`). Edson: "¿te puedes subir más de un
 * documento?… hazlo para más porque ahí también vamos a juntar lo que es la
 * detracción en muchos casos". La factura, la constancia de detracción y el
 * voucher son tres papeles del mismo movimiento y antes había que elegir uno.
 *
 * EL ARCHIVO NO PASA POR ACÁ. El navegador lo sube al bucket `piola-docs` con
 * la sesión de Supabase (igual que `PiolaSubirPdf.vue`) y este endpoint sólo
 * registra el vínculo. Mandar el binario en el body obligaría a subirlo dos
 * veces —navegador → función → Storage— con el límite de payload de la función
 * de por medio, que es justo lo que rompería un PDF grande.
 *
 * PERMISO POR ENTIDAD, no uno solo: `piola_adjuntos` es polimórfica y guarda
 * desde el anexo de un contrato hasta el voucher de una boleta de pago. Pedir
 * 'contabilidad' para todo dejaría a Producción sin poder adjuntar a un
 * entregable, y —peor— dejaría los documentos de una boleta al alcance de
 * cualquiera con permiso de contabilidad. Por eso los payslips exigen
 * Administrador, igual que la tabla que documentan.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAlguno, exigirAdmin } from '../../utils/piola'
import type { PerfilPiola } from '../../utils/piola'
import type { PiolaModule } from '../../../utils/permissions'

/** Mismo CHECK que la columna `entidad` en la migración. */
const ENTIDADES = [
  'transaction', 'invoice', 'pago', 'cliente', 'contrato', 'deliverable', 'payslip',
] as const
type Entidad = typeof ENTIDADES[number]

/** Mismo CHECK que la columna `tipo_doc`. 'detraccion' es el que pidió Edson. */
const TIPOS_DOC = [
  'factura', 'detraccion', 'contrato', 'anexo', 'ficha_ruc', 'voucher',
  'constancia', 'dni', 'otro',
]

/** Dónde vive cada entidad: sirve para no dejar adjuntos colgando de una fila que no existe. */
const TABLA_POR_ENTIDAD: Record<Entidad, string> = {
  transaction: 'piola_transactions',
  invoice: 'piola_invoices',
  pago: 'piola_pagos',
  cliente: 'piola_clientes',
  contrato: 'piola_contratos',
  deliverable: 'piola_deliverables',
  payslip: 'piola_payslips',
}

/**
 * Qué módulo habilita cada entidad.
 *
 * Son listas y no un módulo único porque las mismas filas se tocan desde dos
 * pantallas y el servidor no puede saber desde cuál se llamó (ver `exigirAlguno`):
 * los contratos de cliente los administra Facturación pero los negocia CRM, y
 * la ficha de un cliente se mantiene desde CRM, Producción y Facturación.
 * `payslip` va aparte: exige Administrador.
 */
const MODULOS_POR_ENTIDAD: Record<Entidad, PiolaModule[]> = {
  transaction: ['contabilidad', 'facturacion'],
  invoice: ['facturacion', 'contabilidad'],
  pago: ['contabilidad', 'facturacion'],
  cliente: ['crm', 'produccion', 'facturacion'],
  contrato: ['facturacion', 'crm'],
  deliverable: ['produccion'],
  payslip: [],
}

function exigirAdjunto(perfil: PerfilPiola, entidad: Entidad, accion: 'view' | 'create' | 'delete') {
  // §7.5: todo lo que roza una boleta de pago es sólo de Administrador. El
  // voucher de un sueldo dice cuánto cobra alguien tanto como la boleta misma.
  if (entidad === 'payslip') return exigirAdmin(perfil, 'los adjuntos de boletas de pago')
  exigirAlguno(perfil, MODULOS_POR_ENTIDAD[entidad], accion)
}

function leerEntidad(body: any): Entidad {
  const e = String(body?.entidad || '').trim()
  if (!ENTIDADES.includes(e as Entidad)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Entidad inválida: ${e || '(vacía)'}. Válidas: ${ENTIDADES.join(', ')}`,
    })
  }
  return e as Entidad
}

/**
 * Path dentro del bucket, nunca una URL.
 *
 * `eliminar` borra del Storage exactamente lo que diga esta columna, así que
 * aceptar cualquier cadena convertiría el endpoint en un borrador de archivos
 * ajenos. Se rechazan URLs (el vínculo es con el bucket, no con Drive) y los
 * '..' que se salen de la carpeta.
 */
function pathBucket(v: any): string | null {
  const s = String(v ?? '').trim().replace(/^\/+/, '')
  if (!s || s.length > 400) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null   // http:, https:, data:, blob:…
  if (s.split('/').some(p => p === '..')) return null
  return s
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Listar los adjuntos de una fila (o de varias) ══════════ */
  if (accion === 'listar') {
    const entidad = leerEntidad(body)
    exigirAdjunto(perfil, entidad, 'view')

    // La versión con `entidad_ids` existe para las tablas: pedir los adjuntos
    // fila por fila serían 40 peticiones para pintar 40 clips.
    const ids: number[] = Array.isArray(body?.entidad_ids)
      ? body.entidad_ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [Number(body?.entidad_id)].filter(n => Number.isFinite(n) && n > 0)

    if (!ids.length) {
      throw createError({ statusCode: 400, statusMessage: 'Falta entidad_id (o entidad_ids)' })
    }
    if (ids.length > 500) {
      throw createError({ statusCode: 400, statusMessage: 'Como máximo 500 entidad_ids por consulta' })
    }

    const { data, error } = await supabase.from('piola_adjuntos')
      .select('*').eq('entidad', entidad).in('entidad_id', ids)
      .order('created_at', { ascending: true })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return { ok: true, adjuntos: data || [] }
  }

  /* ══════════ Registrar un adjunto ya subido al bucket ══════════ */
  if (accion === 'agregar') {
    const entidad = leerEntidad(body)
    exigirAdjunto(perfil, entidad, 'create')

    const entidadId = Number(body?.entidad_id)
    if (!entidadId) throw createError({ statusCode: 400, statusMessage: 'Falta entidad_id' })

    const path = pathBucket(body?.path)
    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: 'El adjunto necesita el path del archivo dentro del bucket piola-docs (no una URL)',
      })
    }

    const tipoDoc = String(body?.tipo_doc || 'otro').trim() || 'otro'
    if (!TIPOS_DOC.includes(tipoDoc)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Tipo de documento inválido: ${tipoDoc}. Válidos: ${TIPOS_DOC.join(', ')}`,
      })
    }

    // Sin nombre se usa el del archivo: la lista tiene que decir algo.
    const nombre = String(body?.nombre || '').trim()
      || decodeURIComponent(path.split('/').pop() || '') || 'documento'

    // Que la fila exista: un adjunto huérfano no se ve en ninguna pantalla y
    // nadie lo va a limpiar nunca.
    const { data: duenio } = await supabase
      .from(TABLA_POR_ENTIDAD[entidad]).select('id').eq('id', entidadId).maybeSingle()
    if (!duenio) {
      throw createError({ statusCode: 404, statusMessage: `No existe el registro ${entidad} #${entidadId}` })
    }

    const peso = Number(body?.peso_bytes)
    const { data, error } = await supabase.from('piola_adjuntos').insert({
      entidad,
      entidad_id: entidadId,
      tipo_doc: tipoDoc,
      nombre,
      path,
      peso_bytes: Number.isFinite(peso) && peso >= 0 ? Math.round(peso) : null,
      // Quién lo subió lo pone el servidor: no se acepta del cliente
      subido_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, adjunto: data }
  }

  /* ══════════ Eliminar un adjunto ══════════ */
  if (accion === 'eliminar') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el adjunto a eliminar' })

    const { data: adjunto } = await supabase.from('piola_adjuntos')
      .select('*').eq('id', id).maybeSingle()
    if (!adjunto) throw createError({ statusCode: 404, statusMessage: 'El adjunto no existe' })

    // El permiso sale de la fila guardada, no del body: si viniera del cliente,
    // bastaría con decir "es de un entregable" para borrar el de una boleta.
    exigirAdjunto(perfil, adjunto.entidad as Entidad, 'delete')

    // Se borra también el archivo del bucket —si no, cada corrección deja un
    // PDF invisible ocupando espacio para siempre—, pero sólo cuando ninguna
    // otra fila apunta al mismo path: dos entidades pueden compartir un
    // documento (la misma constancia en la factura y en el movimiento) y
    // borrarlo dejaría a la otra con un enlace roto.
    let archivoBorrado = false
    if (adjunto.path) {
      const { count } = await supabase.from('piola_adjuntos')
        .select('id', { count: 'exact', head: true })
        .eq('path', adjunto.path).neq('id', id)

      if (!count) {
        const { error: errStorage } = await supabase.storage.from('piola-docs').remove([adjunto.path])
        // Que el archivo ya no esté no es motivo para dejar la fila: el vínculo
        // roto es peor que el huérfano.
        if (errStorage) console.error('[piola/adjuntos] no se pudo borrar del bucket:', adjunto.path, errStorage.message)
        else archivoBorrado = true
      }
    }

    const { error } = await supabase.from('piola_adjuntos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, archivo_borrado: archivoBorrado }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
