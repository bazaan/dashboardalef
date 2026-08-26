<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Facturación</h1>
      <button v-if="puedeCrear && tab === 'comprobantes'" class="btn-primary" @click="abrirNueva">
        <v-icon icon="mdi-file-document-plus" size="16" /><span>Nueva factura</span>
      </button>
    </header>

    <div class="content-area">
      <!-- Contratos vive acá dentro, como pestaña, no como módulo aparte -->
      <div class="table-tabs mb-4">
        <button :class="['tab', { active: tab === 'comprobantes' }]" @click="tab = 'comprobantes'">
          <v-icon icon="mdi-receipt-text-outline" size="15" /> Comprobantes
        </button>
        <button :class="['tab', { active: tab === 'contratos' }]" @click="tab = 'contratos'">
          <v-icon icon="mdi-file-sign" size="15" /> Contratos y adendas
        </button>
      </div>

      <PiolaContratos v-if="tab === 'contratos'" :perfil="perfil" :puede-crear="puedeCrear"
        :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
        @notify="(p: any) => emit('notify', p)" />

      <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Emitidas este mes</span></div>
          <div class="stat-value">{{ delMes.length }}</div>
          <div class="stat-description">{{ PEN_CORTO(montoMes) }} facturados</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Por cobrar</span></div>
          <div class="stat-value">{{ PEN_CORTO(porCobrar) }}</div>
          <div class="stat-description">{{ pendientes.length }} factura(s) sin pagar</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Vencidas</span>
            <div v-if="vencidas.length" class="stat-change down">atención</div>
          </div>
          <div class="stat-value">{{ vencidas.length }}</div>
          <div class="stat-description">Pasaron su fecha de vencimiento</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Detracciones del mes</span></div>
          <div class="stat-value">{{ PEN_CORTO(detraccionesMes) }}</div>
          <div class="stat-description">Depositadas por los clientes en el BN</div>
        </div>
      </div>

      <v-alert v-if="sinCredenciales" type="warning" variant="tonal" density="compact" class="mb-4">
        Piola todavía no tiene credenciales de emisión electrónica cargadas
        (<code>PIOLA_PSE_URL</code> / <code>PIOLA_PSE_TOKEN</code>). Las facturas se guardan como
        <b>borrador</b> con su correlativo y su PDF, pero <b>no se envían a SUNAT</b>. Al cargar las
        credenciales, todo lo demás sigue igual.
      </v-alert>

      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Comprobantes ({{ facturasFiltradas.length }})</span>
        </v-card-title>
        <div class="filtros-bar">
          <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
            placeholder="Cliente, número, RUC…" density="compact" hide-details variant="outlined"
            clearable class="filtro filtro-buscar" />
          <v-select v-model="fEstado" :items="['todos', 'borrador', 'emitida', 'enviada', 'pagada', 'vencida', 'anulada', 'error']"
            density="compact" hide-details variant="outlined" label="Estado" class="filtro" />
        </div>
        <v-data-table :headers="headers" :items="facturasFiltradas" :loading="cargando" class="elevation-0"
          no-data-text="Todavía no hay comprobantes" :items-per-page="25"
          @click:row="(_: any, r: any) => detalle = r.item">
          <template v-slot:item.numero_completo="{ item }">
            <strong>{{ item.serie }}-{{ item.numero }}</strong>
          </template>
          <template v-slot:item.fecha_emision="{ item }">{{ fechaCorta(item.fecha_emision) }}</template>
          <template v-slot:item.total="{ item }">{{ PEN(item.total) }}</template>
          <template v-slot:item.detraccion_monto="{ item }">
            <span v-if="item.con_detraccion">{{ PEN(item.detraccion_monto) }} ({{ item.detraccion_pct }} %)</span>
            <span v-else style="opacity:.4">—</span>
          </template>
          <template v-slot:item.neto_a_pagar="{ item }">
            {{ PEN(item.con_detraccion ? item.neto_a_pagar : item.total) }}
          </template>
          <template v-slot:item.estado="{ item }">
            <v-chip size="x-small" variant="flat" :color="colorEstado(item)">{{ estadoTexto(item) }}</v-chip>
          </template>
        </v-data-table>
      </v-card>
      </template>
    </div>

    <!-- ══════════ NUEVA FACTURA ══════════ -->
    <v-dialog :model-value="!!nueva" max-width="900" scrollable @update:model-value="nueva = null">
      <v-card v-if="nueva">
        <v-card-title class="pt-4">Nueva factura</v-card-title>
        <v-card-text>
          <div class="form-section-title">Cliente</div>
          <div class="form-grid">
            <v-select v-model="nueva.cliente_id" :items="opcionesCliente" label="Cliente registrado"
              density="compact" hide-details variant="outlined" clearable @update:model-value="autocompletarCliente" />
            <v-text-field v-model="nueva.cliente.razon_social" label="Razón social *" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="nueva.cliente.ruc" label="RUC" density="compact" variant="outlined"
              maxlength="11" :rules="[ruleRucOpcional]" hint="11 dígitos" persistent-hint />
            <v-text-field v-model="nueva.cliente.email" label="Correo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="nueva.cliente.direccion" label="Dirección" density="compact"
              hide-details variant="outlined" class="col-2" />
          </div>

          <div class="form-section-title" style="margin-top:18px;">Comprobante</div>
          <div class="form-grid">
            <v-select v-model.number="nueva.tipo_comprobante" :items="[{ value: 1, title: 'Factura' }, { value: 2, title: 'Boleta' }]"
              label="Tipo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="nueva.serie" label="Serie" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="nueva.fecha_emision" type="date" label="Fecha de emisión"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="nueva.fecha_vencimiento" type="date" label="Fecha de vencimiento"
              density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title" style="margin-top:18px;">Ítems</div>
          <div v-for="(it, i) in nueva.items" :key="i" class="item-fila">
            <v-select v-model="it.descripcion" :items="serviciosNombres" label="Servicio" density="compact"
              hide-details variant="outlined" editable
              @update:model-value="(v: any) => autocompletarPrecio(it, v)" />
            <v-text-field v-model.number="it.cantidad" type="number" label="Cant." density="compact"
              hide-details variant="outlined" style="max-width:90px;" />
            <v-text-field v-model.number="it.valor_unitario" type="number" label="V. unitario (sin IGV)"
              density="compact" hide-details variant="outlined" />
            <span class="item-total">{{ PEN(Number(it.cantidad || 0) * Number(it.valor_unitario || 0)) }}</span>
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="nueva.items.splice(i, 1)" />
          </div>
          <v-btn size="small" variant="tonal" class="mt-2" @click="nueva.items.push({ descripcion: '', cantidad: 1, valor_unitario: 0 })">
            <v-icon icon="mdi-plus" start /> Agregar ítem
          </v-btn>

          <div class="form-section-title" style="margin-top:20px;">Detracción</div>
          <v-alert type="info" variant="tonal" density="compact" class="mb-3">
            El ~98 % de las facturas de Piola llevan detracción, por eso viene activada por defecto.
          </v-alert>
          <div class="form-grid">
            <v-checkbox v-model="nueva.con_detraccion" color="primary" density="compact" hide-details
              label="Operación sujeta a detracción" />
            <v-text-field v-model.number="nueva.detraccion_pct" type="number" label="% de detracción"
              density="compact" hide-details variant="outlined" :disabled="!nueva.con_detraccion" />
            <v-text-field v-model="nueva.detraccion_codigo" label="Código de bien/servicio SUNAT"
              density="compact" hide-details variant="outlined" :disabled="!nueva.con_detraccion"
              hint="Ej: 022 servicios empresariales" persistent-hint />
          </div>

          <v-textarea v-model="nueva.observaciones" label="Observaciones" rows="2" density="compact"
            hide-details variant="outlined" class="mt-4" />

          <!-- Totales en vivo -->
          <div class="totales-caja mt-4">
            <div><span>Op. gravada</span><strong>{{ PEN(totalesCalculados.subtotal) }}</strong></div>
            <div><span>IGV (18 %)</span><strong>{{ PEN(totalesCalculados.igv) }}</strong></div>
            <div class="tot-final"><span>Total</span><strong>{{ PEN(totalesCalculados.total) }}</strong></div>
            <template v-if="nueva.con_detraccion">
              <div><span>Detracción ({{ nueva.detraccion_pct }} %)</span><strong>− {{ PEN(totalesCalculados.detraccion) }}</strong></div>
              <div class="tot-neto"><span>Neto a pagar</span><strong>{{ PEN(totalesCalculados.neto) }}</strong></div>
            </template>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="nueva = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="emitiendo" @click="emitir">
            <v-icon icon="mdi-send" start /> Emitir
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ DETALLE ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="700" scrollable @update:model-value="detalle = null">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <strong>{{ detalle.serie }}-{{ detalle.numero }}</strong>
          <v-chip size="small" variant="flat" :color="colorEstado(detalle)">{{ estadoTexto(detalle) }}</v-chip>
        </v-card-title>
        <v-card-text>
          <div class="detalle-campos">
            <div><span>Cliente</span><strong>{{ detalle.cliente_nombre || '—' }}</strong></div>
            <div><span>RUC</span><strong>{{ detalle.cliente_ruc || '—' }}</strong></div>
            <div><span>Emisión</span><strong>{{ fechaCorta(detalle.fecha_emision) }}</strong></div>
            <div><span>Vencimiento</span><strong>{{ fechaCorta(detalle.fecha_vencimiento) }}</strong></div>
            <div><span>Op. gravada</span><strong>{{ PEN(detalle.subtotal) }}</strong></div>
            <div><span>IGV</span><strong>{{ PEN(detalle.igv) }}</strong></div>
            <div><span>Total</span><strong>{{ PEN(detalle.total) }}</strong></div>
            <div v-if="detalle.con_detraccion"><span>Detracción</span>
              <strong>{{ PEN(detalle.detraccion_monto) }} ({{ detalle.detraccion_pct }} %)</strong></div>
            <div v-if="detalle.con_detraccion"><span>Neto a pagar</span><strong>{{ PEN(detalle.neto_a_pagar) }}</strong></div>
            <div><span>Aceptada por SUNAT</span><strong>{{ detalle.aceptada_por_sunat ? 'Sí' : 'No' }}</strong></div>
          </div>

          <v-table density="compact" class="mt-4">
            <thead><tr><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">V. unit.</th></tr></thead>
            <tbody>
              <tr v-for="(it, i) in (detalle.items || [])" :key="i">
                <td>{{ it.descripcion }}</td>
                <td class="text-right">{{ it.cantidad }}</td>
                <td class="text-right">{{ PEN(it.valor_unitario) }}</td>
              </tr>
            </tbody>
          </v-table>

          <v-alert v-if="detalle.estado === 'error'" type="error" variant="tonal" density="compact" class="mt-4">
            {{ mensajeError(detalle) }}
          </v-alert>
        </v-card-text>
        <v-card-actions style="flex-wrap:wrap; gap:8px; padding: 12px 20px 18px;">
          <v-btn v-if="detalle.pdf_url" variant="tonal" @click="abrirVisor(detalle)">
            <v-icon icon="mdi-file-pdf-box" start /> Ver comprobante
          </v-btn>
          <v-btn v-if="detalle.pdf_url" variant="text" :href="urlDoc(detalle.pdf_url)"
            :download="`${detalle.serie}-${detalle.numero}`">
            <v-icon icon="mdi-download" start /> Descargar
          </v-btn>
          <v-btn v-if="puedeEditar && detalle.estado !== 'pagada' && detalle.estado !== 'anulada'"
            color="success" variant="tonal" :loading="accionando === 'pagar'" @click="marcarPagada">
            <v-icon icon="mdi-cash-check" start /> Marcar pagada
          </v-btn>
          <v-btn v-if="puedeEditar" variant="tonal" :loading="accionando === 'enviar'" @click="enviarCorreo">
            <v-icon icon="mdi-email-fast" start /> Enviar
          </v-btn>
          <v-spacer />
          <v-btn v-if="puedeEditar && detalle.estado !== 'anulada'" color="error" variant="text"
            :loading="accionando === 'anular'" @click="anular">Anular</v-btn>
          <v-btn variant="text" @click="detalle = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Facturación (§5).
 *
 * Emite por el PSE del grupo (PSE.PE / NubeFact) desde el endpoint del
 * servidor. La DETRACCIÓN es el camino por defecto porque cubre el ~98 % de
 * los casos de Piola: se calcula en vivo y viaja en el payload a SUNAT.
 *
 * Marcar una factura como pagada crea automáticamente el ingreso en el flujo
 * de caja, por el NETO realmente cobrado (total − detracción).
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import { PEN, PEN_CORTO, fechaCorta, periodoActual, hoyISO, urlDocumento, traerTodo} from '@/composables/usePiola'
import { useFormRules } from '@/composables/rules'
import PiolaContratos from './PiolaContratos.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const periodo = periodoActual()
const { ruleRuc } = useFormRules()

