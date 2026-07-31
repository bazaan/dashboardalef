<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Producción y Contenidos</h1>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <v-select v-model="periodo" :items="periodos" density="compact" hide-details variant="outlined"
          style="min-width:140px;" />
        <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo entregable</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'tablero' }]" @click="tab = 'tablero'">Tablero</button>
          <button :class="['tab', { active: tab === 'cumplimiento' }]" @click="tab = 'cumplimiento'">
            Cumplimiento por marca
          </button>
          <button :class="['tab', { active: tab === 'marcas' }]" @click="tab = 'marcas'">Marcas / clientes</button>
          <button :class="['tab', { active: tab === 'catalogo' }]" @click="tab = 'catalogo'">Catálogo de servicios</button>
        </div>

        <!-- ══════════ TABLERO POR ESTADO ══════════ -->
        <div v-if="tab === 'tablero'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Todo contenido pasa por el <b>Director Estratégico</b>, que aprueba antes de la entrega:
            En producción → En revisión → Aprobado por Dirección → Entregado.
          </v-alert>

          <div class="filtros-bar">
            <v-select v-model="fCliente" :items="opcionesClienteFiltro" density="compact" hide-details
              variant="outlined" label="Marca" class="filtro" />
            <v-select v-model="fResponsable" :items="opcionesResponsableFiltro" density="compact" hide-details
              variant="outlined" label="Responsable" class="filtro" />
          </div>

          <div class="kanban">
            <div v-for="estado in ESTADOS_ENTREGABLE" :key="estado.value" class="kanban-col">
              <div class="kanban-head">
                <span class="kanban-nombre">{{ estado.title }}</span>
                <span class="kanban-count">{{ porEstado(estado.value).length }}</span>
              </div>
              <div class="kanban-body">
                <div v-for="e in porEstado(estado.value)" :key="e.id" class="ent-card" @click="detalle = { ...e }">
                  <div class="ent-titulo">{{ e.titulo }}</div>
                  <div class="ent-cliente">{{ nombreCliente(e.cliente_id) }}</div>
                  <div class="ent-pie">
                    <span :class="{ 'texto-alerta': atrasado(e) }">
                      <v-icon :icon="atrasado(e) ? 'mdi-alert-circle' : 'mdi-calendar'" size="12" />
                      {{ fechaCorta(e.fecha_compromiso) }}
                    </span>
                    <span v-if="e.cantidad > 1" class="ent-cant">×{{ e.cantidad }}</span>
                  </div>
                  <div v-if="e.drive_url" class="ent-drive">
                    <v-icon icon="mdi-google-drive" size="12" /> Drive
                  </div>
                </div>
                <div v-if="!porEstado(estado.value).length" class="kanban-vacio">Nada aquí</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════ CUMPLIMIENTO POR MARCA ══════════ -->
        <v-card v-else-if="tab === 'cumplimiento'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Compromiso mensual vs. entregado — {{ periodo }}</span>
          </v-card-title>
          <v-data-table :headers="headersCumplimiento" :items="cumplimiento" class="elevation-0"
            no-data-text="Sin clientes activos" :items-per-page="25">
            <template v-slot:item.cumplimiento="{ item }">
              <div style="display:flex; align-items:center; gap:10px;">
                <div class="barra">
                  <div class="barra-fill" :style="{
                    width: Math.min(100, item.cumplimiento) + '%',
                    background: item.cumplimiento >= 100 ? '#2e9e5b' : item.cumplimiento >= 60 ? '#f2a63b' : '#e2564a',
                  }" />
                </div>
                <span style="font-size:12.5px; min-width:48px; font-weight:600;">
                  {{ item.comprometidos ? item.cumplimiento + ' %' : '—' }}
                </span>
              </div>
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ MARCAS / CLIENTES ══════════ -->
        <v-card v-else-if="tab === 'marcas'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Marcas ({{ clientes.length }})</span>
            <v-spacer />
            <v-btn v-if="puedeCrear" size="small" color="primary" variant="flat" @click="abrirCliente()">
              <v-icon icon="mdi-plus" start /> Nueva marca
            </v-btn>
          </v-card-title>
          <v-data-table :headers="headersClientes" :items="clientes" class="elevation-0"
            no-data-text="Todavía no hay clientes. Se crean al convertir un lead ganado en el CRM."
            :items-per-page="25" @click:row="(_: any, r: any) => abrirCliente(r.item)">
            <template v-slot:item.compromiso_mensual="{ item }">
              {{ item.compromiso_mensual || '—' }} pieza(s)/mes
            </template>
            <template v-slot:item.entregados="{ item }">
              {{ entregadosDe(item.id) }}
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ CATÁLOGO DE SERVICIOS ══════════ -->
        <v-card v-else-if="tab === 'catalogo'" flat class="custom-data-table" style="padding:20px;">
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            Lista provisional: <b>Piola enviará el catálogo completo y específico</b> de servicios.
            Se administra desde aquí, sin desarrollo.
          </v-alert>
          <div v-if="puedeEditar" class="serv-nuevo">
            <v-text-field v-model="nuevoServicio.nombre" label="Servicio" density="compact"
              hide-details variant="outlined" @keyup.enter="crearServicio" />
            <v-text-field v-model="nuevoServicio.categoria" label="Categoría" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model.number="nuevoServicio.precio_referencial" type="number"
              label="Precio ref. (S/)" density="compact" hide-details variant="outlined" />
            <v-btn color="primary" variant="flat" @click="crearServicio">Agregar</v-btn>
          </div>
          <v-data-table :headers="headersServicios" :items="servicios" class="elevation-0"
            no-data-text="Sin servicios" :items-per-page="25">
            <template v-slot:item.precio_referencial="{ item }">
              {{ item.precio_referencial ? PEN(item.precio_referencial) : '—' }}
            </template>
            <template v-slot:item.acciones="{ item }">
              <v-btn v-if="puedeEditar" :icon="item.activo ? 'mdi-eye-off' : 'mdi-eye'" size="x-small"
                variant="text" @click="alternarServicio(item)" />
              <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
                @click="eliminarServicio(item)" />
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>

    <!-- ══════════ ENTREGABLE ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="720" scrollable @update:model-value="detalle = null">
      <v-card v-if="detalle">
        <v-card-title class="pt-4">{{ detalle.id ? 'Entregable' : 'Nuevo entregable' }}</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="detalle.titulo" label="Título *" density="compact" hide-details
              variant="outlined" class="col-2" />
            <v-select v-model="detalle.cliente_id" :items="opcionesCliente" label="Marca / cliente *"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.service_id" :items="opcionesServicio" label="Servicio"
              density="compact" hide-details variant="outlined" clearable />
            <v-text-field v-model.number="detalle.cantidad" type="number" label="Cantidad de piezas"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.periodo" label="Periodo (YYYY-MM)" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="detalle.fecha_compromiso" type="date" label="Fecha de compromiso"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.responsable_email" :items="opcionesResponsable" label="Responsable"
              density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="detalle.estado" :items="ESTADOS_ENTREGABLE" label="Estado"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.drive_url" label="Enlace de Google Drive" density="compact"
              hide-details variant="outlined" prepend-inner-icon="mdi-google-drive" />
          </div>
          <v-textarea v-model="detalle.descripcion" label="Descripción" rows="2" density="compact"
            hide-details variant="outlined" class="mt-3" />
          <v-textarea v-model="detalle.observaciones" label="Observaciones de Dirección" rows="2"
            density="compact" hide-details variant="outlined" class="mt-3" />

          <v-alert v-if="detalle.aprobado_por" type="success" variant="tonal" density="compact" class="mt-4">
            Aprobado por <b>{{ detalle.aprobado_por }}</b> el {{ fechaHora(detalle.aprobado_at) }}.
          </v-alert>
        </v-card-text>
        <v-card-actions style="flex-wrap:wrap; gap:8px; padding:12px 20px 18px;">
          <v-btn v-if="detalle.id && puedeEliminar" color="error" variant="text" @click="eliminarEntregable">
            Eliminar
          </v-btn>
          <v-btn v-if="detalle.id && puedeAprobar && detalle.estado === 'en_revision'" color="success"
            variant="tonal" :loading="aprobando" @click="aprobar">
            <v-icon icon="mdi-check-decagram" start /> Aprobar (Dirección)
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="detalle = null">Cerrar</v-btn>
          <v-btn v-if="puedeEditar" color="primary" variant="flat" :loading="guardando" @click="guardarEntregable">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ CLIENTE / MARCA ══════════ -->
    <v-dialog :model-value="!!cliente" max-width="600" @update:model-value="cliente = null">
      <v-card v-if="cliente">
        <v-card-title class="pt-4">{{ cliente.id ? 'Editar marca' : 'Nueva marca' }}</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="cliente.nombre" label="Nombre / marca *" density="compact"
              hide-details variant="outlined" class="col-2" />
            <v-text-field v-model="cliente.razon_social" label="Razón social" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="cliente.ruc" label="RUC" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.contacto" label="Contacto" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.telefono" label="Teléfono" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.email" label="Correo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="cliente.compromiso_mensual" type="number"
              label="Piezas comprometidas al mes" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.direccion" label="Dirección" density="compact"
              hide-details variant="outlined" class="col-2" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cliente = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoCliente" @click="guardarCliente">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Producción y Contenidos (§6).
 *
 * Gestión por marca/cliente: cada uno tiene un compromiso mensual de piezas.
 * El flujo de aprobación pasa siempre por el Director Estratégico, y el
 * cumplimiento por marca es lo que alimenta el reporte quincenal (§9).
 * Los adjuntos viven en Google Drive (decisión tomada: no Dropbox).
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, fechaCorta, fechaHora, periodoActual, ultimosPeriodos, hoyISO, ESTADOS_ENTREGABLE,
} from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'delete'))
/** La aprobación es del Director Estratégico: admin o quien tenga edición del módulo. */
const puedeAprobar = computed(() => props.perfil?.es_admin || puedeEditar.value)

