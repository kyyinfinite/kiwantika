import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Images, Eye, EyeOff, LogIn, MapPin, Newspaper, Share2, Shield, UserRound, X } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import { supabase, hasSupabase } from '../../lib/supabase'
import type { Article, Event } from '../../lib/types'
import { useAuth } from '../auth/AuthProvider'
import { GoogleSignInButton } from '../auth/GoogleSignInButton'
import { gsap, motionDuration, motionEase, prefersReducedMotion } from '../../lib/motion'
import { Reveal, Stagger } from '../../components/motion/Reveal'
import { useQuery } from '../../lib/useQuery'
import { EmptyState, ErrorState } from '../../components/feedback'
import { ArticleSkeleton, EventListSkeleton, GallerySkeleton, HomeEventSkeleton, HomeGallerySkeleton, HomeNewsSkeleton, NewsGridSkeleton } from '../../components/Skeleton'

const SAMPLE_IMAGE = '/media/kiwantika-hero.jpg'

function Section({eyebrow,title,children,action,lead,page}:{eyebrow?:string,title:string,children:ReactNode,action?:ReactNode,lead?:string,page?:boolean}){
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current!.querySelector('.section-head'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .65, ease: motionEase, scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true } })
    }, ref)
    return () => ctx.revert()
  }, [])
  return <section ref={ref} className={page?'section page-section':'section'}><div className="wrap"><div className="section-head"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{lead&&<p className="section-lead">{lead}</p>}</div>{action}</div>{children}</div></section>
}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

function useHomeContent(){
  const [events, setEvents] = useState<Event[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [gallery, setGallery] = useState<any[]>([])
  const [loading, setLoading] = useState(hasSupabase)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    Promise.all([
      client.from('events').select('id,title,slug,description,event_type,visibility,start_at,end_at,location,cover_path').eq('status','published').gte('start_at',new Date(Date.now()-3*3600*1000).toISOString()).order('start_at').limit(3),
      client.from('articles').select('id,title,slug,excerpt,content,cover_path,category,published_at').eq('status','published').order('published_at',{ascending:false}).limit(3),
      client.from('albums').select('id,title,slug,description,cover_path,created_at,photos(id,storage_path,caption,created_at)').order('created_at',{ascending:false}).limit(1),
    ]).then(([eventsResult, articlesResult, galleryResult]) => {
      if (!active) return
      if (eventsResult.data?.length) setEvents(eventsResult.data as Event[])
      if (articlesResult.data?.length) setArticles(articlesResult.data as Article[])
      if (galleryResult.data?.length) setGallery(galleryResult.data)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { events, articles, gallery, loading }
}

function Hero(){
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref)
      const tl = gsap.timeline({ defaults: { ease: motionEase } })
      tl.fromTo(q('.hero-photo'), { scale: 1.07, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.25, ease: 'power2.out' })
        .fromTo(q('.hero-shade'), { autoAlpha: 0 }, { autoAlpha: 1, duration: .8 }, '-=.9')
        .fromTo(q('.hero-copy > *'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .65, stagger: .08 }, '-=.5')
        .fromTo(q('.hero-signature'), { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: .7 }, '-=.35')
    }, ref)
    return () => ctx.revert()
  }, [])

  return <section ref={ref} className="hero hero-editorial">
    <div className="hero-photo" aria-hidden="true" />
    <div className="hero-shade" aria-hidden="true" />
    <div className="hero-golden-arc" aria-hidden="true" />
    <img className="hero-float-mark one" src="/media/kiwantika-logo.png" alt="" aria-hidden="true" />
    <img className="hero-float-mark two" src="/media/kiwantika-logo.png" alt="" aria-hidden="true" />
    <img className="hero-float-mark three" src="/media/kiwantika-logo.png" alt="" aria-hidden="true" />
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
    <a className="hero-scroll-cue" href="#home-agenda" aria-label="Scroll ke agenda">
      <span className="hero-scroll-mouse" aria-hidden="true" />
      <span>Scroll untuk menjelajah</span>
    </a>
  </section>
}

