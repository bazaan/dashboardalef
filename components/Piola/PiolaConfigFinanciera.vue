<template>
  <div>
    <div class="sub-tabs">
      <button v-for="s in SECCIONES" :key="s.id"
        :class="['tab', { active: seccion === s.id }]" @click="seccion = s.id">
        <v-icon :icon="s.icon" size="15" /> {{ s.label }}
      </button>
    </div>

    <!-- ══════════ MONEDAS ══════════ -->
    <v-card v-if="seccion === 'monedas'" flat class="custom-data-table pa-4">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        La moneda <b>principal</b> es en la que se expresan los reportes. Las adicionales guardan
        su tipo de cambio contra ella. Solo una puede ser la principal.
      </v-alert>
      <FilaNueva v-if="puedeEditar" :campos="camposMoneda" @crear="crear('piola_monedas', $event)" />
      <v-data-table :headers="headersMoneda" :items="monedas" class="elevation-0"
        no-data-text="Sin monedas" :items-per-page="20">
        <template v-slot:item.es_principal="{ item }">
          <v-btn :icon="item.es_principal ? 'mdi-star' : 'mdi-star-outline'" size="x-small" variant="text"
            :color="item.es_principal ? 'warning' : undefined" :disabled="!puedeEditar"
            :title="item.es_principal ? 'Es la principal' : 'Marcar como principal'"
            @click="marcarPrincipal(item)" />
        </template>
        <template v-slot:item.tipo_cambio="{ item }">
          <CeldaEditable :valor="item.tipo_cambio" tipo="number" :editable="puedeEditar"
            @guardar="v => actualizar('piola_monedas', item.id, { tipo_cambio: Number(v) })" />
        </template>
        <template v-slot:item.activo="{ item }">
          <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
            :disabled="!puedeEditar || item.es_principal"
            @update:model-value="v => actualizar('piola_monedas', item.id, { activo: !!v })" />
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEliminar && !item.es_principal" icon="mdi-delete" size="x-small"
            variant="text" color="error" @click="eliminar('piola_monedas', item, item.nombre)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ IMPUESTOS ══════════ -->
    <v-card v-else-if="seccion === 'impuestos'" flat class="custom-data-table pa-4">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Las tasas <b>no están en el código</b>: si el IGV cambia, se edita acá.
        Un impuesto que <b>agrega</b> suma al total (IGV); uno que <b>retiene</b> no cambia el total
        pero sí lo que se termina cobrando (renta, detracción).
      </v-alert>
      <FilaNueva v-if="puedeEditar" :campos="camposImpuesto" @crear="crear('piola_impuestos', $event)" />
      <v-data-table :headers="headersImpuesto" :items="impuestos" class="elevation-0"
        no-data-text="Sin impuestos" :items-per-page="20">
        <template v-slot:item.tasa="{ item }">
          <CeldaEditable :valor="item.tasa" tipo="number" sufijo=" %" :editable="puedeEditar"
            @guardar="v => actualizar('piola_impuestos', item.id, { tasa: Number(v) })" />
        </template>
        <template v-slot:item.comportamiento="{ item }">
          <v-chip size="x-small" variant="tonal" :color="item.comportamiento === 'agrega' ? 'info' : 'warning'">
            {{ item.comportamiento === 'agrega' ? 'Agrega al total' : 'Retiene' }}
          </v-chip>
        </template>
        <template v-slot:item.activo="{ item }">
          <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
            :disabled="!puedeEditar"
            @update:model-value="v => actualizar('piola_impuestos', item.id, { activo: !!v })" />
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
            @click="eliminar('piola_impuestos', item, item.nombre)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ COMPROBANTES Y SERIES ══════════ -->
    <div v-else-if="seccion === 'comprobantes'">
      <v-card flat class="custom-data-table pa-4">
        <div class="card-titulo">Tipos de comprobante</div>
        <FilaNueva v-if="puedeEditar" :campos="camposTipoComp"
          @crear="crear('piola_tipos_comprobante', $event)" />
        <v-data-table :headers="headersTipoComp" :items="tiposComprobante" class="elevation-0"
          no-data-text="Sin tipos de comprobante" :items-per-page="20">
          <template v-slot:item.activo="{ item }">
            <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
              :disabled="!puedeEditar"
              @update:model-value="v => actualizar('piola_tipos_comprobante', item.id, { activo: !!v })" />
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
              @click="eliminar('piola_tipos_comprobante', item, item.nombre)" />
          </template>
        </v-data-table>
      </v-card>

      <v-card flat class="custom-data-table pa-4 mt-4">
        <div class="card-titulo">Series y numeración</div>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
          El <b>correlativo</b> es el último número emitido. Cambiarlo a mano puede generar
          comprobantes duplicados o saltos en la numeración ante SUNAT.
        </v-alert>
        <div v-if="puedeEditar" class="fila-nueva">
          <v-select v-model="nuevaSerie.tipo_comprobante_id" :items="opcionesTipoComp"
            label="Tipo de comprobante" density="compact" hide-details variant="outlined" />
          <v-text-field v-model="nuevaSerie.serie" label="Serie" density="compact" hide-details
            variant="outlined" placeholder="F001" style="max-width:140px;" />
          <v-text-field v-model.number="nuevaSerie.correlativo_actual" type="number" label="Correlativo"
            density="compact" hide-details variant="outlined" style="max-width:130px;" />
          <v-btn color="primary" variant="flat" @click="crearSerie">Agregar</v-btn>
        </div>
        <v-data-table :headers="headersSerie" :items="seriesConTipo" class="elevation-0"
          no-data-text="Sin series configuradas" :items-per-page="20">
          <template v-slot:item.correlativo_actual="{ item }">
            <CeldaEditable :valor="item.correlativo_actual" tipo="number" :editable="puedeEditar"
              @guardar="v => actualizar('piola_series', item.id, { correlativo_actual: Number(v) })" />
          </template>
          <template v-slot:item.es_default="{ item }">
            <v-icon v-if="item.es_default" icon="mdi-check-circle" color="success" size="17" />
            <span v-else style="opacity:.3">—</span>
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
              @click="eliminar('piola_series', item, item.serie)" />
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- ══════════ CONDICIONES DE PAGO ══════════ -->
    <v-card v-else-if="seccion === 'condiciones'" flat class="custom-data-table pa-4">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Los <b>días</b> se suman a la fecha de emisión para calcular el vencimiento.
        Contado = 0 días.
      </v-alert>
      <FilaNueva v-if="puedeEditar" :campos="camposCondicion"
        @crear="crear('piola_condiciones_pago', $event)" />
      <v-data-table :headers="headersCondicion" :items="condiciones" class="elevation-0"
        no-data-text="Sin condiciones de pago" :items-per-page="20">
        <template v-slot:item.dias="{ item }">
          <CeldaEditable :valor="item.dias" tipo="number" sufijo=" días" :editable="puedeEditar"
            @guardar="v => actualizar('piola_condiciones_pago', item.id, { dias: Number(v) })" />
        </template>
        <template v-slot:item.activo="{ item }">
          <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
            :disabled="!puedeEditar"
            @update:model-value="v => actualizar('piola_condiciones_pago', item.id, { activo: !!v })" />
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
            @click="eliminar('piola_condiciones_pago', item, item.nombre)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ ÁREAS Y CENTROS DE COSTO ══════════ -->
    <div v-else-if="seccion === 'areas'">
      <v-card flat class="custom-data-table pa-4">
        <div class="card-titulo">Áreas</div>
        <FilaNueva v-if="puedeEditar" :campos="camposArea" @crear="crear('piola_areas', $event)" />
        <v-data-table :headers="headersArea" :items="areas" class="elevation-0"
          no-data-text="Sin áreas" :items-per-page="20">
          <template v-slot:item.activo="{ item }">
            <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
              :disabled="!puedeEditar"
              @update:model-value="v => actualizar('piola_areas', item.id, { activo: !!v })" />
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
              @click="eliminar('piola_areas', item, item.nombre)" />
          </template>
        </v-data-table>
      </v-card>

      <v-card flat class="custom-data-table pa-4 mt-4">
        <div class="card-titulo">Centros de costo</div>
        <div v-if="puedeEditar" class="fila-nueva">
          <v-text-field v-model="nuevoCC.codigo" label="Código" density="compact" hide-details
            variant="outlined" style="max-width:130px;" />
          <v-text-field v-model="nuevoCC.nombre" label="Nombre" density="compact" hide-details
            variant="outlined" />
          <v-select v-model="nuevoCC.area_id" :items="opcionesArea" label="Área" density="compact"
            hide-details variant="outlined" clearable />
          <v-btn color="primary" variant="flat" @click="crearCC">Agregar</v-btn>
        </div>
        <v-data-table :headers="headersCC" :items="centrosConArea" class="elevation-0"
          no-data-text="Sin centros de costo" :items-per-page="20">
          <template v-slot:item.activo="{ item }">
            <v-switch :model-value="item.activo" color="primary" density="compact" hide-details
              :disabled="!puedeEditar"
              @update:model-value="v => actualizar('piola_centros_costo', item.id, { activo: !!v })" />
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
              @click="eliminar('piola_centros_costo', item, item.nombre)" />
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- ══════════ PROVEEDORES ══════════ -->
    <v-card v-else-if="seccion === 'proveedores'" flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">Proveedores ({{ proveedores.length }})</span>
        <v-spacer />
        <v-btn v-if="puedeEditar" size="small" color="primary" variant="flat" @click="abrirProveedor()">
          <v-icon icon="mdi-plus" start /> Proveedor
        </v-btn>
      </v-card-title>
      <v-data-table :headers="headersProveedor" :items="proveedores" class="elevation-0"
        no-data-text="Sin proveedores registrados" :items-per-page="25"
        @click:row="(_: any, r: any) => puedeEditar && abrirProveedor(r.item)">
        <template v-slot:item.condicion_pago_id="{ item }">
          {{ condiciones.find(c => c.id === item.condicion_pago_id)?.nombre || '—' }}
        </template>
        <template v-slot:item.activo="{ item }">
          <v-chip size="x-small" variant="tonal" :color="item.activo ? 'success' : 'grey'">
            {{ item.activo ? 'Activo' : 'Inactivo' }}
          </v-chip>
        </template>
        <template v-slot:item.acciones="{ item }">
          <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
            @click.stop="eliminar('piola_proveedores', item, item.nombre)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- Diálogo de proveedor -->
    <v-dialog :model-value="!!proveedor" max-width="700" @update:model-value="proveedor = null">
      <v-card v-if="proveedor">
        <v-card-title class="pt-4">{{ proveedor.id ? 'Editar' : 'Nuevo' }} proveedor</v-card-title>
        <v-card-text>
          <v-form ref="formProv">
            <div class="form-grid">
              <v-text-field v-model="proveedor.nombre" label="Nombre *" density="compact"
                variant="outlined" :rules="[v => !!String(v || '').trim() || 'Obligatorio']" />
              <v-text-field v-model="proveedor.ruc" label="RUC" density="compact" variant="outlined"
                maxlength="11" :rules="[ruleRucOpcional]" hint="11 dígitos" persistent-hint />
              <v-text-field v-model="proveedor.razon_social" label="Razón social" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="proveedor.contacto" label="Contacto" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="proveedor.email" label="Correo" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="proveedor.telefono" label="Teléfono" density="compact"
                hide-details variant="outlined" />
              <v-select v-model="proveedor.condicion_pago_id" :items="opcionesCondicion"
                label="Condición de pago" density="compact" hide-details variant="outlined" clearable />
              <v-switch v-model="proveedor.activo" color="primary" density="compact" hide-details
                label="Activo" />
              <v-text-field v-model="proveedor.direccion" label="Dirección" density="compact"
                hide-details variant="outlined" class="col-2" />
            </div>
            <v-textarea v-model="proveedor.notas" label="Notas" rows="2" density="compact"
              hide-details variant="outlined" class="mt-3" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="proveedor = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarProveedor">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Configuración financiera: monedas, impuestos, tipos de comprobante, series,
 * condiciones de pago, áreas, centros de costo y proveedores.
 *
 * Todo son catálogos editables desde la UI. La idea es la misma que ya guiaba
 * las categorías de gasto: que agregar un impuesto o cambiar una tasa no
 * requiera tocar código ni una reunión con desarrollo.
 */
