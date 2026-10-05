-- KIWANTIKA Phase 8
-- Member lifecycle, trusted notification workflow, and resilient QR attendance windows.

-- ============================================================
-- MEMBER LIFECYCLE
-- ============================================================
create table if not exists public.member_status_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  from_status public.membership_status,
  to_status public.membership_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists member_status_history_member_idx
  on public.member_status_history(member_id, created_at desc);

alter table public.member_status_history enable row level security;
revoke all on public.member_status_history from anon;

create policy "members read own lifecycle"
  on public.member_status_history for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select private.has_permission('manage_members'))
  );

revoke insert, update, delete on public.member_status_history from anon, authenticated;

create or replace function public.audit_member_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.membership_status is distinct from new.membership_status then
    insert into public.member_status_history(member_id, from_status, to_status, changed_by, note)
    values (new.id, old.membership_status, new.membership_status, (select auth.uid()), null);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_member_lifecycle_history on public.profiles;
create trigger profiles_member_lifecycle_history
after update of membership_status on public.profiles
for each row execute function public.audit_member_lifecycle();

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
drop policy if exists "own notifications" on public.notifications;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_permission('manage_notifications'))
  );

create policy "own notifications mark read"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if old.role is distinct from new.role then
    v_title := 'Role akun diperbarui';
    v_message := 'Role akun kamu sekarang: ' || replace(new.role::text, '_', ' ') || '.';
    insert into public.notifications(user_id, type, title, message, link)
    values (new.id, 'account', v_title, v_message, '/dashboard/profil');
  end if;

  if old.membership_status is distinct from new.membership_status then
    v_title := 'Status keanggotaan diperbarui';
    v_message := 'Status keanggotaan kamu sekarang: ' || replace(new.membership_status::text, '_', ' ') || '.';
    insert into public.notifications(user_id, type, title, message, link)
    values (new.id, 'membership', v_title, v_message, '/dashboard');
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_lifecycle_notifications on public.profiles;
create trigger profiles_lifecycle_notifications
after update of role, membership_status on public.profiles
for each row execute function public.notify_profile_lifecycle();

create or replace function public.notify_permission_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications(user_id, type, title, message, link)
    values (
      new.member_id,
      'permission',
      case when new.status = 'approved' then 'Perizinan disetujui' else 'Perizinan diperbarui' end,
      case when new.status = 'approved'
        then 'Pengajuan perizinan kamu telah disetujui.'
        else 'Status pengajuan perizinan kamu berubah menjadi ' || new.status || '.'
      end,
      '/dashboard/perizinan'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists permission_status_notifications on public.permission_requests;
create trigger permission_status_notifications
after update of status on public.permission_requests
for each row execute function public.notify_permission_status_change();

-- ============================================================
-- RESILIENT ATTENDANCE CREATION
-- ============================================================
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
  v_expires_at timestamptz;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized';
  end if;
  if length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if length(p_token) < 24 then raise exception 'invalid_token'; end if;
  if p_pin !~ '^[0-9]{3,8}$' then raise exception 'invalid_pin'; end if;
  if p_starts_at is null then raise exception 'invalid_start_time'; end if;

  -- An omitted end time means a two-hour session. This removes the fragile
  -- client-side dependency on a second datetime-local field.
  v_expires_at := coalesce(p_expires_at, p_starts_at + interval '2 hours');

  if v_expires_at <= p_starts_at then
    raise exception 'invalid_time_window: end_time_must_be_after_start_time';
  end if;

  if p_max_checkins is not null and p_max_checkins < 1 then
    raise exception 'invalid_max_checkins';
  end if;

  insert into public.attendance_sessions
    (event_id,title,token_hash,pin_hash,starts_at,expires_at,created_by,is_active,status,max_checkins)
  values (
    p_event_id,
    trim(p_title),
    encode(extensions.digest(p_token, 'sha256'), 'hex'),
    encode(extensions.digest(p_pin, 'sha256'), 'hex'),
    p_starts_at,
    v_expires_at,
    (select auth.uid()),
    true,
    'active',
    p_max_checkins
  )
  returning * into v;

  return v;
end;
$$;

revoke all on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) to authenticated;

-- Keep QR lookup usable from a camera/browser before authentication, but never
-- expose token/PIN hashes.
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
    and s.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_attendance_session(text) from public, anon, authenticated;
grant execute on function public.get_attendance_session(text) to anon, authenticated;

comment on table public.member_status_history is 'Immutable member lifecycle history generated by trusted profile triggers.';
comment on function public.create_attendance_session(uuid,text,text,text,timestamptz,timestamptz,integer) is 'Resilient QR session creation with a two-hour default end time.';
