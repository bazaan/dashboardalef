<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- Sidebar personalizado -->
    <aside class="sidebar">
      <!-- Logo Header -->
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon"></div>
          <span class="logo-text">Acme Inc.</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <!-- Home Section -->
        <div class="nav-section">
          <div class="nav-label">Home</div>
          <button
            v-for="item in menuItems"
            :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id"
          >
            <v-icon :icon="item.icon" size="18"></v-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>

        <!-- Documents Section -->
        <div class="nav-section">
          <div class="nav-label">Documents</div>
          <button
            v-for="item in documentItems"
            :key="item.id"
            class="nav-item"
          >
            <v-icon :icon="item.icon" size="18"></v-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <button class="footer-item">
          <v-icon icon="mdi-cog" size="18"></v-icon>
          <span>Settings</span>
        </button>
        <button class="footer-item">
          <v-icon icon="mdi-help-circle" size="18"></v-icon>
          <span>Get Help</span>
        </button>
        <button class="footer-item">
          <v-icon icon="mdi-magnify" size="18"></v-icon>
          <span>Search</span>
        </button>
        <button class="footer-item" @click="toggleTheme">
          <v-icon :icon="isDark ? 'mdi-weather-night' : 'mdi-weather-sunny'" size="18"></v-icon>
          <span>{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>
      </div>

      <!-- User Profile -->
      <div class="user-profile">
        <div class="user-avatar">SC</div>
        <div class="user-info">
          <div class="user-name">shadcn</div>
          <div class="user-email">m@example.com</div>
        </div>
        <button class="user-menu">
          <v-icon icon="mdi-menu-down" size="16"></v-icon>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Top Header -->
      <header class="top-header">
        <h1>Documents</h1>
        <button class="btn-primary">
          <v-icon icon="mdi-plus" size="16"></v-icon>
          <span>Quick Create</span>
        </button>
      </header>

      <!-- Content Area -->
      <div class="content-area">
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div
            v-for="(stat, index) in stats"
            :key="index"
            class="stat-card"
          >
            <div class="stat-header">
              <span class="stat-title">{{ stat.title }}</span>
              <div :class="['stat-change', stat.trend]">
                <v-icon
                  :icon="stat.trend === 'up' ? 'mdi-trending-up' : 'mdi-trending-down'"
                  size="12"
                ></v-icon>
                {{ stat.change }}
              </div>
            </div>
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-subtitle">
              <v-icon :icon="stat.trend === 'up' ? 'mdi-trending-up' : 'mdi-trending-down'" size="16"></v-icon>
              {{ stat.subtitle }}
            </div>
            <div class="stat-description">{{ stat.description }}</div>
          </div>
        </div>

        <!-- Chart Section -->
        <div class="chart-section">
          <div class="chart-header">
            <div class="chart-title-section">
              <h2>Total Visitors</h2>
              <div class="chart-subtitle">Total for the last 3 months</div>
            </div>
            <div class="time-filters">
              <button
                v-for="range in timeRanges"
                :key="range"
                :class="['time-btn', { active: timeRange === range }]"
                @click="timeRange = range"
              >
                {{ range }}
              </button>
            </div>
          </div>
          
          <div class="chart-area">
            <svg width="100%" height="100%" viewBox="0 0 1200 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="oklch(0.681 0.162 75.834)" stop-opacity="0.6" />
                  <stop offset="50%" stop-color="oklch(0.681 0.162 75.834)" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="oklch(0.681 0.162 75.834)" stop-opacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d="M 0,80 L 200,120 L 400,180 L 600,60 L 800,100 L 1000,150 L 1200,80 L 1200,240 L 0,240 Z"
                fill="url(#areaGradient)"
              />
              <path
                d="M 0,80 L 200,120 L 400,180 L 600,60 L 800,100 L 1000,150 L 1200,80"
                fill="none"
                stroke="oklch(0.554 0.135 66.442)"
                stroke-width="2.5"
              />
            </svg>
          </div>
          
          <div class="chart-labels">
            <span v-for="item in chartData" :key="item.date">{{ item.date }}</span>
          </div>
        </div>

        <!-- Table Section -->
        <div class="table-section">
          <!-- Tabs -->
          <div class="table-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              :class="['tab', { active: activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
              <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
            </button>
            
            <div class="spacer"></div>
            
            <button class="tab-action">
              <v-icon icon="mdi-view-column" size="16"></v-icon>
              Customize Columns
            </button>
            <button class="tab-action primary">
              <v-icon icon="mdi-plus" size="16"></v-icon>
              Add Section
            </button>
          </div>

          <!-- Table -->
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px">
                    <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
                  </th>
                  <th>Header</th>
                  <th>Section Type</th>
                  <th>Status</th>
                  <th>Target</th>
                  <th>Limit</th>
                  <th>Reviewer</th>
                  <th style="width: 40px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in tableData" :key="index">
                  <td>
                    <input type="checkbox" v-model="selected" :value="row.header" />
                  </td>
                  <td class="text-white">{{ row.header }}</td>
                  <td>{{ row.sectionType }}</td>
                  <td>
                    <span :class="['status', row.status === 'Done' ? 'done' : 'in-process']">
                      <span class="status-dot"></span>
                      {{ row.status }}
                    </span>
                  </td>
                  <td>{{ row.target }}</td>
                  <td>{{ row.limit }}</td>
                  <td>{{ row.reviewer }}</td>
                  <td>
                    <button class="icon-btn">
                      <v-icon icon="mdi-dots-vertical" size="16"></v-icon>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="table-footer">
            <span class="selection-info">
              {{ selected.length }} of {{ tableData.length }} row(s) selected.
            </span>
            
            <div class="pagination">
              <div class="rows-per-page">
                <span>Rows per page</span>
                <select v-model="rowsPerPage">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              
              <span class="page-info">Page 1 of 7</span>
              
              <div class="page-controls">
                <button disabled>
                  <v-icon icon="mdi-chevron-double-left" size="16"></v-icon>
                </button>
                <button disabled>
                  <v-icon icon="mdi-chevron-left" size="16"></v-icon>
                </button>
                <button>
                  <v-icon icon="mdi-chevron-right" size="16"></v-icon>
                </button>
                <button>
                  <v-icon icon="mdi-chevron-double-right" size="16"></v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'



// Estado reactivo
const activeView = ref('dashboard')
const timeRange = ref('Last 7 days')
const rowsPerPage = ref('10')
const activeTab = ref('outline')
const selected = ref<string[]>([])
const selectAll = ref(false)

// Theme toggle

const toggleTheme = () => {
  vuetifyTheme.global.name.value = isDark.value ? 'light' : 'dark'
}

// Sincronizar tema con el documento
import { nextTick } from 'vue'

/* ---------- theme ---------- */
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)

function applyTheme() {
  nextTick(() => {
    if (import.meta.server) return        // ← NO estamos en cliente
    const root = document.documentElement
    if (isDark.value) {
      root.setAttribute('data-theme', 'dark')
      root.classList.add('dark')
    } else {
      root.setAttribute('data-theme', 'light')
      root.classList.remove('dark')
    }
  })
}

watch(isDark, applyTheme, { immediate: true })
onMounted(applyTheme)

const toggleSelectAll = () => {
  if (selectAll.value) {
    selected.value = tableData.map(row => row.header)
  } else {
    selected.value = []
  }
}

// Menu items
const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'mdi-chart-line', label: 'Lifecycle', id: 'lifecycle' },
  { icon: 'mdi-chart-box', label: 'Analytics', id: 'analytics' },
  { icon: 'mdi-folder', label: 'Projects', id: 'projects' },
  { icon: 'mdi-account-group', label: 'Team', id: 'team' },
]

