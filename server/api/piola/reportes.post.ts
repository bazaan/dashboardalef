/**
 * POST /api/piola/reportes — configuración de reportes programados y alertas (§8)
 *
 * Body:
 *   { accion: 'reporte_actualizar', id, frecuencia?, dia_ejecucion?, canal?, destinatarios?, activo? }
 *   { accion: 'alerta_actualizar',  id, dias_antes?, canal?, destinatarios?, activo? }
 *
 * (La ejecución y la vista previa siguen en `GET /api/piola/reportes`; acá solo
 * se guarda la configuración.)
 *
 * LOS DESTINATARIOS SON EL MOTIVO. Estas dos tablas dicen a quién se le manda
 * el reporte de caja y las alertas de vencimientos, por correo y WhatsApp.
 * Escribirlas sin guard significaba que cualquiera podía agregarse —o agregar a
 * un tercero— a la lista de distribución de la información financiera de la
 * agencia, y el envío siguiente lo cumplía sin preguntar. El endpoint valida
 * además la forma de los campos: `destinatarios` tiene que ser una lista de
 * strings, `dias_antes` un entero no negativo, y el canal uno de los conocidos.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirModulo } from '../../utils/piola'

const CANALES = ['correo', 'whatsapp', 'ambos']
// Mismos valores que el CHECK de piola_scheduled_reports.frecuencia
const FRECUENCIAS = ['semanal', 'quincenal', 'mensual']

/** Lista de destinatarios saneada: strings no vacíos, sin repetidos. */
function destinatarios(v: any): string[] {
  if (!Array.isArray(v)) {
    throw createError({ statusCode: 400, statusMessage: 'Los destinatarios deben ser una lista' })
  }
  return [...new Set(v.map((x: any) => String(x || '').trim()).filter(Boolean))]
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)

  const body = await readBody(event)
  const accion = String(body?.accion || '')

  if (accion === 'reporte_actualizar' || accion === 'alerta_actualizar') {
    exigirModulo(perfil, 'reportes', 'edit')

    const id = Number(body?.id)
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la configuración a editar' })

    const patch: Record<string, any> = {}

    if ('activo' in body) patch.activo = !!body.activo
    if ('destinatarios' in body) patch.destinatarios = destinatarios(body.destinatarios)
    if ('canal' in body) {
      const canal = String(body.canal || '')
      if (!CANALES.includes(canal)) {
        throw createError({ statusCode: 400, statusMessage: `Canal desconocido: ${canal}` })
      }
      patch.canal = canal
    }

    if (accion === 'reporte_actualizar') {
      if ('frecuencia' in body) {
        const f = String(body.frecuencia || '')
        if (!FRECUENCIAS.includes(f)) {
          throw createError({ statusCode: 400, statusMessage: `Frecuencia desconocida: ${f}` })
        }
        patch.frecuencia = f
      }
      if ('dia_ejecucion' in body) {
        // Semanal usa día de la semana (0 = domingo), mensual usa día del mes:
        // por eso el rango arranca en 0 y no en 1.
        const d = Number(body.dia_ejecucion)
        if (!Number.isInteger(d) || d < 0 || d > 31) {
          throw createError({ statusCode: 400, statusMessage: 'El día de ejecución va del 0 al 31' })
        }
        patch.dia_ejecucion = d
      }
    } else if ('dias_antes' in body) {
      const d = Number(body.dias_antes)
      if (!Number.isInteger(d) || d < 0) {
        throw createError({ statusCode: 400, statusMessage: 'Los días de anticipación deben ser un entero ≥ 0' })
      }
      patch.dias_antes = d
    }

    if (!Object.keys(patch).length) {
      throw createError({ statusCode: 400, statusMessage: 'No hay nada que cambiar' })
    }

    const tabla = accion === 'reporte_actualizar' ? 'piola_scheduled_reports' : 'piola_alert_settings'
    const { data, error } = await supabase.from(tabla).update(patch).eq('id', id).select('*').single()
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })

    return { ok: true, config: data }
  }

  throw createError({ statusCode: 400, statusMessage: `Acción desconocida: ${accion}` })
})