import { ref, computed, onMounted, h } from 'vue'
import { useFormRules } from '@/composables/rules'
import { apiPiola } from '@/composables/usePiola'

const props = defineProps<{
  perfil: any
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const { ruleRuc } = useFormRules()
const ruleRucOpcional = (v: any) => !String(v ?? '').trim() || ruleRuc(v)

const SECCIONES = [
  { id: 'monedas', label: 'Monedas', icon: 'mdi-currency-usd' },
  { id: 'impuestos', label: 'Impuestos', icon: 'mdi-percent' },
  { id: 'comprobantes', label: 'Comprobantes y series', icon: 'mdi-receipt-text' },
  { id: 'condiciones', label: 'Condiciones de pago', icon: 'mdi-calendar-clock' },
  { id: 'areas', label: 'Áreas y centros de costo', icon: 'mdi-sitemap' },
  { id: 'proveedores', label: 'Proveedores', icon: 'mdi-truck' },
]
const seccion = ref('monedas')

const guardando = ref(false)
const monedas = ref<any[]>([])
const impuestos = ref<any[]>([])
const tiposComprobante = ref<any[]>([])
const series = ref<any[]>([])
const condiciones = ref<any[]>([])
const areas = ref<any[]>([])
const centros = ref<any[]>([])
const proveedores = ref<any[]>([])

/* ══════════ Carga ══════════ */
async function cargar() {
  const [mo, im, tc, se, co, ar, cc, pr] = await Promise.all([
    client.from('piola_monedas').select('*').order('orden'),
    client.from('piola_impuestos').select('*').order('orden'),
    client.from('piola_tipos_comprobante').select('*').order('orden'),
    client.from('piola_series').select('*').order('serie'),
    client.from('piola_condiciones_pago').select('*').order('orden'),
    client.from('piola_areas').select('*').order('orden'),
    client.from('piola_centros_costo').select('*').order('orden'),
    client.from('piola_proveedores').select('*').order('nombre'),
  ])
  if (mo.error) {
    emit('notify', {
      text: 'No se pudo cargar la configuración financiera. ¿Se corrió la migración 03?',
      color: 'error',
    })
  }
  monedas.value = (mo.data as any[]) || []
  impuestos.value = (im.data as any[]) || []
  tiposComprobante.value = (tc.data as any[]) || []
  series.value = (se.data as any[]) || []
  condiciones.value = (co.data as any[]) || []
  areas.value = (ar.data as any[]) || []
  centros.value = (cc.data as any[]) || []
  proveedores.value = (pr.data as any[]) || []
}

/* ══════════ CRUD genérico ══════════ */
async function crear(tabla: string, fila: Record<string, any>) {
  const { error } = await apiPiola('configuracion', { accion: 'catalogo_crear', tabla, fila })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Agregado')
  await cargar()
}

async function actualizar(tabla: string, id: any, patch: Record<string, any>) {
  const { error } = await apiPiola('configuracion', { accion: 'catalogo_actualizar', tabla, id, patch })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

async function eliminar(tabla: string, item: any, nombre: string) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return
  const { error } = await apiPiola('configuracion', { accion: 'catalogo_eliminar', tabla, id: item.id })
  if (error) {
    // FK violada: el catálogo está en uso
    const msg = /violates foreign key|23503/i.test(error.message)
      ? `"${nombre}" está en uso por movimientos existentes. Desactívalo en vez de eliminarlo.`
      : `Error: ${error.message}`
    return emit('notify', { text: msg, color: 'error' })
  }
  emit('notify', 'Eliminado')
  await cargar()
}

/** La principal es única: se apaga la anterior antes de encender la nueva. */
async function marcarPrincipal(m: any) {
  if (m.es_principal) return
  // Las dos escrituras van juntas en el servidor: si la segunda fallara desde
  // el navegador, el sistema se quedaría sin moneda principal.
  const { error } = await apiPiola('configuracion', { accion: 'moneda_principal', id: m.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', `${m.nombre} es ahora la moneda principal`)
  await cargar()
}

/* ══════════ Definición de columnas y formularios rápidos ══════════ */
const acc = { title: '', key: 'acciones', sortable: false }

const headersMoneda = [
  { title: 'Código', key: 'codigo' }, { title: 'Nombre', key: 'nombre' },
  { title: 'Símbolo', key: 'simbolo' }, { title: 'Principal', key: 'es_principal', sortable: false },
  { title: 'Tipo de cambio', key: 'tipo_cambio' }, { title: 'Activa', key: 'activo', sortable: false }, acc,
]
const camposMoneda = [
  { key: 'codigo', label: 'Código', ancho: '110px' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'simbolo', label: 'Símbolo', ancho: '110px' },
  { key: 'tipo_cambio', label: 'T. de cambio', tipo: 'number', ancho: '140px', def: 1 },
]

const headersImpuesto = [
  { title: 'Código', key: 'codigo' }, { title: 'Nombre', key: 'nombre' },
  { title: 'Tipo', key: 'tipo' }, { title: 'Tasa', key: 'tasa' },
  { title: 'Comportamiento', key: 'comportamiento', sortable: false },
  { title: 'Aplica a', key: 'aplica_a' }, { title: 'Activo', key: 'activo', sortable: false }, acc,
]
const camposImpuesto = [
  { key: 'codigo', label: 'Código', ancho: '120px' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'tasa', label: 'Tasa %', tipo: 'number', ancho: '110px', def: 0 },
  { key: 'tipo', label: 'Tipo', opciones: ['igv', 'renta', 'detraccion', 'otro'], ancho: '140px', def: 'otro' },
  { key: 'comportamiento', label: 'Comportamiento', opciones: ['agrega', 'retiene'], ancho: '150px', def: 'agrega' },
  { key: 'aplica_a', label: 'Aplica a', opciones: ['ingreso', 'egreso', 'ambos'], ancho: '130px', def: 'ambos' },
]

const headersTipoComp = [
  { title: 'Código', key: 'codigo' }, { title: 'Nombre', key: 'nombre' },
  { title: 'Cód. SUNAT', key: 'codigo_sunat' }, { title: 'Aplica a', key: 'aplica_a' },
  { title: 'Activo', key: 'activo', sortable: false }, acc,
]
const camposTipoComp = [
  { key: 'codigo', label: 'Código', ancho: '130px' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'codigo_sunat', label: 'Cód. SUNAT', tipo: 'number', ancho: '130px' },
  { key: 'aplica_a', label: 'Aplica a', opciones: ['ingreso', 'egreso', 'ambos'], ancho: '130px', def: 'ambos' },
]

const headersSerie = [
  { title: 'Comprobante', key: 'tipo_nombre' }, { title: 'Serie', key: 'serie' },
  { title: 'Último correlativo', key: 'correlativo_actual' },
  { title: 'Por defecto', key: 'es_default', sortable: false }, acc,
]

const headersCondicion = [
  { title: 'Nombre', key: 'nombre' }, { title: 'Días', key: 'dias' },
  { title: 'Descripción', key: 'descripcion' },
  { title: 'Activa', key: 'activo', sortable: false }, acc,
]
const camposCondicion = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'dias', label: 'Días', tipo: 'number', ancho: '110px', def: 0 },
  { key: 'descripcion', label: 'Descripción' },
]

const headersArea = [
  { title: 'Nombre', key: 'nombre' }, { title: 'Descripción', key: 'descripcion' },
  { title: 'Activa', key: 'activo', sortable: false }, acc,
]
const camposArea = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'descripcion', label: 'Descripción' },
]

