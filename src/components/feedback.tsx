import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'

export function EmptyState({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return <div className="state-card"><span className="state-mark">{icon ?? <Inbox size={22} />}</span><strong>{title}</strong>{text && <p>{text}</p>}{action}</div>
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return <div className="state-card is-error" role="alert">
    <span className="state-mark"><TriangleAlert size={22} /></span>
    <strong>Data belum dapat dimuat</strong>
    <p>{message || 'Terjadi gangguan saat mengambil data. Coba lagi beberapa saat.'}</p>
    {onRetry && <button type="button" className="btn secondary" onClick={onRetry}><RefreshCw size={15} /> Coba lagi</button>}
  </div>
}

export function RouteProgress() {
  return <div className="route-progress" role="status" aria-label="Memuat halaman"><span /></div>
}

type BoundaryState = { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="section"><div className="wrap">
      <div className="state-card is-error" role="alert">
        <span className="state-mark"><TriangleAlert size={22} /></span>
        <strong>Halaman mengalami kendala</strong>
        <p>Terjadi kesalahan tak terduga. Muat ulang halaman atau kembali ke beranda.</p>
        <div className="actions" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>Muat ulang</button>
          <Link className="btn secondary" to="/" onClick={() => this.setState({ failed: false })}>Beranda</Link>
        </div>
      </div>
    </div></section>
  }
}

type ConfirmState = { message: string; resolve: (value: boolean) => void }

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const ask = useCallback((message: string) => new Promise<boolean>(resolve => setState({ message, resolve })), [])
  const settle = useCallback((value: boolean) => {
    setState(current => { current?.resolve(value); return null })
  }, [])

  useEffect(() => {
    if (!state) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') settle(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, settle])

  const dialog = state ? <div className="confirm-backdrop" role="presentation" onClick={() => settle(false)}>
    <div className="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" onClick={event => event.stopPropagation()}>
      <strong id="confirm-title">Hapus data ini?</strong>
      <p id="confirm-text">{state.message}</p>
      <div className="confirm-actions">
        <button type="button" className="btn secondary" autoFocus onClick={() => settle(false)}>Batal</button>
        <button type="button" className="btn danger" onClick={() => settle(true)}>Ya, hapus</button>
      </div>
    </div>
  </div> : null

  return { ask, dialog }
}
