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
          <div class="nav-label">Financias</div>
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
              @click="() => { fetchPacientesWpp(); fetchPacientesFbIg(); fetchCompras(); fetchLeads(); }">
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
          <div style="display: flex; gap: 10px;">
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
                <div class="d-flex justify-space-between align-center px-1" style="width: 100%;">
                  <span class="day-number">{{ day.day }}</span>
                  <v-chip
                    v-if="day.isWorkingDay && day.isCurrentMonth"
                    size="x-small"
                    :color="day.availableSlots > 0 ? 'success' : 'error'"
                    variant="flat"
                    style="font-size: 10px; height: 18px;"
                  >
                    {{ day.availableSlots > 0 ? `${day.availableSlots} disp.` : 'Lleno' }}
                  </v-chip>
                </div>
                <div v-if="day.events.length > 0" class="event-list-in-day mt-1">
                  <div v-for="(event, eventIndex) in day.events.slice(0, 2)" :key="eventIndex" class="event-line"
                    :style="{ backgroundColor: getProcedureColor(event.procedureId) }" :title="event.subject">
                    <span class="event-line-text">{{ event.subject }}</span>
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

          <div class="table-section">
            <!-- Table 1: WhatsApp -->
            <v-card flat class="custom-data-table" style="margin-bottom: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de pacientes whatsapp</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Buscar" single-line hide-details
                  density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersPacientesWpp" :items="pacientesWpp" :search="search" :loading="loading"
                class="elevation-0" no-data-text="No hay pacientes de WhatsApp">
                <template v-slot:item.precio="{ item }">
                  S/ {{ item.precio }}
                </template>
                <template v-slot:item.precio_tratamiento="{ item }">
                  S/ {{ item.precio_tratamiento }}
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
                  <button class="icon-btn" @click="openPatientForm(item, 'wpp')">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deletePatient(item, 'wpp')">
                    <v-icon icon="mdi-delete" size="16" />
                  </button>
                </template>
              </v-data-table>
            </v-card>

            <!-- Table 2: Facebook e Instagram -->
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de pacientes Facebook e Instagram</span>
                <!-- Optional: Separate search for this table or shared? Assuming shared for now or just visual separation -->
              </v-card-title>
              <v-data-table :headers="headersPacientesFbIg" :items="pacientesFbIg" :search="search" :loading="loading"
                class="elevation-0" no-data-text="No hay pacientes de FB/IG">
                <template v-slot:item.precio="{ item }">
                  S/ {{ item.precio }}
                </template>
                <template v-slot:item.precio_tratamiento="{ item }">
                  S/ {{ item.precio_tratamiento }}
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
                  <button class="icon-btn" @click="openPatientForm(item, 'fbig')">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deletePatient(item, 'fbig')">
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
          <div class="stats-grid five-columns">
            <div class="stat-card">
              <div class="stat-value">{{ totalLeadsCount }}</div>
              <div class="stat-title">Total Leads</div>
              <div class="stat-change" :class="leadsGrowthStat >= 0 ? 'up' : 'down'">
                {{ leadsGrowthStat >= 0 ? '+' : '' }}{{ leadsGrowthStat.toFixed(1) }}% this month
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #3b82f6">{{ coldLeadsCount }}</div>
              <div class="stat-title">Leads Fríos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #f59e0b">{{ warmLeadsCount }}</div>
              <div class="stat-title">Leads Tibios</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #ef4444">{{ hotLeadsCount }}</div>
              <div class="stat-title">Leads Calientes</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ conversionRate.toFixed(1) }}%</div>
              <div class="stat-title">Tasa Conversión</div>
              <div class="stat-change up">
                (Calientes/Total)
              </div>
            </div>
          </div>

          <div class="table-section">
            <!-- Table 1: WhatsApp -->
            <v-card flat class="custom-data-table" style="margin-bottom: 2rem;">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de leads whatsapp</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="leadsSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersLeadsWpp" :items="leadsWpp" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads de WhatsApp">
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
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <!-- Using same search for both for now, or could split search logic if requested. Assuming global search for Leads view. -->
                <span class="table-title">Lista de leads Facebook e Instagram</span>
              </v-card-title>
              <v-data-table :headers="headersLeadsFbIg" :items="leadsFbIg" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads de FB/IG">
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
              <h3>Comparativa de Leads</h3>
              <client-only>
                <div id="chart">
                  <apexchart type="bar" height="350" :options="leadsChartOptions" :series="leadsChartSeries">
                  </apexchart>
                </div>
              </client-only>
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
            <button class="btn-primary" @click="() => { fetchPacientesWpp(); fetchPacientesFbIg(); }">
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
              <div class="stat-title">Ingresos Totales</div>
              <div class="stat-value">S/ {{ revenueCurrentMonth.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Histórico Acumulado</div>
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
                <v-text-field v-model="procedureSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="procedureHeaders" :items="procedures" :search="procedureSearch"
                :items-per-page="10" class="elevation-0" no-data-text="No hay procedimientos creados">
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

      <!-- ==========  VISTA: CUENTA  ========== -->
      <div v-else-if="activeView === 'cuenta'" class="view-container">
        <header class="top-header">
          <h1>Mi Cuenta</h1>
        </header>
        <div class="content-area">
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

    </div>

    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->

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

            <v-select v-model="eventFormData.procedureId" label="Procedimiento" :items="procedures" item-title="name"
              item-value="id" variant="outlined" density="compact"
              :rules="[v => !!v || 'Debe seleccionar un procedimiento']">
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <div class="color-preview mr-2" :style="{ backgroundColor: item.raw.color }"></div>
                  </template>
                </v-list-item>
              </template>
              <template v-slot:selection="{ item }">
                <div class="d-flex align-center">
                  <div class="color-preview mr-2"
                    :style="{ backgroundColor: item.raw.color, width: '20px', height: '20px' }"></div>
                  <span>{{ item.raw.name }}</span>
                </div>
              </template>
            </v-select>

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
              <div>
                <div class="detail-label">Fecha y Hora</div>
                <div class="detail-value">{{ formatEventDate(selectedEvent.date) }} - {{ selectedEvent.time }}</div>
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
          </div>
        </v-card-text>

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
            <v-text-field v-model="procedureFormData.name" label="Nombre del Procedimiento" variant="outlined"
              density="compact" :rules="[v => !!v || 'El nombre es requerido']"></v-text-field>

            <div class="mt-4 mb-2">
              <label class="form-label">Color del Procedimiento</label>
              <v-color-picker v-model="procedureFormData.color" mode="hex" width="100%" elevation="0"
                hide-inputs></v-color-picker>
              <v-text-field v-model="procedureFormData.color" label="Código de color" variant="outlined"
                density="compact" readonly class="mt-2"></v-text-field>
            </div>

            <v-text-field v-model.number="procedureFormData.price" label="Precio" type="number" variant="outlined"
              density="compact" prefix="S/" :rules="[v => v >= 0 || 'El precio debe ser mayor o igual a 0']"
              step="0.01"></v-text-field>

            <v-text-field v-model.number="procedureFormData.discount" label="Descuento (%)" type="number"
              variant="outlined" density="compact" suffix="%" :rules="[v => v >= 0 && v <= 100 || 'El descuento debe estar entre 0 y 100']"></v-text-field>

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

    <!-- ==========  PATIENT TYPE SELECTION DIALOG  ========== -->
    <v-dialog v-model="showPatientTypeDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5 text-center pa-4">
          Seleccionar Origen del Paciente
        </v-card-title>
        <v-card-text class="pa-4">
          <v-row>
            <v-col cols="6">
              <v-card hover @click="selectPatientType('wpp')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
                <v-icon icon="mdi-whatsapp" size="48" color="success"></v-icon>
                <span class="text-h6">WhatsApp</span>
              </v-card>
            </v-col>
            <v-col cols="6">
              <v-card hover @click="selectPatientType('fbig')" class="text-center pa-4 cursor-pointer" height="100%"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
                <v-icon icon="mdi-facebook" size="48" color="primary"></v-icon>
                <span class="text-h6">FB / IG</span>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ==========  SCHEDULE CONFIG DIALOG  ========== -->
    <v-dialog v-model="showScheduleDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>Configurar Horario de Atención</span>
          <v-btn icon="mdi-close" variant="text" @click="closeScheduleDialog"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="scheduleForm">
            <v-text-field v-model.number="workingHours.slot_duration_minutes" label="Duración de cita (min)" type="number" variant="outlined" density="compact" :rules="[v => v > 0 || 'Min > 0']" class="mb-4"></v-text-field>
            
            <div class="text-subtitle-1 font-weight-bold mb-3">Horario por Día:</div>
            <v-row v-for="(dayConfig, i) in workingHours.schedule_json" :key="i" class="align-center mb-1" dense>
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

            <v-select v-model="patientFormData.procedimiento" label="Procedimiento" :items="procedures"
              item-title="name" item-value="name" variant="outlined" density="compact"></v-select>

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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'

const { logActivity } = useActivityLogger()
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessHealup, dashboards } from '@/utils/permissions'
import SettingsView from '@/components/Settings/SettingsView.vue'

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
const pacientesWpp = ref<any[]>([])
const pacientesFbIg = ref<any[]>([])
const compras = ref<any[]>([])
const leadsWpp = ref<any[]>([])
const leadsFbIg = ref<any[]>([])
const leads = computed(() => [...leadsWpp.value, ...leadsFbIg.value])
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
  { title: 'Precio de reserva', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Precio Tratamiento', key: 'precio_tratamiento', sortable: true },
  { title: 'Fecha de Agendamiento', key: 'fecha_agendamiento', sortable: true },
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
  { title: 'Precio de reserva', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Precio Tratamiento', key: 'precio_tratamiento', sortable: true },
  { title: 'Fecha de Agendamiento', key: 'fecha_agendamiento', sortable: true },
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
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Número', key: 'numero', sortable: true, width: '150px', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

const headersLeadsFbIg = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Instagram', key: 'instagram_handle', sortable: true, width: '150px', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Interés', key: 'servicio_interes', sortable: true, width: '250px', align: 'start' as const },
])

