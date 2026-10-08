-- Phase 12: every kegiatan (event) ties together attendance, izin/sakit, and exports.
-- Requires 0011. Replaces the old Perizinan feature (permission_requests) with leave_requests.

-- ============================================================
-- 1. LEAVE REQUESTS BELONG TO AN EVENT
-- ============================================================
alter table public.leave_requests
  add column if not exists event_id uuid references public.events(id) on delete set null;
create index if not exists leave_requests_event_idx on public.leave_requests(event_id, status);

drop index if exists public.leave_requests_active_uidx;
create unique index if not exists leave_requests_active_event_uidx
  on public.leave_requests(member_id, coalesce(event_id, session_id, '00000000-0000-0000-0000-000000000000'::uuid), leave_date)
  where status in ('menunggu','disetujui');

-- Carry over history from the old Perizinan table (permission_requests).
insert into public.leave_requests(member_id, event_id, leave_date, type, reason, status, reviewed_by, reviewed_at, review_note, created_at)
select pr.member_id, pr.event_id,
       coalesce(private.local_date(e.start_at), private.local_date(pr.created_at)),
       case when pr.type = 'sakit' then 'sakit' else 'izin' end,
       case when char_length(btrim(pr.reason)) < 5 then btrim(pr.reason) || ' (perizinan lama)' else left(btrim(pr.reason), 500) end,
       case pr.status when 'approved' then 'disetujui' when 'rejected' then 'ditolak' when 'cancelled' then 'dibatalkan' else 'menunggu' end,
       pr.reviewed_by, pr.reviewed_at, pr.review_note, pr.created_at
from public.permission_requests pr
left join public.events e on e.id = pr.event_id
where not exists (
  select 1 from public.leave_requests l
  where l.member_id = pr.member_id and l.event_id is not distinct from pr.event_id and l.created_at = pr.created_at
)
on conflict do nothing;

revoke insert, update, delete on public.permission_requests from authenticated;
comment on table public.permission_requests is 'Deprecated in phase 12. Data copied into leave_requests; kept read-only for audit.';

-- ============================================================
-- 2. EFFECTIVE STATUS OF EVERY MEMBER FOR ONE EVENT
-- ============================================================
create or replace function private.event_member_status(p_event_id uuid)
returns table (member_id uuid, name text, class_name text, group_name text, status text,
               checked_in_at timestamptz, method text, note text)
language sql stable security definer set search_path = '' as $$
  with e as (
    select ev.id, ev.start_at, coalesce(ev.end_at, ev.start_at + interval '3 hours') as finish
    from public.events ev where ev.id = p_event_id
  ),
  open_now as (
    select exists (
      select 1 from public.attendance_sessions s
      where s.event_id = p_event_id and s.is_active and s.status = 'active'
        and s.starts_at <= now() and (s.expires_at is null or s.expires_at > now())
    ) as is_open
  ),
  rec as (
    select distinct on (ar.member_id) ar.member_id, ar.status, ar.checked_in_at, ar.method, ar.note
    from public.attendance_records ar
    join public.attendance_sessions s on s.id = ar.session_id
    where s.event_id = p_event_id
    order by ar.member_id,
      case ar.status when 'hadir' then 1 when 'terlambat' then 2 when 'izin' then 3 when 'sakit' then 4 else 5 end,
      ar.checked_in_at
  ),
  lv as (
    select distinct on (l.member_id) l.member_id, l.type, l.reason
    from public.leave_requests l
    where l.status = 'disetujui'
      and (l.event_id = p_event_id
           or l.session_id in (select s.id from public.attendance_sessions s where s.event_id = p_event_id))
    order by l.member_id, l.created_at
  ),
  people as (
    select p.* from public.profiles p cross join e
    where (p.membership_status in ('active','candidate') and coalesce(p.joined_at, p.created_at) <= e.finish)
       or p.id in (select r.member_id from rec r)
       or p.id in (select v.member_id from lv v)
  )
  select p.id, coalesce(p.display_name, p.full_name), p.class_name, p.group_name,
         coalesce(rec.status, lv.type,
                  case when (select now() > e.finish from e) and not (select o.is_open from open_now o)
                       then 'alpa' else 'belum_hadir' end),
         rec.checked_in_at, rec.method, coalesce(rec.note, lv.reason)
  from people p
  left join rec on rec.member_id = p.id
  left join lv on lv.member_id = p.id;
