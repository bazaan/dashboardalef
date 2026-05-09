<template>
  <div class="facturacion-pse">

    <!-- ── ENCABEZADO ── -->
    <header class="top-header">
      <h1>Facturación Electrónica</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <v-chip
          v-if="empresaActiva"
          color="success"
          size="small"
          prepend-icon="mdi-check-circle">
          Conectado a SUNAT vía PSE.PE
        </v-chip>
        <v-chip
          v-else
          color="warning"
          size="small"
          prepend-icon="mdi-clock-outline">
          Activo próximamente
        </v-chip>
        <button class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-plus" size="16" />
          <span>Nuevo Comprobante</span>
        </button>
      </div>
    </header>

    <!-- ════════════════════════════════════════════
         DIALOG: "ACTIVO PRÓXIMAMENTE"
         (empresas que aún no están dadas de alta en PSE.PE)
    ════════════════════════════════════════════ -->
    <v-dialog v-model="dialogProximamente" max-width="460px">
      <v-card>
        <v-card-title class="pa-4" style="border-bottom:1px solid rgba(0,0,0,.1);">
          <v-icon icon="mdi-clock-outline" color="warning" class="me-2" />
          Activo próximamente
        </v-card-title>
        <v-card-text class="pa-5">
          <p style="margin:0 0 12px;">
            La facturación electrónica para esta empresa aún no está disponible.
          </p>
          <p style="margin:0; color:#6b7280; font-size:0.92rem;">
            Estamos terminando de registrar la cuenta en
            <strong>PSE.PE / SUNAT</strong>. Apenas la activemos, podrás emitir
            facturas, boletas y notas desde este mismo botón sin tener que
            cambiar nada.
          </p>
        </v-card-text>
        <v-card-actions class="pa-4" style="border-top:1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn color="primary" variant="elevated" @click="dialogProximamente = false">
            Entendido
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <div class="content-area">

      <!-- ── BOLETAS PENDIENTES (sin emitir a SUNAT) ── -->
      <div v-if="pendientes.length > 0" class="table-section" style="margin-bottom: 24px;">
        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar" style="background: linear-gradient(135deg, #f59e0b22, #f59e0b11);">
            <span class="table-title">
              <v-icon icon="mdi-clock-outline" color="warning" size="20" class="me-2" />
              Pendientes de Emisión
              <v-chip size="x-small" color="warning" class="ms-2">{{ pendientes.length }}</v-chip>
            </span>
            <v-spacer />
            <v-btn
              color="success"
              variant="elevated"
              size="small"
              prepend-icon="mdi-send-check"
              :loading="emitiendoTodas"
              @click="emitirTodasPendientes">
              Emitir Todas a SUNAT
            </v-btn>
          </v-card-title>

          <v-data-table
            :headers="[
              { title: 'Tipo', key: 'tipo', width: '80px' },
              { title: 'Serie-Número', key: 'serie' },
              { title: 'Cliente', key: 'cliente' },
              { title: 'Fecha', key: 'fecha', width: '110px' },
              { title: 'Total', key: 'total', align: 'end', width: '100px' },
              { title: 'Acciones', key: 'acciones', sortable: false, width: '180px' },
            ]"
            :items="pendientes"
            density="compact"
            :items-per-page="-1"
            hide-default-footer
            no-data-text="No hay comprobantes pendientes">

            <template #item.tipo="{ item }">
              <v-chip :color="colorTipo(item.tipo)" size="x-small" variant="flat">
                {{ labelTipo(item.tipo) }}
              </v-chip>
            </template>

            <template #item.serie="{ item }">
              {{ item.serie }}-{{ item.numero }}
            </template>

            <template #item.total="{ item }">
              S/ {{ Number(item.total).toFixed(2) }}
            </template>

            <template #item.acciones="{ item }">
              <div style="display:flex; gap:6px; align-items:center;">
                <v-btn
                  color="success"
                  variant="tonal"
                  size="x-small"
                  prepend-icon="mdi-send"
                  :loading="emitiendoPendiente === item.id"
                  @click="emitirPendiente(item)">
                  Emitir
                </v-btn>
                <v-btn
                  color="error"
                  variant="tonal"
                  size="x-small"
                  icon="mdi-delete"
                  @click="eliminarPendiente(item)"
                />
              </div>
              <div v-if="item.error" style="color: #ef4444; font-size: 0.75rem; margin-top: 2px;">
                {{ item.error }}
              </div>
            </template>
          </v-data-table>
        </v-card>
      </div>

      <!-- ── LISTA DE COMPROBANTES EMITIDOS ── -->
      <div class="table-section">
        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">
              Comprobantes Emitidos
              <v-chip v-if="comprobantes.length > 0" size="x-small" color="primary" class="ms-2">
                {{ comprobantes.length }}
              </v-chip>
            </span>
            <v-spacer />
            <v-btn
              icon
              size="small"
              variant="text"
              :loading="loadingComprobantes"
              @click="cargarComprobantes">
              <v-icon icon="mdi-refresh" size="20" />
              <v-tooltip activator="parent">Recargar historial</v-tooltip>
            </v-btn>
            <v-text-field v-model="searchComprobantes" append-inner-icon="mdi-magnify"
              label="Buscar" single-line hide-details density="compact"
              variant="outlined" class="search-field" style="max-width:280px" />
          </v-card-title>

          <!-- Alerta de error de carga -->
          <v-alert
            v-if="errorCargaHistorial"
            type="error"
            variant="tonal"
            density="compact"
            class="ma-2"
            closable
            @click:close="errorCargaHistorial = ''">
            <div class="font-weight-bold">No se pudo cargar el historial desde Supabase</div>
            <div style="font-size:0.85rem;">{{ errorCargaHistorial }}</div>
            <div style="font-size:0.78rem; opacity:.8; margin-top:4px;">
              Los comprobantes nuevos siguen emitiéndose correctamente. Verifica
              <code>SUPABASE_SERVICE_KEY</code> y que la tabla <code>comprobantes_pse</code>
              exista en tu proyecto Supabase.
            </div>
          </v-alert>

          <!-- Filtros de estado -->
          <div class="table-tabs">
            <button
              v-for="f in filtrosEstado" :key="f.value"
              :class="['tab', { active: filtroComprobantes === f.value }]"
              @click="filtroComprobantes = f.value">
              {{ f.label }}
              <span v-if="f.count > 0" class="badge" :style="{ background: f.badgeColor }">{{ f.count }}</span>
            </button>
          </div>

          <v-data-table
            :headers="headersComprobantes"
            :items="comprobantesVista"
            :search="searchComprobantes"
            :loading="loadingComprobantes"
            class="elevation-0"
            no-data-text="No hay comprobantes emitidos aún">

            <template v-slot:item.tipo="{ item }">
              <v-chip :color="colorTipo(item.tipo)" size="small">
                {{ labelTipo(item.tipo) }}
              </v-chip>
            </template>

            <template v-slot:item.total="{ item }">
              S/ {{ Number(item.total).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
            </template>

            <template v-slot:item.sunat_ok="{ item }">
              <v-chip
                :color="item.anulado ? 'grey' : item.sunat_ok ? 'success' : 'warning'"
                size="x-small" variant="tonal">
                <v-icon :icon="item.anulado ? 'mdi-cancel' : item.sunat_ok ? 'mdi-check-circle' : 'mdi-clock-outline'"
                  size="14" class="me-1" />
                {{ item.anulado ? 'Anulado' : item.sunat_ok ? 'En SUNAT' : 'Pendiente PSE' }}
              </v-chip>
            </template>

            <template v-slot:item.acciones="{ item }">
              <div style="display:flex; gap:2px; align-items:center;">
                <v-btn icon size="x-small" variant="text" color="red"
                  :href="item.enlace_pdf" target="_blank" :disabled="!item.enlace_pdf">
                  <v-icon icon="mdi-file-pdf-box" size="18" />
                  <v-tooltip activator="parent">Ver PDF</v-tooltip>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="blue"
                  :href="item.enlace_xml" target="_blank" :disabled="!item.enlace_xml">
                  <v-icon icon="mdi-xml" size="18" />
                  <v-tooltip activator="parent">Ver XML</v-tooltip>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="success"
                  :href="item.enlace_cdr" target="_blank" :disabled="!item.enlace_cdr">
                  <v-icon icon="mdi-file-check" size="18" />
                  <v-tooltip activator="parent">CDR SUNAT</v-tooltip>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="primary"
                  :href="item.enlace" target="_blank" :disabled="!item.enlace">
                  <v-icon icon="mdi-magnify" size="18" />
                  <v-tooltip activator="parent">Consulta Pública</v-tooltip>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="purple"
                  :disabled="!item.id"
                  @click="abrirEnvioCorreoDesdeTabla(item)">
                  <v-icon icon="mdi-email-fast" size="18" />
                  <v-tooltip activator="parent">Enviar por correo</v-tooltip>
                </v-btn>
                <!-- Eliminar (solo pendientes PSE — no llegaron a SUNAT aún) -->
                <v-btn icon size="x-small" variant="text"
                  :color="!item.sunat_ok && !item.anulado ? 'orange' : 'grey'"
                  :disabled="item.sunat_ok || item.anulado"
                  @click="abrirEliminar(item)">
                  <v-icon icon="mdi-delete-outline" size="18" />
                  <v-tooltip activator="parent">
                    {{ item.anulado ? 'Ya anulado'
                      : item.sunat_ok ? 'Ya enviado a SUNAT — usa Anular'
                      : 'Eliminar de PSE (pendiente SUNAT)' }}
                  </v-tooltip>
                </v-btn>
                <!-- Anular (solo aceptadas por SUNAT) -->
                <v-btn icon size="x-small" variant="text"
                  :color="item.anulado ? 'grey' : 'error'"
                  :disabled="item.anulado || item.tipo !== 2 || !item.sunat_ok"
                  @click="abrirAnulacion(item)">
                  <v-icon icon="mdi-cancel" size="18" />
                  <v-tooltip activator="parent">
                    {{ item.anulado ? 'Ya anulado'
                      : item.tipo !== 2 ? 'Solo boletas (usa Nota de Crédito para facturas)'
                      : !item.sunat_ok ? 'Solo se pueden anular boletas aceptadas por SUNAT'
                      : 'Anular boleta (aceptada SUNAT)' }}
                  </v-tooltip>
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>

    <!-- ════════════════════════════════════════════
         DIALOG: ENVÍO RÁPIDO POR CORREO (desde la tabla)
    ════════════════════════════════════════════ -->
    <v-dialog v-model="dialogEnvioRapido" max-width="520px">
      <v-card>
        <v-card-title class="pa-4" style="border-bottom:1px solid rgba(0,0,0,.1);">
          <v-icon icon="mdi-email-fast" color="purple" class="me-2" />
          Enviar comprobante por correo
        </v-card-title>
        <v-card-text class="pa-4">
          <div v-if="envioRapidoTarget" style="background:#f9fafb; padding:10px 14px; border-radius:8px; margin-bottom:14px;">
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase;">
              {{ labelTipo(envioRapidoTarget.tipo) }}
            </div>
            <div style="font-size:1.1rem; font-weight:700;">
              {{ envioRapidoTarget.serie }}-{{ String(envioRapidoTarget.numero).padStart(8,'0') }}
            </div>
            <div style="font-size:13px; color:#4b5563;">{{ envioRapidoTarget.cliente }}</div>
          </div>

          <v-text-field
            v-model="emailEnvioRapido"
            label="Destinatario(s) — separa con comas"
            placeholder="cliente@empresa.com, cliente2@empresa.com"
            prepend-inner-icon="mdi-email"
            variant="outlined"
            density="compact" />

          <v-textarea
            v-model="mensajeExtraRapido"
            label="Mensaje adicional (opcional)"
            variant="outlined"
            density="compact"
            rows="2" />

          <v-alert v-if="resultadoEmailRapido" :type="resultadoEmailRapido.ok ? 'success' : 'error'"
            density="compact" variant="tonal" class="mt-2">
            <div v-if="resultadoEmailRapido.ok">
              ✉️ Enviado a: {{ resultadoEmailRapido.destinatarios?.join(', ') }}
            </div>
            <div v-else>{{ resultadoEmailRapido.mensaje }}</div>
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4" style="border-top:1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn variant="text" @click="dialogEnvioRapido = false">Cancelar</v-btn>
          <v-btn color="purple" variant="elevated"
            :loading="enviandoEmailRapido"
            :disabled="!emailEnvioRapido.trim()"
            prepend-icon="mdi-send"
            @click="enviarCorreoRapido">
            Enviar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ════════════════════════════════════════════
         DIALOG: ELIMINAR COMPROBANTE (pendiente PSE)
    ════════════════════════════════════════════ -->
    <v-dialog v-model="dialogEliminar" max-width="460px" persistent>
      <v-card>
        <v-card-title class="pa-4" style="border-bottom:1px solid rgba(0,0,0,.1);">
          <v-icon icon="mdi-delete-outline" color="orange" class="me-2" />
          Eliminar comprobante
        </v-card-title>
        <v-card-text class="pa-5">
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            Este comprobante <strong>aún no llegó a SUNAT</strong>. Eliminarlo lo borrará
            de NubeFact/PSE.PE y de la base de datos — no quedará rastro tributario.
          </v-alert>

          <div v-if="eliminarTarget" style="background:#fff7ed; border:1px solid #fed7aa; padding:10px 14px; border-radius:8px;">
            <div style="font-size:12px; color:#9ca3af; text-transform:uppercase;">Comprobante a eliminar</div>
            <div style="font-size:1.1rem; font-weight:700; color:#ea580c;">
              {{ eliminarTarget.serie }}-{{ String(eliminarTarget.numero).padStart(8,'0') }}
            </div>
            <div style="font-size:13px; color:#6b7280;">{{ eliminarTarget.cliente }} · S/ {{ Number(eliminarTarget.total).toFixed(2) }}</div>
          </div>

          <v-alert v-if="errorEliminar" type="error" variant="tonal" density="compact" class="mt-3">
            {{ errorEliminar }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4" style="border-top:1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn variant="text" :disabled="eliminando" @click="dialogEliminar = false">Cancelar</v-btn>
          <v-btn color="orange" variant="elevated"
            :loading="eliminando"
            prepend-icon="mdi-delete-outline"
            @click="confirmarEliminar">
            Eliminar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ════════════════════════════════════════════
         DIALOG: ANULAR COMPROBANTE
    ════════════════════════════════════════════ -->
    <v-dialog v-model="dialogAnulacion" max-width="480px" persistent>
      <v-card>
        <v-card-title class="pa-4" style="border-bottom:1px solid rgba(0,0,0,.1);">
          <v-icon icon="mdi-cancel" color="error" class="me-2" />
          Anular comprobante
        </v-card-title>
        <v-card-text class="pa-5">
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            Esta acción es <strong>irreversible</strong>. SUNAT solo permite anular
            boletas dentro de los primeros 7 días desde la emisión.
          </v-alert>

          <div v-if="anulacionTarget" style="background:#fef2f2; border:1px solid #fecaca; padding:10px 14px; border-radius:8px; margin-bottom:16px;">
            <div style="font-size:12px; color:#9ca3af; text-transform:uppercase;">Boleta a anular</div>
            <div style="font-size:1.1rem; font-weight:700; color:#dc2626;">
              {{ anulacionTarget.serie }}-{{ String(anulacionTarget.numero).padStart(8,'0') }}
            </div>
            <div style="font-size:13px; color:#6b7280;">{{ anulacionTarget.cliente }} · S/ {{ Number(anulacionTarget.total).toFixed(2) }}</div>
          </div>

          <v-text-field
            v-model="motivoAnulacion"
            label="Motivo de anulación *"
            placeholder="Ej: Error en el monto, duplicado, solicitud del cliente..."
            prepend-inner-icon="mdi-text"
            variant="outlined"
            density="compact"
            :rules="[v => !!v?.trim() || 'El motivo es obligatorio']" />

          <v-alert v-if="errorAnulacion" type="error" variant="tonal" density="compact" class="mt-2">
            {{ errorAnulacion }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4" style="border-top:1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn variant="text" :disabled="anulando" @click="dialogAnulacion = false">Cancelar</v-btn>
          <v-btn color="error" variant="elevated"
            :loading="anulando"
            :disabled="!motivoAnulacion?.trim()"
            prepend-icon="mdi-cancel"
            @click="confirmarAnulacion">
            Anular boleta
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ════════════════════════════════════════════
         DIALOG: NUEVO COMPROBANTE
    ════════════════════════════════════════════ -->
    <v-dialog v-model="showDialog" max-width="1100px" persistent scrollable>
      <v-card>
        <v-card-title class="pa-4" style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(0,0,0,.1);">
          <div style="display:flex; align-items:center; gap:10px;">
            <v-icon icon="mdi-file-document-edit" color="primary" />
            <span>Nuevo Comprobante Electrónico</span>
            <v-chip size="x-small" color="success" variant="tonal">PRODUCCIÓN</v-chip>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showDialog = false" />
        </v-card-title>

        <v-card-text class="pa-5">
          <v-form ref="formRef">

            <!-- ═══════════ GENERAL ═══════════ -->
            <div class="pse-section-title">
              <v-icon icon="mdi-file-document" size="16" />
              General
            </div>
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.tipo_de_comprobante"
                  :items="tiposComprobante"
                  item-title="label"
                  item-value="value"
                  label="Tipo de Comprobante *"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || 'Requerido']"
                  @update:model-value="onTipoCambia" />
              </v-col>
              <v-col cols="12" sm="2">
                <v-text-field
                  v-model="form.serie"
                  label="Serie *"
                  variant="outlined"
                  density="compact"
                  maxlength="4"
                  :rules="[v => !!v || 'Requerido', v => (v && v.length === 4) || '4 caracteres']"
                  hint="F001 (factura) · B001 (boleta) · FC01 / FD01 (notas)"
                  persistent-hint />
              </v-col>
              <v-col cols="12" sm="2">
                <v-text-field
                  v-model.number="form.numero"
                  label="Número *"
                  type="number"
                  min="1"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
              <v-col cols="12" sm="2">
                <v-text-field
                  v-model="form.fecha_de_emision"
                  label="Fecha Emisión *"
                  type="date"
                  variant="outlined"
                  density="compact"
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
              <v-col cols="12" sm="2">
                <v-text-field
                  v-model="form.fecha_de_vencimiento"
                  label="Fecha Vencimiento"
                  type="date"
                  variant="outlined"
                  density="compact" />
              </v-col>
            </v-row>

            <v-row dense>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="form.moneda"
                  :items="monedas"
                  item-title="label"
                  item-value="value"
                  label="Moneda *"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="3" v-if="form.moneda !== 1">
                <v-text-field
                  v-model.number="form.tipo_de_cambio"
                  label="Tipo de Cambio *"
                  type="number"
                  step="0.001"
                  variant="outlined"
                  density="compact"
                  :rules="form.moneda !== 1 ? [v => !!v || 'Requerido si no es soles'] : []" />
              </v-col>
              <v-col cols="12" :sm="form.moneda !== 1 ? 3 : 6">
                <v-select
                  v-model="form.sunat_transaction"
                  :items="tiposOperacion"
                  item-title="label"
                  item-value="value"
                  label="Tipo de Operación *"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="form.formato_de_pdf"
                  :items="formatosPdf"
                  item-title="label"
                  item-value="value"
                  label="Formato PDF"
                  variant="outlined"
                  density="compact" />
              </v-col>
            </v-row>

            <!-- ═══════════ DATOS DEL CLIENTE ═══════════ -->
            <div class="pse-section-title mt-4">
              <v-icon icon="mdi-account" size="16" />
              Datos del Cliente
            </div>
            <v-row dense>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="form.cliente_tipo_de_documento"
                  :items="tiposDocCliente"
                  item-title="label"
                  item-value="value"
                  label="Tipo Documento *"
                  variant="outlined"
                  density="compact"
                  :rules="[v => v !== undefined && v !== null || 'Requerido']" />
              </v-col>
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="form.cliente_numero_de_documento"
                  :label="labelNumeroDoc"
                  variant="outlined"
                  density="compact"
                  :rules="form.tipo_de_comprobante === 1 ? [v => !!v || 'Requerido'] : []" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.cliente_denominacion"
                  label="Razón Social / Nombre *"
                  variant="outlined"
                  density="compact"
                  maxlength="100"
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="12">
                <v-text-field
                  v-model="form.cliente_direccion"
                  :label="form.tipo_de_comprobante === 1 ? 'Dirección *' : 'Dirección'"
                  variant="outlined"
                  density="compact"
                  maxlength="100"
                  :rules="form.tipo_de_comprobante === 1 ? [v => !!v || 'Obligatorio en factura'] : []" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.cliente_email"
                  label="Email Cliente"
                  type="email"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.cliente_email_1"
                  label="Email Alternativo 1"
                  type="email"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.cliente_email_2"
                  label="Email Alternativo 2"
                  type="email"
                  variant="outlined"
                  density="compact" />
              </v-col>
            </v-row>

            <!-- ═══════════ DOCUMENTO QUE SE MODIFICA (solo notas) ═══════════ -->
            <template v-if="esNota">
              <div class="pse-section-title mt-4">
                <v-icon icon="mdi-file-link" size="16" />
                Documento que se Modifica
              </div>
              <v-row dense>
                <v-col cols="12" sm="3">
                  <v-select
                    v-model="form.documento_que_se_modifica_tipo"
                    :items="tiposDocModificado"
                    item-title="label"
                    item-value="value"
                    label="Tipo Documento Modificado *"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model="form.documento_que_se_modifica_serie"
                    label="Serie *"
                    variant="outlined"
                    density="compact"
                    maxlength="4"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model.number="form.documento_que_se_modifica_numero"
                    label="Número *"
                    type="number"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
                <v-col cols="12" sm="3" v-if="form.tipo_de_comprobante === 3">
                  <v-select
                    v-model="form.tipo_de_nota_de_credito"
                    :items="tiposNotaCredito"
                    item-title="label"
                    item-value="value"
                    label="Motivo Nota Crédito *"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
                <v-col cols="12" sm="3" v-if="form.tipo_de_comprobante === 4">
                  <v-select
                    v-model="form.tipo_de_nota_de_debito"
                    :items="tiposNotaDebito"
                    item-title="label"
                    item-value="value"
                    label="Motivo Nota Débito *"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
              </v-row>
            </template>

            <!-- ═══════════ ITEMS / PRODUCTOS ═══════════ -->
            <div class="pse-section-title mt-4" style="display:flex; align-items:center; justify-content:space-between;">
              <span>
                <v-icon icon="mdi-package-variant" size="16" />
                Productos / Servicios
              </span>
              <div style="display:flex; gap:8px; align-items:center;">
                <v-menu v-if="hasCatalog" v-model="showCatalogMenu" :close-on-content-click="false">
                  <template #activator="{ props: menuProps }">
                    <v-btn v-bind="menuProps" size="small" color="primary" variant="tonal" prepend-icon="mdi-view-list"
                      :loading="loadingCatalog" @click="!catalogItems.length && !loadingCatalog ? cargarCatalogo() : undefined">
                      Catálogo
                    </v-btn>
                  </template>
                  <v-list max-height="200" style="overflow-y:auto; min-width:280px;">
                    <v-list-item v-if="!catalogItems.length && !loadingCatalog" disabled>
                      <v-list-item-title style="opacity:0.5; font-size:0.8rem;">Sin items en catálogo</v-list-item-title>
                    </v-list-item>
                    <v-list-item
                      v-for="prod in catalogItems"
                      :key="prod.id"
                      :title="prod.nombre"
                      :subtitle="`S/ ${prod.precio.toFixed(2)}`"
                      density="compact"
                      style="cursor:pointer;"
                      @click="agregarItemDesdeCatalogo(prod)"
                    />
                  </v-list>
                </v-menu>
                <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="agregarItem">
                  Agregar Línea
                </v-btn>
              </div>
            </div>

            <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
              <v-row dense align="center">
                <v-col cols="12" sm="1">
                  <v-select
                    v-model="item.unidad_de_medida"
                    :items="unidadesMedida"
                    item-title="label"
                    item-value="value"
                    label="U.M."
                    variant="outlined"
                    density="compact" />
                </v-col>
                <v-col cols="12" sm="1">
                  <v-text-field
                    v-model="item.codigo"
                    label="Código"
                    variant="outlined"
                    density="compact" />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model="item.descripcion"
                    label="Descripción *"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || 'Requerido']" />
                </v-col>
                <v-col cols="12" sm="1">
                  <v-text-field
                    v-model.number="item.cantidad"
                    label="Cant. *"
                    type="number"
                    step="0.001"
                    min="0.001"
                    variant="outlined"
                    density="compact"
                    @input="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="2">
                  <v-text-field
                    v-model.number="item.valor_unitario"
                    label="V.Unit (sin IGV) *"
                    type="number"
                    step="0.01"
                    variant="outlined"
                    density="compact"
                    @input="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="2">
                  <v-select
                    v-model="item.tipo_de_igv"
                    :items="tiposIgv"
                    item-title="label"
                    item-value="value"
                    label="Tipo IGV"
                    variant="outlined"
                    density="compact"
                    @update:model-value="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="1">
                  <div class="item-total-display">
                    <span class="item-total-label">Total</span>
                    <span class="item-total-value">{{ item.total.toFixed(2) }}</span>
                  </div>
                </v-col>
                <v-col cols="12" sm="1" class="text-center">
                  <v-btn icon size="small" variant="text" color="error" @click="eliminarItem(idx)" :disabled="form.items.length === 1">
                    <v-icon icon="mdi-delete" size="18" />
                  </v-btn>
                </v-col>
              </v-row>
              <!-- Sub-fila opcional: código SUNAT y descuento por línea -->
              <v-row dense class="mt-1">
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model="item.codigo_producto_sunat"
                    label="Código SUNAT (opcional)"
                    variant="outlined"
                    density="compact"
                    hide-details />
                </v-col>
                <v-col cols="12" sm="2">
                  <v-text-field
                    v-model.number="item.descuento"
                    label="Descuento línea"
                    type="number"
                    step="0.01"
                    variant="outlined"
                    density="compact"
                    hide-details
                    @input="calcularItem(idx)" />
                </v-col>
              </v-row>
            </div>

            <!-- ═══════════ TOTALES ═══════════ -->
            <div class="totales-box mt-4">
              <div class="total-row" v-if="totales.gravada > 0">
                <span>Subtotal Gravado</span>
                <span>{{ simboloMoneda }} {{ totales.gravada.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.exonerada > 0">
                <span>Exonerado</span>
                <span>{{ simboloMoneda }} {{ totales.exonerada.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.inafecta > 0">
                <span>Inafecto</span>
                <span>{{ simboloMoneda }} {{ totales.inafecta.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.gratuita > 0">
                <span>Gratuita</span>
                <span>{{ simboloMoneda }} {{ totales.gratuita.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.descuento > 0">
                <span>Descuento</span>
                <span>- {{ simboloMoneda }} {{ totales.descuento.toFixed(2) }}</span>
              </div>
              <div class="total-row">
                <span>IGV (18%)</span>
                <span>{{ simboloMoneda }} {{ totales.igv.toFixed(2) }}</span>
              </div>
              <div class="total-row total-final">
                <span>TOTAL</span>
                <span>{{ simboloMoneda }} {{ totales.total.toFixed(2) }}</span>
              </div>
            </div>

            <!-- ═══════════ INFORMACIÓN ADICIONAL ═══════════ -->
            <div class="pse-section-title mt-4">
              <v-icon icon="mdi-text" size="16" />
              Información Adicional
            </div>
            <v-row dense>
              <v-col cols="12">
                <v-textarea
                  v-model="form.observaciones"
                  label="Observaciones"
                  variant="outlined"
                  density="compact"
                  rows="2"
                  maxlength="1000"
                  counter
                  hint="Puedes usar <br> para saltos de línea en el PDF" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.orden_compra_servicio"
                  label="Orden de Compra / Servicio"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.condiciones_de_pago"
                  label="Condiciones de Pago"
                  variant="outlined"
                  density="compact"
                  hint="Ej: CRÉDITO 15 DÍAS" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.medio_de_pago"
                  label="Medio de Pago"
                  variant="outlined"
                  density="compact"
                  hint="Ej: TARJETA VISA OP: 23232" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.placa_vehiculo"
                  label="Placa Vehículo"
                  variant="outlined"
                  density="compact"
                  maxlength="8" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.codigo_unico"
                  label="Código Único Interno"
                  variant="outlined"
                  density="compact"
                  maxlength="20" />
              </v-col>
            </v-row>

            <!-- ═══════════ OPCIONES AVANZADAS (expansibles) ═══════════ -->
            <v-expansion-panels class="mt-4" variant="accordion" multiple>

              <!-- ── DETRACCIÓN ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-bank-transfer" size="18" class="me-2" />
                  Detracción
                  <v-chip v-if="form.detraccion" size="x-small" color="primary" class="ms-2">Activa</v-chip>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-switch
                    v-model="form.detraccion"
                    label="Activar detracción"
                    color="primary"
                    density="compact"
                    hide-details
                    class="mb-2" />
                  <v-row dense v-if="form.detraccion">
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="form.detraccion_tipo"
                        :items="tiposDetraccion"
                        item-title="label"
                        item-value="value"
                        label="Tipo Detracción *"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="3">
                      <v-text-field
                        v-model.number="form.detraccion_porcentaje"
                        label="% Detracción"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="3">
                      <v-text-field
                        v-model.number="form.detraccion_total"
                        label="Total Detracción"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="form.medio_de_pago_detraccion"
                        :items="mediosPagoDetraccion"
                        item-title="label"
                        item-value="value"
                        label="Medio Pago Detracción"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- ── PERCEPCIÓN ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-cash-plus" size="18" class="me-2" />
                  Percepción
                  <v-chip v-if="form.percepcion_tipo" size="x-small" color="primary" class="ms-2">Activa</v-chip>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row dense>
                    <v-col cols="12" sm="6">
                      <v-select
                        v-model="form.percepcion_tipo"
                        :items="tiposPercepcion"
                        item-title="label"
                        item-value="value"
                        label="Tipo Percepción"
                        variant="outlined"
                        density="compact"
                        clearable />
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model.number="form.percepcion_base_imponible"
                        label="Base Imponible"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model.number="form.total_percepcion"
                        label="Total Percepción"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-text-field
                        v-model.number="form.total_incluido_percepcion"
                        label="Total Incluido Percepción"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- ── RETENCIÓN ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-cash-minus" size="18" class="me-2" />
                  Retención
                  <v-chip v-if="form.retencion_tipo" size="x-small" color="primary" class="ms-2">Activa</v-chip>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row dense>
                    <v-col cols="12" sm="4">
                      <v-select
                        v-model="form.retencion_tipo"
                        :items="tiposRetencion"
                        item-title="label"
                        item-value="value"
                        label="Tipo Retención"
                        variant="outlined"
                        density="compact"
                        clearable />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-text-field
                        v-model.number="form.retencion_base_imponible"
                        label="Base Imponible"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-text-field
                        v-model.number="form.total_retencion"
                        label="Total Retención"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- ── VENTA AL CRÉDITO (cuotas) ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-credit-card-clock" size="18" class="me-2" />
                  Venta al Crédito / Cuotas
                  <v-chip v-if="form.venta_al_credito.length > 0" size="x-small" color="primary" class="ms-2">
                    {{ form.venta_al_credito.length }} cuotas
                  </v-chip>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div v-for="(c, idx) in form.venta_al_credito" :key="idx" class="mb-2">
                    <v-row dense align="center">
                      <v-col cols="12" sm="2">
                        <v-text-field
                          v-model.number="c.cuota"
                          label="Cuota N°"
                          type="number"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-text-field
                          v-model="c.fecha_de_pago"
                          label="Fecha de pago"
                          type="date"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-text-field
                          v-model.number="c.importe"
                          label="Importe *"
                          type="number"
                          step="0.01"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="2">
                        <v-btn icon size="small" variant="text" color="error" @click="eliminarCuota(idx)">
                          <v-icon icon="mdi-delete" size="18" />
                        </v-btn>
                      </v-col>
                    </v-row>
                  </div>
                  <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="agregarCuota">
                    Agregar cuota
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- ── GUÍAS RELACIONADAS ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-truck" size="18" class="me-2" />
                  Guías de Remisión Relacionadas
                  <v-chip v-if="form.guias.length > 0" size="x-small" color="primary" class="ms-2">
                    {{ form.guias.length }}
                  </v-chip>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div v-for="(g, idx) in form.guias" :key="idx" class="mb-2">
                    <v-row dense align="center">
                      <v-col cols="12" sm="5">
                        <v-select
                          v-model="g.guia_tipo"
                          :items="tiposGuia"
                          item-title="label"
                          item-value="value"
                          label="Tipo de Guía"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="5">
                        <v-text-field
                          v-model="g.guia_serie_numero"
                          label="Serie-Número (ej: T001-1)"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="2">
                        <v-btn icon size="small" variant="text" color="error" @click="eliminarGuia(idx)">
                          <v-icon icon="mdi-delete" size="18" />
                        </v-btn>
                      </v-col>
                    </v-row>
                  </div>
                  <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="agregarGuia">
                    Agregar guía
                  </v-btn>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- ── FLAGS ESPECIALES ── -->
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-flag" size="18" class="me-2" />
                  Banderas Especiales
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row dense>
                    <v-col cols="12" sm="4">
                      <v-switch
                        v-model="form.generado_por_contingencia"
                        label="Generado por contingencia"
                        color="warning"
                        density="compact"
                        hide-details />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-switch
                        v-model="form.bienes_region_selva"
                        label="Bienes región selva"
                        color="success"
                        density="compact"
                        hide-details />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-switch
                        v-model="form.servicios_region_selva"
                        label="Servicios región selva"
                        color="success"
                        density="compact"
                        hide-details />
                    </v-col>
                  </v-row>
                  <v-row dense class="mt-2">
                    <v-col cols="12" sm="4">
                      <v-text-field
                        v-model.number="form.total_impuestos_bolsas"
                        label="Impuesto Bolsas Plásticas"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-text-field
                        v-model.number="form.descuento_global"
                        label="Descuento Global"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <v-text-field
                        v-model.number="form.total_anticipo"
                        label="Total Anticipo"
                        type="number"
                        step="0.01"
                        variant="outlined"
                        density="compact" />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

            </v-expansion-panels>

            <!-- ═══════════ RESPUESTA SUNAT — ÉXITO ═══════════ -->
            <div v-if="respuestaSunat && respuestaSunat.aceptada" class="success-box mt-4">
              <div class="success-header">
                <v-icon icon="mdi-check-circle" color="success" size="28" />
                <div>
                  <div class="success-title">Aceptada por SUNAT</div>
                  <div class="success-sub">
                    {{ respuestaSunat.descripcion }}
                  </div>
                </div>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" size="small" @click="respuestaSunat = null" />
              </div>

              <div class="success-body">
                <div class="success-doc">
                  <strong style="font-size:1.1rem;">
                    {{ respuestaSunat.serie }}-{{ String(respuestaSunat.numero).padStart(8,'0') }}
                  </strong>
                  <span v-if="respuestaSunat.codigo_hash" style="font-size:11px; color:#6b7280; margin-left:8px;">
                    hash: {{ respuestaSunat.codigo_hash.substring(0, 10) }}…
                  </span>
                </div>

                <!-- ── Botones de enlaces ── -->
                <div class="success-buttons">
                  <v-btn v-if="respuestaSunat.enlace_pdf"
                    size="small" color="red" variant="elevated"
                    prepend-icon="mdi-file-pdf-box"
                    :href="respuestaSunat.enlace_pdf" target="_blank">
                    PDF
                  </v-btn>
                  <v-btn v-if="respuestaSunat.enlace_xml"
                    size="small" color="blue" variant="elevated"
                    prepend-icon="mdi-xml"
                    :href="respuestaSunat.enlace_xml" target="_blank">
                    XML
                  </v-btn>
                  <v-btn v-if="respuestaSunat.enlace_cdr"
                    size="small" color="success" variant="elevated"
                    prepend-icon="mdi-file-check"
                    :href="respuestaSunat.enlace_cdr" target="_blank">
                    CDR SUNAT
                  </v-btn>
                  <v-btn v-if="respuestaSunat.enlace"
                    size="small" color="primary" variant="elevated"
                    prepend-icon="mdi-magnify"
                    :href="respuestaSunat.enlace" target="_blank">
                    Consulta Pública
                  </v-btn>
                  <v-btn size="small" color="purple" variant="elevated"
                    prepend-icon="mdi-email-fast"
                    @click="mostrarEnvioCorreo = !mostrarEnvioCorreo">
                    Enviar por Correo
                  </v-btn>
                </div>

                <!-- ── Formulario de envío por correo ── -->
                <v-expand-transition>
                  <div v-if="mostrarEnvioCorreo" class="email-form mt-3">
                    <div class="email-form-title">
                      <v-icon icon="mdi-email-outline" size="16" />
                      Enviar comprobante por correo
                    </div>
                    <v-row dense>
                      <v-col cols="12" sm="8">
                        <v-text-field
                          v-model="emailEnvio"
                          label="Destinatario(s) — separa con comas"
                          placeholder="cliente@empresa.com, cliente2@empresa.com"
                          prepend-inner-icon="mdi-email"
                          variant="outlined"
                          density="compact"
                          hide-details />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-btn
                          block
                          color="purple"
                          variant="elevated"
                          :loading="enviandoEmail"
                          :disabled="!emailEnvio.trim()"
                          prepend-icon="mdi-send"
                          @click="enviarCorreoComprobante">
                          Enviar
                        </v-btn>
                      </v-col>
                    </v-row>
                    <v-textarea
                      v-model="mensajeEmailExtra"
                      label="Mensaje adicional (opcional)"
                      variant="outlined"
                      density="compact"
                      rows="2"
                      hide-details
                      class="mt-2" />

                    <!-- Resultado del envío -->
                    <v-alert v-if="resultadoEmail" :type="resultadoEmail.ok ? 'success' : 'error'"
                      density="compact" variant="tonal" class="mt-2">
                      <div v-if="resultadoEmail.ok">
                        ✉️ Enviado a: {{ resultadoEmail.destinatarios?.join(', ') }}
                      </div>
                      <div v-else>{{ resultadoEmail.mensaje }}</div>
                    </v-alert>
                  </div>
                </v-expand-transition>
              </div>
            </div>

            <!-- ═══════════ RESPUESTA SUNAT — ERROR ═══════════ -->
            <div v-if="respuestaSunat && !respuestaSunat.aceptada" class="error-box mt-4">
              <div class="error-header">
                <v-icon icon="mdi-alert-circle" color="error" size="28" />
                <div>
                  <div class="error-title">Rechazada por SUNAT</div>
                  <div class="error-sub">{{ respuestaSunat.descripcion }}</div>
                </div>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" size="small" @click="respuestaSunat = null" />
              </div>

              <!-- Detalles adicionales del error -->
              <div v-if="respuestaSunat.codigo || respuestaSunat.sunat_responsecode" class="error-body">
                <div v-if="respuestaSunat.codigo">
                  <strong>Código NubeFact:</strong> {{ respuestaSunat.codigo }}
                </div>
                <div v-if="respuestaSunat.sunat_responsecode">
                  <strong>Código SUNAT:</strong> {{ respuestaSunat.sunat_responsecode }}
                </div>
                <div v-if="respuestaSunat.sunat_note" class="mt-1">
                  <strong>Nota SUNAT:</strong> {{ respuestaSunat.sunat_note }}
                </div>
                <div v-if="respuestaSunat.sunat_soap_error" class="mt-1">
                  <strong>SOAP:</strong> {{ respuestaSunat.sunat_soap_error }}
                </div>
              </div>
            </div>

            <!-- ═══════════ HISTORIAL DE ERRORES ═══════════ -->
            <div v-if="erroresHistorial.length > 0" class="errors-log mt-4">
              <div class="errors-log-header">
                <v-icon icon="mdi-history" size="16" />
                <span>Historial de errores ({{ erroresHistorial.length }})</span>
                <v-spacer />
                <v-btn size="x-small" variant="text" color="grey" @click="erroresHistorial = []">
                  Limpiar
                </v-btn>
              </div>
              <div class="errors-log-list">
                <div v-for="(e, i) in erroresHistorial" :key="i" class="error-log-item">
                  <div class="error-log-time">{{ e.hora }}</div>
                  <div class="error-log-text">
                    <strong>{{ e.serie }}-{{ e.numero }}</strong> — {{ e.mensaje }}
                  </div>
                </div>
              </div>
            </div>

          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4" style="border-top:1px solid rgba(0,0,0,.1);">
          <v-spacer />
          <v-btn color="grey" variant="text" @click="showDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="elevated" :loading="enviando" @click="enviarFactura"
            prepend-icon="mdi-send">
            Enviar a SUNAT
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  companyId: string   // 'healup' | 'estasconsuerte'
}>()

/* ═════════════════════════════════════════════════════════════
   CATÁLOGOS — Todas las listas están definidas según la doc
   oficial "NUBEFACT DOC API JSON V1" para garantizar que los
   JSON generados sean aceptados sin errores.
   ═════════════════════════════════════════════════════════════ */

// Tipo de comprobante
const tiposComprobante = [
  { value: 1, label: '01 - Factura' },
  { value: 2, label: '03 - Boleta de Venta' },
  { value: 3, label: '07 - Nota de Crédito' },
  { value: 4, label: '08 - Nota de Débito' }
]

// Tipo documento cliente
const tiposDocCliente = [
  { value: '-', label: '- Varios (Consumidor Final)' },
  { value: 1,   label: '1 - DNI' },
  { value: 6,   label: '6 - RUC' },
  { value: 4,   label: '4 - Carnet de Extranjería' },
  { value: 7,   label: '7 - Pasaporte' },
  { value: 'A', label: 'A - Cédula Diplomática' },
  { value: 'B', label: 'B - Doc. Identidad País Residencia' },
  { value: 0,   label: '0 - No Domiciliado (Exportación)' },
  { value: 'G', label: 'G - Salvoconducto' }
]

// Moneda
const monedas = [
  { value: 1, label: 'S/ PEN - Soles',     simbolo: 'S/' },
  { value: 2, label: '$ USD - Dólares',    simbolo: '$' },
  { value: 3, label: '€ EUR - Euros',      simbolo: '€' },
  { value: 4, label: '£ GBP - Libra Esterlina', simbolo: '£' }
]

// Tipo operación (sunat_transaction)
const tiposOperacion = [
  { value: 1,  label: '1 - Venta Interna' },
  { value: 2,  label: '2 - Exportación' },
  { value: 4,  label: '4 - Venta Interna – Anticipos' },
  { value: 29, label: '29 - Venta no domiciliado (no exportación)' },
  { value: 30, label: '30 - Sujeta a Detracción' },
  { value: 31, label: '31 - Detracción – Recursos Hidrobiológicos' },
  { value: 32, label: '32 - Detracción – Transporte Pasajeros' },
  { value: 33, label: '33 - Detracción – Transporte de Carga' },
  { value: 34, label: '34 - Sujeta a Percepción' },
  { value: 35, label: '35 - Venta Nacional a Turistas (Tax Free)' }
]

// Tipo IGV por línea
const tiposIgv = [
  { value: 1,  label: '1 - Gravado Onerosa' },
  { value: 2,  label: '2 - Gravado Retiro por premio' },
  { value: 3,  label: '3 - Gravado Retiro por donación' },
  { value: 4,  label: '4 - Gravado Retiro' },
  { value: 5,  label: '5 - Gravado Retiro por publicidad' },
  { value: 6,  label: '6 - Gravado Bonificación' },
  { value: 7,  label: '7 - Gravado Retiro a trabajadores' },
  { value: 8,  label: '8 - Exonerado Onerosa' },
  { value: 9,  label: '9 - Inafecto Onerosa' },
  { value: 10, label: '10 - Inafecto Retiro por bonificación' },
  { value: 11, label: '11 - Inafecto Retiro' },
  { value: 12, label: '12 - Inafecto Retiro muestras médicas' },
  { value: 13, label: '13 - Inafecto Retiro Convenio Colectivo' },
  { value: 14, label: '14 - Inafecto Retiro por premio' },
  { value: 15, label: '15 - Inafecto Retiro por publicidad' },
  { value: 16, label: '16 - Exportación' },
  { value: 17, label: '17 - Exonerado Transferencia Gratuita' },
  { value: 20, label: '20 - Inafecto Transferencia Gratuita' }
]

// Unidades de medida comunes (SUNAT tiene muchas más, estas son las más usadas)
const unidadesMedida = [
  { value: 'NIU', label: 'NIU - Unidad (Producto)' },
  { value: 'ZZ',  label: 'ZZ - Servicio' },
  { value: 'KGM', label: 'KGM - Kilogramo' },
  { value: 'GRM', label: 'GRM - Gramo' },
  { value: 'LTR', label: 'LTR - Litro' },
  { value: 'MTR', label: 'MTR - Metro' },
  { value: 'MTK', label: 'MTK - Metro cuadrado' },
  { value: 'MTQ', label: 'MTQ - Metro cúbico' },
  { value: 'TNE', label: 'TNE - Tonelada' },
  { value: 'BX',  label: 'BX - Caja' },
  { value: 'PK',  label: 'PK - Paquete' },
  { value: 'DZN', label: 'DZN - Docena' },
  { value: 'HUR', label: 'HUR - Hora' },
  { value: 'DAY', label: 'DAY - Día' }
]

// Formato PDF
const formatosPdf = [
  { value: 'A4',     label: 'A4' },
  { value: 'A5',     label: 'A5 (media hoja)' },
  { value: 'TICKET', label: 'Ticket' }
]

// Tipo de documento que se modifica (solo notas)
const tiposDocModificado = [
  { value: 1, label: '1 - Factura Electrónica' },
  { value: 2, label: '2 - Boleta de Venta Electrónica' }
]

// Motivo nota de crédito
const tiposNotaCredito = [
  { value: 1,  label: '01 - Anulación de la operación' },
  { value: 2,  label: '02 - Anulación por error en el RUC' },
  { value: 3,  label: '03 - Corrección por error en la descripción' },
  { value: 4,  label: '04 - Descuento global' },
  { value: 5,  label: '05 - Descuento por ítem' },
  { value: 6,  label: '06 - Devolución total' },
  { value: 7,  label: '07 - Devolución por ítem' },
  { value: 8,  label: '08 - Bonificación' },
  { value: 9,  label: '09 - Disminución en el valor' },
  { value: 10, label: '10 - Otros conceptos' },
  { value: 11, label: '11 - Ajustes afectos al IVAP' },
  { value: 12, label: '12 - Ajustes operaciones exportación' },
  { value: 13, label: '13 - Ajustes montos y/o fechas de pago' }
]

// Motivo nota de débito
const tiposNotaDebito = [
  { value: 1, label: '01 - Intereses por mora' },
  { value: 2, label: '02 - Aumento de valor' },
  { value: 3, label: '03 - Penalidades' },
  { value: 4, label: '04 - Ajustes afectos al IVAP' },
  { value: 5, label: '05 - Ajustes operaciones exportación' }
]

// Tipo percepción
const tiposPercepcion = [
  { value: 1, label: '1 - Venta Interna (Tasa 2%)' },
  { value: 2, label: '2 - Adquisición combustible (Tasa 1%)' },
  { value: 3, label: '3 - Agente percepción tasa especial (0.5%)' }
]

// Tipo retención
const tiposRetencion = [
  { value: 1, label: '1 - Tasa 3%' },
  { value: 2, label: '2 - Tasa 6%' }
]

// Tipo detracción (subset más común según doc)
const tiposDetraccion = [
  { value: 1,  label: '001 - Azúcar y melaza de caña' },
  { value: 2,  label: '002 - Arroz' },
  { value: 3,  label: '003 - Alcohol etílico' },
  { value: 4,  label: '004 - Recursos hidrobiológicos' },
  { value: 5,  label: '005 - Maíz amarillo duro' },
  { value: 7,  label: '007 - Caña de azúcar' },
  { value: 8,  label: '008 - Madera' },
  { value: 9,  label: '009 - Arena y piedra' },
  { value: 10, label: '010 - Residuos, subproductos, desechos' },
  { value: 11, label: '011 - Bienes gravados con IGV' },
  { value: 12, label: '012 - Intermediación laboral y tercerización' },
  { value: 13, label: '014 - Carnes y despojos comestibles' },
  { value: 14, label: '016 - Aceite de pescado' },
  { value: 15, label: '017 - Harina, polvo y pellets de pescado' },
  { value: 17, label: '019 - Arrendamiento bienes muebles' },
  { value: 18, label: '020 - Mantenimiento y reparación bienes muebles' },
  { value: 19, label: '021 - Movimiento de carga' },
  { value: 20, label: '022 - Otros servicios empresariales' },
  { value: 21, label: '023 - Leche' },
  { value: 22, label: '024 - Comisión mercantil' },
  { value: 23, label: '025 - Fabricación de bienes por encargo' },
  { value: 24, label: '026 - Transporte de personas' },
  { value: 25, label: '027 - Transporte de carga' },
  { value: 26, label: '028 - Transporte de pasajeros' },
  { value: 28, label: '030 - Contratos de construcción' },
  { value: 29, label: '031 - Oro gravado con IGV' },
  { value: 30, label: '032 - Páprika y otros frutos' },
  { value: 32, label: '034 - Minerales metálicos no auríferos' },
  { value: 33, label: '035 - Bienes exonerados del IGV' },
  { value: 34, label: '036 - Oro y minerales exonerados' },
  { value: 35, label: '037 - Demás servicios gravados con IGV' },
  { value: 37, label: '039 - Minerales no metálicos' },
  { value: 38, label: '040 - Bien inmueble gravado con IGV' },
  { value: 39, label: '041 - Plomo' },
  { value: 40, label: '013 - Animales vivos' },
  { value: 41, label: '015 - Abonos, cueros y pieles' },
  { value: 42, label: '099 - Ley 30737' },
  { value: 43, label: '044 - Servicio beneficio minerales metálicos' },
  { value: 44, label: '045 - Minerales de oro gravados con IGV' }
]

// Medio de pago detracción
const mediosPagoDetraccion = [
  { value: 1,  label: '001 - Depósito en cuenta' },
  { value: 2,  label: '002 - Giro' },
  { value: 3,  label: '003 - Transferencia de fondos' },
  { value: 4,  label: '004 - Orden de pago' },
  { value: 5,  label: '005 - Tarjeta de débito' },
  { value: 6,  label: '006 - Tarjeta de crédito' },
  { value: 7,  label: '007 - Cheques no negociables' },
  { value: 8,  label: '008 - Efectivo (sin obligación medio pago)' },
  { value: 9,  label: '009 - Efectivo (demás casos)' },
  { value: 10, label: '010 - Medios pago comercio exterior' },
  { value: 11, label: '011 - EDPYMES / cooperativas' },
  { value: 12, label: '012 - Tarjeta crédito no sist. financiero' },
  { value: 13, label: '013 - Tarjetas crédito emitidas exterior' },
  { value: 22, label: '999 - Otros medios de pago' }
]

// Tipo de guía relacionada
const tiposGuia = [
  { value: 1, label: '1 - Guía Remisión Remitente' },
  { value: 2, label: '2 - Guía Remisión Transportista' }
]

/* ═════════════════════════════════════════════════════════════
   ESTADO
   ═════════════════════════════════════════════════════════════ */
const showDialog          = ref(false)
const dialogProximamente  = ref(false)
const enviando            = ref(false)
const formRef             = ref<any>(null)
const respuestaSunat      = ref<any>(null)
const comprobantes        = ref<any[]>([])
const loadingComprobantes = ref(false)
const searchComprobantes  = ref('')

// Envío por correo (desde el dialog de nuevo comprobante)
const mostrarEnvioCorreo = ref(false)
const emailEnvio         = ref('')
const mensajeEmailExtra  = ref('')
const enviandoEmail      = ref(false)
const resultadoEmail     = ref<any>(null)

// Envío rápido por correo (desde la tabla de historial)
const dialogEnvioRapido    = ref(false)
const envioRapidoTarget    = ref<any>(null)
const emailEnvioRapido     = ref('')
const mensajeExtraRapido   = ref('')
const enviandoEmailRapido  = ref(false)
const resultadoEmailRapido = ref<any>(null)

// Filtro de estado en la tabla
const filtroComprobantes = ref<'todos' | 'pendientes' | 'aceptados' | 'anulados'>('todos')

const filtrosEstado = computed(() => [
  { value: 'todos',      label: 'Todos',           badgeColor: '#6366f1', count: comprobantes.value.length },
  { value: 'pendientes', label: 'Pendientes PSE',  badgeColor: '#f59e0b', count: comprobantes.value.filter(c => !c.sunat_ok && !c.anulado).length },
  { value: 'aceptados',  label: 'En SUNAT',        badgeColor: '#22c55e', count: comprobantes.value.filter(c => c.sunat_ok && !c.anulado).length },
  { value: 'anulados',   label: 'Anulados',        badgeColor: '#6b7280', count: comprobantes.value.filter(c => c.anulado).length },
])

const comprobantesVista = computed(() => {
  if (filtroComprobantes.value === 'pendientes') return comprobantes.value.filter(c => !c.sunat_ok && !c.anulado)
  if (filtroComprobantes.value === 'aceptados')  return comprobantes.value.filter(c => c.sunat_ok && !c.anulado)
  if (filtroComprobantes.value === 'anulados')   return comprobantes.value.filter(c => c.anulado)
  return comprobantes.value
})

// Pendientes (boletas guardadas sin emitir a SUNAT)
const pendientes          = ref<any[]>([])
const loadingPendientes   = ref(false)
const emitiendoPendiente  = ref<number | null>(null) // id del que se está emitiendo
const emitiendoTodas      = ref(false)

// Eliminar (pendientes PSE)
const dialogEliminar   = ref(false)
const eliminarTarget   = ref<any>(null)
const eliminando       = ref(false)
const errorEliminar    = ref('')

// Anulación
const dialogAnulacion  = ref(false)
const anulacionTarget  = ref<any>(null)
const motivoAnulacion  = ref('')
const anulando         = ref(false)
const errorAnulacion   = ref('')

// Historial de errores (persistente abajo del formulario)
interface ErrorLog {
  hora:     string
  serie:    string
  numero:   number | string
  mensaje:  string
  detalle?: any
}
const erroresHistorial = ref<ErrorLog[]>([])

// Error de carga del historial
const errorCargaHistorial = ref<string>('')

const headersComprobantes = [
  { title: 'Tipo',     key: 'tipo',     sortable: true },
  { title: 'Serie',    key: 'serie',    sortable: true },
  { title: 'Número',   key: 'numero',   sortable: true },
  { title: 'Cliente',  key: 'cliente',  sortable: true },
  { title: 'Fecha',    key: 'fecha',    sortable: true },
  { title: 'Total',    key: 'total',    sortable: true },
  { title: 'SUNAT',    key: 'sunat_ok', sortable: false },
  { title: 'Acciones', key: 'acciones', sortable: false }
]

/* ═════════════════════════════════════════════════════════════
   FORM: ESTRUCTURA COMPLETA
   ═════════════════════════════════════════════════════════════ */
const itemVacio = () => ({
  unidad_de_medida:     'NIU',
  codigo:               '',
  codigo_producto_sunat:'',
  descripcion:          '',
  cantidad:             1,
  valor_unitario:       0,
  precio_unitario:      0,
  descuento:            0,
  subtotal:             0,
  tipo_de_igv:          1,
  igv:                  0,
  total:                0,
  anticipo_regularizacion: false
})

const hoy = () => new Date().toISOString().split('T')[0]

const SUNAT_RUC    = '20131312955'
const SUNAT_NOMBRE = 'SUNAT - SUPERINTENDENCIA NACIONAL DE ADUANAS Y DE ADMINISTRACION TRIBUTARIA'
const SUNAT_DIR    = 'AV. GARCILASO DE LA VEGA 1472 LIMA'

const formInicial = () => ({
  // ── General ──
  tipo_de_comprobante:   1,
  serie:                 'F001',
  numero:                1,
  sunat_transaction:     1,
  fecha_de_emision:      hoy(),
  fecha_de_vencimiento:  '',
  moneda:                1,
  tipo_de_cambio:        '',
  formato_de_pdf:        'A4',

  // ── Cliente (por defecto SUNAT) ──
  cliente_tipo_de_documento:   6,
  cliente_numero_de_documento: SUNAT_RUC,
  cliente_denominacion:        SUNAT_NOMBRE,
  cliente_direccion:           SUNAT_DIR,
  cliente_email:               '',
  cliente_email_1:             '',
  cliente_email_2:             '',

  // ── Documento que modifica (notas) ──
  documento_que_se_modifica_tipo:   '',
  documento_que_se_modifica_serie:  '',
  documento_que_se_modifica_numero: '',
  tipo_de_nota_de_credito:          '',
  tipo_de_nota_de_debito:           '',

  // ── Items ──
  items: [itemVacio()],

  // ── Info adicional ──
  observaciones:         '',
  orden_compra_servicio: '',
  condiciones_de_pago:   '',
  medio_de_pago:         '',
  placa_vehiculo:        '',
  codigo_unico:          '',

  // ── Detracción ──
  detraccion:              false,
  detraccion_tipo:         '',
  detraccion_total:        '',
  detraccion_porcentaje:   '',
  medio_de_pago_detraccion:'',

  // ── Percepción ──
  percepcion_tipo:           '',
  percepcion_base_imponible: '',
  total_percepcion:          '',
  total_incluido_percepcion: '',

  // ── Retención ──
  retencion_tipo:           '',
  retencion_base_imponible: '',
  total_retencion:          '',

  // ── Descuentos globales ──
  descuento_global: '',
  total_anticipo:   '',

  // ── Bolsas ──
  total_impuestos_bolsas: '',

  // ── Venta al crédito ──
  venta_al_credito: [] as any[],

  // ── Guías relacionadas ──
  guias: [] as any[],

  // ── Flags ──
  generado_por_contingencia: false,
  bienes_region_selva:       false,
  servicios_region_selva:    false
})

const form = ref(formInicial())

/* ═════════════════════════════════════════════════════════════
   COMPUTEDS
   ═════════════════════════════════════════════════════════════ */

/**
 * Empresas que ya están dadas de alta en PSE.PE y pueden emitir
 * comprobantes electrónicos reales contra SUNAT. El resto verá el
 * mensaje "Activo próximamente" cuando intenten abrir el formulario.
 *
 * Para activar una nueva empresa:
 *   1. Darla de alta en el panel de PSE.PE (reseller)
 *   2. Añadir su URL/token al objeto EMPRESAS de
 *      server/api/pse/factura.post.ts
 *   3. Añadir su company_id (lower-case, sin espacios) a esta lista
 */
const COMPANIES_ACTIVE = ['estasconsuerte', 'healup'] as const

const companyKey = computed(() =>
  (props.companyId || '').toLowerCase().replace(/\s/g, '')
)

const empresaActiva = computed(() => COMPANIES_ACTIVE.includes(companyKey.value as any))

// Demo flag — en este momento NINGUNA empresa está en demo (todas las
// empresas activas pasaron a producción real). Se mantiene la variable
// por compatibilidad con el resto del template (chips, hints de serie, etc.).
const esDemo = computed(() => false)

const esNota = computed(() =>
  form.value.tipo_de_comprobante === 3 || form.value.tipo_de_comprobante === 4
)

const labelNumeroDoc = computed(() => {
  const td = form.value.cliente_tipo_de_documento
  if (td === 6) return 'RUC *'
  if (td === 1) return 'DNI'
  if (td === '-') return 'Documento'
  if (td === 4) return 'Carnet Extr.'
  if (td === 7) return 'Pasaporte'
  return 'Número Doc.'
})

const simboloMoneda = computed(() => {
  const m = monedas.find(x => x.value === form.value.moneda)
  return m?.simbolo || 'S/'
})

/* Cálculo de una línea — considera descuento y todos los tipos de IGV */
const calcularItem = (idx: number) => {
  const it = form.value.items[idx]
  const IGV_RATE = 0.18
  const t = Number(it.tipo_de_igv)

  // Gravados: 1-7, 16
  const esGravado = (t >= 1 && t <= 7) || t === 16
  const descuento = Number(it.descuento) || 0
  const base      = +(Number(it.cantidad) * Number(it.valor_unitario)).toFixed(2)
  const subtotal  = +(base - descuento).toFixed(2)
  const igv       = esGravado ? +(subtotal * IGV_RATE).toFixed(2) : 0
  const total     = +(subtotal + igv).toFixed(2)

  it.subtotal        = subtotal
  it.igv             = igv
  it.total           = total
  it.precio_unitario = Number(it.valor_unitario) > 0
    ? +(Number(it.valor_unitario) * (esGravado ? 1 + IGV_RATE : 1)).toFixed(6)
    : 0
}

/* Totales generales, agrupados por tipo de IGV (ver doc NubeFact) */
const totales = computed(() => {
  let gravada = 0, inafecta = 0, exonerada = 0, gratuita = 0, igv = 0, descuento = 0

  form.value.items.forEach(it => {
    const t = Number(it.tipo_de_igv)
    descuento += Number(it.descuento) || 0

    // Gravado Onerosa (1) y Exportación (16) → total_gravada + igv
    if (t === 1 || t === 16) {
      gravada += it.subtotal
      igv     += it.igv
    }
    // Gravados retiro / bonificación / premio (2-7) → gratuitos gravados
    else if (t >= 2 && t <= 7) {
      gratuita += it.subtotal
      igv      += it.igv        // el IGV igual se calcula aunque no se cobre
    }
    // Exonerado onerosa (8) → total_exonerada
    else if (t === 8) {
      exonerada += it.subtotal
    }
    // Inafecto onerosa (9) → total_inafecta
    else if (t === 9) {
      inafecta += it.subtotal
    }
    // Inafectos retiro / bonificación (10-15) → gratuita
    else if (t >= 10 && t <= 15) {
      gratuita += it.subtotal
    }
    // Exonerado transferencia gratuita (17) → gratuita
    else if (t === 17) {
      gratuita += it.subtotal
    }
    // Inafecto transferencia gratuita (20) → gratuita
    else if (t === 20) {
      gratuita += it.subtotal
    }
  })

  return {
    gravada:   +gravada.toFixed(2),
    inafecta:  +inafecta.toFixed(2),
    exonerada: +exonerada.toFixed(2),
    gratuita:  +gratuita.toFixed(2),
    igv:       +igv.toFixed(2),
    descuento: +descuento.toFixed(2),
    total:     +(gravada + inafecta + exonerada + gratuita + igv).toFixed(2)
  }
})

/* ═════════════════════════════════════════════════════════════
   ACCIONES: TIPO DE COMPROBANTE / ITEMS / CUOTAS / GUÍAS
   ═════════════════════════════════════════════════════════════ */
const onTipoCambia = (v: number) => {
  // Series por defecto en producción.
  // 1 = Factura → F001
  // 2 = Boleta  → B001
  // 3 = Nota de Crédito → la serie debe coincidir con la del documento
  //     que se modifica (Factura: FC01, Boleta: BC01)
  // 4 = Nota de Débito → FD01 / BD01 según el caso
  if (v === 1)      form.value.serie = 'F001'
  else if (v === 2) form.value.serie = 'B001'
  else if (v === 3) form.value.serie = 'FC01'
  else if (v === 4) form.value.serie = 'FD01'

  form.value.numero = siguienteNumero(v, form.value.serie)

  if (v === 1) {
    // Factura → cliente con RUC (SUNAT por defecto)
    form.value.cliente_tipo_de_documento   = 6
    form.value.cliente_numero_de_documento = SUNAT_RUC
    form.value.cliente_denominacion        = SUNAT_NOMBRE
    form.value.cliente_direccion           = SUNAT_DIR
  } else if (v === 2) {
    // Boleta → consumidor final (tipo_doc = '-')
    form.value.cliente_tipo_de_documento   = '-'
    form.value.cliente_numero_de_documento = '00000000'
    form.value.cliente_denominacion        = 'CONSUMIDOR FINAL'
    form.value.cliente_direccion           = ''
  }
  // Para notas (3, 4) se conservan los datos del cliente actuales
}

const agregarItem  = () => form.value.items.push(itemVacio())
const eliminarItem = (idx: number) => form.value.items.splice(idx, 1)

const agregarCuota = () => form.value.venta_al_credito.push({
  cuota:         form.value.venta_al_credito.length + 1,
  fecha_de_pago: '',
  importe:       0
})
const eliminarCuota = (idx: number) => form.value.venta_al_credito.splice(idx, 1)

const agregarGuia  = () => form.value.guias.push({ guia_tipo: 1, guia_serie_numero: '' })
const eliminarGuia = (idx: number) => form.value.guias.splice(idx, 1)

const siguienteNumero = (tipo: number, serie: string): number => {
  const max = comprobantes.value
    .filter(c => c.tipo === tipo && c.serie === serie)
    .reduce((m, c) => Math.max(m, Number(c.numero) || 0), 0)
  return max + 1
}

const abrirNuevo = () => {
  // Empresas que aún no están dadas de alta en PSE.PE → mostrar aviso
  if (!empresaActiva.value) {
    dialogProximamente.value = true
    return
  }
  form.value           = formInicial()
  // Auto-avanzar al siguiente número según historial ya cargado
  form.value.numero    = siguienteNumero(form.value.tipo_de_comprobante, form.value.serie)
  respuestaSunat.value = null
  showDialog.value     = true
}

/* ═════════════════════════════════════════════════════════════
   HELPERS PARA TABLA
   ═════════════════════════════════════════════════════════════ */
const labelTipo = (t: number) =>
  t === 1 ? 'Factura' : t === 2 ? 'Boleta' : t === 3 ? 'N.Crédito' : t === 4 ? 'N.Débito' : '-'

const colorTipo = (t: number) =>
  t === 1 ? 'blue' : t === 2 ? 'green' : t === 3 ? 'orange' : t === 4 ? 'red' : 'grey'

/* ═════════════════════════════════════════════════════════════
   ENVIAR A PSE.PE
   - Construye el JSON final respetando los nombres de la doc
   - Omite campos opcionales vacíos para no ensuciar el payload
   ═════════════════════════════════════════════════════════════ */
const enviarFactura = async () => {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  enviando.value = true
  respuestaSunat.value = null

  const t = totales.value
  const f = form.value

  // Helper: incluir sólo si no está vacío
  const opc = (v: any) => (v === null || v === undefined || v === '' ? undefined : v)

  const payload: any = {
    tipo_de_comprobante:         f.tipo_de_comprobante,
    serie:                       f.serie,
    numero:                      f.numero,
    sunat_transaction:           f.sunat_transaction,
    cliente_tipo_de_documento:   f.cliente_tipo_de_documento,
    cliente_numero_de_documento: f.cliente_numero_de_documento,
    cliente_denominacion:        f.cliente_denominacion,
    cliente_direccion:           f.cliente_direccion || '',
    cliente_email:               f.cliente_email || '',
    cliente_email_1:             f.cliente_email_1 || '',
    cliente_email_2:             f.cliente_email_2 || '',
    fecha_de_emision:            f.fecha_de_emision,           // server lo convierte a DD-MM-YYYY
    fecha_de_vencimiento:        f.fecha_de_vencimiento || '',
    moneda:                      f.moneda,
    tipo_de_cambio:              f.moneda !== 1 ? (f.tipo_de_cambio || '') : '',
    porcentaje_de_igv:           18.00,
    total_gravada:               t.gravada   || '',
    total_inafecta:              t.inafecta  || '',
    total_exonerada:             t.exonerada || '',
    total_gratuita:              t.gratuita  || '',
    total_igv:                   t.igv       || '',
    total:                       t.total,
    formato_de_pdf:              f.formato_de_pdf || 'A4',
    observaciones:               f.observaciones || '',

    items: f.items.map(it => ({
      unidad_de_medida:            it.unidad_de_medida,
      codigo:                      it.codigo || '',
      codigo_producto_sunat:       opc(it.codigo_producto_sunat),
      descripcion:                 it.descripcion,
      cantidad:                    Number(it.cantidad),
      valor_unitario:              Number(it.valor_unitario),
      precio_unitario:             Number(it.precio_unitario),
      descuento:                   opc(it.descuento),
      subtotal:                    it.subtotal,
      tipo_de_igv:                 it.tipo_de_igv,
      igv:                         it.igv,
      total:                       it.total,
      anticipo_regularizacion:     it.anticipo_regularizacion || false
    }))
  }

  // Campos opcionales de cabecera → solo si tienen valor
  if (f.descuento_global)       payload.descuento_global       = Number(f.descuento_global)
  if (t.descuento > 0)          payload.total_descuento        = t.descuento
  if (f.total_anticipo)         payload.total_anticipo         = Number(f.total_anticipo)
  if (f.total_impuestos_bolsas) payload.total_impuestos_bolsas = Number(f.total_impuestos_bolsas)
  if (f.orden_compra_servicio)  payload.orden_compra_servicio  = f.orden_compra_servicio
  if (f.condiciones_de_pago)    payload.condiciones_de_pago    = f.condiciones_de_pago
  if (f.medio_de_pago)          payload.medio_de_pago          = f.medio_de_pago
  if (f.placa_vehiculo)         payload.placa_vehiculo         = f.placa_vehiculo
  if (f.codigo_unico)           payload.codigo_unico           = f.codigo_unico

  // Notas de crédito/débito
  if (esNota.value) {
    payload.documento_que_se_modifica_tipo   = f.documento_que_se_modifica_tipo
    payload.documento_que_se_modifica_serie  = f.documento_que_se_modifica_serie
    payload.documento_que_se_modifica_numero = f.documento_que_se_modifica_numero
    if (f.tipo_de_comprobante === 3) payload.tipo_de_nota_de_credito = f.tipo_de_nota_de_credito
    if (f.tipo_de_comprobante === 4) payload.tipo_de_nota_de_debito  = f.tipo_de_nota_de_debito
  }

  // Detracción
  if (f.detraccion) {
    payload.detraccion               = true
    payload.detraccion_tipo          = f.detraccion_tipo
    payload.detraccion_total         = Number(f.detraccion_total)   || ''
    payload.detraccion_porcentaje    = Number(f.detraccion_porcentaje) || ''
    payload.medio_de_pago_detraccion = f.medio_de_pago_detraccion
  }

  // Percepción
  if (f.percepcion_tipo) {
    payload.percepcion_tipo           = f.percepcion_tipo
    payload.percepcion_base_imponible = Number(f.percepcion_base_imponible) || ''
    payload.total_percepcion          = Number(f.total_percepcion) || ''
    payload.total_incluido_percepcion = Number(f.total_incluido_percepcion) || ''
  }

  // Retención
  if (f.retencion_tipo) {
    payload.retencion_tipo           = f.retencion_tipo
    payload.retencion_base_imponible = Number(f.retencion_base_imponible) || ''
    payload.total_retencion          = Number(f.total_retencion) || ''
  }

  // Venta al crédito
  if (f.venta_al_credito.length > 0) {
    payload.venta_al_credito = f.venta_al_credito.map(c => ({
      cuota:         c.cuota,
      fecha_de_pago: c.fecha_de_pago,                  // server lo convierte a DD-MM-YYYY
      importe:       Number(c.importe)
    }))
  }

  // Guías relacionadas
  if (f.guias.length > 0) {
    payload.guias = f.guias.map(g => ({
      guia_tipo:         g.guia_tipo,
      guia_serie_numero: g.guia_serie_numero
    }))
  }

  // Flags especiales
  if (f.generado_por_contingencia) payload.generado_por_contingencia = true
  if (f.bienes_region_selva)       payload.bienes_region_selva       = true
  if (f.servicios_region_selva)    payload.servicios_region_selva    = true

  try {
    const res = await $fetch<any>('/api/pse/factura', {
      method: 'POST',
      body: { company_id: props.companyId, payload, solo_pendiente: true }
    })

    // Modo pendiente: no se emitió a SUNAT aún
    if (res.pendiente) {
      respuestaSunat.value = {
        aceptada:       false,
        pendiente:      true,
        descripcion:    'Comprobante guardado como pendiente. Emítelo desde la sección de pendientes.',
        serie:          res.serie,
        numero:         res.numero,
        comprobante_id: res.comprobante_id || null
      }
    } else {
      const aceptada = res.aceptada_por_sunat === true
      respuestaSunat.value = {
        aceptada,
        descripcion:         res.sunat_description || res.errors || (aceptada ? 'Aceptada sin observaciones' : 'Sin descripción'),
        serie:               res.serie,
        numero:              res.numero,
        enlace:              res.enlace           || null,
        enlace_pdf:          res.enlace_del_pdf   || null,
        enlace_xml:          res.enlace_del_xml   || null,
        enlace_cdr:          res.enlace_del_cdr   || null,
        codigo_hash:         res.codigo_hash      || null,
        sunat_note:          res.sunat_note       || null,
        sunat_responsecode:  res.sunat_responsecode || null,
        sunat_soap_error:    res.sunat_soap_error || null,
        comprobante_id:      res.comprobante_id   || null
      }
    }

    if (res.pendiente) {
      // Agregar a lista de pendientes
      pendientes.value.unshift({
        id:      res.comprobante_id,
        tipo:    f.tipo_de_comprobante,
        serie:   res.serie,
        numero:  res.numero,
        cliente: f.cliente_denominacion,
        fecha:   f.fecha_de_emision,
        total:   t.total,
      })
      form.value.numero = (Number(form.value.numero) || 0) + 1
    } else if (respuestaSunat.value?.aceptada) {
      // Precargar email del cliente si existe
      emailEnvio.value       = f.cliente_email || f.cliente_email_1 || ''
      mostrarEnvioCorreo.value = !!emailEnvio.value
      resultadoEmail.value   = null

      // Agregar a la tabla local
      comprobantes.value.unshift({
        id:         res.comprobante_id,
        tipo:       f.tipo_de_comprobante,
        serie:      res.serie,
        numero:     res.numero,
        cliente:    f.cliente_denominacion,
        fecha:      f.fecha_de_emision,
        total:      t.total,
        sunat_ok:   true,
        anulado:    false,
        enlace:     res.enlace           || null,
        enlace_pdf: res.enlace_del_pdf   || null,
        enlace_xml: res.enlace_del_xml   || null,
        enlace_cdr: res.enlace_del_cdr   || null
      })
      form.value.numero = (Number(form.value.numero) || 0) + 1
    } else {
      // SUNAT rechazó — registrar en histórico
      erroresHistorial.value.unshift({
        hora:    new Date().toLocaleTimeString('es-PE'),
        serie:   String(f.serie),
        numero:  f.numero,
        mensaje: res.sunat_description || res.errors || 'Rechazada sin descripción',
        detalle: res
      })
    }

  } catch (err: any) {
    const mensaje = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error de conexión con PSE.PE'

    respuestaSunat.value = {
      aceptada:    false,
      descripcion: mensaje,
      serie:       f.serie,
      numero:      f.numero,
      codigo:      err?.data?.codigo
    }

    // Guardar en histórico
    erroresHistorial.value.unshift({
      hora:    new Date().toLocaleTimeString('es-PE'),
      serie:   String(f.serie),
      numero:  f.numero,
      mensaje,
      detalle: err?.data || err
    })

    // Tope máximo de 50 errores en memoria
    if (erroresHistorial.value.length > 50) {
      erroresHistorial.value = erroresHistorial.value.slice(0, 50)
    }
  } finally {
    enviando.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   ENVIAR COMPROBANTE POR CORREO
   ═════════════════════════════════════════════════════════════ */
const enviarCorreoComprobante = async () => {
  if (!respuestaSunat.value?.aceptada) return
  if (!emailEnvio.value.trim()) return

  enviandoEmail.value = true
  resultadoEmail.value = null

  try {
    const res = await $fetch<any>('/api/pse/enviar-correo', {
      method: 'POST',
      body: {
        comprobante_id:       respuestaSunat.value.comprobante_id,
        company_id:           props.companyId,
        to:                   emailEnvio.value,
        tipo_de_comprobante:  form.value.tipo_de_comprobante,
        serie:                respuestaSunat.value.serie,
        numero:               respuestaSunat.value.numero,
        cliente_denominacion: form.value.cliente_denominacion,
        total:                totales.value.total,
        moneda:               form.value.moneda,
        enlace:               respuestaSunat.value.enlace,
        enlace_del_pdf:       respuestaSunat.value.enlace_pdf,
        enlace_del_xml:       respuestaSunat.value.enlace_xml,
        enlace_del_cdr:       respuestaSunat.value.enlace_cdr,
        mensaje_extra:        mensajeEmailExtra.value || undefined
      }
    })

    resultadoEmail.value = {
      ok:            true,
      destinatarios: res?.destinatarios || []
    }
  } catch (err: any) {
    const mensaje = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error enviando correo'
    resultadoEmail.value = { ok: false, mensaje }

    // También lo añadimos al historial de errores
    erroresHistorial.value.unshift({
      hora:    new Date().toLocaleTimeString('es-PE'),
      serie:   respuestaSunat.value?.serie || '',
      numero:  respuestaSunat.value?.numero || '',
      mensaje: `[Email] ${mensaje}`,
      detalle: err?.data || err
    })
  } finally {
    enviandoEmail.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   ENVÍO RÁPIDO DESDE LA TABLA DE HISTORIAL
   ═════════════════════════════════════════════════════════════ */
const abrirEnvioCorreoDesdeTabla = (item: any) => {
  envioRapidoTarget.value    = item
  emailEnvioRapido.value     = ''
  mensajeExtraRapido.value   = ''
  resultadoEmailRapido.value = null
  dialogEnvioRapido.value    = true
}

const enviarCorreoRapido = async () => {
  if (!envioRapidoTarget.value) return
  if (!emailEnvioRapido.value.trim()) return

  enviandoEmailRapido.value = true
  resultadoEmailRapido.value = null

  const item = envioRapidoTarget.value

  try {
    const res = await $fetch<any>('/api/pse/enviar-correo', {
      method: 'POST',
      body: {
        comprobante_id:       item.id,
        company_id:           props.companyId,
        to:                   emailEnvioRapido.value,
        tipo_de_comprobante:  item.tipo,
        serie:                item.serie,
        numero:               item.numero,
        cliente_denominacion: item.cliente,
        total:                item.total,
        moneda:               1,
        enlace:               item.enlace,
        enlace_del_pdf:       item.enlace_pdf,
        enlace_del_xml:       item.enlace_xml,
        enlace_del_cdr:       item.enlace_cdr,
        mensaje_extra:        mensajeExtraRapido.value || undefined
      }
    })

    resultadoEmailRapido.value = {
      ok: true,
      destinatarios: res?.destinatarios || []
    }
  } catch (err: any) {
    const mensaje = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error enviando correo'
    resultadoEmailRapido.value = { ok: false, mensaje }

    erroresHistorial.value.unshift({
      hora:    new Date().toLocaleTimeString('es-PE'),
      serie:   String(item.serie),
      numero:  item.numero,
      mensaje: `[Email] ${mensaje}`,
      detalle: err?.data || err
    })
  } finally {
    enviandoEmailRapido.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   ELIMINAR COMPROBANTE (pendiente PSE, antes de SUNAT)
   ═════════════════════════════════════════════════════════════ */
const abrirEliminar = (item: any) => {
  eliminarTarget.value = item
  errorEliminar.value  = ''
  dialogEliminar.value = true
}

const confirmarEliminar = async () => {
  const item = eliminarTarget.value
  if (!item) return
  eliminando.value = true
  errorEliminar.value = ''
  try {
    await $fetch('/api/pse/eliminar', {
      method: 'POST',
      body: {
        company_id:          props.companyId,
        tipo_de_comprobante: item.tipo,
        serie:               item.serie,
        numero:              item.numero,
      }
    })
    // Quitar de la lista local
    comprobantes.value = comprobantes.value.filter(
      c => !(c.serie === item.serie && Number(c.numero) === Number(item.numero))
    )
    dialogEliminar.value = false
  } catch (err: any) {
    errorEliminar.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error al eliminar'
  } finally {
    eliminando.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   ANULACIÓN DE COMPROBANTES
   ═════════════════════════════════════════════════════════════ */
const abrirAnulacion = (item: any) => {
  anulacionTarget.value = item
  motivoAnulacion.value = ''
  errorAnulacion.value  = ''
  dialogAnulacion.value = true
}

const confirmarAnulacion = async () => {
  if (!anulacionTarget.value || !motivoAnulacion.value.trim()) return
  const item = anulacionTarget.value
  anulando.value       = true
  errorAnulacion.value = ''

  try {
    await $fetch('/api/pse/anular', {
      method: 'POST',
      body: {
        company_id:          props.companyId,
        tipo_de_comprobante: item.tipo,
        serie:               item.serie,
        numero:              item.numero,
        motivo:              motivoAnulacion.value.trim(),
      }
    })

    // Marcar en la lista local como anulado
    const idx = comprobantes.value.findIndex(
      c => c.serie === item.serie && Number(c.numero) === Number(item.numero)
    )
    if (idx !== -1) comprobantes.value[idx].anulado = true

    dialogAnulacion.value = false
  } catch (err: any) {
    errorAnulacion.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error al anular'
  } finally {
    anulando.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   CARGAR HISTORIAL DESDE SUPABASE
   ═════════════════════════════════════════════════════════════ */
const cargarComprobantes = async () => {
  if (!props.companyId) {
    console.warn('[PSE] cargarComprobantes: companyId vacío, abortando')
    return
  }

  loadingComprobantes.value = true
  errorCargaHistorial.value = ''

  try {
    console.log('[PSE] Cargando historial de comprobantes para:', props.companyId)

    const res = await $fetch<any>('/api/pse/comprobantes', {
      params: { company_id: props.companyId, limit: 200 }
    })

    console.log('[PSE] Respuesta del servidor:', res)

    if (res?.ok && Array.isArray(res.items)) {
      comprobantes.value = res.items.map((r: any) => ({
        id:         r.id,
        tipo:       r.tipo_de_comprobante,
        serie:      r.serie,
        numero:     r.numero,
        cliente:    r.cliente_denominacion,
        fecha:      r.fecha_de_emision,
        total:      Number(r.total) || 0,
        sunat_ok:   !!r.aceptada_por_sunat,
        enlace:     r.enlace,
        enlace_pdf: r.enlace_del_pdf,
        enlace_xml: r.enlace_del_xml,
        enlace_cdr: r.enlace_del_cdr,
        anulado:    !!r.anulado,
      }))
      console.log('[PSE] Historial cargado:', comprobantes.value.length, 'comprobantes')
    } else {
      console.warn('[PSE] Respuesta inesperada del endpoint:', res)
      errorCargaHistorial.value = 'Respuesta inesperada del servidor'
    }
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Error desconocido'
    console.error('[PSE] error cargando comprobantes:', msg, err)
    errorCargaHistorial.value = msg
  } finally {
    loadingComprobantes.value = false
  }
}

/* ═════════════════════════════════════════════════════════════
   PENDIENTES: CARGAR, EMITIR, ELIMINAR
   ═════════════════════════════════════════════════════════════ */
const cargarPendientes = async () => {
  if (!props.companyId) return
  loadingPendientes.value = true
  try {
    const key = props.companyId.toLowerCase().replace(/\s/g, '')
    const { data, error } = await supabase
      .from('comprobantes_pse')
      .select('id, tipo_de_comprobante, serie, numero, cliente_denominacion, fecha_de_emision, total, error_emision, estado')
      .eq('company_id', key)
      .eq('estado', 'pendiente')
      .order('numero', { ascending: true })

    if (!error && data) {
      pendientes.value = data.map((r: any) => ({
        id:      r.id,
        tipo:    r.tipo_de_comprobante,
        serie:   r.serie,
        numero:  r.numero,
        cliente: r.cliente_denominacion,
        fecha:   r.fecha_de_emision,
        total:   Number(r.total) || 0,
        error:   r.error_emision,
      }))
    }
  } catch (e: any) {
    console.error('[PSE] Error cargando pendientes:', e?.message)
  } finally {
    loadingPendientes.value = false
  }
}

const emitirPendiente = async (item: any) => {
  emitiendoPendiente.value = item.id
  try {
    const res = await $fetch<any>('/api/pse/emitir', {
      method: 'POST',
      body: { comprobante_id: item.id }
    })
    const r = res.resultados?.[0]
    if (r?.ok) {
      pendientes.value = pendientes.value.filter(p => p.id !== item.id)
      comprobantes.value.unshift({
        id:         item.id,
        tipo:       item.tipo,
        serie:      item.serie,
        numero:     item.numero,
        cliente:    item.cliente,
        fecha:      item.fecha,
        total:      item.total,
        sunat_ok:   !!r.aceptada_por_sunat,
        anulado:    false,
        enlace_pdf: r.enlace_del_pdf || null,
      })
    } else {
      const idx = pendientes.value.findIndex(p => p.id === item.id)
      if (idx !== -1) pendientes.value[idx].error = r?.error || 'Error desconocido'
    }
  } catch (e: any) {
    const idx = pendientes.value.findIndex(p => p.id === item.id)
    if (idx !== -1) pendientes.value[idx].error = e?.data?.statusMessage || e?.message || 'Error'
  } finally {
    emitiendoPendiente.value = null
  }
}

const emitirTodasPendientes = async () => {
  if (pendientes.value.length === 0) return
  emitiendoTodas.value = true
  try {
    const res = await $fetch<any>('/api/pse/emitir', {
      method: 'POST',
      body: { company_id: props.companyId, todos: true }
    })
    // Recargar ambas listas
    await Promise.all([cargarPendientes(), cargarComprobantes()])
  } catch (e: any) {
    console.error('[PSE] Error emitiendo todas:', e?.message)
  } finally {
    emitiendoTodas.value = false
  }
}

const eliminarPendiente = async (item: any) => {
  try {
    const key = props.companyId.toLowerCase().replace(/\s/g, '')
    await supabase
      .from('comprobantes_pse')
      .delete()
      .eq('id', item.id)
      .eq('estado', 'pendiente')

    pendientes.value = pendientes.value.filter(p => p.id !== item.id)
  } catch (e: any) {
    console.error('[PSE] Error eliminando pendiente:', e?.message)
  }
}

// Un solo watcher con immediate:true → cubre mount inicial Y cambios posteriores
watch(
  () => props.companyId,
  (val) => {
    if (val) {
      cargarComprobantes()
      cargarPendientes()
    }
  },
  { immediate: true }
)

/* ═════════════════════════════════════════════════════════════
   CATÁLOGO DE PRODUCTOS / SERVICIOS POR EMPRESA
   ═════════════════════════════════════════════════════════════ */
const supabase = useSupabaseClient()

interface CatalogConfig { table: string; nameField: string; priceField: string }
const catalogConfig: Record<string, CatalogConfig> = {
  healup:         { table: 'healup_procedures',          nameField: 'name',                priceField: 'price'           },
  estasconsuerte: { table: 'ecs_planes_subcripcion',      nameField: 'nombre',              priceField: 'precio'          },
  bradaperfumes:  { table: 'brada_perfumes',             nameField: 'perfume',             priceField: 'precio'          },
  alefcompany:    { table: 'alef_procedures',            nameField: 'name',                priceField: 'price'           },
  solari:         { table: 'solari_procedures',          nameField: 'name',                priceField: 'price'           },
  clinicaarroyo:  { table: 'arroyo_procedures',          nameField: 'name',                priceField: 'price'           },
  origitec:       { table: 'bsale_origitec_stock',       nameField: 'nombre_producto',     priceField: 'precio'          },
  alegrated:      { table: 'productos_stock_alegrated',  nameField: 'nombre_del_producto', priceField: 'precio_nacional' },
  skip:           { table: 'skip_servicios',             nameField: 'servicio',            priceField: 'precio'          },
}

interface CatalogItem { id: number | string; nombre: string; precio: number }
const catalogItems    = ref<CatalogItem[]>([])
const showCatalogMenu = ref(false)
const loadingCatalog  = ref(false)

const hasCatalog = computed(() => !!catalogConfig[companyKey.value])

const cargarCatalogo = async () => {
  const cfg = catalogConfig[companyKey.value]
  if (!cfg) return
  loadingCatalog.value = true
  try {
    const { data, error } = await (supabase.from(cfg.table) as any).select('*')
    if (error) { console.warn('[PSE] catalog error:', error); return }
    catalogItems.value = (data || []).map((r: any, idx: number) => ({
      id:     r.id ?? r.uuid ?? idx,
      nombre: String(r[cfg.nameField] || ''),
      precio: Number(r[cfg.priceField]) || 0
    })).filter((r: CatalogItem) => r.nombre)
  } catch (e) {
    console.warn('[PSE] catalog fetch failed:', e)
  } finally {
    loadingCatalog.value = false
  }
}

const agregarItemDesdeCatalogo = (prod: CatalogItem) => {
  const it = itemVacio()
  it.codigo         = String(prod.id)
  it.descripcion    = prod.nombre
  it.cantidad       = 1
  it.valor_unitario = prod.precio
  it.tipo_de_igv    = 1
  form.value.items.push(it)
  calcularItem(form.value.items.length - 1)
  showCatalogMenu.value = false
}

// Carga el catálogo cuando se abre el diálogo de nuevo comprobante
watch(showDialog, (v) => { if (v && catalogItems.value.length === 0 && !loadingCatalog.value) cargarCatalogo() })
// Recarga si cambia el companyId
watch(companyKey, () => { catalogItems.value = []; if (showDialog.value) cargarCatalogo() })
</script>

<style scoped>
.facturacion-pse { width: 100%; }

.pse-section-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-primary, #6366f1);
  border-bottom: 1px solid rgba(99,102,241,.2);
  padding-bottom: 4px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-row {
  background: rgba(0,0,0,.02);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid rgba(0,0,0,.06);
}

.totales-box {
  background: rgba(99,102,241,.1);
  border: 1px solid rgba(99,102,241,.35);
  border-radius: 12px;
  padding: 0;
  max-width: 380px;
  margin-left: auto;
  overflow: hidden;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 18px;
  font-size: 0.88rem;
  color: rgba(255,255,255,0.82);
  border-bottom: 1px solid rgba(99,102,241,.15);
}

.total-row:last-child {
  border-bottom: none;
}

.total-final {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  background: rgba(99,102,241,.55);
  border-top: 2px solid rgba(99,102,241,.6);
  letter-spacing: 0.03em;
}

.item-total-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  height: 40px;
  background: rgba(99,102,241,.15);
  border: 1px solid rgba(99,102,241,.35);
  border-radius: 8px;
  text-align: center;
  width: 100%;
}

.item-total-label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,.5);
  line-height: 1;
}

.item-total-value {
  font-size: 0.92rem;
  font-weight: 700;
  color: #a5b4fc;
  line-height: 1.3;
}

/* ═══════ RESPUESTA SUNAT — ÉXITO ═══════ */
.success-box {
  background: linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(5,150,105,0.09) 100%);
  border: 1px solid rgba(16,185,129,0.35);
  border-left: 4px solid #10b981;
  border-radius: 10px;
  padding: 16px 18px;
}
.success-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.success-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #065f46;
}
.success-sub {
  font-size: 0.85rem;
  color: #047857;
}
.success-body {
  margin-top: 12px;
}
.success-doc {
  padding: 8px 0;
  border-top: 1px dashed rgba(16,185,129,0.25);
  border-bottom: 1px dashed rgba(16,185,129,0.25);
  margin-bottom: 12px;
}
.success-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ═══════ RESPUESTA SUNAT — ERROR ═══════ */
.error-box {
  background: linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(220,38,38,0.08) 100%);
  border: 1px solid rgba(239,68,68,0.35);
  border-left: 4px solid #ef4444;
  border-radius: 10px;
  padding: 16px 18px;
}
.error-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.error-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #991b1b;
}
.error-sub {
  font-size: 0.9rem;
  color: #b91c1c;
  max-width: 680px;
}
.error-body {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.6);
  border-radius: 6px;
  font-size: 0.85rem;
  color: #7f1d1d;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-word;
}

/* ═══════ FORM DE EMAIL INLINE ═══════ */
.email-form {
  background: rgba(168,85,247,0.05);
  border: 1px solid rgba(168,85,247,0.25);
  border-radius: 8px;
  padding: 14px 16px;
}
.email-form-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7c3aed;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ═══════ HISTORIAL DE ERRORES ═══════ */
.errors-log {
  background: #fff7ed;
  border: 1px solid #fdba74;
  border-radius: 8px;
  overflow: hidden;
}
.errors-log-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fed7aa;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7c2d12;
}
.errors-log-list {
  max-height: 220px;
  overflow-y: auto;
}
.error-log-item {
  display: flex;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid #fdba74;
  font-size: 0.82rem;
}
.error-log-item:first-child {
  border-top: 0;
}
.error-log-time {
  color: #9a3412;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  min-width: 70px;
}
.error-log-text {
  color: #7c2d12;
  flex: 1;
  word-break: break-word;
}
</style>
