<template>
  <div class="cmp">

    <!-- CÓMO FUNCIONA: importa, porque el alcance no es obvio -->
    <div class="cmp-explica">
      <strong>Cómo llega el aviso.</strong>
      Apple Wallet no permite mandar un mensaje suelto. Lo que hacemos es actualizar la tarjeta
      del socio: su teléfono la vuelve a pedir y muestra el aviso en la pantalla de bloqueo.
      Por eso <strong>solo le llega a quien tenga la tarjeta instalada</strong> en su teléfono.
      Al resto le queda guardado el aviso y lo ve cuando la instale.
    </div>

    <div v-if="error" class="fid-alert">{{ error }}</div>

    <div class="cmp-layout">

      <!-- ─── REDACTAR ─── -->
      <section class="cmp-bloque">
        <h4 class="cfg-h4">Nuevo aviso</h4>

        <label class="cfg-label">Título <span class="cmp-interno">(interno, no lo ve el socio)</span></label>
        <input v-model="form.titulo" class="cfg-input" maxlength="80" placeholder="Ej. Promo limpieza facial setiembre" />

        <label class="cfg-label">Mensaje</label>
        <textarea v-model="form.mensaje" class="cfg-input" rows="3" :maxlength="MAX"
          placeholder="Ej. 20% en limpieza facial hasta el domingo. Reserva por WhatsApp." />
        <div class="cmp-contador" :class="{ 'cmp-contador--tope': restantes < 20 }">
          {{ restantes }} caracteres disponibles
        </div>

        <!-- SEGMENTO -->
        <div class="cmp-sub">A quién</div>
        <div class="cfg-fila">
          <div>
            <label class="cfg-label">Nivel mínimo</label>
            <select v-model="form.segmento.level" class="cfg-input" @change="calcularAlcance">
              <option value="Todos">Todos</option>
              <option v-for="n in niveles" :key="n" :value="n">{{ n }} o superior</option>
            </select>
          </div>
          <div>
            <label class="cfg-label">Puntos mínimos</label>
            <input v-model.number="form.segmento.minPoints" class="cfg-input" type="number" min="0"
              @change="calcularAlcance" />
          </div>
        </div>
        <label class="cfg-label">Sin venir hace (días)</label>
        <input v-model.number="form.segmento.daysInactive" class="cfg-input" type="number" min="0"
          placeholder="0 = sin filtro" @change="calcularAlcance" />

        <!-- ALCANCE REAL -->
        <div class="cmp-alcance">
          <div>
            <div class="cmp-alcance-num">{{ alcance.con_tarjeta ?? 0 }}</div>
            <div class="cmp-alcance-lbl">reciben el aviso ahora</div>
          </div>
          <div>
            <div class="cmp-alcance-num cmp-alcance-num--gris">{{ alcance.sin_tarjeta ?? 0 }}</div>
            <div class="cmp-alcance-lbl">lo verán al instalar la tarjeta</div>
          </div>
        </div>

        <!-- ENVÍO -->
        <div class="cmp-sub">Cuándo</div>
        <label class="cmp-radio">
          <input v-model="form.accion" type="radio" value="enviar" />
          <span>Enviar ahora</span>
        </label>
        <label class="cmp-radio">
          <input v-model="form.accion" type="radio" value="programar" />
          <span>Programar</span>
        </label>
        <input v-if="form.accion === 'programar'" v-model="form.programadaPara"
          class="cfg-input" type="datetime-local" :min="minimoFecha" />
        <p v-if="form.accion === 'programar'" class="cfg-nota">
          Hora de Lima. Se revisa cada 5 minutos, así que puede salir hasta 5 minutos después.
        </p>

        <div v-if="enviarError" class="fid-alert" style="margin-top:0.75rem;">{{ enviarError }}</div>
        <div v-if="resultado" class="fid-ok">
          <strong>{{ resultado.titulo }}</strong>
          <div v-if="resultado.detalle">{{ resultado.detalle }}</div>
        </div>

        <div class="cfg-acciones" style="margin-top:1rem;">
          <button class="fid-btn-primary" :disabled="enviando || !puedeEnviar" @click="confirmar">
            {{ enviando ? 'Procesando…' : (form.accion === 'programar' ? 'Programar' : 'Enviar ahora') }}
          </button>
        </div>
      </section>

      <!-- ─── HISTORIAL ─── -->
      <section class="cmp-bloque">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 class="cfg-h4" style="margin:0;">Historial</h4>
          <button class="fid-btn-ghost" :disabled="cargando" @click="cargar">Recargar</button>
        </div>

        <div v-if="!campanas.length" class="cfg-ayuda" style="margin-top:0.75rem;">
          Todavía no se envió ninguna campaña.
        </div>

        <div v-for="c in campanas" :key="c.id" class="cmp-item">
          <div class="cmp-item-top">
            <strong>{{ c.title }}</strong>
            <span :class="['cmp-estado', `cmp-estado--${c.status}`]">{{ etiquetaEstado(c.status) }}</span>
          </div>
          <div class="cmp-item-msg">{{ c.message }}</div>
          <div class="cmp-item-pie">
            <span v-if="c.status === 'sent'">
              {{ c.stats?.sent ?? 0 }} recibidos
              <template v-if="c.stats?.sin_dispositivo"> · {{ c.stats.sin_dispositivo }} sin tarjeta instalada</template>
              <template v-if="c.stats?.failed"> · {{ c.stats.failed }} con error</template>
            </span>
            <span v-else-if="c.status === 'scheduled'">
              Programada para {{ formatFecha(c.scheduled_at) }}
            </span>
            <span v-else>{{ c.stats?.targeted ?? 0 }} destinatarios estimados</span>
          </div>
          <div v-if="c.error" class="cmp-item-error">{{ c.error }}</div>
        </div>
      </section>
    </div>

    <!-- CONFIRMACIÓN: un aviso no se puede deshacer -->
    <v-dialog v-model="dialogConfirmar" max-width="440">
      <div class="fid-dialog">
        <h3 class="cfg-h4" style="margin-top:0;">
          {{ form.accion === 'programar' ? '¿Programar este aviso?' : '¿Enviar ahora?' }}
        </h3>
        <p class="cfg-ayuda">
          Le va a llegar a <strong>{{ alcance.con_tarjeta ?? 0 }}</strong> persona(s) con la tarjeta
          instalada. <strong>Un aviso enviado no se puede retirar</strong> del teléfono del socio.
        </p>
        <div class="cmp-preview">{{ form.mensaje }}</div>
        <div class="cfg-acciones" style="justify-content:flex-end;margin-top:1rem;">
          <button class="fid-btn-ghost" @click="dialogConfirmar = false">Cancelar</button>
          <button class="fid-btn-primary" :disabled="enviando" @click="ejecutar">
            {{ form.accion === 'programar' ? 'Sí, programar' : 'Sí, enviar' }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
const MAX = 160

const cargando = ref(false)
const enviando = ref(false)
const error = ref('')
const enviarError = ref('')
const resultado = ref<any>(null)
const dialogConfirmar = ref(false)

const campanas = ref<any[]>([])
const alcance = ref<any>({ total: 0, con_tarjeta: 0, sin_tarjeta: 0 })
const niveles = ref<string[]>([])

const form = ref({
  titulo: '',
  mensaje: '',
  segmento: { level: 'Todos', minPoints: 0, daysInactive: 0 },
  accion: 'enviar' as 'enviar' | 'programar',
  programadaPara: '',
})

const restantes = computed(() => MAX - (form.value.mensaje || '').length)
const puedeEnviar = computed(() =>
  form.value.titulo.trim().length > 0 &&
  form.value.mensaje.trim().length > 0 &&
  (form.value.accion !== 'programar' || !!form.value.programadaPara),
)

const minimoFecha = computed(() => {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
})

function mensajeDeError(e: any): string {
  return e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Error inesperado'
}

function etiquetaEstado(s: string): string {
  return { draft: 'Borrador', scheduled: 'Programada', sending: 'Enviando', sent: 'Enviada' }[s] || s
}

function formatFecha(v: any): string {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion-campanas', {
      query: {
        minPoints: form.value.segmento.minPoints || undefined,
        daysInactive: form.value.segmento.daysInactive || undefined,
        level: form.value.segmento.level !== 'Todos' ? form.value.segmento.level : undefined,
      },
    })
    campanas.value = res.campanas || []
    alcance.value = res.alcance || alcance.value
  } catch (e: any) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

