<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #fff;">
            <v-img :src="logoUrl" alt="Trade Cars Logo" style="width: 100%; height: 100%;" />
          </div>

          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">Trade Cars</span>
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
          <span v-else class="logo-text">Trade Cars</span>
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
          <div class="nav-label">Funnel de Ventas</div>
          <button v-for="item in funnelItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]" @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'analisis' && alertasVencidas" class="nav-badge">{{ alertasVencidas }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Operaciones</div>
          <button v-for="item in operacionesItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]" @click="activeView = item.id">
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
          <div class="nav-label">Finanzas</div>
          <button v-for="item in finanzasItems" :key="item.id"
            :class="['nav-item', { active: activeView === item.id }]" @click="activeView = item.id">
            <v-icon :icon="item.icon" size="18" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="nav-section">
          <div class="nav-label">Marketing</div>
          <button :class="['nav-item', { active: activeView === 'remarketing' }]" @click="activeView = 'remarketing'">
            <v-icon icon="mdi-bullhorn" size="18" />
            <span>Remarketing</span>
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

    <!-- ==========  MAIN CONTENT  ========== -->
    <div class="main-content">

      <!-- ==========  VISTA: DASHBOARD  ========== -->
      <div v-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <h1>Dashboard</h1>
          <button class="btn-primary" @click="refreshAll">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
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

          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Solicitudes & Ventas</h2>
                <div class="chart-subtitle">Evolución de los últimos 6 meses</div>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="area" height="330" :options="chartOptions" :series="series" />
              </client-only>
            </div>
          </div>

          <div class="table-section">
            <div class="table-tabs">
              <button :class="['tab', { active: dashTab === 'solicitudes' }]" @click="dashTab = 'solicitudes'">
                Solicitudes recientes
              </button>
              <button :class="['tab', { active: dashTab === 'ventas' }]" @click="dashTab = 'ventas'">Últimas ventas</button>
              <button :class="['tab', { active: dashTab === 'stock' }]" @click="dashTab = 'stock'">Stock disponible</button>
            </div>
            <v-card flat class="custom-data-table">
              <div v-if="dashTab === 'solicitudes'">
                <v-card-title class="table-search-bar"><span class="table-title">Últimas 10 solicitudes web</span></v-card-title>
                <v-data-table :headers="headersSolicitudesMini" :items="solicitudesRecientes" class="elevation-0"
                  no-data-text="Aún no llegan solicitudes" :items-per-page="10">
                  <template v-slot:item.tipo="{ item }">
                    <v-chip :color="item.tipo === 'venta' ? 'warning' : 'info'" size="small" variant="tonal">
                      {{ item.tipo === 'venta' ? 'Vende su auto' : 'Quiere comprar' }}
                    </v-chip>
                  </template>
                  <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <div v-if="dashTab === 'ventas'">
                <v-card-title class="table-search-bar"><span class="table-title">Últimas ventas</span></v-card-title>
                <v-data-table :headers="headersVentas" :items="ventas.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay ventas registradas" :items-per-page="10">
                  <template v-slot:item.precio_venta="{ item }">{{ money(item.precio_venta) }}</template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>

              <div v-if="dashTab === 'stock'">
                <v-card-title class="table-search-bar"><span class="table-title">Autos disponibles</span></v-card-title>
                <v-data-table :headers="headersVehiculosMini" :items="vehiculosDisponibles.slice(0, 10)" class="elevation-0"
                  no-data-text="No hay autos en stock" :items-per-page="10">
                  <template v-slot:item.precio_venta="{ item }">{{ money(item.precio_venta) }}</template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: SOLICITUDES WEB (CARDS)  ========== -->
      <div v-else-if="activeView === 'solicitudes'" class="view-container">
        <header class="top-header">
          <h1>Solicitudes Web</h1>
          <button class="btn-primary" @click="fetchSolicitudes">
            <v-icon icon="mdi-refresh" size="16" />
            <span>Actualizar</span>
          </button>
        </header>

        <div class="content-area">
          <div class="table-tabs">
            <button :class="['tab', { active: solTab === 'venta' }]" @click="solTab = 'venta'; expandedSol = null">
              Quieren VENDER su auto ({{ solicitudesVenta.length }})
            </button>
            <button :class="['tab', { active: solTab === 'compra' }]" @click="solTab = 'compra'; expandedSol = null">
              Quieren COMPRAR ({{ solicitudesCompra.length }})
            </button>
          </div>

          <div class="sol-toolbar">
            <div class="sol-filtros">
              <v-chip v-for="e in ['todos', ...estadosActuales]" :key="e" size="small"
                :variant="solEstadoFiltro === e ? 'flat' : 'tonal'"
                :color="solEstadoFiltro === e ? colorEstado(e) : undefined"
                @click="solEstadoFiltro = e" style="cursor: pointer; text-transform: capitalize;">
                {{ e }}
                <span v-if="e !== 'todos'" style="margin-left:5px; opacity:.75;">{{ contarEstado(e) }}</span>
              </v-chip>
            </div>
            <v-text-field v-model="solSearch" prepend-inner-icon="mdi-magnify"
              placeholder="Buscar nombre, celular, correo, placa…" density="compact" hide-details
              style="max-width: 320px;" />
          </div>

          <div v-if="solicitudesFiltradas.length" class="sol-grid">
            <v-card v-for="s in solicitudesFiltradas" :key="s.id" class="sol-card"
              :class="{ 'sol-card--open': expandedSol === s.id }" @click="toggleSol(s.id)">

              <!-- Cabecera de la tarjeta -->
              <div class="sol-card-head">
                <v-avatar :color="solTab === 'venta' ? 'warning' : 'info'" size="38" variant="tonal">
                  <v-icon :icon="solTab === 'venta' ? 'mdi-car-key' : 'mdi-car-search'" size="20" />
                </v-avatar>
                <div class="sol-card-ident">
                  <div class="sol-card-nombre">{{ s.nombre_completo || 'Sin nombre' }}</div>
                  <div class="sol-card-fecha">{{ formatFecha(s.created_at) }}</div>
                </div>
                <v-chip :color="colorEstado(s.estado)" size="small" variant="flat" style="text-transform: capitalize;">
                  {{ s.estado || 'nuevo' }}
                </v-chip>
              </div>

              <!-- Resumen (siempre visible) -->
              <div class="sol-card-resumen">
                <template v-if="solTab === 'venta'">
                  <div class="sol-veh">
                    <v-icon icon="mdi-car" size="15" />
                    <strong>{{ [s.marca, s.modelo].filter(Boolean).join(' ') || 'Vehículo sin especificar' }}</strong>
                    <span v-if="s.anio">· {{ s.anio }}</span>
                  </div>
                  <div class="sol-meta">
                    <span v-if="s.placa"><v-icon icon="mdi-card-text-outline" size="13" /> {{ s.placa }}</span>
                    <span v-if="s.kilometraje"><v-icon icon="mdi-speedometer" size="13" /> {{ Number(s.kilometraje).toLocaleString('es-PE') }} km</span>
                    <span v-if="s.distrito"><v-icon icon="mdi-map-marker" size="13" /> {{ s.distrito }}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="sol-meta">
                    <span v-if="s.correo"><v-icon icon="mdi-email-outline" size="13" /> {{ s.correo }}</span>
                    <span v-if="s.celular"><v-icon icon="mdi-phone" size="13" /> {{ s.celular }}</span>
                  </div>
                </template>
                <div v-if="s.mensaje && expandedSol !== s.id" class="sol-msg-preview">"{{ s.mensaje }}"</div>
              </div>

              <!-- Detalle expandido -->
              <v-expand-transition>
                <div v-if="expandedSol === s.id" class="sol-card-detalle" @click.stop>
                  <v-divider class="mb-3" />

                  <div class="sol-campos">
                    <div class="sol-campo"><span>Nombre</span><strong>{{ s.nombre_completo || '—' }}</strong></div>
                    <div class="sol-campo"><span>Celular</span><strong>{{ s.celular || '—' }}</strong></div>
                    <div class="sol-campo"><span>Correo</span><strong>{{ s.correo || '—' }}</strong></div>
                    <template v-if="solTab === 'venta'">
                      <div class="sol-campo"><span>Marca</span><strong>{{ s.marca || '—' }}</strong></div>
                      <div class="sol-campo"><span>Modelo</span><strong>{{ s.modelo || '—' }}</strong></div>
                      <div class="sol-campo"><span>Año</span><strong>{{ s.anio || '—' }}</strong></div>
                      <div class="sol-campo"><span>Placa</span><strong>{{ s.placa || '—' }}</strong></div>
                      <div class="sol-campo"><span>Kilometraje</span><strong>{{ s.kilometraje ? Number(s.kilometraje).toLocaleString('es-PE') + ' km' : '—' }}</strong></div>
                      <div class="sol-campo"><span>Distrito</span><strong>{{ s.distrito || '—' }}</strong></div>
                      <div class="sol-campo">
                        <span>¿Tiene deuda?</span>
                        <strong :style="{ color: s.tiene_deuda === 'si' ? '#e53935' : undefined }">
                          {{ s.tiene_deuda ? (s.tiene_deuda === 'si' ? 'Sí' : 'No') : '—' }}
                        </strong>
                      </div>
                    </template>
                    <div class="sol-campo"><span>Origen</span><strong>{{ s.pagina_origen || s.origen || 'web' }}</strong></div>
                    <div v-if="s.utm_source" class="sol-campo"><span>Campaña</span><strong>{{ [s.utm_source, s.utm_campaign].filter(Boolean).join(' / ') }}</strong></div>
                  </div>

                  <div v-if="s.mensaje" class="sol-mensaje">
                    <div class="sol-mensaje-label">Mensaje del cliente</div>
                    <div>{{ s.mensaje }}</div>
                  </div>

                  <!-- Tasación (solo venta) -->
                  <div v-if="solTab === 'venta'" style="margin-top: 12px;">
                    <v-text-field v-model.number="s.precio_ofrecido" type="number" label="Precio ofrecido (S/)"
                      density="compact" hide-details prepend-inner-icon="mdi-cash" style="max-width: 240px;" />
                  </div>

                  <v-textarea v-model="s.notas" label="Notas internas" rows="2" density="compact" hide-details
                    class="mt-3" auto-grow />

                  <!-- Acciones -->
                  <div class="sol-acciones">
                    <v-select v-model="s.estado" :items="estadosActuales" label="Estado" density="compact"
                      hide-details style="max-width: 170px; text-transform: capitalize;" />
                    <v-btn color="primary" variant="flat" size="small" @click="guardarSolicitud(s)">
                      <v-icon icon="mdi-content-save" start size="16" /> Guardar
                    </v-btn>
                    <v-btn v-if="s.celular" color="success" variant="tonal" size="small"
                      :href="waLink(s)" target="_blank" @click.stop>
                      <v-icon icon="mdi-whatsapp" start size="16" /> WhatsApp
                    </v-btn>
                    <v-btn v-if="s.correo" variant="tonal" size="small" :href="`mailto:${s.correo}`" @click.stop>
                      <v-icon icon="mdi-email" start size="16" /> Correo
                    </v-btn>
                    <v-btn color="secondary" variant="tonal" size="small" @click="convertirEnCliente(s)">
                      <v-icon icon="mdi-account-plus" start size="16" /> Crear cliente
                    </v-btn>
                    <v-spacer />
                    <v-btn icon="mdi-delete" size="small" variant="text" color="error"
                      @click="eliminarSolicitud(s)" title="Eliminar solicitud" />
                  </div>
                </div>
              </v-expand-transition>
            </v-card>
          </div>

          <div v-else class="sol-empty">
            <v-icon icon="mdi-inbox-outline" size="44" />
            <p>No hay solicitudes que coincidan con el filtro.</p>
            <small>Las solicitudes llegan automáticamente desde el formulario de la web.</small>
          </div>
        </div>
      </div>

      <!-- ==========  VISTA: CLIENTES  ========== -->
      <div v-else-if="activeView === 'clientes'" class="view-container">
        <header class="top-header">
          <h1>Clientes</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevoCliente"><v-icon icon="mdi-plus" size="16" /><span>Nuevo cliente</span></button>
            <button class="btn-primary" @click="fetchClientes"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <div class="table-tabs">
            <button :class="['tab', { active: clienteTab === 'comprador' }]" @click="clienteTab = 'comprador'">
              Compradores ({{ compradores.length }})
            </button>
            <button :class="['tab', { active: clienteTab === 'vendedor' }]" @click="clienteTab = 'vendedor'">
              Vendedores ({{ vendedores.length }})
            </button>
          </div>
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">{{ clienteTab === 'comprador' ? 'Clientes que quieren comprar' : 'Clientes que quieren vender su auto' }}</span>
              <v-spacer />
              <v-text-field v-model="searchClientes" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 260px;" />
            </v-card-title>
            <v-data-table :headers="clienteTab === 'comprador' ? headersCompradores : headersVendedores"
              :items="clientesFiltrados" :loading="loadingClientes" class="elevation-0"
              no-data-text="No hay clientes" :items-per-page="20">
              <template v-slot:item.estado="{ item }">
                <v-chip :color="colorEstadoCliente(item.estado)" size="small" variant="tonal" style="text-transform: capitalize;">
                  {{ item.estado || 'nuevo' }}
                </v-chip>
              </template>
              <template v-slot:item.presupuesto="{ item }">{{ money(item.presupuesto) }}</template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="editarCliente(item)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarCliente(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showClienteDialog" max-width="720" persistent>
          <v-card v-if="clienteForm">
            <v-card-title class="pt-4">{{ clienteForm.id ? 'Editar cliente' : 'Nuevo cliente' }}</v-card-title>
            <v-card-text>
              <div class="form-grid-2">
                <v-select v-model="clienteForm.tipo" :items="['comprador', 'vendedor', 'ambos']" label="Tipo *" density="compact" hide-details />
                <v-select v-model="clienteForm.estado" :items="ESTADOS_CLIENTE" label="Estado" density="compact" hide-details />
                <v-text-field v-model="clienteForm.nombre_completo" label="Nombre completo *" density="compact" hide-details />
                <v-text-field v-model="clienteForm.dni" label="DNI" density="compact" hide-details />
                <v-text-field v-model="clienteForm.telefono" label="Teléfono" density="compact" hide-details />
                <v-text-field v-model="clienteForm.correo" label="Correo" density="compact" hide-details />
                <v-text-field v-model="clienteForm.distrito" label="Distrito" density="compact" hide-details />
                <v-select v-model="clienteForm.canal" :items="CANALES" label="Canal" density="compact" hide-details />
              </div>

              <div v-if="clienteForm.tipo !== 'vendedor'" style="margin-top:16px;">
                <div class="form-section-title">Interés de compra</div>
                <div class="form-grid-2">
                  <v-text-field v-model.number="clienteForm.presupuesto" type="number" label="Presupuesto (S/)" density="compact" hide-details />
                  <v-text-field v-model="clienteForm.marca_interes" label="Marca de interés" density="compact" hide-details />
                  <v-text-field v-model="clienteForm.modelo_interes" label="Modelo de interés" density="compact" hide-details />
                  <v-text-field v-model.number="clienteForm.anio_interes" type="number" label="Año de interés" density="compact" hide-details />
                </div>
              </div>

              <div v-if="clienteForm.tipo !== 'comprador'" style="margin-top:16px;">
                <div class="form-section-title">Vehículo que quiere vender</div>
                <div class="form-grid-2">
                  <v-text-field v-model="clienteForm.vehiculo_marca" label="Marca" density="compact" hide-details />
                  <v-text-field v-model="clienteForm.vehiculo_modelo" label="Modelo" density="compact" hide-details />
                  <v-text-field v-model.number="clienteForm.vehiculo_anio" type="number" label="Año" density="compact" hide-details />
                  <v-text-field v-model="clienteForm.vehiculo_placa" label="Placa" density="compact" hide-details />
                  <v-text-field v-model.number="clienteForm.vehiculo_km" type="number" label="Kilometraje" density="compact" hide-details />
                  <v-switch v-model="clienteForm.tiene_deuda" label="Tiene deuda" color="warning" density="compact" hide-details inset />
                </div>
              </div>

              <v-textarea v-model="clienteForm.notas" label="Notas" rows="2" density="compact" hide-details class="mt-4" auto-grow />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showClienteDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarCliente">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: VEHÍCULOS (INVENTARIO)  ========== -->
      <div v-else-if="activeView === 'vehiculos'" class="view-container">
        <header class="top-header">
          <h1>Inventario de Vehículos</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevoVehiculo"><v-icon icon="mdi-plus" size="16" /><span>Nuevo vehículo</span></button>
            <button class="btn-primary" @click="fetchVehiculos"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Vehículos ({{ vehiculos.length }})</span>
              <v-spacer />
              <v-select v-model="filtroEstadoVeh" :items="['todos', ...ESTADOS_VEHICULO]" density="compact" hide-details
                style="max-width: 180px;" class="mr-3" />
              <v-text-field v-model="searchVehiculos" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 240px;" />
            </v-card-title>
            <v-data-table :headers="headersVehiculos" :items="vehiculosFiltrados" :loading="loadingVehiculos"
              class="elevation-0" no-data-text="No hay vehículos" :items-per-page="20">
              <template v-slot:item.precio_compra="{ item }">{{ money(item.precio_compra) }}</template>
              <template v-slot:item.precio_venta="{ item }">{{ money(item.precio_venta) }}</template>
              <template v-slot:item.margen="{ item }">
                <span :style="{ color: margenVeh(item) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }">
                  {{ money(margenVeh(item)) }}
                </span>
              </template>
              <template v-slot:item.estado="{ item }">
                <v-chip :color="colorEstadoVeh(item.estado)" size="small" variant="tonal" style="text-transform: capitalize;">
                  {{ (item.estado || '').replace('_', ' ') }}
                </v-chip>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="editarVehiculo(item)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarVehiculo(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showVehiculoDialog" max-width="760" persistent>
          <v-card v-if="vehiculoForm">
            <v-card-title class="pt-4">{{ vehiculoForm.id ? 'Editar vehículo' : 'Nuevo vehículo' }}</v-card-title>
            <v-card-text>
              <div class="form-grid-2">
                <v-text-field v-model="vehiculoForm.marca" label="Marca *" density="compact" hide-details />
                <v-text-field v-model="vehiculoForm.modelo" label="Modelo *" density="compact" hide-details />
                <v-text-field v-model="vehiculoForm.version" label="Versión" density="compact" hide-details />
                <v-text-field v-model.number="vehiculoForm.anio" type="number" label="Año" density="compact" hide-details />
                <v-text-field v-model="vehiculoForm.placa" label="Placa" density="compact" hide-details />
                <v-text-field v-model="vehiculoForm.color" label="Color" density="compact" hide-details />
                <v-text-field v-model.number="vehiculoForm.kilometraje" type="number" label="Kilometraje" density="compact" hide-details />
                <v-select v-model="vehiculoForm.transmision" :items="['mecanica', 'automatica']" label="Transmisión" density="compact" hide-details />
                <v-select v-model="vehiculoForm.combustible" :items="COMBUSTIBLES" label="Combustible" density="compact" hide-details />
                <v-select v-model="vehiculoForm.estado" :items="ESTADOS_VEHICULO" label="Estado" density="compact" hide-details />
                <v-text-field v-model.number="vehiculoForm.precio_compra" type="number" label="Precio compra (S/)" density="compact" hide-details />
                <v-text-field v-model.number="vehiculoForm.precio_venta" type="number" label="Precio venta (S/)" density="compact" hide-details />
                <v-text-field v-model="vehiculoForm.propietario_nombre" label="Propietario anterior" density="compact" hide-details />
                <v-switch v-model="vehiculoForm.tiene_deuda" label="Tiene deuda" color="warning" density="compact" hide-details inset />
              </div>
              <v-textarea v-model="vehiculoForm.notas" label="Notas" rows="2" density="compact" hide-details class="mt-4" auto-grow />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showVehiculoDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarVehiculo">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: VENTAS  ========== -->
      <div v-else-if="activeView === 'ventas'" class="view-container">
        <header class="top-header">
          <h1>Ventas</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevaVenta"><v-icon icon="mdi-plus" size="16" /><span>Registrar venta</span></button>
            <button class="btn-primary" @click="fetchVentas"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <div class="stats-grid" style="margin-bottom: 18px;">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Ventas del mes</span></div>
              <div class="stat-value">{{ ventasMes.length }}</div>
              <div class="stat-description">Unidades vendidas este mes</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Ingresos del mes</span></div>
              <div class="stat-value">{{ money(ingresosMes) }}</div>
              <div class="stat-description">Suma de precios de venta</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Margen del mes</span></div>
              <div class="stat-value">{{ money(margenMes) }}</div>
              <div class="stat-description">Venta menos costo de compra</div>
            </div>
          </div>
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Historial de ventas</span>
              <v-spacer />
              <v-text-field v-model="searchVentas" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 240px;" />
            </v-card-title>
            <v-data-table :headers="headersVentasFull" :items="ventasFiltradas" :loading="loadingVentas"
              class="elevation-0" no-data-text="No hay ventas" :items-per-page="20">
              <template v-slot:item.precio_venta="{ item }">{{ money(item.precio_venta) }}</template>
              <template v-slot:item.margen="{ item }">
                <span :style="{ color: margenVenta(item) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }">
                  {{ money(margenVenta(item)) }}
                </span>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarVenta(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showVentaDialog" max-width="700" persistent>
          <v-card v-if="ventaForm">
            <v-card-title class="pt-4">Registrar venta</v-card-title>
            <v-card-text>
              <v-select v-model="ventaForm.vehiculo_id" :items="vehiculosSelect" item-title="label" item-value="id"
                label="Vehículo" density="compact" hide-details class="mb-3" @update:model-value="onVehiculoVenta" />
              <div class="form-grid-2">
                <v-text-field v-model="ventaForm.cliente_nombre" label="Cliente *" density="compact" hide-details />
                <v-text-field v-model="ventaForm.cliente_dni" label="DNI" density="compact" hide-details />
                <v-text-field v-model="ventaForm.cliente_telefono" label="Teléfono" density="compact" hide-details />
                <v-text-field v-model.number="ventaForm.precio_venta" type="number" label="Precio de venta (S/) *" density="compact" hide-details />
                <v-select v-model="ventaForm.metodo_pago" :items="METODOS_PAGO" label="Método de pago" density="compact" hide-details />
                <v-select v-model="ventaForm.estado" :items="['separacion', 'completada', 'anulada']" label="Estado" density="compact" hide-details />
                <v-text-field v-model="ventaForm.asesor" label="Asesor" density="compact" hide-details />
                <v-text-field v-model="ventaForm.fecha_venta" type="date" label="Fecha" density="compact" hide-details />
              </div>
              <v-textarea v-model="ventaForm.notas" label="Notas" rows="2" density="compact" hide-details class="mt-4" auto-grow />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showVentaDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarVenta">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: COMPRAS  ========== -->
      <div v-else-if="activeView === 'compras'" class="view-container">
        <header class="top-header">
          <h1>Compras / Tasaciones</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevaCompra"><v-icon icon="mdi-plus" size="16" /><span>Registrar compra</span></button>
            <button class="btn-primary" @click="fetchCompras"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Autos comprados ({{ compras.length }})</span>
              <v-spacer />
              <v-text-field v-model="searchCompras" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 240px;" />
            </v-card-title>
            <v-data-table :headers="headersCompras" :items="comprasFiltradas" :loading="loadingCompras"
              class="elevation-0" no-data-text="No hay compras" :items-per-page="20">
              <template v-slot:item.precio_compra="{ item }">{{ money(item.precio_compra) }}</template>
              <template v-slot:item.precio_tasacion="{ item }">{{ money(item.precio_tasacion) }}</template>
              <template v-slot:item.estado="{ item }">
                <v-chip size="small" variant="tonal" style="text-transform: capitalize;">{{ item.estado }}</v-chip>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarCompra(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showCompraDialog" max-width="700" persistent>
          <v-card v-if="compraForm">
            <v-card-title class="pt-4">Registrar compra</v-card-title>
            <v-card-text>
              <div class="form-grid-2">
                <v-text-field v-model="compraForm.proveedor_nombre" label="Vendedor (dueño) *" density="compact" hide-details />
                <v-text-field v-model="compraForm.proveedor_telefono" label="Teléfono" density="compact" hide-details />
                <v-text-field v-model="compraForm.marca" label="Marca" density="compact" hide-details />
                <v-text-field v-model="compraForm.modelo" label="Modelo" density="compact" hide-details />
                <v-text-field v-model.number="compraForm.anio" type="number" label="Año" density="compact" hide-details />
                <v-text-field v-model="compraForm.placa" label="Placa" density="compact" hide-details />
                <v-text-field v-model.number="compraForm.kilometraje" type="number" label="Kilometraje" density="compact" hide-details />
                <v-text-field v-model.number="compraForm.precio_tasacion" type="number" label="Precio tasación (S/)" density="compact" hide-details />
                <v-text-field v-model.number="compraForm.precio_compra" type="number" label="Precio compra (S/) *" density="compact" hide-details />
                <v-select v-model="compraForm.estado" :items="['tasacion', 'negociacion', 'completada', 'descartada']" label="Estado" density="compact" hide-details />
                <v-text-field v-model="compraForm.fecha_compra" type="date" label="Fecha" density="compact" hide-details />
                <v-switch v-model="compraForm.tiene_deuda" label="Tiene deuda" color="warning" density="compact" hide-details inset />
              </div>
              <v-checkbox v-model="compraForm.crear_vehiculo" label="Agregar también al inventario de vehículos"
                density="compact" hide-details class="mt-2" />
              <v-textarea v-model="compraForm.notas" label="Notas" rows="2" density="compact" hide-details class="mt-3" auto-grow />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showCompraDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarCompra">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: LEADS  ========== -->
      <div v-else-if="activeView === 'leads'" class="view-container">
        <header class="top-header">
          <h1>Leads</h1>
          <button class="btn-primary" @click="fetchLeads"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
        </header>
        <div class="content-area">
          <div class="table-tabs">
            <button :class="['tab', { active: leadsTab === 'wpp' }]" @click="leadsTab = 'wpp'">WhatsApp ({{ leadsWpp.length }})</button>
            <button :class="['tab', { active: leadsTab === 'fbig' }]" @click="leadsTab = 'fbig'">FB / IG ({{ leadsFbIg.length }})</button>
          </div>
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">{{ leadsTab === 'wpp' ? 'Leads WhatsApp' : 'Leads Facebook / Instagram' }}</span>
              <v-spacer />
              <v-text-field v-model="searchLeads" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 240px;" />
            </v-card-title>
            <v-data-table :headers="leadsTab === 'wpp' ? headersLeadsWpp : headersLeadsFbIg" :items="leadsFiltrados"
              class="elevation-0" no-data-text="No hay leads" :items-per-page="20">
              <template v-slot:item.lead_status="{ item }">
                <v-chip
                  :color="item.lead_status?.toLowerCase().includes('caliente') ? 'error' : item.lead_status?.toLowerCase().includes('tibi') ? 'warning' : 'info'"
                  size="small" variant="tonal">
                  {{ item.lead_status || '—' }}
                </v-chip>
              </template>
              <template v-slot:item.interes="{ item }">
                <v-chip v-if="item.interes" :color="item.interes === 'vender' ? 'warning' : 'info'" size="small" variant="tonal">
                  {{ item.interes }}
                </v-chip>
                <span v-else>—</span>
              </template>
              <template v-slot:item.created_at="{ item }">{{ formatFecha(item.created_at) }}</template>
            </v-data-table>
          </v-card>
        </div>
      </div>

      <!-- ==========  VISTA: CALENDARIO / CITAS  ========== -->
      <div v-else-if="activeView === 'calendario'" class="view-container">
        <header class="top-header">
          <h1>Agenda</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevaCita"><v-icon icon="mdi-plus" size="16" /><span>Nueva cita</span></button>
            <button class="btn-primary" @click="fetchCitas"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Citas ({{ citas.length }})</span>
              <v-spacer />
              <v-select v-model="filtroTipoCita" :items="['todos', ...TIPOS_CITA]" density="compact" hide-details style="max-width: 190px;" />
            </v-card-title>
            <v-data-table :headers="headersCitas" :items="citasFiltradas" :loading="loadingCitas" class="elevation-0"
              no-data-text="No hay citas" :items-per-page="20">
              <template v-slot:item.tipo="{ item }">
                <v-chip size="small" variant="tonal" style="text-transform: capitalize;">{{ (item.tipo || '').replace('_', ' ') }}</v-chip>
              </template>
              <template v-slot:item.estado="{ item }">
                <v-chip :color="colorEstadoCita(item.estado)" size="small" variant="tonal" style="text-transform: capitalize;">
                  {{ item.estado }}
                </v-chip>
              </template>
              <template v-slot:item.cliente="{ item }">{{ [item.client_name, item.client_surname].filter(Boolean).join(' ') || '—' }}</template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="editarCita(item)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarCita(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showCitaDialog" max-width="640" persistent>
          <v-card v-if="citaForm">
            <v-card-title class="pt-4">{{ citaForm.id ? 'Editar cita' : 'Nueva cita' }}</v-card-title>
            <v-card-text>
              <div class="form-grid-2">
                <v-select v-model="citaForm.tipo" :items="TIPOS_CITA" label="Tipo *" density="compact" hide-details />
                <v-select v-model="citaForm.estado" :items="['pendiente', 'confirmada', 'completada', 'cancelada']" label="Estado" density="compact" hide-details />
                <v-text-field v-model="citaForm.date" type="date" label="Fecha *" density="compact" hide-details />
                <v-text-field v-model="citaForm.time" type="time" label="Hora" density="compact" hide-details />
                <v-text-field v-model="citaForm.client_name" label="Nombre cliente *" density="compact" hide-details />
                <v-text-field v-model="citaForm.client_phone" label="Teléfono" density="compact" hide-details />
                <v-text-field v-model="citaForm.marca" label="Marca" density="compact" hide-details />
                <v-text-field v-model="citaForm.modelo" label="Modelo" density="compact" hide-details />
                <v-text-field v-model="citaForm.placa" label="Placa" density="compact" hide-details />
                <v-text-field v-model="citaForm.asesor" label="Asesor" density="compact" hide-details />
              </div>
              <v-textarea v-model="citaForm.notas" label="Notas" rows="2" density="compact" hide-details class="mt-4" auto-grow />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showCitaDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarCita">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: EGRESOS  ========== -->
      <div v-else-if="activeView === 'egresos'" class="view-container">
        <header class="top-header">
          <h1>Egresos</h1>
          <div style="display:flex; gap:10px; align-items:center;">
            <button class="btn-primary" @click="nuevoEgreso"><v-icon icon="mdi-plus" size="16" /><span>Nuevo egreso</span></button>
            <button class="btn-primary" @click="fetchEgresos"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Egresos — Total: {{ money(totalEgresos) }}</span>
              <v-spacer />
              <v-text-field v-model="searchEgresos" prepend-inner-icon="mdi-magnify" placeholder="Buscar..."
                density="compact" hide-details style="max-width: 240px;" />
            </v-card-title>
            <v-data-table :headers="headersEgresos" :items="egresosFiltrados" :loading="loadingEgresos"
              class="elevation-0" no-data-text="No hay egresos" :items-per-page="20">
              <template v-slot:item.precio="{ item }">{{ money(item.precio) }}</template>
              <template v-slot:item.total="{ item }">{{ money(Number(item.precio || 0) * Number(item.cantidad || 1)) }}</template>
              <template v-slot:item.acciones="{ item }">
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarEgreso(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog v-model="showEgresoDialog" max-width="560" persistent>
          <v-card v-if="egresoForm">
            <v-card-title class="pt-4">Nuevo egreso</v-card-title>
            <v-card-text>
              <div class="form-grid-2">
                <v-text-field v-model="egresoForm.nombre" label="Concepto *" density="compact" hide-details />
                <v-select v-model="egresoForm.categoria" :items="CATEGORIAS_EGRESO" label="Categoría" density="compact" hide-details />
                <v-text-field v-model.number="egresoForm.precio" type="number" label="Monto (S/) *" density="compact" hide-details />
                <v-text-field v-model.number="egresoForm.cantidad" type="number" label="Cantidad" density="compact" hide-details />
                <v-select v-model="egresoForm.metodo_pago" :items="METODOS_PAGO" label="Método de pago" density="compact" hide-details />
                <v-text-field v-model="egresoForm.fecha" type="date" label="Fecha" density="compact" hide-details />
              </div>
              <v-text-field v-model="egresoForm.referencia" label="Referencia" density="compact" hide-details class="mt-3" />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showEgresoDialog = false">Cancelar</v-btn>
              <v-btn color="primary" variant="flat" @click="guardarEgreso">Guardar</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ==========  VISTA: SETTINGS  ========== -->
      <!-- ==========  FUNNEL: MODULO 1 — EMBUDO  ========== -->
      <TradeCarsFunnelCompras v-else-if="activeView === 'funnel'"
        :leads="funnelLeads" :asesores="asesoresNombres" @refresh="fetchFunnel" />

      <!-- ==========  FUNNEL: MODULO 2 — TABLA DE LEADS  ========== -->
      <TradeCarsTablaLeadsFunnel v-else-if="activeView === 'funnel_leads'"
        :leads="funnelLeads" :asesores="asesoresNombres" :loading="loadingFunnel"
        :chatwoot-account-id="CHATWOOT_ACCOUNT_ID"
        @refresh="fetchFunnel" @editar="editarFunnelLead" @nuevo="nuevoFunnelLead" />

      <!-- ==========  FUNNEL: MODULO 3 — ANALISIS DE CONVERSION  ========== -->
      <TradeCarsProcedenciaCostos v-else-if="activeView === 'procedencia'"
        :leads="funnelLeads" :costos="costosCampana" :loading="loadingFunnel"
        @refresh="fetchFunnel" @notificar="notify" />

      <TradeCarsAnalisisConversion v-else-if="activeView === 'analisis'"
        :leads="funnelLeads" :asesores="asesoresNombres" :loading="loadingFunnel"
        @refresh="fetchFunnel" @editar="editarFunnelLead" />

      <SettingsView v-else-if="activeView === 'settings'" company-id="tradecars"
        :current-user-role="currentUser?.role" />

      <!-- ==========  VISTA: REMARKETING  ========== -->
      <RemarketingPanel v-else-if="activeView === 'remarketing'" company-id="tradecars"
        :lead-tablas="{ wpp: 'GeneralBDwppTRADECARS', fbig: 'GeneralBDfbigTRADECARS' }" />

      <!-- ==========  DIÁLOGO: EDITAR LEAD DEL FUNNEL  ========== -->
      <v-dialog v-model="showFunnelDialog" max-width="760" persistent scrollable>
        <v-card v-if="funnelForm">
          <v-card-title class="pt-4">
            {{ funnelForm.id ? 'Editar lead' : 'Nuevo lead' }}
            <span v-if="funnelForm.contacto_nombre" class="text-medium-emphasis text-body-2">
              — {{ funnelForm.contacto_nombre }}
            </span>
          </v-card-title>

          <v-card-text>
            <!-- Vista previa de lo que va a pasar en el embudo al guardar -->
            <v-alert density="compact" variant="tonal"
              :type="etapaPrevista ? 'info' : 'warning'" class="mb-4">
              <div class="d-flex align-center flex-wrap" style="gap:14px;">
                <div>
                  <div class="text-caption text-medium-emphasis">Etapa resultante</div>
                  <strong>{{ etapaPrevista || 'Fuera del funnel' }}</strong>
                </div>
                <v-divider vertical />
                <div>
                  <div class="text-caption text-medium-emphasis">Fecha del funnel</div>
                  <strong>{{ fechaFunnelPrevista || 'sin fecha' }}</strong>
                </div>
                <template v-if="!etapaPrevista">
                  <v-divider vertical />
                  <span class="text-caption">
                    Con perfil SI hace falta un status para que entre al embudo.
                  </span>
                </template>
              </div>
            </v-alert>

            <div class="text-overline mb-1">Datos del contacto</div>
            <div class="form-grid-2">
              <v-text-field v-model="funnelForm.contacto_nombre" label="Nombre del cliente *"
                density="compact" hide-details />
              <v-text-field v-model="funnelForm.contacto_telefono" label="Teléfono"
                density="compact" hide-details />
              <v-select v-model="funnelForm.canal_origen" :items="[...TC_CANALES]"
                label="Canal de origen" density="compact" hide-details />
              <v-combobox v-model="funnelForm.asesor" :items="asesoresNombres"
                label="Asesor asignado" density="compact" hide-details />
              <v-text-field v-model="funnelForm.fecha_derivacion" type="date"
                label="Fecha de derivación" density="compact" hide-details />
            </div>

            <v-divider class="my-4" />
            <div class="text-overline mb-1">Clasificación del asesor</div>
            <div class="form-grid-2">
              <v-select v-model="funnelForm.perfil_coincide" :items="['SI', 'NO']"
                label="Perfil coincide *" density="compact" hide-details />
              <v-select v-model="funnelForm.status" :items="[...TC_STATUS]"
                label="Status *" density="compact" hide-details="auto" clearable
                :disabled="funnelForm.perfil_coincide === 'NO'"
                :hint="funnelForm.perfil_coincide === 'NO' ? 'Con perfil NO el lead se queda en LEADS' : ''"
                persistent-hint />
              <v-text-field v-model="funnelForm.fecha_cita" type="date" label="Fecha de cita (agendada)"
                density="compact" hide-details
                :class="{ 'campo-requerido': ['CITA', 'CITA ASISTIDA'].includes(funnelForm.status) && !funnelForm.fecha_cita }" />
              <v-text-field v-model="funnelForm.fecha_cita_asistida" type="date" label="Fecha en que se realizó la cita"
                density="compact" hide-details
                :class="{ 'campo-requerido': funnelForm.status === 'CITA ASISTIDA' && !funnelForm.fecha_cita_asistida }" />
              <v-text-field v-model="funnelForm.fecha_compra" type="date" label="Fecha de compra"
                density="compact" hide-details
                :class="{ 'campo-requerido': funnelForm.status === 'CONCRETADA' && !funnelForm.fecha_compra }" />
            </div>

            <v-alert v-if="funnelForm._statusOriginal && tcStatusEsInvalido(funnelForm._statusOriginal)"
              type="error" variant="tonal" density="compact" class="mt-3">
              El CRM había mandado <strong>{{ funnelForm._statusOriginal }}</strong>, que no es un valor
              permitido. Elige uno de la lista para que el lead vuelva a contar en el embudo.
            </v-alert>

            <v-divider class="my-4" />
            <div class="text-overline mb-1">Gestión y seguimiento</div>
            <div class="form-grid-2">
              <v-combobox v-model="funnelForm.motivo_no_cita" :items="motivosNoCita.map(m => m.motivo)"
                label="Motivo de no cita" density="compact" hide-details clearable />
              <v-text-field v-model="funnelForm.fecha_probable_venta" type="date"
                label="Fecha probable de venta" density="compact" hide-details />
              <v-text-field v-model="funnelForm.proxima_accion" label="Próxima acción"
                density="compact" hide-details />
              <v-text-field v-model="funnelForm.fecha_seguimiento" type="date"
                label="Fecha de seguimiento" density="compact" hide-details />
            </div>

            <v-divider class="my-4" />
            <div class="text-overline mb-1">Vehículo</div>
            <div class="form-grid-2">
              <v-text-field v-model="funnelForm.placa" label="Placa" density="compact" hide-details />
              <!-- La prioridad va en un chip y no en el hint: v-messages deja
                   pegado el mensaje anterior al pasar de una marca a otra. -->
              <v-combobox v-model="funnelForm.marca" :items="marcasCanonicas" label="Marca"
                density="compact" hide-details>
                <template #append-inner>
                  <span v-if="marcaResuelta?.prioridad" class="chip-prioridad"
                    :class="'p' + marcaResuelta.prioridad"
                    :title="marcaResuelta.marca + ' · prioridad ' + marcaResuelta.prioridad">
                    P{{ marcaResuelta.prioridad }}
                  </span>
                  <span v-else-if="marcaResuelta" class="chip-prioridad sin"
                    :title="marcaResuelta.marca + ' · sin prioridad asignada en el catálogo'">
                    sin P
                  </span>
                  <span v-else-if="funnelForm.marca" class="chip-prioridad desconocida"
                    title="Marca no reconocida en el catálogo">?</span>
                </template>
              </v-combobox>
              <v-text-field v-model="funnelForm.modelo" label="Modelo" density="compact" hide-details />
              <v-text-field v-model="funnelForm.version" label="Versión" density="compact" hide-details />
              <v-text-field v-model="funnelForm.anio" label="Año" density="compact" hide-details="auto"
                hint="En la base viene como 2014/2015" persistent-hint />
              <v-text-field v-model.number="funnelForm.kilometraje" type="number" label="Kilometraje"
                density="compact" hide-details />
              <v-select v-model="funnelForm.tiene_deuda" :items="['NO', 'SI']" label="Tiene deuda"
                density="compact" hide-details />
              <v-text-field v-model="funnelForm.banco" label="Banco" density="compact" hide-details
                :disabled="funnelForm.tiene_deuda !== 'SI'" />
            </div>

            <v-divider class="my-4" />
            <div class="text-overline mb-1">Negociación</div>
            <div class="form-grid-2">
              <v-text-field v-model.number="funnelForm.monto_propuesta_inicial" type="number" prefix="S/"
                label="Propuesta inicial" density="compact" hide-details />
              <v-text-field v-model.number="funnelForm.monto_mejorado" type="number" prefix="S/"
                label="Monto mejorado" density="compact" hide-details />
              <v-text-field v-model.number="funnelForm.expectativa_cliente" type="number" prefix="S/"
                label="Expectativa del cliente" density="compact" hide-details />
              <v-text-field v-model.number="funnelForm.num_contactos" type="number" label="N° de contactos"
                density="compact" hide-details />
            </div>

            <v-divider class="my-4" />
            <div class="text-overline mb-1">Origen y ubicación</div>
            <div class="form-grid-2">
              <v-combobox v-model="funnelForm.campana" :items="campanasConocidas" label="Campaña"
                density="compact" hide-details />
              <v-combobox v-model="funnelForm.distrito" :items="distritosCanonicos" label="Distrito"
                density="compact" hide-details="auto"
                :hint="funnelForm.distrito && !zonaResuelta ? 'Distrito no reconocido: la zona queda vacía' : ''"
                persistent-hint />
              <!-- La zona no se escribe: sale de tradecars_zonificacion. En su Excel
                   se llenaba a mano y fallaba el 31% de las veces. -->
              <!-- El distrito canónico va en el propio valor y no en el hint: al
                   cambiar de un hint a otro, v-messages deja el mensaje viejo pegado. -->
              <v-text-field
                :model-value="zonaResuelta ? zonaResuelta.zona + ' · ' + zonaResuelta.distrito : ''"
                label="Zona (automática)" placeholder="Se completa al reconocer el distrito"
                density="compact" hide-details readonly persistent-placeholder />
              <v-text-field v-model="funnelForm.correo" label="Correo" density="compact" hide-details />
              <v-text-field v-model="funnelForm.fecha_llegada" type="date" label="Fecha de llegada"
                density="compact" hide-details />
              <v-text-field v-model="funnelForm.fecha_ultimo_contacto" type="date" label="Último contacto"
                density="compact" hide-details />
            </div>

            <v-textarea v-model="funnelForm.feedback" label="Feedback del cliente" rows="2"
              density="compact" hide-details class="mt-4" auto-grow />
            <v-textarea v-model="funnelForm.observaciones" label="Observaciones" rows="2"
              density="compact" hide-details class="mt-4" auto-grow />
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="showFunnelDialog = false">Cancelar</v-btn>
            <v-btn color="primary" variant="flat" @click="guardarFunnelLead">Guardar</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessTradeCars, dashboards } from '@/utils/permissions'
import SettingsView from '@/components/Settings/SettingsView.vue'
import RemarketingPanel from '@/components/RemarketingPanel.vue'

const { logActivity } = useActivityLogger()

definePageMeta({ middleware: 'auth-dashboard' })

/* ---------------- Sesión ---------------- */
interface UserSession { id: string; email: string; full_name: string; role: string; company_id?: string }
const userSession = useCookie<UserSession | null>(SESSION_COOKIE, sessionCookieOptions())
const currentUser = computed(() => userSession.value || {
  full_name: 'Usuario Invitado', email: '', id: '', role: '', company_id: ''
})

const client = useSupabaseClient()

// Logo servido desde /public (ruta en runtime: no se resuelve en build,
// así que si el archivo aún no está, no rompe la compilación).
const logoUrl = '/tradecars-logo.png'

const showDashboardMenu = ref(false)
const showUserMenu = ref(false)
const activeView = useVistaPersistente('tradecars')
const dashTab = usePersistente('tradecars:dashTab', 'solicitudes')

const snackbar = ref({ show: false, text: '', color: 'success' })
function notify(text: string, color = 'success') { snackbar.value = { show: true, text, color } }

/* ---------------- Tema ---------------- */
const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.current.value.dark)
const toggleTheme = () => { vuetifyTheme.global.name.value = isDark.value ? 'light' : 'dark' }
function applyTheme() {
  nextTick(() => {
    if (import.meta.server) return
    const root = document.documentElement
    if (isDark.value) { root.setAttribute('data-theme', 'dark'); root.classList.add('dark') }
    else { root.setAttribute('data-theme', 'light'); root.classList.remove('dark') }
  })
}
watch(isDark, applyTheme, { immediate: true })

function logout() {
  logActivity('Cerró sesión')
  const session = useCookie(SESSION_COOKIE, sessionCookieOptions())
  session.value = null
  return navigateTo('/')
}

/* ---------------- Menús ---------------- */
const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'mdi-form-select', label: 'Solicitudes Web', id: 'solicitudes' },
  { icon: 'mdi-account-group', label: 'Clientes', id: 'clientes' },
  { icon: 'mdi-chart-box', label: 'Leads', id: 'leads' },
]
const funnelItems = [
  { icon: 'mdi-filter-variant', label: 'Funnel de Compras', id: 'funnel' },
  { icon: 'mdi-table-account', label: 'Tabla de Leads', id: 'funnel_leads' },
  { icon: 'mdi-chart-timeline-variant', label: 'Análisis de Conversión', id: 'analisis' },
  { icon: 'mdi-source-branch', label: 'Procedencia y Costos', id: 'procedencia' },
]
const operacionesItems = [
  { icon: 'mdi-car-multiple', label: 'Vehículos', id: 'vehiculos' },
  { icon: 'mdi-cash-register', label: 'Ventas', id: 'ventas' },
  { icon: 'mdi-car-key', label: 'Compras', id: 'compras' },
  { icon: 'mdi-calendar-blank', label: 'Agenda', id: 'calendario' },
]
const finanzasItems = [
  { icon: 'mdi-cash-minus', label: 'Egresos', id: 'egresos' },
]
const chatsItems = [
  { icon: 'mdi-message-reply', label: 'Conversaciones', id: 'chatwoot', url: 'https://chats.alef.company/app/accounts/1/dashboard' },
]
const navigateToChat = (url: string) => { if (url) window.open(url, '_blank') }

