<template>
  <div class="mis-docs">
    <!-- ══════════ Formulario: subir ══════════ -->
    <v-card flat class="custom-data-table doc-panel">
      <div class="doc-panel-titulo">{{ cfg.tituloForm }}</div>
      <p class="doc-panel-ayuda">{{ cfg.ayuda }}</p>

      <div class="doc-form" :class="{ 'con-periodo': cfg.conPeriodo }">
        <v-text-field v-model="form.nombre" class="c-nombre" :label="cfg.labelNombre"
          :placeholder="cfg.placeholder" density="compact" variant="outlined" hide-details />
        <v-select v-if="cfg.conPeriodo" v-model="form.periodo" class="c-periodo"
          :items="opcionesPeriodo" label="Mes que cubre *" density="compact" variant="outlined"
          hide-details />
        <v-text-field v-model="form.fecha" class="c-fecha" type="date" :label="cfg.labelFecha"
          density="compact" variant="outlined" hide-details />

        <div class="c-archivo">
          <PiolaSubirPdf v-model="form.archivo_url" :carpeta="cfg.carpeta" label="Archivo (PDF) *"
            @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
        </div>
        <v-btn class="c-boton" color="primary" variant="flat" height="40" :loading="guardando"
          @click="agregar">
          <v-icon icon="mdi-plus" start /> {{ cfg.boton }}
        </v-btn>
      </div>
    </v-card>

    <!-- ══════════ Lista ══════════ -->
    <v-card flat class="custom-data-table mt-4">
      <v-card-title class="table-search-bar">
        <span class="table-title">{{ cfg.tituloLista }} ({{ documentos.length }})</span>
      </v-card-title>

      <v-data-table :headers="headers" :items="documentos" class="elevation-0"
        :no-data-text="cfg.vacio" :items-per-page="20">
        <template v-slot:item.periodo="{ item }">
          <strong>{{ etiquetaPeriodo(item.periodo) }}</strong>
        </template>
        <template v-slot:item.nombre="{ item }">
          <span class="nombre-doc">
            <v-icon icon="mdi-file-pdf-box" size="18" color="error" />
            {{ item.nombre }}
          </span>
        </template>
        <template v-slot:item.fecha="{ item }">{{ item.fecha ? fechaCorta(item.fecha) : '—' }}</template>
        <template v-slot:item.subido_por="{ item }">
          <span class="origen-chip" :class="esMio(item) ? 'o-mio' : 'o-rrhh'">
            {{ esMio(item) ? 'Tú' : 'RR. HH.' }}
          </span>
        </template>
        <template v-slot:item.acciones="{ item }">
          <div class="acciones-fila">
            <template v-if="item.archivo_url">
              <v-btn icon="mdi-eye-outline" size="small" variant="text" title="Ver aquí mismo"
                @click="ver(item)" />
              <v-btn icon="mdi-download-outline" size="small" variant="text" title="Descargar"
                :href="urlBajar(item)" />
            </template>
            <v-btn v-if="esMio(item)" icon="mdi-delete-outline" size="small" variant="text"
              color="error" title="Eliminar" @click="eliminar(item)" />
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Visor emergente: el documento se abre dentro del dashboard, no en otra pestaña -->
    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Sección de documentos propios de Mi Espacio (23/09/2026).
 *
 * Una sola pantalla para "Mis recibos por honorarios" y "Mis contratos": el
 * colaborador sube el PDF, lo ve en un visor emergente dentro del dashboard o lo
 * descarga, y RR. HH. lo encuentra en su módulo (pestaña "Documentos").
 *
 * Todo lo que escribe pasa por POST /api/piola/colaborador (mi_documento_*): el
 * colaborador_id sale de la sesión, no de acá, y el servidor solo acepta los tipos
 * de esta lista.
 *
 * El padre es dueño de la lista: este componente le avisa qué se agregó o se quitó
 * (`agregado` / `eliminado`) y él la actualiza.
 */
import { ref, computed, watch } from 'vue'
import {
  apiPiola, fechaCorta, periodoActual, ultimosPeriodos, etiquetaPeriodo, urlDocumento, urlDescarga,
} from '@/composables/usePiola'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = defineProps<{
  tipo: 'recibo_honorarios' | 'contrato'
  /** Solo los documentos de este tipo. */
  documentos: any[]
  /** Correo de quien tiene la sesión: decide cuáles son "suyos" (los únicos que puede quitar). */
  email: string
}>()
const emit = defineEmits<{
  (e: 'notify', payload: any): void
  (e: 'agregado', doc: any): void
  (e: 'eliminado', id: number): void
}>()

const client = useSupabaseClient()

const CONFIG = {
  recibo_honorarios: {
    tituloForm: 'Subir un recibo por honorarios',
    ayuda: 'Sube tu recibo por honorarios en PDF. RR. HH. lo verá en su módulo, ordenado por mes.',
    labelNombre: 'N.º o nombre del recibo *',
    placeholder: 'Ej. E001-45',
    labelFecha: 'Fecha de emisión (opcional)',
    boton: 'Agregar recibo',
    carpeta: 'recibos-honorarios',
    tituloLista: 'Mis recibos por honorarios',
    vacio: 'Todavía no subiste ningún recibo por honorarios',
    conPeriodo: true,
  },
  contrato: {
    tituloForm: 'Subir un contrato',
    ayuda: 'Sube tu contrato firmado en PDF. RR. HH. lo verá dentro de tu expediente.',
    labelNombre: 'Nombre del contrato *',
    placeholder: 'Ej. Contrato de locación de servicios 2026',
    labelFecha: 'Fecha de firma (opcional)',
    boton: 'Agregar contrato',
    carpeta: 'contratos',
    tituloLista: 'Mis contratos',
    vacio: 'Todavía no subiste ningún contrato',
    conPeriodo: false,
  },
} as const
const cfg = computed(() => CONFIG[props.tipo])

