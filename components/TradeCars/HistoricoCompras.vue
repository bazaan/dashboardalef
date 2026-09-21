<!--
  Trade Cars — Histórico de Compras (16/09/2026)
  --------------------------------------------------------
  Muestra `tradecars_data_historico_compras`: TODA la hoja "COMPRAS" del Excel
  de operaciones (113 columnas, importadas con sql/tradecars_compras_import.sql),
  mismo criterio que components/TradeCars/HistoricoComprasVentas.vue (la de
  "Ventas", hoja "VENTAS" del mismo Excel).

  Mismo v-data-table de Vuetify que HistoricoComprasVentas.vue (paginador
  nativo, orden por columna, fechas cortas) — pero son 113 columnas,
  demasiadas para escribir cada `<template v-slot:item.X>` y cada
  `<v-text-field>` a mano (así está hecho el de Ventas, con ~45). Acá la
  tabla Y la ficha de edición salen del mismo array CAMPOS (key/título/tipo/
  bloque), generado una sola vez desde el encabezado real del Excel — los
  slots de columna se generan con `v-for` + nombre de slot dinámico
  (`v-slot:[`item.${c.key}`]`) en vez de 113 bloques repetidos. Agregar/
  quitar una columna es tocar ese array, no dos lugares por separado.

  "bloque" distingue las 78 columnas del registro de compra en sí (1) de las
  35 columnas del resumen/valorizado de stock que la misma hoja trae
  incrustado a la derecha (2, columnas cuyo nombre ya existía en el bloque 1
  llevan sufijo " (2)"/"_2" para no perder ningún dato — ver el mapeo
  completo en sql/tradecars_compras_import.sql).

  Igual que la tabla de Ventas: va todo por server/api/tradecars/
  historico-compras.{get,post}.ts porque NO tiene policy `anon`.

  COMPRAS QUE LLEGAN DEL CRM (reunión de septiembre/2026): cuando el asesor marca
  "Concretado" en Chatwoot, el funnel crea acá una fila con verificado = false y los
  datos del auto que pudo extraer. El administrador la revisa, completa lo que falte
  y con "Ingresar a inventario" la pasa a Vehículos (server/api/tradecars/
  inventario-ingresar.post.ts). No es automático a propósito: solo entran al
  inventario los carros que él ordene.
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Compras — Histórico</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" @click="abrirFicha()">
          <v-icon icon="mdi-plus" size="16" /><span>Nuevo registro</span>
        </button>
        <button class="btn-primary" @click="cargar">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-alert v-if="pendientes.length" type="warning" variant="tonal" density="compact" class="mb-4"
        icon="mdi-clipboard-check-outline">
        <strong>{{ pendientes.length }}</strong>
        {{ pendientes.length === 1 ? 'compra llegó' : 'compras llegaron' }} del CRM (estado Concretado) y
        {{ pendientes.length === 1 ? 'espera' : 'esperan' }} revisión. Completa lo que falte y usa
        «Ingresar a inventario» para pasarla a Vehículos.
        <template #append>
          <v-btn size="small" variant="tonal" @click="soloPendientes = !soloPendientes">
            {{ soloPendientes ? 'Ver todas' : 'Ver solo pendientes' }}
          </v-btn>
        </template>
      </v-alert>

      <v-alert v-else type="info" variant="tonal" density="compact" class="mb-4">
        Histórico real de compras (hoja "COMPRAS" del Excel de la empresa) — {{ CAMPOS.length }} columnas,
        todas visibles y editables acá.
      </v-alert>

      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">Registros ({{ filasFiltradas.length }} de {{ filas.length }})</span>
          <v-spacer />
          <v-text-field v-model="buscar" prepend-inner-icon="mdi-magnify"
            placeholder="Buscar por placa, marca, modelo o concat..."
            density="compact" hide-details style="max-width: 320px;" />
        </v-card-title>

        <!-- Mismo v-data-table que HistoricoComprasVentas.vue (fechas cortas,
             paginador nativo de Vuetify, orden por columna) — son 113
             columnas a propósito (pedido explícito: TODAS), así que sigue
             siendo ancha y sólo ella scrollea horizontal, nunca la página.
             Los slots por columna salen del mismo array CAMPOS con un
             v-for + nombre de slot dinámico, en vez de escribir 113
             `<template v-slot:item.X>` a mano. -->
        <div class="hcv-scroll">
          <v-data-table :headers="headers" :items="filasFiltradas" :loading="cargando"
            class="elevation-0" no-data-text="No hay registros" :items-per-page="25"
            fixed-header height="600" @click:row="(_: any, r: any) => abrirFicha(r.item)">
            <template v-slot:item._estado="{ item }">
              <v-chip v-if="item.inventario_vehiculo_id" size="x-small" color="success" variant="tonal"
                prepend-icon="mdi-warehouse">En inventario</v-chip>
              <v-chip v-else-if="item.verificado === false" size="x-small" color="warning" variant="flat"
                prepend-icon="mdi-clipboard-clock-outline">Por verificar</v-chip>
              <v-chip v-else-if="item.origen === 'crm'" size="x-small" color="info" variant="tonal"
                prepend-icon="mdi-check">Verificada</v-chip>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template v-for="c in CAMPOS" :key="c.key" v-slot:[`item.${c.key}`]="{ item }">
              {{ formatCell(valorFila(item, c.key), c.tipo) }}
            </template>
            <template v-slot:item.acciones="{ item }">
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error"
                @click.stop="eliminar(item)" />
            </template>
          </v-data-table>
        </div>
      </v-card>
    </div>

    <!-- ══════════ FICHA (crear / editar) ══════════ -->
    <v-dialog :model-value="!!ficha" max-width="1000" scrollable @update:model-value="ficha = null">
      <v-card v-if="ficha">
        <v-card-title class="pt-4">
          {{ ficha.id ? `${ficha.marca || ''} ${ficha.modelo || ''} — ${ficha.placa || 'sin placa'}` : 'Nuevo registro' }}
        </v-card-title>
        <v-card-text>
          <!-- Compra que creó el CRM: qué anotó el asesor y de qué chat viene -->
          <v-alert v-if="ficha.origen === 'crm'" :type="ficha.verificado === false ? 'warning' : 'info'"
            variant="tonal" density="compact" class="mb-4">
            <div>
              <strong>
                {{ ficha.verificado === false ? 'Creada automáticamente desde el CRM — falta verificar' : 'Creada desde el CRM (ya verificada)' }}
              </strong>
              <template v-if="ficha.crm_conversation_id">
                ·
                <a :href="urlConversacion(ficha.crm_conversation_id)" target="_blank" rel="noopener">
                  ver el chat #{{ ficha.crm_conversation_id }}
                </a>
              </template>
            </div>
            <div v-if="ficha.informacion_auto" class="mt-1 text-body-2">
              El asesor anotó: «{{ ficha.informacion_auto }}»
            </div>
            <div class="mt-1 text-caption">
              Revisa marca, modelo, año, kilometraje y placa; completa precios y gastos, guarda, y usa
              «Ingresar a inventario».
            </div>
          </v-alert>
          <v-alert v-if="ficha.inventario_vehiculo_id" type="success" variant="tonal" density="compact" class="mb-4"
            icon="mdi-warehouse">
            Ya está en el inventario de vehículos<template v-if="ficha.ingresado_inventario_en">
              (desde el {{ formatCell(ficha.ingresado_inventario_en, 'date') }})</template>.
          </v-alert>

          <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-function-variant">
            Los campos con el icono <b>fx</b> se calculan solos con las fórmulas del Excel (valor de compra, gastos, costo total,
            rango de inventario…). Se recalculan al editar y el servidor los vuelve a calcular al guardar.
          </v-alert>

          <div class="form-section-title">Registro de compra</div>
          <div class="form-grid-3">
            <template v-for="c in camposBloque1" :key="c.key">
              <v-text-field v-if="c.tipo === 'number'" v-model.number="ficha[c.key]" type="number"
                :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
              <v-text-field v-else-if="c.tipo === 'date'" v-model="ficha[c.key]" type="date"
                :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
              <v-text-field v-else v-model="ficha[c.key]" :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
            </template>
          </div>

          <div class="form-section-title mt-4">Resumen / valorizado de stock (bloque secundario de la hoja)</div>
          <div class="form-grid-3">
            <template v-for="c in camposBloque2" :key="c.key">
              <v-text-field v-if="c.tipo === 'number'" v-model.number="ficha[c.key]" type="number"
                :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
              <v-text-field v-else-if="c.tipo === 'date'" v-model="ficha[c.key]" type="date"
                :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
              <v-text-field v-else v-model="ficha[c.key]" :readonly="esCampoCalculado(c.key)" :class="{ 'campo-calculado': esCampoCalculado(c.key) }":prepend-inner-icon="esCampoCalculado(c.key) ? 'mdi-function-variant' : undefined"density="compact" hide-details variant="outlined" />
            </template>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="ficha.id" color="error" variant="text" @click="eliminar(ficha)">Eliminar</v-btn>
          <v-spacer />
          <template v-if="ficha.id && esAdmin">
            <v-btn v-if="ficha.verificado === false" variant="tonal" color="warning" prepend-icon="mdi-check"
              :loading="procesando" @click="verificarCompra">Marcar verificada</v-btn>
            <v-btn v-if="!ficha.inventario_vehiculo_id" variant="tonal" color="success" prepend-icon="mdi-warehouse"
              :loading="procesando" @click="ingresarInventario">Ingresar a inventario</v-btn>
          </template>
          <v-btn variant="text" @click="ficha = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardar()">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** Solo un Administrador puede verificar e ingresar a inventario (el servidor lo vuelve a exigir). */
  esAdmin?: boolean
}>(), { esAdmin: true })

