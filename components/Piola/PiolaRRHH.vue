<template>
  <div class="view-container">
    <header class="top-header">
      <h1>RR. HH.</h1>
      <button class="btn-primary" @click="cargarTodo">
        <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
      </button>
    </header>

    <div class="content-area">
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'tablero' }]" @click="tab = 'tablero'">Tareo en vivo</button>
          <button :class="['tab', { active: tab === 'expedientes' }]" @click="tab = 'expedientes'">Expedientes</button>
          <button :class="['tab', { active: tab === 'mensual' }]" @click="tab = 'mensual'">Reporte mensual</button>
          <button :class="['tab', { active: tab === 'vacaciones' }]" @click="tab = 'vacaciones'">
            Vacaciones <span v-if="pendientesVac" class="badge">{{ pendientesVac }}</span>
          </button>
          <button v-if="esAdmin" :class="['tab', { active: tab === 'planilla' }]" @click="tab = 'planilla'">
            Boletas y honorarios
          </button>
        </div>

        <!-- ══════════ TAREO EN VIVO ══════════ -->
        <!-- ══════════ EXPEDIENTE DEL TRABAJADOR ══════════ -->
        <PiolaExpediente v-if="tab === 'expedientes'" :perfil="perfil"
          :puede-editar="puedeEditar" :puede-eliminar="esAdmin"
          @notify="(p: any) => emit('notify', p)" />

        <div v-else-if="tab === 'tablero'">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">En jornada ahora</span></div>
              <div class="stat-value" style="color:#2e9e5b">{{ tablero.resumen?.en_jornada || 0 }}</div>
              <div class="stat-description">Marcaron entrada y no han salido</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">En break</span></div>
              <div class="stat-value" style="color:#f2a63b">{{ tablero.resumen?.en_break || 0 }}</div>
              <div class="stat-description">Con un break abierto</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Jornada cerrada</span></div>
              <div class="stat-value">{{ tablero.resumen?.cerrada || 0 }}</div>
              <div class="stat-description">Ya marcaron salida</div>
            </div>
            <div class="stat-card">
              <div class="stat-header"><span class="stat-title">Sin marcar</span></div>
              <div class="stat-value" style="color:#e2564a">{{ tablero.resumen?.sin_marcar || 0 }}</div>
              <div class="stat-description">Hoy, {{ fechaCorta(tablero.fecha) }}</div>
            </div>
          </div>

          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Equipo hoy</span>
            </v-card-title>
            <v-data-table :headers="headersTablero" :items="tablero.filas || []" class="elevation-0"
              no-data-text="No hay colaboradores registrados. Créalos en Configuración." :items-per-page="25">
              <template v-slot:item.estado="{ item }">
                <span class="estado-chip" :class="'e-' + item.estado">{{ textoEstado(item.estado) }}</span>
              </template>
              <template v-slot:item.check_in="{ item }">{{ horaLima(item.check_in) }}</template>
              <template v-slot:item.check_out="{ item }">{{ horaLima(item.check_out) }}</template>
              <template v-slot:item.worked_minutes="{ item }">{{ minutosAHoras(item.worked_minutes) }}</template>
              <template v-slot:item.break_minutes="{ item }">{{ minutosAHoras(item.break_minutes) }}</template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="puedeEditar" icon="mdi-pencil" size="x-small" variant="text"
                  title="Corregir marcación" @click="abrirCorreccion(item)" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <!-- ══════════ REPORTE MENSUAL ══════════ -->
        <div v-else-if="tab === 'mensual'">
          <div class="filtros-bar">
            <v-text-field v-model="desde" type="date" label="Desde" density="compact" hide-details
              variant="outlined" class="filtro" @change="cargarMes" />
            <v-text-field v-model="hasta" type="date" label="Hasta" density="compact" hide-details
              variant="outlined" class="filtro" @change="cargarMes" />
            <v-btn variant="tonal" @click="exportarCSV">
              <v-icon icon="mdi-download" start /> Exportar CSV
            </v-btn>
          </div>

          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Resumen por colaborador</span>
            </v-card-title>
            <v-data-table :headers="headersResumen" :items="mes.resumen || []" class="elevation-0"
              no-data-text="Sin marcaciones en el rango" :items-per-page="25">
              <template v-slot:item.horas="{ item }">{{ item.horas }} h</template>
            </v-data-table>
          </v-card>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Marcaciones ({{ (mes.registros || []).length }})</span>
            </v-card-title>
            <v-data-table :headers="headersRegistros" :items="mes.registros || []" class="elevation-0"
              no-data-text="Sin marcaciones" :items-per-page="50">
              <template v-slot:item.fecha="{ item }">{{ fechaCorta(item.fecha) }}</template>
              <template v-slot:item.check_in="{ item }">{{ horaLima(item.check_in) }}</template>
              <template v-slot:item.check_out="{ item }">{{ horaLima(item.check_out) }}</template>
              <template v-slot:item.worked_minutes="{ item }">{{ minutosAHoras(item.worked_minutes) }}</template>
              <template v-slot:item.estado="{ item }">
                <span class="estado-chip" :class="'s-' + item.estado">{{ item.estado }}</span>
              </template>
              <template v-slot:item.editado_por="{ item }">
                <span v-if="item.editado_por" style="font-size:11.5px; opacity:.7;" :title="fechaHora(item.editado_at)">
                  <v-icon icon="mdi-pencil" size="12" /> {{ item.editado_por }}
                </span>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="puedeEditar" icon="mdi-pencil" size="x-small" variant="text"
                  @click="abrirCorreccion({ email: item.colaborador_email, ...item })" />
              </template>
            </v-data-table>
          </v-card>
        </div>

        <!-- ══════════ VACACIONES ══════════ -->
        <div v-else-if="tab === 'vacaciones'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            15 días por año = <b>1.25 días devengados por mes trabajado</b>. Aplica <b>solo a colaboradores
            en planilla</b>; los de recibo por honorarios no devengan vacaciones.
          </v-alert>

          <v-card flat class="custom-data-table">
            <v-card-title class="table-search-bar">
              <span class="table-title">Saldos del equipo</span>
            </v-card-title>
            <v-data-table :headers="headersSaldos" :items="saldos" class="elevation-0"
              no-data-text="Sin colaboradores" :items-per-page="25">
              <template v-slot:item.tipo_contrato="{ item }">
                <v-chip size="x-small" variant="tonal" :color="item.tipo_contrato === 'planilla' ? 'primary' : 'grey'">
                  {{ item.tipo_contrato === 'planilla' ? 'Planilla' : 'Honorarios' }}
                </v-chip>
              </template>
              <template v-slot:item.devengados="{ item }">
                {{ item.saldo.aplica ? item.saldo.dias_devengados : '—' }}
              </template>
              <template v-slot:item.tomados="{ item }">
                {{ item.saldo.aplica ? item.saldo.dias_tomados : '—' }}
              </template>
              <template v-slot:item.disponibles="{ item }">
                <strong v-if="item.saldo.aplica" :style="{ color: item.saldo.dias_disponibles > 0 ? '#2e9e5b' : '#e2564a' }">
                  {{ item.saldo.dias_disponibles }}
                </strong>
                <span v-else style="opacity:.4">—</span>
              </template>
              <template v-slot:item.antiguedad="{ item }">
                {{ item.saldo.aplica ? antiguedadTexto(item.saldo.antiguedad_dias) : '—' }}
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="puedeEditar && item.tipo_contrato === 'planilla'" icon="mdi-tune"
                  size="x-small" variant="text" title="Ajustar saldo" @click="abrirAjuste(item)" />
              </template>
            </v-data-table>
          </v-card>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Solicitudes</span>
            </v-card-title>
            <v-data-table :headers="headersSolicitudes" :items="solicitudes" class="elevation-0"
              no-data-text="Sin solicitudes" :items-per-page="25">
              <template v-slot:item.rango="{ item }">
                {{ fechaCorta(item.fecha_inicio) }} → {{ fechaCorta(item.fecha_fin) }}
              </template>
              <template v-slot:item.estado="{ item }">
                <v-chip size="x-small" variant="flat" :color="colorSolicitud(item.estado)">{{ item.estado }}</v-chip>
              </template>
              <template v-slot:item.acciones="{ item }">
                <template v-if="item.estado === 'pendiente' && puedeEditar">
                  <v-btn size="x-small" color="success" variant="tonal" class="mr-1"
                    :loading="resolviendo === item.id" @click="resolver(item, 'aprobar')">Aprobar</v-btn>
                  <v-btn size="x-small" color="error" variant="text"
                    :loading="resolviendo === item.id" @click="resolver(item, 'rechazar')">Rechazar</v-btn>
                </template>
              </template>
            </v-data-table>
          </v-card>
        </div>

        <!-- ══════════ BOLETAS, HONORARIOS Y AFP (solo Administrador) ══════════ -->
        <div v-else-if="tab === 'planilla' && esAdmin">
          <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
            <b>Visibilidad restringida:</b> boletas, recibos por honorarios y descargo AFP solo los ve
            y genera un Administrador. Las tasas usadas son de referencia — <b>Piola aún debe enviar sus
            modelos reales</b> de boleta y de formato AFP para recrearlos como plantilla exacta.
          </v-alert>

          <v-card flat class="custom-data-table" style="padding:18px;">
            <!-- Doble función pedida el 31/08: planilla y honorarios en el mismo módulo -->
            <div class="tipo-switch">
              <button :class="['tipo-op', { activo: tipoDoc === 'planilla' }]" @click="cambiarTipo('planilla')">
                <v-icon icon="mdi-file-document-outline" size="16" /> Boleta de planilla
              </button>
              <button :class="['tipo-op', { activo: tipoDoc === 'honorarios' }]" @click="cambiarTipo('honorarios')">
                <v-icon icon="mdi-receipt-text-outline" size="16" /> Recibo por honorarios
              </button>
            </div>
            <p class="tipo-ayuda">{{ ayudaTipo }}</p>

            <div class="planilla-form">
              <v-select v-model="periodoPlanilla" :items="periodos" label="Periodo" density="compact"
                hide-details variant="outlined" />
              <v-select v-model="colaboradorBoleta" :items="opcionesColaborador"
                :label="esRxh ? 'Prestador del servicio' : 'Colaborador'"
                density="compact" hide-details variant="outlined" :clearable="!esRxh"
                :hint="esRxh ? 'Obligatorio: el monto es de cada recibo' : 'Vacío = todos los de planilla'"
                persistent-hint
                no-data-text="No hay fichas con este tipo de contrato" />

              <!-- ── Planilla: AFP, EsSalud, asignación familiar y días trabajados ── -->
              <template v-if="!esRxh">
                <v-text-field v-model.number="ajustesBoleta.dias_trabajados" type="number" label="Días trabajados"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="ajustesBoleta.otros_ingresos" type="number" label="Otros ingresos (S/)"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="ajustesBoleta.descuento_renta" type="number" label="Renta 5.ª (S/)"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="ajustesBoleta.otros_descuentos" type="number" label="Otros descuentos (S/)"
                  density="compact" hide-details variant="outlined" />
              </template>

              <!-- ── Honorarios: nada de AFP ni EsSalud; sí retención de 4.ª ── -->
              <template v-else>
                <v-text-field v-model.number="recibo.monto_bruto" type="number" label="Monto del recibo (S/)"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model="recibo.rxh_numero" label="N.º de recibo (SUNAT)" placeholder="E001-123"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="recibo.retencion_pct" type="number" label="Retención 4.ª (%)"
                  :disabled="recibo.retencion_suspendida" density="compact" hide-details variant="outlined" />
                <v-text-field v-model.number="recibo.otros_descuentos" type="number" label="Otros descuentos (S/)"
                  density="compact" hide-details variant="outlined" />
                <v-text-field v-model="recibo.pagado_at" type="date" label="Fecha de pago"
                  density="compact" hide-details variant="outlined" />
                <v-switch v-model="recibo.retencion_suspendida" color="primary" density="compact" hide-details
                  label="Suspensión de retención vigente (0 %)" />
              </template>
            </div>

            <!-- Cuentas del recibo a la vista: es lo que se le transfiere -->
            <div v-if="esRxh" class="resumen-rxh">
              <div><span>Importe del recibo</span><strong>{{ PEN(totalesRxh.total) }}</strong></div>
              <div>
                <span>{{ recibo.retencion_suspendida ? 'Retención 4.ª (suspendida)' : `Retención 4.ª (${recibo.retencion_pct || 0} %)` }}</span>
                <strong>− {{ PEN(totalesRxh.retencion) }}</strong>
              </div>
              <div v-if="recibo.otros_descuentos"><span>Otros descuentos</span><strong>− {{ PEN(recibo.otros_descuentos) }}</strong></div>
              <div class="neto"><span>Neto a transferir</span><strong>{{ PEN(totalesRxh.neto) }}</strong></div>
            </div>

            <!-- Voucher: lo que Edson pidió guardar de cada RxH -->
            <div v-if="esRxh" class="voucher-zona">
              <div v-if="voucherPath" class="voucher-actual">
                <v-icon icon="mdi-paperclip" size="18" />
                <span class="voucher-nombre" :title="voucherPath">{{ nombreArchivo(voucherPath) }}</span>
                <v-spacer />
                <v-btn size="x-small" variant="text" icon="mdi-eye" title="Ver el voucher"
                  @click="abrirVisor(voucherPath, 'Voucher del pago')" />
                <v-btn size="x-small" variant="text" icon="mdi-close" color="error" title="Quitar"
                  @click="voucherPath = ''" />
              </div>
              <v-file-input v-else label="Voucher del pago (PDF o imagen)"
                accept="application/pdf,image/*" prepend-icon="" prepend-inner-icon="mdi-paperclip"
                density="compact" variant="outlined" hide-details="auto" show-size clearable
                :loading="subiendoVoucher" :disabled="subiendoVoucher"
                @update:model-value="(v: any) => subirVoucher(v).then(p => { if (p) voucherPath = p })" />
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">
              <v-btn color="primary" variant="flat" :loading="generandoBoletas" @click="generarDocumentos(false)">
                <v-icon :icon="esRxh ? 'mdi-receipt-text-plus' : 'mdi-file-document-multiple'" start />
                {{ esRxh ? 'Registrar recibo' : 'Generar boletas' }}
              </v-btn>
              <v-btn color="primary" variant="tonal" :loading="generandoBoletas" @click="generarDocumentos(true)">
                <v-icon icon="mdi-email-fast" start />
                {{ esRxh ? 'Registrar y enviar por correo' : 'Generar y enviar por correo' }}
              </v-btn>
              <v-btn variant="tonal" :loading="generandoAfp" @click="generarAfp">
                <v-icon icon="mdi-bank" start /> Generar descargo AFP
              </v-btn>
              <v-chip v-if="fechaLimitePago" size="small" variant="tonal" color="info">
                Pago hasta el {{ fechaCorta(fechaLimitePago) }} (2.º día hábil)
              </v-chip>
            </div>
          </v-card>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Pagos al equipo</span>
              <v-spacer />
              <div class="tipo-switch chico">
                <button v-for="f in filtrosTipo" :key="f.value"
                  :class="['tipo-op', { activo: filtroTipo === f.value }]"
                  @click="filtroTipo = f.value; cargarBoletas()">{{ f.title }}</button>
              </div>
              <v-text-field v-model="buscarBoleta" prepend-inner-icon="mdi-magnify"
                placeholder="Nombre o código…" density="compact" hide-details variant="outlined"
                clearable style="max-width:260px;" @update:model-value="cargarBoletas" />
            </v-card-title>
            <v-data-table :headers="headersBoletas" :items="boletas" class="elevation-0"
              no-data-text="Todavía no se han generado documentos de pago" :items-per-page="25">
              <template v-slot:item.tipo="{ item }">
                <span class="estado-chip" :class="esHonorarios(item) ? 't-honorarios' : 't-planilla'">
                  {{ esHonorarios(item) ? 'Honorarios' : 'Planilla' }}
                </span>
              </template>
              <template v-slot:item.codigo="{ item }">
                <div style="line-height:1.35">
                  <div>{{ item.codigo }}</div>
                  <div v-if="esHonorarios(item)" style="font-size:11px; opacity:.6">
                    RxH {{ item.rxh_numero || 'sin n.º' }}
                  </div>
                </div>
              </template>
              <template v-slot:item.total_ingresos="{ item }">{{ PEN(item.total_ingresos) }}</template>
              <template v-slot:item.total_descuentos="{ item }">
                {{ PEN(item.total_descuentos) }}
                <div v-if="esHonorarios(item) && Number(item.rxh_retencion) > 0" style="font-size:11px; opacity:.6">
                  retención {{ PEN(item.rxh_retencion) }}
                </div>
              </template>
              <template v-slot:item.neto="{ item }"><strong>{{ PEN(item.neto) }}</strong></template>
              <template v-slot:item.pago="{ item }">
                <v-btn v-if="item.voucher_url" size="x-small" variant="text" color="success"
                  prepend-icon="mdi-check-circle"
                  :title="item.pagado_at ? 'Pagado el ' + fechaCorta(item.pagado_at) : 'Voucher adjunto'"
                  @click="abrirVisor(item.voucher_url, `Voucher — ${item.colaborador_nombre}`)">
                  {{ item.pagado_at ? fechaCorta(item.pagado_at) : 'Ver' }}
                </v-btn>
                <v-btn v-else size="x-small" variant="text" prepend-icon="mdi-upload"
                  title="Adjuntar el voucher del pago" @click="abrirVoucher(item)">Adjuntar</v-btn>
              </template>
              <template v-slot:item.enviado_at="{ item }">
                <v-icon v-if="item.enviado_at" icon="mdi-check-circle" color="success" size="16"
                  :title="'Enviada el ' + fechaHora(item.enviado_at)" />
                <span v-else style="opacity:.4">—</span>
              </template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="item.pdf_url" icon="mdi-file-eye" size="x-small" variant="text"
                  title="Ver aquí mismo"
                  @click="abrirVisor(item.pdf_url, `${esHonorarios(item) ? 'Honorarios' : 'Boleta'} ${item.periodo} — ${item.colaborador_nombre}`)" />
                <v-btn v-if="item.pdf_url" icon="mdi-download" size="x-small" variant="text"
                  title="Descargar" :href="urlDoc(item.pdf_url)" :download="item.codigo" />
                <v-btn icon="mdi-cash-check" size="x-small" variant="text" title="Registrar el pago"
                  @click="abrirVoucher(item)" />
                <v-btn icon="mdi-email-fast" size="x-small" variant="text" title="Enviar por correo"
                  :loading="enviandoBoleta === item.id" @click="enviarBoleta(item)" />
              </template>
            </v-data-table>
          </v-card>

          <v-card flat class="custom-data-table mt-4">
            <v-card-title class="table-search-bar">
              <span class="table-title">Descargos AFP</span>
            </v-card-title>
            <v-data-table :headers="headersAfp" :items="reportesAfp" class="elevation-0"
              no-data-text="Sin descargos generados" :items-per-page="12">
              <template v-slot:item.total_afecto="{ item }">{{ PEN(item.total_afecto) }}</template>
              <template v-slot:item.total_aportes="{ item }"><strong>{{ PEN(item.total_aportes) }}</strong></template>
              <template v-slot:item.colaboradores="{ item }">{{ (item.detalle || []).length }}</template>
              <template v-slot:item.acciones="{ item }">
                <v-btn v-if="item.pdf_url" icon="mdi-file-eye" size="x-small" variant="text"
                  title="Ver aquí mismo"
                  @click="abrirVisor(item.pdf_url, `Descargo AFP ${item.periodo}`)" />
                <v-btn v-if="item.pdf_url" icon="mdi-download" size="x-small" variant="text"
                  title="Descargar" :href="urlDoc(item.pdf_url)" :download="`afp-${item.periodo}`" />
              </template>
            </v-data-table>
          </v-card>
        </div>
      </div>
    </div>

    <!-- ══════════ CORRECCIÓN DE MARCACIÓN ══════════ -->
    <v-dialog :model-value="!!correccion" max-width="560" @update:model-value="correccion = null">
      <v-card v-if="correccion">
        <v-card-title class="pt-4">Corregir marcación</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Toda corrección queda auditada: se guarda qué cambió, quién lo cambió y cuándo.
          </v-alert>
          <div class="form-grid">
            <v-text-field :model-value="correccion.email" label="Colaborador" density="compact"
              hide-details variant="outlined" readonly />
            <v-text-field v-model="correccion.fecha" type="date" label="Fecha" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="correccion.check_in" type="time" label="Entrada (hora Lima)"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="correccion.check_out" type="time" label="Salida (hora Lima)"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="correccion.break_minutes" type="number" label="Minutos de break"
              density="compact" hide-details variant="outlined" />
            <v-select v-model="correccion.estado" :items="['completo', 'incompleto', 'falta', 'feriado', 'vacaciones', 'licencia']"
              label="Estado" density="compact" hide-details variant="outlined" />
          </div>
          <v-text-field v-model="correccion.motivo" label="Motivo de la corrección" density="compact"
            hide-details variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="correccion = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoCorreccion" @click="guardarCorreccion">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ AJUSTE DE VACACIONES ══════════ -->
    <v-dialog :model-value="!!ajuste" max-width="480" @update:model-value="ajuste = null">
      <v-card v-if="ajuste">
        <v-card-title class="pt-4">Ajustar saldo — {{ ajuste.nombre }}</v-card-title>
        <v-card-text>
          <v-text-field v-model.number="ajuste.dias" type="number" label="Días (+ suma / − resta)"
            density="compact" hide-details variant="outlined" />
          <v-text-field v-model="ajuste.motivo" label="Motivo" density="compact" hide-details
            variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="ajuste = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoAjuste" @click="guardarAjuste">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ VOUCHER DEL PAGO ══════════ -->
    <v-dialog :model-value="!!voucherDlg" max-width="540" @update:model-value="voucherDlg = null">
      <v-card v-if="voucherDlg">
        <v-card-title class="pt-4">Registrar el pago — {{ voucherDlg.colaborador_nombre }}</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            El comprobante válido ante la SUNAT lo emite el prestador. Acá se guarda
            <b>el voucher de la transferencia</b> y el n.º de su recibo.
          </v-alert>

          <div class="form-grid">
            <v-text-field v-model="voucherDlg.rxh_numero" label="N.º de recibo (SUNAT)"
              placeholder="E001-123" density="compact" hide-details variant="outlined"
              :disabled="!esHonorarios(voucherDlg)" />
            <v-text-field v-model="voucherDlg.pagado_at" type="date" label="Fecha de pago"
              density="compact" hide-details variant="outlined" />
          </div>

          <div class="voucher-zona mt-3">
            <div v-if="voucherDlg.voucher_url" class="voucher-actual">
              <v-icon icon="mdi-paperclip" size="18" />
              <span class="voucher-nombre" :title="voucherDlg.voucher_url">
                {{ nombreArchivo(voucherDlg.voucher_url) }}
              </span>
              <v-spacer />
              <v-btn size="x-small" variant="text" icon="mdi-eye" title="Ver el voucher"
                @click="abrirVisor(voucherDlg.voucher_url, 'Voucher del pago')" />
              <v-btn size="x-small" variant="text" icon="mdi-close" color="error" title="Quitar"
                @click="voucherDlg.voucher_url = ''" />
            </div>
            <v-file-input v-else label="Voucher del pago (PDF o imagen)"
              accept="application/pdf,image/*" prepend-icon="" prepend-inner-icon="mdi-paperclip"
              density="compact" variant="outlined" hide-details="auto" show-size clearable
              :loading="subiendoVoucher" :disabled="subiendoVoucher"
              @update:model-value="(v: any) => subirVoucher(v).then(p => { if (p && voucherDlg) voucherDlg.voucher_url = p })" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="voucherDlg = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardandoVoucher" @click="guardarVoucher">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PiolaVisorPdf v-model="visor.abierto" :src="visor.src" :titulo="visor.titulo" />
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo RR. HH. (§7) — el más detallado del levantamiento.
 *
 *   7.1 Tareo: tablero en vivo (quién está en jornada / en break), reporte
 *       mensual exportable y corrección manual CON auditoría.
 *   7.2 Vacaciones: saldos devengados (1.25 días/mes, solo planilla) y
 *       aprobación de solicitudes; al aprobar se marcan en el tareo.
 *   7.5 Boletas y AFP: SOLO Administrador. Se generan desde un formulario
 *       corto y salen listas para enviar por correo.
 *
 * Todo pasa por endpoints del servidor: la hora del tareo es la del servidor
 * (no la del cliente) y las tablas de planilla no son legibles desde el navegador.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import {
  PEN, fechaCorta, fechaHora, horaLima, minutosAHoras, periodoActual, ultimosPeriodos, hoyISO,
  urlDocumento,
} from '@/composables/usePiola'
import PiolaVisorPdf from './PiolaVisorPdf.vue'
import PiolaExpediente from './PiolaExpediente.vue'

