<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/alegratedLOGO.jpg" alt="Alef Company Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Alegrated</span>
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
          <span v-else class="logo-text">Alegrated</span>
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
              <button :class="['nav-item', 'parent-item', { active: stockMenuOpen }]"
                @click="stockMenuOpen = !stockMenuOpen">
                <v-icon :icon="item.icon" size="18" />
                <span>{{ item.label }}</span>
                <v-icon :icon="stockMenuOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="16" class="ml-auto" />
              </button>
              <div v-show="stockMenuOpen" class="sub-nav">
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

            <N8nPanicButton client-key="alegrated" label="IA Alegrated" />

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

              <!-- TABLE: COMPRAS (Was Outline) -->
              <!-- TABLE: COMPRAS (Split into 3) -->
              <div v-if="activeTab === 'compras'">
                <!-- LIMA -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Lima</span>
                </v-card-title>
                <v-data-table :headers="headersComprasLima" :items="comprasLima.slice(0, 10)" class="elevation-0 mb-4"
                  no-data-text="No hay compras recientes en Lima" :items-per-page="5">
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Lima')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Lima')">
                      mdi-delete
                    </v-icon>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>

                <!-- PROVINCIA -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Provincia</span>
                </v-card-title>
                <v-data-table :headers="headersComprasProvincia" :items="comprasProvincia.slice(0, 10)"
                  class="elevation-0 mb-4" no-data-text="No hay compras recientes en Provincia" :items-per-page="5">
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Provincia')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Provincia')">
                      mdi-delete
                    </v-icon>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>

                <!-- EXTRANJERO -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Extranjero</span>
                </v-card-title>
                <v-data-table :headers="headersComprasExtranjero" :items="comprasExtranjero.slice(0, 10)"
                  class="elevation-0" no-data-text="No hay compras recientes en Extranjero" :items-per-page="5">
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Extranjero')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Extranjero')">
                      mdi-delete
                    </v-icon>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <!-- TABLE: LEADS (Was Past Performance) -->
              <!-- TABLE: LEADS (Split into 2) -->
              <div v-if="activeTab === 'leads'">
                <!-- WhatsAPP -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Leads WhatsApp</span>
                </v-card-title>
                <v-data-table :headers="headersLeadsWpp" :items="leadsWpp.slice(0, 10)" class="elevation-0 mb-4"
                  no-data-text="No hay leads recientes en WhatsApp" :items-per-page="5">
                  <template v-slot:item.lead_status="{ item }">
                    <v-chip
                      :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                      size="small">
                      {{ item.lead_status }}
                    </v-chip>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>

                <!-- FB/IG -->
                <v-card-title class="table-search-bar">
                  <span class="table-title">Leads Facebook/Instagram</span>
                </v-card-title>
                <v-data-table :headers="headersLeadsFbig" :items="leadsFbig.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay leads recientes en FB/IG" :items-per-page="5">
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
      <SettingsView v-else-if="activeView === 'settings'" company-id="Alegrated"
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

      <!-- ==========  VISTA: COMPRAS (antes Pacientes)  ========== -->
      <div v-else-if="activeView === 'compras'" class="view-container">
        <header class="top-header">
          <h1>Compras</h1>
          <button class="btn-primary" @click="openCompraDialog">
            <v-icon icon="mdi-cart-plus" size="16" />
            <span>Nueva Compra</span>
          </button>
        </header>

        <div class="content-area">
          <div class="stats-grid mini two-columns">
            <div class="stat-card center-content">
              <div class="stat-value">{{ compras.length }}</div>
              <div class="stat-title">Total Histórico</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ comprasMesActual.length }}</div>
              <div class="stat-title">Compras este Mes</div>
              <div class="stat-change" :class="growthPercentage >= 0 ? 'up' : 'down'">
                {{ growthPercentage >= 0 ? '+' : '' }}{{ growthPercentage.toFixed(1) }}% vs mes anterior
              </div>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de Compras</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Buscar" single-line hide-details
                  density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <div class="d-flex justify-end align-center mb-4 mt-2">
                <v-select v-model="selectedComprasCategory" :items="comprasCategories" label="Categoría"
                  variant="outlined" density="compact" hide-details
                  style="max-width: 200px; min-width: 180px;"></v-select>
              </div>

              <!-- LIMA -->
              <v-card v-if="selectedComprasCategory === 'Lima'" flat class="mb-4 fade-in">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Lima</span>
                </v-card-title>
                <v-data-table :headers="headersComprasLima" :items="comprasLima" :search="search" :loading="loading"
                  class="elevation-0" no-data-text="No hay compras recientes en Lima" :items-per-page="15"
                  :items-per-page-options="itemsPerPageOptions">
                  <template v-slot:item.created_at="{ item }">
                    {{ new Date(item.created_at).toLocaleDateString() }}
                  </template>
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Lima')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Lima')">
                      mdi-delete
                    </v-icon>
                  </template>
                </v-data-table>
              </v-card>

              <!-- PROVINCIA -->
              <v-card v-if="selectedComprasCategory === 'Provincia'" flat class="mb-4 fade-in">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Provincia</span>
                </v-card-title>
                <v-data-table :headers="headersComprasProvincia" :items="comprasProvincia" :search="search"
                  :loading="loading" class="elevation-0" no-data-text="No hay compras recientes en Provincia"
                  :items-per-page="15" :items-per-page-options="itemsPerPageOptions">
                  <template v-slot:item.created_at="{ item }">
                    {{ new Date(item.created_at).toLocaleDateString() }}
                  </template>
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Provincia')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Provincia')">
                      mdi-delete
                    </v-icon>
                  </template>
                </v-data-table>
              </v-card>

              <!-- EXTRANJERO -->
              <v-card v-if="selectedComprasCategory === 'Extranjero'" flat class="mb-4 fade-in">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Compras Extranjero</span>
                </v-card-title>
                <v-data-table :headers="headersComprasExtranjero" :items="comprasExtranjero" :search="search"
                  :loading="loading" class="elevation-0" no-data-text="No hay compras recientes en Extranjero"
                  :items-per-page="15" :items-per-page-options="itemsPerPageOptions">
                  <template v-slot:item.created_at="{ item }">
                    {{ new Date(item.created_at).toLocaleDateString() }}
                  </template>
                  <template v-slot:item.actions="{ item }">
                    <v-icon size="small" class="me-2" @click="editCompra(item, 'Extranjero')">
                      mdi-pencil
                    </v-icon>
                    <v-icon size="small" @click="deleteCompra(item, 'Extranjero')">
                      mdi-delete
                    </v-icon>
                  </template>
                </v-data-table>
              </v-card>
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

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <!-- WHATSAPP LEADS -->
              <v-card-title class="table-search-bar">
                <span class="table-title">Leads WhatsApp</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="leadsSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersLeadsWpp" :items="leadsWpp" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0 mb-4" no-data-text="No hay leads recientes en WhatsApp" :items-per-page="5">
                <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status }}
                  </v-chip>
                </template>
              </v-data-table>

              <!-- FB/IG LEADS -->
              <v-card-title class="table-search-bar mt-4">
                <span class="table-title">Leads Facebook & Instagram</span>
              </v-card-title>
              <v-data-table :headers="headersLeadsFbig" :items="leadsFbig" :search="leadsSearch" :loading="loadingLeads"
                class="elevation-0" no-data-text="No hay leads recientes en FB/IG" :items-per-page="5">
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
              <div class="stat-title">Ingresos Brutos (Mes Actual)</div>
              <div class="stat-value">S/ {{ revenueCurrentMonth.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div :class="['stat-change', revenueGrowth >= 0 ? 'up' : 'down']">
                <v-icon :icon="revenueGrowth >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'" size="12" />
                {{ Math.abs(revenueGrowth).toFixed(1) }}% vs mes anterior
              </div>
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
              <div class="stat-subtitle">Ingresos Brutos - Egresos</div>
            </div>

            <div class="stat-card">
              <div class="stat-title">Ventas (Cantidad)</div>
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
              <div class="stat-subtitle">Promedio por venta este mes</div>
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
                <h2>Tendencia de Facturación (Diaria)</h2>
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
                <v-list-item v-for="compra in comprasMesActual.slice(0, 6)" :key="compra.id" lines="two"
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

      <!-- ==========  VISTA: STOCK  ========== -->
      <div v-else-if="activeView === 'stock'" class="view-container">
        <header class="top-header">
          <h1>Stock</h1>
          <div class="header-actions">
            <button class="btn-primary" @click="openStockDialog()">
              <v-icon icon="mdi-plus" size="16" />
              <span>Nuevo Producto</span>
            </button>
            <button class="btn-warning ml-2" @click="fetchStockData()">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Productos en Stock</span>
                <v-spacer></v-spacer>
                <v-text-field v-model="stockSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersStock" :items="stockProducts" :search="stockSearch" :loading="loadingStock"
                class="elevation-0" no-data-text="No hay productos en stock">
                <template v-slot:item.precio_nacional="{ item }">
                  S/ {{ item.precio_nacional }}
                </template>
                <template v-slot:item.precio_extranjero="{ item }">
                  $ {{ item.precio_extranjero }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <div class="d-flex">
                    <button class="icon-btn mr-1" @click="openStockDialog(item)">
                      <v-icon icon="mdi-pencil" size="16" />
                    </button>
                    <button class="icon-btn" @click="deleteStock(item.id)">
                      <v-icon icon="mdi-delete" size="16" />
                    </button>
                  </div>
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

    <!-- ==========  STOCK EDIT DIALOG  ========== -->
    <v-dialog v-model="showStockDialog" max-width="500px">
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingStockId ? 'Editar Item' : 'Nuevo Item' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="showStockDialog = false"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveStock">

            <v-text-field v-model="stockFormData.nombre_del_producto" label="Nombre del Producto" variant="outlined"
              density="compact" class="mb-2" :rules="[v => !!v || 'Campo requerido']"></v-text-field>

            <v-text-field v-model="stockFormData.tipo" label="Tipo" variant="outlined" density="compact" class="mb-2"
              :rules="[v => !!v || 'Campo requerido']"></v-text-field>

            <v-text-field v-model="stockFormData.tamanio" label="Tamaño" variant="outlined" density="compact"
              class="mb-2"></v-text-field>

            <v-row>
              <v-col cols="6">
                <v-text-field v-model.number="stockFormData.precio_nacional" label="Precio Nacional (S/)" type="number"
                  variant="outlined" density="compact"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field v-model.number="stockFormData.precio_extranjero" label="Precio Extranjero ($)"
                  type="number" variant="outlined" density="compact"></v-text-field>
              </v-col>
            </v-row>

            <v-text-field v-model.number="stockFormData.stock" label="Stock" type="number" variant="outlined"
              density="compact" class="mt-2"></v-text-field>

            <v-select v-model="stockFormData.disponibilidad" label="Disponibilidad"
              :items="['Disponible', 'Agotado', 'Pocos']" variant="outlined" density="compact" class="mt-4"></v-select>

          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showStockDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveStock">
            {{ editingStockId ? 'Actualizar' : 'Guardar' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  NEW PURCHASE DIALOG  ========== -->
    <v-dialog v-model="showCompraDialog" max-width="700px">
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>Nueva Compra - {{ compraFormData.targetTable }}</span>
          <v-btn icon="mdi-close" variant="text" @click="showCompraDialog = false"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form ref="compraForm" @submit.prevent="saveCompra">
            <v-select v-model="compraFormData.targetTable" label="Destino" :items="['Lima', 'Provincia', 'Extranjero']"
              variant="outlined" density="compact" :rules="[v => !!v || 'Seleccione un destino']"
              class="mb-4"></v-select>

            <!-- CAMPOS COMUNES -->
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="compraFormData.nombre_completo" label="Nombre Completo" variant="outlined"
                  density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="compraFormData.telefono" label="Teléfono / Celular" variant="outlined"
                  density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
            </v-row>

            <!-- CAMPOS LIMA -->
            <div v-if="compraFormData.targetTable === 'Lima'">
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.distrito" label="Distrito" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.referencia" label="Referencia" variant="outlined"
                    density="compact"></v-text-field>
                </v-col>
              </v-row>
              <v-text-field v-model="compraFormData.direccion_exacta" label="Dirección Exacta" variant="outlined"
                density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
            </div>

            <!-- CAMPOS PROVINCIA -->
            <div v-if="compraFormData.targetTable === 'Provincia'">
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.dni" label="DNI" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.region" label="Región" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.provincia" label="Provincia" variant="outlined"
                    density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.distrito" label="Distrito" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
              </v-row>
              <v-text-field v-model="compraFormData.agencia_shalom" label="Agencia Shalom" variant="outlined"
                density="compact"></v-text-field>
            </div>

            <!-- CAMPOS EXTRANJERO -->
            <div v-if="compraFormData.targetTable === 'Extranjero'">
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.pais" label="País" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.ciudad" label="Ciudad" variant="outlined" density="compact"
                    :rules="[v => !!v || 'Requerido']"></v-text-field>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.codigo_postal" label="Código Postal" variant="outlined"
                    density="compact"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="compraFormData.email" label="Email" variant="outlined" density="compact"
                    type="email"></v-text-field>
                </v-col>
              </v-row>
              <v-text-field v-model="compraFormData.direccion_completa" label="Dirección Completa" variant="outlined"
                density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
            </div>

            <v-divider class="my-4"></v-divider>

            <!-- PRODUCTOS Y PRECIO (COMUNES) -->
            <v-textarea v-model="compraFormData.productos" label="Productos Comprados" variant="outlined"
              density="compact" rows="2" :rules="[v => !!v || 'Requerido']"></v-textarea>

            <v-row>
              <v-col cols="6">
                <v-text-field v-model="compraFormData.precio" label="Precio Total" prefix="S/" type="number"
                  variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-select v-model="compraFormData.status" label="Estado"
                  :items="['Entregado', 'Pendiente', 'Cancelado']" variant="outlined" density="compact"
                  :rules="[v => !!v || 'Requerido']"></v-select>
              </v-col>
            </v-row>

          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showCompraDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveCompra" :loading="loading">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ==========  CREATE USER DIALOG  ========== -->
    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessAlegrated, dashboards } from '@/utils/permissions'

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

definePageMeta({
  middleware: 'auth-dashboard'
})

const { logActivity } = useActivityLogger()

// ...

// ... (skipping down to onMounted)

onMounted(() => {
  // Access Control
  const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessAlegrated(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  applyTheme()
  fetchStockData()
  fetchLeads()
  fetchCompras()
  handleZoom('one_month')
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
const comprasLima = ref<any[]>([])
const comprasProvincia = ref<any[]>([])
const comprasExtranjero = ref<any[]>([])

// Agregación para estadísticas
const compras = computed(() => [...comprasLima.value, ...comprasProvincia.value, ...comprasExtranjero.value])

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

const selectedComprasCategory = ref('Lima')
const comprasCategories = ['Lima', 'Provincia', 'Extranjero']
const itemsPerPageOptions = [15, 25, 50, 100, { title: 'Todos', value: -1 }]

const headersComprasLima = ref([
  { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
  { title: 'Teléfono', key: 'telefono', sortable: true },
  { title: 'Distrito', key: 'distrito', sortable: true },
  { title: 'Dirección Exacta', key: 'direccion_exacta', sortable: true },
  { title: 'Referencia', key: 'referencia', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
])

const headersComprasProvincia = ref([
  { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
  { title: 'DNI', key: 'dni', sortable: true },
  { title: 'Teléfono', key: 'telefono', sortable: true },
  { title: 'Región', key: 'region', sortable: true },
  { title: 'Provincia', key: 'provincia', sortable: true },
  { title: 'Distrito', key: 'distrito', sortable: true },
  { title: 'Agencia Shalom', key: 'agencia_shalom', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
])

const headersComprasExtranjero = ref([
  { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
  { title: 'Dirección Completa', key: 'direccion_completa', sortable: true },
  { title: 'Ciudad', key: 'ciudad', sortable: true },
  { title: 'Código Postal', key: 'codigo_postal', sortable: true },
  { title: 'País', key: 'pais', sortable: true },
  { title: 'Teléfono', key: 'telefono', sortable: true },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
])

const headersCompras = ref([
  { title: 'Nombre Completo', key: 'nombre_completo', sortable: true },
  { title: 'Teléfono', key: 'telefono', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
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
  try {
    const [lima, provincia, extranjero] = await Promise.all([
      client.from('compraswpplimaalegrated').select('*').order('created_at', { ascending: false }),
      client.from('compraswppprovinciaalegrated').select('*').order('created_at', { ascending: false }),
      client.from('compraswppextranjeroalegrated').select('*').order('created_at', { ascending: false })
    ])

    if (lima.error) console.error('Error fetching Lima:', lima.error)
    if (provincia.error) console.error('Error fetching Provincia:', provincia.error)
    if (extranjero.error) console.error('Error fetching Extranjero:', extranjero.error)

    comprasLima.value = lima.data as any[] || []
    comprasProvincia.value = provincia.data as any[] || []
    comprasExtranjero.value = extranjero.data as any[] || []

  } catch (error) {
    console.error('Error al cargar compras:', error)
  } finally {
    loading.value = false
  }
}

// Stats para Compras
const comprasMesActual = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  return compras.value.filter(c => {
    const d = new Date(c.created_at)
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
    const d = new Date(c.created_at)
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

/* ---------------- Nueva Compra Logic ---------------- */
const showCompraDialog = ref(false)
const editingCompraId = ref<number | null>(null) // Track editing state
const compraForm = ref<any>(null)
const compraFormData = ref({
  targetTable: 'Lima',
  nombre_completo: '',
  telefono: '',
  productos: '',
  precio: '',
  status: 'Entregado',
  // Lima
  distrito: '',
  direccion_exacta: '',
  referencia: '',
  // Provincia
  dni: '',
  region: '',
  provincia: '',
  agencia_shalom: '',
  // Extranjero
  direccion_completa: '',
  ciudad: '',
  codigo_postal: '',
  pais: '',
  email: ''
})

function openCompraDialog() {
  compraFormData.value = {
    targetTable: 'Lima',
    nombre_completo: '',
    telefono: '',
    productos: '',
    precio: '',
    status: 'Entregado',
    distrito: '',
    direccion_exacta: '',
    referencia: '',
    dni: '',
    region: '',
    provincia: '',
    agencia_shalom: '',
    direccion_completa: '',
    ciudad: '',
    codigo_postal: '',
    pais: '',
    email: ''
  }
  editingCompraId.value = null // Reset editing state
  showCompraDialog.value = true
}

function editCompra(item: any, category: string) {
  editingCompraId.value = item.id
  compraFormData.value = {
    targetTable: category,
    nombre_completo: item.nombre_completo,
    telefono: item.telefono,
    productos: item.productos_comprados,
    precio: item.precio,
    status: item.estado,
    // Lima
    distrito: item.distrito || '',
    direccion_exacta: item.direccion_exacta || '',
    referencia: item.referencia || '',
    // Provincia
    dni: item.dni || '',
    region: item.region || '',
    provincia: item.provincia || '',
    agencia_shalom: item.agencia_shalom || '',
    // Extranjero
    direccion_completa: item.direccion_completa || '',
    ciudad: item.ciudad || '',
    codigo_postal: item.codigo_postal || '',
    pais: item.pais || '',
    email: item.email || ''
  }
  showCompraDialog.value = true
}

async function deleteCompra(item: any, category: string) {
  if (!confirm(`¿Estás seguro de eliminar la compra de ${item.nombre_completo}?`)) return

  loading.value = true
  try {
    let tableName = ''
    if (category === 'Lima') tableName = 'compraswpplimaalegrated'
    else if (category === 'Provincia') tableName = 'compraswppprovinciaalegrated'
    else if (category === 'Extranjero') tableName = 'compraswppextranjeroalegrated'

    const { error } = await client
      .from(tableName)
      .delete()
      .eq('id', item.id)

    if (error) throw error

    await fetchCompras()
    alert('Compra eliminada exitosamente')
  } catch (error) {
    console.error('Error deleting compra:', error)
    alert('Error al eliminar: ' + (error as any).message)
  } finally {
    loading.value = false
  }
}

async function saveCompra() {
  const { valid } = await compraForm.value.validate()
  if (!valid) return

  loading.value = true
  try {
    let tableName = ''
    let payload: any = {}

    // Common fields
    const commonPayload = {
      nombre_completo: compraFormData.value.nombre_completo,
      telefono: compraFormData.value.telefono,
      productos_comprados: compraFormData.value.productos,
      precio: compraFormData.value.precio,
      estado: compraFormData.value.status // Assuming 'estado' as per general headers
    }

    if (compraFormData.value.targetTable === 'Lima') {
      tableName = 'compraswpplimaalegrated'
      payload = {
        ...commonPayload,
        distrito: compraFormData.value.distrito,
        direccion_exacta: compraFormData.value.direccion_exacta,
        referencia: compraFormData.value.referencia
      }
    } else if (compraFormData.value.targetTable === 'Provincia') {
      tableName = 'compraswppprovinciaalegrated'
      payload = {
        ...commonPayload,
        dni: compraFormData.value.dni,
        region: compraFormData.value.region,
        provincia: compraFormData.value.provincia,
        distrito: compraFormData.value.distrito,
        agencia_shalom: compraFormData.value.agencia_shalom
      }
    } else if (compraFormData.value.targetTable === 'Extranjero') {
      tableName = 'compraswppextranjeroalegrated'
      payload = {
        ...commonPayload,
        direccion_completa: compraFormData.value.direccion_completa,
        ciudad: compraFormData.value.ciudad,
        codigo_postal: compraFormData.value.codigo_postal,
        pais: compraFormData.value.pais,
        email: compraFormData.value.email
      }
    }

    // Workaround: Calcular ID manual para evitar error de secuencia desincronizada
    const { data: maxIdData } = await client
      .from(tableName)
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single()

    const nextId = ((maxIdData as any)?.id || 0) + 1

    if (editingCompraId.value) {
      // Update
      const { error } = await (client.from(tableName) as any)
        .update(payload)
        .eq('id', editingCompraId.value)

      if (error) throw error
      alert('Compra actualizada exitosamente')
    } else {
      // Insert
      const { error } = await (client.from(tableName) as any).insert({ ...payload, id: nextId })
      if (error) throw error
      alert('Compra registrada exitosamente')
    }

    showCompraDialog.value = false
    editingCompraId.value = null // Reset
    await fetchCompras() // Refresh lists
  } catch (error) {
    console.error('Error saving compra:', error)
    alert('Error al guardar la compra: ' + (error as any).message)
  } finally {
    loading.value = false
  }
}

/* ---------------- Estado General ---------------- */
const activeView = ref('dashboard')
const activeTab = ref('compras')
const showUserMenu = ref(false)
const stockMenuOpen = ref(false)

/* ---------------- Stock Logic ---------------- */
/* ---------------- Stock Logic ---------------- */
const stockSearch = ref('')
const loadingStock = ref(false)
const stockProducts = ref<any[]>([])

const headersStock = [
  { title: 'Nombre Producto', key: 'nombre_del_producto', sortable: true },
  { title: 'Tipo', key: 'tipo', sortable: true },
  { title: 'Tamaño', key: 'tamaño', sortable: true },
  { title: 'Precio Nacional', key: 'precio_nacional', sortable: true },
  { title: 'Precio Extranjero', key: 'precio_extranjero', sortable: true },
  { title: 'Stock', key: 'stock', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false },
]

async function fetchStockData() {
  loadingStock.value = true
  console.log(`[Alegrated] Fetching stock data`)
  try {
    const { data, error } = await client.from('productos_stock_alegrated').select('*')

    if (error) {
      console.error(`[Alegrated] Supabase error:`, error)
      throw error
    }

    stockProducts.value = data as any[]

  } catch (error) {
    console.error(`Error fetching stock:`, error)
  } finally {
    loadingStock.value = false
  }
}

/* ---------------- LEADS LOGIC ---------------- */
const leadsWpp = ref<any[]>([])
const leadsFbig = ref<any[]>([])

// Agregación para estadísticas
const leads = computed(() => [...leadsWpp.value, ...leadsFbig.value])
const loadingLeads = ref(false)
const leadsSearch = ref('')
const showCreateUserDialog = ref(false)
//const showSettingsDialog = ref(false)

const headersLeadsWpp = ref([
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

const headersLeadsFbig = ref([
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Instagram', key: 'instagram_handle', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

// Headers provided by user: id, nombre, numero, lead_status, reason_ia_qualification, producto_interes
const headersLeads = ref([
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Fecha', key: 'created_at', sortable: true },
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Estado', key: 'lead_status', sortable: true },
  { title: 'Razón IA', key: 'reason_ia_qualification', sortable: true },
  { title: 'Interés', key: 'producto_interes', sortable: true },
])

const fetchLeads = async () => {
  loadingLeads.value = true
  try {
    const [wpp, fbig] = await Promise.all([
      client.from('GeneralBDwppALEGRATED').select('*').order('id', { ascending: false }),
      client.from('GeneralBDfbigALEGRATED').select('*').order('id', { ascending: false })
    ])

    if (wpp.error) throw wpp.error
    if (fbig.error) throw fbig.error

    leadsWpp.value = wpp.data as any[]
    leadsFbig.value = fbig.data as any[]
    console.log('Leads loaded:', { wpp: wpp.data, fbig: fbig.data })
  } catch (error) {
    console.error('Error loading leads:', error)
  } finally {
    loadingLeads.value = false
  }
}

// Computed Stats for Leads
const totalLeads = computed(() => leadsWpp.value.length + leadsFbig.value.length)

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
const parseCurrency = (val: string | number) => {
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

// 4. Ticket Promedio (AOV)
const averageOrderValue = computed(() => {
  if (salesCountCurrentMonth.value === 0) return 0
  return revenueCurrentMonth.value / salesCountCurrentMonth.value
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
    const d = new Date(c.created_at)
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
  colors: ['#3b82f6'],
  grid: { borderColor: isDark.value ? '#3f3f46' : '#e5e7eb', strokeDashArray: 4 },
  theme: { mode: isDark.value ? 'dark' : 'light' }
}))



/* ---------------- Stock CRUD Logic Corregido ---------------- */
const showStockDialog = ref(false)
const currentStockType = ref<'perfumes' | 'decants' | 'sets'>('perfumes')
const editingStockId = ref<string | null>(null)
const stockFormData = ref<any>({})

function openStockDialog(item?: any) {
  editingStockId.value = item ? item.id : null

  if (item) {
    stockFormData.value = JSON.parse(JSON.stringify(item))
    // Mapeo inverso si es necesario para 'tamaño'
    if (item['tamaño']) stockFormData.value.tamanio = item['tamaño']
  } else {
    // Resetear formulario
    stockFormData.value = {
      nombre_del_producto: '',
      tipo: '',
      tamanio: '',
      precio_nacional: 0,
      precio_extranjero: 0,
      stock: 0
    }
  }
  showStockDialog.value = true
}

async function saveStock() {
  const cleanPrice = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace('S/', '').replace(/,/g, '').trim()) || 0;
  };

  const payload: any = {
    nombre_del_producto: stockFormData.value.nombre_del_producto,
    tipo: stockFormData.value.tipo,
    tamanio: stockFormData.value.tamanio, // Usamos 'tamanio' en JS si la columna es 'tamaño' o 'tamanio'
    precio_nacional: cleanPrice(stockFormData.value.precio_nacional),
    precio_extranjero: cleanPrice(stockFormData.value.precio_extranjero),
    stock: Number(stockFormData.value.stock || 0)
  };

  // Mapeo si la columna en BD es 'tamaño' con ñ
  if (stockFormData.value.tamanio) payload['tamaño'] = stockFormData.value.tamanio

  try {
    const query = client.from('productos_stock_alegrated') as any;
    let result;

    if (editingStockId.value) {
      console.log(`Actualizando stock con ID:`, editingStockId.value);
      result = await query
        .update(payload)
        .eq('id', editingStockId.value)
        .select()
    } else {
      console.log(`Creando nuevo stock`);
      result = await query
        .insert(payload)
        .select()
    }

    const { data, error } = result;

    if (error) {
      console.error("Error Supabase:", error);
      alert("Error al guardar: " + error.message);
    } else {
      console.log("Guardado exitoso:", data);
      showStockDialog.value = false;
      await fetchStockData();
    }
  } catch (err: any) {
    console.error("Error inesperado:", err);
    alert("Error crítico: " + err.message);
  }
}

async function deleteStock(id: string) {
  if (!confirm('¿Estás seguro de que deseas eliminar este ítem?')) return;

  try {
    const { error } = await client
      .from('productos_stock_alegrated')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error Supabase al borrar:', error);
      throw error;
    }

    await fetchStockData();
    console.log('Eliminado con éxito');

  } catch (error: any) {
    console.error(`Error deleting stock:`, error);
    alert(`Error al eliminar: ${error.message || error.details || error}`);
  }
}



// Watch activeView to fetch data when switching tabs
watch(activeView, (newVal) => {
  if (newVal === 'stock' && stockProducts.value.length === 0) fetchStockData()
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

onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessAlegrated(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  applyTheme()
  fetchStockData()
  fetchLeads()
  fetchCompras()
  handleZoom('one_month')
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()

  // DIAGNOSTICO
  runDiagnostics()
})

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
  { icon: 'mdi-cart', label: 'Compras', id: 'compras' },
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
    url: 'https://chats.alef.company/app/accounts/7/dashboard'
  }
]


interface DocumentItem {
  icon: string
  label: string
  id: string
  children?: {
    id: string
    label: string
    icon?: string
  }[]
}

const documentItems: DocumentItem[] = [
  // { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
  {
    icon: 'mdi-folder',
    label: 'Stock',
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
  { label: 'Compras', value: 'compras' },
  { label: 'Leads', value: 'leads' },
  { label: 'Próximos Eventos', value: 'events' }
]



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
        .from('alegrated_calendar_events') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('alegrated_calendar_events') as any)
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
      .from('alegrated_calendar_events')
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
      .from('alegrated_calendar_events')
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
        .from('brada_procedures') as any)
        .update(payload)
        .eq('id', editingProcedure.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('brada_procedures') as any)
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
        .from('brada_procedures')
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
      .from('brada_procedures')
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
        .from('brada_client_history') as any)
        .update(payload)
        .eq('id', editingMedicalHistory.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('brada_client_history') as any)
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
        .from('brada_client_history')
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

const fetchMedicalHistory = async () => {
  try {
    const { data, error } = await client
      .from('brada_client_history')
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
  company_id: 'alegrated'
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
  const { data, error } = await (client.from('egresos_alegrated') as any).select('*').order('created_at', { ascending: false })
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
  // Try to use revenueCurrentMonth if it exists, otherwise 0
  const brutos = typeof revenueCurrentMonth !== 'undefined' ? revenueCurrentMonth.value : 0;
  return brutos - totalEgresosMesActual.value
})

const openEgresoDialog = (item?: any) => {
  if (item && item.id) {
    editingEgreso.value = true
    egresoFormData.value = { ...item }
  } else {
    editingEgreso.value = false
    egresoFormData.value = { id: '', tipo_egreso: '', nombre: '', precio: 0, cantidad: 1, company_id: 'alegrated' }
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
    company_id: 'alegrated'
  }
  if (editingEgreso.value && egresoFormData.value.id) {
    await (client.from('egresos_alegrated') as any).update(payload).eq('id', egresoFormData.value.id)
  } else {
    await (client.from('egresos_alegrated') as any).insert(payload)
  }
  savingEgreso.value = false
  closeEgresoDialog()
  fetchEgresos()
}

const deleteEgreso = async (id: string) => {
  if (confirm('¿Seguro que deseas eliminar este egreso?')) {
    await (client.from('egresos_alegrated') as any).delete().eq('id', id)
    fetchEgresos()
  }
}

onMounted(() => {
  applyTheme()
  fetchContribuyentes()
  fetchEgresos()
  handleZoom('one_month')

})
</script>
