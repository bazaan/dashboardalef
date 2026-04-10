<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/LogoSkyDive.png" alt="SKIP Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">SKIP</span>
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
          <span v-else class="logo-text">SKIP</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Inicio</div>
          <button v-for="item in menuItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Chats</div>
          <button v-for="item in chatsItems" :key="item.id" class="nav-item" @click="navigateToChat(item.url)">
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
          <div v-for="item in documentItems" :key="item.id">
            <button v-if="!item.children" :class="['nav-item', { active: activeView === item.id }]"
              @click="activeView = item.id">
              <v-icon :icon="item.icon" size="18" />
              <span>{{ item.label }}</span>
            </button>
            <div v-else>
              <button :class="['nav-item', 'parent-item', { active: serviciosMenuOpen }]"
                @click="serviciosMenuOpen = !serviciosMenuOpen">
                <v-icon :icon="item.icon" size="18" />
                <span>{{ item.label }}</span>
                <v-icon :icon="serviciosMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="16" class="ml-auto" />
              </button>
              <div v-show="serviciosMenuOpen" class="sub-nav">
                <button v-for="child in item.children" :key="child.id"
                  :class="['nav-item', 'sub-item', { active: activeView === child.id }]" @click="activeView = child.id">
                  <span class="dot">•</span>
                  <span>{{ child.label }}</span>
                </button>
              </div>
            </div>
          </div>


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
      <div v-if="activeView === 'dashboard'" class="view-container">


        <header class="top-header">
          <h1>Dashboard</h1>

          <div style="display: flex; gap: 10px; align-items: center;">

            <!-- <N8nPanicButton client-key="brada" label="IA Brada" /> -->

            <button class="btn-primary" @click="fetchContribuyentes">
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

              <!-- TABLE: VENTAS -->
              <div v-if="activeTab === 'ventas'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimas Ventas</span>
                </v-card-title>
                <v-data-table :headers="headersVentas" :items="compras.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay ventas recientes" :items-per-page="10">
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
                  <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
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
      <SettingsView v-else-if="activeView === 'settings'" company-id="SKIP"
        :current-user-role="currentUser?.role" />

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
                    :style="{ backgroundColor: event.color || '#3b82f6' }" :title="event.subject">
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
                <div class="event-color-bar" :style="{ backgroundColor: event.color || '#3b82f6' }"></div>
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

      <!-- ==========  VISTA: VENTAS  ========== -->
      <div v-else-if="activeView === 'ventas'" class="view-container">
        <header class="top-header">
          <h1>Ventas</h1>
          <div style="display: flex; gap: 15px; align-items: center;">
            <v-select v-model="tipoVentaSeleccionada"
              :items="['Salto Tandem', 'Curso Paracaidismo', 'Curso Acelerado']" variant="outlined"
              density="compact" hide-details style="min-width: 250px;"></v-select>
            <button class="btn-primary">
              <v-icon icon="mdi-cart-plus" size="16" />
              <span>Nueva Venta</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <div class="stats-grid mini two-columns">
            <div class="stat-card center-content">
              <div class="stat-value">{{ compras.length }}</div>
              <div class="stat-title">Total Histórico ({{ tipoVentaSeleccionada }})</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ comprasMesActual.length }}</div>
              <div class="stat-title">Ventas este Mes</div>
              <div class="stat-change" :class="growthPercentage >= 0 ? 'up' : 'down'">
                {{ growthPercentage >= 0 ? '+' : '' }}{{ growthPercentage.toFixed(1) }}% vs mes anterior
              </div>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de Ventas</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="ventasSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersVentas" :items="compras" :search="ventasSearch" :loading="loading"
                class="elevation-0" no-data-text="No hay datos de ventas">

                <template v-slot:item.metodo_pago="{ item }">
                  <v-chip :color="item.metodo_pago?.toLowerCase().includes('yape') ? '#743484' :
                    item.metodo_pago?.toLowerCase().includes('plin') ? '#00e5ff' :
                      item.metodo_pago?.toLowerCase().includes('efectivo') ? '#4caf50' :
                        item.metodo_pago?.toLowerCase().includes('tarjeta') ? '#1976d2' : 'grey'"
                    :text-color="item.metodo_pago?.toLowerCase().includes('yape') ? 'white' : 'black'" size="small"
                    class="font-weight-bold">
                    {{ item.metodo_pago || 'Desconocido' }}
                  </v-chip>
                </template>

              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: RESERVAS  ========== -->
      <div v-else-if="activeView === 'reservas'" class="view-container">
        <header class="top-header">
          <h1>Reservas (Recojo en Tienda)</h1>
          <button class="btn-primary" @click="fetchReservas">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>

        <div class="content-area">
          <div class="stats-grid mini">
            <div class="stat-card center-content" style="max-width: 300px;">
              <div class="stat-value">{{ reservas.length }}</div>
              <div class="stat-title">Total Reservas Registradas</div>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de Reservas</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="reservasSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersReservas" :items="reservas" :search="reservasSearch"
                :loading="loadingReservas" class="elevation-0" no-data-text="No hay datos de reservas">

                <template v-slot:item.metodo_pago_reserva="{ item }">
                  <v-chip :color="item.metodo_pago_reserva?.toLowerCase().includes('yape') ? '#743484' :
                    item.metodo_pago_reserva?.toLowerCase().includes('plin') ? '#00e5ff' :
                      item.metodo_pago_reserva?.toLowerCase().includes('efectivo') ? '#4caf50' :
                        item.metodo_pago_reserva?.toLowerCase().includes('tarjeta') ? '#1976d2' : 'grey'"
                    :text-color="item.metodo_pago_reserva?.toLowerCase().includes('yape') ? 'white' : 'black'"
                    size="small" class="font-weight-bold">
                    {{ item.metodo_pago_reserva || 'Desconocido' }}
                  </v-chip>
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
              <div class="stat-value">{{ totalLeads }}</div>
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

          <!-- Two Stacked Tables -->
          <div class="table-section mb-4">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Compras WhatsApp</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="leadsSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersLeadsWhatsapp" :items="leadsWhatsapp" :search="leadsSearch"
                :loading="loadingLeads" class="elevation-0" no-data-text="No hay leads de WhatsApp">
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
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Leads Instagram</span>
                <v-spacer></v-spacer>
                <!-- We share the search variable for simplicity, or we could duplicate it -->
              </v-card-title>
              <v-data-table :headers="headersLeadsInstagram" :items="leadsInstagram" :search="leadsSearch"
                :loading="loadingLeads" class="elevation-0" no-data-text="No hay leads de Instagram">
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
          <div class="table-section">
             <v-card flat class="custom-data-table">
               <v-card-title class="table-search-bar">
                 <span class="table-title">Lista de Egresos</span>
                 <v-spacer></v-spacer>
               </v-card-title>
               <v-data-table :headers="egresosHeaders" :items="egresosList" :loading="loadingEgresos" class="elevation-0" no-data-text="No hay egresos registrados">
                 <template v-slot:item.precio="{ item }">
                   S/ {{ item.precio.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                 </template>
                 <template v-slot:item.total="{ item }">
                   S/ {{ (item.precio * item.cantidad).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                 </template>
                 <template v-slot:item.created_at="{ item }">
                   {{ new Date(item.created_at).toLocaleDateString() }}
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

      <!-- ==========  VISTA: FACTURACIÓN  ========== -->
      <div v-else-if="activeView === 'facturacion'" class="view-container">
        <header class="top-header">
          <h1>Contabilidad</h1>
          <div class="header-actions">
            <button class="btn-primary" @click="fetchCompras">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar Datos</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <!-- KPI Stats Grid -->
          <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div class="stat-card">
              <div class="stat-title">Ingresos Totales (Mes Actual)</div>
              <div class="stat-value">S/ {{ totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Histórico de todas las ventas</div>
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

            <div class="stat-card" style="border-left: 4px solid #10b981;">
              <div class="stat-title">Ganancia Neta (Este Mes)</div>
              <div class="stat-value">S/ {{ gananciaNetaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">Ingresos Totales - Egresos</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ventas Totales</div>
              <div class="stat-value">{{ compras.length }}</div>
              <div class="stat-subtitle">Total de ventas registradas</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ticket Promedio (AOV)</div>
              <div class="stat-value">S/ {{ averageOrderValue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Promedio por venta histórico</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Tasa de Conversión Real</div>
              <div class="stat-value">{{ realConversionRate.toFixed(1) }}%</div>
              <div class="stat-subtitle">{{ convertedLeadsCountReal }} de {{ leads.length }} Leads han comprado</div>
            </div>
          </div>

          <!-- Charts Grid -->
          <div class="two-column-grid" style="grid-template-columns: 2fr 1fr;">
            <!-- Give more space to Revenue chart -->
            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Tendencia de Facturación (Últimos 30 días)</h2>
              </div>
              <client-only>
                <apexchart type="area" height="350" :options="revenueChartOptions" :series="revenueChartSeries" />
              </client-only>
            </div>

            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Leads vs Compradores</h2>
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
                <h2>Ventas por Categoría (Total)</h2>
              </div>
              <client-only>
                <apexchart type="bar" height="350" :options="categoryChartOptions" :series="salesByCategorySeries" />
              </client-only>
            </div>
            <div class="chart-section" style="height: auto; max-height: 480px; overflow-y: auto;">
              <div class="chart-header mb-2">
                <h2>Últimas Compras</h2>
              </div>
              <v-list density="compact">
                <v-list-item v-for="compra in compras.slice(0, 6)" :key="compra.id" lines="two"
                  style="border-bottom: 1px solid var(--border);">
                  <template v-slot:prepend>
                    <v-avatar color="primary" variant="tonal" size="36">
                      <v-icon icon="mdi-cart" size="18"></v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-bold">{{ compra.nombre }} {{ compra.apellidos
                  }}</v-list-item-title>
                  <v-list-item-subtitle>{{ compra.productos_comprados }}</v-list-item-subtitle>
                  <template v-slot:append>
                    <div class="text-right">
                      <div class="font-weight-bold text-primary">{{ compra.precio }}</div>
                      <div class="text-caption text-medium-emphasis">{{ new Date(compra.created_at).toLocaleDateString()
                      }}</div>
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </div>

        </div>
      </div>

      <!-- ==========  VISTA: CONTABILIDAD GLOBAL  ========== -->
      <div v-else-if="activeView === 'contabilidad'" class="view-container">

        <!-- PSE Tabs -->
        <v-tabs
          v-model="facturacionTab"
          bg-color="transparent"
          color="primary"
          density="compact"
          class="mb-4"
          style="border-bottom: 1px solid var(--border);"
        >
          <v-tab value="resumen">Resumen</v-tab>
          <v-tab value="factura_electronica">⚡ Factura Electrónica</v-tab>
        </v-tabs>

        <!-- PSE.PE: Factura Electrónica -->
        <div v-show="facturacionTab === 'factura_electronica'" style="padding: 0 0 2rem 0;">
          <FacturacionPSE company-id="skip" />
        </div>

        <!-- Resumen original -->
        <div v-show="facturacionTab === 'resumen'">
        <header class="top-header">
          <h1>Contabilidad Global</h1>
          <button class="btn-primary" @click="fetchGlobalAccounting">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar Datos</span>
          </button>
        </header>

        <div class="content-area">
          <!-- KPI Stats Grid Global -->
          <div class="stats-grid">
            <div class="stat-card" style="border-top: 4px solid #a78bfa;">
              <div class="stat-title">Ingresos Totales (S/)</div>
              <div class="stat-value">S/ {{ totalGlobalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-subtitle">Suma de todos los canales</div>
            </div>

            <div class="stat-card" style="border-top: 4px solid #a78bfa;">
              <div class="stat-title">Ventas Totales (Unidades)</div>
              <div class="stat-value">{{ totalGlobalSales }}</div>
              <div class="stat-subtitle">Total de productos vendidos</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ticket Promedio Global</div>
              <div class="stat-value">S/ {{ totalGlobalSales > 0 ? (totalGlobalRevenue /
                totalGlobalSales).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : 0 }}</div>
              <div class="stat-subtitle">Promedio por unidad histórica</div>
            </div>
          </div>

          <!-- Desglose Por Canal en Línea -->
          <div style="margin-top: 2rem; margin-bottom: 2rem;">
            <h2 style="margin-bottom: 1rem; color: #fff; font-size: 1.25rem;">Desglose por Canal de Venta</h2>
            <v-row>
              <!-- Motorizado -->
              <v-col cols="12" md="3">
                <v-card class="pa-4"
                  style="background: var(--surface); border: 1px solid var(--border); border-left: 4px solid #4ade80;">
                  <h3 style="color: #4ade80; margin-bottom: 10px;">Motorizado</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #a0aec0;">Ingresos:</span>
                    <strong style="color: #fff;">S/ {{ globalMotorizadoRevenue.toLocaleString('es-PE', {
                      minimumFractionDigits: 2 }) }}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #a0aec0;">Unidades:</span>
                    <strong style="color: #fff;">{{ globalMotorizadoSales }}</strong>
                  </div>
                </v-card>
              </v-col>
              <!-- Courier -->
              <v-col cols="12" md="3">
                <v-card class="pa-4"
                  style="background: var(--surface); border: 1px solid var(--border); border-left: 4px solid #60a5fa;">
                  <h3 style="color: #60a5fa; margin-bottom: 10px;">Courier</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #a0aec0;">Ingresos:</span>
                    <strong style="color: #fff;">S/ {{ globalCourierRevenue.toLocaleString('es-PE', {
                      minimumFractionDigits:
                      2 }) }}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #a0aec0;">Unidades:</span>
                    <strong style="color: #fff;">{{ globalCourierSales }}</strong>
                  </div>
                </v-card>
              </v-col>
              <!-- Tienda -->
              <v-col cols="12" md="3">
                <v-card class="pa-4"
                  style="background: var(--surface); border: 1px solid var(--border); border-left: 4px solid #f472b6;">
                  <h3 style="color: #f472b6; margin-bottom: 10px;">Recojo en Tienda</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #a0aec0;">Ingresos:</span>
                    <strong style="color: #fff;">S/ {{ globalTiendaRevenue.toLocaleString('es-PE', {
                      minimumFractionDigits:
                      2 }) }}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #a0aec0;">Unidades:</span>
                    <strong style="color: #fff;">{{ globalTiendaSales }}</strong>
                  </div>
                </v-card>
              </v-col>
              <!-- Reservas -->
              <v-col cols="12" md="3">
                <v-card class="pa-4"
                  style="background: var(--surface); border: 1px solid var(--border); border-left: 4px solid #fbbf24;">
                  <h3 style="color: #fbbf24; margin-bottom: 10px;">Reservas</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #a0aec0;">Ingresos:</span>
                    <strong style="color: #fff;">S/ {{ globalReservasRevenue.toLocaleString('es-PE', {
                      minimumFractionDigits: 2 }) }}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #a0aec0;">Unidades:</span>
                    <strong style="color: #fff;">{{ globalReservasSales }}</strong>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </div>

          <!-- Charts Grid -->
          <div class="two-column-grid" style="grid-template-columns: 1fr 1fr; margin-top: 2rem;">
            <!-- Revenue Chart (Donut) -->
            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Ingresos por Canal (%)</h2>
              </div>
              <client-only>
                <div v-if="loadingGlobalAccounting" style="padding: 2rem; text-align: center; color: #a0aec0;">Cargando
                  gráficos...</div>
                <apexchart v-else type="donut" height="350" :options="accountingRevenueOptions"
                  :series="accountingRevenueSeries" />
              </client-only>
            </div>

            <!-- Quantity Chart (Bar) -->
            <div class="chart-section" style="height: auto;">
              <div class="chart-header">
                <h2>Volumen de Productos Vendidos</h2>
              </div>
              <client-only>
                <div v-if="loadingGlobalAccounting" style="padding: 2rem; text-align: center; color: #a0aec0;">Cargando
                  gráficos...</div>
                <apexchart v-else type="bar" height="350" :options="accountingQuantityOptions"
                  :series="accountingQuantitySeries" />
              </client-only>
            </div>
          </div>
        </div>

        </div><!-- fin tab resumen -->
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

      <!-- ==========  VISTA: SERVICIOS  ========== -->
      <div v-else-if="activeView === 'stock'" class="view-container">
        <header class="top-header">
          <h1>Catálogo de Servicios</h1>
          <div class="header-actions">
            <button class="btn-primary" @click="openServicioDialog()" style="margin-right: 10px;">
              <v-icon icon="mdi-plus" size="16" />
              <span>Nuevo Servicio</span>
            </button>
            <button class="btn-primary" @click="fetchServicios">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Sincronizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <div class="services-dashboard">
            <div class="search-container mb-6">
              <v-text-field v-model="serviciosSearch" prepend-inner-icon="mdi-magnify" label="Buscar servicio espacial..." single-line
                hide-details density="comfortable" variant="solo-filled" bg-color="rgba(255,255,255,0.05)" class="techno-search"></v-text-field>
            </div>
            
            <div v-if="loadingServicios" class="loading-state" style="text-align: center; padding: 40px;">
              <v-progress-circular indeterminate color="primary" :size="50"></v-progress-circular>
              <p style="margin-top: 15px; color: #a1a1aa;">Sincronizando catálogo...</p>
            </div>
            
            <div v-else class="services-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
              <div v-for="item in filteredServicios" :key="item.id" class="service-card techno-card" :style="{ '--service-color': item.color || '#3b82f6' }">
                <div class="card-glow"></div>
                <div class="card-inner" style="position: relative; z-index: 2; padding: 24px; background: var(--surface); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; height: 100%; transition: transform 0.3s ease, border-color 0.3s ease;">
                  <div class="service-icon-wrapper" style="margin-bottom: 16px; display: inline-flex; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.03); width: max-content;">
                    <v-icon :icon="item.icono || 'mdi-parachute'" size="32" :color="item.color || '#3b82f6'" />
                  </div>
                  <div class="service-content" style="flex-grow: 1;">
                    <h3 class="service-title" style="font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">{{ item.servicio }}</h3>
                    <p class="service-desc" style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 20px;">{{ item.descripcion || 'Servicio asombroso para saltos.' }}</p>
                  </div>
                  <div class="service-footer" style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
                    <div class="service-price">
                      <span class="currency" style="color: var(--text-secondary); font-size: 0.9rem; margin-right: 4px;">S/</span>
                      <span class="amount" style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">{{ Number(item.precio).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</span>
                    </div>
                    <button class="action-btn icon-btn" @click="openServicioDialog(item)" style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px; transition: background 0.2s;">
                      <v-icon icon="mdi-pencil" size="18" :color="item.color || '#3b82f6'" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!loadingServicios && filteredServicios.length === 0" class="empty-state" style="text-align: center; padding: 60px;">
              <v-icon icon="mdi-emoticon-sad-outline" size="48" color="grey" style="opacity: 0.5;"></v-icon>
              <p style="margin-top: 10px; color: #a1a1aa;">No se encontraron servicios</p>
            </div>
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
              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon icon="mdi-package-variant"></v-icon>
                  </template>
                  <v-list-item-title>Alertas de Stock</v-list-item-title>
                  <v-list-item-subtitle>Recibe notificaciones en el navegador cuando haya cambios o nuevos items en el
                    stock.</v-list-item-subtitle>
                  <template v-slot:append>
                    <v-switch v-model="stockNotificationsEnabled" color="primary" inset hide-details
                      @update:model-value="requestNotificationPermission"></v-switch>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>
      </div>

    </div>

    <!-- ==========  EGRESOS DIALOG  ========== -->
    <v-dialog v-model="showEgresoDialog" max-width="500px" persistent>
      <v-card>
        <v-card-title>
          <span>{{ editingEgreso ? 'Editar Egreso' : 'Nuevo Egreso' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeEgresoDialog" class="float-right"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="egresoForm">
            <v-text-field v-model="egresoFormData.tipo_egreso" label="Tipo de Egreso" variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
            <v-text-field v-model="egresoFormData.nombre" label="Nombre/Descripción" variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
            <v-row>
              <v-col cols="6">
                <v-text-field v-model.number="egresoFormData.precio" label="Precio" type="number" variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field v-model.number="egresoFormData.cantidad" label="Cantidad" type="number" variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
            </v-row>
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
                <v-text-field v-model="eventFormData.time" label="Hora" type="time" variant="outlined" density="compact"
                  :rules="[v => !!v || 'La hora es requerida']"></v-text-field>
              </v-col>
            </v-row>

            <v-text-field v-model="eventFormData.subject" label="Asunto / Nombre del Evento" variant="outlined"
              density="compact" :rules="[v => !!v || 'El asunto es requerido']"></v-text-field>

            <v-textarea v-model="eventFormData.description" label="Descripción" variant="outlined" density="compact"
              rows="3"></v-textarea>

            <v-select v-model="eventFormData.procedureId" label="Tipo de entrega" :items="deliveryOptions"
              item-title="name" item-value="id" variant="outlined" density="compact"
              :rules="[v => !!v || 'Debe seleccionar un tipo de entrega']">
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
                <v-select v-model="eventFormData.eventReason" label="Tipo de compra" :items="eventReasons"
                  variant="outlined" density="compact"
                  :rules="[v => !!v || 'El tipo de compra es requerido']"></v-select>
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
                <div class="detail-label">Tipo de Compra</div>
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
              <div class="event-color-indicator" :style="{ backgroundColor: event.color || '#3b82f6' }">
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

    <!-- ==========  SERVICIOS EDIT DIALOG  ========== -->
    <v-dialog v-model="showServicioDialog" max-width="500px">
      <v-card style="background: var(--surface); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px;">
        <v-card-title class="event-dialog-title" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 20px;">
          <span style="font-size: 1.25rem; font-weight: 600;">{{ editingServicioId ? 'Editar Servicio Espacial' : 'Nuevo Servicio' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="showServicioDialog = false"></v-btn>
        </v-card-title>
        <v-card-text style="padding: 24px;">
          <v-form @submit.prevent="saveServicio">
            <v-text-field v-model="servicioFormData.servicio" label="Nombre del Servicio" variant="outlined" density="compact"
              class="mb-4" :rules="[v => !!v || 'Requerido']"></v-text-field>

            <v-textarea v-model="servicioFormData.descripcion" label="Descripción (Opcional)" variant="outlined" density="compact"
              class="mb-4" rows="2"></v-textarea>

            <v-row>
              <v-col cols="6">
                <v-text-field v-model.number="servicioFormData.precio" label="Precio (S/)" type="number" variant="outlined" density="compact"
                  class="mb-4" :rules="[v => v >= 0 || 'Inválido']"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="servicioFormData.icono" label="Ícono (ej. mdi-star)" variant="outlined" density="compact"
                  class="mb-4" prepend-inner-icon="mdi-emoticon-cool-outline"></v-text-field>
              </v-col>
            </v-row>

            <div class="mt-2 mb-2">
              <label class="form-label" style="display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Color del Servicio</label>
              <v-color-picker v-model="servicioFormData.color" mode="hex" width="100%" elevation="0" hide-inputs
                style="background: transparent; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;"></v-color-picker>
            </div>
            
            <v-card-actions style="padding: 16px 0 0 0; margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.05);">
              <v-spacer></v-spacer>
              <v-btn color="error" variant="text" v-if="editingServicioId" @click="deleteServicio(editingServicioId)">
                <v-icon icon="mdi-delete" class="mr-2" /> Eliminar
              </v-btn>
              <v-btn color="grey" variant="text" @click="showServicioDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="elevated" type="submit" style="background: linear-gradient(135deg, #6366f1, #a855f7); border: none;" :loading="loadingServicios">
                {{ editingServicioId ? 'Guardar Cambios' : 'Crear Servicio' }}
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ==========  CREATE USER DIALOG  ========== -->
    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'

const { logActivity } = useActivityLogger()
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, dashboards } from '@/utils/permissions'

import SettingsView from '@/components/Settings/SettingsView.vue'

definePageMeta({
  middleware: 'auth-dashboard'
})

// ...

// ... (skipping down to onMounted)

onMounted(() => {
  // Access Control
  if (!isSuperAdmin(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  applyTheme()
  fetchServicios()
  fetchLeads()
  fetchCompras()
  fetchReservas()
  fetchGlobalAccounting()

  handleZoom('one_month')
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()

  // DIAGNOSTICO
  runDiagnostics()
})

// Recuperar datos del usuario desde la cookie para mostrar el nombre real
const showDashboardMenu = ref(false)
/* ---------------- DEFINICIÓN DE TIPO ---------------- */
// Esto le enseña a TypeScript qué forma tienen tus datos
interface UserSession {
  id: string
  email: string
  full_name: string
  role: string
  company_id?: string
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
    role: '',
    company_id: ''
  }
})

// Variables reactivas
const n8nLoading = ref(false)

// Función para llamar a TU servidor (que a su vez llama a n8n)
const toggleN8nWorkflow = async (turnOn: boolean) => {
  if (!confirm(`¿Confirmas que deseas ${turnOn ? 'ACTIVAR' : 'DESACTIVAR'} la IA?`)) return

  n8nLoading.value = true
  try {
    // Llamamos al archivo que creamos en server/api/n8n/toggle-workflow
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
const contribuyentes = ref<any[]>([])
const compras = ref<any[]>([])

// Reservas
const reservas = ref<any[]>([])
const loadingReservas = ref(false)
const reservasSearch = ref('')

const headersReservas = ref([
  { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Nº Celular', key: 'numero_celular', sortable: true },
  { title: 'Correo', key: 'correo', sortable: true },
  { title: 'Local Deseado', key: 'local_deseado', sortable: true },
  { title: 'Fecha Reserva', key: 'fecha_reserva', sortable: true },
  { title: 'Hora Reserva', key: 'hora_reserva', sortable: true },
  { title: 'Producto', key: 'producto_reservado', sortable: true },
  { title: 'Cantidad', key: 'cantidad', sortable: true },
  { title: 'Método Pago', key: 'metodo_pago_reserva', sortable: true },
  { title: 'Descripción', key: 'descripcion', sortable: true },
])

const ventasSearch = ref('')
const tipoVentaSeleccionada = ref('Salto Tandem')

const headersVentas = computed(() => {
  // Las mismas columnas para Salto Tandem, Curso Paracaidismo y Curso Acelerado
  return [
    { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
    { title: 'DNI/Pasaporte/CE', key: 'dni_pasaporte_ce', sortable: true },
    { title: 'Peso (Kg)', key: 'peso_kg', sortable: true },
    { title: 'Estatura (cm)', key: 'estatura_cm', sortable: true },
    { title: 'Nacionalidad', key: 'nacionalidad', sortable: true },
    { title: 'Tipo de Servicio', key: 'tipo_servicio', sortable: true },
    { title: 'Edad', key: 'edad', sortable: true },
    { title: 'Número', key: 'numero', sortable: true },
    { title: 'Correo', key: 'correo', sortable: true },
    { title: 'Camarógrafo Externo', key: 'camarografo_externo', sortable: true },
    { title: 'Talla Camisa', key: 'talla_camisa', sortable: true },
    { title: 'Talla Pantalón', key: 'talla_pantalon', sortable: true },
  ]
})

// React to dropdown changes by refetching data
watch(tipoVentaSeleccionada, () => {
  fetchCompras()
})

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

/* ---------------- Fetch Data from Supabase (con $fetch nativo de Nuxt) ---------------- */
const fetchContribuyentes = async () => {
  loading.value = true
  try {
    const { data, error } = await client
      .from('contribuyentes')
      .select('*')

    if (error) throw error

    contribuyentes.value = data as any[]
    console.log('Datos cargados:', data)
  } catch (error) {
    console.error('Error al cargar datos:', error)
  } finally {
    loading.value = false
  }
}

const fetchCompras = async () => {
  loading.value = true

  let tableName = 'skip_salto_tandem'
  if (tipoVentaSeleccionada.value === 'Curso Paracaidismo') {
    tableName = 'skip_curso_paracaidismo'
  } else if (tipoVentaSeleccionada.value === 'Curso Acelerado') {
    tableName = 'skip_curso_acelerado'
  }

  try {
    const { data, error } = await client
      .from(tableName)
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

const fetchReservas = async () => {
  loadingReservas.value = true
  try {
    const { data, error } = await client
      .from('skip_reservas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    reservas.value = data as any[]
  } catch (error) {
    console.error('Error al cargar reservas:', error)
  } finally {
    loadingReservas.value = false
  }
}

// ======================== GLOBAL ACCOUNTING ========================
const globalMotorizado = ref<any[]>([])
const globalCourier = ref<any[]>([])
const globalTienda = ref<any[]>([])
const globalReservas = ref<any[]>([])
const loadingGlobalAccounting = ref(false)

const parsePrice = (priceStr: any): number => {
  if (!priceStr) return 0
  const str = String(priceStr).replace(/[^0-9.-]+/g, "")
  const val = parseFloat(str)
  return isNaN(val) ? 0 : val
}

const parseQuantity = (qty: any): number => {
  if (!qty) return 0
  const val = parseInt(String(qty), 10)
  return isNaN(val) ? 0 : val
}

const fetchGlobalAccounting = async () => {
  loadingGlobalAccounting.value = true
  try {
    const [resMot, resCou, resTie, resRes] = await Promise.all([
      client.from('skip_salto_tandem').select('precio, cantidad'),
      client.from('skip_curso_paracaidismo').select('precio, cantidad'),
      client.from('skip_curso_acelerado').select('precio, cantidad'),
      client.from('skip_reservas').select('precio, cantidad')
    ])

    globalMotorizado.value = resMot.data || []
    globalCourier.value = resCou.data || []
    globalTienda.value = resTie.data || []
    globalReservas.value = resRes.data || []
  } catch (e) {
    console.error("Error loading global accounting:", e)
  } finally {
    loadingGlobalAccounting.value = false
  }
}

// Global Metrics Computed Properties
const globalMotorizadoRevenue = computed(() => globalMotorizado.value.reduce((acc, curr) => acc + parsePrice(curr.precio), 0))
const globalCourierRevenue = computed(() => globalCourier.value.reduce((acc, curr) => acc + parsePrice(curr.precio), 0))
const globalTiendaRevenue = computed(() => globalTienda.value.reduce((acc, curr) => acc + parsePrice(curr.precio), 0))
const globalReservasRevenue = computed(() => globalReservas.value.reduce((acc, curr) => acc + parsePrice(curr.precio), 0))

const totalGlobalRevenue = computed(() => globalMotorizadoRevenue.value + globalCourierRevenue.value + globalTiendaRevenue.value + globalReservasRevenue.value)

const globalMotorizadoSales = computed(() => globalMotorizado.value.reduce((acc, curr) => acc + parseQuantity(curr.cantidad), 0))
const globalCourierSales = computed(() => globalCourier.value.reduce((acc, curr) => acc + parseQuantity(curr.cantidad), 0))
const globalTiendaSales = computed(() => globalTienda.value.reduce((acc, curr) => acc + parseQuantity(curr.cantidad), 0))
const globalReservasSales = computed(() => globalReservas.value.reduce((acc, curr) => acc + parseQuantity(curr.cantidad), 0))

const totalGlobalSales = computed(() => globalMotorizadoSales.value + globalCourierSales.value + globalTiendaSales.value + globalReservasSales.value)

// Updated Charts Configuration based on global data
const accountingRevenueSeries = computed(() => [
  globalMotorizadoRevenue.value,
  globalCourierRevenue.value,
  globalTiendaRevenue.value,
  globalReservasRevenue.value
])

const accountingRevenueOptions = ref<ApexOptions>({
  chart: { type: 'donut', background: 'transparent' },
  labels: ['Motorizado', 'Courier', 'Tienda', 'Reservas'],
  colors: ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24'],
  theme: { mode: 'dark' },
  dataLabels: { enabled: true },
  stroke: { show: false },
  legend: { position: 'bottom' }
})

const accountingQuantitySeries = computed(() => [
  {
    name: 'Productos Vendidos',
    data: [
      globalMotorizadoSales.value,
      globalCourierSales.value,
      globalTiendaSales.value,
      globalReservasSales.value
    ]
  }
])

const accountingQuantityOptions = ref<ApexOptions>({
  chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
  xaxis: { categories: ['Motorizado', 'Courier', 'Tienda', 'Reservas'] },
  colors: ['#a78bfa', '#facc15', '#38bdf8', '#fb7185'],
  theme: { mode: 'dark' },
  plotOptions: { bar: { borderRadius: 4, distributed: true } },
  dataLabels: { enabled: true }
})
// =================================================================

// Stats para Compras
const comprasMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  return compras.value.filter(c => {
    const d = new Date(c.created_at || c.fecha || now)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
})

const comprasMesAnterior = computed(() => {
  const now = new Date()
  let prevMonth = now.getMonth() - 1
  let prevYear = now.getFullYear()

  if (prevMonth < 0) {
    prevMonth = 11
    prevYear--
  }

  return compras.value.filter(c => {
    const d = new Date(c.created_at || c.fecha || new Date())
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear
  })
})

const growthPercentage = computed(() => {
  const current = comprasMesActual.value.length
  const previous = comprasMesAnterior.value.length

  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
})

/* ---------------- CRUD Operations ---------------- */
const editItem = (item: any) => {
  console.log('Editar:', item)
  // Implementa tu lógica de edición aquí
}

const deleteItem = async (item: any) => {
  if (!confirm(`¿Eliminar contribuyente ${item.nombre}?`)) return

  try {
    const { error } = await client
      .from('contribuyentes')
      .delete()
      .eq('id', item.id)

    if (error) throw error

    await fetchContribuyentes()
  } catch (error) {
    console.error('Error al eliminar:', error)
  }
}

/* ---------------- Estado General ---------------- */
const activeView = ref('dashboard')
const facturacionTab = ref('resumen')
const activeTab = ref('ventas')
const showUserMenu = ref(false)
const serviciosMenuOpen = ref(false)

/* ---------------- LEADS LOGIC ---------------- */
const leadsWhatsapp = ref<any[]>([])
const leadsInstagram = ref<any[]>([])
const loadingLeads = ref(false)
const leadsSearch = ref('')
const showCreateUserDialog = ref(false)
//const showSettingsDialog = ref(false)

// Headers for WhatsApp
const headersLeadsWhatsapp = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

// Headers for Instagram
const headersLeadsInstagram = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Instagram', key: 'instagram_handle', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

// Generic Headers for Dashboard Summary (Mixed types)
const headersLeads = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

const formatFecha = (dateString: string) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  
  let hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  hours = hours ? hours : 12

  return `${day} ${month} ${year} - ${hours}:${minutes}${ampm}`
}

const fetchLeads = async () => {
  loadingLeads.value = true
  try {
    // 1. Fetch Whatsapp Leads
    const { data: dataWpp, error: errorWpp } = await client
      .from('GeneralBDwppSKIP')
      .select('*')
      .order('id', { ascending: false })

    if (errorWpp) throw errorWpp
    leadsWhatsapp.value = dataWpp as any[]

    // 2. Fetch Instagram Leads
    const { data: dataIg, error: errorIg } = await client
      .from('GeneralBDfbigSKIP')
      .select('*')
      .order('id', { ascending: false })

    if (errorIg) throw errorIg
    leadsInstagram.value = dataIg as any[]

    console.log('Leads loaded. Wpp:', dataWpp?.length, 'IG:', dataIg?.length)
  } catch (error) {
    console.error('Error loading leads:', error)
  } finally {
    loadingLeads.value = false
  }
}

// Unified Leads for Stats
const leads = computed(() => {
  return [...leadsWhatsapp.value, ...leadsInstagram.value]
})

// Computed Stats for Leads (using the unified 'leads' computed property)
const totalLeads = computed(() => leads.value.length)

const leadsMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  return leads.value.filter(l => {
    if (!l.created_at) return false // Safety check if created_at is missing
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

const leadsGrowthPercentage = computed(() => {
  const current = leadsMesActual.value.length
  const previous = leadsMesAnterior.value.length

  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
})

// Status counts (Case insensitive safety)
const coldLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('fri') || l.lead_status?.toLowerCase().includes('frío')).length)
const warmLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('tibi')).length)
const hotLeadsCount = computed(() => leads.value.filter(l => l.lead_status?.toLowerCase().includes('caliente')).length)

const conversionRate = computed(() => {
  if (totalLeads.value === 0) return 0
  return (hotLeadsCount.value / totalLeads.value) * 100
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

/* ---------------- FACTURACIÓN LOGIC ---------------- */

// Helper para parsear moneda "S/ 1,200.00" -> 1200.00
const parseCurrency = (val: string | number | undefined | null) => {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return val
  if (!val) return 0
  // Remueve todo excepto números, puntos y signo negativo
  return parseFloat(val.toString().replace(/[^0-9.-]+/g, '')) || 0
}

// 1. Ingresos del Mes Actual
const revenueCurrentMonth = computed(() => {
  return comprasMesActual.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

// 2. Ingresos del Mes Anterior (para comparar tendencia)
const revenuePreviousMonth = computed(() => {
  return comprasMesAnterior.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
})

const revenueGrowth = computed(() => {
  if (revenuePreviousMonth.value === 0) return revenueCurrentMonth.value > 0 ? 100 : 0
  return ((revenueCurrentMonth.value - revenuePreviousMonth.value) / revenuePreviousMonth.value) * 100
})

// 3. Cantidad de Ventas (Transacciones)
const salesCountCurrentMonth = computed(() => comprasMesActual.value.length)
const salesCountPreviousMonth = computed(() => comprasMesAnterior.value.length)
const salesGrowth = computed(() => {
  if (salesCountPreviousMonth.value === 0) return salesCountCurrentMonth.value > 0 ? 100 : 0
  return ((salesCountCurrentMonth.value - salesCountPreviousMonth.value) / salesCountPreviousMonth.value) * 100
})

// 4. Ticket Promedio (AOV) histórico total
const averageOrderValue = computed(() => {
  if (compras.value.length === 0) return 0
  const totalRev = compras.value.reduce((sum, item) => sum + parseCurrency(item.precio), 0)
  return totalRev / compras.value.length
})

// 5. Tasa de Conversión Real (Leads que compran)
// Se basa en coincidencia de número de teléfono
const realConversionRate = computed(() => {
  if (leads.value.length === 0) return 0

  // Set de teléfonos de personas que han comprado (históricamente)
  const buyerPhones = new Set(compras.value.map(c => c.numero))

  // Cuántos leads coinciden con ese set
  const convertedLeads = leads.value.filter(l => buyerPhones.has(l.numero)).length

  return (convertedLeads / leads.value.length) * 100
})

const convertedLeadsCountReal = computed(() => {
  const buyerPhones = new Set(compras.value.map(c => c.numero))
  return leads.value.filter(l => buyerPhones.has(l.numero)).length
})


// --- GRATÍCOS FACTURACIÓN ---

// A. Gráfico de Ingresos Diarios (Mes Actual)
const revenueChartSeries = computed(() => {
  // Inicializar días del mes con 0
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dailyRevenue = new Array(daysInMonth).fill(0)

  comprasMesActual.value.forEach(c => {
    const d = new Date(c.created_at || c.fecha || new Date())
    const dayIndex = d.getDate() - 1 // 0-indexed
    if (dayIndex >= 0 && dayIndex < daysInMonth) {
      dailyRevenue[dayIndex] += parseCurrency(c.precio)
    }
  })

  return [{
    name: 'Ingresos Diarios',
    data: dailyRevenue
  }]
})

const revenueChartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'area',
    height: 350,
    fontFamily: 'inherit',
    toolbar: { show: false },
    background: 'transparent'
  },
  xaxis: {
    categories: Array.from({ length: new Date().getDate() }, (_, i) => i + 1), // Solo mostrar hasta el día actual
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } },
    tooltip: { enabled: false }
  },
  yaxis: {
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' }, formatter: (val) => `S/ ${val.toFixed(0)}` }
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#10b981'], // Emerald green
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.1, stops: [0, 90, 100] } },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))

// B. Gráfico de Conversión (Pie Chart)
const conversionChartSeries = computed(() => {
  const converted = convertedLeadsCountReal.value
  const notConverted = leads.value.length - converted
  return [converted, notConverted]
})

const conversionChartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'donut',
    fontFamily: 'inherit',
    background: 'transparent'
  },
  states: {
    active: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } }
  },
  labels: ['Compraron', 'No Compraron'],
  colors: ['#10b981', '#ef4444'], // Green vs Red
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true },
          value: { show: true, color: isDark.value ? '#fff' : '#333' },
          total: {
            show: true,
            label: 'Total Leads',
            color: isDark.value ? '#a1a1aa' : '#666',
            formatter: function (w) {
              return leads.value.length.toString()
            }
          }
        }
      }
    }
  },
  legend: { position: 'bottom', labels: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } },
  stroke: { show: false },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))

// C. Ventas por Categoría
const salesByCategorySeries = computed(() => {
  const categories: Record<string, number> = {}

  compras.value.forEach(c => {
    const cat = c.categoria || 'Sin Categoría'
    if (!categories[cat]) categories[cat] = 0
    categories[cat] += parseCurrency(c.precio)
  })

  return [{
    name: 'Ventas Totales',
    data: Object.values(categories)
  }]
})

const salesChartCategories = computed(() => {
  const categories: Record<string, number> = {}
  compras.value.forEach(c => {
    const cat = c.categoria || 'Sin Categoría'
    if (!categories[cat]) categories[cat] = 0
  })
  return Object.keys(categories)
})

const categoryChartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'bar',
    height: 350,
    fontFamily: 'inherit',
    toolbar: { show: false },
    background: 'transparent'
  },
  states: {
    active: { filter: { type: 'none' } },
    hover: { filter: { type: 'none' } }
  },
  plotOptions: {
    bar: { borderRadius: 4, horizontal: true, barHeight: '50%' }
  },
  xaxis: {
    categories: salesChartCategories.value,
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' }, formatter: (val) => `S/ ${Number(val).toFixed(0)}` }
  },
  yaxis: {
    labels: { style: { colors: isDark.value ? '#a1a1aa' : '#3f3f46' } }
  },
  colors: ['#f59e0b'],
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))



/* ---------------- Servicios CRUD Logic ---------------- */
const serviciosItems = ref<any[]>([])
const loadingServicios = ref(false)
const serviciosSearch = ref('')
const showServicioDialog = ref(false)
const editingServicioId = ref<string | null>(null)
const servicioFormData = ref<any>({})

const filteredServicios = computed(() => {
  if (!serviciosSearch.value) return serviciosItems.value
  const query = serviciosSearch.value.toLowerCase()
  return serviciosItems.value.filter(s => 
    s.servicio?.toLowerCase().includes(query) || 
    s.descripcion?.toLowerCase().includes(query)
  )
})

async function fetchServicios() {
  loadingServicios.value = true
  try {
    const { data, error } = await client
      .from('skip_servicios')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (error) throw error
    serviciosItems.value = data || []
  } catch (error) {
    console.error('Error fetching servicios:', error)
  } finally {
    loadingServicios.value = false
  }
}

function openServicioDialog(item?: any) {
  editingServicioId.value = item ? item.id : null
  if (item) {
    servicioFormData.value = JSON.parse(JSON.stringify(item))
  } else {
    servicioFormData.value = {
      servicio: '',
      descripcion: '',
      precio: 0,
      color: '#3b82f6',
      icono: 'mdi-parachute'
    }
  }
  showServicioDialog.value = true
}

async function saveServicio() {
  loadingServicios.value = true
  try {
    const payload = {
      servicio: servicioFormData.value.servicio,
      descripcion: servicioFormData.value.descripcion,
      precio: Number(servicioFormData.value.precio),
      color: servicioFormData.value.color,
      icono: servicioFormData.value.icono
    }
    
    if (editingServicioId.value) {
      const { error } = await (client.from('skip_servicios') as any)
        .update(payload)
        .eq('id', editingServicioId.value)
      if (error) throw error
    } else {
      const { error } = await (client.from('skip_servicios') as any)
        .insert(payload)
      if (error) throw error
    }
    
    showServicioDialog.value = false
    await fetchServicios()
  } catch (error: any) {
    console.error('Error saving servicio:', error)
    alert('Error al guardar: ' + error.message)
  } finally {
    loadingServicios.value = false
  }
}

async function deleteServicio(id: string) {
  if (!confirm('¿Seguro de eliminar este servicio?')) return
  try {
    const { error } = await client.from('skip_servicios').delete().eq('id', id)
    if (error) throw error
    await fetchServicios()
  } catch (error: any) {
    console.error('Error deleting servicio:', error)
    alert('Error al eliminar: ' + error.message)
  }
}

watch(activeView, (newVal) => {
  if (newVal === 'stock' && serviciosItems.value.length === 0) fetchServicios()
  else if (newVal === 'leads' && leads.value.length === 0) fetchLeads()
})

/* ---------------- NOTIFICATIONS LOGIC ---------------- */
const stockNotificationsEnabled = ref(false)

const requestNotificationPermission = async (val: boolean | null) => {
  if (val === true) {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de escritorio')
      stockNotificationsEnabled.value = false
      return
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        stockNotificationsEnabled.value = false
      }
    }
  }
}

