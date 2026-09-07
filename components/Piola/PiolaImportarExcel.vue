<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      Se lee el archivo, se muestra <b>fila por fila lo que se va a cargar</b> y recién entonces
      se importa. Las filas que ya estaban cargadas se detectan solas y no se duplican.
    </v-alert>

    <!-- ══════════ 1. Archivo y plantilla ══════════ -->
    <v-card flat class="custom-data-table paso">
      <div class="paso-titulo"><span class="paso-num">1</span> Archivo</div>
      <div class="paso-grid">
        <v-file-input v-model="archivo" label="Excel (.xlsx) o CSV" accept=".xlsx,.csv,.txt"
          prepend-icon="" prepend-inner-icon="mdi-file-excel" density="compact" variant="outlined"
          hide-details show-size clearable @update:model-value="onArchivo" />
        <v-select v-model="plantillaId" :items="opcionesPlantilla" label="Plantilla de columnas"
          density="compact" variant="outlined" hide-details clearable
          @update:model-value="analizar" />
        <v-select v-if="analisis?.hojas_disponibles?.length > 1" v-model="hoja"
          :items="analisis.hojas_disponibles" label="Hoja" density="compact" variant="outlined"
          hide-details @update:model-value="analizar" />
      </div>

      <div class="paso-opciones">
        <v-text-field v-model.number="opciones.fila_encabezado" type="number" min="1"
          label="Fila del encabezado" density="compact" variant="outlined" hide-details
          style="max-width:170px" @change="analizar" />
        <v-select v-model="opciones.decimal" :items="[{ value: '.', title: '1,250.50 (punto)' }, { value: ',', title: '1.250,50 (coma)' }]"
          label="Separador decimal" density="compact" variant="outlined" hide-details
          style="max-width:210px" @update:model-value="analizar" />
        <v-select v-model="opciones.formato_fecha"
          :items="[{ value: 'auto', title: 'Automático' }, { value: 'dmy', title: 'día/mes/año' }, { value: 'mdy', title: 'mes/día/año' }, { value: 'ymd', title: 'año-mes-día' }]"
          label="Formato de fecha" density="compact" variant="outlined" hide-details
          style="max-width:190px" @update:model-value="analizar" />
        <v-select v-model="opciones.tipo_default" :items="[{ value: 'egreso', title: 'Egreso' }, { value: 'ingreso', title: 'Ingreso' }]"
          label="Si el archivo no dice el tipo" density="compact" variant="outlined" hide-details
          style="max-width:230px" @update:model-value="analizar" />
        <v-checkbox v-model="opciones.crear_categorias" label="Crear las categorías que no existan"
          color="primary" density="compact" hide-details @change="analizar" />
      </div>
    </v-card>

    <!-- ══════════ 2. Mapeo de columnas ══════════ -->
    <v-card v-if="analisis" flat class="custom-data-table paso">
      <div class="paso-titulo">
        <span class="paso-num">2</span> Columnas
        <v-chip v-if="analisis.mapeo_sugerido" size="x-small" color="info" variant="tonal" class="ml-2">
          mapeo sugerido — revisalo
        </v-chip>
        <v-spacer />
        <v-btn size="x-small" variant="tonal" @click="dialogPlantilla = true">
          <v-icon icon="mdi-content-save-cog" start size="14" /> Guardar como plantilla
        </v-btn>
      </div>

      <div class="mapeo-grid">
        <div v-for="cab in analisis.cabeceras" :key="cab" class="mapeo-fila">
          <div class="mapeo-cab" :title="cab">{{ cab || '(columna sin título)' }}</div>
          <v-icon icon="mdi-arrow-right" size="14" style="opacity:.4" />
          <v-select :model-value="mapeo[cab] || ''" :items="CAMPOS" item-title="label" item-value="campo"
            density="compact" variant="outlined" hide-details
            @update:model-value="(v: any) => { mapeo[cab] = v; analizar() }" />
        </div>
      </div>

      <v-alert v-if="faltanRequeridos.length" type="warning" variant="tonal" density="compact" class="mt-3">
        Falta asignar: <b>{{ faltanRequeridos.join(', ') }}</b>. Sin eso ninguna fila se puede importar.
      </v-alert>
    </v-card>

    <!-- ══════════ 3. Vista previa ══════════ -->
    <v-card v-if="analisis" flat class="custom-data-table paso">
      <div class="paso-titulo"><span class="paso-num">3</span> Vista previa</div>

      <div class="resumen">
        <div class="res-item ok">
          <span>{{ analisis.validas }}</span><small>se van a importar</small>
        </div>
        <div class="res-item dup">
          <span>{{ analisis.duplicadas }}</span><small>ya estaban cargadas</small>
        </div>
        <div class="res-item err">
          <span>{{ analisis.con_error }}</span><small>con problemas</small>
        </div>
        <div class="res-item">
          <span class="verde">{{ PEN_CORTO(analisis.ingresos) }}</span><small>en ingresos</small>
        </div>
        <div class="res-item">
          <span class="rojo">{{ PEN_CORTO(analisis.egresos) }}</span><small>en egresos</small>
        </div>
      </div>

      <div class="filtros-previa">
        <v-btn-toggle v-model="filtroPrevia" density="compact" variant="outlined" mandatory>
          <v-btn value="todas" size="small">Todas</v-btn>
          <v-btn value="ok" size="small">A importar</v-btn>
          <v-btn value="duplicadas" size="small">Repetidas</v-btn>
          <v-btn value="error" size="small">Con problemas</v-btn>
        </v-btn-toggle>
      </div>

      <v-data-table :headers="headersPrevia" :items="filasFiltradas" :items-per-page="25"
        density="compact" class="elevation-0" no-data-text="No hay filas en este filtro">
        <template v-slot:item.estado="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorFila(item)">{{ textoFila(item) }}</v-chip>
        </template>
        <template v-slot:item.tipo="{ item }">
          <v-icon :icon="item.datos.tipo === 'ingreso' ? 'mdi-arrow-down-bold' : 'mdi-arrow-up-bold'"
            :color="item.datos.tipo === 'ingreso' ? 'success' : 'error'" size="14" />
          {{ item.datos.tipo === 'ingreso' ? 'Ingreso' : 'Egreso' }}
        </template>
        <template v-slot:item.monto="{ item }">{{ PEN(item.datos.monto) }}</template>
        <template v-slot:item.detalle="{ item }">
          <div v-if="item.errores.length" class="msg err">{{ item.errores.join(' · ') }}</div>
          <div v-else-if="item.avisos.length" class="msg avi">{{ item.avisos.join(' · ') }}</div>
          <div v-else class="msg">{{ item.datos.categoria_texto || '—' }}</div>
        </template>
      </v-data-table>

      <div class="acciones-final">
        <v-btn variant="text" @click="limpiar">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" :loading="importando"
          :disabled="!analisis.validas || !puedeCrear" @click="confirmar">
          <v-icon icon="mdi-database-import" start />
          Importar {{ analisis.validas }} movimiento(s)
        </v-btn>
      </div>
    </v-card>

    <!-- ══════════ Historial de importaciones ══════════ -->
    <v-card flat class="custom-data-table paso">
      <div class="paso-titulo"><v-icon icon="mdi-history" size="16" class="mr-2" /> Importaciones anteriores</div>
      <v-data-table :headers="headersLotes" :items="lotes" :items-per-page="10" density="compact"
        class="elevation-0" no-data-text="Todavía no se importó ningún archivo">
        <template v-slot:item.created_at="{ item }">{{ fechaHora(item.created_at) }}</template>
        <template v-slot:item.monto_total="{ item }">{{ PEN(item.monto_total) }}</template>
        <template v-slot:item.estado="{ item }">
          <v-chip size="x-small" variant="flat"
            :color="{ importado: 'success', parcial: 'warning', error: 'error', revertido: 'grey' }[item.estado as string] || 'grey'">
            {{ item.estado }}
          </v-chip>
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEliminar && item.estado !== 'revertido'" size="x-small" variant="text"
            color="error" @click="revertir(item)">Revertir</v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ Guardar plantilla ══════════ -->
    <v-dialog v-model="dialogPlantilla" max-width="480">
      <v-card>
        <v-card-title class="pt-4">Guardar plantilla de columnas</v-card-title>
        <v-card-text>
          <p class="hint mb-3">
            Queda guardado el mapeo de columnas y las opciones de lectura. La próxima vez se
            elige la plantilla y el archivo se interpreta solo.
          </p>
          <v-text-field v-model="nombrePlantilla" label="Nombre de la plantilla" density="compact"
            variant="outlined" hide-details placeholder="Formato Edson Polo" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogPlantilla = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoPlantilla" @click="guardarPlantilla">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Importación de movimientos financieros desde el archivo de administración.
 *
 * TRES PASOS: archivo → columnas → vista previa. Recién en el tercero hay un
 * botón que escribe. La hoja de Edson tiene su propia nomenclatura y va a
 * cambiar, así que el mapeo columna → campo se guarda como PLANTILLA: la
 * próxima vez se elige y el archivo se interpreta solo, sin tocar código.
 *
 * El anti-duplicado es del servidor (hash por fila + índice único), pero acá se
 * muestra ANTES de importar: la persona ve qué filas ya estaban y decide.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import { PEN, PEN_CORTO, fechaHora, archivoABase64, apiPiola, traerTodo } from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void; (e: 'importado'): void }>()

