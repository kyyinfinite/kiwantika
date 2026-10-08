import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, CheckCircle2, FileText, Images, ImagePlus, Newspaper, Pencil,
  Plus, Save, Shield, Trash2, Upload, Users, X, FileCheck2, Check, XCircle, Download, Search, Wallet, MailQuestion, ClipboardCheck
} from 'lucide-react'
import { supabase, hasSupabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import { useAuth } from '../auth/AuthProvider'
import { useConfirm } from '../../components/feedback'
import { OperationsOverview } from './OperationsOverview'
import { ContentListSkeleton, StatGridSkeleton, TableSkeleton } from '../../components/Skeleton'

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action}</div>{children}</section>
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? 'error' : ''}`}><Shield size={17}/><span>{children}</span></div>
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', pembina: 'Pembina', dewan: 'Dewan',
  anggota: 'Anggota', calon_anggota: 'Calon Anggota'
}

async function exportRegistrationData(){
  if(!supabase)return
  const {data,error}=await supabase.from('form_submissions').select('id,form_id,submission_number,status,applicant_id,answers_snapshot,submitted_at,created_at').order('created_at',{ascending:false})
  if(error)throw error
  const applicantIds=[...new Set((data||[]).map((x:any)=>x.applicant_id).filter(Boolean))]
  const {data:profiles,error:profileError}=applicantIds.length?await supabase.from('profiles').select('id,full_name,email,class_name,generation,group_name,phone').in('id',applicantIds):{data:[],error:null as any}
  if(profileError)throw profileError
  const profileMap=new Map<string, any>((profiles||[]).map((p:any)=>[p.id,p] as [string, any]))
  const rows=(data||[]).map((item:any)=>{
    const profile=profileMap.get(item.applicant_id)||{}
    const answers=item.answers_snapshot && typeof item.answers_snapshot==='object' ? item.answers_snapshot : {}
    const row:any={'Nomor Pendaftaran':item.submission_number,'Status':item.status,'Nama':profile.full_name||answers.nama||'', 'Email':profile.email||answers.email||'', 'Kelas':profile.class_name||answers.kelas||'', 'Angkatan':profile.generation||'', 'Regu/Sangga':profile.group_name||'', 'Nomor HP':profile.phone||answers.nomor_hp||'', 'Waktu Daftar':item.created_at?new Date(item.created_at).toLocaleString('id-ID'):'', 'Waktu Submit':item.submitted_at?new Date(item.submitted_at).toLocaleString('id-ID'):''}
    Object.entries(answers).forEach(([key,value])=>{ if(!(key in row)) row[key]=Array.isArray(value)?value.join(', '):(typeof value==='object'&&value!==null?JSON.stringify(value):value??'') })
    return row
  })
  const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.min(Math.max(String(k).length+4,16),42)})); XLSX.utils.book_append_sheet(wb,ws,'Pendaftar'); XLSX.writeFile(wb,`kiwantika-pendaftar-${new Date().toISOString().slice(0,10)}.xlsx`)
  return rows.length
}

async function exportMembersData(){
  if(!supabase)return
  const {data,error}=await supabase.from('profiles').select('full_name,display_name,email,class_name,generation,group_name,phone,address,role,membership_status,joined_at,created_at').order('created_at',{ascending:false})
  if(error)throw error
  const rows=(data||[]).map((x:any)=>({...x,role:roleLabels[x.role]||x.role,joined_at:x.joined_at?new Date(x.joined_at).toLocaleDateString('id-ID'):'',created_at:x.created_at?new Date(x.created_at).toLocaleString('id-ID'):''}))
  const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows); ws['!cols']=Object.keys(rows[0]||{}).map(k=>({wch:Math.min(Math.max(String(k).length+4,16),42)})); XLSX.utils.book_append_sheet(wb,ws,'Anggota'); XLSX.writeFile(wb,`kiwantika-anggota-${new Date().toISOString().slice(0,10)}.xlsx`)
  return rows.length
}

export function AdminDashboard() {
  const [counts, setCounts] = useState({ members: 0, forms: 0, submissions: 0, articles: 0, events: 0, albums: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<'registration'|'members'|null>(null)
  const [loading, setLoading] = useState(true)
  const exportFile = async (kind:'registration'|'members') => { try { setExporting(kind); const count = kind==='registration' ? await exportRegistrationData() : await exportMembersData(); setError(`${count ?? 0} data berhasil diekspor ke Excel.`) } catch(e) { setError(e instanceof Error ? e.message : 'Export Excel gagal.') } finally { setExporting(null) } } 

  const load = async () => {
    if (!supabase) return
    const [p, f, s, a, e, g] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('forms').select('id', { count: 'exact', head: true }),
      supabase.from('form_submissions').select('id,submission_number,status,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
      supabase.from('articles').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('albums').select('id', { count: 'exact', head: true })
    ])
    const firstError = [p, f, s, a, e, g].find(x => x.error)?.error
    if (firstError) setError(firstError.message)
    setCounts({ members: p.count || 0, forms: f.count || 0, submissions: s.count || 0, articles: a.count || 0, events: e.count || 0, albums: g.count || 0 })
    setRecent(s.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (!hasSupabase) return <div className="wrap page-pad"><Notice>Supabase belum dikonfigurasi.</Notice></div>

  return <div className="wrap page-pad">
    <div className="admin-heading"><div><span className="eyebrow">Management</span><h1>KIWANTIKA Admin</h1><p className="lead">Satu panel untuk mengelola publikasi, kegiatan, galeri, anggota, formulir, dan absensi.</p></div><div className="admin-heading-actions"><button className="btn secondary" disabled={!!exporting} onClick={()=>exportFile('registration')}><Download size={16}/>{exporting==='registration'?'Menyiapkan…':'Download pendaftar'}</button><button className="btn secondary" disabled={!!exporting} onClick={()=>exportFile('members')}><Download size={16}/>{exporting==='members'?'Menyiapkan…':'Download anggota'}</button><Link className="btn primary" to="/admin/berita/baru"><Plus size={17}/> Tulis cerita</Link></div></div>
    {error && <Notice error>{error}</Notice>}
    <OperationsOverview />
    {loading ? <StatGridSkeleton /> : <div className="stat-grid six">
      <Stat icon={<Users/>} label="Anggota" value={counts.members}/>
      <Stat icon={<FileText/>} label="Formulir" value={counts.forms}/>
      <Stat icon={<CheckCircle2/>} label="Submission" value={counts.submissions}/>
      <Stat icon={<Newspaper/>} label="Artikel" value={counts.articles}/>
      <Stat icon={<CalendarDays/>} label="Kegiatan" value={counts.events}/>
      <Stat icon={<Images/>} label="Galeri" value={counts.albums}/>
    </div>}
    <div className="dashboard-grid">
      <Panel title="Submission terbaru">{loading?<TableSkeleton rows={4} cols={3}/>:<div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Status</th><th>Waktu</th></tr></thead><tbody>{recent.map(x => <tr key={x.id}><td>{x.submission_number}</td><td><span className={`status ${x.status}`}>{x.status}</span></td><td>{new Date(x.created_at).toLocaleString('id-ID')}</td></tr>)}{!recent.length && <tr><td colSpan={3}>Belum ada submission.</td></tr>}</tbody></table></div>}</Panel>
      <Panel title="Kelola"><div className="admin-links">
        <Link to="/admin/berita"><Newspaper/> Berita & cerita</Link>
        <Link to="/admin/kegiatan"><CalendarDays/> Kegiatan & agenda</Link>
        <Link to="/admin/galeri"><Images/> Galeri & dokumentasi</Link>
        <Link to="/admin/absensi"><CalendarDays/> QR Absensi</Link>
        <Link to="/admin/izin"><MailQuestion/> Izin & sakit</Link>
        <Link to="/admin/kas"><Wallet/> Kas & iuran</Link>
        <Link to="/admin/rekap"><ClipboardCheck/> Rekap kehadiran</Link>
        <Link to="/admin/anggota"><Users/> Anggota & pengurus</Link>
        <Link to="/admin/formulir"><FileText/> Formulir & pendaftaran</Link>
      </div></Panel>
    </div>
    <div className="admin-role-note"><Shield size={18}/><div><strong>Akses pengelola</strong><span>Super Admin, Admin, Pembina, dan Dewan dapat mengelola konten melalui panel ini. Keamanan database tetap dikunci oleh RLS Supabase.</span></div></div>
  </div>
}


function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <article className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>data tersimpan</small></div></article>
}

export function AdminListPage({ kind }: { kind: 'anggota' | 'formulir' | 'berita' | 'kegiatan' | 'galeri' }) {
  if (kind === 'berita') return <ArticleManager />
  if (kind === 'kegiatan') return <EventManager />
  if (kind === 'galeri') return <GalleryManager />
  if (kind === 'anggota') return <MemberManager />
  return <BasicListPage kind={kind}/>
}

function BasicListPage({ kind }: { kind: 'formulir' }) {
  const [rows,setRows]=useState<any[]>([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{(async()=>{if(!supabase)return;const {data}=await supabase.from('forms').select('id,title,slug,status,opens_at,closes_at,created_at').order('created_at',{ascending:false}).limit(100);setRows(data||[]);setLoading(false)})()},[])
  return <div className="wrap page-pad"><Link className="back-link" to="/admin">← Admin</Link><span className="eyebrow">Management</span><h1>Formulir & pendaftaran</h1><Panel title={`${rows.length} formulir`} action={<Link className="btn secondary" to="/admin/formulir/baru"><Plus size={16}/> Formulir baru</Link>}>{loading?<TableSkeleton rows={4} cols={4}/>:<div className="table-wrap"><table><thead><tr><th>Nama/Judul</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.title}</td><td><span className={`status ${r.status}`}>{r.status}</span></td><td>{new Date(r.created_at).toLocaleDateString('id-ID')}</td><td><Link className="text-button" to={`/admin/formulir/${r.id}`}>Kelola</Link></td></tr>)}{!rows.length&&<tr><td colSpan={4}>Belum ada formulir.</td></tr>}</tbody></table></div>}</Panel></div>
}

export function MemberManager(){
  const {profile}=useAuth(); const isSuperAdmin=profile?.role==='super_admin';
  const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[query,setQuery]=useState(''),[role,setRole]=useState('all'),[editing,setEditing]=useState<any|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const load=async()=>{if(!supabase)return;setLoading(true);const {data, error:loadError}=await supabase.from('profiles').select('id,full_name,display_name,email,role,membership_status,class_name,generation,group_name,phone,address,joined_at,created_at').order('created_at',{ascending:false});if(loadError)setError(loadError.message);setRows(data||[]);setLoading(false)}
  useEffect(()=>{load()},[])
  const filtered=rows.filter(r=>{const q=query.toLowerCase().trim();const match=!q||([r.full_name,r.display_name,r.email,r.class_name,r.group_name] as Array<string|null|undefined>).some(v=>typeof v==='string'&&v.toLowerCase().includes(q));return match&&(role==='all'||r.role===role)})
  const openEdit=(row:any)=>{setEditing({...row});setMessage('');setError('');window.scrollTo({top:0,behavior:'smooth'})}
  const save=async(e:FormEvent)=>{e.preventDefault();if(!supabase||!editing)return;setSaving(true);setError('');setMessage('');const payload={full_name:editing.full_name?.trim(),display_name:editing.display_name?.trim()||null,class_name:editing.class_name?.trim()||null,generation:editing.generation?.trim()||null,group_name:editing.group_name?.trim()||null,phone:editing.phone?.trim()||null,address:editing.address?.trim()||null,role:editing.role,membership_status:editing.membership_status,joined_at:editing.joined_at||null};const {error:saveError}=await supabase.from('profiles').update(payload).eq('id',editing.id);if(saveError)setError(saveError.message);else{setMessage('Data anggota berhasil diperbarui.');setEditing(null);await load()}setSaving(false)}
  return <div className="wrap page-pad"><Link className="back-link" to="/admin">← Admin</Link><div className="admin-heading"><div><span className="eyebrow">Administrasi anggota</span><h1>Anggota & pengurus</h1><p className="lead">Kelola data anggota, status keanggotaan, dan pembagian role KIWANTIKA.</p></div><button className="btn secondary" onClick={async()=>{try{await exportMembersData();setMessage('Data anggota berhasil diunduh sebagai Excel.')}catch(e){setError(e instanceof Error?e.message:'Export gagal.')}}}><Download size={16}/> Download Excel</button></div>{message&&<Notice>{message}</Notice>}{error&&<Notice error>{error}</Notice>}{editing&&<form className="form-shell admin-member-editor" onSubmit={save}><div className="panel-head"><div><h3>Edit data anggota</h3><span>{editing.email||'Akun KIWANTIKA'}</span></div><button type="button" className="btn secondary" onClick={()=>setEditing(null)}>Batal</button></div><div className="two-col"><label className="field"><span>Nama lengkap</span><input required value={editing.full_name||''} onChange={e=>setEditing({...editing,full_name:e.target.value})}/></label><label className="field"><span>Nama panggilan</span><input value={editing.display_name||''} onChange={e=>setEditing({...editing,display_name:e.target.value})}/></label></div><div className="two-col"><label className="field"><span>Kelas</span><input value={editing.class_name||''} onChange={e=>setEditing({...editing,class_name:e.target.value})}/></label><label className="field"><span>Angkatan</span><input value={editing.generation||''} onChange={e=>setEditing({...editing,generation:e.target.value})}/></label></div><div className="two-col"><label className="field"><span>Regu / sangga</span><input value={editing.group_name||''} onChange={e=>setEditing({...editing,group_name:e.target.value})}/></label><label className="field"><span>Nomor HP</span><input value={editing.phone||''} onChange={e=>setEditing({...editing,phone:e.target.value})}/></label></div><label className="field"><span>Alamat</span><textarea value={editing.address||''} onChange={e=>setEditing({...editing,address:e.target.value})}/></label><div className="two-col"><label className="field"><span>Status keanggotaan</span><select value={editing.membership_status} onChange={e=>setEditing({...editing,membership_status:e.target.value})}><option value="candidate">Candidate</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="alumni">Alumni</option><option value="suspended">Suspended</option></select></label>{isSuperAdmin?<label className="field"><span>Role</span><select value={editing.role} onChange={e=>setEditing({...editing,role:e.target.value})}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:<div className="field"><span>Role</span><div className="readonly-field">{roleLabels[editing.role]||editing.role}</div><small>Hanya Super Admin yang dapat mengubah role.</small></div>}</div><div className="form-actions"><button className="btn primary" disabled={saving}>{saving?'Menyimpan…':'Simpan perubahan'}</button></div></form>}<Panel title={`${filtered.length} anggota`} action={<div className="member-filters"><label className="search-field"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari nama, email, kelas…"/></label><select value={role} onChange={e=>setRole(e.target.value)}><option value="all">Semua role</option>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>}>{loading?<TableSkeleton rows={6} cols={5}/>:<div className="table-wrap"><table><thead><tr><th>Anggota</th><th>Kelas</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><strong>{r.full_name||'Tanpa nama'}</strong><small>{r.email||'—'}</small></td><td>{r.class_name||'—'}</td><td><span className="status neutral">{roleLabels[r.role]||r.role}</span></td><td>{r.membership_status}</td><td><button className="text-button" onClick={()=>openEdit(r)}>{isSuperAdmin?'Edit data':'Lihat / edit data'}</button></td></tr>)}{!filtered.length&&<tr><td colSpan={5}>Tidak ada anggota yang cocok.</td></tr>}</tbody></table></div>}</Panel></div>
}

function ArticleManager() {
  const empty = { id: '', title: '', slug: '', excerpt: '', content: '', category: 'cerita', status: 'draft', published_at: '' , cover_path: '' }
  const [rows, setRows] = useState<any[]>([]), [form, setForm] = useState(empty), [file, setFile] = useState<File | null>(null), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const {ask,dialog}=useConfirm()
  const [loading,setLoading]=useState(true)
  const load = async () => { if (!supabase) return; const { data } = await supabase.from('articles').select('id,title,slug,excerpt,content,category,status,published_at,cover_path,created_at').order('created_at',{ascending:false}); setRows(data || []);setLoading(false) }
  useEffect(() => { load() }, [])
  const reset = () => { setForm(empty); setFile(null); setMessage(''); setError('') }
  const edit = (row:any) => { setForm({ ...empty, ...row, published_at: row.published_at ? new Date(row.published_at).toISOString().slice(0,16) : '' }); setFile(null); window.scrollTo({top:0,behavior:'smooth'}) }
  const save = async (e: FormEvent) => { e.preventDefault(); if (!supabase) return; setSaving(true); setError(''); setMessage('')
    try {
      let cover = form.cover_path || null
      if (file) { const ext = file.name.split('.').pop() || 'jpg'; const path = `articles/${crypto.randomUUID()}.${ext}`; const up = await supabase.storage.from('public-media').upload(path,file,{upsert:false,contentType:file.type}); if (up.error) throw up.error; cover = path }
      const payload = { title: form.title.trim(), slug: form.slug.trim() || slugify(form.title), excerpt: form.excerpt.trim() || null, content: form.content, category: form.category.trim() || 'cerita', status: form.status, published_at: form.status === 'published' ? (form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString()) : null, cover_path: cover }
      const result = form.id ? await supabase.from('articles').update(payload).eq('id',form.id) : await supabase.from('articles').insert(payload)
      if (result.error) throw result.error
      setMessage(form.id ? 'Artikel diperbarui.' : 'Artikel diterbitkan sebagai draft.'); reset(); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan artikel.') } finally { setSaving(false) }
  }
  const remove = async (id:string) => { if (!supabase || !(await ask('Artikel yang dihapus tidak dapat dikembalikan.'))) return; const { error:e } = await supabase.from('articles').delete().eq('id',id); if (e) setError(e.message); else load() }
  return <div className="wrap page-pad">{dialog}<Link className="back-link" to="/admin">← Admin</Link><div className="admin-heading"><div><span className="eyebrow">Publikasi</span><h1>Berita & cerita</h1><p className="lead">Tulis berita, catatan perjalanan, cerita ambalan, atau dokumentasi kegiatan. Konten yang dipublikasikan langsung muncul di website.</p></div></div>{message&&<Notice>{message}</Notice>}{error&&<Notice error>{error}</Notice>}
    <div className="two-col admin-editor-grid"><form className="form-shell builder-form" onSubmit={save}><div className="panel-head"><h3>{form.id ? 'Edit cerita' : 'Cerita baru'}</h3>{form.id&&<button type="button" className="text-button" onClick={reset}><X size={15}/> Batal</button>}</div><label className="field"><span>Judul</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label className="field"><span>Slug</span><input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="otomatis-dari-judul"/></label><div className="two-col"><label className="field"><span>Kategori</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label className="field"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Publikasikan</option><option value="archived">Arsip</option></select></label></div><label className="field"><span>Ringkasan</span><textarea value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})} placeholder="Ringkasan singkat untuk kartu berita…"/></label><label className="field"><span>Isi cerita</span><textarea className="editor-textarea" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Tulis cerita di sini…" required/></label><label className="field"><span>Gambar sampul</span><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0] || null)}/><small>{file ? file.name : form.cover_path ? 'Gambar saat ini tersimpan.' : 'JPG, PNG, WebP.'}</small></label><div className="form-actions"><button className="btn primary" disabled={saving}><Save size={16}/>{saving?'Menyimpan…':form.id?'Simpan perubahan':'Simpan cerita'}</button><button type="button" className="btn secondary" onClick={reset}>Reset</button></div></form>
      <Panel title="Konten tersimpan">{loading?<ContentListSkeleton/>:<div className="content-list">{rows.map(r=><article className="content-row" key={r.id}>{r.cover_path?<img src={publicMediaUrl(r.cover_path)} alt=""/>:<div className="content-thumb"><Newspaper/></div>}<div className="content-main"><strong>{r.title}</strong><span>{r.category} · {r.status}</span><small>{new Date(r.created_at).toLocaleString('id-ID')}</small></div><div className="row-actions"><button title="Edit" onClick={()=>edit(r)}><Pencil size={16}/></button><button title="Hapus" onClick={()=>remove(r.id)}><Trash2 size={16}/></button></div></article>)}{!rows.length&&<div className="empty">Belum ada cerita.</div>}</div>}</Panel>
    </div></div>
}

function EventManager() {
  const empty={id:'',title:'',slug:'',description:'',event_type:'kegiatan',visibility:'public',start_at:'',end_at:'',location:'',status:'draft',cover_path:''}
  const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState(empty),[file,setFile]=useState<File|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const {ask,dialog}=useConfirm()
  const [loading,setLoading]=useState(true)
  const load=async()=>{if(!supabase)return;const {data}=await supabase.from('events').select('id,title,slug,description,event_type,visibility,start_at,end_at,location,status,cover_path,created_at').order('start_at',{ascending:false});setRows(data||[]);setLoading(false)}
  useEffect(()=>{load()},[])
  const reset=()=>{setForm(empty);setFile(null)}
  const edit=(r:any)=>{setForm({...empty,...r,start_at:r.start_at?new Date(r.start_at).toISOString().slice(0,16):'',end_at:r.end_at?new Date(r.end_at).toISOString().slice(0,16):''});setFile(null);window.scrollTo({top:0,behavior:'smooth'})}
  const save=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setSaving(true);setError('');setMessage('');try{let cover=form.cover_path||null;if(file){const ext=file.name.split('.').pop()||'jpg';const path=`events/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('event-media').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;cover=path}const payload={title:form.title.trim(),slug:form.slug.trim()||slugify(form.title),description:form.description.trim()||null,event_type:form.event_type.trim()||'kegiatan',visibility:form.visibility,status:form.status,start_at:new Date(form.start_at).toISOString(),end_at:form.end_at?new Date(form.end_at).toISOString():null,location:form.location.trim()||null,cover_path:cover};const result=form.id?await supabase.from('events').update(payload).eq('id',form.id):await supabase.from('events').insert({...payload});if(result.error)throw result.error;setMessage(form.id?'Kegiatan diperbarui.':'Kegiatan berhasil disimpan.');reset();await load()}catch(err){setError(err instanceof Error?err.message:'Gagal menyimpan kegiatan.')}finally{setSaving(false)}}
  const remove=async(id:string)=>{if(!supabase||!(await ask('Kegiatan yang dihapus tidak dapat dikembalikan.')))return;const {error:e}=await supabase.from('events').delete().eq('id',id);if(e)setError(e.message);else load()}
  return <div className="wrap page-pad">{dialog}<Link className="back-link" to="/admin">← Admin</Link><div className="admin-heading"><div><span className="eyebrow">Agenda</span><h1>Kegiatan</h1><p className="lead">Kelola agenda latihan, rapat, perkemahan, lomba, dan kegiatan KIWANTIKA.</p></div><Link className="btn secondary" to="/admin/absensi"><CalendarDays size={16}/> Buat absensi</Link></div>{message&&<Notice>{message}</Notice>}{error&&<Notice error>{error}</Notice>}<div className="two-col admin-editor-grid"><form className="form-shell builder-form" onSubmit={save}><div className="panel-head"><h3>{form.id?'Edit kegiatan':'Kegiatan baru'}</h3></div><label className="field"><span>Nama kegiatan</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label className="field"><span>Slug</span><input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label><div className="two-col"><label className="field"><span>Mulai</span><input type="datetime-local" value={form.start_at} onChange={e=>setForm({...form,start_at:e.target.value})} required/></label><label className="field"><span>Selesai</span><input type="datetime-local" value={form.end_at} onChange={e=>setForm({...form,end_at:e.target.value})}/></label></div><label className="field"><span>Lokasi</span><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><div className="two-col"><label className="field"><span>Visibilitas</span><select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value})}><option value="public">Publik</option><option value="members">Anggota</option><option value="management">Pengurus</option></select></label><label className="field"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Publikasikan</option><option value="archived">Arsip</option></select></label></div><label className="field"><span>Deskripsi</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="field"><span>Poster / gambar kegiatan</span><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><div className="form-actions"><button className="btn primary" disabled={saving}><Save size={16}/>{saving?'Menyimpan…':form.id?'Simpan perubahan':'Simpan kegiatan'}</button><button type="button" className="btn secondary" onClick={reset}>Reset</button></div></form><Panel title="Agenda tersimpan">{loading?<ContentListSkeleton/>:<div className="content-list">{rows.map(r=><article className="content-row" key={r.id}>{r.cover_path?<img src={eventMediaUrl(r.cover_path)} alt=""/>:<div className="content-thumb"><CalendarDays/></div>}<div className="content-main"><strong>{r.title}</strong><span>{new Date(r.start_at).toLocaleString('id-ID')} · {r.status}</span><small>{r.location||'Lokasi belum ditentukan'}</small></div><div className="row-actions"><Link className="btn small secondary" to={`/admin/rekap/${r.id}`}>Absensi</Link><button onClick={()=>edit(r)}><Pencil size={16}/></button><button onClick={()=>remove(r.id)}><Trash2 size={16}/></button></div></article>)}{!rows.length&&<div className="empty">Belum ada kegiatan.</div>}</div>}</Panel></div></div>
}

