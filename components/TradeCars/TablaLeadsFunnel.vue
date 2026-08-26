<!--
  Trade Cars — Módulo 2: Tabla de Leads
  -------------------------------------
  El detalle que hay detrás de cada número del embudo.

  ETAPA y FECHA DEL FUNNEL son columnas calculadas (no vienen del CRM): salen de
  utils/tradecarsFunnel.ts, las mismas funciones que alimentan el embudo, así que
  la tabla y el funnel nunca pueden contradecirse.

  Un click en la fila abre la conversación en Chatwoot cuando el lead trae
  conversation_id; si no lo trae, abre el detalle interno.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Tabla de Leads</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" @click="$emit('nuevo')">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo lead</span>
        </button>
        <button class="btn-primary" @click="exportarExcel">
          <v-icon icon="mdi-microsoft-excel" size="16" /><span>Exportar</span>
        </button>
        <button class="btn-primary" @click="$emit('refresh')">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">

      <!-- ══════════ FILTROS ══════════ -->
      <div class="filtros-bar">
        <v-select v-model="fMes" :items="opcionesMes" item-title="label" item-value="value"
          label="Mes" density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fAsesor" :items="opcionesAsesor"
          label="Asesor" density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fCanal" :items="opcionesCanal"
          label="Canal" density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fPerfil" :items="['todos', 'SI', 'NO']"
          label="Perfil coincide" density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fEtapa" :items="opcionesEtapa"
          label="Etapa" density="compact" hide-details variant="outlined" class="filtro" />
        <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify" placeholder="Buscar nombre o teléfono…"
          density="compact" hide-details variant="outlined" class="filtro-buscar" clearable />
        <v-btn v-if="hayFiltros" variant="text" size="small" prepend-icon="mdi-filter-off"
          @click="limpiarFiltros">Limpiar</v-btn>
      </div>

      <!-- ══════════ TABLA ══════════ -->
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">
            {{ leadsFiltrados.length }} lead(s)
            <span v-if="leadsFiltrados.length !== leads.length" class="text-medium-emphasis">
              de {{ leads.length }}
            </span>
          </span>
          <v-spacer />
          <v-chip v-if="conProblemas" size="small" color="error" variant="tonal" prepend-icon="mdi-alert">
            {{ conProblemas }} con datos por corregir
          </v-chip>
        </v-card-title>

        <v-data-table
          :headers="headers"
          :items="filasOrdenadas"
          :loading="loading"
          class="elevation-0 tabla-leads"
          no-data-text="No hay leads que cumplan estos filtros"
          :items-per-page="25"
          :sort-by="[{ key: 'fecha_funnel', order: 'desc' }]"
        >
          <!-- Nombre + acceso al CRM -->
          <template #item.contacto_nombre="{ item }">
            <div class="celda-nombre" @click="abrirLead(item)">
              <strong>{{ item.contacto_nombre || '—' }}</strong>
              <v-icon v-if="item.chatwoot_conversation_id" icon="mdi-open-in-new" size="12"
                class="icono-crm" />
            </div>
          </template>

          <template #item.contacto_telefono="{ item }">
            <span class="mono">{{ item.contacto_telefono || '—' }}</span>
          </template>

          <template #item.canal_origen="{ item }">
            <v-chip v-if="item.canal_origen" size="x-small" variant="tonal" :color="colorCanal(item.canal_origen)">
              {{ item.canal_origen }}
            </v-chip>
            <span v-else>—</span>
          </template>

          <template #item.asesor="{ item }">{{ item.asesor || '—' }}</template>

          <template #item.perfil_coincide="{ item }">
            <v-chip size="x-small" variant="flat"
              :color="tcPerfilCoincide(item.perfil_coincide) ? 'success' : 'grey'">
              {{ tcPerfilCoincide(item.perfil_coincide) ? 'SI' : 'NO' }}
            </v-chip>
          </template>

          <!-- STATUS: si el CRM mandó algo fuera de la lista, se marca en rojo -->
          <template #item.status="{ item }">
            <v-tooltip v-if="tcStatusEsInvalido(item.status)" location="top">
              <template #activator="{ props }">
                <v-chip v-bind="props" size="small" color="error" variant="flat" prepend-icon="mdi-alert-octagon">
                  {{ item.status }}
                </v-chip>
              </template>
              <span>Valor no permitido. Debe ser uno de: {{ TC_STATUS.join(', ') }}</span>
            </v-tooltip>

            <v-chip v-else-if="item.status" size="small" variant="tonal" :color="colorStatus(item.status)">
              {{ item.status }}
            </v-chip>

            <v-tooltip v-else-if="tcPerfilCoincide(item.perfil_coincide)" location="top">
              <template #activator="{ props }">
                <v-chip v-bind="props" size="small" color="warning" variant="tonal" prepend-icon="mdi-help-circle">
                  Sin status
                </v-chip>
              </template>
              <span>Perfil coincide = SI pero sin status: no entra al funnel</span>
            </v-tooltip>

            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <!-- Calculadas por el dashboard -->
          <template #item.etapa="{ item }">
            <div v-if="item._etapa" class="d-flex align-center" style="gap:6px;">
              <span class="punto-etapa" :style="{ background: colorEtapa(item._etapa) }" />
              <span>{{ item._etapa }}</span>
            </div>
            <span v-else class="text-medium-emphasis fst-italic">fuera del funnel</span>
          </template>

          <template #item.fecha_funnel="{ item }">
            <div class="celda-fecha">
              <span>{{ fmt(item._fechaFunnel) }}</span>
              <span class="origen-fecha">{{ item._origenFecha }}</span>
            </div>
          </template>

          <template #item.fecha_derivacion="{ item }">{{ fmt(item.fecha_derivacion) }}</template>
          <template #item.fecha_cita="{ item }">{{ fmt(item.fecha_cita) }}</template>
          <template #item.fecha_compra="{ item }">
            <strong v-if="item.fecha_compra" style="color:#16a34a;">{{ fmt(item.fecha_compra) }}</strong>
            <span v-else>—</span>
          </template>

          <template #item.acciones="{ item }">
            <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="$emit('editar', item)" />
          </template>
        </v-data-table>
      </v-card>

    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  leads: any[]
  asesores?: string[]
  loading?: boolean
  chatwootAccountId?: number
}>()
defineEmits<{ refresh: [], editar: [lead: any], nuevo: [] }>()

