create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','admin','pembina','dewan','anggota','calon_anggota');
create type public.membership_status as enum ('candidate','active','inactive','alumni','suspended');
create type public.content_status as enum ('draft','scheduled','published','archived');
create type public.event_visibility as enum ('public','members','management');
create type public.form_status as enum ('draft','published','closed','archived');
create type public.submission_status as enum ('draft','submitted','reviewing','accepted','rejected','withdrawn');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 display_name text,
 email text,
 avatar_path text,
 class_name text,
 generation text,
 group_name text,
 role public.app_role not null default 'calon_anggota',
 membership_status public.membership_status not null default 'candidate',
 phone text,
 address text,
 joined_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);
create index profiles_status_idx on public.profiles(membership_status);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.organizational_positions (id uuid primary key default gen_random_uuid(), name text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now());
create table public.member_positions (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade, position_id uuid not null references public.organizational_positions(id) on delete cascade, period text, started_at timestamptz, ended_at timestamptz, created_at timestamptz not null default now());
create unique index member_positions_unique_active on public.member_positions(profile_id,position_id,period);

create table public.articles (id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, excerpt text, content text not null default '', cover_path text, category text not null default 'berita', status public.content_status not null default 'draft', author_id uuid references public.profiles(id) on delete set null, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index articles_public_idx on public.articles(status,published_at desc);
create trigger articles_updated_at before update on public.articles for each row execute function public.set_updated_at();

create table public.events (id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, description text, event_type text not null default 'kegiatan', visibility public.event_visibility not null default 'public', start_at timestamptz not null, end_at timestamptz, location text, cover_path text, created_by uuid references public.profiles(id) on delete set null, status public.content_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index events_calendar_idx on public.events(start_at);
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

create table public.attendance_sessions (id uuid primary key default gen_random_uuid(), event_id uuid references public.events(id) on delete set null, title text not null, token_hash text, starts_at timestamptz not null, expires_at timestamptz, created_by uuid references public.profiles(id) on delete set null, is_active boolean not null default true, created_at timestamptz not null default now());
create table public.attendance_records (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.attendance_sessions(id) on delete cascade, member_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'hadir', method text not null default 'manual', checked_in_at timestamptz not null default now(), note text, created_at timestamptz not null default now(), unique(session_id,member_id));

create table public.permission_requests (id uuid primary key default gen_random_uuid(), member_id uuid not null references public.profiles(id) on delete cascade, event_id uuid references public.events(id) on delete set null, type text not null, reason text not null, evidence_path text, status text not null default 'pending', reviewed_by uuid references public.profiles(id) on delete set null, review_note text, reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger permission_updated_at before update on public.permission_requests for each row execute function public.set_updated_at();

create table public.forms (id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, description text, status public.form_status not null default 'draft', visibility public.event_visibility not null default 'public', requires_auth boolean not null default false, allow_edit boolean not null default false, allow_multiple boolean not null default false, max_submissions integer, opens_at timestamptz, closes_at timestamptz, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.form_versions (id uuid primary key default gen_random_uuid(), form_id uuid not null references public.forms(id) on delete cascade, version_number integer not null, schema_snapshot jsonb not null default '{}'::jsonb, published_at timestamptz, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), unique(form_id,version_number));
create table public.form_fields (id uuid primary key default gen_random_uuid(), form_version_id uuid not null references public.form_versions(id) on delete cascade, field_key text not null, label text not null, description text, type text not null, required boolean not null default false, position integer not null default 0, options jsonb not null default '[]'::jsonb, validation jsonb not null default '{}'::jsonb, unique(form_version_id,field_key));
create table public.form_submissions (id uuid primary key default gen_random_uuid(), form_id uuid not null references public.forms(id) on delete restrict, form_version_id uuid not null references public.form_versions(id) on delete restrict, applicant_id uuid references public.profiles(id) on delete set null, submission_number text not null unique, status public.submission_status not null default 'submitted', answers_snapshot jsonb not null default '{}'::jsonb, submitted_at timestamptz, updated_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null, review_note text);
create table public.form_submission_answers (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.form_submissions(id) on delete cascade, field_id uuid not null references public.form_fields(id) on delete restrict, value_text text, value_json jsonb, file_path text, unique(submission_id,field_id));
create table public.form_submission_events (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.form_submissions(id) on delete cascade, actor_id uuid references public.profiles(id) on delete set null, event_type text not null, from_status text, to_status text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index form_submissions_applicant_idx on public.form_submissions(applicant_id,created_at desc);
create trigger forms_updated_at before update on public.forms for each row execute function public.set_updated_at();

create table public.albums (id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, description text, event_id uuid references public.events(id) on delete set null, cover_path text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
create table public.photos (id uuid primary key default gen_random_uuid(), album_id uuid not null references public.albums(id) on delete cascade, storage_path text not null, caption text, uploaded_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
create index photos_album_idx on public.photos(album_id,created_at desc);

create table public.sku_items (id uuid primary key default gen_random_uuid(), level text not null, category text not null, number integer not null, description text not null, created_at timestamptz not null default now(), unique(level,category,number));
create table public.sku_progress (id uuid primary key default gen_random_uuid(), member_id uuid not null references public.profiles(id) on delete cascade, sku_item_id uuid not null references public.sku_items(id) on delete cascade, status text not null default 'belum', note text, evidence_path text, verified_by uuid references public.profiles(id) on delete set null, verified_at timestamptz, updated_at timestamptz not null default now(), unique(member_id,sku_item_id));
create table public.tkk_items (id uuid primary key default gen_random_uuid(), name text not null, field text not null, level text not null default 'purwa', description text, created_at timestamptz not null default now());
create table public.tkk_progress (id uuid primary key default gen_random_uuid(), member_id uuid not null references public.profiles(id) on delete cascade, tkk_item_id uuid not null references public.tkk_items(id) on delete cascade, status text not null default 'belum', verified_by uuid references public.profiles(id) on delete set null, verified_at timestamptz, updated_at timestamptz not null default now(), unique(member_id,tkk_item_id));

create table public.dues (id uuid primary key default gen_random_uuid(), member_id uuid not null references public.profiles(id) on delete cascade, period_month integer not null check(period_month between 1 and 12), period_year integer not null, amount bigint not null default 0, status text not null default 'belum', note text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(member_id,period_month,period_year));
create table public.finance_transactions (id uuid primary key default gen_random_uuid(), type text not null check(type in ('pemasukan','pengeluaran')), category text not null, amount bigint not null check(amount>=0), description text, transaction_date date not null, group_name text, member_id uuid references public.profiles(id) on delete set null, evidence_path text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
create trigger dues_updated_at before update on public.dues for each row execute function public.set_updated_at();

create table public.announcements (id uuid primary key default gen_random_uuid(), title text not null, content text not null, category text not null default 'umum', priority text not null default 'normal', visibility public.event_visibility not null default 'members', published_at timestamptz, expires_at timestamptz, author_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, type text not null default 'info', title text not null, message text not null, link text, read_at timestamptz, created_at timestamptz not null default now());
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();

create table public.conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table public.conversation_members (conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, joined_at timestamptz not null default now(), primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz);
create index messages_conversation_idx on public.messages(conversation_id,created_at);

create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,display_name,email) values (new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.current_role() in ('super_admin','admin','pembina','dewan'),false) $$;

-- RLS
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('alter table public.%I enable row level security',r.tablename); END LOOP; END $$;

create policy "public read published articles" on public.articles for select using (status='published');
create policy "staff manage articles" on public.articles for all using (public.is_staff()) with check (public.is_staff());
create policy "public read public events" on public.events for select using (status='published' and visibility='public');
create policy "members read member events" on public.events for select using (status='published' and (visibility='public' or (auth.uid() is not null and visibility='members') or (auth.uid() is not null and public.is_staff())));
create policy "staff manage events" on public.events for all using (public.is_staff()) with check (public.is_staff());
create policy "own profile insert" on public.profiles for insert with check (id=auth.uid());
create policy "own profile read" on public.profiles for select using (id=auth.uid() or public.is_staff());
create policy "own profile update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy "staff manage profiles" on public.profiles for all using (public.is_staff()) with check (public.is_staff());
create policy "public read published forms" on public.forms for select using (status='published' and visibility='public');
create policy "staff manage forms" on public.forms for all using (public.is_staff()) with check (public.is_staff());
create policy "public read form versions" on public.form_versions for select using (exists(select 1 from public.forms f where f.id=form_id and f.status='published' and f.visibility='public'));
create policy "staff manage form versions" on public.form_versions for all using (public.is_staff()) with check (public.is_staff());
create policy "public read form fields" on public.form_fields for select using (exists(select 1 from public.form_versions v join public.forms f on f.id=v.form_id where v.id=form_version_id and f.status='published' and f.visibility='public'));
create policy "staff manage form fields" on public.form_fields for all using (public.is_staff()) with check (public.is_staff());
create policy "own submissions" on public.form_submissions for select using (applicant_id=auth.uid() or public.is_staff());
create policy "create own submissions" on public.form_submissions for insert with check (applicant_id=auth.uid() or applicant_id is null);
create policy "staff manage submissions" on public.form_submissions for all using (public.is_staff()) with check (public.is_staff());
create policy "own submission answers" on public.form_submission_answers for select using (exists(select 1 from public.form_submissions s where s.id=submission_id and (s.applicant_id=auth.uid() or public.is_staff())));
create policy "create submission answers" on public.form_submission_answers for insert with check (exists(select 1 from public.form_submissions s where s.id=submission_id and (s.applicant_id=auth.uid() or public.is_staff())));
create policy "staff manage submission answers" on public.form_submission_answers for all using (public.is_staff()) with check (public.is_staff());
create policy "own submission events" on public.form_submission_events for select using (exists(select 1 from public.form_submissions s where s.id=submission_id and (s.applicant_id=auth.uid() or public.is_staff())));
create policy "staff create submission events" on public.form_submission_events for insert with check (public.is_staff() or actor_id=auth.uid());
create policy "own attendance" on public.attendance_records for select using (member_id=auth.uid() or public.is_staff());
create policy "staff manage attendance" on public.attendance_records for all using (public.is_staff()) with check (public.is_staff());
create policy "member read sessions" on public.attendance_sessions for select using (auth.uid() is not null);
create policy "staff manage sessions" on public.attendance_sessions for all using (public.is_staff()) with check (public.is_staff());
create policy "own permission" on public.permission_requests for select using (member_id=auth.uid() or public.is_staff());
create policy "create own permission" on public.permission_requests for insert with check (member_id=auth.uid());
create policy "own permission update" on public.permission_requests for update using (member_id=auth.uid() or public.is_staff()) with check (member_id=auth.uid() or public.is_staff());
create policy "staff manage permission" on public.permission_requests for all using (public.is_staff()) with check (public.is_staff());
create policy "own sku progress" on public.sku_progress for select using (member_id=auth.uid() or public.is_staff());
create policy "own sku request" on public.sku_progress for insert with check (member_id=auth.uid());
create policy "staff manage sku progress" on public.sku_progress for all using (public.is_staff()) with check (public.is_staff());
create policy "read sku items" on public.sku_items for select using (auth.uid() is not null);
create policy "staff manage sku items" on public.sku_items for all using (public.is_staff()) with check (public.is_staff());
create policy "read tkk items" on public.tkk_items for select using (auth.uid() is not null);
create policy "own tkk progress" on public.tkk_progress for select using (member_id=auth.uid() or public.is_staff());
create policy "own tkk request" on public.tkk_progress for insert with check (member_id=auth.uid());
create policy "staff manage tkk" on public.tkk_progress for all using (public.is_staff()) with check (public.is_staff());
create policy "own notifications" on public.notifications for select using (user_id=auth.uid() or public.is_staff());
create policy "own notifications update" on public.notifications for update using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "staff create notifications" on public.notifications for insert with check (public.is_staff());
create policy "own dues" on public.dues for select using (member_id=auth.uid() or public.is_staff());
create policy "staff manage dues" on public.dues for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage finance" on public.finance_transactions for all using (public.is_staff()) with check (public.is_staff());
create policy "staff read finance" on public.finance_transactions for select using (public.is_staff());
create policy "member read own announcement" on public.announcements for select using (visibility='public' or (auth.uid() is not null and visibility='members') or public.is_staff());
create policy "staff manage announcements" on public.announcements for all using (public.is_staff()) with check (public.is_staff());
create policy "conversation members read" on public.conversations for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()) or public.is_staff());
create policy "conversation members manage membership" on public.conversation_members for all using (user_id=auth.uid() or public.is_staff()) with check (user_id=auth.uid() or public.is_staff());
create policy "conversation messages read" on public.messages for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()) or public.is_staff());
create policy "conversation messages insert" on public.messages for insert with check (sender_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy "staff audit read" on public.audit_logs for select using (public.current_role() in ('super_admin','admin'));
create policy "authenticated audit insert" on public.audit_logs for insert with check (actor_id=auth.uid() or public.is_staff());

-- Storage buckets. Policies can be tightened further after final deployment roles are confirmed.
insert into storage.buckets(id,name,public) values ('avatars','avatars',true),('public-media','public-media',true),('event-media','event-media',true),('documents','documents',false),('submission-files','submission-files',false) on conflict(id) do nothing;
create policy "public media read" on storage.objects for select using (bucket_id in ('avatars','public-media','event-media'));
create policy "auth upload own media" on storage.objects for insert to authenticated with check (bucket_id in ('avatars','public-media','event-media','documents','submission-files') and (storage.foldername(name))[1]=auth.uid()::text or public.is_staff());
create policy "auth update own media" on storage.objects for update to authenticated using (public.is_staff() or (bucket_id in ('avatars','documents','submission-files') and (storage.foldername(name))[1]=auth.uid()::text)) with check (public.is_staff() or (bucket_id in ('avatars','documents','submission-files') and (storage.foldername(name))[1]=auth.uid()::text));
create policy "auth delete own media" on storage.objects for delete to authenticated using (public.is_staff() or (bucket_id in ('avatars','documents','submission-files') and (storage.foldername(name))[1]=auth.uid()::text));
