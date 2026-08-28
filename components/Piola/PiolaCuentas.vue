<template>
  <div>
    <!-- KPIs -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Saldo total</span></div>
        <div class="stat-value">{{ PEN_CORTO(totales.saldo) }}</div>
        <div class="stat-description">{{ filtradas.length }} documento(s)</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Vencido</span>
          <div v-if="totales.vencidoCount" class="stat-change down">{{ totales.vencidoCount }} doc.</div>
        </div>
        <div class="stat-value" :style="{ color: totales.vencido ? '#e2564a' : undefined }">
          {{ PEN_CORTO(totales.vencido) }}
        </div>
        <div class="stat-description">Pasaron su fecha de vencimiento</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Por vencer (7 días)</span></div>
        <div class="stat-value">{{ PEN_CORTO(totales.porVencer) }}</div>
        <div class="stat-description">Vencen esta semana</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">{{ esCobrar ? 'Cobrado' : 'Pagado' }}</span></div>
        <div class="stat-value">{{ PEN_CORTO(totales.pagado) }}</div>
        <div class="stat-description">Del total documentado</div>
      </div>
    </div>

    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">
          {{ esCobrar ? 'Cuentas por cobrar' : 'Cuentas por pagar' }} ({{ filtradas.length }})
        </span>
        <v-spacer />
        <v-btn size="small" variant="text" :loading="cargando" @click="cargar">
          <v-icon icon="mdi-refresh" start /> Actualizar
        </v-btn>
      </v-card-title>

      <div class="filtros-bar">
        <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
          :placeholder="esCobrar ? 'Cliente, documento…' : 'Proveedor, documento…'"
          density="compact" hide-details variant="outlined" clearable class="filtro filtro-buscar" />
        <v-select v-model="fTercero" :items="opcionesTercero" density="compact" hide-details
          variant="outlined" :label="esCobrar ? 'Cliente' : 'Proveedor'" class="filtro" />
        <v-select v-model="fEstado" :items="opcionesEstado" density="compact" hide-details
          variant="outlined" label="Estado" class="filtro" />
        <v-select v-if="esCobrar" v-model="fVendedor" :items="opcionesVendedor" density="compact"
          hide-details variant="outlined" label="Vendedor" class="filtro" />
        <v-text-field v-model="fDesde" type="date" label="Desde" density="compact" hide-details
          variant="outlined" clearable class="filtro filtro-fecha" />
        <v-text-field v-model="fHasta" type="date" label="Hasta" density="compact" hide-details
          variant="outlined" clearable class="filtro filtro-fecha" />
      </div>

      <v-data-table :headers="headers" :items="filtradas" :loading="cargando" class="elevation-0"
        :no-data-text="esCobrar ? 'No hay nada por cobrar' : 'No hay nada por pagar'"
        :items-per-page="25" @click:row="(_: any, r: any) => abrirDetalle(r.item)">
        <template v-slot:item.fecha_emision="{ item }">{{ fechaCorta(item.fecha_emision) }}</template>
        <template v-slot:item.fecha_vencimiento="{ item }">
          <span :class="{ 'texto-alerta': item.dias_atraso > 0 }">
            {{ fechaCorta(item.fecha_vencimiento) }}
          </span>
        </template>
        <template v-slot:item.importe_total="{ item }">{{ PEN(item.importe_total) }}</template>
        <template v-slot:item.importe_pagado="{ item }">{{ PEN(item.importe_pagado) }}</template>
        <template v-slot:item.saldo_pendiente="{ item }">
          <strong :style="{ color: item.saldo_pendiente > 0 ? '#e2564a' : '#2e9e5b' }">
            {{ PEN(item.saldo_pendiente) }}
          </strong>
        </template>
        <template v-slot:item.dias_atraso="{ item }">
          <v-chip v-if="item.dias_atraso > 0" size="x-small" variant="flat" color="error">
            {{ item.dias_atraso }} d
          </v-chip>
          <span v-else style="opacity:.35">—</span>
        </template>
        <template v-slot:item.estado="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorEstadoMovimiento(item.estado)">
            {{ etiquetaEstado(item.estado) }}
          </v-chip>
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-icon v-if="!esCobrar && !item.aprobado_por" icon="mdi-alert-circle-outline" size="16"
            color="warning" title="Sin aprobar" style="margin-right:4px;" />
          <v-btn v-if="puedeEditar && item.saldo_pendiente > 0" icon="mdi-cash-plus" size="x-small"
            variant="text" color="success" :title="esCobrar ? 'Registrar cobro' : 'Registrar pago'"
            @click.stop="abrirPago(item)" />
          <v-btn icon="mdi-history" size="x-small" variant="text" title="Historial de pagos"
            @click.stop="abrirDetalle(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ DETALLE + HISTORIAL ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="860" scrollable @update:model-value="cerrarDetalle">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700;">{{ detalle.documento || detalle.concepto }}</span>
          <v-chip size="small" variant="flat" :color="colorEstadoMovimiento(detalle.estado)">
            {{ etiquetaEstado(detalle.estado) }}
          </v-chip>
        </v-card-title>

        <v-card-text>
          <div class="detalle-campos">
            <div>
              <span>{{ esCobrar ? 'Cliente' : 'Proveedor' }}</span>
              <strong>{{ nombreTercero(detalle) }}</strong>
            </div>
            <div><span>Concepto</span><strong>{{ detalle.concepto }}</strong></div>
            <div><span>Emisión</span><strong>{{ fechaCorta(detalle.fecha_emision) }}</strong></div>
            <div><span>Vencimiento</span><strong>{{ fechaCorta(detalle.fecha_vencimiento) }}</strong></div>
            <div><span>Importe total</span><strong>{{ PEN(detalle.importe_total) }}</strong></div>
            <div><span>Pagado</span><strong>{{ PEN(detalle.importe_pagado) }}</strong></div>
            <div>
              <span>Saldo</span>
              <strong :style="{ color: detalle.saldo_pendiente > 0 ? '#e2564a' : '#2e9e5b' }">
                {{ PEN(detalle.saldo_pendiente) }}
              </strong>
            </div>
            <div v-if="detalle.dias_atraso > 0">
              <span>Atraso</span><strong style="color:#e2564a">{{ detalle.dias_atraso }} días</strong>
            </div>
            <div v-if="!esCobrar">
              <span>Aprobación</span>
              <strong v-if="detalle.aprobado_por" style="color:#2e9e5b">
                {{ detalle.aprobado_por }} · {{ fechaCorta(detalle.aprobado_at) }}
              </strong>
              <strong v-else style="opacity:.5">Sin aprobar</strong>
            </div>
          </div>

          <v-btn v-if="!esCobrar && puedeEditar && !detalle.aprobado_por" class="mt-3" size="small"
            variant="tonal" color="warning" :loading="aprobando" @click="aprobarEgreso">
            <v-icon icon="mdi-check-decagram" start /> Aprobar este pago
          </v-btn>

          <v-divider class="my-5" />

          <div class="form-section-title" style="display:flex; align-items:center;">
            <span>Historial de pagos ({{ pagos.length }})</span>
            <v-spacer />
            <v-btn v-if="puedeEditar && detalle.saldo_pendiente > 0" size="small" variant="tonal"
              color="success" @click="abrirPago(detalle)">
              <v-icon icon="mdi-cash-plus" start /> {{ esCobrar ? 'Registrar cobro' : 'Registrar pago' }}
            </v-btn>
          </div>

          <v-table v-if="pagos.length" density="compact">
            <thead>
              <tr>
                <th>Fecha</th><th>Método</th><th>Referencia</th>
                <th class="text-right">Monto</th><th class="text-right">Descuento</th>
                <th class="text-right">Constancia</th><th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pagos" :key="p.id">
                <td>{{ fechaCorta(p.fecha) }}</td>
                <td>{{ p.payment_method || '—' }}</td>
                <td>{{ p.referencia || '—' }}</td>
                <td class="text-right">{{ PEN(p.monto) }}</td>
                <td class="text-right">
                  <span v-if="p.descuento" :title="p.motivo_descuento || ''">
                    {{ PEN(p.descuento) }}
                  </span>
                  <span v-else style="opacity:.35">—</span>
                </td>
                <td class="text-right">
                  <template v-if="p.constancia_url">
                    <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver constancia"
                      @click="verConstancia(p)" />
                    <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
                      :href="urlDoc(p.constancia_url)" />
                  </template>
                  <span v-else style="opacity:.35">—</span>
                </td>
                <td class="text-right">
                  <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text"
                    color="error" title="Eliminar el pago" @click="eliminarPago(p)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="sin-datos">Todavía no se registró ningún pago.</div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cerrarDetalle">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ REGISTRAR PAGO ══════════ -->
    <v-dialog :model-value="!!pago" max-width="620" scrollable @update:model-value="pago = null">
      <v-card v-if="pago">
        <v-card-title class="pt-4">
          {{ esCobrar ? 'Registrar cobro' : 'Registrar pago' }}
        </v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Saldo pendiente: <b>{{ PEN(pago._saldo) }}</b>.
            Se puede pagar en partes; el estado se recalcula solo.
          </v-alert>

          <div class="form-grid">
            <v-text-field v-model="pago.fecha" type="date" label="Fecha" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model.number="pago.monto" type="number" min="0" label="Monto (S/) *"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="pago.payment_method" :items="metodosPago" label="Método de pago"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="pago.referencia" label="N.º de operación" density="compact"
              hide-details variant="outlined" />
          </div>

          <div class="acciones-rapidas">
            <v-btn size="x-small" variant="tonal" @click="pago.monto = pago._saldo">
              Pagar el saldo completo
            </v-btn>
            <v-btn size="x-small" variant="text" @click="pago.monto = Math.round(pago._saldo / 2 * 100) / 100">
              La mitad
            </v-btn>
          </div>

          <!-- Descuento autorizado: baja el saldo sin que entre plata -->
          <v-checkbox v-model="pago._conDescuento" color="primary" density="compact" hide-details
            label="Aplicar un descuento autorizado" class="mt-2" />
          <div v-if="pago._conDescuento" class="form-grid">
            <v-text-field v-model.number="pago.descuento" type="number" min="0" label="Descuento (S/)"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="pago.autorizado_por" label="Autorizado por" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="pago.motivo_descuento" label="Motivo del descuento"
              density="compact" hide-details variant="outlined" class="col-2" />
          </div>

          <div class="form-section-title" style="margin-top:18px;">Constancia</div>
          <PiolaSubirPdf v-model="pago.constancia_url" carpeta="constancias"
            label="Constancia de pago (PDF)"
            @error="(m: string) => emit('notify', { text: m, color: 'error' })" />

          <v-textarea v-model="pago.observaciones" label="Observaciones" rows="2" density="compact"
            hide-details variant="outlined" class="mt-4" />

          <div class="resumen-pago">
            <div><span>Monto</span><strong>{{ PEN(pago.monto) }}</strong></div>
            <div v-if="pago._conDescuento"><span>Descuento</span><strong>{{ PEN(pago.descuento) }}</strong></div>
            <div class="resumen-final">
              <span>Saldo después</span>
              <strong>{{ PEN(saldoDespues) }}</strong>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pago = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoPago" @click="guardarPago">
            Registrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Cuentas por cobrar y por pagar.
 *
 * Un solo componente para los dos casos: cambian los nombres (cliente vs
 * proveedor, cobro vs pago) pero el mecanismo es idéntico, y duplicarlo sería
 * duplicar también los bugs. `tipo` decide cuál es.
 *
 * Lee de la vista `piola_cuentas`, que ya trae saldo y días de atraso
 * calculados en la base. El estado del documento NO se escribe desde acá: lo
 * recalcula el trigger de piola_pagos con cada pago, así nunca queda un
 * documento "pagado" con saldo.
 */
