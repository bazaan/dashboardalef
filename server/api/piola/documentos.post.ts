/**
 * POST /api/piola/documentos — adjuntos de cualquier entidad (N por entidad)
 *
 * Body:
 *   { accion: 'registrar', entidad, entidad_id, tipo, nombre, path, mime?, tamano_bytes?, descripcion? }
 *   { accion: 'actualizar', id, tipo?, nombre?, descripcion? }
 *   { accion: 'eliminar', id, borrar_archivo? }
 *
 * QUÉ HACE Y QUÉ NO
 * El ARCHIVO lo sube el navegador directo al bucket `piola-docs` (policies de
 * Storage de la parte 2 del SQL); acá se registra la FILA que lo cuelga de una
 * factura, un contrato o un movimiento. Se separa así porque subir 10 MB a
 * través de una función serverless para reenviarlos a Storage es pagar dos
 * veces el mismo viaje.
 *
 * PERMISOS POR ENTIDAD: adjuntar a una factura exige permiso de facturación;
 * a un contrato, de clientes. Si el permiso saliera del cliente, cualquiera
 * colgaría papeles de la factura de otro.
 *
 * `subido_por` lo pone el servidor: es la única pregunta que el campo existe
 * para responder.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno } from '../../utils/piola'
import type { PiolaModule } from '../../../utils/permissions'

/** Qué módulo manda sobre los adjuntos de cada cosa. */
const MODULO_POR_ENTIDAD: Record<string, PiolaModule[]> = {
  factura: ['facturacion'],
  contrato: ['clientes'],
  adenda: ['clientes'],
  cliente: ['clientes', 'crm'],
  movimiento: ['contabilidad'],
  colaborador: ['rrhh'],
  recibo_honorarios: ['rrhh'],
  lead: ['crm'],
  entregable: ['produccion'],
}

const TIPOS = [
  'factura', 'constancia_detraccion', 'contrato', 'anexo', 'ficha_ruc',
  'legal', 'comprobante', 'boleta', 'recibo', 'orden_compra', 'otro',
]

const texto = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s || null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || 'registrar')

  /* ══════════ Registrar un archivo ya subido al bucket ══════════ */
  if (accion === 'registrar') {
    const entidad = String(body?.entidad || '')
    const modulos = MODULO_POR_ENTIDAD[entidad]
    if (!modulos) throw createError({ statusCode: 400, statusMessage: `Entidad desconocida: ${entidad}` })

    const entidadId = Number(body?.entidad_id)
    if (!entidadId) throw createError({ statusCode: 400, statusMessage: 'Falta a qué se adjunta el documento' })

    exigirAlguno(perfil, modulos, 'create')

    const path = texto(body?.path)
    if (!path) throw createError({ statusCode: 400, statusMessage: 'Falta la ruta del archivo subido' })

    const tipo = String(body?.tipo || 'otro')
    if (!TIPOS.includes(tipo)) throw createError({ statusCode: 400, statusMessage: `Tipo de documento inválido: ${tipo}` })

    const { data, error } = await supabase.from('piola_documentos').insert({
      entidad,
      entidad_id: entidadId,
      tipo,
      nombre: texto(body?.nombre) || path.split('/').pop(),
      path,
      mime: texto(body?.mime),
      tamano_bytes: Number(body?.tamano_bytes) || null,
      descripcion: texto(body?.descripcion),
      subido_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, documento: data }
  }

  /* ══════════ Renombrar o reclasificar ══════════ */
  if (accion === 'actualizar') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el documento a editar' })

    const { data: doc } = await supabase.from('piola_documentos').select('*').eq('id', id).maybeSingle()
    if (!doc) throw createError({ statusCode: 404, statusMessage: 'Documento no encontrado' })
    exigirAlguno(perfil, MODULO_POR_ENTIDAD[doc.entidad] || ['configuracion'], 'edit')

    const patch: Record<string, any> = {}
    if ('tipo' in body) {
      const tipo = String(body.tipo)
      if (!TIPOS.includes(tipo)) throw createError({ statusCode: 400, statusMessage: `Tipo inválido: ${tipo}` })
      patch.tipo = tipo
    }
    if ('nombre' in body) {
      const nombre = texto(body.nombre)
      if (!nombre) throw createError({ statusCode: 400, statusMessage: 'El documento necesita un nombre' })
      patch.nombre = nombre
    }
    if ('descripcion' in body) patch.descripcion = texto(body.descripcion)
    if (!Object.keys(patch).length) throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })

    const { error } = await supabase.from('piola_documentos').update(patch).eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Eliminar ══════════ */
  if (accion === 'eliminar') {
    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el documento a eliminar' })

    const { data: doc } = await supabase.from('piola_documentos').select('*').eq('id', id).maybeSingle()
    if (!doc) return { ok: true }                       // ya no estaba: nada que hacer
    exigirAlguno(perfil, MODULO_POR_ENTIDAD[doc.entidad] || ['configuracion'], 'delete')

    const { error } = await supabase.from('piola_documentos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    /*
     * Borrar el archivo del bucket es OPCIONAL y va apagado por defecto.
     * El mismo PDF puede estar colgado de la factura y del contrato: borrarlo
     * siempre dejaría al otro con un enlace roto. Se borra solo si lo piden
     * expresamente y ninguna otra fila lo referencia.
     */
    if (body?.borrar_archivo) {
      const { count } = await supabase.from('piola_documentos')
        .select('id', { count: 'exact', head: true }).eq('path', doc.path)
      if (!count) await supabase.storage.from('piola-docs').remove([doc.path])
    }

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
