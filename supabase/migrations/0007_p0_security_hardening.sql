-- KIWANTIKA P0 security hardening
-- Goals:
-- 1. Centralize role -> permission mapping.
-- 2. Narrow staff access by permission instead of one broad is_staff() gate.
-- 3. Prevent client-side privilege escalation and forged audit/submission events.
-- 4. Prevent members from self-approving permissions or changing protected profile fields.
-- 5. Keep privileged helpers outside the exposed API schema.

create schema if not exists private;

create table if not exists public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions(role, permission) values
  ('super_admin','manage_members'),
  ('super_admin','manage_roles'),
  ('super_admin','manage_content'),
  ('super_admin','manage_forms'),
  ('super_admin','manage_registrations'),
  ('super_admin','manage_attendance'),
  ('super_admin','manage_permissions'),
  ('super_admin','manage_progress'),
  ('super_admin','manage_notifications'),
  ('super_admin','manage_finance'),
  ('super_admin','manage_gallery'),
  ('super_admin','view_audit'),
  ('admin','manage_members'),
  ('admin','manage_content'),
  ('admin','manage_forms'),
  ('admin','manage_registrations'),
  ('admin','manage_attendance'),
  ('admin','manage_permissions'),
  ('admin','manage_notifications'),
  ('admin','manage_gallery'),
  ('admin','view_audit'),
  ('pembina','manage_members'),
  ('pembina','manage_attendance'),
  ('pembina','manage_permissions'),
  ('pembina','manage_progress'),
  ('pembina','manage_notifications'),
  ('pembina','manage_gallery'),
  ('dewan','manage_attendance'),
  ('dewan','manage_permissions'),
  ('dewan','manage_progress'),
  ('dewan','manage_notifications'),
  ('dewan','manage_gallery')
on conflict (role, permission) do nothing;

alter table public.role_permissions enable row level security;
revoke all on table public.role_permissions from anon, authenticated;


create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = (select auth.uid())
      and rp.permission = p_permission
  );
$$;

revoke all on function private.has_permission(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- Protect role_permissions itself from Data API access.
revoke all on table public.role_permissions from anon, authenticated;

-- Profile hardening: members can edit their own non-privileged identity fields;
-- management can edit member data; only super_admin can change roles.
drop policy if exists "staff manage profiles" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update safe fields"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "members manage profiles"
  on public.profiles for all
  to authenticated
  using ((select private.has_permission('manage_members')))
  with check ((select private.has_permission('manage_members')));

-- Only super_admin may mutate a role; the trigger in 0006 remains the final guard.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_super_admins integer;
begin
  if old.role is distinct from new.role then
    if not (select private.has_permission('manage_roles')) then
      raise exception 'only_super_admin_can_change_role';
    end if;

    if old.role = 'super_admin' and new.role <> 'super_admin' then
      select count(*) into v_super_admins
      from public.profiles
      where role = 'super_admin' and id <> old.id;
      if v_super_admins < 1 then
        raise exception 'at_least_one_super_admin_required';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Prevent members from forging workflow/audit fields while still allowing their own profile edits.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.id = (select auth.uid()) and not (select private.has_permission('manage_members')) then
    if old.role is distinct from new.role
       or old.membership_status is distinct from new.membership_status
       or old.joined_at is distinct from new.joined_at then
      raise exception 'protected_profile_fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privileged_fields_guard on public.profiles;
create trigger profiles_privileged_fields_guard
before update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

-- Audit logs are system-generated. Clients must not be able to forge actor identity.
drop policy if exists "authenticated audit insert" on public.audit_logs;
revoke insert, update, delete on public.audit_logs from anon, authenticated;
create policy "authorized audit read"
  on public.audit_logs for select
  to authenticated
  using ((select private.has_permission('view_audit')));

-- Audit role/profile changes from trusted triggers only.
create or replace function public.audit_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'role_changed', 'profile', new.id,
      jsonb_build_object('from', old.role, 'to', new.role));
  elsif old.full_name is distinct from new.full_name
     or old.class_name is distinct from new.class_name
     or old.membership_status is distinct from new.membership_status
     or old.group_name is distinct from new.group_name then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'profile_updated', 'profile', new.id,
      jsonb_build_object('full_name', new.full_name, 'class_name', new.class_name,
        'membership_status', new.membership_status, 'group_name', new.group_name));
  end if;
  return new;
