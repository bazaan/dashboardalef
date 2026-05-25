<template>
  <div class="agd-panel">
    <!-- HEADER ────────────────────────────────────────────────────── -->
    <div class="agd-header">
      <div>
        <h2 class="agd-title">📤 Envío Diario WhatsApp — Pacientes Agendados</h2>
        <p class="agd-subtitle">
          Todos los días a las <strong>19:00 hora Lima</strong> el sistema envía a n8n el JSON
          de todos los pacientes agendados ese día (canales: WhatsApp, Facebook/Instagram, TikTok).
          n8n recibe los datos y dispara el WhatsApp a la gerente.
        </p>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button class="agd-btn-secondary" :disabled="loading" @click="cargarLogs">
          <v-icon icon="mdi-refresh" size="16" /> Refrescar
        </button>
        <button class="agd-btn-primary" :disabled="enviando" @click="dispararManual">
          <v-icon :icon="enviando ? 'mdi-loading mdi-spin' : 'mdi-send'" size="16" />
          {{ enviando ? 'Enviando...' : 'Probar envío ahora' }}
        </button>
      </div>
    </div>

    <!-- INFO CARDS ────────────────────────────────────────────────── -->
    <div class="agd-stats">
      <div class="agd-stat">
        <div class="agd-stat-label">Total ejecuciones</div>
        <div class="agd-stat-value">{{ totalLogs }}</div>
      </div>
      <div class="agd-stat agd-stat--ok">
        <div class="agd-stat-label">Exitosas</div>
        <div class="agd-stat-value">{{ countSuccess }}</div>
      </div>
      <div class="agd-stat agd-stat--err">
        <div class="agd-stat-label">Con error</div>
        <div class="agd-stat-value">{{ countError }}</div>
      </div>
      <div class="agd-stat agd-stat--empty">
        <div class="agd-stat-label">Sin pacientes</div>
        <div class="agd-stat-value">{{ countEmpty }}</div>
      </div>
    </div>

    <!-- ALERTA ENVÍO RECIENTE ─────────────────────────────────────── -->
    <div v-if="ultimoEnvio" class="agd-alert" :class="`agd-alert--${ultimoEnvio.status}`">
      <v-icon :icon="alertaIcon" size="20" />
      <div style="flex:1;">
        <div style="font-weight:600;">{{ alertaTitulo }}</div>
        <div style="font-size:0.78rem; opacity:0.85;">
          {{ ultimoEnvio.pacientes_count }} paciente(s)
          ({{ ultimoEnvio.pacientes_wpp_count }} wpp ·
          {{ ultimoEnvio.pacientes_fbig_count }} fb/ig ·
          {{ ultimoEnvio.pacientes_tiktok_count }} tk)
          · {{ ultimoEnvio.duracion_ms }}ms
          <span v-if="ultimoEnvio.error_message"> · <strong>{{ ultimoEnvio.error_message }}</strong></span>
        </div>
      </div>
    </div>

    <!-- FILTROS ──────────────────────────────────────────────────── -->
    <div class="agd-filters">
      <button
        v-for="f in filtros" :key="f.value"
        class="agd-chip" :class="{ 'agd-chip--active': filtroStatus === f.value }"
        @click="setFiltro(f.value)"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- TABLA DE LOGS ─────────────────────────────────────────────── -->
    <div class="agd-table-wrap">
      <table class="agd-table">
        <thead>
          <tr>
            <th style="width: 38px;"></th>
            <th>Fecha envío (Lima)</th>
            <th>Día cubierto</th>
            <th>Status</th>
            <th>Origen</th>
            <th style="text-align:right;">Pacientes</th>
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
            <tr class="agd-row" @click="toggleExpand(log.id)">
              <td>
                <v-icon :icon="expandidos[log.id] ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="16" />
              </td>
              <td>
                <div style="font-weight:500;">{{ formatFechaLima(log.created_at) }}</div>
                <div style="font-size:0.7rem; color:var(--muted-foreground);">{{ tiempoRelativo(log.created_at) }}</div>
              </td>
              <td>{{ log.fecha_lima }}</td>
              <td>
                <span class="agd-badge" :class="`agd-badge--${log.status}`">
                  {{ statusLabel(log.status) }}
                </span>
              </td>
              <td>
                <span class="agd-tag">{{ log.origen }}</span>
                <div v-if="log.triggered_by_email" style="font-size:0.68rem; color:var(--muted-foreground); margin-top:2px;">
                  {{ log.triggered_by_email }}
                </div>
              </td>
              <td style="text-align:right; font-variant-numeric: tabular-nums;">
                <strong>{{ log.pacientes_count }}</strong>
                <div style="font-size:0.68rem; color:var(--muted-foreground);">
                  {{ log.pacientes_wpp_count }} · {{ log.pacientes_fbig_count }} · {{ log.pacientes_tiktok_count }}
                </div>
              </td>
              <td style="text-align:right; font-variant-numeric: tabular-nums;">{{ log.duracion_ms }}ms</td>
              <td>
                <span v-if="log.http_status" :class="httpClass(log.http_status)">{{ log.http_status }}</span>
                <span v-else style="color:var(--muted-foreground);">—</span>
              </td>
            </tr>
            <tr v-if="expandidos[log.id]" class="agd-row-expand">
              <td colspan="8">
                <div class="agd-expand-grid">
                  <div class="agd-expand-card">
                    <div class="agd-expand-header">
                      <span>📦 Payload enviado a n8n</span>
                      <button class="agd-btn-mini" @click="copiar(log.payload_enviado)">
                        <v-icon icon="mdi-content-copy" size="14" /> Copiar
                      </button>
                    </div>
                    <pre class="agd-json">{{ formatJSON(log.payload_enviado) }}</pre>
                  </div>
                  <div class="agd-expand-card">
                    <div class="agd-expand-header">
                      <span>📥 Respuesta de n8n</span>
                      <span v-if="log.http_status" :class="httpClass(log.http_status)" style="font-size:0.72rem;">
                        HTTP {{ log.http_status }}
                      </span>
                    </div>
                    <pre class="agd-json">{{ log.respuesta_n8n != null ? formatJSON(log.respuesta_n8n) : '(sin respuesta)' }}</pre>
                    <div v-if="log.error_message" class="agd-err-box">
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
    <div v-if="totalLogs > limit" class="agd-pagination">
      <button class="agd-btn-secondary" :disabled="offset === 0" @click="prevPage">‹ Anterior</button>
      <span style="font-size:0.82rem; color:var(--muted-foreground);">
        {{ offset + 1 }}–{{ Math.min(offset + limit, totalLogs) }} de {{ totalLogs }}
      </span>
      <button class="agd-btn-secondary" :disabled="offset + limit >= totalLogs" @click="nextPage">Siguiente ›</button>
    </div>

    <!-- INFO TÉCNICA AL FINAL ─────────────────────────────────────── -->
    <details class="agd-info">
      <summary>ℹ Detalles técnicos</summary>
      <div style="padding:0.75rem 0.25rem; font-size:0.82rem; line-height:1.6;">
        <p><strong>Endpoint del dashboard:</strong> <code>GET /api/healup/cron-agendamientos-diarios</code></p>
        <p><strong>Disparador automático:</strong> Netlify Scheduled Function <code>netlify/functions/cron-healup-agendamientos.mts</code></p>
        <p><strong>Schedule:</strong> <code>0 0 * * *</code> (00:00 UTC = 19:00 Lima — todos los días)</p>
        <p><strong>Tablas consultadas:</strong> PacientesBDwppHEALUP, PacientesBDfbigHEALUP, PacientesBDtiktokHEALUP</p>
        <p><strong>Filtro:</strong> <code>created_at &gt;= 00:00 Lima del día actual</code></p>
        <p><strong>Variables de entorno requeridas en Netlify:</strong></p>
        <ul style="margin-left:1.25rem;">
          <li><code>N8N_WEBHOOK_HEALUP_AGENDAMIENTO_DIARIO</code> — URL del webhook n8n destinatario</li>
          <li><code>HEALUP_AGENDAMIENTO_CRON_KEY</code> — clave compartida (string largo aleatorio) para autenticar el cron</li>
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
  fecha_lima: string
  origen: 'cron' | 'manual'
  triggered_by_email: string | null
  status: 'success' | 'error' | 'empty' | 'pending'
  pacientes_count: number
  pacientes_wpp_count: number
  pacientes_fbig_count: number
  pacientes_tiktok_count: number
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
  pacientes_count: number
  pacientes_wpp_count: number
  pacientes_fbig_count: number
  pacientes_tiktok_count: number
  duracion_ms: number
  error_message: string | null
} | null>(null)

