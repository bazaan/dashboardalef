// Healup Agent — composable de chat conversacional con tool use de Claude.
// Maneja: atajo de teclado configurable · reconocimiento de voz · síntesis
// de voz · loop de tool use con Anthropic vía /api/healup/agent-chat ·
// ejecución client-side de las tools sobre Supabase (con sesión del usuario).

interface ToolUse { type: 'tool_use'; id: string; name: string; input: any }
interface TextBlock { type: 'text'; text: string }
interface MsgUser { role: 'user'; content: string | Array<{type:'tool_result'; tool_use_id: string; content: string}> }
interface MsgAssistant { role: 'assistant'; content: Array<TextBlock | ToolUse> }
type AnthropicMsg = MsgUser | MsgAssistant

interface ChatTurn {
  role: 'user' | 'assistant' | 'tool'
  text: string
  ts: number
}

const STORAGE_KEY = 'healup_agent_shortcut_v1'

// Atajo de teclado: por defecto Cmd/Ctrl + J (no Cmd+K que se usa para search).
// Configurable: el usuario guarda { key, meta, ctrl, alt, shift }.
interface KeyShortcut {
  key: string         // ej. 'j'
  meta?: boolean      // Cmd en Mac
  ctrl?: boolean      // Ctrl
  alt?: boolean
  shift?: boolean
}
const DEFAULT_SHORTCUT: KeyShortcut = { key: 'j', meta: true, ctrl: true }

const loadShortcut = (): KeyShortcut => {
  if (!import.meta.client) return DEFAULT_SHORTCUT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SHORTCUT, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SHORTCUT
}