/* ── Formulario ── */
const nuevoForm = () => ({ nombre: '', periodo: periodoActual(), fecha: '', archivo_url: null as string | null })
const form = ref(nuevoForm())
const guardando = ref(false)
// Al pasar de una pestaña a la otra no debe quedar a medias lo que se escribía en la anterior
watch(() => props.tipo, () => { form.value = nuevoForm() })

const opcionesPeriodo = computed(() =>
  ultimosPeriodos(24).map(p => ({ value: p, title: etiquetaPeriodo(p) })))

async function agregar() {
  const f = form.value
  const etiqueta = props.tipo === 'contrato' ? 'contrato' : 'recibo'
  if (!f.nombre?.trim()) return emit('notify', { text: `Ponle un nombre al ${etiqueta}`, color: 'error' })
  if (cfg.value.conPeriodo && !f.periodo) return emit('notify', { text: 'Elige el mes que cubre el recibo', color: 'error' })
  if (!f.archivo_url) return emit('notify', { text: 'Sube el PDF antes de agregarlo', color: 'error' })

  guardando.value = true
  const { data, error } = await apiPiola('colaborador', {
    accion: 'mi_documento_crear',
    tipo: props.tipo,
    nombre: f.nombre.trim(),
    archivo_url: f.archivo_url,
    fecha: f.fecha || null,
    periodo: cfg.value.conPeriodo ? f.periodo : null,
  })
  guardando.value = false
  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('agregado', data.documento)
  emit('notify', props.tipo === 'contrato' ? 'Contrato agregado' : 'Recibo agregado')
  form.value = nuevoForm()
}

async function eliminar(d: any) {
  if (!confirm(`¿Eliminar "${d.nombre}"? El PDF también se borra.`)) return
  const { error } = await apiPiola('colaborador', { accion: 'mi_documento_eliminar', id: d.id })
  if (error) return emit('notify', { text: error.message, color: 'error' })
  emit('eliminado', d.id)
  emit('notify', 'Documento eliminado')
}

/* ── Lista ── */
const esMio = (d: any) => String(d.subido_por || '').toLowerCase() === String(props.email || '').toLowerCase()

const headers = computed(() => cfg.value.conPeriodo
  ? [
      { title: 'Mes', key: 'periodo' },
      { title: 'Recibo', key: 'nombre' },
      { title: 'Emisión', key: 'fecha' },
      { title: 'Lo subió', key: 'subido_por', sortable: false },
      { title: '', key: 'acciones', sortable: false, align: 'end' as const },
    ]
  : [
      { title: 'Contrato', key: 'nombre' },
      { title: 'Firma', key: 'fecha' },
      { title: 'Lo subió', key: 'subido_por', sortable: false },
      { title: '', key: 'acciones', sortable: false, align: 'end' as const },
    ])

/* ── Visor emergente y descarga ── */
const visor = ref({ abierto: false, src: '', titulo: '' })
const ver = (d: any) => {
  visor.value = { abierto: true, src: urlDocumento(client, d.archivo_url), titulo: d.nombre }
}
const urlBajar = (d: any) => urlDescarga(client, d.archivo_url, `${d.nombre}.pdf`)
</script>

<style scoped>
.doc-panel { padding: 20px 22px 22px; }
.doc-panel-titulo {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .75;
}
.doc-panel-ayuda { font-size: 12.5px; opacity: .6; margin: 4px 0 16px; }

/* Rejilla de 12 columnas: dos filas, todo alineado por arriba y con la misma altura de campo.
   Fila 1 → nombre · (mes) · fecha.  Fila 2 → archivo · botón. */
.doc-form {
  display: grid; grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 14px 16px; align-items: start;
}
.c-nombre { grid-column: span 8; }
.c-fecha { grid-column: span 4; }
.con-periodo .c-nombre { grid-column: span 6; }
.con-periodo .c-periodo { grid-column: span 3; }
.con-periodo .c-fecha { grid-column: span 3; }
.c-archivo { grid-column: span 9; }
.c-boton { grid-column: span 3; width: 100%; }
/* El input de fecha trae un icono de calendario de 26 px y crecía a 42; así mide igual que los demás */
.doc-form :deep(input[type='date']) { height: 40px; padding-top: 7px; padding-bottom: 7px; }

.nombre-doc { display: inline-flex; align-items: center; gap: 8px; }
.acciones-fila { display: flex; justify-content: flex-end; gap: 2px; }

.origen-chip {
  display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
}
.o-mio { background: rgba(91, 141, 239, .14); color: #5b8def; }
.o-rrhh { background: rgba(139, 92, 246, .14); color: #8b5cf6; }

@media (max-width: 800px) {
  .doc-form { grid-template-columns: 1fr; }
  .c-nombre, .c-fecha, .c-archivo, .c-boton,
  .con-periodo .c-nombre, .con-periodo .c-periodo, .con-periodo .c-fecha { grid-column: span 1; }
}
</style>