const emit = defineEmits<{ (e: 'notificar', texto: string, color?: string): void }>()
const notify = (texto: string, color = 'success') => emit('notificar', texto, color)

// Cuenta de Trade Cars en Chatwoot (para abrir el chat de origen de una compra del CRM)
const CHATWOOT_ACCOUNT_TRADECARS = 17
const urlConversacion = (id: number | string) =>
  `https://chats.alef.company/app/accounts/${CHATWOOT_ACCOUNT_TRADECARS}/conversations/${id}`

// Generado desde el encabezado real de la hoja "COMPRAS" — ver el mapeo
// completo (header original -> columna SQL) en sql/tradecars_compras_import.sql.
const CAMPOS: { key: string; title: string; tipo: 'text' | 'date' | 'number'; bloque: 1 | 2 }[] = [
  { key: 'fecha_de_compra', title: 'Fecha de compra', tipo: 'date', bloque: 1 },
  { key: 'cuenta', title: 'Cuenta', tipo: 'number', bloque: 1 },
  { key: 'placa', title: 'Placa', tipo: 'text', bloque: 1 },
  { key: 'concat', title: 'Concat', tipo: 'text', bloque: 1 },
  { key: 'marca', title: 'Marca', tipo: 'text', bloque: 1 },
  { key: 'modelo', title: 'Modelo', tipo: 'text', bloque: 1 },
  { key: 'version', title: 'Versión', tipo: 'text', bloque: 1 },
  { key: 'color', title: 'Color', tipo: 'text', bloque: 1 },
  { key: 'ano', title: 'Año', tipo: 'text', bloque: 1 },
  { key: 'tipo_de_combustible', title: 'Tipo de combustible', tipo: 'text', bloque: 1 },
  { key: 'transmision', title: 'Transmisión', tipo: 'text', bloque: 1 },
  { key: 'kilometraje', title: 'Kilometraje', tipo: 'number', bloque: 1 },
  { key: 'tipo_de_vehiculo', title: 'Tipo de vehiculo', tipo: 'text', bloque: 1 },
  { key: 'canal_de_compra', title: 'Canal de compra', tipo: 'text', bloque: 1 },
  { key: 'asesor_comercial_comprador', title: 'Asesor comercial / comprador', tipo: 'text', bloque: 1 },
  { key: 'detalle_canal_de_compra', title: 'Detalle canal de compra', tipo: 'text', bloque: 1 },
  { key: 'nombre_referido_compra', title: 'Nombre referido compra', tipo: 'text', bloque: 1 },
  { key: 'tipo_compra_retoma', title: 'Tipo (compra / retoma)', tipo: 'text', bloque: 1 },
  { key: 'tipo_de_compra', title: 'Tipo de compra', tipo: 'text', bloque: 1 },
  { key: 'precio_de_compra_valor_acta', title: 'Precio de compra / valor acta', tipo: 'number', bloque: 1 },
  { key: 'valor_de_compra', title: 'Valor de compra', tipo: 'number', bloque: 1 },
  { key: 'comision_referido', title: 'Comision - referido', tipo: 'number', bloque: 1 },
  { key: 'notariales', title: 'Notariales', tipo: 'number', bloque: 1 },
  { key: 'impuesto_vehicular', title: 'Impuesto vehicular', tipo: 'number', bloque: 1 },
  { key: 'soat', title: 'SOAT', tipo: 'text', bloque: 1 },
  { key: 'rtv', title: 'RTV', tipo: 'text', bloque: 1 },
  { key: 'multa_sat', title: 'Multa SAT', tipo: 'number', bloque: 1 },
  { key: 'multa_callao', title: 'Multa callao', tipo: 'number', bloque: 1 },
  { key: 'multa_sutran', title: 'Multa sutran', tipo: 'number', bloque: 1 },
  { key: 'levantamiento_de_prenda', title: 'Levantamiento de prenda', tipo: 'number', bloque: 1 },
  { key: 'otros_gastos_documentales', title: 'Otros gastos documentales', tipo: 'number', bloque: 1 },
  { key: 'detalle_de_otros_gastos_documentales', title: 'Detalle de otros gastos documentales', tipo: 'text', bloque: 1 },
  { key: 'arreglos_esteticos', title: 'Arreglos esteticos', tipo: 'number', bloque: 1 },
  { key: 'arreglos_mecanicos', title: 'Arreglos mecanicos', tipo: 'number', bloque: 1 },
  { key: 'lavado_de_salon', title: 'Lavado de salon', tipo: 'number', bloque: 1 },
  { key: 'tratamiento_de_pintura', title: 'Tratamiento de pintura', tipo: 'number', bloque: 1 },
  { key: 'detalle_arreglos', title: 'Detalle arreglos', tipo: 'text', bloque: 1 },
  { key: 'total_gastos_extras_prov', title: 'Total gastos extras prov', tipo: 'number', bloque: 1 },
  { key: 'costo_total_total_provision', title: 'Costo total + total provisión', tipo: 'number', bloque: 1 },
  { key: 'impuesto_vehicular_prov', title: 'Impuesto vehicular prov', tipo: 'number', bloque: 1 },
  { key: 'soat_2', title: 'SOAT. (2)', tipo: 'text', bloque: 1 },
  { key: 'rtv_2', title: 'RTV. (2)', tipo: 'number', bloque: 1 },
  { key: 'multa_sat_2', title: 'Multa SAT. (2)', tipo: 'number', bloque: 1 },
  { key: 'multa_callao_2', title: 'Multa callao. (2)', tipo: 'number', bloque: 1 },
  { key: 'multa_sutran_2', title: 'Multa sutran. (2)', tipo: 'number', bloque: 1 },
  { key: 'levantamiento_de_prenda_2', title: 'Levantamiento de prenda. (2)', tipo: 'number', bloque: 1 },
  { key: 'otros_gastos_documentales_2', title: 'Otros gastos documentales. (2)', tipo: 'number', bloque: 1 },
  { key: 'arreglos_esteticos_2', title: 'Arreglos esteticos. (2)', tipo: 'number', bloque: 1 },
  { key: 'arreglos_mecanicos_2', title: 'Arreglos mecanicos. (2)', tipo: 'number', bloque: 1 },
  { key: 'lavado_de_salon_2', title: 'Lavado de salon. (2)', tipo: 'number', bloque: 1 },
  { key: 'tratamiento_de_pintura_2', title: 'Tratamiento de pintura. (2)', tipo: 'number', bloque: 1 },
  { key: 'otros_gastos', title: 'Otros gastos', tipo: 'number', bloque: 1 },
  { key: 'total_gastos_extras_reales', title: 'Total gastos extras reales', tipo: 'number', bloque: 1 },
  { key: 'costo_total_gastos_extras_real', title: 'Costo total + gastos extras real', tipo: 'number', bloque: 1 },
  { key: 'costo_total_sin_igv', title: 'Costo total sin IGV', tipo: 'number', bloque: 1 },
  { key: 'notaria', title: 'Notaria', tipo: 'text', bloque: 1 },
  { key: 'compra_prenda_status', title: 'Compra - prenda / status', tipo: 'text', bloque: 1 },
  { key: 'banco_prenda', title: 'Banco prenda', tipo: 'text', bloque: 1 },
  { key: 'status_notarial', title: 'Status notarial', tipo: 'text', bloque: 1 },
  { key: 'declaracion_jurada', title: 'Declaracion jurada', tipo: 'text', bloque: 1 },
  { key: 'pagado', title: 'Pagado', tipo: 'text', bloque: 1 },
  { key: 'cuenta_de', title: 'Cuenta de', tipo: 'text', bloque: 1 },
  { key: 'detalle_de_operacion', title: 'Detalle de operación', tipo: 'text', bloque: 1 },
  { key: 'registro_stock', title: 'Registro stock', tipo: 'text', bloque: 1 },
  { key: 'vencimiento_soat', title: 'Vencimiento SOAT', tipo: 'text', bloque: 1 },
  { key: 'dias', title: 'Dias', tipo: 'text', bloque: 1 },
  { key: 'rtv_3', title: 'RTV (2)', tipo: 'text', bloque: 1 },
  { key: 'vencimiento_de_rtv', title: 'Vencimiento de RTV', tipo: 'text', bloque: 1 },
  { key: 'certificado_de_gas', title: 'Certificado de gas', tipo: 'text', bloque: 1 },
  { key: 'otros_documentos', title: 'Otros documentos', tipo: 'text', bloque: 1 },
  { key: 'status', title: 'Status', tipo: 'text', bloque: 1 },
  { key: 'rango_de_inv', title: 'Rango de inv.', tipo: 'text', bloque: 1 },
  { key: 'vin', title: 'VIN', tipo: 'text', bloque: 1 },
  { key: 'motor', title: 'Motor', tipo: 'text', bloque: 1 },
  { key: 'fecha_compra', title: 'Fecha compra', tipo: 'date', bloque: 1 },
  { key: 'fecha_venta', title: 'Fecha venta', tipo: 'text', bloque: 1 },
  { key: 'tramitador_de_prenda', title: 'Tramitador de prenda', tipo: 'text', bloque: 1 },
  { key: 'placa_ii', title: 'Placa ii', tipo: 'text', bloque: 2 },
  { key: 'costo_total_real_total_provision', title: 'Costo total real + total provisión', tipo: 'number', bloque: 2 },
  { key: 'costo_total_gastos_extras_real_2', title: 'Costo total + gastos extras real (2)', tipo: 'number', bloque: 2 },
  { key: 'status_ii', title: 'Status ii', tipo: 'text', bloque: 2 },
  { key: 'n_compra', title: 'N° compra', tipo: 'number', bloque: 2 },
  { key: 'kardex', title: 'Kardex', tipo: 'text', bloque: 2 },
  { key: 'a_nombre_de', title: 'A nombre de', tipo: 'text', bloque: 2 },
  { key: 'semana', title: 'Semana', tipo: 'text', bloque: 2 },
  { key: 'placa_iii', title: 'Placa iii', tipo: 'text', bloque: 2 },
  { key: 'marca_2', title: 'Marca (2)', tipo: 'text', bloque: 2 },
  { key: 'modelo_2', title: 'Modelo (2)', tipo: 'text', bloque: 2 },
  { key: 'precio', title: 'Precio', tipo: 'number', bloque: 2 },
  { key: 'precio_de_cierre', title: 'Precio de cierre', tipo: 'number', bloque: 2 },
  { key: 'version_2', title: 'Version (2)', tipo: 'text', bloque: 2 },
  { key: 'ano_fab', title: 'Año fab', tipo: 'text', bloque: 2 },
  { key: 'km', title: 'Km', tipo: 'number', bloque: 2 },
  { key: 'color_2', title: 'Color (2)', tipo: 'text', bloque: 2 },
  { key: 'tipo_de_vehiculo_2', title: 'Tipo de vehiculo (2)', tipo: 'text', bloque: 2 },
  { key: 'combustible', title: 'Combustible', tipo: 'text', bloque: 2 },
  { key: 'transmision_2', title: 'Transmisión (2)', tipo: 'text', bloque: 2 },
  { key: 'fecha_de_compra_2', title: 'Fecha de compra (2)', tipo: 'date', bloque: 2 },
  { key: 'tipo_compra_retoma_2', title: 'Tipo (compra / retoma) (2)', tipo: 'text', bloque: 2 },
  { key: 'tipo_de_compra_2', title: 'Tipo de compra (2)', tipo: 'text', bloque: 2 },
  { key: 'valor_de_compra_2', title: 'Valor de compra (2)', tipo: 'number', bloque: 2 },
  { key: 'igv_compra', title: 'IGV compra', tipo: 'number', bloque: 2 },
  { key: 'adquisicion', title: 'Adquisicion', tipo: 'number', bloque: 2 },
  { key: 'comision_compra', title: 'Comisión compra', tipo: 'number', bloque: 2 },
  { key: 'comision_venta', title: 'Comision venta', tipo: 'number', bloque: 2 },
  { key: 'gastos_extras', title: 'Gastos extras', tipo: 'number', bloque: 2 },
  { key: 'costo_total', title: 'Costo total', tipo: 'number', bloque: 2 },
  { key: 'notariales_2', title: 'Notariales (2)', tipo: 'number', bloque: 2 },
  { key: 'costo_total_notariales', title: 'Costo total + notariales', tipo: 'number', bloque: 2 },
  { key: 'a_nombre_de_2', title: 'A nombre de (2)', tipo: 'text', bloque: 2 },
  { key: 'dias_de_inv', title: 'Dias de inv.', tipo: 'number', bloque: 2 },
  { key: 'disponible_para_venta', title: 'Disponible para venta', tipo: 'text', bloque: 2 },
  { key: 'status_ii_2', title: 'Status ii (2)', tipo: 'text', bloque: 2 },
]
const camposBloque1 = CAMPOS.filter(c => c.bloque === 1)
const camposBloque2 = CAMPOS.filter(c => c.bloque === 2)

