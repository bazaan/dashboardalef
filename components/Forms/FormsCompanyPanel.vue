<template>
  <div class="forms-company-panel">
    <header class="panel-header">
      <div>
        <h2>Formularios</h2>
        <p class="subtitle">Formularios y respuestas de tu empresa.</p>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="fetchForms" :loading="loading">
        Actualizar
      </v-btn>
    </header>

    <div v-if="loading && !forms.length" class="empty-state">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="!forms.length" class="empty-state">
      <v-icon icon="mdi-form-textbox" size="48" color="grey" />
      <p>Tu empresa aún no tiene formularios creados.</p>
      <p class="hint">El equipo de Alef puede crearlos desde el dashboard de superadmin.</p>
    </div>

    <div v-else class="forms-grid">
      <div
        v-for="form in forms" :key="form.id"
        class="form-card"
        :class="{ inactive: !form.active }"
        @click="openResponses(form)"
      >
        <div class="form-card-header">
          <h3>{{ form.title }}</h3>
          <v-chip :color="form.active ? 'success' : 'error'" size="x-small">
            {{ form.active ? 'Activo' : 'Pausado' }}
          </v-chip>
        </div>
        <p v-if="form.description" class="form-desc">{{ form.description }}</p>
        <div class="form-card-footer">
          <span class="meta-item">
            <v-icon icon="mdi-calendar" size="14" />
            Creado: {{ new Date(form.created_at).toLocaleDateString('es-PE') }}
          </span>
          <v-tooltip text="Copiar link público">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="x-small" icon variant="text" @click.stop="copyLink(form.slug)">
                <v-icon size="16">mdi-content-copy</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </div>
    </div>

    <FormResponsesDialog v-model="responsesOpen" :form-id="selectedFormId" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FormResponsesDialog from './FormResponsesDialog.vue'

const props = defineProps<{
  companyId: string   // ej: 'healup', 'gatwick', 'estasconsuerte'
}>()

const forms          = ref<any[]>([])
const loading        = ref(false)
const responsesOpen  = ref(false)
const selectedFormId = ref<number | null>(null)

async function fetchForms() {
  loading.value = true
  try {
    const data = await $fetch<{ forms: any[] }>('/api/forms', {
      params: { company_id: props.companyId },
    })
    forms.value = data.forms || []
  } catch (e) {
    console.error('Error cargando forms:', e)
  } finally {
    loading.value = false
  }
}

function openResponses(form: any) {
  selectedFormId.value = form.id
  responsesOpen.value = true
}

function copyLink(slug: string) {
  const url = `${window.location.origin}/forms/${slug}`
  navigator.clipboard.writeText(url)
  alert(`Link copiado:\n${url}`)
}

onMounted(fetchForms)
</script>

<style scoped>
.forms-company-panel { padding: 20px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.panel-header h2 { margin: 0 0 4px 0; font-size: 22px; }
.subtitle { color: var(--text-muted, #888); font-size: 14px; margin: 0; }

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted, #888);
}
.empty-state p { margin: 8px 0 0 0; }
.empty-state .hint { font-size: 13px; opacity: 0.7; }

.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.form-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.form-card:hover {
  border-color: var(--primary, #daa520);
  transform: translateY(-2px);
}
.form-card.inactive { opacity: 0.6; }

.form-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.form-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}

.form-desc {
  font-size: 13px;
  color: var(--text-muted, #888);
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.form-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px;
  font-size: 12px;
  color: var(--text-muted, #888);
}
.meta-item { display: flex; align-items: center; gap: 4px; }
</style>
