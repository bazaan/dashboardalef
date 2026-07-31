<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Mi espacio</h1>
      <div class="reloj">
        <v-icon icon="mdi-clock-outline" size="18" />
        <span>{{ horaActual }}</span>
        <small>hora Lima</small>
      </div>
    </header>

    <div class="content-area">
      <!-- ══════════ MARCACIÓN ══════════ -->
      <div class="marcador">
        <div class="marcador-estado">
          <div class="estado-punto" :class="estadoActual" />
          <div>
            <div class="estado-texto">{{ textoEstado }}</div>
            <div class="estado-sub">{{ subtituloEstado }}</div>
          </div>
        </div>

        <div class="marcador-botones">
          <v-btn size="large" color="success" variant="flat" :disabled="!!tareo?.check_in"
            :loading="marcando === 'check_in'" @click="marcar('check_in')">
            <v-icon icon="mdi-login" start /> Iniciar jornada
          </v-btn>
          <v-btn size="large" color="warning" variant="tonal"
            :disabled="!tareo?.check_in || !!tareo?.check_out"
            :loading="marcando === (enBreak ? 'break_end' : 'break_start')"
            @click="marcar(enBreak ? 'break_end' : 'break_start')">
            <v-icon :icon="enBreak ? 'mdi-play' : 'mdi-coffee'" start />
            {{ enBreak ? 'Terminar break' : 'Iniciar break' }}
          </v-btn>
          <v-btn size="large" color="error" variant="tonal"
            :disabled="!tareo?.check_in || !!tareo?.check_out"
            :loading="marcando === 'check_out'" @click="marcar('check_out')">
            <v-icon icon="mdi-logout" start /> Terminar jornada
          </v-btn>
        </div>

        <div class="marcador-resumen">
          <div><span>Entrada</span><strong>{{ horaLima(tareo?.check_in) }}</strong></div>
          <div><span>Salida</span><strong>{{ horaLima(tareo?.check_out) }}</strong></div>
          <div><span>Break</span><strong>{{ minutosAHoras(tareo?.break_minutes) }}</strong></div>
          <div><span>Efectivas hoy</span><strong>{{ minutosAHoras(tareo?.worked_minutes) }}</strong></div>
        </div>
      </div>

      <p class="nota-servidor">
        La hora que se registra es la del servidor en zona America/Lima, no la de tu computadora.
      </p>

      <!-- ══════════ MIS WIDGETS (§7.3) ══════════ -->
      <div class="stats-grid mt-4">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Vacaciones disponibles</span></div>
          <div class="stat-value">
            {{ w.vacaciones?.aplica ? w.vacaciones.dias_disponibles : '—' }}
            <small v-if="w.vacaciones?.aplica" style="font-size:14px; opacity:.6;">días</small>
          </div>
          <div class="stat-description">
            <template v-if="w.vacaciones?.aplica">
              {{ w.vacaciones.dias_devengados }} devengados · {{ w.vacaciones.dias_tomados }} tomados
            </template>
            <template v-else>Aplica solo a colaboradores en planilla</template>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Llevas en Piola</span></div>
          <div class="stat-value">{{ antiguedadTexto }}</div>
          <div class="stat-description">Desde {{ fechaCorta(perfil?.colaborador?.fecha_ingreso) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Renovación de contrato</span></div>
          <div class="stat-value">
            <template v-if="w.dias_para_renovacion !== null && w.dias_para_renovacion !== undefined">
              {{ w.dias_para_renovacion }} <small style="font-size:14px; opacity:.6;">días</small>
            </template>
            <template v-else>—</template>
          </div>
          <div class="stat-description">
            {{ w.fecha_fin_contrato ? 'Vence el ' + fechaCorta(w.fecha_fin_contrato) : 'Sin fecha de fin registrada' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Días trabajados este mes</span></div>
          <div class="stat-value">{{ w.dias_trabajados_mes || 0 }}</div>
          <div class="stat-description">{{ w.horas_trabajadas_mes || 0 }} horas acumuladas</div>
        </div>
      </div>

      <!-- ══════════ TABS ══════════ -->
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'historial' }]" @click="tab = 'historial'">Mi historial</button>
          <button :class="['tab', { active: tab === 'vacaciones' }]" @click="tab = 'vacaciones'">Mis vacaciones</button>
          <button :class="['tab', { active: tab === 'boletas' }]" @click="tab = 'boletas'">Mis boletas</button>
        </div>

        <v-card v-if="tab === 'historial'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Marcaciones del mes</span>
            <v-spacer />
            <span style="font-size:12.5px; opacity:.7;">
              {{ historial.resumen?.dias || 0 }} días · {{ historial.resumen?.horas || 0 }} h
            </span>
          </v-card-title>
          <v-data-table :headers="headersHistorial" :items="historial.registros || []" class="elevation-0"
            no-data-text="Todavía no tienes marcaciones este mes" :items-per-page="31">
            <template v-slot:item.fecha="{ item }">{{ fechaCorta(item.fecha) }}</template>
            <template v-slot:item.check_in="{ item }">{{ horaLima(item.check_in) }}</template>
            <template v-slot:item.check_out="{ item }">{{ horaLima(item.check_out) }}</template>
            <template v-slot:item.break_minutes="{ item }">{{ minutosAHoras(item.break_minutes) }}</template>
            <template v-slot:item.worked_minutes="{ item }">{{ minutosAHoras(item.worked_minutes) }}</template>
            <template v-slot:item.estado="{ item }">
              <span class="estado-chip" :class="'s-' + item.estado">{{ item.estado }}</span>
            </template>
            <template v-slot:item.editado_por="{ item }">
              <v-icon v-if="item.editado_por" icon="mdi-pencil" size="13"
                :title="'Corregido por ' + item.editado_por" style="opacity:.6" />
            </template>
          </v-data-table>
        </v-card>

        <div v-else-if="tab === 'vacaciones'">
          <v-card v-if="saldo?.aplica" flat class="custom-data-table" style="padding:18px;">
            <div class="form-section-title">Solicitar vacaciones</div>
            <div class="vac-form">
              <v-text-field v-model="solicitud.fecha_inicio" type="date" label="Desde" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="solicitud.fecha_fin" type="date" label="Hasta" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="solicitud.motivo" label="Motivo (opcional)" density="compact"
                hide-details variant="outlined" />
              <v-btn color="primary" variant="flat" :loading="solicitando" @click="solicitarVacaciones">
                Solicitar
              </v-btn>
            </div>
            <p class="field-hint">
              Se cuentan días hábiles (lunes a viernes). Tienes
              <b>{{ saldo.dias_disponibles }}</b> día(s) disponible(s).
            </p>
          </v-card>
          <v-alert v-else type="info" variant="tonal" density="compact">
            Las vacaciones aplican solo a colaboradores en planilla. Tu contrato está registrado como
            <b>recibo por honorarios</b>; si no es correcto, avísale a RR. HH.
          </v-alert>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Mis solicitudes</span>
            </v-card-title>
            <v-data-table :headers="headersVacaciones" :items="misSolicitudes" class="elevation-0"
              no-data-text="Sin solicitudes" :items-per-page="20">
              <template v-slot:item.rango="{ item }">
                {{ fechaCorta(item.fecha_inicio) }} → {{ fechaCorta(item.fecha_fin) }}
              </template>
              <template v-slot:item.estado="{ item }">
                <v-chip size="x-small" variant="flat" :color="colorSolicitud(item.estado)">{{ item.estado }}</v-chip>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="item.estado === 'pendiente'" size="x-small" variant="text" color="error"
                  @click="cancelar(item)">Cancelar</v-btn>
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-card v-else-if="tab === 'boletas'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Mis boletas de pago</span>
          </v-card-title>
          <v-data-table :headers="headersBoletas" :items="misBoletas" class="elevation-0"
            no-data-text="Todavía no tienes boletas emitidas" :items-per-page="24">
            <template v-slot:item.total_ingresos="{ item }">{{ PEN(item.total_ingresos) }}</template>
            <template v-slot:item.total_descuentos="{ item }">{{ PEN(item.total_descuentos) }}</template>
            <template v-slot:item.neto="{ item }"><strong>{{ PEN(item.neto) }}</strong></template>
            <template v-slot:item.acciones="{ item }">
              <v-btn v-if="item.pdf_url" icon="mdi-file-eye" size="x-small" variant="text"
                :href="item.pdf_url" target="_blank" title="Ver / imprimir" />
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Mi espacio — la vista del colaborador (§7.1, §7.2, §7.3).
 *
 * Es lo único que ve el rol "Colaborador": marca su jornada y sus breaks,
 * consulta su historial, pide vacaciones y descarga sus propias boletas.
 * Nada de esto le muestra datos de terceros: las boletas se piden con
 * ?vista=mias y el endpoint filtra por su correo.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PEN, fechaCorta, horaLima, minutosAHoras } from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{
  (e: 'notify', payload: any): void
  (e: 'perfil-actualizado'): void
}>()

const tab = ref('historial')
const w = computed(() => props.perfil?.widgets || {})

/* ── Reloj en vivo ── */
const horaActual = ref('')
let intervalo: any = null
function actualizarReloj() {
  horaActual.value = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

/* ── Marcación ── */
const tareo = ref<any>(null)
const marcando = ref<string | null>(null)
const enBreak = computed(() => tareo.value?.break_abierto === true)

const estadoActual = computed(() => {
  if (!tareo.value?.check_in) return 'sin-marcar'
  if (tareo.value.check_out) return 'cerrada'
  return enBreak.value ? 'break' : 'jornada'
})
const textoEstado = computed(() => ({
  'sin-marcar': 'Aún no has iniciado tu jornada',
  jornada: 'En jornada',
  break: 'En break',
  cerrada: 'Jornada terminada',
}[estadoActual.value]))
const subtituloEstado = computed(() => {
  if (estadoActual.value === 'sin-marcar') return 'Marca tu entrada para empezar a contar'
  if (estadoActual.value === 'cerrada') return `Trabajaste ${minutosAHoras(tareo.value?.worked_minutes)} hoy`
  if (enBreak.value) return 'El tiempo de break no cuenta como horas efectivas'
  return `Entraste a las ${horaLima(tareo.value?.check_in)}`
})

async function marcar(accion: string) {
  marcando.value = accion
  try {
    const res = await $fetch<any>('/api/piola/tareo', { method: 'POST', body: { accion } })
    tareo.value = { ...res.registro, break_abierto: res.break_abierto }
    const textos: Record<string, string> = {
      check_in: `Jornada iniciada a las ${res.hora_lima}`,
      break_start: `Break iniciado a las ${res.hora_lima}`,
      break_end: `Break terminado a las ${res.hora_lima}`,
      check_out: `Jornada cerrada a las ${res.hora_lima} — ${minutosAHoras(res.registro?.worked_minutes)} efectivas`,
    }
    emit('notify', textos[accion] || 'Marcación registrada')
    await Promise.all([cargarHistorial(), Promise.resolve(emit('perfil-actualizado'))])
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'No se pudo registrar la marcación', color: 'error' })
  } finally {
    marcando.value = null
  }
}

