import { CalendarDays, CheckCircle2, ChevronRight, Images, LogIn, Newspaper, Shield, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState, type ReactNode, type FormEvent, useRef } from 'react'
import { supabase, hasSupabase } from '../../lib/supabase'
import type { Article, Event } from '../../lib/types'

const fallbackEvents: Event[] = []
const fallbackArticles: Article[] = []

function Section({eyebrow,title,children,action}:{eyebrow?:string,title:string,children:ReactNode,action?:ReactNode}){return <section className="section"><div className="wrap"><div className="section-head"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</div></section>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

export function HomePage(){
 return <>
  <section className="hero hero-editorial">
   <div className="hero-photo" aria-hidden="true" />
   <div className="hero-shade" aria-hidden="true" />
   <Geometry className="hero-geo"/>
   <div className="wrap hero-content">
    <div className="hero-copy">
     <span className="eyebrow">SMAN 10 GARUT · AMBALAN</span>
     <h1>KIWANTIKA</h1>
     <p>Ruang digital Ambalan Ki Hajar Dewantara – Dewi Sartika.</p>
     <div className="actions">
      <Link className="btn primary" to="/daftarkiwantika">Daftar KIWANTIKA <ChevronRight size={16}/></Link>
      <Link className="btn glass" to="/tentang">Tentang kami</Link>
     </div>
    </div>
    <div className="hero-signature">
     <span>KI · HD / DS</span>
     <strong><span>Bersatu</span><span>Berpadu</span><em>BERMUTU</em></strong>
    </div>
   </div>
  </section>

  <section className="quick-section">
   <div className="wrap">
    <div className="quick-grid">
     <Link className="quick-card" to="/kalender"><span className="quick-icon"><CalendarDays size={19}/></span><span><strong>Kegiatan</strong><small>Lihat agenda ambalan</small></span><ChevronRight size={17}/></Link>
     <Link className="quick-card" to="/berita"><span className="quick-icon"><Newspaper size={19}/></span><span><strong>Berita</strong><small>Cerita dan dokumentasi</small></span><ChevronRight size={17}/></Link>
     <Link className="quick-card" to="/galeri"><span className="quick-icon"><Images size={19}/></span><span><strong>Galeri</strong><small>Arsip visual KIWANTIKA</small></span><ChevronRight size={17}/></Link>
    </div>
   </div>
  </section>

  <Emblem/>
  <UpcomingEvents/>

  <Section eyebrow="KIWANTIKA" title="Satu ruang untuk ambalan.">
   <div className="intro-row">
    <p>Informasi kegiatan, keanggotaan, dan administrasi tersusun dalam satu platform.</p>
    <Link className="text-link" to="/masuk">Ruang anggota <ChevronRight size={17}/></Link>
   </div>
  </Section>
 </>
}

function Geometry({className}:{className?:string}){
 return <svg className={className?`geo ${className}`:'geo'} viewBox="0 0 220 220" aria-hidden="true">
  <circle pathLength={1} cx="110" cy="110" r="100"/>
  <circle pathLength={1} cx="110" cy="110" r="80.9"/>
  <path pathLength={1} d="M110 10 205.11 79.1 168.78 190.9 51.22 190.9 14.89 79.1Z"/>
  <path pathLength={1} d="M110 10 168.78 190.9 14.89 79.1 205.11 79.1 51.22 190.9Z"/>
 </svg>
}

function useReveal<T extends HTMLElement>(){
 const ref=useRef<T>(null)
 const [seen,setSeen]=useState(false)
 useEffect(()=>{
  const el=ref.current
  if(!el)return
  if(typeof IntersectionObserver==='undefined'){setSeen(true);return}
  const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setSeen(true);io.disconnect()}},{threshold:.25})
  io.observe(el)
  return()=>io.disconnect()
 },[])
 return [ref,seen] as const
}

