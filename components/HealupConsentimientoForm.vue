<template>
  <div class="consentimiento-shell">

    <!-- Header con wordmark -->
    <header class="consentimiento-header">
      <div class="brand-block">
        <div class="brand-icon"><v-icon icon="mdi-heart-pulse" size="32" color="primary" /></div>
        <div class="brand-text">
          <h1>HEAL UP</h1>
          <span class="brand-tag">AESTHETICS LAB</span>
        </div>
      </div>
      <div class="page-meta">
        <v-chip color="primary" variant="flat" size="small">1 de 1</v-chip>
      </div>
    </header>

    <!-- ===== PASO 1 · DATOS DEL PACIENTE — modos: select / new / existing ===== -->

    <!-- MODO SELECTOR (default): 2 tiles grandes para tablet -->
    <v-card v-if="modoSeleccion === 'select'" class="step-card" elevation="0">
      <div class="step-header">
        <span class="step-num">1</span>
        <div>
          <h3>¿Es tu primera vez en Heal Up?</h3>
          <p>Selecciona la opción que corresponde</p>
        </div>
      </div>

      <div class="mode-tiles">
        <button class="mode-tile new-tile" @click="setMode('new')">
          <v-icon icon="mdi-account-plus" size="56" color="primary" />
          <div class="tile-title">Paciente nuevo</div>
          <div class="tile-desc">Es mi primera vez · llenaré mis datos</div>
          <v-icon class="tile-arrow" icon="mdi-arrow-right" size="22" />
        </button>

        <button class="mode-tile existing-tile" @click="setMode('existing')">
          <v-icon icon="mdi-account-search" size="56" color="primary" />
          <div class="tile-title">Paciente existente</div>
          <div class="tile-desc">Ya tengo historia · buscar por nombre o DNI</div>
          <v-icon class="tile-arrow" icon="mdi-arrow-right" size="22" />
        </button>
      </div>
    </v-card>

    <!-- MODO PACIENTE NUEVO: form grande, sin autocomplete -->
    <v-card v-else-if="modoSeleccion === 'new'" class="step-card patient-form-card" elevation="0">
      <div class="step-header">
        <span class="step-num">1</span>
        <div style="flex:1;">
          <h3>Nuevo paciente · Llene sus datos</h3>
          <p>Estos datos quedarán registrados en su historia clínica</p>
        </div>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-arrow-left"
          @click="setMode('select')"
        >Cambiar</v-btn>
      </div>

      <v-row class="form-row form-row-large">
        <v-col cols="12">
          <v-text-field
            v-model="form.nombre_completo"
            label="Nombre completo *"
            placeholder="Ej. María González Pérez"
            variant="outlined"
            density="comfortable"
            :rules="[required]"
            autocomplete="name"
            required
          />
        </v-col>
      </v-row>

      <v-row class="form-row form-row-large">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.dni"
            label="DNI *"
            placeholder="Ej. 12345678"
            variant="outlined"
            density="comfortable"
            inputmode="numeric"
            maxlength="12"
            :rules="[required]"
            required
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.telefono"
            label="Teléfono / WhatsApp"
            placeholder="Ej. 999 888 777"
            variant="outlined"
            density="comfortable"
            inputmode="tel"
            autocomplete="tel"
          />
        </v-col>
      </v-row>

      <v-row class="form-row form-row-large">
        <v-col cols="6" md="3">
          <v-text-field
            v-model.number="form.edad"
            label="Edad *"
            type="number"
            variant="outlined"
            density="comfortable"
            min="0"
            max="120"
            :rules="[required]"
            required
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-select
            v-model="form.txp"
            :items="[{title:'Sí', value:true},{title:'No', value:false}]"
            label="TXP"
            variant="outlined"
            density="comfortable"
            hint="Tratamiento previo"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="form.fecha"
            label="Fecha *"
            type="date"
            variant="outlined"
            density="comfortable"
            :rules="[required]"
            required
          />
        </v-col>
      </v-row>

      <!-- ¿Cómo nos conoció? — canal de adquisición (marketing) -->
      <v-row class="form-row form-row-large">
        <v-col cols="12" :md="form.como_nos_conocio === 'Otro' ? 6 : 12">
          <v-select
            v-model="form.como_nos_conocio"
            :items="canalesAdquisicion"
            label="¿Cómo nos conoció?"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-help-circle-outline"
            hint="Esto nos ayuda a mejorar la experiencia"
            persistent-hint
          />
        </v-col>
        <v-col v-if="form.como_nos_conocio === 'Otro'" cols="12" md="6">
          <v-text-field
            v-model="form.como_nos_conocio_detalle"
            label="¿Cómo? · especifique"
            variant="outlined"
            density="comfortable"
            placeholder="Ej. Folleto en clínica, evento, podcast…"
            autofocus
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- MODO PACIENTE EXISTENTE: autocomplete + form pre-llenado editable -->
    <v-card v-else-if="modoSeleccion === 'existing'" class="step-card" elevation="0">
      <div class="step-header">
        <span class="step-num">1</span>
        <div style="flex:1;">
          <h3>Paciente existente</h3>
          <p>Buscar por nombre, DNI o teléfono</p>
        </div>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-arrow-left"
          @click="setMode('select')"
        >Cambiar</v-btn>
      </div>

      <v-autocomplete
        v-model="pacienteSeleccionado"
        :items="pacientesDisponibles"
        :loading="loadingPacientes"
        item-title="display_name"
        item-value="id_combo"
        label="Buscar paciente por nombre, DNI o teléfono…"
        variant="outlined"
        density="comfortable"
        clearable
        return-object
        @update:model-value="onPacienteSelect"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :title="item.raw.display_name" :subtitle="item.raw.subtitle">
            <template v-slot:prepend>
              <v-icon :icon="item.raw.origen === 'wpp' ? 'mdi-whatsapp' : 'mdi-instagram'" size="20"
                      :color="item.raw.origen === 'wpp' ? 'success' : 'pink'" />
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>

      <!-- Una vez seleccionado, mostrar el form pre-llenado para editar -->
      <div v-if="pacienteSeleccionado">
        <v-divider class="my-4" />
        <p class="text-caption text-medium-emphasis mb-3">
          Verifique y complete los datos del paciente seleccionado
        </p>

        <v-row class="form-row">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.nombre_completo"
              label="Nombre completo *"
              variant="outlined"
              density="comfortable"
              :rules="[required]"
              required
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-text-field
              v-model.number="form.edad"
              label="Edad *"
              type="number"
              variant="outlined"
              density="comfortable"
              min="0"
              max="120"
              :rules="[required]"
              required
            />
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="form.txp"
              :items="[{title:'Sí', value:true},{title:'No', value:false}]"
              label="TXP"
              variant="outlined"
              density="comfortable"
              hint="Tratamiento previo"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="form.fecha"
              label="Fecha *"
              type="date"
              variant="outlined"
              density="comfortable"
              :rules="[required]"
              required
            />
          </v-col>
        </v-row>

        <v-row class="form-row">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.dni"
              label="DNI *"
              variant="outlined"
              density="comfortable"
              maxlength="12"
              :rules="[required]"
              required
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.telefono"
              label="Teléfono"
              variant="outlined"
              density="comfortable"
            />
          </v-col>
        </v-row>
      </div>
    </v-card>

    <!-- Texto del consentimiento (solo si ya se eligió tipo de paciente) -->
    <v-card v-if="modoSeleccion !== 'select'" class="step-card" elevation="0">
      <div class="step-header">
        <span class="step-num">2</span>
        <div>
          <h3>Consentimiento informado · Ácido Hialurónico</h3>
          <p>Lea atentamente antes de firmar</p>
        </div>
      </div>

      <div class="consentimiento-body">
        <h4>CONSENTIMIENTO INFORMADO</h4>
        <p>
          El Ácido Hialurónico (AH) es una sustancia que está presente en nuestra piel de manera natural.
          Su función es la de retener agua e hidratar la piel produciendo un efecto de relleno y dando
          volumen a los tejidos.
        </p>
        <p>
          Los tratamientos con ácido hialurónico buscan producir diferentes efectos estéticos en
          nuestro rostro utilizándolo como filler. Como el tratamiento por realizar Tx:
          <span class="form-inline">
            <input
              type="text"
              v-model="form.tx_realizar"
              placeholder="(describir tratamiento)"
              class="inline-input"
            />
          </span>.
        </p>

        <h4>RIESGOS</h4>
        <p>
          Como todo tratamiento estético existen riesgos como hematoma, edema que son completamente
          normales. Sin embargo existe el riesgo de necrosis cutánea la cual es poco frecuente y
          100% reversible.
        </p>

        <h4>COMPROMISO</h4>
        <p>
          La empresa como tal se compromete a resolver cualquiera de estas complicaciones al 100%
          haciéndose cargo en el proceso de recuperación del paciente si es que esta mantiene el
          compromiso de acudir a nosotros para su solución. Por otro lado, si el paciente acude
          a otro centro médico la empresa deja de hacerse cargo de lo anteriormente mencionado.
        </p>

        <h4>DATOS</h4>
        <p>
          Yo <strong class="datum">{{ form.nombre_completo || '__________________' }}</strong>
          de DNI <strong class="datum">{{ form.dni || '__________' }}</strong>
          acepto los términos y condiciones del tratamiento tomando en cuenta los riesgos
          mencionados.
        </p>

        <v-checkbox
          v-model="form.consentimiento_aceptado"
          color="primary"
          density="comfortable"
          class="consent-check"
        >
          <template v-slot:label>
            <span class="check-label">
              He leído y acepto los términos del consentimiento informado
            </span>
          </template>
        </v-checkbox>
      </div>
    </v-card>

    <!-- Firmas (solo si ya se eligió tipo de paciente) -->
    <v-card v-if="modoSeleccion !== 'select'" class="step-card" elevation="0">
      <div class="step-header">
        <span class="step-num">3</span>
        <div>
          <h3>Firmas</h3>
          <p>Paciente y doctor encargado del procedimiento</p>
        </div>
      </div>

      <v-row>
        <v-col cols="12" md="6">
          <HealupSignaturePad
            v-model="firmaPaciente"
            label="Firma del paciente a tratar"
          />
        </v-col>
        <v-col cols="12" md="6">
          <HealupSignaturePad
            v-model="firmaDoctor"
            label="Firma del doctor encargado"
          />
          <v-text-field
            v-model="form.doctor_nombre"
            label="Nombre del doctor"
            variant="outlined"
            density="comfortable"
            class="mt-3"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- Acciones finales (solo si ya se eligió tipo de paciente) -->
    <div v-if="modoSeleccion !== 'select'" class="actions-bar">
      <v-btn
        size="large"
        variant="text"
        :disabled="saving"
        @click="resetForm()"
      >Limpiar todo</v-btn>

      <v-btn
        size="large"
        color="primary"
        variant="flat"
        prepend-icon="mdi-content-save-check"
        :loading="saving"
        :disabled="!canSubmit"
        @click="submit"
      >Guardar y registrar en historia clínica</v-btn>
    </div>

    <!-- Snackbar de resultado -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useSupabaseClient } from '#imports'
