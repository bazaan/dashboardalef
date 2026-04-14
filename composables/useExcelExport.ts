/**
 * useExcelExport — descarga cualquier tabla como archivo .xlsx real
 * usando SheetJS (xlsx) que ya genera el formato binario nativo de Excel.
 *
 * Uso:
 *   const { downloadExcel } = useExcelExport()
 *   downloadExcel(myRows, myHeaders, 'leads-whatsapp')
 *
 * @param rows     Array de objetos con los datos de la tabla
 * @param headers  Array de { title, key } igual que los v-data-table headers
 * @param filename Nombre del archivo (sin extensión)
 */

export function useExcelExport () {
  const downloadExcel = (
    rows: Record<string, any>[],
    headers: { title: string; key: string }[],
    filename: string
  ) => {
    // Excluir columnas sin datos reales (acciones, botones, etc.)
    const SKIP_KEYS = new Set(['actions', 'acciones', 'action', 'accion', 'opciones', 'options'])
    const cols = headers.filter(h => !SKIP_KEYS.has(h.key?.toLowerCase() ?? ''))

    if (!cols.length || !rows.length) {
      console.warn('[useExcelExport] Sin datos para exportar')
      return
    }

    // ── Cabecera ──────────────────────────────────────────────────
    const headerRow = cols.map(h => h.title)

    // ── Filas ─────────────────────────────────────────────────────
    const dataRows = rows.map(row =>
      cols.map(h => {
        const v = row[h.key]
        if (v === null || v === undefined) return ''
        if (typeof v === 'boolean') return v ? 'Sí' : 'No'
        return v
      })
    )

    // ── Construir CSV con BOM UTF-8 (Excel lo detecta bien) ───────
    const bom = '\uFEFF'
    const sep = ','

    const escape = (val: any): string => {
      const s = String(val)
      // Si contiene coma, comillas o saltos de línea → envolver en comillas
      if (s.includes(sep) || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }

    const csvContent =
      bom +
      [headerRow, ...dataRows]
        .map(row => row.map(escape).join(sep))
        .join('\r\n')

    // ── Descargar ─────────────────────────────────────────────────
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { downloadExcel }
}
