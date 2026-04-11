/**
 * test-pse2.mjs — segundo diagnóstico
 * Prueba diferentes sub-rutas y métodos HTTP del endpoint reseller
 */

const BASE = 'https://api.pse.pe/api/reseller/v1/0c15ce82e168a8763e4644c2'
const JWT  = 'eyJhbGciOiJIUzI1NiJ9.IjEzM2ZmNmNiNTQ4YzhkNzgyODk5NzVmNzhiZjRmNmFmOGY4ZWExMGEwZTM4MzViNyI.Dqwk2iJcQB1K0yuHFXwhJ2Ao3AP7IVaQ0PpIER2RBWc'
const HEX  = '0c15ce82e168a8763e4644c2'

// Con diferentes headers de Auth probamos diferentes sub-rutas
const authVariants = [
  { name: 'Token token=JWT',  value: `Token token=${JWT}` },
  { name: 'Bearer JWT',        value: `Bearer ${JWT}` },
  { name: 'JWT directo',       value: JWT },
  { name: 'Token token=HEX',   value: `Token token=${HEX}` },
]

const subpaths = [
  { method: 'GET',  path: '' },
  { method: 'GET',  path: '/contribuyentes' },
  { method: 'GET',  path: '/empresas' },
  { method: 'GET',  path: '/clientes' },
  { method: 'GET',  path: '/ping' },
  { method: 'POST', path: '/contribuyentes' },
  { method: 'POST', path: '/generar_comprobante' },
]

// Primero: con el mejor guess de auth (Bearer JWT), probar cada sub-ruta
console.log('=== FASE 1: probar sub-rutas con Bearer JWT ===\n')
for (const sp of subpaths) {
  try {
    const res = await fetch(BASE + sp.path, {
      method: sp.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT}`
      },
      body: sp.method === 'POST' ? JSON.stringify({ operacion: 'consultar_comprobante' }) : undefined
    })
    const text = (await res.text()).slice(0, 150).replace(/\n/g, ' ')
    const m = res.status === 200 ? '✅' : res.status === 401 ? '🔒' : res.status === 404 ? '🚫' : res.status === 405 ? '⚠️ ' : '❓'
    console.log(`${m} [${res.status}] ${sp.method} ${sp.path || '/'}`)
    console.log(`         → ${text}`)
  } catch (e) {
    console.log(`💥 ${sp.method} ${sp.path}: ${e.message}`)
  }
}

// Segundo: todas las variantes de auth sobre el endpoint base con GET (safe)
console.log('\n=== FASE 2: variantes de auth con GET / ===\n')
for (const av of authVariants) {
  try {
    const res = await fetch(BASE, {
      method: 'GET',
      headers: { 'Authorization': av.value }
    })
    const text = (await res.text()).slice(0, 150).replace(/\n/g, ' ')
    const m = res.status === 200 ? '✅' : res.status === 401 ? '🔒' : '❓'
    console.log(`${m} [${res.status}] GET con "${av.name}"`)
    console.log(`         → ${text}`)
  } catch (e) {
    console.log(`💥 ${av.name}: ${e.message}`)
  }
}