function GalleryManager(){
  const empty={id:'',title:'',slug:'',description:'',event_id:'',cover_path:''}
  const [rows,setRows]=useState<any[]>([]),[form,setForm]=useState(empty),[files,setFiles]=useState<File[]>([]),[photos,setPhotos]=useState<any[]>([]),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const {ask,dialog}=useConfirm()
  const [loading,setLoading]=useState(true)
  const load=async()=>{if(!supabase)return;const {data}=await supabase.from('albums').select('id,title,slug,description,event_id,cover_path,created_at').order('created_at',{ascending:false});setRows(data||[]);setLoading(false)}
  useEffect(()=>{load()},[])
  const edit=async(r:any)=>{setForm({...empty,...r});setFiles([]);const {data}=await supabase!.from('photos').select('id,storage_path,caption,created_at').eq('album_id',r.id).order('created_at',{ascending:false});setPhotos(data||[]);window.scrollTo({top:0,behavior:'smooth'})}
  const reset=()=>{setForm(empty);setFiles([]);setPhotos([])}
  const save=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setSaving(true);setError('');setMessage('');try{let cover=form.cover_path||null; if(files[0]){const ext=files[0].name.split('.').pop()||'jpg';const path=`gallery/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('event-media').upload(path,files[0],{upsert:false,contentType:files[0].type});if(up.error)throw up.error;cover=path}const payload={title:form.title.trim(),slug:form.slug.trim()||slugify(form.title),description:form.description.trim()||null,event_id:form.event_id||null,cover_path:cover};const result=form.id?await supabase.from('albums').update(payload).eq('id',form.id):await supabase.from('albums').insert(payload).select().single();if(result.error)throw result.error;const albumId=form.id||result.data.id;for(const file of files.slice(form.id?0:1)){const ext=file.name.split('.').pop()||'jpg';const path=`gallery/${albumId}/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('event-media').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;const ins=await supabase.from('photos').insert({album_id:albumId,storage_path:path});if(ins.error)throw ins.error}setMessage(form.id?'Galeri diperbarui.':'Galeri dibuat.');reset();await load()}catch(err){setError(err instanceof Error?err.message:'Gagal menyimpan galeri.')}finally{setSaving(false)}}
  const remove=async(id:string)=>{if(!supabase||!(await ask('Album beserta seluruh foto di dalamnya akan dihapus dari database.')))return;const {error:e}=await supabase.from('albums').delete().eq('id',id);if(e)setError(e.message);else load()}
  const removePhoto=async(p:any)=>{if(!supabase)return;const {error:e}=await supabase.from('photos').delete().eq('id',p.id);if(e)setError(e.message);else setPhotos(v=>v.filter(x=>x.id!==p.id))}
  return <div className="wrap page-pad">{dialog}<Link className="back-link" to="/admin">← Admin</Link><div className="admin-heading"><div><span className="eyebrow">Dokumentasi</span><h1>Galeri</h1><p className="lead">Buat album dan unggah dokumentasi foto kegiatan KIWANTIKA.</p></div><label className="btn secondary upload-trigger"><ImagePlus size={16}/> Pilih foto<input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label></div>{message&&<Notice>{message}</Notice>}{error&&<Notice error>{error}</Notice>}<div className="two-col admin-editor-grid"><form className="form-shell builder-form" onSubmit={save}><div className="panel-head"><h3>{form.id?'Edit album':'Album baru'}</h3></div><label className="field"><span>Nama album</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label className="field"><span>Slug</span><input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label><label className="field"><span>Deskripsi</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="field"><span>Cover album</span><input type="file" accept="image/*" onChange={e=>setFiles(v=>{const next=Array.from(e.target.files||[]);return next.length?[next[0],...v]:v})}/></label><div className="selected-files">{files.length?<><strong>{files.length} foto dipilih</strong><span>{files.map(f=>f.name).join(', ')}</span></>:<span>Belum ada foto baru.</span>}</div><div className="form-actions"><button className="btn primary" disabled={saving}><Upload size={16}/>{saving?'Mengunggah…':form.id?'Simpan album':'Buat album & unggah'}</button><button type="button" className="btn secondary" onClick={reset}>Reset</button></div>{form.id&&photos.length>0&&<div className="photo-manage"><strong>Foto dalam album</strong><div className="photo-mini-grid">{photos.map(p=><div key={p.id}><img src={eventMediaUrl(p.storage_path)} alt=""/><button type="button" onClick={()=>removePhoto(p)}><Trash2 size={14}/></button></div>)}</div></div>}</form><Panel title="Album tersimpan">{loading?<ContentListSkeleton/>:<div className="content-list">{rows.map(r=><article className="content-row" key={r.id}>{r.cover_path?<img src={eventMediaUrl(r.cover_path)} alt=""/>:<div className="content-thumb"><Images/></div>}<div className="content-main"><strong>{r.title}</strong><span>{r.slug}</span><small>{new Date(r.created_at).toLocaleString('id-ID')}</small></div><div className="row-actions"><button onClick={()=>edit(r)}><Pencil size={16}/></button><button onClick={()=>remove(r.id)}><Trash2 size={16}/></button></div></article>)}{!rows.length&&<div className="empty">Belum ada album.</div>}</div>}</Panel></div></div>
}

function slugify(value:string){return value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function publicMediaUrl(path:string){return supabase?.storage.from('public-media').getPublicUrl(path).data.publicUrl || ''}
function eventMediaUrl(path:string){return supabase?.storage.from('event-media').getPublicUrl(path).data.publicUrl || ''}