const headersCC = [
  { title: 'Código', key: 'codigo' }, { title: 'Nombre', key: 'nombre' },
  { title: 'Área', key: 'area_nombre' }, { title: 'Activo', key: 'activo', sortable: false }, acc,
]

const headersProveedor = [
  { title: 'Nombre', key: 'nombre' }, { title: 'RUC', key: 'ruc' },
  { title: 'Contacto', key: 'contacto' }, { title: 'Teléfono', key: 'telefono' },
  { title: 'Condición de pago', key: 'condicion_pago_id' },
  { title: 'Estado', key: 'activo', sortable: false }, acc,
]

/* ══════════ Derivados ══════════ */
const opcionesTipoComp = computed(() =>
  tiposComprobante.value.map(t => ({ value: t.id, title: t.nombre })))
const opcionesArea = computed(() => areas.value.map(a => ({ value: a.id, title: a.nombre })))
const opcionesCondicion = computed(() => condiciones.value.map(c => ({ value: c.id, title: c.nombre })))

const seriesConTipo = computed(() => series.value.map(s => ({
  ...s,
  tipo_nombre: tiposComprobante.value.find(t => t.id === s.tipo_comprobante_id)?.nombre || '—',
})))
const centrosConArea = computed(() => centros.value.map(c => ({
  ...c,
  area_nombre: areas.value.find(a => a.id === c.area_id)?.nombre || '—',
})))

