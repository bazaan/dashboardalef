<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/healupLOGO.png" alt="Alef Company Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser?.email)">
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
        <button class="footer-item">
          <v-icon icon="mdi-cog" size="18" />
          <span>Settings</span>
        </button>
        <a href="https://wa.me/51936196001?text=Hola%20necesito%20soporte" target="_blank" class="footer-item"
          style="text-decoration: none; color: inherit;">
          <v-icon icon="mdi-help-circle" size="18" />
          <span>Contacta con Alef</span>
        </a>
        <button class="footer-item">
          <v-icon icon="mdi-magnify" size="18" />
          <span>Search</span>
        </button>
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

              <!-- TABLE: COMPRAS (Was Outline) -->
              <div v-if="activeTab === 'compras'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimas Compras</span>
                </v-card-title>
                <v-data-table :headers="headersComprasDashboard" :items="compras.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay compras recientes" :items-per-page="10">
                  <template v-slot:bottom></template> <!-- Hide footer if desired -->
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

      <!-- ==========  VISTA: CALENDARIO  ========== -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Calendario</h1>
          <button class="btn-primary" @click="() => openCreateEventDialog()">
            <v-icon icon="mdi-calendar-plus" size="16" />
            <span>Nuevo Evento</span>
          </button>
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
                  'has-events': day.events.length > 0
                }
              ]" @click="selectDay(day)">
                <span class="day-number">{{ day.day }}</span>
                <div v-if="day.events.length > 0" class="event-list-in-day">
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
          <button class="btn-primary">
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
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                    <span class="status-dot" />
                    {{ item.estado }}
                  </span>
                </template>
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="editItem(item)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deleteItem(item)">
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
                <template v-slot:item.estado="{ item }">
                  <span :class="['status', item.estado === 'Activo' ? 'done' : 'in-process']">
                    <span class="status-dot" />
                    {{ item.estado }}
                  </span>
                </template>
                <template v-slot:item.actions="{ item }">
                  <button class="icon-btn" @click="editItem(item)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </button>
                  <button class="icon-btn" @click="deleteItem(item)">
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
            <div class="stat-card">
              <div class="stat-title">Ingresos (Mes Actual)</div>
              <div class="stat-value">S/ {{ revenueCurrentMonth.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div :class="['stat-change', revenueGrowth >= 0 ? 'up' : 'down']">
                <v-icon :icon="revenueGrowth >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'" size="12" />
                {{ Math.abs(revenueGrowth).toFixed(1) }}% vs mes anterior
              </div>
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
                <h2>Tendencia de Facturación (Diaria)</h2>
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
                      <div class="font-weight-bold text-primary">S/ {{ paciente.precio }}</div>
                      <div class="text-caption text-medium-emphasis">{{ paciente.fecha_agendamiento ? new
                        Date(paciente.fecha_agendamiento).toLocaleDateString() : '-' }}</div>
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
                <v-text-field v-model="eventFormData.time" label="Hora" type="time" variant="outlined" density="compact"
                  :rules="[v => !!v || 'La hora es requerida']"></v-text-field>
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

            <v-select v-model="procedureFormData.discount" label="Descuento" :items="discountOptions" item-title="title"
              item-value="value" variant="outlined" density="compact"></v-select>

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

            <div class="file-upload-section mt-4">
              <label class="form-label mb-2 d-block">Documento Médico (PDF)</label>
              <div v-if="editingMedicalHistory && medicalHistoryFormData.existingFileName"
                class="mb-2 d-flex align-center">
                <v-icon icon="mdi-file-pdf-box" color="primary" class="mr-2"></v-icon>
                <span class="text-body-2 mr-2">{{ medicalHistoryFormData.existingFileName }}</span>
                <v-chip size="x-small" color="success" variant="flat">Archivo actual</v-chip>
              </div>
              <v-file-input v-model="medicalHistoryFormData.file"
                :label="editingMedicalHistory && medicalHistoryFormData.existingFileName ? 'Cambiar archivo (Opcional)' : 'Seleccionar archivo PDF'"
                accept="application/pdf" variant="outlined" density="compact" prepend-icon="mdi-paperclip" show-size
                :rules="[v => !v || v.length === 0 || v[0].type === 'application/pdf' || 'Solo se permiten archivos PDF']"></v-file-input>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessHealup, dashboards } from '@/utils/permissions'

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
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Precio', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Fecha de Agendamiento', key: 'fecha_agendamiento', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
])

const headersPacientesFbIg = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Red Social', key: 'red_social', sortable: true },
  { title: 'Precio', key: 'precio', sortable: true },
  { title: 'Procedimiento', key: 'procedimiento', sortable: true },
  { title: 'Fecha de Agendamiento', key: 'fecha_agendamiento', sortable: true },
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
    const { data, error } = await client
      .from('comprasBDwppBRADA')
      .select('*')
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
    const { data, error } = await client
      .from('GeneralBDwppHEALUP')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error
    leadsWpp.value = data as any[] || []
  } catch (error) {
    console.error('Error loading leads WhatsApp:', error)
  }
}

