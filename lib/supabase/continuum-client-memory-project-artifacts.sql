-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #14 — Hourglass-owned durable Project Artifacts foundation.
-- Additive only. continuum_project_profiles remains the ONE current Project record.
-- Canonical Project files. They are not:
-- Gmail attachment URLs, temporary Gmail previews, reconstruction evidence,
-- Shape Studio captures, Diamond Intelligence archives, or public uploads.
-- Deletion is not available in this foundation. Rows are retained.
-- Storage objects are not deleted. No public object URLs.
-- Does not copy Gmail attachments (#15). Does not write CoS or Lifecycle.
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.

-- ---------------------------------------------------------------------------
-- Private storage bucket (create in activation audit — do not apply now)
-- ---------------------------------------------------------------------------
-- Dashboard / SQL editor later:
--   Name: continuum-project-artifacts
--   Public: OFF (public = false)
--   Service-role writes only. No public URLs. No storage policies for anon.
--   Object path is server-generated: {projectId}/{artifactId}/file.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'continuum-project-artifacts',
  'continuum-project-artifacts',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.continuum_project_artifacts (
  artifact_id uuid primary key,
  project_id uuid not null
    references public.continuum_project_profiles (project_id)
    on delete restrict,
  kind text not null,
  title text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null,
  created_by text not null,
  source_system text not null,
  source_ref text,
  created_mutation_id uuid not null,
  constraint continuum_project_artifacts_kind_check
    check (kind in (
      'render',
      'cad',
      'inspiration',
      'finished_image',
      'production_image',
      'document',
      'other'
    )),
  constraint continuum_project_artifacts_title_check
    check (
      char_length(btrim(title)) between 1 and 160
      and title !~ E'[\\n\\r]'
    ),
  constraint continuum_project_artifacts_filename_check
    check (
      char_length(btrim(original_filename)) between 1 and 180
      and original_filename !~ E'[\\n\\r\\\\/]'
      and position('..' in original_filename) = 0
    ),
  constraint continuum_project_artifacts_mime_check
    check (mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    )),
  constraint continuum_project_artifacts_size_check
    check (byte_size >= 1 and byte_size <= 26214400),
  constraint continuum_project_artifacts_bucket_check
    check (storage_bucket = 'continuum-project-artifacts'),
  constraint continuum_project_artifacts_path_check
    check (
      char_length(storage_path) between 1 and 320
      and storage_path !~ E'[\\n\\r]'
      and position('..' in storage_path) = 0
    ),
  constraint continuum_project_artifacts_source_system_check
    check (source_system in ('concierge-manual', 'gmail', 'continuum')),
  constraint continuum_project_artifacts_source_ref_check
    check (
      source_ref is null
      or (
        char_length(source_ref) <= 240
        and source_ref !~ E'[\\n\\r]'
      )
    ),
  constraint continuum_project_artifacts_created_by_check
    check (char_length(btrim(created_by)) between 1 and 80),
  constraint continuum_project_artifacts_created_mutation_uq
    unique (created_mutation_id),
  constraint continuum_project_artifacts_storage_path_uq
    unique (storage_bucket, storage_path)
);

comment on table public.continuum_project_artifacts is
  'Hourglass-owned durable Project files. Not Gmail attachments, Shape Studio captures, or reconstruction evidence. Deletion is not available in this foundation.';

create index if not exists continuum_project_artifacts_project_created_idx
  on public.continuum_project_artifacts (project_id, created_at desc);

alter table public.continuum_project_artifacts enable row level security;

revoke all on table public.continuum_project_artifacts from public;
revoke all on table public.continuum_project_artifacts from anon;
revoke all on table public.continuum_project_artifacts from authenticated;
grant select, insert on table public.continuum_project_artifacts to service_role;