/* ══════════ Altas con forma propia ══════════ */
const nuevaSerie = ref<any>({ tipo_comprobante_id: null, serie: '', correlativo_actual: 0 })
async function crearSerie() {
  const n = nuevaSerie.value
  if (!n.tipo_comprobante_id || !n.serie?.trim()) {
    return emit('notify', { text: 'La serie necesita tipo de comprobante y nombre', color: 'error' })
  }
  await crear('piola_series', {
    tipo_comprobante_id: n.tipo_comprobante_id,
    serie: n.serie.trim().toUpperCase(),
    correlativo_actual: Number(n.correlativo_actual || 0),
  })
  nuevaSerie.value = { tipo_comprobante_id: null, serie: '', correlativo_actual: 0 }
}

const nuevoCC = ref<any>({ codigo: '', nombre: '', area_id: null })
async function crearCC() {
  const n = nuevoCC.value
  if (!n.nombre?.trim()) return emit('notify', { text: 'El centro de costo necesita nombre', color: 'error' })
  await crear('piola_centros_costo', {
    codigo: n.codigo?.trim() || null,
    nombre: n.nombre.trim(),
    area_id: n.area_id || null,
  })
  nuevoCC.value = { codigo: '', nombre: '', area_id: null }
}

/* ══════════ Proveedores ══════════ */
const proveedor = ref<any>(null)
const formProv = ref<any>(null)