import { ref, computed, onMounted, watch } from 'vue'
import {
  PEN, PEN_CORTO, fechaCorta, hoyISO, urlDocumento,
  ESTADOS_MOVIMIENTO, etiquetaEstado, colorEstadoMovimiento, traerTodo, apiPiola,
} from '@/composables/usePiola'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = defineProps<{
  perfil: any
  /** 'ingreso' → por cobrar · 'egreso' → por pagar */
  tipo: 'ingreso' | 'egreso'
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void; (e: 'cambio'): void }>()

const client = useSupabaseClient()
const esCobrar = computed(() => props.tipo === 'ingreso')

const cargando = ref(false)
const cuentas = ref<any[]>([])
const pagos = ref<any[]>([])
const metodosPago = ref<string[]>(['Transferencia bancaria'])
const colaboradores = ref<any[]>([])

const fBuscar = ref('')
const fTercero = ref<any>('todos')
const fEstado = ref('pendientes')
const fVendedor = ref('todos')
const fDesde = ref('')
const fHasta = ref('')

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [c, m, col] = await Promise.all([
    traerTodo(() => client.from('piola_cuentas').select('*').eq('tipo', props.tipo)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false }).order('id')),
    client.from('piola_payment_methods').select('nombre').eq('activo', true).order('orden'),
    client.from('piola_colaboradores').select('email, nombre').eq('activo', true).order('nombre'),
  ])
  if (c.error) emit('notify', { text: `Error cargando cuentas: ${c.error.message}`, color: 'error' })
  cuentas.value = (c.data as any[]) || []
  const metodos = ((m.data as any[]) || []).map(x => x.nombre)
  metodosPago.value = metodos.length ? metodos : ['Transferencia bancaria']
  colaboradores.value = (col.data as any[]) || []
  cargando.value = false
}

