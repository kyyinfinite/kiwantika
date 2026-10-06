-- KIWANTIKA Phase 9
-- 1) Verified Pramuka knowledge base for Tunas (retrieval before generation)
-- 2) Hardened QR attendance RPCs: never return secret hashes, enforce active member status,
--    and make max_checkins atomic.

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issuer text not null default 'Kwartir Nasional Gerakan Pramuka',
  document_no text,
  year integer,
  source_url text not null,
  authority text not null default 'official',
  verified_at timestamptz not null default now(),
  active boolean not null default true,
  unique(source_url)
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  title text not null,
  audience text not null default 'umum',
  topic text not null,
  keywords text not null default '',
  content text not null,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(topic,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(content,''))
  ) stored,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);
create index if not exists knowledge_chunks_audience_idx on public.knowledge_chunks(audience, topic);

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "public read active knowledge sources" on public.knowledge_sources;
create policy "public read active knowledge sources" on public.knowledge_sources
  for select to anon, authenticated using (active = true);

drop policy if exists "public read active knowledge chunks" on public.knowledge_chunks;
create policy "public read active knowledge chunks" on public.knowledge_chunks
  for select to anon, authenticated using (active = true);

drop policy if exists "staff manage knowledge sources" on public.knowledge_sources;
create policy "staff manage knowledge sources" on public.knowledge_sources
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff manage knowledge chunks" on public.knowledge_chunks;
create policy "staff manage knowledge chunks" on public.knowledge_chunks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.search_pramuka_knowledge(
  p_query text,
  p_audience text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  title text,
  issuer text,
  document_no text,
  year integer,
  source_url text,
  audience text,
  topic text,
  content text,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select
    k.id, k.title, s.issuer, s.document_no, s.year, s.source_url,
    k.audience, k.topic, k.content,
    ts_rank_cd(k.search_vector, plainto_tsquery('simple', left(coalesce(p_query,''), 500)))::real as rank
  from public.knowledge_chunks k
  join public.knowledge_sources s on s.id = k.source_id
  where k.active = true
    and s.active = true
    and (p_audience is null or k.audience = 'umum' or k.audience = p_audience)
    and k.search_vector @@ plainto_tsquery('simple', left(coalesce(p_query,''), 500))
  order by rank desc, k.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 12));
$$;

revoke all on function public.search_pramuka_knowledge(text,text,integer) from public;
grant execute on function public.search_pramuka_knowledge(text,text,integer) to anon, authenticated;

-- Replace the attendance creator with a safe return type. The old function returned
-- the entire attendance_sessions row, which included token_hash and pin_hash.
drop function if exists public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer);
create or replace function public.create_attendance_session(
  p_event_id uuid,
  p_title text,
  p_token text,
  p_pin text,
  p_starts_at timestamptz,
  p_expires_at timestamptz default null,
  p_max_checkins integer default null
)
returns table (
  id uuid,
  event_id uuid,
  title text,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  max_checkins integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_event_id uuid;
  v_title text;
  v_starts timestamptz;
  v_expires timestamptz;
  v_status text;
  v_max integer;
begin
  if not public.is_staff() then raise exception 'not_authorized'; end if;
  if length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if length(p_token) < 24 then raise exception 'invalid_token'; end if;
  if p_pin !~ '^[0-9]{3,8}$' then raise exception 'invalid_pin'; end if;
  if p_starts_at is null then raise exception 'invalid_start_time'; end if;
  v_expires := coalesce(p_expires_at, p_starts_at + interval '2 hours');
  if v_expires <= p_starts_at then raise exception 'invalid_time_window'; end if;
  if p_max_checkins is not null and p_max_checkins < 1 then raise exception 'invalid_max_checkins'; end if;

  insert into public.attendance_sessions
    (event_id,title,token_hash,pin_hash,starts_at,expires_at,created_by,is_active,status,max_checkins)
  values (
    p_event_id, trim(p_title),
    encode(extensions.digest(p_token, 'sha256'), 'hex'),
    encode(extensions.digest(p_pin, 'sha256'), 'hex'),
    p_starts_at, v_expires, (select auth.uid()), true, 'active', p_max_checkins
  )
  returning attendance_sessions.id, attendance_sessions.event_id, attendance_sessions.title,
            attendance_sessions.starts_at, attendance_sessions.expires_at,
            attendance_sessions.status, attendance_sessions.max_checkins
  into v_id, v_event_id, v_title, v_starts, v_expires, v_status, v_max;

  return query select v_id, v_event_id, v_title, v_starts, v_expires, v_status, v_max;
end;
$$;

revoke all on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) to authenticated;

