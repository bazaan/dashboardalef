<template>
  <div>
    <!-- ══════════ Resumen ══════════ -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Contratos cargados</span></div>
        <div class="stat-value">
          {{ resumen.conContrato }}<small class="de-total"> / {{ resumen.vigentes }}</small>
        </div>
        <div class="stat-description">Colaboradores con su contrato en PDF</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Recibos de {{ etiquetaPeriodo(periodo) }}</span></div>
        <div class="stat-value" style="color:#2e9e5b;">
          {{ resumen.recibidos }}<small class="de-total"> / {{ resumen.honorarios }}</small>
        </div>
        <div class="stat-description">Por honorarios que ya entregaron</div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Recibos pendientes</span></div>
        <div class="stat-value" :style="{ color: resumen.pendientes ? '#e2564a' : '#2e9e5b' }">
          {{ resumen.pendientes }}
        </div>
        <div class="stat-description">
          {{ resumen.pendientes ? 'Aún no suben el recibo de este mes' : 'Todos al día este mes' }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-header"><span class="stat-title">Documentos en total</span></div>
        <div class="stat-value">{{ documentos.length + contratosLab.length }}</div>
        <div class="stat-description">Contratos, recibos, certificados y otros</div>
      </div>
    </div>

    <!-- ══════════ Tabla por colaborador ══════════ -->
    <v-card flat class="custom-data-table mt-4">
      <v-card-title class="table-search-bar">
        <span class="table-title">Documentos por colaborador ({{ filtrados.length }})</span>
        <v-spacer />
        <div class="filtros">
          <v-text-field v-model="fBuscar" prepend-inner-icon="mdi-magnify" placeholder="Nombre o correo…"
            density="compact" hide-details variant="outlined" clearable class="f-buscar" />
          <v-select v-model="periodo" :items="opcionesPeriodo" label="Mes de los recibos" density="compact"
            hide-details variant="outlined" class="f-periodo" />
          <v-select v-model="fModalidad" :items="OPCIONES_MODALIDAD" label="Modalidad" density="compact"
            hide-details variant="outlined" class="f-modalidad" />
          <v-select v-model="fEstado" :items="OPCIONES_ESTADO" label="Documentos" density="compact"
            hide-details variant="outlined" class="f-estado" />
          <v-switch v-model="verCesados" color="primary" density="compact" hide-details label="Incluir cesados" />
        </div>
      </v-card-title>

      <v-data-table :headers="headers" :items="filtrados" :loading="cargando" class="elevation-0"
        no-data-text="No hay colaboradores con esos filtros" :items-per-page="25"
        @click:row="(_: any, r: any) => abrir(r.item)">
        <template v-slot:item.nombre="{ item }">
          <div class="celda-persona">
            <div class="avatar-iniciales">{{ iniciales(item) }}</div>
            <div>
              <strong>{{ nombreCompleto(item) }}</strong>
              <div class="sub-linea">{{ item.cargo || item.email }}</div>
            </div>
          </div>
        </template>

        <template v-slot:item.modalidad="{ item }">
          <v-chip size="x-small" variant="tonal" :color="item.esHonorarios ? 'grey' : 'primary'">
            {{ item.esHonorarios ? 'Honorarios' : 'Planilla' }}
          </v-chip>
        </template>

        <template v-slot:item.contrato="{ item }">
          <div class="celda-estado">
            <v-chip size="x-small" variant="flat" :color="item.contratos.length ? 'success' : 'warning'">
              {{ item.contratos.length ? `Cargado (${item.contratos.length})` : 'Falta' }}
            </v-chip>
            <template v-if="item.contratos.length">
              <v-btn icon="mdi-eye-outline" size="small" variant="text" title="Ver el más reciente"
                @click.stop="ver(item.contratos[0])" />
              <v-btn icon="mdi-download-outline" size="small" variant="text" title="Descargar el más reciente"
                :href="bajar(item.contratos[0])" @click.stop />
            </template>
          </div>
        </template>

        <template v-slot:item.reciboMes="{ item }">
          <span v-if="!item.esHonorarios" class="no-aplica">No aplica</span>
          <div v-else class="celda-estado">
            <v-chip size="x-small" variant="flat" :color="item.reciboDelMes ? 'success' : 'warning'">
              {{ item.reciboDelMes ? 'Recibido' : 'Pendiente' }}
            </v-chip>
            <template v-if="item.reciboDelMes">
              <v-btn icon="mdi-eye-outline" size="small" variant="text" title="Ver el recibo del mes"
                @click.stop="ver(item.reciboDelMes)" />
              <v-btn icon="mdi-download-outline" size="small" variant="text" title="Descargar el recibo del mes"
                :href="bajar(item.reciboDelMes)" @click.stop />
            </template>
          </div>
        </template>

        <template v-slot:item.nRecibos="{ item }">{{ item.recibos.length || '—' }}</template>
        <template v-slot:item.nCertificados="{ item }">{{ item.certificados.length || '—' }}</template>

        <template v-slot:item.acciones="{ item }">
          <v-btn size="small" variant="tonal" prepend-icon="mdi-folder-open-outline"
            @click.stop="abrir(item)">Ver documentos</v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ Detalle de una persona ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="900" scrollable @update:model-value="detalleId = null">
      <v-card v-if="detalle">
        <v-card-title class="pt-4 cabecera-detalle">
          <div class="avatar-iniciales grande">{{ iniciales(detalle) }}</div>
          <div>
            <div style="font-weight:700; font-size:17px;">{{ nombreCompleto(detalle) }}</div>
            <div class="sub-linea">{{ detalle.cargo || 'Sin cargo' }} · {{ detalle.email }}</div>
          </div>
          <v-spacer />
          <v-chip size="small" variant="tonal" :color="detalle.esHonorarios ? 'grey' : 'primary'">
            {{ detalle.esHonorarios ? 'Honorarios' : 'Planilla' }}
          </v-chip>
        </v-card-title>

        <v-card-text>
          <section v-for="s in seccionesDetalle" :key="s.clave" class="seccion">
            <div class="seccion-titulo">
              {{ s.titulo }} <span class="seccion-n">{{ s.items.length }}</span>
            </div>

            <v-table v-if="s.items.length" density="compact">
              <thead>
                <tr>
                  <th v-if="s.clave === 'recibos'">Mes</th>
                  <th>Nombre</th><th>Fecha</th><th>Origen</th><th class="text-right" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in s.items" :key="d.key">
                  <td v-if="s.clave === 'recibos'"><strong>{{ etiquetaPeriodo(d.periodo) }}</strong></td>
                  <td>{{ d.nombre }}</td>
                  <td>{{ d.fecha ? fechaCorta(d.fecha) : '—' }}</td>
                  <td><span class="origen-chip" :class="d.origenClase">{{ d.origen }}</span></td>
                  <td class="text-right">
                    <v-btn icon="mdi-eye-outline" size="small" variant="text" title="Ver aquí mismo"
                      @click="ver(d)" />
                    <v-btn icon="mdi-download-outline" size="small" variant="text" title="Descargar"
                      :href="bajar(d)" />
                    <v-btn v-if="puedeEliminar && d.eliminable" icon="mdi-delete-outline" size="small"
                      variant="text" color="error" title="Eliminar" @click="eliminar(d)" />
                  </td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="sin-datos">{{ s.vacio }}</div>
          </section>
        </v-card-text>

        <v-card-actions style="padding: 8px 20px 18px;">
          <v-spacer />
          <v-btn variant="text" @click="detalleId = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * RR. HH. → Documentos del equipo (23/09/2026).
 *
 * Junta en un solo lugar lo que cada colaborador sube desde Mi Espacio (recibos
 * por honorarios y contratos) con lo que RR. HH. carga en el expediente
 * (contratos laborales con PDF, certificados, DNI…). Sirve para dos preguntas:
 *   · ¿a quién le falta su contrato en PDF?
 *   · ¿quién de los de honorarios todavía no entregó el recibo de este mes?
 *
 * Solo lee (client.from(...).select), como el Expediente; lo único que escribe es
 * borrar un documento, y eso pasa por POST /api/piola/colaborador (documento_eliminar).
 * No se lee ningún monto: `piola_colaboradores` se pide con columnas explícitas.
 */
import { ref, computed, onMounted } from 'vue'
import {
  fechaCorta, periodoActual, ultimosPeriodos, etiquetaPeriodo, urlDocumento, urlDescarga,
  traerTodo, apiPiola,
} from '@/composables/usePiola'
import PiolaVisorPdf from './PiolaVisorPdf.vue'

defineProps<{ perfil: any; puedeEliminar: boolean }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()

const colaboradores = ref<any[]>([])
const documentos = ref<any[]>([])
const contratosLab = ref<any[]>([])
const cargando = ref(false)

async function cargar() {
  cargando.value = true
  // Orden por id: paginar sin un orden estable puede repetir o saltarse filas
  const [c, d, cl] = await Promise.all([
    traerTodo(() => client.from('piola_colaboradores')
      .select('id, email, nombre, nombres, apellidos, cargo, tipo_contrato, estado_laboral, activo').order('id')),
    traerTodo(() => client.from('piola_colaborador_documentos').select('*').order('id')),
    traerTodo(() => client.from('piola_contratos_laborales')
      .select('id, colaborador_id, tipo_contrato, es_renovacion, fecha_inicio, contrato_pdf')
      .not('contrato_pdf', 'is', null).order('id')),
  ])
  const error = c.error || d.error || cl.error
  if (error) emit('notify', { text: `Error cargando los documentos: ${error.message}`, color: 'error' })
  colaboradores.value = c.data
  documentos.value = d.data
  contratosLab.value = cl.data
  cargando.value = false
}

/* ── Filtros ── */
const fBuscar = ref('')
const periodo = ref(periodoActual())
const fModalidad = ref('todas')
const fEstado = ref('todos')
const verCesados = ref(false)

const opcionesPeriodo = ultimosPeriodos(18).map(p => ({ value: p, title: etiquetaPeriodo(p) }))
const OPCIONES_MODALIDAD = [
  { value: 'todas', title: 'Todas' },
  { value: 'honorarios', title: 'Honorarios' },
  { value: 'planilla', title: 'Planilla' },
]
const OPCIONES_ESTADO = [
  { value: 'todos', title: 'Todos' },
  { value: 'pendientes', title: 'Con algo pendiente' },
  { value: 'aldia', title: 'Al día' },
]

/* ── Derivados ── */
const nombreCompleto = (c: any) => [c?.nombres, c?.apellidos].filter(Boolean).join(' ') || c?.nombre || '—'
const iniciales = (c: any) => nombreCompleto(c)
  .split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('')

const cesado = (c: any) => c.estado_laboral === 'cesado' || c.activo === false

/** Un documento del expediente, listo para pintar en una fila. */
function aItem(d: any, emailPersona: string) {
  const esSuyo = String(d.subido_por || '').toLowerCase() === String(emailPersona || '').toLowerCase()
  return {
    key: `d${d.id}`,
    id: d.id,
    nombre: d.nombre,
    periodo: d.periodo || null,
    fecha: d.fecha || null,
    path: d.archivo_url,
    origen: esSuyo ? 'Colaborador' : 'RR. HH.',
    origenClase: esSuyo ? 'o-mio' : 'o-rrhh',
    eliminable: true,
    creado: String(d.created_at || ''),
  }
}

// Mismos valores que `TIPOS_CONTRATO_LAB` del Expediente
const TIPOS_CONTRATO_LAB: Record<string, string> = {
  planilla: 'planilla', honorarios: 'honorarios', practicas: 'prácticas', temporal: 'plazo temporal',
}

const filas = computed(() => {
  const porColab = new Map<number, any[]>()
  for (const d of documentos.value) porColab.set(d.colaborador_id, [...(porColab.get(d.colaborador_id) || []), d])
  const labPorColab = new Map<number, any[]>()
  for (const x of contratosLab.value) labPorColab.set(x.colaborador_id, [...(labPorColab.get(x.colaborador_id) || []), x])

  return colaboradores.value.map((c) => {
    const docs = porColab.get(c.id) || []
    const de = (tipo: string) => docs.filter(d => d.tipo === tipo).map(d => aItem(d, c.email))
    const masReciente = (a: any, b: any) =>
      String(b.fecha || b.creado || '').localeCompare(String(a.fecha || a.creado || ''))

    // Contratos: los que subió alguien como documento + los contratos laborales con PDF
    const contratos = [
      ...de('contrato'),
      ...(labPorColab.get(c.id) || []).map((x: any) => ({
        key: `c${x.id}`, id: x.id,
        nombre: `Contrato de ${TIPOS_CONTRATO_LAB[x.tipo_contrato] || x.tipo_contrato || 'trabajo'}${x.es_renovacion ? ' (renovación)' : ''}`,
        periodo: null, fecha: x.fecha_inicio, path: x.contrato_pdf, origen: 'Expediente', origenClase: 'o-exp',
        eliminable: false, creado: '',
      })),
    ].filter(x => x.path).sort(masReciente)

    const recibos = de('recibo_honorarios')
      .sort((a, b) => String(b.periodo || '').localeCompare(String(a.periodo || '')) || masReciente(a, b))
    const certificados = de('certificado').sort(masReciente)
    const otros = docs.filter(d => !['contrato', 'recibo_honorarios', 'certificado'].includes(d.tipo))
      .map(d => ({ ...aItem(d, c.email), nombre: `${etiquetaOtro(d.tipo)} — ${d.nombre}` })).sort(masReciente)

    const esHonorarios = c.tipo_contrato !== 'planilla'
    const reciboDelMes = recibos.find(r => r.periodo === periodo.value) || null
    return {
      ...c, esHonorarios, contratos, recibos, certificados, otros, reciboDelMes,
      pendiente: !contratos.length || (esHonorarios && !reciboDelMes),
    }
  })
})

const ETIQUETAS_OTROS: Record<string, string> = { dni: 'DNI', cv: 'CV', adenda: 'Adenda', otro: 'Otro' }
const etiquetaOtro = (t: string) => ETIQUETAS_OTROS[t] || t

/** Quienes cuentan para el resumen: los vigentes (o todos, si se pidió ver cesados). */
const enAlcance = computed(() => filas.value.filter(f => verCesados.value || !cesado(f)))

const resumen = computed(() => {
  const honorarios = enAlcance.value.filter(f => f.esHonorarios)
  const recibidos = honorarios.filter(f => f.reciboDelMes).length
  return {
    vigentes: enAlcance.value.length,
    conContrato: enAlcance.value.filter(f => f.contratos.length).length,
    honorarios: honorarios.length,
    recibidos,
    pendientes: honorarios.length - recibidos,
  }
})

const filtrados = computed(() => {
  const q = (fBuscar.value || '').trim().toLowerCase()
  return enAlcance.value.filter((f) => {
    if (q && !`${nombreCompleto(f)} ${f.email}`.toLowerCase().includes(q)) return false
    if (fModalidad.value === 'honorarios' && !f.esHonorarios) return false
    if (fModalidad.value === 'planilla' && f.esHonorarios) return false
    if (fEstado.value === 'pendientes' && !f.pendiente) return false
    if (fEstado.value === 'aldia' && f.pendiente) return false
    return true
  })
})

const headers = computed(() => [
  { title: 'Colaborador', key: 'nombre' },
  { title: 'Modalidad', key: 'modalidad', sortable: false },
  { title: 'Contrato', key: 'contrato', sortable: false },
  { title: `Recibo de ${etiquetaPeriodo(periodo.value)}`, key: 'reciboMes', sortable: false },
  { title: 'Recibos', key: 'nRecibos', sortable: false, align: 'center' as const },
  { title: 'Certificados', key: 'nCertificados', sortable: false, align: 'center' as const },
  { title: '', key: 'acciones', sortable: false, align: 'end' as const },
])

/* ── Detalle de una persona ── */
const detalleId = ref<number | null>(null)
const detalle = computed(() => filas.value.find(f => f.id === detalleId.value) || null)
const abrir = (fila: any) => { detalleId.value = fila.id }

const seccionesDetalle = computed(() => {
  const d = detalle.value
  if (!d) return []
  return [
    { clave: 'contratos', titulo: 'Contratos', items: d.contratos, vacio: 'Todavía no hay ningún contrato cargado.' },
    ...(d.esHonorarios || d.recibos.length
      ? [{ clave: 'recibos', titulo: 'Recibos por honorarios', items: d.recibos, vacio: 'Todavía no subió ningún recibo.' }]
      : []),
    { clave: 'certificados', titulo: 'Certificados', items: d.certificados, vacio: 'Sin certificados.' },
    ...(d.otros.length ? [{ clave: 'otros', titulo: 'Otros documentos', items: d.otros, vacio: '' }] : []),
  ]
})

/* ── Visor emergente y descarga ── */
const visor = ref({ abierto: false, src: '', titulo: '' })
const ver = (d: any) => { visor.value = { abierto: true, src: urlDocumento(client, d.path), titulo: d.nombre } }
const bajar = (d: any) => urlDescarga(client, d.path, `${d.nombre}.pdf`)

async function eliminar(d: any) {
  if (!confirm(`¿Eliminar "${d.nombre}" del expediente?`)) return
  const { error } = await apiPiola('colaborador', { accion: 'documento_eliminar', id: d.id })
  if (error) return emit('notify', { text: error.message, color: 'error' })
  emit('notify', 'Documento eliminado')
  await cargar()
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.de-total { font-size: 14px; opacity: .55; font-weight: 500; }

.filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.f-buscar { width: 220px; }
.f-periodo { width: 190px; }
.f-modalidad { width: 150px; }
.f-estado { width: 180px; }

.celda-persona { display: flex; align-items: center; gap: 10px; }
.avatar-iniciales {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #e2564a, #f2a63b); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
}
.avatar-iniciales.grande { width: 44px; height: 44px; font-size: 16px; }
.sub-linea { font-size: 11.5px; opacity: .55; }

.celda-estado { display: flex; align-items: center; gap: 2px; }
.celda-estado .v-chip { margin-right: 6px; }
.no-aplica { font-size: 12px; opacity: .4; }

.cabecera-detalle { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.seccion { margin-top: 18px; }
.seccion:first-child { margin-top: 4px; }
.seccion-titulo {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
  font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; opacity: .75;
}
.seccion-n {
  font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
  background: rgba(128, 128, 128, .18);
}
.sin-datos { font-size: 12.5px; opacity: .5; padding: 8px 0; }

.origen-chip {
  display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
}
.o-mio { background: rgba(91, 141, 239, .14); color: #5b8def; }
.o-rrhh { background: rgba(139, 92, 246, .14); color: #8b5cf6; }
.o-exp { background: rgba(128, 128, 128, .16); color: #888; }

@media (max-width: 800px) {
  .f-buscar, .f-periodo, .f-modalidad, .f-estado { width: 100%; }
}
</style>
