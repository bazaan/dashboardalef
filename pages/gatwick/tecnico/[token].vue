<template>
  <div class="tk-shell">
    <!-- Cargando / error -->
    <div v-if="cargando" class="tk-center"><div class="tk-spinner"></div><p>Cargando emergencia…</p></div>
    <div v-else-if="error" class="tk-center">
      <div class="tk-icon-err">⚠️</div>
      <h2>No se pudo abrir el seguimiento</h2>
      <p>{{ error }}</p>
    </div>

    <!-- Cerrado -->
    <div v-else-if="!activo" class="tk-center">
      <div class="tk-icon-ok">✅</div>
      <h2>Emergencia finalizada</h2>
      <p>El seguimiento se cerró. Ya no se registra tu ubicación.</p>
      <div class="tk-resumen" v-if="seg">
        <div><span>Inicio</span><strong>{{ hora(seg.iniciado_en) }}</strong></div>
        <div v-if="seg.atendiendo_en"><span>En sitio</span><strong>{{ hora(seg.atendiendo_en) }}</strong></div>
        <div v-if="seg.finalizada_en"><span>Cierre</span><strong>{{ hora(seg.finalizada_en) }}</strong></div>
      </div>
    </div>

    <!-- Activo -->
    <template v-else>
      <!-- Banda de monitoreo -->
      <div class="tk-monitor" :class="{ 'tk-monitor--off': !gpsOk }">
        <span class="tk-dot" :class="{ 'tk-dot--off': !gpsOk }"></span>
        <div>
          <strong>{{ gpsOk ? 'Estás siendo monitoreado' : 'Esperando tu ubicación GPS…' }}</strong>
          <small>{{ gpsOk ? 'Tu ubicación se comparte con los supervisores hasta que finalices' : gpsMsg }}</small>
        </div>
      </div>

      <div class="tk-body">
        <!-- Emergencia -->
        <div class="tk-card">
          <div class="tk-prio" :class="'prio-' + (emerg?.prioridad || 'media')">
            {{ (emerg?.prioridad || 'media').toUpperCase() }} · Emergencia #{{ emerg?.id }}
          </div>
          <h1>{{ emerg?.titulo || 'Emergencia' }}</h1>

          <div class="tk-datos">
            <div v-if="emerg?.edificio_nombre || emerg?.empresa_cliente">
              <span>🏢 Edificio</span><strong>{{ emerg.edificio_nombre || emerg.empresa_cliente }}</strong>
            </div>
            <div v-if="emerg?.codigo_ascensor">
              <span>🛗 Ascensor</span><strong>{{ emerg.codigo_ascensor }}<template v-if="emerg.tipo_equipo"> — {{ emerg.tipo_equipo }}</template></strong>
            </div>
            <div v-if="seg?.destino_direccion || emerg?.direccion">
              <span>📍 Dirección</span><strong>{{ seg?.destino_direccion || emerg?.direccion }}<template v-if="emerg?.distrito">, {{ emerg.distrito }}</template></strong>
            </div>
            <div v-if="emerg?.elme"><span>🔖 ELME</span><strong>{{ emerg.elme }}</strong></div>
            <div v-if="emerg?.piso"><span>🏗️ Piso</span><strong>{{ emerg.piso }}</strong></div>
            <div v-if="emerg?.telefono_contacto"><span>☎️ Contacto</span><strong>{{ emerg.telefono_contacto }}</strong></div>
          </div>
          <p v-if="emerg?.descripcion" class="tk-desc">{{ emerg.descripcion }}</p>

          <a v-if="seg?.destino_lat" class="tk-maps"
            :href="`https://www.google.com/maps/dir/?api=1&destination=${seg.destino_lat},${seg.destino_lng}`" target="_blank">
            🧭 Abrir ruta en Google Maps
          </a>
        </div>

        <!-- Progreso -->
        <div class="tk-pasos">
          <div v-for="(p, i) in pasos" :key="p.key" class="tk-paso" :class="{ done: idxEstado > i, now: idxEstado === i }">
            <div class="tk-paso-num">{{ idxEstado > i ? '✓' : i + 1 }}</div>
            <div class="tk-paso-txt"><strong>{{ p.label }}</strong><small v-if="p.hora">{{ p.hora }}</small></div>
          </div>
        </div>

        <!-- Distancia -->
        <div v-if="distancia !== null" class="tk-dist" :class="{ cerca: enDestino }">
          <template v-if="enDestino">✅ Estás en el edificio ({{ distancia }} m)</template>
          <template v-else>📏 A {{ distanciaTxt }} del edificio<span v-if="etaTxt"> · llegada aprox. {{ etaTxt }}</span></template>
        </div>

        <!-- Acciones -->
        <div class="tk-acciones">
          <button v-if="estado === 'iniciado'" class="tk-btn tk-btn--go" :disabled="enviando" @click="cambiar('en_camino')">
            {{ enviando ? 'Enviando…' : '🚗 Voy en camino' }}
          </button>

          <template v-else-if="estado === 'en_camino'">
            <button class="tk-btn tk-btn--work" :disabled="enviando || !puedeAtender" @click="cambiar('atendiendo')">
              {{ enviando ? 'Enviando…' : '🔧 Atendiendo la emergencia' }}
            </button>
            <p v-if="!puedeAtender" class="tk-lock">
              🔒 Se habilita automáticamente cuando llegues al edificio
              <template v-if="distancia !== null"> (faltan {{ distanciaTxt }})</template>
            </p>
          </template>

          <template v-else-if="estado === 'atendiendo'">
            <textarea v-model="notas" class="tk-notas" rows="3" placeholder="Notas del trabajo realizado (opcional)"></textarea>
            <button class="tk-btn tk-btn--done" :disabled="enviando" @click="confirmarFin = true">
              {{ enviando ? 'Enviando…' : '✅ Emergencia atendida — Finalizar' }}
            </button>
          </template>
        </div>

        <p class="tk-pie">No cierres esta página mientras atiendes la emergencia.</p>
      </div>

      <!-- Confirmación de cierre -->
      <div v-if="confirmarFin" class="tk-modal" @click.self="confirmarFin = false">
        <div class="tk-modal-card">
          <h3>¿Finalizar la emergencia?</h3>
          <p>Se avisará a los supervisores y se detendrá el seguimiento GPS. No podrás reabrirlo.</p>
          <div class="tk-modal-acc">
            <button class="tk-btn tk-btn--ghost" @click="confirmarFin = false">Cancelar</button>
            <button class="tk-btn tk-btn--done" :disabled="enviando" @click="cambiar('finalizada')">Sí, finalizar</button>
          </div>
        </div>
      </div>

      <div v-if="toast" class="tk-toast" :class="'tk-toast--' + toast.tipo">{{ toast.txt }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({ layout: 'forms-public' })

const route = useRoute()
const token = String(route.params.token || '')

const cargando = ref(true)
const error = ref<string | null>(null)
const activo = ref(true)
const seg = ref<any>(null)
const emerg = ref<any>(null)
const geofence = ref(200)

const estado = computed(() => seg.value?.estado || 'iniciado')
const enviando = ref(false)
const confirmarFin = ref(false)
const notas = ref('')
const toast = ref<{ txt: string; tipo: string } | null>(null)

/* GPS */
const gpsOk = ref(false)
const gpsMsg = ref('Solicitando permiso de ubicación…')
const distancia = ref<number | null>(null)
const etaSeg = ref<number | null>(null)
let watchId: number | null = null
let wakeLock: any = null
let ultimoEnvio = 0

const enDestino = computed(() => distancia.value !== null && distancia.value <= geofence.value)
const puedeAtender = computed(() => !seg.value?.destino_lat || enDestino.value)
const distanciaTxt = computed(() => {
  const d = distancia.value
  if (d === null) return ''
  return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`
})
const etaTxt = computed(() => {
  if (!etaSeg.value) return ''
  const m = Math.max(1, Math.round(etaSeg.value / 60))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
})

const ORDEN = ['iniciado', 'en_camino', 'atendiendo', 'finalizada']
const idxEstado = computed(() => Math.max(0, ORDEN.indexOf(estado.value)))
const pasos = computed(() => [
  { key: 'iniciado', label: 'Emergencia asignada', hora: hora(seg.value?.iniciado_en) },
  { key: 'en_camino', label: 'En camino', hora: hora(seg.value?.en_camino_en) },
  { key: 'atendiendo', label: 'Atendiendo en sitio', hora: hora(seg.value?.atendiendo_en) },
])

function hora(v: any) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}
function avisar(txt: string, tipo = 'ok') {
  toast.value = { txt, tipo }
  setTimeout(() => { toast.value = null }, 4000)
}

async function cargar() {
  try {
    const r = await $fetch<any>(`/api/gatwick/seguimiento/${token}?recorrido=0`)
    seg.value = r.seguimiento
    emerg.value = r.emergencia
    activo.value = r.activo
    geofence.value = r.geofence_m || 200
    if (r.seguimiento?.distancia_destino_m != null) distancia.value = r.seguimiento.distancia_destino_m
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Link inválido o expirado'
  } finally {
    cargando.value = false
  }
}

/** ETA por carretera con OSRM (gratis, sin API key). */
async function calcularEta(lat: number, lng: number) {
  if (!seg.value?.destino_lat) return
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${seg.value.destino_lng},${seg.value.destino_lat}?overview=false`
    const r: any = await $fetch(url, { timeout: 7000 })
    const ruta = r?.routes?.[0]
    if (ruta?.duration) etaSeg.value = Math.round(ruta.duration)
  } catch { /* si el ruteador falla, seguimos con la distancia en línea recta */ }
}

async function enviarPing(pos: GeolocationPosition) {
  const { latitude, longitude, accuracy, speed, heading } = pos.coords
  try {
    const r = await $fetch<any>('/api/gatwick/seguimiento/ping', {
      method: 'POST',
      body: {
        token, lat: latitude, lng: longitude,
        precision: accuracy, velocidad: speed, rumbo: heading,
        eta_segundos: etaSeg.value,
      },
    })
    if (r?.cerrado) { activo.value = false; detenerGps(); return }
    if (r?.distancia_destino_m != null) distancia.value = r.distancia_destino_m
    gpsOk.value = true
  } catch { /* reintenta en el siguiente ping */ }
}

function iniciarGps() {
  if (!('geolocation' in navigator)) { gpsMsg.value = 'Este dispositivo no soporta GPS'; return }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      gpsOk.value = true
      const ahora = Date.now()
      // Envía como máximo cada 6 s para no saturar
      if (ahora - ultimoEnvio > 6000) {
        ultimoEnvio = ahora
        enviarPing(pos)
        if (!etaSeg.value || ahora % 60000 < 6000) calcularEta(pos.coords.latitude, pos.coords.longitude)
      }
    },
    (err) => {
      gpsOk.value = false
      gpsMsg.value = err.code === err.PERMISSION_DENIED
        ? 'Permiso de ubicación denegado. Actívalo para continuar.'
        : 'No se pudo obtener la ubicación. Revisa el GPS.'
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
  )
}
function detenerGps() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null }
  if (wakeLock) { try { wakeLock.release() } catch {} wakeLock = null }
}

