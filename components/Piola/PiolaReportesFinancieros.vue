<template>
  <div>
    <!-- ══════════ FILTROS GLOBALES ══════════ -->
    <div class="filtros-bar">
      <v-select v-model="reporteId" :items="opcionesReporte" label="Reporte"
        density="compact" hide-details variant="outlined" class="filtro filtro-ancho" />
      <v-text-field v-model="fDesde" type="date" label="Desde" density="compact"
        hide-details variant="outlined" class="filtro filtro-fecha" />
      <v-text-field v-model="fHasta" type="date" label="Hasta" density="compact"
        hide-details variant="outlined" class="filtro filtro-fecha" />
      <v-select v-model="fArea" :items="opcionesArea" label="Área" density="compact"
        hide-details variant="outlined" class="filtro" />
      <v-select v-model="fCentro" :items="opcionesCentro" label="Centro de costo"
        density="compact" hide-details variant="outlined" class="filtro" />
      <v-select v-model="fUsuario" :items="opcionesUsuario" label="Usuario" density="compact"
        hide-details variant="outlined" class="filtro" />
      <v-select v-model="fCliente" :items="opcionesCliente" label="Cliente" density="compact"
        hide-details variant="outlined" class="filtro" />
      <v-select v-model="fProveedor" :items="opcionesProveedor" label="Proveedor"
        density="compact" hide-details variant="outlined" class="filtro" />
      <v-select v-model="fCategoria" :items="opcionesCategoria" label="Categoría"
        density="compact" hide-details variant="outlined" class="filtro" />
      <v-select v-model="fEstado" :items="opcionesEstado" label="Estado" density="compact"
        hide-details variant="outlined" class="filtro" />
      <v-btn size="small" variant="text" @click="limpiarFiltros">
        <v-icon icon="mdi-filter-remove-outline" start /> Limpiar
      </v-btn>
      <v-btn size="small" variant="tonal" :disabled="!filas.length" @click="exportarCSV">
        <v-icon icon="mdi-download" start /> CSV
      </v-btn>
    </div>

    <div class="reporte-descripcion">
      <v-icon :icon="reporteActual.icon" size="17" />
      <span>{{ reporteActual.descripcion }}</span>
    </div>

    <!-- ══════════ RESUMEN ══════════ -->
    <div v-if="resumen.length" class="stats-grid">
      <div v-for="r in resumen" :key="r.titulo" class="stat-card">
        <div class="stat-header"><span class="stat-title">{{ r.titulo }}</span></div>
        <div class="stat-value" :style="r.color ? { color: r.color } : undefined">{{ r.valor }}</div>
        <div class="stat-description">{{ r.detalle }}</div>
      </div>
    </div>

    <!-- ══════════ GRÁFICO ══════════ -->
    <div v-if="grafico" class="chart-section">
      <div class="chart-header">
        <div class="chart-title-section">
          <h2>{{ reporteActual.titulo }}</h2>
          <div class="chart-subtitle">{{ rangoTexto }}</div>
        </div>
      </div>
      <div class="chart-area">
        <client-only>
          <apexchart :type="grafico.tipo" :height="grafico.altura || 320"
            :options="grafico.opciones" :series="grafico.series" />
        </client-only>
      </div>
    </div>

    <!-- ══════════ TABLA ══════════ -->
    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">{{ reporteActual.titulo }} ({{ filas.length }})</span>
      </v-card-title>
      <v-data-table :headers="columnas" :items="filas" :loading="cargando" class="elevation-0"
        no-data-text="No hay datos para los filtros seleccionados" :items-per-page="50">
        <template v-for="col in columnasMoneda" :key="col" v-slot:[`item.${col}`]="{ item }">
          <span :style="estiloMonto(item, col)">{{ PEN((item as any)[col]) }}</span>
        </template>
        <template v-slot:item.estado="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorEstadoMovimiento((item as any).estado)">
            {{ etiquetaEstado((item as any).estado) }}
          </v-chip>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
/**
 * Reportes financieros.
 *
 * Los 13 reportes de la especificación salen del MISMO conjunto de datos
 * cargado una vez y filtrado en memoria. Es a propósito: son volúmenes de
 * agencia (miles de filas, no millones), y así cambiar de reporte o de filtro
 * es instantáneo en vez de un viaje al servidor por cada clic.
 *
 * Todos los reportes comparten los mismos filtros —fecha, área, usuario,
 * cliente, proveedor, categoría, centro de costo y estado—, tal como se pidió:
 * cada reporte declara qué columnas muestra y cómo agrupa, no su propio
 * mecanismo de filtrado.
 */
