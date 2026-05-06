<template>
  <div class="remarketing-panel">
    <v-tabs v-model="tab" color="amber" density="compact" class="mb-4">
      <v-tab value="pipeline">Pipeline</v-tab>
      <v-tab value="leads">Leads</v-tab>
      <v-tab value="campaigns">Campanas</v-tab>
      <v-tab value="templates">Templates</v-tab>
    </v-tabs>

    <!-- ═══════════════════════════════════════
         PIPELINE — Funnel visual
    ═══════════════════════════════════════ -->
    <div v-if="tab === 'pipeline'" class="pipeline-view">
      <div class="pipeline-cards">
        <div class="pipeline-card frio" @click="filtroTemp = 'frio'; tab = 'leads'">
          <div class="pipeline-count">{{ stats.frios }}</div>
          <div class="pipeline-label">Frios</div>
          <div class="pipeline-sub">{{ stats.frios_contactables }} contactables</div>
        </div>
        <v-icon icon="mdi-chevron-right" size="24" style="opacity:0.3;" />
        <div class="pipeline-card tibio" @click="filtroTemp = 'tibio'; tab = 'leads'">
          <div class="pipeline-count">{{ stats.tibios }}</div>
          <div class="pipeline-label">Tibios</div>
          <div class="pipeline-sub">{{ stats.tibios_contactables }} contactables</div>
        </div>
        <v-icon icon="mdi-chevron-right" size="24" style="opacity:0.3;" />
        <div class="pipeline-card caliente" @click="filtroTemp = 'caliente'; tab = 'leads'">
          <div class="pipeline-count">{{ stats.calientes }}</div>
          <div class="pipeline-label">Calientes</div>
          <div class="pipeline-sub">{{ stats.calientes_contactables }} contactables</div>
        </div>
        <v-icon icon="mdi-chevron-right" size="24" style="opacity:0.3;" />
        <div class="pipeline-card convertido">
          <div class="pipeline-count">{{ stats.convertidos }}</div>
          <div class="pipeline-label">Convertidos</div>
          <div class="pipeline-sub">este mes</div>
        </div>
      </div>

      <!-- Metricas rapidas -->
      <v-row class="mt-4" dense>
        <v-col cols="6" md="3">
          <v-card flat class="metric-card">
            <div class="metric-value">{{ stats.tasa_frio_tibio }}%</div>
            <div class="metric-label">Frio → Tibio (30d)</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card flat class="metric-card">
            <div class="metric-value">{{ stats.tasa_tibio_caliente }}%</div>
            <div class="metric-label">Tibio → Caliente (14d)</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card flat class="metric-card">
            <div class="metric-value">{{ stats.tasa_caliente_agendado }}%</div>
            <div class="metric-label">Caliente → Agendado</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card flat class="metric-card">
            <div class="metric-value">{{ stats.mensajes_mes }}</div>
            <div class="metric-label">Mensajes enviados (mes)</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Campanas activas -->
      <v-card flat class="mt-4" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;">
        <v-card-title style="font-size: 0.9rem;">
          <v-icon icon="mdi-bullhorn" class="me-2" size="18" />
          Campanas activas
        </v-card-title>
        <v-card-text v-if="!campaignsActivas.length" style="opacity: 0.5; font-size: 0.85rem;">
          No hay campanas activas. Crea una desde la tab Campanas.
        </v-card-text>
        <v-card-text v-else>
          <div v-for="c in campaignsActivas" :key="c.id" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div>
              <strong>{{ c.nombre }}</strong>
              <span style="font-size:0.78rem; opacity:0.6; margin-left:8px;">{{ c.tipo }}</span>
            </div>
            <div style="font-size:0.82rem;">
              {{ c.enviados }}/{{ c.total_leads }} enviados · {{ c.respondidos }} resp.
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- ═══════════════════════════════════════
         LEADS — Lista filtrable con acciones
    ═══════════════════════════════════════ -->
    <div v-if="tab === 'leads'">
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <v-select
          v-model="filtroTemp"
          :items="['todos', 'frio', 'tibio', 'caliente']"
          label="Temperatura"
          density="compact" variant="outlined" hide-details
          style="max-width:160px;"
        />
        <v-text-field
          v-model="filtroBuscar"
          label="Buscar nombre/telefono"
          density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify"
          style="max-width:250px;"
        />
        <v-spacer />
        <v-btn
          color="amber"
          variant="elevated"
          size="small"
          prepend-icon="mdi-send"
          :disabled="!selectedLeads.length"
          @click="showBulkDialog = true"
        >
          Enviar a {{ selectedLeads.length }} seleccionados
        </v-btn>
      </div>

      <v-card flat style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden;">
        <div style="max-height:500px; overflow-y:auto;">
          <table class="rmk-table">
            <thead>
              <tr>
                <th><v-checkbox v-model="selectAll" hide-details density="compact" /></th>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Temp.</th>
                <th>Servicio</th>
                <th>Ultimo contacto</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lead in leadsFiltrados" :key="`${lead._tabla}-${lead.id}`">
                <td><v-checkbox v-model="selectedLeads" :value="lead" hide-details density="compact" /></td>
                <td>{{ lead.nombre === 'null' || !lead.nombre ? '—' : lead.nombre }}</td>
                <td style="font-size:0.82rem; font-family:monospace;">{{ formatPhone(lead.numero) }}</td>
                <td>
                  <v-chip :color="tempColor(lead.lead_status)" size="x-small" variant="tonal">
                    {{ tempLabel(lead.lead_status) }}
                  </v-chip>
                </td>
                <td style="font-size:0.82rem; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  {{ lead.servicio_interes || '—' }}
                </td>
                <td style="font-size:0.78rem; opacity:0.7;">
                  {{ lead._ultimo_contacto || formatDate(lead.created_at) }}
                </td>
                <td>
                  <v-btn
                    icon size="x-small" variant="text" color="success"
                    :disabled="!canContact(lead)"
                    @click="openSendDialog(lead)"
                    :title="canContact(lead) ? 'Enviar mensaje' : 'Anti-spam: esperar'"
                  >
                    <v-icon :icon="canContact(lead) ? 'mdi-whatsapp' : 'mdi-clock-outline'" size="18" />
                  </v-btn>
                </td>
              </tr>
              <tr v-if="!leadsFiltrados.length">
                <td colspan="7" style="text-align:center; padding:24px; opacity:0.5;">
                  {{ loadingLeads ? 'Cargando leads...' : 'No hay leads con estos filtros' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card>
    </div>

    <!-- ═══════════════════════════════════════
         CAMPAIGNS — CRUD de campanas masivas
    ═══════════════════════════════════════ -->
    <div v-if="tab === 'campaigns'">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:0.9rem; font-weight:600;">Campanas de remarketing</div>
        <v-btn color="amber" variant="elevated" size="small" prepend-icon="mdi-plus" @click="showNewCampaign = true">
          Nueva campana
        </v-btn>
      </div>

      <v-card v-for="c in campaigns" :key="c.id" flat class="mb-3" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px;">
        <v-card-text>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>{{ c.nombre }}</strong>
              <v-chip :color="campaignColor(c.estado)" size="x-small" variant="tonal" class="ms-2">{{ c.estado }}</v-chip>
              <v-chip size="x-small" variant="outlined" class="ms-1">{{ c.tipo }}</v-chip>
            </div>
            <div style="font-size:0.82rem;">
              {{ c.enviados }}/{{ c.total_leads }} enviados
              <span v-if="c.respondidos"> · {{ c.respondidos }} resp.</span>
              <span v-if="c.convertidos"> · {{ c.convertidos }} conv.</span>
            </div>
          </div>
          <div v-if="c.estado === 'borrador'" style="margin-top:8px;">
            <v-btn size="small" color="success" variant="elevated" prepend-icon="mdi-send" @click="ejecutarCampaign(c)">
              Ejecutar ahora
            </v-btn>
            <v-btn size="small" variant="text" color="error" class="ms-2" @click="cancelarCampaign(c)">
              Eliminar
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <div v-if="!campaigns.length" style="text-align:center; padding:32px; opacity:0.5;">
        No hay campanas. Crea una para empezar.
      </div>
    </div>

    <!-- ═══════════════════════════════════════
         TEMPLATES
    ═══════════════════════════════════════ -->
    <div v-if="tab === 'templates'">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="font-size:0.9rem; font-weight:600;">Templates de mensaje</div>
        <v-btn color="amber" variant="elevated" size="small" prepend-icon="mdi-plus" @click="showNewTemplate = true">
          Nuevo template
        </v-btn>
      </div>

      <v-card v-for="t in templates" :key="t.id" flat class="mb-2" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
        <v-card-text style="padding:10px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:0.88rem;">{{ t.nombre }}</strong>
              <v-chip size="x-small" variant="tonal" :color="tempColor(`lead_${t.temperatura}`)" class="ms-2">{{ t.temperatura }}</v-chip>
              <v-chip size="x-small" variant="outlined" class="ms-1">Cat {{ t.categoria_proc }}</v-chip>
              <v-chip size="x-small" variant="outlined" class="ms-1">{{ t.canal }}</v-chip>
            </div>
            <v-btn icon size="x-small" variant="text" @click="editTemplate(t)">
              <v-icon icon="mdi-pencil" size="16" />
            </v-btn>
          </div>
          <div style="font-size:0.82rem; opacity:0.7; margin-top:4px; font-style:italic;">
            {{ t.contenido.substring(0, 120) }}{{ t.contenido.length > 120 ? '...' : '' }}
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- ═══════════════════════════════════════
         DIALOG: Enviar mensaje individual
    ═══════════════════════════════════════ -->
    <v-dialog v-model="showSendDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>
          <v-icon icon="mdi-whatsapp" color="success" class="me-2" />
          Enviar mensaje a {{ sendTarget?.nombre || 'Lead' }}
        </v-card-title>
        <v-card-text>
          <v-select
            v-model="sendTemplateId"
            :items="templatesForLead"
            item-title="nombre"
            item-value="id"
            label="Template"
            density="compact" variant="outlined"
            class="mb-3"
          />
          <v-textarea
            v-model="sendMensaje"
            label="Mensaje"
            rows="4"
            density="compact" variant="outlined"
            hint="Variables: {{nombre}}, {{procedimiento}}"
          />
          <v-alert v-if="sendError" type="error" variant="tonal" density="compact" class="mt-2">{{ sendError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="showSendDialog = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn color="success" variant="elevated" :loading="sending" :disabled="!sendMensaje.trim()" @click="enviarMensaje">
            Enviar WhatsApp
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DIALOG: Envio bulk -->
    <v-dialog v-model="showBulkDialog" max-width="520" persistent>
      <v-card>
        <v-card-title>
          <v-icon icon="mdi-bullhorn" color="amber" class="me-2" />
          Campana rapida — {{ selectedLeads.length }} leads
        </v-card-title>
        <v-card-text>
          <v-text-field v-model="bulkNombre" label="Nombre de campana" density="compact" variant="outlined" class="mb-3" />
          <v-select
            v-model="bulkTemplateId"
            :items="templates"
            item-title="nombre"
            item-value="id"
            label="Template"
            density="compact" variant="outlined"
            class="mb-3"
          />
          <v-alert type="warning" variant="tonal" density="compact">
            Se enviara a {{ selectedLeads.length }} leads respetando reglas anti-spam.
            Leads fuera de cadencia seran omitidos.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="showBulkDialog = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn color="amber" variant="elevated" :loading="sending" @click="crearCampanaRapida">
            Crear y enviar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DIALOG: Nuevo template -->
    <v-dialog v-model="showNewTemplate" max-width="520" persistent>
      <v-card>
        <v-card-title>Nuevo Template</v-card-title>
        <v-card-text>
          <v-text-field v-model="newTpl.nombre" label="Nombre" density="compact" variant="outlined" class="mb-2" />
          <v-row dense>
            <v-col cols="6">
              <v-select v-model="newTpl.categoria_proc" :items="['A','B','C','D']" label="Categoria" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-select v-model="newTpl.temperatura" :items="['frio','tibio','caliente','recall']" label="Temperatura" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-textarea v-model="newTpl.contenido" label="Contenido" rows="4" density="compact" variant="outlined"
            hint="Variables: {{nombre}}, {{procedimiento}}, {{doctor}}, {{fecha}}, {{precio}}" />
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="showNewTemplate = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="elevated" @click="guardarTemplate">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DIALOG: Nueva campana -->
    <v-dialog v-model="showNewCampaign" max-width="520" persistent>
      <v-card>
        <v-card-title>Nueva Campana</v-card-title>
        <v-card-text>
          <v-text-field v-model="newCamp.nombre" label="Nombre" density="compact" variant="outlined" class="mb-2" />
          <v-row dense>
            <v-col cols="6">
              <v-select v-model="newCamp.tipo" :items="['seguimiento','reactivacion','recall','estacional','promocion']" label="Tipo" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-select v-model="newCamp.temperatura" :items="['frio','tibio','caliente']" label="Segmento temp." density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="newCamp.template_id"
            :items="templates"
            item-title="nombre"
            item-value="id"
            label="Template"
            density="compact" variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="showNewCampaign = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="elevated" @click="guardarCampaign">Crear borrador</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  companyId: string
  leadTablas: { wpp: string; fbig: string }
}>()

const supabase = useSupabaseClient()
const tab = ref('pipeline')

// ── Estado ──
const allLeads = ref<any[]>([])
const loadingLeads = ref(false)
const templates = ref<any[]>([])
const campaigns = ref<any[]>([])
const contactosRecientes = ref<any[]>([])
const selectedLeads = ref<any[]>([])
const selectAll = ref(false)
const filtroTemp = ref('todos')
const filtroBuscar = ref('')

// Dialogs
const showSendDialog = ref(false)
const showBulkDialog = ref(false)
const showNewTemplate = ref(false)
const showNewCampaign = ref(false)
const sendTarget = ref<any>(null)
const sendTemplateId = ref<number | null>(null)
const sendMensaje = ref('')
const sendError = ref('')
const sending = ref(false)
const bulkNombre = ref('')
const bulkTemplateId = ref<number | null>(null)

const newTpl = ref({ nombre: '', categoria_proc: 'A', temperatura: 'caliente', contenido: '' })
const newCamp = ref({ nombre: '', tipo: 'seguimiento', temperatura: 'frio', template_id: null as number | null })

// ── Stats ──
const stats = computed(() => {
  const leads = allLeads.value
  const frios = leads.filter(l => l.lead_status?.includes('fri'))
  const tibios = leads.filter(l => l.lead_status?.includes('tibi'))
  const calientes = leads.filter(l => l.lead_status?.includes('caliente'))

  return {
    frios: frios.length,
    tibios: tibios.length,
    calientes: calientes.length,
    convertidos: 0, // se calcula de pacientes
    frios_contactables: frios.filter(l => canContact(l)).length,
    tibios_contactables: tibios.filter(l => canContact(l)).length,
    calientes_contactables: calientes.filter(l => canContact(l)).length,
    tasa_frio_tibio: 0,
    tasa_tibio_caliente: 0,
    tasa_caliente_agendado: 0,
    mensajes_mes: contactosRecientes.value.length
  }
})

const campaignsActivas = computed(() =>
  campaigns.value.filter(c => c.estado === 'enviando' || c.estado === 'programada')
)

const leadsFiltrados = computed(() => {
  let leads = allLeads.value
  if (filtroTemp.value !== 'todos') {
    const key = filtroTemp.value === 'frio' ? 'fri' : filtroTemp.value === 'tibio' ? 'tibi' : 'caliente'
    leads = leads.filter(l => l.lead_status?.includes(key))
  }
  if (filtroBuscar.value.trim()) {
    const q = filtroBuscar.value.toLowerCase()
    leads = leads.filter(l =>
      (l.nombre || '').toLowerCase().includes(q) ||
      (l.numero || '').includes(q)
    )
  }
  return leads.slice(0, 200)
})

const templatesForLead = computed(() => {
  if (!sendTarget.value) return templates.value
  const temp = sendTarget.value.lead_status?.includes('fri') ? 'frio'
    : sendTarget.value.lead_status?.includes('tibi') ? 'tibio' : 'caliente'
  return templates.value.filter(t => t.temperatura === temp || t.temperatura === 'recall')
})

// Select all toggle
watch(selectAll, (v) => {
  selectedLeads.value = v ? [...leadsFiltrados.value] : []
})

// ── Helpers ──
const tempColor = (s: string) => s?.includes('fri') ? 'blue-grey' : s?.includes('tibi') ? 'orange' : s?.includes('caliente') ? 'red' : 'grey'
const tempLabel = (s: string) => s?.includes('fri') ? 'Frio' : s?.includes('tibi') ? 'Tibio' : s?.includes('caliente') ? 'Caliente' : '—'
const campaignColor = (s: string) => s === 'completada' ? 'success' : s === 'enviando' ? 'amber' : s === 'cancelada' ? 'error' : 'grey'
const formatPhone = (n: string) => n ? n.replace(/^51/, '') : '—'
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—'

const canContact = (lead: any) => {
  if (!lead.numero || lead.numero === 'null') return false
  const ultimo = contactosRecientes.value.find(c => c.lead_id === lead.id && c.lead_tabla === lead._tabla)
  if (!ultimo) return true
  const horasDesde = (Date.now() - new Date(ultimo.enviado_at).getTime()) / (1000 * 60 * 60)
  if (lead.lead_status?.includes('caliente')) return horasDesde >= 48
  if (lead.lead_status?.includes('tibi')) return horasDesde >= 120 // 5 dias
  return horasDesde >= 720 // 30 dias
}

// ── Carga de datos ──
const fetchLeads = async () => {
  loadingLeads.value = true
  const leads: any[] = []
  for (const [key, tabla] of Object.entries(props.leadTablas)) {
    const { data } = await (supabase.from(tabla as string) as any)
      .select('id,nombre,numero,lead_status,servicio_interes,created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    if (data?.length) {
      leads.push(...data.map((l: any) => ({ ...l, _tabla: tabla, _fuente: key })))
    }
  }
  allLeads.value = leads
  loadingLeads.value = false
}

const fetchTemplates = async () => {
  const { data } = await (supabase.from('remarketing_templates') as any)
    .select('*')
    .eq('company_id', props.companyId)
    .eq('activo', true)
    .order('temperatura').order('categoria_proc')
  templates.value = data || []
}

const fetchCampaigns = async () => {
  const { data } = await (supabase.from('remarketing_campaigns') as any)
    .select('*')
    .eq('company_id', props.companyId)
    .order('created_at', { ascending: false })
    .limit(20)
  campaigns.value = data || []
}

const fetchContactos = async () => {
  const mesActual = (() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
  })()
  const { data } = await (supabase.from('remarketing_contactos') as any)
    .select('id,lead_id,lead_tabla,enviado_at,respondio')
    .eq('company_id', props.companyId)
    .gte('enviado_at', mesActual)
    .order('enviado_at', { ascending: false })
  contactosRecientes.value = data || []
}

// ── Acciones ──
const openSendDialog = (lead: any) => {
  sendTarget.value = lead
  sendTemplateId.value = null
  sendError.value = ''
  const nombre = lead.nombre === 'null' ? '' : (lead.nombre || '')
  const servicio = lead.servicio_interes || ''
  sendMensaje.value = `Hola ${nombre}, `
  showSendDialog.value = true
}

watch(sendTemplateId, (id) => {
  if (!id) return
  const tpl = templates.value.find(t => t.id === id)
  if (!tpl) return
  let msg = tpl.contenido
  const nombre = sendTarget.value?.nombre === 'null' ? '' : (sendTarget.value?.nombre || '')
  msg = msg.replace(/\{\{nombre\}\}/g, nombre)
  msg = msg.replace(/\{\{procedimiento\}\}/g, sendTarget.value?.servicio_interes || '')
  sendMensaje.value = msg
})

const enviarMensaje = async () => {
  if (!sendTarget.value || !sendMensaje.value.trim()) return
  sending.value = true
  sendError.value = ''
  try {
    await $fetch('/api/remarketing/send', {
      method: 'POST',
      body: {
        company_id: props.companyId,
        lead_id: sendTarget.value.id,
        lead_tabla: sendTarget.value._tabla,
        lead_telefono: sendTarget.value.numero,
        lead_nombre: sendTarget.value.nombre,
        template_id: sendTemplateId.value,
        mensaje: sendMensaje.value
      }
    })
    showSendDialog.value = false
    fetchContactos()
  } catch (e: any) {
    sendError.value = e?.data?.statusMessage || e?.message || 'Error al enviar'
  } finally {
    sending.value = false
  }
}

const guardarTemplate = async () => {
  const t = newTpl.value
  if (!t.nombre || !t.contenido) return
  await (supabase.from('remarketing_templates') as any).insert({
    company_id: props.companyId,
    nombre: t.nombre,
    categoria_proc: t.categoria_proc,
    temperatura: t.temperatura,
    canal: 'whatsapp',
    contenido: t.contenido,
    activo: true
  })
  showNewTemplate.value = false
  newTpl.value = { nombre: '', categoria_proc: 'A', temperatura: 'caliente', contenido: '' }
  fetchTemplates()
}

const editTemplate = (t: any) => {
  newTpl.value = { nombre: t.nombre, categoria_proc: t.categoria_proc, temperatura: t.temperatura, contenido: t.contenido }
  showNewTemplate.value = true
}

const guardarCampaign = async () => {
  const c = newCamp.value
  if (!c.nombre) return
  // Contar leads del segmento
  const key = c.temperatura === 'frio' ? 'fri' : c.temperatura === 'tibio' ? 'tibi' : 'caliente'
  const total = allLeads.value.filter(l => l.lead_status?.includes(key)).length
  await (supabase.from('remarketing_campaigns') as any).insert({
    company_id: props.companyId,
    nombre: c.nombre,
    tipo: c.tipo,
    segmento: { temperatura: c.temperatura },
    template_id: c.template_id,
    estado: 'borrador',
    total_leads: total,
    creado_por: 'dashboard'
  })
  showNewCampaign.value = false
  newCamp.value = { nombre: '', tipo: 'seguimiento', temperatura: 'frio', template_id: null }
  fetchCampaigns()
}

const ejecutarCampaign = async (campaign: any) => {
  // Marcar como enviando
  await (supabase.from('remarketing_campaigns') as any)
    .update({ estado: 'enviando', ejecutada_at: new Date().toISOString() })
    .eq('id', campaign.id)

  // Obtener template
  const tpl = templates.value.find(t => t.id === campaign.template_id)
  if (!tpl) return

  // Filtrar leads del segmento
  const temp = campaign.segmento?.temperatura || 'frio'
  const key = temp === 'frio' ? 'fri' : temp === 'tibio' ? 'tibi' : 'caliente'
  const leadsSegmento = allLeads.value.filter(l => l.lead_status?.includes(key) && canContact(l))

  let enviados = 0
  for (const lead of leadsSegmento.slice(0, 50)) { // Max 50 por ejecucion
    try {
      let msg = tpl.contenido
      const nombre = lead.nombre === 'null' ? '' : (lead.nombre || '')
      msg = msg.replace(/\{\{nombre\}\}/g, nombre)
      msg = msg.replace(/\{\{procedimiento\}\}/g, lead.servicio_interes || '')

      await $fetch('/api/remarketing/send', {
        method: 'POST',
        body: {
          company_id: props.companyId,
          lead_id: lead.id,
          lead_tabla: lead._tabla,
          lead_telefono: lead.numero,
          lead_nombre: lead.nombre,
          template_id: campaign.template_id,
          mensaje: msg
        }
      })
      enviados++
      // Pausa 2s entre mensajes para no saturar
      await new Promise(r => setTimeout(r, 2000))
    } catch {}
  }

  await (supabase.from('remarketing_campaigns') as any)
    .update({ estado: 'completada', enviados })
    .eq('id', campaign.id)
  fetchCampaigns()
  fetchContactos()
}

const cancelarCampaign = async (c: any) => {
  await (supabase.from('remarketing_campaigns') as any)
    .update({ estado: 'cancelada' }).eq('id', c.id)
  fetchCampaigns()
}

const crearCampanaRapida = async () => {
  if (!selectedLeads.value.length || !bulkTemplateId.value) return
  sending.value = true
  const tpl = templates.value.find(t => t.id === bulkTemplateId.value)
  if (!tpl) { sending.value = false; return }

  // Crear campaign
  const { data: camp } = await (supabase.from('remarketing_campaigns') as any).insert({
    company_id: props.companyId,
    nombre: bulkNombre.value || `Campana rapida ${new Date().toLocaleDateString('es-PE')}`,
    tipo: 'seguimiento',
    segmento: { manual: true },
    template_id: bulkTemplateId.value,
    estado: 'enviando',
    total_leads: selectedLeads.value.length,
    ejecutada_at: new Date().toISOString(),
    creado_por: 'dashboard'
  }).select().single()

  let enviados = 0
  for (const lead of selectedLeads.value) {
    if (!canContact(lead)) continue
    try {
      let msg = tpl.contenido
      const nombre = lead.nombre === 'null' ? '' : (lead.nombre || '')
      msg = msg.replace(/\{\{nombre\}\}/g, nombre)
      msg = msg.replace(/\{\{procedimiento\}\}/g, lead.servicio_interes || '')

      await $fetch('/api/remarketing/send', {
        method: 'POST',
        body: {
          company_id: props.companyId,
          lead_id: lead.id,
          lead_tabla: lead._tabla,
          lead_telefono: lead.numero,
          lead_nombre: lead.nombre,
          template_id: bulkTemplateId.value,
          mensaje: msg,
          campaign_id: camp?.id
        }
      })
      enviados++
      await new Promise(r => setTimeout(r, 2000))
    } catch {}
  }

  if (camp?.id) {
    await (supabase.from('remarketing_campaigns') as any)
      .update({ estado: 'completada', enviados })
      .eq('id', camp.id)
  }

  showBulkDialog.value = false
  selectedLeads.value = []
  sending.value = false
  fetchCampaigns()
  fetchContactos()
}

// ── Init ──
onMounted(() => {
  fetchLeads()
  fetchTemplates()
  fetchCampaigns()
  fetchContactos()
})
</script>

<style scoped>
.remarketing-panel { padding: 0; }

.pipeline-cards {
  display: flex; align-items: center; gap: 12px; justify-content: center;
  flex-wrap: wrap;
}
.pipeline-card {
  flex: 1; min-width: 120px; max-width: 180px;
  padding: 16px; border-radius: 12px; text-align: center; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  transition: transform 0.15s, box-shadow 0.15s;
}
.pipeline-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
.pipeline-card.frio { background: rgba(96,125,139,0.15); border-color: rgba(96,125,139,0.3); }
.pipeline-card.tibio { background: rgba(255,152,0,0.12); border-color: rgba(255,152,0,0.3); }
.pipeline-card.caliente { background: rgba(244,67,54,0.12); border-color: rgba(244,67,54,0.3); }
.pipeline-card.convertido { background: rgba(76,175,80,0.12); border-color: rgba(76,175,80,0.3); }
.pipeline-count { font-size: 2rem; font-weight: 700; }
.pipeline-label { font-size: 0.88rem; font-weight: 600; margin-top: 2px; }
.pipeline-sub { font-size: 0.72rem; opacity: 0.6; margin-top: 2px; }

.metric-card {
  background: rgba(255,255,255,0.03) !important;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 14px; text-align: center;
}
.metric-value { font-size: 1.4rem; font-weight: 700; color: #daa520; }
.metric-label { font-size: 0.75rem; opacity: 0.65; margin-top: 2px; }

.rmk-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.rmk-table th { text-align: left; padding: 8px 10px; font-size: 0.78rem; opacity: 0.6; border-bottom: 1px solid rgba(255,255,255,0.08); }
.rmk-table td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.rmk-table tr:hover td { background: rgba(218,165,32,0.04); }
</style>
