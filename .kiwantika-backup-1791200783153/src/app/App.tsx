import { BrowserRouter, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom'
import { CalendarDays, Images, LogIn, Menu, Newspaper, Shield, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { HomePage, AboutPage, NewsPage, CalendarPage, GalleryPage, RegistrationPage, LoginPage, NotFoundPage } from '../features/public/pages'
import { MemberDashboard, ProfilePage, PermissionPage } from '../features/member/pages'
import { AdminDashboard, AdminListPage } from '../features/admin/pages'
import { FormManager } from '../features/admin/form'
import { AttendancePage, AdminAttendancePage } from '../features/attendance/pages'
import '../styles/app.css'

function Shell() {
  const [open, setOpen] = useState(false)
  const nav = [['/', 'Beranda'], ['/tentang', 'Tentang'], ['/berita', 'Berita'], ['/kalender', 'Kalender'], ['/galeri', 'Galeri']] as const
  return <>
    <header className="site-header"><div className="wrap header-inner">
      <Link to="/" className="brand" onClick={()=>setOpen(false)}><span className="brand-mark brand-image"><img src="/media/kiwantika-logo.png" alt="" onError={(event)=>{event.currentTarget.style.display='none'}}/><b>K</b></span><span><strong>KIWANTIKA</strong><small>SMAN 10 GARUT</small></span></Link>
      <nav className={open ? 'main-nav open' : 'main-nav'}>{nav.map(([to,label])=><NavLink key={to} to={to} end={to==='/' } onClick={()=>setOpen(false)}>{label}</NavLink>)}<NavLink to="/daftarkiwantika" onClick={()=>setOpen(false)}>Daftar KIWANTIKA</NavLink><NavLink to="/masuk" onClick={()=>setOpen(false)}><LogIn size={16}/> Masuk</NavLink></nav>
      <button className="mobile-menu" aria-label="Menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
    </div></header>
    <main><Outlet/></main>
    <footer><div className="wrap footer-grid"><div><strong>KIWANTIKA</strong><p>Ambalan Ki Hajar Dewantara – Dewi Sartika · SMAN 10 Garut</p></div><div><strong>Ruang digital ambalan.</strong><p>Informasi, kegiatan, dan keanggotaan.</p></div></div></footer>
  </>
}

export function App(){return <BrowserRouter><Routes><Route element={<Shell/>}><Route path="/" element={<HomePage/>}/><Route path="/tentang" element={<AboutPage/>}/><Route path="/berita" element={<NewsPage/>}/><Route path="/berita/:slug" element={<NewsPage detail/>}/><Route path="/kalender" element={<CalendarPage/>}/><Route path="/galeri" element={<GalleryPage/>}/><Route path="/daftarkiwantika" element={<RegistrationPage/>}/><Route path="/daftarkiwantika/:slug" element={<RegistrationPage/>}/><Route path="/masuk" element={<LoginPage/>}/><Route path="/dashboard" element={<MemberDashboard/>}/>
<Route path="/absen/:token" element={<AttendancePage/>}/><Route path="/dashboard/profil" element={<ProfilePage/>}/><Route path="/dashboard/perizinan" element={<PermissionPage/>}/><Route path="/admin" element={<AdminDashboard/>}/>
<Route path="/admin/absensi" element={<AdminAttendancePage/>}/><Route path="/admin/anggota" element={<AdminListPage kind="anggota"/>}/><Route path="/admin/formulir" element={<AdminListPage kind="formulir"/>}/><Route path="/admin/formulir/baru" element={<FormManager/>}/><Route path="/admin/formulir/:id" element={<FormManager/>}/><Route path="/admin/berita" element={<AdminListPage kind="berita"/>}/><Route path="/admin/kegiatan" element={<AdminListPage kind="kegiatan"/>}/><Route path="/admin/galeri" element={<AdminListPage kind="galeri"/>}/><Route path="*" element={<NotFoundPage/>}/></Route></Routes></BrowserRouter>}
