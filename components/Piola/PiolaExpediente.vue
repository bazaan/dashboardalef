<template>
  <div>
    <v-card flat class="custom-data-table">
      <v-card-title class="table-search-bar">
        <span class="table-title">Expedientes ({{ filtrados.length }})</span>
        <v-spacer />
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify"
            placeholder="Nombre, DNI, código…" density="compact" hide-details variant="outlined"
            clearable style="max-width:250px;" />
          <v-select v-model="fEstado" :items="OPCIONES_ESTADO" density="compact" hide-details
            variant="outlined" label="Estado" style="max-width:170px;" />
          <v-select v-model="fArea" :items="opcionesAreaFiltro" density="compact" hide-details
            variant="outlined" label="Área" style="max-width:170px;" />
        </div>
      </v-card-title>

      <v-data-table :headers="headers" :items="filtrados" :loading="cargando" class="elevation-0"
        no-data-text="No hay colaboradores registrados" :items-per-page="25"
        @click:row="(_: any, r: any) => abrir(r.item)">
        <template v-slot:item.nombre="{ item }">
          <div style="display:flex; align-items:center; gap:9px;">
            <div class="avatar-iniciales">{{ iniciales(item) }}</div>
            <div>
              <strong>{{ nombreCompleto(item) }}</strong>
              <div class="sub-linea">{{ item.email }}</div>
            </div>
          </div>
        </template>
        <template v-slot:item.area_id="{ item }">{{ nombreArea(item.area_id) }}</template>
        <template v-slot:item.fecha_ingreso="{ item }">{{ fechaCorta(item.fecha_ingreso) }}</template>
        <template v-slot:item.antiguedad="{ item }">{{ antiguedad(item.fecha_ingreso) }}</template>
        <template v-slot:item.tipo_contrato="{ item }">
          <v-chip size="x-small" variant="tonal"
            :color="item.tipo_contrato === 'planilla' ? 'primary' : 'grey'">
            {{ item.tipo_contrato === 'planilla' ? 'Planilla' : 'Honorarios' }}
          </v-chip>
        </template>
        <template v-slot:item.estado_laboral="{ item }">
          <v-chip size="x-small" variant="flat" :color="colorEstado(item.estado_laboral)">
            {{ etiquetaEstadoLaboral(item.estado_laboral) }}
          </v-chip>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ FICHA ══════════ -->
    <v-dialog :model-value="!!ficha" max-width="1000" scrollable @update:model-value="cerrar">
      <v-card v-if="ficha">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div class="avatar-iniciales grande">{{ iniciales(ficha) }}</div>
          <div>
            <div style="font-weight:700; font-size:17px;">{{ nombreCompleto(ficha) }}</div>
            <div class="sub-linea">
              {{ ficha.cargo || 'Sin cargo' }}
              <template v-if="ficha.codigo_trabajador"> · {{ ficha.codigo_trabajador }}</template>
            </div>
          </div>
          <v-spacer />
          <v-chip size="small" variant="flat" :color="colorEstado(ficha.estado_laboral)">
            {{ etiquetaEstadoLaboral(ficha.estado_laboral) }}
          </v-chip>
        </v-card-title>

        <div class="ficha-tabs">
          <button v-for="t in TABS_FICHA" :key="t.id"
            :class="['tab', { active: tabFicha === t.id }]" @click="tabFicha = t.id">
            <v-icon :icon="t.icon" size="15" /> {{ t.label }}
          </button>
        </div>

        <v-card-text>
          <!-- ── Datos personales ── -->
          <div v-if="tabFicha === 'personales'" class="form-grid">
            <v-text-field v-model="ficha.nombres" label="Nombres" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.apellidos" label="Apellidos" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.dni" label="Documento de identidad" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.fecha_nacimiento" type="date" label="Fecha de nacimiento"
              density="compact" hide-details variant="outlined" :readonly="!puedeEditar"
              :hint="ficha.fecha_nacimiento ? `${edad(ficha.fecha_nacimiento)} años` : ''"
              persistent-hint />
            <v-text-field v-model="ficha.nacionalidad" label="Nacionalidad" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.telefono" label="Teléfono" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.email" label="Correo (es también su usuario)"
              density="compact" hide-details variant="outlined" readonly
              hint="El correo enlaza con el login; se cambia desde Colaboradores" persistent-hint />
            <v-text-field v-model="ficha.direccion" label="Dirección" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />

            <div class="form-section-title col-2" style="margin-top:8px;">Contacto de emergencia</div>
            <v-text-field v-model="ficha.emergencia_nombre" label="Nombre" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.emergencia_telefono" label="Teléfono" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.emergencia_parentesco" label="Parentesco" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
          </div>

          <!-- ── Datos laborales ── -->
          <div v-else-if="tabFicha === 'laborales'" class="form-grid">
            <v-text-field v-model="ficha.codigo_trabajador" label="Código del trabajador"
              density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.cargo" label="Cargo" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-select v-model="ficha.area_id" :items="opcionesArea" label="Área" density="compact"
              hide-details variant="outlined" clearable :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.sede" label="Sede" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-select v-model="ficha.jefe_email" :items="opcionesJefe" label="Jefe directo"
              density="compact" hide-details variant="outlined" clearable :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.fecha_ingreso" type="date" label="Fecha de ingreso"
              density="compact" hide-details variant="outlined" :readonly="!puedeEditar"
              :hint="antiguedad(ficha.fecha_ingreso)" persistent-hint />
            <v-select v-model="ficha.tipo_contrato" :items="TIPOS_CONTRATO" label="Tipo de contrato"
              density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-select v-model="ficha.modalidad_trabajo" :items="MODALIDADES" label="Modalidad de trabajo"
              density="compact" hide-details variant="outlined" clearable :readonly="!puedeEditar" />
            <v-select v-model="ficha.jornada" :items="JORNADAS" label="Jornada" density="compact"
              hide-details variant="outlined" clearable :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.horario" label="Horario" density="compact"
              hide-details variant="outlined" :readonly="!puedeEditar"
              placeholder="L-V 9:00 a 18:00" />
            <v-select v-model="ficha.estado_laboral" :items="ESTADOS_LABORALES" label="Estado"
              density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
            <v-text-field v-model="ficha.fecha_cese" type="date" label="Fecha de cese"
              density="compact" hide-details variant="outlined"
              :readonly="!puedeEditar" :disabled="ficha.estado_laboral !== 'cesado'" />
            <v-textarea v-if="ficha.estado_laboral === 'cesado'" v-model="ficha.motivo_cese"
              label="Motivo del cese" rows="2" density="compact" hide-details variant="outlined"
              class="col-2" :readonly="!puedeEditar" />
          </div>

          <!-- ── Información contractual ── -->
          <div v-else-if="tabFicha === 'contractual'">
            <div class="form-grid">
              <v-text-field v-model="ficha.fecha_fin_contrato" type="date" label="Fin del contrato vigente"
                density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
              <v-text-field v-model.number="ficha.sueldo_bruto" type="number" label="Remuneración (S/)"
                density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
              <v-text-field v-model.number="ficha.bonificaciones" type="number" label="Bonificaciones (S/)"
                density="compact" hide-details variant="outlined" :readonly="!puedeEditar" />
              <v-switch v-model="ficha.asignacion_familiar" color="primary" density="compact"
                hide-details label="Asignación familiar" :disabled="!puedeEditar" />
              <v-textarea v-model="ficha.beneficios" label="Beneficios" rows="2" density="compact"
                hide-details variant="outlined" class="col-2" :readonly="!puedeEditar" />
            </div>

            <v-divider class="my-5" />

            <!-- Renovaciones -->
            <div class="form-section-title" style="display:flex; align-items:center;">
              <span>Contratos y renovaciones ({{ contratosLab.length }})</span>
              <v-spacer />
              <v-btn v-if="puedeEditar && !nuevoContrato" size="small" variant="tonal"
                @click="abrirContratoLab">
                <v-icon icon="mdi-plus" start /> Agregar contrato
              </v-btn>
            </div>

            <div v-if="nuevoContrato" class="bloque-nuevo">
              <div class="form-grid">
                <v-select v-model="nuevoContrato.tipo_contrato" :items="TIPOS_CONTRATO_LAB"
                  label="Tipo" density="compact" hide-details variant="outlined" />
                <v-switch v-model="nuevoContrato.es_renovacion" color="primary" density="compact"
                  hide-details label="Es una renovación" />
                <v-text-field v-model="nuevoContrato.fecha_inicio" type="date" label="Inicio *"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model="nuevoContrato.fecha_termino" type="date" label="Término"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="nuevoContrato.remuneracion" type="number"
                  label="Remuneración (S/)" density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="nuevoContrato.bonificaciones" type="number"
                  label="Bonificaciones (S/)" density="compact" hide-details variant="outlined" />
              </div>
              <v-textarea v-model="nuevoContrato.beneficios" label="Beneficios" rows="2"
                density="compact" hide-details variant="outlined" class="mt-3" />
              <div class="mt-3">
                <PiolaSubirPdf v-model="nuevoContrato.contrato_pdf" carpeta="contratos-laborales"
                  label="Contrato firmado (PDF)"
                  @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
              </div>
              <div class="acciones-bloque">
                <v-btn variant="text" size="small" @click="nuevoContrato = null">Cancelar</v-btn>
                <v-btn color="primary" variant="flat" size="small" :loading="guardando"
                  @click="guardarContratoLab">Guardar</v-btn>
              </div>
            </div>

            <v-table v-if="contratosLab.length" density="compact" class="mt-3">
              <thead>
                <tr>
                  <th>Tipo</th><th>Inicio</th><th>Término</th>
                  <th class="text-right">Remuneración</th><th>Renovación</th>
                  <th class="text-right">Documento</th><th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in contratosLab" :key="c.id">
                  <td>{{ etiquetaTipoContrato(c.tipo_contrato) }}</td>
                  <td>{{ fechaCorta(c.fecha_inicio) }}</td>
                  <td>{{ fechaCorta(c.fecha_termino) }}</td>
                  <td class="text-right">{{ PEN(c.remuneracion) }}</td>
                  <td>
                    <v-icon v-if="c.es_renovacion" icon="mdi-autorenew" size="15" color="info" />
                    <span v-else style="opacity:.3">—</span>
                  </td>
                  <td class="text-right">
                    <template v-if="c.contrato_pdf">
                      <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver"
                        @click="verDoc(c.contrato_pdf, `Contrato — ${nombreCompleto(ficha)}`)" />
                      <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
                        :href="urlDoc(c.contrato_pdf)" />
                    </template>
                    <span v-else style="opacity:.3">—</span>
                  </td>
                  <td class="text-right">
                    <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text"
                      color="error" @click="eliminarContratoLab(c)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else-if="!nuevoContrato" class="sin-datos">Sin contratos registrados.</div>
          </div>

          <!-- ── Documentos ── -->
          <div v-else-if="tabFicha === 'documentos'">
            <div v-if="puedeEditar" class="bloque-nuevo">
              <div class="form-grid">
                <v-select v-model="nuevoDoc.tipo" :items="TIPOS_DOCUMENTO" label="Tipo"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model="nuevoDoc.nombre" label="Nombre del documento *"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model="nuevoDoc.fecha" type="date" label="Fecha" density="compact"
                  hide-details variant="outlined" />
              </div>
              <div class="mt-3">
                <PiolaSubirPdf v-model="nuevoDoc.archivo_url" carpeta="expedientes"
                  label="Archivo (PDF)"
                  @error="(m: string) => emit('notify', { text: m, color: 'error' })" />
              </div>
              <div class="acciones-bloque">
                <v-btn color="primary" variant="flat" size="small" :loading="guardando"
                  @click="guardarDocumento">Agregar documento</v-btn>
              </div>
            </div>

            <v-table v-if="documentos.length" density="compact" class="mt-3">
              <thead>
                <tr><th>Tipo</th><th>Nombre</th><th>Fecha</th><th>Subió</th><th class="text-right" /></tr>
              </thead>
              <tbody>
                <tr v-for="d in documentos" :key="d.id">
                  <td>{{ etiquetaTipoDoc(d.tipo) }}</td>
                  <td>{{ d.nombre }}</td>
                  <td>{{ fechaCorta(d.fecha) }}</td>
                  <td class="sub-linea">{{ d.subido_por || '—' }}</td>
                  <td class="text-right">
                    <template v-if="d.archivo_url">
                      <v-btn icon="mdi-file-eye" size="x-small" variant="text" title="Ver"
                        @click="verDoc(d.archivo_url, d.nombre)" />
                      <v-btn icon="mdi-download" size="x-small" variant="text" title="Descargar"
                        :href="urlDoc(d.archivo_url)" />
                    </template>
                    <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text"
                      color="error" @click="eliminarDocumento(d)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="sin-datos">Sin documentos en el expediente.</div>
          </div>
        </v-card-text>

        <v-card-actions style="padding:12px 20px 18px;">
          <v-spacer />
          <v-btn variant="text" @click="cerrar">Cerrar</v-btn>
          <v-btn v-if="puedeEditar && ['personales', 'laborales', 'contractual'].includes(tabFicha)"
            color="primary" variant="flat" :loading="guardando" @click="guardarFicha">
            Guardar cambios
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Expediente del trabajador.
 *
 * Amplía la ficha que ya existía en Configuración (que era solo rol, contrato y
 * datos de planilla) con lo que pide la especificación de RR. HH.: datos
 * personales, laborales, contractuales, renovaciones y documentos.
 *
 * `nombre` (completo) se mantiene como el campo que muestran las demás
 * pantallas; `nombres` y `apellidos` son el desglose nuevo y se mantienen
 * sincronizados al guardar, para no dejar dos verdades sobre cómo se llama
 * alguien.
 */
