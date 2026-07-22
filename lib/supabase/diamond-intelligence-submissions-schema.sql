-- Diamond Intelligence submission archive (V1)
-- Run in Supabase SQL editor after calibration_records schema.
-- Internal admin only — service role access on server routes.
--
-- ── Retention (application-enforced; review before running in Supabase) ──────
-- Policy: original file + row metadata retained for 30 days from created_at.
-- Application constant: DI_SUBMISSION_RETENTION_DAYS = 30 (lib/.../submission-retention.ts).
-- Cleanup cron: GET /api/cron/diamond-intelligence-submission-cleanup (daily).
-- Eligibility uses created_at age — NOT the textual metadata_retention_policy alone.
-- Existing rows with metadata_retention_policy = 'indefinite' are still cleaned
-- when created_at is older than 30 days. Changing a column DEFAULT does not
-- rewrite existing rows; optional backfill below is documentation only.
-- This SQL file is documented intent — it is not proof of live production state.
-- Do not execute production SQL from the app; review and run manually in Supabase.
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
      'unsupported_report',
      'unsupported_report_format'
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

  -- Retention: 30 days from created_at (app cron deletes storage object + row).
  -- upload_expires_at / ocr_text_expires_at are populated by the app on insert.
  -- Cleanup eligibility is still computed from created_at so legacy rows work
  -- without a destructive one-time migration.
  upload_expires_at timestamptz,
  ocr_text_expires_at timestamptz,
  metadata_retention_policy text not null default '30_days',

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

-- Supports cleanup listing: oldest expired rows first (created_at < cutoff).
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
-- Do not add browser-access policies. Bucket remains private.

-- ── Retention default migration (existing production tables) ─────────────────
-- Idempotent. Changing DEFAULT does not rewrite existing rows.
-- App cleanup still deletes rows older than 30 days by created_at regardless
-- of metadata_retention_policy. Optional label backfill is commented out —
-- review before running; not required for cleanup to function.

alter table diamond_intelligence_submissions
  alter column metadata_retention_policy set default '30_days';

-- Optional (not required for cleanup). Uncomment only after counsel/ops review:
-- update diamond_intelligence_submissions
-- set metadata_retention_policy = '30_days'
-- where metadata_retention_policy = 'indefinite';

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
