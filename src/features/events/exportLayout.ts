import {
  STATUS_LABEL, fmtDate, fmtDateTime, fmtTime, percentage, sheetName,
  type EventReport, type MasterReport, type Row,
} from './exportData'

export type SpecCell = {
  v: string | number | null
  align?: 'left' | 'center' | 'right'
  wrap?: boolean
  bold?: boolean
  size?: number
  fill?: string
  color?: string
  border?: boolean
  rotate?: number
}

export type SheetSpec = {
  name: string
  widths: number[]
  rows: SpecCell[][]
  heights: Array<number | undefined>
  merges: Array<[number, number, number, number]>
  freeze?: { row: number; col: number }
  filterRow?: number
  tab?: string
}

export const COLOR = {
  ink: 'FF1B2A21', green: 'FF1F5C38', greenSoft: 'FFE3EFE7', zebra: 'FFF5F8F6', white: 'FFFFFFFF', muted: 'FF5C6B62',
  hadir: 'FFD5EBDB', terlambat: 'FFFBEDC2', izin: 'FFD6E5F5', sakit: 'FFE2DDF3', alpa: 'FFF5D2CC', belum: 'FFECEEED',
}

const STATUS_FILL: Record<string, string> = {
  hadir: COLOR.hadir, terlambat: COLOR.terlambat, izin: COLOR.izin, sakit: COLOR.sakit, alpa: COLOR.alpa, belum_hadir: COLOR.belum,
}

const blank = (count: number): SpecCell[] => Array.from({ length: count }, () => ({ v: null }))
const percentFill = (value: number | null) => value == null ? COLOR.belum : value >= 80 ? COLOR.hadir : value >= 60 ? COLOR.terlambat : COLOR.alpa

function lines(text: string, width: number) {
  const usable = Math.max(4, width - 1.5)
  return String(text).split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / usable)), 0)
}

function frame(columns: number, title: string, subtitles: string[]) {
  const rows: SpecCell[][] = []
  const heights: Array<number | undefined> = []
  const merges: Array<[number, number, number, number]> = []
  const push = (cell: SpecCell, height: number) => {
    const row = blank(columns)
    row[0] = cell
    rows.push(row)
    heights.push(height)
    merges.push([rows.length, 1, rows.length, columns])
  }
  push({ v: title, align: 'center', bold: true, size: 16, color: COLOR.green }, 30)
  for (const text of subtitles) push({ v: text, align: 'center', size: 10.5, color: COLOR.muted }, 18)
  rows.push(blank(columns))
  heights.push(8)
  return { rows, heights, merges }
}

const head = (v: string): SpecCell => ({ v, align: 'center', wrap: true, bold: true, color: COLOR.white, fill: COLOR.green, border: true })

export type Column = {
  header: string
  width: number
  align?: 'left' | 'center' | 'right'
  wrap?: boolean
  kind?: 'status' | 'percent' | 'plain'
}

export function tableSheet(opts: {
  name: string; title: string; subtitles?: string[]; columns: Column[]; rows: Row[]
  totals?: { label: string; labelSpan: number; values: Array<string | number | null> }
  tab?: string
  bare?: boolean
}): SheetSpec {
  const count = opts.columns.length
  const { rows, heights, merges } = opts.bare ? { rows: [] as SpecCell[][], heights: [] as Array<number | undefined>, merges: [] as Array<[number, number, number, number]> } : frame(count, opts.title, opts.subtitles ?? [])
  const headerRow = rows.length + 1
  rows.push(opts.columns.map(column => head(column.header)))
  heights.push(Math.max(30, ...opts.columns.map(column => lines(column.header, column.width) * 15 + 6)))

  opts.rows.forEach((data, index) => {
    const zebra = index % 2 === 1 ? COLOR.zebra : undefined
    let tall = 1
    const cells = opts.columns.map((column, c): SpecCell => {
      const value = data[c] ?? ''
      const text = String(value)
      if (column.wrap) tall = Math.max(tall, lines(text, column.width))
      const base: SpecCell = {
        v: value === '' ? null : value, border: true, wrap: !!column.wrap,
        align: column.align ?? (typeof value === 'number' ? 'center' : 'left'), fill: zebra, color: COLOR.ink,
      }
      if (column.kind === 'status') {
        const key = Object.entries(STATUS_LABEL).find(([, label]) => label === text)?.[0] ?? text.toLowerCase()
        return { ...base, align: 'center', bold: true, fill: STATUS_FILL[key] ?? zebra }
      }
      if (column.kind === 'percent') {
        const number = typeof value === 'number' ? value : null
        return { ...base, v: number == null ? '-' : `${number}%`, align: 'center', bold: true, fill: percentFill(number) }
      }
      return base
    })
    rows.push(cells)
    heights.push(tall > 1 ? Math.min(300, tall * 15 + 4) : 20)
  })

  if (opts.totals) {
    const { label, labelSpan, values } = opts.totals
    const cells: SpecCell[] = opts.columns.map((column, c): SpecCell => {
      const base: SpecCell = { v: null, border: true, bold: true, fill: COLOR.greenSoft, align: 'center', color: COLOR.ink }
      if (c === 0) return { ...base, v: label, align: 'right' }
      if (c < labelSpan) return base
      const value = values[c - labelSpan] ?? null
      return column.kind === 'percent' ? { ...base, v: value == null ? '-' : `${value}%` } : { ...base, v: value }
    })
    rows.push(cells)
    heights.push(22)
    merges.push([rows.length, 1, rows.length, labelSpan])
  }

  return {
    name: opts.name, widths: opts.columns.map(column => column.width), rows, heights, merges,
    freeze: { row: headerRow, col: 0 }, filterRow: headerRow, tab: opts.tab,
  }
}

