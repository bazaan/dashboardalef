<template>
  <div class="view-container">
    <header class="top-header">
      <h1>Configuración</h1>
      <button class="btn-primary" @click="cargar">
        <v-icon icon="mdi-refresh" size="16" /><span>Actualizar</span>
      </button>
    </header>

    <div class="content-area">
      <div class="table-section">
        <div class="table-tabs">
          <button :class="['tab', { active: tab === 'colaboradores' }]" @click="tab = 'colaboradores'">Colaboradores</button>
          <button :class="['tab', { active: tab === 'roles' }]" @click="tab = 'roles'">Roles y permisos</button>
          <button :class="['tab', { active: tab === 'etapas' }]" @click="tab = 'etapas'">Etapas del CRM</button>
          <button :class="['tab', { active: tab === 'pagos' }]" @click="tab = 'pagos'">Métodos de pago</button>
          <button :class="['tab', { active: tab === 'financiera' }]" @click="tab = 'financiera'">
            Configuración financiera
          </button>
          <button v-if="esAdmin" :class="['tab', { active: tab === 'usuarios' }]" @click="tab = 'usuarios'">
            Usuarios del sistema
          </button>
        </div>

        <!-- ══════════ COLABORADORES ══════════ -->
        <!-- ══════════ CONFIGURACIÓN FINANCIERA ══════════ -->
        <PiolaConfigFinanciera v-if="tab === 'financiera'" :perfil="perfil"
          :puede-editar="puedeEditar" :puede-eliminar="puedeEliminar"
          @notify="(p: any) => emit('notify', p)" />

        <v-card v-else-if="tab === 'colaboradores'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Colaboradores ({{ colaboradores.length }})</span>
            <v-spacer />
            <v-btn size="small" color="primary" variant="flat" @click="abrirColaborador()">
              <v-icon icon="mdi-account-plus" start /> Nuevo colaborador
            </v-btn>
          </v-card-title>
          <v-alert type="info" variant="tonal" density="compact" class="ma-4 mb-0">
            El <b>acceso al sistema</b> (correo y contraseña) se administra en "Usuarios del sistema".
            Aquí se define la ficha de Piola: rol, tipo de contrato, antigüedad y datos de planilla.
            La <b>fecha de ingreso</b> es la que arranca el conteo de vacaciones.
          </v-alert>
          <v-data-table :headers="headersColaboradores" :items="colaboradores" class="elevation-0"
            no-data-text="Todavía no hay colaboradores registrados" :items-per-page="25"
            @click:row="(_: any, r: any) => abrirColaborador(r.item)">
            <template v-slot:item.rol="{ item }">{{ nombreRol(item.role_id) }}</template>
            <template v-slot:item.tipo_contrato="{ item }">
              <v-chip size="x-small" variant="tonal" :color="item.tipo_contrato === 'planilla' ? 'primary' : 'grey'">
                {{ item.tipo_contrato === 'planilla' ? 'Planilla' : 'Honorarios' }}
              </v-chip>
            </template>
            <template v-slot:item.fecha_ingreso="{ item }">{{ fechaCorta(item.fecha_ingreso) }}</template>
            <template v-slot:item.fecha_fin_contrato="{ item }">{{ fechaCorta(item.fecha_fin_contrato) }}</template>
            <template v-slot:item.activo="{ item }">
              <v-icon :icon="item.activo ? 'mdi-check-circle' : 'mdi-close-circle'"
                :color="item.activo ? 'success' : 'grey'" size="17" />
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ ROLES Y PERMISOS ══════════ -->
        <div v-else-if="tab === 'roles'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Un rol general con acceso a todo, más un rol por módulo. Marca qué puede
            <b>ver, crear, editar y eliminar</b> cada rol en cada módulo. Ocultar un módulo en el menú
            es solo cosmética: el servidor vuelve a verificar estos permisos en cada operación.
          </v-alert>

          <v-card flat class="custom-data-table" style="padding:18px;">
            <div class="rol-nuevo">
              <v-text-field v-model="nuevoRol" label="Nombre del nuevo rol" density="compact"
                hide-details variant="outlined" @keyup.enter="crearRol" />
              <v-btn color="primary" variant="flat" @click="crearRol">Crear rol</v-btn>
            </div>

            <div v-for="rol in roles" :key="rol.id" class="rol-bloque">
              <div class="rol-head">
                <div>
                  <strong>{{ rol.nombre }}</strong>
                  <v-chip v-if="rol.es_admin" size="x-small" color="primary" variant="flat" class="ml-2">
                    Acceso total
                  </v-chip>
                  <div class="rol-desc">{{ rol.descripcion || '—' }}</div>
                </div>
                <v-btn v-if="rol.editable" icon="mdi-delete" size="x-small" variant="text" color="error"
                  @click="eliminarRol(rol)" />
              </div>

              <div v-if="!rol.es_admin" class="permisos-tabla">
                <div class="permisos-head">
                  <span>Módulo</span><span>Ver</span><span>Crear</span><span>Editar</span><span>Eliminar</span>
                </div>
                <div v-for="m in MODULOS" :key="m.id" class="permisos-fila">
                  <span class="modulo-nombre">{{ m.label }}</span>
                  <v-checkbox :model-value="tiene(rol, m.id, 'can_view')" density="compact" hide-details
                    color="primary" @update:model-value="(v: any) => setPermiso(rol, m.id, 'can_view', v)" />
                  <v-checkbox :model-value="tiene(rol, m.id, 'can_create')" density="compact" hide-details
                    color="primary" @update:model-value="(v: any) => setPermiso(rol, m.id, 'can_create', v)" />
                  <v-checkbox :model-value="tiene(rol, m.id, 'can_edit')" density="compact" hide-details
                    color="primary" @update:model-value="(v: any) => setPermiso(rol, m.id, 'can_edit', v)" />
                  <v-checkbox :model-value="tiene(rol, m.id, 'can_delete')" density="compact" hide-details
                    color="primary" @update:model-value="(v: any) => setPermiso(rol, m.id, 'can_delete', v)" />
                </div>
              </div>
              <div v-else class="rol-admin-nota">
                Este rol ignora el checklist: ve y opera todos los módulos, incluidas boletas y AFP.
              </div>
            </div>
          </v-card>
        </div>

        <!-- ══════════ ETAPAS DEL CRM ══════════ -->
        <v-card v-else-if="tab === 'etapas'" flat class="custom-data-table" style="padding:18px;">
          <v-alert type="success" variant="tonal" density="compact" class="mb-4">
            Las etapas del pipeline son <b>editables</b>: crear, renombrar, cambiar color y orden.
            Marcar una etapa como <b>ganado</b> habilita convertir el lead en cliente y la cuenta
            para comisiones; marcarla como <b>perdido</b> la saca del pipeline activo.
          </v-alert>

          <div class="etapa-nueva">
            <v-text-field v-model="nuevaEtapa.nombre" label="Nombre de la etapa" density="compact"
              hide-details variant="outlined" @keyup.enter="crearEtapa" />
            <input v-model="nuevaEtapa.color" type="color" class="color-input" title="Color" />
            <v-btn color="primary" variant="flat" @click="crearEtapa">Agregar</v-btn>
          </div>

          <div class="etapas-lista">
            <div v-for="(e, i) in etapas" :key="e.id" class="etapa-fila">
              <div class="etapa-orden">
                <v-btn icon="mdi-chevron-up" size="x-small" variant="text" :disabled="i === 0"
                  @click="mover(e, -1)" />
                <v-btn icon="mdi-chevron-down" size="x-small" variant="text" :disabled="i === etapas.length - 1"
                  @click="mover(e, 1)" />
              </div>
              <input :value="e.color" type="color" class="color-input"
                @change="(ev: any) => actualizarEtapa(e, { color: ev.target.value })" />
              <v-text-field :model-value="e.nombre" density="compact" hide-details variant="outlined"
                style="max-width:230px;" @change="(ev: any) => actualizarEtapa(e, { nombre: ev.target.value })" />
              <v-checkbox :model-value="e.es_ganado" label="Ganado" density="compact" hide-details
                color="success" @update:model-value="(v: any) => actualizarEtapa(e, { es_ganado: v, es_perdido: v ? false : e.es_perdido })" />
              <v-checkbox :model-value="e.es_perdido" label="Perdido" density="compact" hide-details
                color="error" @update:model-value="(v: any) => actualizarEtapa(e, { es_perdido: v, es_ganado: v ? false : e.es_ganado })" />
              <span class="etapa-uso">{{ contarLeads(e.id) }} lead(s)</span>
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="eliminarEtapa(e)" />
            </div>
          </div>
        </v-card>

        <!-- ══════════ MÉTODOS DE PAGO ══════════ -->
        <v-card v-else-if="tab === 'pagos'" flat class="custom-data-table" style="padding:18px;">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Hoy Piola opera solo con <b>transferencia bancaria</b>. El catálogo queda abierto por si
            más adelante se suman otros medios: basta con activarlos aquí.
          </v-alert>

          <div class="etapa-nueva">
            <v-text-field v-model="nuevoMetodo" label="Nuevo método de pago" density="compact"
              hide-details variant="outlined" @keyup.enter="crearMetodo" />
            <v-btn color="primary" variant="flat" @click="crearMetodo">Agregar</v-btn>
          </div>

          <div class="metodos-lista">
            <div v-for="m in metodos" :key="m.id" class="metodo-fila">
              <span>{{ m.nombre }}</span>
              <v-switch :model-value="m.activo" color="primary" density="compact" hide-details
                :label="m.activo ? 'Activo' : 'Inactivo'"
                @update:model-value="(v: any) => actualizarMetodo(m, v)" />
            </div>
          </div>
        </v-card>

        <!-- ══════════ USUARIOS DEL SISTEMA (acceso al login) ══════════ -->
        <div v-else-if="tab === 'usuarios' && esAdmin">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Aquí se crea el <b>acceso al sistema</b> (correo y contraseña) y se ven los logs de
            actividad. La ficha de Piola —rol, contrato, antigüedad y datos de planilla— se llena
            en la pestaña <b>Colaboradores</b>, usando el mismo correo.
          </v-alert>
          <SettingsView company-id="piola" app-name="Piola"
            :current-user-role="currentUser?.role" :current-user-id="currentUser?.id" />
        </div>
      </div>
    </div>

    <!-- ══════════ FICHA DE COLABORADOR ══════════ -->
    <v-dialog :model-value="!!colaborador" max-width="740" scrollable @update:model-value="colaborador = null">
      <v-card v-if="colaborador">
        <v-card-title class="pt-4">
          {{ colaborador.id ? 'Ficha de ' + colaborador.nombre : 'Nuevo colaborador' }}
        </v-card-title>
        <v-card-text>
          <div class="form-section-title">Datos generales</div>
          <div class="form-grid">
            <v-text-field v-model="colaborador.nombre" label="Nombre completo *" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="colaborador.email" label="Correo * (el mismo del login)"
              density="compact" hide-details variant="outlined" :disabled="!!colaborador.id" />
            <v-text-field v-model="colaborador.dni" label="DNI" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="colaborador.telefono" label="Teléfono" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="colaborador.cargo" label="Cargo" density="compact" hide-details variant="outlined" />
            <v-select v-model="colaborador.role_id" :items="opcionesRol" label="Rol en el dashboard"
              density="compact" hide-details variant="outlined" />
          </div>

          <div class="form-section-title" style="margin-top:18px;">Contrato</div>
          <div class="form-grid">
            <v-select v-model="colaborador.tipo_contrato"
              :items="[{ value: 'planilla', title: 'Planilla' }, { value: 'honorarios', title: 'Recibo por honorarios' }]"
              label="Tipo de contrato" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="colaborador.fecha_ingreso" type="date"
              label="Fecha de ingreso (inicia el conteo de vacaciones)"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model="colaborador.fecha_fin_contrato" type="date" label="Fin de contrato"
              density="compact" hide-details variant="outlined" />
            <v-text-field v-model.number="colaborador.comision_pct" type="number"
              label="% de comisión sobre lo que cierra" density="compact" hide-details variant="outlined" />
          </div>

          <template v-if="colaborador.tipo_contrato === 'planilla'">
            <div class="form-section-title" style="margin-top:18px;">Planilla (solo Administrador)</div>
            <div class="form-grid">
              <v-text-field v-model.number="colaborador.sueldo_bruto" type="number" label="Sueldo bruto (S/)"
                density="compact" hide-details variant="outlined" />
              <v-select v-model="colaborador.afp_nombre"
                :items="['Integra', 'Prima', 'Profuturo', 'Habitat', 'ONP']" label="AFP / ONP"
                density="compact" hide-details variant="outlined" clearable />
              <v-text-field v-model="colaborador.afp_cuspp" label="CUSPP" density="compact"
                hide-details variant="outlined" />
              <v-select v-model="colaborador.afp_tipo_comision" :items="['flujo', 'mixta']"
                label="Tipo de comisión AFP" density="compact" hide-details variant="outlined" clearable />
              <v-checkbox v-model="colaborador.asignacion_familiar" color="primary" density="compact"
                hide-details label="Recibe asignación familiar" />
            </div>
          </template>

          <v-checkbox v-model="colaborador.activo" color="primary" density="compact" hide-details
            label="Colaborador activo" class="mt-3" />
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="colaborador.id" color="error" variant="text" @click="eliminarColaborador">Eliminar</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="colaborador = null">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="guardando" @click="guardarColaborador">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * Módulo Configuración (§8 y catálogos).
 *
 * Todo lo que el cliente pidió poder cambiar SIN desarrollo vive aquí:
 * roles con checklist de módulos, fichas de colaborador (contrato, antigüedad,
 * % de comisión, datos AFP), etapas del CRM y métodos de pago.
 * Las categorías de gasto —que también son editables— están en Contabilidad,
 * junto a los movimientos que las usan.
 */
