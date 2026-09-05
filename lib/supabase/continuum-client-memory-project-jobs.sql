-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #10 — durable Project-local Open Jobs foundation.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Open Jobs are unresolved work INSIDE a Project. They are not:
-- generic todos, CoS attention, Agent OS backlog, Project Lifecycle,
-- operating-detail fields, a commitments table, or payment state.
-- Canonical current state lives on the row. No event replay required.
-- No automatic rows. No backfill. No inference from notes, Gmail, Lifecycle,
-- operating details, Human Intake, or reconstruction.
-- Reserved provenance source_system values may be stored as pointers later.
-- Those systems must not write this table in #10.
-- Does not add anon/authenticated grants or RLS policies. RLS remains enabled.
-- No dynamic SQL from field values.
-- No Gmail bodies, voice captures, or attachment bytes.

create table if not exists public.continuum_project_jobs (
  job_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  kind text not null,
  subject text not null,
  detail text,
  waiting_on_actor text not null,
  associated_person_id uuid
    references public.continuum_person_profiles (person_id)
    on delete restrict,
  state text not null,
  due_at timestamptz,
  deferred_until timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  source_system text not null,
  source_ref text,
  created_mutation_id uuid not null,
  constraint continuum_project_jobs_kind_check
    check (kind in (
      'request',
      'commitment',
      'question',
      'required_action',
      'approval',
      'blocked_issue'
    )),
  constraint continuum_project_jobs_actor_check
    check (waiting_on_actor in (
      'founder',
      'hourglass',
      'client',
      'vendor',
      'unknown'
    )),
  constraint continuum_project_jobs_state_check
    check (state in ('open', 'snoozed', 'resolved', 'cancelled')),
  constraint continuum_project_jobs_subject_check
    check (
      char_length(btrim(subject)) between 1 and 160
      and subject !~ E'[\\n\\r]'
    ),
  constraint continuum_project_jobs_detail_check
    check (
      detail is null
      or (
        char_length(detail) <= 2000
        and detail !~ E'[\\u0000]'
      )
    ),
  constraint continuum_project_jobs_source_system_check
    check (source_system in (
      'concierge-manual',
      'gmail',
      'plaud',
      'remarkable',
      'human-intake',
      'calendar',
      'messages',
      'continuum'
    )),
  constraint continuum_project_jobs_source_ref_check
    check (
      source_ref is null
      or (
        char_length(btrim(source_ref)) between 1 and 240
        and source_ref !~ E'[\\n\\r]'
      )
    ),
  constraint continuum_project_jobs_created_by_check
    check (char_length(btrim(created_by)) between 1 and 80),
  constraint continuum_project_jobs_open_check
    check (
      state <> 'open'
      or (
        deferred_until is null
        and resolved_at is null
        and cancelled_at is null
      )
    ),
  constraint continuum_project_jobs_snoozed_check
    check (
      state <> 'snoozed'
      or (
        deferred_until is not null
        and resolved_at is null
        and cancelled_at is null
      )
    ),
  constraint continuum_project_jobs_resolved_check
    check (
      state <> 'resolved'
      or (
        resolved_at is not null
        and cancelled_at is null
        and deferred_until is null
      )
    ),
  constraint continuum_project_jobs_cancelled_check
    check (
      state <> 'cancelled'
      or (
        cancelled_at is not null
        and resolved_at is null
        and deferred_until is null
      )
    )
);

comment on table public.continuum_project_jobs is
  'Canonical Project-local Open Jobs. Unresolved work inside one Project. Current state is on the row. Not CoS attention, not a commitments table, not Lifecycle, not Agent OS backlog.';

comment on column public.continuum_project_jobs.source_ref is
  'Stable source pointer only. Never a Gmail body, captured speech, or attachment URL.';

comment on column public.continuum_project_jobs.waiting_on_actor is
  'Bounded actor role. Not Person identity. associated_person_id is an optional known Person on the same Project.';

comment on column public.continuum_project_jobs.state is
  'open and snoozed are unresolved. resolved and cancelled are terminal history. Snooze is not resolution.';

create unique index if not exists continuum_project_jobs_created_mutation_uq
  on public.continuum_project_jobs (created_mutation_id);

create index if not exists continuum_project_jobs_project_created_idx
  on public.continuum_project_jobs (project_id, created_at desc, job_id desc);

create index if not exists continuum_project_jobs_project_unresolved_idx
  on public.continuum_project_jobs (project_id, created_at desc, job_id desc)
  where state in ('open', 'snoozed');

alter table public.continuum_project_jobs enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.

revoke all on table public.continuum_project_jobs from public;
revoke all on table public.continuum_project_jobs from anon;
revoke all on table public.continuum_project_jobs from authenticated;
grant select, insert, update on table public.continuum_project_jobs to service_role;