const tab = ref('tablero')
const periodo = ref(periodoActual())
const periodos = ultimosPeriodos(12)

const entregables = ref<any[]>([])
const clientes = ref<any[]>([])
const servicios = ref<any[]>([])
const colaboradores = ref<any[]>([])
const fCliente = ref<any>('todas')
const fResponsable = ref<any>('todos')

async function cargar() {
  const [e, c, s, col] = await Promise.all([
    client.from('piola_deliverables').select('*').order('fecha_compromiso', { ascending: true }).limit(2000),
    client.from('piola_clientes').select('*').order('nombre'),
    client.from('piola_services').select('*').order('orden'),
    client.from('piola_colaboradores').select('email, nombre').eq('activo', true).order('nombre'),
  ])
  if (e.error) emit('notify', { text: `Error cargando entregables: ${e.error.message}`, color: 'error' })
  entregables.value = (e.data as any[]) || []
  clientes.value = (c.data as any[]) || []
  servicios.value = (s.data as any[]) || []
  colaboradores.value = (col.data as any[]) || []
}

/* ══════════ Derivados ══════════ */
const nombreCliente = (id: any) => clientes.value.find(c => c.id === id)?.nombre || '—'

const opcionesCliente = computed(() => clientes.value.map(c => ({ value: c.id, title: c.nombre })))
const opcionesClienteFiltro = computed(() =>
  [{ value: 'todas', title: 'Todas las marcas' }, ...opcionesCliente.value])
