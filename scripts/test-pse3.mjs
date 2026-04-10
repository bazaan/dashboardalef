/**
 * test-pse3.mjs
 * Descarga el HTML que devuelve el endpoint y extrae info útil:
 * <title>, meta, scripts, endpoints API mencionados, etc.
 */

const BASE = 'https://api.pse.pe/api/reseller/v1/0c15ce82e168a8763e4644c2'

const res = await fetch(BASE)
const html = await res.text()

console.log('=== META ===')
console.log('Status:', res.status)
console.log('Content-Type:', res.headers.get('content-type'))
console.log('Length:', html.length)

// Title
const title = html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]
console.log('Title:', title)

// Meta description
const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/)?.[1]
console.log('Description:', desc)

// Busca endpoints API en el HTML / JavaScript embebido
console.log('\n=== ENDPOINTS EN EL HTML ===')
const endpoints = new Set()
const urlRegex = /https?:\/\/[a-z0-9.-]+\.pse\.pe[^"'\s<>)]*/gi
const matches = html.match(urlRegex) || []
matches.forEach(m => endpoints.add(m))
endpoints.forEach(e => console.log(' →', e))

// Busca rutas relativas tipo /api/ o /v1/
console.log('\n=== RUTAS RELATIVAS /api/ ===')
const apiRoutes = new Set()
const apiRegex = /["'](\/api\/[^"'\s<>)]+)["']/g
let m
while ((m = apiRegex.exec(html)) !== null) apiRoutes.add(m[1])
apiRoutes.forEach(r => console.log(' →', r))

// Busca scripts externos
console.log('\n=== SCRIPTS ===')
const scriptRegex = /<script[^>]*src=["']([^"']+)["']/g
const scripts = new Set()
while ((m = scriptRegex.exec(html)) !== null) scripts.add(m[1])
scripts.forEach(s => console.log(' →', s))

// Primeras 800 chars del body para ver qué es
console.log('\n=== PRIMERAS LÍNEAS (800 chars) ===')
console.log(html.slice(0, 800))