end;
$$;

-- Permission requests: members may create/read their own requests, but only authorized
-- staff can change workflow state or reviewer fields.
drop policy if exists "own permission update" on public.permission_requests;
drop policy if exists "staff manage permission" on public.permission_requests;
create policy "authorized permission management"
  on public.permission_requests for all
  to authenticated
  using ((select private.has_permission('manage_permissions')))
  with check ((select private.has_permission('manage_permissions')));

-- Keep member insert and select policies from 0001.

-- Submission workflow must go through the atomic RPC; direct client inserts and event forging are disabled.
drop policy if exists "create own submissions" on public.form_submissions;
drop policy if exists "staff manage submissions" on public.form_submissions;
create policy "authorized registration management"
  on public.form_submissions for all
  to authenticated
  using ((select private.has_permission('manage_registrations')))
  with check ((select private.has_permission('manage_registrations')));

-- Applicants can still read their own submissions through "own submissions".
revoke insert on public.form_submissions from anon, authenticated;
revoke update, delete on public.form_submissions from anon, authenticated;

-- Direct answer creation is disabled; submit_form creates answers atomically.
drop policy if exists "create submission answers" on public.form_submission_answers;
drop policy if exists "staff manage submission answers" on public.form_submission_answers;
create policy "authorized submission answer management"
  on public.form_submission_answers for all
  to authenticated
  using ((select private.has_permission('manage_registrations')))
  with check ((select private.has_permission('manage_registrations')));
revoke insert, update, delete on public.form_submission_answers from anon, authenticated;

-- Submission event history is append-only and generated by trusted workflow code.
drop policy if exists "staff create submission events" on public.form_submission_events;
revoke insert, update, delete on public.form_submission_events from anon, authenticated;
create policy "authorized submission event read"
  on public.form_submission_events for select
  to authenticated
  using (
    exists (
      select 1 from public.form_submissions s
      where s.id = submission_id
        and (s.applicant_id = (select auth.uid()) or (select private.has_permission('manage_registrations')))
    )
  );

create or replace function public.audit_submission_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.form_submission_events(
      submission_id, actor_id, event_type, from_status, to_status, metadata
    ) values (
      new.id, (select auth.uid()), 'status_changed', old.status::text, new.status::text,
      jsonb_build_object('source','database_trigger')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists form_submission_status_audit on public.form_submissions;
create trigger form_submission_status_audit
after update of status on public.form_submissions
for each row execute function public.audit_submission_status_change();

-- Permission and progress access use explicit permissions rather than generic staff access.
drop policy if exists "staff manage attendance" on public.attendance_records;
create policy "authorized attendance management"
  on public.attendance_records for all to authenticated
  using ((select private.has_permission('manage_attendance')))
  with check ((select private.has_permission('manage_attendance')));

drop policy if exists "staff manage sessions" on public.attendance_sessions;
create policy "authorized attendance sessions"
  on public.attendance_sessions for all to authenticated
  using ((select private.has_permission('manage_attendance')))
  with check ((select private.has_permission('manage_attendance')));

drop policy if exists "staff manage sku progress" on public.sku_progress;
create policy "authorized sku management"
  on public.sku_progress for all to authenticated
  using ((select private.has_permission('manage_progress')))
  with check ((select private.has_permission('manage_progress')));

drop policy if exists "staff manage tkk" on public.tkk_progress;
create policy "authorized tkk management"
  on public.tkk_progress for all to authenticated
  using ((select private.has_permission('manage_progress')))
  with check ((select private.has_permission('manage_progress')));

-- Finance is intentionally restricted to super_admin/admin through permissions.
drop policy if exists "staff manage finance" on public.finance_transactions;
drop policy if exists "staff read finance" on public.finance_transactions;
create policy "authorized finance management"
  on public.finance_transactions for all to authenticated
  using ((select private.has_permission('manage_finance')))
  with check ((select private.has_permission('manage_finance')));

-- Notifications: members can read/update their own; only authorized staff can create.
drop policy if exists "staff create notifications" on public.notifications;
create policy "authorized notification creation"
  on public.notifications for insert to authenticated
  with check ((select private.has_permission('manage_notifications')));

-- Conversations: a member may add themselves, but cannot move/edit membership rows arbitrarily.
drop policy if exists "conversation members manage membership" on public.conversation_members;
create policy "conversation members insert self"
  on public.conversation_members for insert to authenticated
  with check (user_id = (select auth.uid()) or (select private.has_permission('manage_members')));
create policy "conversation members delete self"
  on public.conversation_members for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('manage_members')));
