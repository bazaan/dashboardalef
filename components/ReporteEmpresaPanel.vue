<template>
  <div class="rep-panel">

    <!-- HEADER -->
    <div class="rep-header">
      <div>
        <h2 class="rep-title">Reporte Diario</h2>
        <p class="rep-subtitle">{{ empresaNombre }} · {{ fechaHoy }}</p>
      </div>
      <button class="rep-btn-primary" @click="abrirForm">
        {{ reporteHoy ? '✏ Editar Reporte' : '+ Enviar Reporte de Hoy' }}
      </button>
    </div>

    <!-- REPORTE DE HOY -->
    <div v-if="reporteHoy" class="rep-card rep-card--hoy">
      <div class="rep-card-header">
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <div class="rep-dot rep-dot--green"></div>
          <span style="font-size:0.78rem;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;">Enviado hoy</span>
        </div>
        <span style="font-size:0.75rem;color:var(--muted-foreground);">por {{ reporteHoy.autor }}</span>
      </div>
      <div class="rep-section">
        <div class="rep-section-label">Resumen del día</div>
        <p class="rep-text">{{ reporteHoy.resumen }}</p>
      </div>
      <div v-if="reporteHoy.logros" class="rep-section">
        <div class="rep-section-label">Logros / Avances</div>
        <p class="rep-text">{{ reporteHoy.logros }}</p>
      </div>
      <div v-if="reporteHoy.pendientes" class="rep-section">
        <div class="rep-section-label">Pendientes para mañana</div>
        <p class="rep-text">{{ reporteHoy.pendientes }}</p>
      </div>
      <div v-if="reporteHoy.blockers" class="rep-section">
        <div class="rep-section-label" style="color:#ef4444;">⚠ Blockers / Impedimentos</div>
        <p class="rep-text" style="color:#ef4444;">{{ reporteHoy.blockers }}</p>
      </div>
    </div>

    <div v-else class="rep-empty">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">📋</div>
      <p style="color:var(--muted-foreground);margin:0 0 1rem;">No se ha enviado reporte hoy todavía.</p>
      <button class="rep-btn-primary" @click="abrirForm">Enviar reporte de hoy</button>
    </div>

    <!-- HISTÓRICO -->
    <div v-if="reportesAnteriores.length > 0" style="margin-top:2rem;">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--foreground);margin-bottom:0.75rem;">Reportes Anteriores</h3>
      <div style="display:flex;flex-direction:column;gap:0.6rem;">
        <div v-for="r in reportesAnteriores" :key="r.id" class="rep-card rep-card--hist" @click="verDetalle(r)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
            <span style="font-size:0.8rem;font-weight:600;color:var(--foreground);">{{ formatFecha(r.fecha) }}</span>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span v-if="r.blockers" style="font-size:0.68rem;background:#fef2f2;color:#dc2626;padding:2px 7px;border-radius:10px;">⚠ blocker</span>
              <span style="font-size:0.72rem;color:var(--muted-foreground);">por {{ r.autor }}</span>
            </div>
          </div>
          <p style="margin:0;font-size:0.82rem;color:var(--muted-foreground);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{{ r.resumen }}</p>
        </div>
      </div>
    </div>

    <!-- DIALOG: FORM REPORTE -->
    <v-dialog v-model="showForm" max-width="540" persistent>
      <v-card style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
        <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0.25rem;">
          Reporte Diario — {{ empresaNombre }}
          <div style="font-size:0.72rem;font-weight:400;color:var(--muted-foreground);margin-top:2px;">{{ fechaHoy }}</div>
        </v-card-title>
        <v-card-text style="padding:1rem 1.5rem;">
          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            <div>
              <label class="form-label">Tu nombre <span style="color:#ef4444;">*</span></label>
              <v-text-field v-model="form.autor" density="compact" variant="outlined" hide-details :placeholder="currentUser || 'Tu nombre'" />
            </div>
            <div>
              <label class="form-label">Resumen del día <span style="color:#ef4444;">*</span></label>
              <v-textarea v-model="form.resumen" density="compact" variant="outlined" hide-details rows="3"
                placeholder="¿Qué pasó hoy en la empresa? Actividades principales, atenciones, operaciones..." />
            </div>
            <div>
              <label class="form-label">Logros / Avances</label>
              <v-textarea v-model="form.logros" density="compact" variant="outlined" hide-details rows="2"
                placeholder="Metas alcanzadas, objetivos completados..." />
            </div>
            <div>
              <label class="form-label">Pendientes para mañana</label>
              <v-textarea v-model="form.pendientes" density="compact" variant="outlined" hide-details rows="2"
                placeholder="Tareas que quedan por completar..." />
            </div>
            <div>
              <label class="form-label">Blockers / Necesito ayuda con...</label>
              <v-textarea v-model="form.blockers" density="compact" variant="outlined" hide-details rows="2"
                placeholder="Algo que bloquea el avance o necesitas que Alef resuelva..." />
            </div>
          </div>
        </v-card-text>
        <v-card-actions style="padding:0.75rem 1.5rem 1.25rem;gap:0.5rem;justify-content:flex-end;">
          <button class="btn-secondary" @click="showForm = false">Cancelar</button>
          <button class="btn-primary" :disabled="!form.resumen || !form.autor || guardando" @click="guardar">
            {{ guardando ? 'Guardando...' : 'Enviar Reporte' }}
          </button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DIALOG: VER DETALLE -->
    <v-dialog v-model="showDetalleDlg" max-width="500">
      <v-card v-if="reporteDetalle" style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
        <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0.25rem;">
          {{ empresaNombre }} · {{ formatFecha(reporteDetalle.fecha) }}
        </v-card-title>
        <v-card-subtitle style="padding:0 1.5rem 0.75rem;font-size:0.75rem;">por {{ reporteDetalle.autor }}</v-card-subtitle>
        <v-card-text style="padding:0 1.5rem 1rem;display:flex;flex-direction:column;gap:1rem;">
          <div>
            <div class="rep-section-label">Resumen del día</div>
            <p class="rep-text">{{ reporteDetalle.resumen }}</p>
          </div>
          <div v-if="reporteDetalle.logros">
            <div class="rep-section-label">Logros</div>
            <p class="rep-text">{{ reporteDetalle.logros }}</p>
          </div>
          <div v-if="reporteDetalle.pendientes">
            <div class="rep-section-label">Pendientes</div>
            <p class="rep-text">{{ reporteDetalle.pendientes }}</p>
          </div>
          <div v-if="reporteDetalle.blockers">
            <div class="rep-section-label" style="color:#ef4444;">⚠ Blockers</div>
            <p class="rep-text" style="color:#ef4444;">{{ reporteDetalle.blockers }}</p>
          </div>
        </v-card-text>
        <v-card-actions style="padding:0.75rem 1.5rem 1.25rem;justify-content:flex-end;">
          <button class="btn-secondary" @click="showDetalleDlg = false">Cerrar</button>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  empresaId: string
  empresaNombre: string
  currentUser?: string
}>()