/** Mantiene la pantalla encendida: con la pantalla apagada el GPS del navegador se congela. */
async function pedirWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen')
  } catch { /* no es crítico */ }
}
function onVisibilidad() {
  if (document.visibilityState === 'visible' && activo.value && !wakeLock) pedirWakeLock()
}

async function cambiar(nuevo: string) {
  enviando.value = true
  try {
    const body: any = { token, estado: nuevo }
    if (seg.value?.ultima_lat) { body.lat = seg.value.ultima_lat; body.lng = seg.value.ultima_lng }
    // Posición fresca para que el geofence use el dato más nuevo
    if (nuevo === 'atendiendo' && 'geolocation' in navigator) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => { body.lat = p.coords.latitude; body.lng = p.coords.longitude; resolve() },
          () => resolve(), { enableHighAccuracy: true, timeout: 8000 })
      })
    }
    if (nuevo === 'finalizada' && notas.value.trim()) body.notas = notas.value.trim()
    if (etaSeg.value) body.eta_segundos = etaSeg.value

    const r = await $fetch<any>('/api/gatwick/seguimiento/estado', { method: 'POST', body })
    seg.value = r.seguimiento
    confirmarFin.value = false

    if (nuevo === 'finalizada') {
      activo.value = false
      detenerGps()
      avisar('Emergencia finalizada. Supervisores avisados.')
    } else {
      avisar(nuevo === 'en_camino' ? 'Supervisores avisados: vas en camino' : 'Supervisores avisados: estás atendiendo')
    }
  } catch (e: any) {
    avisar(e?.data?.statusMessage || 'No se pudo actualizar el estado', 'err')
  } finally {
    enviando.value = false
  }
}