const saveShortcut = (s: KeyShortcut) => {
  if (!import.meta.client) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export const useHealupAgent = () => {
  const supabase = useSupabaseClient()

  // ── Estado reactivo ──
  const isOpen = ref(false)
  const isThinking = ref(false)
  const isListening = ref(false)
  const isSpeaking = ref(false)
  const turns = ref<ChatTurn[]>([])
  const inputText = ref('')
  const shortcut = ref<KeyShortcut>(loadShortcut())
  const lastError = ref<string>('')
  const conversationId = ref<string>('')

  // ── Anthropic message history (no se muestra en UI, es para el modelo) ──
  const messages = ref<AnthropicMsg[]>([])

  const open = () => { isOpen.value = true; lastError.value = '' }
  const close = () => {
    isOpen.value = false
    stopListening()
    stopSpeaking()
  }
  const reset = () => {
    turns.value = []
    messages.value = []
    inputText.value = ''
    lastError.value = ''
    conversationId.value = `conv-${Date.now()}`
  }

  // ── Micrófono: enumerar dispositivos ──
  const availableMics = ref<{ deviceId: string; label: string }[]>([])
  const selectedMicId = ref<string>('')
  let activeStream: MediaStream | null = null

  const loadMics = async () => {
    if (!import.meta.client) return
    try {
      // Pedir permiso primero (necesario para ver labels)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      availableMics.value = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Micrófono ${d.deviceId.slice(0, 6)}` }))
      // Restaurar selección guardada
      if (import.meta.client) {
        const saved = localStorage.getItem('healup_agent_mic_v1')
        if (saved && availableMics.value.some(m => m.deviceId === saved)) {
          selectedMicId.value = saved
        }
      }
    } catch (e: any) {
      console.warn('[Agent] No se pudo enumerar micrófonos:', e?.message)
    }
  }

  const setMic = (deviceId: string) => {
    selectedMicId.value = deviceId
    if (import.meta.client) {
      try { localStorage.setItem('healup_agent_mic_v1', deviceId) } catch {}
    }
  }

  // ── Whisper transcription via MediaRecorder ──
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []

  const releaseStream = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop())
      activeStream = null
    }
  }

  const startListening = async () => {
    if (!import.meta.client) return
    inputText.value = ''
    lastError.value = ''
    try {
      releaseStream()
      const constraints: any = {
        audio: selectedMicId.value ? { deviceId: { exact: selectedMicId.value } } : true
      }
      activeStream = await navigator.mediaDevices.getUserMedia(constraints)
      audioChunks = []
      // Prefer webm (Chrome), fallback to mp4 (Safari)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      mediaRecorder = mimeType
        ? new MediaRecorder(activeStream, { mimeType })
        : new MediaRecorder(activeStream)
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        releaseStream()
        if (!audioChunks.length) { isListening.value = false; return }
        const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        audioChunks = []
        // Transcribir con Whisper
        isListening.value = false
        isThinking.value = true
        inputText.value = 'Transcribiendo...'
        try {
          const ext = (mediaRecorder?.mimeType || '').includes('mp4') ? 'mp4' : 'webm'
          const formData = new FormData()
          formData.append('audio', blob, `audio.${ext}`)
          const resp: any = await $fetch('/api/healup/transcribe', {
            method: 'POST',
            body: formData
          })
          const text = (resp?.text || '').trim()
          if (text) {
            inputText.value = text
            // Auto-send
            sendMessage(text)
          } else {
            inputText.value = ''
            lastError.value = 'No se detectó audio. Intentá de nuevo.'
            isThinking.value = false
          }
        } catch (e: any) {
          inputText.value = ''
          lastError.value = `Error al transcribir: ${e?.data?.statusMessage || e?.message || e}`
          isThinking.value = false
        }
      }
      mediaRecorder.start()
      isListening.value = true
    } catch (e: any) {
      lastError.value = `No se pudo iniciar el micrófono: ${e?.message || e}`
      releaseStream()
    }
  }

  const stopListening = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    } else {
      isListening.value = false
      releaseStream()
    }
  }

  // ── Síntesis de voz (output) ──
  const autoListenAfterSpeak = ref(false)

  const getSpanishVoice = (): SpeechSynthesisVoice | null => {
    if (!import.meta.client || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices()
    // Prefer: es-PE > es-MX > es-ES > any es-*
    return voices.find(v => v.lang === 'es-PE')
      || voices.find(v => v.lang === 'es-MX')
      || voices.find(v => v.lang === 'es-ES')
      || voices.find(v => v.lang.startsWith('es'))
      || null
  }

  const speak = (text: string) => {
    if (!import.meta.client || !window.speechSynthesis) return
    stopSpeaking()
    const u = new SpeechSynthesisUtterance(text)
    const voice = getSpanishVoice()
    if (voice) { u.voice = voice; u.lang = voice.lang }
    else u.lang = 'es-PE'
    u.rate = 1.05
    u.pitch = 1.0
    u.onstart = () => { isSpeaking.value = true }
    u.onend = () => {
      isSpeaking.value = false
      // Auto-restart mic for hands-free conversation
      if (autoListenAfterSpeak.value) {
        setTimeout(() => startListening(), 300)
      }
    }
    u.onerror = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(u)
  }
  const stopSpeaking = () => {
    if (import.meta.client && window.speechSynthesis) {
      try { window.speechSynthesis.cancel() } catch {}
    }
    isSpeaking.value = false
  }

  // ── Tool execution (cliente, con sesión Supabase) ──
  const executeTool = async (name: string, input: any): Promise<string> => {
    try {
      if (name === 'register_egreso') {
        const fd = input || {}
        const fechaIso = fd.fecha
          ? new Date(`${fd.fecha}T12:00:00`).toISOString()
          : new Date().toISOString()
        const esInsumo = fd.categoria === 'INSUMOS'
        const payload: any = {
          tipo_egreso: fd.categoria || 'OTROS',
          nombre: fd.nombre,
          precio: Number(fd.precio) || 0,
          cantidad: Number(fd.cantidad) || 1,
          categoria: fd.categoria,
          metodo_pago: fd.metodo_pago,
          referencia: fd.referencia || null,
          producto: esInsumo ? (fd.producto || null) : null,
          unidad: esInsumo ? (fd.unidad || null) : null,
          precio_unitario: esInsumo ? (Number(fd.precio_unitario) || null) : null,
          company_id: 'healup',
          created_at: fechaIso
        }
        const { data, error } = await (supabase.from('egresos_healup') as any).insert(payload).select().single()
        if (error) {
          // Retry sin campos nuevos si BD aún sin migrar
          const slim = { tipo_egreso: payload.tipo_egreso, nombre: payload.nombre, precio: payload.precio, cantidad: payload.cantidad, company_id: 'healup', created_at: fechaIso }
          const r2 = await (supabase.from('egresos_healup') as any).insert(slim).select().single()
          if (r2.error) return JSON.stringify({ ok: false, error: r2.error.message })
          return JSON.stringify({ ok: true, id: r2.data?.id, total: payload.precio * payload.cantidad, fallback: true })
        }
        return JSON.stringify({
          ok: true,
          id: data?.id,
          total: payload.precio * payload.cantidad,
          categoria: fd.categoria,
          metodo_pago: fd.metodo_pago,
          fecha: fechaIso.slice(0, 10)
        })
      }

      if (name === 'list_egresos_mes') {
        const mes = (input?.mes as string) || (() => {
          const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        })()
        const [y, m] = mes.split('-')
        const nm = String(parseInt(m) % 12 + 1).padStart(2, '0')
        const ny = parseInt(m) === 12 ? String(parseInt(y) + 1) : y
        const { data, error } = await (supabase.from('egresos_healup') as any)
          .select('id,nombre,categoria,precio,cantidad,metodo_pago,created_at')
          .gte('created_at', `${mes}-01`)
          .lt('created_at', `${ny}-${nm}-01`)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) return JSON.stringify({ ok: false, error: error.message })
        const total = (data || []).reduce((s: number, e: any) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
        return JSON.stringify({
          ok: true,
          mes,
          count: data?.length || 0,
          total,
          movimientos: (data || []).slice(0, 20).map((e: any) => ({
            id: e.id, nombre: e.nombre, categoria: e.categoria,
            total: (Number(e.precio) || 0) * (Number(e.cantidad) || 0),
            metodo: e.metodo_pago, fecha: (e.created_at || '').slice(0, 10)
          }))
        })
      }

      if (name === 'resumen_mes') {
        const mes = (input?.mes as string) || (() => {
          const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        })()
        const [y, m] = mes.split('-')
        const mesNum = parseInt(m) - 1 // 0-indexed for JS Date
        const yearNum = parseInt(y)
        const nm = String(parseInt(m) % 12 + 1).padStart(2, '0')
        const ny = parseInt(m) === 12 ? String(parseInt(y) + 1) : y

        // Pacientes — fetch all and filter by fecha_agendamiento (matches dashboard logic)
        const wppQ = (supabase.from('PacientesBDwppHEALUP') as any)
          .select('id,precio,precio_tratamiento,fecha_agendamiento,metodo_de_pago')
        const fbigQ = (supabase.from('PacientesBDfbigHEALUP') as any)
          .select('id,precio,precio_tratamiento,fecha_agendamiento,metodo_de_pago')
        const egrQ = (supabase.from('egresos_healup') as any)
          .select('precio,cantidad,metodo_pago,descartado,deleted_at')
          .gte('created_at', `${mes}-01`).lt('created_at', `${ny}-${nm}-01`)

        const [wpp, fbig, egr] = await Promise.all([wppQ, fbigQ, egrQ])

        // Filter pacientes by fecha_agendamiento month (same as dashboard)
        const filterByMonth = (rows: any[]) => (rows || []).filter((p: any) => {
          if (!p.fecha_agendamiento) return false
          const d = new Date(p.fecha_agendamiento)
          return d.getMonth() === mesNum && d.getFullYear() === yearNum
        })
        const pacMes = [...filterByMonth(wpp.data || []), ...filterByMonth(fbig.data || [])]
        const ingresos = pacMes.reduce((s: number, p: any) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)

        const egresosActivos = (egr.data || []).filter((e: any) => !e.descartado && !e.deleted_at)
        const egresos = egresosActivos.reduce((s: number, e: any) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)

        // Caja chica (efectivo)
        const ingEfectivo = pacMes.filter((p: any) => (p.metodo_de_pago || '').toUpperCase() === 'EFECTIVO')
          .reduce((s: number, p: any) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)
        const egrEfectivo = egresosActivos.filter((e: any) => (e.metodo_pago || '').toUpperCase() === 'EFECTIVO')
          .reduce((s: number, e: any) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)

        return JSON.stringify({
          ok: true, mes,
          pacientes_convertidos: pacMes.length,
          ingresos: +ingresos.toFixed(2),
          egresos: +egresos.toFixed(2),
          utilidad: +(ingresos - egresos).toFixed(2),
          caja_chica_efectivo: +(ingEfectivo - egrEfectivo).toFixed(2)
        })
      }

      if (name === 'consultar_citas_hoy') {
        const fecha = input?.fecha || todayISO()
        const [y, m, d] = fecha.split('-')
        const ddmmyyyy = `${d}-${m}-${y}`
        const { data, error } = await (supabase.from('healup_calendar_events') as any)
          .select('id,client_name,client_surname,time,subject,estado,cabina,cobro_completado,metodo_reserva,monto_reserva')
          .or(`date.eq.${fecha},date.eq.${ddmmyyyy}`)
          .order('time', { ascending: true })
          .limit(30)
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({
          ok: true, fecha, total: data?.length || 0,
          citas: (data || []).map((c: any) => ({
            id: c.id,
            hora: (c.time || '').substring(0, 5),
            paciente: `${c.client_name || ''} ${c.client_surname || ''}`.trim(),
            procedimiento: c.subject || '',
            estado: c.estado || 'pendiente',
            cabina: c.cabina || 'cabina1',
            cobrado: !!c.cobro_completado,
            reserva: c.monto_reserva ? `S/${c.monto_reserva} ${c.metodo_reserva || ''}` : null
          }))
        })
      }

      if (name === 'crear_cita') {
        const payload: any = {
          date: input.fecha,
          time: `${input.hora}:00`,
          client_name: input.client_name,
          client_surname: input.client_surname || '',
          client_phone: input.client_phone || '',
          client_dni: input.client_dni || '',
          client_email: input.client_email || '',
          subject: input.subject,
          cabina: input.cabina || 'cabina1',
          company_id: 'healup',
          estado: 'pendiente',
          event_reason: 'Tratamiento'
        }
        const { data, error } = await (supabase.from('healup_calendar_events') as any).insert(payload).select().single()
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({ ok: true, id: data?.id, fecha: input.fecha, hora: input.hora, paciente: input.client_name, procedimiento: input.subject })
      }

      if (name === 'actualizar_cita') {
        const updates: any = {}
        if (input.estado) { updates.estado = input.estado; updates.estado_actualizado_en = new Date().toISOString() }
        if (input.hora) updates.time = `${input.hora}:00`
        if (input.fecha) updates.date = input.fecha
        if (input.subject) updates.subject = input.subject
        if (input.cobro_completado !== undefined) updates.cobro_completado = input.cobro_completado
        const { data, error } = await (supabase.from('healup_calendar_events') as any).update(updates).eq('id', input.cita_id).select().single()
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({ ok: true, id: input.cita_id, cambios: Object.keys(updates) })
      }

      if (name === 'buscar_paciente') {
        const results: any[] = []
        for (const tabla of ['PacientesBDwppHEALUP', 'PacientesBDfbigHEALUP']) {
          let q = (supabase.from(tabla) as any).select('id,nombre,dni,numero,correo,procedimiento,precio_tratamiento,estado,metodo_de_pago,fecha_agendamiento,created_at')
          if (input?.nombre) q = q.ilike('nombre', `%${input.nombre}%`)
          if (input?.dni) q = q.eq('dni', input.dni)
          if (input?.telefono) q = q.ilike('numero', `%${input.telefono}%`)
          const { data } = await q.order('created_at', { ascending: false }).limit(10)
          if (data?.length) results.push(...data.map((p: any) => ({ ...p, fuente: tabla.includes('wpp') ? 'WhatsApp' : 'FB/IG' })))
        }
        return JSON.stringify({ ok: true, total: results.length, pacientes: results.slice(0, 15) })
      }

      if (name === 'registrar_paciente') {
        const payload: any = {
          nombre: input.nombre,
          dni: input.dni || '',
          numero: input.numero || '',
          correo: input.correo || null,
          procedimiento: input.procedimiento || '',
          precio_tratamiento: Number(input.precio_tratamiento) || 0,
          metodo_de_pago: input.metodo_de_pago || '',
          fecha_agendamiento: input.fecha_agendamiento || null,
          estado: 'En espera',
          agendamiento: 'Dashboard',
          company_id: 'healup'
        }
        const { data, error } = await (supabase.from('PacientesBDwppHEALUP') as any).insert(payload).select().single()
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({ ok: true, id: data?.id, nombre: input.nombre })
      }

      if (name === 'actualizar_paciente') {
        const updates: any = {}
        if (input.estado) updates.estado = input.estado
        if (input.precio_tratamiento !== undefined) updates.precio_tratamiento = Number(input.precio_tratamiento)
        if (input.metodo_de_pago) updates.metodo_de_pago = input.metodo_de_pago
        if (input.procedimiento) updates.procedimiento = input.procedimiento
        const { data, error } = await (supabase.from('PacientesBDwppHEALUP') as any).update(updates).eq('id', input.paciente_id).select().single()
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({ ok: true, id: input.paciente_id, cambios: Object.keys(updates) })
      }

      if (name === 'listar_procedimientos') {
        let q = (supabase.from('healup_procedures') as any)
          .select('id,name,sku,grupo,price,tipo,cabina,activo')
          .eq('activo', true)
          .order('grupo').order('name')
        if (input?.grupo) q = q.ilike('grupo', `%${input.grupo}%`)
        if (input?.nombre) q = q.ilike('name', `%${input.nombre}%`)
        const { data, error } = await q.limit(50)
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({
          ok: true, total: data?.length || 0,
          procedimientos: (data || []).map((p: any) => ({
            id: p.id, nombre: p.name, sku: p.sku, grupo: p.grupo,
            precio_sin_igv: p.price, precio_con_igv: +(p.price * 1.18).toFixed(2),
            tipo: p.tipo, cabina: p.cabina
          }))
        })
      }

      if (name === 'consultar_stock') {
        let query = (supabase.from('healup_stock_items') as any)
          .select('id,nombre,categoria,unidad,cantidad_actual,umbral_minimo,costo_unitario')
          .order('nombre')
        if (input?.nombre) query = query.ilike('nombre', `%${input.nombre}%`)
        const { data, error } = await query.limit(50)
        if (error) return JSON.stringify({ ok: false, error: error.message })
        let items = data || []
        if (input?.solo_bajos) {
          items = items.filter((i: any) => Number(i.cantidad_actual) <= Number(i.umbral_minimo))
        }
        return JSON.stringify({
          ok: true, total_items: items.length,
          items: items.map((i: any) => ({
            id: i.id, nombre: i.nombre, categoria: i.categoria, unidad: i.unidad,
            cantidad: i.cantidad_actual, minimo: i.umbral_minimo,
            bajo: Number(i.cantidad_actual) <= Number(i.umbral_minimo)
          }))
        })
      }

      if (name === 'movimiento_stock') {
        // Insert movement
        const mov: any = {
          stock_item_id: input.stock_item_id,
          tipo: input.tipo,
          cantidad: Number(input.cantidad),
          motivo: input.motivo || null,
          notas: input.notas || null,
          registrado_por: 'agente_voz'
        }
        const { error: movErr } = await (supabase.from('healup_stock_movements') as any).insert(mov)
        if (movErr) return JSON.stringify({ ok: false, error: movErr.message })
        // Update stock quantity
        const delta = input.tipo === 'entrada' ? Number(input.cantidad) : -Number(input.cantidad)
        const { data: item } = await (supabase.from('healup_stock_items') as any).select('cantidad_actual,nombre').eq('id', input.stock_item_id).single()
        const nuevaCantidad = Math.max(0, Number(item?.cantidad_actual || 0) + delta)
        await (supabase.from('healup_stock_items') as any).update({ cantidad_actual: nuevaCantidad }).eq('id', input.stock_item_id)
        return JSON.stringify({ ok: true, item: item?.nombre, tipo: input.tipo, cantidad: input.cantidad, stock_actual: nuevaCantidad })
      }

      if (name === 'modificar_egreso') {
        if (input.eliminar) {
          const { error } = await (supabase.from('egresos_healup') as any).update({ descartado: true, deleted_at: new Date().toISOString() }).eq('id', input.egreso_id)
          if (error) return JSON.stringify({ ok: false, error: error.message })
          return JSON.stringify({ ok: true, accion: 'eliminado', id: input.egreso_id })
        }
        const updates: any = {}
        if (input.nombre) updates.nombre = input.nombre
        if (input.precio !== undefined) updates.precio = Number(input.precio)
        if (input.cantidad !== undefined) updates.cantidad = Number(input.cantidad)
        if (input.categoria) updates.categoria = input.categoria
        if (input.metodo_pago) updates.metodo_pago = input.metodo_pago
        const { data, error } = await (supabase.from('egresos_healup') as any).update(updates).eq('id', input.egreso_id).select().single()
        if (error) return JSON.stringify({ ok: false, error: error.message })
        return JSON.stringify({ ok: true, accion: 'modificado', id: input.egreso_id, cambios: Object.keys(updates) })
      }

      if (name === 'consultar_caja_chica') {
        const mes = (input?.mes as string) || (() => {
          const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        })()
        const [y, m] = mes.split('-')
        const nm = String(parseInt(m) % 12 + 1).padStart(2, '0')
        const ny = parseInt(m) === 12 ? String(parseInt(y) + 1) : y
        const desde = `${mes}-01`
        const hasta = `${ny}-${nm}-01`

        // Ingresos de pacientes (precio_reserva/precio + precio_tratamiento) por método de pago
        const [wppPac, fbigPac, egrData] = await Promise.all([
          (supabase.from('PacientesBDwppHEALUP') as any)
            .select('precio,precio_tratamiento,metodo_de_pago')
            .gte('created_at', desde).lt('created_at', hasta),
          (supabase.from('PacientesBDfbigHEALUP') as any)
            .select('precio,precio_tratamiento,metodo_de_pago')
            .gte('created_at', desde).lt('created_at', hasta),
          (supabase.from('egresos_healup') as any)
            .select('precio,cantidad,metodo_pago,descartado,deleted_at')
            .gte('created_at', desde).lt('created_at', hasta)
        ])

        const allPacientes = [...(wppPac.data || []), ...(fbigPac.data || [])]
        const sumPac = (rows: any[], esEfectivo: boolean) => rows
          .filter((p: any) => {
            const mp = (p.metodo_de_pago || '').toUpperCase()
            return esEfectivo ? mp === 'EFECTIVO' : (mp && mp !== 'EFECTIVO')
          })
          .reduce((s: number, p: any) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)

        const ingresosEfectivo = sumPac(allPacientes, true)
        const ingresosNoEfectivo = sumPac(allPacientes, false)

        const egresosActivos = (egrData.data || []).filter((e: any) => !e.descartado && !e.deleted_at)
        const sumEgr = (rows: any[], esEfectivo: boolean) => rows
          .filter((e: any) => {
            const mp = (e.metodo_pago || '').toUpperCase()
            return esEfectivo ? mp === 'EFECTIVO' : (mp && mp !== 'EFECTIVO')
          })
          .reduce((s: number, e: any) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)

        const egresosEfectivo = sumEgr(egresosActivos, true)
        const egresosNoEfectivo = sumEgr(egresosActivos, false)

        const cajaChica = ingresosEfectivo - egresosEfectivo
        const cuentaBancaria = ingresosNoEfectivo - egresosNoEfectivo

        return JSON.stringify({
          ok: true, mes,
          caja_chica_efectivo: +cajaChica.toFixed(2),
          ingresos_efectivo: +ingresosEfectivo.toFixed(2),
          egresos_efectivo: +egresosEfectivo.toFixed(2),
          cuenta_bancaria: +cuentaBancaria.toFixed(2),
          ingresos_no_efectivo: +ingresosNoEfectivo.toFixed(2),
          egresos_no_efectivo: +egresosNoEfectivo.toFixed(2),
          total_disponible: +(cajaChica + cuentaBancaria).toFixed(2)
        })
      }

      if (name === 'consultar_leads') {
        const limite = input?.limite || 20
        const results: any[] = []
        for (const tabla of ['GeneralBDwppHEALUP', 'GeneralBDfbigHEALUP']) {
          let q = (supabase.from(tabla) as any).select('id,nombre,numero,lead_status,reason_ia_qualification,servicio_interes,created_at')
          if (input?.estado) q = q.eq('lead_status', input.estado)
          if (input?.mes) {
            const [y, m] = input.mes.split('-')
            const nm = String(parseInt(m) % 12 + 1).padStart(2, '0')
            const ny = parseInt(m) === 12 ? String(parseInt(y) + 1) : y
            q = q.gte('created_at', `${input.mes}-01`).lt('created_at', `${ny}-${nm}-01`)
          }
          const { data } = await q.order('created_at', { ascending: false }).limit(limite)
          if (data?.length) results.push(...data.map((l: any) => ({ ...l, fuente: tabla.includes('wpp') ? 'WhatsApp' : 'FB/IG' })))
        }
        const frios = results.filter(l => l.lead_status?.includes('fri')).length
        const tibios = results.filter(l => l.lead_status?.includes('tibi')).length
        const calientes = results.filter(l => l.lead_status?.includes('caliente')).length
        return JSON.stringify({ ok: true, total: results.length, frios, tibios, calientes, leads: results.slice(0, limite) })
      }

      return JSON.stringify({ ok: false, error: `Tool desconocida: ${name}` })
    } catch (e: any) {
      return JSON.stringify({ ok: false, error: e?.message || String(e) })
    }
  }

  // ── Loop principal ──
  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!conversationId.value) conversationId.value = `conv-${Date.now()}`
    inputText.value = ''
    isThinking.value = true
    lastError.value = ''

    turns.value.push({ role: 'user', text: trimmed, ts: Date.now() })
    messages.value.push({ role: 'user', content: trimmed })

    try {
      // Loop de tool use: hasta 8 iteraciones (más tools = puede encadenar más)
      for (let i = 0; i < 8; i++) {
        const resp: any = await $fetch('/api/healup/agent-chat', {
          method: 'POST',
          body: { messages: messages.value }
        })
        // Empujar la respuesta del assistant al historial completo
        messages.value.push({ role: 'assistant', content: resp.content })

        // ¿Hay tool use?
        const toolUses = (resp.content || []).filter((b: any) => b.type === 'tool_use') as ToolUse[]
        const textBlocks = (resp.content || []).filter((b: any) => b.type === 'text') as TextBlock[]
        const replyText = textBlocks.map(b => b.text).join('\n').trim()

        if (replyText) {
          turns.value.push({ role: 'assistant', text: replyText, ts: Date.now() })
          // Hablar la respuesta si es la última (sin tool pendiente)
          if (toolUses.length === 0) speak(replyText)
        }

        if (toolUses.length === 0) break

        // Ejecutar cada tool y mandar resultados
        const results: any[] = []
        for (const tu of toolUses) {
          turns.value.push({ role: 'tool', text: `🔧 ${tu.name}…`, ts: Date.now() })
          const result = await executeTool(tu.name, tu.input)
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
        }
        messages.value.push({ role: 'user', content: results as any })
      }
    } catch (err: any) {
      const msg = err?.data?.statusMessage || err?.statusMessage || err?.message || String(err)
      lastError.value = msg
      turns.value.push({ role: 'assistant', text: `⚠️ ${msg}`, ts: Date.now() })
    } finally {
      isThinking.value = false
    }
  }

  // ── Atajo de teclado global ──
  const handleKeyDown = (e: KeyboardEvent) => {
    const s = shortcut.value
    const matchKey = e.key.toLowerCase() === s.key.toLowerCase()
    const matchMeta = !!s.meta === e.metaKey
    const matchCtrl = !!s.ctrl === e.ctrlKey
    const matchAlt = !!s.alt === e.altKey
    const matchShift = !!s.shift === e.shiftKey
    if (matchKey && matchMeta && matchCtrl && matchAlt && matchShift) {
      e.preventDefault()
      isOpen.value ? close() : open()
    }
    // Escape cierra
    if (isOpen.value && e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const setShortcut = (s: KeyShortcut) => {
    shortcut.value = s
    saveShortcut(s)
  }

  const shortcutLabel = computed(() => {
    const s = shortcut.value
    const parts: string[] = []
    if (s.meta) parts.push('⌘')
    if (s.ctrl) parts.push('Ctrl')
    if (s.alt) parts.push('Alt')
    if (s.shift) parts.push('Shift')
    parts.push(s.key.toUpperCase())
    return parts.join(' + ')
  })

  // Lifecycle
  onMounted(() => {
    if (!import.meta.client) return
    window.addEventListener('keydown', handleKeyDown)
    conversationId.value = `conv-${Date.now()}`
    // Preload voices (Web Speech API loads them async)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
  })
  onBeforeUnmount(() => {
    if (!import.meta.client) return
    window.removeEventListener('keydown', handleKeyDown)
    stopListening()
    stopSpeaking()
  })

  return {
    isOpen, isThinking, isListening, isSpeaking,
    turns, inputText, lastError, shortcut, shortcutLabel,
    autoListenAfterSpeak, availableMics, selectedMicId,
    open, close, reset, sendMessage,
    startListening, stopListening, speak, stopSpeaking,
    setShortcut, loadMics, setMic,
  }
}
