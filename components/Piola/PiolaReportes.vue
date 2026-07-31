<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Reportes y Automatizaciones</h1>
      <button class="btn-primary" @click="cargar">
        <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
      </button>
    </header>

    <div class="content-area">
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'reportes' }]" @click="tab = 'reportes'">Reportes programados</button>
          <button :class="['tab', { active: tab === 'alertas' }]" @click="tab = 'alertas'">Alertas</button>
          <button :class="['tab', { active: tab === 'historial' }]" @click="tab = 'historial'">Historial de envíos</button>
        </div>

        <!-- ══════════ REPORTES PROGRAMADOS ══════════ -->
        <div v-if="tab === 'reportes'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Los reportes se envían solos según su frecuencia. La Scheduled Function corre a diario y
            decide cuáles tocan; cambiar la frecuencia o los destinatarios aquí surte efecto
            <b>sin redeployar</b>.
          </v-alert>

          <div class="reportes-grid">
            <v-card v-for="r in programados" :key="r.id" flat class="reporte-card">
              <div class="reporte-head">
                <div>
                  <div class="reporte-nombre">{{ r.nombre }}</div>
                  <div class="reporte-tipo">{{ descripcionTipo(r.tipo) }}</div>
                </div>
                <v-switch :model-value="r.activo" color="primary" density="compact" hide-details
                  :disabled="!puedeEditar" @update:model-value="(v: any) => alternar(r, v)" />
              </div>

              <div class="reporte-campos">
                <v-select :model-value="r.frecuencia" :items="['semanal', 'quincenal', 'mensual']"
                  label="Frecuencia" density="compact" hide-details variant="outlined" :disabled="!puedeEditar"
                  @update:model-value="(v: any) => actualizar(r, { frecuencia: v })" />
                <v-text-field :model-value="r.dia_ejecucion" type="number" label="Día"
                  density="compact" hide-details variant="outlined" :disabled="!puedeEditar"
                  :hint="r.frecuencia === 'semanal' ? '0 = domingo, 1 = lunes…' : 'Día del mes'"
                  persistent-hint
                  @change="(e: any) => actualizar(r, { dia_ejecucion: Number(e.target.value) })" />
                <v-select :model-value="r.canal" :items="['correo', 'whatsapp', 'ambos']" label="Canal"
                  density="compact" hide-details variant="outlined" :disabled="!puedeEditar"
                  @update:model-value="(v: any) => actualizar(r, { canal: v })" />
              </div>

              <v-combobox :model-value="r.destinatarios || []" label="Destinatarios (correos y/o teléfonos)"
                density="compact" hide-details variant="outlined" multiple chips closable-chips
                class="mt-3" :disabled="!puedeEditar"
                @update:model-value="(v: any) => actualizar(r, { destinatarios: v })" />

              <div class="reporte-pie">
                <span>Última ejecución: {{ r.last_run_at ? fechaHora(r.last_run_at) : 'nunca' }}</span>
                <div style="display:flex; gap:6px;">
                  <v-btn size="x-small" variant="text" @click="previsualizar(r)">Vista previa</v-btn>
                  <v-btn size="x-small" variant="tonal" :loading="ejecutando === r.tipo" @click="ejecutar(r)">
                    Enviar ahora
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>
        </div>

        <!-- ══════════ ALERTAS ══════════ -->
        <div v-else-if="tab === 'alertas'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Avisos por <b>WhatsApp</b> con anticipación configurable. El valor pedido fue 7 días para
            facturas y contratos, pero cada tipo se ajusta aquí — no está fijado en el código.
          </v-alert>

          <v-card flat class="custom-data-table" style="padding:18px;">
            <div v-for="s in settings" :key="s.id" class="alerta-fila">
              <div class="alerta-info">
                <strong>{{ s.descripcion || s.tipo }}</strong>
                <span>{{ s.tipo }}</span>
              </div>
              <v-text-field :model-value="s.dias_antes" type="number" label="Días antes" density="compact"
                hide-details variant="outlined" style="max-width:120px;" :disabled="!puedeEditar"
                @change="(e: any) => actualizarAlerta(s, { dias_antes: Number(e.target.value) })" />
              <v-select :model-value="s.canal" :items="['whatsapp', 'correo', 'ambos']" label="Canal"
                density="compact" hide-details variant="outlined" style="max-width:140px;"
                :disabled="!puedeEditar"
                @update:model-value="(v: any) => actualizarAlerta(s, { canal: v })" />
              <v-combobox :model-value="s.destinatarios || []" label="Destinatarios" density="compact"
                hide-details variant="outlined" multiple chips closable-chips style="min-width:230px;"
                :disabled="!puedeEditar"
                @update:model-value="(v: any) => actualizarAlerta(s, { destinatarios: v })" />
              <v-switch :model-value="s.activo" color="primary" density="compact" hide-details
                :disabled="!puedeEditar" @update:model-value="(v: any) => actualizarAlerta(s, { activo: v })" />
            </div>

            <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; align-items:center;">
              <v-btn color="primary" variant="flat" :loading="corriendoAlertas" @click="correrAlertas">
                <v-icon icon="mdi-bell-ring" start /> Correr el motor ahora
              </v-btn>
              <span class="field-hint">
                Detecta lo que vence pronto, guarda las alertas nuevas y las manda por WhatsApp.
              </span>
            </div>
          </v-card>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Alertas generadas ({{ alertas.length }})</span>
            </v-card-title>
            <v-data-table :headers="headersAlertas" :items="alertas" class="elevation-0"
              no-data-text="Todavía no se ha generado ninguna alerta" :items-per-page="25">
              <template v-slot:item.fecha_objetivo="{ item }">{{ fechaCorta(item.fecha_objetivo) }}</template>
              <template v-slot:item.estado="{ item }">
                <v-chip size="x-small" variant="flat"
                  :color="item.estado === 'enviada' ? 'success' : item.estado === 'error' ? 'error' : 'warning'">
                  {{ item.estado }}
                </v-chip>
              </template>
              <template v-slot:item.created_at="{ item }">{{ fechaHora(item.created_at) }}</template>
            </v-data-table>
          </v-card>
        </div>

        <!-- ══════════ HISTORIAL ══════════ -->
        <v-card v-else-if="tab === 'historial'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Ejecuciones de reportes</span>
          </v-card-title>
          <v-data-table :headers="headersCorridas" :items="corridas" class="elevation-0"
            no-data-text="Sin ejecuciones registradas" :items-per-page="25" show-expand>
            <template v-slot:item.tipo="{ item }">{{ descripcionTipo(item.tipo) }}</template>
            <template v-slot:item.status="{ item }">
              <v-chip size="x-small" variant="flat"
                :color="item.status === 'success' ? 'success' : item.status === 'empty' ? 'warning' : 'error'">
                {{ item.status }}
              </v-chip>
            </template>
            <template v-slot:item.created_at="{ item }">{{ fechaHora(item.created_at) }}</template>
            <template v-slot:item.duracion_ms="{ item }">{{ item.duracion_ms }} ms</template>
            <template v-slot:expanded-row="{ columns, item }">
              <tr>
                <td :colspan="columns.length" style="padding:14px 20px;">
                  <div v-if="item.error_message" style="color:#e2564a; margin-bottom:10px;">
                    <strong>Error:</strong> {{ item.error_message }}
                  </div>
                  <pre class="json">{{ JSON.stringify(item.payload?.datos ?? item.payload, null, 2) }}</pre>
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>

    <!-- ══════════ VISTA PREVIA ══════════ -->
    <v-dialog :model-value="!!preview" max-width="860" scrollable @update:model-value="preview = null">
      <v-card v-if="preview">
        <v-card-title class="pt-4">Vista previa — {{ preview.tipo }}</v-card-title>
        <v-card-text>
          <div class="preview-tabs">
            <button :class="['tab', { active: previewTab === 'correo' }]" @click="previewTab = 'correo'">Correo</button>
            <button :class="['tab', { active: previewTab === 'whatsapp' }]" @click="previewTab = 'whatsapp'">WhatsApp</button>
          </div>
          <iframe v-if="previewTab === 'correo'" :srcdoc="preview.html" class="preview-frame" />
          <pre v-else class="preview-wpp">{{ preview.mensaje_whatsapp }}</pre>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="preview = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Reportes y Automatizaciones (§9) + configuración de alertas (§4).
 *
 * Tres reportes: producción por marca, ventas del mes y financiero de cierre.
 * Cada uno tiene frecuencia, canal y destinatarios configurables desde aquí, y
 * se puede previsualizar (correo y WhatsApp) o disparar a mano antes de confiar
 * en el cron.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import { fechaCorta, fechaHora, periodoActual } from '@/composables/usePiola'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const puedeEditar = computed(() =>
  props.perfil?.es_admin || piolaCan(props.perfil?.permisos, 'reportes', 'edit'))