$$;
revoke all on function private.event_member_status(uuid) from public, anon, authenticated;

-- ============================================================
-- 3. EVENT REPORT, MASTER REPORT, MANUAL OVERRIDE
-- ============================================================
create or replace function public.event_attendance_report(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_event public.events;
  v_rows jsonb;
  v_sessions jsonb;
  v_leaves jsonb;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'event_not_found'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.name), '[]'::jsonb)
  into v_rows from private.event_member_status(p_event_id) r;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at,
           'expires_at', s.expires_at, 'status', s.status, 'mode', s.qr_mode) order by s.starts_at), '[]'::jsonb)
  into v_sessions from public.attendance_sessions s where s.event_id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'member_id', l.member_id,
           'name', coalesce(p.display_name, p.full_name), 'type', l.type, 'reason', l.reason,
           'status', l.status, 'review_note', l.review_note, 'created_at', l.created_at)
           order by l.created_at desc), '[]'::jsonb)
  into v_leaves
  from public.leave_requests l join public.profiles p on p.id = l.member_id
  where l.event_id = p_event_id and l.status <> 'dibatalkan';

  return jsonb_build_object(
    'event', jsonb_build_object('id', v_event.id, 'title', v_event.title, 'start_at', v_event.start_at,
      'end_at', v_event.end_at, 'location', v_event.location, 'event_type', v_event.event_type),
    'sessions', v_sessions, 'leaves', v_leaves, 'rows', v_rows
  );
end;
$$;

create or replace function public.attendance_master_report(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date := coalesce(p_from, private.local_date(now()) - 180);
  v_to date := coalesce(p_to, private.local_date(now()) + 30);
  v_events jsonb;
  v_members jsonb;
  v_cells jsonb;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with ev as (
    select t.*, (row_number() over (order by t.start_at, t.id) - 1)::int as idx
    from (
      select e.id, e.title, e.start_at, e.end_at, e.location, e.event_type
      from public.events e
      where private.local_date(e.start_at) between v_from and v_to
        and (exists (select 1 from public.attendance_sessions s where s.event_id = e.id)
             or exists (select 1 from public.leave_requests l where l.event_id = e.id and l.status = 'disetujui'))
      order by e.start_at desc
      limit 200
    ) t
  ),
  cell as (
    select ev.idx as e_idx, m.member_id, m.name, m.class_name, m.group_name, m.status, m.checked_in_at
    from ev cross join lateral private.event_member_status(ev.id) m
  ),
  mem as (
    select c.member_id, max(c.name) as name, max(c.class_name) as class_name, max(c.group_name) as group_name,
           (row_number() over (order by max(c.name), c.member_id) - 1)::int as idx
    from cell c group by c.member_id
  ),
  evsum as (
    select c.e_idx,
      count(*) as expected,
      count(*) filter (where c.status = 'hadir') as hadir,
      count(*) filter (where c.status = 'terlambat') as terlambat,
      count(*) filter (where c.status = 'izin') as izin,
      count(*) filter (where c.status = 'sakit') as sakit,
      count(*) filter (where c.status = 'alpa') as alpa,
      count(*) filter (where c.status = 'belum_hadir') as belum,
      string_agg(c.name, ', ' order by c.name) filter (where c.status in ('hadir','terlambat')) as names_hadir,
      string_agg(c.name || ' (' || c.status || ')', ', ' order by c.name) filter (where c.status in ('izin','sakit')) as names_izin,
      string_agg(c.name, ', ' order by c.name) filter (where c.status = 'alpa') as names_alpa
    from cell c group by c.e_idx
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'idx', ev.idx, 'id', ev.id, 'title', ev.title, 'start_at', ev.start_at, 'end_at', ev.end_at,
        'location', ev.location, 'event_type', ev.event_type,
        'expected', coalesce(s.expected, 0), 'hadir', coalesce(s.hadir, 0), 'terlambat', coalesce(s.terlambat, 0),
        'izin', coalesce(s.izin, 0), 'sakit', coalesce(s.sakit, 0), 'alpa', coalesce(s.alpa, 0), 'belum', coalesce(s.belum, 0),
        'names_hadir', coalesce(s.names_hadir, ''), 'names_izin', coalesce(s.names_izin, ''), 'names_alpa', coalesce(s.names_alpa, '')
      ) order by ev.idx), '[]'::jsonb)
     from ev left join evsum s on s.e_idx = ev.idx),
    (select coalesce(jsonb_agg(jsonb_build_object('idx', mem.idx, 'id', mem.member_id, 'name', mem.name,
        'class_name', mem.class_name, 'group_name', mem.group_name) order by mem.idx), '[]'::jsonb) from mem),
    (select coalesce(jsonb_agg(jsonb_build_array(c.e_idx, mem.idx, c.status, c.checked_in_at)), '[]'::jsonb)
     from cell c join mem on mem.member_id = c.member_id)
  into v_events, v_members, v_cells;

  return jsonb_build_object('from', v_from, 'to', v_to, 'generated_at', now(),
    'events', v_events, 'members', v_members, 'cells', v_cells);
