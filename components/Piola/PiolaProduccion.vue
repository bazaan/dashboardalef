<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Producción y Contenidos</h1>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <v-select v-model="periodo" :items="periodos" density="compact" hide-details variant="outlined"
          style="min-width:140px;" />
        <button v-if="puedeCrear" class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo entregable</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-alert v-if="faltaMigracion" type="warning" variant="tonal" density="compact" class="mb-4">
        Falta correr <b>sql/piola_reunion_31ago.sql</b> en Supabase: todavía no existen las tablas de
        tipos de contenido / compromisos, así que el desglose por tipo se ve vacío.
      </v-alert>

      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'tablero' }]" @click="tab = 'tablero'">Tablero</button>
          <button :class="['tab', { active: tab === 'responsables' }]" @click="tab = 'responsables'">
            Por responsable
          </button>
          <button :class="['tab', { active: tab === 'cumplimiento' }]" @click="tab = 'cumplimiento'">
            Cumplimiento por marca
          </button>
          <button :class="['tab', { active: tab === 'marcas' }]" @click="tab = 'marcas'">Marcas / clientes</button>
          <button :class="['tab', { active: tab === 'catalogo' }]" @click="tab = 'catalogo'">Catálogo</button>
        </div>

        <!-- ══════════ TABLERO + POR RESPONSABLE (comparten filtros) ══════════ -->
        <div v-if="tab === 'tablero' || tab === 'responsables'" class="tablero-content">
          <v-alert v-if="tab === 'tablero'" type="info" variant="tonal" density="compact" class="mb-4">
            Todo contenido pasa por el <b>Director Estratégico</b>, que aprueba antes de la entrega:
            En producción → En revisión → Aprobado por Dirección → Entregado.
            Los enlaces de Dropbox y Drive se pegan a mano en cada entregable (enlace fijo a la carpeta:
            la plataforma no vigila Dropbox).
          </v-alert>
          <v-alert v-else type="info" variant="tonal" density="compact" class="mb-4">
            La lista de pendientes de cada persona: lo que tiene asignado y todavía no está entregado
            ni aprobado. Cada quien entra, ve lo suyo y lo va moviendo.
          </v-alert>

          <div class="filtros-bar">
            <v-select v-model="fCliente" :items="opcionesClienteFiltro" density="compact" hide-details
              variant="outlined" label="Marca" class="filtro" />
            <v-select v-model="fArea" :items="opcionesAreaFiltro" density="compact" hide-details
              variant="outlined" label="Área" class="filtro" />
            <v-select v-model="fTipo" :items="opcionesTipoFiltro" density="compact" hide-details
              variant="outlined" label="Tipo de contenido" class="filtro" />
            <v-select v-if="tab === 'tablero'" v-model="fResponsable" :items="opcionesResponsableFiltro"
              density="compact" hide-details variant="outlined" label="Responsable" class="filtro" />
            <v-btn v-if="hayFiltros" size="small" variant="text" @click="limpiarFiltros">
              <v-icon icon="mdi-filter-remove-outline" start /> Limpiar
            </v-btn>
            <v-spacer />
            <v-btn size="small" variant="tonal" @click="imprimirTablero">
              <v-icon icon="mdi-file-pdf-box" start /> Reporte PDF
            </v-btn>
          </div>

          <!-- Menú de clic derecho sobre una tarjeta -->
          <v-menu v-model="menuCtx.abierto" :target="[menuCtx.x, menuCtx.y]" :close-on-content-click="true">
            <v-list density="compact" min-width="170">
              <v-list-item prepend-icon="mdi-open-in-new" title="Abrir" @click="abrirDesdeMenu" />
              <v-list-item v-if="puedeCrear" prepend-icon="mdi-content-copy" title="Duplicar"
                @click="duplicarDesdeMenu" />
            </v-list>
          </v-menu>

          <!-- ── Kanban por estado ── -->
          <div v-if="tab === 'tablero'" class="kanban">
            <div v-for="estado in ESTADOS_ENTREGABLE" :key="estado.value" class="kanban-col">
              <div class="kanban-head">
                <span class="kanban-nombre">{{ estado.title }}</span>
                <span class="kanban-count">{{ porEstado(estado.value).length }}</span>
              </div>
              <div class="kanban-body" :class="{ 'kanban-body-destino': colSobrevolada === estado.value }"
                @dragover.prevent="onArrastreSobreColumna(estado.value)"
                @drop.prevent="onSoltarEnColumna(estado.value)">
                <div v-for="e in porEstado(estado.value)" :key="e.id" class="ent-card"
                  :class="{ 'ent-card-arrastrando': arrastrandoId === e.id }"
                  :draggable="puedeEditar" @dragstart="onIniciarArrastre(e)" @dragend="onFinArrastre"
                  @click="detalle = { ...e }" @contextmenu.prevent="abrirMenuTarjeta($event, e)">
                  <!-- Duplicar sin abrir la tarjeta (también con clic derecho) -->
                  <button v-if="puedeCrear" type="button" class="ent-dup" title="Duplicar este entregable"
                    :disabled="duplicando" @click.stop="duplicarEntregable(e)">
                    <v-icon icon="mdi-content-copy" size="14" />
                  </button>
                  <div class="ent-titulo">{{ e.titulo }}</div>
                  <div class="ent-cliente">{{ nombreCliente(e.cliente_id) }}</div>
                  <div class="ent-chips">
                    <span class="etapa-chip" :style="chipTipo(e.tipo_contenido)">
                      {{ nombreTipo(e.tipo_contenido) }}
                    </span>
                    <span v-if="e.area_produccion_id" class="area-chip">{{ nombreAreaProduccion(e.area_produccion_id) }}</span>
                  </div>
                  <div class="ent-pie">
                    <span :class="{ 'texto-alerta': atrasado(e) }">
                      <v-icon :icon="atrasado(e) ? 'mdi-alert-circle' : 'mdi-calendar'" size="12" />
                      {{ fechaCorta(e.fecha_compromiso) }}
                    </span>
                    <span style="display:flex; align-items:center; gap:6px;">
                      <span v-if="e.cantidad > 1" class="ent-cant">×{{ e.cantidad }}</span>
                      <span v-if="e.responsable_email" class="ent-owner" :title="nombreColaborador(e.responsable_email)">
                        {{ iniciales(e.responsable_email) }}
                      </span>
                    </span>
                  </div>
                  <div v-if="tieneEnlaces(e)" class="ent-links">
                    <a v-if="esUrl(e.drive_url)" :href="e.drive_url" target="_blank" rel="noopener"
                      title="Google Drive" @click.stop><v-icon icon="mdi-google-drive" size="14" /></a>
                    <a v-if="esUrl(e.dropbox_url)" :href="e.dropbox_url" target="_blank" rel="noopener"
                      title="Dropbox" @click.stop><v-icon icon="mdi-dropbox" size="14" /></a>
                    <a v-if="esUrl(e.publicado_url)" :href="e.publicado_url" target="_blank" rel="noopener"
                      title="Publicado" @click.stop><v-icon icon="mdi-web" size="14" /></a>
                  </div>
                </div>
                <div v-if="!porEstado(estado.value).length" class="kanban-vacio">Nada aquí</div>
              </div>
            </div>
          </div>

          <!-- ── Pendientes agrupados por persona ── -->
          <div v-else class="resp-grid">
            <div v-for="g in pendientesPorResponsable" :key="g.clave" class="resp-card">
              <div class="resp-head">
                <span class="ent-owner">{{ g.email ? iniciales(g.email) : '—' }}</span>
                <div style="flex:1; min-width:0;">
                  <div class="resp-nombre">{{ g.nombre }}</div>
                  <div class="resp-sub">
                    {{ g.items.length }} pendiente(s)
                    <span v-if="g.atrasados" class="texto-alerta">· {{ g.atrasados }} atrasado(s)</span>
                  </div>
                </div>
                <span class="kanban-count">{{ g.piezas }}</span>
              </div>
              <div class="resp-body">
                <div v-for="e in g.items" :key="e.id" class="resp-item" @click="detalle = { ...e }">
                  <div class="resp-item-top">
                    <span class="resp-item-titulo">{{ e.titulo }}</span>
                    <span class="etapa-chip" :style="chipTipo(e.tipo_contenido)">
                      {{ nombreTipo(e.tipo_contenido) }}
                    </span>
                  </div>
                  <div class="resp-item-pie">
                    <span>{{ nombreCliente(e.cliente_id) }}</span>
                    <span :class="{ 'texto-alerta': atrasado(e) }">
                      {{ etiquetaEstadoEntregable(e.estado) }} · {{ fechaCorta(e.fecha_compromiso) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!pendientesPorResponsable.length" class="kanban-vacio">
              No hay pendientes con estos filtros.
            </div>
          </div>
        </div>

        <!-- ══════════ CUMPLIMIENTO POR MARCA Y TIPO ══════════ -->
        <div v-else-if="tab === 'cumplimiento'" class="tablero-content">
          <div class="cumpl-head">
            <div>
              <h2 class="cumpl-titulo">Cumplimiento por marca — {{ nombrePeriodo }}</h2>
              <p class="cumpl-sub">
                Mismo formato que el Excel de KPIs: cada columna de tipo es lo <b>comprometido</b> del mes,
                <b>avance</b> es lo entregado y <b>% de avance</b> es avance / piezas mensuales. Se llena solo
                con lo que el equipo mueve en el tablero: cuenta como entregado lo <b>aprobado</b> y lo
                <b>entregado</b>; en revisión y en producción todavía no suman.
              </p>
            </div>
            <div class="cumpl-acciones">
              <v-btn size="small" variant="tonal" @click="imprimirKpi">
                <v-icon icon="mdi-file-pdf-box" start /> Descargar PDF
              </v-btn>
              <v-btn v-if="puedeEditar" size="small" variant="tonal" @click="abrirCompromisos()">
                <v-icon icon="mdi-clipboard-list-outline" start /> Definir compromisos
              </v-btn>
              <v-btn v-if="puedeCrear" size="small" variant="tonal" color="primary" @click="abrirClonar">
                <v-icon icon="mdi-content-duplicate" start /> Repetir el mes anterior
              </v-btn>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Comprometido</span></div>
              <div class="stat-value">{{ totalesPeriodo.comprometido }}</div>
              <div class="stat-description">Piezas pactadas en {{ periodo }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Entregado</span></div>
              <div class="stat-value">{{ totalesPeriodo.entregado }}</div>
              <div class="stat-description">Aprobado por Dirección o entregado</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">En proceso</span></div>
              <div class="stat-value">{{ totalesPeriodo.en_revision + totalesPeriodo.en_produccion }}</div>
              <div class="stat-description">
                {{ totalesPeriodo.en_revision }} en revisión · {{ totalesPeriodo.en_produccion }} en producción
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Cumplimiento global</span></div>
              <div class="stat-value">{{ totalesPeriodo.comprometido ? totalesPeriodo.pct + ' %' : '—' }}</div>
              <div class="stat-description">Entregado / comprometido de todas las marcas</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Avance esperado hoy</span></div>
              <div class="stat-value">{{ avanceEsperado }} %</div>
              <div class="stat-description">
                {{ avanceEsperado >= 100 ? 'El mes ya cerró' : avanceEsperado <= 0 ? 'El mes todavía no empieza' : 'A esta fecha del mes deberían llevar este avance' }}
              </div>
            </div>
          </div>

          <!-- ── Tabla estilo Excel de KPIs ── -->
          <div class="kpi-toolbar">
            <v-select v-model="kpiMarca" :items="opcionesClienteFiltro" density="compact" hide-details
              variant="outlined" label="Marca" class="filtro" style="max-width:260px;" />
            <div class="kpi-leyenda">
              <span>Color del % de avance:</span>
              <span v-for="r in RITMOS_LEYENDA" :key="r" class="kpi-leyenda-item">
                <span class="kpi-punto" :style="{ background: PIOLA_RITMO_COLOR[r] }" />{{ PIOLA_RITMO_TEXTO[r] }}
              </span>
            </div>
          </div>

          <div v-if="!kpi.filas.length" class="kanban-vacio">Sin marcas activas</div>
          <div v-else class="kpi-wrap">
            <table class="kpi-tabla">
              <thead>
                <tr><th class="kpi-banner" :colspan="kpi.columnas.length + 4">{{ tituloKpi }}</th></tr>
                <tr>
                  <th class="kpi-cli">CLIENTE</th>
                  <th v-for="c in kpi.columnas" :key="c.codigo" class="kpi-tipo">{{ c.nombre }}</th>
                  <th class="kpi-cum">PIEZAS MENSUALES</th>
                  <th class="kpi-cum">AVANCE</th>
                  <th class="kpi-cum">% DE AVANCE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in kpi.filas" :key="f.cliente_id">
                  <td class="kpi-cliente">
                    <div class="kpi-cliente-in">
                      <span>
                        {{ f.cliente }}
                        <span v-if="f.en_revision || f.en_produccion" class="kpi-proceso">
                          {{ f.en_revision ? f.en_revision + ' en revisión' : '' }}{{ f.en_revision && f.en_produccion ? ' · ' : '' }}{{ f.en_produccion ? f.en_produccion + ' en producción' : '' }}
                        </span>
                      </span>
                      <v-btn v-if="puedeEditar" icon="mdi-pencil-outline" size="x-small" variant="text"
                        title="Definir compromisos de esta marca" @click="abrirCompromisos(f.cliente_id)" />
                    </div>
                  </td>
                  <td v-for="c in kpi.columnas" :key="c.codigo" class="kpi-num"
                    :class="{ 'kpi-cero': !f.celdas[c.codigo]?.comprometido }" :title="tituloCelda(f.celdas[c.codigo])">
                    {{ f.celdas[c.codigo]?.comprometido || 0 }}
                  </td>
                  <td class="kpi-num"><b>{{ f.comprometido }}</b></td>
                  <td class="kpi-num"><b>{{ f.entregado }}</b></td>
                  <td class="kpi-num kpi-pct" :style="{ color: PIOLA_RITMO_COLOR[f.ritmo] }" :title="PIOLA_RITMO_TEXTO[f.ritmo]">
                    {{ piolaPctTexto(f.entregado, f.comprometido) }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td class="kpi-tot-etq" :colspan="kpi.columnas.length + 1">TOTALES</td>
                  <td class="kpi-num">{{ kpi.totales.comprometido }}</td>
                  <td class="kpi-num">{{ kpi.totales.entregado }}</td>
                  <td class="kpi-num">{{ piolaPctTexto(kpi.totales.entregado, kpi.totales.comprometido) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="kpi-pie">
            Avance esperado a hoy: <b>{{ kpi.esperado }} %</b> del mes. El % de avance de cada marca va en verde
            si está al día, en naranja si está en riesgo y en rojo si está atrasada frente a ese ritmo.
            Pasa el cursor sobre una cifra de tipo para ver cuánto de eso ya se entregó.
          </p>
        </div>

        <!-- ══════════ MARCAS / CLIENTES ══════════ -->
        <v-card v-else-if="tab === 'marcas'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Marcas ({{ clientes.length }})</span>
            <v-spacer />
            <v-btn v-if="puedeCrear" size="small" color="primary" variant="flat" @click="abrirCliente()">
              <v-icon icon="mdi-plus" start /> Nueva marca
            </v-btn>
          </v-card-title>
          <v-data-table :headers="headersClientes" :items="clientes" class="elevation-0"
            no-data-text="Todavía no hay clientes. Se crean al convertir un lead ganado en el CRM."
            :items-per-page="25" @click:row="(_: any, r: any) => abrirCliente(r.item)">
            <template v-slot:item.comprometido="{ item }">
              <span v-if="comprometidoDe(item.id)">{{ comprometidoDe(item.id) }} pieza(s)</span>
              <span v-else style="opacity:.4">sin desglose</span>
            </template>
            <template v-slot:item.entregados="{ item }">
              {{ entregadosDe(item.id) }}
            </template>
            <template v-slot:item.acciones="{ item }">
              <v-btn v-if="puedeEditar" icon="mdi-clipboard-list-outline" size="x-small" variant="text"
                title="Definir compromisos del mes" @click.stop="abrirCompromisos(item.id)" />
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ CATÁLOGOS ══════════ -->
        <div v-else-if="tab === 'catalogo'" class="tablero-content">
          <!-- ── Tipos de contenido ── -->
          <v-card flat class="custom-data-table mb-6">
            <v-card-title class="table-search-bar">
              <span class="table-title">Tipos de contenido ({{ tiposContenido.length }})</span>
              <v-spacer />
              <v-btn v-if="puedeCrear" size="small" color="primary" variant="flat" @click="abrirTipo()">
                <v-icon icon="mdi-plus" start /> Nuevo tipo
              </v-btn>
            </v-card-title>
            <v-alert type="info" variant="tonal" density="compact" class="mx-4 mb-3">
              Videos, piezas gráficas, reels, guiones, rodajes… Lo que se agregue acá aparece en el
              tablero, en el formulario del entregable y en el desglose de cumplimiento.
            </v-alert>
            <v-data-table :headers="headersTipos" :items="tiposContenido" class="elevation-0"
              no-data-text="Sin tipos de contenido (¿falta correr la migración?)" :items-per-page="25">
              <template v-slot:item.nombre="{ item }">
                <span class="etapa-chip" :style="chipTipo(item.codigo)">
                  <v-icon v-if="item.icono" :icon="item.icono" size="13" start />{{ item.nombre }}
                </span>
              </template>
              <template v-slot:item.activo="{ item }">
                <span :style="{ opacity: item.activo ? 1 : .45 }">{{ item.activo ? 'Activo' : 'Oculto' }}</span>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="puedeEditar" icon="mdi-pencil-outline" size="x-small" variant="text"
                  @click="abrirTipo(item)" />
                <v-btn v-if="puedeEditar" :icon="item.activo ? 'mdi-eye-off' : 'mdi-eye'" size="x-small"
                  variant="text" @click="alternarTipo(item)" />
                <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
                  @click="eliminarTipo(item)" />
              </template>
            </v-data-table>
          </v-card>

          <!-- ── Servicios ── -->
          <v-card flat class="custom-data-table" style="padding:20px;">
            <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
              Lista provisional: <b>Piola enviará el catálogo completo y específico</b> de servicios.
              Se administra desde aquí, sin desarrollo.
            </v-alert>
            <div v-if="puedeEditar" class="serv-nuevo">
              <v-text-field v-model="nuevoServicio.nombre" label="Servicio" density="compact"
                hide-details variant="outlined" @keyup.enter="crearServicio" />
              <v-text-field v-model="nuevoServicio.categoria" label="Categoría" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model.number="nuevoServicio.precio_referencial" type="number"
                label="Precio ref. (S/)" density="compact" hide-details variant="outlined" />
              <v-btn color="primary" variant="flat" @click="crearServicio">Agregar</v-btn>
            </div>
            <v-data-table :headers="headersServicios" :items="servicios" class="elevation-0"
              no-data-text="Sin servicios" :items-per-page="25">
              <template v-slot:item.precio_referencial="{ item }">
                {{ item.precio_referencial ? PEN(item.precio_referencial) : '—' }}
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="puedeEditar" :icon="item.activo ? 'mdi-eye-off' : 'mdi-eye'" size="x-small"
                  variant="text" @click="alternarServicio(item)" />
                <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
                  @click="eliminarServicio(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>
      </div>
    </div>

    <!-- ══════════ ENTREGABLE ══════════ -->
    <v-dialog :model-value="!!detalle" max-width="760" scrollable @update:model-value="detalle = null">
      <v-card v-if="detalle">
        <v-card-title class="pt-4" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700;">{{ detalle.id ? 'Entregable' : 'Nuevo entregable' }}</span>
          <span v-if="detalle.tipo_contenido" class="etapa-chip" :style="chipTipo(detalle.tipo_contenido)">
            {{ nombreTipo(detalle.tipo_contenido) }}
          </span>
        </v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="detalle.titulo" label="Título *" density="compact" hide-details
              variant="outlined" class="col-2" />
            <v-select v-model="detalle.cliente_id" :items="opcionesCliente" label="Marca / cliente *"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.tipo_contenido" :items="opcionesTipo" label="Tipo de contenido"
              density="compact" hide-details variant="outlined" clearable />
            <!-- Un solo "Área" (reunión 14/09/2026): guiones, producción, grabación, edición,
                 presentación, diseño gráfico. Antes había dos campos —"Área" y "Etapa de producción"—
                 y se confundían con el Estado; el genérico (Dirección/Comercial/…) se quitó. -->
            <v-select v-model="detalle.area_produccion_id" :items="opcionesAreaProduccion"
              label="Área" density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="detalle.service_id" :items="opcionesServicio" label="Servicio"
              density="compact" hide-details variant="outlined" clearable />
            <v-text-field v-model.number="detalle.cantidad" type="number" label="Cantidad de piezas"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="detalle.periodo" label="Periodo (YYYY-MM)" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="detalle.fecha_compromiso" type="date" label="Fecha de compromiso"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="detalle.responsable_email" :items="opcionesResponsable"
              label="Responsable (editor / diseñador)" density="compact" hide-details variant="outlined" clearable />
            <v-select v-model="detalle.estado" :items="ESTADOS_ENTREGABLE" label="Estado"
              density="compact" hide-details variant="outlined" class="col-2" />

            <v-text-field v-model="detalle.drive_url" label="Enlace de Google Drive" density="compact"
              hide-details variant="outlined" prepend-inner-icon="mdi-google-drive">
              <template #append-inner>
                <a v-if="esUrl(detalle.drive_url)" :href="detalle.drive_url" target="_blank" rel="noopener"
                  class="link-abrir" title="Abrir en pestaña nueva">
                  <v-icon icon="mdi-open-in-new" size="16" />
                </a>
              </template>
            </v-text-field>
            <v-text-field v-model="detalle.dropbox_url" label="Enlace de Dropbox" density="compact"
              hide-details variant="outlined" prepend-inner-icon="mdi-dropbox">
              <template #append-inner>
                <a v-if="esUrl(detalle.dropbox_url)" :href="detalle.dropbox_url" target="_blank" rel="noopener"
                  class="link-abrir" title="Abrir en pestaña nueva">
                  <v-icon icon="mdi-open-in-new" size="16" />
                </a>
              </template>
            </v-text-field>
            <v-text-field v-model="detalle.publicado_url" label="Enlace publicado (post / reel ya en el aire)"
              density="compact" hide-details variant="outlined" prepend-inner-icon="mdi-web" class="col-2">
              <template #append-inner>
                <a v-if="esUrl(detalle.publicado_url)" :href="detalle.publicado_url" target="_blank" rel="noopener"
                  class="link-abrir" title="Abrir en pestaña nueva">
                  <v-icon icon="mdi-open-in-new" size="16" />
                </a>
              </template>
            </v-text-field>
          </div>
          <v-textarea v-model="detalle.descripcion" label="Descripción" rows="2" density="compact"
            hide-details variant="outlined" class="mt-3" />
          <v-textarea v-model="detalle.observaciones" label="Observaciones de Dirección" rows="2"
            density="compact" hide-details variant="outlined" class="mt-3" />

          <v-alert v-if="detalle.aprobado_por" type="success" variant="tonal" density="compact" class="mt-4">
            Aprobado por <b>{{ detalle.aprobado_por }}</b> el {{ fechaHora(detalle.aprobado_at) }}.
          </v-alert>
        </v-card-text>
        <v-card-actions style="flex-wrap:wrap; gap:8px; padding:12px 20px 18px;">
          <v-btn v-if="detalle.id && puedeEliminar" color="error" variant="text" @click="eliminarEntregable">
            Eliminar
          </v-btn>
          <v-btn v-if="detalle.id && puedeCrear" variant="tonal" :loading="duplicando"
            @click="duplicarEntregable(detalle)">
            <v-icon icon="mdi-content-copy" start /> Duplicar
          </v-btn>
          <v-btn v-if="detalle.id && puedeAprobar && detalle.estado === 'en_revision'" color="success"
            variant="tonal" :loading="aprobando" @click="aprobar">
            <v-icon icon="mdi-check-decagram" start /> Aprobar (Dirección)
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="detalle = null">Cerrar</v-btn>
          <v-btn v-if="puedeEditar" color="primary" variant="flat" :loading="guardando" @click="guardarEntregable">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ CLIENTE / MARCA ══════════ -->
    <v-dialog :model-value="!!cliente" max-width="600" @update:model-value="cliente = null">
      <v-card v-if="cliente">
        <v-card-title class="pt-4">{{ cliente.id ? 'Editar marca' : 'Nueva marca' }}</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="cliente.nombre" label="Nombre / marca *" density="compact"
              hide-details variant="outlined" class="col-2" />
            <v-text-field v-model="cliente.razon_social" label="Razón social" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="cliente.ruc" label="RUC" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.contacto" label="Contacto" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.telefono" label="Teléfono" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.email" label="Correo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="cliente.compromiso_mensual" type="number"
              label="Piezas comprometidas al mes (total)" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="cliente.direccion" label="Dirección" density="compact"
              hide-details variant="outlined" class="col-2" />
          </div>
          <v-alert type="info" variant="tonal" density="compact" class="mt-4">
            Este número es el total suelto. El desglose real —cuántos videos, cuántas piezas gráficas—
            se define en <b>Cumplimiento por marca → Definir compromisos</b>, que es lo que alimenta
            las barras por tipo.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="cliente.id && puedeEditar" variant="text" @click="abrirCompromisos(cliente.id)">
            <v-icon icon="mdi-clipboard-list-outline" start /> Compromisos del mes
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="cliente = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoCliente" @click="guardarCliente">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ COMPROMISOS POR TIPO ══════════ -->
    <v-dialog :model-value="!!compromisoDlg" max-width="860" scrollable
      @update:model-value="compromisoDlg = null">
      <v-card v-if="compromisoDlg">
        <v-card-title class="pt-4">Compromisos del mes por tipo de contenido</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-select v-model="compromisoDlg.cliente_id" :items="opcionesCliente" label="Marca *"
              density="compact" hide-details variant="outlined" @update:model-value="sincronizarLineas" />
            <v-select v-model="compromisoDlg.periodo" :items="periodos" label="Periodo"
              density="compact" hide-details variant="outlined" @update:model-value="sincronizarLineas" />
          </div>

          <v-alert type="info" variant="tonal" density="compact" class="mt-4 mb-3">
            Una fila por tipo de contenido. Deja en <b>0</b> los que esta marca no contrató: se borra
            el compromiso y el tipo deja de aparecer en su cumplimiento.
          </v-alert>

          <div v-if="cargandoLineas" class="kanban-vacio">Cargando…</div>
          <template v-else>
            <div class="comp-linea comp-cabecera">
              <span>Tipo</span><span>Cantidad</span><span>Notas</span>
            </div>
            <div v-for="l in compromisoDlg.lineas" :key="l.tipo_contenido" class="comp-linea">
              <span class="etapa-chip" :style="chipTipo(l.tipo_contenido)">{{ nombreTipo(l.tipo_contenido) }}</span>
              <v-text-field v-model.number="l.cantidad" type="number" min="0" density="compact"
                hide-details variant="outlined" />
              <v-text-field v-model="l.notas" density="compact" hide-details variant="outlined"
                placeholder="Opcional" />
            </div>
            <div v-if="!compromisoDlg.lineas.length" class="kanban-vacio">
              No hay tipos de contenido activos. Créalos en la pestaña Catálogo.
            </div>
            <div class="comp-total">
              Total comprometido: <b>{{ totalCompromisoDlg }}</b> pieza(s)
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="compromisoDlg = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoCompromisos" @click="guardarCompromisos">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ REPETIR EL MES ══════════ -->
    <v-dialog :model-value="!!clonarDlg" max-width="560" @update:model-value="clonarDlg = null">
      <v-card v-if="clonarDlg">
        <v-card-title class="pt-4">Repetir un mes</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Copia los compromisos por tipo y los entregables del mes de origen al de destino, para no
            volver a llenar todo. <b>No duplica</b> lo que ya exista en el destino: se puede ejecutar
            dos veces sin ensuciar nada.
          </v-alert>
          <div class="form-grid">
            <v-select v-model="clonarDlg.periodo_origen" :items="periodos" label="Copiar desde"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="clonarDlg.periodo_destino" :items="periodos" label="Hacia"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="clonarDlg.cliente_id" :items="opcionesClienteClonar" label="Marca"
              density="compact" hide-details variant="outlined" class="col-2" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="clonarDlg = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="clonando" @click="clonarPeriodo">
            <v-icon icon="mdi-content-duplicate" start /> Repetir
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ TIPO DE CONTENIDO ══════════ -->
    <v-dialog :model-value="!!tipoDlg" max-width="560" @update:model-value="tipoDlg = null">
      <v-card v-if="tipoDlg">
        <v-card-title class="pt-4">{{ tipoDlg.id ? 'Editar tipo' : 'Nuevo tipo de contenido' }}</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="tipoDlg.nombre" label="Nombre *" density="compact" hide-details
              variant="outlined" @update:model-value="autoClave" />
            <v-text-field v-model="tipoDlg.codigo" label="Clave interna *" density="compact"
              variant="outlined" :disabled="!!tipoDlg.id" persistent-hint
              :hint="tipoDlg.id ? 'No se cambia: es la que enlaza entregables y compromisos'
                : 'Se genera sola desde el nombre'" />
            <v-text-field v-model="tipoDlg.icono" label="Icono (mdi-…)" density="compact" hide-details
              variant="outlined" :prepend-inner-icon="tipoDlg.icono || 'mdi-shape-outline'" />
            <div class="color-campo">
              <v-text-field v-model="tipoDlg.color" label="Color (#rrggbb)" density="compact"
                hide-details variant="outlined" />
              <span class="color-muestra" :style="{ background: tipoDlg.color || 'transparent' }" />
            </div>
            <v-text-field v-model.number="tipoDlg.orden" type="number" label="Orden" density="compact"
              hide-details variant="outlined" />
            <v-switch v-model="tipoDlg.activo" color="primary" density="compact" hide-details label="Activo" />
          </div>
          <div class="mt-4">
            Se verá así: <span class="etapa-chip" :style="chipTipoColor(tipoDlg.color)">
              <v-icon v-if="tipoDlg.icono" :icon="tipoDlg.icono" size="13" start />
              {{ tipoDlg.nombre || 'Nombre del tipo' }}
            </span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="tipoDlg = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoTipo" @click="guardarTipo">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Producción y Contenidos (§6) — reconstruido tras la reunión del 31/08/2026.
 *
 * QUÉ CAMBIÓ Y POR QUÉ: el compromiso mensual era UN número suelto en
 * `piola_clientes.compromiso_mensual`, así que "7 videos + 7 piezas gráficas"
 * se veía como 14 y el porcentaje mentía (Edson: "¿cómo haríamos ahí?"). Ahora
 * el compromiso vive desglosado en `piola_compromisos` (marca × tipo × periodo)
 * y el número lo da la vista `piola_cumplimiento_tipo`, no un cálculo local:
 * si el embudo y la tabla se calcularan por separado podrían contradecirse.
 *
 * También se agregaron área y responsable por entregable (cada editor con su
 * lista), y los tres enlaces que pidió Raysa: Drive, Dropbox y el publicado.
 * Dropbox es un enlace fijo a la carpeta a propósito — avisar automáticamente
 * cuando un filmmaker sube algo quedó como investigación, no como compromiso.
 *
 * El flujo de aprobación sigue pasando siempre por el Director Estratégico.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, fechaCorta, fechaHora, periodoActual, ultimosPeriodos, hoyISO, ESTADOS_ENTREGABLE,
  traerTodo, apiPiola,
} from '@/composables/usePiola'
import {
  piolaAvanceEsperado, piolaConstruirKpi, piolaMatrizEstadoTipo, piolaNombrePeriodo, piolaPctTexto,
  piolaReporteHtml, piolaTituloKpi,
  PIOLA_RITMO_COLOR, PIOLA_RITMO_TEXTO,
} from '@/utils/piolaCumplimiento'
import type { KpiCelda, EntregableReporte } from '@/utils/piolaCumplimiento'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()

const puedeCrear = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'create'))
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'produccion', 'delete'))
/** La aprobación es del Director Estratégico: admin o quien tenga edición del módulo. */
const puedeAprobar = computed(() => props.perfil?.es_admin || puedeEditar.value)

const tab = ref('tablero')
const periodo = ref(periodoActual())
const periodos = ultimosPeriodos(12)

const entregables = ref<any[]>([])
const clientes = ref<any[]>([])
const servicios = ref<any[]>([])
const colaboradores = ref<any[]>([])
const tiposContenido = ref<any[]>([])
/**
 * "Área" del entregable (reunión 14/09/2026): guiones, producción, grabación, edición, presentación,
 * diseño gráfico. Antes se llamaba "Etapa de producción" y convivía con otro campo "Área" genérico
 * (Dirección / Comercial / …) que se eliminó porque se confundía con el Estado.
 */
const areasProduccion = ref<any[]>([])
const compromisos = ref<any[]>([])
const cumplimientoFilas = ref<any[]>([])
/** La migración de la reunión puede no estar corrida todavía: se avisa en vez de romper. */
const faltaMigracion = ref(false)

const fCliente = ref<any>('todas')
const fResponsable = ref<any>('todos')
const fArea = ref<any>('todas')
const fTipo = ref<any>('todos')

/* ══════════ Carga ══════════ */
async function cargar() {
  const [e, c, s, col, tc, arp] = await Promise.all([
    traerTodo(() => client.from('piola_deliverables').select('*')
      .order('fecha_compromiso', { ascending: true }).order('id')),
    client.from('piola_clientes').select('*').order('nombre'),
    client.from('piola_services').select('*').order('orden'),
    client.from('piola_colaboradores').select('email, nombre').eq('activo', true).order('nombre'),
    client.from('piola_tipos_contenido').select('*').order('orden').order('id'),
    client.from('piola_produccion_areas').select('id, codigo, nombre').eq('activo', true).order('orden'),
  ])
  if (e.error) emit('notify', { text: `Error cargando entregables: ${e.error.message}`, color: 'error' })
  entregables.value = (e.data as any[]) || []
  clientes.value = (c.data as any[]) || []
  servicios.value = (s.data as any[]) || []
  colaboradores.value = (col.data as any[]) || []
  tiposContenido.value = (tc.data as any[]) || []
  areasProduccion.value = (arp.data as any[]) || []
  if (tc.error) faltaMigracion.value = true
  await cargarPeriodo()
}

/**
 * Lo que depende del periodo elegido. El cumplimiento se LEE de la vista
 * `piola_cumplimiento_tipo` en vez de recalcularse acá: es la misma definición
 * de "entregado" (aprobado + entregado) para la UI y para los reportes.
 */
async function cargarPeriodo() {
  const [cm, cu] = await Promise.all([
    traerTodo(() => client.from('piola_compromisos').select('*')
      .eq('periodo', periodo.value).order('cliente_id').order('id')),
    traerTodo(() => client.from('piola_cumplimiento_tipo').select('*')
      .eq('periodo', periodo.value).order('cliente_id').order('tipo_contenido')),
  ])
  if (cm.error || cu.error) faltaMigracion.value = true
  compromisos.value = (cm.data as any[]) || []
  cumplimientoFilas.value = (cu.data as any[]) || []
}

watch(periodo, cargarPeriodo)

/* ══════════ Derivados y etiquetas ══════════ */
const nombreCliente = (id: any) => clientes.value.find(c => c.id === id)?.nombre || '—'
const nombreAreaProduccion = (id: any) => areasProduccion.value.find(a => a.id === id)?.nombre || '—'
const nombreColaborador = (email: any) =>
  colaboradores.value.find(c => String(c.email).toLowerCase() === String(email).toLowerCase())?.nombre
  || email || 'Sin asignar'
const etiquetaEstadoEntregable = (v: any) =>
  ESTADOS_ENTREGABLE.find(e => e.value === v)?.title || v || '—'

const iniciales = (email: string) => {
  const base = nombreColaborador(email)
  return String(base).split(/[\s@._-]+/).filter(Boolean).slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase()).join('')
}