const statusCounts = (rows: Array<{ status: string }>) => {
  const count = (key: string) => rows.filter(row => row.status === key).length
  const expected = rows.length
  const present = count('hadir') + count('terlambat')
  return { hadir: count('hadir'), terlambat: count('terlambat'), izin: count('izin'), sakit: count('sakit'), alpa: count('alpa'),
    belum: count('belum_hadir'), expected, rate: percentage(present, expected - count('belum_hadir'), count('izin') + count('sakit')) }
}

export function attendanceListSheet(opts: {
  name: string; title: string; subtitles: string[]; rows: Array<{ status: string }>
  columns: Column[]; data: Row[]; tab?: string
}): SheetSpec {
  const count = opts.columns.length
  const summaryCols = Math.min(6, count)
  const { rows, heights, merges } = frame(count, opts.title, opts.subtitles)
  const totals = statusCounts(opts.rows)
  const labels = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', '% Kehadiran'].slice(0, summaryCols)
  const values = [totals.hadir, totals.terlambat, totals.izin, totals.sakit, totals.alpa, totals.rate == null ? '-' : `${totals.rate}%`].slice(0, summaryCols)
  const fills = [COLOR.hadir, COLOR.terlambat, COLOR.izin, COLOR.sakit, COLOR.alpa, percentFill(totals.rate)]
  rows.push([...labels.map(label => ({ ...head(label), size: 10 })), ...blank(count - summaryCols)])
  heights.push(20)
  rows.push([...values.map((value, index) => ({ v: value, align: 'center' as const, bold: true, size: 15, border: true, fill: fills[index], color: COLOR.ink })), ...blank(count - summaryCols)])
  heights.push(30)
  rows.push(blank(count))
  heights.push(8)
  const table = tableSheet({ name: opts.name, title: '', columns: opts.columns, rows: opts.data, bare: true })
  const offset = rows.length
  rows.push(...table.rows)
  heights.push(...table.heights)
  return {
    name: opts.name, widths: opts.columns.map(column => column.width), rows, heights, merges,
    freeze: { row: offset + 1, col: 0 }, filterRow: offset + 1, tab: opts.tab,
  }
}

const EVENT_COLUMNS: Column[] = [
  { header: 'No', width: 6, align: 'center' }, { header: 'Nama', width: 30 }, { header: 'Kelas', width: 11, align: 'center' },
  { header: 'Kelompok', width: 14, align: 'center' }, { header: 'Status', width: 14, kind: 'status' }, { header: 'Waktu absen', width: 20, align: 'center' },
]

export function eventInfoLines(event: { start_at: string; end_at: string | null; location: string | null; event_type: string }) {
  const time = `${fmtTime(event.start_at)}${event.end_at ? ` - ${fmtTime(event.end_at)}` : ''} WIB`
  return [`${fmtDate(event.start_at)} • ${time}${event.location ? ` • ${event.location}` : ''}`, `Jenis kegiatan: ${event.event_type}`]
}

export function masterEventSheet(master: MasterReport, eventIdx: number, used: Set<string>): SheetSpec {
  const event = master.events.find(item => item.idx === eventIdx)!
  const members = new Map(master.members.map(member => [member.idx, member]))
  const list = master.cells.filter(cell => cell[0] === eventIdx)
    .map(cell => ({ member: members.get(cell[1])!, status: cell[2], at: cell[3] }))
    .filter(item => item.member).sort((a, b) => a.member.name.localeCompare(b.member.name))
  return attendanceListSheet({
    name: sheetName(`${String(eventIdx + 1).padStart(2, '0')} ${event.title}`, used),
    title: event.title, subtitles: eventInfoLines(event), rows: list, columns: EVENT_COLUMNS,
    data: list.map((item, index) => [index + 1, item.member.name, item.member.class_name ?? '', item.member.group_name ?? '', STATUS_LABEL[item.status] ?? item.status, fmtDateTime(item.at)]),
  })
}

