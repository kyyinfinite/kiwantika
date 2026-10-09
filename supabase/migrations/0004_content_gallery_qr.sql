
-- Public gallery reads. Staff retain management through these policies.
alter table public.albums enable row level security;
alter table public.photos enable row level security;

drop policy if exists "public read albums" on public.albums;
create policy "public read albums"
  on public.albums for select
  using (true);

drop policy if exists "staff manage albums" on public.albums;
create policy "staff manage albums"
  on public.albums for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "public read photos" on public.photos;
create policy "public read photos"
  on public.photos for select
  using (true);

drop policy if exists "staff manage photos" on public.photos;
create policy "staff manage photos"
  on public.photos for all
  using (public.is_staff())
  with check (public.is_staff());

-- Keep attendance hashing independent from where pgcrypto was installed.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.attendance_sha256(value text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(digest(value, 'sha256'), 'hex');
$$;

create or replace function public.create_attendance_session(
  p_event_id uuid,
  p_title text,
  p_token text,
  p_pin text,
  p_starts_at timestamptz,
  p_expires_at timestamptz default null,
  p_max_checkins integer default null
)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.attendance_sessions;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;
  if length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if length(p_token) < 24 then raise exception 'invalid_token'; end if;
  if p_pin !~ '^[0-9]{3,8}$' then raise exception 'invalid_pin'; end if;
  if p_expires_at is not null and p_expires_at <= p_starts_at then raise exception 'invalid_time_window'; end if;

  insert into public.attendance_sessions
    (event_id,title,token_hash,pin_hash,starts_at,expires_at,created_by,is_active,status,max_checkins)
  values
    (p_event_id,trim(p_title),public.attendance_sha256(p_token),public.attendance_sha256(p_pin),p_starts_at,p_expires_at,auth.uid(),true,'active',p_max_checkins)
  returning * into v;

  return v;
end;
$$;

create or replace function public.get_attendance_session(p_token text)
returns table (
  id uuid,
  event_id uuid,
  title text,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  event_title text
)
language sql
security definer
set search_path = public, extensions
as $$
  select s.id,s.event_id,s.title,s.starts_at,s.expires_at,s.status,e.title
  from public.attendance_sessions s
  left join public.events e on e.id=s.event_id
  where s.token_hash=public.attendance_sha256(p_token)
    and s.is_active=true
    and s.status='active'
    and s.starts_at <= now()
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

create or replace function public.check_in_attendance(p_token text,p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.attendance_sessions;
  v_member public.profiles;
  v_count integer;
  v_record public.attendance_records;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_session
  from public.attendance_sessions
  where token_hash=public.attendance_sha256(p_token)
    and is_active=true
    and status='active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
  for update;

  if not found then raise exception 'session_not_found_or_expired'; end if;
  if public.attendance_sha256(p_pin) <> v_session.pin_hash then raise exception 'invalid_pin'; end if;

  select * into v_member from public.profiles where id=auth.uid();
  if not found then raise exception 'member_profile_not_found'; end if;

  select count(*) into v_count from public.attendance_records where session_id=v_session.id;
  if v_session.max_checkins is not null and v_count >= v_session.max_checkins then raise exception 'attendance_limit_reached'; end if;

  insert into public.attendance_records(session_id,member_id,status,method,checked_in_at,note)
  values(v_session.id,auth.uid(),'hadir','qr_pin',now(),'Mobile QR + PIN')
  on conflict(session_id,member_id) do nothing
  returning * into v_record;

  if v_record.id is null then
    return jsonb_build_object('ok',true,'already_checked_in',true,'session_id',v_session.id,'member_name',coalesce(v_member.display_name,v_member.full_name));
  end if;

  return jsonb_build_object('ok',true,'already_checked_in',false,'session_id',v_session.id,'record_id',v_record.id,'member_name',coalesce(v_member.display_name,v_member.full_name),'checked_in_at',v_record.checked_in_at);
end;
$$;

revoke all on function public.attendance_sha256(text) from public,anon,authenticated;
revoke all on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) from public,anon,authenticated;
revoke all on function public.get_attendance_session(text) from public,anon,authenticated;
revoke all on function public.check_in_attendance(text,text) from public,anon,authenticated;
grant execute on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) to authenticated;
grant execute on function public.get_attendance_session(text) to anon,authenticated;
grant execute on function public.check_in_attendance(text,text) to authenticated;
