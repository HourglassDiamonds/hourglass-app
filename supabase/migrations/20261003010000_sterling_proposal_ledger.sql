-- Sterling proposal persistence and founder approval ledger.
-- ADDITIVE / UNAPPLIED: review and deploy explicitly; never apply from this branch.
-- Continuum remains canonical. This table records proposals and decisions only;
-- approved business mutations still execute through canonical service-role writers.
begin;

create table public.continuum_sterling_proposals (
  proposal_id uuid primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  proposal_type text not null,
  status text not null default 'proposed',
  affected_entity_type text not null,
  affected_entity_id text not null,
  current_state_fingerprint text not null,
  current_state_snapshot jsonb not null,
  entity_version text,
  original_proposal jsonb not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  reasoning_summary text not null,
  confidence text not null,
  source_workflow text not null,
  source_watermark text,
  provider text not null,
  model text not null,
  model_configuration text not null,
  run_id uuid not null,
  trace_id text,
  founder_decision text,
  founder_decision_at timestamptz,
  founder_decision_note text,
  founder_edited_payload jsonb,
  defer_until timestamptz,
  canonical_mutation_id uuid,
  executed_payload jsonb,
  execution_status text not null default 'not_requested',
  execution_error_category text,
  superseded_by uuid references public.continuum_sterling_proposals(proposal_id),
  replaces_proposal_id uuid references public.continuum_sterling_proposals(proposal_id),
  executed_at timestamptz,
  ledger_version text not null,
  contract_version text not null,
  prompt_version text not null,
  constraint continuum_sterling_proposals_type_check check (proposal_type in (
    'job_update','priority_change','due_date','waiting_state','duplicate_merge',
    'stale_resolution','new_projectless_job','follow_up'
  )),
  constraint continuum_sterling_proposals_status_check check (status in (
    'proposed','approved','edited_and_approved','rejected','deferred','executing',
    'executed','failed','superseded'
  )),
  constraint continuum_sterling_proposals_entity_check check (
    affected_entity_type in ('job','candidate','project')
    and char_length(btrim(affected_entity_id)) between 1 and 200
  ),
  constraint continuum_sterling_proposals_fingerprint_check check (
    current_state_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint continuum_sterling_proposals_json_check check (
    jsonb_typeof(original_proposal) = 'object'
    and jsonb_typeof(evidence_refs) = 'array'
    and jsonb_array_length(evidence_refs) <= 64
    and octet_length(original_proposal::text) <= 32768
    and octet_length(current_state_snapshot::text) <= 32768
    and (founder_edited_payload is null or jsonb_typeof(founder_edited_payload) = 'object')
    and (executed_payload is null or jsonb_typeof(executed_payload) = 'object')
  ),
  constraint continuum_sterling_proposals_confidence_check check (confidence in ('high','medium','low')),
  constraint continuum_sterling_proposals_execution_check check (execution_status in (
    'not_requested','pending','executing','executed','failed','blocked_stale','blocked_unsupported'
  )),
  constraint continuum_sterling_proposals_decision_check check (
    founder_decision is null or founder_decision in ('approved','edited_and_approved','rejected','deferred')
  ),
  constraint continuum_sterling_proposals_decision_shape_check check (
    (founder_decision is null and founder_decision_at is null and founder_edited_payload is null and defer_until is null)
    or (founder_decision = 'approved' and founder_decision_at is not null and founder_edited_payload is null and defer_until is null)
    or (founder_decision = 'edited_and_approved' and founder_decision_at is not null and founder_edited_payload is not null and defer_until is null)
    or (founder_decision = 'rejected' and founder_decision_at is not null and founder_edited_payload is null and defer_until is null)
    or (founder_decision = 'deferred' and founder_decision_at is not null and founder_edited_payload is null and defer_until is not null)
  ),
  constraint continuum_sterling_proposals_lifecycle_shape_check check (
    (status = 'proposed' and founder_decision is null)
    or (status = 'approved' and founder_decision = 'approved')
    or (status = 'edited_and_approved' and founder_decision = 'edited_and_approved')
    or (status = 'rejected' and founder_decision = 'rejected')
    or (status = 'deferred' and founder_decision = 'deferred')
    or (status in ('executing','executed','failed') and founder_decision in ('approved','edited_and_approved'))
    or status = 'superseded'
  ),
  constraint continuum_sterling_proposals_execution_shape_check check (
    (execution_status = 'executed' and canonical_mutation_id is not null and executed_payload is not null and executed_at is not null)
    or (execution_status <> 'executed' and executed_at is null)
  ),
  constraint continuum_sterling_proposals_lengths_check check (
    char_length(reasoning_summary) between 1 and 4000
    and char_length(source_workflow) between 1 and 100
    and char_length(provider) between 1 and 80
    and char_length(model) between 1 and 160
    and char_length(model_configuration) between 1 and 160
    and char_length(ledger_version) between 1 and 100
    and char_length(contract_version) between 1 and 100
    and char_length(prompt_version) between 1 and 100
    and (founder_decision_note is null or char_length(founder_decision_note) <= 1000)
    and (execution_error_category is null or char_length(execution_error_category) <= 160)
  ),
  constraint continuum_sterling_proposals_time_check check (
    updated_at >= created_at and (executed_at is null or executed_at >= created_at)
  ),
  constraint continuum_sterling_proposals_no_self_link check (
    superseded_by is distinct from proposal_id and replaces_proposal_id is distinct from proposal_id
  )
);

create index continuum_sterling_proposals_active_recent_idx
  on public.continuum_sterling_proposals (created_at desc, proposal_id)
  where status in ('proposed','deferred','approved','edited_and_approved','executing','failed');

create index continuum_sterling_proposals_entity_idx
  on public.continuum_sterling_proposals (affected_entity_type, affected_entity_id, created_at desc);

create index continuum_sterling_proposals_decisions_idx
  on public.continuum_sterling_proposals (founder_decision_at desc, proposal_id)
  where founder_decision is not null;

alter table public.continuum_sterling_proposals enable row level security;

-- Founder authorization is the application's signed session cookie, not a Supabase
-- browser JWT. Reads and writes therefore remain behind authenticated server DALs.
revoke all on table public.continuum_sterling_proposals from public, anon, authenticated;
grant select, insert, update on table public.continuum_sterling_proposals to service_role;

comment on table public.continuum_sterling_proposals is
  'Sterling proposal and founder-decision audit ledger. Never canonical business state; service-role DAL only.';
comment on column public.continuum_sterling_proposals.original_proposal is
  'Immutable Sterling recommendation as originally presented to the founder.';
comment on column public.continuum_sterling_proposals.canonical_mutation_id is
  'Idempotency/history identifier returned by the canonical Continuum writer.';

commit;
