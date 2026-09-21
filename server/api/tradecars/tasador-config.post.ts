/**
 * POST /api/tradecars/tasador-config
 *
 * Aplica un cambio confirmado sobre la configuración del Agente Tasador. Es el
 * ÚNICO camino de escritura: el chat del Tasador nunca escribe por su cuenta —
 * propone, la persona confirma en la UI, y recién ahí se llama acá.
 *
 * Lo que se escribe acá lo lee el agente de WhatsApp (n8n) en la siguiente
 * tasación, sin redeploy.
 *
 * Body: { accion, ...campos, motivo? }
 *
 *   actualizar_parametro   { clave, valor }
 *   crear_regla            { marca, modelo, tipo_ajuste, valor_ajuste?, flag?, descripcion, gnv_glp?, anio_min?, anio_max?, prioridad? }
 *   desactivar_regla       { id }
 *   agregar_alta_rotacion  { marca, modelo, motivo_rotacion? }
 *   quitar_alta_rotacion   { id }
 *   solicitar_a_alef       { resumen }
 *   resolver_solicitud     { id, notas_alef? }        (sólo superadmin de Alef)
 *
 * Auth: sesión de Trade Cars con rol admin o superadmin. Un asesor puede
 * conversar con el Tasador pero no cambiar los números con los que la empresa
 * decide cuánto paga por un auto.
 */

import { serverSupabaseServiceRole } from '#supabase/server'
import {
  verificarSesionTradeCarsEnBase, puedeEditarTasador,
  registrarCambio, logTasador,
} from '../../utils/tradecars'

const TIPOS_AJUSTE = ['resta_usd', 'suma_usd', 'resta_pct', 'suma_pct', 'flag']

// El prompt del Tasador sólo sabe reaccionar a este flag. Aceptar cualquier
// otro dejaría al cliente creyendo que configuró algo que el agente ignora.
const FLAGS_RECONOCIDOS = ['usar_tasa_km_generica']

