import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ClipboardCheck, FileCheck2, MailQuestion, UserCheck, UserPlus, Wallet } from 'lucide-react'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, StatCard, dateTime, rupiah } from '../../components/mini'
import { StatGridSkeleton } from '../../components/Skeleton'

type Overview = {
  members: { total: number; active: number; candidate: number; inactive: number; alumni: number; suspended: number }
  registrations_pending: number
  upcoming: Array<{ id: string; title: string; start_at: string; leave_pending: number; leave_approved: number; has_session: boolean }> | null
  attendance: { open_sessions: number; sessions_30d: number; present_30d: number; late_30d: number; leave_pending: number; leave_today: number } | null
  finance: { balance: number; income_month: number; expense_month: number; dues_paid: number; dues_unpaid: number } | null
  recent_audit: Array<{ id: string; action: string; entity_type: string; created_at: string; actor: string | null }>
}

const ACTION_LABEL: Record<string, string> = {
  'attendance.session_created': 'Membuat sesi absensi', 'attendance.session_closed': 'Menutup sesi absensi',
  'attendance.status_set': 'Mengubah status absensi', 'attendance.event_status_set': 'Mengubah kehadiran kegiatan', 'leave.reviewed': 'Memproses pengajuan izin',
  'finance.dues_generated': 'Membuat tagihan iuran', 'finance.due_paid': 'Menandai iuran lunas', 'finance.due_unpaid': 'Membatalkan iuran lunas',
}

export function OperationsOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { rpc<Overview>('admin_overview').then(setData).catch(e => setError(errorText(e))) }, [])

  if (error) return <Notice error>{error}. Jalankan migrasi 0009 bila belum.</Notice>
  if (!data) return <StatGridSkeleton />

  const attendance = data.attendance
  const expected = attendance ? attendance.sessions_30d * data.members.active : 0
  const rate = attendance && expected ? Math.round((attendance.present_30d / expected) * 100) : null
  const todo = [
    { to: '/admin/formulir', label: 'Pendaftaran menunggu ditinjau', value: data.registrations_pending },
    { to: '/admin/izin', label: 'Pengajuan izin / sakit menunggu', value: attendance?.leave_pending ?? 0 },
    { to: '/admin/kas', label: 'Iuran bulan ini belum lunas', value: data.finance?.dues_unpaid ?? 0 },
  ].filter(item => item.value > 0)

  return <>
    <div className="stat-grid">
      <StatCard icon={<UserCheck />} label="Anggota aktif" value={data.members.active} note={`${data.members.candidate} calon anggota`} />
      <StatCard icon={<UserPlus />} label="Pendaftaran baru" value={data.registrations_pending} note="menunggu tinjauan" tone={data.registrations_pending ? 'warn' : undefined} />
      {attendance && <StatCard icon={<CalendarCheck />} label="Kehadiran 30 hari" value={rate == null ? '-' : `${rate}%`} note={`${attendance.sessions_30d} sesi • ${attendance.late_30d} terlambat`} />}
      {attendance && <StatCard icon={<MailQuestion />} label="Izin menunggu" value={attendance.leave_pending} note={`${attendance.leave_today} izin hari ini`} tone={attendance.leave_pending ? 'warn' : undefined} />}
      {data.finance && <StatCard icon={<Wallet />} label="Saldo kas" value={rupiah(data.finance.balance)} note={`+${rupiah(data.finance.income_month)} / −${rupiah(data.finance.expense_month)} bulan ini`} tone="ok" />}
      {data.finance && <StatCard icon={<ClipboardCheck />} label="Iuran bulan ini" value={`${data.finance.dues_paid}/${data.finance.dues_paid + data.finance.dues_unpaid}`} note="lunas" />}
    </div>
    <div className="dashboard-grid">
      <Panel title="Perlu tindakan">
        {todo.length ? <div className="admin-links">{todo.map(item => <Link key={item.to} to={item.to}><FileCheck2 /> {item.label} <span className="admin-link-badge">{item.value}</span></Link>)}</div> : <p className="muted">Tidak ada yang menunggu. Semua sudah beres.</p>}
        {!!attendance?.open_sessions && <p className="muted">{attendance.open_sessions} sesi absensi sedang berlangsung. <Link to="/admin/absensi">Buka</Link></p>}
      </Panel>
      {!!data.upcoming && <Panel title="Kegiatan terdekat" action={<Link className="text-link" to="/admin/rekap">Rekap</Link>}>
        <div className="compact-list">{data.upcoming.map(item => <div className="compact-row text-row" key={item.id}>
          <div><strong>{item.title}</strong><small>{dateTime(item.start_at)} • {item.leave_approved} izin disetujui{item.leave_pending ? `, ${item.leave_pending} menunggu` : ''}</small></div>
          <Link className="btn small secondary" to={item.has_session ? `/admin/rekap/${item.id}` : `/admin/absensi?event=${item.id}`}>{item.has_session ? 'Kelola' : 'Buka absensi'}</Link></div>)}
          {!data.upcoming.length && <p className="muted">Belum ada kegiatan terjadwal.</p>}</div>
      </Panel>}
      <Panel title="Aktivitas pengelola terbaru">
        <div className="compact-list">{data.recent_audit.map(item => <div className="compact-row text-row" key={item.id}>
          <div><strong>{ACTION_LABEL[item.action] ?? item.action}</strong><small>{item.actor ?? 'Sistem'} • {dateTime(item.created_at)}</small></div></div>)}
          {!data.recent_audit.length && <p className="muted">Belum ada aktivitas tercatat.</p>}</div>
      </Panel>
    </div>
  </>
}
