<template>
  <v-container fluid class="pa-6">
    <v-card class="chart-card" elevation="0">
      <v-card-text class="pa-6">
        <div class="d-flex justify-space-between align-center mb-6">
          <div>
            <h2 class="text-h5 font-weight-bold mb-1">Total Visitors</h2>
            <p class="text-body-2 text-medium-emphasis">Total for the last 3 months</p>
          </div>
          <v-btn-toggle
            v-model="selectedPeriod"
            mandatory
            variant="outlined"
            divided
            density="compact"
          >
            <v-btn value="3months">Last 3 months</v-btn>
            <v-btn value="30days">Last 30 days</v-btn>
            <v-btn value="7days">Last 7 days</v-btn>
          </v-btn-toggle>
        </div>

        <div ref="chartContainer" class="chart-wrapper">
          <ClientOnly>
            <RechartsAreaChart
              :data="chartData"
              :width="chartWidth"
              :height="300"
              :margin="{ top: 10, right: 30, left: 0, bottom: 0 }"
            />
          </ClientOnly>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const selectedPeriod = ref('3months')
const chartContainer = ref(null)
const chartWidth = ref(1000)

const chartData = ref([
  { date: 'May 31', mobile: 380, desktop: 450 },
  { date: 'Jun 2', mobile: 420, desktop: 480 },
  { date: 'Jun 4', mobile: 350, desktop: 420 },
  { date: 'Jun 6', mobile: 400, desktop: 460 },
  { date: 'Jun 8', mobile: 450, desktop: 520 },
  { date: 'Jun 10', mobile: 480, desktop: 550 },
  { date: 'Jun 11', mobile: 420, desktop: 492 },
  { date: 'Jun 12', mobile: 390, desktop: 450 },
  { date: 'Jun 14', mobile: 430, desktop: 490 },
  { date: 'Jun 16', mobile: 500, desktop: 570 },
  { date: 'Jun 18', mobile: 460, desktop: 530 },
  { date: 'Jun 20', mobile: 420, desktop: 480 },
  { date: 'Jun 22', mobile: 490, desktop: 560 },
  { date: 'Jun 24', mobile: 470, desktop: 540 },
  { date: 'Jun 26', mobile: 510, desktop: 580 },
  { date: 'Jun 28', mobile: 490, desktop: 560 },
  { date: 'Jun 29', mobile: 450, desktop: 520 }
])

const updateChartWidth = () => {
  if (chartContainer.value) {
    chartWidth.value = chartContainer.value.offsetWidth
  }
}

onMounted(() => {
  updateChartWidth()
  window.addEventListener('resize', updateChartWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateChartWidth)
})
</script>