/* ---------------- Constantes de negocio ---------------- */
const ESTADOS_COMPRA  = ['nuevo', 'contactado', 'atendido', 'descartado']
const ESTADOS_VENTA   = ['nuevo', 'contactado', 'tasado', 'comprado', 'descartado']
const ESTADOS_CLIENTE = ['nuevo', 'contactado', 'en_negociacion', 'cerrado', 'descartado']
const ESTADOS_VEHICULO = ['disponible', 'reservado', 'vendido', 'en_preparacion']
const COMBUSTIBLES = ['gasolina', 'diesel', 'glp', 'gnv', 'hibrido', 'electrico']
const METODOS_PAGO = ['efectivo', 'transferencia', 'financiamiento', 'credito', 'tarjeta']
const CANALES = ['web', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'referido', 'presencial']
const TIPOS_CITA = ['tasacion', 'test_drive', 'entrega', 'firma', 'otro']
const CATEGORIAS_EGRESO = ['taller', 'publicidad', 'planilla', 'alquiler', 'tramites', 'otros']

/* ---------------- Helpers ---------------- */
function money(v: any) {
  const n = Number(v || 0)
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function formatFecha(v: any) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function mesDe(v: any) {
  const d = new Date(v)
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const mesActual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function colorEstado(e: string) {
  const m: Record<string, string> = {
    nuevo: 'info', contactado: 'warning', atendido: 'success',
    tasado: 'purple', comprado: 'success', descartado: 'error', todos: 'primary',
  }
  return m[e] || 'grey'
}
function colorEstadoCliente(e: string) {
  const m: Record<string, string> = {
    nuevo: 'info', contactado: 'warning', en_negociacion: 'purple', cerrado: 'success', descartado: 'error',
  }
  return m[e] || 'grey'
}
function colorEstadoVeh(e: string) {
  const m: Record<string, string> = {
    disponible: 'success', reservado: 'warning', vendido: 'grey', en_preparacion: 'info',
  }
  return m[e] || 'grey'
}
function colorEstadoCita(e: string) {
  const m: Record<string, string> = {
    pendiente: 'warning', confirmada: 'info', completada: 'success', cancelada: 'error',
  }
  return m[e] || 'grey'
}

/* ══════════════════════════════════════════════════════════════════════════
   SOLICITUDES WEB (los 2 formularios de la página)
   ══════════════════════════════════════════════════════════════════════════ */
const solicitudesCompra = ref<any[]>([])
const solicitudesVenta = ref<any[]>([])
const solTab = ref<'venta' | 'compra'>('venta')
const solSearch = ref('')
const solEstadoFiltro = ref('todos')
const expandedSol = ref<string | null>(null)

const estadosActuales = computed(() => solTab.value === 'venta' ? ESTADOS_VENTA : ESTADOS_COMPRA)
const solicitudesActuales = computed(() => solTab.value === 'venta' ? solicitudesVenta.value : solicitudesCompra.value)

function contarEstado(e: string) {
  return solicitudesActuales.value.filter(s => (s.estado || 'nuevo') === e).length
}

const solicitudesFiltradas = computed(() => {
  let lista = solicitudesActuales.value
  if (solEstadoFiltro.value !== 'todos') {
    lista = lista.filter(s => (s.estado || 'nuevo') === solEstadoFiltro.value)
  }
  if (solSearch.value) {
    const q = solSearch.value.toLowerCase()
    lista = lista.filter(s =>
      [s.nombre_completo, s.celular, s.correo, s.placa, s.marca, s.modelo, s.distrito]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }
  return lista
})

const solicitudesRecientes = computed(() => {
  const compra = solicitudesCompra.value.map(s => ({ ...s, tipo: 'compra' }))
  const venta = solicitudesVenta.value.map(s => ({ ...s, tipo: 'venta' }))
  return [...compra, ...venta]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
})

function toggleSol(id: string) { expandedSol.value = expandedSol.value === id ? null : id }

function waLink(s: any) {
  const tel = String(s.celular || '').replace(/\D/g, '')
  const num = tel.length === 9 ? `51${tel}` : tel
  const auto = [s.marca, s.modelo].filter(Boolean).join(' ')
  const msg = solTab.value === 'venta'
    ? `Hola ${s.nombre_completo}, te escribimos de Trade Cars Perú por tu ${auto || 'vehículo'} que deseas vender.`
    : `Hola ${s.nombre_completo}, te escribimos de Trade Cars Perú por tu consulta.`
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
}

async function fetchSolicitudes() {
  const [c, v] = await Promise.all([
    client.from('tradecars_solicitudes_compra').select('*').order('created_at', { ascending: false }),
    client.from('tradecars_solicitudes_venta').select('*').order('created_at', { ascending: false }),
  ])
  if (c.error) notify('Error cargando solicitudes de compra: ' + c.error.message, 'error')
  if (v.error) notify('Error cargando solicitudes de venta: ' + v.error.message, 'error')
  solicitudesCompra.value = c.data || []
  solicitudesVenta.value = v.data || []
}

async function guardarSolicitud(s: any) {
  const tabla = solTab.value === 'venta' ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  const payload: Record<string, any> = {
    estado: s.estado || 'nuevo',
    notas: s.notas || null,
    atendido_por: currentUser.value.full_name || currentUser.value.email || null,
    atendido_en: new Date().toISOString(),
  }
  if (solTab.value === 'venta') payload.precio_ofrecido = s.precio_ofrecido ? Number(s.precio_ofrecido) : null
  const { error } = await (client.from(tabla) as any).update(payload).eq('id', s.id)
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify('Solicitud actualizada')
  await fetchSolicitudes()
}

async function eliminarSolicitud(s: any) {
  if (!confirm(`¿Eliminar la solicitud de ${s.nombre_completo}?`)) return
  const tabla = solTab.value === 'venta' ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  const { error } = await client.from(tabla).delete().eq('id', s.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Solicitud eliminada')
  expandedSol.value = null
  await fetchSolicitudes()
}

/** Crea un cliente en el CRM a partir de una solicitud web. */
async function convertirEnCliente(s: any) {
  const esVenta = solTab.value === 'venta'
  const payload: Record<string, any> = {
    tipo: esVenta ? 'vendedor' : 'comprador',
    nombre_completo: s.nombre_completo,
    telefono: s.celular || null,
    correo: s.correo || null,
    distrito: s.distrito || null,
    canal: 'web',
    estado: 'contactado',
    notas: s.mensaje || null,
  }
  if (esVenta) {
    payload.vehiculo_marca = s.marca || null
    payload.vehiculo_modelo = s.modelo || null
    payload.vehiculo_anio = s.anio || null
    payload.vehiculo_placa = s.placa || null
    payload.vehiculo_km = s.kilometraje || null
    payload.tiene_deuda = s.tiene_deuda === 'si'
    payload.solicitud_venta_id = s.id
  } else {
    payload.solicitud_compra_id = s.id
  }

  const { data, error } = await (client.from('tradecars_clientes') as any).insert(payload).select('id').single()
  if (error) { notify('Error creando cliente: ' + error.message, 'error'); return }

  const tabla = esVenta ? 'tradecars_solicitudes_venta' : 'tradecars_solicitudes_compra'
  await (client.from(tabla) as any)
    .update({ cliente_id: data?.id, estado: 'contactado' }).eq('id', s.id)

  notify('Cliente creado desde la solicitud')
  await Promise.all([fetchSolicitudes(), fetchClientes()])
}

/* ══════════════════════════════════════════════════════════════════════════
   CLIENTES (compradores / vendedores)
   ══════════════════════════════════════════════════════════════════════════ */
const clientes = ref<any[]>([])
const loadingClientes = ref(false)
const clienteTab = ref<'comprador' | 'vendedor'>('comprador')
const searchClientes = ref('')
const showClienteDialog = ref(false)
const clienteForm = ref<any>(null)

const compradores = computed(() => clientes.value.filter(c => c.tipo === 'comprador' || c.tipo === 'ambos'))
const vendedores = computed(() => clientes.value.filter(c => c.tipo === 'vendedor' || c.tipo === 'ambos'))

const clientesFiltrados = computed(() => {
  const base = clienteTab.value === 'comprador' ? compradores.value : vendedores.value
  if (!searchClientes.value) return base
  const q = searchClientes.value.toLowerCase()
  return base.filter(c =>
    [c.nombre_completo, c.telefono, c.correo, c.dni, c.distrito, c.vehiculo_placa]
      .some(v => String(v ?? '').toLowerCase().includes(q))
  )
})

const headersCompradores = [
  { title: 'Nombre', key: 'nombre_completo' },
  { title: 'Teléfono', key: 'telefono' },
  { title: 'Correo', key: 'correo' },
  { title: 'Presupuesto', key: 'presupuesto' },
  { title: 'Busca', key: 'marca_interes' },
  { title: 'Canal', key: 'canal' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 100 },
]
const headersVendedores = [
  { title: 'Nombre', key: 'nombre_completo' },
  { title: 'Teléfono', key: 'telefono' },
  { title: 'Marca', key: 'vehiculo_marca' },
  { title: 'Modelo', key: 'vehiculo_modelo' },
  { title: 'Año', key: 'vehiculo_anio' },
  { title: 'Placa', key: 'vehiculo_placa' },
  { title: 'Canal', key: 'canal' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 100 },
]

async function fetchClientes() {
  loadingClientes.value = true
  const { data, error } = await client.from('tradecars_clientes').select('*').order('created_at', { ascending: false })
  if (error) notify('Error cargando clientes: ' + error.message, 'error')
  clientes.value = data || []
  loadingClientes.value = false
}

function nuevoCliente() {
  clienteForm.value = {
    tipo: clienteTab.value, nombre_completo: '', dni: '', telefono: '', correo: '', distrito: '',
    canal: 'web', estado: 'nuevo', presupuesto: null, marca_interes: '', modelo_interes: '', anio_interes: null,
    vehiculo_marca: '', vehiculo_modelo: '', vehiculo_anio: null, vehiculo_placa: '', vehiculo_km: null,
    tiene_deuda: false, notas: '',
  }
  showClienteDialog.value = true
}
function editarCliente(c: any) { clienteForm.value = { ...c }; showClienteDialog.value = true }

async function guardarCliente() {
  const f = clienteForm.value
  if (!f?.nombre_completo?.trim()) { notify('El nombre es obligatorio', 'error'); return }
  const payload = { ...f, updated_at: new Date().toISOString() }
  delete payload.created_at
  let error
  if (f.id) { ({ error } = await (client.from('tradecars_clientes') as any).update(payload).eq('id', f.id)) }
  else { delete payload.id; ({ error } = await (client.from('tradecars_clientes') as any).insert(payload)) }
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify(f.id ? 'Cliente actualizado' : 'Cliente creado')
  showClienteDialog.value = false
  await fetchClientes()
}
async function eliminarCliente(c: any) {
  if (!confirm(`¿Eliminar a ${c.nombre_completo}?`)) return
  const { error } = await client.from('tradecars_clientes').delete().eq('id', c.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Cliente eliminado'); await fetchClientes()
}

/* ══════════════════════════════════════════════════════════════════════════
   VEHÍCULOS (inventario)
   ══════════════════════════════════════════════════════════════════════════ */
const vehiculos = ref<any[]>([])
const loadingVehiculos = ref(false)
const searchVehiculos = ref('')
const filtroEstadoVeh = usePersistente('tradecars:filtroEstadoVeh', 'todos')
const showVehiculoDialog = ref(false)
const vehiculoForm = ref<any>(null)

const vehiculosDisponibles = computed(() => vehiculos.value.filter(v => v.estado === 'disponible'))
const vehiculosFiltrados = computed(() => {
  let lista = vehiculos.value
  if (filtroEstadoVeh.value !== 'todos') lista = lista.filter(v => v.estado === filtroEstadoVeh.value)
  if (searchVehiculos.value) {
    const q = searchVehiculos.value.toLowerCase()
    lista = lista.filter(v => [v.marca, v.modelo, v.placa, v.color, v.codigo].some(x => String(x ?? '').toLowerCase().includes(q)))
  }
  return lista
})
const vehiculosSelect = computed(() => vehiculos.value
  .filter(v => v.estado !== 'vendido')
  .map(v => ({ id: v.id, label: `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''} — ${v.placa || 's/placa'}`.trim() })))

function margenVeh(v: any) { return Number(v.precio_venta || 0) - Number(v.precio_compra || 0) }

const headersVehiculos = [
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Año', key: 'anio' },
  { title: 'Placa', key: 'placa' },
  { title: 'Km', key: 'kilometraje' },
  { title: 'Compra', key: 'precio_compra' },
  { title: 'Venta', key: 'precio_venta' },
  { title: 'Margen', key: 'margen', sortable: false },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 100 },
]
const headersVehiculosMini = [
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Año', key: 'anio' },
  { title: 'Precio', key: 'precio_venta' },
]

async function fetchVehiculos() {
  loadingVehiculos.value = true
  const { data, error } = await client.from('tradecars_vehiculos').select('*').order('created_at', { ascending: false })
  if (error) notify('Error cargando vehículos: ' + error.message, 'error')
  vehiculos.value = data || []
  loadingVehiculos.value = false
}
function nuevoVehiculo() {
  vehiculoForm.value = {
    marca: '', modelo: '', version: '', anio: null, placa: '', color: '', kilometraje: null,
    transmision: 'mecanica', combustible: 'gasolina', estado: 'disponible',
    precio_compra: null, precio_venta: null, propietario_nombre: '', tiene_deuda: false, notas: '',
  }
  showVehiculoDialog.value = true
}
function editarVehiculo(v: any) { vehiculoForm.value = { ...v }; showVehiculoDialog.value = true }
async function guardarVehiculo() {
  const f = vehiculoForm.value
  if (!f?.marca?.trim() || !f?.modelo?.trim()) { notify('Marca y modelo son obligatorios', 'error'); return }
  const payload = { ...f, updated_at: new Date().toISOString() }
  delete payload.created_at
  let error
  if (f.id) { ({ error } = await (client.from('tradecars_vehiculos') as any).update(payload).eq('id', f.id)) }
  else { delete payload.id; ({ error } = await (client.from('tradecars_vehiculos') as any).insert(payload)) }
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify(f.id ? 'Vehículo actualizado' : 'Vehículo creado')
  showVehiculoDialog.value = false
  await fetchVehiculos()
}
async function eliminarVehiculo(v: any) {
  if (!confirm(`¿Eliminar ${v.marca} ${v.modelo}?`)) return
  const { error } = await client.from('tradecars_vehiculos').delete().eq('id', v.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Vehículo eliminado'); await fetchVehiculos()
}

/* ══════════════════════════════════════════════════════════════════════════
   VENTAS
   ══════════════════════════════════════════════════════════════════════════ */
const ventas = ref<any[]>([])
const loadingVentas = ref(false)
const searchVentas = ref('')
const showVentaDialog = ref(false)
const ventaForm = ref<any>(null)

const ventasFiltradas = computed(() => {
  if (!searchVentas.value) return ventas.value
  const q = searchVentas.value.toLowerCase()
  return ventas.value.filter(v => [v.cliente_nombre, v.marca, v.modelo, v.placa, v.asesor]
    .some(x => String(x ?? '').toLowerCase().includes(q)))
})
const ventasMes = computed(() => ventas.value.filter(v => mesDe(v.fecha_venta || v.created_at) === mesActual() && v.estado !== 'anulada'))
const ingresosMes = computed(() => ventasMes.value.reduce((s, v) => s + Number(v.precio_venta || 0), 0))
const margenMes = computed(() => ventasMes.value.reduce((s, v) => s + margenVenta(v), 0))
function margenVenta(v: any) { return Number(v.precio_venta || 0) - Number(v.precio_compra || 0) }

const headersVentas = [
  { title: 'Cliente', key: 'cliente_nombre' },
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Precio', key: 'precio_venta' },
  { title: 'Fecha', key: 'fecha_venta' },
]
const headersVentasFull = [
  { title: 'Fecha', key: 'fecha_venta' },
  { title: 'Cliente', key: 'cliente_nombre' },
  { title: 'Teléfono', key: 'cliente_telefono' },
  { title: 'Vehículo', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Placa', key: 'placa' },
  { title: 'Precio', key: 'precio_venta' },
  { title: 'Margen', key: 'margen', sortable: false },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 60 },
]

async function fetchVentas() {
  loadingVentas.value = true
  const { data, error } = await client.from('tradecars_ventas').select('*').order('fecha_venta', { ascending: false })
  if (error) notify('Error cargando ventas: ' + error.message, 'error')
  ventas.value = data || []
  loadingVentas.value = false
}
function nuevaVenta() {
  ventaForm.value = {
    vehiculo_id: null, cliente_nombre: '', cliente_dni: '', cliente_telefono: '',
    marca: '', modelo: '', anio: null, placa: '', precio_venta: null, precio_compra: null,
    metodo_pago: 'efectivo', estado: 'completada', asesor: currentUser.value.full_name || '',
    fecha_venta: new Date().toISOString().slice(0, 10), notas: '',
  }
  showVentaDialog.value = true
}
function onVehiculoVenta(id: string) {
  const v = vehiculos.value.find(x => x.id === id)
  if (!v || !ventaForm.value) return
  ventaForm.value.marca = v.marca
  ventaForm.value.modelo = v.modelo
  ventaForm.value.anio = v.anio
  ventaForm.value.placa = v.placa
  ventaForm.value.precio_compra = v.precio_compra
  if (!ventaForm.value.precio_venta) ventaForm.value.precio_venta = v.precio_venta
}
async function guardarVenta() {
  const f = ventaForm.value
  if (!f?.cliente_nombre?.trim()) { notify('El cliente es obligatorio', 'error'); return }
  if (!f?.precio_venta) { notify('El precio de venta es obligatorio', 'error'); return }
  const { error } = await (client.from('tradecars_ventas') as any).insert({ ...f })
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  // Marca el vehículo como vendido
  if (f.vehiculo_id && f.estado === 'completada') {
    await (client.from('tradecars_vehiculos') as any).update({ estado: 'vendido' }).eq('id', f.vehiculo_id)
  }
  notify('Venta registrada')
  showVentaDialog.value = false
  await Promise.all([fetchVentas(), fetchVehiculos()])
}
async function eliminarVenta(v: any) {
  if (!confirm('¿Eliminar esta venta?')) return
  const { error } = await client.from('tradecars_ventas').delete().eq('id', v.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Venta eliminada'); await fetchVentas()
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPRAS
   ══════════════════════════════════════════════════════════════════════════ */
const compras = ref<any[]>([])
const loadingCompras = ref(false)
const searchCompras = ref('')
const showCompraDialog = ref(false)
const compraForm = ref<any>(null)

const comprasFiltradas = computed(() => {
  if (!searchCompras.value) return compras.value
  const q = searchCompras.value.toLowerCase()
  return compras.value.filter(c => [c.proveedor_nombre, c.marca, c.modelo, c.placa]
    .some(x => String(x ?? '').toLowerCase().includes(q)))
})

const headersCompras = [
  { title: 'Fecha', key: 'fecha_compra' },
  { title: 'Vendedor', key: 'proveedor_nombre' },
  { title: 'Teléfono', key: 'proveedor_telefono' },
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Año', key: 'anio' },
  { title: 'Placa', key: 'placa' },
  { title: 'Tasación', key: 'precio_tasacion' },
  { title: 'Compra', key: 'precio_compra' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 60 },
]

async function fetchCompras() {
  loadingCompras.value = true
  const { data, error } = await client.from('tradecars_compras').select('*').order('fecha_compra', { ascending: false })
  if (error) notify('Error cargando compras: ' + error.message, 'error')
  compras.value = data || []
  loadingCompras.value = false
}
function nuevaCompra() {
  compraForm.value = {
    proveedor_nombre: '', proveedor_dni: '', proveedor_telefono: '',
    marca: '', modelo: '', anio: null, placa: '', kilometraje: null,
    precio_tasacion: null, precio_compra: null, tiene_deuda: false,
    estado: 'completada', asesor: currentUser.value.full_name || '',
    fecha_compra: new Date().toISOString().slice(0, 10), notas: '', crear_vehiculo: true,
  }
  showCompraDialog.value = true
}
async function guardarCompra() {
  const f = compraForm.value
  if (!f?.proveedor_nombre?.trim()) { notify('El vendedor es obligatorio', 'error'); return }
  if (!f?.precio_compra) { notify('El precio de compra es obligatorio', 'error'); return }

  const { crear_vehiculo, ...payload } = f
  let vehiculo_id: string | null = null

  // Si se pide, primero crea el vehículo en inventario
  if (crear_vehiculo) {
    const { data, error } = await (client.from('tradecars_vehiculos') as any).insert({
      marca: f.marca, modelo: f.modelo, anio: f.anio, placa: f.placa, kilometraje: f.kilometraje,
      precio_compra: f.precio_compra, estado: 'en_preparacion', tiene_deuda: !!f.tiene_deuda,
      propietario_nombre: f.proveedor_nombre, fecha_ingreso: f.fecha_compra,
    }).select('id').single()
    if (error) { notify('Error creando el vehículo: ' + error.message, 'error'); return }
    vehiculo_id = data?.id ?? null
  }

  const { error } = await (client.from('tradecars_compras') as any).insert({ ...payload, vehiculo_id })
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify(crear_vehiculo ? 'Compra registrada y auto agregado al inventario' : 'Compra registrada')
  showCompraDialog.value = false
  await Promise.all([fetchCompras(), fetchVehiculos()])
}
async function eliminarCompra(c: any) {
  if (!confirm('¿Eliminar esta compra?')) return
  const { error } = await client.from('tradecars_compras').delete().eq('id', c.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Compra eliminada'); await fetchCompras()
}

/* ══════════════════════════════════════════════════════════════════════════
   LEADS
   ══════════════════════════════════════════════════════════════════════════ */
const leadsWpp = ref<any[]>([])
const leadsFbIg = ref<any[]>([])
const leadsTab = ref<'wpp' | 'fbig'>('wpp')
const searchLeads = ref('')

const leadsFiltrados = computed(() => {
  const base = leadsTab.value === 'wpp' ? leadsWpp.value : leadsFbIg.value
  if (!searchLeads.value) return base
  const q = searchLeads.value.toLowerCase()
  return base.filter(l => [l.nombre, l.numero, l.instagram_handle, l.correo, l.marca_interes]
    .some(v => String(v ?? '').toLowerCase().includes(q)))
})

const headersLeadsWpp = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Teléfono', key: 'numero' },
  { title: 'Interés', key: 'interes' },
  { title: 'Busca', key: 'marca_interes' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Fecha', key: 'created_at' },
]
const headersLeadsFbIg = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Instagram', key: 'instagram_handle' },
  { title: 'Interés', key: 'interes' },
  { title: 'Busca', key: 'marca_interes' },
  { title: 'Estado', key: 'lead_status' },
  { title: 'Fecha', key: 'created_at' },
]

async function fetchLeads() {
  const [w, f] = await Promise.all([
    client.from('GeneralBDwppTRADECARS').select('*').order('created_at', { ascending: false }),
    client.from('GeneralBDfbigTRADECARS').select('*').order('created_at', { ascending: false }),
  ])
  leadsWpp.value = w.data || []
  leadsFbIg.value = f.data || []
}

/* ══════════════════════════════════════════════════════════════════════════
   FUNNEL DE COMPRAS  (reemplazo del Power BI — minuta 26/08/2026)

   Una sola carga alimenta los tres módulos: embudo, tabla de leads y análisis
   de conversión. La etapa y la fecha del funnel las calcula la BD en columnas
   GENERATED, y utils/tradecarsFunnel.ts las recalcula en vivo para filtrar sin
   ir al servidor en cada cambio.
   ══════════════════════════════════════════════════════════════════════════ */
const CHATWOOT_ACCOUNT_ID = 17          // cuenta de Trade Cars en Chatwoot

const funnelLeads = ref<any[]>([])
const asesores = ref<any[]>([])
const motivosNoCita = ref<any[]>([])
const zonificacion = ref<any[]>([])
const marcasCatalogo = ref<any[]>([])
const costosCampana = ref<any[]>([])
const loadingFunnel = ref(false)

const asesoresNombres = computed(() =>
  asesores.value.filter(a => a.activo !== false).map(a => a.nombre))

/**
 * Campañas que ya existen en la base de Trade Cars (BASE COMPRAS del asesor).
 * Es un combobox, no un select cerrado: si aparece una campaña nueva se escribe
 * y queda disponible, sin esperar un cambio de código.
 */
const CAMPANAS_BASE = [
  'VENDE TU AUTO', 'LIMA REGULAR', 'NEOAUTO', 'TIK TOK', 'WEB', 'INTERACCIÓN',
  'TRAFICO WTP 1', 'TRAFICO WTP 2', 'TRAFICO MARCAS', 'ZONA 1', 'ZONA 2',
  'POR VIAJE', 'BÚSQUEDA PROPIA', 'REFERIDOS', 'MARKETPLACE PROPIA',
]
const campanasConocidas = computed(() => {
  const set = new Set<string>(CAMPANAS_BASE)
  for (const l of funnelLeads.value) if (l.campana) set.add(l.campana)
  return [...set].sort()
})

/** Leads con el seguimiento vencido: alimenta el badge rojo del menú. */
const alertasVencidas = computed(() =>
  funnelLeads.value.filter(l => tcSeguimientoVencido(l)).length)

/**
 * Trae TODOS los leads del funnel.
 *
 * Dos cosas que no son opcionales aquí:
 *
 * 1. Paginar. Supabase corta en 1.000 filas por consulta y el histórico
 *    migrado del Excel son ~8.700: sin el bucle el embudo mostraría menos de
 *    la octava parte de los leads y nadie se daría cuenta, porque no da error.
 *
 * 2. Desempatar el ORDER BY con `id`. La migración escribió las 8.737 filas en
 *    lotes, así que sólo hay 20 valores distintos de created_at. Con un orden
 *    no total, Postgres no garantiza el mismo reparto entre páginas y se
 *    repiten filas mientras otras no salen nunca: medido, 334 duplicadas.
 *    El embudo daba 230 compras donde la base tiene 229.
 */
async function fetchFunnelLeads() {
  const PAGINA = 1000
  const todos: any[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await client
      .from('tradecars_funnel_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })        // desempate: sin esto el paginado repite filas
      .range(desde, desde + PAGINA - 1)
    if (error) return { data: todos, error }
    todos.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return { data: todos, error: null }
}

async function fetchFunnel() {
  loadingFunnel.value = true
  try {
    const [leads, ases, mot, zon, marc, cost] = await Promise.all([
      fetchFunnelLeads(),
      client.from('tradecars_asesores').select('*').order('orden'),
      client.from('tradecars_funnel_motivos').select('*').eq('activo', true).order('orden'),
      client.from('tradecars_zonificacion').select('*').order('distrito'),
      client.from('tradecars_marcas').select('*').eq('activo', true).order('marca'),
      client.from('tradecars_campana_costos').select('*').order('mes', { ascending: false }),
    ])
    funnelLeads.value = leads.data || []
    asesores.value = ases.data || []
    motivosNoCita.value = mot.data || []
    zonificacion.value = zon.data || []
    marcasCatalogo.value = marc.data || []
    costosCampana.value = cost.data || []

    // La tabla es nueva: si aún no se corrió el SQL, se avisa en vez de fallar en silencio
    if (leads.error) {
      console.warn('[tradecars/funnel]', leads.error.message)
      notify('Falta correr sql/tradecars_funnel.sql en Supabase', 'warning')
    }
  } finally {
    loadingFunnel.value = false
  }
}

/* ---------------- Autocompletado desde los catálogos ----------------
   La BD hace lo mismo en el trigger `tradecars_funnel_autocompletar`, que es
   lo que protege al endpoint del CRM y a la migración. Aquí se repite en el
   cliente sólo para que el asesor VEA la zona y la prioridad mientras escribe,
   sin tener que guardar primero.                                              */

/** Mismo criterio que tc_normalizar() en SQL y tcNormalizar() en utils/. */
function claveCatalogo(v: any): string {
  return String(v ?? '').toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}
const soloAlfanum = (v: string) => v.replace(/[^A-Z0-9]/g, '')

/** Nombres canónicos para el desplegable (sin los alias, que ensuciarían). */
const distritosCanonicos = computed(() =>
  [...new Set(zonificacion.value.filter(z => !z.es_alias).map(z => z.distrito))].sort())
const marcasCanonicas = computed(() =>
  [...new Set(marcasCatalogo.value.filter(m => !m.es_alias).map(m => m.marca))].sort())

function buscarZona(distrito: any) {
  const k = claveCatalogo(distrito)
  if (!k) return null
  return zonificacion.value.find(z => z.clave === k)
    || zonificacion.value.filter(z => k.startsWith(z.clave + ' '))
         .sort((a, b) => b.clave.length - a.clave.length)[0]
    || zonificacion.value.find(z => soloAlfanum(z.clave) === soloAlfanum(k))
    || null
}

function buscarMarca(marca: any) {
  const k = claveCatalogo(marca)
  if (!k) return null
  const primera = k.split(' ')[0]
  return marcasCatalogo.value.find(m => m.clave === k)
    || marcasCatalogo.value.find(m => m.clave === primera)
    || marcasCatalogo.value.find(m => soloAlfanum(m.clave) === soloAlfanum(k))
    || null
}

/** Zona resuelta para el lead que se está editando (sólo lectura en la UI). */
const zonaResuelta = computed(() => buscarZona(funnelForm.value?.distrito))
const marcaResuelta = computed(() => buscarMarca(funnelForm.value?.marca))

/* ---------------- Edición del lead desde el dashboard ---------------- */
const showFunnelDialog = ref(false)
const funnelForm = ref<any>(null)

function editarFunnelLead(lead: any) {
  // Se copian sólo los campos editables: etapa/fecha_funnel las calcula la BD
  funnelForm.value = {
    id: lead.id,
    contacto_nombre: lead.contacto_nombre,
    contacto_telefono: lead.contacto_telefono,
    canal_origen: lead.canal_origen,
    asesor: lead.asesor,
    fecha_derivacion: lead.fecha_derivacion,
    perfil_coincide: tcPerfilCoincide(lead.perfil_coincide) ? 'SI' : 'NO',
    status: tcStatusValido(lead.status) || null,
    fecha_cita: lead.fecha_cita,
    fecha_cita_asistida: lead.fecha_cita_asistida,
    fecha_compra: lead.fecha_compra,
    motivo_no_cita: lead.motivo_no_cita,
    fecha_probable_venta: lead.fecha_probable_venta,
    proxima_accion: lead.proxima_accion,
    fecha_seguimiento: lead.fecha_seguimiento,
    observaciones: lead.observaciones,
    // Campos del Excel del asesor (no afectan el cálculo del funnel)
    placa: lead.placa, marca: lead.marca, modelo: lead.modelo, version: lead.version,
    anio: lead.anio, kilometraje: lead.kilometraje,
    monto_propuesta_inicial: lead.monto_propuesta_inicial,
    monto_mejorado: lead.monto_mejorado,
    expectativa_cliente: lead.expectativa_cliente,
    campana: lead.campana, distrito: lead.distrito, zona: lead.zona, correo: lead.correo,
    tiene_deuda: lead.tiene_deuda, banco: lead.banco,
    fecha_llegada: lead.fecha_llegada,
    fecha_ultimo_contacto: lead.fecha_ultimo_contacto,
    num_contactos: lead.num_contactos, feedback: lead.feedback,
    _statusOriginal: lead.status,
  }
  showFunnelDialog.value = true
}

function nuevoFunnelLead() {
  funnelForm.value = {
    contacto_nombre: '', contacto_telefono: '', canal_origen: 'WhatsApp',
    asesor: asesoresNombres.value[0] || '', fecha_derivacion: tcHoyLima(),
    perfil_coincide: 'SI', status: 'NO CONTACTADO',
    fecha_cita: null, fecha_cita_asistida: null, fecha_compra: null, motivo_no_cita: null,
    fecha_probable_venta: null, proxima_accion: '', fecha_seguimiento: null,
    observaciones: '',
    placa: '', marca: '', modelo: '', version: '', anio: '', kilometraje: null,
    monto_propuesta_inicial: null, monto_mejorado: null, expectativa_cliente: null,
    campana: '', distrito: '', zona: '', correo: '',
    tiene_deuda: 'NO', banco: '', fecha_llegada: null,
    fecha_ultimo_contacto: null, num_contactos: null, feedback: '',
  }
  showFunnelDialog.value = true
}

/** La etapa que va a quedar tras guardar: se muestra en vivo dentro del diálogo. */
const etapaPrevista = computed(() =>
  funnelForm.value ? tcEtapa(funnelForm.value) : null)

/** La fecha con la que el lead caerá en el embudo tras guardar. */
const fechaFunnelPrevista = computed(() =>
  funnelForm.value ? tcFechaFunnel(funnelForm.value) : null)

async function guardarFunnelLead() {
  const f = funnelForm.value
  if (!f) return
  if (!f.contacto_nombre?.trim()) return notify('El nombre del cliente es obligatorio', 'error')

  // CITA / CITA ASISTIDA necesitan fecha de cita, y CONCRETADA fecha de compra:
  // sin eso el lead caería en el mes equivocado del embudo.
  if ((f.status === 'CITA' || f.status === 'CITA ASISTIDA') && !f.fecha_cita) {
    return notify('Con status ' + f.status + ' hace falta la fecha de cita', 'error')
  }
  if (f.status === 'CITA ASISTIDA' && !f.fecha_cita_asistida) {
    return notify('Con status CITA ASISTIDA hace falta la fecha en que se realizó la cita', 'error')
  }
  if (f.status === 'CONCRETADA' && !f.fecha_compra) {
    return notify('Con status CONCRETADA hace falta la fecha de compra', 'error')
  }

  const fila: Record<string, any> = { ...f }
  delete fila._statusOriginal
  delete fila.id
  // zona, marca_normalizada y marca_prioridad los resuelve el trigger de la BD
  // contra los catálogos: mandarlos desde aquí sólo abriría la puerta a que la
  // UI y la BD se contradigan.
  delete fila.zona
  delete fila.marca_normalizada
  delete fila.marca_prioridad
  for (const k of Object.keys(fila)) if (fila[k] === '') fila[k] = null

  const { error } = f.id
    ? await client.from('tradecars_funnel_leads').update(fila).eq('id', f.id)
    : await client.from('tradecars_funnel_leads').insert(fila)

  if (error) return notify('No se pudo guardar: ' + error.message, 'error')

  showFunnelDialog.value = false
  logActivity((f.id ? 'Editó' : 'Creó') + ' lead del funnel: ' + f.contacto_nombre)
  await fetchFunnel()
  notify(f.id ? 'Lead actualizado' : 'Lead creado')
}

/* ══════════════════════════════════════════════════════════════════════════
   AGENDA / CITAS
   ══════════════════════════════════════════════════════════════════════════ */
const citas = ref<any[]>([])
const loadingCitas = ref(false)
const filtroTipoCita = usePersistente('tradecars:filtroTipoCita', 'todos')
const showCitaDialog = ref(false)
const citaForm = ref<any>(null)

const citasFiltradas = computed(() => {
  if (filtroTipoCita.value === 'todos') return citas.value
  return citas.value.filter(c => c.tipo === filtroTipoCita.value)
})

const headersCitas = [
  { title: 'Fecha', key: 'date' },
  { title: 'Hora', key: 'time' },
  { title: 'Tipo', key: 'tipo' },
  { title: 'Cliente', key: 'cliente', sortable: false },
  { title: 'Teléfono', key: 'client_phone' },
  { title: 'Vehículo', key: 'marca' },
  { title: 'Asesor', key: 'asesor' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false, width: 100 },
]

async function fetchCitas() {
  loadingCitas.value = true
  const { data, error } = await client.from('tradecars_calendar_events').select('*').order('date', { ascending: false })
  if (error) notify('Error cargando citas: ' + error.message, 'error')
  citas.value = data || []
  loadingCitas.value = false
}
function nuevaCita() {
  citaForm.value = {
    tipo: 'tasacion', estado: 'pendiente', date: new Date().toISOString().slice(0, 10), time: '',
    client_name: '', client_surname: '', client_phone: '', client_email: '',
    marca: '', modelo: '', placa: '', asesor: currentUser.value.full_name || '', notas: '',
  }
  showCitaDialog.value = true
}
function editarCita(c: any) { citaForm.value = { ...c }; showCitaDialog.value = true }
async function guardarCita() {
  const f = citaForm.value
  if (!f?.client_name?.trim()) { notify('El nombre del cliente es obligatorio', 'error'); return }
  if (!f?.date) { notify('La fecha es obligatoria', 'error'); return }
  const payload = { ...f, title: f.title || `${f.tipo} — ${f.client_name}`, updated_at: new Date().toISOString() }
  delete payload.created_at
  let error
  if (f.id) { ({ error } = await (client.from('tradecars_calendar_events') as any).update(payload).eq('id', f.id)) }
  else { delete payload.id; ({ error } = await (client.from('tradecars_calendar_events') as any).insert(payload)) }
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify(f.id ? 'Cita actualizada' : 'Cita creada')
  showCitaDialog.value = false
  await fetchCitas()
}
async function eliminarCita(c: any) {
  if (!confirm('¿Eliminar esta cita?')) return
  const { error } = await client.from('tradecars_calendar_events').delete().eq('id', c.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Cita eliminada'); await fetchCitas()
}

/* ══════════════════════════════════════════════════════════════════════════
   EGRESOS
   ══════════════════════════════════════════════════════════════════════════ */
const egresos = ref<any[]>([])
const loadingEgresos = ref(false)
const searchEgresos = ref('')
const showEgresoDialog = ref(false)
const egresoForm = ref<any>(null)

const egresosFiltrados = computed(() => {
  const base = egresos.value.filter(e => !e.deleted_at)
  if (!searchEgresos.value) return base
  const q = searchEgresos.value.toLowerCase()
  return base.filter(e => [e.nombre, e.categoria, e.referencia].some(v => String(v ?? '').toLowerCase().includes(q)))
})
const totalEgresos = computed(() => egresosFiltrados.value
  .reduce((s, e) => s + Number(e.precio || 0) * Number(e.cantidad || 1), 0))

const headersEgresos = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Concepto', key: 'nombre' },
  { title: 'Categoría', key: 'categoria' },
  { title: 'Monto', key: 'precio' },
  { title: 'Cant.', key: 'cantidad' },
  { title: 'Total', key: 'total', sortable: false },
  { title: 'Método', key: 'metodo_pago' },
  { title: '', key: 'acciones', sortable: false, width: 60 },
]

async function fetchEgresos() {
  loadingEgresos.value = true
  const { data, error } = await client.from('tradecars_egresos').select('*').order('fecha', { ascending: false })
  if (error) notify('Error cargando egresos: ' + error.message, 'error')
  egresos.value = data || []
  loadingEgresos.value = false
}
function nuevoEgreso() {
  egresoForm.value = {
    nombre: '', categoria: 'otros', precio: null, cantidad: 1, metodo_pago: 'efectivo',
    referencia: '', fecha: new Date().toISOString().slice(0, 10),
  }
  showEgresoDialog.value = true
}
async function guardarEgreso() {
  const f = egresoForm.value
  if (!f?.nombre?.trim()) { notify('El concepto es obligatorio', 'error'); return }
  if (!f?.precio) { notify('El monto es obligatorio', 'error'); return }
  const { error } = await (client.from('tradecars_egresos') as any).insert({ ...f })
  if (error) { notify('Error guardando: ' + error.message, 'error'); return }
  notify('Egreso registrado')
  showEgresoDialog.value = false
  await fetchEgresos()
}
async function eliminarEgreso(e: any) {
  if (!confirm('¿Eliminar este egreso?')) return
  const { error } = await client.from('tradecars_egresos').delete().eq('id', e.id)
  if (error) { notify('Error eliminando: ' + error.message, 'error'); return }
  notify('Egreso eliminado'); await fetchEgresos()
}

/* ══════════════════════════════════════════════════════════════════════════
   STATS + CHART
   ══════════════════════════════════════════════════════════════════════════ */
const headersSolicitudesMini = [
  { title: 'Tipo', key: 'tipo' },
  { title: 'Nombre', key: 'nombre_completo' },
  { title: 'Celular', key: 'celular' },
  { title: 'Vehículo', key: 'marca' },
  { title: 'Fecha', key: 'created_at' },
]

const solicitudesNuevas = computed(() =>
  [...solicitudesCompra.value, ...solicitudesVenta.value].filter(s => (s.estado || 'nuevo') === 'nuevo').length)

const stats = computed(() => [
  {
    title: 'Autos en stock',
    value: String(vehiculosDisponibles.value.length),
    change: `${vehiculos.value.length} total`,
    trend: 'up' as const,
    subtitle: 'disponibles',
    description: 'Vehículos listos para vender',
  },
  {
    title: 'Ventas del mes',
    value: String(ventasMes.value.length),
    change: money(ingresosMes.value),
    trend: 'up' as const,
    subtitle: 'ingresos del mes',
    description: 'Unidades vendidas este mes',
  },
  {
    title: 'Solicitudes sin atender',
    value: String(solicitudesNuevas.value),
    change: `${solicitudesVenta.value.length + solicitudesCompra.value.length} total`,
    trend: solicitudesNuevas.value > 0 ? 'down' as const : 'up' as const,
    subtitle: 'llegadas de la web',
    description: 'Formularios pendientes de contactar',
  },
  {
    title: 'Margen del mes',
    value: money(margenMes.value),
    change: '',
    trend: margenMes.value >= 0 ? 'up' as const : 'down' as const,
    subtitle: 'venta - compra',
    description: 'Utilidad bruta de las ventas del mes',
  },
])

/** Últimos 6 meses en formato YYYY-MM */
const ultimos6Meses = computed(() => {
  const out: string[] = []
  const d = new Date()
  for (let i = 5; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
})

const series = computed(() => [
  {
    name: 'Quieren vender',
    data: ultimos6Meses.value.map(m => solicitudesVenta.value.filter(s => mesDe(s.created_at) === m).length),
  },
  {
    name: 'Quieren comprar',
    data: ultimos6Meses.value.map(m => solicitudesCompra.value.filter(s => mesDe(s.created_at) === m).length),
  },
  {
    name: 'Ventas cerradas',
    data: ultimos6Meses.value.map(m => ventas.value.filter(v => mesDe(v.fecha_venta || v.created_at) === m).length),
  },
])

const chartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#d32f2f', '#1976d2', '#2e7d32'],
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
  xaxis: {
    categories: ultimos6Meses.value.map(m => {
      const [y, mm] = m.split('-')
      return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
    }),
  },
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  tooltip: { theme: isDark.value ? 'dark' : 'light' },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
}))

/* ══════════════════════════════════════════════════════════════════════════
   LIFECYCLE
   ══════════════════════════════════════════════════════════════════════════ */
async function refreshAll() {
  await Promise.all([
    fetchSolicitudes(), fetchClientes(), fetchVehiculos(),
    fetchVentas(), fetchCompras(), fetchLeads(), fetchCitas(), fetchEgresos(),
    fetchFunnel(),
  ])
  notify('Datos actualizados')
}

onMounted(async () => {
  if (!canAccessTradeCars(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }
  applyTheme()
  await Promise.all([
    fetchSolicitudes(), fetchClientes(), fetchVehiculos(),
    fetchVentas(), fetchCompras(), fetchLeads(), fetchCitas(), fetchEgresos(),
    fetchFunnel(),
  ])
})
</script>

<style scoped>
/* ---- Solicitudes web: grid de tarjetas expandibles ---- */
.sol-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.sol-filtros {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
  align-items: start;
}

.sol-card {
  padding: 16px;
  cursor: pointer;
  border-radius: 14px;
  transition: transform .15s ease, box-shadow .15s ease;
}

.sol-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, .16);
}

.sol-card--open {
  grid-column: 1 / -1;
  cursor: default;
}

.sol-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sol-card-ident {
  flex: 1;
  min-width: 0;
}

.sol-card-nombre {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sol-card-fecha {
  font-size: 12px;
  opacity: .6;
}

.sol-card-resumen {
  margin-top: 12px;
}

.sol-veh {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  margin-bottom: 6px;
}

.sol-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12.5px;
  opacity: .8;
}

.sol-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sol-msg-preview {
  margin-top: 10px;
  font-size: 12.5px;
  font-style: italic;
  opacity: .65;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sol-card-detalle {
  margin-top: 14px;
  cursor: default;
}

.sol-campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.sol-campo {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sol-campo span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .4px;
  opacity: .55;
}

.sol-campo strong {
  font-size: 14px;
  word-break: break-word;
}

.sol-mensaje {
  margin-top: 14px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(128, 128, 128, .1);
  font-size: 13.5px;
}

.sol-mensaje-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .4px;
  opacity: .55;
  margin-bottom: 4px;
}

.sol-acciones {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.sol-empty {
  text-align: center;
  padding: 60px 20px;
  opacity: .6;
}

.sol-empty p {
  margin: 12px 0 4px;
  font-size: 15px;
}

/* ---- Formularios de los diálogos ---- */
.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-section-title {
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: .4px;
  opacity: .6;
  margin-bottom: 10px;
}

@media (max-width: 700px) {
  .form-grid-2 {
    grid-template-columns: 1fr;
  }
}

/* ══════════ Funnel de compras ══════════ */

/* Contador rojo de seguimientos vencidos, en el ítem del menú */
.nav-badge {
  margin-left: auto;
  background: #dc2626;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Marca el campo de fecha que falta según el status elegido */
.chip-prioridad {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  align-self: center;
}
.chip-prioridad.p1 { background: rgba(22, 163, 74, 0.16); color: #16a34a; }
.chip-prioridad.p2 { background: rgba(217, 119, 6, 0.16); color: #d97706; }
.chip-prioridad.p3 { background: rgba(148, 163, 184, 0.16); color: var(--muted-foreground); }
.chip-prioridad.sin { background: rgba(148, 163, 184, 0.12); color: var(--muted-foreground); }
.chip-prioridad.desconocida { background: rgba(220, 38, 38, 0.14); color: #dc2626; }

.campo-requerido :deep(.v-field) {
  border-color: #dc2626;
  box-shadow: 0 0 0 1px #dc2626 inset;
  border-radius: 4px;
}
</style>