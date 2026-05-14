<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/aleflogo oscuro.png" alt="Alef Company Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Alef Company</span>
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
          <span v-else class="logo-text">Alef Company</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Inicio</div>
          <button v-for="item in menuItems" :key="item.id" :class="['nav-item', { active: activeView === item.id && !item.url }]"
            @click="item.url ? window.open(item.url, '_blank') : activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'alertas_crm' && alertasCRMCount > 0" class="nav-badge">{{ alertasCRMCount }}</span>
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

        <div class="nav-section">
          <div class="nav-label">ADMINISTRACIÓN</div>
          <button :class="['nav-item', { active: activeView === 'equipo' }]"
            @click="activeView = 'equipo'">
            <v-icon icon="mdi-account-group" size="18" />
            <span>Equipo</span>
          </button>
          <button :class="['nav-item', { active: activeView === 'brief' }]"
            @click="activeView = 'brief'; fetchBriefs()">
            <v-icon icon="mdi-lightning-bolt" size="18" />
            <span>Brief del Día</span>
          </button>
          <button :class="['nav-item', { active: activeView === 'reportes_diarios' }]"
            @click="activeView = 'reportes_diarios'; fetchReportes()">
            <v-icon icon="mdi-clipboard-check" size="18" />
            <span>Reportes Diarios</span>
          </button>
          <button :class="['nav-item', { active: activeView === 'reportes' }]"
            @click="activeView = 'reportes'">
            <v-icon icon="mdi-file-chart" size="18" />
            <span>Reportes</span>
          </button>
          <button :class="['nav-item', { active: activeView === 'dev_logs' }]"
            @click="activeView = 'dev_logs'">
            <v-icon icon="mdi-robot-excited" size="18" />
            <span>Dev · Agent Logs</span>
            <v-chip v-if="devLogsErrorCount > 0" color="error" size="x-small" class="ml-auto">{{ devLogsErrorCount }}</v-chip>
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
      <!-- ==========  VISTA: DASHBOARD CONSOLIDADO  ========== -->
      <div v-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <h1>Alef Company — Vista Consolidada</h1>
          <button class="btn-primary" @click="fetchAllCompanies">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>

        <div class="content-area">
          <!-- KPIs Globales -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Empresas Activas</span></div>
              <div class="stat-value">{{ companiesData.filter(c => c.loaded).length }}</div>
              <div class="stat-description">de {{ companiesData.length }} totales</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Total Leads (mes)</span></div>
              <div class="stat-value">{{ totalGlobalLeads.toLocaleString() }}</div>
              <div class="stat-description">Todas las empresas combinadas</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Conversiones (mes)</span></div>
              <div class="stat-value">{{ totalGlobalConversiones.toLocaleString() }}</div>
              <div class="stat-description">Pacientes / clientes nuevos</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Ingresos Totales (mes)</span></div>
              <div class="stat-value">S/ {{ totalGlobalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-description">Sumado de todas las cuentas</div>
            </div>
          </div>

          <!-- Galeria de Empresas -->
          <div style="margin-top: 1.5rem;">
            <h2 style="margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--foreground);">Empresas</h2>

            <div class="alef-companies-grid">
              <div v-for="co in companiesData" :key="co.id" class="alef-company-card" @click="navigateTo(co.dashboardPath)">
                <!-- Header -->
                <div class="alef-co-header">
                  <div class="alef-co-logo">
                    <v-img v-if="co.logo" :src="co.logo" style="width: 36px; height: 36px; border-radius: 50%;" />
                    <div v-else style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px;">
                      {{ co.name.charAt(0) }}
                    </div>
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--foreground);">{{ co.name }}</div>
                    <div style="font-size: 0.72rem; color: var(--muted-foreground);">{{ co.type }}</div>
                  </div>
                  <v-spacer />
                  <div :class="['alef-co-status', co.loaded ? 'active' : 'loading']">
                    {{ co.loaded ? 'Activo' : 'Cargando...' }}
                  </div>
                </div>

                <!-- Metricas -->
                <div class="alef-co-metrics" v-if="co.loaded">
                  <div class="alef-co-metric">
                    <div class="alef-co-metric-value">{{ co.leadsTotal.toLocaleString() }}</div>
                    <div class="alef-co-metric-label">Leads</div>
                  </div>
                  <div class="alef-co-metric">
                    <div class="alef-co-metric-value">{{ co.conversiones }}</div>
                    <div class="alef-co-metric-label">Conversiones</div>
                  </div>
                  <div class="alef-co-metric">
                    <div class="alef-co-metric-value">S/ {{ co.revenue.toLocaleString('es-PE', { maximumFractionDigits: 0 }) }}</div>
                    <div class="alef-co-metric-label">Ingresos</div>
                  </div>
                  <div class="alef-co-metric">
                    <div class="alef-co-metric-value">S/ {{ co.egresos.toLocaleString('es-PE', { maximumFractionDigits: 0 }) }}</div>
                    <div class="alef-co-metric-label">Egresos</div>
                  </div>
                </div>
                <div v-else style="padding: 1rem; text-align: center;">
                  <v-progress-circular indeterminate size="24" width="2" color="primary" />
                </div>

                <!-- Barras de temperatura de leads -->
                <div class="alef-co-temps" v-if="co.loaded && co.leadsTotal > 0">
                  <div class="alef-co-temp-bar">
                    <div class="alef-co-temp-fill caliente" :style="{ width: pct(co.calientes, co.leadsTotal) }" />
                    <div class="alef-co-temp-fill tibio" :style="{ width: pct(co.tibios, co.leadsTotal) }" />
                    <div class="alef-co-temp-fill frio" :style="{ width: pct(co.frios, co.leadsTotal) }" />
                  </div>
                  <div class="alef-co-temp-legend">
                    <span style="color: #ef4444;">{{ co.calientes }} cal</span>
                    <span style="color: #f59e0b;">{{ co.tibios }} tib</span>
                    <span style="color: #3b82f6;">{{ co.frios }} frio</span>
                  </div>
                </div>

                <!-- Footer -->
                <div class="alef-co-footer">
                  <span style="font-size: 0.72rem; color: var(--muted-foreground);">
                    <v-icon icon="mdi-open-in-new" size="12" /> Ver dashboard
                  </span>
                  <span v-if="co.chatwootUrl" style="font-size: 0.72rem; color: var(--muted-foreground);">
                    <a :href="co.chatwootUrl" target="_blank" @click.stop style="color: inherit; text-decoration: none;">
                      <v-icon icon="mdi-chat" size="12" /> Chats
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla comparativa -->
          <div style="margin-top: 2rem;">
            <h2 style="margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--foreground);">Comparativa Mensual</h2>
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px;">
              <v-data-table
                :headers="companyTableHeaders"
                :items="companiesData.filter(c => c.loaded)"
                :items-per-page="-1"
                density="compact"
                class="elevation-0"
                style="background: transparent;"
              >
                <template v-slot:item.name="{ item }">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
                      <v-img v-if="item.logo" :src="item.logo" style="width: 100%; height: 100%;" />
                      <div v-else style="width: 100%; height: 100%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 10px;">{{ item.name.charAt(0) }}</div>
                    </div>
                    <span style="font-weight: 500;">{{ item.name }}</span>
                  </div>
                </template>
                <template v-slot:item.revenue="{ item }">
                  S/ {{ item.revenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                </template>
                <template v-slot:item.egresos="{ item }">
                  S/ {{ item.egresos.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                </template>
                <template v-slot:item.utilidad="{ item }">
                  <span :style="{ color: (item.revenue - item.egresos) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }">
                    S/ {{ (item.revenue - item.egresos).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
                  </span>
                </template>
                <template v-slot:item.tasaConversion="{ item }">
                  {{ item.leadsTotal > 0 ? ((item.conversiones / item.leadsTotal) * 100).toFixed(1) : '0' }}%
                </template>
              </v-data-table>
            </v-card>
          </div>

        </div>
      </div>

      <!-- ==========  VISTA: SETTINGS  ========== -->
      <SettingsView v-else-if="activeView === 'settings'" company-id="Alef" :current-user-role="currentUser?.role" />

      <!-- ==========  VISTA: CALENDARIO  ========== -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Calendario</h1>
          <button class="btn-primary" @click="() => openCreateEventDialog()">
            <v-icon icon="mdi-calendar-plus" size="16" />
            <span>Nueva Reunión</span>
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
                    :style="{ backgroundColor: getMeetingColor(event.tipo) }" :title="event.subject">
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
                <div class="event-color-bar" :style="{ backgroundColor: getMeetingColor(event.tipo) }"></div>
                <div class="event-info">
                  <div class="event-title">{{ event.subject }}</div>
                  <div class="event-meta">
                    <v-icon icon="mdi-clock-outline" size="14" />
                    {{ formatEventDate(event.date) }} - {{ event.time }}
                  </div>
                  <div class="event-client">{{ tiposReunion.find(t => t.value === event.tipo)?.label || event.tipo }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: PACIENTES  ========== -->
      <!-- ==========  VISTA: ACTIVIDADES (Anteriormente PACIENTES)  ========== -->
      <div v-else-if="activeView === 'actividades'" class="view-container">
        <header class="top-header">
          <h1>Actividades</h1>
          <button class="btn-primary" @click="openActivityDialog()">
            <v-icon icon="mdi-plus" size="16" />
            <span>Nueva Actividad</span>
          </button>
        </header>

        <div class="content-area">
          <!-- Charts Section -->
          <div class="charts-row">
            <div class="chart-card">
              <h3>Rendimiento por Agente</h3>
              <client-only>
                <apexchart type="bar" height="200" :options="agentChartOptions" :series="agentSeries" />
              </client-only>
            </div>
            <div class="chart-card">
              <h3>Estado de Actividades</h3>
              <client-only>
                <apexchart type="donut" height="200" :options="statusChartOptions" :series="statusSeries" />
              </client-only>
            </div>
            <div class="chart-card">
              <h3>Puntos Bono Acumulados</h3>
              <client-only>
                <apexchart type="bar" height="200" :options="bonusChartOptions" :series="bonusSeries" />
              </client-only>
            </div>
          </div>

          <!-- Kanban Board -->
          <div class="kanban-board">
            <!-- Pendientes -->
            <div class="kanban-column pending">
              <div class="column-header">
                <h3>Pendientes</h3>
                <span class="count">{{ pendingActivities.length }}</span>
              </div>
              <div class="kanban-list">
                <div v-for="task in pendingActivities" :key="task.id" class="kanban-card"
                  :class="'priority-' + task.priority">
                  <div class="card-header">
                    <span class="task-type">{{ task.type }}</span>
                    <div class="card-actions">
                      <button class="icon-btn xs" @click="openActivityDialog(task)"><v-icon icon="mdi-pencil"
                          size="14" /></button>
                    </div>
                  </div>
                  <h4 class="task-title">{{ task.title }}</h4>
                  <p class="task-desc" v-if="task.description">{{ task.description }}</p>

                  <div class="task-meta">
                    <div class="assigned-to">
                      <v-icon icon="mdi-account" size="14" /> {{ task.assigned_to }}
                    </div>
                    <div class="bonus-points">
                      <v-icon icon="mdi-star" size="14" color="amber" /> {{ task.bonus_points }} pts
                    </div>
                  </div>

                  <div class="task-dates">
                    <span><v-icon icon="mdi-calendar-start" size="12" /> {{ formatDateShort(task.start_date) }}</span>
                    <span><v-icon icon="mdi-calendar-end" size="12" color="error" /> {{ formatDateShort(task.due_date)
                      }}</span>
                  </div>

                  <button class="action-btn start-btn" @click="updateActivityStatus(task, 'en_progreso')">
                    Iniciar Tarea <v-icon icon="mdi-arrow-right" size="14" />
                  </button>
                </div>
              </div>
            </div>

            <!-- En Progreso -->
            <div class="kanban-column progress">
              <div class="column-header">
                <h3>En Progreso</h3>
                <span class="count">{{ inProgressActivities.length }}</span>
              </div>
              <div class="kanban-list">
                <div v-for="task in inProgressActivities" :key="task.id" class="kanban-card"
                  :class="'priority-' + task.priority">
                  <div class="card-header">
                    <span class="task-type">{{ task.type }}</span>
                    <div class="card-actions">
                      <button class="icon-btn xs" @click="openActivityDialog(task)"><v-icon icon="mdi-pencil"
                          size="14" /></button>
                    </div>
                  </div>
                  <h4 class="task-title">{{ task.title }}</h4>

                  <div class="task-meta">
                    <div class="assigned-to">
                      <v-icon icon="mdi-account" size="14" /> {{ task.assigned_to }}
                    </div>
                    <div class="bonus-points">
                      <v-icon icon="mdi-star" size="14" color="amber" /> {{ task.bonus_points }} pts
                    </div>
                  </div>

                  <div class="task-dates">
                    <span><v-icon icon="mdi-calendar-end" size="12" color="error" /> Vence: {{
                      formatDateShort(task.due_date) }}</span>
                  </div>

                  <div class="task-actions-row">
                    <button class="action-btn back-btn" @click="updateActivityStatus(task, 'pendiente')">
                      <v-icon icon="mdi-arrow-left" size="14" />
                    </button>
                    <button class="action-btn finish-btn" @click="updateActivityStatus(task, 'finalizada')">
                      Finalizar <v-icon icon="mdi-check" size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Finalizadas -->
            <div class="kanban-column done">
              <div class="column-header">
                <h3>Finalizadas</h3>
                <span class="count">{{ completedActivities.length }}</span>
              </div>
              <div class="kanban-list">
                <div v-for="task in completedActivities" :key="task.id" class="kanban-card done-card"
                  :class="'priority-' + task.priority">
                  <div class="card-header">
                    <span class="task-type">{{ task.type }}</span>
                    <span class="completed-date"><v-icon icon="mdi-check-circle" size="12" color="success" /> {{
                      formatDateShort(task.completed_at) }}</span>
                  </div>
                  <h4 class="task-title">{{ task.title }}</h4>

                  <div class="task-meta">
                    <div class="assigned-to">
                      <v-icon icon="mdi-account" size="14" /> {{ task.assigned_to }}
                    </div>
                    <div class="bonus-points">
                      <v-icon icon="mdi-star" size="14" color="amber" /> {{ task.bonus_points }} pts
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <button class="btn-primary">
            <v-icon icon="mdi-account-plus" size="16" />
            <span>Nuevo Lead</span>
          </button>
        </header>

        <div class="content-area">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">245</div>
              <div class="stat-title">Total Leads</div>
              <div class="stat-change up">+12.5%</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">36</div>
              <div class="stat-title">Calificados</div>
              <div class="stat-change up">+8.3%</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">12</div>
              <div class="stat-title">Convertidos</div>
              <div class="stat-change down">-3.2%</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">4.9%</div>
              <div class="stat-title">Tasa Conversión</div>
              <div class="stat-change up">+0.5%</div>
            </div>
          </div>

          <div class="placeholder-card large">
            <h2>Embudo de Ventas</h2>
            <div class="placeholder-chart funnel">
              <v-icon icon="mdi-chart-timeline-variant" size="64" />
              <p>Gráfica de embudo de conversión de leads</p>
            </div>
          </div>

          <div class="table-section">
            <div class="placeholder-card">
              <h3>Lista de Leads</h3>
              <div class="placeholder-table">
                <p>Tabla de leads con estado, fuente, y acciones</p>
              </div>
            </div>
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
                 <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(egresosList, egresosHeaders, 'alef-egresos')">
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
          <FacturacionPSE company-id="alefcompany" />
        </div>

        <!-- Resumen original -->
        <div v-show="facturacionTab === 'resumen'">
        <header class="top-header">
          <h1>Facturación</h1>
          <button class="btn-primary">
            <v-icon icon="mdi-file-document-plus" size="16" />
            <span>Nueva Factura</span>
          </button>
        </header>

        <div class="content-area">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-title">Ingresos del Mes</div>
              <div class="stat-value">$45,678</div>
              <div class="stat-change up">+15.3%</div>
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
              <div class="stat-value">S/ {{ gananciaNetaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-subtitle">Ingresos Brutos - Egresos de este mes</div>
            </div>
          </div>

          <div class="two-column-grid">
            <div class="placeholder-card chart">
              <h3>Ingresos vs Egresos</h3>
              <div class="placeholder-chart">
                <v-icon icon="mdi-chart-line" size="48" />
                <p>Gráfica comparativa de ingresos y egresos</p>
              </div>
            </div>

            <div class="placeholder-card chart">
              <h3>Estado de Facturas</h3>
              <div class="placeholder-chart">
                <v-icon icon="mdi-chart-pie" size="48" />
                <p>Gráfica de distribución de facturas por estado</p>
              </div>
            </div>
          </div>

          <div class="table-section">
            <div class="placeholder-card">
              <h3>Facturas Recientes</h3>
              <div class="placeholder-table">
                <p>Tabla de facturas con fecha, cliente, monto y estado</p>
              </div>
            </div>
          </div>
        </div>

        </div><!-- fin tab resumen -->
      </div>

      <!-- ==========  VISTA: CONTABILIDAD  ========== -->
      <div v-else-if="activeView === 'contabilidad'" class="view-container">
        <header class="top-header">
          <h1>Contabilidad</h1>
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
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(procedures, procedureHeaders, 'alef-procedimientos')">
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

      <!-- ==========  VISTA: HISTORIAL CLÍNICO  ========== -->
      <div v-else-if="activeView === 'historialClinico'" class="view-container">
        <header class="top-header">
          <h1>Historial Clínico</h1>
          <button class="btn-primary" @click="openMedicalHistoryDialog()">
            <v-icon icon="mdi-file-document-plus" size="16" />
            <span>Añadir Historial</span>
          </button>
        </header>

        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Registros Médicos</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(medicalHistoryEntries, medicalHistoryHeaders, 'alef-registros-medicos')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="medicalHistorySearch" append-inner-icon="mdi-magnify" label="Buscar" single-line
                  hide-details density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="medicalHistoryHeaders" :items="medicalHistoryEntries"
                :search="medicalHistorySearch" :items-per-page="10" class="elevation-0"
                no-data-text="No hay historiales médicos registrados">
                <template v-slot:item.attachment="{ item }">
                  <v-btn v-if="item.attachmentName" size="small" variant="text" color="primary"
                    prepend-icon="mdi-file-pdf-box" @click="downloadMedicalAttachment(item)">
                    {{ item.attachmentName }}
                  </v-btn>
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

      <!-- ══════════════════════════════════════════
           ALERTAS CRM — Conversaciones sin responder
      ══════════════════════════════════════════ -->
      <div v-else-if="activeView === 'alertas_crm'" class="view-container">
        <header class="top-header">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <h1>Alertas CRM</h1>
            <span v-if="alertasCRMCount > 0" class="alertas-badge-header">
              {{ alertasCRMCount }} sin responder
            </span>
          </div>
          <button class="btn-primary" @click="fetchAlertasCRM" :disabled="loadingAlertas">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>

        <div class="content-area">

          <!-- Estado vacío -->
          <div v-if="!loadingAlertas && alertasCRM.length === 0" class="alertas-empty">
            <v-icon icon="mdi-check-circle-outline" size="52" color="success" />
            <div class="alertas-empty-title">Todo al día</div>
            <div class="alertas-empty-sub">No hay conversaciones sin responder en este momento.</div>
          </div>

          <!-- Loading -->
          <div v-else-if="loadingAlertas" style="text-align: center; padding: 4rem;">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <!-- Carpetas por empresa -->
          <div v-else class="alertas-empresas">
            <div
              v-for="grupo in alertasPorEmpresa"
              :key="grupo.name"
              class="empresa-folder"
            >
              <!-- Header de la carpeta (clickeable para colapsar) -->
              <button
                class="empresa-folder-header"
                @click="toggleEmpresa(grupo.name)"
              >
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <v-icon
                    :icon="empresasAbiertas.has(grupo.name) ? 'mdi-folder-open' : 'mdi-folder'"
                    size="18"
                    style="color: #daa520;"
                  />
                  <span class="empresa-folder-name">{{ grupo.name }}</span>
                  <span class="empresa-folder-count">{{ grupo.alertas.length }}</span>
                </div>
                <v-icon
                  :icon="empresasAbiertas.has(grupo.name) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  size="18"
                  style="opacity: 0.5;"
                />
              </button>

              <!-- Filas de alertas -->
              <div v-if="empresasAbiertas.has(grupo.name)" class="empresa-alertas">
                <a
                  v-for="alerta in grupo.alertas"
                  :key="alerta.id"
                  :href="alerta.conversation_url"
                  target="_blank"
                  class="alerta-row"
                >
                  <!-- Avatar -->
                  <div class="alerta-row-avatar">
                    {{ (alerta.contact_name || '?')[0].toUpperCase() }}
                  </div>

                  <!-- Info -->
                  <div class="alerta-row-info">
                    <div class="alerta-row-nombre">{{ alerta.contact_name || 'Desconocido' }}</div>
                    <div class="alerta-row-meta">
                      <span>{{ alerta.inbox_name }}</span>
                      <span v-if="alerta.contact_phone"> · {{ alerta.contact_phone }}</span>
                    </div>
                  </div>

                  <!-- Tiempo -->
                  <div class="alerta-row-tiempo" :class="tiempoEsperandoClase(alerta.waiting_since)">
                    <v-icon icon="mdi-clock-outline" size="12" />
                    {{ tiempoEsperando(alerta.waiting_since) }}
                  </div>

                  <!-- Botón descartar -->
                  <button
                    class="alerta-dismiss-btn"
                    title="Marcar como atendida"
                    @click.prevent.stop="dismissAlerta(alerta.id)"
                  >
                    <v-icon icon="mdi-check" size="14" />
                  </button>

                  <!-- Flecha -->
                  <v-icon icon="mdi-chevron-right" size="16" style="opacity: 0.35; flex-shrink: 0;" />
                </a>
              </div>
            </div>
          </div>

          <!-- Última actualización -->
          <div v-if="!loadingAlertas" class="alertas-footer">
            Actualizado {{ ultimaActualizacionAlertas }} · Refresco automático cada 5 min
          </div>

        </div>
      </div>

      <!-- ==========  VISTA: EQUIPO ALEF  ========== -->
      <div v-else-if="activeView === 'equipo'" class="view-container">
        <header class="top-header">
          <h1>Equipo Alef Company</h1>
          <button class="btn-primary" @click="showNewMemberDialog = true">
            <v-icon icon="mdi-account-plus" size="16" />
            <span>Agregar Miembro</span>
          </button>
        </header>

        <div class="content-area">

          <!-- Equipo interno Alef -->
          <h2 style="font-size:1rem;font-weight:600;color:var(--foreground);margin-bottom:0.75rem;">Equipo Interno</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem;margin-bottom:2rem;">
            <div v-for="m in equipoAlef" :key="m.nombre" class="alef-company-card" style="cursor:default;">
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;" :style="{background:m.color}">{{ m.inicial }}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:0.9rem;color:var(--foreground);">{{ m.nombre }} {{ m.apellido }}</div>
                  <div style="font-size:0.72rem;color:var(--muted-foreground);line-height:1.3;">{{ m.cargo }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- KPIs del equipo -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Total Miembros</span></div>
              <div class="stat-value">{{ teamMembers.length }}</div>
              <div class="stat-description">Equipo completo de Alef</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Empresas Cubiertas</span></div>
              <div class="stat-value">{{ [...new Set(teamMembers.map(m => m.company_id))].length }}</div>
              <div class="stat-description">Con al menos 1 miembro</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Admins</span></div>
              <div class="stat-value">{{ teamMembers.filter(m => m.role === 'admin').length }}</div>
              <div class="stat-description">Administradores de empresa</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Agentes</span></div>
              <div class="stat-value">{{ teamMembers.filter(m => m.role === 'agente' || m.role === 'agent').length }}</div>
              <div class="stat-description">Operadores de dashboard</div>
            </div>
          </div>

          <!-- Organigrama por empresa -->
          <div style="margin-top: 1.5rem;">
            <h2 style="margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--foreground);">Organigrama por Empresa</h2>
            <div class="alef-companies-grid">
              <div v-for="grupo in teamByCompany" :key="grupo.company" class="alef-company-card" style="cursor: default;">
                <div class="alef-co-header">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px;">
                    {{ grupo.company.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 0.95rem; color: var(--foreground);">{{ grupo.company }}</div>
                    <div style="font-size: 0.72rem; color: var(--muted-foreground);">{{ grupo.members.length }} miembros</div>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                  <div v-for="m in grupo.members" :key="m.id"
                    style="display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.6rem; background: var(--sidebar); border-radius: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;"
                      :style="{ background: m.role === 'superadmin' ? '#daa520' : m.role === 'admin' ? '#3b82f6' : '#64748b', color: '#fff' }">
                      {{ (m.full_name || m.email || '?')[0].toUpperCase() }}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.82rem; font-weight: 500; color: var(--foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {{ m.full_name || m.email }}
                      </div>
                      <div style="font-size: 0.68rem; color: var(--muted-foreground);">{{ m.cargo || m.role }}</div>
                    </div>
                    <span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 99px; font-weight: 600;"
                      :style="{
                        background: m.role === 'superadmin' ? 'rgba(218,165,32,0.15)' : m.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                        color: m.role === 'superadmin' ? '#daa520' : m.role === 'admin' ? '#3b82f6' : '#64748b'
                      }">
                      {{ m.role }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla completa -->
          <div style="margin-top: 2rem;">
            <h2 style="margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: var(--foreground);">Directorio Completo</h2>
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px;">
              <v-card-title class="table-search-bar">
                <v-text-field v-model="teamSearch" append-inner-icon="mdi-magnify" label="Buscar miembro..." single-line hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>
              <v-data-table
                :headers="teamHeaders"
                :items="teamMembers"
                :search="teamSearch"
                :items-per-page="20"
                density="compact"
                class="elevation-0"
                style="background: transparent;"
              >
                <template v-slot:item.full_name="{ item }">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;"
                      :style="{ background: item.role === 'superadmin' ? '#daa520' : item.role === 'admin' ? '#3b82f6' : '#64748b', color: '#fff' }">
                      {{ (item.full_name || item.email || '?')[0].toUpperCase() }}
                    </div>
                    <span style="font-weight: 500;">{{ item.full_name || '—' }}</span>
                  </div>
                </template>
                <template v-slot:item.role="{ item }">
                  <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;"
                    :style="{
                      background: item.role === 'superadmin' ? 'rgba(218,165,32,0.15)' : item.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                      color: item.role === 'superadmin' ? '#daa520' : item.role === 'admin' ? '#3b82f6' : '#64748b'
                    }">
                    {{ item.role }}
                  </span>
                </template>
                <template v-slot:item.cargo="{ item }">
                  <span v-if="editingMemberId === item.id">
                    <v-text-field v-model="editingCargo" density="compact" variant="outlined" hide-details style="max-width: 200px;"
                      @keyup.enter="saveMemberCargo(item)" @blur="saveMemberCargo(item)" />
                  </span>
                  <span v-else @dblclick="startEditCargo(item)" style="cursor: pointer;" :title="'Doble click para editar'">
                    {{ item.cargo || '—' }}
                  </span>
                </template>
                <template v-slot:item.created_at="{ item }">
                  {{ item.created_at ? new Date(item.created_at).toLocaleDateString('es-PE') : '—' }}
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: REPORTES  ========== -->
      <div v-else-if="activeView === 'reportes'" class="view-container">
        <header class="top-header">
          <h1>Reportes Consolidados</h1>
          <button class="btn-primary" @click="fetchAllCompanies">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>

        <div class="content-area">
          <!-- Selector de mes -->
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
            <v-select v-model="reportMonth" :items="reportMonthOptions" density="compact" variant="outlined" hide-details
              style="max-width: 200px;" label="Mes" />
          </div>

          <!-- KPIs globales del mes -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Ingresos Totales</span></div>
              <div class="stat-value">S/ {{ totalGlobalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-description">Todas las empresas</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Egresos Totales</span></div>
              <div class="stat-value" style="color: #ef4444;">S/ {{ totalGlobalEgresos.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
              <div class="stat-description">Todas las empresas</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Utilidad Neta</span></div>
              <div class="stat-value" :style="{ color: (totalGlobalRevenue - totalGlobalEgresos) >= 0 ? '#22c55e' : '#ef4444' }">
                S/ {{ (totalGlobalRevenue - totalGlobalEgresos).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </div>
              <div class="stat-description">Ingresos - Egresos</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Leads Totales</span></div>
              <div class="stat-value">{{ totalGlobalLeads.toLocaleString() }}</div>
              <div class="stat-description">{{ totalGlobalConversiones }} conversiones</div>
            </div>
          </div>

          <!-- Gráfico de barras: Ingresos vs Egresos por empresa -->
          <div style="margin-top: 1.5rem;">
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
              <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--foreground);">Ingresos vs Egresos por Empresa</h3>
              <client-only>
                <apexchart type="bar" height="350" :options="reportChartOptions" :series="reportChartSeries" />
              </client-only>
            </v-card>
          </div>

          <!-- Gráfico de pie: Distribución de leads por empresa -->
          <div style="margin-top: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
              <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--foreground);">Distribución de Leads</h3>
              <client-only>
                <apexchart type="donut" height="300" :options="leadsDonutOptions" :series="leadsDonutSeries" />
              </client-only>
            </v-card>
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
              <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--foreground);">Distribución de Ingresos</h3>
              <client-only>
                <apexchart type="donut" height="300" :options="revenueDonutOptions" :series="revenueDonutSeries" />
              </client-only>
            </v-card>
          </div>

          <!-- Tabla ranking -->
          <div style="margin-top: 1.5rem;">
            <v-card flat style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem;">
              <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--foreground);">Ranking de Empresas</h3>
              <v-data-table
                :headers="[
                  { title: '#', key: 'rank', width: '50px' },
                  { title: 'Empresa', key: 'name' },
                  { title: 'Ingresos', key: 'revenue', sortable: true },
                  { title: 'Egresos', key: 'egresos', sortable: true },
                  { title: 'Utilidad', key: 'utilidad', sortable: true },
                  { title: 'Leads', key: 'leadsTotal', sortable: true },
                  { title: 'Conv.', key: 'conversiones', sortable: true },
                  { title: 'Tasa', key: 'tasa', sortable: true }
                ]"
                :items="companiesRanking"
                :items-per-page="-1"
                density="compact"
                class="elevation-0"
                style="background: transparent;"
              >
                <template v-slot:item.rank="{ index }">
                  <span style="font-weight: 700; color: var(--muted-foreground);">{{ index + 1 }}</span>
                </template>
                <template v-slot:item.name="{ item }">
                  <span style="font-weight: 600;">{{ item.name }}</span>
                </template>
                <template v-slot:item.revenue="{ item }">
                  S/ {{ item.revenue.toLocaleString('es-PE', { maximumFractionDigits: 0 }) }}
                </template>
                <template v-slot:item.egresos="{ item }">
                  S/ {{ item.egresos.toLocaleString('es-PE', { maximumFractionDigits: 0 }) }}
                </template>
                <template v-slot:item.utilidad="{ item }">
                  <span :style="{ color: (item.revenue - item.egresos) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }">
                    S/ {{ (item.revenue - item.egresos).toLocaleString('es-PE', { maximumFractionDigits: 0 }) }}
                  </span>
                </template>
                <template v-slot:item.tasa="{ item }">
                  {{ item.leadsTotal > 0 ? ((item.conversiones / item.leadsTotal) * 100).toFixed(1) : '0' }}%
                </template>
              </v-data-table>
            </v-card>
          </div>
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
          <span>{{ editingEvent ? 'Editar Reunión' : 'Nueva Reunión' }}</span>
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

            <v-text-field v-model="eventFormData.subject" label="Título de la Reunión" variant="outlined"
              density="compact" :rules="[v => !!v || 'El título es requerido']"></v-text-field>

            <v-select v-model="eventFormData.tipo" label="Tipo de Reunión" :items="tiposReunion" item-title="label"
              item-value="value" variant="outlined" density="compact"
              :rules="[v => !!v || 'Selecciona el tipo']">
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <div :style="{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.raw.color, marginRight: '8px', flexShrink: 0 }"></div>
                  </template>
                </v-list-item>
              </template>
              <template v-slot:selection="{ item }">
                <div class="d-flex align-center" style="gap: 8px;">
                  <div :style="{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.raw.color, flexShrink: 0 }"></div>
                  <span>{{ item.raw.label }}</span>
                </div>
              </template>
            </v-select>

            <v-text-field v-model="eventFormData.participantes" label="Participantes (separados por coma)"
              variant="outlined" density="compact" placeholder="Juan, María, Pedro..."></v-text-field>

            <v-text-field v-model="eventFormData.direccion" label="Dirección (opcional)"
              variant="outlined" density="compact" placeholder="Av. Ejemplo 123, Lima"
              prepend-inner-icon="mdi-map-marker"></v-text-field>

            <v-textarea v-model="eventFormData.description" label="Descripción / Agenda" variant="outlined" density="compact"
              rows="3"></v-textarea>
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
              <v-icon icon="mdi-tag" class="detail-icon" />
              <div>
                <div class="detail-label">Tipo</div>
                <div class="detail-value d-flex align-center" style="gap: 8px;">
                  <div :style="{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getMeetingColor(selectedEvent.tipo), flexShrink: 0 }"></div>
                  {{ tiposReunion.find(t => t.value === selectedEvent.tipo)?.label || selectedEvent.tipo }}
                </div>
              </div>
            </div>

            <div v-if="selectedEvent.participantes" class="detail-row">
              <v-icon icon="mdi-account-group" class="detail-icon" />
              <div>
                <div class="detail-label">Participantes</div>
                <div class="detail-value">{{ selectedEvent.participantes }}</div>
              </div>
            </div>

            <div v-if="selectedEvent.direccion" class="detail-row">
              <v-icon icon="mdi-map-marker" class="detail-icon" />
              <div>
                <div class="detail-label">Dirección</div>
                <div class="detail-value">{{ selectedEvent.direccion }}</div>
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
              <div class="event-color-indicator" :style="{ backgroundColor: getMeetingColor(event.tipo) }">
              </div>
              <div class="day-event-info">
                <div class="day-event-time">{{ event.time }}</div>
                <div class="day-event-subject">{{ event.subject }}</div>
                <div class="day-event-client">{{ tiposReunion.find(t => t.value === event.tipo)?.label || event.tipo }}</div>
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
    <!-- ==========  ACTIVITY CREATION/EDIT DIALOG  ========== -->
    <v-dialog v-model="showActivityDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title class="event-dialog-title">
          <span>{{ editingActivity ? 'Editar Actividad' : 'Nueva Actividad' }}</span>
          <v-btn icon="mdi-close" variant="text" @click="closeActivityDialog"></v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="activityForm">
            <v-text-field v-model="activityFormData.title" label="Título de la Actividad" variant="outlined"
              density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>

            <v-textarea v-model="activityFormData.description" label="Descripción" variant="outlined" density="compact"
              rows="2"></v-textarea>

            <v-row>
              <v-col cols="12" sm="6">
                <v-select v-model="activityFormData.assigned_to" label="Asignar a"
                  :items="['Julio', 'Juanpa', 'Roberto', 'Piero']" variant="outlined" density="compact"
                  :rules="[v => !!v || 'Requerido']"></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-select v-model="activityFormData.type" label="Tipo" :items="['diaria', 'semanal']" variant="outlined"
                  density="compact"></v-select>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="activityFormData.start_date" label="Fecha Inicio" type="date" variant="outlined"
                  density="compact"></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="activityFormData.due_date" label="Fecha Vencimiento" type="date"
                  variant="outlined" density="compact" :rules="[v => !!v || 'Requerido']"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" sm="6">
                <v-select v-model="activityFormData.priority" label="Nivel de Importancia"
                  :items="['rojo', 'amarillo', 'verde']" variant="outlined" density="compact">
                  <template v-slot:selection="{ item }">
                    <v-chip :color="item.raw === 'rojo' ? 'error' : item.raw === 'amarillo' ? 'warning' : 'success'"
                      size="small" label>{{ item.raw.toUpperCase() }}</v-chip>
                  </template>
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-icon icon="mdi-circle"
                          :color="item.raw === 'rojo' ? 'error' : item.raw === 'amarillo' ? 'warning' : 'success'"
                          size="12" class="mr-2" />
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="activityFormData.bonus_points" label="Puntos Bono" type="number"
                  variant="outlined" density="compact" prepend-inner-icon="mdi-star"></v-text-field>
              </v-col>
            </v-row>

          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeActivityDialog">Cancelar</v-btn>
          <v-btn color="error" variant="text" v-if="editingActivity"
            @click="deleteActivity(editingActivity.id)">Eliminar</v-btn>
          <v-btn color="primary" variant="elevated" @click="saveActivity">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- ==========  CREATE USER DIALOG  ========== -->
    <!-- ==========  SETTINGS DIALOG (REMOVED)  ========== -->

      <!-- ==========  VISTA: DEV · AGENT LOGS  ========== -->
      <div v-if="activeView === 'dev_logs'" class="view-container">
        <header class="top-header">
          <div>
            <h1 style="display:flex; align-items:center; gap:0.5rem;">
              <v-icon icon="mdi-robot-excited" color="primary" />
              Dev · Agent Logs
            </h1>
            <p style="font-size:0.8rem; color:var(--text-muted); margin:2px 0 0 0;">
              Ejecuciones de tools del agente IA — en tiempo real
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <v-select v-model="devLogsCompanyFilter"
              :items="['Todas', 'healup', 'brada', 'estasconsuerte', 'estetikamedika', 'davila']"
              variant="outlined" density="compact" hide-details style="min-width:180px;" label="Empresa" />
            <v-select v-model="devLogsStatusFilter"
              :items="['Todos', 'success', 'partial', 'error', 'running']"
              variant="outlined" density="compact" hide-details style="min-width:140px;" label="Estado" />
            <button class="btn-primary" @click="fetchDevLogs" style="padding:6px 14px;">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">

          <!-- KPIs -->
          <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom:1.5rem;">
            <div class="stat-card">
              <div class="stat-title">Total Ejecuciones</div>
              <div class="stat-value">{{ devLogs.length }}</div>
              <div class="stat-subtitle">Historial completo</div>
            </div>
            <div class="stat-card" style="border-top:4px solid #22c55e;">
              <div class="stat-title">Exitosas</div>
              <div class="stat-value" style="color:#22c55e;">{{ devLogs.filter(l=>l.status==='success').length }}</div>
              <div class="stat-subtitle">100% completadas</div>
            </div>
            <div class="stat-card" style="border-top:4px solid #f59e0b;">
              <div class="stat-title">Parciales</div>
              <div class="stat-value" style="color:#f59e0b;">{{ devLogs.filter(l=>l.status==='partial').length }}</div>
              <div class="stat-subtitle">Algunos pasos fallaron</div>
            </div>
            <div class="stat-card" style="border-top:4px solid #ef4444;">
              <div class="stat-title">Errores</div>
              <div class="stat-value" style="color:#ef4444;">{{ devLogs.filter(l=>l.status==='error').length }}</div>
              <div class="stat-subtitle">Fallaron completamente</div>
            </div>
            <div class="stat-card" style="border-top:4px solid #6366f1;">
              <div class="stat-title">Hoy</div>
              <div class="stat-value">{{ devLogsHoy.length }}</div>
              <div class="stat-subtitle">Ejecuciones de hoy</div>
            </div>
          </div>

          <!-- Tabla principal -->
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Historial de Ejecuciones</span>
                <v-spacer />
                <v-text-field v-model="devLogsSearch" append-inner-icon="mdi-magnify" label="Buscar..."
                  single-line hide-details density="compact" variant="outlined" class="search-field" />
              </v-card-title>

              <v-data-table :headers="headersDevLogs" :items="devLogsFiltrados" :search="devLogsSearch"
                :loading="loadingDevLogs" class="elevation-0" no-data-text="Sin ejecuciones registradas aún."
                @click:row="(_, { item }) => openDevLogDetail(item)">

                <template v-slot:item.created_at="{ item }">
                  <span style="font-size:0.8rem; white-space:nowrap;">
                    {{ item.created_at ? new Date(item.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—' }}
                  </span>
                </template>

                <template v-slot:item.company_id="{ item }">
                  <v-chip size="small" variant="tonal" color="primary">{{ item.company_id }}</v-chip>
                </template>

                <template v-slot:item.tool_name="{ item }">
                  <span style="font-weight:600;">{{ item.tool_name }}</span>
                </template>

                <template v-slot:item.status="{ item }">
                  <v-chip
                    :color="item.status==='success' ? 'success' : item.status==='partial' ? 'warning' : item.status==='error' ? 'error' : 'default'"
                    size="small">
                    <v-icon start size="12">
                      {{ item.status==='success' ? 'mdi-check-circle' : item.status==='partial' ? 'mdi-alert-circle' : item.status==='error' ? 'mdi-close-circle' : 'mdi-loading' }}
                    </v-icon>
                    {{ item.status }}
                  </v-chip>
                </template>

                <template v-slot:item.duration_ms="{ item }">
                  <span style="font-size:0.8rem; color:var(--text-muted);">
                    {{ item.duration_ms ? (item.duration_ms / 1000).toFixed(1) + 's' : '—' }}
                  </span>
                </template>

                <template v-slot:item.cliente="{ item }">
                  <span style="font-size:0.85rem;">{{ item.input_data?.nombre_completo ?? '—' }}</span>
                </template>

                <template v-slot:item.cita="{ item }">
                  <span style="font-size:0.8rem; color:var(--text-muted);">
                    {{ item.input_data?.inicio_cita ? new Date(item.input_data.inicio_cita).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—' }}
                  </span>
                </template>

                <template v-slot:item.pasos="{ item }">
                  <div style="display:flex; gap:4px;">
                    <v-chip size="x-small" :color="item.output_data?.calendario?.ok ? 'success' : 'default'" variant="tonal">📅 Cal</v-chip>
                    <v-chip size="x-small" :color="item.output_data?.paciente?.ok ? 'success' : 'default'" variant="tonal">👤 Pac</v-chip>
                    <v-chip size="x-small" :color="item.output_data?.boleta?.ok ? 'success' : 'default'" variant="tonal">📄 Bol</v-chip>
                  </div>
                </template>

                <template v-slot:item.error_message="{ item }">
                  <span v-if="item.error_message" style="color:#ef4444; font-size:0.78rem; max-width:200px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    {{ item.error_message }}
                  </span>
                  <span v-else style="color:var(--text-muted);">—</span>
                </template>

                <template v-slot:item.acciones="{ item }">
                  <v-btn icon size="small" variant="text" @click.stop="openDevLogDetail(item)">
                    <v-icon>mdi-eye</v-icon>
                  </v-btn>
                </template>

              </v-data-table>
            </v-card>
          </div>

          <!-- Info del endpoint -->
          <v-card flat class="mt-4" style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.25rem;">
            <div style="font-size:0.75rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">
              🔌 Endpoint del agente IA
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem;">
              <div style="display:flex; gap:1rem; align-items:center;">
                <span style="color:var(--text-muted); width:100px;">URL:</span>
                <code style="background:var(--bg); padding:3px 8px; border-radius:4px; font-size:0.8rem;">POST https://dashboard.alef.company/api/healup/calendario</code>
              </div>
              <div style="display:flex; gap:1rem; align-items:center;">
                <span style="color:var(--text-muted); width:100px;">API Key:</span>
                <code style="background:var(--bg); padding:3px 8px; border-radius:4px; font-size:0.8rem;">healup-calendario-2026</code>
              </div>
              <div style="display:flex; gap:1rem; align-items:center;">
                <span style="color:var(--text-muted); width:100px;">Campos:</span>
                <code style="background:var(--bg); padding:3px 8px; border-radius:4px; font-size:0.8rem;">api_key · nombre_completo · inicio_cita · fin_cita · numerotelefono · DNI · ID · red_social · tratamiento(s)</code>
              </div>
            </div>
          </v-card>
        </div>
      </div>

      <!-- Dialog: detalle del log -->
      <v-dialog v-model="devLogDetailDialog" max-width="960" scrollable>
        <v-card style="background:#111827; color:#f1f5f9; border:1px solid #1e293b;">
          <!-- Header -->
          <v-card-title style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.5rem; border-bottom:1px solid #1e293b; background:#0a0f1e;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <v-chip :color="devLogSelected?.status==='success' ? 'success' : devLogSelected?.status==='partial' ? 'warning' : 'error'" size="small">
                {{ devLogSelected?.status }}
              </v-chip>
              <span style="font-size:0.95rem; font-weight:600;">
                Log #{{ devLogSelected?.id }} — {{ devLogSelected?.tool_name }} · {{ devLogSelected?.company_id }}
              </span>
              <span style="font-size:0.78rem; color:#64748b;">
                {{ devLogSelected?.created_at ? new Date(devLogSelected.created_at).toLocaleString('es-PE') : '' }}
                {{ devLogSelected?.duration_ms ? ' · ' + (devLogSelected.duration_ms/1000).toFixed(2) + 's' : '' }}
              </span>
            </div>
            <v-btn icon variant="text" color="#94a3b8" @click="devLogDetailDialog = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>

          <v-card-text v-if="devLogSelected" style="padding:1.25rem; background:#111827;">
            <!-- Chips de pasos -->
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:1rem;">
              <v-chip size="small" :color="devLogSelected.output_data?.google_calendar?.ok===true ? 'success' : devLogSelected.output_data?.google_calendar?.ok===false ? 'error' : 'default'" variant="tonal">
                📅 GCal {{ devLogSelected.output_data?.google_calendar?.ok===true ? '✅' : devLogSelected.output_data?.google_calendar?.ok===false ? '❌' : '—' }}
              </v-chip>
              <v-chip size="small" :color="devLogSelected.output_data?.calendario?.ok===true ? 'success' : devLogSelected.output_data?.calendario?.ok===false ? 'error' : 'default'" variant="tonal">
                🗓 Supabase {{ devLogSelected.output_data?.calendario?.ok===true ? '✅' : devLogSelected.output_data?.calendario?.ok===false ? '❌' : '—' }}
              </v-chip>
              <v-chip size="small" :color="devLogSelected.output_data?.paciente?.ok===true ? 'success' : devLogSelected.output_data?.paciente?.ok===false ? 'error' : 'default'" variant="tonal">
                👤 Paciente {{ devLogSelected.output_data?.paciente?.ok===true ? '✅' : devLogSelected.output_data?.paciente?.ok===false ? '❌' : '—' }}
              </v-chip>
              <v-chip size="small" :color="devLogSelected.output_data?.boleta?.ok===true ? 'success' : devLogSelected.output_data?.boleta?.ok===false ? 'error' : 'default'" variant="tonal">
                📄 Boleta {{ devLogSelected.output_data?.boleta?.ok===true ? '✅' : devLogSelected.output_data?.boleta?.ok===false ? '❌' : '—' }}
              </v-chip>
            </div>

            <!-- Alerta si GCal falló -->
            <div v-if="devLogSelected.output_data?.google_calendar?.ok===false"
              style="margin-bottom:1rem; background:#1a0505; border:1px solid #7f1d1d; border-radius:8px; padding:0.75rem 1rem;">
              <div style="font-size:0.75rem; font-weight:700; color:#fca5a5; margin-bottom:0.3rem;">❌ Google Calendar — Error</div>
              <code style="font-size:0.72rem; color:#fca5a5; white-space:pre-wrap; word-break:break-all;">{{ devLogSelected.output_data.google_calendar.error }}</code>
            </div>

            <!-- Error global -->
            <div v-if="devLogSelected.error_message"
              style="margin-bottom:1rem; background:#1a0505; border:1px solid #ef4444; border-radius:8px; padding:0.75rem 1rem; font-size:0.85rem; color:#fca5a5;">
              ⚠️ {{ devLogSelected.error_message }}
            </div>

            <!-- JSON panels -->
            <v-row>
              <v-col cols="12" md="6">
                <div style="font-size:0.7rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.4rem;">📥 Input recibido</div>
                <pre style="background:#0d1117; border:1px solid #21262d; color:#c9d1d9; padding:1rem; border-radius:8px; font-size:0.72rem; overflow:auto; white-space:pre-wrap; max-height:420px; line-height:1.6; font-family:'Fira Code',monospace,sans-serif;">{{ JSON.stringify(devLogSelected.input_data, null, 2) }}</pre>
              </v-col>
              <v-col cols="12" md="6">
                <div style="font-size:0.7rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.4rem;">📤 Output generado</div>
                <pre style="background:#0d1117; border:1px solid #21262d; color:#c9d1d9; padding:1rem; border-radius:8px; font-size:0.72rem; overflow:auto; white-space:pre-wrap; max-height:420px; line-height:1.6; font-family:'Fira Code',monospace,sans-serif;">{{ JSON.stringify(devLogSelected.output_data, null, 2) }}</pre>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-dialog>

      <RemarketingPanel
        v-if="activeView === 'remarketing'"
        company-id="alef"
        :lead-tablas="{ wpp: '', fbig: '' }"
      />

      <div v-else-if="activeView === 'tickets'" class="view-container">
        <TicketPanel company-id="alef" empresa-nombre="Alef Company" :current-user="currentUser?.full_name || currentUser?.email" :is-alef="true" />
      </div>

      <!-- ══════════  VISTA: BRIEF DEL DÍA  ══════════ -->
      <div v-else-if="activeView === 'brief'" class="view-container">
        <header class="top-header">
          <div>
            <h1>Brief del Día</h1>
            <p style="font-size:0.8rem;color:var(--muted-foreground);margin:0;">{{ new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' }) }}</p>
          </div>
          <button class="btn-primary" @click="showBriefDialog = true; resetBriefForm()">
            <v-icon icon="mdi-plus" size="16" />
            <span>Nuevo Brief</span>
          </button>
        </header>
        <div class="content-area">

          <!-- Brief de hoy -->
          <div v-if="briefHoy" style="margin-bottom:1.5rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
              <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
              <span style="font-size:0.8rem;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;">Hoy</span>
            </div>
            <div class="brief-card brief-card--hoy">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;">
                <h2 style="font-size:1.15rem;font-weight:700;color:var(--foreground);margin:0;">{{ briefHoy.titulo }}</h2>
                <span style="font-size:0.72rem;color:var(--muted-foreground);">por {{ briefHoy.autor }}</span>
              </div>
              <p style="margin:0.75rem 0;font-size:0.88rem;color:var(--foreground);line-height:1.6;white-space:pre-wrap;">{{ briefHoy.contenido }}</p>
              <div v-if="briefHoy.prioridades?.length" style="margin-top:0.75rem;">
                <div style="font-size:0.75rem;font-weight:600;color:var(--muted-foreground);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em;">Prioridades</div>
                <div style="display:flex;flex-direction:column;gap:0.4rem;">
                  <div v-for="(p, i) in briefHoy.prioridades" :key="i" style="display:flex;align-items:center;gap:0.6rem;">
                    <span style="width:20px;height:20px;border-radius:50%;background:var(--primary);color:#fff;font-size:0.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{{ i+1 }}</span>
                    <span style="font-size:0.85rem;color:var(--foreground);">{{ p }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else style="text-align:center;padding:2rem;background:var(--card);border:2px dashed var(--border);border-radius:12px;margin-bottom:1.5rem;">
            <v-icon icon="mdi-lightning-bolt-outline" size="40" style="color:var(--muted-foreground);margin-bottom:0.5rem;" />
            <p style="color:var(--muted-foreground);margin:0;">No hay brief para hoy todavía.</p>
            <button class="btn-primary" style="margin-top:0.75rem;" @click="showBriefDialog = true; resetBriefForm()">Crear Brief del Día</button>
          </div>

          <!-- Histórico -->
          <h2 style="font-size:1rem;font-weight:600;color:var(--foreground);margin-bottom:0.75rem;">Briefs Anteriores</h2>
          <div v-if="briefsAnteriores.length === 0" style="color:var(--muted-foreground);font-size:0.85rem;">Sin briefs anteriores.</div>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div v-for="b in briefsAnteriores" :key="b.id" class="brief-card" style="cursor:pointer;" @click="verBriefDetalle(b)">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:0.72rem;color:var(--muted-foreground);">{{ new Date(b.fecha).toLocaleDateString('es-PE', {weekday:'short',day:'numeric',month:'short'}) }}</span>
                <span style="font-size:0.72rem;color:var(--muted-foreground);">por {{ b.autor }}</span>
              </div>
              <div style="font-weight:600;font-size:0.92rem;color:var(--foreground);margin-top:0.25rem;">{{ b.titulo }}</div>
              <div style="font-size:0.82rem;color:var(--muted-foreground);margin-top:0.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.contenido }}</div>
              <div v-if="b.prioridades?.length" style="margin-top:0.4rem;font-size:0.72rem;color:var(--muted-foreground);">{{ b.prioridades.length }} prioridade{{ b.prioridades.length > 1 ? 's' : '' }}</div>
            </div>
          </div>
        </div>

        <!-- Dialog Nuevo Brief -->
        <v-dialog v-model="showBriefDialog" max-width="560" persistent>
          <v-card style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
            <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0;">Nuevo Brief</v-card-title>
            <v-card-text style="padding:1rem 1.5rem;">
              <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <div>
                  <label class="form-label">Tu nombre</label>
                  <v-select v-model="briefForm.autor" :items="equipoAlef.map(m=>m.nombre+' '+m.apellido).map(s=>s.trim())" density="compact" variant="outlined" hide-details />
                </div>
                <div>
                  <label class="form-label">Título del brief</label>
                  <v-text-field v-model="briefForm.titulo" density="compact" variant="outlined" hide-details placeholder="Ej: Semana de lanzamiento Doc C" />
                </div>
                <div>
                  <label class="form-label">Contenido</label>
                  <v-textarea v-model="briefForm.contenido" density="compact" variant="outlined" hide-details rows="4" placeholder="Contexto del día, decisiones importantes, foco del equipo..." />
                </div>
                <div>
                  <label class="form-label">Prioridades del día</label>
                  <div style="display:flex;flex-direction:column;gap:0.4rem;">
                    <div v-for="(p, i) in briefForm.prioridades" :key="i" style="display:flex;gap:0.5rem;align-items:center;">
                      <v-text-field v-model="briefForm.prioridades[i]" density="compact" variant="outlined" hide-details :placeholder="`Prioridad ${i+1}`" style="flex:1;" />
                      <v-btn icon size="small" variant="text" @click="briefForm.prioridades.splice(i,1)"><v-icon>mdi-close</v-icon></v-btn>
                    </div>
                    <button class="btn-secondary" style="align-self:flex-start;font-size:0.8rem;" @click="briefForm.prioridades.push('')">+ Agregar prioridad</button>
                  </div>
                </div>
              </div>
            </v-card-text>
            <v-card-actions style="padding:0.75rem 1.5rem 1.25rem;gap:0.5rem;justify-content:flex-end;">
              <button class="btn-secondary" @click="showBriefDialog=false">Cancelar</button>
              <button class="btn-primary" :disabled="!briefForm.titulo || !briefForm.contenido || !briefForm.autor" @click="saveBrief()">Publicar Brief</button>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Dialog Ver Detalle Brief -->
        <v-dialog v-model="showBriefDetalle" max-width="560">
          <v-card v-if="briefSeleccionado" style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
            <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0.25rem;">{{ briefSeleccionado.titulo }}</v-card-title>
            <v-card-subtitle style="padding:0 1.5rem 0.75rem;font-size:0.75rem;">{{ new Date(briefSeleccionado.fecha).toLocaleDateString('es-PE', {weekday:'long',day:'numeric',month:'long'}) }} · por {{ briefSeleccionado.autor }}</v-card-subtitle>
            <v-card-text style="padding:0 1.5rem 1rem;">
              <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);">{{ briefSeleccionado.contenido }}</p>
              <div v-if="briefSeleccionado.prioridades?.length" style="margin-top:1rem;">
                <div style="font-size:0.72rem;font-weight:600;color:var(--muted-foreground);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Prioridades</div>
                <div v-for="(p,i) in briefSeleccionado.prioridades" :key="i" style="display:flex;gap:0.6rem;align-items:center;margin-bottom:0.35rem;">
                  <span style="width:20px;height:20px;border-radius:50%;background:var(--primary);color:#fff;font-size:0.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">{{ i+1 }}</span>
                  <span style="font-size:0.85rem;">{{ p }}</span>
                </div>
              </div>
            </v-card-text>
            <v-card-actions style="padding:0.5rem 1.5rem 1.25rem;justify-content:flex-end;">
              <button class="btn-secondary" @click="showBriefDetalle=false">Cerrar</button>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ══════════  VISTA: REPORTES DIARIOS  ══════════ -->
      <div v-else-if="activeView === 'reportes_diarios'" class="view-container">
        <header class="top-header">
          <div>
            <h1>Reportes Diarios</h1>
            <p style="font-size:0.8rem;color:var(--muted-foreground);margin:0;">{{ new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' }) }}</p>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <input type="date" v-model="reportesFecha" @change="fetchReportes(); fetchReportesEmpresas()" style="font-size:0.82rem;padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);" />
          </div>
        </header>
        <div class="content-area">

          <!-- Tabs: Equipo vs Empresas -->
          <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0;">
            <button :class="['rep-tab-btn', { active: reportesTab === 'equipo' }]" @click="reportesTab = 'equipo'">
              👥 Equipo Alef
            </button>
            <button :class="['rep-tab-btn', { active: reportesTab === 'empresas' }]" @click="reportesTab = 'empresas'; fetchReportesEmpresas()">
              🏢 Todas las Empresas
            </button>
          </div>

          <!-- ── TAB: EQUIPO ALEF ── -->
          <div v-if="reportesTab === 'equipo'">
            <!-- Grid de 5 miembros -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-bottom:2rem;">
              <div v-for="m in equipoAlef" :key="m.nombre" class="alef-company-card" style="cursor:pointer;" @click="abrirReporte(m)">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
                  <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;" :style="{background: m.color}">{{ m.inicial }}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.92rem;color:var(--foreground);">{{ m.nombre }} {{ m.apellido }}</div>
                    <div style="font-size:0.72rem;color:var(--muted-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ m.cargo }}</div>
                  </div>
                  <v-icon v-if="getReporteDeHoy(m.nombre)" icon="mdi-check-circle" color="success" size="22" />
                  <v-icon v-else icon="mdi-circle-outline" size="22" style="color:var(--border);" />
                </div>
                <div v-if="getReporteDeHoy(m.nombre)" style="font-size:0.8rem;color:var(--foreground);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                  {{ getReporteDeHoy(m.nombre)?.logros }}
                </div>
                <div v-else style="font-size:0.78rem;color:var(--muted-foreground);font-style:italic;">Sin reporte hoy</div>
              </div>
            </div>

            <!-- Lista histórica equipo -->
            <h2 style="font-size:1rem;font-weight:600;color:var(--foreground);margin-bottom:0.75rem;">Todos los Reportes del Equipo</h2>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
              <div v-for="r in reportesDiarios" :key="r.id" class="brief-card">
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                  <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;"
                    :style="{background: equipoAlef.find(m=>m.nombre===r.autor.split(' ')[0])?.color || '#64748b'}">
                    {{ r.autor.split(' ').map((n:string)=>n[0]).slice(0,2).join('') }}
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;color:var(--foreground);">{{ r.autor }}</div>
                    <div style="font-size:0.72rem;color:var(--muted-foreground);">{{ r.cargo }} · {{ new Date(r.fecha).toLocaleDateString('es-PE',{day:'numeric',month:'short'}) }}</div>
                  </div>
                  <button class="btn-secondary" style="font-size:0.75rem;" @click="verReporteDetalle(r)">Ver</button>
                </div>
                <div style="margin-top:0.5rem;font-size:0.82rem;color:var(--foreground);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{{ r.logros }}</div>
                <div v-if="r.blockers" style="margin-top:0.35rem;font-size:0.78rem;color:#ef4444;">⚠ {{ r.blockers }}</div>
              </div>
              <div v-if="reportesDiarios.length===0" style="color:var(--muted-foreground);font-size:0.85rem;text-align:center;padding:1.5rem;">Sin reportes para esta fecha.</div>
            </div>
          </div>

          <!-- ── TAB: EMPRESAS ── -->
          <div v-else-if="reportesTab === 'empresas'">
            <!-- Resumen del día: grid de empresas -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem;margin-bottom:2rem;">
              <div v-for="emp in todasEmpresas" :key="emp.id" class="alef-company-card"
                :style="{ cursor: getReporteEmpresaHoy(emp.id) ? 'pointer' : 'default', borderColor: getReporteEmpresaHoy(emp.id) ? '#22c55e' : undefined }"
                @click="getReporteEmpresaHoy(emp.id) && verReporteEmpresa(getReporteEmpresaHoy(emp.id))">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                  <div style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;background:var(--primary);">
                    {{ emp.nombre.slice(0,2).toUpperCase() }}
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;color:var(--foreground);">{{ emp.nombre }}</div>
                    <div v-if="getReporteEmpresaHoy(emp.id)" style="font-size:0.7rem;color:#16a34a;margin-top:2px;">✓ Reporte enviado</div>
                    <div v-else style="font-size:0.7rem;color:var(--muted-foreground);margin-top:2px;font-style:italic;">Sin reporte hoy</div>
                  </div>
                  <v-icon v-if="getReporteEmpresaHoy(emp.id)" icon="mdi-check-circle" color="success" size="20" />
                  <v-icon v-else icon="mdi-circle-outline" size="20" style="color:var(--border);" />
                </div>
                <div v-if="getReporteEmpresaHoy(emp.id)" style="margin-top:0.6rem;font-size:0.78rem;color:var(--muted-foreground);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                  {{ getReporteEmpresaHoy(emp.id)?.resumen }}
                </div>
              </div>
            </div>

            <!-- Lista de todos los reportes de empresas -->
            <h2 style="font-size:1rem;font-weight:600;color:var(--foreground);margin-bottom:0.75rem;">Historial de Reportes — Todas las Empresas</h2>
            <div v-if="loadingReportesEmpresas" style="text-align:center;padding:2rem;color:var(--muted-foreground);">Cargando...</div>
            <div v-else style="display:flex;flex-direction:column;gap:0.5rem;">
              <div v-for="r in reportesEmpresas" :key="r.id" class="brief-card" style="cursor:pointer;" @click="verReporteEmpresa(r)">
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                  <div style="width:32px;height:32px;border-radius:8px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">
                    {{ r.empresa_nombre.slice(0,2).toUpperCase() }}
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;color:var(--foreground);">{{ r.empresa_nombre }}</div>
                    <div style="font-size:0.72rem;color:var(--muted-foreground);">por {{ r.autor }} · {{ new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-PE',{weekday:'short',day:'numeric',month:'short'}) }}</div>
                  </div>
                  <span v-if="r.blockers" style="font-size:0.68rem;background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:10px;">⚠ blocker</span>
                </div>
                <div style="margin-top:0.5rem;font-size:0.82rem;color:var(--foreground);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{{ r.resumen }}</div>
              </div>
              <div v-if="reportesEmpresas.length===0" style="color:var(--muted-foreground);font-size:0.85rem;text-align:center;padding:1.5rem;">Sin reportes de empresas para esta fecha.</div>
            </div>
          </div>

        </div>

        <!-- Dialog Crear/Ver Reporte -->
        <v-dialog v-model="showReporteDialog" max-width="520" persistent>
          <v-card style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
            <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0;">
              Reporte — {{ reporteForm.autor }}
              <div style="font-size:0.72rem;font-weight:400;color:var(--muted-foreground);margin-top:2px;">{{ reporteForm.cargo }}</div>
            </v-card-title>
            <v-card-text style="padding:1rem 1.5rem;">
              <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <div>
                  <label class="form-label">¿Qué hice hoy? <span style="color:#ef4444;">*</span></label>
                  <v-textarea v-model="reporteForm.logros" density="compact" variant="outlined" hide-details rows="3" placeholder="Tareas completadas, avances, resultados..." />
                </div>
                <div>
                  <label class="form-label">Pendientes para mañana</label>
                  <v-textarea v-model="reporteForm.pendientes" density="compact" variant="outlined" hide-details rows="2" placeholder="Qué queda por hacer..." />
                </div>
                <div>
                  <label class="form-label">Blockers / Impedimentos</label>
                  <v-textarea v-model="reporteForm.blockers" density="compact" variant="outlined" hide-details rows="2" placeholder="Algo que te bloquea o necesitas de alguien..." />
                </div>
              </div>
            </v-card-text>
            <v-card-actions style="padding:0.75rem 1.5rem 1.25rem;gap:0.5rem;justify-content:flex-end;">
              <button class="btn-secondary" @click="showReporteDialog=false">Cancelar</button>
              <button class="btn-primary" :disabled="!reporteForm.logros" @click="saveReporte()">Guardar Reporte</button>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Dialog Ver detalle reporte -->
        <v-dialog v-model="showReporteDetalle" max-width="480">
          <v-card v-if="reporteSeleccionado" style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
            <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0.25rem;">{{ reporteSeleccionado.autor }}</v-card-title>
            <v-card-subtitle style="padding:0 1.5rem 0.75rem;font-size:0.75rem;">{{ reporteSeleccionado.cargo }} · {{ new Date(reporteSeleccionado.fecha).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'}) }}</v-card-subtitle>
            <v-card-text style="padding:0 1.5rem 1rem;display:flex;flex-direction:column;gap:1rem;">
              <div>
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.4rem;">Qué hice hoy</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteSeleccionado.logros }}</p>
              </div>
              <div v-if="reporteSeleccionado.pendientes">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.4rem;">Pendientes</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteSeleccionado.pendientes }}</p>
              </div>
              <div v-if="reporteSeleccionado.blockers">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#ef4444;margin-bottom:0.4rem;">⚠ Blockers</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteSeleccionado.blockers }}</p>
              </div>
            </v-card-text>
            <v-card-actions style="padding:0.5rem 1.5rem 1.25rem;justify-content:flex-end;">
              <button class="btn-secondary" @click="showReporteDetalle=false">Cerrar</button>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Dialog: Ver reporte de empresa -->
        <v-dialog v-model="showReporteEmpresaDlg" max-width="500">
          <v-card v-if="reporteEmpresaSeleccionado" style="background:var(--card);border:1px solid var(--border);border-radius:16px;">
            <v-card-title style="font-size:1rem;font-weight:700;padding:1.25rem 1.5rem 0.25rem;">{{ reporteEmpresaSeleccionado.empresa_nombre }}</v-card-title>
            <v-card-subtitle style="padding:0 1.5rem 0.75rem;font-size:0.75rem;">
              {{ new Date(reporteEmpresaSeleccionado.fecha + 'T12:00:00').toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'}) }} · por {{ reporteEmpresaSeleccionado.autor }}
            </v-card-subtitle>
            <v-card-text style="padding:0 1.5rem 1rem;display:flex;flex-direction:column;gap:1rem;">
              <div>
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.4rem;">Resumen del día</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteEmpresaSeleccionado.resumen }}</p>
              </div>
              <div v-if="reporteEmpresaSeleccionado.logros">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.4rem;">Logros</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteEmpresaSeleccionado.logros }}</p>
              </div>
              <div v-if="reporteEmpresaSeleccionado.pendientes">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-foreground);margin-bottom:0.4rem;">Pendientes</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:var(--foreground);margin:0;">{{ reporteEmpresaSeleccionado.pendientes }}</p>
              </div>
              <div v-if="reporteEmpresaSeleccionado.blockers">
                <div style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#ef4444;margin-bottom:0.4rem;">⚠ Blockers</div>
                <p style="font-size:0.88rem;line-height:1.6;white-space:pre-wrap;color:#ef4444;margin:0;">{{ reporteEmpresaSeleccionado.blockers }}</p>
              </div>
            </v-card-text>
            <v-card-actions style="padding:0.5rem 1.5rem 1.25rem;justify-content:flex-end;">
              <button class="btn-secondary" @click="showReporteEmpresaDlg=false">Cerrar</button>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'

const { logActivity } = useActivityLogger()
import { useExcelExport } from '@/composables/useExcelExport'
const { downloadExcel } = useExcelExport()
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessAlef, dashboards } from '@/utils/permissions'

import SettingsView from '@/components/Settings/SettingsView.vue'

definePageMeta({
  middleware: 'auth-dashboard'
})

// Recuperar datos del usuario desde la cookie para mostrar el nombre real
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
const SUPABASE_URL = 'https://cpgysjsbvrzthgdkxhnp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ3lzanNidnJ6dGhnZGt4aG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDc0MTksImV4cCI6MjA3ODAyMzQxOX0.9Vxs-hS4kTtesYijMUXN6Vgki9GIU2pkz7NWqEs4pXM'

/* ---------------- Estado de la Tabla ---------------- */
const search = ref('')
const showCreateUserDialog = ref(false)
//const showSettingsDialog = ref(false)
const loading = ref(false)
const contribuyentes = ref<any[]>([])

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

/* ---------------- Fetch Data from Supabase (con $fetch nativo de Nuxt) ---------------- */
const fetchContribuyentes = async () => {
  loading.value = true
  try {
    const data = await $fetch(`${SUPABASE_URL}/rest/v1/contribuyentes?select=*`, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    })
    contribuyentes.value = data as any[]
    console.log('Datos cargados:', data)
  } catch (error) {
    console.error('Error al cargar datos:', error)
  } finally {
    loading.value = false
  }
}

/* ---------------- CRUD Operations ---------------- */
const editItem = (item: any) => {
  console.log('Editar:', item)
  // Implementa tu lógica de edición aquí
}

const deleteItem = async (item: any) => {
  if (!confirm(`¿Eliminar contribuyente ${item.nombre}?`)) return

  try {
    await $fetch(`${SUPABASE_URL}/rest/v1/contribuyentes?id=eq.${item.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    })
    await fetchContribuyentes()
  } catch (error) {
    console.error('Error al eliminar:', error)
  }
}

/* ---------------- Estado General ---------------- */
const activeView = ref('dashboard')

// ======================== DEV · AGENT LOGS ========================
const devLogs              = ref<any[]>([])
const loadingDevLogs       = ref(false)
const devLogsSearch        = ref('')
const devLogsCompanyFilter = ref('Todas')
const devLogsStatusFilter  = ref('Todos')
const devLogDetailDialog   = ref(false)
const devLogSelected       = ref<any>(null)

const devLogsHoy = computed(() => {
  const hoy = new Date().toISOString().slice(0, 10)
  return devLogs.value.filter(l => l.created_at?.startsWith(hoy))
})

const devLogsErrorCount = computed(() =>
  devLogs.value.filter(l => l.status === 'error').length
)

const devLogsFiltrados = computed(() => {
  let list = devLogs.value
  if (devLogsCompanyFilter.value !== 'Todas')
    list = list.filter(l => l.company_id === devLogsCompanyFilter.value)
  if (devLogsStatusFilter.value !== 'Todos')
    list = list.filter(l => l.status === devLogsStatusFilter.value)
  return list
})

const headersDevLogs = [
  { title: 'Fecha/Hora',  key: 'created_at',    sortable: true  },
  { title: 'Empresa',     key: 'company_id',     sortable: true  },
  { title: 'Tool',        key: 'tool_name',      sortable: true  },
  { title: 'Estado',      key: 'status',         sortable: false },
  { title: 'Pasos',       key: 'pasos',          sortable: false },
  { title: 'Cliente',     key: 'cliente',        sortable: false },
  { title: 'Cita',        key: 'cita',           sortable: false },
  { title: 'Duración',    key: 'duration_ms',    sortable: true  },
  { title: 'Error',       key: 'error_message',  sortable: false },
  { title: '',            key: 'acciones',       sortable: false },
]

const fetchDevLogs = async () => {
  loadingDevLogs.value = true
  try {
    const { data, error } = await client
      .from('agent_tool_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    devLogs.value = data || []
  } catch (e) {
    console.error('Error cargando agent_tool_logs:', e)
    devLogs.value = []
  } finally {
    loadingDevLogs.value = false
  }
}

const openDevLogDetail = (log: any) => {
  devLogSelected.value = log
  devLogDetailDialog.value = true
}

// Cargar logs al entrar a la vista
watch(activeView, (v) => {
  if (v === 'dev_logs' && devLogs.value.length === 0) fetchDevLogs()
})
const facturacionTab = ref('resumen')
const activeTab = ref('outline')
const showDashboardMenu = ref(false)
const showUserMenu = ref(false)

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



// ...

// ... (skipping down to onMounted)

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
  company_id: 'alefcompany'
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
  const { data, error } = await (client.from('egresos_alefcompany') as any).select('*').order('created_at', { ascending: false })
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
  return 45678 - totalEgresosMesActual.value // Using mock logic for this dashboard structure
})

const openEgresoDialog = (item?: any) => {
  if (item && item.id) {
    editingEgreso.value = true
    egresoFormData.value = { ...item }
  } else {
    editingEgreso.value = false
    egresoFormData.value = { id: '', tipo_egreso: '', nombre: '', precio: 0, cantidad: 1, company_id: 'alefcompany' }
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
    company_id: 'alefcompany'
  }
  if (editingEgreso.value && egresoFormData.value.id) {
    await (client.from('egresos_alefcompany') as any).update(payload).eq('id', egresoFormData.value.id)
  } else {
    await (client.from('egresos_alefcompany') as any).insert(payload)
  }
  savingEgreso.value = false
  closeEgresoDialog()
  fetchEgresos()
}

const deleteEgreso = async (id: string) => {
  if (confirm('¿Seguro que deseas eliminar este egreso?')) {
    await (client.from('egresos_alefcompany') as any).delete().eq('id', id)
    fetchEgresos()
  }
}

onMounted(() => {
  // Access Control
  const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessAlef(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard. Contacta a un administrador.')
    return navigateTo('/')
  }

  applyTheme()
  fetchContribuyentes()
  fetchEgresos()
  fetchAllCompanies()
  fetchTeam()
})

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
  { icon: 'mdi-clipboard-list', label: 'Actividades', id: 'actividades' },
  { icon: 'mdi-message-reply', label: 'Conversaciones', id: 'conversaciones', url: 'https://chats.alef.company/app/accounts/1/dashboard' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' },
  { icon: 'mdi-bell-alert', label: 'Alertas CRM', id: 'alertas_crm' }
]

const financiasItems = [
  { icon: 'mdi-cash-minus', label: 'Egresos', id: 'egresos' },
  { icon: 'mdi-currency-usd', label: 'Facturación', id: 'facturacion' },
  { icon: 'mdi-chart-line', label: 'Contabilidad', id: 'contabilidad' }
]

const documentItems = [
  { icon: 'mdi-arrow-right-bold-circle', label: 'Procedimientos', id: 'procedimientos' },
  { icon: 'mdi-folder', label: 'Historial Clínico', id: 'historialClinico' },
  { icon: 'mdi-robot-mower', label: 'Meta', id: 'meta' }
]

/* ---------------- Empresas Consolidadas ---------------- */

interface CompanyData {
  id: string
  name: string
  type: string
  logo: string
  dashboardPath: string
  chatwootUrl: string
  loaded: boolean
  leadsTotal: number
  frios: number
  tibios: number
  calientes: number
  conversiones: number
  revenue: number
  egresos: number
  leadTablesWpp: string
  leadTablesFbig: string
  pacientesTablesWpp: string
  pacientesTablesFbig: string
  egresosTable: string
  revenueModel: 'medical' | 'ecommerce' | 'receivables' | 'none'
  purchaseTables: string[]
}

const companiesData = reactive<CompanyData[]>([
  {
    id: 'healup', name: 'Healup', type: 'Medicina Estética', logo: '',
    dashboardPath: '/pruebas/Healup', chatwootUrl: 'https://chats.alef.company/app/accounts/2/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppHEALUP', leadTablesFbig: 'GeneralBDfbigHEALUP',
    pacientesTablesWpp: 'PacientesBDwppHEALUP', pacientesTablesFbig: 'PacientesBDfbigHEALUP',
    egresosTable: 'egresos_healup', revenueModel: 'medical', purchaseTables: []
  },
  {
    id: 'solari', name: 'Solari', type: 'Medicina Estética', logo: '',
    dashboardPath: '/pruebas/Solari', chatwootUrl: 'https://chats.alef.company/app/accounts/6/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppSOLARI', leadTablesFbig: 'GeneralBDfbigSOLARI',
    pacientesTablesWpp: 'PacientesBDwppSOLARI', pacientesTablesFbig: 'PacientesBDfbigSOLARI',
    egresosTable: 'egresos_solari', revenueModel: 'medical', purchaseTables: []
  },
  {
    id: 'estetikamedika', name: 'Estetika Medika', type: 'Medicina Estética', logo: '',
    dashboardPath: '/pruebas/EstetikaMedika', chatwootUrl: 'https://chats.alef.company/app/accounts/14/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppEstetikaMedika', leadTablesFbig: 'GeneralBDfbigEstetikaMedika',
    pacientesTablesWpp: 'PacientesBDwppEstetikaMedika', pacientesTablesFbig: 'PacientesBDfbigEstetikaMedika',
    egresosTable: 'egresos_EstetikaMedika', revenueModel: 'medical', purchaseTables: []
  },
  {
    id: 'davila', name: 'Miguel Davila', type: 'Medicina Estética', logo: '',
    dashboardPath: '/pruebas/MiguelDavila', chatwootUrl: 'https://chats.alef.company/app/accounts/3/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppDAVILA', leadTablesFbig: 'GeneralBDfbigDAVILA',
    pacientesTablesWpp: 'PacientesBDwppDAVILA', pacientesTablesFbig: 'PacientesBDfbigDAVILA',
    egresosTable: 'egresos_DAVILA', revenueModel: 'medical', purchaseTables: []
  },
  {
    id: 'brada', name: 'Brada Perfumes', type: 'E-commerce Perfumes', logo: '',
    dashboardPath: '/pruebas/BradaPerfumes', chatwootUrl: 'https://chats.alef.company/app/accounts/8/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppBRADA', leadTablesFbig: '',
    pacientesTablesWpp: '', pacientesTablesFbig: '',
    egresosTable: 'egresos_brada', revenueModel: 'ecommerce', purchaseTables: ['comprasBDwppBRADA', 'comprasBDwppBRADA24_7']
  },
  {
    id: 'skip', name: 'SKIP', type: 'Paracaidismo / Servicios', logo: '',
    dashboardPath: '/pruebas/SKIP', chatwootUrl: 'https://chats.alef.company/app/accounts/13/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppSKIP', leadTablesFbig: 'GeneralBDfbigSKIP',
    pacientesTablesWpp: '', pacientesTablesFbig: '',
    egresosTable: 'skip_egresos', revenueModel: 'ecommerce', purchaseTables: ['skip_reservas']
  },
  {
    id: 'origitec', name: 'Origitec', type: 'Tech E-commerce', logo: '',
    dashboardPath: '/pruebas/Origitec', chatwootUrl: 'https://chats.alef.company/app/accounts/10/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppOrigitec', leadTablesFbig: 'GeneralBDfbigOrigitec',
    pacientesTablesWpp: '', pacientesTablesFbig: '',
    egresosTable: 'egresos_origitec', revenueModel: 'ecommerce', purchaseTables: ['pago_completo_motorizado', 'pago_completo_courier', 'pago_completo_recojo_tienda', 'reserva_recojo_tienda']
  },
  {
    id: 'estasconsuerte', name: 'Estás Con Suerte', type: 'Sorteos / Suscripciones', logo: '',
    dashboardPath: '/pruebas/EstasConSuerte', chatwootUrl: 'https://chats.alef.company/app/accounts/12/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'ECS_GeneralBDwpp', leadTablesFbig: 'ECS_GeneralBDfbig',
    pacientesTablesWpp: '', pacientesTablesFbig: '',
    egresosTable: 'ECS_egresos', revenueModel: 'ecommerce', purchaseTables: ['ECS_pago_completo_motorizado', 'ECS_pago_completo_courier', 'ECS_pago_completo_recojo_tienda', 'ECS_reserva_recojo_tienda']
  },
  {
    id: 'gatwick', name: 'Gatwick', type: 'CCTV / Servicios Técnicos', logo: '',
    dashboardPath: '/pruebas/Gatwick', chatwootUrl: 'https://chats.alef.company/app/accounts/15/dashboard',
    loaded: false, leadsTotal: 0, frios: 0, tibios: 0, calientes: 0, conversiones: 0, revenue: 0, egresos: 0,
    leadTablesWpp: 'GeneralBDwppGATWICK', leadTablesFbig: 'GeneralBDfbigGATWICK',
    pacientesTablesWpp: 'ClientesBDwppGATWICK', pacientesTablesFbig: 'ClientesBDfbigGATWICK',
    egresosTable: 'egresos_GATWICK', revenueModel: 'receivables', purchaseTables: ['gatwick_cobranzas']
  }
])

const companyTableHeaders = [
  { title: 'Empresa', key: 'name', sortable: true },
  { title: 'Leads', key: 'leadsTotal', sortable: true },
  { title: 'Conversiones', key: 'conversiones', sortable: true },
  { title: 'Tasa Conv.', key: 'tasaConversion', sortable: true },
  { title: 'Ingresos', key: 'revenue', sortable: true },
  { title: 'Egresos', key: 'egresos', sortable: true },
  { title: 'Utilidad', key: 'utilidad', sortable: true }
]

const totalGlobalLeads = computed(() => companiesData.reduce((s, c) => s + c.leadsTotal, 0))
const totalGlobalConversiones = computed(() => companiesData.reduce((s, c) => s + c.conversiones, 0))
const totalGlobalRevenue = computed(() => companiesData.reduce((s, c) => s + c.revenue, 0))
const totalGlobalEgresos = computed(() => companiesData.reduce((s, c) => s + c.egresos, 0))

/* ---------------- Equipo ---------------- */
const teamMembers = ref<any[]>([])
const teamSearch = ref('')
const showNewMemberDialog = ref(false)
const editingMemberId = ref<number | null>(null)
const editingCargo = ref('')

const teamHeaders = [
  { title: 'Nombre', key: 'full_name', sortable: true },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Empresa', key: 'company_id', sortable: true },
  { title: 'Rol', key: 'role', sortable: true },
  { title: 'Cargo', key: 'cargo', sortable: true },
  { title: 'Desde', key: 'created_at', sortable: true }
]

const teamByCompany = computed(() => {
  const map: Record<string, any[]> = {}
  teamMembers.value.forEach(m => {
    const co = m.company_id || 'sin empresa'
    if (!map[co]) map[co] = []
    map[co].push(m)
  })
  return Object.entries(map)
    .map(([company, members]) => ({ company, members: members.sort((a: any, b: any) => {
      const order: Record<string, number> = { superadmin: 0, admin: 1, agente: 2, agent: 2 }
      return (order[a.role] ?? 3) - (order[b.role] ?? 3)
    })}))
    .sort((a, b) => a.company.localeCompare(b.company))
})

const fetchTeam = async () => {
  const { data } = await (client.from('dashboardlogin') as any)
    .select('id,email,full_name,role,company_id,cargo,created_at')
    .order('company_id')
    .order('role')
  teamMembers.value = data || []
}

const startEditCargo = (item: any) => {
  editingMemberId.value = item.id
  editingCargo.value = item.cargo || ''
}

const saveMemberCargo = async (item: any) => {
  if (editingMemberId.value !== item.id) return
  await (client.from('dashboardlogin') as any).update({ cargo: editingCargo.value }).eq('id', item.id)
  item.cargo = editingCargo.value
  editingMemberId.value = null
}

/* ---------------- Reportes ---------------- */
const reportMonth = ref((() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})())

const reportMonthOptions = computed(() => {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-PE', { year: 'numeric', month: 'long' })
    opts.push({ title: label.charAt(0).toUpperCase() + label.slice(1), value: val })
  }
  return opts
})

const companiesRanking = computed(() => {
  return [...companiesData]
    .filter(c => c.loaded)
    .sort((a, b) => (b.revenue - b.egresos) - (a.revenue - a.egresos))
})

const reportChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', background: 'transparent', foreColor: 'var(--foreground)', toolbar: { show: false } },
  plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
  dataLabels: { enabled: false },
  stroke: { show: true, width: 2, colors: ['transparent'] },
  xaxis: { categories: companiesData.filter(c => c.loaded).map(c => c.name) },
  yaxis: { labels: { formatter: (v: number) => `S/${(v/1000).toFixed(0)}k` } },
  colors: ['#22c55e', '#ef4444'],
  legend: { position: 'top' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  grid: { borderColor: 'var(--border)', strokeDashArray: 4 }
}))

const reportChartSeries = computed(() => {
  const loaded = companiesData.filter(c => c.loaded)
  return [
    { name: 'Ingresos', data: loaded.map(c => +c.revenue.toFixed(2)) },
    { name: 'Egresos', data: loaded.map(c => +c.egresos.toFixed(2)) }
  ]
})

const leadsDonutOptions = computed<ApexOptions>(() => ({
  chart: { type: 'donut', background: 'transparent' },
  labels: companiesData.filter(c => c.loaded && c.leadsTotal > 0).map(c => c.name),
  theme: { mode: isDark.value ? 'dark' : 'light' },
  legend: { position: 'bottom', fontSize: '11px' },
  dataLabels: { enabled: true, formatter: (_: any, opts: any) => opts.w.config.series[opts.seriesIndex] }
}))

const leadsDonutSeries = computed(() =>
  companiesData.filter(c => c.loaded && c.leadsTotal > 0).map(c => c.leadsTotal)
)

const revenueDonutOptions = computed<ApexOptions>(() => ({
  chart: { type: 'donut', background: 'transparent' },
  labels: companiesData.filter(c => c.loaded && c.revenue > 0).map(c => c.name),
  theme: { mode: isDark.value ? 'dark' : 'light' },
  legend: { position: 'bottom', fontSize: '11px' },
  dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' }
}))

const revenueDonutSeries = computed(() =>
  companiesData.filter(c => c.loaded && c.revenue > 0).map(c => +c.revenue.toFixed(0))
)

function pct(val: number, total: number) {
  if (!total) return '0%'
  return Math.round((val / total) * 100) + '%'
}

const currentMonthPrefix = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

async function safeCount(table: string): Promise<any[]> {
  if (!table) return []
  try {
    const { data } = await (client.from(table) as any).select('*')
    return data || []
  } catch { return [] }
}

async function fetchCompanyData(co: CompanyData) {
  const now = new Date()
  const mesActual = now.getMonth()
  const anioActual = now.getFullYear()

  try {
    // Leads WPP
    const leadsWpp = await safeCount(co.leadTablesWpp)
    const leadsFbig = await safeCount(co.leadTablesFbig)
    const allLeads = [...leadsWpp, ...leadsFbig]

    // Filtrar leads del mes actual
    const leadsThisMonth = allLeads.filter(l => {
      const d = new Date(l.created_at)
      return d.getMonth() === mesActual && d.getFullYear() === anioActual
    })

    co.leadsTotal = leadsThisMonth.length

    // Temperatura
    co.frios = leadsThisMonth.filter(l => (l.lead_status || '').toLowerCase().includes('fri')).length
    co.tibios = leadsThisMonth.filter(l => (l.lead_status || '').toLowerCase().includes('tibi')).length
    co.calientes = leadsThisMonth.filter(l => (l.lead_status || '').toLowerCase().includes('caliente')).length

    // Conversiones (pacientes del mes)
    if (co.revenueModel === 'medical') {
      const pacWpp = await safeCount(co.pacientesTablesWpp)
      const pacFbig = await safeCount(co.pacientesTablesFbig)
      const allPac = [...pacWpp, ...pacFbig]
      co.conversiones = allPac.filter(p => {
        const fa = p.fecha_agendamiento || ''
        return fa.startsWith(currentMonthPrefix.value)
      }).length

      // Revenue: sum precio_reserva + precio_tratamiento de pacientes del mes
      const pacMes = allPac.filter(p => (p.fecha_agendamiento || '').startsWith(currentMonthPrefix.value))
      co.revenue = pacMes.reduce((s, p) => {
        const reserva = parseFloat(p.precio_reserva) || 0
        const tratamiento = parseFloat(p.precio_tratamiento) || 0
        return s + reserva + tratamiento
      }, 0)
    } else if (co.revenueModel === 'ecommerce') {
      // Revenue: sum precio from purchase tables
      let totalRev = 0
      let totalSales = 0
      for (const pt of co.purchaseTables) {
        const rows = await safeCount(pt)
        const mesRows = rows.filter(r => {
          const d = new Date(r.created_at)
          return d.getMonth() === mesActual && d.getFullYear() === anioActual
        })
        totalSales += mesRows.length
        totalRev += mesRows.reduce((s, r) => s + (parseFloat(r.precio) || 0) * (parseInt(r.cantidad) || 1), 0)
      }
      co.revenue = totalRev
      co.conversiones = totalSales
    } else if (co.revenueModel === 'receivables') {
      // Gatwick: cobranzas pagadas del mes
      const rows = await safeCount('gatwick_cobranzas')
      const mesRows = rows.filter(r => {
        const d = new Date(r.created_at)
        return d.getMonth() === mesActual && d.getFullYear() === anioActual
      })
      co.revenue = mesRows.filter(r => r.estado_pago === 'pagado').reduce((s, r) => s + (parseFloat(r.monto) || 0), 0)
      co.conversiones = mesRows.filter(r => r.estado_pago === 'pagado').length
    }

    // Egresos
    const egresosRows = await safeCount(co.egresosTable)
    co.egresos = egresosRows.filter(e => {
      if (e.deleted_at || e.descartado || e.deleted) return false
      const d = new Date(e.created_at)
      return d.getMonth() === mesActual && d.getFullYear() === anioActual
    }).reduce((s, e) => s + ((parseFloat(e.precio) || 0) * (parseInt(e.cantidad) || 1)), 0)

    co.loaded = true
  } catch (err) {
    console.error(`[AlefCompany] Error fetching ${co.id}:`, err)
    co.loaded = true
  }
}

async function fetchAllCompanies() {
  companiesData.forEach(c => { c.loaded = false })
  // Fetch in parallel batches of 3 to not overwhelm Supabase
  for (let i = 0; i < companiesData.length; i += 3) {
    const batch = companiesData.slice(i, i + 3)
    await Promise.all(batch.map(co => fetchCompanyData(co)))
  }
}

/* ---------------- Calendar Types & Interfaces ---------------- */
const client = useSupabaseClient()

interface CalendarEvent {
  id: string
  date: string
  time: string
  subject: string
  description: string
  tipo: string
  participantes: string
  direccion?: string
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
  direccion: '',
  subject: '',
  description: '',
  tipo: 'equipo',
  participantes: ''
})

const eventForm = ref<any>(null)

/* ---------------- Calendar Constants ---------------- */
const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]



const tiposReunion = [
  { value: 'equipo', label: '👥 Equipo Interno', color: '#6366f1' },
  { value: 'comercial', label: '💼 Reunión Comercial', color: '#f59e0b' },
  { value: 'cliente', label: '🤝 Con Cliente', color: '#10b981' },
  { value: 'otro', label: '📌 Otro', color: '#64748b' }
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
    tipo: 'equipo',
    participantes: '',
    direccion: ''
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
    eventFormData.value.tipo

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
      tipo: eventFormData.value.tipo,
      participantes: eventFormData.value.participantes,
      direccion: eventFormData.value.direccion || null
    }

    if (editingEvent.value) {
      // Update
      const { error } = await (client
        .from('alef_meetings') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('alef_meetings') as any)
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
      .from('alef_meetings')
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

function getMeetingColor(tipo: string): string {
  const t = tiposReunion.find(t => t.value === tipo)
  return t ? t.color : '#3b82f6'
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

async function fetchEvents() {
  try {
    const { data, error } = await (client as any)
      .from('alef_meetings')
      .select('*')
      .order('date', { ascending: true })

    if (error) throw error

    events.value = (data || []).map((e: any) => ({
      id: e.id,
      date: e.date,
      time: e.time,
      subject: e.subject,
      description: e.description,
      tipo: e.tipo || 'equipo',
      participantes: e.participantes || '',
      direccion: e.direccion || ''
    }))
  } catch (error) {
    console.error('Error loading meetings:', error)
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
        .from('alef_procedures') as any)
        .update(payload)
        .eq('id', editingProcedure.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('alef_procedures') as any)
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
        .from('alef_procedures')
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
      .from('alef_procedures')
      .select('*')
      .order('id', { ascending: false })

    if (error) throw error
    procedures.value = data || []
  } catch (error) {
    console.error('Error loading procedures:', error)
  }
}

/* ---------------- Lifecycle ---------------- */
/* ---------------- Lifecycle ---------------- */
onMounted(() => {
  // Access Control
  // const userEmail = currentUser.value.email?.toLowerCase()

  if (!canAccessAlef(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }
  handleZoom('one_month')
  fetchEvents()
  fetchProcedures()
  fetchMedicalHistory()
})

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
        .from('alef_client_history') as any)
        .update(payload)
        .eq('id', editingMedicalHistory.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('alef_client_history') as any)
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
        .from('alef_client_history')
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
      .from('alef_client_history')
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

/* ---------------- Activities System ---------------- */
interface Activity {
  id: string
  title: string
  description: string
  assigned_to: string
  start_date: string
  due_date: string
  status: 'pendiente' | 'en_progreso' | 'finalizada'
  priority: 'rojo' | 'amarillo' | 'verde'
  bonus_points: number
  type: 'diaria' | 'semanal'
  created_at: string
  completed_at?: string
}

const activities = ref<Activity[]>([])
const showActivityDialog = ref(false)
const editingActivity = ref<Activity | null>(null)
const activityForm = ref<any>(null)
const activityFormData = ref({
  title: '',
  description: '',
  assigned_to: '',
  start_date: new Date().toISOString().split('T')[0],
  due_date: '',
  status: 'pendiente',
  priority: 'verde',
  bonus_points: 0,
  type: 'diaria'
})

// Computed Lists
const pendingActivities = computed(() => activities.value.filter(a => a.status === 'pendiente'))
const inProgressActivities = computed(() => activities.value.filter(a => a.status === 'en_progreso'))
const completedActivities = computed(() => activities.value.filter(a => a.status === 'finalizada'))

// Chart Data Computed
const agentChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, background: 'transparent', foreColor: '#aaa' },
  plotOptions: { bar: { borderRadius: 4, horizontal: false } },
  xaxis: { categories: ['Julio', 'Juanpa', 'Roberto', 'Piero'] },
  colors: ['#3b82f6'],
  grid: { borderColor: '#333' }
}))

const agentSeries = computed(() => {
  const counts = { Julio: 0, Juanpa: 0, Roberto: 0, Piero: 0 }
  completedActivities.value.forEach(a => {
    if (counts[a.assigned_to as keyof typeof counts] !== undefined) {
      counts[a.assigned_to as keyof typeof counts]++
    }
  })
  return [{ name: 'Tareas Completadas', data: [counts.Julio, counts.Juanpa, counts.Roberto, counts.Piero] }]
})

const statusChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'donut', background: 'transparent', foreColor: '#aaa' },
  labels: ['Pendiente', 'En Progreso', 'Finalizada'],
  colors: ['#4b5563', '#3b82f6', '#10b981'],
  plotOptions: {
    pie: {
      donut: {
        size: '75%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600
          },
          value: {
            color: '#fff',
            fontSize: '20px',
            fontWeight: 700
          }
        }
      }
    }
  },
  dataLabels: { enabled: false },
  legend: { position: 'bottom', fontSize: '12px' },
  stroke: { show: false }, // No borders for smoother look
  tooltip: { theme: 'dark' }
}))

const statusSeries = computed(() => [
  pendingActivities.value.length,
  inProgressActivities.value.length,
  completedActivities.value.length
])

const bonusChartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar', toolbar: { show: false }, background: 'transparent', foreColor: '#aaa' },
  plotOptions: { bar: { borderRadius: 4, horizontal: true } },
  xaxis: { categories: ['Julio', 'Juanpa', 'Roberto', 'Piero'] },
  colors: ['#f59e0b'],
  grid: { borderColor: '#333' }
}))

const bonusSeries = computed(() => {
  const points = { Julio: 0, Juanpa: 0, Roberto: 0, Piero: 0 }
  activities.value.forEach(a => {
    // Count points for all tasks or just completed? Usually earned when completed.
    if (a.status === 'finalizada' && points[a.assigned_to as keyof typeof points] !== undefined) {
      points[a.assigned_to as keyof typeof points] += (a.bonus_points || 0)
    }
  })
  return [{ name: 'Puntos Bono', data: [points.Julio, points.Juanpa, points.Roberto, points.Piero] }]
})

// Functions
async function fetchActivities() {
  try {
    const { data, error } = await client
      .from('alef_activities')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching activities:', error)
      return
    }

    activities.value = data || []
  } catch (e) {
    console.error('Exception fetching activities:', e)
  }
}

function openActivityDialog(activity?: Activity) {
  if (activity) {
    editingActivity.value = activity
    activityFormData.value = {
      title: activity.title,
      description: activity.description || '',
      assigned_to: activity.assigned_to,
      start_date: activity.start_date ? activity.start_date.split('T')[0] : '',
      due_date: activity.due_date ? activity.due_date.split('T')[0] : '',
      status: activity.status || 'pendiente',
      priority: activity.priority as any || 'verde',
      bonus_points: activity.bonus_points || 0,
      type: activity.type as any || 'diaria'
    }
  } else {
    editingActivity.value = null
    activityFormData.value = {
      title: '',
      description: '',
      assigned_to: '',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'pendiente',
      priority: 'verde',
      bonus_points: 0,
      type: 'diaria'
    }
  }
  showActivityDialog.value = true
}

function closeActivityDialog() {
  showActivityDialog.value = false
  editingActivity.value = null
}

async function saveActivity() {
  if (!activityFormData.value.title || !activityFormData.value.assigned_to || !activityFormData.value.due_date) {
    alert('Por favor complete los campos requeridos (Título, Asignado a, Fecha Vencimiento)')
    return
  }

  const payload = {
    title: activityFormData.value.title,
    description: activityFormData.value.description,
    assigned_to: activityFormData.value.assigned_to,
    start_date: activityFormData.value.start_date,
    due_date: activityFormData.value.due_date,
    status: editingActivity.value ? editingActivity.value.status : 'pendiente', // Keep status on edit unless changed elsewhere
    priority: activityFormData.value.priority,
    bonus_points: activityFormData.value.bonus_points,
    type: activityFormData.value.type
  }

  try {
    if (editingActivity.value) {
      const { error } = await (client
        .from('alef_activities') as any)
        .update(payload)
        .eq('id', editingActivity.value.id)
      if (error) throw error
    } else {
      const { error } = await (client
        .from('alef_activities') as any)
        .insert(payload)
      if (error) throw error
    }
    await fetchActivities()
    closeActivityDialog()
  } catch (e) {
    console.error('Error saving activity:', e)
    alert('Error al guardar la actividad')
  }
}

async function updateActivityStatus(activity: Activity, newStatus: string) {
  try {
    const updates: any = { status: newStatus }
    if (newStatus === 'finalizada') {
      updates.completed_at = new Date().toISOString()
    }

    const { error } = await (client
      .from('alef_activities') as any)
      .update(updates)
      .eq('id', activity.id)

    if (error) throw error

    // Optimistic update
    const idx = activities.value.findIndex(a => a.id === activity.id)
    if (idx !== -1) {
      activities.value[idx].status = newStatus as any
      if (newStatus === 'finalizada') {
        activities.value[idx].completed_at = updates.completed_at
      }
    }
    await fetchActivities() // Sync just in case
  } catch (e) {
    console.error('Error updating status:', e)
  }
}

async function deleteActivity(id: string) {
  if (!confirm('¿Eliminar esta actividad?')) return
  try {
    const { error } = await (client.from('alef_activities') as any).delete().eq('id', id)
    if (error) throw error
    await fetchActivities()
    closeActivityDialog()
  } catch (e) {
    alert('Error al eliminar')
  }
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

// Add fetchActivities to onMounted
onMounted(() => {
  fetchActivities()
})

/* ══════════════════════════════════════════
   ALERTAS CRM
══════════════════════════════════════════ */
const alertasCRM = ref<any[]>([])
const loadingAlertas = ref(false)
const ultimaActualizacionAlertas = ref('—')
let alertasInterval: ReturnType<typeof setInterval> | null = null

const alertasCRMCount = computed(() => alertasCRM.value.length)

// Empresas cuyas carpetas están abiertas (todas abiertas por defecto)
const empresasAbiertas = ref<Set<string>>(new Set())

const toggleEmpresa = (name: string) => {
  if (empresasAbiertas.value.has(name)) {
    empresasAbiertas.value.delete(name)
  } else {
    empresasAbiertas.value.add(name)
  }
  // Forzar reactividad
  empresasAbiertas.value = new Set(empresasAbiertas.value)
}

// Agrupa y ordena alertas por empresa, más reciente primero dentro de cada grupo
const alertasPorEmpresa = computed(() => {
  const grupos: Record<string, any[]> = {}
  for (const alerta of alertasCRM.value) {
    const key = alerta.account_name
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(alerta)
  }
  // Dentro de cada grupo: más reciente primero (waiting_since mayor = esperando desde hace menos tiempo)
  for (const key in grupos) {
    grupos[key].sort((a, b) =>
      new Date(b.waiting_since).getTime() - new Date(a.waiting_since).getTime()
    )
  }
  // Ordenar grupos: más alertas primero
  return Object.entries(grupos)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, alertas]) => ({ name, alertas }))
})

const fetchAlertasCRM = async () => {
  loadingAlertas.value = true
  try {
    const { data, error } = await client
      .from('chatwoot_alerts')
      .select('*')
      .eq('is_active', true)
      .order('waiting_since', { ascending: true })
    if (!error && data) {
      alertasCRM.value = data
      // Abrir todas las carpetas por defecto
      empresasAbiertas.value = new Set(data.map((a: any) => a.account_name))
      const now = new Date()
      ultimaActualizacionAlertas.value = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    }
  } catch (e) {
    console.error('[AlertasCRM]', e)
  } finally {
    loadingAlertas.value = false
  }
}

// Cuánto tiempo lleva esperando en formato legible
const tiempoEsperando = (waitingSinceISO: string): string => {
  if (!waitingSinceISO) return '—'
  const ms = Date.now() - new Date(waitingSinceISO).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

// Clase de color según urgencia
const tiempoEsperandoClase = (waitingSinceISO: string): string => {
  if (!waitingSinceISO) return ''
  const mins = Math.floor((Date.now() - new Date(waitingSinceISO).getTime()) / 60000)
  if (mins >= 30) return 'tiempo-critico'
  if (mins >= 10) return 'tiempo-urgente'
  return 'tiempo-normal'
}

const dismissAlerta = async (id: number) => {
  // Optimistic UI: sacar de la lista inmediatamente
  alertasCRM.value = alertasCRM.value.filter((a: any) => a.id !== id)
  // Marcar como dismissed en Supabase para que el cron no la vuelva a traer
  await client.from('chatwoot_alerts' as any).update({ dismissed: true, is_active: false }).eq('id', id)
}

onMounted(() => {
  fetchAlertasCRM()
  // Auto-refresh cada 5 minutos
  alertasInterval = setInterval(fetchAlertasCRM, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (alertasInterval) clearInterval(alertasInterval)
})

/* ══════════════════════════════════════════════════════
   EQUIPO ALEF — Miembros hardcoded
══════════════════════════════════════════════════════ */
const equipoAlef = [
  { nombre: 'Juan Pablo', apellido: 'Jesús',    cargo: 'Técnico / Sistemas e Ingeniería',     color: '#daa520', inicial: 'JP' },
  { nombre: 'Carlos',     apellido: '',          cargo: 'Comercial / Administrativo y Tributario', color: '#3b82f6', inicial: 'CA' },
  { nombre: 'Piero',      apellido: 'Belmonte',  cargo: 'System Prompt & Publicidad',          color: '#8b5cf6', inicial: 'PB' },
  { nombre: 'Julio',      apellido: '',          cargo: 'Senior Prompt Engineer',              color: '#06b6d4', inicial: 'JU' },
  { nombre: 'Roberto',    apellido: '',          cargo: 'Dashboard & Infraestructura IA',      color: '#10b981', inicial: 'RO' },
]

/* ══════════════════════════════════════════════════════
   BRIEF DEL DÍA
══════════════════════════════════════════════════════ */
interface Brief {
  id: string
  fecha: string
  titulo: string
  contenido: string
  prioridades: string[]
  autor: string
  created_at: string
}

const briefs = ref<Brief[]>([])
const showBriefDialog = ref(false)
const showBriefDetalle = ref(false)
const briefSeleccionado = ref<Brief | null>(null)
const briefForm = reactive({ titulo: '', contenido: '', prioridades: [''] as string[], autor: '' })

const hoyISO = new Date().toISOString().slice(0, 10)
const briefHoy = computed(() => briefs.value.find(b => b.fecha === hoyISO) ?? null)
const briefsAnteriores = computed(() => briefs.value.filter(b => b.fecha !== hoyISO))

function resetBriefForm() {
  briefForm.titulo = ''; briefForm.contenido = ''; briefForm.prioridades = ['']; briefForm.autor = ''
}
function verBriefDetalle(b: Brief) { briefSeleccionado.value = b; showBriefDetalle.value = true }

async function fetchBriefs() {
  try {
    const { data } = await (client as any).from('alef_briefs').select('*').order('fecha', { ascending: false }).limit(20)
    briefs.value = data || []
  } catch (e) { console.error('Error briefs:', e) }
}

async function saveBrief() {
  const prioridades = briefForm.prioridades.filter(p => p.trim())
  const { error } = await (client as any).from('alef_briefs').insert({
    titulo: briefForm.titulo.trim(),
    contenido: briefForm.contenido.trim(),
    prioridades,
    autor: briefForm.autor,
    fecha: hoyISO,
  })
  if (!error) { showBriefDialog.value = false; await fetchBriefs() }
}

/* ══════════════════════════════════════════════════════
   REPORTES DIARIOS
══════════════════════════════════════════════════════ */
interface ReporteDiario {
  id: string
  fecha: string
  autor: string
  cargo: string
  logros: string
  pendientes: string
  blockers: string
}

const reportesDiarios = ref<ReporteDiario[]>([])
const reportesFecha = ref(hoyISO)
const showReporteDialog = ref(false)
const showReporteDetalle = ref(false)
const reporteSeleccionado = ref<ReporteDiario | null>(null)
const reporteForm = reactive({ autor: '', cargo: '', logros: '', pendientes: '', blockers: '' })

function getReporteDeHoy(nombreMiembro: string) {
  return reportesDiarios.value.find(r => r.fecha === reportesFecha.value && r.autor.startsWith(nombreMiembro)) ?? null
}

function abrirReporte(m: typeof equipoAlef[0]) {
  const nombre = `${m.nombre} ${m.apellido}`.trim()
  const existente = getReporteDeHoy(m.nombre)
  reporteForm.autor = nombre
  reporteForm.cargo = m.cargo
  reporteForm.logros = existente?.logros ?? ''
  reporteForm.pendientes = existente?.pendientes ?? ''
  reporteForm.blockers = existente?.blockers ?? ''
  showReporteDialog.value = true
}

function verReporteDetalle(r: ReporteDiario) { reporteSeleccionado.value = r; showReporteDetalle.value = true }

async function fetchReportes() {
  try {
    const { data } = await (client as any)
      .from('alef_reportes_diarios')
      .select('*')
      .eq('fecha', reportesFecha.value)
      .order('created_at', { ascending: false })
    reportesDiarios.value = data || []
  } catch (e) { console.error('Error reportes:', e) }
}

async function saveReporte() {
  const payload = {
    fecha: reportesFecha.value,
    autor: reporteForm.autor,
    cargo: reporteForm.cargo,
    logros: reporteForm.logros.trim(),
    pendientes: reporteForm.pendientes.trim(),
    blockers: reporteForm.blockers.trim(),
    updated_at: new Date().toISOString(),
  }
  // Upsert por (fecha, autor)
  const { error } = await (client as any)
    .from('alef_reportes_diarios')
    .upsert(payload, { onConflict: 'fecha,autor' })
  if (!error) { showReporteDialog.value = false; await fetchReportes() }
}

/* ══════════════════════════════════════════════════════
   REPORTES DE EMPRESAS (todas las clínicas/companies)
══════════════════════════════════════════════════════ */
const reportesTab = ref<'equipo' | 'empresas'>('equipo')
const reportesEmpresas = ref<any[]>([])
const loadingReportesEmpresas = ref(false)
const showReporteEmpresaDlg = ref(false)
const reporteEmpresaSeleccionado = ref<any>(null)

const todasEmpresas = [
  { id: 'Heal up', nombre: 'Healup' },
  { id: 'Brada', nombre: 'Brada Perfumes' },
  { id: 'Alegrated', nombre: 'Alegrated' },
  { id: 'Clinica Arroyo', nombre: 'Clínica Arroyo' },
  { id: 'EstasConSuerte', nombre: 'Estás Con Suerte' },
  { id: 'Estetika Medika', nombre: 'Estetika Medika' },
  { id: 'Davila', nombre: 'Miguel Davila' },
  { id: 'Origitec', nombre: 'Origitec' },
  { id: 'SKIP', nombre: 'SKIP' },
  { id: 'solari', nombre: 'Solari' },
]

function getReporteEmpresaHoy(empresaId: string) {
  return reportesEmpresas.value.find(r => r.empresa_id === empresaId && r.fecha === reportesFecha.value) ?? null
}

function verReporteEmpresa(r: any) {
  reporteEmpresaSeleccionado.value = r
  showReporteEmpresaDlg.value = true
}

async function fetchReportesEmpresas() {
  loadingReportesEmpresas.value = true
  try {
    const { data } = await (client as any)
      .from('alef_reportes_empresa')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100)
    reportesEmpresas.value = data || []
  } catch (e) { console.error('Error reportes empresas:', e) }
  loadingReportesEmpresas.value = false
}
</script>

<style scoped>
/* Activities Charts */
.charts-row {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.chart-card {
  flex: 1;
  min-width: 300px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
}

.chart-card h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #fff;
  opacity: 0.9;
}

/* Kanban Board */
.kanban-board {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  align-items: flex-start;
  min-height: 500px;
}

.kanban-column {
  flex: 1;
  min-width: 320px;
  max-width: 400px;
  background: rgba(20, 20, 20, 0.6);
  border-radius: 16px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.column-header h3 {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.kanban-column.pending .column-header h3 {
  color: #9ca3af;
}

.kanban-column.progress .column-header h3 {
  color: #3b82f6;
}

.kanban-column.done .column-header h3 {
  color: #10b981;
}

.count {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.kanban-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 700px;
  padding-right: 4px;
}

/* Scrollbar for kanban list */
.kanban-list::-webkit-scrollbar {
  width: 4px;
}

.kanban-list::-webkit-scrollbar-track {
  background: transparent;
}

.kanban-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.kanban-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  border-left: 4px solid transparent;
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.06);
}

.kanban-card.priority-rojo {
  border-left-color: #ef4444;
}

.kanban-card.priority-amarillo {
  border-left-color: #f59e0b;
}

.kanban-card.priority-verde {
  border-left-color: #10b981;
}

.kanban-card.done-card {
  opacity: 0.7;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.task-type {
  font-size: 0.7rem;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  color: #ccc;
}

.task-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #fff;
  line-height: 1.3;
}

.task-desc {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #bbb;
  margin-bottom: 0.8rem;
}

.assigned-to,
.bonus-points {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-dates {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 1rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
}

.task-dates span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  width: 100%;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ddd;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.start-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border-color: #3b82f6;
}

.finish-btn:hover {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border-color: #10b981;
}

.task-actions-row {
  display: flex;
  gap: 0.5rem;
}

.back-btn {
  width: 32px;
  flex: 0 0 auto;
}

/* ══ Alertas CRM ══ */
.nav-badge {
  margin-left: auto;
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 99px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.alertas-badge-header {
  background: #ef4444;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 99px;
}

.alertas-empty {
  text-align: center;
  padding: 4rem 2rem;
  opacity: 0.5;
}
.alertas-empty-title {
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--card-foreground);
}
.alertas-empty-sub {
  font-size: 0.85rem;
  margin-top: 0.25rem;
  color: var(--card-foreground);
}

.alertas-footer {
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.45;
  margin-top: 1.5rem;
  color: var(--card-foreground);
}

/* Carpetas por empresa */
.alertas-empresas {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empresa-folder {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--card);
}

.empresa-folder-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--card-foreground);
  transition: background 0.15s;
}
.empresa-folder-header:hover {
  background: rgba(218, 165, 32, 0.07);
}

.empresa-folder-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--card-foreground);
}

.empresa-folder-count {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 99px;
}

/* Filas de alertas */
.empresa-alertas {
  border-top: 1px solid var(--border);
}

.alerta-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: var(--card-foreground);
  transition: background 0.12s;
  cursor: pointer;
}
.alerta-row:last-child { border-bottom: none; }
.alerta-row:hover { background: rgba(99, 102, 241, 0.06); }

.alerta-row-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alerta-row-info {
  flex: 1;
  min-width: 0;
}
.alerta-row-nombre {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--card-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.alerta-row-meta {
  font-size: 0.75rem;
  opacity: 0.5;
  color: var(--card-foreground);
  margin-top: 1px;
}

.alerta-row-tiempo {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 5px;
  padding: 2px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}

.tiempo-normal  { background: rgba(234,179,8,0.15);  color: #ca8a04; }
.tiempo-urgente { background: rgba(249,115,22,0.15); color: #ea580c; }
.tiempo-critico { background: rgba(239,68,68,0.15);  color: #dc2626; }

.alerta-dismiss-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--card-foreground);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.4;
  flex-shrink: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}
.alerta-row:hover .alerta-dismiss-btn { opacity: 1; }
.alerta-dismiss-btn:hover {
  background: rgba(34,197,94,0.15);
  color: #16a34a;
  border-color: #16a34a;
  opacity: 1;
}

/* ── GALERIA DE EMPRESAS ───────────────────────────────── */
.alef-companies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.alef-company-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}
.alef-company-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

.alef-co-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.alef-co-status {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
}
.alef-co-status.active { background: rgba(34,197,94,0.15); color: #16a34a; }
.alef-co-status.loading { background: rgba(234,179,8,0.15); color: #ca8a04; }

.alef-co-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.alef-co-metric {
  text-align: center;
  padding: 0.4rem 0;
  background: var(--sidebar);
  border-radius: 8px;
}
.alef-co-metric-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--foreground);
}
.alef-co-metric-label {
  font-size: 0.65rem;
  color: var(--muted-foreground);
  margin-top: 2px;
}

.alef-co-temps {
  margin-bottom: 0.5rem;
}
.alef-co-temp-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--sidebar);
  display: flex;
  overflow: hidden;
  margin-bottom: 4px;
}
.alef-co-temp-fill {
  height: 100%;
  transition: width 0.3s;
}
.alef-co-temp-fill.caliente { background: #ef4444; }
.alef-co-temp-fill.tibio { background: #f59e0b; }
.alef-co-temp-fill.frio { background: #3b82f6; }

.alef-co-temp-legend {
  display: flex;
  gap: 0.75rem;
  font-size: 0.68rem;
  font-weight: 500;
}

.alef-co-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

/* ── BRIEF CARDS ───────────────────────────────────── */
.brief-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.brief-card:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.brief-card--hoy {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.1);
}

.rep-tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.rep-tab-btn:hover { color: var(--foreground); }
.rep-tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }

.form-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
