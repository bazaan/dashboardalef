<template>
  <ClientOnly>
    <!-- Botón flotante (siempre visible para abrir el agente) -->
    <button v-if="!isOpen" class="agent-fab" @click="open"
      :title="`Asistente de voz · ${shortcutLabel}`">
      <v-icon icon="mdi-microphone" size="28" color="white" />
    </button>

    <!-- Panel de chat deslizante -->
    <transition name="agent-slide">
      <div v-if="isOpen" class="agent-panel">
        <!-- Header -->
        <div class="agent-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <v-icon icon="mdi-robot-happy" color="amber" size="22" />
            <div>
              <div style="font-weight:700; font-size:0.95rem;">Asistente Healup</div>
              <div style="font-size:0.72rem; opacity:0.65;">
                Hablale: "registrá un egreso de 50 soles en yape por delivery"
              </div>
            </div>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <v-btn :icon="autoListenAfterSpeak ? 'mdi-headphones' : 'mdi-headphones-off'"
              size="small" variant="text"
              :color="autoListenAfterSpeak ? 'amber' : ''"
              @click="autoListenAfterSpeak = !autoListenAfterSpeak"
              :title="autoListenAfterSpeak ? 'Manos libres: ON' : 'Manos libres: OFF'" />
            <v-btn icon="mdi-cog-outline" size="small" variant="text"
              @click="showSettings = !showSettings" :title="`Atajo: ${shortcutLabel}`" />
            <v-btn icon="mdi-broom" size="small" variant="text" @click="reset" title="Nueva conversacion" />
            <v-btn icon="mdi-close" size="small" variant="text" @click="close" />
          </div>
        </div>

        <!-- Settings: micrófono + atajo -->
        <div v-if="showSettings" class="agent-settings">
          <!-- Selector de micrófono -->
          <div style="font-size:0.78rem; opacity:0.75; margin-bottom:6px;">Microfono</div>
          <v-select
            :model-value="selectedMicId"
            @update:model-value="setMic($event)"
            :items="availableMics"
            item-title="label"
            item-value="deviceId"
            density="compact"
            variant="outlined"
            hide-details
            placeholder="Microfono del sistema"
            style="margin-bottom:12px;"
          >
            <template #prepend-inner>
              <v-icon icon="mdi-microphone" size="16" />
            </template>
          </v-select>

          <!-- Atajo de teclado -->
          <div style="font-size:0.78rem; opacity:0.75; margin-bottom:6px;">Atajo de teclado</div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <v-checkbox v-model="newShortcutMeta" label="⌘ Cmd" density="compact" hide-details style="flex:0 0 auto;" />
            <v-checkbox v-model="newShortcutCtrl" label="Ctrl" density="compact" hide-details style="flex:0 0 auto;" />
            <v-checkbox v-model="newShortcutAlt" label="Alt" density="compact" hide-details style="flex:0 0 auto;" />
            <v-checkbox v-model="newShortcutShift" label="Shift" density="compact" hide-details style="flex:0 0 auto;" />
            <v-text-field v-model="newShortcutKey" label="Tecla" density="compact" hide-details
              maxlength="1" style="max-width:80px;" variant="outlined" />
            <v-btn size="small" color="primary" @click="aplicarShortcut">Guardar</v-btn>
          </div>
          <div style="font-size:0.72rem; opacity:0.6; margin-top:4px;">
            Actual: <strong>{{ shortcutLabel }}</strong> · Presionalo en cualquier parte del dashboard para abrir.
          </div>
        </div>

        <!-- Mensajes -->
        <div ref="msgScroll" class="agent-messages">
          <div v-if="turns.length === 0" class="agent-welcome">
            <v-icon icon="mdi-chat-question-outline" size="48" style="opacity:0.4;" />
            <p style="margin-top:8px; font-size:0.88rem; opacity:0.7;">¿En qué te ayudo?</p>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:12px;">
              <button class="agent-suggestion" @click="sendMessage('Registrá un egreso de 50 soles en yape por delivery')">
                💸 Registrar un egreso (ejemplo)
              </button>
              <button class="agent-suggestion" @click="sendMessage('¿Cuánto gasté este mes?')">
                📊 ¿Cuánto gasté este mes?
              </button>
              <button class="agent-suggestion" @click="sendMessage('Dame el resumen del mes')">
                📈 Resumen financiero del mes
              </button>
              <button class="agent-suggestion" @click="sendMessage('¿Qué citas hay hoy?')">
                📅 Citas de hoy
              </button>
              <button class="agent-suggestion" @click="sendMessage('¿Hay insumos con stock bajo?')">
                📦 Stock bajo
              </button>
            </div>
          </div>
          <div v-for="(t, i) in turns" :key="i" :class="['agent-msg', `role-${t.role}`]">
            <div class="agent-msg-bubble">{{ t.text }}</div>
          </div>
          <div v-if="isThinking" class="agent-msg role-assistant">
            <div class="agent-msg-bubble" style="opacity:0.65;">
              <span class="agent-typing"><span></span><span></span><span></span></span>
              Pensando…
            </div>
          </div>
          <div v-if="lastError" style="background: rgba(239,68,68,0.12); border-radius:8px; padding:8px 12px; font-size:0.78rem; color:#ef4444; margin-top:8px;">
            {{ lastError }}
          </div>
        </div>

        <!-- Input -->
        <div class="agent-input">
          <button class="agent-mic" :class="{ active: isListening }"
            @click="isListening ? stopListening() : startListening()"
            :disabled="isThinking"
            :title="isListening ? 'Parar grabacion (Whisper)' : 'Grabar voz (Whisper)'">
            <v-icon :icon="isListening ? 'mdi-stop' : 'mdi-microphone'" size="22" />
            <div v-if="isListening" class="mic-pulse"></div>
          </button>
          <input v-model="inputText" type="text"
            :placeholder="isListening ? 'Grabando... click mic para enviar' : 'Escribi o dicta tu mensaje...'"
            @keydown.enter="onEnter"
            :disabled="isThinking || isListening" />
          <button class="agent-send" :disabled="!inputText.trim() || isThinking || isListening" @click="onSend"
            :title="'Enviar (Enter)'">
            <v-icon icon="mdi-send" size="20" />
          </button>
          <button v-if="isSpeaking" class="agent-stop-speak" @click="stopSpeaking" title="Cortar voz">
            <v-icon icon="mdi-volume-off" size="20" />
          </button>
        </div>
      </div>
    </transition>
  </ClientOnly>