const fetchLeadsFbIg = async () => {
  try {
    const { data, error } = await client
      .from('GeneralBDfbigHEALUP')
      .select('*')
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
const editItem = (item: any) => {
  console.log('Editar:', item)
  // Implementa tu lógica de edición aquí
}

const deleteItem = async (item: any) => {
  // Nota: Esto requeriría saber de qué tabla borrar (Wpp o FbIg)
  // Por simplicidad, alertamos que no está implementado o intentamos borrar de ambas si el ID coincide (riesgoso)
  alert("La eliminación directa desde la tabla combinada requiere lógica adicional para saber la fuente. Implementar según necesidad.")
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

const revenueCurrentMonth = computed(() => {
  return pacientesMesActual.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenuePreviousMonth = computed(() => {
  return pacientesMesAnterior.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenueGrowth = computed(() => {
  if (revenuePreviousMonth.value === 0) return revenueCurrentMonth.value > 0 ? 100 : 0
  return ((revenueCurrentMonth.value - revenuePreviousMonth.value) / revenuePreviousMonth.value) * 100
})

const salesCountCurrentMonth = computed(() => pacientesMesActual.value.length)
const salesCountPreviousMonth = computed(() => pacientesMesAnterior.value.length)
const salesGrowth = computed(() => {
  if (salesCountPreviousMonth.value === 0) return salesCountCurrentMonth.value > 0 ? 100 : 0
  return ((salesCountCurrentMonth.value - salesCountPreviousMonth.value) / salesCountPreviousMonth.value) * 100
})

const averageOrderValue = computed(() => {
  if (salesCountCurrentMonth.value === 0) return 0
  return revenueCurrentMonth.value / salesCountCurrentMonth.value
})

const totalComprasCount = computed(() => compras.value.length) // Legacy ref
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

// --- GRÁFICOS FACTURACIÓN ---

// A. Ingresos Diarios (Mes Actual)
const revenueChartSeries = computed(() => {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyRevenue = new Array(daysInMonth).fill(0)

  pacientesMesActual.value.forEach(p => {
    if (!p.fecha_agendamiento) return
    const d = new Date(p.fecha_agendamiento)
    const dayIndex = d.getDate() - 1
    if (dayIndex >= 0 && dayIndex < daysInMonth) {
      dailyRevenue[dayIndex] += parseCurrency(p.precio)
    }
  })

  return [{ name: 'Ingresos Diarios', data: dailyRevenue }]
})

const revenueChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'area', height: 350, fontFamily: 'inherit', toolbar: { show: false }, background: 'transparent' },
  xaxis: { categories: Array.from({ length: new Date().getDate() }, (_, i) => i + 1), labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } }, tooltip: { enabled: false } },
  yaxis: { labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' }, formatter: (val) => `S/ ${val.toFixed(0)}` } },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#10b981'],
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
  theme: { mode: isDark.value ? 'dark' : 'light' }
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
const stats = computed<Stat[]>(() => [
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
])

/* ---------------- Tabs ---------------- */
const tabs = ref<Tab[]>([
  { label: 'Compras', value: 'compras' },
  { label: 'Leads', value: 'leads' },
  { label: 'Próximos Eventos', value: 'events' }
])

const activeTab = ref('compras') // Changed default to compras from outline

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
}

/* ---------------- Calendar State ---------------- */
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const selectedDate = ref<Date | null>(null)
const events = ref<CalendarEvent[]>([])

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

  // Previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(currentYear.value, currentMonth.value - 1, prevLastDate - i)
    days.push({
      date,
      day: prevLastDate - i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date)
    })
  }

  // Current month days
  for (let i = 1; i <= lastDateOfMonth; i++) {
    const date = new Date(currentYear.value, currentMonth.value, i)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    days.push({
      date,
      day: i,
      isCurrentMonth: true,
      isToday: dateOnly.getTime() === today.getTime(),
      isSelected: selectedDate.value ? dateOnly.getTime() === new Date(selectedDate.value).setHours(0, 0, 0, 0) : false,
      events: getEventsForDate(date)
    })
  }

  // Next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(currentYear.value, currentMonth.value + 1, i)
    days.push({
      date,
      day: i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date)
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
  const date = new Date(dateStr + 'T00:00:00')
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
  eventFormData.value = { ...selectedEvent.value }
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

    // Map snake_case to camelCase
    events.value = (data || []).map((e: any) => ({
      id: e.id,
      date: e.date,
      time: e.time,
      subject: e.subject,
      description: e.description,
      procedureId: e.procedure_id,
      clientName: e.client_name,
      clientSurname: e.client_surname,
      clientDNI: e.client_dni,
      eventReason: e.event_reason,
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
const discountOptions = [
  { title: 'Sin descuento', value: 0 },
  { title: '10%', value: 10 },
  { title: '20%', value: 20 },
  { title: '30%', value: 30 },
  { title: '40%', value: 40 },
  { title: '50%', value: 50 },
  { title: '60%', value: 60 },
  { title: '70%', value: 70 },
  { title: '80%', value: 80 },
  { title: '90%', value: 90 },
  { title: '100%', value: 100 }
]

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
  file: [] as any,
  existingFileName: ''
})

const medicalHistoryHeaders = [
  { title: 'Fecha', key: 'dateAdded', sortable: true },
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Apellido', key: 'surname', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Documento', key: 'attachment', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false }
]

/* ---------------- Medical History Functions ---------------- */
function openMedicalHistoryDialog() {
  editingMedicalHistory.value = null
  medicalHistoryFormData.value = {
    name: '',
    surname: '',
    dni: '',
    phone: '',
    email: '',
    file: [],
    existingFileName: ''
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
    file: [],
    existingFileName: item.attachmentName || ''
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
      date_added: editingMedicalHistory.value ? undefined : new Date().toLocaleDateString(), // Only set on create if desired, or keep original
      attachment_name: attachmentName,
      attachment_data: attachmentData
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
          ...payload,
          date_added: new Date().toLocaleDateString()
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
      attachmentData: e.attachment_data
    }))
  } catch (error) {
    console.error('Error loading medical history:', error)
  }
}

onMounted(() => {
  // Access Control
  const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessHealup(userEmail)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  applyTheme()
  fetchPacientesWpp()
  fetchPacientesFbIg()
  fetchCompras()
  fetchLeads()
  handleZoom('Mes')
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()
})
</script>
