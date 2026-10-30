-- Sterling founder approval -> canonical Continuum transaction.
-- PROPOSED / UNAPPLIED. Review final SQL before applying to shared Preview.
-- Never apply to Production from this branch.
--
-- Record-version semantics:
--   * proposal: continuum_sterling_proposals.record_version (monotonic bigint)
--   * candidate: continuum_candidates.record_version (monotonic bigint)
--   * lifecycle: exact lifecycle-state updated_at plus expected current stage/kind
--   * job: exact job updated_at plus the existing writer's full-row CAS
--
-- Terminal Job history is never rewritten. A mistaken resolution/cancellation is
-- compensated by a new founder-approved Job through the existing canonical writer.

begin;

do $$
begin
  if to_regclass('public.continuum_sterling_proposals') is null
    or to_regclass('public.continuum_project_profiles') is null
    or to_regclass('public.continuum_project_lifecycle_states') is null
    or to_regclass('public.continuum_project_lifecycle_events') is null
    or to_regclass('public.continuum_project_jobs') is null
    or to_regclass('public.continuum_project_job_mutations') is null
    or to_regclass('public.continuum_candidates') is null
    or to_regprocedure('public.continuum_client_memory_set_project_lifecycle(uuid,text,uuid,uuid,timestamptz,text,text)') is null
    or to_regprocedure('public.continuum_write_project_job(jsonb,uuid,text,text,jsonb,jsonb)') is null then
    raise exception 'sterling canonical approval prerequisites are not installed';
  end if;
  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'sterling canonical approval requires pgcrypto digest in extensions schema';
  end if;
end $$;

create schema if not exists continuum_private;
revoke all on schema continuum_private from public;
revoke all on schema continuum_private from anon, authenticated;
grant usage on schema continuum_private to service_role;

create or replace function continuum_private.jsonb_sha256(value jsonb)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'),
    'hex'
  )
$$;

revoke all on function continuum_private.jsonb_sha256(jsonb) from public, anon, authenticated;
grant execute on function continuum_private.jsonb_sha256(jsonb) to service_role;

alter table public.continuum_sterling_proposals
  add column record_version bigint not null default 1,
  add column founder_decided_by text,
  add column approved_payload jsonb,
  add column approved_payload_fingerprint text,
  add column execution_receipt jsonb;

alter table public.continuum_sterling_proposals
  add constraint continuum_sterling_proposals_record_version_check
    check (record_version > 0),
  add constraint continuum_sterling_proposals_approved_payload_check check (
    (approved_payload is null and approved_payload_fingerprint is null)
    or (
      jsonb_typeof(approved_payload) = 'object'
      and octet_length(approved_payload::text) <= 65536
      and approved_payload_fingerprint ~ '^[0-9a-f]{64}$'
    )
  ),
  add constraint continuum_sterling_proposals_execution_receipt_check check (
    execution_receipt is null
    or (jsonb_typeof(execution_receipt) = 'object' and octet_length(execution_receipt::text) <= 131072)
  ),
  add constraint continuum_sterling_proposals_founder_actor_check check (
    founder_decided_by is null or char_length(btrim(founder_decided_by)) between 1 and 80
  ),
  add constraint continuum_sterling_proposals_canonical_approval_shape_check check (
    proposal_type not in ('canonical_change_set', 'source_suppression')
    or (
      (founder_decision is null and approved_payload is null and founder_decided_by is null)
      or (
        founder_decision in ('approved', 'edited_and_approved')
        and approved_payload is not null
        and founder_decided_by is not null
      )
      or founder_decision in ('rejected', 'deferred')
    )
  );

alter table public.continuum_sterling_proposals
  drop constraint continuum_sterling_proposals_type_check;
alter table public.continuum_sterling_proposals
  add constraint continuum_sterling_proposals_type_check check (proposal_type in (
    'job_update','priority_change','due_date','waiting_state','duplicate_merge',
    'stale_resolution','new_projectless_job','follow_up','conditional_hold',
    'canonical_change_set','source_suppression'
  ));

alter table public.continuum_candidates
  add column record_version bigint not null default 1;
alter table public.continuum_candidates
  add constraint continuum_candidates_record_version_check check (record_version > 0);

create or replace function continuum_private.bump_record_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.record_version := old.record_version + 1;
  return new;
end;
$$;

revoke all on function continuum_private.bump_record_version() from public, anon, authenticated;
grant execute on function continuum_private.bump_record_version() to service_role;

create trigger continuum_candidates_record_version_trg
before update on public.continuum_candidates
for each row execute function continuum_private.bump_record_version();

