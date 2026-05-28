<template>
  <v-dialog v-model="dialog" max-width="900" persistent scrollable>
    <v-card class="fb-card">
      <v-card-title class="fb-title">
        {{ isEdit ? 'Editar formulario' : 'Nuevo formulario' }}
      </v-card-title>

      <v-card-text class="fb-body">

        <!-- Datos generales -->
        <div class="fb-section">
          <div class="fb-row">
            <v-text-field
              v-model="model.title"
              label="Título del formulario"
              variant="outlined"
              density="compact"
              :rules="[v => !!v || 'Requerido']"
              hide-details="auto"
            />
          </div>

          <div class="fb-row">
            <v-textarea
              v-model="model.description"
              label="Descripción (opcional)"
              variant="outlined"
              density="compact"
              rows="2"
              hide-details
            />
          </div>

          <div class="fb-row two-cols">
            <v-select
              v-model="model.company_id"
              :items="companyOptions"
              label="Empresa"
              variant="outlined"
              density="compact"
              :disabled="isEdit"
              :rules="[v => !!v || 'Requerido']"
              hide-details="auto"
            />
            <v-switch
              v-model="model.active"
              label="Formulario activo (acepta respuestas)"
              color="success"
              density="compact"
              hide-details
              inset
            />
          </div>

          <div class="fb-row">
            <v-text-field
              v-model="model.thanks_text"
              label="Mensaje de agradecimiento"
              variant="outlined"
              density="compact"
              hide-details
            />
          </div>
        </div>

        <v-divider class="my-3" />

        <!-- Preguntas -->
        <div class="fb-section">
          <div class="section-header">
            <strong>Preguntas ({{ model.fields.length }})</strong>
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn v-bind="props" color="primary" size="small" variant="tonal">
                  <v-icon start>mdi-plus</v-icon>
                  Añadir pregunta
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item v-for="t in fieldTypes" :key="t.value" @click="addField(t.value)">
                  <template v-slot:prepend>
                    <v-icon :icon="t.icon" size="18" />
                  </template>
                  <v-list-item-title>{{ t.label }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>

          <div v-if="model.fields.length === 0" class="empty-hint">
            Aún no añadiste preguntas. Usa el botón "Añadir pregunta" arriba.
          </div>

          <div v-for="(field, idx) in model.fields" :key="field.id" class="field-card">
            <div class="field-card-header">
              <v-icon :icon="getFieldIcon(field.type)" size="18" />
              <span class="field-type">{{ getFieldTypeLabel(field.type) }}</span>
              <v-spacer />
              <v-btn size="x-small" icon variant="text" @click="moveField(idx, -1)" :disabled="idx === 0">
                <v-icon>mdi-arrow-up</v-icon>
              </v-btn>
              <v-btn size="x-small" icon variant="text" @click="moveField(idx, 1)" :disabled="idx === model.fields.length - 1">
                <v-icon>mdi-arrow-down</v-icon>
              </v-btn>
              <v-btn size="x-small" icon variant="text" color="error" @click="removeField(idx)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>

            <v-text-field
              v-model="field.label"
              label="Pregunta"
              variant="outlined"
              density="compact"
              hide-details
              class="mb-2"
            />

            <v-text-field
              v-if="['short', 'long', 'email', 'phone'].includes(field.type)"
              v-model="field.placeholder"
              label="Placeholder (opcional)"
              variant="outlined"
              density="compact"
              hide-details
              class="mb-2"
            />

            <div v-if="['radio', 'checkbox'].includes(field.type)" class="options-editor">
              <label class="opt-label">Opciones:</label>
              <div v-for="(opt, optIdx) in field.options" :key="optIdx" class="opt-row">
                <v-text-field
                  v-model="field.options[optIdx]"
                  variant="outlined"
                  density="compact"
                  hide-details
                  :placeholder="`Opción ${optIdx + 1}`"
                />
                <v-btn size="x-small" icon variant="text" color="error" @click="removeOption(field, optIdx)">
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </div>
              <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addOption(field)">
                Añadir opción
              </v-btn>
            </div>

            <v-switch
              v-model="field.required"
              label="Obligatorio"
              color="primary"
              density="compact"
              hide-details
              inset
            />
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="fb-actions">
        <v-btn variant="text" @click="cancel">Cancelar</v-btn>
        <v-spacer />
        <v-btn variant="text" color="primary" :loading="saving" @click="save">
          {{ isEdit ? 'Guardar cambios' : 'Crear formulario' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface Field {
  id: string
  type: 'short' | 'long' | 'checkbox' | 'radio' | 'date' | 'email' | 'phone'
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
}

interface FormModel {
  id?: number
  title: string
  description: string
  company_id: string
  fields: Field[]
  active: boolean
  thanks_text: string
}

const props = defineProps<{
  modelValue: boolean
  form?: any        // si viene → edit mode
  defaultCompany?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved', form: any): void
}>()

const dialog = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.form?.id)

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

const fieldTypes = [
  { value: 'short',    label: 'Respuesta corta',  icon: 'mdi-form-textbox' },
  { value: 'long',     label: 'Respuesta larga',  icon: 'mdi-text-box-outline' },
  { value: 'radio',    label: 'Selección única (radio)',  icon: 'mdi-radiobox-marked' },
  { value: 'checkbox', label: 'Selección múltiple (checkboxes)', icon: 'mdi-checkbox-marked' },
  { value: 'date',     label: 'Fecha',            icon: 'mdi-calendar' },
  { value: 'time',     label: 'Hora (12h con AM/PM)', icon: 'mdi-clock-outline' },
  { value: 'email',    label: 'Email',            icon: 'mdi-email' },
  { value: 'phone',    label: 'Teléfono',         icon: 'mdi-phone' },
]

function getFieldIcon(type: string) {
  return fieldTypes.find(t => t.value === type)?.icon || 'mdi-help'
}
function getFieldTypeLabel(type: string) {
  return fieldTypes.find(t => t.value === type)?.label || type
}

const emptyModel = (): FormModel => ({
  title:       '',
  description: '',
  company_id:  props.defaultCompany || '',
  fields:      [],
  active:      true,
  thanks_text: '¡Gracias por completar el formulario!',
})

const model  = ref<FormModel>(emptyModel())
const saving = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    if (props.form) {
      // edit
      model.value = {
        id:          props.form.id,
        title:       props.form.title || '',
        description: props.form.description || '',
        company_id:  props.form.company_id || '',
        fields:      Array.isArray(props.form.fields) ? JSON.parse(JSON.stringify(props.form.fields)) : [],
        active:      props.form.active !== false,
        thanks_text: props.form.thanks_text || '¡Gracias por completar el formulario!',
      }
    } else {
      model.value = emptyModel()
    }
  }
})

