-- Continuum founder sessions (durable logout / revocation).
-- Historical Preview migration retained byte-for-byte at the SQL-statement
-- level. The additive ACL migration narrows its original service-role grant.

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
