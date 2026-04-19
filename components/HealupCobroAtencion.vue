<template>
  <div class="cobro-atencion">

    <!-- ═══════ HEADER ═══════ -->
    <header class="top-header">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <h1>Cobro de Atención</h1>
        <!-- Indicador de pasos -->
        <div class="steps-bar">
          <div
            v-for="s in 2" :key="s"
            :class="['step-dot', { active: paso === s, done: paso > s }]"
          >
            <v-icon v-if="paso > s" icon="mdi-check" size="12" />
            <span v-else>{{ s }}</span>
          </div>
          <div class="step-label">
            {{ paso === 1 ? 'Paciente' : 'Precotización' }}
          </div>
        </div>
      </div>
      <v-btn variant="outlined" size="small" prepend-icon="mdi-refresh" @click="resetFlujo">
        Nueva Atención
      </v-btn>
    </header>

    <!-- ═══════════════════════════════════════════════════════
         PASO 1 — SELECCIONAR PACIENTE / CITA
    ═══════════════════════════════════════════════════════ -->
    <div v-if="paso === 1" class="content-area">
      <v-card flat class="cobro-card">
        <v-card-title class="cobro-card-title">
          <v-icon icon="mdi-account-search" class="me-2" />
          Datos del Paciente
        </v-card-title>

        <v-card-text class="pt-2">
          <!-- Selector de cita de hoy -->
          <div v-if="!sinCita">
            <div class="field-section-label">Citas de hoy</div>
            <v-select
              v-model="citaSeleccionada"
              :items="citasHoy"
              :item-title="citaLabel"
              item-value="id"
              return-object
              label="Seleccionar cita del calendario"
              variant="outlined"
              density="compact"
              :loading="loadingCitas"
              clearable
              no-data-text="No hay citas registradas para hoy"
              @update:model-value="onSeleccionarCita"
              class="mb-3"
            />
          </div>

          <v-checkbox
            v-model="sinCita"
            label="Paciente sin cita programada (ingreso manual)"
            density="compact"
            hide-details
            class="mb-3"
            @change="citaSeleccionada = null"
          />

          <v-divider class="mb-4" />

          <!-- Datos del paciente -->
          <div class="field-section-label">Datos personales</div>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="paciente.nombre"
                label="Nombre *"
                variant="outlined"
                density="compact"
                :rules="[v => !!v || 'Requerido']"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="paciente.apellido"
                label="Apellido"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-select
                v-model="paciente.doc_tipo"
                :items="tiposDoc"
                item-title="label"
                item-value="value"
                label="Tipo Documento"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="paciente.doc_numero"
                label="N° Documento"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="paciente.email"
                label="Email"
                type="email"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-email-outline"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="paciente.telefono"
                label="Teléfono"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-whatsapp"
                hint="Para envío por WhatsApp"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!paciente.nombre.trim()"
            prepend-icon="mdi-arrow-right"
            @click="paso = 2"
          >
            Continuar a Precotización
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         PASO 2 — PRECOTIZACIÓN + EMISIÓN
    ═══════════════════════════════════════════════════════ -->
    <div v-else-if="paso === 2" class="content-area">
      <div class="paso3-grid">

        <!-- Panel izquierdo: Lista de procedimientos -->
        <v-card flat class="cobro-card">
          <v-card-title class="cobro-card-title" style="justify-content: space-between;">
            <span>
              <v-icon icon="mdi-clipboard-list" class="me-2" />
              Procedimientos
            </span>
            <!-- Selector del catálogo -->
            <v-menu v-model="menuCatalogo" :close-on-content-click="false" min-width="380">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-plus"
                  :loading="loadingCatalogo"
                  :disabled="!!boletaProcedimiento"
                  @click="!catalogoProcedimientos.length ? cargarCatalogo() : undefined"
                >
                  Agregar procedimiento
                </v-btn>
              </template>

              <v-card style="display: flex; flex-direction: column; max-height: 480px;">
                <v-text-field
                  v-model="buscarProcedimiento"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar en catálogo..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="ma-2"
                  autofocus
                />
                <v-list
                  density="compact"
                  style="overflow-y: auto; flex: 1;"
                >
                  <v-list-subheader v-if="!procedimientosFiltrados.length">
                    Sin resultados para "{{ buscarProcedimiento }}"
                  </v-list-subheader>

                  <template v-for="(grupo, gNombre) in procedimientosPorGrupo" :key="gNombre">
                    <v-list-subheader style="font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;">
                      {{ gNombre }}
                    </v-list-subheader>
                    <v-list-item
                      v-for="p in grupo"
                      :key="p.id"
                      density="compact"
                      style="cursor: pointer;"
                      @click="agregarProcedimiento(p)"
                    >
                      <template #prepend>
                        <v-chip size="x-small" color="primary" variant="tonal" style="min-width: 70px; font-size: 0.65rem;">
                          {{ p.sku || '—' }}
                        </v-chip>
                      </template>
                      <v-list-item-title style="font-size: 0.85rem;">{{ p.name }}</v-list-item-title>
                      <v-list-item-subtitle>S/ {{ formatPrecioTotal(p.price) }}</v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-list>
              </v-card>
            </v-menu>
          </v-card-title>

          <v-card-text class="pa-3">
            <div
              v-if="!itemsProcedimiento.length"
              class="text-center py-8"
              style="opacity: 0.4;"
            >
              <v-icon icon="mdi-clipboard-text-off" size="44" />
              <div class="mt-2" style="font-size: 0.9rem;">
                No hay procedimientos seleccionados.<br>
                Usá el botón "Agregar procedimiento" o seleccioná una cita con procedimiento precargado.
              </div>
            </div>

            <div
              v-for="(item, idx) in itemsProcedimiento"
              :key="item.id"
              class="proc-row"
            >
              <div class="proc-info">
                <div class="proc-name">{{ item.name }}</div>
                <div class="proc-meta">
                  <v-chip size="x-small" variant="tonal" color="primary">{{ item.sku || '—' }}</v-chip>
                </div>
              </div>
              <div class="proc-precio">S/ {{ formatPrecioTotal(item.valor_unitario) }}</div>
              <v-btn
                icon
                size="x-small"
                variant="text"
                color="error"
                :disabled="!!boletaProcedimiento"
                @click="itemsProcedimiento.splice(idx, 1)"
              >
                <v-icon icon="mdi-delete" size="16" />
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Panel derecho: Resumen + Acciones -->
        <div class="paso3-side">

          <!-- Resumen de totales -->
          <v-card flat class="cobro-card mb-4">
            <v-card-title class="cobro-card-title">
              <v-icon icon="mdi-calculator" class="me-2" />
              Resumen
            </v-card-title>
            <v-card-text>
              <!-- Items -->
              <div
                v-for="item in itemsProcedimiento"
                :key="item.id"
                class="resumen-fila"
              >
                <span class="resumen-desc">{{ item.name }}</span>
                <span>S/ {{ formatPrecioTotal(item.valor_unitario) }}</span>
              </div>

              <v-divider class="my-2" />

              <div class="resumen-fila">
                <span>Subtotal</span>
                <span>S/ {{ formatPrecioTotal(subtotalProcValorUnit) }}</span>
              </div>

              <div class="resumen-fila resumen-descuento">
                <span>
                  <v-icon icon="mdi-tag-minus" size="14" class="me-1" />
                  Descuento consulta
                </span>
                <span>− S/ 50.00</span>
              </div>

              <v-divider class="my-2" />

              <div class="resumen-fila resumen-total">
                <span>TOTAL A COBRAR</span>
                <span>S/ {{ formatNum(totalProcConIgv) }}</span>
              </div>

              <div v-if="boletaConsulta" class="mt-3 text-caption" style="opacity: 0.6; line-height: 1.5;">
                Consulta facturada en
                {{ boletaConsulta.serie }}-{{ String(boletaConsulta.numero).padStart(8,'0') }}
                (S/ 50.00)
              </div>
            </v-card-text>
          </v-card>

          <!-- Acciones: emitir + notificar -->
          <v-card flat class="cobro-card">
            <v-card-text>

              <!-- Botón de volver -->
              <v-btn
                block
                variant="text"
                class="mb-3"
                prepend-icon="mdi-arrow-left"
                @click="paso = 1"
              >
                Volver a datos del paciente
              </v-btn>

              <!-- Emitir boleta procedimiento -->
              <v-btn
                block
                color="primary"
                variant="elevated"
                class="mb-3"
                :loading="emitiendoProcedimiento"
                :disabled="!itemsProcedimiento.length || !!boletaProcedimiento"
                prepend-icon="mdi-send"
                @click="emitirBoletaProcedimiento"
              >
                Emitir Boleta de Procedimiento
              </v-btn>

              <!-- Boleta de consulta manual (opcional) -->
              <v-btn
                v-if="!boletaConsulta"
                block
                variant="outlined"
                color="amber-darken-3"
                class="mb-3"
                size="small"
                prepend-icon="mdi-receipt"
                @click="showDialogConsulta = true"
              >
                Emitir boleta consulta S/50 (manual)
              </v-btn>
              <div v-else class="success-mini mb-3">
                <v-icon icon="mdi-check-circle" color="success" size="20" />
                <div style="flex: 1; font-size: 0.8rem;">
                  Consulta: {{ boletaConsulta.serie }}-{{ String(boletaConsulta.numero).padStart(8, '0') }}
                </div>
                <v-btn
                  v-if="boletaConsulta.enlace_pdf"
                  size="x-small"
                  color="red"
                  variant="elevated"
                  icon="mdi-file-pdf-box"
                  :href="boletaConsulta.enlace_pdf"
                  target="_blank"
                />
              </div>

              <!-- Resultado de emisión procedimiento -->
              <template v-if="boletaProcedimiento">
                <div class="success-mini mb-3">
                  <v-icon icon="mdi-check-circle" color="success" size="28" />
                  <div style="flex: 1;">
                    <div class="success-label">Boleta emitida</div>
                    <div class="success-numero">
                      {{ boletaProcedimiento.serie }}-{{ String(boletaProcedimiento.numero).padStart(8,'0') }}
                    </div>
                  </div>
                  <v-btn
                    v-if="boletaProcedimiento.enlace_pdf"
                    size="x-small"
                    color="red"
                    variant="elevated"
                    prepend-icon="mdi-file-pdf-box"
                    :href="boletaProcedimiento.enlace_pdf"
                    target="_blank"
                  >
                    PDF
                  </v-btn>
                </div>

                <!-- Enviar por correo -->
                <v-btn
                  v-if="paciente.email"
                  block
                  variant="outlined"
                  color="purple"
                  class="mb-2"
                  :loading="enviandoEmail"
                  :disabled="emailEnviado"
                  prepend-icon="mdi-email-fast"
                  @click="enviarEmail"
                >
                  {{ emailEnviado ? 'Email enviado' : 'Enviar boleta por correo' }}
                </v-btn>
                <div v-else class="text-caption mb-2" style="opacity: 0.55;">
                  <v-icon icon="mdi-email-off" size="13" class="me-1" />
                  Sin email registrado
                </div>

                <!-- Enviar por WhatsApp -->
                <v-btn
                  v-if="paciente.telefono"
                  block
                  variant="outlined"
                  color="success"
                  :loading="enviandoWhatsApp"
                  :disabled="whatsappEnviado"
                  prepend-icon="mdi-whatsapp"
                  @click="enviarWhatsApp"
                >
                  {{ whatsappEnviado ? 'WhatsApp enviado' : 'Enviar boleta por WhatsApp' }}
                </v-btn>
                <div v-else class="text-caption" style="opacity: 0.55;">
                  <v-icon icon="mdi-whatsapp" size="13" class="me-1" />
                  Sin teléfono registrado
                </div>

                <v-alert v-if="errorNotificacion" type="error" variant="tonal" density="compact" class="mt-2">
                  {{ errorNotificacion }}
                </v-alert>
              </template>

              <v-alert v-if="errorProcedimiento" type="error" variant="tonal" density="compact" class="mt-2">
                {{ errorProcedimiento }}
              </v-alert>
            </v-card-text>
          </v-card>

        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         DIALOG: BOLETA CONSULTA MANUAL (opcional)
    ═══════════════════════════════════════════════════════ -->
    <v-dialog v-model="showDialogConsulta" max-width="500" persistent>
      <v-card>
        <v-card-title class="d-flex align-center" style="gap: 0.5rem;">
          <v-icon icon="mdi-receipt" color="amber-darken-3" />
          Boleta de Consulta (Manual)
        </v-card-title>

        <v-card-text>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            Esta boleta normalmente se genera <strong>automáticamente</strong> al agendar la cita.
            Solo emitila manualmente si el automático no funcionó.
          </v-alert>

          <div class="boleta-preview">
            <div class="boleta-preview-header">BOLETA DE VENTA ELECTRÓNICA</div>
            <div class="boleta-field">
              <span class="boleta-label">Paciente</span>
              <strong>{{ nombreCompleto }}</strong>
            </div>
            <div class="boleta-field" v-if="paciente.doc_numero">
              <span class="boleta-label">Documento</span>
              {{ paciente.doc_tipo === 1 ? 'DNI' : 'Doc.' }} {{ paciente.doc_numero }}
            </div>
            <div class="boleta-field">
              <span class="boleta-label">Concepto</span>
              Consulta Médica (SKU: CON-001)
            </div>
            <div class="boleta-field boleta-total">
              <span class="boleta-label">TOTAL</span>
              <strong style="font-size: 1.3rem; color: var(--primary, #6366f1);">S/ 50.00</strong>
            </div>
          </div>

          <v-alert v-if="errorConsulta" type="error" variant="tonal" density="compact" class="mt-3">
            {{ errorConsulta }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-btn variant="text" @click="showDialogConsulta = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn
            color="amber-darken-3"
            variant="elevated"
            :loading="emitiendoConsulta"
            prepend-icon="mdi-send"
            @click="emitirBoletaConsulta"
          >
            Emitir Boleta S/ 50
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()

/* ═══════════════════════════════════════════════════════════
   ESTADO
═══════════════════════════════════════════════════════════ */
const paso = ref(1)
const sinCita = ref(false)

// Citas
const citasHoy      = ref<any[]>([])
const citaSeleccionada = ref<any>(null)
const loadingCitas  = ref(false)

// Paciente
const paciente = ref({
  nombre:     '',
  apellido:   '',
  doc_tipo:   '-' as string | number,
  doc_numero: '',
  email:      '',
  telefono:   '',
  event_id:   null as number | null
})

// Boleta consulta (dialog manual)
const showDialogConsulta = ref(false)
const boletaConsulta   = ref<any>(null)
const emitiendoConsulta = ref(false)
const errorConsulta    = ref('')

// Catálogo y procedimientos
const catalogoProcedimientos = ref<any[]>([])
const loadingCatalogo        = ref(false)
const itemsProcedimiento     = ref<any[]>([])
const menuCatalogo           = ref(false)
const buscarProcedimiento    = ref('')

// Boleta procedimiento
const boletaProcedimiento   = ref<any>(null)
const emitiendoProcedimiento = ref(false)
const errorProcedimiento    = ref('')

// Notificaciones
const enviandoEmail  = ref(false)
const emailEnviado   = ref(false)
const enviandoWhatsApp = ref(false)
const whatsappEnviado  = ref(false)
const errorNotificacion = ref('')

/* ═══════════════════════════════════════════════════════════
   COMPUTED
═══════════════════════════════════════════════════════════ */
const nombreCompleto = computed(() =>
  [paciente.value.nombre, paciente.value.apellido].filter(Boolean).join(' ').trim() || 'CONSUMIDOR FINAL'
)

const fechaHoyISO = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

// Suma de valor_unitario (sin IGV) de todos los procedimientos
const subtotalProcValorUnit = computed(() =>
  itemsProcedimiento.value.reduce((s, it) => s + Number(it.valor_unitario), 0)
)

// Descuento: 50/1.18 en valor_unitario, equivale a S/50 en total
const DESCUENTO_PRETAX = +(50 / 1.18).toFixed(2)  // 42.37

// Base gravada post-descuento
const totalGravadaProc = computed(() =>
  Math.max(0, +(subtotalProcValorUnit.value - DESCUENTO_PRETAX).toFixed(2))
)

const totalIgvProc = computed(() =>
  +(totalGravadaProc.value * 0.18).toFixed(2)
)

// Total final del procedimiento con IGV y con descuento aplicado
const totalProcConIgv = computed(() =>
  +(totalGravadaProc.value + totalIgvProc.value).toFixed(2)
)

const procedimientosFiltrados = computed(() => {
  const q = buscarProcedimiento.value.toLowerCase()
  return catalogoProcedimientos.value.filter(p =>
    !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  )
})

const procedimientosPorGrupo = computed(() => {
  const grupos: Record<string, any[]> = {}
  for (const p of procedimientosFiltrados.value) {
    const g = p.grupo || 'General'
    if (!grupos[g]) grupos[g] = []
    grupos[g].push(p)
  }
  return grupos
})

/* ═══════════════════════════════════════════════════════════
   CONSTANTES / HELPERS
═══════════════════════════════════════════════════════════ */
const tiposDoc = [
  { value: '-', label: 'Consumidor Final' },
  { value: 1,   label: 'DNI' },
  { value: 6,   label: 'RUC' },
  { value: 4,   label: 'Carnet Extranjería' },
  { value: 7,   label: 'Pasaporte' }
]

// Muestra el precio total con IGV (precio en BD es valor_unitario sin IGV)
const formatPrecioTotal = (valorUnitario: number) =>
  Number(Number(valorUnitario) * 1.18).toLocaleString('es-PE', { minimumFractionDigits: 2 })

const formatNum = (n: number) =>
  Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })

