<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Clientes y contratos</h1>
      <button v-if="puedeCrear && tab === 'clientes'" class="btn-primary" @click="abrirCliente()">
        <v-icon icon="mdi-account-plus" size="16" /><span>Nuevo cliente</span>
      </button>
    </header>

    <div class="content-area">
      <div class="table-tabs mb-4">
        <button :class="['tab', { active: tab === 'clientes' }]" @click="tab = 'clientes'">
          <v-icon icon="mdi-account-group-outline" size="15" /> Clientes
        </button>
        <button :class="['tab', { active: tab === 'contratos' }]" @click="tab = 'contratos'">
          <v-icon icon="mdi-file-sign" size="15" /> Contratos y adendas
        </button>
        <button :class="['tab', { active: tab === 'recurrentes' }]" @click="tab = 'recurrentes'">
          <v-icon icon="mdi-calendar-sync" size="15" /> Facturación recurrente
          <span v-if="vencidas.length" class="tab-badge">{{ vencidas.length }}</span>
        </button>
      </div>

      <!-- ══════════════════ CLIENTES ══════════════════ -->
      <template v-if="tab === 'clientes'">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Clientes activos</span></div>
            <div class="stat-value">{{ activos.length }}</div>
            <div class="stat-description">{{ clientes.length - activos.length }} inactivo(s)</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Con contrato vigente</span></div>
            <div class="stat-value">{{ conContratoVigente }}</div>
            <div class="stat-description">de {{ activos.length }} activos</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Facturación recurrente</span></div>
            <div class="stat-value">{{ PEN_CORTO(recurrenteMensual) }}</div>
            <div class="stat-description">comprometido al mes por contrato</div>
          </div>
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-title">Sin ficha SUNAT</span>
              <div v-if="sinRuc.length" class="stat-change down">revisar</div>
            </div>
            <div class="stat-value">{{ sinRuc.length }}</div>
            <div class="stat-description">clientes sin RUC cargado</div>
          </div>
        </div>

        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Clientes ({{ clientesFiltrados.length }})</span>
          </v-card-title>
          <div class="filtros-bar">
            <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
              placeholder="Nombre, RUC, contacto…" density="compact" hide-details variant="outlined"
              clearable class="filtro filtro-buscar" />
            <v-select v-model="fEstadoCliente" :items="[
              { value: 'activos', title: 'Solo activos' },
              { value: 'todos', title: 'Todos' },
              { value: 'inactivos', title: 'Solo inactivos' }]"
              density="compact" hide-details variant="outlined" label="Estado" class="filtro" />
          </div>

          <v-data-table :headers="headersClientes" :items="clientesFiltrados" :items-per-page="25"
            class="elevation-0" no-data-text="Todavía no hay clientes"
            @click:row="(_: any, r: any) => abrirCliente(r.item)">
            <template v-slot:item.nombre="{ item }">
              <strong>{{ item.nombre }}</strong>
              <div v-if="item.razon_social && item.razon_social !== item.nombre" class="sub">
                {{ item.razon_social }}
              </div>
            </template>
            <template v-slot:item.ruc="{ item }">
              <span v-if="item.ruc">
                {{ item.ruc }}
                <v-icon v-if="item.estado_sunat" size="12"
                  :icon="esActivoSunat(item) ? 'mdi-check-circle' : 'mdi-alert-circle'"
                  :color="esActivoSunat(item) ? 'success' : 'warning'"
                  :title="`${item.estado_sunat} · ${item.condicion_sunat || ''}`" />
              </span>
              <span v-else style="opacity:.4">—</span>
            </template>
            <template v-slot:item.contratos="{ item }">
              <v-chip v-if="contratosDe(item.id).length" size="x-small" variant="tonal"
                :color="tieneVigente(item.id) ? 'success' : 'grey'">
                {{ contratosDe(item.id).length }}
                {{ tieneVigente(item.id) ? '· vigente' : '' }}
              </v-chip>
              <span v-else style="opacity:.4">—</span>
            </template>
            <template v-slot:item.compromiso_mensual="{ item }">
              {{ item.compromiso_mensual || 0 }}
              <span v-if="compromisosDe(item.id).length" class="sub">
                {{ compromisosDe(item.id).map((c: any) => `${c.cantidad_mensual} ${nombreTipo(c.tipo_contenido)}`).join(' · ') }}
              </span>
            </template>
            <template v-slot:item.activo="{ item }">
              <v-chip size="x-small" variant="flat" :color="item.activo === false ? 'grey' : 'success'">
                {{ item.activo === false ? 'Inactivo' : 'Activo' }}
              </v-chip>
            </template>
          </v-data-table>
        </v-card>
      </template>

      <!-- ══════════════════ CONTRATOS ══════════════════ -->
      <PiolaContratos v-else-if="tab === 'contratos'" :perfil="perfil" :puede-crear="puedeCrear"
        :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar" :clientes="clientes"
        @notify="(p: any) => emit('notify', p)" @cambio="cargar" />

      <!-- ══════════════════ RECURRENTES ══════════════════ -->
      <template v-else>
        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          Las facturas de los contratos recurrentes se programan por toda la vigencia y se avisan
          antes de tocar. Al generarlas quedan como <b>borrador</b> en Facturación: el sistema las
          deja listas, la emisión a SUNAT la dispara una persona.
        </v-alert>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-title">Vencidas</span>
              <div v-if="vencidas.length" class="stat-change down">emitir</div>
            </div>
            <div class="stat-value">{{ vencidas.length }}</div>
            <div class="stat-description">{{ PEN_CORTO(sumar(vencidas)) }} sin facturar</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Este mes</span></div>
            <div class="stat-value">{{ delMes.length }}</div>
            <div class="stat-description">{{ PEN_CORTO(sumar(delMes)) }} programados</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Generadas</span></div>
            <div class="stat-value">{{ programadas.filter(p => p.estado === 'generada').length }}</div>
            <div class="stat-description">ya tienen su comprobante</div>
          </div>
          <div class="stat-card">
            <div class="stat-header"><span class="stat-title">Contratos recurrentes</span></div>
            <div class="stat-value">{{ contratos.filter(c => c.facturacion_recurrente).length }}</div>
            <div class="stat-description">de {{ contratos.length }} contratos</div>
          </div>
        </div>

        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Programación ({{ programadasFiltradas.length }})</span>
            <v-spacer />
            <v-btn v-if="puedeFacturar && vencidas.length" color="primary" variant="flat" size="small"
              :loading="generando" @click="generarPendientes">
              <v-icon icon="mdi-file-document-multiple" start size="16" />
              Generar las {{ vencidas.length }} vencidas
            </v-btn>
          </v-card-title>
          <div class="filtros-bar">
            <v-select v-model="fEstadoProg" :items="[
              { value: 'pendiente', title: 'Pendientes' },
              { value: 'todos', title: 'Todas' },
              { value: 'generada', title: 'Generadas' },
              { value: 'omitida', title: 'Omitidas' },
              { value: 'error', title: 'Con error' }]"
              density="compact" hide-details variant="outlined" label="Estado" class="filtro" />
          </div>

          <v-data-table :headers="headersProg" :items="programadasFiltradas" :items-per-page="25"
            class="elevation-0" no-data-text="No hay facturas programadas">
            <template v-slot:item.fecha_programada="{ item }">
              {{ fechaCorta(item.fecha_programada) }}
              <span v-if="item.estado === 'pendiente' && item.fecha_programada <= hoy" class="alerta">
                vencida
              </span>
            </template>
            <template v-slot:item.cliente="{ item }">{{ item.contrato?.nombre_cliente || '—' }}</template>
            <template v-slot:item.monto="{ item }">{{ PEN(item.monto) }}</template>
            <template v-slot:item.estado="{ item }">
              <v-chip size="x-small" variant="flat" :color="colorProg(item.estado)">
                {{ etiquetaProg(item.estado) }}
              </v-chip>
              <div v-if="item.error_message" class="sub">{{ item.error_message }}</div>
            </template>
            <template v-slot:item.acciones="{ item }">
              <template v-if="item.estado === 'pendiente'">
                <v-btn v-if="puedeFacturar" size="x-small" variant="tonal" color="primary"
                  :loading="generandoId === item.id" @click="generarUna(item)">Generar</v-btn>
                <v-btn v-if="puedeEditar" size="x-small" variant="text" @click="omitir(item)">Omitir</v-btn>
              </template>
              <span v-else-if="item.invoice_id" class="sub">Factura #{{ item.invoice_id }}</span>
            </template>
          </v-data-table>
        </v-card>
      </template>
    </div>

    <!-- ══════════════════ FICHA DEL CLIENTE ══════════════════ -->
    <v-dialog :model-value="!!cliente" max-width="960" scrollable @update:model-value="cliente = null">
      <v-card v-if="cliente">
        <v-card-title class="pt-4" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          {{ cliente.id ? cliente.nombre : 'Nuevo cliente' }}
          <v-chip v-if="cliente.estado_sunat" size="x-small" variant="tonal"
            :color="esActivoSunat(cliente) ? 'success' : 'warning'">
            SUNAT: {{ cliente.estado_sunat }}{{ cliente.condicion_sunat ? ' · ' + cliente.condicion_sunat : '' }}
          </v-chip>
        </v-card-title>

        <v-card-text>
          <div class="form-section-title">Identificación</div>
          <div class="form-grid">
            <div class="ruc-fila">
              <v-text-field v-model="cliente.ruc" label="RUC" density="compact" variant="outlined"
                hide-details maxlength="11" placeholder="20512345678" />
              <v-btn variant="tonal" :loading="consultandoRuc" :disabled="!cliente.ruc"
                @click="consultarRuc">
                <v-icon icon="mdi-cloud-search" start size="16" /> Consultar
              </v-btn>
            </div>
            <v-text-field v-model="cliente.nombre" label="Nombre / marca *" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="cliente.razon_social" label="Razón social" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="cliente.nombre_comercial" label="Nombre comercial"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.direccion_fiscal" label="Dirección fiscal"
              density="compact" hide-details variant="outlined" class="col-2" />
          </div>

          <v-alert v-if="avisoRuc" type="warning" variant="tonal" density="compact" class="mt-3">
            {{ avisoRuc }}
          </v-alert>

          <div class="form-section-title" style="margin-top:18px;">Contacto</div>
          <div class="form-grid">
            <v-text-field v-model="cliente.contacto" label="Persona de contacto" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="cliente.email" label="Correo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.telefono" label="Teléfono" density="compact" hide-details variant="outlined" />
            <v-select v-model="cliente.condicion_pago_id" :items="opcionesCondicion"
              label="Condición de pago" density="compact" hide-details variant="outlined" clearable />
            <v-text-field v-model="cliente.direccion" label="Dirección de entrega / oficina"
              density="compact" hide-details variant="outlined" class="col-2" />
          </div>

          <!-- Compromiso por tipo de contenido -->
          <div class="form-section-title" style="margin-top:20px;">
            Compromiso mensual por tipo de contenido
          </div>
          <p class="hint">
            El total suelto ("10 piezas") escondía lo que importa: pueden ser 10 gráficas y 0 videos.
            Acá se declara qué se comprometió de cada cosa, y el cumplimiento se mide contra eso.
          </p>
          <div v-for="(c, i) in cliente.compromisos" :key="i" class="compromiso-fila">
            <v-select v-model="c.tipo_contenido" :items="opcionesTipoContenido" label="Tipo"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="c.cantidad_mensual" type="number" min="0" label="Cantidad al mes"
              density="compact" hide-details variant="outlined" style="max-width:150px" />
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="cliente.compromisos.splice(i, 1)" />
          </div>
          <v-btn size="small" variant="tonal" class="mt-1"
            @click="cliente.compromisos.push({ tipo_contenido: null, cantidad_mensual: 1 })">
            <v-icon icon="mdi-plus" start /> Agregar tipo
          </v-btn>
          <div class="total-compromiso">
            Total comprometido: <strong>{{ totalCompromiso }}</strong> pieza(s) al mes
          </div>

          <!-- Carpetas externas -->
          <div class="form-section-title" style="margin-top:20px;">Carpetas de material</div>
          <p class="hint">
            Enlaces directos a Drive o Dropbox de la marca. Se abren desde Producción sin tener
            que preguntarle a nadie dónde está el material.
          </p>
          <div v-for="(e, i) in cliente.enlaces" :key="'e' + i" class="enlace-fila">
            <v-select v-model="e.proveedor" :items="[
              { value: 'drive', title: 'Google Drive' },
              { value: 'dropbox', title: 'Dropbox' },
              { value: 'otro', title: 'Otro' }]"
              label="Dónde" density="compact" hide-details variant="outlined" style="max-width:160px" />
            <v-text-field v-model="e.nombre" label="Nombre" density="compact" hide-details
              variant="outlined" style="max-width:190px" />
            <v-text-field v-model="e.url" label="URL" density="compact" hide-details variant="outlined"
              placeholder="https://…" />
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="quitarEnlace(i)" />
          </div>
          <v-btn size="small" variant="tonal" class="mt-1"
            @click="cliente.enlaces.push({ proveedor: 'drive', nombre: '', url: '' })">
            <v-icon icon="mdi-plus" start /> Agregar carpeta
          </v-btn>

          <v-textarea v-model="cliente.notas" label="Notas" rows="2" density="compact"
            hide-details variant="outlined" class="mt-4" />

          <!-- Documentos legales -->
          <div style="margin-top:20px;">
            <PiolaDocumentos entidad="cliente" :entidad-id="cliente.id || null"
              titulo="Documentos del cliente" tipo-por-defecto="ficha_ruc" carpeta="clientes"
              :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
              @notify="(p: any) => emit('notify', p)" />
          </div>

          <!-- Contratos del cliente -->
          <div v-if="cliente.id && contratosDe(cliente.id).length" style="margin-top:20px;">
            <div class="form-section-title">Contratos</div>
            <v-table density="compact">
              <thead><tr><th>Contrato</th><th>Vigencia</th><th class="text-right">Mensual</th><th>Estado</th></tr></thead>
              <tbody>
                <tr v-for="c in contratosDe(cliente.id)" :key="c.id">
                  <td>{{ c.codigo || `#${c.id}` }}</td>
                  <td>{{ fechaCorta(c.fecha_inicio) }} → {{ fechaCorta(c.fecha_cierre) }}</td>
                  <td class="text-right">{{ PEN(c.monto_periodico) }}</td>
                  <td><v-chip size="x-small" variant="flat" :color="colorContrato(c.estado)">{{ c.estado }}</v-chip></td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>

        <v-card-actions style="flex-wrap:wrap;gap:8px;padding:12px 20px 18px;">
          <v-btn v-if="puedeEliminar && cliente.id" color="error" variant="text" @click="eliminarCliente">
            Eliminar
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="cliente = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" :disabled="!puedeEditar"
            @click="guardarCliente">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Clientes y contratos (setiembre).
 *
 * Es un módulo propio y no una pestaña de Facturación: el contrato es la
 * relación con el cliente, la factura es el cobro. Con Finanzas restringida a
 * dos personas, dejar el expediente adentro habría dejado a comercial y
 * producción sin los datos con los que trabajan todos los días.
 *
 * Tres pestañas: la ficha del cliente (con consulta de RUC y compromisos por
 * tipo de contenido), los contratos con sus adendas, y la programación de la
 * facturación recurrente que sale de la vigencia de cada contrato.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, PEN_CORTO, fechaCorta, hoyISO, periodoActual, traerTodo, apiPiola,
  ESTADOS_PROGRAMADA, ESTADOS_CONTRATO,
} from '@/composables/usePiola'
import PiolaContratos from './PiolaContratos.vue'
import PiolaDocumentos from './PiolaDocumentos.vue'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const hoy = hoyISO()

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'clientes', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'clientes', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'clientes', 'delete'))
/** Generar los borradores recurrentes es facturar, no administrar contratos. */
const puedeFacturar = computed(() => piolaCan(props.perfil?.permisos, 'facturacion', 'create'))

