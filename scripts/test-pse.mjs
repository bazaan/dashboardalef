/**
 * test-pse.mjs
 * Prueba todos los formatos posibles de autenticación con PSE.PE
 * para diagnosticar cuál acepta el servidor.
 *
 * Uso:  node scripts/test-pse.mjs
 */

const RESELLER_URL = 'https://api.pse.pe/api/reseller/v1/0c15ce82e168a8763e4644c2'
const V1_BASE      = 'https://api.pse.pe/api/v1'
const HEX_URL      = '0c15ce82e168a8763e4644c2'
const HEX_INNER    = '133ff6cb548c8d782899975f78bf4f6af8f8ea10a0e38353b7'
const JWT          = 'eyJhbGciOiJIUzI1NiJ9.IjEzM2ZmNmNiNTQ4YzhkNzgyODk5NzVmNzhiZjRmNmFmOGY4ZWExMGEwZTM4MzViNyI.Dqwk2iJcQB1K0yuHFXwhJ2Ao3AP7IVaQ0PpIER2RBWc'

// Payload mínimo para probar (boleta S/ 1.00)
const payload = {
  operacion: 'consultar_comprobante',  // Operación de solo lectura, no crea nada
  tipo_de_comprobante: 2,
  serie: 'B001',
  numero: 1
}

const combos = [
  // --- RESELLER URL ---
  { label: 'reseller + Bearer JWT',          url: RESELLER_URL, header: `Bearer ${JWT}` },
  { label: 'reseller + Token token=JWT',     url: RESELLER_URL, header: `Token token=${JWT}` },
  { label: 'reseller + Token token=hex_url', url: RESELLER_URL, header: `Token token=${HEX_URL}` },
  { label: 'reseller + Token token=hex_in',  url: RESELLER_URL, header: `Token token=${HEX_INNER}` },
  { label: 'reseller + Bearer hex_in',       url: RESELLER_URL, header: `Bearer ${HEX_INNER}` },
  { label: 'reseller + Bearer hex_url',      url: RESELLER_URL, header: `Bearer ${HEX_URL}` },
  { label: 'reseller (no auth header)',      url: RESELLER_URL, header: null },

  // --- V1 STANDARD URL ---
  { label: 'v1/hex_url + Token token=hex_url', url: `${V1_BASE}/${HEX_URL}`,   header: `Token token=${HEX_URL}` },
  { label: 'v1/hex_in  + Token token=hex_in',  url: `${V1_BASE}/${HEX_INNER}`, header: `Token token=${HEX_INNER}` },
  { label: 'v1/hex_in  + Bearer JWT',          url: `${V1_BASE}/${HEX_INNER}`, header: `Bearer ${JWT}` },
  { label: 'v1/JWT     + Token token=JWT',     url: `${V1_BASE}/${JWT}`,       header: `Token token=${JWT}` },
]

for (const c of combos) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (c.header) headers.Authorization = c.header

    const res = await fetch(c.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const text = await res.text()
    const preview = text.slice(0, 140).replace(/\n/g, ' ')
    const marker = res.status === 200 ? '✅' : res.status === 401 ? '🔒' : res.status === 404 ? '🚫' : '❓'
    console.log(`${marker} [${res.status}] ${c.label}`)
    console.log(`         → ${preview}`)
  } catch (e) {
    console.log(`💥 [ERR] ${c.label}: ${e.message}`)
  }
}
