<!--
  Trade Cars — Módulo 3: Análisis de Conversión
  ---------------------------------------------
  Responde "¿por qué los leads interesados no llegan a cita?".
  No afecta el funnel: es una vista de gestión para asesores y supervisores.

  Trabaja sobre los leads en etapa INTERESADOS o CUMPLE POLITICA (los que
  todavía se pueden recuperar) y cruza tres señales:
    · MOTIVO DE NO CITA           -> patrones agrupados
    · FECHA PROBABLE DE VENTA     -> a quién priorizar este mes y el siguiente
    · PRÓXIMA ACCIÓN / SEGUIMIENTO-> qué compromisos ya vencieron (en rojo)
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Análisis de Conversión</h1>
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

      <!-- ══════════ ALERTA DE VENCIDOS ══════════ -->
      <v-alert v-if="vencidos.length" type="error" variant="tonal" density="compact"
        class="mb-4" icon="mdi-clock-alert">
        <strong>{{ vencidos.length }}</strong> lead(s) con la fecha de seguimiento vencida
        y sin avanzar. Aparecen marcados en rojo en la tabla.
      </v-alert>

      <!-- ══════════ RESUMEN ══════════ -->
      <div class="stats-grid mini">
        <div class="stat-card">
          <div class="stat-title">Leads recuperables</div>
          <div class="stat-value">{{ recuperables.length }}</div>
          <div class="stat-description">En CUMPLE POLITICA o INTERESADOS</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Seguimientos vencidos</div>
          <div class="stat-value" :style="vencidos.length ? 'color:#dc2626;' : ''">{{ vencidos.length }}</div>
          <div class="stat-description">Fecha comprometida ya pasó</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Venta probable próxima</div>
          <div class="stat-value" style="color:#d97706;">{{ ventaProxima.length }}</div>
          <div class="stat-description">Este mes o el siguiente</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Sin motivo registrado</div>
          <div class="stat-value">{{ sinMotivo }}</div>
          <div class="stat-description">Falta que el asesor lo llene</div>
        </div>
      </div>

      <!-- ══════════ MOTIVOS DE NO CITA ══════════ -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Motivos de no cita</h2>
            <div class="chart-subtitle">
              Por qué los leads con potencial no llegaron a agendar. Agrupado para
              detectar patrones.
            </div>
          </div>
          <v-select v-model="fAsesorMotivo" :items="opcionesAsesor" label="Asesor"
            density="compact" hide-details variant="outlined" style="max-width:200px;" />
        </div>

        <div v-if="!motivos.length" class="bloque-vacio">
          <v-icon icon="mdi-comment-question-outline" size="36" />
          <p>Todavía no hay motivos registrados en este grupo de leads.</p>
        </div>

        <div v-else class="motivos-wrap">
          <div v-for="m in motivos" :key="m.motivo" class="motivo-fila">
            <div class="motivo-nombre" :title="m.motivo">{{ m.motivo }}</div>
            <div class="motivo-pista">
              <div class="motivo-barra" :style="{ width: (m.cantidad / motivos[0].cantidad * 100) + '%' }" />
            </div>
            <div class="motivo-cifras">
              <strong>{{ m.cantidad }}</strong>
              <span class="motivo-pct">{{ m.pct.toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ TABLA DE GESTIÓN ══════════ -->
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Leads a recuperar ({{ tablaFiltrada.length }})</span>
          <v-spacer />
          <div class="d-flex align-center flex-wrap" style="gap:10px;">
            <v-select v-model="fVista" :items="opcionesVista" item-title="label" item-value="value"
              density="compact" hide-details variant="outlined" style="min-width:210px;" />
            <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify" placeholder="Buscar…"
              density="compact" hide-details variant="outlined" style="max-width:220px;" clearable />
          </div>
        </v-card-title>

        <v-data-table :headers="headers" :items="tablaFiltrada" :loading="loading"
          class="elevation-0" no-data-text="No hay leads en este grupo" :items-per-page="25">

          <!-- La fila entera se tiñe cuando el seguimiento venció -->
          <template #item.contacto_nombre="{ item }">
            <div class="d-flex align-center" style="gap:6px;">
              <v-icon v-if="item._vencido" icon="mdi-alert-circle" size="14" color="error" />
              <strong :class="{ 'texto-vencido': item._vencido }">{{ item.contacto_nombre || '—' }}</strong>
            </div>
          </template>

          <template #item.asesor="{ item }">{{ item.asesor || '—' }}</template>

          <template #item.etapa="{ item }">
            <v-chip size="x-small" variant="tonal"
              :color="item._etapa === 'INTERESADOS' ? 'info' : 'grey'">
              {{ item._etapa }}
            </v-chip>
          </template>

          <template #item.motivo_no_cita="{ item }">
            <span v-if="item.motivo_no_cita">{{ item.motivo_no_cita }}</span>
            <v-chip v-else size="x-small" color="warning" variant="tonal">Sin registrar</v-chip>
          </template>

          <template #item.fecha_probable_venta="{ item }">
            <div v-if="item.fecha_probable_venta" class="d-flex align-center" style="gap:5px;">
              <span>{{ fmt(item.fecha_probable_venta) }}</span>
              <v-chip v-if="item._ventaProxima" size="x-small" color="warning" variant="flat">
                priorizar
              </v-chip>
            </div>
            <span v-else>—</span>
          </template>

          <template #item.proxima_accion="{ item }">
            <span v-if="item.proxima_accion" class="accion-texto" :title="item.proxima_accion">
              {{ item.proxima_accion }}
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <template #item.fecha_seguimiento="{ item }">
            <div v-if="item.fecha_seguimiento" class="celda-seguimiento">
              <span :class="{ 'texto-vencido': item._vencido }">{{ fmt(item.fecha_seguimiento) }}</span>
              <span v-if="item._vencido" class="dias-vencido">
                {{ item._diasVencido }} d. vencido
              </span>
            </div>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <template #item.acciones="{ item }">
            <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="$emit('editar', item)" />
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
}>()
defineEmits<{ refresh: [], editar: [lead: any] }>()

/* ---------------- Filtros ---------------- */
const fAsesorMotivo = usePersistente('tradecars:conv:asesor', 'todos')
const fVista = usePersistente('tradecars:conv:vista', 'todos')
const fBuscar = ref('')

const opcionesVista = [
  { label: 'Todos los recuperables', value: 'todos' },
  { label: 'Solo seguimientos vencidos', value: 'vencidos' },
  { label: 'Venta probable este mes o el próximo', value: 'proximos' },
  { label: 'Sin motivo registrado', value: 'sin_motivo' },
]

const opcionesAsesor = computed(() => {
  const s = new Set<string>(props.asesores || [])
  for (const l of props.leads) if (l.asesor) s.add(l.asesor)
  return ['todos', ...[...s].sort()]
})

/* ---------------- Universo del módulo ---------------- */
/**
 * Sólo leads que todavía se pueden recuperar: CUMPLE POLITICA (contactar) o
 * INTERESADOS (empujar a cita). Los que ya tienen cita o compraron no entran,
 * y los que nunca cumplieron política tampoco.
 */
const recuperables = computed(() =>
  props.leads
    .map(l => {
      const etapa = tcEtapa(l)
      const vencido = tcSeguimientoVencido(l)
      return {
        ...l,
        _etapa: etapa,
        _vencido: vencido,
        _ventaProxima: tcVentaProxima(l),
        _diasVencido: vencido ? diasDesde(tcFecha(l.fecha_seguimiento)!) : 0,
      }
    })
    .filter(l => l._etapa === 'INTERESADOS' || l._etapa === 'CUMPLE POLITICA'),
)

function diasDesde(fecha: string) {
  const hoy = new Date(tcHoyLima() + 'T12:00:00').getTime()
  const f = new Date(fecha + 'T12:00:00').getTime()
  return Math.max(0, Math.round((hoy - f) / 86400000))
}

const vencidos = computed(() => recuperables.value.filter(l => l._vencido))
const ventaProxima = computed(() => recuperables.value.filter(l => l._ventaProxima))
const sinMotivo = computed(() => recuperables.value.filter(l => !l.motivo_no_cita).length)

/* ---------------- Motivos agrupados ---------------- */
const motivos = computed(() => {
  const base = fAsesorMotivo.value === 'todos'
    ? recuperables.value
    : recuperables.value.filter(l => l.asesor === fAsesorMotivo.value)

  const conteo = new Map<string, number>()
  for (const l of base) {
    const m = String(l.motivo_no_cita || '').trim()
    if (!m) continue
    conteo.set(m, (conteo.get(m) || 0) + 1)
  }
  const total = [...conteo.values()].reduce((a, b) => a + b, 0)

  return [...conteo.entries()]
    .map(([motivo, cantidad]) => ({ motivo, cantidad, pct: total ? (cantidad / total) * 100 : 0 }))
    .sort((a, b) => b.cantidad - a.cantidad)
})

/* ---------------- Tabla ---------------- */
const tablaFiltrada = computed(() => {
  let filas = recuperables.value

  if (fVista.value === 'vencidos')    filas = filas.filter(l => l._vencido)
  if (fVista.value === 'proximos')    filas = filas.filter(l => l._ventaProxima)
  if (fVista.value === 'sin_motivo')  filas = filas.filter(l => !l.motivo_no_cita)

  if (fAsesorMotivo.value !== 'todos') filas = filas.filter(l => l.asesor === fAsesorMotivo.value)

  const q = tcNormalizar(fBuscar.value)
  if (q) {
    filas = filas.filter(l => tcNormalizar(
      [l.contacto_nombre, l.contacto_telefono, l.asesor, l.motivo_no_cita, l.proxima_accion].join(' '),
    ).includes(q))
  }

  // Los vencidos primero (y dentro de ellos, los más atrasados arriba)
  return [...filas].sort((a, b) => {
    if (a._vencido !== b._vencido) return a._vencido ? -1 : 1
    if (a._vencido) return b._diasVencido - a._diasVencido
    const fa = tcFecha(a.fecha_seguimiento) || '9999'
    const fb = tcFecha(b.fecha_seguimiento) || '9999'
    return fa.localeCompare(fb)
  })
})

const headers = [
  { title: 'Cliente', key: 'contacto_nombre' },
  { title: 'Asesor', key: 'asesor' },
  { title: 'Etapa', key: 'etapa', value: '_etapa' },
  { title: 'Motivo de no cita', key: 'motivo_no_cita' },
  { title: 'Venta probable', key: 'fecha_probable_venta' },
  { title: 'Próxima acción', key: 'proxima_accion', sortable: false },
  { title: 'Seguimiento', key: 'fecha_seguimiento' },
  { title: '', key: 'acciones', sortable: false, align: 'end' as const },
]

function fmt(v: any) {
  const f = tcFecha(v)
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

/* ---------------- Export ---------------- */
function exportarCsv() {
  const cols = [
    ['Cliente', (l: any) => l.contacto_nombre],
    ['Telefono', (l: any) => l.contacto_telefono],
    ['Asesor', (l: any) => l.asesor],
    ['Etapa', (l: any) => l._etapa],
    ['Motivo de no cita', (l: any) => l.motivo_no_cita],
    ['Fecha probable de venta', (l: any) => tcFecha(l.fecha_probable_venta)],
    ['Proxima accion', (l: any) => l.proxima_accion],
    ['Fecha de seguimiento', (l: any) => tcFecha(l.fecha_seguimiento)],
    ['Seguimiento vencido', (l: any) => (l._vencido ? 'SI' : 'NO')],
    ['Dias vencido', (l: any) => (l._vencido ? l._diasVencido : '')],
  ] as [string, (l: any) => any][]

  const filas = [
    cols.map(c => c[0]),
    ...tablaFiltrada.value.map(l => cols.map(c => c[1](l) ?? '')),
  ]
  const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analisis-conversion-tradecars-${tcHoyLima()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
/* ── Motivos ── */
.motivos-wrap { display: flex; flex-direction: column; gap: 9px; padding: 6px 4px; }
.motivo-fila {
  display: grid;
  grid-template-columns: 230px 1fr 88px;
  align-items: center;
  gap: 14px;
}
.motivo-nombre {
  font-size: 0.8rem;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.motivo-pista {
  background: var(--muted);
  border-radius: 5px;
  height: 26px;
  overflow: hidden;
}
.motivo-barra {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #f5b301, #d97706);
  transition: width 0.4s ease;
  min-width: 3px;
}
.motivo-cifras {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
}
.motivo-pct { font-size: 0.7rem; color: var(--muted-foreground); }

@media (max-width: 700px) {
  .motivo-fila { grid-template-columns: 130px 1fr 70px; gap: 8px; }
}

/* ── Alertas de seguimiento ── */
.texto-vencido { color: #dc2626 !important; font-weight: 700; }
.celda-seguimiento { display: flex; flex-direction: column; line-height: 1.2; }
.dias-vencido { font-size: 0.62rem; color: #dc2626; font-weight: 600; }

.accion-texto {
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  font-size: 0.83rem;
}

.bloque-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--muted-foreground);
}
.bloque-vacio p { margin: 0; font-size: 0.85rem; }
</style>