/* ── Historial ── */
const historial = ref<any>({})

async function cargarHistorial() {
  try { historial.value = await $fetch<any>('/api/piola/tareo', { params: { vista: 'mi' } }) }
  catch { historial.value = {} }
}

const headersHistorial = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Entrada', key: 'check_in' },
  { title: 'Salida', key: 'check_out' },
  { title: 'Break', key: 'break_minutes' },
  { title: 'Efectivas', key: 'worked_minutes' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'editado_por', sortable: false },
]

/* ── Vacaciones ── */
const saldo = ref<any>(null)
const misSolicitudes = ref<any[]>([])
const solicitud = ref<any>({ fecha_inicio: '', fecha_fin: '', motivo: '' })
const solicitando = ref(false)

async function cargarVacaciones() {
  try {
    const res = await $fetch<any>('/api/piola/vacaciones', { params: { vista: 'mi' } })
    saldo.value = res.saldo
    misSolicitudes.value = res.solicitudes || []
  } catch { /* sin ficha de colaborador todavía */ }
}

async function solicitarVacaciones() {
  const s = solicitud.value
  if (!s.fecha_inicio || !s.fecha_fin) {
    return emit('notify', { text: 'Elige el rango de fechas', color: 'error' })
  }
  solicitando.value = true
  try {
    await $fetch('/api/piola/vacaciones', {
      method: 'POST',
      body: { accion: 'solicitar', fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, motivo: s.motivo },
    })
    emit('notify', 'Solicitud enviada — queda pendiente de aprobación')
    solicitud.value = { fecha_inicio: '', fecha_fin: '', motivo: '' }
    await cargarVacaciones()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error enviando la solicitud', color: 'error' })
  } finally {
    solicitando.value = false
  }
}

