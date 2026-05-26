<template>
  <div class="cmn-panel">
    <!-- HEADER ────────────────────────────────────────────────────── -->
    <div class="cmn-header">
      <div>
        <h2 class="cmn-title">📅 Citas de Mañana — Resumen WhatsApp</h2>
        <p class="cmn-subtitle">
          Todos los días a las <strong>19:00 hora Lima</strong> el sistema arma el resumen de
          <strong>todas las citas del día siguiente</strong>, uniendo el calendario del dashboard
          con Google Calendar, deduplicando pacientes (por DNI / teléfono / nombre) y enviándolo a
          n8n, que dispara el WhatsApp. Las horas se muestran en formato amigable (ej: 27/05/26 2:00pm).
        </p>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button class="cmn-btn-secondary" :disabled="loading" @click="cargarLogs">
          <v-icon icon="mdi-refresh" size="16" /> Refrescar
        </button>
        <button class="cmn-btn-primary" :disabled="enviando" @click="dispararManual">
          <v-icon :icon="enviando ? 'mdi-loading mdi-spin' : 'mdi-send'" size="16" />
          {{ enviando ? 'Enviando...' : 'Probar envío ahora' }}
        </button>
      </div>
    </div>

    <!-- INFO CARDS ────────────────────────────────────────────────── -->
    <div class="cmn-stats">
      <div class="cmn-stat">
        <div class="cmn-stat-label">Total ejecuciones</div>
        <div class="cmn-stat-value">{{ totalLogs }}</div>
      </div>
      <div class="cmn-stat cmn-stat--ok">
        <div class="cmn-stat-label">Exitosas</div>
        <div class="cmn-stat-value">{{ countSuccess }}</div>
      </div>
      <div class="cmn-stat cmn-stat--err">
        <div class="cmn-stat-label">Con error</div>
        <div class="cmn-stat-value">{{ countError }}</div>
      </div>
      <div class="cmn-stat cmn-stat--empty">
        <div class="cmn-stat-label">Sin citas</div>
        <div class="cmn-stat-value">{{ countEmpty }}</div>
      </div>
    </div>

    <!-- ALERTA ENVÍO RECIENTE ─────────────────────────────────────── -->
    <div v-if="ultimoEnvio" class="cmn-alert" :class="`cmn-alert--${ultimoEnvio.status}`">
      <v-icon :icon="alertaIcon" size="20" />
      <div style="flex:1;">
        <div style="font-weight:600;">{{ alertaTitulo }}</div>
        <div style="font-size:0.78rem; opacity:0.85;">
          {{ ultimoEnvio.citas_count }} cita(s) para mañana
          ({{ ultimoEnvio.citas_dashboard_count }} dashboard ·
          {{ ultimoEnvio.citas_gcal_count }} gcal ·
          {{ ultimoEnvio.duplicados_fusionados }} fusionadas)
          · {{ ultimoEnvio.duracion_ms }}ms
          <span v-if="ultimoEnvio.error_message"> · <strong>{{ ultimoEnvio.error_message }}</strong></span>
        </div>
      </div>
    </div>

    <!-- FILTROS ──────────────────────────────────────────────────── -->
    <div class="cmn-filters">
      <button
        v-for="f in filtros" :key="f.value"
        class="cmn-chip" :class="{ 'cmn-chip--active': filtroStatus === f.value }"
        @click="setFiltro(f.value)"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- TABLA DE LOGS ─────────────────────────────────────────────── -->
    <div class="cmn-table-wrap">
      <table class="cmn-table">
        <thead>
          <tr>
            <th style="width: 38px;"></th>
            <th>Fecha envío (Lima)</th>
            <th>Día cubierto</th>
            <th>Status</th>
            <th>Origen</th>
            <th style="text-align:right;">Citas</th>
            <th style="text-align:right;">Duración</th>
            <th>HTTP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" style="text-align:center; padding:2rem; color:var(--muted-foreground);">
              Cargando logs...
            </td>
          </tr>
          <tr v-else-if="logs.length === 0">
            <td colspan="8" style="text-align:center; padding:2rem; color:var(--muted-foreground);">
              No hay ejecuciones registradas todavía. Hacé click en "Probar envío ahora" para generar el primer log.
            </td>
          </tr>
          <template v-else v-for="log in logs" :key="log.id">
            <tr class="cmn-row" @click="toggleExpand(log.id)">
              <td>
                <v-icon :icon="expandidos[log.id] ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="16" />
              </td>
              <td>
                <div style="font-weight:500;">{{ formatFechaLima(log.created_at) }}</div>
                <div style="font-size:0.7rem; color:var(--muted-foreground);">{{ tiempoRelativo(log.created_at) }}</div>
              </td>
              <td>{{ log.fecha_objetivo }}</td>
              <td>
                <span class="cmn-badge" :class="`cmn-badge--${log.status}`">
                  {{ statusLabel(log.status) }}
                </span>
              </td>
              <td>
                <span class="cmn-tag">{{ log.origen }}</span>
                <div v-if="log.triggered_by_email" style="font-size:0.68rem; color:var(--muted-foreground); margin-top:2px;">
                  {{ log.triggered_by_email }}
                </div>
              </td>
              <td style="text-align:right; font-variant-numeric: tabular-nums;">
                <strong>{{ log.citas_count }}</strong>
                <div style="font-size:0.68rem; color:var(--muted-foreground);">
                  {{ log.citas_dashboard_count }} · {{ log.citas_gcal_count }} · {{ log.duplicados_fusionados }}fus
                </div>
              </td>
              <td style="text-align:right; font-variant-numeric: tabular-nums;">{{ log.duracion_ms }}ms</td>
              <td>
                <span v-if="log.http_status" :class="httpClass(log.http_status)">{{ log.http_status }}</span>
                <span v-else style="color:var(--muted-foreground);">—</span>
              </td>
            </tr>
            <tr v-if="expandidos[log.id]" class="cmn-row-expand">
              <td colspan="8">
                <!-- Preview del mensaje WhatsApp -->
                <div v-if="log.payload_enviado?.mensaje_whatsapp" class="cmn-wpp-preview">
                  <div class="cmn-expand-header"><span>💬 Mensaje WhatsApp</span></div>
                  <pre class="cmn-wpp-text">{{ log.payload_enviado.mensaje_whatsapp }}</pre>
                </div>
                <div class="cmn-expand-grid">
                  <div class="cmn-expand-card">
                    <div class="cmn-expand-header">
                      <span>📦 Payload enviado a n8n</span>
                      <button class="cmn-btn-mini" @click="copiar(log.payload_enviado)">
                        <v-icon icon="mdi-content-copy" size="14" /> Copiar
                      </button>
                    </div>
                    <pre class="cmn-json">{{ formatJSON(log.payload_enviado) }}</pre>
                  </div>
                  <div class="cmn-expand-card">
                    <div class="cmn-expand-header">
                      <span>📥 Respuesta de n8n</span>
                      <span v-if="log.http_status" :class="httpClass(log.http_status)" style="font-size:0.72rem;">
                        HTTP {{ log.http_status }}
                      </span>
                    </div>
                    <pre class="cmn-json">{{ log.respuesta_n8n != null ? formatJSON(log.respuesta_n8n) : '(sin respuesta)' }}</pre>
                    <div v-if="log.error_message" class="cmn-err-box">
                      <strong>⚠ Error:</strong> {{ log.error_message }}
                    </div>
                    <div v-if="log.webhook_url" style="font-size:0.7rem; color:var(--muted-foreground); margin-top:0.5rem; word-break:break-all;">
                      <strong>Webhook:</strong> {{ log.webhook_url }}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- PAGINACIÓN ────────────────────────────────────────────────── -->
    <div v-if="totalLogs > limit" class="cmn-pagination">
      <button class="cmn-btn-secondary" :disabled="offset === 0" @click="prevPage">‹ Anterior</button>
      <span style="font-size:0.82rem; color:var(--muted-foreground);">
        {{ offset + 1 }}–{{ Math.min(offset + limit, totalLogs) }} de {{ totalLogs }}
      </span>
      <button class="cmn-btn-secondary" :disabled="offset + limit >= totalLogs" @click="nextPage">Siguiente ›</button>
    </div>

    <!-- INFO TÉCNICA AL FINAL ─────────────────────────────────────── -->
    <details class="cmn-info">
      <summary>ℹ Detalles técnicos</summary>
      <div style="padding:0.75rem 0.25rem; font-size:0.82rem; line-height:1.6;">
        <p><strong>Endpoint del dashboard:</strong> <code>GET /api/healup/cron-citas-manana</code></p>
        <p><strong>Disparador automático:</strong> Netlify Scheduled Function <code>netlify/functions/cron-healup-citas-manana.mts</code></p>
        <p><strong>Schedule:</strong> <code>0 0 * * *</code> (00:00 UTC = 19:00 Lima — todos los días)</p>
        <p><strong>Fuentes:</strong> healup_calendar_events (dashboard) + Google Calendar API</p>
        <p><strong>Filtro:</strong> citas cuya fecha de agendamiento es <code>mañana</code> (día Lima + 1)</p>
        <p><strong>Dedup:</strong> misma franja horaria + (mismo DNI / teléfono / nombre normalizado); gana el nombre más largo</p>
        <p><strong>Variables de entorno requeridas en Netlify:</strong></p>
        <ul style="margin-left:1.25rem;">
          <li><code>N8N_WEBHOOK_HEALUP_CITAS_MANANA</code> — URL del webhook n8n destinatario</li>
          <li><code>HEALUP_AGENDAMIENTO_CRON_KEY</code> — clave compartida para autenticar el cron</li>
          <li><code>GOOGLE_SERVICE_ACCOUNT_JSON</code> / <code>GOOGLE_CALENDAR_ID_HEALUP</code> — acceso a Google Calendar</li>
        </ul>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface LogRow {
  id: number
  created_at: string
  fecha_objetivo: string
  origen: 'cron' | 'manual'
  triggered_by_email: string | null
  status: 'success' | 'error' | 'empty' | 'pending'
  citas_count: number
  citas_dashboard_count: number
  citas_gcal_count: number
  duplicados_fusionados: number
  webhook_url: string | null
  payload_enviado: any
  respuesta_n8n: any
  http_status: number | null
  error_message: string | null
  duracion_ms: number
}

