<template>
  <v-dialog :model-value="modelValue" max-width="1000" scrollable
    @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="modelValue" class="visor-card">
      <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <v-icon icon="mdi-file-document-outline" size="20" />
        <span style="font-weight:700; font-size:16px;">{{ titulo || 'Documento' }}</span>
        <v-spacer />
        <!-- La descarga va aparte de la vista: ver no debe forzar bajar el archivo -->
        <v-btn v-if="src" size="small" variant="tonal" :href="src" :download="nombreArchivo" target="_self">
          <v-icon icon="mdi-download" start /> Descargar
        </v-btn>
      </v-card-title>

      <v-card-text class="visor-body">
        <div v-if="!src" class="visor-vacio">
          <v-icon icon="mdi-file-remove-outline" size="40" />
          <p>Este registro no tiene documento adjunto.</p>
        </div>
        <iframe v-else :src="src" class="visor-frame" :title="titulo || 'Documento'" />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Visor de documentos embebido — requisito explícito del cliente (19/08):
 * el documento se abre CON UN CLIC DENTRO del dashboard, no en pestaña nueva.
 *
 * Sirve para los PDF subidos a Storage (contratos, adendas) y también para los
 * HTML que genera el servidor (boletas, reportes AFP, facturas), porque el
 * <iframe> renderiza ambos. El patrón se tomó de PiolaReportes.vue:165.
 *
 * El botón de descarga se mantiene SEPARADO del de ver, tal como se pidió.
 */
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  /** URL ya resuelta del documento. Usar `urlDocumento()` de usePiola si viene un path de Storage. */
  src?: string | null
  titulo?: string | null
}>()

defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

/** Nombre sugerido al descargar: el último segmento del path, sin query string. */
const nombreArchivo = computed(() => {
  if (!props.src) return undefined
  const limpio = String(props.src).split('?')[0]
  return decodeURIComponent(limpio.split('/').pop() || '') || undefined
})
</script>

<style scoped>
.visor-card { display: flex; flex-direction: column; }
.visor-body { padding: 0 16px 8px; }

.visor-frame {
  width: 100%;
  height: 70vh;
  min-height: 420px;
  border: 1px solid rgba(128, 128, 128, .25);
  border-radius: 10px;
  background: #fff;
}

.visor-vacio {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px; opacity: .5; text-align: center;
}
.visor-vacio p { margin: 0; font-size: 13.5px; }

@media (max-width: 800px) {
  .visor-frame { height: 60vh; min-height: 320px; }
}
</style>
