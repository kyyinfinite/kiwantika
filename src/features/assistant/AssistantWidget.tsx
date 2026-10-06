import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RotateCcw, SendHorizontal, Sparkles, Square, X } from 'lucide-react'
import './assistant.css'
import { gsap, prefersReducedMotion } from '../../lib/motion'

type Msg = { id: string; role: 'user' | 'assistant'; content: string; error?: string }
type ListBlock = { ordered: boolean; items: string[] }

const STORAGE_KEY = 'tunas:chat:v1'
const MAX_INPUT = 500
const HIDDEN_PREFIXES = ['/absen', '/admin']
const SUGGESTIONS = [
  'Bagaimana cara mendaftar ke KIWANTIKA?',
  'Kapan kegiatan terdekat?',
  'Ada berita terbaru apa?',
  'Apa isi Dasa Darma?',
]

const tokenPattern = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|(?<![\w/])\/(?:tentang|berita(?:\/[\w-]+)?|kalender|galeri|daftarkiwantika|masuk)(?![\w/-]))/g
const internalPattern = /^\/(?:tentang|berita(?:\/[\w-]+)?|kalender|galeri|daftarkiwantika|masuk)$/

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function readStored(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Msg[]
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.content === 'string' && (item.role === 'user' || item.role === 'assistant')).slice(-20) : []
  } catch {
    return []
  }
}

function Inline({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const parts = text.split(tokenPattern)
  return <>{parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('[')) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (!match) return <Fragment key={index}>{part}</Fragment>
      const [, label, href] = match
      if (internalPattern.test(href)) return <Link key={index} to={href} onClick={onNavigate}>{label}</Link>
      if (/^https:\/\//.test(href)) return <a key={index} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
      return <Fragment key={index}>{label}</Fragment>
    }
    if (internalPattern.test(part)) return <Link key={index} to={part} onClick={onNavigate}>{part}</Link>
    return <Fragment key={index}>{part}</Fragment>
  })}</>
}

function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks: ReactNode[] = []
  const state: { paragraph: string[]; list: ListBlock | null } = { paragraph: [], list: null }

  const flushParagraph = () => {
    if (!state.paragraph.length) return
    const lines = state.paragraph
    blocks.push(<p key={blocks.length}>{lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}<Inline text={line} onNavigate={onNavigate} /></Fragment>)}</p>)
    state.paragraph = []
  }

  const flushList = () => {
    const list = state.list
    if (!list) return
    const items = list.items.map((item, index) => <li key={index}><Inline text={item} onNavigate={onNavigate} /></li>)
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>)
    state.list = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const match = line.match(/^\s*([-*•]|\d+[.)])\s+(.+)$/)
    if (match) {
      flushParagraph()
      const ordered = /\d/.test(match[1])
      if (state.list && state.list.ordered !== ordered) flushList()
      if (!state.list) state.list = { ordered, items: [] }
      state.list.items.push(match[2])
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      state.paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()
  return <>{blocks}</>
}

