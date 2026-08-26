<!--
  Trade Cars — Módulo 4: Procedencia y Costos
  -------------------------------------------
  Equivale a las páginas "PROCEDENCIA DEL LEAD" y a las medidas de costo
  (Costo ($), Costo por lead, Inv. por compra) del funnel tradecars 2.pbix.

  Dos preguntas:
    · ¿De qué campaña y de qué modelo vienen los leads que sí compran?
    · ¿Cuánto cuesta cada lead y cada compra en esa campaña?

  El costo NO sale del Excel del asesor: en el Power BI vive en una tabla
  aparte que alguien pega a mano cada mes. Aquí se carga desde esta misma
  pantalla (tradecars_campana_costos) y el resto se calcula solo. Mientras un
  mes no tenga costos cargados, las columnas de costo salen vacías — no se
  inventa ningún número.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Procedencia y Costos</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" @click="abrirCosto()">
          <v-icon icon="mdi-cash-plus" size="16" /><span>Cargar inversión</span>
        </button>
        <button class="btn-primary" @click="exportarCsv">
          <v-icon icon="mdi-microsoft-excel" size="16" /><span>Exportar</span>
        </button>
        <button class="btn-primary" @click="$emit('refresh')">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">

      <!-- ══════════ FILTROS ══════════ -->
      <div class="filtros-fila">
        <v-select v-model="fMes" :items="opcionesMes" label="Mes"
          density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fCampana" :items="opcionesCampana" label="Campaña"
          density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fPrioridad" :items="opcionesPrioridad" label="Prioridad de marca"
          density="compact" hide-details variant="outlined" class="filtro" />
        <v-spacer />
        <span class="conteo">{{ leadsFiltrados.length }} leads</span>
      </div>

      <v-alert v-if="!hayCostos" type="info" variant="tonal" density="compact"
        class="mb-4" icon="mdi-information-outline">
        Todavía no hay inversión cargada. Las columnas de <strong>costo por lead</strong> e
        <strong>inversión por compra</strong> quedan vacías hasta que se cargue el gasto del
        mes con «Cargar inversión».
      </v-alert>

      <!-- ══════════ POR CAMPAÑA ══════════ -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Por campaña</h2>
            <div class="chart-subtitle">
              De dónde vienen los leads y cuántos terminan en compra.
              El costo por lead sale de la inversión cargada para ese mes.
            </div>
          </div>
        </div>

        <v-data-table :headers="headersCampana" :items="porCampana" :loading="loading"
          density="compact" class="tabla-oscura" items-per-page="15"
          no-data-text="Sin leads para este filtro">
          <template #item.campana="{ item }">
            <strong>{{ item.campana }}</strong>
          </template>
          <template #item.leads="{ item }">
            <span class="mono">{{ item.leads }}</span>
          </template>
          <template #item.citas="{ item }">
            <span class="mono">{{ item.citas }}</span>
          </template>
          <template #item.compras="{ item }">
            <span class="mono" :class="item.compras ? 'ok' : ''">{{ item.compras }}</span>
          </template>
          <template #item.tasa="{ item }">
            <span class="mono">{{ item.leads ? (item.compras / item.leads * 100).toFixed(1) + '%' : '—' }}</span>
          </template>
          <template #item.costo="{ item }">
            <span class="mono">{{ item.costo != null ? fmtMoneda(item.costo) : '—' }}</span>
          </template>
          <template #item.costoLead="{ item }">
            <span class="mono">{{ item.costoLead != null ? fmtMoneda(item.costoLead) : '—' }}</span>
          </template>
          <template #item.costoCompra="{ item }">
            <span class="mono">{{ item.costoCompra != null ? fmtMoneda(item.costoCompra) : '—' }}</span>
          </template>
        </v-data-table>
      </div>

      <!-- ══════════ POR MODELO ══════════ -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Por marca y modelo</h2>
            <div class="chart-subtitle">
              Qué vehículos llegan y cuáles se concretan. La prioridad (1/2/3) sale
              del catálogo de marcas, no se escribe lead por lead.
            </div>
          </div>
        </div>

        <v-data-table :headers="headersModelo" :items="porModelo" :loading="loading"
          density="compact" class="tabla-oscura" items-per-page="15"
          no-data-text="Sin leads para este filtro">
          <template #item.marca="{ item }">
            <div class="celda-marca">
              <span>{{ item.marca }}</span>
              <span v-if="item.prioridad" class="chip-prioridad" :class="'p' + item.prioridad">
                P{{ item.prioridad }}
              </span>
            </div>
          </template>
          <template #item.leads="{ item }"><span class="mono">{{ item.leads }}</span></template>
          <template #item.citas="{ item }"><span class="mono">{{ item.citas }}</span></template>
          <template #item.compras="{ item }">
            <span class="mono" :class="item.compras ? 'ok' : ''">{{ item.compras }}</span>
          </template>
          <template #item.tasa="{ item }">
            <span class="mono">{{ item.leads ? (item.compras / item.leads * 100).toFixed(1) + '%' : '—' }}</span>
          </template>
        </v-data-table>
      </div>

      <!-- ══════════ ZONAS ══════════ -->
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Por zona</h2>
            <div class="chart-subtitle">
              La zona se deduce del distrito con el catálogo de zonificación.
              «NO PERTENECE» son leads fuera del área de cobertura.
            </div>
          </div>
        </div>
        <div class="zonas-wrap">
          <div v-for="z in porZona" :key="z.zona" class="zona-fila">
            <div class="zona-nombre">{{ z.zona }}</div>
            <div class="zona-pista">
              <div class="zona-barra" :class="z.zona === 'NO PERTENECE' ? 'gris' : ''"
                :style="{ width: (maxZona ? z.leads / maxZona * 100 : 0) + '%' }" />
            </div>
            <div class="zona-cifras">
              <strong>{{ z.leads }}</strong>
              <span class="zona-pct">{{ z.compras }} compras</span>
            </div>
          </div>
          <div v-if="!porZona.length" class="bloque-vacio">Sin datos de distrito todavía.</div>
        </div>
      </div>
    </div>

    <!-- ══════════ DIÁLOGO DE INVERSIÓN ══════════ -->
    <v-dialog v-model="showCosto" max-width="520">
      <v-card v-if="costoForm" class="dialogo">
        <v-card-title>{{ costoForm.id ? 'Editar inversión' : 'Cargar inversión' }}</v-card-title>
        <v-card-text>
          <p class="ayuda">
            El gasto publicitario del mes por campaña. Es el mismo número que hoy se
            pega a mano en la tabla COSTOS del Power BI.
          </p>
          <div class="form-grid-2">
            <v-text-field v-model="costoForm.mes" type="month" label="Mes"
              density="compact" hide-details />
            <v-combobox v-model="costoForm.campana" :items="campanasConocidas" label="Campaña"
              density="compact" hide-details />
            <v-text-field v-model.number="costoForm.costo" type="number" label="Inversión"
              density="compact" hide-details :prefix="costoForm.moneda === 'PEN' ? 'S/' : '$'" />
            <v-select v-model="costoForm.moneda" :items="['USD', 'PEN']" label="Moneda"
              density="compact" hide-details />
          </div>
          <v-text-field v-model="costoForm.nota" label="Nota (opcional)"
            density="compact" hide-details class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="costoForm.id" color="error" variant="text" @click="borrarCosto">Eliminar</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="showCosto = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" @click="guardarCosto">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Inversión ya cargada, para editarla -->
    <div v-if="costosDelMes.length" class="content-area pt-0">
      <div class="chart-section">
        <div class="chart-header">
          <div class="chart-title-section">
            <h2>Inversión cargada</h2>
            <div class="chart-subtitle">Clic en una fila para editarla.</div>
          </div>
        </div>
        <v-data-table :headers="headersCosto" :items="costosDelMes" density="compact"
          class="tabla-oscura" items-per-page="10" @click:row="(_e: any, r: any) => abrirCosto(r.item)">
          <template #item.mes="{ item }">{{ String(item.mes).slice(0, 7) }}</template>
          <template #item.costo="{ item }">
            <span class="mono">{{ item.moneda === 'PEN' ? 'S/ ' : '$ ' }}{{ Number(item.costo).toFixed(2) }}</span>
          </template>
        </v-data-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  leads: any[]
  costos: any[]
  loading?: boolean
}>()
const emit = defineEmits<{
  refresh: []
  /** El snackbar vive en la página: el componente sólo pide que se muestre. */
  notificar: [texto: string, color?: string]
}>()