import { ref, computed, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import {
  PEN, PEN_CORTO, fechaCorta, hoyISO, periodoActual, aplanarCategorias, categoriaRaiz,
  etiquetaEstado, colorEstadoMovimiento, ESTADOS_MOVIMIENTO, traerTodo,} from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

/* ══════════ Catálogo de reportes ══════════ */
const REPORTES = [
  { id: 'ingresos_gastos', titulo: 'Estado de ingresos y gastos', icon: 'mdi-scale-balance',
    descripcion: 'Ingresos, gastos y resultado del periodo, mes a mes.' },
  { id: 'flujo_caja', titulo: 'Flujo de caja', icon: 'mdi-cash-sync',
    descripcion: 'Entradas y salidas reales por mes, con el saldo acumulado.' },
  { id: 'cobrar', titulo: 'Cuentas por cobrar', icon: 'mdi-account-cash',
    descripcion: 'Documentos con saldo a favor, con su antigüedad de deuda.' },
  { id: 'pagar', titulo: 'Cuentas por pagar', icon: 'mdi-credit-card-clock',
    descripcion: 'Obligaciones pendientes con proveedores y su vencimiento.' },
  { id: 'gastos_categoria', titulo: 'Gastos por categoría', icon: 'mdi-shape',
    descripcion: 'En qué se va el dinero, agrupado por categoría raíz.' },
  { id: 'ingresos_categoria', titulo: 'Ingresos por categoría', icon: 'mdi-tag-multiple',
    descripcion: 'De dónde viene el dinero, agrupado por categoría raíz.' },
  { id: 'ventas_periodo', titulo: 'Ventas por periodo', icon: 'mdi-chart-timeline-variant',
    descripcion: 'Facturación mes a mes, con número de operaciones y ticket promedio.' },
  { id: 'rentabilidad', titulo: 'Rentabilidad', icon: 'mdi-finance',
    descripcion: 'Margen por cliente: lo facturado contra lo que costó atenderlo.' },
  { id: 'presupuesto', titulo: 'Presupuesto vs. ejecución', icon: 'mdi-bullseye-arrow',
    descripcion: 'Lo presupuestado frente a lo realmente ejecutado.' },
  { id: 'caja', titulo: 'Movimientos de caja', icon: 'mdi-cash-register',
    descripcion: 'Aperturas, movimientos y cierres de caja, con sus diferencias.' },
  { id: 'bancarios', titulo: 'Movimientos bancarios', icon: 'mdi-bank',
    descripcion: 'Cobros y pagos hechos por transferencia, tarjeta o depósito.' },
  { id: 'impuestos', titulo: 'Reporte de impuestos', icon: 'mdi-percent',
    descripcion: 'IGV de ventas y de compras, y las retenciones del periodo.' },
  { id: 'comprobantes', titulo: 'Reporte de comprobantes', icon: 'mdi-receipt-text',
    descripcion: 'Comprobantes emitidos, con su serie, estado y monto.' },
]

const reporteId = ref('ingresos_gastos')
const reporteActual = computed(() =>
  REPORTES.find(r => r.id === reporteId.value) || REPORTES[0])
const opcionesReporte = REPORTES.map(r => ({ value: r.id, title: r.titulo }))

/* ══════════ Filtros ══════════ */
const primerDiaHace6Meses = () => {
  const [y, m] = periodoActual().split('-').map(Number)
  return new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10)
}

const fDesde = ref(primerDiaHace6Meses())
const fHasta = ref(hoyISO())
const fArea = ref<any>('todas')
const fCentro = ref<any>('todos')
const fUsuario = ref('todos')
const fCliente = ref<any>('todos')
const fProveedor = ref<any>('todos')
const fCategoria = ref<any>('todas')
const fEstado = ref('todos')

function limpiarFiltros() {
  fDesde.value = primerDiaHace6Meses()
  fHasta.value = hoyISO()
  fArea.value = 'todas'
  fCentro.value = 'todos'
  fUsuario.value = 'todos'
  fCliente.value = 'todos'
  fProveedor.value = 'todos'
  fCategoria.value = 'todas'
  fEstado.value = 'todos'
}

/* ══════════ Datos ══════════ */
const cargando = ref(false)
const transacciones = ref<any[]>([])
const pagos = ref<any[]>([])
const facturas = ref<any[]>([])
const presupuestos = ref<any[]>([])
const cajaSesiones = ref<any[]>([])
const cajaMovimientos = ref<any[]>([])
const categorias = ref<any[]>([])
const clientes = ref<any[]>([])
const proveedores = ref<any[]>([])
const areas = ref<any[]>([])
const centros = ref<any[]>([])
const colaboradores = ref<any[]>([])

