-- Phase 11: attendance v2 (rotating signed QR, throttled check-in), leave requests,
-- monthly dues workflow, and a single admin overview RPC. Run after 0010.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ============================================================
-- 1. SCHEMA
-- ============================================================
alter table public.attendance_sessions
  add column if not exists qr_mode text not null default 'static',
  add column if not exists rotate_seconds integer not null default 30,
  add column if not exists late_after_minutes integer not null default 15;

alter table public.attendance_sessions drop constraint if exists attendance_sessions_qr_mode_check;
alter table public.attendance_sessions add constraint attendance_sessions_qr_mode_check
  check (qr_mode in ('rotating','static'));
alter table public.attendance_sessions drop constraint if exists attendance_sessions_rotate_check;
alter table public.attendance_sessions add constraint attendance_sessions_rotate_check
  check (rotate_seconds between 15 and 120 and late_after_minutes between 0 and 600);

alter table public.attendance_records
  add column if not exists marked_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check
  check (status in ('hadir','terlambat','izin','sakit','alpa')) not valid;

create table if not exists private.attendance_session_secrets (
  session_id uuid primary key references public.attendance_sessions(id) on delete cascade,
  secret bytea not null
);
create table if not exists private.attendance_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  session_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists attendance_attempts_lookup_idx
  on private.attendance_attempts(user_id, session_id, created_at desc);
create index if not exists attendance_attempts_created_idx
  on private.attendance_attempts(created_at);