// Mismos headers que consume v-data-table en HistoricoComprasVentas.vue —
// generados desde CAMPOS en vez de escritos a mano (son 113).
const estadoTexto = (r: any) =>
  r.inventario_vehiculo_id ? 'En inventario' : r.verificado === false ? 'Por verificar' : r.origen === 'crm' ? 'Verificada' : ''

const headers = [
  // Primera columna: dónde va cada compra en el flujo CRM -> verificación -> inventario
  { title: 'Estado', key: '_estado', value: (r: any) => estadoTexto(r), sortable: true },
  ...CAMPOS.map(c => ({
    title: c.title,
    key: c.key,
    ...(c.tipo === 'number' ? { align: 'end' as const, sortable: true } : {}),
  })),
  { title: '', key: 'acciones', sortable: false, width: 50 },
]

const filas = ref<any[]>([])
const cargando = ref(false)
const buscar = ref('')

async function apiHistoricoCompras<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const data = await $fetch<T>('/api/tradecars/historico-compras', { method: 'POST', body })
    return { data, error: null }
  } catch (e: any) {
    const message = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message
      || 'No se pudo completar la operación'
    return { data: null, error: { message: String(message) } }
  }
}

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{ ok: boolean; filas: any[] }>('/api/tradecars/historico-compras')
    const hoy = tcHoyLima()
    // Los días para vencer SOAT / RTV y los días en inventario cambian cada día (en el Excel son HOY()):
    // se calculan al mostrar y NO se guardan.
    filas.value = (res.filas || []).map((f: any) => ({ ...f, __vivos: tcCompraVivos(f, hoy) }))
  } catch (e: any) {
    notify(`Error cargando: ${e?.data?.statusMessage || e?.message || 'error'}`, 'error')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

// Compras que creó el CRM y todavía no revisó nadie (verificado = false)
const pendientes = computed(() => filas.value.filter(f => f.verificado === false))
const soloPendientes = ref(false)

const filasFiltradas = computed(() => {
  // Si ya no quedan pendientes, el filtro no puede dejar la tabla vacía sin salida
  let base = soloPendientes.value && pendientes.value.length ? pendientes.value : filas.value
  if (!buscar.value.trim()) return base
  const q = buscar.value.toLowerCase()
  return base.filter(f => [f.placa, f.marca, f.modelo, f.concat]
    .some(x => String(x ?? '').toLowerCase().includes(q)))
})
function formatCell(v: any, tipo: 'text' | 'date' | 'number') {
  if (v === null || v === undefined || v === '') return '—'
  if (tipo === 'date') {
    const s = String(v).slice(0, 10)
    const [y, m, d] = s.split('-')
    return y && m && d ? `${d}/${m}/${y}` : s
  }
  if (tipo === 'number') return Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 })
  return String(v)
}

