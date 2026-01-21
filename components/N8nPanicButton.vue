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
    const newState = !isActive.value // Invertimos el estado actual
    const actionName = newState ? 'ACTIVAR' : 'APAGAR'

    if (!confirm(`¿Seguro deseas ${actionName} el sistema para ${props.label}?`)) return

    loading.value = true
    try {
        const { error } = await useFetch('/api/n8n/toggle-workflow', {
            method: 'POST',
            body: {
                clientKey: props.clientKey, // Aquí enviamos la clave
                active: newState
            }
        })

        if (error.value) throw error.value

        isActive.value = newState
        alert(`Sistema ${props.label}: ${newState ? 'ENCENDIDO' : 'APAGADO'}`)

    } catch (e) {
        alert('Error al conectar con el servidor')
        console.error(e)
    } finally {
        loading.value = false
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