function HomeEventPreview({events,loading}:{events:Event[],loading:boolean}){
  if(loading) return <section id="home-agenda"><Section eyebrow="Agenda" title="Kegiatan terdekat"><HomeEventSkeleton/></Section></section>
  const featured = events[0]
  if (!featured) return <section id="home-agenda"><Section eyebrow="Agenda" title="Kegiatan terdekat" action={<Link className="text-link" to="/kalender">Semua agenda <ChevronRight size={17}/></Link>}><Empty text="Belum ada agenda yang dipublikasikan." /></Section></section>
  const date = new Date(featured.start_at)
  const day = date.toLocaleDateString('id-ID',{day:'2-digit'})
  const month = date.toLocaleDateString('id-ID',{month:'short'}).replace('.', '')
  const year = date.getFullYear()
  const hasThumb = Boolean(featured.cover_path)
  return <section id="home-agenda"><Section eyebrow="Agenda" title="Kegiatan terdekat" action={<Link className="text-link" to="/kalender">Semua agenda <ChevronRight size={17}/></Link>}>
    <Reveal className={`event-preview ${hasThumb ? 'has-thumb' : 'no-thumb'}`}>
      {hasThumb ? <div className="event-preview-media"><img src={eventMediaUrl(featured.cover_path!)} alt={featured.title} onError={(e)=>{e.currentTarget.style.display='none'}} /></div> : <div className="event-preview-date" aria-label={`Tanggal ${day} ${month} ${year}`}><strong>{day}</strong><span>{month}</span><small>{year}</small></div>}
      <div className="event-preview-body">
        <div className="event-preview-kicker"><span>{featured.event_type || 'Kegiatan'}</span>{hasThumb && <time>{day} {month} {year}</time>}</div>
        <h3>{featured.title}</h3>
        <p>{featured.description || 'Agenda kegiatan KIWANTIKA akan tampil di sini.'}</p>
        <div className="event-preview-meta">{featured.location && <span>{featured.location}</span>}{featured.start_at && <span>{date.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} WIB</span>}</div>
        <Link className="text-link" to="/kalender">Lihat kalender <ChevronRight size={17}/></Link>
      </div>
    </Reveal>
  </Section></section>
}

function HomeNewsPreview({articles,loading}:{articles:Article[],loading:boolean}){
  return <Section eyebrow="Publikasi" title="Berita & cerita" action={<Link className="text-link" to="/berita">Semua berita <ChevronRight size={17}/></Link>}>
    {loading?<HomeNewsSkeleton/>:articles.length?<Stagger className="home-news-grid">
      {articles.slice(0,3).map((article, index)=>{
        const src=articleCover(article.cover_path)
        return <Link data-stagger-item className={index===0?'home-news-card featured':'home-news-card'} to={`/berita/${article.slug}`} key={article.id}>
          <div className={src?'home-news-image':'home-news-image is-empty'}><img src={src||'/media/kiwantika-logo.png'} alt="" loading="lazy" decoding="async" /></div>
          <div className="home-news-body"><span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt || 'Baca cerita KIWANTIKA.'}</p><small>{formatDate(article.published_at)}</small></div>
        </Link>
      })}
    </Stagger>:<EmptyState icon={<Newspaper size={22}/>} title="Belum ada berita" text="Berita dan cerita kegiatan akan tampil di sini setelah dipublikasikan." />}
  </Section>
}

function HomeGalleryPreview({gallery,loading}:{gallery:any[],loading:boolean}){
  const album=gallery[0]
  const photos:{storage_path:string}[]=album?.photos||[]
  const cover=album?.cover_path?eventMediaUrl(album.cover_path):photos[0]?eventMediaUrl(photos[0].storage_path):''
  return <Section eyebrow="Dokumentasi" title="Galeri KIWANTIKA" action={<Link className="text-link" to="/galeri">Buka galeri <ChevronRight size={17}/></Link>}>
    {loading?<HomeGallerySkeleton/>:album&&cover?<Reveal className="gallery-feature">
      <div className="gallery-feature-main"><img src={cover} alt={album.title} loading="lazy" decoding="async" /><div className="gallery-feature-caption"><span>Dokumentasi terbaru</span><strong>{album.title}</strong></div></div>
      {photos.length>0&&<div className="gallery-feature-side">{photos.slice(0,3).map(photo=><img key={photo.storage_path} src={eventMediaUrl(photo.storage_path)} alt="" loading="lazy" decoding="async" />)}</div>}
    </Reveal>:<EmptyState icon={<Images size={22}/>} title="Belum ada dokumentasi" text="Foto kegiatan akan tampil di sini setelah diunggah oleh pengurus." />}
  </Section>
}

export function HomePage(){
  const { events, articles, gallery, loading } = useHomeContent()
  return <>
    <Hero />
    <HomeEventPreview events={events} loading={loading} />
    <HomeNewsPreview articles={articles} loading={loading} />
    <HomeGalleryPreview gallery={gallery} loading={loading} />
    <HomeIdentity />
  </>
}

function HomeIdentity(){
 return <section className="home-identity"><div className="wrap home-identity-grid"><Reveal className="home-identity-copy"><span className="eyebrow">KIWANTIKA</span><h2>Satu ruang untuk ambalan.</h2><p>Informasi kegiatan, keanggotaan, dan administrasi tersusun dalam satu platform.</p><Link className="text-link" to="/tentang">Kenali KIWANTIKA <ChevronRight size={17}/></Link></Reveal><Reveal className="home-identity-mark" delay={.12}><img src="/media/kiwantika-logo.png" alt="Lambang KIWANTIKA" onError={(event)=>{event.currentTarget.style.display='none'}}/></Reveal></div></section>
}

