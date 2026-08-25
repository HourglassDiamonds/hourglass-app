-- Continuum Human Intake V1 — protected source inbox.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Protected PII plane (same isolation as person profiles and source notes).
-- One row per PLAUD transcript / future reMarkable page.
-- Does not create Persons, facts, wishes, source notes, project history,
-- Open Jobs, kernel Event/Evidence/Observation, or CoS attention rows.
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.
-- Depends on continuum_entities from lib/supabase/continuum-schema.sql.

-- ---------------------------------------------------------------------------
-- Private storage bucket (create in activation audit — do not apply now)
-- ---------------------------------------------------------------------------
-- Dashboard / SQL editor later:
--   Name: continuum-human-sources
--   Public: OFF (public = false)
--   Service-role writes only. No public URLs.
--   Object path is server-generated from source id.
--
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'continuum-human-sources',
  'continuum-human-sources',
  false,
  1048576,
  array[
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/vtt',
    'application/json',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Human sources
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_human_sources (
  id uuid primary key,
  source_type text not null check (
    source_type in ('plaud', 'remarkable')
  ),
  external_source_id text,
  content_sha256 text not null check (
    content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  captured_at timestamptz,
  ingested_at timestamptz not null default now(),
  raw_storage_path text,
  raw_mime_type text,
  raw_byte_size integer check (
    raw_byte_size is null or raw_byte_size >= 0
  ),
  raw_text text,
  parsed_text text,
  source_author text not null check (
    source_author = 'justin'
  ),
  reported_communication_type text not null check (
    reported_communication_type in (
      'call',
      'in-person',
      'voice-memo',
      'reported-text',
      'handwritten',
      'unknown'
    )
  ),
  parser_version text,
  parse_status text not null check (
    parse_status in ('stored', 'parsed', 'no-candidates', 'failed')
  ),
  review_status text not null check (
    review_status in ('pending', 'in-review', 'complete', 'discarded')
  ),
  context_layer_proposed text check (
    context_layer_proposed is null
    or context_layer_proposed in ('client', 'networking', 'personal')
  ),
  context_layer_confirmed text check (
    context_layer_confirmed is null
    or context_layer_confirmed in ('client', 'networking', 'personal')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    raw_text is not null
    or raw_storage_path is not null
  )
);

comment on table public.continuum_human_sources is
  'Protected human-source inbox. PLAUD transcripts and future reMarkable pages. Raw PII. Not canonical Client Memory.';

comment on column public.continuum_human_sources.raw_text is
  'Authority for PLAUD paste/transcript. Never copy into kernel evidence summaries.';

comment on column public.continuum_human_sources.parsed_text is
  'Representation only. Future handwriting parse — not authority.';

comment on column public.continuum_human_sources.reported_communication_type is
  'reported-text means Justin reported a conversation Continuum did not directly observe.';

create unique index if not exists continuum_human_sources_external_id_uq
  on public.continuum_human_sources (source_type, external_source_id)
  where external_source_id is not null;

create unique index if not exists continuum_human_sources_checksum_uq
  on public.continuum_human_sources (source_type, content_sha256);

create index if not exists continuum_human_sources_ingested_idx
  on public.continuum_human_sources (ingested_at desc);

alter table public.continuum_human_sources enable row level security;

revoke all on table public.continuum_human_sources from public;
revoke all on table public.continuum_human_sources from anon;
revoke all on table public.continuum_human_sources from authenticated;

grant select, insert, update, delete on table public.continuum_human_sources to service_role;

-- ---------------------------------------------------------------------------
-- Source → Person / Project links (many-to-many)
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_human_source_links (
  source_id uuid not null references public.continuum_human_sources (id),
  entity_id uuid not null references public.continuum_entities (id),
  entity_kind text not null check (
    entity_kind in ('person', 'project')
  ),
  link_status text not null check (
    link_status in ('candidate', 'confirmed')
  ),
  created_at timestamptz not null default now(),
  primary key (source_id, entity_id)
);

comment on table public.continuum_human_source_links is
  'Manual or future proposed attachments of a human source to canonical entities. V1 writes confirmed only.';

create index if not exists continuum_human_source_links_entity_idx
  on public.continuum_human_source_links (entity_id);

alter table public.continuum_human_source_links enable row level security;

revoke all on table public.continuum_human_source_links from public;
revoke all on table public.continuum_human_source_links from anon;
revoke all on table public.continuum_human_source_links from authenticated;

grant select, insert, update, delete on table public.continuum_human_source_links to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not create continuum_intake_candidates in this phase.
-- Do not create continuum_open_jobs or continuum_commitments.
-- Do not write continuum_attention_items.