import HealupSignaturePad from './HealupSignaturePad.vue'

const client = useSupabaseClient()

interface PacienteOpt {
  id_combo: string
  display_name: string
  subtitle: string
  origen: 'wpp' | 'fbig'
  raw: any
}

const emit = defineEmits<{ saved: [historiaId: number] }>()

const today = () => new Date().toISOString().slice(0, 10)
const required = (v: any) => !!v || 'Requerido'

const pacientesDisponibles = ref<PacienteOpt[]>([])
const loadingPacientes = ref(false)
const pacienteSeleccionado = ref<PacienteOpt | null>(null)

type ModoSeleccion = 'select' | 'new' | 'existing'
const modoSeleccion = ref<ModoSeleccion>('select')

function setMode(mode: ModoSeleccion) {
  modoSeleccion.value = mode
  if (mode === 'select' || mode === 'new') {
    pacienteSeleccionado.value = null
  }
  if (mode === 'new') {
    // Empezar fresh para el paciente nuevo
    Object.assign(form, {
      nombre_completo: '',
      edad: null,
      txp: null,
      fecha: today(),
      dni: '',
      telefono: '',
      tx_realizar: '',
      consentimiento_aceptado: false,
      doctor_nombre: form.doctor_nombre,  // mantener el doctor
      como_nos_conocio: '',
      como_nos_conocio_detalle: ''
    })
  }
}

