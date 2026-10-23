-- One-shot authorization metadata for the first founder-triggered Sarah semantic shadow.
-- UNAPPLIED: migration execution and the experiment require separate authorization.
-- Contains no client identifier, Gmail identifier/content, prompt, or model output.
begin;

create table public.continuum_sterling_today_semantic_authorizations (
  authorization_digest text primary key,
  authorization_state text not null,
  claim_id uuid,
  authorized_at timestamptz not null,
  claimed_at timestamptz,
  expires_at timestamptz,
  finished_at timestamptz,
  constraint continuum_sterling_today_semantic_authorizations_digest_check
    check (authorization_digest ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_today_semantic_authorizations_state_check
    check (authorization_state in ('available', 'claimed', 'completed', 'failed', 'outcome_unknown')),
  constraint continuum_sterling_today_semantic_authorizations_shape_check
    check (
      (authorization_state = 'available' and claim_id is null and claimed_at is null and expires_at is null and finished_at is null)
      or
      (authorization_state = 'claimed' and claim_id is not null and claimed_at is not null and expires_at is not null and finished_at is null)
      or
      (authorization_state in ('completed', 'failed', 'outcome_unknown') and claim_id is not null and claimed_at is not null and expires_at is not null and finished_at is not null)
    ),
  constraint continuum_sterling_today_semantic_authorizations_window_check
    check (expires_at is null or (expires_at > claimed_at and expires_at <= claimed_at + interval '10 minutes'))
);

alter table public.continuum_sterling_today_semantic_authorizations enable row level security;
revoke all on table public.continuum_sterling_today_semantic_authorizations
  from public, anon, authenticated, service_role;

comment on table public.continuum_sterling_today_semantic_authorizations is
  'Service-role-only one-shot experiment authorization metadata. Contains no client identifiers, evidence, prompts, or model output.';

insert into public.continuum_sterling_today_semantic_authorizations (
  authorization_digest,
  authorization_state,
  claim_id,
  authorized_at,
  claimed_at,
  expires_at,
  finished_at
) values (
  'f81a67e7e1dc06701be29c2b7ae3c20aea9715242819030ed9320eb0e134b430',
  'available',
  null,
  '2026-10-23T01:06:12Z'::timestamptz,
  null,
  null,
  null
);

create or replace function public.continuum_claim_sterling_today_sarah_semantic(
  p_authorization_digest text,
  p_claim_id uuid,
  p_claimed_at timestamptz,
  p_expires_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
  current_state text;
  current_expires_at timestamptz;
begin
  if p_authorization_digest is distinct from 'f81a67e7e1dc06701be29c2b7ae3c20aea9715242819030ed9320eb0e134b430'
     or p_claim_id is null
     or p_claimed_at is null
     or p_expires_at is null
     or p_expires_at <= p_claimed_at
     or p_expires_at > p_claimed_at + interval '10 minutes'
     or p_claimed_at < clock_timestamp() - interval '2 minutes'
     or p_claimed_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'sterling_today_sarah_semantic_authorization_invalid';
  end if;

  update public.continuum_sterling_today_semantic_authorizations
  set authorization_state = 'claimed',
      claim_id = p_claim_id,
      claimed_at = p_claimed_at,
      expires_at = p_expires_at,
      finished_at = null
  where authorization_digest = p_authorization_digest
    and authorization_state = 'available'
    and claim_id is null
  returning claim_id into claimed_id;

  if found and claimed_id = p_claim_id then
    return 'acquired';
  end if;

  select authorization_state, expires_at
  into current_state, current_expires_at
  from public.continuum_sterling_today_semantic_authorizations
  where authorization_digest = p_authorization_digest;

  if not found then
    return 'not_authorized';
  end if;
  if current_state = 'claimed' and current_expires_at <= clock_timestamp() then
    return 'outcome_unknown';
  end if;
  return current_state;
end;
$$;

create or replace function public.continuum_finish_sterling_today_sarah_semantic(
  p_authorization_digest text,
  p_claim_id uuid,
  p_outcome_state text,
  p_finished_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_claim_id uuid;
  current_state text;
begin
  if p_authorization_digest is distinct from 'f81a67e7e1dc06701be29c2b7ae3c20aea9715242819030ed9320eb0e134b430'
     or p_claim_id is null
     or p_outcome_state not in ('completed', 'failed', 'outcome_unknown')
     or p_finished_at is null
     or p_finished_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'sterling_today_sarah_semantic_authorization_invalid';
  end if;

  update public.continuum_sterling_today_semantic_authorizations
  set authorization_state = p_outcome_state,
      finished_at = p_finished_at
  where authorization_digest = p_authorization_digest
    and claim_id = p_claim_id
    and authorization_state = 'claimed'
    and p_finished_at >= claimed_at
    and p_finished_at <= expires_at
  returning claim_id, authorization_state into current_claim_id, current_state;

  if found then
    return true;
  end if;

  select claim_id, authorization_state into current_claim_id, current_state
  from public.continuum_sterling_today_semantic_authorizations
  where authorization_digest = p_authorization_digest;

  return coalesce(current_claim_id = p_claim_id and current_state = p_outcome_state, false);
end;
$$;

revoke all on function public.continuum_claim_sterling_today_sarah_semantic(
  text, uuid, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_claim_sterling_today_sarah_semantic(
  text, uuid, timestamptz, timestamptz
) to service_role;

revoke all on function public.continuum_finish_sterling_today_sarah_semantic(
  text, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_finish_sterling_today_sarah_semantic(
  text, uuid, text, timestamptz
) to service_role;

commit;

-- Safe rollback only before the authorization is claimed:
-- drop function public.continuum_finish_sterling_today_sarah_semantic(text, uuid, text, timestamptz);
-- drop function public.continuum_claim_sterling_today_sarah_semantic(text, uuid, timestamptz, timestamptz);
-- drop table public.continuum_sterling_today_semantic_authorizations;
