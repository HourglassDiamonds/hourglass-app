-- Continuum Client Memory — protected Gmail message index + checkpoints.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Protected PII plane (same isolation as person profiles and source notes).
-- Gmail remains authoritative for mailbox payloads. This index stores metadata only.
-- Subject is PII-capable and must never be copied into the PII-free kernel.
-- No mailbox payload / excerpt / raw address columns.
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create Persons, identities, facts, relationships, wishes, projects,
-- notes, observations, or kernel evidence.

-- ---------------------------------------------------------------------------
-- Indexed Gmail messages (one Gmail users.messages.id per row)
-- V1 assumes a single founder mailbox. message_id is unique in that mailbox.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_messages (
  message_id text primary key,
  thread_id text not null,
  sent_at timestamptz not null,
  indexed_at timestamptz not null default now(),
  subject text,
  from_email_hash text,
  to_email_hashes text[] not null default '{}'::text[],
  cc_email_hashes text[] not null default '{}'::text[],
  direction text not null check (
    direction in ('inbound', 'outbound', 'unknown')
  ),
  label_ids text[] not null default '{}'::text[],
  has_attachments boolean not null default false,
  source_system text not null default 'gmail' check (source_system = 'gmail')
);

comment on table public.continuum_gmail_messages is
  'Protected Gmail source index. No raw body. Participant identity is email_hash only. Subject is internal PII.';

comment on column public.continuum_gmail_messages.message_id is
  'Gmail API users.messages.id. Deterministic idempotency key for one mailbox.';

comment on column public.continuum_gmail_messages.thread_id is
  'Gmail API users.threads.id. Grouping key only — not unique.';

comment on column public.continuum_gmail_messages.subject is
  'Protected-plane PII. Never copy into kernel evidence summaries without redaction.';

comment on column public.continuum_gmail_messages.from_email_hash is
  'SHA-256 continuum:client-memory:v1 email hash. Never a raw address.';

create index if not exists continuum_gmail_messages_thread_idx
  on public.continuum_gmail_messages (thread_id);

create index if not exists continuum_gmail_messages_sent_idx
  on public.continuum_gmail_messages (sent_at);

create index if not exists continuum_gmail_messages_from_hash_idx
  on public.continuum_gmail_messages (from_email_hash)
  where from_email_hash is not null;

alter table public.continuum_gmail_messages enable row level security;

revoke all on table public.continuum_gmail_messages from public;
revoke all on table public.continuum_gmail_messages from anon;
revoke all on table public.continuum_gmail_messages from authenticated;

grant all on table public.continuum_gmail_messages to service_role;

-- ---------------------------------------------------------------------------
-- Checkpoints — historical backfill vs daily memory, not a job framework.
-- Gmail list pageToken and historyId are opaque strings (historyId is uint64).
-- Callers must durably index a batch, then write the checkpoint. This file
-- does not provide a transactional batch+checkpoint function.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_checkpoints (
  job_key text primary key check (
    job_key in ('gmail-historical', 'gmail-memory-daily')
  ),
  status text not null check (
    status in ('idle', 'running', 'failed', 'completed')
  ),
  window_start timestamptz,
  window_end timestamptz,
  page_token text,
  history_id text,
  cursor_message_id text,
  indexed_count integer not null default 0 check (indexed_count >= 0),
  updated_at timestamptz not null default now(),
  error_code text
);

comment on table public.continuum_gmail_checkpoints is
  'Restartable Gmail index cursors. Separate rows for historical vs daily jobs.';

comment on column public.continuum_gmail_checkpoints.page_token is
  'Opaque Gmail users.messages.list pageToken for the current date window.';

comment on column public.continuum_gmail_checkpoints.history_id is
  'Opaque Gmail historyId stored as text to avoid uint64 precision loss.';

alter table public.continuum_gmail_checkpoints enable row level security;

revoke all on table public.continuum_gmail_checkpoints from public;
revoke all on table public.continuum_gmail_checkpoints from anon;
revoke all on table public.continuum_gmail_checkpoints from authenticated;

grant all on table public.continuum_gmail_checkpoints to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
