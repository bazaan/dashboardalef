<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ========== SIDEBAR ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
            <v-img src="@/assets/img/gatwickLOGO.png" alt="Gatwick Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Gatwick</span>
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
          <span v-else class="logo-text">Gatwick</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Inicio</div>
          <button v-for="item in menuItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="handleNavigation(item)">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">CHATS</div>
          <button v-for="item in chatItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="handleNavigation(item)">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">EMERGENCIAS</div>
          <button v-for="item in emergenciasItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'emergencias' && emergenciasActivas > 0" class="nav-badge-red">
              {{ emergenciasActivas }}
            </span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">OPERACIONES</div>
          <button v-for="item in operacionesItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">FINANZAS</div>
          <button v-for="item in financiasItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">REPORTES</div>
          <button v-for="item in reportesItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
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
            <v-list-item class="user-header">
              <template #prepend>
                <v-avatar size="32"><v-img src="@/assets/img/user777.png" alt="You" /></v-avatar>
              </template>
              <v-list-item-title>{{ currentUser.full_name }}</v-list-item-title>
              <v-list-item-subtitle>{{ currentUser.email }}</v-list-item-subtitle>
            </v-list-item>
            <v-divider />
            <v-list-item @click="logout" prepend-icon="mdi-logout">
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </aside>

    <!-- ========== MAIN CONTENT ========== -->
    <div class="main-content">

      <!-- ========== VISTA: SETTINGS ========== -->
      <SettingsView v-if="activeView === 'settings'" company-id="Gatwick" :current-user-role="currentUser?.role" />

      <!-- ========== VISTA: FACTURACIÓN ========== -->
      <div v-else-if="activeView === 'facturacion'" class="view-container">
        <header class="top-header"><h1>Facturación Electrónica</h1></header>
        <div class="content-area">
          <FacturacionPSE company-id="gatwick" />
        </div>
      </div>

      <!-- ========== VISTA: DASHBOARD ========== -->
      <div v-else-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <h1>Dashboard</h1>
          <div style="display: flex; gap: 10px; align-items: center;">
            <div class="realtime-indicator">
              <span class="realtime-dot"></span>
              En vivo
            </div>
            <button class="btn-primary" @click="refreshAll">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <div class="content-area">
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

          <!-- Chart -->
          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Leads & Clientes</h2>
                <div class="chart-subtitle">Evolución de prospectos</div>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="area" height="320" :options="chartOptions" :series="series" />
              </client-only>
            </div>
          </div>

          <!-- Emergencias recientes en dashboard -->
          <div class="table-section">
            <div class="table-tabs">
              <button :class="['tab', { active: activeTab === 'clientes_dashboard' }]" @click="activeTab = 'clientes_dashboard'">Clientes Recientes</button>
              <button :class="['tab', { active: activeTab === 'leads_tab' }]" @click="activeTab = 'leads_tab'">Leads</button>
              <button :class="['tab', { active: activeTab === 'emerg_tab' }]" @click="activeTab = 'emerg_tab'">Emergencias</button>
            </div>
            <v-card flat class="custom-data-table">

              <div v-if="activeTab === 'clientes_dashboard'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Últimos 10 Clientes</span>
                </v-card-title>
                <v-data-table :headers="headersClientesWpp" :items="clientesWpp.slice(0,10)" class="elevation-0"
                  no-data-text="No hay clientes recientes" :items-per-page="10">
                  <template v-slot:item.lead_status="{ item }">
                    <v-chip
                      :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                      size="small">
                      {{ item.lead_status || '—' }}
                    </v-chip>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <div v-if="activeTab === 'leads_tab'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Leads Recientes</span>
                </v-card-title>
                <v-data-table :headers="headersLeads" :items="leadsWpp.slice(0,10)" class="elevation-0"
                  no-data-text="No hay leads recientes" :items-per-page="10">
                  <template v-slot:item.lead_status="{ item }">
                    <v-chip
                      :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                      size="small">
                      {{ item.lead_status || '—' }}
                    </v-chip>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <div v-if="activeTab === 'emerg_tab'">
                <v-card-title class="table-search-bar">
                  <span class="table-title">Emergencias Activas</span>
                </v-card-title>
                <v-data-table :headers="headersEmergencias" :items="emergencias.filter(e => e.estado !== 'resuelta').slice(0,10)"
                  class="elevation-0" no-data-text="Sin emergencias activas" :items-per-page="10">
                  <template v-slot:item.prioridad="{ item }">
                    <v-chip :color="prioridadColor(item.prioridad)" size="small">{{ item.prioridad }}</v-chip>
                  </template>
                  <template v-slot:item.estado="{ item }">
                    <span :class="['estado-chip', 'estado-' + item.estado]">{{ item.estado }}</span>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ========== VISTA: CALENDARIO ========== -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Calendario de Servicios</h1>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" @click="openCreateEventDialog()">
              <v-icon icon="mdi-calendar-plus" size="16" />
              <span>Nueva Cita</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px;">
            <button class="btn-secondary" @click="prevMonth">
              <v-icon icon="mdi-chevron-left" size="18" />
            </button>
            <h2 style="margin: 0; font-size: 1.1rem;">
              {{ monthNamesEs[currentMonth] }} {{ currentYear }}
            </h2>
            <button class="btn-secondary" @click="nextMonth">
              <v-icon icon="mdi-chevron-right" size="18" />
            </button>
          </div>

          <div class="calendar-grid">
            <div class="calendar-weekdays">
              <div v-for="day in weekDays" :key="day" class="weekday-label">{{ day }}</div>
            </div>
            <div class="calendar-days">
              <div v-for="(day, idx) in calendarDays" :key="idx"
                :class="['calendar-day', { 'other-month': !day.isCurrentMonth, 'today': day.isToday, 'has-events': day.events.length > 0 }]"
                @click="day.isCurrentMonth && openCreateEventDialog(day.dateStr)">
                <div class="day-header-row">
                  <span class="day-number">{{ day.day }}</span>
                </div>
                <div v-if="day.events.length > 0" class="event-list-in-day">
                  <div v-for="ev in day.events.slice(0, 2)" :key="ev.id" class="event-line"
                    style="background: rgba(244,98,58,0.75);">
                    <span class="event-line-text">{{ ev.time }} {{ ev.clientName }}</span>
                  </div>
                  <span v-if="day.events.length > 2" class="more-events">+{{ day.events.length - 2 }} más</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Próximas citas -->
          <div class="upcoming-events" style="margin-top: 0;">
            <h3>Próximas Citas</h3>
            <div v-if="upcomingEvents.length === 0" style="text-align:center; padding: 24px; color: var(--text-secondary);">
              <v-icon icon="mdi-calendar-blank" size="36" />
              <p style="margin-top: 8px;">Sin citas próximas</p>
            </div>
            <div v-else class="event-list">
              <div v-for="ev in upcomingEvents" :key="ev.id" class="event-item"
                @click="editarEvento(ev)" style="cursor: pointer;">
                <div class="event-color-bar" style="background: #F4623A;"></div>
                <div class="event-info">
                  <div class="event-title">{{ ev.clientName }} {{ ev.clientSurname }}</div>
                  <div class="event-meta">
                    <v-icon icon="mdi-clock-outline" size="14" />
                    {{ ev.date }} — {{ ev.time }}
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-1">
                      {{ ev.empresa || 'Sin empresa' }}
                    </v-chip>
                  </div>
                  <div v-if="ev.descripcion" style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                    {{ ev.descripcion }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog: Crear/Editar Evento -->
        <v-dialog v-model="showEventDialog" max-width="520" persistent>
          <v-card>
            <v-card-title>{{ editingEvent ? 'Editar Cita' : 'Nueva Cita de Servicio' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.fecha" label="Fecha (YYYY-MM-DD)" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.hora" label="Hora (HH:MM)" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.client_name" label="Nombre" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.client_surname" label="Apellido" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.client_phone" label="Teléfono" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.client_email" label="Email" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="eventForm.empresa" label="Empresa / Cliente" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.ruc" label="RUC" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.direccion" label="Dirección del servicio" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="eventForm.tipo_equipo" label="Tipo de equipo" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="eventForm.estado" :items="['pendiente','confirmada','en_curso','completada','cancelada']"
                    label="Estado" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="eventForm.descripcion" label="Descripción / Problema" rows="2" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showEventDialog = false">Cancelar</v-btn>
              <v-btn v-if="editingEvent" color="error" text @click="deleteEvent">Eliminar</v-btn>
              <v-btn color="primary" @click="saveEvent" :loading="savingEvent">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: CLIENTES ========== -->
      <div v-else-if="activeView === 'clientes'" class="view-container">
        <header class="top-header">
          <h1>Clientes</h1>
          <button class="btn-primary" @click="() => { fetchClientesWpp(); fetchClientesFbIg(); }">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>
        <div class="content-area">
          <div class="table-section">
            <div class="table-tabs">
              <button :class="['tab', { active: clientesTab === 'wpp' }]" @click="clientesTab = 'wpp'">
                WhatsApp ({{ clientesWpp.length }})
              </button>
              <button :class="['tab', { active: clientesTab === 'fbig' }]" @click="clientesTab = 'fbig'">
                FB / IG ({{ clientesFbIg.length }})
              </button>
            </div>
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">
                  {{ clientesTab === 'wpp' ? 'Clientes WhatsApp' : 'Clientes Facebook / Instagram' }}
                </span>
                <v-spacer />
                <v-text-field v-model="searchClientes" prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar..." density="compact" hide-details style="max-width: 220px;" />
              </v-card-title>
              <v-data-table
                :headers="clientesTab === 'wpp' ? headersClientesWpp : headersClientesFbIg"
                :items="clientesTab === 'wpp' ? clientesWppFiltrados : clientesFbIgFiltrados"
                class="elevation-0" no-data-text="No hay clientes" :items-per-page="20">
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status || '—' }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ========== VISTA: LEADS ========== -->
      <div v-else-if="activeView === 'leads'" class="view-container">
        <header class="top-header">
          <h1>Leads</h1>
          <button class="btn-primary" @click="() => { fetchLeadsWpp(); fetchLeadsFbIg(); }">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>
        <div class="content-area">
          <div class="table-section">
            <div class="table-tabs">
              <button :class="['tab', { active: leadsTab === 'wpp' }]" @click="leadsTab = 'wpp'">
                WhatsApp ({{ leadsWpp.length }})
              </button>
              <button :class="['tab', { active: leadsTab === 'fbig' }]" @click="leadsTab = 'fbig'">
                FB / IG ({{ leadsFbIg.length }})
              </button>
            </div>
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">{{ leadsTab === 'wpp' ? 'Leads WhatsApp' : 'Leads Facebook / Instagram' }}</span>
                <v-spacer />
                <v-text-field v-model="searchLeads" prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar..." density="compact" hide-details style="max-width: 220px;" />
              </v-card-title>
              <v-data-table
                :headers="leadsTab === 'wpp' ? headersLeads : headersLeadsFbIg"
                :items="leadsTab === 'wpp' ? leadsWppFiltrados : leadsFbIgFiltrados"
                class="elevation-0" no-data-text="No hay leads" :items-per-page="20">
                <template v-slot:item.lead_status="{ item }">
                  <v-chip
                    :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibio') ? 'warning' : 'info'"
                    size="small">
                    {{ item.lead_status || '—' }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ========== VISTA: EMERGENCIAS ========== -->
      <div v-else-if="activeView === 'emergencias'" class="view-container">
        <header class="top-header">
          <h1>Monitor de Emergencias</h1>
          <div style="display: flex; gap: 10px; align-items: center;">
            <div class="realtime-indicator">
              <span class="realtime-dot"></span>
              Tiempo real
            </div>
            <button class="btn-primary" @click="showNuevaEmergencia = true">
              <v-icon icon="mdi-alert-plus" size="16" />
              <span>Nueva Emergencia</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <!-- Filtros de estado -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
            <button v-for="f in ['todas','pendiente','asignada','en_curso','resuelta']" :key="f"
              :class="['btn-secondary', { 'btn-primary': filtroEmerg === f }]"
              @click="filtroEmerg = f" style="text-transform: capitalize;">
              {{ f }}
              <span v-if="f !== 'todas'" style="margin-left: 4px; opacity: 0.7;">
                ({{ emergencias.filter(e => e.estado === f).length }})
              </span>
            </button>
          </div>

          <div v-if="loadingEmergencias" style="text-align: center; padding: 40px;">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <div v-else-if="emergenciasFiltradas.length === 0" style="text-align: center; padding: 60px; color: var(--text-secondary);">
            <v-icon icon="mdi-check-circle-outline" size="48" style="margin-bottom: 12px; display: block;" />
            Sin emergencias {{ filtroEmerg !== 'todas' ? 'en estado ' + filtroEmerg : '' }}
          </div>
          <div v-else class="emergencias-grid">
            <div v-for="emerg in emergenciasFiltradas" :key="emerg.id"
              :class="['emergencia-card', 'prioridad-' + emerg.prioridad]">
              <div class="emerg-header">
                <v-icon icon="mdi-alert-circle" size="16" />
                {{ emerg.prioridad?.toUpperCase() }} — #{{ emerg.id }}
              </div>
              <div class="emerg-body">
                <div style="font-weight: 600; font-size: 0.92rem; margin-bottom: 6px;">{{ emerg.titulo }}</div>
                <div class="emerg-info">
                  <v-icon icon="mdi-domain" size="14" style="margin-top: 2px; flex-shrink: 0;" />
                  {{ emerg.empresa_cliente || '—' }}
                </div>
                <div class="emerg-info">
                  <v-icon icon="mdi-map-marker" size="14" style="margin-top: 2px; flex-shrink: 0;" />
                  {{ emerg.direccion || '—' }}
                </div>
                <div class="emerg-info">
                  <v-icon icon="mdi-elevator" size="14" style="margin-top: 2px; flex-shrink: 0;" />
                  {{ emerg.tipo_equipo || 'Ascensor' }} {{ emerg.numero_equipo ? '· ' + emerg.numero_equipo : '' }}
                </div>
                <div v-if="emerg.descripcion" class="emerg-desc">{{ emerg.descripcion }}</div>
                <div class="emerg-time">{{ formatDateTime(emerg.created_at) }}</div>
              </div>
              <div class="emerg-footer">
                <span :class="['estado-chip', 'estado-' + emerg.estado]">{{ emerg.estado }}</span>
                <div class="emerg-actions">
                  <v-btn icon size="x-small" variant="text" @click="editarEmergencia(emerg)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </v-btn>
                  <v-btn v-if="emerg.estado !== 'resuelta'" icon size="x-small" variant="text" color="success"
                    @click="marcarResuelta(emerg)">
                    <v-icon icon="mdi-check" size="16" />
                  </v-btn>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog: Nueva / Editar Emergencia -->
        <v-dialog v-model="showNuevaEmergencia" max-width="560" persistent>
          <v-card>
            <v-card-title>{{ editingEmerg ? 'Editar Emergencia' : 'Nueva Emergencia' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field v-model="emergForm.titulo" label="Título de la emergencia" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="emergForm.prioridad" :items="['critica','alta','media','baja']"
                    label="Prioridad" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="emergForm.estado" :items="['pendiente','asignada','en_curso','resuelta']"
                    label="Estado" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="emergForm.empresa_cliente" label="Empresa / Cliente" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="emergForm.ruc_cliente" label="RUC" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="emergForm.telefono_contacto" label="Teléfono contacto" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="emergForm.direccion" label="Dirección" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="emergForm.tipo_equipo" label="Tipo de equipo" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="emergForm.numero_equipo" label="N° equipo" density="compact" />
                </v-col>
                <v-col cols="4">
                  <v-text-field v-model="emergForm.piso" label="Piso / Nivel" density="compact" />
                </v-col>
                <v-col cols="8">
                  <v-select v-model="emergForm.tecnico_id" :items="tecnicoItems"
                    item-title="label" item-value="id" label="Asignar técnico" density="compact" clearable />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="emergForm.notas" label="Descripción / Notas" rows="2" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showNuevaEmergencia = false">Cancelar</v-btn>
              <v-btn color="primary" @click="saveEmergencia" :loading="savingEmerg">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: TÉCNICOS ========== -->
      <div v-else-if="activeView === 'tecnicos'" class="view-container">
        <header class="top-header">
          <h1>Gestión de Técnicos</h1>
          <button class="btn-primary" @click="openNuevoTecnico">
            <v-icon icon="mdi-account-plus" size="16" />
            <span>Nuevo Técnico</span>
          </button>
        </header>
        <div class="content-area">
          <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="stat-card">
              <div class="stat-title">Disponibles</div>
              <div class="stat-value" style="color: #81c784;">{{ tecnicos.filter(t => t.estado === 'disponible').length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">En Servicio</div>
              <div class="stat-value" style="color: #64b5f6;">{{ tecnicos.filter(t => t.estado === 'en_servicio').length }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Fuera de Servicio</div>
              <div class="stat-value" style="color: rgba(255,255,255,0.3);">{{ tecnicos.filter(t => t.estado === 'fuera_servicio').length }}</div>
            </div>
          </div>

          <div class="tecnicos-grid" style="margin-top: 20px;">
            <div v-for="tec in tecnicos" :key="tec.id" class="tecnico-card">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="tecnico-avatar">
                  <v-icon icon="mdi-account-hard-hat" size="22" />
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 0.95rem;">{{ tec.nombre }} {{ tec.apellido }}</div>
                  <div :class="['tecnico-estado-' + tec.estado, 'font-size: 0.78rem']" style="font-size: 0.78rem; font-weight: 600; text-transform: capitalize;">
                    ● {{ tec.estado?.replace('_', ' ') }}
                  </div>
                </div>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                <span v-if="tec.zona"><v-icon icon="mdi-map-marker" size="13" /> {{ tec.zona }}</span>
                <span v-if="tec.especialidad"><v-icon icon="mdi-wrench" size="13" /> {{ tec.especialidad }}</span>
                <span v-if="tec.telefono"><v-icon icon="mdi-phone" size="13" /> {{ tec.telefono }}</span>
              </div>
              <div style="display: flex; gap: 6px; justify-content: flex-end;">
                <v-btn size="x-small" variant="tonal" @click="editarTecnico(tec)">Editar</v-btn>
                <v-btn size="x-small" variant="tonal"
                  :color="tec.estado === 'disponible' ? 'primary' : 'success'"
                  @click="toggleEstadoTecnico(tec)">
                  {{ tec.estado === 'disponible' ? 'Poner en servicio' : 'Marcar disponible' }}
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- Dialog: Nuevo/Editar Técnico -->
        <v-dialog v-model="showTecnicoDialog" max-width="480" persistent>
          <v-card>
            <v-card-title>{{ editingTecnico ? 'Editar Técnico' : 'Nuevo Técnico' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6">
                  <v-text-field v-model="tecnicoForm.nombre" label="Nombre" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="tecnicoForm.apellido" label="Apellido" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="tecnicoForm.telefono" label="Teléfono" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="tecnicoForm.email" label="Email" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="tecnicoForm.zona" label="Zona" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="tecnicoForm.estado" :items="['disponible','en_servicio','fuera_servicio']"
                    label="Estado" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="tecnicoForm.especialidad" label="Especialidad" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showTecnicoDialog = false">Cancelar</v-btn>
              <v-btn color="primary" @click="saveTecnico" :loading="savingTecnico">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: INTERVENCIONES ========== -->
      <div v-else-if="activeView === 'intervenciones'" class="view-container">
        <header class="top-header">
          <h1>Historial de Intervenciones</h1>
          <button class="btn-primary" @click="showNuevaIntervencion = true">
            <v-icon icon="mdi-plus" size="16" />
            <span>Nueva Intervención</span>
          </button>
        </header>
        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Intervenciones</span>
                <v-spacer />
                <v-text-field v-model="searchInterv" prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar..." density="compact" hide-details style="max-width: 220px;" />
              </v-card-title>
              <v-data-table :headers="headersIntervenciones" :items="intervencionesFiltradas"
                class="elevation-0" no-data-text="Sin intervenciones registradas" :items-per-page="20">
                <template v-slot:item.tipo_intervencion="{ item }">
                  <span class="intervencion-tipo-chip">{{ item.tipo_intervencion }}</span>
                </template>
                <template v-slot:item.estado="{ item }">
                  <v-chip :color="item.estado === 'completada' ? 'success' : item.estado === 'cancelada' ? 'error' : 'warning'" size="small">
                    {{ item.estado }}
                  </v-chip>
                </template>
                <template v-slot:item.costo_total="{ item }">
                  S/ {{ Number(item.costo_total || 0).toFixed(2) }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <v-btn icon size="x-small" variant="text" @click="editarIntervencion(item)">
                    <v-icon icon="mdi-pencil" size="16" />
                  </v-btn>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog: Nueva/Editar Intervención -->
        <v-dialog v-model="showNuevaIntervencion" max-width="600" persistent>
          <v-card>
            <v-card-title>{{ editingInterv ? 'Editar Intervención' : 'Nueva Intervención' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field v-model="intervForm.empresa_cliente" label="Empresa / Cliente" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.ruc_cliente" label="RUC" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.direccion" label="Dirección" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.tipo_equipo" label="Tipo equipo" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.numero_equipo" label="N° equipo" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="intervForm.tipo_intervencion"
                    :items="['mantenimiento','reparacion','emergencia','instalacion','inspeccion']"
                    label="Tipo" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="intervForm.tecnico_id" :items="tecnicoItems"
                    item-title="label" item-value="id" label="Técnico" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.fecha_inicio" label="Fecha inicio" type="datetime-local" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="intervForm.fecha_fin" label="Fecha fin" type="datetime-local" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="intervForm.descripcion" label="Descripción del trabajo" rows="2" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="intervForm.diagnostico" label="Diagnóstico" rows="2" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-textarea v-model="intervForm.solucion" label="Solución aplicada" rows="2" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="intervForm.repuestos_usados" label="Repuestos utilizados" density="compact" />
                </v-col>
                <v-col cols="4">
                  <v-text-field v-model.number="intervForm.costo_mano_obra" label="Mano de obra (S/)" type="number" density="compact" />
                </v-col>
                <v-col cols="4">
                  <v-text-field v-model.number="intervForm.costo_repuestos" label="Repuestos (S/)" type="number" density="compact" />
                </v-col>
                <v-col cols="4">
                  <v-text-field :model-value="(Number(intervForm.costo_mano_obra || 0) + Number(intervForm.costo_repuestos || 0)).toFixed(2)"
                    label="Total (S/)" readonly density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="intervForm.estado" :items="['en_proceso','completada','cancelada']"
                    label="Estado" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showNuevaIntervencion = false">Cancelar</v-btn>
              <v-btn color="primary" @click="saveIntervencion" :loading="savingInterv">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: COBRANZAS ========== -->
      <div v-else-if="activeView === 'cobranzas'" class="view-container">
        <header class="top-header">
          <h1>Cobranzas</h1>
          <button class="btn-primary" @click="showNuevaCobranza = true">
            <v-icon icon="mdi-plus" size="16" />
            <span>Nueva Cobranza</span>
          </button>
        </header>
        <div class="content-area">
          <!-- Resumen cobros -->
          <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
            <div class="stat-card">
              <div class="stat-title">Pendientes</div>
              <div class="stat-value cobro-pendiente">
                S/ {{ cobranzas.filter(c => c.estado_pago === 'pendiente').reduce((s, c) => s + Number(c.monto || 0), 0).toFixed(0) }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Cobradas</div>
              <div class="stat-value cobro-pagado">
                S/ {{ cobranzas.filter(c => c.estado_pago === 'pagado').reduce((s, c) => s + Number(c.monto || 0), 0).toFixed(0) }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Vencidas</div>
              <div class="stat-value cobro-vencido">
                S/ {{ cobranzas.filter(c => c.estado_pago === 'vencido').reduce((s, c) => s + Number(c.monto || 0), 0).toFixed(0) }}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Total Mes</div>
              <div class="stat-value">
                S/ {{ cobranzasMes.reduce((s, c) => s + Number(c.monto || 0), 0).toFixed(0) }}
              </div>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Registro de Cobranzas</span>
                <v-spacer />
                <v-text-field v-model="searchCobranza" prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar..." density="compact" hide-details style="max-width: 220px;" />
              </v-card-title>
              <v-data-table :headers="headersCobranzas" :items="cobranzasFiltradas"
                class="elevation-0" no-data-text="Sin cobranzas" :items-per-page="20">
                <template v-slot:item.estado_pago="{ item }">
                  <span :class="'cobro-' + item.estado_pago" style="font-weight: 600; text-transform: capitalize;">
                    {{ item.estado_pago }}
                  </span>
                </template>
                <template v-slot:item.monto="{ item }">
                  S/ {{ Number(item.monto || 0).toFixed(2) }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <div style="display: flex; gap: 4px;">
                    <v-btn icon size="x-small" variant="text" @click="editarCobranza(item)">
                      <v-icon icon="mdi-pencil" size="16" />
                    </v-btn>
                    <v-btn v-if="item.estado_pago === 'pendiente'" icon size="x-small" variant="text" color="success"
                      @click="marcarPagado(item)">
                      <v-icon icon="mdi-check" size="16" />
                    </v-btn>
                    <v-btn icon size="x-small" variant="text" color="success"
                      @click="enviarWhatsappCobranza(item)" :title="'Enviar por WhatsApp'">
                      <v-icon icon="mdi-whatsapp" size="16" />
                    </v-btn>
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog: Nueva/Editar Cobranza -->
        <v-dialog v-model="showNuevaCobranza" max-width="520" persistent>
          <v-card>
            <v-card-title>{{ editingCobranza ? 'Editar Cobranza' : 'Nueva Cobranza' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field v-model="cobranzaForm.empresa_cliente" label="Empresa / Cliente" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="cobranzaForm.ruc_cliente" label="RUC" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="cobranzaForm.monto" label="Monto (S/)" type="number" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="cobranzaForm.tipo_comprobante" :items="['boleta','factura']"
                    label="Tipo comprobante" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="cobranzaForm.metodo_pago" :items="['efectivo','transferencia','cheque','tarjeta']"
                    label="Método de pago" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="cobranzaForm.estado_pago" :items="['pendiente','pagado','vencido','anulado']"
                    label="Estado" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="cobranzaForm.fecha_vencimiento" label="Fecha vencimiento" type="date" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="cobranzaForm.notas" label="Notas" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showNuevaCobranza = false">Cancelar</v-btn>
              <v-btn color="primary" @click="saveCobranza" :loading="savingCobranza">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: EGRESOS ========== -->
      <div v-else-if="activeView === 'egresos'" class="view-container">
        <header class="top-header">
          <h1>Egresos</h1>
          <button class="btn-primary" @click="showNuevoEgreso = true">
            <v-icon icon="mdi-plus" size="16" />
            <span>Nuevo Egreso</span>
          </button>
        </header>
        <div class="content-area">
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Registro de Egresos</span>
                <v-spacer />
                <span style="font-size: 0.85rem; color: var(--text-secondary);">
                  Total: S/ {{ egresos.filter(e => !e.deleted).reduce((s, e) => s + Number(e.total || 0), 0).toFixed(2) }}
                </span>
              </v-card-title>
              <v-data-table :headers="headersEgresos" :items="egresos.filter(e => !e.deleted)"
                class="elevation-0" no-data-text="Sin egresos" :items-per-page="20">
                <template v-slot:item.total="{ item }">
                  S/ {{ Number(item.total || 0).toFixed(2) }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <div style="display: flex; gap: 4px;">
                    <v-btn icon size="x-small" variant="text" @click="editarEgreso(item)">
                      <v-icon icon="mdi-pencil" size="16" />
                    </v-btn>
                    <v-btn icon size="x-small" variant="text" color="error" @click="eliminarEgreso(item)">
                      <v-icon icon="mdi-delete" size="16" />
                    </v-btn>
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <v-dialog v-model="showNuevoEgreso" max-width="460" persistent>
          <v-card>
            <v-card-title>{{ editingEgreso ? 'Editar Egreso' : 'Nuevo Egreso' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6">
                  <v-text-field v-model="egresoForm.fecha" label="Fecha" type="date" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="egresoForm.categoria" label="Categoría" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="egresoForm.nombre" label="Descripción" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-select v-model="egresoForm.metodo_pago" :items="['efectivo','transferencia','tarjeta','cheque']"
                    label="Método pago" density="compact" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model.number="egresoForm.total" label="Total (S/)" type="number" density="compact" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="egresoForm.notas" label="Notas" density="compact" />
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showNuevoEgreso = false">Cancelar</v-btn>
              <v-btn color="primary" @click="saveEgreso" :loading="savingEgreso">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: META ADS ========== -->
      <div v-else-if="activeView === 'meta'" class="view-container">
        <header class="top-header">
          <h1>Meta ADS</h1>
          <button class="btn-secondary" @click="fetchMeta">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>
        <div class="content-area">
          <!-- KPIs Meta -->
          <div v-if="metaResumen.length > 0" class="meta-kpi-grid">
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">Inversión</div>
              <div class="meta-kpi-value">S/ {{ latestMeta.inversion?.toFixed(0) }}</div>
            </div>
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">Leads</div>
              <div class="meta-kpi-value">{{ latestMeta.leads }}</div>
            </div>
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">CPL</div>
              <div class="meta-kpi-value">S/ {{ latestMeta.cpl?.toFixed(2) }}</div>
            </div>
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">CTR</div>
              <div class="meta-kpi-value">{{ ((latestMeta.ctr || 0) * 100).toFixed(2) }}%</div>
            </div>
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">Alcance</div>
              <div class="meta-kpi-value">{{ (latestMeta.alcance || 0).toLocaleString() }}</div>
            </div>
            <div class="meta-kpi-card">
              <div class="meta-kpi-label">Clics</div>
              <div class="meta-kpi-value">{{ (latestMeta.clics || 0).toLocaleString() }}</div>
            </div>
          </div>
          <div v-else style="text-align: center; padding: 40px; color: var(--text-secondary);">
            Sin datos de Meta ADS. Importa un flujo n8n para comenzar.
          </div>

          <!-- Gráfico histórico -->
          <div v-if="metaResumen.length > 0" class="chart-section" style="margin-top: 20px;">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Histórico Meta ADS</h2>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="bar" height="280" :options="metaChartOptions" :series="metaSeries" />
              </client-only>
            </div>
          </div>

          <!-- Tabla campañas -->
          <div v-if="metaCampanas.length > 0" class="table-section" style="margin-top: 20px;">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Campañas — {{ metaMesSeleccionado }}</span>
                <v-spacer />
                <v-select v-model="metaMesSeleccionado" :items="metaMeses" density="compact"
                  style="max-width: 180px;" hide-details />
              </v-card-title>
              <v-data-table :headers="headersMeta" :items="campanasMes" class="elevation-0"
                no-data-text="Sin campañas" :items-per-page="20">
                <template v-slot:item.inversion="{ item }">S/ {{ Number(item.inversion || 0).toFixed(2) }}</template>
                <template v-slot:item.cpl="{ item }">S/ {{ Number(item.cpl || 0).toFixed(2) }}</template>
                <template v-slot:item.ctr="{ item }">{{ ((Number(item.ctr || 0)) * 100).toFixed(2) }}%</template>
              </v-data-table>
            </v-card>
          </div>
        </div>
      </div>

    </div>

    <!-- Snackbar global -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { isSuperAdmin, dashboards } from '~/utils/permissions'

definePageMeta({ middleware: 'auth-dashboard' })

const client = useSupabaseClient()
const router = useRouter()

// ── Session ────────────────────────────────────────────────────────────────
const currentUser = ref({ full_name: '', email: '', role: '' })
const isDark = ref(true)
const showDashboardMenu = ref(false)
const showUserMenu = ref(false)

// ── Navigation ─────────────────────────────────────────────────────────────
const activeView = ref('dashboard')

const menuItems = [
  { id: 'dashboard',  label: 'Dashboard',  icon: 'mdi-view-dashboard' },
  { id: 'calendario', label: 'Calendario', icon: 'mdi-calendar' },
  { id: 'clientes',   label: 'Clientes',   icon: 'mdi-account-group' },
  { id: 'leads',      label: 'Leads',      icon: 'mdi-account-search' },
]
const chatItems = [
  { id: 'conversaciones', label: 'Conversaciones', icon: 'mdi-message-text', href: 'https://chats.alef.company/app/accounts/15/dashboard' },
]
const emergenciasItems = [
  { id: 'emergencias', label: 'Monitor Emergencias', icon: 'mdi-alert-circle' },
  { id: 'tecnicos',    label: 'Técnicos',            icon: 'mdi-account-hard-hat' },
]
const operacionesItems = [
  { id: 'intervenciones', label: 'Intervenciones', icon: 'mdi-wrench' },
  { id: 'cobranzas',      label: 'Cobranzas',      icon: 'mdi-cash-multiple' },
]
const financiasItems = [
  { id: 'facturacion', label: 'Facturación', icon: 'mdi-receipt' },
  { id: 'egresos',     label: 'Egresos',     icon: 'mdi-arrow-down-circle' },
]
const reportesItems = [
  { id: 'meta', label: 'Meta ADS', icon: 'mdi-facebook' },
]

function handleNavigation(item) {
  if (item.href) {
    window.open(item.href, '_blank')
  } else {
    activeView.value = item.id
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
}

// ── Snackbar ───────────────────────────────────────────────────────────────
const snackbar = ref({ show: false, text: '', color: 'success' })
function notify(text, color = 'success') {
  snackbar.value = { show: true, text, color }
}

// ── Auth / Session ─────────────────────────────────────────────────────────
async function loadSession() {
  try {
    const cookie = useCookie('dashboard_session')
    if (cookie.value) {
      currentUser.value = typeof cookie.value === 'string' ? JSON.parse(cookie.value) : cookie.value
    }
  } catch {}
}

async function logout() {
  await client.auth.signOut()
  const cookie = useCookie('dashboard_session')
  cookie.value = null
  router.push('/')
}

// ── Stats ──────────────────────────────────────────────────────────────────
const stats = computed(() => [
  {
    title: 'Emergencias Activas',
    value: emergenciasActivas.value,
    change: '',
    trend: emergenciasActivas.value > 0 ? 'down' : 'up',
    subtitle: emergenciasActivas.value > 0 ? 'Requieren atención' : 'Todo bajo control',
    description: 'Estado actual'
  },
  {
    title: 'Técnicos Disponibles',
    value: tecnicos.value.filter(t => t.estado === 'disponible').length,
    change: '',
    trend: 'up',
    subtitle: `de ${tecnicos.value.length} técnicos`,
    description: 'Flota activa'
  },
  {
    title: 'Intervenciones del Mes',
    value: intervencionesMes.value.length,
    change: '',
    trend: 'up',
    subtitle: 'Mes actual',
    description: 'Servicios completados'
  },
  {
    title: 'Leads Totales',
    value: leadsWpp.value.length + leadsFbIg.value.length,
    change: '',
    trend: 'up',
    subtitle: 'WPP + FB/IG',
    description: 'Prospectos activos'
  },
])

// ── Chart (leads histórico) ────────────────────────────────────────────────
const series = ref([{ name: 'Leads WPP', data: [] }, { name: 'Leads FB/IG', data: [] }])
const chartOptions = computed(() => ({
  chart: { type: 'area', background: 'transparent', toolbar: { show: false } },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#F4623A', '#FF8F70'],
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
  xaxis: { categories: [], labels: { style: { colors: '#999' } } },
  yaxis: { labels: { style: { colors: '#999' } } },
  grid: { borderColor: 'rgba(255,255,255,0.06)' },
  legend: { labels: { colors: '#aaa' } },
  dataLabels: { enabled: false },
}))

// ── Zoom buttons ───────────────────────────────────────────────────────────
const activeZoom = ref('all')
const zoomButtons = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: 'all', label: 'Todo' },
]
function handleZoom(id) { activeZoom.value = id }

// ── Calendario ─────────────────────────────────────────────────────────────
const _now = new Date()
const currentMonth = ref(_now.getMonth())
const currentYear = ref(_now.getFullYear())
const events = ref([])
const showEventDialog = ref(false)
const editingEvent = ref(null)
const savingEvent = ref(false)
const eventForm = ref({ fecha: '', hora: '', client_name: '', client_surname: '', client_phone: '', client_email: '', empresa: '', ruc: '', direccion: '', tipo_equipo: '', descripcion: '', estado: 'pendiente' })

const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNamesEs = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function normalizeEventDate(raw) {
  if (!raw) return ''
  const s = raw.split('T')[0]
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-')
    return `${y}-${m}-${d}`
  }
  return s
}

function getEventsForDate(dateStr) {
  return events.value.filter(e => e.date === dateStr)
}

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const lastDateOfMonth = new Date(year, month + 1, 0).getDate()
  const prevLastDate = new Date(year, month, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells = []

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevLastDate - i)
    cells.push({ day: date.getDate(), dateStr: formatDateISO(date), isCurrentMonth: false, isToday: false, events: [] })
  }
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const date = new Date(year, month, d)
    date.setHours(0, 0, 0, 0)
    const dateStr = formatDateISO(date)
    cells.push({ day: d, dateStr, isCurrentMonth: true, isToday: date.getTime() === today.getTime(), events: getEventsForDate(dateStr) })
  }
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i)
    cells.push({ day: i, dateStr: formatDateISO(date), isCurrentMonth: false, isToday: false, events: [] })
  }
  return cells
})

const upcomingEvents = computed(() => {
  const nowTs = Date.now()
  return events.value
    .filter(e => {
      const ts = new Date(e.date + 'T' + (e.time || '00:00')).getTime()
      return ts >= nowTs
    })
    .sort((a, b) => {
      const ta = new Date(a.date + 'T' + (a.time || '00:00')).getTime()
      const tb = new Date(b.date + 'T' + (b.time || '00:00')).getTime()
      return ta - tb
    })
    .slice(0, 6)
})

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else currentMonth.value--
}
function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else currentMonth.value++
}

function openCreateEventDialog(dateStr = null) {
  editingEvent.value = null
  eventForm.value = {
    fecha: dateStr || formatDateISO(new Date()),
    hora: '09:00', client_name: '', client_surname: '', client_phone: '',
    client_email: '', empresa: '', ruc: '', direccion: '',
    tipo_equipo: '', descripcion: '', estado: 'pendiente'
  }
  showEventDialog.value = true
}

function editarEvento(ev) {
  editingEvent.value = ev
  eventForm.value = {
    fecha: ev.date, hora: ev.time, client_name: ev.clientName, client_surname: ev.clientSurname,
    client_phone: ev.clientPhone, client_email: ev.clientEmail || '', empresa: ev.empresa,
    ruc: ev.ruc || '', direccion: ev.direccion, tipo_equipo: ev.tipo_equipo,
    descripcion: ev.descripcion, estado: ev.estado
  }
  showEventDialog.value = true
}

async function fetchEvents() {
  const { data } = await client.from('gatwick_calendar_events').select('*')
  events.value = (data || []).map(e => ({
    id: e.id,
    date: normalizeEventDate(e.fecha),
    time: e.hora ? e.hora.substring(0, 5) : '',
    clientName: e.client_name || '',
    clientSurname: e.client_surname || '',
    clientPhone: e.client_phone || '',
    clientEmail: e.client_email || '',
    empresa: e.empresa || '',
    ruc: e.ruc || '',
    direccion: e.direccion || '',
    tipo_equipo: e.tipo_equipo || '',
    descripcion: e.descripcion || '',
    estado: e.estado || 'pendiente',
  }))
}

async function saveEvent() {
  savingEvent.value = true
  try {
    const payload = {
      fecha: eventForm.value.fecha,
      hora: eventForm.value.hora,
      client_name: eventForm.value.client_name,
      client_surname: eventForm.value.client_surname,
      client_phone: eventForm.value.client_phone,
      client_email: eventForm.value.client_email,
      empresa: eventForm.value.empresa,
      ruc: eventForm.value.ruc,
      direccion: eventForm.value.direccion,
      tipo_equipo: eventForm.value.tipo_equipo,
      descripcion: eventForm.value.descripcion,
      estado: eventForm.value.estado,
      updated_at: new Date().toISOString(),
    }
    if (editingEvent.value) {
      await client.from('gatwick_calendar_events').update(payload).eq('id', editingEvent.value.id)
    } else {
      await client.from('gatwick_calendar_events').insert(payload)
    }
    await fetchEvents()
    showEventDialog.value = false
    editingEvent.value = null
    notify('Cita guardada')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingEvent.value = false
  }
}

async function deleteEvent() {
  if (!editingEvent.value) return
  await client.from('gatwick_calendar_events').delete().eq('id', editingEvent.value.id)
  await fetchEvents()
  showEventDialog.value = false
  editingEvent.value = null
  notify('Cita eliminada')
}

// ── Clientes ───────────────────────────────────────────────────────────────
const clientesWpp = ref([])
const clientesFbIg = ref([])
const clientesTab = ref('wpp')
const searchClientes = ref('')

const clientesWppFiltrados = computed(() => {
  if (!searchClientes.value) return clientesWpp.value
  const q = searchClientes.value.toLowerCase()
  return clientesWpp.value.filter(c => [c.nombre, c.numero, c.empresa].some(v => v?.toLowerCase().includes(q)))
})
const clientesFbIgFiltrados = computed(() => {
  if (!searchClientes.value) return clientesFbIg.value
  const q = searchClientes.value.toLowerCase()
  return clientesFbIg.value.filter(c => [c.nombre, c.instagram_handle, c.empresa].some(v => v?.toLowerCase().includes(q)))
})

async function fetchClientesWpp() {
  const { data } = await client.from('ClientesBDwppGATWICK').select('*').order('created_at', { ascending: false })
  clientesWpp.value = data || []
}
async function fetchClientesFbIg() {
  const { data } = await client.from('ClientesBDfbigGATWICK').select('*').order('created_at', { ascending: false })
  clientesFbIg.value = data || []
}

const headersClientesWpp = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Teléfono', key: 'numero' },
  { title: 'Empresa', key: 'empresa' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Servicio', key: 'servicio_interes' },
  { title: 'Agendado', key: 'fecha_agendamiento' },
]
const headersClientesFbIg = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Instagram', key: 'instagram_handle' },
  { title: 'Empresa', key: 'empresa' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Servicio', key: 'servicio_interes' },
  { title: 'Agendado', key: 'fecha_agendamiento' },
]

// ── Leads ──────────────────────────────────────────────────────────────────
const leadsWpp = ref([])
const leadsFbIg = ref([])
const leadsTab = ref('wpp')
const searchLeads = ref('')

const leadsWppFiltrados = computed(() => {
  if (!searchLeads.value) return leadsWpp.value
  const q = searchLeads.value.toLowerCase()
  return leadsWpp.value.filter(c => [c.nombre, c.numero, c.empresa].some(v => v?.toLowerCase().includes(q)))
})
const leadsFbIgFiltrados = computed(() => {
  if (!searchLeads.value) return leadsFbIg.value
  const q = searchLeads.value.toLowerCase()
  return leadsFbIg.value.filter(c => [c.nombre, c.instagram_handle, c.empresa].some(v => v?.toLowerCase().includes(q)))
})

async function fetchLeadsWpp() {
  const { data } = await client.from('GeneralBDwppGATWICK').select('*').order('created_at', { ascending: false })
  leadsWpp.value = data || []
}
async function fetchLeadsFbIg() {
  const { data } = await client.from('GeneralBDfbigGATWICK').select('*').order('created_at', { ascending: false })
  leadsFbIg.value = data || []
}

const headersLeads = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Teléfono', key: 'numero' },
  { title: 'Empresa', key: 'empresa' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Servicio', key: 'servicio_interes' },
]
const headersLeadsFbIg = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Instagram', key: 'instagram_handle' },
  { title: 'Empresa', key: 'empresa' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Servicio', key: 'servicio_interes' },
]

// ── Emergencias ────────────────────────────────────────────────────────────
const emergencias = ref([])
const loadingEmergencias = ref(false)
const filtroEmerg = ref('todas')
const showNuevaEmergencia = ref(false)
const editingEmerg = ref(null)
const savingEmerg = ref(false)
const emergForm = ref({})
let realtimeChannel = null

const emergenciasActivas = computed(() => emergencias.value.filter(e => e.estado !== 'resuelta').length)
const emergenciasFiltradas = computed(() => {
  if (filtroEmerg.value === 'todas') return emergencias.value
  return emergencias.value.filter(e => e.estado === filtroEmerg.value)
})

const headersEmergencias = [
  { title: '#', key: 'id', width: 60 },
  { title: 'Título', key: 'titulo' },
  { title: 'Empresa', key: 'empresa_cliente' },
  { title: 'Prioridad', key: 'prioridad' },
  { title: 'Estado', key: 'estado' },
  { title: 'Técnico', key: 'tecnico_id' },
]

function prioridadColor(p) {
  return { critica: 'error', alta: 'warning', media: 'info', baja: 'success' }[p] || 'default'
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function editarEmergencia(emerg) {
  editingEmerg.value = emerg
  emergForm.value = { ...emerg }
  showNuevaEmergencia.value = true
}

async function marcarResuelta(emerg) {
  await client.from('gatwick_emergencias').update({ estado: 'resuelta', resuelto_en: new Date().toISOString() }).eq('id', emerg.id)
  await fetchEmergencias()
  notify('Emergencia resuelta')
}

async function fetchEmergencias() {
  loadingEmergencias.value = true
  const { data } = await client.from('gatwick_emergencias').select('*').order('created_at', { ascending: false })
  emergencias.value = data || []
  loadingEmergencias.value = false
}

async function saveEmergencia() {
  savingEmerg.value = true
  try {
    const payload = { ...emergForm.value }
    delete payload.id
    if (editingEmerg.value) {
      await client.from('gatwick_emergencias').update(payload).eq('id', editingEmerg.value.id)
    } else {
      await client.from('gatwick_emergencias').insert(payload)
    }
    await fetchEmergencias()
    showNuevaEmergencia.value = false
    editingEmerg.value = null
    notify('Emergencia guardada')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingEmerg.value = false
  }
}

function subscribeEmergencias() {
  realtimeChannel = client.channel('gatwick-emergencias')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gatwick_emergencias' }, () => {
      fetchEmergencias()
    })
    .subscribe()
}

// ── Técnicos ───────────────────────────────────────────────────────────────
const tecnicos = ref([])
const showTecnicoDialog = ref(false)
const editingTecnico = ref(null)
const savingTecnico = ref(false)
const tecnicoForm = ref({})

const tecnicoItems = computed(() =>
  tecnicos.value.map(t => ({ id: t.id, label: `${t.nombre} ${t.apellido || ''} (${t.zona || ''})`.trim() }))
)

async function fetchTecnicos() {
  const { data } = await client.from('gatwick_tecnicos').select('*').eq('activo', true).order('nombre')
  tecnicos.value = data || []
}

function openNuevoTecnico() {
  editingTecnico.value = null
  tecnicoForm.value = { nombre: '', apellido: '', telefono: '', email: '', zona: '', estado: 'disponible', especialidad: '' }
  showTecnicoDialog.value = true
}

function editarTecnico(tec) {
  editingTecnico.value = tec
  tecnicoForm.value = { ...tec }
  showTecnicoDialog.value = true
}

async function toggleEstadoTecnico(tec) {
  const nuevoEstado = tec.estado === 'disponible' ? 'en_servicio' : 'disponible'
  await client.from('gatwick_tecnicos').update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', tec.id)
  await fetchTecnicos()
  notify(`Técnico marcado como ${nuevoEstado}`)
}

async function saveTecnico() {
  savingTecnico.value = true
  try {
    const payload = { ...tecnicoForm.value }
    delete payload.id
    if (editingTecnico.value) {
      await client.from('gatwick_tecnicos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingTecnico.value.id)
    } else {
      await client.from('gatwick_tecnicos').insert(payload)
    }
    await fetchTecnicos()
    showTecnicoDialog.value = false
    notify('Técnico guardado')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingTecnico.value = false
  }
}

// ── Intervenciones ─────────────────────────────────────────────────────────
const intervenciones = ref([])
const showNuevaIntervencion = ref(false)
const editingInterv = ref(null)
const savingInterv = ref(false)
const searchInterv = ref('')
const intervForm = ref({})

const intervencionesMes = computed(() => {
  const ym = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`
  return intervenciones.value.filter(i => i.created_at?.startsWith(ym))
})

const intervencionesFiltradas = computed(() => {
  if (!searchInterv.value) return intervenciones.value
  const q = searchInterv.value.toLowerCase()
  return intervenciones.value.filter(i =>
    [i.empresa_cliente, i.tipo_intervencion, i.tipo_equipo].some(v => v?.toLowerCase().includes(q))
  )
})

const headersIntervenciones = [
  { title: 'Empresa', key: 'empresa_cliente' },
  { title: 'Dirección', key: 'direccion' },
  { title: 'Tipo', key: 'tipo_intervencion' },
  { title: 'Equipo', key: 'tipo_equipo' },
  { title: 'Estado', key: 'estado' },
  { title: 'Costo', key: 'costo_total' },
  { title: 'Fecha', key: 'fecha_inicio' },
  { title: '', key: 'actions', sortable: false },
]

async function fetchIntervenciones() {
  const { data } = await client.from('gatwick_intervenciones').select('*').order('created_at', { ascending: false })
  intervenciones.value = data || []
}

function editarIntervencion(item) {
  editingInterv.value = item
  intervForm.value = { ...item }
  showNuevaIntervencion.value = true
}

async function saveIntervencion() {
  savingInterv.value = true
  try {
    const payload = { ...intervForm.value }
    payload.costo_total = Number(payload.costo_mano_obra || 0) + Number(payload.costo_repuestos || 0)
    delete payload.id
    if (editingInterv.value) {
      await client.from('gatwick_intervenciones').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingInterv.value.id)
    } else {
      await client.from('gatwick_intervenciones').insert(payload)
    }
    await fetchIntervenciones()
    showNuevaIntervencion.value = false
    editingInterv.value = null
    notify('Intervención guardada')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingInterv.value = false
  }
}

// ── Cobranzas ──────────────────────────────────────────────────────────────
const cobranzas = ref([])
const showNuevaCobranza = ref(false)
const editingCobranza = ref(null)
const savingCobranza = ref(false)
const searchCobranza = ref('')
const cobranzaForm = ref({})

const cobranzasMes = computed(() => {
  const ym = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`
  return cobranzas.value.filter(c => c.created_at?.startsWith(ym))
})

const cobranzasFiltradas = computed(() => {
  if (!searchCobranza.value) return cobranzas.value
  const q = searchCobranza.value.toLowerCase()
  return cobranzas.value.filter(c =>
    [c.empresa_cliente, c.ruc_cliente, c.estado_pago].some(v => v?.toLowerCase().includes(q))
  )
})

const headersCobranzas = [
  { title: 'Empresa', key: 'empresa_cliente' },
  { title: 'RUC', key: 'ruc_cliente' },
  { title: 'Monto', key: 'monto' },
  { title: 'Tipo', key: 'tipo_comprobante' },
  { title: 'Pago', key: 'metodo_pago' },
  { title: 'Estado', key: 'estado_pago' },
  { title: 'Vencimiento', key: 'fecha_vencimiento' },
  { title: '', key: 'actions', sortable: false },
]

async function fetchCobranzas() {
  const { data } = await client.from('gatwick_cobranzas').select('*').order('created_at', { ascending: false })
  cobranzas.value = data || []
}

function editarCobranza(item) {
  editingCobranza.value = item
  cobranzaForm.value = { ...item }
  showNuevaCobranza.value = true
}

async function marcarPagado(item) {
  await client.from('gatwick_cobranzas').update({ estado_pago: 'pagado', fecha_pago: new Date().toISOString().slice(0,10) }).eq('id', item.id)
  await fetchCobranzas()
  notify('Marcado como pagado')
}

async function saveCobranza() {
  savingCobranza.value = true
  try {
    const payload = { ...cobranzaForm.value }
    delete payload.id
    if (editingCobranza.value) {
      await client.from('gatwick_cobranzas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCobranza.value.id)
    } else {
      await client.from('gatwick_cobranzas').insert(payload)
    }
    await fetchCobranzas()
    showNuevaCobranza.value = false
    editingCobranza.value = null
    notify('Cobranza guardada')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingCobranza.value = false
  }
}

async function enviarWhatsappCobranza(item) {
  if (!item.empresa_cliente) return notify('Sin empresa asignada', 'warning')
  const monto = Number(item.monto || 0).toFixed(2)
  const msg = `Hola ${item.empresa_cliente}, le recordamos que tiene un saldo pendiente de S/ ${monto} por servicios de Gatwick Ascensores. Gracias.`
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
}

// ── Egresos ────────────────────────────────────────────────────────────────
const egresos = ref([])
const showNuevoEgreso = ref(false)
const editingEgreso = ref(null)
const savingEgreso = ref(false)
const egresoForm = ref({})

const headersEgresos = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Categoría', key: 'categoria' },
  { title: 'Descripción', key: 'nombre' },
  { title: 'Método', key: 'metodo_pago' },
  { title: 'Total', key: 'total' },
  { title: '', key: 'actions', sortable: false },
]

async function fetchEgresos() {
  const { data } = await client.from('egresos_GATWICK').select('*').eq('deleted', false).order('fecha', { ascending: false })
  egresos.value = data || []
}

function editarEgreso(item) {
  editingEgreso.value = item
  egresoForm.value = { ...item }
  showNuevoEgreso.value = true
}

async function saveEgreso() {
  savingEgreso.value = true
  try {
    const payload = { ...egresoForm.value }
    delete payload.id
    if (editingEgreso.value) {
      await client.from('egresos_GATWICK').update(payload).eq('id', editingEgreso.value.id)
    } else {
      await client.from('egresos_GATWICK').insert({ ...payload, deleted: false })
    }
    await fetchEgresos()
    showNuevoEgreso.value = false
    editingEgreso.value = null
    notify('Egreso guardado')
  } catch {
    notify('Error al guardar', 'error')
  } finally {
    savingEgreso.value = false
  }
}

async function eliminarEgreso(item) {
  await client.from('egresos_GATWICK').update({ deleted: true }).eq('id', item.id)
  await fetchEgresos()
  notify('Egreso eliminado')
}

// ── Meta ADS ───────────────────────────────────────────────────────────────
const metaResumen = ref([])
const metaCampanas = ref([])
const metaMesSeleccionado = ref('')

const metaMeses = computed(() => [...new Set(metaResumen.value.map(r => r.mes))].sort())
const latestMeta = computed(() => metaResumen.value[metaResumen.value.length - 1] || {})
const campanasMes = computed(() => metaCampanas.value.filter(c => c.mes === metaMesSeleccionado.value))

const metaSeries = computed(() => [
  { name: 'Inversión', type: 'bar', data: metaResumen.value.map(r => r.inversion || 0) },
  { name: 'Leads', type: 'line', data: metaResumen.value.map(r => r.leads || 0) },
])
const metaChartOptions = computed(() => ({
  chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#F4623A', '#FFB74D'],
  stroke: { width: [0, 3] },
  xaxis: { categories: metaResumen.value.map(r => r.mes), labels: { style: { colors: '#999' } } },
  yaxis: [
    { labels: { style: { colors: '#999' }, formatter: v => 'S/'+v } },
    { opposite: true, labels: { style: { colors: '#999' } } },
  ],
  grid: { borderColor: 'rgba(255,255,255,0.06)' },
  legend: { labels: { colors: '#aaa' } },
  dataLabels: { enabled: false },
}))

const headersMeta = [
  { title: 'Campaña', key: 'nombre_campana' },
  { title: 'Inversión', key: 'inversion' },
  { title: 'Leads', key: 'leads' },
  { title: 'CPL', key: 'cpl' },
  { title: 'Alcance', key: 'alcance' },
  { title: 'Clics', key: 'clics' },
  { title: 'CTR', key: 'ctr' },
]

async function fetchMeta() {
  const [{ data: res }, { data: camp }] = await Promise.all([
    client.from('GATWICK_meta_resumen_mensual').select('*').order('mes'),
    client.from('GATWICK_meta_campanas').select('*').order('mes'),
  ])
  metaResumen.value = res || []
  metaCampanas.value = camp || []
  if (!metaMesSeleccionado.value && metaResumen.value.length > 0) {
    metaMesSeleccionado.value = metaResumen.value[metaResumen.value.length - 1].mes
  }
}

// ── Tabs dashboard ─────────────────────────────────────────────────────────
const activeTab = ref('clientes_dashboard')
const tabs = [
  { value: 'clientes_dashboard', label: 'Clientes' },
  { value: 'leads_tab', label: 'Leads' },
  { value: 'emerg_tab', label: 'Emergencias' },
]

// ── Refresh all ────────────────────────────────────────────────────────────
async function refreshAll() {
  await Promise.all([
    fetchClientesWpp(),
    fetchClientesFbIg(),
    fetchLeadsWpp(),
    fetchLeadsFbIg(),
    fetchEmergencias(),
    fetchTecnicos(),
    fetchEvents(),
  ])
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadSession()
  await Promise.all([
    fetchClientesWpp(),
    fetchClientesFbIg(),
    fetchLeadsWpp(),
    fetchLeadsFbIg(),
    fetchEmergencias(),
    fetchTecnicos(),
    fetchEvents(),
    fetchIntervenciones(),
    fetchCobranzas(),
    fetchEgresos(),
    fetchMeta(),
  ])
  subscribeEmergencias()
})

onUnmounted(() => {
  if (realtimeChannel) client.removeChannel(realtimeChannel)
})
</script>
