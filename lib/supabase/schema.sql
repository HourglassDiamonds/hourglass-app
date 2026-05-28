-- Hourglass Intelligence Engine (V1)
-- Run in Supabase SQL editor.

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  week_start date not null,
  week_end date not null,
  executive_summary text not null,
  traffic_summary text not null,
  diamond_studio_summary text not null,
  landing_page_summary text not null,
  opportunities jsonb not null default '[]'::jsonb,
  problems jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists weekly_reports_week_start_idx on weekly_reports (week_start desc);

create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references weekly_reports (id) on delete cascade,
  source text not null,
  metric_name text not null,
  metric_value numeric not null,
  comparison_value numeric,
  delta_percentage numeric,
  dimension text,
  dimension_value text,
  snapshot_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists metric_snapshots_report_id_idx on metric_snapshots (report_id);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references weekly_reports (id) on delete cascade,
  category text not null,
  recommendation text not null,
  priority text not null default 'medium',
  source_signal text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists content_opportunities (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references weekly_reports (id) on delete cascade,
  page text not null,
  query text,
  opportunity_type text not null,
  recommendation text not null,
  priority text not null default 'medium',
  created_at timestamptz not null default now()
);

alter table weekly_reports enable row level security;
alter table metric_snapshots enable row level security;
alter table recommendations enable row level security;
alter table content_opportunities enable row level security;

-- No public policies: access via service role on server only.
--
-- SECURITY: If SUPABASE_SERVICE_ROLE_KEY was ever exposed, rotate it immediately
-- (Supabase Dashboard → Project Settings → API → Reset service_role key).
-- Update SUPABASE_SERVICE_ROLE_KEY in Vercel and .env.local only — never commit keys.

-- Light Performance calibration records: see lib/supabase/calibration-schema.sql