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
          <button v-for="item in menuItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
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
      <div v-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <h1>Dashboard</h1>
          <button class="btn-primary" @click="fetchContribuyentes">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Refresh Data</span>
          </button>
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
                <h2>Total Visitors</h2>
                <div class="chart-subtitle">Total for the last 3 months</div>
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
                <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
              </button>
              <div class="spacer" />
              <button class="tab-action">
                <v-icon icon="mdi-view-column" size="16" />
                Customize Columns
              </button>
              <button class="tab-action primary" @click="fetchContribuyentes">
                <v-icon icon="mdi-plus" size="16" />
                Add Section
              </button>
            </div>
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Pacientes</span>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text" color="success" class="me-1" @click="downloadExcel(contribuyentes, headers, 'alef-pacientes')">
                  <v-icon>mdi-file-excel</v-icon>
                  <v-tooltip activator="parent" location="top">Descargar Excel</v-tooltip>
                </v-btn>
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Search" single-line hide-details
                  density="compact" variant="outlined" class="search-field"></v-text-field>
              </v-card-title>
              <v-data-table :headers="headers" :items="contribuyentes" :search="search" :loading="loading"
                :items-per-page="10" class="elevation-0" loading-text="Cargando datos de Supabase..."
                no-data-text="No hay datos disponibles">
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

      <!-- ==========  VISTA: SETTINGS  ========== -->
      <SettingsView v-else-if="activeView === 'settings'" company-id="Alef" :current-user-role="currentUser?.role" />

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
  handleZoom('one_month')
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
  { icon: 'mdi-message-reply', label: 'Conversaciones', id: 'conversaciones' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' }
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

/* ---------------- Stats ---------------- */
const stats: Stat[] = [
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

/* ---------------- Tabs ---------------- */
const tabs: Tab[] = [
  { label: 'Outline', value: 'outline' },
  { label: 'Past Performance', value: 'performance', badge: '3' },
  { label: 'Key Personnel', value: 'personnel', badge: '2' },
  { label: 'Focus Documents', value: 'focus' }
]

/* ---------------- ApexCharts Data ---------------- */
const fullData: [number, number][] = [
  [1358982000000, 38.10],
  [1359068400000, 38.32],
  [1359327600000, 38.24],
  [1359414000000, 38.52],
  [1359500400000, 37.94],
  [1359586800000, 37.83],
  [1359673200000, 38.34],
  [1359932400000, 38.10],
  [1360018800000, 38.51],
  [1360105200000, 38.40],
  [1360191600000, 38.07],
  [1360278000000, 39.12],
  [1360537200000, 38.64],
  [1360623600000, 38.89],
  [1360710000000, 38.81],
  [1360796400000, 38.61],
  [1360882800000, 38.63],
  [1361228400000, 38.99],
  [1361314800000, 38.77],
  [1361401200000, 38.34],
  [1361487600000, 38.55],
  [1361746800000, 38.11],
  [1361833200000, 38.59],
  [1361919600000, 39.60]]

const ranges: Record<string, [number, number]> = {
  one_month: [Date.UTC(2013, 1, 1), Date.UTC(2013, 1, 27)],
  six_months: [Date.UTC(2012, 8, 27), Date.UTC(2013, 1, 27)],
  one_year: [Date.UTC(2012, 1, 27), Date.UTC(2013, 1, 27)],
  ytd: [Date.UTC(2013, 0, 1), Date.UTC(2013, 1, 27)],
  all: [fullData[0][0], fullData.at(-1)![0]]
}

const series = ref([{ name: 'Visitors', data: fullData }])
const chartEl = ref<any>(null)

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    id: 'area-datetime',
    type: 'area',
    zoom: { autoScaleYaxis: true },
    background: 'transparent',
    foreColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--foreground')
      .trim()
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

const activeZoom = ref<keyof typeof ranges>('one_month')

function handleZoom(btnId: keyof typeof ranges) {
  activeZoom.value = btnId
  const [start, end] = ranges[btnId]
  series.value[0].data = fullData.filter(([ts]) => ts >= start && ts <= end)
  nextTick(() => chartEl.value?.zoomX(start, end))
}

const zoomButtons = [
  { id: 'one_month', label: '1M' },
  { id: 'six_months', label: '6M' },
  { id: 'one_year', label: '1Y' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'ALL' }
]

/* ---------------- Calendar Types & Interfaces ---------------- */
const client = useSupabaseClient()

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
        .from('alef_calendar_events') as any)
        .update(payload)
        .eq('id', editingEvent.value.id)

      if (error) throw error
    } else {
      // Create
      const { error } = await (client
        .from('alef_calendar_events') as any)
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
      .from('alef_calendar_events')
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

function getProcedureColor(procedureId: string): string {
  const procedure = procedures.value.find(p => p.id === procedureId)
  return procedure ? procedure.color : '#3b82f6'
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
    const { data, error } = await client
      .from('alef_calendar_events')
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
      eventReason: e.event_reason
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
</style>