const emblemItems=[
 {name:'Roda gigi',note:'dengan tiga bintang di dalamnya',icon:<><circle cx="12" cy="12" r="6.5"/><path d="M12 2.8v3.2M12 18v3.2M2.8 12h3.2M18 12h3.2M5.5 5.5l2.3 2.3M16.2 16.2l2.3 2.3M18.5 5.5l-2.3 2.3M7.8 16.2l-2.3 2.3"/><path d="M12 9.2 12.9 11.2 15 11.4 13.4 12.8 13.9 14.9 12 13.8 10.1 14.9 10.6 12.8 9 11.4 11.1 11.2Z"/></>},
 {name:'Tunas kelapa',note:'di tengah perisai',icon:<><path d="M12 15V4"/><path d="M12 15C12 10 9 7 6 6c0 4 2 7 6 9"/><path d="M12 15c0-5 3-8 6-9 0 4-2 7-6 9"/><path d="M7 20c0-3 2.2-5 5-5s5 2 5 5z"/></>},
 {name:'Fleur-de-lis',note:'di bawah tunas kelapa',icon:<><path d="M12 3c-2.2 2.6-2.2 6.2 0 9.2 2.2-3 2.2-6.6 0-9.2z"/><path d="M10.4 11.2C9.6 8.6 6.6 8 5.4 9.8c-1.3 2 .3 4.4 2.8 4.4 1 0 1.8-.4 2.2-1"/><path d="M13.6 11.2c.8-2.6 3.8-3.2 5-1.4 1.3 2-.3 4.4-2.8 4.4-1 0-1.8-.4-2.2-1"/><path d="M8 17h8M12 14.5V21M9.5 21h5"/></>},
 {name:'Padi',note:'di sisi kanan',icon:<><path d="M12 22V7"/><path d="M12 3.5c-1 1-1 2.5 0 3.5 1-1 1-2.5 0-3.5z"/><path d="M12 10c-2.4-.6-3.6-2.4-3.6-4.6 2.4.6 3.6 2.4 3.6 4.6zM12 10c2.4-.6 3.6-2.4 3.6-4.6-2.4.6-3.6 2.4-3.6 4.6z"/><path d="M12 15c-2.4-.6-3.6-2.4-3.6-4.6 2.4.6 3.6 2.4 3.6 4.6zM12 15c2.4-.6 3.6-2.4 3.6-4.6-2.4.6-3.6 2.4-3.6 4.6z"/><path d="M12 20c-2.4-.6-3.6-2.4-3.6-4.6 2.4.6 3.6 2.4 3.6 4.6zM12 20c2.4-.6 3.6-2.4 3.6-4.6-2.4.6-3.6 2.4-3.6 4.6z"/></>},
 {name:'Kapas',note:'di sisi kiri',icon:<><circle cx="8.8" cy="9" r="3"/><circle cx="15.2" cy="9" r="3"/><circle cx="12" cy="6.2" r="3"/><path d="M7.5 12.5 12 21l4.5-8.5"/></>}
]

function Emblem(){
 const [ref,seen]=useReveal<HTMLElement>()
 return <section ref={ref} className={seen?'emblem in':'emblem'}>
  <div className="wrap emblem-grid">
   <div className="emblem-figure">
    <Geometry/>
    <img src="/media/kiwantika-logo.png" alt="Lambang KIWANTIKA" onError={(event)=>{event.currentTarget.style.display='none'}}/>
   </div>
   <div className="emblem-body">
    <span className="eyebrow">Lambang</span>
    <h2>Satu lambang, lima unsur.</h2>
    <p>Setiap unsur di bawah ini bisa kamu temukan pada lambang di samping.</p>
    <ul className="emblem-list">
     {emblemItems.map((item,i)=><li className="emblem-item" key={item.name} style={{animationDelay:`${0.6+i*0.12}s`}}>
      <span className="emblem-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg></span>
      <span><strong>{item.name}</strong><small>{item.note}</small></span>
     </li>)}
    </ul>
   </div>
  </div>
 </section>
}

function UpcomingEvents(){
 const [items,setItems]=useState<Event[]>([])
 useEffect(()=>{
  if(!supabase)return
  supabase.from('events').select('id,title,slug,description,event_type,visibility,start_at,end_at,location').eq('status','published').gte('start_at',new Date().toISOString()).order('start_at').limit(3).then(({data})=>{if(data)setItems(data as Event[])})
 },[])
 if(!items.length)return null
 return <Section eyebrow="Agenda" title="Kegiatan terdekat" action={<Link className="text-link" to="/kalender">Semua agenda <ChevronRight size={17}/></Link>}>
  <div className="event-list">{items.map(e=><article className="event-row" key={e.id}><div className="date-box"><strong>{new Date(e.start_at).getDate()}</strong><span>{new Date(e.start_at).toLocaleDateString('id-ID',{month:'short'})}</span></div><div><span className="eyebrow">{e.event_type}</span><h3>{e.title}</h3><p>{e.location||'Lokasi akan diumumkan'}</p></div></article>)}</div>
 </Section>
}

