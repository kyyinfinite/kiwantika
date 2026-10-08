import {
  detailRows, eventRowsFromMaster, fileSlug, masterSummaryRows, matrixRows, memberTotalsRows, percentage, sheetName, toCsv,
  type MasterReport,
} from '../src/features/events/exportData.js'

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

console.log(failed ? `\n${failed} pengujian gagal` : '\nSemua pengujian lulus')
process.exit(failed ? 1 : 0)
