import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, Panel, dateOnly, dateTime } from '../../components/mini'
import { TableSkeleton } from '../../components/Skeleton'

type LeaveEvent = { id: string; title: string; start_at: string; end_at: string | null; location: string | null; event_type: string; leave_status: string | null }
type LeaveRow = {
  id: string; leave_date: string; type: 'izin' | 'sakit'; reason: string; status: string
  review_note: string | null; created_at: string; event_id: string | null
  event?: { id: string; title: string; start_at: string } | null
  member?: { full_name: string; display_name: string | null; class_name: string | null } | null
}
type Result = { ok: boolean; code?: string }

const RESULT_TEXT: Record<string, string> = {
  invalid_input: 'Pilih kegiatan dan tulis alasan 5 sampai 500 karakter.',
  invalid_event: 'Kegiatan tidak ditemukan atau belum dipublikasikan.',
  event_passed: 'Kegiatan ini sudah lewat, pengajuan tidak bisa dibuat.',
  duplicate: 'Kamu sudah mengajukan untuk kegiatan ini.',
  not_eligible: 'Akunmu belum berstatus aktif.',
  not_authenticated: 'Silakan masuk terlebih dahulu.',
}
const STATUS_CLASS: Record<string, string> = { menunggu: 'pending', disetujui: 'approved', ditolak: 'rejected', dibatalkan: 'closed' }
const EVENT_EMBED = 'event:events!event_id(id,title,start_at)'

export function LeavePage() {
  const [search] = useSearchParams()
  const [events, setEvents] = useState<LeaveEvent[] | null>(null)
  const [rows, setRows] = useState<LeaveRow[] | null>(null)
  const [form, setForm] = useState({ type: 'izin', eventId: search.get('event') ?? '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!supabase) return
    const [list, history] = await Promise.all([
      rpc<LeaveEvent[]>('list_leave_events').catch(e => { setError(errorText(e)); return [] as LeaveEvent[] }),
      supabase.from('leave_requests').select(`id,leave_date,type,reason,status,review_note,created_at,event_id,${EVENT_EMBED}`).order('created_at', { ascending: false }).limit(30),
    ])
    setEvents(list)
    if (history.error) setError(history.error.message)
    setRows((history.data ?? []) as unknown as LeaveRow[])
  }
  useEffect(() => { load() }, [])

  const selected = events?.find(item => item.id === form.eventId) ?? null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await rpc<Result>('submit_leave_request_v2', { p_type: form.type, p_event_id: form.eventId || null, p_reason: form.reason })
      if (result.ok) { setMessage('Pengajuan terkirim. Pembina akan meninjau dan kamu dapat notifikasi.'); setForm(current => ({ ...current, reason: '', eventId: '' })); await load() }
      else setError(RESULT_TEXT[result.code ?? ''] ?? 'Pengajuan gagal.')
    } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }

  const cancel = async (id: string) => {
    try { await rpc('cancel_leave_request', { p_id: id }); await load() } catch (e) { setError(errorText(e)) }
  }

  return <div className="wrap page-pad member-page">
    <Link className="back-link" to="/dashboard">← Dashboard</Link>
    <div className="admin-heading"><div><span className="eyebrow">Absensi</span><h1>Izin & sakit</h1><p className="lead">Pilih kegiatan yang tidak bisa kamu ikuti. Jika disetujui, namamu otomatis tercatat izin atau sakit di rekap kegiatan itu.</p></div>
      <div className="admin-heading-actions"><Link className="btn secondary" to="/dashboard/absensi">Riwayat kehadiran</Link></div></div>
    {error && <Notice error>{error}</Notice>}
    {message && <Notice>{message}</Notice>}
    <div className="dashboard-grid">
      <Panel title="Buat pengajuan">
        <form className="admin-form" onSubmit={submit}>
          <div className="segmented">
            <button type="button" className={form.type === 'izin' ? 'on' : ''} onClick={() => setForm({ ...form, type: 'izin' })}>Izin</button>
            <button type="button" className={form.type === 'sakit' ? 'on' : ''} onClick={() => setForm({ ...form, type: 'sakit' })}>Sakit</button>
          </div>
          <label className="field"><span>Kegiatan</span>
            <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} required disabled={!events}>
              <option value="">{events ? 'Pilih kegiatan' : 'Memuat…'}</option>
              {(events ?? []).map(item => <option key={item.id} value={item.id} disabled={!!item.leave_status}>
                {dateOnly(item.start_at)} • {item.title}{item.leave_status ? ` (${item.leave_status})` : ''}</option>)}
            </select></label>
          {selected && <p className="muted">{dateTime(selected.start_at)}{selected.location ? ` • ${selected.location}` : ''}</p>}
          {events && !events.length && <p className="muted">Belum ada kegiatan terjadwal yang bisa diajukan izin.</p>}
          <label className="field"><span>Alasan</span><textarea rows={4} minLength={5} maxLength={500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Jelaskan singkat dan jelas" required /></label>
          <button className="btn" disabled={busy || !form.eventId || form.reason.trim().length < 5}>{busy ? 'Mengirim…' : 'Kirim pengajuan'}</button>
        </form>
      </Panel>
      <Panel title="Riwayat pengajuan">
        {!rows ? <TableSkeleton rows={3} cols={3} /> : <div className="compact-list">{rows.map(row => <div className="compact-row text-row" key={row.id}>
          <div><strong>{row.type === 'izin' ? 'Izin' : 'Sakit'} • {row.event?.title ?? dateOnly(row.leave_date)}</strong>
            <small>{row.event ? dateOnly(row.event.start_at) + ' • ' : ''}{row.reason}</small>{row.review_note && <small>Catatan pembina: {row.review_note}</small>}</div>
          <span className={`status ${STATUS_CLASS[row.status] ?? ''}`}>{row.status}</span>
          {row.status === 'menunggu' && <button className="btn small secondary" onClick={() => cancel(row.id)}>Batalkan</button>}
        </div>)}{!rows.length && <p className="muted">Belum ada pengajuan.</p>}</div>}
      </Panel>
    </div>
  </div>
}

