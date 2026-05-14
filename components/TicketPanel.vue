<template>
  <div class="ticket-panel">

    <!-- ── HEADER ── -->
    <div class="tp-header">
      <div>
        <h2 class="tp-title">Soporte & Tickets</h2>
        <p class="tp-subtitle">{{ empresaNombre }}</p>
      </div>
      <button class="tp-btn-primary" @click="abrirNuevoTicket">
        <span style="font-size:1.1rem;">+</span> Nuevo Ticket
      </button>
    </div>

    <!-- ── TABS ── -->
    <div class="tp-tabs">
      <button :class="['tp-tab', { active: tab === 'mis_tickets' }]" @click="tab = 'mis_tickets'">
        Mis Tickets
        <span v-if="ticketsAbiertos > 0" class="tp-badge">{{ ticketsAbiertos }}</span>
      </button>
      <button v-if="isAlef" :class="['tp-tab', { active: tab === 'todos' }]" @click="tab = 'todos'; fetchTodos()">
        Todos
      </button>
    </div>

    <!-- ── LISTA TICKETS ── -->
    <div class="tp-list">
      <div v-if="loading" style="text-align:center;padding:2rem;color:var(--muted-foreground);">Cargando...</div>

      <div v-else-if="ticketsMostrados.length === 0" class="tp-empty">
        <div style="font-size:2rem;margin-bottom:0.5rem;">🎫</div>
        <p>No hay tickets {{ tab === 'mis_tickets' ? 'para esta empresa' : '' }}</p>
        <button class="tp-btn-secondary" @click="abrirNuevoTicket">Crear primer ticket</button>
      </div>

      <div v-for="t in ticketsMostrados" :key="t.id" class="tp-ticket-row" @click="abrirDetalle(t)">
        <div class="tp-ticket-left">
          <div class="tp-urgencia" :class="`urgencia-${t.urgencia}`"></div>
          <div>
            <div class="tp-ticket-titulo">{{ t.titulo }}</div>
            <div class="tp-ticket-meta">
              <span class="tp-chip" :class="`cat-${t.categoria}`">{{ labelCategoria(t.categoria) }}</span>
              <span v-if="isAlef" style="font-size:0.72rem;color:var(--muted-foreground);">{{ t.empresa_nombre }}</span>
              <span style="font-size:0.72rem;color:var(--muted-foreground);">{{ timeAgo(t.created_at) }}</span>
            </div>
          </div>
        </div>
        <div class="tp-ticket-right">
          <div class="tp-asignado">
            <div class="tp-avatar" :style="{background: colorMiembro(t.asignado_a)}">{{ t.asignado_a.split(' ').map((n:string)=>n[0]).join('').slice(0,2) }}</div>
            <span>{{ t.asignado_a }}</span>
          </div>
          <span class="tp-estado" :class="`estado-${t.estado}`">{{ labelEstado(t.estado) }}</span>
        </div>
      </div>
    </div>

    <!-- ══════ DIALOG: NUEVO TICKET ══════ -->
    <div v-if="showNuevo" class="tp-overlay" @click.self="showNuevo = false">
      <div class="tp-dialog">
        <div class="tp-dialog-header">
          <h3>Nuevo Ticket de Soporte</h3>
          <button class="tp-close" @click="showNuevo = false">✕</button>
        </div>

        <div v-if="!clasificacion" class="tp-dialog-body">
          <div class="tp-field">
            <label>Título del problema *</label>
            <input v-model="nuevoForm.titulo" type="text" class="tp-input" placeholder="Ej: El agente no responde bien en WhatsApp" />
          </div>
          <div class="tp-field">
            <label>Descripción detallada *</label>
            <textarea v-model="nuevoForm.descripcion" class="tp-textarea" rows="4"
              placeholder="Describe el problema con el mayor detalle posible: qué esperabas que pasara, qué pasó en realidad, desde cuándo ocurre..." />
          </div>
          <div class="tp-field">
            <label>Tu nombre</label>
            <input v-model="nuevoForm.creado_por" type="text" class="tp-input" :placeholder="currentUser || 'Tu nombre'" />
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:0.5rem;">
            <button class="tp-btn-secondary" @click="showNuevo = false">Cancelar</button>
            <button class="tp-btn-primary" :disabled="!nuevoForm.titulo || !nuevoForm.descripcion || clasificando" @click="clasificarTicket">
              <span v-if="clasificando">🤖 Clasificando...</span>
              <span v-else>Analizar con IA →</span>
            </button>
          </div>
        </div>

        <!-- Resultado clasificación -->
        <div v-else class="tp-dialog-body">
          <div class="tp-clasificacion-preview">
            <div class="tp-clas-header">
              <span style="font-size:1.2rem;">🤖</span>
              <span style="font-weight:600;font-size:0.95rem;">Clasificación automática</span>
            </div>
            <div class="tp-clas-grid">
              <div class="tp-clas-item">
                <span class="tp-clas-label">Asignado a</span>
                <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;">
                  <div class="tp-avatar" :style="{background: colorMiembro(clasificacion.asignado_a)}">{{ clasificacion.asignado_a.split(' ').map((n:string)=>n[0]).join('').slice(0,2) }}</div>
                  <span style="font-weight:600;">{{ clasificacion.asignado_a }}</span>
                </div>
              </div>
              <div class="tp-clas-item">
                <span class="tp-clas-label">Categoría</span>
                <span class="tp-chip" :class="`cat-${clasificacion.categoria}`" style="margin-top:0.25rem;display:inline-block;">{{ labelCategoria(clasificacion.categoria) }}</span>
              </div>
              <div class="tp-clas-item">
                <span class="tp-clas-label">Urgencia</span>
                <span class="tp-estado" :class="`urgencia-chip-${clasificacion.urgencia}`" style="margin-top:0.25rem;display:inline-block;">{{ clasificacion.urgencia.toUpperCase() }}</span>
              </div>
            </div>
            <div class="tp-clas-razon">
              <span class="tp-clas-label">Por qué:</span>
              <p>{{ clasificacion.razon }}</p>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">
            <button class="tp-btn-secondary" @click="clasificacion = null">← Editar</button>
            <button class="tp-btn-primary" :disabled="guardando" @click="guardarTicket">
              {{ guardando ? 'Guardando...' : 'Confirmar y Enviar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ DIALOG: DETALLE TICKET ══════ -->
    <div v-if="showDetalle && ticketActivo" class="tp-overlay" @click.self="showDetalle = false">
      <div class="tp-dialog tp-dialog--wide">
        <div class="tp-dialog-header">
          <div>
            <h3>{{ ticketActivo.titulo }}</h3>
            <div style="display:flex;gap:0.5rem;align-items:center;margin-top:4px;flex-wrap:wrap;">
              <span class="tp-chip" :class="`cat-${ticketActivo.categoria}`">{{ labelCategoria(ticketActivo.categoria) }}</span>
              <span class="tp-estado" :class="`estado-${ticketActivo.estado}`">{{ labelEstado(ticketActivo.estado) }}</span>
              <span style="font-size:0.72rem;color:var(--muted-foreground);">{{ timeAgo(ticketActivo.created_at) }}</span>
            </div>
          </div>
          <button class="tp-close" @click="showDetalle = false">✕</button>
        </div>
        <div class="tp-dialog-body" style="display:flex;gap:1.5rem;flex-wrap:wrap;">
          <!-- Izquierda: descripción + comentarios -->
          <div style="flex:1;min-width:260px;">
            <div class="tp-descripcion">{{ ticketActivo.descripcion }}</div>
            <div v-if="ticketActivo.ia_razon" style="font-size:0.78rem;color:var(--muted-foreground);margin-top:0.5rem;font-style:italic;">🤖 {{ ticketActivo.ia_razon }}</div>

            <div style="margin-top:1.25rem;">
              <div style="font-size:0.8rem;font-weight:600;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">Comentarios</div>
              <div v-if="comentarios.length === 0" style="font-size:0.82rem;color:var(--muted-foreground);">Sin comentarios aún.</div>
              <div v-for="c in comentarios" :key="c.id" class="tp-comentario" :class="{'tp-comentario--interna': c.es_nota_interna}">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-weight:600;font-size:0.82rem;">{{ c.autor }}</span>
                  <span style="font-size:0.7rem;color:var(--muted-foreground);">{{ timeAgo(c.created_at) }}<span v-if="c.es_nota_interna"> · nota interna</span></span>
                </div>
                <p style="margin:0;font-size:0.85rem;line-height:1.5;white-space:pre-wrap;">{{ c.contenido }}</p>
              </div>

              <!-- Nuevo comentario -->
              <div style="margin-top:0.75rem;">
                <textarea v-model="nuevoComentario" class="tp-textarea" rows="2" placeholder="Agregar comentario..." />
                <div style="display:flex;gap:0.5rem;margin-top:0.4rem;flex-wrap:wrap;">
                  <button class="tp-btn-secondary" style="font-size:0.78rem;" :disabled="!nuevoComentario" @click="agregarComentario(false)">Comentar</button>
                  <button v-if="isAlef" class="tp-btn-secondary" style="font-size:0.78rem;border-color:#f59e0b;color:#ca8a04;" :disabled="!nuevoComentario" @click="agregarComentario(true)">Nota interna</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Derecha: metadata + acciones Alef -->
          <div style="width:200px;flex-shrink:0;">
            <div class="tp-meta-block">
              <div class="tp-meta-label">Asignado a</div>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:4px;">
                <div class="tp-avatar" :style="{background: colorMiembro(ticketActivo.asignado_a)}">{{ ticketActivo.asignado_a.split(' ').map((n:string)=>n[0]).join('').slice(0,2) }}</div>
                <span style="font-size:0.85rem;font-weight:500;">{{ ticketActivo.asignado_a }}</span>
              </div>
            </div>
            <div class="tp-meta-block">
              <div class="tp-meta-label">Urgencia</div>
              <span class="tp-urgencia-text" :class="`urgencia-text-${ticketActivo.urgencia}`">{{ ticketActivo.urgencia.toUpperCase() }}</span>
            </div>
            <div class="tp-meta-block">
              <div class="tp-meta-label">Empresa</div>
              <span style="font-size:0.85rem;">{{ ticketActivo.empresa_nombre }}</span>
            </div>
            <div class="tp-meta-block">
              <div class="tp-meta-label">Creado por</div>
              <span style="font-size:0.85rem;">{{ ticketActivo.creado_por }}</span>
            </div>

            <!-- Acciones solo para Alef -->
            <div v-if="isAlef" style="margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem;">
              <div class="tp-meta-label">Cambiar estado</div>
              <select v-model="nuevoEstado" class="tp-select" @change="cambiarEstado">
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En progreso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
              <div class="tp-meta-label" style="margin-top:0.5rem;">Reasignar</div>
              <select v-model="nuevoAsignado" class="tp-select" @change="reasignar">
                <option value="Julio">Julio</option>
                <option value="Piero">Piero</option>
                <option value="Roberto">Roberto</option>
                <option value="Juan Pablo">Juan Pablo</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const props = defineProps<{
  companyId: string
  empresaNombre: string
  currentUser?: string
  isAlef?: boolean
}>()

const SUPABASE_URL = useRuntimeConfig().public.supabaseUrl || ''
const SUPABASE_KEY = useRuntimeConfig().public.supabaseKey || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Estado ──
const tab = ref('mis_tickets')
const loading = ref(false)
const tickets = ref<any[]>([])
const todosTickets = ref<any[]>([])
const comentarios = ref<any[]>([])
const showNuevo = ref(false)
const showDetalle = ref(false)
const ticketActivo = ref<any>(null)
const clasificacion = ref<any>(null)
const clasificando = ref(false)
const guardando = ref(false)
const nuevoComentario = ref('')
const nuevoEstado = ref('')
const nuevoAsignado = ref('')

const nuevoForm = ref({ titulo: '', descripcion: '', creado_por: props.currentUser || '' })

const ticketsMostrados = computed(() =>
  tab.value === 'todos' ? todosTickets.value : tickets.value
)
const ticketsAbiertos = computed(() =>
  tickets.value.filter(t => t.estado === 'abierto' || t.estado === 'en_progreso').length
)

// ── Fetch ──
async function fetchTickets() {
  loading.value = true
  const { data } = await supabase.from('alef_tickets').select('*')
    .eq('empresa_id', props.companyId).order('created_at', { ascending: false })
  tickets.value = data || []
  loading.value = false
}

async function fetchTodos() {
  loading.value = true
  const { data } = await supabase.from('alef_tickets').select('*')
    .order('created_at', { ascending: false })
  todosTickets.value = data || []
  loading.value = false
}

async function fetchComentarios(ticketId: string) {
  const { data } = await supabase.from('alef_ticket_comentarios').select('*')
    .eq('ticket_id', ticketId).order('created_at', { ascending: true })
  comentarios.value = data || []
}

// ── Nuevo ticket ──
function abrirNuevoTicket() {
  nuevoForm.value = { titulo: '', descripcion: '', creado_por: props.currentUser || '' }
  clasificacion.value = null
  showNuevo.value = true
}

async function clasificarTicket() {
  clasificando.value = true
  try {
    const res = await $fetch('/api/tickets/clasificar', {
      method: 'POST',
      body: {
        titulo: nuevoForm.value.titulo,
        descripcion: nuevoForm.value.descripcion,
        empresa: props.empresaNombre
      }
    })
    clasificacion.value = res
  } catch {
    clasificacion.value = { asignado_a: 'Juan Pablo', categoria: 'escalado', urgencia: 'media', razon: 'Error al clasificar. Asignado a Juan Pablo.' }
  }
  clasificando.value = false
}

async function guardarTicket() {
  guardando.value = true
  await supabase.from('alef_tickets').insert({
    empresa_id: props.companyId,
    empresa_nombre: props.empresaNombre,
    titulo: nuevoForm.value.titulo,
    descripcion: nuevoForm.value.descripcion,
    creado_por: nuevoForm.value.creado_por || props.currentUser || 'Usuario',
    categoria: clasificacion.value.categoria,
    urgencia: clasificacion.value.urgencia,
    asignado_a: clasificacion.value.asignado_a,
    ia_razon: clasificacion.value.razon,
    estado: 'abierto'
  })
  guardando.value = false
  showNuevo.value = false
  await fetchTickets()
}

// ── Detalle ──
async function abrirDetalle(t: any) {
  ticketActivo.value = t
  nuevoEstado.value = t.estado
  nuevoAsignado.value = t.asignado_a
  nuevoComentario.value = ''
  showDetalle.value = true
  await fetchComentarios(t.id)
}

async function agregarComentario(interna: boolean) {
  if (!nuevoComentario.value.trim()) return
  await supabase.from('alef_ticket_comentarios').insert({
    ticket_id: ticketActivo.value.id,
    autor: props.currentUser || 'Usuario',
    contenido: nuevoComentario.value.trim(),
    es_nota_interna: interna
  })
  nuevoComentario.value = ''
  await fetchComentarios(ticketActivo.value.id)
}

async function cambiarEstado() {
  await supabase.from('alef_tickets').update({
    estado: nuevoEstado.value,
    updated_at: new Date().toISOString(),
    resuelto_at: nuevoEstado.value === 'resuelto' ? new Date().toISOString() : null
  }).eq('id', ticketActivo.value.id)
  ticketActivo.value.estado = nuevoEstado.value
  await fetchTickets()
}

async function reasignar() {
  await supabase.from('alef_tickets').update({
    asignado_a: nuevoAsignado.value,
    updated_at: new Date().toISOString()
  }).eq('id', ticketActivo.value.id)
  ticketActivo.value.asignado_a = nuevoAsignado.value
  await fetchTickets()
}

// ── Helpers ──
const coloresMiembro: Record<string, string> = {
  'Julio': '#06b6d4', 'Piero': '#8b5cf6', 'Roberto': '#10b981', 'Juan Pablo': '#daa520'
}
function colorMiembro(nombre: string) { return coloresMiembro[nombre] || '#64748b' }

function labelCategoria(c: string) {
  return { prompt_estandar: 'Prompt', prompt_avanzado: 'Prompt Avanzado', dashboard: 'Dashboard', infraestructura: 'Infraestructura', escalado: 'Escalado' }[c] || c
}
function labelEstado(e: string) {
  return { abierto: 'Abierto', en_progreso: 'En progreso', resuelto: 'Resuelto', cerrado: 'Cerrado' }[e] || e
}
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Hace unos min'
  if (h < 24) return `Hace ${h}h`
  const d = Math.floor(h / 24)
  return `Hace ${d}d`
}

onMounted(fetchTickets)
</script>

<style scoped>
.ticket-panel { display: flex; flex-direction: column; gap: 0; height: 100%; }

.tp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.tp-title { font-size: 1.2rem; font-weight: 700; color: var(--foreground); margin: 0; }
.tp-subtitle { font-size: 0.78rem; color: var(--muted-foreground); margin: 0; }

.tp-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
.tp-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 500; color: var(--muted-foreground); cursor: pointer; margin-bottom: -1px; display: flex; align-items: center; gap: 0.4rem; transition: color 0.15s, border-color 0.15s; }
.tp-tab.active { color: var(--foreground); border-bottom-color: var(--primary); }
.tp-badge { background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 99px; }