const filtros = [
  { value: null as any, label: 'Todos' },
  { value: 'success', label: '✓ Exitosos' },
  { value: 'error', label: '✗ Con error' },
  { value: 'empty', label: '○ Sin pacientes' }
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
  if (ultimoEnvio.value.status === 'empty') return 'ℹ Envío realizado sin pacientes agendados hoy'
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
  if (code >= 200 && code < 300) return 'agd-http agd-http--ok'
  if (code >= 400) return 'agd-http agd-http--err'
  return 'agd-http'
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
    const resp: any = await $fetch(`/api/healup/agendamientos-diarios-logs?${params.toString()}`)
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
  if (!confirm('¿Disparar el envío diario ahora? Esto va a consultar los pacientes agendados hoy y enviar el JSON al webhook n8n inmediatamente.')) {
    return
  }
  enviando.value = true
  ultimoEnvio.value = null
  try {
    const resp: any = await $fetch('/api/healup/agendamientos-diarios-trigger', {
      method: 'POST'
    })
    ultimoEnvio.value = {
      status: resp.status,
      pacientes_count: resp.pacientes_count,
      pacientes_wpp_count: resp.pacientes_wpp_count,
      pacientes_fbig_count: resp.pacientes_fbig_count,
      pacientes_tiktok_count: resp.pacientes_tiktok_count,
      duracion_ms: resp.duracion_ms,
      error_message: resp.error_message
    }
    // Recargar logs y auto-expandir el más reciente.
    await cargarLogs()
    if (resp.log_id) expandidos.value[resp.log_id] = true
  } catch (e: any) {
    console.error('Error disparando envío manual:', e)
    ultimoEnvio.value = {
      status: 'error',
      pacientes_count: 0,
      pacientes_wpp_count: 0,
      pacientes_fbig_count: 0,
      pacientes_tiktok_count: 0,
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
.agd-panel {
  padding: 1.5rem;
  max-width: 1280px;
  margin: 0 auto;
}

.agd-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.agd-title {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0;
  color: var(--foreground);
}

.agd-subtitle {
  font-size: 0.82rem;
  color: var(--muted-foreground);
  margin: 0.35rem 0 0;
  max-width: 720px;
  line-height: 1.5;
}

.agd-btn-primary,
.agd-btn-secondary,
.agd-btn-mini {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.agd-btn-primary {
  background: linear-gradient(135deg, #daa520, #b8860b);
  color: #fff;
}
.agd-btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
}
.agd-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.agd-btn-secondary {
  background: var(--card);
  color: var(--foreground);
  border-color: var(--border);
}
.agd-btn-secondary:hover:not(:disabled) {
  background: var(--muted, #f5f5f5);
}
.agd-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.agd-btn-mini {
  padding: 0.25rem 0.55rem;
  font-size: 0.72rem;
  background: var(--card);
  border-color: var(--border);
  color: var(--foreground);
}

/* STATS */
.agd-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.agd-stat {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
}
.agd-stat-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
  margin-bottom: 0.25rem;
}
.agd-stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}
.agd-stat--ok .agd-stat-value { color: #16a34a; }
.agd-stat--err .agd-stat-value { color: #dc2626; }
.agd-stat--empty .agd-stat-value { color: #6b7280; }

/* ALERT */
.agd-alert {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  margin-bottom: 1.25rem;
  border: 1px solid;
}
.agd-alert--success { background: #f0fdf4; border-color: #86efac; color: #166534; }
.agd-alert--error   { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.agd-alert--empty   { background: #f9fafb; border-color: #d1d5db; color: #374151; }

/* FILTROS */
.agd-filters {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.agd-chip {
  padding: 0.35rem 0.85rem;
  font-size: 0.78rem;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s;
}
.agd-chip:hover { color: var(--foreground); }
.agd-chip--active {
  background: var(--foreground);
  color: var(--background, #fff);
  border-color: var(--foreground);
}

/* TABLA */
.agd-table-wrap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.agd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.agd-table th {
  text-align: left;
  padding: 0.65rem 0.75rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-foreground);
  background: rgba(0,0,0,0.025);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}
.agd-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.agd-row { cursor: pointer; transition: background 0.1s; }
.agd-row:hover { background: rgba(218,165,32,0.05); }

.agd-row-expand td {
  background: rgba(0,0,0,0.02);
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.agd-badge {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 999px;
}
.agd-badge--success { background: #dcfce7; color: #166534; }
.agd-badge--error   { background: #fee2e2; color: #991b1b; }
.agd-badge--empty   { background: #f3f4f6; color: #4b5563; }
.agd-badge--pending { background: #fef3c7; color: #92400e; }

.agd-tag {
  display: inline-block;
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  background: rgba(0,0,0,0.04);
  border-radius: 4px;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.agd-http {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.agd-http--ok  { background: #dcfce7; color: #166534; }
.agd-http--err { background: #fee2e2; color: #991b1b; }

/* EXPAND */
.agd-expand-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
@media (max-width: 900px) {
  .agd-expand-grid { grid-template-columns: 1fr; }
  .agd-stats { grid-template-columns: repeat(2, 1fr); }
}
.agd-expand-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.65rem;
}
.agd-expand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--foreground);
}
.agd-json {
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.65rem;
  border-radius: 6px;
  font-size: 0.72rem;
  line-height: 1.4;
  max-height: 420px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin: 0;
  white-space: pre;
}
.agd-err-box {
  margin-top: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 6px;
  font-size: 0.78rem;
}

/* PAGINACIÓN */
.agd-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  margin-top: 1rem;
}

/* INFO */
.agd-info {
  margin-top: 1.5rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
}
.agd-info summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--foreground);
}
.agd-info code {
  background: rgba(0,0,0,0.06);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.78rem;
}
</style>