const citaLabel = (c: any) =>
  c ? `${(c.time || '').substring(0, 5)} · ${c.client_name || ''} ${c.client_surname || ''} · ${c.subject || ''}` : ''

/* ═══════════════════════════════════════════════════════════
   CARGA DE DATOS
═══════════════════════════════════════════════════════════ */
const cargarCitasHoy = async () => {
  loadingCitas.value = true
  try {
    const isoDate = fechaHoyISO.value

    // Auto-sync GCal → Supabase (silencioso, no bloquea si falla)
    try {
      await $fetch('/api/healup/gcal-auto-sync', {
        method: 'POST',
        body: { date: isoDate }
      })
    } catch (syncErr: any) {
      console.warn('[CobroAtencion] Auto-sync GCal omitido:', syncErr?.message)
    }

    // Cargar citas desde Supabase (fuente única de verdad)
    const [y, m, d] = isoDate.split('-')
    const ddmmyyyy = `${d}-${m}-${y}`

    const { data, error } = await supabase
      .from('healup_calendar_events')
      .select('id, date, time, subject, client_name, client_surname, client_dni, client_phone, client_email, procedure_id')
      .or(`date.eq.${isoDate},date.eq.${ddmmyyyy}`)
      .order('time', { ascending: true })
    if (error) throw error
    citasHoy.value = data || []
  } catch (e: any) {
    console.error('[CobroAtencion] Error cargando citas:', e?.message)
  } finally {
    loadingCitas.value = false
  }
}

