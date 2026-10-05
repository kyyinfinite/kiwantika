import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Role = 'super_admin' | 'admin' | 'pembina' | 'dewan' | 'anggota' | 'calon_anggota'

type Profile = {
  id: string
  full_name: string
  display_name: string | null
  email: string | null
  role: Role
  membership_status: string
  avatar_path: string | null
  class_name: string | null
  generation: string | null
  group_name: string | null
}

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isStaff: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STAFF_ROLES: Role[] = ['super_admin', 'admin', 'pembina', 'dewan']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (currentUser: User | null) => {
    const client = supabase

    if (!currentUser || !client) {
      setProfile(null)
      return
    }

    const { data, error } = await client
      .from('profiles')
      .select('id,full_name,display_name,email,role,membership_status,avatar_path,class_name,generation,group_name')
      .eq('id', currentUser.id)
      .maybeSingle()

    if (!error && data) setProfile(data as Profile)
    else setProfile(null)
  }

  const refreshProfile = async () => {
    await loadProfile(user)
  }

  useEffect(() => {
    const client = supabase

    if (!client) {
      setLoading(false)
      return
    }

    let active = true

    const bootstrap = async () => {
      const { data: { user: currentUser } } = await client.auth.getUser()
      if (!active) return
      setUser(currentUser)
      await loadProfile(currentUser)
      if (active) setLoading(false)
    }

    bootstrap()

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      await loadProfile(currentUser)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    isAuthenticated: Boolean(user),
    isStaff: Boolean(profile && STAFF_ROLES.includes(profile.role)),
    refreshProfile,
    signOut: async () => {
      const client = supabase
      if (client) await client.auth.signOut()
    },
  }), [user, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function LoadingScreen() {
  return <div className="auth-loading"><div><span className="eyebrow">KIWANTIKA</span><strong>Memeriksa sesi…</strong></div></div>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/masuk?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}

export function StaffRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, isStaff } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/masuk?next=${encodeURIComponent(next)}`} replace />
  }

  if (!profile) {
    return <div className="wrap page-pad"><div className="notice"><span>Akun berhasil masuk, tetapi profil belum tersedia. Hubungi pengurus.</span></div></div>
  }

  if (!isStaff) {
    return <div className="wrap page-pad"><div className="notice"><span>Akses ditolak. Halaman ini hanya untuk pengurus KIWANTIKA.</span></div></div>
  }

  return <>{children}</>
}