end;
$$;

create or replace function public.set_event_attendance_status(p_event_id uuid, p_member_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_session uuid;
begin
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('hadir','terlambat','izin','sakit','alpa') then raise exception 'invalid_status'; end if;
  select * into v_event from public.events where id = p_event_id;
  if not found then raise exception 'event_not_found'; end if;

  select s.id into v_session from public.attendance_sessions s
  where s.event_id = p_event_id order by s.starts_at desc limit 1;

  if v_session is null then
    insert into public.attendance_sessions
      (event_id, title, starts_at, expires_at, created_by, is_active, status, qr_mode, rotate_seconds, late_after_minutes)
    values
      (p_event_id, v_event.title || ' (pencatatan manual)', v_event.start_at,
       coalesce(v_event.end_at, v_event.start_at + interval '3 hours'), (select auth.uid()), false, 'closed', 'static', 30, 15)
    returning id into v_session;
  end if;

  delete from public.attendance_records ar
  using public.attendance_sessions s
  where ar.session_id = s.id and s.event_id = p_event_id and ar.member_id = p_member_id and ar.session_id <> v_session;

  insert into public.attendance_records(session_id, member_id, status, method, checked_in_at, note, marked_by)
  values (v_session, p_member_id, p_status, 'manual', now(), nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  on conflict (session_id, member_id) do update
    set status = excluded.status, method = 'manual', note = excluded.note,
        marked_by = excluded.marked_by, updated_at = now();

  perform private.audit('attendance.event_status_set', 'event', p_event_id,
    jsonb_build_object('member_id', p_member_id, 'status', p_status));
end;
$$;

-- ============================================================
-- 4. LEAVE REQUESTS BY EVENT
-- ============================================================
create or replace function public.list_leave_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'start_at', e.start_at, 'end_at', e.end_at,
    'location', e.location, 'event_type', e.event_type,
    'leave_status', (select l.status from public.leave_requests l
                     where l.event_id = e.id and l.member_id = (select auth.uid()) and l.status in ('menunggu','disetujui') limit 1)
  ) order by e.start_at), '[]'::jsonb)
  from public.events e
  where (select auth.uid()) is not null
    and e.status = 'published' and e.visibility in ('public','members')
    and coalesce(e.end_at, e.start_at + interval '3 hours') + interval '1 day' > now()
    and e.start_at < now() + interval '120 days';
$$;