const cargarCatalogo = async () => {
  if (catalogoProcedimientos.value.length > 0) return
  loadingCatalogo.value = true
  try {
    // Query con select('*') para ser resiliente a columnas que aún no existan (sku, grupo, tipo)
    let query = supabase
      .from('healup_procedures')
      .select('*')
      .order('name')
    const { data, error } = await query
    if (error) throw error
    // Filtrar consulta client-side (la columna tipo puede no existir aún)
    catalogoProcedimientos.value = (data || []).filter((p: any) => p.tipo !== 'consulta')
  } catch (e: any) {
    console.error('[CobroAtencion] Error cargando catálogo:', e?.message)
  } finally {
    loadingCatalogo.value = false
  }
}

/* ═══════════════════════════════════════════════════════════
   LÓGICA DE SELECCIÓN DE CITA
═══════════════════════════════════════════════════════════ */
const onSeleccionarCita = async (cita: any) => {
  if (!cita) {
    paciente.value = { nombre: '', apellido: '', doc_tipo: '-', doc_numero: '', email: '', telefono: '', event_id: null }
    itemsProcedimiento.value = []
    return
  }
  paciente.value.nombre     = cita.client_name    || ''
  paciente.value.apellido   = cita.client_surname || ''
  paciente.value.doc_numero = cita.client_dni     || ''
  paciente.value.doc_tipo   = cita.client_dni     ? 1 : '-'
  paciente.value.telefono   = cita.client_phone   || ''
  paciente.value.email      = cita.client_email   || ''
  paciente.value.event_id   = cita.id

  // Pre-cargar procedimiento de la cita
  await cargarCatalogo()
  itemsProcedimiento.value = []

  // procedure_id puede ser: ID numérico, ID como string ("25"), nombre texto, o null
  const procId = cita.procedure_id
  if (procId && String(procId).trim()) {
    const raw = String(procId).trim()
    let proc = null

    // Helper: normaliza texto para comparar (quita tildes, espacios, %, #, números sueltos)
    const normalize = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
      .replace(/[^a-z]/g, '')  // solo letras

    // 1) Intentar como ID numérico (ej: 4, "25", "48")
    const asNum = Number(raw)
    if (!isNaN(asNum) && asNum > 0) {
      proc = catalogoProcedimientos.value.find((p: any) => p.id === asNum)
    }

    // 2) Buscar por nombre exacto o contenido parcial
    if (!proc) {
      const procLower = raw.toLowerCase().replace(/\s+/g, ' ')
      proc = catalogoProcedimientos.value.find((p: any) => {
        const nameLower = p.name.toLowerCase().trim().replace(/\s+/g, ' ')
        return nameLower === procLower
          || nameLower.includes(procLower)
          || procLower.includes(nameLower)
      })
    }

    // 3) Buscar normalizado (sin tildes, sin espacios, sin caracteres especiales)
    //    Cubre: "ArmonizacionFacial" vs "reserva armonizacion"
    //           "BotoxFullFace" vs "Botox full face"
    //           "GlassSkinBabe" vs "Facial Glass Skin Babe"
    if (!proc) {
      const normInput = normalize(raw)
      proc = catalogoProcedimientos.value.find((p: any) => {
        const normName = normalize(p.name)
        return normName.includes(normInput) || normInput.includes(normName)
      })
    }

    // 4) Buscar por SKU (ej: "PROC-001" legacy, o SKUs reales)
    if (!proc) {
      proc = catalogoProcedimientos.value.find((p: any) =>
        (p.sku || '').toLowerCase().trim() === raw.toLowerCase()
      )
    }

    if (proc) {
      agregarProcedimiento(proc)
    }
  }
}

