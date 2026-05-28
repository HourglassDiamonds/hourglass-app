-- Light Performance calibration records (V1)
-- Run in Supabase SQL editor after weekly_reports schema.

create table if not exists calibration_records (
  id uuid primary key default gen_random_uuid(),
  lab text not null check (lab in ('GIA', 'GCAL', 'AGS', 'IGI', 'OTHER')),
  report_number text not null,
  report_number_norm text not null,
  report_url text,
  report_source text not null check (
    report_source in ('manual', 'pdf-upload', 'screenshot-upload', 'vendor-feed')
  ),
  stone_type text not null check (stone_type in ('natural', 'lab-grown', 'unknown')),

  fields jsonb not null,
  fields_normalized jsonb not null,
  confidence jsonb not null,

  extracted_fields_raw jsonb not null,
  extracted_confidence jsonb not null,

  parser_type text,
  parser_confidence text,
  text_method text,
  warnings jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  parser_metadata jsonb not null default '{}'::jsonb,

  round_brilliant_score jsonb,
  source_filename text,
  reviewer_note text,

  record_version integer not null default 1,
  schema_version integer not null default 1,
  seeded boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (lab, report_number_norm, report_source)
);

create index if not exists calibration_records_lab_report_idx
  on calibration_records (lab, report_number_norm);

create index if not exists calibration_records_created_at_idx
  on calibration_records (created_at desc);

alter table calibration_records enable row level security;

-- No public policies: access via service role on server only.
