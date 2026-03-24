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
                    Guardar Cambios
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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

// Initialize form when dialog opens or user changes
watch(() => props.user, (newVal) => {
    if (newVal) {
        fullName.value = newVal.full_name || ''
        email.value = newVal.email || ''
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
                company_id: props.companyId
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
