<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Dashboard</h1>
      <button class="btn-primary" @click="cargar">
        <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
      </button>
    </header>

    <div class="content-area">
      <div class="saludo">
        <h2>Hola, {{ primerNombre }} 👋</h2>
        <p>{{ fechaLarga }}</p>
      </div>

      <!-- ══════════ WIDGETS PERSONALES (§7.3) ══════════ -->
      <div class="mis-widgets">
        <div class="mini-widget" @click="emit('ir', 'mi_espacio')">
          <v-icon icon="mdi-beach" size="20" />
          <div>
            <strong v-if="w.vacaciones?.aplica">Te quedan {{ w.vacaciones.dias_disponibles }} días de vacaciones</strong>
            <strong v-else>Sin vacaciones asignadas</strong>
            <span v-if="w.vacaciones?.aplica">{{ w.vacaciones.dias_devengados }} devengados · {{ w.vacaciones.dias_tomados }} tomados</span>
            <span v-else>Aplica solo a colaboradores en planilla</span>
          </div>
        </div>
        <div class="mini-widget" @click="emit('ir', 'mi_espacio')">
          <v-icon icon="mdi-cake-variant" size="20" />
          <div>
            <strong>Llevas {{ antiguedadTexto }} en Piola</strong>
            <span>Desde {{ fechaCorta(perfil?.colaborador?.fecha_ingreso) }}</span>
          </div>
        </div>
        <div class="mini-widget" @click="emit('ir', 'mi_espacio')">
          <v-icon icon="mdi-file-sign" size="20" />
          <div>
            <strong v-if="w.dias_para_renovacion !== null && w.dias_para_renovacion !== undefined">
              Quedan {{ w.dias_para_renovacion }} días para renovar tu contrato
            </strong>
            <strong v-else>Contrato sin fecha de fin</strong>
            <span>{{ w.fecha_fin_contrato ? 'Vence el ' + fechaCorta(w.fecha_fin_contrato) : 'Nada por renovar' }}</span>
          </div>
        </div>
        <div class="mini-widget" @click="emit('ir', 'mi_espacio')">
          <v-icon icon="mdi-calendar-check" size="20" />
          <div>
            <strong>{{ w.dias_trabajados_mes || 0 }} días trabajados este mes</strong>
            <span>{{ w.horas_trabajadas_mes || 0 }} horas acumuladas</span>
          </div>
        </div>
      </div>

      <!-- ══════════ KPIs DE NEGOCIO ══════════ -->
      <div v-if="veAlgo" class="stats-grid">
        <div v-if="ve('crm')" class="stat-card clickeable" @click="emit('ir', 'crm')">
          <div class="stat-header">
            <span class="stat-title">Leads del mes</span>
            <div class="stat-change up">{{ ganadosMes }} ganados</div>
          </div>
          <div class="stat-value">{{ leadsMes.length }}</div>
          <div class="stat-description">{{ leadsAbiertos }} activos en el pipeline</div>
        </div>
        <div v-if="ve('contabilidad')" class="stat-card clickeable" @click="emit('ir', 'contabilidad')">
          <div class="stat-header"><span class="stat-title">Flujo de caja del mes</span></div>
          <div class="stat-value" :style="{ color: flujo >= 0 ? '#2e9e5b' : '#e2564a' }">
            {{ PEN_CORTO(flujo) }}
          </div>
          <div class="stat-description">{{ PEN_CORTO(ingresos) }} in · {{ PEN_CORTO(egresos) }} out</div>
        </div>
        <div v-if="ve('facturacion')" class="stat-card clickeable" @click="emit('ir', 'facturacion')">
          <div class="stat-header">
            <span class="stat-title">Por cobrar</span>
            <div v-if="facturasVencidas" class="stat-change down">{{ facturasVencidas }} vencidas</div>
          </div>
          <div class="stat-value">{{ PEN_CORTO(porCobrar) }}</div>
          <div class="stat-description">{{ facturasPendientes }} comprobante(s) sin pagar</div>
        </div>
        <div v-if="ve('produccion')" class="stat-card clickeable" @click="emit('ir', 'produccion')">
          <div class="stat-header"><span class="stat-title">Entregables del mes</span></div>
          <div class="stat-value">{{ entregados }}/{{ comprometidos || '—' }}</div>
          <div class="stat-description">Entregados vs. comprometidos con las marcas</div>
        </div>
      </div>

      <!-- ══════════ GRÁFICO ══════════ -->
      <div v-if="ve('contabilidad') || ve('crm')" class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>{{ ve('contabilidad') ? 'Ingresos y egresos' : 'Leads por mes' }}</h2>
            <div class="chart-subtitle">Últimos 6 meses</div>
          </div>
        </div>
        <div class="chart-area">
          <client-only>
            <apexchart type="area" height="290" :options="opcionesChart" :series="seriesChart" />
          </client-only>
        </div>
      </div>

      <!-- ══════════ PENDIENTES ══════════ -->
      <div class="two-column-grid">
        <v-card v-if="ve('crm')" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Leads que necesitan seguimiento</span>
          </v-card-title>
          <v-list density="compact" class="lista-pendientes">
            <v-list-item v-for="l in leadsSinSeguimiento" :key="l.id" @click="emit('ir', 'crm')">
              <template #prepend><v-icon icon="mdi-alert-circle" color="warning" size="18" /></template>
              <v-list-item-title>{{ l.nombre }}</v-list-item-title>
              <v-list-item-subtitle>
                Último contacto: {{ fechaCorta(l.ultima_interaccion || l.fecha_ingreso) }}
                <span v-if="l.owner_email"> · {{ l.owner_email }}</span>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="!leadsSinSeguimiento.length">
              <v-list-item-title style="opacity:.5; font-size:13px;">
                Todo el pipeline está al día 🎉
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Alertas recientes</span>
          </v-card-title>
          <v-list density="compact" class="lista-pendientes">
            <v-list-item v-for="a in alertas" :key="a.id">
              <template #prepend>
                <v-icon :icon="a.estado === 'enviada' ? 'mdi-whatsapp' : 'mdi-bell-outline'"
                  :color="a.estado === 'error' ? 'error' : 'primary'" size="18" />
              </template>
              <v-list-item-title>{{ a.titulo }}</v-list-item-title>
              <v-list-item-subtitle>{{ fechaCorta(a.fecha_objetivo) }} · {{ a.estado }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="!alertas.length">
              <v-list-item-title style="opacity:.5; font-size:13px;">Sin alertas pendientes.</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Home del dashboard Piola.
 *
 * Mezcla dos cosas: los widgets PERSONALES que pidió Edson (§7.3 — vacaciones,
 * antigüedad, renovación de contrato, días trabajados) y los KPIs de negocio.
 * Cada KPI se pinta solo si el usuario tiene permiso sobre ese módulo, así que
 * un colaborador ve su información y nada más.
 */
import { ref, computed, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { piolaCan } from '@/utils/permissions'
import { PEN_CORTO, PEN, fechaCorta, periodoActual, ultimosPeriodos, hoyISO } from '@/composables/usePiola'
import type { ApexOptions } from 'apexcharts'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'ir', vista: string): void; (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

const periodo = periodoActual()
const w = computed(() => props.perfil?.widgets || {})
const ve = (modulo: string) => piolaCan(props.perfil?.permisos, modulo as any, 'view')
const veAlgo = computed(() => ['crm', 'contabilidad', 'facturacion', 'produccion'].some(ve))

const primerNombre = computed(() => {
  const n = props.perfil?.colaborador?.nombre || props.perfil?.email || ''
  return String(n).split(/[\s@.]/)[0] || 'equipo'
})
const fechaLarga = computed(() => new Date().toLocaleDateString('es-PE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}))

const antiguedadTexto = computed(() => {
  const dias = Number(w.value.antiguedad_dias || 0)
  if (!dias) return '—'
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios) return `${anios} año${anios > 1 ? 's' : ''} y ${meses} m`
  if (meses) return `${meses} mes${meses > 1 ? 'es' : ''}`
  return `${dias} días`
})

/* ══════════ Datos ══════════ */
const leads = ref<any[]>([])
const transacciones = ref<any[]>([])
const facturas = ref<any[]>([])
const entregables = ref<any[]>([])
const clientes = ref<any[]>([])
const alertas = ref<any[]>([])
const stagesCerrados = ref<number[]>([])

const meses = computed(() => [...ultimosPeriodos(6)].reverse())

async function cargar() {
  const desde = `${meses.value[0]}-01`
  const tareas: Promise<any>[] = []

  if (ve('crm')) {
    tareas.push(
      client.from('piola_leads').select('*').gte('fecha_ingreso', desde).limit(2000)
        .then(r => { leads.value = (r.data as any[]) || [] }),
      client.from('piola_lead_stages').select('id, es_ganado, es_perdido')
        .then(r => {
          stagesCerrados.value = ((r.data as any[]) || [])
            .filter(s => s.es_ganado || s.es_perdido).map(s => s.id)
        }),
    )
  }
  if (ve('contabilidad')) {
    tareas.push(client.from('piola_transactions').select('tipo, monto, fecha, proyectado')
      .gte('fecha', desde).limit(5000)
      .then(r => { transacciones.value = (r.data as any[]) || [] }))
  }
  if (ve('facturacion')) {
    tareas.push(client.from('piola_invoices')
      .select('id, total, neto_a_pagar, con_detraccion, estado, fecha_vencimiento').limit(1000)
      .then(r => { facturas.value = (r.data as any[]) || [] }))
  }
  if (ve('produccion')) {
    tareas.push(
      client.from('piola_deliverables').select('*').eq('periodo', periodo)
        .then(r => { entregables.value = (r.data as any[]) || [] }),
      client.from('piola_clientes').select('id, compromiso_mensual').eq('activo', true)
        .then(r => { clientes.value = (r.data as any[]) || [] }),
    )
  }

  tareas.push(
    client.from('piola_alerts').select('*').order('created_at', { ascending: false }).limit(8)
      .then(r => { alertas.value = (r.data as any[]) || [] })
      .then(() => {}, () => {}),
  )

  await Promise.all(tareas)
}

/* ══════════ Derivados ══════════ */
const leadsMes = computed(() => leads.value.filter(l => String(l.fecha_ingreso || '').slice(0, 7) === periodo))
const ganadosMes = computed(() => leadsMes.value.filter(l => l.resultado === 'ganado').length)
const leadsAbiertos = computed(() =>
  leads.value.filter(l => !l.resultado && !stagesCerrados.value.includes(l.stage_id)).length)

const leadsSinSeguimiento = computed(() => leads.value
  .filter(l => !l.resultado && !stagesCerrados.value.includes(l.stage_id))
  .filter(l => {
    const v = l.ultima_interaccion || l.fecha_ingreso
    return v && (Date.now() - new Date(v).getTime()) / 86400000 > 3
  })
  .sort((a, b) => String(a.ultima_interaccion || a.fecha_ingreso)
    .localeCompare(String(b.ultima_interaccion || b.fecha_ingreso)))
  .slice(0, 6))

const delMes = computed(() =>
  transacciones.value.filter(t => String(t.fecha).slice(0, 7) === periodo && !t.proyectado))
const ingresos = computed(() => delMes.value.filter(t => t.tipo === 'ingreso')
  .reduce((s, t) => s + Number(t.monto || 0), 0))
const egresos = computed(() => delMes.value.filter(t => t.tipo === 'egreso')
  .reduce((s, t) => s + Number(t.monto || 0), 0))
const flujo = computed(() => ingresos.value - egresos.value)

const pendientes = computed(() => facturas.value.filter(f => ['emitida', 'enviada', 'vencida'].includes(f.estado)))
const facturasPendientes = computed(() => pendientes.value.length)
const porCobrar = computed(() => pendientes.value
  .reduce((s, f) => s + Number(f.con_detraccion ? f.neto_a_pagar : f.total || 0), 0))
const facturasVencidas = computed(() => facturas.value.filter(f =>
  ['emitida', 'enviada'].includes(f.estado) && f.fecha_vencimiento
  && String(f.fecha_vencimiento).slice(0, 10) < hoyISO()).length)

const entregados = computed(() => entregables.value
  .filter(e => ['entregado', 'aprobado'].includes(e.estado))
  .reduce((s, e) => s + Number(e.cantidad || 1), 0))
const comprometidos = computed(() => clientes.value
  .reduce((s, c) => s + Number(c.compromiso_mensual || 0), 0))

/* ══════════ Gráfico ══════════ */
const seriesChart = computed(() => {
  if (ve('contabilidad')) {
    const porMes = (tipo: string) => meses.value.map(m => transacciones.value
      .filter(t => String(t.fecha).slice(0, 7) === m && t.tipo === tipo && !t.proyectado)
      .reduce((s, t) => s + Number(t.monto || 0), 0))
    return [{ name: 'Ingresos', data: porMes('ingreso') }, { name: 'Egresos', data: porMes('egreso') }]
  }
  return [{
    name: 'Leads',
    data: meses.value.map(m => leads.value.filter(l => String(l.fecha_ingreso || '').slice(0, 7) === m).length),
  }]
})

const opcionesChart = computed<ApexOptions>(() => ({
  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ve('contabilidad') ? ['#2e9e5b', '#e2564a'] : ['#5b8def'],
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.04 } },
  xaxis: { categories: meses.value.map(m => m.slice(2).split('-').reverse().join('/')) },
  yaxis: ve('contabilidad') ? { labels: { formatter: (v: number) => PEN_CORTO(v) } } : {},
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  tooltip: {
    theme: isDark.value ? 'dark' : 'light',
    y: ve('contabilidad') ? { formatter: (v: number) => PEN(v) } : undefined,
  },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
}))

onMounted(cargar)
</script>

<style scoped>
.saludo { margin-bottom: 20px; }
.saludo h2 { font-size: 21px; margin: 0 0 3px; }
.saludo p { font-size: 13px; opacity: .6; margin: 0; text-transform: capitalize; }

.mis-widgets {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
  gap: 12px; margin-bottom: 22px;
}
.mini-widget {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 12px;
  background: rgba(128, 128, 128, .04); cursor: pointer; transition: transform .12s, border-color .12s;
}
.mini-widget:hover { transform: translateY(-1px); border-color: rgba(226, 86, 74, .45); }
.mini-widget > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mini-widget strong { font-size: 13.5px; line-height: 1.35; }
.mini-widget span { font-size: 11.5px; opacity: .6; }

.stat-card.clickeable { cursor: pointer; }
.lista-pendientes { max-height: 320px; overflow-y: auto; }

@media (max-width: 800px) {
  .mis-widgets { grid-template-columns: 1fr; }
}
</style>