</template>

<script setup lang="ts">
const {
  isOpen, isThinking, isListening, isSpeaking,
  turns, inputText, lastError, shortcut, shortcutLabel,
  autoListenAfterSpeak, availableMics, selectedMicId,
  open, close, reset, sendMessage,
  startListening, stopListening, stopSpeaking, setShortcut, loadMics, setMic,
} = useHealupAgent()

const showSettings = ref(false)
watch(showSettings, (v) => { if (v) loadMics() })
const newShortcutKey   = ref(shortcut.value.key)
const newShortcutMeta  = ref(!!shortcut.value.meta)
const newShortcutCtrl  = ref(!!shortcut.value.ctrl)
const newShortcutAlt   = ref(!!shortcut.value.alt)
const newShortcutShift = ref(!!shortcut.value.shift)

const aplicarShortcut = () => {
  const k = (newShortcutKey.value || 'j').toLowerCase().slice(0, 1)
  setShortcut({
    key: k,
    meta:  newShortcutMeta.value,
    ctrl:  newShortcutCtrl.value,
    alt:   newShortcutAlt.value,
    shift: newShortcutShift.value,
  })
  showSettings.value = false
}

const onSend = () => {
  if (inputText.value.trim()) sendMessage(inputText.value)
}
const onEnter = (e: KeyboardEvent) => {
  if (e.shiftKey) return
  e.preventDefault()
  onSend()
}

