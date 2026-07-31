<template>
  <div class="view-container">
    <header class="top-header">
      <h1>CRM Comercial</h1>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div class="vista-switch">
          <button :class="['tab', { active: vista === 'kanban' }]" @click="vista = 'kanban'">
            <v-icon icon="mdi-view-column" size="15" /> Tablero
          </button>
          <button :class="['tab', { active: vista === 'tabla' }]" @click="vista = 'tabla'">
            <v-icon icon="mdi-table" size="15" /> Tabla
          </button>
        </div>
        <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo lead</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <!-- KPIs del pipeline -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Leads activos</span></div>
          <div class="stat-value">{{ leadsAbiertos.length }}</div>
          <div class="stat-description">Sin cerrar, en cualquier etapa</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Ingresaron este mes</span></div>
          <div class="stat-value">{{ leadsDelMes.length }}</div>
          <div class="stat-description">Desde el {{ periodo }}-01</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Conversión del mes</span>
            <div class="stat-change up">{{ ganadosMes.length }} ganados</div>
          </div>
          <div class="stat-value">{{ conversionMes }} %</div>
          <div class="stat-description">Ganados / ingresados en el mes</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Cotizado en pipeline</span></div>
          <div class="stat-value">{{ PEN_CORTO(montoPipeline) }}</div>
          <div class="stat-description">Suma de leads abiertos</div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filtros-bar">
        <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify" placeholder="Nombre, teléfono, correo…"
          density="compact" hide-details variant="outlined" clearable class="filtro filtro-buscar" />
        <v-select v-model="fFuente" :items="[{ value: 'todas', title: 'Todas las fuentes' }, ...FUENTES_LEAD]"
          density="compact" hide-details variant="outlined" label="Fuente" class="filtro" />
        <v-select v-model="fOwner" :items="opcionesOwner" density="compact" hide-details
          variant="outlined" label="Responsable" class="filtro" />
        <v-switch v-model="soloAbiertos" color="primary" density="compact" hide-details
          label="Solo abiertos" class="filtro" style="flex:0 0 auto;" />
      </div>

      <!-- ══════════ KANBAN ══════════ -->
      <div v-if="vista === 'kanban'" class="kanban">
        <div v-for="etapa in etapasActivas" :key="etapa.id" class="kanban-col"
          @dragover.prevent @drop="soltarEn(etapa)">
          <div class="kanban-head" :style="{ borderTopColor: etapa.color }">
            <span class="kanban-nombre">{{ etapa.nombre }}</span>
            <span class="kanban-count">{{ porEtapa(etapa.id).length }}</span>
          </div>
          <div class="kanban-monto">{{ PEN_CORTO(montoEtapa(etapa.id)) }}</div>
          <div class="kanban-body">
            <div v-for="lead in porEtapa(etapa.id)" :key="lead.id" class="lead-card"
              :draggable="puedeEditar" @dragstart="arrastrando = lead" @click="abrirDetalle(lead)">
              <div class="lead-nombre">{{ lead.nombre }}</div>
              <div class="lead-meta">
                <span v-if="lead.monto_cotizado">{{ PEN(lead.monto_cotizado) }}</span>
                <span class="lead-fuente">{{ etiquetaFuente(lead.fuente) }}</span>
              </div>
              <div class="lead-pie">
                <span :class="['lead-seguimiento', { alerta: sinSeguimiento(lead) }]">
                  <v-icon :icon="sinSeguimiento(lead) ? 'mdi-alert-circle' : 'mdi-clock-outline'" size="12" />
                  {{ ultimoContacto(lead) }}
                </span>
                <span v-if="lead.owner_email" class="lead-owner">{{ iniciales(lead.owner_email) }}</span>
              </div>
            </div>
            <div v-if="!porEtapa(etapa.id).length" class="kanban-vacio">Sin leads</div>
          </div>
        </div>
      </div>

      <!-- ══════════ TABLA ══════════ -->
      <v-card v-else flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Leads ({{ leadsFiltrados.length }})</span>
        </v-card-title>
        <v-data-table :headers="headers" :items="leadsFiltrados" :loading="cargando" class="elevation-0"
          no-data-text="No hay leads que coincidan" :items-per-page="25"
          @click:row="(_: any, r: any) => abrirDetalle(r.item)">
          <template v-slot:item.stage_id="{ item }">
            <span class="etapa-chip" :style="chipEtapa(item.stage_id)">{{ nombreEtapa(item.stage_id) }}</span>
          </template>
          <template v-slot:item.fuente="{ item }">{{ etiquetaFuente(item.fuente) }}</template>
          <template v-slot:item.monto_cotizado="{ item }">{{ PEN(item.monto_cotizado) }}</template>
          <template v-slot:item.ultima_interaccion="{ item }">
            <span :class="{ 'texto-alerta': sinSeguimiento(item) }">{{ ultimoContacto(item) }}</span>
          </template>
          <template v-slot:item.fecha_ingreso="{ item }">{{ fechaCorta(item.fecha_ingreso) }}</template>
        </v-data-table>
      </v-card>
    </div>

    <!-- ══════════ DIÁLOGO DE LEAD ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="900" scrollable @update:model-value="cerrarDetalle">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700;">{{ detalle.id ? detalle.nombre : 'Nuevo lead' }}</span>
          <span v-if="detalle.id" class="etapa-chip" :style="chipEtapa(detalle.stage_id)">
            {{ nombreEtapa(detalle.stage_id) }}
          </span>
        </v-card-title>

        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="detalle.nombre" label="Nombre *" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.telefono" label="Teléfono / WhatsApp" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.email" label="Correo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.empresa" label="Empresa / marca" density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.fuente" :items="FUENTES_LEAD" label="Fuente" density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.stage_id" :items="etapasSelect" label="Etapa" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="detalle.monto_cotizado" type="number" label="Monto cotizado (S/)"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.owner_email" :items="opcionesOwnerSimple" label="Responsable"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.servicios" :items="serviciosNombres" label="Servicios de interés"
              density="compact" hide-details variant="outlined" multiple chips closable-chips />
            <v-text-field v-model="detalle.proxima_accion" type="datetime-local" label="Próxima acción"
              density="compact" hide-details variant="outlined" />
          </div>
          <v-textarea v-model="detalle.notas" label="Notas" rows="2" density="compact" hide-details
            variant="outlined" class="mt-3" />

          <template v-if="detalle.id">
            <v-divider class="my-5" />

            <!-- Registrar interacción: el closer contacta a diario o interdiario -->
            <div class="form-section-title">Registrar interacción</div>
            <div class="form-grid-actividad">
              <v-select v-model="nuevaActividad.canal" :items="CANALES_ACTIVIDAD" label="Canal"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="nuevaActividad.proxima_accion" type="datetime-local" label="Próxima acción"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="nuevaActividad.nota" label="¿Qué pasó?" density="compact" hide-details
                variant="outlined" @keyup.enter="registrarActividad" />
              <v-btn color="primary" variant="flat" :loading="guardandoActividad" @click="registrarActividad">
                Registrar
              </v-btn>
            </div>

            <div class="timeline mt-4">
              <div v-for="a in actividades" :key="a.id" class="timeline-item">
                <div class="timeline-punto" />
                <div class="timeline-cuerpo">
                  <div class="timeline-head">
                    <strong>{{ etiquetaCanal(a.canal) }}</strong>
                    <span>{{ fechaHora(a.created_at) }}</span>
                  </div>
                  <div class="timeline-nota">{{ a.nota || '—' }}</div>
                  <div v-if="a.proxima_accion" class="timeline-prox">
                    <v-icon icon="mdi-calendar-clock" size="12" /> Próxima acción: {{ fechaHora(a.proxima_accion) }}
                  </div>
                  <div v-if="a.user_email" class="timeline-user">{{ a.user_email }}</div>
                </div>
              </div>
              <div v-if="!actividades.length" class="timeline-vacio">Sin interacciones registradas todavía.</div>
            </div>
          </template>
        </v-card-text>

        <v-card-actions style="padding: 12px 20px 18px; flex-wrap: wrap; gap: 8px;">
          <v-btn v-if="detalle.id && puedeEliminar" color="error" variant="text" @click="eliminarLead">Eliminar</v-btn>
          <v-btn v-if="detalle.id && !detalle.cliente_id && esGanado(detalle.stage_id)" color="success"
            variant="tonal" :loading="convirtiendo" @click="convertirEnCliente">
            <v-icon icon="mdi-account-star" start /> Convertir en cliente
          </v-btn>
          <v-chip v-else-if="detalle.cliente_id" size="small" color="success" variant="tonal">
            Ya es cliente
          </v-chip>
          <v-spacer />
          <v-btn variant="text" @click="cerrarDetalle">Cerrar</v-btn>
          <v-btn v-if="puedeEditar" color="primary" variant="flat" :loading="guardando" @click="guardarLead">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo CRM Comercial (§3).
 *
 * Pipeline: Lead frío → Reunión inicial → Cotización → Negociación → Cerrado.
 * Las ETAPAS NO están hardcodeadas: salen de `piola_lead_stages` y se editan
 * desde Configuración (crear, renombrar, color, orden). Aquí solo se leen.
 *
 * Al cerrar un lead en una etapa marcada como "ganado" se puede convertirlo en
 * Cliente, que es lo que alimenta Producción y Facturación.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, PEN_CORTO, fechaCorta, fechaHora, periodoActual,
  FUENTES_LEAD, CANALES_ACTIVIDAD,
} from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const periodo = periodoActual()

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'crm', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'crm', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'crm', 'delete'))

