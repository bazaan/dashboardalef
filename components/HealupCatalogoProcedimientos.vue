<template>
  <div class="catalogo-proc">

    <header class="top-header">
      <h1>Catálogo de Procedimientos</h1>
      <div style="display: flex; gap: 10px;">
        <v-btn color="primary" variant="elevated" prepend-icon="mdi-plus" @click="abrirNuevo">
          Nuevo
        </v-btn>
      </div>
    </header>

    <div class="content-area">
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">
            Procedimientos
            <v-chip v-if="procedimientos.length" size="x-small" color="primary" class="ms-2">
              {{ procedimientos.length }}
            </v-chip>
          </span>
          <v-spacer />
          <v-btn icon size="small" variant="text" :loading="loading" @click="cargar">
            <v-icon icon="mdi-refresh" size="20" />
            <v-tooltip activator="parent">Recargar</v-tooltip>
          </v-btn>
          <v-text-field
            v-model="search"
            append-inner-icon="mdi-magnify"
            label="Buscar"
            single-line
            hide-details
            density="compact"
            variant="outlined"
            class="search-field"
            style="max-width: 280px;"
          />
        </v-card-title>

        <v-data-table
          :headers="headers"
          :items="procedimientos"
          :search="search"
          :loading="loading"
          class="elevation-0"
          no-data-text="No hay procedimientos en el catálogo"
          group-by="grupo"
          items-per-page="50"
        >
          <!-- Header de grupo -->
          <template v-slot:group-header="{ item, columns, toggleGroup, isGroupOpen }">
            <tr style="cursor: pointer;" @click="toggleGroup(item)">
              <td
                :colspan="columns.length"
                style="
                  padding: 6px 12px;
                  background: var(--surface, #f9fafb);
                  font-size: 0.72rem;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                  opacity: 0.7;
                "
              >
                <v-icon
                  :icon="isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                  size="16"
                  class="me-1"
                />
                {{ item.value || 'Sin grupo' }}
              </td>
            </tr>
          </template>

          <!-- SKU -->
          <template v-slot:item.sku="{ item }">
            <v-chip size="x-small" color="primary" variant="tonal" style="font-family: monospace;">
              {{ item.sku || '—' }}
            </v-chip>
          </template>

          <!-- Precio (valor_unitario sin IGV → total con IGV) -->
          <template v-slot:item.price="{ item }">
            <div>
              <span style="font-weight: 600;">S/ {{ formatTotal(item.price) }}</span>
              <span style="font-size: 0.72rem; opacity: 0.55; margin-left: 4px;">
                (s/IGV: S/ {{ fmtNum(item.price) }})
              </span>
            </div>
          </template>

          <!-- Tipo -->
          <template v-slot:item.tipo="{ item }">
            <v-chip
              :color="item.tipo === 'consulta' ? 'blue' : item.tipo === 'producto' ? 'orange' : 'green'"
              size="x-small"
              variant="tonal"
            >
              {{ item.tipo || 'procedimiento' }}
            </v-chip>
          </template>

          <!-- Cabina -->
          <template v-slot:item.cabina="{ item }">
            <span style="font-size: 0.82rem;">
              {{ item.cabina === 'cabina2' ? 'Cabina 2 (Cosmiatra)' : 'Cabina 1 (Dra. Valeria)' }}
            </span>
          </template>

          <!-- Acciones -->
          <template v-slot:item.acciones="{ item }">
            <div style="display: flex; gap: 2px;">
              <v-btn icon size="x-small" variant="text" color="primary" @click="abrirEditar(item)">
                <v-icon icon="mdi-pencil" size="16" />
                <v-tooltip activator="parent">Editar</v-tooltip>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :disabled="item.tipo === 'consulta'"
                @click="confirmarEliminar(item)"
              >
                <v-icon icon="mdi-delete" size="16" />
                <v-tooltip activator="parent">{{ item.tipo === 'consulta' ? 'El ítem de consulta no se puede eliminar' : 'Eliminar' }}</v-tooltip>
              </v-btn>
            </div>
          </template>

        </v-data-table>
      </v-card>
    </div>

    <!-- ════════ DIALOG: AGREGAR / EDITAR ════════ -->
    <v-dialog v-model="showDialog" max-width="620px" persistent>
      <v-card>
        <v-card-title class="pa-4" style="border-bottom: 1px solid rgba(0,0,0,.1); font-size: 1rem;">
          <v-icon :icon="editando ? 'mdi-pencil' : 'mdi-plus'" class="me-2" />
          {{ editando ? 'Editar Procedimiento' : 'Nuevo Procedimiento' }}
        </v-card-title>

        <v-card-text class="pa-4">
          <v-row dense>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="form.sku"
                label="SKU *"
                variant="outlined"
                density="compact"
                maxlength="20"
                :rules="[v => !!v || 'Requerido']"
                hint="Ej: ME-001, FB-001"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="8">
              <v-text-field
                v-model="form.name"
                label="Nombre del procedimiento *"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Requerido']"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-select
                v-model="form.tipo"
                :items="tiposProcedimiento"
                item-title="label"
                item-value="value"
                label="Tipo"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model.number="form.price"
                label="Precio sin IGV *"
                type="number"
                step="0.01"
                prefix="S/"
                variant="outlined"
                density="compact"
                :rules="[v => (v !== null && v !== '' && Number(v) >= 0) || 'Requerido']"
                hint="Valor unitario NubeFact"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                :model-value="((Number(form.price) || 0) * 1.18).toFixed(2)"
                label="Total con IGV (18%)"
                variant="outlined"
                density="compact"
                prefix="S/"
                readonly
                hint="Precio que paga el paciente"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.grupo"
                label="Grupo / Categoría"
                variant="outlined"
                density="compact"
                hint="Ej: MEDICINA ESTETICA, FACIAL BASICO"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.cabina"
                :items="cabinas"
                item-title="label"
                item-value="value"
                label="Cabina asignada"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-alert v-if="errorForm" type="error" variant="tonal" density="compact" class="mt-3">
            {{ errorForm }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-4" style="border-top: 1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn variant="text" @click="showDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="guardando"
            prepend-icon="mdi-content-save"
            @click="guardar"
          >
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ════════ DIALOG: CONFIRMAR ELIMINAR ════════ -->
    <v-dialog v-model="showConfirmDelete" max-width="420px">
      <v-card>
        <v-card-text class="pa-5">
          ¿Eliminar <strong>{{ eliminandoItem?.name }}</strong>
          <span v-if="eliminandoItem?.sku"> ({{ eliminandoItem.sku }})</span>?
          <div class="mt-2 text-caption" style="opacity: 0.6;">Esta acción no se puede deshacer.</div>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="showConfirmDelete = false">Cancelar</v-btn>
          <v-btn color="error" variant="elevated" :loading="eliminando" @click="eliminar">
            Eliminar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()

/* ─── Estado ─────────────────────────────────────────── */
const procedimientos    = ref<any[]>([])
const loading           = ref(false)
const search            = ref('')

const showDialog        = ref(false)
const editando          = ref(false)
const guardando         = ref(false)
const errorForm         = ref('')

const showConfirmDelete = ref(false)
const eliminandoItem    = ref<any>(null)
const eliminando        = ref(false)

const formVacio = () => ({
  id:     null as number | null,
  sku:    '',
  name:   '',
  tipo:   'procedimiento',
  price:  null as number | null,
  grupo:  '',
  cabina: 'cabina1'
})
const form = ref(formVacio())

/* ─── Constantes ─────────────────────────────────────── */
const headers = [
  { title: 'SKU',        key: 'sku',      sortable: true,  width: '110px' },
  { title: 'Nombre',     key: 'name',     sortable: true                  },
  { title: 'Tipo',       key: 'tipo',     sortable: true,  width: '120px' },
  { title: 'Precio',     key: 'price',    sortable: true,  width: '180px' },
  { title: 'Cabina',     key: 'cabina',   sortable: true,  width: '200px' },
  { title: '',           key: 'acciones', sortable: false, width: '90px'  }
]

const tiposProcedimiento = [
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'producto',      label: 'Producto'      },
  { value: 'consulta',      label: 'Consulta'      }
]

const cabinas = [
  { value: 'cabina1', label: 'Cabina 1 — Dra. Valeria (Armonización)' },
  { value: 'cabina2', label: 'Cabina 2 — Cosmiatra (Facial/Corporal)' }
]

/* ─── Formateo ───────────────────────────────────────── */
const fmtNum    = (n: number) => Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })
const formatTotal = (precio: number) => fmtNum(Number(precio || 0) * 1.18)