// Auto-scroll al último mensaje
const msgScroll = ref<HTMLElement | null>(null)
watch(turns, () => {
  nextTick(() => {
    if (msgScroll.value) msgScroll.value.scrollTop = msgScroll.value.scrollHeight
  })
}, { deep: true })
</script>

<style scoped>
.agent-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #daa520, #b8860b);
  border: none;
  box-shadow: 0 6px 20px rgba(218,165,32,0.4);
  cursor: pointer;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}
.agent-fab:hover { transform: scale(1.08); box-shadow: 0 8px 28px rgba(218,165,32,0.55); }

.agent-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  max-width: calc(100vw - 40px);
  height: 580px;
  max-height: calc(100vh - 40px);
  background: var(--surface-1, #1e1e1e);
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}
.agent-slide-enter-active, .agent-slide-leave-active { transition: all 0.25s ease-out; }
.agent-slide-enter-from, .agent-slide-leave-to { opacity: 0; transform: translateY(20px) scale(0.96); }

.agent-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(218,165,32,0.06);
}
.agent-settings {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  background: rgba(255,255,255,0.02);
}
.agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.agent-welcome { text-align: center; padding: 24px 12px; }
.agent-suggestion {
  background: rgba(218,165,32,0.06);
  border: 1px solid rgba(218,165,32,0.2);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
  color: var(--text-primary, #eee);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.agent-suggestion:hover { background: rgba(218,165,32,0.12); }

.agent-msg { display: flex; }
.agent-msg.role-user { justify-content: flex-end; }
.agent-msg.role-assistant, .agent-msg.role-tool { justify-content: flex-start; }
.agent-msg-bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 0.86rem;
  line-height: 1.42;
  white-space: pre-wrap;
  word-break: break-word;
}
.role-user .agent-msg-bubble {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border-bottom-right-radius: 4px;
}
.role-assistant .agent-msg-bubble {
  background: rgba(218,165,32,0.12);
  color: var(--text-primary, #eee);
  border: 1px solid rgba(218,165,32,0.2);
  border-bottom-left-radius: 4px;
}
.role-tool .agent-msg-bubble {
  background: rgba(255,255,255,0.04);
  font-size: 0.76rem;
  opacity: 0.65;
  font-family: monospace;
}

.agent-typing { display: inline-flex; gap: 3px; margin-right: 6px; vertical-align: middle; }
.agent-typing span {
  display: inline-block; width: 5px; height: 5px; border-radius: 50%;
  background: #daa520; animation: agent-blink 1.4s infinite both;
}
.agent-typing span:nth-child(2) { animation-delay: 0.2s; }
.agent-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes agent-blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }

.agent-input {
  padding: 10px;
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  display: flex; gap: 6px; align-items: center;
  background: rgba(255,255,255,0.02);
}
.agent-input input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 8px 14px;
  color: var(--text-primary, #eee);
  font-size: 0.86rem;
  outline: none;
}
.agent-input input:focus { border-color: rgba(218,165,32,0.4); }
.agent-mic, .agent-send, .agent-stop-speak {
  background: rgba(218,165,32,0.12);
  border: 1px solid rgba(218,165,32,0.3);
  border-radius: 50%;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #daa520;
  position: relative;
  transition: all 0.15s;
}
.agent-mic:hover, .agent-send:not(:disabled):hover, .agent-stop-speak:hover {
  background: rgba(218,165,32,0.2);
}
.agent-send:disabled { opacity: 0.35; cursor: not-allowed; }
.agent-mic.active {
  background: rgba(239,68,68,0.25);
  border-color: rgba(239,68,68,0.6);
  color: #ef4444;
  animation: mic-glow 1.5s ease-in-out infinite;
}
@keyframes mic-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.3); }
  50% { box-shadow: 0 0 20px rgba(239,68,68,0.6); }
}
.mic-pulse {
  position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid #ef4444; opacity: 0;
  animation: mic-pulse 1.4s infinite;
}
@keyframes mic-pulse {
  0% { transform: scale(0.92); opacity: 0.7; }
  70% { transform: scale(1.2); opacity: 0; }
  100% { transform: scale(1.2); opacity: 0; }
}
</style>
