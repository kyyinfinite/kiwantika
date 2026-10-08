import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, StatCard, dateTime } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'
import { downloadEventCsvFromMaster, downloadEventXlsxFromMaster, downloadMasterCsv, downloadMasterXlsx } from './download'
import { percentage, type MasterReport } from './exportData'

type PlainEvent = { id: string; title: string; start_at: string; event_type: string }

const isoDay = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

export function AdminEventRecapListPage() {
  const [from, setFrom] = useState(isoDay(-90))
  const [to, setTo] = useState(isoDay(30))
  const [master, setMaster] = useState<MasterReport | null>(null)
  const [untracked, setUntracked] = useState<PlainEvent[]>([])
  const [perSheet, setPerSheet] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await rpc<MasterReport>('attendance_master_report', { p_from: from, p_to: to })
      setMaster(data)
      if (supabase) {
        const { data: events } = await supabase.from('events').select('id,title,start_at,event_type').eq('status', 'published')
          .gte('start_at', `${from}T00:00:00+07:00`).lte('start_at', `${to}T23:59:59+07:00`).order('start_at', { ascending: false }).limit(100)
        const tracked = new Set(data.events.map(event => event.id))
        setUntracked(((events ?? []) as PlainEvent[]).filter(event => !tracked.has(event.id)))
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    if (!master) return { events: 0, avg: null as number | null, present: 0 }
    const present = master.events.reduce((sum, event) => sum + event.hadir + event.terlambat, 0)
    const expected = master.events.reduce((sum, event) => sum + event.expected - event.belum, 0)
    const excused = master.events.reduce((sum, event) => sum + event.izin + event.sakit, 0)
    return { events: master.events.length, avg: percentage(present, expected, excused), present }
  }, [master])

  const run = async (task: () => Promise<void> | void) => {
    try { await task() } catch (e) { setError(errorText(e)) }
  }

  return <div className="wrap page-pad">
    <Link className="back-link" to="/admin">← Admin</Link>
    <div className="admin-heading"><div><span className="eyebrow">Rekap</span><h1>Rekap kehadiran per kegiatan</h1>
      <p className="lead">Setiap kegiatan punya daftar hadir, izin, dan sakit sendiri. Semuanya digabung otomatis dalam satu file Excel utuh yang bertambah seiring kegiatan.</p></div></div>
    {error && <Notice error>{error}</Notice>}
    <div className="stat-grid">
      <StatCard icon="▦" label="Kegiatan tercatat" value={stats.events} />
      <StatCard icon="✓" label="Total kehadiran" value={stats.present} />
      <StatCard icon="%" label="Rata-rata kehadiran" value={stats.avg == null ? '-' : `${stats.avg}%`} note="izin dan sakit tidak dihitung" tone="ok" />
    </div>
    <Panel title="Rentang tanggal" action={<div className="admin-heading-actions">
      <button className="btn small secondary" disabled={!master?.events.length} onClick={() => master && run(() => downloadMasterCsv(master))}><FileText size={14} /> CSV detail</button>
      <button className="btn small" disabled={!master?.events.length} onClick={() => master && run(() => downloadMasterXlsx(master, perSheet))}><FileSpreadsheet size={14} /> Excel utuh</button>
    </div>}>
      <div className="form-row">
        <label className="field"><span>Dari</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label className="field"><span>Sampai</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
      </div>
      <div className="admin-heading-actions">
        <button className="btn secondary" onClick={load} disabled={busy}>{busy ? 'Memuat…' : 'Muat rekap'}</button>
        <label className="check-inline"><input type="checkbox" checked={perSheet} onChange={event => setPerSheet(event.target.checked)} /> Sheet terpisah tiap kegiatan di Excel utuh</label>
      </div>
      <p className="muted small-note">Excel utuh berisi: Ringkasan Kegiatan (siapa saja yang hadir), Rekap Anggota, Matriks kehadiran, Detail, dan satu sheet per kegiatan. CSV memakai pemisah titik koma agar langsung rapi di Excel Indonesia.</p>
    </Panel>
    <Panel title="Daftar kegiatan">
      {!master ? <TableSkeleton rows={5} cols={6} /> : <div className="table-wrap"><table>
        <thead><tr><th>Kegiatan</th><th>Hadir</th><th>Terlambat</th><th>Izin / sakit</th><th>Alpa</th><th>%</th><th></th></tr></thead>
        <tbody>{[...master.events].reverse().map(event => <tr key={event.id}>
          <td><Link to={`/admin/rekap/${event.id}`}><strong>{event.title}</strong></Link><small>{dateTime(event.start_at)} • {event.expected} peserta wajib</small></td>
          <td>{event.hadir}</td><td>{event.terlambat}</td><td>{event.izin + event.sakit}</td><td>{event.alpa}</td>
          <td>{percentage(event.hadir + event.terlambat, event.expected - event.belum, event.izin + event.sakit) ?? '-'}</td>
          <td className="row-actions">
            <button className="btn small secondary" onClick={() => run(() => downloadEventXlsxFromMaster(master, event))}><Download size={13} /> Excel</button>
            <button className="btn small secondary" onClick={() => run(() => downloadEventCsvFromMaster(master, event))}>CSV</button>
          </td></tr>)}
          {!master.events.length && <tr><td colSpan={7}>Belum ada kegiatan dengan absensi pada rentang ini.</td></tr>}</tbody></table></div>}
    </Panel>
    {!!untracked.length && <Panel title="Kegiatan belum punya absensi">
      <div className="compact-list">{untracked.map(event => <div className="compact-row text-row" key={event.id}>
        <div><strong>{event.title}</strong><small>{dateTime(event.start_at)} • {event.event_type}</small></div>
        <Link className="btn small" to={`/admin/absensi?event=${event.id}`}><CalendarPlus size={14} /> Buka absensi</Link></div>)}</div>
    </Panel>}
  </div>
}
