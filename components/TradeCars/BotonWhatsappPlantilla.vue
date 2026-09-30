<!--
  Botón "WhatsApp" de las tarjetas de Solicitudes - formularios (Web, IG, FB, TikTok, Sin plataforma).
  Envía la plantilla aprobada de Meta por Chatwoot (POST /api/tradecars/whatsapp-plantilla) y, una vez
  enviada, pasa a "Abrir en Chatwoot". El padre carga una sola vez la plantilla y el último envío de
  cada tarjeta (GET /api/tradecars/whatsapp-plantilla?canal=) y se los pasa por props.
-->
<template>
  <div class="wa-plantilla" @click.stop>
    <div class="wa-botones">
      <template v-if="envio?.estado === 'enviado'">
        <v-btn color="success" variant="tonal" size="small" :href="envio.url_conversacion || undefined"
          target="_blank" rel="noopener noreferrer" :disabled="!envio.url_conversacion">
          <v-icon icon="mdi-open-in-new" start size="16" /> Abrir en Chatwoot
        </v-btn>
        <v-btn size="small" variant="text" :disabled="disabled || !!plantillaError" @click="abrir(true)">Reenviar</v-btn>
      </template>
      <v-btn v-else color="success" variant="tonal" size="small" :loading="enviando"
        :disabled="disabled || !!plantillaError" :title="plantillaError || ''" @click="abrir(false)">
        <v-icon icon="mdi-whatsapp" start size="16" /> WhatsApp
      </v-btn>
    </div>
    <small v-if="envio" class="wa-estado" :class="{ 'wa-estado--error': envio.estado === 'fallido' }">
      <template v-if="envio.estado === 'enviado'">
        Plantilla enviada el {{ fecha(envio.enviado_en) }} por {{ persona(envio.enviado_por) }}
        <template v-if="ESTADO_WA[envio.estado_whatsapp]"> · {{ ESTADO_WA[envio.estado_whatsapp] }}</template>
        <template v-if="envio.asignado_nombre"> · asignada a {{ envio.asignado_nombre }}</template>
      </template>
      <template v-else>No se pudo enviar el {{ fecha(envio.enviado_en) }}: {{ envio.error }}</template>
    </small>

    <v-dialog v-model="dialogo" max-width="520">
      <v-card>
        <v-card-title class="pt-4">{{ reenviar ? 'Reenviar plantilla de WhatsApp' : 'Enviar plantilla de WhatsApp' }}</v-card-title>
        <v-card-text>
          <p class="mb-3">
            Para <b>{{ nombre || 'el cliente' }}</b> · <b>{{ celular }}</b>, desde el WhatsApp de <b>Trade Cars Perú</b>.
          </p>

          <div v-if="plantilla" class="wa-preview">
            <div v-if="plantilla.encabezado" class="wa-preview-head">{{ plantilla.encabezado }}</div>
            <div class="wa-preview-body">{{ plantilla.cuerpo }}</div>
            <div class="wa-preview-botones">
              <span v-for="b in plantilla.botones" :key="b">{{ b }}</span>
            </div>
            <div class="wa-preview-nombre">Plantilla {{ plantilla.nombre }}</div>
          </div>

          <p class="wa-nota mt-3">
            <template v-if="asesorNombre">La conversación queda asignada a <b>{{ asesorNombre }}</b> en Chatwoot.</template>
            <template v-else>La tarjeta no tiene asesor: Chatwoot la reparte con la asignación automática.</template>
            Si el cliente ya tiene una conversación abierta, se usa esa.
          </p>

          <v-alert v-if="reenviar" type="warning" variant="tonal" density="compact" class="mt-3">
            <template v-if="yaEnviado">Ya se le envió el {{ fecha(yaEnviado.enviado_en) }} por {{ persona(yaEnviado.enviado_por) }}.</template>
            ¿Enviarla de nuevo? Meta cobra cada envío y limita cuántas plantillas de marketing recibe una persona.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="enviando" @click="dialogo = false">Cancelar</v-btn>
          <v-btn color="success" variant="flat" :loading="enviando" @click="enviar">
            {{ reenviar ? 'Reenviar' : 'Enviar' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  canal: string
  refTarjeta: string
  nombre?: string | null
  celular?: string | null
  asesorNombre?: string | null
  envio?: any | null
  plantilla?: any | null
  plantillaError?: string | null
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'enviado', envio: any): void
  (e: 'notificar', texto: string, color?: string): void
}>()

const ESTADO_WA: Record<string, string> = { sent: 'enviada', delivered: 'entregada', read: 'leída', failed: 'rechazada por WhatsApp' }

const dialogo = ref(false)
const reenviar = ref(false)
const enviando = ref(false)
const yaEnviado = ref<any>(null)

watch(() => props.envio, () => { yaEnviado.value = props.envio?.estado === 'enviado' ? props.envio : null }, { immediate: true })

function abrir(esReenvio: boolean) {
  reenviar.value = esReenvio
  dialogo.value = true
}

async function enviar() {
  enviando.value = true
  try {
    const r = await $fetch<any>('/api/tradecars/whatsapp-plantilla', {
      method: 'POST',
      body: { canal: props.canal, ref: props.refTarjeta, reenviar: reenviar.value },
    })
    dialogo.value = false
    emit('enviado', r.envio)
    if (r.ok) {
      emit('notificar', `Plantilla enviada a ${props.nombre || props.celular}${r.envio?.asignado_nombre ? ` · asignada a ${r.envio.asignado_nombre}` : ''}`)
    } else {
      emit('notificar', `WhatsApp rechazó el mensaje: ${r.error}`, 'error')
    }
  } catch (e: any) {
    const previo = e?.data?.data?.ya_enviado
    if (e?.statusCode === 409 && previo) {
      // Ya se había enviado (por ejemplo, desde otra pestaña): pedir la segunda confirmación.
      yaEnviado.value = previo
      reenviar.value = true
      return
    }
    emit('notificar', e?.data?.statusMessage || e?.statusMessage || e?.message || 'No se pudo enviar la plantilla', 'error')
  } finally {
    enviando.value = false
  }
}

function fecha(v: any) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const persona = (email: any) => String(email || '').split('@')[0] || '—'
</script>

<style scoped>
.wa-plantilla { display: inline-flex; flex-direction: column; gap: 2px; }
.wa-botones { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.wa-estado { font-size: 11px; opacity: .75; max-width: 320px; line-height: 1.3; }
.wa-estado--error { color: #e53935; opacity: 1; }
.wa-preview {
  border-radius: 10px; padding: 12px 14px; background: rgba(37, 211, 102, .08);
  border: 1px solid rgba(37, 211, 102, .25); font-size: 14px;
}
.wa-preview-head { font-weight: 700; margin-bottom: 6px; }
.wa-preview-body { white-space: pre-line; }
.wa-preview-botones { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.wa-preview-botones span {
  border: 1px solid rgba(37, 211, 102, .45); border-radius: 16px; padding: 3px 10px; font-size: 12px; color: #25a35a;
}
.wa-preview-nombre { font-size: 11px; opacity: .6; margin-top: 8px; }
.wa-nota { font-size: 12px; opacity: .8; }
</style>
