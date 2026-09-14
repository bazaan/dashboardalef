<!--
  Trade Cars — Configuración: roles y colaboradores (14/09/2026)
  ---------------------------------------------------------------
  Mismo diseño que components/Piola/PiolaConfiguracion.vue (pestaña "Roles y
  permisos" + "Colaboradores"), simplificado: acá no hay datos de planilla
  que proteger, así que la ficha del colaborador es sólo nombre/cargo/rol.

  Sólo lo ve quien tiene permiso de 'configuracion' (en la práctica, sólo
  Administrador — ver server/api/tradecars/configuracion.post.ts) y sólo un
  Administrador puede escribir: el servidor lo vuelve a exigir con
  exigirAdminTradeCars(), esta pantalla no es la única puerta pero si alguien
  la abre sin permiso el servidor rechaza cada acción igual.
-->
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
          <button :class="['tab', { active: tab === 'colaboradores' }]" @click="tab = 'colaboradores'">
            Colaboradores
          </button>
          <button :class="['tab', { active: tab === 'roles' }]" @click="tab = 'roles'">
            Roles y permisos
          </button>
        </div>

        <!-- ══════════ COLABORADORES ══════════ -->
        <v-card v-if="tab === 'colaboradores'" flat class="custom-data-table">
          <v-card-title class="table-search-bar">
            <span class="table-title">Colaboradores ({{ colaboradores.length }})</span>
            <v-spacer />
            <v-btn size="small" color="primary" variant="flat" @click="abrirColaborador()">
              <v-icon icon="mdi-account-plus" start /> Nuevo colaborador
            </v-btn>
          </v-card-title>
          <v-alert type="info" variant="tonal" density="compact" class="ma-4 mb-0">
            El <b>acceso al sistema</b> (correo y contraseña) se administra en Settings → Usuarios.
            Aquí sólo se define qué rol de Trade Cars tiene cada quien, usando el mismo correo.
          </v-alert>
          <v-data-table :headers="headersColaboradores" :items="colaboradores" class="elevation-0"
            no-data-text="Todavía no hay colaboradores registrados" :items-per-page="25"
            @click:row="(_: any, r: any) => abrirColaborador(r.item)">
            <template v-slot:item.rol="{ item }">{{ nombreRol(item.role_id) }}</template>
            <template v-slot:item.activo="{ item }">
              <v-icon :icon="item.activo ? 'mdi-check-circle' : 'mdi-close-circle'"
                :color="item.activo ? 'success' : 'grey'" size="17" />
            </template>
          </v-data-table>
        </v-card>

        <!-- ══════════ ROLES Y PERMISOS ══════════ -->
        <div v-else-if="tab === 'roles'">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            Un rol con acceso total ("Administrador") más los roles por cargo. Marca qué puede
            <b>ver, crear, editar y eliminar</b> cada rol en cada módulo del menú. El menú es sólo
            cosmética — algunos módulos además pasan por el servidor, ver la nota en
            sql/tradecars_roles.sql.
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
                Este rol ignora el checklist: ve y opera todos los módulos.
              </div>
            </div>
          </v-card>
        </div>
      </div>
    </div>

    <!-- ══════════ FICHA DE COLABORADOR ══════════ -->
    <v-dialog :model-value="!!colaborador" max-width="520" scrollable @update:model-value="colaborador = null">
      <v-card v-if="colaborador">
        <v-card-title class="pt-4">
          {{ colaborador.id ? 'Ficha de ' + colaborador.nombre : 'Nuevo colaborador' }}
        </v-card-title>
        <v-card-text>
          <div class="form-grid">
            <v-text-field v-model="colaborador.nombre" label="Nombre completo *" density="compact"
              hide-details variant="outlined" />
            <v-text-field v-model="colaborador.email" label="Correo * (el mismo del login)"
              density="compact" hide-details variant="outlined" :disabled="!!colaborador.id" />
            <v-text-field v-model="colaborador.cargo" label="Cargo" density="compact" hide-details variant="outlined" />
            <v-text-field v-model="colaborador.telefono" label="Teléfono" density="compact" hide-details variant="outlined" />
            <v-select v-model="colaborador.role_id" :items="opcionesRol" label="Rol en Trade Cars"
              density="compact" hide-details variant="outlined" style="grid-column: 1 / -1;" />
          </div>
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
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'notificar', texto: string, color?: string): void
  (e: 'perfil-actualizado'): void
}>()
const notify = (texto: string, color = 'success') => emit('notificar', texto, color)

const client = useSupabaseClient()
const tab = ref('colaboradores')

const MODULOS = [
  { id: 'home', label: 'Dashboard' },
  { id: 'funnel', label: 'Funnel de Ventas' },
  { id: 'comercial', label: 'Solicitudes, Clientes y Leads' },
  { id: 'operaciones', label: 'Vehículos, Ventas, Compras y Agenda' },
  { id: 'finanzas', label: 'Egresos' },
  { id: 'tasador', label: 'Tasador IA' },
  { id: 'configuracion', label: 'Configuración' },
]

