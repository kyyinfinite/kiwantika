export type Role = 'super_admin' | 'admin' | 'pembina' | 'dewan' | 'anggota' | 'calon_anggota'
export type Article = { id:string; title:string; slug:string; excerpt:string|null; content:string; cover_path:string|null; category:string; published_at:string|null }
export type Event = { id:string; title:string; slug:string; description:string|null; event_type:string; visibility:string; start_at:string; end_at:string|null; location:string|null; cover_path?:string|null }
