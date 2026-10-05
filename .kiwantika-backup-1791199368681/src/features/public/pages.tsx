import { CalendarDays, CheckCircle2, ChevronRight, Images, LogIn, Newspaper, Shield, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { supabase, hasSupabase } from '../../lib/supabase'
import type { Article, Event } from '../../lib/types'

const fallbackEvents: Event[] = []
const fallbackArticles: Article[] = []

function Section({eyebrow,title,children,action}:{eyebrow?:string,title:string,children:ReactNode,action?:ReactNode}){return <section className="section"><div className="wrap"><div className="section-head"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</div></section>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

export function HomePage(){
 return <>
  <section className="hero">
   <div className="wrap">
    <p className="hero-kicker">Ambalan SMAN 10 Garut</p>
    <h1 className="hero-title">KIWANTIKA</h1>
    <div className="hero-body">
     <div className="hero-text">
      <p className="hero-lead">Ruang digital Ambalan Ki Hajar Dewantara – Dewi Sartika.</p>
      <div className="actions">
       <Link className="btn primary" to="/daftarkiwantika">Daftar KIWANTIKA</Link>
       <Link className="btn ghost" to="/tentang">Tentang kami</Link>
      </div>
     </div>
     <figure className="hero-figure">
      <div className="hero-img" role="img" aria-label="Tongkat, tenda, dan bendera merah putih di lapangan SMAN 10 Garut"/>
      <figcaption className="hero-motto"><span>Bersatu</span><span>Berpadu</span><span>BERMUTU</span></figcaption>
     </figure>
    </div>
   </div>
  </section>

  <section className="gates">
   <div className="wrap">
    <div className="gate-list">
     <Link className="gate" to="/kalender"><span className="gate-mark"><CalendarDays size={20}/></span><span><strong>Kegiatan</strong><small>Lihat agenda ambalan</small></span><ChevronRight size={18}/></Link>
     <Link className="gate" to="/berita"><span className="gate-mark"><Newspaper size={20}/></span><span><strong>Berita</strong><small>Cerita dan dokumentasi</small></span><ChevronRight size={18}/></Link>
     <Link className="gate" to="/galeri"><span className="gate-mark"><Images size={20}/></span><span><strong>Galeri</strong><small>Arsip visual KIWANTIKA</small></span><ChevronRight size={18}/></Link>
    </div>
   </div>
  </section>

  <section className="statement">
   <div className="wrap">
    <div className="statement-inner">
     <h2>Satu ruang untuk ambalan.</h2>
     <p>Informasi kegiatan, keanggotaan, dan administrasi tersusun dalam satu platform.</p>
     <Link className="statement-link" to="/masuk">Ruang anggota <ChevronRight size={18}/></Link>
    </div>
   </div>
  </section>
 </>
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