const supabase = useSupabaseClient()

const reportes = ref<any[]>([])
const showForm = ref(false)
const showDetalleDlg = ref(false)
const reporteDetalle = ref<any>(null)
const guardando = ref(false)

const hoyISO = new Date().toISOString().slice(0, 10)
const fechaHoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

const form = ref({ autor: props.currentUser || '', resumen: '', logros: '', pendientes: '', blockers: '' })

const reporteHoy = computed(() => reportes.value.find(r => r.fecha === hoyISO) ?? null)
const reportesAnteriores = computed(() => reportes.value.filter(r => r.fecha !== hoyISO))

async function fetchReportes() {
  const { data } = await (supabase as any)
    .from('alef_reportes_empresa')
    .select('*')
    .eq('empresa_id', props.empresaId)
    .order('fecha', { ascending: false })
    .limit(30)
  reportes.value = data || []
}

function abrirForm() {
  if (reporteHoy.value) {
    form.value = {
      autor: reporteHoy.value.autor,
      resumen: reporteHoy.value.resumen,
      logros: reporteHoy.value.logros || '',
      pendientes: reporteHoy.value.pendientes || '',
      blockers: reporteHoy.value.blockers || ''
    }
  } else {
    form.value = { autor: props.currentUser || '', resumen: '', logros: '', pendientes: '', blockers: '' }
  }
  showForm.value = true
}

async function guardar() {
  guardando.value = true
  await (supabase as any).from('alef_reportes_empresa').upsert({
    fecha: hoyISO,
    empresa_id: props.empresaId,
    empresa_nombre: props.empresaNombre,
    autor: form.value.autor.trim() || props.currentUser || 'Usuario',
    resumen: form.value.resumen.trim(),
    logros: form.value.logros.trim(),
    pendientes: form.value.pendientes.trim(),
    blockers: form.value.blockers.trim(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'fecha,empresa_id' })
  guardando.value = false
  showForm.value = false
  await fetchReportes()
}

function verDetalle(r: any) {
  reporteDetalle.value = r
  showDetalleDlg.value = true
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

onMounted(fetchReportes)
</script>

<style scoped>
.rep-panel { padding: 0; }

.rep-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.rep-title { font-size: 1.4rem; font-weight: 700; color: var(--foreground); margin: 0; }
.rep-subtitle { font-size: 0.8rem; color: var(--muted-foreground); margin: 0.2rem 0 0; text-transform: capitalize; }

.rep-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
}
.rep-card--hoy { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.08); }
.rep-card--hist { cursor: pointer; transition: border-color 0.2s; }
.rep-card--hist:hover { border-color: var(--primary); }

.rep-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.rep-dot { width: 8px; height: 8px; border-radius: 50%; }
.rep-dot--green { background: #22c55e; }

.rep-section { margin-top: 0.85rem; }
.rep-section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}
.rep-text {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--foreground);
  margin: 0;
  white-space: pre-wrap;
}

.rep-empty {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--card);
  border: 2px dashed var(--border);
  border-radius: 12px;
}

.rep-btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.rep-btn-primary:hover { opacity: 0.88; }
</style>