async function cancelar(item: any) {
  try {
    await $fetch('/api/piola/vacaciones', { method: 'POST', body: { accion: 'cancelar', id: item.id } })
    emit('notify', 'Solicitud cancelada')
    await cargarVacaciones()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error', color: 'error' })
  }
}

const colorSolicitud = (e: string) => ({
  pendiente: 'warning', aprobada: 'success', rechazada: 'error', cancelada: 'grey',
}[e] || 'grey')

const headersVacaciones = [
  { title: 'Rango', key: 'rango', sortable: false },
  { title: 'Días', key: 'dias' },
  { title: 'Motivo', key: 'motivo' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false },
]

/* ── Boletas propias ── */
const misBoletas = ref<any[]>([])

async function cargarBoletas() {
  try {
    const res = await $fetch<any>('/api/piola/boletas', { params: { vista: 'mias' } })
    misBoletas.value = res.boletas || []
  } catch { misBoletas.value = [] }
}

const headersBoletas = [
  { title: 'Código', key: 'codigo' },
  { title: 'Periodo', key: 'periodo' },
  { title: 'Ingresos', key: 'total_ingresos' },
  { title: 'Descuentos', key: 'total_descuentos' },
  { title: 'Neto', key: 'neto' },
  { title: '', key: 'acciones', sortable: false },
]

