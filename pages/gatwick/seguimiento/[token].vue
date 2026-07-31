<template>
  <div class="sv-shell">
    <div v-if="cargando" class="sv-center"><div class="sv-spinner"></div><p>Cargando seguimiento…</p></div>
    <div v-else-if="error" class="sv-center">
      <div style="font-size:52px;">⚠️</div>
      <h2>No se pudo abrir el seguimiento</h2><p>{{ error }}</p>
    </div>

    <template v-else>
      <!-- Barra superior -->
      <header class="sv-top">
        <div class="sv-top-l">
          <span class="sv-badge" :class="'est-' + estado">{{ etiquetaEstado }}</span>
          <div>
            <strong>{{ emerg?.edificio_nombre || emerg?.empresa_cliente || 'Emergencia' }}</strong>
            <small>#{{ emerg?.id }}<template v-if="emerg?.codigo_ascensor"> · 🛗 {{ emerg.codigo_ascensor }}</template></small>
          </div>
        </div>
        <div class="sv-live" :class="{ off: !enVivo }"><span class="sv-dot" :class="{ off: !enVivo }"></span>{{ enVivo ? 'En vivo' : 'Cerrado' }}</div>
      </header>

      <!-- Mapa -->
      <div class="sv-map-wrap">
        <div ref="mapEl" class="sv-map"></div>
        <div v-if="!seg?.ultima_lat" class="sv-map-msg">Esperando la primera ubicación del técnico…</div>
      </div>

      <!-- Panel -->
      <section class="sv-panel">
        <div class="sv-kpis">
          <div class="sv-kpi">
            <span>Técnico</span>
            <strong>{{ seg?.tecnico_nombre || '—' }}</strong>
            <a v-if="seg?.tecnico_telefono" :href="`tel:${seg.tecnico_telefono}`" class="sv-tel">📞 {{ seg.tecnico_telefono }}</a>
          </div>
          <div class="sv-kpi"><span>Distancia</span><strong>{{ distanciaTxt }}</strong></div>
          <div class="sv-kpi"><span>Llegada estimada</span><strong>{{ etaTxt }}</strong></div>
          <div class="sv-kpi"><span>Última señal</span><strong>{{ ultimaSenal }}</strong></div>
        </div>

        <div class="sv-linea">
          <div v-for="(p, i) in pasos" :key="p.key" class="sv-hito" :class="{ done: idxEstado > i, now: idxEstado === i }">
            <div class="sv-hito-pt"></div>
            <div><strong>{{ p.label }}</strong><small>{{ p.hora || '—' }}</small></div>
          </div>
        </div>

        <div class="sv-datos">
          <div v-if="seg?.destino_direccion"><span>📍 Dirección</span><strong>{{ seg.destino_direccion }}<template v-if="emerg?.distrito">, {{ emerg.distrito }}</template></strong></div>
          <div v-if="emerg?.tipo_equipo"><span>🛗 Equipo</span><strong>{{ emerg.tipo_equipo }}</strong></div>
          <div v-if="emerg?.elme"><span>🔖 ELME</span><strong>{{ emerg.elme }}</strong></div>
          <div v-if="emerg?.prioridad"><span>⚠️ Prioridad</span><strong style="text-transform:capitalize;">{{ emerg.prioridad }}</strong></div>
        </div>
        <p v-if="emerg?.descripcion" class="sv-desc">{{ emerg.descripcion }}</p>
        <div v-if="seg?.notas_cierre" class="sv-notas"><strong>Notas del técnico:</strong> {{ seg.notas_cierre }}</div>
      </section>
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
const seg = ref<any>(null)
const emerg = ref<any>(null)
const recorrido = ref<any[]>([])
const activo = ref(true)

const mapEl = ref<HTMLElement | null>(null)
let L: any = null, map: any = null
let mkTecnico: any = null, mkDestino: any = null, lineaReal: any = null, lineaRuta: any = null, circulo: any = null
let timer: any = null
let ultimoRuteo = 0

const estado = computed(() => seg.value?.estado || 'iniciado')
const enVivo = computed(() => activo.value)
const ETIQ: Record<string, string> = {
  iniciado: 'Asignada', en_camino: 'En camino', atendiendo: 'En sitio',
  finalizada: 'Finalizada', cancelada: 'Cancelada',
}
const etiquetaEstado = computed(() => ETIQ[estado.value] || estado.value)

const distanciaTxt = computed(() => {
  const d = seg.value?.distancia_destino_m
  if (d == null) return '—'
  return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`
})
const etaTxt = computed(() => {
  if (estado.value === 'atendiendo') return 'En sitio'
  if (estado.value === 'finalizada') return 'Finalizada'
  const s = seg.value?.eta_segundos
  if (!s) return '—'
  const m = Math.max(1, Math.round(s / 60))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
})
const ultimaSenal = computed(() => {
  if (!seg.value?.ultimo_ping) return '—'
  const s = Math.round((Date.now() - new Date(seg.value.ultimo_ping).getTime()) / 1000)
  if (s < 60) return `hace ${s}s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
})