const TABS = ['menunggu', 'disetujui', 'ditolak', 'semua'] as const

export function AdminLeavePage() {
  const [rows, setRows] = useState<LeaveRow[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('menunggu')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    if (!supabase) return
    let query = supabase.from('leave_requests')
      .select(`id,leave_date,type,reason,status,review_note,created_at,event_id,${EVENT_EMBED},member:profiles!member_id(full_name,display_name,class_name)`)
    if (tab !== 'semua') query = query.eq('status', tab)
    const { data, error: loadError } = await query.order('created_at', { ascending: false }).limit(100)
    if (loadError) setError(loadError.message)
    setRows((data ?? []) as unknown as LeaveRow[])
  }
  useEffect(() => { setRows(null); load() }, [tab])

  const review = async (id: string, decision: 'disetujui' | 'ditolak') => {
    setBusy(id); setError('')
    try {
      const result = await rpc<Result>('review_leave_request', { p_id: id, p_decision: decision, p_note: notes[id] || null })
      if (!result.ok) setError('Pengajuan ini sudah diproses.')
      await load()
    } catch (e) { setError(errorText(e)) } finally { setBusy('') }
  }

  return <div className="wrap page-pad">
    <Link className="back-link" to="/admin">← Admin</Link>
    <div className="admin-heading"><div><span className="eyebrow">Absensi</span><h1>Pengajuan izin & sakit</h1><p className="lead">Setiap pengajuan terkait satu kegiatan. Persetujuan otomatis mengubah status anggota di rekap kegiatan itu.</p></div>
      <div className="admin-heading-actions"><Link className="btn secondary" to="/admin/rekap">Rekap kegiatan</Link></div></div>
    {error && <Notice error>{error}</Notice>}
    <Panel title="Daftar pengajuan">
      <div className="permission-tabs">{TABS.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      {!rows ? <TableSkeleton rows={4} cols={4} /> : <div className="table-wrap"><table>
        <thead><tr><th>Anggota</th><th>Kegiatan</th><th>Alasan</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.member?.display_name || row.member?.full_name || '-'}</strong><small>{row.member?.class_name ?? ''}</small></td>
          <td>{row.event ? <Link to={`/admin/rekap/${row.event.id}`}><strong>{row.event.title}</strong></Link> : dateOnly(row.leave_date)}<small>{row.type} • diajukan {dateTime(row.created_at)}</small></td>
          <td>{row.reason}{row.review_note && <small>Catatan: {row.review_note}</small>}</td>
          <td><span className={`status ${STATUS_CLASS[row.status] ?? ''}`}>{row.status}</span></td>
          <td className="row-actions">{row.status === 'menunggu' && <>
            <input className="note-input" placeholder="Catatan (opsional)" value={notes[row.id] ?? ''} onChange={e => setNotes({ ...notes, [row.id]: e.target.value })} />
            <button className="btn small" disabled={busy === row.id} onClick={() => review(row.id, 'disetujui')}><Check size={14} /> Setujui</button>
            <button className="btn small danger" disabled={busy === row.id} onClick={() => review(row.id, 'ditolak')}><X size={14} /> Tolak</button></>}</td>
        </tr>)}{!rows.length && <tr><td colSpan={5}>Tidak ada pengajuan.</td></tr>}</tbody></table></div>}
    </Panel>
  </div>
}