const firmaPaciente = ref<string | null>(null)
const firmaDoctor = ref<string | null>(null)

const form = reactive({
  nombre_completo: '',
  edad: null as number | null,
  txp: null as boolean | null,
  fecha: today(),
  dni: '',
  telefono: '',
  tx_realizar: '',
  consentimiento_aceptado: false,
  doctor_nombre: '',
  como_nos_conocio: '' as string,
  como_nos_conocio_detalle: '' as string
})

const canalesAdquisicion = [
  'Instagram',
  'Facebook',
  'TikTok',
  'WhatsApp',
  'Google',
  'Recomendación / Amigo',
  'Pasé por la clínica',
  'YouTube',
  'Otro'
]

const saving = ref(false)
const snackbar = reactive({ show: false, color: 'success', text: '' })

const canSubmit = computed(() => {
  return form.nombre_completo.trim().length > 0
    && form.dni.trim().length >= 6
    && form.fecha
    && form.consentimiento_aceptado
    && firmaPaciente.value
    && firmaDoctor.value
})

function resetForm() {
  pacienteSeleccionado.value = null
  firmaPaciente.value = null
  firmaDoctor.value = null
  modoSeleccion.value = 'select'
  Object.assign(form, {
    nombre_completo: '',
    edad: null,
    txp: null,
    fecha: today(),
    dni: '',
    telefono: '',
    tx_realizar: '',
    consentimiento_aceptado: false,
    doctor_nombre: '',
    como_nos_conocio: '',
    como_nos_conocio_detalle: ''
  })
}