const documentItems = [
  { icon: 'mdi-database', label: 'Data Library', id: 'data' },
  { icon: 'mdi-file-document', label: 'Reports', id: 'reports' },
  { icon: 'mdi-file-word', label: 'Word Assistant', id: 'word' },
  { icon: 'mdi-dots-horizontal', label: 'More', id: 'more' },
]

const timeRanges = ['Last 3 months', 'Last 30 days', 'Last 7 days']

// Stats data
const stats = [
  {
    title: 'Total Revenue',
    value: '$1,250.00',
    change: '+12.5%',
    trend: 'up',
    subtitle: 'Trending up this month',
    description: 'Visitors for the last 6 months'
  },
  {
    title: 'New Customers',
    value: '1,234',
    change: '-20%',
    trend: 'down',
    subtitle: 'Down 20% this period',
    description: 'Acquisition needs attention'
  },
  {
    title: 'Active Accounts',
    value: '45,678',
    change: '+12.5%',
    trend: 'up',
    subtitle: 'Strong user retention',
    description: 'Engagement exceed targets'
  },
  {
    title: 'Growth Rate',
    value: '4.5%',
    change: '+4.5%',
    trend: 'up',
    subtitle: 'Steady performance increase',
    description: 'Meets growth projections'
  }
]

// Chart data
const chartData = [
  { date: 'Jun 23' },
  { date: 'Jun 24' },
  { date: 'Jun 25' },
  { date: 'Jun 26' },
  { date: 'Jun 27' },
  { date: 'Jun 28' },
  { date: 'Jun 29' }
]

// Tabs
const tabs = [
  { label: 'Outline', value: 'outline' },
  { label: 'Past Performance', value: 'performance', badge: '3' },
  { label: 'Key Personnel', value: 'personnel', badge: '2' },
  { label: 'Focus Documents', value: 'focus' },
]

// Table data
const tableData = [
  { header: 'Cover page', sectionType: 'Cover page', status: 'In Process', target: 18, limit: 5, reviewer: 'Eddie Lake' },
  { header: 'Table of contents', sectionType: 'Table of contents', status: 'Done', target: 29, limit: 24, reviewer: 'Eddie Lake' },
  { header: 'Executive summary', sectionType: 'Narrative', status: 'Done', target: 10, limit: 13, reviewer: 'Eddie Lake' },
  { header: 'Technical approach', sectionType: 'Narrative', status: 'Done', target: 27, limit: 23, reviewer: 'Jamik Tashpulatov' },
  { header: 'Design', sectionType: 'Narrative', status: 'In Process', target: 2, limit: 16, reviewer: 'Jamik Tashpulatov' },
  { header: 'Capabilities', sectionType: 'Narrative', status: 'In Process', target: 20, limit: 8, reviewer: 'Jamik Tashpulatov' },
  { header: 'Integration with existing systems', sectionType: 'Narrative', status: 'In Process', target: 19, limit: 21, reviewer: 'Jamik Tashpulatov' },
  { header: 'Innovation and Advantages', sectionType: 'Narrative', status: 'Done', target: 25, limit: 26, reviewer: 'Assign reviewer' },
]
</script>

<style scoped>
/* Importar el archivo CSS principal */
@import '@/assets/styles/dashboard.css';

/* Asegurar que el componente ocupe todo el espacio */
.dashboard-container {
  min-height: 100vh;
  width: 100%;
}
</style>