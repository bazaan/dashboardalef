#!/usr/bin/env node
// Trade Cars — importa el histórico de leads antiguos a tradecars_leads_chatwoot.
//
// El archivo de origen es un INSERT INTO ... VALUES (...), (...), ...; gigante (23.508 filas,
// generado aparte) que el editor SQL de Supabase rechaza por tamaño ("Query is too large to run
// via the SQL Editor"). Este script lo parsea a mano (tolera comillas escapadas '' dentro de los
// nombres) y lo inserta por lotes con la service_role key, que no tiene ese límite.
//
// Corre primero SIN --escribir (dry-run): solo cuenta y muestra una vista previa, no toca la base.
//
//   node scripts/importar_leads_chatwoot_historico.mjs "C:/ruta/al/insert_leads_completo.txt"
//   node scripts/importar_leads_chatwoot_historico.mjs "C:/ruta/al/insert_leads_completo.txt" --escribir
//
// telefono es NOT NULL en la tabla: las filas sin teléfono se descartan y se informan, no rompen
// el resto del lote.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const TABLA = 'tradecars_leads_chatwoot'
const COLUMNAS = [
  'telefono', 'nombre_chatwoot', 'correo', 'marca', 'modelo', 'anio', 'kilometraje',
  'placa', 'distrito', 'estado', 'created_at', 'asesor_asignado', 'id_asesor_asignado',
]
const TAMANO_LOTE = 500

const rutaArchivo = process.argv[2]
const escribir = process.argv.includes('--escribir')

if (!rutaArchivo) {
  console.error('Uso: node scripts/importar_leads_chatwoot_historico.mjs <archivo.txt> [--escribir]')
  process.exit(1)
}

/** Parsea UNA tupla "(...)" de un INSERT VALUES: NULL, 'texto con ''comillas'' escapadas', o número. */
function parsearTupla(texto) {
  const valores = []
  let i = 0
  const n = texto.length
  while (i < n) {
    while (i < n && /[\s,]/.test(texto[i])) i++
    if (i >= n) break
    if (texto[i] === "'") {
      i++
      let s = ''
      while (i < n) {
        if (texto[i] === "'" && texto[i + 1] === "'") { s += "'"; i += 2; continue }
        if (texto[i] === "'") { i++; break }
        s += texto[i]; i++
      }
      valores.push(s)
    } else {
      let s = ''
      while (i < n && texto[i] !== ',') { s += texto[i]; i++ }
      s = s.trim()
      valores.push(s.toUpperCase() === 'NULL' ? null : s)
    }
  }
  return valores
}

/** Separa el bloque completo de VALUES (...),(...),... en las tuplas de cada fila. */
function separarTuplas(bloque) {
  const tuplas = []
  let profundidad = 0
  let dentroString = false
  let inicio = -1
  for (let i = 0; i < bloque.length; i++) {
    const c = bloque[i]
    if (c === "'" ) {
      // "''" dentro de un string es una comilla escapada, no el cierre
      if (dentroString && bloque[i + 1] === "'") { i++; continue }
      dentroString = !dentroString
      continue
    }
    if (dentroString) continue
    if (c === '(') { if (profundidad === 0) inicio = i + 1; profundidad++ }
    else if (c === ')') {
      profundidad--
      if (profundidad === 0) tuplas.push(bloque.slice(inicio, i))
    }
  }
  return tuplas
}

function normalizarTelefono(valor) {
  let digitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (digitos.length === 11 && digitos.startsWith('51')) digitos = digitos.slice(2)
  return digitos
}

function aInt(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = parseInt(String(valor).replace(/[^\d.-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// ── 1. Leer y parsear el archivo ────────────────────────────────────────────
const crudo = readFileSync(rutaArchivo, 'utf8')
const inicioValues = crudo.search(/\bVALUES\b/i)
if (inicioValues === -1) {
  console.error('No encontré la palabra VALUES en el archivo — ¿es realmente un INSERT INTO ... VALUES?')
  process.exit(1)
}
let bloque = crudo.slice(inicioValues + 6).trim()
if (bloque.endsWith(';')) bloque = bloque.slice(0, -1)

const tuplas = separarTuplas(bloque)
console.log(`Tuplas encontradas en el archivo: ${tuplas.length}`)

const filas = []
let sinTelefono = 0
for (const t of tuplas) {
  const valores = parsearTupla(t)
  const fila = {}
  COLUMNAS.forEach((col, idx) => { fila[col] = valores[idx] ?? null })

  const telefono = normalizarTelefono(fila.telefono)
  if (!telefono) { sinTelefono++; continue }

  filas.push({
    telefono,
    nombre_chatwoot: fila.nombre_chatwoot,
    correo: fila.correo,
    marca: fila.marca,
    modelo: fila.modelo,
    anio: aInt(fila.anio),
    kilometraje: aInt(fila.kilometraje),
    placa: fila.placa,
    distrito: fila.distrito,
    estado: fila.estado,
    created_at: fila.created_at,
    asesor_asignado: fila.asesor_asignado,
    id_asesor_asignado: aInt(fila.id_asesor_asignado),
  })
}

console.log(`Filas sin teléfono (descartadas): ${sinTelefono}`)
console.log(`Filas a insertar: ${filas.length}`)
console.log('\nVista previa (primeras 3):')
console.log(JSON.stringify(filas.slice(0, 3), null, 2))

if (!escribir) {
  console.log('\n(dry-run — no se escribió nada. Corre de nuevo con --escribir para insertar de verdad.)')
  process.exit(0)
}

// ── 2. Insertar por lotes ───────────────────────────────────────────────────
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

let insertadas = 0
let fallidas = 0
for (let desde = 0; desde < filas.length; desde += TAMANO_LOTE) {
  const lote = filas.slice(desde, desde + TAMANO_LOTE)
  const { error, count } = await sb.from(TABLA).insert(lote, { count: 'exact' })
  if (error) {
    console.error(`Lote ${desde}-${desde + lote.length}: ERROR — ${error.message}`)
    fallidas += lote.length
  } else {
    insertadas += lote.length
    console.log(`Lote ${desde}-${desde + lote.length}: OK (${insertadas}/${filas.length})`)
  }
}

console.log(`\nListo. Insertadas: ${insertadas}. Fallidas: ${fallidas}.`)
