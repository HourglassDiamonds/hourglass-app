-- Continuum founder iPhone passkey pairing (one-time QR bootstrap)
-- UNAPPLIED. Do not run from the app. Service-role / SQL editor only after review.
-- Separate from Client Memory and from WebAuthn credential storage.
-- Stores token HASH only. Never stores the raw QR bearer token, session
-- cookies, or passwords.
-- No policies. No anon/authenticated/PUBLIC grants.
--
-- Founder WebAuthn user.id (stable, not an email):
--   8f3c1d2e-9a70-4b5e-8c11-00c0711aa001
--
-- After apply, verify:
--   select to_regclass('public.continuum_founder_passkey_pairings');

create table if not exists public.continuum_founder_passkey_pairings (
  id uuid primary key default gen_random_uuid(),
  founder_user_id text not null,
  token_hash text not null,
  status text not null check (
    status in ('pending', 'claimed', 'approved', 'completed', 'cancelled')
  ),
  match_code text not null,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
);

create unique index if not exists continuum_founder_passkey_pairings_token_hash_uq
  on public.continuum_founder_passkey_pairings (token_hash);

create index if not exists continuum_founder_passkey_pairings_status_expires_idx
  on public.continuum_founder_passkey_pairings (status, expires_at);

alter table public.continuum_founder_passkey_pairings enable row level security;

revoke all on table public.continuum_founder_passkey_pairings from public;
revoke all on table public.continuum_founder_passkey_pairings from anon;
revoke all on table public.continuum_founder_passkey_pairings from authenticated;

grant all on table public.continuum_founder_passkey_pairings to service_role;

-- Atomic first claim: pending → claimed. Second caller gets zero rows.
create or replace function public.continuum_founder_passkey_pairing_claim(
  p_token_hash text,
  p_claimed_session_hash text,
  p_device_hint text
)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set
    status = 'claimed',
    claimed_session_hash = p_claimed_session_hash,
    device_hint = p_device_hint,
    claimed_at = now()
  where p.token_hash = p_token_hash
    and p.status = 'pending'
    and p.expires_at > now()
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from public;
revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from anon;
revoke all on function public.continuum_founder_passkey_pairing_claim(text, text, text) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_claim(text, text, text) to service_role;

-- Atomic status CAS for desktop approve only.
-- Completion is exclusively via continuum_founder_passkey_pairing_finalize
-- so a credential cannot be omitted.
create or replace function public.continuum_founder_passkey_pairing_transition(
  p_id uuid,
  p_from_status text,
  p_to_status text
)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set
    status = 'approved',
    approved_at = now()
  where p.id = p_id
    and p.status = 'claimed'
    and p.expires_at > now()
    and p_from_status = 'claimed'
    and p_to_status = 'approved'
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from public;
revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from anon;
revoke all on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_transition(uuid, text, text) to service_role;

create or replace function public.continuum_founder_passkey_pairing_cancel(p_id uuid)
returns table (
  id uuid,
  founder_user_id text,
  token_hash text,
  status text,
  match_code text,
  device_hint text,
  claimed_session_hash text,
  created_at timestamptz,
  expires_at timestamptz,
  claimed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  update public.continuum_founder_passkey_pairings as p
  set status = 'cancelled'
  where p.id = p_id
    and p.status in ('pending', 'claimed', 'approved')
  returning
    p.id,
    p.founder_user_id,
    p.token_hash,
    p.status,
    p.match_code,
    p.device_hint,
    p.claimed_session_hash,
    p.created_at,
    p.expires_at,
    p.claimed_at,
    p.approved_at,
    p.completed_at;
$$;

revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from public;
revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from anon;
revoke all on function public.continuum_founder_passkey_pairing_cancel(uuid) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_cancel(uuid) to service_role;

-- Atomic enrollment finalization: lock approved pairing, insert credential,
-- mark pairing completed. One transaction. Unique credential_id aborts the
-- whole function so the pairing stays approved and can retry.
-- Requires public.continuum_founder_passkeys to exist.
create or replace function public.continuum_founder_passkey_pairing_finalize(
  p_pairing_id uuid,
  p_founder_user_id text,
  p_claimed_session_hash text,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports jsonb,
  p_device_type text,
  p_backed_up boolean,
  p_label text,
  p_created_at timestamptz
)
returns table (
  id uuid,
  founder_user_id text,
  credential_id text,
  public_key text,
  counter bigint,
  transports jsonb,
  device_type text,
  backed_up boolean,
  created_at timestamptz,
  last_used_at timestamptz,
  label text,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pairing_status text;
  pairing_expires timestamptz;
  pairing_founder text;
  pairing_hash text;
  cred public.continuum_founder_passkeys%rowtype;
  completed_id uuid;
begin
  if p_pairing_id is null
     or p_founder_user_id is null
     or p_claimed_session_hash is null
     or p_credential_id is null
     or p_public_key is null
  then
    return;
  end if;

  select p.status, p.expires_at, p.founder_user_id, p.claimed_session_hash
    into pairing_status, pairing_expires, pairing_founder, pairing_hash
  from public.continuum_founder_passkey_pairings as p
  where p.id = p_pairing_id
  for update;

  if pairing_status is null then
    return;
  end if;

  if pairing_status is distinct from 'approved'
     or pairing_expires <= now()
     or pairing_founder is distinct from p_founder_user_id
     or pairing_hash is distinct from p_claimed_session_hash
  then
    return;
  end if;

  insert into public.continuum_founder_passkeys (
    founder_user_id,
    credential_id,
    public_key,
    counter,
    transports,
    device_type,
    backed_up,
    created_at,
    label
  ) values (
    p_founder_user_id,
    p_credential_id,
    p_public_key,
    p_counter,
    p_transports,
    p_device_type,
    p_backed_up,
    coalesce(p_created_at, now()),
    p_label
  )
  returning * into cred;

  update public.continuum_founder_passkey_pairings as p
  set
    status = 'completed',
    completed_at = now()
  where p.id = p_pairing_id
    and p.status = 'approved'
  returning p.id into completed_id;

  if completed_id is null then
    raise exception 'pairing-finalize-race'
      using errcode = 'P0001';
  end if;

  id := cred.id;
  founder_user_id := cred.founder_user_id;
  credential_id := cred.credential_id;
  public_key := cred.public_key;
  counter := cred.counter;
  transports := cred.transports;
  device_type := cred.device_type;
  backed_up := cred.backed_up;
  created_at := cred.created_at;
  last_used_at := cred.last_used_at;
  label := cred.label;
  revoked_at := cred.revoked_at;
  return next;
end;
$$;

revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from public;
revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from anon;
revoke all on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) from authenticated;

grant execute on function public.continuum_founder_passkey_pairing_finalize(uuid, text, text, text, text, bigint, jsonb, text, boolean, text, timestamptz) to service_role;
