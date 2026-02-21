<template>
    <v-dialog v-model="dialog" max-width="500px">
        <v-card class="create-user-card">
            <v-card-title class="text-h5 bg-primary text-white">
                Crear Nuevo Usuario
            </v-card-title>

            <v-card-text class="pt-4">
                <v-form ref="form" v-model="valid" @submit.prevent="submit">
                    <v-text-field v-model="fullName" label="Nombre Completo" variant="outlined" density="compact"
                        :rules="[rules.required]" class="mb-2"></v-text-field>

                    <v-text-field v-model="email" label="Correo Electrónico" variant="outlined" density="compact"
                        :rules="[rules.required, rules.email]" class="mb-2"></v-text-field>

                    <v-text-field v-model="password" label="Contraseña" type="password" variant="outlined"
                        density="compact" :rules="[rules.required, rules.min]" class="mb-2"></v-text-field>

                    <v-select v-model="role" :items="availableRoles" label="Rol" variant="outlined" density="compact"
                        :rules="[rules.required]"></v-select>

                    <v-alert v-if="errorMsg" type="error" variant="tonal" class="mt-2" closable>
                        {{ errorMsg }}
                    </v-alert>

                    <v-alert v-if="successMsg" type="success" variant="tonal" class="mt-2" closable>
                        {{ successMsg }}
                    </v-alert>

                </v-form>
            </v-card-text>

            <v-card-actions class="pb-4 px-4">
                <v-spacer></v-spacer>
                <v-btn color="grey-darken-1" variant="text" @click="dialog = false">
                    Cancelar
                </v-btn>
                <v-btn color="primary" variant="elevated" :loading="loading" :disabled="!valid" @click="submit">
                    Crear Usuario
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
    companyId: string // The context company (e.g., 'Heal up', 'Brada')
    appName?: string  // Display name if different
}>()

const dialog = defineModel<boolean>('modelValue')
const emit = defineEmits(['user-created'])

const form = ref()
const valid = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const fullName = ref('')
const email = ref('')
const password = ref('')
const role = ref('agente') // Default to agente

// Determine available roles based on current user (logic handled in backend mostly, but UI can filter)
// For now, hardcode options
const availableRoles = [
    { title: 'Agente', value: 'agente' },
    { title: 'Admin', value: 'admin' }
]

const rules = {
    required: (v: string) => !!v || 'Requerido',
    email: (v: string) => /.+@.+\..+/.test(v) || 'E-mail inválido',
    min: (v: string) => v.length >= 6 || 'Mínimo 6 caracteres',
}

const submit = async () => {
    if (!valid.value) return

    loading.value = true
    errorMsg.value = ''
    successMsg.value = ''

    try {
        await $fetch('/api/users/create', {
            method: 'POST',
            body: {
                email: email.value,
                password: password.value,
                full_name: fullName.value,
                role: role.value,
                company_id: props.companyId
            }
        })

        successMsg.value = 'Usuario creado exitosamente'
        emit('user-created')

        // Reset form after delay
        setTimeout(() => {
            dialog.value = false
            resetForm()
        }, 1500)

    } catch (e: any) {
        // $fetch throws an error if the request fails
        const statusMessage = e.data?.statusMessage || e.message || 'Error al crear usuario'
        errorMsg.value = statusMessage
    } finally {
        loading.value = false
    }
}

const resetForm = () => {
    fullName.value = ''
    email.value = ''
    password.value = ''
    role.value = 'agente'
    errorMsg.value = ''
    successMsg.value = ''
}
</script>

<style scoped>
.create-user-card {
    border-radius: 12px;
    overflow: hidden;
}
</style>
