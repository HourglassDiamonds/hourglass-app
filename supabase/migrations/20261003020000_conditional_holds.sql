-- Conditional hold/resume persistence.
-- ADDITIVE / UNAPPLIED: review and deploy explicitly; never apply from this branch.
begin;

alter table public.continuum_sterling_proposals drop constraint continuum_sterling_proposals_type_check;
alter table public.continuum_sterling_proposals add constraint continuum_sterling_proposals_type_check check (proposal_type in (
  'job_update','priority_change','due_date','waiting_state','duplicate_merge','stale_resolution','new_projectless_job','follow_up','conditional_hold'
));

create table public.continuum_conditional_holds (
  hold_id uuid primary key,
  entity_type text not null check (entity_type = 'job'),
  entity_id text not null,
  project_id text,
  created_at timestamptz not null,
  created_by text not null,
  reason text not null,
  condition jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  approval_proposal_id uuid not null unique references public.continuum_sterling_proposals(proposal_id),
  provenance text not null check (provenance = 'sterling-founder-approved'),
  activated_at timestamptz not null,
  expected_entity_updated_at timestamptz not null,
  current_state_fingerprint text not null check (current_state_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('active','condition_met','resumed','cancelled','closed_terminal')),
  condition_met_at timestamptz,
  resumed_at timestamptz,
  resume_evidence jsonb,
  constraint continuum_conditional_holds_json_check check (jsonb_typeof(condition) = 'object' and jsonb_typeof(source_refs) = 'array' and (resume_evidence is null or jsonb_typeof(resume_evidence) = 'object')),
  constraint continuum_conditional_holds_lifecycle_check check (
    (status = 'active' and condition_met_at is null and resumed_at is null)
    or (status = 'condition_met' and condition_met_at is not null and resumed_at is null)
    or (status = 'resumed' and condition_met_at is not null and resumed_at is not null)
    or (status in ('cancelled','closed_terminal') and resumed_at is not null)
  )
);
create unique index continuum_conditional_holds_one_live_entity_idx on public.continuum_conditional_holds(entity_id) where status in ('active','condition_met');
create index continuum_conditional_holds_active_idx on public.continuum_conditional_holds(status, activated_at) where status in ('active','condition_met');
create index continuum_conditional_holds_entity_idx on public.continuum_conditional_holds(entity_id, created_at desc);
alter table public.continuum_conditional_holds enable row level security;
revoke all on table public.continuum_conditional_holds from public, anon, authenticated;
grant select, insert, update on table public.continuum_conditional_holds to service_role;
comment on table public.continuum_conditional_holds is 'Approved suppression adjunct to canonical Continuum Jobs; never a second task store.';
commit;
