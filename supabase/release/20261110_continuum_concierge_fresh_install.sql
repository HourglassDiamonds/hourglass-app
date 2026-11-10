-- GENERATED RELEASE ARTIFACT. Do not edit by hand.
-- Executes the tracked Concierge base and ACL correction atomically.
-- Base: supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql
-- Base SHA-256 (LF): 16921151ff3e412e4059b7a8fa57cdff57bedac00d9ea3c4b4266e126fb2da9a
-- ACL: supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql
-- ACL SHA-256 (LF): 4f499f20817822163d6478ad896c4b8f0859f014fa96997e036f31182ee1a479
-- This file is outside supabase/migrations and is never auto-replayed.

begin;

-- BEGIN EXACT BODY: supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql
-- Continuum Concierge P0.5 persistence foundation.
-- UNAPPLIED: review and authorize separately before any shared Preview use.
-- Additive only: no Gmail, Calendar, Vercel, HubSpot routing, or canonical
-- Project mutations. The existing website intake remains identity authority.


create table public.continuum_concierge_ack_outbox (
  outbox_id text primary key check (outbox_id ~ '^ack_[a-f0-9]{24}$'),
  intake_id uuid not null unique references public.continuum_website_intakes(intake_id) on delete restrict,
  candidate_id text not null unique references public.continuum_candidates(candidate_id) on delete restrict,
  event_id text not null unique check (event_id ~ '^event_[a-f0-9]{24}$'),
  lead_id text not null unique check (lead_id ~ '^lead_[a-f0-9]{24}$'),
  action_id text not null unique check (action_id ~ '^action_[a-f0-9]{24}$'),
  submission_id_hash text not null unique check (submission_id_hash ~ '^[a-f0-9]{64}$'),
  concierge_idempotency_key text not null unique check (concierge_idempotency_key ~ '^[a-f0-9]{64}$'),
  concierge_payload_hash text not null check (concierge_payload_hash ~ '^[a-f0-9]{64}$'),
  acceptance_payload_hash text not null check (acceptance_payload_hash ~ '^[a-f0-9]{64}$'),
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  email_verification text not null check (email_verification in ('unverified','verified','failed')),
  qualification text not null check (qualification in ('qualified','needs_review','not_qualified')),
  source_label text not null default 'Website Concierge' check (source_label = 'Website Concierge'),
  copy_version text not null check (char_length(copy_version) between 1 and 80),
  copy_approval_status text not null check (copy_approval_status in ('pending_founder_approval','founder_approved')),
  copy_subject text not null check (char_length(copy_subject) between 1 and 200),
  copy_text text not null check (char_length(copy_text) between 1 and 5000),
  acknowledgement_idempotency_key text not null unique check (acknowledgement_idempotency_key ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('pending_approval','ready','sending','sent','delivery_unknown','failed','suppressed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) between 1 and 500),
  last_attempt_at timestamptz,
  reconciliation_required boolean not null default false,
  follow_up_policy jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint continuum_concierge_ack_outbox_delivery_check check (
    (state = 'sent' and provider_message_id is not null and reconciliation_required = false)
    or (state in ('delivery_unknown','failed') and provider_message_id is null and reconciliation_required = true)
    or (state not in ('sent','delivery_unknown','failed') and provider_message_id is null)
  ),
  constraint continuum_concierge_ack_outbox_attempt_check check (
    (state in ('pending_approval','ready','suppressed') and attempt_count = 0 and last_attempt_at is null)
    or (state in ('sending','sent','delivery_unknown','failed') and attempt_count > 0 and last_attempt_at is not null)
  ),
  constraint continuum_concierge_ack_outbox_follow_up_check check (
    jsonb_typeof(follow_up_policy) = 'object'
    and jsonb_typeof(follow_up_policy->'consent') = 'object'
    and jsonb_typeof(follow_up_policy->'suppressions') = 'array'
  )
);

create index continuum_concierge_ack_outbox_founder_idx
  on public.continuum_concierge_ack_outbox (created_at, intake_id)
  where state in ('pending_approval','ready','delivery_unknown','failed');

create index continuum_concierge_ack_outbox_reconciliation_idx
  on public.continuum_concierge_ack_outbox (updated_at, outbox_id)
  where reconciliation_required = true;

alter table public.continuum_concierge_ack_outbox enable row level security;
alter table public.continuum_concierge_ack_outbox force row level security;

revoke all on table public.continuum_concierge_ack_outbox from public, anon, authenticated;
grant select, insert, update on table public.continuum_concierge_ack_outbox to service_role;

comment on table public.continuum_concierge_ack_outbox is
  'Private service-role-only Concierge acknowledgement ledger. Persistence does not authorize or perform delivery.';
comment on column public.continuum_concierge_ack_outbox.acceptance_payload_hash is
  'Stable server-computed hash for exact replay detection across Candidate, action, acknowledgement, and consent input.';
comment on column public.continuum_concierge_ack_outbox.source_label is
  'Founder-facing label for website Concierge evidence; avoids generic human-intake presentation.';

create or replace function public.continuum_accept_concierge_funnel_v1(
  p_intake_id uuid,
  p_expected_website_idempotency_key_hash text,
  p_acceptance_payload_hash text,
  p_candidate jsonb,
  p_acknowledgement jsonb,
  p_follow_up_policy jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  intake public.continuum_website_intakes%rowtype;
  existing_outbox public.continuum_concierge_ack_outbox%rowtype;
  existing_candidate public.continuum_candidates%rowtype;
  v_candidate_id text := p_candidate->>'candidateId';
  expected_source_ref text := 'website-intake:' || p_intake_id::text;
  outbox_state text := p_acknowledgement->>'state';
begin
  if p_intake_id is null
     or p_expected_website_idempotency_key_hash !~ '^[a-f0-9]{64}$'
     or p_acceptance_payload_hash !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_candidate) <> 'object'
     or jsonb_typeof(p_acknowledgement) <> 'object'
     or jsonb_typeof(p_follow_up_policy) <> 'object'
     or v_candidate_id !~ '^[a-f0-9]{64}$'
     or p_acknowledgement->>'outboxId' !~ '^ack_[a-f0-9]{24}$'
     or p_acknowledgement->>'intakeId' <> p_intake_id::text
     or p_acknowledgement->>'idempotencyKey' !~ '^[a-f0-9]{64}$'
     or outbox_state not in ('pending_approval','ready') then
    raise exception 'invalid-input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_expected_website_idempotency_key_hash, 41));

  select * into intake
    from public.continuum_website_intakes
    where intake_id = p_intake_id
    for update;
  if not found then raise exception 'website-intake-not-found'; end if;
  if intake.idempotency_key_hash is distinct from p_expected_website_idempotency_key_hash then
    raise exception 'website-intake-replay-mismatch';
  end if;
  if intake.synthetic or intake.identity_status = 'synthetic' then
    raise exception 'synthetic-intake-forbidden';
  end if;
  if intake.source <> 'hourglassdiamonds.com/concierge' then
    raise exception 'website-intake-source-mismatch';
  end if;
  if intake.acknowledgement_state <> 'pending' then
    raise exception 'website-acknowledgement-not-pending';
  end if;

  select * into existing_outbox
    from public.continuum_concierge_ack_outbox
    where intake_id = p_intake_id;
  if found then
    if existing_outbox.acceptance_payload_hash is distinct from p_acceptance_payload_hash then
      raise exception 'idempotency-conflict';
    end if;
    return jsonb_build_object(
      'status','already-present','intake_id',existing_outbox.intake_id,
      'candidate_id',existing_outbox.candidate_id,'outbox_id',existing_outbox.outbox_id
    );
  end if;

  if p_candidate->>'sourceSystem' <> 'human-intake'
     or p_candidate->>'sourceRef' <> expected_source_ref
     or p_candidate->>'candidateType' <> 'open_job'
     or p_candidate->'proposedTarget'->>'kind' <> 'open_job'
     or p_candidate->'proposedTarget'->>'projectId' is not null
     or p_candidate->'payload'->>'kind' <> 'open_job'
     or coalesce((p_candidate->'payload'->>'createJob')::boolean, true) <> false
     or coalesce((p_candidate->>'canonical')::boolean, true) <> false
     or coalesce((p_candidate->>'automaticApply')::boolean, true) <> false
     or p_candidate->>'reviewStatus' <> 'pending'
     or (intake.identity_status = 'needs_review' and p_candidate->>'confidence' <> 'ambiguous')
     or (intake.identity_status <> 'needs_review' and p_candidate->>'confidence' = 'ambiguous')
     or p_acknowledgement->>'to' <> intake.email
     or (outbox_state = 'ready' and p_acknowledgement->'copy'->>'approvalStatus' <> 'founder_approved')
     or (outbox_state = 'pending_approval' and p_acknowledgement->'copy'->>'approvalStatus' <> 'pending_founder_approval') then
    raise exception 'authority-boundary-violation';
  end if;

  select * into existing_candidate
    from public.continuum_candidates
    where continuum_candidates.candidate_id = v_candidate_id;
  if found then
    if existing_candidate.source_system is distinct from p_candidate->>'sourceSystem'
       or existing_candidate.source_ref is distinct from p_candidate->>'sourceRef'
       or existing_candidate.candidate_type is distinct from p_candidate->>'candidateType'
       or existing_candidate.proposed_target is distinct from p_candidate->'proposedTarget'
       or existing_candidate.payload is distinct from p_candidate->'payload'
       or existing_candidate.confidence is distinct from p_candidate->>'confidence'
       or existing_candidate.evidence_basis is distinct from p_candidate->'evidenceBasis'
       or existing_candidate.canonical <> false
       or existing_candidate.automatic_apply <> false then
      raise exception 'candidate-id-conflict';
    end if;
  else
    insert into public.continuum_candidates (
      candidate_id, source_system, source_ref, source_timestamp, candidate_type,
      proposed_target, payload, confidence, evidence_basis, candidate_state,
      review_status, last_review_action, founder_edited_payload, founder_edited_target,
      reviewed_at, created_at, canonical, automatic_apply, parser_version,
      supersedes_candidate_id, superseded_by_candidate_id
    ) values (
      v_candidate_id, p_candidate->>'sourceSystem', p_candidate->>'sourceRef',
      (p_candidate->>'sourceTimestamp')::timestamptz, p_candidate->>'candidateType',
      p_candidate->'proposedTarget', p_candidate->'payload', p_candidate->>'confidence',
      p_candidate->'evidenceBasis', p_candidate->>'candidateState', 'pending', null,
      null, null, null, (p_candidate->>'createdAt')::timestamptz, false, false,
      p_candidate->>'parserVersion', nullif(p_candidate->>'supersedesCandidateId',''),
      nullif(p_candidate->>'supersededByCandidateId','')
    );
  end if;

  insert into public.continuum_concierge_ack_outbox (
    outbox_id, intake_id, candidate_id, event_id, lead_id, action_id,
    submission_id_hash, concierge_idempotency_key, concierge_payload_hash,
    acceptance_payload_hash, recipient_email, email_verification, qualification,
    source_label, copy_version, copy_approval_status, copy_subject, copy_text,
    acknowledgement_idempotency_key, state, attempt_count, provider_message_id,
    last_attempt_at, reconciliation_required, follow_up_policy, created_at, updated_at
  ) values (
    p_acknowledgement->>'outboxId', p_intake_id, v_candidate_id,
    p_acknowledgement->>'eventId', p_acknowledgement->>'leadId', p_acknowledgement->>'actionId',
    p_expected_website_idempotency_key_hash, p_acknowledgement->>'conciergeIdempotencyKey',
    p_acknowledgement->>'conciergePayloadHash', p_acceptance_payload_hash,
    p_acknowledgement->>'to', p_acknowledgement->>'emailVerification',
    p_acknowledgement->>'qualification', 'Website Concierge',
    p_acknowledgement->'copy'->>'copyVersion', p_acknowledgement->'copy'->>'approvalStatus',
    p_acknowledgement->'copy'->>'subject', p_acknowledgement->'copy'->>'text',
    p_acknowledgement->>'idempotencyKey', outbox_state, 0, null, null, false,
    p_follow_up_policy, (p_acknowledgement->>'createdAt')::timestamptz,
    (p_acknowledgement->>'createdAt')::timestamptz
  );

  return jsonb_build_object(
    'status','created','intake_id',p_intake_id,
    'candidate_id',v_candidate_id,'outbox_id',p_acknowledgement->>'outboxId'
  );
end;
$$;

create or replace function public.continuum_transition_concierge_ack_v1(
  p_outbox_id text,
  p_acknowledgement_idempotency_key text,
  p_state text,
  p_attempt_count integer,
  p_provider_message_id text default null,
  p_last_attempt_at timestamptz default null,
  p_reconciliation_required boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item public.continuum_concierge_ack_outbox%rowtype;
begin
  if p_outbox_id !~ '^ack_[a-f0-9]{24}$'
     or p_acknowledgement_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_state not in ('sending','sent','delivery_unknown','failed','suppressed')
     or p_attempt_count < 0 then
    raise exception 'invalid-input';
  end if;

  select * into item
    from public.continuum_concierge_ack_outbox
    where outbox_id = p_outbox_id
    for update;
  if not found then raise exception 'acknowledgement-not-found'; end if;
  if item.acknowledgement_idempotency_key is distinct from p_acknowledgement_idempotency_key then
    raise exception 'acknowledgement-idempotency-conflict';
  end if;

  if item.state = p_state
     and item.attempt_count = p_attempt_count
     and item.provider_message_id is not distinct from p_provider_message_id
     and item.last_attempt_at is not distinct from p_last_attempt_at
     and item.reconciliation_required = p_reconciliation_required then
    return jsonb_build_object('status','already-present','state',item.state);
  end if;

  if item.state in ('sent','delivery_unknown','failed','suppressed') then
    raise exception 'acknowledgement-terminal';
  elsif p_state = 'sending' then
    if item.state <> 'ready' or p_attempt_count <> item.attempt_count + 1
       or p_provider_message_id is not null or p_last_attempt_at is null
       or p_reconciliation_required then
      raise exception 'invalid-acknowledgement-transition';
    end if;
  elsif p_state = 'suppressed' then
    if item.state not in ('pending_approval','ready') or p_attempt_count <> 0
       or p_provider_message_id is not null or p_last_attempt_at is not null
       or p_reconciliation_required then
      raise exception 'invalid-acknowledgement-transition';
    end if;
  else
    if item.state <> 'sending' or p_attempt_count <> item.attempt_count
       or p_last_attempt_at is distinct from item.last_attempt_at
       or (p_state = 'sent' and (p_provider_message_id is null or p_reconciliation_required))
       or (p_state in ('delivery_unknown','failed') and (p_provider_message_id is not null or not p_reconciliation_required)) then
      raise exception 'invalid-acknowledgement-transition';
    end if;
  end if;

  update public.continuum_concierge_ack_outbox set
    state = p_state,
    attempt_count = p_attempt_count,
    provider_message_id = p_provider_message_id,
    last_attempt_at = p_last_attempt_at,
    reconciliation_required = p_reconciliation_required,
    updated_at = now()
  where outbox_id = p_outbox_id;

  return jsonb_build_object('status','updated','state',p_state);
end;
$$;

revoke all on function public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)
  to service_role;

revoke all on function public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)
  from public, anon, authenticated;
grant execute on function public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)
  to service_role;