const tab = ref('reportes')
const programados = ref<any[]>([])
const corridas = ref<any[]>([])
const alertas = ref<any[]>([])
const settings = ref<any[]>([])

async function cargar() {
  try {
    const [rep, ale] = await Promise.all([
      $fetch<any>('/api/piola/reportes'),
      $fetch<any>('/api/piola/alertas'),
    ])
    programados.value = rep.programados || []
    corridas.value = rep.corridas || []
    alertas.value = ale.alertas || []
    settings.value = ale.settings || []
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error cargando reportes', color: 'error' })
  }
}

const descripcionTipo = (t: string) => ({
  produccion_por_marca: '¿Se cumplió el 100 % de piezas comprometidas por marca?',
  ventas_mensual: 'Leads que entraron, convertidos, fríos / tibios / calientes',
  financiero: 'Ingresos, egresos, flujo de caja y proyección',
}[t] || t)

/* ══════════ Reportes ══════════ */
const ejecutando = ref<string | null>(null)
const preview = ref<any>(null)
const previewTab = ref('correo')

async function actualizar(r: any, patch: any) {
  const { error } = await client.from('piola_scheduled_reports').update(patch).eq('id', r.id)
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  Object.assign(r, patch)
  emit('notify', 'Configuración guardada')
}

async function alternar(r: any, activo: boolean) {
  await actualizar(r, { activo })
}

