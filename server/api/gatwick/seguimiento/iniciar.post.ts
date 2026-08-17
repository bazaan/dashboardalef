/**
 * POST /api/gatwick/seguimiento/iniciar
 *
 * El técnico toca "Comenzar" en una emergencia del dashboard:
 *   1. Resuelve el EDIFICIO a partir del código del ascensor (AP-0001, MV-0002…)
 *      y copia dirección, distrito, ELME y nombre a la emergencia.
 *   2. Geocodifica la dirección (Nominatim) para tener el destino en el mapa.
 *   3. Crea el seguimiento con un TOKEN único (el link privado del técnico).
 *   4. Avisa a TODOS los supervisores por WhatsApp con los datos + link de monitoreo.
 *
 * Body: { emergencia_id, tecnico_id?, tecnico_nombre?, tecnico_telefono? }
 * Respuesta: { ok, seguimiento, link_tecnico, link_supervisor, aviso }
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { randomBytes } from 'node:crypto'
import { avisarSupervisores, mensajeParaEstado, geocodificar, baseUrl, verificarSesionGatwick } from '../../../utils/gatwick-tracking'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  // Solo alguien con sesión del dashboard puede iniciar un seguimiento: si no,
  // cualquiera podría disparar avisos de emergencia falsos a los supervisores.
  const sesion = await verificarSesionGatwick(event, supabase)
  const body = await readBody(event)

  const emergenciaId = Number(body?.emergencia_id)
  if (!Number.isFinite(emergenciaId)) {
    throw createError({ statusCode: 400, statusMessage: 'Falta emergencia_id' })
  }

  // ── 1. La emergencia ──
  const { data: emerg, error: eErr } = await (supabase.from('gatwick_emergencias') as any)
    .select('*').eq('id', emergenciaId).maybeSingle()
  if (eErr || !emerg) {
    throw createError({ statusCode: 404, statusMessage: 'Emergencia no encontrada' })
  }

  // ── 2. ¿Ya hay un seguimiento activo? ──
  const { data: activo } = await (supabase.from('gatwick_seguimientos') as any)
    .select('*').eq('emergencia_id', emergenciaId)
    .in('estado', ['iniciado', 'en_camino', 'atendiendo']).maybeSingle()
  if (activo) {
    const base = baseUrl(event)
    return {
      ok: true, ya_existia: true, seguimiento: activo,
      link_tecnico: `${base}/gatwick/tecnico/${activo.token}`,
      link_supervisor: `${base}/gatwick/seguimiento/${activo.token}`,
    }
  }

  // ── 3. Resolver el EDIFICIO por el código del ascensor ──
  const patch: Record<string, any> = {}
  const codigo = String(emerg.codigo_ascensor || body?.codigo_ascensor || '').trim().toUpperCase()
  let edificio: any = null

  if (codigo) {
    const { data: edificios } = await (supabase.from('gatwick_edificios') as any)
      .select('id, elme, nombre, direccion, distrito, equipos, es_instalacion_critica')
      .eq('activo', true).limit(2000)
    edificio = (edificios || []).find((ed: any) =>
      Array.isArray(ed.equipos) && ed.equipos.some((a: any) => String(a?.codigo || '').toUpperCase() === codigo))

    if (edificio) {
      // gatwick_edificios es la FUENTE DE VERDAD: sus datos pisan lo que se
      // haya escrito a mano en la emergencia (si no, un tipeo del operador
      // manda al técnico a una dirección equivocada).
      const asc = (edificio.equipos || []).find((a: any) => String(a?.codigo || '').toUpperCase() === codigo)
      patch.codigo_ascensor = codigo
      patch.edificio_id     = edificio.id
      patch.edificio_nombre = edificio.nombre
      patch.distrito        = edificio.distrito
      patch.elme            = edificio.elme
      patch.direccion       = edificio.direccion || emerg.direccion
      patch.empresa_cliente = edificio.nombre || emerg.empresa_cliente
      if (asc?.tipo) patch.tipo_equipo = asc.tipo
      // La dirección cambió respecto de la guardada → hay que re-geocodificar
      if (edificio.direccion && edificio.direccion !== emerg.direccion) {
        patch.destino_lat = null
        patch.destino_lng = null
      }
    } else {
      // El código no existe en el catálogo: se avisa en vez de seguir a ciegas
      throw createError({
        statusCode: 404,
        statusMessage: `El código de ascensor "${codigo}" no existe en Clientes. Verifícalo antes de comenzar.`,
      })
    }
  }

  // ── 4. Geocodificar el destino ──
  // Si la dirección del edificio cambió, el paso 3 puso destino_lat en null
  // a propósito para forzar el recálculo (no se reusan coordenadas viejas).
  const direccionDestino = edificio?.direccion || patch.direccion || emerg.direccion || ''
  const distritoDestino = edificio?.distrito || patch.distrito || emerg.distrito
  let destinoLat = ('destino_lat' in patch) ? patch.destino_lat : (emerg.destino_lat as number | null)
  let destinoLng = ('destino_lng' in patch) ? patch.destino_lng : (emerg.destino_lng as number | null)
  if ((destinoLat == null || destinoLng == null) && direccionDestino) {
    const geo = await geocodificar(direccionDestino, distritoDestino)
    if (geo) {
      destinoLat = geo.lat; destinoLng = geo.lng
      patch.destino_lat = geo.lat; patch.destino_lng = geo.lng
    }
  }

  if (Object.keys(patch).length) {
    await (supabase.from('gatwick_emergencias') as any).update(patch).eq('id', emergenciaId)
  }
  const emergFinal = { ...emerg, ...patch }

  // ── 5. Datos del técnico ──
  let tecNombre = String(body?.tecnico_nombre || '').trim()
  let tecTelefono = String(body?.tecnico_telefono || '').trim()
  const tecnicoId = Number(body?.tecnico_id ?? emerg.tecnico_id) || null
  if (tecnicoId && (!tecNombre || !tecTelefono)) {
    const { data: tec } = await (supabase.from('gatwick_tecnicos') as any)
      .select('nombre, apellido, telefono').eq('id', tecnicoId).maybeSingle()
    if (tec) {
      tecNombre = tecNombre || [tec.nombre, tec.apellido].filter(Boolean).join(' ')
      tecTelefono = tecTelefono || tec.telefono || ''
    }
  }

  // ── 6. Crear el seguimiento ──
  const token = randomBytes(16).toString('hex')
  const fila = {
    emergencia_id: emergenciaId,
    tecnico_id: tecnicoId,
    tecnico_nombre: tecNombre || 'Técnico',
    tecnico_telefono: tecTelefono || null,
    token,
    estado: 'iniciado',
    destino_direccion: direccionDestino || null,
    destino_lat: destinoLat, destino_lng: destinoLng,
    snapshot: emergFinal,
    creado_por: sesion.email,
  }
  const { data: seg, error: sErr } = await (supabase.from('gatwick_seguimientos') as any)
    .insert(fila).select('*').single()
  if (sErr) throw createError({ statusCode: 500, statusMessage: `Error creando el seguimiento: ${sErr.message}` })

  // Emergencia pasa a "en_curso"
  await (supabase.from('gatwick_emergencias') as any)
    .update({ estado: 'en_curso', tecnico_id: tecnicoId }).eq('id', emergenciaId)
  if (tecnicoId) {
    await (supabase.from('gatwick_tecnicos') as any).update({ estado: 'en_servicio' }).eq('id', tecnicoId)
  }

  // ── 7. Avisar a los supervisores ──
  const base = baseUrl(event)
  const linkTecnico = `${base}/gatwick/tecnico/${token}`
  const linkSupervisor = `${base}/gatwick/seguimiento/${token}`
  const mensaje = mensajeParaEstado('iniciado', { emergencia: emergFinal, seguimiento: seg, linkSupervisor })
  const aviso = await avisarSupervisores(supabase, mensaje, 'seguimiento')

  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'gatwick', tool_name: 'Seguimiento Emergencia',
      input_data: {
        evento: 'INICIADO',
        emergencia_id: emergenciaId,
        codigo_ascensor: codigo || null,
        edificio: emergFinal.edificio_nombre || emergFinal.empresa_cliente,
        direccion: direccionDestino,
        distrito: emergFinal.distrito,
        elme: emergFinal.elme,
        tecnico: tecNombre,
        iniciado_por: sesion.email,
      },
      output_data: {
        seguimiento_id: seg.id, estado: 'iniciado',
        destino_geocodificado: destinoLat != null,
        destino: destinoLat != null ? `${destinoLat},${destinoLng}` : null,
        supervisores_avisados: aviso.enviados,
        supervisores_fallidos: aviso.fallidos,
      },
      status: aviso.fallidos ? 'warning' : 'success',
    })
  } catch {}

  console.log(`[gatwick/seguimiento] INICIADO #${seg.id} emerg=${emergenciaId} tecnico=${tecNombre} avisos=${aviso.enviados}/${aviso.enviados + aviso.fallidos}`)
  return {
    ok: true, seguimiento: seg, emergencia: emergFinal,
    link_tecnico: linkTecnico, link_supervisor: linkSupervisor,
    destino_ubicado: destinoLat != null, aviso,
  }
})
