<template>
  <div class="dashboard-container" :data-theme="isDark ? 'dark' : 'light'">
    <!-- ==========  SIDEBAR  ========== -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo" style="gap: 0.5rem;">
          <div style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #fff;">
            <v-img :src="logoUrl" alt="SGS Logo" style="width: 100%; height: 100%;" />
          </div>
          <template v-if="isSuperAdmin(currentUser)">
            <v-menu v-model="showDashboardMenu">
              <template v-slot:activator="{ props }">
                <div v-bind="props" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <span class="logo-text">SGS</span>
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
          <span v-else class="logo-text">SGS</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-label">Operación</div>
          <button v-for="item in menuItems" :key="item.id" :class="['nav-item', { active: activeView === item.id }]"
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
            <button class="user-menu" v-bind="props"><v-icon icon="mdi-menu-down" size="16" /></button>
          </template>
          <v-list class="user-dropdown" density="compact">
            <v-list-item @click="logout" prepend-icon="mdi-logout">
              <v-list-item-title>Logout</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </aside>

    <!-- ==========  MAIN  ========== -->
    <div class="main-content">

      <!-- ========== VISTA: DASHBOARD ========== -->
      <div v-if="activeView === 'dashboard'" class="view-container">
        <header class="top-header">
          <h1>Dashboard</h1>
          <button class="btn-primary" @click="refreshAll">
            <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
          </button>
        </header>
        <div class="content-area">
          <div class="stats-grid">
            <div v-for="(stat, i) in stats" :key="i" class="stat-card">
              <div class="stat-header">
                <span class="stat-title">{{ stat.title }}</span>
                <div :class="['stat-change', stat.trend]">{{ stat.change }}</div>
              </div>
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-description">{{ stat.description }}</div>
            </div>
          </div>

          <div class="chart-section">
            <div class="chart-header">
              <div class="chart-title-section">
                <h2>Tickets por día</h2>
                <div class="chart-subtitle">Recepción de los últimos 14 días, por sede</div>
              </div>
            </div>
            <div class="chart-area">
              <client-only>
                <apexchart type="area" height="320" :options="chartOptions" :series="series" />
              </client-only>
            </div>
          </div>

          <div class="table-section">
            <div class="table-tabs">
              <button :class="['tab', { active: dashTab === 'recientes' }]" @click="dashTab = 'recientes'">Tickets recientes</button>
              <button :class="['tab', { active: dashTab === 'riesgo' }]" @click="dashTab = 'riesgo'">TAT en riesgo ({{ ticketsRiesgo.length }})</button>
              <button :class="['tab', { active: dashTab === 'supervision' }]" @click="dashTab = 'supervision'">Supervisión ({{ ticketsRevisar.length }})</button>
            </div>
            <v-card flat class="custom-data-table">
              <div v-if="dashTab === 'recientes'">
                <v-data-table :headers="headersMini" :items="tickets.slice(0, 10)" class="elevation-0"
                  no-data-text="Aún no hay tickets" :items-per-page="10" @click:row="(_: any, r: any) => abrirDetalle(r.item)">
                  <template v-slot:item.tat_estado="{ item }"><span class="sem-chip" :class="'tat-' + item.tat_estado">{{ semTat(item.tat_estado) }}</span></template>
                  <template v-slot:item.resultado_estado="{ item }"><span class="sem-chip" :class="'res-' + item.resultado_estado">{{ semRes(item.resultado_estado) }}</span></template>
                  <template v-slot:item.peso_neto="{ item }">{{ kg(item.peso_neto) }}</template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>
              <div v-if="dashTab === 'riesgo'">
                <v-data-table :headers="headersMini" :items="ticketsRiesgo" class="elevation-0"
                  no-data-text="Ninguna muestra en riesgo 🎉" :items-per-page="10" @click:row="(_: any, r: any) => abrirDetalle(r.item)">
                  <template v-slot:item.tat_estado="{ item }"><span class="sem-chip" :class="'tat-' + item.tat_estado">{{ semTat(item.tat_estado) }}</span></template>
                  <template v-slot:item.resultado_estado="{ item }"><span class="sem-chip" :class="'res-' + item.resultado_estado">{{ semRes(item.resultado_estado) }}</span></template>
                  <template v-slot:item.peso_neto="{ item }">{{ kg(item.peso_neto) }}</template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>
              <div v-if="dashTab === 'supervision'">
                <v-data-table :headers="headersSupervision" :items="ticketsRevisar" class="elevation-0"
                  no-data-text="Sin observaciones del supervisor" :items-per-page="10" @click:row="(_: any, r: any) => abrirDetalle(r.item)">
                  <template v-slot:item.supervision_severidad="{ item }">
                    <v-chip size="small" variant="tonal" :color="item.supervision_severidad === 'alta' ? 'error' : item.supervision_severidad === 'media' ? 'warning' : 'info'">
                      {{ item.supervision_severidad || '—' }}
                    </v-chip>
                  </template>
                  <template v-slot:bottom></template>
                </v-data-table>
              </div>
            </v-card>
          </div>
        </div>
      </div>

      <!-- ========== VISTA: INGRESO DE TICKET (FORMULARIO) ========== -->
      <div v-else-if="activeView === 'ingreso'" class="view-container">
        <header class="top-header">
          <h1>Ingreso de Ticket</h1>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table" style="padding: 22px;">
            <div class="form-section-title">Identificación (la llave del sistema)</div>
            <div class="form-grid-3">
              <v-text-field v-model="form.n_orden" label="N° de Orden (OLxxxxxx-xx) *" density="compact"
                placeholder="OL218122-01" hide-details :error="!!form.n_orden && !RE_ORDEN.test(form.n_orden.trim().toUpperCase())" />
              <v-text-field v-model="form.n_ticket" label="N° de Ticket de balanza *" density="compact" placeholder="TK26-2976" hide-details />
              <v-text-field v-model="form.sublote" label="Sublote (~1.000 t)" density="compact" placeholder="SL-001" hide-details />
            </div>
            <p class="field-hint">El N° de orden NO viene impreso en el ticket: lo asigna el encargado. Sin él, nada entra (Regla §4.1).</p>

            <div class="form-section-title" style="margin-top:18px;">Datos del ticket</div>
            <div class="form-grid-3">
              <v-text-field v-model="form.fecha" label="Fecha del ticket *" density="compact" placeholder="11/07/2026" hide-details />
              <v-select v-model="form.sede" :items="['Matarani', 'Pisco']" label="Sede" density="compact" hide-details />
              <v-text-field v-model="form.placa" label="Placa *" density="compact" placeholder="CLR-726" hide-details />
              <v-text-field v-model="form.cliente" label="Cliente" density="compact" placeholder="CLIENTE A" hide-details />
              <v-text-field v-model="form.calidad_material" label="Calidad / Material *" density="compact" placeholder="CALIDAD X" hide-details />
            </div>

            <div class="form-section-title" style="margin-top:18px;">Pesos (kg)</div>
            <div class="form-grid-3">
              <v-text-field v-model.number="form.peso_bruto" type="number" label="Peso bruto *" density="compact" hide-details />
              <v-text-field v-model.number="form.tara" type="number" label="Tara *" density="compact" hide-details />
              <v-text-field v-model.number="form.peso_neto" type="number" label="Peso neto *" density="compact" hide-details
                :hint="netoSugerido !== null ? `Sugerido: ${netoSugerido}` : ''" persistent-hint />
            </div>
            <v-alert v-if="netoDescuadre" type="warning" variant="tonal" density="compact" class="mt-2">
              El neto no coincide con bruto − tara ({{ netoSugerido }}). Puedes guardarlo igual: el Agente Supervisor lo marcará para revisión.
            </v-alert>

            <v-expansion-panels class="mt-4" variant="accordion">
              <v-expansion-panel title="Segunda balanza (opcional — ej. MINA vs puerto)">
                <v-expansion-panel-text>
                  <div class="form-grid-3">
                    <v-text-field v-model="form.balanza2.nombre" label="Nombre balanza" density="compact" placeholder="MINA" hide-details />
                    <v-text-field v-model.number="form.balanza2.bruto" type="number" label="Bruto (kg)" density="compact" hide-details />
                    <v-text-field v-model.number="form.balanza2.tara" type="number" label="Tara (kg)" density="compact" hide-details />
                    <v-text-field v-model.number="form.balanza2.neto" type="number" label="Neto (kg)" density="compact" hide-details />
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <div class="form-section-title" style="margin-top:18px;">Análisis (motor TAT)</div>
            <div class="form-grid-3">
              <v-text-field v-model="form.fecha_ingreso_analisis" type="date" label="Fecha ingreso a análisis" density="compact"
                hide-details hint="Inicia el reloj TAT" persistent-hint />
              <v-text-field v-model.number="form.tat_dias" type="number" label="TAT contractual (días)" density="compact" hide-details />
            </div>

            <div class="form-section-title" style="margin-top:18px;">Foto del ticket</div>
            <input ref="fotoInput" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" @change="onFoto" />
            <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <v-btn variant="tonal" color="primary" @click="(fotoInput as any)?.click()">
                <v-icon icon="mdi-camera" start /> {{ form.imagen_base64 ? 'Cambiar foto' : 'Adjuntar foto' }}
              </v-btn>
              <v-btn v-if="form.imagen_base64" variant="text" color="error" @click="form.imagen_base64 = null">Quitar</v-btn>
              <img v-if="form.imagen_base64" :src="form.imagen_base64" alt="Ticket" style="max-height:130px; border-radius:10px; border:1px solid rgba(128,128,128,.3);" />
            </div>

            <v-divider class="my-5" />
            <v-checkbox v-model="form.verificado_humano" color="success" density="compact" hide-details
              label="Verifiqué los datos contra el ticket físico (verificación humana obligatoria — Regla §4.2)" />

            <div style="display:flex; gap:10px; margin-top:16px; align-items:center; flex-wrap:wrap;">
              <v-btn color="primary" variant="flat" :loading="guardando" :disabled="!form.verificado_humano" @click="guardarTicket">
                <v-icon icon="mdi-content-save" start /> Catalogar ticket
              </v-btn>
              <span v-if="!form.verificado_humano" class="field-hint">Marca la verificación humana para habilitar el guardado.</span>
            </div>
          </v-card>

          <!-- Resultado del catalogado -->
          <v-card v-if="resultadoIngreso" flat class="custom-data-table mt-4" style="padding: 18px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <v-chip :color="resultadoIngreso.accion === 'insert' ? 'success' : 'info'" variant="flat">
                {{ resultadoIngreso.accion === 'insert' ? '✔ Ticket catalogado' : '✔ Ticket actualizado (ya existía)' }}
              </v-chip>
              <v-chip :color="resultadoIngreso.supervision?.veredicto === 'ok' ? 'success' : 'warning'" variant="tonal">
                Supervisor: {{ resultadoIngreso.supervision?.veredicto === 'ok' ? 'OK' : 'REVISAR (' + resultadoIngreso.supervision?.severidad + ')' }}
              </v-chip>
              <v-chip v-if="resultadoIngreso.registro?.tat_estado" variant="tonal">
                TAT: {{ semTat(resultadoIngreso.registro.tat_estado) }}
              </v-chip>
            </div>
            <div v-if="resultadoIngreso.supervision?.observaciones?.length" class="mt-3">
              <div class="field-hint" style="font-weight:600;">Observaciones del Agente Supervisor:</div>
              <ul style="margin:6px 0 0 18px; font-size:13px;">
                <li v-for="(o, i) in resultadoIngreso.supervision.observaciones" :key="i">{{ o }}</li>
              </ul>
            </div>
          </v-card>
        </div>
      </div>

      <!-- ========== VISTA: RECEPCIÓN (TICKETS) ========== -->
      <div v-else-if="activeView === 'tickets'" class="view-container">
        <header class="top-header">
          <h1>Recepción</h1>
          <button class="btn-primary" @click="fetchTickets"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
        </header>
        <div class="content-area">
          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Tickets catalogados ({{ ticketsFiltrados.length }})</span>
            </v-card-title>
            <div class="filtros-bar">
              <v-select v-model="fSede" :items="['todas','Matarani','Pisco']" density="compact" hide-details
                variant="outlined" label="Sede" class="filtro" />
              <v-select v-model="fTat" :items="['todos','en_plazo','por_vencer','vencido','sin_fecha']" density="compact" hide-details
                variant="outlined" label="TAT" class="filtro" />
              <v-select v-model="fRes" :items="['todos','no_esta','listo','leido']" density="compact" hide-details
                variant="outlined" label="Resultado" class="filtro" />
              <v-text-field v-model="fSearch" prepend-inner-icon="mdi-magnify" placeholder="Orden, ticket, placa…"
                density="compact" hide-details variant="outlined" clearable class="filtro filtro-buscar" />
            </div>
            <v-data-table :headers="headersTickets" :items="ticketsFiltrados" :loading="loadingTickets"
              class="elevation-0" no-data-text="No hay tickets" :items-per-page="20" @click:row="(_: any, r: any) => abrirDetalle(r.item)">
              <template v-slot:item.tat_estado="{ item }"><span class="sem-chip" :class="'tat-' + item.tat_estado">{{ semTat(item.tat_estado) }}</span></template>
              <template v-slot:item.resultado_estado="{ item }"><span class="sem-chip" :class="'res-' + item.resultado_estado">{{ semRes(item.resultado_estado) }}</span></template>
              <template v-slot:item.peso_neto="{ item }">{{ kg(item.peso_neto) }}</template>
              <template v-slot:item.supervision="{ item }">
                <v-icon v-if="item.supervision === 'revisar'" icon="mdi-alert" color="warning" size="18" title="El supervisor pidió revisar" />
                <v-icon v-else icon="mdi-check-circle" color="success" size="18" />
              </template>
              <template v-slot:item.imagen_ticket="{ item }">
                <v-icon :icon="item.imagen_ticket ? 'mdi-image' : 'mdi-image-off-outline'" size="18" :style="{ opacity: item.imagen_ticket ? 1 : .3 }" />
              </template>
            </v-data-table>
          </v-card>
        </div>
      </div>

      <!-- ========== VISTA: ESCALAMIENTOS TAT ========== -->
      <div v-else-if="activeView === 'escalamientos'" class="view-container">
        <header class="top-header">
          <h1>Escalamientos TAT</h1>
          <div style="display:flex; gap:10px;">
            <button class="btn-primary" :disabled="corriendoTat" @click="correrRelojTat">
              <v-icon icon="mdi-clock-fast" size="16" /><span>{{ corriendoTat ? 'Corriendo…' : 'Correr reloj TAT' }}</span>
            </button>
            <button class="btn-primary" @click="fetchEscalamientos"><v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span></button>
          </div>
        </header>
        <div class="content-area">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Cadena de escalamiento: <b>N1 William Ochoa</b> (preventivo, vence mañana) → <b>N2 Jahaira Sánchez</b> (vencido 0-1 día) → <b>N3 José Ramos</b> (vencido ≥2 días). Canal oficial: correo institucional.
          </v-alert>
          <v-card flat class="custom-data-table">
            <v-data-table :headers="headersEscala" :items="escalamientos" :loading="loadingEscala"
              class="elevation-0" no-data-text="Sin avisos de escalamiento" :items-per-page="20">
              <template v-slot:item.nivel="{ item }">
                <v-chip size="small" variant="flat" :color="item.nivel === 3 ? 'error' : item.nivel === 2 ? 'warning' : 'info'">N{{ item.nivel }}</v-chip>
              </template>
              <template v-slot:item.tat_estado="{ item }"><span class="sem-chip" :class="'tat-' + item.tat_estado">{{ semTat(item.tat_estado) }}</span></template>
              <template v-slot:item.created_at="{ item }">{{ fechaHora(item.created_at) }}</template>
              <template v-slot:item.cuerpo="{ item }">
                <v-btn size="x-small" variant="tonal" @click="avisoDetalle = item">Ver aviso</v-btn>
              </template>
            </v-data-table>
          </v-card>
        </div>

        <v-dialog :model-value="!!avisoDetalle" max-width="560" @update:model-value="avisoDetalle = null">
          <v-card v-if="avisoDetalle">
            <v-card-title class="pt-4" style="font-size:15px;">{{ avisoDetalle.asunto }}</v-card-title>
            <v-card-text><pre style="white-space:pre-wrap; font-family:inherit; font-size:13.5px;">{{ avisoDetalle.cuerpo }}</pre></v-card-text>
            <v-card-actions><v-spacer /><v-btn variant="text" @click="avisoDetalle = null">Cerrar</v-btn></v-card-actions>
          </v-card>
        </v-dialog>
      </div>

      <!-- ========== VISTA: SETTINGS ========== -->
      <SettingsView v-else-if="activeView === 'settings'" company-id="sgs" :current-user-role="currentUser?.role" />
    </div>

    <!-- ========== DRILL-DOWN DE TICKET ========== -->
    <v-dialog :model-value="!!detalle" max-width="860" @update:model-value="detalle = null" scrollable>
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <b>{{ detalle.n_orden }}</b> · {{ detalle.n_ticket }}
          <span class="sem-chip" :class="'tat-' + detalle.tat_estado">{{ semTat(detalle.tat_estado) }}</span>
          <span class="sem-chip" :class="'res-' + detalle.resultado_estado">{{ semRes(detalle.resultado_estado) }}</span>
        </v-card-title>
        <v-card-text>
          <div class="detalle-grid">
            <div class="detalle-datos">
              <div class="sol-campos">
                <div class="sol-campo"><span>Fecha ticket</span><strong>{{ detalle.fecha || '—' }}</strong></div>
                <div class="sol-campo"><span>Sede</span><strong>{{ detalle.sede || '—' }}</strong></div>
                <div class="sol-campo"><span>Cliente</span><strong>{{ detalle.cliente || '—' }}</strong></div>
                <div class="sol-campo"><span>Calidad</span><strong>{{ detalle.calidad_material || '—' }}</strong></div>
                <div class="sol-campo"><span>Placa</span><strong>{{ detalle.placa || '—' }}</strong></div>
                <div class="sol-campo"><span>Sublote</span><strong>{{ detalle.sublote || '—' }}</strong></div>
                <div class="sol-campo"><span>Peso bruto</span><strong>{{ kg(detalle.peso_bruto) }}</strong></div>
                <div class="sol-campo"><span>Tara</span><strong>{{ kg(detalle.tara) }}</strong></div>
                <div class="sol-campo"><span>Peso neto</span><strong>{{ kg(detalle.peso_neto) }}</strong></div>
                <div class="sol-campo"><span>Ingreso a análisis</span><strong>{{ detalle.fecha_ingreso_analisis || '—' }}</strong></div>
                <div class="sol-campo"><span>TAT contractual</span><strong>{{ detalle.tat_dias }} días</strong></div>
                <div class="sol-campo"><span>Días restantes</span><strong>{{ detalle.tat_dias_restantes ?? '—' }}</strong></div>
                <div class="sol-campo"><span>Catalogado por</span><strong>{{ detalle.created_by || '—' }}</strong></div>
                <div class="sol-campo"><span>Verificación humana</span><strong>{{ detalle.verificado_humano ? 'Sí ✔' : 'No' }}</strong></div>
              </div>

              <div v-if="detalle.balanza2_nombre" class="mt-3">
                <div class="field-hint" style="font-weight:600;">Segunda balanza — {{ detalle.balanza2_nombre }}</div>
                <div class="sol-campos mt-1">
                  <div class="sol-campo"><span>Bruto</span><strong>{{ kg(detalle.balanza2_bruto) }}</strong></div>
                  <div class="sol-campo"><span>Tara</span><strong>{{ kg(detalle.balanza2_tara) }}</strong></div>
                  <div class="sol-campo"><span>Neto</span><strong>{{ kg(detalle.balanza2_neto) }}</strong></div>
                </div>
              </div>

              <v-alert v-if="detalle.supervision === 'revisar'" type="warning" variant="tonal" density="compact" class="mt-3">
                <b>Agente Supervisor — revisar ({{ detalle.supervision_severidad }}):</b> {{ detalle.supervision_obs }}
              </v-alert>

              <div class="mt-4">
                <div class="field-hint" style="font-weight:600; margin-bottom:6px;">Semáforo de resultado (E):</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <v-btn v-for="e in (['no_esta','listo','leido'] as const)" :key="e" size="small"
                    :variant="detalle.resultado_estado === e ? 'flat' : 'tonal'"
                    :color="e === 'no_esta' ? 'error' : e === 'listo' ? 'warning' : 'success'"
                    :loading="cambiandoResultado === e" @click="cambiarResultado(e)">
                    {{ semRes(e) }}
                  </v-btn>
                </div>
              </div>

              <div v-if="escalasDeDetalle.length" class="mt-4">
                <div class="field-hint" style="font-weight:600; margin-bottom:6px;">Avisos TAT de esta orden:</div>
                <div v-for="a in escalasDeDetalle" :key="a.id" style="font-size:13px; padding:4px 0; border-bottom:1px dashed rgba(128,128,128,.25);">
                  <v-chip size="x-small" variant="flat" :color="a.nivel === 3 ? 'error' : a.nivel === 2 ? 'warning' : 'info'" class="mr-2">N{{ a.nivel }}</v-chip>
                  {{ a.destinatario }} · {{ fechaHora(a.created_at) }}
                </div>
              </div>
            </div>

            <div class="detalle-foto">
              <div class="field-hint" style="font-weight:600; margin-bottom:6px;">Foto del ticket</div>
              <a v-if="detalle.imagen_ticket" :href="detalle.imagen_ticket" target="_blank">
                <img :src="detalle.imagen_ticket" alt="Ticket" style="width:100%; border-radius:10px; border:1px solid rgba(128,128,128,.3);" />
              </a>
              <div v-else class="sin-foto"><v-icon icon="mdi-image-off-outline" size="34" /><p>Sin foto adjunta</p></div>
            </div>
          </div>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="detalle = null">Cerrar</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3500" location="bottom right">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, reactive } from 'vue'