async function cargar() {
  cargando.value = true
  const [t, pg, f, pr, cs, cm, ct, cl, pv, ar, cc, col] = await Promise.all([
    traerTodo(() => client.from('piola_transactions').select('*')
      .order('fecha', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_pagos').select('*').order('id')),
    traerTodo(() => client.from('piola_invoices').select('*')
      .order('fecha_emision', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_presupuestos').select('*').order('id')),
    traerTodo(() => client.from('piola_caja_sesiones').select('*')
      .order('fecha_apertura', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_caja_movimientos').select('*').order('id')),
    client.from('piola_expense_categories').select('*').order('orden'),
    client.from('piola_clientes').select('id, nombre').order('nombre'),
    client.from('piola_proveedores').select('id, nombre').order('nombre'),
    client.from('piola_areas').select('id, nombre').order('orden'),
    client.from('piola_centros_costo').select('id, nombre, codigo').order('orden'),
    client.from('piola_colaboradores').select('email, nombre').order('nombre'),
  ])
  if (t.error) emit('notify', { text: `Error cargando datos: ${t.error.message}`, color: 'error' })
  transacciones.value = (t.data as any[]) || []
  pagos.value = (pg.data as any[]) || []
  facturas.value = (f.data as any[]) || []
  presupuestos.value = (pr.data as any[]) || []
  cajaSesiones.value = (cs.data as any[]) || []
  cajaMovimientos.value = (cm.data as any[]) || []
  categorias.value = (ct.data as any[]) || []
  clientes.value = (cl.data as any[]) || []
  proveedores.value = (pv.data as any[]) || []
  areas.value = (ar.data as any[]) || []
  centros.value = (cc.data as any[]) || []
  colaboradores.value = (col.data as any[]) || []
  cargando.value = false
}

/* ══════════ Opciones de filtro ══════════ */
const categoriasPlanas = computed(() => aplanarCategorias(categorias.value))
const opcionesArea = computed(() => [{ value: 'todas', title: 'Todas las áreas' },
  ...areas.value.map(a => ({ value: a.id, title: a.nombre }))])
const opcionesCentro = computed(() => [{ value: 'todos', title: 'Todos los centros' },
  ...centros.value.map(c => ({ value: c.id, title: c.codigo || c.nombre }))])
const opcionesUsuario = computed(() => [{ value: 'todos', title: 'Todos los usuarios' },
  ...colaboradores.value.map(c => ({ value: c.email, title: c.nombre }))])
const opcionesCliente = computed(() => [{ value: 'todos', title: 'Todos los clientes' },
  ...clientes.value.map(c => ({ value: c.id, title: c.nombre }))])
const opcionesProveedor = computed(() => [{ value: 'todos', title: 'Todos los proveedores' },
  ...proveedores.value.map(p => ({ value: p.id, title: p.nombre }))])
const opcionesCategoria = computed(() => [{ value: 'todas', title: 'Todas las categorías' },
  ...categoriasPlanas.value.map(c => ({ value: c.id, title: c.ruta }))])
const opcionesEstado = [{ value: 'todos', title: 'Todos los estados' }, ...ESTADOS_MOVIMIENTO]

const rangoTexto = computed(() => `${fechaCorta(fDesde.value)} — ${fechaCorta(fHasta.value)}`)

const nombreCliente = (id: any) => clientes.value.find(c => c.id === id)?.nombre || '—'
const nombreProveedor = (id: any) => proveedores.value.find(p => p.id === id)?.nombre || '—'
const nombreArea = (id: any) => areas.value.find(a => a.id === id)?.nombre || '—'
const nombreColaborador = (email: any) =>
  colaboradores.value.find(c => c.email === email)?.nombre || email || '—'

/** Ids de una categoría y todos sus descendientes. */
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

/**
 * El filtrado es común a todos los reportes: cada uno solo dice qué hacer con
 * las filas que sobreviven. Un movimiento anulado nunca cuenta, salvo que se
 * lo pida explícitamente en el filtro de estado.
 */
const movimientos = computed(() => {
  const cats = fCategoria.value !== 'todas' ? conDescendientes(fCategoria.value) : null
  return transacciones.value.filter(t => {
    const fecha = String(t.fecha || '').slice(0, 10)
    if (fecha < fDesde.value || fecha > fHasta.value) return false
    if (fEstado.value !== 'todos') { if (t.estado !== fEstado.value) return false }
    else if (t.estado === 'anulado') return false
    if (fArea.value !== 'todas' && t.area_id !== fArea.value) return false
    if (fCentro.value !== 'todos' && t.centro_costo_id !== fCentro.value) return false
    if (fUsuario.value !== 'todos'
      && t.responsable_email !== fUsuario.value && t.created_by !== fUsuario.value) return false
    if (fCliente.value !== 'todos' && t.cliente_id !== fCliente.value) return false
    if (fProveedor.value !== 'todos' && t.proveedor_id !== fProveedor.value) return false
    if (cats && !cats.has(t.category_id)) return false
    return true
  })
})

const ingresos = computed(() => movimientos.value.filter(t => t.tipo === 'ingreso' && !t.proyectado))
const egresos = computed(() => movimientos.value.filter(t => t.tipo === 'egreso' && !t.proyectado))

/** Meses 'YYYY-MM' cubiertos por el rango, en orden. */
const meses = computed(() => {
  const out: string[] = []
  const [y1, m1] = fDesde.value.slice(0, 7).split('-').map(Number)
  const [y2, m2] = fHasta.value.slice(0, 7).split('-').map(Number)
  let y = y1, m = m1
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
    if (out.length > 60) break     // tope de seguridad ante un rango absurdo
  }
  return out
})

const suma = (lista: any[], campo = 'monto') =>
  lista.reduce((s, x) => s + Number(x[campo] || 0), 0)
const r2 = (n: number) => Math.round(n * 100) / 100

/* ══════════════════════════════════════════════════════════════════════
 * Cada reporte devuelve { columnas, filas, columnasMoneda, resumen, grafico }
 * ══════════════════════════════════════════════════════════════════════ */
const reporte = computed(() => {
  switch (reporteId.value) {
    case 'ingresos_gastos': return rIngresosGastos()
    case 'flujo_caja': return rFlujoCaja()
    case 'cobrar': return rCuentas('ingreso')
    case 'pagar': return rCuentas('egreso')
    case 'gastos_categoria': return rPorCategoria('egreso')
    case 'ingresos_categoria': return rPorCategoria('ingreso')
    case 'ventas_periodo': return rVentasPeriodo()
    case 'rentabilidad': return rRentabilidad()
    case 'presupuesto': return rPresupuesto()
    case 'caja': return rCaja()
    case 'bancarios': return rBancarios()
    case 'impuestos': return rImpuestos()
    case 'comprobantes': return rComprobantes()
    default: return { columnas: [], filas: [], columnasMoneda: [], resumen: [], grafico: null }
  }
})

const columnas = computed(() => reporte.value.columnas)
const filas = computed(() => reporte.value.filas)
const columnasMoneda = computed(() => reporte.value.columnasMoneda || [])
const resumen = computed(() => reporte.value.resumen || [])
const grafico = computed(() => reporte.value.grafico)

const estiloMonto = (item: any, col: string) => {
  const v = Number(item[col] || 0)
  if (col === 'resultado' || col === 'margen' || col === 'diferencia') {
    return { color: v >= 0 ? '#2e9e5b' : '#e2564a', fontWeight: 600 }
  }
  return undefined
}

const opcionesBase = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  dataLabels: { enabled: false },
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
  tooltip: { theme: isDark.value ? 'dark' : 'light', y: { formatter: (v: number) => PEN(v) } },
  yaxis: { labels: { formatter: (v: number) => PEN_CORTO(v) } },
}))

const etiquetaMes = (m: string) => m.slice(2).split('-').reverse().join('/')

/* ── 1. Estado de ingresos y gastos ── */
function rIngresosGastos() {
  const filas = meses.value.map(m => {
    const ing = suma(ingresos.value.filter(t => String(t.fecha).slice(0, 7) === m))
    const egr = suma(egresos.value.filter(t => String(t.fecha).slice(0, 7) === m))
    return {
      periodo: m, ingresos: r2(ing), gastos: r2(egr), resultado: r2(ing - egr),
      margen_pct: ing ? `${Math.round((ing - egr) / ing * 1000) / 10} %` : '—',
    }
  })
  const totIng = suma(filas, 'ingresos')
  const totEgr = suma(filas, 'gastos')
  return {
    columnas: [
      { title: 'Periodo', key: 'periodo' }, { title: 'Ingresos', key: 'ingresos' },
      { title: 'Gastos', key: 'gastos' }, { title: 'Resultado', key: 'resultado' },
      { title: 'Margen', key: 'margen_pct' },
    ],
    columnasMoneda: ['ingresos', 'gastos', 'resultado'],
    filas,
    resumen: [
      { titulo: 'Ingresos', valor: PEN_CORTO(totIng), detalle: `${ingresos.value.length} movimientos`, color: '#2e9e5b' },
      { titulo: 'Gastos', valor: PEN_CORTO(totEgr), detalle: `${egresos.value.length} movimientos`, color: '#e2564a' },
      { titulo: 'Resultado', valor: PEN_CORTO(totIng - totEgr), detalle: 'Ingresos − gastos',
        color: totIng - totEgr >= 0 ? '#2e9e5b' : '#e2564a' },
      { titulo: 'Margen', valor: totIng ? `${Math.round((totIng - totEgr) / totIng * 1000) / 10} %` : '—',
        detalle: 'Sobre los ingresos del periodo' },
    ],
    grafico: {
      tipo: 'bar', altura: 330,
      series: [
        { name: 'Ingresos', type: 'column', data: filas.map(f => f.ingresos) },
        { name: 'Gastos', type: 'column', data: filas.map(f => f.gastos) },
        { name: 'Resultado', type: 'line', data: filas.map(f => f.resultado) },
      ],
      opciones: {
        ...opcionesBase.value,
        stroke: { width: [0, 0, 3], curve: 'smooth' },
        colors: ['#2e9e5b', '#e2564a', '#5b8def'],
        xaxis: { categories: meses.value.map(etiquetaMes) },
      },
    },
  }
}

/* ── 2. Flujo de caja ── */
function rFlujoCaja() {
  let acumulado = 0
  const filas = meses.value.map(m => {
    const ent = suma(ingresos.value.filter(t => String(t.fecha).slice(0, 7) === m), 'monto_pagado')
    const sal = suma(egresos.value.filter(t => String(t.fecha).slice(0, 7) === m), 'monto_pagado')
    const neto = r2(ent - sal)
    acumulado = r2(acumulado + neto)
    return { periodo: m, entradas: r2(ent), salidas: r2(sal), neto, acumulado }
  })
  return {
    columnas: [
      { title: 'Periodo', key: 'periodo' }, { title: 'Entradas', key: 'entradas' },
      { title: 'Salidas', key: 'salidas' }, { title: 'Flujo neto', key: 'neto' },
      { title: 'Saldo acumulado', key: 'acumulado' },
    ],
    columnasMoneda: ['entradas', 'salidas', 'neto', 'acumulado'],
    filas,
    resumen: [
      { titulo: 'Entradas', valor: PEN_CORTO(suma(filas, 'entradas')), detalle: 'Cobrado en el periodo', color: '#2e9e5b' },
      { titulo: 'Salidas', valor: PEN_CORTO(suma(filas, 'salidas')), detalle: 'Pagado en el periodo', color: '#e2564a' },
      { titulo: 'Flujo neto', valor: PEN_CORTO(suma(filas, 'neto')), detalle: 'Entradas − salidas' },
      { titulo: 'Saldo final', valor: PEN_CORTO(acumulado), detalle: 'Acumulado al cierre del rango' },
    ],
    grafico: {
      tipo: 'bar', altura: 330,
      series: [
        { name: 'Entradas', type: 'column', data: filas.map(f => f.entradas) },
        { name: 'Salidas', type: 'column', data: filas.map(f => f.salidas) },
        { name: 'Saldo acumulado', type: 'line', data: filas.map(f => f.acumulado) },
      ],
      opciones: {
        ...opcionesBase.value,
        stroke: { width: [0, 0, 3], curve: 'smooth' },
        colors: ['#2e9e5b', '#e2564a', '#8b5cf6'],
        xaxis: { categories: meses.value.map(etiquetaMes) },
      },
    },
  }
}

/* ── 3 y 4. Cuentas por cobrar / por pagar ── */
function rCuentas(tipo: 'ingreso' | 'egreso') {
  const esCobrar = tipo === 'ingreso'
  const hoy = hoyISO()
  const filas = movimientos.value
    .filter(t => t.tipo === tipo && !t.proyectado && t.estado !== 'anulado')
    .map(t => {
      const saldo = r2(Number(t.monto || 0) - Number(t.monto_pagado || 0))
      const venc = t.fecha_vencimiento ? String(t.fecha_vencimiento).slice(0, 10) : null
      const atraso = venc && venc < hoy && saldo > 0
        ? Math.round((Date.parse(`${hoy}T12:00:00`) - Date.parse(`${venc}T12:00:00`)) / 86400000) : 0
      return {
        tercero: esCobrar ? nombreCliente(t.cliente_id) : nombreProveedor(t.proveedor_id),
        documento: [t.documento_serie, t.documento_numero].filter(Boolean).join('-') || '—',
        concepto: t.concepto,
        emision: fechaCorta(t.fecha),
        vencimiento: fechaCorta(t.fecha_vencimiento),
        total: r2(Number(t.monto || 0)),
        pagado: r2(Number(t.monto_pagado || 0)),
        saldo,
        dias_atraso: atraso || '—',
        antiguedad: atraso === 0 ? 'Al día'
          : atraso <= 30 ? '1-30 días' : atraso <= 60 ? '31-60 días'
          : atraso <= 90 ? '61-90 días' : 'Más de 90 días',
        estado: t.estado,
        responsable: nombreColaborador(t.responsable_email),
      }
    })
    .filter(f => f.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)

  const vencido = filas.filter(f => f.dias_atraso !== '—')
  return {
    columnas: [
      { title: esCobrar ? 'Cliente' : 'Proveedor', key: 'tercero' },
      { title: 'Documento', key: 'documento' }, { title: 'Concepto', key: 'concepto' },
      { title: 'Emisión', key: 'emision' }, { title: 'Vencimiento', key: 'vencimiento' },
      { title: 'Total', key: 'total' }, { title: 'Pagado', key: 'pagado' },
      { title: 'Saldo', key: 'saldo' }, { title: 'Atraso', key: 'dias_atraso' },
      { title: 'Antigüedad', key: 'antiguedad' }, { title: 'Estado', key: 'estado', sortable: false },
      { title: esCobrar ? 'Vendedor' : 'Responsable', key: 'responsable' },
    ],
    columnasMoneda: ['total', 'pagado', 'saldo'],
    filas,
    resumen: [
      { titulo: 'Saldo total', valor: PEN_CORTO(suma(filas, 'saldo')), detalle: `${filas.length} documentos` },
      { titulo: 'Vencido', valor: PEN_CORTO(suma(vencido, 'saldo')),
        detalle: `${vencido.length} documentos`, color: '#e2564a' },
      { titulo: 'Al día', valor: PEN_CORTO(suma(filas.filter(f => f.dias_atraso === '—'), 'saldo')),
        detalle: 'Todavía no vencen', color: '#2e9e5b' },
      { titulo: 'Ya cobrado', valor: PEN_CORTO(suma(filas, 'pagado')), detalle: 'Del total documentado' },
    ],
    grafico: (() => {
      const tramos = ['Al día', '1-30 días', '31-60 días', '61-90 días', 'Más de 90 días']
      const data = tramos.map(t => r2(suma(filas.filter(f => f.antiguedad === t), 'saldo')))
      return {
        tipo: 'bar', altura: 280,
        series: [{ name: 'Saldo', data }],
        opciones: {
          ...opcionesBase.value,
          plotOptions: { bar: { distributed: true, borderRadius: 4, columnWidth: '55%' } },
          colors: ['#2e9e5b', '#f2a63b', '#e8874a', '#e2564a', '#a8322a'],
          legend: { show: false },
          xaxis: { categories: tramos },
        },
      }
    })(),
  }
}

/* ── 5 y 6. Gastos / ingresos por categoría ── */
function rPorCategoria(tipo: 'ingreso' | 'egreso') {
  const lista = tipo === 'ingreso' ? ingresos.value : egresos.value
  const acc: Record<string, { monto: number; n: number }> = {}
  for (const t of lista) {
    const k = categoriaRaiz(categorias.value, t.category_id)
    if (!acc[k]) acc[k] = { monto: 0, n: 0 }
    acc[k].monto += Number(t.monto || 0)
    acc[k].n++
  }
  const total = Object.values(acc).reduce((s, v) => s + v.monto, 0)
  const filas = Object.entries(acc)
    .map(([categoria, v]) => ({
      categoria, monto: r2(v.monto), movimientos: v.n,
      promedio: r2(v.monto / v.n),
      participacion: total ? `${Math.round(v.monto / total * 1000) / 10} %` : '—',
    }))
    .sort((a, b) => b.monto - a.monto)

  return {
    columnas: [
      { title: 'Categoría', key: 'categoria' }, { title: 'Total', key: 'monto' },
      { title: 'Movimientos', key: 'movimientos' }, { title: 'Promedio', key: 'promedio' },
      { title: 'Participación', key: 'participacion' },
    ],
    columnasMoneda: ['monto', 'promedio'],
    filas,
    resumen: [
      { titulo: 'Total', valor: PEN_CORTO(total), detalle: `${lista.length} movimientos`,
        color: tipo === 'ingreso' ? '#2e9e5b' : '#e2564a' },
      { titulo: 'Categorías', valor: String(filas.length), detalle: 'Con movimiento en el periodo' },
      { titulo: 'Mayor', valor: filas[0]?.categoria || '—', detalle: filas[0] ? PEN(filas[0].monto) : '' },
      { titulo: 'Promedio', valor: PEN_CORTO(lista.length ? total / lista.length : 0), detalle: 'Por movimiento' },
    ],
    grafico: {
      tipo: 'donut', altura: 340,
      series: filas.map(f => f.monto),
      opciones: {
        chart: { type: 'donut' },
        labels: filas.map(f => f.categoria),
        legend: { position: 'right' },
        theme: { mode: isDark.value ? 'dark' : 'light' },
        dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)} %` },
        tooltip: { theme: isDark.value ? 'dark' : 'light', y: { formatter: (v: number) => PEN(v) } },
      },
    },
  }
}

/* ── 7. Ventas por periodo ── */
function rVentasPeriodo() {
  const filas = meses.value.map(m => {
    const delMes = ingresos.value.filter(t => String(t.fecha).slice(0, 7) === m)
    const total = suma(delMes)
    return {
      periodo: m, operaciones: delMes.length, total: r2(total),
      ticket: r2(delMes.length ? total / delMes.length : 0),
      cobrado: r2(suma(delMes, 'monto_pagado')),
    }
  })
  const totalVentas = suma(filas, 'total')
  const totalOps = filas.reduce((s, f) => s + f.operaciones, 0)
  return {
    columnas: [
      { title: 'Periodo', key: 'periodo' }, { title: 'Operaciones', key: 'operaciones' },
      { title: 'Total vendido', key: 'total' }, { title: 'Ticket promedio', key: 'ticket' },
      { title: 'Cobrado', key: 'cobrado' },
    ],
    columnasMoneda: ['total', 'ticket', 'cobrado'],
    filas,
    resumen: [
      { titulo: 'Total vendido', valor: PEN_CORTO(totalVentas), detalle: `${totalOps} operaciones`, color: '#2e9e5b' },
      { titulo: 'Ticket promedio', valor: PEN_CORTO(totalOps ? totalVentas / totalOps : 0), detalle: 'Por operación' },
      { titulo: 'Cobrado', valor: PEN_CORTO(suma(filas, 'cobrado')), detalle: 'De lo vendido en el rango' },
      { titulo: 'Por cobrar', valor: PEN_CORTO(totalVentas - suma(filas, 'cobrado')), detalle: 'Saldo pendiente', color: '#f2a63b' },
    ],
    grafico: {
      tipo: 'bar', altura: 320,
      series: [
        { name: 'Vendido', type: 'column', data: filas.map(f => f.total) },
        { name: 'Cobrado', type: 'column', data: filas.map(f => f.cobrado) },
      ],
      opciones: {
        ...opcionesBase.value,
        colors: ['#5b8def', '#2e9e5b'],
        xaxis: { categories: meses.value.map(etiquetaMes) },
      },
    },
  }
}

/* ── 8. Rentabilidad por cliente ──
 * El costo directo solo se puede imputar cuando el gasto tiene cliente; los
 * gastos generales (alquiler, licencias) no se prorratean, y se dicen aparte
 * para que el margen no se lea como si fuera el resultado final.
 */
function rRentabilidad() {
  const porCliente: Record<string, { ing: number; cost: number; n: number }> = {}
  for (const t of ingresos.value) {
    const k = nombreCliente(t.cliente_id)
    if (!porCliente[k]) porCliente[k] = { ing: 0, cost: 0, n: 0 }
    porCliente[k].ing += Number(t.monto || 0)
    porCliente[k].n++
  }
  for (const t of egresos.value) {
    if (!t.cliente_id) continue
    const k = nombreCliente(t.cliente_id)
    if (!porCliente[k]) porCliente[k] = { ing: 0, cost: 0, n: 0 }
    porCliente[k].cost += Number(t.monto || 0)
  }
  const filas = Object.entries(porCliente)
    .map(([cliente, v]) => ({
      cliente, ingresos: r2(v.ing), costo_directo: r2(v.cost),
      margen: r2(v.ing - v.cost),
      margen_pct: v.ing ? `${Math.round((v.ing - v.cost) / v.ing * 1000) / 10} %` : '—',
      operaciones: v.n,
    }))
    .sort((a, b) => b.margen - a.margen)

  const gastoGeneral = r2(suma(egresos.value.filter(t => !t.cliente_id)))
  const totalIng = suma(filas, 'ingresos')
  const totalMargen = suma(filas, 'margen')
  return {
    columnas: [
      { title: 'Cliente', key: 'cliente' }, { title: 'Ingresos', key: 'ingresos' },
      { title: 'Costo directo', key: 'costo_directo' }, { title: 'Margen', key: 'margen' },
      { title: 'Margen %', key: 'margen_pct' }, { title: 'Operaciones', key: 'operaciones' },
    ],
    columnasMoneda: ['ingresos', 'costo_directo', 'margen'],
    filas,
    resumen: [
      { titulo: 'Ingresos', valor: PEN_CORTO(totalIng), detalle: `${filas.length} clientes`, color: '#2e9e5b' },
      { titulo: 'Margen directo', valor: PEN_CORTO(totalMargen),
        detalle: 'Sin repartir los gastos generales', color: totalMargen >= 0 ? '#2e9e5b' : '#e2564a' },
      { titulo: 'Gastos generales', valor: PEN_CORTO(gastoGeneral),
        detalle: 'Sin cliente asignado; no prorrateados', color: '#e2564a' },
      { titulo: 'Resultado', valor: PEN_CORTO(totalMargen - gastoGeneral),
        detalle: 'Margen directo − gastos generales',
        color: totalMargen - gastoGeneral >= 0 ? '#2e9e5b' : '#e2564a' },
    ],
    grafico: {
      tipo: 'bar', altura: Math.max(280, filas.length * 38 + 80),
      series: [
        { name: 'Ingresos', data: filas.map(f => f.ingresos) },
        { name: 'Costo directo', data: filas.map(f => f.costo_directo) },
      ],
      opciones: {
        ...opcionesBase.value,
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
        colors: ['#2e9e5b', '#e2564a'],
        xaxis: { categories: filas.map(f => f.cliente), labels: { formatter: (v: any) => PEN_CORTO(v) } },
      },
    },
  }
}

/* ── 9. Presupuesto vs. ejecución ── */
function rPresupuesto() {
  const enRango = (periodo: string) =>
    meses.value.some(m => m === periodo || m.startsWith(periodo))

  const filas = presupuestos.value
    .filter(p => enRango(p.periodo))
    .map(p => {
      const cats = p.category_id ? conDescendientes(p.category_id) : null
      const ejecutado = suma(movimientos.value
        .filter(t => t.tipo === p.tipo && !t.proyectado && t.estado !== 'anulado')
        .filter(t => String(t.fecha || '').slice(0, p.periodo.length) === p.periodo)
        .filter(t => !p.area_id || t.area_id === p.area_id)
        .filter(t => !cats || cats.has(t.category_id)))
      const monto = Number(p.monto || 0)
      return {
        concepto: p.nombre || nombreArea(p.area_id),
        periodo: p.periodo,
        tipo: p.tipo === 'egreso' ? 'Gasto' : 'Ingreso',
        area: nombreArea(p.area_id),
        presupuestado: r2(monto),
        ejecutado: r2(ejecutado),
        diferencia: r2(monto - ejecutado),
        avance: monto ? `${Math.round(ejecutado / monto * 1000) / 10} %` : '—',
      }
    })
    .sort((a, b) => b.presupuestado - a.presupuestado)

  const excedidas = filas.filter(f => f.diferencia < 0)
  return {
    columnas: [
      { title: 'Concepto', key: 'concepto' }, { title: 'Periodo', key: 'periodo' },
      { title: 'Tipo', key: 'tipo' }, { title: 'Área', key: 'area' },
      { title: 'Presupuestado', key: 'presupuestado' }, { title: 'Ejecutado', key: 'ejecutado' },
      { title: 'Diferencia', key: 'diferencia' }, { title: 'Avance', key: 'avance' },
    ],
    columnasMoneda: ['presupuestado', 'ejecutado', 'diferencia'],
    filas,
    resumen: [
      { titulo: 'Presupuestado', valor: PEN_CORTO(suma(filas, 'presupuestado')), detalle: `${filas.length} líneas` },
      { titulo: 'Ejecutado', valor: PEN_CORTO(suma(filas, 'ejecutado')), detalle: 'Real del periodo' },
      { titulo: 'Diferencia', valor: PEN_CORTO(suma(filas, 'diferencia')),
        detalle: 'Presupuestado − ejecutado',
        color: suma(filas, 'diferencia') >= 0 ? '#2e9e5b' : '#e2564a' },
      { titulo: 'Excedidas', valor: String(excedidas.length), detalle: 'Líneas por encima del presupuesto',
        color: excedidas.length ? '#e2564a' : undefined },
    ],
    grafico: filas.length ? {
      tipo: 'bar', altura: Math.max(280, filas.length * 40 + 80),
      series: [
        { name: 'Presupuestado', data: filas.map(f => f.presupuestado) },
        { name: 'Ejecutado', data: filas.map(f => f.ejecutado) },
      ],
      opciones: {
        ...opcionesBase.value,
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
        colors: ['#5b8def', '#e2564a'],
        xaxis: { categories: filas.map(f => f.concepto), labels: { formatter: (v: any) => PEN_CORTO(v) } },
      },
    } : null,
  }
}

/* ── 10. Movimientos de caja ── */
function rCaja() {
  const sesionesEnRango = cajaSesiones.value.filter(s => {
    const f = String(s.fecha_apertura || '').slice(0, 10)
    return f >= fDesde.value && f <= fHasta.value
  })
  const filas = sesionesEnRango.map(s => {
    const movs = cajaMovimientos.value.filter(m => m.sesion_id === s.id)
    const ent = suma(movs.filter(m => m.tipo === 'ingreso'))
    const sal = suma(movs.filter(m => m.tipo !== 'ingreso'))
    return {
      caja: s.nombre || 'Caja',
      apertura: fechaCorta(s.fecha_apertura),
      cierre: s.fecha_cierre ? fechaCorta(s.fecha_cierre) : 'Abierta',
      responsable: nombreColaborador(s.cerrada_por || s.abierta_por),
      saldo_inicial: r2(Number(s.saldo_inicial || 0)),
      ingresos: r2(ent), salidas: r2(sal),
      saldo_final: r2(Number(s.saldo_inicial || 0) + ent - sal),
      contado: r2(Number(s.saldo_contado || 0)),
      diferencia: r2(Number(s.diferencia || 0)),
      movimientos: movs.length,
    }
  })
  const conDif = filas.filter(f => f.diferencia !== 0)
  return {
    columnas: [
      { title: 'Caja', key: 'caja' }, { title: 'Apertura', key: 'apertura' },
      { title: 'Cierre', key: 'cierre' }, { title: 'Responsable', key: 'responsable' },
      { title: 'Inicial', key: 'saldo_inicial' }, { title: 'Ingresos', key: 'ingresos' },
      { title: 'Salidas', key: 'salidas' }, { title: 'Saldo final', key: 'saldo_final' },
      { title: 'Contado', key: 'contado' }, { title: 'Diferencia', key: 'diferencia' },
      { title: 'Movs.', key: 'movimientos' },
    ],
    columnasMoneda: ['saldo_inicial', 'ingresos', 'salidas', 'saldo_final', 'contado', 'diferencia'],
    filas,
    resumen: [
      { titulo: 'Sesiones', valor: String(filas.length), detalle: 'En el rango de fechas' },
      { titulo: 'Ingresos de caja', valor: PEN_CORTO(suma(filas, 'ingresos')), detalle: 'Efectivo recibido', color: '#2e9e5b' },
      { titulo: 'Salidas de caja', valor: PEN_CORTO(suma(filas, 'salidas')), detalle: 'Efectivo entregado', color: '#e2564a' },
      { titulo: 'Descuadres', valor: String(conDif.length),
        detalle: conDif.length ? `Neto: ${PEN(suma(conDif, 'diferencia'))}` : 'Todas cuadradas',
        color: conDif.length ? '#e2564a' : '#2e9e5b' },
    ],
    grafico: null,
  }
}

/* ── 11. Movimientos bancarios ──
 * Todo lo que no fue efectivo: los pagos reales, no los documentos.
 */
function rBancarios() {
  const esBanco = (m: string) => !!m && !/efectivo/i.test(m)
  const idsEnRango = new Set(movimientos.value.map(t => t.id))
  const filas = pagos.value
    .filter(p => idsEnRango.has(p.transaction_id))
    .filter(p => esBanco(p.payment_method))
    .filter(p => {
      const f = String(p.fecha || '').slice(0, 10)
      return f >= fDesde.value && f <= fHasta.value
    })
    .map(p => {
      const t = transacciones.value.find(x => x.id === p.transaction_id)
      const esEntrada = t?.tipo === 'ingreso'
      return {
        fecha: fechaCorta(p.fecha),
        _fecha: String(p.fecha).slice(0, 10),
        tipo: esEntrada ? 'Entrada' : 'Salida',
        concepto: t?.concepto || '—',
        tercero: esEntrada ? nombreCliente(t?.cliente_id) : nombreProveedor(t?.proveedor_id),
        metodo: p.payment_method,
        referencia: p.referencia || '—',
        entrada: esEntrada ? r2(Number(p.monto || 0)) : 0,
        salida: esEntrada ? 0 : r2(Number(p.monto || 0)),
        registro: nombreColaborador(p.registrado_por),
      }
    })
    .sort((a, b) => b._fecha.localeCompare(a._fecha))

  return {
    columnas: [
      { title: 'Fecha', key: 'fecha' }, { title: 'Tipo', key: 'tipo' },
      { title: 'Concepto', key: 'concepto' }, { title: 'Cliente / proveedor', key: 'tercero' },
      { title: 'Método', key: 'metodo' }, { title: 'Referencia', key: 'referencia' },
      { title: 'Entrada', key: 'entrada' }, { title: 'Salida', key: 'salida' },
      { title: 'Registró', key: 'registro' },
    ],
    columnasMoneda: ['entrada', 'salida'],
    filas,
    resumen: [
      { titulo: 'Entradas', valor: PEN_CORTO(suma(filas, 'entrada')), detalle: 'Cobros por banco', color: '#2e9e5b' },
      { titulo: 'Salidas', valor: PEN_CORTO(suma(filas, 'salida')), detalle: 'Pagos por banco', color: '#e2564a' },
      { titulo: 'Neto', valor: PEN_CORTO(suma(filas, 'entrada') - suma(filas, 'salida')), detalle: 'Entradas − salidas' },
      { titulo: 'Operaciones', valor: String(filas.length), detalle: 'Movimientos bancarios' },
    ],
    grafico: null,
  }
}

/* ── 12. Reporte de impuestos ── */
function rImpuestos() {
  const detalleDe = (t: any, codigo: string) =>
    (Array.isArray(t.impuestos_detalle) ? t.impuestos_detalle : [])
      .filter((d: any) => d.codigo === codigo)
      .reduce((s: number, d: any) => s + Number(d.monto || 0), 0)

  const filas = meses.value.map(m => {
    const ing = ingresos.value.filter(t => String(t.fecha).slice(0, 7) === m)
    const egr = egresos.value.filter(t => String(t.fecha).slice(0, 7) === m)
    const igvVentas = ing.reduce((s, t) => s + detalleDe(t, 'igv'), 0)
    const igvCompras = egr.reduce((s, t) => s + detalleDe(t, 'igv'), 0)
    const detraccion = ing.reduce((s, t) => s + detalleDe(t, 'detraccion'), 0)
    const renta = egr.reduce((s, t) => s + detalleDe(t, 'renta'), 0)
    return {
      periodo: m,
      base_ventas: r2(suma(ing, 'subtotal')),
      igv_ventas: r2(igvVentas),
      base_compras: r2(suma(egr, 'subtotal')),
      igv_compras: r2(igvCompras),
      igv_a_pagar: r2(igvVentas - igvCompras),
      detraccion: r2(detraccion),
      renta: r2(renta),
    }
  })
  return {
    columnas: [
      { title: 'Periodo', key: 'periodo' },
      { title: 'Base ventas', key: 'base_ventas' }, { title: 'IGV ventas', key: 'igv_ventas' },
      { title: 'Base compras', key: 'base_compras' }, { title: 'IGV compras', key: 'igv_compras' },
      { title: 'IGV a pagar', key: 'igv_a_pagar' },
      { title: 'Detracciones', key: 'detraccion' }, { title: 'Renta retenida', key: 'renta' },
    ],
    columnasMoneda: ['base_ventas', 'igv_ventas', 'base_compras', 'igv_compras',
      'igv_a_pagar', 'detraccion', 'renta'],
    filas,
    resumen: [
      { titulo: 'IGV ventas', valor: PEN_CORTO(suma(filas, 'igv_ventas')), detalle: 'Débito fiscal' },
      { titulo: 'IGV compras', valor: PEN_CORTO(suma(filas, 'igv_compras')), detalle: 'Crédito fiscal' },
      { titulo: 'IGV a pagar', valor: PEN_CORTO(suma(filas, 'igv_a_pagar')), detalle: 'Débito − crédito',
        color: suma(filas, 'igv_a_pagar') >= 0 ? '#e2564a' : '#2e9e5b' },
      { titulo: 'Detracciones', valor: PEN_CORTO(suma(filas, 'detraccion')), detalle: 'Depositadas por clientes' },
    ],
    grafico: {
      tipo: 'bar', altura: 300,
      series: [
        { name: 'IGV ventas', data: filas.map(f => f.igv_ventas) },
        { name: 'IGV compras', data: filas.map(f => f.igv_compras) },
      ],
      opciones: {
        ...opcionesBase.value,
        colors: ['#e2564a', '#2e9e5b'],
        xaxis: { categories: meses.value.map(etiquetaMes) },
      },
    },
  }
}

/* ── 13. Reporte de comprobantes ── */
function rComprobantes() {
  const filas = facturas.value
    .filter(f => {
      const fe = String(f.fecha_emision || '').slice(0, 10)
      if (fe < fDesde.value || fe > fHasta.value) return false
      if (fCliente.value !== 'todos' && f.cliente_id !== fCliente.value) return false
      return true
    })
    .map(f => ({
      documento: `${f.serie}-${f.numero}`,
      tipo: f.tipo_comprobante === 1 ? 'Factura' : 'Boleta',
      cliente: f.cliente_nombre || '—',
      ruc: f.cliente_ruc || '—',
      emision: fechaCorta(f.fecha_emision),
      vencimiento: fechaCorta(f.fecha_vencimiento),
      subtotal: r2(Number(f.subtotal || 0)),
      igv: r2(Number(f.igv || 0)),
      total: r2(Number(f.total || 0)),
      detraccion: r2(Number(f.detraccion_monto || 0)),
      neto: r2(Number(f.con_detraccion ? f.neto_a_pagar : f.total) || 0),
      estado_doc: f.estado,
      sunat: f.aceptada_por_sunat ? 'Aceptada' : 'Pendiente',
    }))

  const anuladas = filas.filter(f => f.estado_doc === 'anulada')
  return {
    columnas: [
      { title: 'Documento', key: 'documento' }, { title: 'Tipo', key: 'tipo' },
      { title: 'Cliente', key: 'cliente' }, { title: 'RUC', key: 'ruc' },
      { title: 'Emisión', key: 'emision' }, { title: 'Vencimiento', key: 'vencimiento' },
      { title: 'Subtotal', key: 'subtotal' }, { title: 'IGV', key: 'igv' },
      { title: 'Total', key: 'total' }, { title: 'Detracción', key: 'detraccion' },
      { title: 'Neto', key: 'neto' }, { title: 'Estado', key: 'estado_doc' },
      { title: 'SUNAT', key: 'sunat' },
    ],
    columnasMoneda: ['subtotal', 'igv', 'total', 'detraccion', 'neto'],
    filas,
    resumen: [
      { titulo: 'Comprobantes', valor: String(filas.length), detalle: `${anuladas.length} anulados` },
      { titulo: 'Total facturado', valor: PEN_CORTO(suma(filas.filter(f => f.estado_doc !== 'anulada'), 'total')),
        detalle: 'Sin contar los anulados' },
      { titulo: 'IGV', valor: PEN_CORTO(suma(filas.filter(f => f.estado_doc !== 'anulada'), 'igv')),
        detalle: 'Del total emitido' },
      { titulo: 'Detracciones', valor: PEN_CORTO(suma(filas, 'detraccion')), detalle: 'Retenidas por el cliente' },
    ],
    grafico: null,
  }
}

/* ══════════ Exportar ══════════ */
function exportarCSV() {
  const cols = columnas.value
  const cabecera = cols.map((c: any) => `"${c.title}"`).join(';')
  const cuerpo = filas.value.map((f: any) =>
    cols.map((c: any) => {
      const v = f[c.key]
      // Punto decimal y sin separador de miles: así Excel en es-PE lo lee como número
      if (typeof v === 'number') return String(v)
      return `"${String(v ?? '').replace(/"/g, '""')}"`
    }).join(';')
  ).join('\n')

  // BOM para que Excel respete las tildes
  const blob = new Blob(['﻿' + cabecera + '\n' + cuerpo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `piola-${reporteId.value}-${fDesde.value}-a-${fHasta.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
  emit('notify', 'Reporte exportado')
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.filtros-bar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px;
}
.filtros-bar .filtro { flex: 1 1 150px; min-width: 140px; max-width: 200px; }
.filtros-bar .filtro-ancho { flex: 2 1 240px; max-width: 300px; }
.filtros-bar .filtro-fecha { flex: 0 1 145px; min-width: 135px; }

.reporte-descripcion {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px; opacity: .65;
  margin-bottom: 18px; padding-left: 2px;
}
</style>
