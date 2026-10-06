import { BrowserRouter, Routes, Route, NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { LogIn, Menu, Shield, UserRound, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { HomePage, AboutPage, NewsPage, CalendarPage, GalleryPage, RegistrationPage, LoginPage, NotFoundPage } from '../features/public/pages'
import { ErrorBoundary, RouteProgress } from '../components/feedback'
import { AuthProvider, ProtectedRoute, StaffRoute, useAuth } from '../features/auth/AuthProvider'
import '../styles/app.css'
import '../styles/kiwantika.css'
import '../styles/polish.css'

function lazyNamed<K extends string>(loader: () => Promise<Record<K, ComponentType<any>>>, key: K) {
  return lazy(() => loader().then(module => ({ default: module[key] })))
}

const MemberDashboard = lazyNamed(() => import('../features/member/pages'), 'MemberDashboard')
const ProfilePage = lazyNamed(() => import('../features/member/pages'), 'ProfilePage')
const PermissionPage = lazyNamed(() => import('../features/member/pages'), 'PermissionPage')
const AdminDashboard = lazyNamed(() => import('../features/admin/pages'), 'AdminDashboard')
const AdminListPage = lazyNamed(() => import('../features/admin/pages'), 'AdminListPage')
const PermissionManager = lazyNamed(() => import('../features/admin/pages'), 'PermissionManager')
const MemberManager = lazyNamed(() => import('../features/admin/pages'), 'MemberManager')
const FormManager = lazyNamed(() => import('../features/admin/form'), 'FormManager')
const AttendancePage = lazyNamed(() => import('../features/attendance/pages'), 'AttendancePage')
const AdminAttendancePage = lazyNamed(() => import('../features/attendance/pages'), 'AdminAttendancePage')
const AssistantWidget = lazy(() => import('../features/assistant/AssistantWidget'))

function DeferredAssistant() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200)
    return () => clearTimeout(timer)
  }, [])
  if (!ready) return null
  return <Suspense fallback={null}><AssistantWidget /></Suspense>
}

const pageTitles: Array<[string, string]> = [
  ['/tentang', 'Tentang'], ['/berita', 'Berita'], ['/kalender', 'Kalender'], ['/galeri', 'Galeri'],
  ['/daftarkiwantika', 'Pendaftaran'], ['/masuk', 'Masuk'], ['/absen', 'Absensi'],
  ['/dashboard', 'Ruang Anggota'], ['/admin', 'Panel Admin'],
]

const siteUrl = ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/+$/, '')) || window.location.origin
const privatePrefixes = ['/admin', '/dashboard', '/masuk', '/absen']

function upsertTag(tag: 'link' | 'meta', key: string, keyValue: string, attr: string, value: string) {
  let element = document.head.querySelector<HTMLElement>(`${tag}[${key}="${keyValue}"]`)
  if (!element) {
    element = document.createElement(tag)
    element.setAttribute(key, keyValue)
    document.head.appendChild(element)
  }
  element.setAttribute(attr, value)
}

function RouteEffects() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  useEffect(() => {
    const clean = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    const isPrivate = privatePrefixes.some(prefix => clean === prefix || clean.startsWith(prefix + '/'))
    upsertTag('link', 'rel', 'canonical', 'href', `${siteUrl}${clean}`)
    upsertTag('meta', 'property', 'og:url', 'content', `${siteUrl}${clean}`)
    upsertTag('meta', 'name', 'robots', 'content', isPrivate ? 'noindex, nofollow' : 'index, follow')
    if (pathname.startsWith('/berita/')) return
    const match = pageTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))
    document.title = match ? `${match[1]} — KIWANTIKA` : 'KIWANTIKA — SMAN 10 Garut'
  }, [pathname])
  return null
}

const INSTAGRAM_URL = 'https://www.instagram.com/kiwantika/'