import { useTheme } from 'vuetify'
import { useActivityLogger } from '@/composables/useActivityLogger'
import type { ApexOptions } from 'apexcharts'
import { isSuperAdmin, canAccessSGS, dashboards } from '@/utils/permissions'
import SettingsView from '@/components/Settings/SettingsView.vue'

const { logActivity } = useActivityLogger()
definePageMeta({ middleware: 'auth-dashboard' })

/* ── Sesión ── */
interface UserSession { id: string; email: string; full_name: string; role: string; company_id?: string }
const userSession = useCookie<UserSession | null>('dashboard_session')
const currentUser = computed(() => userSession.value || { full_name: 'Usuario Invitado', email: '', id: '', role: '', company_id: '' })

const client = useSupabaseClient()
const logoUrl = '/sgs-logo.png'
const showDashboardMenu = ref(false)
const showUserMenu = ref(false)
const activeView = useVistaPersistente('sgs')
const dashTab = ref('recientes')

const snackbar = ref({ show: false, text: '', color: 'success' })
function notify(text: string, color = 'success') { snackbar.value = { show: true, text, color } }

/* ── Tema ── */
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
  const session = useCookie('dashboard_session'); session.value = null
  return navigateTo('/')
}

/* ── Menú ── */
const menuItems = [
  { icon: 'mdi-view-dashboard', label: 'Dashboard', id: 'dashboard' },
  { icon: 'mdi-clipboard-plus', label: 'Ingreso de Ticket', id: 'ingreso' },
  { icon: 'mdi-scale-balance', label: 'Recepción', id: 'tickets' },
  { icon: 'mdi-bell-alert', label: 'Escalamientos TAT', id: 'escalamientos' },
]