const client = useSupabaseClient()

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'contabilidad', 'create'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'contabilidad', 'delete'))

/** Campos del sistema a los que se puede apuntar una columna. */
const CAMPOS = [
  { campo: '', label: '— No importar —' },
  { campo: 'fecha', label: 'Fecha *' },
  { campo: 'concepto', label: 'Concepto / descripción *' },
  { campo: 'tipo', label: 'Tipo (ingreso/egreso)' },
  { campo: 'monto', label: 'Importe (una sola columna)' },
  { campo: 'monto_ingreso', label: 'Importe — columna de ingresos' },
  { campo: 'monto_egreso', label: 'Importe — columna de egresos' },
  { campo: 'subtotal', label: 'Subtotal (sin IGV)' },
  { campo: 'categoria', label: 'Categoría (nombre o leyenda)' },
  { campo: 'proveedor', label: 'Proveedor' },
  { campo: 'cliente', label: 'Cliente' },
  { campo: 'ruc', label: 'RUC' },
  { campo: 'documento_serie', label: 'Serie del documento' },
  { campo: 'documento_numero', label: 'Número del documento' },
  { campo: 'payment_method', label: 'Medio de pago' },
  { campo: 'area', label: 'Área' },
  { campo: 'centro_costo', label: 'Centro de costo' },
  { campo: 'responsable_email', label: 'Responsable (correo)' },
  { campo: 'notas', label: 'Observaciones' },
]

