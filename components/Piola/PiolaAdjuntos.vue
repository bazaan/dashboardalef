<template>
  <div class="adjuntos">
    <!--
      Sin registro guardado no hay `entidad_id` al que colgar el archivo. Se
      avisa en vez de encolar los adjuntos en memoria: encolarlos obliga a que
      cada pantalla que use el componente se acuerde de subirlos después de
      guardar, y basta que una se olvide para que el usuario crea que adjuntó
      algo que nunca llegó.
    -->
    <v-alert v-if="!idEntidad" type="info" variant="tonal" density="compact">
      Guarda el registro primero para poder adjuntar documentos.
    </v-alert>

    <template v-else>
      <v-table v-if="adjuntos.length" density="compact" class="tabla-adjuntos">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Documento</th>
            <th>Peso</th>
            <th>Subió</th>
            <th class="text-right" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in adjuntos" :key="a.id">
            <td>
              <v-chip size="x-small" variant="tonal" :color="colorTipo(a.tipo_doc)">
                {{ etiquetaTipo(a.tipo_doc) }}
              </v-chip>
            </td>
            <td class="td-nombre" :title="a.nombre">{{ a.nombre }}</td>
            <td class="td-menor">{{ pesoLegible(a.peso_bytes) }}</td>
            <td class="td-menor">{{ a.subido_por || '—' }}</td>
            <td class="text-right acciones">
              <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver aquí mismo"
                @click="ver(a)" />
              <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
                :href="urlDe(a.path)" :download="a.nombre" />
              <v-btn v-if="!disabled" icon="mdi-delete" size="x-small" variant="text" color="error"
                title="Quitar el documento" :loading="eliminando === a.id" @click="eliminar(a)" />
            </td>
          </tr>
        </tbody>
      </v-table>

      <v-progress-linear v-if="cargando" indeterminate color="primary" height="3" rounded class="my-2" />
      <div v-else-if="!adjuntos.length" class="sin-adjuntos">Todavía no hay documentos adjuntos.</div>

      <div v-if="!disabled" class="alta-adjunto">
        <v-select v-model="tipoNuevo" :items="tiposDisponibles" label="Tipo de documento"
          density="compact" hide-details variant="outlined" class="alta-tipo" />
        <div class="alta-archivo">
          <PiolaSubirPdf v-model="pathNuevo" carpeta="adjuntos" :disabled="guardando"
            :label="`Agregar ${etiquetaTipo(tipoNuevo).toLowerCase()} (PDF)`"
            @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
        </div>
      </div>

      <div v-if="!disabled" class="alta-hint">
        Se puede adjuntar más de un documento al mismo registro: la factura, la constancia de
        detracción, el voucher del pago… Elige el tipo y sube el PDF; se agrega a la lista.
      </div>
    </template>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Adjuntos múltiples de cualquier registro de Piola (reunión 31/08/2026).
 *
 * Edson: "¿te puedes subir más de un documento?" → "hazlo para más porque ahí
 * también vamos a juntar lo que es la detracción en muchos casos".
 *
 * Es polimórfico como la tabla `piola_adjuntos`: se le dice a qué entidad
 * pertenece ('transaction', 'invoice', 'cliente'…) y su id. El documento
 * PRINCIPAL de cada pantalla (comprobante del movimiento, contrato, boleta)
 * sigue viviendo en su propia columna; esto es lo que se le suma.
 *
 * La subida reutiliza PiolaSubirPdf: sube al bucket `piola-docs` y devuelve el
 * PATH, no la URL, para que el día que el bucket pase a privado no haya que
 * migrar filas. Acá sólo se registra ese path contra la entidad.
 */
