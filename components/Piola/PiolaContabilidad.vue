<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Contabilidad y Flujo de Caja</h1>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <v-select v-model="periodo" :items="periodos" density="compact" hide-details variant="outlined"
          style="min-width:140px;" />
        <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo('ingreso')">
          <v-icon icon="mdi-plus" size="16" /><span>Ingreso</span>
        </button>
        <button v-if="puedeCrear" class="btn-warning" @click="abrirNuevo('egreso')">
          <v-icon icon="mdi-minus" size="16" /><span>Egreso</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Este módulo <b>no reemplaza a Syscon</b>: aquí vive el flujo de caja real de Piola y sus proyecciones.
        La contabilidad formal y tributaria se sigue llevando en Syscon.
      </v-alert>

      <!-- KPIs -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Ingresos del mes</span>
            <div :class="['stat-change', varIngresos >= 0 ? 'up' : 'down']">
              {{ varIngresos >= 0 ? '▲' : '▼' }} {{ Math.abs(varIngresos) }} %
            </div>
          </div>
          <div class="stat-value">{{ PEN_CORTO(totales.ingresos) }}</div>
          <div class="stat-description">vs. {{ PEN_CORTO(totalesAnterior.ingresos) }} el mes anterior</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Egresos del mes</span>
            <div :class="['stat-change', varEgresos <= 0 ? 'up' : 'down']">
              {{ varEgresos >= 0 ? '▲' : '▼' }} {{ Math.abs(varEgresos) }} %
            </div>
          </div>
          <div class="stat-value">{{ PEN_CORTO(totales.egresos) }}</div>
          <div class="stat-description">vs. {{ PEN_CORTO(totalesAnterior.egresos) }} el mes anterior</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Flujo de caja</span></div>
          <div class="stat-value" :style="{ color: totales.flujo >= 0 ? '#2e9e5b' : '#e2564a' }">
            {{ PEN_CORTO(totales.flujo) }}
          </div>
          <div class="stat-description">Ingresos − egresos reales</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Flujo proyectado</span></div>
          <div class="stat-value">{{ PEN_CORTO(totales.flujo + totales.proy_ingresos - totales.proy_egresos) }}</div>
          <div class="stat-description">Incluye movimientos marcados como proyección</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'movimientos' }]" @click="tab = 'movimientos'">Movimientos</button>
          <button :class="['tab', { active: tab === 'cobrar' }]" @click="tab = 'cobrar'">Por cobrar</button>
          <button :class="['tab', { active: tab === 'pagar' }]" @click="tab = 'pagar'">Por pagar</button>
          <button :class="['tab', { active: tab === 'caja' }]" @click="tab = 'caja'">Caja</button>
          <button :class="['tab', { active: tab === 'presupuestos' }]" @click="tab = 'presupuestos'">Presupuestos</button>
          <button :class="['tab', { active: tab === 'flujo' }]" @click="tab = 'flujo'">Flujo mes a mes</button>
          <button :class="['tab', { active: tab === 'categorias' }]" @click="tab = 'categorias'">Categorías</button>
          <button :class="['tab', { active: tab === 'comisiones' }]" @click="tab = 'comisiones'">Comisiones</button>
        </div>

        <!-- ══════════ CUENTAS POR COBRAR / POR PAGAR ══════════ -->
        <PiolaCuentas v-if="tab === 'cobrar'" :perfil="perfil" tipo="ingreso"
          :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
          @notify="(p: any) => emit('notify', p)" @cambio="cargar" />
        <PiolaCuentas v-else-if="tab === 'pagar'" :perfil="perfil" tipo="egreso"
          :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
          @notify="(p: any) => emit('notify', p)" @cambio="cargar" />

        <!-- ══════════ CAJA ══════════ -->
        <PiolaCaja v-else-if="tab === 'caja'" :perfil="perfil"
          :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
          @notify="(p: any) => emit('notify', p)" @cambio="cargar" />

        <!-- ══════════ PRESUPUESTOS ══════════ -->
        <PiolaPresupuestos v-else-if="tab === 'presupuestos'" :perfil="perfil"
          :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
          @notify="(p: any) => emit('notify', p)" />

        <!-- ══════════ MOVIMIENTOS ══════════ -->
        <v-card v-else-if="tab === 'movimientos'" flat class="custom-data-table">
          <div class="filtros-bar">
            <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify" placeholder="Concepto, proveedor…"
              density="compact" hide-details variant="outlined" clearable class="filtro filtro-buscar" />
            <v-select v-model="fTipo" :items="['todos', 'ingreso', 'egreso']" density="compact" hide-details
              variant="outlined" label="Tipo" class="filtro" />
            <v-select v-model="fCategoria" :items="opcionesCategoriaFiltro" density="compact" hide-details
              variant="outlined" label="Categoría" class="filtro" />
          </div>
          <v-data-table :headers="headersTx" :items="movimientosFiltrados" :loading="cargando" class="elevation-0"
            no-data-text="Sin movimientos en este periodo" :items-per-page="25">
            <template v-slot:item.tipo="{ item }">
              <v-chip size="x-small" variant="flat" :color="item.tipo === 'ingreso' ? 'success' : 'error'">
                {{ item.tipo }}
              </v-chip>
            </template>
            <template v-slot:item.category_id="{ item }">{{ rutaCategoria(item.category_id) }}</template>
            <template v-slot:item.monto="{ item }">
              <span :style="{ color: item.tipo === 'ingreso' ? '#2e9e5b' : '#e2564a', fontWeight: 600 }">
                {{ item.tipo === 'ingreso' ? '+' : '−' }}{{ PEN(item.monto) }}
              </span>
            </template>
            <template v-slot:item.fecha="{ item }">{{ fechaCorta(item.fecha) }}</template>
            <template v-slot:item.fecha_vencimiento="{ item }">
              <span v-if="item.fecha_vencimiento">{{ fechaCorta(item.fecha_vencimiento) }}</span>
              <span v-else style="opacity:.35">—</span>
            </template>
            <template v-slot:item.precio="{ item }">
              <span v-if="item.precio">{{ PEN(item.precio) }}</span>
              <span v-else style="opacity:.35">—</span>
            </template>
            <template v-slot:item.cantidad="{ item }">
              <span v-if="item.cantidad">{{ item.cantidad }}</span>
              <span v-else style="opacity:.35">—</span>
            </template>
            <template v-slot:item.estado="{ item }">
              <v-chip size="x-small" variant="flat" :color="colorEstadoMovimiento(item.estado)">
                {{ etiquetaEstado(item.estado) }}
              </v-chip>
            </template>
            <template v-slot:item.proyectado="{ item }">
              <v-icon v-if="item.proyectado" icon="mdi-chart-timeline-variant" size="16" title="Proyección" />
            </template>
            <template v-slot:item.acciones="{ item }">
              <v-btn v-if="puedeEditar" icon="mdi-pencil" size="x-small" variant="text" @click="editar(item)" />
              <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
                @click="eliminar(item)" />
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ FLUJO MES A MES ══════════ -->
        <div v-else-if="tab === 'flujo'">
          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Flujo de caja</h2>
                <div class="chart-subtitle">
                  Ingresos, egresos, flujo del mes y saldo acumulado de los últimos 12 meses
                </div>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="bar" height="330" :options="opcionesChart" :series="seriesChart" />
              </client-only>
            </div>
          </div>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Egresos por categoría — {{ periodo }}</span>
            </v-card-title>
            <v-data-table :headers="headersCat" :items="egresosPorCategoria" class="elevation-0"
              no-data-text="Sin egresos este mes" :items-per-page="20">
              <template v-slot:item.monto="{ item }">{{ PEN(item.monto) }}</template>
              <template v-slot:item.porcentaje="{ item }">
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="barra"><div class="barra-fill" :style="{ width: item.porcentaje + '%' }" /></div>
                  <span style="font-size:12px; min-width:42px;">{{ item.porcentaje }} %</span>
                </div>
              </template>
            </v-data-table>
          </v-card>
        </div>

        <!-- ══════════ CATEGORÍAS JERÁRQUICAS ══════════ -->
        <v-card v-else-if="tab === 'categorias'" flat class="custom-data-table" style="padding: 20px;">
          <v-alert type="success" variant="tonal" density="compact" class="mb-4">
            Las categorías son <b>carpetas y subcarpetas</b>, sin límite de niveles, y se administran desde aquí:
            agregar el gasto operativo N.º 31 no requiere una nueva reunión con desarrollo.
          </v-alert>

          <div v-if="puedeEditar" class="cat-nueva">
            <v-text-field v-model="nuevaCat.nombre" label="Nombre de la categoría" density="compact"
              hide-details variant="outlined" @keyup.enter="crearCategoria" />
            <v-select v-model="nuevaCat.parent_id" :items="opcionesPadre" label="Dentro de (opcional)"
              density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="nuevaCat.tipo" :items="['egreso', 'ingreso', 'ambos']" label="Tipo"
              density="compact" hide-details variant="outlined" />
            <v-btn color="primary" variant="flat" :loading="guardandoCat" @click="crearCategoria">Agregar</v-btn>
          </div>

          <div class="arbol">
            <div v-for="c in categoriasPlanas" :key="c.id" class="arbol-fila"
              :style="{ paddingLeft: (c.nivel * 26) + 'px' }">
              <v-icon :icon="c.nivel === 0 ? 'mdi-folder' : 'mdi-subdirectory-arrow-right'" size="16"
                :style="{ opacity: c.nivel === 0 ? .8 : .5 }" />
              <template v-if="editandoCat === c.id">
                <v-text-field v-model="nombreEditado" density="compact" hide-details variant="outlined"
                  style="max-width:280px;" @keyup.enter="renombrarCategoria(c)" />
                <v-btn size="x-small" color="primary" variant="flat" @click="renombrarCategoria(c)">Guardar</v-btn>
                <v-btn size="x-small" variant="text" @click="editandoCat = null">Cancelar</v-btn>
              </template>
              <template v-else>
                <span class="arbol-nombre" :class="{ inactiva: !c.activo }">{{ c.nombre }}</span>
                <v-chip size="x-small" variant="tonal" class="ml-1">{{ c.tipo }}</v-chip>
                <span class="arbol-monto">{{ PEN(montoCategoria(c.id)) }}</span>
                <div class="arbol-acciones" v-if="puedeEditar">
                  <v-btn icon="mdi-plus" size="x-small" variant="text" title="Agregar subcategoría"
                    @click="nuevaCat.parent_id = c.id" />
                  <v-btn icon="mdi-pencil" size="x-small" variant="text" title="Renombrar"
                    @click="editandoCat = c.id; nombreEditado = c.nombre" />
                  <v-btn :icon="c.activo ? 'mdi-eye-off' : 'mdi-eye'" size="x-small" variant="text"
                    :title="c.activo ? 'Desactivar' : 'Reactivar'" @click="alternarCategoria(c)" />
                  <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
                    title="Eliminar" @click="eliminarCategoria(c)" />
                </div>
              </template>
            </div>
            <div v-if="!categoriasPlanas.length" style="opacity:.5; padding:20px; text-align:center;">
              Todavía no hay categorías.
            </div>
          </div>
        </v-card>

        <!-- ══════════ COMISIONES ══════════ -->
        <v-card v-else-if="tab === 'comisiones'" flat class="custom-data-table">
          <v-alert type="warning" variant="tonal" density="compact" class="ma-4 mb-2">
            La <b>fórmula exacta del acuerdo con Héctor sigue pendiente</b> de Piola. Hoy se calcula
            <code>producción cerrada × % del colaborador</code> (el % se configura en su ficha) y se programa
            el pago para el <b>15 del mes siguiente</b>. Cuando llegue el documento se ajusta solo el cálculo.
          </v-alert>
          <div class="filtros-bar">
            <v-btn v-if="puedeEditar" color="primary" variant="flat" :loading="calculandoComisiones"
              @click="calcularComisiones">
              <v-icon icon="mdi-calculator" start /> Calcular comisiones de {{ periodo }}
            </v-btn>
          </div>
          <v-data-table :headers="headersComision" :items="comisiones" class="elevation-0"
            no-data-text="Sin comisiones calculadas" :items-per-page="20">
            <template v-slot:item.base_produccion="{ item }">{{ PEN(item.base_produccion) }}</template>
            <template v-slot:item.pct="{ item }">{{ item.pct }} %</template>
            <template v-slot:item.monto="{ item }">
              <strong>{{ PEN(item.monto) }}</strong>
            </template>
            <template v-slot:item.fecha_pago="{ item }">{{ fechaCorta(item.fecha_pago) }}</template>
            <template v-slot:item.estado="{ item }">
              <v-select :model-value="item.estado" :items="['pendiente', 'aprobada', 'pagada', 'anulada']"
                density="compact" hide-details variant="plain" :disabled="!puedeEditar"
                @update:model-value="(v: any) => cambiarEstadoComision(item, v)" style="max-width:130px;" />
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>

    <!-- ══════════ DIÁLOGO DE MOVIMIENTO ══════════ -->
    <v-dialog :model-value="!!movimiento" max-width="820" scrollable @update:model-value="movimiento = null">
      <v-card v-if="movimiento">
        <v-card-title class="pt-4">
          {{ movimiento.id ? 'Editar' : 'Nuevo' }} {{ movimiento.tipo }}
        </v-card-title>
        <v-card-text>
          <div class="form-section-title">Datos generales</div>
          <div class="form-grid">
            <v-select v-model="movimiento.tipo" :items="['ingreso', 'egreso']" label="Tipo"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="movimiento.fecha" type="date" label="Fecha"
              density="compact" hide-details variant="outlined" @update:model-value="recalcularVencimiento" />
            <v-text-field v-model="movimiento.concepto" label="Concepto *" density="compact"
              hide-details variant="outlined" class="col-2" />
            <v-select v-model="movimiento.category_id" :items="opcionesCategoriaForm" label="Categoría"
              density="compact" hide-details variant="outlined" />
            <v-select v-if="movimiento.tipo === 'ingreso'" v-model="movimiento.cliente_id"
              :items="opcionesCliente" label="Cliente" density="compact" hide-details
              variant="outlined" clearable />
            <v-select v-else v-model="movimiento.proveedor_id" :items="opcionesProveedor"
              label="Proveedor" density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="movimiento.area_id" :items="opcionesArea" label="Área"
              density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="movimiento.centro_costo_id" :items="opcionesCentroCosto"
              label="Centro de costo" density="compact" hide-details variant="outlined" clearable />
          </div>

          <div class="form-section-title" style="margin-top:18px;">Importes</div>
          <div class="form-grid">
            <v-text-field v-model.number="movimiento.precio" type="number" min="0"
              label="Precio unitario (S/)" density="compact" hide-details variant="outlined"
              @update:model-value="desdePrecioCantidad" />
            <v-text-field v-model.number="movimiento.cantidad" type="number" min="0" label="Cantidad"
              density="compact" hide-details variant="outlined" @update:model-value="desdePrecioCantidad" />
            <v-text-field v-model.number="movimiento.subtotal" type="number" min="0"
              label="Subtotal (S/) *" density="compact" variant="outlined"
              :readonly="usaPrecioCantidad" :hint="usaPrecioCantidad ? 'Precio × cantidad' : ' '"
              persistent-hint />
            <v-text-field v-model.number="movimiento.descuento" type="number" min="0"
              label="Descuento (S/)" density="compact" hide-details variant="outlined" />
          </div>

          <div class="impuestos-caja">
            <div class="impuestos-titulo">Impuestos</div>
            <div class="impuestos-lista">
              <v-checkbox v-for="imp in impuestosDisponibles" :key="imp.id"
                :model-value="movimiento.impuestos_sel.includes(imp.codigo)" color="primary"
                density="compact" hide-details
                :label="`${imp.nombre} (${imp.tasa} %)`"
                @update:model-value="() => alternarImpuesto(imp.codigo)" />
            </div>
            <div v-if="!impuestosDisponibles.length" class="sin-impuestos">
              No hay impuestos configurados para este tipo de movimiento.
            </div>
          </div>

          <div class="totales-caja">
            <div><span>Subtotal</span><strong>{{ PEN(totalesMov.subtotal) }}</strong></div>
            <div v-if="totalesMov.descuento">
              <span>Descuento</span><strong>− {{ PEN(totalesMov.descuento) }}</strong>
            </div>
            <div v-for="d in totalesMov.detalle" :key="d.codigo">
              <span>{{ d.nombre }} ({{ d.tasa }} %)</span>
              <strong>{{ d.comportamiento === 'retiene' ? '(−) ' : '' }}{{ PEN(d.monto) }}</strong>
            </div>
            <div class="tot-final"><span>Total</span><strong>{{ PEN(totalesMov.total) }}</strong></div>
            <div v-if="retenciones" class="tot-neto">
              <span>Neto a {{ movimiento.tipo === 'ingreso' ? 'recibir' : 'pagar' }}</span>
              <strong>{{ PEN(totalesMov.total - retenciones) }}</strong>
            </div>
          </div>

          <div class="form-section-title" style="margin-top:18px;">Documento y cobro</div>
          <div class="form-grid">
            <v-select v-model="movimiento.tipo_comprobante_id" :items="opcionesTipoComprobante"
              label="Tipo de comprobante" density="compact" hide-details variant="outlined" clearable />
            <div class="doc-numero">
              <v-text-field v-model="movimiento.documento_serie" label="Serie" density="compact"
                hide-details variant="outlined" style="max-width:110px;" />
              <v-text-field v-model="movimiento.documento_numero" label="Número" density="compact"
                hide-details variant="outlined" />
            </div>
            <v-select v-model="movimiento.condicion_pago_id" :items="opcionesCondicionPago"
              label="Condición de pago" density="compact" hide-details variant="outlined" clearable
              @update:model-value="recalcularVencimiento" />
            <v-text-field v-model="movimiento.fecha_vencimiento" type="date" label="Fecha de vencimiento"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="movimiento.payment_method" :items="metodosPago" label="Forma de pago"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="movimiento.responsable_email" :items="opcionesColaborador"
              :label="movimiento.tipo === 'ingreso' ? 'Vendedor / responsable' : 'Responsable'"
              density="compact" hide-details variant="outlined" clearable />
          </div>

          <v-alert v-if="movimiento.id && movimiento.monto_pagado > 0" type="info" variant="tonal"
            density="compact" class="mt-4">
            Este movimiento ya tiene <b>{{ PEN(movimiento.monto_pagado) }}</b> pagados.
            El estado se recalcula solo desde los pagos: se gestionan en
            <b>{{ movimiento.tipo === 'ingreso' ? 'Por cobrar' : 'Por pagar' }}</b>.
          </v-alert>

          <div class="form-section-title" style="margin-top:18px;">Comprobante adjunto</div>
          <PiolaSubirPdf v-model="movimiento.documento_adjunto" carpeta="comprobantes"
            label="Comprobante / documento (PDF)"
            @error="(m: string) => emit('notify', { text: m, color: 'error' })" />

          <v-checkbox v-model="movimiento.proyectado" color="primary" density="compact" hide-details
            label="Es una proyección (aún no ocurrió)" class="mt-2" />

          <v-textarea v-model="movimiento.notas" label="Observaciones" rows="2" density="compact"
            hide-details variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="movimiento = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarMovimiento">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Contabilidad y Flujo de Caja (§4).
 *
 * Lo importante del levantamiento:
 *   • NO reemplaza a Syscon — aquí va el flujo de caja real y las proyecciones.
 *   • Las categorías de gasto son JERÁRQUICAS y con CRUD completo en la UI:
 *     Edson agrega el gasto operativo N.º 31 sin llamar a desarrollo.
 *   • Método de pago: catálogo abierto pero hoy solo transferencia bancaria.
 *   • Comisiones del closer: % configurable, pago el 15 del mes siguiente.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, PEN_CORTO, fechaCorta, periodoActual, ultimosPeriodos, hoyISO,
  aplanarCategorias, categoriaRaiz, calcularTotalesMovimiento, sumarDiasISO,
  etiquetaEstado, colorEstadoMovimiento, traerTodo, apiPiola,
} from '@/composables/usePiola'
import PiolaCuentas from './PiolaCuentas.vue'
import PiolaCaja from './PiolaCaja.vue'
import PiolaPresupuestos from './PiolaPresupuestos.vue'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import type { ApexOptions } from 'apexcharts'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'contabilidad', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'contabilidad', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'contabilidad', 'delete'))