onMounted(async () => {
  await cargar()
  if (activo.value && !error.value) {
    iniciarGps()
    pedirWakeLock()
    document.addEventListener('visibilitychange', onVisibilidad)
  }
})
onBeforeUnmount(() => {
  detenerGps()
  document.removeEventListener('visibilitychange', onVisibilidad)
})
</script>

<style scoped>
.tk-shell {
  min-height: 100dvh;
  background: #0f1117;
  color: #e8eaed;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  padding-bottom: env(safe-area-inset-bottom);
}

.tk-center { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 30px 22px; gap: 8px; }
.tk-center h2 { margin: 6px 0 0; font-size: 1.25rem; }
.tk-center p { color: #9aa0ac; margin: 0; }
.tk-icon-err, .tk-icon-ok { font-size: 52px; }
.tk-spinner { width: 34px; height: 34px; border: 3px solid #2a2e3c; border-top-color: #daa520; border-radius: 50%; animation: sp 0.8s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

.tk-resumen { margin-top: 18px; display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; }
.tk-resumen div { display: flex; flex-direction: column; }
.tk-resumen span { font-size: 11px; color: #9aa0ac; text-transform: uppercase; letter-spacing: .4px; }

/* Banda de monitoreo */
.tk-monitor {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 11px;
  padding: calc(11px + env(safe-area-inset-top)) 16px 11px;
  background: #14532d; border-bottom: 1px solid #1c6b3a;
}
.tk-monitor--off { background: #4a3010; border-bottom-color: #6b4a1c; }
.tk-monitor strong { display: block; font-size: 0.9rem; }
.tk-monitor small { color: #b9c4bd; font-size: 0.76rem; }
.tk-dot { width: 11px; height: 11px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.7); animation: pulse 1.8s infinite; flex-shrink: 0; }
.tk-dot--off { background: #f59e0b; animation: none; }
@keyframes pulse { 70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }

.tk-body { padding: 16px; max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }

.tk-card { background: #181a23; border: 1px solid #262a38; border-radius: 14px; padding: 16px; }
.tk-card h1 { font-size: 1.15rem; margin: 8px 0 12px; line-height: 1.3; }
.tk-prio { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 4px 10px; border-radius: 999px; }
.prio-critica { background: rgba(239,68,68,.18); color: #f87171; }
.prio-alta { background: rgba(249,115,22,.18); color: #fb923c; }
.prio-media { background: rgba(234,179,8,.16); color: #facc15; }
.prio-baja { background: rgba(59,130,246,.16); color: #60a5fa; }

.tk-datos { display: flex; flex-direction: column; gap: 9px; }
.tk-datos div { display: flex; flex-direction: column; gap: 1px; }
.tk-datos span { font-size: 11.5px; color: #9aa0ac; }
.tk-datos strong { font-size: 14.5px; font-weight: 600; }
.tk-desc { margin: 12px 0 0; padding: 10px 12px; background: #1f2230; border-radius: 9px; font-size: 13.5px; color: #c9cfda; }
.tk-maps { display: block; margin-top: 13px; text-align: center; padding: 11px; background: #1f2230; border: 1px solid #2f3446; border-radius: 10px; color: #7dd3fc; text-decoration: none; font-weight: 600; font-size: 14px; }

/* Pasos */
.tk-pasos { display: flex; flex-direction: column; gap: 0; background: #181a23; border: 1px solid #262a38; border-radius: 14px; padding: 6px 14px; }
.tk-paso { display: flex; align-items: center; gap: 12px; padding: 10px 0; opacity: .45; }
.tk-paso.done, .tk-paso.now { opacity: 1; }
.tk-paso-num { width: 26px; height: 26px; border-radius: 50%; background: #262a38; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; flex-shrink: 0; }
.tk-paso.done .tk-paso-num { background: #16a34a; }
.tk-paso.now .tk-paso-num { background: #daa520; color: #1a1a1a; }
.tk-paso-txt { display: flex; flex-direction: column; }
.tk-paso-txt small { color: #9aa0ac; font-size: 11.5px; }

.tk-dist { text-align: center; padding: 11px; border-radius: 11px; background: #1f2230; font-size: 14px; font-weight: 600; }
.tk-dist.cerca { background: rgba(34,197,94,.14); color: #4ade80; }

/* Botones */
.tk-acciones { display: flex; flex-direction: column; gap: 9px; }
.tk-btn { width: 100%; padding: 16px; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; color: #fff; transition: opacity .15s; }
.tk-btn:disabled { opacity: .4; cursor: not-allowed; }
.tk-btn--go { background: #2563eb; }
.tk-btn--work { background: #ea580c; }
.tk-btn--done { background: #16a34a; }
.tk-btn--ghost { background: #262a38; }
.tk-lock { text-align: center; font-size: 12.5px; color: #9aa0ac; margin: 0; }
.tk-notas { width: 100%; background: #1f2230; border: 1px solid #2f3446; border-radius: 10px; color: #e8eaed; padding: 11px; font-family: inherit; font-size: 14px; resize: vertical; }
.tk-pie { text-align: center; font-size: 12px; color: #6b7280; margin: 4px 0 20px; }

/* Modal */
.tk-modal { position: fixed; inset: 0; background: rgba(0,0,0,.72); display: grid; place-items: center; padding: 22px; z-index: 50; }
.tk-modal-card { background: #181a23; border: 1px solid #2f3446; border-radius: 16px; padding: 22px; max-width: 400px; width: 100%; }
.tk-modal-card h3 { margin: 0 0 8px; font-size: 1.1rem; }
.tk-modal-card p { color: #9aa0ac; font-size: 13.5px; margin: 0 0 18px; }
.tk-modal-acc { display: flex; gap: 9px; }

.tk-toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(20px + env(safe-area-inset-bottom)); background: #16a34a; color: #fff; padding: 12px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; z-index: 60; max-width: 90vw; text-align: center; }
.tk-toast--err { background: #dc2626; }
</style>
