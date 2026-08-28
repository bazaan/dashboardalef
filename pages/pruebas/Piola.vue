<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <img src="/piola-logo.png" alt="Piola" class="piola-logo-mark" />
          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Piola</span>
                  <v-icon icon="mdi-menu-down" size="small" />
                </div>
              </template>
              <v-list density="compact">
                <v-list-item v-for="d in dashboards" :key="d.path" @click="navigateTo(d.path)" :value="d.path">
                  <template v-slot:prepend><v-icon :icon="d.icon"></v-icon></template>
                  <v-list-item-title>{{ d.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
          <span v-else class="logo-text">Piola</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <template v-for="seccion in seccionesVisibles" :key="seccion.label">
          <div class="nav-section">
            <div class="nav-label">{{ seccion.label }}</div>
            <button v-for="item in seccion.items" :key="item.id"
              :class="['nav-item', { active: activeView === item.id }]" @click="activeView = item.id">
              <v-icon :icon="item.icon" size="18" />
              <span>{{ item.label }}</span>
            </button>
          </div>

          <!-- Los leads de Piola entran por WhatsApp Business, Instagram y Messenger -->
          <div v-if="seccion.label === 'Comercial' && veChats" class="nav-section">
            <div class="nav-label">Chats</div>
            <button v-for="item in chatsItems" :key="item.id" class="nav-item"
              @click="navigateToChat(item.url)">
              <v-icon :icon="item.icon" size="18" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </template>
      </nav>

      <div class="sidebar-footer">
        <button v-if="veConfiguracion" class="footer-item" @click="activeView = 'configuracion'">
          <v-icon icon="mdi-cog" size="18" />
          <span>Configuración</span>
        </button>
        <a href="https://wa.me/51936196001?text=Hola%20necesito%20soporte" target="_blank" class="footer-item"
          style="text-decoration: none; color: inherit;">
          <v-icon icon="mdi-help-circle" size="18" />
          <span>Contacta con Alef</span>
        </a>
        <button class="footer-item" @click="toggleTheme">
          <v-icon :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'" size="18" />
          <span>{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>
      </div>

      <div class="user-profile">
        <div class="user-avatar"><v-img src="@/assets/img/user777.png" alt="You" /></div>
        <div class="user-info">
          <div class="user-name">{{ currentUser.full_name }}</div>
          <div class="user-email">{{ perfil?.rol_piola || currentUser.email }}</div>
        </div>
        <v-menu v-model="showUserMenu" location="bottom end" offset-y :close-on-content-click="false">
          <template #activator="{ props }">
            <button class="user-menu" v-bind="props"><v-icon icon="mdi-menu-down" size="16" /></button>
          </template>
          <v-list class="user-dropdown" density="compact">
            <v-list-item @click="logout" prepend-icon="mdi-logout">
              <v-list-item-title>Cerrar sesión</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </aside>

    <!-- ==========  MAIN  ========== -->
    <div class="main-content">
      <div v-if="cargandoPerfil" class="view-container">
        <div class="content-area" style="display:flex; align-items:center; justify-content:center; min-height:60vh;">
          <v-progress-circular indeterminate color="primary" size="42" />
        </div>
      </div>

      <template v-else>
        <PiolaHome v-if="activeView === 'home'" :perfil="perfil" @ir="activeView = $event" @notify="notify" />
        <PiolaMiEspacio v-else-if="activeView === 'mi_espacio'" :perfil="perfil"
          @notify="notify" @perfil-actualizado="cargarPerfil" />
        <PiolaCRM v-else-if="activeView === 'crm'" :perfil="perfil" @notify="notify" />
        <PiolaContabilidad v-else-if="activeView === 'contabilidad'" :perfil="perfil" @notify="notify" />
        <PiolaFacturacion v-else-if="activeView === 'facturacion'" :perfil="perfil" @notify="notify" />
        <PiolaProduccion v-else-if="activeView === 'produccion'" :perfil="perfil" @notify="notify" />
        <PiolaRRHH v-else-if="activeView === 'rrhh'" :perfil="perfil" @notify="notify" />
        <PiolaReportes v-else-if="activeView === 'reportes'" :perfil="perfil" @notify="notify" />
        <PiolaConfiguracion v-else-if="activeView === 'configuracion'" :perfil="perfil"
          :current-user="currentUser" @notify="notify" @perfil-actualizado="cargarPerfil" />
      </template>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="4000" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
/**
 * Dashboard / CRM Piola — shell de módulos.
 *
 * El menú lateral se arma con los permisos REALES del usuario, que llegan de
 * GET /api/piola/perfil (tabla piola_role_permissions). Ocultar un botón es
 * solo cosmética: cada endpoint del servidor vuelve a verificar el rol.
 */
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'
import { isSuperAdmin, canAccessPiola, piolaCan, dashboards } from '@/utils/permissions'
import PiolaHome from '@/components/Piola/PiolaHome.vue'
import PiolaMiEspacio from '@/components/Piola/PiolaMiEspacio.vue'
import PiolaCRM from '@/components/Piola/PiolaCRM.vue'
import PiolaContabilidad from '@/components/Piola/PiolaContabilidad.vue'
import PiolaFacturacion from '@/components/Piola/PiolaFacturacion.vue'
import PiolaProduccion from '@/components/Piola/PiolaProduccion.vue'
import PiolaRRHH from '@/components/Piola/PiolaRRHH.vue'
import PiolaReportes from '@/components/Piola/PiolaReportes.vue'
import PiolaConfiguracion from '@/components/Piola/PiolaConfiguracion.vue'

const { logActivity } = useActivityLogger()
definePageMeta({ middleware: 'auth-dashboard' })

interface UserSession { id: string; email: string; full_name: string; role: string; company_id?: string }
const userSession = useCookie<UserSession | null>('dashboard_session')
const currentUser = computed(() => userSession.value
  || { full_name: 'Usuario Invitado', email: '', id: '', role: '', company_id: '' })

const showDashboardMenu = ref(false)
const showUserMenu = ref(false)
const activeView = ref('home')

const snackbar = ref({ show: false, text: '', color: 'success' })
function notify(payload: any) {
  if (typeof payload === 'string') snackbar.value = { show: true, text: payload, color: 'success' }
  else snackbar.value = { show: true, text: payload?.text || '', color: payload?.color || 'success' }
}

/* ── Tema ── */
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)
const toggleTheme = () => { vuetifyTheme.global.name.value = isDark.value ? 'light' : 'dark' }
function applyTheme() {
  nextTick(() => {
    if (import.meta.server) return
    const root = document.documentElement
    if (isDark.value) { root.setAttribute('data-theme', 'dark'); root.classList.add('dark') }
    else { root.setAttribute('data-theme', 'light'); root.classList.remove('dark') }
  })
}
watch(isDark, applyTheme, { immediate: true })

function logout() {
  logActivity('Cerró sesión')
  const session = useCookie('dashboard_session'); session.value = null
  return navigateTo('/')
}

/* ── Perfil y permisos ── */
const perfil = ref<any>(null)
const cargandoPerfil = ref(true)
const esAdmin = computed(() => perfil.value?.es_admin === true)

async function cargarPerfil() {
  try {
    perfil.value = await $fetch<any>('/api/piola/perfil')
  } catch (e: any) {
    notify({ text: e?.data?.statusMessage || 'No se pudo cargar tu perfil de Piola', color: 'error' })
  } finally {
    cargandoPerfil.value = false
  }
}

/**
 * Menú (§2), agrupado en secciones como el resto de los dashboards del grupo
 * (Inicio / Comercial / Finanzas / …) y filtrado por permisos (§8).
 * Configuración va en el footer, igual que en las demás empresas.
 */
const SECCIONES = [
  {
    label: 'Inicio',
    items: [
      { id: 'home', icon: 'mdi-view-dashboard', label: 'Dashboard', modulo: 'home' },
      { id: 'mi_espacio', icon: 'mdi-account-clock', label: 'Mi espacio', modulo: 'mi_espacio' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { id: 'crm', icon: 'mdi-account-multiple-plus', label: 'Leads / Pipeline', modulo: 'crm' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { id: 'contabilidad', icon: 'mdi-cash-multiple', label: 'Flujo de caja', modulo: 'contabilidad' },
      { id: 'facturacion', icon: 'mdi-file-document-outline', label: 'Facturación', modulo: 'facturacion' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { id: 'produccion', icon: 'mdi-movie-open', label: 'Producción', modulo: 'produccion' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { id: 'rrhh', icon: 'mdi-account-group', label: 'RR. HH.', modulo: 'rrhh' },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { id: 'reportes', icon: 'mdi-chart-box', label: 'Reportes y alertas', modulo: 'reportes' },
    ],
  },
] as const

/** Una sección desaparece entera si el usuario no puede ver ninguno de sus módulos. */
const seccionesVisibles = computed(() => SECCIONES
  .map(s => ({
    label: s.label,
    items: s.items.filter(i => piolaCan(perfil.value?.permisos, i.modulo as any, 'view')),
  }))
  .filter(s => s.items.length))

const veConfiguracion = computed(() => piolaCan(perfil.value?.permisos, 'configuracion', 'view'))

/**
 * Sección Chats — Chatwoot, igual que en los demás dashboards.
 *
 * La cuenta NO va hardcodeada como en las otras empresas: Piola todavía no
 * tiene una asignada, y apuntar a un número al azar mandaría al equipo al
 * inbox de otra empresa. Se lee de `remarketing_config` (la misma tabla que ya
 * guarda el chatwoot_account_id por empresa); mientras no exista esa fila, el
 * enlace lleva al selector de cuentas de Chatwoot.
 */
const chatwootAccount = ref<number | null>(null)
const veChats = computed(() => piolaCan(perfil.value?.permisos, 'crm', 'view'))

const chatsItems = computed(() => {
  const base = 'https://chats.alef.company/app'
  return [{
    id: 'chatwoot',
    icon: 'mdi-message-reply',
    label: 'Conversaciones',
    url: chatwootAccount.value ? `${base}/accounts/${chatwootAccount.value}/dashboard` : base,
  }]
})

const navigateToChat = (url: string) => { if (url) window.open(url, '_blank') }

async function cargarChatwoot() {
  const { data } = await useSupabaseClient()
    .from('remarketing_config').select('chatwoot_account_id').eq('company_id', 'piola').maybeSingle()
  chatwootAccount.value = (data as any)?.chatwoot_account_id ?? null
}

const vistasDisponibles = computed(() => {
  const ids = seccionesVisibles.value.flatMap(s => s.items.map(i => i.id as string))
  return veConfiguracion.value ? [...ids, 'configuracion'] : ids
})

// Si el usuario pierde acceso a la vista activa, lo devolvemos a la primera disponible
watch(vistasDisponibles, (ids) => {
  if (ids.length && !ids.includes(activeView.value)) activeView.value = ids[0]
})

onMounted(async () => {
  if (!canAccessPiola(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }
  applyTheme()
  await cargarPerfil()
  await cargarChatwoot()
})
</script>

<style scoped>
/* El PNG que mandó Piola ya trae transparencia real (verificado con PIL:
   alpha=0 fuera del bocadillo) — va directo, sin ninguna caja ni fondo
   detrás, igual que el archivo que enviaron. El wordmark "HAZLO" es ancho
   (380x208), no cuadrado como el resto de los dashboards, por eso no se
   fuerza a un círculo de 35x35 —le cortaría el texto—, sino que conserva su
   proporción real con height fijo y width automático. */
.piola-logo-mark {
  height: 36px;
  width: auto;
  max-width: 110px;
  flex-shrink: 0;
}
</style>