const tipoDe = (clave: any) => tiposContenido.value.find(t => t.codigo === clave)
const nombreTipo = (clave: any) => {
  if (!clave || clave === 'sin_clasificar') return 'Sin clasificar'
  return tipoDe(clave)?.nombre || String(clave)
}
const colorTipo = (clave: any) => tipoDe(clave)?.color || '#8a8a8a'
/** El color lo escribe el usuario: si no es un hex de 6 dígitos, no se le puede concatenar alfa. */
function chipTipoColor(color: any) {
  const c = String(color || '#8a8a8a')
  const hex = /^#[0-9a-fA-F]{6}$/.test(c)
  return {
    background: hex ? `${c}22` : 'rgba(128,128,128,.15)',
    color: c,
    border: `1px solid ${hex ? `${c}55` : 'rgba(128,128,128,.35)'}`,
  }
}
const chipTipo = (clave: any) => chipTipoColor(colorTipo(clave))

const esUrl = (v: any) => /^https?:\/\//i.test(String(v || ''))
const tieneEnlaces = (e: any) => esUrl(e.drive_url) || esUrl(e.dropbox_url) || esUrl(e.publicado_url)

const opcionesCliente = computed(() => clientes.value.map(c => ({ value: c.id, title: c.nombre })))
const opcionesClienteFiltro = computed(() =>
  [{ value: 'todas', title: 'Todas las marcas' }, ...opcionesCliente.value])