create policy "authorized conversation membership update"
  on public.conversation_members for update to authenticated
  using ((select private.has_permission('manage_members')))
  with check ((select private.has_permission('manage_members')));

-- Content/gallery/form management is permission-scoped.
drop policy if exists "staff manage articles" on public.articles;
create policy "authorized article management" on public.articles for all to authenticated
  using ((select private.has_permission('manage_content')))
  with check ((select private.has_permission('manage_content')));

drop policy if exists "staff manage events" on public.events;
create policy "authorized event management" on public.events for all to authenticated
  using ((select private.has_permission('manage_content')))
  with check ((select private.has_permission('manage_content')));

drop policy if exists "staff manage forms" on public.forms;
create policy "authorized form management" on public.forms for all to authenticated
  using ((select private.has_permission('manage_forms')))
  with check ((select private.has_permission('manage_forms')));

drop policy if exists "staff manage form versions" on public.form_versions;
create policy "authorized form version management" on public.form_versions for all to authenticated
  using ((select private.has_permission('manage_forms')))
  with check ((select private.has_permission('manage_forms')));

drop policy if exists "staff manage form fields" on public.form_fields;
create policy "authorized form field management" on public.form_fields for all to authenticated
  using ((select private.has_permission('manage_forms')))
  with check ((select private.has_permission('manage_forms')));

drop policy if exists "staff manage albums" on public.albums;
create policy "authorized album management" on public.albums for all to authenticated
  using ((select private.has_permission('manage_gallery')))
  with check ((select private.has_permission('manage_gallery')));

drop policy if exists "staff manage photos" on public.photos;
create policy "authorized photo management" on public.photos for all to authenticated
  using ((select private.has_permission('manage_gallery')))
  with check ((select private.has_permission('manage_gallery')));

