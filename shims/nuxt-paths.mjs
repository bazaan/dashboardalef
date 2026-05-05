// Shim para resolver `#internal/nuxt/paths` desde el SSR generado por Nuxt.
// Usa un import relativo al archivo dentro de node_modules — válido en Node
// ESM (la restricción aplica a los specifiers de package.json#imports, no a
// los imports relativos desde un archivo del proyecto). El subpath no está
// en `exports` de @nuxt/nitro-server, por eso no se puede usar bare specifier.
export * from '../node_modules/@nuxt/nitro-server/dist/runtime/utils/paths.mjs'