const opcionesClienteClonar = computed(() =>
  [{ value: 'todas', title: 'Todas las marcas' }, ...opcionesCliente.value])
const opcionesServicio = computed(() => servicios.value.map(s => ({ value: s.id, title: s.nombre })))
const opcionesResponsable = computed(() =>
  colaboradores.value.map(c => ({ value: c.email, title: c.nombre })))
const opcionesResponsableFiltro = computed(() =>
  [{ value: 'todos', title: 'Todos' }, ...opcionesResponsable.value])
/**
 * `piola_produccion_areas` la sembró otra sesión con un guess PRE-reunión
 * ('rodajes', 'diseno', 'community'), reemplazado el 07/09 por Sebastián con
 * guiones/producción/grabación/edición/presentación/diseño gráfico (6 áreas),
 * y ese set quedó reemplazado a su vez el 21/09/2026 (Raysa + Sebastián, en
 * reunión y confirmado en el checklist escrito): las 4 áreas reales son
 * Guiones, Creadores operativos, Filmmakers y Diseño gráfico. Ninguna fila
 * vieja se borra ni se renombra — "Creadores operativos" y "Filmmakers" no
 * son sinónimos evidentes de "Producción" ni "Grabación" (adivinar el mapeo
 * habría reinterpretado en silencio el área de un entregable real ya
 * cargado) — se agregan como filas NUEVAS y el filtro solo cambia qué se
 * ofrece de acá en adelante.
 */
