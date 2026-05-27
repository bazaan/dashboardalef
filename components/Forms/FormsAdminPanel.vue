<template>
  <div class="forms-admin-panel">
    <header class="panel-header">
      <div>
        <h2>Formularios</h2>
        <p class="subtitle">Crea y administra formularios públicos de cualquier empresa.</p>
      </div>
      <div class="header-actions">
        <v-select
          v-model="filterCompany"
          :items="companyOptions"
          label="Filtrar por empresa"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          style="min-width: 220px"
        />
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Nuevo formulario
        </v-btn>
      </div>
    </header>

    <v-data-table
      :headers="headers"
      :items="filteredForms"
      :loading="loading"
      class="forms-table elevation-0"
      no-data-text="No hay formularios todavía"
      :items-per-page="20"
    >
      <template v-slot:item.title="{ item }">
        <div class="title-cell">
          <strong>{{ item.title }}</strong>
          <span class="muted" v-if="item.description">{{ item.description.slice(0, 60) }}{{ item.description.length > 60 ? '…' : '' }}</span>
        </div>
      </template>

      <template v-slot:item.company_id="{ item }">
        <v-chip size="small" variant="tonal">{{ companyLabel(item.company_id) }}</v-chip>
      </template>

      <template v-slot:item.active="{ item }">
        <v-chip :color="item.active ? 'success' : 'error'" size="small">
          {{ item.active ? 'Activo' : 'Pausado' }}
        </v-chip>
      </template>

      <template v-slot:item.created_at="{ item }">
        {{ new Date(item.created_at).toLocaleString('es-PE') }}
      </template>

      <template v-slot:item.actions="{ item }">
        <div class="action-cell">
          <v-tooltip text="Copiar link público">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" icon variant="text" @click="copyLink(item.slug)">
                <v-icon>mdi-content-copy</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Abrir formulario público">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" icon variant="text" :href="`/forms/${item.slug}`" target="_blank">
                <v-icon>mdi-open-in-new</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Ver respuestas">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" icon variant="text" color="info" @click="openResponses(item)">
                <v-icon>mdi-table</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Editar">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" icon variant="text" color="primary" @click="openEdit(item)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="Eliminar">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" size="small" icon variant="text" color="error" @click="deleteForm(item)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>
    </v-data-table>

    <FormBuilder v-model="builderOpen" :form="editingForm" @saved="onSaved" />
    <FormResponsesDialog v-model="responsesOpen" :form-id="responsesFormId" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import FormBuilder from './FormBuilder.vue'
import FormResponsesDialog from './FormResponsesDialog.vue'

const forms        = ref<any[]>([])
const loading      = ref(false)
const filterCompany = ref<string | null>(null)
const builderOpen  = ref(false)
const editingForm  = ref<any>(null)
const responsesOpen = ref(false)
const responsesFormId = ref<number | null>(null)

const companyOptions = [
  { value: 'healup',          title: 'Healup' },
  { value: 'brada',           title: 'Brada Perfumes' },
  { value: 'alef',            title: 'Alef Company' },
  { value: 'alegrated',       title: 'Alegrated' },
  { value: 'clinicaarroyo',   title: 'Clínica Arroyo' },
  { value: 'origitec',        title: 'Origitec' },
  { value: 'solari',          title: 'Solari' },
  { value: 'skip',            title: 'SKIP' },
  { value: 'estasconsuerte',  title: 'Estás Con Suerte' },
  { value: 'estetikamedika',  title: 'Estetika Medika' },
  { value: 'davila',          title: 'Miguel Davila' },
  { value: 'gatwick',         title: 'Gatwick' },
]

function companyLabel(id: string): string {
  return companyOptions.find(c => c.value === id)?.title || id
}

const headers = [
  { title: 'Título',           key: 'title',      sortable: true },
  { title: 'Empresa',          key: 'company_id', sortable: true },
  { title: 'Estado',           key: 'active',     sortable: true },
  { title: 'Fecha creación',   key: 'created_at', sortable: true },
  { title: 'Acciones',         key: 'actions',    sortable: false, align: 'end' },
]

const filteredForms = computed(() => {
  if (!filterCompany.value) return forms.value
  return forms.value.filter(f => f.company_id === filterCompany.value)
})

async function fetchForms() {
  loading.value = true
  try {
    const data = await $fetch<{ forms: any[] }>('/api/forms')
    forms.value = data.forms || []
  } catch (e) {
    console.error('Error cargando forms:', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingForm.value = null
  builderOpen.value = true
}

function openEdit(form: any) {
  editingForm.value = form
  builderOpen.value = true
}

function openResponses(form: any) {
  responsesFormId.value = form.id
  responsesOpen.value = true
}

async function deleteForm(form: any) {
  if (!confirm(`¿Eliminar el formulario "${form.title}" y todas sus respuestas?`)) return
  try {
    await $fetch(`/api/forms/${form.id}`, { method: 'DELETE' })
    await fetchForms()
  } catch (e: any) {
    alert(`Error: ${e?.statusMessage || e?.message}`)
  }
}

function copyLink(slug: string) {
  const url = `${window.location.origin}/forms/${slug}`
  navigator.clipboard.writeText(url)
  // pequeña confirmación
  ;(window as any).$toast?.(`Link copiado: ${url}`) || alert(`Link copiado:\n${url}`)
}

function onSaved() {
  fetchForms()
}

onMounted(fetchForms)
</script>

<style scoped>
.forms-admin-panel { padding: 20px; }
.panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.panel-header h2 { margin: 0 0 4px 0; font-size: 22px; }
.subtitle { color: var(--text-muted, #888); font-size: 14px; margin: 0; }
.header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.forms-table { background: transparent; }
.title-cell { display: flex; flex-direction: column; gap: 2px; }
.title-cell .muted { color: var(--text-muted, #888); font-size: 12px; }
.action-cell { display: flex; gap: 4px; justify-content: flex-end; }
</style>