function abrirProveedor(p?: any) {
  proveedor.value = p
    ? { ...p }
    : {
        nombre: '', ruc: '', razon_social: '', contacto: '', email: '',
        telefono: '', direccion: '', condicion_pago_id: null, notas: '', activo: true,
      }
}

async function guardarProveedor() {
  const validacion = await formProv.value?.validate()
  if (validacion && validacion.valid === false) {
    return emit('notify', { text: 'Revisa los campos marcados', color: 'error' })
  }
  const p = proveedor.value
  guardando.value = true
  const fila = {
    nombre: p.nombre.trim(),
    ruc: String(p.ruc || '').trim() || null,
    razon_social: p.razon_social || null,
    contacto: p.contacto || null,
    email: p.email || null,
    telefono: p.telefono || null,
    direccion: p.direccion || null,
    condicion_pago_id: p.condicion_pago_id || null,
    notas: p.notas || null,
    activo: p.activo !== false,
  }
  const res = p.id
    ? await apiPiola('configuracion', { accion: 'catalogo_actualizar', tabla: 'piola_proveedores', id: p.id, patch: fila })
    : await apiPiola('configuracion', { accion: 'catalogo_crear', tabla: 'piola_proveedores', fila })
  guardando.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', p.id ? 'Proveedor actualizado' : 'Proveedor creado')
  proveedor.value = null
  await cargar()
}

