<!--
  Trade Cars — Histórico de Compras/Ventas (14/09/2026)
  --------------------------------------------------------
  Reemplaza el módulo "Compras" (antes mostraba `tradecars_compras`, casi
  vacía) por la tabla REAL de operaciones cerradas: `tradecars_data_historico_
  compras_ventas`, la misma que usa el Tasador IA como comparables
  (`buscar_comparables_historicos`). No es una copia — es la misma tabla,
  ahora también visible y editable desde acá.

  Va todo por server/api/tradecars/historico.{get,post}.ts porque esta tabla
  NO tiene policy `anon` (a propósito, para no exponer precios de compra al
  navegador sin pasar por el servidor) — a diferencia del resto de TradeCars,
  que lee/escribe Supabase directo desde el cliente.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Compras y Ventas — Histórico</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" @click="abrirFicha()">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo registro</span>
        </button>
        <button class="btn-primary" @click="cargar">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Esta es la misma tabla que usa el <b>Tasador IA</b> para sus comparables — lo que edites
        o agregues acá entra en la próxima tasación. Viene del histórico real de operaciones
        (hoja "VENTAS" del Excel de la empresa), no de datos de prueba.
      </v-alert>

      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Registros ({{ filasFiltradas.length }} de {{ filas.length }})</span>
          <v-spacer />
          <v-text-field v-model="buscar" prepend-inner-icon="mdi-magnify"
            placeholder="Buscar por placa, marca, modelo, cliente o vendedor..."
            density="compact" hide-details style="max-width: 320px;" />
        </v-card-title>
        <!-- Son ~45 columnas — el pedido fue verlas TODAS, así que la tabla es ancha
             a propósito y sólo ella scrollea horizontal (no la página entera). -->
        <div class="hcv-scroll">
          <v-data-table :headers="headers" :items="filasFiltradas" :loading="cargando"
            class="elevation-0" no-data-text="No hay registros" :items-per-page="25"
            fixed-header height="600" @click:row="(_: any, r: any) => abrirFicha(r.item)">
            <template v-slot:item.fecha_venta="{ item }">{{ fechaCorta(item.fecha_venta) }}</template>
            <template v-slot:item.fecha_compra="{ item }">{{ fechaCorta(item.fecha_compra) }}</template>
            <template v-slot:item.valor_compra_usd="{ item }">{{ dinero(item.valor_compra_usd) }}</template>
            <template v-slot:item.igv_compra_usd="{ item }">{{ dinero(item.igv_compra_usd) }}</template>
            <template v-slot:item.adquisicion_usd="{ item }">{{ dinero(item.adquisicion_usd) }}</template>
            <template v-slot:item.comision_compra_usd="{ item }">{{ dinero(item.comision_compra_usd) }}</template>
            <template v-slot:item.gastos_extras_usd="{ item }">{{ dinero(item.gastos_extras_usd) }}</template>
            <template v-slot:item.costo_total_usd="{ item }">{{ dinero(item.costo_total_usd) }}</template>
            <template v-slot:item.notariales_usd="{ item }">{{ dinero(item.notariales_usd) }}</template>
            <template v-slot:item.costo_total_notariales_usd="{ item }">{{ dinero(item.costo_total_notariales_usd) }}</template>
            <template v-slot:item.precio_venta_usd="{ item }">{{ dinero(item.precio_venta_usd) }}</template>
            <template v-slot:item.precio_facturacion_usd="{ item }">{{ dinero(item.precio_facturacion_usd) }}</template>
            <template v-slot:item.valor_venta_usd="{ item }">{{ dinero(item.valor_venta_usd) }}</template>
            <template v-slot:item.comision_de_venta_usd="{ item }">{{ dinero(item.comision_de_venta_usd) }}</template>
            <template v-slot:item.igv_venta_usd="{ item }">{{ dinero(item.igv_venta_usd) }}</template>
            <template v-slot:item.revenue_usd="{ item }">{{ dinero(item.revenue_usd) }}</template>
            <template v-slot:item.margen_bruto_usd="{ item }">
              <span :class="Number(item.margen_bruto_usd) < 0 ? 'text-error' : 'text-success'">
                {{ dinero(item.margen_bruto_usd) }}
              </span>
            </template>
            <template v-slot:item.margen_bruto_pct="{ item }">{{ porcentaje(item.margen_bruto_pct) }}</template>
            <template v-slot:item.margen_sin_igv_pct="{ item }">{{ porcentaje(item.margen_sin_igv_pct) }}</template>
            <template v-slot:item.margen_sin_igv_usd="{ item }">{{ dinero(item.margen_sin_igv_usd) }}</template>
            <template v-slot:item.margen_sin_igv_limpio_usd="{ item }">{{ dinero(item.margen_sin_igv_limpio_usd) }}</template>
            <template v-slot:item.pendiente_de_cobro_usd="{ item }">{{ dinero(item.pendiente_de_cobro_usd) }}</template>
            <template v-slot:item.acciones="{ item }">
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error"
                @click.stop="eliminar(item)" />
            </template>
          </v-data-table>
        </div>
      </v-card>
    </div>

    <!-- ══════════ FICHA (crear / editar) ══════════ -->
    <v-dialog :model-value="!!ficha" max-width="900" scrollable @update:model-value="ficha = null">
      <v-card v-if="ficha">
        <v-card-title class="pt-4">
          {{ ficha.id ? `${ficha.marca || ''} ${ficha.modelo || ''} — ${ficha.placa || 'sin placa'}` : 'Nuevo registro' }}
        </v-card-title>
        <v-card-text>
          <div class="form-section-title">Vehículo</div>
          <div class="form-grid-3">
            <v-text-field v-model="ficha.placa" label="Placa" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.marca" label="Marca" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.modelo" label="Modelo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.version" label="Versión" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.anio_fab" label="Año" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.km" type="number" label="Kilometraje" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.color" label="Color" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.tipo_vehiculo" label="Tipo de vehículo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.combustible" label="Combustible" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.transmision" label="Transmisión" density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title mt-4">Compra</div>
          <div class="form-grid-3">
            <v-text-field v-model="ficha.fecha_compra" type="date" label="Fecha de compra" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.canal_compra" label="Canal de compra" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.tipo_compra_retoma" label="Tipo (compra / retoma)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.tipo_compra" label="Tipo de compra" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.valor_compra_usd" type="number" label="Valor de compra (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.igv_compra_usd" type="number" label="IGV compra (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.adquisicion_usd" type="number" label="Adquisición (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.comision_compra_usd" type="number" label="Comisión compra (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.gastos_extras_usd" type="number" label="Gastos extras (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.costo_total_usd" type="number" label="Costo total (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.notariales_usd" type="number" label="Notariales (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.costo_total_notariales_usd" type="number" label="Costo total + notariales (USD)" density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title mt-4">Venta</div>
          <div class="form-grid-3">
            <v-text-field v-model="ficha.fecha_venta" type="date" label="Fecha de venta" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.vendedor" label="Vendedor" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.canal_venta" label="Canal de venta" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.cliente" label="Cliente" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.referido_venta" label="Referido" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.precio_venta_usd" type="number" label="Precio de venta (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.precio_facturacion_usd" type="number" label="Precio de facturación (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.valor_venta_usd" type="number" label="Valor de venta (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.comision_de_venta_usd" type="number" label="Comisión de venta (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.igv_venta_usd" type="number" label="IGV venta (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.revenue_usd" type="number" label="Revenue (USD)" density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title mt-4">Márgenes</div>
          <div class="form-grid-3">
            <v-text-field v-model.number="ficha.margen_bruto_usd" type="number" label="Margen bruto (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.margen_bruto_pct" type="number" step="0.0001" label="Margen bruto (%, ej. 0.10 = 10%)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.margen_sin_igv_pct" type="number" step="0.0001" label="Margen sin IGV (%)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.margen_sin_igv_usd" type="number" label="Margen sin IGV (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.margen_sin_igv_limpio_usd" type="number" label="Margen sin IGV limpio (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.dias_inventario" type="number" label="Días de inventario" density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title mt-4">Otros</div>
          <div class="form-grid-3">
            <v-text-field v-model="ficha.notaria" label="Notaría" density="compact" hide-details variant="outlined" />
            <v-select v-model="ficha.cancelado" :items="['SI', 'NO']" label="Cancelado" density="compact" hide-details variant="outlined" clearable />
            <v-text-field v-model="ficha.en_cuenta_de_tdc" label="En cuenta de TDC" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.detalle_operacion_abono" label="Detalle operación abono" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="ficha.pendiente_de_cobro_usd" type="number" label="Pendiente de cobro (USD)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.comprado_por" label="Comprado por" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.status_notarial" label="Status notarial" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.numero_factura" label="N° factura" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.numero_venta" label="N° venta" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.semana" label="Semana" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="ficha.a_nombre_de" label="A nombre de" density="compact" hide-details variant="outlined" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="ficha.id" color="error" variant="text" @click="eliminar(ficha)">Eliminar</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="ficha = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardar">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{ (e: 'notificar', texto: string, color?: string): void }>()
const notify = (texto: string, color = 'success') => emit('notificar', texto, color)

const filas = ref<any[]>([])
const cargando = ref(false)
const buscar = ref('')

async function apiHistorico<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const data = await $fetch<T>('/api/tradecars/historico', { method: 'POST', body })
    return { data, error: null }
  } catch (e: any) {
    const message = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message
      || 'No se pudo completar la operación'
    return { data: null, error: { message: String(message) } }
  }
}

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ ok: boolean; filas: any[] }>('/api/tradecars/historico')
    filas.value = res.filas || []
  } catch (e: any) {
    notify(`Error cargando: ${e?.data?.statusMessage || e?.message || 'error'}`, 'error')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

const filasFiltradas = computed(() => {
  if (!buscar.value.trim()) return filas.value
  const q = buscar.value.toLowerCase()
  return filas.value.filter(f => [f.placa, f.marca, f.modelo, f.cliente, f.vendedor]
    .some(x => String(x ?? '').toLowerCase().includes(q)))
})

// Pedido explícito: se ven TODAS las columnas de la tabla, no un resumen —
// las únicas que se excluyen son las de auditoría/sincronización que nadie
// llena a mano (id, created_at, sincronizado_en, actualizado_en/por,
// import_batch_id, sheet_row_id, origen_ultimo_cambio), mismo criterio que
// los campos editables de server/api/tradecars/historico.post.ts.
const NUM_END = { align: 'end' as const, sortable: true }
const headers = [
  { title: 'Placa', key: 'placa' },
  { title: 'Concat', key: 'concat' },
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Versión', key: 'version' },
  { title: 'Año', key: 'anio_fab' },
  { title: 'KM', key: 'km', ...NUM_END },
  { title: 'Color', key: 'color' },
  { title: 'Tipo vehículo', key: 'tipo_vehiculo' },
  { title: 'Combustible', key: 'combustible' },
  { title: 'Transmisión', key: 'transmision' },

  { title: 'Fecha compra', key: 'fecha_compra' },
  { title: 'Canal compra', key: 'canal_compra' },
  { title: 'Tipo (compra/retoma)', key: 'tipo_compra_retoma' },
  { title: 'Tipo de compra', key: 'tipo_compra' },
  { title: 'Valor compra', key: 'valor_compra_usd', ...NUM_END },
  { title: 'IGV compra', key: 'igv_compra_usd', ...NUM_END },
  { title: 'Adquisición', key: 'adquisicion_usd', ...NUM_END },
  { title: 'Comisión compra', key: 'comision_compra_usd', ...NUM_END },
  { title: 'Gastos extras', key: 'gastos_extras_usd', ...NUM_END },
  { title: 'Costo total', key: 'costo_total_usd', ...NUM_END },
  { title: 'Notariales', key: 'notariales_usd', ...NUM_END },
  { title: 'Costo total + notariales', key: 'costo_total_notariales_usd', ...NUM_END },

  { title: 'Fecha venta', key: 'fecha_venta' },
  { title: 'Vendedor', key: 'vendedor' },
  { title: 'Canal venta', key: 'canal_venta' },
  { title: 'Cliente', key: 'cliente' },
  { title: 'Referido', key: 'referido_venta' },
  { title: 'Precio venta', key: 'precio_venta_usd', ...NUM_END },
  { title: 'Precio facturación', key: 'precio_facturacion_usd', ...NUM_END },
  { title: 'Valor venta', key: 'valor_venta_usd', ...NUM_END },
  { title: 'Comisión venta', key: 'comision_de_venta_usd', ...NUM_END },
  { title: 'IGV venta', key: 'igv_venta_usd', ...NUM_END },
  { title: 'Revenue', key: 'revenue_usd', ...NUM_END },

  { title: 'Margen bruto', key: 'margen_bruto_usd', ...NUM_END },
  { title: 'Margen bruto %', key: 'margen_bruto_pct', ...NUM_END },
  { title: 'Margen sin IGV %', key: 'margen_sin_igv_pct', ...NUM_END },
  { title: 'Margen sin IGV', key: 'margen_sin_igv_usd', ...NUM_END },
  { title: 'Margen sin IGV limpio', key: 'margen_sin_igv_limpio_usd', ...NUM_END },
  { title: 'Días inventario', key: 'dias_inventario', ...NUM_END },

  { title: 'Notaría', key: 'notaria' },
  { title: 'Cancelado', key: 'cancelado' },
  { title: 'En cuenta de TDC', key: 'en_cuenta_de_tdc' },
  { title: 'Cuenta 1', key: 'cuenta_1' },
  { title: 'Cuenta 2', key: 'cuenta_2' },
  { title: 'Detalle op. abono', key: 'detalle_operacion_abono' },
  { title: 'Pendiente de cobro', key: 'pendiente_de_cobro_usd', ...NUM_END },
  { title: 'Comprado por', key: 'comprado_por' },
  { title: 'Status notarial', key: 'status_notarial' },
  { title: 'N° factura', key: 'numero_factura' },
  { title: 'N° venta', key: 'numero_venta' },
  { title: 'Semana', key: 'semana' },
  { title: 'A nombre de', key: 'a_nombre_de' },

  { title: '', key: 'acciones', sortable: false, width: 50 },
]

function fechaCorta(v: any) {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  return y && m && d ? `${d}/${m}/${y}` : s
}
function dinero(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return '$ ' + Number(v).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function porcentaje(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return (Number(v) * 100).toFixed(1) + '%'
}

/* ══════════ Ficha (crear / editar) ══════════ */
const ficha = ref<any>(null)
const guardando = ref(false)

function abrirFicha(item?: any) {
  ficha.value = item
    ? { ...item, fecha_venta: item.fecha_venta?.slice(0, 10) || '', fecha_compra: item.fecha_compra?.slice(0, 10) || '' }
    : {
        placa: '', marca: '', modelo: '', version: '', anio_fab: '', km: null, color: '',
        tipo_vehiculo: '', combustible: '', transmision: '',
        fecha_compra: '', canal_compra: '', tipo_compra_retoma: '', tipo_compra: '',
        valor_compra_usd: null, igv_compra_usd: null, adquisicion_usd: null,
        comision_compra_usd: null, gastos_extras_usd: null, costo_total_usd: null,
        notariales_usd: null, costo_total_notariales_usd: null,
        fecha_venta: '', vendedor: '', canal_venta: '', cliente: '', referido_venta: '',
        precio_venta_usd: null, precio_facturacion_usd: null, valor_venta_usd: null,
        comision_de_venta_usd: null, igv_venta_usd: null, revenue_usd: null,
        margen_bruto_usd: null, margen_bruto_pct: null, margen_sin_igv_pct: null,
        margen_sin_igv_usd: null, margen_sin_igv_limpio_usd: null, dias_inventario: null,
        notaria: '', cancelado: null, en_cuenta_de_tdc: '', detalle_operacion_abono: '',
        pendiente_de_cobro_usd: null, comprado_por: '', status_notarial: '',
        numero_factura: '', numero_venta: '', semana: '', a_nombre_de: '',
      }
}

async function guardar() {
  const f = ficha.value
  if (!f.placa?.trim() && !f.marca?.trim()) {
    return notify('Al menos la placa o la marca son obligatorias', 'error')
  }
  guardando.value = true
  const { error } = await apiHistorico({ accion: f.id ? 'actualizar' : 'crear', ...f })
  guardando.value = false
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify(f.id ? 'Registro actualizado' : 'Registro creado')
  ficha.value = null
  await cargar()
}

async function eliminar(item: any) {
  if (!confirm(`¿Eliminar el registro de ${item.marca || ''} ${item.modelo || ''} (${item.placa || 'sin placa'})?`)) return
  const { error } = await apiHistorico({ accion: 'eliminar', id: item.id })
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify('Registro eliminado')
  ficha.value = null
  await cargar()
}
</script>

<style scoped>
.hcv-sub { font-size: 11px; opacity: .6; }

/* La tabla tiene ~45 columnas a propósito (se pidió ver todas) — sólo ella
   scrollea horizontal, nunca la página. */
.hcv-scroll { overflow-x: auto; }
.hcv-scroll :deep(table) { min-width: 2400px; }
.hcv-scroll :deep(td), .hcv-scroll :deep(th) { white-space: nowrap; }

.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}
.form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

@media (max-width: 780px) {
  .form-grid-3 { grid-template-columns: 1fr; }
}
</style>