import { ref, computed, onMounted } from 'vue'
import { PEN, fechaCorta, hoyISO, urlDocumento, apiPiola } from '@/composables/usePiola'
import PiolaSubirPdf from './PiolaSubirPdf.vue'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

// `perfil` ya no se usa en el script: quién guarda, registra o sube lo pone el
// servidor desde la sesión verificada. Sigue como prop porque el padre lo pasa
// junto con los permisos.
defineProps<{
  perfil: any
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()

const TIPOS_CONTRATO = [
  { value: 'planilla', title: 'Planilla' },
  { value: 'honorarios', title: 'Recibo por honorarios' },
]
const TIPOS_CONTRATO_LAB = [
  { value: 'planilla', title: 'Planilla' },
  { value: 'honorarios', title: 'Recibo por honorarios' },
  { value: 'practicas', title: 'Prácticas' },
  { value: 'temporal', title: 'Temporal' },
]
const MODALIDADES = [
  { value: 'presencial', title: 'Presencial' },
  { value: 'remoto', title: 'Remoto' },
  { value: 'hibrido', title: 'Híbrido' },
]
const JORNADAS = [
  { value: 'completa', title: 'Completa' },
  { value: 'parcial', title: 'Parcial' },
  { value: 'por_horas', title: 'Por horas' },
]
const ESTADOS_LABORALES = [
  { value: 'activo', title: 'Activo' },
  { value: 'suspendido', title: 'Suspendido' },
  { value: 'cesado', title: 'Cesado' },
]
const TIPOS_DOCUMENTO = [
  { value: 'dni', title: 'Documento de identidad' },
  { value: 'cv', title: 'Currículum' },
  { value: 'certificado', title: 'Certificado' },
  { value: 'contrato', title: 'Contrato' },
  { value: 'adenda', title: 'Adenda' },
  { value: 'otro', title: 'Otro' },
]
const OPCIONES_ESTADO = [
  { value: 'todos', title: 'Todos' },
  ...ESTADOS_LABORALES,
]
const TABS_FICHA = [
  { id: 'personales', label: 'Datos personales', icon: 'mdi-account' },
  { id: 'laborales', label: 'Datos laborales', icon: 'mdi-briefcase' },
  { id: 'contractual', label: 'Contractual', icon: 'mdi-file-sign' },
  { id: 'documentos', label: 'Documentos', icon: 'mdi-folder-account' },
]

const cargando = ref(false)
const guardando = ref(false)
const colaboradores = ref<any[]>([])
const areas = ref<any[]>([])

const fBuscar = ref('')
const fEstado = ref('todos')
const fArea = ref<any>('todas')

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [c, a] = await Promise.all([
    client.from('piola_colaboradores').select('*').order('nombre'),
    client.from('piola_areas').select('id, nombre').eq('activo', true).order('orden'),
  ])
  if (c.error) emit('notify', { text: `Error cargando expedientes: ${c.error.message}`, color: 'error' })
  colaboradores.value = (c.data as any[]) || []
  areas.value = (a.data as any[]) || []
  cargando.value = false
}