export default function AssistantWidget() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>(readStored)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const messagesRef = useRef(messages)
  const abortRef = useRef<AbortController | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const stickRef = useRef(true)

  messagesRef.current = messages
  const hidden = HIDDEN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))

  const patch = useCallback((id: string, changes: Partial<Msg>) => {
    setMessages(current => current.map(item => item.id === id ? { ...item, ...changes } : item))
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    launcherRef.current?.focus()
  }, [])

  const send = useCallback(async (raw: string, base?: Msg[]) => {
    const text = raw.trim().slice(0, MAX_INPUT)
    if (!text || abortRef.current) return
    const settled = (base ?? messagesRef.current).filter(item => !item.error && item.content)
    const userMessage: Msg = { id: uid(), role: 'user', content: text }
    const botMessage: Msg = { id: uid(), role: 'assistant', content: '' }
    const history = [...settled, userMessage]
    stickRef.current = true
    setMessages([...settled, userMessage, botMessage])
    setInput('')
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller
    let received = ''
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Tunas sedang tidak dapat menjawab. Coba lagi nanti.')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += decoder.decode(value, { stream: true })
        patch(botMessage.id, { content: received })
      }
      received += decoder.decode()
      if (!received.trim()) throw new Error('Tunas belum menemukan jawaban. Coba ulangi pertanyaannya.')
      patch(botMessage.id, { content: received })
    } catch (error) {
      if (controller.signal.aborted) {
        if (!received.trim()) setMessages(current => current.filter(item => item.id !== botMessage.id))
      } else {
        const message = error instanceof TypeError ? 'Koneksi bermasalah. Periksa jaringan lalu coba lagi.' : error instanceof Error ? error.message : 'Terjadi kendala. Coba lagi.'
        patch(botMessage.id, { error: message })
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [patch])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const retry = useCallback(() => {
    const current = messagesRef.current
    const lastUserIndex = current.map(item => item.role).lastIndexOf('user')
    if (lastUserIndex < 0) return
    send(current[lastUserIndex].content, current.slice(0, lastUserIndex))
  }, [send])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(input)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(input)
    }
  }

  useEffect(() => {
    if (busy) return
    try {
      const keep = messages.filter(item => item.content && !item.error).slice(-20)
      if (keep.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(keep))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      return
    }
  }, [messages, busy])

  useEffect(() => {
    const launcher = launcherRef.current
    if (!launcher || prefersReducedMotion()) return
    const move = (event: PointerEvent) => {
      const rect = launcher.getBoundingClientRect()
      const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width
      const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height
      gsap.to(launcher, { x: dx * 7, y: dy * 7, rotateX: -dy * 3, rotateY: dx * 4, duration: .38, ease: 'power3.out', overwrite: true })
    }
    const leave = () => gsap.to(launcher, { x: 0, y: 0, rotateX: 0, rotateY: 0, duration: .65, ease: 'elastic.out(1, .55)', overwrite: true })
    launcher.addEventListener('pointermove', move)
    launcher.addEventListener('pointerleave', leave)
    return () => {
      launcher.removeEventListener('pointermove', move)
      launcher.removeEventListener('pointerleave', leave)
      gsap.set(launcher, { clearProps: 'transform' })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    const body = bodyRef.current
    if (open && body && stickRef.current) body.scrollTop = body.scrollHeight
  }, [messages, open])

  useEffect(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`
  }, [input, open])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (hidden) return null

  const lastMessage = messages[messages.length - 1]

  return <div className={open ? 'tunas is-open' : 'tunas'} style={{ perspective: '900px' }}>
    {open && <section className="tunas-panel" role="dialog" aria-label="Tunas, asisten digital KIWANTIKA">
      <header className="tunas-head">
        <span className="tunas-avatar"><img src="/media/kiwantika-logo.png" alt="" /></span>
        <div className="tunas-title"><strong>Tunas</strong><small>Asisten AI KIWANTIKA</small></div>
        <div className="tunas-head-actions">
          <button type="button" aria-label="Mulai percakapan baru" title="Percakapan baru" onClick={reset} disabled={!messages.length}><RotateCcw size={16} /></button>
          <button type="button" aria-label="Tutup asisten" onClick={close}><X size={18} /></button>
        </div>
      </header>
      <div className="tunas-body" ref={bodyRef} aria-live="polite" aria-busy={busy} onScroll={event => {
        const target = event.currentTarget
        stickRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 48
      }}>
        <div className="tunas-row assistant"><div className="tunas-bubble"><p>Salam Pramuka! Aku <strong>Tunas</strong>, asisten digital KIWANTIKA. Tanya soal pendaftaran, kegiatan, berita, atau materi kepramukaan ya.</p></div></div>
        {!messages.length && <div className="tunas-suggest">{SUGGESTIONS.map(item => <button type="button" key={item} onClick={() => send(item)}>{item}</button>)}</div>}
        {messages.map(item => <div className={`tunas-row ${item.role}`} key={item.id}>
          <div className="tunas-bubble">
            {item.role === 'assistant'
              ? item.content ? <RichText text={item.content} onNavigate={() => { if (window.innerWidth < 640) close() }} /> : !item.error && <span className="tunas-typing" aria-label="Tunas sedang mengetik"><i /><i /><i /></span>
              : item.content}
          </div>
          {item.error && <div className="tunas-error" role="alert"><span>{item.error}</span>{item === lastMessage && <button type="button" onClick={retry}>Coba lagi</button>}</div>}
        </div>)}
      </div>
      <form className="tunas-form" onSubmit={submit}>
        <textarea ref={inputRef} rows={1} maxLength={MAX_INPUT} value={input} placeholder="Tulis pertanyaanmu…" aria-label="Pertanyaan untuk Tunas" onChange={event => setInput(event.target.value)} onKeyDown={onKeyDown} />
        {busy
          ? <button type="button" className="tunas-send is-stop" aria-label="Hentikan jawaban" onClick={stop}><Square size={14} /></button>
          : <button type="submit" className="tunas-send" aria-label="Kirim pertanyaan" disabled={!input.trim()}><SendHorizontal size={17} /></button>}
      </form>
      <p className="tunas-note">Tunas adalah AI dan bisa keliru. Cek info penting ke pengurus.</p>
    </section>}
    <button ref={launcherRef} type="button" className="tunas-launcher" aria-expanded={open} aria-label={open ? 'Tutup asisten Tunas' : 'Buka asisten Tunas'} onClick={() => open ? close() : setOpen(true)}>
      {open ? <X size={20} /> : <><Sparkles size={18} /><span>Tanya Tunas</span></>}
    </button>
  </div>
}