create table if not exists public.attendance_pin_attempts (
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  failed_count integer not null default 0 check (failed_count >= 0),
  primary key(session_id, member_id)
);

alter table public.attendance_pin_attempts enable row level security;
revoke all on public.attendance_pin_attempts from anon, authenticated;

drop policy if exists "staff read attendance pin attempts" on public.attendance_pin_attempts;
create policy "staff read attendance pin attempts" on public.attendance_pin_attempts
  for select to authenticated using (public.is_staff());

-- Harden check-in: only active members can check in, and capacity is reserved atomically
-- under the session row lock. Duplicate scans remain idempotent.
create or replace function public.check_in_attendance(p_token text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_member public.profiles;
  v_record public.attendance_records;
  v_exists boolean;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;

  select * into v_session
  from public.attendance_sessions
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and is_active = true
    and status = 'active'
    and starts_at <= now()
    and coalesce(expires_at, now() + interval '1 second') > now()
  for update;

  if not found then raise exception 'session_not_found_or_expired'; end if;

  insert into public.attendance_pin_attempts(session_id, member_id)
  values (v_session.id, (select auth.uid()))
  on conflict (session_id, member_id) do nothing;

  update public.attendance_pin_attempts
  set window_started_at = case when window_started_at < now() - interval '5 minutes' then now() else window_started_at end,
      failed_count = case when window_started_at < now() - interval '5 minutes' then 0 else failed_count end
  where session_id = v_session.id and member_id = (select auth.uid());

  if encode(extensions.digest(p_pin, 'sha256'), 'hex') <> v_session.pin_hash then
    update public.attendance_pin_attempts
    set failed_count = failed_count + 1
    where session_id = v_session.id and member_id = (select auth.uid());
    if exists (select 1 from public.attendance_pin_attempts where session_id = v_session.id and member_id = (select auth.uid()) and failed_count >= 5) then
      raise exception 'too_many_pin_attempts';
    end if;
    raise exception 'invalid_pin';
  end if;

  delete from public.attendance_pin_attempts where session_id = v_session.id and member_id = (select auth.uid());

  select * into v_member from public.profiles where id = (select auth.uid());
  if not found then raise exception 'member_profile_not_found'; end if;
  if v_member.membership_status is distinct from 'active' then raise exception 'member_not_active'; end if;

  select exists(
    select 1 from public.attendance_records
    where session_id = v_session.id and member_id = (select auth.uid())
  ) into v_exists;

  if v_exists then
    select * into v_record from public.attendance_records
    where session_id = v_session.id and member_id = (select auth.uid())
    limit 1;
    return jsonb_build_object('ok', true, 'already_checked_in', true,
      'session_id', v_session.id, 'member_name', coalesce(v_member.display_name, v_member.full_name),
      'checked_in_at', v_record.checked_in_at);
  end if;

  select count(*) into v_count from public.attendance_records where session_id = v_session.id;
  if v_session.max_checkins is not null and v_count >= v_session.max_checkins then
    raise exception 'attendance_limit_reached';
  end if;

  insert into public.attendance_records(session_id,member_id,status,method,checked_in_at,note)
  values (v_session.id,(select auth.uid()),'hadir','qr_pin',now(),'Mobile QR + PIN')
  on conflict (session_id,member_id) do nothing
  returning * into v_record;

  if v_record.id is null then
    return jsonb_build_object('ok', true, 'already_checked_in', true, 'session_id', v_session.id,
      'member_name', coalesce(v_member.display_name, v_member.full_name));
  end if;

  return jsonb_build_object('ok', true, 'already_checked_in', false, 'session_id', v_session.id,
    'record_id', v_record.id, 'member_name', coalesce(v_member.display_name, v_member.full_name),
    'checked_in_at', v_record.checked_in_at);
end;
$$;

revoke all on function public.check_in_attendance(text,text) from public, anon, authenticated;
grant execute on function public.check_in_attendance(text,text) to authenticated;

comment on table public.knowledge_chunks is 'Curated, source-backed Pramuka knowledge used by Tunas. Do not insert unverified AI-generated material.';
comment on function public.search_pramuka_knowledge(text,text,integer) is 'Hybrid-ready lexical retrieval for verified Pramuka material. Only active, source-backed chunks are returned.';
comment on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) is 'Creates a QR session and returns only non-secret session metadata.';
comment on function public.check_in_attendance(text,text) is 'Atomic QR+PIN attendance check-in with active-member and capacity validation.';

