-- UNAPPLIED.
-- Client Memory Slice B — source-note lifecycle + revisions.
-- DO NOT RUN AGAINST PRODUCTION from this change.
-- Additive only. Does not drop continuum_source_notes_import_field_uq.
-- Does not modify Person, Project, Wish, Fact, Human Intake, Gmail, Digital Card, or CoS.
-- Does not add anon/authenticated grants. RLS remains enabled on source notes.
-- No hard delete. Import identity stays occupied when a note is trashed.
--
-- Backfill:
--   source_system = 'concierge-manual' → kept
--   all other existing source notes, including continuum-reconciliation-v3 → absorbed
-- Ambiguous/unknown source_system values are absorbed (safe: retained, not cockpit-visible).
-- No database DEFAULT for lifecycle_status after backfill: every future write must specify it.

alter table public.continuum_source_notes
  add column if not exists lifecycle_status text;

alter table public.continuum_source_notes
  add column if not exists updated_at timestamptz;

alter table public.continuum_source_notes
  add column if not exists updated_by text;

alter table public.continuum_source_notes
  add column if not exists deleted_at timestamptz;

alter table public.continuum_source_notes
  add column if not exists previous_lifecycle text;

update public.continuum_source_notes
set
  lifecycle_status = case
    when source_system = 'concierge-manual' then 'kept'
    else 'absorbed'
  end,
  updated_at = coalesce(updated_at, created_at)
where lifecycle_status is null;

alter table public.continuum_source_notes
  alter column lifecycle_status set not null;

alter table public.continuum_source_notes
  alter column updated_at set not null;

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_lifecycle_status_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_lifecycle_status_check
  check (
    lifecycle_status in ('inbox', 'kept', 'absorbed', 'trashed')
  );

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_previous_lifecycle_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_previous_lifecycle_check
  check (
    previous_lifecycle is null
    or previous_lifecycle in ('inbox', 'kept', 'absorbed', 'trashed')
  );

alter table public.continuum_source_notes
  drop constraint if exists continuum_source_notes_deleted_at_lifecycle_check;

alter table public.continuum_source_notes
  add constraint continuum_source_notes_deleted_at_lifecycle_check
  check (
    (
      lifecycle_status = 'trashed'
      and deleted_at is not null
    )
    or (
      lifecycle_status <> 'trashed'
      and deleted_at is null
    )
  );

create index if not exists continuum_source_notes_person_lifecycle_idx
  on public.continuum_source_notes (person_id, lifecycle_status, created_at desc);

comment on column public.continuum_source_notes.lifecycle_status is
  'inbox=unfiled capture; kept=founder-visible; absorbed=evidence only; trashed=soft deleted. Same row identity.';

create table if not exists public.continuum_source_note_revisions (
  id uuid primary key,
  note_id uuid not null references public.continuum_source_notes (id),
  mutation_id uuid not null,
  note_text text not null,
  person_id uuid,
  project_id uuid,
  context_layer text not null,
  lifecycle_status text not null check (
    lifecycle_status in ('inbox', 'kept', 'absorbed', 'trashed')
  ),
  change_kind text not null check (
    change_kind in ('edit', 'move', 'trash', 'restore', 'absorb', 'keep')
  ),
  edited_at timestamptz not null,
  edited_by text not null
);

create unique index if not exists continuum_source_note_revisions_mutation_uq
  on public.continuum_source_note_revisions (mutation_id);

create index if not exists continuum_source_note_revisions_note_idx
  on public.continuum_source_note_revisions (note_id, edited_at desc);

comment on table public.continuum_source_note_revisions is
  'Protected prior state of continuum_source_notes. PII plane only. Not a public API.';

alter table public.continuum_source_note_revisions enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Unique index continuum_source_notes_import_field_uq is unchanged.