import { ref, computed, watch } from 'vue'
import { urlDocumento, apiPiola } from '@/composables/usePiola'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = withDefaults(defineProps<{
  /** Tabla dueña del adjunto: 'transaction' | 'invoice' | 'pago' | 'cliente' | 'contrato' | 'deliverable' | 'payslip'. */
  entidad: string
  /** Id del registro. `null` mientras no se haya guardado: ahí sólo se avisa. */
  entidad_id?: number | string | null
  /** Alias camelCase del anterior: `:entidad-id` y `:entidad_id` funcionan igual. */
  entidadId?: number | string | null
  /** Sin permiso de edición: la lista se ve, no se toca. */
  disabled?: boolean
  /** Perfil del usuario. No se usa para decidir nada — quién sube lo pone el servidor
   *  desde la sesión verificada —, pero los padres lo pasan junto con los permisos. */
  perfil?: any
  /** Tipos ofrecidos en el selector. Por defecto los que pidió Edson para finanzas. */
  tipos?: Array<{ value: string; title: string }>
}>(), { disabled: false })

const emit = defineEmits<{
  (e: 'notify', payload: any): void
  /** Cantidad de adjuntos tras un alta o baja, para que el padre pinte un contador. */
  (e: 'cambio', cantidad: number): void
}>()

const client = useSupabaseClient()

/** Todas las etiquetas del CHECK de `piola_adjuntos`, para poder pintar también
 *  los tipos que suben otras pantallas (ficha RUC, DNI) aunque acá no se ofrezcan. */
const ETIQUETAS: Record<string, string> = {
  factura: 'Factura',
  detraccion: 'Constancia de detracción',
  contrato: 'Contrato',
  anexo: 'Anexo',
  ficha_ruc: 'Ficha RUC',
  voucher: 'Voucher',
  constancia: 'Constancia',
  dni: 'DNI',
  otro: 'Otro',
}

const TIPOS_FINANZAS = [
  { value: 'factura', title: 'Factura' },
  { value: 'detraccion', title: 'Constancia de detracción' },
  { value: 'contrato', title: 'Contrato' },
  { value: 'anexo', title: 'Anexo' },
  { value: 'voucher', title: 'Voucher' },
  { value: 'otro', title: 'Otro' },
]

const tiposDisponibles = computed(() => props.tipos?.length ? props.tipos : TIPOS_FINANZAS)

/** `entidad_id` o `entidadId`, lo que haya llegado. Vacío ⇒ registro sin guardar. */
const idEntidad = computed(() => {
  const v = props.entidad_id ?? props.entidadId ?? null
  const n = Number(v)
  return v !== null && v !== '' && Number.isFinite(n) && n > 0 ? n : null
})

const adjuntos = ref<any[]>([])
const cargando = ref(false)
const guardando = ref(false)
const eliminando = ref<number | null>(null)
const tipoNuevo = ref('factura')
const pathNuevo = ref<string | null>(null)
const visor = ref({ abierto: false, src: '', titulo: '' })

const etiquetaTipo = (v: any) => ETIQUETAS[String(v)] || 'Documento'
const colorTipo = (v: any) =>
  ({ factura: 'primary', detraccion: 'warning', voucher: 'success' }[String(v)] || undefined)

const urlDe = (path: any) => urlDocumento(client, path)

