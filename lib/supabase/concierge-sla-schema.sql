-- Concierge Lead SLA ledger (P0-5).
-- Schema document version: 1
-- Apply via Supabase SQL editor (service role). Repeatable: uses IF NOT EXISTS.
--
-- SERVICE-ROLE ONLY: RLS is enabled with NO policies for anon/authenticated.
-- Application access must use SUPABASE_SERVICE_ROLE_KEY on the server.
--
-- Scope: non-PII operational SLA state for Concierge HubSpot deals.
-- Never stores customer name, email, phone, message, or project notes.

create table if not exists concierge_sla_obligations (
  deal_id text primary key,
  contact_id text,
  task_id text,
  submission_id text,
  submitted_at timestamptz not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  immediate_alerted_at timestamptz,
  due_soon_alerted_at timestamptz,
  overdue_alerted_at timestamptz,
  last_checked_at timestamptz,
  status text not null
    check (status in ('open', 'completed', 'abandoned', 'setup_failed')),
  last_error text,
  setup_failed_component text,
  task_recovery_attempts integer not null default 0
    check (task_recovery_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Soft uniqueness for submit retries (nulls allowed; duplicates of non-null blocked).
create unique index if not exists concierge_sla_obligations_submission_id_uq
  on concierge_sla_obligations (submission_id)
  where submission_id is not null;

create index if not exists concierge_sla_obligations_status_due_idx
  on concierge_sla_obligations (status, due_at);

create index if not exists concierge_sla_obligations_open_checked_idx
  on concierge_sla_obligations (status, last_checked_at);

alter table concierge_sla_obligations enable row level security;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Service role bypasses RLS; that is the only intended access path.