const props = defineProps<{ perfil: any }>()
const emit = defineEmits<{ (e: 'notify', payload: any): void }>()

const client = useSupabaseClient()
const esAdmin = computed(() => props.perfil?.es_admin === true)

/* ── Visor embebido: los documentos se abren DENTRO del dashboard (19/08) ── */
const visor = ref<{ abierto: boolean; src: string; titulo: string }>({
  abierto: false, src: '', titulo: '',
})
const urlDoc = (path: any) => urlDocumento(client, path)
function abrirVisor(path: any, titulo: string) {
  visor.value = { abierto: true, src: urlDoc(path), titulo }
}

const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'rrhh', 'edit'))

const tab = ref('tablero')
const periodos = ultimosPeriodos(18)

/* ══════════ Tareo ══════════ */
const tablero = ref<any>({})
const mes = ref<any>({})
const desde = ref(`${periodoActual()}-01`)
const hasta = ref(hoyISO())

async function cargarTablero() {
  try { tablero.value = await $fetch<any>('/api/piola/tareo', { params: { vista: 'tablero' } }) }
  catch (e: any) { emit('notify', { text: e?.data?.statusMessage || 'Error cargando el tareo', color: 'error' }) }
}

async function cargarMes() {
  try {
    mes.value = await $fetch<any>('/api/piola/tareo', {
      params: { vista: 'mes', desde: desde.value, hasta: hasta.value },
    })
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error cargando el reporte', color: 'error' })
  }
}