const headersLeads = ref([
  { title: 'ID', key: 'id', sortable: true, width: '80px', align: 'start' as const },
  { title: 'Nombre', key: 'nombre', sortable: true, width: '20%', align: 'start' as const },
  { title: 'Estado', key: 'lead_status', sortable: true, width: '120px', align: 'start' as const },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true, width: '20%', align: 'start' as const },
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
    const { data, error } = await (client
      .from('GeneralBDwppHEALUP')
      .select('*') as any)
      .order('id', { ascending: false })

    if (error) throw error
    leadsWpp.value = data as any[] || []
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

const fetchLeads = async () => {
  loadingLeads.value = true
  await Promise.all([fetchLeadsWpp(), fetchLeadsFbIg()])
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
  fecha_agendamiento: '',
  metodo_de_pago: 'Ninguno',
  estado: 'Activo',
  agendamiento: 'IA'
})

const openPatientTypeDialog = () => {
  showPatientTypeDialog.value = true
}

const selectPatientType = (type: 'wpp' | 'fbig') => {
  selectedPatientType.value = type
  showPatientTypeDialog.value = false
  openPatientForm(null, type)
}

const openPatientForm = (item: any | null, type: 'wpp' | 'fbig') => {
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

    const commonPayload = {
      nombre: patientFormData.value.nombre,
      dni: patientFormData.value.dni,
      numero: patientFormData.value.numero,
      precio: inputReserva, // Save reservation as is
      precio_tratamiento: finalPrecioTratamiento, // Save remaining balance
      procedimiento: patientFormData.value.procedimiento,
      fecha_agendamiento: formattedDate,
      estado: patientFormData.value.estado,
      agendamiento: patientFormData.value.agendamiento,
      metodo_de_pago: patientFormData.value.metodo_de_pago
    }

    if (selectedPatientType.value === 'wpp') {
      const payload = commonPayload

      if (editingPatient.value) {
        const { error } = await (client
          .from('PacientesBDwppHEALUP') as any)
          .update(payload)
          .eq('id', editingPatient.value.id)
        if (error) throw error
      } else {
        const { error } = await client
          .from('PacientesBDwppHEALUP')
          .insert(payload as any)
        if (error) throw error
      }
    } else {
      const payload = { ...commonPayload, red_social: patientFormData.value.red_social }

      if (editingPatient.value) {
        const { error } = await (client
          .from('PacientesBDfbigHEALUP') as any)
          .update(payload)
          .eq('id', editingPatient.value.id)
        if (error) throw error
      } else {
        const { error } = await client
          .from('PacientesBDfbigHEALUP')
          .insert(payload as any)
        if (error) throw error
      }
    }

    // Refresh data
    if (selectedPatientType.value === 'wpp') {
      await fetchPacientesWpp()
    } else {
      await fetchPacientesFbIg()
    }

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

const deletePatient = async (item: any, type: 'wpp' | 'fbig') => {
  if (!confirm(`¿Estás seguro de que deseas eliminar a ${item.nombre}?`)) return

  loading.value = true
  try {
    const tableName = type === 'wpp' ? 'PacientesBDwppHEALUP' : 'PacientesBDfbigHEALUP'

    const { error } = await (client
      .from(tableName)
      .delete() as any)
      .eq('id', item.id)

    if (error) throw error

    // Refresh data
    if (type === 'wpp') {
      await fetchPacientesWpp()
    } else {
      await fetchPacientesFbIg()
    }
  } catch (error) {
    console.error('Error deleting patient:', error)
    alert('Error al eliminar el paciente.')
  } finally {
    loading.value = false
  }
}

/* ---------------- Estado General ---------------- */
const activeView = ref('dashboard')

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
  { icon: 'mdi-currency-usd', label: 'Contabilidad', id: 'facturacion' },
  { icon: 'mdi-chart-line', label: 'Facturación', id: 'contabilidad' }
]

