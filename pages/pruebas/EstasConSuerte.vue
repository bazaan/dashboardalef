<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/ecsLOGO.png" alt="Estás con Suerte Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Estás con Suerte</span>
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
          <span v-else class="logo-text">Estás con Suerte</span>
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

              <!-- TABLE: SUSCRIPCIONES -->
              <div v-if="activeTab === 'ventas'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimos Suscriptores</span>
                </v-card-title>
                <v-data-table :headers="headersVentas" :items="compras.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay suscriptores todavía" :items-per-page="10">
                  <template v-slot:item.estado="{ item }">
                    <v-chip
                      :color="item.estado === 'activa' ? 'success' :
                              item.estado === 'pendiente' ? 'warning' :
                              item.estado === 'cancelada' ? 'error' :
                              item.estado === 'fallida' ? 'error' :
                              item.estado === 'expirada' ? 'grey' : 'info'"
                      size="small" class="font-weight-bold">
                      {{ item.estado || 'desconocido' }}
                    </v-chip>
                  </template>
                  <template v-slot:item.monto="{ item }">
                    S/ {{ Number(item.monto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
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
      <SettingsView v-else-if="activeView === 'settings'" company-id="EstasConSuerte"
        :current-user-role="currentUser?.role" />

      <!-- ==========  VISTA: FORMULARIOS  ========== -->
      <div v-else-if="activeView === 'formularios'" class="view-container">
        <header class="top-header">
          <h1>Formularios</h1>
        </header>
        <div class="content-area">
          <FormsCompanyPanel company-id="estasconsuerte" />
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
          <h1>Suscripciones</h1>
          <div style="display: flex; gap: 15px; align-items: center;">
            <v-select v-model="filtroEstadoSuscriptor"
              :items="['Todas', 'Activas', 'Pendientes', 'Canceladas', 'Fallidas', 'Expiradas']" variant="outlined"
              density="compact" hide-details style="min-width: 200px;"></v-select>
            <button class="btn-primary" @click="fetchCompras">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">

          <!-- Banner de estado del boleteado automático (PSE.PE) -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1rem; border-radius:10px; margin-bottom:1rem;"
            :style="boleteoActivo ? 'background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);' : 'background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3);'">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <v-icon :icon="boleteoActivo ? 'mdi-receipt-text-check' : 'mdi-receipt-text-remove'"
                :color="boleteoActivo ? '#22c55e' : '#ef4444'" size="20" />
              <div>
                <div style="font-size:0.85rem; font-weight:600;" :style="boleteoActivo ? 'color:#22c55e' : 'color:#ef4444'">
                  Boleteado automático (PSE.PE): {{ boleteoActivo ? 'ACTIVADO' : 'DESACTIVADO' }}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                  {{ boleteoActivo ? 'Se emite boleta SUNAT automáticamente cuando ECS notifica una compra' : 'No se emiten boletas — actívalo cuando estés listo para facturar' }}
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem; flex-shrink:0;">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                :loading="loadingRefrescarSunat"
                prepend-icon="mdi-cloud-sync"
                @click="refrescarSunat"
              >
                Refrescar estado SUNAT
              </v-btn>
              <v-switch
                v-model="boleteoActivo"
                :color="boleteoActivo ? 'success' : 'error'"
                hide-details
                density="compact"
                :loading="loadingBoleteoToggle"
                @update:model-value="toggleBoleteo"
              />
            </div>
          </div>

          <!-- Resultado de "Refrescar estado SUNAT" (reconciliación de comprobantes) -->
          <v-snackbar v-model="refrescarSunatSnack" :timeout="6000" location="top" :color="refrescarSunatColor">
            {{ refrescarSunatMsg }}
          </v-snackbar>

          <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
            <div class="stat-card">
              <div class="stat-value">{{ compras.length }}</div>
              <div class="stat-title">Total Suscriptores</div>
              <div class="stat-subtitle">Histórico completo</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #10b981;">
              <div class="stat-value">{{ suscriptoresActivos.length }}</div>
              <div class="stat-title">Suscriptores Activos</div>
              <div class="stat-subtitle">Pagando recurrentemente</div>
            </div>
            <div class="stat-card" style="border-left: 4px solid #f59e0b;">
              <div class="stat-value">{{ suscriptoresPendientes.length }}</div>
              <div class="stat-title">Pendientes</div>
              <div class="stat-subtitle">Esperando autorización Yape</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Ingreso Mensual Recurrente</div>
              <div class="stat-value">S/ {{ mrr.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">MRR de suscripciones activas</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ comprasMesActual.length }}</div>
              <div class="stat-title">Nuevos este Mes</div>
              <div class="stat-change" :class="growthPercentage >= 0 ? 'up' : 'down'">
                {{ growthPercentage >= 0 ? '+' : '' }}{{ growthPercentage.toFixed(1) }}% vs mes anterior
              </div>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Lista de Suscriptores</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(suscriptoresFiltrados, headersVentas, 'ecs-suscriptores')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="ventasSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headersVentas" :items="suscriptoresFiltrados" :search="ventasSearch" :loading="loading"
                class="elevation-0" no-data-text="No hay suscriptores todavía">

                <template v-slot:item.estado="{ item }">
                  <v-chip
                    :color="item.estado === 'activa' ? 'success' :
                            item.estado === 'pendiente' ? 'warning' :
                            item.estado === 'cancelada' ? 'error' :
                            item.estado === 'fallida' ? 'error' :
                            item.estado === 'expirada' ? 'grey' : 'info'"
                    size="small" class="font-weight-bold">
                    {{ item.estado || 'desconocido' }}
                  </v-chip>
                </template>

                <template v-slot:item.metodo_pago="{ item }">
                  <v-chip :color="item.metodo_pago?.toLowerCase().includes('yape') ? '#743484' :
                    item.metodo_pago?.toLowerCase().includes('plin') ? '#00e5ff' :
                      item.metodo_pago?.toLowerCase().includes('efectivo') ? '#4caf50' :
                        item.metodo_pago?.toLowerCase().includes('tarjeta') ? '#1976d2' : 'grey'"
                    :text-color="item.metodo_pago?.toLowerCase().includes('yape') ? 'white' : 'black'" size="small"
                    class="font-weight-bold">
                    {{ item.metodo_pago || 'Yape' }}
                  </v-chip>
                </template>

                <template v-slot:item.monto="{ item }">
                  S/ {{ Number(item.monto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                </template>

                <template v-slot:item.fecha_suscripcion="{ item }">
                  {{ item.fecha_suscripcion ? new Date(item.fecha_suscripcion).toLocaleDateString('es-PE') : '—' }}
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
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(reservas, headersReservas, 'ecs-reservas')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
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
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(leadsWhatsapp, headersLeadsWhatsapp, 'ecs-leads-wpp')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
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
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(leadsInstagram, headersLeadsInstagram, 'ecs-leads-instagram')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
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
                 <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(egresosList, egresosHeaders, 'ecs-egresos')">
                   <v-icon>mdi-file-excel</v-icon>
                   <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                 </v-btn>
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
                <h2>Últimas Suscripciones</h2>
              </div>
              <v-list density="compact">
                <v-list-item v-for="compra in compras.slice(0, 6)" :key="compra.id" lines="two"
                  style="border-bottom: 1px solid var(--border);">
                  <template v-slot:prepend>
                    <v-avatar color="primary" variant="tonal" size="36">
                      <v-icon icon="mdi-account" size="18"></v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-bold">{{ compra.nombre }} {{ compra.apellido
                  }}</v-list-item-title>
                  <v-list-item-subtitle>{{ compra.plan_nombre || 'Sin plan' }}</v-list-item-subtitle>
                  <template v-slot:append>
                    <div class="text-right">
                      <div class="font-weight-bold text-primary">S/ {{ Number(compra.monto || 0).toFixed(2) }}</div>
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

      <!-- ==========  VISTA: FACTURACIÓN ECS  ========== -->
      <div v-else-if="activeView === 'contabilidad'" class="view-container">

        <!-- Tabs principales -->
        <v-tabs v-model="facturacionTab" bg-color="transparent" color="primary" density="compact" class="mb-4"
          style="border-bottom: 1px solid var(--border);">
          <v-tab value="cobro_manual">💳 Cobro</v-tab>
          <v-tab value="boletas_pendientes">📋 Pendientes</v-tab>
          <v-tab value="boletas">📄 Boletas</v-tab>
          <v-tab value="factura_electronica">⚡ Facturas</v-tab>
          <v-tab v-if="isSuperAdmin(currentUser)" value="endpoint">🔌 Endpoint</v-tab>
        </v-tabs>

        <!-- ====== TAB: BOLETAS PENDIENTES ====== -->
        <div v-if="facturacionTab === 'boletas_pendientes'" style="padding: 0 0 2rem 0;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <div>
              <h2 style="font-size:1.1rem; font-weight:600; margin:0;">Boletas Pendientes de Emisión</h2>
              <p style="font-size:0.85rem; color:var(--text-secondary); margin:0.25rem 0 0 0;">
                Generadas por el agente o la web. Revisá y emitís todas al final del día.
              </p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center;">
              <button class="btn-secondary" @click="fetchBoletasPendientesECS" :disabled="loadingPendientesECS">
                <v-icon icon="mdi-refresh" size="16" />
              </button>
              <button class="btn-primary" @click="emitirTodasPendientesECS"
                :disabled="loadingEmisionECS || boletasPendientesECS.length === 0">
                <v-icon icon="mdi-send" size="16" />
                <span>{{ loadingEmisionECS ? 'Emitiendo...' : `Emitir todas (${boletasPendientesECS.length})` }}</span>
              </button>
            </div>
          </div>

          <div v-if="emisionResultadoECS" style="margin-bottom:1rem; padding:1rem; border-radius:8px;"
            :style="{ background: emisionResultadoECS.fallidos > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${emisionResultadoECS.fallidos > 0 ? '#ef4444' : '#22c55e'}` }">
            <strong>Emisión completada:</strong> {{ emisionResultadoECS.exitosos }} exitosas, {{ emisionResultadoECS.fallidos }} con error
            <div v-for="r in emisionResultadoECS.resultados" :key="r.id" style="font-size:0.8rem; margin-top:0.25rem;">
              {{ r.serie }}-{{ String(r.numero).padStart(4,'0') }}:
              <span :style="{ color: r.ok ? '#22c55e' : '#ef4444' }">{{ r.ok ? '✓ emitida' : `✗ ${r.error}` }}</span>
            </div>
          </div>

          <div v-if="loadingPendientesECS" style="text-align:center; padding:3rem; color:var(--text-secondary);">
            <v-progress-circular indeterminate size="32" />
          </div>
          <div v-else-if="boletasPendientesECS.length === 0" style="text-align:center; padding:3rem; color:var(--text-secondary);">
            <v-icon icon="mdi-check-circle-outline" size="48" style="opacity:0.4;" />
            <p style="margin-top:0.75rem;">No hay boletas pendientes. Todo emitido.</p>
          </div>
          <div v-else>
            <div style="display:flex; justify-content:flex-end; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-secondary);">
              Total a emitir: <strong style="margin-left:0.25rem;">S/ {{ boletasPendientesECSTotal.toFixed(2) }}</strong>
            </div>
            <v-card flat style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:var(--bg-secondary); font-size:0.8rem; color:var(--text-secondary);">
                    <th style="padding:0.75rem 1rem; text-align:left;">Boleta</th>
                    <th style="padding:0.75rem 1rem; text-align:left;">Cliente</th>
                    <th style="padding:0.75rem 1rem; text-align:left;">Fecha</th>
                    <th style="padding:0.75rem 1rem; text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in boletasPendientesECS" :key="b.id"
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

        <!-- ====== TAB: COBRO MANUAL ====== -->
        <div v-show="facturacionTab === 'cobro_manual'" class="content-area">
          <div style="max-width: 700px;">
            <h2 style="margin-bottom: 1.5rem; font-size: 1.25rem;">Generar Boleta Manual</h2>

            <!-- Resultado exitoso -->
            <v-alert v-if="resultadoCobro" type="success" class="mb-4" closable @click:close="resultadoCobro = null">
              <div class="font-weight-bold">✅ Boleta {{ resultadoCobro.serie }}-{{ resultadoCobro.comprobante_numero ?? resultadoCobro.numero }} emitida</div>
              <div style="margin-top: 6px;">
                SUNAT: {{ resultadoCobro.aceptada_por_sunat ? 'Aceptada ✅' : 'Pendiente ⏳' }}
              </div>
              <v-btn v-if="resultadoCobro.enlace_pdf" :href="resultadoCobro.enlace_pdf" target="_blank"
                color="white" variant="outlined" size="small" class="mt-2">
                <v-icon start>mdi-file-pdf-box</v-icon> Ver PDF
              </v-btn>
            </v-alert>

            <!-- Error -->
            <v-alert v-if="errorCobro" type="error" class="mb-4" closable @click:close="errorCobro = ''">
              {{ errorCobro }}
            </v-alert>

            <v-card flat style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem;">

              <!-- Sección: Plan -->
              <div style="margin-bottom: 1.5rem;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Plan / Producto</div>
                <v-row>
                  <v-col cols="12">
                    <v-select v-model="cobroForm.planSeleccionado" :items="planesSubscripcion"
                      item-title="nombre" item-value="id" label="Seleccionar plan del catálogo (opcional)"
                      variant="outlined" density="compact" clearable @update:model-value="onPlanSelect"
                      :loading="loadingPlanes">
                      <template v-slot:item="{ props, item }">
                        <v-list-item v-bind="props" :subtitle="'S/ ' + item.raw.precio">
                          <template v-slot:append>
                            <v-chip size="x-small" color="primary">{{ item.raw.precio }}</v-chip>
                          </template>
                        </v-list-item>
                      </template>
                    </v-select>
                  </v-col>
                  <v-col cols="12" md="8">
                    <v-text-field v-model="cobroForm.plan_nombre" label="Descripción del plan / producto *"
                      variant="outlined" density="compact" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field v-model.number="cobroForm.precio_final" label="Precio final c/IGV (S/) *"
                      variant="outlined" density="compact" type="number" min="0" step="0.01" />
                  </v-col>
                </v-row>
                <!-- Preview de montos -->
                <div v-if="cobroForm.precio_final > 0"
                  style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 2rem;">
                  <span>Base gravada: <strong style="color: var(--text);">S/ {{ (cobroForm.precio_final / 1.18).toFixed(2) }}</strong></span>
                  <span>IGV 18%: <strong style="color: var(--text);">S/ {{ (cobroForm.precio_final - cobroForm.precio_final / 1.18).toFixed(2) }}</strong></span>
                  <span>Total: <strong style="color: #10b981; font-size: 1rem;">S/ {{ Number(cobroForm.precio_final).toFixed(2) }}</strong></span>
                </div>
              </div>

              <!-- Sección: Cliente -->
              <div style="margin-bottom: 1.5rem;">
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Datos del Cliente <span style="font-weight: 400; text-transform: none;">(opcional — omitir emite a Consumidor Final)</span></div>
                <v-row>
                  <v-col cols="12" md="4">
                    <v-select v-model="cobroForm.tipo_documento"
                      :items="[{title:'DNI', value: 1}, {title:'RUC', value: 6}, {title:'Carnet Extranjer.', value: 4}]"
                      item-title="title" item-value="value"
                      label="Tipo documento" variant="outlined" density="compact" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field v-model="cobroForm.numero_documento" label="Número documento"
                      variant="outlined" density="compact" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-text-field v-model="cobroForm.nombre_cliente" label="Nombre completo"
                      variant="outlined" density="compact" />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field v-model="cobroForm.email" label="Email (recibe PDF)"
                      variant="outlined" density="compact" type="email" />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select v-model="cobroForm.medio_de_pago"
                      :items="['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA']"
                      label="Medio de pago *" variant="outlined" density="compact" />
                  </v-col>
                </v-row>
              </div>

              <!-- Botón generar -->
              <div style="display: flex; justify-content: flex-end;">
                <button class="btn-primary" :disabled="loadingCobro || !cobroForm.plan_nombre || !cobroForm.precio_final || !cobroForm.medio_de_pago"
                  @click="generarBoletaManual" style="min-width: 180px; justify-content: center;">
                  <v-progress-circular v-if="loadingCobro" indeterminate size="16" width="2" class="mr-2" />
                  <v-icon v-else icon="mdi-receipt" size="16" class="mr-1" />
                  <span>{{ loadingCobro ? 'Generando...' : 'Generar Boleta' }}</span>
                </button>
              </div>
            </v-card>
          </div>
        </div>

        <!-- ====== TAB: BOLETAS ====== -->
        <div v-show="facturacionTab === 'boletas'" class="content-area">

          <!-- KPIs -->
          <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-title">Total Boletas</div>
              <div class="stat-value">{{ boletasECS.length }}</div>
              <div class="stat-subtitle">Todas las emitidas</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #10b981;">
              <div class="stat-title">Ingresos Totales</div>
              <div class="stat-value">S/ {{ boletasTotalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">Suma histórica</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #6366f1;">
              <div class="stat-title">Desde la Web</div>
              <div class="stat-value">{{ boletasECS.filter(b => b.emitido_por === 'webhook-web').length }}</div>
              <div class="stat-subtitle">Automáticas (clientes)</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #f59e0b;">
              <div class="stat-title">Manuales</div>
              <div class="stat-value">{{ boletasECS.filter(b => b.emitido_por !== 'webhook-web').length }}</div>
              <div class="stat-subtitle">Generadas desde dashboard</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #22c55e;">
              <div class="stat-title">Aceptadas SUNAT</div>
              <div class="stat-value">{{ boletasECS.filter(b => b.aceptada_por_sunat).length }}</div>
              <div class="stat-subtitle">Con CDR válido</div>
            </div>
          </div>

          <!-- Tabla de boletas -->
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Historial de Boletas</span>
                <v-spacer />
                <v-select v-model="boletasFiltroOrigen" :items="['Todas', 'Web (automáticas)', 'Manual']"
                  variant="outlined" density="compact" hide-details style="max-width: 200px; margin-right: 12px;" />
                <button class="btn-primary" @click="fetchBoletasECS" style="margin-right: 12px; padding: 6px 14px;">
                  <v-icon icon="mdi-refresh" size="16" />
                </button>
                <v-text-field v-model="boletasSearch" append-inner-icon="mdi-magnify" label="Buscar"
                  single-line hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>

              <v-data-table :headers="headersBoletasECS" :items="boletasFiltradas" :search="boletasSearch"
                :loading="loadingBoletas" class="elevation-0" no-data-text="No hay boletas registradas">

                <template v-slot:item.serie_numero="{ item }">
                  <span class="font-weight-bold">{{ item.serie }}-{{ item.numero }}</span>
                </template>

                <template v-slot:item.fecha_de_emision="{ item }">
                  {{ item.fecha_de_emision ? new Date(item.fecha_de_emision).toLocaleDateString('es-PE') : '—' }}
                </template>

                <template v-slot:item.total="{ item }">
                  <span class="font-weight-bold" style="color: #10b981;">S/ {{ Number(item.total).toFixed(2) }}</span>
                </template>

                <template v-slot:item.aceptada_por_sunat="{ item }">
                  <v-chip :color="item.aceptada_por_sunat ? 'success' : 'warning'" size="small">
                    {{ item.aceptada_por_sunat ? '✅ Aceptada' : '⏳ Pendiente' }}
                  </v-chip>
                </template>

                <template v-slot:item.emitido_por="{ item }">
                  <v-chip :color="item.emitido_por === 'webhook-web' ? 'primary' : 'secondary'" size="small" variant="tonal">
                    {{ item.emitido_por === 'webhook-web' ? '🌐 Web' : '🖥️ Manual' }}
                  </v-chip>
                </template>

                <template v-slot:item.enlace_del_pdf="{ item }">
                  <v-btn v-if="item.enlace_del_pdf" :href="item.enlace_del_pdf" target="_blank"
                    icon size="small" variant="text" color="primary">
                    <v-icon>mdi-file-pdf-box</v-icon>
                  </v-btn>
                  <span v-else style="color: var(--text-muted);">—</span>
                </template>

              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- ====== TAB: FACTURA ELECTRÓNICA ====== -->
        <div v-show="facturacionTab === 'factura_electronica'" style="padding: 0 0 2rem 0;">
          <FacturacionPSE company-id="estasconsuerte" />
        </div>

        <!-- ====== TAB: ENDPOINT (solo superadmin) ====== -->
        <div v-if="isSuperAdmin(currentUser) && facturacionTab === 'endpoint'" class="content-area">
          <h2 style="margin-bottom: 1rem; font-size: 1.2rem;">🔌 Monitor de Endpoint</h2>

          <!-- Info del endpoint -->
          <v-card flat class="mb-4" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem;">
              <v-icon color="success">mdi-check-circle</v-icon>
              <span style="font-weight: 600;">Endpoint activo</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.875rem;">
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="color: var(--text-muted); width: 120px;">URL:</span>
                <code style="background: var(--bg); padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">POST https://dashboard.alef.company/api/pse/webhook-compra</code>
              </div>
              <div style="display: flex; gap: 1rem; align-items: center;">
                <span style="color: var(--text-muted); width: 120px;">Token (secret):</span>
                <code style="background: var(--bg); padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">ecs_webhook_2025_xK9mP3qL7nR2vT8w</code>
              </div>
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <span style="color: var(--text-muted); width: 120px;">Ejemplo body:</span>
                <pre style="background: var(--bg); padding: 8px 12px; border-radius: 6px; font-size: 0.78rem; margin: 0; overflow-x: auto;">{{ ejemploPayloadEndpoint }}</pre>
              </div>
            </div>
          </v-card>

          <!-- KPIs logs -->
          <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-title">Llamadas Totales</div>
              <div class="stat-value">{{ webhookLogs.length }}</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #22c55e;">
              <div class="stat-title">Exitosas</div>
              <div class="stat-value">{{ webhookLogs.filter(l => l.status === 'success').length }}</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #ef4444;">
              <div class="stat-title">Con Error</div>
              <div class="stat-value">{{ webhookLogs.filter(l => l.status === 'error').length }}</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #f59e0b;">
              <div class="stat-title">Pendientes</div>
              <div class="stat-value">{{ webhookLogs.filter(l => l.status === 'pending').length }}</div>
            </div>
          </div>

          <!-- Tabla de logs -->
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Log de Llamadas al Endpoint</span>
                <v-spacer />
                <button class="btn-primary" @click="fetchEndpointLogs" style="padding: 6px 14px; margin-right: 10px;">
                  <v-icon icon="mdi-refresh" size="16" />
                </button>
              </v-card-title>

              <v-data-table :headers="headersWebhookLogs" :items="webhookLogs" :loading="loadingEndpointLogs"
                class="elevation-0" no-data-text="Sin llamadas registradas. Crea la tabla ecs_webhook_logs en Supabase.">

                <template v-slot:item.created_at="{ item }">
                  {{ item.created_at ? new Date(item.created_at).toLocaleString('es-PE') : '—' }}
                </template>

                <template v-slot:item.status="{ item }">
                  <v-chip :color="item.status === 'success' ? 'success' : item.status === 'error' ? 'error' : 'warning'" size="small">
                    {{ item.status === 'success' ? '✅ Éxito' : item.status === 'error' ? '❌ Error' : '⏳ Pendiente' }}
                  </v-chip>
                </template>

                <template v-slot:item.cliente="{ item }">
                  <span>{{ item.payload?.cliente?.nombre ?? 'Consumidor Final' }}</span>
                </template>

                <template v-slot:item.plan="{ item }">
                  <span>{{ item.payload?.plan?.nombre ?? '—' }}</span>
                </template>

                <template v-slot:item.monto="{ item }">
                  <span v-if="item.payload?.plan?.precio_final" style="color: #10b981; font-weight: 600;">
                    S/ {{ Number(item.payload.plan.precio_final).toFixed(2) }}
                  </span>
                  <span v-else>—</span>
                </template>

                <template v-slot:item.comprobante="{ item }">
                  <span v-if="item.comprobante_serie">{{ item.comprobante_serie }}-{{ item.comprobante_numero }}</span>
                  <span v-else style="color: var(--text-muted);">—</span>
                </template>

                <template v-slot:item.error_message="{ item }">
                  <span v-if="item.error_message" style="color: #ef4444; font-size: 0.8rem;">{{ item.error_message }}</span>
                  <span v-else style="color: var(--text-muted);">—</span>
                </template>

                <template v-slot:item.enlace_pdf="{ item }">
                  <v-btn v-if="item.enlace_pdf" :href="item.enlace_pdf" target="_blank" icon size="small" variant="text" color="primary">
                    <v-icon>mdi-file-pdf-box</v-icon>
                  </v-btn>
                  <span v-else style="color: var(--text-muted);">—</span>
                </template>

              </v-data-table>
            </v-card>
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
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(procedures, procedureHeaders, 'ecs-procedimientos')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
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

      <!-- ==========  VISTA: SUBSCRIPCIÓN  ========== -->
      <div v-else-if="activeView === 'stock'" class="view-container">
        <header class="top-header">
          <h1>Subscripción</h1>
          <div class="header-actions">
            <button class="btn-warning ml-2" @click="fetchPlanesSubscripcion">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Planes de Subscripción</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(planesSubscripcion, headersPlanes, 'ecs-planes')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="planesSearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>
              <v-data-table
                :headers="headersPlanes"
                :items="planesSubscripcion"
                :search="planesSearch"
                :loading="loadingPlanes"
                class="elevation-0"
                no-data-text="No hay planes registrados">
                <template v-slot:item.precio="{ item }">
                  <span style="text-decoration:line-through; color:#888; font-size:0.8rem; margin-right:4px;">S/ {{ item.precio_original }}</span>
                  <strong>S/ {{ item.precio }}</strong>
                </template>
                <template v-slot:item.descuento_pct="{ item }">
                  <v-chip size="x-small" color="success" variant="tonal">{{ item.descuento_pct }}%</v-chip>
                </template>
                <template v-slot:item.tickets_mes="{ item }">
                  <v-chip size="x-small" color="primary" variant="tonal">{{ item.tickets_mes }} ticket{{ item.tickets_mes > 1 ? 's' : '' }}</v-chip>
                </template>
                <template v-slot:item.es_popular="{ item }">
                  <v-chip v-if="item.es_popular" size="x-small" color="warning" variant="tonal">POPULAR</v-chip>
                  <span v-else>—</span>
                </template>
                <template v-slot:item.activo="{ item }">
                  <v-chip size="x-small" :color="item.activo ? 'success' : 'error'" variant="tonal">
                    {{ item.activo ? 'Activo' : 'Inactivo' }}
                  </v-chip>
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

            <template v-if="currentStockType === 'celulares'">
              <v-text-field v-model="stockFormData.name" label="Nombre del Celular" variant="outlined" density="compact"
                class="mb-2"></v-text-field>

              <v-row>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.price" label="Precio (S/)" type="number"
                    variant="outlined" density="compact"></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.stock" label="Stock (Unidades)" type="number"
                    variant="outlined" density="compact"></v-text-field>
                </v-col>
              </v-row>
            </template>

            <template v-if="currentStockType === 'laptops'">
              <v-text-field v-model="stockFormData.name" label="Laptop / Tablet" variant="outlined" density="compact"
                class="mb-2"></v-text-field>

              <v-row>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.price" label="Precio (S/)" type="number"
                    variant="outlined" density="compact"></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.stock" label="Stock" type="number" variant="outlined"
                    density="compact"></v-text-field>
                </v-col>
              </v-row>
            </template>

            <template v-if="currentStockType === 'accesorios'">
              <v-text-field v-model="stockFormData.name" label="Nombre del Accesorio" variant="outlined"
                density="compact" class="mb-2"></v-text-field>

              <v-row>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.price" label="Precio" type="number" variant="outlined"
                    density="compact" class="mb-2"></v-text-field>
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="stockFormData.stock" label="Stock" type="number" variant="outlined"
                    density="compact" class="mb-2"></v-text-field>
                </v-col>
              </v-row>
            </template>

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

    <!-- ==========  CREATE USER DIALOG  ========== -->
    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->

      <RemarketingPanel
        v-if="activeView === 'remarketing'"
        company-id="estasconsuerte"
        :lead-tablas="{ wpp: 'ECS_GeneralBDwpp', fbig: 'ECS_GeneralBDfbig' }"
      />

      <!-- ==========  VISTA: REPORTE DIARIO  ========== -->
      <div v-if="activeView === 'reporte'" class="view-container">
        <ReporteEmpresaPanel empresa-id="EstasConSuerte" empresa-nombre="Estás Con Suerte" :current-user="currentUser?.full_name" />
      </div>

      <!-- ==========  VISTA: TICKETS  ========== -->
      <div v-if="activeView === 'tickets'" class="view-container">
        <TicketPanel company-id="EstasConSuerte" empresa-nombre="Estás Con Suerte" :current-user="currentUser?.full_name" />
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'

const { logActivity } = useActivityLogger()
import { useExcelExport } from '@/composables/useExcelExport'
const { downloadExcel } = useExcelExport()
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessEstasConSuerte, dashboards } from '@/utils/permissions'

import SettingsView from '@/components/Settings/SettingsView.vue'
import FormsCompanyPanel from '@/components/Forms/FormsCompanyPanel.vue'

definePageMeta({
  middleware: 'auth-dashboard'
})

// ...

// ... (skipping down to onMounted)

onMounted(() => {
  // Access Control
  // Access Control
  if (!canAccessEstasConSuerte(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  applyTheme()
  fetchStock()
  fetchLeads()
  fetchCompras()
  fetchReservas()
  fetchGlobalAccounting()
  fetchBoleteoStatus()

  handleZoom('one_month')
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()
  fetchPlanesSubscripcion()

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

// ── Boleteado automático (PSE.PE) ────────────────────────────────────────────
// Controla si el endpoint /api/pse/webhook-compra emite boleta cuando ECS
// notifica una compra. Default: OFF hasta que se active desde el dashboard.
const boleteoActivo        = ref(false)
const loadingBoleteoToggle = ref(false)

const fetchBoleteoStatus = async () => {
  try {
    const data = await $fetch<{ activo: boolean }>('/api/ecs/boleteo')
    boleteoActivo.value = data.activo
  } catch { boleteoActivo.value = false }
}

const toggleBoleteo = async (nuevoValor: boolean) => {
  loadingBoleteoToggle.value = true
  try {
    const data = await $fetch<{ activo: boolean }>('/api/ecs/boleteo', {
      method: 'POST',
      body: { activo: nuevoValor },
    })
    boleteoActivo.value = data.activo
  } catch (e) {
    console.error('Error cambiando boleteo ECS:', e)
    boleteoActivo.value = !nuevoValor   // revertir UI si falla
  } finally {
    loadingBoleteoToggle.value = false
  }
}

// ── Refrescar estado SUNAT (reconciliación de comprobantes ECS) ─────────
// La aceptación de SUNAT es asíncrona: al emitir, PSE.PE devuelve aceptada=false
// y luego SUNAT confirma. Este botón re-consulta PSE.PE para los comprobantes
// que figuran como no aceptados y actualiza su estado real en la BD.
// Llama POST /api/pse/reconciliar (scoped solo a ECS).
const loadingRefrescarSunat = ref(false)
const refrescarSunatSnack   = ref(false)
const refrescarSunatMsg     = ref('')
const refrescarSunatColor   = ref<'success' | 'error'>('success')

const refrescarSunat = async () => {
  loadingRefrescarSunat.value = true
  try {
    const r = await $fetch<{ revisados: number; corregidos: number; errores: number }>(
      '/api/pse/reconciliar',
      { method: 'POST', body: { company_id: 'estasconsuerte' } }
    )
    refrescarSunatColor.value = 'success'
    refrescarSunatMsg.value = r.corregidos > 0
      ? `✓ ${r.corregidos} comprobante(s) actualizados a "aceptado por SUNAT" (de ${r.revisados} revisados).`
      : `Todo al día: ${r.revisados} revisados, ninguno pendiente.`
  } catch (e: any) {
    refrescarSunatColor.value = 'error'
    refrescarSunatMsg.value = 'No se pudo refrescar: ' + (e?.data?.statusMessage || e?.message || 'error')
  } finally {
    refrescarSunatSnack.value = true
    loadingRefrescarSunat.value = false
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
const filtroEstadoSuscriptor = ref('Todas')

// Headers de la tabla de Suscriptores (SuscriptoresBDwppECS)
const headersVentas = ref([
  { title: 'Nombre',     key: 'nombre',            sortable: true },
  { title: 'Apellido',   key: 'apellido',          sortable: true },
  { title: 'Nº Celular', key: 'numero',            sortable: true },
  { title: 'DNI',        key: 'dni',               sortable: true },
  { title: 'Correo',     key: 'email',             sortable: true },
  { title: 'Plan',       key: 'plan_nombre',       sortable: true },
  { title: 'Monto',      key: 'monto',             sortable: true },
  { title: 'Método',     key: 'metodo_pago',       sortable: true },
  { title: 'Estado',     key: 'estado',            sortable: true },
  { title: 'Fecha Susc.',key: 'fecha_suscripcion', sortable: true },
])

// Filtrado por estado seleccionado en el dropdown
const suscriptoresFiltrados = computed(() => {
  const f = filtroEstadoSuscriptor.value
  if (f === 'Todas') return compras.value
  const mapa: Record<string, string> = {
    'Activas':    'activa',
    'Pendientes': 'pendiente',
    'Canceladas': 'cancelada',
    'Fallidas':   'fallida',
    'Expiradas':  'expirada',
  }
  const target = mapa[f]
  return compras.value.filter(s => s.estado === target)
})

// Stats derivados
const suscriptoresActivos = computed(() =>
  compras.value.filter(s => s.estado === 'activa'),
)
const suscriptoresPendientes = computed(() =>
  compras.value.filter(s => s.estado === 'pendiente'),
)
// MRR = suma de montos de suscripciones activas
const mrr = computed(() =>
  suscriptoresActivos.value.reduce((acc, s) => acc + (Number(s.monto) || 0), 0),
)

/* Headers de la tabla - ajusta según tu tabla 'ECS_contribuyentes' */
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
      .from('ECS_contribuyentes')
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

const fetchStock = async () => {
  loadingStock.value = true
  try {
    const { data, error } = await client
      .from('ECS_stock')
      .select('nombre_producto, cantidad_disponible, sucursal_id, precio')
      .eq('sucursal_id', '1')

    if (error) throw error

    stockItems.value = (data || []) as any[]
  } catch (error) {
    console.error('Error al cargar stock:', error)
  } finally {
    loadingStock.value = false
  }
}

const fetchCompras = async () => {
  loading.value = true
  try {
    // 1. Sincronizar pendientes contra ECS antes de mostrar
    //    (consulta /admin/users de ECS y actualiza estados huérfanos).
    //    Si el sincronizador falla por cualquier razón, igual mostramos
    //    lo que tengamos en BD — no bloquea la UI.
    try {
      await $fetch('/api/ecs/sincronizar-pendientes', { method: 'POST' })
    } catch (syncErr) {
      console.warn('[fetchCompras] sincronizar-pendientes falló (no crítico):', syncErr)
    }

    // 2. Leer la BD ya sincronizada
    const { data, error } = await client
      .from('SuscriptoresBDwppECS')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    compras.value = (data || []) as any[]
  } catch (e) {
    console.error('Error cargando suscriptores:', e)
  } finally {
    loading.value = false
  }
}

const fetchReservas = async () => {
  loadingReservas.value = true
  try {
    const { data, error } = await client
      .from('ECS_reserva_recojo_tienda')
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
      client.from('ECS_pago_completo_motorizado').select('precio, cantidad'),
      client.from('ECS_pago_completo_courier').select('precio, cantidad'),
      client.from('ECS_pago_completo_recojo_tienda').select('precio, cantidad'),
      client.from('ECS_reserva_recojo_tienda').select('precio, cantidad')
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

// ======================== COBRO MANUAL ECS ========================
const loadingCobro   = ref(false)
const errorCobro     = ref('')
const resultadoCobro = ref<any>(null)

const cobroForm = ref({
  planSeleccionado:  null as number | null,
  plan_nombre:       '',
  precio_final:      0,
  tipo_documento:    1,
  numero_documento:  '',
  nombre_cliente:    '',
  email:             '',
  medio_de_pago:     'YAPE',
})

const onPlanSelect = (planId: number | null) => {
  if (!planId) return
  const plan = planesSubscripcion.value.find((p: any) => p.id === planId)
  if (plan) {
    cobroForm.value.plan_nombre   = plan.nombre
    cobroForm.value.precio_final  = Number(plan.precio)
  }
}

const resetCobroForm = () => {
  cobroForm.value = {
    planSeleccionado: null, plan_nombre: '', precio_final: 0,
    tipo_documento: 1, numero_documento: '', nombre_cliente: '', email: '', medio_de_pago: 'YAPE'
  }
}

const generarBoletaManual = async () => {
  loadingCobro.value  = true
  errorCobro.value    = ''
  resultadoCobro.value = null
  try {
    const body = {
      cliente: {
        tipo_documento:   cobroForm.value.tipo_documento,
        numero_documento: cobroForm.value.numero_documento || '00000000',
        nombre:           cobroForm.value.nombre_cliente  || 'CONSUMIDOR FINAL',
        email:            cobroForm.value.email
      },
      plan: {
        id:          cobroForm.value.planSeleccionado,
        nombre:      cobroForm.value.plan_nombre,
        precio_final: cobroForm.value.precio_final
      },
      medio_de_pago: cobroForm.value.medio_de_pago
    }
    const result = await $fetch('/api/ecs/cobro-manual', { method: 'POST', body })
    resultadoCobro.value = result
    resetCobroForm()
    fetchBoletasECS()
  } catch (err: any) {
    errorCobro.value = err?.data?.statusMessage || err?.message || 'Error al generar la boleta'
  } finally {
    loadingCobro.value = false
  }
}

// ======================== BOLETAS ECS ========================
const boletasECS          = ref<any[]>([])
const loadingBoletas       = ref(false)
const boletasSearch        = ref('')
const boletasFiltroOrigen  = ref('Todas')

const boletasTotalRevenue = computed(() =>
  boletasECS.value.reduce((s, b) => s + Number(b.total || 0), 0)
)

const boletasFiltradas = computed(() => {
  if (boletasFiltroOrigen.value === 'Web (automáticas)') return boletasECS.value.filter(b => b.emitido_por === 'webhook-web')
  if (boletasFiltroOrigen.value === 'Manual') return boletasECS.value.filter(b => b.emitido_por !== 'webhook-web')
  return boletasECS.value
})

const headersBoletasECS = [
  { title: 'N° Boleta',     key: 'serie_numero',       sortable: false },
  { title: 'Fecha',         key: 'fecha_de_emision',   sortable: true  },
  { title: 'Cliente',       key: 'cliente_denominacion', sortable: true },
  { title: 'Plan',          key: 'observaciones',      sortable: true  },
  { title: 'Monto',         key: 'total',              sortable: true  },
  { title: 'Medio Pago',    key: 'medio_de_pago',      sortable: true  },
  { title: 'SUNAT',         key: 'aceptada_por_sunat', sortable: false },
  { title: 'Origen',        key: 'emitido_por',        sortable: false },
  { title: 'PDF',           key: 'enlace_del_pdf',     sortable: false },
]

const fetchBoletasECS = async () => {
  loadingBoletas.value = true
  try {
    const { data, error } = await client
      .from('comprobantes_pse')
      .select('*')
      .eq('company_id', 'estasconsuerte')
      .order('numero', { ascending: false })
    if (error) throw error
    boletasECS.value = data || []
  } catch (e) {
    console.error('Error cargando boletas ECS:', e)
  } finally {
    loadingBoletas.value = false
  }
}

// ======================== ENDPOINT LOGS ========================
const webhookLogs          = ref<any[]>([])
const loadingEndpointLogs  = ref(false)

const headersWebhookLogs = [
  { title: 'Fecha/Hora',   key: 'created_at',          sortable: true  },
  { title: 'Estado',       key: 'status',              sortable: false },
  { title: 'Cliente',      key: 'cliente',             sortable: false },
  { title: 'Plan',         key: 'plan',                sortable: false },
  { title: 'Monto',        key: 'monto',               sortable: false },
  { title: 'Boleta',       key: 'comprobante',         sortable: false },
  { title: 'Error',        key: 'error_message',       sortable: false },
  { title: 'PDF',          key: 'enlace_pdf',          sortable: false },
]

const ejemploPayloadEndpoint = `{
  "webhook_secret": "ecs_webhook_2025_xK9mP3qL7nR2vT8w",
  "cliente": { "tipo_documento": 1, "numero_documento": "12345678",
                "nombre": "Juan Pérez", "email": "juan@email.com" },
  "plan":    { "nombre": "Triple Fortuna", "precio_final": 34.90 },
  "medio_de_pago": "YAPE"
}`

const fetchEndpointLogs = async () => {
  loadingEndpointLogs.value = true
  try {
    const { data, error } = await client
      .from('ecs_webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    webhookLogs.value = data || []
  } catch (e) {
    console.error('Error cargando logs de endpoint:', e)
    webhookLogs.value = []
  } finally {
    loadingEndpointLogs.value = false
  }
}

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
      .from('ECS_contribuyentes')
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
const facturacionTab = ref('cobro_manual')
const activeTab = ref('ventas')
const showUserMenu = ref(false)
const stockMenuOpen = ref(false)

/* ---------------- Stock Logic ---------------- */
const stockSearch = ref('')
const loadingStock = ref(false)
const stockItems = ref<any[]>([])

const headersStock = ref([
  { title: 'Producto', key: 'nombre_producto', sortable: true },
  { title: 'Disponibilidad', key: 'cantidad_disponible', sortable: true },
  { title: 'Precio de venta', key: 'precio', sortable: true },
])

/* ---------------- Subscripción Logic ---------------- */
const planesSearch = ref('')
const loadingPlanes = ref(false)
const planesSubscripcion = ref<any[]>([])

const headersPlanes = [
  { title: 'Plan', key: 'nombre', sortable: true },
  { title: 'Subtítulo', key: 'subtitulo', sortable: false },
  { title: 'Precio', key: 'precio', sortable: true },
  { title: 'Descuento', key: 'descuento_pct', sortable: true },
  { title: 'Período', key: 'periodo', sortable: true },
  { title: 'Tickets', key: 'tickets_mes', sortable: true },
  { title: 'Popular', key: 'es_popular', sortable: false },
  { title: 'Estado', key: 'activo', sortable: false },
]

const fetchPlanesSubscripcion = async () => {
  loadingPlanes.value = true
  try {
    const { data, error } = await client
      .from('ecs_planes_subcripcion')
      .select('*')
      .order('id', { ascending: true })
    if (error) throw error
    planesSubscripcion.value = data || []
  } catch (e) {
    console.error('Error cargando planes:', e)
  } finally {
    loadingPlanes.value = false
  }
}

/* ---------------- LEADS LOGIC ---------------- */
// ... (Leads Logic remains unchanged, skipping context lines for brevity if possible, but I must replace contiguous block.
// To avoid replacing unrelated code, I will break this into chunks if using multi_replace, but here I am using replace_file_content.
// I will target the Stock Logic block exclusively if possible.
// The block starts at line 1563 in the file I viewed. 
// I will actually use multi_replace to be safer and surgical.)


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
      .from('ECS_GeneralBDwpp')
      .select('*')
      .order('id', { ascending: false })

    if (errorWpp) throw errorWpp
    leadsWhatsapp.value = dataWpp as any[]

    // 2. Fetch Instagram Leads
    const { data: dataIg, error: errorIg } = await client
      .from('ECS_GeneralBDfbig')
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



/* ---------------- Stock CRUD Logic Corregido ---------------- */
const showStockDialog = ref(false)
const currentStockType = ref<'celulares' | 'laptops' | 'accesorios'>('celulares')
const editingStockId = ref<string | null>(null)
const stockFormData = ref<any>({})

function openStockDialog(type: 'celulares' | 'laptops' | 'accesorios', item?: any) {
  currentStockType.value = type
  editingStockId.value = item ? item.id : null

  if (item) {
    stockFormData.value = JSON.parse(JSON.stringify(item))
  } else {
    // Reset defaults
    stockFormData.value = {}
    if (type === 'celulares') {
      stockFormData.value.nombre = ''
      stockFormData.value.precio = 0
      stockFormData.value.stock = 0
    }
    else if (type === 'laptops') {
      stockFormData.value.nombre = ''
      stockFormData.value.precio = 0
      stockFormData.value.stock = 0
    }
    else if (type === 'accesorios') {
      stockFormData.value.nombre = ''
      stockFormData.value.precio = 0
      stockFormData.value.stock = 0
    }
  }
  showStockDialog.value = true
}

async function saveStock() {
  const type = currentStockType.value
  let tableName = ''

  // Función auxiliar: Convierte "S/ 1000" a número puro (1000)
  const cleanPrice = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace('S/', '').replace(/,/g, '').trim()) || 0;
  };

  const payload: any = {};

  if (type === 'celulares') {
    tableName = 'ECS_Stock_celulares';
    payload.nombre = stockFormData.value.nombre;
    payload.stock = Number(stockFormData.value.stock || 0);
    payload.precio = cleanPrice(stockFormData.value.precio);

  } else if (type === 'laptops') {
    tableName = 'ECS_Stock_laptops_tablets';
    payload.nombre = stockFormData.value.nombre;
    payload.stock = Number(stockFormData.value.stock || 0);
    payload.precio = cleanPrice(stockFormData.value.precio);

  } else if (type === 'accesorios') {
    tableName = 'ECS_Stock_accesorios';
    payload.nombre = stockFormData.value.nombre;
    payload.stock = Number(stockFormData.value.stock || 0);
    payload.precio = cleanPrice(stockFormData.value.precio);
  }

  try {
    const query = client.from(tableName) as any;
    let result;

    if (editingStockId.value) {
      console.log(`Actualizando ${type} con ID:`, editingStockId.value);
      result = await query
        .update(payload)
        .eq('id', editingStockId.value)
        .select()
    } else {
      console.log(`Creando nuevo ${type}`);
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
      await fetchStock();
    }
  } catch (err: any) {
    console.error("Error inesperado:", err);
    alert("Error crítico: " + err.message);
  }
}

async function deleteStock(type: 'celulares' | 'laptops' | 'accesorios', id: string) {
  // Confirmación de seguridad
  if (!confirm('¿Estás seguro de que deseas eliminar este ítem? Esta acción no se puede deshacer.')) return;

  let tableName = '';
  if (type === 'celulares') tableName = 'ECS_Stock_celulares';
  else if (type === 'laptops') tableName = 'ECS_Stock_laptops_tablets';
  else if (type === 'accesorios') tableName = 'ECS_Stock_accesorios';

  try {
    console.log(`Eliminando de ${tableName} el ID: ${id}`);

    // TRUCO TYPESCRIPT: Usamos 'as any' para poder usar tableName dinámico
    const query = client.from(tableName) as any;

    // IMPORTANTE: Pasamos 'id' directo (es un string UUID), NO lo convertimos a número
    const { error } = await query
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error Supabase al borrar:', error);
      throw error;
    }

    // Si todo sale bien, recargamos la tabla
    await fetchStock();
    console.log('Eliminado con éxito');

  } catch (error: any) {
    console.error(`Error deleting from ${tableName}:`, error);
    alert(`Error al eliminar: ${error.message || error.details || error}`);
  }
}



// Watch activeView to fetch data when switching tabs
watch(activeView, (newVal) => {
  if (newVal === 'stock' && stockItems.value.length === 0) fetchStock()
  else if (newVal === 'leads' && leads.value.length === 0) fetchLeads()
  else if (newVal === 'contabilidad' && boletasECS.value.length === 0) fetchBoletasECS()
})

/* ---------------- Boletas Pendientes ECS ---------------- */
const boletasPendientesECS = ref<any[]>([])
const loadingPendientesECS = ref(false)
const loadingEmisionECS = ref(false)
const emisionResultadoECS = ref<any>(null)
const boletasPendientesECSTotal = computed(() => boletasPendientesECS.value.reduce((s, b) => s + Number(b.total || 0), 0))

async function fetchBoletasPendientesECS() {
  loadingPendientesECS.value = true
  try {
    const supabase = useSupabaseClient()
    const { data } = await supabase
      .from('comprobantes_pse')
      .select('id, serie, numero, fecha_de_emision, cliente_denominacion, total')
      .eq('company_id', 'estasconsuerte')
      .eq('estado', 'pendiente')
      .order('numero', { ascending: true })
    boletasPendientesECS.value = data || []
  } finally {
    loadingPendientesECS.value = false
  }
}

async function emitirTodasPendientesECS() {
  if (boletasPendientesECS.value.length === 0) return
  loadingEmisionECS.value = true
  emisionResultadoECS.value = null
  try {
    const resultado = await $fetch('/api/pse/emitir', {
      method: 'POST',
      body: { todos: true, company_id: 'estasconsuerte' }
    })
    emisionResultadoECS.value = resultado
    await fetchBoletasPendientesECS()
  } catch (e: any) {
    emisionResultadoECS.value = { exitosos: 0, fallidos: boletasPendientesECS.value.length, resultados: [], error: e?.message }
  } finally {
    loadingEmisionECS.value = false
  }
}

// Watch facturacionTab to load endpoint logs on demand
watch(facturacionTab, (newVal) => {
  if (newVal === 'boletas' && boletasECS.value.length === 0) fetchBoletasECS()
  if (newVal === 'endpoint' && webhookLogs.value.length === 0) fetchEndpointLogs()
  if (newVal === 'boletas_pendientes') fetchBoletasPendientesECS()
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
watch(() => stockItems.value.length, (newVal, oldVal) => {
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
  { icon: 'mdi-account-multiple', label: 'Suscripciones', id: 'ventas' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' },
  { icon: 'mdi-form-select', label: 'Formularios', id: 'formularios' },
  { icon: 'mdi-calendar-clock', label: 'Reservas', id: 'reservas' }
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
    url: 'https://chats.alef.company/app/accounts/12/dashboard'
  }
]


const documentItems: Array<{ icon: string; label: string; id: string; children?: any[] }> = [
  // { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
  {
    icon: 'mdi-ticket-percent',
    label: 'Subscripción',
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
  { label: 'Suscripciones', value: 'ventas' },
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
        .from('ECS_calendar_events') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('ECS_calendar_events') as any)
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
      .from('ECS_calendar_events')
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
      .from('ECS_calendar_events')
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
        .from('ECS_procedures') as any)
        .update(payload)
        .eq('id', editingProcedure.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('ECS_procedures') as any)
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
        .from('ECS_procedures')
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
      .from('ECS_procedures')
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
        .from('ECS_client_history') as any)
        .update(payload)
        .eq('id', editingMedicalHistory.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('ECS_client_history') as any)
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
        .from('ECS_client_history')
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
      .from('ECS_client_history')
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
  company_id: 'estasconsuerte'
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
  const { data, error } = await (client.from('ECS_egresos') as any).select('*').order('created_at', { ascending: false })
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
    egresoFormData.value = { id: '', tipo_egreso: '', nombre: '', precio: 0, cantidad: 1, company_id: 'estasconsuerte' }
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
    company_id: 'estasconsuerte'
  }
  if (editingEgreso.value && egresoFormData.value.id) {
    await (client.from('ECS_egresos') as any).update(payload).eq('id', egresoFormData.value.id)
  } else {
    await (client.from('ECS_egresos') as any).insert(payload)
  }
  savingEgreso.value = false
  closeEgresoDialog()
  fetchEgresos()
}

const deleteEgreso = async (id: string) => {
  if (confirm('¿Seguro que deseas eliminar este egreso?')) {
    await (client.from('ECS_egresos') as any).delete().eq('id', id)
    fetchEgresos()
  }
}

onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessEstasConSuerte(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }

  fetchEgresos()
})
</script>