const aboutValues = [
  { no: '01', title: 'Bersatu', text: 'Membangun kebersamaan sebagai satu ambalan, dengan ruang untuk belajar dan tumbuh bersama.' },
  { no: '02', title: 'Berpadu', text: 'Menyatukan gagasan, tenaga, dan peran putra-putri dalam setiap proses organisasi.' },
  { no: '03', title: 'Bermutu', text: 'Menjaga kualitas sikap, kegiatan, dan pengabdian agar memberi arti bagi lingkungan.' },
]

export function AboutPage(){
  const pageRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!pageRef.current || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(pageRef)
      const intro = gsap.timeline({ defaults: { ease: motionEase } })
      intro
        .fromTo(q('.about-kicker'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .45 })
        .fromTo(q('.about-title'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .72 }, '-=.2')
        .fromTo(q('.about-lead'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .52 }, '-=.34')
        .fromTo(q('.about-meta'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .45 }, '-=.26')
        .fromTo(q('.about-coming-card'), { autoAlpha: 0, y: 26, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .72 }, '-=.22')

      q('[data-about-reveal]').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 30 }, {
          autoAlpha: 1, y: 0, duration: .72, ease: motionEase,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        })
      })

      q('[data-about-stagger]').forEach((group) => {
        const items = group.querySelectorAll('[data-about-item]')
        gsap.fromTo(items, { autoAlpha: 0, y: 22 }, {
          autoAlpha: 1, y: 0, duration: .55, stagger: .1, ease: motionEase,
          scrollTrigger: { trigger: group, start: 'top 86%', once: true }
        })
      })

      gsap.to(q('.about-coming-mark'), {
        y: -7, duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true
      })
    }, pageRef)
    return () => ctx.revert()
  }, [])

  return <main ref={pageRef} className="about-page">
    <section className="about-hero about-hero-editorial about-coming-hero">
      <div className="about-hero-backdrop" aria-hidden="true"><img src={SAMPLE_IMAGE} alt="" /></div>
      <div className="wrap about-hero-editorial-inner">
        <div className="about-hero-copy">
          <span className="eyebrow about-kicker">TENTANG KIWANTIKA · PANGKALAN SMAN 10 GARUT</span>
          <h1 className="about-title">Orang-orang di balik <em>ambalan.</em></h1>
          <p className="about-lead">Halaman ini akan menjadi ruang untuk mengenal pembina dan Dewan Ambalan KIWANTIKA. Kami sedang menyiapkan dokumentasi dan profil pengurus agar setiap orang yang tampil di sini benar-benar berasal dari ambalan.</p>
          <div className="about-meta">
            <span><b>15.075</b><i>—</i><b>15.076</b><small>Gugus Depan</small></span>
            <span><b>SMAN 10 GARUT</b><small>Pangkalan</small></span>
          </div>
        </div>
        <div className="about-coming-card" aria-label="Kepengurusan KIWANTIKA segera hadir">
          <div className="about-coming-grid" aria-hidden="true"></div>
          <div className="about-coming-mark"><span>KI</span><span>HD</span><span>DS</span></div>
          <div className="about-coming-content">
            <span className="about-coming-overline">DEWAN AMBALAN · PROFIL</span>
            <h2>Coming<br/><em>soon.</em></h2>
            <p>Foto, nama, dan profil kepengurusan sedang dipersiapkan.</p>
            <div className="about-coming-line"><span></span><small>15.075 — 15.076</small></div>
          </div>
        </div>
      </div>
    </section>

    <section id="identitas" className="about-section about-identity" data-about-reveal>
      <div className="wrap about-two-col">
        <div><span className="eyebrow">Identitas</span><h2>Ki Hajar Dewantara<br/>Dewi Sartika</h2></div>
        <div className="about-copy"><p><strong>KIWANTIKA</strong> adalah Ambalan Ki Hajar Dewantara – Dewi Sartika di <strong>SMAN 10 Garut</strong>. Identitas ini menjadi pijakan untuk membangun ruang belajar, kepemimpinan, kebersamaan, dan pengabdian melalui kegiatan kepramukaan.</p><p><strong>Gugus Depan 15.075 – 15.076</strong> · Pangkalan SMAN 10 Garut.</p></div>
      </div>
    </section>

    <section className="about-section about-values" data-about-reveal>
      <div className="wrap">
        <div className="about-section-head"><div><span className="eyebrow">Nilai dasar</span><h2>Satu identitas, tiga arah.</h2></div><p>Bersatu, berpadu, dan bermutu menjadi benang merah dalam cara KIWANTIKA belajar dan bergerak.</p></div>
        <div className="about-values-grid" data-about-stagger>{aboutValues.map(item => <article className="about-value" data-about-item key={item.no}><span>{item.no}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </div>
    </section>

    <section className="about-section about-structure about-coming-structure" data-about-reveal>
      <div className="wrap">
        <div className="about-section-head"><div><span className="eyebrow">Kepengurusan</span><h2>Dewan Ambalan</h2></div><p>Profil pembina dan pengurus akan ditampilkan setelah dokumentasi resmi periode aktif KIWANTIKA siap digunakan.</p></div>
        <div className="about-coming-list" data-about-stagger>
          {['Pembina', 'Pradana', 'Judat', 'Krani', 'Juru Uang'].map((role, index) => <div className="about-coming-row" data-about-item key={role}><span>0{index + 1}</span><strong>{role}</strong><small>Putra · Putri</small><i>Segera hadir</i></div>)}
        </div>
      </div>
    </section>

    <section className="about-section about-journey" data-about-reveal>
      <div className="wrap about-journey-inner"><div><span className="eyebrow">Sementara</span><h2>Kami sedang menyiapkan ruang yang layak untuk mereka.</h2></div><div className="about-copy"><p>Daripada menggunakan foto contoh yang bukan bagian dari KIWANTIKA, halaman kepengurusan akan dibuka ketika dokumentasi asli sudah tersedia. Sambil menunggu, bagian lain dari sistem tetap dapat dikembangkan dan digunakan.</p><Link className="btn primary" to="/kalender">Lihat kegiatan <ChevronRight size={16}/></Link></div></div>
    </section>

    <section className="about-note" data-about-reveal><div className="wrap"><Shield size={19}/><p><strong>Status halaman.</strong> Kepengurusan ditandai <em>Coming Soon</em> sampai foto dan data Dewan Ambalan periode aktif tersedia.</p></div></section>
  </main>
}
const articleFields = 'id,title,slug,excerpt,content,cover_path,category,published_at'
const eventFields = 'id,title,slug,description,event_type,visibility,start_at,end_at,location,cover_path'

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')
}