/* ══════════ Ficha (crear / editar) ══════════ */
const ficha = ref<any>(null)
const guardando = ref(false)

/** Valor que se muestra en la tabla: el "vivo" (calculado con la fecha de hoy) si lo hay, si no el guardado. */
function valorFila(item: any, key: string) {
  const vivo = item?.__vivos?.[key]
  return vivo !== undefined ? vivo : item[key]
}
const CLAVES_VIVAS = ['dias', 'vencimiento_de_rtv', 'dias_de_inv']

/* Fórmulas del Excel en vivo (utils/tradecarsFormulas.ts). En una fila que ya existe solo se reescribe lo
   que la edición realmente cambia: una fila con un total escrito a mano no se pisa. El servidor vuelve a
   calcular todo al guardar (y resuelve lo que necesita otras tablas: N° de compra y si ya se vendió). */
const CALCULADOS = new Set<string>(TC_COMPRA_CALCULADOS)
let fichaOriginal: Record<string, any> | null = null

const hayValor = (v: any) => v !== null && v !== undefined && String(v).trim() !== ''

/** ¿Este campo sale de una fórmula (solo lectura)? Algunos son manuales cuando no hay de dónde calcularlos. */
function esCampoCalculado(key: string): boolean {
  const f = ficha.value
  if (!f || !CALCULADOS.has(key)) return false
  // El total de gastos reales es la suma de los 13 gastos; si no se detalló ninguno, es un total escrito a mano
  if (key === 'total_gastos_extras_reales') return TC_COMPRA_GASTOS_REALES.some(k => hayValor(f[k]))
  // PÉRDIDA / NO APLICA se escriben a mano: el status solo lo decide la fórmula cuando no es uno de esos
  if (key === 'status' || key === 'status_ii' || key === 'status_ii_2') return false
  if (key === 'rango_de_inv') return String(f.rango_de_inv || '').trim().toUpperCase() !== 'NO APLICA'
  return true
}