const agregarProcedimiento = (proc: any) => {
  // Evitar duplicados
  if (itemsProcedimiento.value.find(it => it.id === proc.id)) {
    menuCatalogo.value = false
    return
  }
  itemsProcedimiento.value.push({
    id:             proc.id,
    name:           proc.name,
    sku:            proc.sku || '',
    valor_unitario: Number(proc.price) || 0,
    tipo_de_igv:    1
  })
  menuCatalogo.value = false
  buscarProcedimiento.value = ''
}

/* ═══════════════════════════════════════════════════════════
   NÚMERO DE BOLETA
═══════════════════════════════════════════════════════════ */
const getNextNumero = async (): Promise<number> => {
  const { data } = await supabase
    .from('comprobantes_pse')
    .select('numero')
    .eq('company_id', 'healup')
    .eq('tipo_de_comprobante', 2)
    .eq('serie', 'B001')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.numero || 0) + 1
}

/* ═══════════════════════════════════════════════════════════
   HELPER: CALCULAR CAMPOS DE UN ÍTEM NubeFact
═══════════════════════════════════════════════════════════ */
const calcItemNubefact = (valorUnitario: number, cantidad = 1, tipoIgv = 1, descuento = 0) => {
  const IGV = 0.18
  const esGravado = (tipoIgv >= 1 && tipoIgv <= 7) || tipoIgv === 16
  const base         = +(cantidad * valorUnitario).toFixed(2)
  const subtotal     = +(base - descuento).toFixed(2)
  const igv          = esGravado ? +(subtotal * IGV).toFixed(2) : 0
  const total        = +(subtotal + igv).toFixed(2)
  const precioUnit   = +(valorUnitario * (esGravado ? 1 + IGV : 1)).toFixed(6)
  return { subtotal, igv, total, precio_unitario: precioUnit }
}