function articleCover(path: string | null) {
  if (!path) return ''
  return path.startsWith('/') ? path : publicMediaUrl(path)
}

export function NewsPage({ detail = false }: { detail?: boolean }) {
  return detail ? <ArticleDetail /> : <ArticleList />
}

function ArticleCard({ article }: { article: Article }) {
  const src = articleCover(article.cover_path)
  return <Link className="article-card" to={`/berita/${article.slug}`}>
    <div className={src ? 'article-media' : 'article-media is-empty'}><img src={src || '/media/kiwantika-logo.png'} alt="" loading="lazy" decoding="async" /></div>
    <div className="article-meta"><span>{article.category}</span><time dateTime={article.published_at || undefined}>{formatDate(article.published_at)}</time></div>
    <h3>{article.title}</h3>
    <p>{article.excerpt || 'Baca cerita KIWANTIKA.'}</p>
  </Link>
}

function ArticleList() {
  const client = supabase
  const query = useQuery<Article[]>(client ? () => client.from('articles').select(articleFields).eq('status', 'published').order('published_at', { ascending: false }) : null)
  const items = query.data ?? []
  const [category, setCategory] = useState('semua')
  const categories = ['semua', ...Array.from(new Set(items.map(article => article.category).filter(Boolean)))]
  const shown = category === 'semua' ? items : items.filter(article => article.category === category)
  return <Section page eyebrow="Publikasi" title="Berita & cerita kegiatan" lead="Kabar, catatan lapangan, dan cerita dari keseharian KIWANTIKA.">
    {query.loading ? <NewsGridSkeleton />
      : query.error ? <ErrorState message={query.error} onRetry={query.reload} />
      : items.length ? <>
        {categories.length > 2 && <div className="permission-tabs" role="tablist" aria-label="Filter kategori">{categories.map(name => <button type="button" role="tab" aria-selected={category === name} className={category === name ? 'active' : ''} key={name} onClick={() => setCategory(name)}>{name === 'semua' ? 'Semua' : name}</button>)}</div>}
        <div className="article-grid">{shown.map(article => <ArticleCard key={article.id} article={article} />)}</div>
      </>
      : <EmptyState icon={<Newspaper size={22} />} title="Belum ada berita" text="Berita dan cerita kegiatan akan tampil di sini setelah dipublikasikan oleh pengurus." />}
  </Section>
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title, url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch { return }
  }
  return <button type="button" className="btn secondary" onClick={share}><Share2 size={15} />{copied ? 'Tautan disalin' : 'Bagikan'}</button>
}