const CODIGOS_AREA_PRODUCCION_CONFIRMADOS = [
  'guiones', 'creadores_operativos', 'filmmakers', 'diseno_grafico',
]
const opcionesAreaProduccion = computed(() => areasProduccion.value
  .filter(a => CODIGOS_AREA_PRODUCCION_CONFIRMADOS.includes(a.codigo))
  .map(a => ({ value: a.id, title: a.nombre })))
const opcionesAreaFiltro = computed(() => [
  { value: 'todas', title: 'Todas las áreas' },
  ...opcionesAreaProduccion.value,
  { value: 'sin_area', title: 'Sin área' },
])
const tiposActivos = computed(() => tiposContenido.value.filter(t => t.activo !== false))
const opcionesTipo = computed(() => tiposActivos.value.map(t => ({ value: t.codigo, title: t.nombre })))
const opcionesTipoFiltro = computed(() => [
  { value: 'todos', title: 'Todos los tipos' },
  ...opcionesTipo.value,
  { value: 'sin_clasificar', title: 'Sin clasificar' },
])

const hayFiltros = computed(() =>
  fCliente.value !== 'todas' || fResponsable.value !== 'todos'
  || fArea.value !== 'todas' || fTipo.value !== 'todos')

function limpiarFiltros() {
  fCliente.value = 'todas'
  fResponsable.value = 'todos'
  fArea.value = 'todas'
  fTipo.value = 'todos'
}