import { ref, computed, onMounted } from 'vue'
import { piolaCan } from '@/utils/permissions'
import { fechaCorta, traerTodo, apiPiola } from '@/composables/usePiola'
import SettingsView from '@/components/Settings/SettingsView.vue'
import PiolaConfigFinanciera from './PiolaConfigFinanciera.vue'

const props = defineProps<{ perfil: any; currentUser?: any }>()
const emit = defineEmits<{
  (e: 'notify', payload: any): void
  (e: 'perfil-actualizado'): void
}>()

const client = useSupabaseClient()
const tab = ref('colaboradores')
const esAdmin = computed(() => props.perfil?.es_admin === true)

// La configuración financiera se edita con el permiso del propio módulo
const puedeEditar = computed(() => piolaCan(props.perfil?.permisos, 'configuracion', 'edit'))
const puedeEliminar = computed(() => piolaCan(props.perfil?.permisos, 'configuracion', 'delete'))

const MODULOS = [
  { id: 'home', label: 'Dashboard' },
  { id: 'mi_espacio', label: 'Mi espacio' },
  { id: 'crm', label: 'CRM Comercial' },
  { id: 'contabilidad', label: 'Contabilidad' },
  { id: 'facturacion', label: 'Facturación' },
  { id: 'produccion', label: 'Producción' },
  { id: 'rrhh', label: 'RR. HH.' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'configuracion', label: 'Configuración' },
]