/* ---------------- Filtros (se recuerdan entre recargas) ---------------- */
const fMes    = usePersistente('tradecars:tabla:mes', 'todos')
const fAsesor = usePersistente('tradecars:tabla:asesor', 'todos')
const fCanal  = usePersistente('tradecars:tabla:canal', 'todos')
const fPerfil = usePersistente('tradecars:tabla:perfil', 'todos')
const fEtapa  = usePersistente('tradecars:tabla:etapa', 'todos')
const fBuscar = ref('')

const filtros = computed<TcFiltros>(() => ({
  mes: fMes.value,
  asesor: fAsesor.value,
  canal: fCanal.value,
  perfil: fPerfil.value,
  etapa: fEtapa.value,
  buscar: fBuscar.value || '',
}))

const hayFiltros = computed(() =>
  fMes.value !== 'todos' || fAsesor.value !== 'todos' || fCanal.value !== 'todos'
  || fPerfil.value !== 'todos' || fEtapa.value !== 'todos' || !!fBuscar.value)

function limpiarFiltros() {
  fMes.value = 'todos'; fAsesor.value = 'todos'; fCanal.value = 'todos'
  fPerfil.value = 'todos'; fEtapa.value = 'todos'; fBuscar.value = ''
}

/* ---------------- Opciones ---------------- */
const opcionesMes = computed(() => {
  const meses = new Set<string>()
  for (const l of props.leads) { const m = tcMesFunnel(l); if (m) meses.add(m) }
  return [
    { label: 'Todos los meses', value: 'todos' },
    ...[...meses].sort().reverse().map(m => ({ label: nombreMes(m), value: m })),
  ]
})
function nombreMes(m: string) {
  const [y, mm] = m.split('-')
  const n = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${n[Number(mm) - 1]} ${y}`
}
const opcionesAsesor = computed(() => {
  const s = new Set<string>(props.asesores || [])
  for (const l of props.leads) if (l.asesor) s.add(l.asesor)
  return ['todos', ...[...s].sort()]
})
const opcionesCanal = computed(() => {
  const s = new Set<string>(TC_CANALES as unknown as string[])
  for (const l of props.leads) if (l.canal_origen) s.add(l.canal_origen)
  return ['todos', ...[...s].sort()]
})
const opcionesEtapa = computed(() => ['todos', ...TC_ETAPAS])

/* ---------------- Datos ---------------- */
const leadsFiltrados = computed(() => tcFiltrar(props.leads, filtros.value))

/**
 * Se precalculan etapa y fecha del funnel una sola vez por fila para no
 * recalcularlas en cada render de la tabla, y para poder ordenar por ellas.
 */
const filasOrdenadas = computed(() =>
  leadsFiltrados.value.map(l => ({
    ...l,
    _etapa: tcEtapa(l),
    _fechaFunnel: tcFechaFunnel(l),
    _origenFecha: l.fecha_compra ? 'compra' : l.fecha_cita ? 'cita' : l.fecha_derivacion ? 'derivación' : '',
  })),
)

const conProblemas = computed(() =>
  leadsFiltrados.value.filter(l =>
    tcStatusEsInvalido(l.status)
    || (tcPerfilCoincide(l.perfil_coincide) && !String(l.status ?? '').trim()),
  ).length)

/* ---------------- Presentación ---------------- */
const headers = [
  { title: 'Cliente', key: 'contacto_nombre' },
  { title: 'Teléfono', key: 'contacto_telefono' },
  { title: 'Canal', key: 'canal_origen' },
  { title: 'Asesor', key: 'asesor' },
  { title: 'Perfil', key: 'perfil_coincide', align: 'center' as const },
  { title: 'Status', key: 'status' },
  { title: 'Etapa', key: 'etapa', value: '_etapa' },
  { title: 'Fecha funnel', key: 'fecha_funnel', value: '_fechaFunnel' },
  { title: 'Derivación', key: 'fecha_derivacion' },
  { title: 'Cita', key: 'fecha_cita' },
  { title: 'Compra', key: 'fecha_compra' },
  { title: '', key: 'acciones', sortable: false, align: 'end' as const },
]

const COLORES_ETAPA = ['#f5b301', '#f0a202', '#e89005', '#d97706', '#b45309', '#3f8f4a', '#16a34a']
const colorEtapa = (e: string) => COLORES_ETAPA[TC_ETAPAS.indexOf(e as any)] || '#94a3b8'

function colorStatus(s: string) {
  const m: Record<string, string> = {
    'NO CONTACTADO': 'grey',
    'NO INTERESADO': 'error',
    'EN SEGUIMIENTO': 'info',
    'CITA': 'warning',
    'CITA ASISTIDA': 'purple',
    'CONCRETADA': 'success',
  }
  return m[tcNormalizar(s)] || 'grey'
}
function colorCanal(c: string) {
  const m: Record<string, string> = {
    whatsapp: 'green', instagram: 'purple', tiktok: 'grey-darken-3', facebook: 'blue',
  }
  return m[String(c).toLowerCase()] || 'grey'
}

function fmt(v: any) {
  const f = tcFecha(v)
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

/* ---------------- Ir al CRM ---------------- */
function abrirLead(lead: any) {
  const cuenta = lead.chatwoot_account_id || props.chatwootAccountId
  if (lead.chatwoot_conversation_id && cuenta) {
    window.open(
      `https://chats.alef.company/app/accounts/${cuenta}/conversations/${lead.chatwoot_conversation_id}`,
      '_blank',
    )
  }
}

