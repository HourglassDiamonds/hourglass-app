-- Continuum project evidence association V1.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Membership only: does this source belong to this existing project, and at
-- what explicit status. Not a message store, not a project table, not a
-- work-loop event.
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Does not store Gmail bodies, phone numbers, OAuth tokens, or attachment bytes.
-- Does not alter Gmail, Calendar, SMS, Persons, Projects, or Today.

create table if not exists public.continuum_project_evidence_associations (
  id uuid primary key,
  project_id uuid not null references public.continuum_project_profiles (project_id),
  source_type text not null check (source_type in ('gmail')),
  source_identity text not null check (source_identity ~ '^[0-9a-fA-F]{10,64}$'),
  source_thread_id text check (
    source_thread_id is null or source_thread_id ~ '^[0-9a-fA-F]{10,64}$'
  ),
  status text not null check (
    status in ('candidate', 'trusted', 'rejected', 'ambiguous')
  ),
  basis jsonb not null check (
    jsonb_typeof(basis) = 'object'
    and octet_length(basis::text) <= 4096
    and not (basis ?| array['body', 'phone', 'token'])
  ),
  proposed_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by text check (
    reviewed_by is null
    or (
      char_length(reviewed_by) between 1 and 80
      and reviewed_by !~ '[[:cntrl:]]'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint continuum_project_evidence_associations_review_check check (
    (
      status in ('trusted', 'rejected')
      and reviewed_at is not null
      and reviewed_by is not null
    )
    or (
      status in ('candidate', 'ambiguous')
      and reviewed_at is null
      and reviewed_by is null
    )
  )
);

comment on table public.continuum_project_evidence_associations is
  'Founder-reviewed project evidence membership. Not canonical message text. Not a work loop.';

comment on column public.continuum_project_evidence_associations.source_identity is
  'Strongest practical source unit. For Gmail this is the thread id, not a message id.';

comment on column public.continuum_project_evidence_associations.basis is
  'Explicit provenance flags and project-number refs. Object, at most 4096 bytes. Not a confidence score. No message body.';

-- Serves founder read and write of one project's membership:
-- where project_id = $1, and where project_id + source_type + source_identity.
-- A second (project_id, status) index is unnecessary for those reads.
create unique index if not exists continuum_project_evidence_associations_identity_uq
  on public.continuum_project_evidence_associations (project_id, source_type, source_identity);

alter table public.continuum_project_evidence_associations enable row level security;

revoke all on table public.continuum_project_evidence_associations from public;
revoke all on table public.continuum_project_evidence_associations from anon;
revoke all on table public.continuum_project_evidence_associations from authenticated;

grant select, insert, update on table public.continuum_project_evidence_associations to service_role;

-- Rollback, in order:
--   drop table public.continuum_project_evidence_associations;
-- Rejected status is the durable removal. DELETE is not granted.
-- Current Production does not read or write this table.
-- Applying it before the Project Book deploy does not change Gmail, Calendar, SMS, or Today.