const logs = ref<LogRow[]>([])
const totalLogs = ref(0)
const limit = ref(25)
const offset = ref(0)
const filtroStatus = ref<string | null>(null)
const loading = ref(false)
const enviando = ref(false)
const expandidos = ref<Record<number, boolean>>({})
const ultimoEnvio = ref<{
  status: string
  citas_count: number
  citas_dashboard_count: number
  citas_gcal_count: number
  duplicados_fusionados: number
  duracion_ms: number
  error_message: string | null
} | null>(null)

const filtros = [
  { value: null as any, label: 'Todos' },
  { value: 'success', label: '✓ Exitosos' },
  { value: 'error', label: '✗ Con error' },
  { value: 'empty', label: '○ Sin citas' }
]

const countSuccess = computed(() => logs.value.filter(l => l.status === 'success').length)
const countError = computed(() => logs.value.filter(l => l.status === 'error').length)
const countEmpty = computed(() => logs.value.filter(l => l.status === 'empty').length)

const alertaIcon = computed(() => {
  if (!ultimoEnvio.value) return 'mdi-information'
  if (ultimoEnvio.value.status === 'success') return 'mdi-check-circle'
  if (ultimoEnvio.value.status === 'error') return 'mdi-alert-circle'
  return 'mdi-information'
})