create or replace function continuum_private.guard_sterling_proposal_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.proposal_id is distinct from old.proposal_id
    or new.created_at is distinct from old.created_at
    or new.proposal_type is distinct from old.proposal_type
    or new.affected_entity_type is distinct from old.affected_entity_type
    or new.affected_entity_id is distinct from old.affected_entity_id
    or new.current_state_fingerprint is distinct from old.current_state_fingerprint
    or new.current_state_snapshot is distinct from old.current_state_snapshot
    or new.entity_version is distinct from old.entity_version
    or new.original_proposal is distinct from old.original_proposal
    or new.evidence_refs is distinct from old.evidence_refs
    or new.source_workflow is distinct from old.source_workflow
    or new.source_watermark is distinct from old.source_watermark
    or new.run_id is distinct from old.run_id then
    raise exception 'immutable-proposal-payload';
  end if;

  if old.founder_decision is not null and (
    new.founder_decision is distinct from old.founder_decision
    or new.founder_decision_at is distinct from old.founder_decision_at
    or new.founder_decision_note is distinct from old.founder_decision_note
    or new.founder_edited_payload is distinct from old.founder_edited_payload
    or new.founder_decided_by is distinct from old.founder_decided_by
    or new.approved_payload is distinct from old.approved_payload
    or new.approved_payload_fingerprint is distinct from old.approved_payload_fingerprint
  ) then
    raise exception 'immutable-founder-decision';
  end if;

  if old.execution_status = 'executed' and (
    new.execution_status is distinct from old.execution_status
    or new.canonical_mutation_id is distinct from old.canonical_mutation_id
    or new.executed_payload is distinct from old.executed_payload
    or new.execution_receipt is distinct from old.execution_receipt
    or new.executed_at is distinct from old.executed_at
  ) then
    raise exception 'immutable-execution-receipt';
  end if;

  new.record_version := old.record_version + 1;
  return new;
end;
$$;

revoke all on function continuum_private.guard_sterling_proposal_update() from public, anon, authenticated;
grant execute on function continuum_private.guard_sterling_proposal_update() to service_role;

create trigger continuum_sterling_proposals_guard_trg
before update on public.continuum_sterling_proposals
for each row execute function continuum_private.guard_sterling_proposal_update();

create table public.continuum_candidate_suppression_events (
  event_id uuid primary key,
  proposal_id uuid not null unique
    references public.continuum_sterling_proposals(proposal_id) on delete restrict,
  candidate_id text not null
    references public.continuum_candidates(candidate_id) on delete restrict,
  operation text not null check (operation in ('suppress', 'restore')),
  compensates_proposal_id uuid
    references public.continuum_sterling_proposals(proposal_id) on delete restrict,
  source_refs jsonb not null,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  disposition text not null check (disposition in ('spam', 'terminal')),
  prior_record_version bigint not null check (prior_record_version > 0),
  resulting_record_version bigint not null check (resulting_record_version > prior_record_version),
  prior_review_status text not null,
  resulting_review_status text not null,
  prior_last_review_action text,
  resulting_last_review_action text,
  prior_founder_edited_target jsonb,
  resulting_founder_edited_target jsonb,
  changed_at timestamptz not null,
  changed_by text not null check (char_length(btrim(changed_by)) between 1 and 80),
  constraint continuum_candidate_suppression_events_source_refs_check check (
    jsonb_typeof(source_refs) = 'array'
    and jsonb_array_length(source_refs) between 1 and 64
    and octet_length(source_refs::text) <= 16384
  ),
  constraint continuum_candidate_suppression_events_compensation_check check (
    (operation = 'suppress' and compensates_proposal_id is null)
    or (operation = 'restore' and compensates_proposal_id is not null)
  )
);

create index continuum_candidate_suppression_events_candidate_idx
  on public.continuum_candidate_suppression_events(candidate_id, changed_at desc);
create index continuum_candidate_suppression_events_compensation_idx
  on public.continuum_candidate_suppression_events(compensates_proposal_id)
  where compensates_proposal_id is not null;

alter table public.continuum_candidate_suppression_events enable row level security;
revoke all on table public.continuum_candidate_suppression_events from public, anon, authenticated;
grant select, insert on table public.continuum_candidate_suppression_events to service_role;

comment on table public.continuum_candidate_suppression_events is
  'Append-only exact-source founder suppression and compensation audit. Never deletes Candidate evidence.';

create table public.continuum_sterling_today_publications (
  publication_id uuid primary key,
  run_id uuid not null unique,
  proposal jsonb not null,
  proposal_fingerprint text not null check (proposal_fingerprint ~ '^[0-9a-f]{64}$'),
  source_watermark text not null,
  validation_summary jsonb not null,
  status text not null check (status in ('active', 'superseded', 'revoked')),
  generated_at timestamptz not null,
  validated_at timestamptz not null,
  published_at timestamptz not null,
  expires_at timestamptz not null,
  created_by text not null check (char_length(btrim(created_by)) between 1 and 80),
  constraint continuum_sterling_today_publications_json_check check (
    jsonb_typeof(proposal) = 'object'
    and jsonb_typeof(validation_summary) = 'object'
    and octet_length(proposal::text) <= 1048576
    and validation_summary->>'verdict' = 'PASS'
    and validation_summary->>'accepted' = 'true'
    and validation_summary->>'mutationsReviewable' = 'true'
  ),
  constraint continuum_sterling_today_publications_window_check check (
    generated_at <= validated_at
    and validated_at <= published_at
    and published_at < expires_at
    and expires_at <= published_at + interval '30 minutes'
  )
);

