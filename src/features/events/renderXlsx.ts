import type { SheetSpec } from './exportLayout'

const BORDER = { style: 'thin', color: { argb: 'FFB7C4BB' } }

export async function renderXlsx(specs: SheetSpec[], filename: string) {
  const mod: any = await import('exceljs')
  const ExcelJS = mod.default ?? mod
  const book = new ExcelJS.Workbook()
  book.creator = 'KIWANTIKA'
  book.created = new Date()

  for (const spec of specs) {
    const sheet = book.addWorksheet(spec.name, {
      properties: spec.tab ? { tabColor: { argb: spec.tab } } : undefined,
      views: spec.freeze ? [{ state: 'frozen', xSplit: spec.freeze.col, ySplit: spec.freeze.row, showGridLines: false }] : [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    })
    spec.widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width })

    spec.rows.forEach((cells, rowIndex) => {
      const row = sheet.getRow(rowIndex + 1)
      const height = spec.heights[rowIndex]
      if (height) row.height = height
      cells.forEach((cell, colIndex) => {
        const target = row.getCell(colIndex + 1)
        target.value = cell.v ?? ''
        target.font = { name: 'Calibri', size: cell.size ?? 11, bold: !!cell.bold, color: { argb: cell.color ?? 'FF1B2A21' } }
        target.alignment = { vertical: 'middle', horizontal: cell.align ?? 'left', wrapText: !!cell.wrap, textRotation: cell.rotate }
        if (cell.fill) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cell.fill } }
        if (cell.border) target.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER }
      })
    })

    for (const [top, left, bottom, right] of spec.merges) sheet.mergeCells(top, left, bottom, right)
    if (spec.filterRow) {
      sheet.autoFilter = { from: { row: spec.filterRow, column: 1 }, to: { row: spec.rows.length, column: spec.widths.length } }
      sheet.pageSetup.printTitlesRow = `${spec.filterRow}:${spec.filterRow}`
    }
  }

  const buffer = await book.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