const colaboradores = ref<any[]>([])
const roles = ref<any[]>([])
const permisos = ref<any[]>([])
const etapas = ref<any[]>([])
const metodos = ref<any[]>([])
const leads = ref<any[]>([])

async function cargar() {
  const [c, r, p, e, m, l] = await Promise.all([
    client.from('piola_colaboradores').select('*').order('nombre'),
    client.from('piola_roles').select('*').order('id'),
    client.from('piola_role_permissions').select('*'),
    client.from('piola_lead_stages').select('*').order('orden'),
    client.from('piola_payment_methods').select('*').order('orden'),
    traerTodo(() => client.from('piola_leads').select('id, stage_id').order('id')),
  ])
  colaboradores.value = (c.data as any[]) || []
  roles.value = (r.data as any[]) || []
  permisos.value = (p.data as any[]) || []
  etapas.value = (e.data as any[]) || []
  metodos.value = (m.data as any[]) || []
  leads.value = (l.data as any[]) || []
}

const nombreRol = (id: any) => roles.value.find(r => r.id === id)?.nombre || '—'
const opcionesRol = computed(() => roles.value.map(r => ({ value: r.id, title: r.nombre })))

const headersColaboradores = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Correo', key: 'email' },
  { title: 'Cargo', key: 'cargo' },
  { title: 'Rol', key: 'rol', sortable: false },
  { title: 'Contrato', key: 'tipo_contrato' },
  { title: 'Ingreso', key: 'fecha_ingreso' },
  { title: 'Fin contrato', key: 'fecha_fin_contrato' },
  { title: 'Activo', key: 'activo' },
]

