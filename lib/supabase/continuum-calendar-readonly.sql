-- Continuum / Concierge Calendar read-only — Sprint #22
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Connection custody for a dedicated calendar.readonly OAuth.
-- Event evidence is live read-through: this file does NOT create an events table.
--
-- Service-role only. RLS enabled. NO anon/authenticated policies.
-- Does not create Persons, identities, facts, relationships, wishes,
-- projects, notes, observations, kernel evidence, Open Jobs, CoS, or Gmail rows.
-- Does not store calendar descriptions, conference join URLs, or plaintext tokens.

-- ---------------------------------------------------------------------------
-- Founder calendar connection + encrypted refresh-token custody
-- V1: one founder calendar slot (calendar_slot = founder-v1).
-- Plaintext refresh/access tokens are never stored.
-- ---------------------------------------------------------------------------

create table if not exists public.continuum_calendar_connections (
  connection_id uuid primary key default gen_random_uuid(),
  calendar_slot text not null default 'founder-v1'
    check (calendar_slot = 'founder-v1'),
  calendar_email_hash text not null,
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
  last_read_at timestamptz,
  status_error_code text,
  constraint continuum_calendar_connections_token_shape check (
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
  constraint continuum_calendar_connections_active_has_token check (
    status not in ('connected', 'paused')
    or refresh_token_ciphertext is not null
  ),
  constraint continuum_calendar_connections_inactive_no_token check (
    status not in ('disconnected', 'revoked')
    or refresh_token_ciphertext is null
  )
);

comment on table public.continuum_calendar_connections is
  'Protected Calendar connection + AES-256-GCM refresh-token custody. One founder slot in V1. Never plaintext tokens. Never event rows.';

comment on column public.continuum_calendar_connections.calendar_email_hash is
  'SHA-256 continuum:client-memory:v1 hash of the bound calendar mailbox. Never a raw address.';

comment on column public.continuum_calendar_connections.refresh_token_ciphertext is
  'AES-256-GCM ciphertext of the Google Calendar refresh token. Null when disconnected or revoked.';

create unique index if not exists continuum_calendar_connections_founder_slot_uq
  on public.continuum_calendar_connections (calendar_slot);

alter table public.continuum_calendar_connections enable row level security;

revoke all on table public.continuum_calendar_connections from public;
revoke all on table public.continuum_calendar_connections from anon;
revoke all on table public.continuum_calendar_connections from authenticated;

grant all on table public.continuum_calendar_connections to service_role;