/* ── Semáforos (mismos valores que semaforo.py) ── */
const SEM_TAT: Record<string, string> = {
  en_plazo: '🟢 En plazo', por_vencer: '🟠 Por vencer', vencido: '🔴 Vencido', sin_fecha: '⚪ Sin fecha',
}
const SEM_RES: Record<string, string> = {
  no_esta: '🔴 No está', listo: '🟠 Listo p/ leer', leido: '🟢 Leído',
}
const semTat = (e: string) => SEM_TAT[e] || '⚪ —'
const semRes = (e: string) => SEM_RES[e] || '⚪ —'

const RE_ORDEN = /^OL\d{6}-\d{2}$/

/* ── Helpers ── */
function kg(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return `${Number(v).toLocaleString('es-PE')} kg`
}
function fechaHora(v: any) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* ══════════ TICKETS (lectura directa: anon SELECT) ══════════ */
const tickets = ref<any[]>([])
const loadingTickets = ref(false)
const fSede = ref('todas'); const fTat = ref('todos'); const fRes = ref('todos'); const fSearch = ref('')

async function fetchTickets() {
  loadingTickets.value = true
  const { data, error } = await client.from('sgs_tickets').select('*').order('created_at', { ascending: false }).limit(1000)
  if (error) notify('Error cargando tickets: ' + error.message, 'error')
  tickets.value = data || []
  loadingTickets.value = false
}

