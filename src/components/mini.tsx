import type { ReactNode } from 'react'
import { CheckCircle2, ShieldAlert } from 'lucide-react'

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? 'error' : ''}`}>{error ? <ShieldAlert size={17} /> : <CheckCircle2 size={17} />}<span>{children}</span></div>
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action}</div>{children}</section>
}

export function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: ReactNode; note?: string; tone?: 'warn' | 'ok' }) {
  return <article className={`stat-card ${tone ? `tone-${tone}` : ''}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>
}

export const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
export const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
export const dateOnly = (value?: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'
export const toLocalInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export const todayLocal = () => toLocalInput(new Date()).slice(0, 10)