const opcionesServicio = computed(() => servicios.value.map(s => ({ value: s.id, title: s.nombre })))
const opcionesResponsable = computed(() =>
  colaboradores.value.map(c => ({ value: c.email, title: c.nombre })))
const opcionesResponsableFiltro = computed(() =>
  [{ value: 'todos', title: 'Todos' }, ...opcionesResponsable.value])

const delPeriodo = computed(() => {
  let lista = entregables.value.filter(e => e.periodo === periodo.value)
  if (fCliente.value !== 'todas') lista = lista.filter(e => e.cliente_id === fCliente.value)
  if (fResponsable.value !== 'todos') lista = lista.filter(e => e.responsable_email === fResponsable.value)
  return lista
})

const porEstado = (estado: string) => delPeriodo.value.filter(e => e.estado === estado)

const atrasado = (e: any) =>
  !['entregado', 'aprobado'].includes(e.estado) && e.fecha_compromiso
  && String(e.fecha_compromiso).slice(0, 10) < hoyISO()

const entregadosDe = (clienteId: any) => entregables.value
  .filter(e => e.cliente_id === clienteId && e.periodo === periodo.value
    && ['entregado', 'aprobado'].includes(e.estado))
  .reduce((s, e) => s + Number(e.cantidad || 1), 0)

