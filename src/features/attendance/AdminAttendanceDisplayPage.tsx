import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Maximize2, Table2, Users } from 'lucide-react'
import { errorText, rpc } from '../../lib/rpc'
import { Notice } from '../../components/mini'
import { STATUS_LABEL, type Report } from './api'
import { useRotatingQr } from './useRotatingQr'

export function AdminAttendanceDisplayPage() {
  const { id = '' } = useParams()
  const { current, secondsLeft, fraction, rotate, error } = useRotatingQr(id)
  const [qr, setQr] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    if (!current) return
    let cancelled = false
    QRCode.toDataURL(`${window.location.origin}/absen/${id}?c=${current.code}`, { width: 640, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => { if (!cancelled) setQr(url) })
    return () => { cancelled = true }
  }, [current?.code, id])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try { const data = await rpc<Report>('attendance_session_report', { p_session_id: id }); if (alive) setReport(data) }
      catch (e) { if (alive) setReportError(errorText(e)) }
    }
    tick()
    const timer = setInterval(tick, 6000)
    return () => { alive = false; clearInterval(timer) }
  }, [id])

  const rows = report?.rows ?? []
  const present = rows.filter(row => row.status === 'hadir' || row.status === 'terlambat')
  const late = rows.filter(row => row.status === 'terlambat').length
  const recent = [...present].sort((a, b) => (b.checked_in_at ?? '').localeCompare(a.checked_in_at ?? '')).slice(0, 6)
  const manual = current ? `${current.manual.slice(0, 3)} ${current.manual.slice(3)}` : '--- ---'

  return <div className="qr-stage">
    <div className="qr-stage-top">
      <Link className="back-link" to="/admin/absensi">← Sesi</Link>
      <strong>{report?.session.title ?? 'Absensi'}</strong>
      <div className="admin-heading-actions">
        <Link className="btn small secondary" to={`/admin/absensi/${id}`}><Table2 size={14} /> Rekap</Link>
        <button className="btn small" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14} /> Layar penuh</button>
      </div>
    </div>
    {(error || reportError) && <Notice error>{error || reportError}</Notice>}
    <div className="qr-stage-body">
      <div className="qr-box">
        {qr ? <img src={qr} alt="QR absensi berganti" /> : <div className="qr-placeholder">Menyiapkan QR…</div>}
        <div className="qr-timer"><span style={{ width: `${fraction * 100}%` }} /></div>
        <small>Berganti tiap {rotate} detik • {secondsLeft} dtk lagi</small>
      </div>
      <div className="qr-side">
        <p className="eyebrow">Tidak bisa scan?</p>
        <p className="muted">Buka kiwantika → Absen dengan kode, lalu masukkan:</p>
        <div className="manual-code" aria-live="off">{manual}</div>
        <div className="qr-counter"><Users size={20} /><strong>{present.length}</strong><span>hadir{late ? ` • ${late} terlambat` : ''} dari {rows.length}</span></div>
        <ul className="qr-recent">{recent.map(row => <li key={row.member_id}><span>{row.name}</span><em>{STATUS_LABEL[row.status]}</em></li>)}{!recent.length && <li className="muted">Belum ada yang absen.</li>}</ul>
      </div>
    </div>
  </div>
}