create unique index continuum_sterling_today_one_active_publication_idx
  on public.continuum_sterling_today_publications((status)) where status = 'active';
create index continuum_sterling_today_publications_fresh_idx
  on public.continuum_sterling_today_publications(status, expires_at desc, published_at desc);

alter table public.continuum_sterling_today_publications enable row level security;
revoke all on table public.continuum_sterling_today_publications from public, anon, authenticated;
grant select, insert, update on table public.continuum_sterling_today_publications to service_role;

comment on table public.continuum_sterling_today_publications is
  'Validated bounded Sterling v6 publication snapshots. Page requests read only; they never invoke the model.';

create or replace function continuum_private.guard_sterling_today_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.proposal_fingerprint is distinct from continuum_private.jsonb_sha256(new.proposal) then
    raise exception 'publication-fingerprint-mismatch';
  end if;
  if tg_op = 'UPDATE' and (
    new.publication_id is distinct from old.publication_id
    or new.run_id is distinct from old.run_id
    or new.proposal is distinct from old.proposal
    or new.proposal_fingerprint is distinct from old.proposal_fingerprint
    or new.source_watermark is distinct from old.source_watermark
    or new.validation_summary is distinct from old.validation_summary
    or new.generated_at is distinct from old.generated_at
    or new.validated_at is distinct from old.validated_at
    or new.published_at is distinct from old.published_at
    or new.expires_at is distinct from old.expires_at
    or new.created_by is distinct from old.created_by
  ) then raise exception 'immutable-publication-payload'; end if;
  return new;
end;
$$;

revoke all on function continuum_private.guard_sterling_today_publication() from public, anon, authenticated;
grant execute on function continuum_private.guard_sterling_today_publication() to service_role;

create trigger continuum_sterling_today_publications_guard_trg
before insert or update on public.continuum_sterling_today_publications
for each row execute function continuum_private.guard_sterling_today_publication();

create or replace function continuum_private.publish_sterling_today(
  p_publication_id uuid,
  p_run_id uuid,
  p_proposal jsonb,
  p_source_watermark text,
  p_validation_summary jsonb,
  p_generated_at timestamptz,
  p_validated_at timestamptz,
  p_published_at timestamptz,
  p_expires_at timestamptz,
  p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.continuum_sterling_today_publications%rowtype;
  fingerprint text;
begin
  if p_publication_id is null or p_run_id is null or p_proposal is null
    or jsonb_typeof(p_proposal) <> 'object'
    or p_validation_summary->>'verdict' <> 'PASS'
    or p_validation_summary->>'accepted' <> 'true'
    or p_validation_summary->>'mutationsReviewable' <> 'true'
    or p_source_watermark is null or btrim(p_source_watermark) = ''
    or p_actor is null or char_length(btrim(p_actor)) not between 1 and 80 then
    raise exception 'invalid-publication';
  end if;
  fingerprint := continuum_private.jsonb_sha256(p_proposal);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('continuum-sterling-today-publication', 0));
  select * into existing
  from public.continuum_sterling_today_publications
  where publication_id = p_publication_id or run_id = p_run_id
  for update;
  if found then
    if existing.proposal_fingerprint = fingerprint
      and existing.proposal = p_proposal
      and existing.validation_summary = p_validation_summary then
      return jsonb_build_object('status','already-present','publicationId',existing.publication_id);
    end if;
    raise exception 'publication-idempotency-conflict';
  end if;
  update public.continuum_sterling_today_publications
  set status = 'superseded'
  where status = 'active';
  insert into public.continuum_sterling_today_publications (
    publication_id, run_id, proposal, proposal_fingerprint, source_watermark,
    validation_summary, status, generated_at, validated_at, published_at,
    expires_at, created_by
  ) values (
    p_publication_id, p_run_id, p_proposal, fingerprint, btrim(p_source_watermark),
    p_validation_summary, 'active', p_generated_at, p_validated_at, p_published_at,
    p_expires_at, btrim(p_actor)
  );
  return jsonb_build_object('status','published','publicationId',p_publication_id);
end;
$$;

revoke all on function continuum_private.publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,text)
  from public, anon, authenticated;
grant execute on function continuum_private.publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,text)
  to service_role;