/* ══════════════════════════════════════════════════════════════════
 * Dos componentes chicos, definidos acá porque solo esta pantalla los usa:
 *   FilaNueva     — el formulario de alta rápida de un catálogo
 *   CeldaEditable — editar un número en la tabla sin abrir un diálogo
 * ══════════════════════════════════════════════════════════════════ */

const FilaNueva = {
  props: { campos: { type: Array as () => any[], required: true } },
  emits: ['crear'],
  setup(p: any, { emit: e }: any) {
    const valores = ref<Record<string, any>>({})
    const reset = () => {
      const v: Record<string, any> = {}
      for (const c of p.campos) v[c.key] = c.def ?? (c.tipo === 'number' ? null : '')
      valores.value = v
    }
    reset()
    const enviar = () => {
      const fila: Record<string, any> = {}
      for (const c of p.campos) {
        const raw = valores.value[c.key]
        if (raw === '' || raw === null || raw === undefined) { fila[c.key] = c.def ?? null; continue }
        fila[c.key] = c.tipo === 'number' ? Number(raw) : String(raw).trim()
      }
      const primero = p.campos[0].key
      if (!fila[primero]) return
      e('crear', fila)
      reset()
    }
    return () => h('div', { class: 'fila-nueva' }, [
      ...p.campos.map((c: any) => c.opciones
        ? h(resolveComponent('v-select') as any, {
            modelValue: valores.value[c.key], 'onUpdate:modelValue': (v: any) => (valores.value[c.key] = v),
            items: c.opciones, label: c.label, density: 'compact', hideDetails: true,
            variant: 'outlined', style: c.ancho ? `max-width:${c.ancho}` : undefined,
          })
        : h(resolveComponent('v-text-field') as any, {
            modelValue: valores.value[c.key], 'onUpdate:modelValue': (v: any) => (valores.value[c.key] = v),
            label: c.label, type: c.tipo || 'text', density: 'compact', hideDetails: true,
            variant: 'outlined', style: c.ancho ? `max-width:${c.ancho}` : undefined,
            onKeyup: (ev: KeyboardEvent) => { if (ev.key === 'Enter') enviar() },
          })),
      h(resolveComponent('v-btn') as any, { color: 'primary', variant: 'flat', onClick: enviar }, () => 'Agregar'),
    ])
  },
}

