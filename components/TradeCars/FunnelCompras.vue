<!--
  Trade Cars — Módulo 1: Funnel de Compras
  ----------------------------------------
  Reemplaza el embudo del Power BI (funnel tradecars 2.pbix).

  Las 7 barras son ACUMULATIVAS: cada una cuenta los leads que alcanzaron esa
  etapa o una superior, así que un lead CONCRETADA suma en las 7. El % de cada
  barra es contra la barra ANTERIOR, no contra el total.

  Toda la matemática vive en utils/tradecarsFunnel.ts (auto-import de Nuxt),
  compartida con los otros dos módulos para que nunca se desvíen entre sí.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Funnel de Compras</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" @click="exportarCsv">
          <v-icon icon="mdi-microsoft-excel" size="16" /><span>Exportar</span>
        </button>
        <button class="btn-primary" @click="$emit('refresh')">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">

      <!-- Aviso: datos que el CRM mandó mal y quedan fuera del funnel -->
      <v-alert v-if="conStatusInvalido.length" type="error" variant="tonal" density="compact"
        class="mb-4" icon="mdi-alert-octagon">
        <div class="d-flex align-center flex-wrap" style="gap:8px;">
          <strong>{{ conStatusInvalido.length }}</strong>
          lead(s) con un STATUS que no está en la lista permitida. No se cuentan en el
          embudo hasta corregirlos en el CRM.
          <v-chip v-for="s in statusInvalidosUnicos" :key="s" size="x-small" color="error" variant="flat">
            {{ s }}
          </v-chip>
        </div>
      </v-alert>

      <v-alert v-if="sinStatus.length" type="warning" variant="tonal" density="compact"
        class="mb-4" icon="mdi-help-circle">
        <div><strong>{{ sinStatus.length }}</strong>
        lead(s) con PERFIL COINCIDE = SI pero sin STATUS asignado. Quedan fuera del
        embudo hasta que el asesor los clasifique.</div>
        <div v-if="sinStatusPorAsesor.length" class="sin-status-asesores">
          <v-chip v-for="a in sinStatusPorAsesor" :key="a.asesor" size="x-small" variant="flat" color="warning">
            {{ a.asesor }}: {{ a.cantidad }}
          </v-chip>
        </div>
      </v-alert>

      <!-- ══════════ FILTROS ══════════ -->
      <div class="filtros-bar">
        <v-select v-model="fMes" :items="opcionesMes" item-title="label" item-value="value"
          label="Mes" density="compact" hide-details variant="outlined" class="filtro"
          :disabled="usaRango" />
        <v-text-field v-model="fDesde" type="date" label="Desde" density="compact" hide-details
          variant="outlined" class="filtro filtro-fecha" />
        <v-text-field v-model="fHasta" type="date" label="Hasta" density="compact" hide-details
          variant="outlined" class="filtro filtro-fecha" />
        <v-select v-model="fAsesor" :items="opcionesAsesor"
          label="Asesor" density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fCanal" :items="opcionesCanal"
          label="Canal de origen" density="compact" hide-details variant="outlined" class="filtro" />
        <v-btn v-if="hayFiltros" variant="text" size="small" prepend-icon="mdi-filter-off"
          @click="limpiarFiltros">Limpiar</v-btn>
      </div>

      <!-- ══════════ RESUMEN ══════════ -->
      <div class="stats-grid mini">
        <div class="stat-card">
          <div class="stat-title">Leads del período</div>
          <div class="stat-value">{{ barras[0]?.cantidad ?? 0 }}</div>
          <div class="stat-description">{{ etiquetaPeriodo }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Compras concretadas</div>
          <div class="stat-value" style="color:#16a34a;">{{ barras[6]?.cantidad ?? 0 }}</div>
          <div class="stat-description">Status CONCRETADA</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Conversión total</div>
          <div class="stat-value">{{ conversionTotal }}</div>
          <div class="stat-description">Compras sobre leads</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Citas asistidas</div>
          <div class="stat-value">{{ barras[5]?.cantidad ?? 0 }}</div>
          <div class="stat-description">de {{ barras[4]?.cantidad ?? 0 }} agendadas</div>
        </div>
      </div>

      <!-- ══════════ COSTOS DEL PERÍODO ══════════ -->
      <div class="chart-section costos-ref">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Costos del período</h2>
            <div class="chart-subtitle">
              Se actualiza solo con los mismos filtros de fecha de arriba — jala la
              inversión cargada en Procedencia y Costos.
            </div>
          </div>
        </div>
        <div v-if="costosPeriodo.total == null" class="bloque-vacio-costos">
          Todavía no hay inversión cargada para este período. Se carga desde
          Procedencia y Costos → «Cargar inversión».
        </div>
        <div v-else class="stats-grid mini">
          <div class="stat-card">
            <div class="stat-title">Costo total</div>
            <div class="stat-value">{{ fmtMoneda(costosPeriodo.total) }}</div>
            <div class="stat-description">Inversión del período</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Costo por lead</div>
            <div class="stat-value">{{ costosPeriodo.porLead != null ? fmtMoneda(costosPeriodo.porLead) : '—' }}</div>
            <div class="stat-description">Inversión / leads</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Inversión por compra</div>
            <div class="stat-value">{{ costosPeriodo.porCompra != null ? fmtMoneda(costosPeriodo.porCompra) : '—' }}</div>
            <div class="stat-description">Inversión / compras concretadas</div>
          </div>
        </div>
      </div>

      <!-- ══════════ EMBUDO ══════════ -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Embudo de conversión</h2>
            <div class="chart-subtitle">
              Cada barra incluye los leads que alcanzaron esa etapa o una superior.
              El porcentaje compara contra la etapa anterior.
            </div>
          </div>
        </div>

        <div v-if="!barras[0]?.cantidad" class="funnel-vacio">
          <v-icon icon="mdi-filter-variant-remove" size="40" />
          <p>No hay leads que cumplan estos filtros.</p>
        </div>

        <div v-else class="funnel-wrap">
          <div v-for="(b, i) in barras" :key="b.etapa" class="funnel-fila">
            <div class="funnel-etiqueta">
              <span class="funnel-nombre">{{ b.etapa }}</span>
              <span class="funnel-sub">{{ descripcionEtapa(b.etapa) }}</span>
            </div>

            <div class="funnel-pista">
              <div class="funnel-barra" :style="estiloBarra(b, i)">
                <span class="funnel-cantidad">{{ b.cantidad }}</span>
              </div>
            </div>

            <div class="funnel-conv">
              <template v-if="b.conversion !== null">
                <span :class="['funnel-pct', claseConversion(b.conversion)]">
                  {{ b.conversion.toFixed(1) }}%
                </span>
                <span class="funnel-conv-sub">vs {{ barras[i - 1].etapa }}</span>
              </template>
              <span v-else class="funnel-conv-sub">base</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ DETALLE ══════════ -->
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Detalle por etapa</span>
        </v-card-title>
        <v-data-table :headers="headersDetalle" :items="barras" class="elevation-0"
          :items-per-page="7" hide-default-footer>
          <template #item.etapa="{ item }">
            <div class="d-flex align-center" style="gap:8px;">
              <span class="punto-etapa" :style="{ background: colorEtapa(item.etapa) }" />
              <strong>{{ item.etapa }}</strong>
            </div>
          </template>
          <template #item.cantidad="{ item }">
            <strong>{{ item.cantidad }}</strong>
          </template>
          <template #item.conversion="{ item }">
            <v-chip v-if="item.conversion !== null" size="small" variant="tonal"
              :color="colorChipConversion(item.conversion)">
              {{ item.conversion.toFixed(1) }}%
            </v-chip>
            <span v-else class="text-medium-emphasis">—</span>
          </template>
          <template #item.sobreTotal="{ item }">
            <span v-if="item.sobreTotal !== null">{{ item.sobreTotal.toFixed(1) }}%</span>
            <span v-else>—</span>
          </template>
          <template #item.perdidos="{ item, index }">
            <span v-if="index === 0" class="text-medium-emphasis">—</span>
            <span v-else :class="{ 'text-error': (barras[index - 1].cantidad - item.cantidad) > 0 }">
              {{ barras[index - 1].cantidad - item.cantidad }}
            </span>
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
  /** Inversión por campaña (tradecars_campana_costos) para el cuadro de costos del período. */
  costos?: any[]
}>()
defineEmits<{ refresh: [] }>()

