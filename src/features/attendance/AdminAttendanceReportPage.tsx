import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, MonitorPlay } from 'lucide-react'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, StatCard, dateTime } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'
import { STATUS_LABEL, STATUS_OPTIONS, sessionPhase, type Report } from './api'
import { downloadSessionXlsx } from '../events/download'
import { fileSlug } from '../events/exportData'

const FILTERS = ['semua', 'hadir', 'terlambat', 'izin', 'sakit', 'belum_hadir', 'alpa'] as const

export function AdminAttendanceReportPage() {
  const { id = '' } = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('semua')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')

  const load = async () => {
    try { setReport(await rpc<Report>('attendance_session_report', { p_session_id: id })) } catch (e) { setError(errorText(e)) }
  }
  useEffect(() => { load() }, [id])

  const ended = report ? sessionPhase(report.session) === 'selesai' : false
  const label = (status: string) => status === 'belum_hadir' && ended ? 'Alpa' : STATUS_LABEL[status] ?? status
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of report?.rows ?? []) map[row.status] = (map[row.status] ?? 0) + 1
    return map
  }, [report])
  const rows = (report?.rows ?? []).filter(row => filter === 'semua' || row.status === filter)

  const change = async (memberId: string, status: string) => {
    setSaving(memberId)
    try { await rpc('set_attendance_status', { p_session_id: id, p_member_id: memberId, p_status: status, p_note: null }); await load() }
    catch (e) { setError(errorText(e)) }
    finally { setSaving('') }
  }

  const exportXlsx = async () => {
    if (!report) return
    try {
      await downloadSessionXlsx({
        filename: `absensi-${fileSlug(report.session.title)}.xlsx`, sheet: 'Absensi', title: report.session.title,
        subtitles: [`${dateTime(report.session.starts_at)} WIB • terlambat setelah ${report.session.late_after_minutes} menit`],
        statuses: report.rows,
        columns: [
          { header: 'No', width: 6, align: 'center' }, { header: 'Nama', width: 30 }, { header: 'Kelas', width: 11, align: 'center' },
          { header: 'Kelompok', width: 14, align: 'center' }, { header: 'Status', width: 14, kind: 'status' }, { header: 'Waktu absen', width: 20, align: 'center' },
          { header: 'Metode', width: 14, align: 'center' }, { header: 'Catatan', width: 34, wrap: true },
        ],
        rows: report.rows.map((row, index) => [index + 1, row.name, row.class_name ?? '', row.group_name ?? '', label(row.status), row.checked_in_at ? dateTime(row.checked_in_at) : '', row.method ?? '', row.note ?? '']),
      })
    } catch (e) { setError(errorText(e)) }
  }

  return <div className="wrap page-pad">
    <Link className="back-link" to="/admin/absensi">← Sesi absensi</Link>
    <div className="admin-heading"><div><span className="eyebrow">Rekap absensi</span><h1>{report?.session.title ?? 'Memuat…'}</h1>
      {report && <p className="lead">{dateTime(report.session.starts_at)} • terlambat setelah {report.session.late_after_minutes} menit</p>}</div>
      <div className="admin-heading-actions">
        {report && !ended && report.session.mode === 'rotating' && <Link className="btn secondary" to={`/admin/absensi/${id}/layar`}><MonitorPlay size={16} /> Layar QR</Link>}
        <button className="btn" onClick={exportXlsx} disabled={!report}><Download size={16} /> Ekspor Excel</button>
      </div></div>
    {error && <Notice error>{error}</Notice>}
    <div className="stat-grid">
      <StatCard icon="✓" label="Hadir" value={counts.hadir ?? 0} />
      <StatCard icon="⏱" label="Terlambat" value={counts.terlambat ?? 0} />
      <StatCard icon="✉" label="Izin / sakit" value={(counts.izin ?? 0) + (counts.sakit ?? 0)} />
      <StatCard icon="–" label={ended ? 'Alpa' : 'Belum hadir'} value={(counts.belum_hadir ?? 0) + (counts.alpa ?? 0)} tone="warn" />
    </div>
    <Panel title="Daftar anggota">
      <div className="permission-tabs">{FILTERS.map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'semua' ? 'Semua' : label(item)}{item !== 'semua' ? ` (${counts[item] ?? 0})` : ''}</button>)}</div>
      {!report ? <TableSkeleton rows={6} cols={4} /> : <div className="table-wrap"><table>
        <thead><tr><th>Anggota</th><th>Status</th><th>Waktu</th><th>Ubah</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.member_id}>
          <td><strong>{row.name}</strong><small>{[row.class_name, row.group_name].filter(Boolean).join(' • ') || '-'}</small></td>
          <td><span className={`status att-${row.status}`}>{label(row.status)}</span>{row.note && <small>{row.note}</small>}</td>
          <td>{row.checked_in_at ? dateTime(row.checked_in_at) : '-'}</td>
          <td><select disabled={saving === row.member_id} value={STATUS_OPTIONS.includes(row.status as never) ? row.status : ''} onChange={event => change(row.member_id, event.target.value)}>
            <option value="" disabled>Pilih</option>{STATUS_OPTIONS.map(option => <option key={option} value={option}>{STATUS_LABEL[option]}</option>)}</select></td>
        </tr>)}{!rows.length && <tr><td colSpan={4}>Tidak ada data.</td></tr>}</tbody></table></div>}
    </Panel>
  </div>
}