/* ═══════════════════════════════════════════════════════════
   EMITIR BOLETA DE CONSULTA (S/ 50.00) — MANUAL / OPCIONAL
═══════════════════════════════════════════════════════════ */
const emitirBoletaConsulta = async () => {
  emitiendoConsulta.value = true
  errorConsulta.value     = ''
  try {
    const numero = await getNextNumero()
    const cu     = calcItemNubefact(42.37, 1, 1)  // valor_unitario = 50/1.18

    const payload = {
      tipo_de_comprobante:         2,
      serie:                       'B001',
      numero,
      fecha_de_emision:            fechaHoyISO.value,
      moneda:                      1,
      sunat_transaction:           1,
      porcentaje_de_igv:           18.00,
      formato_de_pdf:              'A4',
      cliente_tipo_de_documento:   paciente.value.doc_tipo,
      cliente_numero_de_documento: paciente.value.doc_numero || '00000000',
      cliente_denominacion:        nombreCompleto.value,
      cliente_email:               paciente.value.email || '',
      total_gravada:               42.37,
      total_igv:                   cu.igv,
      total:                       50.00,
      items: [{
        unidad_de_medida: 'ZZ',
        codigo:           'CON-001',
        descripcion:      'Consulta Médica',
        cantidad:         1,
        valor_unitario:   42.37,
        precio_unitario:  cu.precio_unitario,
        tipo_de_igv:      1,
        subtotal:         cu.subtotal,
        igv:              cu.igv,
        total:            cu.total
      }]
    }

    const resp: any = await $fetch('/api/pse/factura', {
      method: 'POST',
      body: { company_id: 'healup', payload }
    })

    boletaConsulta.value = {
      serie:          'B001',
      numero,
      total:          50.00,
      comprobante_id: resp?.comprobante_id,
      enlace_pdf:     resp?.enlace_del_pdf,
      enlace:         resp?.enlace,
      enlace_xml:     resp?.enlace_del_xml
    }

    // Trazabilidad en el evento de calendario
    if (paciente.value.event_id) {
      await supabase.from('healup_calendar_events').update({
        boleta_consulta_serie:  'B001',
        boleta_consulta_numero: numero,
        boleta_consulta_id:     resp?.comprobante_id || null
      }).eq('id', paciente.value.event_id)
    }

    showDialogConsulta.value = false

  } catch (err: any) {
    errorConsulta.value = err?.statusMessage || err?.message || 'Error al emitir la boleta de consulta'
  } finally {
    emitiendoConsulta.value = false
  }
}