const vista = ref<'kanban' | 'tabla'>('kanban')
const cargando = ref(false)
const leads = ref<any[]>([])
const etapas = ref<any[]>([])
const colaboradores = ref<any[]>([])
const servicios = ref<any[]>([])

const fBuscar = ref('')
const fFuente = ref('todas')
const fOwner = ref('todos')
const soloAbiertos = ref(true)

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [l, e, c, s] = await Promise.all([
    client.from('piola_leads').select('*').order('fecha_ingreso', { ascending: false }).limit(2000),
    client.from('piola_lead_stages').select('*').order('orden'),
    client.from('piola_colaboradores').select('email, nombre, activo').eq('activo', true).order('nombre'),
    client.from('piola_services').select('nombre').eq('activo', true).order('orden'),
  ])
  if (l.error) emit('notify', { text: `Error cargando leads: ${l.error.message}`, color: 'error' })
  leads.value = (l.data as any[]) || []
  etapas.value = (e.data as any[]) || []
  colaboradores.value = (c.data as any[]) || []
  servicios.value = (s.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const etapasActivas = computed(() => etapas.value.filter(e => e.activo !== false))
const etapasSelect = computed(() => etapasActivas.value.map(e => ({ value: e.id, title: e.nombre })))
const serviciosNombres = computed(() => servicios.value.map(s => s.nombre))

const opcionesOwner = computed(() => [
  { value: 'todos', title: 'Todos los responsables' },
  ...colaboradores.value.map(c => ({ value: c.email, title: c.nombre })),
])
const opcionesOwnerSimple = computed(() =>
  colaboradores.value.map(c => ({ value: c.email, title: `${c.nombre} (${c.email})` })))

const nombreEtapa = (id: any) => etapas.value.find(e => e.id === id)?.nombre || 'Sin etapa'
const colorEtapa = (id: any) => etapas.value.find(e => e.id === id)?.color || '#8e8e8e'
const esGanado = (id: any) => !!etapas.value.find(e => e.id === id)?.es_ganado
const esCerrada = (id: any) => {
  const e = etapas.value.find(x => x.id === id)
  return !!(e?.es_ganado || e?.es_perdido)
}
const chipEtapa = (id: any) => ({
  background: `${colorEtapa(id)}22`, color: colorEtapa(id), border: `1px solid ${colorEtapa(id)}55`,
})
const etiquetaFuente = (f: string) => FUENTES_LEAD.find(x => x.value === f)?.title || f
const etiquetaCanal = (c: string) => CANALES_ACTIVIDAD.find(x => x.value === c)?.title || c
const iniciales = (email: string) => {
  const c = colaboradores.value.find(x => String(x.email).toLowerCase() === String(email).toLowerCase())
  const base = c?.nombre || email
  return base.split(/[\s@.]+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('')
}

const leadsFiltrados = computed(() => {
  let lista = leads.value
  if (soloAbiertos.value) lista = lista.filter(l => !l.resultado && !esCerrada(l.stage_id))
  if (fFuente.value !== 'todas') lista = lista.filter(l => l.fuente === fFuente.value)
  if (fOwner.value !== 'todos') lista = lista.filter(l => l.owner_email === fOwner.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(l => [l.nombre, l.telefono, l.email, l.empresa]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const porEtapa = (id: any) => leadsFiltrados.value.filter(l => l.stage_id === id)
const montoEtapa = (id: any) => porEtapa(id).reduce((s, l) => s + Number(l.monto_cotizado || 0), 0)

const leadsAbiertos = computed(() => leads.value.filter(l => !l.resultado && !esCerrada(l.stage_id)))
const leadsDelMes = computed(() => leads.value.filter(l => String(l.fecha_ingreso || '').slice(0, 7) === periodo))
const ganadosMes = computed(() => leadsDelMes.value.filter(l => l.resultado === 'ganado' || esGanado(l.stage_id)))
const conversionMes = computed(() => leadsDelMes.value.length
  ? Math.round(ganadosMes.value.length / leadsDelMes.value.length * 1000) / 10 : 0)
const montoPipeline = computed(() => leadsAbiertos.value.reduce((s, l) => s + Number(l.monto_cotizado || 0), 0))

const ultimoContacto = (l: any) => {
  const v = l.ultima_interaccion || l.fecha_ingreso
  return v ? fechaCorta(v) : '—'
}
/** Sin interacción hace más de 3 días: el seguimiento debe ser diario o interdiario. */
const sinSeguimiento = (l: any) => {
  if (l.resultado || esCerrada(l.stage_id)) return false
  const v = l.ultima_interaccion || l.fecha_ingreso
  if (!v) return true
  return (Date.now() - new Date(v).getTime()) / 86400000 > 3
}

const headers = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Etapa', key: 'stage_id' },
  { title: 'Fuente', key: 'fuente' },
  { title: 'Teléfono', key: 'telefono' },
  { title: 'Cotizado', key: 'monto_cotizado' },
  { title: 'Responsable', key: 'owner_email' },
  { title: 'Último contacto', key: 'ultima_interaccion' },
  { title: 'Ingreso', key: 'fecha_ingreso' },
]

/* ══════════ Kanban drag & drop ══════════ */
const arrastrando = ref<any>(null)

async function soltarEn(etapa: any) {
  const lead = arrastrando.value
  arrastrando.value = null
  if (!lead || !puedeEditar.value || lead.stage_id === etapa.id) return

  const anterior = lead.stage_id
  const patch: Record<string, any> = { stage_id: etapa.id, updated_at: new Date().toISOString() }
  if (etapa.es_ganado) { patch.resultado = 'ganado'; patch.fecha_cierre = new Date().toISOString() }
  else if (etapa.es_perdido) { patch.resultado = 'perdido'; patch.fecha_cierre = new Date().toISOString() }
  else { patch.resultado = null; patch.fecha_cierre = null }

  const { error } = await client.from('piola_leads').update(patch).eq('id', lead.id)
  if (error) return emit('notify', { text: `No se pudo mover el lead: ${error.message}`, color: 'error' })

  await client.from('piola_lead_activities').insert({
    lead_id: lead.id, user_email: props.perfil?.email, canal: 'nota',
    nota: `Movido de "${nombreEtapa(anterior)}" a "${etapa.nombre}"`,
    stage_anterior: anterior, stage_nuevo: etapa.id,
  })

  Object.assign(lead, patch)
  emit('notify', `Lead movido a "${etapa.nombre}"`)
}

/* ══════════ Detalle / edición ══════════ */
const detalle = ref<any>(null)
const actividades = ref<any[]>([])
const guardando = ref(false)
const convirtiendo = ref(false)
const guardandoActividad = ref(false)
const nuevaActividad = ref<any>({ canal: 'whatsapp', nota: '', proxima_accion: '' })

function abrirNuevo() {
  detalle.value = {
    nombre: '', telefono: '', email: '', empresa: '',
    fuente: 'meta_ads', stage_id: etapasActivas.value[0]?.id || null,
    monto_cotizado: 0, owner_email: props.perfil?.email || null, servicios: [], notas: '',
  }
  actividades.value = []
}

async function abrirDetalle(lead: any) {
  detalle.value = { ...lead, servicios: lead.servicios || [] }
  nuevaActividad.value = { canal: 'whatsapp', nota: '', proxima_accion: '' }
  const { data } = await client.from('piola_lead_activities').select('*')
    .eq('lead_id', lead.id).order('created_at', { ascending: false })
  actividades.value = (data as any[]) || []
}

function cerrarDetalle() { detalle.value = null; actividades.value = [] }

async function guardarLead() {
  const d = detalle.value
  if (!d?.nombre?.trim()) return emit('notify', { text: 'El lead necesita un nombre', color: 'error' })

  guardando.value = true
  const fila: Record<string, any> = {
    nombre: d.nombre.trim(),
    telefono: d.telefono || null,
    email: d.email || null,
    empresa: d.empresa || null,
    fuente: d.fuente,
    stage_id: d.stage_id,
    owner_email: d.owner_email || null,
    monto_cotizado: Number(d.monto_cotizado || 0),
    servicios: d.servicios || [],
    notas: d.notas || null,
    proxima_accion: d.proxima_accion || null,
    updated_at: new Date().toISOString(),
  }
  if (esGanado(d.stage_id)) { fila.resultado = 'ganado'; fila.fecha_cierre = d.fecha_cierre || new Date().toISOString() }

  const res = d.id
    ? await client.from('piola_leads').update(fila).eq('id', d.id).select('*').single()
    : await client.from('piola_leads').insert(fila).select('*').single()

  guardando.value = false
  if (res.error) return emit('notify', { text: `Error guardando: ${res.error.message}`, color: 'error' })

  emit('notify', d.id ? 'Lead actualizado' : 'Lead creado')
  cerrarDetalle()
  await cargar()
}

async function eliminarLead() {
  if (!confirm(`¿Eliminar el lead "${detalle.value.nombre}"? Se borra también su historial.`)) return
  const { error } = await client.from('piola_leads').delete().eq('id', detalle.value.id)
  if (error) return emit('notify', { text: `Error eliminando: ${error.message}`, color: 'error' })
  emit('notify', 'Lead eliminado')
  cerrarDetalle()
  await cargar()
}

async function registrarActividad() {
  const a = nuevaActividad.value
  if (!a.nota?.trim()) return emit('notify', { text: 'Escribe qué pasó en la interacción', color: 'error' })

  guardandoActividad.value = true
  const ahora = new Date().toISOString()
  const { error } = await client.from('piola_lead_activities').insert({
    lead_id: detalle.value.id,
    user_email: props.perfil?.email,
    canal: a.canal,
    nota: a.nota.trim(),
    proxima_accion: a.proxima_accion || null,
  })

  if (!error) {
    await client.from('piola_leads').update({
      ultima_interaccion: ahora,
      proxima_accion: a.proxima_accion || detalle.value.proxima_accion || null,
    }).eq('id', detalle.value.id)

    detalle.value.ultima_interaccion = ahora
    const enLista = leads.value.find(l => l.id === detalle.value.id)
    if (enLista) enLista.ultima_interaccion = ahora

    const { data } = await client.from('piola_lead_activities').select('*')
      .eq('lead_id', detalle.value.id).order('created_at', { ascending: false })
    actividades.value = (data as any[]) || []
    nuevaActividad.value = { canal: 'whatsapp', nota: '', proxima_accion: '' }
    emit('notify', 'Interacción registrada')
  } else {
    emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  }
  guardandoActividad.value = false
}

/* ══════════ Conversión a cliente (§3) ══════════ */
async function convertirEnCliente() {
  convirtiendo.value = true
  const d = detalle.value

  const { data: cliente, error } = await client.from('piola_clientes').insert({
    nombre: d.empresa || d.nombre,
    contacto: d.nombre,
    email: d.email || null,
    telefono: d.telefono || null,
    lead_id: d.id,
    compromiso_mensual: 0,
  }).select('*').single()

  if (error) {
    convirtiendo.value = false
    return emit('notify', { text: `No se pudo crear el cliente: ${error.message}`, color: 'error' })
  }

  await client.from('piola_leads').update({
    cliente_id: (cliente as any).id,
    resultado: 'ganado',
    fecha_cierre: d.fecha_cierre || new Date().toISOString(),
  }).eq('id', d.id)

  d.cliente_id = (cliente as any).id
  convirtiendo.value = false
  emit('notify', `"${(cliente as any).nombre}" ya es cliente: aparece en Producción y Facturación`)
  await cargar()
}

onMounted(cargar)
</script>

<style scoped>
.vista-switch { display: flex; gap: 4px; }
.vista-switch .tab { display: flex; align-items: center; gap: 5px; }

.filtros-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 18px;
}
.filtros-bar .filtro { flex: 1 1 170px; min-width: 150px; max-width: 240px; }
.filtros-bar .filtro-buscar { flex: 2 1 260px; max-width: 380px; }

/* ── Kanban ── */
.kanban {
  display: flex; gap: 14px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start;
}
.kanban-col {
  flex: 0 0 258px; background: var(--card-bg, rgba(128, 128, 128, .06));
  border: 1px solid rgba(128, 128, 128, .18); border-radius: 12px; padding: 12px;
}
.kanban-head {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 3px solid; padding-top: 9px; margin: -12px -12px 0; padding-left: 12px; padding-right: 12px;
  border-top-left-radius: 12px; border-top-right-radius: 12px;
}
.kanban-nombre { font-weight: 600; font-size: 13px; }
.kanban-count {
  background: rgba(128, 128, 128, .2); border-radius: 999px; padding: 1px 8px; font-size: 11.5px; font-weight: 600;
}
.kanban-monto { font-size: 11.5px; opacity: .6; margin: 4px 0 10px; }
.kanban-body { display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
.kanban-vacio { font-size: 12px; opacity: .4; text-align: center; padding: 18px 0; }

.lead-card {
  background: var(--bg, #fff); border: 1px solid rgba(128, 128, 128, .2); border-radius: 9px;
  padding: 10px 11px; cursor: pointer; transition: transform .12s, box-shadow .12s;
}
.lead-card:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0, 0, 0, .1); }
.lead-nombre { font-weight: 600; font-size: 13px; margin-bottom: 5px; }
.lead-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; opacity: .75; }
.lead-fuente { opacity: .8; }
.lead-pie {
  display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
  padding-top: 7px; border-top: 1px dashed rgba(128, 128, 128, .25);
}
.lead-seguimiento { font-size: 11px; opacity: .6; display: flex; align-items: center; gap: 3px; }
.lead-seguimiento.alerta { color: #e2564a; opacity: 1; font-weight: 600; }
.lead-owner {
  background: rgba(128, 128, 128, .2); border-radius: 50%; width: 21px; height: 21px;
  display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700;
}

.etapa-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 600; white-space: nowrap;
}
.texto-alerta { color: #e2564a; font-weight: 600; }

/* ── Formularios ── */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid-actividad { display: grid; grid-template-columns: 1fr 1fr 2fr auto; gap: 10px; align-items: center; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

/* ── Timeline de interacciones ── */
.timeline { border-left: 2px solid rgba(128, 128, 128, .2); padding-left: 16px; margin-left: 6px; }
.timeline-item { position: relative; padding-bottom: 14px; }
.timeline-punto {
  position: absolute; left: -22px; top: 5px; width: 9px; height: 9px;
  border-radius: 50%; background: #e2564a;
}
.timeline-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
.timeline-head span { opacity: .55; }
.timeline-nota { font-size: 13px; line-height: 1.45; }
.timeline-prox { font-size: 11.5px; opacity: .7; margin-top: 3px; }
.timeline-user { font-size: 10.5px; opacity: .45; margin-top: 2px; }
.timeline-vacio { font-size: 12.5px; opacity: .5; padding: 6px 0; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid-actividad { grid-template-columns: 1fr; }
  .kanban-col { flex: 0 0 230px; }
}
</style>