const ORDEN = ['iniciado', 'en_camino', 'atendiendo', 'finalizada']
const idxEstado = computed(() => Math.max(0, ORDEN.indexOf(estado.value)))
const pasos = computed(() => [
  { key: 'iniciado', label: 'Asignada', hora: hora(seg.value?.iniciado_en) },
  { key: 'en_camino', label: 'En camino', hora: hora(seg.value?.en_camino_en) },
  { key: 'atendiendo', label: 'En sitio', hora: hora(seg.value?.atendiendo_en) },
  { key: 'finalizada', label: 'Finalizada', hora: hora(seg.value?.finalizada_en) },
])
function hora(v: any) {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

/** Leaflet + OpenStreetMap por CDN: gratis y sin API key. */
async function cargarLeaflet(): Promise<any> {
  if ((window as any).L) return (window as any).L
  await new Promise<void>((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar el mapa'))
    document.head.appendChild(s)
  })
  return (window as any).L
}

function iconoDiv(html: string, clase: string) {
  return L.divIcon({ html, className: clase, iconSize: [38, 38], iconAnchor: [19, 19] })
}

async function iniciarMapa() {
  L = await cargarLeaflet()
  if (!mapEl.value) return
  const centro = seg.value?.ultima_lat
    ? [seg.value.ultima_lat, seg.value.ultima_lng]
    : (seg.value?.destino_lat ? [seg.value.destino_lat, seg.value.destino_lng] : [-12.0464, -77.0428])

  map = L.map(mapEl.value, { zoomControl: true, attributionControl: true }).setView(centro, 14)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(map)

  if (seg.value?.destino_lat) {
    mkDestino = L.marker([seg.value.destino_lat, seg.value.destino_lng], {
      icon: iconoDiv('<div class="pin pin-dest">🏢</div>', 'pin-wrap'),
    }).addTo(map).bindPopup(`<b>${emerg.value?.edificio_nombre || 'Destino'}</b><br>${seg.value.destino_direccion || ''}`)
    circulo = L.circle([seg.value.destino_lat, seg.value.destino_lng], {
      radius: 200, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.08, weight: 1,
    }).addTo(map)
  }
  pintar(true)
}

function pintar(ajustar = false) {
  if (!map || !L) return
  const s = seg.value
  if (s?.ultima_lat) {
    const p: [number, number] = [s.ultima_lat, s.ultima_lng]
    if (!mkTecnico) {
      mkTecnico = L.marker(p, { icon: iconoDiv('<div class="pin pin-tec">🚐</div>', 'pin-wrap') })
        .addTo(map).bindPopup(`<b>${s.tecnico_nombre || 'Técnico'}</b>`)
    } else {
      mkTecnico.setLatLng(p)
    }
  }

  // Recorrido real
  const pts = recorrido.value.filter(x => x.lat && x.lng).map(x => [x.lat, x.lng])
  if (pts.length > 1) {
    if (lineaReal) lineaReal.setLatLngs(pts)
    else lineaReal = L.polyline(pts, { color: '#3b82f6', weight: 4, opacity: 0.85 }).addTo(map)
  }

  if (ajustar) {
    const todos: any[] = [...pts]
    if (s?.ultima_lat) todos.push([s.ultima_lat, s.ultima_lng])
    if (s?.destino_lat) todos.push([s.destino_lat, s.destino_lng])
    if (todos.length > 1) map.fitBounds(L.latLngBounds(todos), { padding: [50, 50], maxZoom: 16 })
    else if (todos.length === 1) map.setView(todos[0], 15)
  }
}

/** Ruta por calles + ETA con OSRM (gratis). */
async function trazarRuta() {
  const s = seg.value
  if (!map || !L || !s?.ultima_lat || !s?.destino_lat) return
  if (['atendiendo', 'finalizada', 'cancelada'].includes(estado.value)) return
  const ahora = Date.now()
  if (ahora - ultimoRuteo < 25000) return
  ultimoRuteo = ahora
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${s.ultima_lng},${s.ultima_lat};${s.destino_lng},${s.destino_lat}?overview=full&geometries=geojson`
    const r: any = await $fetch(url, { timeout: 8000 })
    const ruta = r?.routes?.[0]
    if (!ruta?.geometry?.coordinates) return
    const pts = ruta.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
    if (lineaRuta) lineaRuta.setLatLngs(pts)
    else lineaRuta = L.polyline(pts, { color: '#daa520', weight: 5, opacity: 0.55, dashArray: '8,10' }).addTo(map)
  } catch { /* si OSRM falla, el mapa igual muestra al técnico */ }
}

async function cargar(primera = false) {
  try {
    const r = await $fetch<any>(`/api/gatwick/seguimiento/${token}`)
    seg.value = r.seguimiento
    emerg.value = r.emergencia
    recorrido.value = r.recorrido || []
    activo.value = r.activo
    if (!primera) { pintar(); trazarRuta() }
  } catch (e: any) {
    if (primera) error.value = e?.data?.statusMessage || 'Link inválido o expirado'
  } finally {
    if (primera) cargando.value = false
  }
}

onMounted(async () => {
  await cargar(true)
  if (error.value) return
  await nextTick()
  await iniciarMapa()
  await trazarRuta()
  // Refresco cada 5 s (además del Realtime que ya emite Supabase en la tabla)
  timer = setInterval(() => { if (activo.value) cargar() }, 5000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer); if (map) map.remove() })
</script>

<style scoped>
.sv-shell {
  min-height: 100dvh; background: #0f1117; color: #e8eaed;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  display: flex; flex-direction: column;
}

.sv-center { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 30px; }
.sv-center h2 { margin: 6px 0 0; }
.sv-center p { color: #9aa0ac; margin: 0; }
.sv-spinner { width: 34px; height: 34px; border: 3px solid #2a2e3c; border-top-color: #daa520; border-radius: 50%; animation: sp .8s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }

.sv-top {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: #181a23; border-bottom: 1px solid #262a38;
}
.sv-top-l { display: flex; align-items: center; gap: 11px; min-width: 0; }
.sv-top-l strong { display: block; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-top-l small { color: #9aa0ac; font-size: 0.78rem; }
.sv-badge { font-size: 10.5px; font-weight: 700; padding: 5px 10px; border-radius: 999px; white-space: nowrap; }
.est-iniciado { background: rgba(234,179,8,.18); color: #facc15; }
.est-en_camino { background: rgba(37,99,235,.2); color: #60a5fa; }
.est-atendiendo { background: rgba(234,88,12,.2); color: #fb923c; }
.est-finalizada { background: rgba(34,197,94,.18); color: #4ade80; }
.est-cancelada { background: rgba(148,163,184,.18); color: #94a3b8; }
.sv-live { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4ade80; white-space: nowrap; }
.sv-live.off { color: #94a3b8; }
.sv-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 1.8s infinite; }
.sv-dot.off { background: #94a3b8; animation: none; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.7); } 70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }

.sv-map-wrap { position: relative; flex: 1; min-height: 46dvh; }
.sv-map { width: 100%; height: 100%; min-height: 46dvh; background: #1a1d27; }
.sv-map-msg { position: absolute; inset: auto 0 14px 0; text-align: center; font-size: 12.5px; color: #9aa0ac; pointer-events: none; }

.sv-panel { background: #181a23; border-top: 1px solid #262a38; padding: 15px 16px calc(20px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }

.sv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 11px; }
.sv-kpi { background: #1f2230; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.sv-kpi span { font-size: 10.5px; color: #9aa0ac; text-transform: uppercase; letter-spacing: .4px; }
.sv-kpi strong { font-size: 15px; }
.sv-tel { color: #7dd3fc; font-size: 12.5px; text-decoration: none; margin-top: 2px; }

.sv-linea { display: flex; gap: 4px; }
.sv-hito { flex: 1; display: flex; flex-direction: column; gap: 5px; opacity: .4; position: relative; }
.sv-hito.done, .sv-hito.now { opacity: 1; }
.sv-hito-pt { height: 4px; border-radius: 3px; background: #2f3446; }
.sv-hito.done .sv-hito-pt { background: #16a34a; }
.sv-hito.now .sv-hito-pt { background: #daa520; }
.sv-hito strong { font-size: 11.5px; display: block; }
.sv-hito small { font-size: 10.5px; color: #9aa0ac; }

.sv-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.sv-datos div { display: flex; flex-direction: column; }
.sv-datos span { font-size: 10.5px; color: #9aa0ac; }
.sv-datos strong { font-size: 13.5px; }
.sv-desc { margin: 0; padding: 10px 12px; background: #1f2230; border-radius: 9px; font-size: 13px; color: #c9cfda; }
.sv-notas { padding: 10px 12px; background: rgba(34,197,94,.1); border-radius: 9px; font-size: 13px; }

@media (min-width: 900px) {
  .sv-shell { flex-direction: row; flex-wrap: wrap; }
  .sv-top { width: 100%; }
  .sv-map-wrap { flex: 1 1 58%; min-height: calc(100dvh - 66px); }
  .sv-panel { flex: 1 1 340px; max-width: 420px; border-top: none; border-left: 1px solid #262a38; overflow-y: auto; max-height: calc(100dvh - 66px); }
}
</style>

<style>
/* Los iconos del mapa se inyectan fuera del scope de Vue */
.pin-wrap { background: transparent !important; border: none !important; }
.pin { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 19px; box-shadow: 0 3px 10px rgba(0,0,0,.45); border: 2px solid #fff; }
.pin-tec { background: #2563eb; }
.pin-dest { background: #dc2626; }
.leaflet-container { background: #1a1d27; }
</style>