const archivo = ref<any>(null)
const archivoBase64 = ref('')
const archivoNombre = ref('')
const hoja = ref('')
const plantillaId = ref<number | null>(null)
const plantillas = ref<any[]>([])
const lotes = ref<any[]>([])

const analisis = ref<any>(null)
const mapeo = reactive<Record<string, string>>({})
const opciones = reactive<Record<string, any>>({
  fila_encabezado: 1, decimal: '.', formato_fecha: 'auto',
  tipo_default: 'egreso', crear_categorias: true,
})

const analizando = ref(false)
const importando = ref(false)
const filtroPrevia = ref('todas')
const dialogPlantilla = ref(false)
const nombrePlantilla = ref('')
const guardandoPlantilla = ref(false)

const opcionesPlantilla = computed(() =>
  plantillas.value.map(p => ({ value: p.id, title: p.nombre })))

async function cargarCatalogos() {
  const [p, l] = await Promise.all([
    client.from('piola_import_plantillas').select('*').eq('activo', true).order('nombre'),
    traerTodo(() => client.from('piola_import_lotes').select('*')
      .order('created_at', { ascending: false }).order('id')),
  ])
  plantillas.value = (p.data as any[]) || []
  lotes.value = ((l.data as any[]) || []).slice(0, 50)
}