const textoEstado = (e: string) => ({
  en_jornada: 'En jornada', en_break: 'En break',
  jornada_cerrada: 'Cerrada', sin_marcar: 'Sin marcar',
}[e] || e)

const headersTablero = [
  { title: 'Colaborador', key: 'nombre' },
  { title: 'Cargo', key: 'cargo' },
  { title: 'Estado', key: 'estado' },
  { title: 'Entrada', key: 'check_in' },
  { title: 'Salida', key: 'check_out' },
  { title: 'Break', key: 'break_minutes' },
  { title: 'Efectivas', key: 'worked_minutes' },
  { title: '', key: 'acciones', sortable: false },
]
const headersResumen = [
  { title: 'Colaborador', key: 'email' },
  { title: 'Días trabajados', key: 'dias' },
  { title: 'Horas', key: 'horas' },
  { title: 'Faltas', key: 'faltas' },
  { title: 'Incompletos', key: 'incompletos' },
]
const headersRegistros = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Colaborador', key: 'colaborador_email' },
  { title: 'Entrada', key: 'check_in' },
  { title: 'Salida', key: 'check_out' },
  { title: 'Efectivas', key: 'worked_minutes' },
  { title: 'Estado', key: 'estado' },
  { title: 'Editado', key: 'editado_por' },
  { title: '', key: 'acciones', sortable: false },
]