-- ============================================================
-- Seed authoritative sources and concise, non-verbatim knowledge summaries.
-- Full documents remain at their official URLs and should be the source of truth.
-- ============================================================
insert into public.knowledge_sources(title,issuer,document_no,year,source_url,authority)
values
 ('Gerakan Pramuka: golongan usia','Kwartir Nasional Gerakan Pramuka','Profil Gerakan Pramuka',null,'https://pramuka.or.id/gerakan-pramuka/','official'),
 ('Panduan Penyelesaian SKU Siaga','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 119 Tahun 2011',2011,'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Siaga.pdf','official'),
 ('Panduan Penyelesaian SKU Penggalang','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 119 Tahun 2011',2011,'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Penggalang.pdf','official'),
 ('Panduan Penyelesaian SKU Penegak','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 119 Tahun 2011',2011,'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Penegak.pdf','official'),
 ('Panduan Penyelesaian SKU Pandega','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 119 Tahun 2011',2011,'https://pramuka.or.id/files/document/SK-119-2011-Panduan%20Penyelesaian-SKU-Pandega.pdf','official'),
 ('Pola dan Mekanisme Pembinaan Penegak dan Pandega','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 176 Tahun 2013',2013,'https://pramuka.or.id/files/document/SK-176-2013-Jukran-Polmekbin-TD.pdf','official'),
 ('Panduan Kursus Pembina Pramuka Mahir','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 200 Tahun 2011',2011,'https://pramuka.or.id/files/document/SK-200-2011-Panduan-Kursus-Pembina-Pramuka-Mahir.pdf','official'),
 ('Pedoman Anggota Dewasa dalam Gerakan Pramuka','Kwartir Nasional Gerakan Pramuka','SK Kwarnas No. 047 Tahun 2018',2018,'https://pramuka.or.id/files/document/SK-Kwarnas-047-2018-Pedoman-Angggota-Dewasa.pdf','official')