const ticketsFiltrados = computed(() => {
  let lista = tickets.value
  if (fSede.value !== 'todas') lista = lista.filter(t => t.sede === fSede.value)
  if (fTat.value !== 'todos') lista = lista.filter(t => t.tat_estado === fTat.value)
  if (fRes.value !== 'todos') lista = lista.filter(t => t.resultado_estado === fRes.value)
  if (fSearch.value) {
    const q = fSearch.value.toLowerCase()
    lista = lista.filter(t => [t.n_orden, t.n_ticket, t.placa, t.cliente, t.calidad_material, t.sublote]
      .some(v => String(v ?? '').toLowerCase().includes(q)))
  }
  return lista
})
const ticketsRiesgo = computed(() => tickets.value.filter(t => ['por_vencer', 'vencido'].includes(t.tat_estado) && !['listo', 'leido'].includes(t.resultado_estado)))
const ticketsRevisar = computed(() => tickets.value.filter(t => t.supervision === 'revisar'))

const headersMini = [
  { title: 'Orden', key: 'n_orden' },
  { title: 'Ticket', key: 'n_ticket' },
  { title: 'Cliente', key: 'cliente' },
  { title: 'Calidad', key: 'calidad_material' },
  { title: 'Neto', key: 'peso_neto' },
  { title: 'TAT', key: 'tat_estado' },
  { title: 'Resultado', key: 'resultado_estado' },
]
const headersSupervision = [
  { title: 'Orden', key: 'n_orden' },
  { title: 'Ticket', key: 'n_ticket' },
  { title: 'Severidad', key: 'supervision_severidad' },
  { title: 'Observaciones', key: 'supervision_obs' },
]
const headersTickets = [
  { title: 'Orden', key: 'n_orden' },
  { title: 'Ticket', key: 'n_ticket' },
  { title: 'Fecha', key: 'fecha' },
  { title: 'Sede', key: 'sede' },
  { title: 'Cliente', key: 'cliente' },
  { title: 'Calidad', key: 'calidad_material' },
  { title: 'Placa', key: 'placa' },
  { title: 'Neto', key: 'peso_neto' },
  { title: 'TAT', key: 'tat_estado' },
  { title: 'Resultado', key: 'resultado_estado' },
  { title: 'Sup.', key: 'supervision', sortable: false },
  { title: 'Foto', key: 'imagen_ticket', sortable: false },
]

