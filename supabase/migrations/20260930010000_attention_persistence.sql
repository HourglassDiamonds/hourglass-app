-- Phase 1 durable Reminder/Watching persistence. UNAPPLIED: do not deploy from this branch.
-- Prerequisite: deploy and verify 20260929113152_projectless_founder_work.sql first.
-- Do not replay historical UNAPPLIED scripts. This migration deliberately fails closed
-- when the projectless/atomic foundation is absent.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'continuum_project_jobs' and column_name = 'project_id' and is_nullable = 'YES')
    or not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'continuum_project_job_mutations' and column_name = 'project_id' and is_nullable = 'YES')
    or not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'continuum_project_job_mutations' and column_name = 'operation')
    or to_regprocedure('public.continuum_write_project_job(jsonb,uuid,text,text,jsonb,jsonb)') is null then
    raise exception 'attention migration requires verified projectless/atomic foundation';
  end if;
end $$;

alter table public.continuum_project_jobs
  add column attention_mode text not null default 'action',
  add column activation_at timestamptz,
  add column checkpoint_at timestamptz,
  add column attention_metadata jsonb;

create or replace function public.continuum_attention_metadata_v1_valid(value jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare key text;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or octet_length(value::text) > 8192
     or not (value ?& array['version','timingPrecision','timezone','originalWording',
       'referenceInstant','originalLocalDateTime','conditionPolicy','assumptions'])
     or value->'version' <> '1'::jsonb
     or value->>'timingPrecision' not in ('date-only', 'exact-instant')
     or jsonb_typeof(value->'timezone') <> 'string'
     or char_length(value->>'timezone') not between 1 and 100
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = value->>'timezone')
     or jsonb_typeof(value->'originalWording') <> 'string'
     or char_length(value->>'originalWording') not between 1 and 500
     or jsonb_typeof(value->'referenceInstant') <> 'string'
     or (value->>'referenceInstant') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$'
     or jsonb_typeof(value->'originalLocalDateTime') <> 'string'
     or char_length(value->>'originalLocalDateTime') not between 1 and 64
     or value->>'conditionPolicy' <> 'review-only'
     or jsonb_typeof(value->'assumptions') <> 'array'
     or jsonb_array_length(value->'assumptions') > 8 then return false; end if;
  for key in select jsonb_object_keys(value) loop
    if key not in ('version','timingPrecision','timezone','originalWording','referenceInstant',
      'originalLocalDateTime','conditionPolicy','conditionText','targetIdentity',
      'workstreamIdentity','obligationIdentity','sourceReference','revisionReference',
      'commitmentReference','assumptions','unscheduledConfirmed') then return false; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(value->'assumptions') item
      where jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') not between 1 and 240) then return false; end if;
  if value ? 'conditionText' and (jsonb_typeof(value->'conditionText') <> 'string'
      or char_length(value->>'conditionText') not between 1 and 500) then return false; end if;
  foreach key in array array['targetIdentity','workstreamIdentity','obligationIdentity',
      'sourceReference','revisionReference','commitmentReference'] loop
    if value ? key and (jsonb_typeof(value->key) <> 'string'
        or char_length(value->>key) not between 1 and 240) then return false; end if;
  end loop;
  if value ? 'unscheduledConfirmed' and value->'unscheduledConfirmed' <> 'true'::jsonb then return false; end if;
  return true;
end $$;

revoke all on function public.continuum_attention_metadata_v1_valid(jsonb) from public, anon, authenticated;
grant execute on function public.continuum_attention_metadata_v1_valid(jsonb) to service_role;

alter table public.continuum_project_jobs
  add constraint continuum_project_jobs_attention_mode_check
    check (attention_mode in ('action', 'reminder', 'watching')),
  add constraint continuum_project_jobs_attention_shape_check check (
    (attention_mode = 'action' and activation_at is null and checkpoint_at is null)
    or (attention_mode = 'reminder' and activation_at is not null and checkpoint_at is null
        and waiting_on_actor = 'founder' and attention_metadata is not null)
    or (attention_mode = 'watching' and activation_at is null and attention_metadata is not null
        and (checkpoint_at is not null or attention_metadata->'unscheduledConfirmed' = 'true'::jsonb))
  ),
  add constraint continuum_project_jobs_attention_metadata_check
    check (public.continuum_attention_metadata_v1_valid(attention_metadata));