function pesoLegible(bytes: any): string {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * PiolaSubirPdf le agrega '-<timestamp>-<aleatorio>' al nombre para no pisar
 * archivos en el bucket. Se le quita para guardar el nombre legible: en la
 * lista tiene que decir "constancia-detraccion.pdf", no un churro con dígitos.
 */
function nombreDesdePath(path: string): string {
  const archivo = decodeURIComponent(String(path).split('/').pop() || 'documento.pdf')
  return archivo.replace(/-\d{13}-[a-z0-9]{6}(\.pdf)$/i, '$1')
}

/**
 * Peso del archivo recién subido.
 *
 * PiolaSubirPdf sólo devuelve el path, así que el tamaño se pregunta a Storage.
 * Si la consulta falla (bucket con permisos más cerrados, por ejemplo) se
 * guarda sin peso: es un dato informativo, no vale la pena abortar la subida.
 */
async function pesoDe(path: string): Promise<number | null> {
  try {
    const corte = path.lastIndexOf('/')
    const carpeta = corte >= 0 ? path.slice(0, corte) : ''
    const archivo = corte >= 0 ? path.slice(corte + 1) : path
    const { data } = await client.storage.from('piola-docs')
      .list(carpeta, { limit: 1, search: archivo })
    const n = Number((data as any[])?.[0]?.metadata?.size)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/* ══════════ Carga ══════════ */
async function cargar() {
  if (!idEntidad.value) { adjuntos.value = []; return }
  cargando.value = true
  const { data, error } = await apiPiola<any>('adjuntos', {
    accion: 'listar', entidad: props.entidad, entidad_id: idEntidad.value,
  })
  cargando.value = false
  if (error) {
    adjuntos.value = []
    return emit('notify', { text: `No se pudieron cargar los adjuntos: ${error.message}`, color: 'error' })
  }
  // El endpoint devuelve { ok, adjuntos }; se aceptan también otras formas para
  // que un cambio de nombre en la respuesta no deje la lista en blanco sin aviso.
  adjuntos.value = data?.adjuntos ?? data?.data ?? (Array.isArray(data) ? data : [])
  emit('cambio', adjuntos.value.length)
}

/* ══════════ Alta ══════════ */
/** PiolaSubirPdf avisa que terminó de subir poniendo el path en su v-model. */
watch(pathNuevo, (p) => { if (p) agregar(p) })

async function agregar(path: string) {
  if (!idEntidad.value) return
  guardando.value = true
  const nombre = nombreDesdePath(path)
  const peso = await pesoDe(path)
  const { error } = await apiPiola('adjuntos', {
    accion: 'agregar',
    entidad: props.entidad,
    entidad_id: idEntidad.value,
    tipo_doc: tipoNuevo.value,
    nombre,
    path,
    peso_bytes: peso,
  })
  guardando.value = false
  // Se limpia siempre: si falló el registro, el PDF queda huérfano en el bucket
  // (igual que cuando se cancela una edición) pero el selector vuelve a estar
  // libre para reintentar en vez de quedarse mostrando un archivo fantasma.
  pathNuevo.value = null
  if (error) return emit('notify', { text: `No se pudo adjuntar: ${error.message}`, color: 'error' })
  emit('notify', `${etiquetaTipo(tipoNuevo.value)} adjuntada`)
  await cargar()
}

/* ══════════ Baja ══════════ */
async function eliminar(a: any) {
  if (!confirm(`¿Quitar "${a.nombre}" de este registro?`)) return
  eliminando.value = a.id
  // Sólo se borra el vínculo, no el archivo del bucket: misma regla que
  // PiolaSubirPdf. La limpieza de huérfanos es un proceso aparte.
  const { error } = await apiPiola('adjuntos', { accion: 'eliminar', id: a.id })
  eliminando.value = null
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Documento quitado')
  await cargar()
}

function ver(a: any) {
  visor.value = { abierto: true, src: urlDe(a.path), titulo: a.nombre }
}

// El diálogo del padre monta el componente antes de tener el id (movimiento
// nuevo) y lo cambia al guardar, así que se recarga cuando el id aparece.
watch(idEntidad, cargar, { immediate: true })

defineExpose({ recargar: cargar })
</script>

<style scoped>
.adjuntos { display: flex; flex-direction: column; gap: 8px; }

.tabla-adjuntos {
  border: 1px solid rgba(128, 128, 128, .2);
  border-radius: 10px;
  overflow: hidden;
}
.tabla-adjuntos :deep(th) { font-size: 11px; text-transform: uppercase; letter-spacing: .3px; opacity: .6; }
.td-nombre {
  max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;
}
.td-menor { font-size: 12px; opacity: .7; white-space: nowrap; }
.acciones { white-space: nowrap; }

.sin-adjuntos { font-size: 12.5px; opacity: .5; padding: 6px 2px; }

.alta-adjunto { display: flex; gap: 10px; align-items: flex-start; margin-top: 4px; }
.alta-tipo { flex: 0 0 230px; max-width: 230px; }
.alta-archivo { flex: 1 1 auto; min-width: 0; }

.alta-hint { font-size: 11.5px; opacity: .55; line-height: 1.45; }

@media (max-width: 800px) {
  .alta-adjunto { flex-direction: column; }
  .alta-tipo { flex: 1 1 auto; max-width: none; width: 100%; }
  .td-nombre { max-width: 160px; }
}
</style>