const client = useSupabaseClient()
const notify = (texto: string, color = 'success') => emit('notificar', texto, color)

/* ══════════════════ Filtros ══════════════════ */
const fMes = usePersistente('tradecars:proc:mes', 'todos')
const fCampana = usePersistente('tradecars:proc:campana', 'todos')
const fPrioridad = usePersistente('tradecars:proc:prioridad', 'todos')

const opcionesMes = computed(() => {
  const set = new Set<string>()
  for (const l of props.leads) {
    const m = tcMesFunnel(l)
    if (m) set.add(m)
  }
  return ['todos', ...[...set].sort().reverse()]
})

const opcionesCampana = computed(() => {
  const set = new Set<string>()
  for (const l of props.leads) if (l.campana) set.add(l.campana)
  return ['todos', ...[...set].sort()]
})

const opcionesPrioridad = ['todos', '1', '2', '3', 'sin prioridad']

const leadsFiltrados = computed(() => props.leads.filter((l) => {
  if (tcRank(l) < 0) return false                 // sin clasificar: fuera del funnel
  if (fMes.value !== 'todos' && tcMesFunnel(l) !== fMes.value) return false
  if (fCampana.value !== 'todos' && (l.campana || '') !== fCampana.value) return false
  if (fPrioridad.value !== 'todos') {
    const p = l.marca_prioridad
    if (fPrioridad.value === 'sin prioridad') { if (p) return false }
    else if (String(p || '') !== fPrioridad.value) return false
  }
  return true
}))