-- Public functions: the form submission RPC is the only client write path.
create or replace function public.submit_form(
  p_form_id uuid,
  p_form_version_id uuid,
  p_submission_number text,
  p_applicant_id uuid,
  p_answers jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.forms%rowtype;
  v_version public.form_versions%rowtype;
  v_submission uuid;
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if p_submission_number is null or length(trim(p_submission_number)) < 4 then
    raise exception 'INVALID_SUBMISSION_NUMBER';
  end if;

  if p_applicant_id is not null and p_applicant_id <> v_user then
    raise exception 'INVALID_APPLICANT';
  end if;

  select * into v_form
  from public.forms
  where id = p_form_id and status = 'published';
  if not found then raise exception 'FORM_NOT_AVAILABLE'; end if;

  select * into v_version
  from public.form_versions
  where id = p_form_version_id and form_id = p_form_id and published_at is not null;
  if not found then raise exception 'INVALID_FORM_VERSION'; end if;

  if v_form.requires_auth and v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then raise exception 'FORM_NOT_OPEN'; end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then raise exception 'FORM_CLOSED'; end if;

  if v_form.max_submissions is not null then
    select count(*) into v_count
    from public.form_submissions
    where form_id = p_form_id and status <> 'withdrawn';
    if v_count >= v_form.max_submissions then raise exception 'FORM_LIMIT_REACHED'; end if;
  end if;

  if not v_form.allow_multiple and v_user is not null and exists (
    select 1 from public.form_submissions
    where form_id = p_form_id and applicant_id = v_user and status <> 'withdrawn'
  ) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

  if exists (
    select 1
    from public.form_fields f
    where f.form_version_id = p_form_version_id
      and f.required = true
      and not (coalesce(p_answers,'{}'::jsonb) ? f.field_key)
  ) then
    raise exception 'REQUIRED_FIELD_MISSING';
  end if;

  insert into public.form_submissions(
    form_id, form_version_id, applicant_id, submission_number, status, answers_snapshot, submitted_at
  ) values (
    p_form_id, p_form_version_id, coalesce(p_applicant_id, v_user),
    trim(p_submission_number), 'submitted', coalesce(p_answers,'{}'::jsonb), now()
  ) returning id into v_submission;

  insert into public.form_submission_answers(submission_id, field_id, value_text, value_json)
  select v_submission, f.id,
    case when jsonb_typeof(coalesce(p_answers,'{}'::jsonb) -> f.field_key) = 'string'
      then p_answers ->> f.field_key else null end,
    case when jsonb_typeof(coalesce(p_answers,'{}'::jsonb) -> f.field_key) = 'string'
      then null else p_answers -> f.field_key end
  from public.form_fields f
  where f.form_version_id = p_form_version_id
    and coalesce(p_answers,'{}'::jsonb) ? f.field_key;

  insert into public.form_submission_events(
    submission_id, actor_id, event_type, to_status, metadata
  ) values (
    v_submission, v_user, 'submitted', 'submitted',
    jsonb_build_object('submission_number', trim(p_submission_number))
  );

  return v_submission;
end;
$$;

revoke all on function public.submit_form(uuid,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.submit_form(uuid,uuid,text,uuid,jsonb) to anon, authenticated;

-- Tighten storage: staff uploads remain possible, but public media is separated from private documents.
-- Existing bucket visibility is preserved to avoid breaking current public gallery behavior.

comment on table public.role_permissions is 'Server-side RBAC matrix. Do not expose through the Data API.';
comment on function private.has_permission(text) is 'Trusted RLS helper for KIWANTIKA role permissions.';

-- Replace legacy broad staff gates with explicit permissions for remaining sensitive objects.
drop policy if exists "staff manage dues" on public.dues;
create policy "authorized dues management" on public.dues for all to authenticated
  using ((select private.has_permission('manage_finance')))
  with check ((select private.has_permission('manage_finance')));

drop policy if exists "staff manage sku items" on public.sku_items;
create policy "authorized sku item management" on public.sku_items for all to authenticated
  using ((select private.has_permission('manage_progress')))
  with check ((select private.has_permission('manage_progress')));

drop policy if exists "staff manage announcements" on public.announcements;
create policy "authorized announcement management" on public.announcements for all to authenticated
  using ((select private.has_permission('manage_content')))
  with check ((select private.has_permission('manage_content')));

drop policy if exists "staff create notifications" on public.notifications;
create policy "authorized notification creation v2" on public.notifications for insert to authenticated
  with check ((select private.has_permission('manage_notifications')));

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('manage_notifications')));

-- Conversations are not currently exposed in the UI, so keep management member-scoped.
drop policy if exists "conversation members read" on public.conversations;
create policy "conversation members read v2" on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = (select auth.uid())));
drop policy if exists "conversation messages read" on public.messages;
create policy "conversation messages read v2" on public.messages for select to authenticated
  using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())));

