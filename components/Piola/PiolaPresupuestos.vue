<template>
  <div>
    <div class="filtros-bar">
      <v-select v-model="alcance" :items="[{ value: 'mensual', title: 'Mensual' }, { value: 'anual', title: 'Anual' }]"
        label="Alcance" density="compact" hide-details variant="outlined" class="filtro" />
      <v-select v-model="periodo" :items="periodosDisponibles" label="Periodo"
        density="compact" hide-details variant="outlined" class="filtro" />
      <v-select v-model="fTipo" :items="[{ value: 'egreso', title: 'Gastos' }, { value: 'ingreso', title: 'Ingresos' }]"
        label="Tipo" density="compact" hide-details variant="outlined" class="filtro" />
      <v-spacer />
      <v-btn v-if="puedeEditar" color="primary" variant="flat" size="small" @click="abrirNuevo">
        <v-icon icon="mdi-plus" start /> Presupuesto
      </v-btn>
    </div>

    <!-- Totales -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Presupuestado</span></div>
        <div class="stat-value">{{ PEN_CORTO(totales.presupuestado) }}</div>
        <div class="stat-description">{{ filas.length }} línea(s) para {{ periodo }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Ejecutado</span></div>
        <div class="stat-value">{{ PEN_CORTO(totales.ejecutado) }}</div>
        <div class="stat-description">{{ porcentaje(totales.ejecutado, totales.presupuestado) }} % del presupuesto</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Diferencia</span>
          <div :class="['stat-change', totales.diferencia >= 0 ? 'up' : 'down']">
            {{ totales.diferencia >= 0 ? 'dentro' : 'excedido' }}
          </div>
        </div>
        <div class="stat-value" :style="{ color: totales.diferencia >= 0 ? '#2e9e5b' : '#e2564a' }">
          {{ PEN_CORTO(totales.diferencia) }}
        </div>
        <div class="stat-description">Presupuestado − ejecutado</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Líneas excedidas</span></div>
        <div class="stat-value">{{ excedidas.length }}</div>
        <div class="stat-description">Gastaron más de lo presupuestado</div>
      </div>
    </div>

    <!-- Comparativo -->
    <div v-if="filas.length" class="chart-section">
      <div class="chart-header">
        <div class="chart-title-section">
          <h2>Presupuestado vs. ejecutado</h2>
          <div class="chart-subtitle">{{ periodo }} · {{ fTipo === 'egreso' ? 'gastos' : 'ingresos' }}</div>
        </div>
      </div>
      <div class="chart-area">
        <client-only>
          <apexchart type="bar" :height="alturaChart" :options="opcionesChart" :series="seriesChart" />
        </client-only>
      </div>
    </div>

    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">Detalle ({{ filas.length }})</span>
      </v-card-title>
      <v-data-table :headers="headers" :items="filas" :loading="cargando" class="elevation-0"
        no-data-text="No hay presupuestos cargados para este periodo" :items-per-page="25">
        <template v-slot:item.ambito="{ item }">
          <strong>{{ item.ambito }}</strong>
          <div v-if="item.subtitulo" class="ambito-sub">{{ item.subtitulo }}</div>
        </template>
        <template v-slot:item.monto="{ item }">{{ PEN(item.monto) }}</template>
        <template v-slot:item.ejecutado="{ item }">{{ PEN(item.ejecutado) }}</template>
        <template v-slot:item.diferencia="{ item }">
          <strong :style="{ color: item.diferencia >= 0 ? '#2e9e5b' : '#e2564a' }">
            {{ PEN(item.diferencia) }}
          </strong>
        </template>
        <template v-slot:item.avance="{ item }">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="barra">
              <div class="barra-fill" :style="{
                width: Math.min(item.avance, 100) + '%',
                background: item.avance > 100 ? '#e2564a' : (item.avance > 85 ? '#f2a63b' : '#2e9e5b'),
              }" />
            </div>
            <span style="font-size:12px; min-width:46px;">{{ item.avance }} %</span>
          </div>
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEditar" icon="mdi-pencil" size="x-small" variant="text" @click="editar(item)" />
          <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
            @click="eliminar(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ ALTA / EDICIÓN ══════════ -->
    <v-dialog :model-value="!!edicion" max-width="600" @update:model-value="edicion = null">
      <v-card v-if="edicion">
        <v-card-title class="pt-4">
          {{ edicion.id ? 'Editar presupuesto' : 'Nuevo presupuesto' }}
        </v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            El presupuesto se puede fijar por <b>área</b>, por <b>categoría</b>, por ambas
            o global (dejando las dos vacías).
          </v-alert>
          <div class="form-grid">
            <v-select v-model="edicion.alcance"
              :items="[{ value: 'mensual', title: 'Mensual' }, { value: 'anual', title: 'Anual' }]"
              label="Alcance" density="compact" hide-details variant="outlined"
              @update:model-value="ajustarPeriodo" />
            <v-select v-model="edicion.periodo" :items="periodosParaAlcance(edicion.alcance)"
              label="Periodo" density="compact" hide-details variant="outlined" />
            <v-select v-model="edicion.tipo"
              :items="[{ value: 'egreso', title: 'Gastos' }, { value: 'ingreso', title: 'Ingresos' }]"
              label="Tipo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="edicion.monto" type="number" min="0" label="Monto (S/) *"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="edicion.area_id" :items="opcionesArea" label="Área (opcional)"
              density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="edicion.category_id" :items="opcionesCategoria" label="Categoría (opcional)"
              density="compact" hide-details variant="outlined" clearable />
          </div>
          <v-text-field v-model="edicion.nombre" label="Nombre / etiqueta" density="compact"
            hide-details variant="outlined" class="mt-3" />
          <v-textarea v-model="edicion.notas" label="Notas" rows="2" density="compact"
            hide-details variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="edicion = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardar">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Presupuestos: mensual y anual, por área y por categoría.
 *
 * "Ejecutado" se calcula al vuelo contra piola_transactions, no se guarda: si
 * se guardara, cada movimiento nuevo dejaría el número desactualizado y haría
 * falta un cron para repararlo.
 *
 * Un presupuesto por categoría incluye a sus SUBCATEGORÍAS: presupuestar
 * "Producción" y que no cuente lo gastado en "Producción › Cámara" haría que
 * el número no signifique nada.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import {
  PEN, PEN_CORTO, periodoActual, ultimosPeriodos, aplanarCategorias, traerTodo, apiPiola,
} from '@/composables/usePiola'
import type { ApexOptions } from 'apexcharts'

