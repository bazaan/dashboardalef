<template>
    <div class="view-container fill-height d-flex flex-column pa-4">
        <!-- HEADER -->
        <header class="d-flex align-center justify-space-between mb-4">
            <h1 class="text-h4 font-weight-bold">Configuración - {{ appName || companyId }}</h1>
        </header>

        <!-- TABS & CONTENT -->
        <div class="content-area flex-grow-1 overflow-hidden d-flex flex-column bg-surface rounded-lg elevation-1">
            <v-tabs v-model="activeTab" bg-color="surface" color="primary">
                <v-tab value="perfiles">Perfiles</v-tab>
                <v-tab value="logs">Logs</v-tab>
            </v-tabs>
            <v-divider></v-divider>

            <v-window v-model="activeTab" class="flex-grow-1 overflow-y-auto">
                <!-- PERFILES TAB -->
                <v-window-item value="perfiles" class="fill-height">
                    <div class="d-flex flex-column fill-height pa-4">
                        <div class="d-flex justify-space-between align-center mb-4">
                            <h3 class="text-h6">Gestión de Usuarios</h3>
                            <v-btn v-if="canCreateUser" color="primary" @click="showCreateUserDialog = true"
                                prepend-icon="mdi-account-plus">
                                Nuevo Usuario
                            </v-btn>
                        </div>

                        <v-data-table :headers="headers" :items="users" :loading="loading"
                            class="elevation-0 border rounded flex-grow-1" density="compact"
                            no-data-text="No se encontraron usuarios">
                            <template v-slot:item.role="{ item }">
                                <v-chip :color="getRoleColor(item.role)" size="small" class="text-capitalize">
                                    {{ item.role }}
                                </v-chip>
                            </template>
                            <template v-slot:item.created_at="{ item }">
                                {{ new Date(item.created_at).toLocaleDateString() }}
                            </template>
                            <template v-slot:item.acciones="{ item }">
                                <v-btn v-if="canEditUser" icon="mdi-pencil" size="small" variant="text" color="primary"
                                    class="mr-2" @click="openEditDialog(item)" title="Editar Usuario"></v-btn>
                                <v-btn v-if="canDeleteUser" icon="mdi-delete" size="small" variant="text" color="error"
                                    @click="confirmDelete(item)" title="Eliminar Usuario"></v-btn>
                            </template>
                        </v-data-table>
                    </div>
                </v-window-item>

                <!-- LOGS TAB -->
                <v-window-item value="logs" class="fill-height">
                    <div class="d-flex flex-column fill-height pa-4">
                        <div class="d-flex justify-space-between align-center mb-4">
                            <h3 class="text-h6">Registro de Actividades</h3>
                            <v-btn color="primary" @click="fetchLogs" prepend-icon="mdi-refresh">
                                Refrescar
                            </v-btn>
                        </div>

                        <v-data-table :headers="logHeaders" :items="logs" :loading="loadingLogs"
                            class="elevation-0 border rounded flex-grow-1" density="compact"
                            no-data-text="No se encontraron registros de actividad">
                            <template v-slot:item.created_at="{ item }">
                                {{ new Date(item.created_at).toLocaleString() }}
                            </template>
                        </v-data-table>
                    </div>
                </v-window-item>
            </v-window>
        </div>

        <!-- Dialogs -->
        <CreateUserDialog v-model="showCreateUserDialog" :company-id="companyId" @user-created="fetchUsers" />
        <EditUserDialog v-if="userToEdit" v-model="showEditUserDialog" :user="userToEdit" :company-id="companyId" @user-updated="handleUserUpdated" />

        <!-- Confirm Delete Dialog -->
        <v-dialog v-model="showDeleteConfirmDialog" max-width="400">
            <v-card>
                <v-card-title class="text-h6 bg-error text-white">
                    Confirmar Eliminación
                </v-card-title>
                <v-card-text class="pt-4 pb-2">
                    <p>¿Estás seguro de que deseas eliminar permanentemente el usuario <strong>{{ userToDelete?.full_name }}</strong> ({{ userToDelete?.email }})?</p>
                    <p class="text-caption text-error mt-2">Esta acción no se puede deshacer.</p>
                    <v-alert v-if="deleteErrorMsg" type="error" variant="tonal" class="mt-3" density="compact">
                        {{ deleteErrorMsg }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="px-4 pb-4">
                    <v-spacer></v-spacer>
                    <v-btn color="grey-darken-1" variant="text" @click="showDeleteConfirmDialog = false" :disabled="deleting">
                        Cancelar
                    </v-btn>
                    <v-btn color="error" variant="elevated" :loading="deleting" @click="deleteUser">
                        Eliminar
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Global Snackbar -->
        <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
            {{ snackbar.text }}
            <template v-slot:actions>
                <v-btn color="white" variant="text" @click="snackbar.show = false">
                    Cerrar
                </v-btn>
            </template>
        </v-snackbar>

    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import CreateUserDialog from './CreateUserDialog.vue'
import EditUserDialog from './EditUserDialog.vue'

const props = defineProps<{
    companyId: string
    appName?: string
    currentUserRole?: string // Optional, to control permission
    currentUserId?: string   // ID of currently logged in user to prevent self-deletion
}>()

const activeTab = ref('perfiles')
const users = ref<any[]>([])
const loading = ref(false)
const showCreateUserDialog = ref(false)

// Edit State
const showEditUserDialog = ref(false)
const userToEdit = ref<any>(null)

// Delete State
const showDeleteConfirmDialog = ref(false)
const userToDelete = ref<any>(null)
const deleting = ref(false)
const deleteErrorMsg = ref('')

// Snackbar for global notifications
const snackbar = ref({
    show: false,
    text: '',
    color: 'success'
})

// Variables para Logs
const logs = ref<any[]>([])
const loadingLogs = ref(false)
const logHeaders: any = [
    { title: 'Usuario', key: 'user_email', align: 'start', sortable: true },
    { title: 'Actividad', key: 'activity', align: 'start', sortable: true },
    { title: 'Fecha y Hora', key: 'created_at', align: 'start', sortable: true },
]

const headers: any = [
    { title: 'Nombre Completo', key: 'full_name' },
    { title: 'Email', key: 'email' },
    { title: 'Rol', key: 'role' },
    // { title: 'Creado', key: 'created_at' },
    { title: 'Acciones', key: 'acciones', sortable: false, align: 'end' }
]

const canCreateUser = computed(() => {
    if (props.currentUserRole) {
        return props.currentUserRole === 'admin' || props.currentUserRole === 'superadmin'
    }
    return true
})

const canEditUser = computed(() => {
    if (props.currentUserRole) {
        return props.currentUserRole === 'admin' || props.currentUserRole === 'superadmin'
    }
    return true
})

const canDeleteUser = computed(() => {
    if (props.currentUserRole) {
        return props.currentUserRole === 'admin' || props.currentUserRole === 'superadmin'
    }
    return true
})

const getRoleColor = (role: string) => {
    switch (role) {
        case 'superadmin': return 'purple'
        case 'admin': return 'blue'
        case 'agente': return 'green'
        default: return 'grey'
    }
}

const fetchUsers = async () => {
    loading.value = true
    try {
        const { users: data } = await $fetch(`/api/users?company_id=${encodeURIComponent(props.companyId)}`)
        users.value = data || []
    } catch (e) {
        console.error('Error fetching users:', e)
    } finally {
        loading.value = false
    }
}

const fetchLogs = async () => {
    loadingLogs.value = true
    try {
        const client = useSupabaseClient()
        // Siempre filtrar por company_id del dashboard actual,
        // aunque el usuario sea superadmin — cada dashboard solo ve sus propios logs
        const { data, error } = await client
            .from('activity_logs')
            .select('*')
            .eq('company_id', props.companyId)
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) throw error
        logs.value = data || []
    } catch (e: any) {
        console.error('Error fetching logs:', e.message)
    } finally {
        loadingLogs.value = false
    }
}

