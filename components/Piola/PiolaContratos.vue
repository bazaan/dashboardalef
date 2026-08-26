<template>
  <div>
    <!-- KPIs -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Contratos vigentes</span></div>
        <div class="stat-value">{{ vigentes.length }}</div>
        <div class="stat-description">Con fecha de cierre por delante</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Por vencer</span>
          <div v-if="porVencer.length" class="stat-change down">atención</div>
        </div>
        <div class="stat-value">{{ porVencer.length }}</div>
        <div class="stat-description">Cierran en los próximos 30 días</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Importe contratado</span></div>
        <div class="stat-value">{{ PEN_CORTO(totalContratado) }}</div>
        <div class="stat-description">Contratos vigentes + sus adendas</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Adendas</span></div>
        <div class="stat-value">{{ adendas.length }}</div>
        <div class="stat-description">{{ PEN_CORTO(totalAdendas) }} adicionales</div>
      </div>
    </div>

    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">Contratos ({{ contratosFiltrados.length }})</span>
        <v-spacer />
        <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-file-sign" size="16" /><span>Nuevo contrato</span>
        </button>
      </v-card-title>

      <div class="filtros-bar">
        <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
          placeholder="Cliente, RUC…" density="compact" hide-details variant="outlined"
          clearable class="filtro filtro-buscar" />
        <v-select v-model="fEstado" :items="OPCIONES_ESTADO" density="compact" hide-details
          variant="outlined" label="Estado" class="filtro" />
      </div>

      <v-data-table :headers="headers" :items="contratosFiltrados" :loading="cargando"
        class="elevation-0" no-data-text="Todavía no hay contratos registrados" :items-per-page="25"
        @click:row="(_: any, r: any) => abrirDetalle(r.item)">
        <template v-slot:item.fecha_inicio="{ item }">{{ fechaCorta(item.fecha_inicio) }}</template>
        <template v-slot:item.fecha_cierre="{ item }">
          <span :class="{ 'texto-alerta': estadoContrato(item) === 'vencido' }">
            {{ fechaCorta(item.fecha_cierre) }}
          </span>
        </template>
        <template v-slot:item.importe_pagado="{ item }">{{ PEN(item.importe_pagado) }}</template>
        <template v-slot:item.modalidad_pago="{ item }">{{ etiquetaModalidad(item.modalidad_pago) }}</template>
        <template v-slot:item.adendas="{ item }">
          <v-chip v-if="adendasDe(item.id).length" size="x-small" variant="tonal">
            {{ adendasDe(item.id).length }}
          </v-chip>
          <span v-else style="opacity:.35">—</span>
        </template>
        <template v-slot:item.estado="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorEstado(estadoContrato(item))">
            {{ textoEstado(estadoContrato(item)) }}
          </v-chip>
        </template>
        <template v-slot:item.contrato_pdf="{ item }">
          <template v-if="item.contrato_pdf">
            <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver el contrato aquí mismo"
              @click.stop="verDocumento(item.contrato_pdf, `Contrato — ${item.nombre_cliente}`)" />
            <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
              :href="urlDoc(item.contrato_pdf)" :download="nombreDe(item.contrato_pdf)" @click.stop />
          </template>
          <span v-else style="opacity:.35">—</span>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ ALTA / EDICIÓN ══════════ -->
    <v-dialog :model-value="!!edicion" max-width="820" scrollable @update:model-value="edicion = null">
      <v-card v-if="edicion">
        <v-card-title class="pt-4">{{ edicion.id ? 'Editar contrato' : 'Nuevo contrato' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <div class="form-section-title">Cliente</div>
            <div class="form-grid">
              <v-select v-model="edicion.cliente_id" :items="opcionesCliente" label="Cliente registrado"
                density="compact" hide-details variant="outlined" clearable
                @update:model-value="autocompletarCliente" />
              <v-text-field v-model="edicion.nombre_cliente" label="Nombre del cliente *"
                density="compact" variant="outlined" :rules="[ruleRequerido]" />
              <v-text-field v-model="edicion.ruc" label="RUC" density="compact" variant="outlined"
                maxlength="11" :rules="[ruleRucOpcional]" hint="11 dígitos" persistent-hint />
            </div>

            <div class="form-section-title" style="margin-top:18px;">Vigencia y pago</div>
            <div class="form-grid">
              <v-text-field v-model="edicion.fecha_inicio" type="date" label="Fecha de inicio"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model="edicion.fecha_cierre" type="date" label="Fecha de cierre"
                density="compact" variant="outlined" :rules="[ruleRangoFechas]" />
              <v-text-field v-model.number="edicion.importe_pagado" type="number" min="0"
                label="Importe pagado (S/)" density="compact" hide-details variant="outlined" />
              <v-select v-model="edicion.modalidad_pago" :items="MODALIDADES_PAGO"
                label="Modalidad de pago" density="compact" hide-details variant="outlined" clearable />
            </div>

            <div class="form-section-title" style="margin-top:18px;">Documento</div>
            <PiolaSubirPdf v-model="edicion.contrato_pdf" carpeta="contratos"
              label="Contrato firmado (PDF)" :disabled="!puedeEditar"
              @error="(m: string) => emit('notify', { text: m, color: 'error' })" />

            <v-textarea v-model="edicion.notas" label="Notas" rows="2" density="compact"
              hide-details variant="outlined" class="mt-4" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="edicion = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarContrato">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ DETALLE + ADENDAS ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="900" scrollable @update:model-value="cerrarDetalle">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700;">{{ detalle.nombre_cliente }}</span>
          <v-chip size="small" variant="flat" :color="colorEstado(estadoContrato(detalle))">
            {{ textoEstado(estadoContrato(detalle)) }}
          </v-chip>
        </v-card-title>

        <v-card-text>
          <div class="detalle-campos">
            <div><span>RUC</span><strong>{{ detalle.ruc || '—' }}</strong></div>
            <div><span>Inicio</span><strong>{{ fechaCorta(detalle.fecha_inicio) }}</strong></div>
            <div><span>Cierre</span><strong>{{ fechaCorta(detalle.fecha_cierre) }}</strong></div>
            <div><span>Importe pagado</span><strong>{{ PEN(detalle.importe_pagado) }}</strong></div>
            <div><span>Modalidad</span><strong>{{ etiquetaModalidad(detalle.modalidad_pago) }}</strong></div>
            <div><span>Con adendas</span><strong>{{ PEN(totalConAdendas(detalle)) }}</strong></div>
          </div>

          <div v-if="detalle.notas" class="notas-caja">{{ detalle.notas }}</div>

          <div v-if="detalle.contrato_pdf" class="doc-fila">
            <v-icon icon="mdi-file-pdf-box" color="error" size="20" />
            <span>{{ nombreDe(detalle.contrato_pdf) }}</span>
            <v-spacer />
            <v-btn size="small" variant="tonal"
              @click="verDocumento(detalle.contrato_pdf, `Contrato — ${detalle.nombre_cliente}`)">
              <v-icon icon="mdi-eye" start /> Ver
            </v-btn>
            <v-btn size="small" variant="text" :href="urlDoc(detalle.contrato_pdf)"
              :download="nombreDe(detalle.contrato_pdf)">
              <v-icon icon="mdi-download" start /> Descargar
            </v-btn>
          </div>

          <v-divider class="my-5" />

          <!-- ── Adendas (1:N) ── -->
          <div class="form-section-title" style="display:flex; align-items:center; gap:10px;">
            <span>Adendas ({{ adendasDetalle.length }})</span>
            <v-spacer />
            <v-btn v-if="puedeCrear && !nuevaAdenda" size="small" variant="tonal" @click="abrirAdenda">
              <v-icon icon="mdi-plus" start /> Agregar adenda
            </v-btn>
          </div>

          <div v-if="nuevaAdenda" class="adenda-form">
            <div class="form-grid">
              <v-text-field v-model="nuevaAdenda.fecha" type="date" label="Fecha"
                density="compact" hide-details variant="outlined" />
              <v-text-field v-model.number="nuevaAdenda.importe" type="number" label="Importe (S/)"
                density="compact" hide-details variant="outlined" />
            </div>
            <v-textarea v-model="nuevaAdenda.descripcion" label="Descripción *" rows="2"
              density="compact" hide-details variant="outlined" class="mt-3" />
            <div class="mt-3">
              <PiolaSubirPdf v-model="nuevaAdenda.archivo_pdf" carpeta="adendas"
                label="Adenda firmada (PDF)"
                @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
            </div>
            <div class="adenda-acciones">
              <v-btn variant="text" size="small" @click="nuevaAdenda = null">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" size="small" :loading="guardandoAdenda"
                @click="guardarAdenda">Guardar adenda</v-btn>
            </div>
          </div>

          <v-table v-if="adendasDetalle.length" density="compact" class="mt-3">
            <thead>
              <tr>
                <th>Fecha</th><th>Descripción</th>
                <th class="text-right">Importe</th><th class="text-right">Documento</th><th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in adendasDetalle" :key="a.id">
                <td>{{ fechaCorta(a.fecha) }}</td>
                <td>{{ a.descripcion || '—' }}</td>
                <td class="text-right">{{ PEN(a.importe) }}</td>
                <td class="text-right">
                  <template v-if="a.archivo_pdf">
                    <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver aquí mismo"
                      @click="verDocumento(a.archivo_pdf, `Adenda — ${detalle.nombre_cliente}`)" />
                    <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
                      :href="urlDoc(a.archivo_pdf)" :download="nombreDe(a.archivo_pdf)" />
                  </template>
                  <span v-else style="opacity:.35">—</span>
                </td>
                <td class="text-right">
                  <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text"
                    color="error" @click="eliminarAdenda(a)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-else-if="!nuevaAdenda" class="sin-adendas">
            Este contrato todavía no tiene adendas.
          </div>
        </v-card-text>

        <v-card-actions style="padding: 12px 20px 18px; flex-wrap:wrap; gap:8px;">
          <v-btn v-if="puedeEliminar" color="error" variant="text" @click="eliminarContrato">
            Eliminar contrato
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="cerrarDetalle">Cerrar</v-btn>
          <v-btn v-if="puedeEditar" color="primary" variant="flat" @click="editarDesdeDetalle">
            Editar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Contratos y adendas — pestaña del módulo Facturación (reunión 19/08).
 *
 * No es un módulo aparte: vive dentro de PiolaFacturacion.vue y usa su mismo
 * permiso `facturacion`, por eso recibe los flags ya calculados por props en
 * vez de volver a consultarlos.
 *
 * Un contrato tiene N adendas (piola_adendas, ON DELETE CASCADE). Los PDF se
 * guardan como path del bucket `piola-docs` y se abren con el visor embebido,
 * nunca en pestaña nueva.
 */
import { ref, computed, onMounted } from 'vue'
import {
  PEN, PEN_CORTO, fechaCorta, hoyISO, urlDocumento, MODALIDADES_PAGO, traerTodo, apiPiola,
} from '@/composables/usePiola'
import { useFormRules } from '@/composables/rules'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

const props = defineProps<{
  perfil: any
  puedeCrear: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const { ruleRuc } = useFormRules()

const cargando = ref(false)
const contratos = ref<any[]>([])
const adendas = ref<any[]>([])
const clientes = ref<any[]>([])

const fBuscar = ref('')
const fEstado = ref('todos')

const OPCIONES_ESTADO = [
  { value: 'todos', title: 'Todos' },
  { value: 'vigente', title: 'Vigentes' },
  { value: 'por_vencer', title: 'Por vencer' },
  { value: 'vencido', title: 'Vencidos' },
  { value: 'sin_fecha', title: 'Sin fecha de cierre' },
]

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [c, a, cl] = await Promise.all([
    traerTodo(() => client.from('piola_contratos').select('*')
      .order('fecha_inicio', { ascending: false }).order('id')),
    traerTodo(() => client.from('piola_adendas').select('*')
      .order('fecha', { ascending: false }).order('id')),
    client.from('piola_clientes').select('id, nombre, razon_social, ruc').eq('activo', true).order('nombre'),
  ])
  if (c.error) emit('notify', { text: `Error cargando contratos: ${c.error.message}`, color: 'error' })
  contratos.value = (c.data as any[]) || []
  adendas.value = (a.data as any[]) || []
  clientes.value = (cl.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const opcionesCliente = computed(() => clientes.value.map(c => ({ value: c.id, title: c.nombre })))
const adendasDe = (contratoId: any) => adendas.value.filter(a => a.contrato_id === contratoId)
const etiquetaModalidad = (v: any) =>
  MODALIDADES_PAGO.find(m => m.value === v)?.title || v || '—'

/** Vigente / por vencer (30 días) / vencido, calculado contra la fecha de cierre. */
function estadoContrato(c: any): string {
  if (!c?.fecha_cierre) return 'sin_fecha'
  const cierre = String(c.fecha_cierre).slice(0, 10)
  const hoy = hoyISO()
  if (cierre < hoy) return 'vencido'
  const dias = (Date.parse(`${cierre}T12:00:00`) - Date.parse(`${hoy}T12:00:00`)) / 86400000
  return dias <= 30 ? 'por_vencer' : 'vigente'
}
const textoEstado = (e: string) => ({
  vigente: 'Vigente', por_vencer: 'Por vencer', vencido: 'Vencido', sin_fecha: 'Sin fecha',
}[e] || e)
const colorEstado = (e: string) => ({
  vigente: 'success', por_vencer: 'warning', vencido: 'error', sin_fecha: 'grey',
}[e] || 'grey')

const vigentes = computed(() => contratos.value.filter(c => ['vigente', 'por_vencer'].includes(estadoContrato(c))))
const porVencer = computed(() => contratos.value.filter(c => estadoContrato(c) === 'por_vencer'))
const totalAdendas = computed(() => adendas.value.reduce((s, a) => s + Number(a.importe || 0), 0))
const totalContratado = computed(() => vigentes.value.reduce((s, c) => s + totalConAdendas(c), 0))

/** Importe del contrato más el de todas sus adendas. */
function totalConAdendas(c: any): number {
  return Number(c.importe_pagado || 0)
    + adendasDe(c.id).reduce((s, a) => s + Number(a.importe || 0), 0)
}

const contratosFiltrados = computed(() => {
  let lista = contratos.value
  if (fEstado.value !== 'todos') lista = lista.filter(c => estadoContrato(c) === fEstado.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(c => [c.nombre_cliente, c.ruc, c.notas]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const headers = [
  { title: 'Cliente', key: 'nombre_cliente' },
  { title: 'RUC', key: 'ruc' },
  { title: 'Inicio', key: 'fecha_inicio' },
  { title: 'Cierre', key: 'fecha_cierre' },
  { title: 'Importe pagado', key: 'importe_pagado' },
  { title: 'Modalidad', key: 'modalidad_pago' },
  { title: 'Adendas', key: 'adendas', sortable: false },
  { title: 'Estado', key: 'estado', sortable: false },
  { title: 'Contrato', key: 'contrato_pdf', sortable: false },
]

/* ══════════ Visor embebido ══════════ */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (path: any) => urlDocumento(client, path)
const nombreDe = (path: any) =>
  decodeURIComponent(String(path || '').split('/').pop() || '') || undefined

function verDocumento(path: string, titulo: string) {
  visor.value = { abierto: true, src: urlDoc(path), titulo }
}

/* ══════════ Validación ══════════ */
const formRef = ref<any>(null)
const ruleRequerido = (v: any) => !!String(v ?? '').trim() || 'Obligatorio'
/** El RUC es opcional en un contrato, pero si se escribe tiene que ser válido. */
const ruleRucOpcional = (v: any) => !String(v ?? '').trim() || ruleRuc(v)
const ruleRangoFechas = () => {
  const e = edicion.value
  if (!e?.fecha_inicio || !e?.fecha_cierre) return true
  return e.fecha_cierre >= e.fecha_inicio || 'El cierre no puede ser anterior al inicio'
}

/* ══════════ Alta / edición ══════════ */
const edicion = ref<any>(null)
const guardando = ref(false)

function abrirNuevo() {
  edicion.value = {
    cliente_id: null, nombre_cliente: '', ruc: '',
    fecha_inicio: hoyISO(), fecha_cierre: '', importe_pagado: 0,
    modalidad_pago: 'mensual', contrato_pdf: null, notas: '',
  }
}

function autocompletarCliente(id: any) {
  const c = clientes.value.find(x => x.id === id)
  if (!c || !edicion.value) return
  edicion.value.nombre_cliente = c.razon_social || c.nombre
  if (c.ruc) edicion.value.ruc = c.ruc
}

function editarDesdeDetalle() {
  edicion.value = {
    ...detalle.value,
    fecha_inicio: detalle.value.fecha_inicio ? String(detalle.value.fecha_inicio).slice(0, 10) : '',
    fecha_cierre: detalle.value.fecha_cierre ? String(detalle.value.fecha_cierre).slice(0, 10) : '',
  }
  detalle.value = null
}

async function guardarContrato() {
  const e = edicion.value
  const validacion = await formRef.value?.validate()
  if (validacion && validacion.valid === false) {
    return emit('notify', { text: 'Revisa los campos marcados', color: 'error' })
  }

  guardando.value = true
  // `company_id` lo fija el servidor: es el campo que aísla las empresas del
  // grupo, y no puede escribirlo el navegador.
  const fila: Record<string, any> = {
    cliente_id: e.cliente_id || null,
    nombre_cliente: String(e.nombre_cliente).trim(),
    ruc: String(e.ruc || '').trim() || null,
    fecha_inicio: e.fecha_inicio || null,
    fecha_cierre: e.fecha_cierre || null,
    importe_pagado: Number(e.importe_pagado || 0),
    modalidad_pago: e.modalidad_pago || null,
    contrato_pdf: e.contrato_pdf || null,
    notas: e.notas || null,
  }
  const res = await apiPiola('contratos', { accion: 'guardar', id: e.id || null, ...fila })
  guardando.value = false

  if (res.error) return emit('notify', { text: `Error guardando: ${res.error.message}`, color: 'error' })
  emit('notify', e.id ? 'Contrato actualizado' : 'Contrato registrado')
  edicion.value = null
  await cargar()
}

async function eliminarContrato() {
  const c = detalle.value
  const n = adendasDe(c.id).length
  const aviso = n
    ? `¿Eliminar el contrato de "${c.nombre_cliente}"? Se borran también sus ${n} adenda(s).`
    : `¿Eliminar el contrato de "${c.nombre_cliente}"?`
  if (!confirm(aviso)) return

  const { error } = await apiPiola('contratos', { accion: 'eliminar', id: c.id })
  if (error) return emit('notify', { text: `Error eliminando: ${error.message}`, color: 'error' })
  emit('notify', 'Contrato eliminado')
  cerrarDetalle()
  await cargar()
}

/* ══════════ Detalle y adendas ══════════ */
const detalle = ref<any>(null)
const nuevaAdenda = ref<any>(null)
const guardandoAdenda = ref(false)

const adendasDetalle = computed(() => detalle.value ? adendasDe(detalle.value.id) : [])

function abrirDetalle(c: any) { detalle.value = { ...c }; nuevaAdenda.value = null }
function cerrarDetalle() { detalle.value = null; nuevaAdenda.value = null }

function abrirAdenda() {
  nuevaAdenda.value = { fecha: hoyISO(), descripcion: '', importe: 0, archivo_pdf: null }
}

async function guardarAdenda() {
  const a = nuevaAdenda.value
  if (!a.descripcion?.trim()) {
    return emit('notify', { text: 'La adenda necesita una descripción', color: 'error' })
  }
  guardandoAdenda.value = true
  const { error } = await apiPiola('contratos', {
    accion: 'adenda_crear',
    contrato_id: detalle.value.id,
    fecha: a.fecha || null,
    descripcion: a.descripcion.trim(),
    importe: Number(a.importe || 0),
    archivo_pdf: a.archivo_pdf || null,
  })
  guardandoAdenda.value = false
  if (error) return emit('notify', { text: `Error guardando la adenda: ${error.message}`, color: 'error' })
  emit('notify', 'Adenda agregada')
  nuevaAdenda.value = null
  await cargar()
}

async function eliminarAdenda(a: any) {
  if (!confirm('¿Eliminar esta adenda?')) return
  const { error } = await apiPiola('contratos', { accion: 'adenda_eliminar', id: a.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Adenda eliminada')
  await cargar()
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; padding: 2px 16px 14px; }
.filtros-bar .filtro { flex: 1 1 150px; max-width: 220px; }
.filtros-bar .filtro-buscar { flex: 2 1 240px; max-width: 340px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.detalle-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.detalle-campos > div { display: flex; flex-direction: column; gap: 2px; }
.detalle-campos span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.detalle-campos strong { font-size: 13.5px; }

.notas-caja {
  margin-top: 14px; padding: 10px 13px; font-size: 13px; line-height: 1.5;
  border-left: 3px solid rgba(226, 86, 74, .5); background: rgba(128, 128, 128, .06); border-radius: 6px;
}

.doc-fila {
  display: flex; align-items: center; gap: 9px; margin-top: 14px;
  border: 1px solid rgba(128, 128, 128, .25); border-radius: 9px; padding: 8px 10px 8px 13px;
}
.doc-fila > span { font-size: 12.5px; }

.adenda-form {
  border: 1px dashed rgba(128, 128, 128, .4); border-radius: 10px;
  padding: 14px; margin-bottom: 8px;
}
.adenda-acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

.sin-adendas { font-size: 12.5px; opacity: .5; padding: 10px 0; }
.texto-alerta { color: #e2564a; font-weight: 600; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