const CeldaEditable = {
  props: {
    valor: [String, Number],
    tipo: { type: String, default: 'text' },
    sufijo: { type: String, default: '' },
    editable: { type: Boolean, default: true },
  },
  emits: ['guardar'],
  setup(p: any, { emit: e }: any) {
    const editando = ref(false)
    const borrador = ref<any>(p.valor)
    const confirmar = () => {
      editando.value = false
      if (String(borrador.value) !== String(p.valor)) e('guardar', borrador.value)
    }
    return () => editando.value
      ? h(resolveComponent('v-text-field') as any, {
          modelValue: borrador.value, 'onUpdate:modelValue': (v: any) => (borrador.value = v),
          type: p.tipo, density: 'compact', hideDetails: true, variant: 'outlined',
          autofocus: true, style: 'max-width:120px',
          onBlur: confirmar,
          onKeyup: (ev: KeyboardEvent) => {
            if (ev.key === 'Enter') confirmar()
            if (ev.key === 'Escape') { borrador.value = p.valor; editando.value = false }
          },
        })
      : h('span', {
          class: p.editable ? 'celda-editable' : '',
          title: p.editable ? 'Clic para editar' : '',
          onClick: () => { if (p.editable) { borrador.value = p.valor; editando.value = true } },
        }, `${p.valor ?? '—'}${p.sufijo}`)
  },
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.sub-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; }
.sub-tabs .tab { display: flex; align-items: center; gap: 6px; }

.card-titulo {
  font-weight: 600; font-size: 14px; margin-bottom: 12px;
}

.fila-nueva {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px;
  padding-bottom: 14px; border-bottom: 1px dashed rgba(128, 128, 128, .3);
}
.fila-nueva > * { flex: 1 1 150px; }
.fila-nueva > button, .fila-nueva > .v-btn { flex: 0 0 auto; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }

:deep(.celda-editable) {
  cursor: pointer; border-bottom: 1px dashed rgba(128, 128, 128, .5); padding-bottom: 1px;
}
:deep(.celda-editable:hover) { color: #e2564a; border-bottom-color: #e2564a; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
}
</style>
