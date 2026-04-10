<template>
  <div class="facturacion-pse">

    <!-- ── ENCABEZADO ── -->
    <header class="top-header">
      <h1>Facturación Electrónica</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <v-chip color="success" size="small" prepend-icon="mdi-check-circle">Conectado a SUNAT vía PSE.PE</v-chip>
        <button class="btn-primary" @click="abrirNuevo">
          <v-icon icon="mdi-plus" size="16" />
          <span>Nueva Factura</span>
        </button>
      </div>
    </header>

    <div class="content-area">

      <!-- ── LISTA DE COMPROBANTES ENVIADOS ── -->
      <div class="table-section">
        <v-card flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Comprobantes Emitidos</span>
            <v-spacer />
            <v-text-field v-model="searchComprobantes" append-inner-icon="mdi-magnify"
              label="Buscar" single-line hide-details density="compact"
              variant="outlined" class="search-field" style="max-width:280px" />
          </v-card-title>

          <v-data-table
            :headers="headersComprobantes"
            :items="comprobantes"
            :search="searchComprobantes"
            :loading="loadingComprobantes"
            class="elevation-0"
            no-data-text="No hay comprobantes emitidos aún">

            <template v-slot:item.tipo="{ item }">
              <v-chip :color="item.tipo === 1 ? 'blue' : 'green'" size="small">
                {{ item.tipo === 1 ? 'Factura' : 'Boleta' }}
              </v-chip>
            </template>

            <template v-slot:item.total="{ item }">
              S/ {{ Number(item.total).toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
            </template>

            <template v-slot:item.sunat_ok="{ item }">
              <v-icon :icon="item.sunat_ok ? 'mdi-check-circle' : 'mdi-alert-circle'"
                :color="item.sunat_ok ? 'success' : 'error'" size="20" />
            </template>

            <template v-slot:item.acciones="{ item }">
              <div style="display:flex; gap:4px;">
                <v-btn icon size="x-small" variant="text" color="primary"
                  :href="item.enlace_pdf" target="_blank" :disabled="!item.enlace_pdf">
                  <v-icon icon="mdi-file-pdf-box" size="16" />
                  <v-tooltip activator="parent">Ver PDF</v-tooltip>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="grey"
                  :href="item.enlace_xml" target="_blank" :disabled="!item.enlace_xml">
                  <v-icon icon="mdi-xml" size="16" />
                  <v-tooltip activator="parent">Ver XML</v-tooltip>
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card>
      </div>
    </div>

    <!-- ════════════════════════════════════════════
         DIALOG: NUEVO COMPROBANTE
    ════════════════════════════════════════════ -->
    <v-dialog v-model="showDialog" max-width="900px" persistent scrollable>
      <v-card>
        <v-card-title class="pa-4" style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(0,0,0,.1);">
          <div style="display:flex; align-items:center; gap:10px;">
            <v-icon icon="mdi-file-document-edit" color="primary" />
            <span>Nuevo Comprobante Electrónico</span>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showDialog = false" />
        </v-card-title>

        <v-card-text class="pa-5">
          <v-form ref="formRef">

            <!-- ── TIPO + SERIE + FECHA ── -->
            <div class="pse-section-title">General</div>
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
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
              <v-col cols="12" sm="2">
                <v-text-field
                  v-model.number="form.numero"
                  label="Número *"
                  type="number"
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
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.moneda"
                  :items="monedas"
                  item-title="label"
                  item-value="value"
                  label="Moneda *"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="4" v-if="form.moneda !== 1">
                <v-text-field
                  v-model.number="form.tipo_de_cambio"
                  label="Tipo de Cambio *"
                  type="number"
                  step="0.01"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.sunat_transaction"
                  :items="tiposOperacion"
                  item-title="label"
                  item-value="value"
                  label="Tipo de Operación *"
                  variant="outlined"
                  density="compact" />
              </v-col>
            </v-row>

            <!-- ── DATOS DEL CLIENTE ── -->
            <div class="pse-section-title mt-4">Datos del Cliente</div>
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
                  :label="form.tipo_de_comprobante === 1 ? 'RUC *' : 'DNI / Doc'"
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
                  :rules="[v => !!v || 'Requerido']" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.cliente_direccion"
                  label="Dirección"
                  variant="outlined"
                  density="compact" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.cliente_email"
                  label="Email del Cliente"
                  type="email"
                  variant="outlined"
                  density="compact" />
              </v-col>
            </v-row>

            <!-- ── ITEMS / PRODUCTOS ── -->
            <div class="pse-section-title mt-4" style="display:flex; align-items:center; justify-content:space-between;">
              <span>Productos / Servicios</span>
              <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="agregarItem">
                Agregar Línea
              </v-btn>
            </div>

            <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
              <v-row dense align="center">
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
                  <v-select
                    v-model="item.unidad_de_medida"
                    :items="unidades"
                    label="U.M."
                    variant="outlined"
                    density="compact" />
                </v-col>
                <v-col cols="12" sm="1">
                  <v-text-field
                    v-model.number="item.cantidad"
                    label="Cant. *"
                    type="number"
                    min="1"
                    variant="outlined"
                    density="compact"
                    @input="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="2">
                  <v-text-field
                    v-model.number="item.valor_unitario"
                    label="V. Unit (sin IGV) *"
                    type="number"
                    step="0.01"
                    variant="outlined"
                    density="compact"
                    @input="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="1">
                  <v-select
                    v-model="item.tipo_de_igv"
                    :items="tiposIgv"
                    item-title="label"
                    item-value="value"
                    label="IGV"
                    variant="outlined"
                    density="compact"
                    @update:model-value="calcularItem(idx)" />
                </v-col>
                <v-col cols="12" sm="2">
                  <v-text-field
                    :model-value="'S/ ' + item.total.toFixed(2)"
                    label="Total"
                    variant="outlined"
                    density="compact"
                    readonly
                    bg-color="grey-lighten-4" />
                </v-col>
                <v-col cols="12" sm="1" class="text-center">
                  <v-btn icon size="small" variant="text" color="error" @click="eliminarItem(idx)" :disabled="form.items.length === 1">
                    <v-icon icon="mdi-delete" size="18" />
                  </v-btn>
                </v-col>
              </v-row>
            </div>

            <!-- ── TOTALES ── -->
            <div class="totales-box mt-4">
              <div class="total-row">
                <span>Subtotal Gravado</span>
                <span>S/ {{ totales.gravada.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.exonerada > 0">
                <span>Exonerado</span>
                <span>S/ {{ totales.exonerada.toFixed(2) }}</span>
              </div>
              <div class="total-row" v-if="totales.inafecta > 0">
                <span>Inafecto</span>
                <span>S/ {{ totales.inafecta.toFixed(2) }}</span>
              </div>
              <div class="total-row">
                <span>IGV (18%)</span>
                <span>S/ {{ totales.igv.toFixed(2) }}</span>
              </div>
              <div class="total-row total-final">
                <span>TOTAL</span>
                <span>S/ {{ totales.total.toFixed(2) }}</span>
              </div>
            </div>

            <!-- ── OBSERVACIONES ── -->
            <v-row dense class="mt-2">
              <v-col cols="12">
                <v-textarea
                  v-model="form.observaciones"
                  label="Observaciones"
                  variant="outlined"
                  density="compact"
                  rows="2" />
              </v-col>
            </v-row>

            <!-- ── RESPUESTA SUNAT ── -->
            <v-alert v-if="respuestaSunat" class="mt-4"
              :type="respuestaSunat.aceptada ? 'success' : 'error'"
              :icon="respuestaSunat.aceptada ? 'mdi-check-circle' : 'mdi-alert-circle'"
              border="start" closable @click:close="respuestaSunat = null">
              <div class="font-weight-bold">{{ respuestaSunat.aceptada ? '✅ Aceptada por SUNAT' : '❌ Rechazada por SUNAT' }}</div>
              <div>{{ respuestaSunat.descripcion }}</div>
              <div v-if="respuestaSunat.serie" class="mt-2">
                <strong>{{ respuestaSunat.serie }}-{{ respuestaSunat.numero }}</strong>
                <div v-if="respuestaSunat.enlace_pdf" style="display:flex; gap:8px; margin-top:6px;">
                  <v-btn size="small" color="red" prepend-icon="mdi-file-pdf-box"
                    :href="respuestaSunat.enlace_pdf" target="_blank">PDF</v-btn>
                  <v-btn size="small" color="primary" prepend-icon="mdi-xml"
                    :href="respuestaSunat.enlace_xml" target="_blank">XML</v-btn>
                </div>
              </div>
            </v-alert>

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

/* ─────────── CATÁLOGOS ─────────── */
const tiposComprobante = [
  { value: 1, label: '01 - Factura' },
  { value: 2, label: '03 - Boleta de Venta' },
  { value: 3, label: '07 - Nota de Crédito' },
  { value: 4, label: '08 - Nota de Débito' }
]

const tiposDocCliente = [
  { value: 0, label: '0 - Sin Documento' },
  { value: 1, label: '1 - DNI' },
  { value: 4, label: '4 - Carnet Extranjería' },
  { value: 6, label: '6 - RUC' },
  { value: 7, label: '7 - Pasaporte' }
]

const monedas = [
  { value: 1, label: 'S/ PEN - Soles' },
  { value: 2, label: '$ USD - Dólares' },
  { value: 3, label: '€ EUR - Euros' }
]

const tiposOperacion = [
  { value: 1, label: '0101 - Venta Interna' },
  { value: 2, label: '0200 - Exportación' }
]

const tiposIgv = [
  { value: 1,  label: 'Gravado (18%)' },
  { value: 8,  label: 'Exonerado' },
  { value: 9,  label: 'Inafecto' },
  { value: 16, label: 'Exportación' }
]

const unidades = ['NIU', 'ZZ', 'KGM', 'LTR', 'MTR', 'TNE']

/* ─────────── ESTADO ─────────── */
const showDialog        = ref(false)
const enviando          = ref(false)
const formRef           = ref<any>(null)
const respuestaSunat    = ref<any>(null)
const comprobantes      = ref<any[]>([])
const loadingComprobantes = ref(false)
const searchComprobantes  = ref('')

const headersComprobantes = [
  { title: 'Tipo',       key: 'tipo',       sortable: true },
  { title: 'Serie',      key: 'serie',      sortable: true },
  { title: 'Número',     key: 'numero',     sortable: true },
  { title: 'Cliente',    key: 'cliente',    sortable: true },
  { title: 'Fecha',      key: 'fecha',      sortable: true },
  { title: 'Total',      key: 'total',      sortable: true },
  { title: 'SUNAT',      key: 'sunat_ok',   sortable: false },
  { title: 'Acciones',   key: 'acciones',   sortable: false }
]

/* ─────────── FORM ─────────── */
const itemVacio = () => ({
  codigo:          '',
  descripcion:     '',
  unidad_de_medida:'NIU',
  cantidad:        1,
  valor_unitario:  0,
  precio_unitario: 0,
  descuento:       '',
  subtotal:        0,
  tipo_de_igv:     1,
  igv:             0,
  total:           0,
  anticipo_regularizacion:   false,
  anticipo_comprobante_serie:  '',
  anticipo_comprobante_numero: ''
})

const hoy = () => new Date().toISOString().split('T')[0]

const formInicial = () => ({
  tipo_de_comprobante:           1,
  serie:                         'F001',
  numero:                        1,
  sunat_transaction:             1,
  cliente_tipo_de_documento:     6,
  cliente_numero_de_documento:   '',
  cliente_denominacion:          '',
  cliente_direccion:             '',
  cliente_email:                 '',
  fecha_de_emision:              hoy(),
  fecha_de_vencimiento:          '',
  moneda:                        1,
  tipo_de_cambio:                '',
  observaciones:                 '',
  detraccion:                    false,
  items:                         [itemVacio()]
})

const form = ref(formInicial())

/* ─────────── COMPUTEDS / CÁLCULOS ─────────── */
const calcularItem = (idx: number) => {
  const it = form.value.items[idx]
  const IGV_RATE = 0.18
  const esGravado    = it.tipo_de_igv === 1 || it.tipo_de_igv === 16
  const esExonerado  = it.tipo_de_igv === 8
  const esInafecto   = it.tipo_de_igv === 9

  const subtotal = +(it.cantidad * it.valor_unitario).toFixed(2)
  const igv      = esGravado ? +(subtotal * IGV_RATE).toFixed(2) : 0
  const total    = +(subtotal + igv).toFixed(2)

  it.subtotal        = subtotal
  it.igv             = igv
  it.total           = total
  it.precio_unitario = esGravado ? +(it.valor_unitario * (1 + IGV_RATE)).toFixed(2) : it.valor_unitario
}

const totales = computed(() => {
  let gravada   = 0, inafecta = 0, exonerada = 0, igv = 0

  form.value.items.forEach(it => {
    if (it.tipo_de_igv === 1 || it.tipo_de_igv === 16) {
      gravada  += it.subtotal
      igv      += it.igv
    } else if (it.tipo_de_igv === 8) {
      exonerada += it.subtotal
    } else {
      inafecta  += it.subtotal
    }
  })

  return {
    gravada:   +gravada.toFixed(2),
    inafecta:  +inafecta.toFixed(2),
    exonerada: +exonerada.toFixed(2),
    igv:       +igv.toFixed(2),
    total:     +(gravada + inafecta + exonerada + igv).toFixed(2)
  }
})

/* ─────────── ACCIONES ─────────── */
const onTipoCambia = (v: number) => {
  form.value.serie  = v === 1 ? 'F001' : v === 2 ? 'B001' : v === 3 ? 'FC01' : 'FD01'
  form.value.cliente_tipo_de_documento = v === 1 ? 6 : 1
}

const agregarItem  = () => form.value.items.push(itemVacio())
const eliminarItem = (idx: number) => form.value.items.splice(idx, 1)

const abrirNuevo = () => {
  form.value      = formInicial()
  respuestaSunat.value = null
  showDialog.value = true
}

const enviarFactura = async () => {
  const { valid } = await formRef.value?.validate()
  if (!valid) return

  enviando.value = true
  respuestaSunat.value = null

  const t = totales.value

  const payload = {
    tipo_de_comprobante:              form.value.tipo_de_comprobante,
    serie:                            form.value.serie,
    numero:                           form.value.numero,
    sunat_transaction:                form.value.sunat_transaction,
    cliente_tipo_de_documento:        form.value.cliente_tipo_de_documento,
    cliente_numero_de_documento:      form.value.cliente_numero_de_documento,
    cliente_denominacion:             form.value.cliente_denominacion,
    cliente_direccion:                form.value.cliente_direccion || '',
    cliente_email:                    form.value.cliente_email || '',
    cliente_email_1:                  '',
    cliente_email_2:                  '',
    fecha_de_emision:                 form.value.fecha_de_emision,
    fecha_de_vencimiento:             form.value.fecha_de_vencimiento || '',
    moneda:                           form.value.moneda,
    tipo_de_cambio:                   form.value.moneda !== 1 ? form.value.tipo_de_cambio : '',
    porcentaje_de_igv:                18.00,
    descuento_global:                 '',
    total_descuento:                  '',
    total_anticipo:                   '',
    total_gravada:                    t.gravada || '',
    total_inafecta:                   t.inafecta || '',
    total_exonerada:                  t.exonerada || '',
    total_igv:                        t.igv || '',
    total_gratuita:                   '',
    total_otros_cargos:               '',
    total:                            t.total,
    percepcion_tipo:                  '',
    percepcion_base_imponible:        '',
    total_percepcion:                 '',
    total_impuestos_bolsa_plastica:   '',
    detraccion:                       false,
    observaciones:                    form.value.observaciones || '',
    documento_que_se_modifica_tipo:   '',
    documento_que_se_modifica_serie:  '',
    documento_que_se_modifica_numero: '',
    tipo_de_nota_de_credito:          '',
    tipo_de_nota_de_debito:           '',
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    codigo_unico:                     '',
    condiciones_de_pago:              '',
    medio_de_pago:                    '',
    placa_vehiculo:                   '',
    orden_compra_servicio:            '',
    tabla_personalizada_codigo:       '',
    formato_de_pdf:                   'A4',
    items:                            form.value.items.map(it => ({
      unidad_de_medida:              it.unidad_de_medida,
      codigo:                        it.codigo || '',
      descripcion:                   it.descripcion,
      cantidad:                      it.cantidad,
      valor_unitario:                it.valor_unitario,
      precio_unitario:               it.precio_unitario,
      descuento:                     '',
      subtotal:                      it.subtotal,
      tipo_de_igv:                   it.tipo_de_igv,
      igv:                           it.igv,
      total:                         it.total,
      anticipo_regularizacion:       false,
      anticipo_comprobante_serie:    '',
      anticipo_comprobante_numero:   ''
    }))
  }

  try {
    const res = await $fetch<any>('/api/pse/factura', {
      method: 'POST',
      body: { company_id: props.companyId, payload }
    })

    const aceptada = res.aceptada_por_sunat === true

    respuestaSunat.value = {
      aceptada,
      descripcion: res.sunat_description || res.errors || 'Sin descripción',
      serie:       res.serie,
      numero:      res.numero,
      enlace_pdf:  res.enlace_del_pdf || null,
      enlace_xml:  res.enlace_del_xml || null
    }

    if (aceptada) {
      // Agregar a la tabla local
      comprobantes.value.unshift({
        tipo:       form.value.tipo_de_comprobante,
        serie:      res.serie,
        numero:     res.numero,
        cliente:    form.value.cliente_denominacion,
        fecha:      form.value.fecha_de_emision,
        total:      t.total,
        sunat_ok:   true,
        enlace_pdf: res.enlace_del_pdf || null,
        enlace_xml: res.enlace_del_xml || null
      })
      // Incrementar número para el próximo
      form.value.numero = form.value.numero + 1
    }

  } catch (err: any) {
    respuestaSunat.value = {
      aceptada:    false,
      descripcion: err?.data?.statusMessage || err?.message || 'Error de conexión con PSE.PE'
    }
  } finally {
    enviando.value = false
  }
}
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
}

.item-row {
  background: rgba(0,0,0,.02);
  border-radius: 8px;
  padding: 8px 10px 4px;
  margin-bottom: 8px;
  border: 1px solid rgba(0,0,0,.06);
}

.totales-box {
  background: rgba(99,102,241,.05);
  border: 1px solid rgba(99,102,241,.2);
  border-radius: 10px;
  padding: 14px 18px;
  max-width: 360px;
  margin-left: auto;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 0.9rem;
}

.total-final {
  font-size: 1.1rem;
  font-weight: 700;
  border-top: 1px solid rgba(99,102,241,.3);
  margin-top: 6px;
  padding-top: 8px;
  color: #6366f1;
}
</style>