const tab = ref('movimientos')
const periodo = ref(periodoActual())
const periodos = ultimosPeriodos(18)
const cargando = ref(false)

const transacciones = ref<any[]>([])   // últimos 18 meses, para el gráfico
const categorias = ref<any[]>([])
const clientes = ref<any[]>([])
const metodosPago = ref<string[]>(['Transferencia bancaria'])
const comisiones = ref<any[]>([])

/* Catálogos de la configuración financiera */
const proveedores = ref<any[]>([])
const areas = ref<any[]>([])
const centrosCosto = ref<any[]>([])
const impuestos = ref<any[]>([])
const tiposComprobante = ref<any[]>([])
const condicionesPago = ref<any[]>([])
const colaboradores = ref<any[]>([])

const fBuscar = ref('')
const fTipo = ref('todos')
const fCategoria = ref<any>('todas')

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const desde = `${periodos[periodos.length - 1]}-01`
  const [t, c, cl, m, pr, ar, cc, im, tc, cp, col] = await Promise.all([
    traerTodo(() => client.from('piola_transactions').select('*').gte('fecha', desde)
      .order('fecha', { ascending: false }).order('id')),
    client.from('piola_expense_categories').select('*').order('orden'),
    client.from('piola_clientes').select('id, nombre').eq('activo', true).order('nombre'),
    client.from('piola_payment_methods').select('nombre').eq('activo', true).order('orden'),
    client.from('piola_proveedores').select('id, nombre, condicion_pago_id').eq('activo', true).order('nombre'),
    client.from('piola_areas').select('id, nombre').eq('activo', true).order('orden'),
    client.from('piola_centros_costo').select('id, nombre, codigo').eq('activo', true).order('orden'),
    client.from('piola_impuestos').select('*').eq('activo', true).order('orden'),
    client.from('piola_tipos_comprobante').select('*').eq('activo', true).order('orden'),
    client.from('piola_condiciones_pago').select('*').eq('activo', true).order('orden'),
    client.from('piola_colaboradores').select('email, nombre').eq('activo', true).order('nombre'),
  ])
  if (t.error) emit('notify', { text: `Error cargando movimientos: ${t.error.message}`, color: 'error' })
  transacciones.value = (t.data as any[]) || []
  categorias.value = (c.data as any[]) || []
  clientes.value = (cl.data as any[]) || []
  metodosPago.value = ((m.data as any[]) || []).map(x => x.nombre)
  if (!metodosPago.value.length) metodosPago.value = ['Transferencia bancaria']
  // Los catálogos de la migración 03 pueden no existir todavía: si fallan, el
  // módulo sigue funcionando con lo básico en vez de quedarse en blanco.
  proveedores.value = (pr.data as any[]) || []
  areas.value = (ar.data as any[]) || []
  centrosCosto.value = (cc.data as any[]) || []
  impuestos.value = (im.data as any[]) || []
  tiposComprobante.value = (tc.data as any[]) || []
  condicionesPago.value = (cp.data as any[]) || []
  colaboradores.value = (col.data as any[]) || []
  cargando.value = false
}

