/**
 * insert-pse.mjs
 * Inserts PSE.PE electronic invoicing tabs into the "Facturación" module
 * of all 9 dashboards.
 *
 * Pattern A (AlefCompany, BradaPerfumes): target block = activeView === 'facturacion'
 * Pattern B (all others): target block = activeView === 'contabilidad'
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PAGES_DIR = path.join(__dirname, '..', 'pages', 'pruebas')

const DASHBOARDS = [
  { file: 'AlefCompany.vue',    companyId: 'alefcompany',    targetView: 'facturacion' },
  { file: 'Alegrated.vue',      companyId: 'alegrated',      targetView: 'contabilidad' },
  { file: 'BradaPerfumes.vue',  companyId: 'bradaperfumes',  targetView: 'facturacion' },
  { file: 'ClinicaArroyo.vue',  companyId: 'clinicaarroyo',  targetView: 'contabilidad' },
  { file: 'EstasConSuerte.vue', companyId: 'estasconsuerte', targetView: 'contabilidad' },
  { file: 'Healup.vue',         companyId: 'healup',         targetView: 'contabilidad' },
  { file: 'Origitec.vue',       companyId: 'origitec',       targetView: 'contabilidad' },
  { file: 'SKIP.vue',           companyId: 'skip',           targetView: 'contabilidad' },
  { file: 'Solari.vue',         companyId: 'solari',         targetView: 'contabilidad' },
]

/** Tabs + PSE block to insert right after the opening view-container div */
function makeTabsBlock(companyId) {
  return `
        <!-- PSE Tabs -->
        <v-tabs
          v-model="facturacionTab"
          bg-color="transparent"
          color="primary"
          density="compact"
          class="mb-4"
          style="border-bottom: 1px solid var(--border);"
        >
          <v-tab value="resumen">Resumen</v-tab>
          <v-tab value="factura_electronica">⚡ Factura Electrónica</v-tab>
        </v-tabs>

        <!-- PSE.PE: Factura Electrónica -->
        <div v-show="facturacionTab === 'factura_electronica'" style="padding: 0 0 2rem 0;">
          <FacturacionPSE company-id="${companyId}" />
        </div>

        <!-- Resumen original -->
        <div v-show="facturacionTab === 'resumen'">`
}

const RESUMEN_CLOSE = `
        </div><!-- fin tab resumen -->`

/** Add `const facturacionTab = ref('resumen')` to script setup if not present */
function addScriptRef(content) {
  if (content.includes('facturacionTab')) return content // already added

  // Find `const activeView = ref(` and insert after it
  const marker = "const activeView = ref('"
  const idx = content.indexOf(marker)
  if (idx === -1) {
    console.warn('  ⚠ Could not find activeView ref to insert facturacionTab')
    return content
  }
  const lineEnd = content.indexOf('\n', idx)
  return (
    content.slice(0, lineEnd + 1) +
    "const facturacionTab = ref('resumen')\n" +
    content.slice(lineEnd + 1)
  )
}

/** Process a single dashboard file */
function processDashboard({ file, companyId, targetView }) {
  const filePath = path.join(PAGES_DIR, file)
  let content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  console.log(`\n📄 Processing ${file} (target: ${targetView}, company: ${companyId})`)

  // 1. Find the opening line of the target block
  const openPattern = `v-else-if="activeView === '${targetView}'" class="view-container"`
  let openIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openPattern)) {
      openIdx = i
      break
    }
  }
  if (openIdx === -1) {
    console.error(`  ❌ Could not find opening div for '${targetView}'`)
    return false
  }
  console.log(`  ✅ Found opening div at line ${openIdx + 1}`)

  // 2. Find the next section comment after the opening div
  const sectionCommentPattern = /^\s*<!-- ={3,}\s+VISTA:/
  let nextSectionIdx = -1
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (sectionCommentPattern.test(lines[i])) {
      nextSectionIdx = i
      break
    }
  }
  if (nextSectionIdx === -1) {
    console.error(`  ❌ Could not find next section comment`)
    return false
  }
  console.log(`  ✅ Found next section comment at line ${nextSectionIdx + 1}: "${lines[nextSectionIdx].trim()}"`)

  // 3. Find the view-container closing </div> = the last line with exactly 6-space indent
  //    (same as the opening div) between openIdx and nextSectionIdx
  const openIndent = lines[openIdx].match(/^(\s*)/)[1]
  let closeIdx = -1
  for (let i = nextSectionIdx - 1; i > openIdx; i--) {
    const line = lines[i]
    if (line.trimEnd() === openIndent + '</div>') {
      closeIdx = i
      break
    }
  }
  if (closeIdx === -1) {
    console.error(`  ❌ Could not find closing </div> with indent "${openIndent}"`)
    return false
  }
  console.log(`  ✅ Found closing </div> at line ${closeIdx + 1}`)

  // 4. Check that the line right after openIdx is the <header> (sanity check)
  const lineAfterOpen = lines[openIdx + 1]?.trim()
  if (!lineAfterOpen.startsWith('<header') && !lineAfterOpen.startsWith('<!--')) {
    console.warn(`  ⚠ Line after open is not <header>, it's: "${lineAfterOpen}" — continuing anyway`)
  }

  // 5. Build new lines array with insertions
  const tabsBlock = makeTabsBlock(companyId)
  const newLines = [
    ...lines.slice(0, openIdx + 1),       // include the opening div line
    tabsBlock,                              // insert tabs + PSE + open resumen div
    ...lines.slice(openIdx + 1, closeIdx), // original content (header through content-area close)
    RESUMEN_CLOSE,                          // close the resumen div
    ...lines.slice(closeIdx),               // closing </div> of view-container + rest of file
  ]

  let newContent = newLines.join('\n')

  // 6. Add facturacionTab ref to script
  newContent = addScriptRef(newContent)

  writeFileSync(filePath, newContent, 'utf-8')
  console.log(`  ✅ File updated successfully`)
  return true
}

// Run
let success = 0
let failed = 0
for (const dashboard of DASHBOARDS) {
  const ok = processDashboard(dashboard)
  if (ok) success++
  else failed++
}

console.log(`\n✅ Done: ${success} updated, ${failed} failed`)