/* ══════════ FORMULARIO DE INGRESO (escritura vía endpoint) ══════════ */
const fotoInput = ref<HTMLInputElement | null>(null)
const guardando = ref(false)
const resultadoIngreso = ref<any>(null)

const form = reactive<any>({
  n_orden: '', n_ticket: '', fecha: '', sede: 'Matarani', cliente: '', calidad_material: '',
  placa: '', peso_bruto: null, tara: null, peso_neto: null, sublote: '',
  fecha_ingreso_analisis: '', tat_dias: 4, verificado_humano: false,
  balanza2: { nombre: '', bruto: null, tara: null, neto: null },
  imagen_base64: null as string | null,
})

const netoSugerido = computed(() => {
  if (form.peso_bruto == null || form.tara == null) return null
  return Math.round((Number(form.peso_bruto) - Number(form.tara)) * 100) / 100
})
const netoDescuadre = computed(() => {
  if (netoSugerido.value === null || form.peso_neto == null) return false
  return Math.abs(netoSugerido.value - Number(form.peso_neto)) > Math.max(50, netoSugerido.value * 0.02)
})

function onFoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, 1600 / img.width)
      const w = Math.round(img.width * escala), h = Math.round(img.height * escala)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      form.imagen_base64 = canvas.toDataURL('image/jpeg', 0.82)
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}