async function cargarComisiones() {
  try {
    const res = await $fetch<any>('/api/piola/comisiones', { params: { periodo: periodo.value } })
    comisiones.value = res.comisiones || []
  } catch (e: any) {
    comisiones.value = []
  }
}

watch(tab, (t) => { if (t === 'comisiones') cargarComisiones() })
watch(periodo, () => { if (tab.value === 'comisiones') cargarComisiones() })

/* ══════════ Derivados ══════════ */
const categoriasPlanas = computed(() => aplanarCategorias(categorias.value))
const rutaCategoria = (id: any) => categoriasPlanas.value.find(c => c.id === id)?.ruta || '—'

const opcionesCategoriaForm = computed(() =>
  categoriasPlanas.value.filter(c => c.activo).map(c => ({ value: c.id, title: c.ruta })))
const opcionesCategoriaFiltro = computed(() =>
  [{ value: 'todas', title: 'Todas las categorías' }, ...opcionesCategoriaForm.value])
const opcionesPadre = computed(() =>
  categoriasPlanas.value.map(c => ({ value: c.id, title: c.ruta })))
const opcionesCliente = computed(() => clientes.value.map(c => ({ value: c.id, title: c.nombre })))
const opcionesProveedor = computed(() => proveedores.value.map(p => ({ value: p.id, title: p.nombre })))
const opcionesArea = computed(() => areas.value.map(a => ({ value: a.id, title: a.nombre })))
const opcionesCentroCosto = computed(() =>
  centrosCosto.value.map(c => ({ value: c.id, title: c.codigo ? `${c.codigo} — ${c.nombre}` : c.nombre })))