/* ── Antigüedad legible ── */
const antiguedadTexto = computed(() => {
  const dias = Number(w.value.antiguedad_dias || 0)
  if (!dias) return '—'
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios) return `${anios} año${anios > 1 ? 's' : ''} ${meses} m`
  if (meses) return `${meses} mes${meses > 1 ? 'es' : ''}`
  return `${dias} días`
})

onMounted(async () => {
  actualizarReloj()
  intervalo = setInterval(actualizarReloj, 1000)
  tareo.value = props.perfil?.tareo_hoy || null
  await Promise.all([cargarHistorial(), cargarVacaciones(), cargarBoletas()])
})

onUnmounted(() => { if (intervalo) clearInterval(intervalo) })
</script>

<style scoped>
.reloj {
  display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.reloj small { font-size: 11px; opacity: .55; font-weight: 400; }

.marcador {
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 14px; padding: 22px 24px;
  background: rgba(128, 128, 128, .05);
}
.marcador-estado { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.estado-punto { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }
.estado-punto.jornada { background: #2e9e5b; box-shadow: 0 0 0 5px rgba(46, 158, 91, .18); }
.estado-punto.break { background: #f2a63b; box-shadow: 0 0 0 5px rgba(242, 166, 59, .18); }
.estado-punto.cerrada { background: #5b8def; box-shadow: 0 0 0 5px rgba(91, 141, 239, .18); }
.estado-punto.sin-marcar { background: #999; box-shadow: 0 0 0 5px rgba(150, 150, 150, .15); }
.estado-texto { font-size: 17px; font-weight: 700; }
.estado-sub { font-size: 12.5px; opacity: .65; margin-top: 2px; }

.marcador-botones { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }

.marcador-resumen {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 14px;
  padding-top: 16px; border-top: 1px dashed rgba(128, 128, 128, .25);
}
.marcador-resumen > div { display: flex; flex-direction: column; gap: 2px; }
.marcador-resumen span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.marcador-resumen strong { font-size: 15px; font-variant-numeric: tabular-nums; }

.nota-servidor { font-size: 11.5px; opacity: .5; margin: 10px 0 0; }
.field-hint { font-size: 12.5px; opacity: .65; margin: 10px 0 0; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 12px;
}
.vac-form { display: grid; grid-template-columns: 1fr 1fr 2fr auto; gap: 10px; align-items: center; }

.estado-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
}
.s-completo { background: rgba(46, 158, 91, .14); color: #2e9e5b; }
.s-incompleto { background: rgba(242, 166, 59, .16); color: #d98324; }
.s-falta { background: rgba(226, 86, 74, .13); color: #e2564a; }
.s-vacaciones { background: rgba(139, 92, 246, .14); color: #8b5cf6; }
.s-feriado, .s-licencia { background: rgba(128, 128, 128, .16); color: #888; }

@media (max-width: 800px) {
  .marcador-botones { flex-direction: column; }
  .marcador-botones .v-btn { width: 100%; }
  .vac-form { grid-template-columns: 1fr; }
}
</style>
