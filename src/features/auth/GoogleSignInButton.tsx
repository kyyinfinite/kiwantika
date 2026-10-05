import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'

export function GoogleSignInButton({ onError, onBusyChange }: {
  onError?: (message: string) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const errorRef = useRef(onError)
  const busyRef = useRef(onBusyChange)
  errorRef.current = onError
  busyRef.current = onBusyChange

  useEffect(() => {
    if (!clientId || !supabase || !containerRef.current) return

    let cancelled = false
    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return
      containerRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!supabase || !credential) return
          busyRef.current?.(true)
          errorRef.current?.('')
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: credential,
          })
          busyRef.current?.(false)
          if (error) errorRef.current?.(error.message)
        },
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(containerRef.current.clientWidth || 360, 400),
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
      setReady(true)
    }

    if (window.google?.accounts?.id) {
      render()
      return () => { cancelled = true }
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`)
    if (!script) {
      script = document.createElement('script')
      script.src = GOOGLE_SCRIPT
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', render)
    return () => {
      cancelled = true
      script?.removeEventListener('load', render)
    }
  }, [clientId])

  if (!clientId) return null
  return <div className="google-auth"><div ref={containerRef} /><small>{ready ? 'Masuk aman dengan akun Google.' : 'Menyiapkan Google Sign-In…'}</small></div>
}
