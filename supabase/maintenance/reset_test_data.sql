create or replace function public.reset_test_data(
  p_confirm text default '',
  p_dry_run boolean default true,
  p_keep_roles public.app_role[] default array['super_admin','admin']::public.app_role[],
  p_keep_emails text[] default '{}',
  p_keep_form_slugs text[] default array['pendaftaran-kiwantika'],
  p_wipe_audit boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_early text[] := array[
    'form_submission_events','form_submission_answers','form_submissions',
    'attendance_records','attendance_sessions',
    'photos','albums','articles','events',
    'permission_requests','notifications',
    'messages','conversation_members','conversations',
    'announcements','finance_transactions','dues',
    'sku_progress','tkk_progress'
  ];
  v_late text[] := case when p_wipe_audit then array['member_status_history','audit_logs'] else array['member_status_history'] end;
  v_table text;
  v_count bigint;
  v_kept bigint;
  v_keep_emails text[];
  v_result jsonb := '{}'::jsonb;
begin
  if not p_dry_run and p_confirm is distinct from 'HAPUS-DATA-TEST' then
    raise exception 'confirmation_required: isi p_confirm dengan HAPUS-DATA-TEST';
  end if;

  select coalesce(array_agg(lower(e)), '{}'::text[]) into v_keep_emails from unnest(p_keep_emails) as e;

  select count(*) into v_kept
  from public.profiles p
  where p.role = any(p_keep_roles) or lower(coalesce(p.email, '')) = any(v_keep_emails);

  if v_kept = 0 then
    raise exception 'no_admin_to_keep: tidak ada akun admin yang dipertahankan, proses dibatalkan';
  end if;

  foreach v_table in array v_early loop
    if to_regclass('public.' || v_table) is null then continue; end if;
    if p_dry_run then
      execute format('select count(*) from public.%I', v_table) into v_count;
    else
      execute format('delete from public.%I where true', v_table);
      get diagnostics v_count = row_count;
    end if;
    v_result := v_result || jsonb_build_object(v_table, v_count);
  end loop;

  if p_dry_run then
    select count(*) into v_count from public.forms where slug <> all(p_keep_form_slugs);
  else
    delete from public.forms where slug <> all(p_keep_form_slugs);
    get diagnostics v_count = row_count;
  end if;
  v_result := v_result || jsonb_build_object('forms', v_count);

  if p_dry_run then
    select count(*) into v_count
    from public.profiles p
    where not (p.role = any(p_keep_roles))
      and not (lower(coalesce(p.email, '')) = any(v_keep_emails));
  else
    delete from auth.users u
    using public.profiles p
    where u.id = p.id
      and not (p.role = any(p_keep_roles))
      and not (lower(coalesce(p.email, '')) = any(v_keep_emails));
    get diagnostics v_count = row_count;
  end if;
  v_result := v_result || jsonb_build_object('users', v_count, 'kept_admins', v_kept);

  foreach v_table in array v_late loop
    if to_regclass('public.' || v_table) is null then continue; end if;
    if p_dry_run then
      execute format('select count(*) from public.%I', v_table) into v_count;
    else
      execute format('delete from public.%I where true', v_table);
      get diagnostics v_count = row_count;
    end if;
    v_result := v_result || jsonb_build_object(v_table, v_count);
  end loop;

  return jsonb_build_object('dry_run', p_dry_run, 'rows', v_result);
end
$$;

revoke all on function public.reset_test_data(text, boolean, public.app_role[], text[], text[], boolean) from public, anon, authenticated;
grant execute on function public.reset_test_data(text, boolean, public.app_role[], text[], text[], boolean) to service_role;