function aplicarFormulasFicha() {
  const f = ficha.value
  if (!f) return
  let calc = tcCalcularCompra(f)
  if (fichaOriginal) calc = tcSoloCambios(calc, tcCalcularCompra(fichaOriginal), fichaOriginal)
  for (const [k, v] of Object.entries(calc)) {
    if (k === 'status') continue              // depende de si ya hay una venta: lo resuelve el servidor
    const actual = f[k]
    const igual = typeof v === 'number' && typeof actual === 'number' ? Math.abs(v - actual) < 1e-9 : v === actual
    if (!igual) f[k] = v                      // solo se asigna si cambió: así el watch no entra en bucle
  }
}
watch(ficha, aplicarFormulasFicha, { deep: true })

function fichaVacia() {
  const obj: Record<string, any> = {}
  for (const c of CAMPOS) obj[c.key] = c.tipo === 'number' ? null : ''
  return obj
}

function abrirFicha(item?: any) {
  if (item) {
    const copia = { ...item }
    delete copia.__vivos
    for (const c of CAMPOS) {
      if (c.tipo === 'date' && copia[c.key]) copia[c.key] = String(copia[c.key]).slice(0, 10)
    }
    fichaOriginal = { ...copia }
    ficha.value = copia
  } else {
    fichaOriginal = null
    ficha.value = fichaVacia()
  }
}

