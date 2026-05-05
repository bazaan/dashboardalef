// Shim para resolver `#internal/nuxt/paths` desde el SSR generado por Nuxt.
// Re-exporta el módulo real de @nuxt/nitro-server cuando Node necesita
// resolver el specifier definido en package.json#imports.
export * from '@nuxt/nitro-server/dist/runtime/utils/paths.mjs'
