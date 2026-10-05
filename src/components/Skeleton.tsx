import type { CSSProperties, ReactNode } from 'react'

type BoneProps = { w?: number | string; h?: number | string; r?: number | string; className?: string; style?: CSSProperties }

export function Bone({ w = '100%', h = 14, r = 6, className = '', style }: BoneProps) {
  return <span aria-hidden="true" className={`bone ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} />
}

function Busy({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className} role="status" aria-busy="true" aria-live="polite"><span className="sr-only">{label}</span>{children}</div>
}

const range = (count: number) => Array.from({ length: count }, (_, index) => index)

export function NewsGridSkeleton({ count = 3 }: { count?: number }) {
  return <Busy label="Memuat berita" className="article-grid">
    {range(count).map(i => <div className="article-card skeleton-card" key={i}>
      <Bone h={190} r={0} />
      <div className="bone-stack"><Bone w={72} h={10} /><Bone w="86%" h={22} /><Bone h={13} /><Bone w="64%" h={13} /></div>
    </div>)}
  </Busy>
}

export function EventListSkeleton({ count = 4 }: { count?: number }) {
  return <Busy label="Memuat agenda" className="event-list">
    {range(count).map(i => <div className="event-row" key={i}>
      <Bone w={64} h={64} r={9} className="no-shrink" />
      <div className="bone-stack grow"><Bone w={64} h={10} /><Bone w="52%" h={20} /><Bone w="38%" h={13} /></div>
    </div>)}
  </Busy>
}

export function GallerySkeleton({ count = 2 }: { count?: number }) {
  return <Busy label="Memuat galeri" className="public-gallery">
    {range(count).map(i => <div className="gallery-album skeleton-card" key={i}>
      <Bone h="100%" r={0} style={{ minHeight: 260 }} />
      <div className="gallery-album-body bone-stack">
        <Bone w={84} h={10} /><Bone w="60%" h={26} /><Bone h={13} />
        <div className="gallery-photo-grid">{range(3).map(j => <Bone key={j} h="auto" r={6} style={{ aspectRatio: '1' }} />)}</div>
      </div>
    </div>)}
  </Busy>
}

export function ArticleSkeleton() {
  return <Busy label="Memuat artikel" className="article-detail">
    <div className="bone-stack"><Bone w={140} h={12} /><Bone w="78%" h={44} /><Bone w="46%" h={14} /></div>
    <Bone h={380} r={10} className="mt-lg" />
    <div className="bone-stack mt-lg"><Bone h={15} /><Bone h={15} /><Bone w="82%" h={15} /><Bone h={15} /><Bone w="58%" h={15} /></div>
  </Busy>
}

export function HomeEventSkeleton() {
  return <Busy label="Memuat agenda" className="event-preview no-thumb">
    <div className="event-preview-date"><Bone w={64} h={64} r={8} /></div>
    <div className="event-preview-body bone-stack"><Bone w={80} h={10} /><Bone w="56%" h={28} /><Bone w="72%" h={14} /><Bone w="40%" h={14} /></div>
  </Busy>
}

export function HomeNewsSkeleton() {
  return <Busy label="Memuat berita" className="home-news-grid">
    {range(3).map(i => <div className={i === 0 ? 'home-news-card featured' : 'home-news-card'} key={i}>
      <div className="home-news-image"><Bone h="100%" r={0} /></div>
      <div className="home-news-body bone-stack"><Bone w={70} h={10} /><Bone w="88%" h={22} /><Bone h={13} /><Bone w="30%" h={11} /></div>
    </div>)}
  </Busy>
}

export function HomeGallerySkeleton() {
  return <Busy label="Memuat galeri" className="gallery-feature">
    <div className="gallery-feature-main"><Bone h="100%" r={0} /></div>
    <div className="gallery-feature-side">{range(3).map(i => <Bone key={i} h="100%" r={0} />)}</div>
  </Busy>
}

export function DashboardSkeleton() {
  return <Busy label="Memuat ruang anggota" className="wrap page-pad">
    <div className="bone-stack" style={{ marginBottom: 30 }}><Bone w={110} h={10} /><Bone w="44%" h={44} /><Bone w="30%" h={14} /></div>
    <div className="stat-grid">{range(3).map(i => <div className="stat-card" key={i}><Bone w={38} h={38} r={9} className="no-shrink" /><div className="bone-stack grow"><Bone w={70} h={11} /><Bone w={54} h={28} /><Bone w={96} h={11} /></div></div>)}</div>
    <div className="dashboard-grid">{range(4).map(i => <div className="panel" key={i}><Bone w={140} h={18} /><div className="bone-stack" style={{ marginTop: 20 }}><Bone h={42} r={8} /><Bone h={42} r={8} /><Bone h={42} r={8} /></div></div>)}</div>
  </Busy>
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return <Busy label="Memuat ringkasan" className="stat-grid six">
    {range(count).map(i => <div className="stat-card" key={i}><Bone w={38} h={38} r={9} className="no-shrink" /><div className="bone-stack grow"><Bone w={70} h={11} /><Bone w={48} h={28} /><Bone w={88} h={11} /></div></div>)}
  </Busy>
}

export function TableSkeleton({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return <Busy label="Memuat data" className="bone-stack table-skeleton">
    {range(rows).map(i => <div className="table-skeleton-row" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }} key={i}>{range(cols).map(j => <Bone key={j} h={14} w={j === 0 ? '80%' : '60%'} />)}</div>)}
  </Busy>
}

export function AttendanceSkeleton() {
  return <Busy label="Memuat sesi absensi">
    <div className="attendance-brand"><Bone w={42} h={42} r={10} /><div className="bone-stack grow"><Bone w={110} h={13} /><Bone w={80} h={9} /></div></div>
    <div className="bone-stack"><Bone w={100} h={10} /><Bone w="72%" h={30} /><Bone w="48%" h={14} /></div>
    <div className="bone-stack" style={{ marginTop: 22 }}><Bone h={52} r={10} /><Bone h={46} r={8} /><Bone h={44} r={7} /></div>
  </Busy>
}

export function ContentListSkeleton({ rows = 4 }: { rows?: number }) {
  return <Busy label="Memuat konten" className="content-list">
    {range(rows).map(i => <div className="content-row" key={i}>
      <Bone w={66} h={54} r={7} className="no-shrink" />
      <div className="bone-stack grow"><Bone w="64%" h={15} /><Bone w="38%" h={11} /></div>
      <Bone w={72} h={34} r={7} className="no-shrink" />
    </div>)}
  </Busy>
}

export function FormPageSkeleton() {
  return <Busy label="Memuat halaman" className="wrap page-pad">
    <div className="bone-stack" style={{ marginBottom: 30 }}><Bone w={100} h={10} /><Bone w="38%" h={44} /><Bone w="46%" h={14} /></div>
    <div className="two-col">
      <div className="form-shell bone-stack">{range(5).map(i => <div className="bone-stack" key={i}><Bone w={90} h={12} /><Bone h={44} r={7} /></div>)}<Bone w={150} h={42} r={7} /></div>
      <div className="panel bone-stack"><Bone w={130} h={18} /><Bone h={46} r={8} /><Bone h={46} r={8} /></div>
    </div>
  </Busy>
}
