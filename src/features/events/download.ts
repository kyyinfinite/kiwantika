import { eventListRows, eventRowsFromMaster, detailRows, fileSlug, toCsv, type EventReport, type MasterEvent, type MasterReport } from './exportData'
import { attendanceListSheet, eventReportSheets, masterEventSheet, masterSheets, tableSheet, type Column } from './exportLayout'
import { renderXlsx } from './renderXlsx'
import type { Row } from './exportData'

export function saveCsv(content: string, filename: string) {
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

export const downloadMasterXlsx = (master: MasterReport, perEventSheets = true) =>
  renderXlsx(masterSheets(master, perEventSheets), `rekap-kehadiran-${master.from}-sd-${master.to}.xlsx`)

export function downloadMasterCsv(master: MasterReport) {
  saveCsv(toCsv(detailRows(master)), `rekap-kehadiran-detail-${master.from}-sd-${master.to}.csv`)
}

export function downloadEventCsvFromMaster(master: MasterReport, event: MasterEvent) {
  saveCsv(toCsv(eventRowsFromMaster(master, event.idx)), `kehadiran-${fileSlug(event.title)}-${stamp()}.csv`)
}

export const downloadEventXlsxFromMaster = (master: MasterReport, event: MasterEvent) =>
  renderXlsx([masterEventSheet(master, event.idx, new Set())], `kehadiran-${fileSlug(event.title)}-${stamp()}.xlsx`)

export const downloadEventXlsx = (report: EventReport) =>
  renderXlsx(eventReportSheets(report), `kehadiran-${fileSlug(report.event.title)}-${stamp()}.xlsx`)

export function downloadEventCsv(report: EventReport) {
  saveCsv(toCsv(eventListRows(report)), `kehadiran-${fileSlug(report.event.title)}-${stamp()}.csv`)
}

export const downloadTableXlsx = (opts: { filename: string; sheet: string; title: string; subtitles?: string[]; columns: Column[]; rows: Row[] }) =>
  renderXlsx([tableSheet({ name: opts.sheet, title: opts.title, subtitles: opts.subtitles, columns: opts.columns, rows: opts.rows })], opts.filename)

export const downloadSessionXlsx = (opts: { filename: string; sheet: string; title: string; subtitles: string[]; statuses: Array<{ status: string }>; columns: Column[]; rows: Row[] }) =>
  renderXlsx([attendanceListSheet({ name: opts.sheet, title: opts.title, subtitles: opts.subtitles, rows: opts.statuses, columns: opts.columns, data: opts.rows })], opts.filename)