function texto(v: any): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const sesion = await verificarSesionTradeCarsEnBase(event, supabase)
  if (!puedeEditarTasador(sesion)) {
    throw createError({ statusCode: 403, statusMessage: 'Sólo administración puede cambiar la configuración del Tasador' })
  }

  const body = await readBody(event)
  const accion = String(body?.accion || '')
  const motivo = texto(body?.motivo)
  const origen = body?.origen === 'panel' ? 'panel' : 'chat_tasador'
  const ahora = new Date().toISOString()

  try {
    switch (accion) {
      /* ─────────────── Parámetros de tasación ─────────────── */
      case 'actualizar_parametro': {
        const clave = texto(body?.clave)
        if (!clave) throw createError({ statusCode: 400, statusMessage: 'Falta la clave del parámetro' })

        const valor = Number(body?.valor)
        if (!isFinite(valor)) throw createError({ statusCode: 400, statusMessage: 'El valor tiene que ser un número' })

        const { data: actual, error: errLeer } = await supabase
          .from('tradecars_config_parametros_tasador')
          .select('clave,valor,unidad,minimo,maximo,descripcion')
          .eq('clave', clave)
          .maybeSingle()
        if (errLeer) throw createError({ statusCode: 500, statusMessage: errLeer.message })

        // No se permiten claves nuevas: el prompt del Tasador lee un set fijo,
        // así que inventar una clave no cambiaría nada en la tasación real.
        if (!actual) {
          throw createError({
            statusCode: 400,
            statusMessage: `El parámetro "${clave}" no existe. El Tasador sólo lee un conjunto fijo de parámetros; agregar uno nuevo requiere cambiar el prompt en n8n (solicitud a Alef).`,
          })
        }

        if (actual.minimo != null && valor < Number(actual.minimo)) {
          throw createError({ statusCode: 400, statusMessage: `${clave} no puede ser menor que ${actual.minimo}` })
        }
        if (actual.maximo != null && valor > Number(actual.maximo)) {
          throw createError({ statusCode: 400, statusMessage: `${clave} no puede ser mayor que ${actual.maximo}` })
        }

        const anterior = Number(actual.valor)
        if (anterior === valor) {
          return { ok: true, sin_cambios: true, mensaje: `${clave} ya estaba en ${valor}.` }
        }

        const { error: errUpd } = await supabase
          .from('tradecars_config_parametros_tasador')
          .update({ valor, actualizado_en: ahora, actualizado_por: sesion.email })
          .eq('clave', clave)
        if (errUpd) throw createError({ statusCode: 500, statusMessage: errUpd.message })

        const unidad = actual.unidad ? ` ${actual.unidad}` : ''
        const resumen = `${clave}: ${anterior}${unidad} → ${valor}${unidad}`

        const cambio = await registrarCambio(supabase, {
          tipo: 'parametro', accion: 'actualizar', objetivo: clave,
          valor_anterior: { valor: anterior }, valor_nuevo: { valor },
          resumen, motivo, origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Config', { accion, clave, anterior, valor }, { resumen }, 'success')
        return { ok: true, cambio, mensaje: `Listo: ${resumen}. El agente de WhatsApp lo toma en la próxima tasación.` }
      }

      /* ─────────────── Reglas por marca / modelo ─────────────── */
      case 'crear_regla': {
        const marca = texto(body?.marca)
        const modelo = texto(body?.modelo) || '*'
        const tipoAjuste = texto(body?.tipo_ajuste)
        const descripcion = texto(body?.descripcion)

        if (!marca) throw createError({ statusCode: 400, statusMessage: 'Falta la marca (usar "*" para todas)' })
        if (!tipoAjuste || !TIPOS_AJUSTE.includes(tipoAjuste)) {
          throw createError({ statusCode: 400, statusMessage: `tipo_ajuste tiene que ser uno de: ${TIPOS_AJUSTE.join(', ')}` })
        }
        if (!descripcion) throw createError({ statusCode: 400, statusMessage: 'Falta la descripción de la regla' })

        const flag = texto(body?.flag)
        let valorAjuste: number | null = null

        if (tipoAjuste === 'flag') {
          if (!flag || !FLAGS_RECONOCIDOS.includes(flag)) {
            throw createError({
              statusCode: 400,
              statusMessage: `El único flag que el Tasador reconoce hoy es "${FLAGS_RECONOCIDOS.join('", "')}". Para un comportamiento nuevo hace falta una solicitud a Alef.`,
            })
          }
        } else {
          valorAjuste = Number(body?.valor_ajuste)
          if (!isFinite(valorAjuste) || valorAjuste <= 0) {
            throw createError({ statusCode: 400, statusMessage: 'valor_ajuste tiene que ser un número mayor que cero' })
          }
          if (tipoAjuste.endsWith('_pct') && valorAjuste > 100) {
            throw createError({ statusCode: 400, statusMessage: 'Un ajuste porcentual no puede superar el 100%' })
          }
        }

        const fila = {
          marca,
          modelo,
          gnv_glp: texto(body?.gnv_glp),
          anio_min: body?.anio_min != null && body.anio_min !== '' ? Number(body.anio_min) : null,
          anio_max: body?.anio_max != null && body.anio_max !== '' ? Number(body.anio_max) : null,
          tipo_ajuste: tipoAjuste,
          valor_ajuste: valorAjuste,
          flag: tipoAjuste === 'flag' ? flag : null,
          descripcion,
          prioridad: body?.prioridad != null ? Number(body.prioridad) : 50,
          activa: true,
          actualizado_en: ahora,
          actualizado_por: sesion.email,
        }

        // El Tasador suma las reglas que aplican una tras otra, así que una regla
        // duplicada descuenta dos veces sin que nadie lo note. Sólo se bloquea el
        // caso en que ambas aplican siempre (sin rango de años): dos tramos de años
        // distintos para la misma marca son legítimos y tienen que poder convivir.
        if (fila.anio_min === null && fila.anio_max === null) {
          const { data: yaExiste } = await supabase
            .from('tradecars_config_reglas_marca_modelo')
            .select('id')
            .eq('activa', true)
            .eq('tipo_ajuste', tipoAjuste)
            .ilike('marca', marca)
            .ilike('modelo', modelo)
            .is('anio_min', null)
            .is('anio_max', null)
            .limit(1)

          if (yaExiste?.length) {
            throw createError({
              statusCode: 409,
              statusMessage: `Ya hay una regla activa de tipo "${tipoAjuste}" para ${marca}/${modelo} que aplica siempre. Desactívala primero, o acota la nueva por rango de años: si no, el ajuste se aplicaría dos veces sobre el mismo auto.`,
            })
          }
        }

        const { data: creada, error } = await supabase
          .from('tradecars_config_reglas_marca_modelo')
          .insert(fila).select().single()
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })

        const resumen = tipoAjuste === 'flag'
          ? `Nueva regla ${marca}/${modelo}: ${flag}`
          : `Nueva regla ${marca}/${modelo}: ${tipoAjuste.replace('_', ' ')} ${valorAjuste}`

        const cambio = await registrarCambio(supabase, {
          tipo: 'regla', accion: 'crear', objetivo: `${marca}/${modelo}`,
          valor_anterior: null, valor_nuevo: fila,
          resumen, motivo, origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Config', { accion, marca, modelo }, { resumen }, 'success')
        return { ok: true, cambio, regla: creada, mensaje: `Listo: ${resumen}.` }
      }

      case 'desactivar_regla': {
        const id = texto(body?.id)
        if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la regla' })

        const { data: actual, error: errLeer } = await supabase
          .from('tradecars_config_reglas_marca_modelo')
          .select('*').eq('id', id).maybeSingle()
        if (errLeer) throw createError({ statusCode: 500, statusMessage: errLeer.message })
        if (!actual) throw createError({ statusCode: 404, statusMessage: 'Esa regla no existe' })

        const { error } = await supabase
          .from('tradecars_config_reglas_marca_modelo')
          .update({ activa: false, actualizado_en: ahora, actualizado_por: sesion.email })
          .eq('id', id)
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })

        const resumen = `Regla desactivada: ${actual.marca}/${actual.modelo} — ${actual.descripcion || actual.tipo_ajuste}`
        const cambio = await registrarCambio(supabase, {
          tipo: 'regla', accion: 'desactivar', objetivo: `${actual.marca}/${actual.modelo}`,
          valor_anterior: actual, valor_nuevo: null,
          resumen, motivo, origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Config', { accion, id }, { resumen }, 'success')
        return { ok: true, cambio, mensaje: `Listo: ${resumen}.` }
      }

      /* ─────────────── Alta rotación ─────────────── */
      case 'agregar_alta_rotacion': {
        const marca = texto(body?.marca)
        const modelo = texto(body?.modelo)
        if (!marca || !modelo) throw createError({ statusCode: 400, statusMessage: 'Faltan marca y modelo' })

        const { data: existente } = await supabase
          .from('tradecars_config_modelos_alta_rotacion')
          .select('id,activa').ilike('marca', marca).ilike('modelo', modelo).maybeSingle()

        const motivoRotacion = texto(body?.motivo_rotacion) || 'Marcado como alta rotación desde el dashboard'

        if (existente) {
          if (existente.activa) {
            return { ok: true, sin_cambios: true, mensaje: `${marca} ${modelo} ya estaba marcado como alta rotación.` }
          }
          const { error } = await supabase
            .from('tradecars_config_modelos_alta_rotacion')
            .update({ activa: true, motivo: motivoRotacion, actualizado_en: ahora, actualizado_por: sesion.email })
            .eq('id', existente.id)
          if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        } else {
          const { error } = await supabase
            .from('tradecars_config_modelos_alta_rotacion')
            .insert({ marca, modelo, motivo: motivoRotacion, activa: true, actualizado_en: ahora, actualizado_por: sesion.email })
          if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        }

        const resumen = `${marca} ${modelo} marcado como alta rotación`
        const cambio = await registrarCambio(supabase, {
          tipo: 'alta_rotacion', accion: 'crear', objetivo: `${marca}/${modelo}`,
          valor_anterior: null, valor_nuevo: { marca, modelo, motivo: motivoRotacion },
          resumen, motivo, origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Config', { accion, marca, modelo }, { resumen }, 'success')
        return { ok: true, cambio, mensaje: `Listo: ${resumen}. En estos modelos el Tasador deja de descontar preventivamente y cotiza en el extremo alto del rango.` }
      }

      case 'quitar_alta_rotacion': {
        const id = texto(body?.id)
        if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id' })

        const { data: actual } = await supabase
          .from('tradecars_config_modelos_alta_rotacion')
          .select('*').eq('id', id).maybeSingle()
        if (!actual) throw createError({ statusCode: 404, statusMessage: 'Ese modelo no está en la lista' })

        const { error } = await supabase
          .from('tradecars_config_modelos_alta_rotacion')
          .update({ activa: false, actualizado_en: ahora, actualizado_por: sesion.email })
          .eq('id', id)
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })

        const resumen = `${actual.marca} ${actual.modelo} ya no es de alta rotación`
        const cambio = await registrarCambio(supabase, {
          tipo: 'alta_rotacion', accion: 'desactivar', objetivo: `${actual.marca}/${actual.modelo}`,
          valor_anterior: actual, valor_nuevo: null,
          resumen, motivo, origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Config', { accion, id }, { resumen }, 'success')
        return { ok: true, cambio, mensaje: `Listo: ${resumen}.` }
      }

      /* ─────────────── Segundo nivel: lo que implementa Alef ─────────────── */
      case 'solicitar_a_alef': {
        const resumen = texto(body?.resumen)
        if (!resumen) throw createError({ statusCode: 400, statusMessage: 'Falta describir qué se quiere cambiar' })

        const cambio = await registrarCambio(supabase, {
          tipo: 'solicitud_alef', accion: 'solicitud', objetivo: texto(body?.objetivo),
          valor_anterior: null, valor_nuevo: null,
          resumen, motivo, estado: 'pendiente_alef', origen, solicitado_por: sesion.email,
        })

        await logTasador(supabase, 'Tasador · Solicitud a Alef', { resumen, motivo }, { id: cambio.id }, 'success')
        return {
          ok: true, cambio,
          mensaje: 'Queda registrado como solicitud para Alef. Este tipo de cambio toca la lógica o el flujo de conversación del agente, así que lo implementa el equipo técnico y no se puede aplicar solo desde aquí.',
        }
      }

      case 'resolver_solicitud': {
        // Sólo Alef cierra sus propias solicitudes: si lo pudiera cerrar el
        // cliente, el tablero de pendientes dejaría de ser confiable.
        if (!sesion.esSuperadmin) {
          throw createError({ statusCode: 403, statusMessage: 'Sólo Alef puede cerrar una solicitud' })
        }
        const id = texto(body?.id)
        if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id de la solicitud' })

        const { error } = await supabase
          .from('tradecars_tasador_cambios')
          .update({ estado: 'resuelto_alef', notas_alef: texto(body?.notas_alef), resuelto_at: ahora })
          .eq('id', id).eq('estado', 'pendiente_alef')
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })

        return { ok: true, mensaje: 'Solicitud marcada como resuelta.' }
      }

      default:
        throw createError({ statusCode: 400, statusMessage: `Acción desconocida: "${accion}"` })
    }
  } catch (err: any) {
    await logTasador(supabase, 'Tasador · Config', { accion, body }, null, 'error',
      err?.statusMessage || err?.message || 'error desconocido')
    throw err
  }
})
