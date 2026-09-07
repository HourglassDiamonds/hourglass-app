-- Continuum Candidate contract #17.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Does not alter Gmail index, checkpoints, history,
-- Persons, project specs, lifecycle, Kind, or Open Jobs.
-- Candidate ≠ truth. canonical = false. automaticApply = false.
--
-- Option B: candidate_state is evidence/lineage.
-- review_status is founder decision state for #19.
-- Source adapters do not write review_status other than pending on insert.
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Does not store Gmail bodies, excerpts, or attachment bytes.
-- source_ref is stored in full (max 2048). Do not truncate provenance.

create table if not exists public.continuum_candidates (
  candidate_id text primary key check (
    candidate_id ~ '^[a-f0-9]{64}$'
  ),
  source_system text not null check (
    source_system in (
      'gmail',
      'human-intake',
      'plaud',
      'remarkable',
      'google_calendar'
    )
  ),
  source_ref text not null check (
    char_length(source_ref) >= 8
    and char_length(source_ref) <= 2048
  ),
  source_timestamp timestamptz not null,
  candidate_type text not null check (
    candidate_type in (
      'person_association',
      'project_association',
      'project_context',
      'note',
      'structured_spec',
      'open_job',
      'date',
      'follow_up'
    )
  ),
  proposed_target jsonb not null,
  payload jsonb not null,
  confidence text not null check (
    confidence in ('high', 'medium', 'low', 'ambiguous')
  ),
  evidence_basis jsonb not null,
  candidate_state text not null check (
    candidate_state in ('active', 'conflict', 'superseded')
  ),
  review_status text not null check (
    review_status in ('pending', 'approved', 'discarded', 'deferred')
  ),
  last_review_action text check (
    last_review_action is null
    or last_review_action in ('approve', 'edit', 'discard', 'defer')
  ),
  founder_edited_payload jsonb,
  founder_edited_target jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null,
  canonical boolean not null default false check (canonical = false),
  automatic_apply boolean not null default false check (automatic_apply = false),
  parser_version text not null,
  supersedes_candidate_id text,
  superseded_by_candidate_id text
);

comment on table public.continuum_candidates is
  'Cross-source Continuum Candidates. Proposals awaiting founder review. Not canonical memory.';

comment on column public.continuum_candidates.source_ref is
  'Full provenance pointer. Never truncate Gmail thread/message ids.';

comment on column public.continuum_candidates.source_system is
  'Allow-list: gmail, human-intake, plaud, remarkable, google_calendar. Invalid values cannot persist.';

comment on column public.continuum_candidates.candidate_state is
  'Evidence/lineage. Conflict is independent of founder review_status.';

comment on column public.continuum_candidates.review_status is
  'Founder disposition for #19: pending/approved/discarded/deferred. Edit is an action, not a status.';

comment on column public.continuum_candidates.founder_edited_target is
  'Optional founder-edited proposed target. Does not write canonical Person/Project/spec/job state.';

comment on column public.continuum_candidates.canonical is
  'Always false. #17 does not write canonical Person/Project/spec/job state.';

comment on column public.continuum_candidates.payload is
  'Structured proposal. open_job.createJob is always false. person_association.mintPerson is always false.';

create unique index if not exists continuum_candidates_identity_uq
  on public.continuum_candidates (candidate_id);

create index if not exists continuum_candidates_source_idx
  on public.continuum_candidates (source_system, source_ref);

create index if not exists continuum_candidates_review_idx
  on public.continuum_candidates (review_status, candidate_state, created_at desc);

alter table public.continuum_candidates enable row level security;

revoke all on table public.continuum_candidates from public;
revoke all on table public.continuum_candidates from anon;
revoke all on table public.continuum_candidates from authenticated;

grant select, insert, update on table public.continuum_candidates to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not grant delete.
-- Do not create continuum_open_jobs or continuum_person_profiles from this table.
-- Do not invoke the project spec writer.
-- Do not mutate Gmail index or checkpoints.
-- Do not store mailbox bodies.