const triggerStockNotification = (type: string, action: string) => {
  if (stockNotificationsEnabled.value && Notification.permission === 'granted') {
    new Notification('Actualización de Stock', {
      body: `Se ha detectado un cambio (${action}) en el stock de ${type}.`,
      icon: '/favicon.ico' // O la ruta a tu logo
    })
  }
}

// Watchers simulan detección de cambios.
// En una app real, esto deberia ser vía Realtime de Supabase, pero aquí detectamos cambios locales tras fetch/edit
watch(() => serviciosItems.value.length, (newVal, oldVal) => {
  if (oldVal > 0 && newVal !== oldVal) triggerStockNotification('Stock', newVal > oldVal ? 'Agregado' : 'Eliminado')
})




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



async function runDiagnostics() {
  console.log("--- INICIANDO DIAGNÓSTICO DE SUPABASE ---")

  // 1. Verificar Sesión
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError) console.error("Error de sesión:", sessionError)
  if (session) {
    console.log("Sesión activa:", session.user.email, "| ID:", session.user.id)
  } else {
    console.warn("NO HAY SESIÓN ACTIVA EN SUPABASE AUTH")
  }

  // 2. Verificar Acceso a Tabla de Usuarios (dashboardlogin)
  if (session?.user?.email) {
    console.log("Intentando leer permisos en dashboardlogin para:", session.user.email)
    const { data, error } = await client
      .from('dashboardlogin')
      .select('email, role')
      .eq('email', session.user.email)

    if (error) {
      console.error("CRÍTICO: No se puede leer la tabla de roles (dashboardlogin).", error)
      console.error("Esto es lo que impide que funcionen tus políticas RLS en las otras tablas.")
      console.error("Causa probable: 'dashboardlogin' tiene RLS activado pero no tiene una política SELECT para el propio usuario.")
    } else {
      console.log("Acceso a dashboardlogin CORRECTO. Datos encontrados:", data)
      if (data.length === 0) console.warn("ALERTA: Se puede leer la tabla, pero NO SE ENCONTRÓ tu usuario. Revisa que el email coincida exactamente.")
    }
  }
  console.log("--- FIN DIAGNÓSTICO ---")
}