/* ═══════════════════════════════════════════════════════════
   EMITIR BOLETA DE PROCEDIMIENTO
═══════════════════════════════════════════════════════════ */
const emitirBoletaProcedimiento = async () => {
  if (!itemsProcedimiento.value.length) return
  emitiendoProcedimiento.value = true
  errorProcedimiento.value     = ''

  try {
    const numero = await getNextNumero()

    // Construir ítems NubeFact
    const items = itemsProcedimiento.value.map(it => {
      const calc = calcItemNubefact(it.valor_unitario, 1, it.tipo_de_igv)
      return {
        unidad_de_medida: 'ZZ',
        codigo:           it.sku || '',
        descripcion:      it.name,
        cantidad:         1,
        valor_unitario:   it.valor_unitario,
        precio_unitario:  calc.precio_unitario,
        tipo_de_igv:      it.tipo_de_igv,
        subtotal:         calc.subtotal,
        igv:              calc.igv,
        total:            calc.total
      }
    })

    // Aplicar descuento global de S/50 (pre-IGV = 42.37)
    const totalGravada = totalGravadaProc.value
    const totalIgv     = totalIgvProc.value
    const total        = totalProcConIgv.value

    const observaciones = boletaConsulta.value
      ? `Descuento S/ 50.00 por consulta médica previa (${boletaConsulta.value.serie}-${String(boletaConsulta.value.numero).padStart(8,'0')})`
      : 'Descuento S/ 50.00 por consulta médica previa'

    const payload = {
      tipo_de_comprobante:         2,
      serie:                       'B001',
      numero,
      fecha_de_emision:            fechaHoyISO.value,
      moneda:                      1,
      sunat_transaction:           1,
      porcentaje_de_igv:           18.00,
      formato_de_pdf:              'A4',
      cliente_tipo_de_documento:   paciente.value.doc_tipo,
      cliente_numero_de_documento: paciente.value.doc_numero || '00000000',
      cliente_denominacion:        nombreCompleto.value,
      cliente_email:               paciente.value.email || '',
      descuento_global:            DESCUENTO_PRETAX,
      total_descuento:             DESCUENTO_PRETAX,
      total_gravada:               totalGravada,
      total_igv:                   totalIgv,
      total,
      observaciones,
      items
    }

    const resp: any = await $fetch('/api/pse/factura', {
      method: 'POST',
      body: { company_id: 'healup', payload }
    })

    boletaProcedimiento.value = {
      serie:          'B001',
      numero,
      total,
      comprobante_id: resp?.comprobante_id,
      enlace_pdf:     resp?.enlace_del_pdf,
      enlace:         resp?.enlace,
      enlace_xml:     resp?.enlace_del_xml
    }

    // Trazabilidad
    if (paciente.value.event_id) {
      await supabase.from('healup_calendar_events').update({
        boleta_proc_serie:  'B001',
        boleta_proc_numero: numero,
        boleta_proc_id:     resp?.comprobante_id || null,
        cobro_completado:   true
      }).eq('id', paciente.value.event_id)
    }

  } catch (err: any) {
    errorProcedimiento.value = err?.statusMessage || err?.message || 'Error al emitir la boleta de procedimiento'
  } finally {
    emitiendoProcedimiento.value = false
  }
}

