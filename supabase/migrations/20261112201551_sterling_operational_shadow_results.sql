-- Durable, sanitized result storage for one founder-triggered Sterling shadow run.
-- UNAPPLIED: Production installation requires separate founder authorization.
begin;

create table public.continuum_sterling_operational_shadow_results (
  execution_id uuid primary key,
  run_id uuid not null unique,
  founder_user_id uuid not null,
  source_sha text not null,
  source_watermark text not null,
  result_sha256 text not null,
  result_byte_count bigint not null,
  terminal_status text not null,
  sanitized_result jsonb not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint continuum_sterling_shadow_source_sha_check
    check (source_sha ~ '^[a-f0-9]{40}$'),
  constraint continuum_sterling_shadow_watermark_check
    check (length(source_watermark) between 1 and 512),
  constraint continuum_sterling_shadow_result_sha_check
    check (result_sha256 ~ '^[a-f0-9]{64}$'),
  constraint continuum_sterling_shadow_result_size_check
    check (result_byte_count between 2 and 2097152),
  constraint continuum_sterling_shadow_terminal_check
    check (terminal_status = 'completed'),
  constraint continuum_sterling_shadow_result_contract_check
    check (sanitized_result->>'contract' = 'sterling-operational-shadow-v11-sanitized-result-v1'),
  constraint continuum_sterling_shadow_result_identity_check
    check (
      sanitized_result->>'runId' = run_id::text
      and sanitized_result->>'executionId' = execution_id::text
      and sanitized_result->>'sourceCommit' = source_sha
    ),
  constraint continuum_sterling_shadow_retention_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '24 hours'
    )
);

alter table public.continuum_sterling_operational_shadow_results enable row level security;
revoke all on table public.continuum_sterling_operational_shadow_results
  from public, anon, authenticated, service_role;
grant select, insert, delete on table public.continuum_sterling_operational_shadow_results
  to service_role;

comment on table public.continuum_sterling_operational_shadow_results is
  'Service-role-only, founder-bound sanitized Sterling shadow results. No correspondence, prompts, raw model output, secrets, proposals, or canonical mutations.';

create or replace function public.continuum_persist_sterling_operational_shadow_result(
  p_lease_key text,
  p_execution_id uuid,
  p_run_id uuid,
  p_founder_user_id uuid,
  p_source_sha text,
  p_source_watermark text,
  p_result_sha256 text,
  p_result_byte_count bigint,
  p_sanitized_result jsonb,
  p_created_at timestamptz,
  p_expires_at timestamptz
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.continuum_sterling_operational_shadow_results%rowtype;
  current_lease public.continuum_sterling_today_run_leases%rowtype;
begin
  select * into existing
  from public.continuum_sterling_operational_shadow_results
  where execution_id = p_execution_id;

  if found then
    if existing.run_id = p_run_id
       and existing.founder_user_id = p_founder_user_id
       and existing.source_sha = p_source_sha
       and existing.source_watermark = p_source_watermark
       and existing.result_sha256 = p_result_sha256
       and existing.result_byte_count = p_result_byte_count
       and existing.sanitized_result = p_sanitized_result
       and existing.terminal_status = 'completed' then
      return 'already_stored';
    end if;
    raise exception 'sterling_shadow_result_conflict';
  end if;

  select * into current_lease
  from public.continuum_sterling_today_run_leases
  where lease_key = p_lease_key
  for update;

  if not found
     or p_lease_key is distinct from 'founder-shadow-v1'
     or current_lease.run_id is distinct from p_run_id
     or current_lease.run_state is distinct from 'running'
     or p_created_at < current_lease.started_at
     or p_created_at > clock_timestamp() + interval '2 minutes'
     or p_expires_at <= p_created_at
     or p_expires_at > p_created_at + interval '24 hours' then
    raise exception 'sterling_shadow_result_invalid';
  end if;

  insert into public.continuum_sterling_operational_shadow_results (
    execution_id, run_id, founder_user_id, source_sha, source_watermark,
    result_sha256, result_byte_count, terminal_status, sanitized_result,
    created_at, expires_at
  ) values (
    p_execution_id, p_run_id, p_founder_user_id, p_source_sha,
    p_source_watermark, p_result_sha256, p_result_byte_count, 'completed',
    p_sanitized_result, p_created_at, p_expires_at
  );

  update public.continuum_sterling_today_run_leases
  set run_state = 'completed', finished_at = p_created_at
  where lease_key = p_lease_key and run_id = p_run_id and run_state = 'running';

  if not found then
    raise exception 'sterling_shadow_result_lease_conflict';
  end if;

  return 'stored';
end;
$$;

revoke all on function public.continuum_persist_sterling_operational_shadow_result(
  text, uuid, uuid, uuid, text, text, text, bigint, jsonb, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.continuum_persist_sterling_operational_shadow_result(
  text, uuid, uuid, uuid, text, text, text, bigint, jsonb, timestamptz, timestamptz
) to service_role;

commit;

-- Exact rollback, after the retained result has been reviewed and deleted:
-- drop function public.continuum_persist_sterling_operational_shadow_result(text, uuid, uuid, uuid, text, text, text, bigint, jsonb, timestamptz, timestamptz);
-- drop table public.continuum_sterling_operational_shadow_results;
