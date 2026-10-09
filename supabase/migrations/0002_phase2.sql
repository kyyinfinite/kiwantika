create or replace function public.submit_form(
  p_form_id uuid,
  p_form_version_id uuid,
  p_submission_number text,
  p_applicant_id uuid,
  p_answers jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_form public.forms%rowtype;
  v_submission uuid;
  v_user uuid := auth.uid();
  v_count integer;
  v_open boolean;
begin
  select * into v_form from public.forms where id=p_form_id and status='published';
  if not found then raise exception 'FORM_NOT_AVAILABLE'; end if;
  if v_form.requires_auth and v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_applicant_id is not null and p_applicant_id <> v_user then raise exception 'INVALID_APPLICANT'; end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then raise exception 'FORM_NOT_OPEN'; end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then raise exception 'FORM_CLOSED'; end if;
  if v_form.max_submissions is not null then
    select count(*) into v_count from public.form_submissions where form_id=p_form_id and status <> 'withdrawn';
    if v_count >= v_form.max_submissions then raise exception 'FORM_LIMIT_REACHED'; end if;
  end if;
  if not v_form.allow_multiple and v_user is not null and exists(select 1 from public.form_submissions where form_id=p_form_id and applicant_id=v_user and status <> 'withdrawn') then raise exception 'ALREADY_SUBMITTED'; end if;
  insert into public.form_submissions(form_id,form_version_id,applicant_id,submission_number,status,answers_snapshot,submitted_at)
  values(p_form_id,p_form_version_id,coalesce(p_applicant_id,v_user),p_submission_number,'submitted',coalesce(p_answers,'{}'::jsonb),now())
  returning id into v_submission;
  insert into public.form_submission_answers(submission_id,field_id,value_text,value_json)
  select v_submission, f.id,
    case when jsonb_typeof(p_answers -> f.field_key)='string' then p_answers ->> f.field_key else null end,
    case when jsonb_typeof(p_answers -> f.field_key)='string' then null else p_answers -> f.field_key end
  from public.form_fields f
  where f.form_version_id=p_form_version_id and p_answers ? f.field_key;
  insert into public.form_submission_events(submission_id,actor_id,event_type,to_status,metadata)
  values(v_submission,v_user,'submitted','submitted',jsonb_build_object('submission_number',p_submission_number));
  return v_submission;
end;
$$;

grant execute on function public.submit_form(uuid,uuid,text,uuid,jsonb) to anon, authenticated;
