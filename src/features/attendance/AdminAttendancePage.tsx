import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Copy, Download, MonitorPlay, Plus, Table2, XCircle } from 'lucide-react'
import { supabase, hasSupabase } from '../../lib/supabase'
import { errorText, rpc } from '../../lib/rpc'
import { useConfirm } from '../../components/feedback'
import { TableSkeleton } from '../../components/Skeleton'
import { Notice, Panel, dateTime, toLocalInput } from '../../components/mini'
import { sessionPhase } from './api'

type SessionRow = {
  id: string; title: string; starts_at: string; expires_at: string | null; status: string
  qr_mode: 'rotating' | 'static'; events: { title: string } | null; count: number
}
type StaticResult = { id: string; token: string; pin: string; qr: string }

export function AdminAttendancePage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { ask, dialog } = useConfirm()
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<StaticResult | null>(null)
  const [busy, setBusy] = useState(false)
  const start = new Date()
  const [form, setForm] = useState({
    title: '', eventId: search.get('event') ?? '', starts: toLocalInput(start), ends: toLocalInput(new Date(start.getTime() + 2 * 3600 * 1000)),
    mode: 'rotating', rotate: 30, late: 15, pin: '', max: '',
  })
  const set = (patch: Partial<typeof form>) => setForm(current => ({ ...current, ...patch }))

  const load = async () => {
    if (!supabase) return
    const [{ data: eventRows }, { data: sessionRows, error: sessionError }] = await Promise.all([
      supabase.from('events').select('id,title,start_at').eq('status', 'published').order('start_at', { ascending: false }).limit(50),
      supabase.from('attendance_sessions').select('id,title,starts_at,expires_at,status,qr_mode,events(title)').order('starts_at', { ascending: false }).limit(30),
    ])
    if (sessionError) setError(sessionError.message)
    const ids = (sessionRows ?? []).map(row => row.id)
    const counts = new Map<string, number>()
    if (ids.length) {
      const { data: records } = await supabase.from('attendance_records').select('session_id,status').in('session_id', ids).in('status', ['hadir', 'terlambat'])
      for (const record of records ?? []) counts.set(record.session_id, (counts.get(record.session_id) ?? 0) + 1)
    }
    const list = (eventRows ?? []) as Array<{ id: string; title: string; start_at?: string }>
    setEvents(list)
    setForm(current => {
      if (current.eventId && list.some(item => item.id === current.eventId)) return current.title ? current : { ...current, title: list.find(item => item.id === current.eventId)!.title }
      const nearest = [...list].sort((a, b) => Math.abs(new Date(a.start_at ?? 0).getTime() - Date.now()) - Math.abs(new Date(b.start_at ?? 0).getTime() - Date.now()))[0]
      return nearest ? { ...current, eventId: nearest.id, title: current.title || nearest.title } : current
    })
    setSessions((sessionRows ?? []).map((row: any) => ({ ...row, count: counts.get(row.id) ?? 0 })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setCreated(null)
    try {
      const data = await rpc<{ id: string; mode: string; token: string | null; pin: string | null }>('create_attendance_session_v2', {
        p_event_id: form.eventId,
        p_title: form.title,
        p_starts_at: new Date(form.starts).toISOString(),
        p_expires_at: form.ends ? new Date(form.ends).toISOString() : null,
        p_mode: form.mode,
        p_rotate_seconds: Number(form.rotate),
        p_late_after_minutes: Number(form.late),
        p_pin: form.mode === 'static' ? form.pin || null : null,
        p_max_checkins: form.max ? Number(form.max) : null,
      })
      if (data.mode === 'rotating') {
        navigate(`/admin/absensi/${data.id}/layar`)
        return
      }
      const url = `${window.location.origin}/absen/${data.token}`
      setCreated({ id: data.id, token: data.token ?? '', pin: data.pin ?? '', qr: await QRCode.toDataURL(url, { width: 520, margin: 2 }) })
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const close = async (row: SessionRow) => {
    if (!await ask(`Tutup sesi "${row.title}"? Anggota tidak bisa absen lagi.`)) return
    try { await rpc('close_attendance_session', { p_session_id: row.id }); await load() } catch (e) { setError(errorText(e)) }
  }

  if (!hasSupabase) return <div className="wrap page-pad"><Notice error>Supabase belum dikonfigurasi.</Notice></div>

  return <div className="wrap page-pad">{dialog}
    <Link className="back-link" to="/admin">← Admin</Link>
    <div className="admin-heading"><div><span className="eyebrow">Absensi</span><h1>QR Absensi</h1><p className="lead">QR berganti otomatis dan tidak bisa dibagikan lewat tangkapan layar. Cocok ditampilkan di layar atau proyektor saat latihan.</p></div>
      <div className="admin-heading-actions"><Link className="btn secondary" to="/admin/rekap">Rekap kegiatan</Link><Link className="btn secondary" to="/admin/izin">Pengajuan izin</Link></div></div>
    {error && <Notice error>{error}</Notice>}
    <div className="dashboard-grid">
      <Panel title="Buat sesi baru">
        <form className="admin-form" onSubmit={create}>
          <label className="field"><span>Judul sesi</span><input value={form.title} onChange={e => set({ title: e.target.value })} required minLength={3} maxLength={120} /></label>
          <label className="field"><span>Kegiatan</span><select value={form.eventId} onChange={e => set({ eventId: e.target.value, title: events.find(item => item.id === e.target.value)?.title ?? form.title })} required><option value="" disabled>Pilih kegiatan dari kalender</option>{events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <div className="form-row"><label className="field"><span>Mulai</span><input type="datetime-local" value={form.starts} onChange={e => set({ starts: e.target.value })} required /></label>
            <label className="field"><span>Berakhir</span><input type="datetime-local" value={form.ends} onChange={e => set({ ends: e.target.value })} /></label></div>
          <div className="segmented" role="radiogroup" aria-label="Mode QR">
            <button type="button" className={form.mode === 'rotating' ? 'on' : ''} onClick={() => set({ mode: 'rotating' })}>QR berganti (disarankan)</button>
            <button type="button" className={form.mode === 'static' ? 'on' : ''} onClick={() => set({ mode: 'static' })}>QR tetap + PIN</button>
          </div>
          <div className="form-row">
            <label className="field"><span>Terlambat setelah (menit)</span><input type="number" min={0} max={600} value={form.late} onChange={e => set({ late: Number(e.target.value) })} /></label>
            {form.mode === 'rotating'
              ? <label className="field"><span>Ganti QR tiap</span><select value={form.rotate} onChange={e => set({ rotate: Number(e.target.value) })}>{[20, 30, 45, 60].map(v => <option key={v} value={v}>{v} detik</option>)}</select></label>
              : <label className="field"><span>PIN (kosong = acak)</span><input inputMode="numeric" maxLength={8} value={form.pin} onChange={e => set({ pin: e.target.value.replace(/\D/g, '') })} /></label>}
          </div>
          <label className="field"><span>Batas peserta (opsional)</span><input type="number" min={1} value={form.max} onChange={e => set({ max: e.target.value })} /></label>
          <button className="btn" disabled={busy || !form.eventId}><Plus size={16} /> {busy ? 'Membuat…' : 'Buat sesi'}</button>
        </form>
      </Panel>
      {created && <Panel title="QR tetap siap dipakai">
        <div className="static-qr"><img src={created.qr} alt="QR absensi" />
          <p>PIN: <strong className="pin-big">{created.pin}</strong></p>
          <small className="muted">PIN hanya tampil sekali. Catat sebelum menutup halaman ini.</small>
          <div className="admin-heading-actions">
            <a className="btn secondary" href={created.qr} download="qr-absensi.png"><Download size={16} /> Unduh QR</a>
            <button className="btn secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/absen/${created.token}`)}><Copy size={16} /> Salin tautan</button>
          </div>
        </div>
      </Panel>}
    </div>
    <Panel title="Sesi terbaru">
      {loading ? <TableSkeleton rows={4} cols={5} /> : <div className="table-wrap"><table>
        <thead><tr><th>Sesi</th><th>Waktu</th><th>Mode</th><th>Hadir</th><th>Status</th><th></th></tr></thead>
        <tbody>{sessions.map(row => {
          const phase = sessionPhase(row)
          return <tr key={row.id}>
            <td><strong>{row.title}</strong><small>{row.events?.title ?? 'Tanpa kegiatan'}</small></td>
            <td>{dateTime(row.starts_at)}</td>
            <td>{row.qr_mode === 'rotating' ? 'QR berganti' : 'QR tetap'}</td>
            <td>{row.count}</td>
            <td><span className={`status ${phase === 'berlangsung' ? 'active' : phase === 'terjadwal' ? 'pending' : 'closed'}`}>{phase}</span></td>
            <td className="row-actions">
              {row.qr_mode === 'rotating' && phase === 'berlangsung' && <Link className="btn small" to={`/admin/absensi/${row.id}/layar`}><MonitorPlay size={14} /> Layar</Link>}
              <Link className="btn small secondary" to={`/admin/absensi/${row.id}`}><Table2 size={14} /> Rekap</Link>
              {phase !== 'selesai' && <button className="btn small danger" onClick={() => close(row)}><XCircle size={14} /> Tutup</button>}
            </td></tr>
        })}{!sessions.length && <tr><td colSpan={6}>Belum ada sesi.</td></tr>}</tbody></table></div>}
    </Panel>
  </div>
}