function onPacienteSelect(p: PacienteOpt | null) {
  if (!p) return
  const r = p.raw
  form.nombre_completo = r.nombre || ''
  form.dni = r.dni || ''
  form.telefono = r.numero || ''
}

async function fetchPacientes() {
  loadingPacientes.value = true
  try {
    const [{ data: wpp }, { data: fbig }] = await Promise.all([
      (client as any).from('PacientesBDwppHEALUP').select('id, nombre, dni, numero').limit(500),
      (client as any).from('PacientesBDfbigHEALUP').select('id, nombre, dni, numero, instagram_handle').limit(500)
    ])
    const opts: PacienteOpt[] = []
    for (const r of (wpp || [])) {
      opts.push({
        id_combo: `wpp:${r.id}`,
        display_name: r.nombre || '(sin nombre)',
        subtitle: `DNI ${r.dni || '—'} · ${r.numero || ''}`,
        origen: 'wpp',
        raw: r
      })
    }
    for (const r of (fbig || [])) {
      opts.push({
        id_combo: `fbig:${r.id}`,
        display_name: r.nombre || '(sin nombre)',
        subtitle: `DNI ${r.dni || '—'} · @${r.instagram_handle || ''}`,
        origen: 'fbig',
        raw: r
      })
    }
    pacientesDisponibles.value = opts
  } catch (err) {
    console.error('Error cargando pacientes:', err)
  } finally {
    loadingPacientes.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const fullName = (form.nombre_completo || '').trim()
    const sp = fullName.indexOf(' ')
    const name = sp > 0 ? fullName.substring(0, sp) : fullName
    const surname = sp > 0 ? fullName.substring(sp + 1) : ''

    const dispositivo = detectDevice()
    const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : ''

    // Combinar canal + detalle para el campo final
    const canalFinal = form.como_nos_conocio === 'Otro' && form.como_nos_conocio_detalle
      ? `Otro: ${form.como_nos_conocio_detalle.trim()}`
      : form.como_nos_conocio || null

    const consentimientoPayload = {
      titulo: 'Consentimiento Informado · Ácido Hialurónico',
      tx_realizar: form.tx_realizar,
      texto: {
        consentimiento: 'El Ácido Hialurónico (AH) es una sustancia que está presente en nuestra piel de manera natural...',
        riesgos: 'Como todo tratamiento estético existen riesgos como hematoma, edema...',
        compromiso: 'La empresa como tal se compromete a resolver cualquiera de estas complicaciones...'
      },
      datos_personales: {
        nombre_completo: form.nombre_completo,
        dni: form.dni,
        edad: form.edad,
        telefono: form.telefono,
        txp: form.txp,
        fecha: form.fecha,
        como_nos_conocio: canalFinal
      }
    }

    const payload: any = {
      name,
      surname,
      dni: form.dni,
      phone: form.telefono,
      email: '',
      date_added: form.fecha,
      attachment_name: '',
      attachment_data: '',

      edad: form.edad,
      txp: form.txp,
      tx_realizar: form.tx_realizar || null,
      doctor_nombre: form.doctor_nombre || null,

      consentimiento_aceptado: true,
      consentimiento_tipo: 'acido_hialuronico',
      consentimiento_payload: consentimientoPayload,
      consentimiento_fecha: new Date().toISOString(),

      firma_paciente: {
        url: firmaPaciente.value,
        fecha: new Date().toISOString(),
        dispositivo
      },
      firma_doctor: {
        url: firmaDoctor.value,
        fecha: new Date().toISOString(),
        nombre: form.doctor_nombre || null
      },

      dispositivo,
      user_agent: ua,
      paciente_origen: pacienteSeleccionado.value?.origen || 'manual',
      como_nos_conocio: canalFinal
    }

    const { data, error } = await (client as any)
      .from('healup_medical_history')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    // === Auto-crear registro en Pacientes si es nuevo y no existe por DNI ===
    let pacienteCreado = false
    try {
      if (modoSeleccion.value === 'new' && form.dni) {
        // Verificar duplicados en ambas tablas por DNI
        const [{ data: dupWpp }, { data: dupFbig }] = await Promise.all([
          (client as any).from('PacientesBDwppHEALUP').select('id').eq('dni', form.dni).limit(1),
          (client as any).from('PacientesBDfbigHEALUP').select('id').eq('dni', form.dni).limit(1)
        ])
        const exists = (dupWpp && dupWpp.length > 0) || (dupFbig && dupFbig.length > 0)

        if (!exists) {
          const fechaAg = form.fecha
            ? new Date(form.fecha + 'T09:00:00').toISOString()
            : new Date().toISOString()

          const pacientePayload: Record<string, any> = {
            nombre: form.nombre_completo,
            dni: form.dni,
            numero: form.telefono || '',
            precio: 0,
            precio_tratamiento: 0,
            procedimiento: form.tx_realizar || '',
            fecha_agendamiento: fechaAg,
            estado: 'Activo',
            agendamiento: 'Manual',
            metodo_de_pago: 'Ninguno'
          }

          const { error: pacError } = await (client as any)
            .from('PacientesBDwppHEALUP')
            .insert(pacientePayload)

          if (pacError) {
            console.warn('No se pudo crear paciente automáticamente:', pacError)
          } else {
            pacienteCreado = true
          }
        }
      }
    } catch (pacientErr) {
      console.warn('Error verificando/creando paciente:', pacientErr)
      // No bloqueante: el consentimiento ya está guardado
    }

    snackbar.color = 'success'
    snackbar.text = pacienteCreado
      ? 'Consentimiento firmado · paciente registrado en BD WhatsApp e historia clínica'
      : 'Consentimiento firmado y registrado en historia clínica'
    snackbar.show = true

    emit('saved', data?.id)

    setTimeout(() => resetForm(), 1500)
  } catch (err: any) {
    console.error('Error guardando consentimiento:', err)
    snackbar.color = 'error'
    snackbar.text = `Error al guardar: ${err.message || err}`
    snackbar.show = true
  } finally {
    saving.value = false
  }
}

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) return 'tablet'
  if (/mobile|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

onMounted(() => {
  fetchPacientes()
})
</script>

<style scoped>
.consentimiento-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 0;
  max-width: 1100px;
  margin: 0 auto;
}

