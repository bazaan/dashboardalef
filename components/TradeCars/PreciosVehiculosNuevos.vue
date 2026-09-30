<!--
  Trade Cars — Precios vehículos nuevos (30/09/2026)
  ---------------------------------------------------
  La tabla `tradecars_data_precios_vehiculos_nuevos` (el techo 0km que usan el
  Tasador de WhatsApp y el Asistente Trade Cars) + lo que encontró el bot
  semanal de n8n (referencia/n8n/tradecars-precios-0km-guia.md).

  Lo que el bot NO aplica solo (cambios > 15 % y versiones nuevas) aparece en
  "Pendientes de revisión" para que un administrador lo aplique o descarte.
  Todo pasa por /api/tradecars/precios-0km (el log y las revisiones no tienen
  policy `anon`).
-->
<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Precios vehículos nuevos</h1>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn-primary" :disabled="cargando" @click="cargar">
          <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
        </button>
      </div>
    </header>

    <div class="content-area">
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Precios de lista de autos <b>0 km</b> en Perú. Son el <b>techo</b> que usan el Tasador de WhatsApp y el
        Asistente Trade Cars: un usado casi nuevo nunca se cotiza por encima del 0 km. Cada domingo a las 3:00 AM
        un bot busca en internet los modelos de tu histórico de compras y ventas; los cambios de más de
        {{ UMBRAL }} % y las versiones nuevas no se aplican solos: quedan abajo, en <b>Pendientes de revisión</b>.
      </v-alert>

      <v-alert v-if="faltanSql.length" type="warning" variant="tonal" density="compact" class="mb-4">
        Falta correr en Supabase: <b style="word-break: break-all;">{{ faltanSql.join(', ') }}</b>. Hasta entonces
        <template v-if="faltanSql.some(s => s.includes('control_sync'))">no se ven las corridas del bot ni sus pendientes</template>
        <template v-else>no se pueden descartar hallazgos (aplicar sí funciona)</template>.
      </v-alert>

      <!-- ══════════ Resumen ══════════ -->
      <div class="stats-grid mb-6">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Precios en la tabla</span></div>
          <div class="stat-value">{{ precios.length }}</div>
          <div class="stat-description">{{ modelosEnTabla }} modelos · {{ preciosConFuente }} con enlace a la fuente</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Pendientes de revisión</span></div>
          <div class="stat-value" :style="{ color: pendientes.length ? '#e65100' : undefined }">{{ pendientes.length }}</div>
          <div class="stat-description">{{ nSaltos }} cambios &gt; {{ UMBRAL }} % · {{ nNuevos }} versiones nuevas</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Actualizados esta semana</span></div>
          <div class="stat-value">{{ actualizadosSemana }}</div>
          <div class="stat-description">precios con fecha de los últimos 7 días</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Última búsqueda del bot</span></div>
          <div class="stat-value" style="font-size: 20px;">{{ ultima ? fechaHora(ultima.fecha_ejecucion) : '—' }}</div>
          <div class="stat-description">
            <template v-if="ultima">
              {{ ultima.total_modelos }} modelos · {{ ultima.exitosos }} con precio · US$ {{ Number(ultima.costo_estimado_usd || 0).toFixed(3) }}
              <span v-if="ultima.simulado"> · simulada</span>
            </template>
            <template v-else>todavía no corrió</template>
          </div>
        </div>
      </div>

      <!-- ══════════ Pendientes ══════════ -->
      <v-card flat class="custom-data-table mb-6">
        <v-card-title class="table-search-bar pv-titulo">
          <span class="table-title">Pendientes de revisión ({{ pendientesFiltrados.length }})</span>
          <v-spacer />
          <v-btn-toggle v-model="filtroPend" mandatory density="compact" variant="outlined" divided color="primary">
            <v-btn value="todos" size="small">Todos</v-btn>
            <v-btn value="salto" size="small">Cambios &gt; {{ UMBRAL }} %</v-btn>
            <v-btn value="nuevo" size="small">Versiones nuevas</v-btn>
          </v-btn-toggle>
        </v-card-title>
        <v-alert v-if="!puedeEditar && pendientes.length" type="info" variant="text" density="compact" class="mx-4">
          Solo administración puede aplicar o descartar: estos precios cambian lo que cotiza el Tasador a clientes reales.
        </v-alert>
        <div class="pv-scroll">
          <v-data-table :headers="headersPend" :items="pendientesFiltrados" :loading="cargando" item-value="clave"
            class="elevation-0" :items-per-page="10" no-data-text="No hay hallazgos pendientes de revisión">
            <template v-slot:item.tipo="{ item }">
              <v-chip size="small" variant="tonal" :color="item.tipo === 'salto' ? 'warning' : 'info'">
                {{ item.tipo === 'salto' ? `Cambio > ${UMBRAL} %` : 'Versión nueva' }}
              </v-chip>
            </template>
            <template v-slot:item.vehiculo="{ item }">
              <b>{{ item.marca }} {{ item.modelo }}</b>
              <div class="pv-sub">{{ item.version || 'versión única' }} · {{ item.anio_modelo }}</div>
            </template>
            <template v-slot:item.precio_actual_usd="{ item }">
              <template v-if="item.tipo === 'salto'">
                {{ dinero(item.precio_actual_usd) }}
                <div class="pv-sub">como «{{ item.version_en_tabla || 'sin versión' }}»</div>
              </template>
              <span v-else class="text-medium-emphasis">— no está</span>
            </template>
            <template v-slot:item.precio_usd="{ item }">
              <b>{{ dinero(item.precio_usd) }}</b>
              <div v-if="item.moneda === 'PEN'" class="pv-sub">publicado S/ {{ Number(item.precio_publicado).toLocaleString('es-PE') }}</div>
              <v-chip v-if="item.es_promocion" size="x-small" color="purple" variant="tonal" class="mt-1"
                title="La página lo publica como precio promocional: puede no ser el de lista">promoción</v-chip>
            </template>
            <template v-slot:item.delta_pct="{ item }">
              <span v-if="item.delta_pct !== null" :style="{ color: item.delta_pct < 0 ? '#c62828' : '#2e7d32', fontWeight: 600 }">
                {{ item.delta_pct > 0 ? '+' : '' }}{{ item.delta_pct }} %
              </span>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template v-slot:item.url_fuente="{ item }">
              <a v-if="item.url_fuente" :href="item.url_fuente" target="_blank" rel="noopener noreferrer" class="pv-link">
                {{ dominio(item.url_fuente) }} <v-icon icon="mdi-open-in-new" size="12" />
              </a>
            </template>
            <template v-slot:item.fecha_corrida="{ item }">
              {{ fechaCorta(item.fecha_corrida) }}
              <div v-if="item.corrida_simulada" class="pv-sub">corrida simulada</div>
            </template>
            <template v-slot:item.acciones="{ item }">
              <div v-if="puedeEditar" style="display:flex; gap:4px; justify-content:flex-end;">
                <v-btn size="small" color="success" variant="flat" :loading="procesando === item.clave"
                  :disabled="!!procesando" @click="confirmar = item">Aplicar</v-btn>
                <v-btn size="small" variant="text" :disabled="!!procesando || faltaRevisiones"
                  :title="faltaRevisiones ? 'Falta correr el SQL de revisiones' : ''" @click="decidir(item, 'descartar')">Descartar</v-btn>
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card>

      <!-- ══════════ Tabla de precios ══════════ -->
      <v-card flat class="custom-data-table mb-6">
        <v-card-title class="table-search-bar pv-titulo">
          <span class="table-title">Tabla de precios 0 km ({{ preciosFiltrados.length }} de {{ precios.length }})</span>
          <v-spacer />
          <v-select v-model="filtroFuente" :items="opcionesFuente" density="compact" hide-details
            style="max-width: 200px;" class="mr-3" />
          <v-text-field v-model="buscar" prepend-inner-icon="mdi-magnify" placeholder="Buscar marca, modelo o versión..."
            density="compact" hide-details style="max-width: 280px;" />
        </v-card-title>
        <div class="pv-scroll">
          <v-data-table :headers="headersPrecios" :items="preciosFiltrados" :loading="cargando" class="elevation-0"
            :items-per-page="25" no-data-text="No hay precios cargados">
            <template v-slot:item.precio_nuevo_usd="{ item }"><b>{{ dinero(item.precio_nuevo_usd) }}</b></template>
            <template v-slot:item.precio_anterior_usd="{ item }">
              <template v-if="item.precio_anterior_usd">
                {{ dinero(item.precio_anterior_usd) }}
                <div class="pv-sub" :style="{ color: cambio(item) < 0 ? '#c62828' : '#2e7d32' }">
                  {{ cambio(item) > 0 ? '+' : '' }}{{ cambio(item) }} %
                </div>
              </template>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template v-slot:item.fuente="{ item }">
              <v-chip size="x-small" variant="tonal" :color="item.fuente === 'manual' ? undefined : 'primary'">{{ item.fuente }}</v-chip>
            </template>
            <template v-slot:item.fecha_ultimo_precio="{ item }">
              <span :class="{ 'pv-reciente': esReciente(item.fecha_ultimo_precio) }">{{ fechaCorta(item.fecha_ultimo_precio) }}</span>
            </template>
            <template v-slot:item.estado_produccion="{ item }">
              <v-chip size="x-small" variant="tonal" :color="item.estado_produccion === 'descontinuado' ? 'error' : 'success'">
                {{ item.estado_produccion }}
              </v-chip>
              <v-icon v-if="item.requiere_revision" icon="mdi-alert-circle-outline" size="16" color="warning" class="ml-1"
                title="Marcada para revisión" />
            </template>
            <template v-slot:item.url_fuente="{ item }">
              <a v-if="item.url_fuente" :href="item.url_fuente" target="_blank" rel="noopener noreferrer" class="pv-link">
                {{ dominio(item.url_fuente) }} <v-icon icon="mdi-open-in-new" size="12" />
              </a>
              <span v-else class="text-medium-emphasis">carga manual</span>
            </template>
          </v-data-table>
        </div>
      </v-card>

      <!-- ══════════ Corridas del bot ══════════ -->
      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar pv-titulo">
          <span class="table-title">Búsquedas del bot ({{ corridas.length }})</span>
          <v-spacer />
          <span class="pv-sub">Clic en una fila para ver qué encontró en cada modelo</span>
        </v-card-title>
        <div class="pv-scroll">
          <v-data-table :headers="headersCorridas" :items="corridas" :loading="cargando" class="elevation-0 pv-clic"
            :items-per-page="10" no-data-text="El bot todavía no corrió" @click:row="(_: any, r: any) => verCorrida(r.item)">
            <template v-slot:item.fecha_ejecucion="{ item }">{{ fechaHora(item.fecha_ejecucion) }}</template>
            <template v-slot:item.origen="{ item }">
              {{ item.origen === 'cron' ? 'Automática' : 'Manual' }}
              <v-chip v-if="item.simulado" size="x-small" variant="tonal" class="ml-1">simulada</v-chip>
            </template>
            <template v-slot:item.costo_estimado_usd="{ item }">US$ {{ Number(item.costo_estimado_usd || 0).toFixed(3) }}</template>
            <template v-slot:item.duracion_seg="{ item }">{{ item.duracion_seg }} s</template>
          </v-data-table>
        </div>
      </v-card>
    </div>

    <!-- ══════════ Confirmar aplicar ══════════ -->
    <v-dialog :model-value="!!confirmar" max-width="560" @update:model-value="confirmar = null">
      <v-card v-if="confirmar">
        <v-card-title class="pt-4">
          {{ confirmar.tipo === 'salto' ? 'Aplicar el nuevo precio' : 'Agregar la versión' }}
        </v-card-title>
        <v-card-text>
          <p class="mb-3">
            <b>{{ confirmar.marca }} {{ confirmar.modelo }} {{ confirmar.version || '' }} {{ confirmar.anio_modelo }}</b>
          </p>
          <p v-if="confirmar.tipo === 'salto'">
            La fila «{{ confirmar.version_en_tabla || 'sin versión' }}» pasa de <b>{{ dinero(confirmar.precio_actual_usd) }}</b>
            a <b>{{ dinero(confirmar.precio_usd) }}</b> ({{ confirmar.delta_pct > 0 ? '+' : '' }}{{ confirmar.delta_pct }} %).
            El precio anterior queda guardado.
          </p>
          <p v-else>
            Se agrega a la tabla con <b>{{ dinero(confirmar.precio_usd) }}</b>.
          </p>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
            Desde la próxima tasación, el Tasador de WhatsApp usa este precio como techo para autos con menos de
            10.000 km. Revisa la fuente antes de aplicar:
            <a :href="confirmar.url_fuente" target="_blank" rel="noopener noreferrer">{{ dominio(confirmar.url_fuente) }}</a>
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmar = null">Cancelar</v-btn>
          <v-btn color="success" variant="flat" :loading="!!procesando" @click="decidir(confirmar, 'aplicar')">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ Detalle de una corrida ══════════ -->
    <v-dialog :model-value="!!detalle || cargandoDetalle" max-width="1000" scrollable @update:model-value="detalle = null">
      <v-card>
        <v-card-title class="pt-4">
          Búsqueda del {{ detalle ? fechaHora(detalle.fecha_ejecucion) : '…' }}
          <v-chip v-if="detalle?.simulado" size="small" variant="tonal" class="ml-2">simulada: no escribió precios</v-chip>
        </v-card-title>
        <v-card-text>
          <v-progress-linear v-if="cargandoDetalle" indeterminate color="primary" />
          <template v-if="detalle">
            <p class="pv-sub mb-4">
              Tipo de cambio {{ Number(detalle.tipo_cambio_pen_usd || 0).toFixed(3) }} ({{ detalle.tipo_cambio_origen }}) ·
              {{ detalle.duracion_seg }} s · US$ {{ Number(detalle.costo_estimado_usd || 0).toFixed(3) }}
            </p>
            <div v-for="m in detalle.detalle_json || []" :key="m.marca + m.modelo" class="pv-modelo">
              <div class="pv-modelo-titulo">
                <b>{{ m.marca }} {{ m.modelo }}</b>
                <span class="pv-sub"> · {{ m.operaciones_historico }} operaciones en el histórico</span>
                <v-chip size="x-small" variant="tonal" class="ml-2" :color="COLOR_ESTADO[m.estado]">{{ ETIQUETA_ESTADO[m.estado] || m.estado }}</v-chip>
              </div>
              <div v-if="m.nota || m.error || m.aviso" class="pv-sub">{{ m.error || m.nota }} <span v-if="m.aviso">— {{ m.aviso }}</span></div>
              <v-table v-if="m.versiones?.length" density="compact" class="mt-1">
                <tbody>
                  <tr v-for="(v, i) in m.versiones" :key="i">
                    <td style="width: 26%;">{{ v.version || 'versión única' }} · {{ v.anio_modelo || '—' }}</td>
                    <td style="width: 16%;">
                      {{ v.precio_usd ? dinero(v.precio_usd) : '—' }}
                      <div v-if="v.moneda === 'PEN'" class="pv-sub">S/ {{ Number(v.precio_publicado).toLocaleString('es-PE') }}</div>
                    </td>
                    <td style="width: 22%;">
                      <v-chip size="x-small" variant="tonal" :color="COLOR_ACCION[v.accion]">{{ ETIQUETA_ACCION[v.accion] || v.accion }}</v-chip>
                      <div v-if="v.precio_actual_usd" class="pv-sub">en tabla {{ dinero(v.precio_actual_usd) }} ({{ v.delta_pct }} %)</div>
                    </td>
                    <td class="pv-sub">{{ motivoVisible(v) }}</td>
                    <td style="width: 16%;">
                      <a v-if="v.url_fuente" :href="v.url_fuente" target="_blank" rel="noopener noreferrer" class="pv-link">
                        {{ dominio(v.url_fuente) }} <v-icon icon="mdi-open-in-new" size="12" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detalle = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{ (e: 'notificar', texto: string, color?: string): void }>()
