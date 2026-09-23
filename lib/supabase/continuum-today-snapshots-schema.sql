-- Continuum Today last-known-good read model.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- One founder-operated row.
-- Stores the rendered Today docket, not the operating loop,
-- not raw Gmail bodies, and not attachment bytes.
--
-- Service-role only. RLS enabled. NO anon/authenticated/public policies.

create table if not exists public.continuum_today_snapshots (
  snapshot_key text primary key check (snapshot_key = 'founder_today_v1'),
  read_model_version text not null check (
    char_length(read_model_version) >= 1
    and char_length(read_model_version) <= 80
  ),
  source_watermark jsonb not null,
  payload jsonb not null,
  composed_at timestamptz not null,
  updated_at timestamptz not null
);

comment on table public.continuum_today_snapshots is
  'Last successful Today render model for a cold process. Not canonical truth. Not mailbox content.';

comment on column public.continuum_today_snapshots.snapshot_key is
  'V1 allows only founder_today_v1.';

comment on column public.continuum_today_snapshots.read_model_version is
  'Must match continuum-today-read-model-v1 before the page renders the payload.';

comment on column public.continuum_today_snapshots.source_watermark is
  'Token of the Today source watermark this payload was composed for. Shape {"token":"<watermark>"} .';

comment on column public.continuum_today_snapshots.payload is
  'Render-safe Today docket. Must not contain raw Gmail bodies, quoted mail, or attachment bytes.';

alter table public.continuum_today_snapshots enable row level security;

revoke all on table public.continuum_today_snapshots from public;
revoke all on table public.continuum_today_snapshots from anon;
revoke all on table public.continuum_today_snapshots from authenticated;

grant select, insert, update on table public.continuum_today_snapshots to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not grant delete.
-- Do not store mailbox bodies.