// Edit Actions
const openEditDialog = (user: any) => {
    userToEdit.value = { ...user } // Pass a copy to avoid immediate prop mutations
    showEditUserDialog.value = true
}

const handleUserUpdated = () => {
    fetchUsers()
}

// Delete Actions
const confirmDelete = (user: any) => {
    if (props.currentUserId && user.id === props.currentUserId) {
        showSnackbar('No puedes eliminar tu propio usuario.', 'warning')
        return
    }
    userToDelete.value = user
    deleteErrorMsg.value = ''
    showDeleteConfirmDialog.value = true
}

const deleteUser = async () => {
    if (!userToDelete.value?.id) return

    deleting.value = true
    deleteErrorMsg.value = ''

    try {
        await $fetch('/api/users/delete', {
            method: 'DELETE' as any,
            body: { id: userToDelete.value.id }
        })
        
        showDeleteConfirmDialog.value = false
        showSnackbar('Usuario eliminado exitosamente.')
        fetchUsers() // Refresh list
    } catch (e: any) {
        deleteErrorMsg.value = e.data?.statusMessage || e.message || 'Error al eliminar usuario'
    } finally {
        deleting.value = false
    }
}

const showSnackbar = (text: string, color: string = 'success') => {
    snackbar.value.text = text
    snackbar.value.color = color
    snackbar.value.show = true
}

// Fetch users on mount
onMounted(() => {
    fetchUsers()
    fetchLogs()
})

watch(activeTab, (val) => {
    if (val === 'perfiles') {
        fetchUsers()
    } else if (val === 'logs') {
        fetchLogs()
    }
})

</script>

<style scoped>
/* Scoped styles specific to SettingsView if needed */
</style>
