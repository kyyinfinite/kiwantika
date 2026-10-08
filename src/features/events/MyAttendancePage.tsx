import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, StatCard, dateOnly } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'
import { STATUS_LABEL } from './exportData'

type History = Array<{ event_id: string; title: string; start_at: string; event_type: string; status: string }>
type Summary = { total: number; hadir: number; terlambat: number; izin: number; sakit: number; alpa: number; percentage: number | null } | null

export function useMyAttendance(limit = 30) {
  const [history, setHistory] = useState<History | null>(null)
  const [summary, setSummary] = useState<Summary>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([rpc<History>('my_attendance_history', { p_limit: limit }), rpc<Summary>('my_attendance_summary')])
      .then(([list, total]) => { setHistory(list); setSummary(total) })
      .catch(e => { setError(errorText(e)); setHistory([]) })
  }, [limit])
  return { history, summary, error }
}

export function MyAttendanceMini() {
  const { history, error } = useMyAttendance(5)
  if (error) return <p className="muted">Riwayat belum tersedia.</p>
  if (!history) return <TableSkeleton rows={3} cols={2} />
  return <div className="compact-list">{history.map(item => <div className="compact-row text-row" key={item.event_id}>
    <div><strong>{item.title}</strong><small>{dateOnly(item.start_at)}</small></div>
    <span className={`status att-${item.status}`}>{STATUS_LABEL[item.status] ?? item.status}</span></div>)}
    {!history.length && <div className="empty">Belum ada kegiatan dengan absensi.</div>}</div>
}

export function MyAttendancePage() {
  const { history, summary, error } = useMyAttendance(100)
  return <div className="wrap page-pad member-page">
    <Link className="back-link" to="/dashboard">← Dashboard</Link>
    <div className="admin-heading"><div><span className="eyebrow">Absensi</span><h1>Kehadiranku per kegiatan</h1>
      <p className="lead">Izin dan sakit yang disetujui tercatat otomatis. Belum bisa hadir? Ajukan sebelum kegiatan mulai.</p></div>
      <div className="admin-heading-actions"><Link className="btn" to="/dashboard/izin">Ajukan izin / sakit</Link><Link className="btn secondary" to="/absen">Absen dengan kode</Link></div></div>
    {error && <Notice error>{error}</Notice>}
    <div className="stat-grid">
      <StatCard icon="%" label="Kehadiran" value={summary?.percentage == null ? '-' : `${summary.percentage}%`} note={`${summary?.total ?? 0} kegiatan selesai`} tone="ok" />
      <StatCard icon="✓" label="Hadir" value={(summary?.hadir ?? 0) + (summary?.terlambat ?? 0)} note={`${summary?.terlambat ?? 0} terlambat`} />
      <StatCard icon="✉" label="Izin / sakit" value={(summary?.izin ?? 0) + (summary?.sakit ?? 0)} />
      <StatCard icon="–" label="Alpa" value={summary?.alpa ?? 0} tone="warn" />
    </div>
    <Panel title="Riwayat kegiatan">
      {!history ? <TableSkeleton rows={5} cols={3} /> : <div className="table-wrap"><table>
        <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Status</th></tr></thead>
        <tbody>{history.map(item => <tr key={item.event_id}><td><strong>{item.title}</strong><small>{item.event_type}</small></td><td>{dateOnly(item.start_at)}</td>
          <td><span className={`status att-${item.status}`}>{STATUS_LABEL[item.status] ?? item.status}</span></td></tr>)}
          {!history.length && <tr><td colSpan={3}>Belum ada riwayat.</td></tr>}</tbody></table></div>}
    </Panel>
  </div>
}