async function calcularAlcance() {
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion-campanas', {
      query: {
        minPoints: form.value.segmento.minPoints || undefined,
        daysInactive: form.value.segmento.daysInactive || undefined,
        level: form.value.segmento.level !== 'Todos' ? form.value.segmento.level : undefined,
      },
    })
    alcance.value = res.alcance || alcance.value
  } catch { /* el alcance es orientativo; si falla no bloquea el envío */ }
}

async function cargarNiveles() {
  try {
    const p = await $fetch<any>('/api/healup/fidelizacion-programa')
    niveles.value = (p.niveles || []).map((n: any) => n.name)
  } catch { /* si no se pueden leer, queda solo "Todos" */ }
}

function confirmar() {
  enviarError.value = ''
  resultado.value = null
  dialogConfirmar.value = true
}

async function ejecutar() {
  enviando.value = true
  enviarError.value = ''
  try {
    const res = await $fetch<any>('/api/healup/fidelizacion-campanas', {
      method: 'POST',
      body: { ...form.value },
    })
    dialogConfirmar.value = false

    if (res.accion === 'enviar') {
      const r = res.resultado || {}
      resultado.value = {
        titulo: `Aviso enviado a ${r.enviados ?? 0} persona(s).`,
        detalle: r.sin_dispositivo
          ? `${r.sin_dispositivo} lo verán cuando instalen la tarjeta.`
          : '',
      }
    } else {
      resultado.value = { titulo: 'Aviso programado.', detalle: 'Se enviará solo a la hora indicada.' }
    }

    form.value.titulo = ''
    form.value.mensaje = ''
    form.value.programadaPara = ''
    await cargar()
  } catch (e: any) {
    dialogConfirmar.value = false
    enviarError.value = mensajeDeError(e)
  } finally {
    enviando.value = false
  }
}

