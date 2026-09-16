-- Continuum founder sessions (durable logout / revocation)
-- Applied to Continuum Preview. Do not run from the app.
-- Production application remains separately founder-approved.
-- Server-only. No policies. No anon/authenticated/PUBLIC grants.
--
-- Stores opaque session identifiers only. Never password material, passkey
-- secrets, OAuth/Gmail tokens, raw IP, or raw browser headers.
--
-- Founder identity reuses the stable WebAuthn subject:
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_sessions');

create table if not exists public.continuum_founder_sessions (
  session_id text primary key,
  founder_user_id text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists continuum_founder_sessions_expires_idx
  on public.continuum_founder_sessions (expires_at);

create index if not exists continuum_founder_sessions_founder_active_idx
  on public.continuum_founder_sessions (founder_user_id)
  where revoked_at is null;

alter table public.continuum_founder_sessions enable row level security;

revoke all on table public.continuum_founder_sessions from public;
revoke all on table public.continuum_founder_sessions from anon;
revoke all on table public.continuum_founder_sessions from authenticated;

grant all on table public.continuum_founder_sessions to service_role;
