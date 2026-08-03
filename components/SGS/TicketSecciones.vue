<template>
  <div class="tk-secs">
    <div v-for="sec in seccionesVisibles" :key="sec.n" class="tk-sec">
      <div class="tk-sec-head" :style="{ borderLeftColor: sec.color }">
        <span class="tk-sec-num" :style="{ background: sec.color }">{{ sec.n }}</span>
        <span class="tk-sec-tit">{{ sec.titulo }}</span>
      </div>
      <div class="tk-sec-body">
        <div v-for="c in sec.campos" :key="c.key" class="tk-campo">
          <span class="tk-lbl">
            {{ c.label }}
            <em v-if="c.origen !== 'T'" class="tk-org" :title="ORIGEN_TXT[c.origen]">{{ ORIGEN_ICON[c.origen] }}</em>
          </span>
          <!-- Modo edición: solo los campos que se pueden tocar -->
          <input v-if="editando && c.editable" v-model="borrador[c.key]" class="tk-input"
            :placeholder="c.ph || ''" />
          <strong v-else :class="{ 'tk-vacio': vacio(valor(c)) }">{{ mostrar(c) }}</strong>
        </div>
      </div>
    </div>

    <!-- Foto -->
    <div class="tk-sec">
      <div class="tk-sec-head" :style="{ borderLeftColor: '#6b7280' }">
        <span class="tk-sec-num" style="background:#6b7280;">📷</span>
        <span class="tk-sec-tit">FOTO DEL TICKET</span>
      </div>
      <div class="tk-sec-body">
        <a v-if="ticket.imagen_ticket" :href="ticket.imagen_ticket" target="_blank">
          <img :src="ticket.imagen_ticket" alt="Ticket" class="tk-foto" />
        </a>
        <span v-else class="tk-vacio">Sin foto adjunta</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Vista por SECCIONES de un ticket (handoff §3 / §2.4).
 * Fila resumida en la tabla, registro completo acá — nunca se muestra menos
 * información de la que tenemos.
 *
 * Origen de cada campo:
 *   T = viene del ticket (automático)   ✏️ E = editable (no está en el papel)
 *   ⚙️ C = calculado por el sistema     🧪 L = lo llena el laboratorio
 */
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  ticket: Record<string, any>
  sublote?: Record<string, any> | null
  editando?: boolean
}>()
const emit = defineEmits<{ 'update:borrador': [v: Record<string, any>] }>()

const ORIGEN_ICON: Record<string, string> = { T: '', E: '✏️', C: '⚙️', L: '🧪' }
const ORIGEN_TXT: Record<string, string> = {
  T: 'del ticket (automático)', E: 'editable — no está impreso en el ticket',
  C: 'calculado por el sistema', L: 'lo llena el laboratorio',
}