.tp-list { display: flex; flex-direction: column; gap: 0.5rem; }
.tp-empty { text-align: center; padding: 3rem 1rem; color: var(--muted-foreground); }

.tp-ticket-row { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; background: var(--card); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; gap: 0.75rem; transition: border-color 0.15s, box-shadow 0.15s; }
.tp-ticket-row:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.tp-ticket-left { display: flex; align-items: flex-start; gap: 0.75rem; flex: 1; min-width: 0; }
.tp-ticket-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

.tp-urgencia { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
.urgencia-baja { background: #22c55e; }
.urgencia-media { background: #f59e0b; }
.urgencia-alta { background: #f97316; }
.urgencia-critica { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }

.tp-ticket-titulo { font-size: 0.9rem; font-weight: 600; color: var(--foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 380px; }
.tp-ticket-meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 3px; flex-wrap: wrap; }

.tp-chip { font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.cat-prompt_estandar { background: rgba(6,182,212,0.12); color: #0891b2; }
.cat-prompt_avanzado { background: rgba(139,92,246,0.12); color: #7c3aed; }
.cat-dashboard { background: rgba(16,185,129,0.12); color: #059669; }
.cat-infraestructura { background: rgba(218,165,32,0.12); color: #b45309; }
.cat-escalado { background: rgba(239,68,68,0.12); color: #dc2626; }

.tp-asignado { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--foreground); }
.tp-avatar { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; color: #fff; flex-shrink: 0; }

.tp-estado { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.estado-abierto { background: rgba(59,130,246,0.12); color: #2563eb; }
.estado-en_progreso { background: rgba(245,158,11,0.12); color: #d97706; }
.estado-resuelto { background: rgba(34,197,94,0.12); color: #16a34a; }
.estado-cerrado { background: rgba(100,116,139,0.12); color: #64748b; }

/* Dialogs */
.tp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
.tp-dialog { background: var(--card); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
.tp-dialog--wide { max-width: 760px; }
.tp-dialog-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.25rem 1.5rem 0.5rem; border-bottom: 1px solid var(--border); }
.tp-dialog-header h3 { font-size: 1rem; font-weight: 700; color: var(--foreground); margin: 0; }
.tp-close { background: none; border: none; font-size: 1rem; cursor: pointer; color: var(--muted-foreground); padding: 0; }
.tp-dialog-body { padding: 1rem 1.5rem 1.5rem; }

.tp-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
.tp-field label { font-size: 0.78rem; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; }
.tp-input { background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.88rem; color: var(--foreground); outline: none; width: 100%; box-sizing: border-box; }
.tp-input:focus { border-color: var(--primary); }
.tp-textarea { background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.88rem; color: var(--foreground); outline: none; width: 100%; box-sizing: border-box; resize: vertical; font-family: inherit; line-height: 1.5; }
.tp-textarea:focus { border-color: var(--primary); }
.tp-select { background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.6rem; font-size: 0.82rem; color: var(--foreground); outline: none; width: 100%; cursor: pointer; }

.tp-clasificacion-preview { background: var(--sidebar); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 0.5rem; }
.tp-clas-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.tp-clas-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem; }
.tp-clas-item { display: flex; flex-direction: column; }
.tp-clas-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); }
.tp-clas-razon { font-size: 0.82rem; color: var(--muted-foreground); }
.tp-clas-razon p { margin: 0.25rem 0 0; font-style: italic; }

.urgencia-chip-baja { background: rgba(34,197,94,0.12); color: #16a34a; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.urgencia-chip-media { background: rgba(245,158,11,0.12); color: #d97706; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.urgencia-chip-alta { background: rgba(249,115,22,0.12); color: #ea580c; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.urgencia-chip-critica { background: rgba(239,68,68,0.12); color: #dc2626; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; }

.tp-comentario { background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; margin-bottom: 0.5rem; }
.tp-comentario--interna { border-color: #f59e0b; background: rgba(245,158,11,0.05); }
.tp-descripcion { font-size: 0.88rem; line-height: 1.6; color: var(--foreground); white-space: pre-wrap; background: var(--sidebar); border-radius: 8px; padding: 0.75rem; }
.tp-meta-block { margin-bottom: 0.75rem; }
.tp-meta-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); margin-bottom: 2px; }
.tp-urgencia-text { font-size: 0.8rem; font-weight: 700; }
.urgencia-text-baja { color: #16a34a; }
.urgencia-text-media { color: #d97706; }
.urgencia-text-alta { color: #ea580c; }
.urgencia-text-critica { color: #dc2626; }

.tp-btn-primary { background: var(--primary); color: var(--primary-foreground, #fff); border: none; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: opacity 0.15s; }
.tp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-btn-secondary { background: transparent; color: var(--foreground); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: border-color 0.15s; }
.tp-btn-secondary:hover { border-color: var(--primary); }
.tp-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