// `perfil` ya no se usa en el script: `created_by` lo pone el servidor desde la
// sesión verificada. Sigue como prop porque el padre lo pasa con los permisos.
defineProps<{
  perfil: any
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

const cargando = ref(false)
const guardando = ref(false)
const presupuestos = ref<any[]>([])
const transacciones = ref<any[]>([])
const areas = ref<any[]>([])
const categorias = ref<any[]>([])

const alcance = ref<'mensual' | 'anual'>('mensual')
const periodo = ref(periodoActual())
const fTipo = ref<'ingreso' | 'egreso'>('egreso')

/* ══════════ Periodos ══════════ */
const mesesDisponibles = ultimosPeriodos(24)
const aniosDisponibles = computed(() => {
  const y = Number(periodoActual().slice(0, 4))
  return [y + 1, y, y - 1, y - 2].map(String)
})
const periodosParaAlcance = (a: string) => a === 'anual' ? aniosDisponibles.value : mesesDisponibles
const periodosDisponibles = computed(() => periodosParaAlcance(alcance.value))

// Al cambiar de alcance el periodo actual deja de tener el formato correcto
watch(alcance, (a) => {
  periodo.value = a === 'anual' ? periodoActual().slice(0, 4) : periodoActual()
})
function ajustarPeriodo(a: string) {
  if (!edicion.value) return
  edicion.value.periodo = a === 'anual' ? periodoActual().slice(0, 4) : periodoActual()
}

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [p, t, a, c] = await Promise.all([
    traerTodo(() => client.from('piola_presupuestos').select('*').order('id')),
    traerTodo(() => client.from('piola_transactions')
      .select('tipo, monto, fecha, category_id, area_id, proyectado, estado').order('id')),
    client.from('piola_areas').select('*').eq('activo', true).order('orden'),
    client.from('piola_expense_categories').select('*').order('orden'),
  ])
  if (p.error) emit('notify', { text: `Error cargando presupuestos: ${p.error.message}`, color: 'error' })
  presupuestos.value = (p.data as any[]) || []
  transacciones.value = (t.data as any[]) || []
  areas.value = (a.data as any[]) || []
  categorias.value = (c.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const categoriasPlanas = computed(() => aplanarCategorias(categorias.value))
const opcionesArea = computed(() => areas.value.map(a => ({ value: a.id, title: a.nombre })))
const opcionesCategoria = computed(() =>
  categoriasPlanas.value.filter(c => c.activo).map(c => ({ value: c.id, title: c.ruta })))

const nombreArea = (id: any) => areas.value.find(a => a.id === id)?.nombre
const rutaCategoria = (id: any) => categoriasPlanas.value.find(c => c.id === id)?.ruta

/** Todos los ids de una categoría y sus descendientes. */
function conDescendientes(id: number): Set<number> {
  const out = new Set<number>([id])
  let crecio = true
  while (crecio) {
    crecio = false
    for (const c of categorias.value) {
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) { out.add(c.id); crecio = true }
    }
  }
  return out
}

/** ¿La transacción cae dentro del periodo? 'YYYY-MM' o 'YYYY'. */
const enPeriodo = (fecha: any, per: string) =>
  String(fecha || '').slice(0, per.length) === per

/** Ejecutado real de una línea de presupuesto. Las proyecciones no cuentan. */
function ejecutadoDe(p: any): number {
  const ids = p.category_id ? conDescendientes(p.category_id) : null
  return transacciones.value
    .filter(t => t.tipo === p.tipo)
    .filter(t => !t.proyectado && t.estado !== 'anulado')
    .filter(t => enPeriodo(t.fecha, p.periodo))
    .filter(t => !p.area_id || t.area_id === p.area_id)
    .filter(t => !ids || ids.has(t.category_id))
    .reduce((s, t) => s + Number(t.monto || 0), 0)
}

const porcentaje = (parte: number, total: number) =>
  total ? Math.round(parte / total * 1000) / 10 : 0

const filas = computed(() => presupuestos.value
  .filter(p => p.periodo === periodo.value && p.tipo === fTipo.value)
  .map(p => {
    const ejecutado = ejecutadoDe(p)
    const monto = Number(p.monto || 0)
    const partes = [nombreArea(p.area_id), rutaCategoria(p.category_id)].filter(Boolean)
    return {
      ...p,
      monto,
      ejecutado,
      diferencia: Math.round((monto - ejecutado) * 100) / 100,
      avance: porcentaje(ejecutado, monto),
      ambito: p.nombre || partes[0] || 'Global',
      subtitulo: p.nombre ? partes.join(' · ') : partes.slice(1).join(' · '),
    }
  })
  .sort((a, b) => b.monto - a.monto))

const excedidas = computed(() => filas.value.filter(f => f.diferencia < 0))

const totales = computed(() => {
  const presupuestado = filas.value.reduce((s, f) => s + f.monto, 0)
  const ejecutado = filas.value.reduce((s, f) => s + f.ejecutado, 0)
  return {
    presupuestado, ejecutado,
    diferencia: Math.round((presupuestado - ejecutado) * 100) / 100,
  }
})

const headers = [
  { title: 'Ámbito', key: 'ambito' },
  { title: 'Presupuestado', key: 'monto' },
  { title: 'Ejecutado', key: 'ejecutado' },
  { title: 'Diferencia', key: 'diferencia' },
  { title: 'Avance', key: 'avance' },
  { title: '', key: 'acciones', sortable: false },
]

/* ══════════ Gráfico ══════════ */
const alturaChart = computed(() => Math.max(240, filas.value.length * 44 + 90))
const seriesChart = computed(() => [
  { name: 'Presupuestado', data: filas.value.map(f => f.monto) },
  { name: 'Ejecutado', data: filas.value.map(f => f.ejecutado) },
])
const opcionesChart = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
  colors: ['#5b8def', '#e2564a'],
  dataLabels: { enabled: false },
  xaxis: {
    categories: filas.value.map(f => f.ambito),
    labels: { formatter: (v: any) => PEN_CORTO(v) },
  },
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
  tooltip: { theme: isDark.value ? 'dark' : 'light', y: { formatter: (v: number) => PEN(v) } },
}))

