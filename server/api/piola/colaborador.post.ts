/**
 * POST /api/piola/colaborador — ficha, contratos y documentos del expediente (§7)
 *
 * Body:
 *   { accion: 'guardar', id?, ...campos }          → alta o edición de la ficha
 *   { accion: 'eliminar', id }
 *   { accion: 'contrato_crear', colaborador_id, ... }
 *   { accion: 'contrato_eliminar', id }
 *   { accion: 'documento_crear', colaborador_id, ... }
 *   { accion: 'documento_eliminar', id }
 *
 * POR QUÉ EXISTE: `piola_colaboradores` guarda sueldo_bruto, bonificaciones,
 * comision_pct y afp_cuspp. La censura de la auditoría (migración 04) evitó que
 * esos importes quedaran duplicados en una tabla legible por `anon`, pero no
 * impedía leerlos ni escribirlos consultando la tabla directamente desde el
 * navegador. Acá se cierra esa puerta.
 *
 * TRES NIVELES DE PERMISO, no uno:
 *
 * 1. **Los campos de remuneración exigen Administrador**, y solo cuando la
 *    petición efectivamente los cambia: RR.HH. manda el formulario entero al
 *    guardar, así que exigir admin por el mero hecho de que el campo viaje
 *    bloquearía editar un teléfono. Se compara contra lo que hay en la BD.
 *    La lista es la misma que censura el trigger de auditoría, para que las dos
 *    mitades del sistema tengan una sola definición de "dato sensible".
 *
 * 2. **`role_id` exige permiso de Configuración**, no de RR.HH.: el rol es lo
 *    que decide qué puede hacer cada quien, y repartir eso no es parte de
 *    mantener un expediente.
 *
 * 3. **El resto exige RR.HH. *o* Configuración.** Las dos pantallas que existen
 *    hoy —Expediente (RR.HH.) y la lista de colaboradores (Configuración)—
 *    escriben la misma fila, así que pedir un módulo concreto le quitaría acceso
 *    a una de las dos. El servidor no puede saber desde cuál se llamó, y
 *    tampoco debería: eso lo diría el cliente.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo, exigirAlguno, exigirAdmin } from '../../utils/piola'
import type { PerfilPiola } from '../../utils/piola'

/** Campos que cualquiera con permiso de módulo puede tocar. */
const CAMPOS_TEXTO = [
  // Personales
  'nombres', 'apellidos', 'nombre', 'dni', 'nacionalidad', 'telefono', 'direccion',
  'emergencia_nombre', 'emergencia_telefono', 'emergencia_parentesco',
  // Laborales
  'codigo_trabajador', 'cargo', 'sede', 'jefe_email', 'tipo_contrato',
  'modalidad_trabajo', 'jornada', 'horario', 'estado_laboral', 'motivo_cese',
  // Planilla no secreta: cambia el cálculo, pero no es un importe
  'afp_nombre', 'afp_tipo_comision', 'beneficios',
]
const CAMPOS_FECHA = ['fecha_nacimiento', 'fecha_ingreso', 'fecha_cese', 'fecha_fin_contrato']
const CAMPOS_BOOL = ['activo', 'asignacion_familiar']
const CAMPOS_ENTERO = ['area_id']

/**
 * Importes y datos de planilla: SOLO Administrador.
 * Misma lista que censura `piola_auditoria` (migración 04).
 */
const CAMPOS_SENSIBLES = ['sueldo_bruto', 'bonificaciones', 'comision_pct', 'afp_cuspp']

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
 * ¿La petición cambia realmente este campo respecto de lo guardado?
 *
 * Los importes se comparan como números, y "sin valor" cuenta como 0: PEN
 * '1500.00' y 1500 son el mismo sueldo, y crear una ficha con comisión 0 no es
 * fijarle una comisión — si contara como cambio, nadie sin ser Administrador
 * podría dar de alta a un colaborador.
 */
function cambia(antes: any, ahora: any): boolean {
  const nulo = (v: any) => v === null || v === undefined || v === ''
  const a = nulo(antes) ? null : antes
  const b = nulo(ahora) ? null : ahora
  if (a === null && b === null) return false

  const na = a === null ? 0 : Number(a)
  const nb = b === null ? 0 : Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) > 0.0001

  // Texto (afp_cuspp): pasar de vacío a un valor, o cambiarlo, sí es un cambio
  if (a === null || b === null) return true
  return String(a) !== String(b)
}