const SECCIONES = [
  {
    n: 1, titulo: 'IDENTIFICACIÓN', color: '#d95550', campos: [
      { key: '_estado', label: 'Estado', origen: 'C' },
      { key: 'n_orden', label: 'N° de Orden (OL)', origen: 'E', editable: true, ph: 'OL217946-01' },
      { key: 'n_ticket', label: 'N° Ticket', origen: 'T', editable: true },
      { key: '_sublote', label: 'Sublote', origen: 'C' },
      { key: 'guia_remision', label: 'Guía de Remisión', origen: 'T', editable: true },
    ],
  },
  {
    n: 2, titulo: 'TRANSPORTE', color: '#e69933', campos: [
      { key: 'placa', label: 'Placa (tracto)', origen: 'T', editable: true },
      { key: 'carreta', label: 'Placa (carreta)', origen: 'T', editable: true },
      { key: 'transportista', label: 'Transportista', origen: 'T', editable: true },
      { key: 'ruc_transportista', label: 'RUC transportista', origen: 'T', editable: true },
      { key: 'chofer', label: 'Chofer', origen: 'T', editable: true },
      { key: 'brevete', label: 'Brevete', origen: 'T', editable: true },
    ],
  },
  {
    n: 3, titulo: 'PARTES', color: '#f2c40f', campos: [
      { key: 'emisor', label: 'Emisor del ticket', origen: 'T', editable: true },
      { key: 'ruc_emisor', label: 'RUC emisor', origen: 'T', editable: true },
      { key: 'cliente', label: 'Cliente', origen: 'T', editable: true },
    ],
  },
  {
    n: 4, titulo: 'MATERIAL Y RUTA', color: '#33a854', campos: [
      { key: 'cod_material', label: 'Cód. material', origen: 'T', editable: true },
      { key: 'material', label: 'Material (ticket)', origen: 'T', editable: true },
      { key: 'calidad_material', label: 'Calidad (de la orden)', origen: 'E', editable: true, ph: 'FE' },
      { key: 'origen', label: 'Origen', origen: 'T', editable: true },
      { key: 'destino', label: 'Destino', origen: 'T', editable: true },
      { key: 'sede', label: 'Sede (derivada)', origen: 'C' },
      { key: 'almacen', label: 'Almacén / Zona', origen: 'T', editable: true },
    ],
  },
  {
    n: 5, titulo: 'PESAJE', color: '#2980b9', campos: [
      { key: 'fecha_ingreso', label: 'Fecha entrada', origen: 'T', editable: true },
      { key: 'hora_ingreso', label: 'Hora entrada', origen: 'T', editable: true },
      { key: 'fecha_salida', label: 'Fecha salida', origen: 'T', editable: true },
      { key: 'hora_salida', label: 'Hora salida', origen: 'T', editable: true },
      { key: 'peso_bruto', label: 'Bruto (kg)', origen: 'T', editable: true },
      { key: 'tara', label: 'Tara (kg)', origen: 'T', editable: true },
      { key: 'peso_neto', label: 'Neto (kg)', origen: 'T', editable: true },
      { key: 'peso_neto_tm', label: 'Neto (TM)', origen: 'C' },
      { key: 'balanza2_nombre', label: '2ª balanza', origen: 'T', editable: true },
      { key: 'balanza2_neto', label: '2ª balanza neto', origen: 'T', editable: true },
    ],
  },
  {
    n: 6, titulo: 'EMBARQUE', color: '#6659cc', soloSiHay: true, campos: [
      { key: 'nave', label: 'Nave', origen: 'T', editable: true },
      { key: 'bl_ne', label: 'BL / N°', origen: 'T', editable: true },
      { key: 'item_bl', label: 'Ítem BL', origen: 'T', editable: true },
      { key: 'regimen', label: 'Régimen', origen: 'T', editable: true },
      { key: 'bultos', label: 'Bultos', origen: 'T', editable: true },
    ],
  },
  {
    n: 7, titulo: 'LABORATORIO / TAT', color: '#9b59b6', campos: [
      { key: '_analisis', label: 'Ingreso a análisis', origen: 'L' },
      { key: 'tat_dias', label: 'TAT contractual (d)', origen: 'E' },
      { key: '_vence', label: 'Vence el', origen: 'C' },
      { key: 'tat_dias_restantes', label: 'Días restantes', origen: 'C' },
      { key: '_tat', label: 'Estado TAT', origen: 'C' },
      { key: '_job', label: 'Job de lab', origen: 'L' },
      { key: '_humedad', label: 'Humedad %', origen: 'L' },
      { key: '_fe', label: 'Fe %', origen: 'L' },
      { key: '_resultado', label: 'Resultado', origen: 'L' },
    ],
  },
  {
    n: 8, titulo: 'CONTROL', color: '#737373', campos: [
      { key: '_verif', label: 'Verificado por humano', origen: 'E' },
      { key: 'supervision_obs', label: 'Observaciones OCR', origen: 'C' },
      { key: 'observaciones_ticket', label: 'Observaciones del ticket', origen: 'T', editable: true },
    ],
  },
]

const SEM_TAT: Record<string, string> = {
  en_plazo: '🟢 En plazo', por_vencer: '🟠 Por vencer', vencido: '🔴 Vencido', sin_fecha: '⚪ Sin fecha',
}
const SEM_RES: Record<string, string> = {
  no_esta: '🔴 No está', listo: '🟠 Listo p/ leer', leido: '🟢 Leído',
}