const opcionesCondicionPago = computed(() =>
  condicionesPago.value.map(c => ({ value: c.id, title: c.nombre })))
const opcionesColaborador = computed(() =>
  colaboradores.value.map(c => ({ value: c.email, title: c.nombre })))
const opcionesTipoComprobante = computed(() => tiposComprobante.value
  .filter(t => !movimiento.value || ['ambos', movimiento.value.tipo].includes(t.aplica_a))
  .map(t => ({ value: t.id, title: t.nombre })))

/** Impuestos que aplican al tipo de movimiento que se está editando. */
const impuestosDisponibles = computed(() => impuestos.value
  .filter(i => !movimiento.value || ['ambos', movimiento.value.tipo].includes(i.aplica_a)))

const delPeriodo = computed(() =>
  transacciones.value.filter(t => String(t.fecha).slice(0, 7) === periodo.value))

const periodoAnterior = computed(() => {
  const [y, m] = periodo.value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
})

function calcularTotales(lista: any[]) {
  const reales = lista.filter(t => !t.proyectado)
  const proy = lista.filter(t => t.proyectado)
  const suma = (l: any[], tipo: string) =>
    l.filter(t => t.tipo === tipo).reduce((s, t) => s + Number(t.monto || 0), 0)
  const ingresos = suma(reales, 'ingreso')
  const egresos = suma(reales, 'egreso')
  return {
    ingresos, egresos, flujo: ingresos - egresos,
    proy_ingresos: suma(proy, 'ingreso'), proy_egresos: suma(proy, 'egreso'),
  }
}

