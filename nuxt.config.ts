import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";

// PWA Config
const title = "Alef Company";
const shortTitle = "Alef Company";
const description = "Dashboard Alef Company";
const image = "assets/img/Aleflogo.png";
const url = "https://dashboard.alef.company/";
const author = "Alef company";
const themeColor = "#4f46e5";

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  // import styles
  css: ["@/assets/styles/dashboard.css"],
  plugins: ['~/plugins/apexcharts.client.ts'],
  devtools: { enabled: true },

  runtimeConfig: {
    // --- Lado del Servidor (Privado) ---
    n8nApiKey: process.env.N8N_API_KEY,
    n8nBaseUrl: process.env.N8N_BASE_URL,

    // Aquí registramos tu "Diccionario de Empresas"
    // Nuxt leerá las variables que pusiste en el archivo .env
    n8nWorkflows: {
      brada: process.env.N8N_ID_BRADA,   // Se conecta con la variable del .env
      healup: process.env.N8N_ID_HEALUP  // Se conecta con la variable del .env
    },

    // --- Lado del Cliente (Público) ---
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY
      // Nota: NUNCA pongas las de n8n aquí abajo
    }
  },

  // enable takeover mode
  typescript: { shim: false },

  build: { transpile: ["vuetify"] },

  // Based on docs found here - https://vuetifyjs.com/en/getting-started/installation/#using-nuxt-3
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },

  modules: [
    '@nuxtjs/supabase',


    "@vite-pwa/nuxt",
    async (options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        config.plugins ||= [];
        config.plugins.push(vuetify());
      });
    },
  ],

  supabase: {
    redirect: false,
    // Forzamos las credenciales aquí si el .env falla
    url: process.env.SUPABASE_URL || "https://qzmgizrvdukyxvpgclvd.supabase.co",
    key: process.env.SUPABASE_KEY || "sb_publishable_BK4cQlXdmAWtlSW8YKnAqw_jB5Nb_dW"
  },


  app: {
    head: {
      title: "Alef Company",
      titleTemplate: "%s | Dashboard Alef Company",
      link: [
        { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
        { rel: "preconnect", href: "https://rsms.me/" },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "canonical", href: url },
      ],
      meta: [
        {
          hid: "description",
          name: "description",
          content: description,
        },
        { property: "og:site_name", content: title },
        { hid: "og:type", property: "og:type", content: "website" },
        {
          hid: "og:url",
          property: "og:url",
          content: url,
        },
        {
          hid: "og:image:secure_url",
          property: "og:image:secure_url",
          content: image,
        },
        {
          hid: "og:title",
          property: "og:title",
          content: title,
        },
        {
          hid: "og:description",
          property: "og:description",
          content: description,
        },
        {
          hid: "og:image",
          property: "og:image",
          content: image,
        },
        //Twitter
        { name: "twitter:card", content: "summary_large_image" },
        {
          hid: "twitter:url",
          name: "twitter:url",
          content: url,
        },
        {
          hid: "twitter:title",
          name: "twitter:title",
          content: title,
        },
        {
          hid: "twitter:description",
          name: "twitter:description",
          content: description,
        },
        {
          hid: "twitter:image",
          name: "twitter:image",
          content: image,
        },
      ],
    },
  },

  pwa: {
    includeAssets: ["favicon.ico", "robots.txt"],
    manifest: {
      name: shortTitle,
      short_name: shortTitle,
      description: description,
      theme_color: themeColor,
      lang: "en",
      background_color: "#ffffff",
      icons: [
        {
          src: "/icons/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/pwa-maskable-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/pwa-maskable-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
  },

  compatibilityDate: "2024-07-15",
});