/* ══════════ Derivados ══════════ */
const nombreCompleto = (c: any) =>
  [c?.nombres, c?.apellidos].filter(Boolean).join(' ') || c?.nombre || '—'

const iniciales = (c: any) => nombreCompleto(c)
  .split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('')

const nombreArea = (id: any) => areas.value.find(a => a.id === id)?.nombre || '—'
const opcionesArea = computed(() => areas.value.map(a => ({ value: a.id, title: a.nombre })))
const opcionesAreaFiltro = computed(() =>
  [{ value: 'todas', title: 'Todas las áreas' }, ...opcionesArea.value])
const opcionesJefe = computed(() => colaboradores.value
  .filter(c => c.email !== ficha.value?.email)
  .map(c => ({ value: c.email, title: nombreCompleto(c) })))

const etiquetaEstadoLaboral = (v: any) =>
  ESTADOS_LABORALES.find(e => e.value === v)?.title || 'Activo'
const colorEstado = (v: any) =>
  ({ activo: 'success', suspendido: 'warning', cesado: 'grey' }[String(v)] || 'success')
const etiquetaTipoContrato = (v: any) =>
  TIPOS_CONTRATO_LAB.find(t => t.value === v)?.title || v
const etiquetaTipoDoc = (v: any) =>
  TIPOS_DOCUMENTO.find(t => t.value === v)?.title || v

