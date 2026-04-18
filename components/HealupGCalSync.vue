<template>
  <div class="gcal-sync">

    <header class="top-header">
      <h1>Google Calendar Sync</h1>
      <div style="display: flex; gap: 10px; align-items: center;">
        <v-text-field
          v-model="selectedDate"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 180px;"
        />
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-sync"
          :loading="loading"
          @click="sincronizar"
        >
          Sincronizar
        </v-btn>
      </div>
    </header>

    <!-- Resumen -->
    <div v-if="resultado" class="content-area" style="margin-bottom: 1rem;">
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <v-chip color="primary" variant="tonal">
          <v-icon icon="mdi-google" start size="16" />
          GCal: {{ resultado.gcal_total }} eventos
        </v-chip>
        <v-chip color="success" variant="tonal">
          <v-icon icon="mdi-check-circle" start size="16" />
          En dashboard: {{ resultado.dashboard_total }}
        </v-chip>
        <v-chip v-if="resultado.faltantes > 0" color="warning" variant="tonal">
          <v-icon icon="mdi-alert" start size="16" />
          Faltan importar: {{ resultado.faltantes }}
        </v-chip>
        <v-chip v-else-if="resultado.gcal_total > 0" color="success" variant="tonal">
          <v-icon icon="mdi-check-all" start size="16" />
          Todo sincronizado
        </v-chip>
      </div>
    </div>

    <!-- Alerta de error -->
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <!-- Tabla de eventos -->
    <div class="content-area">
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">
            Eventos del {{ formatDateDisplay(selectedDate) }}
            <v-chip v-if="events.length" size="x-small" color="primary" class="ms-2">
              {{ events.length }}
            </v-chip>
          </span>
          <v-spacer />
          <v-btn
            v-if="faltantes.length > 0"
            color="warning"
            variant="tonal"
            size="small"
            prepend-icon="mdi-download-multiple"
            :loading="importandoTodos"
            @click="importarTodos"
          >
            Importar todos ({{ faltantes.length }})
          </v-btn>
        </v-card-title>

        <v-data-table
          :headers="headers"
          :items="events"
          :loading="loading"
          class="elevation-0"
          no-data-text="Haz clic en Sincronizar para cargar eventos"
          items-per-page="50"
          density="comfortable"
        >
          <!-- Hora -->
          <template v-slot:item.time="{ item }">
            <span style="font-family: monospace; font-weight: 600;">
              {{ item.time || '—' }}
            </span>
          </template>

          <!-- Paciente -->
          <template v-slot:item.gcal_summary="{ item }">
            <div>
              <span style="font-weight: 500;">{{ item.gcal_summary || `${item.client_name} ${item.client_surname}`.trim() }}</span>
              <div v-if="item.client_phone" style="font-size: 0.75rem; opacity: 0.6;">
                {{ item.client_phone }}
                <span v-if="item.client_dni"> | DNI: {{ item.client_dni }}</span>
              </div>
            </div>
          </template>

          <!-- Estado -->
          <template v-slot:item.estado="{ item }">
            <v-chip
              :color="getEstadoColor(item)"
              size="small"
              variant="tonal"
            >
              <v-icon :icon="getEstadoIcon(item)" start size="14" />
              {{ getEstadoLabel(item) }}
            </v-chip>
          </template>

          <!-- Fuente -->
          <template v-slot:item.fuente="{ item }">
            <v-chip
              :color="item.solo_dashboard ? 'blue' : 'purple'"
              size="x-small"
              variant="tonal"
            >
              {{ item.solo_dashboard ? 'Solo Dashboard' : 'Google Calendar' }}
            </v-chip>
          </template>

          <!-- Acciones -->
          <template v-slot:item.acciones="{ item }">
            <div style="display: flex; gap: 4px;">
              <v-btn
                v-if="!item.en_dashboard"
                color="warning"
                variant="tonal"
                size="x-small"
                prepend-icon="mdi-download"
                :loading="importando[item.gcal_id]"
                @click="importarEvento(item)"
              >
                Importar
              </v-btn>
              <v-chip v-else-if="item.cobro_completado" color="success" size="x-small" variant="tonal">
                <v-icon icon="mdi-cash-check" start size="12" />
                Cobrado
              </v-chip>
              <v-chip v-else color="info" size="x-small" variant="tonal">
                <v-icon icon="mdi-check" start size="12" />
                OK
              </v-chip>
            </div>
          </template>
        </v-data-table>
      </v-card>
    </div>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar" :color="snackColor" :timeout="3000" location="bottom right">
      {{ snackMsg }}
    </v-snackbar>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

/* ─── Estado ─────────────────────────────────────── */
const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)
const loading = ref(false)
const error = ref('')

