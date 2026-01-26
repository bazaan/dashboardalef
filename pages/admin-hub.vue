<template>
    <div class="admin-hub-container">
        <div class="content-wrapper">
            <div class="user-profile">
                <v-avatar size="120" class="profile-avatar">
                    <v-img :src="userAvatar" :alt="userName"></v-img>
                </v-avatar>
                <h1 class="user-name">{{ userName }}</h1>
                <p class="user-email">{{ userEmail }}</p>
            </div>

            <div class="dashboard-selector">
                <v-select v-model="selectedDashboard" :items="availableDashboardsWithLogos"
                    label="Selecciona un Dashboard" variant="solo-filled" bg-color="#111" color="white"
                    item-title="name" item-value="path" :menu-props="{ theme: 'dark' }"
                    @update:model-value="navigateToDashboard" return-object flat rounded="xl" class="custom-select"
                    hide-details>

                    <template v-slot:selection="{ item }">
                        <div class="d-flex align-center" style="gap: 12px; width: 100%;">
                            <v-avatar size="24" class="mr-2">
                                <v-img :src="item.raw.logoUrl" cover></v-img>
                            </v-avatar>
                            <span class="text-white font-weight-bold">{{ item.title }}</span>
                        </div>
                    </template>

                    <template v-slot:item="{ props, item }">
                        <v-list-item v-bind="props" class="dashboard-option">
                            <template v-slot:prepend>
                                <v-avatar size="32" class="mr-2">
                                    <v-img :src="item.raw.logoUrl" cover></v-img>
                                </v-avatar>
                            </template>
                            <v-list-item-title class="font-weight-bold">{{ item.title }}</v-list-item-title>
                        </v-list-item>
                    </template>
                </v-select>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { dashboards } from '@/utils/permissions'

definePageMeta({
    middleware: 'auth-dashboard'
})

interface UserSession {
    id: string
    email: string
    full_name: string
    role: string
}

const userSession = useCookie<UserSession | null>('dashboard_session')
const router = useRouter()

const userName = computed(() => userSession.value?.full_name || 'Admin')
const userEmail = computed(() => userSession.value?.email || '')
const userAvatar = computed(() => 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName.value) + '&background=random')

// Dynamic Asset Loading using Vite's glob import
const logos = import.meta.glob('@/assets/img/*.(png|jpg|jpeg|svg)', { eager: true, as: 'url' })

const availableDashboardsWithLogos = computed(() => {
    return dashboards.map(d => {
        const logoKey = Object.keys(logos).find(key => key.includes(d.logo!))
        const logoUrl = logoKey ? logos[logoKey] : ''
        return {
            ...d,
            logoUrl
        }
    })
})

const selectedDashboard = ref(null)

function navigateToDashboard(dashboard: any) {
    if (dashboard && dashboard.path) {
        router.push(dashboard.path)
    }
}
</script>

<style scoped>
.admin-hub-container {
    min-height: 100vh;
    width: 100%;
    background-color: #000000;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
}

.content-wrapper {
    max-width: 500px;
    width: 100%;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rem;
}

.user-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
}

.profile-avatar {
    border: 4px solid #333;
}

.user-name {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.user-email {
    font-size: 1.1rem;
    color: #888;
    margin: 0;
}

.dashboard-selector {
    width: 100%;
    max-width: 400px;
}

/* Custom Select Styles Override */
:deep(.v-field) {
    border-radius: 12px !important;
    border: 1px solid #333;
    transition: all 0.3s ease;
}

:deep(.v-field--focused) {
    border-color: #666 !important;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

:deep(.v-label) {
    color: #888 !important;
    font-size: 0.9rem;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 500;
}

:deep(.v-field__input) {
    padding-top: 10px;
}
</style>