.consentimiento-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: var(--card, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 12px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(218, 165, 32, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(218, 165, 32, 0.4);
}

.brand-text h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 300;
  letter-spacing: 0.4em;
  color: var(--foreground, #f8f8f8);
}

.brand-tag {
  font-size: 0.7rem;
  letter-spacing: 0.4em;
  color: var(--muted-foreground, #94a3b8);
  font-weight: 500;
}

.step-card {
  padding: 1.75rem;
  background: var(--card, #1a1f2a);
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(218, 165, 32, 0.22);
  border: 1.5px solid rgba(218, 165, 32, 0.45);
  color: #daa520;
  font-weight: 700;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.step-header h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--foreground, #f8f8f8);
}

.step-header p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--muted-foreground, #94a3b8);
}

.form-row {
  margin: 0 -8px;
}

/* Tiles de modo selección (paciente nuevo / existente) */
.mode-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.mode-tile {
  position: relative;
  background: linear-gradient(135deg, rgba(218, 165, 32, 0.12), rgba(218, 165, 32, 0.04));
  border: 2px solid rgba(218, 165, 32, 0.45);
  border-radius: 16px;
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  font-family: inherit;
  color: inherit;
  min-height: 220px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}

.mode-tile:hover, .mode-tile:focus-visible {
  background: linear-gradient(135deg, rgba(218, 165, 32, 0.22), rgba(218, 165, 32, 0.10));
  border-color: rgba(218, 165, 32, 0.9);
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28), 0 0 0 4px rgba(218, 165, 32, 0.08);
  outline: none;
}

.mode-tile:active {
  transform: translateY(0);
}

.mode-tile .tile-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground, #f8f8f8);
  margin-top: 0.5rem;
}

