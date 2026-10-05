import { useCallback, useEffect, useRef, useState } from 'react'

type Result<T> = { data: T | null; error: { message: string } | null }
type State<T> = { data: T | null; error: string; loading: boolean }

export function useQuery<T>(run: (() => PromiseLike<Result<T>>) | null, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: '', loading: Boolean(run) })
  const [tick, setTick] = useState(0)
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    const job = runRef.current
    if (!job) {
      setState({ data: null, error: '', loading: false })
      return
    }
    let active = true
    setState(prev => ({ ...prev, loading: true, error: '' }))
    Promise.resolve(job()).then(
      ({ data, error }) => { if (active) setState({ data, error: error?.message ?? '', loading: false }) },
      () => { if (active) setState({ data: null, error: 'Koneksi bermasalah. Periksa jaringan lalu coba lagi.', loading: false }) },
    )
    return () => { active = false }
  }, [tick, ...deps])

  const reload = useCallback(() => setTick(value => value + 1), [])
  return { ...state, reload }
}