async function guardarTicket() {
  resultadoIngreso.value = null
  const orden = String(form.n_orden || '').trim().toUpperCase()
  if (!RE_ORDEN.test(orden)) { notify('N° de orden inválido: debe ser OLxxxxxx-xx (Regla §4.1)', 'error'); return }
  guardando.value = true
  try {
    const res = await $fetch<any>('/api/sgs/tickets', {
      method: 'POST',
      body: {
        ...form,
        n_orden: orden,
        balanza2: form.balanza2.nombre ? form.balanza2 : undefined,
      },
    })
    resultadoIngreso.value = res
    notify(res.accion === 'insert' ? 'Ticket catalogado ✔' : 'Ticket actualizado ✔')
    logActivity(`Catalogó ticket SGS ${orden}/${form.n_ticket}`)
    // Conserva orden/contexto para el siguiente ticket del mismo lote
    form.n_ticket = ''; form.placa = ''; form.fecha = ''
    form.peso_bruto = null; form.tara = null; form.peso_neto = null
    form.imagen_base64 = null; form.verificado_humano = false
    form.balanza2 = { nombre: '', bruto: null, tara: null, neto: null }
    await fetchTickets()
  } catch (e: any) {
    notify(e?.data?.statusMessage || e?.statusMessage || 'Error guardando el ticket', 'error')
  } finally {
    guardando.value = false
  }
}