.mode-tile .tile-desc {
  font-size: 0.9rem;
  color: var(--muted-foreground, #94a3b8);
  max-width: 280px;
  line-height: 1.45;
}

.mode-tile .tile-arrow {
  position: absolute;
  bottom: 1.25rem;
  right: 1.25rem;
  opacity: 0.4;
  transition: opacity 0.2s, transform 0.2s;
}

.mode-tile:hover .tile-arrow {
  opacity: 1;
  transform: translateX(4px);
}

/* Inputs más grandes en modo paciente nuevo */
.patient-form-card .form-row-large :deep(.v-field) {
  font-size: 1.05rem;
}
.patient-form-card .form-row-large :deep(.v-field__input) {
  min-height: 52px;
  padding-top: 14px;
}
.patient-form-card .form-row-large :deep(.v-label) {
  font-size: 0.95rem;
}

@media (max-width: 768px) {
  .mode-tiles { grid-template-columns: 1fr; gap: 1rem; }
  .mode-tile { padding: 2rem 1rem; min-height: 180px; }
}

.consentimiento-body {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--foreground, #f8f8f8);
  background: rgba(255, 255, 255, 0.025);
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
  border-left: 3px solid #daa520;
}

.consentimiento-body h4 {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin: 1.5rem 0 0.6rem;
  color: #daa520;
}
.consentimiento-body h4:first-child { margin-top: 0; }

.consentimiento-body p {
  margin: 0 0 0.9rem 0;
  text-align: justify;
  color: var(--foreground, #f8f8f8);
  opacity: 0.92;
}

.consentimiento-body strong { color: #daa520; }
.consentimiento-body .datum { color: var(--foreground, #f8f8f8); }

.form-inline { display: inline-flex; align-items: center; }
.inline-input {
  border: none;
  border-bottom: 1px dashed currentColor;
  background: transparent;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  padding: 0 4px;
  min-width: 240px;
  outline: none;
}
.inline-input:focus {
  border-bottom-style: solid;
  border-color: #daa520;
}

.datum {
  display: inline-block;
  border-bottom: 1px solid currentColor;
  padding: 0 0.4em;
  min-width: 8em;
  text-align: center;
  font-weight: 600;
}

.consent-check {
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  background: rgba(218, 165, 32, 0.14);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 10px;
}

.check-label {
  font-weight: 500;
  color: var(--foreground, #f8f8f8);
}

.actions-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.75rem;
  background: var(--card, #1a1f2a);
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 14px;
  box-shadow: 0 -4px 14px rgba(0,0,0,0.3);
  backdrop-filter: blur(12px);
}

@media (max-width: 768px) {
  .consentimiento-shell { padding: 0.75rem; }
  .step-card { padding: 1rem; }
  .actions-bar { flex-direction: column; }
  .actions-bar .v-btn { width: 100%; }
}
</style>