on conflict(source_url) do update set title=excluded.title, issuer=excluded.issuer, document_no=excluded.document_no, year=excluded.year, authority=excluded.authority, verified_at=now(), active=true;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Golongan anggota muda dan rentang usia','umum','golongan usia','siaga penggalang penegak pandega usia',
'Kwartir Nasional menjelaskan empat golongan anggota muda: Siaga usia 7–10 tahun, Penggalang 11–15 tahun, Penegak 16–20 tahun, dan Pandega 21–25 tahun. Anggota dewasa merupakan kelompok tersendiri.'
from public.knowledge_sources s where s.document_no='Profil Gerakan Pramuka' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'SKU sebagai sumber kecakapan umum','Siaga','SKU','syarat kecakapan umum siaga',
'Panduan Penyelesaian SKU Siaga dari Kwarnas menjadi rujukan resmi untuk penyelesaian Syarat Kecakapan Umum golongan Siaga. Untuk menjawab nomor atau butir SKU tertentu, Tunas harus merujuk pada butir yang benar-benar terdapat dalam dokumen, bukan membuat butir baru.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 119 Tahun 2011' and s.title='Panduan Penyelesaian SKU Siaga' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'SKU sebagai sumber kecakapan umum','Penggalang','SKU','syarat kecakapan umum penggalang',
'Panduan Penyelesaian SKU Penggalang dari Kwarnas menjadi rujukan resmi untuk penyelesaian Syarat Kecakapan Umum golongan Penggalang. Jika pengguna meminta butir tertentu, jawaban harus ditarik dari dokumen resmi dan tidak boleh diganti dengan daftar yang diingat model.'
from public.knowledge_sources s where s.title='Panduan Penyelesaian SKU Penggalang' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'SKU Penegak dan tingkat kecakapan','Penegak','SKU','SKU penegak bantara laksana',
'Panduan Penyelesaian SKU Penegak dari Kwarnas adalah sumber resmi untuk butir SKU Penegak. Dalam pembinaan Penegak, dokumen resmi juga membedakan tingkat Bantara dan Laksana. Jangan menyatakan syarat suatu tingkat tanpa dukungan dokumen.'
from public.knowledge_sources s where s.title='Panduan Penyelesaian SKU Penegak' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'SKU Pandega','Pandega','SKU','SKU pandega',
'Panduan Penyelesaian SKU Pandega dari Kwarnas adalah sumber resmi untuk penyelesaian Syarat Kecakapan Umum golongan Pandega. Pertanyaan tentang nomor butir, syarat, atau urutan harus dijawab hanya jika dapat diverifikasi pada dokumen tersebut.'
from public.knowledge_sources s where s.title='Panduan Penyelesaian SKU Pandega' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Pembinaan Penegak: bina diri, bina satuan, bina masyarakat','Penegak','pembinaan','tri bina bina diri bina satuan bina masyarakat',
'Keputusan Kwarnas No. 176 Tahun 2013 menjelaskan pembinaan Penegak melalui tri bina: bina diri untuk meningkatkan pengetahuan dan keterampilan, bina satuan untuk mempersiapkan kemampuan membina keterampilan pada satuan di bawahnya, dan bina masyarakat untuk mempersiapkan kepemimpinan di masyarakat.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 176 Tahun 2013' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Wadah pembinaan Penegak: Ambalan dan Sangga','Penegak','organisasi','ambalan sangga pradana dewan ambalan',
'Keputusan Kwarnas No. 176 Tahun 2013 menyebut Ambalan sebagai satuan gerak untuk golongan Penegak yang menghimpun Sangga dan dipimpin Pradana dengan pendamping pembina. Sangga merupakan kelompok belajar interaktif teman sebaya; dokumen tersebut menyebut jumlah 4–8 orang per Sangga.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 176 Tahun 2013' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Tahapan pembinaan Penegak','Penegak','tingkatan','tamu ambalan calon penegak bantara laksana',
'Keputusan Kwarnas No. 176 Tahun 2013 menjelaskan tahapan pembinaan Penegak antara lain Tamu Ambalan, Calon Penegak, Penegak Bantara, dan Penegak Laksana. Dokumen juga menjelaskan bahwa Penegak Bantara melanjutkan pencapaian SKU tingkat Laksana dan bahwa Penegak Laksana diarahkan untuk memimpin kegiatan bakti.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 176 Tahun 2013' and s.active
on conflict do nothing;