async function onArchivo(valor: any) {
  const file: File | null = Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
  analisis.value = null
  for (const k of Object.keys(mapeo)) delete mapeo[k]
  if (!file) { archivoBase64.value = ''; return }

  archivoNombre.value = file.name
  try {
    archivoBase64.value = await archivoABase64(file)
  } catch (e: any) {
    return emit('notify', { text: e?.message || 'No se pudo leer el archivo', color: 'error' })
  }
  hoja.value = ''
  await analizar()
}

/** Relee el archivo con el mapeo y las opciones actuales. No escribe nada. */
async function analizar() {
  if (!archivoBase64.value || analizando.value) return
  analizando.value = true

  const { data, error } = await apiPiola<any>('importar', {
    accion: 'analizar',
    archivo_base64: archivoBase64.value,
    archivo_nombre: archivoNombre.value,
    hoja: hoja.value || undefined,
    plantilla_id: Object.keys(mapeo).length ? undefined : plantillaId.value,
    mapeo: Object.keys(mapeo).length ? { ...mapeo } : undefined,
    opciones: { ...opciones },
  })
  analizando.value = false

  if (error) return emit('notify', { text: error.message, color: 'error' })

  analisis.value = data
  hoja.value = data.hoja
  // El mapeo que devolvió el servidor pasa a ser el editable de la pantalla
  if (!Object.keys(mapeo).length) {
    for (const [k, v] of Object.entries(data.mapeo || {})) mapeo[k] = v as string
  }
  // Las columnas sin asignar existen igual en el selector, en blanco
  for (const cab of data.cabeceras || []) if (!(cab in mapeo)) mapeo[cab] = ''
}

const faltanRequeridos = computed(() => {
  const usados = new Set(Object.values(mapeo).filter(Boolean))
  const faltan: string[] = []
  if (!usados.has('fecha')) faltan.push('fecha')
  if (!usados.has('concepto')) faltan.push('concepto')
  if (!usados.has('monto') && !usados.has('monto_ingreso') && !usados.has('monto_egreso')) {
    faltan.push('importe')
  }
  return faltan
})

const filasFiltradas = computed(() => {
  const filas = analisis.value?.filas || []
  if (filtroPrevia.value === 'ok') return filas.filter((f: any) => f.ok && !f.duplicado)
  if (filtroPrevia.value === 'duplicadas') return filas.filter((f: any) => f.duplicado)
  if (filtroPrevia.value === 'error') return filas.filter((f: any) => !f.ok)
  return filas
})

const colorFila = (f: any) => (!f.ok ? 'error' : f.duplicado ? 'grey' : f.avisos?.length ? 'warning' : 'success')
const textoFila = (f: any) => (!f.ok ? 'Problema' : f.duplicado ? 'Repetida' : f.avisos?.length ? 'Revisar' : 'OK')

const headersPrevia = [
  { title: 'Fila', key: 'fila', width: 70 },
  { title: '', key: 'estado', sortable: false, width: 90 },
  { title: 'Fecha', key: 'datos.fecha' },
  { title: 'Concepto', key: 'datos.concepto' },
  { title: 'Tipo', key: 'tipo', sortable: false },
  { title: 'Monto', key: 'monto', sortable: false },
  { title: 'Categoría / detalle', key: 'detalle', sortable: false },
]

const headersLotes = [
  { title: 'Fecha', key: 'created_at' },
  { title: 'Archivo', key: 'archivo_nombre' },
  { title: 'Importadas', key: 'filas_importadas' },
  { title: 'Repetidas', key: 'filas_duplicadas' },
  { title: 'Con error', key: 'filas_error' },
  { title: 'Monto', key: 'monto_total' },
  { title: 'Estado', key: 'estado' },
  { title: 'Por', key: 'importado_por' },
  { title: '', key: 'acciones', sortable: false },
]

