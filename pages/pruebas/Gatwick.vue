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
          <div class="nav-label">INVENTARIO</div>
          <button v-for="item in inventarioItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]"
            @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'inventario' && componentesEnAlertaCount > 0" class="nav-badge-red">
              {{ componentesEnAlertaCount }}
            </span>
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

      <!-- ==========  VISTA: FORMULARIOS  ========== -->
      <div v-else-if="activeView === 'formularios'" class="view-container">
        <header class="top-header">
          <h1>Formularios</h1>
        </header>
        <div class="content-area">
          <FormsCompanyPanel company-id="gatwick" />
        </div>
      </div>

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
                  <span class="table-title">Últimos 10 Edificios</span>
                </v-card-title>
                <v-data-table :headers="headersEdificiosMini" :items="edificios.slice(0,10)" class="elevation-0"
                  no-data-text="No hay edificios" :items-per-page="10">
                  <template v-slot:item.equipos="{ item }">
                    <span>
                      <v-chip v-for="a in (item.equipos||[])" :key="a.codigo" size="x-small" variant="tonal" class="mr-1">
                        {{ a.codigo }}
                      </v-chip>
                      <span v-if="!(item.equipos||[]).length" style="opacity:.5;">—</span>
                    </span>
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

      <!-- ========== VISTA: CLIENTES (EDIFICIOS) ========== -->
      <div v-else-if="activeView === 'clientes'" class="view-container">
        <header class="top-header">
          <h1>Clientes · Edificios</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevoEdificio">
              <v-icon icon="mdi-plus" size="16" />
              <span>Nuevo edificio</span>
            </button>
            <button class="btn-primary" @click="fetchEdificios">
              <v-icon icon="mdi-refresh" size="16" />
              <span>Actualizar</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <v-alert v-if="ascensoresSinCodigo > 0" type="warning" variant="tonal" density="compact" class="mb-3">
            Hay {{ ascensoresSinCodigo }} ascensor(es) sin código asignado.
            <a href="#" style="font-weight:600; margin-left:6px;" @click.prevent="generarCodigosFaltantes">Generar códigos ahora</a>
          </v-alert>
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Edificios ({{ edificios.length }})</span>
                <v-spacer />
                <v-text-field v-model="searchEdificios" prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar por nombre, ELME, distrito, código…" density="compact" hide-details style="max-width: 320px;" />
              </v-card-title>
              <v-data-table :headers="headersEdificios" :items="edificiosFiltrados" :loading="loadingEdificios"
                class="elevation-0" no-data-text="No hay edificios" :items-per-page="20">
                <template v-slot:item.equipos="{ item }">
                  <div style="display:flex; flex-wrap:wrap; gap:4px; padding:4px 0;">
                    <v-chip v-for="a in (item.equipos||[])" :key="a.codigo" size="small" variant="tonal"
                      :title="`${a.tipo || ''}${a.paradas ? ' · ' + a.paradas + ' paradas' : ''}${a.variante ? ' · ' + a.variante : ''}`">
                      <strong>{{ a.codigo || '—' }}</strong>&nbsp;· {{ a.tipo }}
                    </v-chip>
                    <span v-if="!(item.equipos||[]).length" style="opacity:.5;">Sin ascensores</span>
                  </div>
                </template>
                <template v-slot:item.activo="{ item }">
                  <v-chip :color="item.activo ? 'success' : 'error'" size="small" variant="tonal">
                    {{ item.activo ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </template>
                <template v-slot:item.acciones="{ item }">
                  <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="editarEdificio(item)" title="Editar" />
                  <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmarEliminarEdificio(item)" title="Eliminar" />
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog: Crear / Editar edificio -->
        <v-dialog v-model="showEdificioDialog" max-width="760" persistent>
          <v-card v-if="edificioForm">
            <v-card-title class="pt-4">{{ editingEdificio ? 'Editar edificio' : 'Nuevo edificio' }}</v-card-title>
            <v-card-text>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <v-text-field v-model="edificioForm.nombre" label="Nombre *" density="compact" hide-details />
                <v-text-field v-model="edificioForm.elme" label="ELME" density="compact" hide-details />
                <v-text-field v-model="edificioForm.direccion" label="Dirección" density="compact" hide-details />
                <v-text-field v-model="edificioForm.distrito" label="Distrito" density="compact" hide-details />
                <v-switch v-model="edificioForm.activo" label="Activo" color="success" density="compact" hide-details inset />
                <v-switch v-model="edificioForm.es_instalacion_critica" label="Instalación crítica" color="warning" density="compact" hide-details inset />
              </div>

              <div style="margin-top:18px;">
                <div style="font-weight:600; margin-bottom:8px;">Ascensores</div>
                <v-table v-if="edificioForm.equipos.length" density="compact">
                  <thead>
                    <tr><th>Código</th><th>Tipo</th><th style="width:90px;">Paradas</th><th>Variante</th><th style="width:40px;"></th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(a, idx) in edificioForm.equipos" :key="idx">
                      <td><v-chip size="small" variant="tonal"><strong>{{ a.codigo || '—' }}</strong></v-chip></td>
                      <td>
                        <v-select v-model="a.tipo" :items="TIPOS_ASCENSOR.map(t => t.tipo)" density="compact" hide-details variant="plain" style="min-width:200px;" />
                      </td>
                      <td><v-text-field v-model.number="a.paradas" type="number" density="compact" hide-details variant="plain" /></td>
                      <td><v-text-field v-model="a.variante" density="compact" hide-details variant="plain" placeholder="—" /></td>
                      <td><v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="quitarAscensor(idx)" /></td>
                    </tr>
                  </tbody>
                </v-table>
                <div v-else style="opacity:.6; font-size:13px; padding:6px 0;">Sin ascensores todavía. Agrega el primero abajo.</div>

                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:12px;">
                  <v-select v-model="nuevoAscensor.tipo" :items="TIPOS_ASCENSOR.map(t => t.tipo)" label="Tipo" density="compact" hide-details style="min-width:230px;" />
                  <v-text-field v-model.number="nuevoAscensor.paradas" type="number" label="Paradas" density="compact" hide-details style="max-width:110px;" />
                  <v-text-field v-model="nuevoAscensor.variante" label="Variante (opcional)" density="compact" hide-details style="max-width:190px;" />
                  <v-btn color="primary" variant="tonal" @click="agregarAscensor">
                    <v-icon icon="mdi-plus" start /> Agregar
                  </v-btn>
                </div>
                <div style="font-size:12px; opacity:.7; margin-top:6px;">
                  Se asignará el código
                  <strong>{{ siguienteCodigo(prefijoDeTipo(nuevoAscensor.tipo), edificioForm.equipos) }}</strong>
                </div>
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showEdificioDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarEdificio">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Dialog: Eliminar edificio -->
        <v-dialog v-model="showDeleteEdificio" max-width="440">
          <v-card>
            <v-card-title class="pt-4">Eliminar edificio</v-card-title>
            <v-card-text>
              ¿Seguro que quieres eliminar <strong>{{ edificioAEliminar?.nombre }}</strong>?
              Se borrarán también sus ascensores. Esta acción no se puede deshacer.
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showDeleteEdificio = false">Cancelar</v-btn>
              <v-btn color="error" variant="flat" @click="eliminarEdificio">Eliminar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
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
                  <template v-if="emerg.codigo_ascensor"><strong>{{ emerg.codigo_ascensor }}</strong>&nbsp;·&nbsp;</template>
                  {{ emerg.tipo_equipo || 'Ascensor' }} {{ emerg.numero_equipo ? '· ' + emerg.numero_equipo : '' }}
                </div>
                <div v-if="emerg.descripcion" class="emerg-desc">{{ emerg.descripcion }}</div>
                <div class="emerg-time">{{ formatDateTime(emerg.created_at) }}</div>

                <!-- Seguimiento GPS -->
                <div v-if="seguimientoDe(emerg.id)" class="emerg-seg">
                  <span class="seg-chip" :class="'seg-' + seguimientoDe(emerg.id).estado">
                    {{ ESTADO_SEG[seguimientoDe(emerg.id).estado] || seguimientoDe(emerg.id).estado }}
                  </span>
                  <span class="seg-tec">{{ seguimientoDe(emerg.id).tecnico_nombre }}</span>
                  <a :href="`/gatwick/seguimiento/${seguimientoDe(emerg.id).token}`" target="_blank" class="seg-link">
                    <v-icon icon="mdi-map-marker-radius" size="13" /> Ver en mapa
                  </a>
                </div>
              </div>
              <div class="emerg-footer">
                <span :class="['estado-chip', 'estado-' + emerg.estado]">{{ emerg.estado }}</span>
                <div class="emerg-actions">
                  <v-btn v-if="!seguimientoDe(emerg.id) && emerg.estado !== 'resuelta'" size="x-small" variant="flat"
                    color="error" class="mr-1" :loading="iniciandoSeg === emerg.id" @click="abrirComenzar(emerg)">
                    <v-icon icon="mdi-play" size="14" start /> Comenzar
                  </v-btn>
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

        <!-- Dialog: Comenzar emergencia (asignar técnico) -->
        <v-dialog v-model="showComenzar" max-width="520" persistent>
          <v-card v-if="emergComenzar">
            <v-card-title class="pt-4">Comenzar emergencia #{{ emergComenzar.id }}</v-card-title>
            <v-card-text>
              <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                Se creará el seguimiento GPS, se avisará a los supervisores por WhatsApp y se generará
                el link privado para el técnico.
              </v-alert>

              <v-text-field v-model="comenzarForm.codigo_ascensor" label="Código del ascensor (AP-0001…)"
                density="compact" hide-details class="mb-3"
                hint="Con este código se resuelve el edificio, dirección y distrito" persistent-hint />

              <v-select v-model="comenzarForm.tecnico_id" :items="tecnicosSelect" item-title="label" item-value="id"
                label="Técnico asignado *" density="compact" hide-details class="mb-3" />

              <div v-if="!comenzarForm.tecnico_id" class="text-caption" style="opacity:.7;">
                O escribe los datos manualmente:
              </div>
              <div v-if="!comenzarForm.tecnico_id" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
                <v-text-field v-model="comenzarForm.tecnico_nombre" label="Nombre del técnico" density="compact" hide-details />
                <v-text-field v-model="comenzarForm.tecnico_telefono" label="Teléfono" density="compact" hide-details />
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showComenzar = false">Cancelar</v-btn>
              <v-btn color="error" variant="flat" :loading="iniciandoSeg === emergComenzar.id" @click="comenzarEmergencia">
                <v-icon icon="mdi-play" start /> Comenzar y avisar
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Dialog: seguimiento creado (links) -->
        <v-dialog v-model="showSegCreado" max-width="580">
          <v-card v-if="segCreado">
            <v-card-title class="pt-4" style="color:#4ade80;">
              <v-icon icon="mdi-check-circle" start /> Seguimiento iniciado
            </v-card-title>
            <v-card-text>
              <div class="seg-info-grid">
                <div v-if="segCreado.emergencia?.edificio_nombre"><span>Edificio</span><strong>{{ segCreado.emergencia.edificio_nombre }}</strong></div>
                <div v-if="segCreado.emergencia?.codigo_ascensor"><span>Ascensor</span><strong>{{ segCreado.emergencia.codigo_ascensor }}</strong></div>
                <div v-if="segCreado.emergencia?.direccion"><span>Dirección</span><strong>{{ segCreado.emergencia.direccion }}<template v-if="segCreado.emergencia.distrito">, {{ segCreado.emergencia.distrito }}</template></strong></div>
                <div><span>Técnico</span><strong>{{ segCreado.seguimiento?.tecnico_nombre }}</strong></div>
              </div>

              <v-alert v-if="!segCreado.destino_ubicado" type="warning" variant="tonal" density="compact" class="my-3">
                No se pudo ubicar la dirección en el mapa: el seguimiento funciona igual, pero sin ruta ni ETA.
              </v-alert>

              <v-alert v-if="segCreado.aviso" :type="segCreado.aviso.fallidos ? 'warning' : 'success'"
                variant="tonal" density="compact" class="my-3">
                Supervisores avisados por WhatsApp ({{ segCreado.aviso.enviados }})<template v-if="segCreado.aviso.fallidos">, {{ segCreado.aviso.fallidos }} fallido(s)</template>.
                Ellos ya pueden verte en el mapa.
              </v-alert>

              <!-- El técnico entra directo a su seguimiento: un botón, sin links que copiar -->
              <a :href="segCreado.link_tecnico" class="btn-seguimiento">
                <v-icon icon="mdi-map-marker-radius" size="22" />
                <span>Iniciar mi seguimiento GPS</span>
                <small>Se activará tu ubicación en vivo</small>
              </a>

              <p class="seg-pie">Al entrar podrás marcar “En camino”, “Atendiendo” y cerrar la emergencia.</p>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showSegCreado = false">Ahora no</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

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
                  <v-text-field v-model="emergForm.codigo_ascensor" label="Código ascensor (AP-0001…)" density="compact"
                    hint="Con él se resuelve el edificio automáticamente" persistent-hint />
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
          <button class="btn-primary" @click="openNuevaIntervencion">
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

                <!-- ===== Materiales utilizados (descuenta stock al completar) ===== -->
                <v-col cols="12">
                  <v-divider class="mb-2" />
                  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                    <strong style="font-size:0.9rem;">Materiales utilizados</strong>
                    <span style="font-size:0.72rem; color:var(--text-secondary);">Descuenta stock al guardar como "completada"</span>
                  </div>

                  <!-- Ya descontados (read-only) -->
                  <div v-if="intervMaterialesExistentes.length > 0" class="mov-stock-info" style="margin-bottom:8px;">
                    <div style="font-weight:600; margin-bottom:4px;">✓ Stock ya descontado para este informe:</div>
                    <div v-for="im in intervMaterialesExistentes" :key="im.id" style="font-size:0.82rem;">
                      • {{ im.componentes?.codigo }} {{ im.componentes?.nombre }} — {{ im.cantidad_usada }} {{ im.componentes?.unidad || '' }} ({{ money(im.costo_total) }})
                    </div>
                  </div>

                  <!-- Editor (solo si no se ha descontado todavía) -->
                  <template v-else>
                    <div v-for="(m, idx) in intervMateriales" :key="idx" style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                      <v-select v-model="m.componente_id" :items="componenteSelectItems" item-title="label" item-value="id"
                        label="Componente" density="compact" hide-details style="flex:1;" />
                      <v-text-field v-model.number="m.cantidad" label="Cant." type="number" density="compact" hide-details style="max-width:90px;" />
                      <v-btn icon size="x-small" variant="text" color="error" @click="quitarMaterialInterv(idx)"><v-icon icon="mdi-close" size="16" /></v-btn>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
                      <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="agregarMaterialInterv">Agregar material</v-btn>
                      <span v-if="intervMateriales.length" style="font-size:0.85rem;">Subtotal: <strong>{{ money(intervMaterialesSubtotal) }}</strong></span>
                    </div>
                    <div v-if="intervMateriales.length && intervForm.estado !== 'completada'" style="font-size:0.72rem; color:#FFB74D; margin-top:4px;">
                      ⚠ El stock se descuenta cuando el estado sea "completada".
                    </div>
                  </template>
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

      <!-- ========== VISTA: INVENTARIO (RESUMEN EJECUTIVO) ========== -->
      <div v-else-if="activeView === 'inventario'" class="view-container">
        <header class="top-header">
          <h1>Inventario</h1>
          <button class="btn-primary" @click="refreshInventario">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>
        <div class="content-area">
          <!-- KPIs -->
          <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card">
              <div class="stat-title">Componentes activos</div>
              <div class="stat-value">{{ componentesActivos.length }}</div>
              <div class="stat-description">En catálogo</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Valor total inventario</div>
              <div class="stat-value">{{ money(valorTotalInventario) }}</div>
              <div class="stat-description">Stock × precio unit.</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Componentes en alerta</div>
              <div class="stat-value" :style="{ color: componentesEnAlertaCount > 0 ? '#E57373' : 'inherit' }">
                {{ componentesEnAlertaCount }}
              </div>
              <div class="stat-description">Stock bajo / crítico</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Costo prom. fabricación</div>
              <div class="stat-value">{{ money(costoPromedioFabricacion) }}</div>
              <div class="stat-description">Promedio de recetas</div>
            </div>
          </div>

          <!-- Acceso rápido -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 20px 0;">
            <button class="btn-primary" @click="irA('componentes'); nuevoComponente()">
              <v-icon icon="mdi-plus" size="16" /><span>Agregar componente</span>
            </button>
            <button class="btn-secondary" @click="irA('recetas'); nuevaReceta()">
              <v-icon icon="mdi-file-document-plus" size="16" /><span>Nueva receta</span>
            </button>
            <button class="btn-secondary" @click="irA('movimientos'); nuevoMovimiento()">
              <v-icon icon="mdi-swap-vertical" size="16" /><span>Registrar movimiento</span>
            </button>
            <button class="btn-secondary" @click="irA('reportes')">
              <v-icon icon="mdi-chart-box" size="16" /><span>Ver reportes</span>
            </button>
          </div>

          <!-- Tabla alertas top 5 -->
          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">Componentes en alerta</span>
                <v-spacer />
                <button class="btn-secondary" @click="irA('componentes'); filterAlerta = 'CRÍTICO'">
                  <span>Ver todas las alertas</span>
                </button>
              </v-card-title>
              <v-data-table :headers="[
                  { title: 'Código', key: 'codigo' }, { title: 'Nombre', key: 'nombre' },
                  { title: 'Stock', key: 'stock_actual' }, { title: 'Mínimo', key: 'stock_minimo' },
                  { title: 'Nivel', key: 'nivel' }, { title: 'Faltante', key: 'faltante' },
                  { title: '', key: 'actions', sortable: false } ]"
                :items="componentesEnAlerta.slice(0,5)" class="elevation-0"
                no-data-text="Sin alertas de stock ✓" :items-per-page="5">
                <template v-slot:item.nivel="{ item }">
                  <v-chip :color="alertaColor(nivelAlerta(item))" size="small">{{ nivelAlerta(item) }}</v-chip>
                </template>
                <template v-slot:item.faltante="{ item }">
                  {{ Math.max(0, Number(item.stock_minimo) - Number(item.stock_actual)) }}
                </template>
                <template v-slot:item.actions="{ item }">
                  <v-btn icon size="x-small" variant="text" @click="irA('componentes'); verComponente(item)">
                    <v-icon icon="mdi-eye" size="16" />
                  </v-btn>
                </template>
                <template v-slot:bottom></template>
              </v-data-table>
            </v-card>
          </div>

          <!-- Charts -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
            <div class="chart-section">
              <div class="chart-header"><div class="chart-title-section"><h2>Valor por categoría</h2></div></div>
              <div class="chart-area">
                <client-only>
                  <apexchart v-if="valorPorCategoriaSeries.length" type="donut" height="300"
                    :options="invPieOptions" :series="valorPorCategoriaSeries" />
                  <div v-else style="text-align:center;padding:40px;color:var(--text-secondary);">Sin datos</div>
                </client-only>
              </div>
            </div>
            <div class="chart-section">
              <div class="chart-header"><div class="chart-title-section"><h2>Movimientos últimos 7 días</h2></div></div>
              <div class="chart-area">
                <client-only>
                  <apexchart type="bar" height="300" :options="invBarOptions" :series="invBarSeries" />
                </client-only>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== VISTA: COMPONENTES ========== -->
      <div v-else-if="activeView === 'componentes'" class="view-container">
        <header class="top-header">
          <h1>Componentes</h1>
          <div style="display:flex; gap:10px;">
            <input ref="compFileInput" type="file" accept=".csv" style="display:none" @change="importarComponentesCsv" />
            <button class="btn-secondary" @click="triggerCompCsv">
              <v-icon icon="mdi-upload" size="16" /><span>Importar CSV</span>
            </button>
            <button class="btn-primary" @click="nuevoComponente">
              <v-icon icon="mdi-plus" size="16" /><span>Agregar componente</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <!-- Filtros -->
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
            <v-text-field v-model="searchComp" prepend-inner-icon="mdi-magnify" placeholder="Buscar código o nombre"
              density="compact" hide-details style="max-width:240px;" />
            <v-select v-model="filterCategoria" :items="CATEGORIAS_COMP" label="Categoría" density="compact"
              hide-details clearable style="max-width:180px;" />
            <v-select v-model="filterEstado" :items="[{title:'Activo',value:'activo'},{title:'Inactivo',value:'inactivo'}]"
              label="Estado" density="compact" hide-details clearable style="max-width:150px;" />
            <v-select v-model="filterAlerta" :items="['CRÍTICO','BAJO','NORMAL']" label="Nivel alerta" density="compact"
              hide-details clearable style="max-width:160px;" />
            <button class="btn-secondary" @click="limpiarFiltrosComp"><span>Limpiar filtros</span></button>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar">
                <span class="table-title">{{ componentesFiltrados.length }} componentes</span>
              </v-card-title>
              <v-data-table :headers="headersComponentes" :items="componentesFiltrados" class="elevation-0"
                no-data-text="Sin componentes" :items-per-page="20" @click:row="(e, { item }) => verComponente(item)">
                <template v-slot:item.stock_actual="{ item }">
                  <v-chip :color="alertaColor(nivelAlerta(item))" size="small" variant="tonal">{{ item.stock_actual }}</v-chip>
                </template>
                <template v-slot:item.precio_unitario="{ item }">{{ money(item.precio_unitario) }}</template>
                <template v-slot:item.valor_stock="{ item }">{{ money(valorStock(item)) }}</template>
                <template v-slot:item.activo="{ item }">
                  <v-chip :color="item.activo ? 'success' : 'grey'" size="small">{{ item.activo ? 'Activo' : 'Inactivo' }}</v-chip>
                </template>
                <template v-slot:item.actions="{ item }">
                  <div style="display:flex; gap:2px;" @click.stop>
                    <v-btn icon size="x-small" variant="text" @click="verComponente(item)"><v-icon icon="mdi-eye" size="16" /></v-btn>
                    <v-btn icon size="x-small" variant="text" @click="editarComponente(item)"><v-icon icon="mdi-pencil" size="16" /></v-btn>
                    <v-btn icon size="x-small" variant="text" color="error" @click="eliminarComponente(item)"><v-icon icon="mdi-delete" size="16" /></v-btn>
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog componente -->
        <v-dialog v-model="showCompDialog" max-width="640" persistent>
          <v-card>
            <v-card-title>{{ editingComp ? (compReadonly ? 'Detalle del componente' : 'Editar componente') : 'Nuevo componente' }}</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="6"><v-text-field v-model="compForm.codigo" label="Código *" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="6"><v-text-field v-model="compForm.nombre" label="Nombre *" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="12"><v-textarea v-model="compForm.descripcion" label="Descripción" rows="2" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="6"><v-select v-model="compForm.categoria" :items="CATEGORIAS_COMP" label="Categoría *" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="6"><v-select v-model="compForm.unidad" :items="UNIDADES_COMP" label="Unidad *" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="compForm.precio_unitario" label="Precio unit. (S/) *" type="number" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="compForm.stock_actual" label="Stock actual *" type="number" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="compForm.stock_minimo" label="Stock mínimo *" type="number" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="compForm.stock_maximo" label="Stock máximo *" type="number" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="8"><v-text-field v-model="compForm.proveedor" label="Proveedor" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="6"><v-text-field v-model="compForm.fecha_ultima_compra" label="Última compra" type="date" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="6"><v-text-field v-model="compForm.ubicacion_almacen" label="Ubicación almacén" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="12"><v-textarea v-model="compForm.notas" label="Notas" rows="2" density="compact" :readonly="compReadonly" /></v-col>
                <v-col cols="12"><v-checkbox v-model="compForm.activo" label="Activo" density="compact" :disabled="compReadonly" hide-details /></v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showCompDialog = false">{{ compReadonly ? 'Cerrar' : 'Cancelar' }}</v-btn>
              <v-btn v-if="compReadonly && editingComp" color="primary" variant="text" @click="compReadonly = false">Editar</v-btn>
              <v-btn v-if="!compReadonly" color="primary" @click="saveComponente" :loading="savingComp">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: RECETAS ========== -->
      <div v-else-if="activeView === 'recetas'" class="view-container">
        <header class="top-header">
          <h1>Recetas valorizadas</h1>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" @click="descargarRecetario">
              <v-icon icon="mdi-download" size="16" /><span>Descargar recetario</span>
            </button>
            <button class="btn-primary" @click="nuevaReceta">
              <v-icon icon="mdi-plus" size="16" /><span>Nueva receta</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <!-- Resumen -->
          <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:16px;">
            <div class="stat-card"><div class="stat-title">Recetas activas</div><div class="stat-value">{{ resumenRecetas.total }}</div></div>
            <div class="stat-card"><div class="stat-title">Costo promedio</div><div class="stat-value">{{ money(resumenRecetas.prom) }}</div></div>
            <div class="stat-card"><div class="stat-title">Más cara</div><div class="stat-value">{{ money(resumenRecetas.maxC) }}</div><div class="stat-description">{{ resumenRecetas.maxR?.nombre || '—' }}</div></div>
            <div class="stat-card"><div class="stat-title">Más barata</div><div class="stat-value">{{ money(resumenRecetas.minC) }}</div><div class="stat-description">{{ resumenRecetas.minR?.nombre || '—' }}</div></div>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
            <v-text-field v-model="searchReceta" prepend-inner-icon="mdi-magnify" placeholder="Buscar código o nombre"
              density="compact" hide-details style="max-width:240px;" />
            <v-select v-model="filterTipoReceta" :items="TIPOS_RECETA" label="Tipo" density="compact" hide-details clearable style="max-width:180px;" />
            <v-select v-model="filterEstadoReceta" :items="[{title:'Activo',value:'activo'},{title:'Inactivo',value:'inactivo'}]"
              label="Estado" density="compact" hide-details clearable style="max-width:150px;" />
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar"><span class="table-title">{{ recetasFiltradas.length }} recetas</span></v-card-title>
              <v-data-table :headers="headersRecetas" :items="recetasFiltradas" class="elevation-0"
                no-data-text="Sin recetas" :items-per-page="20" @click:row="(e, { item }) => abrirReceta(item)">
                <template v-slot:item.n_comp="{ item }">{{ detallesDeReceta(item.id).length }}</template>
                <template v-slot:item.costo="{ item }">{{ money(costoReceta(item.id)) }}</template>
                <template v-slot:item.margen_sugerido="{ item }">{{ item.margen_sugerido }}%</template>
                <template v-slot:item.p_venta="{ item }">{{ money(precioVentaReceta(item)) }}</template>
                <template v-slot:item.activo="{ item }">
                  <v-chip :color="item.activo ? 'success' : 'grey'" size="small">{{ item.activo ? 'Activa' : 'Inactiva' }}</v-chip>
                </template>
                <template v-slot:item.actions="{ item }">
                  <div style="display:flex; gap:2px;" @click.stop>
                    <v-btn icon size="x-small" variant="text" @click="abrirReceta(item)"><v-icon icon="mdi-eye" size="16" /></v-btn>
                    <v-btn icon size="x-small" variant="text" @click="duplicarReceta(item)"><v-icon icon="mdi-content-copy" size="16" /></v-btn>
                    <v-btn icon size="x-small" variant="text" color="error" @click="eliminarReceta(item)"><v-icon icon="mdi-delete" size="16" /></v-btn>
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog receta (vista detallada) -->
        <v-dialog v-model="showRecetaDialog" max-width="820" persistent scrollable>
          <v-card>
            <v-card-title>{{ editingReceta ? 'Receta: ' + (recetaForm.codigo || '') : 'Nueva receta' }}</v-card-title>
            <v-card-text style="max-height:70vh;">
              <!-- Info receta -->
              <v-row dense>
                <v-col cols="4"><v-text-field v-model="recetaForm.codigo" label="Código *" density="compact" /></v-col>
                <v-col cols="5"><v-text-field v-model="recetaForm.nombre" label="Nombre *" density="compact" /></v-col>
                <v-col cols="3"><v-select v-model="recetaForm.tipo" :items="TIPOS_RECETA" label="Tipo *" density="compact" /></v-col>
                <v-col cols="12"><v-textarea v-model="recetaForm.descripcion" label="Descripción" rows="2" density="compact" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="recetaForm.tiempo_fabricacion_minutos" label="Tiempo (min)" type="number" density="compact" /></v-col>
                <v-col cols="4"><v-text-field v-model.number="recetaForm.margen_sugerido" label="Margen %" type="number" density="compact" /></v-col>
                <v-col cols="4" class="d-flex align-center"><v-checkbox v-model="recetaForm.activo" label="Activa" density="compact" hide-details /></v-col>
                <v-col cols="12"><v-textarea v-model="recetaForm.notas" label="Notas" rows="1" density="compact" /></v-col>
              </v-row>

              <div style="margin:8px 0; text-align:right;">
                <v-btn color="primary" size="small" @click="saveReceta" :loading="savingReceta">
                  {{ editingReceta ? 'Guardar cambios' : 'Crear receta' }}
                </v-btn>
              </div>

              <template v-if="editingReceta?.id">
                <v-divider class="my-3" />
                <h3 style="margin-bottom:8px;">Componentes de la receta</h3>
                <v-data-table :headers="[
                    { title: 'Código', key: 'cod' }, { title: 'Componente', key: 'nom' },
                    { title: 'Cant.', key: 'cantidad' }, { title: 'Unidad', key: 'uni' },
                    { title: 'P. Unit.', key: 'pu' }, { title: 'Subtotal', key: 'sub' },
                    { title: '', key: 'act', sortable: false } ]"
                  :items="detallesDeReceta(editingReceta.id)" class="elevation-0" density="compact"
                  no-data-text="Sin componentes — agrega abajo" :items-per-page="-1">
                  <template v-slot:item.cod="{ item }">{{ item.componentes?.codigo }}</template>
                  <template v-slot:item.nom="{ item }">{{ item.componentes?.nombre }}</template>
                  <template v-slot:item.uni="{ item }">{{ item.componentes?.unidad }}</template>
                  <template v-slot:item.pu="{ item }">{{ money(item.precio_unitario_en_receta) }}</template>
                  <template v-slot:item.sub="{ item }">{{ money(item.costo_subtotal) }}</template>
                  <template v-slot:item.act="{ item }">
                    <v-btn icon size="x-small" variant="text" color="error" @click="quitarDetalleReceta(item.id)"><v-icon icon="mdi-close" size="16" /></v-btn>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>

                <!-- Agregar componente -->
                <v-row dense class="mt-2" align="center">
                  <v-col cols="7">
                    <v-select v-model="nuevoDetalle.componente_id" :items="componenteSelectItems" item-title="label" item-value="id"
                      label="Seleccionar componente" density="compact" hide-details />
                  </v-col>
                  <v-col cols="3"><v-text-field v-model.number="nuevoDetalle.cantidad" label="Cantidad" type="number" density="compact" hide-details /></v-col>
                  <v-col cols="2"><v-btn color="primary" variant="tonal" block @click="agregarComponenteAReceta">+ Agregar</v-btn></v-col>
                </v-row>

                <!-- Cálculo costo final -->
                <div class="receta-costo-box">
                  <div class="receta-costo-row"><span>Costo de materiales:</span><strong>{{ money(costoReceta(editingReceta.id)) }}</strong></div>
                  <div class="receta-costo-row"><span>Margen ({{ recetaForm.margen_sugerido || 0 }}%):</span><strong>{{ money(precioVentaReceta(recetaForm) - costoReceta(editingReceta.id)) }}</strong></div>
                  <v-divider class="my-1" />
                  <div class="receta-costo-row receta-costo-total"><span>PRECIO VENTA SUGERIDO:</span><strong>{{ money(precioVentaReceta(recetaForm)) }}</strong></div>
                </div>
              </template>
              <div v-else style="color:var(--text-secondary); font-size:0.85rem; margin-top:8px;">
                Guarda la receta para poder agregarle componentes.
              </div>
            </v-card-text>
            <v-card-actions>
              <v-btn v-if="editingReceta" color="error" variant="text" @click="eliminarReceta()">Eliminar</v-btn>
              <v-btn v-if="editingReceta" variant="text" @click="duplicarReceta()">Duplicar</v-btn>
              <v-spacer />
              <v-btn text @click="showRecetaDialog = false">Cerrar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: MOVIMIENTOS ========== -->
      <div v-else-if="activeView === 'movimientos'" class="view-container">
        <header class="top-header">
          <h1>Movimientos de inventario</h1>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" @click="exportarMovimientos">
              <v-icon icon="mdi-microsoft-excel" size="16" /><span>Descargar histórico</span>
            </button>
            <button class="btn-primary" @click="nuevoMovimiento()">
              <v-icon icon="mdi-plus" size="16" /><span>Registrar movimiento</span>
            </button>
          </div>
        </header>
        <div class="content-area">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
            <v-text-field v-model="movFechaDesde" label="Desde" type="date" density="compact" hide-details style="max-width:160px;" />
            <v-text-field v-model="movFechaHasta" label="Hasta" type="date" density="compact" hide-details style="max-width:160px;" />
            <v-select v-model="filterTipoMov" :items="TIPOS_MOV" label="Tipo" density="compact" hide-details clearable style="max-width:150px;" />
            <v-text-field v-model="searchMovComp" prepend-inner-icon="mdi-magnify" placeholder="Componente" density="compact" hide-details style="max-width:180px;" />
            <v-text-field v-model="searchMotivo" placeholder="Motivo" density="compact" hide-details style="max-width:160px;" />
            <v-select v-model="filterUsuarioMov" :items="usuariosMov" label="Usuario" density="compact" hide-details clearable style="max-width:180px;" />
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar"><span class="table-title">{{ movimientosFiltrados.length }} movimientos</span></v-card-title>
              <v-data-table :headers="headersMovimientos" :items="movimientosFiltrados" class="elevation-0"
                no-data-text="Sin movimientos" :items-per-page="30">
                <template v-slot:item.fecha_movimiento="{ item }">{{ formatDateTime(item.fecha_movimiento) }}</template>
                <template v-slot:item.componente="{ item }">{{ item.componentes?.codigo }} · {{ item.componentes?.nombre }}</template>
                <template v-slot:item.tipo_movimiento="{ item }">
                  <v-chip :color="movTipoColor(item.tipo_movimiento)" size="small">{{ item.tipo_movimiento }}</v-chip>
                </template>
                <template v-slot:item.costo_total="{ item }">{{ money(item.costo_total) }}</template>
                <template v-slot:item.actions="{ item }">
                  <v-btn icon size="x-small" variant="text" color="warning" @click="deshacerMovimiento(item)" title="Deshacer">
                    <v-icon icon="mdi-undo" size="16" />
                  </v-btn>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog registrar movimiento -->
        <v-dialog v-model="showMovDialog" max-width="560" persistent>
          <v-card>
            <v-card-title>Registrar movimiento</v-card-title>
            <v-card-text>
              <v-row dense>
                <v-col cols="12">
                  <v-radio-group v-model="movForm.tipo_movimiento" inline density="compact" hide-details>
                    <v-radio label="Entrada" value="entrada" />
                    <v-radio label="Salida" value="salida" />
                    <v-radio label="Ajuste" value="ajuste" />
                    <v-radio label="Devolución" value="devolucion" />
                  </v-radio-group>
                </v-col>
                <v-col cols="12">
                  <v-select v-model="movForm.componente_id" :items="componenteSelectItems" item-title="label" item-value="id"
                    label="Componente *" density="compact" />
                </v-col>
                <v-col cols="12" v-if="movSelComponente">
                  <div class="mov-stock-info">
                    Stock actual: <strong>{{ movSelComponente.stock_actual }}</strong> ·
                    Mín: {{ movSelComponente.stock_minimo }} · Máx: {{ movSelComponente.stock_maximo }}
                    <span v-if="movForm.tipo_movimiento === 'ajuste'" style="color:var(--text-secondary);"> · (Ajuste = nuevo stock absoluto)</span>
                  </div>
                </v-col>
                <v-col cols="6"><v-text-field v-model.number="movForm.cantidad" label="Cantidad *" type="number" density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model.number="movForm.costo_unitario" label="Costo unitario (S/)" type="number" density="compact" /></v-col>
                <v-col cols="6"><v-text-field :model-value="money(movCostoTotal)" label="Costo total" readonly density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model="movForm.motivo" label="Motivo" density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model="movForm.numero_informe" label="N° informe (intervención)" density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model="movForm.numero_receta" label="N° receta" density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model="movForm.numero_compra" label="N° OC / Factura" density="compact" /></v-col>
                <v-col cols="6"><v-text-field v-model="movForm.proveedor" label="Proveedor" density="compact" /></v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn text @click="showMovDialog = false">Cancelar</v-btn>
              <v-btn color="primary" @click="registrarMovimiento" :loading="savingMov">Registrar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: COSTOS POR INTERVENCIÓN ========== -->
      <div v-else-if="activeView === 'costos-intervenciones'" class="view-container">
        <header class="top-header"><h1>Costo por intervención</h1></header>
        <div class="content-area">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:16px;">
            <v-text-field v-model="costoFechaDesde" label="Desde" type="date" density="compact" hide-details style="max-width:160px;" />
            <v-text-field v-model="costoFechaHasta" label="Hasta" type="date" density="compact" hide-details style="max-width:160px;" />
            <v-text-field v-model="searchInforme" prepend-inner-icon="mdi-magnify" placeholder="N° informe" density="compact" hide-details style="max-width:160px;" />
            <v-text-field v-model="searchClienteCosto" placeholder="Cliente / edificio" density="compact" hide-details style="max-width:200px;" />
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <v-card-title class="table-search-bar"><span class="table-title">{{ costosIntervencion.length }} intervenciones</span></v-card-title>
              <v-data-table :headers="headersCostos" :items="costosIntervencion" class="elevation-0"
                no-data-text="Sin intervenciones" :items-per-page="20" @click:row="(e, { item }) => verCostoIntervencion(item)">
                <template v-slot:item.fecha_inicio="{ item }">{{ formatDateTime(item.fecha_inicio || item.created_at) }}</template>
                <template v-slot:item._costoMat="{ item }">{{ money(item._costoMat) }}</template>
                <template v-slot:item._manoObra="{ item }">{{ money(item._manoObra) }}</template>
                <template v-slot:item._costoTotal="{ item }">{{ money(item._costoTotal) }}</template>
                <template v-slot:item._margen="{ item }">
                  <span :style="{ color: item._margen >= 0 ? '#4DB6AC' : '#E57373', fontWeight: 600 }">{{ money(item._margen) }}</span>
                </template>
                <template v-slot:item.actions="{ item }">
                  <v-btn icon size="x-small" variant="text" @click.stop="verCostoIntervencion(item)"><v-icon icon="mdi-eye" size="16" /></v-btn>
                </template>
              </v-data-table>
            </v-card>
          </div>
        </div>

        <!-- Dialog detalle costo -->
        <v-dialog v-model="showCostoDetalle" max-width="700" scrollable>
          <v-card v-if="intervSeleccionada">
            <v-card-title>Costo de intervención — N° {{ intervSeleccionada.id }}</v-card-title>
            <v-card-text style="max-height:70vh;">
              <div class="costo-header-grid">
                <div><span class="costo-label">Cliente</span><div>{{ intervSeleccionada.empresa_cliente || '—' }}</div></div>
                <div><span class="costo-label">Dirección</span><div>{{ intervSeleccionada.direccion || '—' }}</div></div>
                <div><span class="costo-label">Tipo</span><div>{{ intervSeleccionada.tipo_intervencion || '—' }}</div></div>
                <div><span class="costo-label">Fecha</span><div>{{ formatDateTime(intervSeleccionada.fecha_inicio || intervSeleccionada.created_at) }}</div></div>
              </div>

              <h3 style="margin:16px 0 8px;">Componentes usados</h3>
              <v-data-table :headers="[
                  { title: 'Código', key: 'cod' }, { title: 'Componente', key: 'nom' },
                  { title: 'Cant.', key: 'cantidad_usada' }, { title: 'P. Unit.', key: 'pu' }, { title: 'Subtotal', key: 'sub' } ]"
                :items="materialesDeInforme(intervSeleccionada.id)" class="elevation-0" density="compact"
                no-data-text="No se registraron materiales para esta intervención" :items-per-page="-1">
                <template v-slot:item.cod="{ item }">{{ item.componentes?.codigo }}</template>
                <template v-slot:item.nom="{ item }">{{ item.componentes?.nombre }}</template>
                <template v-slot:item.pu="{ item }">{{ money(item.precio_unitario) }}</template>
                <template v-slot:item.sub="{ item }">{{ money(item.costo_total) }}</template>
                <template v-slot:bottom></template>
              </v-data-table>

              <div class="receta-costo-box" style="margin-top:16px;">
                <div class="receta-costo-row"><span>Costo de materiales:</span><strong>{{ money(intervSeleccionada._costoMat) }}</strong></div>
                <div class="receta-costo-row"><span>Mano de obra:</span><strong>{{ money(intervSeleccionada._manoObra) }}</strong></div>
                <v-divider class="my-1" />
                <div class="receta-costo-row receta-costo-total"><span>COSTO TOTAL:</span><strong>{{ money(intervSeleccionada._costoTotal) }}</strong></div>
                <div class="receta-costo-row"><span>Precio cobrado al cliente:</span><strong>{{ money(intervSeleccionada._cobrado) }}</strong></div>
                <div class="receta-costo-row"><span>Margen:</span>
                  <strong :style="{ color: intervSeleccionada._margen >= 0 ? '#4DB6AC' : '#E57373' }">{{ money(intervSeleccionada._margen) }}</strong>
                </div>
              </div>
            </v-card-text>
            <v-card-actions><v-spacer /><v-btn text @click="showCostoDetalle = false">Cerrar</v-btn></v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: REPORTES ========== -->
      <div v-else-if="activeView === 'reportes'" class="view-container">
        <header class="top-header">
          <h1>Reportes y analytics</h1>
          <button class="btn-secondary" @click="exportarReporte">
            <v-icon icon="mdi-download" size="16" /><span>Exportar</span>
          </button>
        </header>
        <div class="content-area">
          <!-- Selector tipo -->
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button v-for="t in reporteTipos" :key="t.value"
              :class="['btn-secondary', { 'btn-primary': reporteTipo === t.value }]" @click="reporteTipo = t.value">
              <span>{{ t.label }}</span>
            </button>
          </div>

          <!-- Chart (consumo) -->
          <div v-if="['consumo_componente','consumo_categoria'].includes(reporteTipo) && reporteChartData.categories.length"
            class="chart-section" style="margin-bottom:16px;">
            <div class="chart-header"><div class="chart-title-section"><h2>{{ reporteTipos.find(t => t.value === reporteTipo)?.label }}</h2></div></div>
            <div class="chart-area">
              <client-only><apexchart type="bar" height="320" :options="reporteChartOptions" :series="reporteSeries" /></client-only>
            </div>
          </div>

          <div class="table-section">
            <v-card flat class="custom-data-table">
              <!-- Consumo por componente -->
              <v-data-table v-if="reporteTipo === 'consumo_componente'" :items="repConsumoComponente" class="elevation-0"
                :headers="[ { title:'Componente', key:'nombre' }, { title:'Cant. consumida (30d)', key:'cantidad' },
                  { title:'Costo total', key:'costo' }, { title:'Frecuencia', key:'freq' }, { title:'Proyección 60d', key:'proyeccion60' } ]"
                no-data-text="Sin consumo en los últimos 30 días" :items-per-page="20">
                <template v-slot:item.costo="{ item }">{{ money(item.costo) }}</template>
              </v-data-table>

              <!-- Consumo por categoría -->
              <v-data-table v-else-if="reporteTipo === 'consumo_categoria'" :items="repConsumoCategoria" class="elevation-0"
                :headers="[ { title:'Categoría', key:'categoria' }, { title:'Cantidad', key:'cantidad' }, { title:'Costo total', key:'costo' } ]"
                no-data-text="Sin datos" :items-per-page="20">
                <template v-slot:item.costo="{ item }">{{ money(item.costo) }}</template>
              </v-data-table>

              <!-- Rotación -->
              <v-data-table v-else-if="reporteTipo === 'rotacion'" :items="repRotacion" class="elevation-0"
                :headers="[ { title:'Componente', key:'nombre' }, { title:'Stock', key:'stock' }, { title:'Consumo 30d', key:'consumo' },
                  { title:'Rotación', key:'rotacion' }, { title:'Interpretación', key:'interpretacion' } ]"
                no-data-text="Sin datos" :items-per-page="20">
                <template v-slot:item.rotacion="{ item }">{{ item.rotacion.toFixed(2) }}</template>
                <template v-slot:item.interpretacion="{ item }">
                  <v-chip size="small" :color="item.interpretacion === 'Alto' ? 'success' : item.interpretacion === 'Normal' ? 'info' : 'warning'">{{ item.interpretacion }}</v-chip>
                </template>
              </v-data-table>

              <!-- Proyección de compras -->
              <v-data-table v-else-if="reporteTipo === 'proyeccion'" :items="repProyeccion" class="elevation-0"
                :headers="[ { title:'Componente', key:'nombre' }, { title:'Stock', key:'stock' }, { title:'Consumo diario', key:'diario' },
                  { title:'Días hasta mínimo', key:'diasHastaMin' }, { title:'A comprar', key:'comprar' }, { title:'Costo estimado', key:'costo' } ]"
                no-data-text="Sin compras proyectadas" :items-per-page="20">
                <template v-slot:item.diario="{ item }">{{ item.diario.toFixed(2) }}</template>
                <template v-slot:item.diasHastaMin="{ item }">
                  <v-chip v-if="item.urgente" size="small" color="error">{{ item.diasHastaMin }} días</v-chip>
                  <span v-else>{{ item.diasHastaMin }}</span>
                </template>
                <template v-slot:item.costo="{ item }">{{ money(item.costo) }}</template>
              </v-data-table>

              <!-- Costo promedio por intervención -->
              <v-data-table v-else :items="repCostoIntervencion" class="elevation-0"
                :headers="[ { title:'Tipo', key:'tipo' }, { title:'Intervenciones', key:'n' }, { title:'Prom. materiales', key:'promMat' },
                  { title:'Prom. mano obra', key:'promMo' }, { title:'Prom. total', key:'promTotal' }, { title:'Prom. margen', key:'promMargen' } ]"
                no-data-text="Sin datos" :items-per-page="20">
                <template v-slot:item.promMat="{ item }">{{ money(item.promMat) }}</template>
                <template v-slot:item.promMo="{ item }">{{ money(item.promMo) }}</template>
                <template v-slot:item.promTotal="{ item }">{{ money(item.promTotal) }}</template>
                <template v-slot:item.promMargen="{ item }">{{ money(item.promMargen) }}</template>
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
import FormsCompanyPanel from '@/components/Forms/FormsCompanyPanel.vue'

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
  { id: 'dashboard',    label: 'Dashboard',    icon: 'mdi-view-dashboard' },
  { id: 'calendario',   label: 'Calendario',   icon: 'mdi-calendar' },
  { id: 'clientes',     label: 'Clientes',     icon: 'mdi-account-group' },
  { id: 'leads',        label: 'Leads',        icon: 'mdi-account-search' },
  { id: 'formularios',  label: 'Formularios',  icon: 'mdi-form-select' },
]
const inventarioItems = [
  { id: 'inventario',           label: 'Inventario',           icon: 'mdi-warehouse' },
  { id: 'componentes',          label: 'Componentes',          icon: 'mdi-package-variant-closed' },
  { id: 'recetas',              label: 'Recetas',              icon: 'mdi-file-document-multiple' },
  { id: 'movimientos',          label: 'Movimientos',          icon: 'mdi-swap-vertical-bold' },
  { id: 'costos-intervenciones', label: 'Costos Intervención', icon: 'mdi-calculator-variant' },
  { id: 'reportes',             label: 'Reportes',             icon: 'mdi-chart-box' },
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

// ── Clientes · Edificios (gatwick_edificios) ─────────────────────────────────
const edificios = ref([])
const searchEdificios = ref('')
const loadingEdificios = ref(false)

// Tipos de ascensor y su prefijo de código (AP-0001, MV-0001, ...)
const TIPOS_ASCENSOR = [
  { tipo: 'Ascensor de Pasajeros',          prefijo: 'AP' },
  { tipo: 'Montavehículo',                  prefijo: 'MV' },
  { tipo: 'Plataforma para Discapacitados', prefijo: 'PD' },
  { tipo: 'Montacargas',                    prefijo: 'MC' },
  { tipo: 'Monta Platos',                   prefijo: 'MP' },
]
function prefijoDeTipo(tipo) {
  return TIPOS_ASCENSOR.find(t => t.tipo === tipo)?.prefijo || 'AS'
}

const headersEdificios = [
  { title: 'ELME', key: 'elme', width: 90 },
  { title: 'Nombre', key: 'nombre' },
  { title: 'Dirección', key: 'direccion' },
  { title: 'Distrito', key: 'distrito' },
  { title: 'Ascensores', key: 'equipos', sortable: false },
  { title: 'Activo', key: 'activo', width: 100 },
  { title: '', key: 'acciones', sortable: false, width: 110 },
]
const headersEdificiosMini = [
  { title: 'ELME', key: 'elme' },
  { title: 'Nombre', key: 'nombre' },
  { title: 'Distrito', key: 'distrito' },
  { title: 'Ascensores', key: 'equipos', sortable: false },
]

const edificiosFiltrados = computed(() => {
  if (!searchEdificios.value) return edificios.value
  const q = searchEdificios.value.toLowerCase()
  return edificios.value.filter(e =>
    [e.elme, e.nombre, e.direccion, e.distrito].some(v => String(v ?? '').toLowerCase().includes(q)) ||
    (e.equipos || []).some(a => `${a?.codigo ?? ''} ${a?.tipo ?? ''}`.toLowerCase().includes(q))
  )
})

const ascensoresSinCodigo = computed(() =>
  edificios.value.reduce((n, e) => n + (e.equipos || []).filter(a => !a?.codigo).length, 0)
)

async function fetchEdificios() {
  loadingEdificios.value = true
  const { data, error } = await client
    .from('gatwick_edificios')
    .select('id, elme, nombre, direccion, distrito, equipos, activo')
    .order('nombre', { ascending: true })
  if (error) notify('Error cargando edificios: ' + error.message, 'error')
  edificios.value = (data || []).map(e => ({ ...e, equipos: Array.isArray(e.equipos) ? e.equipos : [] }))
  loadingEdificios.value = false
}

// Siguiente código libre para un prefijo (nunca reutiliza números ya usados)
function siguienteCodigo(prefijo, extra = []) {
  let max = 0
  const re = new RegExp('^' + prefijo + '-(\\d+)$')
  const scan = (arr) => {
    for (const a of (arr || [])) {
      const m = String(a?.codigo || '').match(re)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
  }
  for (const e of edificios.value) scan(e.equipos)
  scan(extra)
  return `${prefijo}-${String(max + 1).padStart(4, '0')}`
}

// ── CRUD edificio ────────────────────────────────────────────────────────────
const showEdificioDialog = ref(false)
const editingEdificio = ref(false)
const edificioForm = ref(null)
const nuevoAscensor = ref({ tipo: 'Ascensor de Pasajeros', paradas: null, variante: '' })

function nuevoEdificio() {
  editingEdificio.value = false
  edificioForm.value = { elme: '', nombre: '', direccion: '', distrito: '', activo: true, es_instalacion_critica: false, equipos: [] }
  nuevoAscensor.value = { tipo: 'Ascensor de Pasajeros', paradas: null, variante: '' }
  showEdificioDialog.value = true
}
function editarEdificio(e) {
  editingEdificio.value = true
  edificioForm.value = {
    id: e.id, elme: e.elme || '', nombre: e.nombre || '', direccion: e.direccion || '',
    distrito: e.distrito || '', activo: e.activo !== false, es_instalacion_critica: !!e.es_instalacion_critica,
    equipos: (e.equipos || []).map(a => ({ ...a })),
  }
  nuevoAscensor.value = { tipo: 'Ascensor de Pasajeros', paradas: null, variante: '' }
  showEdificioDialog.value = true
}
function agregarAscensor() {
  if (!edificioForm.value) return
  const tipo = nuevoAscensor.value.tipo
  const codigo = siguienteCodigo(prefijoDeTipo(tipo), edificioForm.value.equipos)
  edificioForm.value.equipos.push({
    codigo, tipo,
    paradas: nuevoAscensor.value.paradas ? Number(nuevoAscensor.value.paradas) : null,
    variante: nuevoAscensor.value.variante?.trim() || null,
  })
  nuevoAscensor.value = { tipo: 'Ascensor de Pasajeros', paradas: null, variante: '' }
}
function quitarAscensor(idx) {
  edificioForm.value?.equipos.splice(idx, 1)
}

async function guardarEdificio() {
  const f = edificioForm.value
  if (!f) return
  if (!f.nombre?.trim()) { notify('El nombre es obligatorio', 'error'); return }
  // Garantiza código coherente con el tipo y sin duplicados
  const usados = new Set()
  for (const a of f.equipos) {
    const prefijo = prefijoDeTipo(a.tipo)
    const okPrefix = new RegExp('^' + prefijo + '-\\d+$').test(a.codigo || '')
    if (!a.codigo || !okPrefix || usados.has(a.codigo)) {
      a.codigo = siguienteCodigo(prefijo, f.equipos.filter(x => x !== a))
    }
    a.paradas = a.paradas ? Number(a.paradas) : null
    a.variante = a.variante ? String(a.variante).trim() : null
    usados.add(a.codigo)
  }
  const payload = {
    elme: f.elme?.trim() || null,
    nombre: f.nombre.trim(),
    direccion: f.direccion?.trim() || null,
    distrito: f.distrito?.trim() || null,
    activo: f.activo !== false,
    es_instalacion_critica: !!f.es_instalacion_critica,
    equipos: f.equipos,
    updated_at: new Date().toISOString(),
  }
  let error
  if (editingEdificio.value && f.id) {
    ({ error } = await client.from('gatwick_edificios').update(payload).eq('id', f.id))
  } else {
    ({ error } = await client.from('gatwick_edificios').insert(payload))
  }
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify(editingEdificio.value ? 'Edificio actualizado' : 'Edificio creado')
  showEdificioDialog.value = false
  await fetchEdificios()
}

const showDeleteEdificio = ref(false)
const edificioAEliminar = ref(null)
function confirmarEliminarEdificio(e) { edificioAEliminar.value = e; showDeleteEdificio.value = true }
async function eliminarEdificio() {
  const e = edificioAEliminar.value
  if (!e?.id) return
  const { error } = await client.from('gatwick_edificios').delete().eq('id', e.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Edificio eliminado')
  showDeleteEdificio.value = false
  edificioAEliminar.value = null
  await fetchEdificios()
}

// Backfill: asigna código a los ascensores existentes que aún no lo tengan
async function generarCodigosFaltantes() {
  const contadores = {}
  const reAny = /^([A-Z]{2})-(\d+)$/
  for (const e of edificios.value) {
    for (const a of (e.equipos || [])) {
      const m = String(a?.codigo || '').match(reAny)
      if (m) contadores[m[1]] = Math.max(contadores[m[1]] || 0, parseInt(m[2], 10))
    }
  }
  const modificados = []
  for (const e of edificios.value) {
    let cambio = false
    const equipos = (e.equipos || []).map(a => {
      if (a?.codigo) return a
      const prefijo = prefijoDeTipo(a?.tipo)
      contadores[prefijo] = (contadores[prefijo] || 0) + 1
      cambio = true
      return { ...a, codigo: `${prefijo}-${String(contadores[prefijo]).padStart(4, '0')}` }
    })
    if (cambio) modificados.push({ id: e.id, equipos })
  }
  if (!modificados.length) { notify('Todos los ascensores ya tienen código'); return }
  for (const m of modificados) {
    await client.from('gatwick_edificios').update({ equipos: m.equipos, updated_at: new Date().toISOString() }).eq('id', m.id)
  }
  notify(`Códigos asignados en ${modificados.length} edificio(s)`)
  await fetchEdificios()
}

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
  fetchSeguimientos()
}

/* ── Seguimiento GPS de técnicos ───────────────────────────────────────────
   El técnico toca "Comenzar": se crea el seguimiento, se avisa a los
   supervisores por WhatsApp y se devuelven los dos links (técnico y monitoreo). */
const seguimientos = ref([])
const showComenzar = ref(false)
const showSegCreado = ref(false)
const emergComenzar = ref(null)
const segCreado = ref(null)
const iniciandoSeg = ref(null)
const comenzarForm = ref({ codigo_ascensor: '', tecnico_id: null, tecnico_nombre: '', tecnico_telefono: '' })

const ESTADO_SEG = {
  iniciado: 'Asignada', en_camino: 'En camino', atendiendo: 'En sitio',
  finalizada: 'Finalizada', cancelada: 'Cancelada',
}

const tecnicosSelect = computed(() => tecnicos.value.map(t => ({
  id: t.id, label: `${[t.nombre, t.apellido].filter(Boolean).join(' ')}${t.zona ? ' · ' + t.zona : ''}${t.estado === 'en_servicio' ? ' (en servicio)' : ''}`,
})))

/** Seguimiento ACTIVO de una emergencia (o null). */
function seguimientoDe(emergenciaId) {
  return seguimientos.value.find(s => s.emergencia_id === emergenciaId
    && ['iniciado', 'en_camino', 'atendiendo'].includes(s.estado)) || null
}

async function fetchSeguimientos() {
  const { data } = await client.from('gatwick_seguimientos')
    .select('id, emergencia_id, token, estado, tecnico_nombre, distancia_destino_m, eta_segundos, ultimo_ping')
    .order('created_at', { ascending: false }).limit(200)
  seguimientos.value = data || []
}

function abrirComenzar(emerg) {
  emergComenzar.value = emerg
  comenzarForm.value = {
    codigo_ascensor: emerg.codigo_ascensor || '',
    tecnico_id: emerg.tecnico_id || null,
    tecnico_nombre: '', tecnico_telefono: '',
  }
  showComenzar.value = true
}

async function comenzarEmergencia() {
  const emerg = emergComenzar.value
  if (!emerg) return
  const f = comenzarForm.value
  if (!f.tecnico_id && !f.tecnico_nombre.trim()) {
    notify('Selecciona un técnico o escribe su nombre', 'error'); return
  }
  iniciandoSeg.value = emerg.id
  try {
    const res = await $fetch('/api/gatwick/seguimiento/iniciar', {
      method: 'POST',
      body: {
        emergencia_id: emerg.id,
        codigo_ascensor: f.codigo_ascensor?.trim().toUpperCase() || undefined,
        tecnico_id: f.tecnico_id || undefined,
        tecnico_nombre: f.tecnico_nombre?.trim() || undefined,
        tecnico_telefono: f.tecnico_telefono?.trim() || undefined,
        creado_por: currentUser.value?.email || '',
      },
    })
    segCreado.value = res
    showComenzar.value = false
    showSegCreado.value = true
    notify(res.ya_existia ? 'Esta emergencia ya tenía un seguimiento activo' : 'Seguimiento iniciado · supervisores avisados')
    await Promise.all([fetchEmergencias(), fetchTecnicos()])
  } catch (e) {
    notify(e?.data?.statusMessage || 'No se pudo iniciar el seguimiento', 'error')
  } finally {
    iniciandoSeg.value = null
  }
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

// Materiales utilizados (descuenta stock vía webhook n8n al completar)
const intervMateriales = ref([])              // editor: [{ componente_id, cantidad }]
const intervMaterialesExistentes = ref([])    // ya descontados (de informe_materiales)

const intervMaterialesSubtotal = computed(() =>
  intervMateriales.value.reduce((s, m) => {
    const c = componentes.value.find(x => x.id === m.componente_id)
    return s + (c ? Number(c.precio_unitario || 0) * Number(m.cantidad || 0) : 0)
  }, 0)
)

function agregarMaterialInterv() { intervMateriales.value.push({ componente_id: null, cantidad: 1 }) }
function quitarMaterialInterv(idx) { intervMateriales.value.splice(idx, 1) }

async function cargarMaterialesInforme(numeroInforme) {
  const { data } = await client.from('informe_materiales')
    .select('*, componentes(codigo,nombre,unidad)')
    .eq('numero_informe', String(numeroInforme))
  intervMaterialesExistentes.value = data || []
}

async function descontarStock(numeroInforme, materiales) {
  const payload = {
    numero_informe: String(numeroInforme),
    materiales: materiales
      .filter(m => m.componente_id && Number(m.cantidad) > 0)
      .map(m => ({ componente_id: m.componente_id, cantidad: Number(m.cantidad) })),
    usuario: currentUser.value?.email || 'dashboard',
  }
  if (!payload.materiales.length) return null
  return await $fetch('/api/gatwick/descontar-stock', { method: 'POST', body: payload })
}

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

function openNuevaIntervencion() {
  editingInterv.value = null
  intervForm.value = { tipo_intervencion: 'mantenimiento', estado: 'en_proceso', costo_mano_obra: 0, costo_repuestos: 0 }
  intervMateriales.value = []
  intervMaterialesExistentes.value = []
  showNuevaIntervencion.value = true
}

async function editarIntervencion(item) {
  editingInterv.value = item
  intervForm.value = { ...item }
  intervMateriales.value = []
  intervMaterialesExistentes.value = []
  showNuevaIntervencion.value = true
  await cargarMaterialesInforme(item.id)
}

async function saveIntervencion() {
  savingInterv.value = true
  try {
    const payload = { ...intervForm.value }
    payload.costo_total = Number(payload.costo_mano_obra || 0) + Number(payload.costo_repuestos || 0)
    delete payload.id

    let intervId = editingInterv.value?.id
    if (editingInterv.value) {
      await client.from('gatwick_intervenciones').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingInterv.value.id)
    } else {
      const { data } = await client.from('gatwick_intervenciones').insert(payload).select().single()
      intervId = data?.id
    }

    // Descuento de stock vía n8n: solo si está completada, hay materiales nuevos
    // y aún no se descontaron (guardia anti-doble-descuento).
    const hayMaterialesNuevos = intervMateriales.value.some(m => m.componente_id && Number(m.cantidad) > 0)
    if (intervId && payload.estado === 'completada' && hayMaterialesNuevos && intervMaterialesExistentes.value.length === 0) {
      try {
        const r = await descontarStock(intervId, intervMateriales.value)
        if (r?.success) {
          const alertas = r?.n8n?.alertas_stock || []
          notify('Intervención guardada · stock descontado' + (alertas.length ? ` · ⚠ ${alertas.length} alerta(s)` : ''))
          await Promise.all([fetchComponentes(), fetchMovimientos(), fetchInformeMateriales()])
        } else {
          notify('Intervención guardada, pero el descuento de stock falló: ' + (r?.error || 'revisa el flujo n8n'), 'warning')
        }
      } catch (e) {
        notify('Intervención guardada, pero no se pudo disparar el descuento (¿flujo n8n activo?)', 'warning')
      }
    } else {
      notify('Intervención guardada')
    }

    await fetchIntervenciones()
    showNuevaIntervencion.value = false
    editingInterv.value = null
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

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  MVP INVENTARIO GATWICK — Componentes · Recetas · Movimientos · Costos     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── Catálogos / helpers compartidos ──────────────────────────────────────────
const CATEGORIAS_COMP = ['Cable','Polea','Contacto','Sensor','Fluido','Motor','Tablero','Botonera','Guía','Cabina','Puerta','Otro']
const UNIDADES_COMP = ['Metro','Pieza','Kg','Litro','Unidad','Rollo','Caja','Galón']
const TIPOS_RECETA = ['fabricacion','reparacion','mantenimiento']
const TIPOS_MOV = ['entrada','salida','ajuste','devolucion']

function money(n) { return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function nivelAlerta(c) {
  const a = Number(c?.stock_actual || 0), m = Number(c?.stock_minimo || 0)
  if (a <= m) return 'CRÍTICO'
  if (a <= m * 1.5) return 'BAJO'
  return 'NORMAL'
}
function alertaColor(nivel) { return { 'CRÍTICO': 'error', 'BAJO': 'warning', 'NORMAL': 'success' }[nivel] || 'default' }
function valorStock(c) { return Number(c?.stock_actual || 0) * Number(c?.precio_unitario || 0) }
function csvDownload(filename, rows) {
  const csv = rows.map(r => r.map(v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── COMPONENTES ──────────────────────────────────────────────────────────────
const componentes = ref([])
const searchComp = ref('')
const filterCategoria = ref(null)
const filterEstado = ref(null)
const filterAlerta = ref(null)
const showCompDialog = ref(false)
const compReadonly = ref(false)
const editingComp = ref(null)
const savingComp = ref(false)
const compFileInput = ref(null)
const compForm = ref({})

function emptyComp() {
  return {
    codigo: '', nombre: '', descripcion: '', categoria: null, unidad: null,
    precio_unitario: 0, stock_actual: 0, stock_minimo: 0, stock_maximo: 0,
    proveedor: '', fecha_ultima_compra: '', ubicacion_almacen: '', activo: true, notas: '',
  }
}

const componentesActivos = computed(() => componentes.value.filter(c => c.activo))
const componentesEnAlerta = computed(() =>
  componentesActivos.value.filter(c => nivelAlerta(c) !== 'NORMAL')
    .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual))
)
const componentesEnAlertaCount = computed(() => componentesEnAlerta.value.length)
const valorTotalInventario = computed(() => componentesActivos.value.reduce((s, c) => s + valorStock(c), 0))

const componentesFiltrados = computed(() => {
  let list = componentes.value
  if (searchComp.value) {
    const q = searchComp.value.toLowerCase()
    list = list.filter(c => [c.codigo, c.nombre].some(v => v?.toLowerCase().includes(q)))
  }
  if (filterCategoria.value) list = list.filter(c => c.categoria === filterCategoria.value)
  if (filterEstado.value === 'activo') list = list.filter(c => c.activo)
  if (filterEstado.value === 'inactivo') list = list.filter(c => !c.activo)
  if (filterAlerta.value) list = list.filter(c => nivelAlerta(c) === filterAlerta.value)
  return list
})

const headersComponentes = [
  { title: 'Código', key: 'codigo' },
  { title: 'Nombre', key: 'nombre' },
  { title: 'Categoría', key: 'categoria' },
  { title: 'Stock', key: 'stock_actual' },
  { title: 'Mínimo', key: 'stock_minimo' },
  { title: 'Ubicación', key: 'ubicacion_almacen' },
  { title: 'P. Unit.', key: 'precio_unitario' },
  { title: 'Valor Stock', key: 'valor_stock' },
  { title: 'Estado', key: 'activo' },
  { title: '', key: 'actions', sortable: false },
]

function limpiarFiltrosComp() {
  searchComp.value = ''; filterCategoria.value = null; filterEstado.value = null; filterAlerta.value = null
}

async function fetchComponentes() {
  const { data } = await client.from('componentes').select('*').order('codigo')
  componentes.value = data || []
}

function nuevoComponente() {
  editingComp.value = null; compReadonly.value = false
  compForm.value = emptyComp()
  showCompDialog.value = true
}
function verComponente(item) {
  editingComp.value = item; compReadonly.value = true
  compForm.value = { ...item }
  showCompDialog.value = true
}
function editarComponente(item) {
  editingComp.value = item; compReadonly.value = false
  compForm.value = { ...item }
  showCompDialog.value = true
}

async function saveComponente() {
  const f = compForm.value
  if (!f.codigo || !f.nombre || !f.categoria || !f.unidad) return notify('Completa los campos requeridos (*)', 'warning')
  if (Number(f.precio_unitario) <= 0) return notify('El precio unitario debe ser mayor a 0', 'warning')
  if (Number(f.stock_minimo) >= Number(f.stock_maximo)) return notify('Stock mínimo debe ser menor que stock máximo', 'warning')
  const dup = componentes.value.find(c => c.codigo?.toLowerCase() === f.codigo.toLowerCase() && c.id !== editingComp.value?.id)
  if (dup) return notify('Ya existe un componente con ese código', 'warning')

  savingComp.value = true
  try {
    const payload = {
      codigo: f.codigo.trim(), nombre: f.nombre, descripcion: f.descripcion,
      categoria: f.categoria, unidad: f.unidad,
      precio_unitario: Number(f.precio_unitario), stock_actual: Number(f.stock_actual || 0),
      stock_minimo: Number(f.stock_minimo), stock_maximo: Number(f.stock_maximo),
      proveedor: f.proveedor, fecha_ultima_compra: f.fecha_ultima_compra || null,
      ubicacion_almacen: f.ubicacion_almacen, activo: f.activo !== false, notas: f.notas,
      updated_at: new Date().toISOString(),
    }
    if (editingComp.value) {
      await client.from('componentes').update(payload).eq('id', editingComp.value.id)
    } else {
      await client.from('componentes').insert(payload)
    }
    await fetchComponentes()
    showCompDialog.value = false; editingComp.value = null
    notify('Componente guardado')
  } catch (e) {
    notify('Error al guardar: ' + (e?.message || ''), 'error')
  } finally {
    savingComp.value = false
  }
}

async function eliminarComponente(item) {
  if (!confirm(`¿Desactivar el componente "${item.nombre}"? (soft delete)`)) return
  await client.from('componentes').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', item.id)
  await fetchComponentes()
  notify('Componente desactivado')
}

function triggerCompCsv() { compFileInput.value?.click() }
async function importarComponentesCsv(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    const header = lines.shift().split(',').map(h => h.trim().toLowerCase())
    const idx = (k) => header.indexOf(k)
    const rows = lines.map(l => l.split(',')).map(cols => ({
      codigo: cols[idx('codigo')]?.trim(),
      nombre: cols[idx('nombre')]?.trim(),
      categoria: cols[idx('categoria')]?.trim() || 'Otro',
      unidad: cols[idx('unidad')]?.trim() || 'Unidad',
      precio_unitario: Number(cols[idx('precio_unitario')] || 0),
      stock_actual: Number(cols[idx('stock_actual')] || 0),
      stock_minimo: Number(cols[idx('stock_minimo')] || 0),
      stock_maximo: Number(cols[idx('stock_maximo')] || 1),
    })).filter(r => r.codigo && r.nombre)
    if (!rows.length) return notify('CSV vacío o sin filas válidas', 'warning')
    const { error } = await client.from('componentes').upsert(rows, { onConflict: 'codigo' })
    if (error) throw error
    await fetchComponentes()
    notify(`${rows.length} componentes importados`)
  } catch (e) {
    notify('Error importando CSV: ' + (e?.message || ''), 'error')
  } finally {
    ev.target.value = ''
  }
}

// ── RECETAS ──────────────────────────────────────────────────────────────────
const recetas = ref([])
const recetasDetalle = ref([])
const searchReceta = ref('')
const filterTipoReceta = ref(null)
const filterEstadoReceta = ref(null)
const showRecetaDialog = ref(false)
const editingReceta = ref(null)
const savingReceta = ref(false)
const recetaForm = ref({})
const nuevoDetalle = ref({ componente_id: null, cantidad: 1 })

function emptyReceta() {
  return { codigo: '', nombre: '', descripcion: '', tipo: 'reparacion', tiempo_fabricacion_minutos: 0, margen_sugerido: 40, activo: true, notas: '' }
}

function detallesDeReceta(recetaId) {
  return recetasDetalle.value.filter(d => d.receta_id === recetaId)
}
function costoReceta(recetaId) {
  return detallesDeReceta(recetaId).reduce((s, d) => s + Number(d.costo_subtotal || 0), 0)
}
function precioVentaReceta(r) {
  return costoReceta(r.id) * (1 + Number(r.margen_sugerido || 0) / 100)
}

const recetasFiltradas = computed(() => {
  let list = recetas.value
  if (searchReceta.value) {
    const q = searchReceta.value.toLowerCase()
    list = list.filter(r => [r.codigo, r.nombre].some(v => v?.toLowerCase().includes(q)))
  }
  if (filterTipoReceta.value) list = list.filter(r => r.tipo === filterTipoReceta.value)
  if (filterEstadoReceta.value === 'activo') list = list.filter(r => r.activo)
  if (filterEstadoReceta.value === 'inactivo') list = list.filter(r => !r.activo)
  return list
})

const resumenRecetas = computed(() => {
  const activas = recetas.value.filter(r => r.activo)
  const costos = activas.map(r => costoReceta(r.id))
  const total = activas.length
  const prom = total ? costos.reduce((a, b) => a + b, 0) / total : 0
  let maxR = null, minR = null, maxC = -1, minC = Infinity
  activas.forEach(r => { const c = costoReceta(r.id); if (c > maxC) { maxC = c; maxR = r } if (c < minC) { minC = c; minR = r } })
  return { total, prom, maxR, maxC: maxC < 0 ? 0 : maxC, minR, minC: minC === Infinity ? 0 : minC }
})

const headersRecetas = [
  { title: 'Código', key: 'codigo' },
  { title: 'Nombre', key: 'nombre' },
  { title: 'Tipo', key: 'tipo' },
  { title: 'Componentes', key: 'n_comp' },
  { title: 'Costo Mat.', key: 'costo' },
  { title: 'Margen', key: 'margen_sugerido' },
  { title: 'P. Venta', key: 'p_venta' },
  { title: 'Estado', key: 'activo' },
  { title: '', key: 'actions', sortable: false },
]

const componenteSelectItems = computed(() =>
  componentesActivos.value.map(c => ({ id: c.id, label: `${c.codigo} · ${c.nombre} (${money(c.precio_unitario)})`, raw: c }))
)

async function fetchRecetas() {
  const [{ data: r }, { data: d }] = await Promise.all([
    client.from('recetas').select('*').order('nombre'),
    client.from('recetas_detalle').select('*, componentes(codigo,nombre,unidad,precio_unitario)').order('orden'),
  ])
  recetas.value = r || []
  recetasDetalle.value = d || []
}

function nuevaReceta() {
  editingReceta.value = null
  recetaForm.value = emptyReceta()
  nuevoDetalle.value = { componente_id: null, cantidad: 1 }
  showRecetaDialog.value = true
}
function abrirReceta(r) {
  editingReceta.value = r
  recetaForm.value = { ...r }
  nuevoDetalle.value = { componente_id: null, cantidad: 1 }
  showRecetaDialog.value = true
}

async function saveReceta() {
  const f = recetaForm.value
  if (!f.codigo || !f.nombre || !f.tipo) return notify('Completa código, nombre y tipo', 'warning')
  if (Number(f.margen_sugerido) < 0 || Number(f.margen_sugerido) > 100) return notify('Margen debe estar entre 0 y 100', 'warning')
  const dup = recetas.value.find(r => r.codigo?.toLowerCase() === f.codigo.toLowerCase() && r.id !== editingReceta.value?.id)
  if (dup) return notify('Ya existe una receta con ese código', 'warning')
  savingReceta.value = true
  try {
    const payload = {
      codigo: f.codigo.trim(), nombre: f.nombre, descripcion: f.descripcion, tipo: f.tipo,
      tiempo_fabricacion_minutos: Number(f.tiempo_fabricacion_minutos || 0),
      margen_sugerido: Number(f.margen_sugerido || 0), activo: f.activo !== false, notas: f.notas,
      updated_at: new Date().toISOString(),
    }
    if (editingReceta.value) {
      await client.from('recetas').update(payload).eq('id', editingReceta.value.id)
    } else {
      const { data } = await client.from('recetas').insert(payload).select().single()
      editingReceta.value = data  // permite agregar componentes de inmediato
    }
    await fetchRecetas()
    if (editingReceta.value) editingReceta.value = recetas.value.find(r => r.id === editingReceta.value.id) || editingReceta.value
    notify('Receta guardada')
  } catch (e) {
    notify('Error al guardar: ' + (e?.message || ''), 'error')
  } finally {
    savingReceta.value = false
  }
}

async function agregarComponenteAReceta() {
  if (!editingReceta.value?.id) return notify('Primero guarda la receta', 'warning')
  const nd = nuevoDetalle.value
  if (!nd.componente_id || Number(nd.cantidad) <= 0) return notify('Selecciona componente y cantidad > 0', 'warning')
  const comp = componentes.value.find(c => c.id === nd.componente_id)
  try {
    await client.from('recetas_detalle').insert({
      receta_id: editingReceta.value.id,
      componente_id: nd.componente_id,
      cantidad: Number(nd.cantidad),
      precio_unitario_en_receta: Number(comp?.precio_unitario || 0),
      orden: detallesDeReceta(editingReceta.value.id).length + 1,
    })
    await fetchRecetas()
    nuevoDetalle.value = { componente_id: null, cantidad: 1 }
    notify('Componente agregado')
  } catch (e) {
    notify('Error: ' + (e?.message || ''), 'error')
  }
}

async function quitarDetalleReceta(detalleId) {
  await client.from('recetas_detalle').delete().eq('id', detalleId)
  await fetchRecetas()
  notify('Componente eliminado de la receta')
}

async function duplicarReceta(r) {
  try {
    const base = r || editingReceta.value
    if (!base) return
    let nuevoCodigo = base.codigo + '-COPIA'
    let n = 2
    while (recetas.value.some(x => x.codigo === nuevoCodigo)) { nuevoCodigo = base.codigo + '-COPIA' + n; n++ }
    const { data: nueva } = await client.from('recetas').insert({
      codigo: nuevoCodigo, nombre: base.nombre + ' (copia)', descripcion: base.descripcion,
      tipo: base.tipo, tiempo_fabricacion_minutos: base.tiempo_fabricacion_minutos,
      margen_sugerido: base.margen_sugerido, activo: true, notas: base.notas,
    }).select().single()
    const dets = detallesDeReceta(base.id)
    if (dets.length) {
      await client.from('recetas_detalle').insert(dets.map(d => ({
        receta_id: nueva.id, componente_id: d.componente_id, cantidad: d.cantidad,
        precio_unitario_en_receta: d.precio_unitario_en_receta, orden: d.orden,
      })))
    }
    await fetchRecetas()
    notify('Receta duplicada: ' + nuevoCodigo)
  } catch (e) {
    notify('Error al duplicar: ' + (e?.message || ''), 'error')
  }
}

async function eliminarReceta(r) {
  const base = r || editingReceta.value
  if (!base) return
  if (!confirm(`¿Eliminar la receta "${base.nombre}" y todos sus componentes?`)) return
  await client.from('recetas').delete().eq('id', base.id)
  await fetchRecetas()
  showRecetaDialog.value = false
  notify('Receta eliminada')
}

function descargarRecetario() {
  const rows = []
  recetas.value.filter(r => r.activo).forEach(r => {
    rows.push(['RECETA', r.codigo, r.nombre, r.tipo, 'Margen ' + r.margen_sugerido + '%'])
    detallesDeReceta(r.id).forEach(d => {
      rows.push(['', d.componentes?.codigo || '', d.componentes?.nombre || '', d.cantidad + ' ' + (d.componentes?.unidad || ''), money(d.costo_subtotal)])
    })
    rows.push(['', '', '', 'Costo materiales', money(costoReceta(r.id))])
    rows.push(['', '', '', 'Precio venta sugerido', money(precioVentaReceta(r))])
    rows.push([])
  })
  csvDownload('recetario_gatwick.csv', rows)
  notify('Recetario descargado')
}

// ── MOVIMIENTOS ──────────────────────────────────────────────────────────────
const movimientos = ref([])
const movFechaDesde = ref('')
const movFechaHasta = ref('')
const filterTipoMov = ref(null)
const searchMovComp = ref('')
const searchMotivo = ref('')
const filterUsuarioMov = ref(null)
const showMovDialog = ref(false)
const savingMov = ref(false)
const movForm = ref({})

function emptyMov() {
  return { componente_id: null, tipo_movimiento: 'entrada', cantidad: 1, motivo: '', costo_unitario: 0, numero_informe: '', numero_receta: '', numero_compra: '', proveedor: '' }
}

const movSelComponente = computed(() => componentes.value.find(c => c.id === movForm.value.componente_id) || null)
const movCostoTotal = computed(() => Number(movForm.value.cantidad || 0) * Number(movForm.value.costo_unitario || 0))

const usuariosMov = computed(() => [...new Set(movimientos.value.map(m => m.usuario_registra).filter(Boolean))])

const movimientosFiltrados = computed(() => {
  let list = movimientos.value
  if (movFechaDesde.value) list = list.filter(m => (m.fecha_movimiento || '') >= movFechaDesde.value)
  if (movFechaHasta.value) list = list.filter(m => (m.fecha_movimiento || '') <= movFechaHasta.value + 'T23:59:59')
  if (filterTipoMov.value) list = list.filter(m => m.tipo_movimiento === filterTipoMov.value)
  if (searchMovComp.value) {
    const q = searchMovComp.value.toLowerCase()
    list = list.filter(m => [m.componentes?.codigo, m.componentes?.nombre].some(v => v?.toLowerCase().includes(q)))
  }
  if (searchMotivo.value) {
    const q = searchMotivo.value.toLowerCase()
    list = list.filter(m => m.motivo?.toLowerCase().includes(q))
  }
  if (filterUsuarioMov.value) list = list.filter(m => m.usuario_registra === filterUsuarioMov.value)
  return list
})

const headersMovimientos = [
  { title: 'Fecha', key: 'fecha_movimiento' },
  { title: 'Componente', key: 'componente' },
  { title: 'Tipo', key: 'tipo_movimiento' },
  { title: 'Cant.', key: 'cantidad' },
  { title: 'Stock Ant.', key: 'stock_anterior' },
  { title: 'Stock Nuevo', key: 'stock_nuevo' },
  { title: 'Motivo', key: 'motivo' },
  { title: 'Costo', key: 'costo_total' },
  { title: 'Usuario', key: 'usuario_registra' },
  { title: '', key: 'actions', sortable: false },
]

function movTipoColor(t) { return { entrada: 'success', salida: 'error', ajuste: 'warning', devolucion: 'info' }[t] || 'default' }

function defaultRangoMov() {
  const hoy = new Date()
  const hace30 = new Date(); hace30.setDate(hoy.getDate() - 30)
  movFechaDesde.value = formatDateISO(hace30)
  movFechaHasta.value = formatDateISO(hoy)
}

async function fetchMovimientos() {
  const { data } = await client.from('movimientos_inventario')
    .select('*, componentes(codigo,nombre)')
    .order('fecha_movimiento', { ascending: false })
  movimientos.value = data || []
}

function nuevoMovimiento(preCompId = null) {
  movForm.value = emptyMov()
  if (preCompId) movForm.value.componente_id = preCompId
  showMovDialog.value = true
}

function calcularStockNuevo(comp, tipo, cantidad) {
  const ant = Number(comp?.stock_actual || 0)
  const c = Number(cantidad || 0)
  if (tipo === 'entrada' || tipo === 'devolucion') return ant + c
  if (tipo === 'salida') return ant - c
  if (tipo === 'ajuste') return c   // ajuste = stock absoluto corregido
  return ant
}

async function registrarMovimiento() {
  const f = movForm.value
  const comp = movSelComponente.value
  if (!comp) return notify('Selecciona un componente', 'warning')
  if (Number(f.cantidad) <= 0) return notify('La cantidad debe ser mayor a 0', 'warning')
  if (['salida'].includes(f.tipo_movimiento) && !f.motivo) return notify('El motivo es requerido para salidas', 'warning')
  if (f.tipo_movimiento === 'entrada' && Number(f.costo_unitario) <= 0) return notify('Costo unitario requerido para entradas', 'warning')

  const stockAnterior = Number(comp.stock_actual || 0)
  const stockNuevo = calcularStockNuevo(comp, f.tipo_movimiento, f.cantidad)
  if (stockNuevo < 0) return notify(`Stock insuficiente: hay ${stockAnterior}, intentas sacar ${f.cantidad}`, 'error')

  savingMov.value = true
  try {
    const costoUnit = f.tipo_movimiento === 'salida' ? Number(comp.precio_unitario || 0) : Number(f.costo_unitario || 0)
    await client.from('movimientos_inventario').insert({
      componente_id: comp.id,
      tipo_movimiento: f.tipo_movimiento,
      cantidad: Number(f.cantidad),
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      motivo: f.motivo,
      costo_unitario: costoUnit,
      costo_total: Number(f.cantidad) * costoUnit,
      numero_informe: f.numero_informe || null,
      numero_receta: f.numero_receta || null,
      numero_compra: f.numero_compra || null,
      proveedor: f.proveedor || null,
      usuario_registra: currentUser.value?.email || 'sistema',
      fecha_movimiento: new Date().toISOString(),
    })
    await client.from('componentes').update({ stock_actual: stockNuevo, updated_at: new Date().toISOString() }).eq('id', comp.id)
    await Promise.all([fetchMovimientos(), fetchComponentes()])
    showMovDialog.value = false
    if (stockNuevo < Number(comp.stock_minimo)) notify(`Movimiento registrado · ⚠ ${comp.nombre} quedó BAJO mínimo (${stockNuevo}/${comp.stock_minimo})`, 'warning')
    else notify('Movimiento registrado')
  } catch (e) {
    notify('Error: ' + (e?.message || ''), 'error')
  } finally {
    savingMov.value = false
  }
}

async function deshacerMovimiento(m) {
  if (!confirm('¿Deshacer este movimiento? Se creará un movimiento inverso que revierte el stock.')) return
  const comp = componentes.value.find(c => c.id === m.componente_id)
  if (!comp) return notify('Componente no encontrado', 'error')
  const stockAnterior = Number(comp.stock_actual || 0)
  const stockNuevo = Number(m.stock_anterior || 0)  // revertir al estado previo del mov original
  const delta = Math.abs(stockNuevo - stockAnterior)
  if (delta === 0) return notify('Nada que revertir', 'warning')
  try {
    await client.from('movimientos_inventario').insert({
      componente_id: comp.id,
      tipo_movimiento: 'ajuste',
      cantidad: delta,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      motivo: `Deshacer movimiento de ${m.tipo_movimiento} (${formatDateTime(m.fecha_movimiento)})`,
      costo_unitario: 0, costo_total: 0,
      usuario_registra: currentUser.value?.email || 'sistema',
      fecha_movimiento: new Date().toISOString(),
    })
    await client.from('componentes').update({ stock_actual: stockNuevo, updated_at: new Date().toISOString() }).eq('id', comp.id)
    await Promise.all([fetchMovimientos(), fetchComponentes()])
    notify('Movimiento deshecho')
  } catch (e) {
    notify('Error: ' + (e?.message || ''), 'error')
  }
}

function exportarMovimientos() {
  const rows = [['Fecha', 'Codigo', 'Componente', 'Tipo', 'Cantidad', 'Stock Ant.', 'Stock Nuevo', 'Motivo', 'Costo Total', 'Usuario']]
  movimientosFiltrados.value.forEach(m => rows.push([
    formatDateTime(m.fecha_movimiento), m.componentes?.codigo, m.componentes?.nombre, m.tipo_movimiento,
    m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo, Number(m.costo_total || 0).toFixed(2), m.usuario_registra,
  ]))
  csvDownload('movimientos_gatwick.csv', rows)
  notify('Histórico exportado')
}

// ── COSTOS POR INTERVENCIÓN (enlaza gatwick_intervenciones + informe_materiales)
const informeMateriales = ref([])
const costoFechaDesde = ref('')
const costoFechaHasta = ref('')
const searchInforme = ref('')
const searchClienteCosto = ref('')
const showCostoDetalle = ref(false)
const intervSeleccionada = ref(null)

async function fetchInformeMateriales() {
  const { data } = await client.from('informe_materiales')
    .select('*, componentes(codigo,nombre,unidad)')
    .order('created_at', { ascending: false })
  informeMateriales.value = data || []
}

function materialesDeInforme(numeroInforme) {
  return informeMateriales.value.filter(im => String(im.numero_informe) === String(numeroInforme))
}
function costoMaterialesInforme(numeroInforme) {
  return materialesDeInforme(numeroInforme).reduce((s, im) => s + Number(im.costo_total || 0), 0)
}

const costosIntervencion = computed(() => {
  let list = intervenciones.value.map(i => {
    const costoMat = costoMaterialesInforme(i.id)
    const manoObra = Number(i.costo_mano_obra || 0)
    const costoTotal = costoMat + manoObra
    const cobrado = Number(i.costo_total || 0)
    return {
      ...i, _costoMat: costoMat, _manoObra: manoObra, _costoTotal: costoTotal,
      _cobrado: cobrado, _margen: cobrado - costoTotal,
    }
  })
  if (costoFechaDesde.value) list = list.filter(i => (i.fecha_inicio || i.created_at || '') >= costoFechaDesde.value)
  if (costoFechaHasta.value) list = list.filter(i => (i.fecha_inicio || i.created_at || '') <= costoFechaHasta.value + 'T23:59:59')
  if (searchInforme.value) list = list.filter(i => String(i.id).includes(searchInforme.value.trim()))
  if (searchClienteCosto.value) {
    const q = searchClienteCosto.value.toLowerCase()
    list = list.filter(i => [i.empresa_cliente, i.direccion].some(v => v?.toLowerCase().includes(q)))
  }
  return list
})

const headersCostos = [
  { title: 'N° Informe', key: 'id' },
  { title: 'Fecha', key: 'fecha_inicio' },
  { title: 'Cliente / Edificio', key: 'empresa_cliente' },
  { title: 'Tipo', key: 'tipo_intervencion' },
  { title: 'Materiales', key: '_costoMat' },
  { title: 'Mano Obra', key: '_manoObra' },
  { title: 'Costo Total', key: '_costoTotal' },
  { title: 'Margen', key: '_margen' },
  { title: '', key: 'actions', sortable: false },
]

function verCostoIntervencion(item) {
  intervSeleccionada.value = item
  showCostoDetalle.value = true
}

// ── REPORTES ─────────────────────────────────────────────────────────────────
const reporteTipo = ref('consumo_componente')
const reporteTipos = [
  { value: 'consumo_componente', label: 'Consumo por componente' },
  { value: 'consumo_categoria',  label: 'Consumo por categoría' },
  { value: 'rotacion',           label: 'Rotación de inventario' },
  { value: 'proyeccion',         label: 'Proyección de compras' },
  { value: 'costo_intervencion', label: 'Costo promedio por intervención' },
]

const salidas30 = computed(() => {
  const limite = new Date(); limite.setDate(limite.getDate() - 30)
  const lim = limite.toISOString()
  return movimientos.value.filter(m => m.tipo_movimiento === 'salida' && (m.fecha_movimiento || '') >= lim)
})

const repConsumoComponente = computed(() => {
  const map = {}
  salidas30.value.forEach(m => {
    const c = componentes.value.find(x => x.id === m.componente_id)
    if (!c) return
    if (!map[c.id]) map[c.id] = { codigo: c.codigo, nombre: c.nombre, cantidad: 0, costo: 0, freq: 0 }
    map[c.id].cantidad += Number(m.cantidad || 0)
    map[c.id].costo += Number(m.costo_total || 0)
    map[c.id].freq += 1
  })
  return Object.values(map).map(r => ({ ...r, proyeccion60: r.cantidad * 2 })).sort((a, b) => b.cantidad - a.cantidad)
})

const repConsumoCategoria = computed(() => {
  const map = {}
  salidas30.value.forEach(m => {
    const c = componentes.value.find(x => x.id === m.componente_id)
    if (!c) return
    const cat = c.categoria || 'Otro'
    if (!map[cat]) map[cat] = { categoria: cat, cantidad: 0, costo: 0 }
    map[cat].cantidad += Number(m.cantidad || 0)
    map[cat].costo += Number(m.costo_total || 0)
  })
  return Object.values(map).sort((a, b) => b.costo - a.costo)
})

const repRotacion = computed(() => {
  const consumoPorComp = {}
  salidas30.value.forEach(m => { consumoPorComp[m.componente_id] = (consumoPorComp[m.componente_id] || 0) + Number(m.cantidad || 0) })
  return componentesActivos.value.map(c => {
    const consumo = consumoPorComp[c.id] || 0
    const stock = Number(c.stock_actual || 0)
    const rot = stock > 0 ? consumo / stock : (consumo > 0 ? 99 : 0)
    const interp = rot >= 1 ? 'Alto' : rot >= 0.3 ? 'Normal' : 'Lento'
    return { codigo: c.codigo, nombre: c.nombre, stock, consumo, rotacion: rot, interpretacion: interp, valor: valorStock(c) }
  }).sort((a, b) => b.rotacion - a.rotacion)
})

const repProyeccion = computed(() => {
  const consumoPorComp = {}
  salidas30.value.forEach(m => { consumoPorComp[m.componente_id] = (consumoPorComp[m.componente_id] || 0) + Number(m.cantidad || 0) })
  return componentesActivos.value.map(c => {
    const consumo = consumoPorComp[c.id] || 0
    const diario = consumo / 30
    const stock = Number(c.stock_actual || 0)
    const diasHastaMin = diario > 0 ? Math.max(0, (stock - Number(c.stock_minimo || 0)) / diario) : Infinity
    const comprar = Math.max(0, Number(c.stock_maximo || 0) - stock)
    return {
      codigo: c.codigo, nombre: c.nombre, stock, diario: diario,
      diasHastaMin: diasHastaMin === Infinity ? '∞' : Math.round(diasHastaMin),
      comprar, costo: comprar * Number(c.precio_unitario || 0),
      urgente: diasHastaMin !== Infinity && diasHastaMin <= 14,
    }
  }).filter(r => r.comprar > 0).sort((a, b) => (a.diasHastaMin === '∞' ? 1 : b.diasHastaMin === '∞' ? -1 : a.diasHastaMin - b.diasHastaMin))
})

const repCostoIntervencion = computed(() => {
  const map = {}
  costosIntervencion.value.forEach(i => {
    const tipo = i.tipo_intervencion || 'otro'
    if (!map[tipo]) map[tipo] = { tipo, n: 0, mat: 0, mo: 0, total: 0, margen: 0 }
    map[tipo].n += 1
    map[tipo].mat += i._costoMat
    map[tipo].mo += i._manoObra
    map[tipo].total += i._costoTotal
    map[tipo].margen += i._margen
  })
  return Object.values(map).map(r => ({
    tipo: r.tipo, n: r.n,
    promMat: r.n ? r.mat / r.n : 0, promMo: r.n ? r.mo / r.n : 0,
    promTotal: r.n ? r.total / r.n : 0, promMargen: r.n ? r.margen / r.n : 0,
  }))
})

const reporteChartOptions = computed(() => ({
  chart: { type: 'bar', background: 'transparent', toolbar: { show: false } },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#F4623A'],
  plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
  xaxis: { categories: reporteChartData.value.categories, labels: { style: { colors: '#999' } } },
  yaxis: { labels: { style: { colors: '#999' } } },
  grid: { borderColor: 'rgba(255,255,255,0.06)' },
  dataLabels: { enabled: false },
}))
const reporteChartData = computed(() => {
  if (reporteTipo.value === 'consumo_componente') {
    const top = repConsumoComponente.value.slice(0, 10)
    return { categories: top.map(r => r.nombre), series: [{ name: 'Cantidad', data: top.map(r => r.cantidad) }] }
  }
  if (reporteTipo.value === 'consumo_categoria') {
    return { categories: repConsumoCategoria.value.map(r => r.categoria), series: [{ name: 'Costo S/', data: repConsumoCategoria.value.map(r => Number(r.costo.toFixed(2))) }] }
  }
  return { categories: [], series: [{ name: '', data: [] }] }
})
const reporteSeries = computed(() => reporteChartData.value.series)

function exportarReporte() {
  let rows = []
  if (reporteTipo.value === 'consumo_componente') {
    rows = [['Componente', 'Cant. consumida (30d)', 'Costo total', 'Frecuencia', 'Proyección 60d']]
    repConsumoComponente.value.forEach(r => rows.push([r.nombre, r.cantidad, r.costo.toFixed(2), r.freq, r.proyeccion60]))
  } else if (reporteTipo.value === 'consumo_categoria') {
    rows = [['Categoría', 'Cantidad', 'Costo total']]
    repConsumoCategoria.value.forEach(r => rows.push([r.categoria, r.cantidad, r.costo.toFixed(2)]))
  } else if (reporteTipo.value === 'rotacion') {
    rows = [['Componente', 'Stock', 'Consumo 30d', 'Rotación', 'Interpretación']]
    repRotacion.value.forEach(r => rows.push([r.nombre, r.stock, r.consumo, r.rotacion.toFixed(2), r.interpretacion]))
  } else if (reporteTipo.value === 'proyeccion') {
    rows = [['Componente', 'Stock', 'Consumo diario', 'Días hasta mínimo', 'A comprar', 'Costo estimado']]
    repProyeccion.value.forEach(r => rows.push([r.nombre, r.stock, r.diario.toFixed(2), r.diasHastaMin, r.comprar, r.costo.toFixed(2)]))
  } else {
    rows = [['Tipo', 'Intervenciones', 'Prom. materiales', 'Prom. mano obra', 'Prom. total', 'Prom. margen']]
    repCostoIntervencion.value.forEach(r => rows.push([r.tipo, r.n, r.promMat.toFixed(2), r.promMo.toFixed(2), r.promTotal.toFixed(2), r.promMargen.toFixed(2)]))
  }
  csvDownload('reporte_' + reporteTipo.value + '_gatwick.csv', rows)
  notify('Reporte exportado')
}

// ── INVENTARIO (home) · charts ───────────────────────────────────────────────
const valorPorCategoriaSeries = computed(() => {
  const map = {}
  componentesActivos.value.forEach(c => { map[c.categoria || 'Otro'] = (map[c.categoria || 'Otro'] || 0) + valorStock(c) })
  return Object.values(map).map(v => Number(v.toFixed(2)))
})
const valorPorCategoriaLabels = computed(() => {
  const map = {}
  componentesActivos.value.forEach(c => { map[c.categoria || 'Otro'] = (map[c.categoria || 'Otro'] || 0) + valorStock(c) })
  return Object.keys(map)
})
const invPieOptions = computed(() => ({
  chart: { type: 'donut', background: 'transparent' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  labels: valorPorCategoriaLabels.value,
  colors: ['#F4623A', '#FF8F70', '#FFB74D', '#FFD54F', '#4DB6AC', '#64B5F6', '#9575CD', '#A1887F', '#90A4AE', '#E57373'],
  legend: { position: 'bottom', labels: { colors: '#aaa' } },
  dataLabels: { enabled: true, formatter: (v) => v.toFixed(0) + '%' },
  stroke: { width: 0 },
}))

const movimientos7d = computed(() => {
  const dias = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    dias.push(formatDateISO(d))
  }
  const entradas = dias.map(() => 0), salidas = dias.map(() => 0)
  movimientos.value.forEach(m => {
    const dia = (m.fecha_movimiento || '').slice(0, 10)
    const idx = dias.indexOf(dia)
    if (idx === -1) return
    if (m.tipo_movimiento === 'entrada' || m.tipo_movimiento === 'devolucion') entradas[idx] += Number(m.cantidad || 0)
    else if (m.tipo_movimiento === 'salida') salidas[idx] += Number(m.cantidad || 0)
  })
  return { dias, entradas, salidas }
})
const invBarSeries = computed(() => [
  { name: 'Entradas', data: movimientos7d.value.entradas },
  { name: 'Salidas', data: movimientos7d.value.salidas },
])
const invBarOptions = computed(() => ({
  chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, stacked: false },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#4DB6AC', '#E57373'],
  plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
  xaxis: { categories: movimientos7d.value.dias.map(d => d.slice(5)), labels: { style: { colors: '#999' } } },
  yaxis: { labels: { style: { colors: '#999' } } },
  grid: { borderColor: 'rgba(255,255,255,0.06)' },
  legend: { labels: { colors: '#aaa' } },
  dataLabels: { enabled: false },
}))

const costoPromedioFabricacion = computed(() => {
  const activas = recetas.value.filter(r => r.activo)
  if (!activas.length) return 0
  return activas.reduce((s, r) => s + costoReceta(r.id), 0) / activas.length
})

function irA(view) { activeView.value = view }
async function refreshInventario() {
  await Promise.all([fetchComponentes(), fetchRecetas(), fetchMovimientos(), fetchInformeMateriales()])
  notify('Inventario actualizado')
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
    fetchEdificios(),
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
  defaultRangoMov()
  await Promise.all([
    fetchEdificios(),
    fetchLeadsWpp(),
    fetchLeadsFbIg(),
    fetchEmergencias(),
    fetchTecnicos(),
    fetchEvents(),
    fetchIntervenciones(),
    fetchCobranzas(),
    fetchEgresos(),
    fetchMeta(),
    fetchComponentes(),
    fetchRecetas(),
    fetchMovimientos(),
    fetchInformeMateriales(),
  ])
  subscribeEmergencias()
})

onUnmounted(() => {
  if (realtimeChannel) client.removeChannel(realtimeChannel)
})
</script>

<style scoped>
/* ── Seguimiento GPS en las tarjetas de emergencia ── */
.emerg-seg {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(128, 128, 128, .25);
}

.seg-chip {
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.seg-iniciado   { background: rgba(234, 179, 8, .18);  color: #facc15; }
.seg-en_camino  { background: rgba(37, 99, 235, .2);   color: #60a5fa; }
.seg-atendiendo { background: rgba(234, 88, 12, .2);   color: #fb923c; }

.seg-tec {
  font-size: 11.5px;
  opacity: .75;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seg-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 600;
  color: #60a5fa;
  text-decoration: none;
  white-space: nowrap;
}

/* ── Diálogo de seguimiento creado ── */
.seg-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.seg-info-grid div { display: flex; flex-direction: column; }
.seg-info-grid span { font-size: 10.5px; opacity: .6; text-transform: uppercase; letter-spacing: .4px; }
.seg-info-grid strong { font-size: 13.5px; }

/* Botón con el que el técnico entra directo a su seguimiento GPS */
.btn-seguimiento {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  color: #fff;
  text-decoration: none;
  text-align: center;
  font-weight: 700;
  font-size: 15.5px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, .35);
  transition: transform .12s ease, box-shadow .12s ease;
}

.btn-seguimiento:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37, 99, 235, .45);
}

.btn-seguimiento small {
  font-weight: 400;
  font-size: 11.5px;
  opacity: .85;
}

.seg-pie {
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  opacity: .6;
}
</style>
