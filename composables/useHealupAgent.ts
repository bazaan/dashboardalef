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

  // ── Web Speech API: reconocimiento (input) ──
  let recognition: any = null
  const initRecognition = () => {
    if (!import.meta.client || recognition) return
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    recognition = new SR()
    recognition.lang = 'es-PE'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      inputText.value = text
    }
    recognition.onerror = (e: any) => {
      lastError.value = `Error de voz: ${e?.error || 'desconocido'}`
      isListening.value = false
    }
    recognition.onend = () => {
      isListening.value = false
      // Auto-enviar si hay texto
      if (inputText.value.trim()) {
        sendMessage(inputText.value)
      }
    }
  }

  const startListening = () => {
    if (!import.meta.client) return
    initRecognition()
    if (!recognition) {
      lastError.value = 'Tu navegador no soporta reconocimiento de voz. Usá Chrome/Edge o escribí.'
      return
    }
    inputText.value = ''
    try {
      recognition.start()
      isListening.value = true
    } catch (e: any) {
      lastError.value = `No se pudo iniciar el micrófono: ${e?.message || e}`
    }
  }
  const stopListening = () => {
    if (recognition && isListening.value) {
      try { recognition.stop() } catch {}
    }
    isListening.value = false
  }

  // ── Síntesis de voz (output) ──
  const speak = (text: string) => {
    if (!import.meta.client || !window.speechSynthesis) return
    stopSpeaking()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-PE'
    u.rate = 1.05
    u.pitch = 1.0
    u.onstart = () => { isSpeaking.value = true }
    u.onend = () => { isSpeaking.value = false }
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
        const nm = String(parseInt(m) % 12 + 1).padStart(2, '0')
        const ny = parseInt(m) === 12 ? String(parseInt(y) + 1) : y

        // Pacientes nuevos (created_at)
        const wppQ = (supabase.from('PacientesBDwppHEALUP') as any)
          .select('id,precio,precio_tratamiento', { count: 'exact', head: false })
          .gte('created_at', `${mes}-01`).lt('created_at', `${ny}-${nm}-01`)
        const fbigQ = (supabase.from('PacientesBDfbigHEALUP') as any)
          .select('id,precio,precio_tratamiento', { count: 'exact', head: false })
          .gte('created_at', `${mes}-01`).lt('created_at', `${ny}-${nm}-01`)
        const egrQ = (supabase.from('egresos_healup') as any)
          .select('precio,cantidad')
          .gte('created_at', `${mes}-01`).lt('created_at', `${ny}-${nm}-01`)

        const [wpp, fbig, egr] = await Promise.all([wppQ, fbigQ, egrQ])
        const sumPac = (rows: any[]) => (rows || []).reduce((s, p) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)
        const ingresos = sumPac(wpp.data || []) + sumPac(fbig.data || [])
        const egresos = (egr.data || []).reduce((s: number, e: any) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
        const pacientes = (wpp.data?.length || 0) + (fbig.data?.length || 0)
        return JSON.stringify({
          ok: true, mes, pacientes_convertidos: pacientes,
          ingresos: +ingresos.toFixed(2),
          egresos: +egresos.toFixed(2),
          utilidad: +(ingresos - egresos).toFixed(2)
        })
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
      // Loop de tool use: hasta 5 iteraciones para evitar bucles
      for (let i = 0; i < 5; i++) {
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
    open, close, reset, sendMessage,
    startListening, stopListening, speak, stopSpeaking,
    setShortcut,
  }
}