create or replace function public.submit_leave_request_v2(p_type text, p_event_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_member public.profiles;
  v_event public.events;
  v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  select * into v_member from public.profiles where id = v_uid;
  if not found or v_member.membership_status in ('suspended','inactive','alumni') then
    return jsonb_build_object('ok', false, 'code', 'not_eligible');
  end if;
  if p_type not in ('izin','sakit') or p_event_id is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_event from public.events
  where id = p_event_id and status = 'published' and visibility in ('public','members');
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_event'); end if;
  if now() > coalesce(v_event.end_at, v_event.start_at + interval '3 hours') + interval '1 day' then
    return jsonb_build_object('ok', false, 'code', 'event_passed');
  end if;
  if exists (select 1 from public.leave_requests
             where member_id = v_uid and event_id = p_event_id and status in ('menunggu','disetujui')) then
    return jsonb_build_object('ok', false, 'code', 'duplicate');
  end if;

  insert into public.leave_requests(member_id, event_id, leave_date, type, reason)
  values (v_uid, p_event_id, private.local_date(v_event.start_at), p_type, btrim(p_reason))
  returning id into v_id;

  insert into public.notifications(user_id, type, title, message, link)
  select p.id, 'leave', 'Pengajuan ' || p_type || ' baru',
         coalesce(v_member.display_name, v_member.full_name) || ' mengajukan ' || p_type || ' untuk ' || v_event.title || '.',
         '/admin/rekap/' || v_event.id::text
  from public.profiles p
  join public.role_permissions rp on rp.role = p.role and rp.permission = 'manage_attendance'
  where p.membership_status = 'active' and p.id <> v_uid;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.review_leave_request(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.leave_requests;
  v_title text;
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

  if p_decision = 'disetujui' then
    insert into public.attendance_records(session_id, member_id, status, method, checked_in_at, note, marked_by)
    select s.id, v.member_id, v.type, 'leave', now(), v.reason, (select auth.uid())
    from public.attendance_sessions s
    where s.event_id = v.event_id or s.id = v.session_id
    on conflict (session_id, member_id) do update
      set status = excluded.status, method = 'leave', note = excluded.note,
          marked_by = excluded.marked_by, updated_at = now()
    where public.attendance_records.status not in ('hadir','terlambat');
  end if;

  select e.title into v_title from public.events e where e.id = v.event_id;
  insert into public.notifications(user_id, type, title, message, link)
  values (v.member_id, 'leave',
    'Pengajuan ' || v.type || ' ' || p_decision,
    'Pengajuan ' || v.type || coalesce(' untuk ' || v_title, ' tanggal ' || to_char(v.leave_date, 'DD-MM-YYYY')) || ' ' || p_decision || '.'
      || coalesce(' Catatan: ' || v.review_note, ''),
    '/dashboard/izin');

  perform private.audit('leave.reviewed', 'leave_request', v.id,
    jsonb_build_object('decision', p_decision, 'member_id', v.member_id, 'event_id', v.event_id));
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 5. MEMBER VIEW (history and rate are per kegiatan)
-- ============================================================
create or replace function public.my_attendance_history(p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.start_at desc), '[]'::jsonb)
  from (
    select e.id as event_id, e.title, e.start_at, e.event_type, ms.status, ms.checked_in_at
    from (
      select ev.* from public.events ev
      where ev.start_at <= now()
        and (exists (select 1 from public.attendance_sessions s where s.event_id = ev.id)
             or exists (select 1 from public.leave_requests l where l.event_id = ev.id and l.member_id = (select auth.uid()) and l.status = 'disetujui'))
      order by ev.start_at desc
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    ) e
    cross join lateral private.event_member_status(e.id) ms
    where ms.member_id = (select auth.uid())
  ) x;
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

  select jsonb_build_object(
    'total', count(*),
    'hadir', count(*) filter (where t.status = 'hadir'),
    'terlambat', count(*) filter (where t.status = 'terlambat'),
    'izin', count(*) filter (where t.status = 'izin'),
    'sakit', count(*) filter (where t.status = 'sakit'),
    'alpa', count(*) filter (where t.status = 'alpa'),
    'percentage', case when count(*) filter (where t.status not in ('izin','sakit')) = 0 then null
      else round(100.0 * count(*) filter (where t.status in ('hadir','terlambat'))
                 / count(*) filter (where t.status not in ('izin','sakit'))) end
  ) into v_result
  from (
    select ms.status
    from (
      select ev.id from public.events ev
      where ev.start_at >= v_since
        and now() > coalesce(ev.end_at, ev.start_at + interval '3 hours')
        and exists (select 1 from public.attendance_sessions s where s.event_id = ev.id)
    ) e
    cross join lateral private.event_member_status(e.id) ms
    where ms.member_id = v_uid and ms.status <> 'belum_hadir'
  ) t;
  return v_result;
end;
$$;

-- ============================================================
-- 6. LIVE SESSION REPORT NOW SEES EVENT LEAVE; OVERVIEW DROPS PERIZINAN
-- ============================================================
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
    select p.id as member_id, coalesce(p.display_name, p.full_name) as name, p.class_name, p.group_name,
           coalesce(ar.status, lr.type, 'belum_hadir') as status, ar.method, ar.checked_in_at,
           coalesce(ar.note, lr.reason) as note
    from public.profiles p
    left join public.attendance_records ar on ar.session_id = p_session_id and ar.member_id = p.id
    left join lateral (
      select l.type, l.reason from public.leave_requests l
      where l.member_id = p.id and l.status = 'disetujui'
        and (l.session_id = p_session_id
             or (v.event_id is not null and l.event_id = v.event_id)
             or (l.session_id is null and l.event_id is null and l.leave_date = private.local_date(v.starts_at)))
      limit 1
    ) lr on true
    where p.membership_status in ('active','candidate') or ar.id is not null
  ) r;

  return jsonb_build_object(
    'session', jsonb_build_object('id', v.id, 'event_id', v.event_id, 'title', v.title, 'starts_at', v.starts_at,
      'expires_at', v.expires_at, 'status', v.status, 'mode', v.qr_mode, 'late_after_minutes', v.late_after_minutes),
    'rows', v_rows
  );