create or replace function public.continuum_publish_sterling_today(
  p_publication_id uuid,
  p_run_id uuid,
  p_proposal jsonb,
  p_source_watermark text,
  p_validation_summary jsonb,
  p_generated_at timestamptz,
  p_validated_at timestamptz,
  p_published_at timestamptz,
  p_expires_at timestamptz,
  p_actor text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception 'service-role-required'; end if;
  return continuum_private.publish_sterling_today(
    p_publication_id, p_run_id, p_proposal, p_source_watermark,
    p_validation_summary, p_generated_at, p_validated_at, p_published_at,
    p_expires_at, p_actor
  );
end;
$$;

revoke all on function public.continuum_publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.continuum_publish_sterling_today(uuid,uuid,jsonb,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,text)
  to service_role;

create or replace function continuum_private.record_sterling_canonical_decision(
  p_proposal_id uuid,
  p_expected_record_version bigint,
  p_decision text,
  p_approved_payload jsonb,
  p_decided_at timestamptz,
  p_actor text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  proposal public.continuum_sterling_proposals%rowtype;
  fingerprint text;
begin
  if p_proposal_id is null or p_expected_record_version is null
    or p_decision not in ('approved', 'edited_and_approved')
    or p_approved_payload is null or jsonb_typeof(p_approved_payload) <> 'object'
    or p_decided_at is null
    or p_actor is null or char_length(btrim(p_actor)) not between 1 and 80
    or (p_note is not null and char_length(p_note) > 1000) then
    raise exception 'invalid-input';
  end if;

  select * into proposal
  from public.continuum_sterling_proposals
  where proposal_id = p_proposal_id
  for update;

  if not found then raise exception 'proposal-not-found'; end if;
  if proposal.proposal_type not in ('canonical_change_set', 'source_suppression') then
    raise exception 'unsupported-proposal-type';
  end if;

  fingerprint := continuum_private.jsonb_sha256(p_approved_payload);

  if proposal.status in ('approved', 'edited_and_approved') then
    if proposal.status = p_decision
      and proposal.founder_decision = p_decision
      and proposal.approved_payload = p_approved_payload
      and proposal.approved_payload_fingerprint = fingerprint then
      return jsonb_build_object(
        'status', 'already-present',
        'proposalId', proposal.proposal_id,
        'recordVersion', proposal.record_version,
        'payloadFingerprint', fingerprint
      );
    end if;
    raise exception 'approval-idempotency-conflict';
  end if;

  if proposal.record_version <> p_expected_record_version then
    raise exception 'stale-ledger-version';
  end if;
  if proposal.status not in ('proposed', 'deferred') then
    raise exception 'invalid-transition';
  end if;
  if p_decision = 'approved' and proposal.original_proposal is distinct from p_approved_payload then
    raise exception 'approved-payload-mismatch';
  end if;

  update public.continuum_sterling_proposals
  set status = p_decision,
      founder_decision = p_decision,
      founder_decision_at = p_decided_at,
      founder_decision_note = nullif(btrim(p_note), ''),
      founder_edited_payload = case when p_decision = 'edited_and_approved' then p_approved_payload else null end,
      founder_decided_by = btrim(p_actor),
      approved_payload = p_approved_payload,
      approved_payload_fingerprint = fingerprint,
      defer_until = null,
      execution_status = 'pending',
      execution_error_category = null,
      updated_at = p_decided_at
  where proposal_id = p_proposal_id
  returning * into proposal;

  return jsonb_build_object(
    'status', 'approved',
    'proposalId', proposal.proposal_id,
    'recordVersion', proposal.record_version,
    'payloadFingerprint', proposal.approved_payload_fingerprint
  );
end;
$$;

revoke all on function continuum_private.record_sterling_canonical_decision(uuid,bigint,text,jsonb,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function continuum_private.record_sterling_canonical_decision(uuid,bigint,text,jsonb,timestamptz,text,text)
  to service_role;

create or replace function public.continuum_sterling_record_canonical_decision(
  p_proposal_id uuid,
  p_expected_record_version bigint,
  p_decision text,
  p_approved_payload jsonb,
  p_decided_at timestamptz,
  p_actor text,
  p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception 'service-role-required'; end if;
  return continuum_private.record_sterling_canonical_decision(
    p_proposal_id, p_expected_record_version, p_decision, p_approved_payload,
    p_decided_at, p_actor, p_note
  );
end;
$$;

revoke all on function public.continuum_sterling_record_canonical_decision(uuid,bigint,text,jsonb,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.continuum_sterling_record_canonical_decision(uuid,bigint,text,jsonb,timestamptz,text,text)
  to service_role;

create or replace function continuum_private.execute_sterling_approved_change_set(
  p_proposal_id uuid,
  p_expected_record_version bigint,
  p_actor text,
  p_executed_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  proposal public.continuum_sterling_proposals%rowtype;
  payload jsonb;
  payload_kind text;
  payload_fingerprint text;
  project_id uuid;
  project_profile public.continuum_project_profiles%rowtype;
  lifecycle_state public.continuum_project_lifecycle_states%rowtype;
  current_job public.continuum_project_jobs%rowtype;
  candidate public.continuum_candidates%rowtype;
  suppression_event public.continuum_candidate_suppression_events%rowtype;
  operation jsonb;
  operation_id uuid;
  operation_kind text;
  operation_result jsonb;
  next_job jsonb;
  receipts jsonb := '[]'::jsonb;
  receipt jsonb;
  expected_version text;
  expected_stage text;
  target_stage text;
  person_id uuid;
  job_id uuid;
  source_refs jsonb;
  source_ref text;
  source_match boolean;
  current_email_hash text;
  action_name text;
  prior_candidate jsonb;
  new_candidate jsonb;
  restored_target jsonb;
  restored_review_status text;
  restored_review_action text;
begin
  if p_proposal_id is null or p_expected_record_version is null
    or p_actor is null or char_length(btrim(p_actor)) not between 1 and 80
    or p_executed_at is null then
    raise exception 'invalid-input';
  end if;

  select * into proposal
  from public.continuum_sterling_proposals
  where proposal_id = p_proposal_id
  for update;

  if not found then raise exception 'proposal-not-found'; end if;
  if proposal.proposal_type not in ('canonical_change_set', 'source_suppression') then
    raise exception 'unsupported-proposal-type';
  end if;

  if proposal.status = 'executed' and proposal.execution_status = 'executed' then
    if proposal.approved_payload is null
      or proposal.approved_payload_fingerprint is distinct from continuum_private.jsonb_sha256(proposal.approved_payload)
      or proposal.executed_payload is distinct from proposal.approved_payload
      or proposal.execution_receipt->>'payloadFingerprint' is distinct from proposal.approved_payload_fingerprint then
      raise exception 'execution-idempotency-conflict';
    end if;
    return jsonb_build_object(
      'status', 'already-present',
      'proposalId', proposal.proposal_id,
      'recordVersion', proposal.record_version,
      'receipt', proposal.execution_receipt
    );
  end if;

  if proposal.record_version <> p_expected_record_version then raise exception 'stale-ledger-version'; end if;
  if proposal.status not in ('approved', 'edited_and_approved')
    or proposal.founder_decision not in ('approved', 'edited_and_approved')
    or proposal.execution_status <> 'pending'
    or proposal.approved_payload is null then
    raise exception 'founder-approval-required';
  end if;

  payload := proposal.approved_payload;
  payload_fingerprint := continuum_private.jsonb_sha256(payload);
  if payload_fingerprint is distinct from proposal.approved_payload_fingerprint then
    raise exception 'approved-payload-fingerprint-mismatch';
  end if;
  payload_kind := payload->>'kind';
  if payload->>'version' <> '1' or payload_kind is distinct from proposal.proposal_type then
    raise exception 'invalid-approved-payload';
  end if;

  if payload_kind = 'canonical_change_set' then
    if jsonb_typeof(payload->'operations') <> 'array'
      or jsonb_array_length(payload->'operations') not between 1 and 16
      or jsonb_typeof(payload->'evidenceRefs') <> 'array'
      or jsonb_array_length(payload->'evidenceRefs') < 1 then
      raise exception 'invalid-approved-payload';
    end if;
    project_id := (payload->>'projectId')::uuid;
    if proposal.affected_entity_type <> 'project'
      or proposal.affected_entity_id <> project_id::text then
      raise exception 'proposal-entity-mismatch';
    end if;

    select * into project_profile
    from public.continuum_project_profiles
    where continuum_project_profiles.project_id = project_id
    for update;
    if not found then raise exception 'project-not-found'; end if;
    if project_profile.project_kind is distinct from payload->>'projectKind' then
      raise exception 'project-kind-conflict';
    end if;
    if not exists (
      select 1 from public.continuum_entities
      where id = project_id and kind = 'project'
    ) then raise exception 'entity-kind-mismatch'; end if;

    -- Validate identifier syntax before casting, then lock every target in a
    -- fixed project -> lifecycle -> person -> relationship -> job order.
    for operation in select value from jsonb_array_elements(payload->'operations')
    loop
      if jsonb_typeof(operation) <> 'object'
        or operation->>'operationId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or operation->>'projectId' <> project_id::text
        or operation->>'personId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or operation->>'expectedRecordVersion' is null then
        raise exception 'invalid-approved-operation';
      end if;
      if jsonb_typeof(operation->'evidenceRefs') <> 'array'
        or jsonb_array_length(operation->'evidenceRefs') < 1
        or exists (
          select 1 from jsonb_array_elements_text(operation->'evidenceRefs') operation_ref
          where not exists (
            select 1 from jsonb_array_elements_text(payload->'evidenceRefs') approved_ref
            where approved_ref = operation_ref
          )
        ) then
        raise exception 'operation-evidence-mismatch';
      end if;
      operation_id := (operation->>'operationId')::uuid;
      operation_kind := operation->>'kind';
      if operation_kind not in ('set_project_lifecycle','update_open_job_holder','resolve_open_job','cancel_open_job') then
        raise exception 'unsupported-approved-operation';
      end if;
      if operation_kind <> 'set_project_lifecycle' then
        if operation->>'jobId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          raise exception 'invalid-job-id';
        end if;
      end if;
    end loop;

    if (
      select count(*) from jsonb_array_elements(payload->'operations') item
      where item->>'kind' <> 'set_project_lifecycle'
    ) <> (
      select count(distinct item->>'jobId') from jsonb_array_elements(payload->'operations') item
      where item->>'kind' <> 'set_project_lifecycle'
    ) then raise exception 'duplicate-job-operation'; end if;
    if (
      select count(*) from jsonb_array_elements(payload->'operations') item
      where item->>'kind' = 'set_project_lifecycle'
    ) > 1 then raise exception 'duplicate-lifecycle-operation'; end if;

    perform 1
    from public.continuum_project_lifecycle_states state
    where state.project_id = project_id and state.project_kind = project_profile.project_kind
    for update;
    perform 1
    from public.continuum_person_profiles person
    where person.person_id in (
      select (item->>'personId')::uuid from jsonb_array_elements(payload->'operations') item
    )
    order by person.person_id
    for key share;
    perform 1
    from public.continuum_relationships relationship
    where relationship.kind = 'client-project' and relationship.status = 'active'
      and (
        (relationship.from_entity_id in (
          select (item->>'personId')::uuid from jsonb_array_elements(payload->'operations') item
        ) and relationship.to_entity_id = project_id)
        or
        (relationship.to_entity_id in (
          select (item->>'personId')::uuid from jsonb_array_elements(payload->'operations') item
        ) and relationship.from_entity_id = project_id)
      )
    order by relationship.id
    for key share;
    perform 1
    from public.continuum_project_jobs job
    where job.job_id in (
      select (item->>'jobId')::uuid from jsonb_array_elements(payload->'operations') item
      where item->>'kind' <> 'set_project_lifecycle'
    )
    order by job.job_id
    for update;

    -- Validate all identities and approved versions before the first write.
    for operation in select value from jsonb_array_elements(payload->'operations')
    loop
      operation_id := (operation->>'operationId')::uuid;
      operation_kind := operation->>'kind';
      person_id := (operation->>'personId')::uuid;
      if not exists (
        select 1 from public.continuum_person_profiles person
        where person.person_id = person_id
      ) then raise exception 'person-not-found'; end if;
      if not exists (
        select 1 from public.continuum_relationships relationship
        where relationship.kind = 'client-project' and relationship.status = 'active'
          and ((relationship.from_entity_id = person_id and relationship.to_entity_id = project_id)
            or (relationship.to_entity_id = person_id and relationship.from_entity_id = project_id))
      ) then raise exception 'person-not-on-project'; end if;
      if exists (select 1 from public.continuum_project_lifecycle_events where mutation_id = operation_id)
        or exists (select 1 from public.continuum_project_job_mutations where mutation_id = operation_id) then
        raise exception 'operation-id-conflict';
      end if;

      if operation_kind = 'set_project_lifecycle' then
        expected_version := operation->>'expectedRecordVersion';
        expected_stage := nullif(operation->>'expectedCurrentStage', '');
        target_stage := nullif(operation->>'targetLifecycleStage', '');
        select * into lifecycle_state
        from public.continuum_project_lifecycle_states state
        where state.project_id = project_id and state.project_kind = project_profile.project_kind;
        if found then
          if expected_version = 'absent'
            or lifecycle_state.updated_at is distinct from expected_version::timestamptz
            or lifecycle_state.stage is distinct from expected_stage then
            raise exception 'stale-lifecycle-version';
          end if;
        elsif expected_version <> 'absent' or expected_stage is not null then
          raise exception 'stale-lifecycle-version';
        end if;
        if target_stage is null then raise exception 'invalid-lifecycle-target'; end if;
      else
        job_id := (operation->>'jobId')::uuid;
        select * into current_job
        from public.continuum_project_jobs job
        where job.job_id = job_id;
        if not found then raise exception 'job-not-found'; end if;
        if current_job.project_id is distinct from project_id then raise exception 'wrong-project'; end if;
        if current_job.associated_person_id is distinct from person_id then raise exception 'cross-client-reassignment'; end if;
        if current_job.updated_at is distinct from (operation->>'expectedRecordVersion')::timestamptz then
          raise exception 'stale-job-version';
        end if;
        if current_job.state not in ('open', 'snoozed') then raise exception 'invalid-job-state'; end if;
        if operation_kind = 'update_open_job_holder'
          and operation->>'targetResponsibleParty' not in ('founder','hourglass','client','vendor','unknown') then
          raise exception 'invalid-job-holder';
        end if;
      end if;
    end loop;

    -- Apply only after every operation has passed identity/version validation.
    for operation in select value from jsonb_array_elements(payload->'operations')
    loop
      operation_id := (operation->>'operationId')::uuid;
      operation_kind := operation->>'kind';
      if operation_kind = 'set_project_lifecycle' then
        operation_result := public.continuum_client_memory_set_project_lifecycle(
          project_id,
          operation->>'targetLifecycleStage',
          operation_id,
          operation_id,
          p_executed_at,
          btrim(p_actor),
          'sterling-founder-approved'
        );
      else
        job_id := (operation->>'jobId')::uuid;
        select * into current_job
        from public.continuum_project_jobs
        where continuum_project_jobs.job_id = job_id
        for update;
        next_job := to_jsonb(current_job) || jsonb_build_object('updated_at', p_executed_at);
        if operation_kind = 'update_open_job_holder' then
          next_job := next_job || jsonb_build_object('waiting_on_actor', operation->>'targetResponsibleParty');
          action_name := 'update';
        elsif operation_kind = 'resolve_open_job' then
          next_job := next_job || jsonb_build_object('state', 'resolved', 'resolved_at', p_executed_at, 'cancelled_at', null);
          action_name := 'resolve';
        else
          next_job := next_job || jsonb_build_object('state', 'cancelled', 'cancelled_at', p_executed_at, 'resolved_at', null);
          action_name := 'cancel';
        end if;
        operation_result := public.continuum_write_project_job(
          next_job,
          operation_id,
          action_name,
          btrim(p_actor),
          to_jsonb(current_job),
          jsonb_build_object(
            'version', 1,
            'source', 'sterling-founder-approved',
            'proposalId', p_proposal_id,
            'evidenceRefs', operation->'evidenceRefs'
          )
        );
      end if;
      receipts := receipts || jsonb_build_array(jsonb_build_object(
        'operationId', operation_id,
        'kind', operation_kind,
        'result', operation_result
      ));
    end loop;

  elsif payload_kind = 'source_suppression' then
    if proposal.affected_entity_type <> 'candidate'
      or proposal.affected_entity_id <> payload->>'candidateId'
      or payload->>'candidateId' !~ '^[0-9a-f]{64}$'
      or payload->>'emailHash' !~ '^[0-9a-f]{64}$'
      or payload->>'disposition' not in ('spam', 'terminal')
      or payload->>'action' not in ('suppress', 'restore')
      or jsonb_typeof(payload->'sourceRefs') <> 'array'
      or jsonb_array_length(payload->'sourceRefs') < 1 then
      raise exception 'invalid-approved-payload';
    end if;
    source_refs := payload->'sourceRefs';

    select * into candidate
    from public.continuum_candidates
    where candidate_id = payload->>'candidateId'
    for update;
    if not found then raise exception 'candidate-not-found'; end if;
    if candidate.source_system <> 'gmail' then raise exception 'candidate-source-mismatch'; end if;
    if candidate.record_version <> (payload->>'expectedRecordVersion')::bigint then
      raise exception 'stale-candidate-version';
    end if;
    source_match := exists (
      select 1 from jsonb_array_elements_text(source_refs) value
      where value = candidate.source_ref
    );
    if not source_match then raise exception 'candidate-source-ref-mismatch'; end if;
    current_email_hash := case
      when candidate.payload->>'kind' = 'person_association' then candidate.payload->>'emailHash'
      else null
    end;
    if current_email_hash is distinct from payload->>'emailHash' then
      raise exception 'candidate-email-hash-mismatch';
    end if;

    prior_candidate := to_jsonb(candidate);
    action_name := payload->>'action';
    if action_name = 'suppress' then
      if payload->>'itemId' is null or payload->>'workUnitId' is null
        or payload->>'label' is null or payload->>'wording' is null then
        raise exception 'invalid-suppression-disposition';
      end if;
      update public.continuum_candidates
      set review_status = 'discarded',
          last_review_action = 'discard',
          reviewed_at = p_executed_at,
          founder_edited_target = coalesce(founder_edited_target, proposed_target, jsonb_build_object('kind','none'))
            || jsonb_build_object(
              'permanentSuppression', true,
              'founderDisposition', jsonb_build_object(
                'kind', payload->>'disposition',
                'itemId', payload->>'itemId',
                'workLoopId', payload->>'workUnitId',
                'cadIds', coalesce(payload->'cadIds', '[]'::jsonb),
                'sourceRefs', source_refs,
                'label', payload->>'label',
                'wording', payload->>'wording'
              )
            )
      where candidate_id = candidate.candidate_id
      returning to_jsonb(continuum_candidates) into new_candidate;
    else
      if payload->>'compensatesProposalId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'invalid-compensation-reference';
      end if;
      select * into suppression_event
      from public.continuum_candidate_suppression_events
      where proposal_id = (payload->>'compensatesProposalId')::uuid
        and candidate_id = candidate.candidate_id
        and operation = 'suppress'
      for share;
      if not found then raise exception 'suppression-compensation-not-found'; end if;
      if candidate.founder_edited_target is distinct from suppression_event.resulting_founder_edited_target
        or candidate.review_status is distinct from suppression_event.resulting_review_status
        or candidate.last_review_action is distinct from suppression_event.resulting_last_review_action then
        raise exception 'suppression-compensation-stale';
      end if;
      restored_target := suppression_event.prior_founder_edited_target;
      restored_review_status := suppression_event.prior_review_status;
      restored_review_action := suppression_event.prior_last_review_action;
      update public.continuum_candidates
      set review_status = restored_review_status,
          last_review_action = restored_review_action,
          reviewed_at = p_executed_at,
          founder_edited_target = restored_target
      where candidate_id = candidate.candidate_id
      returning to_jsonb(continuum_candidates) into new_candidate;
    end if;

    insert into public.continuum_candidate_suppression_events (
      event_id, proposal_id, candidate_id, operation, compensates_proposal_id,
      source_refs, email_hash, disposition, prior_record_version, resulting_record_version,
      prior_review_status, resulting_review_status, prior_last_review_action,
      resulting_last_review_action, prior_founder_edited_target,
      resulting_founder_edited_target, changed_at, changed_by
    ) values (
      p_proposal_id, p_proposal_id, candidate.candidate_id, action_name,
      case when action_name = 'restore' then (payload->>'compensatesProposalId')::uuid else null end,
      source_refs, payload->>'emailHash', payload->>'disposition', candidate.record_version,
      (new_candidate->>'record_version')::bigint, candidate.review_status,
      new_candidate->>'review_status', candidate.last_review_action,
      new_candidate->>'last_review_action', candidate.founder_edited_target,
      new_candidate->'founder_edited_target', p_executed_at, btrim(p_actor)
    );
    receipts := jsonb_build_array(jsonb_build_object(
      'operationId', p_proposal_id,
      'kind', case when action_name = 'suppress' then 'source_suppression' else 'source_suppression_restore' end,
      'candidateId', candidate.candidate_id,
      'resultingRecordVersion', (new_candidate->>'record_version')::bigint
    ));
  else
    raise exception 'unsupported-approved-payload';
  end if;

  receipt := jsonb_build_object(
    'version', 1,
    'proposalId', p_proposal_id,
    'payloadFingerprint', payload_fingerprint,
    'executedAt', p_executed_at,
    'executedBy', btrim(p_actor),
    'operations', receipts
  );

  update public.continuum_sterling_proposals
  set status = 'executed',
      canonical_mutation_id = p_proposal_id,
      executed_payload = payload,
      execution_status = 'executed',
      execution_error_category = null,
      execution_receipt = receipt,
      executed_at = p_executed_at,
      updated_at = p_executed_at
  where proposal_id = p_proposal_id
  returning * into proposal;

  return jsonb_build_object(
    'status', 'executed',
    'proposalId', proposal.proposal_id,
    'recordVersion', proposal.record_version,
    'receipt', receipt
  );
end;
$$;

revoke all on function continuum_private.execute_sterling_approved_change_set(uuid,bigint,text,timestamptz)
  from public, anon, authenticated;
grant execute on function continuum_private.execute_sterling_approved_change_set(uuid,bigint,text,timestamptz)
  to service_role;

create or replace function public.continuum_sterling_execute_approved_change_set(
  p_proposal_id uuid,
  p_expected_record_version bigint,
  p_actor text,
  p_executed_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception 'service-role-required'; end if;
  return continuum_private.execute_sterling_approved_change_set(
    p_proposal_id, p_expected_record_version, p_actor, p_executed_at
  );
end;
$$;

revoke all on function public.continuum_sterling_execute_approved_change_set(uuid,bigint,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.continuum_sterling_execute_approved_change_set(uuid,bigint,text,timestamptz)
  to service_role;

comment on function public.continuum_sterling_execute_approved_change_set(uuid,bigint,text,timestamptz) is
  'Service-role-only wrapper. Executes one immutable founder-approved Sterling payload atomically using canonical Continuum writers.';

commit;

-- Deliberately no destructive down migration. Rollback is feature disablement plus
-- founder-approved compensating history; schema removal requires a separate review.