/** Sección 6 solo aparece si el ticket trae datos de embarque (TISUR). */
const seccionesVisibles = computed(() =>
  SECCIONES.filter(s => !s.soloSiHay || s.campos.some(c => !vacio(props.ticket[c.key]))))

function vacio(v: any) { return v === null || v === undefined || v === '' }

function valor(c: any) {
  const t = props.ticket
  switch (c.key) {
    case '_estado': return t.estado === 'pendiente_ol' ? '🟠 PENDIENTE_OL' : '🟢 Catalogado'
    case '_sublote': return props.sublote
      ? `${props.sublote.codigo} · ${Number(props.sublote.peso_neto_tm || 0).toFixed(0)}/${Number(props.sublote.capacidad_tm || 1000).toFixed(0)} t (${props.sublote.tickets_count || 0} camiones)`
      : null
    case '_analisis': return props.sublote?.fecha_ingreso_analisis || t.fecha_ingreso_analisis
    case '_vence': return venceEl.value
    case '_tat': return SEM_TAT[t.tat_estado] ?? null
    case '_job': return props.sublote?.job_laboratorio
    case '_humedad': return props.sublote?.humedad_pct
    case '_fe': return props.sublote?.fe_pct
    case '_resultado': return SEM_RES[t.resultado_estado] ?? null
    case '_verif': return t.verificado_humano ? 'Sí ✔' : 'No'
    default: return t[c.key]
  }
}

const venceEl = computed(() => {
  const f = props.sublote?.fecha_ingreso_analisis || props.ticket.fecha_ingreso_analisis
  const d = Number(props.sublote?.tat_dias ?? props.ticket.tat_dias ?? 4)
  if (!f) return null
  const base = new Date(String(f) + 'T00:00:00Z')
  if (isNaN(base.getTime())) return null
  base.setUTCDate(base.getUTCDate() + d)
  return base.toISOString().slice(0, 10)
})

function mostrar(c: any) {
  const v = valor(c)
  if (vacio(v)) return '—'
  if (c.key === 'peso_bruto' || c.key === 'tara' || c.key === 'peso_neto' || c.key === 'balanza2_neto') {
    return `${Number(v).toLocaleString('es-PE')} kg`
  }
  if (c.key === 'peso_neto_tm') return `${Number(v).toFixed(3)} t`
  return String(v)
}

/* ── Borrador de edición ── */
const borrador = ref<Record<string, any>>({})
watch(() => [props.editando, props.ticket], () => {
  if (!props.editando) return
  const b: Record<string, any> = {}
  for (const s of SECCIONES) {
    for (const c of s.campos) {
      if (c.editable) b[c.key] = props.ticket[c.key] ?? ''
    }
  }
  borrador.value = b
}, { immediate: true, deep: true })

watch(borrador, v => emit('update:borrador', v), { deep: true })
</script>

<style scoped>
.tk-secs { display: flex; flex-direction: column; gap: 14px; }

.tk-sec { border-radius: 10px; overflow: hidden; background: rgba(128, 128, 128, .05); }

.tk-sec-head {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 12px; border-left: 4px solid;
  background: rgba(128, 128, 128, .09);
}

.tk-sec-num {
  width: 20px; height: 20px; border-radius: 5px; color: #fff;
  font-size: 11.5px; font-weight: 700; display: grid; place-items: center; flex-shrink: 0;
}

.tk-sec-tit { font-size: 12px; font-weight: 700; letter-spacing: .5px; opacity: .85; }

.tk-sec-body {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 11px; padding: 12px;
}

.tk-campo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.tk-lbl {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px;
  opacity: .6; display: flex; align-items: center; gap: 4px;
}

.tk-org { font-style: normal; font-size: 10px; cursor: help; }

.tk-campo strong { font-size: 13.5px; word-break: break-word; }
.tk-vacio { opacity: .35; font-weight: 400; }

.tk-input {
  background: rgba(0, 0, 0, .22); border: 1px solid rgba(128, 128, 128, .35);
  border-radius: 6px; padding: 5px 8px; color: inherit; font-size: 13px; width: 100%;
}

.tk-foto { max-height: 220px; border-radius: 8px; border: 1px solid rgba(128, 128, 128, .3); }
</style>
