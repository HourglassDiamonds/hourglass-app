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

-- Atomic status CAS for approve / complete.
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
    status = p_to_status,
    approved_at = case
      when p_to_status = 'approved' then now()
      else p.approved_at
    end,
    completed_at = case
      when p_to_status = 'completed' then now()
      else p.completed_at
    end
  where p.id = p_id
    and p.status = p_from_status
    and p.expires_at > now()
    and p_from_status in ('claimed', 'approved')
    and p_to_status in ('approved', 'completed')
    and (
      (p_from_status = 'claimed' and p_to_status = 'approved')
      or (p_from_status = 'approved' and p_to_status = 'completed')
    )
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