/* ══════════ CRUD ══════════ */
const edicion = ref<any>(null)

function abrirNuevo() {
  edicion.value = {
    alcance: alcance.value, periodo: periodo.value, tipo: fTipo.value,
    monto: 0, area_id: null, category_id: null, nombre: '', notas: '',
  }
}
function editar(f: any) { edicion.value = { ...f } }

async function guardar() {
  const e = edicion.value
  if (!Number(e.monto)) return emit('notify', { text: 'El presupuesto necesita un monto', color: 'error' })

  guardando.value = true
  const fila = {
    nombre: e.nombre?.trim() || null,
    alcance: e.alcance,
    periodo: e.periodo,
    tipo: e.tipo,
    area_id: e.area_id || null,
    category_id: e.category_id || null,
    monto: Number(e.monto),
    notas: e.notas || null,
  }
  // `created_by` lo pone el servidor, y solo en el alta: sobrescribirlo al
  // editar borraba el único dato de autoría que guarda la tabla.
  const res = await apiPiola('presupuestos', { accion: 'guardar', id: e.id || null, ...fila })
  guardando.value = false

  if (res.error) {
    const msg = /idx_piola_presupuesto_unico|duplicate key/i.test(res.error.message)
      ? 'Ya existe un presupuesto para ese periodo, tipo, área y categoría.'
      : `Error guardando: ${res.error.message}`
    return emit('notify', { text: msg, color: 'error' })
  }
  emit('notify', e.id ? 'Presupuesto actualizado' : 'Presupuesto creado')
  edicion.value = null
  await cargar()
}

async function eliminar(f: any) {
  if (!confirm(`¿Eliminar el presupuesto de "${f.ambito}" para ${f.periodo}?`)) return
  const { error } = await apiPiola('presupuestos', { accion: 'eliminar', id: f.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Presupuesto eliminado')
  await cargar()
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
.filtros-bar .filtro { flex: 0 1 160px; min-width: 140px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

.ambito-sub { font-size: 11px; opacity: .55; }

.barra {
  flex: 1; height: 7px; min-width: 70px; border-radius: 4px;
  background: rgba(128, 128, 128, .2); overflow: hidden;
}
.barra-fill { height: 100%; border-radius: 4px; transition: width .25s; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
