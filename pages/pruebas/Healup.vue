<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/healupLOGO.png" alt="Alef Company Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Healup</span>
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
          <span v-else class="logo-text">Healup</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Inicio</div>
          <button v-for="item in menuItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
            @click="handleNavigation(item)">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">CHATS</div>
          <button v-for="item in chatItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
            @click="handleNavigation(item)">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">FINANZAS</div>
          <button v-for="item in financiasItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]" @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Documents</div>
          <button v-for="item in documentItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">MARKETING</div>
          <button :class="['nav-item', { active: activeView === 'remarketing' }]"
            @click="activeView = 'remarketing'">
            <v-icon icon="mdi-bullhorn" size="18" />
            <span>Remarketing</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">SOPORTE</div>
          <button :class="['nav-item', { active: activeView === 'reporte' }]"
            @click="activeView = 'reporte'">
            <v-icon icon="mdi-clipboard-text" size="18" />
            <span>Reporte Diario</span>
          </button>
          <button :class="['nav-item', { active: activeView === 'tickets' }]"
            @click="activeView = 'tickets'">
            <v-icon icon="mdi-ticket-confirmation" size="18" />
            <span>Tickets</span>
          </button>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="footer-item" @click="activeView = 'settings'">
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
          <div class="user-email">{{ currentUser.email }}</div>
        </div>
        <v-menu v-model="showUserMenu" location="bottom end" offset-y :close-on-content-click="false">
          <template #activator="{ props }">
            <button class="user-menu" v-bind="props">
              <v-icon icon="mdi-menu-down" size="16" />
            </button>
          </template>

          <v-list class="user-dropdown" density="compact">
            <v-list-item class="user-header" prepend-avatar="">
              <template #prepend>
                <v-avatar size="32">
                  <v-img src="@/assets/img/user777.png" alt="You" />
                </v-avatar>
              </template>

              <v-list-item-title>{{ currentUser.full_name }}</v-list-item-title>
              <v-list-item-subtitle>{{ currentUser.email }}</v-list-item-subtitle>
            </v-list-item>

            <v-divider />

            <v-list-item @click="activeView = 'cuenta'" prepend-icon="mdi-account">
              <v-list-item-title>Cuenta</v-list-item-title>
            </v-list-item>

            <v-list-item @click="activeView = 'notificaciones'" prepend-icon="mdi-bell">
              <v-list-item-title>Notificaciones</v-list-item-title>
            </v-list-item>

            <v-divider />

            <v-list-item @click="logout" prepend-icon="mdi-logout">
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </aside>

    <!-- ==========  MAIN CONTENT  ========== -->
    <div class="main-content">
      <!-- ==========  VISTA: DASHBOARD  ========== -->
      <!-- ==========  VISTA: DASHBOARD  ========== -->
      <div v-if="activeView === 'dashboard'" class="view-container">


        <header class="top-header">
          <h1>Dashboard</h1>

          <div style="display: flex; gap: 10px; align-items: center;">

            <N8nPanicButton client-key="healup" label="IA Healup" />

            <button class="btn-primary"
              @click="() => { fetchPacientesWpp(); fetchPacientesFbIg(); fetchPacientesTiktok(); fetchCompras(); fetchLeads(); }">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- Stats Grid -->
          <div class="stats-grid">
            <div v-for="(stat, i) in stats" :key="i" class="stat-card">
              <div class="stat-header">
                <span class="stat-title">{{ stat.title }}</span>
                <div :class="['stat-change', stat.trend]">
                  <v-icon :icon="stat.trend === 'up' ? 'mdi-trending-up' : 'mdi-trending-down'" size="12" />
                  {{ stat.change }}
                </div>
              </div>
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-subtitle">
                <v-icon :icon="stat.trend === 'up' ? 'mdi-trending-up' : 'mdi-trending-down'" size="16" />
                {{ stat.subtitle }}
              </div>
              <div class="stat-description">{{ stat.description }}</div>
            </div>
          </div>

          <!-- Chart Section -->
          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Leads Totales</h2>
                <div class="chart-subtitle">Resumen de prospectos</div>
              </div>
              <div class="time-filters">
                <button v-for="btn in zoomButtons" :key="btn.id"
                  :class="['time-btn', { active: activeZoom === btn.id }]" @click="handleZoom(btn.id)">
                  {{ btn.label }}
                </button>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="area" height="350" :options="chartOptions" :series="series" />
              </client-only>
            </div>
          </div>

          <!-- Table Section -->
          <div class="table-section">
            <div class="table-tabs">
              <button v-for="tab in tabs" :key="tab.value" :class="['tab', { active: activeTab === tab.value }]"
                @click="activeTab = tab.value">
                {{ tab.label }}
                <!-- <span v-if="tab.badge" class="badge">{{ tab.badge }}</span> -->
              </button>
              <!-- Buttons removed as requested -->
            </div>
            <v-card flat class="custom-data-table">

              <!-- TABLE: PACIENTES DASHBOARD (Was Compras) -->
              <div v-if="activeTab === 'pacientes_dashboard'">
                <!-- WhatsApp Table -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimos 10 Pacientes WhatsApp</span>
                </v-card-title>
                <v-data-table :headers="headersDashboardWpp" :items="pacientesWpp.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay pacientes recientes en WhatsApp" :items-per-page="10">
                  <template v-slot:item.precio="{ item }">
                    S/ {{ item.precio }}
                  </template>
                  <template v-slot:item.estado="{ item }">
                    <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                      <span class="status-dot" />
                      {{ item.estado }}
                    </span>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>

                <div style="height: 2rem;"></div>

                <!-- FB/IG Table -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimos 10 Pacientes Facebook e Instagram</span>
                </v-card-title>
                <v-data-table :headers="headersDashboardFbIg" :items="pacientesFbIg.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay pacientes recientes en FB/IG" :items-per-page="10">
                  <template v-slot:item.precio="{ item }">
                    S/ {{ item.precio }}
                  </template>
                  <template v-slot:item.estado="{ item }">
                    <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                      <span class="status-dot" />
                      {{ item.estado }}
                    </span>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <!-- TABLE: LEADS (Was Past Performance) -->
              <div v-if="activeTab === 'leads'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Recientes Leads</span>
                </v-card-title>
                <v-data-table :headers="headersLeads" :items="leads.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay leads recientes" :items-per-page="10">
                  <template v-slot:item.lead_status="{ item }">
                    <v-chip
                      :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                      size="small">
                      {{ item.lead_status }}
                    </v-chip>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <!-- TABLE: EVENTS (Upcoming) -->
              <div v-if="activeTab === 'events'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Próximos Eventos</span>
                </v-card-title>
                <v-data-table :headers="headersUpcomingEvents" :items="upcomingEvents" class="elevation-0"
                  no-data-text="No hay eventos próximos">
                  <template v-slot:item.date="{ item }">
                    {{ formatEventDate(item.date) }}
                  </template>
                  <template v-slot:item.clientName="{ item }">
                    {{ item.clientName }} {{ item.clientSurname }}
                  </template>
                </v-data-table>
              </div>

            </v-card>
          </div>
        </div>
      </div>


      <!-- ==========  VISTA: SETTINGS  ========== -->
      <SettingsView v-else-if="activeView === 'settings'" company-id="Heal up" :current-user-role="currentUser?.role" />

      <!-- ==========  VISTA: CALENDARIO  ========== -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Calendario</h1>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn-secondary" @click="syncGCalToCalendar" :disabled="gcalSyncing">
              <v-icon :icon="gcalSyncing ? 'mdi-loading mdi-spin' : 'mdi-google'" size="16" />
              <span>{{ gcalSyncing ? 'Sincronizando...' : 'Sync Google Calendar' }}</span>
            </button>
            <span v-if="gcalSyncResult" style="font-size: 12px; color: var(--text-secondary);">
              {{ gcalSyncResult }}
            </span>
            <button class="btn-secondary" @click="openScheduleDialog">
              <v-icon icon="mdi-clock-outline" size="16" />
              <span>Configurar Horario</span>
            </button>
            <button class="btn-primary" @click="() => openCreateEventDialog()">
              <v-icon icon="mdi-calendar-plus" size="16" />
              <span>Nuevo Evento</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- Cabin Selector Tabs -->
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <button
              :class="['btn-secondary', { 'btn-primary': activeCabin === 'cabina1' }]"
              style="display: flex; align-items: center; gap: 6px;"
              @click="activeCabin = 'cabina1'"
            >
              <v-icon icon="mdi-doctor" size="16" />
              <span>Cabina 1 — Doctora</span>
            </button>
            <button
              :class="['btn-secondary', { 'btn-primary': activeCabin === 'cabina2' }]"
              style="display: flex; align-items: center; gap: 6px;"
              @click="activeCabin = 'cabina2'"
            >
              <v-icon icon="mdi-spa" size="16" />
              <span>Cabina 2 — Cosmiatra</span>
            </button>
          </div>

          <!-- Calendar Header with Navigation -->
          <div class="calendar-header">
            <div class="calendar-nav">
              <button class="nav-btn" @click="previousMonth">
                <v-icon icon="mdi-chevron-left" size="20" />
              </button>
              <h2 class="current-month">{{ currentMonthName }} {{ currentYear }}</h2>
              <button class="nav-btn" @click="nextMonth">
                <v-icon icon="mdi-chevron-right" size="20" />
              </button>
            </div>
            <button class="today-btn" @click="goToToday">Hoy</button>
          </div>

          <!-- Calendar Grid -->
          <div class="calendar-grid">
            <!-- Days of week header -->
            <div class="calendar-weekdays">
              <div v-for="day in weekDays" :key="day" class="weekday-label">{{ day }}</div>
            </div>

            <!-- Calendar days -->
            <div class="calendar-days">
              <div v-for="(day, index) in calendarDays" :key="index" :class="[
                'calendar-day',
                {
                  'other-month': !day.isCurrentMonth,
                  'today': day.isToday,
                  'selected': day.isSelected,
                  'has-events': day.events.length > 0 || (day.isWorkingDay && day.events.length >= day.totalSlots)
                }
              ]" @click="selectDay(day)">
                <div class="day-header-row">
                  <span class="day-number">{{ day.day }}</span>
                  <span
                    v-if="day.isWorkingDay && day.isCurrentMonth"
                    class="day-avail-badge"
                    :class="day.availableSlots > 0 ? 'avail-ok' : 'avail-full'"
                  >
                    {{ day.availableSlots > 0 ? `${day.availableSlots}` : '0' }}
                  </span>
                </div>
                <div v-if="day.events.length > 0" class="event-list-in-day">
                  <div v-for="(event, eventIndex) in day.events.slice(0, 2)" :key="eventIndex" class="event-line"
                    :style="{ backgroundColor: getProcedureColor(event.procedureId) }" :title="event.subject">
                    <span class="event-line-text">{{ event.time ? event.time + ' ' : '' }}{{ event.clientName || event.subject }}</span>
                  </div>
                  <span v-if="day.events.length > 2" class="more-events">+{{ day.events.length - 2 }} más</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Upcoming Events List -->
          <div class="upcoming-events">
            <h3>Próximos Eventos</h3>
            <div v-if="upcomingEvents.length === 0" class="no-events">
              <v-icon icon="mdi-calendar-blank" size="48" />
              <p>No hay eventos próximos</p>
            </div>
            <div v-else class="event-list">
              <div v-for="event in upcomingEvents" :key="event.id" class="event-item" @click="openEventDetail(event)">
                <div class="event-color-bar" :style="{ backgroundColor: getProcedureColor(event.procedureId) }"></div>
                <div class="event-info">
                  <div class="event-title">{{ event.subject }}</div>
                  <div class="event-meta">
                    <v-icon icon="mdi-clock-outline" size="14" />
                    {{ formatEventDate(event.date) }} - {{ event.time }}
                    <v-chip
                      size="x-small"
                      :color="(event.cabina || 'cabina1') === 'cabina1' ? 'indigo' : 'teal'"
                      variant="tonal"
                      class="ml-1"
                    >{{ (event.cabina || 'cabina1') === 'cabina1' ? 'C1' : 'C2' }}</v-chip>
                  </div>
                  <div class="event-client">{{ event.clientName }} {{ event.clientSurname }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: PACIENTES  ========== -->
      <div v-else-if="activeView === 'pacientes'" class="view-container">
        <header class="top-header">
          <h1>Pacientes</h1>
          <button class="btn-primary" @click="openPatientTypeDialog">
            <v-icon icon="mdi-account-plus" size="16" />
            <span>Nuevo Paciente</span>
          </button>
        </header>

        <div class="content-area">
          <div class="stats-grid mini two-columns">
            <div class="stat-card center-content">
              <div class="stat-value">{{ allPacientes.length }}</div>
              <div class="stat-title">Total Histórico</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ contribuyentesMesActual.length }}</div>
              <div class="stat-title">Nuevos este Mes</div>
              <div class="stat-change" :class="contribuyentesGrowth >= 0 ? 'up' : 'down'">
                {{ contribuyentesGrowth >= 0 ? '+' : '' }}{{ contribuyentesGrowth.toFixed(1) }}% vs mes anterior
              </div>
            </div>
          </div>

          <!-- 2.5 Filtros: chips de mes (default mes actual) + chip "Todos" -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding: 6px 0 12px;">
            <v-icon icon="mdi-calendar-month" size="14" style="opacity:0.5;" />
            <v-chip
              :color="pacienteMesFiltro === '' ? 'primary' : 'default'"
              :variant="pacienteMesFiltro === '' ? 'flat' : 'outlined'"
              size="x-small" style="cursor:pointer;"
              @click="pacienteMesFiltro = ''"
            >Todos</v-chip>
            <v-chip
              v-for="m in pacienteMesesDisponibles" :key="m.value"
              :color="pacienteMesFiltro === m.value ? 'primary' : 'default'"
              :variant="pacienteMesFiltro === m.value ? 'flat' : 'outlined'"
              size="x-small" style="cursor:pointer;"
              @click="pacienteMesFiltro = pacienteMesFiltro === m.value ? '' : m.value"
            >{{ m.label }}</v-chip>
          </div>

          <div class="table-section">
            <!-- Table 1: WhatsApp -->
            <v-card flat class="custom-data-table" style="margin-bottom: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de pacientes whatsapp ({{ pacientesWppFiltrados.length }})</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(pacientesWppFiltrados, headersPacientesWpp, 'healup-pacientes-wpp')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Buscar" single-line hide-details
                  density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersPacientesWpp" :items="pacientesWppFiltrados" :search="search" :loading="loading"
                class="elevation-0" no-data-text="No hay pacientes de WhatsApp">
                <template v-slot:item.booking_sku="{ item }">
                  <v-chip v-if="item.booking_sku" color="primary" size="x-small" variant="tonal"
                    style="font-family:monospace; letter-spacing:0.03em; cursor:default;"
                    :title="`SKU Reserva: ${item.booking_sku}`">
                    {{ item.booking_sku }}
                  </v-chip>
                  <span v-else style="color:var(--text-secondary); font-size:11px;">—</span>
                </template>
                <template v-slot:item.precio="{ item }">
                  <span v-if="item.precio && Number(item.precio) > 0" style="color:#f59e0b; font-weight:600;">
                    S/ {{ item.precio }}
                  </span>
                  <span v-else style="color:var(--text-secondary);">—</span>
                </template>
                <template v-slot:item.precio_tratamiento="{ item }">
                  <span :style="Number(item.precio_tratamiento) > 0 ? 'color:#ef4444;font-weight:600;' : 'color:#22c55e;font-weight:600;'">
                    S/ {{ item.precio_tratamiento }}
                  </span>
                </template>
                <template v-slot:item.metodo_de_pago="{ item }">
                  <div class="d-flex align-center">
                    <v-icon v-if="item.metodo_de_pago === 'Yape'" color="purple-darken-1" size="small"
                      class="mr-1">mdi-cellphone-marker</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Transferencia'" color="blue-darken-2" size="small"
                      class="mr-1">mdi-bank-transfer-out</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Efectivo'" color="green" size="small"
                      class="mr-1">mdi-cash</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago && item.metodo_de_pago.includes('Tarjeta')" color="orange"
                      size="small" class="mr-1">mdi-credit-card</v-icon>
                    <span>{{ item.metodo_de_pago }}</span>
                  </div>
                </template>
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                    <span class="status-dot" />
                    {{ item.estado }}
                  </span>
                </template>
                <template v-slot:item.fecha_agendamiento="{ item }">
                  {{ formatDateAgendamiento(item.fecha_agendamiento) }}
                </template>
                <template v-slot:item.agendamiento="{ item }">
                  <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                      <v-icon v-bind="props" :icon="item.agendamiento === 'IA' ? 'mdi-robot' : 'mdi-account'"
                        :color="item.agendamiento === 'IA' ? 'primary' : 'success'" size="24"></v-icon>
                    </template>
                    <span>{{ item.agendamiento === 'IA' ? 'Inteligencia Artificial' : 'Agente Humano' }}</span>
                  </v-tooltip>
                </template>
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="openPatientForm(item, 'wpp')" title="Editar paciente">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="openHistoriaClinicaDePaciente(item, 'wpp')" title="Ver / agregar historia clínica" style="color:#daa520;">
                    <v-icon icon="mdi-folder-heart" size="16" />
                  </button>
                  <button class="icon-btn" @click="deletePatient(item, 'wpp')" title="Eliminar">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>

            <!-- Table 2: Facebook e Instagram -->
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de pacientes Facebook e Instagram ({{ pacientesFbIgFiltrados.length }})</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" @click="downloadExcel(pacientesFbIgFiltrados, headersPacientesFbIg, 'healup-pacientes-fbig')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
              </v-card-title>
              <v-data-table :headers="headersPacientesFbIg" :items="pacientesFbIgFiltrados" :search="search" :loading="loading"
                class="elevation-0" no-data-text="No hay pacientes de FB/IG">
                <template v-slot:item.booking_sku="{ item }">
                  <v-chip v-if="item.booking_sku" color="primary" size="x-small" variant="tonal"
                    style="font-family:monospace; letter-spacing:0.03em; cursor:default;"
                    :title="`SKU Reserva: ${item.booking_sku}`">
                    {{ item.booking_sku }}
                  </v-chip>
                  <span v-else style="color:var(--text-secondary); font-size:11px;">—</span>
                </template>
                <template v-slot:item.precio="{ item }">
                  <span v-if="item.precio && Number(item.precio) > 0" style="color:#f59e0b; font-weight:600;">
                    S/ {{ item.precio }}
                  </span>
                  <span v-else style="color:var(--text-secondary);">—</span>
                </template>
                <template v-slot:item.precio_tratamiento="{ item }">
                  <span :style="Number(item.precio_tratamiento) > 0 ? 'color:#ef4444;font-weight:600;' : 'color:#22c55e;font-weight:600;'">
                    S/ {{ item.precio_tratamiento }}
                  </span>
                </template>
                <template v-slot:item.metodo_de_pago="{ item }">
                  <div class="d-flex align-center">
                    <v-icon v-if="item.metodo_de_pago === 'Yape'" color="purple-darken-1" size="small"
                      class="mr-1">mdi-cellphone-marker</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Transferencia'" color="blue-darken-2" size="small"
                      class="mr-1">mdi-bank-transfer-out</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Efectivo'" color="green" size="small"
                      class="mr-1">mdi-cash</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago && item.metodo_de_pago.includes('Tarjeta')" color="orange"
                      size="small" class="mr-1">mdi-credit-card</v-icon>
                    <span>{{ item.metodo_de_pago }}</span>
                  </div>
                </template>
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                    <span class="status-dot" />
                    {{ item.estado }}
                  </span>
                </template>
                <template v-slot:item.fecha_agendamiento="{ item }">
                  {{ formatDateAgendamiento(item.fecha_agendamiento) }}
                </template>
                <template v-slot:item.agendamiento="{ item }">
                  <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                      <v-icon v-bind="props" :icon="item.agendamiento === 'IA' ? 'mdi-robot' : 'mdi-account'"
                        :color="item.agendamiento === 'IA' ? 'primary' : 'success'" size="24"></v-icon>
                    </template>
                    <span>{{ item.agendamiento === 'IA' ? 'Inteligencia Artificial' : 'Agente Humano' }}</span>
                  </v-tooltip>
                </template>
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="openPatientForm(item, 'fbig')" title="Editar paciente">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="openHistoriaClinicaDePaciente(item, 'fbig')" title="Ver / agregar historia clínica" style="color:#daa520;">
                    <v-icon icon="mdi-folder-heart" size="16" />
                  </button>
                  <button class="icon-btn" @click="deletePatient(item, 'fbig')" title="Eliminar">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>

            <!-- Table 3: TikTok -->
            <v-card flat class="custom-data-table" style="margin-top: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">
                  <v-icon icon="mdi-music-note" size="16" style="color:#ff0050; margin-right:4px;" />
                  Lista de pacientes TikTok ({{ pacientesTiktokFiltrados.length }})
                </span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(pacientesTiktokFiltrados, headersPacientesTiktok, 'healup-pacientes-tiktok')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Buscar" single-line hide-details
                  density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersPacientesTiktok" :items="pacientesTiktokFiltrados" :search="search" :loading="loading"
                class="elevation-0" no-data-text="No hay pacientes de TikTok">
                <template v-slot:item.tiktok_handle="{ item }">
                  <span v-if="item.tiktok_handle" style="color:#ff0050;">@{{ item.tiktok_handle }}</span>
                  <span v-else style="color:var(--text-secondary);">—</span>
                </template>
                <template v-slot:item.booking_sku="{ item }">
                  <v-chip v-if="item.booking_sku" color="primary" size="x-small" variant="tonal"
                    style="font-family:monospace; letter-spacing:0.03em; cursor:default;"
                    :title="`SKU Reserva: ${item.booking_sku}`">
                    {{ item.booking_sku }}
                  </v-chip>
                  <span v-else style="color:var(--text-secondary); font-size:11px;">—</span>
                </template>
                <template v-slot:item.precio="{ item }">
                  <span v-if="item.precio && Number(item.precio) > 0" style="color:#f59e0b; font-weight:600;">
                    S/ {{ item.precio }}
                  </span>
                  <span v-else style="color:var(--text-secondary);">—</span>
                </template>
                <template v-slot:item.precio_tratamiento="{ item }">
                  <span :style="Number(item.precio_tratamiento) > 0 ? 'color:#ef4444;font-weight:600;' : 'color:#22c55e;font-weight:600;'">
                    S/ {{ item.precio_tratamiento }}
                  </span>
                </template>
                <template v-slot:item.metodo_de_pago="{ item }">
                  <div class="d-flex align-center">
                    <v-icon v-if="item.metodo_de_pago === 'Yape'" color="purple-darken-1" size="small" class="mr-1">mdi-cellphone-marker</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Transferencia'" color="blue-darken-2" size="small" class="mr-1">mdi-bank-transfer-out</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago === 'Efectivo'" color="green" size="small" class="mr-1">mdi-cash</v-icon>
                    <v-icon v-else-if="item.metodo_de_pago && item.metodo_de_pago.includes('Tarjeta')" color="orange" size="small" class="mr-1">mdi-credit-card</v-icon>
                    <span>{{ item.metodo_de_pago }}</span>
                  </div>
                </template>
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                    <span class="status-dot" />{{ item.estado }}
                  </span>
                </template>
                <template v-slot:item.fecha_agendamiento="{ item }">
                  {{ formatDateAgendamiento(item.fecha_agendamiento) }}
                </template>
                <template v-slot:item.agendamiento="{ item }">
                  <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                      <v-icon v-bind="props" :icon="item.agendamiento === 'IA' ? 'mdi-robot' : 'mdi-account'"
                        :color="item.agendamiento === 'IA' ? 'primary' : 'success'" size="24"></v-icon>
                    </template>
                    <span>{{ item.agendamiento === 'IA' ? 'Inteligencia Artificial' : 'Agente Humano' }}</span>
                  </v-tooltip>
                </template>
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="openPatientForm(item, 'tiktok')" title="Editar paciente">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deletePatient(item, 'tiktok')" title="Eliminar">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>


      <!-- ==========  VISTA: CONVERSACIONES  ========== -->
      <div v-else-if="activeView === 'conversaciones'" class="view-container">
        <header class="top-header">
          <h1>Conversaciones</h1>
          <button class="btn-primary">
            <v-icon icon="mdi-message-plus" size="16" />
            <span>Nueva Conversación</span>
          </button>
        </header>

        <div class="content-area">
          <div class="chat-layout">
            <div class="chat-sidebar">
              <div class="placeholder-card">
                <h3>Conversaciones Recientes</h3>
                <div class="placeholder-list">
                  <div class="list-item active">
                    <v-icon icon="mdi-account-circle" />
                    <span>Cliente 1</span>
                  </div>
                  <div class="list-item">
                    <v-icon icon="mdi-account-circle" />
                    <span>Cliente 2</span>
                  </div>
                  <div class="list-item">
                    <v-icon icon="mdi-account-circle" />
                    <span>Cliente 3</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chat-main">
              <div class="placeholder-card large">
                <v-icon icon="mdi-message-text" size="64" class="placeholder-icon" />
                <h2>Panel de Chat</h2>
                <p>Área de mensajes y conversaciones con clientes</p>
              </div>
            </div>

            <div class="chat-stats">
              <div class="placeholder-card">
                <h3>Estadísticas</h3>
                <div class="stat-mini">
                  <div class="stat-value">95%</div>
                  <div class="stat-title">Tasa de Respuesta</div>
                </div>
                <div class="stat-mini">
                  <div class="stat-value">2.5h</div>
                  <div class="stat-title">Tiempo Promedio</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: LEADS  ========== -->
      <div v-else-if="activeView === 'leads'" class="view-container">
        <header class="top-header">
          <h1>Leads</h1>
          <div class="d-flex align-center" style="gap: 10px">
            <button class="btn-primary">
              <v-icon icon="mdi-account-plus" size="16" />
              <span>Nuevo Lead</span>
            </button>
            <button class="btn-primary" @click="fetchLeads">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- Indicador de período -->
          <div style="font-size:0.78rem; color: var(--text-secondary); margin-bottom: 0.75rem; padding-left: 2px">
            📅 Mostrando: <strong>mes actual</strong> · Comparativa vs mes anterior entre paréntesis
          </div>

          <div class="stats-grid five-columns">
            <div class="stat-card">
              <div class="stat-value">{{ totalLeadsCount }}</div>
              <div class="stat-title">Total Leads (mes)</div>
              <div class="stat-change" :class="leadsGrowthStat >= 0 ? 'up' : 'down'">
                {{ leadsGrowthStat >= 0 ? '+' : '' }}{{ leadsGrowthStat.toFixed(1) }}% vs mes ant. ({{ leadsMesAnterior.length }})
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #3b82f6">{{ coldLeadsCount }}</div>
              <div class="stat-title">Leads Fríos</div>
              <div class="stat-change" :class="coldLeadsCount >= coldLeadsCountPrev ? 'down' : 'up'">
                mes ant: {{ coldLeadsCountPrev }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #f59e0b">{{ warmLeadsCount }}</div>
              <div class="stat-title">Leads Tibios</div>
              <div class="stat-change" :class="warmLeadsCount >= warmLeadsCountPrev ? 'up' : 'down'">
                mes ant: {{ warmLeadsCountPrev }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #ef4444">{{ hotLeadsCount }}</div>
              <div class="stat-title">Leads Calientes</div>
              <div class="stat-change" :class="hotLeadsCount >= hotLeadsCountPrev ? 'up' : 'down'">
                mes ant: {{ hotLeadsCountPrev }}
              </div>
            </div>
            <div class="stat-card" style="cursor: pointer;" @click="openPacientesAgendadosDialog('conversion')"
              title="Pacientes nuevos convertidos este mes (created_at)">
              <div class="stat-value" style="color: #22c55e">{{ hotLeadsConvertedCount }}</div>
              <div class="stat-title">
                Convertidos este mes
                <v-icon size="14" icon="mdi-arrow-top-right" style="opacity:0.5; margin-left:2px;" />
              </div>
              <div class="stat-change up">
                {{ totalConversionRate.toFixed(1) }}% del total · {{ hotToPatientRate.toFixed(1) }}% de calientes
              </div>
            </div>
            <div class="stat-card" style="cursor: pointer;" @click="openPacientesAgendadosDialog('cita')"
              title="Pacientes con cita programada para este mes (fecha_agendamiento)">
              <div class="stat-value" style="color: #daa520">{{ pacientesConCitaEsteMes }}</div>
              <div class="stat-title">
                Citas este mes
                <v-icon size="14" icon="mdi-arrow-top-right" style="opacity:0.5; margin-left:2px;" />
              </div>
              <div class="stat-change up">
                Pacientes que tienen cita en {{ NOMBRES_MESES_LABEL[new Date().getMonth()] }}
              </div>
            </div>
          </div>

          <div class="table-section">
            <!-- Table 1: WhatsApp -->
            <v-card flat class="custom-data-table" style="margin-bottom: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de leads whatsapp</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(leadsWpp, headersLeadsWpp, 'healup-leads-wpp')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="leadsSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersLeadsWpp" :items="leadsWpp" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads de WhatsApp">
                <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
                <template v-slot:item.nombre="{ item }">
                  {{ (!item.nombre || item.nombre === 'null' || item.nombre.trim() === '') ? '—' : item.nombre }}
                </template>
                <template v-slot:item.fuente="{ item }">
                  <v-chip
                    :color="isEncrypted(item.numero) || !item.numero ? 'deep-purple' : 'green'"
                    size="small" variant="tonal">
                    {{ isEncrypted(item.numero) || !item.numero ? 'TikTok' : 'WhatsApp' }}
                  </v-chip>
                </template>
                <template v-slot:item.numero="{ item }">
                  {{ isEncrypted(item.numero) ? '—' : (item.numero || '—') }}
                </template>
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>

            <!-- Table 2: Facebook e Instagram -->
            <v-card flat class="custom-data-table" style="margin-bottom: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de leads Facebook e Instagram</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" @click="downloadExcel(leadsFbIg, headersLeadsFbIg, 'healup-leads-fbig')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
              </v-card-title>
              <v-data-table :headers="headersLeadsFbIg" :items="leadsFbIg" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads de FB/IG">
                <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>

            <!-- Table 3: TikTok -->
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">
                  <v-icon icon="mdi-music-note" size="16" style="color:#ff0050; margin-right:4px;" />
                  Lista de leads TikTok ({{ leadsTiktok.length }})
                </span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" @click="downloadExcel(leadsTiktok, headersLeadsTiktok, 'healup-leads-tiktok')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
              </v-card-title>
              <v-data-table :headers="headersLeadsTiktok" :items="leadsTiktok" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads de TikTok">
                <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
                <template v-slot:item.nombre="{ item }">
                  {{ (!item.nombre || item.nombre === 'null' || item.nombre.trim() === '') ? '—' : item.nombre }}
                </template>
                <template v-slot:item.tiktok_handle="{ item }">
                  <span v-if="item.tiktok_handle" style="color:#ff0050;">@{{ item.tiktok_handle }}</span>
                  <span v-else style="color:var(--text-secondary);">—</span>
                </template>
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>
          </div>

          <div class="mt-4">
            <v-card flat class="custom-data-table pa-4">
              <h3>Comparativa de Leads (Mes Actual)</h3>
              <client-only>
                <div id="chart">
                  <apexchart type="bar" height="350" :options="leadsChartOptions" :series="leadsChartSeries">
                  </apexchart>
                </div>
              </client-only>
            </v-card>
          </div>

          <div class="mt-4">
            <v-card flat class="custom-data-table pa-4">
              <div class="d-flex align-center justify-space-between mb-3">
                <div>
                  <h3 style="margin-bottom: 4px">Histórico de Leads desde inicio del Agente IA</h3>
                  <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0">
                    Evolución mensual · Fríos / Tibios / Calientes / Convertidos a paciente
                  </p>
                </div>
              </div>

              <!-- Tabla resumen por mes -->
              <div style="overflow-x: auto; margin-bottom: 1.5rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                      <th style="text-align:left; padding: 8px 12px; color: var(--text-secondary)">Mes</th>
                      <th style="text-align:center; padding: 8px 12px; color: #3b82f6">Fríos</th>
                      <th style="text-align:center; padding: 8px 12px; color: #f59e0b">Tibios</th>
                      <th style="text-align:center; padding: 8px 12px; color: #ef4444">Calientes</th>
                      <th style="text-align:center; padding: 8px 12px; color: var(--text-secondary)">Total</th>
                      <th style="text-align:center; padding: 8px 12px; color: #22c55e">Convertidos</th>
                      <th style="text-align:center; padding: 8px 12px; color: #22c55e">% Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(mes, i) in leadsHistoricoByMonth" :key="i"
                      style="border-bottom: 1px solid rgba(255,255,255,0.05)">
                      <td style="padding: 8px 12px; font-weight: 500">{{ mes.label }}</td>
                      <td style="text-align:center; padding: 8px 12px; color: #3b82f6">{{ mes.frio }}</td>
                      <td style="text-align:center; padding: 8px 12px; color: #f59e0b">{{ mes.tibio }}</td>
                      <td style="text-align:center; padding: 8px 12px; color: #ef4444">{{ mes.caliente }}</td>
                      <td style="text-align:center; padding: 8px 12px">{{ mes.frio + mes.tibio + mes.caliente }}</td>
                      <td style="text-align:center; padding: 8px 12px; color: #22c55e; font-weight: 600">{{ mes.convertidos }}</td>
                      <td style="text-align:center; padding: 8px 12px">
                        <v-chip
                          :color="(mes.frio + mes.tibio + mes.caliente) > 0 && (mes.convertidos/(mes.frio + mes.tibio + mes.caliente))*100 >= 5 ? 'success' : 'default'"
                          size="x-small" variant="tonal">
                          {{ (mes.frio + mes.tibio + mes.caliente) > 0 ? ((mes.convertidos / (mes.frio + mes.tibio + mes.caliente)) * 100).toFixed(1) : '0.0' }}%
                        </v-chip>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Gráfico de barras histórico -->
              <client-only>
                <apexchart type="bar" height="380"
                  :options="leadsHistoricoChartOptions"
                  :series="leadsHistoricoChartSeries">
                </apexchart>
              </client-only>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: EGRESOS  ========== -->
      <div v-else-if="activeView === 'egresos'" class="view-container">
        <header class="top-header">
          <h1>Egresos</h1>
          <button class="btn-primary" @click="openEgresoDialog()">
            <v-icon icon="mdi-plus" size="16" />
            <span>Agregar Egreso</span>
          </button>
        </header>

        <div class="content-area">
          <!-- Viñeta meses + KPI compacto en una sola fila — sin huecos verticales -->
          <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; padding: 4px 0 12px;">
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; flex:1; min-width:0;">
              <v-icon icon="mdi-calendar-month" size="18" style="opacity:0.6;" />
              <v-chip
                :color="egresosMesSel === '' ? 'grey-darken-2' : 'default'"
                :variant="egresosMesSel === '' ? 'flat' : 'outlined'"
                size="small" style="cursor:pointer;"
                @click="egresosMesSel = ''"
              >
                Todos
              </v-chip>
              <v-chip
                v-for="m in egresosMesesDisponibles" :key="m.value"
                :color="egresosMesSel === m.value ? 'error' : 'default'"
                :variant="egresosMesSel === m.value ? 'flat' : 'outlined'"
                size="small" style="cursor:pointer;"
                @click="egresosMesSel = m.value"
              >
                {{ m.label }}
              </v-chip>
            </div>
            <div class="stat-card" style="background: rgba(239,68,68,0.08); padding: 8px 16px; min-width: 200px; max-width: 260px; flex-shrink:0; margin:0;">
              <div class="stat-title" style="color:#ef4444; font-size: 0.7rem; margin:0;">{{ egresosMesSel ? 'Total ' + egresosMesLabel : 'Total Histórico' }}</div>
              <div class="stat-value" style="color:#ef4444; font-size:1.35rem; line-height:1.15; margin:0;">S/ {{ egresosFiltradosTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle" style="font-size: 0.65rem; opacity: 0.75;">{{ egresosFiltrados.length }} movimientos</div>
            </div>
          </div>

          <!-- Filtros: chips de categoría + chips de método de pago -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding: 6px 0 8px;">
            <v-icon icon="mdi-tag" size="14" style="opacity:0.5;" />
            <v-chip
              :color="egresoCatFiltro === '' ? 'grey-darken-2' : 'default'"
              :variant="egresoCatFiltro === '' ? 'flat' : 'outlined'"
              size="x-small" style="cursor:pointer;"
              @click="egresoCatFiltro = ''"
            >Todas categorías</v-chip>
            <v-chip
              v-for="c in EGRESO_CATEGORIAS" :key="c.value"
              :color="egresoCatFiltro === c.value ? c.color : 'default'"
              :variant="egresoCatFiltro === c.value ? 'flat' : 'outlined'"
              size="x-small" :prepend-icon="c.icon" style="cursor:pointer;"
              @click="egresoCatFiltro = egresoCatFiltro === c.value ? '' : c.value"
            >{{ c.value }}</v-chip>
            <span style="opacity:0.3; padding: 0 4px;">·</span>
            <v-icon icon="mdi-cash-multiple" size="14" style="opacity:0.5;" />
            <v-chip
              :color="egresoMetodoFiltro === '' ? 'grey-darken-2' : 'default'"
              :variant="egresoMetodoFiltro === '' ? 'flat' : 'outlined'"
              size="x-small" style="cursor:pointer;"
              @click="egresoMetodoFiltro = ''"
            >Todos métodos</v-chip>
            <v-chip
              v-for="m in EGRESO_METODOS" :key="m"
              :color="egresoMetodoFiltro === m ? 'primary' : 'default'"
              :variant="egresoMetodoFiltro === m ? 'flat' : 'outlined'"
              size="x-small" style="cursor:pointer;"
              @click="egresoMetodoFiltro = egresoMetodoFiltro === m ? '' : m"
            >{{ m }}</v-chip>
          </div>

          <div class="table-section">
             <v-card flat class="custom-data-table">
               <v-card-title class="table-search-bar">
                 <span class="table-title">{{ egresosMesSel ? 'Egresos · ' + egresosMesLabel : 'Lista de Egresos (Todos)' }}</span>
                 <v-spacer></v-spacer>
                 <v-btn icon size="small" variant="text" color="success" @click="downloadExcel(egresosFiltrados, egresosHeaders, `healup-egresos-${egresosMesSel || 'todos'}`)">
                   <v-icon>mdi-file-excel</v-icon>
                   <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                 </v-btn>
               </v-card-title>
               <v-data-table :headers="egresosHeaders" :items="egresosFiltrados" :loading="loadingEgresos" class="elevation-0" no-data-text="No hay egresos registrados en este mes">
                 <template v-slot:item.categoria="{ item }">
                   <v-chip
                     v-if="item.categoria"
                     :color="(EGRESO_CATEGORIAS.find(c => c.value === item.categoria) || {}).color || 'grey'"
                     :prepend-icon="(EGRESO_CATEGORIAS.find(c => c.value === item.categoria) || {}).icon || 'mdi-tag'"
                     size="x-small" variant="tonal" label
                   >{{ item.categoria }}</v-chip>
                   <span v-else style="opacity:0.5; font-size:0.75rem;">{{ item.tipo_egreso || '—' }}</span>
                 </template>
                 <template v-slot:item.metodo_pago="{ item }">
                   <v-chip v-if="item.metodo_pago" size="x-small" variant="outlined"
                     :color="item.metodo_pago === 'EFECTIVO' ? 'success' : 'primary'"
                     :prepend-icon="item.metodo_pago === 'EFECTIVO' ? 'mdi-cash' : 'mdi-bank-transfer'"
                   >{{ item.metodo_pago }}</v-chip>
                   <span v-else style="opacity:0.4;">—</span>
                 </template>
                 <template v-slot:item.precio="{ item }">
                   S/ {{ Number(item.precio || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                 </template>
                 <template v-slot:item.total="{ item }">
                   <strong>S/ {{ ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</strong>
                 </template>
                 <template v-slot:item.created_at="{ item }">
                   <span style="font-size:0.78rem;">{{ new Date(item.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }}</span>
                 </template>
                 <template v-slot:item.actions="{ item }">
                   <button class="icon-btn" @click="openEgresoDialog(item)">
                     <v-icon icon="mdi-pencil" size="16" />
                   </button>
                   <button class="icon-btn" @click="deleteEgreso(item.id)">
                     <v-icon icon="mdi-delete" size="16" />
                   </button>
                 </template>
               </v-data-table>
             </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: FACTURACIÓN (Healup Version) ========== -->
      <div v-else-if="activeView === 'facturacion'" class="view-container">
        <header class="top-header">
          <h1>Contabilidad</h1>
          <div class="header-actions">
            <!-- Reuse fetchPacientes as refresh since data comes from there -->
            <button class="btn-primary" @click="() => { fetchPacientesWpp(); fetchPacientesFbIg(); fetchPacientesTiktok(); }">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar Datos</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- KPI Stats Grid -->
          <div class="stats-grid">
            <!-- New Cards -->
            <div class="stat-card">
              <div class="stat-title">Ganancias Mes Actual</div>
              <div class="stat-value">S/ {{ revenueMonthActual.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">{{ revenueCurrentMonthName }}</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ganancias Mes Pasado</div>
              <div class="stat-value">S/ {{ revenuePreviousMonth.toLocaleString('es-PE', { minimumFractionDigits: 2 })
              }}
              </div>
              <div class="stat-subtitle">{{ revenuePrevMonthName }}</div>
            </div>

            <div class="stat-card">
              <div class="stat-title" style="color: #ef4444;">Egresos Mes Actual</div>
              <div class="stat-value" style="color: #ef4444;">S/ {{ totalEgresosMesActual.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">Gastos del mes en curso</div>
            </div>

            <div class="stat-card">
              <div class="stat-title" style="color: #ef4444;">Egresos Mes Pasado</div>
              <div class="stat-value" style="color: #ef4444;">S/ {{ totalEgresosMesPasado.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">Gastos del mes anterior</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ingresos Totales (Neto)</div>
              <div class="stat-value">S/ {{ gananciaNetaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Ganancias Brutas - Egresos de este mes</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Total Reservas</div>
              <div class="stat-value" style="color: #3b82f6;">S/ {{ revenueReservaCurrentMonth.toLocaleString('es-PE', {
                minimumFractionDigits: 2
              }) }}
              </div>
              <div class="stat-subtitle">Precio base</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Total Tratamientos</div>
              <div class="stat-value" style="color: #8b5cf6;">S/ {{
                revenueTratamientoCurrentMonth.toLocaleString('es-PE', {
                  minimumFractionDigits: 2
                }) }}
              </div>
              <div class="stat-subtitle">Precio procedimientos</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Pacientes</div>
              <div class="stat-value">{{ salesCountCurrentMonth }}</div>
              <div :class="['stat-change', salesGrowth >= 0 ? 'up' : 'down']">
                <v-icon :icon="salesGrowth >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'" size="12" />
                {{ Math.abs(salesGrowth).toFixed(1) }}%
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ticket Promedio (AOV)</div>
              <div class="stat-value">S/ {{ averageOrderValue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Promedio por paciente este mes</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Tasa de Conversión Real</div>
              <div class="stat-value">{{ realConversionRate.toFixed(1) }}%</div>
              <div class="stat-subtitle">{{ convertedLeadsCountReal > 0 ? convertedLeadsCountReal : 'N/A' }} de {{
                leads.length }} Leads</div>
            </div>
          </div>

          <!-- Charts Grid -->
          <div class="two-column-grid" style="grid-template-columns: 2fr 1fr;">
            <!-- Revenue chart -->
            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Tendencia de Facturación ({{ revenueZoom }})</h2>
                <div class="time-filters">
                  <button v-for="option in revenueZoomOptions" :key="option"
                    :class="['time-btn', { active: revenueZoom === option }]" @click="revenueZoom = option">
                    {{ option }}
                  </button>
                </div>
              </div>
              <client-only>
                <apexchart type="area" height="350" :options="revenueChartOptions" :series="revenueChartSeries" />
              </client-only>
            </div>

            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Leads vs Pacientes</h2>
              </div>
              <client-only>
                <apexchart type="donut" height="350" :options="conversionChartOptions"
                  :series="conversionChartSeries" />
              </client-only>
            </div>
          </div>

          <!-- Additional Row -->
          <div class="two-column-grid mt-4">
            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Ventas por Procedimiento</h2>
              </div>
              <client-only>
                <apexchart type="bar" height="350" :options="categoryChartOptions" :series="salesByCategorySeries" />
              </client-only>
            </div>
            <div class="chart-section" style="height: auto; max-height: 480px; overflow-y: auto;">
              <div class="chart-header mb-2">
                <h2>Últimos Pacientes</h2>
              </div>
              <v-list density="compact">
                <v-list-item v-for="(paciente, i) in pacientesMesActual.slice(0, 6)" :key="paciente.id || i" lines="two"
                  style="border-bottom: 1px solid var(--border);">
                  <template v-slot:prepend>
                    <v-avatar color="primary" variant="tonal" size="36">
                      <v-icon icon="mdi-account-star" size="18"></v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-bold">{{ paciente.nombre }}</v-list-item-title>
                  <v-list-item-subtitle>{{ paciente.procedimiento || 'Procedimiento General' }}</v-list-item-subtitle>
                  <template v-slot:append>
                    <div class="text-right">
                      <div class="font-weight-bold text-primary">S/ {{ (parseCurrency(paciente.precio) +
                        parseCurrency(paciente.precio_tratamiento)).toFixed(2) }}</div>
                      <div style="font-size: 11px; color: #666;">
                        <span style="color: #3b82f6;">Res: S/{{ parseCurrency(paciente.precio) }}</span> |
                        <span style="color: #8b5cf6;">Trat: S/{{ parseCurrency(paciente.precio_tratamiento) }}</span>
                      </div>
                      <div class="text-caption text-medium-emphasis">{{
                        formatDateAgendamiento(paciente.fecha_agendamiento) }}</div>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </div>

        </div>
      </div>

      <!-- ==========  VISTA: CONTABILIDAD  ========== -->
      <div v-else-if="activeView === 'contabilidad'" class="view-container">

        <!-- Banner de estado del boleteo automático (agente IA) -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1rem; border-radius:10px; margin-bottom:1rem;"
          :style="boleteoActivo ? 'background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);' : 'background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3);'">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <v-icon :icon="boleteoActivo ? 'mdi-receipt-text-check' : 'mdi-receipt-text-remove'"
              :color="boleteoActivo ? '#22c55e' : '#ef4444'" size="20" />
            <div>
              <div style="font-size:0.85rem; font-weight:600;" :style="boleteoActivo ? 'color:#22c55e' : 'color:#ef4444'">
                Boleteo automático (Agente IA): {{ boleteoActivo ? 'ACTIVADO' : 'DESACTIVADO' }}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                {{ boleteoActivo ? 'El agente genera boleta S/50 automáticamente al agendar una cita' : 'El agente NO genera boleta al agendar — actívalo cuando estés listo' }}
              </div>
            </div>
          </div>
          <v-switch
            v-model="boleteoActivo"
            :color="boleteoActivo ? 'success' : 'error'"
            hide-details
            density="compact"
            :loading="loadingBoleteoToggle"
            @update:model-value="toggleBoleteo"
            style="flex-shrink:0;"
          />
        </div>

        <!-- PSE Tabs -->
        <v-tabs
          v-model="facturacionTab"
          bg-color="transparent"
          color="primary"
          density="compact"
          class="mb-4"
          style="border-bottom: 1px solid var(--border);"
        >
          <v-tab value="cobro_atencion">🏥 Cobro</v-tab>
          <v-tab value="gcal_sync">📅 GCal</v-tab>
          <v-tab value="boletas_pendientes">📋 Pendientes</v-tab>
          <v-tab value="resumen">Resumen</v-tab>
          <v-tab value="factura_electronica">⚡ Facturas</v-tab>
          <v-tab value="ir_catalogo" @click.prevent="activeView = 'procedimientos'">📦 Catálogo</v-tab>
        </v-tabs>

        <!-- Cobro de Atención: flujo guiado boleta consulta + procedimiento -->
        <div v-if="facturacionTab === 'cobro_atencion'" style="padding: 0 0 2rem 0;">
          <ClientOnly>
            <HealupCobroAtencion />
          </ClientOnly>
        </div>

        <!-- Boletas Pendientes: revisar y emitir en lote a PSE.PE -->
        <div v-if="facturacionTab === 'boletas_pendientes'" style="padding: 0 0 2rem 0;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <div>
              <h2 style="font-size:1.1rem; font-weight:600; margin:0;">Boletas Pendientes de Emisión</h2>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin:0.25rem 0 0 0;">
                Generadas por n8n al confirmar citas. Revisá y emitís todas al final del día.
              </p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <button class="btn-secondary" @click="fetchBoletasPendientes" :disabled="loadingPendientes">
                <v-icon icon="mdi-refresh" size="16" />
              </button>
              <button
                class="btn-primary"
                @click="emitirTodasPendientes"
                :disabled="loadingEmision || boletasPendientes.length === 0"
              >
                <v-icon icon="mdi-send" size="16" />
                <span>{{ loadingEmision ? 'Emitiendo...' : `Emitir todas (${boletasPendientes.length})` }}</span>
              </button>
            </div>
          </div>

          <!-- Resultado de emisión -->
          <div v-if="emisionResultado" style="margin-bottom:1rem; padding:1rem; border-radius:8px;"
            :style="{ background: emisionResultado.fallidos > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${emisionResultado.fallidos > 0 ? '#ef4444' : '#22c55e'}` }">
            <strong>Emisión completada:</strong> {{ emisionResultado.exitosos }} exitosas, {{ emisionResultado.fallidos }} con error
            <div v-for="r in emisionResultado.resultados" :key="r.id" style="font-size:0.8rem; margin-top:0.25rem;">
              {{ r.serie }}-{{ String(r.numero).padStart(4,'0') }}:
              <span :style="{ color: r.ok ? '#22c55e' : '#ef4444' }">{{ r.ok ? '✓ emitida' : `✗ ${r.error}` }}</span>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="loadingPendientes" style="text-align:center; padding:3rem; color:var(--text-secondary);">
            <v-progress-circular indeterminate size="32" />
            <p style="margin-top:0.75rem;">Cargando boletas pendientes...</p>
          </div>

          <!-- Sin pendientes -->
          <div v-else-if="boletasPendientes.length === 0" style="text-align:center; padding:3rem; color:var(--text-secondary);">
            <v-icon icon="mdi-check-circle-outline" size="48" style="opacity:0.4;" />
            <p style="margin-top:0.75rem;">No hay boletas pendientes. Todo emitido.</p>
          </div>

          <!-- Lista de pendientes -->
          <div v-else>
            <div style="display:flex; justify-content:flex-end; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
              Total a emitir: <strong style="margin-left:0.25rem;">S/ {{ boletasPendientesTotal.toFixed(2) }}</strong>
            </div>
            <v-card flat style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--bg-secondary); font-size:0.8rem; color:var(--text-secondary);">
                    <th style="padding:0.75rem 1rem; text-align:left;">Boleta</th>
                    <th style="padding:0.75rem 1rem; text-align:left;">Paciente</th>
                    <th style="padding:0.75rem 1rem; text-align:left;">Fecha</th>
                    <th style="padding:0.75rem 1rem; text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in boletasPendientes" :key="b.id"
                    style="border-top:1px solid var(--border); font-size:0.875rem;">
                    <td style="padding:0.75rem 1rem; font-weight:600;">{{ b.serie }}-{{ String(b.numero).padStart(4,'0') }}</td>
                    <td style="padding:0.75rem 1rem;">{{ b.cliente_denominacion || 'CONSUMIDOR FINAL' }}</td>
                    <td style="padding:0.75rem 1rem; color:var(--text-secondary);">{{ b.fecha_de_emision }}</td>
                    <td style="padding:0.75rem 1rem; text-align:right; font-weight:600;">S/ {{ Number(b.total).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </v-card>
          </div>
        </div>

        <!-- Google Calendar Sync: importar citas de IG/FB que no están en el dashboard -->
        <div v-if="facturacionTab === 'gcal_sync'" style="padding: 0 0 2rem 0;">
          <ClientOnly>
            <HealupGCalSync />
          </ClientOnly>
        </div>

        <!-- PSE.PE: Factura Electrónica -->
        <div v-if="facturacionTab === 'factura_electronica'" style="padding: 0 0 2rem 0;">
          <ClientOnly>
            <FacturacionPSE company-id="healup" />
          </ClientOnly>
        </div>

        <!-- Resumen original -->
        <div v-show="facturacionTab === 'resumen'">
        <header class="top-header">
          <h1>Facturación</h1>
          <button class="btn-primary">
            <v-icon icon="mdi-file-chart" size="16" />
            <span>Generar Reporte</span>
          </button>
        </header>

        <div class="content-area">
          <div class="two-column-grid">
            <div class="placeholder-card">
              <h3>Balance General</h3>
              <div class="balance-sheet">
                <div class="balance-item">
                  <span class="label">Activos:</span>
                  <span class="value">$250,000</span>
                </div>
                <div class="balance-item">
                  <span class="label">Pasivos:</span>
                  <span class="value">$120,000</span>
                </div>
                <div class="balance-item total">
                  <span class="label">Patrimonio:</span>
                  <span class="value">$130,000</span>
                </div>
              </div>
            </div>

            <div class="placeholder-card chart">
              <h3>Flujo de Caja</h3>
              <div class="placeholder-chart">
                <v-icon icon="mdi-chart-line" size="48" />
                <p>Gráfica de flujo de caja mensual</p>
              </div>
            </div>
          </div>

          <div class="placeholder-card large">
            <h2>Análisis Financiero</h2>
            <div class="placeholder-chart">
              <v-icon icon="mdi-finance" size="64" />
              <p>Dashboard de métricas financieras y KPIs</p>
            </div>
          </div>

          <div class="table-section">
            <div class="placeholder-card">
              <h3>Reportes Contables</h3>
              <div class="placeholder-table">
                <p>Tabla de reportes generados, libro diario, mayor, etc.</p>
              </div>
            </div>
          </div>
        </div>

        </div><!-- fin tab resumen -->

      </div>

      <!-- ==========  VISTA: GASTOS VARIABLES  ========== -->
      <div v-else-if="activeView === 'gastos_variables'" class="view-container">
        <header class="top-header">
          <h1>Gastos Variables</h1>
        </header>
        <div class="content-area">

          <!-- ALEF · Comisión por conversiones del mes (automático, no editable) -->
          <div style="background: linear-gradient(135deg, rgba(218,165,32,0.08), rgba(218,165,32,0.04)); border: 1px solid rgba(218,165,32,0.25); border-radius: 10px; padding: 16px 18px; margin-bottom: 1.25rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <v-icon icon="mdi-handshake" size="22" color="amber" />
                <div>
                  <div style="font-weight:700; font-size:0.95rem; color:#daa520;">ALEF · Comisión por conversiones</div>
                  <div style="font-size:0.78rem; opacity:0.75;">
                    Mes en curso ·
                    <strong style="color:#daa520;">{{ alefBreakdown.cabina1Count }}</strong> reserva S/50 × S/{{ ALEF_COMISION_ALTA }}
                    +
                    <strong style="color:#daa520;">{{ alefBreakdown.cabina2Count }}</strong> reserva S/20 × S/{{ ALEF_COMISION_BAJA }}
                  </div>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.6rem; font-weight:700; color:#daa520; line-height:1;">
                  S/ {{ alefBreakdown.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                </div>
                <div style="font-size:0.7rem; opacity:0.6; margin-top:2px;">
                  {{ alefBreakdown.totalConversiones }} conversiones
                  <span v-if="alefBreakdown.excluidosCount"> · {{ alefBreakdown.excluidosCount }} excluido(s)</span>
                </div>
              </div>
            </div>

            <details v-if="alefBreakdown.totalConversiones > 0"
              style="margin-top:10px; border-top:1px solid rgba(218,165,32,0.2); padding-top:10px;">
              <summary style="cursor:pointer; font-size:0.78rem; opacity:0.8;">
                Ver detalle de pacientes del mes
              </summary>
              <div style="margin-top:8px; font-size:0.78rem;">
                <div v-if="alefBreakdown.cabina1Count > 0">
                  <div style="font-weight:600; opacity:0.85; margin-bottom:4px;">
                    Cabina 1 — Medicina estética (reserva S/50, ALEF S/{{ ALEF_COMISION_ALTA }}):
                  </div>
                  <ul style="margin:0; padding-left:18px;">
                    <li v-for="p in alefBreakdown.cabina1" :key="p.id" style="opacity:0.85;">
                      {{ p.nombre || '—' }} — <em>{{ p.procedimiento || 'sin proc.' }}</em>
                    </li>
                  </ul>
                </div>
                <div v-if="alefBreakdown.cabina2Count > 0" style="margin-top:8px;">
                  <div style="font-weight:600; opacity:0.85; margin-bottom:4px;">
                    Cabina 2 — No invasivos (reserva S/20, ALEF S/{{ ALEF_COMISION_BAJA }}):
                  </div>
                  <ul style="margin:0; padding-left:18px;">
                    <li v-for="p in alefBreakdown.cabina2" :key="p.id" style="opacity:0.85;">
                      {{ p.nombre || '—' }} — <em>{{ p.procedimiento || 'sin proc.' }}</em>
                    </li>
                  </ul>
                </div>
                <div v-if="alefBreakdown.excluidosCount > 0" style="margin-top:8px;">
                  <div style="font-weight:600; opacity:0.6; margin-bottom:4px;">
                    Excluidos (post-procedimientos, no son conversiones nuevas):
                  </div>
                  <ul style="margin:0; padding-left:18px;">
                    <li v-for="p in alefBreakdown.excluidos" :key="p.id" style="opacity:0.6;">
                      {{ p.nombre || '—' }} — <em>{{ p.procedimiento || 'sin proc.' }}</em>
                    </li>
                  </ul>
                </div>
              </div>
            </details>
            <div v-else style="margin-top:8px; font-size:0.78rem; opacity:0.6;">
              Aún no hay conversiones este mes.
            </div>
          </div>

          <div class="costos-panel precios-section" style="margin-bottom:1.25rem;">
            <div class="costos-seccion" style="border-bottom:none; padding-bottom:0;">
              <div class="costos-seccion-label">
                <span class="costos-bullet-dot"></span>
                <v-icon icon="mdi-bullhorn-outline" size="14" style="margin-right:5px;" />
                GASTOS VARIABLES ADICIONALES
                <button class="btn-add-row" style="margin-left:auto;" @click="agregarGastoVar">
                  <v-icon icon="mdi-plus" size="13" /> Agregar
                </button>
              </div>
              <div class="costos-items-list">
                <div v-for="(g, i) in gastosVarExtra" :key="i" class="costos-item-row">
                  <span class="item-viñeta">•</span>
                  <input v-model="g.nombre" type="text" class="ci-name" placeholder="Concepto (ej: Publicidad)" />
                  <div class="ci-fields">
                    <div class="ci-field editable">
                      <label>Monto/mes</label>
                      <div class="ci-field-input"><span class="ci-prefix">S/</span><input v-model.number="g.monto" type="number" min="0" class="ci-input" /></div>
                    </div>
                  </div>
                  <button class="btn-del-row" @click="eliminarGastoVar(i)" title="Eliminar">
                    <v-icon icon="mdi-close" size="13" />
                  </button>
                </div>
                <div v-if="!gastosVarExtra.length" style="opacity:0.5; padding: 12px; text-align: center; font-size: 0.85rem;">
                  Sin gastos variables aún. Click "Agregar" para empezar.
                </div>
              </div>
              <div class="costos-seccion-total">
                Total variables / mes: <strong>{{ fmtS(preciosCalc.totalGastosVarExtra) }}</strong>
              </div>
            </div>
          </div>
          <div style="font-size:0.78rem; opacity:0.6; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius:8px;">
            <v-icon icon="mdi-information-outline" size="14" />
            Estos gastos también se incluyen en el cálculo del punto de equilibrio en "Estructura de Precios".
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: PROCEDIMIENTOS  ========== -->
      <div v-else-if="activeView === 'procedimientos'" class="view-container">
        <header class="top-header">
          <h1>Procedimientos</h1>
          <button class="btn-primary" @click="() => openProcedureDialog()">
            <v-icon icon="mdi-plus" size="16" />
            <span>Agregar Procedimiento</span>
          </button>
        </header>

        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de Procedimientos</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(procedures, procedureHeaders, 'healup-procedimientos')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="procedureSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="procedureHeaders" :items="procedures" :search="procedureSearch"
                :items-per-page="10" class="elevation-0" no-data-text="No hay procedimientos creados">
                <template v-slot:item.cabina="{ item }">
                  <v-chip
                    size="small"
                    :color="(item.cabina || 'cabina1') === 'cabina1' ? 'indigo' : 'teal'"
                    variant="tonal"
                    style="cursor:pointer;"
                    @click="toggleProcedureCabina(item)"
                  >
                    <v-icon :icon="(item.cabina || 'cabina1') === 'cabina1' ? 'mdi-doctor' : 'mdi-spa'" size="13" class="mr-1" />
                    {{ (item.cabina || 'cabina1') === 'cabina1' ? 'C1 Doctora' : 'C2 Cosmiatra' }}
                  </v-chip>
                </template>

                <template v-slot:item.color="{ item }">
                  <div class="color-preview" :style="{ backgroundColor: item.color }"></div>
                </template>

                <template v-slot:item.price="{ item }">
                  <span class="price-cell">S/ {{ item.price.toLocaleString('es-PE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) }}</span>
                </template>

                <template v-slot:item.discount="{ item }">
                  <span :class="['discount-badge', item.discount > 0 ? 'has-discount' : '']">
                    {{ item.discount === 0 ? 'Sin descuento' : `${item.discount}%` }}
                  </span>
                </template>

                <template v-slot:item.finalPrice="{ item }">
                  <span class="final-price">S/ {{ (item.price * (1 - item.discount / 100)).toLocaleString('es-PE', {
                    minimumFractionDigits: 2, maximumFractionDigits: 2
                  }) }}</span>
                </template>

                <template v-slot:item.receta="{ item }">
                  <button
                    class="icon-btn"
                    @click="openRecetaDialog(item)"
                    title="Ver / editar receta de insumos"
                    style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; background: var(--bg-hover, rgba(218,165,32,0.12));"
                  >
                    <v-icon icon="mdi-flask-outline" size="15" color="warning" />
                    <span style="font-size: 11px; color: var(--text-secondary);">
                      {{ getProcSupplyCount(item.id) > 0 ? getProcSupplyCount(item.id) + ' insumos' : 'Definir' }}
                    </span>
                  </button>
                </template>

                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="openProcedureDialog(item)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deleteProcedure(item.id)">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: HISTORIAL CLÍNICO  ========== -->
      <div v-else-if="activeView === 'historialClinico'" class="view-container">
        <header class="top-header">
          <h1>Historial Clínico</h1>
          <div style="display: flex; gap: 10px;">
            <button v-if="selectedMedicalHistory.length > 0" class="btn-primary"
              style="background-color: #ef4444; color: white;" @click="deleteMultipleMedicalHistory">
              <v-icon icon="mdi-delete" size="16" />
              <span>Eliminar ({{ selectedMedicalHistory.length }})</span>
            </button>
            <button class="btn-secondary" @click="syncMissingMedicalHistory" :disabled="syncLoading">
              <v-icon icon="mdi-sync" size="16" :class="{ 'mdi-spin': syncLoading }" />
              <span>{{ syncLoading ? 'Sincronizando...' : 'Sincronizar Pacientes' }}</span>
            </button>
            <button class="btn-primary" @click="openMedicalHistoryDialog()">
              <v-icon icon="mdi-file-document-plus" size="16" />
              <span>Añadir Historial</span>
            </button>
          </div>
        </header>


        <div class="content-area" style="display: flex; gap: 20px; height: calc(100vh - 140px);">
          <!-- PREVIEW PANE (Left Side - 50%) -->
          <div v-if="previewUrl" class="preview-pane"
            style="flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-card);">
            <div
              style="padding: 10px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <h3>Previsualización</h3>
              <v-btn icon="mdi-close" variant="text" size="small" @click="closePreview"></v-btn>
            </div>
            <div style="flex: 1; overflow: hidden; position: relative;">
              <iframe v-if="previewType === 'pdf'" :src="previewUrl"
                style="width: 100%; height: 100%; border: none;"></iframe>
              <img v-else-if="previewType === 'image'" :src="previewUrl"
                style="width: 100%; height: 100%; object-fit: contain; padding: 10px;" />
              <div v-else style="display: flex; align-items: center; justify-content: center; height: 100%;">
                <p>Vista previa no disponible</p>
              </div>
            </div>
          </div>

          <!-- TABLE PANE (Right Side - 50% if preview open, otherwise 100%) -->
          <div class="table-section" :style="{ flex: 1, width: previewUrl ? '50%' : '100%' }">
            <v-card flat class="custom-data-table" style="height: 100%; display: flex; flex-direction: column;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Registros Médicos</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(medicalHistoryEntries, medicalHistoryHeaders, 'healup-registros-medicos')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="medicalHistorySearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="medicalHistoryHeaders" :items="medicalHistoryEntries"
                :search="medicalHistorySearch" :items-per-page="10" class="elevation-0" show-select
                v-model="selectedMedicalHistory" return-object style="flex: 1; overflow-y: auto;"
                no-data-text="No hay historiales médicos registrados">
                <template v-slot:item.name="{ item }">
                  <a href="#" class="text-primary font-weight-bold" style="text-decoration: none;" @click.prevent="openMedicalProfileDialog(item)">
                    {{ item.name }}
                  </a>
                </template>

                <template v-slot:item.attachment="{ item }">
                  <v-menu v-if="item.attachmentName">
                    <template v-slot:activator="{ props }">
                      <v-btn v-bind="props" size="small" variant="text" color="primary"
                        prepend-icon="mdi-file-document-outline">
                        {{ item.attachmentName }}
                      </v-btn>
                    </template>
                    <v-list density="compact">
                      <v-list-item @click="viewMedicalAttachment(item)" prepend-icon="mdi-eye">
                        <v-list-item-title>Ver</v-list-item-title>
                      </v-list-item>
                      <v-list-item @click="downloadMedicalAttachment(item)" prepend-icon="mdi-download">
                        <v-list-item-title>Descargar</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                  <span v-else class="text-caption text-grey">Sin archivo</span>
                </template>

                <template v-slot:item.actions="{ item }">
                  <v-tooltip location="top" v-if="item.consentimiento_aceptado">
                    <template v-slot:activator="{ props }">
                      <button v-bind="props" class="icon-btn" @click="openConsentimientoViewer(item)">
                        <v-icon icon="mdi-file-document-check" size="16" color="success" />
                      </button>
                    </template>
                    <span>Ver consentimiento firmado</span>
                  </v-tooltip>
                  <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                      <button v-bind="props" class="icon-btn" @click="openEventDialogFromHistory(item)">
                        <v-icon icon="mdi-calendar-plus" size="16" color="primary" />
                      </button>
                    </template>
                    <span>Crear Cita</span>
                  </v-tooltip>
                  <v-tooltip location="top">
                    <template v-slot:activator="{ props }">
                      <button v-bind="props" class="icon-btn" @click="openPatientFormFromHistory(item)">
                        <v-icon icon="mdi-account-plus" size="16" color="success" />
                      </button>
                    </template>
                    <span>Crear Paciente WP</span>
                  </v-tooltip>
                  <button class="icon-btn" @click="editMedicalHistory(item)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deleteMedicalHistory(item.id)">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: CONSENTIMIENTO INFORMADO (TABLET)  ========== -->
      <div v-else-if="activeView === 'consentimiento'" class="view-container">
        <header class="top-header">
          <h1>Consentimiento Informado</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <v-chip v-if="tabletMode" color="success" variant="flat" size="small" prepend-icon="mdi-tablet-cellphone">
              Modo Tablet activo
            </v-chip>
            <v-chip v-else color="info" variant="tonal" size="small" prepend-icon="mdi-tablet">
              Optimizado para tablet
            </v-chip>
            <button v-if="!tabletMode" class="btn-secondary" @click="activeView = 'historialClinico'">
              <v-icon icon="mdi-folder" size="16" />
              <span>Ver historias clínicas</span>
            </button>
            <v-btn
              v-if="tabletMode"
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-lock-open"
              @click="exitTabletMode"
            >Salir modo tablet</v-btn>
          </div>
        </header>
        <div class="content-area">
          <ClientOnly>
            <HealupConsentimientoForm @saved="onConsentimientoSaved" />
          </ClientOnly>
        </div>
      </div>

      <!-- ==========  VISTA: CONTADOR PROCEDIMIENTOS  ========== -->
      <div v-else-if="activeView === 'contadorProcedimientos'" class="view-container">
        <header class="top-header">
          <h1>Contador de Procedimientos</h1>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn-primary" @click="fetchEvents">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <!-- Viñeta de meses -->
        <div class="content-area" style="padding-top: 0; padding-bottom: 0;">
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding: 10px 0;">
            <v-icon icon="mdi-calendar-month" size="18" style="opacity:0.6;" />
            <v-chip
              v-for="m in mesesDisponibles" :key="m.value"
              :color="contadorMes === m.value ? 'primary' : 'default'"
              :variant="contadorMes === m.value ? 'flat' : 'outlined'"
              size="small"
              style="cursor:pointer;"
              @click="contadorMes = m.value"
            >
              {{ m.label }}
            </v-chip>
          </div>
        </div>

        <div class="content-area">
          <!-- Resumen total del mes -->
          <div class="stats-grid mini" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); margin-bottom: 1.5rem;">
            <div class="stat-card" style="background: var(--accent-gold, #daa520); color: #000;">
              <div class="stat-header"><span class="stat-title" style="color:#000;">Total Procedimientos</span></div>
              <div class="stat-value" style="color:#000;">{{ contadorItems.reduce((s, i) => s + i.total, 0) }}</div>
              <div class="stat-subtitle" style="color:#333;">{{ contadorMesLabel }}</div>
            </div>
            <div v-for="g in contadorGrupos.slice(0, 5)" :key="g.grupo" class="stat-card">
              <div class="stat-header"><span class="stat-title" style="font-size:10px; text-transform:uppercase;">{{ g.grupo }}</span></div>
              <div class="stat-value">{{ g.total }}</div>
              <div class="stat-subtitle">procedimientos</div>
            </div>
          </div>

          <!-- Tabla detallada -->
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Detalle por Procedimiento — {{ contadorMesLabel }}</span>
                <v-spacer />
                <v-btn icon size="small" variant="text" color="success" class="me-2" @click="downloadExcel(contadorItems, contadorHeaders, `healup-contador-${contadorMes}`)">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="contadorSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>
              <v-data-table
                :headers="contadorHeaders"
                :items="contadorItems"
                :search="contadorSearch"
                :items-per-page="20"
                class="elevation-0"
                no-data-text="Sin procedimientos en el período seleccionado"
              >
                <template v-slot:item.grupo="{ item }">
                  <v-chip size="x-small" :color="getGrupoColor(item.grupo)" variant="tonal">{{ item.grupo }}</v-chip>
                </template>
                <template v-slot:item.total="{ item }">
                  <span style="font-weight: 700; font-size: 1.1rem;">{{ item.total }}</span>
                </template>
                <template v-slot:item.ingreso_estimado="{ item }">
                  <span class="price-cell">S/ {{ item.ingreso_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</span>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: ALMACÉN  ========== -->
      <div v-else-if="activeView === 'stock'" class="view-container">
        <header class="top-header">
          <h1>Almacén</h1>
          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" @click="fetchStockData">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
            <button class="btn-primary" @click="openStockItemDialog()">
              <v-icon icon="mdi-plus" size="16" />
              <span>Nuevo Insumo</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- Alertas de stock bajo -->
          <v-alert
            v-if="lowStockAlerts.length > 0"
            type="warning"
            variant="tonal"
            class="mb-4"
            style="border-radius: 10px;"
          >
            <template #title>
              <strong>⚠️ {{ lowStockAlerts.length }} insumo{{ lowStockAlerts.length > 1 ? 's' : '' }} por debajo del mínimo</strong>
            </template>
            <template #text>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                <v-chip
                  v-for="a in lowStockAlerts" :key="a.id"
                  color="error" size="small" variant="flat"
                  @click="openAddStockMovement(a, 'entrada')"
                  style="cursor: pointer;"
                >
                  {{ a.nombre }} ({{ a.cantidad_actual }} {{ a.unidad }}) — clic para reponer
                </v-chip>
              </div>
            </template>
          </v-alert>

          <!-- Tabs -->
          <div class="table-tabs" style="margin-bottom: 1rem;">
            <button :class="['tab', { active: stockTab === 'items' }]" @click="stockTab = 'items'">Inventario</button>
            <button :class="['tab', { active: stockTab === 'movimientos' }]" @click="stockTab = 'movimientos'">Movimientos</button>
          </div>

          <!-- TAB: INVENTARIO -->
          <div v-if="stockTab === 'items'" class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Inventario de Insumos</span>
                <v-spacer />
                <v-btn icon size="small" variant="text" color="success" class="me-2"
                  @click="downloadExcel(stockItems, stockHeaders, 'healup-almacen')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="stockSearch" append-inner-icon="mdi-magnify" label="Buscar"
                  single-line hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>

              <v-data-table
                :headers="stockHeaders"
                :items="stockItems"
                :search="stockSearch"
                :items-per-page="20"
                class="elevation-0"
                no-data-text="Sin insumos. Ejecuta sql/healup_stock_schema.sql en Supabase y recarga."
                :sort-by="[{ key: 'estado_orden', order: 'asc' }]"
              >
                <!-- Estado (coloreado) -->
                <template v-slot:item.estado="{ item }">
                  <v-chip
                    :color="Number(item.cantidad_actual) <= Number(item.umbral_minimo) ? 'error'
                           : Number(item.cantidad_actual) <= Number(item.umbral_minimo) * 2 ? 'warning' : 'success'"
                    size="small" variant="flat"
                  >
                    {{ Number(item.cantidad_actual) <= Number(item.umbral_minimo) ? '⚠ Bajo'
                     : Number(item.cantidad_actual) <= Number(item.umbral_minimo) * 2 ? 'Cuidado' : '✓ OK' }}
                  </v-chip>
                </template>

                <!-- Stock actual resaltado si está bajo -->
                <template v-slot:item.cantidad_actual="{ item }">
                  <span :style="{
                    color: Number(item.cantidad_actual) <= Number(item.umbral_minimo) ? '#ef4444' : 'inherit',
                    fontWeight: Number(item.cantidad_actual) <= Number(item.umbral_minimo) ? '700' : '400'
                  }">{{ item.cantidad_actual }} <span style="opacity:0.6; font-size:11px;">{{ item.unidad }}</span></span>
                </template>

                <!-- Costo unitario -->
                <template v-slot:item.costo_unitario="{ item }">
                  <span style="opacity: 0.8;">S/ {{ Number(item.costo_unitario || 0).toFixed(2) }}</span>
                </template>

                <!-- Acciones -->
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="openAddStockMovement(item, 'entrada')"
                    title="Registrar entrada de stock" style="color: #22c55e;">
                    <v-icon icon="mdi-plus-circle-outline" size="18" />
                  </button>
                  <button class="icon-btn" @click="openAddStockMovement(item, 'salida')"
                    title="Registrar salida" style="color: #f97316;">
                    <v-icon icon="mdi-minus-circle-outline" size="18" />
                  </button>
                  <button class="icon-btn" @click="openStockItemDialog(item)" title="Editar insumo">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deleteStockItem(item.id)" title="Eliminar">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>
          </div>

          <!-- TAB: MOVIMIENTOS -->
          <div v-if="stockTab === 'movimientos'" class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Movimientos de Stock</span>
              </v-card-title>
              <v-data-table
                :headers="movimientosHeaders"
                :items="stockMovements"
                :items-per-page="25"
                class="elevation-0"
                no-data-text="Sin movimientos registrados"
              >
                <template v-slot:item.tipo="{ item }">
                  <v-chip
                    :color="item.tipo === 'entrada' ? 'success' : item.tipo === 'ajuste' ? 'info' : 'error'"
                    size="small" variant="flat"
                  >{{ item.tipo }}</v-chip>
                </template>
                <template v-slot:item.cantidad="{ item }">
                  <span :style="{ color: item.tipo === 'entrada' ? '#22c55e' : '#ef4444', fontWeight: '700' }">
                    {{ item.tipo === 'entrada' ? '+' : '-' }}{{ item.cantidad }}
                  </span>
                </template>
                <template v-slot:item.item_nombre="{ item }">
                  {{ item.healup_stock_items?.nombre || `#${item.stock_item_id}` }}
                </template>
                <template v-slot:item.created_at="{ item }">
                  {{ item.created_at
                    ? new Date(item.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
                    : '—' }}
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: CUENTA  ========== -->
      <div v-else-if="activeView === 'cuenta'" class="view-container">
        <header class="top-header">
          <h1>Mi Cuenta</h1>
        </header>
        <div class="content-area" style="display:flex; flex-direction:column; gap:1.25rem;">
          <v-card class="pa-4" max-width="600">
            <v-card-title>Editar Perfil</v-card-title>
            <v-card-text>
              <v-text-field label="Nombre Completo" v-model="currentUser.full_name" variant="outlined"
                class="mb-4"></v-text-field>
              <v-text-field label="Email" v-model="currentUser.email" variant="outlined" readonly disabled
                class="mb-4"></v-text-field>
              <v-btn color="primary" block>Guardar Cambios</v-btn>
            </v-card-text>
          </v-card>

          <!-- Modo Tablet · default consentimiento por paciente -->
          <v-card class="pa-4" max-width="600" :class="{ 'tablet-mode-active': tabletMode }"
                  style="border:1px solid rgba(218,165,32,0.25);">
            <v-card-title class="d-flex align-center" style="gap:.5rem;">
              <v-icon icon="mdi-tablet-cellphone" :color="tabletMode ? 'success' : 'primary'" />
              <span>Modo Tablet</span>
              <v-chip v-if="tabletMode" size="x-small" color="success" variant="flat" class="ml-2">Activo</v-chip>
            </v-card-title>
            <v-card-text>
              <p class="text-body-2 mb-4" style="color:var(--text-secondary, #64748b);">
                Cuando esté <strong>activo</strong>, esta tablet abrirá el formulario de
                <strong>Consentimiento Informado</strong> por defecto cada vez que se cargue
                el dashboard. Ideal para que cada paciente lo llene antes de su atención.
                <br /><br />
                Al guardar una firma, el formulario se reinicia automáticamente para el
                siguiente paciente. Para salir, use el botón <em>"Salir modo tablet"</em>
                en la parte superior del formulario.
              </p>
              <v-switch
                v-model="tabletMode"
                color="success"
                :label="tabletMode ? 'Modo Tablet activado' : 'Modo Tablet desactivado'"
                hide-details
                inset
                @change="onTabletModeChange"
              />
              <v-alert
                v-if="tabletMode"
                type="info"
                variant="tonal"
                density="compact"
                class="mt-4"
                icon="mdi-information"
              >
                La próxima vez que se cargue esta tablet, abrirá directamente el
                formulario de consentimiento.
              </v-alert>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <!-- ==========  VISTA: NOTIFICACIONES  ========== -->
      <div v-else-if="activeView === 'notificaciones'" class="view-container">
        <header class="top-header">
          <h1>Notificaciones</h1>
        </header>
        <div class="content-area">
          <v-card class="pa-4" max-width="800">
            <v-card-title>Configuración de Notificaciones</v-card-title>
            <v-card-text>
              <p>No hay configuraciones de notificaciones disponibles para este dashboard.</p>
            </v-card-text>
          </v-card>
        </div>
      </div>

      <!-- ==========  VISTA: META ADS  ========== -->
      <div v-else-if="activeView === 'meta'" class="view-container">
        <header class="top-header">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <h1 style="display:flex;align-items:center;gap:12px;margin:0;">
              <span class="meta-logo-badge">
                <v-icon icon="mdi-alpha-f-box" size="24" color="white" />
              </span>
              Meta ADS
            </h1>
            <span style="color:var(--text-muted,#888);font-size:0.82rem;">Performance de campañas publicitarias · Healup Aesthetic Lab</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <div v-if="loadingMeta" style="display:flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.8rem;">
              <v-progress-circular size="14" width="2" indeterminate color="#1877F2" />
              Cargando...
            </div>
            <button class="btn-primary" @click="fetchMetaData" :disabled="loadingMeta">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">

          <!-- ── Month selector ── -->
          <div class="meta-month-selector">
            <button
              v-for="r in metaResumen" :key="r.mes"
              :class="['meta-month-tab', { active: mesSeleccionadoMeta === r.mes }]"
              @click="mesSeleccionadoMeta = r.mes">
              {{ metaMesLabel(r.mes) }}
            </button>
          </div>

          <!-- ── KPI Cards ── -->
          <div class="meta-kpi-grid" v-if="mesActualMeta">
            <div class="meta-kpi-card" style="--kpi-color:#1877F2;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(24,119,242,0.15);">
                <v-icon icon="mdi-cash-multiple" size="20" color="#1877F2" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">Inversión Total</div>
                <div class="meta-kpi-value">S/ {{ fmtNum(mesActualMeta.inversion_total) }}</div>
                <div class="meta-kpi-sub">Gasto en Meta ADS</div>
              </div>
            </div>
            <div class="meta-kpi-card" style="--kpi-color:#10b981;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(16,185,129,0.15);">
                <v-icon icon="mdi-account-group" size="20" color="#10b981" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">Leads Totales</div>
                <div class="meta-kpi-value">{{ mesActualMeta.leads_totales }}</div>
                <div class="meta-kpi-sub">Registros captados</div>
              </div>
            </div>
            <div class="meta-kpi-card" style="--kpi-color:#f59e0b;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(245,158,11,0.15);">
                <v-icon icon="mdi-tag-outline" size="20" color="#f59e0b" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">CPA Promedio</div>
                <div class="meta-kpi-value">S/ {{ fmtNum(mesActualMeta.cpa_promedio) }}</div>
                <div class="meta-kpi-sub">Costo por lead</div>
              </div>
            </div>
            <div class="meta-kpi-card" style="--kpi-color:#8b5cf6;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(139,92,246,0.15);">
                <v-icon icon="mdi-eye-outline" size="20" color="#8b5cf6" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">Alcance</div>
                <div class="meta-kpi-value">{{ fmtNumInt(mesActualMeta.alcance_total) }}</div>
                <div class="meta-kpi-sub">Personas únicas</div>
              </div>
            </div>
            <div class="meta-kpi-card" style="--kpi-color:#ec4899;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(236,72,153,0.15);">
                <v-icon icon="mdi-chart-bar" size="20" color="#ec4899" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">Impresiones</div>
                <div class="meta-kpi-value">{{ fmtNumInt(mesActualMeta.impresiones_total) }}</div>
                <div class="meta-kpi-sub">Total impresiones</div>
              </div>
            </div>
            <div class="meta-kpi-card" style="--kpi-color:#daa520;">
              <div class="meta-kpi-icon-wrap" style="background:rgba(218,165,32,0.15);">
                <v-icon icon="mdi-sale" size="20" color="#daa520" />
              </div>
              <div class="meta-kpi-body">
                <div class="meta-kpi-label">Inv. SALE</div>
                <div class="meta-kpi-value">S/ {{ fmtNum(mesActualMeta.inversion_sale) }}</div>
                <div class="meta-kpi-sub">{{ mesActualMeta.leads_sale }} leads SALE</div>
              </div>
            </div>
          </div>

          <!-- ── Gráfico histórico ── -->
          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Histórico de Performance</h2>
                <div class="chart-subtitle">Inversión vs Leads — todos los meses</div>
              </div>
              <div style="display:flex;gap:16px;align-items:center;font-size:0.78rem;color:var(--text-muted);">
                <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;border-radius:3px;background:#1877F2;display:inline-block;"></span>Inversión (S/)</span>
                <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:3px;background:#daa520;display:inline-block;border-radius:2px;"></span>Leads</span>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="bar" height="280" :options="metaChartOptions" :series="metaChartSeries" />
              </client-only>
            </div>
          </div>

          <!-- ── Distribución del mes seleccionado ── -->
          <div v-if="mesActualMeta && (mesActualMeta.inversion_sale > 0 || mesActualMeta.inversion_sin_sale > 0)"
            class="meta-split-row">
            <div class="meta-split-card">
              <div class="meta-split-label">
                <span class="meta-tipo-badge sin-sale">SIN SALE</span>
              </div>
              <div class="meta-split-stats">
                <div class="meta-split-item">
                  <span>Inversión</span>
                  <strong>S/ {{ fmtNum(mesActualMeta.inversion_sin_sale) }}</strong>
                </div>
                <div class="meta-split-item">
                  <span>Leads</span>
                  <strong>{{ mesActualMeta.leads_sin_sale }}</strong>
                </div>
                <div class="meta-split-item">
                  <span>CPA</span>
                  <strong>{{ mesActualMeta.leads_sin_sale > 0 ? 'S/ ' + fmtNum(mesActualMeta.inversion_sin_sale / mesActualMeta.leads_sin_sale) : '—' }}</strong>
                </div>
              </div>
              <div class="meta-split-bar-wrap">
                <div class="meta-split-bar" :style="{ width: mesActualMeta.inversion_total > 0 ? (mesActualMeta.inversion_sin_sale / mesActualMeta.inversion_total * 100) + '%' : '0%', background: '#64748b' }"></div>
                <span class="meta-split-pct">{{ mesActualMeta.inversion_total > 0 ? Math.round(mesActualMeta.inversion_sin_sale / mesActualMeta.inversion_total * 100) : 0 }}%</span>
              </div>
            </div>
            <div class="meta-split-card">
              <div class="meta-split-label">
                <span class="meta-tipo-badge sale">SALE</span>
              </div>
              <div class="meta-split-stats">
                <div class="meta-split-item">
                  <span>Inversión</span>
                  <strong>S/ {{ fmtNum(mesActualMeta.inversion_sale) }}</strong>
                </div>
                <div class="meta-split-item">
                  <span>Leads</span>
                  <strong>{{ mesActualMeta.leads_sale }}</strong>
                </div>
                <div class="meta-split-item">
                  <span>CPA</span>
                  <strong>{{ mesActualMeta.cpa_sale ? 'S/ ' + fmtNum(mesActualMeta.cpa_sale) : '—' }}</strong>
                </div>
              </div>
              <div class="meta-split-bar-wrap">
                <div class="meta-split-bar" :style="{ width: mesActualMeta.inversion_total > 0 ? (mesActualMeta.inversion_sale / mesActualMeta.inversion_total * 100) + '%' : '0%', background: '#daa520' }"></div>
                <span class="meta-split-pct">{{ mesActualMeta.inversion_total > 0 ? Math.round(mesActualMeta.inversion_sale / mesActualMeta.inversion_total * 100) : 0 }}%</span>
              </div>
            </div>
          </div>

          <!-- ── Tablas de campañas ── -->
          <div class="meta-campaigns-section">

            <!-- SIN SALE -->
            <div class="meta-table-block">
              <div class="meta-table-header">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="meta-tipo-badge sin-sale">SIN SALE</span>
                  <span style="font-size:0.8rem;color:var(--text-muted);">{{ campanasSinSaleMes.length }} campañas</span>
                </div>
                <span style="font-size:0.82rem;color:var(--text-muted);">
                  S/ {{ fmtNum(campanasSinSaleMes.reduce((s, c) => s + (parseFloat(c.inversion) || 0), 0)) }} total invertido
                </span>
              </div>
              <div v-if="campanasSinSaleMes.length === 0" class="meta-empty-state">
                <v-icon icon="mdi-information-outline" size="20" color="#555" />
                <span>Sin campañas SIN SALE este mes</span>
              </div>
              <div v-else class="meta-table-wrap">
                <table class="meta-table">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Campaña</th>
                      <th>Inversión</th>
                      <th>Leads</th>
                      <th>CPA</th>
                      <th>Alcance</th>
                      <th>Impresiones</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in campanasSinSaleMes" :key="c.id" class="meta-table-row">
                      <td><span :class="['meta-estado-badge', (c.estado || '').toLowerCase()]">{{ c.estado }}</span></td>
                      <td class="meta-nombre-cell" :title="c.nombre_campana">{{ c.nombre_campana }}</td>
                      <td class="meta-num-cell">S/ {{ fmtNum(c.inversion) }}</td>
                      <td class="meta-num-cell">{{ c.leads }}</td>
                      <td class="meta-num-cell">{{ c.cpa ? 'S/ ' + fmtNum(c.cpa) : '—' }}</td>
                      <td class="meta-num-cell">{{ fmtNumInt(c.alcance) }}</td>
                      <td class="meta-num-cell">{{ fmtNumInt(c.impresiones) }}</td>
                      <td class="meta-date-cell">{{ c.fecha_inicio || '—' }}</td>
                      <td class="meta-date-cell">{{ c.fecha_fin || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- SALE -->
            <div class="meta-table-block" v-if="campanasSaleMes.length > 0">
              <div class="meta-table-header">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="meta-tipo-badge sale">SALE</span>
                  <span style="font-size:0.8rem;color:var(--text-muted);">{{ campanasSaleMes.length }} campañas</span>
                </div>
                <span style="font-size:0.82rem;color:var(--text-muted);">
                  S/ {{ fmtNum(campanasSaleMes.reduce((s, c) => s + (parseFloat(c.inversion) || 0), 0)) }} total invertido
                </span>
              </div>
              <div class="meta-table-wrap">
                <table class="meta-table">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Campaña</th>
                      <th>Inversión</th>
                      <th>Leads</th>
                      <th>CPA</th>
                      <th>Alcance</th>
                      <th>Impresiones</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in campanasSaleMes" :key="c.id" class="meta-table-row">
                      <td><span :class="['meta-estado-badge', (c.estado || '').toLowerCase()]">{{ c.estado }}</span></td>
                      <td class="meta-nombre-cell" :title="c.nombre_campana">{{ c.nombre_campana }}</td>
                      <td class="meta-num-cell">S/ {{ fmtNum(c.inversion) }}</td>
                      <td class="meta-num-cell">{{ c.leads }}</td>
                      <td class="meta-num-cell">{{ c.cpa ? 'S/ ' + fmtNum(c.cpa) : '—' }}</td>
                      <td class="meta-num-cell">{{ fmtNumInt(c.alcance) }}</td>
                      <td class="meta-num-cell">{{ fmtNumInt(c.impresiones) }}</td>
                      <td class="meta-date-cell">{{ c.fecha_inicio || '—' }}</td>
                      <td class="meta-date-cell">{{ c.fecha_fin || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ==========  VISTA: CIERRE MENSUAL (2.13)  ========== -->
      <div v-else-if="activeView === 'cierre_mensual'" class="view-container">
        <header class="top-header">
          <h1>Cierre Mensual</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <v-select v-model="cierreMesSel" :items="cierreMesesDisponibles"
              item-title="label" item-value="value" hide-details density="compact"
              variant="outlined" style="max-width:200px;" />
            <button class="btn-primary" @click="exportarCierreMensualPDF">
              <v-icon icon="mdi-file-pdf-box" size="16" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <div class="stats-grid mini" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); margin-bottom: 1rem;">
            <div class="stat-card" style="background: rgba(34,197,94,0.08);">
              <div class="stat-title" style="color:#22c55e;">Ingresos brutos</div>
              <div class="stat-value" style="color:#22c55e;">S/ {{ cierreIngresos.toLocaleString('es-PE',{minimumFractionDigits:2}) }}</div>
              <div class="stat-subtitle">{{ cierrePacientes }} pacientes</div>
            </div>
            <div class="stat-card" style="background: rgba(239,68,68,0.08);">
              <div class="stat-title" style="color:#ef4444;">Egresos</div>
              <div class="stat-value" style="color:#ef4444;">S/ {{ cierreEgresos.toLocaleString('es-PE',{minimumFractionDigits:2}) }}</div>
              <div class="stat-subtitle">{{ cierreEgresosCount }} movimientos</div>
            </div>
            <div class="stat-card" style="background: rgba(59,130,246,0.08);">
              <div class="stat-title" style="color:#3b82f6;">Utilidad neta</div>
              <div class="stat-value" :style="{ color: cierreUtilidad >= 0 ? '#3b82f6' : '#ef4444' }">
                S/ {{ cierreUtilidad.toLocaleString('es-PE',{minimumFractionDigits:2}) }}
              </div>
              <div class="stat-subtitle">Ingresos − Egresos</div>
            </div>
          </div>

          <h3 style="margin: 16px 0 8px; font-size:1rem;">Pacientes por fuente</h3>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom: 16px;">
            <v-chip v-for="(count, fuente) in cierrePorFuente" :key="fuente" size="small" variant="tonal"
              :color="fuente === 'TikTok' ? 'deep-purple' : fuente === 'WhatsApp' ? 'green' : fuente === 'Instagram' ? 'pink' : 'blue'">
              <v-icon start size="14"
                :icon="fuente === 'TikTok' ? 'mdi-music-note' : fuente === 'WhatsApp' ? 'mdi-whatsapp' : fuente === 'Instagram' ? 'mdi-instagram' : 'mdi-facebook'" />
              {{ fuente }}: <strong style="margin-left:4px;">{{ count }}</strong>
            </v-chip>
          </div>

          <h3 style="margin: 16px 0 8px; font-size:1rem;">Egresos por categoría</h3>
          <v-card flat class="custom-data-table">
            <v-data-table density="compact" :headers="[
              { title: 'Categoría', key: 'categoria' },
              { title: 'Movimientos', key: 'count', align: 'end' },
              { title: 'Total S/', key: 'total', align: 'end' }
            ]" :items="cierreEgresosPorCategoria" :items-per-page="20" hide-default-footer>
              <template v-slot:item.categoria="{ item }">
                <v-chip size="x-small" variant="tonal"
                  :color="(EGRESO_CATEGORIAS.find(c => c.value === item.categoria) || {}).color || 'grey'">
                  {{ item.categoria }}
                </v-chip>
              </template>
              <template v-slot:item.total="{ item }">
                <strong>S/ {{ Number(item.total).toLocaleString('es-PE',{minimumFractionDigits:2}) }}</strong>
              </template>
            </v-data-table>
          </v-card>

          <h3 style="margin: 16px 0 8px; font-size:1rem;">Detalle de egresos del mes ({{ cierreEgresosFiltrados.length }})</h3>
          <v-card flat class="custom-data-table">
            <v-data-table density="compact" :headers="[
              { title: 'Fecha',     key: 'created_at',  width:'95px' },
              { title: 'Categoría', key: 'categoria',   width:'130px' },
              { title: 'Nombre',    key: 'nombre' },
              { title: 'Método',    key: 'metodo_pago', width:'120px' },
              { title: 'Total',     key: 'total',       width:'110px', align: 'end' }
            ]" :items="cierreEgresosFiltrados" :items-per-page="50" hide-default-footer
              no-data-text="No hay egresos registrados este mes">
              <template v-slot:item.created_at="{ item }">
                <span style="font-size:0.78rem;">{{ new Date(item.created_at).toLocaleDateString('es-PE',{ day:'2-digit', month:'2-digit', year:'2-digit' }) }}</span>
              </template>
              <template v-slot:item.categoria="{ item }">
                <v-chip v-if="item.categoria" size="x-small" variant="tonal"
                  :color="(EGRESO_CATEGORIAS.find(c => c.value === item.categoria) || {}).color || 'grey'">
                  {{ item.categoria }}
                </v-chip>
                <span v-else style="opacity:0.5; font-size:0.75rem;">{{ item.tipo_egreso || '—' }}</span>
              </template>
              <template v-slot:item.metodo_pago="{ item }">
                <v-chip v-if="item.metodo_pago" size="x-small" variant="outlined"
                  :color="item.metodo_pago === 'EFECTIVO' ? 'success' : 'primary'">
                  {{ item.metodo_pago }}
                </v-chip>
                <span v-else style="opacity:0.4;">—</span>
              </template>
              <template v-slot:item.total="{ item }">
                <strong>S/ {{ ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)).toLocaleString('es-PE',{minimumFractionDigits:2}) }}</strong>
              </template>
            </v-data-table>
          </v-card>
        </div>
      </div>

      <!-- ==========  VISTA: RECONCILIACIÓN CAJA (2.3)  ========== -->
      <div v-else-if="activeView === 'reconciliacion'" class="view-container">
        <header class="top-header">
          <h1>Reconciliación de Caja</h1>
          <button class="btn-primary" @click="cerrarDia" :disabled="cerrandoDia">
            <v-icon icon="mdi-lock-check" size="16" />
            <span>{{ cerrandoDia ? 'Cerrando…' : 'Cerrar día' }}</span>
          </button>
        </header>
        <div class="content-area">
          <div class="stats-grid mini" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin-bottom: 1rem;">
            <div class="stat-card" style="background: rgba(34,197,94,0.06);">
              <div class="stat-title">Caja chica (efectivo)</div>
              <div class="stat-value" style="color:#22c55e;">S/ {{ saldoCajaChica.toLocaleString('es-PE',{minimumFractionDigits:2}) }}</div>
              <div class="stat-subtitle">Ingresos efectivo − egresos efectivo (mes)</div>
              <v-text-field v-model.number="saldoRealCajaChica" label="Saldo real (input)"
                type="number" min="0" step="0.10" variant="outlined" density="compact"
                prepend-inner-icon="mdi-cash" hide-details class="mt-2" />
              <div v-if="saldoRealCajaChica > 0" :style="{ marginTop: '6px', fontSize: '0.78rem', color: Math.abs(saldoCajaChica - saldoRealCajaChica) < 1 ? '#22c55e' : '#ef4444' }">
                {{ Math.abs(saldoCajaChica - saldoRealCajaChica) < 1 ? '✅ Cuadra' : `⚠️ Diferencia: S/ ${(saldoRealCajaChica - saldoCajaChica).toFixed(2)}` }}
              </div>
            </div>
            <div class="stat-card" style="background: rgba(59,130,246,0.06);">
              <div class="stat-title">Cuenta bancaria</div>
              <div class="stat-value" style="color:#3b82f6;">S/ {{ saldoCuentaBancaria.toLocaleString('es-PE',{minimumFractionDigits:2}) }}</div>
              <div class="stat-subtitle">Ingresos no-efectivo − egresos no-efectivo (mes)</div>
              <v-text-field v-model.number="saldoRealCuentaBancaria" label="Saldo real (input)"
                type="number" min="0" step="0.10" variant="outlined" density="compact"
                prepend-inner-icon="mdi-bank" hide-details class="mt-2" />
              <div v-if="saldoRealCuentaBancaria > 0" :style="{ marginTop: '6px', fontSize: '0.78rem', color: Math.abs(saldoCuentaBancaria - saldoRealCuentaBancaria) < 1 ? '#22c55e' : '#ef4444' }">
                {{ Math.abs(saldoCuentaBancaria - saldoRealCuentaBancaria) < 1 ? '✅ Cuadra' : `⚠️ Diferencia: S/ ${(saldoRealCuentaBancaria - saldoCuentaBancaria).toFixed(2)}` }}
              </div>
            </div>
          </div>

          <div style="font-size:0.85rem; opacity:0.7; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius:8px;">
            <v-icon icon="mdi-information-outline" size="14" />
            Saldos calculados desde pacientes WPP/FBIG con metodo_de_pago + egresos con metodo_pago. "Cerrar día" loguea snapshot al audit_log.
          </div>

          <div v-if="cierreDiaResultado" style="margin-top: 16px; padding: 12px; background: rgba(34,197,94,0.06); border-radius:8px;">
            <h4 style="margin:0 0 6px; color:#22c55e;">Cierre del día — {{ cierreDiaResultado.fecha }}</h4>
            <pre style="font-size:0.78rem; color: var(--text-secondary); white-space: pre-wrap;">{{ cierreDiaResultado.detalle }}</pre>
          </div>
        </div>
      </div>

    </div>

    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->

    <!-- ==========  EGRESOS DIALOG  ========== -->
    <v-dialog v-model="showEgresoDialog" max-width="640px" persistent>
      <v-card>
        <v-card-title>
          <span>{{ editingEgreso ? 'Editar Egreso' : 'Nuevo Egreso' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeEgresoDialog" class="float-right"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="egresoForm">
            <v-row>
              <v-col cols="12" sm="6">
                <v-select v-model="egresoFormData.categoria" :items="EGRESO_CATEGORIAS"
                  item-title="label" item-value="value" label="Categoría"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-tag">
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :title="item.raw.label">
                      <template v-slot:prepend>
                        <v-icon :icon="item.raw.icon" :color="item.raw.color" size="18" class="mr-2" />
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="egresoFormData.metodo_pago" :items="EGRESO_METODOS"
                  label="Método de pago" variant="outlined" density="compact"
                  prepend-inner-icon="mdi-cash-multiple" />
              </v-col>
            </v-row>
            <v-text-field v-model="egresoFormData.tipo_egreso" label="Tipo de Egreso (texto libre)"
              variant="outlined" density="compact" hint="Campo legacy — opcional"
              persistent-hint />
            <v-text-field v-model="egresoFormData.nombre" label="Nombre/Descripción"
              variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']" />
            <v-row>
              <v-col cols="12" sm="7">
                <v-text-field v-model="egresoFormData.fecha" label="Fecha del egreso" type="date"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-calendar"
                  hint="Determina en qué mes aparece este egreso" persistent-hint
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
              <v-col cols="12" sm="5">
                <v-text-field v-model="egresoFormData.referencia" label="Referencia / Voucher"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-receipt-text"
                  hint="# transferencia, voucher, nota libre" persistent-hint />
              </v-col>
            </v-row>

            <!-- Bloque INSUMOS condicional -->
            <div v-if="egresoFormData.categoria === 'INSUMOS'"
              style="background: rgba(236,72,153,0.06); border-radius: 8px; padding: 12px; margin: 8px 0;">
              <div style="font-size: 0.78rem; color: #ec4899; margin-bottom: 8px; font-weight: 600;">
                <v-icon icon="mdi-medical-bag" size="14" class="me-1" /> Detalle de insumo
              </div>
              <v-text-field v-model="egresoFormData.producto"
                label="Producto" placeholder="Ej. Toxina Botox 200 UI"
                variant="outlined" density="compact" />
              <v-row>
                <v-col cols="6">
                  <v-select v-model="egresoFormData.unidad" :items="EGRESO_UNIDADES"
                    label="Unidad" variant="outlined" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="egresoFormData.precio_unitario"
                    label="Precio unitario" type="number" min="0" step="0.10"
                    variant="outlined" density="compact"
                    hint="Si lo llenás, sobreescribe Precio" persistent-hint />
                </v-col>
              </v-row>
            </div>

            <v-row>
              <v-col cols="6">
                <v-text-field v-model.number="egresoFormData.precio" label="Precio (S/)"
                  type="number" min="0" step="0.10" variant="outlined" density="compact"
                  :rules="[v => v >= 0 || 'Requerido']" />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model.number="egresoFormData.cantidad" label="Cantidad"
                  type="number" min="1" variant="outlined" density="compact"
                  :rules="[v => v > 0 || 'Requerido']" />
              </v-col>
            </v-row>

            <v-checkbox v-model="egresoFormData.descartado" density="compact" hide-details
              label="Descartar (no se incluye en reportes — usá esto para movimientos cargados por error)" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeEgresoDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveEgreso" :loading="savingEgreso">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  EVENT CREATION/EDIT DIALOG  ========== -->
    <v-dialog v-model="showEventDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingEvent ? 'Editar Evento' : 'Nuevo Evento' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeEventDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="eventForm">
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.date" label="Fecha" type="date" variant="outlined"
                  density="compact" :rules="[v => !!v || 'La fecha es requerida']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="eventFormData.time" label="Hora" :items="availableTimesForSelectedDate" variant="outlined" density="compact"
                  :rules="[v => !!v || 'La hora es requerida']"
                  no-data-text="No hay horarios disponibles para esta fecha"
                  persistent-hint
                  :hint="availableTimesForSelectedDate.length === 0 ? 'Día no laborable o horarios llenos' : ''"
                ></v-select>
              </v-col>
            </v-row>

            <v-text-field v-model="eventFormData.subject" label="Asunto / Nombre del Evento" variant="outlined"
              density="compact" :rules="[v => !!v || 'El asunto es requerido']"></v-text-field>

            <v-textarea v-model="eventFormData.description" label="Descripción" variant="outlined" density="compact"
              rows="3"></v-textarea>

            <v-autocomplete v-model="eventFormData.procedureId" label="Procedimiento (SKU sincronizado con catálogo)"
              :items="procedures" item-value="id"
              :item-title="(p: any) => `${p.sku ? '['+p.sku+'] ' : ''}${p.name}${p.grupo ? ' · '+p.grupo : ''}`"
              variant="outlined" density="compact"
              :rules="[v => !!v || 'Debe seleccionar un procedimiento']"
              hint="El SKU del procedimiento queda registrado en la reserva y suma al contador">
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.grupo || ''">
                  <template v-slot:prepend>
                    <div class="color-preview mr-2" :style="{ backgroundColor: item.raw.color }"></div>
                  </template>
                  <template v-slot:append>
                    <v-chip v-if="item.raw.sku" size="x-small" color="primary" variant="tonal" label>{{ item.raw.sku }}</v-chip>
                  </template>
                </v-list-item>
              </template>
              <template v-slot:selection="{ item }">
                <div class="d-flex align-center" style="gap:6px;">
                  <div class="color-preview"
                    :style="{ backgroundColor: item.raw.color, width: '18px', height: '18px' }"></div>
                  <v-chip v-if="item.raw.sku" size="x-small" color="primary" variant="tonal" label>{{ item.raw.sku }}</v-chip>
                  <span>{{ item.raw.name }}</span>
                </div>
              </template>
            </v-autocomplete>

            <div v-if="eventFormData.procedureId" class="d-flex align-center gap-2 mb-3" style="flex-wrap:wrap;">
              <v-chip
                v-if="getProcedureSku(eventFormData.procedureId)"
                size="small" color="primary" variant="flat" label
                prepend-icon="mdi-tag-outline"
              >
                SKU {{ getProcedureSku(eventFormData.procedureId) }}
              </v-chip>
              <v-chip
                v-if="getProcedureGrupo(eventFormData.procedureId)"
                size="small" color="grey-darken-2" variant="tonal"
              >
                {{ getProcedureGrupo(eventFormData.procedureId) }}
              </v-chip>
              <v-icon size="16" :color="eventFormData.cabina === 'cabina1' ? 'indigo' : 'teal'"
                :icon="eventFormData.cabina === 'cabina1' ? 'mdi-doctor' : 'mdi-spa'" />
              <v-chip
                size="small"
                :color="eventFormData.cabina === 'cabina1' ? 'indigo' : 'teal'"
                variant="tonal"
              >
                {{ eventFormData.cabina === 'cabina1' ? 'Cabina 1 — Doctora Valeria' : 'Cabina 2 — Cosmiatra' }}
              </v-chip>
              <span style="font-size: 11px; opacity: 0.6; flex-basis:100%;">
                ✓ SKU sincronizado con el catálogo — sumará al Contador de Procedimientos
              </span>
            </div>

            <v-divider class="my-4"></v-divider>

            <h4 class="mb-3">Datos del Cliente</h4>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.clientName" label="Nombre" variant="outlined" density="compact"
                  :rules="[v => !!v || 'El nombre es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.clientSurname" label="Apellido" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El apellido es requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.clientDNI" label="DNI" variant="outlined" density="compact"
                  :rules="[v => !!v || 'El DNI es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.clientPhone" label="Número de Teléfono" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El número es requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="eventFormData.clientEmail" label="Correo Electrónico (Opcional)"
                  variant="outlined" density="compact" type="email"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="eventFormData.eventReason" label="Razón del Evento" :items="eventReasons"
                  variant="outlined" density="compact" :rules="[v => !!v || 'La razón es requerida']"></v-select>
              </v-col>
            </v-row>

            <v-divider class="my-4"></v-divider>

            <h4 class="mb-3">Reserva</h4>

            <v-row>
              <v-col cols="12" sm="6">
                <v-select v-model="eventFormData.metodoReserva" label="Método de reserva"
                  :items="METODOS_RESERVA" variant="outlined" density="compact"
                  prepend-inner-icon="mdi-cash-multiple"
                  hint="Cómo pagó la reserva al agendar" persistent-hint></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="eventFormData.montoReserva" label="Monto de reserva (S/)"
                  type="number" min="0" step="0.10" variant="outlined" density="compact"
                  prepend-inner-icon="mdi-currency-usd"
                  :disabled="!eventFormData.metodoReserva || eventFormData.metodoReserva === 'Sin reserva'"
                  :hint="reservaHint" persistent-hint>
                  <template v-slot:append-inner>
                    <v-tooltip location="top" max-width="280">
                      <template v-slot:activator="{ props }">
                        <v-icon v-bind="props" icon="mdi-information-outline" size="16" style="opacity:0.6;" />
                      </template>
                      <div style="font-size: 0.78rem; line-height:1.4;">
                        <strong>Reserva según cabina:</strong><br>
                        • <b>S/ 50</b> — Cabina 1: medicina estética / orofacial (doctora)<br>
                        • <b>S/ 20</b> — Cabina 2: faciales y corporales no invasivos (HIFU, reductores, carboxi…)
                      </div>
                    </v-tooltip>
                  </template>
                </v-text-field>
              </v-col>
            </v-row>

            <v-textarea v-model="eventFormData.procedimientoSolicitado"
              label="Procedimiento solicitado inicialmente (observaciones)"
              variant="outlined" density="compact" rows="2" auto-grow
              prepend-inner-icon="mdi-clipboard-text-outline"
              hint="Qué pidió el paciente al agendar — útil cuando todavía no se asignó el SKU final"
              persistent-hint></v-textarea>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeEventDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveEvent">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  EVENT DETAIL DIALOG  ========== -->
    <v-dialog v-model="showEventDetailDialog" max-width="500px">
      <v-card v-if="selectedEvent">
        <v-card-title class="event-dialog-title">
          <span>Detalles del Evento</span>
          <v-btn icon="mdi-close" variant="text" @click="closeEventDetailDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <div class="event-detail-section">
            <div class="detail-row">
              <v-icon icon="mdi-calendar" class="detail-icon" />
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div>
                  <div class="detail-label">Fecha y Hora</div>
                  <div class="detail-value">{{ formatEventDate(selectedEvent.date) }} - {{ selectedEvent.time }}</div>
                </div>
                <v-chip
                  size="small"
                  :color="(selectedEvent.cabina || 'cabina1') === 'cabina1' ? 'indigo' : 'teal'"
                  variant="flat"
                >
                  <v-icon :icon="(selectedEvent.cabina || 'cabina1') === 'cabina1' ? 'mdi-doctor' : 'mdi-spa'" size="14" class="mr-1" />
                  {{ (selectedEvent.cabina || 'cabina1') === 'cabina1' ? 'Cabina 1 — Doctora' : 'Cabina 2 — Cosmiatra' }}
                </v-chip>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-text" class="detail-icon" />
              <div>
                <div class="detail-label">Asunto</div>
                <div class="detail-value">{{ selectedEvent.subject }}</div>
              </div>
            </div>

            <div v-if="selectedEvent.description" class="detail-row">
              <v-icon icon="mdi-text-box" class="detail-icon" />
              <div>
                <div class="detail-label">Descripción</div>
                <div class="detail-value">{{ selectedEvent.description }}</div>
              </div>
            </div>

            <v-divider class="my-3"></v-divider>

            <div class="detail-row">
              <v-icon icon="mdi-account" class="detail-icon" />
              <div>
                <div class="detail-label">Cliente</div>
                <div class="detail-value">{{ selectedEvent.clientName }} {{ selectedEvent.clientSurname }}</div>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-card-account-details" class="detail-icon" />
              <div>
                <div class="detail-label">DNI</div>
                <div class="detail-value">{{ selectedEvent.clientDNI }}</div>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-information" class="detail-icon" />
              <div>
                <div class="detail-label">Razón</div>
                <div class="detail-value">{{ selectedEvent.eventReason }}</div>
              </div>
            </div>

            <div v-if="selectedEvent.procedureId" class="detail-row">
              <v-icon icon="mdi-tag-outline" class="detail-icon" />
              <div>
                <div class="detail-label">Procedimiento (SKU sincronizado)</div>
                <div class="detail-value d-flex align-center" style="gap:6px; flex-wrap:wrap;">
                  <v-chip v-if="getProcedureSku(selectedEvent.procedureId)" size="x-small" color="primary" variant="flat" label>
                    {{ getProcedureSku(selectedEvent.procedureId) }}
                  </v-chip>
                  <span>{{ getProcedureName(selectedEvent.procedureId) || '—' }}</span>
                  <v-chip v-if="getProcedureGrupo(selectedEvent.procedureId)" size="x-small" variant="tonal">
                    {{ getProcedureGrupo(selectedEvent.procedureId) }}
                  </v-chip>
                </div>
              </div>
            </div>

            <div v-if="selectedEvent.procedimientoSolicitado" class="detail-row">
              <v-icon icon="mdi-clipboard-text-outline" class="detail-icon" />
              <div>
                <div class="detail-label">Procedimiento solicitado inicialmente</div>
                <div class="detail-value" style="white-space: pre-wrap;">{{ selectedEvent.procedimientoSolicitado }}</div>
              </div>
            </div>

            <div v-if="selectedEvent.metodoReserva" class="detail-row">
              <v-icon icon="mdi-cash-multiple" class="detail-icon" />
              <div>
                <div class="detail-label">Reserva</div>
                <div class="detail-value d-flex align-center" style="gap:8px; flex-wrap:wrap;">
                  <v-chip
                    size="small" variant="flat" label
                    :color="selectedEvent.metodoReserva === 'YAPE' ? 'purple'
                          : selectedEvent.metodoReserva === 'Plin' ? 'blue'
                          : selectedEvent.metodoReserva === 'Efectivo' ? 'success'
                          : selectedEvent.metodoReserva === 'Transferencia' ? 'indigo'
                          : 'grey'"
                  >
                    <v-icon icon="mdi-cash" size="14" class="mr-1" />
                    {{ selectedEvent.metodoReserva }}
                  </v-chip>
                  <span v-if="selectedEvent.montoReserva && selectedEvent.metodoReserva !== 'Sin reserva'"
                    style="font-weight: 600; color: #22c55e;">
                    S/ {{ Number(selectedEvent.montoReserva).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>

        <!-- Panel de insumos del procedimiento -->
        <div v-if="selectedEvent?.procedureId" style="padding: 0 16px 8px;">
          <v-divider class="mb-3"></v-divider>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div>
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:2px;">Descuento de insumos (almacén)</div>
              <v-chip
                v-if="selectedEvent.stockDescontado"
                color="success" size="small" variant="tonal"
              >
                <v-icon icon="mdi-check-circle" size="14" class="mr-1" />
                Descontado {{ selectedEvent.stockDescontadoPor ? `por ${selectedEvent.stockDescontadoPor}` : '' }}
              </v-chip>
              <v-chip v-else color="warning" size="small" variant="tonal">
                <v-icon icon="mdi-clock-outline" size="14" class="mr-1" />
                Pendiente
              </v-chip>
            </div>
            <v-btn
              v-if="!selectedEvent.stockDescontado"
              color="success" variant="outlined" size="small"
              :loading="descontandoStock"
              @click="descontarInsumosEvento(selectedEvent)"
            >
              <v-icon icon="mdi-package-down" size="16" class="mr-1" />
              Descontar insumos
            </v-btn>
          </div>
          <div
            v-if="getRecetaCountForProcedure(selectedEvent.procedureId) === 0"
            style="font-size:11px; color:#f59e0b; margin-top:6px;"
          >
            ⚠️ Este procedimiento no tiene receta. Configúrala en Almacén → Inventario → botón Receta.
          </div>
          <div
            v-else
            style="font-size:11px; color:var(--text-secondary); margin-top:6px;"
          >
            {{ getRecetaCountForProcedure(selectedEvent.procedureId) }} insumo(s) en receta
          </div>
        </div>

        <v-card-actions>
          <v-btn color="error" variant="text" @click="confirmDeleteEvent">
            <v-icon icon="mdi-delete" size="18" />
            Eliminar
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="editSelectedEvent">
            <v-icon icon="mdi-pencil" size="18" />
            Editar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  DAYS WITH EVENTS DIALOG  ========== -->
    <v-dialog v-model="showDayEventsDialog" max-width="500px">
      <v-card v-if="selectedDayEvents.length > 0">
        <v-card-title class="event-dialog-title">
          <span>Eventos del {{ formatEventDate(selectedDayDate) }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeDayEventsDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <div class="day-events-list">
            <div v-for="event in selectedDayEvents" :key="event.id" class="day-event-item"
              @click="openEventDetailFromDay(event)">
              <div class="event-color-indicator" :style="{ backgroundColor: getProcedureColor(event.procedureId) }">
              </div>
              <div class="day-event-info">
                <div class="day-event-time">{{ event.time }}</div>
                <div class="day-event-subject">{{ event.subject }}</div>
                <div class="day-event-client">{{ event.clientName }} {{ event.clientSurname }}</div>
              </div>
              <v-icon icon="mdi-chevron-right" size="20" />
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ==========  PROCEDURE CREATION/EDIT DIALOG  ========== -->
    <v-dialog v-model="showProcedureDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingProcedure ? 'Editar Procedimiento' : 'Nuevo Procedimiento' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeProcedureDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="procedureForm">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
              <v-text-field v-model="procedureFormData.name" label="Nombre del Procedimiento" variant="outlined"
                density="compact" :rules="[v => !!v || 'El nombre es requerido']" style="grid-column:1/-1;"></v-text-field>
              <v-text-field v-model="procedureFormData.sku" label="SKU" variant="outlined"
                density="compact" placeholder="Ej: FAC-001"></v-text-field>
              <v-text-field v-model="procedureFormData.grupo" label="Grupo / Categoría" variant="outlined"
                density="compact" placeholder="Ej: Faciales, Corporales"></v-text-field>
            </div>

            <v-select
              v-model="procedureFormData.cabina"
              label="Cabina asignada"
              variant="outlined"
              density="compact"
              class="mt-3"
              :items="[
                { title: 'Cabina 1 — Doctora Valeria (Armonización facial, Botox, Rellenos)', value: 'cabina1' },
                { title: 'Cabina 2 — Cosmiatra (Faciales, Corporales, HIFU)', value: 'cabina2' }
              ]"
              item-title="title"
              item-value="value"
            >
              <template v-slot:selection="{ item }">
                <v-chip
                  size="small"
                  :color="item.value === 'cabina1' ? 'indigo' : 'teal'"
                  variant="flat"
                >
                  <v-icon :icon="item.value === 'cabina1' ? 'mdi-doctor' : 'mdi-spa'" size="13" class="mr-1" />
                  {{ item.value === 'cabina1' ? 'Cabina 1 — Doctora Valeria' : 'Cabina 2 — Cosmiatra' }}
                </v-chip>
              </template>
            </v-select>

            <div class="mt-3 mb-2">
              <label class="form-label">Color</label>
              <v-color-picker v-model="procedureFormData.color" mode="hex" width="100%" elevation="0"
                hide-inputs></v-color-picker>
              <v-text-field v-model="procedureFormData.color" label="Código de color" variant="outlined"
                density="compact" readonly class="mt-2"></v-text-field>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
              <v-text-field v-model.number="procedureFormData.price" label="Precio" type="number" variant="outlined"
                density="compact" prefix="S/" :rules="[v => v >= 0 || 'Debe ser ≥ 0']" step="0.01"></v-text-field>
              <v-text-field v-model.number="procedureFormData.discount" label="Descuento (%)" type="number"
                variant="outlined" density="compact" suffix="%" :rules="[v => v >= 0 && v <= 100 || '0–100']"></v-text-field>
            </div>

            <div v-if="procedureFormData.discount > 0" class="discount-preview">
              <div class="preview-row">
                <span>Precio original:</span>
                <span class="amount">S/ {{ procedureFormData.price.toLocaleString('es-PE', {
                  minimumFractionDigits: 2
                }) }}</span>
              </div>
              <div class="preview-row">
                <span>Descuento ({{ procedureFormData.discount }}%):</span>
                <span class="amount discount">-S/ {{ (procedureFormData.price * procedureFormData.discount /
                  100).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</span>
              </div>
              <div class="preview-row final">
                <span>Precio final:</span>
                <span class="amount">S/ {{ (procedureFormData.price * (1 - procedureFormData.discount /
                  100)).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</span>
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeProcedureDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveProcedure">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  MEDICAL HISTORY DIALOG  ========== -->
    <v-dialog v-model="showMedicalHistoryDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingMedicalHistory ? 'Editar Historial Médico' : 'Nuevo Historial Médico' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeMedicalHistoryDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="medicalHistoryForm">
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="medicalHistoryFormData.name" label="Nombre" variant="outlined" density="compact"
                  :rules="[v => !!v || 'El nombre es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="medicalHistoryFormData.surname" label="Apellido" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El apellido es requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="medicalHistoryFormData.dni" label="DNI" variant="outlined" density="compact"
                  :rules="[v => !!v || 'El DNI es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="medicalHistoryFormData.phone" label="Teléfono" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El teléfono es requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-text-field v-model="medicalHistoryFormData.email" label="Correo electrónico (Opcional)"
              variant="outlined" density="compact" type="email"></v-text-field>

            <v-text-field v-model="medicalHistoryFormData.dateAdded" label="Fecha" variant="outlined" density="compact"
              type="date" :rules="[v => !!v || 'La fecha es requerida']" class="mt-2"></v-text-field>

            <v-textarea v-model="medicalHistoryFormData.returnNote" label="Notas de devolución" variant="outlined"
              density="compact" rows="3" class="mt-2"></v-textarea>

            <v-select v-model="medicalHistoryFormData.status" label="Estado"
              :items="['Activo', 'Pendiente', 'Finalizado', 'Cancelado']" variant="outlined" density="compact"
              class="mt-2" :rules="[v => !!v || 'El estado es requerido']"></v-select>

            <div class="file-upload-section mt-4">
              <label class="form-label mb-2 d-block">Documento Médico (PDF)</label>
              <div v-if="editingMedicalHistory && medicalHistoryFormData.existingFileName"
                class="mb-2 d-flex align-center">
                <v-icon icon="mdi-file-pdf-box" color="primary" class="mr-2"></v-icon>
                <span class="text-body-2 mr-2">{{ medicalHistoryFormData.existingFileName }}</span>
                <v-chip size="x-small" color="success" variant="flat">Archivo actual</v-chip>
              </div>
              <v-file-input v-model="medicalHistoryFormData.file"
                :label="editingMedicalHistory && medicalHistoryFormData.existingFileName ? 'Cambiar archivo (Opcional)' : 'Seleccionar archivo (PDF o Imagen)'"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp" variant="outlined" density="compact"
                prepend-icon="mdi-paperclip" show-size
                :rules="[v => !v || v.length === 0 || v[0].type === 'application/pdf' || v[0].type.startsWith('image/') || 'Solo se permiten PDF o Imágenes']"></v-file-input>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeMedicalHistoryDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveMedicalHistory">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  MEDICAL PROFILE DIALOG  ========== -->
    <v-dialog v-model="showMedicalProfileDialog" max-width="500px">
      <v-card v-if="selectedMedicalProfile">
        <v-card-title class="event-dialog-title">
          <span>Perfil del Paciente</span>
          <v-btn icon="mdi-close" variant="text" @click="closeMedicalProfileDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <div class="event-detail-section">
            <div class="detail-row">
              <v-icon icon="mdi-account" class="detail-icon" />
              <div>
                <div class="detail-label">Nombre Completo</div>
                <div class="detail-value">{{ selectedMedicalProfile.name }} {{ selectedMedicalProfile.surname }}</div>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-card-account-details" class="detail-icon" />
              <div>
                <div class="detail-label">DNI</div>
                <div class="detail-value">{{ selectedMedicalProfile.dni }}</div>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-phone" class="detail-icon" />
              <div>
                <div class="detail-label">Teléfono</div>
                <div class="detail-value">{{ selectedMedicalProfile.phone }}</div>
              </div>
            </div>

            <div v-if="selectedMedicalProfile.email" class="detail-row">
              <v-icon icon="mdi-email" class="detail-icon" />
              <div>
                <div class="detail-label">Email</div>
                <div class="detail-value">{{ selectedMedicalProfile.email }}</div>
              </div>
            </div>

            <div class="detail-row">
              <v-icon icon="mdi-calendar-clock" class="detail-icon" />
              <div>
                <div class="detail-label">Fecha de Agregado</div>
                <div class="detail-value">{{ selectedMedicalProfile.dateAdded }}</div>
              </div>
            </div>
            
            <div class="detail-row">
              <v-icon icon="mdi-list-status" class="detail-icon" />
              <div>
                <div class="detail-label">Estado</div>
                <div class="detail-value">
                  <v-chip size="small" :color="selectedMedicalProfile.status === 'Activo' ? 'success' : 'default'">
                    {{ selectedMedicalProfile.status || 'Activo' }}
                  </v-chip>
                </div>
              </div>
            </div>

            <div v-if="selectedMedicalProfile.returnNote" class="detail-row">
              <v-icon icon="mdi-note-text" class="detail-icon" />
              <div>
                <div class="detail-label">Notas de Devolución</div>
                <div class="detail-value">{{ selectedMedicalProfile.returnNote }}</div>
              </div>
            </div>

            <v-divider class="my-4"></v-divider>

            <h4 class="mb-3 d-flex align-center">
              <v-icon icon="mdi-calendar-clock" class="mr-2" color="primary"></v-icon>
              Historial de Citas
            </h4>

            <div v-if="selectedPatientAppointments.length === 0" class="text-center pa-4 border rounded border-opacity-25" style="background-color: rgba(var(--v-theme-surface-variant), 0.3);">
              <v-icon icon="mdi-calendar-blank" color="grey" size="32" class="mb-2"></v-icon>
              <div class="text-body-2 text-medium-emphasis">Este paciente no tiene citas registradas.</div>
            </div>
            
            <v-list v-else density="compact" class="bg-transparent pa-0">
              <v-list-item v-for="(appt, index) in selectedPatientAppointments" :key="index"
                class="mb-2 border border-opacity-25 rounded pa-2" elevation="0" style="background-color: rgba(var(--v-theme-surface-variant), 0.1);">
                <template v-slot:prepend>
                  <div class="d-flex flex-column align-center mr-3" style="min-width: 60px;">
                    <span class="text-caption font-weight-bold text-primary">{{ formatEventDate(appt.date) }}</span>
                    <span class="text-caption text-medium-emphasis">{{ appt.time }}</span>
                  </div>
                </template>
                <template #title>
                  <div class="d-flex align-center">
                    <span class="font-weight-medium text-body-2">{{ appt.subject }}</span>
                    <v-chip v-if="appt.eventReason" size="x-small" class="ml-2" color="info" variant="flat">
                      {{ appt.eventReason }}
                    </v-chip>
                  </div>
                </template>
                <template #subtitle>
                  <div class="text-caption mt-1 d-flex align-center">
                    <div class="color-preview mr-1" style="width: 12px; height: 12px; display: inline-block; border-radius: 2px;"
                      :style="{ backgroundColor: getProcedureColor(appt.procedureId) }"></div>
                    {{ getProcedureName(appt.procedureId) || 'Procedimiento General' }}
                  </div>
                </template>
              </v-list-item>
            </v-list>

            <v-divider class="my-4"></v-divider>

            <h4 class="mb-3 d-flex align-center">
              <v-icon icon="mdi-medical-bag" class="mr-2" color="success"></v-icon>
              Historial de Tratamientos
            </h4>

            <div v-if="selectedPatientTreatments.length === 0" class="text-center pa-4 border rounded border-opacity-25" style="background-color: rgba(var(--v-theme-surface-variant), 0.3);">
              <v-icon icon="mdi-text-box-remove-outline" color="grey" size="32" class="mb-2"></v-icon>
              <div class="text-body-2 text-medium-emphasis">Este paciente no tiene tratamientos registrados.</div>
            </div>
            
            <v-list v-else density="compact" class="bg-transparent pa-0">
              <v-list-item v-for="(treatment, index) in selectedPatientTreatments" :key="index"
                class="mb-2 border border-opacity-25 rounded pa-2" elevation="0" style="background-color: rgba(var(--v-theme-surface-variant), 0.1);">
                <template v-slot:prepend>
                  <div class="d-flex flex-column align-center mr-3" style="min-width: 60px;">
                    <span class="text-caption font-weight-bold text-success" v-if="treatment.fecha_agendamiento">
                      {{ formatEventDate(treatment.fecha_agendamiento) }}
                    </span>
                    <span class="text-caption font-weight-bold text-grey" v-else>
                      Sin fecha
                    </span>
                  </div>
                </template>
                <template #title>
                  <div class="d-flex align-center">
                    <span class="font-weight-medium text-body-2">{{ treatment.procedimiento || 'Tratamiento General' }}</span>
                  </div>
                </template>
                <template #subtitle>
                  <div class="text-caption mt-1 d-flex align-center font-weight-bold text-primary">
                    <v-chip size="x-small" color="success" variant="flat">
                      S/ {{ treatment.precio_tratamiento || treatment.precio || '0' }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>

          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="closeMedicalProfileDialog">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  PACIENTES AGENDADOS DEL MES (drill-down)  ========== -->
    <v-dialog v-model="pacientesAgendadosDialog" max-width="1100px" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-4" style="gap:12px; flex-wrap:wrap;">
          <v-icon icon="mdi-account-multiple-check" color="success" />
          <span class="text-h6">{{ pacientesAgendadosModo === 'cita' ? 'Citas en' : 'Convertidos en' }} {{ pacientesAgendadosMesLabel }}</span>
          <v-chip color="success" variant="flat" size="small">{{ pacientesAgendadosMes.length }} pacientes</v-chip>
          <v-chip color="grey-darken-2" variant="tonal" size="small">
            Reservas: S/ {{ pacientesAgendadosTotalReserva.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
          </v-chip>
          <v-chip v-if="pacientesAgendadosVerifResumen.verificado > 0" color="success" variant="tonal" size="small" prepend-icon="mdi-shield-check">
            Verificadas: {{ pacientesAgendadosVerifResumen.verificado }}
          </v-chip>
          <v-chip v-if="pacientesAgendadosVerifResumen.discrepancia > 0" color="error" variant="tonal" size="small" prepend-icon="mdi-alert-circle">
            Discrepancias: {{ pacientesAgendadosVerifResumen.discrepancia }}
          </v-chip>
          <v-chip v-if="pacientesAgendadosVerifResumen.sin_boleta > 0" color="grey" variant="tonal" size="small" prepend-icon="mdi-receipt-text-remove">
            Sin boleta: {{ pacientesAgendadosVerifResumen.sin_boleta }}
          </v-chip>
          <v-spacer />
          <v-btn icon variant="text" size="small" @click="pacientesAgendadosDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <!-- Viñeta de meses (más reciente primero) -->
        <div class="pa-3" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; background: var(--surface-2, rgba(255,255,255,0.02));">
          <v-icon icon="mdi-calendar-month" size="18" style="opacity:0.6;" />
          <v-chip
            v-for="m in pacientesAgendadosMesesDisponibles" :key="m.value"
            :color="pacientesAgendadosMesSel === m.value ? 'success' : 'default'"
            :variant="pacientesAgendadosMesSel === m.value ? 'flat' : 'outlined'"
            size="small"
            style="cursor:pointer;"
            @click="pacientesAgendadosMesSel = m.value"
          >
            {{ m.label }}
          </v-chip>
        </div>

        <v-divider />

        <!-- Resumen por plataforma -->
        <div class="pa-4" style="display:flex; gap:8px; flex-wrap:wrap; background: var(--surface-2, rgba(255,255,255,0.02));">
          <v-chip v-for="(count, label) in pacientesAgendadosResumen" :key="label"
            size="small" variant="tonal"
            :color="label === 'TikTok' ? 'deep-purple' : label === 'WhatsApp' ? 'green' : label === 'Instagram' ? 'pink' : 'blue'">
            <v-icon start size="14"
              :icon="label === 'TikTok' ? 'mdi-music-note' : label === 'WhatsApp' ? 'mdi-whatsapp' : label === 'Instagram' ? 'mdi-instagram' : 'mdi-facebook'" />
            {{ label }}: {{ count }}
          </v-chip>
          <v-spacer />
          <v-text-field v-model="pacientesAgendadosSearch" prepend-inner-icon="mdi-magnify"
            label="Buscar" hide-details density="compact" variant="outlined" style="max-width:240px;" />
        </div>

        <v-card-text class="pa-0" style="max-height: 65vh;">
          <v-data-table
            :headers="pacientesAgendadosHeaders"
            :items="pacientesAgendadosMes"
            :search="pacientesAgendadosSearch"
            :items-per-page="50"
            class="elevation-0"
            no-data-text="Aún no hay pacientes agendados este mes"
          >
            <template v-slot:item.fuente_label="{ item }">
              <v-chip :color="item.fuente_color" size="small" variant="tonal" :prepend-icon="item.fuente_icon">
                {{ item.fuente_label }}
              </v-chip>
            </template>
            <template v-slot:item.procedure_sku="{ item }">
              <div v-if="item.procedure_sku" style="display:flex; flex-direction:column; gap:2px;">
                <v-chip color="primary" size="x-small" variant="flat" label
                  :title="item.procedure_grupo ? `Grupo: ${item.procedure_grupo}` : ''">
                  {{ item.procedure_sku }}
                </v-chip>
                <span v-if="item.booking_sku" style="font-size:0.65rem; opacity:0.55; font-family: monospace;"
                  :title="`Reserva única: ${item.booking_sku}`">
                  {{ item.booking_sku }}
                </span>
              </div>
              <div v-else>
                <v-chip color="grey" size="x-small" variant="tonal" label>sin SKU</v-chip>
                <div v-if="item.booking_sku" style="font-size:0.65rem; opacity:0.55; font-family: monospace; margin-top:2px;">
                  {{ item.booking_sku }}
                </div>
              </div>
            </template>
            <template v-slot:item.anticipo="{ item }">
              <span v-if="item.anticipo > 0" style="font-weight:600; color: var(--accent-gold, #daa520);">
                S/ {{ Number(item.anticipo).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </span>
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.saldo="{ item }">
              <span v-if="item.saldo > 0" style="color:#ef4444; font-weight:600;"
                title="Saldo pendiente al llegar al consultorio">
                S/ {{ Number(item.saldo).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </span>
              <v-chip v-else-if="item.anticipo > 0" size="x-small" color="success" variant="tonal" label
                title="Sin saldo pendiente registrado">Pagado</v-chip>
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.total_acordado="{ item }">
              <span v-if="item.total_acordado > 0" style="opacity:0.85;">
                S/ {{ Number(item.total_acordado).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </span>
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.created_at="{ item }">
              <span v-if="item.created_at" style="font-size:0.78rem;"
                :title="`Registrado: ${new Date(item.created_at).toLocaleString('es-PE')}`">
                {{ new Date(item.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }}
              </span>
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.fecha_agendamiento="{ item }">
              <span v-if="item.fecha_agendamiento" style="font-size:0.78rem; font-weight:500; color: var(--accent-gold, #daa520);"
                :title="`Cita programada para ${formatDateAgendamiento(item.fecha_agendamiento)}`">
                {{ formatDateAgendamiento(item.fecha_agendamiento) }}
              </span>
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.metodo_pago="{ item }">
              <v-chip
                :color="getMetodoPagoStyle(item.metodo_pago).color"
                :prepend-icon="getMetodoPagoStyle(item.metodo_pago).icon"
                size="x-small" variant="tonal"
                :title="item.metodo_pago || 'Método no registrado'"
              >
                {{ getMetodoPagoStyle(item.metodo_pago).label }}
              </v-chip>
            </template>
            <template v-slot:item.conversation_url="{ item }">
              <v-btn
                v-if="item.conversation_url"
                :href="item.conversation_url"
                target="_blank" rel="noopener"
                icon="mdi-message-text-outline"
                size="small" variant="text" color="primary"
                :title="`Abrir conversación de ${item.fuente_label} en Chatwoot`"
              />
              <span v-else style="opacity:0.4;">—</span>
            </template>
            <template v-slot:item.verif_estado="{ item }">
              <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-start;">
                <v-chip
                  :color="getVerifStyle(item.verif_estado).color"
                  :prepend-icon="getVerifStyle(item.verif_estado).icon"
                  size="x-small" variant="flat"
                  :title="item.verif_mensaje"
                >
                  {{ getVerifStyle(item.verif_estado).label }}
                </v-chip>
                <a
                  v-if="item.verif_pdf"
                  :href="item.verif_pdf" target="_blank" rel="noopener"
                  style="font-size:0.7rem; opacity:0.7; font-family:monospace; text-decoration:none;"
                  :title="`Boleta · ${item.verif_total ? 'S/ ' + Number(item.verif_total).toFixed(2) : ''}${item.verif_medio_pago ? ' · ' + item.verif_medio_pago : ''}${item.verif_sunat_ok ? ' · SUNAT ✓' : ''}`"
                >
                  📄 {{ item.verif_serie }}-{{ item.verif_numero }}
                </a>
                <span
                  v-else-if="item.verif_estado !== 'sin_boleta'"
                  style="font-size:0.65rem; opacity:0.55;"
                  :title="item.verif_mensaje"
                >
                  {{ item.verif_serie }}-{{ item.verif_numero }}
                </span>
              </div>
            </template>
          </v-data-table>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-3">
          <v-btn variant="text" prepend-icon="mdi-file-excel" color="success"
            @click="downloadExcel(pacientesAgendadosMes, pacientesAgendadosHeaders, `healup-pacientes-agendados-mes`)">
            Descargar Excel
          </v-btn>
          <v-spacer />
          <v-btn variant="elevated" color="primary" @click="pacientesAgendadosDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  HISTORIA CLÍNICA POR PACIENTE (multi-procedimiento) ========== -->
    <v-dialog v-model="showHistoriaPacienteDialog" max-width="900px" scrollable>
      <v-card>
        <v-card-title style="display:flex; align-items:center; gap:10px; padding:14px 20px; background: rgba(218,165,32,0.06);">
          <v-icon icon="mdi-folder-heart" color="amber" />
          <div>
            <div style="font-weight:600;">Historia clínica</div>
            <div style="font-size:0.78rem; opacity:0.7;">
              {{ historiaPacienteSel?.nombre || '—' }}
              <span v-if="historiaPacienteSel?.dni"> · DNI {{ historiaPacienteSel.dni }}</span>
              <span v-if="historiaPacienteSel?.numero"> · Tel {{ historiaPacienteSel.numero }}</span>
            </div>
          </div>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="closeHistoriaPacienteDialog" />
        </v-card-title>

        <v-card-text class="pa-4" style="max-height: 75vh;">
          <!-- Visitas anteriores -->
          <h4 style="font-size:0.9rem; margin-bottom:8px;">
            <v-icon icon="mdi-history" size="14" /> Visitas anteriores ({{ historiaPacienteVisitas.length }})
          </h4>
          <div v-if="loadingHistoriaPaciente" style="opacity:0.6; padding: 12px; text-align:center;">
            Cargando…
          </div>
          <div v-else-if="!historiaPacienteVisitas.length" style="opacity:0.5; padding: 12px; text-align:center; font-size:0.85rem;">
            Sin visitas registradas para este paciente.
          </div>
          <div v-else style="max-height: 240px; overflow-y: auto; border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 6px; padding: 8px;">
            <div v-for="v in historiaPacienteVisitas" :key="v.id"
              style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size:0.82rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <strong>{{ formatDateAgendamiento(v.dateAdded) || '—' }}</strong>
                <v-chip v-if="v.status" size="x-small" variant="tonal"
                  :color="v.status === 'Activo' ? 'success' : 'default'">{{ v.status }}</v-chip>
              </div>
              <div v-if="v.procedimientos_visita" style="margin-top:4px; color: var(--accent-gold, #daa520); font-weight:500;">
                {{ v.procedimientos_visita }}
              </div>
              <div v-if="v.returnNote" style="margin-top:4px; opacity:0.75; font-size:0.78rem;">
                {{ v.returnNote }}
              </div>
              <div v-if="v.total_visita" style="margin-top:4px; font-size:0.78rem;">
                Total: <strong style="color:#22c55e;">S/ {{ Number(v.total_visita).toLocaleString('es-PE',{minimumFractionDigits:2}) }}</strong>
              </div>
            </div>
          </div>

          <v-divider class="my-4" />

          <!-- Nueva visita con multi-procedimiento -->
          <h4 style="font-size:0.9rem; margin-bottom:8px;">
            <v-icon icon="mdi-plus-circle" size="14" color="success" /> Registrar nueva visita
          </h4>
          <v-row>
            <v-col cols="12" sm="5">
              <v-text-field v-model="nuevaVisita.fecha" type="date" label="Fecha de la visita"
                variant="outlined" density="compact" prepend-inner-icon="mdi-calendar" hide-details />
            </v-col>
            <v-col cols="12" sm="7">
              <v-select v-model="nuevaVisita.cabina"
                :items="[{value:'cabina1',label:'Cabina 1 — Doctora (medicina estética)'},{value:'cabina2',label:'Cabina 2 — Cosmiatra (no invasivos)'}]"
                item-title="label" item-value="value" label="Cabina"
                variant="outlined" density="compact" prepend-inner-icon="mdi-door" hide-details />
            </v-col>
          </v-row>

          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px; margin-bottom:6px;">
            <strong style="font-size:0.85rem;">Procedimientos de esta visita</strong>
            <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus"
              @click="agregarProcedimientoVisita">Agregar procedimiento</v-btn>
          </div>

          <div v-for="(p, i) in nuevaVisita.procedimientos" :key="i"
            style="display:flex; gap:8px; align-items:flex-start; margin-bottom:6px;">
            <v-autocomplete v-model="p.procedure_id" :items="procedures"
              item-value="id" :item-title="(x: any) => `${x.sku ? '['+x.sku+'] ' : ''}${x.name}`"
              label="Catálogo (opcional)" variant="outlined" density="compact"
              clearable hide-details style="flex:2;"
              @update:model-value="(v: any) => { const proc = procedures.find((x:any) => Number(x.id) === Number(v)); if (proc) { p.nombre_libre = proc.name; p.precio = Number(proc.price) || 0; } }" />
            <v-text-field v-model="p.nombre_libre" label="Nombre libre" variant="outlined"
              density="compact" hide-details style="flex:2;" />
            <v-text-field v-model.number="p.precio" label="Precio S/" type="number" min="0" step="0.10"
              variant="outlined" density="compact" hide-details style="flex:0 0 110px;" />
            <v-btn icon="mdi-close" size="small" variant="text" color="error"
              :disabled="nuevaVisita.procedimientos.length === 1"
              @click="eliminarProcedimientoVisita(i)" />
          </div>

          <v-textarea v-model="nuevaVisita.notas_visita" label="Notas de la visita (opcional)"
            variant="outlined" density="compact" rows="2" auto-grow class="mt-2"
            hint="Observaciones, indicaciones, próxima cita…" persistent-hint />

          <div style="margin-top:10px; padding: 10px 14px; background: rgba(34,197,94,0.06); border-radius: 8px; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between;">
              <span>Total de la visita:</span>
              <strong style="color:#22c55e;">S/ {{ totalVisita.toFixed(2) }}</strong>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" @click="closeHistoriaPacienteDialog">Cerrar</v-btn>
          <v-btn color="amber" variant="elevated" :loading="guardandoVisita" @click="guardarVisita"
            prepend-icon="mdi-content-save">
            Guardar visita
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  PATIENT TYPE SELECTION DIALOG  ========== -->
    <v-dialog v-model="showPatientTypeDialog" max-width="640px">
      <v-card>
        <v-card-title class="text-h5 text-center pa-4">
          Seleccionar Origen del Paciente
        </v-card-title>
        <v-card-text class="pa-4">
          <v-row>
            <v-col cols="6" sm="3">
              <v-card hover @click="selectPatientSource('whatsapp')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                <v-icon icon="mdi-whatsapp" size="40" color="success" />
                <span class="text-subtitle-1">WhatsApp</span>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card hover @click="selectPatientSource('tiktok')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                <v-icon icon="mdi-music-note" size="40" color="deep-purple" />
                <span class="text-subtitle-1">TikTok</span>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card hover @click="selectPatientSource('instagram')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                <v-icon icon="mdi-instagram" size="40" color="pink" />
                <span class="text-subtitle-1">Instagram</span>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card hover @click="selectPatientSource('facebook')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                <v-icon icon="mdi-facebook" size="40" color="primary" />
                <span class="text-subtitle-1">Facebook</span>
              </v-card>
            </v-col>
          </v-row>
          <div style="font-size:0.78rem; opacity:0.6; text-align:center; margin-top:12px;">
            WhatsApp y TikTok → tabla WPP · Instagram y Facebook → tabla FB/IG
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ==========  SCHEDULE CONFIG DIALOG  ========== -->
    <v-dialog v-model="showScheduleDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <div>
            <span>Configurar Horario de Atención</span>
            <v-chip size="small" :color="activeCabin === 'cabina1' ? 'indigo' : 'teal'" variant="flat" class="ml-2">
              {{ activeCabin === 'cabina1' ? 'Cabina 1 — Doctora' : 'Cabina 2 — Cosmiatra' }}
            </v-chip>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="closeScheduleDialog"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="scheduleForm">
            <v-text-field v-model.number="activeWorkingHours.slot_duration_minutes" label="Duración de cita (min)" type="number" variant="outlined" density="compact" :rules="[v => v > 0 || 'Min > 0']" class="mb-4"></v-text-field>

            <div class="text-subtitle-1 font-weight-bold mb-3">Horario por Día:</div>
            <v-row v-for="(dayConfig, i) in activeWorkingHours.schedule_json" :key="i" class="align-center mb-1" dense>
              <v-col cols="3">
                <v-switch v-model="dayConfig.active" :label="getDayName(dayConfig.day)" color="primary" hide-details density="compact"></v-switch>
              </v-col>
              <v-col cols="4">
                <v-text-field v-model="dayConfig.start" label="Apertura" type="time" variant="outlined" density="compact" hide-details :disabled="!dayConfig.active"></v-text-field>
              </v-col>
              <v-col cols="4">
                <v-text-field v-model="dayConfig.end" label="Cierre" type="time" variant="outlined" density="compact" hide-details :disabled="!dayConfig.active"></v-text-field>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeScheduleDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveWorkingHours" :loading="savingSchedule">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  PATIENT FORM DIALOG  ========== -->
    <v-dialog v-model="showPatientFormDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingPatient ? 'Editar Paciente' : 'Nuevo Paciente' }} ({{ selectedPatientType === 'wpp' ?
            'WhatsApp' : 'FB / IG' }})</span>
          <v-btn icon="mdi-close" variant="text" @click="closePatientForm"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="patientFormRef">
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="patientFormData.nombre" label="Nombre Completo" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El nombre es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="patientFormData.dni" label="DNI" variant="outlined" density="compact"
                  :rules="[v => !!v || 'El DNI es requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="patientFormData.numero" label="Número de Teléfono" variant="outlined"
                  density="compact" :rules="[v => !!v || 'El número es requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" v-if="selectedPatientType === 'fbig'">
                <v-text-field v-model="patientFormData.red_social" label="Red Social (Link/User)" variant="outlined"
                  density="compact"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="patientFormData.precio" label="Precio de reserva de cita" type="number"
                  prefix="S/" variant="outlined" density="compact"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="patientFormData.precio_tratamiento" label="Precio Tratamiento" type="number"
                  prefix="S/" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>

            <!-- Selector de procedimiento vinculado al catálogo (para precio y receta) -->
            <v-autocomplete
              v-model="patientFormData.procedure_id"
              :items="procedures.filter(p => Number(p.id) > 0)"
              item-title="name"
              item-value="id"
              label="Procedimiento (catálogo)"
              variant="outlined"
              density="compact"
              clearable
              class="mb-2"
              :item-props="(p: any) => ({ subtitle: p.sku ? `${p.sku} · S/${p.price}` : `S/${p.price}` })"
              @update:model-value="(v: any) => {
                const proc = procedures.find(p => Number(p.id) === Number(v))
                if (proc && !patientFormData.procedimiento) patientFormData.procedimiento = proc.name
              }"
            ></v-autocomplete>

            <!-- Desglose de precios cuando hay procedimiento + anticipo -->
            <div v-if="selectedProcedurePrice && parseCurrency(patientFormData.precio) > 0"
              style="background:rgba(var(--v-theme-surface-variant),0.4); border-radius:8px; padding:10px 14px; margin-bottom:12px; font-size:13px;">
              <div style="font-weight:600; margin-bottom:6px; color:var(--text-secondary);">Desglose de cobro</div>
              <div style="display:flex; justify-content:space-between;">
                <span>Precio lista — {{ selectedProcedurePrice.sku }}</span>
                <span>S/ {{ selectedProcedurePrice.precioFinal.toLocaleString('es-PE', {minimumFractionDigits:2}) }}</span>
              </div>
              <div style="display:flex; justify-content:space-between; color:#f59e0b;">
                <span>Anticipo pagado</span>
                <span>− S/ {{ parseCurrency(patientFormData.precio).toLocaleString('es-PE', {minimumFractionDigits:2}) }}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid rgba(255,255,255,0.1); margin-top:6px; padding-top:6px;">
                <span>Saldo a cobrar al servicio</span>
                <span style="color:#22c55e;">
                  S/ {{ Math.max(0, selectedProcedurePrice.precioFinal - parseCurrency(patientFormData.precio)).toLocaleString('es-PE', {minimumFractionDigits:2}) }}
                </span>
              </div>
            </div>

            <!-- SKU de reserva (read-only si ya existe) -->
            <div v-if="patientFormData.booking_sku" style="margin-bottom:12px;">
              <div style="font-size:11px; color:var(--text-secondary); margin-bottom:4px;">SKU de reserva (generado automáticamente)</div>
              <v-chip color="primary" variant="tonal" style="font-family:monospace; font-size:13px;">
                🎫 {{ patientFormData.booking_sku }}
              </v-chip>
            </div>
            <div v-else-if="parseCurrency(patientFormData.precio) > 0" style="font-size:11px; color:#f59e0b; margin-bottom:12px;">
              ✨ Se generará un SKU de reserva al guardar.
            </div>

            <v-text-field v-model="patientFormData.procedimiento" label="Nombre procedimiento (texto libre)" variant="outlined"
              density="compact" class="mb-2" hint="Se auto-completa al seleccionar del catálogo" persistent-hint></v-text-field>

            <v-text-field v-model="patientFormData.fecha_agendamiento" label="Fecha de Agendamiento"
              type="datetime-local" variant="outlined" density="compact"></v-text-field>

            <v-select v-model="patientFormData.metodo_de_pago" label="Método de pago"
              :items="['Yape', 'Transferencia', 'Efectivo', 'Tarjeta crédito/débito', 'Ninguno']" variant="outlined"
              density="compact"></v-select>

            <v-select v-model="patientFormData.estado" label="Estado"
              :items="['Activo', 'Pendiente', 'Finalizado', 'Cancelado']" variant="outlined" density="compact"
              :rules="[v => !!v || 'El estado es requerido']"></v-select>

            <v-select v-model="patientFormData.agendamiento" label="Agendado por" :items="['IA', 'Agente']"
              variant="outlined" density="compact" :rules="[v => !!v || 'Campo requerido']">
              <template v-slot:selection="{ item }">
                <div class="d-flex align-center">
                  <v-icon :icon="item.raw === 'IA' ? 'mdi-robot' : 'mdi-account'" class="mr-2"
                    :color="item.raw === 'IA' ? 'primary' : 'success'" size="20"></v-icon>
                  {{ item.raw }}
                </div>
              </template>
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <v-icon :icon="item.raw === 'IA' ? 'mdi-robot' : 'mdi-account'"
                      :color="item.raw === 'IA' ? 'primary' : 'success'"></v-icon>
                  </template>
                </v-list-item>
              </template>
            </v-select>

          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closePatientForm">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="savePatient">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════  VISTA: ESTRUCTURA DE PRECIOS Y PUNTO DE EQUILIBRIO  ══════════ -->
    <div v-if="activeView === 'precios'" class="view-container" style="padding: 1.5rem; overflow-y: auto; overflow-x: hidden;">

      <header class="top-header" style="margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.3rem; font-weight: 700; margin: 0;">Estructura de Precios y Punto de Equilibrio</h1>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0.2rem 0 0;">
            Edita las variables (borde dorado) para ver resultados en tiempo real. Las celdas grises son fórmulas automáticas.
          </p>
        </div>
      </header>

      <!-- ── PANEL INTEGRADO DE COSTOS ── -->
      <div class="costos-panel precios-section" style="margin-bottom:1.25rem;">

        <!-- Cabecera del panel -->
        <div class="costos-panel-header">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <v-icon icon="mdi-calculator-variant-outline" size="18" style="color:var(--primary,#daa520);" />
            <span class="costos-panel-title">Estructura de Costos</span>
          </div>
          <div class="costos-total-badge">
            Total mensual: <strong>{{ fmtS(preciosCalc.totalCostosFijos + preciosCalc.totalGastosVarExtra) }}</strong>
          </div>
        </div>

        <!-- ● OPERARIOS -->
        <div class="costos-seccion">
          <div class="costos-seccion-label">
            <span class="costos-bullet-dot"></span>
            <v-icon icon="mdi-account-group-outline" size="14" style="margin-right:5px;" />
            OPERARIOS
            <button class="btn-add-row" style="margin-left:auto;" @click="agregarOperadora">
              <v-icon icon="mdi-plus" size="13" /> Agregar
            </button>
          </div>
          <div class="costos-items-list">
            <div v-for="(op, i) in operadoras" :key="i" class="costos-item-row">
              <span class="item-viñeta">•</span>
              <input v-model="op.nombre" type="text" class="ci-name" placeholder="Nombre del operario" />
              <div class="ci-fields">
                <div class="ci-field editable">
                  <label>Salario/mes</label>
                  <div class="ci-field-input"><span class="ci-prefix">S/</span><input v-model.number="op.salario" type="number" min="0" class="ci-input" /></div>
                </div>
                <div class="ci-field editable">
                  <label>Horas/mes</label>
                  <div class="ci-field-input"><input v-model.number="op.horas" type="number" min="1" class="ci-input ci-input-sm" /><span class="ci-prefix">h</span></div>
                </div>
                <div class="ci-field formula">
                  <label>Costo/min</label>
                  <div class="ci-formula-val">{{ op.horas > 0 ? fmtS(op.salario / op.horas / 60) : '—' }}</div>
                </div>
              </div>
              <button v-if="operadoras.length > 1" class="btn-del-row" @click="eliminarOperadora(i)" title="Eliminar">
                <v-icon icon="mdi-close" size="13" />
              </button>
            </div>
          </div>
          <div class="costos-seccion-total">
            Total salarios: <strong>{{ fmtS(preciosCalc.totalSalarios) }}</strong>
            <span class="costos-sep">·</span>
            Costo promedio/min: <strong>{{ fmtS(preciosCalc.costoPorMinuto) }}</strong>
          </div>
        </div>

        <!-- ● GASTOS FIJOS DEL LOCAL -->
        <div class="costos-seccion">
          <div class="costos-seccion-label">
            <span class="costos-bullet-dot"></span>
            <v-icon icon="mdi-home-city-outline" size="14" style="margin-right:5px;" />
            GASTOS FIJOS DEL LOCAL
          </div>
          <div class="costos-items-list">
            <div class="costos-item-row">
              <span class="item-viñeta">•</span>
              <span class="ci-name-static">Alquiler, servicios y equipos</span>
              <div class="ci-fields">
                <div class="ci-field editable">
                  <label>Monto/mes</label>
                  <div class="ci-field-input"><span class="ci-prefix">S/</span><input v-model.number="preciosParams.otrosCostosFijosMes" type="number" min="0" class="ci-input" /></div>
                </div>
              </div>
            </div>
            <div class="costos-item-row">
              <span class="item-viñeta">•</span>
              <span class="ci-name-static">Días laborables / mes</span>
              <div class="ci-fields">
                <div class="ci-field editable">
                  <label>Días</label>
                  <div class="ci-field-input"><input v-model.number="preciosParams.diasLaborables" type="number" min="1" max="31" class="ci-input ci-input-sm" /><span class="ci-prefix">días</span></div>
                </div>
                <div class="ci-field formula">
                  <label>Costo/día</label>
                  <div class="ci-formula-val">{{ fmtS(preciosCalc.costosFijosDia) }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="costos-seccion-total">
            Total fijos (local + salarios): <strong>{{ fmtS(preciosCalc.totalCostosFijos) }}</strong>
          </div>
        </div>

        <!-- ● GASTOS VARIABLES (movido a Contabilidad → tab "Gastos Variables") -->
        <div class="costos-seccion" style="border-bottom:none;padding-bottom:0;">
          <div class="costos-seccion-label">
            <span class="costos-bullet-dot"></span>
            <v-icon icon="mdi-bullhorn-outline" size="14" style="margin-right:5px;" />
            GASTOS VARIABLES (resumen)
            <button class="btn-add-row" style="margin-left:auto;" @click="activeView = 'facturacion'; facturacionTab = 'gastos_variables'">
              <v-icon icon="mdi-arrow-right" size="13" /> Editar en Contabilidad
            </button>
          </div>
          <div style="font-size:0.85rem; opacity:0.7; padding: 8px 0;">
            Total variables: <strong>{{ fmtS(preciosCalc.totalGastosVarExtra) }}</strong>
            <span v-if="gastosVarExtra.length > 0" style="opacity:0.6; font-size:0.75rem;">
              · {{ gastosVarExtra.length }} concepto(s): {{ gastosVarExtra.map(g => g.nombre).filter(Boolean).join(', ') }}
            </span>
          </div>
        </div>

        <!-- Barra de totales integrada -->
        <div class="costos-total-bar">
          <div class="costos-total-item">
            <span class="cti-label">Salarios operarios</span>
            <span class="cti-val">{{ fmtS(preciosCalc.totalSalarios) }}</span>
          </div>
          <span class="cti-op">+</span>
          <div class="costos-total-item">
            <span class="cti-label">Gastos fijos local</span>
            <span class="cti-val">{{ fmtS(preciosParams.otrosCostosFijosMes) }}</span>
          </div>
          <span class="cti-op">+</span>
          <div class="costos-total-item">
            <span class="cti-label">Gastos variables</span>
            <span class="cti-val">{{ fmtS(preciosCalc.totalGastosVarExtra) }}</span>
          </div>
          <span class="cti-op">=</span>
          <div class="costos-total-item accent">
            <span class="cti-label">TOTAL COSTOS / MES</span>
            <span class="cti-val">{{ fmtS(preciosCalc.totalCostosFijos + preciosCalc.totalGastosVarExtra) }}</span>
          </div>
        </div>

      </div><!-- fin panel costos -->

      <!-- ── PROCEDIMIENTOS POR GRUPO (VIÑETAS) ───────────────────── -->
      <div class="precios-section">
        <div class="precios-section-header" style="margin-bottom:1.25rem;">
          <h3 class="precios-section-title" style="margin:0;">
            <v-icon icon="mdi-format-list-group" size="16" style="margin-right:6px;" />
            Procedimientos por Grupo
            <span style="font-size:0.7rem;font-weight:400;color:var(--text-muted,#888);margin-left:0.5rem;">— clic en grupo para ver detalle</span>
          </h3>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <button class="btn-add-row" style="font-size:0.7rem;"
              @click="GRUPOS_HEALUP.forEach(g => { collapsedGroups[g] = false })">
              <v-icon icon="mdi-arrow-expand-all" size="12" /> Expandir todo
            </button>
            <button class="btn-add-row" style="font-size:0.7rem;"
              @click="GRUPOS_HEALUP.forEach(g => { collapsedGroups[g] = true })">
              <v-icon icon="mdi-arrow-collapse-all" size="12" /> Colapsar todo
            </button>
            <button class="btn-add-row" @click="openProcedureDialog()">
              <v-icon icon="mdi-plus" size="14" /> Nuevo Procedimiento
            </button>
          </div>
        </div>

        <!-- Un bloque viñeta por grupo -->
        <div v-for="(procs, grupoKey) in procedimientosPorGrupo" :key="grupoKey" class="grupo-vineta">

          <!-- Cabecera colapsable del grupo -->
          <div class="grupo-vineta-header" @click="toggleGrupo(String(grupoKey))">
            <div style="display:flex;align-items:center;gap:0.65rem;min-width:0;flex:1;">
              <v-icon
                :icon="collapsedGroups[String(grupoKey)] ? 'mdi-chevron-right' : 'mdi-chevron-down'"
                size="16"
                :style="{ color: 'var(--primary,#daa520)', transition: 'transform 0.2s', flexShrink: 0 }"
              />
              <span class="grupo-vineta-bullet"></span>
              <span class="grupo-vineta-nombre">{{ grupoKey }}</span>
              <span class="grupo-count">{{ procs.length }} proc.</span>
              <div v-if="procs.length > 0 && collapsedGroups[String(grupoKey)]" class="grupo-subtotales">
                <span>{{ fmtS(procs.reduce((s,p) => s+(p.price||0)*(1-((p.discount||0)/100)), 0)) }} total lista</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <button class="btn-add-row" style="font-size:0.7rem;" @click.stop="openProcedureDialog(undefined, String(grupoKey))">
                <v-icon icon="mdi-plus" size="12" /> Agregar
              </button>
            </div>
          </div>

          <!-- Cuerpo colapsable -->
          <div v-if="!collapsedGroups[String(grupoKey)]" class="grupo-vineta-body">

            <!-- Grupo vacío -->
            <div v-if="procs.length === 0" class="grupo-empty">
              <v-icon icon="mdi-plus-circle-outline" size="13" style="margin-right:5px;" />
              Sin procedimientos — haz clic en "Agregar" para añadir uno.
            </div>

            <!-- Tabla de procedimientos (una fila por procedimiento) -->
            <div v-else class="proc-table-wrap">

              <!-- Cabecera de columnas -->
              <div class="proc-table-hdr">
                <div class="ptc ptc-id-name">SKU · Nombre</div>
                <div class="ptc ptc-num">P.Original</div>
                <div class="ptc ptc-num">Desc%</div>
                <div class="ptc ptc-num ptc-formula">P.Final</div>
                <div class="ptc ptc-min">Duración</div>
                <div class="ptc ptc-min">T.Prep</div>
                <div class="ptc ptc-min">T.Total</div>
                <div class="ptc ptc-num">C.Insumo</div>
                <div class="ptc ptc-num">C.HH</div>
                <div class="ptc ptc-num ptc-formula">C.Total</div>
                <div class="ptc ptc-num ptc-formula">IGV 19.5%</div>
                <div class="ptc ptc-num ptc-formula">Utilidad</div>
                <div class="ptc ptc-pct ptc-formula">Margen%</div>
                <div class="ptc ptc-wpp" title="Procedimientos agendados vía WhatsApp en el mes actual">WPP mes</div>
                <div class="ptc ptc-actions"></div>
              </div>

              <!-- Una fila por procedimiento -->
              <div v-for="p in procs" :key="p.id"
                   class="proc-row" :class="{ 'proc-row--editing': editingProcs[p.id] }">

                <!-- SKU + color dot + Nombre (columna única) -->
                <div class="ptc ptc-id-name">
                  <template v-if="!editingProcs[p.id]">
                    <span class="proc-color-dot" :style="{ background: p.color || '#3b82f6' }"></span>
                    <span class="proc-sku-tag">{{ p.sku || '—' }}</span>
                    <span class="proc-row-name">{{ p.name }}</span>
                  </template>
                  <template v-else>
                    <input type="color" v-model="editBuffer[p.id].color" class="color-picker-input" />
                    <input v-model="editBuffer[p.id].sku" type="text" class="ci-input" style="width:52px;font-size:0.72rem;" />
                    <input v-model="editBuffer[p.id].name" type="text" class="ci-name" style="flex:1;min-width:100px;" />
                  </template>
                </div>

                <!-- Precio Original (editable) -->
                <div class="ptc ptc-num">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ fmtS(p.price||0) }}</span>
                  <div v-else class="pv-input-wrap">
                    <span class="ci-prefix">S/</span>
                    <input v-model.number="editBuffer[p.id].price" type="number" min="0" class="ci-input ci-input-xs" />
                  </div>
                </div>

                <!-- Descuento % (editable) -->
                <div class="ptc ptc-num">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ p.discount||0 }}%</span>
                  <div v-else class="pv-input-wrap">
                    <input v-model.number="editBuffer[p.id].discount" type="number" min="0" max="100" class="ci-input ci-input-xs" />
                    <span class="ci-prefix">%</span>
                  </div>
                </div>

                <!-- Precio Final cobrado (fórmula) -->
                <div class="ptc ptc-num">
                  <span class="pv-val pv-formula">{{ fmtS(procCalc(p).precioFinal) }}</span>
                </div>

                <!-- Duración del servicio (editable) -->
                <div class="ptc ptc-min">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ procMeta[p.id]?.duracion||0 }}'</span>
                  <div v-else class="pv-input-wrap">
                    <input v-model.number="editBuffer[p.id].duracion" type="number" min="0" class="ci-input ci-input-xs" />
                    <span class="ci-prefix">min</span>
                  </div>
                </div>

                <!-- Tiempo de preparación y cierre (editable) -->
                <div class="ptc ptc-min">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ procMeta[p.id]?.tiempoPrep||0 }}'</span>
                  <div v-else class="pv-input-wrap">
                    <input v-model.number="editBuffer[p.id].tiempoPrep" type="number" min="0" class="ci-input ci-input-xs" />
                    <span class="ci-prefix">min</span>
                  </div>
                </div>

                <!-- Tiempo total en minutos (editable) -->
                <div class="ptc ptc-min">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ procMeta[p.id]?.tiempoTotal||0 }}'</span>
                  <div v-else class="pv-input-wrap">
                    <input v-model.number="editBuffer[p.id].tiempoTotal" type="number" min="0" class="ci-input ci-input-xs" />
                    <span class="ci-prefix">min</span>
                  </div>
                </div>

                <!-- Costo de insumos (editable) -->
                <div class="ptc ptc-num">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ fmtS(procMeta[p.id]?.costoInsumo||0) }}</span>
                  <div v-else class="pv-input-wrap">
                    <span class="ci-prefix">S/</span>
                    <input v-model.number="editBuffer[p.id].costoInsumo" type="number" min="0" class="ci-input ci-input-xs" />
                  </div>
                </div>

                <!-- Costo horas hombre (editable) -->
                <div class="ptc ptc-num">
                  <span v-if="!editingProcs[p.id]" class="pv-val pv-editable">{{ fmtS(procMeta[p.id]?.costoHH||0) }}</span>
                  <div v-else class="pv-input-wrap">
                    <span class="ci-prefix">S/</span>
                    <input v-model.number="editBuffer[p.id].costoHH" type="number" min="0" class="ci-input ci-input-xs" />
                  </div>
                </div>

                <!-- Costo total (fórmula: insumos + HH) -->
                <div class="ptc ptc-num">
                  <span class="pv-val pv-formula">{{ fmtS(procCalc(p).costoTotal) }}</span>
                </div>

                <!-- IGV y renta 19.5% (fórmula fija) -->
                <div class="ptc ptc-num">
                  <span class="pv-val pv-formula">{{ fmtS(procCalc(p).igvRenta) }}</span>
                </div>

                <!-- Utilidad neta (fórmula) -->
                <div class="ptc ptc-num">
                  <span class="pv-val pv-formula" :class="{ 'pr-positive': procCalc(p).utilidadNeta >= 0, 'pr-negative': procCalc(p).utilidadNeta < 0 }">
                    {{ fmtS(procCalc(p).utilidadNeta) }}
                  </span>
                </div>

                <!-- Margen neto % (fórmula) -->
                <div class="ptc ptc-pct">
                  <span class="pv-val pv-formula" :class="{ 'pr-positive': procCalc(p).margenNeto >= 0, 'pr-negative': procCalc(p).margenNeto < 0 }">
                    {{ procCalc(p).precioFinal > 0 ? procCalc(p).margenNeto.toFixed(1)+'%' : '—' }}
                  </span>
                </div>

                <!-- Conteo WPP mes actual -->
                <div class="ptc ptc-wpp">
                  <span class="proc-wpp-badge" :class="{ 'wpp-active': getProcWppCount(p.name) > 0 }">
                    {{ getProcWppCount(p.name) }}
                  </span>
                </div>

                <!-- Acciones -->
                <div class="ptc ptc-actions">
                  <template v-if="!editingProcs[p.id]">
                    <button class="btn-proc-edit" @click="startEditProc(p)" title="Editar">
                      <v-icon icon="mdi-pencil-outline" size="12" />
                    </button>
                    <button class="btn-del-row" @click="deleteProcedure(p.id)" title="Eliminar">
                      <v-icon icon="mdi-trash-can-outline" size="13" />
                    </button>
                  </template>
                  <template v-else>
                    <button class="btn-proc-save" @click="saveEditProc(p)" title="Guardar">
                      <v-icon icon="mdi-check" size="12" />
                    </button>
                    <button class="btn-proc-cancel" @click="cancelEditProc(p.id)" title="Cancelar">
                      <v-icon icon="mdi-close" size="12" />
                    </button>
                  </template>
                </div>

              </div><!-- fin proc-row -->

              <!-- Subtotal del grupo -->
              <div class="grupo-subtotal-bar">
                <span class="gsb-label">Subtotal {{ grupoKey }}</span>
                <span>{{ procs.reduce((s,p) => s+(procMeta[p.id]?.sesiones||0),0) }} ses/mes</span>
                <span>Ingresos: {{ fmtS(procs.reduce((s,p) => s+procCalc(p).ingresos,0)) }}</span>
                <span>Utilidad: {{ fmtS(procs.reduce((s,p) => s+(procCalc(p).utilidadNeta*(procMeta[p.id]?.sesiones||1)),0)) }}</span>
                <span>WPP: {{ procs.reduce((s,p) => s+getProcWppCount(p.name),0) }}</span>
              </div>

            </div><!-- fin proc-table-wrap -->

          </div><!-- fin grupo-vineta-body -->
        </div><!-- fin grupo-vineta -->

        <!-- TOTAL GENERAL -->
        <div v-if="procedures.length > 0" class="grupo-total-general" style="margin-top:1rem;">
          <span>TOTAL GENERAL</span>
          <span>{{ preciosCalc.totalSesiones }} sesiones</span>
          <span>Ingresos: <strong>{{ fmtS(preciosCalc.totalIngresos) }}</strong></span>
          <span>Insumos: <strong>{{ fmtS(preciosCalc.totalCostosInsumos) }}</strong></span>
          <span>Margen bruto: <strong>{{ fmtS(preciosCalc.totalIngresos - preciosCalc.totalCostosInsumos) }}</strong></span>
        </div>
      </div>

      <!-- ── ESTADO DE RESULTADOS + PUNTO DE EQUILIBRIO ───────────── -->
      <div class="precios-results-grid">

        <!-- Estado de resultados -->
        <div class="precios-section" style="margin-top: 0;">
          <h3 class="precios-section-title">
            <v-icon icon="mdi-file-chart-outline" size="16" style="margin-right: 6px;" />
            Estado de Resultados Mensual
          </h3>
          <div class="resultado-card">
            <div class="resultado-row">
              <span>Ingresos Brutos</span>
              <span class="resultado-val positive">{{ fmtS(preciosCalc.totalIngresos) }}</span>
            </div>
            <div class="resultado-row sub">
              <span>(−) Insumos de procedimientos</span>
              <span class="resultado-val negative">({{ fmtS(preciosCalc.totalCostosInsumos) }})</span>
            </div>
            <div class="resultado-row sub">
              <span>(−) Publicidad y otros variables</span>
              <span class="resultado-val negative">({{ fmtS(preciosCalc.totalGastosVarExtra) }})</span>
            </div>
            <div class="resultado-row subtotal">
              <span>Margen Bruto</span>
              <span class="resultado-val">{{ fmtS(preciosCalc.margenBruto) }}</span>
            </div>
            <div class="resultado-row sub">
              <span>(−) Salarios operarios</span>
              <span class="resultado-val negative">({{ fmtS(preciosCalc.totalSalarios) }})</span>
            </div>
            <div class="resultado-row sub">
              <span>(−) Costos fijos del local</span>
              <span class="resultado-val negative">({{ fmtS(preciosParams.otrosCostosFijosMes) }})</span>
            </div>
            <div class="resultado-row total"
              :class="{ 'utilidad-positiva': preciosCalc.utilidadNeta >= 0, 'utilidad-negativa': preciosCalc.utilidadNeta < 0 }">
              <span>Utilidad Neta</span>
              <span class="resultado-val">{{ fmtS(preciosCalc.utilidadNeta) }}</span>
            </div>
            <div class="resultado-row margen-neto">
              <span>Margen Neto</span>
              <span class="resultado-val"
                :style="{ color: preciosCalc.margenNetoPct >= 0 ? 'var(--success, #4caf50)' : 'var(--error, #f44336)' }">
                {{ preciosCalc.margenNetoPct.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Punto de equilibrio -->
        <div class="precios-section" style="margin-top: 0;">
          <h3 class="precios-section-title">
            <v-icon icon="mdi-chart-bell-curve" size="16" style="margin-right: 6px;" />
            Punto de Equilibrio
          </h3>
          <div class="equilibrio-card">
            <div class="equilibrio-item">
              <div class="equilibrio-label">Sesiones totales (escenario actual)</div>
              <div class="equilibrio-val">{{ preciosCalc.totalSesiones }} sesiones</div>
            </div>
            <div class="equilibrio-item">
              <div class="equilibrio-label">Ticket promedio ponderado</div>
              <div class="equilibrio-val">{{ fmtS(preciosCalc.ticketPromedio) }}</div>
              <div class="equilibrio-formula">= ingresos totales ÷ sesiones totales</div>
            </div>
            <div class="equilibrio-item">
              <div class="equilibrio-label">Margen variable por sesión</div>
              <div class="equilibrio-val">{{ fmtS(preciosCalc.margenVarPorSesion) }}</div>
              <div class="equilibrio-formula">= (ingresos − todos los costos variables) ÷ sesiones</div>
            </div>
            <div class="equilibrio-item highlight">
              <div class="equilibrio-label">Sesiones mínimas para cubrir costos fijos</div>
              <div class="equilibrio-val accent">{{ Math.ceil(preciosCalc.sesionesEquilibrio) }} sesiones</div>
              <div class="equilibrio-formula">= costos fijos totales ÷ margen variable/sesión</div>
            </div>
            <div class="equilibrio-item highlight">
              <div class="equilibrio-label">Ingresos mínimos (punto de equilibrio)</div>
              <div class="equilibrio-val accent">{{ fmtS(preciosCalc.ingresosEquilibrio) }}</div>
              <div class="equilibrio-formula">= sesiones mínimas × ticket promedio</div>
            </div>
            <div style="margin-top: 1rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px;">
                <span style="color: var(--text-muted)">Cobertura del punto de equilibrio</span>
                <span style="font-weight: 600;">
                  {{ preciosCalc.ingresosEquilibrio > 0 ? Math.min(Math.round((preciosCalc.totalIngresos / preciosCalc.ingresosEquilibrio) * 100), 200) : 0 }}%
                </span>
              </div>
              <div style="background: var(--bg-tertiary, #2a2a2a); border-radius: 4px; height: 8px; overflow: hidden;">
                <div :style="{
                  width: preciosCalc.ingresosEquilibrio > 0 ? Math.min((preciosCalc.totalIngresos / preciosCalc.ingresosEquilibrio) * 100, 100) + '%' : '0%',
                  height: '100%',
                  background: preciosCalc.totalIngresos >= preciosCalc.ingresosEquilibrio ? 'var(--success, #4caf50)' : '#daa520',
                  transition: 'width 0.4s ease', borderRadius: '4px'
                }"></div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- fin grid resultados -->

    </div><!-- fin vista precios -->

    <!-- ==========  RECETA DIALOG (Insumos por procedimiento)  ========== -->
    <v-dialog v-model="recetaDialog" max-width="680px" persistent scrollable>
      <v-card style="max-height: 90vh;">
        <v-card-title class="event-dialog-title" style="display: flex; align-items: center; gap: 10px;">
          <v-icon icon="mdi-flask-outline" color="warning" />
          <div>
            <div>Receta — {{ recetaProcedure?.name || '' }}</div>
            <div style="font-size: 11px; opacity: 0.6; font-weight: 400;">{{ recetaProcedure?.sku || '' }} · {{ recetaProcedure?.grupo || '' }}</div>
          </div>
        </v-card-title>

        <v-card-text style="padding: 0;">
          <!-- Tabla de insumos actuales -->
          <div style="padding: 12px 16px 0;">
            <div v-if="recetaIngredientes.length === 0" style="text-align: center; padding: 24px; color: var(--text-secondary); font-size: 13px;">
              <v-icon icon="mdi-flask-empty-outline" size="36" style="opacity: 0.4;" />
              <div style="margin-top: 8px;">Sin insumos definidos para este procedimiento.</div>
            </div>

            <div v-else>
              <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; opacity: 0.5; margin-bottom: 8px; letter-spacing: 0.05em;">
                Insumos de la receta
              </div>
              <div
                v-for="ing in recetaIngredientes"
                :key="ing.id"
                style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--bg-hover, rgba(0,0,0,0.04)); margin-bottom: 6px;"
              >
                <v-icon icon="mdi-circle-small" size="16" color="warning" style="flex-shrink: 0;" />
                <span style="flex: 1; font-size: 13px;">{{ getStockItemName(ing.stock_item_id) }}</span>
                <span style="font-weight: 700; font-size: 14px; min-width: 60px; text-align: right;">{{ ing.cantidad_usada }}</span>
                <span style="font-size: 12px; opacity: 0.6; min-width: 55px;">{{ ing.unidad || getStockItemUnit(ing.stock_item_id) }}</span>
                <button class="icon-btn" @click="deleteProcSupplyDirect(ing.id)" title="Quitar insumo" style="color: #ef4444; flex-shrink: 0;">
                  <v-icon icon="mdi-close" size="16" />
                </button>
              </div>
            </div>
          </div>

          <v-divider style="margin: 12px 0;" />

          <!-- Formulario para agregar nuevo insumo -->
          <div style="padding: 0 16px 12px;">
            <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; opacity: 0.5; margin-bottom: 10px; letter-spacing: 0.05em;">
              Agregar insumo a la receta
            </div>
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-autocomplete
                  v-model="recetaNewForm.stock_item_id"
                  :items="stockItemsForReceta"
                  item-title="label"
                  item-value="id"
                  label="Insumo *"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  no-data-text="Sin insumos. Ve a Almacén y agrega primero."
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model.number="recetaNewForm.cantidad"
                  label="Cantidad *"
                  variant="outlined"
                  density="compact"
                  type="number"
                  min="0.01"
                  step="0.01"
                  hide-details
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-combobox
                  v-model="recetaNewForm.unidad"
                  :items="UNIDADES_RECETA"
                  label="Unidad"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
              </v-col>
              <v-col cols="12" sm="1" style="display: flex; align-items: center;">
                <button
                  class="btn-primary"
                  @click="addRecetaIngrediente"
                  :disabled="!recetaNewForm.stock_item_id || !recetaNewForm.cantidad"
                  style="padding: 6px 10px; width: 100%;"
                >
                  <v-icon icon="mdi-plus" size="16" />
                </button>
              </v-col>
            </v-row>

            <!-- También permite crear nuevo insumo inline -->
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.6;">
              ¿No encuentras el insumo?
              <span
                style="color: var(--accent-gold, #daa520); cursor: pointer; text-decoration: underline;"
                @click="recetaDialog = false; openStockItemDialog()"
              >
                Agrega un nuevo insumo en Almacén
              </span>
            </div>
          </div>
        </v-card-text>

        <v-card-actions>
          <div style="flex: 1; font-size: 12px; opacity: 0.5;">
            {{ recetaIngredientes.length }} insumo{{ recetaIngredientes.length !== 1 ? 's' : '' }} definido{{ recetaIngredientes.length !== 1 ? 's' : '' }}
          </div>
          <button class="btn-primary" @click="recetaDialog = false">Cerrar</button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  STOCK ITEM DIALOG (Agregar/Editar Insumo)  ========== -->
    <v-dialog v-model="stockItemDialog" max-width="520px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          {{ editingStockItem ? 'Editar Insumo' : 'Nuevo Insumo' }}
        </v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" sm="8">
              <v-text-field v-model="stockItemForm.nombre" label="Nombre del insumo *" variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']" />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model="stockItemForm.unidad" label="Unidad (ml, g, vial…)" variant="outlined" density="compact" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="stockItemForm.cantidad_actual" label="Cantidad actual" variant="outlined" density="compact" type="number" min="0" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="stockItemForm.umbral_minimo" label="Alerta si baja de…" variant="outlined" density="compact" type="number" min="0" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="stockItemForm.costo_unitario" label="Costo por unidad (S/)" variant="outlined" density="compact" type="number" min="0" step="0.01" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="stockItemForm.categoria" label="Categoría" variant="outlined" density="compact" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="stockItemForm.proveedor" label="Proveedor" variant="outlined" density="compact" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="stockItemForm.notas" label="Notas" variant="outlined" density="compact" rows="2" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <button class="btn-secondary" @click="stockItemDialog = false">Cancelar</button>
          <button class="btn-primary" @click="saveStockItem">Guardar</button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  STOCK MOVEMENT DIALOG (Entrada/Salida/Ajuste)  ========== -->
    <v-dialog v-model="stockMovementDialog" max-width="480px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          {{ stockMovementForm.tipo === 'entrada' ? '📦 Registrar Entrada' : stockMovementForm.tipo === 'salida' ? '📤 Registrar Salida' : '🔧 Ajuste de Stock' }}
        </v-card-title>
        <v-card-text>
          <p style="margin-bottom: 1rem; color: var(--text-secondary);">
            Insumo: <strong>{{ stockMovementTargetName }}</strong>
          </p>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="stockMovementForm.tipo"
                :items="[{ title: 'Entrada (compra/reposición)', value: 'entrada' }, { title: 'Salida (uso manual)', value: 'salida' }, { title: 'Ajuste de inventario', value: 'ajuste' }]"
                item-title="title"
                item-value="value"
                label="Tipo"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="stockMovementForm.cantidad" label="Cantidad" variant="outlined" density="compact" type="number" min="0.01" step="0.01" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="stockMovementForm.motivo" label="Motivo / Referencia" variant="outlined" density="compact" placeholder="Ej: compra proveedor, uso en paciente, etc." />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="stockMovementForm.notas" label="Notas adicionales" variant="outlined" density="compact" rows="2" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <button class="btn-secondary" @click="stockMovementDialog = false">Cancelar</button>
          <button class="btn-primary" @click="saveStockMovement">Registrar</button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PROC SUPPLY DIALOG removed — replaced by per-procedure Receta dialog -->

    <!-- ==========  REMARKETING  ========== -->
      <RemarketingPanel
        v-if="activeView === 'remarketing'"
        company-id="healup"
        :lead-tablas="{ wpp: 'GeneralBDwppHEALUP', fbig: 'GeneralBDfbigHEALUP' }"
      />

      <!-- ==========  VISTA: REPORTE DIARIO  ========== -->
      <div v-if="activeView === 'reporte'" class="view-container">
        <ReporteEmpresaPanel empresa-id="Heal up" empresa-nombre="Healup" :current-user="currentUser?.full_name" />
      </div>

      <!-- ==========  VISTA: TICKETS  ========== -->
      <div v-if="activeView === 'tickets'" class="view-container">
        <TicketPanel company-id="Heal up" empresa-nombre="Healup" :current-user="currentUser?.full_name" />
      </div>

    <!-- ==========  CONSENTIMIENTO INFORMADO · VIEWER DIALOG  ========== -->
    <HealupConsentimientoViewer
      v-model="showConsentimientoViewer"
      :historia="selectedConsentimientoHistoria"
    />

    <!-- ==========  AGENTE CONVERSACIONAL DE VOZ  ========== -->
    <HealupAgent />

  </div>
</template>

<style scoped>
/* ── ESTRUCTURA DE PRECIOS ─────────────────────────────────────────── */

/* Panel integrado de costos */
.costos-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border, #2a2a2a);
}

.costos-panel-title {
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary, #fff);
}

.costos-total-badge {
  font-size: 0.8rem;
  color: var(--text-muted, #888);
  padding: 0.3rem 0.75rem;
  background: var(--bg-primary, #111);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 20px;
}
.costos-total-badge strong { color: var(--primary, #daa520); }

/* Secciones de viñetas */
.costos-seccion {
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border, #1e1e1e);
}

.costos-seccion-label {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

.costos-bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary, #daa520);
  margin-right: 8px;
  flex-shrink: 0;
}

.costos-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.costos-item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 6px;
  transition: background 0.15s;
}
.costos-item-row:hover { background: rgba(255,255,255,0.025); }

.item-viñeta {
  color: var(--primary, #daa520);
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
  width: 12px;
  text-align: center;
}

.ci-name {
  flex: 1;
  min-width: 140px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border, #2a2a2a);
  color: var(--text-primary, #fff);
  font-size: 0.85rem;
  padding: 3px 4px;
  outline: none;
}
.ci-name:focus { border-bottom-color: var(--primary, #daa520); }

.ci-name-static {
  flex: 1;
  min-width: 140px;
  font-size: 0.85rem;
  color: var(--text-secondary, #bbb);
  padding: 3px 4px;
}

.ci-fields {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.ci-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.ci-field label {
  font-size: 0.65rem;
  color: var(--text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ci-field-input {
  display: flex;
  align-items: center;
  gap: 3px;
}

.ci-field.editable .ci-field-input {
  background: var(--bg-primary, #111);
  border: 1px solid var(--primary, #daa520);
  border-radius: 5px;
  padding: 2px 6px;
}

.ci-field.formula .ci-formula-val {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted, #aaa);
  padding: 2px 6px;
  background: rgba(255,255,255,0.03);
  border-radius: 5px;
  border: 1px solid var(--border, #1e1e1e);
  min-width: 70px;
  text-align: right;
}

.ci-prefix {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  white-space: nowrap;
}

.ci-input {
  width: 80px;
  background: transparent;
  border: none;
  color: var(--text-primary, #fff);
  font-size: 0.85rem;
  font-weight: 600;
  text-align: right;
  padding: 1px 2px;
  outline: none;
}
.ci-input-sm { width: 44px; }

.costos-seccion-total {
  margin-top: 0.6rem;
  font-size: 0.78rem;
  color: var(--text-muted, #888);
  padding-left: 1.25rem;
}
.costos-seccion-total strong { color: var(--text-primary, #fff); }
.costos-sep { margin: 0 0.4rem; }

/* Barra de totales integrada */
.costos-total-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding: 0.85rem 1.25rem;
  background: var(--bg-primary, #111);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 8px;
}

.costos-total-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cti-label {
  font-size: 0.65rem;
  color: var(--text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.cti-val {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary, #ccc);
}

.costos-total-item.accent .cti-label { color: var(--primary, #daa520); }
.costos-total-item.accent .cti-val { font-size: 1rem; color: var(--primary, #daa520); }

.cti-op {
  font-size: 1rem;
  color: var(--text-muted, #555);
  font-weight: 300;
  align-self: flex-end;
  padding-bottom: 2px;
}

.precios-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.btn-add-row {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  color: var(--primary, #daa520);
  background: transparent;
  border: 1px solid var(--primary, #daa520);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-add-row:hover { background: rgba(218,165,32,0.12); }

.btn-del-row {
  background: transparent;
  border: none;
  color: var(--text-muted, #666);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
}
.btn-del-row:hover { color: #f44336; }

.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  flex-shrink: 0;
  vertical-align: middle;
}

/* ── GRUPOS VIÑETA ────────────────────────────────────────────── */
.grupo-vineta {
  margin-bottom: 0.5rem;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 8px;
  overflow: hidden;
}

.grupo-vineta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: rgba(218, 165, 32, 0.05);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.grupo-vineta-header:hover { background: rgba(218, 165, 32, 0.1); }

.grupo-vineta-bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary, #daa520);
  flex-shrink: 0;
}

.grupo-vineta-nombre {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary, #daa520);
}

.grupo-count {
  font-size: 0.72rem;
  color: var(--text-muted, #888);
}

.grupo-subtotales {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  margin-left: 0.25rem;
}
.gsep { color: var(--border, #444); }

.grupo-vineta-body {
  padding: 0.25rem 0 0.5rem;
  border-top: 1px solid var(--border, #2a2a2a);
}

.grupo-empty {
  padding: 0.6rem 0.5rem;
  font-size: 0.78rem;
  color: var(--text-muted, #666);
  display: flex;
  align-items: center;
}

/* ── TABLA DE PROCEDIMIENTOS — una fila por procedimiento ────── */
.proc-table-wrap {
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 0.25rem;
  /* Contiene la tabla wide sin romper el layout padre */
  display: block;
  width: 100%;
}

.proc-table-hdr,
.proc-row {
  display: grid;
  grid-template-columns:
    1fr     /* SKU + Nombre (flexible) */
    82px    /* P.Orig */
    62px    /* Desc% */
    82px    /* P.Final */
    62px    /* Duración */
    62px    /* T.Prep */
    62px    /* T.Total */
    82px    /* C.Insumo */
    82px    /* C.HH */
    82px    /* C.Total */
    82px    /* IGV */
    82px    /* Utilidad */
    64px    /* Margen% */
    54px    /* WPP */
    68px;   /* Actions */
  min-width: 1080px;
  align-items: center;
  column-gap: 0.2rem;
}

.proc-table-hdr {
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border, #2a2a2a);
}
.proc-table-hdr .ptc {
  font-size: 0.59rem;
  color: var(--text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  white-space: nowrap;
}
.ptc-formula { font-style: italic; color: var(--text-muted, #777) !important; }

.proc-row {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.1s;
}
.proc-row:last-of-type { border-bottom: none; }
.proc-row:hover { background: rgba(255,255,255,0.025); }
.proc-row--editing { background: rgba(218,165,32,0.045); }

.ptc {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
}
.ptc-id-name {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}

.proc-row-name {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proc-sku-tag {
  font-size: 0.67rem;
  font-weight: 700;
  color: var(--text-muted, #888);
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 3px;
  padding: 1px 4px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ci-input-xs {
  width: 52px !important;
  font-size: 0.76rem !important;
  padding: 1px 4px !important;
}

.pr-negative { color: #f44336; }

.proc-wpp-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 5px;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted, #666);
}
.wpp-active {
  background: rgba(76,175,80,0.12);
  border-color: rgba(76,175,80,0.4);
  color: #4caf50;
}

/* ── TARJETA DE PROCEDIMIENTO (legacy — ya no usada) ─────────── */
.proc-card {
  margin: 0.4rem 0;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border, #1e1e1e);
  border-radius: 7px;
  background: var(--bg-primary, #111);
  transition: border-color 0.15s;
}
.proc-card:hover { border-color: rgba(218,165,32,0.3); }
.proc-card--editing { border-color: var(--primary, #daa520); background: rgba(218,165,32,0.04); }

.proc-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.proc-vineta {
  color: var(--primary, #daa520);
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

.proc-color-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.proc-sku {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted, #888);
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 3px;
  padding: 1px 5px;
  letter-spacing: 0.04em;
}

.proc-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proc-card-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.btn-proc-edit {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: var(--text-muted, #888);
  background: transparent;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-proc-edit:hover { color: var(--primary, #daa520); border-color: var(--primary, #daa520); }

.btn-proc-save {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: #fff;
  background: var(--primary, #daa520);
  border: 1px solid var(--primary, #daa520);
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  font-weight: 600;
}
.btn-proc-save:hover { background: #c8921c; }

.btn-proc-cancel {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  color: var(--text-muted, #888);
  background: transparent;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
}
.btn-proc-cancel:hover { color: #f44336; border-color: #f44336; }

/* Fila de variables */
.proc-card-vars {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.4rem 0;
  border-top: 1px solid var(--border, #1a1a1a);
  border-bottom: 1px solid var(--border, #1a1a1a);
}

.proc-var {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pv-label {
  font-size: 0.62rem;
  color: var(--text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.pv-val {
  font-size: 0.85rem;
  font-weight: 600;
}

.pv-editable {
  color: var(--text-primary, #fff);
  border-bottom: 1px dashed rgba(218,165,32,0.5);
  padding-bottom: 1px;
}

.pv-formula {
  color: var(--text-muted, #aaa);
}

.pv-input-wrap {
  display: flex;
  align-items: center;
  gap: 3px;
  background: var(--bg-primary, #0d0d0d);
  border: 1px solid var(--primary, #daa520);
  border-radius: 4px;
  padding: 2px 6px;
}

.pv-sep {
  color: var(--text-muted, #555);
  font-size: 0.8rem;
  align-self: flex-end;
  padding-bottom: 2px;
}

.pv-sep--lg {
  font-size: 1rem;
  color: var(--border, #333);
  margin: 0 0.15rem;
}

/* Fila de resultados */
.proc-card-results {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.4rem;
}

.pr-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.pr-label {
  font-size: 0.68rem;
  color: var(--text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pr-val {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary, #bbb);
}
.pr-positive { color: #4caf50; }

.pr-sep {
  color: var(--border, #333);
  font-size: 0.75rem;
}

/* Subtotal de grupo */
.grupo-subtotal-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  padding: 0.45rem 0.75rem;
  background: rgba(218,165,32,0.05);
  border: 1px solid rgba(218,165,32,0.2);
  border-radius: 6px;
  font-size: 0.78rem;
  color: var(--text-muted, #888);
}
.gsb-label {
  font-weight: 700;
  color: var(--primary, #daa520);
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.05em;
}

.grupo-total-general {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--bg-primary, #111);
  border: 1px solid var(--primary, #daa520);
  border-radius: 8px;
  font-size: 0.82rem;
}
.grupo-total-general span:first-child {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--primary, #daa520);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.color-picker-input {
  width: 28px;
  height: 22px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.cell-text {
  width: 100%;
  min-width: 90px;
  text-align: left !important;
}

.precios-section {
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  min-width: 0;
}

.precios-section-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #888);
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
}

.precios-params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.param-card {
  border-radius: 8px;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border, #2a2a2a);
}

.param-card label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  margin-bottom: 0.4rem;
}

.param-card.editable {
  background: var(--bg-primary, #111);
  border-color: var(--primary, #daa520);
}

.param-card.formula {
  background: rgba(255, 255, 255, 0.03);
  cursor: not-allowed;
}

.param-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.param-prefix, .param-suffix {
  font-size: 0.8rem;
  color: var(--text-muted, #888);
  white-space: nowrap;
}

.param-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--primary, #daa520);
  color: var(--text-primary, #fff);
  font-size: 1rem;
  font-weight: 600;
  padding: 2px 4px;
  outline: none;
  min-width: 0;
}

.param-input:focus {
  border-bottom-color: #f0c040;
}

.param-formula-val {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  display: flex;
  align-items: center;
  gap: 4px;
}

.formula-badge {
  display: block;
  font-size: 0.68rem;
  color: var(--text-muted, #666);
  font-style: italic;
  margin-top: 3px;
}

/* Tabla de servicios */
.precios-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.precios-table th {
  padding: 0.5rem 0.75rem;
  text-align: right;
  font-weight: 600;
  font-size: 0.72rem;
  color: var(--text-muted, #888);
  border-bottom: 1px solid var(--border, #2a2a2a);
  background: var(--bg-tertiary, #0d0d0d);
  white-space: nowrap;
}

.precios-table th:first-child { text-align: left; }

.precios-table td {
  padding: 0.45rem 0.75rem;
  text-align: right;
  border-bottom: 1px solid var(--border, #1e1e1e);
  vertical-align: middle;
}

.col-edit { background: rgba(218, 165, 32, 0.06); }
.col-formula { background: rgba(255, 255, 255, 0.02); color: var(--text-muted, #aaa); }

.servicio-nombre {
  text-align: left !important;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.cell-input {
  width: 72px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--primary, #daa520);
  color: var(--text-primary, #fff);
  font-size: 0.82rem;
  text-align: right;
  padding: 2px 4px;
  outline: none;
}

.cell-input:focus { border-bottom-color: #f0c040; }

.cell-formula {
  color: var(--text-secondary, #bbb);
  font-size: 0.82rem;
}

.pct-high { color: #4caf50 !important; font-weight: 600; }

.totales-row td {
  border-top: 2px solid var(--border, #2a2a2a);
  background: var(--bg-tertiary, #0d0d0d);
  font-size: 0.85rem;
}

/* Grid resultados */
.precios-results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 768px) {
  .precios-results-grid { grid-template-columns: 1fr; }
}

/* Estado de resultados */
.resultado-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.resultado-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.resultado-row.sub { color: var(--text-muted, #888); font-size: 0.8rem; padding-left: 1.5rem; }
.resultado-row.subtotal { border-top: 1px solid var(--border, #2a2a2a); padding-top: 0.6rem; font-weight: 600; }
.resultado-row.total { background: var(--bg-primary, #111); font-weight: 700; font-size: 0.95rem; margin-top: 0.25rem; }
.resultado-row.margen-neto { font-size: 0.8rem; color: var(--text-muted, #888); }
.resultado-row.utilidad-positiva { border-left: 3px solid #4caf50; }
.resultado-row.utilidad-negativa { border-left: 3px solid #f44336; }

.resultado-val { font-weight: 600; }
.resultado-val.positive { color: #4caf50; }
.resultado-val.negative { color: var(--text-muted, #888); }

/* Punto de equilibrio */
.equilibrio-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.equilibrio-item {
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  background: var(--bg-primary, #111);
  border: 1px solid var(--border, #1e1e1e);
}

.equilibrio-item.highlight {
  border-color: var(--primary, #daa520);
  background: rgba(218, 165, 32, 0.06);
}

.equilibrio-label {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
  margin-bottom: 2px;
}

.equilibrio-val {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
}

.equilibrio-val.accent { color: var(--primary, #daa520); }

.equilibrio-formula {
  font-size: 0.68rem;
  color: var(--text-muted, #666);
  font-style: italic;
  margin-top: 2px;
}

/* =============================================
   META ADS VIEW
   ============================================= */

.meta-logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1877F2 0%, #0d5fd8 100%);
  box-shadow: 0 4px 12px rgba(24, 119, 242, 0.4);
  flex-shrink: 0;
}

.meta-month-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}

.meta-month-tab {
  padding: 7px 18px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--text-muted, #888);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.04em;
}

.meta-month-tab:hover {
  border-color: rgba(24,119,242,0.4);
  background: rgba(24,119,242,0.08);
  color: #1877F2;
}

.meta-month-tab.active {
  border-color: #1877F2;
  background: rgba(24,119,242,0.15);
  color: #1877F2;
  font-weight: 600;
}

.meta-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.meta-kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--card-bg, rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.meta-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  border-color: color-mix(in srgb, var(--kpi-color) 30%, transparent);
}

.meta-kpi-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  flex-shrink: 0;
}

.meta-kpi-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.meta-kpi-label {
  font-size: 0.73rem;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.meta-kpi-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  line-height: 1.2;
}

.meta-kpi-sub {
  font-size: 0.72rem;
  color: var(--text-muted, #777);
}

.meta-split-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 24px;
}

.meta-split-card {
  padding: 18px 20px;
  border-radius: 14px;
  background: var(--card-bg, rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-split-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.meta-split-stats {
  display: flex;
  gap: 20px;
}

.meta-split-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-split-item span {
  font-size: 0.72rem;
  color: var(--text-muted, #888);
}

.meta-split-item strong {
  font-size: 0.95rem;
  color: var(--text-primary, #fff);
  font-weight: 600;
}

.meta-split-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  height: 8px;
  overflow: hidden;
  position: relative;
}

.meta-split-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease;
}

.meta-split-pct {
  position: absolute;
  right: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
}

.meta-campaigns-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.meta-table-block {
  background: var(--card-bg, rgba(255,255,255,0.03));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
}

.meta-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.meta-table-wrap {
  overflow-x: auto;
}

.meta-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.meta-table thead tr th {
  padding: 10px 14px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #777);
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}

.meta-table-row td {
  padding: 10px 14px;
  color: var(--text-primary, #eee);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  white-space: nowrap;
}

.meta-table-row:last-child td {
  border-bottom: none;
}

.meta-table-row:hover td {
  background: rgba(255,255,255,0.03);
}

.meta-nombre-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-num-cell {
  text-align: right;
}

.meta-date-cell {
  font-size: 0.78rem;
  color: var(--text-muted, #888);
}

.meta-estado-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.meta-estado-badge.activo {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.meta-estado-badge.desactivado {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.meta-estado-badge.pausado {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.meta-tipo-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.meta-tipo-badge.sin-sale {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.meta-tipo-badge.sale {
  background: rgba(218, 165, 32, 0.15);
  color: #daa520;
  border: 1px solid rgba(218, 165, 32, 0.35);
}

.meta-empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 18px;
  color: var(--text-muted, #666);
  font-size: 0.83rem;
}

@media (max-width: 768px) {
  .meta-kpi-grid { grid-template-columns: 1fr 1fr; }
  .meta-split-row { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .meta-kpi-grid { grid-template-columns: 1fr; }
}
</style>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'
import { useExcelExport } from '@/composables/useExcelExport'

const { logActivity } = useActivityLogger()
const { downloadExcel } = useExcelExport()
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessHealup, dashboards } from '@/utils/permissions'
import SettingsView from '@/components/Settings/SettingsView.vue'

const formatFecha = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year} - ${hours}:${minutes}${ampm}`;
};

const formatDateAgendamiento = (dateString: string | null | undefined) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  const day = date.getDate().toString().padStart(2, '0')
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
}

definePageMeta({
  middleware: 'auth-dashboard'
})

// ...

// ... (skipping down to onMounted)



// Recuperar datos del usuario desde la cookie para mostrar el nombre real
/* ---------------- DEFINICIÓN DE TIPO ---------------- */
// Esto le enseña a TypeScript qué forma tienen tus datos
interface UserSession {
  id: string
  email: string
  full_name: string
  role: string
}

/* ---------------- LÓGICA DE SESIÓN ---------------- */
// Le decimos a useCookie que lo que guarda es de tipo UserSession o null
const userSession = useCookie<UserSession | null>('dashboard_session')

// Ahora el computed sabe exactamente qué devolver
const currentUser = computed(() => {
  return userSession.value || {
    full_name: 'Usuario Invitado',
    email: '',
    id: '',
    role: ''
  }
})

/* ---------------- Tipos ---------------- */
type Stat = {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  subtitle: string
  description: string
}
type Tab = { label: string; value: string; badge?: string }

/* ---------------- Supabase Config ---------------- */
const client = useSupabaseClient()

/* ---------------- Estado de la Tabla ---------------- */
const search = ref('')
const loading = ref(false)
const n8nLoading = ref(false)
const pacientesWpp    = ref<any[]>([])
const pacientesFbIg   = ref<any[]>([])
const pacientesTiktok = ref<any[]>([])
const compras = ref<any[]>([])
const leadsWpp     = ref<any[]>([])
const leadsFbIg    = ref<any[]>([])
const leadsTiktok  = ref<any[]>([])
const leads = computed(() => [...leadsWpp.value, ...leadsFbIg.value, ...leadsTiktok.value])
const loadingLeads = ref(false)
const leadsSearch = ref('')
const showCreateUserDialog = ref(false)
const showSettingsDialog = ref(false)

/* Headers de la tabla - ajusta según tu tabla 'contribuyentes' */
const headers = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'RUC', key: 'ruc', sortable: true },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Teléfono', key: 'telefono', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
])

/* Headers específicos para Pacientes */
const headersPacientesWpp = ref([
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: '🎫 SKU Reserva', key: 'booking_sku', sortable: false, width: '130px' },
  { title: 'Anticipo', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Saldo Pendiente', key: 'precio_tratamiento', sortable: true },
  { title: 'Fecha Agendamiento', key: 'fecha_agendamiento', sortable: true },
  { title: 'Método de pago', key: 'metodo_de_pago', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Agendado por', key: 'agendamiento', sortable: true, align: 'center' as const },
  { title: 'Actions', key: 'actions', sortable: false }
])

const headersPacientesFbIg = ref([
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Red Social', key: 'red_social', sortable: true },
  { title: '🎫 SKU Reserva', key: 'booking_sku', sortable: false, width: '130px' },
  { title: 'Anticipo', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Saldo Pendiente', key: 'precio_tratamiento', sortable: true },
  { title: 'Fecha Agendamiento', key: 'fecha_agendamiento', sortable: true },
  { title: 'Método de pago', key: 'metodo_de_pago', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Agendado por', key: 'agendamiento', sortable: true, align: 'center' as const },
  { title: 'Actions', key: 'actions', sortable: false }
])

const headersPacientesTiktok = ref([
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'TikTok', key: 'tiktok_handle', sortable: true },
  { title: '🎫 SKU Reserva', key: 'booking_sku', sortable: false, width: '130px' },
  { title: 'Anticipo', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Saldo Pendiente', key: 'precio_tratamiento', sortable: true },
  { title: 'Fecha Agendamiento', key: 'fecha_agendamiento', sortable: true },
  { title: 'Método de pago', key: 'metodo_de_pago', sortable: true },
  { title: 'Estado', key: 'estado', sortable: true },
  { title: 'Agendado por', key: 'agendamiento', sortable: true, align: 'center' as const },
  { title: 'Actions', key: 'actions', sortable: false }
])

const headersCompras = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Apellidos', key: 'apellidos', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Teléfono', key: 'numero', sortable: true },
  { title: 'Red Social', key: 'red_social', sortable: true },
  { title: 'Productos', key: 'productos_comprados', sortable: true },
  { title: 'Precio', key: 'precio', sortable: true },
  { title: 'Categoria', key: 'categoria', sortable: true },
  { title: 'Cantidad', key: 'cantidad', sortable: true },
  { title: 'Ciudad', key: 'ciudad/provincia', sortable: true },
  { title: 'Agencia', key: 'Nombre_agencia_shalom', sortable: true },
  { title: 'Dirección', key: 'direccion_exacta', sortable: true },
])

const headersLeadsWpp = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Fecha', key: 'created_at', sortable: true, width: '180px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Fuente', key: 'fuente', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Número', key: 'numero', sortable: true, width: '150px', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '35%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

const headersLeadsFbIg = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Fecha', key: 'created_at', sortable: true, width: '180px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Instagram', key: 'instagram_handle', sortable: true, width: '150px', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '35%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

const headersLeadsTiktok = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Fecha', key: 'created_at', sortable: true, width: '180px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'TikTok', key: 'tiktok_handle', sortable: true, width: '150px', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '35%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

const headersLeads = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Fecha', key: 'created_at', sortable: true, width: '180px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '35%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

/* ---------------- Fetch Data from Supabase (con $fetch nativo de Nuxt) ---------------- */
const fetchPacientesWpp = async () => {
  loading.value = true
  try {
    const { data, error } = await client
      .from('PacientesBDwppHEALUP')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error

    pacientesWpp.value = data as any[]
  } catch (error) {
    console.error('Error al cargar pacientes WhatsApp:', error)
  } finally {
    loading.value = false
  }
}

const fetchPacientesFbIg = async () => {
  loading.value = true
  try {
    const { data, error } = await client
      .from('PacientesBDfbigHEALUP')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error

    pacientesFbIg.value = data as any[]
  } catch (error) {
    console.error('Error al cargar pacientes FB/IG:', error)
  } finally {
    loading.value = false
  }
}

const fetchPacientesTiktok = async () => {
  loading.value = true
  try {
    const { data, error } = await client
      .from('PacientesBDtiktokHEALUP')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error

    pacientesTiktok.value = data as any[]
  } catch (error) {
    console.error('Error al cargar pacientes TikTok:', error)
  } finally {
    loading.value = false
  }
}

const fetchCompras = async () => {
  loading.value = true
  try {
    const { data, error } = await (client
      .from('comprasBDwppBRADA')
      .select('*') as any)
      .order('created_at', { ascending: false })

    if (error) throw error

    compras.value = data as any[]
  } catch (error) {
    console.error('Error al cargar compras:', error)
  } finally {
    loading.value = false
  }
}

const fetchLeadsWpp = async () => {
  try {
    // Paginar para obtener todos los registros (hay más de 1000)
    const PAGE = 1000
    let all: any[] = []
    let offset = 0
    while (true) {
      const { data, error } = await (client
        .from('GeneralBDwppHEALUP')
        .select('*') as any)
        .order('id', { ascending: false })
        .range(offset, offset + PAGE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < PAGE) break
      offset += PAGE
    }
    leadsWpp.value = all
  } catch (error) {
    console.error('Error loading leads WhatsApp:', error)
  }
}

const fetchLeadsFbIg = async () => {
  try {
    const { data, error } = await (client
      .from('GeneralBDfbigHEALUP')
      .select('*') as any)
      .order('id', { ascending: false })

    if (error) throw error
    leadsFbIg.value = data as any[] || []
  } catch (error) {
    console.error('Error loading leads FB/IG:', error)
  }
}

const fetchLeadsTiktok = async () => {
  try {
    const { data, error } = await (client
      .from('GeneralBDtiktokHEALUP')
      .select('*') as any)
      .order('id', { ascending: false })

    if (error) throw error
    leadsTiktok.value = data as any[] || []
  } catch (error) {
    console.error('Error loading leads TikTok:', error)
  }
}

const fetchLeads = async () => {
  loadingLeads.value = true
  await Promise.all([fetchLeadsWpp(), fetchLeadsFbIg(), fetchLeadsTiktok()])
  loadingLeads.value = false
  console.log('Total Leads Loaded:', leads.value.length)
}

const toggleN8nWorkflow = async (turnOn: boolean) => {
  if (!confirm(`¿Confirmas que deseas ${turnOn ? 'ACTIVAR' : 'DESACTIVAR'} la IA?`)) return

  n8nLoading.value = true
  try {
    const { data, error } = await useFetch('/api/n8n/toggle-workflow', {
      method: 'POST',
      body: { active: turnOn }
    })

    if (error.value) throw error.value

    alert(`Éxito: El sistema ahora está ${turnOn ? 'ACTIVO' : 'INACTIVO'}`)

  } catch (err) {
    console.error(err)
    alert('Error al comunicarse con el servidor. Revisa la consola.')
  } finally {
    n8nLoading.value = false
  }
}

/* ---------------- CRUD Operations ---------------- */
const showPatientTypeDialog = ref(false)
const showPatientFormDialog = ref(false)
const selectedPatientType = ref<'wpp' | 'fbig'>('wpp')
const editingPatient = ref<any>(null)
const patientFormRef = ref<any>(null)

const patientFormData = ref({
  nombre: '',
  dni: '',
  numero: '',
  red_social: '',
  precio: '',
  precio_tratamiento: '',
  procedimiento: '',
  procedure_id: null as number | null,
  booking_sku: '',
  fecha_agendamiento: '',
  metodo_de_pago: 'Ninguno',
  estado: 'Activo',
  agendamiento: 'IA'
})

// Precio del procedimiento seleccionado para mostrar desglose
const selectedProcedurePrice = computed(() => {
  if (!patientFormData.value.procedure_id) return null
  const proc = procedures.value.find(p => Number(p.id) === Number(patientFormData.value.procedure_id))
  if (!proc) return null
  const precio = proc.price || 0
  const descuento = proc.discount || 0
  const precioFinal = precio * (1 - descuento / 100)
  return { nombre: proc.name, sku: proc.sku || '', precioFinal: Math.round(precioFinal * 100) / 100 }
})

const openPatientTypeDialog = () => {
  showPatientTypeDialog.value = true
}

const selectPatientType = (type: 'wpp' | 'fbig') => {
  selectedPatientType.value = type
  showPatientTypeDialog.value = false
  openPatientForm(null, type)
}

// Selector unificado por red social — mapea a la tabla correcta y prefilla
// el campo red_social del form para que detectFuentePaciente lo clasifique bien.
const selectPatientSource = (source: 'whatsapp' | 'tiktok' | 'instagram' | 'facebook') => {
  showPatientTypeDialog.value = false
  // WhatsApp y TikTok viven en PacientesBDwppHEALUP; Instagram y Facebook en PacientesBDfbigHEALUP
  const tipo: 'wpp' | 'fbig' = (source === 'whatsapp' || source === 'tiktok') ? 'wpp' : 'fbig'
  selectedPatientType.value = tipo
  openPatientForm(null, tipo)
  // Prefill: para TikTok el `numero` se deja vacío (eso es lo que hace que
  // detectFuentePaciente lo clasifique como TikTok). Para FB/IG cargamos
  // la red en `red_social` para que se distinga correctamente.
  if (source === 'tiktok') {
    patientFormData.value.numero = ''
    ;(patientFormData.value as any).red_social = 'tiktok'
  } else if (source === 'instagram') {
    ;(patientFormData.value as any).red_social = 'instagram'
  } else if (source === 'facebook') {
    ;(patientFormData.value as any).red_social = 'facebook'
  }
}

// ──────────────────────────────────────────────────────────────────
// Historia clínica + visitas (multi-procedimiento) por paciente
// ──────────────────────────────────────────────────────────────────
const showHistoriaPacienteDialog = ref(false)
const historiaPacienteSel = ref<any>(null)
const historiaPacienteVisitas = ref<any[]>([])
const loadingHistoriaPaciente = ref(false)
const nuevaVisita = ref<{
  fecha: string
  cabina: string
  procedimientos: Array<{ procedure_id: any; nombre_libre: string; precio: number; notas: string }>
  notas_visita: string
}>({
  fecha: '', cabina: 'cabina1',
  procedimientos: [{ procedure_id: null, nombre_libre: '', precio: 0, notas: '' }],
  notas_visita: ''
})
const guardandoVisita = ref(false)

const openHistoriaClinicaDePaciente = async (paciente: any, _origen: 'wpp' | 'fbig') => {
  historiaPacienteSel.value = paciente
  showHistoriaPacienteDialog.value = true
  loadingHistoriaPaciente.value = true
  // Buscar todas las visitas / entries de historia clínica de este paciente
  // Match por DNI (preferido) o nombre completo
  try {
    const filterDni = paciente.dni ? `dni.eq.${paciente.dni}` : null
    const filterName = paciente.nombre ? `name.ilike.%${paciente.nombre.split(' ')[0]}%` : null
    const filters = [filterDni, filterName].filter(Boolean).join(',')
    const { data } = await (client.from('healup_medical_history') as any)
      .select('*')
      .or(filters || 'id.gte.0')
      .order('dateAdded', { ascending: false })
    historiaPacienteVisitas.value = data || []
  } catch (err) {
    console.warn('[historia] error:', err)
    historiaPacienteVisitas.value = []
  } finally {
    loadingHistoriaPaciente.value = false
  }
  // Reset form
  const today = new Date()
  nuevaVisita.value = {
    fecha: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
    cabina: 'cabina1',
    procedimientos: [{ procedure_id: null, nombre_libre: '', precio: 0, notas: '' }],
    notas_visita: ''
  }
}

const closeHistoriaPacienteDialog = () => {
  showHistoriaPacienteDialog.value = false
  historiaPacienteSel.value = null
  historiaPacienteVisitas.value = []
}

const agregarProcedimientoVisita = () => {
  nuevaVisita.value.procedimientos.push({ procedure_id: null, nombre_libre: '', precio: 0, notas: '' })
}
const eliminarProcedimientoVisita = (i: number) => {
  if (nuevaVisita.value.procedimientos.length > 1) nuevaVisita.value.procedimientos.splice(i, 1)
}

const totalVisita = computed(() =>
  nuevaVisita.value.procedimientos.reduce((s, p) => s + (Number(p.precio) || 0), 0)
)

const guardarVisita = async () => {
  if (!historiaPacienteSel.value) return
  if (!nuevaVisita.value.procedimientos.some(p => p.nombre_libre || p.procedure_id)) {
    alert('Agregá al menos un procedimiento con nombre.')
    return
  }
  guardandoVisita.value = true
  try {
    const p = historiaPacienteSel.value
    // Construir el campo "procedimiento" agrupando todos los items separados por '+'
    const procsText = nuevaVisita.value.procedimientos
      .map(it => {
        const cat = it.procedure_id ? procedures.value.find((x:any)=>String(x.id)===String(it.procedure_id))?.name : null
        const name = cat || it.nombre_libre || ''
        const precio = Number(it.precio) || 0
        return precio > 0 ? `${name} (S/${precio})` : name
      })
      .filter(Boolean)
      .join(' + ')
    const totalProcs = totalVisita.value
    const notasFull = [
      `Visita ${nuevaVisita.value.fecha}`,
      `Cabina: ${nuevaVisita.value.cabina}`,
      `Total: S/ ${totalProcs.toFixed(2)}`,
      nuevaVisita.value.notas_visita ? `Notas: ${nuevaVisita.value.notas_visita}` : null,
    ].filter(Boolean).join(' · ')
    const payload: any = {
      name: p.nombre || '',
      surname: '',
      dni: p.dni || null,
      phone: p.numero || null,
      email: '',
      dateAdded: nuevaVisita.value.fecha,
      returnNote: notasFull,
      status: 'Activo',
      procedimientos_visita: procsText,
      total_visita: totalProcs,
    }
    // Try-then-retry: si las columnas extendidas no existen, retry con base
    let r = await (client.from('healup_medical_history') as any).insert(payload)
    if (r.error) {
      delete payload.procedimientos_visita
      delete payload.total_visita
      r = await (client.from('healup_medical_history') as any).insert(payload)
    }
    if (r.error) {
      alert(`Error: ${r.error.message}`)
    } else {
      // Refrescar
      await openHistoriaClinicaDePaciente(p, 'wpp')
    }
  } finally {
    guardandoVisita.value = false
  }
}

const openPatientForm = (item: any | null, type: 'wpp' | 'fbig' | 'tiktok') => {
  selectedPatientType.value = type
  editingPatient.value = item

  if (item) {
    // Edit mode: copy data
    // Logic: Database stores "Remaining Balance" in precio_tratamiento.
    // User expects to see "Total Price". So we add back the reservation amount.
    const savedPrecio = parseCurrency(item.precio || '0')
    const savedTratamiento = parseCurrency(item.precio_tratamiento || '0')
    const totalTratamiento = savedTratamiento + savedPrecio

    patientFormData.value = {
      nombre: item.nombre || '',
      dni: item.dni || '',
      numero: item.numero || '',
      red_social: item.red_social || '',
      precio: item.precio || '',
      precio_tratamiento: totalTratamiento.toString(), // Show Total to user
      procedimiento: item.procedimiento || '',
      procedure_id: item.procedure_id ? Number(item.procedure_id) : null,
      booking_sku: item.booking_sku || '',
      fecha_agendamiento: item.fecha_agendamiento ? new Date(item.fecha_agendamiento).toISOString().slice(0, 16) : '',
      metodo_de_pago: item.metodo_de_pago || 'Ninguno',
      estado: item.estado || 'Activo',
      agendamiento: item.agendamiento || 'IA'
    }
  } else {
    // Create mode: reset data
    patientFormData.value = {
      nombre: '',
      dni: '',
      numero: '',
      red_social: '',
      precio: '',
      precio_tratamiento: '',
      procedimiento: '',
      procedure_id: null,
      booking_sku: '',
      fecha_agendamiento: new Date().toISOString().slice(0, 16),
      metodo_de_pago: 'Ninguno',
      estado: 'Activo',
      agendamiento: 'IA'
    }
  }
  showPatientFormDialog.value = true
}

const closePatientForm = () => {
  showPatientFormDialog.value = false
  editingPatient.value = null
}

const savePatient = async () => {
  // Validate
  if (!patientFormData.value.nombre || !patientFormData.value.dni || !patientFormData.value.numero) {
    alert('Por favor complete los campos obligatorios (Nombre, DNI, Número)')
    return
  }

  loading.value = true
  try {
    const tableName = selectedPatientType.value === 'wpp' ? 'PacientesBDwppHEALUP' : 'PacientesBDfbigHEALUP'

    // Format date for Supabase (timestamptz)
    let formattedDate = null
    if (patientFormData.value.fecha_agendamiento) {
      formattedDate = new Date(patientFormData.value.fecha_agendamiento).toISOString()
    }

    // Logic: User inputs Total Price. Database stores Remaining Balance.
    const inputReserva = parseCurrency(patientFormData.value.precio)
    const inputTotalTratamiento = parseCurrency(patientFormData.value.precio_tratamiento)

    // Automatic subtraction if reservation > 0
    let finalPrecioTratamiento = inputTotalTratamiento
    if (inputReserva > 0) {
      finalPrecioTratamiento = inputTotalTratamiento - inputReserva
    }

    // Generar booking SKU si hay anticipo y es un registro nuevo sin SKU previo
    let bookingSku = patientFormData.value.booking_sku || ''
    if (inputReserva > 0 && !bookingSku) {
      try {
        const { data: skuData, error: skuError } = await (client.rpc as any)('healup_next_booking_sku')
        if (!skuError && skuData) bookingSku = skuData
      } catch { /* SKU opcional, no bloqueante */ }
    }

    const commonPayload: Record<string, any> = {
      nombre: patientFormData.value.nombre,
      dni: patientFormData.value.dni,
      numero: patientFormData.value.numero,
      precio: inputReserva,                        // anticipo / reserva
      precio_tratamiento: finalPrecioTratamiento,  // saldo pendiente
      procedimiento: patientFormData.value.procedimiento,
      procedure_id: patientFormData.value.procedure_id || null,
      fecha_agendamiento: formattedDate,
      estado: patientFormData.value.estado,
      agendamiento: patientFormData.value.agendamiento,
      metodo_de_pago: patientFormData.value.metodo_de_pago,
      ...(bookingSku ? { booking_sku: bookingSku } : {}),
    }

    if (selectedPatientType.value === 'wpp') {
      const payload = commonPayload
      if (editingPatient.value) {
        const { error } = await (client.from('PacientesBDwppHEALUP') as any).update(payload).eq('id', editingPatient.value.id)
        if (error) throw error
      } else {
        const { error } = await client.from('PacientesBDwppHEALUP').insert(payload as any)
        if (error) throw error
      }
    } else if (selectedPatientType.value === 'tiktok') {
      const payload = { ...commonPayload, tiktok_handle: (patientFormData.value as any).tiktok_handle || '' }
      if (editingPatient.value) {
        const { error } = await (client.from('PacientesBDtiktokHEALUP') as any).update(payload).eq('id', editingPatient.value.id)
        if (error) throw error
      } else {
        const { error } = await client.from('PacientesBDtiktokHEALUP').insert(payload as any)
        if (error) throw error
      }
    } else {
      const payload = { ...commonPayload, red_social: patientFormData.value.red_social }
      if (editingPatient.value) {
        const { error } = await (client.from('PacientesBDfbigHEALUP') as any).update(payload).eq('id', editingPatient.value.id)
        if (error) throw error
      } else {
        const { error } = await client.from('PacientesBDfbigHEALUP').insert(payload as any)
        if (error) throw error
      }
    }

    // Refresh data
    if (selectedPatientType.value === 'wpp') await fetchPacientesWpp()
    else if (selectedPatientType.value === 'tiktok') await fetchPacientesTiktok()
    else await fetchPacientesFbIg()

    // Automatic Medical History Creation for NEW patients
    if (!editingPatient.value) {
      try {
        const fullName = patientFormData.value.nombre.trim()
        const firstSpaceIndex = fullName.indexOf(' ')
        let name = fullName
        let surname = ''

        if (firstSpaceIndex > 0) {
          name = fullName.substring(0, firstSpaceIndex)
          surname = fullName.substring(firstSpaceIndex + 1)
        }

        const historyPayload = {
          name: name,
          surname: surname,
          dni: patientFormData.value.dni,
          phone: patientFormData.value.numero,
          email: '',
          date_added: new Date().toISOString().slice(0, 10),
          attachment_name: '',
          attachment_data: ''
        }

        const { error: historyError } = await (client
          .from('healup_medical_history') as any)
          .insert(historyPayload)

        if (historyError) {
          console.error('Error creating automatic medical history:', historyError)
        } else {
          if (activeView.value === 'historialClinico') {
            await fetchMedicalHistory()
          }
        }
      } catch (err) {
        console.error('Error in automatic history creation logic:', err)
      }

    } else {
      // UPDATE Medical History logic for EDITED patients
      try {
        const oldDni = editingPatient.value.dni
        const fullName = patientFormData.value.nombre.trim()
        const firstSpaceIndex = fullName.indexOf(' ')
        let name = fullName
        let surname = ''

        if (firstSpaceIndex > 0) {
          name = fullName.substring(0, firstSpaceIndex)
          surname = fullName.substring(firstSpaceIndex + 1)
        }

        const historyPayload = {
          name: name,
          surname: surname,
          dni: patientFormData.value.dni, // Update to new DNI
          phone: patientFormData.value.numero
        }

        // 1. Try to UPDATE existing records matching the old DNI
        const { data: updatedData, error: historyUpdateError } = await (client
          .from('healup_medical_history') as any)
          .update(historyPayload)
          .eq('dni', oldDni)
          .select()

        if (historyUpdateError) {
          console.error('Error syncing medical history:', historyUpdateError)
        } else {
          // 2. If NO records were updated, it means it doesn't exist. create it.
          if (!updatedData || updatedData.length === 0) {
            console.log('No medical history found for DNI:', oldDni, '. Creating new record...')

            const newHistoryPayload = {
              ...historyPayload,
              email: '',
              date_added: new Date().toISOString().slice(0, 10),
              attachment_name: '',
              attachment_data: ''
            }

            const { error: insertError } = await (client
              .from('healup_medical_history') as any)
              .insert(newHistoryPayload)

            if (insertError) {
              console.error('Error creating medical history on patient edit:', insertError)
            } else {
              console.log('Created new medical history for:', name)
            }
          } else {
            console.log('Synced medical history for DNI:', oldDni)
          }

          if (activeView.value === 'historialClinico') {
            await fetchMedicalHistory()
          }
        }
      } catch (err) {
        console.error('Error in sync history logic:', err)
      }
    }

    closePatientForm()
  } catch (error) {
    console.error('Error saving patient:', error)
    alert('Error al guardar el paciente. Verifique la consola para más detalles.')
  } finally {
    loading.value = false
  }
}

const deletePatient = async (item: any, type: 'wpp' | 'fbig' | 'tiktok') => {
  if (!confirm(`¿Estás seguro de que deseas eliminar a ${item.nombre}?`)) return

  loading.value = true
  try {
    const tableName = type === 'wpp' ? 'PacientesBDwppHEALUP'
      : type === 'tiktok' ? 'PacientesBDtiktokHEALUP'
      : 'PacientesBDfbigHEALUP'

    const { error } = await (client
      .from(tableName)
      .delete() as any)
      .eq('id', item.id)

    if (error) throw error

    if (type === 'wpp') await fetchPacientesWpp()
    else if (type === 'tiktok') await fetchPacientesTiktok()
    else await fetchPacientesFbIg()
  } catch (error) {
    console.error('Error deleting patient:', error)
    alert('Error al eliminar el paciente.')
  } finally {
    loading.value = false
  }
}

/* ---------------- Estado General ---------------- */
const activeView = ref('dashboard')
const facturacionTab = ref('cobro_atencion')

/* ---------------- Boletas Pendientes ---------------- */
const boletasPendientes = ref<any[]>([])
const loadingPendientes = ref(false)
const loadingEmision = ref(false)
const emisionResultado = ref<any>(null)

const boletasPendientesCount = computed(() => boletasPendientes.value.length)
const boletasPendientesTotal = computed(() => boletasPendientes.value.reduce((s, b) => s + Number(b.total || 0), 0))

async function fetchBoletasPendientes() {
  loadingPendientes.value = true
  try {
    const supabase = useSupabaseClient()
    const { data } = await supabase
      .from('comprobantes_pse')
      .select('id, serie, numero, fecha_de_emision, cliente_denominacion, total')
      .eq('company_id', 'healup')
      .eq('estado', 'pendiente')
      .order('numero', { ascending: true })
    boletasPendientes.value = data || []
  } finally {
    loadingPendientes.value = false
  }
}

async function emitirTodasPendientes() {
  if (boletasPendientes.value.length === 0) return
  loadingEmision.value = true
  emisionResultado.value = null
  try {
    const resultado = await $fetch('/api/pse/emitir', {
      method: 'POST',
      body: { todos: true, company_id: 'healup' }
    })
    emisionResultado.value = resultado
    await fetchBoletasPendientes()
  } catch (e: any) {
    emisionResultado.value = { exitosos: 0, fallidos: boletasPendientes.value.length, resultados: [], error: e?.message }
  } finally {
    loadingEmision.value = false
  }
}

watch(facturacionTab, (tab) => {
  if (tab === 'boletas_pendientes') fetchBoletasPendientes()
})

// ── Boleteo automático (agente IA) ────────────────────────────────────────────
const boleteoActivo        = ref(false)   // default OFF hasta que se active manualmente
const loadingBoleteoToggle = ref(false)

const fetchBoleteoStatus = async () => {
  try {
    const data = await $fetch<{ activo: boolean }>('/api/healup/boleteo')
    boleteoActivo.value = data.activo
  } catch { boleteoActivo.value = false }
}

const toggleBoleteo = async (nuevoValor: boolean) => {
  loadingBoleteoToggle.value = true
  try {
    const data = await $fetch<{ activo: boolean }>('/api/healup/boleteo', {
      method: 'POST',
      body: { activo: nuevoValor }
    })
    boleteoActivo.value = data.activo
  } catch (e) {
    console.error('Error cambiando boleteo:', e)
    boleteoActivo.value = !nuevoValor
  } finally {
    loadingBoleteoToggle.value = false
  }
}
const showUserMenu = ref(false)
const showDashboardMenu = ref(false)

/* ---------------- Tema ---------------- */
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)
const toggleTheme = () => {
  vuetifyTheme.global.name.value = isDark.value ? 'light' : 'dark'
}

function applyTheme() {
  nextTick(() => {
    if (import.meta.server) return
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



function logout() {
  logActivity('Cerró sesión')
  // 1. Borrar la cookie que mantiene la sesión abierta
  const session = useCookie('dashboard_session')
  session.value = null

  // 2. Redirigir al usuario a la pantalla de login (index.vue)
  return navigateTo('/')
}

/* ---------------- Menús ---------------- */
/* ---------------- Menús ---------------- */
const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'mdi-calendar-blank', label: 'Calendario', id: 'calendario' },
  { icon: 'mdi-account-group', label: 'Pacientes', id: 'pacientes' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' }
]

const chatItems = [
  { icon: 'mdi-message-reply', label: 'Conversaciones', id: 'conversaciones', url: 'https://chats.alef.company/app/accounts/2/dashboard' }
]

function handleNavigation(item: any) {
  if (item.url) {
    if (import.meta.client) {
      window.open(item.url, '_blank')
    }
  } else {
    activeView.value = item.id
  }
}

const financiasItems = [
  // Vista de KPIs/gráficos financieros (header "Contabilidad" en la vista)
  { icon: 'mdi-currency-usd',          label: 'Contabilidad',         id: 'facturacion' },
  // Vista con tabs Cobro Atención / GCal / Factura Electrónica / Catálogo
  { icon: 'mdi-receipt-text',          label: 'Facturación',          id: 'contabilidad' },
  // Egresos: vista dedicada (viejo sidebar item, restaurado)
  { icon: 'mdi-cash-minus',            label: 'Egresos',              id: 'egresos' },
  // Gastos variables adicionales: vista nueva dedicada
  { icon: 'mdi-bullhorn-outline',      label: 'Gastos Variables',     id: 'gastos_variables' },
  { icon: 'mdi-calculator-variant',    label: 'Estructura de Precios', id: 'precios' },
  { icon: 'mdi-finance',               label: 'Cierre mensual',       id: 'cierre_mensual' },
  { icon: 'mdi-bank-check',            label: 'Reconciliación caja',  id: 'reconciliacion' }
]

// ── ESTRUCTURA DE PRECIOS Y PUNTO DE EQUILIBRIO ──────────────────────────────

// Parámetros base (gastos fijos excluyendo salarios)
const preciosParams = reactive({
  otrosCostosFijosMes: 3975,   // alquiler, servicios, equipos (sin salarios)
  diasLaborables: 26,
})

// Operadoras (lista editable)
const operadoras = reactive([
  { nombre: 'Operario 1', salario: 1800, horas: 180 }
])

function agregarOperadora() {
  operadoras.push({ nombre: `Operario ${operadoras.length + 1}`, salario: 1800, horas: 180 })
}
function eliminarOperadora(i: number) {
  if (operadoras.length > 1) operadoras.splice(i, 1)
}

// Gastos variables adicionales (publicidad, marketing, etc.)
const gastosVarExtra = reactive([
  { nombre: 'Publicidad',           monto: 0 },
  { nombre: 'Gestión de Marketing', monto: 0 },
  { nombre: 'Otros',                monto: 0 },
])

function agregarGastoVar() {
  gastosVarExtra.push({ nombre: 'Nuevo gasto', monto: 0 })
}
function eliminarGastoVar(i: number) {
  gastosVarExtra.splice(i, 1)
}

// ──────────────────────────────────────────────────────────────────
// ALEF — Comisión por conversión del mes (gasto variable automático)
// Regla operativa de la clínica:
//   Si la paciente reservó con S/ 50 (cabina 1, medicina estética
//   con doctora) → comisión ALEF = S/ 20.
//   Si la paciente reservó con S/ 20 (cabina 2, no invasivos /
//   skin cares / HIFU / corporal) → comisión ALEF = S/ 10.
// Cuenta TODAS las conversiones del mes (created_at), no solo IA.
// EXCLUYE post-procedimientos (retiros, controles, follow-ups) que
// no son conversiones nuevas.
// ──────────────────────────────────────────────────────────────────
const ALEF_COMISION_BAJA = 10  // si reserva fue S/20
const ALEF_COMISION_ALTA = 20  // si reserva fue S/50

// Grupos del catálogo que pertenecen a Cabina 2 (S/20 reserva → ALEF S/10)
const ALEF_GRUPOS_CABINA_2 = new Set([
  'FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D',
  'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION',
  'CARBOXITERAPIA', 'LIPO PAPADA ENZIMÁTICO'
])

// Keywords en texto libre que indican Cabina 2
const ALEF_KEYS_CABINA_2 = [
  'glass skin','prime skin','calm babe','eternal glow','pure babe','prestige glow',
  'skin care','limpieza facial','exfoli','hifu','lipopapada','carboxi',
  'corporal','reduccion','reducción','glúteo','gluteo','reafirma'
]

// Keywords que indican post-procedimiento (NO cuenta como conversión)
const ALEF_KEYS_EXCLUIR = ['retiro','control','follow','seguimiento','revisión','revision']

const alefClasificarPaciente = (p: any): 'CABINA_1' | 'CABINA_2' | 'EXCLUIDO' => {
  const txt = String(p?.procedimiento || '').toLowerCase().trim()

  // 1) Excluir post-procedimientos
  if (ALEF_KEYS_EXCLUIR.some(k => txt.includes(k))) return 'EXCLUIDO'

  // 2) Detectar cabina vía procedure_id (preferido)
  const pid = p?.procedure_id ? String(p.procedure_id) : ''
  if (pid && procedures.value?.length) {
    const proc = procedures.value.find((x: any) => String(x.id) === pid) as any
    if (proc) {
      const grupo = String(proc.grupo || '').toUpperCase()
      if (ALEF_GRUPOS_CABINA_2.has(grupo)) return 'CABINA_2'
      if (proc.cabina === 'cabina2') return 'CABINA_2'
      // Catálogo apunta a cabina1 explícito o por defecto
      return 'CABINA_1'
    }
  }

  // 3) Fallback por keywords del texto libre
  if (ALEF_KEYS_CABINA_2.some(k => txt.includes(k))) return 'CABINA_2'

  // Default: medicina estética (cabina 1)
  return 'CABINA_1'
}

const alefBreakdown = computed(() => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todos = [...pacientesWpp.value, ...pacientesFbIg.value]
    .filter((p: any) => p.created_at?.startsWith(thisMonth))

  const cabina1: any[] = []  // S/50 reserva → ALEF S/20
  const cabina2: any[] = []  // S/20 reserva → ALEF S/10
  const excluidos: any[] = [] // retiros / post-procedimientos

  todos.forEach((p: any) => {
    const cls = alefClasificarPaciente(p)
    if (cls === 'CABINA_1') cabina1.push(p)
    else if (cls === 'CABINA_2') cabina2.push(p)
    else excluidos.push(p)
  })

  const monto = cabina1.length * ALEF_COMISION_ALTA + cabina2.length * ALEF_COMISION_BAJA
  return {
    cabina1,                   // pacientes con reserva S/50 (medicina estética)
    cabina2,                   // pacientes con reserva S/20 (no invasivos)
    excluidos,                 // post-procedimientos (retiros, etc.)
    cabina1Count: cabina1.length,
    cabina2Count: cabina2.length,
    excluidosCount: excluidos.length,
    totalConversiones: cabina1.length + cabina2.length,
    monto,
    mes: thisMonth,
  }
})

// Fórmulas calculadas (solo lectura)
const preciosCalc = computed(() => {
  const totalSalarios   = operadoras.reduce((s, op) => s + (op.salario || 0), 0)
  const totalHoras      = operadoras.reduce((s, op) => s + (op.horas || 0), 0)
  const costoPorMinuto  = totalHoras > 0 ? totalSalarios / totalHoras / 60 : 0
  const totalCostosFijos = preciosParams.otrosCostosFijosMes + totalSalarios
  const costosFijosDia  = totalCostosFijos / (preciosParams.diasLaborables || 1)

  // Suma manuales + comisión ALEF (calculada automáticamente desde IA)
  const manualesTotal = gastosVarExtra.reduce((s, g) => s + (g.monto || 0), 0)
  const alefTotal = alefBreakdown.value.monto
  const totalGastosVarExtra = manualesTotal + alefTotal

  let totalIngresos  = 0
  let totalCostosInsumos = 0
  let totalSesiones  = 0

  procedures.value.forEach(p => {
    const meta = procMeta[p.id] || { sesiones: 0, costoInsumo: 0 }
    const precioFinal = (p.price || 0) * (1 - ((p.discount || 0) / 100))
    totalIngresos      += meta.sesiones * precioFinal
    totalCostosInsumos += meta.sesiones * (meta.costoInsumo || 0)
    totalSesiones      += meta.sesiones
  })

  const totalCostosVar   = totalCostosInsumos + totalGastosVarExtra
  const margenBruto      = totalIngresos - totalCostosVar
  const utilidadNeta     = margenBruto - totalCostosFijos
  const margenNetoPct    = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0

  const ticketPromedio      = totalSesiones > 0 ? totalIngresos / totalSesiones : 0
  const margenVarPorSesion  = totalSesiones > 0 ? (totalIngresos - totalCostosVar) / totalSesiones : 0
  const sesionesEquilibrio  = margenVarPorSesion > 0 ? totalCostosFijos / margenVarPorSesion : 0
  const ingresosEquilibrio  = sesionesEquilibrio * ticketPromedio

  return {
    totalSalarios, costoPorMinuto,
    totalCostosFijos, costosFijosDia,
    totalGastosVarExtra,
    totalIngresos, totalCostosInsumos, totalCostosVar,
    totalSesiones, margenBruto, utilidadNeta, margenNetoPct,
    ticketPromedio, margenVarPorSesion, sesionesEquilibrio, ingresosEquilibrio,
  }
})

const fmtS = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const documentItems = [
  { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
  { icon: 'mdi-chart-bar', label: 'Contador Procedimientos', id: 'contadorProcedimientos' },
  { icon: 'mdi-warehouse', label: 'Almacén', id: 'stock' },
  { icon: 'mdi-pen', label: 'Consentimiento', id: 'consentimiento' },
  { icon: 'mdi-folder', label: 'Historial Clínico', id: 'historialClinico' },
  { icon: 'mdi-robot-mower', label: 'Meta', id: 'meta' }
]

/* ---------------- Stats y Logica de Negocio ---------------- */

// Helper para parsear moneda
const parseCurrency = (val: string | number) => {
  if (typeof val === 'number') return val
  if (!val) return 0
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0
}

// Computeds para Facturación (Basado en Pacientes)
const allPacientes = computed(() => [...pacientesWpp.value, ...pacientesFbIg.value, ...pacientesTiktok.value])

// 2.5 Filtros de la vista Pacientes (mes seleccionado, default actual)
const pacienteMesFiltro = ref<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

const pacienteMesesDisponibles = computed(() => {
  const set = new Set<string>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value].forEach((p: any) => {
    const fa = p.fecha_agendamiento
    if (fa && /^\d{4}-\d{2}/.test(fa)) set.add(fa.slice(0, 7))
  })
  const now = new Date()
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  return [...set].sort((a, b) => b.localeCompare(a)).map(value => {
    const [y, m] = value.split('-')
    return { value, label: `${NOMBRES_MESES_LABEL[parseInt(m) - 1]} ${y}` }
  })
})

const pacientesWppFiltrados = computed(() => {
  if (!pacienteMesFiltro.value) return pacientesWpp.value
  return pacientesWpp.value.filter((p: any) => p.fecha_agendamiento?.startsWith(pacienteMesFiltro.value))
})
const pacientesFbIgFiltrados = computed(() => {
  if (!pacienteMesFiltro.value) return pacientesFbIg.value
  return pacientesFbIg.value.filter((p: any) => p.fecha_agendamiento?.startsWith(pacienteMesFiltro.value))
})
const pacientesTiktokFiltrados = computed(() => {
  if (!pacienteMesFiltro.value) return pacientesTiktok.value
  return pacientesTiktok.value.filter((p: any) => p.fecha_agendamiento?.startsWith(pacienteMesFiltro.value))
})

const pacientesMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  return allPacientes.value.filter(c => {
    if (!c.fecha_agendamiento) return false
    const d = new Date(c.fecha_agendamiento)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
})

const pacientesMesAnterior = computed(() => {
  const now = new Date()
  let prevMonth = now.getMonth() - 1
  let prevYear = now.getFullYear()

  if (prevMonth < 0) {
    prevMonth = 11
    prevYear--
  }

  return allPacientes.value.filter(c => {
    if (!c.fecha_agendamiento) return false
    const d = new Date(c.fecha_agendamiento)
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear
  })
})

const revenueReservaCurrentMonth = computed(() => {
  return allPacientes.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenueTratamientoCurrentMonth = computed(() => {
  return allPacientes.value.reduce((sum, item) => sum + parseCurrency(item.precio_tratamiento), 0)
})

const revenueCurrentMonth = computed(() => {
  return revenueReservaCurrentMonth.value + revenueTratamientoCurrentMonth.value
})

const revenueReservaMonthActual = computed(() => {
  return pacientesMesActual.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenueTratamientoMonthActual = computed(() => {
  return pacientesMesActual.value.reduce((sum, item) => sum + parseCurrency(item.precio_tratamiento), 0)
})

const revenueMonthActual = computed(() => {
  return revenueReservaMonthActual.value + revenueTratamientoMonthActual.value
})

// Keep Previous Month logic as is for comparison, or disable it if "Global" comparison doesn't make sense vs "Last Month". 
// User wants to see the sum of the tables. 
// I will repurpose 'revenuePreviousMonth' to be 0 or effectively hide the "growth" if it's confusing, 
// BUT the request is specifically about the "0" value. 
// Let's keep the specific monthly/historical logic separate if possible?
// The user request "En total de reservas... tiene que hacer la suma de las columnas... de lista de pacientes..."
// implied the card should match the table. The table is ALL patients. So the card should be ALL patients.

const revenueReservaPreviousMonth = computed(() => {
  return pacientesMesAnterior.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenueTratamientoPreviousMonth = computed(() => {
  return pacientesMesAnterior.value.reduce((sum, item) => sum + parseCurrency(item.precio_tratamiento), 0)
})

const revenuePreviousMonth = computed(() => {
  return revenueReservaPreviousMonth.value + revenueTratamientoPreviousMonth.value
})

const revenueGrowth = computed(() => {
  // Comparing Total All Time vs Last Month doesn't make sense for "This Month Growth".
  // I will hide the growth indicator in the template or make this 0.
  // Or better, I'll calculate growth based on actual Current Month vs Last Month for the "Growth" pill, 
  // but the MAIN VALUE should be Total.
  // However, reusing the variable names might be cleaner for minimal code change.
  return 0
})

const salesCountCurrentMonth = computed(() => allPacientes.value.length)
const salesCountPreviousMonth = computed(() => pacientesMesAnterior.value.length)
const salesGrowth = computed(() => {
  return 0
})

const averageOrderValue = computed(() => {
  if (salesCountCurrentMonth.value === 0) return 0
  return revenueCurrentMonth.value / salesCountCurrentMonth.value
})

const totalComprasCount = computed(() => compras.value.length)
const totalRevenue = computed(() => revenueCurrentMonth.value)

// Tasa de Conversión Real (Leads que se convierten en Pacientes)
const convertedLeadsCountReal = computed(() => {
  // Coincidencia por número normalizado (leads guardan 51XXXXXXXXX, pacientes pueden tener XXXXXXXXX)
  const patientPhones = new Set(allPacientes.value.map(p => normalizePhone(p.numero)).filter(Boolean))
  return leads.value.filter(l => {
    const norm = normalizePhone(l.numero)
    return norm && patientPhones.has(norm)
  }).length
})

const realConversionRate = computed(() => {
  if (leads.value.length === 0) return 0
  return (convertedLeadsCountReal.value / leads.value.length) * 100
})

// A. Ingresos (Tendencia Semanal - Últimas 8 Semanas)
// A. Ingresos (Tendencia Semanal - Últimas 8 Semanas)
const revenueZoom = ref('Mes') // Default to Month view as it is often most useful
const revenueZoomOptions = ['Día', 'Semana', 'Mes', 'Año']

const revenueChartDataRaw = computed(() => {
  const now = new Date()
  const weeklyData: { start: number; end: number; label: string; reservas: number; tratamientos: number }[] = []

  // Configuration based on Zoom
  let iterations = 8
  let intervalType = 'week' // 'day', 'week', 'month', 'year'

  if (revenueZoom.value === 'Día') {
    iterations = 30
    intervalType = 'day'
  } else if (revenueZoom.value === 'Semana') {
    iterations = 12
    intervalType = 'week'
  } else if (revenueZoom.value === 'Mes') {
    iterations = 12
    intervalType = 'month'
  } else if (revenueZoom.value === 'Año') {
    iterations = 5
    intervalType = 'year'
  }

  // Generate buckets
  for (let i = iterations - 1; i >= 0; i--) {
    let start = new Date(now)
    let end = new Date(now)
    let label = ''

    if (intervalType === 'day') {
      start.setDate(now.getDate() - i)
      end = new Date(start) // Same day
      label = `${start.getDate()}/${start.getMonth() + 1}`
    } else if (intervalType === 'week') {
      // Logic for weeks: similar to before
      const endSeed = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7))
      end = new Date(endSeed)
      start = new Date(endSeed.getFullYear(), endSeed.getMonth(), endSeed.getDate() - 6)
      label = `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`
    } else if (intervalType === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0) // End of month
      const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      label = `${monthNamesShort[start.getMonth()]} ${start.getFullYear().toString().slice(-2)}`
    } else if (intervalType === 'year') {
      start = new Date(now.getFullYear() - i, 0, 1)
      end = new Date(now.getFullYear() - i, 11, 31)
      label = `${start.getFullYear()}`
    }

    // Set boundaries
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    weeklyData.push({
      start: start.getTime(),
      end: end.getTime(),
      label,
      reservas: 0,
      tratamientos: 0
    })
  }

  // Populate data
  allPacientes.value.forEach(p => {
    if (!p.fecha_agendamiento) return
    const t = new Date(p.fecha_agendamiento).getTime()

    // Find matching bucket
    const bucket = weeklyData.find(w => t >= w.start && t <= w.end)
    if (bucket) {
      bucket.reservas += parseCurrency(p.precio)
      bucket.tratamientos += parseCurrency(p.precio_tratamiento)
    }
  })

  return weeklyData
})

const revenueChartSeries = computed(() => {
  return [
    { name: 'Reservas', data: revenueChartDataRaw.value.map(w => w.reservas) },
    { name: 'Tratamientos', data: revenueChartDataRaw.value.map(w => w.tratamientos) }
  ]
})

const revenueChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'area', height: 350, fontFamily: 'inherit', toolbar: { show: false }, background: 'transparent' },
  xaxis: {
    categories: revenueChartDataRaw.value.map(w => w.label),
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } },
    tooltip: { enabled: false }
  },
  yaxis: { labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' }, formatter: (val) => `S/ ${val.toFixed(0)}` } },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#3b82f6', '#8b5cf6'],
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  legend: { position: 'top', horizontalAlign: 'right', labels: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } },
  tooltip: {
    y: { formatter: (val) => `S/ ${val.toFixed(2)}` },
    theme: isDark.value ? 'dark' : 'light'
  }
}))

// B. Gráfico de Conversión
const conversionChartSeries = computed(() => {
  const converted = convertedLeadsCountReal.value > 0 ? convertedLeadsCountReal.value : allPacientes.value.length
  // Ensure we don't show negative non-buyers if patients > leads (unlikely but possible with imported data)
  const total = leads.value.length
  const notConverted = Math.max(0, total - converted)
  return [converted, notConverted]
})

const conversionChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'donut', fontFamily: 'inherit', background: 'transparent' },
  labels: ['Pacientes', 'No Convertidos'],
  colors: ['#10b981', '#ef4444'],
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true, total: { show: true, label: 'Total Leads', color: isDark.value ? '#a1a1aa' : '#666', formatter: () => leads.value.length.toString() }
        }
      }
    }
  },
  legend: { position: 'bottom', labels: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } },
  stroke: { show: false, width: 0 },
  states: {
    hover: { filter: { type: 'none' } },
    active: { filter: { type: 'none' } }
  },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))

// C. Ventas por Categoría (Procedimiento)
const salesByCategorySeries = computed(() => {
  const categories: Record<string, number> = {}
  pacientesMesActual.value.forEach(p => {
    const cat = p.procedimiento || 'Sin Procedimiento'
    if (!categories[cat]) categories[cat] = 0
    categories[cat] += parseCurrency(p.precio)
  })
  return [{ name: 'Ventas Totales', data: Object.values(categories) }]
})

const categoryChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', height: 350, fontFamily: 'inherit', toolbar: { show: false }, background: 'transparent' },
  plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '50%' } },
  xaxis: {
    categories: Object.keys(pacientesMesActual.value.reduce((acc, p) => {
      const cat = p.procedimiento || 'Sin Procedimiento'
      acc[cat] = (acc[cat] || 0) + parseCurrency(p.precio)
      return acc
    }, {} as Record<string, number>)),
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' }, formatter: (val) => `S/ ${Number(val).toFixed(0)}` }
  },
  yaxis: { labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } } },
  colors: ['#3b82f6'],
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  states: {
    hover: { filter: { type: 'none' } },
    active: { filter: { type: 'none' } }
  },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))


// Computeds para Leads
const leadsMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  return leads.value.filter(l => {
    if (!l.created_at) return false
    const d = new Date(l.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
})

const leadsMesAnterior = computed(() => {
  const now = new Date()
  let prevMonth = now.getMonth() - 1
  let prevYear = now.getFullYear()
  if (prevMonth < 0) {
    prevMonth = 11
    prevYear--
  }
  return leads.value.filter(l => {
    if (!l.created_at) return false
    const d = new Date(l.created_at)
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear
  })
})

const leadsGrowthStat = computed(() => {
  const current = leadsMesActual.value.length
  const previous = leadsMesAnterior.value.length
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
})

// Stat cards — todos del MES ACTUAL para coherencia
const totalLeadsCount = computed(() => leadsMesActual.value.length)
const totalLeads = computed(() => leads.value.length) // total histórico (usado en otros lugares)

// Status counts del MES ACTUAL
// Lógica consistente con histórico: si no es caliente ni tibio → frío (incluye null/vacío/otros)
const hotLeadsCount = computed(() => leadsMesActual.value.filter((l: any) => l.lead_status?.toLowerCase().includes('caliente')).length)
const warmLeadsCount = computed(() => leadsMesActual.value.filter((l: any) => l.lead_status?.toLowerCase().includes('tibi')).length)
const coldLeadsCount = computed(() => totalLeadsCount.value - hotLeadsCount.value - warmLeadsCount.value)

// Comparativa mes anterior (para subtítulo de cada card)
const hotLeadsCountPrev = computed(() => leadsMesAnterior.value.filter((l: any) => l.lead_status?.toLowerCase().includes('caliente')).length)
const warmLeadsCountPrev = computed(() => leadsMesAnterior.value.filter((l: any) => l.lead_status?.toLowerCase().includes('tibi')).length)
const coldLeadsCountPrev = computed(() => leadsMesAnterior.value.length - hotLeadsCountPrev.value - warmLeadsCountPrev.value)

const conversionRate = computed(() => {
  if (totalLeadsCount.value === 0) return 0
  return (hotLeadsCount.value / totalLeadsCount.value) * 100
})

// Detecta si un número de teléfono está encriptado en base64 (no es un número real)
const isEncrypted = (val: any): boolean => {
  if (!val) return false
  const s = String(val).trim()
  // Si contiene caracteres que no son dígitos, +, -, espacios → es base64 o dato inválido
  return /[^0-9+\-\s]/.test(s) && s.length > 10
}

// Normaliza teléfono: quita prefijo 51 si tiene 11 dígitos, limpia espacios y +
const normalizePhone = (num: any): string => {
  if (!num) return ''
  const n = String(num).trim().replace(/[+ ]/g, '')
  if (n.startsWith('51') && n.length === 11) return n.slice(2)
  return n
}

// Clave única para deduplicar pacientes/citas entre las 3 fuentes
// (PacientesBDwppHEALUP, PacientesBDfbigHEALUP, healup_calendar_events).
const dedupKeyForAgendado = (row: any): string => {
  const dni = String(row?.dni || row?.client_dni || row?.clientDNI || '').trim()
  if (dni) return 'dni:' + dni
  const tel = String(row?.telefono || row?.numero || row?.client_phone || row?.clientPhone || '')
    .replace(/[^\d]/g, '')
  if (tel) return 'tel:' + (tel.length === 11 && tel.startsWith('51') ? tel.slice(2) : tel)
  const email = String(row?.email || row?.client_email || row?.clientEmail || '').trim().toLowerCase()
  if (email) return 'email:' + email
  const name = `${row?.nombre || row?.clientName || row?.client_name || ''} ${row?.client_surname || row?.clientSurname || ''}`
    .trim().toLowerCase().replace(/\s+/g, ' ')
  return 'name:' + name
}

// Convertidos = pacientes WPP/FBIG cuya CONVERSIÓN ocurrió este mes
// (created_at del registro), deduplicados. Card "Convertidos este mes".
const hotLeadsConvertedCount = computed(() => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const claves = new Set<string>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value]
    .filter((p: any) => p.created_at?.startsWith(thisMonth))
    .forEach((p: any) => claves.add(dedupKeyForAgendado(p)))
  return claves.size
})

// Citas = pacientes WPP/FBIG con CITA programada este mes
// (fecha_agendamiento), deduplicados. Card "Citas este mes".
const pacientesConCitaEsteMes = computed(() => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const claves = new Set<string>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value]
    .filter((p: any) => p.fecha_agendamiento?.startsWith(thisMonth))
    .forEach((p: any) => claves.add(dedupKeyForAgendado(p)))
  return claves.size
})

// ── Detalle de pacientes agendados (drill-down con navegación por mes) ──
const pacientesAgendadosDialog = ref(false)
const pacientesAgendadosSearch = ref('')
const pacientesAgendadosMesSel = ref('') // YYYY-MM seleccionado (vacío = mes actual al abrir)

// Etiquetas de meses (compartido entre dialogs/viñetas; el contador usa el mismo array más abajo)
const NOMBRES_MESES_LABEL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Meses disponibles: dependen del modo del dialog (conversion → created_at,
// cita → fecha_agendamiento).
const pacientesAgendadosMesesDisponibles = computed(() => {
  const campo = pacientesAgendadosModo.value === 'cita' ? 'fecha_agendamiento' : 'created_at'
  const set = new Set<string>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value].forEach((p: any) => {
    const v = p[campo]
    if (v && /^\d{4}-\d{2}/.test(v)) set.add(v.slice(0, 7))
  })
  // Asegurar mes actual presente aunque esté vacío
  const now = new Date()
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  return [...set]
    .sort((a, b) => b.localeCompare(a))
    .map(value => {
      const [y, m] = value.split('-')
      return { value, label: `${NOMBRES_MESES_LABEL[parseInt(m) - 1]} ${y}` }
    })
})

function detectFuentePaciente(p: any, origen: 'wpp' | 'fbig'): { label: string; color: string; icon: string } {
  if (origen === 'wpp') {
    // En la tabla WhatsApp: si el número está encriptado o vacío → TikTok; sino → WhatsApp
    if (!p?.numero || isEncrypted(p.numero)) {
      return { label: 'TikTok', color: 'deep-purple', icon: 'mdi-music-note' }
    }
    return { label: 'WhatsApp', color: 'green', icon: 'mdi-whatsapp' }
  }
  // En la tabla FB/IG: distinguir por red_social (default Instagram)
  const rs = String(p?.red_social || '').toLowerCase()
  if (rs.includes('facebook') || rs.includes('fb.') || rs.startsWith('fb/') || rs.includes('m.me/')) {
    return { label: 'Facebook', color: 'blue', icon: 'mdi-facebook' }
  }
  return { label: 'Instagram', color: 'pink', icon: 'mdi-instagram' }
}

// ── Comprobantes PSE de Healup (fuente de verdad: boletas auto-generadas) ──
const comprobantesPse = ref<any[]>([])

const fetchComprobantesPse = async () => {
  try {
    const { data, error } = await (client
      .from('comprobantes_pse')
      .select('id, serie, numero, tipo_de_comprobante, fecha_de_emision, cliente_numero_de_documento, cliente_denominacion, total, items, medio_de_pago, enlace, enlace_del_pdf, aceptada_por_sunat') as any)
      .eq('company_id', 'healup')
      .order('fecha_de_emision', { ascending: false })
      .limit(2000)
    if (error) throw error
    comprobantesPse.value = data || []
  } catch (err) {
    console.error('[Healup] Error cargando comprobantes_pse:', err)
  }
}

// Map: dni → array de comprobantes (más reciente primero)
const comprobantesByDni = computed(() => {
  const m: Record<string, any[]> = {}
  comprobantesPse.value.forEach(c => {
    const dni = String(c.cliente_numero_de_documento || '').trim()
    if (!dni) return
    if (!m[dni]) m[dni] = []
    m[dni].push(c)
  })
  return m
})

// Detecta el SKU del catálogo en los items de un comprobante.
// Prioridad: 1) items[].codigo coincide con procedures.sku, 2) items[].descripcion ∋ procedures.name
function detectSkuFromComprobante(comprobante: any): { sku: string; name: string; grupo: string; descripcion: string } | null {
  const items: any[] = Array.isArray(comprobante?.items) ? comprobante.items : []
  if (!items.length) return null
  const procs = procedures.value || []
  for (const it of items) {
    const codigo = String(it?.codigo || '').toUpperCase().trim()
    if (codigo) {
      const proc = procs.find((p: any) => String(p.sku || '').toUpperCase() === codigo)
      if (proc) return { sku: proc.sku, name: proc.name, grupo: (proc as any).grupo || '', descripcion: it?.descripcion || '' }
    }
  }
  // Fallback por descripción
  const desc = items.map((it: any) => String(it?.descripcion || '')).join(' | ').toLowerCase()
  if (desc) {
    const sorted = [...procs].sort((a: any, b: any) => (b.name?.length || 0) - (a.name?.length || 0))
    const proc = sorted.find((p: any) => p.name && desc.includes(String(p.name).toLowerCase()))
    if (proc) return { sku: (proc as any).sku || '', name: proc.name, grupo: (proc as any).grupo || '', descripcion: items[0]?.descripcion || '' }
  }
  // Sin match: igualmente devolver descripcion bruta
  return { sku: '', name: '', grupo: '', descripcion: items[0]?.descripcion || '' }
}

// Devuelve la verificación para un paciente:
// - estado: 'verificado' (boleta presente y SKU coincide), 'discrepancia' (boleta presente pero SKU/monto distinto), 'sin_boleta'
function buildVerificacionPaciente(p: any, expectedSku: string, expectedAmount: number): any {
  const dni = String(p?.dni || '').trim()
  if (!dni) return { estado: 'sin_boleta', mensaje: 'Sin DNI registrado', comprobante: null }

  const comps = comprobantesByDni.value[dni] || []
  if (!comps.length) return { estado: 'sin_boleta', mensaje: 'Sin boleta emitida', comprobante: null }

  // Intentar elegir el comprobante que mejor matchea el procedimiento
  let elegido: any = null
  let elegidoInfo: any = null
  for (const c of comps) {
    const info = detectSkuFromComprobante(c)
    if (!info) continue
    if (expectedSku && info.sku && info.sku.toUpperCase() === expectedSku.toUpperCase()) {
      elegido = c; elegidoInfo = info; break
    }
    if (!elegido) { elegido = c; elegidoInfo = info } // primer fallback
  }
  if (!elegido) elegido = comps[0]
  if (!elegidoInfo) elegidoInfo = detectSkuFromComprobante(elegido)

  const totalBoleta = Number(elegido?.total || 0)
  const skuBoleta = elegidoInfo?.sku || ''
  const skuMatch = expectedSku && skuBoleta && skuBoleta.toUpperCase() === expectedSku.toUpperCase()
  const amountMatch = expectedAmount > 0 && Math.abs(totalBoleta - expectedAmount) < 0.5

  let estado: 'verificado' | 'discrepancia' | 'parcial' = 'verificado'
  const issues: string[] = []
  if (expectedSku && !skuMatch) { issues.push(`SKU BD ${expectedSku} ≠ boleta ${skuBoleta || '?'}`); estado = 'discrepancia' }
  if (expectedAmount > 0 && !amountMatch) {
    issues.push(`Importe BD S/${expectedAmount.toFixed(2)} ≠ boleta S/${totalBoleta.toFixed(2)}`)
    estado = 'discrepancia'
  }
  if (!expectedSku || !expectedAmount) { estado = estado === 'verificado' ? 'parcial' : estado }

  return {
    estado,
    mensaje: issues.length ? issues.join(' · ') : `Boleta ${elegido.serie}-${elegido.numero} · S/${totalBoleta.toFixed(2)}`,
    comprobante: {
      serie: elegido.serie,
      numero: elegido.numero,
      total: totalBoleta,
      fecha: elegido.fecha_de_emision,
      sku: skuBoleta,
      descripcion: elegidoInfo?.descripcion || '',
      medio_de_pago: elegido.medio_de_pago || '',
      pdf_url: elegido.enlace_del_pdf || elegido.enlace || '',
      sunat_ok: !!elegido.aceptada_por_sunat,
    }
  }
}

// Resuelve SKU/grupo/nombre del catálogo a partir del procedure_id de un paciente.
// Si no hay procedure_id (registro viejo), intenta match por nombre del procedimiento.
function resolveProcedureFromPaciente(p: any): { sku: string; name: string; grupo: string } {
  if (!procedures.value?.length) return { sku: '', name: p?.procedimiento || '', grupo: '' }
  // 1. Vía procedure_id (preferido)
  if (p?.procedure_id) {
    const proc = procedures.value.find((x: any) => Number(x.id) === Number(p.procedure_id))
    if (proc) return { sku: proc.sku || '', name: proc.name || '', grupo: (proc as any).grupo || '' }
  }
  // 2. Fallback por nombre (procedimiento texto libre vs catálogo)
  const txt = String(p?.procedimiento || '').toLowerCase().trim()
  if (txt.length >= 4) {
    const sorted = [...procedures.value].sort((a: any, b: any) => (b.name?.length || 0) - (a.name?.length || 0))
    const match = sorted.find((x: any) => x.name && txt.includes(String(x.name).toLowerCase()))
    if (match) return { sku: match.sku || '', name: match.name || '', grupo: (match as any).grupo || '' }
  }
  return { sku: '', name: p?.procedimiento || '', grupo: '' }
}

const pacientesAgendadosMes = computed(() => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const targetMonth = pacientesAgendadosMesSel.value || thisMonth

  const buildRow = (p: any, origen: 'wpp' | 'fbig') => {
    const f = detectFuentePaciente(p, origen)
    const proc = resolveProcedureFromPaciente(p)
    const anticipo = parseCurrency(p.precio)
    const saldo = parseCurrency(p.precio_tratamiento)
    const telCrudo = origen === 'wpp'
      ? (isEncrypted(p.numero) ? '' : (p.numero ? String(p.numero) : ''))
      : (p.numero ? String(p.numero) : '')
    const tel = telCrudo ? normalizePhone(telCrudo) : (origen === 'fbig' ? (p.red_social || '') : '')

    // Deep link a la conversación de Chatwoot (Healup = account 2)
    const cw = (() => {
      const base = 'https://chats.alef.company/app/accounts/2'
      const q = telCrudo || p.red_social || p.instagram_handle || p.nombre || ''
      if (!q) return ''
      return `${base}/contacts?search=${encodeURIComponent(String(q).trim())}`
    })()

    // Verificación contra comprobantes_pse (boletas auto-generadas)
    const verif = buildVerificacionPaciente(p, proc.sku, anticipo)

    return {
      id: p.id,
      dni: p.dni || '',
      nombre: p.nombre || '—',
      telefono: tel || '—',
      procedimiento: proc.name || p.procedimiento || '—',
      procedure_sku: proc.sku,
      procedure_grupo: proc.grupo,
      booking_sku: p.booking_sku || '',
      anticipo,
      saldo,
      total_acordado: anticipo + saldo,
      metodo_pago: String(p.metodo_de_pago || '').trim(),
      conversation_url: cw,
      created_at: p.created_at || '',
      fecha_agendamiento: p.fecha_agendamiento || '',
      fuente_label: f.label,
      fuente_color: f.color,
      fuente_icon: f.icon,
      // Verificación con boleta:
      verif_estado: verif.estado,                       // 'verificado' | 'discrepancia' | 'parcial' | 'sin_boleta'
      verif_mensaje: verif.mensaje,
      verif_serie: verif.comprobante?.serie || '',
      verif_numero: verif.comprobante?.numero || '',
      verif_total: verif.comprobante?.total || 0,
      verif_sku: verif.comprobante?.sku || '',
      verif_pdf: verif.comprobante?.pdf_url || '',
      verif_medio_pago: verif.comprobante?.medio_de_pago || '',
      verif_sunat_ok: verif.comprobante?.sunat_ok || false,
    }
  }

  // Filtra por created_at (modo conversion) o fecha_agendamiento (modo cita)
  const campoFiltro = pacientesAgendadosModo.value === 'cita' ? 'fecha_agendamiento' : 'created_at'
  const wppRaw = pacientesWpp.value
    .filter((p: any) => p[campoFiltro]?.startsWith(targetMonth))
    .map((p: any) => buildRow(p, 'wpp'))
  const fbigRaw = pacientesFbIg.value
    .filter((p: any) => p[campoFiltro]?.startsWith(targetMonth))
    .map((p: any) => buildRow(p, 'fbig'))

  // Dedup en cascada — mismo paciente en WPP y FBIG cuenta una vez.
  const claves = new Set<string>()
  const wpp: any[] = []
  for (const r of wppRaw) {
    const k = dedupKeyForAgendado(r)
    if (!claves.has(k)) { claves.add(k); wpp.push(r) }
  }
  const fbig: any[] = []
  for (const r of fbigRaw) {
    const k = dedupKeyForAgendado(r)
    if (!claves.has(k)) { claves.add(k); fbig.push(r) }
  }

  // Orden DESC por el campo del filtro (más reciente primero).
  return [...wpp, ...fbig].sort((a, b) =>
    String(b[campoFiltro] || '').localeCompare(String(a[campoFiltro] || ''))
  )
})

const pacientesAgendadosResumen = computed(() => {
  const counts: Record<string, number> = {}
  pacientesAgendadosMes.value.forEach(p => {
    counts[p.fuente_label] = (counts[p.fuente_label] || 0) + 1
  })
  return counts
})

const pacientesAgendadosTotalReserva = computed(() =>
  pacientesAgendadosMes.value.reduce((s, p) => s + (Number(p.anticipo) || 0), 0)
)

const pacientesAgendadosVerifResumen = computed(() => {
  const counts = { verificado: 0, discrepancia: 0, parcial: 0, sin_boleta: 0 }
  pacientesAgendadosMes.value.forEach(p => {
    counts[p.verif_estado as keyof typeof counts] = (counts[p.verif_estado as keyof typeof counts] || 0) + 1
  })
  return counts
})

const pacientesAgendadosHeaders = [
  { title: 'Plataforma',       key: 'fuente_label',       sortable: true,  width: '110px' },
  { title: 'Nombre',           key: 'nombre',             sortable: true                  },
  { title: 'Teléfono',         key: 'telefono',           sortable: false, width: '110px' },
  { title: 'Tratamiento',      key: 'procedimiento',      sortable: true                  },
  { title: 'SKU',              key: 'procedure_sku',      sortable: true,  width: '110px' },
  { title: 'Reserva',          key: 'anticipo',           sortable: true,  width: '95px',  align: 'end' as const },
  { title: 'Saldo',            key: 'saldo',              sortable: true,  width: '95px',  align: 'end' as const },
  { title: 'Total',            key: 'total_acordado',     sortable: true,  width: '95px',  align: 'end' as const },
  { title: 'Método pago',      key: 'metodo_pago',        sortable: true,  width: '120px' },
  { title: 'Verificación PSE', key: 'verif_estado',       sortable: true,  width: '210px' },
  { title: 'Agendado',         key: 'created_at',         sortable: true,  width: '105px' },
  { title: 'Cita para',        key: 'fecha_agendamiento', sortable: true,  width: '105px' },
  { title: 'Conv.',            key: 'conversation_url',   sortable: false, width: '60px',  align: 'center' as const },
]

function getVerifStyle(estado: string): { color: string; icon: string; label: string } {
  if (estado === 'verificado')   return { color: 'success', icon: 'mdi-shield-check',         label: 'Verificada' }
  if (estado === 'discrepancia') return { color: 'error',   icon: 'mdi-alert-circle',         label: 'Discrepancia' }
  if (estado === 'parcial')      return { color: 'warning', icon: 'mdi-shield-half-full',     label: 'Parcial' }
  return                                  { color: 'grey-darken-1', icon: 'mdi-receipt-text-remove', label: 'Sin boleta' }
}

// Devuelve { color, icon, label } para un método de pago dado.
function getMetodoPagoStyle(raw: string): { color: string; icon: string; label: string } {
  const m = String(raw || '').toLowerCase().trim()
  if (!m) return { color: 'grey', icon: 'mdi-help-circle-outline', label: '—' }
  if (m.includes('yape'))            return { color: 'purple',     icon: 'mdi-cellphone-wireless', label: 'Yape' }
  if (m.includes('plin'))            return { color: 'cyan',       icon: 'mdi-cellphone-wireless', label: 'Plin' }
  if (m.includes('transferencia') || m.includes('transfer'))
                                     return { color: 'blue',       icon: 'mdi-bank-transfer',      label: raw }
  if (m.includes('tarjeta') || m.includes('crédito') || m.includes('credito') || m.includes('débito') || m.includes('debito') || m.includes('visa') || m.includes('mastercard'))
                                     return { color: 'orange',     icon: 'mdi-credit-card-outline', label: raw }
  if (m.includes('efectivo') || m.includes('cash'))
                                     return { color: 'green',      icon: 'mdi-cash',                label: raw }
  if (m.includes('pos') || m.includes('point'))
                                     return { color: 'deep-orange', icon: 'mdi-point-of-sale',      label: raw }
  return { color: 'grey-darken-1', icon: 'mdi-cash-multiple', label: raw }
}

// Modo del dialog: 'conversion' (filtra por created_at) | 'cita' (filtra por fecha_agendamiento)
const pacientesAgendadosModo = ref<'conversion' | 'cita'>('conversion')

function openPacientesAgendadosDialog(modo: 'conversion' | 'cita' = 'conversion') {
  pacientesAgendadosSearch.value = ''
  pacientesAgendadosModo.value = modo
  // Default al mes actual cada vez que se abre
  const now = new Date()
  pacientesAgendadosMesSel.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  pacientesAgendadosDialog.value = true
}

const pacientesAgendadosMesLabel = computed(() => {
  const found = pacientesAgendadosMesesDisponibles.value.find(m => m.value === pacientesAgendadosMesSel.value)
  return found?.label || pacientesAgendadosMesSel.value
})

const hotToPatientRate = computed(() => {
  if (hotLeadsCount.value === 0) return 0
  return (hotLeadsConvertedCount.value / hotLeadsCount.value) * 100
})

const totalConversionRate = computed(() => {
  if (totalLeadsCount.value === 0) return 0
  return (hotLeadsConvertedCount.value / totalLeadsCount.value) * 100
})

// Histórico por mes desde inicio del agente IA (Enero 2026)
const leadsHistoricoByMonth = computed(() => {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  // Pacientes agrupados por mes de fecha_agendamiento (deduplicados entre wpp y fbig)
  const patByMonth = new Map<string, number>()
  const seenByMonth = new Map<string, Set<string>>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value].forEach((p: any) => {
    const fa = p.fecha_agendamiento
    if (!fa) return
    const key = fa.slice(0, 7)
    const dedupKey = dedupKeyForAgendado(p)
    if (!seenByMonth.has(key)) seenByMonth.set(key, new Set())
    if (!seenByMonth.get(key)!.has(dedupKey)) {
      seenByMonth.get(key)!.add(dedupKey)
      patByMonth.set(key, (patByMonth.get(key) || 0) + 1)
    }
  })

  const monthMap = new Map<string, { label: string; frio: number; tibio: number; caliente: number; convertidos: number; pacientes: number }>()

  leads.value.forEach((l: any) => {
    if (!l.created_at) return
    const d = new Date(l.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) {
      monthMap.set(key, { label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, frio: 0, tibio: 0, caliente: 0, convertidos: 0, pacientes: 0 })
    }
    const entry = monthMap.get(key)!
    const status = l.lead_status?.toLowerCase() || ''
    if (status.includes('caliente')) entry.caliente++
    else if (status.includes('tibi')) entry.tibio++
    else entry.frio++
  })

  // Convertidos por mes = pacientes con fecha_agendamiento en ese mes
  patByMonth.forEach((count, key) => {
    if (!monthMap.has(key)) {
      const [y, m] = key.split('-')
      monthMap.set(key, { label: `${monthNames[parseInt(m)-1]} ${y}`, frio: 0, tibio: 0, caliente: 0, convertidos: 0, pacientes: 0 })
    }
    monthMap.get(key)!.convertidos = count
    monthMap.get(key)!.pacientes = count
  })

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
})

const leadsHistoricoChartSeries = computed(() => [
  { name: 'Fríos', data: leadsHistoricoByMonth.value.map(m => m.frio) },
  { name: 'Tibios', data: leadsHistoricoByMonth.value.map(m => m.tibio) },
  { name: 'Calientes', data: leadsHistoricoByMonth.value.map(m => m.caliente) },
  { name: 'Convertidos a Paciente', data: leadsHistoricoByMonth.value.map(m => m.convertidos) },
])

const leadsHistoricoChartOptions = computed<any>(() => ({
  chart: { type: 'bar', height: 380, fontFamily: 'inherit', stacked: false, toolbar: { show: false } },
  plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
  colors: ['#3b82f6', '#f59e0b', '#ef4444', '#22c55e'],
  dataLabels: { enabled: false },
  xaxis: {
    categories: leadsHistoricoByMonth.value.map(m => m.label),
    labels: { style: { colors: 'var(--text-secondary)' } }
  },
  yaxis: { labels: { style: { colors: 'var(--text-secondary)' } } },
  legend: { position: 'top', labels: { colors: 'var(--text-secondary)' } },
  grid: { borderColor: 'rgba(255,255,255,0.08)' },
  tooltip: {
    theme: 'dark',
    y: { formatter: (val: number) => `${val} leads` }
  }
}))

const leadsChartSeries = computed(() => {
  return [{
    name: 'Leads',
    data: [coldLeadsCount.value, warmLeadsCount.value, hotLeadsCount.value]
  }]
})

const leadsChartOptions = computed<ApexOptions>(() => {
  return {
    chart: {
      type: 'bar',
      height: 350,
      fontFamily: 'inherit',
      toolbar: { show: false },
      background: 'transparent'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: false,
        columnWidth: '40%',
        distributed: true // Colors per column
      }
    },
    colors: ['#3b82f6', '#f59e0b', '#ef4444'], // Blue (Cold), Amber (Warm), Red (Hot)
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: ['Fríos', 'Tibios', 'Calientes'],
      labels: {
        style: {
          colors: isDark.value ? '#a1a1aa' : '#3f3f46',
          fontSize: '12px'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark.value ? '#a1a1aa' : '#3f3f46',
        }
      }
    },
    grid: {
      borderColor: isDark.value ? '#3f3f46' : '#e5e7eb',
      strokeDashArray: 4,
    },
    theme: {
      mode: isDark.value ? 'dark' : 'light'
    },
    legend: { show: false },
    tooltip: {
      theme: isDark.value ? 'dark' : 'light'
    }
  }
})

// Computeds para Contribuyentes (Pacientes - COMBINADOS)
// allPacientes is already defined above

const contribuyentesMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  return allPacientes.value.filter(c => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
})

const contribuyentesMesAnterior = computed(() => {
  const now = new Date()
  let prevMonth = now.getMonth() - 1
  let prevYear = now.getFullYear()
  if (prevMonth < 0) {
    prevMonth = 11
    prevYear--
  }
  return allPacientes.value.filter(c => {
    if (!c.created_at) return false
    const d = new Date(c.created_at)
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear
  })
})

const contribuyentesGrowth = computed(() => {
  const current = contribuyentesMesActual.value.length
  const previous = contribuyentesMesAnterior.value.length
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
})

// Stats Array para el Dashboard
// Helper for month names
const monthNamesList = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const revenueCurrentMonthName = computed(() => {
  return monthNamesList[new Date().getMonth()]
})

const revenuePrevMonthName = computed(() => {
  const now = new Date()
  let prev = now.getMonth() - 1
  if (prev < 0) prev = 11
  return monthNamesList[prev]
})

// Stats Array para el Dashboard
const stats = computed<Stat[]>(() => {
  return [
    {
      title: `Ganancias ${revenueCurrentMonthName.value}`,
      value: `S/ ${revenueMonthActual.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
      change: '',
      trend: 'up',
      subtitle: 'Mes Actual',
      description: 'Ingresos totales del mes actual'
    },
    {
      title: `Ganancias ${revenuePrevMonthName.value}`,
      value: `S/ ${revenuePreviousMonth.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
      change: '',
      trend: 'up',
      subtitle: 'Mes Anterior',
      description: 'Ingresos totales del mes anterior'
    },
    {
      title: 'Ganancia Total',
      value: `S/ ${totalRevenue.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
      change: `${revenueGrowth.value >= 0 ? '+' : ''}${revenueGrowth.value.toFixed(1)}%`,
      trend: revenueGrowth.value >= 0 ? 'up' : 'down',
      subtitle: 'vs mes anterior',
      description: 'Ingresos totales del mes actual'
    },
    {
      title: 'Total Leads',
      value: totalLeadsCount.value.toLocaleString(),
      change: `${leadsGrowthStat.value >= 0 ? '+' : ''}${leadsGrowthStat.value.toFixed(1)}%`,
      trend: leadsGrowthStat.value >= 0 ? 'up' : 'down',
      subtitle: 'vs mes anterior',
      description: 'Total acumulado'
    },
    {
      title: 'Total Pacientes',
      value: allPacientes.value.length.toLocaleString(),
      change: '',
      trend: 'up',
      subtitle: 'Histórico',
      description: 'Pedidos procesados exitosamente'
    },
    {
      title: 'Subida de Leads',
      value: `${leadsGrowthStat.value.toFixed(1)}%`,
      change: leadsGrowthStat.value >= 0 ? 'Subiendo' : 'Bajando',
      trend: leadsGrowthStat.value >= 0 ? 'up' : 'down',
      subtitle: 'Crecimiento mensual',
      description: 'Comparativa con el mes pasado'
    }
  ]
})

/* ---------------- Tabs ---------------- */
const tabs = ref<Tab[]>([
  { label: 'Pacientes', value: 'pacientes_dashboard' },
  { label: 'Leads', value: 'leads' },
  { label: 'Próximos Eventos', value: 'events' }
])

const activeTab = ref('pacientes_dashboard') // Changed default to pacientes_dashboard from outline

const headersDashboardWpp = computed(() => {
  return headersPacientesWpp.value.filter(h => h.key !== 'actions')
})

const headersDashboardFbIg = computed(() => {
  return headersPacientesFbIg.value.filter(h => h.key !== 'actions')
})

const headersComprasDashboard = computed(() => {
  return headersCompras.value.slice(0, 10)
})

const headersUpcomingEvents = [
  { title: 'Fecha', key: 'date', sortable: true },
  { title: 'Hora', key: 'time', sortable: true },
  { title: 'Asunto', key: 'subject', sortable: true },
  { title: 'Cliente', key: 'clientName', sortable: true },
]


/* ---------------- ApexCharts Data (LEADS) ---------------- */
const activeZoom = ref('Mes')
const zoomButtons = [
  { id: 'Hoy', label: 'Hoy' },
  { id: 'Semana', label: 'Semana' },
  { id: 'Mes', label: 'Mes' },
  { id: 'Año', label: 'Año' }
]

function handleZoom(filter: string) {
  activeZoom.value = filter
}

// Logic to filter leads for chart based on activeZoom
const leadsChartData = computed(() => {
  const now = new Date()
  let startTime = 0
  const endTime = now.getTime()

  if (activeZoom.value === 'Hoy') {
    startTime = new Date(now.setHours(0, 0, 0, 0)).getTime()
  } else if (activeZoom.value === 'Semana') {
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime()
  } else if (activeZoom.value === 'Mes') {
    startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  } else if (activeZoom.value === 'Año') {
    startTime = new Date(now.getFullYear(), 0, 1).getTime()
  }

  // Filtrar leads por fecha
  const filtered = leads.value.filter(l => {
    if (!l.created_at) return false
    const t = new Date(l.created_at).getTime()
    return t >= startTime && t <= endTime
  })

  // Agrupar (simplificado: solo cuenta total por ahora o distribución simple)
  // BradaPerfumes logic was complex map-based grouping. 
  // For simplicity and robustness, let's just show a time-series of leads count if possible, 
  // or just copy the logic if I retrieved it fully.
  // I retrieved lines 1601-2400 of Brada which contained `filteredLeadsForChart` logic partially (it was cut off).

  // Checking Brada logic from previous read (lines 2350+):
  // It does grouping. I'll implement a simplified version that works for the Area chart.

  // Sort by date
  filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Create accumulation over time or daily counts
  const dataPoints: [number, number][] = []

  // Group by day for Mes/Year/Semana, by Hour for Hoy
  const map = new Map<number, number>()

  filtered.forEach(l => {
    const d = new Date(l.created_at)
    let key: number

    if (activeZoom.value === 'Hoy') {
      d.setMinutes(0, 0, 0); key = d.getTime()
    } else {
      d.setHours(0, 0, 0, 0); key = d.getTime()
    }

    map.set(key, (map.get(key) || 0) + 1)
  })

  // Convert map to sorted array
  const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b)
  sortedKeys.forEach(k => {
    dataPoints.push([k, map.get(k)!])
  })

  return dataPoints
})

const series = computed(() => [{ name: 'Leads', data: leadsChartData.value }])

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    id: 'area-datetime',
    type: 'area',
    zoom: { autoScaleYaxis: true },
    background: 'transparent',
    foreColor: getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()
  },
  colors: ['var(--chart-3)'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.05,
      stops: [0, 100]
    }
  },
  grid: { borderColor: 'var(--border)', strokeDashArray: 4 },
  dataLabels: { enabled: false },
  xaxis: { type: 'datetime' },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))

/* ---------------- Calendar Types & Interfaces ---------------- */
interface CalendarEvent {
  id: string
  date: string
  time: string
  subject: string
  description: string
  procedureId: string
  clientName: string
  clientSurname: string
  clientDNI: string
  clientPhone?: string
  clientEmail?: string
  eventReason: string
  metodoReserva?: string
  montoReserva?: number | null
  procedimientoSolicitado?: string
  color?: string
  stockDescontado?: boolean
  stockDescontadoEn?: string
  stockDescontadoPor?: string
  cabina?: string
}

const METODOS_RESERVA = ['YAPE', 'Plin', 'Efectivo', 'Transferencia', 'Sin reserva']

interface CalendarDay {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  events: CalendarEvent[]
  isWorkingDay: boolean
  totalSlots: number
  availableSlots: number
}

/* ---------------- Cabin Constants ---------------- */
const GRUPOS_CABINA_1 = ['MEDICINA ESTETICA', 'TRAT. MEDICO FACIAL', 'LIPO PAPADA ENZIMÁTICO']
const GRUPOS_CABINA_2 = ['FACIAL BASICO', 'FACIAL PREMIUM', 'HIFU 22D', 'CORPORAL REDUCCION', 'CORPORAL GLUTEOS', 'CORPORAL REAFIRMACION', 'CARBOXITERAPIA']

function getCabinaForProcedure(procedureId: string | number): string {
  if (!procedureId) return 'cabina1'
  const proc = procedures.value.find(p => String(p.id) === String(procedureId))
  if (!proc) return 'cabina1'
  // Prefer explicit cabina field, fall back to group mapping
  if (proc.cabina) return proc.cabina
  return getCabinaFromGrupo(proc.grupo)
}

/* ---------------- Google Calendar Auto-Sync ---------------- */
const gcalSyncing = ref(false)
const gcalSyncResult = ref('')

async function syncGCalToCalendar() {
  gcalSyncing.value = true
  gcalSyncResult.value = ''
  try {
    // Sync today + next 7 days
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${dd}`)
    }

    let totalImported = 0
    for (const date of dates) {
      try {
        const res = await $fetch<any>('/api/healup/gcal-auto-sync', {
          method: 'POST',
          body: { date }
        })
        if (res.imported) totalImported += res.imported
      } catch (e) {
        // Skip dates that fail
      }
    }

    // Reload calendar events
    await fetchEvents()
    gcalSyncResult.value = totalImported > 0
      ? `${totalImported} cita${totalImported > 1 ? 's' : ''} importada${totalImported > 1 ? 's' : ''}`
      : 'Todo sincronizado'

    // Clear message after 5 seconds
    setTimeout(() => { gcalSyncResult.value = '' }, 5000)
  } catch (err: any) {
    gcalSyncResult.value = 'Error al sincronizar'
    console.error('[GCalSync]', err)
  } finally {
    gcalSyncing.value = false
  }
}

/* ---------------- Calendar State ---------------- */
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const selectedDate = ref<Date | null>(null)
const events = ref<CalendarEvent[]>([])
const activeCabin = ref<'cabina1' | 'cabina2'>('cabina1')

const defaultSchedule = [
  { day: 1, active: true, start: '10:00', end: '20:00' },
  { day: 2, active: true, start: '10:00', end: '20:00' },
  { day: 3, active: true, start: '10:00', end: '20:00' },
  { day: 4, active: true, start: '10:00', end: '20:00' },
  { day: 5, active: true, start: '10:00', end: '20:00' },
  { day: 6, active: true, start: '10:00', end: '14:00' },
  { day: 0, active: false, start: '09:00', end: '18:00' }
]

const workingHours = ref({
  id: 1,
  slot_duration_minutes: 30,
  schedule_json: [...defaultSchedule]
})

const workingHoursCabina2 = ref({
  id: 2,
  slot_duration_minutes: 30,
  schedule_json: [...defaultSchedule]
})

const activeWorkingHours = computed(() =>
  activeCabin.value === 'cabina2' ? workingHoursCabina2.value : workingHours.value
)
const showScheduleDialog = ref(false)
const savingSchedule = ref(false)

// Dialog states
const showEventDialog = ref(false)
const showEventDetailDialog = ref(false)
const showDayEventsDialog = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)
const editingEvent = ref<CalendarEvent | null>(null)
const selectedDayEvents = ref<CalendarEvent[]>([])
const selectedDayDate = ref('')

// Event form data
const eventFormData = ref({
  date: '',
  time: '',
  subject: '',
  description: '',
  procedureId: '',
  clientName: '',
  clientSurname: '',
  clientDNI: '',
  clientPhone: '',
  clientEmail: '',
  eventReason: '',
  metodoReserva: 'YAPE',
  montoReserva: null as number | null,
  procedimientoSolicitado: '',
  cabina: 'cabina1'
})

const eventForm = ref<any>(null)

/* ---------------- Calendar Constants ---------------- */
const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]



const eventReasons = [
  'Consulta General',
  'Seguimiento',
  'Emergencia',
  'Chequeo de Rutina',
  'Tratamiento',
  'Evaluación',
  'Otro'
]

const getDayName = (dayIndex: number) => {
  const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return names[dayIndex] || ''
}

const availableTimesForSelectedDate = computed(() => {
  if (!eventFormData.value.date) return []
  
  const selectedD = new Date(eventFormData.value.date + 'T12:00:00')
  const dayOfWeek = selectedD.getDay()
  
  const wh = activeWorkingHours.value
  const dayConfig = wh.schedule_json.find((d: any) => d.day === dayOfWeek)
  if (!dayConfig || !dayConfig.active) return []

  const startParts = dayConfig.start.split(':').map(Number)
  const endParts = dayConfig.end.split(':').map(Number)
  const startMins = startParts[0] * 60 + (startParts[1] || 0)
  const endMins = endParts[0] * 60 + (endParts[1] || 0)

  const times = []
  for (let m = startMins; m < endMins; m += wh.slot_duration_minutes) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0')
    const mm = (m % 60).toString().padStart(2, '0')
    times.push(`${hh}:${mm}`)
  }

  const eventsOnDate = events.value.filter(e =>
    e.date === eventFormData.value.date &&
    e.id !== editingEvent.value?.id &&
    (e.cabina || 'cabina1') === activeCabin.value
  )
  const bookedTimes = eventsOnDate.map(e => e.time ? e.time.substring(0,5) : '')

  return times.filter(t => !bookedTimes.includes(t))
})

/* ---------------- Calendar Computed Properties ---------------- */
const currentMonthName = computed(() => monthNames[currentMonth.value])

const calendarDays = computed<CalendarDay[]>(() => {
  const days: CalendarDay[] = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const prevLastDay = new Date(currentYear.value, currentMonth.value, 0)

  const firstDayOfWeek = firstDay.getDay()
  const lastDateOfMonth = lastDay.getDate()
  const prevLastDate = prevLastDay.getDate()
  const lastDayOfWeek = lastDay.getDay()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getDayCapacity = (date: Date) => {
    const dayOfWeek = date.getDay()
    const wh = activeWorkingHours.value
    const dayConfig = wh.schedule_json.find((d: any) => d.day === dayOfWeek)

    if (!dayConfig || !dayConfig.active) return { isWorkingDay: false, total: 0, available: 0 }

    let startParts = dayConfig.start.split(':').map(Number)
    let endParts = dayConfig.end.split(':').map(Number)
    if(startParts.length < 2) startParts = [10, 0]
    if(endParts.length < 2) endParts = [20, 0]

    const startMins = startParts[0] * 60 + (startParts[1] || 0)
    const endMins = endParts[0] * 60 + (endParts[1] || 0)
    const totalMins = endMins - startMins > 0 ? endMins - startMins : 0
    const durationMins = wh.slot_duration_minutes > 0 ? wh.slot_duration_minutes : 30
    const totalSlots = Math.floor(totalMins / durationMins)

    const eventsForDay = getEventsForDate(date)
    const availableSlots = Math.max(0, totalSlots - eventsForDay.length)

    return { isWorkingDay: true, total: totalSlots, available: availableSlots }
  }

  // Previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(currentYear.value, currentMonth.value - 1, prevLastDate - i)
    const capacity = getDayCapacity(date)
    days.push({
      date,
      day: prevLastDate - i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date),
      isWorkingDay: capacity.isWorkingDay,
      totalSlots: capacity.total,
      availableSlots: capacity.available
    })
  }

  // Current month days
  for (let i = 1; i <= lastDateOfMonth; i++) {
    const date = new Date(currentYear.value, currentMonth.value, i)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)
    const capacity = getDayCapacity(date)

    days.push({
      date,
      day: i,
      isCurrentMonth: true,
      isToday: dateOnly.getTime() === today.getTime(),
      isSelected: selectedDate.value ? dateOnly.getTime() === new Date(selectedDate.value).setHours(0, 0, 0, 0) : false,
      events: getEventsForDate(date),
      isWorkingDay: capacity.isWorkingDay,
      totalSlots: capacity.total,
      availableSlots: capacity.available
    })
  }

  // Next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(currentYear.value, currentMonth.value + 1, i)
    const capacity = getDayCapacity(date)
    days.push({
      date,
      day: i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date),
      isWorkingDay: capacity.isWorkingDay,
      totalSlots: capacity.total,
      availableSlots: capacity.available
    })
  }

  return days
})

const upcomingEvents = computed(() => {
  const now = new Date()
  return events.value
    .filter(event =>
      new Date(event.date + 'T' + event.time) >= now &&
      (event.cabina || 'cabina1') === activeCabin.value
    )
    .sort((a, b) => {
      const dateA = new Date(a.date + 'T' + a.time)
      const dateB = new Date(b.date + 'T' + b.time)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 5)
})

function openScheduleDialog() {
  showScheduleDialog.value = true
}

function closeScheduleDialog() {
  showScheduleDialog.value = false
}

async function fetchWorkingHours() {
  try {
    const { data, error } = await (client.from('healup_working_hours') as any).select('*').order('id')
    if (error && error.code !== 'PGRST116') throw error
    if (data) {
      for (const row of data) {
        const parsed = {
          id: row.id,
          slot_duration_minutes: row.slot_duration_minutes,
          schedule_json: typeof row.schedule_json === 'string' ? JSON.parse(row.schedule_json) : row.schedule_json
        }
        if (row.id === 1 || row.cabina === 'cabina1') workingHours.value = parsed
        else if (row.id === 2 || row.cabina === 'cabina2') workingHoursCabina2.value = parsed
      }
    }
  } catch (error) {
    console.error('Error loading working hours:', error)
  }
}

async function saveWorkingHours() {
  savingSchedule.value = true
  try {
    const wh = activeWorkingHours.value
    const payload = {
      id: wh.id,
      slot_duration_minutes: wh.slot_duration_minutes,
      schedule_json: wh.schedule_json,
      cabina: activeCabin.value
    }
    const { error } = await (client.from('healup_working_hours') as any).upsert(payload, { onConflict: 'id' }).select()
    if (error) throw error
    alert('Horario actualizado correctamente')
    closeScheduleDialog()
  } catch (error) {
    console.error('Error saving working hours:', error)
    alert('Error al guardar el horario')
  } finally {
    savingSchedule.value = false
  }
}

/* ---------------- Calendar Functions ---------------- */
function getEventsForDate(date: Date): CalendarEvent[] {
  const dateStr = formatDateToISO(date)
  return events.value.filter(event => event.date === dateStr && (event.cabina || 'cabina1') === activeCabin.value)
}

function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return ''
  // Use T12:00:00 to force local timezone safely into the middle of the day 
  // avoiding any UTC offsets pushing it to the previous day
  const shortDateStr = dateStr.split('T')[0].split(' ')[0]
  const date = new Date(shortDateStr + 'T12:00:00')
  const day = date.getDate()
  const month = monthNames[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

function previousMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToToday() {
  const today = new Date()
  currentMonth.value = today.getMonth()
  currentYear.value = today.getFullYear()
  selectedDate.value = today
}

function selectDay(day: CalendarDay) {
  selectedDate.value = day.date

  if (day.events.length > 0) {
    selectedDayEvents.value = day.events
    selectedDayDate.value = formatDateToISO(day.date)
    showDayEventsDialog.value = true
  } else {
    // Open create event dialog with the selected date
    openCreateEventDialog(formatDateToISO(day.date))
  }
}

/* ---------------- Event Dialog Functions ---------------- */
function openCreateEventDialog(date?: string) {
  editingEvent.value = null
  eventFormData.value = {
    date: date || formatDateToISO(new Date()),
    time: '09:00',
    subject: '',
    description: '',
    procedureId: '',
    clientName: '',
    clientSurname: '',
    clientDNI: '',
    clientPhone: '',
    clientEmail: '',
    eventReason: '',
    metodoReserva: 'YAPE',
    montoReserva: null,
    procedimientoSolicitado: '',
    cabina: activeCabin.value
  }
  showEventDialog.value = true
}

// Regla de reserva por cabina:
//   Cabina 1 (Medicina Estética / Doctora)        → S/ 50
//   Cabina 2 (faciales/corporales no invasivos)   → S/ 20
const sugerirMontoReservaPorCabina = (cabina: string): number =>
  cabina === 'cabina2' ? 20 : 50

watch(() => eventFormData.value.procedureId, (procId) => {
  if (!procId) return
  const cabina = getCabinaForProcedure(procId)
  eventFormData.value.cabina = cabina
  const metodo = eventFormData.value.metodoReserva
  if (metodo && metodo !== 'Sin reserva') {
    const sugerido = sugerirMontoReservaPorCabina(cabina)
    const actual = eventFormData.value.montoReserva
    // Auto-sugerir si vacío o si era el otro valor sugerido (cambia de cabina)
    if (actual == null || actual === 0 || actual === 50 || actual === 20) {
      eventFormData.value.montoReserva = sugerido
    }
  }
})

watch(() => eventFormData.value.metodoReserva, (metodo) => {
  if (!metodo || metodo === 'Sin reserva') return
  if (eventFormData.value.montoReserva == null || eventFormData.value.montoReserva === 0) {
    eventFormData.value.montoReserva = sugerirMontoReservaPorCabina(
      eventFormData.value.cabina || 'cabina1'
    )
  }
})

// Asignación inversa: el monto de la reserva define la cabina.
//   S/ 50 → Cabina 1 (doctora)
//   S/ 20 → Cabina 2 (no invasivos)
// Otros valores (promos, etc.) no fuerzan la cabina.
watch(() => eventFormData.value.montoReserva, (monto) => {
  const metodo = eventFormData.value.metodoReserva
  if (!metodo || metodo === 'Sin reserva') return
  if (monto === 50) eventFormData.value.cabina = 'cabina1'
  else if (monto === 20) eventFormData.value.cabina = 'cabina2'
})

const reservaHint = computed(() => {
  const metodo = eventFormData.value.metodoReserva
  if (!metodo || metodo === 'Sin reserva') return 'Sin pago anticipado'
  const cabina = eventFormData.value.cabina || 'cabina1'
  const sug = cabina === 'cabina2'
    ? 'S/ 20 (Cabina 2 — no invasivos)'
    : 'S/ 50 (Cabina 1 — doctora)'
  return `Sugerido: ${sug} · vía ${metodo}`
})

function closeEventDialog() {
  showEventDialog.value = false
  editingEvent.value = null
}

async function saveEvent() {
  // Supabase Validation
  if (!eventForm.value) return

  const isValid = eventFormData.value.date &&
    eventFormData.value.time &&
    eventFormData.value.subject &&
    eventFormData.value.clientName &&
    eventFormData.value.clientSurname &&
    eventFormData.value.clientDNI &&
    eventFormData.value.clientPhone &&
    eventFormData.value.eventReason

  if (!isValid) {
    alert('Por favor complete todos los campos requeridos')
    return
  }

  try {
    const metodo = eventFormData.value.metodoReserva || null
    const montoRaw = eventFormData.value.montoReserva
    const monto = (metodo && metodo !== 'Sin reserva' && montoRaw !== null && montoRaw !== undefined && !isNaN(Number(montoRaw)))
      ? Number(montoRaw)
      : null

    const payload = {
      date: eventFormData.value.date,
      time: eventFormData.value.time,
      subject: eventFormData.value.subject,
      description: eventFormData.value.description,
      procedure_id: eventFormData.value.procedureId,
      client_name: eventFormData.value.clientName,
      client_surname: eventFormData.value.clientSurname,
      client_dni: eventFormData.value.clientDNI,
      client_phone: eventFormData.value.clientPhone,
      client_email: eventFormData.value.clientEmail,
      event_reason: eventFormData.value.eventReason,
      metodo_reserva: metodo,
      monto_reserva: monto,
      procedimiento_solicitado: eventFormData.value.procedimientoSolicitado || null,
      cabina: eventFormData.value.cabina || 'cabina1'
    }

    if (editingEvent.value) {
      // Update
      const { error } = await (client
        .from('healup_calendar_events') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('healup_calendar_events') as any)
        .insert(payload)

      if (error) throw error
    }

    await fetchEvents()
    closeEventDialog()
  } catch (error) {
    console.error('Error saving event:', error)
    alert('Error al guardar el evento')
  }
}

function openEventDetail(event: CalendarEvent) {
  selectedEvent.value = event
  showEventDetailDialog.value = true
}

function closeEventDetailDialog() {
  showEventDetailDialog.value = false
  selectedEvent.value = null
}

// ── Descuento de insumos por receta del procedimiento ──────────────
const descontandoStock = ref(false)

function getRecetaCountForProcedure(procedureId: string | number): number {
  return procedureSupplies.value.filter(
    s => String(s.procedure_id) === String(procedureId)
  ).length
}

async function descontarInsumosEvento(event: CalendarEvent) {
  if (!event?.procedureId || !event?.id) return

  const recetaCount = getRecetaCountForProcedure(event.procedureId)
  if (recetaCount === 0) {
    alert('Este procedimiento no tiene receta de insumos configurada.\nVe a Almacén → Inventario → botón Receta para configurarla primero.')
    return
  }

  const proc = procedures.value.find(p => String(p.id) === String(event.procedureId))
  const procNombre = proc?.name || `Procedimiento #${event.procedureId}`

  if (!confirm(
    `¿Confirmar descuento de insumos para:\n"${event.subject}" — ${procNombre}?\n\n` +
    `Se descontarán ${recetaCount} insumo(s) del almacén según la receta.`
  )) return

  descontandoStock.value = true
  try {
    const sessionCookie = useCookie('dashboard_session')
    const usuario = (sessionCookie.value as any)?.email || 'agente'

    const { error } = await (client.rpc as any)(
      'healup_descontar_insumos_procedimiento',
      {
        p_procedure_id: Number(event.procedureId),
        p_event_id:     Number(event.id),
        p_usuario:      usuario,
      }
    )
    if (error) throw error

    // Marcar el evento como descontado
    await (client.from('healup_calendar_events') as any)
      .update({
        stock_descontado:     true,
        stock_descontado_en:  new Date().toISOString(),
        stock_descontado_por: usuario,
      })
      .eq('id', event.id)

    // Refrescar estado
    await Promise.all([fetchEvents(), fetchStockData()])

    // Actualizar el evento seleccionado en memoria
    const updated = events.value.find(e => String(e.id) === String(event.id))
    if (updated) selectedEvent.value = updated

    alert(`✅ Insumos descontados correctamente.\n${recetaCount} movimiento(s) registrado(s) en el almacén.`)
  } catch (e: any) {
    console.error('descontarInsumosEvento:', e)
    alert(`Error al descontar insumos:\n${e?.message || e}`)
  } finally {
    descontandoStock.value = false
  }
}

function editSelectedEvent() {
  if (!selectedEvent.value) return

  editingEvent.value = selectedEvent.value
  eventFormData.value = {
    ...selectedEvent.value,
    clientPhone: selectedEvent.value.clientPhone || '',
    clientEmail: selectedEvent.value.clientEmail || ''
  }
  closeEventDetailDialog()
  showEventDialog.value = true
}

function confirmDeleteEvent() {
  if (!selectedEvent.value) return

  if (confirm(`¿Estás seguro de que deseas eliminar el evento "${selectedEvent.value.subject}"?`)) {
    deleteEvent(selectedEvent.value.id)
    closeEventDetailDialog()
  }
}

async function deleteEvent(eventId: string) {
  try {
    const { error } = await client
      .from('healup_calendar_events')
      .delete()
      .eq('id', eventId)

    if (error) throw error
    await fetchEvents()
  } catch (error) {
    console.error('Error deleting event:', error)
    alert('Error al eliminar el evento')
  }
}

function closeDayEventsDialog() {
  showDayEventsDialog.value = false
  selectedDayEvents.value = []
  selectedDayDate.value = ''
}

function openEventDetailFromDay(event: CalendarEvent) {
  closeDayEventsDialog()
  openEventDetail(event)
}

/* ---------------- Helper Functions ---------------- */
function getProcedureColor(procedureId: string): string {
  const procedure = procedures.value.find(p => p.id === procedureId)
  return procedure ? procedure.color : '#3b82f6' // Default blue if procedure not found
}

function getProcedureSku(procedureId: string | number | null | undefined): string {
  if (!procedureId) return ''
  const procedure = procedures.value.find(p => String(p.id) === String(procedureId))
  return (procedure as any)?.sku || ''
}

function getProcedureGrupo(procedureId: string | number | null | undefined): string {
  if (!procedureId) return ''
  const procedure = procedures.value.find(p => String(p.id) === String(procedureId))
  return (procedure as any)?.grupo || ''
}

/* ---------------- Calendar Supabase ---------------- */
async function fetchEvents() {
  try {
    const { data, error } = await client
      .from('healup_calendar_events')
      .select('*')

    if (error) throw error

    console.log('Raw Supabase Events:', data)

    // Normaliza cualquier formato de fecha a YYYY-MM-DD
    const normalizeDate = (raw: string): string => {
      if (!raw) return ''
      const s = raw.split('T')[0]
      // Detectar DD-MM-YYYY (agente IA guarda así)
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-')
        return `${y}-${m}-${d}`
      }
      return s // Ya está en YYYY-MM-DD
    }

    // Map snake_case to camelCase
    events.value = (data || []).map((e: any) => ({
      id: e.id,
      date: normalizeDate(e.date),
      time: e.time ? e.time.substring(0, 5) : '', // '18:30:00' -> '18:30'
      subject: e.subject || '',
      description: e.description || '',
      procedureId: e.procedure_id,
      clientName: e.client_name || '',
      clientSurname: e.client_surname || '',
      clientDNI: e.client_dni || '',
      clientPhone: e.client_phone || '',
      clientEmail: e.client_email || '',
      eventReason: e.event_reason || '',
      metodoReserva: e.metodo_reserva || '',
      montoReserva: e.monto_reserva !== null && e.monto_reserva !== undefined ? Number(e.monto_reserva) : null,
      procedimientoSolicitado: e.procedimiento_solicitado || '',
      stockDescontado: e.stock_descontado ?? false,
      stockDescontadoEn: e.stock_descontado_en || '',
      stockDescontadoPor: e.stock_descontado_por || '',
      cabina: e.cabina || 'cabina1',
    }))
  } catch (error) {
    console.error('Error loading events:', error)
  }
}

/* ---------------- Procedures Types & Interfaces ---------------- */
interface Procedure {
  id: string
  name: string
  color: string
  price: number
  discount: number
  sku?: string
  grupo?: string
  cabina?: string
}

/* ---------------- Procedures State ---------------- */
const procedures = ref<Procedure[]>([])

// ─── DATOS DE HOJA DE CÁLCULO (Estándar Procedimientos) ─────────────────────
// Fuente: HealUp_Estandar_v2.xlsx – verificado directamente de la hoja.
// 73 procedimientos con nombres exactos. Editables en el dashboard.
// La BD de Supabase puede sobreescribir precio/descuento si el usuario los editó.
interface ProcSheet {
  name: string; grupo: string; color: string; sku: string;
  precioOrig: number; descuento: number;
  duracion: number; tiempoPrep: number; tiempoTotal: number;
  costoInsumo: number; costoHH: number;
}
const PROC_SHEET_LIST: ProcSheet[] = [
  // ── FACIAL BASICO ─────────────────────────────────────────────────────────
  { name:'Glass Skin Babe',           grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-001', precioOrig:120,  descuento:0, duracion:40,  tiempoPrep:10, tiempoTotal:50,  costoInsumo:17.20, costoHH:8.33   },
  { name:'Prime Skin Clean',          grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-002', precioOrig:120,  descuento:0, duracion:40,  tiempoPrep:10, tiempoTotal:50,  costoInsumo:17.20, costoHH:8.33   },
  { name:'Calm Babe',                  grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-003', precioOrig:150,  descuento:0, duracion:40,  tiempoPrep:10, tiempoTotal:50,  costoInsumo:17.20, costoHH:8.33   },
  { name:'Eternal Glow Boost',        grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-004', precioOrig:170,  descuento:0, duracion:40,  tiempoPrep:10, tiempoTotal:50,  costoInsumo:17.20, costoHH:8.33   },
  { name:'Pure Babe Skin',            grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-005', precioOrig:200,  descuento:0, duracion:50,  tiempoPrep:10, tiempoTotal:60,  costoInsumo:20.52, costoHH:10.00  },
  { name:'Prestige Glow Ritual',      grupo:'FACIAL BASICO',       color:'#a78bfa', sku:'FB-006', precioOrig:210,  descuento:0, duracion:50,  tiempoPrep:10, tiempoTotal:60,  costoInsumo:20.52, costoHH:10.00  },
  // ── FACIAL PREMIUM ────────────────────────────────────────────────────────
  { name:'Heal Up Babe Ritual',       grupo:'FACIAL PREMIUM',      color:'#f59e0b', sku:'FP-001', precioOrig:250,  descuento:0, duracion:80,  tiempoPrep:10, tiempoTotal:90,  costoInsumo:37.72, costoHH:15.00  },
  { name:'Heal Up Signature Glow',    grupo:'FACIAL PREMIUM',      color:'#f59e0b', sku:'FP-002', precioOrig:260,  descuento:0, duracion:80,  tiempoPrep:10, tiempoTotal:90,  costoInsumo:37.72, costoHH:15.00  },
  // ── TRAT. MEDICO FACIAL ───────────────────────────────────────────────────
  { name:'Hidralips con Dermapen',            grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-001', precioOrig:80,   descuento:0, duracion:20,  tiempoPrep:10, tiempoTotal:30,  costoInsumo:9.40,  costoHH:5.00   },
  { name:'NCTF 1 sesión',                     grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-002', precioOrig:450,  descuento:0, duracion:50,  tiempoPrep:10, tiempoTotal:60,  costoInsumo:85.00, costoHH:10.00  },
  { name:'NCTF 2 sesiones',                   grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-003', precioOrig:600,  descuento:0, duracion:100, tiempoPrep:20, tiempoTotal:120, costoInsumo:170.00,costoHH:20.00  },
  { name:'NCTF 3 sesiones',                   grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-004', precioOrig:750,  descuento:0, duracion:150, tiempoPrep:20, tiempoTotal:170, costoInsumo:255.00,costoHH:28.33  },
  { name:'Plasma Rico Plaquetas PRP 1s',      grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-005', precioOrig:140,  descuento:0, duracion:50,  tiempoPrep:10, tiempoTotal:60,  costoInsumo:5.35,  costoHH:10.00  },
  { name:'Plasma Rico Plaquetas PRP 2s',      grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-006', precioOrig:200,  descuento:0, duracion:110, tiempoPrep:10, tiempoTotal:120, costoInsumo:10.70, costoHH:20.00  },
  { name:'Plasma Rico Plaquetas PRP 3s',      grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-007', precioOrig:280,  descuento:0, duracion:170, tiempoPrep:10, tiempoTotal:180, costoInsumo:16.05, costoHH:30.00  },
  { name:'Plasma Rico Plaquetas PRP 4s',      grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-008', precioOrig:370,  descuento:0, duracion:230, tiempoPrep:10, tiempoTotal:240, costoInsumo:21.40, costoHH:40.00  },
  { name:'Exoxomas + Esperma Salmón 3s',      grupo:'TRAT. MEDICO FACIAL', color:'#34d399', sku:'TMF-009', precioOrig:2500, descuento:0, duracion:250, tiempoPrep:10, tiempoTotal:260, costoInsumo:73.60, costoHH:43.33  },
  // ── MEDICINA ESTETICA ─────────────────────────────────────────────────────
  { name:'Botox full face',                   grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-001', precioOrig:800,  descuento:0, duracion:20,  tiempoPrep:15, tiempoTotal:35,  costoInsumo:222.00, costoHH:93.06  },
  { name:'Baby botox',                        grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-002', precioOrig:600,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:129.50, costoHH:75.75  },
  { name:'Barbie Botox',                      grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-003', precioOrig:1200, descuento:0, duracion:20,  tiempoPrep:15, tiempoTotal:35,  costoInsumo:444.00, costoHH:121.72 },
  { name:'Masseter Botox',                    grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-004', precioOrig:900,  descuento:0, duracion:20,  tiempoPrep:15, tiempoTotal:35,  costoInsumo:444.00, costoHH:73.42  },
  { name:'2X1 Party Botox - baby botox',      grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-005', precioOrig:600,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:129.50, costoHH:75.75  },
  { name:'2x1 Party Botox - full face',       grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-006', precioOrig:800,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:444.00, costoHH:57.32  },
  { name:'Natural Lips',                      grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-007', precioOrig:700,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:130.00, costoHH:91.77  },
  { name:'Bratz Lips',                        grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-008', precioOrig:900,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:260.00, costoHH:103.04 },
  { name:'Perfilamiento',                     grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-009', precioOrig:700,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:130.00, costoHH:91.77  },
  { name:'Rinomodelación',                    grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-010', precioOrig:1000, descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:260.00, costoHH:119.14 },
  { name:'Surcos nasogenianos',               grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-011', precioOrig:700,  descuento:0, duracion:60,  tiempoPrep:15, tiempoTotal:75,  costoInsumo:130.00, costoHH:91.77  },
  { name:'Sustentación pómular',              grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-012', precioOrig:900,  descuento:0, duracion:60,  tiempoPrep:15, tiempoTotal:75,  costoInsumo:260.00, costoHH:103.04 },
  { name:'Marcación Mandibular',              grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-013', precioOrig:1300, descuento:0, duracion:75,  tiempoPrep:15, tiempoTotal:90,  costoInsumo:520.00, costoHH:125.58 },
  { name:'Proyección de mentón',              grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-014', precioOrig:900,  descuento:0, duracion:30,  tiempoPrep:15, tiempoTotal:45,  costoInsumo:260.00, costoHH:103.04 },
  { name:'Paquete 1 (Perfilamiento+natural lips+menton/baby botox)', grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-015', precioOrig:1500, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:390.00, costoHH:178.71 },
  { name:'Paquete 2 (Perfilamiento+ Bratz lips+ menton/baby botox)', grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-016', precioOrig:2000, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:520.00, costoHH:238.28 },
  { name:'Paquete 3 (Rinomodelación+ Natural lips+ menton/baby botox)',grupo:'MEDICINA ESTETICA',color:'#f472b6', sku:'ME-017', precioOrig:2000, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:520.00, costoHH:238.28 },
  { name:'Paquete 4 (Rinomodelación+ Bratz lips+ menton/baby botox)', grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-018', precioOrig:2300, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:650.00, costoHH:265.65 },
  { name:'Pack Heal Up',                      grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-019', precioOrig:3300, descuento:0, duracion:60,  tiempoPrep:20, tiempoTotal:80,  costoInsumo:1040.00,costoHH:363.86 },
  { name:'#DUO1 (perfilamiento + natural lips)',   grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-020', precioOrig:1100, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:260.00, costoHH:135.24 },
  { name:'#DUO2 (perfilamiento + Bratz lips)',     grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-021', precioOrig:1300, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:260.00, costoHH:167.44 },
  { name:'#DUO3 (Rinomodelación + natural lips)',  grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-022', precioOrig:1400, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:390.00, costoHH:162.61 },
  { name:'#DUO4 (Rinomodelación + Bratz lips)',    grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-023', precioOrig:1550, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:520.00, costoHH:165.83 },
  { name:'#DUO5 (Rinomodelación + mentón)',        grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-024', precioOrig:1550, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:520.00, costoHH:165.83 },
  { name:'#DUO6 (Bratz lips + mentón)',            grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-025', precioOrig:1450, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:520.00, costoHH:149.73 },
  { name:'#DUO7 (mentón + natural lips)',          grupo:'MEDICINA ESTETICA', color:'#f472b6', sku:'ME-026', precioOrig:1300, descuento:0, duracion:90, tiempoPrep:15, tiempoTotal:105, costoInsumo:390.00, costoHH:146.51 },
  { name:'Zona Botox extra baby',             grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-027', precioOrig:200,  descuento:0, duracion:10,  tiempoPrep:10, tiempoTotal:20,  costoInsumo:37.00,  costoHH:26.24  },
  { name:'Zona Botox extra full face',        grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-028', precioOrig:250,  descuento:0, duracion:10,  tiempoPrep:10, tiempoTotal:20,  costoInsumo:66.60,  costoHH:29.53  },
  { name:'Micropigmentación de labios',       grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-029', precioOrig:350,  descuento:0, duracion:120, tiempoPrep:15, tiempoTotal:135, costoInsumo:15.00,  costoHH:53.94  },
  { name:'Retiro de ácido (Hialuronidasa)',   grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-030', precioOrig:300,  descuento:0, duracion:45,  tiempoPrep:15, tiempoTotal:60,  costoInsumo:45.00,  costoHH:41.06  },
  { name:'Ácido Hialurónico para Ojeras',     grupo:'MEDICINA ESTETICA',   color:'#f472b6', sku:'ME-031', precioOrig:800,  descuento:0, duracion:60,  tiempoPrep:15, tiempoTotal:75,  costoInsumo:280.00, costoHH:83.72  },
  // ── LIPO PAPADA ENZIMÁTICO ────────────────────────────────────────────────
  { name:'Lipopapada 1ra gen 1 sesión',  grupo:'LIPO PAPADA ENZIMÁTICO', color:'#fb923c', sku:'LPE-001', precioOrig:200,  descuento:0, duracion:15, tiempoPrep:10, tiempoTotal:25,  costoInsumo:10.00,  costoHH:30.59  },
  { name:'Lipopapada 1ra gen 6 sesiones',grupo:'LIPO PAPADA ENZIMÁTICO', color:'#fb923c', sku:'LPE-002', precioOrig:800,  descuento:0, duracion:90, tiempoPrep:10, tiempoTotal:100, costoInsumo:60.00,  costoHH:119.14 },
  { name:'Lipopapada 2da gen 1 sesión',  grupo:'LIPO PAPADA ENZIMÁTICO', color:'#fb923c', sku:'LPE-003', precioOrig:1200, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60,  costoInsumo:660.00, costoHH:86.94  },
  // ── HIFU 22D ─────────────────────────────────────────────────────────────
  { name:'HIFU 22D 1 Zona Facial',  grupo:'HIFU 22D', color:'#38bdf8', sku:'H22-001', precioOrig:199, descuento:0, duracion:20, tiempoPrep:10, tiempoTotal:30, costoInsumo:24.00, costoHH:5.00   },
  { name:'HIFU 22D Rostro Completo',grupo:'HIFU 22D', color:'#38bdf8', sku:'H22-002', precioOrig:599, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60, costoInsumo:66.00, costoHH:10.00  },
  { name:'HIFU Corporal 1 Zona',    grupo:'HIFU 22D', color:'#38bdf8', sku:'H22-003', precioOrig:299, descuento:0, duracion:30, tiempoPrep:10, tiempoTotal:40, costoInsumo:24.00, costoHH:6.67   },
  { name:'HIFU 22D Espalda',        grupo:'HIFU 22D', color:'#38bdf8', sku:'H22-004', precioOrig:699, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60, costoInsumo:28.00, costoHH:10.00  },
  { name:'HIFU 22D Abdomen',        grupo:'HIFU 22D', color:'#38bdf8', sku:'H22-005', precioOrig:699, descuento:0, duracion:50, tiempoPrep:10, tiempoTotal:60, costoInsumo:28.00, costoHH:10.00  },
  // ── CARBOXITERAPIA ────────────────────────────────────────────────────────
  { name:'Carboxiterapia Ojeras 1 sesión', grupo:'CARBOXITERAPIA', color:'#4ade80', sku:'CX-001', precioOrig:80,  descuento:0, duracion:10, tiempoPrep:10, tiempoTotal:20, costoInsumo:10.00, costoHH:3.33   },
  { name:'Carboxiterapia Ojeras 3 ses',    grupo:'CARBOXITERAPIA', color:'#4ade80', sku:'CX-002', precioOrig:210, descuento:0, duracion:30, tiempoPrep:10, tiempoTotal:40, costoInsumo:30.00, costoHH:6.67   },
  { name:'Carboxiterapia Ojeras 4 ses',    grupo:'CARBOXITERAPIA', color:'#4ade80', sku:'CX-003', precioOrig:260, descuento:0, duracion:40, tiempoPrep:10, tiempoTotal:50, costoInsumo:40.00, costoHH:8.33   },
  { name:'Carboxiterapia Ojeras 6 ses',    grupo:'CARBOXITERAPIA', color:'#4ade80', sku:'CX-004', precioOrig:330, descuento:0, duracion:60, tiempoPrep:10, tiempoTotal:70, costoInsumo:60.00, costoHH:11.67  },
  // ── CORPORAL REDUCCION ────────────────────────────────────────────────────
  { name:'Lipo Start Protocol 3 ses',  grupo:'CORPORAL REDUCCION', color:'#818cf8', sku:'CR-001', precioOrig:450,  descuento:0, duracion:60,  tiempoPrep:20, tiempoTotal:80,  costoInsumo:80.00,  costoHH:13.33  },
  { name:'Lipo Sculpt Protocol 5 ses', grupo:'CORPORAL REDUCCION', color:'#818cf8', sku:'CR-002', precioOrig:599,  descuento:0, duracion:300, tiempoPrep:20, tiempoTotal:320, costoInsumo:90.00,  costoHH:53.33  },
  { name:'Lipo Intensive Shape 8 ses', grupo:'CORPORAL REDUCCION', color:'#818cf8', sku:'CR-003', precioOrig:999,  descuento:0, duracion:480, tiempoPrep:20, tiempoTotal:500, costoInsumo:105.00, costoHH:83.33  },
  { name:'Heal Up Lipo 360 10 ses',    grupo:'CORPORAL REDUCCION', color:'#818cf8', sku:'CR-004', precioOrig:1399, descuento:0, duracion:600, tiempoPrep:20, tiempoTotal:620, costoInsumo:115.00, costoHH:103.33 },
  // ── CORPORAL GLUTEOS ──────────────────────────────────────────────────────
  { name:'Glow Booty 6 peptonas 3 ses',   grupo:'CORPORAL GLUTEOS', color:'#c084fc', sku:'CG-001', precioOrig:500, descuento:0, duracion:180, tiempoPrep:10, tiempoTotal:190, costoInsumo:42.00, costoHH:31.67  },
  { name:'Sculpt Booty 8 peptonas 4 ses', grupo:'CORPORAL GLUTEOS', color:'#c084fc', sku:'CG-002', precioOrig:650, descuento:0, duracion:240, tiempoPrep:10, tiempoTotal:250, costoInsumo:56.00, costoHH:41.67  },
  { name:'Power Booty 10 peptonas 5 ses', grupo:'CORPORAL GLUTEOS', color:'#c084fc', sku:'CG-003', precioOrig:850, descuento:0, duracion:300, tiempoPrep:10, tiempoTotal:310, costoInsumo:70.00, costoHH:51.67  },
  // ── CORPORAL REAFIRMACION ─────────────────────────────────────────────────
  { name:'Reafirm Body 4 sesiones',  grupo:'CORPORAL REAFIRMACION', color:'#2dd4bf', sku:'CRF-001', precioOrig:200, descuento:0, duracion:240, tiempoPrep:10, tiempoTotal:250, costoInsumo:0,     costoHH:41.67  },
  { name:'Reafirm Body 6 sesiones',  grupo:'CORPORAL REAFIRMACION', color:'#2dd4bf', sku:'CRF-002', precioOrig:280, descuento:0, duracion:360, tiempoPrep:10, tiempoTotal:370, costoInsumo:0,     costoHH:61.67  },
  { name:'Reafirm Body 8 sesiones',  grupo:'CORPORAL REAFIRMACION', color:'#2dd4bf', sku:'CRF-003', precioOrig:380, descuento:0, duracion:480, tiempoPrep:10, tiempoTotal:490, costoInsumo:0,     costoHH:81.67  },
  { name:'Reafirm Body 10 sesiones', grupo:'CORPORAL REAFIRMACION', color:'#2dd4bf', sku:'CRF-004', precioOrig:450, descuento:0, duracion:600, tiempoPrep:10, tiempoTotal:610, costoInsumo:0,     costoHH:101.67 },
  // ── RESERVAS ──────────────────────────────────────────────────────────────
  { name:'Reserva facial y/o corporal', grupo:'RESERVAS', color:'#94a3b8', sku:'RES-001', precioOrig:20,  descuento:0, duracion:0, tiempoPrep:0, tiempoTotal:0, costoInsumo:0, costoHH:0 },
  { name:'Reserva armonización',        grupo:'RESERVAS', color:'#94a3b8', sku:'RES-002', precioOrig:50,  descuento:0, duracion:0, tiempoPrep:0, tiempoTotal:0, costoInsumo:0, costoHH:0 },
]

// Índice por nombre normalizado para lookup rápido
const PROC_SHEET_MAP = new Map<string, ProcSheet>(
  PROC_SHEET_LIST.map(p => [p.name.toLowerCase().trim(), p])
)
function getProcSheet(name: string): ProcSheet | undefined {
  return PROC_SHEET_MAP.get(String(name || '').toLowerCase().trim())
}

// PROC_DEFAULTS alias mantenido para compatibilidad con código restante
const PROC_DEFAULTS = PROC_SHEET_MAP
interface ProcDefault extends ProcSheet {}
function getProcDefault(name: string) { return getProcSheet(name) }

// Mapa de variables extendidas por procedimiento (calculadora de precios)
const procMeta = reactive<Record<string, {
  sesiones: number; costoInsumo: number;
  duracion: number; tiempoPrep: number; tiempoTotal: number; costoHH: number;
}>>({})
watch(procedures, (procs) => {
  procs.forEach(p => {
    if (!procMeta[p.id]) {
      const def = getProcDefault(p.name)
      procMeta[p.id] = {
        sesiones:    0,
        costoInsumo: def?.costoInsumo  ?? 0,
        duracion:    def?.duracion     ?? 0,
        tiempoPrep:  def?.tiempoPrep   ?? 0,
        tiempoTotal: def?.tiempoTotal  ?? 0,
        costoHH:     def?.costoHH      ?? 0,
      }
    }
  })
}, { immediate: true })

// Grupos fijos Healup en orden definido
const GRUPOS_HEALUP = [
  'FACIAL BASICO',
  'FACIAL PREMIUM',
  'TRAT. MEDICO FACIAL',
  'MEDICINA ESTETICA',
  'LIPO PAPADA ENZIMÁTICO',
  'HIFU 22D',
  'CARBOXITERAPIA',
  'CORPORAL REDUCCION',
  'CORPORAL GLUTEOS',
  'CORPORAL REAFIRMACION',
  'RESERVAS',
]

// Procedimientos agrupados en el orden definido (siempre muestra todos los grupos)
const procedimientosPorGrupo = computed(() => {
  const map: Record<string, Procedure[]> = {}
  GRUPOS_HEALUP.forEach(g => { map[g] = [] })
  procedures.value.forEach(p => {
    const g = (p.grupo || '').toUpperCase().trim()
    if (map[g] !== undefined) {
      map[g].push(p)
    } else {
      // Grupo no estándar: agregarlo al final
      if (!map[g]) map[g] = []
      map[g].push(p)
    }
  })
  return map
})

// Estado de colapso por grupo — todos empiezan colapsados
const collapsedGroups = reactive<Record<string, boolean>>(
  Object.fromEntries(GRUPOS_HEALUP.map(g => [g, true]))
)

function toggleGrupo(key: string) {
  collapsedGroups[key] = !collapsedGroups[key]
}

// Estado de edición por procedimiento
const editingProcs = reactive<Record<string, boolean>>({})
const editBuffer = reactive<Record<string, {
  sku: string; name: string; color: string; price: number; discount: number;
  sesiones: number; costoInsumo: number; grupo: string;
  duracion: number; tiempoPrep: number; tiempoTotal: number; costoHH: number;
}>>({})

function startEditProc(p: Procedure) {
  editBuffer[p.id] = {
    sku:         p.sku   || '',
    name:        p.name,
    color:       p.color || '#3b82f6',
    price:       p.price || 0,
    discount:    p.discount || 0,
    sesiones:    procMeta[p.id]?.sesiones    || 0,
    costoInsumo: procMeta[p.id]?.costoInsumo || 0,
    grupo:       (p as any).grupo || '',
    duracion:    procMeta[p.id]?.duracion    || 0,
    tiempoPrep:  procMeta[p.id]?.tiempoPrep  || 0,
    tiempoTotal: procMeta[p.id]?.tiempoTotal || 0,
    costoHH:     procMeta[p.id]?.costoHH     || 0,
  }
  editingProcs[p.id] = true
}

function cancelEditProc(id: string) {
  editingProcs[id] = false
  delete editBuffer[id]
}

async function saveEditProc(p: Procedure) {
  const buf = editBuffer[p.id]
  if (!buf) return
  try {
    // Intentar guardar con sku+grupo; si falla (columnas no existen en BD),
    // reintentar solo con campos seguros
    const { error } = await (client.from('healup_procedures') as any)
      .update({ name: buf.name, color: buf.color, price: buf.price, discount: buf.discount, sku: buf.sku || null, grupo: (p as any).grupo || null })
      .eq('id', p.id)

    if (error) {
      // Columnas sku/grupo no existen → guardar solo los campos base
      const { error: e2 } = await (client.from('healup_procedures') as any)
        .update({ name: buf.name, color: buf.color, price: buf.price, discount: buf.discount })
        .eq('id', p.id)
      if (e2) throw e2
    }

    // Actualizar estado local siempre
    p.name     = buf.name
    p.sku      = buf.sku
    p.color    = buf.color
    p.price    = buf.price
    p.discount = buf.discount
    if (procMeta[p.id]) {
      procMeta[p.id].sesiones    = buf.sesiones
      procMeta[p.id].costoInsumo = buf.costoInsumo
      procMeta[p.id].duracion    = buf.duracion    || 0
      procMeta[p.id].tiempoPrep  = buf.tiempoPrep  || 0
      procMeta[p.id].tiempoTotal = buf.tiempoTotal || 0
      procMeta[p.id].costoHH     = buf.costoHH     || 0
    }
    editingProcs[p.id] = false
    delete editBuffer[p.id]
  } catch (e) {
    console.error('Error guardando procedimiento:', e)
  }
}

// Cálculo reactivo por procedimiento (usa editBuffer cuando está en edición)
function procCalc(p: Procedure) {
  const isEditing  = editingProcs[p.id]
  const ses        = isEditing ? (editBuffer[p.id]?.sesiones    || 0) : (procMeta[p.id]?.sesiones    || 0)
  const precio     = isEditing ? (editBuffer[p.id]?.price       || 0) : (p.price || 0)
  const desc       = isEditing ? (editBuffer[p.id]?.discount    || 0) : (p.discount || 0)
  const insumo     = isEditing ? (editBuffer[p.id]?.costoInsumo || 0) : (procMeta[p.id]?.costoInsumo || 0)
  const duracion   = isEditing ? (editBuffer[p.id]?.duracion    || 0) : (procMeta[p.id]?.duracion    || 0)
  const tiempoPrep = isEditing ? (editBuffer[p.id]?.tiempoPrep  || 0) : (procMeta[p.id]?.tiempoPrep  || 0)
  const tiempoTotal= isEditing ? (editBuffer[p.id]?.tiempoTotal || 0) : (procMeta[p.id]?.tiempoTotal || 0)
  const costoHH    = isEditing ? (editBuffer[p.id]?.costoHH     || 0) : (procMeta[p.id]?.costoHH     || 0)

  // Precios y costos por sesión
  const precioFinal  = precio * (1 - desc / 100)
  const costoTotal   = insumo + costoHH
  const igvRenta     = precioFinal * 0.195            // siempre 19.5%
  const utilidadNeta = precioFinal - costoTotal - igvRenta
  const margenNeto   = precioFinal > 0 ? (utilidadNeta / precioFinal) * 100 : 0

  // Totales mensuales (sesiones × precio)
  const ingresos = ses * precioFinal
  const costos   = ses * insumo
  const margen   = ingresos - costos
  const pct      = ingresos > 0 ? (margen / ingresos) * 100 : 0

  return { ses, precioFinal, ingresos, costos, margen, pct,
           duracion, tiempoPrep, tiempoTotal, costoHH,
           costoTotal, igvRenta, utilidadNeta, margenNeto }
}

// Conteo de procedimientos agendados por WhatsApp (mes actual)
const procWppCounts = computed(() => {
  const now = new Date()
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Normaliza DD-MM-YYYY → YYYY-MM-DD (o pasa ISO tal cual)
  const normFecha = (raw: string): string => {
    if (!raw) return ''
    const s = String(raw).split('T')[0]
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split('-')
      return `${y}-${m}-${d}`
    }
    return s
  }

  const counts: Record<string, number> = {}
  pacientesWpp.value.forEach((pat: any) => {
    const fecha = normFecha(pat.fecha_agendamiento).slice(0, 7)
    if (fecha !== mesActual) return
    // Usar procedimiento; si vacío, usar servicio_interes como respaldo
    const rawName = pat.procedimiento || pat.servicio_interes
    if (!rawName) return
    const key = String(rawName).toLowerCase().trim()
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
})
function getProcWppCount(name: string): number {
  const key = String(name || '').toLowerCase().trim()
  // 1. Coincidencia exacta
  if (procWppCounts.value[key] != null) return procWppCounts.value[key]
  // 2. El campo del paciente contiene el nombre del procedimiento (o viceversa)
  let total = 0
  for (const [k, v] of Object.entries(procWppCounts.value)) {
    if (k.includes(key) || key.includes(k)) total += v
  }
  return total
}

const procedureSearch = ref('')
const showProcedureDialog = ref(false)
const editingProcedure = ref<Procedure | null>(null)
const procedureFormData = ref({
  name: '',
  color: '#3b82f6',
  price: 0,
  discount: 0,
  sku: '',
  grupo: '',
  cabina: 'cabina1',
})
const procedureForm = ref<any>(null)

// Nuevo grupo desde la vista de precios
const showNuevoGrupoDialog = ref(false)
const nuevoGrupoNombre = ref('')

/* ---------------- Procedures Constants ---------------- */
const procedureHeaders = [
  { title: 'SKU', key: 'sku', sortable: true, width: '90px' },
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Grupo', key: 'grupo', sortable: true },
  { title: 'Cabina', key: 'cabina', sortable: true, width: '140px' },
  { title: 'Color', key: 'color', sortable: false, width: '60px' },
  { title: 'Precio Original', key: 'price', sortable: true },
  { title: 'Descuento', key: 'discount', sortable: true },
  { title: 'Precio Final', key: 'finalPrice', sortable: true },
  { title: 'Receta', key: 'receta', sortable: false, width: '110px' },
  { title: 'Acciones', key: 'actions', sortable: false, width: '80px' }
]

/* ---------------- Procedures Functions ---------------- */
function openProcedureDialog(procedure?: Procedure, grupoDefault?: string) {
  if (procedure) {
    editingProcedure.value = procedure
    procedureFormData.value = {
      name: procedure.name,
      color: procedure.color,
      price: procedure.price,
      discount: procedure.discount,
      sku: procedure.sku || '',
      grupo: procedure.grupo || '',
      cabina: procedure.cabina || getCabinaFromGrupo(procedure.grupo),
    }
  } else {
    editingProcedure.value = null
    const grupoForCabin = grupoDefault || ''
    procedureFormData.value = {
      name: '',
      color: '#3b82f6',
      price: 0,
      discount: 0,
      sku: '',
      grupo: grupoForCabin,
      cabina: getCabinaFromGrupo(grupoForCabin),
    }
  }
  showProcedureDialog.value = true
}

function getCabinaFromGrupo(grupo?: string): string {
  if (!grupo) return 'cabina1'
  if (GRUPOS_CABINA_2.includes(grupo.toUpperCase())) return 'cabina2'
  return 'cabina1'
}

async function toggleProcedureCabina(procedure: Procedure) {
  const newCabina = (procedure.cabina || 'cabina1') === 'cabina1' ? 'cabina2' : 'cabina1'
  // Update locally first for instant feedback
  procedure.cabina = newCabina
  // Only persist to DB if procedure has a real ID (not synthetic negative id)
  if (Number(procedure.id) > 0) {
    await saveProcedureField(procedure.id, 'cabina' as keyof Procedure, newCabina)
  }
}

function closeProcedureDialog() {
  showProcedureDialog.value = false
  editingProcedure.value = null
}

async function saveProcedure() {
  if (!procedureFormData.value.name) {
    alert('Por favor ingrese un nombre para el procedimiento')
    return
  }
  if (procedureFormData.value.price < 0) {
    alert('El precio debe ser mayor o igual a 0')
    return
  }
  try {
    const payload = {
      name: procedureFormData.value.name,
      color: procedureFormData.value.color,
      price: procedureFormData.value.price,
      discount: procedureFormData.value.discount,
      sku: procedureFormData.value.sku || null,
      grupo: procedureFormData.value.grupo || null,
      cabina: procedureFormData.value.cabina || 'cabina1',
    }
    if (editingProcedure.value) {
      const { error } = await (client.from('healup_procedures') as any)
        .update(payload)
        .eq('id', editingProcedure.value.id)
      if (error) throw error
    } else {
      const { error } = await (client.from('healup_procedures') as any)
        .insert(payload)
      if (error) throw error
    }
    await fetchProcedures()
    closeProcedureDialog()
  } catch (error) {
    console.error('Error saving procedure:', error)
    alert('Error al guardar el procedimiento')
  }
}

// Guardar un campo específico inline desde la tabla de precios
async function saveProcedureField(id: string, field: keyof Procedure, value: any) {
  try {
    const { error } = await (client.from('healup_procedures') as any)
      .update({ [field]: value === '' ? null : value })
      .eq('id', id)
    if (error) throw error
    const p = procedures.value.find(x => x.id === id)
    if (p) (p as any)[field] = value
  } catch (e) {
    console.error('Error guardando campo:', e)
  }
}

async function deleteProcedure(procedureId: string) {
  if (confirm('¿Eliminar este procedimiento? Esta acción no se puede deshacer.')) {
    try {
      const { error } = await client
        .from('healup_procedures')
        .delete()
        .eq('id', procedureId)
      if (error) throw error
      await fetchProcedures()
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Error al eliminar el procedimiento')
    }
  }
}

// Renombrar un grupo completo
async function renameGrupo(oldName: string, newName: string) {
  if (!newName.trim() || newName === oldName) return
  try {
    const ids = procedures.value
      .filter(p => (p.grupo || 'Sin Grupo').toUpperCase() === oldName)
      .map(p => p.id)
    if (!ids.length) return
    const { error } = await (client.from('healup_procedures') as any)
      .update({ grupo: newName.trim() })
      .in('id', ids)
    if (error) throw error
    await fetchProcedures()
  } catch (e) {
    console.error('Error renombrando grupo:', e)
  }
}

/* ──────────────────────────────────────────────────────────────────
   CONFIGURACIÓN ESTÁTICA: Grupos y SKUs por ID de procedimiento
   Fuente: hoja de cálculo HealUp_Estandar_v2
   ────────────────────────────────────────────────────────────────── */
const PROC_CONFIG: Record<number, { grupo: string; sku: string }> = {
  // FACIAL BASICO
  24: { grupo: 'FACIAL BASICO',         sku: 'FB-001' },
  25: { grupo: 'FACIAL BASICO',         sku: 'FB-002' },
  26: { grupo: 'FACIAL BASICO',         sku: 'FB-003' },
  27: { grupo: 'FACIAL BASICO',         sku: 'FB-004' },
  28: { grupo: 'FACIAL BASICO',         sku: 'FB-005' },
  29: { grupo: 'FACIAL BASICO',         sku: 'FB-006' },
  30: { grupo: 'FACIAL BASICO',         sku: 'FB-007' },
  31: { grupo: 'FACIAL BASICO',         sku: 'FB-008' },
  // FACIAL PREMIUM
  70: { grupo: 'FACIAL PREMIUM',        sku: 'FP-001' },
  71: { grupo: 'FACIAL PREMIUM',        sku: 'FP-002' },
  72: { grupo: 'FACIAL PREMIUM',        sku: 'FP-003' },
  73: { grupo: 'FACIAL PREMIUM',        sku: 'FP-004' },
  93: { grupo: 'FACIAL PREMIUM',        sku: 'FP-005' },
  // TRAT. MEDICO FACIAL
  32: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-001' },
  62: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-002' },
  63: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-003' },
  64: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-004' },
  65: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-005' },
  66: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-006' },
  67: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-007' },
  68: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-008' },
  69: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-009' },
  90: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-010' },
  92: { grupo: 'TRAT. MEDICO FACIAL',   sku: 'TMF-011' },
  // MEDICINA ESTETICA
   4: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-001' },
  10: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-002' },
  11: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-003' },
  15: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-004' },
  17: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-005' },
  18: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-006' },
  19: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-007' },
  20: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-008' },
  21: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-009' },
  22: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-010' },
  23: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-011' },
  33: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-012' },
  34: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-013' },
  35: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-014' },
  36: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-015' },
  37: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-016' },
  38: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-017' },
  39: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-018' },
  40: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-019' },
  46: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-020' },
  53: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-021' },
  56: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-022' },
  57: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-023' },
  58: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-024' },
  59: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-025' },
  60: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-026' },
  61: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-027' },
  89: { grupo: 'MEDICINA ESTETICA',     sku: 'ME-028' },
  // LIPO PAPADA ENZIMÁTICO
  54: { grupo: 'LIPO PAPADA ENZIMÁTICO', sku: 'LPE-001' },
  55: { grupo: 'LIPO PAPADA ENZIMÁTICO', sku: 'LPE-002' },
  91: { grupo: 'LIPO PAPADA ENZIMÁTICO', sku: 'LPE-003' },
  // HIFU 22D
  48: { grupo: 'HIFU 22D',              sku: 'H22-001' },
  49: { grupo: 'HIFU 22D',              sku: 'H22-002' },
  50: { grupo: 'HIFU 22D',              sku: 'H22-003' },
  51: { grupo: 'HIFU 22D',              sku: 'H22-004' },
  52: { grupo: 'HIFU 22D',              sku: 'H22-005' },
  // CARBOXITERAPIA
  74: { grupo: 'CARBOXITERAPIA',        sku: 'CRX-001' },
  75: { grupo: 'CARBOXITERAPIA',        sku: 'CRX-002' },
  76: { grupo: 'CARBOXITERAPIA',        sku: 'CRX-003' },
  77: { grupo: 'CARBOXITERAPIA',        sku: 'CRX-004' },
  // CORPORAL REDUCCION
  78: { grupo: 'CORPORAL REDUCCION',    sku: 'CRD-001' },
  79: { grupo: 'CORPORAL REDUCCION',    sku: 'CRD-002' },
  80: { grupo: 'CORPORAL REDUCCION',    sku: 'CRD-003' },
  81: { grupo: 'CORPORAL REDUCCION',    sku: 'CRD-004' },
  // CORPORAL GLUTEOS
  82: { grupo: 'CORPORAL GLUTEOS',      sku: 'CGL-001' },
  83: { grupo: 'CORPORAL GLUTEOS',      sku: 'CGL-002' },
  84: { grupo: 'CORPORAL GLUTEOS',      sku: 'CGL-003' },
  // CORPORAL REAFIRMACION
  85: { grupo: 'CORPORAL REAFIRMACION', sku: 'CRF-001' },
  86: { grupo: 'CORPORAL REAFIRMACION', sku: 'CRF-002' },
  87: { grupo: 'CORPORAL REAFIRMACION', sku: 'CRF-003' },
  88: { grupo: 'CORPORAL REAFIRMACION', sku: 'CRF-004' },
  // RESERVAS
  41: { grupo: 'RESERVAS',              sku: 'RES-001' },
  42: { grupo: 'RESERVAS',              sku: 'RES-002' },
}

/* ---------------- Procedures Supabase ---------------- */
async function fetchProcedures() {
  try {
    const { data, error } = await client
      .from('healup_procedures')
      .select('*')
      .order('id', { ascending: true })

    if (error) throw error

    // Aplicar configuración estática de grupos, SKUs y datos de hoja de cálculo
    const dbProcs = (data || []).map((p: any) => {
      const cfg = PROC_CONFIG[Number(p.id)]
      const def = getProcDefault(p.name)
      const resolvedGrupo = p.grupo || cfg?.grupo || def?.grupo || 'SIN GRUPO'
      return {
        ...p,
        sku:      p.sku      || cfg?.sku      || '',
        grupo:    resolvedGrupo,
        // Precio de la hoja de cálculo como respaldo si DB tiene 0 o null
        price:    (p.price != null && p.price > 0) ? p.price    : (def?.precioOrig ?? 0),
        discount: (p.discount != null)              ? p.discount : (def?.descuento  ?? 0),
        cabina:   p.cabina   || getCabinaFromGrupo(resolvedGrupo),
      }
    })

    // Registrar nombres que ya existen en DB
    const dbNames = new Set(dbProcs.map((p: any) => String(p.name || '').toLowerCase().trim()))

    // Construir lista completa desde PROC_SHEET_LIST — fuente de verdad de los 73 procedimientos
    let syntheticId = -1
    const syntheticProcs: Procedure[] = []
    for (const entry of PROC_SHEET_LIST) {
      const nameKey = entry.name.toLowerCase().trim()
      if (dbNames.has(nameKey)) continue
      syntheticProcs.push({
        id:       String(syntheticId--),
        name:     entry.name,
        color:    entry.color || '#3b82f6',
        price:    entry.precioOrig,
        discount: entry.descuento,
        sku:      entry.sku,
        grupo:    entry.grupo,
        cabina:   getCabinaFromGrupo(entry.grupo),
      } as Procedure)
    }

    procedures.value = [...dbProcs, ...syntheticProcs]

    // Inicializar procMeta con datos de la hoja de cálculo para TODOS los procedimientos
    procedures.value.forEach((p: Procedure) => {
      const def = getProcDefault(p.name)
      if (!procMeta[p.id] || (procMeta[p.id].duracion === 0 && def)) {
        procMeta[p.id] = {
          sesiones:    procMeta[p.id]?.sesiones ?? 0,
          costoInsumo: def?.costoInsumo  ?? procMeta[p.id]?.costoInsumo ?? 0,
          duracion:    def?.duracion     ?? procMeta[p.id]?.duracion    ?? 0,
          tiempoPrep:  def?.tiempoPrep   ?? procMeta[p.id]?.tiempoPrep  ?? 0,
          tiempoTotal: def?.tiempoTotal  ?? procMeta[p.id]?.tiempoTotal ?? 0,
          costoHH:     def?.costoHH      ?? procMeta[p.id]?.costoHH     ?? 0,
        }
      }
    })
  } catch (error) {
    console.error('Error loading procedures:', error)
  }
}

// ══════════════════════════════════════════════════════════════
// CONTADOR DE PROCEDIMIENTOS
// ══════════════════════════════════════════════════════════════

const contadorMes = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
const contadorSearch = ref('')

const contadorHeaders = [
  { title: 'SKU', key: 'sku', width: '90px' },
  { title: 'Procedimiento', key: 'name', sortable: true },
  { title: 'Grupo', key: 'grupo', sortable: true },
  { title: 'Cantidad', key: 'total', sortable: true, align: 'center' as const },
  { title: 'Ingreso Estimado', key: 'ingreso_estimado', sortable: true },
]

const mesesDisponibles = computed(() => {
  // 1) Meses con eventos reales en el calendario
  const set = new Set<string>()
  events.value.forEach(e => {
    const d = normalizeDateForCounter(e.date)
    if (/^\d{4}-\d{2}/.test(d)) set.add(d.slice(0, 7))
  })
  // 2) Asegurar al menos desde Ene 2026 hasta el mes actual
  const now = new Date()
  for (let y = 2026; y <= now.getFullYear(); y++) {
    const maxM = (y === now.getFullYear()) ? now.getMonth() + 1 : 12
    for (let m = 1; m <= maxM; m++) {
      set.add(`${y}-${String(m).padStart(2, '0')}`)
    }
  }
  return [...set]
    .sort((a, b) => b.localeCompare(a))
    .map(value => {
      const [y, m] = value.split('-')
      return { value, label: `${NOMBRES_MESES_LABEL[parseInt(m) - 1]} ${y}` }
    })
})

const contadorMesLabel = computed(() => {
  const found = mesesDisponibles.value.find(m => m.value === contadorMes.value)
  return found?.label ?? contadorMes.value
})

// Normaliza fecha para comparación (reutiliza lógica de fetchEvents)
function normalizeDateForCounter(raw: string): string {
  if (!raw) return ''
  const s = raw.split('T')[0]
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-')
    return `${y}-${m}-${d}`
  }
  return s
}

const contadorItems = computed(() => {
  const prefix = contadorMes.value // 'YYYY-MM'
  const counts: Record<string, number> = {}
  events.value.forEach(e => {
    const d = normalizeDateForCounter(e.date)
    if (d.startsWith(prefix) && e.procedureId) {
      const pid = String(e.procedureId)
      counts[pid] = (counts[pid] || 0) + 1
    }
  })
  return procedures.value
    .filter(p => counts[String(p.id)])
    .map(p => ({
      ...p,
      total: counts[String(p.id)] || 0,
      ingreso_estimado: (counts[String(p.id)] || 0) * (p.price || 0) * (1 - (p.discount || 0) / 100),
    }))
    .sort((a, b) => b.total - a.total)
})

const contadorGrupos = computed(() => {
  const groups: Record<string, number> = {}
  contadorItems.value.forEach(item => {
    const g = (item as any).grupo || 'SIN GRUPO'
    groups[g] = (groups[g] || 0) + item.total
  })
  return Object.entries(groups)
    .map(([grupo, total]) => ({ grupo, total }))
    .sort((a, b) => b.total - a.total)
})

// Colores por grupo para chips
const GRUPO_COLORS: Record<string, string> = {
  'FACIAL BASICO':        'teal',
  'FACIAL PREMIUM':       'cyan',
  'TRAT. MEDICO FACIAL':  'deep-purple',
  'MEDICINA ESTETICA':    'pink',
  'LIPO PAPADA ENZIMÁTICO': 'orange',
  'HIFU 22D':             'blue',
  'CARBOXITERAPIA':       'green',
  'CORPORAL REDUCCION':   'brown',
  'CORPORAL GLUTEOS':     'red',
  'CORPORAL REAFIRMACION':'indigo',
  'RESERVAS':             'grey',
}

function getGrupoColor(grupo: string): string {
  return GRUPO_COLORS[grupo] || 'default'
}

// ══════════════════════════════════════════════════════════════
// RECETA DE PROCEDIMIENTO
// ══════════════════════════════════════════════════════════════

const UNIDADES_RECETA = [
  'ml', 'cc', 'g', 'mg', 'unidad', 'vial', 'jeringa', 'ampolla',
  'gota', 'gotero', 'tubo', 'frasco', 'sobre', 'cápsula',
]

const recetaDialog = ref(false)
const recetaProcedure = ref<any>(null)
const recetaIngredientes = ref<any[]>([])
const recetaNewForm = reactive({ stock_item_id: null as any, cantidad: 1, unidad: 'ml' })

// Items formateados para el autocomplete de la receta
const stockItemsForReceta = computed(() =>
  stockItems.value.map(i => ({
    id: i.id,
    label: `${i.nombre}${i.categoria ? ' · ' + i.categoria : ''}`,
    unidad: i.unidad,
  }))
)

function getStockItemName(id: any): string {
  return stockItems.value.find(i => String(i.id) === String(id))?.nombre || `Insumo #${id}`
}

function getStockItemUnit(id: any): string {
  return stockItems.value.find(i => String(i.id) === String(id))?.unidad || ''
}

function getProcSupplyCount(procedureId: any): number {
  return procedureSupplies.value.filter(s => String(s.procedure_id) === String(procedureId)).length
}

async function openRecetaDialog(proc: any) {
  recetaProcedure.value = proc
  // Filtrar insumos de este procedimiento
  await fetchProcedureSupplies()
  recetaIngredientes.value = procedureSupplies.value
    .filter(s => String(s.procedure_id) === String(proc.id))
  Object.assign(recetaNewForm, { stock_item_id: null, cantidad: 1, unidad: 'ml' })
  recetaDialog.value = true
}

async function addRecetaIngrediente() {
  if (!recetaNewForm.stock_item_id || !recetaNewForm.cantidad || !recetaProcedure.value) return
  try {
    const payload = {
      procedure_id: recetaProcedure.value.id,
      stock_item_id: recetaNewForm.stock_item_id,
      cantidad_usada: recetaNewForm.cantidad,
      unidad: recetaNewForm.unidad || null,
    }
    const { error } = await (client.from('healup_procedure_supplies') as any).insert(payload)
    if (error) throw error
    await fetchProcedureSupplies()
    recetaIngredientes.value = procedureSupplies.value
      .filter(s => String(s.procedure_id) === String(recetaProcedure.value?.id))
    Object.assign(recetaNewForm, { stock_item_id: null, cantidad: 1, unidad: 'ml' })
  } catch (e) {
    console.error('addRecetaIngrediente:', e)
    alert('Error agregando insumo: ' + (e as any)?.message)
  }
}

async function deleteProcSupplyDirect(id: any) {
  if (!confirm('¿Quitar este insumo de la receta?')) return
  try {
    const { error } = await (client.from('healup_procedure_supplies') as any).delete().eq('id', id)
    if (error) throw error
    await fetchProcedureSupplies()
    recetaIngredientes.value = procedureSupplies.value
      .filter(s => String(s.procedure_id) === String(recetaProcedure.value?.id))
  } catch (e) {
    console.error('deleteProcSupplyDirect:', e)
  }
}

// ══════════════════════════════════════════════════════════════
// CONTROL DE STOCK
// ══════════════════════════════════════════════════════════════

interface StockItem {
  id: number | string
  nombre: string
  categoria?: string
  unidad: string
  cantidad_actual: number
  umbral_minimo: number
  costo_unitario?: number
  proveedor?: string
  notas?: string
}

interface StockMovement {
  id: number | string
  created_at: string
  stock_item_id: number | string
  tipo: 'entrada' | 'salida' | 'ajuste'
  cantidad: number
  motivo?: string
  event_id?: number | string
  procedure_id?: number | string
  notas?: string
  registrado_por?: string
  healup_stock_items?: { nombre: string }
}

interface ProcedureSupply {
  id: number | string
  procedure_id: number | string
  stock_item_id: number | string
  cantidad_usada: number
  notas?: string
}

const stockItems = ref<StockItem[]>([])
const stockMovements = ref<StockMovement[]>([])
const procedureSupplies = ref<ProcedureSupply[]>([])
const stockTab = ref('items')
const stockSearch = ref('')

// Dialogs
const stockItemDialog = ref(false)
const editingStockItem = ref<StockItem | null>(null)
const stockItemForm = reactive({
  nombre: '', categoria: '', unidad: 'unidad',
  cantidad_actual: 0, umbral_minimo: 5,
  costo_unitario: 0, proveedor: '', notas: '',
})

const stockMovementDialog = ref(false)
const stockMovementTargetId = ref<number | string | null>(null)
const stockMovementTargetName = ref('')
const stockMovementForm = reactive({
  tipo: 'entrada' as 'entrada' | 'salida' | 'ajuste',
  cantidad: 1, motivo: '', notas: '',
})

const procSupplyDialog = ref(false)
const procSupplyForm = reactive({
  procedure_id: null as any,
  stock_item_id: null as any,
  cantidad_usada: 1,
  notas: '',
})

// Table headers
const stockHeaders = [
  { title: 'Insumo', key: 'nombre', sortable: true },
  { title: 'Categoría', key: 'categoria', sortable: true },
  { title: 'Stock actual', key: 'cantidad_actual', sortable: true },
  { title: 'Alerta mínimo', key: 'umbral_minimo' },
  { title: 'Estado', key: 'estado', sortable: false },
  { title: 'Costo unitario', key: 'costo_unitario' },
  { title: 'Proveedor', key: 'proveedor' },
  { title: 'Acciones', key: 'actions', sortable: false, width: '120px' },
]

const movimientosHeaders = [
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Insumo', key: 'item_nombre', sortable: false },
  { title: 'Tipo', key: 'tipo', sortable: true },
  { title: 'Cantidad', key: 'cantidad', sortable: true },
  { title: 'Motivo', key: 'motivo' },
  { title: 'Notas', key: 'notas' },
]

const procSupplyHeaders = [
  { title: 'Procedimiento', key: 'procedure_name', sortable: true },
  { title: 'Insumo', key: 'item_name', sortable: true },
  { title: 'Cant. por sesión', key: 'cantidad_usada', align: 'center' as const },
  { title: 'Unidad', key: 'item_unidad' },
  { title: 'Notas', key: 'notas' },
  { title: 'Acciones', key: 'actions', sortable: false, width: '80px' },
]

// Computed
const lowStockAlerts = computed(() =>
  stockItems.value.filter(i => Number(i.cantidad_actual) <= Number(i.umbral_minimo))
)

const procedureSuppliesDisplay = computed(() =>
  procedureSupplies.value.map(ps => ({
    ...ps,
    procedure_name: procedures.value.find(p => String(p.id) === String(ps.procedure_id))?.name || `Proc #${ps.procedure_id}`,
    item_name: stockItems.value.find(i => String(i.id) === String(ps.stock_item_id))?.nombre || `Insumo #${ps.stock_item_id}`,
    item_unidad: stockItems.value.find(i => String(i.id) === String(ps.stock_item_id))?.unidad || 'u',
  }))
)

// Fetch functions
async function fetchStockData() {
  await Promise.all([fetchStockItems(), fetchStockMovements(), fetchProcedureSupplies()])
}

async function fetchStockItems() {
  try {
    const { data, error } = await (client.from('healup_stock_items') as any)
      .select('*').order('categoria').order('nombre')
    if (error) throw error
    stockItems.value = data || []
  } catch (e) {
    console.error('fetchStockItems:', e)
  }
}

async function fetchStockMovements() {
  try {
    const { data, error } = await (client.from('healup_stock_movements') as any)
      .select('*, healup_stock_items(nombre)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    stockMovements.value = data || []
  } catch (e) {
    console.error('fetchStockMovements:', e)
  }
}

async function fetchProcedureSupplies() {
  try {
    const { data, error } = await (client.from('healup_procedure_supplies') as any).select('*')
    if (error) throw error
    procedureSupplies.value = data || []
  } catch (e) {
    console.error('fetchProcedureSupplies:', e)
  }
}

// Dialog openers
function openStockItemDialog(item?: StockItem) {
  editingStockItem.value = item || null
  if (item) {
    Object.assign(stockItemForm, {
      nombre: item.nombre, categoria: item.categoria || '',
      unidad: item.unidad, cantidad_actual: item.cantidad_actual,
      umbral_minimo: item.umbral_minimo, costo_unitario: item.costo_unitario || 0,
      proveedor: item.proveedor || '', notas: item.notas || '',
    })
  } else {
    Object.assign(stockItemForm, {
      nombre: '', categoria: '', unidad: 'unidad',
      cantidad_actual: 0, umbral_minimo: 5,
      costo_unitario: 0, proveedor: '', notas: '',
    })
  }
  stockItemDialog.value = true
}

function openAddStockMovement(item: StockItem, tipo: 'entrada' | 'salida' | 'ajuste' = 'entrada') {
  stockMovementTargetId.value = item.id
  stockMovementTargetName.value = item.nombre
  Object.assign(stockMovementForm, { tipo, cantidad: 1, motivo: '', notas: '' })
  stockMovementDialog.value = true
}

function openProcSupplyDialog() {
  Object.assign(procSupplyForm, { procedure_id: null, stock_item_id: null, cantidad_usada: 1, notas: '' })
  procSupplyDialog.value = true
}

// Save / Delete functions
async function saveStockItem() {
  if (!stockItemForm.nombre) return
  try {
    const payload = { ...stockItemForm }
    if (editingStockItem.value) {
      const { error } = await (client.from('healup_stock_items') as any)
        .update(payload).eq('id', editingStockItem.value.id)
      if (error) throw error
    } else {
      const { error } = await (client.from('healup_stock_items') as any).insert(payload)
      if (error) throw error
    }
    stockItemDialog.value = false
    await fetchStockItems()
  } catch (e) {
    console.error('saveStockItem:', e)
    alert('Error guardando insumo: ' + (e as any)?.message)
  }
}

async function saveStockMovement() {
  if (!stockMovementTargetId.value || !stockMovementForm.cantidad) return
  try {
    const payload = {
      stock_item_id: stockMovementTargetId.value,
      tipo: stockMovementForm.tipo,
      cantidad: stockMovementForm.cantidad,
      motivo: stockMovementForm.motivo || null,
      notas: stockMovementForm.notas || null,
      registrado_por: currentUser.value?.email || 'usuario',
    }
    const { error } = await (client.from('healup_stock_movements') as any).insert(payload)
    if (error) throw error

    // Actualizar cantidad en stock_items
    const item = stockItems.value.find(i => String(i.id) === String(stockMovementTargetId.value))
    if (item) {
      const delta = stockMovementForm.tipo === 'entrada'
        ? stockMovementForm.cantidad
        : -stockMovementForm.cantidad
      const nuevaCantidad = Number(item.cantidad_actual) + delta
      await (client.from('healup_stock_items') as any)
        .update({ cantidad_actual: nuevaCantidad })
        .eq('id', item.id)
    }

    stockMovementDialog.value = false
    await fetchStockData()
  } catch (e) {
    console.error('saveStockMovement:', e)
    alert('Error registrando movimiento: ' + (e as any)?.message)
  }
}

async function saveProcSupply() {
  if (!procSupplyForm.procedure_id || !procSupplyForm.stock_item_id) return
  try {
    const { error } = await (client.from('healup_procedure_supplies') as any).insert({ ...procSupplyForm })
    if (error) throw error
    procSupplyDialog.value = false
    await fetchProcedureSupplies()
  } catch (e) {
    console.error('saveProcSupply:', e)
    alert('Error guardando relación: ' + (e as any)?.message)
  }
}

async function deleteStockItem(id: number | string) {
  if (!confirm('¿Eliminar este insumo y todos sus movimientos?')) return
  try {
    const { error } = await (client.from('healup_stock_items') as any).delete().eq('id', id)
    if (error) throw error
    await fetchStockItems()
  } catch (e) {
    console.error('deleteStockItem:', e)
    alert('Error eliminando: ' + (e as any)?.message)
  }
}

async function deleteProcSupply(id: number | string) {
  if (!confirm('¿Eliminar esta relación?')) return
  try {
    const { error } = await (client.from('healup_procedure_supplies') as any).delete().eq('id', id)
    if (error) throw error
    await fetchProcedureSupplies()
  } catch (e) {
    console.error('deleteProcSupply:', e)
  }
}

/* ---------------- Medical History Types ---------------- */
interface MedicalHistoryEntry {
  id: string
  name: string
  surname: string
  dni: string
  phone: string
  email?: string
  dateAdded: string
  attachmentName?: string
  attachmentData?: string // Base64 string for demo purposes
  returnNote?: string
  status?: string
}

/* ---------------- Medical History State ---------------- */
const medicalHistoryEntries = ref<MedicalHistoryEntry[]>([])
const selectedMedicalHistory = ref<MedicalHistoryEntry[]>([])
const medicalHistorySearch = ref('')
const showMedicalHistoryDialog = ref(false)
const editingMedicalHistory = ref<MedicalHistoryEntry | null>(null)
const medicalHistoryForm = ref<any>(null)
const medicalHistoryFormData = ref({
  name: '',
  surname: '',
  dni: '',
  phone: '',
  email: '',
  dateAdded: '',
  file: [] as any,
  existingFileName: '',
  returnNote: '',
  status: 'Activo'
})

const showMedicalProfileDialog = ref(false)
const selectedMedicalProfile = ref<MedicalHistoryEntry | null>(null)

/* ---------------- Consentimiento Informado (fase 2) ---------------- */
const showConsentimientoViewer = ref(false)
const selectedConsentimientoHistoria = ref<any | null>(null)

function openConsentimientoViewer(item: any) {
  selectedConsentimientoHistoria.value = item
  showConsentimientoViewer.value = true
}

async function onConsentimientoSaved(_id?: number) {
  // Recarga la lista de historia clínica + ambas listas de pacientes
  // (el form auto-crea el paciente nuevo en PacientesBDwppHEALUP cuando aplique)
  await Promise.all([
    fetchMedicalHistory(),
    fetchPacientesWpp(),
    fetchPacientesFbIg(),
    fetchPacientesTiktok()
  ])
}

/* ---------------- Modo Tablet (kiosk consentimiento) ---------------- */
const TABLET_MODE_KEY = 'healup_tablet_mode'
const tabletMode = ref(false)

function onTabletModeChange() {
  if (typeof window === 'undefined') return
  if (tabletMode.value) {
    localStorage.setItem(TABLET_MODE_KEY, '1')
    activeView.value = 'consentimiento'
  } else {
    localStorage.removeItem(TABLET_MODE_KEY)
  }
}

function exitTabletMode() {
  if (typeof window === 'undefined') return
  if (!confirm('¿Salir del modo tablet?\n\nTendrá que volver a activarlo desde "Mi Cuenta → Modo Tablet".')) return
  tabletMode.value = false
  localStorage.removeItem(TABLET_MODE_KEY)
  activeView.value = 'dashboard'
}

// Cargar el flag al montar (SSR-safe)
onMounted(() => {
  if (typeof window === 'undefined') return
  try {
    const flag = localStorage.getItem(TABLET_MODE_KEY)
    if (flag === '1') {
      tabletMode.value = true
      // Ir directo al consentimiento, salvo que el usuario haya navegado explícitamente
      // a otra vista vía hash/query (caso admin que quiere bypass).
      const params = new URLSearchParams(window.location.search)
      const bypass = params.get('admin') === '1'
      if (!bypass) activeView.value = 'consentimiento'
    }
  } catch { /* localStorage puede estar bloqueado */ }
})

function openMedicalProfileDialog(item: MedicalHistoryEntry) {
  selectedMedicalProfile.value = item
  showMedicalProfileDialog.value = true
}

function closeMedicalProfileDialog() {
  showMedicalProfileDialog.value = false
  selectedMedicalProfile.value = null
}

function openEventDialogFromHistory(item: MedicalHistoryEntry) {
  activeView.value = 'calendario'
  // Pre-fill form
  editingEvent.value = null
  eventFormData.value = {
    date: formatDateToISO(new Date()),
    time: '09:00',
    subject: `Cita Médica - ${item.name} ${item.surname}`,
    description: '',
    procedureId: '', // Requires manual selection
    clientName: item.name,
    clientSurname: item.surname,
    clientDNI: item.dni,
    clientPhone: item.phone,
    clientEmail: item.email || '',
    eventReason: 'Consulta'
  }
  showEventDialog.value = true
}

function openPatientFormFromHistory(item: MedicalHistoryEntry) {
  activeView.value = 'pacientes'
  selectedPatientType.value = 'wpp'
  editingPatient.value = null

  // Pre-fill form
  patientFormData.value = {
    nombre: `${item.name} ${item.surname}`.trim(),
    dni: item.dni,
    numero: item.phone,
    red_social: '',
    precio: '',
    precio_tratamiento: '',
    procedimiento: '',
    fecha_agendamiento: new Date().toISOString().slice(0, 16),
    metodo_de_pago: 'Ninguno',
    estado: item.status || 'Activo',
    agendamiento: 'IA'
  }
  
  showPatientFormDialog.value = true
}

const medicalHistoryHeaders = [
  { title: 'Fecha', key: 'dateAdded', sortable: true },
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Apellido', key: 'surname', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Estado', key: 'status', sortable: true },
  { title: 'Notas de devolución', key: 'returnNote', sortable: true },
  { title: 'Documento', key: 'attachment', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false }
]

/* ---------------- Profile Logic ---------------- */
const selectedPatientAppointments = computed(() => {
  if (!selectedMedicalProfile.value) return []
  const profileDni = selectedMedicalProfile.value.dni?.trim()
  const profilePhone = selectedMedicalProfile.value.phone?.trim()
  
  if (!profileDni && !profilePhone) return []

  // Filter events by matching DNI or Phone
  return events.value.filter(event => 
    (profileDni && event.clientDNI?.trim() === profileDni) ||
    (profilePhone && event.clientPhone?.trim() === profilePhone)
  ).sort((a, b) => {
    // Sort descending (latest first)
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
    return dateB.getTime() - dateA.getTime()
  })
})

const selectedPatientTreatments = computed(() => {
  if (!selectedMedicalProfile.value) return []
  const profileDni = selectedMedicalProfile.value.dni?.trim()
  const profilePhone = selectedMedicalProfile.value.phone?.trim()
  
  if (!profileDni && !profilePhone) return []

  // Filter patients by matching DNI or Phone
  return allPacientes.value.filter(patient => 
    (profileDni && patient.dni?.trim() === profileDni) ||
    (profilePhone && patient.numero?.trim() === profilePhone)
  ).sort((a, b) => {
    // Sort descending by fecha_agendamiento
    if (!a.fecha_agendamiento) return 1
    if (!b.fecha_agendamiento) return -1
    const dateA = new Date(a.fecha_agendamiento).getTime()
    const dateB = new Date(b.fecha_agendamiento).getTime()
    return dateB - dateA
  })
})

function getProcedureName(procedureId: string): string {
  if (!procedureId) return ''
  const procedure = procedures.value.find(p => p.id === procedureId)
  return procedure ? procedure.name : ''
}

/* ---------------- Medical History Functions ---------------- */
function openMedicalHistoryDialog() {
  editingMedicalHistory.value = null
  medicalHistoryFormData.value = {
    name: '',
    surname: '',
    dni: '',
    phone: '',
    email: '',
    dateAdded: new Date().toISOString().slice(0, 10),
    file: [],
    existingFileName: '',
    returnNote: '',
    status: 'Activo'
  }
  showMedicalHistoryDialog.value = true
}

function editMedicalHistory(item: MedicalHistoryEntry) {
  editingMedicalHistory.value = item
  medicalHistoryFormData.value = {
    name: item.name,
    surname: item.surname,
    dni: item.dni,
    phone: item.phone,
    email: item.email || '',
    dateAdded: item.dateAdded ? new Date(item.dateAdded).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    file: [],
    existingFileName: item.attachmentName || '',
    returnNote: item.returnNote || '',
    status: item.status || 'Activo'
  }
  showMedicalHistoryDialog.value = true
}

function closeMedicalHistoryDialog() {
  showMedicalHistoryDialog.value = false
  editingMedicalHistory.value = null
}

async function saveMedicalHistory() {
  const { valid } = await medicalHistoryForm.value.validate()

  if (!valid) return

  let attachmentData = ''
  let attachmentName = ''

  // Process file upload
  let fileToUpload: File | null = null
  const fileInput = medicalHistoryFormData.value.file

  if (Array.isArray(fileInput) && fileInput.length > 0) {
    fileToUpload = fileInput[0]
  } else if (fileInput && (fileInput as any).name) {
    fileToUpload = fileInput as File
  }

  if (fileToUpload) {
    attachmentName = fileToUpload.name
    // Convert to base64
    try {
      attachmentData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = error => reject(error)
        reader.readAsDataURL(fileToUpload!)
      })
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error al leer el archivo. Inténtalo de nuevo.')
      return
    }
  } else if (editingMedicalHistory.value) {
    // Keep existing file data if no new file is uploaded
    attachmentData = editingMedicalHistory.value.attachmentData || ''
    attachmentName = editingMedicalHistory.value.attachmentName || ''
  }

  try {
    const payload = {
      name: medicalHistoryFormData.value.name,
      surname: medicalHistoryFormData.value.surname,
      dni: medicalHistoryFormData.value.dni,
      phone: medicalHistoryFormData.value.phone,
      email: medicalHistoryFormData.value.email,
      date_added: medicalHistoryFormData.value.dateAdded,
      attachment_name: attachmentName,
      attachment_data: attachmentData,
      nota_de_devolucion: medicalHistoryFormData.value.returnNote,
      estado: medicalHistoryFormData.value.status
    }

    if (editingMedicalHistory.value) {
      // Update
      const { error } = await (client
        .from('healup_medical_history') as any)
        .update(payload)
        .eq('id', editingMedicalHistory.value.id)

      if (error) throw error
    } else {
      // Create - date_added handled by default
      const { error } = await (client
        .from('healup_medical_history') as any)
        .insert({
          ...payload
        })

      if (error) throw error
    }

    await fetchMedicalHistory()
    closeMedicalHistoryDialog()
  } catch (error) {
    console.error('Error saving medical history:', error)
    alert('Error al guardar el historial')
  }
}

async function deleteMultipleMedicalHistory() {
  if (selectedMedicalHistory.value.length === 0) return

  if (confirm(`¿Estás seguro de que deseas eliminar ${selectedMedicalHistory.value.length} registros?`)) {
    try {
      const selectedIds = selectedMedicalHistory.value.map(e => e.id)
      const { error } = await client
        .from('healup_medical_history')
        .delete()
        .in('id', selectedIds)

      if (error) throw error
      selectedMedicalHistory.value = [] // Clear selection
      await fetchMedicalHistory()
    } catch (error) {
      console.error('Error deleting multiple history:', error)
      alert('Error al eliminar registros')
    }
  }
}

async function deleteMedicalHistory(id: string) {
  if (confirm('¿Eliminar este historial médico?')) {
    try {
      const { error } = await client
        .from('healup_medical_history')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchMedicalHistory()
    } catch (error) {
      console.error('Error deleting medical history:', error)
      alert('Error al eliminar historial')
    }
  }
}


const previewUrl = ref<string | null>(null)
const previewType = ref<string>('')

function viewMedicalAttachment(item: MedicalHistoryEntry) {
  if (!item.attachmentData) return

  previewUrl.value = item.attachmentData
  // Simple heuristic for type based on name or data
  if (item.attachmentData.startsWith('data:image')) {
    previewType.value = 'image'
  } else {
    previewType.value = 'pdf' // Default to iframe safe types
  }
}

function closePreview() {
  previewUrl.value = null
  previewType.value = ''
}

function downloadMedicalAttachment(item: MedicalHistoryEntry) {
  if (!item.attachmentData) return

  const link = document.createElement('a')
  link.href = item.attachmentData
  link.download = item.attachmentName || 'documento.pdf'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// --- ONE-TIME SYNC UTILITY ---
const syncLoading = ref(false)

async function syncMissingMedicalHistory() {
  try {
    syncLoading.value = true
    console.log('Starting sync...')

    // 1. Fetch current History
    const { data: historyData, error: historyError } = await client
      .from('healup_medical_history')
      .select('dni')

    if (historyError) throw historyError
    const existingDnis = new Set(historyData?.map((h: any) => h.dni) || [])
    console.log('Existing History DNIs:', existingDnis)

    // 2. Fetch All Patients (refresh to be safe)
    await fetchPacientesWpp()
    await fetchPacientesFbIg()

    // 3. Filter Missing
    const missingPatients = allPacientes.value.filter(p => {
      if (!p.dni) return false
      return !existingDnis.has(p.dni)
    })

    console.log(`Found ${missingPatients.length} missing patients.`)

    if (missingPatients.length === 0) {
      alert('No faltan pacientes en el historial.')
      syncLoading.value = false
      return
    }

    // 4. Prepare Inserts
    const newHistoryEntries = missingPatients.map((p: any) => {
      // Split name safely
      const rawName = p.nombre || ''
      const nameParts = rawName.split(' ')
      const newName = nameParts[0] || 'Sin Nombre'
      const newSurname = nameParts.slice(1).join(' ') || ''
      const now = new Date().toISOString()

      return {
        name: newName,
        surname: newSurname,
        dni: p.dni,
        phone: p.numero,
        email: p.email || '',
        date_added: now,
        attachment_name: null,
        attachment_data: null
      }
    })

    // 5. Insert
    const { error: insertError } = await (client
      .from('healup_medical_history') as any)
      .insert(newHistoryEntries)

    if (insertError) throw insertError

    // 6. Refresh
    await fetchMedicalHistory()
    alert(`Se sincronizaron ${newHistoryEntries.length} pacientes al historial.`)

  } catch (err) {
    console.error('Error syncing history:', err)
    alert('Error al sincronizar historial. Revisa la consola.')
  } finally {
    syncLoading.value = false
  }
}

/* ---------------- Medical History Supabase ---------------- */
async function fetchMedicalHistory() {
  try {
    const { data, error } = await client
      .from('healup_medical_history')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error

    medicalHistoryEntries.value = (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      surname: e.surname,
      dni: e.dni,
      phone: e.phone,
      email: e.email,
      dateAdded: e.date_added,
      attachmentName: e.attachment_name,
      attachmentData: e.attachment_data,
      returnNote: e.nota_de_devolucion,
      status: e.estado,
      // Consentimiento informado (fase 2)
      edad: e.edad,
      txp: e.txp,
      tx_realizar: e.tx_realizar,
      doctor_nombre: e.doctor_nombre,
      consentimiento_aceptado: e.consentimiento_aceptado,
      consentimiento_tipo: e.consentimiento_tipo,
      consentimiento_payload: e.consentimiento_payload,
      consentimiento_fecha: e.consentimiento_fecha,
      firma_paciente: e.firma_paciente,
      firma_doctor: e.firma_doctor,
      dispositivo: e.dispositivo,
      como_nos_conocio: e.como_nos_conocio
    }))
  } catch (error) {
    console.error('Error loading medical history:', error)
  }
}

/* ---------------- Realtime Subscriptions ---------------- */
function setupRealtime() {
  client
    .channel('healup_calendar_events_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'healup_calendar_events' },
      (payload) => {
        console.log('Realtime update on calendar events:', payload)
        fetchEvents()
      }
    )
    .subscribe()
}

/* ---------------- Egresos Logic ---------------- */
const egresosList = ref<any[]>([])
const loadingEgresos = ref(false)
const showEgresoDialog = ref(false)
const editingEgreso = ref(false)
const savingEgreso = ref(false)
const todayISODate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isoToInputDate = (iso: string | null | undefined) => {
  if (!iso) return todayISODate()
  const d = new Date(iso)
  if (isNaN(d.getTime())) return todayISODate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// ── 2.4 Catálogos de categorías y métodos de pago de egresos ──
// Las columnas nuevas en egresos_healup son opcionales — los campos
// legacy (tipo_egreso, precio, cantidad) siguen siendo la fuente principal.
const EGRESO_CATEGORIAS = [
  { value: 'INSUMOS',       label: 'Insumos / Productos médicos', icon: 'mdi-medical-bag',     color: 'pink' },
  { value: 'DELIVERY',      label: 'Delivery / Envíos',           icon: 'mdi-truck',           color: 'blue' },
  { value: 'MARKETING',     label: 'Marketing (Meta / TikTok)',   icon: 'mdi-bullhorn',        color: 'purple' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento / Limpieza',    icon: 'mdi-broom',           color: 'orange' },
  { value: 'SUELDOS',       label: 'Sueldos / Honorarios',        icon: 'mdi-account-cash',    color: 'teal' },
  { value: 'OTROS',         label: 'Otros',                       icon: 'mdi-dots-horizontal', color: 'grey' },
]
const EGRESO_METODOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA_CREDITO', 'QR']
const EGRESO_UNIDADES = ['UI', 'ML', 'frascos', 'unidad', 'cajas', 'kg']

const egresoFormData = ref({
  id: '',
  tipo_egreso: '',
  nombre: '',
  precio: 0,
  cantidad: 1,
  fecha: todayISODate(),
  // Campos nuevos (2.4) — opcionales hasta que se aplique la migración SQL
  categoria: 'OTROS',
  metodo_pago: 'EFECTIVO',
  referencia: '',
  producto: '',
  unidad: 'unidad',
  precio_unitario: 0,
  descartado: false,
  company_id: 'healup'
})
// Filtros UI (chips)
const egresoCatFiltro = ref<string>('')
const egresoMetodoFiltro = ref<string>('')

const egresosHeaders = [
  { title: 'Fecha',      key: 'created_at',  width: '105px' },
  { title: 'Categoría',  key: 'categoria',   width: '160px' },
  { title: 'Nombre',     key: 'nombre' },
  { title: 'Método',     key: 'metodo_pago', width: '130px' },
  { title: 'Precio',     key: 'precio',      width: '90px',  align: 'end' as const },
  { title: 'Cantidad',   key: 'cantidad',    width: '70px',  align: 'end' as const },
  { title: 'Total',      key: 'total',       width: '110px', align: 'end' as const },
  { title: 'Acciones',   key: 'actions',     width: '90px',  sortable: false },
]

const fetchEgresos = async () => {
  loadingEgresos.value = true
  // Filtra deleted_at NULL si la columna existe; si no, la cláusula es no-op
  // gracias al fallback automático del SDK.
  const q = (client.from('egresos_healup') as any).select('*')
  // Intentamos filtrar deleted_at — si la columna no existe el query devuelve error,
  // entonces hacemos retry sin filtro.
  let data: any = null, error: any = null
  const r1 = await q.is('deleted_at', null).order('created_at', { ascending: false })
  if (r1.error) {
    const r2 = await (client.from('egresos_healup') as any).select('*').order('created_at', { ascending: false })
    data = r2.data; error = r2.error
  } else {
    data = r1.data; error = r1.error
  }
  if (!error && data) {
    egresosList.value = data
  }
  loadingEgresos.value = false
}

// ── Filtro mensual de egresos (viñeta) ───────────────────────────
const egresosMesSel = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

const egresosMesesDisponibles = computed(() => {
  const set = new Set<string>()
  egresosList.value.forEach(e => {
    if (!e.created_at) return
    const d = new Date(e.created_at)
    if (isNaN(d.getTime())) return
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  })
  // Asegurar mes actual presente
  const now = new Date()
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  return [...set]
    .sort((a, b) => b.localeCompare(a))
    .map(value => {
      const [y, m] = value.split('-')
      return { value, label: `${NOMBRES_MESES_LABEL[parseInt(m) - 1]} ${y}` }
    })
})

const egresosMesLabel = computed(() => {
  const found = egresosMesesDisponibles.value.find(m => m.value === egresosMesSel.value)
  return found?.label || egresosMesSel.value
})

const egresosFiltrados = computed(() => {
  return egresosList.value.filter(e => {
    if (e.descartado) return false
    if (egresosMesSel.value) {
      if (!e.created_at) return false
      const d = new Date(e.created_at)
      if (isNaN(d.getTime())) return false
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key !== egresosMesSel.value) return false
    }
    if (egresoCatFiltro.value && (e.categoria || 'OTROS') !== egresoCatFiltro.value) return false
    if (egresoMetodoFiltro.value && (e.metodo_pago || '') !== egresoMetodoFiltro.value) return false
    return true
  })
})

const egresosFiltradosTotal = computed(() =>
  egresosFiltrados.value.reduce((s, e) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
)

const totalEgresosMesActual = computed(() => {
  const now = new Date()
  const m = now.getMonth()
  const y = now.getFullYear()
  return egresosList.value.filter(e => {
    if (e.descartado) return false
    const d = new Date(e.created_at)
    return d.getMonth() === m && d.getFullYear() === y
  }).reduce((sum, e) => sum + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
})

const totalEgresosMesPasado = computed(() => {
  const now = new Date()
  let m = now.getMonth() - 1
  let y = now.getFullYear()
  if (m < 0) { m = 11; y-- }
  return egresosList.value.filter(e => {
    const d = new Date(e.created_at)
    return d.getMonth() === m && d.getFullYear() === y
  }).reduce((sum, e) => sum + (e.precio * e.cantidad), 0)
})

const gananciaNetaTotal = computed(() => {
  // Ingresos Brutos Totales - Egresos de este mes
  return revenueCurrentMonth.value - totalEgresosMesActual.value
})

const openEgresoDialog = (item?: any) => {
  if (item && item.id) {
    editingEgreso.value = true
    egresoFormData.value = {
      id: item.id,
      tipo_egreso: item.tipo_egreso || '',
      nombre: item.nombre || '',
      precio: Number(item.precio) || 0,
      cantidad: Number(item.cantidad) || 1,
      fecha: isoToInputDate(item.created_at),
      categoria: item.categoria || 'OTROS',
      metodo_pago: item.metodo_pago || 'EFECTIVO',
      referencia: item.referencia || '',
      producto: item.producto || '',
      unidad: item.unidad || 'unidad',
      precio_unitario: Number(item.precio_unitario) || 0,
      descartado: !!item.descartado,
      company_id: 'healup'
    }
  } else {
    editingEgreso.value = false
    egresoFormData.value = {
      id: '', tipo_egreso: '', nombre: '', precio: 0, cantidad: 1,
      fecha: todayISODate(),
      categoria: 'OTROS', metodo_pago: 'EFECTIVO', referencia: '',
      producto: '', unidad: 'unidad', precio_unitario: 0, descartado: false,
      company_id: 'healup'
    }
  }
  showEgresoDialog.value = true
}

const closeEgresoDialog = () => {
  showEgresoDialog.value = false
}

const saveEgreso = async () => {
  savingEgreso.value = true
  const fd = egresoFormData.value
  const fechaIso = fd.fecha ? new Date(`${fd.fecha}T12:00:00`).toISOString() : null
  const esInsumo = fd.categoria === 'INSUMOS'
  // Si llena precio_unitario en INSUMOS, lo usa como `precio` para que el
  // total y los reportes sigan funcionando con la lógica vieja.
  const precioFinal = esInsumo && Number(fd.precio_unitario) > 0
    ? Number(fd.precio_unitario)
    : Number(fd.precio) || 0

  // Payload base: SIEMPRE incluye los campos legacy (no rompe nada).
  const payload: any = {
    tipo_egreso: fd.tipo_egreso || fd.categoria,  // fallback legacy
    nombre: fd.nombre,
    precio: precioFinal,
    cantidad: Number(fd.cantidad) || 1,
    company_id: 'healup'
  }
  // Campos nuevos (2.4) — solo se incluyen si la migración SQL ya corrió.
  // Si la columna no existe en BD, el insert los ignora silenciosamente
  // gracias al SDK de Supabase (PostgREST devuelve error parsing y hacemos retry).
  const camposNuevos: any = {
    categoria:       fd.categoria,
    metodo_pago:     fd.metodo_pago,
    referencia:      fd.referencia || null,
    producto:        esInsumo ? (fd.producto || null) : null,
    unidad:          esInsumo ? (fd.unidad || null)   : null,
    precio_unitario: esInsumo ? (Number(fd.precio_unitario) || null) : null,
    descartado:      !!fd.descartado,
  }
  if (fechaIso) payload.created_at = fechaIso

  const tryWrite = async (extraFields: any) => {
    const fullPayload = { ...payload, ...extraFields }
    if (editingEgreso.value && fd.id) {
      return (client.from('egresos_healup') as any).update(fullPayload).eq('id', fd.id)
    } else {
      return (client.from('egresos_healup') as any).insert(fullPayload)
    }
  }
  // Intenta con campos nuevos. Si falla por columnas faltantes, retry sin ellos.
  let r = await tryWrite(camposNuevos)
  if (r.error) {
    console.warn('[egreso] retry sin campos nuevos:', r.error.message)
    r = await tryWrite({})
  }
  if (r.error) {
    alert(`Error guardando egreso:\n${r.error.message}`)
  }

  savingEgreso.value = false
  closeEgresoDialog()
  fetchEgresos()
}

const deleteEgreso = async (id: string) => {
  if (!confirm('¿Eliminar este egreso?\n\n(Si la migración SQL aplica, será soft-delete con deleted_at; si no, se elimina físicamente.)')) return
  // Intenta soft-delete. Si la columna no existe, hard-delete.
  const r1 = await (client.from('egresos_healup') as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (r1.error) {
    await (client.from('egresos_healup') as any).delete().eq('id', id)
  }
  fetchEgresos()
}

/* =============================================
   2.13 Cierre mensual + 2.3 Reconciliación caja
   ============================================= */
const cierreMesSel = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

const cierreMesesDisponibles = computed(() => {
  const set = new Set<string>()
  ;[...pacientesWpp.value, ...pacientesFbIg.value].forEach((p: any) => {
    if (p.fecha_agendamiento && /^\d{4}-\d{2}/.test(p.fecha_agendamiento)) {
      set.add(p.fecha_agendamiento.slice(0, 7))
    }
  })
  egresosList.value.forEach((e: any) => {
    if (e.created_at) {
      const d = new Date(e.created_at)
      if (!isNaN(d.getTime())) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  })
  const now = new Date()
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  return [...set].sort((a, b) => b.localeCompare(a)).map(value => {
    const [y, m] = value.split('-')
    return { value, label: `${NOMBRES_MESES_LABEL[parseInt(m) - 1]} ${y}` }
  })
})

const cierrePacientesDelMes = computed(() => {
  const m = cierreMesSel.value
  const wpp = pacientesWpp.value.filter((p: any) => p.fecha_agendamiento?.startsWith(m))
  const fbig = pacientesFbIg.value.filter((p: any) => p.fecha_agendamiento?.startsWith(m))
  return { wpp, fbig }
})

const cierreIngresos = computed(() => {
  const { wpp, fbig } = cierrePacientesDelMes.value
  const sumPac = (arr: any[]) => arr.reduce((s, p) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)
  return sumPac(wpp) + sumPac(fbig)
})

// Misma lógica de filtrado que la vista Egresos — garantiza que el cierre
// muestre exactamente los mismos movimientos del mes seleccionado.
const cierreEgresosFiltrados = computed(() => {
  if (!cierreMesSel.value) return []
  return egresosList.value.filter((e: any) => {
    if (e.descartado) return false
    if (e.deleted_at) return false
    if (!e.created_at) return false
    const d = new Date(e.created_at)
    if (isNaN(d.getTime())) return false
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return key === cierreMesSel.value
  })
})
const cierreEgresos = computed(() =>
  cierreEgresosFiltrados.value.reduce((s, e) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
)
const cierreEgresosCount = computed(() => cierreEgresosFiltrados.value.length)
const cierreUtilidad = computed(() => cierreIngresos.value - cierreEgresos.value)
const cierrePacientes = computed(() => {
  const { wpp, fbig } = cierrePacientesDelMes.value
  return wpp.length + fbig.length
})

const cierrePorFuente = computed(() => {
  const r: Record<string, number> = {}
  const { wpp, fbig } = cierrePacientesDelMes.value
  wpp.forEach((p: any) => {
    const f = !p.numero || isEncrypted(p.numero) ? 'TikTok' : 'WhatsApp'
    r[f] = (r[f] || 0) + 1
  })
  fbig.forEach((p: any) => {
    const rs = String(p.red_social || '').toLowerCase()
    const f = rs.includes('facebook') ? 'Facebook' : 'Instagram'
    r[f] = (r[f] || 0) + 1
  })
  return r
})

const cierreEgresosPorCategoria = computed(() => {
  const map: Record<string, { count: number; total: number }> = {}
  cierreEgresosFiltrados.value.forEach((e: any) => {
    const cat = e.categoria || 'OTROS'
    if (!map[cat]) map[cat] = { count: 0, total: 0 }
    map[cat].count++
    map[cat].total += (Number(e.precio) || 0) * (Number(e.cantidad) || 0)
  })
  return Object.entries(map).map(([categoria, v]) => ({ categoria, ...v })).sort((a, b) => b.total - a.total)
})

const exportarCierreMensualPDF = () => {
  if (!import.meta.client) return
  const win = window.open('', '_blank')
  if (!win) return
  const fmt = (n: number) => 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2 })
  const mesLabel = cierreMesesDisponibles.value.find(x => x.value === cierreMesSel.value)?.label || cierreMesSel.value
  const fuenteRows = Object.entries(cierrePorFuente.value).map(([f, c]) => `<tr><td>${f}</td><td>${c}</td></tr>`).join('')
  const egRows = cierreEgresosPorCategoria.value.map(e => `<tr><td>${e.categoria}</td><td>${e.count}</td><td>${fmt(e.total)}</td></tr>`).join('')
  win.document.write(`<!DOCTYPE html><html><head><title>Cierre ${mesLabel}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#222;}h1{font-size:1.6rem;margin-bottom:0;}h2{font-size:1.1rem;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px;}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:0.92rem;}th,td{padding:6px 10px;border-bottom:1px solid #eee;text-align:left;}th{background:#f5f5f5;}.kpi{display:flex;gap:16px;margin:12px 0;}.kpi>div{flex:1;padding:12px;background:#f9f9f9;border-radius:6px;}.kpi h3{margin:0;font-size:0.78rem;color:#666;text-transform:uppercase;}.kpi b{font-size:1.4rem;}@media print{body{margin:0;}}</style>
    </head><body>
    <h1>Cierre Mensual — Healup</h1>
    <div style="opacity:0.7;font-size:0.92rem;">${mesLabel}</div>
    <div class="kpi">
      <div><h3>Ingresos</h3><b style="color:#22c55e;">${fmt(cierreIngresos.value)}</b><br><small>${cierrePacientes.value} pacientes</small></div>
      <div><h3>Egresos</h3><b style="color:#ef4444;">${fmt(cierreEgresos.value)}</b><br><small>${cierreEgresosCount.value} movimientos</small></div>
      <div><h3>Utilidad</h3><b style="color:#3b82f6;">${fmt(cierreUtilidad.value)}</b></div>
    </div>
    <h2>Pacientes por fuente</h2>
    <table><tr><th>Fuente</th><th>Cantidad</th></tr>${fuenteRows}</table>
    <h2>Egresos por categoría</h2>
    <table><tr><th>Categoría</th><th>Movimientos</th><th>Total</th></tr>${egRows}</table>
    <p style="margin-top:32px;opacity:0.5;font-size:0.78rem;">Generado el ${new Date().toLocaleString('es-PE')} — Cmd+P → Guardar como PDF.</p>
  </body></html>`)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

// 2.3 Reconciliación caja: ingresos por método (mes actual)
const ingresosEfectivoMesActual = computed(() => {
  const now = new Date()
  const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return [...pacientesWpp.value, ...pacientesFbIg.value]
    .filter((p: any) => p.fecha_agendamiento?.startsWith(m) && (p.metodo_de_pago || '').toUpperCase() === 'EFECTIVO')
    .reduce((s, p) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)
})
const ingresosNoEfectivoMesActual = computed(() => {
  const now = new Date()
  const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return [...pacientesWpp.value, ...pacientesFbIg.value]
    .filter((p: any) => {
      if (!p.fecha_agendamiento?.startsWith(m)) return false
      const mp = (p.metodo_de_pago || '').toUpperCase()
      return mp && mp !== 'EFECTIVO'
    })
    .reduce((s, p) => s + (Number(p.precio) || 0) + (Number(p.precio_tratamiento) || 0), 0)
})

const egresosEfectivoMesActual = computed(() => {
  const now = new Date()
  const m = now.getMonth(); const y = now.getFullYear()
  return egresosList.value.filter((e: any) => {
    if (e.descartado || e.deleted_at) return false
    const d = new Date(e.created_at)
    return d.getMonth() === m && d.getFullYear() === y && (e.metodo_pago || '').toUpperCase() === 'EFECTIVO'
  }).reduce((s, e) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
})
const egresosNoEfectivoMesActual = computed(() => {
  const now = new Date()
  const m = now.getMonth(); const y = now.getFullYear()
  return egresosList.value.filter((e: any) => {
    if (e.descartado || e.deleted_at) return false
    const d = new Date(e.created_at)
    if (!(d.getMonth() === m && d.getFullYear() === y)) return false
    const mp = (e.metodo_pago || '').toUpperCase()
    return mp && mp !== 'EFECTIVO'
  }).reduce((s, e) => s + (Number(e.precio) || 0) * (Number(e.cantidad) || 0), 0)
})

const saldoCajaChica       = computed(() => ingresosEfectivoMesActual.value - egresosEfectivoMesActual.value)
const saldoCuentaBancaria  = computed(() => ingresosNoEfectivoMesActual.value - egresosNoEfectivoMesActual.value)

const saldoRealCajaChica       = ref(0)
const saldoRealCuentaBancaria  = ref(0)
const cerrandoDia              = ref(false)
const cierreDiaResultado       = ref<{ fecha: string; detalle: string } | null>(null)

const cerrarDia = async () => {
  cerrandoDia.value = true
  try {
    const audit = useHealupAudit()
    const fecha = new Date().toISOString().slice(0, 10)
    const detalle = [
      `📊 Cierre del día ${fecha}`,
      ``,
      `Caja chica (calc.): S/ ${saldoCajaChica.value.toFixed(2)}`,
      `Caja chica (real) : S/ ${saldoRealCajaChica.value.toFixed(2)}`,
      `Diferencia caja   : S/ ${(saldoRealCajaChica.value - saldoCajaChica.value).toFixed(2)}`,
      ``,
      `Cuenta (calc.): S/ ${saldoCuentaBancaria.value.toFixed(2)}`,
      `Cuenta (real) : S/ ${saldoRealCuentaBancaria.value.toFixed(2)}`,
      `Diferencia cuenta : S/ ${(saldoRealCuentaBancaria.value - saldoCuentaBancaria.value).toFixed(2)}`,
    ].join('\n')
    await audit.log({
      entidad: 'cita', accion: 'state_change', campo: 'cierre_dia',
      valor_despues: {
        fecha,
        caja_calc: saldoCajaChica.value, caja_real: saldoRealCajaChica.value,
        cuenta_calc: saldoCuentaBancaria.value, cuenta_real: saldoRealCuentaBancaria.value
      },
      notas: 'Cierre de día con cuadre manual'
    })
    cierreDiaResultado.value = { fecha, detalle }
  } catch (e: any) {
    alert(`Error al cerrar día: ${e?.message || e}`)
  } finally {
    cerrandoDia.value = false
  }
}

// =============================================
// META ADS
// =============================================

const metaResumen = ref<any[]>([])
const metaCampanas = ref<any[]>([])
const loadingMeta = ref(false)
const mesSeleccionadoMeta = ref('2026-04-01')

const metaMesLabel = (mes: string) => {
  if (!mes) return mes
  const d = new Date(mes + 'T12:00:00Z')
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }).toUpperCase().replace('.', '')
}

const fmtNum = (n: any) =>
  parseFloat(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNumInt = (n: any) =>
  (parseInt(n || 0) || 0).toLocaleString('es-PE')

const mesActualMeta = computed(() =>
  metaResumen.value.find((r) => r.mes === mesSeleccionadoMeta.value) || null
)

const campanasSinSaleMes = computed(() =>
  metaCampanas.value.filter(
    (c) =>
      c.mes?.substring(0, 7) === mesSeleccionadoMeta.value?.substring(0, 7) &&
      c.tipo === 'sin_sale'
  )
)

const campanasSaleMes = computed(() =>
  metaCampanas.value.filter(
    (c) =>
      c.mes?.substring(0, 7) === mesSeleccionadoMeta.value?.substring(0, 7) &&
      c.tipo === 'sale'
  )
)

const metaChartOptions = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    fontFamily: 'inherit',
  },
  colors: ['#1877F2', '#daa520'],
  plotOptions: {
    bar: { columnWidth: '55%', borderRadius: 4 },
  },
  dataLabels: { enabled: false },
  stroke: { width: [0, 3], curve: 'smooth' },
  xaxis: {
    categories: metaResumen.value.map((r) => metaMesLabel(r.mes)),
    labels: { style: { colors: '#888', fontSize: '0.75rem' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: [
    {
      title: { text: 'Inversión (S/)', style: { color: '#888', fontSize: '0.72rem' } },
      labels: { style: { colors: '#888', fontSize: '0.72rem' }, formatter: (v: number) => 'S/ ' + v.toLocaleString('es-PE') },
    },
    {
      opposite: true,
      title: { text: 'Leads', style: { color: '#888', fontSize: '0.72rem' } },
      labels: { style: { colors: '#888', fontSize: '0.72rem' } },
    },
  ],
  legend: { labels: { colors: '#aaa' } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  tooltip: {
    theme: 'dark',
    y: [
      { formatter: (v: number) => 'S/ ' + v.toLocaleString('es-PE', { minimumFractionDigits: 2 }) },
      { formatter: (v: number) => v + ' leads' },
    ],
  },
}))

const metaChartSeries = computed(() => [
  {
    name: 'Inversión',
    type: 'bar',
    data: metaResumen.value.map((r) => parseFloat(r.inversion_total) || 0),
  },
  {
    name: 'Leads',
    type: 'line',
    data: metaResumen.value.map((r) => parseInt(r.leads_totales) || 0),
  },
])

const fetchMetaData = async () => {
  loadingMeta.value = true
  try {
    const [{ data: resumen }, { data: campanas }] = await Promise.all([
      (client.from('healup_meta_resumen_mensual') as any)
        .select('*')
        .order('mes', { ascending: true }),
      (client.from('healup_meta_campanas') as any)
        .select('*')
        .order('mes', { ascending: true }),
    ])
    metaResumen.value = resumen || []
    metaCampanas.value = campanas || []
    if (resumen?.length) {
      mesSeleccionadoMeta.value = resumen[resumen.length - 1].mes
    }
  } finally {
    loadingMeta.value = false
  }
}

onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase() // Deprecated

  // Verificamos pasando el objeto completo de sesión (currentUser.value)
  if (!canAccessHealup(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }


  applyTheme()
  fetchBoleteoStatus()
  fetchPacientesWpp()
  fetchPacientesFbIg()
  fetchPacientesTiktok()
  fetchCompras()
  fetchLeads()
  handleZoom('Mes')
  fetchWorkingHours()
  fetchEvents()
  // Auto-sync Google Calendar desactivado (duplicaba y cambiaba horas de citas)
  // fetchEvents().then(() => { syncGCalToCalendar() })
  fetchProcedures()
  fetchMedicalHistory()
  fetchEgresos()
  fetchStockData()
  fetchMetaData()
  fetchComprobantesPse()
  setupRealtime()
})
</script>