const documentItems = [
  { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
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
const allPacientes = computed(() => [...pacientesWpp.value, ...pacientesFbIg.value])

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
  // Coincidencia por número
  const patientPhones = new Set(allPacientes.value.map(p => p.numero))
  return leads.value.filter(l => patientPhones.has(l.numero)).length
})

const realConversionRate = computed(() => {
  if (leads.value.length === 0) return 0
  // Si no hay conteo de convertidos por match, usamos ratio simple
  const count = convertedLeadsCountReal.value > 0 ? convertedLeadsCountReal.value : allPacientes.value.length
  // Cap at 100% logic or simple ratio
  return (count / leads.value.length) * 100
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

const totalLeadsCount = computed(() => leads.value.length)
const totalLeads = computed(() => leads.value.length) // Alias for template compatibility

// Status counts (Case insensitive safety)
const coldLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('fri') || l.lead_status?.toLowerCase().includes('frío')).length)
const warmLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('tibi')).length)
const hotLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('caliente')).length)

const conversionRate = computed(() => {
  if (totalLeadsCount.value === 0) return 0
  return (hotLeadsCount.value / totalLeadsCount.value) * 100
})

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
  color?: string
}

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

/* ---------------- Calendar State ---------------- */
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const selectedDate = ref<Date | null>(null)
const events = ref<CalendarEvent[]>([])