/* ---------------- Filtros ---------------- */
// usePersistente devuelve refs que ya se guardan solas en localStorage:
// se usan directo, sin duplicarlas en un reactive aparte.
const fMes    = usePersistente('tradecars:funnel:mes', tcHoyLima().slice(0, 7))
const fDesde  = usePersistente('tradecars:funnel:desde', '')
const fHasta  = usePersistente('tradecars:funnel:hasta', '')
const fAsesor = usePersistente('tradecars:funnel:asesor', 'todos')
const fCanal  = usePersistente('tradecars:funnel:canal', 'todos')

/** Con un rango de fechas puesto, el mes calendario se ignora — pedido explícito
 *  del cliente para poder cortar por semana o cualquier tramo, no solo por mes. */
const usaRango = computed(() => !!(fDesde.value || fHasta.value))

const filtros = computed<TcFiltros>(() => ({
  mes: fMes.value,
  fechaDesde: fDesde.value || undefined,
  fechaHasta: fHasta.value || undefined,
  asesor: fAsesor.value,
  canal: fCanal.value,
}))

const hayFiltros = computed(() =>
  fMes.value !== 'todos' || fAsesor.value !== 'todos' || fCanal.value !== 'todos'
  || !!fDesde.value || !!fHasta.value)

function limpiarFiltros() {
  fMes.value = 'todos'
  fDesde.value = ''
  fHasta.value = ''
  fAsesor.value = 'todos'
  fCanal.value = 'todos'
}