async function previsualizar(r: any) {
  try {
    const res = await $fetch<any>('/api/piola/reportes', {
      params: { preview: 1, tipo: r.tipo, periodo: periodoActual() },
    })
    preview.value = res.reporte
    previewTab.value = 'correo'
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error generando la vista previa', color: 'error' })
  }
}

async function ejecutar(r: any) {
  if (!(r.destinatarios || []).length) {
    return emit('notify', { text: 'Agrega al menos un destinatario antes de enviar', color: 'warning' })
  }
  ejecutando.value = r.tipo
  try {
    const res = await $fetch<any>('/api/piola/reportes', { params: { run: 1, tipo: r.tipo } })
    const resultado = res.resultados?.[0]
    emit('notify', resultado?.status === 'error'
      ? { text: `Error: ${resultado.error}`, color: 'error' }
      : `Reporte enviado (${resultado?.status || 'ok'})`)
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error ejecutando el reporte', color: 'error' })
  } finally {
    ejecutando.value = null
  }
}

/* ══════════ Alertas ══════════ */
const corriendoAlertas = ref(false)

async function actualizarAlerta(s: any, patch: any) {
  const { error } = await client.from('piola_alert_settings').update(patch).eq('id', s.id)
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  Object.assign(s, patch)
  emit('notify', 'Alerta configurada')
}

async function correrAlertas() {
  corriendoAlertas.value = true
  try {
    const res = await $fetch<any>('/api/piola/alertas', { params: { run: 1 } })
    emit('notify', res.nuevas
      ? `${res.generadas} detectada(s) · ${res.nuevas} nueva(s) · ${res.enviadas} enviada(s) por WhatsApp`
      : `${res.generadas} alerta(s) detectadas, todas ya habían sido avisadas`)
    await cargar()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error corriendo el motor de alertas', color: 'error' })
  } finally {
    corriendoAlertas.value = false
  }
}

const headersAlertas = [
  { title: 'Tipo', key: 'tipo' },
  { title: 'Aviso', key: 'titulo' },
  { title: 'Fecha objetivo', key: 'fecha_objetivo' },
  { title: 'Canal', key: 'canal' },
  { title: 'Estado', key: 'estado' },
  { title: 'Generada', key: 'created_at' },
]
const headersCorridas = [
  { title: 'Reporte', key: 'tipo' },
  { title: 'Periodo', key: 'periodo' },
  { title: 'Origen', key: 'origen' },
  { title: 'Disparado por', key: 'triggered_by' },
  { title: 'Estado', key: 'status' },
  { title: 'Duración', key: 'duracion_ms' },
  { title: 'Fecha', key: 'created_at' },
]

onMounted(cargar)
</script>

<style scoped>
.reportes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.reporte-card {
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 12px; padding: 18px 20px;
}
.reporte-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.reporte-nombre { font-weight: 700; font-size: 15px; }
.reporte-tipo { font-size: 12px; opacity: .6; margin-top: 3px; line-height: 1.4; }
.reporte-campos { display: grid; grid-template-columns: 1.4fr 1fr 1.2fr; gap: 10px; }
.reporte-pie {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(128, 128, 128, .25);
  font-size: 11.5px; opacity: .7;
}

.alerta-fila {
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  padding: 12px 0; border-bottom: 1px solid rgba(128, 128, 128, .14);
}
.alerta-fila:last-of-type { border-bottom: none; }
.alerta-info { flex: 1 1 210px; display: flex; flex-direction: column; gap: 2px; }
.alerta-info strong { font-size: 13.5px; }
.alerta-info span { font-size: 11px; opacity: .5; font-family: monospace; }

.field-hint { font-size: 12.5px; opacity: .6; }

.preview-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
.preview-frame {
  width: 100%; height: 460px; border: 1px solid rgba(128, 128, 128, .25); border-radius: 8px; background: #fff;
}
.preview-wpp {
  white-space: pre-wrap; font-family: inherit; font-size: 13.5px; line-height: 1.55;
  background: rgba(37, 211, 102, .08); border: 1px solid rgba(37, 211, 102, .3);
  border-radius: 10px; padding: 16px; margin: 0;
}
.json {
  font-size: 11.5px; max-height: 300px; overflow: auto; margin: 0;
  background: rgba(128, 128, 128, .08); padding: 12px; border-radius: 8px;
}

@media (max-width: 800px) {
  .reporte-campos { grid-template-columns: 1fr; }
}
</style>