function logout() {
  logActivity('Cerró sesión')
  // 1. Borrar la cookie que mantiene la sesión abierta
  const session = useCookie('dashboard_session')
  session.value = null

  // 2. Redirigir al usuario a la pantalla de login (index.vue)
  return navigateTo('/')
}

/* ---------------- Menús ---------------- */
const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'mdi-calendar-blank', label: 'Calendario', id: 'calendario' },
  { icon: 'mdi-cart', label: 'Ventas', id: 'ventas' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' }
]

const financiasItems = [
  { icon: 'mdi-cash-minus', label: 'Egresos', id: 'egresos' },
  { icon: 'mdi-currency-usd', label: 'Contabilidad', id: 'facturacion' },
  { icon: 'mdi-chart-line', label: 'Facturación', id: 'contabilidad' }
]

const chatsItems = [
  {
    icon: 'mdi-message-reply',
    label: 'Conversaciones',
    id: 'chatwoot',
    url: 'https://chats.alef.company/app/accounts/10/dashboard'
  }
]


const documentItems: Array<{ icon: string; label: string; id: string; children?: any[] }> = [
  // { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
  {
    icon: 'mdi-folder',
    label: 'Servicios',
    id: 'stock'
  },
  { icon: 'mdi-robot-mower', label: 'Meta', id: 'meta' }
]

