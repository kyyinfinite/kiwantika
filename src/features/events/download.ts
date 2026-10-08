import {
  detailRows, eventLeaveRows, eventListRows, eventRowsFromMaster, eventSummaryRows, fileSlug, masterSummaryRows,
  matrixRows, memberTotalsRows, sheetName, toCsv, type EventReport, type MasterEvent, type MasterReport, type Row,
} from './exportData'

function widths(rows: Row[]) {
  const max: number[] = []
  for (const row of rows) row.forEach((value, index) => { max[index] = Math.min(48, Math.max(max[index] ?? 8, String(value ?? '').length + 2)) })
  return max.map(wch => ({ wch }))
}

async function sheetFrom(rows: Row[], filter = true) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = widths(rows)
  if (filter && rows.length > 1 && rows[0].length) sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) }
  return sheet
}

function saveBlob(content: string, filename: string) {
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export async function downloadMasterXlsx(master: MasterReport, perEventSheets = true) {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const used = new Set<string>()
  XLSX.utils.book_append_sheet(book, await sheetFrom(masterSummaryRows(master)), sheetName('Ringkasan Kegiatan', used))
  XLSX.utils.book_append_sheet(book, await sheetFrom(memberTotalsRows(master)), sheetName('Rekap Anggota', used))
  XLSX.utils.book_append_sheet(book, await sheetFrom(matrixRows(master), false), sheetName('Matriks', used))
  XLSX.utils.book_append_sheet(book, await sheetFrom(detailRows(master)), sheetName('Detail', used))
  if (perEventSheets) {
    for (const event of master.events.slice(0, 60)) {
      const label = `${String(event.idx + 1).padStart(2, '0')} ${event.title}`
      XLSX.utils.book_append_sheet(book, await sheetFrom(eventRowsFromMaster(master, event.idx)), sheetName(label, used))
    }
  }
  XLSX.writeFile(book, `rekap-kehadiran-${master.from}-sd-${master.to}.xlsx`)
}

export function downloadMasterCsv(master: MasterReport) {
  saveBlob(toCsv(detailRows(master)), `rekap-kehadiran-detail-${master.from}-sd-${master.to}.csv`)
}

export function downloadEventCsvFromMaster(master: MasterReport, event: MasterEvent) {
  saveBlob(toCsv(eventRowsFromMaster(master, event.idx)), `kehadiran-${fileSlug(event.title)}-${stamp()}.csv`)
}

export async function downloadEventXlsxFromMaster(master: MasterReport, event: MasterEvent) {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, await sheetFrom(eventRowsFromMaster(master, event.idx)), 'Kehadiran')
  XLSX.writeFile(book, `kehadiran-${fileSlug(event.title)}-${stamp()}.xlsx`)
}

export async function downloadEventXlsx(report: EventReport) {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const used = new Set<string>()
  XLSX.utils.book_append_sheet(book, await sheetFrom(eventSummaryRows(report), false), sheetName('Ringkasan', used))
  XLSX.utils.book_append_sheet(book, await sheetFrom(eventListRows(report)), sheetName('Kehadiran', used))
  if (report.leaves.length) XLSX.utils.book_append_sheet(book, await sheetFrom(eventLeaveRows(report)), sheetName('Izin dan sakit', used))
  XLSX.writeFile(book, `kehadiran-${fileSlug(report.event.title)}-${stamp()}.xlsx`)
}

export function downloadEventCsv(report: EventReport) {
  saveBlob(toCsv(eventListRows(report)), `kehadiran-${fileSlug(report.event.title)}-${stamp()}.csv`)
}