const colaboradores = ref<any[]>([])
const roles = ref<any[]>([])
const permisos = ref<any[]>([])

async function apiTradeCars<T = any>(body: Record<string, any>): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const data = await $fetch<T>('/api/tradecars/configuracion', { method: 'POST', body })
    return { data, error: null }
  } catch (e: any) {
    const message = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message
      || 'No se pudo completar la operación'
    return { data: null, error: { message: String(message) } }
  }
}

async function cargar() {
  const [c, r, p] = await Promise.all([
    client.from('tradecars_colaboradores').select('*').order('nombre'),
    client.from('tradecars_roles').select('*').order('id'),
    client.from('tradecars_role_permissions').select('*'),
  ])
  colaboradores.value = (c.data as any[]) || []
  roles.value = (r.data as any[]) || []
  permisos.value = (p.data as any[]) || []
}
onMounted(cargar)

const nombreRol = (id: any) => roles.value.find(r => r.id === id)?.nombre || '—'
const opcionesRol = computed(() => roles.value.map(r => ({ value: r.id, title: r.nombre })))

const headersColaboradores = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Correo', key: 'email' },
  { title: 'Cargo', key: 'cargo' },
  { title: 'Rol', key: 'rol', sortable: false },
  { title: 'Activo', key: 'activo' },
]

/* ══════════ Colaboradores ══════════ */
const colaborador = ref<any>(null)
const guardando = ref(false)

function abrirColaborador(item?: any) {
  colaborador.value = item
    ? { ...item }
    : { nombre: '', email: '', cargo: '', telefono: '', role_id: null, activo: true }
}

async function guardarColaborador() {
  const c = colaborador.value
  if (!c.nombre?.trim() || !c.email?.trim()) {
    return notify('Nombre y correo son obligatorios', 'error')
  }
  guardando.value = true
  const { error } = await apiTradeCars({
    accion: 'colaborador_guardar', id: c.id || null,
    nombre: c.nombre.trim(), email: c.email.trim().toLowerCase(),
    cargo: c.cargo || null, telefono: c.telefono || null,
    role_id: c.role_id || null, activo: c.activo !== false,
  })
  guardando.value = false
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify(c.id ? 'Ficha actualizada' : 'Colaborador registrado')
  colaborador.value = null
  await cargar()
  emit('perfil-actualizado')
}

async function eliminarColaborador() {
  if (!confirm(`¿Eliminar la ficha de ${colaborador.value.nombre}? Su acceso al sistema no se toca.`)) return
  const { error } = await apiTradeCars({ accion: 'colaborador_eliminar', id: colaborador.value.id })
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify('Ficha eliminada')
  colaborador.value = null
  await cargar()
}

/* ══════════ Roles y permisos ══════════ */
const nuevoRol = ref('')

const tiene = (rol: any, modulo: string, campo: string) =>
  permisos.value.find(p => p.role_id === rol.id && p.module === modulo)?.[campo] === true

async function setPermiso(rol: any, modulo: string, campo: string, valor: boolean) {
  const existente = permisos.value.find(p => p.role_id === rol.id && p.module === modulo)
  const patch: Record<string, any> = { [campo]: valor }
  if (valor && campo !== 'can_view') patch.can_view = true
  if (!valor && campo === 'can_view') {
    patch.can_create = false; patch.can_edit = false; patch.can_delete = false
  }

  const { data, error } = await apiTradeCars<{ permiso: any }>({
    accion: 'permiso_set', role_id: rol.id, module: modulo, campo, valor,
  })
  if (error) return notify(`Error: ${error.message}`, 'error')

  if (existente) Object.assign(existente, data?.permiso || patch)
  else if (data?.permiso) permisos.value.push(data.permiso as any)
  emit('perfil-actualizado')
}

async function crearRol() {
  if (!nuevoRol.value.trim()) return
  const { error } = await apiTradeCars({ accion: 'rol_crear', nombre: nuevoRol.value.trim() })
  if (error) return notify(`Error: ${error.message}`, 'error')
  nuevoRol.value = ''
  notify('Rol creado — marca sus módulos abajo')
  await cargar()
}

async function eliminarRol(rol: any) {
  const usados = colaboradores.value.filter(c => c.role_id === rol.id).length
  if (usados) {
    return notify(`No se puede eliminar: ${usados} colaborador(es) tienen este rol. Cámbialos primero.`, 'error')
  }
  if (!confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return
  const { error } = await apiTradeCars({ accion: 'rol_eliminar', id: rol.id })
  if (error) return notify(`Error: ${error.message}`, 'error')
  notify('Rol eliminado')
  await cargar()
}
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

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

@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
  .permisos-head, .permisos-fila { grid-template-columns: 1.3fr repeat(4, 48px); }
}
</style>
