<!--
  Trade Cars — Módulo: Tasador IA
  --------------------------------
  Chat conectado a ChatGPT (OpenAI) para ayudar a tasar autos. La prioridad de
  respuesta es SIEMPRE las tablas propias de Trade Cars — compras y ventas
  históricas, negociaciones del funnel, stock, solicitudes de venta de la
  web — y sólo cuando ninguna tiene el dato, el modelo recurre a su
  conocimiento general del mercado (aclarándolo). Todo ese cruce de tablas
  pasa en el servidor (server/api/tradecars/tasador-chat.post.ts): este
  componente sólo manda texto y recibe texto, sin saber nada de las tools.

  "Por el momento" es sólo un chat de texto — sin voz, sin acciones que
  escriban en la base (a diferencia de HealupAgent). El historial se guarda en
  localStorage del navegador, no en Supabase: es una conversación de trabajo,
  no un registro que otros asesores necesiten ver.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Tasador IA</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" :disabled="!mensajes.length" @click="nuevaConversacion">
          <v-icon icon="mdi-broom" size="16" /><span>Nueva conversación</span>
        </button>
      </div>
    </header>

    <div class="content-area tasador-area">
      <div ref="scrollRef" class="tasador-mensajes">
        <div v-if="!mensajes.length" class="tasador-bienvenida">
          <v-icon icon="mdi-car-search-outline" size="46" style="opacity:0.4;" />
          <p class="tasador-bienvenida-texto">
            Preguntame por un precio de referencia, el stock actual o una compra/venta pasada.
            Reviso primero las tablas de Trade Cars antes de dar cualquier cifra.
          </p>
          <div class="tasador-sugerencias">
            <button v-for="s in sugerencias" :key="s" class="tasador-chip" @click="enviarMensaje(s)">
              {{ s }}
            </button>
          </div>
        </div>

        <div v-for="(m, i) in mensajes" :key="i" :class="['tasador-msg', 'rol-' + m.role]">
          <div class="tasador-avatar">
            <v-icon :icon="m.role === 'user' ? 'mdi-account' : 'mdi-car-wrench'" size="16" />
          </div>
          <div class="tasador-burbuja">{{ m.content }}</div>
        </div>

        <div v-if="pensando" class="tasador-msg rol-assistant">
          <div class="tasador-avatar"><v-icon icon="mdi-car-wrench" size="16" /></div>
          <div class="tasador-burbuja tasador-pensando">
            <span class="tasador-typing"><span></span><span></span><span></span></span>
            Consultando las tablas de Trade Cars…
          </div>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable
          @click:close="error = ''">
          {{ error }}
        </v-alert>
      </div>

      <div class="tasador-input">
        <v-textarea v-model="borrador" placeholder="Escribí tu pregunta… (Enter envía, Shift+Enter salto de línea)"
          density="compact" variant="outlined" rows="1" max-rows="5" auto-grow hide-details
          :disabled="pensando" @keydown="onKeydown" />
        <button class="btn-primary tasador-enviar" :disabled="pensando || !borrador.trim()"
          @click="enviarMensaje()">
          <v-icon icon="mdi-send" size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ notificar: [texto: string, color?: string] }>()

interface TasadorMensaje { role: 'user' | 'assistant'; content: string }

const mensajes = usePersistente<TasadorMensaje[]>('tradecars:tasador:mensajes', [])
const borrador = ref('')
const pensando = ref(false)
const error = ref('')
const scrollRef = ref<HTMLElement | null>(null)

const sugerencias = [
  '¿Cuánto se ha pagado antes por un Toyota Yaris 2018?',
  '¿Qué tenemos en stock ahora mismo?',
  'Referencia de precio para un Hyundai Accent 2020',
  '¿Cuál fue el margen en las últimas ventas de Kia?',
]

function scrollAbajo() {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    enviarMensaje()
  }
}

async function enviarMensaje(textoSugerido?: string) {
  const texto = (textoSugerido ?? borrador.value).trim()
  if (!texto || pensando.value) return

  error.value = ''
  mensajes.value = [...mensajes.value, { role: 'user', content: texto }]
  borrador.value = ''
  pensando.value = true
  scrollAbajo()

  try {
    const resp = await $fetch<{ reply: string }>('/api/tradecars/tasador-chat', {
      method: 'POST',
      body: { messages: mensajes.value },
    })
    mensajes.value = [...mensajes.value, { role: 'assistant', content: resp.reply }]
  } catch (e: any) {
    const msg = e?.data?.statusMessage || e?.statusMessage || e?.message || 'No se pudo consultar al Tasador'
    error.value = msg
    emit('notificar', msg, 'error')
  } finally {
    pensando.value = false
    scrollAbajo()
  }
}

function nuevaConversacion() {
  mensajes.value = []
  error.value = ''
}
</script>

<style scoped>
.tasador-area {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  min-height: 420px;
}

.tasador-mensajes {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 4px 12px;
}

.tasador-bienvenida {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 16px;
  margin: auto 0;
}
.tasador-bienvenida-texto {
  max-width: 440px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: var(--muted-foreground);
  line-height: 1.5;
}
.tasador-sugerencias {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 18px;
  max-width: 560px;
}
.tasador-chip {
  font-size: 0.78rem;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.15s ease;
}
.tasador-chip:hover { background: rgba(218, 165, 32, 0.14); border-color: #daa520; }

.tasador-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 78%;
}
.tasador-msg.rol-user {
  flex-direction: row-reverse;
  align-self: flex-end;
}
.tasador-avatar {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--muted);
  color: var(--muted-foreground);
}
.rol-user .tasador-avatar { background: rgba(218, 165, 32, 0.18); color: #daa520; }

.tasador-burbuja {
  background: var(--muted);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 0.86rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.rol-user .tasador-burbuja { background: rgba(218, 165, 32, 0.14); }

.tasador-pensando { display: flex; align-items: center; gap: 8px; opacity: 0.75; }
.tasador-typing { display: inline-flex; gap: 3px; }
.tasador-typing span {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--muted-foreground);
  animation: tasador-blink 1.2s infinite ease-in-out;
}
.tasador-typing span:nth-child(2) { animation-delay: 0.2s; }
.tasador-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes tasador-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

.tasador-input {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.tasador-input :deep(textarea) { font-size: 0.86rem; }
.tasador-enviar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tasador-enviar:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 700px) {
  .tasador-msg { max-width: 92%; }
}
</style>