export function AboutPage(){return <Section eyebrow="Tentang" title="KIWANTIKA"><div className="prose"><p><strong>KIWANTIKA</strong> adalah identitas digital untuk Ambalan Ki Hajar Dewantara – Dewi Sartika di SMAN 10 Garut.</p><p>Halaman ini menjadi tempat untuk mengenalkan identitas, sejarah, struktur, kegiatan, dan nilai yang dibangun bersama. Data organisasi yang bersifat internal akan dikelola melalui ruang anggota.</p><div className="notice"><Shield/> <span>Detail seperti struktur pengurus, nomor gugus depan, dan data keanggotaan perlu dikonfirmasi oleh pembina/pengurus sebelum dipublikasikan.</span></div></div></Section>}
export function NewsPage({detail=false}:{detail?:boolean}){const {slug}=useParams(); const [items,setItems]=useState<Article[]>(fallbackArticles); useEffect(()=>{if(supabase) supabase.from('articles').select('id,title,slug,excerpt,content,cover_path,category,published_at').eq('status','published').order('published_at',{ascending:false}).then(({data})=>{if(data)setItems(data as Article[])})},[]); if(detail){const a=items.find(x=>x.slug===slug); return <Section eyebrow="Berita" title={a?.title||'Berita KIWANTIKA'}>{a?<div className="prose"><p>{a.excerpt}</p><div dangerouslySetInnerHTML={{__html:a.content}}/></div>:<Empty text={hasSupabase?'Memuat artikel…':'Artikel belum tersedia.'}/>}</Section>} return <Section eyebrow="Publikasi" title="Berita & cerita kegiatan"><div className="article-grid">{items.length?items.map(a=><Link className="article-card" to={`/berita/${a.slug}`} key={a.id}><span>{a.category}</span><h3>{a.title}</h3><p>{a.excerpt}</p></Link>):<Empty text="Belum ada berita yang dipublikasikan."/>}</div></Section>}
export function CalendarPage(){const [events,setEvents]=useState<Event[]>(fallbackEvents); useEffect(()=>{if(supabase)supabase.from('events').select('id,title,slug,description,event_type,visibility,start_at,end_at,location').eq('status','published').order('start_at').then(({data})=>{if(data)setEvents(data as Event[])})},[]); return <Section eyebrow="Agenda" title="Kalender kegiatan"><div className="event-list">{events.length?events.map(e=><article className="event-row" key={e.id}><div className="date-box"><strong>{new Date(e.start_at).getDate()}</strong><span>{new Date(e.start_at).toLocaleDateString('id-ID',{month:'short'})}</span></div><div><span className="eyebrow">{e.event_type}</span><h3>{e.title}</h3><p>{e.location||'Lokasi akan diumumkan'}</p></div></article>):<Empty text="Belum ada agenda yang dipublikasikan."/>}</div></Section>}
export function GalleryPage(){return <Section eyebrow="Dokumentasi" title="Galeri kegiatan"><div className="gallery-placeholder"><Images size={30}/><p>Album dokumentasi KIWANTIKA akan tampil di sini setelah media dimigrasikan ke Supabase Storage.</p></div></Section>}
export function RegistrationPage(){
 const {slug}=useParams(); const [form,setForm]=useState<any>(null); const [fields,setFields]=useState<any[]>([]); const [values,setValues]=useState<Record<string,string>>({}); const [message,setMessage]=useState(''); const [loading,setLoading]=useState(Boolean(slug));
 useEffect(()=>{(async()=>{if(!supabase||!slug)return; const {data:f}=await supabase.from('forms').select('*').eq('slug',slug).eq('status','published').single(); if(!f){setLoading(false);return} const {data:v}=await supabase.from('form_versions').select('id,version_number').eq('form_id',f.id).order('version_number',{ascending:false}).limit(1).single(); if(v){const {data:fs}=await supabase.from('form_fields').select('*').eq('form_version_id',v.id).order('position');setFields(fs||[])} setForm({...f,version:v});setLoading(false)})()},[slug]);
 const submit=async(e:FormEvent)=>{e.preventDefault(); if(!supabase||!form?.version)return; setMessage('Mengirim…'); const {data:{user}}=await supabase.auth.getUser(); if(form.requires_auth&&!user){setMessage('Silakan masuk terlebih dahulu.');return} const number=`KW-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`; const {error}=await supabase.rpc('submit_form',{p_form_id:form.id,p_form_version_id:form.version.id,p_submission_number:number,p_applicant_id:user?.id??null,p_answers:values}); if(error){setMessage(error.message);return} setMessage(`Pendaftaran berhasil dikirim. Nomor: ${number}`); setValues({});};
 if(!slug)return <Section eyebrow="Pendaftaran" title="Pendaftaran KIWANTIKA"><div className="form-shell"><h3>Form digital untuk penerimaan anggota dan kegiatan.</h3><p>Bagikan tautan formulir dari pengurus melalui URL unik.</p></div></Section>;
 return <Section eyebrow="Pendaftaran KIWANTIKA" title={form?.title||slug.replaceAll('-',' ')}>{loading?<div className="empty">Memuat formulir…</div>:!form?<Empty text="Formulir tidak tersedia atau sudah ditutup."/>:<form className="form-shell" onSubmit={submit}>{form.description&&<p>{form.description}</p>}{fields.map(f=><label className="field" key={f.id}><span>{f.label}{f.required?' *':''}</span>{f.type==='long_text'?<textarea required={f.required} value={values[f.field_key]||''} onChange={e=>setValues(v=>({...v,[f.field_key]:e.target.value}))}/>:f.type==='select'?<select required={f.required} value={values[f.field_key]||''} onChange={e=>setValues(v=>({...v,[f.field_key]:e.target.value}))}><option value="">Pilih…</option>{(f.options||[]).map((o:any)=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>:<input required={f.required} type={f.type==='email'?'email':f.type==='number'?'number':f.type==='date'?'date':'text'} value={values[f.field_key]||''} onChange={e=>setValues(v=>({...v,[f.field_key]:e.target.value}))}/>} {f.description&&<small>{f.description}</small>}</label>)}<button className="btn primary" type="submit">Kirim pendaftaran</button>{message&&<div className="notice"><CheckCircle2/><span>{message}</span></div>}</form>}</Section>
}
export function LoginPage(){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!supabase){setMessage('Supabase belum dikonfigurasi.');return}setMessage('Memproses…');const {error}=await supabase.auth.signInWithPassword({email,password});setMessage(error?.message||'Login berhasil. Silakan buka dashboard.');}
 return <Section eyebrow="Anggota" title="Masuk ke KIWANTIKA"><form className="form-shell" onSubmit={submit}><label className="field"><span>Email</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field"><span>Password</span><input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary" type="submit" disabled={!hasSupabase}><LogIn/> Masuk</button>{!hasSupabase&&<small>Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY untuk mengaktifkan Auth.</small>}{message&&<div className="notice"><CheckCircle2/><span>{message}</span></div>}</form></Section>
}
export function DashboardPage(){return <Section eyebrow="Member" title="Dashboard KIWANTIKA"><div className="feature-grid"><Feature icon={<CalendarDays/>} title="Agenda" text="Kegiatan mendatang akan muncul di sini."/><Feature icon={<CheckCircle2/>} title="Absensi" text="Statistik kehadiran anggota."/><Feature icon={<Shield/>} title="SKU / TKK" text="Progress pembinaan anggota."/></div></Section>}
export function AdminPage(){return <Section eyebrow="Management" title="Admin KIWANTIKA"><div className="prose"><p>Panel admin menjadi tempat pengelolaan anggota, formulir, kegiatan, berita, galeri, SKU/TKK, kas, perizinan, notifikasi, dan audit.</p><div className="notice"><Shield/><span>Authorization final harus ditegakkan oleh Supabase RLS, bukan hanya route guard React.</span></div></div></Section>}
export function NotFoundPage(){return <Section eyebrow="404" title="Halaman tidak ditemukan"><p>Halaman yang kamu cari tidak tersedia.</p><Link className="btn primary" to="/">Kembali ke beranda</Link></Section>}
