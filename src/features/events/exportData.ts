export type Cell = [number, number, string, string | null]

export type MasterEvent = {
  idx: number; id: string; title: string; start_at: string; end_at: string | null; location: string | null; event_type: string
  expected: number; hadir: number; terlambat: number; izin: number; sakit: number; alpa: number; belum: number
  names_hadir: string; names_izin: string; names_alpa: string
}
export type MasterMember = { idx: number; id: string; name: string; class_name: string | null; group_name: string | null }
export type MasterReport = { from: string; to: string; generated_at: string; events: MasterEvent[]; members: MasterMember[]; cells: Cell[] }

export type EventRow = {
  member_id: string; name: string; class_name: string | null; group_name: string | null
  status: string; checked_in_at: string | null; method: string | null; note: string | null
}
export type EventLeave = { id: string; member_id: string; name: string; type: string; reason: string; status: string; review_note: string | null; created_at: string }
export type EventReport = {
  event: { id: string; title: string; start_at: string; end_at: string | null; location: string | null; event_type: string }
  sessions: Array<{ id: string; title: string; starts_at: string; expires_at: string | null; status: string; mode: string }>
  leaves: EventLeave[]
  rows: EventRow[]
}

export type Row = Array<string | number | null>

export const STATUS_LABEL: Record<string, string> = {
  hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', sakit: 'Sakit', alpa: 'Alpa', belum_hadir: 'Belum hadir',
}
export const STATUS_CODE: Record<string, string> = { hadir: 'H', terlambat: 'T', izin: 'I', sakit: 'S', alpa: 'A', belum_hadir: '-' }