const cumplimiento = computed(() => clientes.value
  .filter(c => c.activo !== false)
  .map(c => {
    const entregados = entregadosDe(c.id)
    const comprometidos = Number(c.compromiso_mensual || 0)
    const suyos = entregables.value.filter(e => e.cliente_id === c.id && e.periodo === periodo.value)
    return {
      cliente: c.nombre,
      comprometidos: comprometidos || 0,
      entregados,
      en_produccion: suyos.filter(e => e.estado === 'en_produccion').length,
      en_revision: suyos.filter(e => e.estado === 'en_revision').length,
      cumplimiento: comprometidos
        ? Math.round(entregados / comprometidos * 1000) / 10
        : (entregados ? 100 : 0),
    }
  })
  .sort((a, b) => a.cumplimiento - b.cumplimiento))

const headersCumplimiento = [
  { title: 'Marca', key: 'cliente' },
  { title: 'Comprometidos', key: 'comprometidos' },
  { title: 'Entregados', key: 'entregados' },
  { title: 'En producción', key: 'en_produccion' },
  { title: 'En revisión', key: 'en_revision' },
  { title: 'Cumplimiento', key: 'cumplimiento' },
]
const headersClientes = [
  { title: 'Marca', key: 'nombre' },
  { title: 'RUC', key: 'ruc' },
  { title: 'Contacto', key: 'contacto' },
  { title: 'Compromiso', key: 'compromiso_mensual' },
  { title: `Entregado ${periodo.value}`, key: 'entregados', sortable: false },
]
const headersServicios = [
  { title: 'Servicio', key: 'nombre' },
  { title: 'Categoría', key: 'categoria' },
  { title: 'Precio referencial', key: 'precio_referencial' },
  { title: '', key: 'acciones', sortable: false },
]

/* ══════════ CRUD de entregables ══════════ */
const detalle = ref<any>(null)
const guardando = ref(false)
const aprobando = ref(false)

function abrirNuevo() {
  detalle.value = {
    titulo: '', cliente_id: null, service_id: null, cantidad: 1,
    periodo: periodo.value, fecha_compromiso: '', responsable_email: props.perfil?.email || null,
    estado: 'en_produccion', drive_url: '', descripcion: '', observaciones: '',
  }
}

async function guardarEntregable() {
  const d = detalle.value
  if (!d.titulo?.trim() || !d.cliente_id) {
    return emit('notify', { text: 'El entregable necesita título y marca', color: 'error' })
  }
  guardando.value = true
  const fila = {
    titulo: d.titulo.trim(), cliente_id: d.cliente_id, service_id: d.service_id || null,
    cantidad: Number(d.cantidad || 1), periodo: d.periodo, descripcion: d.descripcion || null,
    fecha_compromiso: d.fecha_compromiso || null,
    fecha_entrega: d.estado === 'entregado' ? (d.fecha_entrega || hoyISO()) : d.fecha_entrega || null,
    estado: d.estado, responsable_email: d.responsable_email || null,
    observaciones: d.observaciones || null, drive_url: d.drive_url || null,
    updated_at: new Date().toISOString(),
  }
  const res = d.id
    ? await client.from('piola_deliverables').update(fila).eq('id', d.id)
    : await client.from('piola_deliverables').insert(fila)
  guardando.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', d.id ? 'Entregable actualizado' : 'Entregable creado')
  detalle.value = null
  await cargar()
}

async function aprobar() {
  aprobando.value = true
  const { error } = await client.from('piola_deliverables').update({
    estado: 'aprobado',
    aprobado_por: props.perfil?.email,
    aprobado_at: new Date().toISOString(),
  }).eq('id', detalle.value.id)
  aprobando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Entregable aprobado por Dirección')
  detalle.value = null
  await cargar()
}

async function eliminarEntregable() {
  if (!confirm(`¿Eliminar "${detalle.value.titulo}"?`)) return
  const { error } = await client.from('piola_deliverables').delete().eq('id', detalle.value.id)
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Entregable eliminado')
  detalle.value = null
  await cargar()
}