comment on function public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb) is
  'Service-role-only atomic acceptance. Locks and verifies the authoritative website intake; creates only a noncanonical Candidate and private outbox row.';
comment on function public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean) is
  'Service-role-only outbox state machine. Unknown delivery is terminal and quarantined against blind retry.';
-- END EXACT BODY: supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql

-- BEGIN EXACT BODY: supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql
-- Continuum Concierge acknowledgement outbox ACL hardening.
--
-- Follow-up for environments where the P0.9 persistence migration is already
-- recorded. Supabase's legacy public-schema default privileges can grant
-- service_role privileges beyond the intended read/append/update contract.
-- Revoke those inherited object grants before restoring the exact allow-list.


do $$
begin
  if to_regclass('public.continuum_concierge_ack_outbox') is null then
    raise exception 'continuum_concierge_ack_outbox is required';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.continuum_concierge_ack_outbox'::regclass
      and relrowsecurity
      and relforcerowsecurity
  ) then
    raise exception 'continuum_concierge_ack_outbox must have forced RLS';
  end if;

  if to_regprocedure(
    'public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)'
  ) is null or to_regprocedure(
    'public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)'
  ) is null then
    raise exception 'Concierge persistence RPCs are required';
  end if;
end
$$;

revoke all
on table public.continuum_concierge_ack_outbox
from service_role;

grant select, insert, update
on table public.continuum_concierge_ack_outbox
to service_role;

do $$
begin
  if not has_table_privilege(
    'service_role',
    'public.continuum_concierge_ack_outbox',
    'SELECT,INSERT,UPDATE'
  ) or has_table_privilege(
    'service_role',
    'public.continuum_concierge_ack_outbox',
    'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
  ) then
    raise exception 'unexpected effective service_role outbox privileges';
  end if;
end
$$;
-- END EXACT BODY: supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql

commit;