/* ══════════ DRILL-DOWN ══════════ */
const detalle = ref<any>(null)
const cambiandoResultado = ref<string | null>(null)
const escalasDeDetalle = computed(() =>
  detalle.value ? escalamientos.value.filter(a => a.n_orden === detalle.value.n_orden && a.n_ticket === detalle.value.n_ticket) : [])

function abrirDetalle(item: any) { if (item?.n_orden) detalle.value = item }

async function cambiarResultado(estado: 'no_esta' | 'listo' | 'leido') {
  if (!detalle.value || detalle.value.resultado_estado === estado) return
  cambiandoResultado.value = estado
  try {
    await $fetch('/api/sgs/resultado', {
      method: 'POST',
      body: { n_orden: detalle.value.n_orden, n_ticket: detalle.value.n_ticket, estado },
    })
    detalle.value.resultado_estado = estado
    notify('Semáforo actualizado: ' + semRes(estado))
    await fetchTickets()
  } catch (e: any) {
    notify(e?.data?.statusMessage || 'Error actualizando el resultado', 'error')
  } finally {
    cambiandoResultado.value = null
  }
}

/* ══════════ ESCALAMIENTOS ══════════ */
const escalamientos = ref<any[]>([])
const loadingEscala = ref(false)
const corriendoTat = ref(false)
const avisoDetalle = ref<any>(null)

const headersEscala = [
  { title: 'Fecha', key: 'created_at' },
  { title: 'Nivel', key: 'nivel' },
  { title: 'Destinatario', key: 'destinatario' },
  { title: 'Orden', key: 'n_orden' },
  { title: 'Ticket', key: 'n_ticket' },
  { title: 'TAT', key: 'tat_estado' },
  { title: 'Días rest.', key: 'dias_restantes' },
  { title: 'Aviso', key: 'cuerpo', sortable: false },
]

async function fetchEscalamientos() {
  loadingEscala.value = true
  const { data, error } = await client.from('sgs_escalamientos').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) notify('Error cargando escalamientos: ' + error.message, 'error')
  escalamientos.value = data || []
  loadingEscala.value = false
}

