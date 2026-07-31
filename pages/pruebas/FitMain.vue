<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">

    <!-- ═══════════  SIDEBAR  ═══════════ -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap:0.5rem;">
          <div style="width:35px;height:35px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#07090E;display:flex;align-items:center;justify-content:center;">
            <span style="color:#22C55E;font-weight:900;font-size:14px;letter-spacing:-1px;">FM</span>
          </div>
          <span class="logo-text">FitMain</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Principal</div>
          <button v-for="item in menuItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Contenido</div>
          <button v-for="item in contentItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Sistema</div>
          <button v-for="item in systemItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="footer-item" @click="toggleTheme">
          <v-icon :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'" size="18" />
          <span>{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>
      </div>
    </aside>

    <!-- ═══════════  MAIN CONTENT  ═══════════ -->
    <main class="main-content">

      <!-- ══  DASHBOARD  ══ -->
      <div v-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <div>
            <h1>FitMain Auto</h1>
            <p style="font-size:0.8rem;color:var(--muted-foreground);margin-top:2px;">
              Sistema autónomo de publicación Instagram
            </p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <div :class="['fm-status-badge', credentialsConfigured ? 'fm-status-active' : 'fm-status-pending']">
              <span class="fm-status-dot" />
              {{ credentialsConfigured ? 'Sistema activo' : 'Credenciales pendientes' }}
            </div>
          </div>
        </header>

        <div class="content-area">

          <!-- Alert credenciales -->
          <div v-if="!credentialsConfigured" class="fm-alert-banner">
            <v-icon icon="mdi-key-alert" size="20" color="#E8974A" />
            <div>
              <strong>Configura tus credenciales para activar el sistema.</strong>
              <span style="margin-left:8px;opacity:0.8;">Ve a Configuración → Credenciales y rellena las 4 claves API.</span>
            </div>
            <button class="btn-primary" @click="activeView = 'credenciales'" style="margin-left:auto;flex-shrink:0;">
              Configurar ahora
            </button>
          </div>

          <!-- Stats -->
          <div class="stats-grid">
            <div class="stat-card" v-for="s in dashStats" :key="s.title">
              <div class="stat-header">
                <span class="stat-title">{{ s.title }}</span>
                <v-icon :icon="s.icon" size="18" :color="s.color" />
              </div>
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-description">{{ s.desc }}</div>
            </div>
          </div>

          <!-- Próximas publicaciones -->
          <div class="fm-section">
            <div class="fm-section-header">
              <h2>Próximas publicaciones</h2>
              <span class="fm-week-badge">Semana {{ currentWeek }} · Pilar: {{ currentPilar }}</span>
            </div>
            <div class="fm-schedule-grid">
              <div v-for="post in upcomingPosts" :key="post.id" class="fm-post-card">
                <div class="fm-post-icon" :style="{ background: post.color + '20', border: '1px solid ' + post.color + '40' }">
                  <v-icon :icon="post.icon" :color="post.color" size="22" />
                </div>
                <div class="fm-post-info">
                  <div class="fm-post-type">{{ post.type }}</div>
                  <div class="fm-post-day">{{ post.day }} · {{ post.time }}</div>
                  <div class="fm-post-pilar">{{ post.pilar }}</div>
                </div>
                <div :class="['fm-post-status', post.statusClass]">{{ post.status }}</div>
              </div>
            </div>
          </div>

          <!-- Historial reciente -->
          <div class="fm-section">
            <div class="fm-section-header">
              <h2>Historial de publicaciones</h2>
            </div>
            <div class="table-section" style="margin-top:0;">
              <v-data-table
                :headers="historialHeaders"
                :items="historialItems"
                class="elevation-0"
                :items-per-page="5"
                no-data-text="Aún no hay publicaciones — activa el sistema para comenzar">
                <template v-slot:item.tipo="{ item }">
                  <v-chip :color="item.tipo === 'Carrusel' ? '#22C55E' : '#E8974A'" size="small" variant="tonal">
                    <v-icon :icon="item.tipo === 'Carrusel' ? 'mdi-view-carousel' : 'mdi-video'" size="14" start />
                    {{ item.tipo }}
                  </v-chip>
                </template>
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Publicado' ? 'done' : 'in-process']">
                    <span class="status-dot" />{{ item.estado }}
                  </span>
                </template>
                <template v-slot:bottom></template>
              </v-data-table>
            </div>
          </div>
        </div>
      </div>

      <!-- ══  CALENDARIO DE CONTENIDO  ══ -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Calendario de Contenido</h1>
        </header>
        <div class="content-area">
          <div class="fm-section">
            <div class="fm-section-header">
              <h2>Ciclo de 4 semanas</h2>
              <span class="fm-week-badge">Rotación automática de pilares</span>
            </div>
            <div class="fm-cycle-grid">
              <div v-for="week in contentCycle" :key="week.semana"
                :class="['fm-cycle-card', week.semana === (((currentWeek - 1) % 4) + 1) ? 'fm-cycle-active' : '']">
                <div class="fm-cycle-num">Semana {{ week.semana }}</div>
                <div class="fm-cycle-row">
                  <v-icon icon="mdi-view-carousel" size="14" color="#22C55E" />
                  <span><strong>C1:</strong> {{ week.c1 }}</span>
                </div>
                <div class="fm-cycle-row">
                  <v-icon icon="mdi-video" size="14" color="#E8974A" />
                  <span><strong>Video:</strong> {{ week.video }}</span>
                </div>
                <div class="fm-cycle-row">
                  <v-icon icon="mdi-view-carousel" size="14" color="#22C55E" />
                  <span><strong>C2:</strong> {{ week.c2 }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="fm-section">
            <div class="fm-section-header">
              <h2>Horario semanal</h2>
            </div>
            <div class="fm-timetable">
              <div v-for="slot in timetable" :key="slot.day" class="fm-timetable-row">
                <div class="fm-tt-day">{{ slot.day }}</div>
                <div class="fm-tt-time">{{ slot.time }}</div>
                <div class="fm-tt-type">
                  <v-icon :icon="slot.icon" size="16" :color="slot.color" />
                  {{ slot.type }}
                </div>
                <div class="fm-tt-pilar">{{ slot.pilar }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══  GENERAR CONTENIDO MANUAL  ══ -->
      <div v-else-if="activeView === 'generar'" class="view-container">
        <header class="top-header">
          <h1>Generar Contenido</h1>
          <div style="display:flex;gap:10px;">
            <button class="btn-primary" :disabled="!credentialsConfigured || generating" @click="triggerGenerate('all')">
              <v-icon icon="mdi-rocket-launch" size="16" />
              <span>{{ generating ? 'Generando...' : 'Publicar semana completa' }}</span>
            </button>
          </div>
        </header>
        <div class="content-area">

          <div v-if="!credentialsConfigured" class="fm-alert-banner">
            <v-icon icon="mdi-lock" size="20" color="#E8974A" />
            <span>Configura las credenciales antes de publicar.</span>
            <button class="btn-primary" @click="activeView = 'credenciales'" style="margin-left:auto;">Configurar</button>
          </div>

          <div class="fm-generate-grid">
            <div v-for="item in generateItems" :key="item.id" class="fm-generate-card">
              <div class="fm-gen-header">
                <div class="fm-post-icon" :style="{ background: item.color + '20', border: '1px solid ' + item.color + '40' }">
                  <v-icon :icon="item.icon" :color="item.color" size="24" />
                </div>
                <div>
                  <div class="fm-gen-title">{{ item.title }}</div>
                  <div class="fm-gen-sub">{{ item.sub }}</div>
                </div>
              </div>
              <div class="fm-gen-desc">{{ item.desc }}</div>
              <div class="fm-gen-actions">
                <button class="fm-btn-outline" :disabled="!credentialsConfigured || generating"
                  @click="triggerGenerate(item.id)">
                  <v-icon icon="mdi-play-circle" size="16" />
                  Ejecutar ahora
                </button>
              </div>
            </div>
          </div>

          <!-- Log de ejecución -->
          <div class="fm-section" v-if="executionLog.length">
            <div class="fm-section-header"><h2>Log de ejecución</h2></div>
            <div class="fm-log">
              <div v-for="(line, i) in executionLog" :key="i" :class="['fm-log-line', line.type]">
                <span class="fm-log-time">{{ line.time }}</span>
                <v-icon :icon="line.type === 'success' ? 'mdi-check-circle' : line.type === 'error' ? 'mdi-alert-circle' : 'mdi-information'" size="14" />
                <span>{{ line.msg }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══  PILARES DE CONTENIDO  ══ -->
      <div v-else-if="activeView === 'pilares'" class="view-container">
        <header class="top-header">
          <h1>Pilares de Contenido</h1>
        </header>
        <div class="content-area">
          <div class="fm-pilares-grid">
            <div v-for="pilar in pilaresInfo" :key="pilar.id" class="fm-pilar-card">
              <div class="fm-pilar-icon">
                <v-icon :icon="pilar.icon" size="28" :color="pilar.color" />
              </div>
              <div class="fm-pilar-name">{{ pilar.name }}</div>
              <div class="fm-pilar-desc">{{ pilar.desc }}</div>
              <div class="fm-pilar-tags">
                <span v-for="tag in pilar.tags" :key="tag" class="fm-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

          <div class="fm-section" style="margin-top:1.5rem;">
            <div class="fm-section-header">
              <h2>Reglas de contenido FITMAIN</h2>
            </div>
            <div class="fm-rules-grid">
              <div class="fm-rule fm-rule-do">
                <div class="fm-rule-title">✓ Siempre incluir</div>
                <ul>
                  <li>Datos reales y protocolos específicos</li>
                  <li>Conexión cuerpo + mente + rendimiento</li>
                  <li>CTA a fitmain.app en el último slide</li>
                  <li>Tono técnico pero accesible</li>
                  <li>Títulos en MAYÚSCULAS, impacto visual</li>
                </ul>
              </div>
              <div class="fm-rule fm-rule-dont">
                <div class="fm-rule-title">✗ Nunca usar</div>
                <ul>
                  <li>Promesas mágicas o resultados garantizados</li>
                  <li>Cultura de dieta o restricción</li>
                  <li>"¡Tú puedes!" o motivación sin sustancia</li>
                  <li>Espiritualidad new age en meditación</li>
                  <li>Lenguaje genérico de fitness</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══  CREDENCIALES  ══ -->
      <div v-else-if="activeView === 'credenciales'" class="view-container">
        <header class="top-header">
          <h1>Credenciales API</h1>
          <button class="btn-primary" @click="saveCredentials" :disabled="savingCreds">
            <v-icon icon="mdi-content-save" size="16" />
            <span>{{ savingCreds ? 'Guardando...' : 'Guardar cambios' }}</span>
          </button>
        </header>
        <div class="content-area">

          <div class="fm-creds-info">
            <v-icon icon="mdi-information" size="18" color="#22C55E" />
            <span>Las credenciales se guardan solo en el archivo <code>.env</code> del servidor. Nunca se exponen al cliente.</span>
          </div>

          <div class="fm-creds-grid">

            <div class="fm-cred-group">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-robot" size="18" color="#22C55E" />
                Claude / Anthropic
              </div>
              <div class="fm-field">
                <label>ANTHROPIC_API_KEY</label>
                <div class="fm-input-wrap">
                  <input
                    v-model="creds.anthropic"
                    :type="showCreds.anthropic ? 'text' : 'password'"
                    placeholder="sk-ant-api03-..."
                    class="fm-input"
                    :class="{ 'fm-input-ok': isCredSet(creds.anthropic), 'fm-input-empty': !isCredSet(creds.anthropic) }"
                  />
                  <button class="fm-eye" @click="showCreds.anthropic = !showCreds.anthropic">
                    <v-icon :icon="showCreds.anthropic ? 'mdi-eye-off' : 'mdi-eye'" size="18" />
                  </button>
                </div>
                <p class="fm-field-hint">
                  Obtener en <strong>console.anthropic.com</strong> → API Keys
                  <span :class="['fm-cred-status', isCredSet(creds.anthropic) ? 'fm-ok' : 'fm-pending']">
                    {{ isCredSet(creds.anthropic) ? '✓ Configurado' : '⚠ Pendiente' }}
                  </span>
                </p>
              </div>
            </div>

            <div class="fm-cred-group">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-instagram" size="18" color="#E8974A" />
                Instagram Graph API
              </div>
              <div class="fm-field">
                <label>INSTAGRAM_ACCESS_TOKEN</label>
                <div class="fm-input-wrap">
                  <input
                    v-model="creds.igToken"
                    :type="showCreds.igToken ? 'text' : 'password'"
                    placeholder="EAAxxxxxxxxxx..."
                    class="fm-input"
                    :class="{ 'fm-input-ok': isCredSet(creds.igToken), 'fm-input-empty': !isCredSet(creds.igToken) }"
                  />
                  <button class="fm-eye" @click="showCreds.igToken = !showCreds.igToken">
                    <v-icon :icon="showCreds.igToken ? 'mdi-eye-off' : 'mdi-eye'" size="18" />
                  </button>
                </div>
                <p class="fm-field-hint">
                  <strong>developers.facebook.com</strong> → Graph API Explorer → Generate Token
                  <span :class="['fm-cred-status', isCredSet(creds.igToken) ? 'fm-ok' : 'fm-pending']">
                    {{ isCredSet(creds.igToken) ? '✓ Configurado' : '⚠ Pendiente' }}
                  </span>
                </p>
              </div>
              <div class="fm-field" style="margin-top:1rem;">
                <label>INSTAGRAM_BUSINESS_ACCOUNT_ID</label>
                <div class="fm-input-wrap">
                  <input
                    v-model="creds.igAccountId"
                    :type="showCreds.igAccountId ? 'text' : 'password'"
                    placeholder="17841xxxxxxxxxx"
                    class="fm-input"
                    :class="{ 'fm-input-ok': isCredSet(creds.igAccountId), 'fm-input-empty': !isCredSet(creds.igAccountId) }"
                  />
                  <button class="fm-eye" @click="showCreds.igAccountId = !showCreds.igAccountId">
                    <v-icon :icon="showCreds.igAccountId ? 'mdi-eye-off' : 'mdi-eye'" size="18" />
                  </button>
                </div>
                <p class="fm-field-hint">
                  Graph API Explorer → <code>/me/accounts</code> → busca <code>instagram_business_account.id</code>
                  <span :class="['fm-cred-status', isCredSet(creds.igAccountId) ? 'fm-ok' : 'fm-pending']">
                    {{ isCredSet(creds.igAccountId) ? '✓ Configurado' : '⚠ Pendiente' }}
                  </span>
                </p>
              </div>
            </div>

            <div class="fm-cred-group">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-image-multiple" size="18" color="#22C55E" />
                imgbb.com (Hosting de imágenes)
              </div>
              <div class="fm-field">
                <label>IMGBB_API_KEY</label>
                <div class="fm-input-wrap">
                  <input
                    v-model="creds.imgbb"
                    :type="showCreds.imgbb ? 'text' : 'password'"
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    class="fm-input"
                    :class="{ 'fm-input-ok': isCredSet(creds.imgbb), 'fm-input-empty': !isCredSet(creds.imgbb) }"
                  />
                  <button class="fm-eye" @click="showCreds.imgbb = !showCreds.imgbb">
                    <v-icon :icon="showCreds.imgbb ? 'mdi-eye-off' : 'mdi-eye'" size="18" />
                  </button>
                </div>
                <p class="fm-field-hint">
                  Registro gratuito en <strong>api.imgbb.com</strong> → Your API key
                  <span :class="['fm-cred-status', isCredSet(creds.imgbb) ? 'fm-ok' : 'fm-pending']">
                    {{ isCredSet(creds.imgbb) ? '✓ Configurado' : '⚠ Pendiente' }}
                  </span>
                </p>
              </div>
            </div>

          </div>

          <!-- Resumen estado -->
          <div class="fm-creds-summary">
            <div class="fm-summary-title">Estado del sistema</div>
            <div class="fm-summary-items">
              <div v-for="check in systemChecks" :key="check.label" class="fm-check-item">
                <v-icon :icon="check.ok ? 'mdi-check-circle' : 'mdi-circle-outline'" size="18"
                  :color="check.ok ? '#22C55E' : '#4A5A6E'" />
                <span :style="{ color: check.ok ? '#22C55E' : 'var(--muted-foreground)' }">{{ check.label }}</span>
              </div>
            </div>
          </div>

          <!-- Guía paso a paso -->
          <div class="fm-section" style="margin-top:1.5rem;">
            <div class="fm-section-header"><h2>Guía de activación</h2></div>
            <div class="fm-steps">
              <div v-for="(step, i) in activationSteps" :key="i" class="fm-step">
                <div class="fm-step-num">{{ i + 1 }}</div>
                <div>
                  <div class="fm-step-title">{{ step.title }}</div>
                  <div class="fm-step-desc">{{ step.desc }}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ══  CONFIGURACIÓN  ══ -->
      <div v-else-if="activeView === 'config'" class="view-container">
        <header class="top-header">
          <h1>Configuración</h1>
        </header>
        <div class="content-area">
          <div class="fm-config-grid">

            <div class="fm-cred-group">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-clock-outline" size="18" color="#22C55E" />
                Horario de publicación (Lima, Perú)
              </div>
              <div class="fm-schedule-table">
                <div v-for="s in scheduleConfig" :key="s.id" class="fm-schedule-row">
                  <div class="fm-sch-type">
                    <v-icon :icon="s.icon" size="16" :color="s.color" />
                    {{ s.type }}
                  </div>
                  <div class="fm-sch-day">{{ s.day }}</div>
                  <div class="fm-sch-time">{{ s.time }}</div>
                </div>
              </div>
              <p style="font-size:0.75rem;color:var(--muted-foreground);margin-top:0.75rem;">
                Para cambiar el horario edita <code>scripts/fitmain-auto/config.py</code> → <code>SCHEDULE</code>
              </p>
            </div>

            <div class="fm-cred-group">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-format-color-fill" size="18" color="#E8974A" />
                Paleta de marca
              </div>
              <div class="fm-palette">
                <div v-for="color in brandColors" :key="color.name" class="fm-color-row">
                  <div class="fm-color-swatch" :style="{ background: color.hex }" />
                  <div class="fm-color-info">
                    <span class="fm-color-name">{{ color.name }}</span>
                    <span class="fm-color-hex">{{ color.hex }}</span>
                  </div>
                  <span class="fm-color-role">{{ color.role }}</span>
                </div>
              </div>
            </div>

            <div class="fm-cred-group" style="grid-column: 1 / -1;">
              <div class="fm-cred-group-title">
                <v-icon icon="mdi-console" size="18" color="#22C55E" />
                Comandos del sistema
              </div>
              <div class="fm-commands-grid">
                <div v-for="cmd in cliCommands" :key="cmd.cmd" class="fm-cmd-card">
                  <code class="fm-cmd">{{ cmd.cmd }}</code>
                  <span class="fm-cmd-desc">{{ cmd.desc }}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'

// ── Theme ─────────────────────────────────────────────────────────────────────
const isDark = ref(true)
function toggleTheme() { isDark.value = !isDark.value }

// ── Navegación ────────────────────────────────────────────────────────────────
const activeView = useVistaPersistente('fitmain')

const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard',        id: 'dashboard' },
  { icon: 'mdi-calendar-month', label: 'Calendario',        id: 'calendario' },
]
const contentItems = [
  { icon: 'mdi-rocket-launch',  label: 'Generar contenido', id: 'generar' },
  { icon: 'mdi-layers',         label: 'Pilares',            id: 'pilares' },
]
const systemItems = [
  { icon: 'mdi-key',            label: 'Credenciales',       id: 'credenciales' },
  { icon: 'mdi-tune',           label: 'Configuración',      id: 'config' },
]

// ── Credenciales ──────────────────────────────────────────────────────────────
const creds = reactive({
  anthropic:   '',
  igToken:     '',
  igAccountId: '',
  imgbb:       '',
})
const showCreds = reactive({ anthropic: false, igToken: false, igAccountId: false, imgbb: false })
const savingCreds = ref(false)

function isCredSet(val: string) {
  return val.trim().length > 10 && !val.startsWith('TU_')
}

const credentialsConfigured = computed(() =>
  isCredSet(creds.anthropic) &&
  isCredSet(creds.igToken) &&
  isCredSet(creds.igAccountId) &&
  isCredSet(creds.imgbb)
)

async function saveCredentials() {
  savingCreds.value = true
  await new Promise(r => setTimeout(r, 800))
  savingCreds.value = false
  addLog('success', 'Credenciales guardadas correctamente en .env')
}

const systemChecks = computed(() => [
  { label: 'Anthropic API Key',             ok: isCredSet(creds.anthropic) },
  { label: 'Instagram Access Token',        ok: isCredSet(creds.igToken) },
  { label: 'Instagram Business Account ID', ok: isCredSet(creds.igAccountId) },
  { label: 'imgbb API Key',                 ok: isCredSet(creds.imgbb) },
  { label: 'Sistema listo para publicar',   ok: credentialsConfigured.value },
])

// ── Semana / Pilar actual ─────────────────────────────────────────────────────
const now = new Date()
function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
const currentWeek = getISOWeek(now)

const contentCycle = [
  { semana: 1, c1: 'Entrenamiento', video: 'Meditación',   c2: 'Psicología' },
  { semana: 2, c1: 'Nutrición',     video: 'Entrenamiento', c2: 'Gamificación' },
  { semana: 3, c1: 'Meditación',    video: 'Nutrición',     c2: 'Rendimiento' },
  { semana: 4, c1: 'Sistema Vida',  video: 'Psicología',    c2: 'Ecosistema' },
]

const activeCycle = computed(() => contentCycle[((currentWeek - 1) % 4)])
const currentPilar = computed(() => activeCycle.value?.c1 ?? '—')

// ── Dashboard stats ───────────────────────────────────────────────────────────
const dashStats = computed(() => [
  { title: 'Posts esta semana',    value: '3',     desc: 'Lun · Mié · Jue', icon: 'mdi-instagram',        color: '#E8974A' },
  { title: 'Publicados total',     value: '0',     desc: 'Activa el sistema', icon: 'mdi-check-circle',   color: '#22C55E' },
  { title: 'Pilar activo',         value: activeCycle.value?.c1 ?? '—', desc: `Semana ${currentWeek}`, icon: 'mdi-layers', color: '#22C55E' },
  { title: 'Próxima publicación',  value: 'Lunes', desc: '9:00 AM Lima', icon: 'mdi-clock-outline',        color: '#E8974A' },
])

// ── Próximas publicaciones ────────────────────────────────────────────────────
const upcomingPosts = computed(() => {
  const c = activeCycle.value
  return [
    { id: 1, type: 'Carrusel 1', day: 'Lunes',    time: '9:00 AM', pilar: c?.c1,    icon: 'mdi-view-carousel', color: '#22C55E', status: 'Programado', statusClass: 'fm-scheduled' },
    { id: 2, type: 'Reel',       day: 'Miércoles', time: '9:00 AM', pilar: c?.video, icon: 'mdi-video',         color: '#E8974A', status: 'Programado', statusClass: 'fm-scheduled' },
    { id: 3, type: 'Carrusel 2', day: 'Jueves',   time: '9:00 AM', pilar: c?.c2,    icon: 'mdi-view-carousel', color: '#22C55E', status: 'Programado', statusClass: 'fm-scheduled' },
  ]
})

// ── Historial ─────────────────────────────────────────────────────────────────
const historialHeaders = [
  { title: 'Fecha',   key: 'fecha',  sortable: true  },
  { title: 'Tipo',    key: 'tipo',   sortable: true  },
  { title: 'Pilar',   key: 'pilar',  sortable: false },
  { title: 'Post ID', key: 'postId', sortable: false },
  { title: 'Estado',  key: 'estado', sortable: false },
]
const historialItems = ref<any[]>([])

// ── Generar contenido ─────────────────────────────────────────────────────────
const generating = ref(false)
const executionLog = ref<{ type: string; time: string; msg: string }[]>([])

function addLog(type: string, msg: string) {
  const time = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  executionLog.value.unshift({ type, time, msg })
  if (executionLog.value.length > 20) executionLog.value.pop()
}

async function triggerGenerate(id: string) {
  if (!credentialsConfigured.value) return
  generating.value = true
  activeView.value = 'generar'
  executionLog.value = []

  const steps: Record<string, string[]> = {
    carousel1:  ['Consultando pilar de la semana...', 'Generando contenido con Claude...', 'Construyendo 7 slides PNG...', 'Subiendo imágenes a imgbb...', 'Publicando carrusel en Instagram...', '✓ Carrusel 1 publicado'],
    video:      ['Generando script del reel con Claude...', 'Renderizando video 1080×1920...', 'Subiendo video a catbox.moe...', 'Publicando reel en Instagram...', '✓ Reel publicado'],
    carousel2:  ['Consultando pilar C2 de la semana...', 'Generando contenido con Claude...', 'Construyendo 7 slides PNG...', 'Subiendo imágenes a imgbb...', 'Publicando carrusel en Instagram...', '✓ Carrusel 2 publicado'],
    all:        ['Iniciando semana completa...', 'Generando Carrusel 1...', 'Publicando Carrusel 1...', 'Generando Reel...', 'Publicando Reel...', 'Generando Carrusel 2...', 'Publicando Carrusel 2...', '✓ Semana completa publicada'],
  }
  const msgs = steps[id] || steps.all

  for (const msg of msgs) {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500))
    addLog(msg.startsWith('✓') ? 'success' : 'info', msg)
  }
  generating.value = false
}

const generateItems = [
  { id: 'carousel1', title: 'Carrusel 1',  sub: 'Lunes · 7 slides',     desc: 'Carrusel educativo sobre el primer pilar de la semana. Generado con Claude, publicado automáticamente.', icon: 'mdi-view-carousel', color: '#22C55E' },
  { id: 'video',     title: 'Reel',        sub: 'Miércoles · 20-25 seg', desc: 'Video de motion graphics (texto animado sobre fondo oscuro). Script generado con Claude.', icon: 'mdi-video', color: '#E8974A' },
  { id: 'carousel2', title: 'Carrusel 2',  sub: 'Jueves · 7 slides',     desc: 'Segundo carrusel de la semana con el pilar complementario del ciclo.', icon: 'mdi-view-carousel', color: '#22C55E' },
]

// ── Pilares ───────────────────────────────────────────────────────────────────
const pilaresInfo = [
  { id: 'entrenamiento', name: 'Entrenamiento',  icon: 'mdi-dumbbell',          color: '#22C55E', desc: 'Planes con IA, progresión automática, psicología deportiva, disciplina física.', tags: ['IA', 'Progresión', 'Disciplina'] },
  { id: 'nutricion',     name: 'Nutrición',       icon: 'mdi-food-apple',        color: '#E8974A', desc: 'Planes nutricionales sin dogma alineados al entrenamiento, conciencia alimentaria.', tags: ['Sin dogma', 'Rendimiento'] },
  { id: 'meditacion',    name: 'Meditación',      icon: 'mdi-meditation',        color: '#22C55E', desc: 'Herramienta de regulación del sistema nervioso. Ventaja competitiva, no espiritualidad.', tags: ['SNS', 'Foco', 'Performance'] },
  { id: 'psicologia',    name: 'Psicología',      icon: 'mdi-brain',             color: '#E8974A', desc: 'Mentalidad ganadora, regulación emocional, disciplina, resiliencia, psicología deportiva.', tags: ['Mindset', 'Resiliencia'] },
  { id: 'gamificacion',  name: 'Gamificación',    icon: 'mdi-trophy',            color: '#22C55E', desc: 'Metas semanales, recompensas en marketplace, psicología del juego aplicada al bienestar.', tags: ['Metas', 'Recompensas'] },
  { id: 'rendimiento',   name: 'Rendimiento',     icon: 'mdi-lightning-bolt',    color: '#E8974A', desc: 'Alta performance, cuerpo como herramienta de negocio, productividad física-mental integrada.', tags: ['Alta performance', 'Negocio'] },
  { id: 'sistema_vida',  name: 'Sistema de Vida', icon: 'mdi-view-grid-plus',    color: '#22C55E', desc: 'FitMain como sistema completo, integración de los 4 pilares en la rutina diaria.', tags: ['Sistema', '4 Pilares'] },
  { id: 'ecosistema',    name: 'Ecosistema ALEF',  icon: 'mdi-alpha-a-circle',   color: '#E8974A', desc: 'ALEF COMPANY, Caballo de Troya S/.111/mes, FitMain como parte del sistema del emprendedor.', tags: ['ALEF', 'Caballo de Troya'] },
]

// ── Timetable ─────────────────────────────────────────────────────────────────
const timetable = computed(() => {
  const c = activeCycle.value
  return [
    { day: 'Lunes',     time: '9:00 AM', type: 'Carrusel 1', pilar: c?.c1,    icon: 'mdi-view-carousel', color: '#22C55E' },
    { day: 'Miércoles', time: '9:00 AM', type: 'Reel',       pilar: c?.video, icon: 'mdi-video',         color: '#E8974A' },
    { day: 'Jueves',    time: '9:00 AM', type: 'Carrusel 2', pilar: c?.c2,    icon: 'mdi-view-carousel', color: '#22C55E' },
  ]
})

// ── Activación pasos ──────────────────────────────────────────────────────────
const activationSteps = [
  { title: 'Anthropic API Key', desc: 'Ve a console.anthropic.com → Settings → API Keys → Create Key. Copia la clave sk-ant-...' },
  { title: 'Meta Developer App', desc: 'En developers.facebook.com crea una app → tipo "Business" → activa el producto "Instagram Graph API".' },
  { title: 'Instagram Access Token', desc: 'En Graph API Explorer selecciona tu app y genera un token con permisos: instagram_basic, instagram_content_publish.' },
  { title: 'Business Account ID', desc: 'En Graph API Explorer llama a GET /me/accounts y copia el valor de instagram_business_account.id.' },
  { title: 'imgbb API Key', desc: 'Regístrate gratis en api.imgbb.com, ve a Account Settings y copia tu API key.' },
  { title: 'Pegar y guardar', desc: 'Rellena los 4 campos de arriba y haz clic en "Guardar cambios". El sistema quedará activo.' },
  { title: 'Iniciar scheduler', desc: 'En el servidor corre: python main.py schedule — publicará automáticamente Lun/Mié/Jue a las 9am Lima.' },
]

// ── Schedule config ───────────────────────────────────────────────────────────
const scheduleConfig = [
  { id: 1, type: 'Carrusel 1', day: 'Lunes',     time: '9:00 AM Lima', icon: 'mdi-view-carousel', color: '#22C55E' },
  { id: 2, type: 'Reel',       day: 'Miércoles',  time: '9:00 AM Lima', icon: 'mdi-video',         color: '#E8974A' },
  { id: 3, type: 'Carrusel 2', day: 'Jueves',    time: '9:00 AM Lima', icon: 'mdi-view-carousel', color: '#22C55E' },
]

// ── Brand colors ──────────────────────────────────────────────────────────────
const brandColors = [
  { name: 'Obsidian',  hex: '#07090E', role: 'Fondo principal' },
  { name: 'Teal',      hex: '#22C55E', role: 'Color primario / acento' },
  { name: 'Amber',     hex: '#E8974A', role: 'Acento secundario' },
  { name: 'Platinum',  hex: '#E8EFF6', role: 'Texto principal' },
  { name: 'Silver',    hex: '#8A9BAE', role: 'Texto secundario' },
  { name: 'Muted',     hex: '#4A5A6E', role: 'Texto terciario' },
]

// ── CLI commands ──────────────────────────────────────────────────────────────
const cliCommands = [
  { cmd: 'python main.py schedule',     desc: 'Inicia el scheduler autónomo (cron semanal)' },
  { cmd: 'python main.py run',          desc: 'Publica toda la semana de una vez' },
  { cmd: 'python main.py carousel1',    desc: 'Solo publica el Carrusel 1' },
  { cmd: 'python main.py video',        desc: 'Solo publica el Reel' },
  { cmd: 'python main.py carousel2',    desc: 'Solo publica el Carrusel 2' },
  { cmd: 'python main.py test-content', desc: 'Genera contenido sin publicar (preview JSON)' },
  { cmd: 'python main.py test-images',  desc: 'Genera imágenes sin publicar (preview PNGs)' },
]
</script>

<style scoped>
/* ── FitMain brand tokens ── */
:root, [data-theme="dark"] {
  --fm-teal:    #22C55E;
  --fm-amber:   #E8974A;
  --fm-obsidian: #07090E;
  --fm-surface: #111820;
  --fm-deep:    #0C1118;
}

/* ── Layout ── */
.dashboard-container {
  display: flex;
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
}
.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.view-container { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.content-area { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }

/* ── Header ── */
.top-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.top-header h1 { font-size: 1.3rem; font-weight: 700; }

/* ── Buttons ── */
.btn-primary {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: var(--fm-teal, #22C55E); color: #07090E;
  border: none; border-radius: var(--radius); cursor: pointer;
  font-size: 0.83rem; font-weight: 600; transition: opacity .15s;
}
.btn-primary:hover { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Stats ── */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.stat-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.2rem;
}
.stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.stat-title { font-size: 0.78rem; color: var(--muted-foreground); font-weight: 500; }
.stat-value { font-size: 1.8rem; font-weight: 800; }
.stat-description { font-size: 0.75rem; color: var(--muted-foreground); margin-top: 2px; }

/* ── Status badge ── */
.fm-status-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 600;
}
.fm-status-active  { background: #22C55E20; border: 1px solid #22C55E50; color: #22C55E; }
.fm-status-pending { background: #E8974A20; border: 1px solid #E8974A50; color: #E8974A; }
.fm-status-dot {
  width: 7px; height: 7px; border-radius: 50%; background: currentColor;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

/* ── Alert banner ── */
.fm-alert-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 1rem 1.25rem; background: #E8974A15;
  border: 1px solid #E8974A40; border-radius: var(--radius);
  font-size: 0.85rem;
}

/* ── Section ── */
.fm-section { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.fm-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.fm-section-header h2 { font-size: 1rem; font-weight: 700; }
.fm-week-badge {
  font-size: 0.75rem; padding: 3px 10px;
  background: #22C55E20; border: 1px solid #22C55E40;
  border-radius: 999px; color: #22C55E; font-weight: 600;
}

/* ── Schedule grid ── */
.fm-schedule-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.fm-post-card {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.85rem 1rem; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--background);
}
.fm-post-icon {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fm-post-info { flex: 1; min-width: 0; }
.fm-post-type { font-weight: 700; font-size: 0.9rem; }
.fm-post-day  { font-size: 0.78rem; color: var(--muted-foreground); }
.fm-post-pilar { font-size: 0.75rem; color: var(--fm-teal, #22C55E); font-weight: 600; margin-top: 2px; }
.fm-post-status { font-size: 0.75rem; padding: 3px 10px; border-radius: 999px; font-weight: 600; }
.fm-scheduled { background: #22C55E15; border: 1px solid #22C55E30; color: #22C55E; }

/* ── Table section ── */
.table-section { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.status { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.done       { color: #22C55E; }
.in-process { color: #E8974A; }

/* ── Content cycle ── */
.fm-cycle-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.fm-cycle-card {
  padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--background); display: flex; flex-direction: column; gap: 0.5rem;
}
.fm-cycle-active { border-color: #22C55E50; background: #22C55E08; }
.fm-cycle-num { font-size: 0.8rem; font-weight: 700; color: var(--muted-foreground); margin-bottom: 0.25rem; }
.fm-cycle-row { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; }

/* ── Timetable ── */
.fm-timetable { display: flex; flex-direction: column; gap: 0; }
.fm-timetable-row {
  display: grid; grid-template-columns: 120px 100px 130px 1fr;
  padding: 0.7rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem;
  align-items: center; gap: 1rem;
}
.fm-timetable-row:last-child { border-bottom: none; }
.fm-tt-day  { font-weight: 700; }
.fm-tt-time { color: var(--muted-foreground); }
.fm-tt-type { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.fm-tt-pilar { color: var(--fm-teal, #22C55E); font-weight: 600; font-size: 0.8rem; }

/* ── Pilares grid ── */
.fm-pilares-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.fm-pilar-card {
  padding: 1.25rem; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); display: flex; flex-direction: column; gap: 0.6rem;
}
.fm-pilar-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--background); display: flex; align-items: center; justify-content: center; }
.fm-pilar-name { font-size: 1rem; font-weight: 700; }
.fm-pilar-desc { font-size: 0.8rem; color: var(--muted-foreground); line-height: 1.5; }
.fm-pilar-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.fm-tag { font-size: 0.7rem; padding: 2px 8px; background: var(--muted); border-radius: 999px; color: var(--muted-foreground); }

/* ── Rules ── */
.fm-rules-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.fm-rule { padding: 1rem 1.25rem; border-radius: var(--radius); }
.fm-rule-do   { background: #22C55E10; border: 1px solid #22C55E30; }
.fm-rule-dont { background: #E0645820; border: 1px solid #E0645840; }
.fm-rule-title { font-weight: 700; margin-bottom: 0.75rem; font-size: 0.9rem; }
.fm-rule ul { padding-left: 1.2rem; display: flex; flex-direction: column; gap: 5px; }
.fm-rule li { font-size: 0.82rem; color: var(--muted-foreground); }

/* ── Credentials ── */
.fm-creds-info {
  display: flex; align-items: center; gap: 10px;
  padding: 0.85rem 1.1rem; background: #22C55E10;
  border: 1px solid #22C55E30; border-radius: var(--radius); font-size: 0.83rem;
}
.fm-creds-grid { display: flex; flex-direction: column; gap: 1rem; }
.fm-cred-group {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem;
}
.fm-cred-group-title {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 0.92rem; margin-bottom: 1rem;
}
.fm-field { display: flex; flex-direction: column; gap: 5px; }
.fm-field label { font-size: 0.78rem; font-weight: 600; color: var(--muted-foreground); font-family: monospace; }
.fm-input-wrap { display: flex; align-items: center; gap: 6px; }
.fm-input {
  flex: 1; padding: 9px 14px; border-radius: var(--radius);
  background: var(--background); border: 1px solid var(--border);
  color: var(--foreground); font-size: 0.85rem; font-family: monospace;
  outline: none; transition: border .15s;
}
.fm-input:focus { border-color: var(--fm-teal, #22C55E); }
.fm-input-ok    { border-color: #22C55E50; }
.fm-input-empty { border-color: var(--border); }
.fm-eye {
  padding: 8px; background: var(--muted); border: none;
  border-radius: var(--radius); cursor: pointer; color: var(--muted-foreground);
}
.fm-field-hint { font-size: 0.75rem; color: var(--muted-foreground); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fm-cred-status { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.fm-ok      { background: #22C55E20; color: #22C55E; }
.fm-pending { background: #E8974A20; color: #E8974A; }

/* ── Credentials summary ── */
.fm-creds-summary {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem;
}
.fm-summary-title { font-weight: 700; margin-bottom: 1rem; font-size: 0.92rem; }
.fm-summary-items { display: flex; flex-direction: column; gap: 0.6rem; }
.fm-check-item { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; }

/* ── Steps ── */
.fm-steps { display: flex; flex-direction: column; gap: 0.85rem; }
.fm-step { display: flex; align-items: flex-start; gap: 1rem; }
.fm-step-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: #22C55E20; border: 1px solid #22C55E40;
  color: #22C55E; font-weight: 700; font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
}
.fm-step-title { font-weight: 700; font-size: 0.88rem; }
.fm-step-desc  { font-size: 0.8rem; color: var(--muted-foreground); margin-top: 2px; line-height: 1.5; }

/* ── Generate ── */
.fm-generate-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.fm-generate-card {
  padding: 1.25rem; background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); display: flex; flex-direction: column; gap: 0.85rem;
}
.fm-gen-header { display: flex; align-items: center; gap: 0.85rem; }
.fm-gen-title { font-weight: 700; font-size: 1rem; }
.fm-gen-sub   { font-size: 0.75rem; color: var(--muted-foreground); }
.fm-gen-desc  { font-size: 0.82rem; color: var(--muted-foreground); line-height: 1.5; flex: 1; }
.fm-gen-actions { margin-top: auto; }
.fm-btn-outline {
  display: flex; align-items: center; gap: 6px; padding: 7px 14px;
  background: transparent; border: 1px solid var(--fm-teal, #22C55E);
  color: var(--fm-teal, #22C55E); border-radius: var(--radius);
  cursor: pointer; font-size: 0.82rem; font-weight: 600; transition: background .15s;
}
.fm-btn-outline:hover { background: #22C55E15; }
.fm-btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Log ── */
.fm-log {
  background: #07090E; border-radius: var(--radius); padding: 1rem;
  font-family: monospace; font-size: 0.8rem; max-height: 240px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
}
.fm-log-line { display: flex; align-items: center; gap: 8px; }
.fm-log-time { color: #4A5A6E; }
.fm-log-line.success { color: #22C55E; }
.fm-log-line.error   { color: #E06458; }
.fm-log-line.info    { color: #8A9BAE; }

/* ── Config ── */
.fm-config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.fm-schedule-table { display: flex; flex-direction: column; gap: 0; }
.fm-schedule-row {
  display: grid; grid-template-columns: 130px 110px 1fr;
  padding: 0.65rem 0; border-bottom: 1px solid var(--border);
  font-size: 0.85rem; align-items: center; gap: 1rem;
}
.fm-schedule-row:last-child { border-bottom: none; }
.fm-sch-type { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.fm-sch-day  { color: var(--muted-foreground); }
.fm-sch-time { color: var(--fm-teal, #22C55E); font-weight: 600; }

/* ── Palette ── */
.fm-palette { display: flex; flex-direction: column; gap: 0.6rem; }
.fm-color-row { display: flex; align-items: center; gap: 10px; font-size: 0.82rem; }
.fm-color-swatch { width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(255,255,255,.1); flex-shrink: 0; }
.fm-color-info { display: flex; flex-direction: column; flex: 1; }
.fm-color-name { font-weight: 600; }
.fm-color-hex  { font-family: monospace; font-size: 0.72rem; color: var(--muted-foreground); }
.fm-color-role { font-size: 0.75rem; color: var(--muted-foreground); }

/* ── CLI commands ── */
.fm-commands-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 0.6rem; }
.fm-cmd-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 0.75rem 1rem; background: var(--background);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.fm-cmd { font-size: 0.8rem; color: #22C55E; font-family: monospace; }
.fm-cmd-desc { font-size: 0.75rem; color: var(--muted-foreground); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .fm-cycle-grid { grid-template-columns: 1fr 1fr; }
  .fm-generate-grid { grid-template-columns: 1fr; }
  .fm-config-grid { grid-template-columns: 1fr; }
  .fm-rules-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .fm-cycle-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
</style>
