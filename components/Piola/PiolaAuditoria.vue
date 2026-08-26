<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      Cada alta, cambio y baja queda registrada automáticamente por la base de datos.
      El registro es de <b>solo lectura</b>: no se puede editar ni borrar desde el dashboard,
      porque un log que el auditado puede modificar no sirve como auditoría.
    </v-alert>

    <v-alert v-if="hayMas" type="warning" variant="tonal" density="compact" class="mb-4">
      Mostrando los últimos {{ TOPE_EVENTOS }} movimientos. Ajustá los filtros de fecha
      para ver más atrás.
    </v-alert>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Eventos</span></div>
        <div class="stat-value">{{ filtrados.length }}</div>
        <div class="stat-description">Según los filtros activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Modificaciones</span></div>
        <div class="stat-value">{{ conteo.UPDATE }}</div>
        <div class="stat-description">Registros editados</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Eliminaciones</span></div>
        <div class="stat-value" :style="{ color: conteo.DELETE ? '#e2564a' : undefined }">
          {{ conteo.DELETE }}
        </div>
        <div class="stat-description">Registros borrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Anulaciones</span></div>
        <div class="stat-value">{{ anulaciones.length }}</div>
        <div class="stat-description">Con su motivo registrado</div>
      </div>
    </div>

    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">Registro de actividad</span>
        <v-spacer />
        <v-btn size="small" variant="text" :loading="cargando" @click="cargar">
          <v-icon icon="mdi-refresh" start /> Actualizar
        </v-btn>
      </v-card-title>

      <div class="filtros-bar">
        <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
          placeholder="Usuario, motivo, campo…" density="compact" hide-details
          variant="outlined" clearable class="filtro filtro-buscar" />
        <v-select v-model="fTabla" :items="opcionesTabla" label="Módulo" density="compact"
          hide-details variant="outlined" class="filtro" />
        <v-select v-model="fOperacion" :items="OPCIONES_OPERACION" label="Operación"
          density="compact" hide-details variant="outlined" class="filtro" />
        <v-select v-model="fUsuario" :items="opcionesUsuario" label="Usuario" density="compact"
          hide-details variant="outlined" class="filtro" />
        <v-text-field v-model="fDesde" type="date" label="Desde" density="compact" hide-details
          variant="outlined" clearable class="filtro filtro-fecha" />
        <v-text-field v-model="fHasta" type="date" label="Hasta" density="compact" hide-details
          variant="outlined" clearable class="filtro filtro-fecha" />
      </div>

      <v-data-table :headers="headers" :items="filtrados" :loading="cargando" class="elevation-0"
        no-data-text="Sin eventos registrados" :items-per-page="50"
        @click:row="(_: any, r: any) => detalle = r.item">
        <template v-slot:item.created_at="{ item }">{{ fechaHora(item.created_at) }}</template>
        <template v-slot:item.operacion="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorOperacion(item.operacion)">
            {{ etiquetaOperacion(item.operacion) }}
          </v-chip>
        </template>
        <template v-slot:item.tabla="{ item }">{{ etiquetaTabla(item.tabla) }}</template>
        <template v-slot:item.campos="{ item }">
          <span v-if="!item.campos?.length" style="opacity:.35">—</span>
          <template v-else>
            <v-chip v-for="c in item.campos.slice(0, 3)" :key="c" size="x-small"
              variant="tonal" class="mr-1">{{ etiquetaCampo(c) }}</v-chip>
            <span v-if="item.campos.length > 3" class="mas-campos">
              +{{ item.campos.length - 3 }}
            </span>
          </template>
        </template>
        <template v-slot:item.estado="{ item }">
          <span v-if="item.estado_anterior !== item.estado_nuevo && item.estado_nuevo">
            {{ item.estado_anterior || '—' }} → <strong>{{ item.estado_nuevo }}</strong>
          </span>
          <span v-else style="opacity:.35">—</span>
        </template>
        <template v-slot:item.usuario="{ item }">{{ item.usuario || 'sistema' }}</template>
      </v-data-table>
    </v-card>

    <!-- ══════════ DETALLE DEL CAMBIO ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="820" scrollable @update:model-value="detalle = null">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <v-chip size="small" variant="flat" :color="colorOperacion(detalle.operacion)">
            {{ etiquetaOperacion(detalle.operacion) }}
          </v-chip>
          <span style="font-weight:700;">
            {{ etiquetaTabla(detalle.tabla) }} #{{ detalle.registro_id }}
          </span>
        </v-card-title>

        <v-card-text>
          <div class="detalle-campos">
            <div><span>Fecha y hora</span><strong>{{ fechaHora(detalle.created_at) }}</strong></div>
            <div><span>Usuario</span><strong>{{ detalle.usuario || 'sistema' }}</strong></div>
            <div v-if="detalle.estado_anterior || detalle.estado_nuevo">
              <span>Estado</span>
              <strong>{{ detalle.estado_anterior || '—' }} → {{ detalle.estado_nuevo || '—' }}</strong>
            </div>
            <div v-if="detalle.motivo"><span>Motivo</span><strong>{{ detalle.motivo }}</strong></div>
          </div>

          <!-- Qué cambió, campo por campo -->
          <template v-if="detalle.operacion === 'UPDATE'">
            <div class="form-section-title mt-5">Cambios ({{ detalle.campos?.length || 0 }})</div>
            <v-table density="compact">
              <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
              <tbody>
                <tr v-for="c in (detalle.campos || [])" :key="c">
                  <td><strong>{{ etiquetaCampo(c) }}</strong></td>
                  <td :class="esCensurado(detalle.datos_antes?.[c]) ? 'valor-oculto' : 'valor-antes'">
                    {{ formatoValor(detalle.datos_antes?.[c]) }}
                  </td>
                  <td :class="esCensurado(detalle.datos_despues?.[c]) ? 'valor-oculto' : 'valor-despues'">
                    {{ formatoValor(detalle.datos_despues?.[c]) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <!-- Alta o baja: la fila entera -->
          <template v-else>
            <div class="form-section-title mt-5">
              {{ detalle.operacion === 'INSERT' ? 'Registro creado' : 'Registro eliminado' }}
            </div>
            <v-table density="compact">
              <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
              <tbody>
                <tr v-for="(v, k) in camposRelevantes" :key="k">
                  <td><strong>{{ etiquetaCampo(String(k)) }}</strong></td>
                  <td :class="{ 'valor-oculto': esCensurado(v) }">{{ formatoValor(v) }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <v-expansion-panels class="mt-5" variant="accordion">
            <v-expansion-panel title="Ver los datos completos (JSON)">
              <template #text>
                <pre class="json-crudo">{{ jsonLegible }}</pre>
              </template>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detalle = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Auditoría: quién creó, quién modificó, qué modificó, cuándo, con qué estado
 * anterior y nuevo, quién anuló y por qué.
 *
 * No hay lógica de registro acá: lo escribe un trigger en la base
 * (piola_auditoria_trigger), de modo que un cambio queda registrado aunque se
 * haga desde la consola de Supabase y no desde el dashboard. Esta pantalla solo
 * lee y traduce a algo legible.
 */
import { ref, computed, onMounted } from 'vue'
import { fechaHora, fechaCorta } from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()

/** Tope de la consulta. Si llegan exactamente estos, hay más atrás. */
const TOPE_EVENTOS = 1000

const cargando = ref(false)
const eventos = ref<any[]>([])
const hayMas = computed(() => eventos.value.length >= TOPE_EVENTOS)
const detalle = ref<any>(null)

const fBuscar = ref('')
const fTabla = ref('todas')
const fOperacion = ref('todas')
const fUsuario = ref('todos')
const fDesde = ref('')
const fHasta = ref('')

/** Nombres técnicos → nombres de negocio. */
const TABLAS: Record<string, string> = {
  piola_transactions: 'Ingresos y gastos',
  piola_pagos: 'Pagos y cobros',
  piola_invoices: 'Facturación',
  piola_contratos: 'Contratos',
  piola_adendas: 'Adendas',
  piola_caja_sesiones: 'Caja — sesiones',
  piola_caja_movimientos: 'Caja — movimientos',
  piola_presupuestos: 'Presupuestos',
  piola_colaboradores: 'Colaboradores',
}

const CAMPOS: Record<string, string> = {
  monto: 'Monto', subtotal: 'Subtotal', descuento: 'Descuento', impuestos: 'Impuestos',
  monto_pagado: 'Monto pagado', estado: 'Estado', fecha: 'Fecha',
  fecha_vencimiento: 'Vencimiento', concepto: 'Concepto', notas: 'Observaciones',
  cliente_id: 'Cliente', proveedor_id: 'Proveedor', category_id: 'Categoría',
  area_id: 'Área', centro_costo_id: 'Centro de costo', payment_method: 'Método de pago',
  responsable_email: 'Responsable', created_by: 'Creado por', updated_by: 'Modificado por',
  anulado_por: 'Anulado por', motivo_anulacion: 'Motivo de anulación',
  documento_adjunto: 'Documento adjunto', precio: 'Precio', cantidad: 'Cantidad',
  nombre: 'Nombre', nombre_cliente: 'Cliente', ruc: 'RUC', importe_pagado: 'Importe pagado',
  sueldo_bruto: 'Remuneración', estado_laboral: 'Estado laboral', cargo: 'Cargo',
  saldo_inicial: 'Saldo inicial', saldo_final: 'Saldo final', diferencia: 'Diferencia',
}

const OPCIONES_OPERACION = [
  { value: 'todas', title: 'Todas' },
  { value: 'INSERT', title: 'Creación' },
  { value: 'UPDATE', title: 'Modificación' },
  { value: 'DELETE', title: 'Eliminación' },
]

/** Campos de ruido que no aportan al leer un alta o una baja. */
const OCULTOS = new Set(['id', 'created_at', 'updated_at', 'impuestos_detalle'])

async function cargar() {
  cargando.value = true
  // El límite es INTENCIONAL: la auditoría crece sin techo y no tiene sentido
  // traerla entera al navegador. 1000 es lo que PostgREST devuelve de todos
  // modos, así que pedir más solo mentiría sobre lo que hace esta consulta.
  const { data, error } = await client.from('piola_auditoria').select('*')
    .order('created_at', { ascending: false }).limit(TOPE_EVENTOS)
  if (error) {
    emit('notify', {
      text: 'No se pudo leer la auditoría. ¿Se corrió la migración 03?',
      color: 'error',
    })
  }
  eventos.value = (data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const etiquetaTabla = (t: string) => TABLAS[t] || t
const etiquetaCampo = (c: string) => CAMPOS[c] || c
const etiquetaOperacion = (o: string) =>
  ({ INSERT: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación' }[o] || o)
const colorOperacion = (o: string) =>
  ({ INSERT: 'success', UPDATE: 'info', DELETE: 'error' }[o] || 'grey')

const opcionesTabla = computed(() => [
  { value: 'todas', title: 'Todos los módulos' },
  ...[...new Set(eventos.value.map(e => e.tabla))]
    .map(t => ({ value: t, title: etiquetaTabla(t) })),
])

const opcionesUsuario = computed(() => [
  { value: 'todos', title: 'Todos los usuarios' },
  ...[...new Set(eventos.value.map(e => e.usuario).filter(Boolean))]
    .sort().map(u => ({ value: u, title: u })),
])

const filtrados = computed(() => {
  let lista = eventos.value
  if (fTabla.value !== 'todas') lista = lista.filter(e => e.tabla === fTabla.value)
  if (fOperacion.value !== 'todas') lista = lista.filter(e => e.operacion === fOperacion.value)
  if (fUsuario.value !== 'todos') lista = lista.filter(e => e.usuario === fUsuario.value)
  if (fDesde.value) lista = lista.filter(e => String(e.created_at).slice(0, 10) >= fDesde.value)
  if (fHasta.value) lista = lista.filter(e => String(e.created_at).slice(0, 10) <= fHasta.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(e => [
      e.usuario, e.motivo, e.estado_nuevo, e.estado_anterior,
      etiquetaTabla(e.tabla), (e.campos || []).map(etiquetaCampo).join(' '),
    ].some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const conteo = computed(() => ({
  INSERT: filtrados.value.filter(e => e.operacion === 'INSERT').length,
  UPDATE: filtrados.value.filter(e => e.operacion === 'UPDATE').length,
  DELETE: filtrados.value.filter(e => e.operacion === 'DELETE').length,
}))

const anulaciones = computed(() =>
  filtrados.value.filter(e => e.estado_nuevo === 'anulado' || e.motivo))

const headers = [
  { title: 'Fecha y hora', key: 'created_at' },
  { title: 'Operación', key: 'operacion', sortable: false },
  { title: 'Módulo', key: 'tabla' },
  { title: 'Registro', key: 'registro_id' },
  { title: 'Qué cambió', key: 'campos', sortable: false },
  { title: 'Estado', key: 'estado', sortable: false },
  { title: 'Usuario', key: 'usuario' },
]

/** En un alta o baja se muestra la fila, pero sin los campos de ruido. */
const camposRelevantes = computed(() => {
  const datos = detalle.value?.datos_despues || detalle.value?.datos_antes || {}
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(datos)) {
    if (OCULTOS.has(k)) continue
    if (v === null || v === '' ) continue
    out[k] = v
  }
  return out
})

/** Marca que pone el trigger en lugar de una remuneración. */
const CENSURADO = '■■■'
const esCensurado = (v: any) => v === CENSURADO

/** El JSON crudo también muestra "(oculto)" en vez del cuadrado. */
const jsonLegible = computed(() => {
  const limpiar = (o: any): any => {
    if (o === null || typeof o !== 'object') return esCensurado(o) ? '(oculto)' : o
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, limpiar(v)]))
  }
  return JSON.stringify(
    { antes: limpiar(detalle.value?.datos_antes), despues: limpiar(detalle.value?.datos_despues) },
    null, 2)
})

function formatoValor(v: any): string {
  if (esCensurado(v)) return '(oculto)'
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  // Las fechas ISO se leen mejor en formato peruano
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fechaCorta(s)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fechaHora(s)
  return s
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 150px; max-width: 200px; }
.filtros-bar .filtro-buscar { flex: 2 1 220px; max-width: 300px; }
.filtros-bar .filtro-fecha { flex: 0 1 145px; min-width: 135px; }

.mas-campos { font-size: 11px; opacity: .55; }

.detalle-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.detalle-campos > div { display: flex; flex-direction: column; gap: 2px; }
.detalle-campos span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.detalle-campos strong { font-size: 13.5px; }

.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.valor-antes { opacity: .6; text-decoration: line-through; }
.valor-oculto { opacity: .45; font-style: italic; }
.valor-despues { font-weight: 600; color: #2e9e5b; }

.json-crudo {
  font-size: 11px; line-height: 1.5; max-height: 320px; overflow: auto;
  background: rgba(128, 128, 128, .08); border-radius: 8px; padding: 12px;
  white-space: pre-wrap; word-break: break-word;
}
</style>