/* ═══════════════════════════════════════════════════════════
   ENVIAR POR CORREO
═══════════════════════════════════════════════════════════ */
const enviarEmail = async () => {
  if (!paciente.value.email || !boletaProcedimiento.value) return
  enviandoEmail.value = true
  errorNotificacion.value = ''
  try {
    await $fetch('/api/pse/enviar-correo', {
      method: 'POST',
      body: {
        company_id:           'healup',
        comprobante_id:       boletaProcedimiento.value.comprobante_id,
        to:                   paciente.value.email,
        tipo_de_comprobante:  2,
        serie:                boletaProcedimiento.value.serie,
        numero:               boletaProcedimiento.value.numero,
        cliente_denominacion: nombreCompleto.value,
        total:                boletaProcedimiento.value.total,
        moneda:               1,
        enlace:               boletaProcedimiento.value.enlace     || '',
        enlace_del_pdf:       boletaProcedimiento.value.enlace_pdf || '',
        enlace_del_xml:       boletaProcedimiento.value.enlace_xml || ''
      }
    })
    emailEnviado.value = true
  } catch (err: any) {
    errorNotificacion.value = err?.statusMessage || 'Error al enviar correo'
  } finally {
    enviandoEmail.value = false
  }
}

/* ═══════════════════════════════════════════════════════════
   ENVIAR POR WHATSAPP
═══════════════════════════════════════════════════════════ */
const enviarWhatsApp = async () => {
  if (!paciente.value.telefono || !boletaProcedimiento.value) return
  enviandoWhatsApp.value = true
  errorNotificacion.value = ''
  try {
    await $fetch('/api/healup/enviar-whatsapp', {
      method: 'POST',
      body: {
        phone:         paciente.value.telefono,
        patient_name:  nombreCompleto.value,
        boleta_serie:  boletaProcedimiento.value.serie,
        boleta_numero: boletaProcedimiento.value.numero,
        total:         boletaProcedimiento.value.total,
        tipo:          'procedimiento',
        pdf_url:       boletaProcedimiento.value.enlace_pdf || null,
        enlace:        boletaProcedimiento.value.enlace     || null
      }
    })
    whatsappEnviado.value = true
  } catch (err: any) {
    errorNotificacion.value = err?.statusMessage || 'Error al enviar WhatsApp'
  } finally {
    enviandoWhatsApp.value = false
  }
}

