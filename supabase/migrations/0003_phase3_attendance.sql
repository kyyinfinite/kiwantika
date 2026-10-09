
create extension if not exists pgcrypto with schema extensions;

alter table public.attendance_sessions
  add column if not exists token_hash text,
  add column if not exists pin_hash text,
  add column if not exists status text not null default 'active',
  add column if not exists max_checkins integer,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists attendance_sessions_token_hash_idx
  on public.attendance_sessions(token_hash);
create index if not exists attendance_sessions_event_idx
  on public.attendance_sessions(event_id, starts_at desc);
create index if not exists attendance_records_member_idx
  on public.attendance_records(member_id, checked_in_at desc);

alter table public.attendance_sessions drop constraint if exists attendance_sessions_status_check;
alter table public.attendance_sessions add constraint attendance_sessions_status_check
  check (status in ('active','closed','expired'));

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
set search_path = ''
as $$
declare
  v public.attendance_sessions;
begin
  if not public.is_staff() then
    raise exception 'not_authorized';
  end if;

  if length(trim(p_title)) < 2 then
    raise exception 'invalid_title';
  end if;
  if length(p_token) < 24 then
    raise exception 'invalid_token';
  end if;
  if p_pin !~ '^[0-9]{3,8}$' then
    raise exception 'invalid_pin';
  end if;
  if p_expires_at is not null and p_expires_at <= p_starts_at then
    raise exception 'invalid_time_window';
  end if;

  insert into public.attendance_sessions
    (event_id, title, token_hash, pin_hash, starts_at, expires_at, created_by, is_active, status, max_checkins)
  values
    (p_event_id, trim(p_title), encode(extensions.digest(p_token, 'sha256'), 'hex'),
     encode(extensions.digest(p_pin, 'sha256'), 'hex'), p_starts_at, p_expires_at,
     (select auth.uid()), true, 'active', p_max_checkins)
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
set search_path = ''
as $$
  select s.id, s.event_id, s.title, s.starts_at, s.expires_at, s.status, e.title
  from public.attendance_sessions s
  left join public.events e on e.id = s.event_id
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.is_active = true
    and s.status = 'active'
    and s.starts_at <= now()
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

create or replace function public.check_in_attendance(p_token text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_member public.profiles;
  v_count integer;
  v_record public.attendance_records;
begin
  if (auth.uid() is null) then
    raise exception 'not_authenticated';
  end if;

  select * into v_session
  from public.attendance_sessions
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and is_active = true
    and status = 'active'
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    raise exception 'session_not_found_or_expired';
  end if;

  if encode(extensions.digest(p_pin, 'sha256'), 'hex') <> v_session.pin_hash then
    raise exception 'invalid_pin';
  end if;

  select * into v_member from public.profiles where id = auth.uid();
  if not found then
    raise exception 'member_profile_not_found';
  end if;

  select count(*) into v_count
  from public.attendance_records
  where session_id = v_session.id;

  if v_session.max_checkins is not null and v_count >= v_session.max_checkins then
    raise exception 'attendance_limit_reached';
  end if;

  insert into public.attendance_records
    (session_id, member_id, status, method, checked_in_at, note)
  values
    (v_session.id, auth.uid(), 'hadir', 'qr_pin', now(), 'Mobile QR + PIN')
  on conflict (session_id, member_id) do nothing
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

revoke all on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) to authenticated;

revoke all on function public.get_attendance_session(text) from public, anon, authenticated;
grant execute on function public.get_attendance_session(text) to anon, authenticated;

revoke all on function public.check_in_attendance(text,text) from public, anon, authenticated;
grant execute on function public.check_in_attendance(text,text) to authenticated;

-- Session metadata is not useful to anonymous clients except through the safe lookup function.
drop policy if exists "member read sessions" on public.attendance_sessions;
create policy "staff read attendance sessions"
  on public.attendance_sessions for select
  to authenticated
  using (public.is_staff() or created_by = auth.uid());

-- Members must use the check-in function; direct inserts are not allowed.
drop policy if exists "member create attendance" on public.attendance_records;
drop policy if exists "own attendance insert" on public.attendance_records;

comment on table public.attendance_sessions is 'Attendance sessions. QR token and PIN are stored only as SHA-256 hashes.';
comment on function public.check_in_attendance(text,text) is 'Authenticated mobile QR attendance endpoint. Validates session, PIN, expiry and duplicate check-in atomically.';