create index continuum_project_jobs_unresolved_reminder_activation_idx
  on public.continuum_project_jobs (activation_at, job_id)
  where state in ('open', 'snoozed') and attention_mode = 'reminder' and activation_at is not null;
create index continuum_project_jobs_unresolved_watching_checkpoint_idx
  on public.continuum_project_jobs (checkpoint_at, job_id)
  where state in ('open', 'snoozed') and attention_mode = 'watching' and checkpoint_at is not null;

alter table public.continuum_project_job_mutations drop constraint continuum_project_job_mutations_action_check;
alter table public.continuum_project_job_mutations add constraint continuum_project_job_mutations_action_check
  check (action in ('create','resolve','cancel','snooze','unsnooze','update',
    'reschedule_attention','watch_checked','stop_watching','dependency_resolved'));

create or replace function public.continuum_write_project_job(
  p_job jsonb, p_mutation_id uuid, p_action text, p_changed_by text,
  p_prior jsonb default null, p_request jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  incoming public.continuum_project_jobs%rowtype;
  current_job public.continuum_project_jobs%rowtype;
  expected public.continuum_project_jobs%rowtype;
  applied public.continuum_project_job_mutations%rowtype;
  prior_state text;
  operation_snapshot jsonb;
  legacy_operation_snapshot jsonb;
  comparison_job jsonb;
  comparison_prior jsonb;
begin
  incoming := jsonb_populate_record(null::public.continuum_project_jobs, p_job);
  incoming.attention_mode := coalesce(incoming.attention_mode, 'action');
  if p_mutation_id is null or p_action not in ('create','resolve','cancel','snooze','unsnooze','update',
      'reschedule_attention','watch_checked','stop_watching','dependency_resolved')
     or p_changed_by is null or char_length(btrim(p_changed_by)) not between 1 and 80 then raise exception 'invalid-input'; end if;
  expected := jsonb_populate_record(null::public.continuum_project_jobs, p_prior);
  if p_prior is not null then expected.attention_mode := coalesce(expected.attention_mode, 'action'); end if;
  comparison_job := to_jsonb(incoming);
  comparison_prior := case when p_prior is null then null else to_jsonb(expected) end;
  if p_request is not null then
    if jsonb_typeof(p_request) <> 'object' then raise exception 'invalid-input'; end if;
    comparison_job := comparison_job - 'updated_at';
    if p_action = 'create' then comparison_job := comparison_job - 'job_id' - 'created_at'; end if;
    if p_action in ('resolve','dependency_resolved') then comparison_job := comparison_job - 'resolved_at'; end if;
    if p_action in ('cancel','stop_watching') then comparison_job := comparison_job - 'cancelled_at'; end if;
  end if;
  operation_snapshot := jsonb_build_object('version', 2, 'action', p_action, 'actor', p_changed_by,
    'request', p_request, 'next', comparison_job, 'canonical', to_jsonb(incoming), 'prior', comparison_prior);
  legacy_operation_snapshot := jsonb_build_object('version', 1, 'action', p_action, 'actor', p_changed_by,
    'request', p_request,
    'next', comparison_job - 'attention_mode' - 'activation_at' - 'checkpoint_at' - 'attention_metadata',
    'canonical', to_jsonb(incoming),
    'prior', case when comparison_prior is null then null else comparison_prior - 'attention_mode' - 'activation_at' - 'checkpoint_at' - 'attention_metadata' end);

  perform pg_advisory_xact_lock(hashtextextended(p_mutation_id::text, 0));
  select * into applied from public.continuum_project_job_mutations where mutation_id = p_mutation_id;
  if found then
    select * into current_job from public.continuum_project_jobs where job_id = applied.job_id;
    if applied.operation is null or (
      case when applied.operation->>'version' = '1'
        then incoming.attention_mode <> 'action' or incoming.activation_at is not null
          or incoming.checkpoint_at is not null or incoming.attention_metadata is not null
          or (applied.operation - 'canonical') is distinct from (legacy_operation_snapshot - 'canonical')
        else (applied.operation - 'canonical') is distinct from (operation_snapshot - 'canonical') end
    ) then raise exception 'idempotency-conflict'; end if;
    return jsonb_build_object('status', 'already-present', 'job', to_jsonb(current_job));
  end if;

  if incoming.project_id is not null and not exists (select 1 from public.continuum_project_profiles p
      join public.continuum_entities e on e.id = p.project_id where p.project_id = incoming.project_id and e.kind = 'project')
    then raise exception 'project-not-found'; end if;
  if incoming.associated_person_id is not null and (p_action = 'create' or
      (p_action = 'update' and incoming.associated_person_id is distinct from (p_prior->>'associated_person_id')::uuid)) then
    if not exists (select 1 from public.continuum_person_profiles where person_id = incoming.associated_person_id)
      then raise exception 'person-not-found'; end if;
    if incoming.project_id is not null and not exists (select 1 from public.continuum_relationships
      where kind = 'client-project' and status = 'active' and
      ((from_entity_id = incoming.associated_person_id and to_entity_id = incoming.project_id) or
       (to_entity_id = incoming.associated_person_id and from_entity_id = incoming.project_id)))
      then raise exception 'person-not-on-project'; end if;
  end if;

  if p_action = 'create' then
    if incoming.state <> 'open' or incoming.created_mutation_id is distinct from p_mutation_id
       or incoming.created_by is distinct from p_changed_by
       or incoming.source_system not in ('concierge-manual','continuum') then raise exception 'invalid-input'; end if;
    insert into public.continuum_project_jobs select incoming.* returning * into current_job;
  else
    select * into current_job from public.continuum_project_jobs where job_id = incoming.job_id for update;
    if not found then raise exception 'job-not-found'; end if;
    if p_prior is null or current_job is distinct from expected then raise exception 'job-write-conflict'; end if;
    if incoming.project_id is distinct from current_job.project_id then raise exception 'wrong-project'; end if;
    if current_job.state in ('resolved','cancelled') and not (current_job.state = 'resolved' and p_action in ('resolve','dependency_resolved'))
      then raise exception 'invalid-state'; end if;
    if (p_action in ('resolve','dependency_resolved') and incoming.state <> 'resolved')
       or (p_action in ('cancel','stop_watching') and incoming.state <> 'cancelled')
       or (p_action = 'snooze' and incoming.state <> 'snoozed')
       or (p_action = 'unsnooze' and (current_job.state <> 'snoozed' or incoming.state <> 'open'))
       or (p_action in ('update','reschedule_attention','watch_checked') and incoming.state <> current_job.state)
      then raise exception 'invalid-state'; end if;
    prior_state := current_job.state;
    update public.continuum_project_jobs set subject = incoming.subject, detail = incoming.detail,
      waiting_on_actor = incoming.waiting_on_actor, associated_person_id = incoming.associated_person_id,
      state = incoming.state, due_at = incoming.due_at, deferred_until = incoming.deferred_until,
      resolved_at = incoming.resolved_at, cancelled_at = incoming.cancelled_at,
      updated_at = incoming.updated_at, attention_mode = incoming.attention_mode,
      activation_at = incoming.activation_at, checkpoint_at = incoming.checkpoint_at,
      attention_metadata = incoming.attention_metadata
    where job_id = incoming.job_id returning * into current_job;
  end if;

  insert into public.continuum_project_job_mutations
    (mutation_id, job_id, project_id, action, prior_state, new_state, changed_at, changed_by, source_system, operation)
  values (p_mutation_id, current_job.job_id, current_job.project_id, p_action, prior_state,
    current_job.state, current_job.updated_at, p_changed_by,
    case when p_action = 'create' then current_job.source_system else 'concierge-manual' end, operation_snapshot);
  return jsonb_build_object('status', case when p_action = 'create' then 'created' else 'updated' end, 'job', to_jsonb(current_job));
end $$;

revoke all on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) to service_role;
comment on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) is
  'Atomic founder Open Job/history write with attention snapshot v2 and v1 retry compatibility. Service-role only.';
comment on column public.continuum_project_jobs.attention_metadata is
  'Bounded v1 interpretation metadata only. Never message bodies or an event log.';

commit;
