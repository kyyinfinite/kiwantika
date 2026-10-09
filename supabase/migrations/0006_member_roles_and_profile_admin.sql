
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_admins integer;
begin
  if old.role is distinct from new.role then
    if public.current_role() <> 'super_admin' then
      raise exception 'only_super_admin_can_change_role';
    end if;

    if old.role = 'super_admin' and new.role <> 'super_admin' then
      select count(*) into v_super_admins from public.profiles where role = 'super_admin' and id <> old.id;
      if v_super_admins < 1 then
        raise exception 'at_least_one_super_admin_required';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update of role on public.profiles
for each row execute function public.guard_profile_role_change();

create or replace function public.audit_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), 'role_changed', 'profile', new.id, jsonb_build_object('from', old.role, 'to', new.role));
  elsif old.full_name is distinct from new.full_name
     or old.class_name is distinct from new.class_name
     or old.membership_status is distinct from new.membership_status
     or old.group_name is distinct from new.group_name then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), 'profile_updated', 'profile', new.id, jsonb_build_object('full_name', new.full_name, 'class_name', new.class_name, 'membership_status', new.membership_status, 'group_name', new.group_name));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_audit_changes on public.profiles;
create trigger profiles_audit_changes
after update on public.profiles
for each row execute function public.audit_profile_changes();

comment on function public.guard_profile_role_change() is 'Only super_admin may change profile roles; prevents removal of the last super admin.';