onMounted(async () => {
  await Promise.all([cargar(), cargarNiveles()])
})
</script>

<style scoped>
.cmp { padding: 0.5rem 0; }

.cmp-explica {
  font-size: 0.8rem; line-height: 1.55; color: var(--foreground);
  background: var(--muted, #f4f4f5); border: 1px solid var(--border, #e5e7eb);
  border-radius: var(--radius, 10px); padding: 0.8rem 0.95rem; margin-bottom: 1.1rem;
}

.cmp-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }

.cmp-bloque {
  border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 10px);
  padding: 1rem; background: var(--card, #fff);
}
.cfg-h4 { font-size: 0.9rem; font-weight: 600; color: var(--foreground); margin: 0 0 0.6rem; }
.cfg-label { display: block; font-size: 0.73rem; font-weight: 600; color: var(--muted-foreground); margin: 0.7rem 0 0.25rem; }
.cfg-ayuda { font-size: 0.78rem; color: var(--muted-foreground); line-height: 1.5; }
.cfg-nota { font-size: 0.72rem; color: var(--muted-foreground); margin: 0.3rem 0 0; }
.cfg-input {
  width: 100%; border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
  padding: 0.45rem 0.65rem; font-size: 0.85rem;
  color: var(--foreground); background: var(--background, #fff); font-family: inherit;
}
.cfg-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.cfg-acciones { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.cmp-interno { font-weight: 400; text-transform: none; opacity: 0.75; }
.cmp-contador { font-size: 0.72rem; color: var(--muted-foreground); text-align: right; margin-top: 0.25rem; }
.cmp-contador--tope { color: #b45309; font-weight: 600; }

.cmp-sub {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--muted-foreground); font-weight: 700;
  margin: 1.1rem 0 0.2rem; padding-top: 0.85rem; border-top: 1px solid var(--border, #e5e7eb);
}

.cmp-alcance {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
  background: var(--muted, #f7f7f8); border-radius: var(--radius, 10px);
  padding: 0.8rem; margin-top: 0.9rem; text-align: center;
}
.cmp-alcance-num { font-size: 1.5rem; font-weight: 700; color: var(--foreground); line-height: 1.1; }
.cmp-alcance-num--gris { color: var(--muted-foreground); }
.cmp-alcance-lbl { font-size: 0.7rem; color: var(--muted-foreground); }

.cmp-radio { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; margin: 0.4rem 0; cursor: pointer; }

.cmp-item { border-top: 1px solid var(--border, #e5e7eb); padding: 0.75rem 0; }
.cmp-item:first-of-type { border-top: none; }
.cmp-item-top { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; font-size: 0.85rem; }
.cmp-item-msg { font-size: 0.8rem; color: var(--muted-foreground); margin: 0.25rem 0; }
.cmp-item-pie { font-size: 0.72rem; color: var(--muted-foreground); }
.cmp-item-error { font-size: 0.72rem; color: #b91c1c; margin-top: 0.25rem; }

.cmp-estado { font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.cmp-estado--sent { background: #dcfce7; color: #15803d; }
.cmp-estado--scheduled { background: #dbeafe; color: #1d4ed8; }
.cmp-estado--sending { background: #fef3c7; color: #b45309; }
.cmp-estado--draft { background: var(--muted, #f4f4f5); color: var(--muted-foreground); }

.cmp-preview {
  background: var(--muted, #f4f4f5); border-radius: 8px; padding: 0.7rem;
  font-size: 0.85rem; color: var(--foreground); margin-top: 0.5rem;
}

.fid-dialog { background: var(--card, #fff); border-radius: 12px; padding: 1.25rem; }

@media (max-width: 900px) {
  .cmp-layout, .cfg-fila { grid-template-columns: 1fr; }
}
</style>
