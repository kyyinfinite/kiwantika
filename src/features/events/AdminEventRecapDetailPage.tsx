import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Download, FileText, MonitorPlay, Plus, X } from 'lucide-react'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, StatCard, dateTime } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'
import { downloadEventCsv, downloadEventXlsx } from './download'
import { STATUS_LABEL, percentage, type EventReport } from './exportData'

const STATUS_OPTIONS = ['hadir', 'terlambat', 'izin', 'sakit', 'alpa'] as const
const FILTERS = ['semua', 'hadir', 'terlambat', 'izin', 'sakit', 'alpa', 'belum_hadir'] as const

export function AdminEventRecapDetailPage() {
  const { id = '' } = useParams()
  const [report, setReport] = useState<EventReport | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('semua')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try { setReport(await rpc<EventReport>('event_attendance_report', { p_event_id: id })) } catch (e) { setError(errorText(e)) }
  }
  useEffect(() => { load() }, [id])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of report?.rows ?? []) map[row.status] = (map[row.status] ?? 0) + 1
    return map
  }, [report])
  const rows = (report?.rows ?? []).filter(row => filter === 'semua' || row.status === filter)
  const expected = report?.rows.length ?? 0
  const rate = percentage((counts.hadir ?? 0) + (counts.terlambat ?? 0), expected - (counts.belum_hadir ?? 0), (counts.izin ?? 0) + (counts.sakit ?? 0))
  const openSessions = (report?.sessions ?? []).filter(session => session.mode === 'rotating' && session.status === 'active' && (!session.expires_at || new Date(session.expires_at).getTime() > Date.now()))

  const change = async (memberId: string, status: string) => {
    setSaving(memberId)
    try { await rpc('set_event_attendance_status', { p_event_id: id, p_member_id: memberId, p_status: status, p_note: null }); await load() }
    catch (e) { setError(errorText(e)) } finally { setSaving('') }
  }

  const review = async (leaveId: string, decision: 'disetujui' | 'ditolak') => {
    setSaving(leaveId)
    try { await rpc('review_leave_request', { p_id: leaveId, p_decision: decision, p_note: notes[leaveId] || null }); await load() }
    catch (e) { setError(errorText(e)) } finally { setSaving('') }
  }

  const run = async (task: () => Promise<void> | void) => { try { await task() } catch (e) { setError(errorText(e)) } }
  const pending = (report?.leaves ?? []).filter(leave => leave.status === 'menunggu')

  return <div className="wrap page-pad">
    <Link className="back-link" to="/admin/rekap">← Rekap kegiatan</Link>
    <div className="admin-heading"><div><span className="eyebrow">{report?.event.event_type ?? 'Kegiatan'}</span><h1>{report?.event.title ?? 'Memuat…'}</h1>
      {report && <p className="lead">{dateTime(report.event.start_at)}{report.event.location ? ` • ${report.event.location}` : ''}</p>}</div>
      <div className="admin-heading-actions">
        <Link className="btn secondary" to={`/admin/absensi?event=${id}`}><Plus size={16} /> Buka sesi absensi</Link>
        {openSessions[0] && <Link className="btn secondary" to={`/admin/absensi/${openSessions[0].id}/layar`}><MonitorPlay size={16} /> Layar QR</Link>}
        <button className="btn secondary" disabled={!report} onClick={() => report && run(() => downloadEventCsv(report))}><FileText size={16} /> CSV</button>
        <button className="btn" disabled={!report} onClick={() => report && run(() => downloadEventXlsx(report))}><Download size={16} /> Excel</button>
      </div></div>
    {error && <Notice error>{error}</Notice>}
    <div className="stat-grid">
      <StatCard icon="✓" label="Hadir" value={(counts.hadir ?? 0) + (counts.terlambat ?? 0)} note={`${counts.terlambat ?? 0} terlambat`} tone="ok" />
      <StatCard icon="✉" label="Izin / sakit" value={(counts.izin ?? 0) + (counts.sakit ?? 0)} />
      <StatCard icon="–" label="Alpa / belum hadir" value={(counts.alpa ?? 0) + (counts.belum_hadir ?? 0)} tone="warn" />
      <StatCard icon="%" label="Kehadiran" value={rate == null ? '-' : `${rate}%`} note={`${expected} peserta wajib`} />
    </div>

    {!!pending.length && <Panel title={`Pengajuan izin menunggu (${pending.length})`}>
      <div className="compact-list">{pending.map(leave => <div className="compact-row text-row leave-row" key={leave.id}>
        <div><strong>{leave.name} • {leave.type}</strong><small>{leave.reason}</small></div>
        <input className="note-input" placeholder="Catatan (opsional)" value={notes[leave.id] ?? ''} onChange={event => setNotes({ ...notes, [leave.id]: event.target.value })} />
        <button className="btn small" disabled={saving === leave.id} onClick={() => review(leave.id, 'disetujui')}><Check size={14} /> Setujui</button>
        <button className="btn small danger" disabled={saving === leave.id} onClick={() => review(leave.id, 'ditolak')}><X size={14} /> Tolak</button>
      </div>)}</div>
    </Panel>}

    <Panel title="Sesi absensi kegiatan ini">
      {!report ? <TableSkeleton rows={2} cols={3} /> : <div className="compact-list">{report.sessions.map(session => <div className="compact-row text-row" key={session.id}>
        <div><strong>{session.title}</strong><small>{dateTime(session.starts_at)} • {session.mode === 'rotating' ? 'QR berganti' : 'QR tetap / manual'} • {session.status}</small></div>
        <Link className="btn small secondary" to={`/admin/absensi/${session.id}`}>Rekap sesi</Link></div>)}
        {!report.sessions.length && <p className="muted">Belum ada sesi. Tekan "Buka sesi absensi" atau ubah status anggota secara manual di bawah.</p>}</div>}
    </Panel>

    <Panel title="Daftar peserta">
      <div className="permission-tabs">{FILTERS.map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'semua' ? 'Semua' : STATUS_LABEL[item]}{item !== 'semua' ? ` (${counts[item] ?? 0})` : ''}</button>)}</div>
      {!report ? <TableSkeleton rows={6} cols={4} /> : <div className="table-wrap"><table>
        <thead><tr><th>Anggota</th><th>Status</th><th>Waktu</th><th>Ubah</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.member_id}>
          <td><strong>{row.name}</strong><small>{[row.class_name, row.group_name].filter(Boolean).join(' • ') || '-'}</small></td>
          <td><span className={`status att-${row.status}`}>{STATUS_LABEL[row.status] ?? row.status}</span>{row.note && <small>{row.note}</small>}</td>
          <td>{row.checked_in_at ? dateTime(row.checked_in_at) : '-'}</td>
          <td><select disabled={saving === row.member_id} value={(STATUS_OPTIONS as readonly string[]).includes(row.status) ? row.status : ''} onChange={event => change(row.member_id, event.target.value)}>
            <option value="" disabled>Pilih</option>{STATUS_OPTIONS.map(option => <option key={option} value={option}>{STATUS_LABEL[option]}</option>)}</select></td>
        </tr>)}{!rows.length && <tr><td colSpan={4}>Tidak ada data.</td></tr>}</tbody></table></div>}
    </Panel>
  </div>
}
