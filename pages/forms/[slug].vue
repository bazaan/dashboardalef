<template>
  <div class="form-container">
    <!-- Loading -->
    <div v-if="loading" class="state-card">
      <div class="spinner"></div>
      <p>Cargando formulario...</p>
    </div>

    <!-- Error (not found, closed, etc.) -->
    <div v-else-if="errorMsg" class="state-card error">
      <div class="emoji">⚠️</div>
      <h1>{{ errorTitle }}</h1>
      <p>{{ errorMsg }}</p>
    </div>

    <!-- Thank you (post-submit) -->
    <div v-else-if="submitted" class="state-card success">
      <div class="emoji">✅</div>
      <h1>{{ form?.thanks_text || '¡Gracias!' }}</h1>
      <p v-if="form?.redirect_url">Te redirigimos en unos segundos…</p>
    </div>

    <!-- Form -->
    <form v-else-if="form" class="form-card" @submit.prevent="handleSubmit">
      <header class="form-header">
        <h1>{{ form.title }}</h1>
        <p v-if="form.description" class="form-description">{{ form.description }}</p>
      </header>

      <div class="fields-list">
        <div v-for="field in form.fields" :key="field.id" class="field-block">
          <label class="field-label">
            {{ field.label }}
            <span v-if="field.required" class="required">*</span>
          </label>

          <!-- Respuesta corta / email / phone -->
          <input
            v-if="['short', 'email', 'phone'].includes(field.type)"
            v-model="answers[field.id]"
            :type="field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'"
            :placeholder="field.placeholder || ''"
            :required="field.required"
            class="text-input"
          />

          <!-- Respuesta larga -->
          <textarea
            v-else-if="field.type === 'long'"
            v-model="answers[field.id]"
            :placeholder="field.placeholder || ''"
            :required="field.required"
            class="textarea-input"
            rows="4"
          ></textarea>

          <!-- Fecha -->
          <input
            v-else-if="field.type === 'date'"
            v-model="answers[field.id]"
            type="date"
            :required="field.required"
            class="text-input"
          />

          <!-- Radio (selección única) -->
          <div v-else-if="field.type === 'radio'" class="options-list">
            <label v-for="opt in field.options || []" :key="opt" class="option-item">
              <input
                type="radio"
                :name="field.id"
                :value="opt"
                v-model="answers[field.id]"
                :required="field.required"
              />
              <span>{{ opt }}</span>
            </label>
          </div>

          <!-- Checkbox (múltiple selección) -->
          <div v-else-if="field.type === 'checkbox'" class="options-list">
            <label v-for="opt in field.options || []" :key="opt" class="option-item">
              <input
                type="checkbox"
                :value="opt"
                v-model="answers[field.id]"
              />
              <span>{{ opt }}</span>
            </label>
          </div>
        </div>
      </div>

      <div v-if="submitError" class="submit-error">{{ submitError }}</div>

      <button type="submit" class="submit-button" :disabled="submitting">
        {{ submitting ? 'Enviando...' : 'Enviar respuestas' }}
      </button>

      <footer class="form-footer">Formulario creado con Alef Dashboard</footer>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({
  layout: 'forms-public',
  // sin middleware → completamente público
})

interface Field {
  id: string
  type: 'short' | 'long' | 'checkbox' | 'radio' | 'date' | 'email' | 'phone'
  label: string
  required: boolean
  options?: string[]
  placeholder?: string
}

interface PublicForm {
  id: number
  slug: string
  title: string
  description: string | null
  fields: Field[]
  thanks_text: string | null
  redirect_url: string | null
}

const route = useRoute()
const slug  = computed(() => String(route.params.slug || ''))

const form         = ref<PublicForm | null>(null)
const loading      = ref(true)
const errorMsg     = ref<string | null>(null)
const errorTitle   = ref<string>('Algo salió mal')
const answers      = reactive<Record<string, any>>({})
const submitting   = ref(false)
const submitted    = ref(false)
const submitError  = ref<string | null>(null)

