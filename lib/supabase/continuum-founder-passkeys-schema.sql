-- Continuum founder passkeys + WebAuthn challenges
-- UNAPPLIED. Do not run from the app. Service-role / SQL editor only after review.
-- Does not store biometric data. Public keys + counters + short-lived challenges only.
-- Separate from Client Memory. No policies. No anon/authenticated/PUBLIC grants.
--
-- Founder WebAuthn user.id (stable, not an email):
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_passkeys');
--   select to_regclass('public.continuum_founder_webauthn_challenges');

create table if not exists public.continuum_founder_passkeys (
  id uuid primary key default gen_random_uuid(),
  founder_user_id text not null,
  credential_id text not null,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb,
  device_type text,
  backed_up boolean,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  label text,
  revoked_at timestamptz
);

create unique index if not exists continuum_founder_passkeys_credential_id_uq
  on public.continuum_founder_passkeys (credential_id);

create index if not exists continuum_founder_passkeys_founder_active_idx
  on public.continuum_founder_passkeys (founder_user_id)
  where revoked_at is null;

alter table public.continuum_founder_passkeys enable row level security;

revoke all on table public.continuum_founder_passkeys from public;
revoke all on table public.continuum_founder_passkeys from anon;
revoke all on table public.continuum_founder_passkeys from authenticated;

grant all on table public.continuum_founder_passkeys to service_role;

create table if not exists public.continuum_founder_webauthn_challenges (
  jti text primary key,
  purpose text not null check (purpose in ('reg', 'auth')),
  founder_user_id text not null,
  challenge text not null,
  origin text not null,
  rp_id text not null,
  session_fingerprint text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists continuum_founder_webauthn_challenges_expires_idx
  on public.continuum_founder_webauthn_challenges (expires_at);

alter table public.continuum_founder_webauthn_challenges enable row level security;

revoke all on table public.continuum_founder_webauthn_challenges from public;
revoke all on table public.continuum_founder_webauthn_challenges from anon;
revoke all on table public.continuum_founder_webauthn_challenges from authenticated;

grant all on table public.continuum_founder_webauthn_challenges to service_role;

create or replace function public.continuum_founder_webauthn_consume_challenge(p_jti text)
returns table (
  jti text,
  purpose text,
  founder_user_id text,
  challenge text,
  origin text,
  rp_id text,
  session_fingerprint text,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_webauthn_challenges as c
  set consumed_at = now()
  where c.jti = p_jti
    and c.consumed_at is null
    and c.expires_at > now()
  returning
    c.jti,
    c.purpose,
    c.founder_user_id,
    c.challenge,
    c.origin,
    c.rp_id,
    c.session_fingerprint,
    c.expires_at,
    c.consumed_at,
    c.created_at;
$$;

revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from public;
revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from anon;
revoke all on function public.continuum_founder_webauthn_consume_challenge(text) from authenticated;

grant execute on function public.continuum_founder_webauthn_consume_challenge(text) to service_role;