/** Guarda la ficha. Devuelve true si se pudo (los botones de inventario lo usan para no
 *  mandar al inventario datos viejos: primero se guarda lo que el administrador acaba de editar). */
async function guardar(cerrar = true): Promise<boolean> {
  const f = ficha.value
  if (!f.placa?.trim?.() && !f.marca?.trim?.()) {
    notify('Al menos la placa o la marca son obligatorias', 'error')
    return false
  }
  guardando.value = true
  // Los valores que dependen de la fecha de hoy no se guardan (se recalculan al mostrar)
  const datos: Record<string, any> = { ...f }
  delete datos.__vivos
  for (const k of CLAVES_VIVAS) delete datos[k]
  const { error } = await apiHistoricoCompras({ accion: f.id ? 'actualizar' : 'crear', ...datos })
  guardando.value = false
  if (error) { notify(`Error: ${error.message}`, 'error'); return false }
  if (cerrar) {
    notify(f.id ? 'Registro actualizado' : 'Registro creado')
    ficha.value = null
  }
  await cargar()
  return true
}

/* ══════════ Verificación e ingreso a inventario (solo Administrador) ══════════ */
const procesando = ref(false)

async function apiInventario(accion: 'verificar' | 'ingresar', id: string) {
  try {
    const data = await $fetch<any>('/api/tradecars/inventario-ingresar', { method: 'POST', body: { accion, id } })
    return { data, error: null as string | null }
  } catch (e: any) {
    return { data: null, error: String(e?.data?.statusMessage || e?.statusMessage || e?.message || 'No se pudo completar la operación') }
  }
}

