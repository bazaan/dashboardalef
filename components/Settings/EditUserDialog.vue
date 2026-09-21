<template>
    <v-dialog v-model="dialog" max-width="500px">
        <v-card class="edit-user-card">
            <v-card-title class="text-h5 bg-primary text-white">
                Editar Usuario
            </v-card-title>

            <v-card-text class="pt-4">
                <v-form ref="form" v-model="valid" @submit.prevent="submit">
                    <v-text-field v-model="fullName" label="Nombre Completo" variant="outlined" density="compact"
                        :rules="[rules.required]" class="mb-2"></v-text-field>

                    <v-text-field v-model="email" label="Correo Electrónico" variant="outlined" density="compact"
                        :rules="[rules.required, rules.email]" class="mb-2"></v-text-field>

                    <v-text-field v-if="esGatwick" v-model="telefono"
                        label="Teléfono (alertas de emergencia Gatwick)"
                        placeholder="+51955322269" variant="outlined" density="compact" class="mb-2"
                        hint="Opcional. Dejar en blanco para no cambiarlo." persistent-hint></v-text-field>

                    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mt-2" closable>
                        {{ errorMsg }}
                    </v-alert>

                    <v-alert v-if="successMsg" type="success" variant="tonal" class="mt-2" closable>
                        {{ successMsg }}
                    </v-alert>

                </v-form>

                <!-- Cambiar la contraseña de este usuario. Solo lo ve quien tiene permiso (superadmin de Alef y,
                     en Piola, Raysa y Edson); el servidor lo vuelve a exigir y pide la contraseña propia. -->
                <template v-if="puedeCambiarPassword">
                    <v-divider class="my-4"></v-divider>
                    <div class="text-subtitle-2 mb-2">Cambiar contraseña</div>

                    <v-text-field v-model="nuevaPassword" label="Nueva contraseña" variant="outlined" density="compact"
                        :type="verPassword ? 'text' : 'password'" autocomplete="new-password"
                        :append-inner-icon="verPassword ? 'mdi-eye-off' : 'mdi-eye'"
                        @click:append-inner="verPassword = !verPassword"
                        hint="Mínimo 8 caracteres" persistent-hint class="mb-3"></v-text-field>

                    <v-text-field v-model="tuPassword" label="Tu contraseña (para confirmar)" variant="outlined"
                        density="compact" type="password" autocomplete="current-password"
                        hint="La contraseña con la que tú entras al sistema" persistent-hint class="mb-3"></v-text-field>

                    <v-alert v-if="errorPassword" type="error" variant="tonal" density="compact" class="mb-3" closable>
                        {{ errorPassword }}
                    </v-alert>
                    <v-alert v-if="exitoPassword" type="success" variant="tonal" density="compact" class="mb-3" closable>
                        {{ exitoPassword }}
                    </v-alert>

                    <v-btn color="primary" variant="tonal" :loading="cambiandoPassword"
                        :disabled="!nuevaPassword || !tuPassword" @click="cambiarPassword">
                        Cambiar contraseña
                    </v-btn>
                </template>
            </v-card-text>

            <v-card-actions class="pb-4 px-4">
                <v-spacer></v-spacer>
                <v-btn color="grey-darken-1" variant="text" @click="dialog = false">
                    Cancelar
                </v-btn>
                <v-btn color="primary" variant="elevated" :loading="loading" :disabled="!valid" @click="submit">
                    Guardar Cambios
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
    user: any // The user object to edit
    companyId: string
}>()

const dialog = defineModel<boolean>('modelValue')
const emit = defineEmits(['user-updated'])

const form = ref()
const valid = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const fullName = ref('')
const email = ref('')
const telefono = ref('')

// Cambio de contraseña (solo para quien el servidor autorice: ver server/utils/usuarios-password.ts)
const puedeCambiarPassword = ref(false)
const nuevaPassword = ref('')
const tuPassword = ref('')
const verPassword = ref(false)
const cambiandoPassword = ref(false)
const errorPassword = ref('')
const exitoPassword = ref('')

async function consultarPermisoPassword() {
    try {
        const r: any = await $fetch('/api/users/password')
        puedeCambiarPassword.value = !!r?.puede
    } catch {
        puedeCambiarPassword.value = false
    }
}

// Cada vez que se abre el diálogo: campos limpios y permiso consultado de nuevo
watch(dialog, (abierto) => {
    if (!abierto) return
    nuevaPassword.value = ''
    tuPassword.value = ''
    verPassword.value = false
    errorPassword.value = ''
    exitoPassword.value = ''
    consultarPermisoPassword()
}, { immediate: true })

const cambiarPassword = async () => {
    errorPassword.value = ''
    exitoPassword.value = ''
    if (nuevaPassword.value.length < 8) {
        errorPassword.value = 'La contraseña nueva debe tener al menos 8 caracteres'
        return
    }
    cambiandoPassword.value = true
    try {
        await $fetch('/api/users/password', {
            method: 'PUT' as any,
            body: { id: props.user.id, password: nuevaPassword.value, tu_password: tuPassword.value }
        })
        exitoPassword.value = 'Contraseña actualizada. Ya puede entrar con la nueva.'
        nuevaPassword.value = ''
        tuPassword.value = ''
    } catch (e: any) {
        errorPassword.value = e.data?.statusMessage || e.message || 'No se pudo cambiar la contraseña'
    } finally {
        cambiandoPassword.value = false
    }
}

// Gatwick: agente = técnico, admin = supervisor — se puede actualizar el
// teléfono usado para las alertas de emergencia (ver sincronizarUsuarioGatwick)
const esGatwick = computed(() => String(props.companyId || '').toLowerCase().includes('gatwick'))

// Initialize form when dialog opens or user changes
watch(() => props.user, (newVal) => {
    if (newVal) {
        fullName.value = newVal.full_name || ''
        email.value = newVal.email || ''
        telefono.value = ''
        errorMsg.value = ''
        successMsg.value = ''
    }
}, { immediate: true })

const rules = {
    required: (v: string) => !!v || 'Requerido',
    email: (v: string) => /.+@.+\..+/.test(v) || 'E-mail inválido',
}

const submit = async () => {
    if (!valid.value) return

    loading.value = true
    errorMsg.value = ''
    successMsg.value = ''

    try {
        await $fetch('/api/users/update', {
            method: 'PUT' as any,
            body: {
                id: props.user.id,
                email: email.value,
                full_name: fullName.value,
                company_id: props.companyId,
                telefono: esGatwick.value ? (telefono.value || undefined) : undefined
            }
        })

        successMsg.value = 'Usuario actualizado exitosamente'
        
        // Notify parent and close
        setTimeout(() => {
            emit('user-updated')
            dialog.value = false
        }, 1500)

    } catch (e: any) {
        const statusMessage = e.data?.statusMessage || e.message || 'Error al actualizar usuario'
        errorMsg.value = statusMessage
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.edit-user-card {
    border-radius: 12px;
    overflow: hidden;
}
</style>
