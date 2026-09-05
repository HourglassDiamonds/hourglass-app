-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #11 — founder Open Job mutation log.
-- Additive only. Does not rewrite continuum_project_jobs.
-- Does not delete job rows. Terminal history remains on the job row.
-- Does not add anon/authenticated grants or RLS policies.
-- No Gmail, Human Intake, CoS, or Lifecycle writes.

create table if not exists public.continuum_project_job_mutations (
  mutation_id uuid primary key,
  job_id uuid not null
    references public.continuum_project_jobs (job_id)
    on delete restrict,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  action text not null,
  prior_state text,
  new_state text not null,
  changed_at timestamptz not null,
  changed_by text not null,
  source_system text not null,
  constraint continuum_project_job_mutations_action_check
    check (action in (
      'create',
      'resolve',
      'cancel',
      'snooze',
      'unsnooze',
      'update'
    )),
  constraint continuum_project_job_mutations_prior_state_check
    check (
      prior_state is null
      or prior_state in ('open', 'snoozed', 'resolved', 'cancelled')
    ),
  constraint continuum_project_job_mutations_new_state_check
    check (new_state in ('open', 'snoozed', 'resolved', 'cancelled')),
  constraint continuum_project_job_mutations_source_check
    check (source_system in ('concierge-manual', 'continuum')),
  constraint continuum_project_job_mutations_changed_by_check
    check (char_length(btrim(changed_by)) between 1 and 80)
);

comment on table public.continuum_project_job_mutations is
  'Append-only founder Open Job mutation log. Current job state remains on continuum_project_jobs. Not CoS attention history.';

create index if not exists continuum_project_job_mutations_job_changed_idx
  on public.continuum_project_job_mutations (job_id, changed_at desc);

alter table public.continuum_project_job_mutations enable row level security;

revoke all on table public.continuum_project_job_mutations from public;
revoke all on table public.continuum_project_job_mutations from anon;
revoke all on table public.continuum_project_job_mutations from authenticated;
grant select, insert on table public.continuum_project_job_mutations to service_role;