/* ---------------- Export ---------------- */
function exportarExcel() {
  const cols = [
    ['Cliente', (l: any) => l.contacto_nombre],
    ['Telefono', (l: any) => l.contacto_telefono],
    ['Canal', (l: any) => l.canal_origen],
    ['Asesor', (l: any) => l.asesor],
    ['Perfil coincide', (l: any) => (tcPerfilCoincide(l.perfil_coincide) ? 'SI' : 'NO')],
    ['Status', (l: any) => l.status],
    ['Etapa', (l: any) => l._etapa || 'FUERA DEL FUNNEL'],
    ['Fecha funnel', (l: any) => l._fechaFunnel],
    ['Origen de la fecha', (l: any) => l._origenFecha],
    ['Fecha derivacion', (l: any) => tcFecha(l.fecha_derivacion)],
    ['Fecha cita', (l: any) => tcFecha(l.fecha_cita)],
    ['Fecha compra', (l: any) => tcFecha(l.fecha_compra)],
    ['Motivo no cita', (l: any) => l.motivo_no_cita],
    ['Fecha probable venta', (l: any) => tcFecha(l.fecha_probable_venta)],
    ['Proxima accion', (l: any) => l.proxima_accion],
    ['Fecha seguimiento', (l: any) => tcFecha(l.fecha_seguimiento)],
  ] as [string, (l: any) => any][]

  const filas = [
    cols.map(c => c[0]),
    ...filasOrdenadas.value.map(l => cols.map(c => c[1](l) ?? '')),
  ]
  const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-tradecars-${tcHoyLima()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.filtros-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.filtros-bar .filtro { min-width: 150px; max-width: 190px; flex: 0 1 165px; }
.filtros-bar .filtro-buscar { min-width: 220px; flex: 1 1 240px; max-width: 320px; }
@media (max-width: 640px) {
  .filtros-bar .filtro,
  .filtros-bar .filtro-buscar { max-width: none; flex: 1 1 100%; }
}

.celda-nombre {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.celda-nombre:hover { color: var(--primary); }
.icono-crm { opacity: 0.45; }
.celda-nombre:hover .icono-crm { opacity: 1; }

.celda-fecha { display: flex; flex-direction: column; line-height: 1.2; }
.origen-fecha {
  font-size: 0.62rem;
  color: var(--muted-foreground);
  text-transform: lowercase;
}

.punto-etapa {
  width: 9px; height: 9px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.mono { font-variant-numeric: tabular-nums; font-size: 0.84rem; }
.fst-italic { font-style: italic; font-size: 0.78rem; }

.tabla-leads :deep(td) { white-space: nowrap; }
</style>
