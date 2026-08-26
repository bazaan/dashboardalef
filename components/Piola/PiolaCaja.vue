<template>
  <div>
    <!-- ══════════ SIN CAJA ABIERTA ══════════ -->
    <v-card v-if="!sesionAbierta" flat class="custom-data-table caja-cerrada">
      <v-icon icon="mdi-cash-register" size="46" />
      <h3>No hay una caja abierta</h3>
      <p>
        Para registrar movimientos hay que abrir la caja con su saldo inicial.
        Solo puede haber una caja abierta a la vez.
      </p>
      <v-btn v-if="puedeEditar" color="primary" variant="flat" @click="abrirDialogoApertura">
        <v-icon icon="mdi-lock-open-variant" start /> Abrir caja
      </v-btn>
    </v-card>

    <!-- ══════════ CAJA ABIERTA ══════════ -->
    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Saldo inicial</span></div>
          <div class="stat-value">{{ PEN_CORTO(sesionAbierta.saldo_inicial) }}</div>
          <div class="stat-description">
            Abierta {{ fechaHora(sesionAbierta.fecha_apertura) }} · {{ sesionAbierta.abierta_por }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Ingresos</span></div>
          <div class="stat-value" style="color:#2e9e5b">{{ PEN_CORTO(resumen.ingresos) }}</div>
          <div class="stat-description">{{ resumen.nIngresos }} movimiento(s)</div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Salidas</span></div>
          <div class="stat-value" style="color:#e2564a">{{ PEN_CORTO(resumen.salidas) }}</div>
          <div class="stat-description">
            Egresos, transferencias y retiros ({{ resumen.nSalidas }})
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-header"><span class="stat-title">Saldo actual</span></div>
          <div class="stat-value" :style="{ color: saldoActual >= 0 ? '#2e9e5b' : '#e2564a' }">
            {{ PEN_CORTO(saldoActual) }}
          </div>
          <div class="stat-description">Inicial + ingresos − salidas</div>
        </div>
      </div>

      <v-card flat class="custom-data-table">
        <v-card-title class="table-search-bar">
          <span class="table-title">
            {{ sesionAbierta.nombre || 'Caja' }} — movimientos ({{ movimientos.length }})
          </span>
          <v-spacer />
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <v-btn v-if="puedeEditar" size="small" color="primary" variant="flat" @click="abrirMovimiento()">
              <v-icon icon="mdi-plus" start /> Movimiento
            </v-btn>
            <v-btn v-if="puedeEditar" size="small" color="error" variant="tonal" @click="abrirCierre">
              <v-icon icon="mdi-lock" start /> Cerrar caja
            </v-btn>
          </div>
        </v-card-title>

        <v-data-table :headers="headers" :items="movimientos" :loading="cargando" class="elevation-0"
          no-data-text="La caja todavía no tiene movimientos" :items-per-page="25">
          <template v-slot:item.fecha="{ item }">{{ fechaHora(item.fecha) }}</template>
          <template v-slot:item.tipo="{ item }">
            <v-chip size="x-small" variant="flat" :color="colorTipo(item.tipo)">
              <v-icon :icon="iconoTipo(item.tipo)" size="12" start /> {{ etiquetaTipo(item.tipo) }}
            </v-chip>
          </template>
          <template v-slot:item.monto="{ item }">
            <span :style="{ color: item.tipo === 'ingreso' ? '#2e9e5b' : '#e2564a', fontWeight: 600 }">
              {{ item.tipo === 'ingreso' ? '+' : '−' }}{{ PEN(item.monto) }}
            </span>
          </template>
          <template v-slot:item.acciones="{ item }">
            <v-btn v-if="puedeEliminar" icon="mdi-delete" size="x-small" variant="text" color="error"
              @click="eliminarMovimiento(item)" />
          </template>
        </v-data-table>
      </v-card>
    </template>

    <!-- ══════════ HISTORIAL DE SESIONES ══════════ -->
    <v-card flat class="custom-data-table mt-4">
      <v-card-title class="table-search-bar">
        <span class="table-title">Historial de cajas</span>
      </v-card-title>
      <v-data-table :headers="headersSesiones" :items="sesionesCerradas" class="elevation-0"
        no-data-text="Todavía no se cerró ninguna caja" :items-per-page="10"
        @click:row="(_: any, r: any) => verSesion(r.item)">
        <template v-slot:item.fecha_apertura="{ item }">{{ fechaHora(item.fecha_apertura) }}</template>
        <template v-slot:item.fecha_cierre="{ item }">{{ fechaHora(item.fecha_cierre) }}</template>
        <template v-slot:item.saldo_inicial="{ item }">{{ PEN(item.saldo_inicial) }}</template>
        <template v-slot:item.saldo_final="{ item }">{{ PEN(item.saldo_final) }}</template>
        <template v-slot:item.diferencia="{ item }">
          <span v-if="Number(item.diferencia)"
            :style="{ color: Number(item.diferencia) < 0 ? '#e2564a' : '#f2a63b', fontWeight: 600 }">
            {{ PEN(item.diferencia) }}
          </span>
          <span v-else style="opacity:.4">Cuadrada</span>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══════════ APERTURA ══════════ -->
    <v-dialog :model-value="!!apertura" max-width="520" @update:model-value="apertura = null">
      <v-card v-if="apertura">
        <v-card-title class="pt-4">Abrir caja</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="apertura.nombre" label="Nombre de la caja" density="compact"
              hide-details variant="outlined" placeholder="Caja principal" class="col-2" />
            <v-text-field v-model.number="apertura.saldo_inicial" type="number" label="Saldo inicial (S/)"
              density="compact" hide-details variant="outlined" class="col-2" />
          </div>
          <v-textarea v-model="apertura.observaciones" label="Observaciones" rows="2"
            density="compact" hide-details variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="apertura = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarApertura">Abrir</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ MOVIMIENTO ══════════ -->
    <v-dialog :model-value="!!movimiento" max-width="620" scrollable @update:model-value="movimiento = null">
      <v-card v-if="movimiento">
        <v-card-title class="pt-4">Movimiento de caja</v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-select v-model="movimiento.tipo" :items="TIPOS_MOV_CAJA" label="Tipo"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="movimiento.monto" type="number" min="0" label="Monto (S/) *"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="movimiento.concepto" label="Concepto *" density="compact"
              hide-details variant="outlined" class="col-2" />
            <v-select v-model="movimiento.payment_method" :items="metodosPago" label="Método"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-if="['transferencia', 'retiro'].includes(movimiento.tipo)"
              v-model="movimiento.destino" label="Destino" density="compact" hide-details
              variant="outlined" placeholder="Banco, persona…" />
          </div>
          <v-textarea v-model="movimiento.observaciones" label="Observaciones" rows="2"
            density="compact" hide-details variant="outlined" class="mt-3" />

          <v-alert v-if="saldoTrasMovimiento < 0" type="warning" variant="tonal" density="compact" class="mt-3">
            Con este movimiento la caja queda en <b>{{ PEN(saldoTrasMovimiento) }}</b>.
            Se puede registrar igual, pero conviene revisar el saldo inicial.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="movimiento = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarMovimiento">
            Registrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ CIERRE ══════════ -->
    <v-dialog :model-value="!!cierre" max-width="560" @update:model-value="cierre = null">
      <v-card v-if="cierre">
        <v-card-title class="pt-4">Cerrar caja</v-card-title>
        <v-card-text>
          <div class="resumen-cierre">
            <div><span>Saldo inicial</span><strong>{{ PEN(sesionAbierta?.saldo_inicial) }}</strong></div>
            <div><span>Ingresos</span><strong style="color:#2e9e5b">+ {{ PEN(resumen.ingresos) }}</strong></div>
            <div><span>Salidas</span><strong style="color:#e2564a">− {{ PEN(resumen.salidas) }}</strong></div>
            <div class="resumen-final">
              <span>Saldo según el sistema</span><strong>{{ PEN(saldoActual) }}</strong>
            </div>
          </div>

          <v-text-field v-model.number="cierre.saldo_contado" type="number" class="mt-4"
            label="Saldo contado físicamente (S/)" density="compact" hide-details variant="outlined" />

          <v-alert v-if="diferenciaCierre !== 0" :type="diferenciaCierre < 0 ? 'error' : 'warning'"
            variant="tonal" density="compact" class="mt-3">
            Diferencia de <b>{{ PEN(diferenciaCierre) }}</b>
            ({{ diferenciaCierre < 0 ? 'falta' : 'sobra' }} respecto del sistema).
            Queda registrada en el historial.
          </v-alert>

          <v-textarea v-model="cierre.observaciones" label="Observaciones del cierre" rows="2"
            density="compact" hide-details variant="outlined" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cierre = null">Cancelar</v-btn>
          <v-btn color="error" variant="flat" :loading="guardando" @click="guardarCierre">
            Cerrar caja
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══════════ DETALLE DE UNA SESIÓN CERRADA ══════════ -->
    <v-dialog :model-value="!!sesionVista" max-width="820" scrollable @update:model-value="sesionVista = null">
      <v-card v-if="sesionVista">
        <v-card-title class="pt-4">
          {{ sesionVista.nombre || 'Caja' }} — {{ fechaCorta(sesionVista.fecha_apertura) }}
        </v-card-title>
        <v-card-text>
          <div class="detalle-campos">
            <div><span>Abierta por</span><strong>{{ sesionVista.abierta_por }}</strong></div>
            <div><span>Cerrada por</span><strong>{{ sesionVista.cerrada_por || '—' }}</strong></div>
            <div><span>Saldo inicial</span><strong>{{ PEN(sesionVista.saldo_inicial) }}</strong></div>
            <div><span>Saldo final</span><strong>{{ PEN(sesionVista.saldo_final) }}</strong></div>
            <div><span>Contado</span><strong>{{ PEN(sesionVista.saldo_contado) }}</strong></div>
            <div><span>Diferencia</span><strong>{{ PEN(sesionVista.diferencia) }}</strong></div>
          </div>
          <v-table density="compact" class="mt-4">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th class="text-right">Monto</th></tr></thead>
            <tbody>
              <tr v-for="m in movimientosVistos" :key="m.id">
                <td>{{ fechaHora(m.fecha) }}</td>
                <td>{{ etiquetaTipo(m.tipo) }}</td>
                <td>{{ m.concepto }}</td>
                <td class="text-right">
                  {{ m.tipo === 'ingreso' ? '+' : '−' }}{{ PEN(m.monto) }}
                </td>
              </tr>
              <tr v-if="!movimientosVistos.length">
                <td colspan="4" style="opacity:.5">Sin movimientos.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="sesionVista = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Caja: apertura, movimientos, transferencias, retiros y cierre.
 *
 * Solo puede haber UNA caja abierta a la vez — lo garantiza un índice único
 * parcial en la BD, no solo esta pantalla: con dos cajas abiertas ningún saldo
 * sería confiable.
 *
 * El cierre guarda a la vez el saldo que calcula el sistema y el que la
 * persona contó, y la diferencia entre ambos. No se "corrige" el saldo: si
 * falta plata, el faltante queda registrado.
 */
import { ref, computed, onMounted } from 'vue'
import {
  PEN, PEN_CORTO, fechaCorta, fechaHora, TIPOS_MOV_CAJA, apiPiola,
} from '@/composables/usePiola'

// `perfil` ya no se usa en el script — quién abre, registra o cierra lo pone el
// servidor desde la sesión verificada. Se mantiene como prop porque el padre lo
// pasa junto con los permisos.
defineProps<{
  perfil: any
  puedeEditar: boolean
  puedeEliminar: boolean
}>()
const emit = defineEmits<{ (e: 'notify', payload: any): void; (e: 'cambio'): void }>()

const client = useSupabaseClient()

const cargando = ref(false)
const guardando = ref(false)
const sesiones = ref<any[]>([])
const movimientos = ref<any[]>([])
const metodosPago = ref<string[]>(['Efectivo'])

const sesionAbierta = computed(() => sesiones.value.find(s => s.estado === 'abierta') || null)
const sesionesCerradas = computed(() => sesiones.value.filter(s => s.estado === 'cerrada'))

/* ══════════ Carga ══════════ */
async function cargar() {
  cargando.value = true
  const [s, m] = await Promise.all([
    client.from('piola_caja_sesiones').select('*').order('fecha_apertura', { ascending: false }).limit(200),
    client.from('piola_payment_methods').select('nombre').eq('activo', true).order('orden'),
  ])
  if (s.error) emit('notify', { text: `Error cargando la caja: ${s.error.message}`, color: 'error' })
  sesiones.value = (s.data as any[]) || []
  const metodos = ((m.data as any[]) || []).map(x => x.nombre)
  metodosPago.value = metodos.length ? metodos : ['Efectivo']

  if (sesionAbierta.value) await cargarMovimientos(sesionAbierta.value.id)
  else movimientos.value = []
  cargando.value = false
}

async function cargarMovimientos(sesionId: number) {
  const { data } = await client.from('piola_caja_movimientos').select('*')
    .eq('sesion_id', sesionId).order('fecha', { ascending: false })
  movimientos.value = (data as any[]) || []
}

/* ══════════ Derivados ══════════ */
const etiquetaTipo = (v: any) => TIPOS_MOV_CAJA.find(t => t.value === v)?.title || v
const iconoTipo = (v: any) => TIPOS_MOV_CAJA.find(t => t.value === v)?.icon || 'mdi-circle-small'
const colorTipo = (v: any) => TIPOS_MOV_CAJA.find(t => t.value === v)?.color || 'grey'

const resumen = computed(() => {
  const ingresos = movimientos.value.filter(m => m.tipo === 'ingreso')
  const salidas = movimientos.value.filter(m => m.tipo !== 'ingreso')
  return {
    ingresos: ingresos.reduce((s, m) => s + Number(m.monto || 0), 0),
    salidas: salidas.reduce((s, m) => s + Number(m.monto || 0), 0),
    nIngresos: ingresos.length,
    nSalidas: salidas.length,
  }
})

const saldoActual = computed(() => {
  if (!sesionAbierta.value) return 0
  return Math.round(
    (Number(sesionAbierta.value.saldo_inicial || 0) + resumen.value.ingresos - resumen.value.salidas) * 100
  ) / 100
})

const headers = [
  { title: 'Fecha', key: 'fecha' },
  { title: 'Tipo', key: 'tipo', sortable: false },
  { title: 'Concepto', key: 'concepto' },
  { title: 'Método', key: 'payment_method' },
  { title: 'Destino', key: 'destino' },
  { title: 'Monto', key: 'monto' },
  { title: 'Registró', key: 'registrado_por' },
  { title: '', key: 'acciones', sortable: false },
]
const headersSesiones = [
  { title: 'Caja', key: 'nombre' },
  { title: 'Apertura', key: 'fecha_apertura' },
  { title: 'Cierre', key: 'fecha_cierre' },
  { title: 'Inicial', key: 'saldo_inicial' },
  { title: 'Final', key: 'saldo_final' },
  { title: 'Diferencia', key: 'diferencia' },
  { title: 'Responsable', key: 'cerrada_por' },
]

/* ══════════ Apertura ══════════ */
const apertura = ref<any>(null)

function abrirDialogoApertura() {
  apertura.value = { nombre: 'Caja principal', saldo_inicial: 0, observaciones: '' }
}

async function guardarApertura() {
  guardando.value = true
  // `abierta_por` lo pone el servidor a partir de la sesión verificada
  const { error } = await apiPiola('caja', {
    accion: 'abrir',
    nombre: apertura.value.nombre || 'Caja',
    saldo_inicial: Number(apertura.value.saldo_inicial || 0),
    observaciones: apertura.value.observaciones || null,
  })
  guardando.value = false
  if (error) {
    // El índice único parcial es el que impide dos cajas abiertas a la vez
    const msg = /idx_piola_caja_una_abierta|duplicate key/i.test(error.message)
      ? 'Ya hay una caja abierta. Ciérrala antes de abrir otra.'
      : `Error abriendo la caja: ${error.message}`
    return emit('notify', { text: msg, color: 'error' })
  }
  emit('notify', 'Caja abierta')
  apertura.value = null
  await cargar()
}

/* ══════════ Movimientos ══════════ */
const movimiento = ref<any>(null)

function abrirMovimiento() {
  movimiento.value = {
    tipo: 'ingreso', monto: null, concepto: '',
    payment_method: metodosPago.value[0], destino: '', observaciones: '',
  }
}

const saldoTrasMovimiento = computed(() => {
  const m = movimiento.value
  if (!m) return 0
  const delta = m.tipo === 'ingreso' ? Number(m.monto || 0) : -Number(m.monto || 0)
  return Math.round((saldoActual.value + delta) * 100) / 100
})

async function guardarMovimiento() {
  const m = movimiento.value
  if (!m.concepto?.trim() || !Number(m.monto)) {
    return emit('notify', { text: 'El movimiento necesita concepto y monto', color: 'error' })
  }
  guardando.value = true
  // El servidor resuelve a qué sesión aplica el movimiento (la caja abierta) y
  // quién lo registró: si no hay ninguna abierta, lo rechaza en vez de colgarlo
  // de una sesión ya cerrada.
  const { error } = await apiPiola('caja', {
    accion: 'movimiento',
    tipo: m.tipo,
    concepto: m.concepto.trim(),
    monto: Math.abs(Number(m.monto)),
    payment_method: m.payment_method || null,
    destino: ['transferencia', 'retiro'].includes(m.tipo) ? (m.destino || null) : null,
    observaciones: m.observaciones || null,
  })
  guardando.value = false
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Movimiento registrado')
  movimiento.value = null
  await cargarMovimientos(sesionAbierta.value.id)
  emit('cambio')
}

async function eliminarMovimiento(m: any) {
  if (!confirm(`¿Eliminar "${m.concepto}" por ${PEN(m.monto)}?`)) return
  const { error } = await apiPiola('caja', { accion: 'eliminar_movimiento', id: m.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Movimiento eliminado')
  await cargarMovimientos(sesionAbierta.value.id)
  emit('cambio')
}

/* ══════════ Cierre ══════════ */
const cierre = ref<any>(null)

function abrirCierre() {
  cierre.value = { saldo_contado: saldoActual.value, observaciones: '' }
}

const diferenciaCierre = computed(() => {
  if (!cierre.value) return 0
  return Math.round((Number(cierre.value.saldo_contado || 0) - saldoActual.value) * 100) / 100
})

async function guardarCierre() {
  guardando.value = true
  // El saldo del sistema y la diferencia los recalcula el servidor sumando los
  // movimientos: son justamente el dato que el arqueo vigila, así que no puede
  // ponerlo el navegador.
  const { data, error } = await apiPiola<{ diferencia: number }>('caja', {
    accion: 'cerrar',
    saldo_contado: Number(cierre.value.saldo_contado || 0),
    observaciones: cierre.value.observaciones || sesionAbierta.value.observaciones || null,
  })
  guardando.value = false
  if (error) return emit('notify', { text: `Error cerrando: ${error.message}`, color: 'error' })
  // Se anuncia la diferencia que calculó el servidor, no la de la pantalla
  const diferencia = Number(data?.diferencia || 0)
  emit('notify', diferencia
    ? `Caja cerrada con una diferencia de ${PEN(diferencia)}`
    : 'Caja cerrada y cuadrada')
  cierre.value = null
  await cargar()
  emit('cambio')
}

/* ══════════ Ver una sesión cerrada ══════════ */
const sesionVista = ref<any>(null)
const movimientosVistos = ref<any[]>([])

async function verSesion(s: any) {
  sesionVista.value = s
  const { data } = await client.from('piola_caja_movimientos').select('*')
    .eq('sesion_id', s.id).order('fecha', { ascending: false })
  movimientosVistos.value = (data as any[]) || []
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<style scoped>
.caja-cerrada {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 56px 24px; text-align: center;
}
.caja-cerrada h3 { font-size: 17px; margin: 0; }
.caja-cerrada p { font-size: 13px; opacity: .6; margin: 0; max-width: 420px; line-height: 1.55; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-grid .col-2 { grid-column: span 2; }

.detalle-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.detalle-campos > div { display: flex; flex-direction: column; gap: 2px; }
.detalle-campos span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55; }
.detalle-campos strong { font-size: 13.5px; }

.resumen-cierre {
  font-size: 13.5px; border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px; padding: 12px 16px;
}
.resumen-cierre > div { display: flex; justify-content: space-between; padding: 5px 0; }
.resumen-cierre .resumen-final {
  border-top: 1px solid rgba(128, 128, 128, .25); margin-top: 4px; padding-top: 8px; font-size: 15px;
}

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .col-2 { grid-column: span 1; }
}
</style>
