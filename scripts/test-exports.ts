import {
  detailRows, eventRowsFromMaster, fileSlug, masterSummaryRows, matrixRows, memberTotalsRows, percentage, sheetName, toCsv,
  type MasterReport,
} from '../src/features/events/exportData.js'
import { COLOR, masterSheets, eventReportSheets, tableSheet } from '../src/features/events/exportLayout.js'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`)
}

const master: MasterReport = {
  from: '2026-10-01', to: '2026-10-31', generated_at: '2026-10-07T00:00:00Z',
  events: [
    { idx: 0, id: 'e1', title: 'Latihan rutin 1', start_at: '2026-10-03T09:00:00Z', end_at: null, location: 'Aula', event_type: 'latihan', expected: 3, hadir: 1, terlambat: 1, izin: 0, sakit: 1, alpa: 0, belum: 0, names_hadir: 'Ani, Budi', names_izin: 'Cici (sakit)', names_alpa: '' },
    { idx: 1, id: 'e2', title: 'Rapat; "evaluasi"', start_at: '2026-10-10T09:00:00Z', end_at: null, location: null, event_type: 'rapat', expected: 3, hadir: 1, terlambat: 0, izin: 1, sakit: 0, alpa: 1, belum: 0, names_hadir: 'Ani', names_izin: 'Budi (izin)', names_alpa: 'Cici' },
  ],
  members: [
    { idx: 0, id: 'm1', name: 'Ani', class_name: 'XI-1', group_name: null },
    { idx: 1, id: 'm2', name: 'Budi', class_name: 'XI-2', group_name: 'Putra' },
    { idx: 2, id: 'm3', name: 'Cici', class_name: null, group_name: null },
  ],
  cells: [
    [0, 0, 'hadir', '2026-10-03T09:01:00Z'], [0, 1, 'terlambat', '2026-10-03T09:30:00Z'], [0, 2, 'sakit', null],
    [1, 0, 'hadir', '2026-10-10T09:02:00Z'], [1, 1, 'izin', null], [1, 2, 'alpa', null],
  ],
}

const summary = masterSummaryRows(master)
check('ringkasan: baris = header + jumlah kegiatan', summary.length === 3)
check('ringkasan memuat nama yang hadir', String(summary[1][12]).includes('Ani, Budi'))
check('persentase kegiatan 1: (1+1)/(3-1)=100', summary[1][11] === 100)
check('persentase kegiatan 2: 1/(3-1)=50', summary[2][11] === 50)

const totals = memberTotalsRows(master)
check('rekap anggota: Ani 2 kegiatan, 100%', totals[1][4] === 2 && totals[1][10] === 100)
check('rekap anggota: Budi terlambat+izin = 100%', totals[2][10] === 100)
check('rekap anggota: Cici sakit+alpa = 0%', totals[3][10] === 0)

const matrix = matrixRows(master)
check('matriks: kolom = 2 + jumlah kegiatan', matrix[0].length === 4)
check('matriks: kode status benar', matrix[1][2] === 'H' && matrix[2][2] === 'T' && matrix[3][2] === 'S' && matrix[3][3] === 'A')

const detail = detailRows(master)
check('detail: satu baris per sel', detail.length === 1 + master.cells.length)
check('detail: status berbahasa Indonesia', detail.some(row => row[5] === 'Terlambat'))

const eventSheet = eventRowsFromMaster(master, 1)
check('sheet kegiatan: terurut nama dan lengkap', eventSheet.length === 4 && eventSheet[1][1] === 'Ani' && eventSheet[3][4] === 'Alpa')

check('percentage tanpa pembagi = null', percentage(0, 2, 2) === null)

const used = new Set<string>()
const first = sheetName('01 Latihan: [rutin] / pertama? sangat panjang sekali namanya', used)
const second = sheetName('01 Latihan: [rutin] / pertama? sangat panjang sekali namanya', used)
check('nama sheet maksimal 31 karakter', first.length <= 31 && second.length <= 31)
check('nama sheet tanpa karakter terlarang', !/[\\/?*[\]:]/.test(first))
check('nama sheet unik', first.toLowerCase() !== second.toLowerCase())

const csv = toCsv([['a', 'b;c', 'd"e'], ['x\ny', null, 3]])
check('csv: pemisah titik koma dan kutip digandakan', csv.startsWith('a;"b;c";"d""e"'))
check('csv: baris baru di dalam sel dikutip', csv.includes('"x\ny";;3'))
check('slug file aman', fileSlug('Rapat; "Evaluasi" 2026!') === 'rapat-evaluasi-2026')

const sheets = masterSheets(master, true)
check('sheet master: ringkasan, anggota, matriks, detail + 2 sheet kegiatan', sheets.length === 6)
check('nama sheet unik dan <= 31', new Set(sheets.map(sheet => sheet.name.toLowerCase())).size === sheets.length && sheets.every(sheet => sheet.name.length <= 31))
check('semua baris selebar kolom', sheets.every(sheet => sheet.rows.every(row => row.length === sheet.widths.length)))
check('tinggi baris satu per baris', sheets.every(sheet => sheet.heights.length === sheet.rows.length))
check('merge selalu dalam batas', sheets.every(sheet => sheet.merges.every(([t, l, b, r]) => t >= 1 && l >= 1 && b <= sheet.rows.length && r <= sheet.widths.length && t <= b && l <= r)))
check('judul digabung dan rata tengah', sheets.every(sheet => sheet.merges.some(m => m[0] === 1 && m[1] === 1 && m[3] === sheet.widths.length) && sheet.rows[0][0].align === 'center'))
const summarySheet = sheets[0]
const headerIdx = summarySheet.filterRow! - 1
check('header berwarna, tebal, berborder', summarySheet.rows[headerIdx].every(cell => cell.fill === COLOR.green && cell.bold && cell.border))
const bodyRow = summarySheet.rows[headerIdx + 1]
check('isi berborder dan nama kegiatan di-wrap', bodyRow.every(cell => cell.border) && bodyRow[2].wrap === true)
const totalRow = summarySheet.rows[summarySheet.rows.length - 1]
check('baris total menjumlah hadir dan digabung', totalRow[0].v === 'TOTAL' && totalRow[6].v === 2 && totalRow[7].v === 1 && summarySheet.merges.some(m => m[0] === summarySheet.rows.length && m[3] === 5))
check('kolom persen berwarna sesuai nilai', bodyRow[11].fill === COLOR.hadir && summarySheet.rows[headerIdx + 2][11].fill === COLOR.terlambat || summarySheet.rows[headerIdx + 2][11].fill === COLOR.alpa)
const matrixSpec = sheets[2]
check('matriks: kolom dibekukan dan header diputar', matrixSpec.freeze?.col === 2 && matrixSpec.rows[matrixSpec.freeze!.row - 1][2].rotate === 90)
const matrixBodyRow = matrixSpec.rows[matrixSpec.freeze!.row]
check('matriks: status berwarna', matrixBodyRow[2].v === 'H' && matrixBodyRow[2].fill === COLOR.hadir && matrixSpec.rows[matrixSpec.freeze!.row + 1][2].fill === COLOR.terlambat)
const detailSpec = sheets[3]
check('detail: status berwarna', detailSpec.rows[detailSpec.filterRow!].some(cell => cell.fill === COLOR.hadir))
const eventSpec = sheets[4]
check('sheet kegiatan: ringkasan angka di atas daftar', eventSpec.rows.some(row => row[0].v === 'Hadir') && eventSpec.rows.some(row => row[0].v === 1 && row[1].v === 1 && row[2].v === 0))
const long = tableSheet({ name: 'x', title: 'T', columns: [{ header: 'A', width: 10, wrap: true }], rows: [['kata '.repeat(30)]] })
check('baris panjang otomatis lebih tinggi', (long.heights[long.heights.length - 1] ?? 0) > 40)
const eventReport = eventReportSheets({
  event: { id: 'e', title: 'Latihan', start_at: '2026-10-03T09:00:00Z', end_at: null, location: 'Aula', event_type: 'latihan' }, sessions: [],
  leaves: [{ id: 'l', member_id: 'm', name: 'Cici', type: 'sakit', reason: 'Demam', status: 'disetujui', review_note: null, created_at: '2026-10-02T01:00:00Z' }],
  rows: [{ member_id: 'm', name: 'Cici', class_name: null, group_name: null, status: 'sakit', checked_in_at: null, method: 'leave', note: 'Demam' }],
})
check('laporan kegiatan: sheet kehadiran dan izin', eventReport.length === 2 && eventReport[1].name === 'Izin dan sakit')

console.log(failed ? `\n${failed} pengujian gagal` : '\nSemua pengujian lulus')
process.exit(failed ? 1 : 0)
