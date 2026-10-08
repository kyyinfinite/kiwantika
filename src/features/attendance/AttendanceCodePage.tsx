import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { errorText, rpc } from '../../lib/rpc'
import { Notice, dateTime } from '../../components/mini'
import { STATUS_LABEL, checkInMessage, type CheckInResult } from './api'

type OpenSession = { id: string; title: string; starts_at: string; expires_at: string | null }

export function AttendanceCodePage() {
  const [sessions, setSessions] = useState<OpenSession[] | null>(null)
  const [selected, setSelected] = useState('')
  const [digits, setDigits] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    rpc<OpenSession[]>('list_open_attendance_sessions')
      .then(list => { setSessions(list); if (list.length === 1) setSelected(list[0].id) })
      .catch(e => { setError(errorText(e)); setSessions([]) })
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setResult(await rpc<CheckInResult>('check_in_attendance_v2', { p_ref: selected, p_code: digits, p_pin: null }))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return <div className="mobile-attendance"><div className="attendance-card">
    <div className="attendance-brand"><span className="brand-mark">K</span><span><strong>KIWANTIKA</strong><small>ABSENSI DIGITAL</small></span></div>
    {result?.ok ? <div className="attendance-result ok"><CheckCircle2 size={44} /><h1>Absensi berhasil</h1><p>{result.member_name} • {STATUS_LABEL[result.status ?? 'hadir']}</p><small>{result.session_title}</small><Link className="btn secondary full" to="/dashboard">Ke dashboard</Link></div> : <>
      <span className="eyebrow">Absen dengan kode</span><h1>Masukkan kode 6 angka</h1>
      <p className="muted">Kode tampil di layar pembina dan berganti tiap beberapa detik.</p>
      {result && !result.ok && <Notice error>{checkInMessage(result)}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {sessions && !sessions.length && <Notice error>Belum ada sesi absensi yang sedang berlangsung.</Notice>}
      {!!sessions?.length && <form className="auth-form" onSubmit={submit}>
        <label className="field"><span>Sesi</span><select value={selected} onChange={event => setSelected(event.target.value)} required>
          <option value="">Pilih sesi</option>
          {sessions.map(item => <option key={item.id} value={item.id}>{item.title} • {dateTime(item.starts_at)}</option>)}
        </select></label>
        <label className="field"><span>Kode</span><input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={digits} onChange={event => setDigits(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>
        <button className="btn full" disabled={busy || !selected || digits.length !== 6}>{busy ? 'Memproses…' : 'Absen sekarang'}</button>
      </form>}
    </>}
  </div></div>
}