async function correrRelojTat() {
  corriendoTat.value = true
  try {
    const res = await $fetch<any>('/api/sgs/tick-tat', { method: 'POST' })
    const nuevos = (res.avisos || []).filter((a: any) => a.nuevo).length
    notify(`Reloj TAT: ${res.revisados} muestras revisadas · ${res.actualizados} actualizadas · ${nuevos} aviso(s) nuevo(s)`)
    await Promise.all([fetchTickets(), fetchEscalamientos()])
  } catch (e: any) {
    notify(e?.data?.statusMessage || 'Error corriendo el reloj TAT', 'error')
  } finally {
    corriendoTat.value = false
  }
}

/* ══════════ STATS + CHART ══════════ */
const hoyIso = () => new Date().toISOString().slice(0, 10)
const ticketsHoy = computed(() => tickets.value.filter(t => String(t.created_at || '').slice(0, 10) === hoyIso()))
const pesoNetoHoy = computed(() => ticketsHoy.value.reduce((s, t) => s + Number(t.peso_neto || 0), 0))

const stats = computed(() => [
  { title: 'Tickets hoy', value: String(ticketsHoy.value.length), change: `${tickets.value.length} total`, trend: 'up', description: 'Catalogados el día de hoy' },
  { title: 'Peso neto hoy', value: `${(pesoNetoHoy.value / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} t`, change: '', trend: 'up', description: 'Total recepcionado hoy' },
  { title: 'TAT en riesgo', value: String(ticketsRiesgo.value.length), change: '', trend: ticketsRiesgo.value.length ? 'down' : 'up', description: 'Muestras por vencer o vencidas' },
  { title: 'Supervisión', value: String(ticketsRevisar.value.length), change: '', trend: ticketsRevisar.value.length ? 'down' : 'up', description: 'Tickets marcados "revisar"' },
])

const ultimos14 = computed(() => {
  const out: string[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
})
const series = computed(() => {
  const porDia = (sede: string) => ultimos14.value.map(dia =>
    tickets.value.filter(t => String(t.created_at || '').slice(0, 10) === dia && t.sede === sede).length)
  return [
    { name: 'Matarani', data: porDia('Matarani') },
    { name: 'Pisco', data: porDia('Pisco') },
  ]
})
const chartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, stacked: true },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#6b7280', '#e2231a'],
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
  xaxis: { categories: ultimos14.value.map(d => d.slice(5).split('-').reverse().join('/')) },
  legend: { position: 'top', horizontalAlign: 'right' },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  tooltip: { theme: isDark.value ? 'dark' : 'light' },
  grid: { borderColor: isDark.value ? '#333' : '#eee' },
}))

/* ══════════ LIFECYCLE ══════════ */
async function refreshAll() {
  await Promise.all([fetchTickets(), fetchEscalamientos()])
  notify('Datos actualizados')
}

onMounted(async () => {
  if (!canAccessSGS(currentUser.value)) {
    alert('No tienes permiso para acceder a este dashboard.')
    return navigateTo('/')
  }
  applyTheme()
  await Promise.all([fetchTickets(), fetchEscalamientos()])
})
</script>

<style scoped>
/* Semáforos */
.sem-chip {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.tat-en_plazo,
.res-leido { background: rgba(46, 158, 91, .14); color: #2e9e5b; }

.tat-por_vencer,
.res-listo { background: rgba(230, 150, 40, .16); color: #d98324; }

.tat-vencido,
.res-no_esta { background: rgba(226, 35, 26, .13); color: #e2231a; }

.tat-sin_fecha { background: rgba(128, 128, 128, .15); color: #888; }

/* Formulario */
.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.form-section-title {
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: .4px;
  opacity: .65;
  margin-bottom: 10px;
}

.field-hint {
  font-size: 12.5px;
  opacity: .65;
  margin: 6px 0 0;
}

/* Barra de filtros de Recepción: fila propia, con aire, que envuelve limpio */
.filtros-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 2px 16px 14px;
}

.filtros-bar .filtro {
  flex: 1 1 150px;
  min-width: 140px;
  max-width: 210px;
}

.filtros-bar .filtro-buscar {
  flex: 2 1 230px;
  max-width: 340px;
}

@media (max-width: 700px) {
  .filtros-bar .filtro {
    flex: 1 1 46%;
    max-width: none;
  }

  .filtros-bar .filtro-buscar {
    flex: 1 1 100%;
    max-width: none;
  }
}

/* Drill-down */
.detalle-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}

.sol-campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.sol-campo { display: flex; flex-direction: column; gap: 2px; }
.sol-campo span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.sol-campo strong { font-size: 13.5px; word-break: break-word; }

.sin-foto {
  text-align: center;
  opacity: .45;
  padding: 40px 10px;
  border: 1px dashed rgba(128, 128, 128, .4);
  border-radius: 10px;
}

@media (max-width: 800px) {
  .form-grid-3 { grid-template-columns: 1fr; }
  .detalle-grid { grid-template-columns: 1fr; }
}
</style>