insert into public.knowledge_sources(title,issuer,document_no,year,source_url,authority)
values ('AD/ART Gerakan Pramuka — referensi resmi 2019','Kwartir Nasional Gerakan Pramuka','AD/ART Gerakan Pramuka',2019,'https://pramuka.or.id/files/document/AD-ART-GP-2019.pdf','official_reference')
on conflict(source_url) do update set verified_at=now(), active=true;

insert into public.knowledge_sources(title,issuer,document_no,year,source_url,authority)
values ('AD-ART Munas 2023 — halaman resmi','Kwartir Nasional Gerakan Pramuka','AD-ART Munas 2023',2023,'https://pramuka.or.id/ad-art-munas-2023/','official_current')
on conflict(source_url) do update set verified_at=now(), active=true;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Status sumber AD-ART terkini','umum','governance','ad art munas 2023 terbaru peraturan',
'Kwarnas menyediakan halaman resmi AD-ART Munas 2023. Untuk pertanyaan yang meminta ketentuan AD-ART terkini, Tunas harus memprioritaskan dokumen Munas 2023 dan tidak menyimpulkan bahwa dokumen 2019 pasti merupakan versi terbaru.'
from public.knowledge_sources s where s.document_no='AD-ART Munas 2023' and s.active
on conflict do nothing;

insert into public.knowledge_sources(title,issuer,document_no,year,source_url,authority)
values ('AD/ART Gerakan Pramuka','Kwartir Nasional Gerakan Pramuka','AD/ART Gerakan Pramuka',2019,'https://pramuka.or.id/files/document/AD-ART-GP-2019.pdf','official')
on conflict(source_url) do update set verified_at=now(), active=true;
insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Kode kehormatan menurut golongan','umum','kode kehormatan','dwisatya dwidarma trisatya dasadarma kode kehormatan',
'AD/ART Gerakan Pramuka menjelaskan bahwa Kode Kehormatan ditetapkan sesuai golongan usia. Siaga menggunakan Dwisatya dan Dwidarma, sedangkan Penggalang menggunakan Trisatya dan Dasadarma; Penegak, Pandega, dan anggota dewasa menggunakan Trisatya dan Dasadarma dengan ketentuan yang berlaku. Untuk kutipan teks lengkap, gunakan dokumen resmi, bukan ingatan model.'
from public.knowledge_sources s where s.document_no='AD/ART Gerakan Pramuka' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'KMD untuk anggota dewasa','Pembina','pendidikan pembina','kmd kursus pembina mahir tingkat dasar anggota dewasa',
'Panduan Kursus Pembina Pramuka Mahir dari Kwarnas membahas KMD sebagai pendidikan bagi orang dewasa yang dipersiapkan menjadi Pembina Pramuka Mahir Dasar. Materinya mencakup fundamental Gerakan Pramuka, Prinsip Dasar Kepramukaan, Metode Kepramukaan, Kiasan Dasar, Sistem Among, serta materi sesuai golongan yang dibina.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 200 Tahun 2011' and s.active
on conflict do nothing;

insert into public.knowledge_chunks(source_id,title,audience,topic,keywords,content)
select s.id,'Pedoman anggota dewasa','Pembina','anggota dewasa','pembina anggota dewasa pendidikan pelatihan',
'Pedoman Anggota Dewasa dalam Gerakan Pramuka merupakan salah satu rujukan Kwarnas untuk peran dan pengembangan anggota dewasa. Pertanyaan tentang kualifikasi, kursus, atau hak bina harus diverifikasi terhadap pedoman dan ketentuan pendidikan/pelatihan yang berlaku.'
from public.knowledge_sources s where s.document_no='SK Kwarnas No. 047 Tahun 2018' and s.active
on conflict do nothing;

-- Keep old broad session-read policies out of the path; only staff/creator may list sessions.
drop policy if exists "member read sessions" on public.attendance_sessions;
drop policy if exists "staff read attendance sessions" on public.attendance_sessions;
create policy "staff read attendance sessions" on public.attendance_sessions
  for select to authenticated
  using (public.is_staff() or created_by = (select auth.uid()));