/** Meses presentes en los datos (según la fecha del funnel calculada). */
const opcionesMes = computed(() => {
  const meses = new Set<string>()
  for (const l of props.leads) {
    const m = tcMesFunnel(l)
    if (m) meses.add(m)
  }
  const ordenados = [...meses].sort().reverse()
  return [
    { label: 'Todos los meses', value: 'todos' },
    ...ordenados.map(m => ({ label: nombreMes(m), value: m })),
  ]
})

function nombreMes(m: string) {
  const [y, mm] = m.split('-')
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${nombres[Number(mm) - 1]} ${y}`
}

const opcionesAsesor = computed(() => {
  const set = new Set<string>(props.asesores || [])
  for (const l of props.leads) if (l.asesor) set.add(l.asesor)
  return ['todos', ...[...set].sort()]
})

const opcionesCanal = computed(() => {
  const set = new Set<string>(TC_CANALES as unknown as string[])
  for (const l of props.leads) if (l.canal_origen) set.add(l.canal_origen)
  return ['todos', ...[...set].sort()]
})

function fmtFechaCorta(f: string) {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

const etiquetaPeriodo = computed(() => {
  if (usaRango.value) {
    if (fDesde.value && fHasta.value) return `${fmtFechaCorta(fDesde.value)} — ${fmtFechaCorta(fHasta.value)}`
    if (fDesde.value) return `Desde ${fmtFechaCorta(fDesde.value)}`
    return `Hasta ${fmtFechaCorta(fHasta.value)}`
  }
  return fMes.value === 'todos' ? 'Histórico completo' : nombreMes(fMes.value)
})

/* ---------------- Cálculo ---------------- */
const leadsFiltrados = computed(() => tcFiltrar(props.leads, filtros.value))
const barras = computed(() => tcConstruirFunnel(leadsFiltrados.value))

/** Leads que el CRM mandó con un STATUS fuera de la lista cerrada. */
const conStatusInvalido = computed(() =>
  leadsFiltrados.value.filter(l => tcStatusEsInvalido(l.status)))

const statusInvalidosUnicos = computed(() =>
  [...new Set(conStatusInvalido.value.map(l => String(l.status)))].slice(0, 6))

/** PERFIL = SI pero sin STATUS: fuera del funnel hasta clasificarlos. */
const sinStatus = computed(() =>
  leadsFiltrados.value.filter(l =>
    tcPerfilCoincide(l.perfil_coincide) && !String(l.status ?? '').trim()))

/**
 * Desglose por asesor de los leads sin status — pedido en la reunión del
 * 26/08: que se pueda ver de un vistazo a quién le falta clasificar leads,
 * para poder hablarle antes del cierre semanal.
 */
const sinStatusPorAsesor = computed(() => {
  const mapa = new Map<string, number>()
  for (const l of sinStatus.value) {
    const nombre = l.asesor || 'Sin asesor'
    mapa.set(nombre, (mapa.get(nombre) || 0) + 1)
  }
  return [...mapa.entries()]
    .map(([asesor, cantidad]) => ({ asesor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
})

/**
 * Cuadro referencial de costos del período — pedido en la reunión del 26/08:
 * que al filtrar el funnel por fecha, también se actualice el costo total,
 * el costo por lead y la inversión por compra de ese mismo período.
 * Suma la inversión cargada en `tradecars_campana_costos` (Procedencia y
 * Costos) cuyo mes cae dentro del período filtrado — no se inventa ningún
 * número: si no hay inversión cargada, sale "—".
 */
const costosPeriodo = computed(() => {
  const costos = props.costos || []
  if (!costos.length) return { total: null as number | null, porLead: null as number | null, porCompra: null as number | null }

  const mesDesde = usaRango.value ? (fDesde.value || '0000-01') : (fMes.value !== 'todos' ? fMes.value : null)
  const mesHasta = usaRango.value ? (fHasta.value || '9999-12') : (fMes.value !== 'todos' ? fMes.value : null)

  const enPeriodo = costos.filter((c) => {
    if (c.tipo === 'ventas') return false
    const mes = String(c.mes || '').slice(0, 7)
    if (!mes) return false
    if (mesDesde && mes < mesDesde.slice(0, 7)) return false
    if (mesHasta && mes > mesHasta.slice(0, 7)) return false
    return true
  })

  if (!enPeriodo.length) return { total: null, porLead: null, porCompra: null }

  const total = enPeriodo.reduce((a, c) => a + Number(c.costo || 0), 0)
  const leadsCount = barras.value[0]?.cantidad ?? 0
  const comprasCount = barras.value[6]?.cantidad ?? 0

  return {
    total,
    porLead: leadsCount ? total / leadsCount : null,
    porCompra: comprasCount ? total / comprasCount : null,
  }
})

// Sin símbolo de moneda: la inversión se carga en USD o PEN según la campaña
// (igual que en Procedencia y Costos) y este cuadro suma ambas sin convertir.
function fmtMoneda(v: number) {
  return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const conversionTotal = computed(() => {
  const leads = barras.value[0]?.cantidad ?? 0
  const compras = barras.value[6]?.cantidad ?? 0
  return leads > 0 ? ((compras / leads) * 100).toFixed(1) + '%' : '—'
})

/* ---------------- Presentación ---------------- */
const DESCRIPCIONES: Record<string, string> = {
  'LEADS':           'Todos los leads del período',
  'CUMPLE POLITICA': 'Perfil coincide = SI',
  'CONTACTADO':      'Se logró contacto con el cliente',
  'INTERESADOS':     'En seguimiento o más avanzado',
  'CITAS AGENDADAS': 'Con cita programada',
  'CITAS ASISTIDAS': 'El cliente asistió a la cita',
  'COMPRAS':         'Compra concretada',
}
const descripcionEtapa = (e: string) => DESCRIPCIONES[e] || ''

// Degradado del ámbar de marca hacia el verde de "compra cerrada"
const COLORES = ['#f5b301', '#f0a202', '#e89005', '#d97706', '#b45309', '#3f8f4a', '#16a34a']
const colorEtapa = (etapa: string) => COLORES[TC_ETAPAS.indexOf(etapa as any)] || '#94a3b8'

function estiloBarra(b: any, i: number) {
  const max = barras.value[0]?.cantidad || 1
  // Mínimo 4% para que una barra con 1 lead siga siendo visible y clickeable
  const ancho = Math.max((b.cantidad / max) * 100, b.cantidad > 0 ? 4 : 0)
  return { width: ancho + '%', background: colorEtapa(b.etapa) }
}

function claseConversion(pct: number) {
  if (pct >= 70) return 'conv-alta'
  if (pct >= 40) return 'conv-media'
  return 'conv-baja'
}
function colorChipConversion(pct: number) {
  if (pct >= 70) return 'success'
  if (pct >= 40) return 'warning'
  return 'error'
}

const headersDetalle = [
  { title: 'Etapa', key: 'etapa', sortable: false },
  { title: 'Leads', key: 'cantidad', align: 'end' as const, sortable: false },
  { title: '% vs etapa anterior', key: 'conversion', align: 'end' as const, sortable: false },
  { title: '% del total', key: 'sobreTotal', align: 'end' as const, sortable: false },
  { title: 'Perdidos en el paso', key: 'perdidos', align: 'end' as const, sortable: false },
]

/* ---------------- Export ---------------- */
function exportarCsv() {
  const filas = [
    ['Etapa', 'Leads', '% vs etapa anterior', '% del total', 'Perdidos en el paso'],
    ...barras.value.map((b, i) => [
      b.etapa,
      String(b.cantidad),
      b.conversion !== null ? b.conversion.toFixed(1) + '%' : '',
      b.sobreTotal !== null ? b.sobreTotal.toFixed(1) + '%' : '',
      i === 0 ? '' : String(barras.value[i - 1].cantidad - b.cantidad),
    ]),
  ]
  const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const sufijo = usaRango.value
    ? `${fDesde.value || 'inicio'}_a_${fHasta.value || 'hoy'}`
    : (fMes.value === 'todos' ? 'historico' : fMes.value)
  a.download = `funnel-tradecars-${sufijo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
/* Barra de filtros: fila propia, envuelve limpio en pantallas chicas */
.filtros-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.filtros-bar .filtro {
  min-width: 190px;
  max-width: 240px;
  flex: 0 1 210px;
}
.filtros-bar .filtro-fecha {
  min-width: 150px;
  max-width: 170px;
  flex: 0 1 160px;
}
@media (max-width: 640px) {
  .filtros-bar .filtro,
  .filtros-bar .filtro-fecha { max-width: none; flex: 1 1 100%; }
}

.sin-status-asesores {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.costos-ref { margin-top: 4px; }
.bloque-vacio-costos {
  padding: 20px 4px;
  font-size: 0.82rem;
  color: var(--muted-foreground);
}

/* ── Embudo ── */
.funnel-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 4px 4px;
}
.funnel-fila {
  display: grid;
  grid-template-columns: 190px 1fr 120px;
  align-items: center;
  gap: 14px;
}
.funnel-etiqueta { display: flex; flex-direction: column; line-height: 1.25; }
.funnel-nombre {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: 0.01em;
}
.funnel-sub {
  font-size: 0.68rem;
  color: var(--muted-foreground);
}

.funnel-pista {
  background: var(--muted);
  border-radius: 6px;
  height: 40px;
  overflow: hidden;
  display: flex;
  align-items: center;
}
.funnel-barra {
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
}
.funnel-cantidad {
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
}

.funnel-conv { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; }
.funnel-pct { font-size: 0.9rem; font-weight: 700; }
.conv-alta  { color: #16a34a; }
.conv-media { color: #d97706; }
.conv-baja  { color: #dc2626; }
.funnel-conv-sub { font-size: 0.66rem; color: var(--muted-foreground); }

@media (max-width: 780px) {
  .funnel-fila { grid-template-columns: 130px 1fr 74px; gap: 8px; }
  .funnel-sub { display: none; }
  .funnel-conv-sub { display: none; }
}

.funnel-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 0;
  color: var(--muted-foreground);
}
.funnel-vacio p { margin: 0; font-size: 0.86rem; }

.punto-etapa {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
</style>
