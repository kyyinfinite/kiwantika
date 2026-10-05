import { BrowserRouter, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom'
import { LogIn, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { HomePage, AboutPage, NewsPage, CalendarPage, GalleryPage, RegistrationPage, LoginPage, NotFoundPage } from '../features/public/pages'
import { MemberDashboard, ProfilePage, PermissionPage } from '../features/member/pages'
import { AdminDashboard, AdminListPage } from '../features/admin/pages'
import { FormManager } from '../features/admin/form'
import { AttendancePage, AdminAttendancePage } from '../features/attendance/pages'
import '../styles/app.css'
import '../styles/kiwantika.css'

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
  const nav = [['/', 'Beranda'], ['/tentang', 'Tentang'], ['/berita', 'Berita'], ['/kalender', 'Kalender'], ['/galeri', 'Galeri']] as const
  const close = () => setOpen(false)
  return <>
    <header className="site-header"><div className="wrap header-inner">
      <Link to="/" className="brand" onClick={close}><span className="brand-mark brand-image"><img src="/media/kiwantika-logo.png" alt="" onError={(event)=>{event.currentTarget.style.display='none'}}/><b>K</b></span><span><strong>KIWANTIKA</strong><small>SMAN 10 Garut</small></span></Link>
      <nav className={open ? 'main-nav open' : 'main-nav'} aria-label="Menu utama">{nav.map(([to,label])=><NavLink key={to} to={to} end={to==='/'} onClick={close}>{label}</NavLink>)}<NavLink to="/masuk" onClick={close}><LogIn size={16}/> Masuk</NavLink><NavLink className="nav-cta" to="/daftarkiwantika" onClick={close}>Daftar KIWANTIKA</NavLink></nav>
      <button className="mobile-menu" aria-label={open?'Tutup menu':'Buka menu'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
    </div></header>
    <main><Outlet/></main>
    <footer className="site-footer"><div className="wrap">
      <span className="foot-rule" aria-hidden="true"/>
      <div className="foot-top">
        <div className="foot-brand">
          <img src="/media/kiwantika-logo.png" alt="" onError={(event)=>{event.currentTarget.style.display='none'}}/>
          <div><strong>KIWANTIKA</strong><p>Ambalan Ki Hajar Dewantara – Dewi Sartika, SMAN 10 Garut.</p></div>
        </div>
        <nav className="foot-nav" aria-label="Pintasan">
          <p className="foot-heading">Jelajahi</p>
          <Link to="/tentang">Tentang</Link><Link to="/berita">Berita</Link><Link to="/kalender">Kalender</Link><Link to="/galeri">Galeri</Link><Link to="/daftarkiwantika">Daftar KIWANTIKA</Link>
        </nav>
        <div className="foot-social">
          <p className="foot-heading">Ikuti kami</p>
          <p className="foot-note">Dokumentasi kegiatan terbaru ada di Instagram KIWANTIKA.</p>
          <div className="social-row">{socials.map(s=><a key={s.name} className="social-link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} KIWANTIKA`}>{s.icon}</a>)}</div>
        </div>
      </div>
      <div className="foot-bottom"><span>© {new Date().getFullYear()} KIWANTIKA</span><span>SMAN 10 Garut</span></div>
    </div></footer>
  </>
}

export function App(){return <BrowserRouter><Routes><Route element={<Shell/>}><Route path="/" element={<HomePage/>}/><Route path="/tentang" element={<AboutPage/>}/><Route path="/berita" element={<NewsPage/>}/><Route path="/berita/:slug" element={<NewsPage detail/>}/><Route path="/kalender" element={<CalendarPage/>}/><Route path="/galeri" element={<GalleryPage/>}/><Route path="/daftarkiwantika" element={<RegistrationPage/>}/><Route path="/daftarkiwantika/:slug" element={<RegistrationPage/>}/><Route path="/masuk" element={<LoginPage/>}/><Route path="/dashboard" element={<MemberDashboard/>}/>
<Route path="/absen/:token" element={<AttendancePage/>}/><Route path="/dashboard/profil" element={<ProfilePage/>}/><Route path="/dashboard/perizinan" element={<PermissionPage/>}/><Route path="/admin" element={<AdminDashboard/>}/>
<Route path="/admin/absensi" element={<AdminAttendancePage/>}/><Route path="/admin/anggota" element={<AdminListPage kind="anggota"/>}/><Route path="/admin/formulir" element={<AdminListPage kind="formulir"/>}/><Route path="/admin/formulir/baru" element={<FormManager/>}/><Route path="/admin/formulir/:id" element={<FormManager/>}/><Route path="/admin/berita" element={<AdminListPage kind="berita"/>}/><Route path="/admin/kegiatan" element={<AdminListPage kind="kegiatan"/>}/><Route path="/admin/galeri" element={<AdminListPage kind="galeri"/>}/><Route path="*" element={<NotFoundPage/>}/></Route></Routes></BrowserRouter>}
