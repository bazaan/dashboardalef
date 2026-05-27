<template>
  <v-dialog v-model="dialog" max-width="1100" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center" style="gap:12px">
        <v-icon icon="mdi-table" />
        <div style="flex:1">
          <div style="font-size:18px; font-weight:600">{{ form?.title || 'Respuestas' }}</div>
          <div style="font-size:12px; color: var(--text-muted, #888)">
            {{ responses.length }} respuesta{{ responses.length === 1 ? '' : 's' }} —
            {{ form?.created_at ? `Form creado ${new Date(form.created_at).toLocaleDateString('es-PE')}` : '' }}
          </div>
        </div>
        <v-btn icon variant="text" @click="dialog = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text style="max-height: 75vh">
        <div v-if="loading" class="text-center pa-8">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div v-else-if="!responses.length" class="text-center pa-8" style="color: var(--text-muted, #888)">
          Nadie ha respondido este formulario todavía.
        </div>

        <v-data-table
          v-else
          :headers="tableHeaders"
          :items="tableRows"
          :items-per-page="20"
          density="compact"
          class="elevation-0"
        >
          <template v-slot:item.submitted_at="{ item }">
            {{ new Date(item.submitted_at).toLocaleString('es-PE') }}
          </template>
        </v-data-table>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" prepend-icon="mdi-file-excel" color="success" :disabled="!responses.length" @click="exportCsv">
          Exportar CSV
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  formId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const dialog = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form      = ref<any>(null)
const responses = ref<any[]>([])
const loading   = ref(false)

watch(() => props.formId, async (id) => {
  if (!id || !props.modelValue) return
  loading.value = true
  try {
    const data: any = await $fetch(`/api/forms/${id}/responses`)
    form.value = data.form
    responses.value = data.responses || []
  } catch (e: any) {
    alert(`Error: ${e?.statusMessage || e?.message}`)
  } finally {
    loading.value = false
  }
}, { immediate: true })

watch(() => props.modelValue, async (open) => {
  if (open && props.formId) {
    loading.value = true
    try {
      const data: any = await $fetch(`/api/forms/${props.formId}/responses`)
      form.value = data.form
      responses.value = data.responses || []
    } catch (e: any) {
      alert(`Error: ${e?.statusMessage || e?.message}`)
    } finally {
      loading.value = false
    }
  }
})

// Headers: fecha + una columna por cada campo del form
const tableHeaders = computed(() => {
  const base = [
    { title: 'Fecha de envío', key: 'submitted_at', sortable: true },
  ]
  if (!form.value?.fields) return base
  for (const f of form.value.fields) {
    base.push({ title: f.label, key: f.id, sortable: false } as any)
  }
  return base
})

// Cada fila: { submitted_at, ...answers }
const tableRows = computed(() => {
  return responses.value.map(r => ({
    submitted_at: r.submitted_at,
    ...flattenAnswers(r.answers),
  }))
})

function flattenAnswers(answers: any): Record<string, any> {
  const out: Record<string, any> = {}
  if (!answers || typeof answers !== 'object') return out
  for (const [k, v] of Object.entries(answers)) {
    if (Array.isArray(v)) out[k] = v.join(', ')
    else out[k] = v ?? '—'
  }
  return out
}

function exportCsv() {
  if (!responses.value.length || !form.value) return

  // Headers en orden: fecha + label de cada campo
  const headerCells = ['Fecha de envío', ...form.value.fields.map((f: any) => f.label)]
  const rows = [headerCells]

  for (const r of responses.value) {
    const row = [new Date(r.submitted_at).toLocaleString('es-PE')]
    for (const f of form.value.fields) {
      let v = r.answers?.[f.id]
      if (Array.isArray(v)) v = v.join('; ')
      if (v === null || v === undefined) v = ''
      row.push(String(v))
    }
    rows.push(row)
  }

  const csv = rows
    .map(row => row.map(cell => {
      const c = String(cell ?? '')
      // Si contiene coma, comilla o newline → escapar
      if (/[",\n\r]/.test(c)) return `"${c.replace(/"/g, '""')}"`
      return c
    }).join(','))
    .join('\n')

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${form.value.slug || 'formulario'}-respuestas.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
