import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText, rpc } from '../../lib/rpc'

export type QrSlot = { slot: number; starts_ms: number; ends_ms: number; code: string; manual: string }
type Issued = { rotate_seconds: number; server_now_ms: number; slots: QrSlot[] }

export function useRotatingQr(sessionId: string) {
  const [slots, setSlots] = useState<QrSlot[]>([])
  const [rotate, setRotate] = useState(30)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState('')
  const offset = useRef(0)
  const slotsRef = useRef<QrSlot[]>([])
  const lastFetch = useRef(0)
  const inflight = useRef(false)

  const refresh = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    lastFetch.current = Date.now()
    try {
      const data = await rpc<Issued>('issue_attendance_qr', { p_session_id: sessionId })
      offset.current = data.server_now_ms - Date.now()
      slotsRef.current = data.slots
      setSlots(data.slots)
      setRotate(data.rotate_seconds)
      setError('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      inflight.current = false
    }
  }, [sessionId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => {
      const serverNow = Date.now() + offset.current
      setNow(serverNow)
      const list = slotsRef.current
      const currentIndex = list.findIndex(item => serverNow >= item.starts_ms && serverNow < item.ends_ms)
      const ahead = currentIndex < 0 ? 0 : list.length - 1 - currentIndex
      if (ahead < 2 && Date.now() - lastFetch.current > 4000) refresh()
    }, 250)
    return () => clearInterval(timer)
  }, [refresh])

  const current = slots.find(item => now >= item.starts_ms && now < item.ends_ms) ?? null
  const secondsLeft = current ? Math.max(0, Math.ceil((current.ends_ms - now) / 1000)) : 0
  const fraction = current ? Math.max(0, Math.min(1, (current.ends_ms - now) / (rotate * 1000))) : 0
  return { current, secondsLeft, fraction, rotate, error }
}