-- Privileged database helpers should not rely on an exposed search_path.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('super_admin','admin','pembina','dewan')
  );
$$;

-- Attendance creation is permission-scoped even when invoked through RPC.
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
  if not (select private.has_permission('manage_attendance')) then
    raise exception 'not_authorized';
  end if;
  if length(trim(p_title)) < 2 then raise exception 'invalid_title'; end if;
  if length(p_token) < 24 then raise exception 'invalid_token'; end if;
  if p_pin !~ '^[0-9]{3,8}$' then raise exception 'invalid_pin'; end if;
  if p_expires_at is not null and p_expires_at <= p_starts_at then raise exception 'invalid_time_window'; end if;
  insert into public.attendance_sessions
    (event_id,title,token_hash,pin_hash,starts_at,expires_at,created_by,is_active,status,max_checkins)
  values (
    p_event_id, trim(p_title), encode(extensions.digest(p_token, 'sha256'), 'hex'),
    encode(extensions.digest(p_pin, 'sha256'), 'hex'), p_starts_at, p_expires_at,
    (select auth.uid()), true, 'active', p_max_checkins
  ) returning * into v;
  return v;
end;
$$;

-- Storage: separate public media, member-owned private files, and privileged admin media.
drop policy if exists "auth upload own media" on storage.objects;
drop policy if exists "auth update own media" on storage.objects;
drop policy if exists "auth delete own media" on storage.objects;
create policy "secure media upload" on storage.objects for insert to authenticated
with check (
  (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('documents','submission-files') and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('public-media','event-media') and (
    (select private.has_permission('manage_gallery')) or
    (select private.has_permission('manage_content'))
  ))
);
create policy "secure media update" on storage.objects for update to authenticated
using (
  (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('documents','submission-files') and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('public-media','event-media') and (
    (select private.has_permission('manage_gallery')) or
    (select private.has_permission('manage_content'))
  ))
)
with check (
  (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('documents','submission-files') and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('public-media','event-media') and (
    (select private.has_permission('manage_gallery')) or
    (select private.has_permission('manage_content'))
  ))
);
create policy "secure media delete" on storage.objects for delete to authenticated
using (
  (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('documents','submission-files') and (storage.foldername(name))[1] = (select auth.uid())::text)
  or (bucket_id in ('public-media','event-media') and (
    (select private.has_permission('manage_gallery')) or
    (select private.has_permission('manage_content'))
  ))
);

-- Critical privilege changes require an MFA-backed Supabase session (AAL2).
-- This does not force MFA for ordinary members; it protects the highest-risk operation.
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_super_admins integer;
  v_aal text := coalesce((select auth.jwt() ->> 'aal'), 'aal1');
begin
  if old.role is distinct from new.role then
    if not (select private.has_permission('manage_roles')) then
      raise exception 'only_super_admin_can_change_role';
    end if;
    if v_aal <> 'aal2' then
      raise exception 'mfa_required_for_role_change';
    end if;
    if old.role = 'super_admin' and new.role <> 'super_admin' then
      select count(*) into v_super_admins
      from public.profiles
      where role = 'super_admin' and id <> old.id;
      if v_super_admins < 1 then
        raise exception 'at_least_one_super_admin_required';
      end if;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.guard_profile_role_change() is 'Super Admin role changes require an AAL2/MFA-backed session and never allow removal of the final Super Admin.';

-- Profiles are identity records. Do not expose INSERT/DELETE through the client Data API.
-- New profiles are created by the auth trigger; account deletion should be handled through Auth.
drop policy if exists "members manage profiles" on public.profiles;
create policy "management update profiles"
  on public.profiles for update
  to authenticated
  using ((select private.has_permission('manage_members')))
  with check ((select private.has_permission('manage_members')));
revoke insert, delete on public.profiles from anon, authenticated;