/* ═══════════════════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════════════════ */
const resetFlujo = () => {
  paso.value             = 1
  sinCita.value          = false
  citaSeleccionada.value = null
  paciente.value         = { nombre: '', apellido: '', doc_tipo: '-', doc_numero: '', email: '', telefono: '', event_id: null }
  boletaConsulta.value      = null
  boletaProcedimiento.value = null
  itemsProcedimiento.value  = []
  buscarProcedimiento.value = ''
  errorConsulta.value       = ''
  errorProcedimiento.value  = ''
  errorNotificacion.value   = ''
  emailEnviado.value        = false
  whatsappEnviado.value     = false
  showDialogConsulta.value  = false
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
onMounted(async () => {
  await Promise.all([cargarCitasHoy(), cargarCatalogo()])
})
</script>

<style scoped>
.cobro-atencion { padding: 0; }

/* Steps bar */
.steps-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--border, #e5e7eb);
  color: var(--text-secondary, #6b7280);
  flex-shrink: 0;
  transition: background 0.2s;
}
.step-dot.active { background: #6366f1; color: #fff; }
.step-dot.done   { background: #22c55e; color: #fff; }
.step-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  margin-left: 2px;
}

/* Cards */
.cobro-card {
  border: 1px solid var(--border, #e5e7eb) !important;
  border-radius: 10px !important;
}
.cobro-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.field-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
  margin-bottom: 0.5rem;
}

/* Boleta preview */
.boleta-preview {
  background: var(--surface, #f9fafb);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}
.boleta-preview-header {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  margin-bottom: 0.75rem;
}
.boleta-field {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  padding: 0.25rem 0;
  font-size: 0.9rem;
}
.boleta-label {
  opacity: 0.55;
  min-width: 90px;
  font-size: 0.82rem;
}
.boleta-total {
  border-top: 1px solid var(--border, #e5e7eb);
  margin-top: 0.5rem;
  padding-top: 0.75rem;
}

/* Success mini */
.success-mini {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.success-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #166534;
  margin-bottom: 2px;
}
.success-numero {
  font-size: 1rem;
  font-weight: 700;
  color: #166534;
}

/* Paso 2 grid (was paso 3) */
.paso3-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 1.5rem;
}
.paso3-side { display: flex; flex-direction: column; }

@media (max-width: 900px) {
  .paso3-grid { grid-template-columns: 1fr; }
}

/* Filas de procedimientos */
.proc-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.proc-row:last-child { border-bottom: none; }
.proc-info { flex: 1; min-width: 0; }
.proc-name { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.proc-meta { margin-top: 2px; }
.proc-precio { font-size: 0.9rem; font-weight: 700; white-space: nowrap; }

/* Resumen totales */
.resumen-fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.88rem;
}
.resumen-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  opacity: 0.8;
}
.resumen-descuento {
  color: #ef4444;
  font-size: 0.85rem;
}
.resumen-total {
  font-size: 1rem;
  font-weight: 700;
  color: #6366f1;
}
</style>
