<template>
    <button class="btn-panic" :class="{ 'is-off': !isActive, 'is-loading': loading }" @click="toggleWorkflow"
        :disabled="loading">
        <v-icon :icon="isActive ? 'mdi-power' : 'mdi-power-off'" size="16" class="mr-2" />
        <span>{{ labelText }}</span>
    </button>
</template>

<script setup lang="ts">
// Definimos que este botón recibe:
// 1. clientKey: 'brada', 'empresaB', etc.
// 2. label: Nombre para mostrar
const props = defineProps({
    clientKey: { type: String, required: true },
    label: { type: String, default: 'IA Automática' }
})

const loading = ref(false)
const isActive = ref(true) // Podrías consultar el estado real al montar si quisieras

const labelText = computed(() => {
    if (loading.value) return 'Procesando...'
    return isActive.value ? `Apagar ${props.label}` : `Encender ${props.label}`
})

const toggleWorkflow = async () => {
    console.log('Botón presionado. Estado actual:', isActive.value)
    const newState = !isActive.value // Invertimos el estado actual
    const actionName = newState ? 'ACTIVAR' : 'APAGAR'
    console.log('Nuevo estado deseado:', newState, 'Acción:', actionName)

    if (!confirm(`¿Seguro deseas ${actionName} el sistema para ${props.label}?`)) {
        console.log('Usuario canceló la confirmación.')
        return
    }

    loading.value = true
    console.log('Iniciando llamada a API...')
    try {
        // Usamos $fetch en lugar de useFetch para acciones disparadas por el usuario
        const response: any = await $fetch('/api/n8n/toggle-workflow', {
            method: 'POST',
            body: {
                clientKey: props.clientKey, // Aquí enviamos la clave
                active: newState
            }
        })

        console.log('Respuesta API:', response)
        if (!response) {
            throw new Error('Respuesta vacía del servidor')
        }

        isActive.value = newState
        alert(`Sistema ${props.label}: ${newState ? 'ENCENDIDO' : 'APAGADO'}`)

    } catch (e: any) {
        alert('Error al conectar con el servidor')
        console.error('Excepción frontend:', e)
        // Check for specific error message if available
        if (e.data?.statusMessage) {
            console.error('Mensaje del servidor:', e.data.statusMessage)
        }
    } finally {
        loading.value = false
        console.log('Finalizado loading.')
    }
}
</script>

<style scoped>
.btn-panic {
    background-color: #10b981;
    /* Verde (Encendido) */
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    display: flex;
    align-items: center;
    transition: all 0.3s;
}

.btn-panic.is-off {
    background-color: #ef4444;
    /* Rojo (Apagado) */
}

.btn-panic:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}
</style>