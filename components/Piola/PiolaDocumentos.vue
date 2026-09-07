<template>
  <div class="docs">
    <div class="docs-head">
      <span class="docs-titulo">
        {{ titulo }}
        <span v-if="documentos.length" class="docs-count">{{ documentos.length }}</span>
      </span>
      <v-btn v-if="puedeEditar && entidadId" size="x-small" variant="tonal" :loading="subiendo"
        @click="seleccionar">
        <v-icon icon="mdi-paperclip-plus" start size="14" /> Adjuntar
      </v-btn>
    </div>

    <!-- El input vive oculto: el botón de arriba es el que se ve -->
    <input ref="inputArchivo" type="file" multiple :accept="ACEPTA" style="display:none"
      @change="onArchivos" />

    <v-alert v-if="!entidadId" type="info" variant="tonal" density="compact" class="mb-2">
      Guardá primero para poder adjuntar documentos.
    </v-alert>

    <div v-else-if="!documentos.length && !subiendo" class="docs-vacio">
      Sin documentos. Se pueden adjuntar la factura, la constancia de detracción, el contrato
      y cualquier otro respaldo.
    </div>

    <div v-if="subiendo" class="docs-subiendo">
      <v-progress-linear indeterminate color="primary" height="3" rounded />
      <span>Subiendo {{ pendientes }} archivo(s)…</span>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
      {{ error }}
    </v-alert>

    <div v-for="d in documentos" :key="d.id" class="doc-fila">
      <v-icon :icon="iconoDe(d)" size="18" :color="colorDe(d)" />
      <div class="doc-info">
        <div class="doc-nombre" :title="d.nombre">{{ d.nombre }}</div>
        <div class="doc-meta">
          {{ etiquetaTipoDocumento(d.tipo) }}
          <span v-if="d.tamano_bytes"> · {{ pesoLegible(d.tamano_bytes) }}</span>
          <span v-if="d.subido_por"> · {{ d.subido_por }}</span>
          <span> · {{ fechaCorta(d.created_at) }}</span>
        </div>
      </div>

      <v-select v-if="puedeEditar" :model-value="d.tipo" :items="TIPOS_DOCUMENTO" item-title="title"
        item-value="value" density="compact" hide-details variant="outlined" class="doc-tipo"
        @update:model-value="(v: any) => reclasificar(d, v)" />

      <v-btn size="x-small" variant="text" icon="mdi-eye" title="Ver aquí mismo" @click="ver(d)" />
      <v-btn size="x-small" variant="text" icon="mdi-open-in-new" title="Abrir en otra pestaña"
        :href="urlDe(d)" target="_blank" />
      <v-btn v-if="puedeEliminar" size="x-small" variant="text" icon="mdi-close" color="error"
        title="Quitar" @click="eliminar(d)" />
    </div>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Documentos adjuntos de una entidad — N por factura, contrato o movimiento.
 *
 * Antes cada cosa tenía UNA columna de archivo. Una factura real llega con la
 * factura, la constancia de detracción y el contrato que la respalda: tres
 * documentos, una sola columna. Acá cuelgan todos, clasificados.
 *
 * El ARCHIVO se sube directo del navegador al bucket `piola-docs` (policies de
 * Storage) y solo la FILA pasa por el endpoint, que es quien verifica permisos
 * y pone `subido_por`. Mandar 10 MB por una función serverless para reenviarlos
 * a Storage sería pagar dos veces el mismo viaje.
 *
 * Acepta PDF e imágenes: la constancia de detracción del banco casi siempre
 * llega como foto o captura.
 */
import { ref, computed, watch } from 'vue'
import {
  TIPOS_DOCUMENTO, etiquetaTipoDocumento, fechaCorta, urlDocumento,
  subirArchivoPiola, apiPiola,
} from '@/composables/usePiola'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = withDefaults(defineProps<{
  /** 'factura' | 'contrato' | 'adenda' | 'movimiento' | 'cliente' | … */
  entidad: string
  /** null mientras la entidad no se guardó: no se puede colgar de nada */
  entidadId: number | null
  titulo?: string
  /** Tipo con el que se clasifican los archivos nuevos */
  tipoPorDefecto?: string
  carpeta?: string
  puedeEditar?: boolean
  puedeEliminar?: boolean
  maxMb?: number
}>(), {
  titulo: 'Documentos', tipoPorDefecto: 'otro', maxMb: 15,
  puedeEditar: true, puedeEliminar: true,
})

const emit = defineEmits<{ (e: 'notify', payload: any): void; (e: 'cambio'): void }>()

const client = useSupabaseClient()

const ACEPTA = 'application/pdf,image/*,.doc,.docx,.xls,.xlsx'

const documentos = ref<any[]>([])
const inputArchivo = ref<HTMLInputElement | null>(null)
const subiendo = ref(false)
const pendientes = ref(0)
const error = ref('')
const visor = ref({ abierto: false, src: '', titulo: '' })

