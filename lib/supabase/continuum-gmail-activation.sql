-- Continuum / Concierge Gmail read-only activation — Slices A + B
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Production already has:
--   public.continuum_gmail_messages
--   public.continuum_gmail_checkpoints
-- Do NOT recreate those tables. Do NOT reapply
-- lib/supabase/continuum-client-memory-gmail-index.sql.
--
-- This file:
--   1. Adds bcc_email_hashes to the existing message index
--   2. Creates continuum_gmail_connections (token custody)
--   3. Creates continuum_gmail_attachments (metadata only)
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create Persons, identities, facts, relationships, wishes,
-- projects, notes, observations, kernel evidence, Open Jobs, or CoS rows.
-- Does not store mailbox body, HTML, snippet, or attachment bytes.

-- ---------------------------------------------------------------------------
-- Backward-compatible BCC participant hashes on the existing message index
-- ---------------------------------------------------------------------------

alter table public.continuum_gmail_messages
  add column if not exists bcc_email_hashes text[] not null default '{}'::text[];

comment on column public.continuum_gmail_messages.bcc_email_hashes is
  'SHA-256 continuum:client-memory:v1 email hashes. Never raw addresses.';

-- ---------------------------------------------------------------------------
-- Founder mailbox connection + encrypted refresh-token custody
-- V1: one founder mailbox (mailbox_slot = founder-v1).
-- Plaintext refresh/access tokens are never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_connections (
  connection_id uuid primary key default gen_random_uuid(),
  mailbox_slot text not null default 'founder-v1'
    check (mailbox_slot = 'founder-v1'),
  mailbox_email_hash text not null,
  status text not null check (
    status in ('connected', 'paused', 'disconnected', 'revoked')
  ),
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  token_enc_alg text check (
    token_enc_alg is null or token_enc_alg = 'aes-256-gcm'
  ),
  token_enc_version integer check (
    token_enc_version is null or token_enc_version >= 1
  ),
  granted_scope text,
  provider_token_type text,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  status_error_code text,
  constraint continuum_gmail_connections_token_shape check (
    (
      refresh_token_ciphertext is null
      and refresh_token_iv is null
      and refresh_token_tag is null
      and token_enc_alg is null
      and token_enc_version is null
    )
    or (
      refresh_token_ciphertext is not null
      and refresh_token_iv is not null
      and refresh_token_tag is not null
      and token_enc_alg = 'aes-256-gcm'
      and token_enc_version is not null
    )
  ),
  constraint continuum_gmail_connections_active_has_token check (
    status not in ('connected', 'paused')
    or refresh_token_ciphertext is not null
  ),
  constraint continuum_gmail_connections_inactive_no_token check (
    status not in ('disconnected', 'revoked')
    or refresh_token_ciphertext is null
  )
);

comment on table public.continuum_gmail_connections is
  'Protected Gmail connection + AES-256-GCM refresh-token custody. One founder mailbox in V1. Never plaintext tokens.';

comment on column public.continuum_gmail_connections.mailbox_email_hash is
  'SHA-256 continuum:client-memory:v1 hash of the bound mailbox. Never a raw address.';

comment on column public.continuum_gmail_connections.refresh_token_ciphertext is
  'AES-256-GCM ciphertext of the Google refresh token. Null when disconnected or revoked.';

create unique index if not exists continuum_gmail_connections_founder_slot_uq
  on public.continuum_gmail_connections (mailbox_slot);

alter table public.continuum_gmail_connections enable row level security;

revoke all on table public.continuum_gmail_connections from public;
revoke all on table public.continuum_gmail_connections from anon;
revoke all on table public.continuum_gmail_connections from authenticated;

grant all on table public.continuum_gmail_connections to service_role;

-- ---------------------------------------------------------------------------
-- Attachment metadata only. Never bytes. Never messages.attachments.get.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_gmail_attachments (
  message_id text not null,
  attachment_id text not null,
  thread_id text not null,
  filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  indexed_at timestamptz not null default now(),
  primary key (message_id, attachment_id)
);

comment on table public.continuum_gmail_attachments is
  'Protected Gmail attachment metadata. No bytes. No body. Filename may be PII-capable.';

comment on column public.continuum_gmail_attachments.attachment_id is
  'Gmail payload body.attachmentId. Identity is (message_id, attachment_id).';

create index if not exists continuum_gmail_attachments_thread_idx
  on public.continuum_gmail_attachments (thread_id);

alter table public.continuum_gmail_attachments enable row level security;

revoke all on table public.continuum_gmail_attachments from public;
revoke all on table public.continuum_gmail_attachments from anon;
revoke all on table public.continuum_gmail_attachments from authenticated;

grant all on table public.continuum_gmail_attachments to service_role;

-- Explicitly: do not add anon/authenticated RLS policies.
-- Do not create SECURITY DEFINER functions in this migration.
