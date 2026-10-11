-- Metadata-only run lease for founder-triggered Sterling Today shadow acceptance.
-- UNAPPLIED: deployment and migration execution require separate authorization.
-- This is deliberately not a general scheduler or job ledger.
begin;

create table public.continuum_sterling_today_run_leases (
  lease_key text primary key,
  run_id uuid not null,
  run_digest text not null,
  idempotency_key text not null,
  run_state text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  finished_at timestamptz,
  constraint continuum_sterling_today_run_leases_scope_check
    check (lease_key = 'founder-shadow-v1'),
  constraint continuum_sterling_today_run_leases_digest_check
    check (run_digest ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_today_run_leases_idempotency_check
    check (idempotency_key ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_today_run_leases_state_check
    check (run_state in ('running', 'completed', 'failed')),
  constraint continuum_sterling_today_run_leases_window_check
    check (
      expires_at > started_at
      and expires_at <= started_at + interval '10 minutes'
    ),
  constraint continuum_sterling_today_run_leases_finish_check
    check (
      (run_state = 'running' and finished_at is null)
      or
      (run_state in ('completed', 'failed') and finished_at is not null)
    )
);

alter table public.continuum_sterling_today_run_leases enable row level security;
revoke all on table public.continuum_sterling_today_run_leases
  from public, anon, authenticated;
grant select, insert, update on table public.continuum_sterling_today_run_leases
  to service_role;

comment on table public.continuum_sterling_today_run_leases is
  'Service-role-only metadata lease for one founder-triggered Sterling Today shadow run. Contains no evidence, prompts, model output, or client data.';

create or replace function public.continuum_claim_sterling_today_run(
  p_lease_key text,
  p_run_id uuid,
  p_run_digest text,
  p_idempotency_key text,
  p_started_at timestamptz,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_run_id uuid;
begin
  if p_lease_key is distinct from 'founder-shadow-v1'
     or p_run_id is null
     or p_run_digest is null
     or p_run_digest !~ '^[a-f0-9]{64}$'
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_started_at is null
     or p_expires_at is null
     or p_expires_at <= p_started_at
     or p_expires_at > p_started_at + interval '10 minutes'
     or p_started_at < clock_timestamp() - interval '2 minutes'
     or p_started_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'sterling_today_lease_invalid';
  end if;

  insert into public.continuum_sterling_today_run_leases (
    lease_key,
    run_id,
    run_digest,
    idempotency_key,
    run_state,
    started_at,
    expires_at,
    finished_at
  ) values (
    p_lease_key,
    p_run_id,
    p_run_digest,
    p_idempotency_key,
    'running',
    p_started_at,
    p_expires_at,
    null
  )
  on conflict (lease_key) do update set
    run_id = excluded.run_id,
    run_digest = excluded.run_digest,
    idempotency_key = excluded.idempotency_key,
    run_state = excluded.run_state,
    started_at = excluded.started_at,
    expires_at = excluded.expires_at,
    finished_at = null
  where public.continuum_sterling_today_run_leases.run_state <> 'running'
     or public.continuum_sterling_today_run_leases.expires_at <= clock_timestamp()
  returning run_id into claimed_run_id;

  return coalesce(claimed_run_id = p_run_id, false);
end;
$$;

create or replace function public.continuum_finish_sterling_today_run(
  p_lease_key text,
  p_run_id uuid,
  p_run_state text,
  p_finished_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_run_id uuid;
  current_state text;
begin
  if p_lease_key is distinct from 'founder-shadow-v1'
     or p_run_id is null
     or p_run_state is null
     or p_run_state not in ('completed', 'failed')
     or p_finished_at is null
     or p_finished_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'sterling_today_lease_invalid';
  end if;

  update public.continuum_sterling_today_run_leases
  set run_state = p_run_state,
      finished_at = p_finished_at
  where lease_key = p_lease_key
    and run_id = p_run_id
    and run_state = 'running'
    and p_finished_at >= started_at
  returning run_id, run_state into current_run_id, current_state;

  if found then
    return true;
  end if;

  select run_id, run_state into current_run_id, current_state
  from public.continuum_sterling_today_run_leases
  where lease_key = p_lease_key;

  -- Exact replays are successful. A stale holder cannot release a successor
  -- because the current run_id must still match.
  return coalesce(current_run_id = p_run_id and current_state = p_run_state, false);
end;
$$;

revoke all on function public.continuum_claim_sterling_today_run(
  text, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_claim_sterling_today_run(
  text, uuid, text, text, timestamptz, timestamptz
) to service_role;

revoke all on function public.continuum_finish_sterling_today_run(
  text, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_finish_sterling_today_run(
  text, uuid, text, timestamptz
) to service_role;

commit;

-- Safe rollback, when no run is active:
-- drop function public.continuum_finish_sterling_today_run(text, uuid, text, timestamptz);
-- drop function public.continuum_claim_sterling_today_run(text, uuid, text, text, timestamptz, timestamptz);
-- drop table public.continuum_sterling_today_run_leases;