alter table private.attendance_session_secrets enable row level security;
alter table private.attendance_attempts enable row level security;
revoke all on private.attendance_session_secrets from public, anon, authenticated;
revoke all on private.attendance_attempts from public, anon, authenticated;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete set null,
  leave_date date not null,
  type text not null check (type in ('izin','sakit')),
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  status text not null default 'menunggu' check (status in ('menunggu','disetujui','ditolak','dibatalkan')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leave_requests_active_uidx
  on public.leave_requests(member_id, leave_date, coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('menunggu','disetujui');
create index if not exists leave_requests_status_idx on public.leave_requests(status, created_at desc);
create index if not exists leave_requests_member_idx on public.leave_requests(member_id, leave_date desc);
drop trigger if exists leave_requests_updated_at on public.leave_requests;
create trigger leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();

alter table public.leave_requests enable row level security;
drop policy if exists "read leave requests" on public.leave_requests;
create policy "read leave requests" on public.leave_requests for select to authenticated
  using (member_id = (select auth.uid()) or (select private.has_permission('manage_attendance')));

alter table public.dues add column if not exists paid_at timestamptz;
alter table public.dues drop constraint if exists dues_status_check;
alter table public.dues add constraint dues_status_check check (status in ('belum','lunas')) not valid;
alter table public.finance_transactions
  add column if not exists due_id uuid references public.dues(id) on delete set null;
create unique index if not exists finance_transactions_due_uidx
  on public.finance_transactions(due_id) where due_id is not null;

-- ============================================================
-- 2. PRIVATE HELPERS
-- ============================================================
create or replace function private.audit(p_action text, p_entity text, p_entity_id uuid, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;

create or replace function private.attendance_mac(p_session_id uuid, p_slot bigint, p_kind text)
returns bytea language sql stable security definer set search_path = '' as $$
  select extensions.hmac(convert_to(p_kind || ':' || p_session_id::text || ':' || p_slot::text, 'utf8'), s.secret, 'sha256')
  from private.attendance_session_secrets s where s.session_id = p_session_id;
$$;

create or replace function private.attendance_qr_sig(p_session_id uuid, p_slot bigint)
returns text language sql stable security definer set search_path = '' as $$
  select substr(encode(private.attendance_mac(p_session_id, p_slot, 'qr'), 'hex'), 1, 24);
$$;

create or replace function private.attendance_manual_code(p_session_id uuid, p_slot bigint)
returns text language sql stable security definer set search_path = '' as $$
  select lpad((((get_byte(m, 0)::bigint << 24) | (get_byte(m, 1)::bigint << 16)
              | (get_byte(m, 2)::bigint << 8) | get_byte(m, 3)::bigint) % 1000000)::text, 6, '0')
  from (select private.attendance_mac(p_session_id, p_slot, 'pin') as m) x
  where m is not null;
$$;

create or replace function private.local_date(p_ts timestamptz)
returns date language sql immutable set search_path = '' as $$
  select (p_ts at time zone 'Asia/Jakarta')::date;
$$;

revoke all on function private.audit(text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function private.attendance_mac(uuid,bigint,text) from public, anon, authenticated;
revoke all on function private.attendance_qr_sig(uuid,bigint) from public, anon, authenticated;
revoke all on function private.attendance_manual_code(uuid,bigint) from public, anon, authenticated;
revoke all on function private.local_date(timestamptz) from public, anon, authenticated;

-- ============================================================
-- 3. ATTENDANCE v2
-- ============================================================
create or replace function public.create_attendance_session_v2(
  p_event_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_expires_at timestamptz default null,
  p_mode text default 'rotating',
  p_rotate_seconds integer default 30,
  p_late_after_minutes integer default 15,
  p_pin text default null,
  p_max_checkins integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_secret bytea := extensions.gen_random_bytes(32);
  v_token text;
  v_pin text;
  v_expires timestamptz;
  v_rand bytea;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 or char_length(p_title) > 120 then raise exception 'invalid_title'; end if;
  if p_mode not in ('rotating','static') then raise exception 'invalid_mode'; end if;
  if p_starts_at is null then raise exception 'invalid_start_time'; end if;
  if p_rotate_seconds not between 15 and 120 then raise exception 'invalid_rotate_seconds'; end if;
  if p_late_after_minutes not between 0 and 600 then raise exception 'invalid_late_minutes'; end if;
  if p_max_checkins is not null and p_max_checkins < 1 then raise exception 'invalid_max_checkins'; end if;
  v_expires := coalesce(p_expires_at, p_starts_at + interval '2 hours');
  if v_expires <= p_starts_at then raise exception 'invalid_time_window'; end if;

  if p_mode = 'static' then
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    if p_pin is not null and btrim(p_pin) <> '' then
      if btrim(p_pin) !~ '^[0-9]{4,8}$' then raise exception 'invalid_pin'; end if;
      v_pin := btrim(p_pin);
    else
      v_rand := extensions.gen_random_bytes(4);
      v_pin := lpad((((get_byte(v_rand, 0)::bigint << 24) | (get_byte(v_rand, 1)::bigint << 16)
                    | (get_byte(v_rand, 2)::bigint << 8) | get_byte(v_rand, 3)::bigint) % 1000000)::text, 6, '0');
    end if;
  end if;

  insert into public.attendance_sessions
    (event_id, title, token_hash, pin_hash, starts_at, expires_at, created_by, is_active, status,
     max_checkins, qr_mode, rotate_seconds, late_after_minutes)
  values
    (p_event_id, btrim(p_title),
     case when p_mode = 'static' then encode(extensions.digest(v_token, 'sha256'), 'hex') end,
     case when p_mode = 'static' then encode(extensions.hmac(convert_to(v_pin, 'utf8'), v_secret, 'sha256'), 'hex') end,
     p_starts_at, v_expires, (select auth.uid()), true, 'active',
     p_max_checkins, p_mode, p_rotate_seconds, p_late_after_minutes)
  returning id into v_id;

  insert into private.attendance_session_secrets(session_id, secret) values (v_id, v_secret);
  perform private.audit('attendance.session_created', 'attendance_session', v_id, jsonb_build_object('mode', p_mode, 'title', btrim(p_title)));

  return jsonb_build_object('id', v_id, 'mode', p_mode, 'token', v_token, 'pin', v_pin);
end;
$$;

create or replace function public.issue_attendance_qr(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.attendance_sessions;
  v_slot bigint;
  v_slots jsonb;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v from public.attendance_sessions where id = p_session_id;
  if not found or v.qr_mode <> 'rotating' then raise exception 'session_not_rotating'; end if;
  v_slot := floor(extract(epoch from now()) / v.rotate_seconds)::bigint;
  select jsonb_agg(jsonb_build_object(
    'slot', g,
    'starts_ms', g * v.rotate_seconds * 1000,
    'ends_ms', (g + 1) * v.rotate_seconds * 1000,
    'code', g::text || '.' || private.attendance_qr_sig(v.id, g),
    'manual', private.attendance_manual_code(v.id, g)
  ) order by g)
  into v_slots
  from generate_series(v_slot, v_slot + 3) g;
  return jsonb_build_object(
    'session_id', v.id,
    'rotate_seconds', v.rotate_seconds,
    'server_now_ms', (extract(epoch from now()) * 1000)::bigint,
    'slots', coalesce(v_slots, '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_attendance_session_v2(p_ref text, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.attendance_sessions;
  v_now_slot bigint;
  v_given bigint;
  v_valid boolean := false;
  v_event_title text;
begin
  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v from public.attendance_sessions where id = p_ref::uuid;
  else
    select * into v from public.attendance_sessions
    where token_hash = encode(extensions.digest(coalesce(p_ref, ''), 'sha256'), 'hex');
  end if;
  if not found then return jsonb_build_object('ok', false, 'code', 'session_unavailable'); end if;
  if not v.is_active or v.status <> 'active' or (v.expires_at is not null and v.expires_at <= now()) then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.starts_at > now() then
    return jsonb_build_object('ok', false, 'code', 'not_started', 'starts_at', v.starts_at, 'title', v.title);
  end if;
  if v.qr_mode = 'rotating' and p_code ~ '^[0-9]{1,12}\.[0-9a-f]{24}$' then
    v_now_slot := floor(extract(epoch from now()) / v.rotate_seconds)::bigint;
    v_given := split_part(p_code, '.', 1)::bigint;
    v_valid := v_given between v_now_slot - 1 and v_now_slot
      and private.attendance_qr_sig(v.id, v_given) = split_part(p_code, '.', 2);
  end if;
  select e.title into v_event_title from public.events e where e.id = v.event_id;
  return jsonb_build_object(
    'ok', true, 'id', v.id, 'title', v.title, 'event_title', v_event_title, 'mode', v.qr_mode,
    'starts_at', v.starts_at, 'expires_at', v.expires_at, 'code_valid', v_valid
  );
end;
$$;

create or replace function public.check_in_attendance_v2(p_ref text, p_code text default null, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c_max_fail constant integer := 5;
  v_uid uuid := (select auth.uid());
  v_member public.profiles;
  v_session public.attendance_sessions;
  v_secret bytea;
  v_existing public.attendance_records;
  v_record public.attendance_records;
  v_now_slot bigint;
  v_given bigint;
  v_ok boolean := false;
  v_fails integer;
  v_retry integer;
  v_status text;
  v_method text;
  v_count integer;
  v_reason text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;

  select * into v_member from public.profiles where id = v_uid;
  if not found or v_member.membership_status in ('suspended','inactive','alumni') then
    return jsonb_build_object('ok', false, 'code', 'not_eligible');
  end if;

  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_session from public.attendance_sessions where id = p_ref::uuid for update;
  else
    select * into v_session from public.attendance_sessions
    where token_hash = encode(extensions.digest(coalesce(p_ref, ''), 'sha256'), 'hex') for update;
  end if;
  if not found then return jsonb_build_object('ok', false, 'code', 'session_unavailable'); end if;
  if not v_session.is_active or v_session.status <> 'active'
     or (v_session.expires_at is not null and v_session.expires_at <= now()) then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v_session.starts_at > now() then
    return jsonb_build_object('ok', false, 'code', 'not_started', 'starts_at', v_session.starts_at);
  end if;

  select * into v_existing from public.attendance_records
  where session_id = v_session.id and member_id = v_uid;
  if found and v_existing.status in ('hadir','terlambat') then
    return jsonb_build_object('ok', true, 'already_checked_in', true, 'status', v_existing.status,
      'checked_in_at', v_existing.checked_in_at, 'session_title', v_session.title,
      'member_name', coalesce(v_member.display_name, v_member.full_name));
  end if;

  select count(*), ceil(extract(epoch from (min(t.created_at) + interval '10 minutes' - now())))::integer
  into v_fails, v_retry
  from (select created_at from private.attendance_attempts
        where user_id = v_uid and session_id = v_session.id and created_at > now() - interval '10 minutes'
        order by created_at desc limit c_max_fail) t;
  if v_fails >= c_max_fail then
    return jsonb_build_object('ok', false, 'code', 'locked', 'retry_after_seconds', greatest(coalesce(v_retry, 60), 1));
  end if;

  select secret into v_secret from private.attendance_session_secrets where session_id = v_session.id;

  if v_session.qr_mode = 'rotating' then
    v_now_slot := floor(extract(epoch from now()) / v_session.rotate_seconds)::bigint;
    if p_code ~ '^[0-9]{1,12}\.[0-9a-f]{24}$' then
      v_given := split_part(p_code, '.', 1)::bigint;
      v_ok := v_given between v_now_slot - 1 and v_now_slot
        and private.attendance_qr_sig(v_session.id, v_given) = split_part(p_code, '.', 2);
      v_method := 'qr_rotating';
    elsif p_code ~ '^[0-9]{6}$' then
      v_ok := p_code = private.attendance_manual_code(v_session.id, v_now_slot)
           or p_code = private.attendance_manual_code(v_session.id, v_now_slot - 1);
      v_method := 'code';
    end if;
    v_reason := 'invalid_code';
  else
    if p_pin is not null and v_session.pin_hash is not null then
      v_ok := case when v_secret is not null
        then encode(extensions.hmac(convert_to(p_pin, 'utf8'), v_secret, 'sha256'), 'hex')
        else encode(extensions.digest(p_pin, 'sha256'), 'hex') end = v_session.pin_hash;
    end if;
    v_method := 'qr_pin';
    v_reason := 'invalid_pin';
  end if;

  if not coalesce(v_ok, false) then
    insert into private.attendance_attempts(user_id, session_id, reason) values (v_uid, v_session.id, v_reason);
    delete from private.attendance_attempts where created_at < now() - interval '2 days';
    return jsonb_build_object('ok', false, 'code', v_reason, 'attempts_left', greatest(c_max_fail - v_fails - 1, 0));
  end if;

  if v_session.max_checkins is not null then
    select count(*) into v_count from public.attendance_records
    where session_id = v_session.id and status in ('hadir','terlambat');
    if v_count >= v_session.max_checkins then
      return jsonb_build_object('ok', false, 'code', 'limit_reached');
    end if;
  end if;

  v_status := case when now() > v_session.starts_at + make_interval(mins => v_session.late_after_minutes)
                   then 'terlambat' else 'hadir' end;

  insert into public.attendance_records(session_id, member_id, status, method, checked_in_at, note)
  values (v_session.id, v_uid, v_status, v_method, now(), null)
  on conflict (session_id, member_id) do update
    set status = excluded.status, method = excluded.method, checked_in_at = excluded.checked_in_at,
        note = null, marked_by = null, updated_at = now()
  returning * into v_record;

  return jsonb_build_object('ok', true, 'already_checked_in', false, 'status', v_record.status,
    'checked_in_at', v_record.checked_in_at, 'session_title', v_session.title,
    'member_name', coalesce(v_member.display_name, v_member.full_name));
end;
$$;

create or replace function public.list_open_attendance_sessions()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at,
           'expires_at', s.expires_at) order by s.starts_at desc), '[]'::jsonb)
  from public.attendance_sessions s
  where (select auth.uid()) is not null and s.qr_mode = 'rotating' and s.is_active and s.status = 'active'
    and s.starts_at <= now() and (s.expires_at is null or s.expires_at > now());
$$;

create or replace function public.close_attendance_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.attendance_sessions set status = 'closed', is_active = false, updated_at = now() where id = p_session_id;
  perform private.audit('attendance.session_closed', 'attendance_session', p_session_id);
end;
$$;

create or replace function public.set_attendance_status(p_session_id uuid, p_member_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('hadir','terlambat','izin','sakit','alpa') then raise exception 'invalid_status'; end if;
  if not exists (select 1 from public.attendance_sessions where id = p_session_id) then raise exception 'session_not_found'; end if;
  insert into public.attendance_records(session_id, member_id, status, method, checked_in_at, note, marked_by)
  values (p_session_id, p_member_id, p_status, 'manual', now(), nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  on conflict (session_id, member_id) do update
    set status = excluded.status, method = 'manual', note = excluded.note,
        marked_by = excluded.marked_by, updated_at = now();
  perform private.audit('attendance.status_set', 'attendance_session', p_session_id,
    jsonb_build_object('member_id', p_member_id, 'status', p_status));
end;
$$;

create or replace function public.attendance_session_report(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.attendance_sessions;
  v_rows jsonb;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v from public.attendance_sessions where id = p_session_id;
  if not found then raise exception 'session_not_found'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.name), '[]'::jsonb) into v_rows
  from (
    select p.id as member_id,
           coalesce(p.display_name, p.full_name) as name,
           p.class_name, p.group_name,
           coalesce(ar.status, lr.type, 'belum_hadir') as status,
           ar.method, ar.checked_in_at,
           coalesce(ar.note, lr.reason) as note
    from public.profiles p
    left join public.attendance_records ar on ar.session_id = p_session_id and ar.member_id = p.id
    left join lateral (
      select l.type, l.reason from public.leave_requests l
      where l.member_id = p.id and l.status = 'disetujui'
        and (l.session_id = p_session_id or (l.session_id is null and l.leave_date = private.local_date(v.starts_at)))
      limit 1
    ) lr on true
    where p.membership_status in ('active','candidate') or ar.id is not null
  ) r;

  return jsonb_build_object(
    'session', jsonb_build_object('id', v.id, 'title', v.title, 'starts_at', v.starts_at, 'expires_at', v.expires_at,
      'status', v.status, 'mode', v.qr_mode, 'late_after_minutes', v.late_after_minutes),
    'rows', v_rows
  );
end;
$$;

create or replace function public.my_attendance_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz;
  v_result jsonb;
begin
  if v_uid is null then return null; end if;
  select coalesce(joined_at, created_at) into v_since from public.profiles where id = v_uid;
  with ended as (
    select s.id, private.local_date(s.starts_at) as d
    from public.attendance_sessions s
    where s.starts_at >= v_since and s.starts_at <= now()
      and (s.status = 'closed' or (s.expires_at is not null and s.expires_at <= now()))
  ), eff as (
    select coalesce(ar.status, lv.type, 'alpa') as status
    from ended e
    left join public.attendance_records ar on ar.session_id = e.id and ar.member_id = v_uid
    left join lateral (
      select l.type from public.leave_requests l
      where l.member_id = v_uid and l.status = 'disetujui' and (l.session_id = e.id or (l.session_id is null and l.leave_date = e.d))
      limit 1
    ) lv on true
  )
  select jsonb_build_object(
    'total', count(*),
    'hadir', count(*) filter (where status = 'hadir'),
    'terlambat', count(*) filter (where status = 'terlambat'),
    'izin', count(*) filter (where status = 'izin'),
    'sakit', count(*) filter (where status = 'sakit'),
    'alpa', count(*) filter (where status = 'alpa'),
    'percentage', case when count(*) filter (where status not in ('izin','sakit')) = 0 then null
      else round(100.0 * count(*) filter (where status in ('hadir','terlambat'))
                 / count(*) filter (where status not in ('izin','sakit'))) end
  ) into v_result from eff;
  return v_result;
end;
$$;

-- ============================================================
-- 4. LEAVE REQUESTS (izin / sakit)
-- ============================================================
create or replace function public.submit_leave_request(p_type text, p_leave_date date, p_reason text, p_session_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.profiles;
  v_session public.attendance_sessions;
  v_id uuid;
  v_today date := private.local_date(now());
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  select * into v_member from public.profiles where id = v_uid;
  if not found or v_member.membership_status in ('suspended','inactive','alumni') then
    return jsonb_build_object('ok', false, 'code', 'not_eligible');
  end if;
  if p_type not in ('izin','sakit') or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500
     or p_leave_date is null or p_leave_date < v_today - 1 or p_leave_date > v_today + 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if p_session_id is not null then
    select * into v_session from public.attendance_sessions where id = p_session_id;
    if not found or private.local_date(v_session.starts_at) <> p_leave_date or v_session.status = 'closed' then
      return jsonb_build_object('ok', false, 'code', 'invalid_session');
    end if;
  end if;
  if exists (select 1 from public.leave_requests where member_id = v_uid and leave_date = p_leave_date
             and coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
             and status in ('menunggu','disetujui')) then
    return jsonb_build_object('ok', false, 'code', 'duplicate');
  end if;

  insert into public.leave_requests(member_id, session_id, leave_date, type, reason)
  values (v_uid, p_session_id, p_leave_date, p_type, btrim(p_reason)) returning id into v_id;

  insert into public.notifications(user_id, type, title, message, link)
  select p.id, 'leave', 'Pengajuan ' || p_type || ' baru',
         coalesce(v_member.display_name, v_member.full_name) || ' mengajukan ' || p_type || ' untuk ' || to_char(p_leave_date, 'DD-MM-YYYY') || '.',
         '/admin/izin'
  from public.profiles p
  join public.role_permissions rp on rp.role = p.role and rp.permission = 'manage_attendance'
  where p.membership_status = 'active' and p.id <> v_uid;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.cancel_leave_request(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  update public.leave_requests set status = 'dibatalkan'
  where id = p_id and member_id = (select auth.uid()) and status = 'menunggu';
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', v_rows > 0);
end;
$$;

create or replace function public.review_leave_request(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.leave_requests;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision not in ('disetujui','ditolak') then raise exception 'invalid_decision'; end if;

  update public.leave_requests
  set status = p_decision, reviewed_by = (select auth.uid()), reviewed_at = now(),
      review_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id and status = 'menunggu'
  returning * into v;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_pending'); end if;

  if p_decision = 'disetujui' and v.session_id is not null then
    insert into public.attendance_records(session_id, member_id, status, method, checked_in_at, note, marked_by)
    values (v.session_id, v.member_id, v.type, 'leave', now(), v.reason, (select auth.uid()))
    on conflict (session_id, member_id) do update
      set status = excluded.status, method = 'leave', note = excluded.note,
          marked_by = excluded.marked_by, updated_at = now()
    where public.attendance_records.status not in ('hadir','terlambat');
  end if;

  insert into public.notifications(user_id, type, title, message, link)
  values (v.member_id, 'leave',
    case when p_decision = 'disetujui' then 'Pengajuan ' || v.type || ' disetujui' else 'Pengajuan ' || v.type || ' ditolak' end,
    'Pengajuan ' || v.type || ' tanggal ' || to_char(v.leave_date, 'DD-MM-YYYY') || ' ' || p_decision || '.'
      || coalesce(' Catatan: ' || v.review_note, ''),
    '/dashboard/izin');

  perform private.audit('leave.reviewed', 'leave_request', v.id, jsonb_build_object('decision', p_decision, 'member_id', v.member_id));
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 5. DUES / KAS
-- ============================================================
create or replace function public.generate_monthly_dues(p_month integer, p_year integer, p_amount bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not (select private.has_permission('manage_finance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_month not between 1 and 12 or p_year not between 2020 and 2100 or p_amount not between 0 and 10000000 then
    raise exception 'invalid_input';
  end if;
  insert into public.dues(member_id, period_month, period_year, amount, status, created_by)
  select p.id, p_month, p_year, p_amount, 'belum', (select auth.uid())
  from public.profiles p where p.membership_status = 'active'
  on conflict (member_id, period_month, period_year) do nothing;
  get diagnostics v_count = row_count;
  perform private.audit('finance.dues_generated', 'dues', null, jsonb_build_object('month', p_month, 'year', p_year, 'amount', p_amount, 'created', v_count));
  return v_count;
end;
$$;

create or replace function public.set_due_paid(p_due_id uuid, p_paid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.dues;
  v_name text;
begin
  if not (select private.has_permission('manage_finance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v from public.dues where id = p_due_id for update;
  if not found then raise exception 'due_not_found'; end if;

  if p_paid then
    update public.dues set status = 'lunas', paid_at = now() where id = p_due_id;
    select coalesce(display_name, full_name) into v_name from public.profiles where id = v.member_id;
    insert into public.finance_transactions(type, category, amount, description, transaction_date, member_id, due_id, created_by)
    values ('pemasukan', 'kas', v.amount,
            'Iuran kas ' || lpad(v.period_month::text, 2, '0') || '/' || v.period_year || ' - ' || coalesce(v_name, ''),
            private.local_date(now()), v.member_id, v.id, (select auth.uid()))
    on conflict (due_id) where due_id is not null do nothing;
  else
    update public.dues set status = 'belum', paid_at = null where id = p_due_id;
    delete from public.finance_transactions where due_id = p_due_id;
  end if;
  perform private.audit('finance.due_' || case when p_paid then 'paid' else 'unpaid' end, 'dues', p_due_id);
end;
$$;

create or replace function public.finance_summary(p_year integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_months jsonb; v_balance bigint;
begin
  if not (select private.has_permission('manage_finance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select coalesce(sum(case when type = 'pemasukan' then amount else -amount end), 0) into v_balance from public.finance_transactions;
  select coalesce(jsonb_agg(jsonb_build_object('month', m,
    'income', coalesce((select sum(amount) from public.finance_transactions where type = 'pemasukan' and extract(year from transaction_date) = p_year and extract(month from transaction_date) = m), 0),
    'expense', coalesce((select sum(amount) from public.finance_transactions where type = 'pengeluaran' and extract(year from transaction_date) = p_year and extract(month from transaction_date) = m), 0)
  ) order by m), '[]'::jsonb) into v_months from generate_series(1, 12) m;
  return jsonb_build_object('balance', v_balance, 'months', v_months);
end;
$$;

-- ============================================================
-- 6. ADMIN OVERVIEW (one round trip for the dashboard)
-- ============================================================
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_can_att boolean := (select private.has_permission('manage_attendance'));
  v_can_fin boolean := (select private.has_permission('manage_finance'));
  v_today date := private.local_date(now());
  v_members jsonb;
  v_att jsonb;
  v_fin jsonb;
  v_audit jsonb;
  v_active integer;
begin
  if not (select public.is_staff()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where membership_status = 'active'),
    'candidate', count(*) filter (where membership_status = 'candidate'),
    'inactive', count(*) filter (where membership_status = 'inactive'),
    'alumni', count(*) filter (where membership_status = 'alumni'),
    'suspended', count(*) filter (where membership_status = 'suspended')
  ), count(*) filter (where membership_status = 'active') into v_members, v_active from public.profiles;

  if v_can_att then
    select jsonb_build_object(
      'open_sessions', (select count(*) from public.attendance_sessions where is_active and status = 'active' and starts_at <= now() and (expires_at is null or expires_at > now())),
      'sessions_30d', (select count(*) from public.attendance_sessions where starts_at > now() - interval '30 days' and starts_at <= now()),
      'present_30d', (select count(*) from public.attendance_records ar join public.attendance_sessions s on s.id = ar.session_id
                      where s.starts_at > now() - interval '30 days' and ar.status in ('hadir','terlambat')),
      'late_30d', (select count(*) from public.attendance_records ar join public.attendance_sessions s on s.id = ar.session_id
                   where s.starts_at > now() - interval '30 days' and ar.status = 'terlambat'),
      'leave_pending', (select count(*) from public.leave_requests where status = 'menunggu'),
      'leave_today', (select count(*) from public.leave_requests where status = 'disetujui' and leave_date = v_today)
    ) into v_att;
  end if;

  if v_can_fin then
    select jsonb_build_object(
      'balance', coalesce((select sum(case when type = 'pemasukan' then amount else -amount end) from public.finance_transactions), 0),
      'income_month', coalesce((select sum(amount) from public.finance_transactions where type = 'pemasukan' and date_trunc('month', transaction_date) = date_trunc('month', v_today)), 0),
      'expense_month', coalesce((select sum(amount) from public.finance_transactions where type = 'pengeluaran' and date_trunc('month', transaction_date) = date_trunc('month', v_today)), 0),
      'dues_paid', (select count(*) from public.dues where period_month = extract(month from v_today) and period_year = extract(year from v_today) and status = 'lunas'),
      'dues_unpaid', (select count(*) from public.dues where period_month = extract(month from v_today) and period_year = extract(year from v_today) and status <> 'lunas')
    ) into v_fin;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'entity_type', a.entity_type,
           'created_at', a.created_at, 'actor', coalesce(p.display_name, p.full_name)) order by a.created_at desc), '[]'::jsonb)
  into v_audit
  from (select * from public.audit_logs order by created_at desc limit 8) a
  left join public.profiles p on p.id = a.actor_id;

  return jsonb_build_object(
    'members', v_members,
    'registrations_pending', (select count(*) from public.form_submissions where status in ('submitted','reviewing')),
    'permission_requests_pending', (select count(*) from public.permission_requests where status = 'pending'),
    'attendance', v_att,
    'finance', v_fin,
    'recent_audit', v_audit
  );
end;
$$;

-- ============================================================
-- 7. GRANTS (legacy unthrottled endpoints are closed)
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_attendance_session_v2(uuid,text,timestamptz,timestamptz,text,integer,integer,text,integer)',
    'public.issue_attendance_qr(uuid)',
    'public.get_attendance_session_v2(text,text)',
    'public.check_in_attendance_v2(text,text,text)',
    'public.list_open_attendance_sessions()',
    'public.close_attendance_session(uuid)',
    'public.set_attendance_status(uuid,uuid,text,text)',
    'public.attendance_session_report(uuid)',
    'public.my_attendance_summary()',
    'public.submit_leave_request(text,date,text,uuid)',
    'public.cancel_leave_request(uuid)',
    'public.review_leave_request(uuid,text,text)',
    'public.generate_monthly_dues(integer,integer,bigint)',
    'public.set_due_paid(uuid,boolean)',
    'public.finance_summary(integer)',
    'public.admin_overview()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.get_attendance_session_v2(text,text) to anon;

revoke all on function public.check_in_attendance(text,text) from public, anon, authenticated;
revoke all on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.get_attendance_session(text) from public, anon, authenticated;

comment on function public.check_in_attendance_v2(text,text,text) is 'Throttled check-in: signed rotating QR or 6-digit code, 5 failures per 10 minutes per member and session.';