/** Todo menos el filtro de responsable: la vista "Por responsable" agrupa por esa columna. */
const baseFiltrada = computed(() => {
  let lista = entregables.value.filter(e => e.periodo === periodo.value)
  if (fCliente.value !== 'todas') lista = lista.filter(e => e.cliente_id === fCliente.value)
  if (fArea.value === 'sin_area') lista = lista.filter(e => !e.area_produccion_id)
  else if (fArea.value !== 'todas') lista = lista.filter(e => e.area_produccion_id === fArea.value)
  if (fTipo.value === 'sin_clasificar') lista = lista.filter(e => !e.tipo_contenido)
  else if (fTipo.value !== 'todos') lista = lista.filter(e => e.tipo_contenido === fTipo.value)
  return lista
})

const delPeriodo = computed(() => fResponsable.value === 'todos'
  ? baseFiltrada.value
  : baseFiltrada.value.filter(e => e.responsable_email === fResponsable.value))

const porEstado = (estado: string) => delPeriodo.value.filter(e => e.estado === estado)

const atrasado = (e: any) =>
  !['entregado', 'aprobado'].includes(e.estado) && e.fecha_compromiso
  && String(e.fecha_compromiso).slice(0, 10) < hoyISO()

/* ── Por responsable: la "lista de pendientes" de cada editor ── */
const ESTADOS_PENDIENTES = ['en_produccion', 'en_revision', 'rechazado']

const pendientesPorResponsable = computed(() => {
  const grupos = new Map<string, any>()
  for (const e of baseFiltrada.value.filter(x => ESTADOS_PENDIENTES.includes(x.estado))) {
    const clave = e.responsable_email || '__sin_asignar__'
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        email: e.responsable_email || null,
        nombre: e.responsable_email ? nombreColaborador(e.responsable_email) : 'Sin asignar',
        items: [] as any[], atrasados: 0, piezas: 0,
      })
    }
    const g = grupos.get(clave)
    g.items.push(e)
    g.piezas += Number(e.cantidad || 1)
    if (atrasado(e)) g.atrasados++
  }
  // Sin asignar va al final: es una lista de tareas, no un colaborador
  return [...grupos.values()].sort((a, b) =>
    (a.email ? 0 : 1) - (b.email ? 0 : 1)
    || b.atrasados - a.atrasados
    || b.items.length - a.items.length)
})

/* ── Cumplimiento por marca × tipo ── */
const pct = (entregado: any, comprometido: any) => Number(comprometido)
  ? Math.round(Number(entregado || 0) / Number(comprometido) * 1000) / 10
  : 0

const entregadosDe = (clienteId: any) => entregables.value
  .filter(e => e.cliente_id === clienteId && e.periodo === periodo.value
    && ['entregado', 'aprobado'].includes(e.estado))
  .reduce((s, e) => s + Number(e.cantidad || 1), 0)

const comprometidoDe = (clienteId: any) => compromisos.value
  .filter(c => c.cliente_id === clienteId)
  .reduce((s, c) => s + Number(c.cantidad || 0), 0)

const ordenTipo = (clave: any) => {
  const t = tipoDe(clave)
  return t ? Number(t.orden || 0) : 9999   // lo no catalogado, al final
}

const cumplimientoPorMarca = computed(() => {
  const mapa = new Map<any, any>()
  const grupo = (id: any, nombre?: string) => {
    if (!mapa.has(id)) {
      mapa.set(id, {
        cliente_id: id, cliente: nombre || nombreCliente(id), filas: [] as any[],
        comprometido: 0, entregado: 0, en_revision: 0, en_produccion: 0, pct: 0,
      })
    }
    return mapa.get(id)
  }

  // Las marcas activas aparecen aunque no tengan nada cargado: si no, no hay
  // dónde hacer clic para definirles el compromiso del mes.
  for (const c of clientes.value.filter(x => x.activo !== false)) grupo(c.id, c.nombre)

  for (const f of cumplimientoFilas.value) {
    const g = grupo(f.cliente_id, f.cliente_nombre)
    // Un tipo sin compromiso y sin nada cargado no aporta información
    if (!Number(f.comprometido || 0) && !Number(f.total_cargado || 0)) continue
    g.filas.push({
      tipo_contenido: f.tipo_contenido,
      comprometido: Number(f.comprometido || 0),
      entregado: Number(f.entregado || 0),
      en_revision: Number(f.en_revision || 0),
      en_produccion: Number(f.en_produccion || 0),
      rechazado: Number(f.rechazado || 0),
      total_cargado: Number(f.total_cargado || 0),
    })
    g.comprometido += Number(f.comprometido || 0)
    g.entregado += Number(f.entregado || 0)
    g.en_revision += Number(f.en_revision || 0)
    g.en_produccion += Number(f.en_produccion || 0)
  }

  const salida = [...mapa.values()]
  for (const g of salida) {
    g.filas.sort((a: any, b: any) => ordenTipo(a.tipo_contenido) - ordenTipo(b.tipo_contenido))
    g.pct = pct(g.entregado, g.comprometido)
  }
  // Primero lo que tiene compromiso y va más atrasado; las marcas sin nada, al final
  return salida.sort((a, b) =>
    (a.comprometido ? 0 : 1) - (b.comprometido ? 0 : 1)
    || a.pct - b.pct
    || String(a.cliente).localeCompare(String(b.cliente)))
})

const totalesPeriodo = computed(() => {
  const t = { comprometido: 0, entregado: 0, en_revision: 0, en_produccion: 0, pct: 0 }
  for (const g of cumplimientoPorMarca.value) {
    t.comprometido += g.comprometido
    t.entregado += g.entregado
    t.en_revision += g.en_revision
    t.en_produccion += g.en_produccion
  }
  t.pct = pct(t.entregado, t.comprometido)
  return t
})

/* ══════════ Tabla KPI estilo Excel + reportes PDF ══════════ */
/**
 * Reunión del 14/09/2026: el equipo (7 personas) llevaba un Excel manual de KPIs; se replica acá en el
 * mismo formato para que lo llenen en tiempo real moviendo entregables en el tablero. La cuenta vive en
 * utils/piolaCumplimiento.ts (probada aparte); acá solo se conecta con los datos y los filtros.
 */
const kpiMarca = ref<any>('todas')
const RITMOS_LEYENDA = ['completo', 'al_dia', 'en_riesgo', 'atrasado'] as const

const nombrePeriodo = computed(() => piolaNombrePeriodo(periodo.value))
/** "KPI Y SEGUIMIENTO AGENCIA PIOLA SEPTIEMBRE 2026": el título de la hoja del Excel */
const tituloKpi = computed(() => piolaTituloKpi(periodo.value))
/** Lo que "debería" llevar el mes hoy (quincena = 50 %). */
const avanceEsperado = computed(() => piolaAvanceEsperado(periodo.value, hoyISO()))

const kpi = computed(() => {
  const todas = kpiMarca.value === 'todas'
  // Las marcas activas salen siempre (aunque no tengan nada cargado: es donde se hace clic para definirles el
  // compromiso). Una marca inactiva solo sale si tiene compromisos o entregables en el mes, igual que las
  // tarjetas de arriba: si no, el total de la tabla no coincidiría con el "Comprometido" del resumen.
  const marcas = clientes.value
    .filter(c => c.activo !== false && (todas || c.id === kpiMarca.value))
    .map(c => ({ id: c.id, nombre: c.nombre }))
  const filas = cumplimientoFilas.value.filter(f => todas || f.cliente_id === kpiMarca.value)
  return piolaConstruirKpi(filas, marcas, tiposActivos.value, avanceEsperado.value)
})

/** La celda del Excel muestra lo comprometido; cuánto de eso ya se entregó queda en el tooltip. */
const tituloCelda = (c?: KpiCelda) => c && (c.comprometido || c.entregado)
  ? `Entregado: ${c.entregado} de ${c.comprometido || 0}` : ''

/**
 * Abre el reporte en otra pestaña y lo manda a imprimir (Guardar como PDF). Si el navegador bloquea las
 * ventanas emergentes (o es un celular), se imprime desde un iframe oculto: así nunca depende de un permiso.
 */