/* ══════════ Colaboradores ══════════ */
const colaborador = ref<any>(null)
const guardando = ref(false)

function abrirColaborador(item?: any) {
  colaborador.value = item
    ? {
        ...item,
        fecha_ingreso: item.fecha_ingreso ? String(item.fecha_ingreso).slice(0, 10) : '',
        fecha_fin_contrato: item.fecha_fin_contrato ? String(item.fecha_fin_contrato).slice(0, 10) : '',
      }
    : {
        nombre: '', email: '', dni: '', telefono: '', cargo: '', role_id: null,
        tipo_contrato: 'honorarios', fecha_ingreso: '', fecha_fin_contrato: '',
        comision_pct: 0, sueldo_bruto: null, afp_nombre: null, afp_cuspp: '',
        afp_tipo_comision: null, asignacion_familiar: false, activo: true,
      }
}

async function guardarColaborador() {
  const c = colaborador.value
  if (!c.nombre?.trim() || !c.email?.trim()) {
    return emit('notify', { text: 'Nombre y correo son obligatorios', color: 'error' })
  }
  guardando.value = true
  const fila: Record<string, any> = {
    nombre: c.nombre.trim(), email: c.email.trim().toLowerCase(),
    dni: c.dni || null, telefono: c.telefono || null, cargo: c.cargo || null,
    role_id: c.role_id || null, tipo_contrato: c.tipo_contrato,
    fecha_ingreso: c.fecha_ingreso || null, fecha_fin_contrato: c.fecha_fin_contrato || null,
    comision_pct: Number(c.comision_pct || 0),
    sueldo_bruto: c.sueldo_bruto ? Number(c.sueldo_bruto) : null,
    afp_nombre: c.afp_nombre || null, afp_cuspp: c.afp_cuspp || null,
    afp_tipo_comision: c.afp_tipo_comision || null,
    asignacion_familiar: !!c.asignacion_familiar,
    activo: c.activo !== false, updated_at: new Date().toISOString(),
  }
  // Sueldo, comisión y CUSPP solo los acepta el servidor de un Administrador, y
  // solo si cambian; el rol exige además permiso de Configuración.
  const res = await apiPiola('colaborador', { accion: 'guardar', id: c.id || null, ...fila })
  guardando.value = false
  if (res.error) return emit('notify', { text: `Error: ${res.error.message}`, color: 'error' })
  emit('notify', c.id ? 'Ficha actualizada' : 'Colaborador registrado')
  colaborador.value = null
  await cargar()
  emit('perfil-actualizado')
}