/* ══════════════════ Agregados ══════════════════ */
const RANK_CITA = 4
const RANK_COMPRA = 6

/**
 * Agrupa por una clave NORMALIZADA (mayúsculas, sin tildes) y muestra la
 * grafía más frecuente de las que escribieron los asesores.
 *
 * Sin esto "SPORTAGE" y "Sportage" salen como dos modelos distintos: en la
 * base real eso partía los 3.200 pares marca-modelo casi por la mitad y
 * ninguna fila reflejaba el total del modelo.
 */
function agrupar(clave: (l: any) => string, extra?: (l: any) => any) {
  const mapa = new Map<string, any>()
  for (const l of leadsFiltrados.value) {
    const bruta = clave(l)
    const k = tcNormalizar(bruta)
    if (!mapa.has(k)) {
      mapa.set(k, { leads: 0, citas: 0, compras: 0, _grafias: new Map<string, number>(), ...(extra ? extra(l) : {}) })
    }
    const g = mapa.get(k)
    g._grafias.set(bruta, (g._grafias.get(bruta) || 0) + 1)
    g.leads++
    const r = tcRank(l)
    if (r >= RANK_CITA) g.citas++
    if (r === RANK_COMPRA) g.compras++
  }
  return mapa
}

/** La grafía que más veces escribieron para ese grupo. */
function grafiaMasUsada(g: any): string {
  let mejor = ''
  let max = -1
  for (const [texto, n] of g._grafias) if (n > max) { mejor = texto; max = n }
  return mejor
}

/**
 * Inversión aplicable al filtro actual.
 * Con un mes concreto se usa el gasto de ese mes; con "todos" se suma el de
 * todos los meses que tengan carga. Devuelve null cuando no hay nada cargado,
 * para que la UI muestre "—" y no un cero que parezca gratis.
 */
function costoDe(campana: string): number | null {
  const filas = props.costos.filter(c =>
    c.tipo !== 'ventas'
    && (c.campana || '') === campana
    && (fMes.value === 'todos' || String(c.mes).slice(0, 7) === fMes.value))
  if (!filas.length) return null
  return filas.reduce((a, c) => a + Number(c.costo || 0), 0)
}

