-- Continuum founder passkeys (WebAuthn credential store)
-- UNAPPLIED. Do not run from the app. Service-role / SQL editor only after review.
-- Does not store biometric data. Public keys + counters + transports only.
-- Separate from Client Memory. No policies. No anon/authenticated/PUBLIC grants.
--
-- Founder WebAuthn user.id (stable, not an email):
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_passkeys');

create table if not exists continuum_founder_passkeys (
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
  on continuum_founder_passkeys (credential_id);

create index if not exists continuum_founder_passkeys_founder_active_idx
  on continuum_founder_passkeys (founder_user_id)
  where revoked_at is null;

alter table continuum_founder_passkeys enable row level security;

revoke all on table continuum_founder_passkeys from public;
revoke all on table continuum_founder_passkeys from anon;
revoke all on table continuum_founder_passkeys from authenticated;

grant all on table continuum_founder_passkeys to service_role;