const navigateToChat = (url: string) => {
  if (url) {
    window.open(url, '_blank')
  }
}

/* ---------------- Stats ---------------- */
/* ---------------- Stats Reales ---------------- */
const totalRevenue = computed(() => {
  return revenueCurrentMonth.value // Ya calculado en la sección de facturación
})

const totalLeadsCount = computed(() => {
  return leads.value.length
})

const totalComprasCount = computed(() => {
  return compras.value.length
})

// Subida de Leads (Mes actual vs Mes anterior)
const leadsGrowthStat = computed(() => {
  const current = leadsMesActual.value.length
  const previous = leadsMesAnterior.value.length

  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
})

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
    title: 'Total Compras',
    value: totalComprasCount.value.toLocaleString(),
    change: '', // Podríamos calcular crecimiento de compras total si quisieramos, o dejarlo vacío
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
/* ---------------- Tabs ---------------- */
const tabs: Tab[] = [
  { label: 'Ventas', value: 'ventas' },
  { label: 'Leads', value: 'leads' },
  { label: 'Próximos Eventos', value: 'events' }
]

/* ---------------- Table Headers for Dashboard ---------------- */
// Compras: First 10 cols, no actions
const headersComprasDashboard = computed(() => {
  return headersCompras.value.slice(0, 10)
})