function Glyph({children}:{children:ReactNode}){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

const socials = [
  {name:'YouTube',icon:<Glyph><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></Glyph>},
  {name:'Facebook',icon:<Glyph><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></Glyph>},
  {name:'TikTok',icon:<Glyph><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.1 4.3 5 4.5"/></Glyph>},
  {name:'Instagram',icon:<Glyph><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></Glyph>}
]

function Shell() {
  const [open, setOpen] = useState(false)
  const { user, isStaff } = useAuth()
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const nav = [['/', 'Beranda'], ['/tentang', 'Tentang'], ['/berita', 'Berita'], ['/kalender', 'Kalender'], ['/galeri', 'Galeri']] as const
  return <>
    <a className="skip-link" href="#konten">Lewati ke konten</a>
    <header className={scrolled ? 'site-header is-scrolled' : 'site-header'}><div className="wrap header-inner">
      <Link to="/" className="brand" onClick={()=>setOpen(false)}><span className="brand-mark brand-image"><img src="/media/kiwantika-logo.png" alt="" onError={(event)=>{event.currentTarget.style.display='none'}}/><b>K</b></span><span><strong>KIWANTIKA</strong><small>SMAN 10 GARUT</small></span></Link>
      <nav id="menu-utama" aria-label="Navigasi utama" className={open ? 'main-nav open' : 'main-nav'}>{nav.map(([to,label])=><NavLink key={to} to={to} end={to==='/' } onClick={()=>setOpen(false)}>{label}</NavLink>)}<NavLink to="/daftarkiwantika" onClick={()=>setOpen(false)}>Daftar KIWANTIKA</NavLink>{user?<><NavLink to="/dashboard" onClick={()=>setOpen(false)}><UserRound size={16}/> Dashboard</NavLink>{isStaff&&<NavLink to="/admin" onClick={()=>setOpen(false)}><Shield size={16}/> Admin</NavLink>}</>:<NavLink to="/masuk" onClick={()=>setOpen(false)}><LogIn size={16}/> Masuk</NavLink>}</nav>
      <button className="mobile-menu" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open} aria-controls="menu-utama" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
    </div></header>
    <main id="konten" tabIndex={-1}><ErrorBoundary key={pathname}><Suspense fallback={<RouteProgress/>}><Outlet/></Suspense></ErrorBoundary></main>
    <footer><div className="wrap footer-grid"><div><strong>KIWANTIKA</strong><p>Ambalan Ki Hajar Dewantara – Dewi Sartika · SMAN 10 Garut</p></div><div><strong>Ikuti kami</strong><div className="social-row">{socials.map(s=><a key={s.name} className="social-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} KIWANTIKA`}>{s.icon}</a>)}</div></div></div><div className="wrap footer-base"><span>© {new Date().getFullYear()} KIWANTIKA · Gugus Depan 15.075 – 15.076</span><button type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>Kembali ke atas ↑</button></div></footer>
    <DeferredAssistant/>
  </>
}

export function App(){return <BrowserRouter><RouteEffects/><AuthProvider><Routes><Route element={<Shell/>}><Route path="/" element={<HomePage/>}/><Route path="/tentang" element={<AboutPage/>}/><Route path="/berita" element={<NewsPage/>}/><Route path="/berita/:slug" element={<NewsPage detail/>}/><Route path="/kalender" element={<CalendarPage/>}/><Route path="/galeri" element={<GalleryPage/>}/><Route path="/daftarkiwantika" element={<RegistrationPage/>}/><Route path="/daftarkiwantika/:slug" element={<RegistrationPage/>}/><Route path="/masuk" element={<LoginPage/>}/><Route path="/dashboard" element={<ProtectedRoute><MemberDashboard/></ProtectedRoute>}/>
<Route path="/absen/:token" element={<AttendancePage/>}/><Route path="/dashboard/profil" element={<ProtectedRoute><ProfilePage/></ProtectedRoute>}/><Route path="/dashboard/perizinan" element={<ProtectedRoute><PermissionPage/></ProtectedRoute>}/><Route path="/admin" element={<StaffRoute><AdminDashboard/></StaffRoute>}/>
<Route path="/admin/absensi" element={<StaffRoute><AdminAttendancePage/></StaffRoute>}/><Route path="/admin/perizinan" element={<StaffRoute><PermissionManager/></StaffRoute>}/><Route path="/admin/anggota" element={<StaffRoute><MemberManager/></StaffRoute>}/><Route path="/admin/formulir" element={<StaffRoute><AdminListPage kind="formulir"/></StaffRoute>}/><Route path="/admin/formulir/baru" element={<StaffRoute><FormManager/></StaffRoute>}/><Route path="/admin/formulir/:id" element={<StaffRoute><FormManager/></StaffRoute>}/><Route path="/admin/berita" element={<StaffRoute><AdminListPage kind="berita"/></StaffRoute>}/><Route path="/admin/berita/baru" element={<StaffRoute><AdminListPage kind="berita"/></StaffRoute>}/><Route path="/admin/kegiatan" element={<StaffRoute><AdminListPage kind="kegiatan"/></StaffRoute>}/><Route path="/admin/galeri" element={<StaffRoute><AdminListPage kind="galeri"/></StaffRoute>}/><Route path="*" element={<NotFoundPage/>}/></Route></Routes></AuthProvider></BrowserRouter>}
