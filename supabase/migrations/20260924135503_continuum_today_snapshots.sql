
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

alter table public.continuum_today_snapshots enable row level security;

revoke all on table public.continuum_today_snapshots from public;
revoke all on table public.continuum_today_snapshots from anon;
revoke all on table public.continuum_today_snapshots from authenticated;

grant select, insert, update on table public.continuum_today_snapshots to service_role;
;
