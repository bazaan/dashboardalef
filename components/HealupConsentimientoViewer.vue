<template>
  <v-dialog v-model="open" max-width="900" scrollable>
    <v-card v-if="historia">
      <v-card-title class="d-flex justify-space-between align-center">
        <span>
          <v-icon icon="mdi-file-document-check" color="primary" class="mr-2" />
          Consentimiento informado · Detalle
        </span>
        <v-btn icon="mdi-close" variant="text" @click="open = false" />
      </v-card-title>

      <v-divider />

      <v-card-text class="consent-detail">
        <!-- Header con identidad -->
        <div class="detail-header">
          <div class="brand-mini">
            <h2>HEAL UP</h2>
            <span>AESTHETICS LAB</span>
          </div>
          <div class="meta-block">
            <div class="meta-line">
              <span class="meta-label">Fecha</span>
              <strong>{{ formatFecha(historia.consentimiento_fecha || historia.date_added) }}</strong>
            </div>
            <div class="meta-line">
              <span class="meta-label">Tipo</span>
              <strong>{{ tipoLabel }}</strong>
            </div>
            <v-chip
              v-if="historia.consentimiento_aceptado"
              size="x-small"
              color="success"
              variant="flat"
              prepend-icon="mdi-check-circle"
            >Aceptado</v-chip>
          </div>
        </div>

        <v-divider class="my-4" />

        <!-- Datos paciente -->
        <div class="data-grid">
          <div class="data-cell">
            <span class="label">Nombre completo</span>
            <strong>{{ nombreCompleto }}</strong>
          </div>
          <div class="data-cell">
            <span class="label">DNI</span>
            <strong>{{ historia.dni || '—' }}</strong>
          </div>
          <div class="data-cell">
            <span class="label">Edad</span>
            <strong>{{ historia.edad ?? '—' }}</strong>
          </div>
          <div class="data-cell">
            <span class="label">Teléfono</span>
            <strong>{{ historia.phone || '—' }}</strong>
          </div>
          <div class="data-cell">
            <span class="label">TXP (tratamiento previo)</span>
            <strong>{{ historia.txp === true ? 'Sí' : historia.txp === false ? 'No' : '—' }}</strong>
          </div>
          <div class="data-cell">
            <span class="label">Tx por realizar</span>
            <strong>{{ historia.tx_realizar || '—' }}</strong>
          </div>
          <div v-if="historia.como_nos_conocio" class="data-cell">
            <span class="label">¿Cómo nos conoció?</span>
            <strong>{{ historia.como_nos_conocio }}</strong>
          </div>
        </div>

        <v-divider class="my-4" />

        <!-- Texto del consentimiento (snapshot) -->
        <div v-if="historia.consentimiento_payload?.texto" class="consent-text">
          <h4>Consentimiento</h4>
          <p>{{ historia.consentimiento_payload.texto.consentimiento }}</p>
          <h4>Riesgos</h4>
          <p>{{ historia.consentimiento_payload.texto.riesgos }}</p>
          <h4>Compromiso</h4>
          <p>{{ historia.consentimiento_payload.texto.compromiso }}</p>
        </div>
        <div v-else class="text-grey-darken-1 text-caption">
          Esta historia no tiene snapshot del texto. Probablemente es una entrada antigua.
        </div>

        <v-divider class="my-4" />

        <!-- Firmas -->
        <div class="signatures-grid">
          <div class="sig-block">
            <span class="sig-label">Firma del paciente a tratar</span>
            <div class="sig-img-wrap">
              <img v-if="firmaPacienteUrl" :src="firmaPacienteUrl" alt="Firma paciente" />
              <span v-else class="sig-empty">Sin firma</span>
            </div>
            <div v-if="firmaPacienteFecha" class="sig-meta">
              {{ formatFecha(firmaPacienteFecha) }} · {{ historia.dispositivo || '—' }}
            </div>
          </div>

          <div class="sig-block">
            <span class="sig-label">Firma del doctor encargado</span>
            <div class="sig-img-wrap">
              <img v-if="firmaDoctorUrl" :src="firmaDoctorUrl" alt="Firma doctor" />
              <span v-else class="sig-empty">Sin firma</span>
            </div>
            <div v-if="historia.doctor_nombre" class="sig-meta">
              {{ historia.doctor_nombre }}
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn
          v-if="firmaPacienteUrl"
          variant="text"
          prepend-icon="mdi-download"
          @click="downloadFirma('paciente')"
        >Firma paciente</v-btn>
        <v-btn
          v-if="firmaDoctorUrl"
          variant="text"
          prepend-icon="mdi-download"
          @click="downloadFirma('doctor')"
        >Firma doctor</v-btn>
        <v-spacer />
        <v-btn variant="flat" color="primary" @click="open = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  historia: any | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const nombreCompleto = computed(() => {
  if (!props.historia) return ''
  return [props.historia.name, props.historia.surname].filter(Boolean).join(' ').trim() || '—'
})

const tipoLabel = computed(() => {
  const t = props.historia?.consentimiento_tipo
  if (t === 'acido_hialuronico') return 'Ácido Hialurónico'
  return t || 'General'
})

const firmaPacienteUrl = computed(() => props.historia?.firma_paciente?.url || null)
const firmaPacienteFecha = computed(() => props.historia?.firma_paciente?.fecha || null)
const firmaDoctorUrl = computed(() => props.historia?.firma_doctor?.url || null)

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

function downloadFirma(quien: 'paciente' | 'doctor') {
  const url = quien === 'paciente' ? firmaPacienteUrl.value : firmaDoctorUrl.value
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `firma-${quien}-${nombreCompleto.value.replace(/\s+/g, '-')}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<style scoped>
.consent-detail {
  padding: 1.5rem !important;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand-mini h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 300;
  letter-spacing: 0.35em;
}

.brand-mini span {
  font-size: 0.65rem;
  letter-spacing: 0.35em;
  color: var(--muted-foreground, #94a3b8);
}

.meta-block { display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end; }

.meta-line { display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; }
.meta-label { color: var(--muted-foreground, #94a3b8); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.1em; }

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.data-cell {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.85rem 1rem;
  background: rgba(218, 165, 32, 0.10);
  border: 1px solid rgba(218, 165, 32, 0.25);
  border-radius: 8px;
}

.data-cell .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground, #94a3b8);
  font-weight: 600;
}

.data-cell strong {
  font-size: 0.95rem;
  color: var(--foreground, #f8f8f8);
}

.consent-text h4 {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #daa520;
  margin: 1rem 0 0.5rem;
}

.consent-text p {
  font-size: 0.88rem;
  line-height: 1.6;
  margin: 0 0 0.75rem;
  color: var(--foreground, currentColor);
  opacity: 0.92;
}

.signatures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.sig-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sig-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground, #94a3b8);
  font-weight: 600;
}

.sig-img-wrap {
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  border-radius: 6px;
  padding: 0.5rem;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.sig-img-wrap img {
  max-width: 100%;
  max-height: 180px;
  display: block;
}

.sig-empty {
  color: #94a3b8;
  font-size: 0.85rem;
  font-style: italic;
}

.sig-meta {
  font-size: 0.75rem;
  color: var(--muted-foreground, #94a3b8);
}

@media (max-width: 768px) {
  .signatures-grid { grid-template-columns: 1fr; }
}
</style>
