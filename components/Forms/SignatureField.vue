<template>
  <div class="sig-field">
    <!-- Selector de modo -->
    <div class="sig-modes">
      <button
        type="button"
        :class="['sig-mode', { active: mode === 'dibujar' }]"
        @click="mode = 'dibujar'"
      >
        <v-icon icon="mdi-draw-pen" size="16" />
        <span>Dibujar</span>
      </button>
      <button
        type="button"
        :class="['sig-mode', { active: mode === 'subir' }]"
        @click="mode = 'subir'"
      >
        <v-icon icon="mdi-image-outline" size="16" />
        <span>Subir imagen</span>
      </button>
    </div>

    <!-- ── Modo dibujar ── -->
    <div v-show="mode === 'dibujar'" class="sig-draw">
      <HealupSignaturePad ref="padRef" :model-value="modelValue" @update:model-value="onPad" />
      <button type="button" class="sig-expand" @click="abrirPantallaCompleta">
        <v-icon icon="mdi-arrow-expand-all" size="16" />
        <span>Firmar en pantalla completa</span>
      </button>
    </div>

    <!-- ── Modo subir ── -->
    <div v-show="mode === 'subir'" class="sig-upload">
      <input
        ref="fileRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="sig-file-input"
        @change="onFile"
      />

      <div v-if="modelValue" class="sig-preview">
        <img :src="modelValue" alt="Firma" />
      </div>

      <div class="sig-upload-actions">
        <button type="button" class="sig-btn" @click="fileRef?.click()">
          <v-icon icon="mdi-upload" size="16" />
          <span>{{ modelValue ? 'Cambiar imagen' : 'Elegir imagen' }}</span>
        </button>
        <button v-if="modelValue" type="button" class="sig-btn danger" @click="limpiar">
          <v-icon icon="mdi-delete-outline" size="16" />
          <span>Quitar</span>
        </button>
      </div>

      <p class="sig-hint">PNG, JPG o WEBP. Se reduce automáticamente si es muy grande.</p>
      <p v-if="uploadError" class="sig-error">{{ uploadError }}</p>
    </div>

    <!-- ── Pantalla completa ── -->
    <v-dialog v-model="fullscreen" fullscreen :scrim="false" transition="dialog-bottom-transition">
      <div class="sig-fs">
        <div class="sig-fs-bar">
          <span>Firma con el dedo</span>
          <v-btn icon="mdi-close" variant="text" size="small" @click="fullscreen = false" />
        </div>

        <div class="sig-fs-pad">
          <!-- El pad se monta al abrir el diálogo y reconstruye la firma que ya
               hubiera, así no se pierde el trazo hecho en el campo pequeño. -->
          <HealupSignaturePad v-if="fullscreen" v-model="fsValue" />
        </div>

        <div class="sig-fs-actions">
          <button type="button" class="sig-btn" @click="fullscreen = false">Cancelar</button>
          <button type="button" class="sig-btn primary" @click="confirmarPantallaCompleta">
            Usar esta firma
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [v: string | null] }>()

type Modo = 'dibujar' | 'subir'
const mode = ref<Modo>('dibujar')

const padRef      = ref<any>(null)
const fileRef     = ref<HTMLInputElement | null>(null)
const fullscreen  = ref(false)
const fsValue     = ref<string | null>(null)
const uploadError = ref<string | null>(null)

// Ancho máximo al que se reduce una imagen subida. Sin esto, una foto de
// celular se guardaría como varios MB de base64 dentro de la respuesta.
const MAX_ANCHO = 1200
const MAX_BYTES = 10 * 1024 * 1024

function onPad(v: string | null) {
  emit('update:modelValue', v)
}

function limpiar() {
  uploadError.value = null
  if (fileRef.value) fileRef.value.value = ''
  emit('update:modelValue', null)
}

function abrirPantallaCompleta() {
  fsValue.value = props.modelValue
  fullscreen.value = true
}

function confirmarPantallaCompleta() {
  emit('update:modelValue', fsValue.value)
  fullscreen.value = false
}

function onFile(e: Event) {
  uploadError.value = null
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    uploadError.value = 'El archivo debe ser una imagen.'
    return
  }
  if (file.size > MAX_BYTES) {
    uploadError.value = 'La imagen supera los 10 MB.'
    return
  }

  const reader = new FileReader()
  reader.onerror = () => { uploadError.value = 'No se pudo leer el archivo.' }
  reader.onload = () => {
    const img = new Image()
    img.onerror = () => { uploadError.value = 'La imagen está dañada o no se pudo abrir.' }
    img.onload = () => {
      const escala = Math.min(1, MAX_ANCHO / img.width)
      const w = Math.max(1, Math.round(img.width * escala))
      const h = Math.max(1, Math.round(img.height * escala))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { uploadError.value = 'No se pudo procesar la imagen.'; return }

      // Fondo blanco: un PNG con transparencia se vería negro sobre el PDF
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      emit('update:modelValue', canvas.toDataURL('image/png'))
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.sig-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sig-modes {
  display: flex;
  gap: 6px;
}

.sig-mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.sig-mode.active {
  border-color: rgba(218, 165, 32, 0.9);
  background: rgba(218, 165, 32, 0.12);
}

.sig-expand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  margin-top: 8px;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.16);
  color: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}

.sig-file-input {
  display: none;
}

.sig-preview {
  background: #fff;
  border-radius: 10px;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.sig-preview img {
  display: block;
  max-width: 100%;
  max-height: 200px;
  margin: 0 auto;
}

.sig-upload-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sig-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.sig-btn.primary {
  border-color: rgba(218, 165, 32, 0.9);
  background: rgba(218, 165, 32, 0.18);
}

.sig-btn.danger {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.sig-hint {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.65;
}

.sig-error {
  margin: 0;
  font-size: 0.82rem;
  color: #ef4444;
}

/* ── Pantalla completa ── */
.sig-fs {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #0f172a;
  color: #f1f5f9;
}

.sig-fs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.sig-fs-pad {
  flex: 1;
  padding: 12px;
  display: flex;
  align-items: center;
}

/* El contenedor del pad trae height:200px fijo; en pantalla completa se
   estira para aprovechar todo el alto disponible. */
.sig-fs-pad :deep(.signature-pad-wrapper) {
  width: 100%;
}

.sig-fs-pad :deep(.signature-canvas-container) {
  height: min(70dvh, 520px);
}

.sig-fs-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