function antiguedad(desde: any): string {
  if (!desde) return '—'
  const dias = Math.max(0,
    (Date.parse(`${hoyISO()}T12:00:00`) - Date.parse(`${String(desde).slice(0, 10)}T12:00:00`)) / 86400000)
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios) return `${anios} año${anios > 1 ? 's' : ''}${meses ? ` y ${meses} m` : ''}`
  if (meses) return `${meses} mes${meses > 1 ? 'es' : ''}`
  return `${Math.round(dias)} días`
}

function edad(nacimiento: any): number {
  if (!nacimiento) return 0
  const n = new Date(`${String(nacimiento).slice(0, 10)}T12:00:00`)
  const hoy = new Date()
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--
  return e
}

const filtrados = computed(() => {
  let lista = colaboradores.value
  if (fEstado.value !== 'todos') {
    lista = lista.filter(c => (c.estado_laboral || 'activo') === fEstado.value)
  }
  if (fArea.value !== 'todas') lista = lista.filter(c => c.area_id === fArea.value)
  if (fBuscar.value) {
    const q = fBuscar.value.toLowerCase()
    lista = lista.filter(c => [nombreCompleto(c), c.email, c.dni, c.codigo_trabajador, c.cargo]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})

const headers = [
  { title: 'Colaborador', key: 'nombre' },
  { title: 'Cargo', key: 'cargo' },
  { title: 'Área', key: 'area_id' },
  { title: 'Ingreso', key: 'fecha_ingreso' },
  { title: 'Antigüedad', key: 'antiguedad', sortable: false },
  { title: 'Contrato', key: 'tipo_contrato' },
  { title: 'Estado', key: 'estado_laboral', sortable: false },
]

/* ══════════ Visor ══════════ */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (p: any) => urlDocumento(client, p)
const verDoc = (p: string, titulo: string) => {
  visor.value = { abierto: true, src: urlDoc(p), titulo }
}

/* ══════════ Ficha ══════════ */
const ficha = ref<any>(null)
const tabFicha = ref('personales')
const contratosLab = ref<any[]>([])
const documentos = ref<any[]>([])

async function abrir(c: any) {
  ficha.value = {
    ...c,
    fecha_nacimiento: c.fecha_nacimiento ? String(c.fecha_nacimiento).slice(0, 10) : '',
    fecha_ingreso: c.fecha_ingreso ? String(c.fecha_ingreso).slice(0, 10) : '',
    fecha_cese: c.fecha_cese ? String(c.fecha_cese).slice(0, 10) : '',
    fecha_fin_contrato: c.fecha_fin_contrato ? String(c.fecha_fin_contrato).slice(0, 10) : '',
    estado_laboral: c.estado_laboral || 'activo',
  }
  tabFicha.value = 'personales'
  nuevoContrato.value = null
  resetDoc()
  await cargarAnexos(c.id)
}

async function cargarAnexos(colaboradorId: number) {
  const [cl, dc] = await Promise.all([
    client.from('piola_contratos_laborales').select('*')
      .eq('colaborador_id', colaboradorId).order('fecha_inicio', { ascending: false }),
    client.from('piola_colaborador_documentos').select('*')
      .eq('colaborador_id', colaboradorId).order('created_at', { ascending: false }),
  ])
  contratosLab.value = (cl.data as any[]) || []
  documentos.value = (dc.data as any[]) || []
}

function cerrar() {
  ficha.value = null
  contratosLab.value = []
  documentos.value = []
  nuevoContrato.value = null
}

async function guardarFicha() {
  const f = ficha.value
  guardando.value = true

  const nombres = String(f.nombres || '').trim()
  const apellidos = String(f.apellidos || '').trim()

  const fila: Record<string, any> = {
    nombres: nombres || null,
    apellidos: apellidos || null,
    // `nombre` es el que muestran las otras pantallas: se mantiene sincronizado
    nombre: [nombres, apellidos].filter(Boolean).join(' ') || f.nombre,
    dni: f.dni || null,
    fecha_nacimiento: f.fecha_nacimiento || null,
    nacionalidad: f.nacionalidad || null,
    telefono: f.telefono || null,
    direccion: f.direccion || null,
    emergencia_nombre: f.emergencia_nombre || null,
    emergencia_telefono: f.emergencia_telefono || null,
    emergencia_parentesco: f.emergencia_parentesco || null,
    codigo_trabajador: String(f.codigo_trabajador || '').trim() || null,
    cargo: f.cargo || null,
    area_id: f.area_id || null,
    sede: f.sede || null,
    jefe_email: f.jefe_email || null,
    fecha_ingreso: f.fecha_ingreso || null,
    tipo_contrato: f.tipo_contrato,
    modalidad_trabajo: f.modalidad_trabajo || null,
    jornada: f.jornada || null,
    horario: f.horario || null,
    estado_laboral: f.estado_laboral,
    // Solo tiene sentido guardar el cese si efectivamente cesó
    fecha_cese: f.estado_laboral === 'cesado' ? (f.fecha_cese || null) : null,
    motivo_cese: f.estado_laboral === 'cesado' ? (f.motivo_cese || null) : null,
    fecha_fin_contrato: f.fecha_fin_contrato || null,
    sueldo_bruto: Number(f.sueldo_bruto) || null,
    bonificaciones: Number(f.bonificaciones) || 0,
    asignacion_familiar: !!f.asignacion_familiar,
    beneficios: f.beneficios || null,
    // Un colaborador cesado deja de estar activo en el resto del dashboard
    activo: f.estado_laboral !== 'cesado',
    updated_at: new Date().toISOString(),
  }

  // Los campos de remuneración van en el mismo formulario, pero el servidor solo
  // exige Administrador si alguno cambia de verdad respecto de lo guardado.
  const { error } = await apiPiola('colaborador', { accion: 'guardar', id: f.id, ...fila })
  guardando.value = false
  if (error) {
    const msg = /idx_piola_colab_codigo|duplicate key/i.test(error.message)
      ? 'Ese código de trabajador ya está en uso por otro colaborador.'
      : `Error guardando: ${error.message}`
    return emit('notify', { text: msg, color: 'error' })
  }
  emit('notify', 'Expediente actualizado')
  await cargar()
}

/* ══════════ Contratos y renovaciones ══════════ */
const nuevoContrato = ref<any>(null)

function abrirContratoLab() {
  // Una renovación arranca donde termina el contrato vigente
  const ultimo = contratosLab.value[0]
  nuevoContrato.value = {
    tipo_contrato: ficha.value.tipo_contrato || 'planilla',
    fecha_inicio: ultimo?.fecha_termino
      ? String(ultimo.fecha_termino).slice(0, 10)
      : (ficha.value.fecha_ingreso || hoyISO()),
    fecha_termino: '',
    remuneracion: ficha.value.sueldo_bruto || null,
    bonificaciones: ficha.value.bonificaciones || 0,
    beneficios: ficha.value.beneficios || '',
    es_renovacion: contratosLab.value.length > 0,
    contrato_pdf: null,
  }
}

async function guardarContratoLab() {
  const c = nuevoContrato.value
  if (!c.fecha_inicio) {
    return emit('notify', { text: 'El contrato necesita fecha de inicio', color: 'error' })
  }
  guardando.value = true
  const { error } = await apiPiola('colaborador', {
    accion: 'contrato_crear',
    colaborador_id: ficha.value.id,
    tipo_contrato: c.tipo_contrato,
    fecha_inicio: c.fecha_inicio,
    fecha_termino: c.fecha_termino || null,
    remuneracion: Number(c.remuneracion) || null,
    bonificaciones: Number(c.bonificaciones) || 0,
    beneficios: c.beneficios || null,
    es_renovacion: !!c.es_renovacion,
    contrato_pdf: c.contrato_pdf || null,
  })
  guardando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })

  // El contrato nuevo pasa a ser el vigente: se refleja en la ficha
  if (c.fecha_termino) ficha.value.fecha_fin_contrato = c.fecha_termino
  if (Number(c.remuneracion)) ficha.value.sueldo_bruto = Number(c.remuneracion)

  emit('notify', c.es_renovacion ? 'Renovación registrada' : 'Contrato registrado')
  nuevoContrato.value = null
  await cargarAnexos(ficha.value.id)
}