const porCampana = computed(() => {
  const mapa = agrupar(l => l.campana || 'Sin campaña')
  return [...mapa.values()].map((g) => {
    const campana = grafiaMasUsada(g)
    const costo = costoDe(campana)
    return {
      campana,
      leads: g.leads,
      citas: g.citas,
      compras: g.compras,
      costo,
      costoLead: costo != null && g.leads ? costo / g.leads : null,
      costoCompra: costo != null && g.compras ? costo / g.compras : null,
    }
  }).sort((a, b) => b.leads - a.leads)
})

const porModelo = computed(() => {
  const mapa = agrupar(
    // La marca ya viene canónica del catálogo; el modelo es texto libre, así
    // que la clave lo normaliza y se muestra la grafía más usada.
    l => (l.marca_normalizada || l.marca || 'Sin marca') + ' · ' + (l.modelo || 'Sin modelo'),
    l => ({
      marca: l.marca_normalizada || l.marca || 'Sin marca',
      prioridad: l.marca_prioridad || null,
    }),
  )
  return [...mapa.values()]
    .map(g => ({ ...g, modelo: grafiaMasUsada(g).split(' · ').slice(1).join(' · ') || 'Sin modelo' }))
    .sort((a, b) => b.leads - a.leads)
})

const porZona = computed(() => {
  const mapa = agrupar(l => l.zona || 'Sin zona')
  return [...mapa.values()]
    .map(g => ({ ...g, zona: grafiaMasUsada(g) }))
    .sort((a, b) => b.leads - a.leads)
})
const maxZona = computed(() => Math.max(0, ...porZona.value.map(z => z.leads)))

const hayCostos = computed(() => props.costos.some(c => c.tipo !== 'ventas'))
const costosDelMes = computed(() => props.costos.filter(c =>
  fMes.value === 'todos' || String(c.mes).slice(0, 7) === fMes.value))
const campanasConocidas = computed(() => opcionesCampana.value.filter(c => c !== 'todos'))

/* ══════════════════ Tablas ══════════════════ */
const headersCampana = [
  { title: 'Campaña', key: 'campana' },
  { title: 'Leads', key: 'leads', align: 'end' as const },
  { title: 'Citas', key: 'citas', align: 'end' as const },
  { title: 'Compras', key: 'compras', align: 'end' as const },
  { title: '% compra', key: 'tasa', align: 'end' as const, sortable: false },
  { title: 'Inversión', key: 'costo', align: 'end' as const },
  { title: 'Costo / lead', key: 'costoLead', align: 'end' as const },
  { title: 'Inv. / compra', key: 'costoCompra', align: 'end' as const },
]
const headersModelo = [
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Leads', key: 'leads', align: 'end' as const },
  { title: 'Citas', key: 'citas', align: 'end' as const },
  { title: 'Compras', key: 'compras', align: 'end' as const },
  { title: '% compra', key: 'tasa', align: 'end' as const, sortable: false },
]
const headersCosto = [
  { title: 'Mes', key: 'mes' },
  { title: 'Campaña', key: 'campana' },
  { title: 'Inversión', key: 'costo', align: 'end' as const },
  { title: 'Nota', key: 'nota' },
]

