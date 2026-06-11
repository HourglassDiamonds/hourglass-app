-- Diamond Intelligence submission archive (V1)
-- Run in Supabase SQL editor after calibration_records schema.
-- Internal admin only — service role access on server routes.
--
-- Storage security (Supabase Cloud):
-- - Bucket is private (public = false).
-- - Application uploads via SUPABASE_SERVICE_ROLE_KEY, which bypasses storage RLS.
-- - Do NOT run ALTER TABLE or CREATE/DROP POLICY on storage.objects from this
--   editor. That table is owned by supabase_storage_admin and DDL fails with:
--   ERROR 42501: must be owner of table objects
-- - With no permissive storage policies on this bucket, anon/authenticated
--   clients cannot read or write objects (Supabase default deny).

-- ── Private storage bucket ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diamond-intelligence-submissions',
  'diamond-intelligence-submissions',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Submission archive table ─────────────────────────────────────────────────
create table if not exists diamond_intelligence_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  status text not null check (
    status in (
      'success',
      'partial',
      'unable_to_verify',
      'parser_failure',
      'timeout',
      'unsupported_report'
    )
  ),

  http_status smallint not null,
  cache_hit boolean not null default false,

  report_number text,
  lab text,
  shape text,

  carat text,
  color text,
  clarity text,
  cut text,
  polish text,
  symmetry text,
  fluorescence text,
  measurements text,

  parser_family text,
  parser_path text,
  ocr_used boolean not null default false,
  ocr_confidence jsonb,
  extraction_confidence jsonb,

  missing_fields jsonb not null default '[]'::jsonb,

  optical_tier text,
  purchase_recommendation text,
  percentile_scope text,

  warnings jsonb not null default '[]'::jsonb,
  error_code text,
  failure_reason text,

  source_filename text,
  file_mime text,
  file_size_bytes bigint,
  file_sha256 text,
  file_path text,
  page_image_paths jsonb not null default '[]'::jsonb,

  raw_extracted_text text,
  raw_fields_json jsonb,
  final_output_json jsonb,
  render_audit jsonb,
  upload_metadata jsonb not null default '{}'::jsonb,

  -- Retention preparation (policies not enforced yet)
  upload_expires_at timestamptz,
  ocr_text_expires_at timestamptz,
  metadata_retention_policy text not null default 'indefinite',

  schema_version integer not null default 1,

  -- URL ingestion (V1)
  source_type text not null default 'upload' check (source_type in ('upload', 'url')),
  source_url text,
  vendor text,
  listing_id text,
  listing_price text,
  listing_currency text,
  listing_extraction_json jsonb,
  report_url text,
  url_ingestion_status text,
  url_ingestion_warnings jsonb not null default '[]'::jsonb
);

create index if not exists di_submissions_created_at_idx
  on diamond_intelligence_submissions (created_at desc);

create index if not exists di_submissions_status_idx
  on diamond_intelligence_submissions (status);

create index if not exists di_submissions_lab_idx
  on diamond_intelligence_submissions (lab);

create index if not exists di_submissions_parser_family_idx
  on diamond_intelligence_submissions (parser_family);

create index if not exists di_submissions_error_code_idx
  on diamond_intelligence_submissions (error_code);

create index if not exists di_submissions_file_sha256_idx
  on diamond_intelligence_submissions (file_sha256);

alter table diamond_intelligence_submissions enable row level security;

-- No public policies: access via service role on server only.

-- ── URL ingestion columns (run on existing production table) ────────────────
-- Idempotent migration for diamond_intelligence_submissions created before V1.
-- Run this block in the Supabase SQL editor after the base table exists.

alter table diamond_intelligence_submissions
  add column if not exists source_type text default 'upload';

alter table diamond_intelligence_submissions
  add column if not exists source_url text;

alter table diamond_intelligence_submissions
  add column if not exists vendor text;

alter table diamond_intelligence_submissions
  add column if not exists listing_id text;

alter table diamond_intelligence_submissions
  add column if not exists listing_price text;

alter table diamond_intelligence_submissions
  add column if not exists listing_currency text;

alter table diamond_intelligence_submissions
  add column if not exists listing_extraction_json jsonb;

alter table diamond_intelligence_submissions
  add column if not exists report_url text;

alter table diamond_intelligence_submissions
  add column if not exists url_ingestion_status text;

alter table diamond_intelligence_submissions
  add column if not exists url_ingestion_warnings jsonb default '[]'::jsonb;

-- Backfill NOT NULL columns before enforcing constraints on existing rows.
update diamond_intelligence_submissions
set source_type = 'upload'
where source_type is null;

update diamond_intelligence_submissions
set url_ingestion_warnings = '[]'::jsonb
where url_ingestion_warnings is null;

alter table diamond_intelligence_submissions
  alter column source_type set default 'upload';

alter table diamond_intelligence_submissions
  alter column source_type set not null;

alter table diamond_intelligence_submissions
  alter column url_ingestion_warnings set default '[]'::jsonb;

alter table diamond_intelligence_submissions
  alter column url_ingestion_warnings set not null;

-- CHECK constraint: add only if not already present.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'diamond_intelligence_submissions_source_type_check'
      and conrelid = 'diamond_intelligence_submissions'::regclass
  ) then
    alter table diamond_intelligence_submissions
      add constraint diamond_intelligence_submissions_source_type_check
      check (source_type in ('upload', 'url'));
  end if;
end $$;
