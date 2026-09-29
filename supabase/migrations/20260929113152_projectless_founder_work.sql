-- Local migration only. Apply explicitly after review; do not replay historical UNAPPLIED scripts.
begin;

-- Both columns must change together: every canonical Job write requires a history
-- row in the same transaction, including founder work without Project context.
-- DROP NOT NULL preserves existing foreign keys (ON DELETE RESTRICT), checks and indexes.
alter table public.continuum_project_jobs alter column project_id drop not null;
alter table public.continuum_project_job_mutations alter column project_id drop not null;

-- Immutable full operation snapshot. NULL is reserved for historical rows whose
-- intent cannot be reconstructed safely; their IDs fail closed on retry.
alter table public.continuum_project_job_mutations add column operation jsonb;

-- Called only by the existing authenticated founder application's service-role writer.
-- SECURITY INVOKER preserves caller privileges/RLS. No browser-role access is granted.
create or replace function public.continuum_write_project_job(
  p_job jsonb,
  p_mutation_id uuid,
  p_action text,
  p_changed_by text,
  p_prior jsonb default null,
  p_request jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  incoming public.continuum_project_jobs%rowtype;
  current_job public.continuum_project_jobs%rowtype;
  expected public.continuum_project_jobs%rowtype;
  applied public.continuum_project_job_mutations%rowtype;
  prior_state text;
  operation_snapshot jsonb;
  comparison_job jsonb;
begin
  incoming := jsonb_populate_record(null::public.continuum_project_jobs, p_job);
  if p_mutation_id is null or p_action is null
     or p_action not in ('create', 'resolve', 'cancel', 'snooze', 'unsnooze', 'update')
     or p_changed_by is null or char_length(btrim(p_changed_by)) not between 1 and 80 then
    raise exception 'invalid-input';
  end if;

  expected := jsonb_populate_record(null::public.continuum_project_jobs, p_prior);
  comparison_job := to_jsonb(incoming);
  if p_request is not null then
    if jsonb_typeof(p_request) <> 'object' then raise exception 'invalid-input'; end if;
    -- The authenticated application allocates IDs/clock values on each attempt.
    -- Its complete, lossless caller request is compared as well as canonical data.
    -- Direct SQL callers without a request compare ALL fields, including IDs/time.
    comparison_job := comparison_job - 'updated_at';
    if p_action = 'create' then comparison_job := comparison_job - 'job_id' - 'created_at'; end if;
    if p_action = 'resolve' then comparison_job := comparison_job - 'resolved_at'; end if;
    if p_action = 'cancel' then comparison_job := comparison_job - 'cancelled_at'; end if;
  end if;
  operation_snapshot := jsonb_build_object('version', 1, 'action', p_action,
    'actor', p_changed_by, 'request', p_request, 'next', comparison_job,
    'canonical', to_jsonb(incoming),
    'prior', case when p_prior is null then null else to_jsonb(expected) end);

  -- Serialize retries even before a create has a canonical row to lock.
  perform pg_advisory_xact_lock(hashtextextended(p_mutation_id::text, 0));
  select * into applied from public.continuum_project_job_mutations
    where mutation_id = p_mutation_id;
  if found then
    select * into current_job from public.continuum_project_jobs where job_id = applied.job_id;
    if applied.operation is null or (applied.operation - 'canonical') is distinct from (operation_snapshot - 'canonical') then
      raise exception 'idempotency-conflict';
    end if;
    return jsonb_build_object('status', 'already-present', 'job', to_jsonb(current_job));
  end if;

  if incoming.project_id is not null then
    if not exists (select 1 from public.continuum_project_profiles p
       join public.continuum_entities e on e.id = p.project_id
       where p.project_id = incoming.project_id and e.kind = 'project') then
      raise exception 'project-not-found';
    end if;
  end if;
  -- Preserve existing resolve/cancel/snooze behavior when an old relationship
  -- has since ended; validate associations at creation or when explicitly changed.
  if incoming.associated_person_id is not null and (p_action = 'create'
      or (p_action = 'update' and incoming.associated_person_id is distinct from
          (p_prior->>'associated_person_id')::uuid)) then
    if not exists (select 1 from public.continuum_person_profiles
                   where person_id = incoming.associated_person_id) then
      raise exception 'person-not-found';
    end if;
    if incoming.project_id is not null and not exists (
      select 1 from public.continuum_relationships
      where kind = 'client-project' and status = 'active'
      and ((from_entity_id = incoming.associated_person_id and to_entity_id = incoming.project_id)
        or (to_entity_id = incoming.associated_person_id and from_entity_id = incoming.project_id))
    ) then
      raise exception 'person-not-on-project';
    end if;
  end if;

  if p_action = 'create' then
    if incoming.state <> 'open' or incoming.created_mutation_id is distinct from p_mutation_id
       or incoming.created_by is distinct from p_changed_by
       or incoming.source_system not in ('concierge-manual', 'continuum') then
      raise exception 'invalid-input';
    end if;
    insert into public.continuum_project_jobs select incoming.* returning * into current_job;
  else
    select * into current_job from public.continuum_project_jobs
      where job_id = incoming.job_id for update;
    if not found then raise exception 'job-not-found'; end if;
    -- Compare the full typed prior row, avoiding timestamp string formatting issues
    -- and lost updates when two founder operations read the same canonical version.
    if p_prior is null or current_job is distinct from expected then
      raise exception 'job-write-conflict';
    end if;
    if incoming.project_id is distinct from current_job.project_id then
      raise exception 'wrong-project';
    end if;
    if current_job.state in ('resolved', 'cancelled')
       and not (current_job.state = 'resolved' and p_action = 'resolve') then
      raise exception 'invalid-state';
    end if;
    if (p_action = 'resolve' and incoming.state <> 'resolved')
       or (p_action = 'cancel' and incoming.state <> 'cancelled')
       or (p_action = 'snooze' and incoming.state <> 'snoozed')
       or (p_action = 'unsnooze' and (current_job.state <> 'snoozed' or incoming.state <> 'open'))
       or (p_action = 'update' and incoming.state <> current_job.state) then
      raise exception 'invalid-state';
    end if;
    prior_state := current_job.state;
    update public.continuum_project_jobs set
      subject = incoming.subject, detail = incoming.detail,
      waiting_on_actor = incoming.waiting_on_actor,
      associated_person_id = incoming.associated_person_id,
      state = incoming.state, due_at = incoming.due_at,
      deferred_until = incoming.deferred_until, resolved_at = incoming.resolved_at,
      cancelled_at = incoming.cancelled_at, updated_at = incoming.updated_at
    where job_id = incoming.job_id returning * into current_job;
  end if;

  -- Any failure here aborts the canonical INSERT/UPDATE as well. Never swallow
  -- a uniqueness or history error: a failed write must not report success.
  insert into public.continuum_project_job_mutations
    (mutation_id, job_id, project_id, action, prior_state, new_state,
     changed_at, changed_by, source_system, operation)
  values (p_mutation_id, current_job.job_id, current_job.project_id, p_action,
    prior_state, current_job.state, current_job.updated_at, p_changed_by,
    case when p_action = 'create' then current_job.source_system else 'concierge-manual' end, operation_snapshot);
  return jsonb_build_object('status', case when p_action = 'create' then 'created' else 'updated' end,
                           'job', to_jsonb(current_job));
end;
$$;

revoke all on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) to service_role;
comment on function public.continuum_write_project_job(jsonb, uuid, text, text, jsonb, jsonb) is
  'Atomic founder Open Job and required mutation history write. Optional Project context; service-role application boundary only.';
commit;