export function eventReportSheets(report: EventReport): SheetSpec[] {
  const used = new Set<string>()
  const columns: Column[] = [...EVENT_COLUMNS, { header: 'Metode', width: 14, align: 'center' }, { header: 'Catatan', width: 34, wrap: true }]
  const sheets: SheetSpec[] = [attendanceListSheet({
    name: sheetName('Kehadiran', used), title: report.event.title, subtitles: eventInfoLines(report.event), rows: report.rows, columns,
    data: report.rows.map((row, index) => [index + 1, row.name, row.class_name ?? '', row.group_name ?? '', STATUS_LABEL[row.status] ?? row.status,
      fmtDateTime(row.checked_in_at), row.method ?? '', row.note ?? '']),
  })]
  if (report.leaves.length) {
    sheets.push(tableSheet({
      name: sheetName('Izin dan sakit', used), title: `Izin & sakit: ${report.event.title}`, subtitles: eventInfoLines(report.event),
      columns: [{ header: 'No', width: 6, align: 'center' }, { header: 'Nama', width: 28 }, { header: 'Jenis', width: 10, align: 'center' },
        { header: 'Alasan', width: 44, wrap: true }, { header: 'Status', width: 14, align: 'center' }, { header: 'Catatan pembina', width: 30, wrap: true }, { header: 'Diajukan', width: 20, align: 'center' }],
      rows: report.leaves.map((leave, index) => [index + 1, leave.name, leave.type, leave.reason, leave.status, leave.review_note ?? '', fmtDateTime(leave.created_at)]),
    }))
  }
  return sheets
}