const tab = ref('clientes')
const clientes = ref<any[]>([])
const contratos = ref<any[]>([])
const programadas = ref<any[]>([])
const compromisos = ref<any[]>([])
const enlaces = ref<any[]>([])
const tiposContenido = ref<any[]>([])
const condiciones = ref<any[]>([])

const fBuscar = ref('')
const fEstadoCliente = ref('activos')
const fEstadoProg = ref('pendiente')

async function cargar() {
  const [cl, co, pr, cm, en, tc, cp] = await Promise.all([
    traerTodo(() => client.from('piola_clientes').select('*').order('nombre').order('id')),
    traerTodo(() => client.from('piola_contratos').select('*')
      .order('fecha_cierre', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_facturas_programadas')
      .select('*, contrato:piola_contratos(id, nombre_cliente, codigo, serie_factura)')
      .order('fecha_programada').order('id')),
    client.from('piola_cliente_compromisos').select('*'),
    client.from('piola_enlaces_carpetas').select('*').eq('activo', true).order('orden'),
    client.from('piola_tipos_contenido').select('*').eq('activo', true).order('orden'),
    client.from('piola_condiciones_pago').select('*').eq('activo', true).order('orden'),
  ])
  if (cl.error) emit('notify', { text: `Error cargando clientes: ${cl.error.message}`, color: 'error' })
  clientes.value = (cl.data as any[]) || []
  contratos.value = (co.data as any[]) || []
  programadas.value = (pr.data as any[]) || []
  compromisos.value = (cm.data as any[]) || []
  enlaces.value = (en.data as any[]) || []
  tiposContenido.value = (tc.data as any[]) || []
  condiciones.value = (cp.data as any[]) || []
}

/* ══════════ Derivados ══════════ */
const activos = computed(() => clientes.value.filter(c => c.activo !== false))
const sinRuc = computed(() => activos.value.filter(c => !c.ruc))

const contratosDe = (clienteId: any) => contratos.value.filter(c => c.cliente_id === clienteId)
const compromisosDe = (clienteId: any) => compromisos.value.filter(c => c.cliente_id === clienteId)
const enlacesDe = (clienteId: any) => enlaces.value.filter(e => e.cliente_id === clienteId)

const esVigente = (c: any) =>
  c.estado === 'vigente' && (!c.fecha_cierre || String(c.fecha_cierre).slice(0, 10) >= hoy)
const tieneVigente = (clienteId: any) => contratosDe(clienteId).some(esVigente)

const conContratoVigente = computed(() => activos.value.filter(c => tieneVigente(c.id)).length)
const recurrenteMensual = computed(() => contratos.value
  .filter(c => c.facturacion_recurrente && esVigente(c))
  .reduce((s, c) => s + Number(c.monto_periodico || 0), 0))

const esActivoSunat = (c: any) => /activo/i.test(String(c.estado_sunat || ''))
const nombreTipo = (codigo: any) =>
  tiposContenido.value.find(t => t.codigo === codigo)?.nombre || codigo

const clientesFiltrados = computed(() => {
  let lista = clientes.value
  if (fEstadoCliente.value === 'activos') lista = lista.filter(c => c.activo !== false)
  if (fEstadoCliente.value === 'inactivos') lista = lista.filter(c => c.activo === false)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(c => [c.nombre, c.razon_social, c.ruc, c.contacto, c.email]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const headersClientes = [
  { title: 'Cliente', key: 'nombre' },
  { title: 'RUC', key: 'ruc' },
  { title: 'Contacto', key: 'contacto' },
  { title: 'Contratos', key: 'contratos', sortable: false },
  { title: 'Compromiso', key: 'compromiso_mensual' },
  { title: 'Estado', key: 'activo' },
]

const opcionesTipoContenido = computed(() =>
  tiposContenido.value.map(t => ({ value: t.codigo, title: t.nombre })))
const opcionesCondicion = computed(() =>
  condiciones.value.map(c => ({ value: c.id, title: c.nombre })))

/* ══════════ Programadas ══════════ */
const pendientes = computed(() => programadas.value.filter(p => p.estado === 'pendiente'))
const vencidas = computed(() => pendientes.value.filter(p => String(p.fecha_programada).slice(0, 10) <= hoy))
const delMes = computed(() => pendientes.value.filter(
  p => String(p.fecha_programada).slice(0, 7) === periodoActual()))
const sumar = (lista: any[]) => lista.reduce((s, p) => s + Number(p.monto || 0), 0)

const programadasFiltradas = computed(() => fEstadoProg.value === 'todos'
  ? programadas.value
  : programadas.value.filter(p => p.estado === fEstadoProg.value))

const colorProg = (v: any) => ESTADOS_PROGRAMADA.find(e => e.value === v)?.color || 'grey'
const etiquetaProg = (v: any) => ESTADOS_PROGRAMADA.find(e => e.value === v)?.title || v
const colorContrato = (v: any) => ESTADOS_CONTRATO.find(e => e.value === v)?.color || 'grey'

const headersProg = [
  { title: 'Fecha', key: 'fecha_programada' },
  { title: 'Periodo', key: 'periodo' },
  { title: 'Cliente', key: 'cliente', sortable: false },
  { title: 'Concepto', key: 'concepto' },
  { title: 'Monto', key: 'monto' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false },
]

/* ══════════ Ficha del cliente ══════════ */
const cliente = ref<any>(null)
const guardando = ref(false)
const consultandoRuc = ref(false)
const avisoRuc = ref('')
const enlacesEliminados = ref<number[]>([])

function abrirCliente(item?: any) {
  avisoRuc.value = ''
  enlacesEliminados.value = []
  cliente.value = item
    ? {
        ...item,
        compromisos: compromisosDe(item.id).map((c: any) => ({ ...c })),
        enlaces: enlacesDe(item.id).map((e: any) => ({ ...e })),
      }
    : {
        nombre: '', razon_social: '', nombre_comercial: '', ruc: '', contacto: '', email: '',
        telefono: '', direccion: '', direccion_fiscal: '', condicion_pago_id: null, notas: '',
        compromisos: [], enlaces: [],
      }
}

const totalCompromiso = computed(() => (cliente.value?.compromisos || [])
  .reduce((s: number, c: any) => s + Number(c.cantidad_mensual || 0), 0))

async function consultarRuc() {
  const ruc = String(cliente.value.ruc || '').replace(/\D/g, '')
  if (ruc.length !== 11) {
    return emit('notify', { text: 'El RUC debe tener 11 dígitos', color: 'error' })
  }

  consultandoRuc.value = true
  avisoRuc.value = ''
  try {
    const res = await $fetch<any>('/api/piola/ruc', { query: { ruc } })
    if (res.encontrado && res.datos) {
      const d = res.datos
      cliente.value.razon_social = d.razon_social || cliente.value.razon_social
      cliente.value.nombre_comercial = d.nombre_comercial || cliente.value.nombre_comercial
      cliente.value.direccion_fiscal = d.direccion || cliente.value.direccion_fiscal
      cliente.value.distrito = d.distrito
      cliente.value.provincia = d.provincia
      cliente.value.departamento = d.departamento
      cliente.value.estado_sunat = d.estado
      cliente.value.condicion_sunat = d.condicion
      // El nombre solo se rellena si estaba vacío: la marca comercial suele
      // ser distinta de la razón social y es la que usa el equipo.
      if (!cliente.value.nombre?.trim()) cliente.value.nombre = d.nombre_comercial || d.razon_social
      emit('notify', `Datos de ${d.razon_social} cargados`)
    } else {
      avisoRuc.value = res.error || res.aviso || 'No se encontraron datos para ese RUC'
    }
  } catch (e: any) {
    avisoRuc.value = e?.data?.statusMessage || 'No se pudo consultar el RUC'
  } finally {
    consultandoRuc.value = false
  }
}

function quitarEnlace(i: number) {
  const e = cliente.value.enlaces[i]
  if (e?.id) enlacesEliminados.value.push(e.id)
  cliente.value.enlaces.splice(i, 1)
}

async function guardarCliente() {
  const c = cliente.value
  if (!c.nombre?.trim()) return emit('notify', { text: 'El cliente necesita un nombre', color: 'error' })

  guardando.value = true
  const res = await apiPiola<any>('clientes', {
    accion: 'guardar',
    id: c.id || null,
    nombre: c.nombre, razon_social: c.razon_social, nombre_comercial: c.nombre_comercial,
    ruc: c.ruc, contacto: c.contacto, email: c.email, telefono: c.telefono,
    direccion: c.direccion, direccion_fiscal: c.direccion_fiscal,
    distrito: c.distrito, provincia: c.provincia, departamento: c.departamento,
    condicion_pago_id: c.condicion_pago_id, notas: c.notas,
  })
  if (res.error) {
    guardando.value = false
    return emit('notify', { text: res.error.message, color: 'error' })
  }

  const clienteId = res.data.cliente.id

  // Compromisos: se manda el set completo, el servidor reemplaza
  const compro = await apiPiola('clientes', {
    accion: 'guardar_compromisos',
    cliente_id: clienteId,
    compromisos: (c.compromisos || []).filter((x: any) => x.tipo_contenido),
  })
  if (compro.error) emit('notify', { text: `Compromisos: ${compro.error.message}`, color: 'warning' })

  // Enlaces: uno por uno, porque cada uno es una fila con su propio id
  for (const id of enlacesEliminados.value) {
    await apiPiola('clientes', { accion: 'eliminar_enlace', id })
  }
  for (const e of c.enlaces || []) {
    if (!e.url?.trim() || !e.nombre?.trim()) continue
    const r = await apiPiola('clientes', {
      accion: 'guardar_enlace',
      id: e.id || null, cliente_id: clienteId,
      proveedor: e.proveedor, nombre: e.nombre, url: e.url,
    })
    if (r.error) emit('notify', { text: `Enlace "${e.nombre}": ${r.error.message}`, color: 'warning' })
  }

  guardando.value = false
  emit('notify', c.id ? 'Cliente actualizado' : 'Cliente creado')
  cliente.value = null
  await cargar()
}

async function eliminarCliente() {
  if (!confirm(`¿Eliminar a "${cliente.value.nombre}"?`)) return
  const { data, error } = await apiPiola<any>('clientes', { accion: 'eliminar', id: cliente.value.id })
  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('notify', data.desactivado
    ? { text: data.aviso, color: 'warning' }
    : 'Cliente eliminado')
  cliente.value = null
  await cargar()
}

/* ══════════ Recurrentes ══════════ */
const generando = ref(false)
const generandoId = ref<number | null>(null)

async function generarPendientes() {
  if (!confirm(`Se van a generar ${vencidas.value.length} factura(s) en BORRADOR.\n\n`
    + 'Quedan listas en Facturación para revisarlas y emitirlas.')) return

  generando.value = true
  const { data, error } = await apiPiola<any>('contratos', { accion: 'generar_pendientes' })
  generando.value = false
  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('notify', `${data.generadas} factura(s) en borrador`
    + (data.errores?.length ? ` · ${data.errores.length} con error` : ''))
  await cargar()
}

async function generarUna(prog: any) {
  generandoId.value = prog.id
  const { data, error } = await apiPiola<any>('contratos', { accion: 'generar_programada', id: prog.id })
  generandoId.value = null
  if (error) return emit('notify', { text: error.message, color: 'error' })

  emit('notify', data.generadas
    ? `Factura ${data.facturas[0]?.serie}-${data.facturas[0]?.numero} en borrador`
    : { text: data.errores?.[0]?.error || 'No se generó', color: 'error' })
  await cargar()
}

async function omitir(prog: any) {
  const motivo = prompt(`¿Por qué se omite la factura de ${prog.periodo}?`)
  if (motivo === null) return
  const { error } = await apiPiola('contratos', { accion: 'omitir_programada', id: prog.id, motivo })
  if (error) return emit('notify', { text: error.message, color: 'error' })
  emit('notify', 'Factura programada omitida')
  await cargar()
}

onMounted(cargar)
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 150px; max-width: 220px; }
.filtros-bar .filtro-buscar { flex: 2 1 240px; max-width: 340px; }

.tab-badge {
  background: #e2564a; color: #fff; border-radius: 999px;
  padding: 0 6px; font-size: 10.5px; font-weight: 700; margin-left: 6px;
}

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}
.hint { font-size: 11.5px; opacity: .6; line-height: 1.5; margin-bottom: 10px; }

.ruc-fila { display: flex; gap: 8px; align-items: center; }
.ruc-fila > :first-child { flex: 1; }

.compromiso-fila, .enlace-fila { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.compromiso-fila > :first-child { flex: 1; }
.enlace-fila > :nth-child(3) { flex: 1; }

.total-compromiso { font-size: 12.5px; opacity: .75; margin-top: 8px; }
.sub { font-size: 11px; opacity: .55; }
.alerta { color: #e2564a; font-weight: 600; font-size: 11px; margin-left: 6px; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .compromiso-fila, .enlace-fila { flex-wrap: wrap; }
}
</style>
