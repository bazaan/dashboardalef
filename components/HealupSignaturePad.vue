<template>
  <div class="signature-pad-wrapper">
    <div class="signature-label" v-if="label">{{ label }}</div>

    <div class="signature-canvas-container" :class="{ 'has-signature': hasSignature }">
      <canvas
        ref="canvasRef"
        class="signature-canvas"
        @mousedown="startDraw"
        @mousemove="draw"
        @mouseup="endDraw"
        @mouseleave="endDraw"
        @touchstart.prevent="startDraw"
        @touchmove.prevent="draw"
        @touchend.prevent="endDraw"
      ></canvas>

      <div v-if="!hasSignature" class="signature-placeholder">
        <v-icon icon="mdi-draw-pen" size="32" color="grey-lighten-1" />
        <span>Firme aquí con el dedo o stylus</span>
      </div>
    </div>

    <div class="signature-actions">
      <v-btn
        size="small"
        variant="text"
        color="error"
        prepend-icon="mdi-eraser"
        :disabled="!hasSignature"
        @click="clear"
      >Limpiar</v-btn>

      <span v-if="hasSignature" class="signature-status">
        <v-icon icon="mdi-check-circle" size="16" color="success" />
        Firma capturada
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

interface Props {
  modelValue?: string | null  // dataURL base64
  label?: string
  width?: number
  height?: number
  strokeColor?: string
  strokeWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  label: '',
  width: 600,
  height: 200,
  strokeColor: '#1a1a2e',
  strokeWidth: 2.4
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'signed':            [value: string]
  'cleared':           []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasSignature = ref(false)
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let lastX = 0
let lastY = 0

const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1

function setupCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  // Dimensions reales (CSS) y back buffer escalado para nitidez
  const rect = canvas.getBoundingClientRect()
  const w = rect.width || props.width
  const h = rect.height || props.height
  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = props.strokeColor
  ctx.lineWidth = props.strokeWidth
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
}

function getCoords(evt: MouseEvent | TouchEvent): { x: number; y: number } {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  let clientX = 0, clientY = 0
  if ('touches' in evt && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX
    clientY = evt.touches[0].clientY
  } else if ('changedTouches' in evt && evt.changedTouches.length > 0) {
    clientX = evt.changedTouches[0].clientX
    clientY = evt.changedTouches[0].clientY
  } else {
    clientX = (evt as MouseEvent).clientX
    clientY = (evt as MouseEvent).clientY
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}

function startDraw(evt: MouseEvent | TouchEvent) {
  if (!ctx) return
  drawing = true
  const { x, y } = getCoords(evt)
  lastX = x
  lastY = y
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function draw(evt: MouseEvent | TouchEvent) {
  if (!drawing || !ctx) return
  const { x, y } = getCoords(evt)
  ctx.lineTo(x, y)
  ctx.stroke()
  lastX = x
  lastY = y
  if (!hasSignature.value) hasSignature.value = true
}

function endDraw() {
  if (!drawing) return
  drawing = false
  if (hasSignature.value) emitDataURL()
}

function emitDataURL() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dataURL = canvas.toDataURL('image/png')
  emit('update:modelValue', dataURL)
  emit('signed', dataURL)
}

function clear() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  const rect = canvas.getBoundingClientRect()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, rect.width, rect.height)
  hasSignature.value = false
  emit('update:modelValue', null)
  emit('cleared')
}

defineExpose({ clear, emitDataURL })

onMounted(() => {
  setupCanvas()
  // Si llega un valor inicial (raro pero válido), pintarlo
  if (props.modelValue) {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.value
      if (canvas && ctx) {
        const rect = canvas.getBoundingClientRect()
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        hasSignature.value = true
      }
    }
    img.src = props.modelValue
  }
  window.addEventListener('resize', setupCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', setupCanvas)
})

watch(() => props.modelValue, v => {
  if (v === null && hasSignature.value) clear()
})
</script>

<style scoped>
.signature-pad-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.signature-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.signature-canvas-container {
  position: relative;
  width: 100%;
  height: 200px;
  border: 2px dashed rgba(218, 165, 32, 0.55);
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.signature-canvas-container.has-signature {
  border-color: rgba(218, 165, 32, 0.95);
  border-style: solid;
  box-shadow: 0 4px 14px rgba(218, 165, 32, 0.18);
}

.signature-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  cursor: crosshair;
}

.signature-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
}

.signature-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.signature-status {
  font-size: 12px;
  color: rgb(34, 197, 94);
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
</style>