function abrirReporte(html: string) {
  const w = window.open('', '_blank')
  if (w) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    return
  }
  const marco = document.createElement('iframe')
  marco.setAttribute('aria-hidden', 'true')
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(marco)
  const doc = marco.contentWindow?.document
  if (!doc) { marco.remove(); return emit('notify', { text: 'No se pudo preparar el reporte para imprimir', color: 'error' }) }
  doc.open()
  // El script que imprime por su cuenta es solo para la pestaña nueva; acá se imprime desde el iframe
  doc.write(html.replace(/<script>[\s\S]*?<\/script>/, ''))
  doc.close()
  setTimeout(() => {
    marco.contentWindow?.focus()
    marco.contentWindow?.print()
    setTimeout(() => marco.remove(), 120000)
  }, 300)
}

const fechaLarga = () => new Date().toLocaleString('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short',
})

function entregableReporte(e: any): EntregableReporte {
  return {
    titulo: e.titulo, marca: nombreCliente(e.cliente_id), tipo: e.tipo_contenido || 'sin_clasificar',
    area: e.area_produccion_id ? nombreAreaProduccion(e.area_produccion_id) : '',
    responsable: e.responsable_email ? String(nombreColaborador(e.responsable_email)) : '',
    estado: e.estado, fecha: e.fecha_compromiso ? fechaCorta(e.fecha_compromiso) : '',
    cantidad: Number(e.cantidad || 1),
  }
}

/** Cumplimiento por marca (todas, o la marca elegida arriba) + el detalle de sus entregables. */
function imprimirKpi() {
  const marcaTxt = kpiMarca.value === 'todas' ? 'Todas las marcas' : nombreCliente(kpiMarca.value)
  const items = entregables.value
    .filter(e => e.periodo === periodo.value && (kpiMarca.value === 'todas' || e.cliente_id === kpiMarca.value))
    .map(entregableReporte)
    .sort((a, b) => a.marca.localeCompare(b.marca, 'es') || a.titulo.localeCompare(b.titulo, 'es'))
  abrirReporte(piolaReporteHtml({
    titulo: 'Cumplimiento por marca',
    subtitulo: `${nombrePeriodo.value} · ${marcaTxt}`,
    generado: fechaLarga(),
    kpi: kpi.value,
    esperado: avanceEsperado.value,
    periodo: periodo.value,
    entregables: items,
    nombreTipo, nombreEstado: etiquetaEstadoEntregable,
  }))
}

/** Foto del tablero de producción con los filtros de arriba: piezas por estado y tipo + la lista. */
function imprimirTablero() {
  const items = delPeriodo.value.map(entregableReporte)
    .sort((a, b) => a.estado.localeCompare(b.estado) || a.marca.localeCompare(b.marca, 'es'))
  const filtros = [
    fCliente.value !== 'todas' ? nombreCliente(fCliente.value) : '',
    typeof fArea.value === 'number' ? nombreAreaProduccion(fArea.value) : '',
    fTipo.value !== 'todos' ? nombreTipo(fTipo.value) : '',
    fResponsable.value !== 'todos' ? String(nombreColaborador(fResponsable.value)) : '',
  ].filter(Boolean)
  const tiposCatalogo = tiposActivos.value.map(t => ({ codigo: t.codigo, nombre: t.nombre }))
  if (items.some(i => i.tipo === 'sin_clasificar')) tiposCatalogo.push({ codigo: 'sin_clasificar', nombre: 'Sin clasificar' })
  abrirReporte(piolaReporteHtml({
    titulo: 'Tablero de producción',
    subtitulo: `${nombrePeriodo.value} · ${filtros.length ? filtros.join(' · ') : 'Todas las marcas'}`,
    generado: fechaLarga(),
    matriz: {
      estados: ESTADOS_ENTREGABLE.map((e: any) => ({ value: e.value, title: e.title })),
      tipos: tiposCatalogo,
      datos: piolaMatrizEstadoTipo(items),
    },
    entregables: items,
    nombreTipo, nombreEstado: etiquetaEstadoEntregable,
  }))
}

/* ══════════ Tablas ══════════ */
const headersClientes = computed(() => [
  { title: 'Marca', key: 'nombre' },
  { title: 'RUC', key: 'ruc' },
  { title: 'Contacto', key: 'contacto' },
  { title: `Comprometido ${periodo.value}`, key: 'comprometido', sortable: false },
  { title: `Entregado ${periodo.value}`, key: 'entregados', sortable: false },
  { title: '', key: 'acciones', sortable: false },
])
const headersServicios = [
  { title: 'Servicio', key: 'nombre' },
  { title: 'Categoría', key: 'categoria' },
  { title: 'Precio referencial', key: 'precio_referencial' },
  { title: '', key: 'acciones', sortable: false },
]
const headersTipos = [
  { title: 'Tipo', key: 'nombre' },
  { title: 'Clave', key: 'codigo' },
  { title: 'Orden', key: 'orden' },
  { title: 'Estado', key: 'activo' },
  { title: '', key: 'acciones', sortable: false },
]

/* ══════════ CRUD de entregables ══════════ */
const detalle = ref<any>(null)
const guardando = ref(false)
const aprobando = ref(false)

/* ══════════ Arrastrar y soltar en el tablero ══════════ */
const arrastrandoId = ref<number | null>(null)
const colSobrevolada = ref<string | null>(null)

function onIniciarArrastre(e: any) {
  arrastrandoId.value = e.id
}
function onFinArrastre() {
  arrastrandoId.value = null
  colSobrevolada.value = null
}
function onArrastreSobreColumna(estado: string) {
  if (!puedeEditar.value) return
  colSobrevolada.value = estado
}

async function onSoltarEnColumna(estadoNuevo: string) {
  const id = arrastrandoId.value
  colSobrevolada.value = null
  arrastrandoId.value = null
  if (!id || !puedeEditar.value) return

  const item = entregables.value.find(e => e.id === id)
  if (!item || item.estado === estadoNuevo) return

  // Optimista: la tarjeta salta de columna al instante y recién ahí se
  // confirma con el servidor. Si falla, vuelve a su columna — es más honesto
  // que dejarla "flotando" a medias mientras se espera la respuesta.
  const estadoAnterior = item.estado
  item.estado = estadoNuevo

  const { error, data } = await apiPiola('produccion', {
    accion: 'mover_entregable', id, estado: estadoNuevo,
  })
  if (error) {
    item.estado = estadoAnterior
    return emit('notify', { text: `No se pudo mover: ${error.message}`, color: 'error' })
  }
  // El servidor puede haber puesto aprobado_por/aprobado_at/fecha_entrega —
  // se reflejan en la tarjeta sin esperar a un recargo completo.
  if (data?.entregable) Object.assign(item, data.entregable)
}

function abrirNuevo() {
  detalle.value = {
    titulo: '', cliente_id: fCliente.value !== 'todas' ? fCliente.value : null,
    service_id: null, cantidad: 1,
    tipo_contenido: fTipo.value !== 'todos' && fTipo.value !== 'sin_clasificar' ? fTipo.value : null,
    area_produccion_id: typeof fArea.value === 'number' ? fArea.value : null,
    periodo: periodo.value, fecha_compromiso: '', responsable_email: props.perfil?.email || null,
    estado: 'en_produccion', drive_url: '', dropbox_url: '', publicado_url: '',
    descripcion: '', observaciones: '',
  }
}

async function guardarEntregable() {
  const d = detalle.value
  if (!d.titulo?.trim() || !d.cliente_id) {
    return emit('notify', { text: 'El entregable necesita título y marca', color: 'error' })
  }
  guardando.value = true
  const fila = {
    titulo: d.titulo.trim(), cliente_id: d.cliente_id, service_id: d.service_id || null,
    cantidad: Number(d.cantidad || 1), periodo: d.periodo, descripcion: d.descripcion || null,
    tipo_contenido: d.tipo_contenido || null, area_id: d.area_id || null,
    area_produccion_id: d.area_produccion_id || null,
    fecha_compromiso: d.fecha_compromiso || null,
    fecha_entrega: d.estado === 'entregado' ? (d.fecha_entrega || hoyISO()) : d.fecha_entrega || null,
    estado: d.estado, responsable_email: d.responsable_email || null,
    observaciones: d.observaciones || null, drive_url: d.drive_url || null,
    dropbox_url: d.dropbox_url || null, publicado_url: d.publicado_url || null,
    updated_at: new Date().toISOString(),
  }
  const res = await apiPiola('produccion', { accion: 'guardar_entregable', id: d.id || null, ...fila })
  guardando.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', d.id ? 'Entregable actualizado' : 'Entregable creado')
  detalle.value = null
  await cargar()
}

/* ══════════ Duplicar (botón de la tarjeta, del diálogo y clic derecho) ══════════ */
const duplicando = ref(false)
const menuCtx = ref<{ abierto: boolean; x: number; y: number; item: any }>({ abierto: false, x: 0, y: 0, item: null })

function abrirMenuTarjeta(ev: MouseEvent, e: any) {
  menuCtx.value = { abierto: true, x: ev.clientX, y: ev.clientY, item: e }
}
function abrirDesdeMenu() {
  if (menuCtx.value.item) detalle.value = { ...menuCtx.value.item }
}
function duplicarDesdeMenu() {
  if (menuCtx.value.item) duplicarEntregable(menuCtx.value.item)
}

/**
 * Crea la copia en el servidor (`duplicar_entregable`: no copia enlaces, aprobación ni fecha de entrega
 * y arranca "En producción") y abre la copia ya guardada para que la persona solo le cambie el título.
 */
async function duplicarEntregable(original: any) {
  if (!original?.id || duplicando.value) return
  duplicando.value = true
  const res = await apiPiola<any>('produccion', { accion: 'duplicar_entregable', id: original.id })
  duplicando.value = false
  if (res.error) return emit('notify', { text: `No se pudo duplicar: ${res.error.message}`, color: 'error' })
  emit('notify', 'Entregable duplicado: cámbiale el título y guarda')
  await cargar()
  const copia = res.data?.entregable
  if (copia) detalle.value = { ...(entregables.value.find(e => e.id === copia.id) || copia) }
}

