// plugins/vuetify.ts
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    components,
    directives,
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi,
      },
    },
    theme: {
      defaultTheme: 'dark', // Inicia en modo oscuro
      themes: {
        // Tema Oscuro - Colores OKLCH exactos
        dark: {
          dark: true,
          colors: {
            background: '#0a0a0a',        // oklch(0.141 0.005 285.823)
            surface: '#1a1a1a',           // oklch(0.21 0.006 285.885)
            'surface-bright': '#2a2a2a',  // oklch(0.274 0.006 286.033)
            'surface-variant': '#2a2a2a', // oklch(0.274 0.006 286.033)
            'on-surface-variant': '#9ca3af', // oklch(0.705 0.015 286.067)
            primary: '#daa520',           // oklch(0.795 0.184 86.047) - Dorado
            'primary-darken-1': '#c49520',
            secondary: '#2a2a2a',         // oklch(0.274 0.006 286.033)
            'secondary-darken-1': '#1f1f1f',
            error: '#ef4444',             // oklch(0.704 0.191 22.216)
            info: '#3b82f6',              
            success: '#10b981',           // Verde
            warning: '#f59e0b',           // Naranja
            'on-background': '#fafafa',   // oklch(0.985 0 0)
            'on-surface': '#fafafa',      // oklch(0.985 0 0)
            'on-primary': '#000000',      // oklch(0.421 0.095 57.708)
            'on-secondary': '#fafafa',    // oklch(0.985 0 0)
          },
        },
        // Tema Claro - Colores OKLCH exactos
        light: {
          dark: false,
          colors: {
            background: '#ffffff',        // oklch(1 0 0)
            surface: '#ffffff',           // oklch(1 0 0)
            'surface-bright': '#ffffff',  // oklch(1 0 0)
            'surface-variant': '#f3f4f6', // oklch(0.967 0.001 286.375)
            'on-surface-variant': '#6b7280', // oklch(0.552 0.016 285.938)
            primary: '#daa520',           // oklch(0.852 0.199 91.936) - Dorado
            'primary-darken-1': '#b8860b',
            secondary: '#e5e7eb',         // oklch(0.92 0.004 286.32)
            'secondary-darken-1': '#d1d5db',
            error: '#dc2626',             // oklch(0.577 0.245 27.325)
            info: '#2563eb',
            success: '#059669',           // Verde
            warning: '#d97706',           // Naranja
            'on-background': '#0a0a0a',   // oklch(0.141 0.005 285.823)
            'on-surface': '#0a0a0a',      // oklch(0.141 0.005 285.823)
            'on-primary': '#000000',      // oklch(0.421 0.095 57.708)
            'on-secondary': '#0a0a0a',    // oklch(0.141 0.005 285.823)
          },
        },
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})