async function eliminarColaborador() {
  if (!confirm(`¿Eliminar la ficha de ${colaborador.value.nombre}? Su acceso al sistema no se toca.`)) return
  const { error } = await apiPiola('colaborador', { accion: 'eliminar', id: colaborador.value.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Ficha eliminada')
  colaborador.value = null
  await cargar()
}

/* ══════════ Roles y permisos ══════════ */
const nuevoRol = ref('')

const tiene = (rol: any, modulo: string, campo: string) =>
  permisos.value.find(p => p.role_id === rol.id && p.module === modulo)?.[campo] === true

async function setPermiso(rol: any, modulo: string, campo: string, valor: boolean) {
  const existente = permisos.value.find(p => p.role_id === rol.id && p.module === modulo)

  // Marcar crear/editar/eliminar sin "ver" no tiene sentido: se activa solo.
  const patch: Record<string, any> = { [campo]: valor }
  if (valor && campo !== 'can_view') patch.can_view = true
  if (!valor && campo === 'can_view') {
    patch.can_create = false; patch.can_edit = false; patch.can_delete = false
  }

  // El servidor repite el "activar can_view solo" y exige Administrador: un
  // permiso que sirve para ampliarse el permiso no es un permiso.
  const { data, error } = await apiPiola<{ permiso: any }>('configuracion', {
    accion: 'permiso_set', role_id: rol.id, module: modulo, campo, valor,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })

  if (existente) Object.assign(existente, data?.permiso || patch)
  else if (data?.permiso) permisos.value.push(data.permiso as any)
  emit('perfil-actualizado')
}

async function crearRol() {
  if (!nuevoRol.value.trim()) return
  const { error } = await apiPiola('configuracion', { accion: 'rol_crear', nombre: nuevoRol.value.trim() })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  nuevoRol.value = ''
  emit('notify', 'Rol creado — marca sus módulos abajo')
  await cargar()
}

async function eliminarRol(rol: any) {
  const usados = colaboradores.value.filter(c => c.role_id === rol.id).length
  if (usados) {
    return emit('notify', {
      text: `No se puede eliminar: ${usados} colaborador(es) tienen este rol. Cámbialos primero.`,
      color: 'error',
    })
  }
  if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return
  const { error } = await apiPiola('configuracion', { accion: 'rol_eliminar', id: rol.id })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Rol eliminado')
  await cargar()
}

/* ══════════ Etapas del CRM ══════════ */
const nuevaEtapa = ref<any>({ nombre: '', color: '#5b8def' })

const contarLeads = (stageId: any) => leads.value.filter(l => l.stage_id === stageId).length

async function crearEtapa() {
  if (!nuevaEtapa.value.nombre.trim()) return
  const { error } = await apiPiola('configuracion', {
    accion: 'catalogo_crear', tabla: 'piola_lead_stages',
    fila: {
      nombre: nuevaEtapa.value.nombre.trim(),
      color: nuevaEtapa.value.color,
      orden: etapas.value.length + 1,
    },
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  nuevaEtapa.value = { nombre: '', color: '#5b8def' }
  emit('notify', 'Etapa agregada')
  await cargar()
}

async function actualizarEtapa(e: any, patch: any) {
  const { error } = await apiPiola('configuracion', {
    accion: 'catalogo_actualizar', tabla: 'piola_lead_stages', id: e.id, patch,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  Object.assign(e, patch)
}

async function mover(e: any, delta: number) {
  const i = etapas.value.findIndex(x => x.id === e.id)
  const j = i + delta
  if (j < 0 || j >= etapas.value.length) return
  const otra = etapas.value[j]
  // Los dos `orden` los relee el servidor: intercambiarlos con los números de
  // una pestaña vieja dejaría dos etapas empatadas.
  const { error } = await apiPiola('configuracion', {
    accion: 'etapa_mover', id: e.id, otra_id: otra.id,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  await cargar()
}

async function eliminarEtapa(e: any) {
  const usados = contarLeads(e.id)
  if (usados) {
    return emit('notify', {
      text: `No se puede eliminar: ${usados} lead(s) están en "${e.nombre}". Muévelos primero.`,
      color: 'error',
    })
  }
  if (!confirm(`¿Eliminar la etapa "${e.nombre}"?`)) return
  const { error } = await apiPiola('configuracion', {
    accion: 'catalogo_eliminar', tabla: 'piola_lead_stages', id: e.id,
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  emit('notify', 'Etapa eliminada')
  await cargar()
}

/* ══════════ Métodos de pago ══════════ */
const nuevoMetodo = ref('')

async function crearMetodo() {
  if (!nuevoMetodo.value.trim()) return
  const { error } = await apiPiola('configuracion', {
    accion: 'catalogo_crear', tabla: 'piola_payment_methods',
    fila: { nombre: nuevoMetodo.value.trim(), activo: true, orden: metodos.value.length + 1 },
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  nuevoMetodo.value = ''
  await cargar()
}

async function actualizarMetodo(m: any, activo: boolean) {
  const { error } = await apiPiola('configuracion', {
    accion: 'catalogo_actualizar', tabla: 'piola_payment_methods', id: m.id, patch: { activo },
  })
  if (error) return emit('notify', { text: `Error: ${error.message}`, color: 'error' })
  m.activo = activo
}

onMounted(cargar)
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-section-title {
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .4px; opacity: .65; margin-bottom: 10px;
}

.rol-nuevo { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 20px; }
.rol-bloque {
  border: 1px solid rgba(128, 128, 128, .2); border-radius: 10px;
  padding: 14px 16px; margin-bottom: 14px;
}
.rol-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.rol-desc { font-size: 11.5px; opacity: .55; margin-top: 2px; }
.rol-admin-nota { font-size: 12.5px; opacity: .6; font-style: italic; }

.permisos-tabla { font-size: 13px; }
.permisos-head, .permisos-fila {
  display: grid; grid-template-columns: 1.7fr repeat(4, 68px); align-items: center; gap: 4px;
}
.permisos-head {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; opacity: .55;
  border-bottom: 1px solid rgba(128, 128, 128, .18); padding-bottom: 5px; margin-bottom: 3px;
}
.permisos-head span:not(:first-child) { text-align: center; }
.permisos-fila { border-bottom: 1px solid rgba(128, 128, 128, .08); }
.permisos-fila:last-child { border-bottom: none; }
.modulo-nombre { font-size: 12.5px; }
.permisos-fila :deep(.v-checkbox) { justify-content: center; display: flex; }

.etapa-nueva { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; margin-bottom: 18px; align-items: center; }
.color-input {
  width: 40px; height: 38px; border: 1px solid rgba(128, 128, 128, .3);
  border-radius: 7px; cursor: pointer; background: none; padding: 2px;
}
.etapas-lista { display: flex; flex-direction: column; gap: 6px; }
.etapa-fila {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 8px 10px; border: 1px solid rgba(128, 128, 128, .16); border-radius: 9px;
}
.etapa-orden { display: flex; flex-direction: column; gap: 0; }
.etapa-uso { font-size: 11.5px; opacity: .55; margin-left: auto; }

.metodos-lista { display: flex; flex-direction: column; gap: 4px; }
.metodo-fila {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid rgba(128, 128, 128, .12); font-size: 13.5px;
}

@media (max-width: 800px) {
  .form-grid { grid-template-columns: 1fr; }
  .permisos-head, .permisos-fila { grid-template-columns: 1.4fr repeat(4, 50px); }
  .etapa-nueva { grid-template-columns: 1fr; }
}
</style>