/* ─── Carga ──────────────────────────────────────────── */
const cargar = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('healup_procedures')
      .select('id, sku, name, tipo, price, grupo, cabina')
      .order('grupo')
      .order('name')
    if (error) throw error
    procedimientos.value = data || []
  } catch (e: any) {
    console.error('[Catalogo] Error cargando:', e?.message)
  } finally {
    loading.value = false
  }
}

/* ─── Dialogs ────────────────────────────────────────── */
const abrirNuevo = () => {
  editando.value  = false
  errorForm.value = ''
  form.value      = formVacio()
  showDialog.value = true
}

const abrirEditar = (item: any) => {
  editando.value   = true
  errorForm.value  = ''
  form.value = {
    id:     item.id,
    sku:    item.sku    || '',
    name:   item.name   || '',
    tipo:   item.tipo   || 'procedimiento',
    price:  item.price  ?? null,
    grupo:  item.grupo  || '',
    cabina: item.cabina || 'cabina1'
  }
  showDialog.value = true
}

const confirmarEliminar = (item: any) => {
  eliminandoItem.value    = item
  showConfirmDelete.value = true
}

/* ─── CRUD ───────────────────────────────────────────── */
const guardar = async () => {
  errorForm.value = ''
  if (!form.value.sku.trim() || !form.value.name.trim()) {
    errorForm.value = 'SKU y Nombre son requeridos.'
    return
  }
  if (form.value.price === null || Number(form.value.price) < 0) {
    errorForm.value = 'El precio debe ser un número ≥ 0.'
    return
  }

  guardando.value = true
  try {
    const row = {
      sku:    form.value.sku.trim().toUpperCase(),
      name:   form.value.name.trim(),
      tipo:   form.value.tipo,
      price:  Number(form.value.price),
      grupo:  form.value.grupo.trim().toUpperCase() || null,
      cabina: form.value.cabina
    }

    if (editando.value && form.value.id) {
      const { error } = await supabase
        .from('healup_procedures')
        .update(row)
        .eq('id', form.value.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('healup_procedures')
        .insert(row)
      if (error) throw error
    }

    showDialog.value = false
    await cargar()
  } catch (e: any) {
    errorForm.value = e?.message || 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

const eliminar = async () => {
  if (!eliminandoItem.value) return
  eliminando.value = true
  try {
    const { error } = await supabase
      .from('healup_procedures')
      .delete()
      .eq('id', eliminandoItem.value.id)
    if (error) throw error
    showConfirmDelete.value = false
    eliminandoItem.value    = null
    await cargar()
  } catch (e: any) {
    console.error('[Catalogo] Error eliminando:', e?.message)
  } finally {
    eliminando.value = false
  }
}

/* ─── Init ───────────────────────────────────────────── */
onMounted(cargar)
</script>