/* ══════════ CRUD de marcas ══════════ */
const cliente = ref<any>(null)
const guardandoCliente = ref(false)

function abrirCliente(item?: any) {
  cliente.value = item ? { ...item } : {
    nombre: '', razon_social: '', ruc: '', contacto: '', telefono: '', email: '',
    direccion: '', compromiso_mensual: 0,
  }
}

async function guardarCliente() {
  const c = cliente.value
  if (!c.nombre?.trim()) return emit('notify', { text: 'La marca necesita un nombre', color: 'error' })
  guardandoCliente.value = true
  const fila = {
    nombre: c.nombre.trim(), razon_social: c.razon_social || null, ruc: c.ruc || null,
    contacto: c.contacto || null, telefono: c.telefono || null, email: c.email || null,
    direccion: c.direccion || null, compromiso_mensual: Number(c.compromiso_mensual || 0),
  }
  const res = c.id
    ? await client.from('piola_clientes').update(fila).eq('id', c.id)
    : await client.from('piola_clientes').insert(fila)
  guardandoCliente.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', c.id ? 'Marca actualizada' : 'Marca creada')
  cliente.value = null
  await cargar()
}

/* ══════════ Catálogo de servicios ══════════ */
const nuevoServicio = ref<any>({ nombre: '', categoria: '', precio_referencial: null })

async function crearServicio() {
  if (!nuevoServicio.value.nombre?.trim()) return
  const { error } = await client.from('piola_services').insert({
    nombre: nuevoServicio.value.nombre.trim(),
    categoria: nuevoServicio.value.categoria || null,
    precio_referencial: nuevoServicio.value.precio_referencial || null,
    orden: servicios.value.length + 1,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  nuevoServicio.value = { nombre: '', categoria: '', precio_referencial: null }
  emit('notify', 'Servicio agregado')
  await cargar()
}

async function alternarServicio(s: any) {
  await client.from('piola_services').update({ activo: !s.activo }).eq('id', s.id)
  await cargar()
}

async function eliminarServicio(s: any) {
  if (!confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return
  const { error } = await client.from('piola_services').delete().eq('id', s.id)
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

onMounted(cargar)
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.filtros-bar .filtro { flex: 1 1 180px; max-width: 250px; }

.kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start; }
.kanban-col {
  flex: 0 0 250px; background: rgba(128, 128, 128, .06);
  border: 1px solid rgba(128, 128, 128, .18); border-radius: 12px; padding: 12px;
}
.kanban-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.kanban-nombre { font-weight: 600; font-size: 12.5px; }
.kanban-count {
  background: rgba(128, 128, 128, .2); border-radius: 999px; padding: 1px 8px; font-size: 11.5px; font-weight: 600;
}
.kanban-body { display: flex; flex-direction: column; gap: 8px; min-height: 50px; }
.kanban-vacio { font-size: 12px; opacity: .4; text-align: center; padding: 16px 0; }

.ent-card {
  background: var(--bg, #fff); border: 1px solid rgba(128, 128, 128, .2);
  border-radius: 9px; padding: 10px 11px; cursor: pointer; transition: transform .12s, box-shadow .12s;
}
.ent-card:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0, 0, 0, .1); }
.ent-titulo { font-weight: 600; font-size: 13px; }
.ent-cliente { font-size: 11.5px; opacity: .6; margin-top: 2px; }
.ent-pie {
  display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
  padding-top: 7px; border-top: 1px dashed rgba(128, 128, 128, .25); font-size: 11px; opacity: .7;
}
.ent-cant { font-weight: 600; }
.ent-drive { font-size: 10.5px; opacity: .6; margin-top: 4px; }
.texto-alerta { color: #e2564a; font-weight: 600; opacity: 1; }

.barra {
  flex: 1; height: 7px; background: rgba(128, 128, 128, .18);
  border-radius: 999px; overflow: hidden; min-width: 80px;
}
.barra-fill { height: 100%; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.serv-nuevo { display: grid; grid-template-columns: 2fr 1.4fr 1fr auto; gap: 10px; margin-bottom: 16px; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .serv-nuevo { grid-template-columns: 1fr; }
}
</style>