const carpetaDestino = computed(() => props.carpeta || `${props.entidad}s`)

async function cargar() {
  if (!props.entidadId) { documentos.value = []; return }
  const { data, error: err } = await client.from('piola_documentos')
    .select('*').eq('entidad', props.entidad).eq('entidad_id', props.entidadId)
    .order('created_at', { ascending: false })
  if (err) { error.value = err.message; return }
  documentos.value = (data as any[]) || []
}

watch(() => [props.entidad, props.entidadId], cargar, { immediate: true })

const urlDe = (d: any) => urlDocumento(client, d.path)

const iconoDe = (d: any) => {
  if (/pdf$/i.test(d.mime || d.path)) return 'mdi-file-pdf-box'
  if (/^image\//i.test(d.mime || '')) return 'mdi-file-image'
  if (/sheet|excel|\.xlsx?$/i.test(d.mime || d.path)) return 'mdi-file-excel'
  return TIPOS_DOCUMENTO.find(t => t.value === d.tipo)?.icon || 'mdi-file-outline'
}
const colorDe = (d: any) => (/pdf$/i.test(d.mime || d.path) ? 'error' : 'primary')

const pesoLegible = (bytes: any) => {
  const n = Number(bytes || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function ver(d: any) {
  visor.value = { abierto: true, src: urlDe(d), titulo: d.nombre }
}

const seleccionar = () => inputArchivo.value?.click()

async function onArchivos(ev: Event) {
  const input = ev.target as HTMLInputElement
  const archivos = Array.from(input.files || [])
  input.value = ''                                   // permite volver a elegir el mismo archivo
  if (!archivos.length || !props.entidadId) return

  error.value = ''
  subiendo.value = true
  pendientes.value = archivos.length

  for (const file of archivos) {
    if (file.size > props.maxMb * 1024 * 1024) {
      error.value = `"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${props.maxMb} MB.`
      pendientes.value--
      continue
    }

    const { path, error: errSubida } = await subirArchivoPiola(client, file, carpetaDestino.value)
    if (!path) {
      error.value = `No se pudo subir "${file.name}": ${errSubida}`
      pendientes.value--
      continue
    }

    const { error: errApi } = await apiPiola('documentos', {
      accion: 'registrar',
      entidad: props.entidad,
      entidad_id: props.entidadId,
      tipo: props.tipoPorDefecto,
      nombre: file.name,
      path,
      mime: file.type || null,
      tamano_bytes: file.size,
    })
    // El archivo ya está en el bucket: si falla el registro se avisa, no se
    // finge que salió bien. El huérfano lo limpia el proceso aparte.
    if (errApi) error.value = `"${file.name}" se subió pero no se pudo registrar: ${errApi.message}`
    pendientes.value--
  }

  subiendo.value = false
  await cargar()
  emit('cambio')
  if (!error.value) emit('notify', `${archivos.length} documento(s) adjuntado(s)`)
}

async function reclasificar(d: any, tipo: string) {
  if (tipo === d.tipo) return
  const { error: err } = await apiPiola('documentos', { accion: 'actualizar', id: d.id, tipo })
  if (err) return emit('notify', { text: err.message, color: 'error' })
  await cargar()
}

async function eliminar(d: any) {
  if (!confirm(`¿Quitar "${d.nombre}"?`)) return
  const { error: err } = await apiPiola('documentos', { accion: 'eliminar', id: d.id })
  if (err) return emit('notify', { text: err.message, color: 'error' })
  await cargar()
  emit('cambio')
}

defineExpose({ cargar })
</script>

<style scoped>
.docs { display: flex; flex-direction: column; gap: 6px; }

.docs-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.docs-titulo {
  font-weight: 600; font-size: 12px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; display: flex; align-items: center; gap: 7px;
}
.docs-count {
  background: rgba(128, 128, 128, .22); border-radius: 999px;
  padding: 0 7px; font-size: 11px; letter-spacing: 0;
}

.docs-vacio { font-size: 11.5px; opacity: .5; line-height: 1.5; padding: 4px 0; }
.docs-subiendo { display: flex; flex-direction: column; gap: 3px; }
.docs-subiendo span { font-size: 11px; opacity: .6; }

.doc-fila {
  display: flex; align-items: center; gap: 9px;
  border: 1px solid rgba(128, 128, 128, .22); border-radius: 8px;
  padding: 6px 8px 6px 11px; background: rgba(128, 128, 128, .04);
}
.doc-info { flex: 1; min-width: 0; }
.doc-nombre { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { font-size: 10.5px; opacity: .55; margin-top: 1px; }
.doc-tipo { max-width: 190px; flex: 0 0 auto; }

@media (max-width: 700px) {
  .doc-fila { flex-wrap: wrap; }
  .doc-tipo { max-width: none; flex: 1 1 100%; }
}
</style>