const alertaTitulo = computed(() => {
  if (!ultimoEnvio.value) return ''
  if (ultimoEnvio.value.status === 'success') return '✅ Envío manual exitoso'
  if (ultimoEnvio.value.status === 'error') return '❌ Error en el envío manual'
  if (ultimoEnvio.value.status === 'empty') return 'ℹ Envío realizado sin citas para mañana'
  return ''
})

function setFiltro(val: string | null) {
  filtroStatus.value = val
  offset.value = 0
  cargarLogs()
}

function toggleExpand(id: number) {
  expandidos.value[id] = !expandidos.value[id]
}

function statusLabel(s: string): string {
  switch (s) {
    case 'success': return '✓ Éxito'
    case 'error':   return '✗ Error'
    case 'empty':   return '○ Vacío'
    case 'pending': return '⋯ Pendiente'
    default:        return s
  }
}

function httpClass(code: number): string {
  if (code >= 200 && code < 300) return 'cmn-http cmn-http--ok'
  if (code >= 400) return 'cmn-http cmn-http--err'
  return 'cmn-http'
}

function formatFechaLima(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function tiempoRelativo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `hace ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function formatJSON(obj: any): string {
  try { return JSON.stringify(obj, null, 2) } catch { return String(obj) }
}

async function copiar(obj: any) {
  try {
    await navigator.clipboard.writeText(formatJSON(obj))
    alert('Payload copiado al portapapeles')
  } catch {
    alert('No se pudo copiar')
  }
}

async function cargarLogs() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: String(limit.value),
      offset: String(offset.value)
    })
    if (filtroStatus.value) params.set('status', filtroStatus.value)
    const resp: any = await $fetch(`/api/healup/citas-manana-logs?${params.toString()}`)
    logs.value = resp.logs || []
    totalLogs.value = resp.total || 0
  } catch (e: any) {
    console.error('Error cargando logs:', e)
    alert('Error al cargar los logs: ' + (e?.data?.statusMessage || e?.message || 'desconocido'))
  } finally {
    loading.value = false
  }
}

async function dispararManual() {
  if (!confirm('¿Disparar el resumen de citas de mañana ahora? Esto va a consultar el dashboard + Google Calendar y enviar el JSON al webhook n8n inmediatamente.')) {
    return
  }
  enviando.value = true
  ultimoEnvio.value = null
  try {
    const resp: any = await $fetch('/api/healup/citas-manana-trigger', { method: 'POST' })
    ultimoEnvio.value = {
      status: resp.status,
      citas_count: resp.citas_count,
      citas_dashboard_count: resp.citas_dashboard_count,
      citas_gcal_count: resp.citas_gcal_count,
      duplicados_fusionados: resp.duplicados_fusionados,
      duracion_ms: resp.duracion_ms,
      error_message: resp.error_message
    }
    await cargarLogs()
    if (resp.log_id) expandidos.value[resp.log_id] = true
  } catch (e: any) {
    console.error('Error disparando envío manual:', e)
    ultimoEnvio.value = {
      status: 'error',
      citas_count: 0,
      citas_dashboard_count: 0,
      citas_gcal_count: 0,
      duplicados_fusionados: 0,
      duracion_ms: 0,
      error_message: e?.data?.statusMessage || e?.message || 'Error desconocido'
    }
  } finally {
    enviando.value = false
  }
}

function nextPage() {
  if (offset.value + limit.value < totalLogs.value) {
    offset.value += limit.value
    cargarLogs()
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit.value)
    cargarLogs()
  }
}

onMounted(cargarLogs)
</script>

<style scoped>
.cmn-panel { padding: 1.5rem; max-width: 1280px; margin: 0 auto; }

.cmn-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
}
.cmn-title { font-size: 1.35rem; font-weight: 700; margin: 0; color: var(--foreground); }
.cmn-subtitle {
  font-size: 0.82rem; color: var(--muted-foreground);
  margin: 0.35rem 0 0; max-width: 760px; line-height: 1.5;
}

.cmn-btn-primary, .cmn-btn-secondary, .cmn-btn-mini {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem;
  border: 1px solid transparent; cursor: pointer; transition: all 0.15s;
}
.cmn-btn-primary { background: linear-gradient(135deg, #daa520, #b8860b); color: #fff; }
.cmn-btn-primary:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
.cmn-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.cmn-btn-secondary { background: var(--card); color: var(--foreground); border-color: var(--border); }
.cmn-btn-secondary:hover:not(:disabled) { background: var(--muted, #f5f5f5); }
.cmn-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.cmn-btn-mini {
  padding: 0.25rem 0.55rem; font-size: 0.72rem;
  background: var(--card); border-color: var(--border); color: var(--foreground);
}

.cmn-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
.cmn-stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; }
.cmn-stat-label {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted-foreground); margin-bottom: 0.25rem;
}
.cmn-stat-value { font-size: 1.4rem; font-weight: 700; color: var(--foreground); font-variant-numeric: tabular-nums; }
.cmn-stat--ok .cmn-stat-value { color: #16a34a; }
.cmn-stat--err .cmn-stat-value { color: #dc2626; }
.cmn-stat--empty .cmn-stat-value { color: #6b7280; }

.cmn-alert {
  display: flex; gap: 0.75rem; align-items: flex-start;
  padding: 0.85rem 1rem; border-radius: 10px; margin-bottom: 1.25rem; border: 1px solid;
}
.cmn-alert--success { background: #f0fdf4; border-color: #86efac; color: #166534; }
.cmn-alert--error   { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.cmn-alert--empty   { background: #f9fafb; border-color: #d1d5db; color: #374151; }

.cmn-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.cmn-chip {
  padding: 0.35rem 0.85rem; font-size: 0.78rem; border-radius: 999px;
  background: var(--card); border: 1px solid var(--border); color: var(--muted-foreground);
  cursor: pointer; transition: all 0.15s;
}
.cmn-chip:hover { color: var(--foreground); }
.cmn-chip--active { background: var(--foreground); color: var(--background, #fff); border-color: var(--foreground); }

.cmn-table-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.cmn-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.cmn-table th {
  text-align: left; padding: 0.65rem 0.75rem; font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--muted-foreground); background: rgba(0,0,0,0.025);
  border-bottom: 1px solid var(--border); font-weight: 600;
}
.cmn-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.cmn-row { cursor: pointer; transition: background 0.1s; }
.cmn-row:hover { background: rgba(218,165,32,0.05); }
.cmn-row-expand td { background: rgba(0,0,0,0.02); padding: 1rem; border-bottom: 1px solid var(--border); }

.cmn-badge { display: inline-block; padding: 0.15rem 0.55rem; font-size: 0.7rem; font-weight: 600; border-radius: 999px; }
.cmn-badge--success { background: #dcfce7; color: #166534; }
.cmn-badge--error   { background: #fee2e2; color: #991b1b; }
.cmn-badge--empty   { background: #f3f4f6; color: #4b5563; }
.cmn-badge--pending { background: #fef3c7; color: #92400e; }

.cmn-tag {
  display: inline-block; font-size: 0.68rem; padding: 0.1rem 0.4rem;
  background: rgba(0,0,0,0.04); border-radius: 4px; color: var(--muted-foreground);
  text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
}

.cmn-http { display: inline-block; padding: 0.1rem 0.45rem; font-size: 0.72rem; border-radius: 4px; font-variant-numeric: tabular-nums; font-weight: 600; }
.cmn-http--ok  { background: #dcfce7; color: #166534; }
.cmn-http--err { background: #fee2e2; color: #991b1b; }

.cmn-wpp-preview {
  background: #075e54; border-radius: 8px; padding: 0.65rem; margin-bottom: 0.75rem;
}
.cmn-wpp-preview .cmn-expand-header { color: #d1fae5; }
.cmn-wpp-text {
  background: #dcf8c6; color: #111; padding: 0.75rem; border-radius: 6px;
  font-size: 0.8rem; line-height: 1.45; white-space: pre-wrap; margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif; max-height: 360px; overflow: auto;
}

.cmn-expand-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
@media (max-width: 900px) {
  .cmn-expand-grid { grid-template-columns: 1fr; }
  .cmn-stats { grid-template-columns: repeat(2, 1fr); }
}
.cmn-expand-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; }
.cmn-expand-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.4rem; font-size: 0.78rem; font-weight: 600; color: var(--foreground);
}
.cmn-json {
  background: #0f172a; color: #e2e8f0; padding: 0.65rem; border-radius: 6px;
  font-size: 0.72rem; line-height: 1.4; max-height: 420px; overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 0; white-space: pre;
}
.cmn-err-box {
  margin-top: 0.5rem; padding: 0.5rem 0.65rem; background: #fef2f2; color: #991b1b;
  border-radius: 6px; font-size: 0.78rem;
}

.cmn-pagination { display: flex; align-items: center; justify-content: center; gap: 0.85rem; margin-top: 1rem; }

.cmn-info {
  margin-top: 1.5rem; background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.85rem;
}
.cmn-info summary { cursor: pointer; font-weight: 600; color: var(--foreground); }
.cmn-info code { background: rgba(0,0,0,0.06); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem; }
</style>