async function eliminarContratoLab(c: any) {
  if (!confirm(`¿Eliminar el contrato del ${fechaCorta(c.fecha_inicio)}?`)) return
  const { error } = await apiPiola('colaborador', { accion: 'contrato_eliminar', id: c.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Contrato eliminado')
  await cargarAnexos(ficha.value.id)
}

/* ══════════ Documentos ══════════ */
const nuevoDoc = ref<any>({ tipo: 'otro', nombre: '', fecha: '', archivo_url: null })
const resetDoc = () => {
  nuevoDoc.value = { tipo: 'otro', nombre: '', fecha: hoyISO(), archivo_url: null }
}

async function guardarDocumento() {
  const d = nuevoDoc.value
  if (!d.nombre?.trim()) {
    return emit('notify', { text: 'El documento necesita un nombre', color: 'error' })
  }
  if (!d.archivo_url) {
    return emit('notify', { text: 'Sube el archivo antes de agregarlo', color: 'error' })
  }
  guardando.value = true
  const { error } = await apiPiola('colaborador', {
    accion: 'documento_crear',
    colaborador_id: ficha.value.id,
    tipo: d.tipo,
    nombre: d.nombre.trim(),
    archivo_url: d.archivo_url,
    fecha: d.fecha || null,
  })
  guardando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Documento agregado')
  resetDoc()
  await cargarAnexos(ficha.value.id)
}

async function eliminarDocumento(d: any) {
  if (!confirm(`¿Eliminar "${d.nombre}" del expediente?`)) return
  const { error } = await apiPiola('colaborador', { accion: 'documento_eliminar', id: d.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Documento eliminado')
  await cargarAnexos(ficha.value.id)
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.avatar-iniciales {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #e2564a, #f2a63b); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
}
.avatar-iniciales.grande { width: 44px; height: 44px; font-size: 16px; }

.sub-linea { font-size: 11.5px; opacity: .55; }

.ficha-tabs {
  display: flex; flex-wrap: wrap; gap: 4px; padding: 0 20px 4px;
  border-bottom: 1px solid rgba(128, 128, 128, .2);
}
.ficha-tabs .tab { display: flex; align-items: center; gap: 6px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.form-grid .col-2 { grid-column: span 2; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 2px;
}

.bloque-nuevo {
  border: 1px dashed rgba(128, 128, 128, .4); border-radius: 10px; padding: 14px; margin-top: 10px;
}
.acciones-bloque { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

.sin-datos { font-size: 12.5px; opacity: .5; padding: 12px 0; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
}
</style>