const headersUpcomingEvents = [
  { title: 'Fecha', key: 'date', sortable: true },
  { title: 'Hora', key: 'time', sortable: true },
  { title: 'Asunto', key: 'subject', sortable: true },
  { title: 'Cliente', key: 'clientName', sortable: true },
]

/* ---------------- ApexCharts Data ---------------- */
/* ---------------- ApexCharts Data (LEADS TOTALES) ---------------- */
const activeZoom = ref('Mes') // 'Hoy', 'Semana', 'Mes', 'Año'

const zoomButtons = [
  { id: 'Hoy', label: 'Hoy' },
  { id: 'Semana', label: 'Semana' },
  { id: 'Mes', label: 'Mes' },
  { id: 'Año', label: 'Año' }
]

function handleZoom(filter: string) {
  activeZoom.value = filter
}

const filteredLeadsForChart = computed(() => {
  const now = new Date()
  const dataMap = new Map<number, number>()
  let startTime = 0
  let endTime = now.getTime()

  // Configurar rangos
  if (activeZoom.value === 'Hoy') {
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    startTime = startOfDay.getTime()
  } else if (activeZoom.value === 'Semana') {
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    startTime = startOfWeek.getTime()
  } else if (activeZoom.value === 'Mes') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    startTime = startOfMonth.getTime()
  } else if (activeZoom.value === 'Año') {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    startTime = startOfYear.getTime()
  }

  // Filtrar y agrupar leads
  leads.value.forEach(l => {
    if (!l.created_at) return
    const d = new Date(l.created_at)
    const ts = d.getTime()

    if (ts >= startTime && ts <= endTime) {
      // Agrupar según el filtro
      let key = 0
      if (activeZoom.value === 'Hoy') {
        // Agrupar por hora
        d.setMinutes(0, 0, 0)
        key = d.getTime()
      } else if (activeZoom.value === 'Año') {
        // Agrupar por mes (primer día del mes)
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        key = d.getTime()
      } else {
        // Agrupar por día (Semana o Mes)
        d.setHours(0, 0, 0, 0)
        key = d.getTime()
      }

      dataMap.set(key, (dataMap.get(key) || 0) + 1)
    }
  })

  // Convertir Map a Array ordenado [timestamp, count]
  // Llenar huecos si es necesario? Para simplificar, devolvemos los puntos existentes. 
  // ApexCharts maneja time series bien, pero si queremos líneas continuas bonitas, podríamos llenar con 0.
  // Vamos a devolver data points ordenados.
  const sortedData = Array.from(dataMap.entries()).sort((a, b) => a[0] - b[0])
  return sortedData
})