export function masterSheets(master: MasterReport, perEvent = true): SheetSpec[] {
  const used = new Set<string>()
  const period = `Periode ${fmtDate(master.from)} s.d. ${fmtDate(master.to)}`
  const made = `Dibuat ${fmtDateTime(master.generated_at)} WIB`
  const sheets: SheetSpec[] = []

  const sum = (key: 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa') => master.events.reduce((total, event) => total + event[key], 0)
  const expected = master.events.reduce((total, event) => total + event.expected - event.belum, 0)
  sheets.push(tableSheet({
    name: sheetName('Ringkasan Kegiatan', used), title: 'REKAP KEHADIRAN KEGIATAN KIWANTIKA', subtitles: ['SMAN 10 Garut', period, made], tab: COLOR.green,
    columns: [
      { header: 'No', width: 5, align: 'center' }, { header: 'Tanggal', width: 12, align: 'center' }, { header: 'Kegiatan', width: 30, wrap: true },
      { header: 'Jenis', width: 12, align: 'center' }, { header: 'Lokasi', width: 20, wrap: true }, { header: 'Peserta wajib', width: 10, align: 'center' },
      { header: 'Hadir', width: 8, align: 'center' }, { header: 'Terlambat', width: 10, align: 'center' }, { header: 'Izin', width: 7, align: 'center' },
      { header: 'Sakit', width: 7, align: 'center' }, { header: 'Alpa', width: 7, align: 'center' }, { header: '% Hadir', width: 10, kind: 'percent' },
      { header: 'Yang hadir', width: 46, wrap: true }, { header: 'Izin / sakit', width: 32, wrap: true }, { header: 'Alpa', width: 28, wrap: true },
    ],
    rows: master.events.map((event, index) => [index + 1, fmtDate(event.start_at), event.title, event.event_type, event.location ?? '', event.expected,
      event.hadir, event.terlambat, event.izin, event.sakit, event.alpa,
      percentage(event.hadir + event.terlambat, event.expected - event.belum, event.izin + event.sakit), event.names_hadir, event.names_izin, event.names_alpa]),
    totals: {
      label: 'TOTAL', labelSpan: 5,
      values: [master.events.reduce((total, event) => total + event.expected, 0), sum('hadir'), sum('terlambat'), sum('izin'), sum('sakit'), sum('alpa'),
        percentage(sum('hadir') + sum('terlambat'), expected, sum('izin') + sum('sakit')), '', '', ''],
    },
  }))

  const totals = new Map<number, Record<string, number>>()
  for (const [, memberIdx, status] of master.cells) {
    if (status === 'belum_hadir') continue
    const entry = totals.get(memberIdx) ?? { total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
    entry.total += 1
    entry[status] = (entry[status] ?? 0) + 1
    totals.set(memberIdx, entry)
  }
  sheets.push(tableSheet({
    name: sheetName('Rekap Anggota', used), title: 'REKAP KEHADIRAN PER ANGGOTA', subtitles: [period, made], tab: COLOR.green,
    columns: [
      { header: 'No', width: 5, align: 'center' }, { header: 'Nama', width: 28 }, { header: 'Kelas', width: 11, align: 'center' }, { header: 'Kelompok', width: 14, align: 'center' },
      { header: 'Total kegiatan', width: 11, align: 'center' }, { header: 'Hadir', width: 8, align: 'center' }, { header: 'Terlambat', width: 10, align: 'center' },
      { header: 'Izin', width: 7, align: 'center' }, { header: 'Sakit', width: 7, align: 'center' }, { header: 'Alpa', width: 7, align: 'center' }, { header: '% Hadir', width: 10, kind: 'percent' },
    ],
    rows: master.members.map((member, index) => {
      const e = totals.get(member.idx) ?? { total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
      return [index + 1, member.name, member.class_name ?? '', member.group_name ?? '', e.total, e.hadir, e.terlambat, e.izin, e.sakit, e.alpa,
        percentage(e.hadir + e.terlambat, e.total, e.izin + e.sakit)]
    }),
  }))

  sheets.push(matrixSheet(master, sheetName('Matriks', used), period))

  sheets.push(tableSheet({
    name: sheetName('Detail', used), title: 'DETAIL KEHADIRAN', subtitles: [period, made],
    columns: [
      { header: 'Tanggal', width: 12, align: 'center' }, { header: 'Kegiatan', width: 30, wrap: true }, { header: 'Nama', width: 28 },
      { header: 'Kelas', width: 11, align: 'center' }, { header: 'Kelompok', width: 14, align: 'center' }, { header: 'Status', width: 14, kind: 'status' }, { header: 'Waktu absen', width: 20, align: 'center' },
    ],
    rows: (() => {
      const events = new Map(master.events.map(event => [event.idx, event]))
      const members = new Map(master.members.map(member => [member.idx, member]))
      return [...master.cells].sort((a, b) => a[0] - b[0] || (members.get(a[1])?.name ?? '').localeCompare(members.get(b[1])?.name ?? ''))
        .filter(cell => events.has(cell[0]) && members.has(cell[1]))
        .map(([e, m, status, at]) => [fmtDate(events.get(e)!.start_at), events.get(e)!.title, members.get(m)!.name, members.get(m)!.class_name ?? '',
          members.get(m)!.group_name ?? '', STATUS_LABEL[status] ?? status, fmtDateTime(at)])
    })(),
  }))

  if (perEvent) for (const event of master.events.slice(0, 60)) sheets.push(masterEventSheet(master, event.idx, used))
  return sheets
}

export function matrixSheet(master: MasterReport, name: string, period: string): SheetSpec {
  const columns = 2 + master.events.length
  const { rows, heights, merges } = frame(columns, 'MATRIKS KEHADIRAN ANGGOTA x KEGIATAN', [period])
  const headerRow = rows.length + 1
  rows.push([head('Nama'), head('Kelas'), ...master.events.map(event => ({
    ...head(`${fmtDate(event.start_at).slice(0, 5)} ${event.title}`.slice(0, 34)), rotate: 90, wrap: false,
  }))])
  heights.push(150)
  const position = new Map(master.members.map((member, index) => [member.idx, index]))
  const body = master.members.map(member => [
    { v: member.name, border: true, color: COLOR.ink, align: 'left' as const },
    { v: member.class_name ?? '', border: true, color: COLOR.ink, align: 'center' as const },
    ...master.events.map((): SpecCell => ({ v: '', border: true, align: 'center', fill: COLOR.zebra })),
  ] as SpecCell[])
  const codes: Record<string, string> = { hadir: 'H', terlambat: 'T', izin: 'I', sakit: 'S', alpa: 'A', belum_hadir: '-' }
  for (const [eventIdx, memberIdx, status] of master.cells) {
    const row = body[position.get(memberIdx) ?? -1]
    if (row) row[2 + eventIdx] = { v: codes[status] ?? status, border: true, align: 'center', bold: true, color: COLOR.ink, fill: STATUS_FILL[status] ?? COLOR.belum }
  }
  body.forEach(row => { rows.push(row); heights.push(20) })
  rows.push(blank(columns)); heights.push(8)
  const legendRow = blank(columns)
  legendRow[0] = { v: 'Keterangan:  H Hadir  •  T Terlambat  •  I Izin  •  S Sakit  •  A Alpa  •  - Belum hadir  •  kosong = bukan peserta wajib', align: 'left', color: COLOR.muted, size: 10 }
  rows.push(legendRow); heights.push(18); merges.push([rows.length, 1, rows.length, Math.max(columns, 2)])
  return { name, widths: [28, 11, ...master.events.map(() => 6)], rows, heights, merges, freeze: { row: headerRow, col: 2 }, tab: COLOR.green }
}