function fmtMoneda(v: number) {
  return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ══════════════════ Carga de inversión ══════════════════ */
const showCosto = ref(false)
const costoForm = ref<any>(null)

function abrirCosto(fila?: any) {
  costoForm.value = fila
    ? { ...fila, mes: String(fila.mes).slice(0, 7) }
    : {
        mes: fMes.value !== 'todos' ? fMes.value : new Date().toISOString().slice(0, 7),
        campana: fCampana.value !== 'todos' ? fCampana.value : '',
        costo: null, moneda: 'USD', nota: '', tipo: 'compras',
      }
  showCosto.value = true
}

async function guardarCosto() {
  const f = costoForm.value
  if (!f?.mes) return notify('Falta el mes', 'error')
  if (!f.campana?.trim()) return notify('Falta la campaña', 'error')
  if (f.costo == null || isNaN(Number(f.costo))) return notify('Falta la inversión', 'error')

  const fila = {
    mes: f.mes + '-01',              // la columna es DATE: siempre el día 1
    tipo: f.tipo || 'compras',
    campana: f.campana.trim(),
    costo: Number(f.costo),
    moneda: f.moneda || 'USD',
    nota: f.nota || null,
  }

  const { error } = f.id
    ? await client.from('tradecars_campana_costos').update(fila).eq('id', f.id)
    : await client.from('tradecars_campana_costos')
        .upsert(fila, { onConflict: 'mes,tipo,campana' })

  if (error) return notify('No se pudo guardar: ' + error.message, 'error')
  showCosto.value = false
  emit('refresh')
  notify('Inversión guardada')
}

async function borrarCosto() {
  const f = costoForm.value
  if (!f?.id) return
  const { error } = await client.from('tradecars_campana_costos').delete().eq('id', f.id)
  if (error) return notify('No se pudo eliminar: ' + error.message, 'error')
  showCosto.value = false
  emit('refresh')
  notify('Inversión eliminada')
}

/* ══════════════════ Export ══════════════════ */
function exportarCsv() {
  const filas = [
    ['Campaña', 'Leads', 'Citas', 'Compras', '% compra', 'Inversión', 'Costo/lead', 'Inv./compra'],
    ...porCampana.value.map(c => [
      c.campana, c.leads, c.citas, c.compras,
      c.leads ? (c.compras / c.leads * 100).toFixed(1) + '%' : '',
      c.costo ?? '', c.costoLead?.toFixed(2) ?? '', c.costoCompra?.toFixed(2) ?? '',
    ]),
    [],
    ['Marca', 'Modelo', 'Prioridad', 'Leads', 'Citas', 'Compras'],
    ...porModelo.value.map(m => [m.marca, m.modelo, m.prioridad ?? '', m.leads, m.citas, m.compras]),
  ]
  const csv = filas.map(f => f.map((c: any) => {
    const s = String(c ?? '')
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }).join(';')).join('\n')

  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'tradecars-procedencia-' + (fMes.value === 'todos' ? 'historico' : fMes.value) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.filtros-fila {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filtro { max-width: 200px; min-width: 140px; }
.conteo { font-size: 0.78rem; color: var(--muted-foreground); }

.mono { font-variant-numeric: tabular-nums; font-size: 0.84rem; }
.ok { color: #16a34a; font-weight: 700; }

.celda-marca { display: flex; align-items: center; gap: 7px; }
.chip-prioridad {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.03em;
}
.chip-prioridad.p1 { background: rgba(22, 163, 74, 0.16); color: #16a34a; }
.chip-prioridad.p2 { background: rgba(217, 119, 6, 0.16); color: #d97706; }
.chip-prioridad.p3 { background: rgba(148, 163, 184, 0.16); color: var(--muted-foreground); }

/* ── Zonas ── */
.zonas-wrap { display: flex; flex-direction: column; gap: 9px; padding: 6px 4px; }
.zona-fila {
  display: grid;
  grid-template-columns: 160px 1fr 120px;
  align-items: center;
  gap: 14px;
}
.zona-nombre { font-size: 0.8rem; color: var(--foreground); }
.zona-pista { background: var(--muted); border-radius: 5px; height: 26px; overflow: hidden; }
.zona-barra {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #f5b301, #d97706);
  transition: width 0.4s ease;
  min-width: 3px;
}
.zona-barra.gris { background: linear-gradient(90deg, #94a3b8, #64748b); }
.zona-cifras {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 8px;
}
.zona-pct { font-size: 0.7rem; color: var(--muted-foreground); }

.dialogo .form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 560px) {
  .dialogo .form-grid-2 { grid-template-columns: 1fr; }
}

.dialogo .ayuda {
  font-size: 0.78rem;
  color: var(--muted-foreground);
  margin-bottom: 14px;
  line-height: 1.45;
}

.bloque-vacio {
  display: flex;
  justify-content: center;
  padding: 26px;
  font-size: 0.82rem;
  color: var(--muted-foreground);
}

@media (max-width: 700px) {
  .zona-fila { grid-template-columns: 110px 1fr 90px; gap: 8px; }
}
</style>
