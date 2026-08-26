<template>
  <div class="subir-pdf">
    <!-- Ya hay documento: se muestra, se ve embebido o se reemplaza -->
    <div v-if="modelValue && !archivo" class="adjunto-actual">
      <v-icon icon="mdi-file-pdf-box" size="20" color="error" />
      <span class="adjunto-nombre" :title="modelValue">{{ nombreGuardado }}</span>
      <v-spacer />
      <v-btn size="x-small" variant="text" icon="mdi-eye" title="Ver aquí mismo"
        @click="verDocumento = true" />
      <v-btn v-if="!disabled" size="x-small" variant="text" icon="mdi-close" color="error"
        title="Quitar el documento" @click="quitar" />
    </div>

    <!-- Sin documento: selector -->
    <v-file-input v-else v-model="archivo" :label="label || 'Documento PDF'"
      accept="application/pdf" prepend-icon="" prepend-inner-icon="mdi-paperclip"
      density="compact" variant="outlined" hide-details="auto" :disabled="disabled || subiendo"
      :loading="subiendo" show-size clearable :error-messages="error ? [error] : []"
      @update:model-value="onArchivo" />

    <div v-if="subiendo" class="subir-progreso">
      <v-progress-linear indeterminate color="primary" height="3" rounded />
      <span>Subiendo…</span>
    </div>
    <div v-else-if="!modelValue" class="subir-hint">
      Solo PDF, hasta {{ maxMb }} MB.
    </div>

    <PiolaVisorPdf v-model="verDocumento" :src="urlActual" :titulo="nombreGuardado" />
  </div>
</template>

<script setup lang="ts">
/**
 * Subida de PDF al bucket `piola-docs` de Supabase Storage.
 *
 * Se usa en contratos y en adendas. Guarda el PATH dentro del bucket
 * (ej. 'contratos/contrato-1755012345-abc.pdf'), no la URL pública: si mañana
 * el bucket pasa a privado, no hay que migrar ni una fila.
 *
 * v-model = el path. Vacío mientras no se haya subido nada.
 */
import { ref, computed } from 'vue'
import { urlDocumento } from '@/composables/usePiola'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  /** Carpeta dentro del bucket: 'contratos', 'adendas'… */
  carpeta: string
  label?: string
  disabled?: boolean
  maxMb?: number
}>(), { maxMb: 10 })

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
  (e: 'error', mensaje: string): void
}>()

const client = useSupabaseClient()

const archivo = ref<any>(null)
const subiendo = ref(false)
const error = ref('')
const verDocumento = ref(false)

const urlActual = computed(() => urlDocumento(client, props.modelValue))
const nombreGuardado = computed(() => {
  if (!props.modelValue) return ''
  return decodeURIComponent(String(props.modelValue).split('/').pop() || 'documento.pdf')
})

/** Nombre seguro y único: sin espacios ni tildes, con timestamp para no pisar nada. */
function rutaDestino(nombreOriginal: string): string {
  const base = nombreOriginal
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita tildes
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'documento'
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${props.carpeta}/${base}-${sufijo}.pdf`
}

async function onArchivo(valor: any) {
  // v-file-input devuelve File o File[] según la versión de Vuetify
  const file: File | null = Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
  error.value = ''
  if (!file) return

  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    error.value = 'El archivo debe ser un PDF.'
    archivo.value = null
    return
  }
  if (file.size > props.maxMb * 1024 * 1024) {
    error.value = `El PDF pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${props.maxMb} MB.`
    archivo.value = null
    return
  }

  subiendo.value = true
  const ruta = rutaDestino(file.name)
  const { error: err } = await client.storage.from('piola-docs')
    .upload(ruta, file, { contentType: 'application/pdf', upsert: false })
  subiendo.value = false

  if (err) {
    error.value = `No se pudo subir: ${err.message}`
    emit('error', error.value)
    archivo.value = null
    return
  }

  archivo.value = null
  emit('update:modelValue', ruta)
}

/**
 * Quita el vínculo con el documento. NO borra el archivo del bucket a
 * propósito: si el usuario cancela la edición del contrato, el PDF original
 * sigue ahí. La limpieza de huérfanos es un proceso aparte.
 */
function quitar() {
  emit('update:modelValue', null)
  archivo.value = null
  error.value = ''
}
</script>

<style scoped>
.subir-pdf { display: flex; flex-direction: column; gap: 4px; }

.adjunto-actual {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid rgba(128, 128, 128, .28); border-radius: 8px;
  padding: 7px 8px 7px 11px; background: rgba(128, 128, 128, .05);
}
.adjunto-nombre {
  font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px;
}

.subir-progreso { display: flex; flex-direction: column; gap: 3px; }
.subir-progreso span { font-size: 11px; opacity: .6; }
.subir-hint { font-size: 11px; opacity: .5; padding-left: 2px; }
</style>