function genFieldId(): string {
  return 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function addField(type: Field['type']) {
  const field: Field = {
    id:       genFieldId(),
    type,
    label:    '',
    required: false,
  }
  if (type === 'radio' || type === 'checkbox') field.options = ['', '']
  model.value.fields.push(field)
}

function removeField(idx: number) {
  if (!confirm('¿Eliminar esta pregunta?')) return
  model.value.fields.splice(idx, 1)
}

function moveField(idx: number, delta: number) {
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= model.value.fields.length) return
  const [f] = model.value.fields.splice(idx, 1)
  model.value.fields.splice(newIdx, 0, f)
}

function addOption(field: Field) {
  if (!field.options) field.options = []
  field.options.push('')
}
function removeOption(field: Field, idx: number) {
  if (!field.options) return
  field.options.splice(idx, 1)
}

function cancel() {
  dialog.value = false
}

async function save() {
  // Validaciones
  if (!model.value.title.trim()) return alert('Falta el título')
  if (!model.value.company_id)   return alert('Elegí la empresa')
  if (model.value.fields.length === 0) return alert('Añadí al menos una pregunta')

  for (const f of model.value.fields) {
    if (!f.label.trim()) return alert('Hay una pregunta sin texto')
    if (['radio', 'checkbox'].includes(f.type)) {
      const opts = (f.options || []).filter(o => o.trim())
      if (opts.length < 2) return alert(`La pregunta "${f.label}" necesita al menos 2 opciones`)
      f.options = opts
    }
  }

  saving.value = true
  try {
    let res: any
    if (isEdit.value) {
      res = await $fetch(`/api/forms/${model.value.id}`, {
        method: 'PUT',
        body: {
          title:       model.value.title,
          description: model.value.description,
          fields:      model.value.fields,
          active:      model.value.active,
          thanks_text: model.value.thanks_text,
        },
      })
    } else {
      res = await $fetch('/api/forms/create', {
        method: 'POST',
        body: {
          title:       model.value.title,
          description: model.value.description,
          company_id:  model.value.company_id,
          fields:      model.value.fields,
          active:      model.value.active,
          thanks_text: model.value.thanks_text,
        },
      })
    }
    emit('saved', res?.form)
    dialog.value = false
  } catch (e: any) {
    alert(`Error: ${e?.statusMessage || e?.message || 'desconocido'}`)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.fb-card { background: var(--surface, #1a1a2e); }
.fb-title { font-size: 18px; font-weight: 600; padding: 16px 20px; }
.fb-body { max-height: 70vh; overflow-y: auto; padding: 0 20px; }
.fb-section { padding: 12px 0; }
.fb-row { margin-bottom: 12px; }
.fb-row.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.empty-hint { padding: 24px; text-align: center; color: var(--text-muted, #888); font-size: 14px; border: 1px dashed var(--border, #333); border-radius: 8px; }
.field-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.field-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.field-type { font-size: 12px; font-weight: 600; color: var(--text-muted, #888); }
.opt-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; display: block; }
.opt-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.options-editor { margin-bottom: 12px; padding: 8px 10px; background: rgba(0,0,0,0.15); border-radius: 8px; }
.fb-actions { padding: 12px 20px; border-top: 1px solid var(--border, #333); }
</style>