end;
$$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_can_att boolean := (select private.has_permission('manage_attendance'));
  v_can_fin boolean := (select private.has_permission('manage_finance'));
  v_members jsonb;
  v_att jsonb;
  v_fin jsonb;
  v_audit jsonb;
  v_upcoming jsonb;
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
  ) into v_members from public.profiles;

  if v_can_att then
    select jsonb_build_object(
      'open_sessions', (select count(*) from public.attendance_sessions where is_active and status = 'active' and starts_at <= now() and (expires_at is null or expires_at > now())),
      'sessions_30d', (select count(distinct s.event_id) from public.attendance_sessions s where s.event_id is not null and s.starts_at > now() - interval '30 days' and s.starts_at <= now()),
      'present_30d', (select count(*) from public.attendance_records ar join public.attendance_sessions s on s.id = ar.session_id
                      where s.starts_at > now() - interval '30 days' and ar.status in ('hadir','terlambat')),
      'late_30d', (select count(*) from public.attendance_records ar join public.attendance_sessions s on s.id = ar.session_id
                   where s.starts_at > now() - interval '30 days' and ar.status = 'terlambat'),
      'leave_pending', (select count(*) from public.leave_requests where status = 'menunggu'),
      'leave_today', (select count(*) from public.leave_requests where status = 'disetujui' and leave_date = private.local_date(now()))
    ) into v_att;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'start_at', e.start_at,
        'leave_pending', (select count(*) from public.leave_requests l where l.event_id = e.id and l.status = 'menunggu'),
        'leave_approved', (select count(*) from public.leave_requests l where l.event_id = e.id and l.status = 'disetujui'),
        'has_session', exists (select 1 from public.attendance_sessions s where s.event_id = e.id)
      ) order by e.start_at), '[]'::jsonb)
    into v_upcoming
    from (select ev.* from public.events ev
          where ev.status = 'published' and coalesce(ev.end_at, ev.start_at + interval '3 hours') >= now()
          order by ev.start_at limit 5) e;
  end if;

  if v_can_fin then
    select jsonb_build_object(
      'balance', coalesce((select sum(case when type = 'pemasukan' then amount else -amount end) from public.finance_transactions), 0),
      'income_month', coalesce((select sum(amount) from public.finance_transactions where type = 'pemasukan' and date_trunc('month', transaction_date) = date_trunc('month', private.local_date(now()))), 0),
      'expense_month', coalesce((select sum(amount) from public.finance_transactions where type = 'pengeluaran' and date_trunc('month', transaction_date) = date_trunc('month', private.local_date(now()))), 0),
      'dues_paid', (select count(*) from public.dues where period_month = extract(month from private.local_date(now())) and period_year = extract(year from private.local_date(now())) and status = 'lunas'),
      'dues_unpaid', (select count(*) from public.dues where period_month = extract(month from private.local_date(now())) and period_year = extract(year from private.local_date(now())) and status <> 'lunas')
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
    'attendance', v_att,
    'upcoming', v_upcoming,
    'finance', v_fin,
    'recent_audit', v_audit
  );
end;
$$;

-- ============================================================
-- 7. GRANTS
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.event_attendance_report(uuid)',
    'public.attendance_master_report(date,date)',
    'public.set_event_attendance_status(uuid,uuid,text,text)',
    'public.list_leave_events()',
    'public.submit_leave_request_v2(text,uuid,text)',
    'public.review_leave_request(uuid,text,text)',
    'public.my_attendance_history(integer)',
    'public.my_attendance_summary()',
    'public.attendance_session_report(uuid)',
    'public.admin_overview()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke all on function public.submit_leave_request(text,date,text,uuid) from public, anon, authenticated;