async function confirmar() {
  if (!analisis.value?.validas) return
  if (!confirm(`Se van a cargar ${analisis.value.validas} movimiento(s) al flujo de caja. ¿Confirmás?`)) return

  importando.value = true
  const { data, error } = await apiPiola<any>('importar', {
    accion: 'confirmar',
    archivo_base64: archivoBase64.value,
    archivo_nombre: archivoNombre.value,
    hoja: hoja.value,
    mapeo: { ...mapeo },
    opciones: { ...opciones },
    plantilla_id: plantillaId.value,
  })
  importando.value = false

  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('notify', `${data.importadas} movimiento(s) importados`
    + (data.duplicadas ? ` · ${data.duplicadas} repetidos omitidos` : '')
    + (data.con_error ? ` · ${data.con_error} con error` : ''))
  limpiar()
  await cargarCatalogos()
  emit('importado')
}

async function guardarPlantilla() {
  const nombre = nombrePlantilla.value.trim()
  if (!nombre) return emit('notify', { text: 'La plantilla necesita un nombre', color: 'error' })

  guardandoPlantilla.value = true
  const { error } = await apiPiola('importar', {
    accion: 'guardar_plantilla',
    nombre,
    mapeo: { ...mapeo },
    opciones: { ...opciones },
  })
  guardandoPlantilla.value = false

  if (error) return emit('notify', { text: error.message, color: 'error' })
  emit('notify', `Plantilla "${nombre}" guardada`)
  dialogPlantilla.value = false
  nombrePlantilla.value = ''
  await cargarCatalogos()
}

async function revertir(lote: any) {
  if (!confirm(`¿Revertir la importación de "${lote.archivo_nombre}"?\n\n`
    + `Se eliminarán los ${lote.filas_importadas} movimiento(s) que cargó, salvo los que ya `
    + `tengan pagos registrados.`)) return

  const { data, error } = await apiPiola<any>('importar', { accion: 'revertir_lote', id: lote.id })
  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('notify', data.aviso
    ? { text: `${data.eliminados} eliminados. ${data.aviso}`, color: 'warning' }
    : `${data.eliminados} movimiento(s) eliminados`)
  await cargarCatalogos()
  emit('importado')
}

function limpiar() {
  archivo.value = null
  archivoBase64.value = ''
  archivoNombre.value = ''
  analisis.value = null
  for (const k of Object.keys(mapeo)) delete mapeo[k]
}

onMounted(cargarCatalogos)
</script>

<style scoped>
.paso { padding: 16px 18px; margin-bottom: 16px; }
.paso-titulo {
  display: flex; align-items: center; font-weight: 600; font-size: 13px;
  text-transform: uppercase; letter-spacing: .4px; opacity: .75; margin-bottom: 14px;
}
.paso-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; margin-right: 9px;
  background: linear-gradient(135deg, #e2564a, #f2a63b); color: #fff; font-size: 11px;
}

.paso-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.paso-opciones { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 14px; }

.mapeo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 10px 20px; }
.mapeo-fila { display: flex; align-items: center; gap: 8px; }
.mapeo-cab {
  flex: 0 0 130px; font-size: 12px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mapeo-fila > :last-child { flex: 1; }

.resumen { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.res-item {
  flex: 1 1 120px; border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px;
  padding: 10px 14px; display: flex; flex-direction: column; gap: 2px;
}
.res-item span { font-size: 20px; font-weight: 700; }
.res-item small { font-size: 10.5px; opacity: .6; text-transform: uppercase; letter-spacing: .4px; }
.res-item.ok span { color: #2e9e5b; }
.res-item.dup span { opacity: .5; }
.res-item.err span { color: #e2564a; }
.verde { color: #2e9e5b; } .rojo { color: #e2564a; }

.filtros-previa { margin-bottom: 10px; }
.msg { font-size: 11.5px; }
.msg.err { color: #e2564a; }
.msg.avi { color: #c8871a; }

.acciones-final { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.hint { font-size: 12px; opacity: .65; line-height: 1.5; }

@media (max-width: 700px) {
  .mapeo-cab { flex: 0 0 100px; }
}
</style>