const workingHours = ref({
  id: 1,
  slot_duration_minutes: 30,
  schedule_json: [
    { day: 1, active: true, start: '10:00', end: '20:00' },
    { day: 2, active: true, start: '10:00', end: '20:00' },
    { day: 3, active: true, start: '10:00', end: '20:00' },
    { day: 4, active: true, start: '10:00', end: '20:00' },
    { day: 5, active: true, start: '10:00', end: '20:00' },
    { day: 6, active: true, start: '10:00', end: '14:00' },
    { day: 0, active: false, start: '09:00', end: '18:00' }
  ]
})
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
  eventReason: ''
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
  
  const dayConfig = workingHours.value.schedule_json.find(d => d.day === dayOfWeek)
  if (!dayConfig || !dayConfig.active) return []
  
  const startParts = dayConfig.start.split(':').map(Number)
  const endParts = dayConfig.end.split(':').map(Number)
  const startMins = startParts[0] * 60 + (startParts[1] || 0)
  const endMins = endParts[0] * 60 + (endParts[1] || 0)
  
  const times = []
  for (let m = startMins; m < endMins; m += workingHours.value.slot_duration_minutes) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0')
    const mm = (m % 60).toString().padStart(2, '0')
    times.push(`${hh}:${mm}`)
  }
  
  const eventsOnDate = events.value.filter(e => e.date === eventFormData.value.date && e.id !== editingEvent.value?.id)
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
    const dayConfig = workingHours.value.schedule_json.find(d => d.day === dayOfWeek)
    
    if (!dayConfig || !dayConfig.active) return { isWorkingDay: false, total: 0, available: 0 }
    
    let startParts = dayConfig.start.split(':').map(Number)
    let endParts = dayConfig.end.split(':').map(Number)
    if(startParts.length < 2) startParts = [10, 0]
    if(endParts.length < 2) endParts = [20, 0]

    const startMins = startParts[0] * 60 + (startParts[1] || 0)
    const endMins = endParts[0] * 60 + (endParts[1] || 0)
    const totalMins = endMins - startMins > 0 ? endMins - startMins : 0
    const durationMins = workingHours.value.slot_duration_minutes > 0 ? workingHours.value.slot_duration_minutes : 30
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
    .filter(event => new Date(event.date + 'T' + event.time) >= now)
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
    const { data, error } = await client.from('healup_working_hours').select('*').limit(1).single()
    if (error && error.code !== 'PGRST116') throw error
    if (data) {
      workingHours.value = {
        id: data.id,
        slot_duration_minutes: data.slot_duration_minutes,
        schedule_json: typeof data.schedule_json === 'string' ? JSON.parse(data.schedule_json) : data.schedule_json
      }
    }
  } catch (error) {
    console.error('Error loading working hours:', error)
  }
}

