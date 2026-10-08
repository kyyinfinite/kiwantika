import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, KeyRound, ShieldAlert } from 'lucide-react'
import { hasSupabase } from '../../lib/supabase'
import { errorText, rpc } from '../../lib/rpc'
import { useAuth } from '../auth/AuthProvider'
import { AttendanceSkeleton } from '../../components/Skeleton'
import { Notice, dateTime } from '../../components/mini'
import { STATUS_LABEL, checkInMessage, type CheckInResult, type SessionInfo } from './api'

function Shell({ children }: { children: ReactNode }) {
  return <div className="mobile-attendance"><div className="attendance-card">
    <div className="attendance-brand"><span className="brand-mark">K</span><span><strong>KIWANTIKA</strong><small>ABSENSI DIGITAL</small></span></div>
    {children}
  </div></div>
}

export function AttendancePage() {
  const { ref = '' } = useParams()
  const [search] = useSearchParams()
  const location = useLocation()
  const code = search.get('c') ?? ''
  const { user, loading: authLoading } = useAuth()
  const [info, setInfo] = useState<SessionInfo | null>(null)
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const auto = useRef(false)

  const submit = async (pinValue?: string) => {
    setBusy(true)
    setError('')
    try {
      setResult(await rpc<CheckInResult>('check_in_attendance_v2', { p_ref: ref, p_code: code || null, p_pin: pinValue || null }))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!user || !hasSupabase) return
    let cancelled = false
    rpc<SessionInfo>('get_attendance_session_v2', { p_ref: ref, p_code: code || null })
      .then(data => { if (!cancelled) setInfo(data) })
      .catch(e => { if (!cancelled) setError(errorText(e)) })
    return () => { cancelled = true }
  }, [user, ref, code])

  useEffect(() => {
    if (info?.ok && info.mode === 'rotating' && info.code_valid && !auto.current) {
      auto.current = true
      submit()
    }
  }, [info])

  if (authLoading) return <Shell><AttendanceSkeleton /></Shell>
  if (!hasSupabase) return <Shell><Notice error>Supabase belum dikonfigurasi.</Notice></Shell>
  if (!user) return <Navigate to={`/masuk?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
  if (!info && !error) return <Shell><AttendanceSkeleton /></Shell>

  if (result?.ok) {
    const late = result.status === 'terlambat'
    return <Shell>
      <div className={`attendance-result ${late ? 'late' : 'ok'}`}>
        {late ? <Clock3 size={44} /> : <CheckCircle2 size={44} />}
        <h1>{result.already_checked_in ? 'Sudah tercatat' : late ? 'Tercatat terlambat' : 'Absensi berhasil'}</h1>
        <p>{result.member_name} • {STATUS_LABEL[result.status ?? 'hadir']}</p>
        <small>{result.session_title} • {dateTime(result.checked_in_at)}</small>
      </div>
      <Link className="btn secondary full" to="/dashboard">Ke dashboard</Link>
    </Shell>
  }

  if (!info?.ok) {
    const failure = checkInMessage({ ok: false, code: info?.code })
    return <Shell><span className="eyebrow">Absensi</span><h1>Sesi tidak tersedia</h1><p className="muted">{failure}</p>{error && <Notice error>{error}</Notice>}<Link className="btn secondary full" to="/absen">Absen dengan kode</Link></Shell>
  }

  if (info.mode === 'rotating') {
    return <Shell>
      <span className="eyebrow">Absensi kegiatan</span><h1>{info.event_title || info.title}</h1><p>{info.title}</p>
      {result && !result.ok && <Notice error>{checkInMessage(result)}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {!info.code_valid && !result && <Notice error>QR ini sudah kedaluwarsa. Pindai ulang QR yang sedang tampil di layar, atau masukkan kode 6 angka.</Notice>}
      {busy && <p className="muted">Memverifikasi…</p>}
      <div className="attendance-actions">
        {info.code_valid && <button className="btn full" disabled={busy} onClick={() => submit()}>Konfirmasi kehadiran</button>}
        <Link className="btn secondary full" to="/absen"><KeyRound size={16} /> Masukkan kode manual</Link>
      </div>
    </Shell>
  }

  return <Shell>
    <span className="eyebrow">Absensi kegiatan</span><h1>{info.event_title || info.title}</h1><p>{info.title}</p>
    <p className="muted"><Clock3 size={14} /> {dateTime(info.starts_at)}</p>
    {result && !result.ok && <Notice error>{checkInMessage(result)}</Notice>}
    {error && <Notice error>{error}</Notice>}
    <form className="auth-form" onSubmit={(event: FormEvent) => { event.preventDefault(); submit(pin) }}>
      <label className="field"><span>PIN absensi</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} placeholder="Masukkan PIN dari pembina" /></label>
      <button className="btn full" disabled={busy || pin.length < 4}>{busy ? 'Memproses…' : 'Absen sekarang'}</button>
    </form>
    <small className="muted"><ShieldAlert size={13} /> Lima PIN salah akan mengunci absensi selama 10 menit.</small>
  </Shell>
}
