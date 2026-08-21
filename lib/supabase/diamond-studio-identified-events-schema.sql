-- Diamond Studio identified events (Email This View V1)
-- Run in Supabase SQL editor after review. Not executed by the app.
-- Internal / service-role only. Not a CRM. Not marketing consent.
--
-- Matching rule for a later Concierge identity:
--   lower(trim(concierge_email)) = email_normalized
-- Do not attempt probabilistic identity matching.
--
-- This SQL is documented intent until applied in the live project SQL editor.
-- After apply, verify:
--   select to_regclass('public.diamond_studio_identified_events');

create table if not exists diamond_studio_identified_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null check (event = 'studio_view_emailed'),
  status text not null check (status = 'sent'),
  recipient_email text not null,
  email_normalized text not null,
  email_hash text not null,
  first_name text,
  configuration jsonb not null,
  studio_share_path text not null,
  attribution jsonb,
  marketing_consent boolean not null default false,
  inquiry_created boolean not null default false
);

create index if not exists diamond_studio_identified_events_email_normalized_idx
  on diamond_studio_identified_events (email_normalized);

create index if not exists diamond_studio_identified_events_created_at_idx
  on diamond_studio_identified_events (created_at desc);

alter table diamond_studio_identified_events enable row level security;