async function aprobar() {
  aprobando.value = true
  // Quién aprueba y cuándo los pone el servidor: el campo existe para poder
  // responder esas dos preguntas, y un valor que escribe el navegador no lo hace.
  const { error } = await apiPiola('produccion', {
    accion: 'aprobar_entregable', id: detalle.value.id,
  })
  aprobando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Entregable aprobado por Dirección')
  detalle.value = null
  await cargar()
}

async function eliminarEntregable() {
  if (!confirm(`¿Eliminar "${detalle.value.titulo}"?`)) return
  const { error } = await apiPiola('produccion', {
    accion: 'eliminar_entregable', id: detalle.value.id,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Entregable eliminado')
  detalle.value = null
  await cargar()
}

/* ══════════ CRUD de marcas ══════════ */
const cliente = ref<any>(null)
const guardandoCliente = ref(false)

function abrirCliente(item?: any) {
  cliente.value = item ? { ...item } : {
    nombre: '', razon_social: '', ruc: '', contacto: '', telefono: '', email: '',
    direccion: '', compromiso_mensual: 0,
  }
}

async function guardarCliente() {
  const c = cliente.value
  if (!c.nombre?.trim()) return emit('notify', { text: 'La marca necesita un nombre', color: 'error' })
  guardandoCliente.value = true
  const fila = {
    nombre: c.nombre.trim(), razon_social: c.razon_social || null, ruc: c.ruc || null,
    contacto: c.contacto || null, telefono: c.telefono || null, email: c.email || null,
    direccion: c.direccion || null, compromiso_mensual: Number(c.compromiso_mensual || 0),
  }
  const res = await apiPiola('produccion', { accion: 'guardar_cliente', id: c.id || null, ...fila })
  guardandoCliente.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', c.id ? 'Marca actualizada' : 'Marca creada')
  cliente.value = null
  await cargar()
}

/* ══════════ Compromisos por tipo ══════════ */
const compromisoDlg = ref<any>(null)
const cargandoLineas = ref(false)
const guardandoCompromisos = ref(false)

function abrirCompromisos(clienteId?: any) {
  cliente.value = null
  compromisoDlg.value = {
    cliente_id: clienteId ?? (fCliente.value !== 'todas' ? fCliente.value : clientes.value[0]?.id ?? null),
    periodo: periodo.value,
    lineas: [] as any[],
  }
  sincronizarLineas()
}

/**
 * Arma una línea por tipo activo, precargada con el compromiso que ya exista.
 * Consulta directo la combinación marca+periodo elegida en el diálogo (que
 * puede no ser el periodo del selector de arriba), pero son ~10 filas: no
 * necesita paginado.
 */
async function sincronizarLineas() {
  const d = compromisoDlg.value
  if (!d) return
  if (!d.cliente_id || !d.periodo) { d.lineas = []; return }

  cargandoLineas.value = true
  const { data, error } = await client.from('piola_compromisos').select('*')
    .eq('cliente_id', d.cliente_id).eq('periodo', d.periodo)
  cargandoLineas.value = false
  if (error) {
    faltaMigracion.value = true
    return emit('notify', { text: `Error cargando compromisos: ${error.message}`, color: 'error' })
  }

  const existentes = (data as any[]) || []
  const claves = tiposActivos.value.map(t => t.codigo)
  // Un tipo desactivado con compromiso vigente se sigue mostrando: ocultarlo
  // borraría el número sin que nadie lo haya decidido.
  for (const c of existentes) if (!claves.includes(c.tipo_contenido)) claves.push(c.tipo_contenido)

  d.lineas = claves.map(clave => {
    const previo = existentes.find(c => c.tipo_contenido === clave)
    return {
      tipo_contenido: clave,
      id: previo?.id || null,
      cantidad: Number(previo?.cantidad || 0),
      area_id: previo?.area_id || null,
      notas: previo?.notas || '',
    }
  })
}

const totalCompromisoDlg = computed(() => (compromisoDlg.value?.lineas || [])
  .reduce((s: number, l: any) => s + Math.max(0, Number(l.cantidad || 0)), 0))

async function guardarCompromisos() {
  const d = compromisoDlg.value
  if (!d?.cliente_id) return emit('notify', { text: 'Elige la marca', color: 'error' })

  guardandoCompromisos.value = true
  let guardadas = 0
  let borradas = 0
  for (const l of d.lineas) {
    const cantidad = Math.max(0, Number(l.cantidad || 0))
    if (cantidad > 0) {
      const res = await apiPiola('produccion', {
        accion: 'guardar_compromiso', id: l.id || null, cliente_id: d.cliente_id,
        tipo_contenido: l.tipo_contenido, periodo: d.periodo, cantidad,
        area_id: l.area_id || null, notas: l.notas || null,
      })
      if (res.error) {
        guardandoCompromisos.value = false
        return emit('notify', {
          text: `Error en ${nombreTipo(l.tipo_contenido)}: ${res.error.message}`, color: 'error',
        })
      }
      guardadas++
    } else if (l.id) {
      // Cantidad 0 sobre un compromiso existente = ya no se comprometió ese tipo
      const res = await apiPiola('produccion', { accion: 'eliminar_compromiso', id: l.id })
      if (res.error) {
        guardandoCompromisos.value = false
        return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
      }
      borradas++
    }
  }
  guardandoCompromisos.value = false
  emit('notify', `Compromisos guardados (${guardadas} tipo(s)${borradas ? `, ${borradas} retirado(s)` : ''})`)
  compromisoDlg.value = null
  await cargarPeriodo()
}

/* ══════════ Repetir el mes ══════════ */
const clonarDlg = ref<any>(null)
const clonando = ref(false)

function periodoAnterior(p: string) {
  const [y, m] = String(p).split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

function abrirClonar() {
  clonarDlg.value = {
    periodo_origen: periodoAnterior(periodo.value),
    periodo_destino: periodo.value,
    cliente_id: fCliente.value !== 'todas' ? fCliente.value : 'todas',
  }
}

async function clonarPeriodo() {
  const d = clonarDlg.value
  if (d.periodo_origen === d.periodo_destino) {
    return emit('notify', { text: 'El mes de origen y el de destino son el mismo', color: 'error' })
  }
  clonando.value = true
  const res = await apiPiola<any>('produccion', {
    accion: 'clonar_periodo',
    cliente_id: d.cliente_id === 'todas' ? null : d.cliente_id,
    periodo_origen: d.periodo_origen,
    periodo_destino: d.periodo_destino,
  })
  clonando.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })

  const r: any = res.data || {}
  const c = Number(r.compromisos_clonados || 0)
  const e = Number(r.entregables_clonados || 0)
  const o = Number(r.omitidos || 0)
  emit('notify', {
    text: `Se copiaron ${c} compromiso(s) y ${e} entregable(s)`
      + (o ? `. ${o} omitido(s) porque ya existían en ${d.periodo_destino}.` : '.'),
    color: c || e ? 'success' : 'info',
  })
  clonarDlg.value = null
  periodo.value = d.periodo_destino
  await cargar()
}

/* ══════════ Catálogo de tipos de contenido ══════════ */
const tipoDlg = ref<any>(null)
const guardandoTipo = ref(false)

/** 'Pieza gráfica' → 'pieza_grafica'. La clave es la que enlaza todo, así que se normaliza. */
function aClave(nombre: string) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function abrirTipo(item?: any) {
  tipoDlg.value = item
    ? { ...item }
    : { nombre: '', codigo: '', icono: 'mdi-shape-outline', color: '#3d6fe0',
        orden: tiposContenido.value.length + 1, activo: true }
}

function autoClave() {
  // Solo al crear: cambiar la clave de un tipo existente dejaría huérfanos sus
  // entregables y compromisos, que la referencian por texto.
  if (tipoDlg.value && !tipoDlg.value.id) tipoDlg.value.codigo = aClave(tipoDlg.value.nombre)
}

async function guardarTipo() {
  const t = tipoDlg.value
  const nombre = String(t.nombre || '').trim()
  const clave = aClave(t.codigo || t.nombre)
  if (!nombre || !clave) {
    return emit('notify', { text: 'El tipo necesita nombre y clave', color: 'error' })
  }
  guardandoTipo.value = true
  const res = await apiPiola('produccion', {
    accion: 'guardar_tipo_contenido', id: t.id || null,
    codigo: clave, nombre, icono: t.icono || null, color: t.color || null,
    orden: Number(t.orden || 0), activo: t.activo !== false,
  })
  guardandoTipo.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', t.id ? 'Tipo actualizado' : 'Tipo de contenido creado')
  tipoDlg.value = null
  await cargar()
}

async function alternarTipo(t: any) {
  const res = await apiPiola('produccion', {
    accion: 'guardar_tipo_contenido', id: t.id, codigo: t.codigo, nombre: t.nombre,
    icono: t.icono, color: t.color, orden: t.orden, activo: !t.activo,
  })
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  await cargar()
}

async function eliminarTipo(t: any) {
  if (!confirm(
    `¿Eliminar el tipo "${t.nombre}"?\n\n`
    + 'Los entregables y compromisos que lo usan quedarán sin clasificar. '
    + 'Si solo quieres dejar de ofrecerlo, desactívalo en vez de borrarlo.',
  )) return
  const res = await apiPiola('produccion', { accion: 'eliminar_tipo_contenido', id: t.id })
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', 'Tipo de contenido eliminado')
  await cargar()
}

/* ══════════ Catálogo de servicios ══════════ */
const nuevoServicio = ref<any>({ nombre: '', categoria: '', precio_referencial: null })

async function crearServicio() {
  if (!nuevoServicio.value.nombre?.trim()) return
  const { error } = await apiPiola('produccion', {
    accion: 'servicio_crear',
    nombre: nuevoServicio.value.nombre.trim(),
    categoria: nuevoServicio.value.categoria || null,
    precio_referencial: nuevoServicio.value.precio_referencial || null,
    orden: servicios.value.length + 1,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  nuevoServicio.value = { nombre: '', categoria: '', precio_referencial: null }
  emit('notify', 'Servicio agregado')
  await cargar()
}

async function alternarServicio(s: any) {
  const { error } = await apiPiola('produccion', {
    accion: 'servicio_actualizar', id: s.id, activo: !s.activo,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

async function eliminarServicio(s: any) {
  if (!confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return
  const { error } = await apiPiola('produccion', { accion: 'servicio_eliminar', id: s.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

onMounted(cargar)
</script>

<style scoped>
/* Las pestañas que no delegan en un v-card necesitan su propio padding: sin
   esto el contenido queda pegado al borde de .table-section. */
.tablero-content { padding: 1rem 1.5rem 1.5rem; }

.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; align-items: center; }
.filtros-bar .filtro { flex: 1 1 170px; max-width: 240px; }

.kanban { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start; }
.kanban-col {
  flex: 0 0 250px; background: rgba(128, 128, 128, .06);
  border: 1px solid rgba(128, 128, 128, .18); border-radius: 12px; padding: 12px;
}
.kanban-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.kanban-nombre { font-weight: 600; font-size: 12.5px; }
.kanban-count {
  background: rgba(128, 128, 128, .2); border-radius: 999px; padding: 1px 8px; font-size: 11.5px; font-weight: 600;
}
.kanban-body {
  display: flex; flex-direction: column; gap: 8px; min-height: 50px;
  border-radius: 9px; transition: background-color .12s, outline-color .12s;
  outline: 2px dashed transparent; outline-offset: -2px;
}
/* Columna destino mientras se arrastra una tarjeta encima. */
.kanban-body-destino { background: rgba(var(--v-theme-primary), .08); outline-color: rgba(var(--v-theme-primary), .5); }
.kanban-vacio { font-size: 12px; opacity: .4; text-align: center; padding: 16px 0; }

.ent-card {
  /* Ver nota en PiolaCRM.vue (.lead-card): var(--bg) no existe y caía a #fff. */
  background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(128, 128, 128, .2);
  border-radius: 9px; padding: 10px 11px; cursor: pointer; transition: transform .12s, box-shadow .12s;
}
.ent-card { position: relative; }
.ent-card:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0, 0, 0, .1); }
/* Botón "Duplicar" de la tarjeta: aparece al pasar el mouse (en pantallas táctiles queda siempre visible) */
.ent-dup {
  position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; border: 1px solid rgba(128, 128, 128, .3);
  background: rgb(var(--v-theme-surface)); color: inherit; cursor: pointer; opacity: 0; transition: opacity .12s;
}
.ent-card:hover .ent-dup, .ent-dup:focus-visible { opacity: .9; }
.ent-dup:hover { opacity: 1; background: rgba(var(--v-theme-primary), .12); }
@media (hover: none) { .ent-dup { opacity: .7; } }
.ent-card .ent-titulo { padding-right: 26px; }
.ent-card[draggable="true"] { cursor: grab; }
.ent-card-arrastrando { opacity: .35; }
.ent-titulo { font-weight: 600; font-size: 13px; }
.ent-cliente { font-size: 11.5px; opacity: .6; margin-top: 2px; }
.ent-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.ent-pie {
  display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
  padding-top: 7px; border-top: 1px dashed rgba(128, 128, 128, .25); font-size: 11px; opacity: .7;
}
.ent-cant { font-weight: 600; }
.ent-owner {
  background: rgba(128, 128, 128, .2); border-radius: 50%; width: 21px; height: 21px;
  display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700;
  flex: 0 0 auto;
}
.ent-links { display: flex; gap: 9px; margin-top: 6px; opacity: .7; }
.ent-links a { color: inherit; text-decoration: none; }
.ent-links a:hover { opacity: 1; }
.texto-alerta { color: #e2564a; font-weight: 600; opacity: 1; }

.area-chip {
  display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10.5px;
  background: rgba(128, 128, 128, .16); white-space: nowrap;
}
.etapa-chip {
  display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 600; white-space: nowrap;
}

/* ── Por responsable ── */
.resp-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; align-items: start;
}
.resp-card {
  background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 12px; padding: 12px;
}
.resp-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.resp-nombre { font-weight: 600; font-size: 13px; }
.resp-sub { font-size: 11px; opacity: .6; }
.resp-body { display: flex; flex-direction: column; gap: 7px; }
.resp-item {
  border: 1px solid rgba(128, 128, 128, .18); border-radius: 8px; padding: 8px 10px; cursor: pointer;
}
.resp-item:hover { background: rgba(128, 128, 128, .08); }
.resp-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.resp-item-titulo { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resp-item-pie { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; opacity: .65; margin-top: 4px; }

/* ── Cumplimiento por marca y tipo ── */
.cumpl-head { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.cumpl-titulo { font-size: 15px; font-weight: 700; margin: 0; }
.cumpl-sub { font-size: 12px; opacity: .65; margin: 4px 0 0; max-width: 620px; }
.cumpl-acciones { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }

.marca-card {
  background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 12px;
}
.marca-head {
  display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;
  padding-bottom: 9px; border-bottom: 1px solid rgba(128, 128, 128, .2);
}
.marca-nombre { font-weight: 700; font-size: 13.5px; }
.marca-total { display: flex; align-items: center; gap: 10px; flex: 1 1 260px; justify-content: flex-end; }
.marca-total .barra { max-width: 220px; }
.marca-frac { font-size: 12px; opacity: .7; min-width: 62px; text-align: right; }
.marca-pct { font-size: 13px; font-weight: 700; min-width: 54px; text-align: right; }
.marca-vacia { font-size: 12px; opacity: .5; padding: 10px 0 2px; }

.tipo-fila {
  display: grid; grid-template-columns: 130px minmax(80px, 1fr) 62px 54px minmax(0, 1.1fr);
  align-items: center; gap: 10px; padding: 7px 0;
  border-bottom: 1px dashed rgba(128, 128, 128, .15);
}
.tipo-fila:last-child { border-bottom: none; }
.tipo-frac { font-size: 12px; opacity: .75; text-align: right; }
.tipo-pct { font-size: 12.5px; font-weight: 600; text-align: right; }
.tipo-estados { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; opacity: .6; }
.aviso-suelto { color: #f2a63b; opacity: 1; }

.barra {
  flex: 1; height: 7px; background: rgba(128, 128, 128, .18);
  border-radius: 999px; overflow: hidden; min-width: 80px;
}
.barra-fill { height: 100%; }

/* ── Tabla KPI (formato del Excel de KPIs de Piola) ── */
.kpi-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 4px 0 12px; }
.kpi-leyenda { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 11.5px; opacity: .8; margin-left: auto; }
.kpi-leyenda-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.kpi-punto { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.kpi-wrap { overflow-x: auto; border: 1px solid rgba(128, 128, 128, .25); border-radius: 10px; }
/* Mismos colores que la hoja del Excel: cliente en verde, encabezados amarillo y azul. Los fondos son fijos
   (con su propio color de texto) para que se vean igual en tema claro y oscuro. */
.kpi-tabla { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 640px; }
.kpi-tabla th, .kpi-tabla td { border: 1px solid rgba(128, 128, 128, .45); padding: 7px 8px; text-align: center; }
.kpi-tabla th { font-weight: 700; font-size: 11.5px; color: #111; }
.kpi-tabla th.kpi-tipo { white-space: nowrap; }
.kpi-tabla th.kpi-banner { background: #111; color: #fff; font-size: 13px; letter-spacing: .4px; padding: 10px; }
.kpi-tabla th.kpi-cli, .kpi-tabla th.kpi-cum { background: #fff200; }
.kpi-tabla th.kpi-tipo { background: #3a75c4; color: #fff; text-transform: uppercase; }
.kpi-tabla td.kpi-cliente { background: #3cb54a; color: #111; font-weight: 700; text-align: left; min-width: 150px; }
.kpi-cliente-in { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.kpi-proceso { display: block; font-size: 10.5px; font-weight: 400; opacity: .7; margin-top: 1px; }
.kpi-num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.kpi-cero { opacity: .4; }
.kpi-pct { font-weight: 700; }
.kpi-tabla tfoot td { background: #fff200; color: #111; font-weight: 700; font-size: 13px; }
.kpi-tabla tfoot td.kpi-tot-etq { text-align: right; letter-spacing: .5px; }
.kpi-pie { font-size: 11.5px; opacity: .6; margin: 10px 2px 0; }

/* ── Compromisos ── */
.comp-linea {
  display: grid; grid-template-columns: 140px 110px 1fr; gap: 10px;
  align-items: center; padding: 6px 0;
}
.comp-cabecera { font-size: 11px; font-weight: 600; opacity: .55; text-transform: uppercase; letter-spacing: .3px; }
.comp-total { margin-top: 12px; font-size: 12.5px; text-align: right; }

.color-campo { display: flex; align-items: center; gap: 8px; }
.color-campo :deep(.v-input) { flex: 1; }
.color-muestra {
  width: 26px; height: 26px; border-radius: 6px; flex: 0 0 auto;
  border: 1px solid rgba(128, 128, 128, .4);
}
.link-abrir { color: inherit; opacity: .7; display: inline-flex; }
.link-abrir:hover { opacity: 1; }

/* ── Formularios ── */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }
.serv-nuevo { display: grid; grid-template-columns: 2fr 1.4fr 1fr auto; gap: 10px; margin-bottom: 16px; }

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
  .serv-nuevo { grid-template-columns: 1fr; }
  .comp-linea { grid-template-columns: 1fr 1fr; }
  .comp-cabecera { display: none; }
  .tipo-fila { grid-template-columns: 1fr 1fr; }
}
</style>