/** Vuelve a abrir la ficha con lo que ya está guardado (para que muestre el nuevo estado). */
function reabrirFicha(id: string) {
  const fresca = filas.value.find(f => f.id === id)
  if (fresca) abrirFicha(fresca)
  else ficha.value = null
}

async function verificarCompra() {
  const f = ficha.value
  if (!f?.id) return
  procesando.value = true
  try {
    if (!(await guardar(false))) return
    const { error } = await apiInventario('verificar', f.id)
    if (error) return notify(error, 'error')
    notify('Compra marcada como verificada')
    await cargar()
    reabrirFicha(f.id)
  } finally {
    procesando.value = false
  }
}

async function ingresarInventario() {
  const f = ficha.value
  if (!f?.id) return
  if (!confirm(`¿Ingresar ${f.marca || ''} ${f.modelo || ''} (${f.placa || 'sin placa'}) al inventario de vehículos?`)) return
  procesando.value = true
  try {
    // Se guarda primero lo que el administrador acaba de completar: el inventario se arma desde la BD
    if (!(await guardar(false))) return
    const { data, error } = await apiInventario('ingresar', f.id)
    if (error) return notify(error, 'error')
    notify(data?.ya_ingresado
      ? 'Ya estaba en el inventario'
      : data?.accion === 'vinculado'
        ? 'Ya había un vehículo con esa placa: se vinculó a esta compra'
        : 'Vehículo ingresado al inventario')
    await cargar()
    reabrirFicha(f.id)
  } finally {
    procesando.value = false
  }
}

async function eliminar(item: any) {
  if (!confirm(`¿Eliminar el registro de ${item.marca || ''} ${item.modelo || ''} (${item.placa || 'sin placa'})?`)) return
  const { error } = await apiHistoricoCompras({ accion: 'eliminar', id: item.id })
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify('Registro eliminado')
  ficha.value = null
  await cargar()
}
</script>

<style scoped>
.hcv-sub { font-size: 11px; opacity: .6; }

/* Son 113 columnas a propósito (se pidió ver todas) — sólo esta tabla
   scrollea horizontal, nunca la página. Mismo criterio que
   HistoricoComprasVentas.vue (con ~45 columnas). */
.hcv-scroll { overflow-x: auto; }
.hcv-scroll :deep(table) { min-width: 5200px; }
.hcv-scroll :deep(td), .hcv-scroll :deep(th) { white-space: nowrap; }

.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}
.form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

/* Campo que sale de una fórmula del Excel: se ve, pero no se escribe */
.campo-calculado :deep(.v-field) { background: rgba(var(--v-theme-primary), 0.06); }
.campo-calculado :deep(input) { font-weight: 600; }

@media (max-width: 780px) {
  .form-grid-3 { grid-template-columns: 1fr; }
}
</style>