async function saveWorkingHours() {
  savingSchedule.value = true
  try {
    const payload = {
      id: workingHours.value.id,
      slot_duration_minutes: workingHours.value.slot_duration_minutes,
      schedule_json: workingHours.value.schedule_json
    }
    const { error } = await client.from('healup_working_hours').upsert(payload, { onConflict: 'id' }).select()
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
  return events.value.filter(event => event.date === dateStr)
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
    eventReason: ''
  }
  showEventDialog.value = true
}

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
      event_reason: eventFormData.value.eventReason
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

/* ---------------- Calendar Supabase ---------------- */
async function fetchEvents() {
  try {
    const { data, error } = await client
      .from('healup_calendar_events')
      .select('*')

    if (error) throw error

    console.log('Raw Supabase Events:', data)

    // Map snake_case to camelCase
    events.value = (data || []).map((e: any) => ({
      id: e.id,
      date: e.date ? e.date.split('T')[0] : '', // Asegurar que sea 'YYYY-MM-DD'
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
      // color is purely frontend derivation from procedureId, so handled by getProcedureColor
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
}

/* ---------------- Procedures State ---------------- */
const procedures = ref<Procedure[]>([])
const procedureSearch = ref('')
const showProcedureDialog = ref(false)
const editingProcedure = ref<Procedure | null>(null)
const procedureFormData = ref({
  name: '',
  color: '#3b82f6',
  price: 0,
  discount: 0
})
const procedureForm = ref<any>(null)

/* ---------------- Procedures Constants ---------------- */


const procedureHeaders = [
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Color', key: 'color', sortable: false },
  { title: 'Precio Original', key: 'price', sortable: true },
  { title: 'Descuento', key: 'discount', sortable: true },
  { title: 'Precio Final', key: 'finalPrice', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false }
]

/* ---------------- Procedures Functions ---------------- */
function openProcedureDialog(procedure?: Procedure) {
  if (procedure) {
    editingProcedure.value = procedure
    procedureFormData.value = { ...procedure }
  } else {
    editingProcedure.value = null
    procedureFormData.value = {
      name: '',
      color: '#3b82f6',
      price: 0,
      discount: 0
    }
  }
  showProcedureDialog.value = true
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

  // Supabase Logic
  try {
    if (editingProcedure.value) {
      // Update
      const { error } = await (client
        .from('healup_procedures') as any)
        .update({
          name: procedureFormData.value.name,
          color: procedureFormData.value.color,
          price: procedureFormData.value.price,
          discount: procedureFormData.value.discount
        })
        .eq('id', editingProcedure.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('healup_procedures') as any)
        .insert({
          name: procedureFormData.value.name,
          color: procedureFormData.value.color,
          price: procedureFormData.value.price,
          discount: procedureFormData.value.discount
        })

      if (error) throw error
    }

    await fetchProcedures()
    closeProcedureDialog()
  } catch (error) {
    console.error('Error saving procedure:', error)
    alert('Error al guardar el procedimiento')
  }
}

async function deleteProcedure(procedureId: string) {
  if (confirm('¿Estás seguro de que deseas eliminar este procedimiento?')) {
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

/* ---------------- Procedures Supabase ---------------- */
async function fetchProcedures() {
  try {
    const { data, error } = await client
      .from('healup_procedures')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error
    procedures.value = data || []
  } catch (error) {
    console.error('Error loading procedures:', error)
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
      status: e.estado
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

onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase() // Deprecated

  // Verificamos pasando el objeto completo de sesión (currentUser.value)
  if (!canAccessHealup(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }


  applyTheme()
  fetchPacientesWpp()
  fetchPacientesFbIg()
  fetchCompras()
  fetchLeads()
  handleZoom('Mes')
  fetchWorkingHours()
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()
  setupRealtime()
})
</script>