useHead({
  title: computed(() => form.value?.title ? `${form.value.title} — Alef` : 'Formulario'),
})

onMounted(async () => {
  try {
    const data = await $fetch<PublicForm>(`/api/forms/public/${slug.value}`)
    form.value = data
    // Inicializar checkboxes como array
    for (const f of data.fields) {
      if (f.type === 'checkbox') answers[f.id] = []
      else answers[f.id] = ''
    }
  } catch (e: any) {
    const status = e?.statusCode || e?.response?.status
    if (status === 404) {
      errorTitle.value = 'Formulario no encontrado'
      errorMsg.value   = 'El link que recibiste no existe o ya no está disponible.'
    } else if (status === 410) {
      errorTitle.value = 'Formulario cerrado'
      errorMsg.value   = 'Este formulario ya no está aceptando respuestas.'
    } else {
      errorMsg.value = 'No pudimos cargar el formulario. Inténtalo de nuevo en unos minutos.'
    }
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  if (!form.value) return
  submitError.value = null
  submitting.value = true
  try {
    const res = await $fetch<{ ok: boolean; thanks_text: string; redirect_url?: string }>(
      `/api/forms/public/${slug.value}/submit`,
      { method: 'POST', body: { answers } },
    )
    submitted.value = true
    if (res.redirect_url) {
      setTimeout(() => { window.location.href = res.redirect_url! }, 2500)
    }
  } catch (e: any) {
    submitError.value = e?.statusMessage || e?.message || 'Error enviando la respuesta'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-container {
  max-width: 720px;
  margin: 0 auto;
}

.state-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius);
  padding: 48px 32px;
  text-align: center;
}

.state-card .emoji {
  font-size: 56px;
  margin-bottom: 16px;
}

.state-card h1 {
  font-size: 24px;
  margin: 0 0 12px 0;
  color: var(--fp-text);
}

.state-card p {
  color: var(--fp-text-muted);
  font-size: 15px;
  line-height: 1.5;
  margin: 0;
}

.state-card.error h1 { color: #f87171; }
.state-card.success h1 { color: var(--fp-success); }

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 16px;
  border: 3px solid var(--fp-border);
  border-top-color: var(--fp-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.form-card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: var(--fp-radius);
  padding: 40px 32px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}

.form-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--fp-text);
}

.form-description {
  color: var(--fp-text-muted);
  font-size: 15px;
  line-height: 1.55;
  margin: 0 0 32px 0;
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fp-text);
}

.required {
  color: var(--fp-error);
  margin-left: 2px;
}

.text-input,
.textarea-input {
  width: 100%;
  background: var(--fp-card-soft);
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  padding: 12px 14px;
  color: var(--fp-text);
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.15s;
}

.text-input:focus,
.textarea-input:focus {
  outline: none;
  border-color: var(--fp-primary);
}

.textarea-input {
  resize: vertical;
  min-height: 90px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 15px;
  color: var(--fp-text);
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}

.option-item:hover {
  background: var(--fp-card-soft);
}

.option-item input[type="radio"],
.option-item input[type="checkbox"] {
  accent-color: var(--fp-primary);
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.submit-button {
  margin-top: 28px;
  width: 100%;
  background: var(--fp-primary);
  color: #0a0b10;
  border: none;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.submit-button:hover:not(:disabled) { background: var(--fp-primary-hover); }
.submit-button:disabled { opacity: 0.6; cursor: not-allowed; }

.submit-error {
  margin-top: 16px;
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 14px;
}

.form-footer {
  margin-top: 24px;
  text-align: center;
  color: var(--fp-text-muted);
  font-size: 12px;
}

@media (max-width: 640px) {
  .form-card { padding: 28px 20px; }
  .form-header h1 { font-size: 22px; }
}
</style>