const zone = 'Asia/Jakarta'
export const fmtDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('id-ID', { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
export const fmtTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleTimeString('id-ID', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':') : ''
export const fmtDateTime = (value: string | null | undefined) => value ? `${fmtDate(value)} ${fmtTime(value)}` : ''

export function percentage(present: number, expected: number, excused: number) {
  const base = expected - excused
  return base > 0 ? Math.round((present / base) * 100) : null
}

export function sheetName(raw: string, used: Set<string>) {
  const clean = raw.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet'
  let name = clean.slice(0, 31)
  let counter = 2
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${counter++}`
    name = clean.slice(0, 31 - suffix.length) + suffix
  }
  used.add(name.toLowerCase())
  return name
}

export const fileSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'rekap'

export function toCsv(rows: Row[], delimiter = ';') {
  const quote = (value: string | number | null) => {
    const text = value == null ? '' : String(value)
    return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return rows.map(row => row.map(quote).join(delimiter)).join('\r\n')
}

const COUNT_HEADER = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa']

export function masterSummaryRows(master: MasterReport): Row[] {
  const rows: Row[] = [['No', 'Tanggal', 'Kegiatan', 'Jenis', 'Lokasi', 'Peserta wajib', ...COUNT_HEADER, '% Kehadiran', 'Yang hadir', 'Izin / sakit', 'Alpa']]
  master.events.forEach((event, index) => {
    rows.push([
      index + 1, fmtDate(event.start_at), event.title, event.event_type, event.location ?? '', event.expected,
      event.hadir, event.terlambat, event.izin, event.sakit, event.alpa,
      percentage(event.hadir + event.terlambat, event.expected - event.belum, event.izin + event.sakit),
      event.names_hadir, event.names_izin, event.names_alpa,
    ])
  })
  return rows
}

export function memberTotalsRows(master: MasterReport): Row[] {
  const totals = new Map<number, Record<string, number>>()
  for (const [, memberIdx, status] of master.cells) {
    if (status === 'belum_hadir') continue
    const entry = totals.get(memberIdx) ?? { total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
    entry.total += 1
    entry[status] = (entry[status] ?? 0) + 1
    totals.set(memberIdx, entry)
  }
  const rows: Row[] = [['No', 'Nama', 'Kelas', 'Kelompok', 'Total kegiatan', ...COUNT_HEADER, '% Kehadiran']]
  master.members.forEach((member, index) => {
    const entry = totals.get(member.idx) ?? { total: 0, hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
    rows.push([
      index + 1, member.name, member.class_name ?? '', member.group_name ?? '', entry.total,
      entry.hadir, entry.terlambat, entry.izin, entry.sakit, entry.alpa,
      percentage(entry.hadir + entry.terlambat, entry.total, entry.izin + entry.sakit),
    ])
  })
  return rows
}

export function matrixRows(master: MasterReport): Row[] {
  const header: Row = ['Nama', 'Kelas', ...master.events.map(event => `${fmtDate(event.start_at).slice(0, 5)} ${event.title}`.slice(0, 40))]
  const grid = master.members.map(member => [member.name, member.class_name ?? '', ...master.events.map(() => '')] as Row)
  const position = new Map(master.members.map((member, index) => [member.idx, index]))
  for (const [eventIdx, memberIdx, status] of master.cells) {
    const row = grid[position.get(memberIdx) ?? -1]
    if (row) row[2 + eventIdx] = STATUS_CODE[status] ?? status
  }
  return [header, ...grid, [], ['Keterangan: H hadir, T terlambat, I izin, S sakit, A alpa, - belum / kosong tidak termasuk peserta']]
}

export function detailRows(master: MasterReport): Row[] {
  const rows: Row[] = [['Tanggal', 'Kegiatan', 'Nama', 'Kelas', 'Kelompok', 'Status', 'Waktu absen']]
  const events = new Map(master.events.map(event => [event.idx, event]))
  const members = new Map(master.members.map(member => [member.idx, member]))
  const sorted = [...master.cells].sort((a, b) => a[0] - b[0] || (members.get(a[1])?.name ?? '').localeCompare(members.get(b[1])?.name ?? ''))
  for (const [eventIdx, memberIdx, status, at] of sorted) {
    const event = events.get(eventIdx)
    const member = members.get(memberIdx)
    if (!event || !member) continue
    rows.push([fmtDate(event.start_at), event.title, member.name, member.class_name ?? '', member.group_name ?? '', STATUS_LABEL[status] ?? status, fmtDateTime(at)])
  }
  return rows
}

export function eventRowsFromMaster(master: MasterReport, eventIdx: number): Row[] {
  const members = new Map(master.members.map(member => [member.idx, member]))
  const rows: Row[] = [['No', 'Nama', 'Kelas', 'Kelompok', 'Status', 'Waktu absen']]
  const list = master.cells.filter(cell => cell[0] === eventIdx)
    .map(cell => ({ member: members.get(cell[1]), status: cell[2], at: cell[3] }))
    .filter(item => item.member)
    .sort((a, b) => a.member!.name.localeCompare(b.member!.name))
  list.forEach((item, index) => rows.push([index + 1, item.member!.name, item.member!.class_name ?? '', item.member!.group_name ?? '', STATUS_LABEL[item.status] ?? item.status, fmtDateTime(item.at)]))
  return rows
}

export function eventListRows(report: EventReport): Row[] {
  const rows: Row[] = [['No', 'Nama', 'Kelas', 'Kelompok', 'Status', 'Waktu absen', 'Metode', 'Catatan']]
  report.rows.forEach((row, index) => rows.push([
    index + 1, row.name, row.class_name ?? '', row.group_name ?? '', STATUS_LABEL[row.status] ?? row.status,
    fmtDateTime(row.checked_in_at), row.method ?? '', row.note ?? '',
  ]))
  return rows
}

export function eventSummaryRows(report: EventReport): Row[] {
  const count = (status: string) => report.rows.filter(row => row.status === status).length
  const expected = report.rows.length
  return [
    ['Kegiatan', report.event.title], ['Jenis', report.event.event_type], ['Tanggal', fmtDate(report.event.start_at)],
    ['Waktu', `${fmtTime(report.event.start_at)}${report.event.end_at ? ` - ${fmtTime(report.event.end_at)}` : ''} WIB`],
    ['Lokasi', report.event.location ?? ''], [],
    ['Peserta wajib', expected], ['Hadir', count('hadir')], ['Terlambat', count('terlambat')],
    ['Izin', count('izin')], ['Sakit', count('sakit')], ['Alpa', count('alpa')], ['Belum hadir', count('belum_hadir')],
    ['% Kehadiran', percentage(count('hadir') + count('terlambat'), expected - count('belum_hadir'), count('izin') + count('sakit')) ?? ''],
  ]
}

export function eventLeaveRows(report: EventReport): Row[] {
  return [['Nama', 'Jenis', 'Alasan', 'Status', 'Catatan pembina', 'Diajukan'],
    ...report.leaves.map(leave => [leave.name, leave.type, leave.reason, leave.status, leave.review_note ?? '', fmtDateTime(leave.created_at)])]
}