/** 'comprobantes' | 'contratos' — Contratos es una pestaña de este módulo (19/08). */
const tab = ref('comprobantes')

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'facturacion', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'facturacion', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'facturacion', 'delete'))

/** El RUC es opcional (una boleta va con DNI), pero si se escribe debe ser válido. */
const ruleRucOpcional = (v: any) => !String(v ?? '').trim() || ruleRuc(v)

/* ── Visor embebido: el comprobante se abre dentro del dashboard ── */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (path: any) => urlDocumento(client, path)
function abrirVisor(f: any) {
  visor.value = { abierto: true, src: urlDoc(f.pdf_url), titulo: `${f.serie}-${f.numero}` }
}

const cargando = ref(false)
const facturas = ref<any[]>([])
const clientes = ref<any[]>([])
const servicios = ref<any[]>([])
const fBuscar = ref('')
const fEstado = ref('todos')

async function cargar() {
  cargando.value = true
  const [f, c, s] = await Promise.all([
    traerTodo(() => client.from('piola_invoices').select('*')
      .order('fecha_emision', { ascending: false }).order('id')),
    client.from('piola_clientes').select('*').eq('activo', true).order('nombre'),
    client.from('piola_services').select('*').eq('activo', true).order('orden'),
  ])
  if (f.error) emit('notify', { text: `Error cargando comprobantes: ${f.error.message}`, color: 'error' })
  facturas.value = (f.data as any[]) || []
  clientes.value = (c.data as any[]) || []
  servicios.value = (s.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const sinCredenciales = computed(() =>
  facturas.value.some(f => f.estado === 'borrador' && f.sunat_response?.aviso))

const delMes = computed(() => facturas.value.filter(
  f => String(f.fecha_emision).slice(0, 7) === periodo && f.estado !== 'anulada'))
const montoMes = computed(() => delMes.value.reduce((s, f) => s + Number(f.total || 0), 0))
const detraccionesMes = computed(() => delMes.value.reduce((s, f) => s + Number(f.detraccion_monto || 0), 0))

const pendientes = computed(() => facturas.value.filter(
  f => ['emitida', 'enviada', 'vencida'].includes(f.estado)))
const porCobrar = computed(() => pendientes.value.reduce(
  (s, f) => s + Number(f.con_detraccion ? f.neto_a_pagar : f.total || 0), 0))

const estaVencida = (f: any) =>
  ['emitida', 'enviada'].includes(f.estado) && f.fecha_vencimiento
  && String(f.fecha_vencimiento).slice(0, 10) < hoyISO()
const vencidas = computed(() => facturas.value.filter(estaVencida))

const facturasFiltradas = computed(() => {
  let lista = facturas.value
  if (fEstado.value !== 'todos') lista = lista.filter(f => estadoReal(f) === fEstado.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(f => [f.cliente_nombre, f.cliente_ruc, `${f.serie}-${f.numero}`]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const estadoReal = (f: any) => estaVencida(f) ? 'vencida' : f.estado
const estadoTexto = (f: any) => {
  const e = estadoReal(f)
  return { borrador: 'Borrador', emitida: 'Emitida', enviada: 'Enviada', pagada: 'Pagada',
    vencida: 'Vencida', anulada: 'Anulada', error: 'Error' }[e as string] || e
}
const colorEstado = (f: any) => ({
  borrador: 'grey', emitida: 'info', enviada: 'primary', pagada: 'success',
  vencida: 'error', anulada: 'grey', error: 'error',
}[estadoReal(f) as string] || 'grey')

const mensajeError = (f: any) => {
  const e = f.sunat_response?.error
  if (!e) return 'La emisión falló.'
  if (typeof e === 'string') return e
  return e.errors || e.error || e.message || JSON.stringify(e)
}

const opcionesCliente = computed(() => clientes.value.map(c => ({ value: c.id, title: c.nombre })))
const serviciosNombres = computed(() => servicios.value.map(s => s.nombre))

const headers = [
  { title: 'Número', key: 'numero_completo', sortable: false },
  { title: 'Cliente', key: 'cliente_nombre' },
  { title: 'Emisión', key: 'fecha_emision' },
  { title: 'Total', key: 'total' },
  { title: 'Detracción', key: 'detraccion_monto' },
  { title: 'Neto', key: 'neto_a_pagar' },
  { title: 'Estado', key: 'estado' },
]

/* ══════════ Nueva factura ══════════ */
const nueva = ref<any>(null)
const emitiendo = ref(false)

function abrirNueva() {
  nueva.value = {
    cliente_id: null,
    cliente: { razon_social: '', ruc: '', email: '', direccion: '' },
    tipo_comprobante: 1,
    serie: 'F001',
    fecha_emision: hoyISO(),
    fecha_vencimiento: '',
    items: [{ descripcion: '', cantidad: 1, valor_unitario: 0 }],
    con_detraccion: true,          // §5: es el caso normal en Piola
    detraccion_pct: 12,
    detraccion_codigo: '',
    observaciones: '',
  }
}

function autocompletarCliente(id: any) {
  const c = clientes.value.find(x => x.id === id)
  if (!c) return
  nueva.value.cliente = {
    razon_social: c.razon_social || c.nombre,
    ruc: c.ruc || '',
    email: c.email || '',
    direccion: c.direccion || '',
  }
}

function autocompletarPrecio(item: any, nombre: string) {
  const s = servicios.value.find(x => x.nombre === nombre)
  if (s?.precio_referencial && !item.valor_unitario) item.valor_unitario = Number(s.precio_referencial)
}

const totalesCalculados = computed(() => {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const items = nueva.value?.items || []
  const subtotal = r2(items.reduce((s: number, it: any) =>
    s + Number(it.cantidad || 0) * Number(it.valor_unitario || 0), 0))
  const igv = r2(subtotal * 0.18)
  const total = r2(subtotal + igv)
  const detraccion = nueva.value?.con_detraccion
    ? r2(total * Number(nueva.value.detraccion_pct || 0) / 100) : 0
  return { subtotal, igv, total, detraccion, neto: r2(total - detraccion) }
})

async function emitir() {
  const n = nueva.value
  if (!n.cliente.razon_social?.trim()) {
    return emit('notify', { text: 'Falta la razón social del cliente', color: 'error' })
  }
  if (!n.items.some((it: any) => it.descripcion && Number(it.valor_unitario))) {
    return emit('notify', { text: 'Agrega al menos un ítem con descripción y precio', color: 'error' })
  }
  // Una factura (tipo 1) sin RUC válido la rechaza SUNAT; mejor pararla acá.
  const ruc = String(n.cliente.ruc || '').trim()
  if (ruc && ruleRuc(ruc) !== true) {
    return emit('notify', { text: 'El RUC debe tener 11 dígitos', color: 'error' })
  }
  if (Number(n.tipo_comprobante) === 1 && !ruc) {
    return emit('notify', { text: 'Una factura necesita el RUC del cliente', color: 'error' })
  }

  emitiendo.value = true
  try {
    const res = await $fetch<any>('/api/piola/factura', {
      method: 'POST',
      body: {
        accion: 'emitir',
        cliente_id: n.cliente_id,
        cliente: n.cliente,
        tipo_comprobante: n.tipo_comprobante,
        serie: n.serie,
        fecha_emision: n.fecha_emision,
        fecha_vencimiento: n.fecha_vencimiento || null,
        items: n.items.filter((it: any) => it.descripcion),
        con_detraccion: n.con_detraccion,
        detraccion_pct: n.detraccion_pct,
        detraccion_codigo: n.detraccion_codigo,
        observaciones: n.observaciones,
      },
    })
    emit('notify', res.aviso
      ? { text: res.aviso, color: 'warning' }
      : `Comprobante ${res.factura.serie}-${res.factura.numero} emitido`)
    nueva.value = null
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error emitiendo el comprobante', color: 'error' })
  } finally {
    emitiendo.value = false
  }
}

/* ══════════ Acciones sobre una factura ══════════ */
const detalle = ref<any>(null)
const accionando = ref<string | null>(null)

async function marcarPagada() {
  accionando.value = 'pagar'
  try {
    const res = await $fetch<any>('/api/piola/factura', {
      method: 'POST', body: { accion: 'marcar_pagada', id: detalle.value.id },
    })
    emit('notify', res.transaccion
      ? 'Factura pagada — el ingreso ya está en el flujo de caja'
      : 'Factura marcada como pagada')
    detalle.value = null
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error', color: 'error' })
  } finally { accionando.value = null }
}

async function enviarCorreo() {
  const destino = prompt('¿A qué correo se envía?', detalle.value.cliente_email || '')
  if (!destino) return
  accionando.value = 'enviar'
  try {
    await $fetch('/api/piola/factura', {
      method: 'POST', body: { accion: 'enviar', id: detalle.value.id, email: destino },
    })
    emit('notify', `Comprobante enviado a ${destino}`)
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error enviando', color: 'error' })
  } finally { accionando.value = null }
}

async function anular() {
  const motivo = prompt('Motivo de la anulación:')
  if (motivo === null) return
  accionando.value = 'anular'
  try {
    await $fetch('/api/piola/factura', {
      method: 'POST', body: { accion: 'anular', id: detalle.value.id, motivo },
    })
    emit('notify', 'Comprobante anulado')
    detalle.value = null
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error anulando', color: 'error' })
  } finally { accionando.value = null }
}

onMounted(cargar)
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 150px; max-width: 220px; }
.filtros-bar .filtro-buscar { flex: 2 1 240px; max-width: 340px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.item-fila { display: flex; gap: 10px; align-items: center; margin-bottom: 9px; }
.item-fila > :first-child { flex: 2; }
.item-total { min-width: 96px; text-align: right; font-weight: 600; font-size: 13px; }

.totales-caja {
  margin-left: auto; max-width: 330px; font-size: 13.5px;
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px; padding: 12px 16px;
}
.totales-caja > div { display: flex; justify-content: space-between; padding: 5px 0; }
.totales-caja .tot-final {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 8px; font-size: 15px;
}
.totales-caja .tot-neto {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 8px;
  font-size: 15px; color: #2e9e5b;
}

.detalle-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.detalle-campos > div { display: flex; flex-direction: column; gap: 2px; }
.detalle-campos span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.detalle-campos strong { font-size: 13.5px; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .item-fila { flex-wrap: wrap; }
  .totales-caja { max-width: none; }
}
</style>