const totales = computed(() => calcularTotales(delPeriodo.value))
const totalesAnterior = computed(() => calcularTotales(
  transacciones.value.filter(t => String(t.fecha).slice(0, 7) === periodoAnterior.value)))

const variacion = (act: number, ant: number) => ant ? Math.round((act - ant) / ant * 1000) / 10 : 0
const varIngresos = computed(() => variacion(totales.value.ingresos, totalesAnterior.value.ingresos))
const varEgresos = computed(() => variacion(totales.value.egresos, totalesAnterior.value.egresos))

const movimientosFiltrados = computed(() => {
  let lista = delPeriodo.value
  if (fTipo.value !== 'todos') lista = lista.filter(t => t.tipo === fTipo.value)
  if (fCategoria.value !== 'todas') lista = lista.filter(t => t.category_id === fCategoria.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(t => [t.concepto, t.proveedor, t.notas]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

/** Egresos del periodo agrupados por categoría RAÍZ (la jerarquía se colapsa). */
const egresosPorCategoria = computed(() => {
  const acc: Record<string, number> = {}
  for (const t of delPeriodo.value.filter(t => t.tipo === 'egreso' && !t.proyectado)) {
    const k = categoriaRaiz(categorias.value, t.category_id)
    acc[k] = (acc[k] || 0) + Number(t.monto || 0)
  }
  const total = Object.values(acc).reduce((s, v) => s + v, 0)
  return Object.entries(acc)
    .map(([categoria, monto]) => ({
      categoria, monto,
      porcentaje: total ? Math.round(monto / total * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.monto - a.monto)
})

/** Total gastado en una categoría, incluyendo todas sus subcategorías. */
function montoCategoria(id: number): number {
  const descendientes = new Set<number>([id])
  let creció = true
  while (creció) {
    creció = false
    for (const c of categorias.value) {
      if (c.parent_id && descendientes.has(c.parent_id) && !descendientes.has(c.id)) {
        descendientes.add(c.id); creció = true
      }
    }
  }
  return delPeriodo.value
    .filter(t => descendientes.has(t.category_id))
    .reduce((s, t) => s + Number(t.monto || 0), 0)
}

const headersTx = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Tipo', key: 'tipo' },
  { title: 'Concepto', key: 'concepto' },
  { title: 'Categoría', key: 'category_id' },
  { title: 'Proveedor / cliente', key: 'tercero', sortable: false,
    value: (t: any) => nombreTercero(t) },
  { title: 'Documento', key: 'documento', sortable: false,
    value: (t: any) => [t.documento_serie, t.documento_numero].filter(Boolean).join('-') || '—' },
  { title: 'Cant.', key: 'cantidad' },
  { title: 'Precio', key: 'precio' },
  { title: 'Total', key: 'monto' },
  { title: 'Vence', key: 'fecha_vencimiento' },
  { title: 'Estado', key: 'estado', sortable: false },
  { title: '', key: 'proyectado', sortable: false },
  { title: '', key: 'acciones', sortable: false },
]

/** Nombre del cliente o proveedor según el tipo. `proveedor` es el texto libre viejo. */
function nombreTercero(t: any): string {
  if (t.tipo === 'ingreso') {
    return clientes.value.find(c => c.id === t.cliente_id)?.nombre || t.proveedor || '—'
  }
  return proveedores.value.find(p => p.id === t.proveedor_id)?.nombre || t.proveedor || '—'
}
const headersCat = [
  { title: 'Categoría', key: 'categoria' },
  { title: 'Monto', key: 'monto' },
  { title: 'Participación', key: 'porcentaje' },
]
const headersComision = [
  { title: 'Colaborador', key: 'colaborador_email' },
  { title: 'Periodo', key: 'periodo' },
  { title: 'Base de producción', key: 'base_produccion' },
  { title: '%', key: 'pct' },
  { title: 'Comisión', key: 'monto' },
  { title: 'Fecha de pago', key: 'fecha_pago' },
  { title: 'Estado', key: 'estado', sortable: false },
]

/* ══════════ Gráfico mes a mes ══════════ */
const mesesChart = computed(() => [...ultimosPeriodos(12)].reverse())
const seriesChart = computed(() => {
  const porMes = (tipo: string) => mesesChart.value.map(mes =>
    transacciones.value
      .filter(t => String(t.fecha).slice(0, 7) === mes && t.tipo === tipo && !t.proyectado)
      .reduce((s, t) => s + Number(t.monto || 0), 0))
  const ing = porMes('ingreso'); const egr = porMes('egreso')
  const flujo = ing.map((v, i) => v - egr[i])

  // Saldo acumulado: la suma corrida del flujo mes a mes. Es lo que muestra si
  // la caja se está llenando o vaciando — el "Flujo" por sí solo no lo dice,
  // porque un mes malo tras varios buenos se ve igual que una caída real.
  let corrido = 0
  const acumulado = flujo.map(v => (corrido += v))

  return [
    { name: 'Ingresos', type: 'column', data: ing },
    { name: 'Egresos', type: 'column', data: egr },
    { name: 'Flujo del mes', type: 'line', data: flujo },
    { name: 'Saldo acumulado', type: 'line', data: acumulado },
  ]
})
const opcionesChart = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, stacked: false },
  stroke: { width: [0, 0, 3, 3], curve: 'smooth', dashArray: [0, 0, 0, 5] },
  colors: ['#2e9e5b', '#e2564a', '#5b8def', '#8b5cf6'],
  dataLabels: { enabled: false },
  xaxis: { categories: mesesChart.value.map(m => m.slice(2).split('-').reverse().join('/')) },
  yaxis: { labels: { formatter: (v: number) => PEN_CORTO(v) } },
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  tooltip: { theme: isDark.value ? 'dark' : 'light', y: { formatter: (v: number) => PEN(v) } },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
}))

/* ══════════ CRUD de movimientos ══════════ */
const movimiento = ref<any>(null)
const guardando = ref(false)

/**
 * Si hay precio Y cantidad, el subtotal se deriva de ellos y queda de solo
 * lectura: dos fuentes para el mismo número terminan siempre en discrepancia.
 * Si no, el subtotal se escribe directo, como se hacía antes de la migración.
 */
const usaPrecioCantidad = computed(() =>
  !!Number(movimiento.value?.precio) && !!Number(movimiento.value?.cantidad))

function desdePrecioCantidad() {
  const m = movimiento.value
  if (!m) return
  if (Number(m.precio) && Number(m.cantidad)) {
    m.subtotal = Math.round(Number(m.precio) * Number(m.cantidad) * 100) / 100
  }
}

function alternarImpuesto(codigo: string) {
  const sel = movimiento.value.impuestos_sel
  const i = sel.indexOf(codigo)
  if (i >= 0) sel.splice(i, 1)
  else sel.push(codigo)
}

/** Vencimiento derivado de la condición de pago (contado = mismo día). */
function recalcularVencimiento() {
  const m = movimiento.value
  if (!m?.condicion_pago_id || !m.fecha) return
  const cond = condicionesPago.value.find(c => c.id === m.condicion_pago_id)
  if (cond) m.fecha_vencimiento = sumarDiasISO(m.fecha, Number(cond.dias || 0))
}

const totalesMov = computed(() => {
  const m = movimiento.value
  if (!m) return { subtotal: 0, descuento: 0, impuestos: 0, total: 0, detalle: [] as any[] }
  const aplicados = impuestosDisponibles.value
    .filter(i => (m.impuestos_sel || []).includes(i.codigo))
    .map(i => ({ codigo: i.codigo, nombre: i.nombre, tasa: Number(i.tasa), comportamiento: i.comportamiento }))
  return calcularTotalesMovimiento(Number(m.subtotal || 0), Number(m.descuento || 0), aplicados)
})

/** Retenciones (renta, detracción): no cambian el total, sí lo que se recibe. */
const retenciones = computed(() => totalesMov.value.detalle
  .filter(d => d.comportamiento === 'retiene')
  .reduce((s, d) => s + d.monto, 0))

function abrirNuevo(tipo: string) {
  // Por defecto, IGV en ambos sentidos: es el caso normal en Piola
  const porDefecto = impuestos.value
    .filter(i => i.codigo === 'igv' && ['ambos', tipo].includes(i.aplica_a))
    .map(i => i.codigo)

  movimiento.value = {
    tipo, fecha: hoyISO(), concepto: '',
    precio: null, cantidad: null, subtotal: null, descuento: 0,
    impuestos_sel: porDefecto,
    category_id: null, cliente_id: null, proveedor_id: null,
    area_id: null, centro_costo_id: null,
    tipo_comprobante_id: null, documento_serie: '', documento_numero: '',
    condicion_pago_id: null, fecha_vencimiento: '',
    payment_method: metodosPago.value[0],
    responsable_email: props.perfil?.email || null,
    documento_adjunto: null,
    proyectado: false, notas: '', monto_pagado: 0,
  }
}

function editar(item: any) {
  movimiento.value = {
    ...item,
    fecha: String(item.fecha).slice(0, 10),
    fecha_vencimiento: item.fecha_vencimiento ? String(item.fecha_vencimiento).slice(0, 10) : '',
    // El subtotal puede ser NULL en los movimientos anteriores a la migración:
    // ahí el total ES el subtotal y no había desglose.
    subtotal: item.subtotal ?? item.monto,
    descuento: item.descuento ?? 0,
    impuestos_sel: Array.isArray(item.impuestos_detalle)
      ? item.impuestos_detalle.map((d: any) => d.codigo) : [],
  }
}

async function guardarMovimiento() {
  const m = movimiento.value
  if (!m.concepto?.trim()) {
    return emit('notify', { text: 'El movimiento necesita un concepto', color: 'error' })
  }
  if (!Number(totalesMov.value.total)) {
    return emit('notify', { text: 'El movimiento necesita un importe', color: 'error' })
  }

  guardando.value = true
  // Se manda el SUBTOTAL y los códigos de impuesto marcados, no los totales:
  // el servidor lee las tasas vigentes y recalcula `monto` con la misma
  // fórmula que `totalesMov`. `monto` es lo que suman gráficos, reportes y el
  // saldo de las cuentas, así que no puede salir del navegador. `estado`,
  // `monto_pagado`, `created_by` y `updated_by` también los pone el servidor.
  const res = await apiPiola('contabilidad', {
    accion: 'guardar_movimiento',
    id: m.id || null,
    tipo: m.tipo,
    fecha: m.fecha,
    concepto: m.concepto.trim(),
    subtotal: Number(m.subtotal || 0),
    descuento: Number(m.descuento || 0),
    impuestos_sel: m.impuestos_sel || [],
    precio: Number(m.precio) || null,
    cantidad: Number(m.cantidad) || null,
    category_id: m.category_id || null,
    cliente_id: m.cliente_id || null,
    proveedor_id: m.proveedor_id || null,
    area_id: m.area_id || null,
    centro_costo_id: m.centro_costo_id || null,
    tipo_comprobante_id: m.tipo_comprobante_id || null,
    documento_serie: m.documento_serie || null,
    documento_numero: m.documento_numero || null,
    documento_adjunto: m.documento_adjunto || null,
    condicion_pago_id: m.condicion_pago_id || null,
    fecha_vencimiento: m.fecha_vencimiento || null,
    payment_method: m.payment_method,
    responsable_email: m.responsable_email || null,
    proyectado: !!m.proyectado,
    notas: m.notas || null,
  })
  guardando.value = false
  if (res.error) return emit('notify', { text: `Error guardando: ${res.error.message}`, color: 'error' })
  emit('notify', m.id ? 'Movimiento actualizado' : 'Movimiento registrado')
  movimiento.value = null
  await cargar()
}

async function eliminar(item: any) {
  if (!confirm(`¿Eliminar "${item.concepto}"?`)) return
  const { error } = await apiPiola('contabilidad', { accion: 'eliminar_movimiento', id: item.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Movimiento eliminado')
  await cargar()
}

/* ══════════ CRUD de categorías jerárquicas ══════════ */
const nuevaCat = ref<any>({ nombre: '', parent_id: null, tipo: 'egreso' })
const guardandoCat = ref(false)
const editandoCat = ref<number | null>(null)
const nombreEditado = ref('')

async function crearCategoria() {
  if (!nuevaCat.value.nombre?.trim()) {
    return emit('notify', { text: 'Escribe el nombre de la categoría', color: 'error' })
  }
  guardandoCat.value = true
  const { error } = await apiPiola('contabilidad', {
    accion: 'crear_categoria',
    nombre: nuevaCat.value.nombre.trim(),
    parent_id: nuevaCat.value.parent_id || null,
    tipo: nuevaCat.value.tipo,
    orden: categorias.value.length + 1,
  })
  guardandoCat.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Categoría agregada')
  nuevaCat.value = { nombre: '', parent_id: null, tipo: 'egreso' }
  await cargar()
}

async function renombrarCategoria(c: any) {
  if (!nombreEditado.value.trim()) return
  const { error } = await apiPiola('contabilidad', {
    accion: 'editar_categoria', id: c.id, nombre: nombreEditado.value.trim(),
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  editandoCat.value = null
  emit('notify', 'Categoría renombrada')
  await cargar()
}

async function alternarCategoria(c: any) {
  const { error } = await apiPiola('contabilidad', {
    accion: 'editar_categoria', id: c.id, activo: !c.activo,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

async function eliminarCategoria(c: any) {
  const usos = transacciones.value.filter(t => t.category_id === c.id).length
  const hijas = categorias.value.filter(x => x.parent_id === c.id).length
  const aviso = [
    hijas ? `Tiene ${hijas} subcategoría(s), que también se eliminarán.` : '',
    usos ? `Hay ${usos} movimiento(s) con esta categoría; quedarán sin categoría.` : '',
  ].filter(Boolean).join('\n')

  if (!confirm(`¿Eliminar "${c.nombre}"?\n${aviso}\n\nSi solo quieres dejar de usarla, mejor desactívala.`)) return

  const { error } = await apiPiola('contabilidad', { accion: 'eliminar_categoria', id: c.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Categoría eliminada')
  await cargar()
}

/* ══════════ Comisiones ══════════ */
const calculandoComisiones = ref(false)

async function calcularComisiones() {
  calculandoComisiones.value = true
  try {
    const res = await $fetch<any>('/api/piola/comisiones', {
      method: 'POST', body: { accion: 'calcular', periodo: periodo.value },
    })
    comisiones.value = res.comisiones || []
    emit('notify', res.aviso
      ? { text: res.aviso, color: 'warning' }
      : `Comisiones calculadas: ${res.comisiones.length} colaborador(es), ${res.leads_ganados} lead(s) ganados`)
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error calculando comisiones', color: 'error' })
  } finally {
    calculandoComisiones.value = false
  }
}

async function cambiarEstadoComision(item: any, estado: string) {
  try {
    await $fetch('/api/piola/comisiones', { method: 'POST', body: { accion: 'actualizar', id: item.id, estado } })
    item.estado = estado
    emit('notify', `Comisión marcada como ${estado}`)
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error actualizando', color: 'error' })
  }
}

onMounted(cargar)
</script>

<style scoped>
.filtros-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 16px;
}
.filtros-bar .filtro { flex: 1 1 160px; min-width: 150px; max-width: 240px; }
.filtros-bar .filtro-buscar { flex: 2 1 240px; max-width: 340px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }

.barra {
  flex: 1; height: 7px; background: rgba(128, 128, 128, .18);
  border-radius: 999px; overflow: hidden; min-width: 70px;
}
.barra-fill { height: 100%; background: linear-gradient(90deg, #e2564a, #f2a63b); }

/* Árbol de categorías */
.cat-nueva {
  display: grid; grid-template-columns: 1.6fr 1.6fr 1fr auto; gap: 10px;
  align-items: center; margin-bottom: 18px;
}
.arbol { border: 1px solid rgba(128, 128, 128, .18); border-radius: 10px; overflow: hidden; }
.arbol-fila {
  display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  border-bottom: 1px solid rgba(128, 128, 128, .12); font-size: 13.5px;
}
.arbol-fila:last-child { border-bottom: none; }
.arbol-fila:hover { background: rgba(128, 128, 128, .06); }
.arbol-nombre { font-weight: 500; }
.arbol-nombre.inactiva { opacity: .45; text-decoration: line-through; }
.arbol-monto { margin-left: auto; font-size: 12.5px; opacity: .65; white-space: nowrap; }
.arbol-acciones { display: flex; gap: 1px; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .cat-nueva { grid-template-columns: 1fr; }
  .arbol-monto { display: none; }
}

/* ── Formulario de movimiento (modelo financiero completo) ── */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.doc-numero { display: flex; gap: 8px; }

.impuestos-caja {
  margin-top: 14px; border: 1px solid rgba(128, 128, 128, .22);
  border-radius: 10px; padding: 10px 14px;
}
.impuestos-titulo {
  font-size: 11px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; margin-bottom: 2px;
}
.impuestos-lista { display: flex; flex-wrap: wrap; gap: 4px 20px; }
.sin-impuestos { font-size: 12px; opacity: .5; padding: 4px 0; }

.totales-caja {
  margin-top: 14px; margin-left: auto; max-width: 340px; font-size: 13.5px;
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px; padding: 12px 16px;
}
.totales-caja > div { display: flex; justify-content: space-between; padding: 4px 0; gap: 12px; }
.totales-caja .tot-final {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 8px; font-size: 15px;
}
.totales-caja .tot-neto {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 8px;
  font-size: 15px; color: #2e9e5b;
}

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .totales-caja { max-width: none; }
}
</style>
