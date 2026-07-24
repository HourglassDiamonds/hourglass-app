-- Agent OS operational persistence (scheduling, cadence, delivery metadata).
-- Schema document version: 2
-- Apply via Supabase SQL editor (service role). Repeatable: uses IF NOT EXISTS.
--
-- SERVICE-ROLE ONLY: RLS is enabled with NO policies for anon/authenticated.
-- Application access must use SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not grant table privileges to anon or authenticated roles.
--
-- Scope: Agent OS run records, finding/recommendation lifecycle, cadence metadata,
-- and delivery reservation/outcome metadata. Never stores secrets, API keys,
-- credentials, or raw recipient email addresses.
-- Audit JSON must contain only redacted operational notes (enforced in app code).
--
-- Retention:
--   - State blob runs: last 50 (application-enforced MAX_RETAINED_RUNS)
--   - State blob deliveries: last 100 (application-enforced MAX_RETAINED_DELIVERIES)
--   - Claim rows intended retention: approximately 90 days
--   - Automatic purge: NOT YET ENABLED
--   - Required before or shortly after scheduled-live activation
--   - Rows contain operational metadata only (no raw recipients or secrets)
--
-- Incompatible existing tables: if agent_os_* tables already exist with a
-- different shape, do NOT apply blindly — migrate explicitly or recreate in a
-- non-production environment first. This file does not auto-alter columns.
--
-- JSON payload size: application validates/migrates state and caps retention;
-- oversized or malformed state fails closed in the adapter (no silent truncate
-- of healthy prior rows on CAS miss).

create table if not exists agent_os_persisted_state (
  scope text primary key check (scope in ('live', 'fixture', 'test')),
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint agent_os_persisted_state_version_positive check (version >= 0)
);

create table if not exists agent_os_delivery_claims (
  idempotency_key text primary key,
  delivery_id text not null,
  kind text not null check (kind in ('founder-brief', 'failure-alert')),
  cadence_id text not null,
  cadence_window text not null,
  status text not null check (
    status in (
      'reserved',
      'sending',
      'sent',
      'failed',
      'uncertain',
      'suppressed'
    )
  ),
  brief_fingerprint text not null,
  recipient_config_fingerprint text not null,
  run_id text not null,
  provider_message_id text,
  error_summary text,
  suppression_reason text,
  reserved_at timestamptz not null,
  updated_at timestamptz not null,
  sent_at timestamptz,
  lease_expires_at timestamptz not null,
  claim_owner text not null,
  resolution_audit jsonb not null default '[]'::jsonb,
  -- Full intended uniqueness boundary (matches app idempotency key inputs)
  constraint agent_os_delivery_claims_window_kind_recipient_uq unique (
    cadence_id,
    cadence_window,
    kind,
    recipient_config_fingerprint
  )
);

-- Lease inspection / reclaim scans
create index if not exists agent_os_delivery_claims_status_lease_idx
  on agent_os_delivery_claims (status, lease_expires_at);

-- Cadence window + kind lookup (inspect / recovery)
create index if not exists agent_os_delivery_claims_cadence_window_idx
  on agent_os_delivery_claims (cadence_id, cadence_window, kind);

-- Retention cleanup candidate scans (when purge is enabled later)
create index if not exists agent_os_delivery_claims_updated_at_idx
  on agent_os_delivery_claims (updated_at);

create index if not exists agent_os_persisted_state_updated_at_idx
  on agent_os_persisted_state (updated_at);

alter table agent_os_persisted_state enable row level security;
alter table agent_os_delivery_claims enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Service role bypasses RLS; that is the only intended access path.