function exportarCSV() {
  const filas = mes.value.registros || []
  if (!filas.length) return emit('notify', { text: 'No hay datos para exportar', color: 'warning' })

  const cabecera = ['Fecha', 'Colaborador', 'Entrada', 'Salida', 'Break (min)', 'Efectivas (min)', 'Estado', 'Editado por']
  const csv = [
    cabecera.join(','),
    ...filas.map((r: any) => [
      r.fecha, r.colaborador_email, horaLima(r.check_in), horaLima(r.check_out),
      r.break_minutes || 0, r.worked_minutes || 0, r.estado, r.editado_por || '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `tareo-piola-${desde.value}_${hasta.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ══════════ Corrección de marcación ══════════ */
const correccion = ref<any>(null)
const guardandoCorreccion = ref(false)

function abrirCorreccion(fila: any) {
  correccion.value = {
    email: fila.email || fila.colaborador_email,
    fecha: String(fila.fecha || tablero.value.fecha || hoyISO()).slice(0, 10),
    check_in: fila.check_in ? horaLima(fila.check_in) : '',
    check_out: fila.check_out ? horaLima(fila.check_out) : '',
    break_minutes: fila.break_minutes || 0,
    estado: fila.estado && !['en_jornada', 'en_break', 'jornada_cerrada', 'sin_marcar'].includes(fila.estado)
      ? fila.estado : 'completo',
    motivo: '',
  }
}

async function guardarCorreccion() {
  const c = correccion.value
  guardandoCorreccion.value = true
  try {
    await $fetch('/api/piola/tareo-correccion', {
      method: 'POST',
      body: {
        colaborador_email: c.email, fecha: c.fecha,
        check_in: c.check_in || null, check_out: c.check_out || null,
        break_minutes: c.break_minutes, estado: c.estado, motivo: c.motivo,
      },
    })
    emit('notify', 'Marcación corregida (queda registrada en la auditoría)')
    correccion.value = null
    await Promise.all([cargarTablero(), cargarMes()])
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error corrigiendo', color: 'error' })
  } finally {
    guardandoCorreccion.value = false
  }
}

/* ══════════ Vacaciones ══════════ */
const saldos = ref<any[]>([])
const solicitudes = ref<any[]>([])
const resolviendo = ref<number | null>(null)

const pendientesVac = computed(() => solicitudes.value.filter(s => s.estado === 'pendiente').length)

async function cargarVacaciones() {
  try {
    const res = await $fetch<any>('/api/piola/vacaciones', { params: { vista: 'equipo' } })
    saldos.value = res.saldos || []
    solicitudes.value = res.solicitudes || []
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error cargando vacaciones', color: 'error' })
  }
}

const antiguedadTexto = (dias: number) => {
  const anios = Math.floor(dias / 365)
  const meses = Math.floor((dias % 365) / 30)
  if (anios) return `${anios}a ${meses}m`
  return `${meses}m`
}
const colorSolicitud = (e: string) => ({
  pendiente: 'warning', aprobada: 'success', rechazada: 'error', cancelada: 'grey',
}[e] || 'grey')

const headersSaldos = [
  { title: 'Colaborador', key: 'nombre' },
  { title: 'Contrato', key: 'tipo_contrato' },
  { title: 'Antigüedad', key: 'antiguedad', sortable: false },
  { title: 'Devengados', key: 'devengados', sortable: false },
  { title: 'Tomados', key: 'tomados', sortable: false },
  { title: 'Disponibles', key: 'disponibles', sortable: false },
  { title: '', key: 'acciones', sortable: false },
]
const headersSolicitudes = [
  { title: 'Colaborador', key: 'colaborador_email' },
  { title: 'Rango', key: 'rango', sortable: false },
  { title: 'Días', key: 'dias' },
  { title: 'Motivo', key: 'motivo' },
  { title: 'Estado', key: 'estado' },
  { title: '', key: 'acciones', sortable: false },
]

async function resolver(item: any, accion: 'aprobar' | 'rechazar') {
  resolviendo.value = item.id
  try {
    const res = await $fetch<any>('/api/piola/vacaciones', {
      method: 'POST', body: { accion, id: item.id },
    })
    emit('notify', accion === 'aprobar'
      ? `Vacaciones aprobadas — ${res.dias_marcados_en_tareo} día(s) marcados en el tareo`
      : 'Solicitud rechazada')
    await cargarVacaciones()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error', color: 'error' })
  } finally {
    resolviendo.value = null
  }
}

const ajuste = ref<any>(null)
const guardandoAjuste = ref(false)

function abrirAjuste(item: any) {
  ajuste.value = { email: item.email, nombre: item.nombre, dias: 0, motivo: '' }
}

async function guardarAjuste() {
  guardandoAjuste.value = true
  try {
    await $fetch('/api/piola/vacaciones', {
      method: 'POST',
      body: {
        accion: 'ajustar', colaborador_email: ajuste.value.email,
        dias: ajuste.value.dias, motivo: ajuste.value.motivo,
      },
    })
    emit('notify', 'Saldo ajustado')
    ajuste.value = null
    await cargarVacaciones()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error', color: 'error' })
  } finally {
    guardandoAjuste.value = false
  }
}

/* ══════════ Pagos al equipo: boletas de planilla y recibos por honorarios ══════════
 *
 * Doble función pedida en la reunión del 31/08 (Edson: "también para asignar y
 * poner los vouchers de los pagos de los recibos por honorarios"). Los dos tipos
 * comparten tabla y pantalla, pero NO comparten campos: un recibo por honorarios
 * no tiene AFP, ni EsSalud, ni asignación familiar, ni días trabajados. Esos
 * campos se OCULTAN, no se muestran en cero, porque un cero afirma que se
 * calcularon y dieron cero.
 */
const periodoPlanilla = ref(periodoActual())
const colaboradorBoleta = ref<string | null>(null)
const tipoDoc = ref<'planilla' | 'honorarios'>('planilla')
const esRxh = computed(() => tipoDoc.value === 'honorarios')

const ajustesBoleta = ref<any>({ dias_trabajados: 30, otros_ingresos: 0, descuento_renta: 0, otros_descuentos: 0 })
/** Retención de 4.ª categoría: 8 % es la tasa SUNAT; 0 con constancia de suspensión. */
const recibo = ref<any>({
  monto_bruto: 0, rxh_numero: '', retencion_pct: 8,
  retencion_suspendida: false, otros_descuentos: 0, pagado_at: '',
})
const voucherPath = ref('')

const opcionesPlanilla = ref<any[]>([])
const opcionesHonorarios = ref<any[]>([])
const opcionesColaborador = computed(() => esRxh.value ? opcionesHonorarios.value : opcionesPlanilla.value)

const ayudaTipo = computed(() => esRxh.value
  ? 'Sin AFP, EsSalud ni asignación familiar. Solo retención de renta de 4.ª categoría y el voucher del pago. La lista muestra las fichas con contrato de honorarios.'
  : 'Con AFP/ONP, aporte de EsSalud del empleador, asignación familiar y días trabajados. La lista muestra las fichas en planilla.')

/** Mismo cálculo que hace el servidor, para que el admin vea el neto antes de emitir. */
const totalesRxh = computed(() => {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const total = r2(Number(recibo.value.monto_bruto) || 0)
  const pct = recibo.value.retencion_suspendida ? 0 : (Number(recibo.value.retencion_pct) || 0)
  const retencion = r2(total * pct / 100)
  const otros = r2(Number(recibo.value.otros_descuentos) || 0)
  return { total, retencion, neto: r2(total - retencion - otros) }
})

const boletas = ref<any[]>([])
const reportesAfp = ref<any[]>([])
const buscarBoleta = ref('')
const filtroTipo = ref<'todos' | 'planilla' | 'honorarios'>('todos')
const filtrosTipo = [
  { value: 'todos', title: 'Todos' },
  { value: 'planilla', title: 'Planilla' },
  { value: 'honorarios', title: 'Honorarios' },
]
const generandoBoletas = ref(false)
const generandoAfp = ref(false)
const enviandoBoleta = ref<number | null>(null)
const fechaLimitePago = ref<string | null>(null)

/** Las filas de antes de la migración no tienen `tipo`: son todas de planilla. */
const esHonorarios = (b: any) => b?.tipo === 'honorarios'

function cambiarTipo(t: 'planilla' | 'honorarios') {
  if (tipoDoc.value === t) return
  tipoDoc.value = t
  // Las listas de colaboradores no se cruzan: el email elegido para planilla no
  // existe en honorarios y quedaría enviando un email fantasma al servidor.
  colaboradorBoleta.value = null
  voucherPath.value = ''
  fechaLimitePago.value = null
}

async function cargarPlanilla() {
  const { data } = await client.from('piola_colaboradores')
    .select('email, nombre, tipo_contrato').eq('activo', true).order('nombre')
  const filas = (data as any[]) || []
  const aOpcion = (c: any) => ({ value: c.email, title: c.nombre })
  opcionesPlanilla.value = filas.filter(c => c.tipo_contrato === 'planilla').map(aOpcion)
  opcionesHonorarios.value = filas.filter(c => c.tipo_contrato === 'honorarios').map(aOpcion)
  await Promise.all([cargarBoletas(), cargarAfp()])
}

async function cargarBoletas() {
  try {
    const res = await $fetch<any>('/api/piola/boletas', {
      params: {
        vista: 'todas',
        tipo: filtroTipo.value === 'todos' ? undefined : filtroTipo.value,
        q: buscarBoleta.value || undefined,
      },
    })
    boletas.value = res.boletas || []
  } catch { boletas.value = [] }
}

async function cargarAfp() {
  try {
    const res = await $fetch<any>('/api/piola/afp')
    reportesAfp.value = res.reportes || []
  } catch { reportesAfp.value = [] }
}

async function generarDocumentos(enviar: boolean) {
  // Un recibo por honorarios es individual: el monto y el n.º de recibo son de
  // esa persona. Emitir "para todos" repartiría el mismo importe entre gente
  // que cobró cosas distintas.
  if (esRxh.value && !colaboradorBoleta.value) {
    return emit('notify', { text: 'Elige al prestador del servicio: el recibo por honorarios se emite uno por uno', color: 'warning' })
  }
  if (esRxh.value && !(Number(recibo.value.monto_bruto) > 0)) {
    return emit('notify', { text: 'Falta el monto del recibo', color: 'warning' })
  }

  generandoBoletas.value = true
  try {
    const ajustes: any = {}
    if (colaboradorBoleta.value) {
      ajustes[colaboradorBoleta.value] = esRxh.value
        ? { ...recibo.value, voucher_url: voucherPath.value || undefined }
        : { ...ajustesBoleta.value }
    }

    const { data: res, error } = await apiPiola<any>('boletas', {
      accion: 'generar',
      tipo: tipoDoc.value,
      periodo: periodoPlanilla.value,
      colaborador_email: colaboradorBoleta.value || undefined,
      ajustes,
      enviar,
    })
    if (error) return emit('notify', { text: error.message, color: 'error' })

    fechaLimitePago.value = res.fecha_limite_pago
    const que = esRxh.value ? 'recibo(s) por honorarios' : 'boleta(s)'
    emit('notify', res.errores?.length
      ? { text: `${res.generadas} ${que} generados, con ${res.errores.length} error(es): ${res.errores[0]?.error}`, color: 'warning' }
      : `${res.generadas} ${que} generados${enviar ? ' y enviados' : ''}`)
    await cargarBoletas()
  } finally {
    generandoBoletas.value = false
  }
}

/* ══════════ Voucher del pago ══════════ */
const voucherDlg = ref<any>(null)
const subiendoVoucher = ref(false)
const guardandoVoucher = ref(false)

const nombreArchivo = (p: any) =>
  decodeURIComponent(String(p || '').split('/').pop() || 'archivo')

/**
 * Sube el voucher al bucket `piola-docs` y devuelve su PATH (no la URL pública):
 * si mañana el bucket pasa a privado no hay que migrar ni una fila. Mismo patrón
 * que PiolaSubirPdf, pero aceptando imágenes: un voucher de Yape o de una
 * transferencia casi siempre es una captura, no un PDF.
 */
async function subirVoucher(valor: any): Promise<string | null> {
  const file: File | null = Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null)
  if (!file) return null

  if (file.size > 10 * 1024 * 1024) {
    emit('notify', { text: `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 10 MB`, color: 'warning' })
    return null
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  const ruta = `vouchers/${periodoPlanilla.value}/voucher-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  subiendoVoucher.value = true
  const { error } = await client.storage.from('piola-docs')
    .upload(ruta, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  subiendoVoucher.value = false

  if (error) {
    emit('notify', { text: `No se pudo subir el voucher: ${error.message}`, color: 'error' })
    return null
  }
  return ruta
}

function abrirVoucher(item: any) {
  voucherDlg.value = {
    id: item.id,
    tipo: item.tipo,
    colaborador_nombre: item.colaborador_nombre,
    rxh_numero: item.rxh_numero || '',
    pagado_at: String(item.pagado_at || '').slice(0, 10),
    voucher_url: item.voucher_url || '',
  }
}

async function guardarVoucher() {
  const v = voucherDlg.value
  guardandoVoucher.value = true
  try {
    const { error } = await apiPiola('boletas', {
      accion: 'voucher',
      id: v.id,
      // Vacío = se desvincula el voucher; el archivo se queda en el bucket.
      quitar: !v.voucher_url,
      voucher_url: v.voucher_url || null,
      rxh_numero: v.rxh_numero || null,
      pagado_at: v.pagado_at || null,
    })
    if (error) return emit('notify', { text: error.message, color: 'error' })
    emit('notify', 'Pago registrado')
    voucherDlg.value = null
    await cargarBoletas()
  } finally {
    guardandoVoucher.value = false
  }
}

async function enviarBoleta(item: any) {
  enviandoBoleta.value = item.id
  try {
    const res = await $fetch<any>('/api/piola/boletas', { method: 'POST', body: { accion: 'enviar', id: item.id } })
    emit('notify', `Boleta enviada a ${res.enviado_a}`)
    await cargarBoletas()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error enviando', color: 'error' })
  } finally {
    enviandoBoleta.value = null
  }
}

async function generarAfp() {
  generandoAfp.value = true
  try {
    const res = await $fetch<any>('/api/piola/afp', {
      method: 'POST', body: { periodo: periodoPlanilla.value },
    })
    emit('notify', { text: `Descargo AFP de ${periodoPlanilla.value}: ${res.colaboradores} colaborador(es), ${PEN(res.total_aportes)}. ${res.aviso}`, color: 'info' })
    await cargarAfp()
  } catch (e: any) {
    emit('notify', { text: e?.data?.statusMessage || 'Error generando el descargo AFP', color: 'error' })
  } finally {
    generandoAfp.value = false
  }
}

const headersBoletas = [
  { title: 'Tipo', key: 'tipo' },
  { title: 'Código', key: 'codigo' },
  { title: 'Colaborador', key: 'colaborador_nombre' },
  { title: 'Periodo', key: 'periodo' },
  { title: 'Ingresos', key: 'total_ingresos' },
  { title: 'Descuentos', key: 'total_descuentos' },
  { title: 'Neto', key: 'neto' },
  { title: 'Pago', key: 'pago', sortable: false },
  { title: 'Enviada', key: 'enviado_at' },
  { title: '', key: 'acciones', sortable: false },
]
const headersAfp = [
  { title: 'Periodo', key: 'periodo' },
  { title: 'Colaboradores', key: 'colaboradores', sortable: false },
  { title: 'Base afecta', key: 'total_afecto' },
  { title: 'Total aportes', key: 'total_aportes' },
  { title: '', key: 'acciones', sortable: false },
]

/* ══════════ Carga inicial ══════════ */
async function cargarTodo() {
  await Promise.all([
    cargarTablero(),
    cargarMes(),
    cargarVacaciones(),
    esAdmin.value ? cargarPlanilla() : Promise.resolve(),
  ])
}

onMounted(cargarTodo)
</script>

<style scoped>
.filtros-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.filtros-bar .filtro { flex: 1 1 160px; max-width: 210px; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.planilla-form { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

.estado-chip {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 600; white-space: nowrap;
}

/* Boleta de planilla vs. recibo por honorarios (reunión 31/08/2026).
   Edson pidió "doble función" en el mismo módulo, así que la lista mezcla los
   dos: sin color no se distingue de un vistazo cuál es cuál. */
.t-planilla { background: rgba(91, 141, 239, .16); color: #5b8def; }
.t-honorarios { background: rgba(139, 92, 246, .16); color: #8b5cf6; }
.e-en_jornada, .s-completo { background: rgba(46, 158, 91, .14); color: #2e9e5b; }
.e-en_break { background: rgba(242, 166, 59, .16); color: #d98324; }
.e-jornada_cerrada { background: rgba(91, 141, 239, .14); color: #5b8def; }
.e-sin_marcar, .s-falta { background: rgba(226, 86, 74, .13); color: #e2564a; }
.s-incompleto { background: rgba(242, 166, 59, .16); color: #d98324; }
.s-vacaciones { background: rgba(139, 92, 246, .14); color: #8b5cf6; }
.s-feriado, .s-licencia { background: rgba(128, 128, 128, .16); color: #888; }

@media (max-width: 900px) {
  .form-grid, .planilla-form { grid-template-columns: 1fr; }
}
</style>