const notify = (texto: string, color = 'success') => emit('notificar', texto, color)

// Mismo umbral que el nodo Config del bot (umbral_cambio_pct).
const UMBRAL = 15

const cargando = ref(false)
const precios = ref<any[]>([])
const corridas = ref<any[]>([])
const pendientes = ref<any[]>([])
const puedeEditar = ref(false)
const faltanSql = ref<string[]>([])

const filtroPend = ref<'todos' | 'salto' | 'nuevo'>('todos')
const buscar = ref('')
const filtroFuente = ref('todas')
const procesando = ref<string | null>(null)
const confirmar = ref<any>(null)
const detalle = ref<any>(null)
const cargandoDetalle = ref(false)

const mensajeError = (e: any) => e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'error'

async function cargar() {
  cargando.value = true
  try {
    const r = await $fetch<any>('/api/tradecars/precios-0km')
    precios.value = r.precios || []
    corridas.value = r.corridas || []
    pendientes.value = r.pendientes || []
    puedeEditar.value = !!r.puede_editar
    faltanSql.value = r.faltan_sql || []
  } catch (e: any) {
    notify(`Error cargando precios 0km: ${mensajeError(e)}`, 'error')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function decidir(item: any, accion: 'aplicar' | 'descartar') {
  procesando.value = item.clave
  try {
    const r = await $fetch<any>('/api/tradecars/precios-0km', {
      method: 'POST',
      body: { accion, clave: item.clave, corrida_id: item.corrida_id },
    })
    const nombre = `${item.marca} ${item.modelo}${item.version ? ' ' + item.version : ''}`
    notify(accion === 'descartar' ? `Descartado: ${nombre}` : `Aplicado: ${nombre} a ${dinero(item.precio_usd)}`)
    if (r?.registrado === false) notify(`Se aplicó, pero falta correr sql/tradecars_precios_0km_revisiones.sql para dejar registro`, 'warning')
    confirmar.value = null
    await cargar()
  } catch (e: any) {
    notify(mensajeError(e), 'error')
    if (e?.statusCode === 409 || e?.data?.statusCode === 409) await cargar()
  } finally {
    procesando.value = null
  }
}

async function verCorrida(c: any) {
  cargandoDetalle.value = true
  detalle.value = null
  try {
    const r = await $fetch<any>(`/api/tradecars/precios-0km?corrida=${c.id}`)
    detalle.value = r.corrida
  } catch (e: any) {
    notify(`No se pudo abrir la búsqueda: ${mensajeError(e)}`, 'error')
  } finally {
    cargandoDetalle.value = false
  }
}

/* ── Derivados ── */
const faltaRevisiones = computed(() => faltanSql.value.some(s => s.includes('revisiones')))
const ultima = computed(() => corridas.value[0] || null)
const nSaltos = computed(() => pendientes.value.filter(p => p.tipo === 'salto').length)
const nNuevos = computed(() => pendientes.value.filter(p => p.tipo === 'nuevo').length)
const modelosEnTabla = computed(() => new Set(precios.value.map(p => `${p.marca}|${p.modelo}`)).size)
const preciosConFuente = computed(() => precios.value.filter(p => p.url_fuente).length)
const actualizadosSemana = computed(() => precios.value.filter(p => esReciente(p.fecha_ultimo_precio)).length)

const pendientesFiltrados = computed(() =>
  filtroPend.value === 'todos' ? pendientes.value : pendientes.value.filter(p => p.tipo === filtroPend.value))

const opcionesFuente = computed(() => [
  { title: 'Todas las fuentes', value: 'todas' },
  ...[...new Set(precios.value.map(p => p.fuente))].sort().map(f => ({ title: `Fuente: ${f}`, value: f })),
])
const preciosFiltrados = computed(() => {
  const q = buscar.value.trim().toLowerCase()
  return precios.value.filter(p =>
    (filtroFuente.value === 'todas' || p.fuente === filtroFuente.value)
    && (!q || [p.marca, p.modelo, p.version].some(x => String(x ?? '').toLowerCase().includes(q))))
})

const NUM = { align: 'end' as const }
const headersPend = [
  { title: 'Tipo', key: 'tipo', sortable: false },
  { title: 'Vehículo', key: 'vehiculo', sortable: false },
  { title: 'En la tabla', key: 'precio_actual_usd', ...NUM },
  { title: 'Encontrado', key: 'precio_usd', ...NUM },
  { title: 'Cambio', key: 'delta_pct', ...NUM },
  { title: 'Fuente', key: 'url_fuente', sortable: false },
  { title: 'Encontrado el', key: 'fecha_corrida' },
  { title: '', key: 'acciones', sortable: false, align: 'end' as const },
]
const headersPrecios = [
  { title: 'Marca', key: 'marca' },
  { title: 'Modelo', key: 'modelo' },
  { title: 'Versión', key: 'version' },
  { title: 'Año', key: 'anio_modelo', ...NUM },
  { title: 'Precio', key: 'precio_nuevo_usd', ...NUM },
  { title: 'Anterior', key: 'precio_anterior_usd', ...NUM },
  { title: 'Fuente', key: 'fuente' },
  { title: 'Fecha del precio', key: 'fecha_ultimo_precio' },
  { title: 'Estado', key: 'estado_produccion' },
  { title: 'Enlace', key: 'url_fuente', sortable: false },
]
const headersCorridas = [
  { title: 'Fecha', key: 'fecha_ejecucion' },
  { title: 'Tipo', key: 'origen' },
  { title: 'Modelos', key: 'total_modelos', ...NUM },
  { title: 'Con precio', key: 'exitosos', ...NUM },
  { title: 'Actualizados', key: 'actualizados', ...NUM },
  { title: 'Confirmados', key: 'confirmados', ...NUM },
  { title: 'Cambios > 15 %', key: 'saltos_revision', ...NUM },
  { title: 'Versiones nuevas', key: 'nuevos_no_insertados', ...NUM },
  { title: 'Descartados', key: 'descartados', ...NUM },
  { title: 'Fallidos', key: 'fallidos', ...NUM },
  { title: 'Costo', key: 'costo_estimado_usd', ...NUM },
  { title: 'Duración', key: 'duracion_seg', ...NUM },
]

const ETIQUETA_ACCION: Record<string, string> = {
  actualizado: 'actualizado', confirmado: 'confirmado', insertado: 'agregado',
  salto_revision: `cambio > ${UMBRAL} %`, nuevo_no_insertado: 'versión nueva',
  descartado: 'descartado', omitido: 'omitido', error_escritura: 'error al escribir',
}
const COLOR_ACCION: Record<string, string | undefined> = {
  actualizado: 'success', confirmado: 'primary', insertado: 'success', salto_revision: 'warning',
  nuevo_no_insertado: 'info', descartado: undefined, omitido: undefined, error_escritura: 'error',
}
const ETIQUETA_ESTADO: Record<string, string> = {
  ok: 'con precio', sin_precio: 'sin precio publicado', no_se_vende_nuevo: 'no se vende nuevo', error: 'error en la búsqueda',
}
const COLOR_ESTADO: Record<string, string | undefined> = {
  ok: 'success', sin_precio: undefined, no_se_vende_nuevo: 'warning', error: 'error',
}

// El bot escribe el motivo técnico (pensado para el log); acá se muestra lo que le sirve a quien revisa.
function motivoVisible(v: any) {
  if (v.accion === 'salto_revision' || v.accion === 'nuevo_no_insertado') return 'Para revisión (ver Pendientes)'
  return v.motivo || v.error || ''
}

/* ── Formatos ── */
function dinero(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  return 'US$ ' + Number(v).toLocaleString('es-PE', { maximumFractionDigits: 0 })
}
function fechaCorta(v: any) {
  if (!v) return '—'
  const s = String(v).slice(0, 10)
  const [y, m, d] = s.split('-')
  return y && m && d ? `${d}/${m}/${y}` : s
}
function fechaHora(v: any) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function dominio(url: any) {
  const m = String(url || '').match(/^https?:\/\/([^/?#:]+)/i)
  return m ? m[1].replace(/^www\./i, '') : ''
}
function esReciente(fecha: any) {
  if (!fecha) return false
  return Date.now() - new Date(String(fecha).slice(0, 10) + 'T12:00:00').getTime() < 7 * 86400000
}
function cambio(p: any) {
  const a = Number(p.precio_anterior_usd)
  return a ? Math.round((Number(p.precio_nuevo_usd) - a) / a * 1000) / 10 : 0
}
</script>

<style scoped>
.pv-sub { font-size: 11px; opacity: .65; }
.pv-link { font-size: 12px; text-decoration: none; white-space: nowrap; }
.pv-link:hover { text-decoration: underline; }
.pv-reciente { font-weight: 600; color: #2e7d32; }
.pv-titulo { flex-wrap: wrap; gap: 8px; }
.pv-titulo :deep(.v-btn-group) { max-width: 100%; overflow-x: auto; }
.pv-scroll { overflow-x: auto; }
.pv-scroll :deep(td), .pv-scroll :deep(th) { white-space: nowrap; }
.pv-clic :deep(tbody tr) { cursor: pointer; }
.pv-modelo { padding: 10px 0; border-bottom: 1px solid rgba(128, 128, 128, .2); }
.pv-modelo:last-child { border-bottom: none; }
.pv-modelo :deep(td) { white-space: normal !important; }
</style>