const resultado = ref<any>(null)
const events = ref<any[]>([])
const importando = ref<Record<string, boolean>>({})
const importandoTodos = ref(false)

const snackbar = ref(false)
const snackMsg = ref('')
const snackColor = ref('success')

/* ─── Computed ───────────────────────────────────── */
const faltantes = computed(() => events.value.filter(e => !e.en_dashboard && !e.solo_dashboard))

/* ─── Headers ────────────────────────────────────── */
const headers = [
  { title: 'Hora',     key: 'time',         sortable: true,  width: '80px'  },
  { title: 'Paciente', key: 'gcal_summary',  sortable: true                  },
  { title: 'Estado',   key: 'estado',        sortable: false, width: '160px' },
  { title: 'Fuente',   key: 'fuente',        sortable: false, width: '140px' },
  { title: '',         key: 'acciones',      sortable: false, width: '130px' }
]

/* ─── Sincronizar ────────────────────────────────── */
const sincronizar = async () => {
  loading.value = true
  error.value = ''
  resultado.value = null
  events.value = []

  try {
    const data = await $fetch<any>(`/api/healup/gcal-events`, {
      params: { date: selectedDate.value }
    })
    resultado.value = data
    events.value = data.events || []

    if (data.faltantes > 0) {
      showSnack(`${data.faltantes} evento(s) pendiente(s) de importar`, 'warning')
    } else if (data.gcal_total > 0) {
      showSnack('Todo sincronizado', 'success')
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Error al sincronizar'
  } finally {
    loading.value = false
  }
}

/* ─── Importar evento individual ─────────────────── */
const importarEvento = async (item: any) => {
  const key = item.gcal_id || item.time
  importando.value[key] = true

  try {
    const res = await $fetch<any>('/api/healup/importar-gcal', {
      method: 'POST',
      body: {
        date: selectedDate.value,
        time: item.time,
        client_name: item.client_name,
        client_surname: item.client_surname,
        client_phone: item.client_phone,
        client_dni: item.client_dni,
        subject: item.gcal_summary,
        cabina: item.cabina || 'cabina1',
        gcal_id: item.gcal_id
      }
    })

    if (res.success) {
      item.en_dashboard = true
      item.dashboard_event_id = res.event_id
      if (resultado.value) resultado.value.faltantes--
      showSnack(res.message, 'success')
    } else {
      showSnack(res.message || 'No se pudo importar', 'warning')
      if (res.duplicado) item.en_dashboard = true
    }
  } catch (err: any) {
    showSnack(err?.data?.statusMessage || 'Error al importar', 'error')
  } finally {
    importando.value[key] = false
  }
}

/* ─── Importar todos ─────────────────────────────── */
const importarTodos = async () => {
  importandoTodos.value = true
  let ok = 0
  let fail = 0

  for (const item of faltantes.value) {
    try {
      const res = await $fetch<any>('/api/healup/importar-gcal', {
        method: 'POST',
        body: {
          date: selectedDate.value,
          time: item.time,
          client_name: item.client_name,
          client_surname: item.client_surname,
          client_phone: item.client_phone,
          client_dni: item.client_dni,
          subject: item.gcal_summary,
          cabina: item.cabina || 'cabina1',
          gcal_id: item.gcal_id
        }
      })
      if (res.success || res.duplicado) {
        item.en_dashboard = true
        item.dashboard_event_id = res.event_id
        ok++
      } else {
        fail++
      }
    } catch {
      fail++
    }
  }

  if (resultado.value) resultado.value.faltantes = faltantes.value.length
  importandoTodos.value = false
  showSnack(`Importados: ${ok}${fail ? `, errores: ${fail}` : ''}`, fail ? 'warning' : 'success')
}

/* ─── Helpers de UI ──────────────────────────────── */
function getEstadoColor(item: any): string {
  if (!item.en_dashboard) return 'warning'
  if (item.cobro_completado) return 'success'
  return 'info'
}

function getEstadoIcon(item: any): string {
  if (!item.en_dashboard) return 'mdi-alert-circle-outline'
  if (item.cobro_completado) return 'mdi-cash-check'
  return 'mdi-check-circle-outline'
}

function getEstadoLabel(item: any): string {
  if (!item.en_dashboard) return 'Falta en dashboard'
  if (item.cobro_completado) return 'Cobrado'
  return 'Sincronizado'
}

function formatDateDisplay(date: string): string {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dt = new Date(date + 'T12:00:00')
  return `${dias[dt.getDay()]} ${d}/${m}/${y}`
}

function showSnack(msg: string, color: string = 'success') {
  snackMsg.value = msg
  snackColor.value = color
  snackbar.value = true
}
</script>