const series = computed(() => {
  return [{
    name: 'Leads',
    data: filteredLeadsForChart.value
  }]
})

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    id: 'leads-chart',
    type: 'area',
    background: 'transparent',
    zoom: { enabled: false },
    toolbar: { show: false },
    foreColor: isDark.value ? '#a1a1aa' : '#3f3f46'
  },
  colors: ['#3b82f6'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.1,
      stops: [0, 90, 100]
    }
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  xaxis: {
    type: 'datetime',
    tooltip: { enabled: false },
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      datetimeFormatter: {
        year: 'yyyy',
        month: "MMM 'yy",
        day: 'dd MMM',
        hour: 'HH:mm'
      }
    }
  },
  yaxis: {
    labels: {
      formatter: (val) => val.toFixed(0)
    }
  },
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  tooltip: {
    theme: isDark.value ? 'dark' : 'light',
    x: {
      format: activeZoom.value === 'Hoy' ? 'dd MMM HH:mm' : 'dd MMM yyyy'
    }
  },
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
  'Perfumes',
  'Decants',
  'Sets de perfumes'
]

const deliveryOptions = [
  { id: 'domicilio', name: 'Entrega a domicilio', color: '#10b981' }
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
  if (!eventForm.value) return

  // Validate form (Vuetify will handle this)
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

  // Look up color based on selected procedureId (Delivery Type)
  const selectedDelivery = deliveryOptions.find(d => d.id === eventFormData.value.procedureId)
  const eventColor = selectedDelivery ? selectedDelivery.color : '#3b82f6'

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
      event_reason: eventFormData.value.eventReason,
      color: eventColor
    }

    if (editingEvent.value) {
      // Update
      const { error } = await (client
        .from('skip_calendar_events') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('skip_calendar_events') as any)
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
      .from('skip_calendar_events')
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

async function fetchEvents() {
  try {
    const { data, error } = await client
      .from('skip_calendar_events')
      .select('*')

    if (error) throw error

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
      color: e.color
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

  try {
    const payload = {
      name: procedureFormData.value.name,
      color: procedureFormData.value.color,
      price: procedureFormData.value.price,
      discount: procedureFormData.value.discount
    }

    if (editingProcedure.value) {
      // Update
      const { error } = await (client
        .from('skip_procedimientos') as any)
        .update(payload)
        .eq('id', editingProcedure.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('skip_procedimientos') as any)
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

async function deleteProcedure(id: string) {
  if (confirm('¿Estás seguro de que deseas eliminar este procedimiento?')) {
    try {
      const { error } = await client
        .from('skip_procedimientos')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchProcedures()
    } catch (error) {
      console.error('Error deleting procedure:', error)
      alert('Error al eliminar el procedimiento')
    }
  }
}

async function fetchProcedures() {
  try {
    const { data, error } = await client
      .from('skip_procedimientos')
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
      date_added: editingMedicalHistory.value ? undefined : new Date().toLocaleDateString(),
      attachment_name: attachmentName,
      attachment_data: attachmentData
    }

    if (editingMedicalHistory.value) {
      // Update
      const { error } = await (client
        .from('skip_client_history') as any)
        .update(payload)
        .eq('id', editingMedicalHistory.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('skip_client_history') as any)
        .insert({
          ...payload,
          date_added: new Date().toLocaleDateString()
        })

      if (error) throw error
    }

    await fetchMedicalHistory()
    closeMedicalHistoryDialog()
  } catch (error) {
    console.error('Error saving history:', error)
    alert('Error al guardar el historial')
  }
}

async function deleteMedicalHistory(id: string) {
  if (confirm('¿Eliminar este historial?')) {
    try {
      const { error } = await client
        .from('skip_client_history')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchMedicalHistory()
    } catch (error) {
      console.error('Error deleting history:', error)
      alert('Error al eliminar historial')
    }
  }
}

async function fetchMedicalHistory() {
  try {
    const { data, error } = await client
      .from('skip_client_history')
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
    console.error('Error loading history:', error)
  }
}

/* ---------------- Egresos Logic ---------------- */
const egresosList = ref<any[]>([])
const loadingEgresos = ref(false)
const showEgresoDialog = ref(false)
const editingEgreso = ref(false)
const savingEgreso = ref(false)
const egresoFormData = ref({
  id: '',
  tipo_egreso: '',
  nombre: '',
  precio: 0,
  cantidad: 1,
  company_id: 'skip'
})
const egresosHeaders = [
  { title: 'Fecha', key: 'created_at' },
  { title: 'Tipo', key: 'tipo_egreso' },
  { title: 'Nombre', key: 'nombre' },
  { title: 'Precio', key: 'precio' },
  { title: 'Cantidad', key: 'cantidad' },
  { title: 'Total', key: 'total' },
  { title: 'Acciones', key: 'actions', sortable: false }
]

const fetchEgresos = async () => {
  loadingEgresos.value = true
  const { data, error } = await (client.from('skip_egresos') as any).select('*').order('created_at', { ascending: false })
  if (!error && data) {
    egresosList.value = data
  }
  loadingEgresos.value = false
}

const totalEgresosMesActual = computed(() => {
  const now = new Date()
  const m = now.getMonth()
  const y = now.getFullYear()
  return egresosList.value.filter(e => {
    const d = new Date(e.created_at)
    return d.getMonth() === m && d.getFullYear() === y
  }).reduce((sum, e) => sum + (e.precio * e.cantidad), 0)
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
  const brutos = typeof totalRevenue !== 'undefined' ? totalRevenue.value : 0;
  return brutos - totalEgresosMesActual.value
})

const openEgresoDialog = (item?: any) => {
  if (item && item.id) {
    editingEgreso.value = true
    egresoFormData.value = { ...item }
  } else {
    editingEgreso.value = false
    egresoFormData.value = { id: '', tipo_egreso: '', nombre: '', precio: 0, cantidad: 1, company_id: 'skip' }
  }
  showEgresoDialog.value = true
}

const closeEgresoDialog = () => {
  showEgresoDialog.value = false
}

const saveEgreso = async () => {
  savingEgreso.value = true
  const payload = {
    tipo_egreso: egresoFormData.value.tipo_egreso,
    nombre: egresoFormData.value.nombre,
    precio: egresoFormData.value.precio,
    cantidad: egresoFormData.value.cantidad,
    company_id: 'skip'
  }
  if (editingEgreso.value && egresoFormData.value.id) {
    await (client.from('skip_egresos') as any).update(payload).eq('id', egresoFormData.value.id)
  } else {
    await (client.from('skip_egresos') as any).insert(payload)
  }
  savingEgreso.value = false
  closeEgresoDialog()
  fetchEgresos()
}

const deleteEgreso = async (id: string) => {
  if (confirm('¿Seguro que deseas eliminar este egreso?')) {
    await (client.from('skip_egresos') as any).delete().eq('id', id)
    fetchEgresos()
  }
}

onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessSKIP(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  fetchEgresos()
})
</script>