/** Permiso base del expediente: RR. HH. o Configuración (ver `exigirAlguno`). */
const exigirExpediente = (perfil: PerfilPiola, accion: 'create' | 'edit' | 'delete') =>
  exigirAlguno(perfil, ['rrhh', 'configuracion'], accion)

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  /* ══════════ Alta o edición de la ficha ══════════ */
  if (accion === 'guardar') {
    const id = Number(body?.id) || null
    exigirExpediente(perfil, id ? 'edit' : 'create')

    const fila: Record<string, any> = {}
    for (const k of CAMPOS_TEXTO) if (k in body) fila[k] = texto(body[k])
    for (const k of CAMPOS_FECHA) if (k in body) fila[k] = texto(body[k])
    for (const k of CAMPOS_BOOL) if (k in body) fila[k] = !!body[k]
    for (const k of CAMPOS_ENTERO) if (k in body) fila[k] = numero(body[k])

    // El correo enlaza la ficha con `dashboardlogin`: se normaliza acá
    if ('email' in body) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) throw createError({ statusCode: 400, statusMessage: 'La ficha necesita un correo' })
      fila.email = email
    }
    if (!id && !fila.email) {
      throw createError({ statusCode: 400, statusMessage: 'La ficha necesita un correo' })
    }
    if (!id && !fila.nombre && !fila.nombres) {
      throw createError({ statusCode: 400, statusMessage: 'La ficha necesita un nombre' })
    }

    // La fila que hay hoy: contra ella se decide qué cambió de verdad
    let actual: any = null
    if (id) {
      const { data } = await supabase.from('piola_colaboradores')
        .select('*').eq('id', id).maybeSingle()
      if (!data) throw createError({ statusCode: 404, statusMessage: 'La ficha no existe' })
      actual = data
    }

    // 1. Remuneración → Administrador, solo si cambia
    for (const k of CAMPOS_SENSIBLES) {
      if (!(k in body)) continue
      const valor = k === 'afp_cuspp' ? texto(body[k]) : numero(body[k])
      if (cambia(actual?.[k], valor)) exigirAdmin(perfil, 'los datos de remuneración')
      fila[k] = valor
    }

    // 2. Rol → Configuración: repartir permisos no es mantener un expediente
    if ('role_id' in body) {
      const roleId = numero(body.role_id)
      if (cambia(actual?.role_id, roleId)) exigirModulo(perfil, 'configuracion', id ? 'edit' : 'create')
      fila.role_id = roleId
    }

    if (!Object.keys(fila).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que guardar' })
    }
    fila.updated_at = new Date().toISOString()

    const res = id
      ? await supabase.from('piola_colaboradores').update(fila).eq('id', id).select('*').single()
      : await supabase.from('piola_colaboradores').insert(fila).select('*').single()
    // El mensaje de Postgres se propaga tal cual: la pantalla distingue el
    // choque contra idx_piola_colab_codigo del resto de errores.
    if (res.error) throw createError({ statusCode: 400, statusMessage: res.error.message })

    return { ok: true, colaborador: res.data }
  }

  /* ══════════ Eliminar la ficha ══════════ */
  if (accion === 'eliminar') {
    exigirExpediente(perfil, 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la ficha a eliminar' })

    const { error } = await supabase.from('piola_colaboradores').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Contratos y renovaciones ══════════ */
  if (accion === 'contrato_crear') {
    exigirExpediente(perfil, 'create')

    const colaboradorId = Number(body?.colaborador_id)
    const fechaInicio = texto(body?.fecha_inicio)
    if (!colaboradorId || !fechaInicio) {
      throw createError({ statusCode: 400, statusMessage: 'El contrato necesita colaborador y fecha de inicio' })
    }

    // Un contrato lleva la remuneración escrita: fijarla es un acto de Administrador
    const remuneracion = numero(body?.remuneracion)
    const bonificaciones = numero(body?.bonificaciones) || 0
    if (remuneracion || bonificaciones) exigirAdmin(perfil, 'los datos de remuneración')

    const { data, error } = await supabase.from('piola_contratos_laborales').insert({
      colaborador_id: colaboradorId,
      tipo_contrato: texto(body?.tipo_contrato) || 'planilla',
      fecha_inicio: fechaInicio,
      fecha_termino: texto(body?.fecha_termino),
      remuneracion,
      bonificaciones,
      beneficios: texto(body?.beneficios),
      es_renovacion: !!body?.es_renovacion,
      contrato_pdf: texto(body?.contrato_pdf),
      observaciones: texto(body?.observaciones),
      // Quién lo registró lo pone el servidor
      created_by: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, contrato: data }
  }

  if (accion === 'contrato_eliminar') {
    exigirExpediente(perfil, 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el contrato a eliminar' })

    // Borrar un contrato borra la remuneración pactada: mismo nivel que fijarla
    const { data: contrato } = await supabase.from('piola_contratos_laborales')
      .select('id, remuneracion, bonificaciones').eq('id', id).maybeSingle()
    if (!contrato) throw createError({ statusCode: 404, statusMessage: 'El contrato no existe' })
    if (Number(contrato.remuneracion || 0) || Number(contrato.bonificaciones || 0)) {
      exigirAdmin(perfil, 'los datos de remuneración')
    }

    const { error } = await supabase.from('piola_contratos_laborales').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  /* ══════════ Documentos del expediente ══════════ */
  if (accion === 'documento_crear') {
    exigirExpediente(perfil, 'create')

    const colaboradorId = Number(body?.colaborador_id)
    const nombre = texto(body?.nombre)
    if (!colaboradorId || !nombre) {
      throw createError({ statusCode: 400, statusMessage: 'El documento necesita colaborador y nombre' })
    }

    const { data, error } = await supabase.from('piola_colaborador_documentos').insert({
      colaborador_id: colaboradorId,
      tipo: texto(body?.tipo) || 'otro',
      nombre,
      archivo_url: texto(body?.archivo_url),
      fecha: texto(body?.fecha),
      subido_por: perfil.email,
    }).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, documento: data }
  }

  if (accion === 'documento_eliminar') {
    exigirExpediente(perfil, 'delete')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el documento a eliminar' })

    const { error } = await supabase.from('piola_colaborador_documentos').delete().eq('id', id)
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