watch(() => props.tipo, cargar)

/* ══════════ Derivados ══════════ */
const nombreTercero = (c: any) =>
  (esCobrar.value ? c.cliente_nombre : c.proveedor_nombre) || '—'

const opcionesTercero = computed(() => {
  const vistos = new Map<string, string>()
  for (const c of cuentas.value) {
    const n = nombreTercero(c)
    if (n !== '—') vistos.set(n, n)
  }
  return [
    { value: 'todos', title: esCobrar.value ? 'Todos los clientes' : 'Todos los proveedores' },
    ...[...vistos.keys()].sort().map(n => ({ value: n, title: n })),
  ]
})

const opcionesEstado = [
  { value: 'pendientes', title: 'Con saldo pendiente' },
  { value: 'todos', title: 'Todos' },
  ...ESTADOS_MOVIMIENTO.filter(e => e.value !== 'anulado'),
]

const opcionesVendedor = computed(() => [
  { value: 'todos', title: 'Todos los vendedores' },
  ...colaboradores.value.map(c => ({ value: c.email, title: c.nombre })),
])

const filtradas = computed(() => {
  let lista = cuentas.value.filter(c => !c.proyectado)

  if (fEstado.value === 'pendientes') lista = lista.filter(c => Number(c.saldo_pendiente) > 0)
  else if (fEstado.value !== 'todos') lista = lista.filter(c => c.estado === fEstado.value)

  if (fTercero.value !== 'todos') lista = lista.filter(c => nombreTercero(c) === fTercero.value)
  if (esCobrar.value && fVendedor.value !== 'todos') {
    lista = lista.filter(c => c.vendedor === fVendedor.value)
  }
  if (fDesde.value) lista = lista.filter(c => String(c.fecha_emision || '').slice(0, 10) >= fDesde.value)
  if (fHasta.value) lista = lista.filter(c => String(c.fecha_emision || '').slice(0, 10) <= fHasta.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(c => [nombreTercero(c), c.documento, c.concepto]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const totales = computed(() => {
  const limite = (() => {
    const [y, m, d] = hoyISO().split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() + 7)
    return dt.toISOString().slice(0, 10)
  })()
  const conSaldo = filtradas.value.filter(c => Number(c.saldo_pendiente) > 0)
  const vencidas = conSaldo.filter(c => Number(c.dias_atraso) > 0)
  return {
    saldo: conSaldo.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0),
    vencido: vencidas.reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0),
    vencidoCount: vencidas.length,
    porVencer: conSaldo
      .filter(c => !Number(c.dias_atraso) && c.fecha_vencimiento
        && String(c.fecha_vencimiento).slice(0, 10) <= limite)
      .reduce((s, c) => s + Number(c.saldo_pendiente || 0), 0),
    pagado: filtradas.value.reduce((s, c) => s + Number(c.importe_pagado || 0), 0),
  }
})

const headers = computed(() => [
  { title: esCobrar.value ? 'Cliente' : 'Proveedor', key: 'tercero', sortable: false,
    value: (i: any) => nombreTercero(i) },
  { title: 'Documento', key: 'documento' },
  { title: 'Concepto', key: 'concepto' },
  { title: 'Emisión', key: 'fecha_emision' },
  { title: 'Vencimiento', key: 'fecha_vencimiento' },
  { title: 'Importe', key: 'importe_total' },
  { title: 'Pagado', key: 'importe_pagado' },
  { title: 'Saldo', key: 'saldo_pendiente' },
  { title: 'Atraso', key: 'dias_atraso' },
  { title: 'Estado', key: 'estado', sortable: false },
  { title: '', key: 'acciones', sortable: false },
])

/* ══════════ Visor ══════════ */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (p: any) => urlDocumento(client, p)
const verConstancia = (p: any) => {
  visor.value = { abierto: true, src: urlDoc(p.constancia_url), titulo: `Constancia — ${fechaCorta(p.fecha)}` }
}

/* ══════════ Detalle ══════════ */
const detalle = ref<any>(null)

async function abrirDetalle(c: any) {
  detalle.value = { ...c }
  const { data } = await client.from('piola_pagos').select('*')
    .eq('transaction_id', c.id).order('fecha', { ascending: false })
  pagos.value = (data as any[]) || []
}
function cerrarDetalle() { detalle.value = null; pagos.value = [] }

/* ══════════ Aprobación (sólo cuentas por pagar) ══════════ */
const aprobando = ref(false)

async function aprobarEgreso() {
  const c = detalle.value
  aprobando.value = true
  const { error } = await apiPiola('contabilidad', { accion: 'aprobar_egreso', id: c.id })
  aprobando.value = false

  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  detalle.value.aprobado_por = props.perfil?.email || ''
  detalle.value.aprobado_at = new Date().toISOString()
  emit('notify', 'Pago aprobado')
  await cargar()
}

/* ══════════ Registrar pago ══════════ */
const pago = ref<any>(null)
const guardandoPago = ref(false)

function abrirPago(c: any) {
  const saldo = Number(c.saldo_pendiente || 0)
  pago.value = {
    transaction_id: c.id,
    fecha: hoyISO(),
    monto: saldo,
    descuento: 0,
    motivo_descuento: '',
    autorizado_por: props.perfil?.email || '',
    payment_method: metodosPago.value[0],
    referencia: '',
    constancia_url: null,
    observaciones: '',
    _saldo: saldo,
    _conDescuento: false,
  }
}

const saldoDespues = computed(() => {
  const p = pago.value
  if (!p) return 0
  const aplicado = Number(p.monto || 0) + (p._conDescuento ? Number(p.descuento || 0) : 0)
  return Math.round(Math.max(p._saldo - aplicado, 0) * 100) / 100
})

async function guardarPago() {
  const p = pago.value
  const monto = Number(p.monto || 0)
  const descuento = p._conDescuento ? Number(p.descuento || 0) : 0

  if (monto <= 0 && descuento <= 0) {
    return emit('notify', { text: 'El pago necesita un monto o un descuento', color: 'error' })
  }
  // Tolerancia de 1 céntimo por el redondeo de los porcentajes
  if (monto + descuento > p._saldo + 0.01) {
    return emit('notify', {
      text: `El pago (${PEN(monto + descuento)}) supera el saldo pendiente (${PEN(p._saldo)})`,
      color: 'error',
    })
  }
  if (descuento > 0 && !p.motivo_descuento?.trim()) {
    return emit('notify', { text: 'Un descuento necesita su motivo', color: 'error' })
  }

  guardandoPago.value = true
  // Las validaciones de arriba son para dar respuesta inmediata; el servidor
  // las repite y además recalcula el saldo pendiente contra piola_transactions,
  // que es lo único que el navegador no puede garantizar. `registrado_por` sale
  // del perfil verificado, no del body.
  const { error } = await apiPiola('pagos', {
    accion: 'registrar',
    transaction_id: p.transaction_id,
    fecha: p.fecha,
    monto,
    descuento,
    motivo_descuento: descuento > 0 ? p.motivo_descuento.trim() : null,
    autorizado_por: descuento > 0 ? (p.autorizado_por || null) : null,
    payment_method: p.payment_method || null,
    referencia: p.referencia || null,
    constancia_url: p.constancia_url || null,
    observaciones: p.observaciones || null,
  })
  guardandoPago.value = false

  if (error) return emit('notify', { text: `Error registrando: ${error.message}`, color: 'error' })

  emit('notify', esCobrar.value ? 'Cobro registrado' : 'Pago registrado')
  pago.value = null
  await cargar()
  if (detalle.value) {
    const actualizada = cuentas.value.find(c => c.id === detalle.value.id)
    if (actualizada) await abrirDetalle(actualizada)
  }
  emit('cambio')
}

async function eliminarPago(p: any) {
  if (!confirm(`¿Eliminar el pago de ${PEN(p.monto)} del ${fechaCorta(p.fecha)}?`)) return
  const { error } = await apiPiola('pagos', { accion: 'eliminar', id: p.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Pago eliminado')
  await cargar()
  const actualizada = cuentas.value.find(c => c.id === detalle.value?.id)
  if (actualizada) await abrirDetalle(actualizada)
  emit('cambio')
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 150px; max-width: 220px; }
.filtros-bar .filtro-buscar { flex: 2 1 230px; max-width: 320px; }
.filtros-bar .filtro-fecha { flex: 0 1 145px; min-width: 135px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.detalle-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.detalle-campos > div { display: flex; flex-direction: column; gap: 2px; }
.detalle-campos span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.detalle-campos strong { font-size: 13.5px; }

.acciones-rapidas { display: flex; gap: 8px; margin-top: 10px; }

.resumen-pago {
  margin-top: 16px; margin-left: auto; max-width: 300px; font-size: 13.5px;
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px; padding: 10px 14px;
}
.resumen-pago > div { display: flex; justify-content: space-between; padding: 4px 0; }
.resumen-pago .resumen-final {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 7px; font-size: 15px;
}

.sin-datos { font-size: 12.5px; opacity: .5; padding: 10px 0; }
.texto-alerta { color: #e2564a; font-weight: 600; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
}
</style>