function ArticleDetail() {
  const { slug = '' } = useParams()
  const client = supabase
  const query = useQuery<Article>(client ? () => client.from('articles').select(articleFields).eq('status', 'published').eq('slug', slug).maybeSingle() : null, [slug])
  const article = query.data ?? null

  useEffect(() => {
    if (!article) return
    document.title = `${article.title} — KIWANTIKA`
  }, [article])

  if (query.loading) return <section className="section article-page"><div className="wrap"><ArticleSkeleton /></div></section>
  if (query.error) return <Section page eyebrow="Berita" title="Berita KIWANTIKA"><ErrorState message={query.error} onRetry={query.reload} /></Section>
  if (!article) return <section className="section article-page"><div className="wrap"><EmptyState icon={<Newspaper size={22} />} title="Artikel tidak ditemukan" text="Artikel mungkin sudah dipindahkan atau belum dipublikasikan." action={<Link className="btn secondary" to="/berita">Lihat semua berita</Link>} /></div></section>

  const cover = articleCover(article.cover_path)
  const minutes = Math.max(1, Math.round(article.content.trim().split(/\s+/).length / 200))
  return <section className="section article-page"><div className="wrap">
    <Link className="text-link article-back" to="/berita"><ArrowLeft size={15} /> Semua berita</Link>
    <header className="article-head">
      <div className="article-byline"><span className="tag">{article.category}</span><time dateTime={article.published_at || undefined}>{formatDate(article.published_at)}</time><i /><span>{minutes} menit baca</span></div>
      <h1>{article.title}</h1>
    </header>
    <article className="article-detail">
      {cover && <img className="article-cover" src={cover} alt="" decoding="async" />}
      <div className="prose">
        {article.excerpt && <p className="article-excerpt">{article.excerpt}</p>}
        <div className="article-body">{article.content.split(/\n\s*\n/).map((part, index) => <p key={index}>{part}</p>)}</div>
      </div>
      <footer className="article-footer"><Link className="text-link" to="/berita"><ArrowLeft size={15} /> Kembali ke berita</Link><ShareButton title={article.title} /></footer>
    </article>
  </div></section>
}

function EventRow({ event, past = false }: { event: Event; past?: boolean }) {
  const start = new Date(event.start_at)
  return <article className={past ? 'event-row is-past' : 'event-row'}>
    <div className="date-box" aria-label={start.toLocaleDateString('id-ID', { dateStyle: 'long' })}><strong>{start.getDate()}</strong><span>{start.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '')}</span></div>
    <div className="event-body">
      <span className="eyebrow">{event.event_type}</span>
      <h3>{event.title}</h3>
      {event.description && <p className="event-desc">{event.description}</p>}
      <div className="event-chips">
        <span><Clock3 size={13} />{formatTime(event.start_at)}{event.end_at ? ` – ${formatTime(event.end_at)}` : ''} WIB</span>
        <span><MapPin size={13} />{event.location || 'Lokasi akan diumumkan'}</span>
      </div>
      {!past && <div className="event-actions"><Link className="btn small secondary" to={`/dashboard/izin?event=${event.id}`}>Tidak bisa hadir? Ajukan izin</Link></div>}
    </div>
  </article>
}

export function CalendarPage() {
  const client = supabase
  const query = useQuery<Event[]>(client ? () => client.from('events').select(eventFields).eq('status', 'published').order('start_at') : null)
  const events = query.data ?? []
  const now = Date.now()
  const endOf = (event: Event) => new Date(event.end_at || event.start_at).getTime()
  const upcoming = events.filter(event => endOf(event) >= now)
  const past = events.filter(event => endOf(event) < now).reverse()
  return <Section page eyebrow="Agenda" title="Kalender kegiatan" lead="Latihan, rapat, dan kegiatan ambalan yang sudah dijadwalkan.">
    {query.loading ? <EventListSkeleton />
      : query.error ? <ErrorState message={query.error} onRetry={query.reload} />
      : !events.length ? <EmptyState icon={<CalendarDays size={22} />} title="Belum ada agenda" text="Agenda kegiatan akan tampil di sini setelah dipublikasikan oleh pengurus." />
      : <>
        <div className="event-group"><h3 className="event-group-title">Akan datang <b>{upcoming.length}</b></h3>{upcoming.length ? <div className="event-list">{upcoming.map(event => <EventRow key={event.id} event={event} />)}</div> : <Empty text="Tidak ada agenda mendatang." />}</div>
        {past.length > 0 && <div className="event-group"><h3 className="event-group-title">Telah berlalu <b>{past.length}</b></h3><div className="event-list">{past.map(event => <EventRow key={event.id} event={event} past />)}</div></div>}
      </>}
  </Section>
}

type AlbumPhoto = { id: string; storage_path: string; caption: string | null }
type Album = { id: string; title: string; slug: string; description: string | null; cover_path: string | null; created_at: string; photos: AlbumPhoto[] | null }
type LightboxView = { photos: AlbumPhoto[]; index: number; title: string }

function Lightbox({ view, onClose, onMove }: { view: LightboxView; onClose: () => void; onMove: (step: number) => void }) {
  const photo = view.photos[view.index]
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onMove(1)
      if (event.key === 'ArrowLeft') onMove(-1)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [onClose, onMove])
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()
  return <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${view.title}`} onClick={onClose}>
    <div className="lightbox-bar" onClick={stop}><span>{view.index + 1} / {view.photos.length}</span><button type="button" autoFocus aria-label="Tutup" onClick={onClose}><X size={20} /></button></div>
    <div className="lightbox-stage">
      <img src={eventMediaUrl(photo.storage_path)} alt={photo.caption || view.title} onClick={stop} />
      {view.photos.length > 1 && <>
        <button type="button" className="lb-prev" aria-label="Foto sebelumnya" onClick={event => { stop(event); onMove(-1) }}><ChevronLeft size={22} /></button>
        <button type="button" className="lb-next" aria-label="Foto berikutnya" onClick={event => { stop(event); onMove(1) }}><ChevronRight size={22} /></button>
      </>}
    </div>
    <div className="lightbox-caption" onClick={stop}>{photo.caption || view.title}</div>
  </div>
}

export function GalleryPage() {
  const client = supabase
  const query = useQuery<Album[]>(client ? () => client.from('albums').select('id,title,slug,description,cover_path,created_at,photos(id,storage_path,caption,created_at)').order('created_at', { ascending: false }) : null)
  const albums = query.data ?? []
  const [view, setView] = useState<LightboxView | null>(null)
  const close = useCallback(() => setView(null), [])
  const move = useCallback((step: number) => setView(current => current ? { ...current, index: (current.index + step + current.photos.length) % current.photos.length } : current), [])
  return <Section page eyebrow="Dokumentasi" title="Galeri kegiatan" lead="Jejak kegiatan KIWANTIKA dalam foto.">
    {query.loading ? <GallerySkeleton />
      : query.error ? <ErrorState message={query.error} onRetry={query.reload} />
      : !albums.length ? <EmptyState icon={<Images size={22} />} title="Belum ada dokumentasi" text="Album foto kegiatan akan tampil di sini setelah diunggah oleh pengurus." />
      : <div className="public-gallery">{albums.map(album => {
        const photos = album.photos || []
        return <article className="gallery-album" key={album.id}>
          {album.cover_path ? <img className="gallery-cover" src={eventMediaUrl(album.cover_path)} alt={album.title} loading="lazy" decoding="async" /> : <div className="gallery-cover placeholder"><Images /></div>}
          <div className="gallery-album-body">
            <span className="eyebrow">Dokumentasi</span>
            <h3>{album.title}</h3>
            {album.description && <p>{album.description}</p>}
            {photos.length > 0 && <>
              <div className="gallery-photo-grid">{photos.map((photo, index) => <button type="button" key={photo.id} aria-label={`Buka foto ${index + 1} dari ${album.title}`} onClick={() => setView({ photos, index, title: album.title })}><img src={eventMediaUrl(photo.storage_path)} alt={photo.caption || album.title} loading="lazy" decoding="async" /></button>)}</div>
              <span className="gallery-count">{photos.length} foto</span>
            </>}
          </div>
        </article>
      })}</div>}
    {view && <Lightbox view={view} onClose={close} onMove={move} />}
  </Section>
}

export function RegistrationPage(){
 const [form,setForm]=useState({nama:'',kelas:'',alasan:'',nomor_hp:'',izin_orang_tua:false})
 const [submitting,setSubmitting]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[number,setNumber]=useState('')
 const [touched,setTouched]=useState<Record<string,boolean>>({})
 const errors:Record<string,string>={}
 if(form.nama.trim().length<3)errors.nama='Isi nama lengkap minimal 3 huruf.'
 if(!form.kelas.trim())errors.kelas='Kelas wajib diisi.'
 if(!isValidPhone(form.nomor_hp))errors.nomor_hp='Gunakan nomor HP Indonesia, contoh 081234567890.'
 const touch=(key:string)=>setTouched(v=>({...v,[key]:true}))
 const fieldError=(key:string)=>touched[key]&&errors[key]?<small className="field-error" role="alert">{errors[key]}</small>:null
 const submit=async(e:FormEvent)=>{
  e.preventDefault(); setError(''); setMessage('');
  const client = supabase
  if(!client){setError('Sistem pendaftaran belum terhubung ke Supabase.');return}
  if(Object.keys(errors).length){setTouched({nama:true,kelas:true,nomor_hp:true});setError('Periksa kembali data yang ditandai.');return}
  if(!form.izin_orang_tua){setError('Pastikan kamu sudah mendapatkan izin dari orang tua/wali.');return}
  setSubmitting(true)
  try{
   const {data:version,error:vError}=await client.from('form_versions').select('id,form_id').eq('version_number',1).eq('form_id', (await client.from('forms').select('id').eq('slug','pendaftaran-kiwantika').single()).data?.id||'').single()
   if(vError||!version) throw new Error('Formulir pendaftaran belum tersedia. Jalankan migration pendaftaran KIWANTIKA terlebih dahulu.')
   const submissionNumber=`KW-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`
   const answers={nama:form.nama.trim(),kelas:form.kelas.trim(),alasan:form.alasan.trim(),nomor_hp:normalizePhone(form.nomor_hp),izin_orang_tua:'Ya'}
   const {error:submitError}=await client.rpc('submit_form',{p_form_id:version.form_id,p_form_version_id:version.id,p_submission_number:submissionNumber,p_applicant_id:null,p_answers:answers})
   if(submitError) throw submitError
    setNumber(submissionNumber);setMessage('Pendaftaran berhasil dikirim.');setForm({nama:'',kelas:'',alasan:'',nomor_hp:'',izin_orang_tua:false})
  }catch(err){setError(err instanceof Error?err.message:'Pendaftaran gagal dikirim.')}finally{setSubmitting(false)}
 }
 if(number) return <section className="registration-page"><div className="wrap registration-success"><span className="eyebrow">Pendaftaran KIWANTIKA</span><div className="registration-success-mark"><CheckCircle2 size={28}/></div><h1>Pendaftaran<br/><em>terkirim.</em></h1><p>Terima kasih. Data kamu sudah diterima dan akan diperiksa oleh pengurus KIWANTIKA.</p><div className="registration-number"><small>Nomor pendaftaran</small><strong>{number}</strong></div><div className="registration-success-meta"><span>15.075 — 15.076</span><span>SMAN 10 GARUT</span></div><Link className="btn primary" to="/">Kembali ke beranda <ChevronRight size={17}/></Link></div></section>
 return <section className="registration-page"><div className="wrap registration-layout"><div className="registration-intro"><span className="eyebrow">Pendaftaran KIWANTIKA · 15.075 — 15.076</span><h1>Mulai langkahmu<br/><em>di ambalan.</em></h1><p>Isi data singkat berikut untuk mengajukan pendaftaran sebagai calon anggota KIWANTIKA di pangkalan SMAN 10 Garut.</p><div className="registration-note"><strong>Yang perlu disiapkan</strong><span>Nama lengkap, kelas, nomor HP aktif, dan persetujuan orang tua/wali.</span></div></div><form className="registration-form" onSubmit={submit}><div className="registration-form-head"><span>01 — DATA PENDAFTAR</span><small>Semua data digunakan untuk keperluan administrasi KIWANTIKA.</small></div><label className="field"><span>Nama lengkap <b>*</b></span><input autoComplete="name" value={form.nama} onChange={e=>setForm(v=>({...v,nama:e.target.value}))} placeholder="Nama sesuai identitas sekolah" onBlur={()=>touch('nama')} aria-invalid={Boolean(touched.nama&&errors.nama)} required/>{fieldError('nama')}</label><label className="field"><span>Kelas <b>*</b></span><input value={form.kelas} onChange={e=>setForm(v=>({...v,kelas:e.target.value}))} placeholder="Contoh: X-3" onBlur={()=>touch('kelas')} aria-invalid={Boolean(touched.kelas&&errors.kelas)} required/>{fieldError('kelas')}</label><label className="field"><span>Nomor HP <b>*</b></span><input inputMode="tel" autoComplete="tel" value={form.nomor_hp} onChange={e=>setForm(v=>({...v,nomor_hp:e.target.value}))} placeholder="08xxxxxxxxxx" onBlur={()=>touch('nomor_hp')} aria-invalid={Boolean(touched.nomor_hp&&errors.nomor_hp)} required/>{fieldError('nomor_hp')}</label><label className="field"><span>Alasan ingin bergabung <small>(opsional)</small></span><textarea value={form.alasan} onChange={e=>setForm(v=>({...v,alasan:e.target.value}))} placeholder="Ceritakan singkat alasanmu…" rows={4} maxLength={300}/><small className="field-count">{form.alasan.length}/300</small></label><label className="registration-consent"><input type="checkbox" checked={form.izin_orang_tua} onChange={e=>setForm(v=>({...v,izin_orang_tua:e.target.checked}))}/><span><strong>Sudah mendapat izin orang tua/wali.</strong><small>Dengan mencentang ini, kamu menyatakan bahwa pendaftaran diketahui dan diizinkan oleh orang tua/wali.</small></span></label>{error&&<div className="notice error"><Shield size={17}/><span>{error}</span></div>}{message&&<div className="notice"><CheckCircle2 size={17}/><span>{message}</span></div>}<button className="btn primary registration-submit" type="submit" disabled={submitting}>{submitting?'Mengirim pendaftaran…':'Kirim pendaftaran'} <ChevronRight size={17}/></button><p className="registration-footnote">Setelah dikirim, pengurus akan memeriksa data pendaftaran melalui panel administrasi.</p></form></div></section>
}
export function LoginPage(){
  const navigate=useNavigate(); const location=useLocation(); const {user,loading}=useAuth();
  const [showPassword,setShowPassword]=useState(false); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState(''); const [submitting,setSubmitting]=useState(false);
  const next=new URLSearchParams(location.search).get('next')||'/dashboard';
  useEffect(()=>{if(!loading&&user)navigate(next,{replace:true})},[loading,user,next,navigate]);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    const client = supabase
    if(!client){setMessage('Supabase belum dikonfigurasi.');return}
    setSubmitting(true); setMessage('Memeriksa akun…');
    const {error}=await client.auth.signInWithPassword({email:email.trim(),password});
    if(error){setMessage(error.message);setSubmitting(false);return}
    navigate(next,{replace:true})
  }
  if(loading)return <section className="login-page"><div className="login-loading"><span className="eyebrow">KIWANTIKA</span><strong>Menyiapkan sesi</strong><span>Memeriksa sesi login…</span></div></section>;
  if(user)return <section className="login-page"><div className="login-loading"><span className="eyebrow">KIWANTIKA</span><strong>Mengalihkan…</strong><span>Sesi kamu sudah aktif.</span></div></section>;
  return <section className="login-page">
    <div className="wrap login-layout">
      <div className="login-intro">
        <span className="eyebrow">Area anggota · KIWANTIKA</span>
        <h1>Masuk ke<br/><em>ambalan.</em></h1>
        <p>Akses dashboard anggota, informasi kegiatan, absensi, izin & sakit, dan layanan internal KIWANTIKA SMAN 10 Garut.</p>
        <div className="login-meta"><span>15.075 — 15.076</span><span>SMAN 10 GARUT</span></div>
      </div>
      <div className="auth-panel">
        <div className="auth-panel-head"><span className="eyebrow">01 — AUTENTIKASI</span><h2>Selamat datang kembali.</h2><p>Gunakan akun Google atau email yang sudah terdaftar.</p></div>
        <GoogleSignInButton onError={setMessage} onBusyChange={setSubmitting}/>
        <div className="auth-divider"><span>atau masuk dengan email</span></div>
        <form className="form-shell auth-form" onSubmit={submit}>
          <label className="field"><span>Email</span><input autoComplete="email" type="email" placeholder="nama@sekolah.sch.id" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <label className="field"><span>Password</span><div className="password-field"><input autoComplete="current-password" type={showPassword?'text':'password'} placeholder="Masukkan password" required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" aria-label={showPassword?'Sembunyikan password':'Tampilkan password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          <button className="btn primary auth-submit" type="submit" disabled={!hasSupabase||submitting}><LogIn/> {submitting?'Memproses…':'Masuk dengan email'}</button>
          {!hasSupabase&&<small>Tambahkan konfigurasi Supabase di environment deployment.</small>}
          {message&&<div className="notice"><CheckCircle2/><span>{message}</span></div>}
        </form>
        <p className="auth-note">Dengan masuk, kamu menyetujui penggunaan akun untuk layanan internal KIWANTIKA.</p>
      </div>
    </div>
  </section>
}
function normalizePhone(value:string){const digits=value.replace(/[^\d]/g,'');return digits.startsWith('62')?`0${digits.slice(2)}`:digits}
function isValidPhone(value:string){return /^08[1-9][0-9]{7,10}$/.test(normalizePhone(value))}
function publicMediaUrl(path:string){return supabase?.storage.from('public-media').getPublicUrl(path).data.publicUrl||''}
function eventMediaUrl(path:string){return supabase?.storage.from('event-media').getPublicUrl(path).data.publicUrl||''}

export function NotFoundPage() {
  return <section className="section"><div className="wrap not-found">
    <span className="eyebrow">Halaman tidak ditemukan</span>
    <div className="not-found-code" aria-hidden="true">4<em>0</em>4</div>
    <h1>Jejak ini tidak ada di peta.</h1>
    <p>Alamat yang kamu tuju mungkin sudah dipindahkan atau salah ketik. Kembali ke jalur utama dan lanjutkan dari sana.</p>
    <div className="actions"><Link className="btn primary" to="/">Kembali ke beranda <ChevronRight size={16} /></Link><Link className="btn secondary" to="/kalender">Lihat agenda</Link></div>
  </div></section>
}
